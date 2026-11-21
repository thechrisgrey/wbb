// Paper Towel Holder: a 6.6 in round base, 0.9 in thick with eased edges, and a 1.5 in round post 13 in tall whose top
// is cut at about 50 degrees, leaving an oval face the roll slides over. One slim brass line runs unbroken across the
// top of the base from the post to the rim, down the base's edge, up the full height of the post on the same side and
// over the angled face. Shown standing, without the roll; the default view looks at the brass side and the cut.
import * as K from '../kit.js';

const { THREE } = K;
const TAU = Math.PI * 2;

export const meta = { handle: 'paper-towel-holder', view: { yaw: -0.55, pitch: 0.3 } };

// ---------- local helpers (smooth-normal solids; the kit has no lathe-with-profile builder) ----------

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
  /** Thin closing band tucked into the wood along an open edge of a proud strip. */
  const skirt = (line, n, depth = 0.0012) =>
    loft([line.map((v) => [v[0], v[1], v[2], ...n]), line.map((v) => [v[0] - v[3] * depth, v[1] - v[4] * depth, v[2] - v[5] * depth, ...n])], false);
  return { pos, nor, tri, loft, capY, skirt };
}

const toGeo = (s) => {
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(s.pos, 3));
  geo.setAttribute('normal', new THREE.Float32BufferAttribute(s.nor, 3));
  return geo;
};

