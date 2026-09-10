/* eslint-disable @next/next/no-img-element */

import rehypeKatex from "rehype-katex";
import Markdown from "react-markdown";
import remarkGfm from "remark-gfm";
import remarkMath from "remark-math";
import remarkCompactMathNotation from "../lib/compact-math-notation";
import { normalizeMarkdownImageSpacing } from "../lib/markdown-images";

export default function WritingMarkdown({
  children,
  imageSources,
}: {
  children: string;
  imageSources?: Record<string, string>;
}) {
  return (
    <div className="writing-body">
      <Markdown
        remarkPlugins={[remarkGfm, remarkMath, remarkCompactMathNotation]}
        rehypePlugins={[rehypeKatex]}
        components={{
          table: ({ children: tableChildren }) => (
            <div className="writing-table-scroll">
              <table>{tableChildren}</table>
            </div>
          ),
          img: ({ src, alt, ...props }) => (
            <img
              {...props}
              src={
                typeof src === "string"
                  ? imageSources?.[src] ?? src
                  : src
              }
              alt={alt ?? ""}
            />
          ),
        }}
      >
        {normalizeMarkdownImageSpacing(children)}
      </Markdown>
    </div>
  );
}
