
// ---------------------------------------------------------------- refs
const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const track = $(".cpu-track");
const stageEl = $(".cpu-stage");
const layers = $$(".cpu-layer", stageEl);
const cams = layers.map((l) => $(".cpu-cam", l));
const slideEls = $$(".cpu-slide");
const N = slideEls.length;
const still = matchMedia("(prefers-reduced-motion: reduce)");
const corner = { fig: $("[data-fig]"), title: $("[data-title]"), readout: $("[data-readout]") };
const bar = $("[data-bar]");
const counter = $("[data-count]");
const liveRegion = $("[data-live]");
const smooth = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
const lerp = (a, b, t) => a + (b - a) * t;
const f2 = (n) => Math.round(n * 1000) / 1000;
const V0 = [DATA.W / 2, DATA.H / 2];
const P = DATA.pts;
const SVGNS = "http://www.w3.org/2000/svg";

// ---------------------------------------------------------------- camera
// Each layer draws at its own scale: L2 = A12(L1), L3 = A23(L2) in screen units,
// so one camera expressed in L1 units keeps all three in register.
const S = [1, DATA.A12.s, DATA.A12.s * DATA.A23.s];
const T = [[0, 0], [DATA.A12.tx, DATA.A12.ty], [DATA.A23.s * DATA.A12.tx + DATA.A23.tx, DATA.A23.s * DATA.A12.ty + DATA.A23.ty]];
const camOf = (L, z = 1, q = V0) => ({ z: S[L] * z, q: [(q[0] - T[L][0]) / S[L], (q[1] - T[L][1]) / S[L]] });

// lift = [load plate, package, lid, compute dies]; fade = [load plate, lid] opacity
const UP = 300, PK = DATA.pk, CL = DATA.cl;
const OPEN = { lift: [UP, PK, UP, CL], fade: [0, 0] };
const none = [[], [], []];
const SLIDES = [
  { cam: camOf(0), lift: [0, 0, 0, 0], fade: [1, 1], on: none, fig: "Fig 1", title: "9950X3D2", read: "16 cores · 208 MB cache · AM5" },
  { cam: camOf(0, 1.45, P.socket), lift: [60, 0, 0, 0], fade: [1, 1], on: [["plate", "frame"], [], []], fig: "Fig 1", title: "Load plate", read: "plate · lever · stiffener frame" },
  { cam: camOf(0, 1.35, P.pkg), lift: [UP, PK, 0, 0], fade: [0, 1], on: [["pins", "socket"], [], []], fig: "Fig 1", title: "AM5 socket", read: "LGA 1718 · 40 × 40 mm package" },
  { cam: camOf(0, 2.5, P.dies), lift: [UP, PK, UP, 0], fade: [0, 0], on: [["ccd", "iod"], [], []], fig: "Fig 1", title: "Chiplets", read: "2 × CCD · 1 × I/O die" },
  { cam: camOf(0, 3.3, P.iod), lift: [UP, PK, UP, 0], fade: [0, 0], on: [["iod", "fabric"], [], []], fig: "Fig 1", title: "I/O die", read: "TSMC 6 nm · 28 PCIe 5.0 lanes · DDR5", demo: "fabric" },
  { cam: camOf(0, 3.1, P.ccds), ...OPEN, on: [["vcache"], [], []], fig: "Fig 1", title: "Stacked cache", read: "64 MB SRAM under each CCD" },
  { cam: camOf(1), ...OPEN, on: none, fig: "Fig 2", title: "One CCD", read: "8 cores · 32 MB L3 · 70.6 mm²" },
  { cam: camOf(1, 1.3, P.cores), ...OPEN, on: [[], ["core"], []], fig: "Fig 2", title: "Zen 5 cores", read: "8 × Zen 5 · 1 MB L2 each", demo: "cores" },
  { cam: camOf(1, 1.1, P.l3), ...OPEN, on: [[], ["l3", "vcache"], []], fig: "Fig 2", title: "L3", read: "32 MB + 64 MB = 96 MB per CCD" },
  { cam: camOf(2), ...OPEN, on: none, fig: "Fig 3", title: "Zen 5 core", read: "8-wide · 448-entry ROB" },
  { cam: camOf(2, 1.55, P.fe), ...OPEN, on: [[], [], ["bpu", "l1i", "opc", "pipeA", "pipeB"]], fig: "Fig 3", title: "Front end", demo: "decode" },
  { cam: camOf(2, 1.5, P.ooo), ...OPEN, on: [[], [], ["dispatch", "rename", "rob", "nsq", "vren"]], fig: "Fig 3", title: "Out of order", demo: "rob" },
  { cam: camOf(2, 1.55, P.exec), ...OPEN, on: [[], [], ["alusch", "agusch", "fpsch", "alus", "agus", "fpp"]], fig: "Fig 3", title: "Execution", demo: "ports" },
  { cam: camOf(2, 1.55, P.mem), ...OPEN, on: [[], [], ["lsq", "dtlb", "l1d", "l2"]], fig: "Fig 3", title: "Loads", read: "L1D 48 KB, 4 cycles · L2 1 MB, 14 cycles" },
  { cam: camOf(1), ...OPEN, on: [[], ["l3", "vcache"], []], fig: "Fig 2", title: "Working set", demo: "explore" },
  { cam: camOf(0, 2.3, P.dies), ...OPEN, on: [["vcache", "ccd"], [], []], fig: "Fig 1", title: "Both stacked", read: "2 × 96 MB L3 · 192 MB" },
];

