import { ipc } from "@/ipc/manager";

export function exportErrorLog(filePath: string) {
  return ipc.client.errorLog.exportErrorLog({ filePath });
}

function describe(reason: unknown): { message: string; stack?: string } {
  if (reason instanceof Error) {
    return { message: reason.message, stack: reason.stack };
  }
  return { message: String(reason) };
}

/**
 * Sends what the window can't handle to the local error log
 * (docs/specs/error-log.md AC-1). A failed send is dropped: reporting an
 * error must never raise another one.
 */
export function reportWindowErrors(target: Window) {
  const send = (reason: unknown) => {
    ipc.client.errorLog
      .recordRendererError(describe(reason))
      .catch(() => undefined);
  };
  target.addEventListener("error", (event) => {
    send(event.error ?? event.message);
  });
  target.addEventListener("unhandledrejection", (event) => {
    send(event.reason);
  });
}
