// Yakisugi Crane Stool: one of one. Two full-depth panel legs and a seat made of two boards that slope
// gently down to a narrow gap at the centre (a shallow V), box-jointed to the legs at the top corners.
// Outer faces of the legs and the seat top are charred near-black; the inner faces and the underside are
// stained warm brown; the cut edges are left lighter. A hand-painted egret stands low on the inner face of
// one leg, and one wing wraps around the front edge onto the charred outer face.
// No wood swap: every part is role "fixed".
import * as K from '../kit.js';

const { THREE } = K;

export const meta = { handle: 'yakisugi-crane-wooden-stool', view: { yaw: 0.74, pitch: 0.3 }, fit: 0.94 };

// ---- dimensions, in inches (converted with K.IN when the geometry is finished) ----
const W = 16.5; // overall width (x)
const D = 12; // depth (z), front is +z
const H = 18; // height at the outer top corners
const T_LEG = 0.85; // leg panel thickness, measured off her front-on photos
const T_SEAT = 0.8; // seat board thickness
const SLOPE = Math.tan(THREE.MathUtils.degToRad(6.3)); // each seat board drops this much per inch toward the centre
const TV = T_SEAT / Math.cos(Math.atan(SLOPE)); // seat thickness measured vertically
const GAP_FRONT = 0.5; // the gap between the two seat boards is a little wider at the front
const GAP_BACK = 0.24;
const XI = W / 2 - T_LEG; // inner face of a leg
const RAIL_Z = -1.0; // the stretcher under the seat sits just behind the middle
const RAIL_T = 0.8;
const RAIL_BOTTOM = 14.9;

// Box joint at each top corner, as distances from the front edge. Seat fingers run through to the outer face;
// between them the leg comes up through the seat. Mirrored front to back.
const SEAT_FINGERS = (() => {
  const corner = 1.0;
  const leg = 0.27;
  const seat = 0.33;
  const a = [
    [0, corner],
    [corner + leg, corner + leg + seat],
    [corner + 2 * leg + seat, corner + 2 * leg + 2 * seat],
  ];
  const b = a.map(([d0, d1]) => [D - d1, D - d0]).reverse();
  return [...a, ...b];
})();

const zAt = (d) => D / 2 - d; // distance from the front edge -> z
const seatTop = (x) => H - (W / 2 - Math.abs(x)) * SLOPE; // top plane of the seat (and of the joint)

/** Split a flat-faced geometry into one wood mesh per finish, chosen by `classify(normal, centroid)`. */
function skin(geometry, classify, finishes) {
  const geo = geometry.index ? geometry.toNonIndexed() : geometry;
  const pos = geo.attributes.position;
  const buckets = {};
  const a = new THREE.Vector3();
  const b = new THREE.Vector3();
  const c = new THREE.Vector3();
  const n = new THREE.Vector3();
  const mid = new THREE.Vector3();
  for (let i = 0; i < pos.count; i += 3) {
    a.fromBufferAttribute(pos, i);
    b.fromBufferAttribute(pos, i + 1);
    c.fromBufferAttribute(pos, i + 2);
    n.subVectors(b, a).cross(mid.subVectors(c, a));
    if (n.lengthSq() < 1e-12) continue; // sliver
    n.normalize();
    mid.copy(a).add(b).add(c).multiplyScalar(1 / 3);
    const key = classify(n, mid);
    if (!key) continue; // faces buried inside a joint
    const list = (buckets[key] ||= []);
    list.push(a.x, a.y, a.z, b.x, b.y, b.z, c.x, c.y, c.z);
  }
  geo.dispose();
  return Object.entries(buckets).map(([key, list]) => {
    const part = new THREE.BufferGeometry();
    part.setAttribute('position', new THREE.Float32BufferAttribute(list, 3));
    part.scale(K.IN, K.IN, K.IN);
    part.computeVertexNormals();
    part.addGroup(0, list.length / 3, 0);
    const f = finishes[key];
    return K.wood(part, { materials: [f.mat], grain: f.grain, size: f.size, name: key });
  });
}

