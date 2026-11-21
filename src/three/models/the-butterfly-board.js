// The Butterfly Board: a 12" round of walnut or oak with a round ear handle, a natural split running in from the
// rim, and a brass butterfly key set flush across it. Shown standing, leaning back a touch, handle up and to the left.
import * as K from '../kit.js';

const { THREE } = K;
const TAU = Math.PI * 2;
const rad = THREE.MathUtils.degToRad;
const pol = (rho, th) => [rho * Math.cos(th), rho * Math.sin(th)];

export const meta = { handle: 'the-butterfly-board', view: { yaw: -0.4, pitch: 0.16 } };

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

/** Edge profile from the top face to the bottom face: a quarter-round of radius a, the wall, a quarter-round b. */
function edgeProfile(T, a, b, na = 8, nb = 5) {
  const out = [];
  for (let i = 0; i <= na; i++) {
    const p = (Math.PI / 2) * (1 - i / na);
    out.push({ d: a * (1 - Math.cos(p)), h: T - a + a * Math.sin(p), nr: Math.cos(p), nh: Math.sin(p) });
  }
  for (let i = 0; i <= nb; i++) {
    const p = (Math.PI / 2) * (i / nb);
    out.push({ d: b * (1 - Math.cos(p)), h: b - b * Math.sin(p), nr: Math.cos(p), nh: -Math.sin(p) });
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

/** Round the corners of a polygon. pts: [[x, y], ...], radii per corner. Works for convex and concave corners. */
function roundCorners(pts, radii, seg = 6) {
  const out = [];
  const n = pts.length;
  for (let i = 0; i < n; i++) {
    const p = pts[i];
    const a = pts[(i + n - 1) % n];
    const b = pts[(i + 1) % n];
    const la = Math.hypot(a[0] - p[0], a[1] - p[1]);
    const lb = Math.hypot(b[0] - p[0], b[1] - p[1]);
    const u1 = [(a[0] - p[0]) / la, (a[1] - p[1]) / la];
    const u2 = [(b[0] - p[0]) / lb, (b[1] - p[1]) / lb];
    const half = Math.acos(THREE.MathUtils.clamp(u1[0] * u2[0] + u1[1] * u2[1], -1, 1)) / 2;
    const t = Math.min(radii[i] / Math.tan(half), la * 0.45, lb * 0.45);
    const r = t * Math.tan(half);
    const bis = [u1[0] + u2[0], u1[1] + u2[1]];
    const bl = Math.hypot(bis[0], bis[1]);
    const c = [p[0] + (bis[0] / bl) * (r / Math.sin(half)), p[1] + (bis[1] / bl) * (r / Math.sin(half))];
    const s = [p[0] + u1[0] * t, p[1] + u1[1] * t];
    const e = [p[0] + u2[0] * t, p[1] + u2[1] * t];
    const a0 = Math.atan2(s[1] - c[1], s[0] - c[0]);
    let da = Math.atan2(e[1] - c[1], e[0] - c[0]) - a0;
    if (da > Math.PI) da -= TAU;
    if (da < -Math.PI) da += TAU;
    for (let k = 0; k <= seg; k++) out.push([c[0] + r * Math.cos(a0 + (da * k) / seg), c[1] + r * Math.sin(a0 + (da * k) / seg)]);
  }
  return out;
}

export function build({ wood = 'walnut' } = {}) {
  const R = K.inch(6);
  const T = K.inch(0.8);
  const edge = edgeProfile(T, K.inch(0.3), K.inch(0.13), 8, 5); // soft, generous round-over on the top edge

  // ----- handle: a round ear standing off the rim on a short neck that widens into the round -----
  const hA = rad(155); // up and to the left
  const earR = K.inch(1.4);
  const earD = R + K.inch(1.0);
  const flare = rad(12); // each side of the neck opens out this much towards the board
  const fil = K.inch(0.45); // fillet where the neck meets the round
  const holeR = K.inch(0.59);
  const holeEdge = edgeProfile(T, K.inch(0.15), K.inch(0.08), 6, 4);
  // handle-local frame: a = along the handle axis (outwards), l = across it
  const toBoard = ([a, l]) => [a * Math.cos(hA) - l * Math.sin(hA), a * Math.sin(hA) + l * Math.cos(hA)];
  const E = toBoard([earD, 0]);
  const neck = [-1, 1].map((side) => {
    const n = [Math.sin(flare), side * Math.cos(flare)]; // outward normal of this side of the neck
    const dir = [-Math.cos(flare), side * Math.sin(flare)]; // along it, towards the board
    const p = [earD + earR * n[0], earR * n[1]]; // where the neck leaves the ear
    // fillet centre c = p + s * dir + fil * n, with |c| = R + fil
    const q = [p[0] + fil * n[0], p[1] + fil * n[1]];
    const bq = q[0] * dir[0] + q[1] * dir[1];
    const s = -bq - Math.sqrt(bq * bq - (q[0] * q[0] + q[1] * q[1] - (R + fil) ** 2));
    const c = [q[0] + s * dir[0], q[1] + s * dir[1]];
    return {
      n: toBoard(n),
      earPt: toBoard(p),
      filPt: toBoard([p[0] + s * dir[0], p[1] + s * dir[1]]),
      c: toBoard(c),
      nA: hA + Math.atan2(n[1], n[0]), // direction of the normal
      cA: hA + Math.atan2(c[1], c[0]), // where the fillet touches the round
    };
  });

  // ----- the split: a V running in from the rim, a little crooked, wide at the rim and closing to nothing.
  // It also leans through the thickness, the way a real check does, so you look at its dark walls, not through it.
  const crackA = rad(-72); // lower right
  const crackLen = K.inch(2.4);
  const tipR = R - crackLen;
  const lean = 0.3;
  // sideways drift of the split's centre line (metres) and its half width, both as a function of radius
  const drift = (rho) => {
    const s = (R - rho) / crackLen;
    return crackLen * (0.14 * s + 0.024 * Math.sin(s * 5.2 + 0.5) + 0.008 * Math.sin(s * 15 + 1.3));
  };
  const halfW = (rho) => {
    const s = THREE.MathUtils.clamp((rho - tipR) / crackLen, 0, 1);
    return K.inch(0.135) * s ** 1.15 + K.inch(0.035) * Math.exp(-(R - rho) / K.inch(0.07));
  };
  const wallTh = (side, rho, h) => crackA + (drift(rho) + lean * (T - h) + side * halfW(rho)) / rho;
  const wallPt = (side, rho, h) => pol(rho, wallTh(side, rho, h));
  const wallN = (side, rho, h) => {
    const p0 = wallPt(side, Math.max(tipR, rho - 2e-5), h);
    const p1 = wallPt(side, Math.min(R, rho + 2e-5), h);
    const l = Math.hypot(p1[0] - p0[0], p1[1] - p0[1]);
    const tx = (p1[0] - p0[0]) / l; // along the wall, outwards
    const ty = (p1[1] - p0[1]) / l;
    const th = wallTh(side, rho, h);
    const wx = lean * Math.sin(th); // d(position)/dh, the lean
    const wy = -lean * Math.cos(th);
    const n = [ty, -tx, tx * wy - ty * wx];
    const nl = Math.hypot(n[0], n[1], n[2]) * side;
    return [n[0] / nl, n[1] / nl, n[2] / nl]; // faces into the gap
  };

  // One ring of the outline, inset by d at height h: from the split's counter-clockwise wall, round the board,
  // up the neck, round the ear and back to the split's clockwise wall. Every piece stays tangent at any inset.
  const rimRing = (d, h) => {
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
    const Ri = R - d;
    const [n1, n2] = neck;
    arc([0, 0], Ri, wallTh(1, Ri, h), n1.cA, 104, 1);
    arc(n1.c, fil + d, n1.cA + Math.PI, n1.nA + Math.PI, 8, -1);
    line(n1.filPt, n1.earPt, n1.n, 3);
    arc(E, earR - d, n1.nA, n2.nA, 34, 1);
    line(n2.earPt, n2.filPt, n2.n, 3);
    arc(n2.c, fil + d, n2.nA + Math.PI, n2.cA + Math.PI, 8, -1);
    arc([0, 0], Ri, n2.cA, wallTh(-1, Ri, h) + TAU, 58, 1);
    return out;
  };

  // Radii sampled along the split's walls, rim to tip. Every ring's own radius is in the list so the walls
  // meet the rounded edge exactly.
  const radii = new Set(edge.map((p) => R - p.d));
  const flatR = R - K.inch(0.3);
  for (let k = 1; k <= 30; k++) radii.add(flatR + ((tipR - flatR) * k) / 30);
  const rhos = [...radii].sort((a, b) => b - a);

  const rim = [];
  const wallCW = [];
  const wallCCW = [];
  for (const p of edge) {
    const Ri = R - p.d;
    rim.push(rimRing(p.d, p.h).map((q) => V(q.x, q.y, p.h, q.nx * p.nr, q.ny * p.nr, p.nh)));
    const wall = (side) =>
      rhos.map((rho) => {
        const r = Math.min(rho, Ri);
        const [x, y] = wallPt(side, r, p.h);
        return V(x, y, p.h, ...wallN(side, r, p.h));
      });
    wallCW.push(wall(-1)); // rim -> tip
    wallCCW.push(wall(1).reverse()); // tip -> rim
  }
  const hole = holeEdge.map((p) =>
    Array.from({ length: 48 }, (_, j) => {
      const a = (j / 48) * TAU;
      const r = holeR + p.d;
      return V(E[0] + r * Math.cos(a), E[1] + r * Math.sin(a), p.h, -Math.cos(a) * p.nr, -Math.sin(a) * p.nr, p.nh);
    }),
  );

  const solid = soup();
  solid.loft(rim, false);
  solid.loft(hole, true);
  const last = edge.length - 1;
  solid.cap([...rim[0], ...wallCW[0], ...wallCCW[0]], [hole[0]], T, 1);
  solid.cap([...rim[last], ...wallCW[last], ...wallCCW[last]], [hole[holeEdge.length - 1]], 0, -1);
  const body = woodSolid(solid, { species: wood, angle: 0, size: 0.42, name: 'board' });

  // The split's raw inner faces, darker than the oiled surface.
  const gap = soup();
  gap.loft(wallCW, false);
  gap.loft(wallCCW, false);
  const split = woodSolid(gap, { species: wood, angle: 0, size: 0.42, darken: 0.2, name: 'split' });

  // ----- brass butterfly key, set flush across the split about an inch in from the rim -----
  const keyRho = R - K.inch(1.1);
  const kc = pol(keyRho, crackA + drift(keyRho) / keyRho);
  const keyA = rad(3); // the key lies along the grain, not quite square to the split
  const ux = Math.cos(keyA); // across the split
  const uy = Math.sin(keyA);
  const vx = -uy; // towards the middle of the board
  const vy = ux;
  // wings: wide side towards the middle of the board, narrow side towards the rim, pinched to a waist over the split
  const wings = roundCorners(
    [
      [-1.1, 0.46],
      [-0.6, -0.47],
      [0, -0.2],
      [0.6, -0.47],
      [1.1, 0.46],
      [0, 0.2],
    ].map(([u, v]) => [K.inch(u), K.inch(v)]),
    [0.085, 0.085, 0.03, 0.085, 0.085, 0.03].map(K.inch),
  );
  const keyShape = new THREE.Shape();
  wings.forEach(([u, v], i) => {
    const x = kc[0] + u * ux + v * vx;
    const y = kc[1] + u * uy + v * vy;
    if (i === 0) keyShape.moveTo(x, y);
    else keyShape.lineTo(x, y);
  });
  keyShape.closePath();
  const bev = 0.0003;
  const keyDepth = K.inch(0.22);
  const keyGeo = new THREE.ExtrudeGeometry(keyShape, { depth: keyDepth, bevelEnabled: true, bevelThickness: bev, bevelSize: bev, bevelOffset: -bev, bevelSegments: 1, curveSegments: 1 });
  keyGeo.rotateX(-Math.PI / 2);
  const butterfly = K.part(keyGeo, K.M.brassBrushed(), { pos: [0, T + 0.00035 - keyDepth - bev, 0], name: 'butterfly-key' });

  const g = K.group(body, split, butterfly);
  g.rotation.x = Math.PI / 2 - 0.16; // stand it up, leaning back a touch
  return K.seat(K.group(g));
}
