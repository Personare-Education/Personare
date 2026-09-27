/**
 * What src/preload.ts exposes to the renderer through contextBridge.
 */
interface PersonareBridge {
  /**
   * The path of a file the user dropped on the window: Electron's File no
   * longer carries `path`, only the preload's webUtils can tell it.
   */
  getPathForFile: (file: File) => string;
}

interface Window {
  personare?: PersonareBridge;
}
