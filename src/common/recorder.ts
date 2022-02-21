
import { Platform, EmuState, EmuControlsState, EmuRecorder } from "./baseplatform";
import { getNoiseSeed, setNoiseSeed } from "./emu";

// RECORDER

type FrameRec = {controls:EmuControlsState, seed:number};

export class StateRecorderImpl implements EmuRecorder {
  
    checkpointInterval : number = 10;
    callbackStateChanged : () => void;
    callbackNewCheckpoint : (state:EmuState) => void;
    maxCheckpoints : number = 300;
    
    platform : Platform;
    checkpoints : EmuState[];
    framerecs : FrameRec[];
    frameCount : number;
    lastSeekFrame : number;
    lastSeekStep : number;
    lastStepCount : number;
    
    constructor(platform : Platform) {
        this.reset();
        this.platform = platform;
    }

    reset() {
        this.checkpoints = [];
        this.framerecs = [];
        this.frameCount = 0;
        this.lastSeekFrame = 0;
        this.lastSeekStep = 0;
        this.lastStepCount = 0;
        if (this.callbackStateChanged) this.callbackStateChanged();
    }

    frameRequested() : boolean {
        var controls = {
          controls:this.platform.saveControlsState(),
          seed:getNoiseSeed()
        };
        var requested = false;
        // are we replaying? then we don't need to save a frame, just replace controls
        if (this.lastSeekFrame < this.frameCount) {
            this.loadControls(this.lastSeekFrame);
        } else {
            // record the control state, if available
            if (this.platform.saveControlsState) {
                this.framerecs.push(controls);
            }
            // time to save next frame?
            requested = (this.frameCount++ % this.checkpointInterval) == 0;
        }
        this.lastSeekFrame++;
        this.lastSeekStep = 0;
        if (this.callbackStateChanged) this.callbackStateChanged();
        return requested;
    }
    
    numFrames() : number {
        return this.frameCount;
    }
    
    currentFrame() : number {
        return this.lastSeekFrame;
    }

    currentStep() : number {
      return this.lastSeekStep;
  }

    recordFrame(state : EmuState) {
        this.checkpoints.push(state);
        if (this.callbackNewCheckpoint) this.callbackNewCheckpoint(state);
        // checkpoints full?
        if (this.checkpoints.length > this.maxCheckpoints) {
            this.checkpoints.shift(); // remove 1st checkpoint
            this.framerecs = this.framerecs.slice(this.checkpointInterval);
            this.lastSeekFrame -= this.checkpointInterval;
            this.frameCount -= this.checkpointInterval;
            if (this.callbackStateChanged) this.callbackStateChanged();
        }
    }

    getStateAtOrBefore(frame : number) : {frame : number, state : EmuState} {
        // initial frame?
        if (frame <= 0 && this.checkpoints.length > 0)
          return {frame:0, state:this.checkpoints[0]};

        var bufidx = Math.floor(frame / this.checkpointInterval);
        var foundidx = bufidx < this.checkpoints.length ? bufidx : this.checkpoints.length-1;
        var foundframe = foundidx * this.checkpointInterval;
        return {frame:foundframe, state:this.checkpoints[foundidx]};
    }

    loadFrame(seekframe : number, seekstep? : number) : number {
        seekframe |= 0;
        seekstep |= 0;
        if (seekframe == this.lastSeekFrame && seekstep == this.lastSeekStep) {
            return seekframe; // already set to this frame
        }
        // TODO: what if < 1?
        let {frame,state} = this.getStateAtOrBefore(seekframe-1);
        if (state) {
            var numSteps = 0;
            this.platform.pause();
            this.platform.loadState(state);
            // seek to frame index
            while (frame < seekframe) {
                if (frame < this.framerecs.length) {
                    this.loadControls(frame);
                }
                frame++;
                numSteps = this.platform.advance(frame < seekframe); // TODO: infinite loop?
            }
            // TODO: if first frame, we must figure out # of steps
            if (frame == 0) {
              numSteps = this.platform.advance(true);
              this.platform.loadState(state);
            }
            // seek to step index
            // TODO: what if advance() returns clocks, but steps use insns?
            if (seekstep > 0 && this.platform.advanceFrameClock) { 
              seekstep = this.platform.advanceFrameClock(null, seekstep);
            }
            // record new values
            this.lastSeekFrame = seekframe;
            this.lastSeekStep = seekstep;
            this.lastStepCount = numSteps;
            return seekframe;
        } else {
            return -1;
        }
    }
    
    loadControls(frame : number) {
        if (this.platform.loadControlsState)
            this.platform.loadControlsState(this.framerecs[frame].controls);
        setNoiseSeed(this.framerecs[frame].seed);
    }
    
    getLastCheckpoint() : EmuState {
        return this.checkpoints.length && this.checkpoints[this.checkpoints.length-1];
    }
}

/////

import { Probeable, ProbeAll } from "./devices";

