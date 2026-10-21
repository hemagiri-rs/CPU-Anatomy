
// ---------------------------------------------------------------- background music
// Shared by every page. Loops "Calm Space Music" by Clavier-Music (Pixabay) quietly,
// fading in and out. The track's path comes from the ♪ button's data-src.
// Browsers only allow sound after a click, tap or key press on the page, so it
// tries at load and again on every gesture until it plays; until then the ♪ button
// pulses. The ♪ button mutes it, and the choice is remembered across pages.
(() => {
  const KEY = "cpu-music";
  const VOLUME = 0.25; // the track averages -15 dB; this sits it near -27 dB, under everything
  const read = () => { try { return localStorage.getItem(KEY); } catch { return null; } };
  const write = (v) => { try { localStorage.setItem(KEY, v); } catch {} };
  const buttons = [...document.querySelectorAll("button[data-music]")];
  if (!buttons.length) return;
  const audio = new Audio(buttons[0].dataset.src);
  audio.loop = true;
  audio.preload = "auto";
  audio.volume = 0;
  let on = read() !== "off", playing = false, fadeFrame = 0;
  // carry the position across pages, so moving from the picker into a tour doesn't restart the track
  try { audio.currentTime = +sessionStorage.getItem(KEY + "-at") || 0; } catch {}
  addEventListener("pagehide", () => { try { sessionStorage.setItem(KEY + "-at", String(audio.currentTime)); } catch {} });

  // ease the volume to `to` over `s` seconds, then pause if it reached silence
  function fade(to, s) {
    cancelAnimationFrame(fadeFrame);
    const from = audio.volume, t0 = performance.now();
    const step = (now) => {
      const u = Math.min(1, (now - t0) / (s * 1000));
      audio.volume = from + (to - from) * u * u * (3 - 2 * u);
      if (u < 1) fadeFrame = requestAnimationFrame(step);
      else if (to === 0) audio.pause();
    };
    fadeFrame = requestAnimationFrame(step);
  }
  function start() {
    audio.play().then(() => { playing = true; fade(VOLUME, 3); paint(); }, () => { playing = false; paint(); });
  }
  function stop() {
    playing = false;
    fade(0, 1.2);
    paint();
  }
  function paint() {
    const waiting = on && !playing;
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
    if (on && !playing) { start(); return; }
    on = !on;
    write(on ? "on" : "off");
    on ? start() : stop();
  }));
  // every gesture tries again until the browser lets the music play
  const nudge = (ev) => { if (!ev.target.closest?.("button[data-music]") && on && !playing) start(); };
  for (const type of ["pointerdown", "keydown", "touchend", "click"]) addEventListener(type, nudge, true);
  document.addEventListener("visibilitychange", () => {
    if (!on || !playing) return;
    document.hidden ? audio.pause() : audio.play().catch(() => {});
  });
  if (on) start(); // plays straight away where the browser already allows sound
  paint();
})();
