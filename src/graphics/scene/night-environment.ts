import type * as THREE from 'three/webgpu';
import { loadBakedEnvironment } from './environment.ts';
import { NIGHT_ENVIRONMENT } from './night-environment.generated.ts';

/**
 * The night map, held until the lighting switch applies it. Kept apart from the
 * day map on purpose: only the lighting-mode chunk imports this module, so a
 * scene without the switch never fetches the night bytes.
 */
export function loadNightEnvironment(renderer:THREE.WebGPURenderer,scene:THREE.Scene) {
  return loadBakedEnvironment(renderer,scene,new URL('../../assets/night.rgba16f',import.meta.url),NIGHT_ENVIRONMENT,'night',{intensity:.45,applyNow:false});
}
