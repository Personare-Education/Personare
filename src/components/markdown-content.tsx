import "katex/dist/katex.min.css";
import ReactMarkdown, { type Components } from "react-markdown";
import rehypeKatex, { type Options as KatexOptions } from "rehype-katex";
import remarkMath from "remark-math";
import { normalizeMathDelimiters } from "@/utils/math-delimiters";
import { cn } from "@/utils/tailwind";

interface MarkdownContentProps {
  className?: string;
  content: string;
}

/**
 * Tailwind's preflight strips the browser's code styling, so code blocks and
 * inline code get their own. Inline code is the <code> not inside a <pre>.
 */
const components: Components = {
  code: ({ className, node: _node, ...props }) => (
    <code
      className={cn(
        "rounded bg-muted px-1 py-0.5 font-mono text-[0.9em] [pre_&]:bg-transparent [pre_&]:p-0",
        className
      )}
      {...props}
    />
  ),
  pre: ({ className, node: _node, ...props }) => (
    <pre
      className={cn(
        "my-2 overflow-x-auto whitespace-pre rounded-md border bg-muted p-3 font-mono text-xs leading-relaxed [scrollbar-color:var(--border)_transparent] [scrollbar-width:thin]",
        className
      )}
      {...props}
    />
  ),
};

/**
 * Inline, KaTeX shrinks a fraction's numerator and denominator, too small to
 * read in a quiz question. \dfrac keeps them at the text size.
 */
const katexOptions: KatexOptions = { macros: { "\\frac": "\\dfrac" } };

export default function MarkdownContent({
  className,
  content,
}: MarkdownContentProps) {
  return (
    <div className={cn("min-w-0 text-sm", className)}>
      <ReactMarkdown
        components={components}
        rehypePlugins={[[rehypeKatex, katexOptions]]}
        remarkPlugins={[remarkMath]}
      >
        {normalizeMathDelimiters(content)}
      </ReactMarkdown>
    </div>
  );
}
