import os from "node:os";
import { os as orpc } from "@orpc/server";
import {
  exportErrorLogInputSchema,
  recordRendererErrorInputSchema,
} from "./schemas";
import { getErrorLog } from "./state";

/** An error the window caught (docs/specs/error-log.md AC-1). */
export const recordRendererError = orpc
  .input(recordRendererErrorInputSchema)
  .handler(({ input }) => {
    getErrorLog()?.record("renderer", input);
  });

/**
 * Settings → Diagnostics (AC-5): false when there is nothing to export,
 * so no empty file is created.
 */
export const exportErrorLog = orpc
  .input(exportErrorLogInputSchema)
  .handler(({ input }) => {
    const log = getErrorLog();
    if (!log) {
      return { exported: false };
    }
    const system = `${process.platform} ${process.arch} (${os.release()})`;
    return { exported: log.exportTo(input.filePath, system) };
  });
