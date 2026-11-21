// The Timothy Serving Tray: an 18 x 12 x 3 in tray in 3/4 in stock. Four mitred sides, each corner keyed with two
// thin splines in the contrasting species, a rounded-over hand hole in each short end, and a flat bottom panel
// let into the sides. Lies flat; the default view is from a corner so the splines and a hand hole both show.
import * as K from '../kit.js';

const { THREE } = K;

export const meta = { handle: 'walnut-tray', view: { yaw: -0.95, pitch: 0.55 } };

// Splines are cut from the "other" wood: light oak keys in a walnut tray, dark walnut keys in an oak one.
const splineFor = (body) => (body === 'walnut' ? 'oak' : 'walnut');
const KEY_TONE = { oak: 1.22, walnut: 0.82 }; // pale keys a touch paler, dark keys a touch darker, so they read at a glance
const SEAM_TONE = 0.45;

/**
 * Local helper (kit gap): one side of a mitred frame, as a single closed solid.
 * Local axes: x along the board, y up, outer face on z = 0, inner face on z = -thick. Both ends are cut at 45 degrees,
 * so the outer face is `length` long and the inner face `length - 2 * thick`. The two top edges are eased by `ease`.
 * `hole` (optional) cuts a stadium-shaped hand hole right through: { y, length, width, round } where `round` is the
 * radius of the round-over where the hole meets each face.
 * `seam` > 0 breaks the top of each mitre with a hairline V (that many metres per board). Those faces go in geometry
 * group 1 so they can take a darker material and the joint reads as a fine line; everything else is group 0.
 */
