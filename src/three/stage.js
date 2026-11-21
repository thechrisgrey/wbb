// The turntable. One WebGL canvas that can show any of her pieces, rotate it under the thumb with inertia,
// swap its wood species, and move between hosts on the page (spin room, product sheet).
//
// Usage:
//   const stage = createStage();
//   stage.mount(hostEl);                        // put the canvas in a host element (re-mount to move it)
//   await stage.show('the-butterfly-board');    // load + reveal a piece
//   stage.setWood('oak');                       // re-skin
//   stage.setMode('free');                      // 'turntable' (drag X only, page still scrolls) or 'free' (X + Y + pinch)
import * as THREE from 'three';
import { gsap, reducedMotion } from '../lib/gsap.js';
import { applyWood, disposeModel } from './kit.js';
import { onTextureLoad, setMaxAnisotropy } from './materials.js';
import { loadModel } from './models/index.js';

const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
const DEFAULT_VIEW = { yaw: -0.62, pitch: 0.42, zoom: 1 };

export function webglAvailable() {
  try {
    const c = document.createElement('canvas');
    return !!(window.WebGLRenderingContext && (c.getContext('webgl2') || c.getContext('webgl')));
  } catch {
    return false;
  }
}

// A warm photo-studio surround for reflections: cream walls, a big overhead softbox, a key panel and a rim strip.
// Brass and mirror read as bright and golden instead of picking up a dark room.
function studioEnvironment() {
  const env = new THREE.Scene();
  const dome = new THREE.SphereGeometry(12, 48, 24);
  const top = new THREE.Color(0xfff6e6);
  const mid = new THREE.Color(0xe6d6bd);
  const low = new THREE.Color(0x8a6646);
  const colors = [];
  const pos = dome.attributes.position;
  const c = new THREE.Color();
  for (let i = 0; i < pos.count; i++) {
    const t = pos.getY(i) / 12; // -1 .. 1
    if (t >= 0) c.copy(mid).lerp(top, Math.min(1, t * 1.4));
    else c.copy(mid).lerp(low, Math.min(1, -t * 1.6));
    colors.push(c.r, c.g, c.b);
  }
  dome.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
  env.add(new THREE.Mesh(dome, new THREE.MeshBasicMaterial({ vertexColors: true, side: THREE.BackSide })));
  const panel = (w, h, color, strength, position, lookAt = [0, 0, 0]) => {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshBasicMaterial({ color: new THREE.Color(color).multiplyScalar(strength), side: THREE.DoubleSide }));
    m.position.set(...position);
    m.lookAt(...lookAt);
    env.add(m);
  };
  panel(9, 9, 0xfff3e0, 5.5, [0, 9, 1]); // overhead softbox
  panel(5, 7, 0xffe9cf, 6.5, [8, 4, 5]); // key, camera right
  panel(4, 6, 0xfff7ee, 2.2, [-8, 3, 4]); // fill, camera left
  panel(10, 1.2, 0xffd9a8, 7, [0, 5, -9]); // rim strip behind
  return env;
}

