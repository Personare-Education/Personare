import { beforeEach, expect, test, vi } from "vitest";

/*
 * Regressao: no app instalado a janela nao fechava/minimizava, o tema nao
 * trocava e nenhum CRUD funcionava. O renderer envia a MessagePort do oRPC
 * uma unica vez ao carregar (src/ipc/manager.ts), mas o main so registrava o
 * listener de START_ORPC_SERVER no fim do boot, depois de `await
 * installExtensions()` (download do React DevTools, que tambem rodava em
 * producao). A porta chegava sem listener, era descartada e todo IPC ficava
 * pendente para sempre.
 */

const events: string[] = [];

const { readyCallbacks } = vi.hoisted(() => ({
  readyCallbacks: [] as (() => void)[],
}));

vi.mock("electron", () => {
  class BrowserWindow {
    constructor() {
      events.push("window");
    }
    static getAllWindows() {
      return [];
    }
    loadFile() {
      return Promise.resolve();
    }
    loadURL() {
      return Promise.resolve();
    }
    on() {
      return this;
    }
  }
  class Tray {
    on() {
      return this;
    }
    setContextMenu() {
      return this;
    }
    setToolTip() {
      return this;
    }
  }
  return {
    app: {
      getLoginItemSettings: () => ({ wasOpenedAtLogin: false }),
      getPath: () => "/tmp",
      getVersion: () => "0.0.0",
      isPackaged: true,
      on: vi.fn(),
      quit: vi.fn(),
      requestSingleInstanceLock: () => true,
      setAsDefaultProtocolClient: vi.fn(),
      setLoginItemSettings: vi.fn(),
      whenReady: () =>
        new Promise<void>((resolve) => readyCallbacks.push(resolve)),
    },
    BrowserWindow,
    ipcMain: {
      on: (channel: string) => events.push(`listen:${channel}`),
    },
    Menu: { buildFromTemplate: vi.fn() },
    Notification: vi.fn(),
    Tray,
  };
});

vi.mock("electron-devtools-installer", () => ({
  installExtension: () => {
    events.push("install-extensions");
    // Simulates the Chrome Web Store download that never finishes.
    return new Promise(() => undefined);
  },
  REACT_DEVELOPER_TOOLS: "react-devtools",
}));

vi.mock("update-electron-app", () => ({
  UpdateSourceType: { ElectronPublicUpdateService: 1 },
  updateElectronApp: vi.fn(),
}));

vi.mock("@/database/client", () => ({ createDatabaseClient: vi.fn() }));
vi.mock("@/database/migrate", () => ({
  resolveMigrationsFolder: vi.fn(),
  runMigrations: vi.fn(),
}));
vi.mock("@/ipc/database/state", () => ({
  getDatabaseClient: () => undefined,
  setDatabaseClient: vi.fn(),
}));
vi.mock("@/ipc/handler", () => ({ rpcHandler: { upgrade: vi.fn() } }));
vi.mock("@/main/auth-token-storage", () => ({
  loadToken: () => null,
  saveToken: vi.fn(),
}));
vi.mock("@/main/tray-icon", () => ({ createPlaceholderTrayIcon: vi.fn() }));

beforeEach(() => {
  events.length = 0;
  vi.stubGlobal("MAIN_WINDOW_VITE_DEV_SERVER_URL", undefined);
  vi.stubGlobal("MAIN_WINDOW_VITE_NAME", "main_window");
});

async function bootApp() {
  await import("../../main");
  for (const resolve of readyCallbacks) {
    resolve();
  }
  // Let the whenReady chain run as far as it can.
  await new Promise((resolve) => setTimeout(resolve, 50));
}

test("registers the oRPC handshake listener before the window can send its port", async () => {
  await bootApp();

  const listenIndex = events.indexOf("listen:start-orpc-server");
  expect(listenIndex).toBeGreaterThanOrEqual(0);
  expect(listenIndex).toBeLessThan(events.indexOf("window"));
  expect(events).not.toContain("install-extensions");
});
