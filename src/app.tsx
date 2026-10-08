import { RouterProvider } from "@tanstack/react-router";
import React, { useEffect } from "react";
import { createRoot } from "react-dom/client";
import { useTranslation } from "react-i18next";
import { updateAppLanguage } from "./actions/language";
import { applySavedTextSize } from "./actions/text-size";
import { syncWithLocalTheme } from "./actions/theme";
import AppDirection from "./components/app-direction";
import { router } from "./utils/routes";
import { installStackContentReveal } from "./utils/stack-content-reveal";
import "./localization/i18n";

export default function App() {
  const { i18n } = useTranslation();

  useEffect(() => {
    syncWithLocalTheme();
    applySavedTextSize();
    updateAppLanguage(i18n);
  }, [i18n]);

  return (
    <AppDirection>
      <RouterProvider router={router} />
    </AppDirection>
  );
}

const container = document.getElementById("app");
if (!container) {
  throw new Error('Root element with id "app" not found');
}
installStackContentReveal(document);

const root = createRoot(container);
root.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
