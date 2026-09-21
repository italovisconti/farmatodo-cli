#!/usr/bin/env bun
import { runCLI } from "./cli";
import { renderTUI } from "./tui";

async function main() {
  const args = process.argv.slice(2);

  if (args.length === 0 || args[0] === "tui") {
    await renderTUI();
  } else {
    await runCLI(process.argv);
  }
}

main().catch((err) => {
  console.error("Fatal Error:", err);
  process.exit(1);
});
