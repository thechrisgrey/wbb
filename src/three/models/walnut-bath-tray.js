// Walnut Bath Tray: a thick slab that spans the tub and, at one end, turns the corner and drops straight down
// (a mitred "waterfall", so the grain spills over the edge). Two brass splines cross the mitre near each long edge,
// and a carved tech groove toward the far end stands a phone or tablet. Shown the way it rests on a table:
// on the foot of the waterfall and its far end.
import * as K from '../kit.js';

const { THREE } = K;

export const meta = { handle: 'walnut-bath-tray', view: { yaw: -0.92, pitch: 0.42 }, fit: 0.96 };

const mm = (n) => n / 1000;

/**
 * Local helper (kit gap): a slab cut from a plan outline, like K.slab, but with
 *  - a true quarter-round ease per EDGE (top and bottom), so the outside can be softly rounded over while
 *    saw cuts and carved slots stay crisp,
 *  - blind recesses (holes with `depth`) that get real walls and a floor,
 *  - optional mitred edges (`miter: 1` is a 45 degree undercut),
 *  - wood UVs that wrap over the eased edges, so the grain on top carries on down the sides without a seam.
 * Plan points are [x, z] in metres; the slab spans y = 0 .. T; grain runs along x. Returns a non-indexed
 * BufferGeometry with one geometry group per `group` index used (0 = body).
 */
