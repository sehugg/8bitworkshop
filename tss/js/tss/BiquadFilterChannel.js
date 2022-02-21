/**
 * T'SoundSystem for JavaScript
 */

/**
 * BiquadFilterChannel prototype
 *
 * This prototype implements biquad IIR filter channel.
 * @author Takashi Toyoshima <toyoshim@gmail.com>
 */
var BiquadFilterChannel = function () {
    this.zL = 0;
    this.zR = 0;
    this.zzL = 0;
    this.zzR = 0;
    this.a0 = 1;
    this.a1 = 0;
    this.a2 = 0;
    this.b0 = 1;
    this.b1 = 0;
    this.b2 = 0;
    this.inBuffer = null;
    this.outBuffer = null;
    this.bufferLength = 0;
    this.channel = null;
    this.sampleRate = MasterChannel.DEFAULT_SAMPLE_FREQUENCY;
}

BiquadFilterChannel.TYPE_LPF = 'LPF';
BiquadFilterChannel.TYPE_HPF = 'HPF';
BiquadFilterChannel.TYPE_BPF = 'BPF';
BiquadFilterChannel.TYPE_BEF = 'BEF';
BiquadFilterChannel.TYPE_APF = 'APF';
BiquadFilterChannel.TYPE_PEQ = 'PEQ';
BiquadFilterChannel.TYPE_LOS = 'LOS';
BiquadFilterChannel.TYPE_HIS = 'HIS';
BiquadFilterChannel.TYPE_BPF_TYPE1 = BiquadFilterChannel.TYPE_BPF;
BiquadFilterChannel.TYPE_BPF_TYPE2 = 'BPF2';
BiquadFilterChannel.TYPE_NOTCH = BiquadFilterChannel.TYPE_BEF;
BiquadFilterChannel.TYPE_EQ = BiquadFilterChannel.TYPE_PEQ;
BiquadFilterChannel.TYPE_PEAKING_EQ = BiquadFilterChannel.TYPE_PEQ;
BiquadFilterChannel.TYPE_LOW_SHELF = BiquadFilterChannel.TYPE_LOS;
BiquadFilterChannel.TYPE_HIGH_SHELF = BiquadFilterChannel.TYPE_HIS;

/**
 * @see MasterChannel
 * @param length buffer length or size in shorts
 */
BiquadFilterChannel.prototype.setBufferLength = function (length) {
    this.outBuffer = new Int32Array(length);
    this.bufferLength = length;
    if (null != this.channel) {
        this.channel.setBufferLength(length);
        this.inBuffer = this.channel.getBuffer();
    }
};

/**
 * @see MasterChannel
 * @param rate sample rate
 */
BiquadFilterChannel.prototype.setSampleRate = function (rate) {
  this.sampleRate = rate;
  if (this.channel)
      this.channel.setSampleRate(this.sampleRate);
};

/**
 * @see MasterChannel
 * @return audio stream buffer
 */
BiquadFilterChannel.prototype.getBuffer = function () {
    return this.outBuffer;
};

/**
 * Set processing channel.
 * @param channel channel to process
 */
BiquadFilterChannel.prototype.setChannel = function (channel) {
    if ((0 != this.bufferLength) && (null != channel)) {
        channel.setBufferLength(this.bufferLength);
        channel.setSampleRate(this.sampleRate);
        this.inBuffer = channel.getBuffer();
    }
    this.channel = channel;
};

/**
 * Set filter characteristic by direct parameter.
 * These direct parameter realize the transfer function as
 *         b0 + b1*z^-1 + b2*z^-2
 * H(z) = ------------------------
 *         a0 + a1*z^-1 + a2*z^-2
 * @param a0 a0 of the transfer function
 * @param a1 a1 of the transfer function
 * @param a2 a2 of the transfer function
 * @param b0 a0 of the transfer function
 * @param b1 b1 of the transfer function
 * @param b2 b2 of the transfer function
 */
BiquadFilterChannel.prototype.setDirectParameter =
        function (a0, a1, a2, b0, b1, b2) {
    this.a0 = 1;
    this.a1 = a1 / a0;
    this.a2 = a2 / a0;
    this.b0 = b0 / a0;
    this.b1 = b1 / a0;
    this.b2 = b2 / a0;
};

/**
 * Set filter characteristic by sound parameter.
 * @param type filter type
 * @param f cutoff frequency
 * @param q resonance
 * @param gain gain for Peaking EQ and Shelf
 */
