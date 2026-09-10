import { describe, expect, it } from "vitest";
import {
  markdownImageUrls,
  normalizeMarkdownImageSpacing,
  removeMarkdownImage,
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

  it("collapses accumulated blank lines around images", () => {
    expect(
      normalizeMarkdownImageSpacing(
        "Before\n\n\n\n\n![Chart](/chart.png)\n\n\n\nAfter",
      ),
    ).toBe("Before\n\n![Chart](/chart.png)\n\nAfter");
  });

  it("removes an image together with its block separators", () => {
    expect(
      removeMarkdownImage(
        "Before\n\n![Chart](/chart.png)\n\nAfter",
        8,
        29,
      ).content,
    ).toBe("Before\n\nAfter");
  });

  it("maps a later insertion offset after removing an image block", () => {
    const content = "Before\n\n![Chart](/chart.png)\n\nAfter";
    expect(removeMarkdownImage(content, 8, 29, content.length)).toEqual({
      content: "Before\n\nAfter",
      offset: 13,
    });
  });
});