// Zoom from camera a to camera b about their common fixed point.
function camAt(a, b, t) {
  const r = b.z / a.z;
  const z = a.z * Math.pow(r, t);
  if (Math.abs(r - 1) < 1e-6) return { z, q: [lerp(a.q[0], b.q[0], t), lerp(a.q[1], b.q[1], t)] };
  const X = [V0[0] + ((a.q[0] - b.q[0]) * b.z) / (1 - r), V0[1] + ((a.q[1] - b.q[1]) * b.z) / (1 - r)];
  const k = 1 - Math.pow(r, t);
  return { z, q: [a.q[0] - ((X[0] - V0[0]) * k) / z, a.q[1] - ((X[1] - V0[1]) * k) / z] };
}
let opacity = [1, 0, 0];
function placeLayers(cam) {
  const lz = Math.log(cam.z);
  const l12 = lz / Math.log(S[1]);
  const l23 = (lz - Math.log(S[1])) / Math.log(S[2] / S[1]);
  opacity = [1 - smooth(0.86, 0.99, l12), smooth(0.5, 0.86, l12) * (1 - smooth(0.86, 0.99, l23)), smooth(0.5, 0.86, l23)];
  layers.forEach((layer, L) => {
    const z = cam.z / S[L];
    const tx = V0[0] - cam.z * (cam.q[0] + T[L][0] / S[L]);
    const ty = V0[1] - cam.z * (cam.q[1] + T[L][1] / S[L]);
    const visible = opacity[L] > 0.002;
    layer.style.opacity = visible ? f2(opacity[L]) : "0";
    layer.style.visibility = visible ? "visible" : "hidden";
    if (visible) cams[L].setAttribute("transform", `translate(${f2(tx)} ${f2(ty)}) scale(${Math.round(z * 1e5) / 1e5})`);
  });
}

// ---------------------------------------------------------------- L1: the socket opens, the package comes apart
const lifts = ["plate", "cpu", "ihs", "ccd"].map((name) => $(`[data-lift="${name}"]`, layers[0]));
function placeLifts(lift, fade) {
  lifts.forEach((el, i) => {
    const h = lift[i];
    if (h < 0.01) el.removeAttribute("transform");
    else el.setAttribute("transform", `translate(${f2(DATA.lift[0] * h)} ${f2(DATA.lift[1] * h)})`);
  });
  lifts[0].style.opacity = f2(fade[0]);
  lifts[2].style.opacity = f2(fade[1]);
}
// packets along the two Infinity Fabric links
const fabPaths = $$("[data-fab-path]", layers[0]);
const fabDots = $$("[data-fab-dot]", layers[0]);
const fabLen = fabPaths.map((p) => p.getTotalLength());
let fabOn = false, fabShare = 0;
function placeFabric(clock, dt) {
  fabShare += ((fabOn ? 1 : 0) - fabShare) * (1 - Math.exp(-dt / 0.3));
  if (fabShare < 0.01) { fabDots.forEach((d) => (d.style.opacity = "0")); return false; }
  fabDots.forEach((d, n) => {
    const link = n % 2, dir = n % 3 ? 1 : -1;
    const u = (((dir * clock * 0.5 + n / fabDots.length) % 1) + 1) % 1;
    const pt = fabPaths[link].getPointAtLength(u * fabLen[link]);
    d.setAttribute("cx", pt.x.toFixed(2));
    d.setAttribute("cy", pt.y.toFixed(2));
    d.style.opacity = (0.95 * fabShare * Math.sin(Math.PI * u)).toFixed(2);
  });
  return true;
}

