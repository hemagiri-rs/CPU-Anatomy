// Drawing helpers shared by every tour's build script.
import * as k from "./iso-kit.mjs";

export function tools(P) {
  const at = (p) => k.iso(p, P);
  const tone = (o, d) => o.tone ?? d;
  return {
    P,
    at,
    depth: (x, y, z = 0) => k.depthOf([x, y, z], P),
    slab: (plan, z, h, o = {}) =>
      k.solidSvg(k.slabOf({ r: 1, ...plan }, z, h, P, o.steps ?? 3, o.bevel ?? 0.4), { tone: tone(o, "mid"), crease: o.crease, lit: o.lit, inner: o.inner, halo: o.halo }),
    cyl: (x, y, r, z, h, o = {}) => k.solidSvg(k.cylinder(x, y, r, z, h, P, o.steps ?? 28, o.bevel ?? 0), { tone: tone(o, "mid"), crease: o.crease, lit: o.lit, inner: o.inner }),
    line: (d, o = {}) => k.lineSvg(d, { tone: "lo", ...o }),
    dots: (pts, o = {}) => k.dotsSvg(pts, o),
    outline: (plan, z, o = {}) => k.lineSvg(k.planOutline({ r: 0.5, ...plan }, z, P, o.steps ?? 3), { tone: o.tone ?? "faint" }),
    text: (x, y, z, s, o = {}) => k.faceTextSvg(k.topMatrix([x, y], z, P, o.along ?? "x"), s, { size: o.size ?? 3, tone: o.tone ?? "mid", anchor: o.anchor ?? "middle" }),
    halo: (plan, z, h, blur) => `<path class="iso-halo" d="${k.haloOf(plan, z, h, P)}"${blur ? ` style="filter:blur(${blur}px)"` : ""}/>`,
    stripes: (plan, z, pitch, axis = "x", o = {}) => {
      const out = [];
      if (axis === "x") for (let y = plan.y + pitch; y < plan.y + plan.d - 0.2; y += pitch) out.push(k.lineOnTop([plan.x, y], [plan.x + plan.w, y], z, P));
      else for (let x = plan.x + pitch; x < plan.x + plan.w - 0.2; x += pitch) out.push(k.lineOnTop([x, plan.y], [x, plan.y + plan.d], z, P));
      return k.lineSvg(out.join(""), { tone: o.tone ?? "faint" });
    },
    grid: (plan, z, cols, rows, o = {}) => {
      const pts = [];
      for (let i = 0; i < cols; i++) for (let j = 0; j < rows; j++) pts.push(k.iso([plan.x + ((i + 0.5) * plan.w) / cols, plan.y + ((j + 0.5) * plan.d) / rows, z], P));
      return k.dotsSvg(pts, { size: o.size ?? 0.45, tone: o.tone ?? "mid" });
    },
  };
}
export const centre = (p) => [p.x + p.w / 2, p.y + p.d / 2];
export const sortItems = (items) => items.sort((a, b) => a.key - b.key).map((i) => i.svg).join("");
// a selectable unit; `domain` tints it with its family colour
export const unit = (name, body, domain, extra = "") => `<g class="it${domain ? " tinted" : ""}" data-unit="${name}"${domain ? ` style="--tint:var(--d-${domain})"` : ""}${extra}>${body}</g>`;

// A similarity (uniform scale + translate) taking layer a's screen to layer b's,
// from two matching world points in each layer.
export function similarity(Pa, pa, Pb, pb) {
  const [a0, a1] = pa.map((p) => k.iso(p, Pa));
  const [b0, b1] = pb.map((p) => k.iso(p, Pb));
  const s = Math.hypot(b1[0] - b0[0], b1[1] - b0[1]) / Math.hypot(a1[0] - a0[0], a1[1] - a0[1]);
  return { s, tx: b0[0] - a0[0] * s, ty: b0[1] - a0[1] * s };
}

