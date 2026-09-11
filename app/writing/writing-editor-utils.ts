import {
  detectWritingImageType,
  isSupportedWritingImage,
  writingImageExtension,
} from "../lib/writing-images";

export function autosizeTextarea(
  element: HTMLTextAreaElement | null,
  minHeight: number,
) {
  if (!element) return;
  element.style.height = "auto";
  element.style.height = `${Math.max(element.scrollHeight, minHeight)}px`;
}

export function growTextarea(element: HTMLTextAreaElement, minHeight: number) {
  const nextHeight = Math.max(element.scrollHeight, minHeight);
  if (nextHeight > element.clientHeight) {
    element.style.height = `${nextHeight}px`;
  }
}

export function resizeTextareaWithoutCollapsing(
  element: HTMLTextAreaElement,
  minHeight: number,
) {
  const measurement = element.cloneNode() as HTMLTextAreaElement;
  measurement.value = element.value;
  measurement.setAttribute("aria-hidden", "true");
  measurement.tabIndex = -1;
  measurement.style.position = "fixed";
  measurement.style.left = "-10000px";
  measurement.style.top = "0";
  measurement.style.visibility = "hidden";
  measurement.style.pointerEvents = "none";
  measurement.style.width = `${element.getBoundingClientRect().width}px`;
  measurement.style.height = "auto";
  document.body.appendChild(measurement);
  const nextHeight = Math.max(measurement.scrollHeight, minHeight);
  measurement.remove();
  element.style.height = `${nextHeight}px`;
}

function createCaretTopMeasurer(textarea: HTMLTextAreaElement) {
  const style = getComputedStyle(textarea);
  const mirror = document.createElement("div");
  const text = document.createTextNode("");
  const marker = document.createElement("span");
  mirror.style.position = "fixed";
  mirror.style.left = "-10000px";
  mirror.style.top = "0";
  mirror.style.visibility = "hidden";
  mirror.style.boxSizing = style.boxSizing;
  mirror.style.width = `${textarea.getBoundingClientRect().width}px`;
  mirror.style.padding = style.padding;
  mirror.style.border = style.border;
  mirror.style.font = style.font;
  mirror.style.letterSpacing = style.letterSpacing;
  mirror.style.lineHeight = style.lineHeight;
  mirror.style.whiteSpace = "pre-wrap";
  mirror.style.overflowWrap = "break-word";
  mirror.style.wordBreak = style.wordBreak;
  marker.textContent = "\u200b";
  mirror.append(text, marker);
  document.body.appendChild(mirror);

  return {
    top(offset: number) {
      text.data = textarea.value.slice(0, offset);
      return marker.getBoundingClientRect().top - mirror.getBoundingClientRect().top;
    },
    remove() {
      mirror.remove();
    },
  };
}

export function textareaDropOffsetAt(
  textarea: HTMLTextAreaElement,
  clientY: number,
) {
  const rect = textarea.getBoundingClientRect();
  const style = getComputedStyle(textarea);
  const lineHeight =
    parseFloat(style.lineHeight) || parseFloat(style.fontSize) * 1.7 || 24;
  const targetTop = Math.max(0, clientY - rect.top - lineHeight / 2);
  const measurer = createCaretTopMeasurer(textarea);

  try {
    let low = 0;
    let high = textarea.value.length;
    while (low < high) {
      const middle = Math.floor((low + high) / 2);
      if (measurer.top(middle) < targetTop) low = middle + 1;
      else high = middle;
    }

    const approximate = low;
    const lineStart = textarea.value.lastIndexOf("\n", approximate - 1) + 1;
    const nextBreak = textarea.value.indexOf("\n", approximate);
    const lineEnd = nextBreak === -1 ? textarea.value.length : nextBreak + 1;
    const startTop = measurer.top(lineStart);
    const endTop =
      lineEnd === textarea.value.length
        ? measurer.top(lineEnd) + lineHeight
        : measurer.top(lineEnd);

    return clientY - rect.top < (startTop + endTop) / 2 ? lineStart : lineEnd;
  } finally {
    measurer.remove();
  }
}

export function isSupportedImageFile(file: File) {
  return isSupportedWritingImage(file.type, file.name);
}

export async function supportedImageFiles(files: FileList | File[]) {
  const supported = await Promise.all(
    Array.from(files).map(async (file) => {
      if (isSupportedImageFile(file)) return file;
      try {
        const header = new Uint8Array(await file.slice(0, 12).arrayBuffer());
        return detectWritingImageType(header) ? file : null;
      } catch {
        return null;
      }
    }),
  );
  return supported.filter((file): file is File => file !== null);
}

export function droppedFiles(dataTransfer: DataTransfer) {
  const itemFiles = Array.from(dataTransfer.items ?? [])
    .filter((item) => item.kind === "file")
    .map((item) => item.getAsFile())
    .filter((file): file is File => file !== null);
  return itemFiles.length ? itemFiles : Array.from(dataTransfer.files ?? []);
}

export function fileExtension(file: File) {
  return writingImageExtension(file.name, file.type);
}
