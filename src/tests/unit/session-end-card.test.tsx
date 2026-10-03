import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import SessionEndCard from "@/components/session-end-card";

/** docs/specs/bolder-cards.md: the end of a session, in the program's color. */
describe("SessionEndCard", () => {
  it("shows its title as a heading and its content", () => {
    render(
      <SessionEndCard color="#22c55e" title="All caught up">
        <p>3 items reviewed.</p>
      </SessionEndCard>
    );

    expect(
      screen.getByRole("heading", { name: "All caught up" })
    ).toBeInTheDocument();
    expect(screen.getByText("3 items reviewed.")).toBeInTheDocument();
  });

  it("is tinted with the given color", () => {
    render(<SessionEndCard color="#22c55e" title="Done" />);

    const card = screen
      .getByRole("heading", { name: "Done" })
      .closest<HTMLElement>("[data-slot='session-end-card']");
    expect(card?.style.backgroundImage).toContain("#22c55e");
  });
});
