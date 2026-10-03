import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import i18n from "i18next";
import { describe, expect, it, vi } from "vitest";
import "@/localization/i18n";
import {
  ActivitiesEmptyState,
  ModulesEmptyState,
  ProgramsEmptyState,
} from "@/components/onboarding-empty-states";

/**
 * RED phase (docs/specs/onboard-empty-states.md AC-3..5): an empty list
 * says what goes in it and how to start.
 */
describe("onboarding empty states", () => {
  it.each([
    {
      action: "createProgramAction",
      body: "programsEmptyMessage",
      Component: ProgramsEmptyState,
      title: "programsEmptyTitle",
    },
    {
      action: "createModuleAction",
      body: "modulesEmptyMessage",
      Component: ModulesEmptyState,
      title: "modulesEmptyTitle",
    },
    {
      action: "createActivityAction",
      body: "activitiesEmptyMessage",
      Component: ActivitiesEmptyState,
      title: "activitiesEmptyTitle",
    },
  ])(
    "$title explains the list and creates the first item",
    async ({ Component, action, body, title }) => {
      const user = userEvent.setup();
      const onCreate = vi.fn();
      render(<Component onCreate={onCreate} />);

      expect(
        screen.getByRole("heading", { name: i18n.t(title) })
      ).toBeInTheDocument();
      expect(screen.getByText(i18n.t(body))).toBeInTheDocument();
      await user.click(screen.getByRole("button", { name: i18n.t(action) }));
      expect(onCreate).toHaveBeenCalledTimes(1);
    }
  );
});
