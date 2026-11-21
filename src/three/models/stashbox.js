// Stash Box with Rolling Tray: a dense jatoba box (shown in mahogany) about 9 x 7 x 4 in. Four mitred sides, each
// corner keyed with two pairs of thin dark wenge splines. The lid doubles as a rolling tray and sits flush on top: a
// wide shallow routed tray, and at one end a raised platform with a curved edge that holds a round grinder dish, five
// joint holes and a lighter scoop; a notch through the rim at one corner lets you brush keef off the tray.
// Shown closed and lying flat; the lid details are real cut-outs in a top layer over darker floors.
import * as K from '../kit.js';

const { THREE } = K;

export const meta = { handle: 'stashbox', view: { yaw: -0.6, pitch: 0.6 }, fit: 0.96 };

const mm = (n) => n / 1000;
const rad = (deg) => (deg * Math.PI) / 180;

/**
 * Local helper (kit gap; same approach as nightcap-bath-tray): a slab cut from a plan outline with a quarter-round
 * ease per edge, blind recesses (holes with `depth`) that get real walls and a floor, and wood UVs that wrap over the
 * eased edges. Plan points are [x, z] in metres; the slab spans y = 0 .. T; grain runs along x. Geometry groups:
 * 0 = body, plus whatever `group` / `floorGroup` indices the holes use.
 */
