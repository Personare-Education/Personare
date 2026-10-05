import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import i18n from "i18next";
import { beforeEach, describe, expect, it, vi } from "vitest";
import "@/localization/i18n";

vi.mock("@/actions/activities", () => ({
  completeActivity: vi.fn().mockResolvedValue(undefined),
  listActivities: vi.fn(),
}));
vi.mock("@/actions/review", () => ({
  listLocks: vi.fn(),
  previewActivityRatings: vi.fn().mockResolvedValue({}),
}));
vi.mock("@/actions/shell", () => ({
  openActivityFile: vi.fn().mockResolvedValue({ errorMessage: "" }),
  openExternalLink: vi.fn().mockResolvedValue(undefined),
}));
// The real runner loads questions over IPC; this stand-in finishes the
// quiz the way a step's runner reports it.
vi.mock("@/components/quiz-runner-dialog", () => ({
  default: ({
    activity,
    asStep,
    onFinished,
    open,
  }: {
    activity: { id: string } | null;
    asStep?: boolean;
    onFinished: (activity: { id: string }) => void;
    open: boolean;
  }) =>
    open && activity ? (
      // biome-ignore lint/performance/noJsxPropsBind: a test stand-in.
      <button onClick={() => onFinished(activity)} type="button">
        {asStep ? "quiz-step-continue" : "quiz-rated"}
      </button>
    ) : null,
}));

const { completeActivity, listActivities } = await import(
  "@/actions/activities"
);
const { listLocks } = await import("@/actions/review");
const { openActivityFile, openExternalLink } = await import("@/actions/shell");
const { default: SequenceRunner } = await import(
  "@/components/sequence-runner"
);

/**
 * RED phase (docs/specs/sequences-and-locks.md §5 AC-2..5): doing a
 * sequence, step by step, then rating it once.
 */

function step(id: string, type: string, extra: Record<string, unknown> = {}) {
  return {
    createdAt: new Date(),
    filePath: type === "pdf" ? "C:/capitulo.pdf" : null,
    id,
    moduleId: "m1",
    title: `Etapa ${id}`,
    type,
    updatedAt: new Date(),
    url: type === "link" ? "https://example.com/aula" : null,
    ...extra,
  };
}

const GROUP = { id: "group", moduleId: "m1", title: "Revisão" };

function renderRunner() {
  const onRate = vi.fn();
  render(
    <SequenceRunner
      group={GROUP}
      isSaving={false}
      onRate={onRate}
      saveFailed={false}
    />
  );
  return { onRate };
}

function button(name: string) {
  return screen.getByRole("button", { name });
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(listActivities).mockResolvedValue([
    step("pdf", "pdf"),
    step("video", "link"),
    step("quiz", "quiz"),
  ] as never);
  vi.mocked(listLocks).mockResolvedValue({ activities: {}, modules: {} });
});

describe("SequenceRunner", () => {
  it("walks the steps in order, each opened then concluded, and ends on one rating", async () => {
    const user = userEvent.setup();
    const { onRate } = renderRunner();

    expect(
      await screen.findByText(
        i18n.t("sequenceStepProgress", { current: 1, total: 3 })
      )
    ).toBeInTheDocument();
    await user.click(button(i18n.t("todayOpenPdfAction")));
    expect(openActivityFile).toHaveBeenCalledWith("C:/capitulo.pdf");
    await user.click(button(i18n.t("concludeStepAction")));
    expect(completeActivity).toHaveBeenCalledWith("pdf");

    await screen.findByText("Etapa video");
    await user.click(button(i18n.t("todayOpenLinkAction")));
    expect(openExternalLink).toHaveBeenCalledWith("https://example.com/aula");
    await user.click(button(i18n.t("concludeStepAction")));

    await screen.findByText("Etapa quiz");
    await user.click(button(i18n.t("takeQuizAction")));
    // A quiz inside a sequence is not rated on its own (AC-3).
    await user.click(button("quiz-step-continue"));
    expect(completeActivity).toHaveBeenCalledWith("quiz");

    expect(
      await screen.findByText(i18n.t("sequenceRatePrompt"))
    ).toBeInTheDocument();
    await user.click(button(i18n.t("activityRatingGoodAction")));
    expect(onRate).toHaveBeenCalledWith("good");
  });

  it("lets a locked step be skipped, without concluding it", async () => {
    const user = userEvent.setup();
    vi.mocked(listLocks).mockResolvedValue({
      activities: {
        pdf: { locked: true, missing: [{ id: "elsewhere", kind: "activity" }] },
      },
      modules: {},
    });
    renderRunner();

    await screen.findByText("Etapa pdf");
    expect(
      screen.getByRole("img", { name: i18n.t("lockedLabel") })
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: i18n.t("todayOpenPdfAction") })
    ).not.toBeInTheDocument();

    await user.click(button(i18n.t("skipStepAction")));

    expect(await screen.findByText("Etapa video")).toBeInTheDocument();
    expect(completeActivity).not.toHaveBeenCalled();
  });
});
