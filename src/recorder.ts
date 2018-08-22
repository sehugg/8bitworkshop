
import { Platform, EmuState, EmuControlsState, EmuRecorder } from "./baseplatform";

export class StateRecorderImpl implements EmuRecorder {
    checkpointInterval : number = 60;
    callbackStateChanged : () => void;
    maxCheckpoints : number = 120;
    
    platform : Platform;
    buffer : EmuState[];
    controls : EmuControlsState[];
    frameCount : number;
    lastSeekFrame : number = -1;
    
    constructor(platform : Platform) {
        this.reset();
        this.platform = platform;
    }

    reset() {
        this.buffer = [];
        this.controls = [];
        this.frameCount = 0;
        this.lastSeekFrame = -1;
    }

    frameRequested() : boolean {
        // buffer full?
        if (this.buffer.length >= this.maxCheckpoints) {
            return false;
        }
        // record the control state, if available
        if (this.platform.saveControlsState) {
            this.controls.push(this.platform.saveControlsState());
        }
        // pick up where we left off, if we used the seek function
        if (this.lastSeekFrame >= 0) {
            this.frameCount = this.lastSeekFrame;
            this.lastSeekFrame = -1;
            // truncate buffers
            this.buffer = this.buffer.slice(0, Math.floor((this.frameCount + this.checkpointInterval - 1) / this.checkpointInterval));
            this.controls = this.controls.slice(0, this.frameCount);
        }
        // time to save next frame?
        this.frameCount++;
        if (this.callbackStateChanged) {
            this.callbackStateChanged();
        }
        return (this.frameCount % this.checkpointInterval) == 0;
    }
    
    numFrames() : number {
        return this.frameCount;
    }
    
    recordFrame(state : EmuState) {
        this.buffer.push(state);
    }

    getStateAtOrBefore(frame : number) : {frame : number, state : EmuState} {
        var bufidx = Math.floor(frame / this.checkpointInterval);
        var foundidx = bufidx < this.buffer.length ? bufidx : this.buffer.length-1;
        var foundframe = foundidx * this.checkpointInterval;
        return {frame:foundframe, state:this.buffer[foundidx]};
    }

    loadFrame(seekframe : number) {
        let {frame,state} = this.getStateAtOrBefore(seekframe);
        if (state) {
            this.platform.pause();
            this.platform.loadState(state);
            while (frame < seekframe) {
                if (frame < this.controls.length) {
                    this.platform.loadControlsState(this.controls[frame]);
                }
                this.platform.advance(true); // TODO: infinite loop?
                frame++;
            }
            this.platform.advance();
            this.lastSeekFrame = seekframe;
        }
    }
}
