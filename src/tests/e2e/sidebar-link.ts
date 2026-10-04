import type { Locator, Page } from "@playwright/test";

/**
 * A page link in the sidebar. "Programs" also leads the breadcrumb of a
 * program's screens (docs/specs/organize-identity.md), so a bare link role
 * would match both there.
 */
export function sidebarLink(page: Page, name: string): Locator {
  return page
    .getByRole("link", { exact: true, name })
    .and(page.locator("[data-sidebar='menu-button']"));
}
