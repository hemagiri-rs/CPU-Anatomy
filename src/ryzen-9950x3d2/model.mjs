// The numbers behind the Ryzen 9 9950X3D2 tour, and the small models its demos run.
// Every figure is cited in sources.html. Pure: no DOM, so the page and the test share it.

export const CHIP = { cores: 16, threads: 32, ccds: 2, baseGHz: 4.3, boostGHz: 5.6, l2MB: 16, l3MB: 192, cacheMB: 208, tdpW: 200, pptW: 270 };
export const CORE = { pipes: 2, pipeWidth: 4, opCache: 6144, dispatch: 8, rob: 448, alu: 6, agu: 4, fp: 4, gpr: 240, vrf: 384, l1iKB: 32, l1dKB: 48, l2MB: 1, btb: 16384, ras: 52 };
// load-to-use latency: L1D and L2 in core cycles, DRAM in ns
export const LAT = { l1: 4, l2: 14, l3: 46, vcache: 4, dramNs: 70 };
export const L3_PLAIN = 32; // MB per CCD without V-Cache
export const L3_STACKED = 96; // 32 MB on the CCD + 64 MB on the die beneath it

// ---------------------------------------------------------------- the cache explorer
// One core reads uniformly at random across a working set of `ws` MB. With LRU
// replacement and that access pattern, a level holds its share of the set.
// L2 includes L1; L3 is a victim cache of L2, so their capacities add.
// ponytail: uniform random access is the worst case for caches; real games have
// hot spots that hit more often, so treat these shares as a floor.
export function memory(ws, l3MB = L3_STACKED, ghz = CHIP.boostGHz) {
  const upTo = (mb) => Math.min(1, mb / ws);
  const c1 = upTo(CORE.l1dKB / 1024), c2 = upTo(CORE.l2MB), c3 = upTo(CORE.l2MB + l3MB);
  const share = [c1, c2 - c1, c3 - c2, 1 - c3];
  const l3 = LAT.l3 + (l3MB > L3_PLAIN ? LAT.vcache : 0);
  const cyc = [LAT.l1, LAT.l2, l3, LAT.dramNs * ghz];
  const cycles = share.reduce((sum, s, i) => sum + s * cyc[i], 0);
  return { share, cycles, ns: cycles / ghz, cyc };
}
// which level serves a load, for a uniform u in [0, 1)
export function levelOf(share, u) {
  let acc = 0;
  for (let i = 0; i < share.length; i++) if (u < (acc += share[i])) return i;
  return share.length - 1;
}

// ---------------------------------------------------------------- the front end
// Two 4-wide fetch/decode pipes. A lone thread decodes on one pipe; with SMT each
// thread gets its own pipe. Dispatch takes up to 8 ops a cycle.
export const decodeRate = (threads) => Math.min(CORE.dispatch, threads * CORE.pipeWidth);

// ---------------------------------------------------------------- the execution engine
// A repeatable stream of issue patterns: each cycle some of the 6 ALUs, 4 AGUs and
// 4 FP pipes fire. Seeded, so every visit plays the same sequence.
export function rng(seed = 7) {
  let s = seed >>> 0;
  return () => ((s = (Math.imul(s, 1664525) + 1013904223) >>> 0) / 2 ** 32);
}
export function issueCycle(rand) {
  const pick = (n, p) => Array.from({ length: n }, () => rand() < p);
  return { alu: pick(CORE.alu, 0.62), agu: pick(CORE.agu, 0.5), fp: pick(CORE.fp, 0.38) };
}
