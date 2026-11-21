// The Chelsea Board: a 12" round of walnut or oak with a tall loop handle and one straight ribbon of brass inlaid
// flush across the face, rim to rim. Shown standing, leaning back a touch, handle at the top.
import * as K from '../kit.js';

const { THREE } = K;
const TAU = Math.PI * 2;
const rad = THREE.MathUtils.degToRad;

export const meta = { handle: 'the-chelsea-tray', view: { yaw: -0.36, pitch: 0.15 } };

// ---------- local helpers (a rounded-over slab builder the shared kit does not have yet) ----------
// Outlines are drawn in "shape" coordinates (x right, y up when the board stands); height h is the board thickness
// axis. Before the piece is stood up that maps to world (x, h, -y), the same convention as K.slab.
const V = (x, y, h, nx, ny, nh) => [x, h, -y, nx, nh, -ny];

/** Triangle soup. Every triangle is wound to agree with its vertex normals; collapsed triangles are dropped. */
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
  /** Skin between successive rows of vertices (rows[i][j]); `closed` joins the last column to the first. */
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
  /** Flat face at height h from a 2D contour (rows of soup vertices) with holes; ny = +1 faces up, -1 down. */
  const cap = (contour, holes, h, ny) => {
    const flat = (loop) => {
      const pts = loop.map((v) => new THREE.Vector2(v[0], -v[2]));
      return pts.filter((p, i) => p.distanceTo(pts[(i + pts.length - 1) % pts.length]) > 1e-7);
    };
    const c = flat(contour);
    const hs = holes.map(flat);
    const faces = THREE.ShapeUtils.triangulateShape(c, hs);
    const all = c.concat(...hs).map((p) => V(p.x, p.y, h, 0, 0, ny));
    faces.forEach(([i, j, k]) => tri(all[i], all[j], all[k]));
  };
  return { pos, nor, tri, loft, cap };
}

/**
 * Edge profile from the top face to the bottom face: a quarter-ellipse round-over (aw across, ah deep), the wall,
 * then a smaller one underneath (bw, bh). d is the inset from the outline, nr / nh the normal across / along h.
 */
function edgeProfile(T, [aw, ah], [bw, bh], na = 9, nb = 5) {
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

/**
 * Wood mesh from a soup, textured as a solid: the grain is a function of position, so figure runs over the rounded
 * edge and down the sides with no seams. `angle` is the grain direction in the face, `shear` tilts it through
 * the thickness so the edges show lines too.
 */
function woodSolid(s, { angle = 0, size = 0.42, shear = 1.6, offset = [0.17, 0.41], ...opts } = {}) {
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(s.pos, 3));
  geo.setAttribute('normal', new THREE.Float32BufferAttribute(s.nor, 3));
  const mesh = K.wood(geo, { size, ...opts }); // material, wood role, shadows
  const uv = new Float32Array((s.pos.length / 3) * 2);
  const c = Math.cos(angle);
  const sn = Math.sin(angle);
  for (let i = 0, j = 0; i < s.pos.length; i += 3, j += 2) {
    const x = s.pos[i];
    const h = s.pos[i + 1];
    const y = -s.pos[i + 2];
    uv[j] = (x * c + y * sn) / size + offset[0];
    uv[j + 1] = (-x * sn + y * c + h * shear) / (size * 0.5) + offset[1];
  }
  mesh.geometry.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
  return mesh;
}

