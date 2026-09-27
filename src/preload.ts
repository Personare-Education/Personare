import { contextBridge, ipcRenderer, webUtils } from "electron";
import { IPC_CHANNELS } from "./constants";

window.addEventListener("message", (event) => {
  if (event.data === IPC_CHANNELS.START_ORPC_SERVER) {
    const [serverPort] = event.ports;

    ipcRenderer.postMessage(IPC_CHANNELS.START_ORPC_SERVER, null, [serverPort]);
  }
});

// A dropped PDF is stored by its path (docs/specs/pdf-activity-dropzone.md),
// which only webUtils can read off a File since Electron 32.
contextBridge.exposeInMainWorld("personare", {
  getPathForFile: (file: File) => webUtils.getPathForFile(file),
});