// ---------------------------------------------------------------- selection, captions, chrome
let shown = -1, demo = null;
function setOn(layer, names) {
  layer.toggleAttribute("data-focus", names.length > 0);
  $$(".it", layer).forEach((el) => el.toggleAttribute("data-on", names.includes(el.dataset.unit)));
}
function showSlide(i) {
  if (i === shown) return;
  shown = i;
  const st = SLIDES[i];
  layers.forEach((layer, L) => setOn(layer, st.on[L]));
  slideEls.forEach((el, n) => el.toggleAttribute("data-active", n === i));
  corner.fig.textContent = st.fig;
  corner.title.textContent = st.title;
  counter.textContent = `${String(i + 1).padStart(2, "0")} / ${String(N).padStart(2, "0")}`;
  fabOn = st.demo === "fabric";
  layers[1].toggleAttribute("data-phy", st.demo === "explore");
  startDemo(st.demo);
  if (st.read) corner.readout.textContent = st.read;
}

// ---------------------------------------------------------------- scroll → slide position
let forced = null; // test hook: pins the slide position regardless of scroll
const readScroll = () => forced ?? Math.min(N - 1, Math.max(0, (scrollY - track.offsetTop) / innerHeight));
let pShown = 0;
function render(p) {
  const i = Math.min(N - 2, Math.floor(p));
  const f = p - i;
  const e = smooth(0.2, 0.8, f);
  const a = SLIDES[i], b = SLIDES[i + 1];
  placeLayers(camAt(a.cam, b.cam, e));
  // parts move in the first half of a transition, so a zoom always lands on a settled pose
  const m = smooth(0.12, 0.5, f);
  placeLifts(a.lift.map((v, n) => lerp(v, b.lift[n], m)), a.fade.map((v, n) => lerp(v, b.fade[n], m)));
  bar.style.width = `${f2((p / (N - 1)) * 100)}%`;
  showSlide(Math.round(p));
}

// ---------------------------------------------------------------- moving dots (decoded ops, loads)
// A dot flies along a list of screen points over `dur` seconds, then fades out.
const flyers = [];
function fly(group, route, dur, cls, hold = 0.25) {
  const el = document.createElementNS(SVGNS, "circle");
  el.setAttribute("r", cls === "cpu-op" ? "1.5" : "1.25");
  el.setAttribute("class", cls);
  group.appendChild(el);
  flyers.push({ el, route, dur, hold, t: 0 });
}
function placeFlyers(dt) {
  for (let i = flyers.length - 1; i >= 0; i--) {
    const f = flyers[i];
    f.t += dt;
    const u = Math.min(1, f.t / f.dur);
    const legs = f.route.length - 1;
    const x = u * legs, n = Math.min(legs - 1, Math.floor(x)), e = smooth(0, 1, x - n);
    const [ax, ay] = f.route[n], [bx, by] = f.route[n + 1];
    f.el.setAttribute("cx", f2(lerp(ax, bx, e)));
    f.el.setAttribute("cy", f2(lerp(ay, by, e)));
    const o = smooth(0, 0.12, f.t) * (1 - smooth(f.dur, f.dur + f.hold, f.t));
    f.el.style.opacity = f2(o);
    if (f.t > f.dur + f.hold) { f.el.remove(); flyers.splice(i, 1); }
  }
  return flyers.length > 0;
}
function clearFlyers() { flyers.forEach((f) => f.el.remove()); flyers.length = 0; }

