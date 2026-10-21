// One floorplan source for the CCD and core zoom levels of the Ryzen figure.
// The CCD (L2 units) and one Zen 5 core (L3 units) are listed once; the CCD view
// draws the core plan scaled down, so every block lands where the core view draws
// it in full. Block positions are simplified from AMD's Zen 5 block diagram;
// structure sizes are AMD's Hot Chips 2024 figures.

// ---- one CCD, L2 units: 70.6 mm², drawn as 10.7 × 6.6 mm → 200 × 123.4
export const CCD = { x: -100, y: -61.7, w: 200, d: 123.4, r: 1.2 };
export const CCD_H = 6; // the compute die
export const GAP = 40; // drawn gap between the compute die and the cache die under it
export const VC_H = 6; // the 64 MB SRAM die
export const PHY = { x: -98, y: -58, w: 10, d: 116 };
// eight cores, four along each long edge; L2 sits on the edge facing the L3
export const CORES = [0, 1, 2, 3, 4, 5, 6, 7].map((i) => ({ x: -84 + (i % 4) * 46.2, y: i < 4 ? -59 : 19, w: 44.4, d: 40, flip: i >= 4 }));
// 32 MB of L3 in eight 4 MB slices down the middle
export const SLICES = [0, 1, 2, 3, 4, 5, 6, 7].map((i) => ({ x: -84 + (i % 4) * 46.2, y: i < 4 ? -17 : 1, w: 44.4, d: 16 }));
// the 64 MB die's SRAM banks: four columns, either side of a row of power vias
export const BANKS = [0, 1, 2, 3, 4, 5, 6, 7].map((i) => ({ x: -84 + (i % 4) * 46.2, y: i < 4 ? -58 : 3, w: 44.4, d: 55 }));
export const CORE_H = 1.4;

// ---- one Zen 5 core, L3 units: 177.6 × 160 (44.4 × 40 on the CCD)
export const CORE = { x: -88.8, y: -80, w: 177.6, d: 160, r: 2 };
export const CORE_SCALE = 44.4 / 177.6;
// Pipeline order runs from the back (branch predictor) to the front (L2).
export const UNITS = {
  bpu: { x: -86, y: -78, w: 54, d: 22, h: 5, domain: "fe" },
  l1i: { x: -28, y: -78, w: 40, d: 22, h: 5, domain: "fe" },
  opc: { x: 16, y: -78, w: 70, d: 22, h: 5, domain: "fe" },
  pipeA: { x: -86, y: -52, w: 84, d: 16, h: 4, domain: "fe" },
  pipeB: { x: 2, y: -52, w: 84, d: 16, h: 4, domain: "fe" },
  dispatch: { x: -86, y: -32, w: 172, d: 9, h: 3, domain: "ooo" },
  rename: { x: -86, y: -19, w: 34, d: 16, h: 5, domain: "ooo" },
  rob: { x: -48, y: -19, w: 74, d: 16, h: 5, domain: "ooo" },
  nsq: { x: 30, y: -19, w: 28, d: 16, h: 5, domain: "vec" },
  vren: { x: 62, y: -19, w: 24, d: 16, h: 5, domain: "vec" },
  alusch: { x: -86, y: 1, w: 60, d: 12, h: 4, domain: "int" },
  agusch: { x: -22, y: 1, w: 38, d: 12, h: 4, domain: "mem" },
  fpsch: { x: 20, y: 1, w: 66, d: 12, h: 4, domain: "vec" },
  alus: { x: -86, y: 17, w: 60, d: 14, h: 3, domain: "int" },
  agus: { x: -22, y: 17, w: 38, d: 14, h: 3, domain: "mem" },
  fpp: { x: 20, y: 17, w: 66, d: 14, h: 3, domain: "vec" },
  gpr: { x: -86, y: 35, w: 102, d: 12, h: 4, domain: "int" },
  vrf: { x: 20, y: 35, w: 66, d: 12, h: 4, domain: "vec" },
  lsq: { x: -86, y: 51, w: 40, d: 13, h: 4, domain: "mem" },
  dtlb: { x: -42, y: 51, w: 22, d: 13, h: 4, domain: "mem" },
  l1d: { x: -16, y: 51, w: 102, d: 13, h: 5, domain: "cache" },
  l2: { x: -86, y: 67, w: 172, d: 11, h: 4, domain: "cache" },
};
// one pad per execution pipe: 6 ALUs, 4 AGUs, and FMUL FMUL FADD FADD then two store-data pipes
const pads = (u, n, w, gap) => Array.from({ length: n }, (_, i) => ({ x: u.x + 2 + i * (w + gap), y: u.y + 2, w, d: u.d - 4 }));
export const PORT_PADS = {
  alu: pads(UNITS.alus, 6, 8.2, 1.4),
  agu: pads(UNITS.agus, 4, 7.4, 1.4),
  fp: pads(UNITS.fpp, 4, 9.6, 1.4),
  std: pads({ ...UNITS.fpp, x: UNITS.fpp.x + 44 }, 2, 8.6, 1.4),
};
// decoder slabs, four per pipe, and the eight dispatch slots
export const DECODERS = [UNITS.pipeA, UNITS.pipeB].map((u) => Array.from({ length: 4 }, (_, i) => ({ x: u.x + 3 + i * 20, y: u.y + 3, w: 18, d: u.d - 6 })));
export const SLOTS = Array.from({ length: 8 }, (_, i) => ({ x: UNITS.dispatch.x + 3 + i * 21, y: UNITS.dispatch.y + 1.8, w: 19, d: UNITS.dispatch.d - 3.6 }));
// the reorder buffer drawn as 2 × 28 cells of 8 entries each: 448
export const ROB_CELLS = Array.from({ length: 56 }, (_, i) => ({ x: UNITS.rob.x + 1.6 + (i % 28) * 2.56, y: UNITS.rob.y + 2 + Math.floor(i / 28) * 6.2, w: 2.0, d: 5.2 }));
