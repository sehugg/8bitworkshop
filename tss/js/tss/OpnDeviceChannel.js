/**
 * T'SoundSystem for JavaScript
 */

/**
 * OpnDeviceChannel prototype
 *
 * This prototype implements OPN sound device as Device and Channel.
 * @author Takashi Toyoshima <toyoshim@gmail.com>
 */
var OpnDeviceChannel = function () {
    this.sampleRate = MasterChannel.DEFAULT_SAMPLE_FREQUENCY;
    this.clock = OpnDeviceChannel.CLOCK_4MHZ;
    this.type = OpnDeviceChannel.DEVICE_YM2203;
    this.ssg = new PsgDeviceChannel();
    this.ssg.setClock(this.clock);
    this.ssg.setMode(PsgDeviceChannel.MODE_UNSIGNED);
    this.ssg.setDevice(PsgDeviceChannel.DEVICE_YM_2149);
    this.buffer = this.ssg.getBuffer();
    this.fms = null;
    this._resetChannels();

}

OpnDeviceChannel.CLOCK_4MHZ = 4000000;
OpnDeviceChannel.CLOCK_3_9936MHZ = 3993600;
OpnDeviceChannel.CLOCK_PC88 = OpnDeviceChannel.CLOCK_3_9936MHZ;
OpnDeviceChannel.CLOCK_PC98 = OpnDeviceChannel.CLOCK_3_9936MHZ;
OpnDeviceChannel.DEVICE_YM2203 = 0;
OpnDeviceChannel.DEVICE_YM2608 = 1;
OpnDeviceChannel.DEVICE_YM2610 = 2;
OpnDeviceChannel.DEVICE_OPN = OpnDeviceChannel.DEVICE_YM2203;

OpnDeviceChannel.prototype._resetChannels = function () {
    var channels;
    if (OpnDeviceChannel.DEVICE_YM2203 == this.type) {
        channels = 3;
    } else {
        Log.getLog().warn("OPN: unsupported device " + this.type);
        return;
    }
    this.fms = new Array(channels);
    for (var i = 0; i < channels; i++)
        this.fms[i] = new FmChannel();
};

/**
 * Set device clock frequency in Hz.
 * @param hz clock frequency in Hz
 */
OpnDeviceChannel.prototype.setClock = function (hz) {
    this.clock = hz;
    this.ssg.setClock(hz);
};

/**
 * Set emulated device target.
 * @param target target device
 */
OpnDeviceChannel.prototype.setDevice = function (target) {
    this.type = target;
    this._resetChannels();
};

/**
 * @see Channel
 * @param length buffer length or size in shorts
 */
OpnDeviceChannel.prototype.setBufferLength = function (length) {
    this.ssg.setBufferLength(length);
    this.buffer = this.ssg.getBuffer();
};

/**
 * @see MasterChannel
 * @param rate sample rate
 */
OpnDeviceChannel.prototype.setSampleRate = function (rate) {
    this.sampleRate = rate;
};

/**
 * @see Channel
 * @return audio stream buffer
 */
OpnDeviceChannel.prototype.getBuffer = function () {
    return this.buffer;
};

/**
 * Generate specified length sound stream into internal buffer.
 * @see Channel
 * @param length sound length in short to generate
 */
OpnDeviceChannel.prototype.generate = function (length) {
    this.ssg.generate(length);
};

/**
 * @see Device
 * @param address register address to write
 * @param value register value to write
 */
OpnDeviceChannel.prototype.writeRegister = function (address, value) {
    if (address <= 0x0f)
        this.ssg.writeRegister(address, value);
    // TODO
};

/**
 * @see Device
 * @param address register address to read
 * @return read register value
 */
OpnDeviceChannel.prototype.readRegister = function (address) {
    // TODO
    return 0;
};