function mitredSide({ length: L, height: H, thick: t, ease: e = 0.0008, easeSegments: es = 3, hole = null, seam = 0 }) {
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

  // Hand hole: a ring of points round the stadium, each with its arc centre and outward direction.
  let ring = null;
  let prof = null;
  if (hole) {
    const r = hole.width / 2;
    const a = Math.max(0, hole.length / 2 - r);
    const n = 20;
    ring = [];
    for (let i = 0; i <= n; i++) {
      const th = -Math.PI / 2 + (Math.PI * i) / n;
      ring.push({ cx: a, cy: hole.y, nx: Math.cos(th), ny: Math.sin(th) });
    }
    for (let i = 0; i <= n; i++) {
      const th = Math.PI / 2 + (Math.PI * i) / n;
      ring.push({ cx: -a, cy: hole.y, nx: Math.cos(th), ny: Math.sin(th) });
    }
    // Wall profile through the thickness: round-over, straight run, round-over.
    const ro = Math.min(hole.round ?? 0.004, t / 2 - 1e-4);
    const rs = 6;
    prof = [];
    for (let s = 0; s <= rs; s++) {
      const psi = ((s / rs) * Math.PI) / 2;
      prof.push({ d: ro * (1 - Math.cos(psi)), off: r + ro * (1 - Math.sin(psi)), nr: -Math.sin(psi), nz: Math.cos(psi) });
    }
    for (let s = rs; s >= 0; s--) {
      const psi = ((s / rs) * Math.PI) / 2;
      prof.push({ d: t - ro * (1 - Math.cos(psi)), off: r + ro * (1 - Math.sin(psi)), nr: -Math.sin(psi), nz: -Math.cos(psi) });
    }
  }
  const ringAt = (p) => ring.map((q) => [q.cx + p.off * q.nx, q.cy + p.off * q.ny]);

  // Outer and inner faces (with the hole cut out when there is one).
  const face = (z, half, nz, holePts) => {
    const contour = [
      [-half, 0],
      [half, 0],
      [half, yTop],
      [-half, yTop],
    ];
    const ids = contour.concat(holePts || []).map(([x, y]) => vert(x, y, z, 0, 0, nz));
    if (!holePts) return quad(ids[0], ids[1], ids[2], ids[3]);
    const v2 = ([x, y]) => new THREE.Vector2(x, y);
    THREE.ShapeUtils.triangulateShape(contour.map(v2), [holePts.map(v2)]).forEach(([a, b, c]) => tri(ids[a], ids[b], ids[c]));
    return null;
  };
  face(0, L / 2, 1, hole && ringAt(prof[0]));
  face(-t, L / 2 - t, -1, hole && ringAt(prof[prof.length - 1]));

  // Hole wall.
  if (hole) {
    const loops = prof.map((p) => ring.map((q) => vert(q.cx + p.off * q.nx, q.cy + p.off * q.ny, -p.d, p.nr * q.nx, p.nr * q.ny, p.nz)));
    for (let k = 0; k < loops.length - 1; k++) {
      for (let j = 0; j < ring.length; j++) {
        const j2 = (j + 1) % ring.length;
        quad(loops[k][j], loops[k][j2], loops[k + 1][j2], loops[k + 1][j]);
      }
    }
  }

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
  quad(vert(-L / 2, 0, 0, 0, -1, 0), vert(L / 2, 0, 0, 0, -1, 0), vert(L / 2 - t, 0, -t, 0, -1, 0), vert(-(L / 2 - t), 0, -t, 0, -1, 0));

  // Mitred ends (they close the solid; in the assembled frame they sit against the neighbouring board).
  const outline = [{ d: 0, y: 0 }, ...top.map((q) => ({ d: q.d, y: q.y - q.g })), { d: t, y: 0 }];
  [-1, 1].forEach((sgn) => {
    const ids = outline.map((q) => vert(sgn * (L / 2 - q.d), q.y, -q.d, sgn * Math.SQRT1_2, 0, -Math.SQRT1_2));
    for (let k = 1; k < ids.length - 1; k++) tri(ids[0], ids[k], ids[k + 1]);
  });

  // The hairline V along the top of each mitre.
  if (seam > 0) {
    idx = groove;
    const s3 = 1 / Math.sqrt(3);
    [-1, 1].forEach((sgn) => {
      const lips = top.map((q) => [vert(sgn * (L / 2 - q.d - q.g), q.y, -q.d, sgn * s3, s3, -s3), vert(sgn * (L / 2 - q.d), q.y - q.g, -q.d, sgn * s3, s3, -s3)]);
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

/** Local helper (kit gap): the eight corner keys as one geometry. Each is a thin triangular wafer let into a mitre. */
function splineKeys({ L, W, leg, thick, heights, proud = 0.0003 }) {
  const pos = [];
  const nor = [];
  const face = (pts, n) => {
    // fan-triangulate a convex polygon, wound to face along n
    for (let k = 1; k < pts.length - 1; k++) {
      const [a, b, c] = [pts[0], pts[k], pts[k + 1]];
      const g = new THREE.Vector3().subVectors(b, a).cross(new THREE.Vector3().subVectors(c, a));
      (g.dot(n) < 0 ? [a, c, b] : [a, b, c]).forEach((p) => {
        pos.push(p.x, p.y, p.z);
        nor.push(n.x, n.y, n.z);
      });
    }
  };
  const V = (x, y, z) => new THREE.Vector3(x, y, z);
  [-1, 1].forEach((sx) => {
    [-1, 1].forEach((sz) => {
      heights.forEach((h) => {
        const cx = sx * (L / 2 + proud);
        const cz = sz * (W / 2 + proud);
        const ax = cx - sx * leg; // along the long side's face
        const bz = cz - sz * leg; // along the short end's face
        const y0 = h - thick / 2;
        const y1 = h + thick / 2;
        face([V(cx, y1, cz), V(ax, y1, cz), V(cx, y1, bz)], V(0, 1, 0));
        face([V(cx, y0, cz), V(ax, y0, cz), V(cx, y0, bz)], V(0, -1, 0));
        face([V(cx, y0, cz), V(ax, y0, cz), V(ax, y1, cz), V(cx, y1, cz)], V(0, 0, sz)); // shows on the long side
        face([V(cx, y0, cz), V(cx, y0, bz), V(cx, y1, bz), V(cx, y1, cz)], V(sx, 0, 0)); // shows on the short end
        face([V(ax, y0, cz), V(cx, y0, bz), V(cx, y1, bz), V(ax, y1, cz)], V(-sx, 0, -sz).normalize()); // buried
      });
    });
  });
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  geo.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3));
  return geo;
}

// Fixed grain placement, so the piece looks the same every time it is built (the kit's own offsets depend on build order).
const regrain = (mesh, grain, size, offset) => {
  K.woodUV(mesh.geometry, { grain, size, offset });
  return mesh;
};

export function build({ wood = 'walnut' } = {}) {
  const L = K.inch(18);
  const W = K.inch(12);
  const H = K.inch(3);
  const T = K.inch(0.75);
  const hole = { y: K.inch(1.75), length: K.inch(4), width: K.inch(1.1), round: K.inch(0.19) };

  // One darker copy of the body wood, shared by the hairline at the top of every mitre. It follows the swatches too.
  const seamMat = K.M.woodMaterial(wood, { darken: SEAM_TONE });
  seamMat.userData.woodRole = 'primary';

  const side = (len, rotY, pos, grainOffset, withHole) =>
    regrain(
      K.wood(mitredSide({ length: len, height: H, thick: T, ease: 0.0009, seam: 0.0004, hole: withHole ? hole : null }), {
        species: wood,
        grain: 'x',
        size: 0.5,
        materials: [{}, seamMat],
        rot: [0, rotY, 0],
        pos,
      }),
      'x',
      0.5,
      grainOffset,
    );
  const front = side(L, 0, [0, 0, W / 2], [0.52, 0.12], false);
  const back = side(L, Math.PI, [0, 0, -W / 2], [0.46, 0.58], false);
  const right = side(W, Math.PI / 2, [L / 2, 0, 0], [0.3, 0.36], true);
  const left = side(W, -Math.PI / 2, [-L / 2, 0, 0], [0.71, 0.66], true);

  // Bottom panel: 1/4 in, let into a groove a little above the table.
  const lip = 0.001;
  const bottomT = K.inch(0.25);
  const bottom = regrain(
    K.wood(new THREE.BoxGeometry(L - 2 * T + 2 * lip, bottomT, W - 2 * T + 2 * lip), { species: wood, grain: 'x', size: 0.5, pos: [0, K.inch(0.14) + bottomT / 2, 0] }),
    'x',
    0.5,
    [0.5, 0.53],
  );

  // Corner keys, about a quarter and three quarters of the way up.
  const keySpecies = splineFor(wood);
  const keys = K.wood(splineKeys({ L, W, leg: K.inch(0.72), thick: K.inch(0.12), heights: [K.inch(0.8), K.inch(2.3)] }), {
    species: keySpecies,
    role: 'accent',
    darken: KEY_TONE[keySpecies],
    grain: 'x',
    size: 0.3,
  });

  // When the stage re-skins the body in place (a swatch tap), flip the keys to the contrasting wood as well.
  const bodyMat = front.material[0];
  let bodySpecies = bodyMat.userData.species;
  Object.defineProperty(bodyMat.userData, 'species', {
    configurable: true,
    enumerable: true,
    get: () => bodySpecies,
    set(next) {
      const changed = next !== bodySpecies;
      bodySpecies = next;
      if (!changed) return;
      const to = splineFor(next);
      keys.material.userData.darken = KEY_TONE[to];
      K.M.setWoodMaterial(keys.material, to);
    },
  });

  return K.seat(K.group(front, back, right, left, bottom, keys));
}
