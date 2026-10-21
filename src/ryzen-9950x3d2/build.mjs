import { readFileSync, writeFileSync } from "node:fs";
import { basename, dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import * as k from "../shared/iso-kit.mjs";
import { tools, centre, sortItems, unit, similarity } from "../shared/deck.mjs";
import * as F from "./floor.mjs";

const HERE = dirname(fileURLToPath(import.meta.url));
const kitScript = () => readFileSync(join(HERE, "../shared/iso-kit.mjs"), "utf8").replace(/^export /gm, "");
const theme = process.argv.includes("--light") ? "light" : "dark";
const W = 600;
const H = 440;
const AZ = 40;
const EL = 34;

// ---------------------------------------------------------------- L1 · desktop board around the AM5 socket (1 unit = 0.25 mm)
const BOARD = { x: -300, y: -330, w: 600, d: 620, r: 10 };
const BODY = { x: -100, y: -100, w: 200, d: 200, r: 3 };
const BODY_TOP = 6;
const SUB = { x: -80, y: -80, w: 160, d: 160, r: 1.5 }; // the 40 × 40 mm package
const SUB_TOP = 10;
const RIM_TOP = 16; // the heat spreader's notched skirt
const LID = { x: -64, y: -64, w: 128, d: 128, r: 2 };
const LID_TOP = 24;
const IOD = { x: -25, y: -8, w: 50, d: 40, r: 0.4 };
const CCDS = [{ x: -51, y: -56, w: 42, d: 26, r: 0.4 }, { x: 9, y: -56, w: 42, d: 26, r: 0.4 }];
const VC_TOP = 11.5;
const CCD_TOP = 13;
const NOTCH_Y = [-46, 0, 46];
const PLATE_Z = RIM_TOP;
const PLATE_H = 2.4;
const PK = 70; // the package rides this high once it is out of the socket
const CL = 18; // the compute dies ride this high above their cache dies

// the AM5 heat spreader: a square with three notches down each side, where capacitors sit
function lidRing() {
  const e = 78, n = 10, depth = 12;
  const side = (x, dir) => NOTCH_Y.flatMap((y) => [[x, y - n], [x + dir * depth, y - n], [x + dir * depth, y + n], [x, y + n]]);
  const right = side(e, -1);
  const left = side(-e, 1).reverse();
  return [[-e, -e], [e, -e], ...right, [e, e], [-e, e], ...left];
}

const P1 = k.fitProjection([...k.boxCorners(BOARD, -14, 0), [-250, -318, 133], [282, -284, 133], [0, 0, LID_TOP + PK + 60]], W, H, { pad: 18, azimuth: AZ, elevation: EL });

function layer1() {
  const t = tools(P1);
  const { slab, cyl, line, dots, at, depth, outline } = t;
  const out = [];
  const put = (list, x, y, svg) => list.push({ key: depth(x, y), svg });
  // board on standoffs
  out.push(t.halo(BOARD, -14, 14));
  const holes = [...k.corners(BOARD, 16), [-160, 140], [200, 140], [200, -150]];
  for (const [x, y] of k.corners(BOARD, 16).sort((a, b) => depth(...a) - depth(...b))) out.push(cyl(x, y, 6, -14, 8, { tone: "lo" }));
  out.push(slab(BOARD, -6, 6, { tone: "lo", steps: 6, bevel: 1, inner: line(k.sideSeam(BOARD, -3, P1, 6), { tone: "faint" }) }));
  out.push(line(holes.map(([x, y]) => k.ring(x, y, 6, 0, P1, 24) + k.ring(x, y, 3.4, 0, P1, 20)).join(""), { tone: "lo" }));
  // traces: socket → both DIMM slots, socket → the x16 slot and the M.2
  const traces = [];
  for (let i = 0; i < 10; i++) {
    const x = -90 + i * 6;
    traces.push(k.onTop([[x, BODY.y - 36], [x, -200 - i * 2], [x - 40, -240 - i * 2], [x - 40, -264]], 0, P1));
    traces.push(k.onTop([[x + 120, BODY.y - 36], [x + 120, -205 - i * 2], [x + 150, -235 - i * 2], [x + 150, -264]], 0, P1));
  }
  for (let i = 0; i < 8; i++) traces.push(k.onTop([[-60 + i * 6, 136], [-60 + i * 6, 190 - i], [-110 + i * 6, 214]], 0, P1));
  out.push(line(traces.join(""), { tone: "faint" }));
  // vias where the traces dive under the socket
  const vias = [];
  for (let i = 0; i < 10; i++) vias.push(at([-90 + i * 6, BODY.y - 36, 0]), at([30 + i * 6, BODY.y - 36, 0]));
  for (let i = 0; i < 8; i++) vias.push(at([-60 + i * 6, 136, 0]));
  out.push(dots(vias, { size: 0.5, tone: "lo" }));

  const back = [];
  const front = [];
  // two DDR5 slots behind the socket, each with a module standing in it
  [-312, -284].forEach((y, s) => {
    const slot = { x: -250, y, w: 532, d: 20, r: 1 };
    const mod = { x: -244, y: y + 8, w: 520, d: 4, r: 0.4 };
    let svg = slab(slot, 0, 22, { tone: "lo", bevel: 0.4, inner: line(k.sideSeam(slot, 9, P1, 3), { tone: "faint" }) });
    for (const x of [slot.x - 10, slot.x + slot.w - 2]) svg += slab({ x, y: y + 2, w: 12, d: 16, r: 1 }, 0, 28, { tone: "mid", bevel: 0.4 });
    svg += slab(mod, 8, 125, { tone: "mid", steps: 1, bevel: 0 });
    svg += line(k.lineOnTop([mod.x + 4, mod.y + 2], [mod.x + mod.w - 4, mod.y + 2], 133, P1), { tone: "lo", free: true });
    // eight DRAM packages, the PMIC and the SPD hub on the face toward us
    const chips = [];
    for (let c = 0; c < 10; c++) {
      const x = mod.x + 14 + c * 50 + (c >= 5 ? 14 : 0);
      const big = c !== 4 && c !== 9;
      chips.push(slab({ x, y: mod.y + mod.d, w: big ? 40 : 18, d: 1.4, r: 0.2 }, big ? 64 : 40, big ? 40 : 18, { tone: "lo", steps: 1, bevel: 0 }));
    }
    svg += chips.join("");
    put(back, 16, y, unit("dimm", svg, "mem", ` data-dimm="${s}"`));
  });
  // VRM: an L of finned heatsinks over the power stages, chokes in front of them
  const sinkL = { x: -284, y: -250, w: 58, d: 380, r: 3 };
  const sinkB = { x: -220, y: -250, w: 300, d: 52, r: 3 };
  const fins = (plan, axis) => t.stripes(k.insetPlan(plan, 4), 44, 6, axis, { tone: "lo" }) + outline({ ...k.insetPlan(plan, 4), r: 1 }, 44, { tone: "lo" });
  put(back, -255, -60, unit("vrm", slab(sinkL, 0, 44, { tone: "mid", bevel: 0.8, steps: 4, inner: line(k.sideSeam(sinkL, 10, P1, 4), { tone: "faint" }) }) + fins(sinkL, "y"), "copper"));
  put(back, -70, -224, unit("vrm", slab(sinkB, 0, 44, { tone: "mid", bevel: 0.8, steps: 4, inner: line(k.sideSeam(sinkB, 10, P1, 4), { tone: "faint" }) }) + fins(sinkB, "x"), "copper"));
  const choke = (x, y) => {
    const plan = { x: x - 10, y: y - 10, w: 20, d: 20, r: 1.6 };
    return slab(plan, 0, 14, { tone: "mid", bevel: 0.6, inner: line(k.sideSeam(plan, 3.5, P1, 3), { tone: "faint" }) }) + outline(k.insetPlan(plan, 4), 14) + dots([at([x, y, 14])], { size: 0.45, tone: "lo" });
  };
  for (let y = -170; y <= 110; y += 28) put(back, -206, y, unit("vrm", choke(-206, y), "copper"));
  for (let x = -176; x <= 64; x += 30) put(back, x, -180, unit("vrm", choke(x, -180), "copper"));
  // polymer capacitors beside the chokes
  for (let y = -156; y <= 96; y += 56) put(back, -186, y, cyl(-186, y, 5, 0, 10, { tone: "mid", bevel: 0.4, inner: line(k.sideArc(-186, y, 5, 7.5, P1, 20), { tone: "faint" }) }) + line(k.ring(-186, y, 2.8, 10, P1, 16), { tone: "lo" }));
  // small decoupling capacitors around the socket
  for (let i = 0; i < 12; i++) {
    const x = -88 + i * 16;
    for (const y of [-142, 140]) put(y < 0 ? back : front, x, y, slab({ x: x - 2.2, y: y - 1.5, w: 4.4, d: 3, r: 0.3 }, 0, 1.4, { tone: "hi", bevel: 0 }));
  }
  // M.2 heatsink and the PCIe 5.0 x16 slot in front of the socket
  const m2 = { x: -246, y: 152, w: 300, d: 38, r: 2 };
  put(front, -96, 171, unit("m2", slab(m2, 0, 8, { tone: "mid", bevel: 0.5 }) + t.stripes(k.insetPlan(m2, 5), 8, 7, "y", { tone: "lo" }) + outline({ ...k.insetPlan(m2, 5), r: 1 }, 8, { tone: "lo" }) + cyl(m2.x + m2.w - 10, m2.y + m2.d / 2, 3.4, 8, 1.6, { tone: "hi" }) + line(k.lineOnTop([m2.x + m2.w - 13.4, m2.y + m2.d / 2], [m2.x + m2.w - 6.6, m2.y + m2.d / 2], 9.6, P1), { tone: "mid" }), "io"));
  const pcie = { x: -250, y: 214, w: 356, d: 26, r: 1.4 };
  put(front, -72, 227, unit("pcie", slab(pcie, 0, 11, { tone: "lo", bevel: 0.4, inner: line(k.sideSeam(pcie, 4, P1, 3), { tone: "faint" }) }) + outline({ x: pcie.x + 6, y: pcie.y + 11, w: 240, d: 4, r: 1 }, 11, { tone: "mid" }) + outline({ x: pcie.x + 252, y: pcie.y + 11, w: 92, d: 4, r: 1 }, 11, { tone: "mid" }) + slab({ x: pcie.x + pcie.w, y: pcie.y - 2, w: 22, d: 30, r: 2 }, 0, 14, { tone: "mid", bevel: 0.4 }), "io"));
  out.push(sortItems(back));

  // the socket: body, 1718 contacts, the steel stiffener frame and its four screws
  out.push(unit("socket", slab(BODY, 0, BODY_TOP, { tone: "lo", bevel: 0.5, steps: 3, inner: line(k.sideSeam(BODY, 2.4, P1, 3), { tone: "faint" }) }), "io"));
  const pins = [];
  for (let i = 0; i < 42; i++) for (let j = 0; j < 41; j++) {
    if ((i === 0 || i === 41) && (j === 0 || j === 40)) continue; // 42 × 41 minus the four corners: 1718 contacts
    pins.push(at([-79 + i * 3.85, -77 + j * 3.85, BODY_TOP]));
  }
  out.push(unit("pins", dots(pins, { size: 0.3, tone: "mid" }) + outline(k.insetPlan(SUB, -2), BODY_TOP, { tone: "lo" }) + line(k.lineOnTop([SUB.x - 2, SUB.y + 10], [SUB.x + 8, SUB.y - 2], BODY_TOP, P1), { tone: "hi" }), "io"));
  const bars = [
    { x: -118, y: -130, w: 236, d: 24, r: 2 },
    { x: -118, y: -106, w: 16, d: 212, r: 0.6 },
    { x: 102, y: -106, w: 16, d: 212, r: 0.6 },
    { x: -118, y: 106, w: 236, d: 24, r: 2 },
  ];
  const screws = [[-108, -118], [108, -118], [-108, 118], [108, 118]];
  const screw = ([x, y]) => cyl(x, y, 5, 5, 2.6, { tone: "hi", inner: line(k.knurl(x, y, 5, 5, 7.6, 16, P1), { tone: "lo" }) }) + line(k.onTop(Array.from({ length: 6 }, (_, i) => [x + 2.4 * Math.cos((i * Math.PI) / 3), y + 2.4 * Math.sin((i * Math.PI) / 3)]), 7.6, P1, true), { tone: "mid" });
  const frame = (list) => unit("frame", list.map((b) => slab(b, 0, 5, { tone: "mid", bevel: 0.4 })).join("") + screws.filter(([, y]) => list.some((b) => y > b.y && y < b.y + b.d)).map(screw).join(""));
  out.push(frame(bars.slice(0, 3)));

  // the processor: substrate, capacitors in the lid's notches, cache dies, I/O die, compute dies, lid
  const cpu = [];
  cpu.push(slab(SUB, BODY_TOP, SUB_TOP - BODY_TOP, { tone: "mid", bevel: 0.4, steps: 3 }));
  cpu.push(line(k.onTop([[SUB.x + 4, SUB.y + 4], [SUB.x + 12, SUB.y + 4], [SUB.x + 4, SUB.y + 12]], SUB_TOP, P1, true), { tone: "hi" }));
  const caps = [];
  for (const y0 of NOTCH_Y) for (const x0 of [-74, 69]) for (let j = 0; j < 3; j++) caps.push([x0, y0 - 7 + j * 5]);
  for (let i = 0; i < 8; i++) caps.push([-58 + i * 15, 40], [-58 + i * 15, 46]);
  for (const [x, y] of caps.sort((a, b) => depth(...a) - depth(...b))) cpu.push(slab({ x, y, w: 4.4, d: 3, r: 0.3 }, SUB_TOP, 1.2, { tone: "hi", bevel: 0 }));
  // Infinity Fabric links in the substrate, CCD to I/O die
  const links = CCDS.map((c) => [[c.x + c.w / 2, c.y + c.d], [c.x + c.w / 2, IOD.y - 6], [IOD.x + IOD.w / 2 + (c.x < 0 ? -10 : 10), IOD.y - 6], [IOD.x + IOD.w / 2 + (c.x < 0 ? -10 : 10), IOD.y - 1.2]]);
  cpu.push(unit("fabric", line(links.map((l) => [-3, 0, 3].map((o) => k.onTop(l.map(([x, y], n) => [x + (n < 2 ? o : o * 0.6), y]), SUB_TOP, P1)).join("")).join(""), { tone: "lo" }), "io"));
  cpu.push(dots(links.flatMap((l) => [-3, 0, 3].map((o) => at([l[3][0] + o * 0.6, l[3][1], SUB_TOP]))), { size: 0.45, tone: "mid" }));
  cpu.push(links.map((l, i) => `<path data-fab-path="${i}" class="cpu-none" d="${k.onTop(l, SUB_TOP + 0.2, P1)}"/>`).join(""));
  // the I/O die: memory controller, PCIe, the 2-CU GPU and the fabric switch
  const iod = slab(IOD, SUB_TOP, CCD_TOP - SUB_TOP, { tone: "hi", bevel: 0.3 }) +
    outline({ x: IOD.x + 2, y: IOD.y + 2, w: 14, d: IOD.d - 4, r: 0.3 }, CCD_TOP, { tone: "lo" }) +
    outline({ x: IOD.x + 34, y: IOD.y + 2, w: 14, d: IOD.d - 4, r: 0.3 }, CCD_TOP, { tone: "lo" }) +
    outline({ x: IOD.x + 18, y: IOD.y + 22, w: 14, d: 16, r: 0.3 }, CCD_TOP, { tone: "lo" }) +
    t.grid({ x: IOD.x + 18, y: IOD.y + 22, w: 14, d: 16 }, CCD_TOP, 2, 1, { size: 0.6 }) +
    t.stripes({ x: IOD.x + 18, y: IOD.y + 2, w: 14, d: 18 }, CCD_TOP, 2, "x", { tone: "faint" }) + outline({ x: IOD.x + 18, y: IOD.y + 2, w: 14, d: 18, r: 0.3 }, CCD_TOP, { tone: "lo" });
  cpu.push(unit("iod", iod, "io"));
  // a 64 MB SRAM die under each CCD, its bond pads seen when the CCD lifts
  for (const c of CCDS) {
    const vc = slab(c, SUB_TOP, VC_TOP - SUB_TOP, { tone: "mid", bevel: 0.2 }) + t.grid(k.insetPlan(c, 2), VC_TOP, 14, 8, { size: 0.28, tone: "lo" }) + t.stripes({ x: c.x + 2, y: c.y + c.d / 2 - 5, w: c.w - 4, d: 10 }, VC_TOP, 1.6, "y", { tone: "faint" }) + outline({ x: c.x + 2, y: c.y + c.d / 2 - 5, w: c.w - 4, d: 10, r: 0.2 }, VC_TOP, { tone: "faint" });
    cpu.push(unit("vcache", vc, "cache"));
  }
  // compute dies: eight cores in two rows, L3 down the middle
  const s1 = CCDS[0].w / F.CCD.w;
  const ccds = CCDS.map((c, n) => {
    const map = (p) => ({ x: c.x + (p.x - F.CCD.x) * s1, y: c.y + (p.y - F.CCD.y) * s1, w: p.w * s1, d: p.d * s1, r: 0.15 });
    const tex = [...F.CORES, ...F.SLICES].map((p) => k.planOutline(map(p), CCD_TOP, P1, 2)).join("");
    return unit("ccd", slab(c, VC_TOP, CCD_TOP - VC_TOP, { tone: "hi", bevel: 0.2 }) + line(tex, { tone: "lo" }), "fe", ` data-ccd="${n}"`);
  });
  cpu.push(`<g data-lift="ccd">${ccds.join("")}</g>`);
  // the lid, with a ring of thermal solder marks left on its underside's footprint and one engraved line
  const ring = lidRing();
  const lid =
    k.solidSvg(k.extrude(ring, SUB_TOP, RIM_TOP - SUB_TOP, P1, { convex: false }), { tone: "hi" }) +
    slab(LID, RIM_TOP, LID_TOP - RIM_TOP, { tone: "hi", bevel: 0.6, steps: 4 }) +
    outline(k.insetPlan(LID, 6), LID_TOP, { tone: "faint", steps: 3 }) +
    t.text(0, 6, LID_TOP, "RYZEN 9 9950X3D2", { size: 6, tone: "lo" }) +
    line(k.lineOnTop([-40, 18], [40, 18], LID_TOP, P1) + k.lineOnTop([-28, 26], [28, 26], LID_TOP, P1), { tone: "faint", free: true });
  cpu.push(`<g class="cpu-fab-packets">${Array.from({ length: 6 }, (_, i) => `<circle class="cpu-packet-dot" data-fab-dot="${i}" r="1.2" cx="0" cy="0"/>`).join("")}</g>`);
  cpu.push(`<g data-lift="ihs">${unit("ihs", lid)}</g>`);
  out.push(`<g data-lift="cpu">${unit("package", cpu.join(""))}</g>`);

  // the load plate: a steel frame that presses the lid's rim down, and the lever that locks it
  const win = { x: -68, y: -68, w: 136, d: 136 };
  const plate = [
    slab({ x: -112, y: -126, w: 8, d: 10, r: 1 }, 5, PLATE_Z - 5, { tone: "mid", bevel: 0 }),
    slab({ x: 104, y: -126, w: 8, d: 10, r: 1 }, 5, PLATE_Z - 5, { tone: "mid", bevel: 0 }),
    slab({ x: -108, y: -124, w: 216, d: 56, r: 2 }, PLATE_Z, PLATE_H, { tone: "mid", bevel: 0.4 }),
    slab({ x: -108, y: win.y, w: 40, d: win.d, r: 0.4 }, PLATE_Z, PLATE_H, { tone: "mid", bevel: 0.4 }),
    slab({ x: win.x + win.w, y: win.y, w: 40, d: win.d, r: 0.4 }, PLATE_Z, PLATE_H, { tone: "mid", bevel: 0.4 }),
    slab({ x: -108, y: 68, w: 216, d: 56, r: 2 }, PLATE_Z, PLATE_H, { tone: "mid", bevel: 0.4 }),
    outline({ x: -100, y: -116, w: 200, d: 40, r: 2 }, PLATE_Z + PLATE_H, { tone: "faint" }),
    outline({ x: -100, y: 76, w: 200, d: 40, r: 2 }, PLATE_Z + PLATE_H, { tone: "faint" }),
    // the front tongue the lever hooks over
    slab({ x: -14, y: 124, w: 28, d: 10, r: 1 }, 7, PLATE_Z + PLATE_H - 7, { tone: "mid", bevel: 0 }),
  ].join("");
  const lever =
    slab({ x: 120, y: -126, w: 10, d: 14, r: 1.6 }, 0, 9, { tone: "mid", bevel: 0.3 }) +
    slab({ x: 122, y: -116, w: 5, d: 244, r: 2 }, 6, 4, { tone: "hi", bevel: 0 }) +
    slab({ x: 122, y: 124, w: 30, d: 6, r: 2 }, 6, 4, { tone: "hi", bevel: 0 }) +
    slab({ x: 146, y: 118, w: 12, d: 18, r: 3 }, 6, 5, { tone: "mid", bevel: 0.3 }) +
    slab({ x: 14, y: 128, w: 108, d: 4, r: 1 }, 7, 3, { tone: "hi", bevel: 0 });
  out.push(frame(bars.slice(3)));
  out.push(`<g data-lift="plate">${unit("plate", plate + lever)}</g>`);
  out.push(sortItems(front));
  return out.join("");
}

// ---------------------------------------------------------------- L2 · one CCD over its cache die
const VC_Z = -(F.CCD_H + F.GAP + F.VC_H);
const P2 = k.fitProjection(k.boxCorners(F.CCD, VC_Z, 0), W, H, { pad: 50, azimuth: AZ, elevation: EL });

function coreMini(t, c, i) {
  const s = F.CORE_SCALE;
  const [cx, cy] = centre(c);
  const map = (p) => ({ x: cx + p.x * s, y: cy + (c.flip ? -(p.y + p.d) : p.y) * s, w: p.w * s, d: p.d * s, r: 0.2 });
  const top = F.CORE_H;
  const out = [t.slab({ ...c, r: 0.5 }, 0, top, { tone: "mid", bevel: 0.3 })];
  for (const [name, u] of Object.entries(F.UNITS)) {
    const p = map(u);
    out.push(name === "l2" ? `<g data-l2="${i}">${t.slab(p, top, 0.5, { tone: "hi", bevel: 0 }) + t.stripes(p, top + 0.5, 1.2, "y", { tone: "lo" })}</g>` : t.slab(p, top, Math.max(0.3, u.h * s * 0.6), { tone: "mid", bevel: 0 }));
  }
  return out.join("");
}

function layer2() {
  const t = tools(P2);
  const { slab, line, depth, outline, dots, at } = t;
  const out = [];
  const lowTop = VC_Z + F.VC_H;
  // the 64 MB SRAM die underneath
  out.push(t.halo(F.CCD, VC_Z, F.VC_H, 14));
  const vc = [slab(F.CCD, VC_Z, F.VC_H, { tone: "mid", steps: 2, bevel: 0.6, inner: line(k.sideSeam(F.CCD, VC_Z + 2, P2, 2), { tone: "faint" }) })];
  for (const b of F.BANKS) vc.push(slab({ ...b, r: 0.4 }, lowTop, 0.6, { tone: "mid", bevel: 0 }) + t.stripes(b, lowTop + 0.6, 1.4, "y", { tone: "lo" }));
  vc.push(t.grid({ x: -84, y: -1.5, w: 183, d: 3 }, lowTop, 40, 1, { size: 0.4, tone: "lo" }));
  vc.push(slab({ ...F.PHY, r: 0.3 }, lowTop, 0.6, { tone: "hi", bevel: 0 }) + t.grid(F.PHY, lowTop + 0.6, 2, 20, { size: 0.5 }));
  out.push(unit("vcache", vc.join(""), "cache"));
  // the compute die, lifted off it
  out.push(t.halo(F.CCD, -F.CCD_H, F.CCD_H, 10));
  out.push(slab(F.CCD, -F.CCD_H, F.CCD_H, { tone: "hi", steps: 2, bevel: 0.8, inner: line(k.sideSeam(F.CCD, -F.CCD_H + 2, P2, 2), { tone: "faint" }) }));
  out.push(outline(k.insetPlan(F.CCD, 1.4), 0, { tone: "lo", steps: 2 }));
  out.push(unit("phy", slab({ ...F.PHY, r: 0.3 }, 0, 0.8, { tone: "mid", bevel: 0 }) + `<g class="cpu-phy">${t.grid(k.insetPlan(F.PHY, 1), 0.8, 2, 22, { size: 0.55, tone: "hi" })}</g>`, "io"));
  const items = [];
  const put = (p, svg) => items.push({ key: depth(...centre(p)), svg });
  F.CORES.forEach((c, i) => put(c, unit("core", coreMini(t, c, i), "fe", ` data-core="${i}"`)));
  F.SLICES.forEach((sl, i) => put(sl, unit("l3", slab({ ...sl, r: 0.4 }, 0, 1.1, { tone: "mid", bevel: 0.2 }) + t.stripes(sl, 1.1, 1.3, "y", { tone: "lo" }) + slab({ x: sl.x, y: sl.y + (i < 4 ? sl.d - 2.4 : 0.4), w: sl.w, d: 2, r: 0.3 }, 1.1, 0.3, { tone: "hi", bevel: 0 }), "cache", ` data-slice="${i}"`)));
  out.push(sortItems(items));
  // where a load is served, in screen units, for the explorer's packets
  const T0 = F.CORES[1];
  const spot = {
    core: at([T0.x + T0.w / 2, T0.y + 10, F.CORE_H + 0.8]),
    l1: at([T0.x + T0.w / 2 + 12, T0.y + 26, F.CORE_H + 0.8]),
    l2: at([T0.x + T0.w / 2, T0.y + T0.d - 4, F.CORE_H + 0.8]),
    l3: F.SLICES.map((sl) => at([sl.x + sl.w / 2, sl.y + sl.d / 2, 1.6])),
    // the cache die is seen only along its front edges, below the compute die
    vc: F.SLICES.map((sl, i) => at([sl.x + sl.w / 2 + ((i * 7) % 12) - 6, F.CCD.y + F.CCD.d - 7 - (i >= 4 ? 4 : 0), lowTop + 0.8])),
    phy: at([F.PHY.x + F.PHY.w / 2, 0, 1]),
    out: at([F.CCD.x - 40, 0, 1]),
  };
  out.push(`<g data-packets></g>`);
  return { svg: out.join(""), spot };
}

// ---------------------------------------------------------------- L3 · one Zen 5 core
const CORE_DEPTH = F.CORE_H / F.CORE_SCALE;
const P3 = k.fitProjection(k.boxCorners(F.CORE, -CORE_DEPTH, 6), W, H, { pad: 26, azimuth: AZ, elevation: EL });

function layer3() {
  const t = tools(P3);
  const { slab, depth, outline, at } = t;
  const U = F.UNITS;
  const out = [];
  out.push(t.halo(F.CORE, -CORE_DEPTH, CORE_DEPTH, 14));
  out.push(slab(F.CORE, -CORE_DEPTH, CORE_DEPTH, { tone: "mid", steps: 2, bevel: 0.8 }));
  out.push(t.stripes(F.CORE, 0, 5, "x", { tone: "faint" }));
  const items = [];
  const put = (p, svg) => items.push({ key: depth(...centre(p)), svg });
  const sram = (p, z, pitch = 2, axis = "y") => t.stripes(p, z, pitch, axis, { tone: "lo" });
  const block = (name, extra = "") => slab(U[name], 0, U[name].h, { tone: "mid", bevel: 0.5 }) + extra;
  const cells = (list, z, attr, h = 0.8) => list.map((p, i) => `<g class="cpu-cell" ${attr}="${i}">${slab({ ...p, r: 0.5 }, z, h, { tone: "hi", bevel: 0 })}</g>`).join("");
  // front end: two-ahead predictor, 32 KB I-cache, 6K op cache, two 4-wide decode pipes
  put(U.bpu, unit("bpu", block("bpu", sram({ x: U.bpu.x, y: U.bpu.y, w: 24, d: U.bpu.d }, U.bpu.h, 1.6) + slab({ x: U.bpu.x + 27, y: U.bpu.y + 2, w: 24, d: 18, r: 0.6 }, U.bpu.h, 0.8, { tone: "hi", bevel: 0 }) + t.grid({ x: U.bpu.x + 27, y: U.bpu.y + 2, w: 24, d: 18 }, U.bpu.h + 0.8, 8, 6, { size: 0.4 })), "fe"));
  put(U.l1i, unit("l1i", block("l1i", sram(U.l1i, U.l1i.h, 1.8) + slab({ x: U.l1i.x, y: U.l1i.y + 15, w: U.l1i.w, d: 3, r: 0.3 }, U.l1i.h, 0.4, { tone: "hi", bevel: 0 })), "fe"));
  put(U.opc, unit("opc", block("opc", t.grid(k.insetPlan(U.opc, 2), U.opc.h, 24, 7, { size: 0.42, tone: "mid" })), "fe"));
  F.DECODERS.forEach((list, n) => {
    const u = n ? U.pipeB : U.pipeA;
    put(u, unit(n ? "pipeB" : "pipeA", block(n ? "pipeB" : "pipeA", cells(list, u.h, `data-dec${n}`, 1.2)), "fe"));
  });
  // dispatch and the out-of-order window
  put(U.dispatch, unit("dispatch", block("dispatch", cells(F.SLOTS, U.dispatch.h, "data-slot", 0.6)), "ooo"));
  put(U.rename, unit("rename", block("rename", t.grid(k.insetPlan(U.rename, 3), U.rename.h, 4, 3, { size: 0.6 })), "ooo"));
  put(U.rob, unit("rob", block("rob", cells(F.ROB_CELLS, U.rob.h, "data-rob", 0.6)), "ooo"));
  put(U.nsq, unit("nsq", block("nsq", t.grid(k.insetPlan(U.nsq, 2.5), U.nsq.h, 4, 3, { size: 0.55 })), "vec"));
  put(U.vren, unit("vren", block("vren", t.grid(k.insetPlan(U.vren, 3), U.vren.h, 3, 3, { size: 0.6 })), "vec"));
  // schedulers and the 14 execution pipes (+2 store-data)
  const slots = (u, n) => Array.from({ length: n }, (_, i) => outline({ x: u.x + 2 + (i * (u.w - 4)) / n, y: u.y + 2.5, w: (u.w - 4) / n - 1.2, d: u.d - 5, r: 0.4 }, u.h, { tone: "lo" })).join("");
  put(U.alusch, unit("alusch", block("alusch", slots(U.alusch, 6)), "int"));
  put(U.agusch, unit("agusch", block("agusch", slots(U.agusch, 4)), "mem"));
  put(U.fpsch, unit("fpsch", block("fpsch", slots(U.fpsch, 3)), "vec"));
  put(U.alus, unit("alus", block("alus", cells(F.PORT_PADS.alu, U.alus.h, "data-alu", 1)), "int"));
  put(U.agus, unit("agus", block("agus", cells(F.PORT_PADS.agu, U.agus.h, "data-agu", 1)), "mem"));
  put(U.fpp, unit("fpp", block("fpp", cells(F.PORT_PADS.fp, U.fpp.h, "data-fp", 1) + F.PORT_PADS.std.map((p) => slab({ ...p, r: 0.5 }, U.fpp.h, 0.6, { tone: "mid", bevel: 0 })).join("")), "vec"));
  // register files, load/store, L1D and L2
  put(U.gpr, unit("gpr", block("gpr", sram(U.gpr, U.gpr.h, 1.6, "x")), "int"));
  put(U.vrf, unit("vrf", block("vrf", sram(U.vrf, U.vrf.h, 1.2, "x")), "vec"));
  put(U.lsq, unit("lsq", block("lsq", t.grid(k.insetPlan(U.lsq, 2.5), U.lsq.h, 8, 3, { size: 0.5 })), "mem"));
  put(U.dtlb, unit("dtlb", block("dtlb", sram(U.dtlb, U.dtlb.h, 1.6, "x")), "mem"));
  put(U.l1d, unit("l1d", block("l1d", sram({ x: U.l1d.x, y: U.l1d.y, w: 48, d: U.l1d.d }, U.l1d.h, 1.6) + sram({ x: U.l1d.x + 54, y: U.l1d.y, w: 48, d: U.l1d.d }, U.l1d.h, 1.6) + slab({ x: U.l1d.x + 49, y: U.l1d.y, w: 4, d: U.l1d.d, r: 0.3 }, U.l1d.h, 0.5, { tone: "hi", bevel: 0 })), "cache"));
  put(U.l2, unit("l2", block("l2", sram({ x: U.l2.x, y: U.l2.y, w: 80, d: U.l2.d }, U.l2.h, 2) + sram({ x: U.l2.x + 92, y: U.l2.y, w: 80, d: U.l2.d }, U.l2.h, 2) + slab({ x: U.l2.x + 81, y: U.l2.y, w: 10, d: U.l2.d, r: 0.4 }, U.l2.h, 0.6, { tone: "hi", bevel: 0 })), "cache"));
  out.push(sortItems(items));
  // decoded ops travel from a decoder to a dispatch slot
  const mid = (p, z) => at([p.x + p.w / 2, p.y + p.d / 2, z]);
  const spot = { dec: F.DECODERS.map((list, n) => list.map((p) => mid(p, (n ? U.pipeB : U.pipeA).h + 1.4))), slot: F.SLOTS.map((p) => mid(p, U.dispatch.h + 0.8)) };
  out.push(`<g data-ops></g>`);
  return { svg: out.join(""), spot };
}

// ---------------------------------------------------------------- page
const L1 = layer1();
const L2 = layer2();
const L3 = layer3();
const C0 = CCDS[0];
const A12 = similarity(P1, [[C0.x, C0.y, CCD_TOP + PK + CL], [C0.x + C0.w, C0.y + C0.d, CCD_TOP + PK + CL]], P2, [[F.CCD.x, F.CCD.y, 0], [F.CCD.x + F.CCD.w, F.CCD.y + F.CCD.d, 0]]);
const T0 = F.CORES[1];
const A23 = similarity(P2, [[T0.x, T0.y, F.CORE_H], [T0.x + T0.w, T0.y + T0.d, F.CORE_H]], P3, [[F.CORE.x, F.CORE.y, 0], [F.CORE.x + F.CORE.w, F.CORE.y + F.CORE.d, 0]]);

const r2 = (p) => p.map((n) => +n.toFixed(2));
const r2all = (v) => (typeof v[0] === "number" ? r2(v) : v.map(r2all));
const pts = {
  board: r2(k.iso([0, -60, 30], P1)),
  socket: r2(k.iso([0, 0, 10], P1)),
  pkg: r2(k.iso([0, 0, PK + 14], P1)),
  dies: r2(k.iso([0, -20, PK + 16], P1)),
  iod: r2(k.iso([0, 12, PK + 13], P1)),
  ccds: r2(k.iso([0, -43, PK + CL + 13], P1)),
  cores: r2(k.iso([0, -38, 1], P2)),
  l3: r2(k.iso([0, 0, -8], P2)),
  fe: r2(k.iso([0, -54, 5], P3)),
  ooo: r2(k.iso([0, -14, 5], P3)),
  exec: r2(k.iso([0, 18, 4], P3)),
  mem: r2(k.iso([0, 56, 4], P3)),
};
const lift = r2(k.iso([0, 0, 1], P1).map((n, i) => n - k.iso([0, 0, 0], P1)[i]));
const spots = (o) => Object.fromEntries(Object.entries(o).map(([key, v]) => [key, r2all(v)]));
const DATA = { A12, A23, W, H, pts, lift, pk: PK, cl: CL, spot2: spots(L2.spot), spot3: spots(L3.spot) };

const svg = (cls, body, label) => k.figureSvg({ width: W, height: H, label, className: `cpu-layer ${cls}`, body: `<g class="cpu-cam">${body}</g>` });
const SLIDES = readFileSync(join(HERE, "slides.html"), "utf8");
const count = (SLIDES.match(/class="cpu-slide/g) || []).length;
const body = `<div class="cpu-track" style="height:${count * 100}vh">
<div class="cpu-screen">
  <div class="cpu-progress" aria-hidden="true"><span data-bar></span></div>
  <div class="cpu-art"><div class="cpu-stage" role="group" aria-label="Ryzen 9 9950X3D2 processor figure. Scroll, or use the arrow keys, to move from slide to slide.">
${svg("cpu-l1", L1, "A desktop motherboard around an AMD AM5 socket: two DDR5 modules, finned VRM heatsinks over chokes, an M.2 heatsink and a PCIe x16 slot. In the socket sits the Ryzen 9 9950X3D2 under its load plate and lever; under its notched heat spreader are an I/O die and two CCDs, each stacked on a 64 MB cache die.")}
${svg("cpu-l2", L2.svg, "One Zen 5 CCD lifted off the 64 MB SRAM die beneath it: eight cores along the two long edges with their L2, 32 MB of L3 in eight slices down the middle, and the Infinity Fabric link at one end.")}
${svg("cpu-l3", L3.svg, "One Zen 5 core: two-ahead branch predictor, 32 KB instruction cache, 6K op cache, two 4-wide decode pipes, 8-wide dispatch, rename and the 448-entry reorder buffer, integer, address and floating-point schedulers, 6 ALUs, 4 AGUs and 4 FP pipes, register files, load/store queues, 48 KB L1 data cache and 1 MB L2.")}
  </div></div>
  <div class="cpu-corners" aria-hidden="true"><span data-corner="fig" data-fig>Fig 1</span><span data-corner="title" data-title>9950X3D2</span><span data-corner="readout" data-readout></span></div>
  <div class="cpu-captions">${SLIDES}</div>
  <nav class="cpu-nav" aria-label="Slides"><button type="button" data-go="-1" aria-label="Previous slide">↑</button><span data-count>01 / ${String(count).padStart(2, "0")}</span><button type="button" data-go="1" aria-label="Next slide">↓</button><button type="button" data-play aria-label="Play slideshow">▶</button><button type="button" data-music aria-label="Mute music">♪</button><a class="cpu-home" href="../">All CPUs</a></nav>
  <div class="cpu-live" aria-live="polite" data-live></div>
</div>
</div>
${readFileSync(join(HERE, "sources.html"), "utf8")}`;

const css = readFileSync(join(HERE, "../shared/deck.css"), "utf8") + readFileSync(join(HERE, "tour.css"), "utf8");
const live = readFileSync(join(HERE, "live.js"), "utf8") + readFileSync(join(HERE, "../shared/play.js"), "utf8") + readFileSync(join(HERE, "../shared/ambient.js"), "utf8");
const model = readFileSync(join(HERE, "model.mjs"), "utf8").replace(/^export /gm, "");
const script = kitScript() + "\n" + model + `\nconst DATA = ${JSON.stringify(DATA)};\n` + live;
const html = k
  .pageHtml({ title: "Inside the Ryzen 9 9950X3D2", theme, body, script, width: 1180 })
  .replace("</style>", `${css}</style>`)
  .replace('<main class="iso-page">', '<main class="cpu-page">');
const name = theme === "light" ? "light.html" : "index.html";
// the built page lands in the site folder named after this tour: src/<tour> → <tour>/
writeFileSync(join(HERE, "../..", basename(HERE), name), html);
console.log("wrote", name, (html.length / 1024).toFixed(0) + " KB", count, "slides", "A12", A12.s.toFixed(2), "A23", A23.s.toFixed(2));
