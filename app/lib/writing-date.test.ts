import { describe, expect, it } from "vitest";
import { currentWritingDate } from "./writing-date";

describe("currentWritingDate", () => {
  it("uses the configured writing timezone instead of UTC", () => {
    const instant = new Date("2026-09-10T16:30:00.000Z");

    expect(currentWritingDate(instant, "Asia/Seoul")).toBe("2026-09-11");
    expect(currentWritingDate(instant, "UTC")).toBe("2026-09-10");
  });
});
