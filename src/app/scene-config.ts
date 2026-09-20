import { DEFAULT_JELLY_FLAVOR, type JellyFlavorName } from '../graphics/character/jelly-flavors.ts';
import type { IdleHopConfig } from './idle-hop.ts';
import { ORBIT_MAX_DISTANCE } from './input.ts';

/** Where this fork's source lives. The embed's `source` link and the README point here. */
export const SOURCE_URL='https://github.com/localghost-labs/jelly-baby';

export type GroundConfig=
  |{readonly kind:'table'}
  /**
   * A flat lit plane in one colour, exposed by the composite instead of tone
   * mapped (so white is white); with the backdrop set to the same colour the
   * horizon disappears. `shadow` (0–1) is how deep his shadow darkens it;
   * absent, the light's own window fraction.
   */
  |{readonly kind:'sweep';readonly color:string;readonly shadow?:number};

export type WordmarkConfig={
  /** Metres across the letters. The baby is ~7 cm. */
  readonly width:number;
  readonly depth:number;
  readonly color:string;
  /** Metres along -Z from the spawn: how far behind the character the letters stand. */
  readonly offsetZ:number;
};

export type StainConfig={
  /** Metres across the (square) mark; slightly wider than the character's footprint. */
  readonly width:number;
};

export type ChromeConfig={
  readonly masthead:boolean;
  readonly reset:boolean;
  readonly flavorPicker:boolean;
  readonly lightingMode:boolean;
  readonly mute:boolean;
  readonly keyboardHints:boolean;
  readonly touchControls:boolean;
  /** A link to {@link SOURCE_URL} beside the keyboard hints. */
  readonly sourceLink:boolean;
};

/**
 * Everything that differs between the playroom and the Smashbar backdrop, in
 * one object. The runtime reads this and constructs only what it names; nothing
 * upstream is deleted or hidden to get the embed's behaviour. A build carries
 * both — `?embed=1` selects at runtime.
 */
export type SceneConfig={
  readonly mode:'full'|'embed';
  readonly flavor:JellyFlavorName;
  /** `scene.background` and fog colour. */
  readonly backdrop:string;
  readonly ground:GroundConfig;
  /** Swing, trampoline, bed and dressing table in the home world. */
  readonly playroom:boolean;
  /** The home portal, and with it the tricycle and soccer worlds. */
  readonly portal:boolean;
  readonly wordmark:WordmarkConfig|null;
  /** The smush mark, flat on the ground where the character landed; it stays put as he wanders. */
  readonly stain:StainConfig|null;
  /** Hop on a timer until the first interaction; null means the toy waits to be moved. */
  readonly idleHop:IdleHopConfig|null;
  /** Metres from the character to start the camera at; null keeps the playroom's opening framing. */
  readonly cameraDistance:number|null;
  readonly chrome:ChromeConfig;
  /** Post `jelly:ready` / `jelly:failed` to the embedding window. */
  readonly lifecycleMessages:boolean;
  /** Stop the animation loop while the document is hidden instead of only skipping simulation. */
  readonly pauseWhenHidden:boolean;
  /** Shift the camera further down on viewports under 700 px (the phone framing). */
  readonly narrowViewportOffset:boolean;
  readonly canvasLabel:string;
  /** Offline rendering: no animation loop; a driver steps the scene through `window.__jellyCapture` (src/app/capture.ts). */
  readonly capture:boolean;
};

export const FULL_SCENE:SceneConfig={
  mode:'full',
  flavor:DEFAULT_JELLY_FLAVOR,
  backdrop:'#e8d9c3',
  ground:{kind:'table'},
  playroom:true,
  portal:true,
  wordmark:null,
  stain:null,
  idleHop:null,
  cameraDistance:null,
  chrome:{masthead:true,reset:true,flavorPicker:true,lightingMode:true,mute:true,keyboardHints:true,touchControls:true,sourceLink:false},
  lifecycleMessages:false,
  pauseWhenHidden:false,
  narrowViewportOffset:true,
  capture:false,
  canvasLabel:'Jelly baby. Use the touch joystick or WASD to walk, Space to jump. Press E or use the Play button near a facility; use the same action to get off. Drag the baby to stretch; drag the table to orbit.',
};

