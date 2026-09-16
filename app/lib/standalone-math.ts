import type { Root } from "mdast";
import { visit } from "unist-util-visit";

// Markdown may parse a standalone $...$ or $$...$$ as inline math.
// Promote it only when the paragraph contains no other visible content.
export default function remarkStandaloneMath() {
  return (tree: Root) => {
    visit(tree, "paragraph", (paragraph) => {
      const content = paragraph.children.filter(
        (child) => child.type !== "text" || child.value.trim() !== "",
      );
      if (content.length !== 1 || content[0].type !== "inlineMath") return;

      const math = content[0];
      math.data = {
        ...math.data,
        hProperties: { ...math.data?.hProperties, className: ["math-display"] },
      };
    });
  };
}
