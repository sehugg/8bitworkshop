
import { Platform, EmuState, EmuControlsState, EmuRecorder } from "./baseplatform";
import { getNoiseSeed, setNoiseSeed } from "./emu";

type FrameRec = {controls:EmuControlsState, seed:number};

export class StateRecorderImpl implements EmuRecorder {
    checkpointInterval : number = 60;
    callbackStateChanged : () => void;
    callbackNewCheckpoint : (state:EmuState) => void;
    maxCheckpoints : number = 120;
    
    platform : Platform;
    checkpoints : EmuState[];
    framerecs : FrameRec[];
    frameCount : number;
    lastSeekFrame : number;
    
    constructor(platform : Platform) {
        this.reset();
        this.platform = platform;
    }

    reset() {
        this.checkpoints = [];
        this.framerecs = [];
        this.frameCount = 0;
        this.lastSeekFrame = 0;
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
        if (this.callbackStateChanged) this.callbackStateChanged();
        return requested;
    }
    
    numFrames() : number {
        return this.frameCount;
    }
    
    currentFrame() : number {
        return this.lastSeekFrame;
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
        var bufidx = Math.floor(frame / this.checkpointInterval);
        var foundidx = bufidx < this.checkpoints.length ? bufidx : this.checkpoints.length-1;
        var foundframe = foundidx * this.checkpointInterval;
        return {frame:foundframe, state:this.checkpoints[foundidx]};
    }

    loadFrame(seekframe : number) : number {
        if (seekframe == this.lastSeekFrame)
            return seekframe; // already set to this frame
        // TODO: what if < 1?
        let {frame,state} = this.getStateAtOrBefore(seekframe-1);
        if (state) {
            this.platform.pause();
            this.platform.loadState(state);
            while (frame < seekframe) {
                if (frame < this.framerecs.length) {
                    this.loadControls(frame);
                }
                frame++;
                this.platform.advance(frame < seekframe); // TODO: infinite loop?
            }
            this.lastSeekFrame = seekframe;
            return seekframe;
        } else {
            return 0;
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
