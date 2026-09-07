import { describe, expect, it } from "vitest";
import {
  markdownImageUrls,
  normalizeMarkdownImageSpacing,
  tokenizeMarkdownImages,
} from "./markdown-images";

describe("Markdown images", () => {
  it("separates image syntax from editable text", () => {
    expect(
      tokenizeMarkdownImages(
        "Before\n\n![A chart](/writing/notes/post/chart.png)\n\nAfter",
      ),
    ).toEqual([
      { type: "text", value: "Before\n\n", start: 0, end: 8 },
      {
        type: "image",
        alt: "A chart",
        url: "/writing/notes/post/chart.png",
        raw: "![A chart](/writing/notes/post/chart.png)",
        start: 8,
        end: 49,
      },
      { type: "text", value: "\n\nAfter", start: 49, end: 56 },
    ]);
  });

  it("extracts all referenced image URLs", () => {
    expect(
      markdownImageUrls(
        "![One](/writing/a/one.png)\n![Two](https://example.com/two.png)",
      ),
    ).toEqual([
      "/writing/a/one.png",
      "https://example.com/two.png",
    ]);
  });

  it("puts images on their own Markdown blocks", () => {
    expect(
      normalizeMarkdownImageSpacing(
        "Text![Chart](/writing/notes/post/chart.png)## Next section",
      ),
    ).toBe(
      "Text\n\n![Chart](/writing/notes/post/chart.png)\n\n## Next section",
    );
  });

  it("preserves already separated image blocks", () => {
    const content =
      "Text\n\n![Chart](/writing/notes/post/chart.png)\n\n## Next section";
    expect(normalizeMarkdownImageSpacing(content)).toBe(content);
  });
});
