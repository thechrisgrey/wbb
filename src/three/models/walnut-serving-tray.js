// The Elizabeth Serving Tray: 18 x 12 in, a mitred frame around a flat bottom board. Each short end is notched
// into a hand-hold, and a slim brass bar let into its top edge runs mitre to mitre and bridges the notch as the handle.
import * as K from '../kit.js';

const { THREE } = K;

export const meta = { handle: 'walnut-serving-tray', view: { yaw: -1.02, pitch: 0.6 } };

// Closed outline from corner points [x, y, radius]: straight runs with softly broken corners.
function outline(points) {
  const s = new THREE.Shape();
  const n = points.length;
  points.forEach(([x, y, r = 0], i) => {
    const start = (px, py) => (i === 0 ? s.moveTo(px, py) : s.lineTo(px, py));
    if (!r) return start(x, y);
    const toward = ([qx, qy]) => {
      const d = Math.hypot(qx - x, qy - y);
      return [x + ((qx - x) / d) * r, y + ((qy - y) / d) * r];
    };
    const a = toward(points[(i + n - 1) % n]);
    const b = toward(points[(i + 1) % n]);
    start(...a);
    s.quadraticCurveTo(x, y, ...b);
    return null;
  });
  s.closePath();
  return s;
}

/**
 * A board seen face-on: `profile` is its face outline (x along the board and centred, y up from 0), `thickness` deep.
 * z = 0 is the outer face, z = thickness the inner one, and both ends are cut to 45 degree mitres (long point outside).
 */
function mitredBoard(profile, length, thickness, { ease = 0.0006, curveSegments = 5 } = {}) {
  const geo = new THREE.ExtrudeGeometry(profile, {
    depth: thickness - ease * 2,
    bevelEnabled: true,
    bevelThickness: ease,
    bevelSize: ease,
    bevelOffset: -ease,
    bevelSegments: 1,
    curveSegments,
  });
  geo.translate(0, 0, ease);
  const pos = geo.attributes.position;
  const endZone = length / 2 - 0.004;
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i);
    if (Math.abs(x) > endZone) pos.setX(i, x - Math.sign(x) * pos.getZ(i));
  }
  geo.computeVertexNormals();
  return geo;
}

/** Sort a geometry's triangles into two material groups: 0 for the rest, 1 where pick(normal, centroid) is true. */
function markFaces(geo, pick) {
  const src = geo.attributes.position.array;
  const rest = [];
  const marked = [];
  const p = [new THREE.Vector3(), new THREE.Vector3(), new THREE.Vector3()];
  const nrm = new THREE.Vector3();
  const c = new THREE.Vector3();
  for (let i = 0; i < src.length; i += 9) {
    p.forEach((v, k) => v.fromArray(src, i + k * 3));
    nrm.subVectors(p[1], p[0]).cross(c.subVectors(p[2], p[0])).normalize();
    c.copy(p[0]).add(p[1]).add(p[2]).divideScalar(3);
    const bucket = pick(nrm, c) ? marked : rest;
    for (let k = 0; k < 9; k++) bucket.push(src[i + k]);
  }
  const out = new THREE.BufferGeometry();
  out.setAttribute('position', new THREE.Float32BufferAttribute(rest.concat(marked), 3));
  out.addGroup(0, rest.length / 3, 0);
  out.addGroup(rest.length / 3, marked.length / 3, 1);
  out.computeVertexNormals();
  geo.dispose();
  return out;
}

export function build({ wood = 'walnut' } = {}) {
  const L = K.inch(18); // long sides, along X
  const W = K.inch(12); // handle ends, along Z
  const H = K.inch(2.1);
  const T = K.inch(0.68); // frame thickness
  const TB = K.inch(0.375); // bottom board
  const NOTCH_W = K.inch(6.4); // hand-hold, centred on each end
  const LIP = K.inch(0.72); // what is left of the end below the hand-hold
  const BAR_W = K.inch(0.125); // brass bar, on edge
  const BAR_H = K.inch(0.26);
  const GRAIN = 0.5;
  const MITRE = 0.0005; // hairline break along each mitre

  // Shared wood materials: face grain, and a darker one for the end grain the notch cuts expose.
  const face = K.M.woodMaterial(wood);
  const cut = K.M.woodMaterial(wood, { darken: 0.78 });
  face.userData.woodRole = cut.userData.woodRole = 'primary';

  // Long sides: plain boards, mitred at both ends.
  const sideProfile = outline([
    [-L / 2, 0],
    [L / 2, 0],
    [L / 2, H, MITRE],
    [-L / 2, H, MITRE],
  ]);
  const side = (front) => {
    const geo = markFaces(mitredBoard(sideProfile, L, T), () => false);
    return K.wood(geo, {
      species: wood,
      grain: 'x',
      size: GRAIN,
      materials: [face, cut],
      pos: [0, 0, front ? W / 2 : -W / 2],
      rot: [0, front ? Math.PI : 0, 0],
      name: 'side',
    });
  };

  // Handle ends: the same board with a hand-hold cut down from the top, and the brass bar let into the top edge.
  const n = NOTCH_W / 2;
  const endProfile = outline([
    [-W / 2, 0],
    [W / 2, 0],
    [W / 2, H, MITRE],
    [n, H, 0.0008],
    [n, LIP, 0.003],
    [-n, LIP, 0.003],
    [-n, H, 0.0008],
    [-W / 2, H, MITRE],
  ]);
  const barLen = W - T + BAR_W; // its outer edge, mitre to mitre on the centreline of the end board
  const barProfile = outline([
    [-barLen / 2, 0],
    [barLen / 2, 0],
    [barLen / 2, BAR_H],
    [-barLen / 2, BAR_H],
  ]);
  const end = (right) => {
    const boardGeo = markFaces(mitredBoard(endProfile, W, T), (nrm, c) => Math.abs(nrm.x) > 0.8 && Math.abs(c.x) < n + 0.004);
    const board = K.wood(boardGeo, { species: wood, grain: 'x', size: GRAIN, materials: [face, cut], name: 'handle-end' });
    const barGeo = mitredBoard(barProfile, barLen, BAR_W, { ease: 0.0003 });
    barGeo.translate(0, H - BAR_H + 0.0003, T / 2 - BAR_W / 2); // top a hair proud of the wood so it reads flush
    const bar = K.part(barGeo, K.M.brass(), { name: 'brass-bar' });
    const g = K.group(board, bar);
    g.position.x = right ? L / 2 : -L / 2;
    g.rotation.y = right ? -Math.PI / 2 : Math.PI / 2;
    return g;
  };

  // Bottom board, captured by the frame (it tucks 1.5 mm into each side so no gap can show).
  const bottom = K.board([L - 2 * T + 0.003, TB, W - 2 * T + 0.003], {
    species: wood,
    grain: 'x',
    size: 0.55,
    radius: 0.0004,
    materials: [face, face, face, face, face, face],
    pos: [0, 0.0012 + TB / 2, 0],
    name: 'bottom',
  });

  return K.seat(K.group(side(true), side(false), end(true), end(false), bottom));
}
