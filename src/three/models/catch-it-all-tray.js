// Catch-it-all Tray: a low 14 x 10 in tray. Half-inch sides 1.5 in tall, mitred at the corners, round a thin flat
// bottom cut from one wide board. No handles, no hardware: the figure in the bottom board is the whole show.
import * as K from '../kit.js';

const { THREE } = K;

export const meta = { handle: 'catch-it-all-tray', view: { yaw: -0.62, pitch: 0.7 } };

const SEAM_TONE = 0.45;
// In her mahogany trays the rails are cut from the pale, orange-red part of the board and the bottom from the dark
// figured heart. The species texture is the dark heart, so mahogany rails are lifted; other woods are left alone.
const RAIL_TONE = { mahogany: 2.2 };
const railTone = (species) => RAIL_TONE[species] || 1;

/**
 * Local helper (kit gap): one side of a mitred frame, as a single closed solid.
 * Local axes: x along the board, y up, outer face on z = 0, inner face on z = -thick. Both ends are cut at 45 degrees,
 * so the outer face is `length` long and the inner face `length - 2 * thick`. The two top edges are eased by `ease`.
 * `seam` > 0 breaks the top of each mitre with a hairline V (that many metres per board). Those faces go in geometry
 * group 1 so they can take a darker material and the joint reads as a fine line; everything else is group 0.
 */
function mitredSide({ length: L, height: H, thick: t, ease: e = 0.0012, easeSegments: es = 4, seam = 0 }) {
  const pos = [];
  const nor = [];
  const body = [];
  const groove = [];
  let idx = body;
  const vert = (x, y, z, nx, ny, nz) => {
    pos.push(x, y, z);
    nor.push(nx, ny, nz);
    return pos.length / 3 - 1;
  };
  const P = (i) => new THREE.Vector3(pos[i * 3], pos[i * 3 + 1], pos[i * 3 + 2]);
  const N = (i) => new THREE.Vector3(nor[i * 3], nor[i * 3 + 1], nor[i * 3 + 2]);
  // Triangles are wound to agree with their vertex normals, so every face looks outward.
  const tri = (a, b, c) => {
    const pa = P(a);
    const n = P(b).sub(pa).cross(P(c).sub(pa));
    if (n.lengthSq() < 1e-20) return;
    if (n.dot(N(a).add(N(b)).add(N(c))) < 0) idx.push(a, c, b);
    else idx.push(a, b, c);
  };
  const quad = (a, b, c, d) => {
    tri(a, b, c);
    tri(a, c, d);
  };
  const yTop = H - e; // where the flat faces stop and the eased edge begins

  // Outer and inner faces.
  quad(vert(-L / 2, 0, 0, 0, 0, 1), vert(L / 2, 0, 0, 0, 0, 1), vert(L / 2, yTop, 0, 0, 0, 1), vert(-L / 2, yTop, 0, 0, 0, 1));
  const hi = L / 2 - t;
  quad(vert(-hi, 0, -t, 0, 0, -1), vert(hi, 0, -t, 0, 0, -1), vert(hi, yTop, -t, 0, 0, -1), vert(-hi, yTop, -t, 0, 0, -1));

  // Top: eased outer edge, flat, eased inner edge. Every station is shortened by its depth, which makes the mitre.
  const top = [];
  for (let s = 0; s <= es; s++) {
    const a = ((s / es) * Math.PI) / 2;
    top.push({ d: e - e * Math.cos(a), y: yTop + e * Math.sin(a), ny: Math.sin(a), nz: Math.cos(a) });
  }
  for (let s = 0; s <= es; s++) {
    const b = ((s / es) * Math.PI) / 2;
    top.push({ d: t - e + e * Math.sin(b), y: yTop + e * Math.cos(b), ny: Math.cos(b), nz: -Math.sin(b) });
  }
  top.forEach((q) => (q.g = seam * Math.max(0, q.ny))); // the V fades out where the edge turns down into a face
  const rows = top.map((q) => [vert(-(L / 2 - q.d - q.g), q.y, -q.d, 0, q.ny, q.nz), vert(L / 2 - q.d - q.g, q.y, -q.d, 0, q.ny, q.nz)]);
  for (let k = 0; k < rows.length - 1; k++) quad(rows[k][0], rows[k][1], rows[k + 1][1], rows[k + 1][0]);

  // Underside.
  quad(vert(-L / 2, 0, 0, 0, -1, 0), vert(L / 2, 0, 0, 0, -1, 0), vert(hi, 0, -t, 0, -1, 0), vert(-hi, 0, -t, 0, -1, 0));

  // Mitred ends (they close the solid; in the assembled frame they sit against the neighbouring board).
  const outline = [{ d: 0, y: 0 }, ...top.map((q) => ({ d: q.d, y: q.y - q.g })), { d: t, y: 0 }];
  [-1, 1].forEach((sgn) => {
    const ids = outline.map((q) => vert(sgn * (L / 2 - q.d), q.y, -q.d, sgn * Math.SQRT1_2, 0, -Math.SQRT1_2));
    for (let k = 1; k < ids.length - 1; k++) tri(ids[0], ids[k], ids[k + 1]);
  });

  // The hairline V along the top of each mitre.
  if (seam > 0) {
    idx = groove;
    [-1, 1].forEach((sgn) => {
      const lips = top.map((q) => {
        // each lip faces half way between the top surface and the mitre plane
        const n = new THREE.Vector3(sgn * Math.SQRT1_2, q.ny, q.nz - Math.SQRT1_2).normalize();
        return [vert(sgn * (L / 2 - q.d - q.g), q.y, -q.d, n.x, n.y, n.z), vert(sgn * (L / 2 - q.d), q.y - q.g, -q.d, n.x, n.y, n.z)];
      });
      for (let k = 0; k < lips.length - 1; k++) quad(lips[k][0], lips[k][1], lips[k + 1][1], lips[k + 1][0]);
    });
  }

  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  geo.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3));
  geo.setIndex(body.concat(groove));
  if (groove.length) {
    geo.addGroup(0, body.length, 0);
    geo.addGroup(body.length, groove.length, 1);
  }
  return geo;
}