function easedSlab({ outline, holes = [], T, tile = [0.5, 0.25], offset = [0, 0] }) {
  const [su, sv] = tile; // metres of wood per texture tile along / across the grain (negative flips)
  const buckets = [];
  const bucket = (g) => (buckets[g] ||= { pos: [], nor: [], uv: [] });
  const tri = (g, a, b, c) => {
    const ux = b.p[0] - a.p[0], uy = b.p[1] - a.p[1], uz = b.p[2] - a.p[2];
    const vx = c.p[0] - a.p[0], vy = c.p[1] - a.p[1], vz = c.p[2] - a.p[2];
    const nx = uy * vz - uz * vy, ny = uz * vx - ux * vz, nz = ux * vy - uy * vx;
    if (nx * nx + ny * ny + nz * nz < 1e-22) return; // degenerate sliver
    const facing = nx * (a.n[0] + b.n[0] + c.n[0]) + ny * (a.n[1] + b.n[1] + c.n[1]) + nz * (a.n[2] + b.n[2] + c.n[2]);
    const B = bucket(g);
    for (const v of facing >= 0 ? [a, b, c] : [a, c, b]) {
      B.pos.push(v.p[0], v.p[1], v.p[2]);
      B.nor.push(v.n[0], v.n[1], v.n[2]);
      B.uv.push(v.uv[0], v.uv[1]);
    }
  };
  const planUV = (x, z, du = 0, dv = 0) => [x / su + offset[0] + du, z / sv + offset[1] + dv];

  const prep = (c, isHole) => {
    let pts = c.pts.map(([x, z]) => [x, z]);
    const n = pts.length;
    let ed = pts.map((_, j) => ({ top: 0, bottom: 0, miter: 0, end: false, group: 0, ...(typeof c.edge === 'function' ? c.edge(j) : c.edge) }));
    let area = 0;
    for (let i = 0; i < n; i++) area += pts[i][0] * pts[(i + 1) % n][1] - pts[(i + 1) % n][0] * pts[i][1];
    if (area > 0 === isHole) {
      // wrong winding: reverse, keeping each edge with its own settings
      const src = ed;
      pts = pts.slice().reverse();
      ed = src.map((_, i) => src[(2 * n - 2 - i) % n]);
    }
    // unit normals pointing INTO the wood, one per edge j (pts[j] -> pts[j + 1])
    const nrm = pts.map((p, j) => {
      const q = pts[(j + 1) % n];
      const l = Math.hypot(q[0] - p[0], q[1] - p[1]) || 1;
      return [-(q[1] - p[1]) / l, (q[0] - p[0]) / l];
    });
    const y1 = T;
    const y0 = c.depth ? T - c.depth : 0;
    // ring heights: enough to trace every ease on this contour
    const raw = [y0, y1];
    for (const e of ed) {
      for (const [r, dir] of [[e.top, 1], [c.depth ? 0 : e.bottom, -1]]) {
        if (!(r > 0)) continue;
        const segs = r >= 0.002 ? 5 : r >= 0.0009 ? 3 : 2;
        for (let k = 0; k <= segs; k++) {
          const s = r * Math.sin((k / segs) * Math.PI * 0.5);
          raw.push(dir > 0 ? y1 - r + s : y0 + r - s);
        }
      }
    }
    raw.sort((a, b) => a - b);
    const ys = [y0];
    for (const y of raw) if (y - ys[ys.length - 1] > 4e-5 && y1 - y > 4e-5) ys.push(y);
    ys.push(y1);
    // how far an edge sits in from the outline at height y, and which way its surface faces there
    const prof = (e, y) => {
      let d = e.miter * (y1 - y);
      let nh = 1;
      let ny = 0;
      if (e.miter) {
        const l = Math.hypot(1, e.miter);
        nh = 1 / l;
        ny = -e.miter / l;
      }
      const bottom = c.depth ? 0 : e.bottom;
      if (e.top > 0 && y > y1 - e.top + 1e-9) {
        const s = Math.min(1, (y - (y1 - e.top)) / e.top);
        const cs = Math.sqrt(1 - s * s);
        d += e.top * (1 - cs);
        nh = cs;
        ny = s;
      } else if (bottom > 0 && y < y0 + bottom - 1e-9) {
        const s = Math.min(1, (y0 + bottom - y) / bottom);
        const cs = Math.sqrt(1 - s * s);
        d += bottom * (1 - cs);
        nh = cs;
        ny = -s;
      }
      return { d, nh, ny };
    };
    const rings = ys.map((y) =>
      pts.map((p, i) => {
        const nA = nrm[(i - 1 + n) % n];
        const nB = nrm[i];
        const dA = prof(ed[(i - 1 + n) % n], y).d;
        const dB = prof(ed[i], y).d;
        const dot = nA[0] * nB[0] + nA[1] * nB[1];
        const det = nA[0] * nB[1] - nA[1] * nB[0];
        let ox;
        let oz;
        if (Math.abs(dA - dB) < 1e-9 || Math.abs(det) < 1e-3) {
          const k = (dA + dB) / 2 / Math.max(0.2, 1 + dot);
          ox = (nA[0] + nB[0]) * k;
          oz = (nA[1] + nB[1]) * k;
        } else {
          ox = (dA * nB[1] - dB * nA[1]) / det;
          oz = (nA[0] * dB - nB[0] * dA) / det;
        }
        return [p[0] + ox, p[1] + oz];
      }),
    );
    // walls
    const smooth = pts.map((_, i) => {
      const a = nrm[(i - 1 + n) % n];
      const b = nrm[i];
      return a[0] * b[0] + a[1] * b[1] > 0.77;
    });
    const outDir = (j, i) => {
      if (smooth[i]) {
        const a = nrm[(i - 1 + n) % n];
        const b = nrm[i];
        const l = Math.hypot(a[0] + b[0], a[1] + b[1]);
        return [-(a[0] + b[0]) / l, -(a[1] + b[1]) / l];
      }
      return [-nrm[j][0], -nrm[j][1]];
    };
    for (let j = 0; j < n; j++) {
      const e = ed[j];
      const j2 = (j + 1) % n;
      const o1 = outDir(j, j);
      const o2 = outDir(j, j2);
      const vert = (i, o, k) => {
        const y = ys[k];
        const pr = prof(e, y);
        const [x, z] = rings[k][i];
        const h = T - y;
        const uv = e.end
          ? [y / (sv * 0.7) + offset[0], (z * o[0] - x * o[1]) / (sv * 0.35) + offset[1]] // end grain: tighter, turned
          : planUV(x + o[0] * h, z + o[1] * h); // long grain: the top's pattern folded down over the edge
        return { p: [x, y, z], n: [o[0] * pr.nh, pr.ny, o[1] * pr.nh], uv };
      };
      for (let k = 0; k < ys.length - 1; k++) {
        const a = vert(j, o1, k);
        const b = vert(j2, o2, k);
        const c2 = vert(j2, o2, k + 1);
        const d = vert(j, o1, k + 1);
        tri(e.group, a, b, c2);
        tri(e.group, a, c2, d);
      }
    }
    return { c, y0, top: rings[rings.length - 1], bottom: rings[0] };
  };

  const cap = (contour, inner, y, up, g, du = 0, dv = 0) => {
    const v2 = (r) => r.map(([x, z]) => new THREE.Vector2(x, z));
    const all = [contour, ...inner].flat();
    for (const f of THREE.ShapeUtils.triangulateShape(v2(contour), inner.map(v2))) {
      const [a, b, c] = f.map((i) => ({ p: [all[i][0], y, all[i][1]], n: [0, up, 0], uv: planUV(all[i][0], all[i][1], du, dv) }));
      tri(g, a, b, c);
    }
  };

  const outer = prep(outline, false);
  const inner = holes.map((h) => prep(h, true));
  cap(outer.top, inner.map((h) => h.top), T, 1, 0);
  cap(outer.bottom, inner.filter((h) => !h.c.depth).map((h) => h.bottom), 0, -1, 0, 0.37, 0.21);
  for (const h of inner) if (h.c.depth) cap(h.bottom, [], h.y0, 1, h.c.floorGroup ?? 0);

  const pos = [];
  const nor = [];
  const uv = [];
  const geo = new THREE.BufferGeometry();
  buckets.forEach((B, g) => {
    if (!B) return;
    geo.addGroup(pos.length / 3, B.pos.length / 3, g);
    for (const v of B.pos) pos.push(v);
    for (const v of B.nor) nor.push(v);
    for (const v of B.uv) uv.push(v);
  });
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  geo.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3));
  geo.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  return geo;
}

