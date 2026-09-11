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
