import * as THREE from 'three/webgpu';
import { vec3, uniform } from 'three/tsl';
import type { RefractiveLightField } from '../optics/refractive-light.js';
import type { CausticReceivers } from '../optics/caustic-receivers.ts';
import type { FacilityShadows } from '../../facilities/shadows.ts';

/** What the runtime needs from whichever ground the scene stands on — the timber table or a sweep. */
export type GroundSurface={mesh:THREE.Mesh;setLighting(light:{windowFraction:number}):void;dispose():void};

/**
 * A photographer's sweep: the same 200 m receiver plane as the table, but a flat
 * matte colour instead of timber. With `scene.background` and the fog set to the
 * SAME colour the horizon disappears and the ground reads as a seamless
 * cyclorama. Caustics and facility shadows still land on it through the shared
 * receiver path. No textures, so a scene that stands on it never fetches the
 * wood.
 */
export function makeSweep(_optics:RefractiveLightField,light:{color:THREE.Color;windowFraction:number;irradiance:number},facilities:FacilityShadows,caustics:CausticReceivers,color:string):GroundSurface {
  const fraction=uniform(light.windowFraction);
  const tint=new THREE.Color(color);
  const albedo=vec3(tint.r,tint.g,tint.b);
  const material=new THREE.MeshPhysicalNodeMaterial({color,metalness:0,roughness:.72,clearcoat:0});
  const mesh=new THREE.Mesh(new THREE.PlaneGeometry(200,200),material);
  mesh.rotation.x=-Math.PI/2;mesh.position.y=-.00005;mesh.receiveCaustics=true;
  caustics.registerGround(mesh,albedo,facilities,fraction);
  return {mesh,setLighting:(light:{windowFraction:number})=>{fraction.value=light.windowFraction;},dispose:()=>{mesh.geometry.dispose();material.dispose();}};
}
