import { describe, expect, it } from "vitest";
import { assertWritingSegment, isWritingSegment } from "./slug";

describe("writing path segments", () => {
  it("accepts slug-shaped path segments", () => {
    expect(isWritingSegment("paper-summary-2")).toBe(true);
    expect(() => assertWritingSegment("paper-summary-2", "group")).not.toThrow();
  });

  it("rejects traversal and nested paths", () => {
    for (const value of ["../outside", "nested/path", "..", "UPPERCASE"]) {
      expect(isWritingSegment(value)).toBe(false);
      expect(() => assertWritingSegment(value, "group")).toThrow("Invalid group.");
    }
  });
});
