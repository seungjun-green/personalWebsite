import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import WritingMarkdown from "./WritingMarkdown";

describe("WritingMarkdown", () => {
  it("renders inline and display LaTeX", () => {
    const html = renderToStaticMarkup(
      <WritingMarkdown>{"Inline $x^2$.\n\n$$\n\\int_0^1 x\\,dx\n$$"}</WritingMarkdown>,
    );
    expect(html).toContain("katex");
    expect(html).toContain("katex-display");
    expect(html).not.toContain("$$");
  });

  it("renders GitHub-flavored Markdown tables", () => {
    const html = renderToStaticMarkup(
      <WritingMarkdown>{`| Step | Shape | Complexity |
| --- | --- | --- |
| Q | $N,t,D$ | $O(t)$ |`}</WritingMarkdown>,
    );

    expect(html).toContain('class="writing-table-scroll"');
    expect(html).toContain("<table>");
    expect(html).toContain("<th>Step</th>");
    expect(html).toContain("katex");
  });
});
