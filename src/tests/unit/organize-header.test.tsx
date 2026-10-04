import {
  createMemoryHistory,
  createRootRoute,
  createRoute,
  createRouter,
  RouterProvider,
} from "@tanstack/react-router";
import { render, screen } from "@testing-library/react";
import i18n from "i18next";
import { describe, expect, it } from "vitest";
import OrganizeHeader from "@/components/organize-header";
import { BreadcrumbItem, BreadcrumbPage } from "@/components/ui/breadcrumb";
import { BRAND_PROGRAM_COLOR } from "@/constants/program-appearance";
import "@/localization/i18n";

/**
 * RED phase (docs/specs/organize-identity.md): the program and module
 * screens carry the program's name, color and icon, and a way back to
 * Programs.
 */

function renderHeader(color: string | null) {
  const rootRoute = createRootRoute({
    component: () => (
      <OrganizeHeader
        action={<button type="button">New module</button>}
        color={color}
        crumbs={
          <BreadcrumbItem>
            <BreadcrumbPage>Cálculo I</BreadcrumbPage>
          </BreadcrumbItem>
        }
        icon="Atom"
        title="Cálculo I"
      />
    ),
  });
  const programsRoute = createRoute({
    getParentRoute: () => rootRoute,
    path: "/programs",
  });
  const router = createRouter({
    history: createMemoryHistory({ initialEntries: ["/"] }),
    routeTree: rootRoute.addChildren([programsRoute]),
  });
  render(<RouterProvider router={router} />);
}

describe("OrganizeHeader", () => {
  it("titles the screen with its name (AC-1)", async () => {
    renderHeader("#e11d48");

    expect(
      await screen.findByRole("heading", { level: 1, name: "Cálculo I" })
    ).toBeInTheDocument();
  });

  it("shows the program's tile in its color, the brand's by default (AC-2)", async () => {
    renderHeader("#e11d48");
    const tile = (await screen.findByRole("heading", { level: 1 }))
      .closest("header")
      ?.querySelector("[data-slot='program-tile']") as HTMLElement;

    expect(tile).toHaveStyle({ backgroundColor: "#e11d48" });
    expect(tile.querySelector("svg")).not.toBeNull();
  });

  it("falls back to the brand color", async () => {
    renderHeader(null);
    const tile = (await screen.findByRole("heading", { level: 1 }))
      .closest("header")
      ?.querySelector("[data-slot='program-tile']") as HTMLElement;

    expect(tile).toHaveStyle({ backgroundColor: BRAND_PROGRAM_COLOR });
  });

  it("starts the breadcrumb at Programs (AC-3)", async () => {
    renderHeader("#e11d48");

    const programs = await screen.findByRole("link", {
      name: i18n.t("navPrograms"),
    });
    expect(programs).toHaveAttribute("href", "/programs");
    const items = screen
      .getByRole("navigation", { name: "breadcrumb" })
      .querySelectorAll("[data-slot='breadcrumb-item']");
    expect(items[0]).toHaveTextContent(i18n.t("navPrograms"));
    expect(items[1]).toHaveTextContent("Cálculo I");
  });

  it("keeps the create action (AC-4)", async () => {
    renderHeader("#e11d48");

    expect(
      await screen.findByRole("button", { name: "New module" })
    ).toBeInTheDocument();
  });
});
