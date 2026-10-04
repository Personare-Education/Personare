import { fireEvent, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import i18n from "i18next";
import { describe, expect, it, vi } from "vitest";
import { openExternalLink } from "@/actions/shell";
import ActivitiesDataTable, {
  type Activity,
} from "@/components/activities-data-table";
import "@/localization/i18n";

const PDF_ROW_NAME = /Apostila em PDF/;

vi.mock("@/actions/shell", () => ({
  openExternalLink: vi.fn(),
}));

/**
 * RED phase (Issue #10, Spec Driven TDD): src/components/activities-data-table
 * does not exist yet. Every test below is expected to fail until Bigorna
 * (Developer) implements it, mirroring src/components/modules-data-table
 * (Issue #9).
 *
 * Contract exercised here (criterio de aceite 8: "renderizacao da Data
 * Table incluindo os Badges por tipo"):
 * - `activities` prop: rows rendered, one per activity, showing its title.
 * - each row renders a Badge with the translated label for its type
 *   (criterio 2), for every MVP type: link, quiz, pdf, flashcard_deck.
 * - `onEdit(activity)`: called when a row's edit action is triggered
 *   (criterio 4).
 * - `onRequestDelete(activity)`: called when a row's delete action is
 *   triggered (naming signals it only *requests* the deletion -- the
 *   actual soft-delete confirmation/AlertDialog, per criterio 5, is the
 *   caller's responsibility, not the table's).
 * - Action labels come from i18next keys `editActivityAction` and
 *   `deleteActivityAction` (criterio 6: no hardcoded UI text) -- read
 *   through `i18n.t` so this test does not hardcode copy, only the key
 *   names Bigorna must add translations for.
 * - An empty `activities` list renders the `activitiesTableEmptyMessage`
 *   key.
 *
 * Unlike ModulesDataTable, there is no "view children" action -- an
 * Activity has no drill-down Data Table of its own in this issue (Issues
 * #12-#15 decide how a row's content is opened for editing).
 */

const ACTIVITIES: Activity[] = [
  {
    createdAt: new Date("2026-01-01"),
    filePath: null,
    id: "11111111-1111-1111-1111-111111111111",
    moduleId: "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa",
    title: "Aula introdutoria",
    type: "link",
    updatedAt: new Date("2026-01-01"),
    url: "https://example.com/aula-introdutoria",
  },
  {
    createdAt: new Date("2026-01-02"),
    filePath: null,
    id: "22222222-2222-2222-2222-222222222222",
    moduleId: "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa",
    title: "Quiz de fixacao",
    type: "quiz",
    updatedAt: new Date("2026-01-02"),
    url: null,
  },
  {
    createdAt: new Date("2026-01-03"),
    filePath: "C:\\Users\\aluno\\Documents\\apostila.pdf",
    id: "33333333-3333-3333-3333-333333333333",
    moduleId: "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa",
    title: "Apostila em PDF",
    type: "pdf",
    updatedAt: new Date("2026-01-03"),
    url: null,
  },
  {
    createdAt: new Date("2026-01-04"),
    filePath: null,
    id: "44444444-4444-4444-4444-444444444444",
    moduleId: "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa",
    title: "Baralho de revisao",
    type: "flashcard_deck",
    updatedAt: new Date("2026-01-04"),
    url: null,
  },
];

/** Opens the "More actions" menu of the row holding `title`. */
async function openRowMenu(
  user: ReturnType<typeof userEvent.setup>,
  title: string
) {
  const row = screen.getByText(title).closest("tr") as HTMLTableRowElement;
  await user.click(
    within(row).getByRole("button", { name: i18n.t("moreActionsAction") })
  );
}

function renderTable(
  activities: Activity[] = ACTIVITIES,
  reviewStateByActivityId: Record<
    string,
    { dueDate: Date; lastRating: string } | undefined
  > = {}
) {
  const onEdit = vi.fn();
  const onManageFlashcards = vi.fn();
  const onManageQuiz = vi.fn();
  const onOpenLink = vi.fn();
  const onRequestDelete = vi.fn();
  const onStartReview = vi.fn();
  const onTakeQuiz = vi.fn();
  const onViewPdf = vi.fn();

  render(
    <ActivitiesDataTable
      activities={activities}
      onEdit={onEdit}
      onManageFlashcards={onManageFlashcards}
      onManageQuiz={onManageQuiz}
      onOpenLink={onOpenLink}
      onRequestDelete={onRequestDelete}
      onStartReview={onStartReview}
      onTakeQuiz={onTakeQuiz}
      onViewPdf={onViewPdf}
      reviewStateByActivityId={reviewStateByActivityId}
    />
  );

  return {
    onEdit,
    onManageFlashcards,
    onManageQuiz,
    onOpenLink,
    onRequestDelete,
    onStartReview,
    onTakeQuiz,
    onViewPdf,
  };
}

describe("ActivitiesDataTable", () => {
  it("renders a row for each activity with its title", () => {
    renderTable();

    expect(screen.getByText("Aula introdutoria")).toBeInTheDocument();
    expect(screen.getByText("Quiz de fixacao")).toBeInTheDocument();
    expect(screen.getByText("Apostila em PDF")).toBeInTheDocument();
    expect(screen.getByText("Baralho de revisao")).toBeInTheDocument();
  });

  it("renders the empty-state message when there are no activities", () => {
    renderTable([]);

    expect(
      screen.getByText(i18n.t("activitiesTableEmptyMessage"))
    ).toBeInTheDocument();
  });

  it.each([
    ["link", "activityTypeLink"],
    ["quiz", "activityTypeQuiz"],
    ["pdf", "activityTypePdf"],
    ["flashcard_deck", "activityTypeFlashcardDeck"],
  ] as const)(
    "renders a badge with the translated label for the %s type",
    (type, translationKey) => {
      const activity = ACTIVITIES.find((item) => item.type === type);
      if (!activity) {
        throw new Error(`fixture missing an activity of type ${type}`);
      }

      renderTable([activity]);

      expect(screen.getByText(i18n.t(translationKey))).toBeInTheDocument();
    }
  );

  /** docs/specs/layout-tables.md AC-4 */
  it("keeps edit and delete in a 'More actions' menu on every row", () => {
    renderTable();

    expect(
      screen.getAllByRole("button", { name: i18n.t("moreActionsAction") })
    ).toHaveLength(ACTIVITIES.length);
    expect(
      screen.queryByRole("button", { name: i18n.t("editActivityAction") })
    ).toBeNull();
    expect(
      screen.queryByRole("button", { name: i18n.t("deleteActivityAction") })
    ).toBeNull();
  });

  it("calls onEdit with the corresponding activity when its edit action is triggered", async () => {
    const user = userEvent.setup();
    const { onEdit } = renderTable();

    await user.click(
      screen.getAllByRole("button", { name: i18n.t("moreActionsAction") })[1]
    );
    await user.click(
      await screen.findByRole("menuitem", {
        name: i18n.t("editActivityAction"),
      })
    );

    expect(onEdit).toHaveBeenCalledTimes(1);
    expect(onEdit).toHaveBeenCalledWith(ACTIVITIES[1]);
  });

  it("calls onRequestDelete with the corresponding activity when its delete action is triggered", async () => {
    const user = userEvent.setup();
    const { onRequestDelete } = renderTable();

    await user.click(
      screen.getAllByRole("button", { name: i18n.t("moreActionsAction") })[0]
    );
    await user.click(
      await screen.findByRole("menuitem", {
        name: i18n.t("deleteActivityAction"),
      })
    );

    expect(onRequestDelete).toHaveBeenCalledTimes(1);
    expect(onRequestDelete).toHaveBeenCalledWith(ACTIVITIES[0]);
  });

  /** docs/specs/table-rating-scale.md AC-1 */
  it("shows every last rating in the activity words, a deck's too", () => {
    renderTable([ACTIVITIES[1], ACTIVITIES[3]], {
      [ACTIVITIES[1].id]: {
        dueDate: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000),
        lastRating: "good",
      },
      [ACTIVITIES[3].id]: {
        dueDate: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000),
        lastRating: "easy",
      },
    });

    expect(
      screen.getByText(i18n.t("activityRatingGoodAction"))
    ).toBeInTheDocument();
    expect(
      screen.getByText(i18n.t("activityRatingEasyAction"))
    ).toBeInTheDocument();
    expect(screen.queryByText(i18n.t("ratingEasyAction"))).toBeNull();
  });

  /** docs/specs/table-rating-scale.md AC-2 */
  it("tints each rating chip in its own tone, never as a primary badge", () => {
    renderTable([ACTIVITIES[1]], {
      [ACTIVITIES[1].id]: {
        dueDate: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000),
        lastRating: "easy",
      },
    });

    const chip = screen.getByText(i18n.t("activityRatingEasyAction"));
    expect(chip.style.getPropertyValue("--tone")).toBe("var(--brand)");
    expect(chip).not.toHaveAttribute("data-variant", "default");
  });

  /** docs/specs/layout-tables.md AC-2 */
  it("says an activity was not rated yet instead of leaving the cell blank", () => {
    renderTable([ACTIVITIES[1]]);

    expect(
      screen.getByText(i18n.t("activityNotRatedYetLabel"))
    ).toBeInTheDocument();
  });

  /** docs/specs/layout-tables.md AC-3 */
  it("puts the review chip in the next-review cell, not among the actions", () => {
    render(
      <ActivitiesDataTable
        activities={[ACTIVITIES[1]]}
        highlightByActivityId={{ [ACTIVITIES[1].id]: "today" }}
        onEdit={vi.fn()}
        onManageFlashcards={vi.fn()}
        onManageQuiz={vi.fn()}
        onOpenLink={vi.fn()}
        onRequestDelete={vi.fn()}
        onStartReview={vi.fn()}
        onTakeQuiz={vi.fn()}
        onViewPdf={vi.fn()}
        reviewStateByActivityId={{}}
      />
    );

    const chip = screen.getByText(i18n.t("reviewDueTodayLabel"));
    const cells = Array.from(chip.closest("tr")?.querySelectorAll("td") ?? []);
    expect(cells.indexOf(chip.closest("td") as HTMLTableCellElement)).toBe(3);
  });

  /**
   * RED phase (Issue #12, Spec Driven TDD): ActivitiesDataTable does not
   * render an "open URL" action yet -- these tests are expected to fail
   * until Bancada adds a button/action visible only for type === "link"
   * that calls openExternalLink(activity.url) (criterio de aceite 4).
   */
  it("renders an action to open the URL only for Link activities", () => {
    renderTable();

    const openButtons = screen.getAllByRole("button", {
      name: i18n.t("openActivityUrlAction"),
    });

    expect(openButtons).toHaveLength(1);
  });

  it("calls openExternalLink with the activity's url when its open action is triggered", async () => {
    const user = userEvent.setup();
    renderTable();

    const openButton = screen.getByRole("button", {
      name: i18n.t("openActivityUrlAction"),
    });
    await user.click(openButton);

    expect(openExternalLink).toHaveBeenCalledTimes(1);
    expect(openExternalLink).toHaveBeenCalledWith(ACTIVITIES[0].url);
  });

  /**
   * RED phase (Issue #103, Spec Driven TDD): ActivitiesDataTable does not
   * call onOpenLink yet -- this test is expected to fail until the
   * Developer adds it, per
   * docs/specs/issue-103-pdf-native-open-difficulty-flow.md AC-6. Bubbles
   * up alongside (not instead of) the existing openExternalLink call, so
   * the caller can arm a pending difficulty rating for the Activity.
   */
  it("also calls onOpenLink with the activity when its open action is triggered", async () => {
    const user = userEvent.setup();
    const { onOpenLink } = renderTable();

    const openButton = screen.getByRole("button", {
      name: i18n.t("openActivityUrlAction"),
    });
    await user.click(openButton);

    expect(onOpenLink).toHaveBeenCalledTimes(1);
    expect(onOpenLink).toHaveBeenCalledWith(ACTIVITIES[0]);
  });

  /**
   * RED phase (Issue #13, Spec Driven TDD): ActivitiesDataTable does not
   * render a "view PDF" action yet -- these tests are expected to fail until
   * Serralheria adds a button/action visible only for type === "pdf" that
   * calls onViewPdf(activity) (criterio de aceite 3). Mirrors the "open URL"
   * action added for Link activities by Issue #12, but bubbles the request
   * up to the caller (like onRequestDelete) instead of triggering the side
   * effect directly, since opening the embedded viewer requires a Dialog
   * that is the caller's responsibility, not the table's.
   */
  it("renders an action to view the PDF only for Pdf activities", () => {
    renderTable();

    const viewButtons = screen.getAllByRole("button", {
      name: i18n.t("viewPdfAction"),
    });

    expect(viewButtons).toHaveLength(1);
  });

  it("calls onViewPdf with the corresponding activity when its view action is triggered", async () => {
    const user = userEvent.setup();
    const { onViewPdf } = renderTable();

    const viewButton = screen.getByRole("button", {
      name: i18n.t("viewPdfAction"),
    });
    await user.click(viewButton);

    expect(onViewPdf).toHaveBeenCalledTimes(1);
    expect(onViewPdf).toHaveBeenCalledWith(ACTIVITIES[2]);
  });

  /**
   * RED phase (Issue #14, Spec Driven TDD): ActivitiesDataTable does not
   * render "manage questions"/"take quiz" actions yet -- these tests are
   * expected to fail until Fundacao adds two buttons/actions visible only
   * for type === "quiz" that call onManageQuiz(activity)/onTakeQuiz(activity)
   * (docs/specs/issue-14-quiz.md, AC-3). Mirrors onViewPdf: the table only
   * bubbles the request up, since opening either dialog is the caller's
   * responsibility.
   */
  it("shows take-quiz on the Quiz row only, with manage-questions in its menu", async () => {
    const user = userEvent.setup();
    renderTable();

    expect(
      screen.getAllByRole("button", { name: i18n.t("takeQuizAction") })
    ).toHaveLength(1);
    expect(
      screen.queryByRole("button", {
        name: i18n.t("manageQuizQuestionsAction"),
      })
    ).toBeNull();

    await openRowMenu(user, "Quiz de fixacao");
    expect(
      await screen.findByRole("menuitem", {
        name: i18n.t("manageQuizQuestionsAction"),
      })
    ).toBeInTheDocument();
  });

  it("calls onManageQuiz with the corresponding activity when its manage-questions action is triggered", async () => {
    const user = userEvent.setup();
    const { onManageQuiz } = renderTable();

    await openRowMenu(user, "Quiz de fixacao");
    await user.click(
      await screen.findByRole("menuitem", {
        name: i18n.t("manageQuizQuestionsAction"),
      })
    );

    expect(onManageQuiz).toHaveBeenCalledTimes(1);
    expect(onManageQuiz).toHaveBeenCalledWith(ACTIVITIES[1]);
  });

  it("calls onTakeQuiz with the corresponding activity when its take-quiz action is triggered", async () => {
    const user = userEvent.setup();
    const { onTakeQuiz } = renderTable();

    const takeButton = screen.getByRole("button", {
      name: i18n.t("takeQuizAction"),
    });
    await user.click(takeButton);

    expect(onTakeQuiz).toHaveBeenCalledTimes(1);
    expect(onTakeQuiz).toHaveBeenCalledWith(ACTIVITIES[1]);
  });

  /**
   * RED phase (Issue #15, Spec Driven TDD): ActivitiesDataTable does not
   * render a "manage flashcards" action yet -- these tests are expected to
   * fail until the Developer adds a button/action visible only for
   * type === "flashcard_deck" that calls onManageFlashcards(activity)
   * (docs/specs/issue-15-flashcard-baralho.md, AC-5). Mirrors onManageQuiz:
   * the table only bubbles the request up, since opening the manager dialog
   * is the caller's responsibility.
   */
  it("keeps manage-flashcards in the Flashcard Deck row's menu", async () => {
    const user = userEvent.setup();
    renderTable();

    expect(
      screen.queryByRole("button", { name: i18n.t("manageFlashcardsAction") })
    ).toBeNull();
    await openRowMenu(user, "Baralho de revisao");
    expect(
      await screen.findByRole("menuitem", {
        name: i18n.t("manageFlashcardsAction"),
      })
    ).toBeInTheDocument();
  });

  it("calls onManageFlashcards with the corresponding activity when its manage-flashcards action is triggered", async () => {
    const user = userEvent.setup();
    const { onManageFlashcards } = renderTable();

    await openRowMenu(user, "Baralho de revisao");
    await user.click(
      await screen.findByRole("menuitem", {
        name: i18n.t("manageFlashcardsAction"),
      })
    );

    expect(onManageFlashcards).toHaveBeenCalledTimes(1);
    expect(onManageFlashcards).toHaveBeenCalledWith(ACTIVITIES[3]);
  });

  /**
   * RED phase (Issue #16, Spec Driven TDD): ActivitiesDataTable does not
   * render a "start review" action yet -- these tests are expected to fail
   * until the Developer adds a button/action visible only for
   * type === "flashcard_deck" that calls onStartReview(activity)
   * (docs/specs/issue-16-fsrs-review-session.md, AC-5). A Flashcard Deck
   * activity now has two conditional actions (manage flashcards, start
   * review) -- distinct from each other and from Quiz's "take quiz".
   */
  it("renders a start-review action only for Flashcard Deck activities", () => {
    renderTable();

    const startReviewButtons = screen.getAllByRole("button", {
      name: i18n.t("startReviewAction"),
    });

    expect(startReviewButtons).toHaveLength(1);
  });

  it("calls onStartReview with the corresponding activity when its start-review action is triggered", async () => {
    const user = userEvent.setup();
    const { onStartReview } = renderTable();

    const startReviewButton = screen.getByRole("button", {
      name: i18n.t("startReviewAction"),
    });
    await user.click(startReviewButton);

    expect(onStartReview).toHaveBeenCalledTimes(1);
    expect(onStartReview).toHaveBeenCalledWith(ACTIVITIES[3]);
  });

  /**
   * RED phase (Issue #103, Spec Driven TDD): the separate "mark as done"
   * action is removed -- opening the PDF/Link/finishing the Quiz is now the
   * trigger for the difficulty rating (see activity-difficulty-dialog and
   * quiz-runner-dialog tests), not a second manual click here.
   */
  it("no longer renders a separate mark-as-done action", () => {
    renderTable();

    expect(
      screen.queryByRole("button", { name: "Mark as done" })
    ).not.toBeInTheDocument();
  });

  it("shows nothing about review state for an activity that was never marked", () => {
    renderTable();

    const ratingLabels = [
      i18n.t("activityRatingAgainAction"),
      i18n.t("activityRatingHardAction"),
      i18n.t("activityRatingGoodAction"),
      i18n.t("activityRatingEasyAction"),
    ];
    for (const label of ratingLabels) {
      expect(screen.queryByText(label)).not.toBeInTheDocument();
    }
  });

  /**
   * docs/specs/rating-clarity.md AC-2, AC-3: the last rating in the
   * activity's own words, and the next review as a relative day with the
   * full date on hover.
   */
  it("shows the last rating and the next review date in separate cells for an activity with review state", () => {
    const [, quiz] = ACTIVITIES;
    const inFourDays = new Date();
    inFourDays.setDate(inFourDays.getDate() + 4);
    renderTable(ACTIVITIES, {
      [quiz.id]: {
        dueDate: inFourDays,
        lastRating: "good",
      },
    });

    expect(
      screen.getByText(i18n.t("activityRatingGoodAction"))
    ).toBeInTheDocument();
    const nextReview = screen.getByText(
      i18n.t("reviewDueInDays", { count: 4 })
    );
    expect(nextReview).toHaveAttribute("title");
  });

  it("names the rating column for what it holds", () => {
    renderTable();

    expect(
      screen.getByRole("columnheader", {
        name: i18n.t("activityReviewStateColumnLabel"),
      })
    ).toHaveTextContent(i18n.t("activityReviewStateColumnLabel"));
    expect(i18n.t("activityReviewStateColumnLabel")).not.toBe("Progress");
  });
});