/** Edge profile from top face to bottom face: quarter-round ease on top (aw x ah), wall, smaller ease below. */
function edgeProfile(T, [aw, ah], [bw, bh], na = 7, nb = 4) {
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

const TONE = { ebonized: 0.5 };

/** Keep a per-species tone on a wood material when the stage re-skins it (a swatch tap). */
function toneBySpecies(mat, table) {
  let cur = mat.userData.species;
  const apply = (to) => {
    const was = mat.userData.darken || 1;
    mat.color.multiplyScalar(to / was);
    mat.userData.darken = to;
  };
  apply(table[cur] ?? 1);
  Object.defineProperty(mat.userData, 'species', {
    configurable: true,
    enumerable: true,
    get: () => cur,
    set(next) {
      cur = next;
      apply(table[next] ?? 1); // setWoodMaterial has just set the colour with the old darken; rescale it
    },
  });
}

export function build({ wood = 'ebonized' } = {}) {
  const Rb = K.inch(3.3);
  const T = K.inch(0.9);
  const rp = K.inch(0.75);
  const postH = K.inch(13); // base top to the high point of the cut
  const tanCut = Math.tan(THREE.MathUtils.degToRad(50));
  const Hc = T + postH - tanCut * rp; // height of the cut plane on the post's axis
  const cutY = (z) => Hc - tanCut * z; // the low side of the cut faces +z, the brass side
  const w = K.inch(0.16);
  const lift = 0.0003;
  const NS = 48; // around the base

  // ----- base: a lathed disc with eased top and bottom edges -----
  const edge = edgeProfile(T, [K.inch(0.16), K.inch(0.15)], [K.inch(0.06), K.inch(0.06)], 7, 4);
  const rings = edge.map((p) =>
    Array.from({ length: NS }, (_, j) => {
      const a = (j / NS) * TAU;
      const c = Math.cos(a);
      const s = Math.sin(a);
      const r = Rb - p.d;
      return [r * s, p.h, r * c, s * p.nr, p.nh, c * p.nr];
    }),
  );
  const disc = soup();
  disc.loft(rings, true);
  disc.capY(rings[0], T, 1);
  disc.capY(rings[rings.length - 1], 0, -1);
  const base = K.wood(toGeo(disc), { species: wood, grain: 'x', size: 0.42, name: 'base' });

  // ----- post: a cylinder with its top vertices sheared onto the cut plane and an oval cap -----
  const nP = new THREE.Vector3(0, 1, tanCut).normalize();
  const cyl = new THREE.CylinderGeometry(rp, rp, 1, 56, 1);
  const P = cyl.attributes.position;
  const N = cyl.attributes.normal;
  for (let i = 0; i < P.count; i++) {
    const top = P.getY(i) > 0;
    P.setY(i, top ? cutY(P.getZ(i)) : T - 0.002);
    if (top && N.getY(i) > 0.5) N.setXYZ(i, nP.x, nP.y, nP.z);
  }
  const postSize = 0.45;
  const post = K.wood(cyl, { species: wood, turned: true, axis: 'y', size: postSize, name: 'post' });
  // end grain on the oval face: map it in the plane of the cut
  {
    const g = post.geometry;
    const pp = g.attributes.position;
    const nn = g.attributes.normal;
    const uv = g.attributes.uv;
    const sec = Math.hypot(1, tanCut);
    for (let i = 0; i < pp.count; i++) {
      if (nn.getY(i) * nP.y + nn.getZ(i) * nP.z < 0.99) continue;
      uv.setXY(i, (pp.getZ(i) * sec) / (postSize * 0.35) + 0.3, pp.getX(i) / (postSize * 0.175) + 0.7);
    }
    uv.needsUpdate = true;
  }

  // ----- the brass line: base top -> base edge, post side, oval face (all a hair proud, edges tucked in) -----
  const strip = soup();
  const NT = 3;
  const lines = Array.from({ length: NT + 1 }, (_, i) => -w / 2 + (w * i) / NT); // x offsets across the strip

  // base: from the post out along +z, over the eased edge and down to the bottom ease
  const baseRows = lines.map((x) => {
    const row = [];
    const flatEnd = Rb - edge[0].d;
    const z0 = Math.sqrt(rp * rp - x * x) + lift;
    for (let k = 0; k <= 4; k++) {
      const z = z0 + ((Math.sqrt(flatEnd * flatEnd - x * x) - z0) * k) / 4;
      row.push([x, T + lift, z, 0, 1, 0]);
    }
    for (let k = 1; k < edge.length; k++) {
      const p = edge[k];
      const rho = Rb - p.d;
      const z = Math.sqrt(rho * rho - x * x);
      const nx = (x / rho) * p.nr;
      const nz = (z / rho) * p.nr;
      row.push([x + nx * lift, p.h + p.nh * lift, z + nz * lift, nx, p.nh, nz]);
    }
    return row;
  });
  strip.loft(baseRows, false);
  strip.skirt(baseRows[0], [-1, 0, 0]);
  strip.skirt(baseRows[NT], [1, 0, 0]);
  strip.skirt(baseRows.map((r) => r[r.length - 1]), [0, -1, 0]);

  // post side: a narrow sector of a cylinder just outside the post, from the base up to the cut
  const rs = rp + lift;
  const hw = w / 2 / rp;
  const NC = 4;
  const cols = Array.from({ length: NC + 1 }, (_, i) => {
    const a = -hw + (2 * hw * i) / NC;
    const s = Math.sin(a);
    const c = Math.cos(a);
    const yTop = cutY(rp * c) + lift * 0.5;
    const n = [s, 0, c];
    return [0, 0.25, 0.5, 0.75, 1].map((t) => [rs * s, T + (yTop - T) * t, rs * c, ...n]);
  });
  strip.loft(cols, false);
  strip.skirt(cols[0], [-Math.cos(hw), 0, Math.sin(hw)]);
  strip.skirt(cols[NC], [Math.cos(hw), 0, Math.sin(hw)]);

  // oval face: along the long axis of the cut, from the low edge to the high edge
  const faceRows = lines.map((x) => {
    const zEnd = Math.sqrt(rp * rp - x * x);
    const row = [];
    const NZ = 10;
    for (let k = 0; k <= NZ; k++) {
      const z = -zEnd + (2 * zEnd * k) / NZ;
      row.push([x + nP.x * lift, cutY(z) + nP.y * lift, z + nP.z * lift, nP.x, nP.y, nP.z]);
    }
    return row;
  });
  strip.loft(faceRows, false);
  strip.skirt(faceRows[0], [-1, 0, 0]);
  strip.skirt(faceRows[NT], [1, 0, 0]);
  strip.skirt(faceRows.map((r) => r[0]), [0, nP.z, -nP.y]);
  const brass = K.part(toGeo(strip), K.M.brassBrushed(), { name: 'brass-line', shadow: false });

  // Her black stain reads near-black, deeper than the shared ebonized texture; keep that tone across swatch swaps.
  [base.material, post.material].forEach((mat) => toneBySpecies(mat, TONE));
  return K.seat(K.group(base, post, brass));
}
