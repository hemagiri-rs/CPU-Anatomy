// A small cycle model of an out-of-order P-core, shaped like Intel's Lion Cove /
// Cougar Cove: 8-wide fetch/decode/rename/retire, a reorder buffer, split
// integer, vector and memory schedulers, and the ports behind them. Pure
// functions only, so the build, the page and the self-check run one machine.
// Sizes are the public Lion Cove figures (Chips and Cheese); the program is ours.

export const WIDTH = 8; // decode, rename and retire width
export const ROB_SIZE = 576;
export const PORTS = { int: 6, vec: 4, load: 3, store: 3 };
const LAT = { int: 1, branch: 1, store: 1, vec: 4, L0: 4, L1: 9 };

export const PROGRAM = [
  { op: "LD", rd: 1, addr: 14, cls: "load", text: "mov  r1, [n]", note: "load n" },
  { op: "LI", rd: 0, imm: 0, cls: "int", text: "mov  r0, 0", note: "sum = 0" },
  { op: "LI", rd: 2, imm: 1, cls: "int", text: "mov  r2, 1", note: "one = 1" },
  { op: "ADD", rd: 0, rs: [0, 1], cls: "int", text: "add  r0, r1", note: "sum += n" },
  { op: "ADD", rd: 3, rs: [3, 2], cls: "int", text: "add  r3, r2", note: "count += 1, needs no load" },
  { op: "SUB", rd: 1, rs: [1, 2], cls: "int", flags: true, text: "sub  r1, r2", note: "n -= 1, sets ZF" },
  { op: "JNZ", target: 3, cls: "branch", reads: "f", text: "jnz  loop", note: "predicted taken" },
  { op: "ST", rs: [0], addr: 15, cls: "store", text: "mov  [sum], r0", note: "store the sum" },
  { op: "HLT", cls: "int", text: "hlt", note: "stop" },
];
export const N_VALUE = 10;
const portClass = (cls) => (cls === "branch" ? "int" : cls);

export function boot() {
  const mem = new Array(16).fill(0);
  mem[14] = N_VALUE;
  return {
    cycle: 0, fetchPC: 0, fetchStop: false, nextId: 1, robSeq: 0,
    uops: [], // in flight, oldest first
    regs: [0, 0, 0, 0], zf: 0, mem, l0: new Set(),
    producer: { 0: null, 1: null, 2: null, 3: null, f: null }, // speculative rename map → uop id
    retired: 0, halted: false, flushes: 0, events: [],
  };
}

const clone = (s) => ({
  ...s,
  regs: [...s.regs],
  mem: [...s.mem],
  l0: new Set(s.l0),
  producer: { ...s.producer },
  uops: s.uops.map((u) => ({ ...u, src: u.src.map((x) => ({ ...x })) })),
  events: [],
});

// Value of a source: from its in-flight producer, or the committed register.
function valueOf(s, src) {
  if (src.from) {
    const p = s.uops.find((u) => u.id === src.from);
    if (p) return src.reg === "f" ? p.zf : p.value;
  }
  return src.reg === "f" ? s.zf : s.regs[src.reg];
}
function readyAt(s, src) {
  if (!src.from) return -1;
  const p = s.uops.find((u) => u.id === src.from);
  if (!p) return -1; // already retired: the value is architectural
  return p.doneAt ?? Infinity;
}

