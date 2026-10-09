import type { ErrorLog } from "@/main/error-log";

let errorLog: ErrorLog | undefined;

export function setErrorLog(log: ErrorLog) {
  errorLog = log;
}

export function getErrorLog() {
  return errorLog;
}
