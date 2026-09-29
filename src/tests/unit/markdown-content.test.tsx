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
});