export function cycle(prev) {
  if (prev.halted) return prev;
  const s = clone(prev);
  const c = (s.cycle += 1);
  const ev = s.events;

  // 1 · retire, oldest first, in order
  let retiredNow = 0;
  while (retiredNow < WIDTH && s.uops.length && s.uops[0].stage === "done") {
    const u = s.uops.shift();
    const i = PROGRAM[u.pc];
    if (i.rd != null) s.regs[i.rd] = u.value;
    if (i.flags) s.zf = u.zf;
    if (i.op === "ST") { s.mem[i.addr] = u.value; s.l0.add(i.addr); }
    for (const r of Object.keys(s.producer)) if (s.producer[r] === u.id) s.producer[r] = null;
    s.retired++;
    retiredNow++;
    ev.push({ kind: "retire", id: u.id });
    if (i.op === "HLT") { s.halted = true; s.uops = []; break; }
  }
  if (s.halted) return s;

  // 2 · complete; a mispredicted branch flushes everything younger
  for (const u of s.uops) if (u.stage === "exec" && u.doneAt <= c) u.stage = "done";
  const wrong = s.uops.find((u) => u.stage === "done" && PROGRAM[u.pc].op === "JNZ" && u.taken !== u.predicted && !u.resolved);
  for (const u of s.uops) if (PROGRAM[u.pc].op === "JNZ" && u.stage === "done") u.resolved = true;
  if (wrong) {
    const gone = s.uops.filter((u) => u.id > wrong.id);
    s.uops = s.uops.filter((u) => u.id <= wrong.id);
    ev.push({ kind: "flush", ids: gone.map((u) => u.id), at: wrong.id });
    s.flushes++;
    s.fetchPC = wrong.taken ? PROGRAM[wrong.pc].target : wrong.pc + 1;
    s.fetchStop = false;
    // rebuild the rename map from what survived
    s.producer = { 0: null, 1: null, 2: null, 3: null, f: null };
    for (const u of s.uops) { const i = PROGRAM[u.pc]; if (i.rd != null) s.producer[i.rd] = u.id; if (i.flags) s.producer.f = u.id; }
  }

  // 3 · issue: oldest ready uop per free port
  const free = { ...PORTS };
  for (const u of s.uops) {
    if (u.stage !== "sched") continue;
    const k = portClass(u.cls);
    if (!free[k]) continue;
    if (!u.src.every((x) => readyAt(s, x) <= c)) continue;
    u.port = PORTS[k] - free[k];
    free[k]--;
    u.stage = "exec";
    u.issuedAt = c;
    const i = PROGRAM[u.pc];
    const v = u.src.map((x) => valueOf(s, x));
    if (i.op === "LD") {
      u.level = s.l0.has(i.addr) ? "L0" : "L1";
      s.l0.add(i.addr);
      u.value = s.mem[i.addr];
      u.doneAt = c + LAT[u.level];
    } else {
      if (i.op === "LI") u.value = i.imm;
      if (i.op === "ADD") u.value = (v[0] + v[1]) & 0xff;
      if (i.op === "SUB") { u.value = (v[0] - v[1]) & 0xff; u.zf = u.value === 0 ? 1 : 0; }
      if (i.op === "ST") u.value = v[0];
      if (i.op === "JNZ") u.taken = v[0] === 0;
      u.doneAt = c + LAT[u.cls === "branch" ? "branch" : u.cls];
    }
    ev.push({ kind: "issue", id: u.id, cls: k, port: u.port });
  }

  // 4 · rename and allocate: queue → ROB + scheduler, up to 8 a cycle
  let renamed = 0;
  for (const u of s.uops) {
    if (u.stage !== "queue" || renamed >= WIDTH || s.uops.filter((x) => x.rob != null).length >= ROB_SIZE) continue;
    const i = PROGRAM[u.pc];
    const regs = [...(i.rs || [])];
    u.src = regs.map((r) => ({ reg: r, from: s.producer[r] }));
    if (i.reads === "f") u.src.push({ reg: "f", from: s.producer.f });
    if (i.rd != null) s.producer[i.rd] = u.id;
    if (i.flags) s.producer.f = u.id;
    u.rob = s.robSeq++;
    u.stage = i.op === "HLT" ? "done" : "sched";
    if (i.op === "HLT") u.doneAt = c;
    renamed++;
  }
  // 5 · decode → queue
  for (const u of s.uops) if (u.stage === "decode" && u.age < c) u.stage = "queue";
  // 6 · fetch up to 8, ending the group after a predicted-taken branch
  for (const u of s.uops) if (u.stage === "fetch" && u.age < c) { u.stage = "decode"; u.age = c; }
  if (!s.fetchStop) {
    for (let lane = 0; lane < WIDTH; lane++) {
      const pc = s.fetchPC;
      const i = PROGRAM[pc];
      const u = { id: s.nextId++, pc, cls: i.cls, stage: "fetch", age: c, lane, src: [], rob: null };
      if (i.op === "JNZ") u.predicted = true;
      s.uops.push(u);
      if (i.op === "JNZ") { s.fetchPC = i.target; break; }
      if (i.op === "HLT") { s.fetchStop = true; break; }
      s.fetchPC = pc + 1;
    }
  }
  return s;
}

export function runToHalt(s = boot(), limit = 500) {
  while (!s.halted && limit--) s = cycle(s);
  return s;
}
