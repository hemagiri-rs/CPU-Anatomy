
// ---------------------------------------------------------------- ambient music
// Shared by every page. A calm pad synthesised with Web Audio: slow chords of
// detuned, filtered saw voices spread across the stereo field, a generated hall
// reverb, and now and then a soft bell note from the pentatonic scale.
// Browsers only allow sound after a click, tap or key press on the page, so it
// tries at load and again on every gesture until it runs; until then the ♪ button
// pulses. The ♪ button mutes it, and the choice is remembered across pages.
(() => {
  const KEY = "cpu-music";
  const VOLUME = 0.9; // tuned to about -24 dBFS RMS once the pad is in
  const CHORD_S = 12;
  const n = (midi) => 440 * Math.pow(2, (midi - 69) / 12);
  // Cmaj9 → Am9 → Fmaj9 → G6/9, open voicings in the middle register
  const CHORDS = [[48, 55, 62, 64, 71], [45, 52, 59, 60, 67], [41, 48, 55, 57, 64], [43, 50, 57, 59, 64]].map((c) => c.map(n));
  const BELLS = [72, 74, 76, 79, 81, 84].map(n); // C major pentatonic, an octave above the pad
  const read = () => { try { return localStorage.getItem(KEY); } catch { return null; } };
  const write = (v) => { try { localStorage.setItem(KEY, v); } catch {} };
  const buttons = [...document.querySelectorAll("button[data-music]")];
  let on = read() !== "off";
  let ctx = null, master = null, pad = null, verb = null, chordTimer = 0, bellTimer = 0, step = 0;

  // a stereo hall: two channels of decaying noise, slightly different
  function impulse(seconds) {
    const len = Math.floor(ctx.sampleRate * seconds);
    const buf = ctx.createBuffer(2, len, ctx.sampleRate);
    for (let ch = 0; ch < 2; ch++) {
      const d = buf.getChannelData(ch);
      for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 3.2);
    }
    return buf;
  }
  function build() {
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return false;
    ctx = new AC();
    master = ctx.createGain();
    master.gain.value = 0;
    const limiter = ctx.createDynamicsCompressor();
    limiter.threshold.value = -18;
    limiter.ratio.value = 4;
    master.connect(limiter).connect(ctx.destination);
    const conv = ctx.createConvolver();
    conv.buffer = impulse(4.5);
    verb = ctx.createGain();
    verb.gain.value = 0.9;
    verb.connect(conv).connect(master);
    // the pad's filter breathes slowly between dark and a little brighter
    pad = ctx.createBiquadFilter();
    pad.type = "lowpass";
    pad.frequency.value = 900;
    pad.Q.value = 0.7;
    const lfo = ctx.createOscillator();
    const depth = ctx.createGain();
    lfo.frequency.value = 0.05;
    depth.gain.value = 350;
    lfo.connect(depth).connect(pad.frequency);
    lfo.start();
    const dry = ctx.createGain();
    dry.gain.value = 0.55;
    pad.connect(dry).connect(master);
    pad.connect(verb);
    return true;
  }
  function chord(notes, at) {
    const dur = CHORD_S + 6;
    notes.forEach((f, i) => {
      const g = ctx.createGain();
      g.gain.setValueAtTime(0, at);
      g.gain.linearRampToValueAtTime(0.06, at + 5);
      g.gain.setValueAtTime(0.06, at + dur - 6);
      g.gain.linearRampToValueAtTime(0, at + dur);
      g.connect(pad);
      for (const side of [-1, 1]) {
        const o = ctx.createOscillator();
        const p = ctx.createStereoPanner();
        o.type = "sawtooth";
        o.frequency.value = f;
        o.detune.value = side * (5 + i);
        p.pan.value = side * 0.6;
        o.connect(p).connect(g);
        o.start(at);
        o.stop(at + dur + 0.1);
      }
    });
  }
  function bell() {
    const at = ctx.currentTime + 0.05;
    const f = BELLS[Math.floor(Math.random() * BELLS.length)];
    const g = ctx.createGain();
    g.gain.setValueAtTime(0, at);
    g.gain.linearRampToValueAtTime(0.05, at + 0.02);
    g.gain.exponentialRampToValueAtTime(0.0001, at + 4);
    const p = ctx.createStereoPanner();
    p.pan.value = Math.random() * 1.2 - 0.6;
    g.connect(p);
    p.connect(master);
    p.connect(verb);
    for (const [mult, level] of [[1, 1], [2.76, 0.18]]) {
      const o = ctx.createOscillator();
      const og = ctx.createGain();
      o.frequency.value = f * mult;
      og.gain.value = level;
      o.connect(og).connect(g);
      o.start(at);
      o.stop(at + 4.1);
    }
    bellTimer = setTimeout(bell, 2500 + Math.random() * 4500);
  }
  function schedule() {
    chord(CHORDS[step++ % CHORDS.length], ctx.currentTime + 0.05);
    chordTimer = setTimeout(schedule, CHORD_S * 1000);
  }
  function fade(to, s) {
    const t = ctx.currentTime;
    master.gain.cancelScheduledValues(t);
    master.gain.setValueAtTime(master.gain.value, t);
    master.gain.linearRampToValueAtTime(to, t + s);
  }
  function start() {
    if (!ctx && !build()) return;
    const go = () => {
      paint();
      if (ctx.state !== "running" || !on) return;
      if (!chordTimer) { schedule(); bellTimer = setTimeout(bell, 4000); }
      fade(VOLUME, 4);
    };
    ctx.resume().then(go, go);
    go();
  }
  function stop() {
    if (!ctx) return;
    fade(0, 1.5);
    clearTimeout(chordTimer);
    clearTimeout(bellTimer);
    chordTimer = bellTimer = 0;
  }
  function paint() {
    const waiting = on && (!ctx || ctx.state !== "running");
    for (const b of buttons) {
      b.setAttribute("aria-pressed", String(on));
      b.setAttribute("aria-label", !on ? "Play music" : waiting ? "Music: click anywhere to start" : "Mute music");
      b.title = waiting ? "Click anywhere to start the music" : "";
      b.dataset.state = !on ? "off" : waiting ? "waiting" : "on";
    }
    // pages can style themselves on it, e.g. the home page's welcome screen
    document.documentElement.dataset.music = !on ? "off" : waiting ? "waiting" : "on";
  }
  buttons.forEach((b) => b.addEventListener("click", (ev) => {
    ev.stopPropagation();
    // the first click on a waiting button means "start", not "mute"
    if (on && (!ctx || ctx.state !== "running")) { start(); return; }
    on = !on;
    write(on ? "on" : "off");
    on ? start() : stop();
    paint();
  }));
  // every gesture tries again until the browser lets the music run
  const nudge = (ev) => { if (!ev.target.closest?.("button[data-music]") && on && (!ctx || ctx.state !== "running")) start(); };
  for (const type of ["pointerdown", "keydown", "touchend", "click"]) addEventListener(type, nudge, true);
  document.addEventListener("visibilitychange", () => {
    if (!ctx || !on) return;
    document.hidden ? ctx.suspend() : ctx.resume().then(paint);
  });
  if (on) start(); // runs straight away where the browser already allows sound
  paint();
})();
