// The Cornerstone Block: a 12 x 16 x 1.6 in end-grain cutting block. Rounded corners, softly eased top and bottom
// edges, an end-grain checker on top, long grain running up the sides, a solid brass bar let into the front long side
// near the left corner (it wraps over the eased top edge), and four small round brass feet. Lies flat.
import * as K from '../kit.js';

const { THREE } = K;

export const meta = { handle: 'the-cornerstone-block', view: { yaw: -0.5, pitch: 0.65 } };

// ---------- local helpers (smooth-normal solids with two material groups; the kit has no such builder) ----------

/** Triangle soup. Triangles are wound to agree with their vertex normals; collapsed triangles are dropped. */
function soup() {
  const pos = [];
  const nor = [];
  const tri = (a, b, c) => {
    const ux = b[0] - a[0];
    const uy = b[1] - a[1];
    const uz = b[2] - a[2];
    const vx = c[0] - a[0];
    const vy = c[1] - a[1];
    const vz = c[2] - a[2];
    const gx = uy * vz - uz * vy;
    const gy = uz * vx - ux * vz;
    const gz = ux * vy - uy * vx;
    if (gx * gx + gy * gy + gz * gz < 1e-22) return;
    const flip = gx * (a[3] + b[3] + c[3]) + gy * (a[4] + b[4] + c[4]) + gz * (a[5] + b[5] + c[5]) < 0;
    for (const p of flip ? [a, c, b] : [a, b, c]) {
      pos.push(p[0], p[1], p[2]);
      nor.push(p[3], p[4], p[5]);
    }
  };
  const loft = (rows, closed) => {
    for (let i = 0; i < rows.length - 1; i++) {
      const n = rows[i].length;
      for (let j = 0; j < (closed ? n : n - 1); j++) {
        const k = (j + 1) % n;
        tri(rows[i][j], rows[i][k], rows[i + 1][k]);
        tri(rows[i][j], rows[i + 1][k], rows[i + 1][j]);
      }
    }
  };
  /** Flat horizontal face from a ring of vertices (x, z), facing up (ny = 1) or down (-1). */
  const capY = (ring, y, ny) => {
    const pts = ring.map((v) => new THREE.Vector2(v[0], v[2]));
    THREE.ShapeUtils.triangulateShape(pts, []).forEach(([i, j, k]) => {
      const P = (q) => [pts[q].x, y, pts[q].y, 0, ny, 0];
      tri(P(i), P(j), P(k));
    });
  };
  return { pos, nor, tri, loft, capY };
}

/** Edge profile from top face to bottom face: quarter-round ease on top (aw x ah), wall, smaller ease below. */
function edgeProfile(T, [aw, ah], [bw, bh], na = 7, nb = 5) {
  const out = [];
  const at = (p, w, t, h, sign) => {
    const l = Math.hypot(t * Math.cos(p), w * Math.sin(p));
    out.push({ d: w * (1 - Math.cos(p)), h, nr: (t * Math.cos(p)) / l, nh: (sign * w * Math.sin(p)) / l });
  };
  for (let i = 0; i <= na; i++) {
    const p = (Math.PI / 2) * (1 - i / na);
    at(p, aw, ah, T - ah + ah * Math.sin(p), 1);
  }
  for (let i = 0; i <= nb; i++) {
    const p = (Math.PI / 2) * (i / nb);
    at(p, bw, bh, bh - bh * Math.sin(p), -1);
  }
  return out;
}

/** Rounded-rectangle ring inset by d: points { x, z, nx, nz, s } (s = arc length along the ring). */
function rrRing(L, W, rc, d, seg = 10) {
  const out = [];
  const cx = L / 2 - rc;
  const cz = W / 2 - rc;
  const corners = [
    [cx, cz, 0],
    [-cx, cz, Math.PI / 2],
    [-cx, -cz, Math.PI],
    [cx, -cz, Math.PI * 1.5],
  ];
  const r = rc - d;
  for (const [x0, z0, a0] of corners) {
    for (let i = 0; i <= seg; i++) {
      const a = a0 + ((Math.PI / 2) * i) / seg;
      out.push({ x: x0 + r * Math.cos(a), z: z0 + r * Math.sin(a), nx: Math.cos(a), nz: Math.sin(a) });
    }
  }
  let s = 0;
  out.forEach((p, i) => {
    if (i) s += Math.hypot(p.x - out[i - 1].x, p.z - out[i - 1].z);
    p.s = s;
  });
  return out;
}