export function createStage({ dprMax = 2, autoRotate = true } = {}) {
  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: 'high-performance' });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, dprMax));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 0.98;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFShadowMap;
  renderer.setClearColor(0x000000, 0);
  setMaxAnisotropy(renderer.capabilities.getMaxAnisotropy());

  const canvas = renderer.domElement;
  canvas.className = 'stage-canvas';
  canvas.style.cssText = 'display:block;width:100%;height:100%;outline:none;';
  canvas.setAttribute('role', 'img');
  canvas.setAttribute('aria-label', 'Rotatable 3D view');

  const scene = new THREE.Scene();
  const pmrem = new THREE.PMREMGenerator(renderer);
  scene.environment = pmrem.fromScene(studioEnvironment(), 0.035).texture;
  scene.environmentIntensity = 0.62;

  const camera = new THREE.PerspectiveCamera(26, 1, 0.01, 60);

  const key = new THREE.DirectionalLight(0xfff0dd, 2.1);
  key.castShadow = true;
  key.shadow.mapSize.set(1024, 1024);
  key.shadow.bias = -0.0005;
  key.shadow.normalBias = 0.012;
  key.shadow.radius = 5;
  scene.add(key, key.target);
  const rim = new THREE.DirectionalLight(0xffd2a8, 0.7);
  scene.add(rim);
  scene.add(new THREE.HemisphereLight(0xfff7ec, 0x6b4a33, 0.35));

  const ground = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), new THREE.ShadowMaterial({ opacity: 0.26, color: 0x2a160a }));
  ground.rotation.x = -Math.PI / 2;
  ground.receiveShadow = true;
  scene.add(ground);

  const pivot = new THREE.Group(); // user rotation (yaw) lives here
  const holder = new THREE.Group(); // show/hide transitions live here
  pivot.add(holder);
  scene.add(pivot);

  const state = {
    host: null,
    mode: 'turntable',
    handle: null,
    model: null,
    radius: 0.3,
    height: 0.2,
    yaw: DEFAULT_VIEW.yaw,
    pitch: DEFAULT_VIEW.pitch,
    zoom: 1,
    vyaw: 0,
    vpitch: 0,
    dragging: false,
    auto: autoRotate && !reducedMotion(),
    autoSpeed: 0.32, // rad / s
    idleAt: 0,
    visible: true,
    dirty: true,
    w: 0,
    h: 0,
    token: 0,
  };
  const listeners = { change: new Set(), load: new Set(), drag: new Set() };
  const emit = (type, payload) => listeners[type].forEach((fn) => fn(payload));

  function frameCamera() {
    const { radius, height } = state;
    const vFov = THREE.MathUtils.degToRad(camera.fov);
    const hFov = 2 * Math.atan(Math.tan(vFov / 2) * camera.aspect);
    const fit = radius / Math.sin(Math.min(vFov, hFov) / 2);
    const dist = (fit * 1.12) / state.zoom;
    const target = new THREE.Vector3(0, height * 0.46, 0);
    camera.position.set(0, target.y + Math.sin(state.pitch) * dist, Math.cos(state.pitch) * dist);
    camera.lookAt(target);
    camera.near = Math.max(0.01, dist - radius * 3);
    camera.far = dist + radius * 6;
    camera.updateProjectionMatrix();
  }

  function fitLights() {
    const r = state.radius;
    key.position.set(r * 2.4, r * 4.2 + state.height, r * 2.6);
    key.target.position.set(0, state.height * 0.3, 0);
    rim.position.set(-r * 3, r * 2 + state.height, -r * 2.5);
    const s = key.shadow.camera;
    s.left = s.bottom = -r * 2.1;
    s.right = s.top = r * 2.1;
    s.near = 0.01;
    s.far = r * 12 + state.height * 2;
    s.updateProjectionMatrix();
    ground.scale.setScalar(r * 14);
  }

  function resize() {
    if (!state.host) return;
    const w = state.host.clientWidth;
    const h = state.host.clientHeight;
    if (!w || !h || (w === state.w && h === state.h)) return;
    state.w = w;
    state.h = h;
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    frameCamera();
    state.dirty = true;
  }
  const ro = 'ResizeObserver' in window ? new ResizeObserver(resize) : null;

  // ---------- render loop (on demand) ----------
  let last = performance.now();
  function tick() {
    const now = performance.now();
    const dt = Math.min(0.05, (now - last) / 1000);
    last = now;
    if (!state.visible || !state.host) return;
    if (!state.dragging) {
      if (Math.abs(state.vyaw) > 1e-4 || Math.abs(state.vpitch) > 1e-4) {
        state.yaw += state.vyaw * dt;
        state.pitch = clamp(state.pitch + state.vpitch * dt, -0.12, 1.2);
        const f = Math.pow(0.045, dt); // friction per second
        state.vyaw *= f;
        state.vpitch *= f;
        state.idleAt = now;
        state.dirty = true;
      } else if (state.auto && state.model && now - state.idleAt > 900) {
        state.yaw += state.autoSpeed * dt;
        state.dirty = true;
      }
    }
    if (!state.dirty) return;
    state.dirty = false;
    pivot.rotation.y = state.yaw;
    frameCamera();
    renderer.render(scene, camera);
    emit('change', state);
  }
  gsap.ticker.add(tick);
  const offTex = onTextureLoad(() => (state.dirty = true));

  // ---------- pointer control ----------
  const pointers = new Map();
  let lastX = 0;
  let lastY = 0;
  let lastT = 0;
  let pinch = 0;
  let decided = false;
  let startX = 0;
  let startY = 0;

  function down(e) {
    if (e.pointerType === 'mouse' && e.button !== 0) return;
    pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (pointers.size === 1) {
      startX = lastX = e.clientX;
      startY = lastY = e.clientY;
      lastT = performance.now();
      decided = state.mode === 'free' || e.pointerType === 'mouse';
      state.vyaw = state.vpitch = 0;
      if (decided) beginDrag(e);
    } else if (pointers.size === 2 && state.mode === 'free') {
      const [a, b] = [...pointers.values()];
      pinch = Math.hypot(a.x - b.x, a.y - b.y);
    }
  }
  function beginDrag(e) {
    state.dragging = true;
    try {
      state.host.setPointerCapture(e.pointerId);
    } catch {
      /* pointer already released */
    }
    state.host.classList.add('is-dragging');
    emit('drag', true);
  }
  function move(e) {
    if (!pointers.has(e.pointerId)) return;
    pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (pointers.size === 2 && state.mode === 'free') {
      const [a, b] = [...pointers.values()];
      const d = Math.hypot(a.x - b.x, a.y - b.y);
      if (pinch) state.zoom = clamp(state.zoom * (d / pinch), 0.7, 2.4);
      pinch = d;
      state.dirty = true;
      return;
    }
    if (!decided) {
      const dx = Math.abs(e.clientX - startX);
      const dy = Math.abs(e.clientY - startY);
      if (dx < 6 && dy < 6) return;
      if (dx <= dy) {
        // vertical intent: let the page scroll
        pointers.delete(e.pointerId);
        return;
      }
      decided = true;
      beginDrag(e);
    }
    const now = performance.now();
    const dt = Math.max(8, now - lastT) / 1000;
    const k = (Math.PI * 1.35) / Math.max(state.w, 240); // one swipe across the screen is about 240 degrees
    const dYaw = (e.clientX - lastX) * k;
    const dPitch = state.mode === 'free' ? (e.clientY - lastY) * k * 0.7 : 0;
    state.yaw += dYaw;
    state.pitch = clamp(state.pitch + dPitch, -0.12, 1.2);
    state.vyaw = state.vyaw * 0.35 + (dYaw / dt) * 0.65;
    state.vpitch = state.vpitch * 0.35 + (dPitch / dt) * 0.65;
    lastX = e.clientX;
    lastY = e.clientY;
    lastT = now;
    state.dirty = true;
  }
  function up(e) {
    pointers.delete(e.pointerId);
    if (pointers.size < 2) pinch = 0;
    if (pointers.size === 0 && state.dragging) {
      state.dragging = false;
      state.host?.classList.remove('is-dragging');
      if (performance.now() - lastT > 90) state.vyaw = state.vpitch = 0; // finger rested before lifting
      state.vyaw = clamp(state.vyaw, -14, 14);
      state.vpitch = clamp(state.vpitch, -6, 6);
      state.idleAt = performance.now();
      emit('drag', false);
    }
  }
  function wheel(e) {
    if (state.mode !== 'free') return;
    e.preventDefault();
    state.zoom = clamp(state.zoom * (e.deltaY > 0 ? 0.94 : 1.06), 0.7, 2.4);
    state.dirty = true;
  }
  function key_(e) {
    if (e.key === 'ArrowLeft') state.vyaw = -3;
    else if (e.key === 'ArrowRight') state.vyaw = 3;
    else return;
    state.idleAt = performance.now();
  }

  function bind(host) {
    host.addEventListener('pointerdown', down);
    host.addEventListener('pointermove', move);
    host.addEventListener('pointerup', up);
    host.addEventListener('pointercancel', up);
    host.addEventListener('wheel', wheel, { passive: false });
    host.addEventListener('keydown', key_);
  }
  function unbind(host) {
    host.removeEventListener('pointerdown', down);
    host.removeEventListener('pointermove', move);
    host.removeEventListener('pointerup', up);
    host.removeEventListener('pointercancel', up);
    host.removeEventListener('wheel', wheel);
    host.removeEventListener('keydown', key_);
  }

  let io = null;
  function mount(host, { mode = 'turntable' } = {}) {
    if (state.host === host) {
      setMode(mode);
      return api;
    }
    if (state.host) {
      unbind(state.host);
      ro?.unobserve(state.host);
      io?.disconnect();
      state.host.classList.remove('is-dragging');
    }
    pointers.clear();
    state.dragging = false;
    state.host = host;
    state.w = state.h = 0;
    host.appendChild(canvas);
    if (!host.hasAttribute('tabindex')) host.setAttribute('tabindex', '0');
    bind(host);
    ro?.observe(host);
    if ('IntersectionObserver' in window) {
      io = new IntersectionObserver((en) => {
        state.visible = en[0].isIntersecting;
        if (state.visible) {
          last = performance.now();
          state.dirty = true;
        }
      });
      io.observe(host);
    }
    setMode(mode);
    resize();
    return api;
  }

  function setMode(mode) {
    state.mode = mode;
    if (state.host) {
      state.host.style.touchAction = mode === 'free' ? 'none' : 'pan-y';
      state.host.style.cursor = 'grab';
    }
    if (mode === 'turntable') gsap.to(state, { zoom: 1, duration: 0.6, onUpdate: () => (state.dirty = true) });
  }

  async function show(handle, { wood, view, immediate = false } = {}) {
    const token = ++state.token;
    const mod = await loadModel(handle);
    if (token !== state.token) return null; // a newer request won
    const next = mod.build({ wood });
    if (wood) applyWood(next, wood);
    next.updateMatrixWorld(true);
    const box = new THREE.Box3().setFromObject(next);
    const sphere = box.getBoundingSphere(new THREE.Sphere());
    const prev = state.model;
    const v = { ...DEFAULT_VIEW, ...(mod.meta?.view || {}), ...(view || {}) };
    const still = immediate || reducedMotion();

    const swap = () => {
      if (prev) {
        holder.remove(prev);
        disposeModel(prev);
      }
      holder.add(next);
      state.model = next;
      state.handle = handle;
      state.height = box.max.y;
      state.radius = Math.max(sphere.radius, 0.04) * (mod.meta?.fit || 1);
      state.pitch = v.pitch;
      state.zoom = v.zoom;
      fitLights();
      state.dirty = true;
      emit('load', { handle, meta: mod.meta });
    };

    gsap.killTweensOf(holder.scale);
    gsap.killTweensOf(state, 'yaw');
    if (still) {
      swap();
      state.yaw = v.yaw;
      holder.scale.setScalar(1);
      state.dirty = true;
      return api;
    }
    const mark = () => (state.dirty = true);
    if (prev) {
      await gsap.to(holder.scale, { x: 0.001, y: 0.001, z: 0.001, duration: 0.28, ease: 'power2.in', onUpdate: mark });
      if (token !== state.token) {
        disposeModel(next);
        return null;
      }
    }
    swap();
    state.vyaw = 0;
    state.yaw = v.yaw - Math.PI * 1.1;
    holder.scale.setScalar(0.001);
    gsap.to(holder.scale, { x: 1, y: 1, z: 1, duration: 1.05, ease: 'wb.snap', onUpdate: mark });
    gsap.to(state, { yaw: v.yaw, duration: 1.35, ease: 'wb.out', onUpdate: mark, onComplete: () => (state.idleAt = performance.now()) });
    return api;
  }

  function setWood(species, { spin = true } = {}) {
    if (!state.model) return;
    if (!spin || reducedMotion()) {
      applyWood(state.model, species);
      state.dirty = true;
      return;
    }
    const from = state.yaw;
    state.vyaw = 0;
    gsap.killTweensOf(state, 'yaw');
    let swapped = false;
    gsap.to(state, {
      yaw: from + Math.PI * 2,
      duration: 0.95,
      ease: 'wb.inout',
      onUpdate() {
        if (!swapped && this.progress() > 0.42) {
          swapped = true;
          applyWood(state.model, species);
        }
        state.dirty = true;
      },
      onComplete: () => (state.idleAt = performance.now()),
    });
  }

  function setView({ yaw, pitch, zoom } = {}, { duration = 0.9 } = {}) {
    const to = {};
    if (yaw != null) to.yaw = yaw;
    if (pitch != null) to.pitch = pitch;
    if (zoom != null) to.zoom = zoom;
    state.vyaw = state.vpitch = 0;
    if (!duration) {
      Object.assign(state, to);
      state.dirty = true;
      return;
    }
    gsap.to(state, { ...to, duration, ease: 'wb.out', overwrite: 'auto', onUpdate: () => (state.dirty = true), onComplete: () => (state.idleAt = performance.now()) });
  }

  const api = {
    canvas,
    renderer,
    scene,
    camera,
    state,
    mount,
    setMode,
    show,
    setWood,
    setView,
    /** Give the turntable a flick, in radians per second. */
    nudge(v = 4) {
      state.vyaw = v;
      state.idleAt = performance.now();
    },
    setAuto(on) {
      state.auto = on && !reducedMotion();
      state.idleAt = performance.now();
    },
    render() {
      state.dirty = true;
      tick();
    },
    on(type, fn) {
      listeners[type]?.add(fn);
      return () => listeners[type]?.delete(fn);
    },
    dispose() {
      gsap.ticker.remove(tick);
      offTex();
      if (state.host) unbind(state.host);
      ro?.disconnect();
      io?.disconnect();
      if (state.model) disposeModel(state.model);
      pmrem.dispose();
      renderer.dispose();
      canvas.remove();
    },
  };
  return api;
}

// One shared stage for the whole page, created on first use so three.js stays out of the first paint.
let sharedStage = null;
export function getStage() {
  if (!sharedStage) sharedStage = createStage();
  return sharedStage;
}
