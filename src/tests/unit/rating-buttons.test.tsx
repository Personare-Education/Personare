import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import i18n from "i18next";
import { describe, expect, it, vi } from "vitest";
import "@/localization/i18n";
import { RatingButtons } from "@/components/rating-buttons";

/**
 * RED phase (docs/specs/rating-clarity.md AC-1, AC-2): each rating button
 * shows what it would schedule, keeps the rating as its name, and an
 * activity reads on its own scale.
 */

const NOW = Date.now();
const DAY = 24 * 60 * 60 * 1000;
const INTERVALS = {
  again: new Date(NOW + DAY),
  easy: new Date(NOW + 15 * DAY),
  good: new Date(NOW + 4 * DAY),
  hard: new Date(NOW + 2 * DAY),
};

describe("RatingButtons", () => {
  it("shows the interval each rating would schedule, as the button's description", () => {
    render(<RatingButtons intervals={INTERVALS} onRate={vi.fn()} />);

    const good = screen.getByRole("button", {
      name: i18n.t("ratingGoodAction"),
    });
    expect(good).toHaveAccessibleDescription("4 days");
    expect(good).toHaveTextContent("4 days");
  });

  it("works without intervals", () => {
    render(<RatingButtons onRate={vi.fn()} />);

    expect(
      screen.getByRole("button", { name: i18n.t("ratingGoodAction") })
    ).toBeInTheDocument();
  });

  it("uses the activity scale for an activity", async () => {
    const user = userEvent.setup();
    const onRate = vi.fn();
    render(<RatingButtons onRate={onRate} scale="activity" />);

    await user.click(
      screen.getByRole("button", { name: i18n.t("activityRatingGoodAction") })
    );

    expect(onRate).toHaveBeenCalledWith("good");
    expect(
      screen.getByRole("button", { name: i18n.t("activityRatingAgainAction") })
    ).toBeInTheDocument();
  });
});