/** Pack soups into one geometry with one draw group per soup. */
function packGroups(soups) {
  const pos = [];
  const nor = [];
  const geo = new THREE.BufferGeometry();
  let start = 0;
  soups.forEach((s, i) => {
    pos.push(...s.pos);
    nor.push(...s.nor);
    const n = s.pos.length / 3;
    geo.addGroup(start, n, i);
    start += n;
  });
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  geo.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3));
  return geo;
}

// Oiled end grain drinks finish and reads darker than face grain; her walnut blocks are a deep chocolate brown.
const TONE = { top: { walnut: 0.6, oak: 0.9 }, side: { walnut: 0.7, oak: 0.92 } };

/** Keep a per-species tone on a wood material when the stage re-skins it (a swatch tap). */
function toneBySpecies(mat, table) {
  let cur = mat.userData.species;
  Object.defineProperty(mat.userData, 'species', {
    configurable: true,
    enumerable: true,
    get: () => cur,
    set(next) {
      cur = next;
      // setWoodMaterial has just set the colour with the old darken; rescale it to this species' tone
      const was = mat.userData.darken || 1;
      const to = table[next] ?? 1;
      mat.color.multiplyScalar(to / was);
      mat.userData.darken = to;
    },
  });
}

export function build({ wood = 'walnut' } = {}) {
  const L = K.inch(16);
  const W = K.inch(12);
  const T = K.inch(1.6);
  const rc = K.inch(0.5);
  const edge = edgeProfile(T, [K.inch(0.24), K.inch(0.22)], [K.inch(0.12), K.inch(0.11)], 7, 4);
  const footH = K.inch(0.25);

  // ----- the block: end grain on top, bottom and the eased bands; long grain (vertical) on the walls -----
  const top = soup();
  const side = soup();
  const rings = edge.map((p) => rrRing(L, W, rc, p.d).map((q) => ({ ...q, v: [q.x, p.h, q.z, q.nx * p.nr, p.nh, q.nz * p.nr] })));
  const iTopEnd = edge.findIndex((p) => p.nh < 0.35); // where the top ease turns down into the wall
  const iBotStart = edge.findIndex((p, i) => i > iTopEnd && p.nh < -0.35);
  const rows = (a, b) => rings.slice(a, b + 1).map((r) => r.map((q) => q.v));
  top.loft(rows(0, iTopEnd), true);
  side.loft(rows(iTopEnd, iBotStart), true);
  top.loft(rows(iBotStart, edge.length - 1), true);
  top.capY(rings[0].map((q) => q.v), T, 1);
  top.capY(rings[edge.length - 1].map((q) => q.v), 0, -1);
  const geo = packGroups([top, side]);

  // UVs: end grain is a square glue-up checker laid flat (one texture tile covers 16 in, about 8 blocks);
  // the walls carry long grain running straight up, mapped by distance around the outline so corners have no seam.
  const tile = K.inch(16);
  const size = 0.42;
  const nTop = top.pos.length / 3;
  const P = geo.attributes.position.array;
  const sOf = (x, z) => {
    // arc length of the nearest outline point (walls are lofted from rings with identical indexing)
    let best = 0;
    let bd = Infinity;
    for (const q of rings[iTopEnd]) {
      const dd = (q.x - x) ** 2 + (q.z - z) ** 2;
      if (dd < bd) {
        bd = dd;
        best = q.s;
      }
    }
    return best;
  };
  const uv = new Float32Array((P.length / 3) * 2);
  for (let i = 0; i < P.length / 3; i++) {
    const x = P[i * 3];
    const y = P[i * 3 + 1];
    const z = P[i * 3 + 2];
    if (i < nTop) {
      uv[i * 2] = x / tile + 0.5;
      uv[i * 2 + 1] = z / tile + 0.5;
    } else {
      uv[i * 2] = y / size + 0.31;
      uv[i * 2 + 1] = sOf(x, z) / (size * 0.5) + 0.17;
    }
  }
  const block = K.wood(geo, { species: wood, materials: [{ endGrain: true, darken: TONE.top[wood] ?? 1 }, { darken: TONE.side[wood] ?? 1 }], name: 'block' });
  toneBySpecies(block.material[0], TONE.top);
  toneBySpecies(block.material[1], TONE.side);
  block.geometry.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
  block.position.y = footH;

  // ----- brass bar: let into the front long side near the left corner, full height, wrapping over both eases -----
  const bw = K.inch(0.6);
  const depth = K.inch(0.42); // how far it reaches into the block (shows as a short strip on the top face)
  const proud = 0.0004;
  const x0 = -L / 2 + K.inch(2.7);
  const x1 = x0 + bw;
  const zf = W / 2;
  const prof = edge.map((p) => ({ z: zf - p.d + p.nr * proud, y: p.h + p.nh * proud, nz: p.nr, ny: p.nh }));
  const bar = soup();
  const row = (x) => prof.map((q) => [x, q.y, q.z, 0, q.ny, q.nz]);
  bar.loft([row(x0), row(x1)], false);
  const zi = zf - depth;
  const yt = T + proud;
  const yb = -proud;
  const quad = (a, b, c, d) => {
    bar.tri(a, b, c);
    bar.tri(a, c, d);
  };
  const zTop = prof[0].z;
  const zBot = prof[prof.length - 1].z;
  quad([x0, yt, zi, 0, 1, 0], [x1, yt, zi, 0, 1, 0], [x1, yt, zTop, 0, 1, 0], [x0, yt, zTop, 0, 1, 0]);
  quad([x0, yb, zi, 0, -1, 0], [x1, yb, zi, 0, -1, 0], [x1, yb, zBot, 0, -1, 0], [x0, yb, zBot, 0, -1, 0]);
  quad([x0, yt, zi, 0, 0, -1], [x1, yt, zi, 0, 0, -1], [x1, yb, zi, 0, 0, -1], [x0, yb, zi, 0, 0, -1]);
  [
    [x0, -1],
    [x1, 1],
  ].forEach(([x, nx]) => {
    const outline = [[zi, yt], ...prof.map((q) => [q.z, q.y]), [zi, yb]].map(([z, y]) => new THREE.Vector2(z, y));
    THREE.ShapeUtils.triangulateShape(outline, []).forEach(([a, b, c]) => {
      const V = (k) => [x, outline[k].y, outline[k].x, nx, 0, 0];
      bar.tri(V(a), V(b), V(c));
    });
  });
  const barGeo = new THREE.BufferGeometry();
  barGeo.setAttribute('position', new THREE.Float32BufferAttribute(bar.pos, 3));
  barGeo.setAttribute('normal', new THREE.Float32BufferAttribute(bar.nor, 3));
  const brassBar = K.part(barGeo, K.M.brassBrushed(), { pos: [0, footH, 0], name: 'brass-bar' });

  // ----- four small round brass feet under the corners -----
  const fr = K.inch(0.35);
  const fe = K.inch(0.05);
  const footPts = [new THREE.Vector2(0, 0)];
  for (let i = 0; i <= 4; i++) {
    const a = -Math.PI / 2 + ((Math.PI / 2) * i) / 4;
    footPts.push(new THREE.Vector2(fr - fe + fe * Math.cos(a), fe + fe * Math.sin(a)));
  }
  footPts.push(new THREE.Vector2(fr, footH + 0.0005), new THREE.Vector2(0, footH + 0.0005));
  const footGeo = new THREE.LatheGeometry(footPts, 32);
  const inset = K.inch(1.1);
  const feet = [-1, 1].flatMap((sx) => [-1, 1].map((sz) => K.part(footGeo, K.M.brass(), { pos: [sx * (L / 2 - inset), 0, sz * (W / 2 - inset)], name: 'foot' })));

  return K.seat(K.group(block, brassBar, ...feet));
}