export enum ProbeFlags {
  CLOCKS	  = 0x00000000,
  EXECUTE	  = 0x01000000,
  HAS_VALUE = 0x10000000,
  MEM_READ	= 0x12000000,
  MEM_WRITE	= 0x13000000,
  IO_READ	  = 0x14000000,
  IO_WRITE	= 0x15000000,
  VRAM_READ	= 0x16000000,
  VRAM_WRITE= 0x17000000,
  INTERRUPT	= 0x08000000,
  ILLEGAL	  = 0x09000000,
  SP_PUSH	  = 0x0a000000,
  SP_POP	  = 0x0b000000,
  SCANLINE	= 0x7e000000,
  FRAME		  = 0x7f000000,
}

class ProbeFrame {
  data : Uint32Array;
  len : number;
}

export class ProbeRecorder implements ProbeAll {

  m : Probeable;      // machine to probe
  buf : Uint32Array;  // buffer
  idx : number = 0;   // index into buffer
  sl : number = 0;    // scanline
  cur_sp = -1;        // last stack pointer
  singleFrame : boolean = true; // clear between frames

  constructor(m:Probeable, buflen?:number) {
    this.m = m;
    this.reset(buflen || 0x100000);
  }
  start() {
    this.m.connectProbe(this);
  }
  stop() {
    this.m.connectProbe(null);
  }
  reset(newbuflen? : number) {
    if (newbuflen) this.buf = new Uint32Array(newbuflen);
    this.sl = 0;
    this.cur_sp = -1;
    this.clear();
  }
  clear() {
    this.idx = 0;
  }
  logData(a:number) {
    this.log(a);
  }
  log(a:number) {
    // TODO: coalesce READ and EXECUTE and PUSH/POP
    if (this.idx >= this.buf.length) return;
    this.buf[this.idx++] = a;
  }
  relog(a:number) {
    this.buf[this.idx-1] = a;
  }
  lastOp() {
    if (this.idx > 0)
      return this.buf[this.idx-1] & 0xff000000;
    else
      return -1;
  }
  lastAddr() {
    if (this.idx > 0)
      return this.buf[this.idx-1] & 0xffffff;
    else
      return -1;
  }
  addLogBuffer(src: Uint32Array) {
    if (this.idx + src.length > this.buf.length) {
      src = src.slice(0, this.buf.length - this.idx);
    }
    this.buf.set(src, this.idx);
    this.idx += src.length;
}
  logClocks(clocks:number) {
    clocks |= 0;
    if (clocks > 0) {
      if (this.lastOp() == ProbeFlags.CLOCKS)
        this.relog((this.lastAddr() + clocks) | ProbeFlags.CLOCKS); // coalesce clocks
      else
        this.log(clocks | ProbeFlags.CLOCKS);
    }
  }
  logNewScanline() {
    this.log(ProbeFlags.SCANLINE);
    this.sl++;
  }
  logNewFrame() {
    this.log(ProbeFlags.FRAME);
    this.sl = 0;
    if (this.singleFrame) this.clear();
  }
  logExecute(address:number, SP:number) {
    // record stack pushes/pops (from last instruction)
    if (this.cur_sp !== SP) {
      if (SP < this.cur_sp) {
        this.log(ProbeFlags.SP_PUSH | SP);
      }
      if (SP > this.cur_sp) {
        this.log(ProbeFlags.SP_POP | SP);
      }
      this.cur_sp = SP;
    }
    this.log(address | ProbeFlags.EXECUTE);
  }
  logInterrupt(type:number) {
    this.log(type | ProbeFlags.INTERRUPT);
  }
  logValue(address:number, value:number, op:number) {
    this.log((address & 0xffff) | ((value & 0xff)<<16) | op);
  }
  logRead(address:number, value:number) {
    this.logValue(address, value, ProbeFlags.MEM_READ);
  }
  logWrite(address:number, value:number) {
    this.logValue(address, value, ProbeFlags.MEM_WRITE);
  }
  logIORead(address:number, value:number) {
    this.logValue(address, value, ProbeFlags.IO_READ);
  }
  logIOWrite(address:number, value:number) {
    this.logValue(address, value, ProbeFlags.IO_WRITE);
  }
  logVRAMRead(address:number, value:number) {
    this.logValue(address, value, ProbeFlags.VRAM_READ);
  }
  logVRAMWrite(address:number, value:number) {
    this.logValue(address, value, ProbeFlags.VRAM_WRITE);
  }
  logIllegal(address:number) {
    this.log(address | ProbeFlags.ILLEGAL);
  }
  countEvents(op : number) : number {
    var count = 0;
    for (var i=0; i<this.idx; i++) {
      if ((this.buf[i] & 0xff000000) == op)
        count++;
    }
    return count;
  }
  countClocks() : number {
    var count = 0;
    for (var i=0; i<this.idx; i++) {
      if ((this.buf[i] & 0xff000000) == ProbeFlags.CLOCKS)
        count += this.buf[i] & 0xffff;
    }
    return count;
  }

}
