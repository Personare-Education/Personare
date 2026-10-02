import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import MarkdownContent from "@/components/markdown-content";

/**
 * RED phase (Issue #96, Spec Driven TDD): src/components/markdown-content
 * does not exist yet, per docs/specs/issue-96-markdown-latex-imagens.md
 * AC-1. MarkdownContent is the read-only renderer reused everywhere
 * flashcard/quiz content is displayed: plain Markdown formatting, and LaTeX
 * (KaTeX's $...$/$$...$$ delimiters) rendered as an actual math formula
 * rather than left as literal `$` characters.
 */
describe("MarkdownContent (Issue #96)", () => {
  it("renders plain text with no Markdown/LaTeX", () => {
    const { getByText } = render(<MarkdownContent content="plain text" />);

    expect(getByText("plain text")).toBeInTheDocument();
  });

  it("renders Markdown formatting", () => {
    const { container } = render(<MarkdownContent content="**bold text**" />);

    const strong = container.querySelector("strong");
    expect(strong).not.toBeNull();
    expect(strong).toHaveTextContent("bold text");
  });

  it("renders inline LaTeX between $...$ as a KaTeX formula", () => {
    const { container } = render(
      <MarkdownContent content="Energy is $E=mc^2$" />
    );

    expect(container.querySelector(".katex")).not.toBeNull();
    expect(container.textContent).not.toContain("$E=mc^2$");
  });

  it("renders block LaTeX between $$...$$ as a KaTeX display formula", () => {
    const { container } = render(
      <MarkdownContent content={"$$\nx^2 + y^2 = z^2\n$$"} />
    );

    expect(container.querySelector(".katex-display")).not.toBeNull();
  });

  it("renders LaTeX between \\(...\\) as a KaTeX formula", () => {
    const { container } = render(
      <MarkdownContent content={"\\(\\text{A} \\rightarrow \\text{B}\\)"} />
    );

    expect(container.querySelector(".katex")).not.toBeNull();
    expect(container.textContent).not.toContain("\\(");
  });

  it("renders a fenced code block as a styled <pre>, keeping its lines", () => {
    const { container } = render(
      <MarkdownContent content={"```c\nint x = 1;\nx++;\n```"} />
    );

    const pre = container.querySelector("pre");
    expect(pre).not.toBeNull();
    expect(pre).toHaveClass("bg-muted");
    expect(pre?.textContent).toBe("int x = 1;\nx++;\n");
  });

  /*
   * The stylesheet comes from the top-level katex package, the markup from
   * rehype-katex's own katex. When their versions drift, the class names
   * differ (0.18 renamed `sizing` to `katex-sizing`): exponents and
   * fractions lose their smaller size and overlap.
   */
  it("uses a KaTeX stylesheet that styles the sizes of the rendered markup", () => {
    const { container } = render(
      <MarkdownContent content="$\frac{5^{2}}{15^{2}}$" />
    );
    const stylesheet = readFileSync(
      createRequire(import.meta.url).resolve("katex/dist/katex.min.css"),
      "utf8"
    );

    const sized = [...container.querySelectorAll("[class*=reset-size]")];
    expect(sized.length).toBeGreaterThan(0);
    for (const element of sized) {
      const selector = `.${[...element.classList].filter((name) => name !== "mtight").join(".")}`;
      expect(stylesheet).toContain(selector);
    }
  });
});
