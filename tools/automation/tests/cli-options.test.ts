import { describe, expect, it } from "vitest";

import { parseCliOptions } from "../src/cli.ts";

function extract(options: ReturnType<typeof parseCliOptions>) {
  return {
    mode: options.mode,
    offline: options.offline,
    fallbackToCache: options.fallbackToCache,
    baseUrl: options.baseUrl,
  };
}

describe("parseCliOptions", () => {
  it("defaults to ci mode with undefined boolean flags", () => {
    const result = parseCliOptions([]);
    expect(extract(result)).toEqual({
      mode: "ci",
      offline: undefined,
      fallbackToCache: undefined,
      baseUrl: undefined,
    });
  });

  it("parses explicit full mode and enables fallback when requested", () => {
    const result = parseCliOptions(["--mode=full", "--fallback-to-cache"]);
    expect(result.mode).toBe("full");
    expect(result.fallbackToCache).toBe(true);
  });

  it("accepts --no-fallback-to-cache to disable cache reuse", () => {
    const result = parseCliOptions(["--mode", "full", "--no-fallback-to-cache"]);
    expect(result.mode).toBe("full");
    expect(result.fallbackToCache).toBe(false);
  });

  it("accepts --fallback-to-cache=false syntax", () => {
    const result = parseCliOptions(["--mode", "full", "--fallback-to-cache=false"]);
    expect(result.fallbackToCache).toBe(false);
  });

  it("accepts spaced boolean values", () => {
    const result = parseCliOptions(["--mode", "full", "--fallback-to-cache", "false"]);
    expect(result.fallbackToCache).toBe(false);
  });

  it("fails on invalid boolean literals", () => {
    expect(() => parseCliOptions(["--fallback-to-cache=maybe"])).toThrow("Invalid boolean value: maybe");
  });
});
