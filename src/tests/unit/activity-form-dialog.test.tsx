import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import i18n from "i18next";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { selectPdfFile } from "@/actions/dialog";
import type { Activity } from "@/components/activities-data-table";
import ActivityFormDialog from "@/components/activity-form-dialog";
import "@/localization/i18n";

vi.mock("@/actions/dialog", () => ({
  selectPdfFile: vi.fn(),
}));

/**
 * RED phase (Issue #12, Spec Driven TDD): ActivityFormDialog does not yet
 * render a URL field, nor pass a "url" value to onSubmit. Every test below
 * is expected to fail until Bancada (Developer) extends the component.
 *
 * Contract exercised here:
 * - criterio de aceite 2: a URL field (labeled via the "activityUrlLabel"
 *   i18n key) is rendered ONLY when the selected/current type is "link".
 * - criterio de aceite 3: creating/editing a Link activity submits the
 *   typed url alongside title and type; non-Link activities submit a null
 *   url regardless of what the field would otherwise contain, since the
 *   field isn't rendered for them.
 * - criterio de aceite 5: no hardcoded UI text -- the label is read
 *   through i18n.t, only the key name is asserted.
 *
 * ActivityFormDialog defaults a brand-new activity's type to the first
 * MVP_ACTIVITY_TYPES entry, which is "link" -- so creating (activity=null)
 * exercises the "type is link" branch by default, and editing an existing
 * non-link activity exercises the "type is not link" branch without any
 * Select interaction (Radix Select pointer-capture APIs are unreliable
 * under jsdom, so type-switching is driven through the `activity` prop
 * instead of simulating a Select interaction).
 */

const LINK_ACTIVITY: Activity = {
  createdAt: new Date("2026-01-01"),
  filePath: null,
  id: "11111111-1111-1111-1111-111111111111",
  moduleId: "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa",
  title: "Aula introdutoria",
  type: "link",
  updatedAt: new Date("2026-01-01"),
  url: "https://example.com/aula-introdutoria",
};

const QUIZ_ACTIVITY: Activity = {
  createdAt: new Date("2026-01-02"),
  filePath: null,
  id: "22222222-2222-2222-2222-222222222222",
  moduleId: "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa",
  title: "Quiz de fixacao",
  type: "quiz",
  updatedAt: new Date("2026-01-02"),
  url: null,
};

const PDF_ACTIVITY: Activity = {
  createdAt: new Date("2026-01-03"),
  filePath: "C:\\Users\\aluno\\Documents\\apostila.pdf",
  id: "33333333-3333-3333-3333-333333333333",
  moduleId: "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa",
  title: "Apostila em PDF",
  type: "pdf",
  updatedAt: new Date("2026-01-03"),
  url: null,
};

function renderDialog(activity: Activity | null = null) {
  const onOpenChange = vi.fn();
  const onSubmit = vi.fn();

  render(
    <ActivityFormDialog
      activity={activity}
      onOpenChange={onOpenChange}
      onSubmit={onSubmit}
      open={true}
    />
  );

  return { onOpenChange, onSubmit };
}