describe("ActivitiesDataTable row click and context menu", () => {
  it.each([
    ["Aula introdutoria", "onOpenLink", 0],
    ["Quiz de fixacao", "onTakeQuiz", 1],
    ["Apostila em PDF", "onViewPdf", 2],
    ["Baralho de revisao", "onStartReview", 3],
  ] as const)(
    "clicking the %s row runs its type's main action (%s)",
    async (title, handler, index) => {
      const user = userEvent.setup();
      const handlers = renderTable();

      await user.click(screen.getByText(title));

      expect(handlers[handler]).toHaveBeenCalledTimes(1);
      expect(handlers[handler]).toHaveBeenCalledWith(ACTIVITIES[index]);
    }
  );

  it("clicking a Link row also opens its URL", async () => {
    const user = userEvent.setup();
    renderTable();

    await user.click(screen.getByText("Aula introdutoria"));

    expect(openExternalLink).toHaveBeenCalledWith(ACTIVITIES[0].url);
  });

  it("opens the activity when its row is focused and Enter is pressed", async () => {
    const user = userEvent.setup();
    const { onViewPdf } = renderTable();

    screen.getByRole("row", { name: PDF_ROW_NAME }).focus();
    await user.keyboard("{Enter}");

    expect(onViewPdf).toHaveBeenCalledWith(ACTIVITIES[2]);
  });

  it("does not also open the activity when one of its action buttons is clicked", async () => {
    const user = userEvent.setup();
    const { onManageQuiz, onTakeQuiz } = renderTable();

    await openRowMenu(user, "Quiz de fixacao");
    await user.click(
      await screen.findByRole("menuitem", {
        name: i18n.t("manageQuizQuestionsAction"),
      })
    );

    expect(onManageQuiz).toHaveBeenCalledWith(ACTIVITIES[1]);
    expect(onTakeQuiz).not.toHaveBeenCalled();
  });

  it("lists the row's actions, in button order, in a context menu on right-click", async () => {
    renderTable();

    fireEvent.contextMenu(screen.getByText("Quiz de fixacao"));

    const items = await screen.findAllByRole("menuitem");
    expect(items.map((item) => item.textContent)).toEqual([
      i18n.t("takeQuizAction"),
      i18n.t("manageQuizQuestionsAction"),
      i18n.t("editActivityAction"),
      i18n.t("deleteActivityAction"),
    ]);
  });

  it("runs the selected context menu action for that activity", async () => {
    const user = userEvent.setup();
    const { onManageFlashcards } = renderTable();

    fireEvent.contextMenu(screen.getByText("Baralho de revisao"));
    await user.click(
      await screen.findByRole("menuitem", {
        name: i18n.t("manageFlashcardsAction"),
      })
    );

    expect(onManageFlashcards).toHaveBeenCalledWith(ACTIVITIES[3]);
  });
});

