
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

