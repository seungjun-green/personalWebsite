import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const readFile = vi.hoisted(() => vi.fn());
vi.mock("../../../lib/published-writing", () => ({ readPublishedWritingFile: readFile }));
import { GET } from "./route";

const revision = "a".repeat(40);
function request(overrides: Record<string, string> = {}) {
  const query = new URLSearchParams({ group: "notes", slug: "new-post", filename: "chart.png", ref: revision, ...overrides });
  return new Request(`https://example.com/api/writing/image?${query}`);
}

describe("images before deployment", () => {
  beforeEach(() => { readFile.mockReset(); vi.stubEnv("GITHUB_CONTENT_PAT", "test-token"); });
  afterEach(() => { vi.unstubAllEnvs(); });

  it("serves the image bytes from the same published commit", async () => {
    const bytes = new Uint8Array([137, 80, 78, 71]);
    readFile.mockResolvedValue(new Response(bytes));
    const response = await GET(request());
    expect(readFile).toHaveBeenCalledWith("public/writing/notes/new-post/chart.png", revision);
    expect(response.headers.get("Content-Type")).toBe("image/png");
    expect(response.headers.get("Cache-Control")).toContain("immutable");
    expect(new Uint8Array(await response.arrayBuffer())).toEqual(bytes);
  });

  it.each<Record<string, string>>([{ group: ".." }, { filename: "../../.env" }, { filename: "script.svg" }, { ref: "main" }])(
    "rejects invalid image requests: %o", async (overrides) => {
      expect((await GET(request(overrides))).status).toBe(404);
      expect(readFile).not.toHaveBeenCalled();
    },
  );

  it("does not cache missing images or temporary upstream failures", async () => {
    readFile.mockResolvedValueOnce(new Response(null, { status: 404 }));
    const missing = await GET(request());
    expect(missing.status).toBe(404);
    expect(missing.headers.get("Cache-Control")).toBe("no-store");
    readFile.mockRejectedValueOnce(new Error("GitHub unavailable"));
    const unavailable = await GET(request());
    expect(unavailable.status).toBe(503);
    expect(unavailable.headers.get("Cache-Control")).toBe("no-store");
  });
});