describe("ActivityFormDialog", () => {
  it("renders a URL field when creating a new activity, which defaults to type link", () => {
    renderDialog(null);

    expect(
      screen.getByLabelText(i18n.t("activityUrlLabel"))
    ).toBeInTheDocument();
  });

  it("renders a URL field, pre-filled with the current value, when editing a Link activity", () => {
    renderDialog(LINK_ACTIVITY);

    expect(screen.getByLabelText(i18n.t("activityUrlLabel"))).toHaveValue(
      LINK_ACTIVITY.url
    );
  });

  it("does not render a URL field when editing an activity whose type is not link", () => {
    renderDialog(QUIZ_ACTIVITY);

    expect(
      screen.queryByLabelText(i18n.t("activityUrlLabel"))
    ).not.toBeInTheDocument();
  });

  it("renders the URL field as an input of type url, for basic format validation", () => {
    renderDialog(LINK_ACTIVITY);

    expect(screen.getByLabelText(i18n.t("activityUrlLabel"))).toHaveAttribute(
      "type",
      "url"
    );
  });

  it("submits the typed url when creating a Link activity", async () => {
    const user = userEvent.setup();
    const { onSubmit } = renderDialog(null);

    await user.type(
      screen.getByLabelText(i18n.t("activityTitleLabel")),
      "Aula 1"
    );
    await user.type(
      screen.getByLabelText(i18n.t("activityUrlLabel")),
      "https://example.com/aula-1"
    );
    await user.click(
      screen.getByRole("button", { name: i18n.t("saveAction") })
    );

    expect(onSubmit).toHaveBeenCalledWith(
      "Aula 1",
      "link",
      "https://example.com/aula-1",
      null
    );
  });

  it("submits a null url when submitting an activity whose type is not link", async () => {
    const user = userEvent.setup();
    const { onSubmit } = renderDialog(QUIZ_ACTIVITY);

    await user.click(
      screen.getByRole("button", { name: i18n.t("saveAction") })
    );

    expect(onSubmit).toHaveBeenCalledWith(
      QUIZ_ACTIVITY.title,
      "quiz",
      null,
      null
    );
  });
});

/**
 * RED phase (Issue #13, Spec Driven TDD): ActivityFormDialog does not yet
 * render a "select PDF file" button, nor pass a "filePath" value to
 * onSubmit. Every test below is expected to fail until Serralheria
 * (Developer) extends the component.
 *
 * Contract exercised here:
 * - criterio de aceite 2: a "select file" button (labeled via the
 *   "selectPdfFileAction" i18n key) is rendered ONLY when the current type
 *   is "pdf" -- Electron's native file picker cannot be simulated under
 *   jsdom, so this suite drives type-switching through the `activity` prop
 *   (like the Link suite above), and mocks src/actions/dialog's
 *   selectPdfFile so the component's call to it can be asserted without
 *   touching Electron.
 * - criterio de aceite 2: the chosen path is stored and shown (rendered as
 *   text) once selectPdfFile resolves with a path; a canceled dialog
 *   (selectPdfFile resolving null) leaves the previously stored path
 *   unchanged.
 * - onSubmit's 4th argument (filePath) carries the current path only when
 *   type is "pdf"; every other type submits null, mirroring how url is
 *   handled for type "link".
 */
describe("ActivityFormDialog PDF file selection (Issue #13)", () => {
  beforeEach(() => {
    vi.mocked(selectPdfFile).mockReset();
  });

  it("does not render a select-file button when creating a new activity, which defaults to type link", () => {
    renderDialog(null);

    expect(
      screen.queryByRole("button", { name: i18n.t("selectPdfFileAction") })
    ).not.toBeInTheDocument();
  });

  it("does not render a select-file button when editing an activity whose type is not pdf", () => {
    renderDialog(QUIZ_ACTIVITY);

    expect(
      screen.queryByRole("button", { name: i18n.t("selectPdfFileAction") })
    ).not.toBeInTheDocument();
  });

  it("renders a select-file button when editing a Pdf activity, showing the currently selected file", () => {
    renderDialog(PDF_ACTIVITY);

    expect(
      screen.getByRole("button", { name: i18n.t("selectPdfFileAction") })
    ).toBeInTheDocument();
    expect(
      screen.getByText(PDF_ACTIVITY.filePath as string)
    ).toBeInTheDocument();
  });

  it("calls selectPdfFile and updates the shown path when the select-file button is clicked", async () => {
    const user = userEvent.setup();
    vi.mocked(selectPdfFile).mockResolvedValueOnce(
      "C:\\Users\\aluno\\Documents\\novo.pdf"
    );
    renderDialog(PDF_ACTIVITY);

    await user.click(
      screen.getByRole("button", { name: i18n.t("selectPdfFileAction") })
    );

    expect(selectPdfFile).toHaveBeenCalledTimes(1);
    await waitFor(() => {
      expect(
        screen.getByText("C:\\Users\\aluno\\Documents\\novo.pdf")
      ).toBeInTheDocument();
    });
  });

  it("keeps the previously selected path when selectPdfFile resolves null (dialog canceled)", async () => {
    const user = userEvent.setup();
    vi.mocked(selectPdfFile).mockResolvedValueOnce(null);
    renderDialog(PDF_ACTIVITY);

    await user.click(
      screen.getByRole("button", { name: i18n.t("selectPdfFileAction") })
    );

    await waitFor(() => {
      expect(selectPdfFile).toHaveBeenCalledTimes(1);
    });
    expect(
      screen.getByText(PDF_ACTIVITY.filePath as string)
    ).toBeInTheDocument();
  });

  it("submits the current filePath when saving a Pdf activity", async () => {
    const user = userEvent.setup();
    const { onSubmit } = renderDialog(PDF_ACTIVITY);

    await user.click(
      screen.getByRole("button", { name: i18n.t("saveAction") })
    );

    expect(onSubmit).toHaveBeenCalledWith(
      PDF_ACTIVITY.title,
      "pdf",
      null,
      PDF_ACTIVITY.filePath
    );
  });
});

