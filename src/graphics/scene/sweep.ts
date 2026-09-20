import * as THREE from 'three/webgpu';
import { float, mix, positionWorld, texture, uniform, vec2, vec3 } from 'three/tsl';
import { GROUND_ALPHA } from './composite.ts';
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
 * one receiver, nothing to fight with, and his shadow falls on the ink for the
 * same reason it falls on the sweep.
 *
 * The sweep is UNLIT and flagged for the composite (alpha = GROUND_ALPHA), which
 * passes it through without tone mapping: its colour is exactly the albedo times
 * the receiver's shadow darkening, so a white sweep is white on screen, not the
 * 84 % grey a lit white lands on under AgX. The character still refracts it —
 * the transmission pass samples the ground's colour, and unlit white sits where
 * the lit sweep did in linear terms.
 */
export function makeSweep(_optics:RefractiveLightField,light:{color:THREE.Color;windowFraction:number;irradiance:number},facilities:FacilityShadows,caustics:CausticReceivers,color:string,stain?:SweepStain):GroundSurface {
  const fraction=uniform(light.windowFraction);
  const tint=new THREE.Color(color);
  const sweep=vec3(tint.r,tint.g,tint.b);
  const stainCentre=uniform(new THREE.Vector2(0,0));
  // Image top faces -Z (away from the default camera) so the mark reads upright.
  const stainUv=positionWorld.xz.sub(stainCentre).div(stain?.width??1).mul(vec2(1,-1)).add(.5);
  const ink=stain?texture(stain.map,stainUv):undefined;
  const albedo=ink?mix(sweep,ink.rgb,ink.a):sweep;
  // NoBlending (not transparent, so still in the opaque pass the character
  // refracts) is what lets an opaque material write an alpha other than 1.
  const material=new THREE.MeshBasicNodeMaterial({color,blending:THREE.NoBlending});
  material.opacityNode=float(GROUND_ALPHA);
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
