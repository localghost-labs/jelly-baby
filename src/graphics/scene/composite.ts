import { NoToneMapping, RenderPipeline } from 'three/webgpu';
import type { WebGPURenderer, Scene, PerspectiveCamera } from 'three/webgpu';
import { float, mix, pass, renderOutput, screenUV, vec3, vec4 } from 'three/tsl';
import { bloom } from 'three/addons/tsl/display/BloomNode.js';

/**
 * The alpha a ground material writes to flag its pixels for the composite.
 * Everything else in the scene is opaque (alpha 1), so the flag survives the
 * scene pass and reads back cleanly; an MSAA edge between the two blends.
 */
export const GROUND_ALPHA=.5;

/**
 * Linear HDR scene → restrained lens glow → filmic contrast grade → one AgX/output
 * transform. Pixels flagged as ground (see GROUND_ALPHA) skip the grade and the
 * tone mapping: their colour is taken as-is and only converted to the output
 * colour space, so an unlit white sweep is white on screen and its shadow is
 * the receiver's plain darkening. The playroom's table is lit and unflagged,
 * so it takes the full transform as before.
 */
export function createComposite(renderer:WebGPURenderer,scene:Scene,camera:PerspectiveCamera,bloomResolutionScale=.5) {
  const scenePass=pass(scene,camera);
  const color=scenePass.getTextureNode('output');
  const glow=bloom(color,.075,.18,1.6);
  glow.setResolutionScale(bloomResolutionScale);
  const vignette=screenUV.sub(.5).length().smoothstep(.24,.73).mul(.065);
  const balanced=color.rgb.add(glow.rgb).mul(vec3(.985,1.01,1.015));
  // High-contrast filmic pre-grade around linear 18% gray. Keep highlights HDR for AgX.
  const contrasted=balanced.sub(.18).mul(1.03).add(.18).max(0);
  const graded=contrasted.mul(float(1).sub(vignette));
  const groundness=float(1).sub(color.a).div(1-GROUND_ALPHA).clamp(0,1);
  const sceneOut=renderOutput(vec4(graded,1));
  const groundOut=renderOutput(vec4(color.rgb,1),NoToneMapping);
  const pipeline=new RenderPipeline(renderer,mix(sceneOut,groundOut,groundness));
  pipeline.outputColorTransform=false;
  return {render:()=>pipeline.render(),dispose:()=>{glow.dispose();scenePass.dispose();pipeline.dispose();}};
}
