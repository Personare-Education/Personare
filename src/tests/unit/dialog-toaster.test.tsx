import { act, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import { beforeAll, describe, expect, it, vi } from "vitest";
import AppToaster from "@/components/app-toaster";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { showUndoToast } from "@/utils/undo-toast";

/**
 * docs/specs/safety-net.md AC-3a: clicking Undo while a dialog is open
 * (the question or flashcard manager) must not close that dialog.
 */
// jsdom has no pointer capture; sonner uses it for swipe-to-dismiss.
beforeAll(() => {
  Element.prototype.setPointerCapture ??= () => undefined;
  Element.prototype.releasePointerCapture ??= () => undefined;
  Element.prototype.hasPointerCapture ??= () => false;
});

function OpenDialog() {
  const [open, setOpen] = useState(true);
  return (
    <Dialog onOpenChange={setOpen} open={open}>
      <DialogContent>
        <DialogTitle>Manage questions</DialogTitle>
      </DialogContent>
    </Dialog>
  );
}

describe("DialogContent with the toaster", () => {
  it("stays open when Undo is clicked in a notice", async () => {
    const user = userEvent.setup();
    const onUndo = vi.fn();
    render(
      <>
        <OpenDialog />
        <AppToaster />
      </>
    );

    act(() => {
      showUndoToast({ message: "Question deleted", onUndo, undoLabel: "Undo" });
    });
    await user.click(await screen.findByRole("button", { name: "Undo" }));

    expect(onUndo).toHaveBeenCalledTimes(1);
    expect(
      screen.getByRole("dialog", { name: "Manage questions" })
    ).toBeInTheDocument();
  });

  it("still closes when clicking anywhere else outside", async () => {
    const user = userEvent.setup();
    render(
      <>
        <OpenDialog />
        {/* Clickable over the modal, like the toaster, but not a notice. */}
        <button style={{ pointerEvents: "auto" }} type="button">
          Elsewhere
        </button>
      </>
    );

    await user.click(
      screen.getByRole("button", { hidden: true, name: "Elsewhere" })
    );

    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });
});
