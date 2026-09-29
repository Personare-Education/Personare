/**
 * AIs (Gemini in particular) often write LaTeX with the \(...\) and \[...\]
 * delimiters, which remark-math does not understand: rendered as-is they show
 * up as raw LaTeX source. Rewrites them to the $...$/$$...$$ delimiters
 * KaTeX renders, leaving code blocks and inline code untouched.
 */

const CODE_SEGMENT = /(```[\s\S]*?(?:```|$)|`[^`\n]*`)/;
const DISPLAY_MATH = /\\\[([\s\S]+?)\\\]/g;
const INLINE_MATH = /\\\(([\s\S]+?)\\\)/g;

export function normalizeMathDelimiters(markdown: string): string {
  return markdown
    .split(CODE_SEGMENT)
    .map((segment, index) =>
      // split() with a capture group puts the code segments at odd indexes.
      index % 2 === 1
        ? segment
        : segment
            .replace(
              DISPLAY_MATH,
              (_, math: string) => `\n$$\n${math.trim()}\n$$\n`
            )
            .replace(INLINE_MATH, (_, math: string) => `$${math.trim()}$`)
    )
    .join("");
}
