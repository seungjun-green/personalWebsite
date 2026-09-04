import rehypeKatex from "rehype-katex";
import Markdown from "react-markdown";
import remarkMath from "remark-math";

export default function WritingMarkdown({ children }: { children: string }) {
  return (
    <div className="writing-body">
      <Markdown remarkPlugins={[remarkMath]} rehypePlugins={[rehypeKatex]}>
        {children}
      </Markdown>
    </div>
  );
}