// Fixed grain placement, so the piece looks the same every time it is built (the kit's own offsets depend on build order).
const regrain = (mesh, grain, size, offset) => {
  K.woodUV(mesh.geometry, { grain, size, offset });
  return mesh;
};

export function build({ wood = 'mahogany' } = {}) {
  const L = K.inch(14);
  const W = K.inch(10);
  const H = K.inch(1.5);
  const T = K.inch(0.5);

  // One darker copy of the body wood, shared by the hairline at the top of every mitre. It follows the swatches too.
  const seamMat = K.M.woodMaterial(wood, { darken: SEAM_TONE });
  seamMat.userData.woodRole = 'primary';

  // Rails: straight, quiet grain from the calm band of the species texture, so the bottom board does the talking.
  const RAIL_GRAIN = 0.46;
  const rail = (len, rotY, pos, grainOffset) =>
    regrain(
      K.wood(mitredSide({ length: len, height: H, thick: T, ease: 0.0014, seam: 0.0004 }), {
        species: wood,
        grain: 'x',
        size: RAIL_GRAIN,
        darken: railTone(wood),
        materials: [{}, seamMat],
        rot: [0, rotY, 0],
        pos,
      }),
      'x',
      RAIL_GRAIN,
      grainOffset,
    );
  const front = rail(L, 0, [0, 0, W / 2], [0.45, 0.07]);
  const back = rail(L, Math.PI, [0, 0, -W / 2], [0.58, 0.075]);
  const right = rail(W, Math.PI / 2, [L / 2, 0, 0], [0.32, 0.07]);
  const left = rail(W, -Math.PI / 2, [-L / 2, 0, 0], [0.7, 0.08]);
  const rails = [front, back, right, left];

  // The bottom: one wide board, 3/8 in thick, let into the sides a little above the table. One texture tile spans its
  // full width, so the whole figure of the board shows, and the offset is fixed so it is the same board every time.
  const lip = 0.001;
  const bottomT = K.inch(0.375);
  const BOTTOM_GRAIN = 0.46;
  const bottom = regrain(
    K.wood(new THREE.BoxGeometry(L - 2 * T + 2 * lip, bottomT, W - 2 * T + 2 * lip), { species: wood, grain: 'x', size: BOTTOM_GRAIN, pos: [0, K.inch(0.125) + bottomT / 2, 0] }),
    'x',
    BOTTOM_GRAIN,
    [0.64, 0.5],
  );

  // When the stage re-skins the tray in place (a swatch tap), give the rails the tone that goes with the new wood.
  const lead = front.material[0];
  let species = lead.userData.species;
  Object.defineProperty(lead.userData, 'species', {
    configurable: true,
    enumerable: true,
    get: () => species,
    set(next) {
      const changed = next !== species;
      species = next;
      if (!changed) return;
      rails.forEach((r) => {
        r.material[0].userData.darken = railTone(next);
        K.M.setWoodMaterial(r.material[0], next);
      });
    },
  });

  return K.seat(K.group(front, back, right, left, bottom));
}
