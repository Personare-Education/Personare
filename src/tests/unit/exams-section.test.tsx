import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import i18n from "i18next";
import { beforeEach, describe, expect, it, vi } from "vitest";
import "@/localization/i18n";

const ANATOMY = /Anatomia/;
const EXAM_1 = /Prova 1/;

/**
 * RED phase (docs/specs/exams.md §2 AC-1, AC-4): the Exams section below
 * the program's modules -- its list, creating one (which goes on to its
 * standalone questions) and deleting with undo.
 */

vi.mock("@/actions/exams", () => ({
  createExam: vi.fn(),
  listEligibleExamModules: vi.fn(),
  listExams: vi.fn(),
  restoreExam: vi.fn().mockResolvedValue(undefined),
  softDeleteExam: vi.fn().mockResolvedValue(undefined),
  updateExam: vi.fn().mockResolvedValue(undefined),
}));
vi.mock("@/actions/quiz", () => ({
  createExamQuestion: vi.fn(),
  createQuizOption: vi.fn(),
  createQuizQuestion: vi.fn(),
  listExamQuestionsWithOptions: vi.fn().mockResolvedValue([]),
  listQuizQuestionsWithOptions: vi.fn().mockResolvedValue([]),
  restoreQuizQuestion: vi.fn(),
  softDeleteQuizOption: vi.fn(),
  softDeleteQuizQuestion: vi.fn(),
  updateQuizQuestion: vi.fn(),
}));
vi.mock("@/utils/undo-toast", () => ({ showUndoToast: vi.fn() }));
vi.mock("@/actions/dialog", () => ({ selectImageFile: vi.fn() }));
vi.mock("@/actions/attachments", () => ({
  deleteAttachmentImage: vi.fn(),
  getAttachmentImageDataUrl: vi.fn(),
  saveAttachmentImage: vi.fn(),
  saveAttachmentImageData: vi.fn(),
}));

const {
  createExam,
  listEligibleExamModules,
  listExams,
  restoreExam,
  softDeleteExam,
} = await import("@/actions/exams");
const { listExamQuestionsWithOptions } = await import("@/actions/quiz");
const { showUndoToast } = await import("@/utils/undo-toast");
const { default: ExamsSection } = await import("@/components/exams-section");

const EXAM = {
  bestScore: null,
  id: "e1",
  lastAttemptAt: null,
  moduleIds: ["a"],
  passed: false,
  passingScore: 70,
  questionCount: 10,
  standaloneCount: 0,
  timeLimitMinutes: null,
  title: "Prova 1",
};

function renderSection() {
  render(<ExamsSection moduleNames={{ a: "Anatomia" }} programId="p1" />);
}

describe("ExamsSection (exams.md §2)", () => {
  beforeEach(async () => {
    vi.clearAllMocks();
    await i18n.changeLanguage("pt-BR");
    vi.mocked(listEligibleExamModules).mockResolvedValue([
      { id: "a", name: "Anatomia", questionCount: 12 },
    ]);
  });

  it("has an Exams heading and, with none yet, says what an exam is (AC-1)", async () => {
    vi.mocked(listExams).mockResolvedValue([]);
    renderSection();

    expect(
      screen.getByRole("heading", { name: i18n.t("examsSectionTitle") })
    ).toBeInTheDocument();
    expect(
      await screen.findByText(i18n.t("examsEmptyMessage"))
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: i18n.t("createExamAction") })
    ).toBeInTheDocument();
  });

  it("lists the program's exams", async () => {
    vi.mocked(listExams).mockResolvedValue([EXAM]);
    renderSection();

    expect(
      await screen.findByRole("row", { name: EXAM_1 })
    ).toBeInTheDocument();
    expect(listExams).toHaveBeenCalledWith("p1");
  });

  it("saves a new exam and closes, without opening its standalone questions (AC-3)", async () => {
    const user = userEvent.setup();
    vi.mocked(listExams).mockResolvedValue([]);
    vi.mocked(createExam).mockResolvedValue({
      ...EXAM,
      title: "Final",
    } as never);
    renderSection();

    await user.click(
      await screen.findByRole("button", { name: i18n.t("createExamAction") })
    );
    const form = await screen.findByRole("dialog");
    await user.type(
      within(form).getByLabelText(i18n.t("examTitleLabel")),
      "Final"
    );
    await user.click(within(form).getByRole("checkbox", { name: ANATOMY }));
    await user.click(
      within(form).getByRole("button", { name: i18n.t("saveAction") })
    );

    await waitFor(() =>
      expect(createExam).toHaveBeenCalledWith("p1", {
        moduleIds: ["a"],
        passingScore: 70,
        questionCount: 10,
        timeLimitMinutes: null,
        title: "Final",
      })
    );
    await waitFor(() =>
      expect(screen.queryByRole("dialog")).not.toBeInTheDocument()
    );
    expect(listExamQuestionsWithOptions).not.toHaveBeenCalled();
  });

  it("on a new exam, Standalone questions saves it first, then opens them over the form (AC-4)", async () => {
    const user = userEvent.setup();
    vi.mocked(listExams).mockResolvedValue([]);
    vi.mocked(createExam).mockResolvedValue({
      ...EXAM,
      title: "Final",
    } as never);
    renderSection();

    await user.click(
      await screen.findByRole("button", { name: i18n.t("createExamAction") })
    );
    const form = await screen.findByRole("dialog");
    await user.type(
      within(form).getByLabelText(i18n.t("examTitleLabel")),
      "Final"
    );
    await user.click(within(form).getByRole("checkbox", { name: ANATOMY }));
    await user.click(
      within(form).getByRole("button", { name: i18n.t("examQuestionsAction") })
    );

    await waitFor(() => expect(createExam).toHaveBeenCalledTimes(1));
    await waitFor(() =>
      expect(listExamQuestionsWithOptions).toHaveBeenCalledWith("e1")
    );
    expect(
      await screen.findByRole("dialog", { name: "Final" })
    ).toBeInTheDocument();
  });

  it("on a saved exam, Standalone questions just opens them (AC-4)", async () => {
    const user = userEvent.setup();
    vi.mocked(listExams).mockResolvedValue([EXAM] as never);
    renderSection();

    const row = await screen.findByRole("row", { name: EXAM_1 });
    // The context menu has every action, whichever is the row's main one.
    await user.pointer({ keys: "[MouseRight]", target: row });
    await user.click(
      await screen.findByRole("menuitem", { name: i18n.t("editExamAction") })
    );
    const form = await screen.findByRole("dialog");
    await user.click(
      within(form).getByRole("button", { name: i18n.t("examQuestionsAction") })
    );

    await waitFor(() =>
      expect(listExamQuestionsWithOptions).toHaveBeenCalledWith("e1")
    );
    expect(createExam).not.toHaveBeenCalled();
  });

  it("deletes an exam with undo", async () => {
    const user = userEvent.setup();
    vi.mocked(listExams).mockResolvedValue([EXAM]);
    renderSection();

    const row = await screen.findByRole("row", { name: EXAM_1 });
    await user.click(
      within(row).getByRole("button", { name: i18n.t("moreActionsAction") })
    );
    await user.click(
      screen.getByRole("menuitem", { name: i18n.t("deleteExamAction") })
    );

    await waitFor(() => expect(softDeleteExam).toHaveBeenCalledWith("e1"));
    const [[toast]] = vi.mocked(showUndoToast).mock.calls;
    toast.onUndo();
    expect(restoreExam).toHaveBeenCalledWith("e1");
  });
});
