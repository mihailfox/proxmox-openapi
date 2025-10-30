import process from "node:process";

import { computeRegressionSummary } from "./summary.ts";

export function logRegressionReport(): void {
  const summary = computeRegressionSummary();

  process.stdout.write("\n=== QA regression summary ===\n");

  for (const artifact of summary.artifacts) {
    const status = artifact.matches ? "✅" : "❌";
    process.stdout.write(
      `${status} ${artifact.baseline.label}: ${artifact.actualSha256}\n    Expected: ${artifact.baseline.sha256}\n    Size: ${artifact.byteLength.toLocaleString("en-US")} bytes\n`
    );
  }

  process.stdout.write("\n--- Coverage summary ---\n");
  process.stdout.write(
    `Raw snapshot endpoints: ${summary.snapshotStats.endpointCount} (groups: ${summary.snapshotStats.rootGroupCount})\n`
  );
  process.stdout.write(
    `Normalized endpoints: ${summary.normalizedSummary.endpointCount}, methods: ${summary.normalizedSummary.methodCount}\n`
  );
  process.stdout.write(`OpenAPI operations: ${summary.openApiOperationCount}, tags: ${summary.tagCount}\n`);

  process.stdout.write("\n--- Parity checks ---\n");
  process.stdout.write(
    `${summary.parity.jsonMatchesYaml ? "✅" : "❌"} JSON and YAML OpenAPI documents are structurally identical\n`
  );
  process.stdout.write(
    `${summary.parity.methodCountMatches ? "✅" : "❌"} Operation counts match normalized method counts\n`
  );
}
