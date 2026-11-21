// Nightcap Bath Tray: a 32" plank of Bolivian rosewood that spans the tub. A spun-brass coaster sits flush in a
// round hole near one end; a saw-kerf slit runs from the long edge into that hole so a wine-glass stem can slide in
// and the glass hang there once the coaster is lifted out. A long carved slot on the far half stands a phone or
// tablet, and two cleats underneath sit against the inside of the tub rim. Shown lying flat, resting on its cleats.
import * as K from '../kit.js';

const { THREE } = K;

export const meta = { handle: 'nightcap-bath-tray', view: { yaw: -0.62, pitch: 0.68 }, fit: 0.94 };

const mm = (n) => n / 1000;
const rad = (deg) => (deg * Math.PI) / 180;

/**
 * Local helper (kit gap): a slab cut from a plan outline, like K.slab, but with
 *  - a true quarter-round ease per EDGE (top and bottom), so the outside can be softly rounded over while
 *    saw cuts and carved slots stay crisp,
 *  - blind recesses (holes with `depth`) that get real walls and a floor,
 *  - optional mitred edges (`miter: 1` is a 45 degree undercut),
 *  - wood UVs that wrap over the eased edges, so the grain on top carries on down the sides without a seam.
 * Plan points are [x, z] in metres; the slab spans y = 0 .. T. Returns a non-indexed BufferGeometry with one
 * geometry group per `group` index used (0 = body).
 */
