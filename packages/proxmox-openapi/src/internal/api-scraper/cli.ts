import path from "node:path";
import process from "node:process";

import { isExecutedFromCli } from "../shared/module-paths.ts";
import { RAW_SNAPSHOT_CACHE_PATH } from "../shared/paths.ts";
import { parseScraperCliArgs } from "./cli-options.ts";
import { DEFAULT_BASE_URL, scrapeApiDocumentation } from "./scraper.ts";

async function runScraper(): Promise<void> {
  const options = parseScraperCliArgs(process.argv.slice(2), process.env);
  const outputDir = path.dirname(RAW_SNAPSHOT_CACHE_PATH);
  const { snapshot, filePath } = await scrapeApiDocumentation({
    baseUrl: options.baseUrl,
    persist: {
      outputDir,
    },
  });

  const summary = [
    `Scraped ${snapshot.stats.rootGroupCount} top-level groups`,
    `${snapshot.stats.endpointCount} documented endpoints`,
    `source: ${options.baseUrl ?? DEFAULT_BASE_URL}`,
  ].join(" | ");

  if (filePath) {
    console.log(`${summary} -> ${filePath}`);
  } else {
    console.log(summary);
  }
}

if (isExecutedFromCli(import.meta)) {
  runScraper().catch((error) => {
    console.error("Scraper execution failed:", error);
    process.exitCode = 1;
  });
}

export { runScraper };
