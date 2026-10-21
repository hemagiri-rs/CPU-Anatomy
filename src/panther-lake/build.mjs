import { readFileSync, writeFileSync } from "node:fs";
import { basename, dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import * as k from "../shared/iso-kit.mjs";
import { tools, centre, sortItems, unit, similarity } from "../shared/deck.mjs";
import * as F from "./floor.mjs";
import { PROGRAM, N_VALUE } from "./model.mjs";

const HERE = dirname(fileURLToPath(import.meta.url));
const kitScript = () => readFileSync(join(HERE, "../shared/iso-kit.mjs"), "utf8").replace(/^export /gm, "");
const theme = process.argv.includes("--light") ? "light" : "dark";
const W = 600;
const H = 440;
const AZ = 40;
const EL = 34;

// ---------------------------------------------------------------- L1 · laptop mainboard (1 unit = 0.25 mm)
const BOARD = { x: -270, y: -190, w: 540, d: 380, r: 10 };
const PKG = { x: -94, y: -56, w: 188, d: 112, r: 3 };
const PKG_Z = 1.6;
const PKG_TOP = 6.2;
const BASE = { x: -80, y: -36, w: 156, d: 72, r: 0.8 };
const BASE_TOP = 7.6;
const TILE_TOP = 10.6;
const COMPUTE = { x: -42, y: -16.1, w: 57.3, d: 32.2, r: 0.4 };
const GPU = { x: 20, y: -26, w: 52, d: 52, r: 0.4 };
const PCT = { x: -76, y: -32, w: 30, d: 64, r: 0.4 };
const FILLERS = [
  { x: -42, y: -32, w: 57.3, d: 13.4, r: 0.4 },
  { x: -42, y: 18.6, w: 57.3, d: 13.4, r: 0.4 },
  { x: 20, y: -32, w: 52, d: 4.6, r: 0.4 },
  { x: 20, y: 27.4, w: 52, d: 4.6, r: 0.4 },
];
const COLD = { x: -46, y: -30, w: 122, d: 60, r: 3 };
const COLD_TOP = 16;
const FINS = { x: 200, y: -70, w: 44, d: 130, r: 1 };
const FIN_TOP = 30;
const BLOWER = { x: 222, y: -112, r: 38, z: 2, top: 26 };
const PKG_LIFT = 30; // the package rides this high while the camera zooms into the compute tile

const P1 = k.fitProjection([...k.boxCorners(BOARD, -14, 0), [222, -150, 26 + 120], [-70, -30, 20 + 120]], W, H, { pad: 18, azimuth: AZ, elevation: EL });

function layer1() {
  const t = tools(P1);
  const { slab, cyl, line, dots, at, depth, outline } = t;
  const out = [];
  const put = (list, x, y, svg) => list.push({ key: depth(x, y), svg });
  // board on chassis standoffs
  out.push(t.halo(BOARD, -14, 14));
  for (const [x, y] of k.corners(BOARD, 16).sort((a, b) => depth(...a) - depth(...b))) out.push(cyl(x, y, 6, -14, 8, { tone: "lo" }));
  out.push(slab(BOARD, -6, 6, { tone: "lo", steps: 6, bevel: 1, inner: line(k.sideSeam(BOARD, -3, P1, 6), { tone: "faint" }) }));
  const holes = k.corners(BOARD, 16);
  out.push(line(holes.map(([x, y]) => k.ring(x, y, 6, 0, P1, 24) + k.ring(x, y, 3.4, 0, P1, 20)).join(""), { tone: "lo" }));
  // traces: package → the four memory packages, package → SSD and ports
  const traces = [];
  [-150, -90, -30, 30].forEach((mx, m) => {
    for (let i = 0; i < 6; i++) {
      const x = mx - 12 + i * 5;
      const xp = -70 + m * 34 + i * 4;
      traces.push(k.onTop([[xp, PKG.y + 2], [xp, -78 + i * 2], [x, -96 + i * 0.6], [x, -118]], 0, P1));
    }
  });
  for (let i = 0; i < 6; i++) traces.push(k.onTop([[-60 + i * 5, PKG.y + PKG.d - 2], [-60 + i * 5, 84 - i * 2], [-90 + i * 5, 104]], 0, P1));
  for (let i = 0; i < 6; i++) traces.push(k.onTop([[PKG.x + PKG.w - 2, 24 + i * 4], [150 - i * 2, 24 + i * 4], [196, 94 + i * 2.6], [244, 94 + i * 2.6]], 0, P1));
  out.push(line(traces.join(""), { tone: "faint" }));
  // BGA landing pads under the package
  const pads = [];
  for (let i = 0; i < 46; i++) for (let j = 0; j < 27; j++) pads.push(at([PKG.x + 6 + i * 3.98, PKG.y + 4 + j * 3.98, 0]));
  out.push(unit("bga", dots(pads, { size: 0.42, tone: "mid" }) + outline(k.insetPlan(PKG, 1), 0, { tone: "lo" })));

  const back = [];
  const front = [];
  // LPDDR5X memory packages behind the processor
  [-150, -90, -30, 30].forEach((x) => {
    const plan = { x: x - 24, y: -150, w: 48, d: 40, r: 1.2 };
    put(back, x, -130, unit("ram", slab(plan, 0, 3.6, { tone: "mid", bevel: 0.5 }) + outline(k.insetPlan(plan, 3), 3.6) + dots([at([plan.x + 4, plan.y + 4, 3.6])], { size: 0.6, tone: "hi" }) + line([28, 18].map((w, i) => k.lineOnTop([x - 14, -128 + i * 6], [x - 14 + w, -128 + i * 6], 3.6, P1)).join(""), { tone: "faint", free: true }), "mem"));
  });
  // power stages and chokes down the left edge, polymer capacitors beside them
  for (let y = -150; y <= 150; y += 37.5) {
    const plan = { x: -243, y: y - 13, w: 26, d: 26, r: 2 };
    put(back, -230, y, slab(plan, 0, 13, { tone: "mid", bevel: 0.7, inner: line(k.sideSeam(plan, 3.5, P1, 3), { tone: "faint" }) }) + outline(k.insetPlan(plan, 4), 13) + dots([at([-230, y, 13])], { size: 0.5, tone: "lo" }));
    const fet = { x: -210, y: y - 8, w: 12, d: 16, r: 0.6 };
    put(back, -204, y, slab(fet, 0, 2.4, { tone: "lo", bevel: 0.3 }) + dots([at([fet.x + 2.4, fet.y + 2.4, 2.4])], { size: 0.45 }));
    put(back, -258, y, cyl(-258, y, 5.4, 0, 9, { tone: "mid", bevel: 0.4, inner: line(k.sideArc(-258, y, 5.4, 6.5, P1, 20), { tone: "faint" }) }) + line(k.ring(-258, y, 3, 9, P1, 16), { tone: "lo" }));
  }
  // decoupling capacitors ringing the package
  for (let i = 0; i < 14; i++) {
    const x = -88 + i * 13.4;
    for (const y of [-64, 62]) put(y < 0 ? back : front, x, y, slab({ x: x - 2, y: y - 1.4, w: 4, d: 2.8, r: 0.3 }, 0, 1.4, { tone: "hi", bevel: 0 }));
  }
  // SSD (M.2 2230) at the front left
  const ssd = { x: -170, y: 96, w: 120, d: 88, r: 2 };
  put(front, -110, 140, unit("ssd",
    slab({ x: -182, y: 104, w: 12, d: 72, r: 1 }, 0, 6, { tone: "mid", bevel: 0.4 }) +
    slab(ssd, 3.4, 1.4, { tone: "lo", bevel: 0.3 }) +
    slab({ x: -158, y: 112, w: 32, d: 32, r: 0.6 }, 4.8, 1.4, { tone: "mid", bevel: 0.3 }) + dots([at([-154, 116, 6.2])], { size: 0.5 }) +
    slab({ x: -116, y: 106, w: 54, d: 68, r: 0.6 }, 4.8, 1.8, { tone: "mid", bevel: 0.3 }) + outline({ x: -110, y: 112, w: 42, d: 56 }, 6.6) +
    cyl(-56, 140, 4, 4.8, 2.4, { tone: "hi" }) + line(k.lineOnTop([-58.4, 140], [-53.6, 140], 7.2, P1), { tone: "mid" }), "io"));
  // embedded controller, flash and a Thunderbolt retimer, front middle
  [[10, 120, 22], [46, 120, 14], [90, 112, 30]].forEach(([x, y, s]) => put(front, x, y, slab({ x: x - s / 2, y: y - s / 2, w: s, d: s, r: 0.6 }, 0, 1.6, { tone: "mid", bevel: 0.3 }) + dots([at([x - s / 2 + 2.2, y - s / 2 + 2.2, 1.6])], { size: 0.45 })));
  // two USB-C ports on the right edge
  for (const y of [92, 122]) {
    const plan = { x: 238, y, w: 32, d: 18, r: 3 };
    put(front, 254, y + 9, slab(plan, 0, 7.4, { tone: "mid", bevel: 0.5 }) + outline({ x: 250, y: y + 4, w: 16, d: 10, r: 2 }, 7.4, { tone: "lo" }));
  }
  out.push(sortItems(back));

  // the processor package: substrate, Foveros base, three tiles and fillers
  const pkg = [];
  pkg.push(slab(PKG, PKG_Z, PKG_TOP - PKG_Z, { tone: "mid", bevel: 0.5, steps: 4 }));
  pkg.push(line(k.lineOnTop([PKG.x + 4, PKG.y + 10], [PKG.x + 10, PKG.y + 4], PKG_TOP, P1) + k.lineOnTop([PKG.x + 4, PKG.y + 4], [PKG.x + 10, PKG.y + 4], PKG_TOP, P1) + k.lineOnTop([PKG.x + 4, PKG.y + 4], [PKG.x + 4, PKG.y + 10], PKG_TOP, P1), { tone: "mid" }));
  const caps = [];
  for (let i = 0; i < 12; i++) caps.push([-74 + i * 13, -47], [-74 + i * 13, 43]);
  for (let j = 0; j < 5; j++) caps.push([-90, -20 + j * 10], [84, -20 + j * 10]);
  for (const [x, y] of caps.sort((a, b) => depth(...a) - depth(...b))) pkg.push(slab({ x, y, w: 4.4, d: 3.4, r: 0.3 }, PKG_TOP, 1.2, { tone: "hi", bevel: 0 }));
  pkg.push(slab(BASE, PKG_TOP, BASE_TOP - PKG_TOP, { tone: "hi", bevel: 0.3 }));
  // micro-bumps on the base tile, seen when the tiles lift
  const bumps = [];
  for (let i = 0; i < 38; i++) for (let j = 0; j < 17; j++) bumps.push(at([BASE.x + 3 + i * 4, BASE.y + 3 + j * 4, BASE_TOP]));
  pkg.push(dots(bumps, { size: 0.3, tone: "lo" }));
  const tiles = [];
  for (const f of FILLERS) tiles.push(slab(f, BASE_TOP, TILE_TOP - BASE_TOP, { tone: "lo", bevel: 0.2 }));
  tiles.push(unit("pct", slab(PCT, BASE_TOP, TILE_TOP - BASE_TOP, { tone: "hi", bevel: 0.3 }) + t.stripes(k.insetPlan(PCT, 3), TILE_TOP, 4, "x", { tone: "lo" }) + t.grid({ x: PCT.x + 2, y: PCT.y + 2, w: 4, d: PCT.d - 4 }, TILE_TOP, 1, 14, { size: 0.5 }), "io"));
  // the compute tile, its floorplan scaled from the tile view
  const s12 = COMPUTE.w / F.TILE.w;
  const map12 = (p) => ({ x: COMPUTE.x + (p.x - F.TILE.x) * s12, y: COMPUTE.y + (p.y - F.TILE.y) * s12, w: p.w * s12, d: p.d * s12, r: 0.2 });
  const tex = [...F.PCORES, ...F.ECLUSTERS, ...F.SLICES, ...F.UNCORE].map((p) => k.planOutline(map12(p), TILE_TOP, P1, 2)).join("");
  tiles.push(unit("compute", slab(COMPUTE, BASE_TOP, TILE_TOP - BASE_TOP, { tone: "hi", bevel: 0.3 }) + line(tex, { tone: "lo" }), "fe"));
  // the GPU tile: two render slices of six Xe3 cores, 16 MB L2 between them
  const xe = [];
  for (let s = 0; s < 2; s++) for (let c = 0; c < 6; c++) xe.push(k.planOutline({ x: GPU.x + 3 + c * 7.8, y: GPU.y + 3 + s * 31, w: 6.8, d: 15, r: 0.3 }, TILE_TOP, P1, 2));
  tiles.push(unit("gpu", slab(GPU, BASE_TOP, TILE_TOP - BASE_TOP, { tone: "hi", bevel: 0.3 }) + line(xe.join(""), { tone: "lo" }) + t.stripes({ x: GPU.x + 3, y: GPU.y + 20, w: GPU.w - 6, d: 12 }, TILE_TOP, 1.6, "y", { tone: "faint" }), "gpu"));
  pkg.push(`<g data-lift="tiles">${tiles.join("")}</g>`);
  out.push(`<g data-lift="pkg">${unit("package", pkg.join(""))}</g>`);

  // cooling module: copper cold plate, two flat heat pipes, fin stack, blower
  const cool = [];
  const screws = [[-70, -22], [-70, 22], [100, -22], [100, 22]];
  const post = ([x, y]) => cyl(x, y, 4.6, 0, 1.4, { tone: "mid" }) + cyl(x, y, 2.6, 1.4, 11.2, { tone: "mid" });
  const head = ([x, y]) =>
    slab(x < 0 ? { x: x - 3, y: y - 4, w: COLD.x - x + 3, d: 8, r: 1 } : { x: COLD.x + COLD.w, y: y - 4, w: x - COLD.x - COLD.w + 3, d: 8, r: 1 }, 12.6, 2.4, { tone: "mid", bevel: 0.3 }) +
    cyl(x, y, 4.4, 15, 4.2, { tone: "hi", inner: line(k.knurl(x, y, 4.4, 15, 19.2, 18, P1), { tone: "lo" }) }) +
    line(k.lineOnTop([x - 2.4, y], [x + 2.4, y], 19.2, P1), { tone: "mid" });
  for (const p of screws.filter((p) => p[0] < 0 && p[1] < 0)) cool.push(post(p), head(p));
  cool.push(slab(COLD, TILE_TOP, COLD_TOP - TILE_TOP, { tone: "hi", bevel: 0.6, steps: 4, inner: line(k.sideSeam(COLD, 12.4, P1, 4), { tone: "faint" }) }));
  for (const p of screws.filter((p) => !(p[0] < 0 && p[1] < 0)).sort((a, b) => depth(...a) - depth(...b))) cool.push(post(p), head(p));
  // blower housing with its intake and impeller, then the fin stack it blows through
  const B = BLOWER;
  cool.push(slab({ x: 200, y: -86, w: 44, d: 18, r: 1 }, B.z, B.top - B.z, { tone: "mid", bevel: 0.4 }));
  cool.push(cyl(B.x, B.y, B.r, B.z, B.top - B.z, { tone: "mid", steps: 64, bevel: 0.6, inner: line(k.sideArc(B.x, B.y, B.r, B.z + 6, P1, 48), { tone: "faint" }) }));
  const intake = k.ring(B.x, B.y, 28, B.top, P1, 72);
  cool.push(`<clipPath id="fan-hole"><path d="${intake}"/></clipPath><g clip-path="url(#fan-hole)"><path class="cpu-void" d="${intake}"/><g data-blades><path class="iso-line" data-tone="mid" d=""/></g></g>`);
  cool.push(line(intake, { tone: "lo" }) + t.cyl(B.x, B.y, 10, B.top - 4, 4.6, { tone: "hi", bevel: 0.4 }) + dots([at([B.x, B.y, B.top + 0.6])], { size: 0.7 }));
  cool.push(dots([[B.x - 33, B.y], [B.x + 33, B.y], [B.x, B.y - 33], [B.x, B.y + 33]].map(([x, y]) => at([x, y, B.top])), { size: 0.5 }));
  for (const y of [-16, 6]) cool.push(slab({ x: -34, y, w: 240, d: 10, r: 2.4 }, COLD_TOP, 3.4, { tone: "hi", bevel: 0.6, steps: 4 }));
  for (let i = 0; i < 13; i++) cool.push(slab({ x: FINS.x + i * 3.4, y: FINS.y, w: 1.2, d: FINS.d, r: 0.2 }, 2, FIN_TOP - 2, { tone: "mid", steps: 1, bevel: 0, crease: "none" }));
  cool.push(slab(FINS, FIN_TOP, 1.2, { tone: "mid", bevel: 0.3 }));
  cool.push(t.stripes(FINS, FIN_TOP + 1.2, 3.4, "y", { tone: "faint" }));
  out.push(`<g data-lift="cooler">${unit("cooler", cool.join(""), "copper")}</g>`);
  out.push(sortItems(front));
  return out.join("");
}

// ---------------------------------------------------------------- L2 · the compute tile
const P2 = k.fitProjection(k.boxCorners(F.TILE, -F.TILE_H, 0), W, H, { pad: 52, azimuth: AZ, elevation: EL });

function coreMini(t, c) {
  const s = F.CORE_SCALE;
  const [cx, cy] = centre(c);
  const map = (p) => ({ x: cx + p.x * s, y: cy + p.y * s, w: p.w * s, d: p.d * s, r: 0.2 });
  const top = F.CORE_H;
  const out = [t.slab({ ...c, r: 0.5 }, 0, top, { tone: "mid", bevel: 0.3 })];
  out.push(t.stripes({ x: c.x, y: c.y, w: c.w, d: c.d }, top, 1.4, "x", { tone: "faint" }));
  for (const u of Object.values(F.UNITS)) out.push(t.slab(map(u), top, Math.max(0.3, u.h * s * 0.6), { tone: "mid", bevel: 0 }));
  return out.join("");
}
function eCluster(t, c) {
  const top = F.CORE_H;
  const out = [t.slab({ ...c, r: 0.5 }, 0, top, { tone: "mid", bevel: 0.3 })];
  for (let i = 0; i < 4; i++) {
    const p = { x: c.x + 2 + (i % 2) * 15, y: c.y + 2 + Math.floor(i / 2) * 13, w: 13.5, d: 11.5, r: 0.4 };
    out.push(t.slab(p, top, 0.6, { tone: "mid", bevel: 0 }) + t.stripes(k.insetPlan(p, 0), top + 0.6, 1.8, "x", { tone: "faint" }));
  }
  const l2 = { x: c.x + 2, y: c.y + 28.5, w: c.w - 4, d: 9.5, r: 0.4 };
  out.push(t.slab(l2, top, 0.5, { tone: "hi", bevel: 0 }) + t.stripes(l2, top + 0.5, 1.4, "y", { tone: "lo" }));
  return out.join("");
}

function layer2() {
  const t = tools(P2);
  const { slab, line, depth, outline } = t;
  const out = [];
  out.push(t.halo(F.TILE, -F.TILE_H, F.TILE_H, 14));
  out.push(slab(F.TILE, -F.TILE_H, F.TILE_H, { tone: "hi", steps: 2, bevel: 0.8, inner: line(k.sideSeam(F.TILE, -F.TILE_H + 2, P2, 2), { tone: "faint" }) }));
  out.push(outline(k.insetPlan(F.TILE, 1.6), 0, { tone: "lo", steps: 2 }) + outline(k.insetPlan(F.TILE, 2.6), 0, { tone: "faint", steps: 2 }));
  out.push(t.stripes(k.insetPlan(F.TILE, 2.6), 0, 3, "x", { tone: "faint" }));
  // ring bus: two rails and their stops
  const R = F.RING;
  const ring = [
    slab({ x: R.x, y: R.y, w: R.w, d: 1.4, r: 0.3 }, 0, 0.5, { tone: "hi", bevel: 0 }),
    slab({ x: R.x, y: R.y + R.d - 1.4, w: R.w, d: 1.4, r: 0.3 }, 0, 0.5, { tone: "hi", bevel: 0 }),
    slab({ x: R.x, y: R.y, w: 1.4, d: R.d, r: 0.3 }, 0, 0.5, { tone: "hi", bevel: 0 }),
    slab({ x: R.x + R.w - 1.4, y: R.y, w: 1.4, d: R.d, r: 0.3 }, 0, 0.5, { tone: "hi", bevel: 0 }),
    ...F.SLICES.map((sl) => slab({ x: sl.x + sl.w / 2 - 2, y: R.y - 0.4, w: 4, d: R.d + 0.8, r: 0.4 }, 0.5, 0.6, { tone: "hi", bevel: 0 })),
  ].join("");
  out.push(unit("ring", ring + `<path data-ring-path class="cpu-none" d="${k.planOutline(k.insetPlan(R, 0.7), 0.7, P2, 4)}"/>`, "cache"));
  const items = [];
  const put = (p, svg) => items.push({ key: depth(...centre(p)), svg });
  F.PCORES.forEach((c, i) => put(c, unit("pcore", coreMini(t, c), "fe", ` data-core="${i}"`)));
  F.ECLUSTERS.forEach((c) => put(c, unit("ecore", eCluster(t, c), "int")));
  for (const sl of F.SLICES) put(sl, unit("l3", slab(sl, 0, 1.3, { tone: "mid", bevel: 0.3 }) + t.stripes(sl, 1.3, 1.3, "y", { tone: "lo" }) + slab({ x: sl.x, y: sl.y + sl.d / 2 - 1, w: sl.w, d: 2, r: 0.3 }, 1.3, 0.3, { tone: "hi", bevel: 0 }), "cache"));
  for (const a of F.UNCORE) {
    let tex = "";
    if (a.id === "phy") {
      for (let ch = 0; ch < 4; ch++) {
        const p = { x: a.x + 1 + ch * 28.5, y: a.y + 1, w: 27, d: a.d - 2, r: 0.3 };
        tex += slab(p, a.h, 0.4, { tone: "mid", bevel: 0 }) + `<g class="cpu-phy">${t.grid(p, a.h + 0.4, 12, 2, { size: 0.55, tone: "hi" })}</g>`;
      }
    } else if (a.id === "msc") tex = t.stripes(a, a.h, 1.4, "y", { tone: "lo" }) + slab({ x: a.x, y: a.y + 12, w: a.w, d: 3, r: 0.3 }, a.h, 0.3, { tone: "hi", bevel: 0 });
    else if (a.id === "npu") {
      for (let sl = 0; sl < 3; sl++) {
        const p = { x: a.x + 2 + sl * 14.6, y: a.y + 2, w: 13.4, d: 24, r: 0.4 };
        tex += slab(p, a.h, 0.6, { tone: "mid", bevel: 0 }) + t.grid(k.insetPlan(p, 1.2), a.h + 0.6, 6, 10, { size: 0.35, tone: "mid" });
      }
      tex += slab({ x: a.x + 2, y: a.y + 28, w: a.w - 4, d: 9, r: 0.4 }, a.h, 0.4, { tone: "hi", bevel: 0 }) + t.stripes({ x: a.x + 2, y: a.y + 28, w: a.w - 4, d: 9 }, a.h + 0.4, 1.4, "y", { tone: "lo" });
    } else if (a.id === "lpe") {
      for (let i = 0; i < 4; i++) tex += slab({ x: a.x + 2 + (i % 2) * 11, y: a.y + 2 + Math.floor(i / 2) * 11, w: 10, d: 10, r: 0.4 }, a.h, 0.5, { tone: "mid", bevel: 0 });
      tex += slab({ x: a.x + 2, y: a.y + 25, w: a.w - 4, d: 12, r: 0.4 }, a.h, 0.4, { tone: "hi", bevel: 0 }) + t.stripes({ x: a.x + 2, y: a.y + 25, w: a.w - 4, d: 12 }, a.h + 0.4, 1.4, "y", { tone: "lo" });
    } else {
      for (let i = 0; i < 3; i++) for (let j = 0; j < 2; j++) tex += outline({ x: a.x + 2 + (i * (a.w - 4)) / 3, y: a.y + 2 + (j * (a.d - 4)) / 2, w: (a.w - 4) / 3 - 1.2, d: (a.d - 4) / 2 - 1.2, r: 0.3 }, a.h, { tone: "lo" });
    }
    put(a, unit(a.id === "display" ? "media" : a.id, slab(a, 0, a.h, { tone: "mid", bevel: 0.3 }) + tex, a.domain));
  }
  out.push(sortItems(items));
  out.push(`<g class="cpu-ring-packets">${Array.from({ length: 8 }, (_, i) => `<circle class="cpu-packet-dot" data-ring-dot="${i}" r="1.4" cx="0" cy="0"/>`).join("")}</g>`);
  return out.join("");
}

// ---------------------------------------------------------------- L3 · one Cougar Cove P-core
const CORE_DEPTH = F.CORE_H / F.CORE_SCALE;
const P3 = k.fitProjection(k.boxCorners(F.CORE, -CORE_DEPTH, 6), W, H, { pad: 26, azimuth: AZ, elevation: EL });

function layer3() {
  const t = tools(P3);
  const { slab, depth, outline, text } = t;
  const U = F.UNITS;
  const out = [];
  out.push(t.halo(F.CORE, -CORE_DEPTH, CORE_DEPTH, 14));
  out.push(slab(F.CORE, -CORE_DEPTH, CORE_DEPTH, { tone: "mid", steps: 2, bevel: 0.8 }));
  out.push(t.stripes(F.CORE, 0, 5, "x", { tone: "faint" }));
  const items = [];
  const put = (p, svg) => items.push({ key: depth(...centre(p)), svg });
  const pads = (pts, z, size = 3.6) => pts.map(([x, y]) => outline({ x: x - size / 2, y: y - size / 2, w: size, d: size, r: 0.6 }, z, { tone: "lo" })).join("");
  const sram = (p, z, pitch = 2, axis = "y") => t.stripes(p, z, pitch, axis, { tone: "lo" });
  const display = (x, y, z, w, d, id, value, size = 4) => {
    const plan = { x: x - w / 2, y: y - d / 2, w, d, r: 0.8 };
    return slab(plan, z, 0.4, { tone: "lo", bevel: 0, crease: "none" }) + outline(plan, z + 0.4, { tone: "mid" }) + `<g data-show="${id}">${text(x, y + size * 0.36, z + 0.4, value, { size, tone: "hi" })}</g>`;
  };
  const block = (name, extra = "") => slab(U[name], 0, U[name].h, { tone: "mid", bevel: 0.5 }) + extra;
  // front end
  put(U.bpu, unit("bpu", block("bpu", sram({ x: U.bpu.x, y: U.bpu.y, w: 17, d: U.bpu.d }, U.bpu.h, 1.6) + slab({ x: U.bpu.x + 19, y: U.bpu.y + 2, w: 17, d: 18, r: 0.6 }, U.bpu.h, 0.8, { tone: "hi", bevel: 0 }) + t.grid({ x: U.bpu.x + 19, y: U.bpu.y + 2, w: 17, d: 18 }, U.bpu.h + 0.8, 6, 6, { size: 0.4 })), "fe"));
  put(U.icache, unit("icache", block("icache", sram(U.icache, U.icache.h, 1.8) + slab({ x: U.icache.x, y: U.icache.y + 15, w: U.icache.w, d: 3, r: 0.3 }, U.icache.h, 0.4, { tone: "hi", bevel: 0 })), "fe"));
  put(U.uopc, unit("uopc", block("uopc", t.grid(k.insetPlan(U.uopc, 2), U.uopc.h, 14, 12, { size: 0.42, tone: "mid" })), "fe"));
  put(U.decode, unit("decode", block("decode", Array.from({ length: 8 }, (_, i) => slab({ x: U.decode.x + 1.5 + i * 10.9, y: U.decode.y + 2, w: 9.4, d: 8, r: 0.6 }, U.decode.h, 1.2, { tone: "hi", bevel: 0 })).join("")), "fe"));
  put(U.queue, unit("queue", block("queue", pads(F.SLOTS.queue, U.queue.h, 4.2)), "fe"));
  // out-of-order engine
  put(U.rename, unit("rename", block("rename", pads(F.SLOTS.rename, U.rename.h, 5)), "ooo"));
  put(U.rob, unit("rob", block("rob", F.SLOTS.rob.map(([x, y], i) => `<g class="cpu-cell" data-robslot="${i}">${slab({ x: x - 2.3, y: y - 3, w: 4.6, d: 6, r: 0.5 }, U.rob.h, 0.6, { tone: "mid", bevel: 0 })}</g>`).join("")), "ooo"));
  put(U.isched, unit("isched", block("isched", pads(F.SLOTS.isched, U.isched.h, 5)), "int"));
  put(U.vsched, unit("vsched", block("vsched", pads(F.SLOTS.vsched, U.vsched.h, 5)), "vec"));
  put(U.msched, unit("msched", block("msched", pads(F.SLOTS.msched, U.msched.h, 5)), "mem"));
  // execution ports
  const portSvg = (list, kind, z) => list.map((p, i) => `<g class="cpu-cell" data-port="${kind}-${i}">${slab({ ...p, r: 0.6 }, z, 1, { tone: "hi", bevel: 0 })}</g>`).join("");
  put(U.iports, unit("iports", block("iports", portSvg(F.PORT_PADS.int, "int", U.iports.h)), "int"));
  put(U.vports, unit("vports", block("vports", portSvg(F.PORT_PADS.vec, "vec", U.vports.h)), "vec"));
  put(U.mports, unit("mports", block("mports", portSvg(F.PORT_PADS.load, "load", U.mports.h) + portSvg(F.PORT_PADS.store, "store", U.mports.h)), "mem"));
  // register files and store buffer
  const irf = U.irf;
  put(irf, unit("irf", block("irf", [0, 1, 2, 3].map((r) => display(irf.x + 8 + r * 15.2, irf.y + irf.d / 2, irf.h, 13.4, 8.6, `r${r}`, `r${r} 0`, 3.4)).join("")), "int"));
  put(U.vrf, unit("vrf", block("vrf", sram(U.vrf, U.vrf.h, 1.6, "x")), "vec"));
  put(U.sbuf, unit("sbuf", block("sbuf", pads(Array.from({ length: 6 }, (_, i) => [U.sbuf.x + 3.5 + i * 5, U.sbuf.y + U.sbuf.d / 2]), U.sbuf.h, 3.6)), "mem"));
  // memory: DTLB, 48 KB L0, 192 KB L1, 3 MB L2
  put(U.dtlb, unit("dtlb", block("dtlb", sram(U.dtlb, U.dtlb.h, 1.6, "x")), "mem"));
  const l0 = U.l0;
  put(l0, unit("l0", block("l0", sram({ x: l0.x, y: l0.y, w: 36, d: l0.d }, l0.h, 1.6) + display(l0.x + 46, l0.y + 10, l0.h, 16, 9, "m14", `n ${N_VALUE}`, 3.6) + display(l0.x + 63, l0.y + 10, l0.h, 15, 9, "m15", "s 0", 3.6)), "cache"));
  put(U.l1, unit("l1", block("l1", sram(U.l1, U.l1.h, 2)), "cache"));
  const l2 = U.l2;
  put(l2, unit("l2", block("l2", sram({ x: l2.x, y: l2.y, w: 60, d: l2.d }, l2.h, 2) + sram({ x: l2.x + 72, y: l2.y, w: 60, d: l2.d }, l2.h, 2) + slab({ x: l2.x + 61, y: l2.y, w: 10, d: l2.d, r: 0.4 }, l2.h, 0.6, { tone: "hi", bevel: 0 })), "cache"));
  out.push(sortItems(items));
  // a token template, cloned by the page for every micro-op in flight
  out.push(`<g data-tokens></g><g data-token-template style="display:none">${slab({ x: -2.2, y: -2.2, w: 4.4, d: 4.4, r: 0.9 }, 0, 2.4, { tone: "hi", lit: true, bevel: 0 })}</g>`);
  return out.join("");
}

// ---------------------------------------------------------------- page
const L1 = layer1();
const L2 = layer2();
const L3 = layer3();
const A12 = similarity(P1, [[COMPUTE.x, COMPUTE.y, TILE_TOP + PKG_LIFT], [COMPUTE.x + COMPUTE.w, COMPUTE.y + COMPUTE.d, TILE_TOP + PKG_LIFT]], P2, [[F.TILE.x, F.TILE.y, 0], [F.TILE.x + F.TILE.w, F.TILE.y + F.TILE.d, 0]]);
const C0 = F.PCORES[0];
const A23 = similarity(P2, [[C0.x, C0.y, F.CORE_H], [C0.x + C0.w, C0.y + C0.d, F.CORE_H]], P3, [[F.CORE.x, F.CORE.y, 0], [F.CORE.x + F.CORE.w, F.CORE.y + F.CORE.d, 0]]);

const r2 = (p) => p.map((n) => +n.toFixed(2));
const slots = Object.fromEntries(Object.entries(F.SLOTS).map(([name, list]) => [name, list.map((p) => r2(k.iso(p, P3)))]));
const pts = {
  pkg: r2(k.iso([-10, 0, 24], P1)),
  pcores: r2(k.iso([0, 32, 1], P2)),
  ecores: r2(k.iso([0, 22, 1], P2)),
  cache: r2(k.iso([-20, -14, 1], P2)),
  npu: r2(k.iso([45, -32, 1], P2)),
  phy: r2(k.iso([-40, -42, 1], P2)),
  fe: r2(k.iso([0, -72, 5], P3)),
  ooo: r2(k.iso([0, -30, 5], P3)),
  exec: r2(k.iso([0, 2, 4], P3)),
  mem: r2(k.iso([0, 50, 4], P3)),
};
const lift = r2(k.iso([0, 0, 1], P1).map((n, i) => n - k.iso([0, 0, 0], P1)[i]));
const DATA = { A12, A23, W, H, pts, slots, lift, pkgLift: PKG_LIFT, token0: r2(k.iso([0, 0, 0], P3)), fan: { P: P1, x: BLOWER.x, y: BLOWER.y, z: BLOWER.top - 2, r0: 10, r1: 33 } };

const svg = (cls, body, label) => k.figureSvg({ width: W, height: H, label, className: `cpu-layer ${cls}`, body: `<g class="cpu-cam">${body}</g>` });
const SLIDES = readFileSync(join(HERE, "slides.html"), "utf8");
const count = (SLIDES.match(/class="cpu-slide/g) || []).length;
const listing = PROGRAM.map((i, n) => `<li data-line="${n}"><span class="cpu-addr">${n}</span><code>${i.text}</code><span class="cpu-note">${i.note}</span></li>`).join("");
const controls = `<div class="cpu-controls" data-controls>
  <button type="button" data-act="cycle">Step cycle</button>
  <button type="button" data-act="run" data-state="idle">Run</button>
  <button type="button" data-act="reset">Reset</button>
</div>`;
const body = `<div class="cpu-track" style="height:${count * 100}vh">
<div class="cpu-screen">
  <div class="cpu-progress" aria-hidden="true"><span data-bar></span></div>
  <div class="cpu-art"><div class="cpu-stage" role="group" aria-label="Panther Lake processor figure. Scroll, or use the arrow keys, to move from slide to slide.">
${svg("cpu-l1", L1, "A laptop mainboard with an Intel Panther Lake processor: the package's three tiles on a Foveros base, four LPDDR5X memory packages, power stages, an SSD, and a cooling module of copper cold plate, two flat heat pipes, a fin stack and a blower fan.")}
${svg("cpu-l2", L2, "The Panther Lake compute tile: four Cougar Cove P-cores, two clusters of four Darkmont E-cores, six L3 slices on a ring bus, the memory-side cache, media and display engines, the low-power E-core island, the NPU and the LPDDR5X interface.")}
${svg("cpu-l3", L3, "One Cougar Cove P-core: branch predictor, instruction cache, micro-op cache, eight decoders, micro-op queue, rename, reorder buffer, integer, vector and memory schedulers with their ports, register files, store buffer, DTLB and the L0, L1 and L2 caches.")}
  </div></div>
  <div class="cpu-corners" aria-hidden="true"><span data-corner="fig" data-fig>Fig 1</span><span data-corner="title" data-title>Panther Lake</span><span data-corner="readout" data-readout></span></div>
  <div class="cpu-legend" data-legend aria-hidden="true"></div>
  <div class="cpu-captions">${SLIDES.replace("<!--LISTING-->", `<ol class="cpu-listing">${listing}</ol>`).replace("<!--CONTROLS-->", controls)}</div>
  <nav class="cpu-nav" aria-label="Slides"><button type="button" data-go="-1" aria-label="Previous slide">↑</button><span data-count>01 / ${String(count).padStart(2, "0")}</span><button type="button" data-go="1" aria-label="Next slide">↓</button><button type="button" data-play aria-label="Play slideshow">▶</button><button type="button" data-music aria-label="Mute music">♪</button><a class="cpu-home" href="../">All CPUs</a></nav>
  <div class="cpu-live" aria-live="polite" data-live></div>
</div>
</div>
${readFileSync(join(HERE, "sources.html"), "utf8")}`;

const css = readFileSync(join(HERE, "../shared/deck.css"), "utf8");
const live = readFileSync(join(HERE, "live.js"), "utf8") + readFileSync(join(HERE, "../shared/play.js"), "utf8") + readFileSync(join(HERE, "../shared/ambient.js"), "utf8");
const model = readFileSync(join(HERE, "model.mjs"), "utf8").replace(/^export /gm, "");
const script = kitScript() + "\n" + model + `\nconst DATA = ${JSON.stringify(DATA)};\n` + live;
const html = k
  .pageHtml({ title: "Inside Panther Lake", theme, body, script, width: 1180 })
  .replace("</style>", `${css}</style>`)
  .replace('<main class="iso-page">', '<main class="cpu-page">');
const name = theme === "light" ? "light.html" : "index.html";
// the built page lands in the site folder named after this tour: src/<tour> → <tour>/
writeFileSync(join(HERE, "../..", basename(HERE), name), html);
console.log("wrote", name, (html.length / 1024).toFixed(0) + " KB", count, "slides", "A12", A12.s.toFixed(2), "A23", A23.s.toFixed(2));