export function build({ wood = 'walnut' } = {}) {
  const R = K.inch(6);
  const T = K.inch(0.75);
  const roundW = K.inch(0.2); // eased top edge, the same on the rim and the handle
  const roundH = K.inch(0.2);
  const NA = 8;
  const edge = edgeProfile(T, [roundW, roundH], [K.inch(0.15), K.inch(0.15)], NA, 5);
  const slotEdge = edgeProfile(T, [K.inch(0.17), K.inch(0.17)], [K.inch(0.1), K.inch(0.1)], 6, 4);

  // ----- handle: an upright loop, round on top, its sides opening a little as they run into the board -----
  const hA = Math.PI / 2; // straight up
  const loopR = K.inch(0.95); // outer radius of the top of the loop
  const loopD = R + K.inch(1.9); // its centre: the loop stands 2.85" proud of the round
  const flare = rad(5);
  const fil = K.inch(0.6); // fillet where the loop meets the round
  // handle-local frame: a = along the handle axis (outwards), l = across it
  const toBoard = ([a, l]) => [a * Math.cos(hA) - l * Math.sin(hA), a * Math.sin(hA) + l * Math.cos(hA)];
  const E = toBoard([loopD, 0]);
  const neck = [-1, 1].map((side) => {
    const n = [Math.sin(flare), side * Math.cos(flare)]; // outward normal of this side of the loop
    const dir = [-Math.cos(flare), side * Math.sin(flare)]; // along it, towards the board
    const p = [loopD + loopR * n[0], loopR * n[1]]; // where the straight side leaves the round top
    // fillet centre c = p + s * dir + fil * n, with |c| = R + fil
    const q = [p[0] + fil * n[0], p[1] + fil * n[1]];
    const bq = q[0] * dir[0] + q[1] * dir[1];
    const s = -bq - Math.sqrt(bq * bq - (q[0] * q[0] + q[1] * q[1] - (R + fil) ** 2));
    const c = [q[0] + s * dir[0], q[1] + s * dir[1]];
    return {
      n: toBoard(n),
      topPt: toBoard(p),
      filPt: toBoard([p[0] + s * dir[0], p[1] + s * dir[1]]),
      c: toBoard(c),
      nA: hA + Math.atan2(n[1], n[0]), // direction of the normal
      cA: hA + Math.atan2(c[1], c[0]), // where the fillet touches the round
    };
  });

  // One closed ring of the outline, inset by d. Every piece stays tangent at any inset, so normals are exact.
  const rimRing = (d) => {
    const out = [];
    let first = true;
    const arc = (c, r, a0, a1, n, sign) => {
      if (sign < 0) while (a1 > a0) a1 -= TAU; // fillets run clockwise
      else while (a1 < a0) a1 += TAU;
      for (let j = first ? 0 : 1; j <= n; j++) {
        const a = a0 + ((a1 - a0) * j) / n;
        out.push({ x: c[0] + r * Math.cos(a), y: c[1] + r * Math.sin(a), nx: sign * Math.cos(a), ny: sign * Math.sin(a) });
      }
      first = false;
    };
    const line = (p0, p1, nrm, n) => {
      for (let j = 1; j <= n; j++) {
        const t = j / n;
        out.push({ x: p0[0] + (p1[0] - p0[0]) * t - nrm[0] * d, y: p0[1] + (p1[1] - p0[1]) * t - nrm[1] * d, nx: nrm[0], ny: nrm[1] });
      }
    };
    const [n1, n2] = neck;
    arc([0, 0], R - d, n2.cA, n1.cA, 164, 1); // the round, the long way about
    arc(n1.c, fil + d, n1.cA + Math.PI, n1.nA + Math.PI, 8, -1);
    line(n1.filPt, n1.topPt, n1.n, 4);
    arc(E, loopR - d, n1.nA, n2.nA, 30, 1);
    line(n2.topPt, n2.filPt, n2.n, 4);
    arc(n2.c, fil + d, n2.nA + Math.PI, n2.cA + Math.PI, 8, -1);
    out.pop(); // closes on the first point
    return out;
  };

  // ----- slot: a long finger hole, round at both ends, a touch wider at the bottom, dipping into the round -----
  const slotTopR = K.inch(0.5);
  const slotBotR = K.inch(0.56);
  const slotTop = loopD; // concentric with the top of the loop
  const slotBot = R - K.inch(0.9) + slotBotR;
  const beta = Math.asin((slotBotR - slotTopR) / (slotTop - slotBot));
  const slotRing = (d) => {
    const out = [];
    const side = (s) => [Math.sin(beta), s * Math.cos(beta)]; // outward normal of a straight side (handle frame)
    const arc = (a, r, a0, a1, n) => {
      for (let j = 0; j <= n; j++) {
        const t = a0 + ((a1 - a0) * j) / n;
        const nrm = [Math.cos(t), Math.sin(t)];
        out.push({ p: [a + (r + d) * nrm[0], (r + d) * nrm[1]], n: nrm });
      }
    };
    const q = Math.PI / 2 - beta;
    arc(slotTop, slotTopR, -q, q, 16);
    for (let j = 1; j < 4; j++) {
      const t = j / 4;
      const nrm = side(1);
      out.push({ p: [slotTop + (slotBot - slotTop) * t + (slotTopR + (slotBotR - slotTopR) * t + d) * nrm[0], (slotTopR + (slotBotR - slotTopR) * t + d) * nrm[1]], n: nrm });
    }
    arc(slotBot, slotBotR, q, TAU - q, 18);
    for (let j = 1; j < 4; j++) {
      const t = j / 4;
      const nrm = side(-1);
      out.push({ p: [slotBot + (slotTop - slotBot) * t + (slotBotR + (slotTopR - slotBotR) * t + d) * nrm[0], (slotBotR + (slotTopR - slotBotR) * t + d) * nrm[1]], n: nrm });
    }
    // the wall faces into the slot: flip the normals
    return out.map(({ p, n }) => {
      const [x, y] = toBoard(p);
      const [nx, ny] = toBoard(n);
      return { x, y, nx: -nx, ny: -ny };
    });
  };

  const rim = edge.map((p) => rimRing(p.d).map((q) => V(q.x, q.y, p.h, q.nx * p.nr, q.ny * p.nr, p.nh)));
  const slot = slotEdge.map((p) => slotRing(p.d).map((q) => V(q.x, q.y, p.h, q.nx * p.nr, q.ny * p.nr, p.nh)));

  const solid = soup();
  solid.loft(rim, true);
  solid.loft(slot, true);
  solid.cap(rim[0], [slot[0]], T, 1);
  solid.cap(rim[rim.length - 1], [slot[slot.length - 1]], 0, -1);
  const grainA = rad(63); // the grain runs with the ribbon, lower left to upper right
  const body = woodSolid(solid, { species: wood, angle: grainA, size: 0.44, name: 'board' });

  // ----- brass ribbon: a straight chord across the whole face, clipped to the round and following the eased edge -----
  const stripW = K.inch(0.58);
  const stripMid = rad(-27.65); // the ribbon's middle sits this way from the centre (lower right) ...
  const stripOff = R * 0.35; // ... about a third of the way out
  const m = [Math.cos(stripMid), Math.sin(stripMid)]; // across the ribbon
  const along = [-m[1], m[0]]; // along it, lower left to upper right
  const lift = 0.0003; // sits a hair proud so it never fights the wood
  const top = edge.slice(0, NA + 1); // the eased edge, flat -> wall
  const rows = [];
  const NT = 4;
  for (let i = 0; i <= NT; i++) {
    const c = stripOff + stripW * (i / NT - 0.5); // this line's distance from the centre
    const row = [];
    const at = (rho, sign, p) => {
      const s = sign * Math.sqrt(rho * rho - c * c);
      const x = c * m[0] + s * along[0];
      const y = c * m[1] + s * along[1];
      const nx = (x / rho) * p.nr;
      const ny = (y / rho) * p.nr;
      row.push(V(x + nx * lift, y + ny * lift, p.h + p.nh * lift, nx, ny, p.nh));
    };
    for (let k = NA; k >= 0; k--) at(R - top[k].d, -1, top[k]); // lower-left end: wall -> flat
    for (let k = 0; k <= NA; k++) at(R - top[k].d, 1, top[k]); // upper-right end: flat -> wall
    rows.push(row);
  }
  const ribbon = soup();
  ribbon.loft(rows, false);
  // a short skirt all round, tucked into the wood, so the proud edge is closed from every angle
  const skirt = (line, n) =>
    ribbon.loft([line.map((v) => [v[0], v[1], v[2], ...n]), line.map((v) => [v[0] - v[3] * 0.0012, v[1] - v[4] * 0.0012, v[2] - v[5] * 0.0012, ...n])], false);
  const side3 = (sgn) => [m[0] * sgn, 0, -m[1] * sgn]; // world-space sideways normal (x, h, -y)
  skirt(rows[0], side3(-1));
  skirt(rows[NT], side3(1));
  skirt(rows.map((r) => r[0]), [0, -1, 0]);
  skirt(rows.map((r) => r[r.length - 1]), [0, -1, 0]);
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(ribbon.pos, 3));
  geo.setAttribute('normal', new THREE.Float32BufferAttribute(ribbon.nor, 3));
  const brass = K.part(geo, K.M.brassBrushed(), { name: 'brass-ribbon', shadow: false });

  const g = K.group(body, brass);
  g.rotation.x = Math.PI / 2 - 0.16; // stand it up, leaning back a touch
  return K.seat(K.group(g));
}
