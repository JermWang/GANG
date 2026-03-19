// ================================================
// GANG CITY — Model Loader (GLB/GLTF/FBX with caching)
// ================================================
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { FBXLoader } from 'three/addons/loaders/FBXLoader.js';
import * as SkeletonUtils from 'three/addons/utils/SkeletonUtils.js';

const gltfLoader = new GLTFLoader();
const fbxLoader = new FBXLoader();
const cache = new Map(); // path → { scene, animations }

/**
 * Load a GLB/GLTF/FBX model. Returns { scene, animations }.
 * Results are cached so subsequent calls return the same data.
 */
export async function loadModel(path) {
  if (cache.has(path)) return cache.get(path);
  
  const ext = path.split('.').pop().toLowerCase();
  
  return new Promise((resolve, reject) => {
    if (ext === 'fbx') {
      // FBX loading
      fbxLoader.load(
        path,
        (fbx) => {
          const result = { scene: fbx, animations: fbx.animations || [] };
          cache.set(path, result);
          console.log(`Loaded FBX: ${path}`, {
            animations: result.animations.length,
            hasSkeleton: fbx.children.some(c => c.isSkinnedMesh || c.isBone)
          });
          resolve(result);
        },
        undefined,
        (err) => {
          console.error(`Failed to load FBX: ${path}`, err);
          reject(err);
        }
      );
    } else {
      // GLTF/GLB loading
      gltfLoader.load(
        path,
        (gltf) => {
          const result = { scene: gltf.scene, animations: gltf.animations };
          cache.set(path, result);
          resolve(result);
        },
        undefined,
        (err) => {
          console.error(`Failed to load model: ${path}`, err);
          reject(err);
        }
      );
    }
  });
}

/**
 * Clone a loaded model (properly handles skinned meshes).
 * Returns a new scene graph + fresh animation clips.
 */
export function cloneModel(cached) {
  const clonedScene = SkeletonUtils.clone(cached.scene);
  return {
    scene: clonedScene,
    animations: cached.animations, // clips can be shared
  };
}

/**
 * Setup an AnimationMixer on a model and build an actions map.
 * Returns { mixer, actions } where actions is a Map<name, AnimationAction>.
 */
export function setupAnimations(scene, animations) {
  const mixer = new THREE.AnimationMixer(scene);
  const actions = new Map();

  for (const clip of animations) {
    const action = mixer.clipAction(clip);
    actions.set(clip.name, action);
  }

  return { mixer, actions };
}

/**
 * Play a named animation, crossfading from whatever is currently playing.
 */
export function playAnimation(actions, name, currentAction, fadeDuration = 0.2) {
  const next = actions.get(name);
  if (!next || next === currentAction) return currentAction;

  next.reset().setEffectiveWeight(1);

  if (currentAction) {
    currentAction.crossFadeTo(next, fadeDuration, true);
  }

  next.play();
  return next;
}

/**
 * Measure a model's bounding box height.
 */
export function getModelHeight(scene) {
  const box = new THREE.Box3().setFromObject(scene);
  return box.max.y - box.min.y;
}