function easedSlab({ outline, holes = [], T, tile = [0.5, 0.25], offset = [0, 0] }) {
  const [su, sv] = tile;
  const buckets = [];
  const bucket = (g) => (buckets[g] ||= { pos: [], nor: [], uv: [] });
  const tri = (g, a, b, c) => {
    const ux = b.p[0] - a.p[0], uy = b.p[1] - a.p[1], uz = b.p[2] - a.p[2];
    const vx = c.p[0] - a.p[0], vy = c.p[1] - a.p[1], vz = c.p[2] - a.p[2];
    const nx = uy * vz - uz * vy, ny = uz * vx - ux * vz, nz = ux * vy - uy * vx;
    if (nx * nx + ny * ny + nz * nz < 1e-22) return;
    const facing = nx * (a.n[0] + b.n[0] + c.n[0]) + ny * (a.n[1] + b.n[1] + c.n[1]) + nz * (a.n[2] + b.n[2] + c.n[2]);
    const B = bucket(g);
    for (const v of facing >= 0 ? [a, b, c] : [a, c, b]) {
      B.pos.push(v.p[0], v.p[1], v.p[2]);
      B.nor.push(v.n[0], v.n[1], v.n[2]);
      B.uv.push(v.uv[0], v.uv[1]);
    }
  };
  const planUV = (x, z, du = 0, dv = 0) => [x / su + offset[0] + du, z / sv + offset[1] + dv];

  const prep = (c, isHole) => {
    let pts = c.pts.map(([x, z]) => [x, z]);
    const n = pts.length;
    let ed = pts.map((_, j) => ({ top: 0, bottom: 0, group: 0, ...(typeof c.edge === 'function' ? c.edge(j) : c.edge) }));
    let area = 0;
    for (let i = 0; i < n; i++) area += pts[i][0] * pts[(i + 1) % n][1] - pts[(i + 1) % n][0] * pts[i][1];
    if (area > 0 === isHole) {
      const src = ed;
      pts = pts.slice().reverse();
      ed = src.map((_, i) => src[(2 * n - 2 - i) % n]);
    }
    const nrm = pts.map((p, j) => {
      const q = pts[(j + 1) % n];
      const l = Math.hypot(q[0] - p[0], q[1] - p[1]) || 1;
      return [-(q[1] - p[1]) / l, (q[0] - p[0]) / l];
    });
    const y1 = T;
    const y0 = c.depth ? T - c.depth : 0;
    const raw = [y0, y1];
    for (const e of ed) {
      for (const [r, dir] of [[e.top, 1], [c.depth ? 0 : e.bottom, -1]]) {
        if (!(r > 0)) continue;
        const segs = r >= 0.002 ? 5 : r >= 0.0009 ? 3 : 2;
        for (let k = 0; k <= segs; k++) {
          const s = r * Math.sin((k / segs) * Math.PI * 0.5);
          raw.push(dir > 0 ? y1 - r + s : y0 + r - s);
        }
      }
    }
    raw.sort((a, b) => a - b);
    const ys = [y0];
    for (const y of raw) if (y - ys[ys.length - 1] > 4e-5 && y1 - y > 4e-5) ys.push(y);
    ys.push(y1);
    const prof = (e, y) => {
      let d = 0;
      let nh = 1;
      let ny = 0;
      const bottom = c.depth ? 0 : e.bottom;
      if (e.top > 0 && y > y1 - e.top + 1e-9) {
        const s = Math.min(1, (y - (y1 - e.top)) / e.top);
        const cs = Math.sqrt(1 - s * s);
        d += e.top * (1 - cs);
        nh = cs;
        ny = s;
      } else if (bottom > 0 && y < y0 + bottom - 1e-9) {
        const s = Math.min(1, (y0 + bottom - y) / bottom);
        const cs = Math.sqrt(1 - s * s);
        d += bottom * (1 - cs);
        nh = cs;
        ny = -s;
      }
      return { d, nh, ny };
    };
    const rings = ys.map((y) =>
      pts.map((p, i) => {
        const nA = nrm[(i - 1 + n) % n];
        const nB = nrm[i];
        const dA = prof(ed[(i - 1 + n) % n], y).d;
        const dB = prof(ed[i], y).d;
        const dot = nA[0] * nB[0] + nA[1] * nB[1];
        const det = nA[0] * nB[1] - nA[1] * nB[0];
        let ox;
        let oz;
        if (Math.abs(dA - dB) < 1e-9 || Math.abs(det) < 1e-3) {
          const k = (dA + dB) / 2 / Math.max(0.2, 1 + dot);
          ox = (nA[0] + nB[0]) * k;
          oz = (nA[1] + nB[1]) * k;
        } else {
          ox = (dA * nB[1] - dB * nA[1]) / det;
          oz = (nA[0] * dB - nB[0] * dA) / det;
        }
        return [p[0] + ox, p[1] + oz];
      }),
    );
    const smooth = pts.map((_, i) => {
      const a = nrm[(i - 1 + n) % n];
      const b = nrm[i];
      return a[0] * b[0] + a[1] * b[1] > 0.77;
    });
    const outDir = (j, i) => {
      if (smooth[i]) {
        const a = nrm[(i - 1 + n) % n];
        const b = nrm[i];
        const l = Math.hypot(a[0] + b[0], a[1] + b[1]);
        return [-(a[0] + b[0]) / l, -(a[1] + b[1]) / l];
      }
      return [-nrm[j][0], -nrm[j][1]];
    };
    for (let j = 0; j < n; j++) {
      const e = ed[j];
      const j2 = (j + 1) % n;
      const o1 = outDir(j, j);
      const o2 = outDir(j, j2);
      const vert = (i, o, k) => {
        const y = ys[k];
        const pr = prof(e, y);
        const [x, z] = rings[k][i];
        const h = T - y;
        return { p: [x, y, z], n: [o[0] * pr.nh, pr.ny, o[1] * pr.nh], uv: planUV(x + o[0] * h, z + o[1] * h) };
      };
      for (let k = 0; k < ys.length - 1; k++) {
        const a = vert(j, o1, k);
        const b = vert(j2, o2, k);
        const c2 = vert(j2, o2, k + 1);
        const d = vert(j, o1, k + 1);
        tri(e.group, a, b, c2);
        tri(e.group, a, c2, d);
      }
    }
    return { c, y0, top: rings[rings.length - 1], bottom: rings[0] };
  };

  const cap = (contour, inner, y, up, g, du = 0, dv = 0) => {
    const v2 = (r) => r.map(([x, z]) => new THREE.Vector2(x, z));
    const all = [contour, ...inner].flat();
    for (const f of THREE.ShapeUtils.triangulateShape(v2(contour), inner.map(v2))) {
      const [a, b, c] = f.map((i) => ({ p: [all[i][0], y, all[i][1]], n: [0, up, 0], uv: planUV(all[i][0], all[i][1], du, dv) }));
      tri(g, a, b, c);
    }
  };

  const outer = prep(outline, false);
  const inner = holes.map((h) => prep(h, true));
  cap(outer.top, inner.map((h) => h.top), T, 1, 0);
  cap(outer.bottom, inner.filter((h) => !h.c.depth).map((h) => h.bottom), 0, -1, 0, 0.37, 0.21);
  for (const h of inner) if (h.c.depth) cap(h.bottom, [], h.y0, 1, h.c.floorGroup ?? 0, 0.23, 0.41);

  const pos = [];
  const nor = [];
  const uv = [];
  const geo = new THREE.BufferGeometry();
  buckets.forEach((B, g) => {
    if (!B) return;
    geo.addGroup(pos.length / 3, B.pos.length / 3, g);
    for (const v of B.pos) pos.push(v);
    for (const v of B.nor) nor.push(v);
    for (const v of B.uv) uv.push(v);
  });
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  geo.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3));
  geo.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  return geo;
}

