import * as THREE from 'three/webgpu';
import { STUDIO_ENVIRONMENT } from './studio-environment.generated.ts';

export type BakedEnvironmentMetadata={
  readonly width:number;
  readonly height:number;
  readonly incoming:readonly [number,number,number];
  readonly color:readonly [number,number,number];
  readonly sourceSpread:readonly [number,number,number];
  readonly windowFraction:number;
  readonly irradiance:number;
};

export type BakedEnvironmentOptions={
  /** `scene.environmentIntensity` once applied. The studio's .9 is the reference the irradiance was measured at. */
  readonly intensity:number;
  /** Apply to the scene as soon as it is ready (the day map) or hold until `apply()` (the night map). */
  readonly applyNow:boolean;
};

async function fetchBakedEnvironment(url:URL,metadata:BakedEnvironmentMetadata,label:string) {
  const response=await fetch(url);
  if(!response.ok)throw new Error(`Could not load the ${label} environment (${response.status})`);
  const bytes=await response.arrayBuffer(),expected=metadata.width*metadata.height*4*2;
  if(bytes.byteLength!==expected)throw new Error(`${label} environment has ${bytes.byteLength} bytes; expected ${expected}`);
  const source=new THREE.DataTexture(new Uint16Array(bytes),metadata.width,metadata.height,THREE.RGBAFormat,THREE.HalfFloatType);
  source.minFilter=source.magFilter=THREE.LinearFilter;source.generateMipmaps=false;source.flipY=false;source.needsUpdate=true;
  return {
    source,
    lighting:{
      incoming:new THREE.Vector3(...metadata.incoming),
      color:new THREE.Color().setRGB(...metadata.color,THREE.LinearSRGBColorSpace),
      sourceSpread:new THREE.Vector3(...metadata.sourceSpread),
      windowFraction:metadata.windowFraction,irradiance:metadata.irradiance,
    },
  };
}

/**
 * One prebaked RGBA16F equirectangular map, PMREM-filtered for the scene. Each
 * map's URL lives in its own module (this one for the studio, night-environment.ts
 * for night) so a scene that never switches lighting never references the night
 * bytes — the bundler then keeps them out of that scene's transfer.
 */
export async function loadBakedEnvironment(renderer:THREE.WebGPURenderer,scene:THREE.Scene,url:URL,metadata:BakedEnvironmentMetadata,label:string,options:BakedEnvironmentOptions) {
  const {source,lighting}=await fetchBakedEnvironment(url,metadata,label);
  source.mapping=THREE.EquirectangularReflectionMapping;
  source.colorSpace=THREE.LinearSRGBColorSpace;
  const {intensity}=options;
  lighting.irradiance*=intensity/.9;
  const pmrem=new THREE.PMREMGenerator(renderer);
  const target=pmrem.fromEquirectangular(source);pmrem.dispose();
  const apply=()=>{scene.environment=target.texture;scene.environmentIntensity=intensity;};
  if(options.applyNow)apply();
  return {...lighting,intensity,reflectionTexture:source,apply,dispose:()=>{target.dispose();source.dispose();}};
}

export type Environment=Awaited<ReturnType<typeof loadBakedEnvironment>>;

/** The studio (day) map, applied to the scene as soon as it is ready. */
export function loadEnvironment(renderer:THREE.WebGPURenderer,scene:THREE.Scene) {
  return loadBakedEnvironment(renderer,scene,new URL('../../assets/bg_room_studio.rgba16f',import.meta.url),STUDIO_ENVIRONMENT,'studio',{intensity:.9,applyNow:true});
}
