export function slugify(value: string) {
  const slug = value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return slug || `post-${Date.now()}`;
}

export function isWritingSegment(value: string) {
  return /^[a-z0-9][a-z0-9-]*$/.test(value);
}

export function assertWritingSegment(value: string, label: string) {
  if (!isWritingSegment(value)) throw new Error(`Invalid ${label}.`);
}