describe("Activities screen i18n keys (Issue #10)", () => {
  const REQUIRED_KEYS = [
    "activitiesPageTitle",
    "activitiesTableEmptyMessage",
    "activityTitleLabel",
    "activityTypeLabel",
    "activityTypeLink",
    "activityTypeQuiz",
    "activityTypePdf",
    "activityTypeFlashcardDeck",
    "createActivityAction",
    "createActivityTitle",
    "editActivityAction",
    "editActivityTitle",
    "deleteActivityAction",
    "deleteActivityConfirmTitle",
    "deleteActivityConfirmDescription",
    // Issue #12 (Atividade tipo Link)
    "activityUrlLabel",
    "openActivityUrlAction",
    // Issue #13 (Atividade tipo PDF)
    "selectPdfFileAction",
    "viewPdfAction",
    // Issue #14 (Atividade tipo Quiz)
    "manageQuizQuestionsAction",
    "takeQuizAction",
    // Issue #15 (Atividade tipo Flashcard/Baralho)
    "manageFlashcardsAction",
    // Issue #16 (Motor FSRS: sessao de revisao do Baralho)
    "startReviewAction",
    // Issue #77 (Dificuldade percebida em Quiz/PDF/Link -> FSRS)
    "activityDifficultyPromptMessage",
    "activityReviewStateColumnLabel",
    "activityNextReviewColumnLabel",
    "actionsColumnLabel",
  ];

  it.each(["en", "pt-BR"] as const)(
    "defines every ActivitiesDataTable key for the %s locale",
    (locale) => {
      const bundle = i18n.getResourceBundle(locale, "translation") ?? {};

      for (const key of REQUIRED_KEYS) {
        expect(bundle).toHaveProperty(key);
      }
    }
  );
});

