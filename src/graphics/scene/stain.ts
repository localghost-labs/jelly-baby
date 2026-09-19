import * as THREE from 'three/webgpu';
import { SVGLoader } from 'three/addons/loaders/SVGLoader.js';
import { vec3, uniform } from 'three/tsl';
import type { CausticReceivers } from '../optics/caustic-receivers.ts';
import type { FacilityShadows } from '../../facilities/shadows.ts';

const STAIN_URL=new URL('../../assets/smush-mark.svg',import.meta.url).href;

export type StainOptions={
  /** Metres across the stain. The baby is ~7 cm. */
  readonly width:number;
};

export type Stain={
  readonly group:THREE.Group;
  /** Where he landed. Set once; he walks away from it. */
  placeAt(x:number,z:number):void;
  setLighting(light:{windowFraction:number}):void;
  dispose():void;
};

/** A hair above the ground plane; the polygon offset keeps the two from fighting. */
const HEIGHT=.00005;
/** After the ground, before the character (renderOrder 1): his base always covers the ink. */
const RENDER_ORDER=.5;

/**
 * Smashbar's smush mark as a flat ink stain on the ground where the character
 * landed. It stays put; he can wander off it. Each fill in the SVG becomes one matte material in
 * that colour, and every shape is a ground receiver like the sweep, so his
 * shadow and caustic fall on the ink too.
 */
export async function loadStain(options:StainOptions,light:{windowFraction:number},facilities:FacilityShadows,caustics:CausticReceivers):Promise<Stain> {
  const data=await new SVGLoader().loadAsync(STAIN_URL);
  const glyph=new THREE.Group();
  const materials=new Map<string,THREE.MeshPhysicalNodeMaterial>();
  const geometries:THREE.BufferGeometry[]=[];
  const fraction=uniform(light.windowFraction);
  const bounds=new THREE.Box2();
  for(const path of data.paths) {
    const fill=String((path.userData?.style as {fill?:string}|undefined)?.fill??'#7f56d9');
    let material=materials.get(fill);
    if(!material) {
      // A decal: no depth of its own, so a squashed base that dips into the
      // plane is drawn over it instead of fighting with it.
      material=new THREE.MeshPhysicalNodeMaterial({color:fill,metalness:0,roughness:.55,clearcoat:.15,depthWrite:false,polygonOffset:true,polygonOffsetFactor:-2,polygonOffsetUnits:-2});
      materials.set(fill,material);
    }
    const tint=new THREE.Color(fill);
    for(const shape of path.toShapes()) {
      bounds.union(new THREE.Box2().setFromPoints(shape.getPoints(8)));
      const geometry=new THREE.ShapeGeometry(shape,12);geometries.push(geometry);
      const mesh=new THREE.Mesh(geometry,material);
      mesh.receiveCaustics=true;mesh.frustumCulled=false;mesh.renderOrder=RENDER_ORDER;
      caustics.registerGround(mesh,vec3(tint.r,tint.g,tint.b),facilities,fraction,HEIGHT);
      glyph.add(mesh);
    }
  }
  const size=new THREE.Vector2();bounds.getSize(size);
  const centre=new THREE.Vector2();bounds.getCenter(centre);
  const scale=options.width/size.x;
  // Centre the glyph, flip SVG's downward y, then lay it on the ground with
  // its top away from the camera so it reads upright from the default view.
  for(const mesh of glyph.children)mesh.position.set(-centre.x,-centre.y,0);
  glyph.scale.set(scale,-scale,scale);
  glyph.rotation.x=-Math.PI/2;
  const group=new THREE.Group();group.add(glyph);group.position.y=HEIGHT;
  return {
    group,
    placeAt(x,z){group.position.x=x;group.position.z=z;},
    setLighting(next){fraction.value=next.windowFraction;},
    dispose(){for(const geometry of geometries)geometry.dispose();for(const material of materials.values())material.dispose();group.removeFromParent();},
  };
}
