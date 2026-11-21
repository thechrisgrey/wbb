// The Butterfly Board: a 12" round of walnut or oak with a 2" handle, a natural split near the rim,
// and a brass butterfly key set across it. Shown standing, the way it hangs when it's not in use.
import * as K from '../kit.js';

const { THREE } = K;

export const meta = { handle: 'the-butterfly-board', view: { yaw: -0.5, pitch: 0.2 } };

export function build({ wood = 'walnut' } = {}) {
  const R = K.inch(6);
  const T = K.inch(0.8);
  const lobeAngle = THREE.MathUtils.degToRad(118);
  const lobeDist = R + K.inch(0.55);
  const lobeR = K.inch(1.25);

  // Outline: the round plus the handle lobe, traced as r(theta) and softened where they meet.
  const N = 260;
  const radii = [];
  for (let i = 0; i < N; i++) {
    const th = (i / N) * Math.PI * 2;
    const d = th - lobeAngle;
    const disc = lobeR * lobeR - lobeDist * lobeDist * Math.sin(d) ** 2;
    const far = disc >= 0 ? lobeDist * Math.cos(d) + Math.sqrt(disc) : 0;
    radii.push(Math.max(R, far));
  }
  const smooth = radii.map((_, i) => {
    let sum = 0;
    for (let k = -3; k <= 3; k++) sum += radii[(i + k + N) % N];
    return sum / 7;
  });
  const outline = new THREE.Shape();
  smooth.forEach((r, i) => {
    const th = (i / N) * Math.PI * 2;
    const x = Math.cos(th) * r;
    const y = Math.sin(th) * r;
    if (i === 0) outline.moveTo(x, y);
    else outline.lineTo(x, y);
  });
  outline.closePath();

  // Finger hole in the handle.
  outline.holes.push(K.circle(K.inch(0.62), Math.cos(lobeAngle) * lobeDist, Math.sin(lobeAngle) * lobeDist, true));

  // The split: a hairline running in from the rim.
  const splitAngle = THREE.MathUtils.degToRad(-44);
  const splitLen = K.inch(1.9);
  const splitMid = R - splitLen / 2 + K.inch(0.15);
  const sx = Math.cos(splitAngle);
  const sy = Math.sin(splitAngle);
  outline.holes.push(K.slot(splitLen, K.inch(0.1), sx * splitMid, sy * splitMid, splitAngle));

  const body = K.slab(outline, T, { species: wood, grain: 'x', size: 0.42, ease: 0.0035 });

  // Brass butterfly key across the split, flush with the face.
  const kw = K.inch(1.45); // length across the split
  const kh = K.inch(0.78); // width at the wings
  const waist = K.inch(0.3);
  const key = new THREE.Shape();
  key.moveTo(-kw / 2, -kh / 2);
  key.lineTo(0, -waist / 2);
  key.lineTo(kw / 2, -kh / 2);
  key.lineTo(kw / 2, kh / 2);
  key.lineTo(0, waist / 2);
  key.lineTo(-kw / 2, kh / 2);
  key.closePath();
  const keyGeo = new THREE.ExtrudeGeometry(key, { depth: 0.0014, bevelEnabled: false });
  keyGeo.rotateX(-Math.PI / 2);
  const keyAt = R - K.inch(1.25);
  const butterfly = K.part(keyGeo, K.M.brass(), {
    pos: [sx * keyAt, T - 0.001, -sy * keyAt],
    rot: [0, splitAngle + Math.PI / 2, 0],
    shadow: false,
  });

  const g = K.group(body, butterfly);
  g.rotation.x = Math.PI / 2 - 0.16; // stand it up, leaning back a touch
  return K.seat(K.group(g));
}