/**
 * The sweep, the backdrop and the loading card share one colour: pure white.
 * The sweep is unlit and untonemapped, so this is what reaches the screen
 * (Dustin, 2026-09-20; earlier a lit sweep needed a blue lean to fight the
 * warm HDR and still landed on grey).
 */
const SMASHBAR_SWEEP='#ffffff';

/**
 * The Smashbar auth-page backdrop: grape jelly alone on a white sweep, no
 * playroom, no worlds, only the mute button and the keyboard hints for chrome. Desktop only by the embedder's choice, so no touch controls.
 */
export const EMBED_SCENE:SceneConfig={
  mode:'embed',
  flavor:'grape',
  backdrop:SMASHBAR_SWEEP,
  // Shadow eased off: the floor no longer goes through the tone curve whose
  // shoulder used to soften it (Dustin, 2026-09-20).
  ground:{kind:'sweep',color:SMASHBAR_SWEEP,shadow:.55},
  playroom:false,
  portal:false,
  // No wordmark (Dustin, 2026-09-19): the jelly alone on the sweep. The
  // extruded letters are still a config away — see src/graphics/scene/wordmark.ts.
  wordmark:null,
  // The smush mark as ink under him, a little wider than he is (Dustin, 2026-09-19).
  stain:{width:.13},
  // A beat of life beside the form: a hop every three seconds until the
  // visitor takes over (Dustin, 2026-09-19).
  idleHop:{intervalSeconds:3},
  // Open as far back as the wheel can take it (Dustin, 2026-09-19).
  cameraDistance:ORBIT_MAX_DISTANCE,
  // No keyboard hints and, for now, no source link either: Dustin is approving
  // the design bare (2026-09-19) and will bring the link back. Until then the
  // offer of source is the README and the repository; restore `sourceLink:true`
  // before this is treated as final (ADR-0073 wants it visible in the toy).
  chrome:{masthead:false,reset:false,flavorPicker:false,lightingMode:false,mute:true,keyboardHints:false,touchControls:false,sourceLink:false},
  lifecycleMessages:true,
  pauseWhenHidden:true,
  // The embedder's panel is a portrait column that can be narrower than 700 px
  // on a small laptop. Its poster was captured with the desktop framing; the
  // live scene must keep it so the cross-fade does not read as a jump.
  narrowViewportOffset:false,
  capture:false,
  canvasLabel:'Smashbar jelly. Click the scene, then use WASD or the arrow keys to wander and Space to hop. Drag the jelly to stretch it; drag the ground to orbit.',
};

/**
 * The Smashbar scene rendered offline for the landing page's video loops: the
 * same look, but nothing moves on its own, nothing announces itself and there
 * is no chrome in the way of the canvas.
 */
export const CAPTURE_SCENE:SceneConfig={
  ...EMBED_SCENE,
  // Close for the landing hero, but far enough that his shadow's tip stays in
  // frame (Dustin, 2026-09-20; half the orbit max clipped it). The live embed
  // keeps its wide framing.
  cameraDistance:.32,
  idleHop:null,
  lifecycleMessages:false,
  pauseWhenHidden:false,
  chrome:{...EMBED_SCENE.chrome,mute:false},
  capture:true,
};

/** `?embed=1` selects the Smashbar backdrop; anything else is the playroom. */
export function isEmbedSearch(search:string) {
  return new URLSearchParams(search).get('embed')==='1';
}

export function resolveSceneConfig(search:string=location.search):SceneConfig {
  if(!isEmbedSearch(search))return FULL_SCENE;
  return new URLSearchParams(search).get('capture')==='1'?CAPTURE_SCENE:EMBED_SCENE;
}
