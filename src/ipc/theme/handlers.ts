import { os } from "@orpc/server";
import { nativeTheme } from "electron";
import { setThemeModeInputSchema } from "./schemas";

export const getCurrentThemeMode = os.handler(() => nativeTheme.themeSource);

export const toggleThemeMode = os.handler(() => {
  if (nativeTheme.shouldUseDarkColors) {
    nativeTheme.themeSource = "light";
  } else {
    nativeTheme.themeSource = "dark";
  }

  return nativeTheme.shouldUseDarkColors;
});

export const setThemeMode = os
  .input(setThemeModeInputSchema)
  .handler(({ input }) => {
    switch (input as "light" | "dark" | "system") {
      case "light":
        nativeTheme.themeSource = "light";
        break;
      case "dark":
        nativeTheme.themeSource = "dark";
        break;
      case "system":
        nativeTheme.themeSource = "system";
        break;
      default:
        nativeTheme.themeSource = "system";
        break;
    }

    // Whether the app is dark now: with "system" only the main process
    // knows (docs/specs/audit-a11y-leftovers.md AC-4b).
    return nativeTheme.shouldUseDarkColors;
  });
