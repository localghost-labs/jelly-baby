import * as THREE from 'three/webgpu';
import { SoftBody } from '../physics/soft-body.js';
import { PHYS } from '../physics/constants.js';
import { loadBabyCage } from '../physics/baby-cage.ts';
import { RefractiveLightField } from '../graphics/optics/refractive-light.js';
import { CausticReceivers } from '../graphics/optics/caustic-receivers.ts';
import { Baby } from '../graphics/character/baby.ts';
import { loadEnvironment } from '../graphics/scene/environment.ts';
import { makeSweep, type GroundSurface } from '../graphics/scene/sweep.ts';
import { loadWordmark } from '../graphics/scene/wordmark.ts';
import { Locomotion } from './locomotion.ts';
import { Input } from './input.ts';
import { JellySound } from './sound.ts';
import { createRenderer, resizeView } from '../graphics/scene/renderer.ts';
import { OpticalTransport } from '../graphics/optics/transport.ts';
import { createComposite } from '../graphics/scene/composite.ts';
import { FixedStepper } from './fixed-step.ts';
import { JELLY_FLAVORS } from '../graphics/character/jelly-flavors.ts';
import { FlavorPicker } from './flavor-picker.ts';
import { Facilities } from '../facilities/manager.ts';
import { FacilityShadows } from '../facilities/shadows.ts';
import { warmMainScenePipelines } from '../graphics/scene/render-warmup.ts';
import { WorldTravel } from '../worlds/travel.ts';
import { SOCCER_RUN_CADENCE_SCALE, SOCCER_RUN_SPEED_SCALE } from '../worlds/soccer/layout.ts';
import { LocalReflectionProbe } from '../graphics/scene/local-reflections.ts';
import { startupPlatformProfile } from './platform-profile.ts';
import { resolveSceneConfig, type SceneConfig } from './scene-config.ts';
import { IdleHop } from './idle-hop.ts';