function easedSlab({ outline, holes = [], T, size = 0.5, offset = [0, 0] }) {
  const su = size;
  const sv = size * 0.5;
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
          ? [y / (su * 0.35) + offset[0], (z * o[0] - x * o[1]) / (su * 0.175) + offset[1]] // end grain: tighter, turned
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

const arc = (cx, cz, r, a0, a1, n) => {
  const out = [];
  for (let i = 0; i <= n; i++) {
    const a = a0 + ((a1 - a0) * i) / n;
    out.push([cx + Math.cos(a) * r, cz + Math.sin(a) * r]);
  }
  return out;
};

// Spun brass: the lathe-turned floor of the coaster throws a bow-tie highlight that swings round as the tray turns.
let spun;
const spunBrass = () =>
  (spun ||= new THREE.MeshPhysicalMaterial({ color: 0xd8ad55, metalness: 1, roughness: 0.3, anisotropy: 0.82, envMapIntensity: 1.2 }));

export function build({ wood = 'rosewood' } = {}) {
  const L = K.inch(32);
  const W = K.inch(6.5);
  const T = K.inch(0.85);
  const hl = L / 2;
  const hw = W / 2;
  const R = K.inch(2.2); // corner radius of the rounded ends

  // Plan layout: x runs along the plank (coaster end = +x), z across it (slit side = +z, slot side = -z).
  const cx = K.inch(5.5); // coaster centre
  const cz = K.inch(0.75);
  const Rh = K.inch(1.75); // hole
  const Rc = K.inch(1.7); // coaster
  const sw = K.inch(0.28); // slit (saw kerf) width

  const slotL = K.inch(12.5);
  const slotW = K.inch(0.45);
  const slotX = K.inch(5.4) - slotL / 2; // its near end is level with the coaster centre
  const slotZ = -hw + K.inch(0.8) + slotW / 2;
  const slotDepth = K.inch(0.5);

  // ---------- the plank ----------
  const SOFT = { top: mm(3.2), bottom: mm(2) }; // the router round-over on the outside
  const CUT = { top: mm(0.6), bottom: mm(0.5) }; // saw kerf and bored hole: just broken edges
  const pts = [];
  const tags = [];
  const add = (list, tag) => list.forEach((p) => (pts.push(p), tags.push(tag)));
  add([[cx - sw / 2, hw]], SOFT);
  add(arc(-hl + R, hw - R, R, rad(90), rad(180), 20), SOFT);
  add(arc(-hl + R, -hw + R, R, rad(180), rad(270), 20), SOFT);
  add(arc(hl - R, -hw + R, R, rad(270), rad(360), 20), SOFT);
  add(arc(hl - R, hw - R, R, rad(0), rad(90), 20), SOFT);
  add([[cx + sw / 2, hw]], CUT);
  const gap = Math.asin(sw / 2 / Rh);
  add(arc(cx, cz, Rh, Math.PI / 2 - gap, -1.5 * Math.PI + gap, 88), CUT); // clockwise round the hole, back to the slit

  const rr = K.inch(0.11);
  const slot = [
    ...arc(slotX + slotL / 2 - rr, slotZ + slotW / 2 - rr, rr, rad(0), rad(90), 5),
    ...arc(slotX - slotL / 2 + rr, slotZ + slotW / 2 - rr, rr, rad(90), rad(180), 5),
    ...arc(slotX - slotL / 2 + rr, slotZ - slotW / 2 + rr, rr, rad(180), rad(270), 5),
    ...arc(slotX + slotL / 2 - rr, slotZ - slotW / 2 + rr, rr, rad(270), rad(360), 5),
  ];

  const GRAIN = { size: 0.56, offset: [0.36, 0.69] };
  const plank = woodSlab(
    {
      outline: { pts, edge: (j) => tags[j] },
      holes: [{ pts: slot, depth: slotDepth, edge: { top: mm(0.8), group: 1 }, floorGroup: 2 }],
      T,
      ...GRAIN,
    },
    { species: wood, materials: [{}, { darken: 0.62 }, { darken: 0.34 }], name: 'plank' },
  );

  // The ledge the coaster rests on: the hole is counterbored, so below the coaster it is a little narrower.
  const coasterH = K.inch(0.3);
  const ledgeGap = rad(8);
  const ledge = woodSlab(
    {
      outline: {
        pts: [
          ...arc(cx, cz, Rh + mm(0.3), Math.PI / 2 + ledgeGap, Math.PI * 2.5 - ledgeGap, 44),
          ...arc(cx, cz, Rh - K.inch(0.24), Math.PI * 2.5 - ledgeGap, Math.PI / 2 + ledgeGap, 44),
        ],
        edge: {},
      },
      T: T - coasterH - mm(0.3),
      ...GRAIN,
    },
    { species: wood, darken: 0.6, shadow: false, name: 'ledge' },
  );

  // ---------- the brass coaster ----------
  const yTop = T + mm(0.4); // rim stands a hair proud so it catches the light
  const yFloor = yTop - mm(2);
  const yBot = T - coasterH;
  const lip = mm(3.2);
  const Rf = Rc - lip - mm(0.9); // edge of the flat floor
  const g = mm(0.15); // guard points keep the lathe's smoothed normals from bleeding across the flats
  const P = (r, y) => new THREE.Vector2(r, y);
  const dish = K.part(
    new THREE.LatheGeometry(
      [
        P(0, yBot),
        P(Rc - mm(0.7) - g, yBot),
        P(Rc - mm(0.7), yBot),
        P(Rc, yBot + mm(0.7)),
        P(Rc, yBot + mm(0.7) + g),
        P(Rc, yTop - mm(0.45) - g),
        P(Rc, yTop - mm(0.45)),
        P(Rc - mm(0.18), yTop - mm(0.13)),
        P(Rc - mm(0.5), yTop),
        P(Rc - mm(0.5) - g, yTop),
        P(Rc - lip + mm(0.4) + g, yTop),
        P(Rc - lip + mm(0.4), yTop),
        P(Rc - lip + mm(0.1), yTop - mm(0.14)),
        P(Rc - lip, yTop - mm(0.4)),
        P(Rc - lip - mm(0.25), yFloor + mm(0.75)),
        P(Rc - lip - mm(0.5), yFloor + mm(0.25)),
        P(Rf, yFloor),
      ],
      112,
    ),
    K.M.brassBrushed(),
    { pos: [cx, 0, cz], name: 'coaster' },
  );
  const floorGeo = new THREE.RingGeometry(0, Rf + mm(0.05), 128, 3);
  {
    // polar UVs (u = radius, v = angle) give the anisotropic highlight its circular lay
    const uv = floorGeo.getAttribute('uv');
    for (let j = 0; j <= 3; j++) for (let i = 0; i <= 128; i++) uv.setXY(j * 129 + i, j / 3, i / 128);
    floorGeo.rotateX(-Math.PI / 2);
  }
  const floor = K.part(floorGeo, spunBrass(), { pos: [cx, yFloor, cz], shadow: false, name: 'coaster-floor' });

  // The hairline of shadow between brass and wood.
  const seamGeo = new THREE.RingGeometry(Rc - mm(0.3), Rh + mm(0.3), 96, 1, -Math.PI / 2 + rad(6), Math.PI * 2 - rad(12));
  seamGeo.rotateX(-Math.PI / 2);
  const seam = K.part(seamGeo, K.M.recess(), { pos: [cx, T - mm(1.8), cz], shadow: false });

  // ---------- cleats that sit against the inside of the tub rim ----------
  const cleatSize = [K.inch(0.7), K.inch(0.75), W - K.inch(0.9)];
  const cleat = (x) =>
    K.board([cleatSize[0], cleatSize[1] + mm(0.4), cleatSize[2]], { species: wood, grain: 'z', size: 0.42, radius: mm(1.4), pos: [x, -cleatSize[1] / 2 + mm(0.2), 0] });

  return K.seat(K.group(plank, ledge, dish, floor, seam, cleat(K.inch(8.6)), cleat(K.inch(-13.3))));
}
