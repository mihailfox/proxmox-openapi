import { parseArgs } from "node:util";

export interface ScraperCliOptions {
  baseUrl?: string;
}

export function parseScraperCliArgs(argv: readonly string[], env: NodeJS.ProcessEnv): ScraperCliOptions {
  const { values } = parseArgs({
    args: Array.from(argv),
    options: {
      "base-url": { type: "string", short: "b" },
    },
    allowPositionals: false,
  });

  const rawBaseUrl = Array.isArray(values["base-url"])
    ? values["base-url"][values["base-url"].length - 1]
    : values["base-url"];

  if (typeof rawBaseUrl === "string") {
    const trimmed = rawBaseUrl.trim();
    if (trimmed === "") {
      throw new Error('Option "--base-url" requires a non-empty value.');
    }
    return { baseUrl: trimmed };
  }

  const envValue = env.SCRAPER_BASE_URL?.trim();
  if (envValue) {
    return { baseUrl: envValue };
  }

  return {};
}
