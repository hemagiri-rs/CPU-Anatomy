
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

// ---------------------------------------------------------------- camera
// Each layer draws at its own scale: L2 = A12(L1), L3 = A23(L2) in screen units,
// so one camera expressed in L1 units keeps all three in register.
const S = [1, DATA.A12.s, DATA.A12.s * DATA.A23.s];
const T = [[0, 0], [DATA.A12.tx, DATA.A12.ty], [DATA.A23.s * DATA.A12.tx + DATA.A23.tx, DATA.A23.s * DATA.A12.ty + DATA.A23.ty]];
const camOf = (L, z = 1, q = V0) => ({ z: S[L] * z, q: [(q[0] - T[L][0]) / S[L], (q[1] - T[L][1]) / S[L]] });

// lift = [cooling module, package, tiles]; fade = cooling module opacity
const UP = 320, PK = DATA.pkgLift;
const DOWN = { lift: [UP, PK, 0], fade: 0 };
const SLIDES = [
  { cam: camOf(0), lift: [0, 0, 0], fade: 1, on: [[], [], []], fig: "Fig 1", title: "Panther Lake", read: "Core Ultra Series 3 · Intel 18A", demo: "fan" },
  { cam: camOf(0), lift: [120, 0, 0], fade: 1, on: [["cooler"], [], []], fig: "Fig 1", title: "Cooling module", read: "2 heat pipes · 13 fins · blower", demo: "fan" },
  { cam: camOf(0, 1.5, P.pkg), lift: [UP, PK, 0], fade: 0, on: [["package", "bga", "ram"], [], []], fig: "Fig 1", title: "Package", read: "BGA · 4 × LPDDR5X" },
  { cam: camOf(0, 2.2, P.pkg), lift: [UP, PK, 22], fade: 0, on: [["compute", "gpu", "pct"], [], []], fig: "Fig 1", title: "Foveros tiles", read: "compute 18A · GPU N3E · PCT TSMC" },
  { cam: camOf(1), ...DOWN, on: [[], [], []], fig: "Fig 2", title: "Compute tile", read: "14.3 × 8.0 mm · 16 cores" },
  { cam: camOf(1, 1.3, P.pcores), ...DOWN, on: [[], ["pcore"], []], fig: "Fig 2", title: "P-cores", read: "4 × Cougar Cove", demo: "cores" },
  { cam: camOf(1, 1.3, P.ecores), ...DOWN, on: [[], ["ecore", "lpe"], []], fig: "Fig 2", title: "E-cores", read: "8 Darkmont + 4 LP Darkmont" },
  { cam: camOf(1, 1.15, P.cache), ...DOWN, on: [[], ["l3", "ring", "msc"], []], fig: "Fig 2", title: "Cache and ring", read: "18 MB L3 · 8 MB memory-side", demo: "ring" },
  { cam: camOf(1, 1.5, P.npu), ...DOWN, on: [[], ["npu", "media"], []], fig: "Fig 2", title: "NPU and media", read: "NPU 5 · up to 50 TOPS" },
  { cam: camOf(1, 1.35, P.phy), ...DOWN, on: [[], ["phy"], []], fig: "Fig 2", title: "Memory interface", read: "128-bit · LPDDR5X-9600", demo: "phy" },
  { cam: camOf(2), ...DOWN, on: [[], [], []], fig: "Fig 3", title: "P-core", demo: "sim" },
  { cam: camOf(2, 1.6, P.fe), ...DOWN, on: [[], [], ["bpu", "icache", "uopc", "decode", "queue"]], fig: "Fig 3", title: "Front end", demo: "sim" },
  { cam: camOf(2, 1.55, P.ooo), ...DOWN, on: [[], [], ["rename", "rob", "isched", "vsched", "msched"]], fig: "Fig 3", title: "Out of order", demo: "sim" },
  { cam: camOf(2, 1.6, P.exec), ...DOWN, on: [[], [], ["iports", "vports", "mports", "irf"]], fig: "Fig 3", title: "Execution ports", demo: "sim" },
  { cam: camOf(2, 1.5, P.mem), ...DOWN, on: [[], [], ["dtlb", "l0", "l1", "l2", "sbuf"]], fig: "Fig 3", title: "Memory pipeline", demo: "sim" },
  { cam: camOf(2, 1.1, P.ooo), ...DOWN, on: [[], [], ["rob", "bpu"]], fig: "Fig 3", title: "Speculation", demo: "late" },
  { cam: camOf(2), ...DOWN, on: [[], [], []], fig: "Fig 3", title: "Running", demo: "run" },
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

// ---------------------------------------------------------------- L1: explode and blower
const lifts = ["cooler", "pkg", "tiles"].map((name) => $(`[data-lift="${name}"]`, layers[0]));
function placeLifts(lift, fade) {
  lifts.forEach((el, i) => {
    const h = lift[i];
    if (h < 0.01) el.removeAttribute("transform");
    else el.setAttribute("transform", `translate(${f2(DATA.lift[0] * h)} ${f2(DATA.lift[1] * h)})`);
  });
  lifts[0].style.opacity = f2(fade);
}
const blades = $("[data-blades] path", layers[0]);
let fanAngle = 0, fanSpeed = 0;
function placeFan(dt, want) {
  fanSpeed += (want - fanSpeed) * (1 - Math.exp(-dt / 0.6));
  if (fanSpeed < 0.01 && want === 0) { fanSpeed = 0; return false; }
  fanAngle = (fanAngle + fanSpeed * dt) % (Math.PI * 2);
  const { P: FP, x, y, z, r0, r1 } = DATA.fan;
  const d = [];
  for (let b = 0; b < 23; b++) {
    const a0 = (b / 23) * Math.PI * 2 + fanAngle;
    const pts = [];
    for (let r = r0; r <= r1 + 0.01; r += 3) pts.push([x + Math.cos(a0 + (r - r0) * 0.04) * r, y + Math.sin(a0 + (r - r0) * 0.04) * r]);
    d.push(onTop(pts, z, FP));
  }
  blades.setAttribute("d", d.join(""));
  return true;
}

// ---------------------------------------------------------------- selection, captions, chrome
let shown = -1;
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
  layers[1].toggleAttribute("data-phy", st.demo === "phy");
  ringOn = st.demo === "ring";
  startSim(st.demo);
  corner.readout.textContent = st.read ?? simReadout();
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
  placeLifts(a.lift.map((v, n) => lerp(v, b.lift[n], m)), lerp(a.fade, b.fade, m));
  bar.style.width = `${f2((p / (N - 1)) * 100)}%`;
  showSlide(Math.round(p));
}

