// Building blocks for the product models. Everything is in metres, Y is up, pieces sit on y = 0.
// A model file composes these into a THREE.Group; the stage handles lights, camera, rotation and wood swaps.
import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import * as M from './materials.js';

export { THREE, M };
export const IN = 0.0254; // one inch in metres
export const inch = (n) => n * IN;

const AX = { x: 0, y: 1, z: 2 };

/**
 * World-space wood UVs: grain (texture U) runs along `grain` ('x' | 'y' | 'z') on every face, at real scale,
 * so boards of any size show consistent grain. `size` is how many metres one texture tile spans along the grain.
 * Faces perpendicular to the grain (end grain) get a tighter, rotated mapping.
 */
export function woodUV(geometry, { grain = 'x', size = 0.5, offset = [0, 0] } = {}) {
  const geo = geometry.index ? geometry.toNonIndexed() : geometry;
  const pos = geo.attributes.position;
  const uv = new Float32Array(pos.count * 2);
  const g = AX[grain];
  const a = new THREE.Vector3();
  const b = new THREE.Vector3();
  const c = new THREE.Vector3();
  const n = new THREE.Vector3();
  const get = (v, k) => (k === 0 ? v.x : k === 1 ? v.y : v.z);
  for (let i = 0; i < pos.count; i += 3) {
    a.fromBufferAttribute(pos, i);
    b.fromBufferAttribute(pos, i + 1);
    c.fromBufferAttribute(pos, i + 2);
    n.subVectors(b, a).cross(c.clone().sub(a));
    const an = [Math.abs(n.x), Math.abs(n.y), Math.abs(n.z)];
    const d = an[0] >= an[1] && an[0] >= an[2] ? 0 : an[1] >= an[2] ? 1 : 2; // axis the face looks along
    let uAxis;
    let vAxis;
    let su = size;
    let sv = size * 0.5;
    if (d === g) {
      // end-grain face: use the other two axes, tighter
      [uAxis, vAxis] = [0, 1, 2].filter((k) => k !== d);
      su = size * 0.35;
      sv = size * 0.175;
    } else {
      uAxis = g;
      vAxis = [0, 1, 2].find((k) => k !== g && k !== d);
    }
    for (let j = 0; j < 3; j++) {
      const p = j === 0 ? a : j === 1 ? b : c;
      uv[(i + j) * 2] = get(p, uAxis) / su + offset[0];
      uv[(i + j) * 2 + 1] = get(p, vAxis) / sv + offset[1];
    }
  }
  geo.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
  return geo;
}

/** Wood UVs for turned parts (posts, dowels, round legs): grain runs along the cylinder axis with no seams. */
export function turnedUV(geometry, { axis = 'y', size = 0.5, offset = [0, 0] } = {}) {
  const geo = geometry.index ? geometry.toNonIndexed() : geometry;
  const pos = geo.attributes.position;
  const nor = geo.attributes.normal;
  const uv = new Float32Array(pos.count * 2);
  const k = AX[axis];
  const [p, q] = [0, 1, 2].filter((i) => i !== k);
  const v = new THREE.Vector3();
  const n = new THREE.Vector3();
  const get = (vec, i) => (i === 0 ? vec.x : i === 1 ? vec.y : vec.z);
  for (let i = 0; i < pos.count; i++) {
    v.fromBufferAttribute(pos, i);
    n.fromBufferAttribute(nor, i);
    if (Math.abs(get(n, k)) > 0.7) {
      // cap: end grain
      uv[i * 2] = get(v, p) / (size * 0.35) + offset[0];
      uv[i * 2 + 1] = get(v, q) / (size * 0.175) + offset[1];
    } else {
      const r = Math.hypot(get(v, p), get(v, q));
      const ang = Math.atan2(get(v, q), get(v, p));
      uv[i * 2] = get(v, k) / size + offset[0];
      uv[i * 2 + 1] = (ang * Math.max(r, 0.01)) / (size * 0.5) + offset[1];
    }
  }
  geo.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
  return geo;
}

let partSeed = 0;
const nextOffset = () => {
  partSeed += 1;
  return [(partSeed * 0.37) % 1, (partSeed * 0.61) % 1];
};

function finishMesh(mesh, { pos, rot, shadow = true, name } = {}) {
  if (pos) mesh.position.set(...pos);
  if (rot) mesh.rotation.set(...rot);
  mesh.castShadow = shadow;
  mesh.receiveShadow = true;
  if (name) mesh.name = name;
  return mesh;
}

/**
 * A wood part from any geometry.
 * role: 'primary' follows the wood swatches, 'accent' and 'fixed' keep their species.
 */
export function wood(geometry, { species = 'walnut', role = 'primary', grain = 'x', size = 0.5, turned = false, axis = 'y', endGrain = false, darken = 1, materials, ...place } = {}) {
  const offset = nextOffset();
  const geo = turned ? turnedUV(geometry, { axis, size, offset }) : woodUV(geometry, { grain, size, offset });
  // `materials` (optional): one spec per geometry group, e.g. the six faces of a THREE.BoxGeometry in the order
  // +x, -x, +y, -y, +z, -z. Each spec is { species, role, darken, endGrain } or a ready THREE.Material.
  const make = (spec = {}) => {
    if (spec.isMaterial) return spec;
    const mat = M.woodMaterial(spec.species || species, { endGrain: spec.endGrain ?? endGrain, darken: spec.darken ?? darken });
    mat.userData.woodRole = spec.role || role;
    return mat;
  };
  const material = Array.isArray(materials) ? materials.map(make) : make();
  const mesh = new THREE.Mesh(geo, material);
  mesh.userData.isWood = true;
  return finishMesh(mesh, place);
}

