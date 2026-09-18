import type { Group, Scene } from 'three/webgpu';
import type { SoftBody } from '../../physics/soft-body.js';
import type { Locomotion } from '../../app/locomotion.ts';
import type { FacilityShadows } from '../../facilities/shadows.ts';
import type { Facilities } from '../../facilities/manager.ts';
import type { FacilitySoundEvent } from '../../facilities/sound.ts';
import type { WorldTravel } from '../travel.ts';
import { SwingFacility } from './facilities/swing/facility.ts';
import { BedFacility } from './facilities/bed/facility.ts';
import { TrampolineFacility } from './facilities/trampoline/facility.ts';
import { CarriedWearableFacility, WearableFacility } from './facilities/wearable/facility.ts';

export type PlayroomDependencies={
  readonly home:Scene;
  readonly body:SoftBody;
  readonly babyGroup:Group;
  readonly rig:Locomotion;
  readonly shadows:FacilityShadows;
  readonly facilities:Facilities;
  readonly worlds:WorldTravel;
  readonly facilitySound:(event:FacilitySoundEvent)=>void;
};

/** The hooks the main loop needs from the home world's furniture. */
export type Playroom={
  /** A jump from ordinary locomotion may leave the dressing table. */
  onJump():void;
  /** Immediately after `body.step`, before the active facility's `afterStep`. */
  afterBodyStep():void;
};

/**
 * The home world's furniture — dressing table, swing, trampoline, bed — and
 * the carried-attire facilities the other worlds need. A scene configured
 * without a playroom never imports this module, so its code stays out of that
 * scene's transfer; the playroom itself is unchanged from upstream, only
 * relocated here from the runtime.
 */
export function installPlayroom({home,body,babyGroup,rig,shadows,facilities,worlds,facilitySound}:PlayroomDependencies):Playroom {
  const wearableTable=new WearableFacility(home,body,babyGroup,rig,shadows);
  const bed=new BedFacility(home,body,shadows);
  facilities.add(wearableTable);
  worlds.toyFacilities.add(new CarriedWearableFacility(wearableTable));
  worlds.soccerFacilities.add(new CarriedWearableFacility(wearableTable));
  facilities.add(new SwingFacility(home,body,shadows,facilitySound));
  facilities.add(new TrampolineFacility(home,body,shadows,facilitySound));
  facilities.add(bed);
  return {
    onJump(){wearableTable.jumpFromNormalLocomotion();},
    afterBodyStep(){wearableTable.syncBedOccupancy(bed.active);},
  };
}
