import { Toaster } from "sonner";

/**
 * Where the app's notices appear (docs/specs/safety-net.md), styled from
 * the theme's tokens so it follows light and dark on its own.
 */
export default function AppToaster() {
  return (
    <Toaster
      position="bottom-right"
      // A modal dialog turns pointer events off on the page; an Undo shown
      // over one must still be clickable (docs/specs/safety-net.md AC-1).
      style={{ pointerEvents: "auto" }}
      toastOptions={{
        classNames: {
          actionButton:
            "!bg-primary !text-primary-foreground !font-medium !rounded-md",
          toast:
            "!bg-popover !text-popover-foreground !border-border !shadow-lg !font-sans",
        },
      }}
    />
  );
}
