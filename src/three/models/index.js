// Lazy registry of product models. Each file in this folder is named after the product handle and exports:
//   export const meta = { handle, view: { yaw, pitch, zoom }, fit: 1 };   // view and fit are optional
//   export function build({ wood }) { ... return THREE.Group seated on y = 0 }
const modules = import.meta.glob(['./*.js', '!./index.js']);

export const modelHandles = Object.keys(modules).map((p) => p.slice(2, -3));
export const hasModel = (handle) => `./${handle}.js` in modules;

export async function loadModel(handle) {
  const load = modules[`./${handle}.js`];
  if (!load) throw new Error(`No 3D model for "${handle}"`);
  return load();
}
