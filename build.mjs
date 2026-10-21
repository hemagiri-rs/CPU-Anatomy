// Builds every tour (dark and light) into its site folder, then runs each tour's model check.
//   node build.mjs
import { execFileSync } from "node:child_process";
import { readdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const SRC = join(dirname(fileURLToPath(import.meta.url)), "src");
const tours = readdirSync(SRC).filter((d) => d !== "shared");
const run = (dir, ...args) => process.stdout.write(`${dir.padEnd(16)} ` + execFileSync("node", args, { cwd: join(SRC, dir), encoding: "utf8" }));
for (const tour of tours) {
  run(tour, "build.mjs");
  run(tour, "build.mjs", "--light");
  run(tour, "model.test.mjs");
}
