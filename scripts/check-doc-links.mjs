#!/usr/bin/env node
/**
 * Simple Markdown link checker for this repo.
 * - Scans all tracked *.md files
 * - Validates local relative links point to existing files
 * - Validates external links return 2xx/3xx (tolerates 405 on HEAD)
 */
import { execSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { setTimeout as delay } from "node:timers/promises";

const mdFiles = execSync('git ls-files -- "*.md"', { encoding: "utf8" })
  .split("\n")
  .map((s) => s.trim())
  .filter(Boolean);

const linkRe = /\[([^\]]+)\]\(([^)]+)\)/g;

/** Fetch with HEAD, fallback to GET for 405, with small timeout */
async function checkExternal(url) {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), 10_000);
  try {
    let res = await fetch(url, { method: "HEAD", redirect: "manual", signal: ctrl.signal });
    if (res.status === 405) {
      res = await fetch(url, {
        method: "GET",
        headers: { Range: "bytes=0-0" },
        redirect: "manual",
        signal: ctrl.signal,
      });
    }
    return res.status >= 200 && res.status < 400;
  } catch {
    return false;
  } finally {
    clearTimeout(t);
  }
}

const errors = [];

for (const file of mdFiles) {
  const baseDir = dirname(file);
  const content = readFileSync(file, "utf8");
  for (const m of content.matchAll(linkRe)) {
    const raw = m[2].trim();
    if (raw.startsWith("mailto:") || raw.startsWith("#")) continue;
    if (/^https?:\/\//i.test(raw)) {
      // External URL
      // eslint-disable-next-line no-await-in-loop
      const ok = await checkExternal(raw);
      if (!ok) errors.push({ file, link: raw, type: "external" });
      // Be nice to hosts
      // eslint-disable-next-line no-await-in-loop
      await delay(50);
      continue;
    }
    // Local path (possibly with anchor)
    const path = raw.split("#")[0];
    const resolved = join(baseDir, path);
    if (!existsSync(resolved)) {
      errors.push({ file, link: raw, type: "local" });
    }
  }
}

if (errors.length) {
  console.error("Broken links found:");
  for (const e of errors) console.error(`- [${e.type}] ${e.file} -> ${e.link}`);
  process.exit(1);
} else {
  console.log("All Markdown links look good.");
}
