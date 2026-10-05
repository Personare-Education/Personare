import { execFile } from "node:child_process";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { promisify } from "node:util";
import {
  app,
  BrowserWindow,
  ipcMain,
  Menu,
  Notification,
  Tray,
} from "electron";
import {
  installExtension,
  REACT_DEVELOPER_TOOLS,
} from "electron-devtools-installer";
import isSquirrelEvent from "electron-squirrel-startup";
import { UpdateSourceType, updateElectronApp } from "update-electron-app";
import { createDatabaseClient } from "@/database/client";
import { resolveMigrationsFolder, runMigrations } from "@/database/migrate";
import {
  setAuthSession,
  setAuthToken,
  setAuthTokenFilePath,
} from "@/ipc/auth/state";
import { setCalendarConnected } from "@/ipc/calendar-sync/state";
import { ipcContext } from "@/ipc/context";
import { getDatabaseClient, setDatabaseClient } from "@/ipc/database/state";
import { setDriveConnected } from "@/ipc/drive-backup/state";
import { getOrCreateAppSettings } from "@/ipc/settings/handlers";
import { loadToken, saveToken } from "@/main/auth-token-storage";
import { fetchCurrentUser } from "@/main/backend-client";
import { countDueReviews } from "@/main/due-reviews";
import { registerAppImageProtocolHandler } from "@/main/linux-protocol";
import {
  findOAuthCallbackUrl,
  getProtocolCallbackHost,
  parseCalendarConnectCallback,
  parseDriveConnectCallback,
  parseOAuthCallback,
} from "@/main/oauth-callback";
import { createPlaceholderTrayIcon } from "@/main/tray-icon";
import {
  IPC_CHANNELS,
  inDevelopment,
  macTrafficLightPosition,
  OAUTH_PROTOCOL,
} from "./constants";
import { getBasePath } from "./utils/path";

let mainWindow: BrowserWindow | undefined;
let tray: Tray | undefined;

// Only true inside the Tray's "Sair" handler, right before app.quit() --
// distinguishes a real quit from the window's own close button, which
// should minimize to the Tray instead (docs/specs/issue-20-notificacao-boot.md).
let isQuitting = false;

// Deep-linking (Issue #25, personare:// OAuth callback) requires a single
// instance: on Windows/Linux, the OS launches a *second* process to deliver
// the URL to an already-running app, which must hand it off to the first
// instance via "second-instance" and then exit immediately.
//
// Squirrel.Windows (Setup.exe) launches the app with --squirrel-* flags on
// install/update/uninstall; electron-squirrel-startup creates or removes the
// shortcuts and quits, so nothing else may start in that case.
const gotTheSingleInstanceLock =
  !isSquirrelEvent && app.requestSingleInstanceLock();

if (!(gotTheSingleInstanceLock || isSquirrelEvent)) {
  app.quit();
}

function createWindow() {
  const basePath = getBasePath();
  const preload = path.join(basePath, "preload.js");
  const window = new BrowserWindow({
    height: 600,
    titleBarStyle: process.platform === "darwin" ? "hiddenInset" : "hidden",
    // Centered in the top strip, clear of the rounded corner
    // (docs/specs/mac-traffic-lights.md).
    trafficLightPosition:
      process.platform === "darwin" ? macTrafficLightPosition() : undefined,
    webPreferences: {
      contextIsolation: true,
      devTools: inDevelopment,
      nodeIntegration: true,
      nodeIntegrationInSubFrames: false,

      preload,
    },
    width: 800,
  });
  ipcContext.setMainWindow(window);
  mainWindow = window;

  window.on("close", (event) => {
    if (isQuitting) {
      return;
    }

    /**
     * Minimize-to-tray on close is a production-only UX choice (Issue #20).
     * In development it hid the window while leaving `npm start`'s Electron
     * process (and the Vite dev server it owns) running -- a stale process
     * silently holding the single-instance lock for every future launch.
     * Closing the window in dev should be a real quit instead.
     */
    if (inDevelopment) {
      isQuitting = true;
      app.quit();
      return;
    }

    event.preventDefault();
    window.hide();
  });

  window.on("closed", () => {
    mainWindow = undefined;
  });

  if (MAIN_WINDOW_VITE_DEV_SERVER_URL) {
    window.loadURL(MAIN_WINDOW_VITE_DEV_SERVER_URL);
  } else {
    window.loadFile(
      path.join(basePath, `../renderer/${MAIN_WINDOW_VITE_NAME}/index.html`)
    );
  }

  return window;
}

