/**
 * T'SoundSystem for JavaScript
 */

/**
 * WhiteNoiseChannel prototype
 *
 * This prototype implements white noise generator. This white noise is based
 * on pseudorandom numbers by linear feedback shift register method.
 * @author Takashi Toyoshima <toyoshim@gmail.com>
 */
var WhiteNoiseChannel = function () {
    this.buffer = null;
    this.lfsr = 0xffff;
    this.data = WhiteNoiseChannel.DEFAULT_VOLUME;
}

WhiteNoiseChannel.DEFAULT_VOLUME = 1024;

/**
 * @see MasterChannel
 * @param length buffer length or size in shorts
 */
WhiteNoiseChannel.prototype.setBufferLength = function (length) {
    this.buffer = new Int32Array(length);
};

/**
 * @see MasterChannel
 * @param rate sample rate
 */
WhiteNoiseChannel.prototype.setSampleRate = function (rate) {
};

/**
 * @see MasterChannel
 * @return audio stream buffer
 */
WhiteNoiseChannel.prototype.getBuffer = function () {
    return this.buffer;
};

/**
 * Generate specified length sound stream into internal buffer.
 * @see MasterChannel
 * @param length sound length in short to generate
 */
WhiteNoiseChannel.prototype.generate = function (length) {
    for (var i = 0; i < length; i += 2) {
        var bit = (this.lfsr & 0x0001) ^
                ((this.lfsr & 0x0800) >> 11) ^
                ((this.lfsr & 0x1000) >> 12) ^
                ((this.lfsr & 0x2000) >> 13);
        var data = (0 != bit) ? this.data : -this.data;
        this.lfsr = (this.lfsr >> 1) | (bit << 15);
        this.buffer[i + 0] = data;
        this.buffer[i + 1] = data;
    }
};