// ---------------------------------------------------------------- L2: cores, and the working-set explorer
const coreEls = $$("[data-core]", layers[1]);
const packets = $("[data-packets]", layers[1]);
const S2 = DATA.spot2;
const range = $("[data-ws-range]");
const wsOut = $("[data-ws]");
const bars = { x3d: $('[data-bar-of="x3d"]'), plain: $('[data-bar-of="plain"]') };
const shareOut = $("[data-share]");
const LEVEL = ["L1", "L2", "L3", "DRAM"];
const wsOf = (v) => Math.pow(2, (v / 100) * 9); // 1 MB … 512 MB
const mb = (n) => (n < 10 ? n.toFixed(1) : Math.round(n)) + " MB";
let ws = wsOf(+range.value), mem = memory(ws), memPlain = memory(ws, L3_PLAIN), loadClock = 0;
const rand = rng(11);
function paintExplorer() {
  ws = wsOf(+range.value);
  mem = memory(ws);
  memPlain = memory(ws, L3_PLAIN);
  wsOut.textContent = mb(ws);
  const worst = memory(512, L3_PLAIN).ns;
  for (const [key, m] of [["x3d", mem], ["plain", memPlain]]) {
    bars[key].style.setProperty("--w", f2(Math.max(0.02, m.ns / worst)));
    $("[data-ns]", bars[key]).textContent = `${m.ns.toFixed(1)} ns`;
  }
  shareOut.textContent = mem.share.map((s, i) => `${LEVEL[i]} ${Math.round(s * 100)}%`).join(" · ");
  if (shown === 14) corner.readout.textContent = `${mb(ws)} set · ${mem.ns.toFixed(1)} ns avg load · ${Math.round(mem.share[3] * 100)}% to DRAM`;
}
range.addEventListener("input", () => { paintExplorer(); kick(); });
function launchLoad() {
  const level = levelOf(mem.share, rand());
  const slice = Math.floor(rand() * 8);
  const route = [S2.core];
  if (level === 0) route.push(S2.l1);
  else if (level === 1) route.push(S2.l2);
  else if (level === 2) {
    route.push(S2.l2, S2.l3[slice]);
    if (rand() < 64 / 96) route.push(S2.vc[slice]); // two thirds of the L3 lives on the die below
  } else route.push(S2.l2, S2.phy, S2.out);
  fly(packets, route, 0.5 + route.length * 0.22, `cpu-load cpu-load-${LEVEL[level].toLowerCase()}`, 0.3);
}

// ---------------------------------------------------------------- L3: decode pipes, the reorder buffer, the ports
const L3 = layers[2];
const ops = $("[data-ops]", L3);
const S3 = DATA.spot3;
const decEls = [0, 1].map((n) => $$(`[data-dec${n}]`, L3));
const slotEls = $$("[data-slot]", L3);
const robEls = $$("[data-rob]", L3);
const portEls = { alu: $$("[data-alu]", L3), agu: $$("[data-agu]", L3), fp: $$("[data-fp]", L3) };
const threadBtns = $$("[data-threads]");
let threads = 2, robHead = 0, robCount = 0;
const issue = rng(5);
threadBtns.forEach((b) => b.addEventListener("click", () => {
  threads = +b.dataset.threads;
  threadBtns.forEach((x) => x.setAttribute("aria-pressed", String(x === b)));
  if (shown === 10) corner.readout.textContent = decodeReadout();
  kick();
}));
const decodeReadout = () => `${threads} thread${threads > 1 ? "s" : ""} · ${decodeRate(threads)} ops decoded per cycle`;
function decodeStep() {
  decEls.forEach((list, n) => list.forEach((el) => el.toggleAttribute("data-on", n < threads)));
  slotEls.forEach((el, i) => el.toggleAttribute("data-on", i < decodeRate(threads)));
  for (let n = 0; n < threads; n++) for (let i = 0; i < 4; i++) fly(ops, [S3.dec[n][i], S3.slot[n * 4 + i]], 0.45, `cpu-op cpu-op-${n}`, 0.2);
}
function robStep() {
  // 8 ops dispatch into the tail each cycle; once the window is full, 8 retire from the head
  if (robCount < robEls.length) robCount++;
  else robHead = (robHead + 1) % robEls.length;
  robEls.forEach((el, i) => el.toggleAttribute("data-on", ((i - robHead + robEls.length) % robEls.length) < robCount));
  slotEls.forEach((el) => el.toggleAttribute("data-on", true));
  corner.readout.textContent = `${robCount * 8} of 448 entries in flight`;
}
function portStep() {
  const c = issueCycle(issue);
  let n = { alu: 0, agu: 0, fp: 0 };
  for (const key of Object.keys(portEls)) portEls[key].forEach((el, i) => { el.toggleAttribute("data-on", c[key][i]); n[key] += c[key][i] ? 1 : 0; });
  corner.readout.textContent = `this cycle: ${n.alu} ALU · ${n.agu} AGU · ${n.fp} FP`;
}
function clearCells() { [...decEls.flat(), ...slotEls, ...robEls, ...Object.values(portEls).flat()].forEach((el) => el.removeAttribute("data-on")); }

