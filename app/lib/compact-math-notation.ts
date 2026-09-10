type MarkdownNode = {
  type: string;
  value?: string;
  children?: MarkdownNode[];
  data?: {
    hChildren?: MarkdownNode[];
    [key: string]: unknown;
  };
};

export function formatCompactMathNotation(value: string) {
  // No LaTeX rewriting: the transpose symbol (⊤) stays as `\top` so it
  // renders as the standard math glyph. Visual sizing for every super /
  // subscript is handled uniformly by `.writing-body .katex .msupsub` in
  // globals.css.
  return value;
}

export default function remarkCompactMathNotation() {
  return (tree: MarkdownNode) => {
    visit(tree);
  };
}

function visit(node: MarkdownNode) {
  if (node.type === "math" || node.type === "inlineMath") {
    if (typeof node.value === "string") {
      node.value = formatCompactMathNotation(node.value);
    }
    // mdast-util-math also stashes the raw LaTeX inside node.data.hChildren so
    // that remark-rehype (and thus rehype-katex) can render it. Mutating just
    // node.value is not enough — we have to keep the hast hint in sync.
    rewriteHastHint(node.data?.hChildren);
  }
  for (const child of node.children ?? []) visit(child);
}

function rewriteHastHint(nodes: MarkdownNode[] | undefined) {
  if (!nodes) return;
  for (const node of nodes) {
    if (node.type === "text" && typeof node.value === "string") {
      node.value = formatCompactMathNotation(node.value);
    }
    rewriteHastHint(node.children);
  }
}