// ---------------------------------------------------------------- tile view demos
const ringPath = $("[data-ring-path]", layers[1]);
const ringDots = $$("[data-ring-dot]", layers[1]);
const ringLen = ringPath.getTotalLength();
let ringOn = false, ringShare = 0;
function placeRing(clock, dt) {
  ringShare += ((ringOn ? 1 : 0) - ringShare) * (1 - Math.exp(-dt / 0.3));
  if (ringShare < 0.01) { ringDots.forEach((d) => (d.style.opacity = "0")); return false; }
  ringDots.forEach((d, n) => {
    const dir = n % 2 ? 1 : -1;
    const u = (((dir * clock * 0.06 + n / ringDots.length) % 1) + 1) % 1;
    const pt = ringPath.getPointAtLength(u * ringLen);
    d.setAttribute("cx", pt.x.toFixed(2));
    d.setAttribute("cy", pt.y.toFixed(2));
    d.style.opacity = (0.95 * ringShare).toFixed(2);
  });
  return true;
}
const coreEls = $$("[data-core]", layers[1]);
let coreTurn = -1;
function placeCores(clock) {
  const n = Math.floor(clock / 0.8) % 4;
  if (n === coreTurn) return;
  coreTurn = n;
  coreEls.forEach((el) => el.toggleAttribute("data-on", +el.dataset.core === n));
}

// ---------------------------------------------------------------- the P-core: micro-ops as tokens
const L3 = layers[2];
const tokenLayer = $("[data-tokens]", L3);
const template = $("[data-token-template] > g", L3);
const showText = (id, value) => { const t = $(`[data-show="${id}"] text`, L3); if (t && t.textContent !== value) t.textContent = value; };
const lines = $$(".cpu-listing li");
const robSlots = $$("[data-robslot]", L3);
const portEls = Object.fromEntries($$("[data-port]", L3).map((el) => [el.dataset.port, el]));
const TINT = { int: "int", branch: "ooo", load: "mem", store: "mem", vec: "vec" };
const SL = DATA.slots;
let sim = boot(), mode = null, running = false, steps = 0, autoRan = false, rest = 0;
let tween = null; // { t, dur }
const tokens = new Map(); // id → { el, from, to, gone }

