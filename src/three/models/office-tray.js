// Office Tray: a low 12 x 10 in catchall for the desk. Four crisp sides butt-jointed around a thin bottom panel,
// each corner pinned with two brass dowels that show as dots on the long sides (walnut, birds-eye maple, yakisugi).
import * as K from '../kit.js';

const { THREE } = K;

// The dowel ends sit on upright faces, where mirror-polished brass would only reflect the floor and go dark.
// This satin brass keeps some diffuse gold, so the dots stay pale and bright from every turntable angle.
let brass;
const satinBrass = () => (brass ||= new THREE.MeshStandardMaterial({ color: 0xdbb055, metalness: 0.6, roughness: 0.36, emissive: 0x33230a, envMapIntensity: 1.2 }));

export const meta = { handle: 'office-tray', view: { yaw: -0.56, pitch: 0.56 } };

export function build({ wood = 'walnut' } = {}) {
  const L = K.inch(12); // long sides, along X
  const W = K.inch(10); // short sides, along Z
  const H = K.inch(1.4);
  const T = K.inch(0.4); // side thickness
  const TB = K.inch(0.25); // bottom panel
  const EDGE = 0.0007; // crisp, barely broken edges
  const GRAIN = 0.44;

  // Two shared wood materials: face grain, and a slightly darker one for the end grain that shows at each corner.
  const face = K.M.woodMaterial(wood);
  const endGrain = K.M.woodMaterial(wood, { darken: 0.8 });
  face.userData.woodRole = endGrain.userData.woodRole = 'primary';

  const allFace = [face, face, face, face, face, face]; // box face order: +x, -x, +y, -y, +z, -z
  const parts = [];

  // Long sides run the full 12 in and lap over the ends of the short sides, so their end grain shows at the corners.
  for (const s of [1, -1]) {
    parts.push(
      K.board([L, H, T], {
        species: wood,
        grain: 'x',
        size: GRAIN,
        radius: EDGE,
        materials: [endGrain, endGrain, face, face, face, face],
        pos: [0, H / 2, s * (W / 2 - T / 2)],
        name: 'long-side',
      }),
    );
  }

  // Short sides sit between them.
  for (const s of [1, -1]) {
    parts.push(
      K.board([T, H, W - 2 * T], {
        species: wood,
        grain: 'z',
        size: GRAIN,
        radius: EDGE,
        materials: allFace,
        pos: [s * (L / 2 - T / 2), H / 2, 0],
        name: 'short-side',
      }),
    );
  }

  // Bottom panel, let into the sides (it tucks 1 mm into each of them so no gap can show). In her walnut tray
  // the panel's grain runs across the short way.
  parts.push(
    K.board([L - 2 * T + 0.002, TB, W - 2 * T + 0.002], {
      species: wood,
      grain: 'z',
      size: 0.5,
      radius: 0.0004,
      materials: allFace,
      pos: [0, 0.0004 + TB / 2, 0],
      name: 'bottom',
    }),
  );

  // Brass dowels: two per corner, driven through the long side into the end of the short side, sanded flush.
  const dowelLen = K.inch(0.9);
  const dowelGeo = K.cylGeo(K.inch(0.085), dowelLen, 28);
  const proud = 0.00025;
  for (const sx of [1, -1]) {
    for (const sz of [1, -1]) {
      for (const y of [H * 0.3, H * 0.65]) {
        parts.push(
          K.part(dowelGeo, satinBrass(), {
            pos: [sx * (L / 2 - T / 2), y, sz * (W / 2 + proud - dowelLen / 2)],
            rot: [Math.PI / 2, 0, 0],
            shadow: false,
            name: 'dowel',
          }),
        );
      }
    }
  }

  return K.seat(K.group(parts));
}
