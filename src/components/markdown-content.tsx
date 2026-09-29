import "katex/dist/katex.min.css";
import ReactMarkdown from "react-markdown";
import rehypeKatex from "rehype-katex";
import remarkMath from "remark-math";
import { normalizeMathDelimiters } from "@/utils/math-delimiters";
import { cn } from "@/utils/tailwind";

interface MarkdownContentProps {
  className?: string;
  content: string;
}

export default function MarkdownContent({
  className,
  content,
}: MarkdownContentProps) {
  return (
    <div className={cn("text-sm", className)}>
      <ReactMarkdown rehypePlugins={[rehypeKatex]} remarkPlugins={[remarkMath]}>
        {normalizeMathDelimiters(content)}
      </ReactMarkdown>
    </div>
  );
}
