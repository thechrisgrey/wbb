// Solid Wood Walnut Bench, 36 in version: a 36 x 14 in seat about 1.3 in thick, its front and back edges chamfered
// underneath so the top reads thin at the edge, on two splayed leg assemblies set in from the ends. Each assembly is
// two square legs leaning out front and back (an A / trapezoid seen from the end), a low cross rail between them and a
// cleat under the seat that passes through a slot in the top of each leg, so its end shows as the visible joint.
// A long stretcher runs lengthwise between the two cross rails. Slim brass inlays bridge natural cracks and knots
// in the top: a pair near the left end, one at the front edge over the right legs, and a short one near the back.
import * as K from '../kit.js';

const { THREE } = K;
const I = K.inch;

export const meta = { handle: 'walnut-bench', view: { yaw: -0.55, pitch: 0.4 }, fit: 0.96 };

// ---- dimensions (inches) ----
const L = 36; // seat length (x)
const D = 14; // seat depth (z), front is +z
const T = 1.3; // seat thickness
const H = 18; // overall height
const EDGE = 0.55; // seat edge thickness after the underside chamfer
const CH = 1.35; // how far the chamfer runs in under the seat
const HL = H - T; // leg height (to the seat underside)
const LEG = 1.75; // leg section
const SPLAY = Math.tan(THREE.MathUtils.degToRad(9)); // outward lean of each leg, front and back
const LEG_X = L / 2 - 4.6; // leg assembly centre, from the middle
const TOP_OUT = D / 2 - CH; // outer face of a leg at the top: right where the chamfer starts
const outerAt = (y) => TOP_OUT + SPLAY * (HL - y); // outer face of the front leg at height y
const RAIL = { y0: 4.6, y1: 7.0 }; // cross rail (front to back), low
const STR = { y0: 6.2, y1: 7.6, w: 4.0, past: 1.1 }; // long stretcher, lapped over the cross rails, ends run past them
const CLEAT = { h: 1.5, w: 0.8 }; // cleat under the seat, through the leg tops
const SINK = 0.02; // parts tucked this far into the seat so no faces sit coplanar
const TONE = 0.58; // her walnut is oiled dark and rich, deeper than the stock swatch

/** Seat: the underside-chamfered profile extruded along x, with lightly eased edges. */
function seat(wood) {
  const s = new THREE.Shape(
    [
      [-(D / 2 - CH), 0],
      [D / 2 - CH, 0],
      [D / 2, T - EDGE],
      [D / 2, T],
      [-D / 2, T],
      [-D / 2, T - EDGE],
    ].map(([z, y]) => new THREE.Vector2(I(z), I(y))),
  );
  const e = 0.0016;
  const geo = new THREE.ExtrudeGeometry(s, { depth: I(L) - 2 * e, bevelEnabled: true, bevelThickness: e, bevelSize: e, bevelOffset: -e, bevelSegments: 2, curveSegments: 1 });
  geo.translate(0, 0, e - I(L) / 2);
  geo.rotateY(Math.PI / 2); // extrusion -> x, profile x -> -z (symmetric)
  geo.translate(0, I(HL), 0);
  return K.wood(geo, { species: wood, grain: 'x', size: 0.55, darken: TONE, name: 'seat' });
}

/** A square leg leaning out toward side sz (+1 front, -1 back): top and foot cut level. */
function leg(wood, sx, sz) {
  const geo = K.boxGeo(I(LEG), I(HL + SINK), I(LEG), 0.0018, 2);
  geo.translate(0, I(HL + SINK) / 2, 0);
  const p = geo.attributes.position;
  for (let i = 0; i < p.count; i++) {
    const y = p.getY(i) / K.IN;
    p.setZ(i, p.getZ(i) + sz * I(outerAt(Math.min(y, HL)) - LEG / 2));
  }
  geo.computeVertexNormals();
  return K.wood(geo, { species: wood, grain: 'y', size: 0.5, darken: TONE, pos: [sx * I(LEG_X), 0, 0], name: 'leg' });
}

/** Low cross rail between the front and back legs; its ends are buried in the legs. */
function crossRail(wood, sx) {
  const yc = (RAIL.y0 + RAIL.y1) / 2;
  const len = 2 * (outerAt(yc) - LEG / 2);
  return K.board([I(LEG - 0.25), I(RAIL.y1 - RAIL.y0), I(len)], { species: wood, grain: 'z', size: 0.45, darken: TONE, radius: 0.0015, pos: [sx * I(LEG_X), I(yc), 0] });
}

/** Stretcher running lengthwise, half-lapped over both cross rails, ends showing past them. */
function stretcher(wood) {
  const len = 2 * (LEG_X + (LEG - 0.25) / 2 + STR.past);
  return K.board([I(len), I(STR.y1 - STR.y0), I(STR.w)], { species: wood, grain: 'x', size: 0.55, darken: TONE, radius: 0.002, pos: [0, I((STR.y0 + STR.y1) / 2), 0] });
}

/** Cleat under the seat, front to back, through a slot in each leg top; its ends sit just proud of the leg faces. */
function cleat(wood, sx, faceMat) {
  const y0 = HL - CLEAT.h;
  const geo = new THREE.BoxGeometry(I(CLEAT.w), I(CLEAT.h + SINK), 1, 1, 1, 1);
  geo.translate(0, I(y0 + (CLEAT.h + SINK) / 2), 0);
  const p = geo.attributes.position;
  for (let i = 0; i < p.count; i++) {
    const y = Math.min(p.getY(i) / K.IN, HL);
    p.setZ(i, Math.sign(p.getZ(i)) * (I(outerAt(y)) + 0.0004));
  }
  geo.computeVertexNormals();
  // faces +x, -x, +y, -y, +z, -z: the two ends (z) show end grain, a touch lighter, like a joint
  const body = { species: wood, darken: TONE };
  const end = faceMat;
  return K.wood(geo, { species: wood, grain: 'z', size: 0.4, materials: [body, body, body, body, end, end], pos: [sx * I(LEG_X), 0, 0], name: 'cleat' });
}

