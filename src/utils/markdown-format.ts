/**
 * The MarkdownComposer toolbar's formats (docs/specs/quiz-question-single-editor.md
 * AC-2), as pure transforms of the textarea's text and selection. The
 * returned selection is what the textarea selects afterwards.
 */

export type MarkdownFormat =
  | "bold"
  | "code"
  | "heading"
  | "italic"
  | "link"
  | "orderedList"
  | "quote"
  | "unorderedList";

export interface TextSelection {
  end: number;
  start: number;
  value: string;
}

function wrap(
  { end, start, value }: TextSelection,
  before: string,
  after: string
): TextSelection {
  const selected = value.slice(start, end);

  return {
    end: start + before.length + selected.length,
    start: start + before.length,
    value: `${value.slice(0, start)}${before}${selected}${after}${value.slice(end)}`,
  };
}

/** Prefixes every line the selection touches; prefix(i) gets the line's index. */
function prefixLines(
  { end, start, value }: TextSelection,
  prefix: (index: number) => string
): TextSelection {
  const lineStart = value.lastIndexOf("\n", start - 1) + 1;
  const nextBreak = value.indexOf("\n", end);
  const lineEnd = nextBreak === -1 ? value.length : nextBreak;
  const lines = value
    .slice(lineStart, lineEnd)
    .split("\n")
    .map((line, index) => `${prefix(index)}${line}`)
    .join("\n");

  return {
    end: lineStart + lines.length,
    start: start === end ? lineStart + lines.length : lineStart,
    value: `${value.slice(0, lineStart)}${lines}${value.slice(lineEnd)}`,
  };
}

export function applyMarkdownFormat(
  selection: TextSelection,
  format: MarkdownFormat
): TextSelection {
  switch (format) {
    case "bold":
      return wrap(selection, "**", "**");
    case "italic":
      return wrap(selection, "_", "_");
    case "code":
      return selection.value
        .slice(selection.start, selection.end)
        .includes("\n")
        ? wrap(selection, "```\n", "\n```")
        : wrap(selection, "`", "`");
    case "link": {
      const linked = wrap(selection, "[", "](url)");
      const urlStart = linked.end + 2;
      return { end: urlStart + 3, start: urlStart, value: linked.value };
    }
    case "heading":
      return prefixLines(selection, () => "### ");
    case "quote":
      return prefixLines(selection, () => "> ");
    case "unorderedList":
      return prefixLines(selection, () => "- ");
    case "orderedList":
      return prefixLines(selection, (index) => `${index + 1}. `);
    default:
      return selection;
  }
}
