import { describe, expect, it } from "vitest";
import {
  hasValidWritingImageSignature,
  isSupportedWritingImage,
} from "./writing-images";

describe("writing images", () => {
  it("requires an allowed MIME type and extension", () => {
    expect(isSupportedWritingImage("image/png", "chart.png")).toBe(true);
    expect(isSupportedWritingImage("image/svg+xml", "chart.svg")).toBe(false);
    expect(isSupportedWritingImage("text/html", "chart.png")).toBe(false);
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
  });
});
