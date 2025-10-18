import fs from "node:fs/promises";
import path from "node:path";

const [, , destinationArg] = process.argv;
const destination = destinationArg ?? path.join("app", "public", "openapi");

const sourceDir = path.resolve("var", "openapi");
const destinationDir = path.resolve(destination);

async function main() {
  try {
    await fs.access(sourceDir);
  } catch (_error) {
    console.warn(
      `[openapi-sync] Skipping copy: OpenAPI artifacts not found at ${path.relative(process.cwd(), sourceDir)}.`
    );
    return;
  }

  await fs.rm(destinationDir, { recursive: true, force: true });
  await fs.mkdir(destinationDir, { recursive: true });
  await fs.cp(sourceDir, destinationDir, { recursive: true });

  console.log(
    `[openapi-sync] Copied OpenAPI artifacts to ${path.relative(process.cwd(), destinationDir)}.`
  );
}

main().catch((error) => {
  console.error(`[openapi-sync] Failed to copy OpenAPI assets: ${error instanceof Error ? error.message : error}`);
  process.exitCode = 1;
});
