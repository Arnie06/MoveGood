import { spawn } from "node:child_process";
import { createRequire } from "node:module";

import { bootstrapAddressDataset } from "@/lib/address-dataset-bootstrap";

const require = createRequire(import.meta.url);

async function main() {
  await bootstrapAddressDataset();

  const port = process.env.PORT?.trim() || "3000";
  const nextBin = require.resolve("next/dist/bin/next");
  const child = spawn(process.execPath, [nextBin, "start", "-H", "0.0.0.0", "-p", port], {
    stdio: "inherit",
    env: process.env
  });

  child.on("exit", (code, signal) => {
    if (signal) {
      process.kill(process.pid, signal);
      return;
    }

    process.exit(code ?? 0);
  });
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
