export type MarkdownImageToken =
  | {
      type: "text";
      value: string;
      start: number;
      end: number;
    }
  | {
      type: "image";
      alt: string;
      url: string;
      raw: string;
      start: number;
      end: number;
    };

const MARKDOWN_IMAGE = /!\[([^\]]*)\]\(([^)\s]+)\)/g;

export function tokenizeMarkdownImages(content: string): MarkdownImageToken[] {
  const tokens: MarkdownImageToken[] = [];
  let cursor = 0;

  for (const match of content.matchAll(MARKDOWN_IMAGE)) {
    const start = match.index;
    const raw = match[0];
    tokens.push({
      type: "text",
      value: content.slice(cursor, start),
      start: cursor,
      end: start,
    });
    tokens.push({
      type: "image",
      alt: match[1],
      url: match[2],
      raw,
      start,
      end: start + raw.length,
    });
    cursor = start + raw.length;
  }

  tokens.push({
    type: "text",
    value: content.slice(cursor),
    start: cursor,
    end: content.length,
  });
  return tokens;
}

export function markdownImageUrls(content: string) {
  return tokenizeMarkdownImages(content)
    .filter((token) => token.type === "image")
    .map((token) => token.url);
}
