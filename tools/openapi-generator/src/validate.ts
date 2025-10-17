import path from "node:path";
import { parseArgs } from "node:util";
import SwaggerParser from "@apidevtools/swagger-parser";

import { OPENAPI_JSON_PATH } from "@proxmox-openapi/shared/paths.ts";

async function main(): Promise<void> {
  const { values } = parseArgs({
    options: {
      input: {
        type: "string",
        short: "i",
      },
    },
  });

  const inputPath = path.resolve(values.input ?? OPENAPI_JSON_PATH);

  await SwaggerParser.validate(inputPath);

  console.log(`Validated ${inputPath}`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