/** A wood part from easedSlab that keeps the slab's own wrapped UVs (K.wood would otherwise re-project them). */
function woodSlab(spec, opts) {
  const geo = easedSlab(spec);
  const uv = geo.getAttribute('uv');
  const mesh = K.wood(geo, opts);
  mesh.geometry.setAttribute('uv', uv);
  return mesh;
}

export function build({ wood = 'walnut' } = {}) {
  const L = K.inch(34); // overall, including the thickness of the drop
  const W = K.inch(7);
  const T = K.inch(1.15);
  const H = K.inch(4.75); // how far the waterfall reaches below the top face
  const hl = L / 2;
  const hw = W / 2;
  const xE = hl; // the waterfall end

  const EASE = { top: mm(0.8), bottom: mm(0.8) }; // crisp, just broken
  const END = { ...EASE, end: true, group: 3 }; // sawn ends show end grain, a shade darker
  const MITRE = { top: mm(0.45), miter: 1 };
  const rect = (x0, x1) => [
    [x0, -hw],
    [x1, -hw],
    [x1, hw],
    [x0, hw],
  ];

  // One tile of the species texture runs the length of the top and mirrors exactly at the mitre, so every grain line
  // on top carries straight over the corner and down the drop.
  const tile = [-L, 0.3];
  const vOff = 0.52;

  // ---------- the top ----------
  const slotL = K.inch(13.5);
  const slotW = K.inch(0.6);
  const slotX = xE - K.inch(11) - slotL / 2;
  const slotZ = -hw + K.inch(0.65) + slotW / 2;
  const groove = K.slot(slotL, slotW, slotX, slotZ, 0, false)
    .getPoints()
    .map((p) => [p.x, p.y])
    .filter((p, i, all) => i === 0 || Math.hypot(p[0] - all[i - 1][0], p[1] - all[i - 1][1]) > 1e-6);
  if (Math.hypot(groove[0][0] - groove.at(-1)[0], groove[0][1] - groove.at(-1)[1]) < 1e-6) groove.pop();
  const top = woodSlab(
    {
      outline: { pts: rect(-hl, xE), edge: (j) => [EASE, MITRE, EASE, END][j] },
      holes: [{ pts: groove, depth: K.inch(0.55), edge: { top: mm(0.6), group: 1 }, floorGroup: 2 }],
      T,
      tile,
      offset: [0.5, vOff],
    },
    { species: wood, materials: [{}, { darken: 0.6 }, { darken: 0.32 }, { darken: 0.84 }], pos: [0, H - T, 0], name: 'top' },
  );

  // ---------- the waterfall: the same board, built lying down, then hung from the mitre ----------
  const dropGeo = easedSlab({
    outline: { pts: rect(0, H), edge: (j) => [EASE, { ...END, group: 1 }, EASE, MITRE][j] },
    T,
    tile,
    offset: [0, vOff],
  });
  dropGeo.rotateZ(-Math.PI / 2);
  const dropUV = dropGeo.getAttribute('uv');
  const drop = K.wood(dropGeo, { species: wood, materials: [top.material[0], top.material[3]], pos: [xE - T, H, 0], name: 'waterfall' });
  drop.geometry.setAttribute('uv', dropUV);

  // ---------- brass splines across the mitre ----------
  const proud = mm(0.3);
  const sx = K.inch(0.85); // showing on top
  const sy = K.inch(0.72); // showing on the face
  const spline = (z) => K.brassBox([sx, sy, K.inch(0.13)], { pos: [xE - sx / 2 + proud, H - sy / 2 + proud, z] });

  const tray = K.group(top, drop, spline(hw - K.inch(1)), spline(-hw + K.inch(1)));
  tray.rotation.z = Math.atan2(H - T, L - T); // rest on the foot of the drop and the far end
  return K.seat(K.group(tray));
}
