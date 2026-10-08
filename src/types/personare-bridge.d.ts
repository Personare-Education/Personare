/**
 * What src/preload.ts exposes to the renderer through contextBridge.
 */
interface PersonareBridge {
  /**
   * The path of a file the user dropped on the window: Electron's File no
   * longer carries `path`, only the preload's webUtils can tell it.
   */
  getPathForFile: (file: File) => string;
  /**
   * Called when the main process changed data outside this window (e.g. the
   * MCP bridge created a program); returns the unsubscribe.
   */
  onDataChanged?: (callback: (topic: string) => void) => () => void;
}

interface Window {
  personare?: PersonareBridge;
}
