import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import i18n from "i18next";
import { describe, expect, it, vi } from "vitest";
import FlipCard from "@/components/flip-card";
import "@/localization/i18n";

/**
 * docs/specs/flashcard-editor-and-creation-flow.md AC-6/AC-11: the card
 * shared by the flashcard editor and the review session -- it flips around
 * its vertical axis and wears its program's color.
 */

const PROGRAM_COLOR = "#8b5cf6";

function renderCard(flipped: boolean, onFlip = vi.fn()) {
  render(
    <FlipCard
      back="Verso"
      backLabel="Back"
      color={PROGRAM_COLOR}
      flipped={flipped}
      front="Frente"
      frontLabel="Front"
      onFlip={onFlip}
    />
  );
  return {
    card: screen.getByRole("button", { name: i18n.t("flipFlashcardAction") }),
    onFlip,
  };
}

function face(card: HTMLElement, name: "back" | "front") {
  return card.querySelector(`[data-face="${name}"]`) as HTMLElement;
}

describe("FlipCard", () => {
  it("shows the front and hides the back when not flipped", () => {
    const { card } = renderCard(false);

    expect(card).toHaveAttribute("aria-pressed", "false");
    expect(face(card, "front")).toHaveAttribute("aria-hidden", "false");
    expect(face(card, "back")).toHaveAttribute("aria-hidden", "true");
  });

  it("shows the back and hides the front when flipped", () => {
    const { card } = renderCard(true);

    expect(card).toHaveAttribute("aria-pressed", "true");
    expect(face(card, "back")).toHaveAttribute("aria-hidden", "false");
    expect(face(card, "front")).toHaveAttribute("aria-hidden", "true");
  });

  it("asks to flip on click and on Enter or Space", async () => {
    const user = userEvent.setup();
    const { card, onFlip } = renderCard(false);

    await user.click(card);
    card.focus();
    await user.keyboard("{Enter}");
    await user.keyboard(" ");

    expect(onFlip).toHaveBeenCalledTimes(3);
  });

  it("tints both faces with the program's color", () => {
    const { card } = renderCard(false);

    for (const name of ["front", "back"] as const) {
      expect(face(card, name).style.backgroundImage).toContain(PROGRAM_COLOR);
    }
  });
});
