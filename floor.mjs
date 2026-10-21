// One floorplan source for every zoom level of the Panther Lake figure.
// The compute tile (L2 units) and one Cougar Cove P-core (L3 units) are listed
// once; the package view draws the tile plan scaled down and the tile view
// draws the core plan scaled down, so each block lands where the next zoom
// level draws it in full. Positions are simplified from published annotated
// die shots; sizes of structures come from Intel's disclosures.

// ---- compute tile, L2 units: 14.32 × 8.04 mm drawn 200 × 112.3
export const TILE = { x: -100, y: -56.15, w: 200, d: 112.3, r: 1.2 };
export const TILE_H = 7;
export const PCORES = [
  { x: -97, y: 13, w: 28, d: 40 },
  { x: -66, y: 13, w: 28, d: 40 },
  { x: 37, y: 13, w: 28, d: 40 },
  { x: 68, y: 13, w: 28, d: 40 },
];
export const ECLUSTERS = [
  { x: -35, y: 13, w: 33, d: 40 },
  { x: 1, y: 13, w: 33, d: 40 },
];
// six L3 slices, one per ring stop, 18 MB in all
export const SLICES = [...PCORES.slice(0, 2), ...ECLUSTERS, ...PCORES.slice(2)]
  .sort((a, b) => a.x - b.x)
  .map((c) => ({ x: c.x, y: -3, w: c.w, d: 13 }));
export const RING = { x: -97, y: -11, w: 193, d: 5, r: 2.5 };
export const UNCORE = [
  { id: "phy", x: -97, y: -53, w: 115, d: 8, h: 0.9, domain: "mem" },
  { id: "msc", x: -97, y: -42, w: 47, d: 28, h: 1.5, domain: "cache" },
  { id: "media", x: -47, y: -42, w: 27, d: 28, h: 1.3, domain: "media" },
  { id: "display", x: -17, y: -42, w: 35, d: 28, h: 1.3, domain: "media" },
  { id: "lpe", x: 22, y: -53, w: 25, d: 39, h: 1.3, domain: "lpe" },
  { id: "npu", x: 50, y: -53, w: 47, d: 39, h: 1.6, domain: "npu" },
];
export const CORE_H = 1.3;

// ---- one Cougar Cove P-core, L3 units: 140 × 200 (28 × 40 on the tile)
export const CORE = { x: -70, y: -100, w: 140, d: 200, r: 2 };
export const CORE_SCALE = 28 / 140;
// Pipeline order runs from the back (front end) to the front (L2).
export const UNITS = {
  bpu: { x: -66, y: -96, w: 38, d: 22, h: 5, domain: "fe" },
  icache: { x: -24, y: -96, w: 46, d: 22, h: 5, domain: "fe" },
  uopc: { x: 26, y: -96, w: 40, d: 38, h: 5, domain: "fe" },
  decode: { x: -66, y: -70, w: 88, d: 12, h: 4, domain: "fe" },
  queue: { x: -66, y: -54, w: 132, d: 8, h: 3, domain: "fe" },
  rename: { x: -66, y: -42, w: 36, d: 16, h: 5, domain: "ooo" },
  rob: { x: -26, y: -42, w: 92, d: 16, h: 5, domain: "ooo" },
  isched: { x: -66, y: -22, w: 62, d: 15, h: 4, domain: "int" },
  vsched: { x: 0, y: -22, w: 30, d: 15, h: 4, domain: "vec" },
  msched: { x: 34, y: -22, w: 32, d: 15, h: 4, domain: "mem" },
  iports: { x: -66, y: -3, w: 62, d: 16, h: 3, domain: "int" },
  vports: { x: 0, y: -3, w: 30, d: 16, h: 3, domain: "vec" },
  mports: { x: 34, y: -3, w: 32, d: 16, h: 3, domain: "mem" },
  irf: { x: -66, y: 17, w: 62, d: 13, h: 4, domain: "int" },
  vrf: { x: 0, y: 17, w: 30, d: 13, h: 4, domain: "vec" },
  sbuf: { x: 34, y: 17, w: 32, d: 13, h: 4, domain: "mem" },
  dtlb: { x: -66, y: 34, w: 56, d: 20, h: 4, domain: "mem" },
  l0: { x: -6, y: 34, w: 72, d: 20, h: 5, domain: "cache" },
  l1: { x: -66, y: 58, w: 132, d: 18, h: 4, domain: "cache" },
  l2: { x: -66, y: 80, w: 132, d: 17, h: 4, domain: "cache" },
};
// execution ports, one pad each (18 in all with the two store-data ports folded into the store AGUs)
export const PORT_PADS = {
  int: Array.from({ length: 6 }, (_, i) => ({ x: -64 + i * 10, y: -1, w: 8, d: 12 })),
  vec: Array.from({ length: 4 }, (_, i) => ({ x: 2 + i * 7, y: -1, w: 5.6, d: 12 })),
  load: Array.from({ length: 3 }, (_, i) => ({ x: 36 + i * 10, y: -1, w: 8, d: 5.4 })),
  store: Array.from({ length: 3 }, (_, i) => ({ x: 36 + i * 10, y: 5.6, w: 8, d: 5.4 })),
};
const row = (n, x0, x1, y, z) => Array.from({ length: n }, (_, i) => [x0 + ((x1 - x0) * (i + 0.5)) / n, y, z]);
const grid = (cols, rows, x0, x1, y0, y1, z) => {
  const out = [];
  for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) out.push([x0 + ((x1 - x0) * (c + 0.5)) / cols, y0 + ((y1 - y0) * (r + 0.5)) / rows, z]);
  return out;
};
// where a uop token sits in each stage (world points on the block tops)
export const SLOTS = {
  fetch: row(8, -22, 20, -79, 5.4),
  decode: row(8, -66, 22, -64, 4.4),
  queue: row(16, -66, 66, -50, 3.4),
  rename: grid(4, 2, -66, -30, -42, -26, 5.4),
  rob: grid(16, 2, -26, 66, -42, -26, 5.4),
  isched: grid(8, 2, -66, -4, -22, -7, 4.4),
  vsched: grid(2, 2, 0, 30, -22, -7, 4.4),
  msched: grid(3, 2, 34, 66, -22, -7, 4.4),
  int: PORT_PADS.int.map((p) => [p.x + p.w / 2, p.y + p.d / 2, 4.1]),
  vec: PORT_PADS.vec.map((p) => [p.x + p.w / 2, p.y + p.d / 2, 4.1]),
  load: PORT_PADS.load.map((p) => [p.x + p.w / 2, p.y + p.d / 2, 4.1]),
  store: PORT_PADS.store.map((p) => [p.x + p.w / 2, p.y + p.d / 2, 4.1]),
  L0: row(3, -2, 62, 44, 5.4),
  L1: row(3, -40, 40, 67, 4.4),
};
