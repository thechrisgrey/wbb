// The Snack Tray: a 10 x 10 x 3/4 in serving board with the grain running one way, generously eased edges, slightly
// rounded corners and one large round finger hole near a corner, its edge eased as well. Lies flat; the default view
// looks across the board from the front corner with the hole at the far left, as in her photos.
import * as K from '../kit.js';

const { THREE } = K;
const TAU = Math.PI * 2;

export const meta = { handle: 'the-snack-tray', view: { yaw: 0.45, pitch: 0.75 } };

// ---------- local helpers (smooth-normal rounded-over slab; the kit's slab has a flat-shaded bevel) ----------

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
  /** Flat horizontal face at height y from an outer ring and hole rings (vertex arrays, x/z used). */
  const capY = (ring, holes, y, ny) => {
    const v2 = (loop) => loop.map((v) => new THREE.Vector2(v[0], v[2]));
    const c = v2(ring);
    const hs = holes.map(v2);
    const all = c.concat(...hs);
    THREE.ShapeUtils.triangulateShape(c, hs).forEach(([i, j, k]) => {
      const P = (q) => [all[q].x, y, all[q].y, 0, ny, 0];
      tri(P(i), P(j), P(k));
    });
  };
  return { pos, nor, tri, loft, capY };
}

/** Edge profile from top face to bottom face: quarter-round ease on top (aw x ah), wall, smaller ease below. */
function edgeProfile(T, [aw, ah], [bw, bh], na = 8, nb = 5) {
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

/** Rounded-rectangle ring inset by d: points { x, z, nx, nz } (outward normals). */
function rrRing(L, W, rc, d, seg = 8) {
  const out = [];
  const cx = L / 2 - rc;
  const cz = W / 2 - rc;
  [
    [cx, cz, 0],
    [-cx, cz, Math.PI / 2],
    [-cx, -cz, Math.PI],
    [cx, -cz, Math.PI * 1.5],
  ].forEach(([x0, z0, a0]) => {
    for (let i = 0; i <= seg; i++) {
      const a = a0 + ((Math.PI / 2) * i) / seg;
      out.push({ x: x0 + (rc - d) * Math.cos(a), z: z0 + (rc - d) * Math.sin(a), nx: Math.cos(a), nz: Math.sin(a) });
    }
  });
  return out;
}

// Oiled walnut on her boards reads as a deep, cool chocolate; keep oak near its natural tone.
const TONE = { walnut: 0.74, oak: 0.95 };

/** Keep a per-species tone on a wood material when the stage re-skins it (a swatch tap). */
function toneBySpecies(mat, table) {
  let cur = mat.userData.species;
  Object.defineProperty(mat.userData, 'species', {
    configurable: true,
    enumerable: true,
    get: () => cur,
    set(next) {
      cur = next;
      const was = mat.userData.darken || 1; // setWoodMaterial has just applied the old tone
      const to = table[next] ?? 1;
      mat.color.multiplyScalar(to / was);
      mat.userData.darken = to;
    },
  });
}

export function build({ wood = 'walnut' } = {}) {
  const L = K.inch(10);
  const W = K.inch(10);
  const T = K.inch(0.75);
  const rc = K.inch(0.38); // slightly rounded corners
  const edge = edgeProfile(T, [K.inch(0.26), K.inch(0.24)], [K.inch(0.1), K.inch(0.09)], 8, 4);

  // finger hole: 2.2 in across, its rim 0.7 in in from both edges of the back-left corner
  const holeR = K.inch(1.1);
  const hc = [-L / 2 + K.inch(0.7) + holeR, -W / 2 + K.inch(0.7) + holeR];
  const holeEdge = edgeProfile(T, [K.inch(0.17), K.inch(0.16)], [K.inch(0.09), K.inch(0.08)], 6, 4);
  const nH = 64;

  const rim = edge.map((p) => rrRing(L, W, rc, p.d).map((q) => [q.x, p.h, q.z, q.nx * p.nr, p.nh, q.nz * p.nr]));
  const hole = holeEdge.map((p) =>
    Array.from({ length: nH }, (_, j) => {
      const a = (j / nH) * TAU;
      const r = holeR + p.d;
      return [hc[0] + r * Math.cos(a), p.h, hc[1] + r * Math.sin(a), -Math.cos(a) * p.nr, p.nh, -Math.sin(a) * p.nr];
    }),
  );

  const s = soup();
  s.loft(rim, true);
  s.loft(hole, true);
  s.capY(rim[0], [hole[0]], T, 1);
  s.capY(rim[rim.length - 1], [hole[hole.length - 1]], 0, -1);

  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(s.pos, 3));
  geo.setAttribute('normal', new THREE.Float32BufferAttribute(s.nor, 3));
  const board = K.wood(geo, { species: wood, darken: TONE[wood] ?? 1, name: 'board' });
  toneBySpecies(board.material, TONE);

  // Solid-texture UVs: grain runs along x across the whole board and carries over the eased edges with no seams;
  // a little shear through the thickness gives the edges and the hole wall their own lines.
  const size = 0.46;
  const shear = 1.4;
  const P = geo.attributes.position.array;
  const uv = new Float32Array((P.length / 3) * 2);
  for (let i = 0; i < P.length / 3; i++) {
    uv[i * 2] = P[i * 3] / size + 0.23;
    uv[i * 2 + 1] = (P[i * 3 + 2] + P[i * 3 + 1] * shear) / (size * 0.5) + 0.61;
  }
  board.geometry.setAttribute('uv', new THREE.BufferAttribute(uv, 2));

  return K.seat(K.group(board));
}
