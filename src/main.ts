import './style.css';
import { flavorPickerMarkup } from './app/flavor-picker.ts';
import { resolveSceneConfig, SOURCE_URL, type ChromeConfig, type SceneConfig } from './app/scene-config.ts';

const config=resolveSceneConfig();
// index.html sets this before its preloads. Setting it again here keeps the
// stylesheet honest if the document is ever served without that bootstrap.
document.documentElement.dataset.jellyMode=config.mode;
// The page and the loading card paint in the scene's backdrop colour, so
// nothing else shows before the canvas does.
document.documentElement.style.setProperty('--jelly-backdrop',config.backdrop);

const SOUND_BUTTON=`
    <button id="sound" class="icon-button" aria-label="Mute sound" aria-pressed="false" title="Sound">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M11 5 6 9H3v6h3l5 4V5Z"/><path class="sound-waves" d="M15 8a6 6 0 0 1 0 8m3-11a10 10 0 0 1 0 14"/><path class="sound-off" d="m15 9 6 6m0-6-6 6"/></svg>
    </button>`;
const RESET_BUTTON=`
    <button id="reset" class="icon-button" aria-label="Reset jelly baby" title="Reset">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M4.5 8a8 8 0 1 1-.1 8M4 3v6h6"/></svg>
    </button>`;
const LIGHTING_BUTTON=`
    <button id="lighting-mode" class="icon-button" type="button" aria-label="Switch to night mode" aria-pressed="false" title="Switch to night mode">
      <svg class="day-icon" aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><circle cx="12" cy="12" r="4"/><path d="M12 2v2m0 16v2M2 12h2m16 0h2M5 5l1.5 1.5m11 11L19 19M5 19l1.5-1.5m11-11L19 5"/></svg>
      <svg class="night-icon" aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M20.5 14A8.5 8.5 0 0 1 10 3.5 8.5 8.5 0 1 0 20.5 14Z"/></svg>
    </button>`;

/** Only the controls the scene names are in the document at all; the runtime binds to what it finds. */
/** The GPL's "offer of source" at the point of use. Opens a new tab; an embedder's sandbox must allow popups. */
function sourceLinkMarkup(className:string) {
  return `<a class="${className}" href="${SOURCE_URL}" target="_blank" rel="noopener noreferrer">source</a>`;
}

function actionsMarkup(chrome:ChromeConfig) {
  // With the hints bar gone the source link needs another home: beside the mute button.
  const buttons=[chrome.mute&&SOUND_BUTTON,chrome.reset&&RESET_BUTTON,chrome.flavorPicker&&flavorPickerMarkup(),chrome.lightingMode&&LIGHTING_BUTTON,
    chrome.sourceLink&&!chrome.keyboardHints&&sourceLinkMarkup('source-link source-link-action')].filter(Boolean);
  return buttons.length?`<nav class="actions" aria-label="Game controls">${buttons.join('')}</nav>`:'';
}

function hintsMarkup(chrome:ChromeConfig) {
  if(!chrome.keyboardHints)return '';
  const source=chrome.sourceLink?`
    <span class="separator"></span>${sourceLinkMarkup('source-link')}`:'';
  return `
  <footer class="desktop-hints" aria-label="Keyboard controls">
    <span><kbd>W</kbd><span class="key-row"><kbd>A</kbd><kbd>S</kbd><kbd>D</kbd></span></span><span class="hint-label">wander</span>
    <span class="separator"></span><kbd class="space-key">space</kbd><span class="hint-label">hop</span>
    <span class="separator"></span><svg class="mouse" viewBox="0 0 20 25" fill="none" stroke="currentColor"><rect x="3.5" y="1.5" width="13" height="21" rx="6.5"/><path d="M10 5v5"/></svg><span class="hint-label">orbit · grab</span>${source}
  </footer>`;
}

function markup(scene:SceneConfig) {
  const {chrome}=scene;
  return `
  <main id="viewport" aria-label="${scene.mode==='embed'?'Smashbar jelly':'Jelly baby playground'}"></main>
  ${chrome.masthead?`<header class="masthead"><span class="eyebrow">a small, soft world</span><h1>jelly baby<span>.</span></h1></header>`:''}
  ${actionsMarkup(chrome)}
  ${hintsMarkup(chrome)}
  ${chrome.touchControls?`
  <div class="touch-controls" aria-label="Touch controls">
    <button class="joystick" data-joystick type="button" aria-label="Move">
      <span class="joystick-track" aria-hidden="true"></span>
      <span class="joystick-knob" aria-hidden="true"></span>
    </button>
    <button class="jump" data-control="Space" aria-label="Jump"><svg viewBox="0 0 28 28" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M14 21V6m-6 6 6-6 6 6M6 24h16"/></svg><span>hop</span></button>
  </div>`:''}
  <section id="loading" role="status" aria-live="polite"><div class="loading-card"><div class="jelly-mark"></div><h2>A little life.</h2><p id="load-message">Warming up the world</p><pre id="fatal" hidden></pre><button id="retry" hidden>Try again</button></div></section>
`;
}

document.querySelector<HTMLDivElement>('#app')!.innerHTML=markup(config);

/**
 * The embedder's half of this protocol is Smashbar's `JellyPanel`: it lifts its
 * poster on `jelly:ready`, takes the frame down on `jelly:failed`, and checks
 * `event.origin` against the origin it configured. The target here is `*`
 * because the frame is loaded with `referrerPolicy="no-referrer"`, so the
 * embedder's origin is unknowable from inside — and the payload carries
 * nothing worth protecting.
 */
function announce(type:'jelly:ready'|'jelly:failed') {
  if(!config.lifecycleMessages||window.parent===window)return;
  window.parent.postMessage({type},'*');
}

let stage='Loading the game',failed=false,game:{stop:()=>void}|undefined;
function fail(reason:unknown) {
  if(failed)return;failed=true;game?.stop();
  const error=reason instanceof Error?reason:new Error(String(reason));
  document.querySelector('#loading')!.classList.remove('hidden');
  document.querySelector('#loading')!.classList.add('failed');
  document.querySelector('h2')!.textContent='A little hiccup.';
  document.querySelector('#load-message')!.textContent='The game couldn’t start. Details below.';
  const fatal=document.querySelector<HTMLPreElement>('#fatal')!;fatal.hidden=false;
  fatal.textContent=`${stage}\n${error.message}\n\nViewport: ${innerWidth} × ${innerHeight} · DPR ${devicePixelRatio}\n${navigator.userAgent}`;
  document.querySelector<HTMLButtonElement>('#retry')!.hidden=false;
  console.error(`[Jelly Baby / ${stage}]`,error);
  announce('jelly:failed');
}
window.addEventListener('error',event=>fail(event.error||event.message));
window.addEventListener('unhandledrejection',event=>fail(event.reason));
document.querySelector('#retry')!.addEventListener('click',()=>location.reload());

// One observed chain covers imports, initialization, compilation, warmup and first render.
void import('./app/runtime.ts').then(({startGame})=>startGame(message=>{
  if(failed)throw new Error('Startup aborted after a GPU failure');
  stage=message;document.querySelector('#load-message')!.textContent=message;
},fail,config)).then(started=>{
  game=started;
  if(failed){game.stop();return;}
  stage='Playing';document.querySelector('#loading')!.classList.add('hidden');
  // Two frames on: the loop is running and the compositor has presented at
  // least one of its frames before an embedder lifts its poster.
  requestAnimationFrame(()=>requestAnimationFrame(()=>{if(!failed)announce('jelly:ready');}));
}).catch(fail);
