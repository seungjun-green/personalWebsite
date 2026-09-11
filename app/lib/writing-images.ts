export const MAX_WRITING_IMAGE_BYTES = 4 * 1024 * 1024;

const IMAGE_EXTENSION = /\.(?:png|jpe?g|gif|webp)$/i;

const IMAGE_TYPE_ALIASES: Record<string, string> = {
  "image/png": "image/png",
  "image/x-png": "image/png",
  "image/jpeg": "image/jpeg",
  "image/jpg": "image/jpeg",
  "image/pjpeg": "image/jpeg",
  "image/gif": "image/gif",
  "image/webp": "image/webp",
};

export function normalizeWritingImageType(type: string) {
  return IMAGE_TYPE_ALIASES[type.toLowerCase()] ?? null;
}

export function isSupportedWritingImage(type: string, filename: string) {
  // Files dragged from Finder and images pasted from the clipboard are not
  // consistent about supplying both a MIME type and a filename extension.
  // Accept a reliable browser hint here; the server still verifies the bytes.
  if (normalizeWritingImageType(type) !== null) return true;
  const normalizedType = type.toLowerCase();
  if (normalizedType && normalizedType !== "application/octet-stream") {
    return false;
  }
  return IMAGE_EXTENSION.test(filename);
}

export function writingImageExtension(filename: string, type: string) {
  const match = filename.match(IMAGE_EXTENSION);
  if (match) return match[0].toLowerCase();
  const normalizedType = normalizeWritingImageType(type);
  if (normalizedType === "image/jpeg") return ".jpg";
  if (normalizedType === "image/webp") return ".webp";
  if (normalizedType === "image/gif") return ".gif";
  return ".png";
}

export function hasValidWritingImageSignature(
  bytes: Uint8Array,
  type: string,
) {
  const detectedType = detectWritingImageType(bytes);
  const declaredType = normalizeWritingImageType(type);
  return detectedType !== null && (!declaredType || detectedType === declaredType);
}

export function detectWritingImageType(bytes: Uint8Array) {
  if (startsWith(bytes, [137, 80, 78, 71, 13, 10, 26, 10])) {
    return "image/png";
  }
  if (startsWith(bytes, [0xff, 0xd8, 0xff])) return "image/jpeg";
  if (
    startsWith(bytes, [71, 73, 70, 56, 55, 97]) ||
    startsWith(bytes, [71, 73, 70, 56, 57, 97])
  ) {
    return "image/gif";
  }
  if (
    startsWith(bytes, [82, 73, 70, 70]) &&
    startsWith(bytes.subarray(8), [87, 69, 66, 80])
  ) {
    return "image/webp";
  }
  return null;
}

function startsWith(bytes: Uint8Array, signature: number[]) {
  return signature.every((value, index) => bytes[index] === value);
}
