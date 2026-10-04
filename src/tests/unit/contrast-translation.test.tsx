import { render, screen } from "@testing-library/react";
import i18n from "i18next";
import { afterEach, describe, expect, it, vi } from "vitest";
import "@/localization/i18n";
import FlashcardFormDialog from "@/components/flashcard-form-dialog";
import KeyHint from "@/components/key-hint";
import TodayItemCard from "@/components/today-item-card";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import type { TodayItem } from "@/utils/today-queue";

vi.mock("@/actions/dialog", () => ({
  selectImageFile: vi.fn(),
}));
vi.mock("@/actions/attachments", () => ({
  deleteAttachmentImage: vi.fn(),
  getAttachmentImageDataUrl: vi.fn(),
  saveAttachmentImage: vi.fn(),
  saveAttachmentImageData: vi.fn(),
}));

/**
 * RED phase (docs/specs/contrast-translation.md): small text that fell
 * below 4.5:1, and a close button that only spoke English.
 */

const OPACITY = /(?:^|\s)opacity-(\d+)(?:\s|$)/;

afterEach(async () => {
  await i18n.changeLanguage("en");
});

describe("contrast and translation", () => {
  it("keeps the key hint at 90% opacity or more (AC-1)", () => {
    render(<KeyHint>3</KeyHint>);

    const match = screen.getByText("3").className.match(OPACITY);
    expect(Number(match?.[1] ?? 100)).toBeGreaterThanOrEqual(90);
  });

  it("writes 'Still empty' in the foreground at 75% (AC-2)", () => {
    render(
      <FlashcardFormDialog
        flashcard={null}
        onOpenChange={vi.fn()}
        onSubmit={vi.fn()}
        open
      />
    );

    const [empty] = screen.getAllByText(i18n.t("flashcardFaceEmptyMessage"));
    expect(empty).toHaveClass("text-foreground/75");
    expect(empty).not.toHaveClass("text-muted-foreground");
  });

  it("writes the overdue chip in the readable red (AC-3)", () => {
    const item: TodayItem = {
      activityFilePath: null,
      activityId: "a1",
      activityTitle: "Derivadas",
      activityType: "pdf",
      activityUrl: null,
      cardCount: 0,
      moduleId: "m1",
      moduleName: "Cálculo",
      overdueDays: 2,
      programColor: null,
      programId: "p1",
      programName: "Engenharia",
      urgency: "overdue",
    };
    render(<TodayItemCard item={item} />);

    const chip = screen.getByText(i18n.t("todayUrgencyOverdue", { count: 2 }));
    expect(chip).toHaveClass("text-destructive-text");
    expect(chip).not.toHaveClass("text-destructive");
  });

  it("names the close button in the app's language (AC-5)", async () => {
    await i18n.changeLanguage("pt-BR");
    render(
      <Dialog open>
        <DialogContent>
          <DialogTitle>Título</DialogTitle>
        </DialogContent>
      </Dialog>
    );

    expect(screen.getByRole("button", { name: "Fechar" })).toBeInTheDocument();
  });
});
