// Materials for the 3D pieces. Wood albedo comes from textures cut out of her own product photos.
import * as THREE from 'three';
import { asset } from '../lib/media.js';
import { WOODS } from '../data/site.js';

const loader = new THREE.TextureLoader();
const cache = new Map();
let maxAniso = 4;
export const setMaxAnisotropy = (n) => {
  maxAniso = Math.min(8, n || 4);
};

/** Load (once) a texture from public/media/textures. Mirrored repeat hides tile seams in wood grain. */
export function texture(name) {
  if (cache.has(name)) return cache.get(name);
  const tex = loader.load(asset(`media/textures/${name}.webp`), () => {
    tex.needsUpdate = true;
    listeners.forEach((fn) => fn());
  });
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.wrapS = tex.wrapT = THREE.MirroredRepeatWrapping;
  tex.anisotropy = maxAniso;
  cache.set(name, tex);
  return tex;
}

// The stage subscribes so it can re-render when a texture finishes loading.
const listeners = new Set();
export const onTextureLoad = (fn) => {
  listeners.add(fn);
  return () => listeners.delete(fn);
};

const END_GRAIN = { walnut: 'endgrain', oak: 'endgrain-oak', maple: 'endgrain-oak' };

/**
 * Wood material for one species. `endGrain: true` uses the glued-block end-grain texture (cutting blocks).
 * Each call returns a fresh material so a piece can be re-skinned without touching others.
 */
export function woodMaterial(species = 'walnut', { endGrain = false, darken = 1 } = {}) {
  const w = WOODS[species] || WOODS.walnut;
  const map = texture(endGrain ? END_GRAIN[species] || 'endgrain' : w.tex);
  const mat = new THREE.MeshStandardMaterial({
    map,
    color: new THREE.Color(w.tint).multiplyScalar(darken),
    roughness: w.roughness,
    metalness: 0,
    bumpMap: map,
    bumpScale: species === 'ebonized' ? 1.6 : 0.5,
    envMapIntensity: 0.75,
  });
  mat.userData.species = species;
  mat.userData.endGrain = endGrain;
  mat.userData.darken = darken;
  return mat;
}

/** Re-skin an existing wood material to another species in place. */
export function setWoodMaterial(mat, species) {
  const w = WOODS[species] || WOODS.walnut;
  const map = texture(mat.userData.endGrain ? END_GRAIN[species] || 'endgrain' : w.tex);
  mat.map = map;
  mat.bumpMap = map;
  mat.bumpScale = species === 'ebonized' ? 1.6 : 0.5;
  mat.color.set(w.tint).multiplyScalar(mat.userData.darken || 1);
  mat.roughness = w.roughness;
  mat.userData.species = species;
  mat.needsUpdate = true;
}

const shared = {};
const once = (key, make) => (shared[key] ||= make());

/** Solid brass: inlays, splines, feet, hooks, coasters. */
export const brass = () => once('brass', () => new THREE.MeshStandardMaterial({ color: 0xd9ae55, metalness: 1, roughness: 0.24, envMapIntensity: 1.25 }));
/** Brushed brass with a softer highlight (large flat coasters). */
export const brassBrushed = () => once('brassBrushed', () => new THREE.MeshStandardMaterial({ color: 0xd2a650, metalness: 1, roughness: 0.42, envMapIntensity: 1.1 }));
/** Mirror glass. */
export const mirror = () => once('mirror', () => new THREE.MeshStandardMaterial({ color: 0xf2f4f5, metalness: 1, roughness: 0.04, envMapIntensity: 1.35 }));
/** Matte white enamel (tea tins) or any flat painted colour. */
export const enamel = (color = 0xf1eeea) => new THREE.MeshStandardMaterial({ color, metalness: 0.05, roughness: 0.38, envMapIntensity: 0.8 });
/** Soft matte paper (towel roll, coffee filters). */
export const paper = (color = 0xf6f3ee) => new THREE.MeshStandardMaterial({ color, metalness: 0, roughness: 0.95, envMapIntensity: 0.35 });
/** Dark recess: carved slots and finger holes read as shadow. */
export const recess = () => once('recess', () => new THREE.MeshStandardMaterial({ color: 0x140d09, metalness: 0, roughness: 1, envMapIntensity: 0.1 }));
/** Clear glass (wine glass). */
export const glass = () =>
  once('glass', () => new THREE.MeshPhysicalMaterial({ color: 0xffffff, metalness: 0, roughness: 0.03, transmission: 0.96, thickness: 0.002, ior: 1.5, transparent: true, opacity: 0.4, envMapIntensity: 1.4 }));

/** A flat picture (painted crane, engraving) laid over a surface. `name` is a file in public/media/textures. */
export function decal(name, { transparent = true, roughness = 0.7 } = {}) {
  const tex = texture(name);
  tex.wrapS = tex.wrapT = THREE.ClampToEdgeWrapping;
  return new THREE.MeshStandardMaterial({ map: tex, transparent, roughness, metalness: 0, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2, envMapIntensity: 0.6 });
}
