import { describe, expect, it } from "vitest";
import {
  isAllowedWritingOrigin,
  isAuthorizedGithubId,
} from "./app/lib/github-admin";

describe("GitHub admin allowlist", () => {
  it("authorizes only the owner's immutable numeric ID", () => {
    expect(isAuthorizedGithubId("60959924")).toBe(true);
    expect(isAuthorizedGithubId("seungjun-green")).toBe(false);
    expect(isAuthorizedGithubId("999")).toBe(false);
  });

  it("rejects missing and cross-site mutation origins in production", () => {
    const url = "https://site.example/api/writing";
    expect(isAllowedWritingOrigin(null, url, false)).toBe(false);
    expect(isAllowedWritingOrigin("https://evil.example", url, false)).toBe(false);
    expect(isAllowedWritingOrigin("https://site.example", url, false)).toBe(true);
  });
});
