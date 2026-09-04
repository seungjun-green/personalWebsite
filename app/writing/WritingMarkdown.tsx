import Markdown from "react-markdown";

export default function WritingMarkdown({ children }: { children: string }) {
  return (
    <div className="writing-body">
      <Markdown>{children}</Markdown>
    </div>
  );
}