function showMainWindow() {
  if (mainWindow) {
    mainWindow.show();
    mainWindow.focus();
  } else {
    createWindow();
  }
}

function createTray() {
  tray = new Tray(createPlaceholderTrayIcon());
  tray.setToolTip("Personare");
  tray.setContextMenu(
    Menu.buildFromTemplate([
      { click: showMainWindow, label: "Abrir Personare" },
      {
        click: () => {
          isQuitting = true;
          app.quit();
        },
        label: "Sair",
      },
    ])
  );
  tray.on("click", showMainWindow);
}

function notifyDueReviewsIfAny() {
  const db = getDatabaseClient();

  if (!db) {
    return;
  }

  const count = countDueReviews(db, new Date());

  if (count > 0) {
    new Notification({
      // The Today screen's unit (docs/specs/clarify-daily-count.md AC-5).
      body:
        count === 1
          ? "Você tem 1 atividade para revisar hoje"
          : `Você tem ${count} atividades para revisar hoje`,
      title: "Personare",
    }).show();
  }
}

function syncLoginItemSettingsWithSavedPreference() {
  const db = getDatabaseClient();

  if (!db) {
    return;
  }

  const { autoStartEnabled } = getOrCreateAppSettings(db);
  app.setLoginItemSettings({ openAtLogin: autoStartEnabled });
}

async function installExtensions() {
  try {
    const result = await installExtension(REACT_DEVELOPER_TOOLS);
    console.log(`Extensions installed successfully: ${result.name}`);
  } catch {
    console.error("Failed to install extensions");
  }
}

function checkForUpdates() {
  updateElectronApp({
    updateSource: {
      repo: "Personare-Education/personare-releases",
      type: UpdateSourceType.ElectronPublicUpdateService,
    },
  });
}

function setupORPC() {
  ipcMain.on(IPC_CHANNELS.START_ORPC_SERVER, async (event) => {
    const [serverPort] = event.ports;
    // Imported lazily: the router reads ipcContext.mainWindowContext at import
    // time, and the port only ever arrives from an existing window. The port
    // queues the renderer's messages until start().
    const { rpcHandler } = await import("./ipc/handler");

    serverPort.start();
    rpcHandler.upgrade(serverPort);
  });
}

function setupDatabase() {
  const dbPath = path.join(app.getPath("userData"), "personare.sqlite");
  const db = createDatabaseClient(dbPath);
  const migrationsFolder = resolveMigrationsFolder({
    isPackaged: app.isPackaged,
    resourcesPath: process.resourcesPath,
  });

  runMigrations(db, migrationsFolder);
  setDatabaseClient(db);
}

function getAuthTokenStoragePath() {
  return path.join(app.getPath("userData"), "auth-token.enc");
}

/**
 * Per Electron's own documented pattern: when launched via `electron .`
 * (dev), the real executable is the generic Electron binary, so the OS
 * must be told to also pass the app's entry script back as an argument;
 * when packaged, the app's own exe already is the thing to register.
 */
const execFileAsync = promisify(execFile);

