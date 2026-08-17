"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.StateRecorderImpl = void 0;
const emu_1 = require("./emu");
class StateRecorderImpl {
    constructor(platform) {
        this.checkpointInterval = 10;
        this.maxCheckpoints = 300;
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
        if (this.callbackStateChanged)
            this.callbackStateChanged();
    }
    frameRequested() {
        var controls = {
            controls: this.platform.saveControlsState(),
            seed: (0, emu_1.getNoiseSeed)()
        };
        var requested = false;
        // are we replaying? then we don't need to save a frame, just replace controls
        if (this.lastSeekFrame < this.frameCount) {
            this.loadControls(this.lastSeekFrame);
        }
        else {
            // record the control state, if available
            if (this.platform.saveControlsState) {
                this.framerecs.push(controls);
            }
            // time to save next frame?
            requested = (this.frameCount++ % this.checkpointInterval) == 0;
        }
        this.lastSeekFrame++;
        this.lastSeekStep = 0;
        if (this.callbackStateChanged)
            this.callbackStateChanged();
        return requested;
    }
    numFrames() {
        return this.frameCount;
    }
    currentFrame() {
        return this.lastSeekFrame;
    }
    currentStep() {
        return this.lastSeekStep;
    }
    recordFrame(state) {
        this.checkpoints.push(state);
        if (this.callbackNewCheckpoint)
            this.callbackNewCheckpoint(state);
        // checkpoints full?
        if (this.checkpoints.length > this.maxCheckpoints) {
            this.checkpoints.shift(); // remove 1st checkpoint
            this.framerecs = this.framerecs.slice(this.checkpointInterval);
            this.lastSeekFrame -= this.checkpointInterval;
            this.frameCount -= this.checkpointInterval;
            if (this.callbackStateChanged)
                this.callbackStateChanged();
        }
    }
    getStateAtOrBefore(frame) {
        // initial frame?
        if (frame <= 0 && this.checkpoints.length > 0)
            return { frame: 0, state: this.checkpoints[0] };
        var bufidx = Math.floor(frame / this.checkpointInterval);
        var foundidx = bufidx < this.checkpoints.length ? bufidx : this.checkpoints.length - 1;
        var foundframe = foundidx * this.checkpointInterval;
        return { frame: foundframe, state: this.checkpoints[foundidx] };
    }
    loadFrame(seekframe, seekstep) {
        seekframe |= 0;
        seekstep |= 0;
        if (seekframe == this.lastSeekFrame && seekstep == this.lastSeekStep) {
            return seekframe; // already set to this frame
        }
        // TODO: what if < 1?
        let { frame, state } = this.getStateAtOrBefore(seekframe - 1);
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
        }
        else {
            return -1;
        }
    }
    loadControls(frame) {
        if (this.platform.loadControlsState)
            this.platform.loadControlsState(this.framerecs[frame].controls);
        (0, emu_1.setNoiseSeed)(this.framerecs[frame].seed);
    }
    getLastCheckpoint() {
        return this.checkpoints.length && this.checkpoints[this.checkpoints.length - 1];
    }
}
exports.StateRecorderImpl = StateRecorderImpl;
//# sourceMappingURL=recorder.js.map