/** Rectangular board with softly eased edges. size = [x, y, z] in metres. */
export function board(size, { radius = 0.0025, segments = 3, ...opts } = {}) {
  const [x, y, z] = size;
  const r = Math.min(radius, Math.min(x, y, z) / 2 - 1e-4);
  return wood(new RoundedBoxGeometry(x, y, z, segments, Math.max(r, 1e-4)), opts);
}

/** Round disc or post standing on Y (use rot to lay it down). */
export function turned(radiusTop, radiusBottom, height, { segments = 56, ...opts } = {}) {
  return wood(new THREE.CylinderGeometry(radiusTop, radiusBottom, height, segments, 1), { turned: true, axis: 'y', ...opts });
}

/**
 * A flat part cut from a 2D outline (THREE.Shape drawn in X/Z as shape x/y), `thickness` tall, lying on the ground.
 * Add holes with shape.holes.push(path). The top edge is lightly eased.
 */
export function slab(shape, thickness, { ease = 0.002, curveSegments = 48, ...opts } = {}) {
  const e = Math.min(ease, thickness / 2 - 1e-4);
  const geo = new THREE.ExtrudeGeometry(shape, { depth: thickness - e * 2, bevelEnabled: e > 0, bevelThickness: e, bevelSize: e, bevelSegments: 2, curveSegments });
  geo.rotateX(-Math.PI / 2); // shape y -> world -z, extrusion -> world +y
  geo.translate(0, e, 0);
  return wood(geo, { grain: 'x', ...opts });
}

/** Any non-wood part. */
export function part(geometry, material, place = {}) {
  return finishMesh(new THREE.Mesh(geometry, material), place);
}

export const boxGeo = (x, y, z, r = 0.0015, seg = 2) => new RoundedBoxGeometry(x, y, z, seg, Math.max(1e-4, Math.min(r, Math.min(x, y, z) / 2 - 1e-4)));
export const cylGeo = (r, h, seg = 48) => new THREE.CylinderGeometry(r, r, h, seg);

/** Brass strip, dowel or plate. */
export const brassBox = (size, place) => part(boxGeo(...size, 0.0006), M.brass(), place);
export const brassRod = (radius, length, place) => part(cylGeo(radius, length, 32), M.brass(), place);

/** Rounded-rectangle outline, centred on the origin. */
export function roundedRect(w, h, r) {
  const s = new THREE.Shape();
  const x = -w / 2;
  const y = -h / 2;
  const rr = Math.min(r, w / 2, h / 2);
  s.moveTo(x + rr, y);
  s.lineTo(x + w - rr, y);
  s.absarc(x + w - rr, y + rr, rr, -Math.PI / 2, 0, false);
  s.lineTo(x + w, y + h - rr);
  s.absarc(x + w - rr, y + h - rr, rr, 0, Math.PI / 2, false);
  s.lineTo(x + rr, y + h);
  s.absarc(x + rr, y + h - rr, rr, Math.PI / 2, Math.PI, false);
  s.lineTo(x, y + rr);
  s.absarc(x + rr, y + rr, rr, Math.PI, Math.PI * 1.5, false);
  return s;
}

/** Circle outline (as a Shape or, with asPath, a hole Path). */
export function circle(r, cx = 0, cy = 0, asPath = false) {
  const s = asPath ? new THREE.Path() : new THREE.Shape();
  s.absarc(cx, cy, r, 0, Math.PI * 2, asPath);
  return s;
}

/** Stadium / slot outline: a rectangle with fully round ends, as a hole Path by default. */
export function slot(length, width, cx = 0, cy = 0, angle = 0, asPath = true) {
  const s = asPath ? new THREE.Path() : new THREE.Shape();
  const r = width / 2;
  const half = Math.max(0, length / 2 - r);
  const cos = Math.cos(angle);
  const sin = Math.sin(angle);
  const pt = (x, y) => [cx + x * cos - y * sin, cy + x * sin + y * cos];
  const N = 14;
  const pts = [];
  for (let i = 0; i <= N; i++) {
    const t = -Math.PI / 2 + (Math.PI * i) / N;
    pts.push(pt(half + Math.cos(t) * r, Math.sin(t) * r));
  }
  for (let i = 0; i <= N; i++) {
    const t = Math.PI / 2 + (Math.PI * i) / N;
    pts.push(pt(-half + Math.cos(t) * r, Math.sin(t) * r));
  }
  if (asPath) pts.reverse();
  s.moveTo(...pts[0]);
  pts.slice(1).forEach((p) => s.lineTo(...p));
  s.closePath();
  return s;
}

/** Group helper: add children and return the group. */
export function group(...children) {
  const g = new THREE.Group();
  children.flat().filter(Boolean).forEach((c) => g.add(c));
  return g;
}

/** Call at the end of build(): seats the piece on the ground and centres it on the turntable axis. */
export function seat(g) {
  g.updateMatrixWorld(true);
  const box = new THREE.Box3().setFromObject(g);
  const c = box.getCenter(new THREE.Vector3());
  g.position.x -= c.x;
  g.position.z -= c.z;
  g.position.y -= box.min.y;
  return g;
}

/** Walk a model and re-skin every wood part whose role is 'primary'. */
export function applyWood(g, species) {
  g.traverse((o) => {
    if (!o.isMesh || !o.userData.isWood) return;
    for (const mat of [].concat(o.material)) {
      if (mat.userData.woodRole === 'primary') M.setWoodMaterial(mat, species);
    }
  });
}

/** Free GPU resources for a model that is leaving the stage (shared materials and cached textures are kept). */
export function disposeModel(g) {
  g.traverse((o) => {
    if (!o.isMesh) return;
    o.geometry?.dispose();
    if (o.userData.isWood) [].concat(o.material).forEach((mat) => mat.userData.woodRole && mat.dispose());
  });
}