export async function startGame(stage:(s:string)=>void,fail:(e:unknown)=>void,config:SceneConfig=resolveSceneConfig()) {
  const profile=startupPlatformProfile();
  // What the scene leaves out is a chunk this page never fetches: the timber
  // table with its textures, the lighting switch with its night map, and the
  // playroom furniture. Start the imports the scene DOES want now so their
  // transfer overlaps WebGPU initialisation.
  const tableModule=config.ground.kind==='table'?import('../graphics/scene/table.ts'):undefined;
  const lightingModule=config.chrome.lightingMode?import('./lighting-mode.ts'):undefined;
  const playroomModule=config.playroom?import('../worlds/main/playroom.ts'):undefined;
  stage('Starting WebGPU');
  const renderer=await createRenderer(fail);
  renderer.domElement.setAttribute('aria-label',config.canvasLabel);
  document.querySelector('#viewport')!.appendChild(renderer.domElement);
  // Construct audio before the remaining async scene work so the first mobile
  // gesture can unlock Web Audio even while assets and shaders are settling.
  const sound=new JellySound();
  const scene=new THREE.Scene();
  scene.background=new THREE.Color(config.backdrop);scene.fog=new THREE.Fog(config.backdrop,2,12);
  const camera=new THREE.PerspectiveCamera(36,1,.001,40);
  camera.position.set(.111,.170,.256);
  stage('Loading the little room');
  const [environment,nightEnvironment,cage,tableTextures,wordmark]=await Promise.all([
    loadEnvironment(renderer,scene),
    lightingModule?.then(module=>module.loadNightEnvironment(renderer,scene)),
    loadBabyCage(),
    tableModule?.then(module=>module.loadTableTextures(profile.mobile)),
    config.wordmark?loadWordmark(config.wordmark):undefined,
  ]);
  // Start the large table uploads before CPU-side world construction so the
  // backend can overlap transfer work with geometry/physics setup.
  if(tableTextures)for(const texture of Object.values(tableTextures))renderer.initTexture(texture);
  stage('Making a little jelly');
  const body=new SoftBody(cage);
  const baby=new Baby(body);baby.setFlavor(config.flavor);scene.add(baby.group);
  const localReflections=new LocalReflectionProbe(scene,baby.group,environment.reflectionTexture,profile.reflectionFacesPerFrame);
  baby.setReflectionMap(localReflections.texture,environment.intensity);
  const optics=new RefractiveLightField(body.cage.opticalSurface,environment.incoming,JELLY_FLAVORS[config.flavor].absorption);
  optics.setCamera(camera);
  // Worker BVH construction is independent of the remaining scene setup. Start
  // it here so that cold worker initialization runs in parallel with facilities.
  const transport=new OpticalTransport(optics,body,camera,environment.incoming,fail,profile.cameraOnlyOpticalHz);
  const caustics=new CausticReceivers(optics,environment);
  const facilityShadows=new FacilityShadows(environment.incoming,environment.windowFraction,caustics,-.00005,profile.surfaceShadowSize);
  facilityShadows.surfaces.addBaby(baby.mesh);
  const table=await tableModule;
  const ground:GroundSurface=table&&tableTextures
    ?table.makeTable(optics,environment,facilityShadows,caustics,tableTextures)
    :makeSweep(optics,environment,facilityShadows,caustics,config.ground.kind==='sweep'?config.ground.color:config.backdrop,config.ground.kind==='sweep'?config.ground.lift:0);
  scene.add(ground.mesh);
  if(wordmark)scene.add(wordmark.group);
  const composite=createComposite(renderer,scene,camera,profile.bloomResolutionScale);
  const rig=new Locomotion(body);
  const facilities=new Facilities(body);
  const worlds=new WorldTravel(scene,body,facilityShadows,facilities,renderer,camera,stage,fail,profile.cameraOnlyOpticalHz,config.portal);
  const playroom=playroomModule
    ?(await playroomModule).installPlayroom({home:worlds.home,body,babyGroup:baby.group,rig,shadows:facilityShadows,facilities,worlds,facilitySound:sound.facility})
    :undefined;
  rig.onJump=()=>{
    playroom?.onJump();
    if(worlds.inSoccer&&(worlds.soccer?.physics.onField??false))sound.soccerGrassContact('takeoff');
  };
  const flavorPicker=config.chrome.flavorPicker?new FlavorPicker(flavor=>{
    baby.setFlavor(flavor);optics.setAbsorption(JELLY_FLAVORS[flavor].absorption);
  }):undefined;
  rig.onContact=(speed,foot)=>{
    const soccerField=worlds.inSoccer&&(worlds.soccer?.physics.onField??false);
    if(soccerField){if(!foot)sound.soccerGrassContact('land');return;}
    sound.contact(speed,foot);
  };
  const physicsClock=new FixedStepper(PHYS.step);
  let lastTime=0,disposed=false;
  const reset=()=>{if(worlds.loading)return;sound.stopFacilities();worlds.reset();input.teleport();rig.yaw=worlds.arrivalYaw;baby.resetFace();physicsClock.reset();};
  const input=new Input(camera,renderer.domElement,body,baby.mesh,rig,sound);
  const idleHop=config.idleHop?new IdleHop(rig,renderer.domElement,config.idleHop):undefined;
  if(config.cameraDistance!==null) {
    // Same direction as the playroom's opening shot, at the configured distance.
    // The follow logic carries the camera's offset from the target, so the
    // distance holds until the visitor turns the wheel.
    const offset=camera.position.clone().sub(input.controls.target).setLength(config.cameraDistance);
    camera.position.copy(input.controls.target).add(offset);input.controls.update();
  }
  input.bodyControlled=()=>worlds.loading||worlds.menu.opened||!!worlds.facilities.active;
  input.menuOpen=()=>worlds.menu.opened;
  input.soccerOnField=()=>worlds.inSoccer&&(worlds.soccer?.physics.onField??false);
  input.soccerCameraObstacles=()=>worlds.inSoccer&&(worlds.soccer?.physics.onField??false)?worlds.soccer?.stadium.cameraObstacles??[]:[];
  input.facilityCameraDistance=()=>worlds.facilities.active?.cameraDistance;
  input.vehicleInput=(throttle,turn)=>{const p=worlds.tricycle?.physics;if(p&&worlds.inToys){p.throttle=p.riding?throttle:0;p.turn=p.riding?turn:0;}};
  input.ridingVehicle=()=>worlds.inToys&&(worlds.tricycle?.physics.riding??false);
  input.vehicleHeading=()=>worlds.tricycle?.physics.yaw;
  facilities.onInteract=()=>{input.clear();rig.reset();void sound.unlock().catch(()=>{});};
  worlds.toyFacilities.onInteract=facilities.onInteract;
  worlds.soccerFacilities.onInteract=facilities.onInteract;
  worlds.onMenuClose=()=>input.clear();
  worlds.onMove=()=>{input.clear();sound.stopFacilities();physicsClock.reset();};
  worlds.onMenuOpen=worlds.onMove;
  worlds.onReady=async()=>{
    input.teleport();rig.yaw=worlds.arrivalYaw;baby.resetFace();physicsClock.reset();
    sound.prepareWorld(worlds.current);
    if(worlds.tricycle){
      worlds.tricycle.physics.onCrash=speed=>sound.contact(speed,false);
      worlds.tricycle.onWalkCurbImpact=speed=>rig.surfaceImpact(speed);
    }
    if(worlds.soccer)worlds.soccer.physics.onEvent=(kind,strength,p)=>sound.soccerEvent(kind,strength,p);
    baby.update();optics.update(renderer,body,true);transport.follow();await transport.update();
    localReflections.captureNow(renderer,body.center);
  };
  const lighting=await lightingModule;
  const lightingMode=lighting&&nightEnvironment?new lighting.LightingMode(renderer,scene,camera,environment,nightEnvironment,async(light,signal)=>{
    optics.setLightDirection(light.incoming);
    facilityShadows.setLighting(light.incoming,light.windowFraction);caustics.setLighting(light);ground.setLighting(light);
    localReflections.setEnvironment(light.reflectionTexture);baby.setReflectionMap(localReflections.texture,light.intensity);
    // Refresh every visible derivative while the animation loop holds the last
    // coherent frame. Worker and GPU work overlap where their dependencies allow.
    const transportReady=transport.refreshLighting(light.incoming);
    const shadowSyncRevision=facilityShadows.update(renderer);
    facilityShadows.surfaces.update(renderer,shadowSyncRevision);
    optics.update(renderer,body,true);
    const soccerReady=worlds.soccer?.prepareLighting(renderer,worlds.inSoccer)??Promise.resolve();
    await Promise.all([transportReady,soccerReady]);
    if(signal.aborted)return;
    transport.follow();localReflections.captureNow(renderer,body.center);
  },()=>composite.render(),fail):undefined;
  const resize=()=>resizeView(renderer,camera,input.controls,profile.maxDpr,config.narrowViewportOffset);
  let resizeFrame=0;
  const resizeObserver=new ResizeObserver(()=>{
    cancelAnimationFrame(resizeFrame);resizeFrame=requestAnimationFrame(resize);
  });
  resizeObserver.observe(document.querySelector('#viewport')!);resize();
  // The chrome is whatever the scene put in the document; bind to what is there.
  document.querySelector('#reset')?.addEventListener('click',event=>{
    reset();if((event as MouseEvent).detail>0)(event.currentTarget as HTMLButtonElement).blur();
  });
  document.querySelector('#sound')?.addEventListener('click',event=>{
    const button=event.currentTarget as HTMLButtonElement,muted=sound.toggle();
    button.setAttribute('aria-pressed',String(muted));button.setAttribute('aria-label',muted?'Enable sound':'Mute sound');
    button.classList.toggle('muted',muted);void sound.unlock().catch(()=>{});
    if((event as MouseEvent).detail>0)button.blur();
  });
  stage('Settling in');
  // Let contact establish itself before displaying the first frame.
  for(let i=0;i<80;i++){rig.step(PHYS.step);body.step(PHYS.step);}
  body.updateSurface();
  stage('Warming collisions');
  facilities.warmupCollisions();
  baby.update();input.update(1);
  const shadowSyncRevision=facilityShadows.update(renderer);
  facilityShadows.surfaces.update(renderer,shadowSyncRevision);
  optics.update(renderer,body,true);
  await transport.update();
  localReflections.captureNow(renderer,body.center);
  stage('Compiling the material');
  await warmMainScenePipelines(renderer,scene,camera);
  stage('Drawing the first frame');
  composite.render();
  // Fence first-frame GPU work so validation/OOM cannot masquerade as a successful boot.
  const backend=renderer.backend as unknown as {device:GPUDevice};
  await backend.device.queue.onSubmittedWorkDone();
  lastTime=performance.now();
  const frame=(time:number)=>{
    if(disposed)return;
    try {
      const dt=Math.min(.05,Math.max(0,(time-lastTime)/1000));lastTime=time;
      if(document.hidden){physicsClock.reset();return;}
      if(lightingMode?.switching){physicsClock.reset();return;}
      if(worlds.loading||worlds.menu.opened){physicsClock.reset();return;}
      idleHop?.step(dt);
      const steps=physicsClock.advance(dt,()=>{
        if(worlds.loading)return;
        const current=worlds.facilities;
        const soccerField=worlds.inSoccer&&(worlds.soccer?.physics.onField??false);
        rig.speedScale=soccerField?SOCCER_RUN_SPEED_SCALE:1;rig.cadenceScale=soccerField?SOCCER_RUN_CADENCE_SCALE:1;
        input.step(PHYS.step);current.step(PHYS.step);
        if(!current.active)rig.step(PHYS.step);
        body.step(PHYS.step);playroom?.afterBodyStep();current.afterStep();input.afterPhysicsStep();
        if(!current.active)rig.afterStep();
        worlds.step(PHYS.step);
      });
      if(steps&&body.surfaceDirty) {
        if(!body.isFinite())throw new Error('The soft-body simulation produced an invalid state');
        body.updateSurface();
      }
      if(worlds.loading)return;
      worlds.facilities.update();worlds.update(dt);
      baby.update(dt,worlds.facilities.active?.laughing??false,worlds.facilities.active?.sleeping??false,worlds.facilities.crying);
      const shadowSyncRevision=facilityShadows.update(renderer);
      facilityShadows.surfaces.update(renderer,shadowSyncRevision);
      input.update(dt);
      sound.listen(camera);
      const tricycle=worlds.inToys?worlds.tricycle?.physics:undefined;
      if(tricycle)sound.tricycleMotion(tricycle.riding?tricycle.rollingSpeed:0,tricycle.position.x,tricycle.position.y+.025,tricycle.position.z);
      const soccer=worlds.inSoccer?worlds.soccer?.physics:undefined;
      if(soccer)sound.soccerMotion(soccer.onField&&rig.grounded&&rig.move.lengthSq()>.01?Math.hypot(rig.velocity.x,rig.velocity.z):0);
      transport.follow();
      optics.update(renderer,body);
      ground.mesh.position.x=body.center.x;ground.mesh.position.z=body.center.z;
      localReflections.update(renderer,body.center);
      void transport.update().catch(fail);
      composite.render();
    }catch(error){fail(error);}
  };
  const lifecycle=new AbortController();
  if(config.pauseWhenHidden) {
    // The loop already skips simulation while hidden. Stopping it outright also
    // stops asking the compositor and the transport worker for anything, which
    // is what "the background tab idles" means to an embedder measuring GPU use.
    document.addEventListener('visibilitychange',()=>{
      if(disposed)return;
      if(document.hidden){void renderer.setAnimationLoop(null);return;}
      physicsClock.reset();lastTime=performance.now();void renderer.setAnimationLoop(frame);
    },{signal:lifecycle.signal});
  }
  await renderer.setAnimationLoop(frame);
  const dispose=()=>{
    if(disposed)return;disposed=true;
    lifecycle.abort();idleHop?.dispose();lightingMode?.dispose();void renderer.setAnimationLoop(null);input.dispose();sound.dispose();transport.dispose();resizeObserver.disconnect();cancelAnimationFrame(resizeFrame);
    worlds.dispose();facilities.dispose();facilityShadows.dispose();caustics.dispose();flavorPicker?.dispose();composite.dispose();localReflections.dispose();baby.dispose();wordmark?.dispose();ground.dispose();environment.dispose();optics.dispose();renderer.dispose();
  };
  window.addEventListener('pagehide',event=>{if(!event.persisted)dispose();});
  if(import.meta.hot)import.meta.hot.dispose(dispose);
  return {stop:()=>{disposed=true;lifecycle.abort();idleHop?.dispose();worlds.dispose();lightingMode?.dispose();input.clear();facilities.dispose();facilityShadows.dispose();caustics.dispose();flavorPicker?.dispose();sound.dispose();transport.dispose();localReflections.dispose();void renderer.setAnimationLoop(null);}};
}
