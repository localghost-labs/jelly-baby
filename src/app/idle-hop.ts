import type { Locomotion } from './locomotion.ts';

export type IdleHopConfig={
  /** Seconds between hops while nobody has touched the toy. */
  readonly intervalSeconds:number;
};

/**
 * Hop on a timer until the visitor's first interaction with the toy — a
 * pointer down on the canvas or a key — after which it is theirs and never
 * moves on its own again. Time accrues only through `step`, which the loop
 * calls while it runs, so a hidden tab banks no hops. `Locomotion.jump` only
 * queues; the launch still waits for ground contact and the cooldown.
 */
export class IdleHop {
  private readonly rig:Locomotion;
  private readonly interval:number;
  private readonly abort=new AbortController();
  private elapsed=0;
  private stopped=false;
  constructor(rig:Locomotion,canvas:HTMLElement,config:IdleHopConfig) {
    this.rig=rig;this.interval=config.intervalSeconds;
    const {signal}=this.abort;
    canvas.addEventListener('pointerdown',this.stop,{capture:true,signal});
    window.addEventListener('keydown',this.stop,{capture:true,signal});
  }
  /** Permanent: the toy does not resume hopping after the visitor lets go. */
  stop=()=>{if(this.stopped)return;this.stopped=true;this.abort.abort();};
  step(dt:number) {
    if(this.stopped)return;
    this.elapsed+=dt;
    if(this.elapsed<this.interval)return;
    this.elapsed=0;this.rig.jump();
  }
  dispose(){this.stop();}
}
