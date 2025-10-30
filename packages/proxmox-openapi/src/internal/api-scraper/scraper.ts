import { chromium } from "playwright";

import { countEndpoints, fetchApiScript, parseApiSchema, toRawTree } from "./extractor.ts";
import { registerCodexMock } from "./codex-mock.ts";
import { persistSnapshot, type PersistOptions } from "./persistence.ts";
import type { RawApiSnapshot } from "./types.ts";

export interface ScrapeOptions {
  baseUrl?: string;
  headless?: boolean;
  persist?: PersistOptions | false;
}

export const DEFAULT_BASE_URL = "https://pve.proxmox.com/pve-docs/api-viewer/";

export async function scrapeApiDocumentation(options: ScrapeOptions = {}): Promise<{
  snapshot: RawApiSnapshot;
  filePath?: string;
}> {
  const baseUrl = options.baseUrl ?? DEFAULT_BASE_URL;
  const browser = await chromium.launch({ headless: options.headless ?? true });
  const context = await browser.newContext({ ignoreHTTPSErrors: true });
  await registerCodexMock(context, baseUrl);
  const page = await context.newPage();

  try {
    await page.goto(baseUrl, { waitUntil: "networkidle" });
    const scriptSource = await fetchApiScript(page);
    const schemaNodes = parseApiSchema(scriptSource);
    const tree = toRawTree(schemaNodes);
    const endpointCount = countEndpoints(tree);
    const documentTitle = await page.title();
    const snapshot: RawApiSnapshot = {
      scrapedAt: new Date().toISOString(),
      sourceUrl: baseUrl,
      documentTitle,
      stats: {
        rootGroupCount: tree.length,
        endpointCount,
      },
      schema: tree,
    };

    const persistOptions = options.persist === false ? undefined : options.persist;
    if (persistOptions) {
      const filePath = await persistSnapshot(snapshot, persistOptions);
      return { snapshot, filePath };
    }

    return { snapshot };
  } finally {
    await context.close();
    await browser.close();
  }
}
