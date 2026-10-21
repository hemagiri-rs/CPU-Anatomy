
// ---------------------------------------------------------------- play mode
// Shared by every tour. Turns the deck into a timed slideshow: each slide stays
// for its data-dwell seconds (6 by default), then the deck moves on by itself.
// Any manual input (wheel, touch, arrow keys, the nav buttons) hands control back.
// Needs from the tour: go(by), readScroll(), N, still.
const playBtn = document.querySelector("[data-play]");
const dwellOf = (i) => +(document.querySelectorAll(".cpu-slide")[i]?.dataset.dwell || 6);
let playing = false, playTimer = 0;
function setPlaying(on) {
  playing = on;
  clearTimeout(playTimer);
  playBtn.dataset.state = on ? "playing" : "idle";
  playBtn.setAttribute("aria-label", on ? "Pause slideshow" : "Play slideshow");
  playBtn.textContent = on ? "❚❚" : "▶";
  document.documentElement.toggleAttribute("data-playing", on);
  if (on) queueNext();
}
function queueNext() {
  const i = Math.round(readScroll());
  if (i >= N - 1) { playTimer = setTimeout(() => setPlaying(false), dwellOf(i) * 1000); return; }
  playTimer = setTimeout(() => { if (!playing) return; go(1); queueNext(); }, dwellOf(i) * 1000);
}
playBtn.addEventListener("click", () => {
  if (!playing && Math.round(readScroll()) >= N - 1) scrollTo({ top: track.offsetTop, behavior: "auto" });
  setPlaying(!playing);
});
const handBack = () => { if (playing) setPlaying(false); };
addEventListener("wheel", handBack, { passive: true });
addEventListener("touchstart", handBack, { passive: true });
document.querySelectorAll("[data-go]").forEach((b) => b.addEventListener("click", handBack));
addEventListener("keydown", (ev) => {
  if (ev.key === " " && !ev.target.closest("button, input")) { ev.preventDefault(); playBtn.click(); return; }
  if (/^Arrow|^Page|^Home$|^End$/.test(ev.key)) handBack();
}, true);
if (new URLSearchParams(location.search).has("play")) setPlaying(true);