// ---- brass inlays across cracks and knots (top of seat; x along the bench, z toward the front) ----
// Each: centre [x, z], length, angle (radians from +x, measured toward -z as seen from above, i.e. rotation about y).
const INLAYS = [
  { c: [-12.9, 0.6], len: 4.3, a: 0.32 }, // the long line of the pair, left end
  { c: [-13.1, -1.25], len: 1.5, a: -0.75 }, // its short partner, stopping just short of it
  { c: [12.7, 5.55], len: 3.0, a: 1.32 }, // front edge, right end, over the legs, running out to the edge
  { c: [0.6, -5.1], len: 1.6, a: 1.15 }, // short one near the back, middle
];
// Dark checks / knots the brass bridges: tapered slivers [x, z, length, width, angle] and knots [x, z, rx, rz, angle].
const CRACKS = [
  [-13.1, 0.3, 2.6, 0.09, -1.15],
  [-11.6, 1.2, 1.6, 0.05, 0.25],
  [12.6, 5.4, 2.2, 0.08, -0.25],
  [0.5, -5.1, 1.5, 0.06, -0.35],
];
const KNOTS = [
  [-13.4, -0.4, 0.62, 0.5, 0.4],
  [12.4, 6.2, 0.4, 0.3, 0.2],
  [0.45, -5.35, 0.3, 0.24, 0.0],
];

function sliverShape(len, w) {
  const s = new THREE.Shape();
  const n = 10;
  const pts = [];
  for (let i = 0; i <= n; i++) {
    const t = i / n;
    const x = (t - 0.5) * len;
    const hw = (w / 2) * Math.sin(Math.PI * t) ** 0.7 * (0.75 + 0.25 * Math.sin(t * 13));
    pts.push([x, hw + 0.02 * Math.sin(t * 7) * len * 0.05]);
  }
  for (let i = n; i >= 0; i--) {
    const t = i / n;
    const x = (t - 0.5) * len;
    const hw = (w / 2) * Math.sin(Math.PI * t) ** 0.7 * (0.75 + 0.25 * Math.cos(t * 11));
    pts.push([x, -hw + 0.02 * Math.sin(t * 7) * len * 0.05]);
  }
  s.moveTo(I(pts[0][0]), I(pts[0][1]));
  pts.slice(1).forEach(([x, y]) => s.lineTo(I(x), I(y)));
  return s;
}

function knotShape(rx, rz) {
  const s = new THREE.Shape();
  const n = 28;
  for (let i = 0; i <= n; i++) {
    const a = (i / n) * Math.PI * 2;
    const wob = 1 + 0.12 * Math.sin(a * 3 + 0.7) + 0.06 * Math.sin(a * 5);
    const x = I(rx * wob * Math.cos(a));
    const y = I(rz * wob * Math.sin(a));
    if (i === 0) s.moveTo(x, y);
    else s.lineTo(x, y);
  }
  return s;
}

/** A flat mark lying on the seat top, `lift` metres above it. */
function mark(shape, mat, x, z, angle, lift) {
  const geo = new THREE.ShapeGeometry(shape, 1);
  geo.rotateX(-Math.PI / 2); // shape y -> -z, faces up
  geo.rotateY(angle);
  return K.part(geo, mat, { pos: [I(x), I(H) + lift, I(z)], shadow: false });
}

export function build({ wood = 'walnut' } = {}) {
  const g = new THREE.Group();
  g.add(seat(wood));

  const endMat = K.M.woodMaterial(wood, { endGrain: true, darken: TONE * 1.1 });
  endMat.userData.woodRole = 'primary';
  for (const sx of [-1, 1]) {
    g.add(leg(wood, sx, 1), leg(wood, sx, -1), crossRail(wood, sx), cleat(wood, sx, endMat));
  }
  g.add(stretcher(wood));

  // cracks and knots: the same wood, very dark, so they follow the swatch but read as shadow
  const crackMat = K.M.woodMaterial(wood, { darken: TONE * 0.3 });
  crackMat.userData.woodRole = 'primary';
  const knotMat = K.M.woodMaterial(wood, { darken: TONE * 0.6 });
  knotMat.userData.woodRole = 'primary';
  const marks = new THREE.Group();
  KNOTS.forEach(([x, z, rx, rz, a]) => marks.add(mark(knotShape(rx, rz), knotMat, x, z, a, 0.0003)));
  CRACKS.forEach(([x, z, len, w, a]) => marks.add(mark(sliverShape(len, w), crackMat, x, z, a, 0.00045)));
  marks.children.forEach((m) => {
    m.userData.isWood = true;
    const uv = m.geometry.attributes.position;
    m.geometry.setAttribute('uv', new THREE.BufferAttribute(new Float32Array(uv.count * 2), 2));
  });
  g.add(marks);

  // brass: 0.12 in wide strips, top 0.6 mm proud of the seat
  const bw = I(0.12);
  const bt = I(0.08);
  INLAYS.forEach(({ c: [x, z], len, a }, i) => {
    g.add(K.brassBox([I(len), bt, bw], { pos: [I(x), I(H) + 0.0006 + i * 0.00005 - bt / 2, I(z)], rot: [0, a, 0], name: 'brass' }));
  });

  return K.seat(g);
}