describe("ActivityFormDialog type cards", () => {
  const TYPE_LABELS = [
    i18n.t("activityTypeLink"),
    i18n.t("activityTypeQuiz"),
    i18n.t("activityTypePdf"),
    i18n.t("activityTypeFlashcardDeck"),
  ];

  it("picks the type from a radio group of cards labeled by the type field, not a combo box", () => {
    renderDialog();

    const group = screen.getByRole("radiogroup", {
      name: i18n.t("activityTypeLabel"),
    });
    const cards = within(group).getAllByRole("radio");
    expect(cards.map((card) => card.textContent)).toEqual(TYPE_LABELS);
    expect(screen.queryByRole("combobox")).not.toBeInTheDocument();
  });

  it("shows an icon above the name on every card", () => {
    renderDialog();

    for (const card of screen.getAllByRole("radio")) {
      expect(card.querySelector("svg")).toBeInTheDocument();
    }
  });

  it("starts with Link selected when creating", () => {
    renderDialog();
    expect(
      screen.getByRole("radio", { name: i18n.t("activityTypeLink") })
    ).toBeChecked();
  });

  it("starts with the activity's own type selected when editing", () => {
    renderDialog(QUIZ_ACTIVITY);
    expect(
      screen.getByRole("radio", { name: i18n.t("activityTypeQuiz") })
    ).toBeChecked();
  });

  it("switches the type, and its conditional fields, when a card is clicked", async () => {
    const user = userEvent.setup();
    renderDialog();

    await user.click(
      screen.getByRole("radio", { name: i18n.t("activityTypePdf") })
    );

    expect(
      screen.getByRole("radio", { name: i18n.t("activityTypePdf") })
    ).toBeChecked();
    expect(
      screen.queryByLabelText(i18n.t("activityUrlLabel"))
    ).not.toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: i18n.t("selectPdfFileAction") })
    ).toBeInTheDocument();
  });

  it("submits the type chosen through the cards", async () => {
    const user = userEvent.setup();
    const { onSubmit } = renderDialog();

    await user.type(
      screen.getByLabelText(i18n.t("activityTitleLabel")),
      "Novo quiz"
    );
    await user.click(
      screen.getByRole("radio", { name: i18n.t("activityTypeQuiz") })
    );
    await user.click(
      screen.getByRole("button", { name: i18n.t("saveAction") })
    );

    await waitFor(() =>
      expect(onSubmit).toHaveBeenCalledWith("Novo quiz", "quiz", null, null)
    );
  });
});
