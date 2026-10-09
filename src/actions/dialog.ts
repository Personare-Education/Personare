import { ipc } from "@/ipc/manager";

export function selectPdfFile() {
  return ipc.client.dialog.selectPdfFile();
}

export function selectImageFile() {
  return ipc.client.dialog.selectImageFile();
}

export function selectBackupExportPath() {
  return ipc.client.dialog.selectBackupExportPath();
}

export function selectBackupImportFile() {
  return ipc.client.dialog.selectBackupImportFile();
}

export function selectAccountExportPath() {
  return ipc.client.dialog.selectAccountExportPath();
}

export function selectErrorLogExportPath() {
  return ipc.client.dialog.selectErrorLogExportPath();
}
