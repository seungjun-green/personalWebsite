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

export function normalizeMarkdownImageSpacing(content: string) {
  const tokens = tokenizeMarkdownImages(content);
  if (!tokens.some((token) => token.type === "image")) return content;

  let normalized = "";
  let followsImage = false;

  for (const token of tokens) {
    if (token.type === "image") {
      normalized = normalized
        .replace(/[ \t]+$/, "")
        .replace(/(?:\n[ \t]*)+$/, "");
      if (normalized) normalized += "\n\n";
      normalized += token.raw;
      followsImage = true;
      continue;
    }

    if (!followsImage) {
      normalized += token.value;
      continue;
    }

    const withoutLeadingBreaks = token.value.replace(/^(?:[ \t]*\n)*/, "");
    normalized += `\n\n${withoutLeadingBreaks}`;
    followsImage = false;
  }

  return normalized;
}

export function removeMarkdownImage(
  content: string,
  start: number,
  end: number,
  targetOffset = start,
) {
  const rawBefore = content.slice(0, start);
  const rawAfter = content.slice(end);
  const before = rawBefore
    .replace(/[ \t]+$/, "")
    .replace(/(?:\n[ \t]*)+$/, "");
  const after = rawAfter.replace(/^(?:[ \t]*\n)+/, "");
  const separator = before && after ? "\n\n" : "";

  let mappedOffset: number;
  if (targetOffset <= start) {
    mappedOffset = Math.min(targetOffset, before.length);
  } else {
    const afterOffset = targetOffset - end;
    const removedAfter = rawAfter.length - after.length;
    mappedOffset =
      before.length +
      separator.length +
      Math.max(0, afterOffset - removedAfter);
  }

  const next = before + separator + after;
  return {
    content: next,
    offset: Math.min(Math.max(mappedOffset, 0), next.length),
  };
}