BiquadFilterChannel.prototype.setParameter = function (type, f, q, gain) {
    var w = 2 * Math.PI * f / this.sampleRate;
    var cosw = Math.cos(w);
    var sinw = Math.sin(w);
    var alpha = sinw / 2 / q;
    if (BiquadFilterChannel.TYPE_LPF == type) {
        var b = 1 - cosw;
        var bb = b / 2;
        this.setDirectParameter(1 + alpha, -2 * cosw, 1 - alpha, bb, b, bb);
    } else if (BiquadFilterChannel.TYPE_HPF == type) {
        var b = 1 + cosw;
        var bb = b / 2;
        this.setDirectParameter(1 + alpha, -2 * cosw, 1 - alpha, bb, -b, bb);
    } else if (BiquadFilterChannel.TYPE_BPF_TYPE1 == type) {
        var b = sinw / 2;
        this.setDirectParameter(1 + alpha, -2 * cosw, 1 - alpha, b, 0, -b);
    } else if (BiquadFilterChannel.TYPE_BPF_TYPE2 == type) {
        var b = alpha;
        this.setDirectParameter(1 + alpha, -2 * cosw, 1 - alpha, b, 0, -b);
    } else if (BiquadFilterChannel.TYPE_BEF == type) {
        var a = -2 * cosw;
        this.setDirectParameter(1 + alpha, a, 1 - alpha, 1, a, 1);
    } else if (BiquadFilterChannel.TYPE_APF == type) {
        var a0 = 1 + alpha;
        var a1 = -2 * cosw;
        var a2 = 1 - alpha;
        this.setDirectParameter(a0, a1, a2, a2, a1, a0);
    } else if (BiquadFilterChannel.TYPE_PEQ == type) {
        var a = Math.pow(10, gain / 40);
        var aa = alpha / a;
        var bb = alpha * a;
        var a1 = -2 * cosw;
        this.setDirectParameter(1 + aa, a1, 1 - aa, 1 + bb, a1, 1 - bb);
    } else if (BiquadFilterChannel.TYPE_LOS == type) {
        var a = Math.pow(10, gain / 40);
        var ap = a + 1;
        var am = a - 1;
        var s = 2 * Math.sqrt(a) * alpha;
        var a0 = ap + am * cosw + s;
        var a1 = -2 * (am + ap * cosw);
        var a2 = ap + am * cosw - s;
        var b0 = a * (ap - am * cosw + s);
        var b1 = 2 * a * (am - ap * cosw);
        var b2 = a * (ap - am * cosw - s);
        this.setDirectParameter(a0, a1, a2, b0, b1, b2);
    } else if (BiquadFilterChannel.TYPE_HIS == type) {
        var a = Math.pow(10, gain / 40);
        var ap = a + 1;
        var am = a - 1;
        var s = 2 * Math.sqrt(a) * alpha;
        var a0 = ap - am * cosw + s;
        var a1 = 2 * (am - ap * cosw);
        var a2 = ap - am * cosw - s;
        var b0 = a * (ap + am * cosw + s);
        var b1 = -2 * a * (am + ap * cosw);
        var b2 = a * (ap + am * cosw - s);
        this.setDirectParameter(a0, a1, a2, b0, b1, b2);
    } else {
        Log.getLog().error("unknown filter type: " + type);
    }
};

/**
 * Calculate frequency response.
 * @param f target frequency
 * @return magnitude for the target frequency
 */
BiquadFilterChannel.prototype.magnitudeResponse = function (f) {
    var w = 2 * Math.PI * f / this.sampleRate;
    var cosw = Math.cos(w);
    var cos2w = Math.cos(2 * w);
    var sinw = Math.sin(w);
    var sin2w = Math.sin(2 * w);
    var numer = {
        r: this.b0 + this.b1 * cosw + this.b2 * cos2w,
        i: 0 - this.b1 * sinw - this.b2 * sin2w
    };
    var denom = {
        r: this.a0 + this.a1 * cosw + this.a2 * cos2w,
        i: 0 - this.a1 * sinw - this.a2 * sin2w
    };
    var rNumer = numer.r * denom.r + numer.i * denom.i;
    var rDenom = denom.r * denom.r + denom.i * denom.i;
    return rNumer / rDenom;
};

/**
 * Generate specified length sound stream into internal buffer.
 * @see MasterChannel
 * @param length sound length in short to generate
 */
BiquadFilterChannel.prototype.generate = function (length) {
    if (null == this.channel) {
        for (var i = 0; i < length; i++)
            this.outBuffer[i] = 0;
        return;
    }

    this.channel.generate(length);
    for (var i = 0; i < length; i += 2) {
        var L = this.inBuffer[i + 0] - this.a1 * this.zL - this.a2 * this.zzL;
        var R = this.inBuffer[i + 1] - this.a1 * this.zR - this.a2 * this.zzR;
        this.outBuffer[i + 0] =
                this.b0 * L + this.b1 * this.zL + this.b2 * this.zzL;
        this.outBuffer[i + 1] =
                this.b0 * R + this.b1 * this.zR + this.b2 * this.zzR;
        this.zzL = this.zL;
        this.zzR = this.zR;
        this.zL = L;
        this.zR = R;
    }
};
