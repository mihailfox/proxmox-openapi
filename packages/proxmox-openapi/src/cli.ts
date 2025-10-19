import process from "node:process";

import { runCli } from "./run-cli.js";

void runCli(process.argv).catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
