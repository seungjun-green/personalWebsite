export const MAX_WRITING_IMAGE_BYTES = 4 * 1024 * 1024;

const IMAGE_TYPES = new Set([
  "image/png",
  "image/jpeg",
  "image/gif",
  "image/webp",
]);
const IMAGE_EXTENSION = /\.(?:png|jpe?g|gif|webp)$/i;

export function isSupportedWritingImage(type: string, filename: string) {
  return IMAGE_TYPES.has(type.toLowerCase()) && IMAGE_EXTENSION.test(filename);
}

export function writingImageExtension(filename: string, type: string) {
  const match = filename.match(IMAGE_EXTENSION);
  if (match) return match[0].toLowerCase();
  if (type === "image/jpeg") return ".jpg";
  if (type === "image/webp") return ".webp";
  if (type === "image/gif") return ".gif";
  return ".png";
}

export function hasValidWritingImageSignature(
  bytes: Uint8Array,
  type: string,
) {
  if (type === "image/png") {
    return startsWith(bytes, [137, 80, 78, 71, 13, 10, 26, 10]);
  }
  if (type === "image/jpeg") {
    return startsWith(bytes, [0xff, 0xd8, 0xff]);
  }
  if (type === "image/gif") {
    return (
      startsWith(bytes, [71, 73, 70, 56, 55, 97]) ||
      startsWith(bytes, [71, 73, 70, 56, 57, 97])
    );
  }
  if (type === "image/webp") {
    return (
      startsWith(bytes, [82, 73, 70, 70]) &&
      startsWith(bytes.subarray(8), [87, 69, 66, 80])
    );
  }
  return false;
}

function startsWith(bytes: Uint8Array, signature: number[]) {
  return signature.every((value, index) => bytes[index] === value);
}
