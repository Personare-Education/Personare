import { describe, expect, it } from "vitest";
import { applyMarkdownFormat } from "@/utils/markdown-format";

/**
 * RED phase (docs/specs/quiz-question-single-editor.md AC-2): the
 * MarkdownComposer's toolbar applies Markdown syntax to the textarea's
 * selection. Each format is a pure (text, selection) -> (text, selection)
 * transform; the returned selection is what the textarea selects afterwards.
 */

function apply(
  value: string,
  start: number,
  end: number,
  format: Parameters<typeof applyMarkdownFormat>[1]
) {
  return applyMarkdownFormat({ end, start, value }, format);
}

describe("applyMarkdownFormat", () => {
  it("wraps the selection in ** for bold and keeps the word selected", () => {
    expect(apply("a word here", 2, 6, "bold")).toEqual({
      end: 8,
      start: 4,
      value: "a **word** here",
    });
  });

  it("inserts empty bold markers at the cursor and places the cursor between them", () => {
    expect(apply("ab", 1, 1, "bold")).toEqual({
      end: 3,
      start: 3,
      value: "a****b",
    });
  });

  it("wraps the selection in _ for italic", () => {
    expect(apply("word", 0, 4, "italic").value).toBe("_word_");
  });

  it("wraps a single-line selection in backticks for code", () => {
    expect(apply("use x", 4, 5, "code").value).toBe("use `x`");
  });

  it("wraps a multi-line selection in a fenced code block", () => {
    expect(apply("a\nb", 0, 3, "code").value).toBe("```\na\nb\n```");
  });

  it("turns the selection into a link and selects the url placeholder", () => {
    const result = apply("see docs", 4, 8, "link");

    expect(result.value).toBe("see [docs](url)");
    expect(result.value.slice(result.start, result.end)).toBe("url");
  });

  it("prefixes the current line with ### for a heading", () => {
    expect(apply("one\ntwo", 5, 5, "heading").value).toBe("one\n### two");
  });

  it("prefixes every selected line for a quote", () => {
    expect(apply("one\ntwo", 0, 7, "quote").value).toBe("> one\n> two");
  });

  it("prefixes every selected line with - for an unordered list", () => {
    expect(apply("a\nb", 0, 3, "unorderedList").value).toBe("- a\n- b");
  });

  it("numbers every selected line for an ordered list", () => {
    expect(apply("a\nb\nc", 0, 5, "orderedList").value).toBe(
      "1. a\n2. b\n3. c"
    );
  });
});