function registerOAuthProtocolClient() {
  if (process.defaultApp) {
    if (process.argv.length >= 2) {
      app.setAsDefaultProtocolClient(OAUTH_PROTOCOL, process.execPath, [
        path.resolve(process.argv[1]),
      ]);
    }
  } else {
    app.setAsDefaultProtocolClient(OAUTH_PROTOCOL);
  }
  // An AppImage registers personare:// for itself, or the Google login's
  // callback never reaches it (docs/specs/linux-appimage-protocol.md).
  registerAppImageProtocolHandler({
    env: process.env,
    homeDir: os.homedir(),
    log: (message, error) => console.error(message, error),
    mkdir: (dir, options) => fs.mkdir(dir, options),
    platform: process.platform,
    run: (command, args) => execFileAsync(command, args),
    writeFile: (file, content) => fs.writeFile(file, content, "utf-8"),
  });
}

async function handleLoginCallback(url: string) {
  const result = parseOAuthCallback(url);

  if (!result || "error" in result) {
    showMainWindow();
    return;
  }

  const user = await fetchCurrentUser(result.token);

  if (user) {
    setAuthSession(user);
    setAuthToken(result.token);
    saveToken(getAuthTokenStoragePath(), result.token);
  }

  showMainWindow();
}

function handleCalendarConnectCallback(url: string) {
  const result = parseCalendarConnectCallback(url);

  if (result && "connected" in result) {
    setCalendarConnected(true);
  }

  showMainWindow();
}

function handleDriveConnectCallback(url: string) {
  const result = parseDriveConnectCallback(url);

  if (result && "connected" in result) {
    setDriveConnected(true);
  }

  showMainWindow();
}

/**
 * Login (Issue #25), Calendar authorization (Issue #26), and Drive
 * authorization (Issue #27) share the same registered personare:// protocol
 * but land on different hosts -- dispatch keeps each flow's handler
 * isolated rather than overloading one function with all three.
 */
function handleProtocolCallback(url: string) {
  const host = getProtocolCallbackHost(url);

  if (host === "calendar-connect-callback") {
    handleCalendarConnectCallback(url);
    return;
  }

  if (host === "drive-connect-callback") {
    handleDriveConnectCallback(url);
    return;
  }

  handleLoginCallback(url);
}

async function restoreSavedAuthSession() {
  const tokenFilePath = getAuthTokenStoragePath();
  setAuthTokenFilePath(tokenFilePath);

  const token = loadToken(tokenFilePath);

  if (!token) {
    return;
  }

  const user = await fetchCurrentUser(token);

  if (user) {
    setAuthSession(user);
    setAuthToken(token);
  }
}

if (gotTheSingleInstanceLock) {
  app.on("second-instance", (_event, argv) => {
    showMainWindow();

    const url = findOAuthCallbackUrl(argv);
    if (url) {
      handleProtocolCallback(url);
    }
  });

  // macOS delivers the personare:// URL via this event instead of argv.
  app.on("open-url", (event, url) => {
    event.preventDefault();
    handleProtocolCallback(url);
  });

  app.whenReady().then(async () => {
    try {
      const { wasOpenedAtLogin } = app.getLoginItemSettings();

      // Must run before any window exists: the renderer sends its oRPC port
      // only once, on load, and a port that arrives with no listener is
      // dropped -- leaving every IPC call (window controls, theme, CRUD) hung.
      setupORPC();
      registerOAuthProtocolClient();
      setupDatabase();
      syncLoginItemSettingsWithSavedPreference();
      await restoreSavedAuthSession();
      createTray();

      if (wasOpenedAtLogin) {
        notifyDueReviewsIfAny();
      } else {
        createWindow();
      }

      // Cold start on Windows/Linux: the OS launched this very instance
      // because of a personare:// link, there is no "second-instance" event
      // in that case since no instance was running yet.
      const initialUrl = findOAuthCallbackUrl(process.argv);
      if (initialUrl) {
        handleProtocolCallback(initialUrl);
      }

      if (inDevelopment) {
        installExtensions();
      }
      checkForUpdates();
    } catch (error) {
      console.error("Error during app initialization:", error);
    }
  });

  //osX only
  app.on("window-all-closed", () => {
    if (process.platform !== "darwin") {
      app.quit();
    }
  });

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    } else {
      showMainWindow();
    }
  });
  //osX only ends
}