// where a uop sits on the drawing in a given state
function placeOf(s, u) {
  const same = (stage, pick) => s.uops.filter((x) => x.stage === stage && pick(x));
  if (u.stage === "fetch") return SL.fetch[u.lane % 8];
  if (u.stage === "decode") return SL.decode[u.lane % 8];
  if (u.stage === "queue") return SL.queue[same("queue", () => true).indexOf(u) % SL.queue.length];
  if (u.stage === "sched") {
    const group = (x) => (x.cls === "branch" || x.cls === "int" ? "int" : x.cls === "vec" ? "vec" : "mem");
    const g = group(u);
    const list = g === "int" ? SL.isched : g === "vec" ? SL.vsched : SL.msched;
    return list[same("sched", (x) => group(x) === g).indexOf(u) % list.length];
  }
  if (u.stage === "exec") {
    const k = u.cls === "branch" ? "int" : u.cls;
    if (k === "load" && s.cycle > u.issuedAt) return (u.level === "L0" ? SL.L0 : SL.L1)[u.port % 3];
    return SL[k][u.port % SL[k].length];
  }
  return SL.rob[u.rob % SL.rob.length];
}
function makeToken(u) {
  const el = template.cloneNode(true);
  el.setAttribute("class", "cpu-token");
  el.style.setProperty("--tint", `var(--d-${TINT[u.cls] || "int"})`);
  el.style.opacity = "0";
  tokenLayer.appendChild(el);
  return el;
}
function clearTokens() { tokens.forEach((t) => t.el.remove()); tokens.clear(); }
function paintSim(s) {
  s.regs.forEach((v, i) => showText(`r${i}`, `r${i} ${v}`));
  showText("m14", `n ${s.mem[14]}`);
  showText("m15", `s ${s.mem[15]}`);
  const occupied = new Set(s.uops.filter((u) => u.rob != null).map((u) => u.rob % robSlots.length));
  robSlots.forEach((el, i) => el.toggleAttribute("data-on", occupied.has(i)));
  const head = s.uops.find((u) => u.rob != null);
  lines.forEach((li, n) => li.toggleAttribute("data-on", head ? head.pc === n : false));
}
function simReadout(s = sim, extra = "") {
  if (s.halted) return `done · sum ${s.mem[15]} · ${s.retired} retired in ${s.cycle} cycles · IPC ${(s.retired / s.cycle).toFixed(2)}`;
  return `cycle ${s.cycle} · ${s.retired} retired${s.cycle ? ` · IPC ${(s.retired / s.cycle).toFixed(2)}` : ""}${extra}`;
}
// one clock tick of the model, played as a tween of every token
function advance() {
  const next = cycle(sim);
  const flushed = new Set(next.events.filter((e) => e.kind === "flush").flatMap((e) => e.ids));
  const retired = new Set(next.events.filter((e) => e.kind === "retire").map((e) => e.id));
  for (const [id, t] of tokens) {
    t.from = t.pos;
    if (flushed.has(id)) { t.el.setAttribute("data-flush", ""); t.gone = "flush"; t.to = t.pos; }
    else if (retired.has(id) || next.halted) { t.gone = "retire"; t.to = t.pos; }
  }
  for (const u of next.uops) {
    let t = tokens.get(u.id);
    const to = placeOf(next, u);
    if (!t) { t = { el: makeToken(u), from: to, pos: to, born: true }; tokens.set(u.id, t); }
    else t.born = false;
    t.to = to;
  }
  Object.values(portEls).forEach((el) => el.removeAttribute("data-on"));
  for (const e of next.events) if (e.kind === "issue") portEls[`${e.cls}-${e.port}`]?.setAttribute("data-on", "");
  const flush = next.events.find((e) => e.kind === "flush");
  sim = next;
  paintSim(sim);
  tween = { t: 0, dur: still.matches ? 0.001 : (flush ? 1.6 : 1) * (running ? 0.42 : 0.6) };
  if (shown >= 10) corner.readout.textContent = simReadout(sim, flush ? ` · mispredict, flushed ${flush.ids.length}` : "");
  if (flush) liveRegion.textContent = `Branch mispredicted: ${flush.ids.length} micro-ops flushed.`;
}
function placeTokens() {
  const e = smooth(0, 1, tween.t);
  for (const [id, t] of tokens) {
    const x = lerp(t.from[0], t.to[0], e), y = lerp(t.from[1], t.to[1], e);
    t.pos = [x, y];
    t.el.setAttribute("transform", `translate(${f2(x - DATA.token0[0])} ${f2(y - DATA.token0[1])})`);
    let o = 1;
    if (t.born) o = smooth(0, 0.6, tween.t);
    if (t.gone) o = 1 - smooth(t.gone === "flush" ? 0.5 : 0.25, 1, tween.t);
    t.el.style.opacity = f2(o);
  }
  if (tween.t >= 1) {
    for (const [id, t] of tokens) if (t.gone) { t.el.remove(); tokens.delete(id); } else { t.pos = t.to; t.born = false; }
    tween = null;
  }
}
function resetSim(warm = 0) {
  clearTokens();
  sim = boot();
  for (let i = 0; i < warm; i++) sim = cycle(sim);
  for (const u of sim.uops) { const at = placeOf(sim, u); tokens.set(u.id, { el: makeToken(u), from: at, to: at, pos: at }); }
  tokens.forEach((t) => { t.el.style.opacity = "1"; t.el.setAttribute("transform", `translate(${f2(t.pos[0] - DATA.token0[0])} ${f2(t.pos[1] - DATA.token0[1])})`); });
  Object.values(portEls).forEach((el) => el.removeAttribute("data-on"));
  tween = null;
  paintSim(sim);
}
function startSim(name) {
  const sims = ["sim", "late", "run"];
  if (!sims.includes(name)) { if (mode) { resetSim(); setRunning(false); } mode = null; return; }
  if (mode === name) return;
  mode = name;
  resetSim(name === "late" ? 17 : 0);
  rest = 0.6;
  if (name === "run") { setRunning(!autoRan && !still.matches); autoRan = true; }
  else setRunning(false);
}
function tickSim(dt) {
  if (!mode) return false;
  if (tween) { tween.t += dt / tween.dur; placeTokens(); return true; }
  if (mode === "run") {
    if (sim.halted) { if (running) { setRunning(false); corner.readout.textContent = simReadout(); liveRegion.textContent = `Done. Sum is ${sim.mem[15]}.`; } return false; }
    if (!(running || steps > 0)) return false;
    if (steps > 0) steps--;
    advance();
    return true;
  }
  if (rest > 0) { rest -= dt; return true; }
  if (sim.halted) { resetSim(mode === "late" ? 17 : 0); rest = 0.8; return true; }
  advance();
  if (sim.halted) rest = 2;
  return true;
}
function setRunning(on) {
  running = on && !sim.halted;
  const btn = $('[data-act="run"]');
  btn.dataset.state = running ? "running" : "idle";
  btn.textContent = running ? "Pause" : "Run";
  if (running) kick();
}
$("[data-controls]").addEventListener("click", (ev) => {
  const act = ev.target.closest("button")?.dataset.act;
  if (!act || mode !== "run") return;
  if (act === "reset") { setRunning(false); steps = 0; resetSim(); corner.readout.textContent = simReadout(); liveRegion.textContent = "Reset."; return; }
  if (act === "run") { if (sim.halted) resetSim(); setRunning(!running); return; }
  if (act === "cycle") { setRunning(false); if (!sim.halted) steps = 1; kick(); }
});

