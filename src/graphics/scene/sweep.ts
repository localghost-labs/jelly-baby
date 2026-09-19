import * as THREE from 'three/webgpu';
import { mix, positionWorld, texture, uniform, vec2, vec3 } from 'three/tsl';
import type { RefractiveLightField } from '../optics/refractive-light.js';
import type { CausticReceivers } from '../optics/caustic-receivers.ts';
import type { FacilityShadows } from '../../facilities/shadows.ts';

/** What the runtime needs from whichever ground the scene stands on — the timber table or a sweep. */
export type GroundSurface={
  mesh:THREE.Mesh;
  setLighting(light:{windowFraction:number}):void;
  dispose():void;
  /** Sweep only: where the ink stain sits, in world metres. */
  placeStainAt?(x:number,z:number):void;
  /** Sweep only: the ground drawn as its ink's alpha, white on black, for an offline cutout. */
  stainSilhouette?:THREE.Material;
};

export type SweepStain={
  /** RGBA, the mark on a transparent border; sampled clamped, so the border is what lies outside. */
  readonly map:THREE.Texture;
  /** Metres across the (square) map. */
  readonly width:number;
};

const STAIN_URL=new URL('../../assets/smush-mark.png',import.meta.url).href;

export async function loadStainTexture():Promise<THREE.Texture> {
  const map=await new THREE.TextureLoader().loadAsync(STAIN_URL);
  map.colorSpace=THREE.SRGBColorSpace;map.wrapS=map.wrapT=THREE.ClampToEdgeWrapping;map.anisotropy=8;
  return map;
}

/**
 * A photographer's sweep: the same 200 m receiver plane as the table, but a flat
 * matte colour instead of timber. With `scene.background` and the fog set to the
 * SAME colour the horizon disappears and the ground reads as a seamless
 * cyclorama. Caustics and facility shadows still land on it through the shared
 * receiver path. No textures, so a scene that stands on it never fetches the
 * wood.
 *
 * `stain` paints the smush mark INTO the ground's albedo, in world space, at a
 * point set later (`placeStainAt`). It is the floor, not a decal on the floor:
 * one receiver, nothing to fight with, and his shadow and caustic fall on the
 * ink for the same reason they fall on the sweep.
 */
export function makeSweep(_optics:RefractiveLightField,light:{color:THREE.Color;windowFraction:number;irradiance:number},facilities:FacilityShadows,caustics:CausticReceivers,color:string,lift=0,stain?:SweepStain):GroundSurface {
  const fraction=uniform(light.windowFraction);
  const tint=new THREE.Color(color);
  const sweep=vec3(tint.r,tint.g,tint.b);
  const stainCentre=uniform(new THREE.Vector2(0,0));
  // Image top faces -Z (away from the default camera) so the mark reads upright.
  const stainUv=positionWorld.xz.sub(stainCentre).div(stain?.width??1).mul(vec2(1,-1)).add(.5);
  const ink=stain?texture(stain.map,stainUv):undefined;
  const albedo=ink?mix(sweep,ink.rgb,ink.a):sweep;
  const material=new THREE.MeshPhysicalNodeMaterial({color,metalness:0,roughness:.72,clearcoat:0});
  // `lift` re-adds the sweep colour as emission so a bright cyclorama reads as
  // bright after tonemapping; shadows and caustics still modulate the lit term.
  // It must be the NODE: the caustic receiver extends `emissiveNode`, and a
  // node there supersedes the plain `emissive` property entirely.
  if(lift>0)material.emissiveNode=albedo.mul(lift);
  const mesh=new THREE.Mesh(new THREE.PlaneGeometry(200,200),material);
  mesh.rotation.x=-Math.PI/2;mesh.position.y=-.00005;mesh.receiveCaustics=true;
  caustics.registerGround(mesh,albedo,facilities,fraction);
  let stainSilhouette:THREE.MeshBasicNodeMaterial|undefined;
  if(ink){stainSilhouette=new THREE.MeshBasicNodeMaterial({toneMapped:false});stainSilhouette.colorNode=vec3(ink.a);}
  return {
    mesh,
    setLighting:(light:{windowFraction:number})=>{fraction.value=light.windowFraction;},
    dispose:()=>{mesh.geometry.dispose();material.dispose();stainSilhouette?.dispose();stain?.map.dispose();},
    placeStainAt:stain?(x,z)=>{stainCentre.value.set(x,z);}:undefined,
    stainSilhouette,
  };
}