// ---------------------------------------------------------------- demo switch
let stepClock = 0, coreTurn = -1;
function startDemo(name) {
  if (name === demo) return;
  demo = name;
  clearFlyers();
  clearCells();
  coreEls.forEach((el) => el.removeAttribute("data-on"));
  stepClock = 0;
  robHead = 0; robCount = 0;
  if (name === "decode") { corner.readout.textContent = decodeReadout(); decodeStep(); }
  if (name === "explore") paintExplorer();
}
function tickDemo(dt) {
  if (!demo || still.matches) return false;
  stepClock += dt;
  if (demo === "decode" && stepClock > 0.8) { stepClock = 0; decodeStep(); }
  if (demo === "rob" && stepClock > 0.14) { stepClock = 0; robStep(); }
  if (demo === "ports" && stepClock > 0.4) { stepClock = 0; portStep(); }
  if (demo === "cores") {
    const n = Math.floor(clock / 0.7) % 8;
    if (n !== coreTurn) { coreTurn = n; coreEls.forEach((el) => el.toggleAttribute("data-on", +el.dataset.core === n)); }
  }
  if (demo === "explore") { loadClock += dt; while (loadClock > 0.09) { loadClock -= 0.09; launchLoad(); } }
  return demo !== "fabric";
}

// ---------------------------------------------------------------- deck navigation
function go(by) {
  const target = Math.min(N - 1, Math.max(0, Math.round(readScroll()) + by));
  scrollTo({ top: track.offsetTop + target * innerHeight, behavior: still.matches ? "auto" : "smooth" });
}
$$("[data-go]").forEach((b) => b.addEventListener("click", () => go(+b.dataset.go)));
addEventListener("keydown", (ev) => {
  const by = { ArrowDown: 1, ArrowRight: 1, ArrowUp: -1, ArrowLeft: -1 }[ev.key];
  if (!by || ev.target.closest("input")) return;
  ev.preventDefault();
  go(by);
});

// ---------------------------------------------------------------- loop
let frame = 0, last = 0, clock = 0;
function tick(now) {
  const dt = last ? Math.min((now - last) / 1000, 1 / 30) : 1 / 60;
  last = now;
  clock += dt;
  const pTarget = readScroll();
  pShown = still.matches ? pTarget : pShown + (pTarget - pShown) * (1 - Math.exp(-dt / 0.14));
  if (Math.abs(pTarget - pShown) < 1e-4) pShown = pTarget;
  render(pShown);
  const fabMoving = opacity[0] > 0.01 && !still.matches && placeFabric(clock, dt);
  const demoMoving = tickDemo(dt);
  const flying = placeFlyers(dt);
  const busy = pShown !== pTarget || fabMoving || demoMoving || flying;
  frame = busy ? requestAnimationFrame(tick) : 0;
}
function kick() { if (!frame) { last = 0; frame = requestAnimationFrame(tick); } }
addEventListener("scroll", kick, { passive: true });
addEventListener("resize", kick);
document.addEventListener("visibilitychange", () => { if (!document.hidden) kick(); });
pShown = readScroll();
render(pShown);
paintExplorer();
kick();
window.__cpu = { get slide() { return shown; }, at(p) { forced = p; kick(); } };
