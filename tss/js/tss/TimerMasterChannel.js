/**
 * T'SoundSystem for JavaScript
 */

/**
 * TimerMasterChannel prototype
 *
 * This prototype provide timer-based loop.
 * @author Takashi Toyoshima <toyoshim@gmail.com>
 */
var TimerMasterChannel = function (mode) {
    this.player = null;
    this.timer = undefined;
    this.interval = 0;
    this.now = Date.now();
    this.useInterval = mode == TimerMasterChannel.MODE_INTERVAL;
    this.useAnimationFrame = mode == TimerMasterChannel.MODE_ANIMATION_FRAME;
    this.useTimerWorker = mode == TimerMasterChannel.MODE_TIMER_WORKER;

    if (this.useAnimationFrame) {
        window.webkitRequestAnimationFrame(this.animationCallback.bind(this));
    }
    if (this.useTimerWorker) {
        this.timer = new Worker("TimerWorker.js");
        this.timer.onmessage = this.callback.bind(this);
    }
}

TimerMasterChannel.MODE_INTERVAL = 0;
TimerMasterChannel.MODE_ANIMATION_FRAME = 1;
TimerMasterChannel.MODE_TIMER_WORKER = 2;
TimerMasterChannel.MODE_DEFAULT = TimerMasterChannel.MODE_TIMER_WORKER;

/**
 * Add channel to audio play back loop.
 * @see MasterChannel
 */
TimerMasterChannel.prototype.addChannel = function (channel) {
};

/**
 * Remove channel from audio play back loop.
 * @see MasterChannel
 */
TimerMasterChannel.prototype.removeChannel = function (channel) {
};

/**
 * Remove all channels from audio play back loop.
 * @see MasterChannel
 */
TimerMasterChannel.prototype.clearChannel = function () {
};

/**
 * Set player object to control devices periodically.
 * @see MasterChannel
 */
TimerMasterChannel.prototype.setPlayer = function (newPlayer) {
    this.player = newPlayer;
};

/**
 * Set time interval to call back player periodically.
 * @see MasterChannel
 */
TimerMasterChannel.prototype.setPlayerInterval = function (msec) {
    this.interval = msec;
    if (this.useInterval) {
        if (this.timer)
            clearInterval(this.timer);
        this.timer = setInterval(this.callback.bind(this), msec);
    }
    if (this.useTimerWorker)
        this.timer.postMessage(msec);
};

TimerMasterChannel.prototype.callback = function () {
    if ((Date.now() - this.now) > 1000)
        this.now = Date.now();

    if (this.interval != 0 && this.player) {
        do {
            this.player.updateDevice();
            this.now += this.interval;
        } while (this.now < Date.now());
    }
};

TimerMasterChannel.prototype.animationCallback = function () {
    this.callback();
    window.webkitRequestAnimationFrame(this.animationCallback.bind(this));
};
