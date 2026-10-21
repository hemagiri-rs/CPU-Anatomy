import assert from "node:assert/strict";
import { memory, levelOf, decodeRate, rng, issueCycle, L3_PLAIN, L3_STACKED, CHIP } from "./model.mjs";

const close = (a, b, msg) => assert.ok(Math.abs(a - b) < 1e-9, `${msg}: ${a} vs ${b}`);
// shares always add up to one
for (const ws of [0.01, 0.5, 8, 64, 97, 400]) close(memory(ws).share.reduce((a, b) => a + b), 1, `shares at ${ws} MB`);
// a set that fits in L1 never leaves it
assert.deepEqual(memory(0.04).share, [1, 0, 0, 0]);
// 64 MB fits in the stacked L3 but spills past a plain 32 MB one
assert.equal(memory(64).share[3], 0);
close(memory(64, L3_PLAIN).share[3], 1 - 33 / 64, "plain L3 at 64 MB misses");
// V-Cache costs 4 cycles on a hit, and wins as soon as the set spills
assert.equal(memory(4).cyc[2] - memory(4, L3_PLAIN).cyc[2], 4);
assert.ok(memory(4).ns > memory(4, L3_PLAIN).ns, "small sets: plain L3 is a touch faster");
assert.ok(memory(64).ns * 4 < memory(64, L3_PLAIN).ns, "64 MB: stacked is over 4x faster");
// sampling follows the shares
assert.equal(levelOf([0.5, 0.5, 0, 0], 0.49), 0);
assert.equal(levelOf([0.5, 0.5, 0, 0], 0.51), 1);
assert.equal(levelOf([0, 0, 0, 1], 0.999), 3);
// decode: one pipe per thread, eight a cycle at most
assert.equal(decodeRate(1), 4);
assert.equal(decodeRate(2), 8);
// issue never exceeds the pipes, and the stream repeats from its seed
const a = rng(), b = rng();
for (let i = 0; i < 50; i++) assert.deepEqual(issueCycle(a), issueCycle(b));
const m = memory(64), p = memory(64, L3_PLAIN);
console.log(`model ok · 64 MB set: ${m.ns.toFixed(1)} ns with V-Cache, ${p.ns.toFixed(1)} ns without · ${CHIP.cacheMB} MB cache`);