/** One seat board. side = +1 is the board over the crane leg (+x), -1 the other. */
function seatBoard(side, fin) {
  const pts = [[GAP_FRONT / 2, zAt(0)]];
  SEAT_FINGERS.forEach(([d0, d1], i) => {
    if (i > 0) pts.push([XI, zAt(d0)]);
    pts.push([W / 2, zAt(d0)], [W / 2, zAt(d1)]);
    if (i < SEAT_FINGERS.length - 1) pts.push([XI, zAt(d1)]);
  });
  pts.push([GAP_BACK / 2, zAt(D)]);
  const shape = new THREE.Shape(pts.map(([x, z]) => new THREE.Vector2(side * x, -z)));
  const geo = new THREE.ExtrudeGeometry(shape, { depth: TV, bevelEnabled: false });
  geo.rotateX(-Math.PI / 2); // shape y -> -z, extrusion -> +y
  const p = geo.attributes.position;
  for (let i = 0; i < p.count; i++) p.setY(i, p.getY(i) - TV + seatTop(p.getX(i))); // shear into the slope; ends stay plumb
  const eps = 0.01;
  return skin(
    geo,
    (n, c) => {
      if (n.y > 0.5) return 'top';
      if (n.y < -0.5) return 'under';
      if (Math.abs(n.z) > 0.5) return Math.abs(c.z) > D / 2 - eps ? 'edge' : null; // finger cheeks are buried
      if (n.x * side > 0.5) return Math.abs(c.x) > W / 2 - eps ? 'end' : null; // shoulders between fingers are buried
      return 'inner';
    },
    {
      top: { mat: fin.char, grain: 'x', size: 0.42 },
      under: { mat: fin.stain, grain: 'x', size: 0.5 },
      edge: { mat: fin.edge, grain: 'x', size: 0.5 },
      inner: { mat: fin.stain, grain: 'z', size: 0.4 },
      end: { mat: fin.endGrain, grain: 'z', size: 0.16 },
    },
  );
}

/** One leg panel with the comb of fingers along its top. */
function leg(side, fin) {
  const notch = H - TV; // where the seat fingers sit, before the shear
  const prof = [
    [zAt(0), 0],
    [zAt(D), 0],
  ];
  // walk the top from the back corner to the front corner
  [...SEAT_FINGERS].reverse().forEach(([d0, d1], i) => {
    if (i > 0) prof.push([zAt(d1), H]);
    prof.push([zAt(d1), notch], [zAt(d0), notch]);
    if (i < SEAT_FINGERS.length - 1) prof.push([zAt(d0), H]);
  });
  const shape = new THREE.Shape(prof.map(([z, y]) => new THREE.Vector2(-z, y)));
  const geo = new THREE.ExtrudeGeometry(shape, { depth: T_LEG, bevelEnabled: false });
  geo.rotateY(Math.PI / 2); // shape x -> -z, extrusion -> +x
  geo.translate(side > 0 ? XI : -W / 2, 0, 0);
  const p = geo.attributes.position;
  for (let i = 0; i < p.count; i++) {
    const y = p.getY(i);
    if (y > H - 3) p.setY(i, y - H + seatTop(p.getX(i))); // finger tops and notch floors follow the seat slope
  }
  const eps = 0.01;
  return skin(
    geo,
    (n, c) => {
      if (n.x * side > 0.5) return 'outer';
      if (n.x * side < -0.5) return 'inner';
      if (Math.abs(n.z) > 0.5) return Math.abs(c.z) > D / 2 - eps ? 'edge' : null;
      if (n.y > 0.5) return c.y > H - 0.3 ? 'top' : null; // notch floors are buried under the seat fingers
      return 'edge'; // underside
    },
    {
      outer: { mat: fin.char, grain: 'y', size: 0.46 },
      inner: { mat: fin.stain, grain: 'y', size: 0.52 },
      edge: { mat: fin.edge, grain: 'y', size: 0.5 },
      top: { mat: fin.endGrain, grain: 'z', size: 0.16 },
    },
  );
}

