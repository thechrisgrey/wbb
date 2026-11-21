// The Entry Valet: a 24" round mirror in a bent walnut rim, with a walnut shelf unit across the lower third.
// The left end of the shelf is an open catchall box with a figured front; the right is a thin shelf over a
// recessed apron that carries six solid brass peg hooks. Shown upright, exactly as it hangs on the wall.
import * as K from '../kit.js';

const { THREE } = K;
const inch = K.inch;

export const meta = { handle: 'the-entry-valet', view: { yaw: 0.36, pitch: 0.15 }, fit: 0.74 };

// ---------- local helpers ----------

/** Lathe a profile of [radius, z] pairs about the Z axis. `crisp` keeps every profile corner as a hard edge. */
function latheZ(profile, segments = 48, crisp = false) {
  const pts = [];
  profile.forEach(([r, z], i) => {
    pts.push(new THREE.Vector2(r, z));
    if (crisp && i > 0 && i < profile.length - 1) pts.push(new THREE.Vector2(r, z)); // doubled point = split normal
  });
  const geo = new THREE.LatheGeometry(pts, segments);
  geo.rotateX(Math.PI / 2); // lathe axis Y -> Z
  return geo;
}

/**
 * Grain that wraps a ring (bent lamination): texture U follows the circumference, V unrolls around the
 * rim's cross-section so the figure flows over the front face and down the outer wall without a break.
 * The ring lies in the XY plane, back at z = 0, front at z = depth.
 */
function ringUV(geo, { rOuter, width, depth, size, offsetV = 0 }) {
  const pos = geo.attributes.position;
  const uv = new Float32Array(pos.count * 2);
  const rMid = rOuter - width / 2;
  const a = new THREE.Vector3();
  const b = new THREE.Vector3();
  const c = new THREE.Vector3();
  const n = new THREE.Vector3();
  const m = new THREE.Vector3();
  for (let i = 0; i < pos.count; i += 3) {
    a.fromBufferAttribute(pos, i);
    b.fromBufferAttribute(pos, i + 1);
    c.fromBufferAttribute(pos, i + 2);
    n.subVectors(b, a).cross(m.subVectors(c, a)).normalize();
    m.addVectors(a, b).add(c).multiplyScalar(1 / 3);
    const radial = (n.x * m.x + n.y * m.y) / Math.max(1e-6, Math.hypot(m.x, m.y));
    const face = Math.abs(n.z) > Math.abs(radial) ? (n.z > 0 ? 'front' : 'back') : radial > 0 ? 'outer' : 'inner';
    const th0 = Math.atan2(a.y, a.x);
    [a, b, c].forEach((p, j) => {
      let th = Math.atan2(p.y, p.x);
      if (th - th0 > Math.PI) th -= Math.PI * 2;
      if (th - th0 < -Math.PI) th += Math.PI * 2;
      const r = Math.hypot(p.x, p.y);
      let t;
      if (face === 'front') t = rOuter - r;
      else if (face === 'outer') t = p.z - depth;
      else if (face === 'inner') t = width + (depth - p.z);
      else t = -depth - (rOuter - r);
      uv[(i + j) * 2] = (th * rMid) / size;
      uv[(i + j) * 2 + 1] = t / (size * 0.5) + offsetV;
    });
  }
  geo.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
}

/**
 * Grain that wraps the catchall box like a mitred waterfall: U runs along the front and carries on around
 * both front corners onto the sides. Geometry is the box-wall slab in its own frame: x 0..w, y 0..h, z 0..d (front).
 */
function boxWrapUV(geo, { w, d, su, sv, offset = [0, 0] }) {
  const pos = geo.attributes.position;
  const uv = new Float32Array(pos.count * 2);
  const a = new THREE.Vector3();
  const b = new THREE.Vector3();
  const c = new THREE.Vector3();
  const n = new THREE.Vector3();
  const m = new THREE.Vector3();
  for (let i = 0; i < pos.count; i += 3) {
    a.fromBufferAttribute(pos, i);
    b.fromBufferAttribute(pos, i + 1);
    c.fromBufferAttribute(pos, i + 2);
    n.subVectors(b, a).cross(m.subVectors(c, a));
    const an = [Math.abs(n.x), Math.abs(n.y), Math.abs(n.z)];
    const dom = an[0] >= an[1] && an[0] >= an[2] ? 0 : an[1] >= an[2] ? 1 : 2;
    [a, b, c].forEach((p, j) => {
      let u;
      let v;
      if (dom === 1) {
        u = p.x;
        v = p.z;
      } else if (dom === 2) {
        u = p.x;
        v = p.y;
      } else if (n.x < 0) {
        u = p.z - d; // left side: continue leftwards from the front-left corner
        v = p.y;
      } else {
        u = w + (d - p.z); // right side: continue rightwards from the front-right corner
        v = p.y;
      }
      uv[(i + j) * 2] = u / su + offset[0];
      uv[(i + j) * 2 + 1] = v / sv + offset[1];
    });
  }
  geo.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
}

