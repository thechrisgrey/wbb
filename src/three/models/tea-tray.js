// Tea + Spice Tray: a small hand-carved walnut caddy. A low base board carries one long carved spoon groove along the
// front; a raised step glued along the back holds three square white enamel tins in shallow square recesses. A slim
// brass spoon lies in the groove. Lies flat; the default view is three-quarter from the front so the groove, the spoon
// and all three tins read together.
import * as K from '../kit.js';

const { THREE } = K;

export const meta = { handle: 'tea-tray', view: { yaw: 0.5, pitch: 0.5 }, fit: 0.96 };

const mm = (n) => n / 1000;
const rad = (deg) => (deg * Math.PI) / 180;

/**
 * Local helper (kit gap; same approach as nightcap-bath-tray): a slab cut from a plan outline with a quarter-round
 * ease per edge, blind recesses (holes with `depth`) that get real walls and a floor, and wood UVs that wrap over the
 * eased edges. Plan points are [x, z] in metres; the slab spans y = 0 .. T; grain runs along x. Geometry groups:
 * 0 = body, plus whatever `group` / `floorGroup` indices the holes use.
 */
function easedSlab({ outline, holes = [], T, tile = [0.5, 0.25], offset = [0, 0] }) {
  const [su, sv] = tile;
  const buckets = [];
  const bucket = (g) => (buckets[g] ||= { pos: [], nor: [], uv: [] });
  const tri = (g, a, b, c) => {
    const ux = b.p[0] - a.p[0], uy = b.p[1] - a.p[1], uz = b.p[2] - a.p[2];
    const vx = c.p[0] - a.p[0], vy = c.p[1] - a.p[1], vz = c.p[2] - a.p[2];
    const nx = uy * vz - uz * vy, ny = uz * vx - ux * vz, nz = ux * vy - uy * vx;
    if (nx * nx + ny * ny + nz * nz < 1e-22) return;
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
    let ed = pts.map((_, j) => ({ top: 0, bottom: 0, group: 0, ...(typeof c.edge === 'function' ? c.edge(j) : c.edge) }));
    let area = 0;
    for (let i = 0; i < n; i++) area += pts[i][0] * pts[(i + 1) % n][1] - pts[(i + 1) % n][0] * pts[i][1];
    if (area > 0 === isHole) {
      const src = ed;
      pts = pts.slice().reverse();
      ed = src.map((_, i) => src[(2 * n - 2 - i) % n]);
    }
    const nrm = pts.map((p, j) => {
      const q = pts[(j + 1) % n];
      const l = Math.hypot(q[0] - p[0], q[1] - p[1]) || 1;
      return [-(q[1] - p[1]) / l, (q[0] - p[0]) / l];
    });
    const y1 = T;
    const y0 = c.depth ? T - c.depth : 0;
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
    const prof = (e, y) => {
      let d = 0;
      let nh = 1;
      let ny = 0;
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
        return { p: [x, y, z], n: [o[0] * pr.nh, pr.ny, o[1] * pr.nh], uv: planUV(x + o[0] * h, z + o[1] * h) };
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
  for (const h of inner) if (h.c.depth) cap(h.bottom, [], h.y0, 1, h.c.floorGroup ?? 0, 0.23, 0.41);

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

/** A wood part from easedSlab that keeps the slab's own wrapped UVs. */
function woodSlab(spec, opts) {
  const geo = easedSlab(spec);
  const uv = geo.getAttribute('uv');
  const mesh = K.wood(geo, opts);
  mesh.geometry.setAttribute('uv', uv);
  return mesh;
}

const arc = (cx, cz, r, a0, a1, n) => {
  const out = [];
  for (let i = 0; i <= n; i++) {
    const a = a0 + ((a1 - a0) * i) / n;
    out.push([cx + Math.cos(a) * r, cz + Math.sin(a) * r]);
  }
  return out;
};

/** Rounded rectangle as plan points, centred on (cx, cz). */
const rrect = (cx, cz, w, d, r, n = 6) => [
  ...arc(cx + w / 2 - r, cz + d / 2 - r, r, rad(0), rad(90), n),
  ...arc(cx - w / 2 + r, cz + d / 2 - r, r, rad(90), rad(180), n),
  ...arc(cx - w / 2 + r, cz - d / 2 + r, r, rad(180), rad(270), n),
  ...arc(cx + w / 2 - r, cz - d / 2 + r, r, rad(270), rad(360), n),
];

/** One square enamel tin: body and slip lid, softly rounded vertical edges, a fine V where the lid meets the body. */
function tin(enamel, side, height, lidH) {
  const R = K.inch(0.2);
  const bb = mm(1.1); // bevel at the body / lid joint
  const bl = mm(2.6); // softer round-over on the lid top
  const shape = (b) => K.roundedRect(side - 2 * b, side - 2 * b, R - b);
  const solid = (b, h, bevelSegments) => {
    const g = new THREE.ExtrudeGeometry(shape(b), { depth: h - 2 * b, bevelEnabled: true, bevelThickness: b, bevelSize: b, bevelSegments, curveSegments: 10 });
    g.rotateX(-Math.PI / 2);
    g.translate(0, b, 0);
    return g;
  };
  const bodyH = height - lidH;
  const body = K.part(solid(bb, bodyH, 2), enamel);
  const lid = K.part(solid(bl, lidH, 4), enamel, { pos: [0, bodyH, 0] });
  // a slightly smaller core fills the V so the joint reads as a shadow line, not a see-through gap
  const core = K.part(K.boxGeo(side - mm(1.6), mm(5), side - mm(1.6), R * 0.8), enamel, { pos: [0, bodyH, 0], shadow: false });
  return K.group(body, lid, core);
}

/** The slim brass spoon: a round, shallow bowl and a thin straight handle, lying along x (bowl at +x). */
function spoon(brass) {
  const P = (r, y) => new THREE.Vector2(K.inch(r), K.inch(y));
  const bowl = new THREE.LatheGeometry(
    [P(0, 0), P(0.18, 0.008), P(0.31, 0.04), P(0.39, 0.1), P(0.425, 0.165), P(0.418, 0.178), P(0.39, 0.17), P(0.355, 0.11), P(0.28, 0.06), P(0.16, 0.036), P(0, 0.03)],
    40,
  );
  bowl.scale(1.08, 1, 1); // a touch longer than wide
  const len = K.inch(4.95);
  const rise = K.inch(0.125);
  const tilt = Math.atan2(rise, len);
  const handle = K.part(K.boxGeo(len, K.inch(0.055), K.inch(0.12), mm(0.6)), brass, {
    pos: [-K.inch(0.42) - (len / 2) * Math.cos(tilt), K.inch(0.155) - (len / 2) * Math.sin(tilt), 0],
    rot: [0, 0, tilt],
  });
  // short neck where the handle flares into the bowl
  const neck = K.part(K.boxGeo(K.inch(0.32), K.inch(0.05), K.inch(0.17), mm(0.6)), brass, { pos: [-K.inch(0.5), K.inch(0.158), 0], rot: [0, 0, tilt] });
  return K.group(K.part(bowl, brass), handle, neck);
}

export function build({ wood = 'walnut' } = {}) {
  const L = K.inch(8.5);
  const D = K.inch(4.3);
  const baseT = K.inch(0.6);
  const stepT = K.inch(0.4);
  const stepD = K.inch(2.95);
  const hz = D / 2;
  const stepFront = -hz + stepD;

  const SOFT = { top: mm(1.6), bottom: mm(0.8) };
  const CARVED = { top: mm(0.9), group: 1 };
  const mats = [{}, { darken: 0.72 }, { darken: 0.5 }];

  // ---------- base board with the spoon groove ----------
  const grooveL = K.inch(6.5);
  const grooveW = K.inch(0.95);
  const grooveZ = (stepFront + hz) / 2;
  const grooveDepth = K.inch(0.22);
  const base = woodSlab(
    {
      outline: { pts: rrect(0, 0, L, D, K.inch(0.08), 3), edge: SOFT },
      holes: [{ pts: rrect(0, grooveZ, grooveL, grooveW, K.inch(0.3), 8), depth: grooveDepth, edge: CARVED, floorGroup: 2 }],
      T: baseT,
      tile: [0.46, 0.21],
      offset: [0.31, 0.58],
    },
    { species: wood, materials: mats, name: 'base' },
  );

  // ---------- raised step with three square tin recesses ----------
  const rec = K.inch(2.6);
  const wall = (L - 3 * rec) / 4;
  const recZ = -hz + wall + rec / 2;
  const recDepth = K.inch(0.25);
  const recX = [-1, 0, 1].map((i) => i * (rec + wall));
  const step = woodSlab(
    {
      outline: { pts: rrect(0, (-hz + stepFront) / 2, L, stepD, K.inch(0.08), 3), edge: { top: mm(1.8), bottom: mm(0.4) } },
      holes: recX.map((x) => ({ pts: rrect(x, recZ, rec, rec, K.inch(0.16), 5), depth: recDepth, edge: CARVED, floorGroup: 2 })),
      T: stepT,
      tile: [0.46, 0.21],
      offset: [0.74, 0.13],
    },
    { species: wood, materials: mats, pos: [0, baseT, 0], name: 'step' },
  );

  // ---------- three white tins standing in the recesses ----------
  const enamel = K.M.enamel(0xf1efeb);
  const tinY = baseT + stepT - recDepth + mm(0.3);
  const tins = recX.map((x) => {
    const t = tin(enamel, K.inch(2.55), K.inch(4.9), K.inch(0.45));
    t.position.set(x, tinY, recZ);
    return t;
  });

  // ---------- brass spoon in the groove, bowl towards the right-hand end ----------
  const sp = spoon(K.M.brass());
  sp.position.set(K.inch(2.55), baseT - grooveDepth + mm(0.2), grooveZ);
  sp.rotation.y = rad(-2.5);

  return K.seat(K.group(base, step, ...tins, sp));
}
