// Coffee Filter Holder: a solid wood quarter circle (flat bottom, upright back, 5.5 in arc front) about 2.4 in thick,
// with a wide slot cut down the middle from the arc side so it becomes two sector-shaped cheeks joined at the base and
// back. A stack of natural kraft cone filters stands in the slot and fans out above the arc, and a solid 0.6 in brass
// rod runs crosswise under the front like an axle, its round ends showing on both sides. The rod is let partly into
// the bottom, so the piece rests on its back edge and the rod with the front lifted a touch, as in her photos.
import * as K from '../kit.js';

const { THREE } = K;

export const meta = { handle: 'brass-filter-holder', view: { yaw: -0.9, pitch: 0.3 } };

/** Extrude a profile drawn in x (front) / y (up) through z from z0 to z1, with a light eased edge. */
function extrudeXY(shape, z0, z1, ease, curveSegments = 40) {
  const e = Math.min(ease, (z1 - z0) / 2 - 1e-4);
  const geo = new THREE.ExtrudeGeometry(shape, {
    depth: z1 - z0 - 2 * e,
    bevelEnabled: e > 0,
    bevelThickness: e,
    bevelSize: e,
    bevelOffset: -e,
    bevelSegments: 2,
    curveSegments,
  });
  geo.translate(0, 0, z0 + e);
  return geo;
}

export function build({ wood = 'walnut' } = {}) {
  const R = K.inch(5.5);
  const W = K.inch(2.4);
  const ws = K.inch(1.0); // slot width (cheeks about 0.7 in each)
  const tb = K.inch(0.45); // back wall left behind the slot
  const tf = K.inch(0.45); // floor left under the slot
  const ease = K.inch(0.04);
  const HALF = Math.PI / 2;

  // ----- the two cheeks: full quarter circles, centred on the back-bottom corner -----
  const sector = new THREE.Shape();
  sector.moveTo(0, 0);
  sector.lineTo(R, 0);
  sector.absarc(0, 0, R, 0, HALF, false);
  sector.lineTo(0, 0);
  const cheek = (z0, z1) => K.wood(extrudeXY(sector, z0, z1, ease, 56), { species: wood, grain: 'x', size: 0.42, name: 'cheek' });
  const cheekA = cheek(-W / 2, -ws / 2);
  const cheekB = cheek(ws / 2, W / 2);

  // ----- the core between them: the floor and back wall the slot leaves, bounded by the same arc -----
  const a1 = Math.asin(tf / R);
  const a2 = Math.acos(tb / R);
  const core = new THREE.Shape();
  core.moveTo(0, 0);
  core.lineTo(R, 0);
  core.absarc(0, 0, R, 0, a1, false);
  core.lineTo(tb, tf);
  core.lineTo(tb, R * Math.sin(a2));
  core.absarc(0, 0, R, a2, HALF, false);
  core.lineTo(0, 0);
  const seamTuck = 0.0003; // runs a hair into each cheek so no faces coincide
  const coreMesh = K.wood(extrudeXY(core, -ws / 2 - seamTuck, ws / 2 + seamTuck, 0, 56), { species: wood, grain: 'x', size: 0.42, name: 'core' });

  // ----- the filter stack: a slightly larger fan standing in the slot, with a stepped lower front edge -----
  const fc = [tb + 0.0004, tf + 0.0004]; // its corner sits in the slot's inside corner
  const Rf = R + K.inch(0.75);
  const steps = [
    // [angle from, angle to, radius] for the folded, stepped lower part of the cone, low to high
    [0, 0.2, Rf - K.inch(0.62)],
    [0.2, 0.42, Rf - K.inch(0.38)],
    [0.42, 0.62, Rf - K.inch(0.16)],
    [0.62, HALF, Rf],
  ];
  const blend = 0.035; // soften each step into a gentle scallop
  const radiusAt = (a) => {
    let r = steps[0][2];
    for (let i = 1; i < steps.length; i++) {
      const t = THREE.MathUtils.smoothstep(a, steps[i][0] - blend, steps[i][0] + blend);
      r += (steps[i][2] - steps[i - 1][2]) * t;
    }
    return r;
  };
  // Five bundles of sheets, each a hair different in reach and lean, so the stack reads as paper, not a block.
  const ft = K.inch(0.5);
  const NB = 5;
  const bundles = [
    [0, 0.0],
    [K.inch(0.05), 0.012],
    [-K.inch(0.03), -0.008],
    [K.inch(0.07), 0.02],
    [K.inch(0.01), 0.004],
  ];
  const paperMat = K.M.paper(0xd9bf98);
  const sheetGeos = bundles.map(([dr, da], b) => {
    const shape = new THREE.Shape();
    shape.moveTo(fc[0], fc[1]);
    const NF = 72;
    for (let i = 0; i <= NF; i++) {
      const a = (HALF * i) / NF;
      const r = radiusAt(a - da) + dr * Math.sin(a * 2);
      shape.lineTo(fc[0] + r * Math.cos(a), fc[1] + r * Math.sin(a));
    }
    shape.lineTo(fc[0], fc[1]);
    const z0 = -ft / 2 + (ft * b) / NB;
    return extrudeXY(shape, z0 + 0.0002, z0 + ft / NB - 0.0002, K.inch(0.015), 4);
  });
  const filters = K.group(sheetGeos.map((geo) => K.part(geo, paperMat, { name: 'filters' })));

  // ----- brass rod under the front, let partly into the bottom -----
  const rr = K.inch(0.3);
  const xr = R * 0.8;
  const embed = K.inch(0.12);
  const yc = -(rr - embed);
  const rod = K.part(new THREE.CylinderGeometry(rr, rr, W + K.inch(0.08), 40), K.M.brassBrushed(), { pos: [xr, yc, 0], rot: [Math.PI / 2, 0, 0], name: 'brass-rod' });

  // Rest it on the back edge and the rod: tilt about z until the rod touches the table.
  const A = Math.hypot(xr, yc);
  const tilt = Math.asin(rr / A) - Math.atan2(yc, xr);
  const g = K.group(cheekA, cheekB, coreMesh, filters, rod);
  g.rotation.z = tilt;
  g.position.x = -R / 2;
  return K.seat(K.group(g));
}