/**
 * A board extruded along X from a closed section drawn in (z, y), counter-clockwise with z to the right.
 * Section points are [z, y] or [z, y, nz, ny]; points that carry a normal shade as a smooth round-over.
 * `skew(z, y)` shifts the x1 end, for an end cut on an angle. Several runs can be merged into one board.
 */
function extrudeX(runs) {
  const P = [];
  const N = [];
  const tri = (a, b, c, na, nb, nc) => {
    P.push(...a, ...b, ...c);
    N.push(...na, ...nb, ...nc);
  };
  const v = new THREE.Vector3();
  const w = new THREE.Vector3();
  for (const { section, x0, x1, skew = () => 0, caps = [true, true] } of runs) {
    const n = section.length;
    for (let i = 0; i < n; i++) {
      const a = section[i];
      const b = section[(i + 1) % n];
      const len = Math.hypot(b[0] - a[0], b[1] - a[1]);
      if (len < 1e-9) continue;
      const fz = (b[1] - a[1]) / len;
      const fy = -(b[0] - a[0]) / len;
      const na = a.length > 2 ? [0, a[3], a[2]] : [0, fy, fz];
      const nb = b.length > 2 ? [0, b[3], b[2]] : [0, fy, fz];
      const A0 = [x0, a[1], a[0]];
      const A1 = [x1 + skew(a[0], a[1]), a[1], a[0]];
      const B0 = [x0, b[1], b[0]];
      const B1 = [x1 + skew(b[0], b[1]), b[1], b[0]];
      tri(A0, A1, B1, na, na, nb);
      tri(A0, B1, B0, na, nb, nb);
    }
    const faces = THREE.ShapeUtils.triangulateShape(section.map((p) => new THREE.Vector2(p[0], p[1])), []);
    for (const [i, j, k] of faces) {
      const [p, q, r] = [section[i], section[j], section[k]];
      const facesPlusX = (q[1] - p[1]) * (r[0] - p[0]) - (q[0] - p[0]) * (r[1] - p[1]) > 0;
      const [e, f, g] = facesPlusX ? [p, q, r] : [p, r, q];
      if (caps[1]) {
        const E = [x1 + skew(e[0], e[1]), e[1], e[0]];
        const F = [x1 + skew(f[0], f[1]), f[1], f[0]];
        const G = [x1 + skew(g[0], g[1]), g[1], g[0]];
        v.set(F[0] - E[0], F[1] - E[1], F[2] - E[2]).cross(w.set(G[0] - E[0], G[1] - E[1], G[2] - E[2])).normalize();
        const nn = [v.x, v.y, v.z];
        tri(E, F, G, nn, nn, nn);
      }
      if (caps[0]) tri([x0, e[1], e[0]], [x0, g[1], g[0]], [x0, f[1], f[0]], [-1, 0, 0], [-1, 0, 0], [-1, 0, 0]);
    }
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(P, 3));
  geo.setAttribute('normal', new THREE.Float32BufferAttribute(N, 3));
  return geo;
}

/** Points of a round-over for a section: centre, radius, from angle a0 to a1, each carrying its own normal. */
function roundOver(cz, cy, r, a0, a1, steps = 5) {
  const pts = [];
  for (let i = 0; i <= steps; i++) {
    const t = a0 + ((a1 - a0) * i) / steps;
    pts.push([cz + Math.cos(t) * r, cy + Math.sin(t) * r, Math.cos(t), Math.sin(t)]);
  }
  return pts;
}