// ---------------------------------------------------------------- deck navigation
function go(by) {
  const target = Math.min(N - 1, Math.max(0, Math.round(readScroll()) + by));
  scrollTo({ top: track.offsetTop + target * innerHeight, behavior: still.matches ? "auto" : "smooth" });
}
$$("[data-go]").forEach((b) => b.addEventListener("click", () => go(+b.dataset.go)));
addEventListener("keydown", (ev) => {
  const by = { ArrowDown: 1, ArrowRight: 1, ArrowUp: -1, ArrowLeft: -1 }[ev.key];
  if (!by) return;
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
  const st = SLIDES[shown];
  const fanMoving = opacity[0] > 0.01 && !still.matches && placeFan(dt, st.demo === "fan" ? (shown === 1 ? 9 : 3) : 0);
  const ringMoving = placeRing(clock, dt);
  if (st.demo === "cores" && !still.matches) placeCores(clock); else coreTurn = -1;
  const simMoving = tickSim(dt);
  const busy = pShown !== pTarget || fanMoving || ringMoving || simMoving || running || steps > 0 || (!still.matches && st.demo === "cores");
  frame = busy ? requestAnimationFrame(tick) : 0;
}
function kick() { if (!frame) { last = 0; frame = requestAnimationFrame(tick); } }
addEventListener("scroll", kick, { passive: true });
addEventListener("resize", kick);
document.addEventListener("visibilitychange", () => { if (!document.hidden) kick(); });
placeFan(0, 0.001);
pShown = readScroll();
render(pShown);
kick();
window.__cpu = { get state() { return sim; }, get slide() { return shown; }, at(p) { forced = p; kick(); } };
