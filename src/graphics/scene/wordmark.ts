import * as THREE from 'three/webgpu';
import { SVGLoader } from 'three/addons/loaders/SVGLoader.js';

const WORDMARK_URL=new URL('../../assets/smashbar-wordmark.svg',import.meta.url).href;

/** Paths starting right of this SVG x belong to the splat glyph, not the letters. */
const SPLAT_MIN_X=135;

export type WordmarkOptions={
  /** Metres across the letters. */
  readonly width:number;
  readonly depth:number;
  readonly color:string;
  /** Metres along -Z from the origin: how far behind the character the letters stand. */
  readonly offsetZ:number;
};

export type Wordmark={
  readonly group:THREE.Group;
  /** Where the splat glyph sat, relative to the group — the character stands in for it. */
  readonly splat:THREE.Vector3;
  dispose():void;
};

/**
 * The Smashbar wordmark, extruded from the client's own SVG and stood up on the
 * ground behind the character. World units are metres (the baby is ~7 cm), so
 * the SVG's 170-unit width is scaled to `width`. Lit by the studio environment
 * like everything else. The splat glyph is measured but not built: the jelly in
 * front of the letters is the splat, come alive.
 */
export async function loadWordmark(options:WordmarkOptions):Promise<Wordmark> {
  const data=await new SVGLoader().loadAsync(WORDMARK_URL);
  const group=new THREE.Group();
  const material=new THREE.MeshPhysicalNodeMaterial({color:options.color,metalness:0,roughness:.42,clearcoat:.25,clearcoatRoughness:.3});
  const geometries:THREE.BufferGeometry[]=[];
  const scale=options.width/170;
  const splatBounds=new THREE.Box2();
  for(const path of data.paths) {
    for(const shape of path.toShapes()) {
      const bounds=new THREE.Box2().setFromPoints(shape.getPoints(8));
      if(bounds.min.x>SPLAT_MIN_X){splatBounds.union(bounds);continue;}
      const geometry=new THREE.ExtrudeGeometry(shape,{depth:options.depth/scale,bevelEnabled:true,bevelThickness:.35,bevelSize:.3,bevelSegments:3,curveSegments:10});
      geometries.push(geometry);group.add(new THREE.Mesh(geometry,material));
    }
  }
  // SVG y grows downward; flip and scale into metres, then rest the letters on the ground, centred.
  group.scale.set(scale,-scale,scale);
  const box=new THREE.Box3().setFromObject(group);
  const size=new THREE.Vector3();box.getSize(size);
  group.position.x=-(box.min.x+size.x/2);
  group.position.y=-box.min.y;
  group.position.z=-(box.min.z+size.z/2)+options.offsetZ;
  const splatCentre=new THREE.Vector2();splatBounds.getCenter(splatCentre);
  const splat=new THREE.Vector3(splatCentre.x*scale,0,0);
  return {group,splat,dispose:()=>{for(const geometry of geometries)geometry.dispose();material.dispose();group.removeFromParent();}};
}
