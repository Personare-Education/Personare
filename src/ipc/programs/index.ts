import { create, list, restore, softDelete, update } from "./handlers";
import {
  importFromMarkdown,
  previewImport,
  undoImport,
} from "./import-handlers";

export const programs = {
  create,
  import: importFromMarkdown,
  list,
  previewImport,
  restore,
  softDelete,
  undoImport,
  update,
};
