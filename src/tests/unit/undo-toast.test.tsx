import { act, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeAll, describe, expect, it, vi } from "vitest";
import AppToaster from "@/components/app-toaster";
import { showUndoToast } from "@/utils/undo-toast";

/**
 * docs/specs/safety-net.md AC-1: after a deletion, a short notice with an
 * Undo that runs the restore.
 */
// jsdom has no pointer capture; sonner uses it for swipe-to-dismiss.
beforeAll(() => {
  Element.prototype.setPointerCapture ??= () => undefined;
  Element.prototype.releasePointerCapture ??= () => undefined;
  Element.prototype.hasPointerCapture ??= () => false;
});

describe("showUndoToast", () => {
  it("shows what was deleted with an Undo that runs the restore", async () => {
    const user = userEvent.setup();
    const onUndo = vi.fn();
    render(<AppToaster />);

    act(() => {
      showUndoToast({ message: "Question deleted", onUndo, undoLabel: "Undo" });
    });

    expect(await screen.findByText("Question deleted")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Undo" }));
    expect(onUndo).toHaveBeenCalledTimes(1);
  });
});
