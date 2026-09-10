import rehypeKatex from "rehype-katex";
import Markdown from "react-markdown";
import remarkMath from "remark-math";
import remarkCompactMathNotation from "../lib/compact-math-notation";
import { normalizeMarkdownImageSpacing } from "../lib/markdown-images";

export default function WritingMarkdown({ children }: { children: string }) {
  return (
    <div className="writing-body">
      <Markdown
        remarkPlugins={[remarkMath, remarkCompactMathNotation]}
        rehypePlugins={[rehypeKatex]}
      >
        {normalizeMarkdownImageSpacing(children)}
      </Markdown>
    </div>
  );
}
