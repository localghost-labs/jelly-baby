import * as THREE from 'three/webgpu';
import type { Baby } from '../graphics/character/baby.ts';

export type CaptureDependencies={
  readonly renderer:THREE.WebGPURenderer;
  readonly scene:THREE.Scene;
  readonly camera:THREE.PerspectiveCamera;
  readonly baby:Baby;
  readonly composite:{render():void};
  /** One fixed simulation step plus every per-frame scene update, optical refresh awaited. */
  readonly advance:(dt:number)=>Promise<void>;
};

/**
 * The offline renderer's handle on the toy. Each `step` advances the world by
 * a fixed slice and draws the normal frame; the two matte passes redraw the
 * SAME state so a compositor can cut the character out exactly and keep the
 * ground shadow as its own layer. `grab` hands back the canvas as PNG.
 */
export type JellyCapture={
  step(dt?:number):Promise<{blink:number}>;
  /** The character flat white on black, nothing else. */
  silhouette():Promise<void>;
  /** The scene without post-processing, the character flat black: what remains is the ground and its shadow. */
  shadowPlate():Promise<void>;
  grab():Promise<string>;
};

declare global {
  interface Window { __jellyCapture?:JellyCapture }
}

/**
 * Capture mode (`?embed=1&capture=1`): the animation loop does not run; a
 * driver (Smashbar's render script, through Playwright) steps the scene one
 * frame at a time and reads the canvas back after each draw. Deterministic
 * in time, not in expression — blinks are still the character's own.
 */
export function installCapture(d:CaptureDependencies) {
  // Two animation frames: the drawn texture has been presented and the canvas
  // image is what the last render produced before anything reads it back.
  const presented=()=>new Promise<void>(resolve=>requestAnimationFrame(()=>requestAnimationFrame(()=>resolve())));
  const white=new THREE.MeshBasicNodeMaterial({color:'#ffffff',toneMapped:false});
  const black=new THREE.MeshBasicNodeMaterial({color:'#000000',toneMapped:false});
  const matteScene=new THREE.Scene();matteScene.background=new THREE.Color('#000000');
  const swapMaterials=(material:THREE.Material)=>{
    const saved=new Map<THREE.Mesh,THREE.Material|THREE.Material[]>();
    d.baby.group.traverse(object=>{if(object instanceof THREE.Mesh){saved.set(object,object.material);object.material=material;}});
    return ()=>{for(const [mesh,original] of saved)mesh.material=original;};
  };
  // The mattes are data, not pictures: no tone mapping, so white is 255 and a
  // shadow's darkening is linear. (`toneMapped` on the material is not enough —
  // the renderer applies its curve in the output pass regardless.)
  const matteRender=async(scene:THREE.Scene)=>{
    const toneMapping=d.renderer.toneMapping;
    d.renderer.toneMapping=THREE.NoToneMapping;
    try {d.renderer.render(scene,d.camera);await presented();}
    finally {d.renderer.toneMapping=toneMapping;}
  };
  const grab=()=>new Promise<string>((resolve,reject)=>{
    d.renderer.domElement.toBlob(blob=>{
      if(!blob){reject(new Error('The canvas gave no image'));return;}
      const reader=new FileReader();
      reader.onload=()=>resolve((reader.result as string).split(',')[1]);
      reader.onerror=()=>reject(reader.error);
      reader.readAsDataURL(blob);
    },'image/png');
  });
  window.__jellyCapture={
    async step(dt=1/30) {
      await d.advance(dt);d.composite.render();await presented();
      return {blink:d.baby.blink};
    },
    async silhouette() {
      const restore=swapMaterials(white);
      matteScene.add(d.baby.group);
      try {await matteRender(matteScene);}
      finally {d.scene.add(d.baby.group);restore();}
    },
    async shadowPlate() {
      const restore=swapMaterials(black);
      try {await matteRender(d.scene);}
      finally {restore();}
    },
    grab,
  };
}
