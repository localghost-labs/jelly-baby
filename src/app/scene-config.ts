import { DEFAULT_JELLY_FLAVOR, type JellyFlavorName } from '../graphics/character/jelly-flavors.ts';
import type { IdleHopConfig } from './idle-hop.ts';
import { ORBIT_MAX_DISTANCE } from './input.ts';

/** Where this fork's source lives. The embed's `source` link and the README point here. */
export const SOURCE_URL='https://github.com/localghost-labs/jelly-baby';

export type GroundConfig=
  |{readonly kind:'table'}
  /**
   * A flat matte plane in one colour; with the backdrop set to the same colour
   * the horizon disappears. `lift` adds the colour back as emission (0–1): a lit
   * white plane tonemaps to light grey, and this is what makes it read white.
   */
  |{readonly kind:'sweep';readonly color:string;readonly lift?:number};

export type WordmarkConfig={
  /** Metres across the letters. The baby is ~7 cm. */
  readonly width:number;
  readonly depth:number;
  readonly color:string;
  /** Metres along -Z from the spawn: how far behind the character the letters stand. */
  readonly offsetZ:number;
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
};

export const FULL_SCENE:SceneConfig={
  mode:'full',
  flavor:DEFAULT_JELLY_FLAVOR,
  backdrop:'#e8d9c3',
  ground:{kind:'table'},
  playroom:true,
  portal:true,
  wordmark:null,
  idleHop:null,
  cameraDistance:null,
  chrome:{masthead:true,reset:true,flavorPicker:true,lightingMode:true,mute:true,keyboardHints:true,touchControls:true,sourceLink:false},
  lifecycleMessages:false,
  pauseWhenHidden:false,
  narrowViewportOffset:true,
  canvasLabel:'Jelly baby. Use the touch joystick or WASD to walk, Space to jump. Press E or use the Play button near a facility; use the same action to get off. Drag the baby to stretch; drag the table to orbit.',
};

/**
 * The sweep, the backdrop and the loading card share one colour: a white
 * cyclorama, leaning blue so it reads as daylight under the warm studio HDR
 * (Dustin, 2026-09-19; was pure white, before that brand lavender #e9d7fe).
 */
const SMASHBAR_SWEEP='#eef3ff';

/**
 * The Smashbar auth-page backdrop: grape jelly alone on a white sweep, no
 * playroom, no worlds, only the mute button and the keyboard hints for chrome. Desktop only by the embedder's choice, so no touch controls.
 */
export const EMBED_SCENE:SceneConfig={
  mode:'embed',
  flavor:'grape',
  backdrop:SMASHBAR_SWEEP,
  ground:{kind:'sweep',color:SMASHBAR_SWEEP},
  playroom:false,
  portal:false,
  // No wordmark (Dustin, 2026-09-19): the jelly alone on the sweep. The
  // extruded letters are still a config away — see src/graphics/scene/wordmark.ts.
  wordmark:null,
  // A beat of life beside the form: a hop every three seconds until the
  // visitor takes over (Dustin, 2026-09-19).
  idleHop:{intervalSeconds:3},
  // Open as far back as the wheel can take it (Dustin, 2026-09-19).
  cameraDistance:ORBIT_MAX_DISTANCE,
  // No keyboard hints (Dustin, 2026-09-19): the idle hop is the invitation. The
  // source link moves up beside the mute button so the offer of source stays visible.
  chrome:{masthead:false,reset:false,flavorPicker:false,lightingMode:false,mute:true,keyboardHints:false,touchControls:false,sourceLink:true},
  lifecycleMessages:true,
  pauseWhenHidden:true,
  // The embedder's panel is a portrait column that can be narrower than 700 px
  // on a small laptop. Its poster was captured with the desktop framing; the
  // live scene must keep it so the cross-fade does not read as a jump.
  narrowViewportOffset:false,
  canvasLabel:'Smashbar jelly. Click the scene, then use WASD or the arrow keys to wander and Space to hop. Drag the jelly to stretch it; drag the ground to orbit.',
};

/** `?embed=1` selects the Smashbar backdrop; anything else is the playroom. */
export function isEmbedSearch(search:string) {
  return new URLSearchParams(search).get('embed')==='1';
}

export function resolveSceneConfig(search:string=location.search):SceneConfig {
  return isEmbedSearch(search)?EMBED_SCENE:FULL_SCENE;
}