/**
 * docs/specs/calendar-module-review-highlight.md AC-6 and AC-7: same
 * highlight as the modules table, per activity; "focus" is an activity
 * picked from the calendar for a later day.
 */
describe("ActivitiesDataTable review highlight", () => {
  it("marks each activity row with its highlight, and a clock only for overdue ones", () => {
    render(
      <ActivitiesDataTable
        activities={ACTIVITIES}
        highlightByActivityId={{
          [ACTIVITIES[0].id]: "overdue",
          [ACTIVITIES[1].id]: "focus",
        }}
        onEdit={vi.fn()}
        onManageFlashcards={vi.fn()}
        onManageQuiz={vi.fn()}
        onOpenLink={vi.fn()}
        onRequestDelete={vi.fn()}
        onStartReview={vi.fn()}
        onTakeQuiz={vi.fn()}
        onViewPdf={vi.fn()}
        reviewStateByActivityId={{}}
      />
    );

    const overdueRow = screen.getByRole("row", {
      name: new RegExp(ACTIVITIES[0].title),
    });
    expect(overdueRow).toHaveAttribute("data-review-highlight", "overdue");
    const focusRow = screen.getByRole("row", {
      name: new RegExp(ACTIVITIES[1].title),
    });
    expect(focusRow).toHaveAttribute("data-review-highlight", "focus");
    expect(focusRow).toHaveTextContent(i18n.t("reviewFocusLabel"));
    expect(
      document.querySelectorAll('[data-slot="overdue-review-marker"]')
    ).toHaveLength(1);
  });
});

/** docs/specs/row-primary-action.md AC-1, AC-4 */
describe("ActivitiesDataTable primary action", () => {
  it("shows each row's main action as a labeled button", () => {
    renderTable();

    for (const key of [
      "openActivityUrlAction",
      "takeQuizAction",
      "viewPdfAction",
      "startReviewAction",
    ]) {
      expect(
        screen.getByRole("button", { name: i18n.t(key) })
      ).toHaveTextContent(i18n.t(key));
    }
  });
});
