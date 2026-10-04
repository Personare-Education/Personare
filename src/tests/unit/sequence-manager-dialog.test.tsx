import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import i18n from "i18next";
import { beforeEach, describe, expect, it, vi } from "vitest";
import "@/localization/i18n";
import type { Activity } from "@/components/activities-data-table";

vi.mock("@/actions/activities", () => ({
  createActivity: vi.fn(),
  listActivities: vi.fn(),
  reorderActivities: vi.fn().mockResolvedValue(undefined),
  restoreActivity: vi.fn().mockResolvedValue(undefined),
  setActivityUnlockRule: vi.fn().mockResolvedValue(undefined),
  softDeleteActivity: vi.fn().mockResolvedValue(undefined),
  updateActivity: vi.fn().mockResolvedValue({}),
}));
vi.mock("@/actions/quiz", () => ({
  createQuizWithQuestions: vi.fn().mockResolvedValue({}),
}));
vi.mock("@/actions/dialog", () => ({ selectPdfFile: vi.fn() }));

const {
  createActivity,
  listActivities,
  reorderActivities,
  setActivityUnlockRule,
  softDeleteActivity,
} = await import("@/actions/activities");
const { default: SequenceManagerDialog } = await import(
  "@/components/sequence-manager-dialog"
);

/**
 * RED phase (docs/specs/sequences-and-locks.md §3 AC-2): a sequence's
 * activities, in order, to add, move, edit and remove.
 */

function activity(overrides: Partial<Activity> & { id: string }): Activity {
  return {
    createdAt: new Date("2026-10-01"),
    filePath: null,
    moduleId: "m1",
    title: overrides.id,
    type: "pdf",
    updatedAt: new Date("2026-10-01"),
    url: null,
    ...overrides,
  };
}

const GROUP = activity({
  id: "group",
  title: "Revisão de anatomia",
  type: "group",
});
const STEPS = [
  activity({ id: "pdf", title: "Capítulo 3", type: "pdf" }),
  activity({ id: "video", title: "Videoaula", type: "link" }),
  activity({ id: "quiz", title: "Quiz final", type: "quiz" }),
];

function renderManager() {
  const onManageQuiz = vi.fn();
  const onChanged = vi.fn();
  render(
    <SequenceManagerDialog
      group={GROUP}
      onChanged={onChanged}
      onManageQuiz={onManageQuiz}
      onOpenChange={vi.fn()}
      open
    />
  );
  return { onChanged, onManageQuiz };
}

function stepTitles() {
  return within(screen.getByRole("list", { name: GROUP.title }))
    .getAllByRole("listitem")
    .map((item) => item.querySelector("[data-slot='step-title']")?.textContent);
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(listActivities).mockResolvedValue(STEPS as never);
});

describe("SequenceManagerDialog", () => {
  it("lists the sequence's activities in order", async () => {
    renderManager();

    await screen.findByText("Capítulo 3");
    expect(listActivities).toHaveBeenCalledWith("m1", "group");
    expect(stepTitles()).toEqual(["Capítulo 3", "Videoaula", "Quiz final"]);
  });

  it("moves an activity down, and the first one cannot go up", async () => {
    const user = userEvent.setup();
    renderManager();
    await screen.findByText("Capítulo 3");

    expect(
      screen.getAllByRole("button", { name: i18n.t("moveUpAction") })[0]
    ).toBeDisabled();
    await user.click(
      screen.getAllByRole("button", { name: i18n.t("moveDownAction") })[0]
    );

    expect(reorderActivities).toHaveBeenCalledWith("m1", "group", [
      "video",
      "pdf",
      "quiz",
    ]);
    expect(stepTitles()).toEqual(["Videoaula", "Capítulo 3", "Quiz final"]);
  });

  it("adds an activity at the end of the sequence", async () => {
    const user = userEvent.setup();
    vi.mocked(createActivity).mockResolvedValue(
      activity({ id: "new", title: "Resumo", type: "link" }) as never
    );
    renderManager();
    await screen.findByText("Capítulo 3");

    await user.click(
      screen.getByRole("button", { name: i18n.t("addSequenceStepAction") })
    );
    const form = await screen.findByRole("dialog", {
      name: i18n.t("createActivityTitle"),
    });
    expect(
      within(form).queryByRole("radio", {
        name: i18n.t("activityTypeFlashcardDeck"),
      })
    ).not.toBeInTheDocument();
    await user.type(
      within(form).getByLabelText(i18n.t("activityTitleLabel")),
      "Resumo"
    );
    await user.click(
      within(form).getByRole("button", { name: i18n.t("saveAction") })
    );

    expect(createActivity).toHaveBeenCalledWith(
      "m1",
      "Resumo",
      "link",
      "",
      null,
      "group"
    );
  });

  it("opens a quiz's questions from the sequence", async () => {
    const user = userEvent.setup();
    const { onManageQuiz } = renderManager();
    await screen.findByText("Quiz final");

    await user.click(
      screen.getByRole("button", {
        name: i18n.t("manageQuizQuestionsAction"),
      })
    );

    expect(onManageQuiz).toHaveBeenCalledWith(STEPS[2], false);
  });

  it("removes an activity from the sequence", async () => {
    const user = userEvent.setup();
    renderManager();
    await screen.findByText("Capítulo 3");

    await user.click(
      screen.getAllByRole("button", { name: i18n.t("deleteActivityAction") })[1]
    );
    await user.click(
      within(await screen.findByRole("alertdialog")).getByRole("button", {
        name: i18n.t("confirmDeleteAction"),
      })
    );

    await waitFor(() =>
      expect(softDeleteActivity).toHaveBeenCalledWith("video")
    );
  });

  it("says what fits in an empty sequence", async () => {
    vi.mocked(listActivities).mockResolvedValue([]);
    renderManager();

    expect(
      await screen.findByText(i18n.t("sequenceEmptyMessage"))
    ).toBeInTheDocument();
  });
});

/** docs/specs/sequences-and-locks.md §4 AC-4 */
describe("SequenceManagerDialog order mode and locks", () => {
  it("locks the sequence in order, the first one staying free", async () => {
    const user = userEvent.setup();
    render(
      <SequenceManagerDialog
        group={GROUP}
        onManageQuiz={vi.fn()}
        onOpenChange={vi.fn()}
        open
      />
    );
    await screen.findByText("Capítulo 3");

    await user.click(
      screen.getByRole("radio", { name: i18n.t("sequenceModeLock") })
    );

    expect(setActivityUnlockRule).toHaveBeenCalledWith("pdf", "none", []);
    expect(setActivityUnlockRule).toHaveBeenCalledWith("video", "previous", []);
    expect(setActivityUnlockRule).toHaveBeenCalledWith("quiz", "previous", []);
  });

  it("shows a step's padlock and opens its rule", async () => {
    const user = userEvent.setup();
    const onUnlockRule = vi.fn();
    render(
      <SequenceManagerDialog
        group={GROUP}
        lockLabelById={{ quiz: "Unlocks after Videoaula" }}
        onManageQuiz={vi.fn()}
        onOpenChange={vi.fn()}
        onUnlockRule={onUnlockRule}
        open
      />
    );
    await screen.findByText("Quiz final");

    expect(screen.getByText("Unlocks after Videoaula")).toBeInTheDocument();
    await user.click(
      screen.getAllByRole("button", { name: i18n.t("unlockRuleAction") })[2]
    );
    expect(onUnlockRule).toHaveBeenCalledWith(STEPS[2]);
  });
});
