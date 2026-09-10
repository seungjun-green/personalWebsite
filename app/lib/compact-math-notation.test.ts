import { describe, expect, it } from "vitest";

import { formatCompactMathNotation } from "./compact-math-notation";

describe("compact math notation", () => {
  it("preserves the original LaTeX (visual sizing lives in CSS)", () => {
    expect(
      formatCompactMathNotation("(QW_{UK}^\\top)C_{KV}^{\\top}"),
    ).toBe("(QW_{UK}^\\top)C_{KV}^{\\top}");
  });

  it("does not mangle ordinary indices", () => {
    expect(formatCompactMathNotation("\\rho_{i,t}+A_i")).toBe(
      "\\rho_{i,t}+A_i",
    );
  });
});