export function build({ wood = 'walnut' } = {}) {
  // ---------- mirror ----------
  const R = inch(12); // outer radius of the rim
  const RIM_W = inch(0.6);
  const RIM_D = inch(0.9);
  const Ri = R - RIM_W;
  const glassZ = RIM_D - inch(0.14); // glass sits a little behind the rim's front

  // Rim: a rounded-rectangle section swept around, wall plane at z = 0.
  const e = 0.0016;
  const prof = [];
  const arc = (cx, cz, a0, a1) => {
    for (let i = 0; i <= 4; i++) {
      const t = a0 + ((a1 - a0) * i) / 4;
      prof.push([cx + Math.cos(t) * e, cz + Math.sin(t) * e]);
    }
  };
  prof.push([(R + Ri) / 2, 0]);
  arc(R - e, e, -Math.PI / 2, 0);
  arc(R - e, RIM_D - e, 0, Math.PI / 2);
  arc(Ri + e, RIM_D - e, Math.PI / 2, Math.PI);
  arc(Ri + e, e, Math.PI, Math.PI * 1.5);
  prof.push([(R + Ri) / 2, 0]);
  const rimSize = (Math.PI * 2 * (R - RIM_W / 2)) / 4; // four texture tiles around: seamless where it closes
  const rim = K.wood(latheZ(prof, 160), { species: wood, name: 'rim' });
  ringUV(rim.geometry, { rOuter: R, width: RIM_W, depth: RIM_D, size: rimSize, offsetV: 0.31 });

  const RG = Ri - inch(0.045);
  const bevel = inch(0.09);
  const glass = K.part(new THREE.CircleGeometry(RG - bevel, 128), K.M.mirror(), { pos: [0, 0, glassZ], shadow: false, name: 'glass' });
  // A hairline polished bevel at the edge of the glass catches a different slice of the room.
  const glassEdge = K.part(latheZ([[RG, glassZ - bevel * 0.4], [RG - bevel, glassZ]], 128), K.M.mirror(), { shadow: false, name: 'glass-bevel' });
  // Dark line of shadow where the glass meets the rim.
  const reveal = K.part(new THREE.CircleGeometry(Ri + 0.001, 128), K.M.recess(), { pos: [0, 0, glassZ - 0.0006], shadow: false });

  // Back: a recessed dark panel and a French cleat, so it is a finished object from behind.
  const backPanel = K.slab(K.circle(Ri + 0.001), inch(0.22), {
    species: 'walnut',
    role: 'fixed',
    darken: 0.5,
    grain: 'z',
    size: 0.5,
    ease: 0.0005,
    curveSegments: 96,
    rot: [Math.PI / 2, 0, 0],
    pos: [0, 0, inch(0.4)],
    name: 'back-panel',
  });
  const cleat = K.board([inch(13), inch(1.6), inch(0.34)], { species: wood, grain: 'x', size: 0.45, radius: 0.0015, pos: [0, inch(5.4), inch(0.4 - 0.17)], name: 'cleat' });

  // ---------- shelf unit ----------
  const Z0 = RIM_D; // the unit sits on the rim's front face
  const TB = inch(0.75); // back board thickness
  const ZB = Z0 + TB;
  const ZF = Z0 + inch(4.5); // front of the catchall
  const yS = -inch(2.1); // top surface of shelf and catchall
  const RAIL = inch(0.5); // the back board stands this proud of the shelf
  const TS = inch(0.85); // shelf thickness
  const APRON = inch(1.85); // apron showing under the shelf
  const HB = inch(3.5); // catchall height
  const XL = -inch(12.75);
  const XR = inch(12.75);
  const XS = inch(13.75); // the shelf runs on past the back board
  const WB = inch(10.2); // catchall width
  const XB = XL + WB;
  const yApron = yS - TS - APRON;
  const yBox = yS - HB;

  // Back board: one piece, a rounded rail along the top, the apron under the shelf, stepped down behind the catchall.
  const xStep = XB - inch(0.25);
  const yRail = yS + RAIL;
  const backSection = (yBottom) => [
    [0.0012, yBottom],
    [TB - 0.0012, yBottom],
    [TB, yBottom + 0.0012],
    ...roundOver(TB - inch(0.24), yRail - inch(0.24), inch(0.24), 0, Math.PI / 2, 6),
    ...roundOver(inch(0.06), yRail - inch(0.06), inch(0.06), Math.PI / 2, Math.PI, 3),
    [0, yBottom + 0.0012],
  ];
  const backBoard = K.wood(
    extrudeX([
      { section: backSection(yBox), x0: XL, x1: xStep, caps: [true, true] },
      { section: backSection(yApron), x0: xStep, x1: XR, caps: [false, true] },
    ]),
    { species: wood, grain: 'x', size: 0.52, pos: [0, 0, Z0], name: 'back-board' },
  );

  // Catchall walls: one U of walnut, grain wrapping the mitred front corners.
  const DP = ZF - ZB;
  const wall = inch(0.5);
  const front = inch(0.62);
  const ce = 0.0022;
  const rc = inch(0.1);
  const u = new THREE.Shape();
  u.moveTo(ce, 0);
  u.lineTo(ce, -(DP - ce - rc));
  u.absarc(ce + rc, -(DP - ce - rc), rc, Math.PI, Math.PI * 1.5, false);
  u.lineTo(WB - ce - rc, -(DP - ce));
  u.absarc(WB - ce - rc, -(DP - ce - rc), rc, Math.PI * 1.5, Math.PI * 2, false);
  u.lineTo(WB - ce, 0);
  u.lineTo(WB - wall + ce, 0);
  u.lineTo(WB - wall + ce, -(DP - front + ce));
  u.lineTo(wall - ce, -(DP - front + ce));
  u.lineTo(wall - ce, 0);
  u.closePath();
  const box = K.slab(u, HB, { species: wood, ease: ce, curveSegments: 10, pos: [XL, yBox, ZB], name: 'catchall' });
  boxWrapUV(box.geometry, { w: WB, d: DP, su: 0.46, sv: 0.23, offset: [0.13, 0.42] });
  const floorT = inch(0.45);
  const floor = K.board([WB - wall * 2 + 0.002, floorT, DP - front + 0.001], {
    species: wood,
    grain: 'x',
    size: 0.5,
    radius: 0.0008,
    pos: [XL + WB / 2, yBox + inch(0.03) + floorT / 2, ZB + (DP - front + 0.001) / 2],
    name: 'catchall-floor',
  });

  // Shelf: front edge rounded over on top and cut back underneath, the free end cut on the same slight angle.
  const ZFS = ZF - inch(0.1);
  const y0 = yS - TS;
  const rr = inch(0.11);
  const lean = 0.19; // radians the front face leans back under the top edge
  const sz = ZFS - rr + Math.cos(lean) * rr;
  const sy = yS - rr - Math.sin(lean) * rr;
  const drop = (sy - (y0 + 0.0015)) / Math.cos(lean);
  const shelfSection = [
    [ZB, y0],
    [sz - drop * Math.sin(lean) - 0.0015, y0],
    [sz - drop * Math.sin(lean), y0 + 0.0015],
    ...roundOver(ZFS - rr, yS - rr, rr, -lean, Math.PI / 2, 6),
    [ZB, yS],
  ];
  const shelf = K.wood(extrudeX([{ section: shelfSection, x0: XB, x1: XS, skew: (z, y) => -0.2 * (yS - y) }]), { species: wood, grain: 'x', size: 0.5, name: 'shelf' });

  // Six brass peg hooks on the apron.
  const hookProfile = [
    [0, -0.1],
    [0.28, -0.1],
    [0.28, 0.86],
    [0.3, 0.88],
    [0.3, 0.93],
    [0.22, 0.95],
    [0.22, 1.0],
    [0.35, 1.01],
    [0.385, 1.045],
    [0.385, 1.27],
    [0.36, 1.3],
    [0, 1.3],
  ].map(([r, z]) => [inch(r), inch(z)]);
  const hookGeo = latheZ(hookProfile, 36, true);
  const hooks = [];
  for (let i = 0; i < 6; i++) {
    hooks.push(K.part(hookGeo, K.M.brass(), { pos: [XB + inch(1.95 + i * 2.4), yS - TS - APRON / 2, ZB], name: 'hook' }));
  }

  // Brass pins in the ends of the back board.
  const pinL = K.brassRod(inch(0.07), 0.004, { rot: [0, 0, Math.PI / 2], pos: [XL + 0.0016, yBox + inch(1.1), Z0 + TB / 2], shadow: false });
  const pinR = K.brassRod(inch(0.07), 0.004, { rot: [0, 0, Math.PI / 2], pos: [XR - 0.0016, yApron + inch(1.0), Z0 + TB / 2], shadow: false });

  return K.seat(K.group(rim, glass, glassEdge, reveal, backPanel, cleat, backBoard, box, floor, shelf, hooks, pinL, pinR));
}
