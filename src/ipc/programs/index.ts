import {
  create,
  list,
  restore,
  setStudyGoal,
  softDelete,
  update,
} from "./handlers";
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
  setStudyGoal,
  softDelete,
  undoImport,
  update,
};
