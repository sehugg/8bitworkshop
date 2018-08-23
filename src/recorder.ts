
import { Platform, EmuState, EmuControlsState, EmuRecorder } from "./baseplatform";
import { getNoiseSeed, setNoiseSeed } from "./emu";

type FrameRec = {controls:EmuControlsState, seed:number};

export class StateRecorderImpl implements EmuRecorder {
    checkpointInterval : number = 60;
    callbackStateChanged : () => void;
    maxCheckpoints : number = 120;
    
    platform : Platform;
    checkpoints : EmuState[];
    framerecs : FrameRec[];
    frameCount : number;
    lastSeekFrame : number = -1;
    
    constructor(platform : Platform) {
        this.reset();
        this.platform = platform;
    }

    reset() {
        this.checkpoints = [];
        this.framerecs = [];
        this.frameCount = 0;
        this.lastSeekFrame = -1;
    }

    frameRequested() : boolean {
        // checkpoints full?
        if (this.checkpoints.length >= this.maxCheckpoints) {
            return false;
        }
        // record the control state, if available
        if (this.platform.saveControlsState) {
            this.framerecs.push({
                controls:this.platform.saveControlsState(),
                seed:getNoiseSeed()
            });
        }
        // pick up where we left off, if we used the seek function
        if (this.lastSeekFrame >= 0) {
            this.frameCount = this.lastSeekFrame;
            this.lastSeekFrame = -1;
            // truncate buffers
            this.checkpoints = this.checkpoints.slice(0, Math.floor((this.frameCount + this.checkpointInterval - 1) / this.checkpointInterval));
            this.framerecs = this.framerecs.slice(0, this.frameCount);
        }
        // time to save next frame?
        if (this.callbackStateChanged) {
            this.callbackStateChanged();
        }
        return (this.frameCount++ % this.checkpointInterval) == 0;
    }
    
    numFrames() : number {
        return this.frameCount;
    }
    
    recordFrame(state : EmuState) {
        this.checkpoints.push(state);
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
                    this.platform.loadControlsState(this.framerecs[frame].controls);
                    setNoiseSeed(this.framerecs[frame].seed);
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
}
