import fs from "node:fs";
import path from "node:path";
import { render } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import MarkdownContent from "@/components/markdown-content";
import BaseLayout from "@/layouts/base-layout";

// The sidebar needs the router; the layout's scroll area is what is tested.
vi.mock("@/components/app-sidebar", () => ({ default: () => null }));

/**
 * RED phase (docs/specs/selection-and-scrollbars.md): only an activity's
 * content and what is typed can be selected, and every scroll area has the
 * app's thin scrollbar.
 */

const css = fs.readFileSync(
  path.resolve(process.cwd(), "src/styles/global.css"),
  "utf8"
);
const WHITESPACE = /\s+/g;
const flat = css.replace(WHITESPACE, " ");
const BODY_UNSELECTABLE = /body \{[^}]*user-select: none/;
const TYPING_AND_CONTENT_SELECTABLE =
  /input,[^{]*textarea,[^{]*\[contenteditable[^{]*\.selectable[^{]*\{[^}]*user-select: text/;
const CHOICE_UNSELECTABLE =
  /\[data-slot="questionnaire-choice"\] \.selectable[^{]*\{[^}]*user-select: none/;
/** The base rule for every element, `* { ... }`. */
const EVERY_ELEMENT = /\* \{([^}]*)\}/;

describe("selection and scrollbars", () => {
  it("marks an activity's content as selectable (AC-2)", () => {
    const { container } = render(
      <MarkdownContent content="Qual é a **capital**?" />
    );

    expect(container.firstElementChild).toHaveClass("selectable");
  });

  it("turns selection off for the whole interface, and back on for content and typing (AC-1, AC-2)", () => {
    expect(flat).toMatch(BODY_UNSELECTABLE);
    expect(flat).toMatch(TYPING_AND_CONTENT_SELECTABLE);
  });

  it("keeps a choice's text unselectable, as it is clicked like a button (AC-3)", () => {
    expect(flat).toMatch(CHOICE_UNSELECTABLE);
  });

  it("gives every scroll area the app's thin scrollbar (AC-4)", () => {
    const rule = EVERY_ELEMENT.exec(flat)?.[1] ?? "";
    expect(rule).toContain("scrollbar-width: thin");
    expect(rule).toContain("scrollbar-color: var(--border) transparent");
  });

  it("keeps the main panel's scrollbar clear of its rounded corners (AC-5)", () => {
    const { container } = render(
      <BaseLayout>
        <p>conteúdo</p>
      </BaseLayout>
    );
    const scroller = container.querySelector(
      '[data-slot="sidebar-inset"] > main'
    );

    expect(scroller).toHaveClass("overflow-y-auto", "my-(--radius-xl)");
  });
});
