import assert from "node:assert/strict";

import { parseScraperCliArgs } from "../src/cli-options.ts";

type TestCase = {
  name: string;
  run: () => void;
};

const cases: TestCase[] = [
  {
    name: "returns empty options when no overrides provided",
    run: () => {
      assert.deepEqual(parseScraperCliArgs([], {} as NodeJS.ProcessEnv), {});
    },
  },
  {
    name: "prefers explicit --base-url flag over environment value",
    run: () => {
      const result = parseScraperCliArgs(["--base-url", "https://example.test/api"], {
        SCRAPER_BASE_URL: "https://ignored.example",
      } as NodeJS.ProcessEnv);
      assert.deepEqual(result, { baseUrl: "https://example.test/api" });
    },
  },
  {
    name: "trims explicit base URL values",
    run: () => {
      const result = parseScraperCliArgs(["--base-url", "  https://trimmed.test  "], process.env);
      assert.deepEqual(result, { baseUrl: "https://trimmed.test" });
    },
  },
  {
    name: "reads SCRAPER_BASE_URL from the environment when flag absent",
    run: () => {
      const result = parseScraperCliArgs([], {
        SCRAPER_BASE_URL: "https://env.test",
      } as NodeJS.ProcessEnv);
      assert.deepEqual(result, { baseUrl: "https://env.test" });
    },
  },
  {
    name: "ignores blank environment overrides",
    run: () => {
      const result = parseScraperCliArgs([], {
        SCRAPER_BASE_URL: "  ",
      } as NodeJS.ProcessEnv);
      assert.deepEqual(result, {});
    },
  },
  {
    name: "throws when --base-url is provided without a value",
    run: () => {
      assert.throws(
        () => parseScraperCliArgs(["--base-url", "   "], process.env),
        /Option "--base-url" requires a non-empty value\./
      );
    },
  },
];

let failed = false;
for (const testCase of cases) {
  try {
    testCase.run();
    process.stdout.write(`✓ ${testCase.name}\n`);
  } catch (error) {
    failed = true;
    process.stderr.write(`✗ ${testCase.name}\n`);
    if (error instanceof Error) {
      process.stderr.write(`${error.message}\n`);
    }
  }
}

if (failed) {
  process.exitCode = 1;
}