// ---- the painted egret ----
// Decals cut from her photos by scripts/dev/textures-yakisugi-crane-wooden-stool.py (keep the numbers in step).
// crane: inner face of the +x leg, left edge toward the back, right edge on the front corner, bottom on the floor.
const CRANE = { w: 9.5, h: 9.6 };
// wing: the front edge strip (inner corner -> outer corner) then the charred outer face, front corner -> back.
const WING = { strip: 0.85, face: 6.6, y0: 1.6, y1: 10.6 };
const LIFT = 0.0004; // metres off the wood

function decalPlane(name, w, h, [u0, u1], place) {
  const geo = new THREE.PlaneGeometry(K.inch(w), K.inch(h));
  const uv = geo.attributes.uv;
  for (let i = 0; i < uv.count; i++) uv.setX(i, u0 + uv.getX(i) * (u1 - u0));
  return K.part(geo, K.M.decal(name), { shadow: false, name: 'paint', ...place });
}

function egret() {
  const crane = decalPlane('yakisugi-crane-wooden-stool-crane', CRANE.w, CRANE.h, [0, 1], {
    pos: [K.inch(XI) - LIFT, K.inch(CRANE.h / 2), K.inch(D / 2 - CRANE.w / 2)],
    rot: [0, -Math.PI / 2, 0],
  });
  const span = WING.strip + WING.face;
  const wh = WING.y1 - WING.y0;
  const wy = K.inch((WING.y0 + WING.y1) / 2);
  const strip = decalPlane('yakisugi-crane-wooden-stool-wing', WING.strip, wh, [0, WING.strip / span], {
    pos: [K.inch(XI + WING.strip / 2), wy, K.inch(D / 2) + LIFT],
  });
  const wing = decalPlane('yakisugi-crane-wooden-stool-wing', WING.face, wh, [WING.strip / span, 1], {
    pos: [K.inch(W / 2) + LIFT, wy, K.inch(D / 2 - WING.face / 2)],
    rot: [0, Math.PI / 2, 0],
  });
  crane.renderOrder = strip.renderOrder = wing.renderOrder = 1;
  return [crane, strip, wing];
}

/** The stretcher under the seat: flat underneath, cut to the V on top. */
function rail(fin) {
  const under = (x) => seatTop(x) - TV;
  const flat = 0.1; // half-width of the flat at the bottom of the V (inside the gap)
  const shape = new THREE.Shape(
    [
      [-XI, RAIL_BOTTOM],
      [XI, RAIL_BOTTOM],
      [XI, under(XI)],
      [flat, under(flat)],
      [-flat, under(flat)],
      [-XI, under(XI)],
    ].map(([x, y]) => new THREE.Vector2(x, y)),
  );
  const geo = new THREE.ExtrudeGeometry(shape, { depth: RAIL_T, bevelEnabled: false });
  geo.translate(0, 0, RAIL_Z - RAIL_T / 2);
  return skin(
    geo,
    (n) => (Math.abs(n.x) > 0.9 ? null : 'face'), // the ends butt into the legs
    { face: { mat: fin.stain, grain: 'x', size: 0.5 } },
  );
}

export function build() {
  // Four finishes shared by every board. None of them follows the swatches.
  const finish = (species, darken) => {
    const mat = K.M.woodMaterial(species, { darken });
    mat.userData.woodRole = 'fixed';
    return mat;
  };
  const fin = {
    char: finish('ebonized', 1),
    stain: finish('walnut', 0.8), // warm dark brown stain on the inner faces and under the seat
    edge: finish('oak', 0.66), // cut edges are left lighter (oiled, honey-tan)
    endGrain: finish('oak', 0.62), // the box-joint fingers: end grain, oiled, lighter than the char
  };

  const g = K.group(leg(1, fin), leg(-1, fin), seatBoard(1, fin), seatBoard(-1, fin), rail(fin), egret());
  return K.seat(g);
}
