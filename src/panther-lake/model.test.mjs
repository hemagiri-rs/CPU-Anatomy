import assert from "node:assert/strict";
import { boot, cycle, runToHalt, N_VALUE } from "./model.mjs";

const end = runToHalt();
const sum = (N_VALUE * (N_VALUE + 1)) / 2;
assert.equal(end.halted, true);
assert.equal(end.mem[15], sum, "sum stored at [15]");
assert.deepEqual(end.regs, [sum, 0, 1, N_VALUE]);
assert.equal(end.flushes, 1, "one mispredict, at loop exit");
assert.equal(end.retired, 3 + N_VALUE * 4 + 2, "only real instructions retire");
// out of order: something issues while an older uop is still waiting
let s = boot(), overtook = false;
while (!s.halted) {
  s = cycle(s);
  const waiting = s.uops.filter((u) => u.stage === "sched").map((u) => u.id);
  if (s.events.some((e) => e.kind === "issue" && waiting.some((w) => w < e.id))) overtook = true;
}
assert.ok(overtook, "a younger uop issues before an older one");
console.log(`model ok · ${end.cycle} cycles · ${end.retired} retired · IPC ${(end.retired / end.cycle).toFixed(2)}`);
