import rehypeKatex from "rehype-katex";
import Markdown from "react-markdown";
import remarkMath from "remark-math";
import { normalizeMarkdownImageSpacing } from "../lib/markdown-images";

export default function WritingMarkdown({ children }: { children: string }) {
  return (
    <div className="writing-body">
      <Markdown remarkPlugins={[remarkMath]} rehypePlugins={[rehypeKatex]}>
        {normalizeMarkdownImageSpacing(children)}
      </Markdown>
    </div>
  );
}
