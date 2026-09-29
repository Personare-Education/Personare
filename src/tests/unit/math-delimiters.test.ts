import { describe, expect, it } from "vitest";
import { normalizeMathDelimiters } from "@/utils/math-delimiters";

describe("normalizeMathDelimiters", () => {
  it("rewrites \\(...\\) to $...$", () => {
    expect(
      normalizeMathDelimiters(
        "\\(\\text{Problema} \\rightarrow \\text{Código}\\)"
      )
    ).toBe("$\\text{Problema} \\rightarrow \\text{Código}$");
  });

  it("rewrites \\[...\\] to a $$...$$ block", () => {
    expect(normalizeMathDelimiters("Veja: \\[x^2\\] fim")).toBe(
      "Veja: \n$$\nx^2\n$$\n fim"
    );
  });

  it("leaves $...$ and plain text untouched", () => {
    expect(normalizeMathDelimiters("Energy is $E=mc^2$ (really)")).toBe(
      "Energy is $E=mc^2$ (really)"
    );
  });

  it("leaves inline code and code blocks untouched", () => {
    const markdown = "`\\(a\\)` and\n```\n\\[b\\]\n```\n\\(c\\)";

    expect(normalizeMathDelimiters(markdown)).toBe(
      "`\\(a\\)` and\n```\n\\[b\\]\n```\n$c$"
    );
  });
});
