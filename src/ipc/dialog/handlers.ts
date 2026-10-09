import { os } from "@orpc/server";
import { dialog as electronDialog } from "electron";

const BACKUP_FILTERS = [
  { extensions: ["personare-backup"], name: "Personare Backup" },
];

export const selectPdfFile = os.handler(async () => {
  const { canceled, filePaths } = await electronDialog.showOpenDialog({
    filters: [{ extensions: ["pdf"], name: "PDF" }],
    properties: ["openFile"],
  });

  if (canceled || filePaths.length === 0) {
    return null;
  }

  return filePaths[0];
});

export const selectImageFile = os.handler(async () => {
  const { canceled, filePaths } = await electronDialog.showOpenDialog({
    filters: [
      { extensions: ["png", "jpg", "jpeg", "gif", "webp"], name: "Image" },
    ],
    properties: ["openFile"],
  });

  if (canceled || filePaths.length === 0) {
    return null;
  }

  return filePaths[0];
});

export const selectBackupExportPath = os.handler(async () => {
  const { canceled, filePath } = await electronDialog.showSaveDialog({
    defaultPath: `personare-backup-${new Date().toISOString().slice(0, 10)}.personare-backup`,
    filters: BACKUP_FILTERS,
  });

  if (canceled || !filePath) {
    return null;
  }

  return filePath;
});

export const selectBackupImportFile = os.handler(async () => {
  const { canceled, filePaths } = await electronDialog.showOpenDialog({
    filters: BACKUP_FILTERS,
    properties: ["openFile"],
  });

  if (canceled || filePaths.length === 0) {
    return null;
  }

  return filePaths[0];
});

export const selectAccountExportPath = os.handler(async () => {
  const { canceled, filePath } = await electronDialog.showSaveDialog({
    defaultPath: `personare-account-${new Date().toISOString().slice(0, 10)}.json`,
    filters: [{ extensions: ["json"], name: "JSON" }],
  });

  if (canceled || !filePath) {
    return null;
  }

  return filePath;
});

export const selectErrorLogExportPath = os.handler(async () => {
  const { canceled, filePath } = await electronDialog.showSaveDialog({
    defaultPath: `personare-errors-${new Date().toISOString().slice(0, 10)}.txt`,
    filters: [{ extensions: ["txt"], name: "Text" }],
  });

  if (canceled || !filePath) {
    return null;
  }

  return filePath;
});
