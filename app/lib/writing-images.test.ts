import { describe, expect, it } from "vitest";
import {
  detectWritingImageType,
  hasValidWritingImageSignature,
  isSupportedWritingImage,
  writingImageExtension,
} from "./writing-images";

describe("writing images", () => {
  it("accepts either a supported MIME type or extension", () => {
    expect(isSupportedWritingImage("image/png", "chart.png")).toBe(true);
    expect(isSupportedWritingImage("", "chart.png")).toBe(true);
    expect(isSupportedWritingImage("image/png", "clipboard-image")).toBe(true);
    expect(isSupportedWritingImage("image/jpg", "photo")).toBe(true);
    expect(isSupportedWritingImage("image/svg+xml", "chart.svg")).toBe(false);
    expect(isSupportedWritingImage("text/html", "chart.png")).toBe(false);
  });

  it("derives a safe extension when the browser omits one", () => {
    expect(writingImageExtension("clipboard-image", "image/x-png")).toBe(".png");
    expect(writingImageExtension("clipboard-image", "image/jpg")).toBe(".jpg");
  });

  it("checks the file signature", () => {
    expect(
      hasValidWritingImageSignature(
        new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10]),
        "image/png",
      ),
    ).toBe(true);
    expect(
      hasValidWritingImageSignature(
        new Uint8Array([60, 115, 99, 114, 105, 112, 116, 62]),
        "image/png",
      ),
    ).toBe(false);
    expect(
      hasValidWritingImageSignature(
        new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10]),
        "",
      ),
    ).toBe(true);
    expect(
      detectWritingImageType(
        new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10]),
      ),
    ).toBe("image/png");
  });
});
