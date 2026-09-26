import { expect, test, vi } from "vitest";

/*
 * O Setup.exe (Squirrel.Windows) abre o app com --squirrel-install/-updated/
 * -uninstall esperando que ele crie/remova os atalhos e feche. Sem tratar isso,
 * nenhum atalho era criado e o usuario precisava rodar o Setup de novo para
 * abrir o Personare. electron-squirrel-startup faz o trabalho e fecha o app;
 * o main nao pode inicializar mais nada nesse caso.
 */

const { app } = vi.hoisted(() => ({
  app: {
    on: vi.fn(),
    quit: vi.fn(),
    requestSingleInstanceLock: vi.fn(() => true),
    whenReady: vi.fn(() => new Promise(() => undefined)),
  },
}));

vi.mock("electron-squirrel-startup", () => ({ default: true }));
vi.mock("electron", () => ({
  app,
  BrowserWindow: vi.fn(),
  ipcMain: { on: vi.fn() },
  Menu: {},
  Notification: vi.fn(),
  Tray: vi.fn(),
}));
vi.mock("electron-devtools-installer", () => ({
  installExtension: vi.fn(),
  REACT_DEVELOPER_TOOLS: "react-devtools",
}));
vi.mock("update-electron-app", () => ({
  UpdateSourceType: {},
  updateElectronApp: vi.fn(),
}));

test("does not start the app while Squirrel is installing, updating or uninstalling", async () => {
  await import("../../main");

  expect(app.requestSingleInstanceLock).not.toHaveBeenCalled();
  expect(app.whenReady).not.toHaveBeenCalled();
  // electron-squirrel-startup quits by itself once Update.exe is done.
  expect(app.quit).not.toHaveBeenCalled();
});