/** A wood part from easedSlab that keeps the slab's own wrapped UVs. */
function woodSlab(spec, opts) {
  const geo = easedSlab(spec);
  const uv = geo.getAttribute('uv');
  const mesh = K.wood(geo, opts);
  mesh.geometry.setAttribute('uv', uv);
  return mesh;
}

const arc = (cx, cz, r, a0, a1, n) => {
  const out = [];
  for (let i = 0; i <= n; i++) {
    const a = a0 + ((a1 - a0) * i) / n;
    out.push([cx + Math.cos(a) * r, cz + Math.sin(a) * r]);
  }
  return out;
};

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

const regrain = (mesh, grain, size, offset) => {
  K.woodUV(mesh.geometry, { grain, size, offset });
  return mesh;
};

export function build({ wood = 'mahogany' } = {}) {
  const I = K.inch;
  const L = I(9);
  const W = I(7);
  const lidBaseT = I(0.3);
  const lidTopT = I(0.2);
  const lidT = lidBaseT + lidTopT;
  const H = I(4) - lidT; // the box walls
  const T = I(0.5);

  // ---------- box: four mitred sides ----------
  // Shared materials keep the count low; every one follows the swatches.
  const tone = (darken) => {
    const m = K.M.woodMaterial(wood, { darken });
    m.userData.woodRole = 'primary';
    return m;
  };
  const bodyMat = tone(1);
  const seamMat = tone(0.45);
  const side = (len, rotY, pos, off) =>
    regrain(
      K.wood(mitredSide({ length: len, height: H, thick: T, ease: 0.0008, seam: 0.0004 }), { species: wood, materials: [bodyMat, seamMat], rot: [0, rotY, 0], pos }),
      'x',
      0.52,
      off,
    );
  const front = side(L, 0, [0, 0, W / 2], [0.41, 0.17]);
  const back = side(L, Math.PI, [0, 0, -W / 2], [0.63, 0.55]);
  const right = side(W, Math.PI / 2, [L / 2, 0, 0], [0.22, 0.38]);
  const left = side(W, -Math.PI / 2, [-L / 2, 0, 0], [0.84, 0.71]);
  const bottom = K.wood(new THREE.BoxGeometry(L - 2 * T + 0.002, I(0.25), W - 2 * T + 0.002), { species: wood, grain: 'x', size: 0.5, pos: [0, I(0.2), 0] });
  bottom.material = bodyMat;

  // two pairs of thin wenge splines at each corner
  const sp = I(0.065);
  const keys = K.wood(splineKeys({ L, W, leg: I(0.5), thick: I(0.05), heights: [I(1.1), I(1.1) + sp * 1.9, I(2.95), I(2.95) + sp * 1.9] }), {
    species: 'ebonized',
    role: 'accent',
    darken: 0.8,
    grain: 'x',
    size: 0.3,
  });

  // ---------- lid / rolling tray ----------
  // Plan (inches): x along the 9 in length, z across (front = +z). The platform with the dish and holes is at +x.
  const rimF = 3.15; // inner edge of the front and back rims (z)
  const rimL = -4.1; // inner edge of the left rim (x)
  const lipR = 4.3; // inner edge of the thin lip at the platform end (x)
  const cr = 0.3; // corner radius of the routed tray
  const platX = 1.76; // straight edge of the platform
  const platZ = 0.69; // where that edge turns into the sweep
  const notch = [2.3, 2.72]; // keef slot through the lip, near the front corner
  const OUT = { top: mm(1.4) };
  const IN = { top: mm(0.7), group: 1 };
  const pts = [];
  const tags = [];
  const add = (list, tag) => list.forEach(([x, z]) => (pts.push([I(x), I(z)]), tags.push(tag)));
  add([[-4.5, 3.5]], OUT);
  add([[4.5, 3.5]], OUT);
  add([[4.5, notch[1]]], IN); // notch wall
  add([[lipR, notch[1]]], IN);
  add(arc(lipR - cr, rimF - cr, cr, 0, Math.PI / 2, 6), IN);
  add(arc(rimL + cr, rimF - cr, cr, Math.PI / 2, Math.PI, 6), IN);
  add(arc(rimL + cr, -rimF + cr, cr, Math.PI, Math.PI * 1.5, 6), IN);
  add([[platX, -rimF]], IN);
  const sweep = [];
  for (let i = 0; i <= 28; i++) {
    const t = (i / 28) * (Math.PI / 2);
    sweep.push([lipR - (lipR - platX) * Math.cos(t), platZ + (2.2 - platZ) * Math.sin(t)]);
  }
  add(sweep, IN);
  add([[lipR, notch[0]]], IN);
  add([[4.5, notch[0]]], OUT);
  add([[4.5, -3.5]], OUT);
  add([[-4.5, -3.5]], OUT);

  const grinder = { x: 2.88, z: -0.23, r: 1.0 };
  const holes = [
    [2.74, -1.7, 0.15],
    [2.74, -2.29, 0.15],
    [2.74, -2.77, 0.15],
    [3.51, -1.96, 0.18],
    [3.51, -2.58, 0.18],
  ];
  const lighter = { x: 2.2, z: -2.72, len: 0.72, w: 0.36, ang: Math.atan2(-0.68, -0.74) };
  const circ = (x, z, r, n) => arc(I(x), I(z), I(r), 0, Math.PI * 2 - (Math.PI * 2) / n, n - 1);
  const slotPts = (c) => {
    const p = K.slot(I(c.len), I(c.w), I(c.x), I(c.z), c.ang, false).getPoints();
    if (p.length > 1 && p[0].distanceTo(p[p.length - 1]) < 1e-7) p.pop();
    return p.map((v) => [v.x, v.y]);
  };
  const GRAIN = { tile: [0.5, 0.23], offset: [0.37, 0.52] };
  const mats = [bodyMat, tone(0.62), tone(0.42), tone(0.16)];

  const lidTop = woodSlab(
    {
      outline: { pts, edge: (j) => tags[j] },
      holes: [
        { pts: circ(grinder.x, grinder.z, grinder.r, 96), edge: IN },
        ...holes.map(([x, z, r]) => ({ pts: circ(x, z, r, 28), edge: IN })),
        { pts: slotPts(lighter), edge: IN },
      ],
      T: lidTopT,
      ...GRAIN,
    },
    { species: wood, materials: mats, pos: [0, H + lidBaseT, 0], name: 'lid-top' },
  );
  const lidBase = woodSlab(
    {
      outline: { pts: [[-L / 2, W / 2], [L / 2, W / 2], [L / 2, -W / 2], [-L / 2, -W / 2]].map(([x, z]) => [x, z]), edge: { bottom: mm(0.9) } },
      holes: [
        { pts: circ(grinder.x, grinder.z, grinder.r, 96), depth: I(0.1), edge: { group: 1 }, floorGroup: 2 },
        ...holes.map(([x, z, r]) => ({ pts: circ(x, z, r, 28), depth: I(0.24), edge: { group: 1 }, floorGroup: 3 })),
        { pts: slotPts(lighter), depth: I(0.16), edge: { group: 1 }, floorGroup: 2 },
      ],
      T: lidBaseT,
      ...GRAIN,
    },
    { species: wood, materials: mats, pos: [0, H, 0], name: 'lid-base' },
  );

  return K.seat(K.group(front, back, right, left, bottom, keys, lidBase, lidTop));
}
