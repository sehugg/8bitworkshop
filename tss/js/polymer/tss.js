Polymer('tss', {
  ready: function () {
    var exports = {};
/**
 * TOYOSHIMA-HOUSE Library for JavaScript
 */

/**
 * Log prototype
 *
 * This prototype provide common log interfaces.
 * @author Takashi Toyoshima <toyoshim@gmail.com>
 *
 */

/**
 * Log prototype function. This prototype provide three kinds of Log
 * mechanisms. User can specify its type by id argument.
 * @param id Log type
 *     undefined: Use native console.log if it's available.
 *     null: Eliminate all logs.
 *     <string>: Output as pre element under DOM object which has <string> id.
 * @param reverse logging order
 *     true: Newer logs will be added to tail.
 *     false: Newer logs will be added to head.
 */
var Log = function (id, reverse) {
    this.lastLevel = "";
    this.reverse = reverse;

    // Set default log scheme.
    this.print = function (object) { /* Do nothing. */ }

    if (id == undefined) {
        // Try to use native console.
        // node.js doesn't have window, but has console.log.
        if ((typeof window === "undefined") ||
                (window.console != undefined)) {
            this.print = function (object) {
                console.log(object);
            }
        }
    } else if (id != null) {
        // Try to output under specified DOM object.
        this.frameDiv = document.getElementById(id);
        if (this.frameDiv == undefined)
            return;
        this.framePre = document.createElement('pre');
        this.frameDiv.appendChild(this.framePre);

        this.print = function (object) {
            if (window.console != undefined) {
                console.log(object);
            }
            var element;
            if (object instanceof Object) {
                element = document.createElement('pre');
                var text = object.toString();
                var textNode = document.createTextNode(text);
                element.appendChild(textNode);
                var title = "";
                for (var item in object) {
                    title += item + ":" + object[item] + "; \n";
                }
                element.setAttribute('title', title);
            } else {
                element = document.createTextNode(object + "\n");
            }
            if (this.reverse && this.framePre.firstChild)
                this.framePre.insertBefore(element, this.framePre.firstChild);
            else
                this.framePre.appendChild(element);
        }
    }
}

Log.log = new Log();

/**
 * Set default log instance.
 * @param newLog Log instance to set
 */
Log.setLog = function (newLog) {
    Log.log = newLog;
};

/**
 * Get default log instance.
 * @return default Log instance
 */
Log.getLog = function () {
    return Log.log;
};

/**
 * Log fatal message.
 * @param message fatal message
 */
Log.prototype.fatal = function (message) {
    if (this.LastLevel != "FATAL") {
        this.LastLevel = "FATAL";
        this.print("*FATAL*");
    }
    this.print(message);
};

/**
 * Log error message.
 * @param message error message
 */
Log.prototype.error = function (message) {
    if (this.LastLevel != "ERROR") {
        this.LastLevel = "ERROR";
        this.print("*ERROR*");
    }
    this.print(message);
};

/**
 * Log warning message.
 * @param message warning message
 */
Log.prototype.warn = function (message) {
    if (this.LastLevel != "WARN") {
        this.LastLevel = "WARN";
        this.print("*WARN*");
    }
    this.print(message);
};

/**
 * Log information message.
 * @param message information message
 */
Log.prototype.info = function (message) {
    if (this.LastLevel != "INFO") {
        this.LastLevel = "INFO";
        this.print("*INFO*");
    }
    this.print(message);
};

exports.Log = Log;
/**
 * T'SoundSystem for JavaScript (Web Audio API / Audio Data API)
 */

/**
 * AudioPlayback prototype
 *
 * This prototype provides an audio output stream for real time sound
 * rendering.
 * @author Takashi Toyoshima <toyoshim@gmail.com>
 *
 * @constructor
 */
var AudioLooper = function (bufferSize) {
    this.bufferSize = 4096;  // 92msec
    if (bufferSize !== undefined)
        this.bufferSize = bufferSize;
    // Initialize variables.
    this.channel = null;
    this.initialized = true;
    this.firstAudioEvent = null;
    this.sampleRate = 44100;

    // Web Audio API on Chrome, Safari, and Firefox.
    if (window['webkitAudioContext'] || window['AudioContext']) {
        Log.getLog().info("AudioLooper: detect Web Audio API");
        this.audioContext = new webkitAudioContext() || new AudioContext();
        if (this.audioContext == null) {
            Log.getLog().fatal('AudioLooper: could not create AudioContext');
            this.initialized = false;
            return;
        }
        this.sampleRate = this.audioContext.sampleRate;
        Log.getLog().info('AudioLooper: sample rate is ' + this.sampleRate);

        // Allocate JavaScript synthesis node.
        this.bufferSource = this.audioContext['createBufferSource']();
        this.jsNode = this.audioContext['createScriptProcessor'](
                this.bufferSize, 2, 2);

        // Register callback
        this.jsNode['onaudioprocess'] = function (event) {
            this.onAudioProcess(event);
        }.bind(this);

        // Connect to output audio device.
        if (this.bufferSource['noteOn'])
            this.bufferSource['noteOn'](0);
        this.bufferSource['connect'](this.jsNode);
        this.jsNode['connect'](this.audioContext['destination']);

        return;
    }

    // Audio Data API on Firefox (deprecated).
    if (window['Audio']) {
        Log.getLog().info("AudioLooper: detect Audio Data API");
        this.audio = new Audio();
        if ((this.audio == null) || (this.audio['mozSetup'] == undefined)) {
            Log.getLog().fatal("AudioLooper: could not use Audio Data API");
            this.initialized = false;
            return;
        }

        // Set up playback configuration.
        this.audioChannel = 2;
        this.audioFrequency = 44100;
        this.audio['mozSetup'](this.audioChannel, this.audioFrequency);

        // Set up output buffer.
        this.bufferId = 0;
        this.bufferPage = 4;
        this.bufferWritten = 0;
        this.buffer = new Array(this.bufferPage);
        var arraySize = this.bufferSize * this.audioChannel;
        for (var i = 0; i < this.bufferPage; i++) {
            this.buffer[i] = new Float32Array(arraySize);
            this.bufferWritten += this.audio['mozWriteAudio'](this.buffer[i]);
        }

        // Register callback with 50msec interval.
        this.audio.owner = this;

        // Set half time of buffer playback time.
        var interval = this.bufferSize * 1000 / 44100 / 2;
        setInterval(function (object) { object.onAudioInterval() }, interval,
            this);

        return;
    }
    Log.getLog().error("AudioLooper: no known Audio API are available");
    this.initialized = false;
}

/**
 * Get sample rate.
 * @return {number} sample rate
 */
AudioLooper.prototype.getSampleRate = function () {
    return this.sampleRate;
};

/**
 * Register sound generator.
 * @param {Object} newChannel sound generator
 */
AudioLooper.prototype.setChannel = function (newChannel) {
    if (null != newChannel) {
        newChannel.setBufferLength(this.bufferSize * 2);
        newChannel.setSampleRate(this.sampleRate);
    }
    this.channel = newChannel;
};

/**
 * Audio processing event handler for Web Audio API.
 * @param {Object} event AudioProcessingEvent
 */
AudioLooper.prototype.onAudioProcess = function (event) {
    // Logged event contents at the first event.
    if (null == this.firstAudioEvent) {
        this.firstAudioEvent = true;
        Log.getLog().info(event);
    }

    // Get Float32Array output buffer.
    var lOut = event['outputBuffer']['getChannelData'](0);
    var rOut = event['outputBuffer']['getChannelData'](1);

    // Process no input channel.
    var i;
    if (null == this.channel) {
        for (i = 0; i < this.bufferSize; i++) {
            lOut[i] = 0.0;
            rOut[i] = 0.0;
        }
        return;
    }

    // Get Int32Array input buffer.
    this.channel.generate(this.bufferSize * 2);
    var lrIn = this.channel.getBuffer();

    // Process buffer conversion.
    for (i = 0; i < this.bufferSize; i++) {
        lOut[i] = lrIn[i * 2 + 0] / 32768.0;
        rOut[i] = lrIn[i * 2 + 1] / 32768.0;
    }
};

/**
 * Audio interval callback handler for Audio Data API.
 */
AudioLooper.prototype.onAudioInterval = function () {
    // Logged event contents at the first event.
    if (null == this.firstAudioEvent) {
        this.firstAudioEvent = true;
        Log.getLog().info("onAudioInterval");
        Log.getLog().info(this);
    }

    // Check buffer status.
    var audioRead = this.audio['mozCurrentSampleOffset']();
    var pageSize = this.bufferSize * this.audioChannel;
    var pageOffset = audioRead % (pageSize * this.bufferPage);
    var playingPage = ~~(pageOffset / pageSize);
    if (this.bufferId == playingPage &&
            this.bufferWritten != audioRead) {
        // Buffers are busy.
        return;
    }

    // Update buffer tracking variables.
    var lrOut = this.buffer[this.bufferId];
    this.bufferId = (this.bufferId + 1) % this.bufferPage;

    // Process next buffer.
    var i;
    if (null == this.channel) {
        // Process no input channel.
        for (i = 0; i < this.bufferSize; i++) {
            lrOut[i * 2 + 0] = 0.0;
            lrOut[i * 2 + 1] = 0.0;
        }
    } else {
        // Process buffer conversion.
        this.channel.generate(this.bufferSize * this.audioChannel);
        var lrIn = this.channel.getBuffer();
        for (i = 0; i < this.bufferSize; i++) {
            lrOut[i * 2 + 0] = lrIn[i * 2 + 0] / 32768.0;
            lrOut[i * 2 + 1] = lrIn[i * 2 + 1] / 32768.0;
        }
    }

    // Play next buffer.
    this.bufferWritten += this.audio['mozWriteAudio'](lrOut);
};

/**
 * Check if this audio playback loop runs actively.
 * @return {boolean} true if this audio playback loop runs actively
 */
AudioLooper.prototype.isActive = function () {
    // iOS requires to kick noteOn(0) from a UI action handler.
    if (this.audioContext && this.audioContext['currentTime'] == 0)
        return false;
    return true;
};

/**
 * Activate audio playback loop.
 */
AudioLooper.prototype.activate = function () {
    if (this.isActive())
        return;
    this.bufferSource['noteOn'](0);
};

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
/**
 * T'SoundSystem for JavaScript
 */

/**
 * Format prototype
 *
 * Contain data read and write functions.
 * TODO: Use this prototype from all files in the library.
 * @author Takashi Toyoshima <toyoshim@gmail.com>
 */
var Format = function () {
    this.endian = Format.BIG_ENDIAN;
}

Format.BIG_ENDIAN = 0;
Format.LITTLE_ENDIAN = 1;

Format.readI32BE = function (data, offset) {
    return (data[offset] << 24) | (data[offset + 1] << 16) |
            (data[offset + 2] << 8) | data[offset + 3];
};

Format.readU32BE = function (data, offset) {
    var i32 = Format.readI32BE(data, offset);
    if (i32 < 0)
        return 0x100000000 + i32;
    return i32;
};

Format.readI32LE = function (data, offset) {
    return data[offset] | (data[offset + 1] << 8) |
        (data[offset + 2] << 16) | (data[offset + 3] << 24);
};

Format.readU32LE = function (data, offset) {
    var i32 = Format.readI32LE(data, offset);
    if (i32 < 0)
        return 0x100000000 + i32;
    return i32;
};

Format.stringLength = function (data, offset) {
    var length = 0;
    for (var i = offset; i < data.byteLength; i++) {
        if (0 == data[offset])
            break;
        length++;
    }
    return length;
};

Format.prototype.setDefaultEndian = function (endian) {
    this.endian = endian;
};

Format.prototype.readI32 = function (data, offset) {
    if (this.endian == Format.BIG_ENDIAN)
        return Format.readI32BE(data, offset);
    return Format.readI32LE(data, offset);
};

Format.prototype.readU32 = function (data, offset) {
    if (this.endian == Format.BIG_ENDIAN)
        return Format.readU32BE(data, offset);
    return Format.readU32LE(data, offset);
};
/**
 * T'SoundSystem for JavaScript
 */

/**
 * FrequencyConversionChannel prototype
 *
 * This prototype implements frequency conversion channel.
 * @author Takashi Toyoshima <toyoshim@gmail.com>
 */
var FrequencyConversionChannel = function () {
    this.type = FrequencyConversionChannel.TYPE_NO_CONVERSION;
    this.inFrequency = 44100;
    this.outFrequency = 44100;
    this.inBuffer = null;
    this.outBuffer = null;
    this.bufferLength = 0;
    this.channel = null;
    this.converter = null;
    this.filter = null;
}

FrequencyConversionChannel.TYPE_NO_CONVERSION = 0;
FrequencyConversionChannel.TYPE_UP_SAMPLING = 1;
FrequencyConversionChannel.TYPE_DOWN_SAMPLING = 2;

/**
 * @see MasterChannel
 * @param length buffer length or size in shorts
 */
FrequencyConversionChannel.prototype.setBufferLength = function (length) {
    this.outBuffer = new Int32Array(length);
    this.bufferLength = length;
    this._reconstruct();
};

/**
 * @see MasterChannel
 * @param rate sample rate
 */
FrequencyConversionChannel.prototype.setSampleRate = function (rate) {
};


/**
 * @see MasterChannel
 * @return audio stream buffer
 */
FrequencyConversionChannel.prototype.getBuffer = function () {
    return this.outBuffer;
};

/**
 * Set processing channel.
 * @param channel channel to process
 */
FrequencyConversionChannel.prototype.setChannel = function (channel) {
    this.channel = channel;
    this._reconstruct();
};

/**
 * Set input frequency.
 * @param frequency input frequency
 */
FrequencyConversionChannel.prototype.setInputFrequency = function (frequency) {
    this.inFrequency = frequency;
    this._reconstruct();
}
 
/**
 * Set output frequency.
 * @param frequency output frequency
 */
FrequencyConversionChannel.prototype.setOutputFrequency = function (frequency) {
    this.outFrequency = frequency;
    this._reconstruct();
}

/**
 * Generate specified length sound stream into internal buffer.
 * @see MasterChannel
 * @param length sound length in short to generate
 */
FrequencyConversionChannel.prototype.generate = function (length) {
    if (this.outBuffer === null)
        return;
    var i;
    if (this.channel === null || this.inBuffer == null) {
        for (i = 0; i < length; ++i)
            this.outBuffer[i] = 0;
        return;
    }
    
    if (this.type == FrequencyConversionChannel.TYPE_NO_CONVERSION)
        this.channel.generate(length);
    else if (this.type == FrequencyConversionChannel.TYPE_UP_SAMPLING)
        this.filter.generate(length);
    else
        this.converter.generate(length);
    for (i = 0; i < length; ++i)
        this.outBuffer[i] = this.inBuffer[i];
};

/**
 * Reconstruct internal processing chains.
 */
FrequencyConversionChannel.prototype._reconstruct = function () {
    if (this.inFrequency == this.outFrequency) {
        // output <= input channel
        this.type = FrequencyConversionChannel.TYPE_NO_CONVERSION;
        this.converter = null;
        this.filter = null;
        if (this.channel && this.bufferLength !== 0) {
            this.channel.setBufferLength(this.bufferLength);
            this.inBuffer = this.channel.getBuffer();
        } else {
            this.inBuffer = null;
        }
    } else if (this.inFrequency < this.outFrequency) {
        // output <= interpolation filter <= convertion <= input channel
        this.type = FrequencyConversionChannel.TYPE_UP_SAMPLING;
        this.filter = new BiquadFilterChannel();
        this.filter.setParameter(BiquadFilterChannel.TYPE_LPF,
                                 this.inFrequency / 2 * 0.9, 0.9, 20);
        this.converter = new FrequencyConversionChannel.ConversionChannel();
        this.converter.setInputFrequency(this.inFrequency);
        this.converter.setOutputFrequency(this.outFrequency);
        this.filter.setChannel(this.converter);
        if (this.bufferLength !== 0) {
            this.filter.setBufferLength(this.bufferLength);
            this.inBuffer = this.filter.getBuffer();
        } else {
            this.inBuffer = null;
        }
        if (this.channel !== null)
            this.converter.setChannel(this.channel);
    } else {
        // output <= convertion <= dicimation filter <= input channel
        this.type = FrequencyConversionChannel.TYPE_DOWN_SAMPLING;
        this.converter = new FrequencyConversionChannel.ConversionChannel();
        this.converter.setInputFrequency(this.inFrequency);
        this.converter.setOutputFrequency(this.outFrequency);
        if (this.bufferLength != 0) {
            this.converter.setBufferLength(this.bufferLength);
            this.inBuffer = this.converter.getBuffer();
        } else {
            this.inBuffer = null;
        }
        if (this.channel != null)
          this.converter.setChannel(this.channel);
        // TODO: add dicimation filter.
        this.filter = null;
    }
}

/**
 * ConversionChannel prototype
 *
 * This prototype implements frequency conversion channel.
 * @author Takashi Toyoshima <toyoshim@gmail.com>
 */
FrequencyConversionChannel.ConversionChannel = function () {
    this.count = 0;
    this.inFrequency = 44100;
    this.outFrequency = 44100;
    this.inBuffer = null;
    this.outBuffer = null;
    this.bufferLength = 0;
    this.channel = null;
    this.inOffset = 0;
    this.lastL = 0;
    this.lastR = 0;
};

/**
 * @see MasterChannel
 * @param length buffer length or size in shorts
 */
FrequencyConversionChannel.ConversionChannel.prototype.setBufferLength =
        function (length) {
    this.outBuffer = new Int32Array(length);
    this.bufferLength = length;
    if (null !== this.channel) {
        this.channel.setBufferLength(length);
        this.inBuffer = this.channel.getBuffer();
    }
};

/**
 * @see MasterChannel
 * @return audio stream buffer
 */
FrequencyConversionChannel.ConversionChannel.prototype.getBuffer = function () {
    return this.outBuffer;
};

/**
 * Set processing channel.
 * @param channel channel to process
 */
FrequencyConversionChannel.ConversionChannel.prototype.setChannel =
        function (channel) {
    if ((0 !== this.bufferLength) && (null !== channel)) {
        channel.setBufferLength(this.bufferLength);
        this.inBuffer = channel.getBuffer();
    }
    this.channel = channel;
};

/**
 * Set input frequency.
 * @param frequency input frequency
 */
FrequencyConversionChannel.ConversionChannel.prototype.setInputFrequency =
        function (frequency) {
    this.inFrequency = frequency;
}
 
/**
 * Set output frequency.
 * @param frequency output frequency
 */
FrequencyConversionChannel.ConversionChannel.prototype.setOutputFrequency =
        function (frequency) {
    this.outFrequency = frequency;
}

/**
 * Generate specified length sound stream into internal buffer.
 * @see MasterChannel
 * @param length sound length in short to generate
 */
FrequencyConversionChannel.ConversionChannel.prototype.generate =
        function (length) {
    var i;
    if (null === this.channel) {
        for (i = 0; i < length; ++i)
            this.outBuffer[i] = 0;
        return;
    }

    if (this.inFrequency == this.outFrequency) {
        // No conversion.
        this.channel.generate(length);
        for (i = 0; i < length; ++i)
            this.outBuffer[i] = this.inBuffer[i];
    } else if (this.inFrequency < this.outFrequency) {
        // Up sampling.
        var num = length >> 1;
        if (this.lastL === undefined)
            num++;
        var lastStep = this.count + this.inFrequency * num;
        var inNum = lastStep / this.outFrequency;
        var inLength = inNum << 1;
        var inOffset = (this.lastL !== undefined) ? -2 : 0;
        this.channel.generate(inLength);
        for (i = 0; i < length; i += 2) {
            if (this.count >= 0) {
                if (inOffset < 0) {
                    this.outBuffer[i + 0] = this.lastL;
                    this.outBuffer[i + 1] = this.lastR;
                } else {
                    this.outBuffer[i + 0] = this.inBuffer[inOffset + 0];
                    this.outBuffer[i + 1] = this.inBuffer[inOffset + 1];
                }
                inOffset += 2;
                this.count -= this.outFrequency;
            } else {
                this.outBuffer[i + 0] = 0;
                this.outBuffer[i + 1] = 0;
            }
            this.count += this.inFrequency;
        }
        if (inOffset < inLength) {
            this.lastL = this.inBuffer[inOffset + 0];
            this.lastR = this.inBuffer[inOffset + 1];
        } else {
            this.lastL = undefined;
            this.lastR = undefined;
        }
    } else {
        // Down sampling.
        // TODO: make conversion from k-rate to a-rate.
        for (i = 0; i < length; i += 2) {
            while (this.count < 0) {
                this.inOffset += 2;
                this.count += this.outFrequency;
            }
            while (this.inOffset >= this.bufferLength) {
                this.channel.generate(length);
                this.inOffset -= this.bufferLength;
            }
            this.outBuffer[i + 0] = this.inBuffer[this.inOffset + 0];
            this.outBuffer[i + 1] = this.inBuffer[this.inOffset + 1];
            this.inOffset += 2;
            if (this.inOffset == this.bufferLength)
                this.inOffset = 0;
            this.count -= this.inFrequency - this.outFrequency;
        }
    }
};
/**
 * T'SoundSystem for JavaScript
 */

/**
 * MasterChannel prototype
 *
 * This prototype provide main audio generation loop.
 * @author Takashi Toyoshima <toyoshim@gmail.com>
 *
 * @constructor
 */
var MasterChannel = function () {
    this.channels = new Array();
    this.buffers = null;
    this.buffer = null;
    this.bufferLength = 0;
    this.player = null;
    this.intervalMsec = 0;
    this.intervalLength = 0;
    this.intervalRestLength = 0;
    this.volume = MasterChannel.DEFAULT_VOLUME;
    this.sampleRate = MasterChannel.DEFAULT_SAMPLE_FREQUENCY;
}

MasterChannel.DEFAULT_SAMPLE_FREQUENCY = 44100;
MasterChannel.MAX_WAVE_VALUE = 32767;
MasterChannel.MIN_WAVE_VALUE = -32767;
MasterChannel.MSEC_PER_SEC = 1000;
MasterChannel.DEFAULT_VOLUME = 8;

/**
 * Reconstruct slave buffer references.
 */
MasterChannel.prototype.reconstructBuffers = function () {
    var newBuffers = new Array(this.channels.length);
    for (var i = 0; i < this.channels.length; i++)
        newBuffers[i] = this.channels[i].getBuffer();
    this.buffers = newBuffers;
};

/**
 * Set mixing volume.
 * Every device sets maximum volume of each sound channel
 * as one sixteenth to avoid sound saturation.
 * If you want to maximize sounds set sixteen as volume.
 * It is the default value.
 * @param newVolume volume
 */
MasterChannel.prototype.setVolume = function (newVolume) {
    this.volume = newVolume;
};

/**
 * Add channel to audio play back loop.
 * @param channel channel to add
 * @return result
 */
MasterChannel.prototype.addChannel = function (channel) {
    var result = this.channels.push(channel);
    channel.setSampleRate(this.sampleRate);
    if (0 != this.bufferLength) {
        channel.setBufferLength(this.bufferLength);
        this.reconstructBuffers();
    }
    return result;
};

/**
 * Remove channel from audio play back loop.
 * @param channel channel to remove
 * @return result
 */
MasterChannel.prototype.removeChannel = function (channel) {
    for (var i = 0; i < this.channels.length; i++)
        if (channel == this.channels[i]) {
            this.buffers = null;
            this.channels.splice(i, 1);
            this.reconstructBuffers();
            return true;
        }
    return false;
};

/**
 * Remove all channels from audio play back loop.
 */
MasterChannel.prototype.clearChannel = function () {
    this.buffers = null;
    this.channels = new Array();
    this.reconstructBuffers();
};

/**
 * Set player object to control devices periodically.
 * @param newPlayer player to call back
 */
MasterChannel.prototype.setPlayer = function (newPlayer) {
    this.player = newPlayer;
};

/**
 * Set time interval to call back player periodically.
 * @param msec time interval
 */
MasterChannel.prototype.setPlayerInterval = function (msec) {
    this.intervalMsec = msec;
    this.intervalLength = (2 * this.sampleRate * msec) /
            MasterChannel.MSEC_PER_SEC;
    this.intervalLength &= ~1;
    this.intervalRestLength = this.intervalLength;
};

/**
 * Do partial slave channel audio mixing.
 * @param base base offset to generate
 * @param length buffer length to generate
 */
MasterChannel.prototype._generate = function (base, length) {
    var channels = this.channels.length;
    var ch;
    for (ch = 0; ch < channels; ch++)
        this.channels[ch].generate(length);
    for (var offset = 0; offset < length; offset++) {
        var value = 0;
        for (ch = 0; ch < channels; ch++)
            value += this.buffers[ch][offset];
        value *= this.volume;
        if (value > MasterChannel.MAX_WAVE_VALUE)
            value = MasterChannel.MAX_WAVE_VALUE;
        else if (value < MasterChannel.MIN_WAVE_VALUE)
            value = MasterChannel.MIN_WAVE_VALUE;
        this.buffer[base + offset] = value;
    }
};

/**
 * Set internal buffer length.
 * @param length buffer length or size in shorts
 */
MasterChannel.prototype.setBufferLength = function (length) {
    this.buffers = null;
    this.buffer = new Int32Array(length);
    this.bufferLength = length;
    for (var i = 0; i < this.channels.length; i++)
        this.channels[i].setBufferLength(length);
    this.reconstructBuffers();
};

/**
 * Set sample rate.
 * @param rate sample rate
 */
MasterChannel.prototype.setSampleRate = function (rate) {
    this.sampleRate = rate;
    for (var i = 0; i < this.channels.length; i++)
        this.channels[i].setSampleRate(rate);
    this.setPlayerInterval(this.intervalMsec);
};

/**
 * Get internal buffer.
 * @return audio stream buffer
 */
MasterChannel.prototype.getBuffer = function () {
    return this.buffer;
};

/**
 * Generate audio stream to internal buffer.
 * @param length buffer length or size in shorts to generate audio stream
 */
MasterChannel.prototype.generate = function (length) {
    if (null == this.buffers)
        return;
    if ((null == this.player) || (0 == this.intervalLength)) {
        this._generate(0, length);
    } else {
        var restLength = length;
        var offset = 0;
        while (restLength > this.intervalRestLength) {
            this._generate(offset, this.intervalRestLength);
            restLength -= this.intervalRestLength;
            offset += this.intervalRestLength;
            this.intervalRestLength = this.intervalLength;
            this.player.updateDevice();
        }
        if (0 != restLength) {
            this._generate(offset, restLength);
            this.intervalRestLength -= restLength;
        }
    }
};
/**
 * T'SoundSystem for JavaScript
 */

/**
 * MidiChannel base prototype
 *
 * Abstract MIDI device.
 * @author Takashi Toyoshima <toyoshim@gmail.com>
 */
var MidiChannel = function () {
    this.events = [];
}

MidiChannel.EVENT_TYPE_MIDI = 0;
MidiChannel._NOTE_FREQUENCY_TABLE = [];
MidiChannel._PANPOT_TABLE = [];
MidiChannel._MIDI_EVENT_SYSEX = 0xf0;
MidiChannel._MIDI_EVENT_MTC_QUOTER_FRAME_MESSAGE = 0xf1;
MidiChannel._MIDI_EVENT_SONG_POSITION_POINTER = 0xf2;
MidiChannel._MIDI_EVENT_SONG_SELECT = 0xf3;
MidiChannel._MIDI_EVENT_TUNE_REQUEST = 0xf6;
MidiChannel._MIDI_EVENT_EOX = 0xf7;
MidiChannel._MIDI_EVENT_TIMING_CLOCK = 0xf8;
MidiChannel._MIDI_EVENT_START = 0xfa;
MidiChannel._MIDI_EVENT_CONTINUE = 0xfb;
MidiChannel._MIDI_EVENT_STOP = 0xfc;
MidiChannel._MIDI_EVENT_ACTIVE_SENCING = 0xfe;
MidiChannel._MIDI_EVENT_SYSTEM_RESET = 0xff;
MidiChannel._MIDI_EVENT_SYSTEM_LENGTH = [ -1, 2, 3, 2, -1, -1, 1, 1 ];

// Calculate tables.
(function () {
    var i;
    // MIDI note 69 = A4 = 440Hz
    for (i = 0; i < 0x80; ++i)
        MidiChannel._NOTE_FREQUENCY_TABLE[i] =
                440 * Math.pow(2, (i - 69) / 12);
    
    // 0=1(L) < 64(C) < 127(R)
    MidiChannel._PANPOT_TABLE[0] = 1;
    for (i = 1; i < 128; ++i) {
        var rad = (i - 1) * Math.PI / 2 / 126;
        MidiChannel._PANPOT_TABLE[i] = Math.cos(rad);
    }
    MidiChannel._PANPOT_TABLE[128] = 0;
})();

/**
 * Create MIDI event from an array.
 * @param data an array of MIDI data (TypedArray, Array, or array)
 * @return object
 *      type: event type
 *      midiData: MIDI data of array
 */
MidiChannel.createEvent = function (data) {
    // TODO: Should we check data type and payload here?
    return {
        type: MidiChannel.EVENT_TYPE_MIDI,
        midiData: data
    }
};

/**
 * Get frequency from note.
 * @param note note
 * @return frequency
 */
MidiChannel.getFrequencyForNote = function (note) {
    return MidiChannel._NOTE_FREQUENCY_TABLE[note];
};

/**
 * Get frequency from note and a pitch bend parameter.
 * @param note note
 * @param bend pitch bend
 * @return frequency
 */
MidiChannel.getFrequencyForNoteWithBend = function (note, bend) {
    return MidiChannel._NOTE_FREQUENCY_TABLE[note] *
            Math.pow(2, bend / 8192 / 6);
};

/**
 * Get L and R volume values for a panpot value.
 * @param panpot panpot control value (center: 64)
 * @return object
 *      l: L volume
 *      r: R volume
 */
MidiChannel.getVolumeForPanpot = function (panpot) {
    return {
        l: MidiChannel._PANPOT_TABLE[panpot],
        r: MidiChannel._PANPOT_TABLE[128 - panpot]
    };
};

/**
 * @see MasterChannel
 * @param length buffer length or size in shorts
 */
MidiChannel.prototype.setBufferLength = function (length) {
};

/**
 * @see MasterChannel
 * @param rate sample rate
 */
MidiChannel.prototype.setSampleRate = function (rate) {
};

/**
 * Process MIDI event object containing MIDI events. User can use this function
 * to send MIDI events to virtual MIDI devices which inherit this prototype.
 * Each prototype which inherits this prototype can overwrite this function.
 * But, usually overwriting following process* functions is recommended because
 * splitting raw MIDI byte stream into each MIDI event is a little complicated
 * and mishandling causes critical error to stop event handling.
 * @param events MIDI event object to process
 * @return the number of processed events
 */
MidiChannel.prototype.processEvents = function (events) {
    // Append MIDI events to internal array.
    // TODO: Expand running status here.
    for (var i = 0; i < events.midiData.length; i++) {
        if ((events.midiData[i] < 0x00) || (0xff < events.midiData[i])) {
            Log.getLog().warn("MIDI: midiData[" + i + "] is out of range, " +
                    events.midiData[i]);
            events.midiData[i] &= 0xff;
        }
        if (events.midiData[i] >= 0xf8) {
            if (MidiChannel._MIDI_EVENT_SYSTEM_RESET == events.midiData[i])
                this.processSystemReset();
            else
                this.processSystemRealtimeMessage([ events.midiData[i] ]);
        } else
            this.events.push(events.midiData[i]);
    }

    for (var done = 0; 0 != this.events.length; done++) {
        var event = this.events[0];
        var type = event >> 4;
        var channel = event & 0x0f;
        switch (type) {
            case 0x8:  // note off
                if (this.events.length < 3)
                    return done;
                this.processNoteOff(channel, this.events[1], this.events[2]);
                this.events.splice(0, 3);
                break;
            case 0x9:  // note on
                if (this.events.length < 3)
                    return done;
                if (0 == this.events[2])
                    this.processNoteOff(channel, this.events[1],
                            this.events[2]);
                else
                    this.processNoteOn(channel, this.events[1],
                            this.events[2]);
                this.events.splice(0, 3);
                break;
            case 0xa:  // key pressure
                if (this.events.length < 3)
                    return done;
                this.processKeyPressure(
                        channel, this.events[1], this.events[2]);
                this.events.splice(0, 3);
                break;
            case 0xb:  // control change
                if (this.events.length < 3)
                    return done;
                this.processControlChange(
                        channel, this.events[1], this.events[2]);
                this.events.splice(0, 3);
                break;
            case 0xc:  // program change
                if (this.events.length < 2)
                    return done;
                this.processProgramChange(channel, this.events[1]);
                this.events.splice(0, 2);
                break;
            case 0xd:  // channel pressure
                if (this.events.length < 2)
                    return done;
                this.processChannelPressure(channel, this.events[1]);
                this.events.splice(0, 2);
                break;
            case 0xe:  // pitch bend
                if (this.events.length < 3)
                    return done;
                var bend = (this.events[1] << 7) | this.events[2];
                if (bend > 8191)
                    bend = bend - 16384;
                this.processPitchBend(channel, bend);
                this.events.splice(0, 3);
                break;
            case 0xf:  // system messages
                if (MidiChannel._MIDI_EVENT_SYSEX == event) {
                    // system exclusive
                    for (var sysexLength = 1; sysexLength < this.events.length;
                            sysexLength++) {
                        if (MidiChannel._MIDI_EVENT_EOX ==
                                this.events[sysexLength])
                            break;
                    }
                    if (sysexLength == this.events.length)
                        return done;
                    this.processSystemExclusive(this.events.splice(0,
                        sysexLength + 1));
                } else if (event < 0xf8) {
                    // system common
                    var systemLength =
                            MidiChannel._MIDI_EVENT_SYSTEM_LENGTH[event & 0x7];
                    if (systemLength < 0) {
                        Log.getLog().warn("MIDI: unknown system message " +
                                event.toString(16));
                        systemLength = 1;
                    }
                    if (this.events.length < systemLength)
                        return done;
                    var systemMessage = this.events.splice(0, systemLength);
                    this.processSystemCommonMessage(systemMessage);
                } else {
                    Log.getLog().error("MIDI: unexpected realtime event");
                }
                break;
        }
    }
};

/**
 * Process note off event. This function should be overwritten.
 * @param ch channel
 * @param note note number
 * @param velocity key off velocity
 */
MidiChannel.prototype.processNoteOff = function (ch, note, velocity) {
};

/**
 * Process note on event. This function should be overwritten.
 * @param ch channel
 * @param note note number
 * @param velocity key on velocity
 */
MidiChannel.prototype.processNoteOn = function (ch, note, velocity) {
};

/**
 * Process key pressure event. This function can be overwritten.
 * @param ch channel
 * @param note note number
 * @param pressure key pressure
 */
MidiChannel.prototype.processKeyPressure = function (ch, note, pressure) {
};

/**
 * Process control change event. This function can be overwritten.
 * @param ch channel
 * @param number control number
 * @param value control value
 */
MidiChannel.prototype.processControlChange = function (ch, number, value) {
};

/**
 * Process program change event. This function can be overwritten.
 * @param ch channel
 * @param number channel number
 */
MidiChannel.prototype.processProgramChange = function (ch, number) {
};

/**
 * Process program change event. This function can be overwritten.
 * @param ch channel
 * @param pressure channel pressure
 */
MidiChannel.prototype.processChannelPressure = function (ch, pressure) {
};

/**
 * Process pitch bend event. This function can be overwritten.
 * @param ch channel
 * @param bend pitch bend (-8192 - 8191)
 */
MidiChannel.prototype.processPitchBend = function (ch, bend) {
};

/**
 * Process one system exclusive event. This function can be overwritten.
 * @param sysex a system exclusive event of array
 */
MidiChannel.prototype.processSystemExclusive = function (sysex) {
};

/**
 * Process one system common message event. This function can be overwritten.
 * @param common a system common message event of array
 */
MidiChannel.prototype.processSystemCommonMessage = function (common) {
};

/**
 * Process one system realtime message event. This function can be overwritten.
 * @param realtime a realtime message event of array
 */
MidiChannel.prototype.processSystemRealtimeMessage = function (realtime) {
};

/**
 * Process system reset message event. This function can be overwritten.
 */
MidiChannel.prototype.processSystemReset = function () {
};

/**
 * Process meta data event. This function can be overwritten.
 * @param meta meta data event of array
 */
MidiChannel.prototype.processMetaData = function (meta) {
};
/**
 * T'SoundSystem for JavaScript
 */

/**
 * PsgDeviceChannel prototype
 *
 * This prototype implements PSG sound device as Device and Channel.
 * AY-3-8910 is a reference model.
 * @author Takashi Toyoshima <toyoshim@gmail.com>
 */
var PsgDeviceChannel = function () {
    this.clock = PsgDeviceChannel.CLOCK_3_58MHZ;
    this.mode = PsgDeviceChannel.MODE_UNSIGNED;
    this.device = PsgDeviceChannel.DEVICE_AY_3_8910;
    this.activeRegister = 0;
    this.volumeTable = PsgDeviceChannel._VOLUME_TABLE[
            PsgDeviceChannel.DEVICE_AY_3_8910];
    this.baseStep = 0;
    this.buffer = null;
    this.register = new Int32Array(PsgDeviceChannel._REGISTERS);
    this.volume = new Int32Array(PsgDeviceChannel._CHANNELS);
    this.envelope = new Array(PsgDeviceChannel._CHANNELS);
    this.active = new Array(PsgDeviceChannel._CHANNELS);
    this.seed = PsgDeviceChannel._DEFAULT_AY_SEED;
    this.stepTone = new Int32Array(PsgDeviceChannel._CHANNELS);
    this.countTone = new Int32Array(PsgDeviceChannel._CHANNELS);
    this.mixerTone = new Array(PsgDeviceChannel._CHANNELS);
    this.stepNoise = 0;
    this.countNoise = 0;
    this.mixerNoise = new Array(PsgDeviceChannel._CHANNELS);
    this.feedback = false;
    this.volumeNoise = 0;
    this.sampleRate = MasterChannel.DEFAULT_SAMPLE_FREQUENCY;

    this.setClock(PsgDeviceChannel.CLOCK_3_58MHZ);
    this.setMode(PsgDeviceChannel.MODE_UNSIGNED);
    this.setDevice(PsgDeviceChannel.DEVICE_AY_3_8910);
}

PsgDeviceChannel.CLOCK_4MHZ = 4000000;
PsgDeviceChannel.CLOCK_3_58MHZ = 3579545;
PsgDeviceChannel.MODE_UNSIGNED = 0;
PsgDeviceChannel.MODE_SIGNED = 1;
PsgDeviceChannel.DEVICE_PSG = 0;
PsgDeviceChannel.DEVICE_SSG = 1;
PsgDeviceChannel.DEVICE_AY_3_8910 = 0;
PsgDeviceChannel.DEVICE_YM_2149 = 1;
PsgDeviceChannel.DEVICE_SN76489 = 2;
PsgDeviceChannel.REGISTER_AY_CH_A_TP_LOW = 0;
PsgDeviceChannel.REGISTER_AY_CH_A_TP_HIGH = 1;
PsgDeviceChannel.REGISTER_AY_CH_B_TP_LOW = 2;
PsgDeviceChannel.REGISTER_AY_CH_B_TP_HIGH = 3;
PsgDeviceChannel.REGISTER_AY_CH_C_TP_LOW = 4;
PsgDeviceChannel.REGISTER_AY_CH_C_TP_HIGH = 5;
PsgDeviceChannel.REGISTER_AY_NOISE_TP = 6;
PsgDeviceChannel.REGISTER_AY_MIXER = 7;
PsgDeviceChannel.REGISTER_AY_CH_A_VOLUME = 8;
PsgDeviceChannel.REGISTER_AY_CH_B_VOLUME = 9;
PsgDeviceChannel.REGISTER_AY_CH_C_VOLUME = 10;
PsgDeviceChannel.REGISTER_AY_EP_LOW = 11;
PsgDeviceChannel.REGISTER_AY_EP_HIGH = 12;
PsgDeviceChannel.REGISTER_AY_EP_CONTROL = 13;
PsgDeviceChannel.REGISTER_AY_IO_A = 14;
PsgDeviceChannel.REGISTER_AY_IO_B = 15;
PsgDeviceChannel.REGISTER_SN_CH_A_TP = 8;
PsgDeviceChannel.REGISTER_SN_CH_A_VOLUME = 9;
PsgDeviceChannel.REGISTER_SN_CH_B_TP = 10;
PsgDeviceChannel.REGISTER_SN_CH_B_VOLUME = 11;
PsgDeviceChannel.REGISTER_SN_CH_C_TP = 12;
PsgDeviceChannel.REGISTER_SN_CH_C_VOLUME = 13;
PsgDeviceChannel.REGISTER_SN_NOISE_CONTROL = 14;
PsgDeviceChannel.REGISTER_SN_NOISE_VOLUME = 15;
PsgDeviceChannel.REGISTER_SN_CH_A_TP_HIGH = 0;
PsgDeviceChannel.REGISTER_SN_CH_B_TP_HIGH = 2;
PsgDeviceChannel.REGISTER_SN_CH_C_TP_HIGH = 4;

PsgDeviceChannel._DEFAULT_AY_CH_A_TP_LOW = 0x55;
PsgDeviceChannel._DEFAULT_AY_CH_A_TP_HIGH = 0x00;
PsgDeviceChannel._DEFAULT_AY_CH_B_TP_LOW = 0x00;
PsgDeviceChannel._DEFAULT_AY_CH_B_TP_HIGH = 0x00;
PsgDeviceChannel._DEFAULT_AY_CH_C_TP_LOW = 0x00;
PsgDeviceChannel._DEFAULT_AY_CH_C_TP_HIGH = 0x00;
PsgDeviceChannel._DEFAULT_AY_NOISE_TP = 0x00;
PsgDeviceChannel._DEFAULT_AY_MIXER = 0xb8;
PsgDeviceChannel._DEFAULT_AY_CH_A_VOLUME = 0x00;
PsgDeviceChannel._DEFAULT_AY_CH_B_VOLUME = 0x00;
PsgDeviceChannel._DEFAULT_AY_CH_C_VOLUME = 0x00;
PsgDeviceChannel._DEFAULT_AY_EP_LOW = 0x0b;
PsgDeviceChannel._DEFAULT_AY_EP_HIGH = 0x00;
PsgDeviceChannel._DEFAULT_AY_EP_CONTROL = 0x00;
PsgDeviceChannel._DEFAULT_SN_CH_A_TP = 0x00;
PsgDeviceChannel._DEFAULT_SN_CH_A_VOLUME = 0x0f;
PsgDeviceChannel._DEFAULT_SN_CH_B_TP = 0x00;
PsgDeviceChannel._DEFAULT_SN_CH_B_VOLUME = 0x0f;
PsgDeviceChannel._DEFAULT_SN_CH_C_TP = 0x00;
PsgDeviceChannel._DEFAULT_SN_CH_C_VOLUME = 0x0f;
PsgDeviceChannel._DEFAULT_SN_NOISE_CONTROL = 0xe0;
PsgDeviceChannel._DEFAULT_SN_NOISE_VOLUME = 0xff;
PsgDeviceChannel._DEFAULT_SN_CH_A_TP_HIGH = 0x00;
PsgDeviceChannel._DEFAULT_SN_CH_B_TP_HIGH = 0x00;
PsgDeviceChannel._DEFAULT_SN_CH_C_TP_HIGH = 0x00;
PsgDeviceChannel._REGISTERS = 16;
PsgDeviceChannel._CHANNELS = 3;
PsgDeviceChannel._REGISTER_MIN_VALUE = 0;
PsgDeviceChannel._REGISTER_MAX_VALUE = 255;
PsgDeviceChannel._BITS_PER_BYTE = 8;
PsgDeviceChannel._NOISE_TP_MASK = 0x1f;
PsgDeviceChannel._MIXER_CH_A_TONE = 1;
PsgDeviceChannel._MIXER_CH_A_NOISE = 8;
PsgDeviceChannel._MIXER_CH_B_TONE = 2;
PsgDeviceChannel._MIXER_CH_B_NOISE = 16;
PsgDeviceChannel._MIXER_CH_C_TONE = 4;
PsgDeviceChannel._MIXER_CH_C_NOISE = 32;
PsgDeviceChannel._VOLUME_MASK = 0x0f;
PsgDeviceChannel._ENVELOPE_MASK = 0x10;
PsgDeviceChannel._CH_A = 0;
PsgDeviceChannel._CH_B = 1;
PsgDeviceChannel._CH_C = 2;
PsgDeviceChannel._CLOCK_BIAS = 16000;
PsgDeviceChannel._STEP_BIAS = 18;
PsgDeviceChannel._VOLUME_BIAS = 3;
PsgDeviceChannel._DEFAULT_AY_SEED = -1;
PsgDeviceChannel._DEFAULT_SN_SEED = -32768;
PsgDeviceChannel._UPDATE_SEED_MASK = 0x0009;
PsgDeviceChannel._UPDATE_SEED_RSHIFT = 3;
PsgDeviceChannel._UPDATE_SEED_LSHIFT = 15;
PsgDeviceChannel._SHORT_MASK = 0xffff;
PsgDeviceChannel._HALF_MASK = 0x0f;
PsgDeviceChannel._HALF_SHIFT = 4;
PsgDeviceChannel._BYTE_MSB_MASK = 0x80;
PsgDeviceChannel._ADDRESS_MASK = 0x07;
PsgDeviceChannel._VALUE_MASK = 0x3f;
PsgDeviceChannel._LOWER_TWO_BITS_MASK = 0x03;

PsgDeviceChannel._VOLUME_TABLE = new Array(3);
PsgDeviceChannel._VOLUME_TABLE[PsgDeviceChannel.DEVICE_AY_3_8910] =
        new Int32Array([
                0x00, 0x01, 0x01, 0x02, 0x02, 0x03, 0x03, 0x04,
                0x05, 0x06, 0x07, 0x09, 0x0B, 0x0D, 0x0F, 0x12,
                0x16, 0x1A, 0x1F, 0x25, 0x2D, 0x35, 0x3F, 0x4C,
                0x5A, 0x6A, 0x7F, 0x97, 0xB4, 0xD6, 0xFF, 0xFF]);
PsgDeviceChannel._VOLUME_TABLE[PsgDeviceChannel.DEVICE_YM_2149] =
        new Int32Array([
                0x00, 0x01, 0x01, 0x02, 0x02, 0x03, 0x03, 0x04,
                0x05, 0x06, 0x07, 0x09, 0x0B, 0x0D, 0x0F, 0x12,
                0x16, 0x1A, 0x1F, 0x25, 0x2D, 0x35, 0x3F, 0x4C,
                0x5A, 0x6A, 0x7F, 0x97, 0xB4, 0xD6, 0xFF, 0xFF]);
PsgDeviceChannel._VOLUME_TABLE[PsgDeviceChannel.DEVICE_SN76489] =
        new Int32Array([
                0xFF, 0xCB, 0xA1, 0x80, 0x65, 0x50, 0x40, 0x33,
                0x28, 0x20, 0x19, 0x14, 0x10, 0x0C, 0x0A, 0x00,
                0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00,
                0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00]);
PsgDeviceChannel._NOISE_TP_TABLE = new Int32Array([128, 256, 512, 0]);

/**
 * Set device clock frequency in Hz.
 * @param hz clock frequency in Hz
 */
PsgDeviceChannel.prototype.setClock = function (hz) {
    this.clock = hz; // tone frequency = clock / 32TP
    this.baseStep = PsgDeviceChannel._CLOCK_BIAS * this.clock / this.sampleRate;
    this.baseStep = ~~this.baseStep;
};

/**
 * Set wave form mode.
 * Original device generates unsigned square wave,
 * but it's not match with signed PCM one.
 * Signed mode generates signed square wave aligned to center,
 * and produces double height wave form.
 * @param newMode generate signed or unsigned wave
 */
PsgDeviceChannel.prototype.setMode = function (newMode) {
    this.mode = newMode;
};

/**
 * Set SN76489 register.
 * @param address register address
 * @param valueLow lower four bits to write
 * @param valueHigh higher six bits to write
 */
PsgDeviceChannel.prototype.setRegisterSN = function (address, valueLow,
                                                     valueHigh) {
    this.writeRegisterSN(0, (address << PsgDeviceChannel._HALF_SHIFT) |
            valueLow);
    if ((address == PsgDeviceChannel.REGISTER_SN_CH_A_TP)
            || (address == PsgDeviceChannel.REGISTER_SN_CH_B_TP)
            || (address == PsgDeviceChannel.REGISTER_SN_CH_C_TP)) {
        this.writeRegisterSN(0, valueHigh);
    }
};

/**
 * Initialize SN76489 registers.
 */
PsgDeviceChannel.prototype.initRegisterSN = function () {
    this.setRegisterSN(PsgDeviceChannel.REGISTER_SN_CH_A_TP,
            PsgDeviceChannel._DEFAULT_SN_CH_A_TP,
            PsgDeviceChannel._DEFAULT_SN_CH_A_TP_HIGH);
    this.setRegisterSN(PsgDeviceChannel.REGISTER_SN_CH_A_VOLUME,
            PsgDeviceChannel._DEFAULT_SN_CH_A_VOLUME, 0);
    this.setRegisterSN(PsgDeviceChannel.REGISTER_SN_CH_B_TP,
            PsgDeviceChannel._DEFAULT_SN_CH_B_TP,
            PsgDeviceChannel._DEFAULT_SN_CH_B_TP_HIGH);
    this.setRegisterSN(PsgDeviceChannel.REGISTER_SN_CH_B_VOLUME,
            PsgDeviceChannel._DEFAULT_SN_CH_B_VOLUME, 0);
    this.setRegisterSN(PsgDeviceChannel.REGISTER_SN_CH_C_TP,
            PsgDeviceChannel._DEFAULT_SN_CH_C_TP,
            PsgDeviceChannel._DEFAULT_SN_CH_C_TP_HIGH);
    this.setRegisterSN(PsgDeviceChannel.REGISTER_SN_CH_C_VOLUME,
            PsgDeviceChannel._DEFAULT_SN_CH_C_VOLUME, 0);
    this.setRegisterSN(PsgDeviceChannel.REGISTER_SN_NOISE_CONTROL,
            PsgDeviceChannel._DEFAULT_SN_NOISE_CONTROL, 0);
    this.setRegisterSN(PsgDeviceChannel.REGISTER_SN_NOISE_VOLUME,
            PsgDeviceChannel._DEFAULT_SN_NOISE_VOLUME, 0);
    this.activeRegister = 0;
    this.seed = PsgDeviceChannel._DEFAULT_SN_SEED;
};

/**
 * Initialize AY-3-8910 and YM-2419 registers.
 */
PsgDeviceChannel.prototype.initRegisterAY = function () {
    this.writeRegister(PsgDeviceChannel.REGISTER_AY_CH_A_TP_HIGH,
            PsgDeviceChannel._DEFAULT_AY_CH_A_TP_HIGH);
    this.writeRegister(PsgDeviceChannel.REGISTER_AY_CH_A_TP_LOW,
            PsgDeviceChannel._DEFAULT_AY_CH_A_TP_LOW);
    this.writeRegister(PsgDeviceChannel.REGISTER_AY_CH_B_TP_HIGH,
            PsgDeviceChannel._DEFAULT_AY_CH_B_TP_HIGH);
    this.writeRegister(PsgDeviceChannel.REGISTER_AY_CH_B_TP_LOW,
            PsgDeviceChannel._DEFAULT_AY_CH_B_TP_LOW);
    this.writeRegister(PsgDeviceChannel.REGISTER_AY_CH_C_TP_HIGH,
            PsgDeviceChannel._DEFAULT_AY_CH_C_TP_HIGH);
    this.writeRegister(PsgDeviceChannel.REGISTER_AY_CH_C_TP_LOW,
            PsgDeviceChannel._DEFAULT_AY_CH_C_TP_LOW);
    this.writeRegister(PsgDeviceChannel.REGISTER_AY_NOISE_TP,
            PsgDeviceChannel._DEFAULT_AY_NOISE_TP);
    this.writeRegister(PsgDeviceChannel.REGISTER_AY_MIXER,
            PsgDeviceChannel._DEFAULT_AY_MIXER);
    this.writeRegister(PsgDeviceChannel.REGISTER_AY_CH_A_VOLUME,
            PsgDeviceChannel._DEFAULT_AY_CH_A_VOLUME);
    this.writeRegister(PsgDeviceChannel.REGISTER_AY_CH_B_VOLUME,
            PsgDeviceChannel._DEFAULT_AY_CH_B_VOLUME);
    this.writeRegister(PsgDeviceChannel.REGISTER_AY_CH_C_VOLUME,
            PsgDeviceChannel._DEFAULT_AY_CH_C_VOLUME);
    this.writeRegister(PsgDeviceChannel.REGISTER_AY_EP_LOW,
            PsgDeviceChannel._DEFAULT_AY_EP_LOW);
    this.writeRegister(PsgDeviceChannel.REGISTER_AY_EP_HIGH,
            PsgDeviceChannel._DEFAULT_AY_EP_HIGH);
    this.writeRegister(PsgDeviceChannel.REGISTER_AY_EP_CONTROL,
            PsgDeviceChannel._DEFAULT_AY_EP_CONTROL);
    this.seed = PsgDeviceChannel._DEFAULT_AY_SEED;
};

/**
 * Set emulated device target.
 * @param target target device
 */
PsgDeviceChannel.prototype.setDevice = function (target) {
    this.device = target;
    this.volumeTable = PsgDeviceChannel._VOLUME_TABLE[target];
    for (var i = 0; i < PsgDeviceChannel._CHANNELS; i++) {
        this.active[i] = true;
        this.countTone[i] = 0;
    }
    if (this.device == PsgDeviceChannel.DEVICE_SN76489)
        this.initRegisterSN();
    else
        this.initRegisterAY();
};

/**
 * @see MasterChannel
 * @param length buffer length or size in shorts
 */
PsgDeviceChannel.prototype.setBufferLength = function (length) {
    this.buffer = new Int32Array(length);
};

/**
 * @see MasterChannel
 * @param rate sample rate
 */
PsgDeviceChannel.prototype.setSampleRate = function (rate) {
    this.sampleRate = rate;
    this.setClock(this.clock);
};

/**
 * @see MasterChannel
 * @return audio stream buffer
 */
PsgDeviceChannel.prototype.getBuffer = function () {
    return this.buffer;
};

/**
 * Generate specified length sound stream into internal buffer
 * of SN76489.
 * @see generate
 * @param length sound length in short to generate
 */
PsgDeviceChannel.prototype.generateSN = function (length) {
    var step;
    if (0 == this.stepNoise)
        step = this.stepTone[PsgDeviceChannel._CH_C];
    else
        step = this.stepNoise;
    for (var offset = 0; offset < length; offset += 2) {
        var value = 0;
        for (var channel = 0; channel < PsgDeviceChannel._CHANNELS;
             channel++) {
            this.countTone[channel] += this.baseStep;
            if (this.countTone[channel] > this.stepTone[channel]) {
                this.countTone[channel] -= this.stepTone[channel];
                this.active[channel] = !this.active[channel];
            }
            if (this.active[channel])
                value += this.volume[channel];
            else if (this.mode == PsgDeviceChannel.MODE_SIGNED)
                value -= this.volume[channel];
        }
        this.countNoise += this.baseStep;
        if (this.countNoise > step) {
            if (this.feedback) {
                var v = this.seed & PsgDeviceChannel._UPDATE_SEED_MASK;
                v ^= v >>> PsgDeviceChannel._UPDATE_SEED_RSHIFT;
                this.seed = (this.seed & PsgDeviceChannel._SHORT_MASK) >> 1;
                this.seed |= (v << PsgDeviceChannel._UPDATE_SEED_LSHIFT) &
                        PsgDeviceChannel._SHORT_MASK;
            } else {
                this.seed = (this.seed & PsgDeviceChannel._SHORT_MASK) >> 1;
                this.seed |= (this.seed <<
                        PsgDeviceChannel._UPDATE_SEED_LSHIFT) &
                        PsgDeviceChannel._SHORT_MASK;
            }
        }
        if (0 != (this.seed & 1))
            value += this.volumeNoise;
        else if (this.mode == PsgDeviceChannel.MODE_SIGNED)
            value -= this.volumeNoise;
        this.buffer[offset + 0] = value;
        this.buffer[offset + 1] = value;
    }
};

/**
 * Generate specified length sound stream into internal buffer
 * of AY-3-8910 or YM-2149.
 * @see generate
 * @param length sound length in short to generate
 */
PsgDeviceChannel.prototype.generateAY = function (length) {
    for (var offset = 0; offset < length; offset += 2) {
        this.countNoise += this.baseStep;
        if (this.countNoise > this.stepNoise) {
            var v = this.seed & PsgDeviceChannel._UPDATE_SEED_MASK;
            v ^= v >>> PsgDeviceChannel._UPDATE_SEED_RSHIFT;
            this.seed = (this.seed & PsgDeviceChannel._SHORT_MASK) >> 1;
            this.seed |= (v << PsgDeviceChannel._UPDATE_SEED_LSHIFT) &
                    PsgDeviceChannel._SHORT_MASK;
            this.countNoise -= this.stepNoise;
        }
        var value = 0;
        var noise = 0 != (this.seed & 1);
        for (var channel = 0; channel < PsgDeviceChannel._CHANNELS;
             channel++) {
            this.countTone[channel] += this.baseStep;
            if (this.countTone[channel] > this.stepTone[channel]) {
                this.countTone[channel] -= this.stepTone[channel];
                this.active[channel] = !this.active[channel];
            }
            if ((this.mixerTone[channel] && this.active[channel])
                    || (this.mixerNoise[channel] && noise))
                value += this.volume[channel];
            else if (this.mixerTone[channel] && this.mixerNoise[channel] &&
                    this.mode == PsgDeviceChannel.MODE_SIGNED)
                value -= this.volume[channel];
        }
        this.buffer[offset + 0] = value;
        this.buffer[offset + 1] = value;
    }
};

/**
 * Generate specified length sound stream into internal buffer.
 * @see MasterChannel
 * @param length sound length in short to generate
 */
PsgDeviceChannel.prototype.generate = function (length) {
    if (this.device == PsgDeviceChannel.DEVICE_SN76489)
        this.generateSN(length);
    else
        this.generateAY(length);
};

/**
 * Write to SN76489 registers.
 * If MSB of value byte is high, from bit six to four represent
 * register address, and other bits is lower four bits of
 * the register value.
 *  bit 7  6  5  4  3  2  1  0
 *      1 R2 R1 R0 V3 V2 V1 V0 (write lower bits to R register)
 * MSB being low, target register is the last accessed one, and
 * bit five to zero represent higher six bits of the value.
 *  bit 7  6  5  4  3  2  1  0
 *      0  x V9 V8 V7 V6 V5 V4 (write higher bits)
 * @see writeRegister
 * @param address not used
 * @param value address and value to write
 */
PsgDeviceChannel.prototype.writeRegisterSN = function (address, value) {
    var pseudoAddress = 0;
    if (0 != (value & PsgDeviceChannel._BYTE_MSB_MASK)) {
        // lower values is stored to register[address + 8]
        pseudoAddress = value >> PsgDeviceChannel._HALF_SHIFT;
        this.register[pseudoAddress] = value & PsgDeviceChannel._HALF_MASK;
        // set next accessed register to address
        this.activeRegister = pseudoAddress & PsgDeviceChannel._ADDRESS_MASK;
    } else {
        pseudoAddress = this.activeRegister;
        this.register[pseudoAddress] = value & PsgDeviceChannel._VALUE_MASK;
    }
    switch (pseudoAddress) {
    case PsgDeviceChannel.REGISTER_SN_CH_A_TP:
    case PsgDeviceChannel.REGISTER_SN_CH_A_TP_HIGH:
        this.stepTone[PsgDeviceChannel._CH_A] =
                ((this.register[PsgDeviceChannel.REGISTER_SN_CH_A_TP_HIGH] <<
                        PsgDeviceChannel._HALF_SHIFT) |
                        this.register[PsgDeviceChannel.REGISTER_SN_CH_A_TP]) <<
                        PsgDeviceChannel._STEP_BIAS;
        break;
    case PsgDeviceChannel.REGISTER_SN_CH_A_VOLUME:
        this.volume[PsgDeviceChannel._CH_A] =
                this.volumeTable[this.register[pseudoAddress]] <<
                        PsgDeviceChannel._VOLUME_BIAS;
        break;
    case PsgDeviceChannel.REGISTER_SN_CH_B_TP:
    case PsgDeviceChannel.REGISTER_SN_CH_B_TP_HIGH:
        this.stepTone[PsgDeviceChannel._CH_B] =
                ((this.register[PsgDeviceChannel.REGISTER_SN_CH_B_TP_HIGH] <<
                        PsgDeviceChannel._HALF_SHIFT) |
                        this.register[PsgDeviceChannel.REGISTER_SN_CH_B_TP]) <<
                        PsgDeviceChannel._STEP_BIAS;
        break;
    case PsgDeviceChannel.REGISTER_SN_CH_B_VOLUME:
        this.volume[PsgDeviceChannel._CH_B] =
                this.volumeTable[this.register[pseudoAddress]] <<
                        PsgDeviceChannel._VOLUME_BIAS;
        break;
    case PsgDeviceChannel.REGISTER_SN_CH_C_TP:
    case PsgDeviceChannel.REGISTER_SN_CH_C_TP_HIGH:
        this.stepTone[PsgDeviceChannel._CH_C] =
                ((this.register[PsgDeviceChannel.REGISTER_SN_CH_C_TP_HIGH] <<
                        PsgDeviceChannel._HALF_SHIFT) |
                        this.register[PsgDeviceChannel.REGISTER_SN_CH_C_TP]) <<
                        PsgDeviceChannel._STEP_BIAS;
        break;
    case PsgDeviceChannel.REGISTER_SN_CH_C_VOLUME:
        this.volume[PsgDeviceChannel._CH_C] =
                this.volumeTable[this.register[pseudoAddress]] <<
                        PsgDeviceChannel._VOLUME_BIAS;
        break;
    case PsgDeviceChannel.REGISTER_SN_NOISE_CONTROL:
        this.stepNoise = PsgDeviceChannel._NOISE_TP_TABLE[value &
                PsgDeviceChannel._LOWER_TWO_BITS_MASK] <<
                PsgDeviceChannel._STEP_BIAS;
        this.feedback = 1 == (value >> 2);
        break;
    case PsgDeviceChannel.REGISTER_SN_NOISE_VOLUME:
        this.volumeNoise = this.volumeTable[this.register[pseudoAddress]];
        break;
    default:
        break;
    }
};

/**
 * Write to AY-3-8910 or YM-2149 registers.
 * @see writeRegister
 * @param address register address to write
 * @param value register value to write
 */
PsgDeviceChannel.prototype.writeRegisterAY = function (address, value) {
    if ((address > PsgDeviceChannel._REGISTERS) ||
            (value < PsgDeviceChannel._REGISTER_MIN_VALUE) ||
            (PsgDeviceChannel._REGISTER_MAX_VALUE < value)) {
        throw new RangeError("Undefined register: " + address);
    }
    this.register[address] = value;

    switch(address) {
    case PsgDeviceChannel.REGISTER_AY_CH_A_TP_LOW:
    case PsgDeviceChannel.REGISTER_AY_CH_A_TP_HIGH:
        this.stepTone[PsgDeviceChannel._CH_A] =
                ((this.register[PsgDeviceChannel.REGISTER_AY_CH_A_TP_HIGH] <<
                        PsgDeviceChannel._BITS_PER_BYTE) |
                        (this.register[
                                PsgDeviceChannel.REGISTER_AY_CH_A_TP_LOW])) <<
                        PsgDeviceChannel._STEP_BIAS;
        break;
    case PsgDeviceChannel.REGISTER_AY_CH_B_TP_LOW:
    case PsgDeviceChannel.REGISTER_AY_CH_B_TP_HIGH:
        this.stepTone[PsgDeviceChannel._CH_B] =
                ((this.register[PsgDeviceChannel.REGISTER_AY_CH_B_TP_HIGH] <<
                        PsgDeviceChannel._BITS_PER_BYTE) |
                        (this.register[
                                PsgDeviceChannel.REGISTER_AY_CH_B_TP_LOW])) <<
                        PsgDeviceChannel._STEP_BIAS;
        break;
    case PsgDeviceChannel.REGISTER_AY_CH_C_TP_LOW:
    case PsgDeviceChannel.REGISTER_AY_CH_C_TP_HIGH:
        this.stepTone[PsgDeviceChannel._CH_C] =
                ((this.register[PsgDeviceChannel.REGISTER_AY_CH_C_TP_HIGH] <<
                        PsgDeviceChannel._BITS_PER_BYTE) |
                        (this.register[
                                PsgDeviceChannel.REGISTER_AY_CH_C_TP_LOW])) <<
                        PsgDeviceChannel._STEP_BIAS;
        break;
    case PsgDeviceChannel.REGISTER_AY_NOISE_TP:
        this.stepNoise = ((value & PsgDeviceChannel._NOISE_TP_MASK) << 1) <<
                (PsgDeviceChannel._STEP_BIAS + 1);
        if (this.stepNoise < this.baseStep) {
            this.stepNoise = this.baseStep;
        }
        break;
    case PsgDeviceChannel.REGISTER_AY_MIXER:
        this.mixerTone[PsgDeviceChannel._CH_A] =
                0 == (value & PsgDeviceChannel._MIXER_CH_A_TONE);
        this.mixerTone[PsgDeviceChannel._CH_B] =
                0 == (value & PsgDeviceChannel._MIXER_CH_B_TONE);
        this.mixerTone[PsgDeviceChannel._CH_C] =
                0 == (value & PsgDeviceChannel._MIXER_CH_C_TONE);
        this.mixerNoise[PsgDeviceChannel._CH_A] =
                0 == (value & PsgDeviceChannel._MIXER_CH_A_NOISE);
        this.mixerNoise[PsgDeviceChannel._CH_B] =
                0 == (value & PsgDeviceChannel._MIXER_CH_B_NOISE);
        this.mixerNoise[PsgDeviceChannel._CH_C] =
                0 == (value & PsgDeviceChannel._MIXER_CH_C_NOISE);
        break;
    case PsgDeviceChannel.REGISTER_AY_CH_A_VOLUME:
        this.volume[PsgDeviceChannel._CH_A] =
                this.volumeTable[(value & PsgDeviceChannel._VOLUME_MASK) << 1]
                        << PsgDeviceChannel._VOLUME_BIAS;
        this.envelope[PsgDeviceChannel._CH_A] =
                0 != (value & PsgDeviceChannel._ENVELOPE_MASK);
        break;
    case PsgDeviceChannel.REGISTER_AY_CH_B_VOLUME:
        this.volume[PsgDeviceChannel._CH_B] =
                this.volumeTable[(value & PsgDeviceChannel._VOLUME_MASK) << 1]
                        << PsgDeviceChannel._VOLUME_BIAS;
        this.envelope[PsgDeviceChannel._CH_B] =
                0 != (value & PsgDeviceChannel._ENVELOPE_MASK);
        break;
    case PsgDeviceChannel.REGISTER_AY_CH_C_VOLUME:
        this.volume[PsgDeviceChannel._CH_C] =
                this.volumeTable[(value & PsgDeviceChannel._VOLUME_MASK) << 1]
                        << PsgDeviceChannel._VOLUME_BIAS;
        this.envelope[PsgDeviceChannel._CH_C] =
                0 != (value & PsgDeviceChannel._ENVELOPE_MASK);
        break;
    case PsgDeviceChannel.REGISTER_AY_EP_LOW:
        // TODO
        break;
    case PsgDeviceChannel.REGISTER_AY_EP_HIGH:
        // TODO
        break;
    case PsgDeviceChannel.REGISTER_AY_EP_CONTROL:
        // TODO
        break;
    case PsgDeviceChannel.REGISTER_AY_IO_A:
        break;
    case PsgDeviceChannel.REGISTER_AY_IO_B:
        break;
    default:
        break;
    }
};

/**
 * @see Device
 * @param address register address to write
 * @param value register value to write
 */
PsgDeviceChannel.prototype.writeRegister = function (address, value) {
    if (this.device == PsgDeviceChannel.DEVICE_SN76489)
        this.writeRegisterSN(address, value);
    else
        this.writeRegisterAY(address, value);
};

/**
 * @see Device
 * @param address register address to read
 * @return read register value
 */
PsgDeviceChannel.prototype.readRegister = function (address) {
    if (address > PsgDeviceChannel._REGISTERS)
        throw new RangeError("Undefined register: " + address);
    return this.register[address];
};
/**
 * T'SoundSystem for JavaScript
 */

/**
 * SimpleMidiChannel prototype
 *
 * This prototype implements simple virtual MIDI device with square sound.
 * This virtual instrument implements only key-on/off handling.
 * @author Takashi Toyoshima <toyoshim@gmail.com>
 */
var SimpleMidiChannel = function () {
    this.buffer = null;
    this.count = SimpleMidiChannel._COUNT_CYCLE;
    this.voices = [];
    this.activeVoices = 0;
    this.searchingVoice = 0;
    this.noteMaps = [];
    for (var i = 0; i < SimpleMidiChannel._MAX_VOICE; i++)
        this.voices[i] = new SimpleMidiChannel.Voice();
    for (var ch = 0; ch < SimpleMidiChannel._MAX_CHANNEL; ch++)
        this.noteMaps[ch] = new Array(0x80);
    this.sampleRate = MasterChannel.DEFAULT_SAMPLE_FREQUENCY;
    this.processSystemReset();
}

SimpleMidiChannel.prototype = new MidiChannel();
SimpleMidiChannel.prototype.constructor = SimpleMidiChannel;

SimpleMidiChannel._MAX_CHANNEL = 16;
SimpleMidiChannel._MAX_VOICE = 64;
SimpleMidiChannel._OFF = -1;
SimpleMidiChannel._COUNT_CYCLE = 2048;

/**
 * Generate partial sound stream internally.
 * @param begin start offset
 * @param end end offset
 */
SimpleMidiChannel.prototype._generate = function (begin, end) {
    // Initialize stream.
    for (var i = begin; i <= end; i++)
        this.buffer[i] = 0;
    // Add all voices streams.
    for (var v = 0; v < SimpleMidiChannel._MAX_VOICE; v++)
        this.voices[v].generate(this.buffer, begin, end);
};

/**
 * Find usable voice number.
 */
SimpleMidiChannel.prototype._findVoice = function () {
    var voice = 0;
    if (SimpleMidiChannel._MAX_VOICE == this.activeVoices) {
        // All voices are used. Reuse the voice which are keyed-on almost
        // firstly.
        voice = this.searchingVoice++;

        // Key-off the target voice.
        var ch = this.voices[voice].getChannel();
        var note = this.voices[voice].getNote();
        this.voices[voice].keyOff();
        this.noteMaps[ch][note] = SimpleMidiChannel._OFF;
        this.activeVoices--;
        Log.getLog.info("SimpleMIDI: voice overflow, force to key-off; " +
                "ch = " + ch + ", note = " + note + ", voice = " + voice);
    } else {
        for (var i = 0; i < SimpleMidiChannel._MAX_VOICE; i++) {
            // Search inactive channel.
            voice = this.searchingVoice + i;
            if (voice >= SimpleMidiChannel._MAX_VOICE)
                voice -= SimpleMidiChannel._MAX_VOICE;
            if (!this.voices[voice].isActive()) {
                this.searchingVoice = voice + 1;
                break;
            }
        }
    }
    if (this.searchingVoice >= SimpleMidiChannel._MAX_VOICE)
        this.searchingVoice -= SimpleMidiChannel._MAX_VOICE;
    return voice;
};

/**
 * @see MasterChannel
 * @param length buffer length or size in shorts
 */
SimpleMidiChannel.prototype.setBufferLength = function (length) {
    this.buffer = new Int32Array(length);
};

/**
 * @see MasterChannel
 * @param rate sample rate
 */
SimpleMidiChannel.prototype.setSampleRate = function (rate) {
    this.sampleRate = rate;
};

/**
 * @see MasterChannel
 * @return audio stream buffer
 */
SimpleMidiChannel.prototype.getBuffer = function () {
    return this.buffer;
};

/**
 * Generate specified length sound stream into internal buffer.
 * @see MasterChannel
 * @param length sound length in short to generate
 */
SimpleMidiChannel.prototype.generate = function (length) {
    for (var offset = 0; length > 0; ) {
        if (this.count <= length) {
            this._generate(offset, offset + this.count - 1);
            offset += this.count;
            length -= this.count;
            this.count = SimpleMidiChannel._COUNT_CYCLE;
            // Process key release.
            for (var v = 0; v < SimpleMidiChannel._MAX_VOICE; v++) {
                if (this.voices[v].isActive())
                    continue;
                var diff = this.voices[v].velocity >> 3;
                if (0 != diff)
                    this.voices[v].velocity -= diff;
                else
                    this.voices[v].velocity -= 0;
            }
        } else {
            this._generate(offset, offset + length - 1);
            this.count -= length;
            break;
        }
    }
};

/**
 * Process note off event.
 * @see MidiChannel
 * @param ch channel
 * @param note note number
 * @param velocity key off velocity
 */
SimpleMidiChannel.prototype.processNoteOff = function (ch, note, velocity) {
    var voice = this.noteMaps[ch][note];
    if (SimpleMidiChannel._OFF == voice)
        return;
    this.noteMaps[ch][note] = SimpleMidiChannel._OFF;
    this.voices[voice].keyOff();
    this.activeVoices--;
};

/**
 * Process note on event.
 * @see MidiChannel
 * @param ch channel
 * @param note note number
 * @param velocity key on velocity
 */
SimpleMidiChannel.prototype.processNoteOn = function (ch, note, velocity) {
    var voice = this.noteMaps[ch][note];
    if (SimpleMidiChannel._OFF == voice) {
        voice = this._findVoice();
        this.noteMaps[ch][note] = voice;
        this.activeVoices++;
    }

    this.voices[voice].keyOn(ch, note, velocity);
};

/**
 * Process system reset message event.
 * @see MidiChannel
 */
SimpleMidiChannel.prototype.processSystemReset = function () {
    for (var i = 0; i < SimpleMidiChannel._MAX_VOICE; i++)
        this.voices[i].keyOff();

    // Note map per MIDI channel showing which note are played by which voice.
    for (var ch = 0; ch < SimpleMidiChannel._MAX_CHANNEL; ch++)
        for (var note = 0; note < 0x80; note++)
            this.noteMaps[ch][note] = SimpleMidiChannel._OFF;

    this.activeVoices = 0;
    this.searchingVoice = 0;
};

SimpleMidiChannel.Voice = function () {
    this.phase = 0;
    this.frequency = 440;
    this.velocity = 0;
    this.channel = -1;
    this.note = -1;
    this.active = false;
};

SimpleMidiChannel.Voice.prototype.getChannel = function () {
    return this.channel;
};

SimpleMidiChannel.Voice.prototype.getNote = function () {
    return this.note;
};

SimpleMidiChannel.Voice.prototype.isActive = function () {
    return this.active;
};

SimpleMidiChannel.Voice.prototype.keyOn = function (ch, note, velocity) {
    this.channel = ch;
    this.note = note;
    this.frequency = MidiChannel.getFrequencyForNote(note);
    this.velocity = velocity << 5;
    this.phase = 0;
    this.active = true;
};

SimpleMidiChannel.Voice.prototype.keyOff = function () {
    this.channel = -1;
    this.note = -1;
    this.velocity >>= 1;
    this.active = false;
};

SimpleMidiChannel.Voice.prototype.generate = function (buffer, begin, end) {
    if (0 == this.velocity)
        return;

    for (var i = begin; i <= end; i += 2) {
        this.phase += this.frequency * 2;
        if (this.phase > this.sampleRate) {
            this.phase -= this.sampleRate;
            this.velocity = -this.velocity;
        }
        buffer[i + 0] += this.velocity;
        buffer[i + 1] += this.velocity;
    }
};
/**
 * T'SoundSystem for JavaScript
 */

/**
 * SimpleSlaveChannel prototype
 *
 * This prototype implements simple fixed frequency slave channel.
 * @author Takashi Toyoshima <toyoshim@gmail.com>
 *
 * @constructor
 */
var SimpleSlaveChannel = function (frequency) {
    this.buffer = null;
    this.freq = frequency;
    this.phase = 0;
    this.data = SimpleSlaveChannel.DEFAULT_VOLUME;
    this.sampleRate = MasterChannel.DEFAULT_SAMPLE_FREQUENCY;
}

SimpleSlaveChannel.DEFAULT_VOLUME = 1024;

/**
 * @see MasterChannel
 * @param length buffer length or size in shorts
 */
SimpleSlaveChannel.prototype.setBufferLength = function (length) {
    this.buffer = new Int32Array(length);
};

/**
 * @see MasterChannel
 * @param rate sample rate
 */
SimpleSlaveChannel.prototype.setSampleRate = function (rate) {
    this.sampleRate = rate;
};

/**
 * @see MasterChannel
 * @return audio stream buffer
 */
SimpleSlaveChannel.prototype.getBuffer = function () {
    return this.buffer;
};

/**
 * Generate specified length sound stream into internal buffer.
 * @see MasterChannel
 * @param length sound length in short to generate
 */
SimpleSlaveChannel.prototype.generate = function (length) {
    for (var i = 0; i < length; i += 2) {
        this.phase += this.freq * 2;
        if (this.phase > this.sampleRate) {
            this.phase -= this.sampleRate;
            this.data = -this.data;
        }
        this.buffer[i + 0] = this.data;
        this.buffer[i + 1] = this.data;
    }
    // Logged object contents at the first callback.
    if (null == this.firstGenerateCallback) {
        this.firstGenerateCallback = true;
        Log.getLog().info("SimpleSlaveChannel: " + this.freq + "Hz");
        Log.getLog().info(this);
    }
};
/**
 * T'SoundSystem for JavaScript
 */

/**
 * SmfPlayer prototype
 *
 * Play Standard MIDI Files.
 * @author Takashi Toyoshima <toyoshim@gmail.com>
 */
var SmfPlayer = function () {
    this.masterChannel = null;
    this.defaultDevice = new MidiChannel();
    this.devices = [];
    this.tracks = [];
    this.numberOfTracks = 0;
    this.usecTempo = 1000 * 1000;
    this.timeUnit = 480;
    this.error = false;
    this.handleFalcomStyleInfiniteLoop = true;
}

SmfPlayer.TRACK_DEFAULT = -1;
SmfPlayer._SMF_CHUNK_HEADER = ('M'.charCodeAt(0) << 24) |
        ('T'.charCodeAt(0) << 16) |
        ('h'.charCodeAt(0) << 8) |
        'd'.charCodeAt(0);
SmfPlayer._SMF_CHUNK_TRACK = ('M'.charCodeAt(0) << 24) |
        ('T'.charCodeAt(0) << 16) |
        ('r'.charCodeAt(0) << 8) |
        'k'.charCodeAt(0);
SmfPlayer._SMF_FORMAT_0 = 0;
SmfPlayer._SMF_FORMAT_1 = 1;
SmfPlayer._SMF_EVENT_SYSEX = 0xf0;
SmfPlayer._SMF_EVENT_META = 0xff;
SmfPlayer._SMF_META_SEQUENCE_NUMBER = 0x00;
SmfPlayer._SMF_META_TEXT = 0x01;
SmfPlayer._SMF_META_COPYRIGHT = 0x02;
SmfPlayer._SMF_META_TRACK_NAME = 0x03;
SmfPlayer._SMF_META_INSTRUMENT_NAME = 0x04;
SmfPlayer._SMF_META_LYLIC = 0x05;
SmfPlayer._SMF_META_MARKER = 0x06;
SmfPlayer._SMF_META_CUE_POINT = 0x07;
SmfPlayer._SMF_META_CHANNEL_PREFIX = 0x20;
SmfPlayer._SMF_META_END_OF_TRACK = 0x2f;
SmfPlayer._SMF_META_SET_TEMPO = 0x51;
SmfPlayer._SMF_META_SMPTE_OFFSET = 0x54;
SmfPlayer._SMF_META_TIME_SIGNATURE = 0x58;
SmfPlayer._SMF_META_KEY_SIGNATURE = 0x59;

/**
 * Send MIDI events to a device
 * @param track track id
 * @param data data array
 */
SmfPlayer.prototype._sendEvent = function (track, data) {
    var device = this.devices[track];
    if (!device)
        device = this.defaultDevice;
    if (!device)
        return;
    var event = MidiChannel.createEvent(data);
    device.processEvents(event);
};

/**
 * Read unsigned 16bit data.
 * @param offset offset
 * @return unsigned 16bit data
 */
SmfPlayer.prototype._readUint16 = function (offset) {
    return (this.input[offset] << 8) |
            this.input[offset + 1];
};

/**
 * Read unsigned 32bit data.
 * @param offset offset
 * @return unsigned 32bit data
 */
SmfPlayer.prototype._readUint32 = function (offset) {
    var i32 = (this.input[offset] << 24) |
            (this.input[offset + 1] << 16) |
            (this.input[offset + 2] << 8) |
            this.input[offset + 3];
    if (i32 < 0)
        return 0x100000000 + i32;
    return i32;
};

/**
 * Read variable length unsigned integer data.
 * @param offset offset
 * @return object
 *      value: unsigned integer data
 *      length: variable length
 */
SmfPlayer.prototype._readUint = function (array, offset) {
    var n = 0;
    var length = array.byteLength;
    var success = false;
    for (var i = offset; i < length; i++) {
        var c = array[i];
        if (c < 0x80) {
            n += c;
            success = true;
            i++;
            break;
        } else {
            n += c & 0x7f;
            n <<= 7;
        }
    }
    return {
        value: n,
        length: i - offset,
        success: success
    }
};

/**
 * Read chunk header (8 bytes).
 * @param offset offset
 * @return object
 *      type: chunk type
 *      length: chunk length (except for header size)
 */
SmfPlayer.prototype._readChunkHeader = function (offset) {
    var type = this._readUint32(offset);
    var length = this._readUint32(offset + 4);
    if (SmfPlayer._SMF_CHUNK_HEADER == type)
        Log.getLog().info("SMF: MThd (header chunk)");
    else if (SmfPlayer._SMF_CHUNK_TRACK == type)
        Log.getLog().info("SMF: MTrk (track chunk)");
    else
        Log.getLog().warn("SMF: " + String.fromCharCode(offset) +
                String.fromCharCode(offset + 1) +
                String.fromCharCode(offset + 2) +
                String.fromCharCode(offset + 3) + " (unknown)");
    Log.getLog().info("SMF: length: " + length);
    return {
        type: type,
        length: length
    };
};

/**
 * Update timer callback.
 */
SmfPlayer.prototype._updateTimer = function () {
    var interval = (this.usecTempo / 1000) / this.timeUnit;
    Log.getLog().info("SMF: set timer interval as " + interval);
    this.masterChannel.setPlayerInterval(interval);
};

/**
 * Set master channel to write output stream.
 * @param channel master channel
 */
SmfPlayer.prototype.setMasterChannel = function (channel) {
    if (!channel) {
        this.masterChannel = null;
        return;
    }

    channel.clearChannel();
    if (this.defaultDevice)
        channel.addChannel(this.defaultDevice);
    for (var i = 0; i < this.devices.length; i++) {
        if (!this.devices[i])
            continue;
        channel.addChannel(this.devices[i]);
    }
    channel.setPlayer(this);
    this.masterChannel = channel;
};

/**
 * Set playback device for each track. If track is SmfPlayer.TRACK_DEFAULT
 * the device will be used for tracks which doesn't have specific setting.
 * @param track track to set
 * @param device device
 */
SmfPlayer.prototype.setDevice = function (track, device) {
    if (SmfPlayer.TRACK_DEFAULT == track) {
        if (this.masterChannel) {
            if (this.defaultDevice)
                this.masterChannel.removeChannel(this.defaultDevice);
            if (device)
                this.masterChannel.addChannel(device);
        }
        this.defaultDevice = device;
    } else {
        if (this.masterChannel) {
            if (this.devices[track])
                this.masterChannel.removeChannel(this.devices[track]);
            if (device)
                this.masterChannel.addChannel(device);
        }
        this.devices[track] = device;
    }
};

/**
 * Channel reach to periodical call back point.
 */
SmfPlayer.prototype.updateDevice = function () {
    if (this.error)
        return;
    for (var track = 0; track < this.numberOfTracks; track++) {
        var work = this.tracks[track];
        if (!work.active)
            continue;
        work.count--;
        if (0 != work.count)
            continue;
        var length = work.data.byteLength;
        do {
            if (work.offset == length) {
                Log.getLog().error("SMF: event not found");
                this.error = true;
                break;
            }
            var event = work.data[work.offset];
            // Handle running status.
            if (event >= 0x80) {
                work.lastEvent = event;
            } else {
                event = work.lastEvent;
                work.offset--;
            }
            var dataLength = 3;
            if ((0xc0 <= event) && (event < 0xe0))
                dataLength = 2;
            if ((work.offset + dataLength) > length) {
                Log.getLog().error("SMF: invalid event data at " +
                        work.offset);
                this.error = true;
                break;
            }
            if (SmfPlayer._SMF_EVENT_SYSEX == event) {
                work.offset++;
                dataLength = 1 + work.data[work.offset];
                if (work.offset + dataLength > length) {
                    Log.getLog().error("SMF: invalid sysex data");
                    this.error = true;
                    break;
                }
            } else if (SmfPlayer._SMF_EVENT_META == event) {
                var type = work.data[work.offset + 1];
                dataLength = 3 + work.data[work.offset + 2];
                if (work.offset + dataLength > length) {
                    Log.getLog().error("SMF: invalid meta data");
                    this.error = true;
                    break;
                }
                if (SmfPlayer._SMF_META_TRACK_NAME == type) {
                    try {
                        var text = TString.createFromUint8Array(
                                work.data.subarray(work.offset + 3,
                                        work.offset + dataLength));
                        Log.getLog().info("SMF: track name; " +
                                text.toString());
                    } catch (e) {
                        Log.getLog().warn("SMF: track name is not UTF-8 text");
                    }
                } else if (SmfPlayer._SMF_META_MARKER == type) {
                    try {
                        var marker = TString.createFromUint8Array(
                                work.data.subarray(work.offset + 3,
                                        work.offset + dataLength));
                        Log.getLog().info("SMF: marker; " + marker.toString());
                    } catch (e) {
                        Log.getLog().warn("SMF: marker is not UTF-8 text");
                    }
                    if (this.handleFalcomStyleInfiniteLoop &&
                            (1 == work.data[work.offset + 2])) {
                        var mark = work.data[work.offset + 3];
                        if (0x41 == mark) {
                            work.loopOffset = work.offset;
                            Log.getLog().info("SMF: marker A handled as " +
                                    "infinite loop start in falcom style");
                        } else if (0x42 == mark) {
                            work.offset = work.loopOffset;
                            Log.getLog().info("SMF: marker B handled as " +
                                "infinite loop end in falcom style");
                            continue;
                        }
                    }
                } else if (SmfPlayer._SMF_META_SET_TEMPO == type) {
                    this.usecTempo = (work.data[work.offset + 3] << 16) |
                        (work.data[work.offset + 4] << 8) |
                        work.data[work.offset + 5];
                    var tempo = ~~(60000000 / this.usecTempo);
                    Log.getLog().info("SMF: tempo " + tempo);
                    this._updateTimer();
                } else {
                    Log.getLog().info("SMF: meta type " + type);
                }
            } else if (0xf0 == (event & 0xf0)) {
                // Handle running status.
                Log.getLog().error("SMF: unsupported system common message " +
                        event.toString(16));
                this.error = true;
                break;
            } else if (event < 0x80) {
                Log.getLog().warn("SMF: skip invalid data " +
                        event.toString(16));
                work.offset++;
                continue;
            }
            if (SmfPlayer._SMF_EVENT_META != event) {
                var eventData = new Uint8Array(dataLength);
                eventData[0] = event;
                for (var offset = 1; offset < dataLength; offset++)
                    eventData[offset] = work.data[work.offset + offset];
                this._sendEvent(track, eventData);
            }
            work.offset += dataLength;

            var deltaTime = this._readUint(work.data, work.offset);
            if (!deltaTime.success) {
                if (0 == deltaTime.length) {
                    Log.getLog().info("SMF: track " + track + " end");
                    work.active = false;
                } else {
                    Log.getLog().error("SMF: invalid delta time");
                    this.error = true;
                }
                break;
            }
            work.count = deltaTime.value;
            work.offset += deltaTime.length;
        } while (0 == work.count);
    }
};

/**
 * Decode and play.
 * @param newInput ArrayBuffer to play
 * @return success or not
 */
SmfPlayer.prototype.play = function (newInput) {
    this.input = new Uint8Array(newInput);
    var length = this.input.byteLength;
    Log.getLog().info("SMF: load " + length + " Bytes");

    var totalLength = 0;
    var headerProcessed = false;
    var processedTracks = 0;
    for (var offset = 0; offset < length; offset += totalLength) {
        var chunkHeader = this._readChunkHeader(offset);
        offset += 8;
        if (SmfPlayer._SMF_CHUNK_HEADER == chunkHeader.type) {
            if (headerProcessed) {
                Log.getLog().error("SMF: header chunks appear twice");
                return false;
            }
            headerProcessed = true;
            var format = this._readUint16(offset);
            this.numberOfTracks = this._readUint16(offset + 2);
            this.timeUnit = this._readUint16(offset + 4);
            if (6 != chunkHeader.length)
                Log.getLog().warn("SMF: invalid chunk header length: " +
                        chunkHeader.length);
            Log.getLog().info("SMF: format " + format);
            Log.getLog().info("SMF: tracks " + this.numberOfTracks);
            Log.getLog().info("SMF: time unit " + this.timeUnit);

            if (SmfPlayer._SMF_FORMAT_0 == format) {
                if (1 != this.numberOfTracks) {
                    Log.getLog().warn("SMF: invalid track number in format 0");
                    this.numberOfTracks = 1;
                }
            }
        } else if (SmfPlayer._SMF_CHUNK_TRACK == chunkHeader.type) {
            Log.getLog().info("SMF: track chunk " + processedTracks);
            if (processedTracks >= this.numberOfTracks) {
                Log.getLog().error("SMF: too many tracks");
                return false;
            }
            var subArray =
                    this.input.subarray(offset, offset + chunkHeader.length);
            var deltaTime = this._readUint(subArray, 0);
            if (!deltaTime.success) {
                Log.getLog().error("SMF: track " + processedTracks +
                        " has invalid data");
                return false;
            }
            Log.getLog().info("SMF: track " + processedTracks + " initial " +
                    "delta time " + deltaTime.value);
            this.tracks[processedTracks++] = {
                data: subArray,
                offset: deltaTime.length,
                count: deltaTime.value + 1,
                lastEvent: 0,
                loopOffset: 0,
                active: true
            };
        }
        offset += chunkHeader.length;
    }

    if (headerProcessed) {
        if (!this.masterChannel) {
            Log.getLog().error("SMF: master channel is not set");
            return false;
        }
        this._updateTimer();
    }
    this.error = !headerProcessed;
    return headerProcessed;
};

/**
 * Stop playback.
 */
SmfPlayer.prototype.stop = function () {
    this.error = true;
};
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
/**
 * T'SoundSystem for JavaScript
 */

/**
 * TssChannel prototype
 *
 * This prototype implements virtual sound devices which are used in
 * original T'SS v1 series.
 * @author Takashi Toyoshima <toyoshim@gmail.com>
 *
 * @constructor
 */
var TssChannel = function () {
    this.sampleRate = MasterChannel.DEFAULT_SAMPLE_FREQUENCY;
    this.buffer = null;
    this.fmBuffer = [ null, null, null, null ];
    this.player = null;
    this.module = [];
    this.midi = new Array(TssChannel.MAX_MIDI_PORT);
    for (var i = 0; i < TssChannel.MAX_MIDI_PORT; ++i)
        this.midi[i] = new TssChannel.MIDI();
    this.timer = [
        { enable: false, timer: 0, count: 0, base: 0, self: null,
          callback: null },
        { enable: false, timer: 0, count: 0, base: 0, self: null,
          callback: null }
    ];
    this.maxChannel = 0;
    this.wave = [];
}

TssChannel.MAX_MIDI_PORT = 4;
TssChannel.MODULE_CHANNEL_L = 0;
TssChannel.MODULE_CHANNEL_R = 1;
TssChannel.MODULE_CHANNEL_C = 2;
TssChannel.FM_OUT_MODE_OFF = 0;
TssChannel.FM_OUT_MODE_NEW = 1;
TssChannel.FM_OUT_MODE_ADD = 2;
TssChannel._RND_TABLE = new Int8Array(4096);
TssChannel._SIN_TABLE = new Int8Array(256);

// Calculate tables.
(function () {
    var i;
    for (i = 0; i < 4096; i++) {
        var u8 = ((~~(Math.random() * 0x7fffffff)) >> 8) & 0xff;
        if (u8 >= 0x80)
            u8 = u8 - 0x100;
        TssChannel._RND_TABLE[i] = u8;
    }

    for (i = 0; i < 256; i++)
        TssChannel._SIN_TABLE[i] = ~~(Math.sin(Math.PI * i / 128) * 64 + 0.5);
})();

/**
 * @see MasterChannel
 * @param length buffer length or size in shorts
 */
TssChannel.prototype.setBufferLength = function (length) {
    this.buffer = new Int32Array(length);
    for (var i = 0; i < 4; i++) {
        this.fmBuffer[i] = new Int32Array(length);
    }
    for (var port = 0; port < TssChannel.MAX_MIDI_PORT; ++port) {
        if (this.midi[port])
            this.midi[port].setBufferLength(length);
    }
};

/**
 * @see MasterChannel
 * @param rate sample rate
 */
TssChannel.prototype.setSampleRate = function (rate) {
    this.sampleRate = rate;
    for (var id = 0; id < 2; ++id) {
        var biasedCount = (this.timer[id].base * rate / 44100) | 0;
        this.timer[id].timer = biasedCount;
        this.timer[id].count = biasedCount;
    }
};

/**
 * @see MasterChannel
 * @return audio stream buffer
 */
TssChannel.prototype.getBuffer = function () {
    return this.buffer;
};

/**
 * @see MasterChannel
 * @param newPlayer player to call back
 */
TssChannel.prototype.setPlayer = function (newPlayer) {
    this.player = newPlayer;
};

/**
 * @see MasterChannel
 * @param length sound length in short to generate
 */
TssChannel.prototype.generate = function (length) {
    var offset = 0;
    while (offset < length) {
        var timerCount = (length - offset) >> 2;
        var timerId;
        for (timerId = 0; timerId < 2; timerId++) {
            if (this.timer[timerId].enable &&
                    (this.timer[timerId].count < timerCount))
                timerCount = this.timer[timerId].count;
        }
        var generateCount = timerCount << 2;
        this._generateInternal(offset, generateCount);
        offset += generateCount;
        for (timerId = 0; timerId < 2; timerId++) {
            if (!this.timer[timerId].enable)
                continue;
            this.timer[timerId].count -= timerCount;
            if (0 != this.timer[timerId].count)
                continue;
            // Invoke callback.
            this.timer[timerId].count = this.timer[timerId].timer;
            this.timer[timerId].callback.apply(this.timer[timerId].self);
        }
    }
};

/**
 * Reset internal states.
 * @param devices Array of devices which implement MidiChannel and MasterChannel
 */
TssChannel.prototype.reset = function () {
    for (var i = 0; i < TssChannel.MAX_MIDI_PORT; ++i)
        if (this.midi[i].device)
            this.midi[i].device.processSystemReset();
}

/**
 * Set virtual MIDI devices in Array.
 * @param devices Array of devices which implement MidiChannel and MasterChannel
 */
TssChannel.prototype.setVirtualDevices = function (devices) {
    for (var i = 0; i < TssChannel.MAX_MIDI_PORT; ++i)
        this.midi[i].setDevice(devices[i]);
}

/**
 * Check if the module channele id is in range of maxChannel.
 * @param id module channel id
 * @throws RangeError module channel id is out of range of maxChannel
 */
TssChannel.prototype._CheckId = function (id) {
    if ((typeof id == 'undefined') || (id > this.maxChannel))
        throw new RangeError('TSC: Invalid module channel: ' + id);
};

/**
 * Set max channel number.
 * @param maxChannel max channel number
 */
TssChannel.prototype.setMaxChannel = function (maxChannel) {
    this.maxChannel = maxChannel;
    for (var ch = 0; ch < maxChannel; ch++)
        this.module[ch] = new TssChannel.Module(this, ch);
};

/**
 * Set wave data.
 * @param id table id
 * @param wave wave data of Int8Array
 */
TssChannel.prototype.setWave = function (id, wave) {
    Log.getLog().info('TSC: Set wave table ' + id);
    Log.getLog().info(wave);
    this.wave[id] = wave;
};

/**
 * Set timer callback. Timer will be disabled if callback is null.
 * @param id timer id which must be 0 or 1
 * @param count timer count by sampling number
 * @param callback callback function
 */
TssChannel.prototype.setTimerCallback = function (id, count, self, callback) {
    if (id > 2)
        return;
    if ((null != callback) && (count <= 0))
        return;
    var biasedCount = (count * this.sampleRate / 44100) | 0;
    this.timer[id] = {
        enable: null != callback,
        timer: biasedCount,
        count: biasedCount,
        base: count,
        self: self,
        callback: callback
    };
};

/**
 * Set module frequency.
 * @param id module id
 * @param frequency frequency
 * @throws RangeError module channel id is out of range of maxChannel
 */
TssChannel.prototype.setModuleFrequency = function (id, frequency) {
    this._CheckId(id);
    this.module[id].frequency = frequency;
};

/**
 * Set module volume.
 * @param id module id
 * @param ch channel
 * @param volume volume
 * @throws RangeError module channel id is out of range of maxChannel
 */
TssChannel.prototype.setModuleVolume = function (id, ch, volume) {
    this._CheckId(id);
    if (ch == TssChannel.MODULE_CHANNEL_L)
        this.module[id].volume.l = volume;
    else if (ch == TssChannel.MODULE_CHANNEL_R)
        this.module[id].volume.r = volume;
    else if (ch == TssChannel.MODULE_CHANNEL_C)
        this.module[id].volume.c = volume;
    else
        Log.getLog().error('TSC: Invalid volume channel: ' + ch);
};

/**
 * Get module volume.
 * @param id module id
 * @param ch channel
 * @throws RangeError module channel id or channel id is out of range
 */
TssChannel.prototype.getModuleVolume = function (id, ch) {
    this._CheckId(id);
    if (ch == TssChannel.MODULE_CHANNEL_L)
        return this.module[id].volume.l;
    else if (ch == TssChannel.MODULE_CHANNEL_R)
        return this.module[id].volume.r;
    throw new RangeError('TSC: Invalid volume channel: ' + id)
};

/**
 * Set module device type
 * @param id module id
 * @param type device type id
 * @throws RangeError module channel id is out of range of maxChannel
 */
TssChannel.prototype.setModuleType = function (id, type) {
    this._CheckId(id);
    this.module[id].setType(type);
    if (TssChannel.Module.TYPE_SCC == type) {
        if (!this.wave[0])
            Log.getLog().warn('TSC: wave table 0 not found');
    }
};

/**
 * Get module device type
 * @param id module id
 * @return device type id
 * @throws RangeError module channel id is out of range of maxChannel
 */
TssChannel.prototype.getModuleType = function (id) {
    this._CheckId(id);
    return this.module[id].type;
};

/**
 * Set module MIDI device ID and channel.
 * @param id module id
 * @param port MIDI device id
 * @param channel MIDI channel
 */
TssChannel.prototype.setModulePort = function (id, port, channel) {
    this._CheckId(id);
    var type = this.getModuleType(id);
    if (TssChannel.Module.TYPE_MIDI != type)
        return;
    this.derefMidi(this.module[id].mid);
    this.addrefMidi(port);
    this.module[id].mid = port;
    this.module[id].mch = channel;
};

/**
 * Set module voice.
 * @param id module id
 * @param voice voice id
 * @throws RangeError module channel id is out of range of maxChannel
 */
TssChannel.prototype.setModuleVoice = function (id, voice) {
    this._CheckId(id);
    var type = this.getModuleType(id);
    if (TssChannel.Module.TYPE_SCC == type) {
        if (!this.wave[voice])
            Log.getLog().warn('TSC: wave table ' + voice + ' not found');
    } else if (TssChannel.Module.TYPE_MIDI == type) {
        var device = this.midi[this.module[id].mid].device;
        if (device)
            device.processProgramChange(this.module[id].mch, voice);
    }
    this.module[id].voice = voice;
};

/**
 * Set module fm input pipe.
 * @see TssChannel.Module.setFmInPipe
 * @param id module id
 * @param rate modulation rate
 * @param pipe pipe id
 * @throws RangeError module channel id is out of range of maxChannel
 */
TssChannel.prototype.setModuleFmInPipe = function (id, rate, pipe) {
    this._CheckId(id);
    this.module[id].setFmInPipe(rate, pipe);
};

/**
 * Set module fm output pipe.
 * @see TssChannel.Module.setFmOutPipe
 * @param id module id
 * @param mode connection mode
 * @param pipe pipe id
 * @throws RangeError module channel id is out of range of maxChannel
 */
TssChannel.prototype.setModuleFmOutPipe = function (id, mode, pipe) {
    this._CheckId(id);
    this.module[id].setFmOutPipe(mode, pipe);
};

/**
 * Set module phase.
 * @param id module id
 * @param phase phase to set
 * @throws RangeError module channel id is out of range of maxChannel
 */
TssChannel.prototype.setModulePhase = function (id, phase) {
    this._CheckId(id);
    this.module[id].phase = phase;
};

TssChannel.prototype.keyOn = function (id, note) {
    this._CheckId(id);
    var type = this.getModuleType(id);
    if (TssChannel.Module.TYPE_MIDI != type)
        return;
    this.module[id].note = note;
    var device = this.midi[this.module[id].mid].device;
    if (device) {
        device.processNoteOn(this.module[id].mch, note,
                this.module[id].volume.c >> 1);
    }
};

TssChannel.prototype.keyOff = function (id) {
    this._CheckId(id);
    var type = this.getModuleType(id);
    if (TssChannel.Module.TYPE_MIDI != type)
        return;
    var device = this.midi[this.module[id].mid].device;
    if (device)
        device.processNoteOff(this.module[id].mch, this.module[id].note, 0);
};

TssChannel.prototype.pitchBend = function (id, bend) {
    this._CheckId(id);
    var type = this.getModuleType(id);
    if (TssChannel.Module.TYPE_MIDI != type)
        return;
    var device = this.midi[this.module[id].mid].device;
    if (device)
        device.processPitchBend(this.module[id].mch, bend);
};

TssChannel.prototype.panpot = function (id, panpot) {
    this._CheckId(id);
    var type = this.getModuleType(id);
    if (TssChannel.Module.TYPE_MIDI != type)
        return;
    var device = this.midi[this.module[id].mid].device;
    if (device)
        device.processControlChange(this.module[id].mch, 10, panpot);
};

/**
 * Generate sounds into a partial buffer.
 * @param offset offset in buffer to start
 * @param count sie to generate
 */
TssChannel.prototype._generateInternal = function (offset, count) {
    var buffer = this.buffer.subarray(offset, offset + count);
    var fmBuffer = [
        this.fmBuffer[0].subarray(offset, offset + count),
        this.fmBuffer[1].subarray(offset, offset + count),
        this.fmBuffer[2].subarray(offset, offset + count),
        this.fmBuffer[3].subarray(offset, offset + count)
    ];
    for (var i = 0; i < count; i++)
        buffer[i] = 0;
    for (var ch = 0; ch < this.maxChannel; ch++)
        this.module[ch].generate(buffer, fmBuffer);
    for (var port = 0; port < TssChannel.MAX_MIDI_PORT; ++port) {
        if (!this.midi[port].device || this.midi[port].reference == 0)
            continue;
        this.midi[port].device.generate(count);
        var inBuffer = this.midi[port].inBuffer;
        for (var n = 0; n < count; ++n)
            buffer[n] += inBuffer[n];
    }
};

/**
 * Increment MIDI device reference.
 * @param port MIDI device index
 */
TssChannel.prototype.addrefMidi = function (port) {
    if (TssChannel.MAX_MIDI_PORT <= port)
        return;
    this.midi[port].reference++;
};

/**
 * Decrement MIDI device reference.
 * @param port MIDI device index
 */
TssChannel.prototype.derefMidi = function (port) {
    if (TssChannel.MAX_MIDI_PORT <= port)
        return;
    this.midi[port].reference--;
};

/**
 * Module prototype
 *
 * This prototype implements inner class to emulate sound devices.
 * @constructor
 * @param channel parent channel object
 * @param ch module id
 */
TssChannel.Module = function (channel, ch) {
    this.id = ch;
    this.channel = channel;
    this.volume = {
        l: 0,
        r: 0,
        c: 0
    };
    this.frequency = 0;
    this.fm = {
        inRate: 0,
        inPipe: 0,
        outMode: 0,
        outPipe: 0
    };
    this.multiple = 1;
    this.note = 0;
    this.setType(TssChannel.Module.TYPE_PSG);
};

TssChannel.Module.TYPE_INVALID = -1;
TssChannel.Module.TYPE_PSG = 0;
TssChannel.Module.TYPE_FC = 1;
TssChannel.Module.TYPE_NOISE = 2;
TssChannel.Module.TYPE_SIN = 3;
TssChannel.Module.TYPE_SCC = 4;
TssChannel.Module.TYPE_OSC = 5;  // TODO
TssChannel.Module.TYPE_GB_SQUARE = 13;  // TODO
TssChannel.Module.TYPE_GB_WAVE = 14;  // TODO
TssChannel.Module.TYPE_MIDI = 15;

/**
 * Set module device type.
 * @param type device type id
 */
TssChannel.Module.prototype.setType = function (type) {
    if (this.type == TssChannel.Module.TYPE_MIDI)
        this.channel.derefMidi(this.mid);
    this.type = type;
    this.count = 0;
    this.phase = 0;
    this.voice = 0;
    this.mid = 0;
    this.mch = 0;
    switch (type) {
        case TssChannel.Module.TYPE_PSG:
            this.generate = this.generatePsg;
            break;
        case TssChannel.Module.TYPE_FC:
            this.generate = this.generateFc;
            this.voice = 3;
            break;
        case TssChannel.Module.TYPE_NOISE:
            this.generate = this.generateNoise;
            break;
        case TssChannel.Module.TYPE_SCC:
            this.generate = this.generateScc;
            break;
        case TssChannel.Module.TYPE_SIN:
            this.generate = this.generateSin;
            break;
        case TssChannel.Module.TYPE_MIDI:
            this.generate = this.generateNothing;
            this.channel.addrefMidi(this.mid);
            break;
        default:
            // TODO: Implement other types.
            Log.getLog().warn('TSC: unknown device type ' + type);
            this.generate = this.generateNothing;
            break;
    }
};

/**
 * Set frequency modulation input pipe connection. The input pipe affect
 * pow(-2, rate) if rate is not 0. Otherwise, Pipe is not used.
 * @param rate input rate
 * @param pipe pipe id
 */
TssChannel.Module.prototype.setFmInPipe = function (rate, pipe) {
    this.fm.inRate = rate;
    this.fm.inPipe = pipe;
};

/**
 * Set frequency modulation output pipe connection.
 * @param mode connection mode
 *      TssChannel.FM_OUT_MODE_OFF: Don't use frequency modulation
 *      TssChannel.FM_OUT_MODE_ADD: Add output into specified pipe
 *      TssChannel.FM_OUT_MODE_NEW: Write output into specified pipe
 * @param pipe pipe id
 */
TssChannel.Module.prototype.setFmOutPipe = function (mode, pipe) {
    this.fm.outMode = mode;
    this.fm.outPipe = pipe;
};

/**
 * Generate a PSG-like sound.
 * @param buffer Int32Array to which generate sound
 * @param fmBuffer Int32Array to which output fm data, or from which input one
 */
TssChannel.Module.prototype.generatePsg = function (buffer, fmBuffer) {
    var volumeL = this.volume.l << 4;
    var volumeR = this.volume.r << 4;
    var length = buffer.length;
    var plus = this.frequency * 2 * this.multiple;
    var count = this.count;
    var phase = this.phase;
    if (0 == phase) {
        volumeL = -volumeL;
        volumeR = -volumeR;
    }
    for (var i = 0; i < length; i += 2) {
        buffer[i + 0] += volumeL;
        buffer[i + 1] += volumeR;
        count += plus;
        while (count > this.channel.sampleRate) {
            volumeL = -volumeL;
            volumeR = -volumeR;
            count -= this.channel.sampleRate;
            phase++;
            phase &= 1;
        }
    }
    this.count = count;
    this.phase = phase;
};

/**
 * Generate a NES-like sound.
 * @param buffer Int32Array to which generate sound
 * @param fmBuffer Int32Array to which output fm data, or from which input one
 */
TssChannel.Module.prototype.generateFc = function (buffer, fmBuffer) {
    var volumeL = this.volume.l << 4;
    var volumeR = this.volume.r << 4;
    var length = buffer.length;
    var plus = this.frequency * 8 * this.multiple;
    var count = this.count;
    var phase = this.phase;
    var voice = this.voice;
    if (phase < voice) {
        volumeL = -volumeL;
        volumeR = -volumeR;
    }
    for (var i = 0; i < length; i += 2) {
        buffer[i + 0] += volumeL;
        buffer[i + 1] += volumeR;
        count += plus;
        while (count > this.channel.sampleRate) {
            count -= this.channel.sampleRate;
            phase++;
            phase &= 7;
            if ((phase == 0) || (phase == voice)) {
                volumeL = -volumeL;
                volumeR = -volumeR;
            }
        }
    }
    this.count = count;
    this.phase = phase;
};

/**
 * Generate a noise sound. The noise is not white noise (maybe brawn?).
 * @param buffer Int32Array to which generate sound
 * @param fmBuffer Int32Array to which output fm data, or from which input one
 */
TssChannel.Module.prototype.generateNoise = function (buffer, fmBuffer) {
    var volumeL = this.volume.l >> 2;
    var volumeR = this.volume.r >> 2;
    var length = buffer.length;
    var plus = this.frequency * this.multiple;
    var count = this.count;
    var phase = this.phase;
    for (var i = 0; i < length; i += 2) {
        var rnd = TssChannel._RND_TABLE[phase];
        buffer[i + 0] += rnd * volumeL;
        buffer[i + 1] += rnd * volumeR;
        count += plus;
        while (count > 0) {
            phase++;
            phase &= 0x0fff;
            count -= 880;
        }
    }
    this.count = count;
    this.phase = phase;
};

/**
 * Generate a SCC like wave table sound.
 * @param buffer Int32Array to which generate sound
 * @param fmBuffer Int32Array to which output fm data, or from which input one
 */
TssChannel.Module.prototype.generateScc = function (buffer, fmBuffer) {
    var wave = this.channel.wave[this.voice];
    if (!wave)
        return;
    var out = buffer;
    if (TssChannel.FM_OUT_MODE_OFF != this.fm.outMode)
        out = fmBuffer[this.fm.outPipe];
    var volumeL = this.volume.l >> 2;
    var volumeR = this.volume.r >> 2;
    var length = buffer.length;
    var plus = this.frequency * 32 * this.multiple;
    var count = this.count;
    var phase = this.phase;
    var i;
    if (0 == this.fm.inRate) {
        if (TssChannel.FM_OUT_MODE_NEW == this.fm.outMode) {
            for (i = 0; i < length; i += 2) {
                out[i + 0] = wave[phase] * volumeL;
                out[i + 1] = wave[phase] * volumeR;
                count += plus;
                while (count > this.channel.sampleRate) {
                    count -= this.channel.sampleRate;
                    phase++;
                    phase &= 31;
                }
            }
        } else {
            for (i = 0; i < length; i += 2) {
                out[i + 0] += wave[phase] * volumeL;
                out[i + 1] += wave[phase] * volumeR;
                count += plus;
                while (count > this.channel.sampleRate) {
                    count -= this.channel.sampleRate;
                    phase++;
                    phase &= 31;
                }
            }
        }
    } else {
        var fm = fmBuffer[this.fm.inPipe];
        var inRate = this.fm.inRate << 3;
        var fmPhaseL;
        var fmPhaseR;
        if (TssChannel.FM_OUT_MODE_NEW == this.fm.outMode) {
            for (i = 0; i < length; i += 2) {
                fmPhaseL = (phase + (fm[i + 0] >> inRate)) & 31;
                fmPhaseR = (phase + (fm[i + 1] >> inRate)) & 31;
                out[i + 0] = wave[fmPhaseL] * volumeL;
                out[i + 1] = wave[fmPhaseR] * volumeR;
                count += plus;
                while (count > this.channel.sampleRate) {
                    count -= this.channel.sampleRate;
                    phase++;
                    phase &= 31;
                }
            }
        } else {
            for (i = 0; i < length; i += 2) {
                fmPhaseL = (phase + (fm[i + 0] >> inRate)) & 31;
                fmPhaseR = (phase + (fm[i + 1] >> inRate)) & 31;
                out[i + 0] += wave[fmPhaseL] * volumeL;
                out[i + 1] += wave[fmPhaseR] * volumeR;
                count += plus;
                while (count > this.channel.sampleRate) {
                    count -= this.channel.sampleRate;
                    phase++;
                    phase &= 31;
                }
            }
        }
    }
    this.count = count;
    this.phase = phase;
};

/**
 * Generate a Sine wave sound.
 * @param buffer Int32Array to which generate sound
 * @param fmBuffer Int32Array to which output fm data, or from which input one
 */
TssChannel.Module.prototype.generateSin = function (buffer, fmBuffer) {
    var out = buffer;
    if (TssChannel.FM_OUT_MODE_OFF != this.fm.outMode)
        out = fmBuffer[this.fm.outPipe];
    var volumeL = this.volume.l >> 1;
    var volumeR = this.volume.r >> 1;
    var length = buffer.length;
    var plus = this.frequency * 256 * this.multiple;
    var count = this.count;
    var phase = this.phase;
    var i;
    if (0 == this.fm.inRate) {
        if (TssChannel.FM_OUT_MODE_NEW == this.fm.outMode) {
            for (i = 0; i < length; i += 2) {
                out[i + 0] = TssChannel._SIN_TABLE[phase] * volumeL;
                out[i + 1] = TssChannel._SIN_TABLE[phase] * volumeR;
                count += plus;
                while (count > this.channel.sampleRate) {
                    count -= this.channel.sampleRate;
                    phase++;
                    phase &= 0xff;
                }
            }
        } else {
            for (i = 0; i < length; i += 2) {
                out[i + 0] += TssChannel._SIN_TABLE[phase] * volumeL;
                out[i + 1] += TssChannel._SIN_TABLE[phase] * volumeR;
                count += plus;
                while (count > this.channel.sampleRate) {
                    count -= this.channel.sampleRate;
                    phase++;
                    phase &= 0xff;
                }
            }
        }
    } else {
        var fm = fmBuffer[this.fm.inPipe];
        var inRate = this.fm.inRate;
        var fmPhaseL;
        var fmPhaseR;
        if (TssChannel.FM_OUT_MODE_NEW == this.fm.outMode) {
            for (i = 0; i < length; i += 2) {
                fmPhaseL = (phase + (fm[i + 0] >> inRate)) & 0xff;
                fmPhaseR = (phase + (fm[i + 1] >> inRate)) & 0xff;
                out[i + 0] = TssChannel._SIN_TABLE[fmPhaseL] * volumeL;
                out[i + 1] = TssChannel._SIN_TABLE[fmPhaseR] * volumeR;
                count += plus;
                while (count > this.channel.sampleRate) {
                    count -= this.channel.sampleRate;
                    phase++;
                    phase &= 0xff;
                }
            }
        } else {
            for (i = 0; i < length; i += 2) {
                fmPhaseL = (phase + (fm[i + 0] >> inRate)) & 0xff;
                fmPhaseR = (phase + (fm[i + 1] >> inRate)) & 0xff;
                out[i + 0] += TssChannel._SIN_TABLE[fmPhaseL] * volumeL;
                out[i + 1] += TssChannel._SIN_TABLE[fmPhaseR] * volumeR;
                count += plus;
                while (count > this.channel.sampleRate) {
                    count -= this.channel.sampleRate;
                    phase++;
                    phase &= 0xff;
                }
            }
        }
    }
    this.count = count;
    this.phase = phase;
};

/**
 * Generate nothing. This is dummy function to mimic generate* methods.
 * @param buffer Int32Array to which generate sound
 * @param fmBuffer Int32Array to which output fm data, or from which input one
 */
TssChannel.Module.prototype.generateNothing = function (buffer, fmBuffer) {
};

/**
 * MIDI prototype
 *
 * This prototype implements inner class to manage a virtual MIDI device.
 * @constructor
 */
TssChannel.MIDI = function () {
    this.device = null;
    this.bufferLength = 0;
    this.inBuffer = null;
    this.reference = 0;
};

/**
 * Set virtual MIDI device.
 * @param device virtual MIDI device
 */
TssChannel.MIDI.prototype.setDevice = function (device) {
    if (device && this.bufferLength != 0) {
        device.setBufferLength(length);
        this.inBuffer = this.device.getBuffer();
    }
    this.device = device;
};

/**
 * @see MasterChannel
 * @param length buffer length or size in shorts
 */
TssChannel.MIDI.prototype.setBufferLength = function (length) {
    this.bufferLength = length;
    if (this.device) {
        this.device.setBufferLength(length);
        this.inBuffer = this.device.getBuffer();
    }
};
/**
 * T'SoundSystem for JavaScript
 */

/**
 * TsdPlayer prototype
 *
 * Play TSD format files.
 * @author Takashi Toyoshima <toyoshim@gmail.com>
 *
 * @constructor
 */
var TsdPlayer = function () {
    this.device = null;
    this.input = null;
    this.header = null;
    this.channel = null;
    this.activeChannel = 0;
    this.midi = new Array(TsdPlayer.MAX_MIDI_PORT);
    this.table = [];
    for (var i = 0; i < 256; i++)
        this.table[i] = new Uint8Array(0);
}

TsdPlayer.VERSION = 0.94;
TsdPlayer.MAX_MIDI_PORT = TssChannel.MAX_MIDI_PORT;
TsdPlayer.CMD_LAST_NOTE = 0x7f;
TsdPlayer.CMD_NOTE_OFF = 0x80;
TsdPlayer.CMD_VOLUME_MONO = 0x81;
TsdPlayer.CMD_SUSTAIN_MODE = 0x82;
TsdPlayer.CMD_DETUNE = 0x83;
TsdPlayer.CMD_PORTAMENT = 0x84;
TsdPlayer.CMD_VOLUME_LEFT = 0x85;
TsdPlayer.CMD_VOLUME_RIGHT = 0x86;
TsdPlayer.CMD_PANPOT = 0x87;
TsdPlayer.CMD_RELATIVE_VOLUME_UP = 0x88;
TsdPlayer.CMD_RELATIVE_VOLUME_DOWN = 0x89;
TsdPlayer.CMD_TEMPO = 0x90;
TsdPlayer.CMD_FINENESS = 0x91;
TsdPlayer.CMD_KEY_ON_PHASE = 0x92;
TsdPlayer.CMD_MULTIPLE = 0x93;
TsdPlayer.CMD_PITCH_MODULATION_DELAY = 0xa0;
TsdPlayer.CMD_PITCH_MODULATION_DEPTH = 0xa1;
TsdPlayer.CMD_PITCH_MODULATION_WIDTH = 0xa2;
TsdPlayer.CMD_PITCH_MODULATION_HEIGHT = 0xa3;
TsdPlayer.CMD_PITCH_MODULATION_DELTA = 0xa4;
TsdPlayer.CMD_AMP_EMVELOPE = 0xb8;
TsdPlayer.CMD_NOTE_EMVELOPE = 0xc8;
TsdPlayer.CMD_ENDLESS_LOOP_POINT = 0xe0;
TsdPlayer.CMD_LOCAL_LOOP_START = 0xe1;
TsdPlayer.CMD_LOCAL_LOOP_BREAK = 0xe2;
TsdPlayer.CMD_LOCAL_LOOP_END = 0xe3;
TsdPlayer.CMD_FREQUENCY_MODE_CHANGE = 0xf0;
TsdPlayer.CMD_VOLUME_MODE_CHANGE = 0xf1;
TsdPlayer.CMD_FM_IN = 0xf8;
TsdPlayer.CMD_FM_OUT = 0xf9;
TsdPlayer.CMD_CONTROL_CHANGE = 0xfb;
TsdPlayer.CMD_PORT_CHANGE = 0xfc;
TsdPlayer.CMD_VOICE_CHANGE = 0xfd;
TsdPlayer.CMD_MODULE_CHANGE = 0xfe;
TsdPlayer.CMD_END = 0xff;
TsdPlayer._DEFAULT_TIMER_COUNT = 368;
TsdPlayer._TIMER_AUTOMATION = 0;
TsdPlayer._TIMER_SEQUENCER = 1;
TsdPlayer._CH_L = TssChannel.MODULE_CHANNEL_L;
TsdPlayer._CH_R = TssChannel.MODULE_CHANNEL_R;
TsdPlayer._CH_C = TssChannel.MODULE_CHANNEL_C;
TsdPlayer._PAN_L = 1;
TsdPlayer._PAN_R = 2;
TsdPlayer._PAN_C = TsdPlayer._PAN_L | TsdPlayer._PAN_R;
TsdPlayer._FREQUENCY_TYPE_NORMAL = 0;
TsdPlayer._FREQUENCY_TYPE_MSX = 1;
TsdPlayer._FREQUENCY_TYPE_FM = 2;
TsdPlayer._FREQUENCY_TYPE_GB_SQUARE = 3;
TsdPlayer._VOLUME_TYPE_NORMAL = 0;
TsdPlayer._VOLUME_TYPE_FM = 1;
TsdPlayer._NOTE_FREQUENCY_TABLE = [ null, null, null, null ];
TsdPlayer._NOTE_PARAMETER_TABLE = [ null, null, null, null ];
TsdPlayer._PARAMETER_FREQUENCY_TABLE = [ null, null,null, null ];
TsdPlayer._FM_VOLUME_TABLE = null;
TsdPlayer._MSX_PARAMETER_TABLE = [
    0x0D5D, 0x0C9C, 0x0BE7, 0x0B3C, 0x0A9B, 0x0A02, 0x0973, 0x08EB,
    0x086B, 0x07F2, 0x0780, 0x0714, 0x06AF, 0x064E, 0x05F4, 0x059E,
    0x054E, 0x0501, 0x04BA, 0x0476, 0x0436, 0x03F9, 0x03C0, 0x038A,
    0x0357, 0x0327, 0x02FA, 0x02CF, 0x02A7, 0x0281, 0x025D, 0x023B,
    0x021B, 0x01FD, 0x01E0, 0x01C5, 0x01AC, 0x0194, 0x017D, 0x0168,
    0x0153, 0x0140, 0x012E, 0x011D, 0x010D, 0x00FE, 0x00F0, 0x00E3,
    0x00D6, 0x00CA, 0x00BE, 0x00B4, 0x00AA, 0x00A0, 0x0097, 0x008F,
    0x0087, 0x007F, 0x0078, 0x0071, 0x006B, 0x0065, 0x005F, 0x005A,
    0x0055, 0x0050, 0x004C, 0x0047, 0x0043, 0x0040, 0x003C, 0x0039,
    0x0035, 0x0032, 0x0030, 0x002D, 0x002A, 0x0028, 0x0026, 0x0024,
    0x0022, 0x0020, 0x001E, 0x001C, 0x001B, 0x0019, 0x0018, 0x0016,
    0x0015, 0x0014, 0x0013, 0x0012, 0x0011, 0x0010, 0x000F, 0x000E
];

// Calculate tables.
(function () {
    var i;

    // from note to frequency table for NORMAL mode
    var table = new Uint16Array(0x80);
    TsdPlayer._NOTE_FREQUENCY_TABLE[TsdPlayer._FREQUENCY_TYPE_NORMAL] = table;
    for (i = 0; i < 0x80; i++)
        table[i] = ~~(440 * Math.pow(2, (i - 69) / 12) + 0.5);

    // from note to frequency table for GB_SQUARE mode
    table = new Uint16Array(0x80);
    TsdPlayer._NOTE_FREQUENCY_TABLE[TsdPlayer._FREQUENCY_TYPE_GB_SQUARE] =
            table;
    for (i = 0; i < 0x80; i++) {
        var frequency = 440 * Math.pow(2, (i - 69) / 12);
        var param = 2048 - 131072 / frequency + 0.5;
        if (param < 0)
            param = 0;
        table[i] = param;
    }

    // from note to parameter table for MSX mode
    table = new Uint16Array(0x80);
    TsdPlayer._NOTE_PARAMETER_TABLE[TsdPlayer._FREQUENCY_TYPE_MSX] = table;
    for (i = 0; i < 12; i++)
        table[i] = 0;
    for (i = 12; i < 108; i++)
        table[i] = TsdPlayer._MSX_PARAMETER_TABLE[i - 12];
    for (i = 108; i < 128; i++)
        table[i] = 0;

    // from parameter to frequency table for MSX mode
    table = new Uint16Array(4096);
    TsdPlayer._PARAMETER_FREQUENCY_TABLE[TsdPlayer._FREQUENCY_TYPE_MSX] =
            table;
    table[0] = 0;
    for (i = 1; i < 4096; i++)
        table[i] = ~~((1.7897725e+6 / 16 / i / 2) + 0.5);

    // from parameter to frequency table for FM mode
    table = new Uint16Array(0x2000);
    TsdPlayer._PARAMETER_FREQUENCY_TABLE[TsdPlayer._FREQUENCY_TYPE_FM] = table;
    for (i = 0; i < 0x2000; i++) {
        var tone = i >> 6;
        var fine = i & 0x3f;
        var power = ((tone - 69) + fine / 64) / 12;
        table[i] = ~~(440 * Math.pow(2, power) + 0.5);
    }

    // volume table for FM mode
    table = new Uint8Array(256);
    TsdPlayer._FM_VOLUME_TABLE = table;
    for (i = 0; i < 256; i++)
        table[i] = ~~(255 * Math.pow(10, -0.75 * (255 - i) / 2 / 20) + 0.5);
})();

/**
 * Set master channel. This function prepares required device channel and
 * connect it player and master channel.
 * @param channel master channel
 */
TsdPlayer.prototype.setMasterChannel = function (channel) {
    this.device = new TssChannel();
    this.device.setPlayer(this);
    this.device.setVirtualDevices(this.midi);
    channel.clearChannel();
    channel.addChannel(this.device);
};

/**
 * Set virtual MIDI channel at port number |port|.
 * @param port MIDI port index
 * @param midi MIDI device which implement MidiChannel and MasterChannel
 * @return true if success
 */ 
TsdPlayer.prototype.setMIDI = function (port, midi) {
    if (port >= TsdPlayer.MAX_MIDI_PORT)
        return false;
    this.midi[port] = midi;
    if (this.device)
        this.device.setVirtualDevices(this.midi);
    return true;
};

/**
 * Read signed 8bit data from input buffer.
 * @param offset offset to be read
 * @return read data
 */
TsdPlayer.prototype._readI8 = function (offset) {
    var data = this.input[offset];
    if (data >= 0x80)
        data = data - 0x100;
    return data;
};

/**
 * Read unsigned 16bit data from input buffer.
 * @param offset offset to be read
 * @return read data
 */
TsdPlayer.prototype._readU16 = function (offset) {
    return (this.input[offset] << 8) | this.input[offset + 1];
};

/**
 * Read unsigned 32bit data from input buffer.
 * @param offset offset to be read
 * @return read data
 */
TsdPlayer.prototype._readU32 = function (offset) {
    var i32 = (this.input[offset] << 24) | (this.input[offset + 1] << 16) |
            (this.input[offset + 2] << 8) | this.input[offset + 3];
    if (i32 < 0)
        return 0x100000000 + i32;
    return i32;
};

/**
 * Clamp number value between min and max.
 * @param value original value
 * @param min minimum value
 * @param max maximum value
 * @return clamped value
 */
TsdPlayer.prototype._clamp = function (value, min, max) {
    if (value < min)
        return min;
    if (value > max)
        return max;
    return value;
};

/**
 * Set table data.
 * @param id table id
 * @param table table data of Int8Array
 */
TsdPlayer.prototype._setTable = function (id, table) {
    Log.getLog().info('TSD: Set envelope table ' + id);
    Log.getLog().info(table);
    this.table[id] = table;
};

/**
 * Decode and play.
 * @param newInput ArrayBuffer to play
 * @return success or not
 */
TsdPlayer.prototype.play = function (newInput) {
    try {
        this.input = new Uint8Array(newInput);
        var tstring = TString.createFromUint8Array(this.input);
        if (!tstring.containASCII(0, 'T\'SoundSystem')) {
            Log.getLog().warn('TSD: magic T\'SoundSystem not found.');
            return false;
        }
        var header = {};
        // Check version headers.
        header.majorVersion = this.input[14];
        header.minorVersion = this.input[15];
        header.fullVersion = header.majorVersion + header.minorVersion / 100;
        Log.getLog().info('TSD: version = ' + header.fullVersion);
        if ((header.fullVersion <= 0.60) ||
                (TsdPlayer.VERSION < header.fullVersion)) {
            Log.getLog().warn('TSD: unsupported format');
            return false;
        }

        // Parse the music title.
        header.titleSize = this._readU16(16);
        header.title = TString.createFromUint8Array(
                this.input.subarray(18, 18 + header.titleSize)).toString();
        Log.getLog().info('TSD: title = ' + header.title);

        var offset = 18 + ((header.titleSize + 1) & ~1);
        header.numOfChannel = this._readU16(offset);
        offset += 2;
        Log.getLog().info('TSD: channel = ' + header.numOfChannel);
        this.device.reset();
        this.device.setMaxChannel(header.numOfChannel);
        this.header = header;
        this.activeChannel = header.numOfChannel;

        // Parse channel information.
        var channel = [];
        var i;
        for (i = 0; i < header.numOfChannel; i++) {
            channel[i] = {
                id: i,  // module id
                baseOffset: 0,  // offset to sequence data in input buffer
                size: 0,  // sequence data size
                offset: 0,  // current processing offset to sequence data
                loop: {  // loop information
                    offset: 0,  // offset to loop start poit of sequence data
                    count: 0  // current loop count
                },
                localLoop:[],  // inner loop information
                wait: 1,  // wait count to the next processing
                sustain: 0,  // sustain level
                portament: 0,  // portament depth
                detune: 0,  // detune depth
                keyOn: false,  // key on state
                volume: {  // base volume information
                    type: 0,  // volume type
                    l: 0,  // left volume
                    c: 0,  // mono volume
                    r:0  // right volume
                },
                pan: TsdPlayer._PAN_C,  // panpot
                frequency: {  // frequency information
                    type: 0,  // frequency type
                    note: 0,  // original note id
                    param: 0,  // type specific intermediate parameter
                    hz: 0  // frequency to play
                },
                tone: 0,
                phase: 0,  // initial phase at key on
                pitchModulation: {  // pitch modulation information
                    enable: false,  // enable flag
                    base: 0,  // base frequency parameter
                    delayCount: 0,  // delay counter
                    widthCount: 0,  // width counter
                    deltaCount: 0,  // delta counter
                    currentDepth: 0,  // current depth parameter
                    currentHeight: 0,  // current height (+height or -height)
                    currentDiff: 0,  // current offset from base
                    delay: 0,  // delay parameter
                    depth: 0,  // depth parameter
                    width: 0,  // with parameter
                    height: 0,  // height parameter
                    delta: 0  // delta parameter
                },
                ampEnvelope: {  // amplifier envelope information
                    enable: false,  // enable flag
                    id: 0,  // table id
                    wait: 0,  // wait counter
                    state: 0,  // envelope step position
                    count: 0,  // wait count
                    volume: {  // base volume parameter
                        l: 0,  // left volume
                        r: 0  // right volume
                    }
                },
                nt: {
                    enable: false,
                    id: 0,
                    wait: 0,
                    state: 0,
                    count: 0
                }
            };
            for (var n = 0; n < 16; n++) {
                channel[i].localLoop[n] = {
                    offset: 0,  // loop start offset
                    count: 0,  // loop count
                    end: 0  // loop end offset
                };
            }
            channel[i].baseOffset = this._readU32(offset);
            offset += 4;
            channel[i].size = this._readU32(offset);
            offset += 4;
            Log.getLog().info('TSD: ch.' + (i + 1) + ' offset = ' +
                    channel[i].baseOffset + ', size = ' + channel[i].size);
        }
        Log.getLog().info(channel);
        this.channel = channel;

        // Parse table information.
        var tableOffset = this._readU32(offset);
        Log.getLog().info('TSD: table offset = ' + tableOffset);
        offset = tableOffset;
        var numOfWave = this._readU16(offset);
        Log.getLog().info('TSD: found ' + numOfWave + ' wave table(s)');
        offset += 2;
        for (i = 0; i < numOfWave; i++) {
            // Wave table data for a SCC-like sound.
            if (32 != this.input[offset + 1]) {
                Log.getLog().error('TSD: invalid WAVE size');
                return false;
            }
            this.device.setWave(this.input[offset],
                    new Int8Array(newInput, offset + 2, 32));
            offset += 2 + 32;
        }
        var numOfTable = this._readU16(offset);
        Log.getLog().info('TSD: found ' + numOfTable + ' envelope table(s)');
        offset += 2;
        for (i = 0; i < numOfTable; i++) {
            // Table data for envelope.
            var tableSize = this.input[offset + 1];
            this._setTable(this.input[offset],
                    new Int8Array(newInput, offset + 2, tableSize));
            offset += 2 + tableSize;
        }

        // Set timer callbacks
        this.device.setTimerCallback(TsdPlayer._TIMER_AUTOMATION,
                TsdPlayer._DEFAULT_TIMER_COUNT, this, this._performAutomation);
        this.device.setTimerCallback(TsdPlayer._TIMER_SEQUENCER,
                TsdPlayer._DEFAULT_TIMER_COUNT, this, this._performSequencer);
    } catch (e) {
        Log.getLog().error('TSD: ' + e);
        return false;
    }
    return true;
};

/**
 * Perform device automation, e.g., sastain, portament, envelope, modulation.
 */
TsdPlayer.prototype._performAutomation = function () {
    for (var i = 0; i < this.header.numOfChannel; i++) {
        var ch = this.channel[i];
        if (!ch.keyOn) {
            // Key off processings.
            if (0 != ch.sustain)
                this._performSustain(ch);
            if (0 != ch.portament)
                this._performPortament(ch);
        }
        // TODO: note envelope

        if (ch.pitchModulation.enable)
            this._performPitchModulation(ch);
        if (ch.ampEnvelope.enable)
            this._performAmpEnvelope(ch);
    }
};

/**
 * Perform sustain.
 * @param ch channel oject to control
 */
TsdPlayer.prototype._performSustain = function (ch) {
    if (ch.ampEnvelope.volume.l > ch.sustain)
        ch.ampEnvelope.volume.l -= ch.sustain;
    else
        ch.ampEnvelope.volume.l = 0;
    if (ch.ampEnvelope.volume.r > ch.sustain)
        ch.ampEnvelope.volume.r -= ch.sustain;
    else
        ch.ampEnvelope.volume.r = 0;
    // Reproduce a bug that sustain could not reflect panpot correctly.
    // Reproduce a bug that sustain could not reflect panpot correctly.
    var pan = ch.pan;
    ch.pan = TsdPlayer._PAN_C;
    this._setVolume(ch, TsdPlayer._CH_L, ch.ampEnvelope.volume.l);
    this._setVolume(ch, TsdPlayer._CH_R, ch.ampEnvelope.volume.r);
    ch.pan = pan;
};

/**
 * Perform portament.
 * @param ch channel object to contol
 */
TsdPlayer.prototype._performPortament = function (ch) {
    var frequency = ch.frequency.hz;
    switch (ch.frequency.type) {
        case TsdPlayer._FREQUENCY_TYPE_NORMAL:
            if (ch.frequency.param + ch.portament < 1)
                ch.frequency.param = 1;
            else if (ch.frequency.param + ch.portament > 0xffff)
                ch.frequency.param = 0xffff;
            else
                ch.frequency.param += ch.portament;
            frequency = ch.frequency.param;
            break;
        case TsdPlayer._FREQUENCY_TYPE_MSX:
            if (ch.frequency.param - ch.portament < 0)
                ch.frequency.param = 0;
            else if ((ch.frequency.param - ch.portament) > 0x0fff)
                ch.frequency.param = 0x0fff;
            else
                ch.frequency.param -= ch.portament;
            frequency = TsdPlayer._PARAMETER_FREQUENCY_TABLE[
                    TsdPlayer._FREQUENCY_TYPE_MSX][ch.frequency.param];
            break;
        case TsdPlayer._FREQUENCY_TYPE_FM:
            if (ch.frequency.param + ch.portament < 0)
                ch.frequency.param = 0;
            else if ((ch.frequency.param + ch.portament) > 0x1fff)
                ch.frequency.param = 0x1fff;
            else
                ch.frequency.param += ch.portament;
            frequency = TsdPlayer._PARAMETER_FREQUENCY_TABLE[
                TsdPlayer._FREQUENCY_TYPE_FM][ch.frequency.param];
            break;
        case TsdPlayer._FREQUENCY_TYPE_GB_SQUARE:
            // TODO: not supported originally.
            break;
    }
    this.device.setModuleFrequency(ch.id, frequency);
};

/**
 * Perform pitch modulation.
 *                __            _ _ _ _ _ _ _ _
 *             __|  |__
 *          __|        |__             depth
 * ________|  :           |__   _ _ _ _ _ _ _ _
 * :       :  :              |__  _ _ heighgt _
 * : delay :  :                 |__
 *         width
 * @param ch channel object to control
 */
TsdPlayer.prototype._performPitchModulation = function (ch) {
    var pm = ch.pitchModulation;
    if (pm.delayCount < pm.delay) {
        // Wait for counting up to delay parameter.
        pm.delayCount++;
        return;
    } else if (pm.delayCount == pm.delay) {
        // Initialize pitch modulation parameters.
        switch (ch.frequency.type) {
            case TsdPlayer._FREQUENCY_TYPE_NORMAL:
                pm.base = ch.frequency.hz;
                break;
            case TsdPlayer._FREQUENCY_TYPE_MSX:
                pm.base = ch.frequency.param;
                break;
            case TsdPlayer._FREQUENCY_TYPE_FM:
                pm.base = ch.frequency.param;
                break;
            case TsdPlayer._FREQUENCY_TYPE_GB_SQUARE:
                // TODO: not supported originally.
                break;
        }
        pm.currentDepth = pm.depth;
        pm.currentHeight = pm.height;
        pm.currentDiff = 0;
        pm.widthCount = 0;
        pm.deltaCount = 0;
        pm.delayCount++;
        return;
    } else {
        // Perform pitch modulation.
        if (++pm.widthCount != pm.width)
            return;
        pm.widthCount = 0;
        pm.currentDiff += pm.currentHeight;
        if ((pm.currentDiff >= pm.currentDepth) ||
                (pm.currentDiff <= -pm.currentDepth)) {
            // Change direction.
            pm.currentHeight = -pm.currentHeight;
            // Modulation depth control.
            // Old implementation was 'pm.currentDepth += pm.delta'
            // I'm not sure when this implementation was changed.
            // TODO: Check revision history.
            pm.deltaCount++;
            if (pm.deltaCount == pm.delta) {
                pm.deltaCount = 0;
                pm.currentDepth++;
            }
        }
        var frequency = ch.frequency.hz;
        var param;
        switch (ch.frequency.type) {
            case TsdPlayer._FREQUENCY_TYPE_NORMAL:
                frequency = pm.base + pm.currentDiff;
                break;
            case TsdPlayer._FREQUENCY_TYPE_MSX:
                param = pm.base + pm.currentDiff;
                if (param < 0)
                    param = 0;
                else if (param > 0x0fff)
                    param = 0x0fff;
                frequency = TsdPlayer._PARAMETER_FREQUENCY_TABLE[
                        TsdPlayer._FREQUENCY_TYPE_MSX][param];
                break;
            case TsdPlayer._FREQUENCY_TYPE_FM:
                param = pm.base + pm.currentDiff;
                if (param < 0)
                    param = 0;
                else if (param > 0x1fff)
                    param = 0x1fff;
                frequency = TsdPlayer._PARAMETER_FREQUENCY_TABLE[
                        TsdPlayer._FREQUENCY_TYPE_FM][param];
                break;
            case TsdPlayer._FREQUENCY_TYPE_GB_SQUARE:
                // TODO: not supported originally.
                break;
        }
        this.device.setModuleFrequency(ch.id, frequency);
    }
};

/**
 * Perform amplifier envelope.
 * @param ch channel object to control
 */
TsdPlayer.prototype._performAmpEnvelope = function (ch) {
    var ae = ch.ampEnvelope;
    if (++ae.count != ae.wait)
        return;
    ae.count = 0;

    var diff = this.table[ae.id][ae.state];
    ae.state++;
    if (ae.state == this.table[ae.id].length)
        ae.state--;

    var volumeL = ae.volume.l + diff;
    var volumeR = ae.volume.r + diff;
    if (0 != (ch.pan & TsdPlayer._PAN_L))
        volumeL = this._clamp(volumeL, 0, 255);
    else
        volumeL = 0;
    if (0 != (ch.pan & TsdPlayer._PAN_R))
        volumeR = this._clamp(volumeR, 0, 255);
    else
        volumeR = 0;

    this._setVolume(ch, TsdPlayer._CH_L, volumeL);
    this._setVolume(ch, TsdPlayer._CH_R, volumeR);
};

/**
 * Perform sequencer.
 */
TsdPlayer.prototype._performSequencer = function () {
    for (var i = 0; i < this.header.numOfChannel; i++) {
        var ch = this.channel[i];
        if (0 == ch.wait)
            continue;
        if (0 != --ch.wait)
            continue;
        for (;;) {
            var cmd = this.input[ch.baseOffset + ch.offset++];
            var dt;
            var dt2;
            if (cmd <= TsdPlayer.CMD_LAST_NOTE) {
                // Note on.
                this._noteOn(ch, cmd);
                ch.wait = this.input[ch.baseOffset + ch.offset++];
                if (0xff == ch.wait) {
                    ch.wait = this._readU16(ch.baseOffset + ch.offset);
                    ch.offset += 2;
                }
                if (0 != ch.wait)
                    break;
            } else if (cmd == TsdPlayer.CMD_NOTE_OFF) {
                // Note off.
                this._noteOff(ch);
                ch.wait = this.input[ch.baseOffset + ch.offset++];
                if (0xff == ch.wait) {
                    ch.wait = this._readU16(ch.baseOffset + ch.offset);
                    ch.offset += 2;
                }
                if (0 != ch.wait)
                    break;
            } else if (cmd == TsdPlayer.CMD_VOLUME_MONO) {
                // Set volume by monaural with the panpot setting.
                dt = this.input[ch.baseOffset + ch.offset++];
                ch.volume.c = dt;
                if (ch.pan & TsdPlayer._PAN_L)
                    ch.volume.l = dt;
                if (ch.pan & TsdPlayer._PAN_R)
                    ch.volume.r = dt;
            } else if (cmd == TsdPlayer.CMD_SUSTAIN_MODE) {
                // Set sustain setting.
                ch.sustain = this.input[ch.baseOffset + ch.offset++];
            } else if (cmd == TsdPlayer.CMD_DETUNE) {
                // Set detune setting.
                ch.detune = this._readI8(ch.baseOffset + ch.offset);
                ch.offset++;
                this.device.pitchBend(ch.id, ch.detune * 128);
            } else if (cmd == TsdPlayer.CMD_PORTAMENT) {
                // Set portament setting.
                ch.portament = this._readI8(ch.baseOffset + ch.offset);
                ch.offset++;
                // Pitch modulation is disabled when portament is set.
                ch.pitchModulation.enable = false;
            } else if (cmd == TsdPlayer.CMD_VOLUME_LEFT) {
                ch.offset++;
                Log.getLog().info('TSD: volume left');
                // TODO
            } else if (cmd == TsdPlayer.CMD_VOLUME_RIGHT) {
                ch.offset++;
                Log.getLog().info('TSD: volume right');
                // TODO
            } else if (cmd == TsdPlayer.CMD_PANPOT) {
                ch.pan = this.input[ch.baseOffset + ch.offset++];
                if (ch.pan != 0) {
                    var pan = (ch.pan == 1) ? 0 : (ch.pan == 2) ? 127 : 64;
                    this.device.panpot(ch.id, pan);
                }
            } else if (cmd == TsdPlayer.CMD_RELATIVE_VOLUME_UP) {
                ch.offset++;
                Log.getLog().info('TSD: volume up');
                // TODO
            } else if (cmd == TsdPlayer.CMD_RELATIVE_VOLUME_DOWN) {
                ch.offset++;
                Log.getLog().info('TSD: volume down');
                // TODO
            } else if (cmd == TsdPlayer.CMD_TEMPO) {
                // Set musical tempo.
                dt = this._readU16(ch.baseOffset + ch.offset);
                ch.offset += 2;
                this._setSequencerFineness(dt);
            } else if (cmd == TsdPlayer.CMD_FINENESS) {
                // Set automation speed.
                dt = this._readU16(ch.baseOffset + ch.offset);
                ch.offset += 2;
                this._setAutomationFineness(dt);
            } else if (cmd == TsdPlayer.CMD_KEY_ON_PHASE) {
                ch.offset++;
                Log.getLog().info('TSD: key on phase');
                // TODO
            } else if (cmd == TsdPlayer.CMD_MULTIPLE) {
                ch.offset++;
                Log.getLog().info('TSD: multiple');
                // TODO
            } else if (cmd == TsdPlayer.CMD_PITCH_MODULATION_DELAY) {
                dt = this._readU16(ch.baseOffset + ch.offset);
                ch.offset += 2;
                ch.pitchModulation.delay = dt;
                ch.pitchModulation.enable = 0 != dt;
                // Portament is disabled when pitch modulation is set.
                ch.portament = 0;
            } else if (cmd == TsdPlayer.CMD_PITCH_MODULATION_DEPTH) {
                dt = this.input[ch.baseOffset + ch.offset++];
                ch.pitchModulation.depth = dt;
            } else if (cmd == TsdPlayer.CMD_PITCH_MODULATION_WIDTH) {
                dt = this.input[ch.baseOffset + ch.offset++];
                ch.pitchModulation.width = dt;
            } else if (cmd == TsdPlayer.CMD_PITCH_MODULATION_HEIGHT) {
                dt = this._readI8(ch.baseOffset + ch.offset);
                ch.offset++;
                ch.pitchModulation.height = dt;
            } else if (cmd == TsdPlayer.CMD_PITCH_MODULATION_DELTA) {
                dt = this.input[ch.baseOffset + ch.offset++];
                ch.pitchModulation.delta = dt;
            } else if (cmd == TsdPlayer.CMD_AMP_EMVELOPE) {
                // Set amp emvelope
                dt = this.input[ch.baseOffset + ch.offset++];
                ch.ampEnvelope.id = dt;
                dt = this.input[ch.baseOffset + ch.offset++];
                ch.ampEnvelope.wait = dt;
                ch.ampEnvelope.enable = 0 != dt;
            } else if (cmd == TsdPlayer.CMD_ENDLESS_LOOP_POINT) {
                // Set endless loop point here.
                ch.loop.offset = ch.offset;
            } else if (cmd == TsdPlayer.CMD_LOCAL_LOOP_START) {
                // Set local loop start point here.
                dt = this.input[ch.baseOffset + ch.offset++];
                ch.localLoop[dt].count =
                    this.input[ch.baseOffset + ch.offset++];
                ch.localLoop[dt].offset = ch.offset;
            } else if (cmd == TsdPlayer.CMD_LOCAL_LOOP_BREAK) {
                // Quit local loop if current loop is the last one.
                dt = this.input[ch.baseOffset + ch.offset++];
                if (ch.localLoop[dt].count == 1)
                    ch.offset = ch.localLoop[dt].end;
            } else if (cmd == TsdPlayer.CMD_LOCAL_LOOP_END) {
                // Do local loop unless current loop is the last one.
                dt = this.input[ch.baseOffset + ch.offset++];
                ch.localLoop[dt].end = ch.offset;
                if (0 != --ch.localLoop[dt].count)
                    ch.offset = ch.localLoop[dt].offset;
            } else if (cmd == TsdPlayer.CMD_FREQUENCY_MODE_CHANGE) {
                // Set frequency mode.
                ch.frequency.type = this.input[ch.baseOffset + ch.offset++];
            } else if (cmd == TsdPlayer.CMD_VOLUME_MODE_CHANGE) {
                // Set volume mode.
                ch.volume.type = this.input[ch.baseOffset + ch.offset++];
            } else if (cmd == TsdPlayer.CMD_FM_IN) {
                // Set fm input pipe.
                dt = this.input[ch.baseOffset + ch.offset++];
                this._setFmInPipe(ch, dt >> 4, dt & 0x0f);
            } else if (cmd == TsdPlayer.CMD_FM_OUT) {
                // Set fm output pipe.
                dt = this.input[ch.baseOffset + ch.offset++];
                this._setFmOutPipe(ch, dt >> 4, dt & 0x0f);
            } else if (cmd == TsdPlayer.CMD_CONTROL_CHANGE) {
                Log.getLog().error('TSD: control change is not implemented.');
            } else if (cmd == TsdPlayer.CMD_PORT_CHANGE) {
                dt = this.input[ch.baseOffset + ch.offset++];
                dt2 = this.input[ch.baseOffset + ch.offset++];
                this._setPort(ch, dt, dt2);
            } else if (cmd == TsdPlayer.CMD_VOICE_CHANGE) {
                // Set voice number with fm mode.
                dt = this.input[ch.baseOffset + ch.offset++];
                this._setVoice(ch, dt)
            } else if (cmd == TsdPlayer.CMD_MODULE_CHANGE) {
                // Set module type with frequency mode.
                dt = this.input[ch.baseOffset + ch.offset++];
                this._setModule(ch, dt)
            } else if (cmd == TsdPlayer.CMD_END) {
                if (0 != ch.loop.offset) {
                    // Perform endless loop
                    ch.offset = ch.loop.offset;
                    ch.loop.count++;
                } else {
                    // Stop
                    this._noteOff(ch);
                    this.activeChannel--;
                    break;
                }
            } else {
                Log.getLog().error('TSD: unsupported cmd ' + cmd.toString(16));
                Log.getLog().info(this);
                break;
            }
        }
    }
};

/**
 * Perform note on.
 * @param ch channel object to control
 * @param note note number
 */
TsdPlayer.prototype._noteOn = function (ch, note) {
    // Set tone frequency.
    var type = ch.frequency.type;
    var param;
    var hz;
    switch (type) {
        case TsdPlayer._FREQUENCY_TYPE_NORMAL:
            param = ch.detune + TsdPlayer._NOTE_FREQUENCY_TABLE[type][note];
            hz = param;
            break;
        case TsdPlayer._FREQUENCY_TYPE_MSX:
            param = ch.detune + TsdPlayer._NOTE_PARAMETER_TABLE[type][note];
            hz = TsdPlayer._PARAMETER_FREQUENCY_TABLE[type][param];
            break;
        case TsdPlayer._FREQUENCY_TYPE_FM:
            param = ch.detune + note << 6;
            hz = TsdPlayer._PARAMETER_FREQUENCY_TABLE[type][param];
            break;
        case TsdPlayer._FREQUENCY_TYPE_GB_SQUARE:
            param = ch.detune + TsdPlayer._NOTE_FREQUENCY_TABLE[type][note];
            hz = param;
            break;
    }
    this.device.setModuleFrequency(ch.id, hz);
    ch.frequency.note = note;
    ch.frequency.param = param;
    ch.frequency.hz = hz;

    // Set volume
    this._setVolume(ch, TsdPlayer._CH_L, ch.volume.l);
    this._setVolume(ch, TsdPlayer._CH_R, ch.volume.r);
    this._setVolume(ch, TsdPlayer._CH_C, ch.volume.c);

    // Key on
    if (ch.keyOn)
        this.device.keyOff(ch.id);
    ch.keyOn = true;
    this.device.setModulePhase(ch.id, ch.phase);
    this.device.keyOn(ch.id, note);

    // Reset sustain, pitch modulation, and amplifier envelope parameters.
    ch.ampEnvelope.volume.l = ch.volume.l;
    ch.ampEnvelope.volume.r = ch.volume.r;
    ch.ampEnvelope.state = 0;
    ch.ampEnvelope.count = 0;
    ch.pitchModulation.delayCount = 0;
};

/**
 * Perform note off.
 * @param ch channel object to control
 */
TsdPlayer.prototype._noteOff = function (ch) {
    if (0 == ch.sustain) {
        // When sustain is disabled,
        if (!ch.ampEnvelope.enable) {
            // and amplifier envelope is also disabled.
            this.device.setModuleVolume(ch.id, TsdPlayer._CH_L, 0);
            this.device.setModuleVolume(ch.id, TsdPlayer._CH_R, 0);
        } else {
            // and amplifier envelope is enabled.
            ch.ampEnvelope.volume.l =
                    this.device.getModuleVolume(ch.id, TsdPlayer._CH_L);
            ch.ampEnvelope.volume.r =
                    this.device.getModuleVolume(ch.id, TsdPlayer._CH_R);
        }
    }
    ch.keyOn = false;
    this.device.keyOff(ch.id);
};

/**
 * Set channel base volume in current volume mode with panpot setting.
 * @param ch channel object to control
 * @param lrc L/R/C channel to set
 * @param volume volume to set
 */
TsdPlayer.prototype._setVolume = function (ch, lrc, volume) {
    var data = volume;
    if ((TsdPlayer._CH_L == lrc) && (0 == (ch.pan & TsdPlayer._PAN_L)))
        data = 0;
    else if ((TsdPlayer._CH_R == lrc) && (0 == (ch.pan & TsdPlayer._PAN_R)))
        data = 0;
    else if (TsdPlayer._VOLUME_TYPE_FM == ch.volume.type)
        data = TsdPlayer._FM_VOLUME_TABLE[data];
    this.device.setModuleVolume(ch.id, lrc, data);
};

/**
 * Set sequencer timer fineness.
 * @param fineness timer count
 */
TsdPlayer.prototype._setSequencerFineness = function (fineness) {
    this.device.setTimerCallback(
            TsdPlayer._TIMER_SEQUENCER, fineness, this,
            this._performSequencer);
};

/**
 * Set automation timer fineness.
 * @param fineness timer count
 */
TsdPlayer.prototype._setAutomationFineness = function (fineness) {
    this.device.setTimerCallback(
            TsdPlayer._TIMER_AUTOMATION, fineness, this,
            this._performAutomation);
};

/**
 * Set frequency modulation input pipe connection.
 * @see TssChannel.Module.setFmInPipe
 * @param ch channel object to control
 * @param rate input rate
 * @param pipe pipe id
 */
TsdPlayer.prototype._setFmInPipe = function (ch, rate, pipe) {
    var param = rate;
    if (0 != param)
        param = 9 - param;
    this.device.setModuleFmInPipe(ch.id, param, pipe);
};

/**
 * Set frequency modulation output pipe connection.
 * @see TssChannel.Module.setFmOutPipe
 * @param ch channel object to control
 * @param mode connection mode
 * @param pipe pipe id
 */
TsdPlayer.prototype._setFmOutPipe = function (ch, mode, pipe) {
    this.device.setModuleFmOutPipe(ch.id, mode, pipe);
};

/**
 * Set MIDI device ID and channel.
 * @param ch channel object to control
 * @param id MIDI device ID
 * @param mch MIDI channel
 */
TsdPlayer.prototype._setPort = function (ch, id, mch) {
    this.device.setModulePort(ch.id, id, mch);
};

/**
 * Set voice of module.
 * @param ch channel object to control
 * @param voice voice id
 */
TsdPlayer.prototype._setVoice = function (ch, voice) {
    this.device.setModuleVoice(ch.id, voice);
    if (TssChannel.Module.TYPE_SIN != this.device.getModuleType(ch.id))
        return;
    // Old style FM pipe setting for compatibility.
    var fmIn = voice >> 4;
    var fmOut = voice & 0x0f;
    if (0 != fmIn)
        this._setFmInPipe(ch, 5, (fmIn % 5) - 1);
    else
        this._setFmInPipe(ch, 0, 0);
    if (0 != fmOut)
        this._setFmOutPipe(ch, 1, (fmOut % 5) - 1);
    else
        this._setFmOutPipe(ch, 0, 0);
};

/**
 * Set module device type.
 * @param ch channel object to control
 * @param module module type with frequency mode
 */
TsdPlayer.prototype._setModule = function (ch, module) {
    this.device.setModuleType(ch.id, module & 0x0f);
    if (0 != (module & 0x80))
        ch.frequency.type = module >> 7;
    else
        ch.frequency.type = module >> 4;
};
/**
 * T'SoundSystem for JavaScript
 */

/**
 * TssCompiler prototype
 *
 * This prototype implements TSS compiler which compile TSS source file and
 * generate TSD data file. TsdPlayer prototype can play the TSD data file.
 * @author Takashi Toyoshima <toyoshim@gmail.com>
 *
 * @constructor
 */
var TssCompiler = function () {
    this.logMmlCompile = false;
    this.source = null;
    this.directives = [];
    this.channels = [];
    this.validWaves = 0;
    this.waves = [];
    this.validTables = 0;
    this.tables = [];
    this.tags = {
        title: null,
        channels: 0,
        fineness: TssCompiler._DEFAULT_FINENESS
    };
    this.modes = {
        hardware: TssCompiler.HARDWARE_MODE_NORMAL,
        octave: TssCompiler.OCTAVE_MODE_NORMAL,
        volumeRelative: TssCompiler.VOLUME_RELATIVE_MODE_NORMAL
    };
    this.channelData = [];
}

TssCompiler.VERSION = 0.94;
TssCompiler.HARDWARE_MODE_NORMAL = 0;
TssCompiler.HARDWARE_MODE_FAMICOM = 1;
TssCompiler.HARDWARE_MODE_GAMEBOY = 2;
TssCompiler.VOLUME_RANGE_MODE_NORMAL = 0;
TssCompiler.VOLUME_RANGE_MODE_UPPER = 1;
TssCompiler.VOLUME_RELATIVE_MODE_NORMAL = 0;
TssCompiler.VOLUME_RELATIVE_MODE_REVERSE = 1;
TssCompiler.OCTAVE_MODE_NORMAL = 0;
TssCompiler.OCTAVE_MODE_REVERSE = 1;
TssCompiler._DEFAULT_FINENESS = 368;
TssCompiler._ALPHABET_COUNT = 'z'.charCodeAt(0) - 'a'.charCodeAt(0) + 1;
TssCompiler._CODE_ESCAPE = '\\'.charCodeAt(0);
TssCompiler._CODE_SHARP = '#'.charCodeAt(0);
TssCompiler._CODE_GT = '>'.charCodeAt(0);
TssCompiler._TONE_TABLE = {
    'c': 0,
    'd': 2,
    'e': 4,
    'f': 5,
    'g': 7,
    'a': 9,
    'b': 11
};
TssCompiler._TRIANGLE_TABLE = [
       0,   16,   32,   48,   64,   80,   96,  112,
     127,  112 ,  96,   80,   64,   48,   32,   16,
       0,  -16,  -32,  -48,  -64,  -80,  -96, -112,
    -128, -112,  -96,  -80,  -64,  -48,  -32,  -16
];

/**
 * CompileError prototype
 *
 * This prototype contains compile error information.
 * @constructor
 * @param line line object
 *      line: line number
 *      data: source of TString
 * @param offset offset in line
 * @param message error message
 */
TssCompiler.CompileError = function (line, offset, message) {
    this.line = line;
    this.offset = offset;
    this.message = message;
};

/**
 * Create string object shows error information.
 */
TssCompiler.CompileError.prototype.toString = function () {
    var n = 0;
    var c;
    var i;
    var data = this.line.data;
    for (i = 0; i <= this.offset; i++) {
        c = data.at(i);
        if ((0 == c) || (TssCompiler._CODE_ESCAPE == c))
            continue;
        n++;
    }
    var hintArray = new Uint8Array(n--);
    for (i = 0; i < n; i++)
        hintArray[i] = 0x20;
    hintArray[i] = '^'.charCodeAt(0);
    var hint = TString.createFromUint8Array(hintArray).toString();
    return "TSS: { line: " + this.line.line + ", offset: " + this.offset +
            " } " + this.message + '\n' + data.toString() + '\n' + hint;
};

/**
 * Convert signed number to unsigned 8-bit integer.
 * @param n signed number
 * @return unsigned 8-bit integer
 */
TssCompiler._toUint8 = function (n) {
    if ((n < -128) || (127 < n))
        throw new RangeError("unsupported range");
    if (n < 0)
        n = 0x100 + n;
    return n & 0xff;
};

/**
 * Get a parameter encslosed by a brace like <foo bar>.
 * @param line source data of line object
 * @param offset start offset
 * @return result object
 *      begin: start offset
 *      end: end offset
 *      parameter: parameter of TString oject if success
 */
TssCompiler._getBracedParameter = function (line, offset) {
    var data = line.data;
    var length = data.byteLength();
    var begin = offset + data.countSpaces(offset);
    if ((begin >= length) || ('<' != data.charAt(begin)))
        return { begin: begin, end: begin, parameter: undefined };
    begin++;
    var n = 0;
    var c = 0;
    for (var i = begin; i < length; i++) {
        c = data.at(i);
        if ((0 == c) || (TssCompiler._CODE_ESCAPE == c))
            continue;
        if (TssCompiler._CODE_GT == c)
            break;
        n++;
    }
    var end = begin + n - 1;
    var param = TString.createFromUint8Array(new Uint8Array(n));
    n = 0;
    for (i = begin; i <= end; i++) {
        c = data.at(i);
        if ((0 == c) || (TssCompiler._CODE_ESCAPE == c))
            continue;
        param.setAt(n++, c);
    }
    return {
        begin: begin - 1,
        end: end + 1,
        parameter: param
    }
};

/**
 * Get a number parameter.
 * @param line source data of line object
 * @param offset start offset
 * @throws TssCompiler.CompileError
 * @return result object
 *      begin: start offset
 *      end: end offset
 *      parameter: parameter of number
 */
TssCompiler._getNumberParameter = function (line, offset) {
    var data = line.data;
    var begin = offset + data.countSpaces(offset);
    var length = data.byteLength();
    if (begin >= length)
        return { begin: begin, end: begin, parameter: undefined };
    var sign = 1;
    if ('-' == data.charAt(begin)) {
        begin++;
        begin += data.countSpaces(begin);
        sign = -1;
    }
    var n = data.numberAt(begin);
    if (n < 0)
        return { begin: begin, end: begin, parameter: undefined };
    var c = 0;
    for (var i = begin + 1; i < length; i++) {
        c = data.at(i);
        if ((0 == c) || (TssCompiler._CODE_ESCAPE == c))
            continue;
        var result = data.numberAt(i);
        if (result < 0)
            return { begin: begin, end: i - 1, parameter: sign * n };
        n = n * 10 + result;
    }
    return { begin: begin, end: i - 1, parameter: sign * n};
};

/**
 * Get a string parameter.
 * @param line source data of line object
 * @param offset start offset
 * @return result object
 *      begin: start offset
 *      end: end offset
 *      parameter: parameter of TString oject if success
 */
TssCompiler._getStringParameter = function (line, offset) {
    var data = line.data;
    var begin = offset + data.countSpaces(offset);
    var length = data.byteLength();
    var n = 0;
    var c = 0;
    for (var i = begin; i < length; i++) {
        c = data.at(i);
        if ((0 == c) || (TssCompiler._CODE_ESCAPE == c))
            continue;
        n++;
    }
    var end = begin + n - 1;
    var param = TString.createFromUint8Array(new Uint8Array(n));
    n = 0;
    for (i = begin; i <= end; i++) {
        c = data.at(i);
        if ((0 == c) || (TssCompiler._CODE_ESCAPE == c))
            continue;
        param.setAt(n++, c);
    }
    return {
        begin: begin,
        end: end,
        parameter: param
    }
};

/**
 * Get a table parameter.
 * @param lines source data array of line object
 * @param offset start offset
 * @return result object
 *      begin: start offset
 *      end: end offset
 *      parameter: parameter
 *          id: table id
 *          table: table array
 */
TssCompiler._getTableParameter = function (_lines, _offset) {
    var work = {
        lines: _lines,
        line: 0,
        offset: _offset
    };
    var table = [];
    var begin = work.offset;
    var directive = work.lines[0].directive;

    // Get ID.
    var n = TssCompiler._getNumberParameter(
            work.lines[work.line], work.offset);
    if (typeof n.parameter == "undefined")
        throw new TssCompiler.CompileError(work.lines[work.line], n.begin,
                "id number not found in #" + directive);
    var id = n.parameter;
    if ((id < 0) || (255 < id))
        throw new TssCompiler.CompileError(work.lines[work.line], n.begin,
                "id " + id + " is out or range 0 to 255 in #" + directive);
    work.offset = n.end + 1;

    // Check comma after ID.
    TssCompiler._checkCharacter(work, ',',
            "',' not found after id number in #" + directive);

    // Check '<'.
    TssCompiler._checkCharacter(work, '<',
            "'<' not found in #" + directive);

    for (;;) {
        var ch = TssCompiler._findNextCharacter(work,
                "incomplete entry in #" + directive);
        if ('(' == ch) {
            // (x,y),n expansion.
            work.offset++;
            var firstNumberNotFound = "number not found after '(' in #" +
                    directive;
            TssCompiler._findNextCharacter(work, firstNumberNotFound);
            n = TssCompiler._getNumberParameter(work.lines[work.line],
                    work.offset);
            if (typeof n.parameter == "undefined")
                throw new TssCompiler.CompileError(work.lines[work.line],
                        n.begin, firstNumberNotFound);
            var x = n.parameter;
            var numberOutOfRange = "number is out of range -128 to 127 in #" +
                    directive;
            if ((x < -128) || (127 < x))
                throw new TssCompiler.CompileError(work.lines[work.line],
                        n.begin, numberOutOfRange);
            work.offset = n.end + 1;

            TssCompiler._checkCharacter(work, ',',
                    "',' not found after the first number after '(' in #" +
                    directive);

            var secondNumberNotFound = "the second number not found after " +
                    "'(' in #" + directive;
            TssCompiler._findNextCharacter(work, secondNumberNotFound);
            n = TssCompiler._getNumberParameter(work.lines[work.line],
                work.offset);
            if (typeof n.parameter == "undefined")
                throw new TssCompiler.CompileError(work.lines[work.line],
                    n.begin, secondNumberNotFound);
            var y = n.parameter;
            if ((y < -128) || (127 < y))
                throw new TssCompiler.CompileError(work.lines[work.line],
                    n.begin, numberOutOfRange);
            work.offset = n.end + 1;

            TssCompiler._checkCharacter(work, ')',
                    "')' not found after the second number in #" + directive);

            TssCompiler._checkCharacter(work, ',',
                    "',' not found after '(x,y)' syntax in #" + directive);

            var lastNumberNotFound = "number not found after '(x,y),' " +
                    "syntax in #" + directive;
            TssCompiler._findNextCharacter(work, lastNumberNotFound);
            n = TssCompiler._getNumberParameter(work.lines[work.line],
                    work.offset);
            if (typeof n.parameter == "undefined")
                throw new TssCompiler.CompileError(work.lines[work.line],
                    n.begin, lastNumberNotFound);
            var count = n.parameter;
            work.offset = n.end + 1;

            var expand = [];
            for (var i = 0; i < count; i++) {
                var element = ~~(x + (y - x) * i / (count - 1));
                expand.push(element);
                table.push(element);
            }

            Log.getLog().info("TSS: expanding (" + x + "," + y + ")," + count +
                    " to " + expand);
        } else {
            // Single element.
            var numberNotFound = "number not found in #" + directive;
            TssCompiler._findNextCharacter(work, numberNotFound);
            n = TssCompiler._getNumberParameter(work.lines[work.line],
                    work.offset);
            if (typeof n.parameter == "undefined")
                throw new TssCompiler.CompileError(work.lines[work.line],
                        n.begin, numberNotFound);
            if ((n.parameter < -128) || (127 < n.parameter))
                throw new TssCompiler.CompileError(work.lines[work.line],
                    n.begin, numberOutOfRange);
            work.offset = n.end + 1;
            table.push(n.parameter);
        }
        var delimiterNotFound = "',' or '>' not found in #" + directive;
        ch = TssCompiler._findNextCharacter(work, delimiterNotFound);
        if (',' == ch) {
            work.offset++;
        } else if ('>' == ch) {
            work.offset++;
            break;
        } else {
            throw new TssCompiler.CompileError(work.lines[work.line],
                    work.offset, delimiterNotFound);
        }
    }
    try {
        TssCompiler._findNextCharacter(work, "");
    } catch (e) {
        Log.getLog().info("TSS: table complete " + table);
        return {
            begin: begin,
            end: work.offset,
            parameter: {
                id: id,
                table: table
            }
        };
    }
    throw new TssCompiler.CompileError(work.lines[work.line],
            work.offset, "unknown data after table in #" + directive);
};

/**
 * Get a character.
 * @param line source data of line object
 * @param offset offset start offset
 * @param character charactet string to find
 * @return -1 if the next non-space character is not comma, otherwise offset
 */
TssCompiler._getCharacter = function (line, offset, character) {
    var data = line.data;
    var position = offset + data.countSpaces(offset);
    if (position >= data.byteLength())
        return -1;
    if (character != data.charAt(position))
        return -1;
    return position;
};

/**
 * Find the next character in plural lines.
 * @param work object which will be updated after the function call
 *      lines an array of line objects
 *      line line number of the array
 *      offset offset in the line
 * @param message error message
 * @return the next character
 * @throws TssCompiler.CompileError if search reach to the end of lines
 */
TssCompiler._findNextCharacter = function (work, message) {
    var length = work.lines.length;
    if (TssCompiler._checkEnd(work.lines[work.line], work.offset) &&
        ((work.line + 1) < length)) {
        work.line++;
        work.offset = 0;
    }
    work.offset += work.lines[work.line].data.countSpaces(work.offset);
    if (work.offset == work.lines[work.line].data.byteLength())
        throw new TssCompiler.CompileError(work.lines[work.line], work.offset,
                message);
    return work.lines[work.line].data.charAt(work.offset);
};

/**
 * Check if the specified character is found.
 * @param work object which will be updated after the function call
 *      lines an array of line objects
 *      line line number of the array
 *      offset offset in the line
 * @param ch character to check
 * @param message error message
 * @throws TssCompiler.CompileError if the specified character is not found
 */
TssCompiler._checkCharacter = function (work, ch, message) {
    TssCompiler._findNextCharacter(work, message);
    var result = TssCompiler._getCharacter(work.lines[work.line], work.offset,
            ch);
    if (result < 0)
        throw new TssCompiler.CompileError(work.lines[work.line], work.offset,
                message);
    work.offset = result + 1;
}

/**
 * Check if the rest part of specified line has no data.
 * @param line line object to be checked
 * @param offset start offset
 */
TssCompiler._checkEnd = function (line, offset) {
    var data = line.data;
    offset += data.countSpaces(offset);
    return offset == data.byteLength();
};

/**
 * Check line.directive is channel directive (e.g. "#A", "#zx") then rewrite
 * line.directive with channel number.
 * @param line line object to check
 */
TssCompiler._checkChannelDirective = function (line) {
    if ((2 < line.directive.length) || (0 == line.directive.length))
        return;
    var n = TString.createFromString(line.directive);
    var channel = 0;
    var offset = 0;
    var index;
    if (2 == n.byteLength()) {
        index = n.alphabetIndex(offset++);
        if (index < 0)
            return;
        channel = index * TssCompiler._ALPHABET_COUNT;
    }
    index = n.alphabetIndex(offset);
    if (index < 0)
        return;
    channel += index;
    line.directive = channel;
};

/**
 * Check line object, parse directive in line.buffer to set line.directive,
 * and retrieve the directive (e.g. "#TITLE") from buffer.
 * @param line line object
 */
TssCompiler._checkDirective = function (line) {
    var data = line.data;
    var length = data.byteLength();
    var c = 0;
    for (var i = 0; i < length; i++) {
        c = data.at(i);
        if (0 == c)
            continue;
        if (TssCompiler._CODE_SHARP == c) {
            data.setAt(i++, 0);
            break;
        }
        line.directive = null;
        return;
    }
    for (var start = i; i < length; i++)
        if (0x20 == data.at(i))
            break;
    // TODO: Currently primitives doesn't allow comments inside.
    // e.g. "#TI{ comments }TLE" doesn't work.
    line.directive = data.slice(start, i).toString();
    for (var offset = start; offset < i; offset++)
        data.setAt(offset, 0);
    TssCompiler._checkChannelDirective(line);
};

/**
 * Set wave table data.
 * @param id id
 * @param wave wave table
 */
TssCompiler.prototype._setWave = function (id, wave) {
    Log.getLog().info("TSC: set wave " + id);
    if (!this.waves[id])
        this.validWaves++;
    this.waves[id] = wave;
};

/**
 * Set enverope table data.
 * @param id id
 * @param table enverope table
 */
TssCompiler.prototype._setTable = function (id, table) {
    Log.getLog().info("TSC: set table " + id + "; size = " + table.length);
    if (!this.tables[id])
        this.validTables++;
    this.tables[id] = table;
};

/**
 * Parse a line with count information, generate line object.
 * @param context parser context containing line and comment information
 * @param offset line start offset
 * @param count line size in bytes
 * @return line object
 *      line: original source line
 *      offset: original source line start offset
 *      count: original source line size in bytes
 *      data: comment stripped TString object
 *      empty: true if this line contains no data, otherwise false
 *      directive: directive (e.g. "TITLE" in string, or "9" in number)
 *      error: error object if parse fails, otherwise null
 *          offset: offset where parse fails
 *          message: reason
 */
TssCompiler.prototype._preprocessLine = function (context, offset, count) {
    var result = {
        line: context.line,
        offset: offset,
        count: count,
        data: null,
        empty: true,
        directive: null,
        continuation: false
    };
    var line = this.source.slice(offset, offset + count);
    result.data = line;
    for (var i = 0; i < count; i++) {
        var c = line.charAt(i);
        if (context.commentNest > 0) {
            // In comment.
            if ('\\' == c)
                line.setAt(i++, 0);
            else if ('{' == c)
                context.commentNest++;
            else if ('}' == c)
                context.commentNest--;
            line.setAt(i, 0);
        } else {
            if ('\\' == c) {
                line.setAt(i++, 0);
                result.empty = false;
            } else if ('{' == c) {
                context.commentNest++;
                line.setAt(i, 0);
            } else if ('}' == c) {
                context.commentNest--;
                line.setAt(i, 0);
                if (context.commentNest < 0)
                    throw new TssCompiler.CompileError(result, i,
                            "'}' appears without '{'");
            } else {
                if ('\t' == c)
                    line.setAt(i, 0x20);
                result.empty = false;
            }
        }
    }
    if (!result.empty)
        TssCompiler._checkDirective(result);
    return result;
};

/**
 * Parse TSS source lines and classify into directive or channels.
 * @throws TssCompiler.CompileError
 */
TssCompiler.prototype._parseLines = function () {
    var context = {
        line: 1,
        commentNest: 0
    };
    var channel = null;
    var length = this.source.byteLength();
    for (var offset = 0; offset < length; context.line++) {
        var count = this.source.countLine(offset);
        var line = this._preprocessLine(context, offset, count);
        if (!line.empty) {
            if (null == line.directive) {
                if (null == channel)
                    throw new TssCompiler.CompileError(line, 0,
                            "invalid line without any directive");
                line.directive = channel;
                line.continuation = true;
            } else {
                channel = line.directive;
            }
            if (typeof line.directive == "number") {
                if (undefined == this.channels[line.directive])
                    this.channels[line.directive] = [];
                this.channels[line.directive].push(line);
            } else {
                if ("END" == line.directive)
                    break;
                this.directives.push(line);
            }
        }
        offset += count;
        offset += this.source.countLineDelimiter(offset);
    }
    Log.getLog().info("TSS: found " + this.directives.length +
            " directive(s)");
    Log.getLog().info("TSS: found " + this.channels.length + " channel(s)");
    for (var i = 0; i < this.channels.length; i++) {
        var n = 0;
        if (undefined != this.channels[i])
            n = this.channels[i].length;
        Log.getLog().info("TSS: channel " + (i + 1) + " has " + n +
                " line(s)");
    }
};

/**
 * Parse directives.
 * @throws TssCompiler.CompileError
 */
TssCompiler.prototype._parseDirectives = function () {
    // TODO: Check mandatory directives.
    for (var i = 0; i < this.directives.length; i++) {
        var directive = this.directives[i].directive;
        var offset = 0;
        var result;
        if ("CHANNEL" == directive) {
            result = TssCompiler._getNumberParameter(this.directives[i], 0);
            if (typeof result.parameter == "undefined")
                throw new TssCompiler.CompileError(this.directives[i],
                        result.begin, "number not found in #CHANNEL");
            this.tags.channels = result.parameter;
            offset = result.end + 1;
            Log.getLog().info("TSS: CHANNEL> " + this.tags.channels);
        } else if ("FINENESS" == directive) {
            result = TssCompiler._getNumberParameter(this.directives[i], 0);
            if (typeof result.parameter == "undefined")
                throw new TssCompiler.CompileError(this.directives[i],
                    result.begin, "number not found in #FINENESS");
            this.tags.fineness = result.parameter;
            offset = result.end + 1;
            Log.getLog().info("TSS: FINENESS> " + this.tags.fineness);
        } else if ("OCTAVE" == directive) {
            result = TssCompiler._getStringParameter(this.directives[i], 0);
            if (!result.parameter)
                throw new TssCompiler.CompileError(this.directives[i],
                        result.begin, "syntax error in #PRAGMA");
            var octave = result.parameter.toString();
            if (octave == "NORMAL")
                this.modes.octave = TssCompiler.OCTAVE_MODE_NORMAL;
            else if (octave == "REVERSE")
                this.modes.octave = TssCompiler.OCTAVE_MODE_REVERSE;
            else
                throw new TssCompiler.CompileError(this.directive[i],
                        result.begin, "invalid argument in #OCTAVE");
            offset = result.end + 1;
        } else if ("PRAGMA" == directive) {
            result = TssCompiler._getStringParameter(this.directives[i], 0);
            if (!result.parameter)
                throw new TssCompiler.CompileError(this.directives[i],
                        result.begin, "syntax error in #PRAGMA");
            var pragma = result.parameter.toString();
            if (pragma == "FAMICOM") {
                this.modes.hardware = TssCompiler.HARDWARE_MODE_FAMICOM;
                this._setWave(0, TssCompiler._TRIANGLE_TABLE);
            } else if (pragma == "GAMEBOY") {
                this.modes.hardware = TssCompiler.HARDWARE_MODE_GAMEBOY;
            } else {
                throw new TssCompiler.CompileError(this.directives[i],
                        result.begin, "unknown pragma parameter " + pragma);
            }
            offset = result.end + 1;
            Log.getLog().info("TSS: PRAGMA> " + pragma);
        } else if ("TABLE" == directive) {
            var lines = [];
            for (;; i++) {
                lines.push(this.directives[i]);
                if ((i + 1) == this.directives.length)
                    break;
                if (!this.directives[i + 1].continuation)
                    break;
            }
            result = TssCompiler._getTableParameter(lines, 0);
            this._setTable(result.parameter.id, result.parameter.table);
            offset = result.end;
        } else if ("TITLE" == directive) {
            result = TssCompiler._getBracedParameter(this.directives[i], 0);
            if (!result.parameter)
                throw new TssCompiler.CompileError(this.directives[i],
                        result.begin, "syntax error in #TITLE");
            this.tags.title = result.parameter;
            offset = result.end + 1;
            Log.getLog().info("TSS: TITLE> " + this.tags.title.toString());
        } else if ("VOLUME" == directive) {
            result = TssCompiler._getStringParameter(this.directives[i], 0);
            if (!result.parameter)
                throw new TssCompiler.CompileError(this.directives[i],
                    result.begin, "syntax error in #VOLUME");
            var volume = result.parameter.toString();
            if (volume == "NORMAL")
                this.modes.volumeRelative = TssCompiler.VOLUME_RELATIVE_MODE_NORMAL;
            else if (volume == "REVERSE")
                this.modes.volumeRelative =
                        TssCompiler.VOLUME_RELATIVE_MODE_REVERSE;
            else
                throw new TssCompiler.CompileError(this.directive[i],
                        result.begin, "invalid argument in #VOLUME");
            offset = result.end + 1;
        } else if ("WAV" == directive) {
            var lines = [];
            for (;; i++) {
                lines.push(this.directives[i]);
                if ((i + 1) == this.directives.length)
                    break;
                if (!this.directives[i + 1].continuation)
                    break;
            }
            result = TssCompiler._getTableParameter(lines, 0);
            if (32 != result.parameter.table.length)
                throw new TssCompiler.CompileError(this.directive[i],
                        result.begin, "invalid wave table size " +
                        result.parameter.table.length);
            this._setWave(result.parameter.id, result.parameter.table);
            offset = result.end;
        } else {
            throw new TssCompiler.CompileError(this.directives[i], 0,
                    "unknown directive: " + directive);
        }
        if (!TssCompiler._checkEnd(this.directives[i], offset))
            throw new TssCompiler.CompileError(this.directives[i], offset,
                    "syntax error after #" + directive);
    }
};

/**
 * Parse channel data.
 */
TssCompiler.prototype._parseChannels = function () {
    var maxGate = 16;  // TODO: #GATE
    // Syntax information except for note premitives (cdefgabr).
    var notImplemented = function (self, work, command, args) {
        throw new TssCompiler.CompileError(work.lineObject, work.offset,
                "command '" + command + "' not implemented");
    };
    var processRelativeVolume = function (self, work, command, args) {
        var max = 255;
        if (work.mode == TssCompiler.HARDWARE_MODE_GAMEBOY)
            max = 16;
        var upcommand = '(';
        if (work.volumeRelativeMode != TssCompiler.VOLUME_RELATIVE_MODE_NORMAL)
            upcommand = ')';
        var stereo = work.currentVolume.r >= 0;
        if (command == upcommand) {
            work.currentVolume.l += (1 << work.volumeShift);
            if (stereo)
              work.currentVolume.r += (1 << work.volumeShift);
        } else {
            work.currentVolume.l -= (1 << work.volumeShift);
            if (stereo)
              work.currentVolume.r -= (1 << work.volumeShift);
        }
        if (work.currentVolume.l < 0 || work.currentVolume.l > max ||
                (stereo && work.currentVolume.r < 0) ||
                (stereo && work.currentVolume.r > max))
            throw new TssCompiler.CompileError(work.lineObject, work.offset,
                    "commmand '" + command + "' causes volume range error");
        if (stereo) {
          work.data.push(TsdPlayer.CMD_VOLUME_LEFT);
          work.data.push(work.currentVolume.l);
          work.data.push(TsdPlayer.CMD_VOLUME_RIGHT);
          work.data.push(work.currentVolume.r);
        } else {
          work.data.push(TsdPlayer.CMD_VOLUME_MONO);
          work.data.push(work.currentVolume.l);
        }
    };
    // TODO: Check again if each argument is mandatory.
    var syntax = {
        '$': {  // loop
            args: [],
            callback: function (self, work, command, args) {
                work.data.push(TsdPlayer.CMD_ENDLESS_LOOP_POINT);
            }
        },
        '%': {  // module
            args: [ { def: 0, min: 0, max: 255 } ],
            callback: function (self, work, command, args) {
                if (TssCompiler.HARDWARE_MODE_FAMICOM == work.mode ||
                        TssCompiler.HARDWARE_MODE_GAMEBOY == work.mode)
                    throw new TssCompiler.CompileError(work.lineObject,
                            work.offset,
                            "'%' is not supported in NES/GameBoy mode");
                work.data.push(TsdPlayer.CMD_MODULE_CHANGE);
                work.data.push(args[0]);
            }
        },
        '(': {  // volume relative up (down)
            args: [],
            callback: processRelativeVolume
        },
        ')': {  // volume relative down (up)
            args: [],
            callback: processRelativeVolume
        },
        '/': {  // local loop break
            sequence: ":",
            args: [],
            callback: function (self, work, command, args) {
                if (work.localLoopId == 0)
                    throw new TssCompiler.CompileError(work.lineObject,
                        work.offset, "'/' found without '/:'");
                work.data.push(TsdPlayer.CMD_LOCAL_LOOP_BREAK);
                work.data.push(work.localLoopId - 1);
            }
        },
        '/:': {  // local loop begin
            args: [ { def: 2, min: 2, max: 255 } ],
            callback: function (self, work, command, args) {
                if (work.localLoopId > 15)
                    throw new TssCompiler.CompileError(work.lineObject,
                            work.offset, "local loop is too deep (>16)");
                work.data.push(TsdPlayer.CMD_LOCAL_LOOP_START);
                work.data.push(work.localLoopId++);
                work.data.push(args[0]);
            }
        },
        ':': {  // n/a
            sequence: "/"
        },
        ':/': {  // local loop end
            args: [],
            callback: function (self, work, command, args) {
                if (work.localLoopId == 0)
                    throw new TssCompiler.CompileError(work.lineObject,
                        work.offset, "':/' found without '/:'");
                work.data.push(TsdPlayer.CMD_LOCAL_LOOP_END);
                work.data.push(--work.localLoopId);
            }
        },
        '<': {  // octave up (down)
            args: [],
            callback: function (self, work, command, args) {
                if (TssCompiler.OCTAVE_MODE_NORMAL == work.octaveMode)
                    work.currentOctave++;
                else
                    work.currentOctave--;
            }
        },
        '>': {  // octave down (up)
            args: [],
            callback: function (self, work, command, args) {
                if (TssCompiler.OCTAVE_MODE_NORMAL == work.octaveMode)
                    work.currentOctave--;
                else
                    work.currentOctave++;
            }
        },
        '@': {  // voice
            sequence: "ciopv",
            args: [ { def: 0, min: 0, max: 255 } ],
            callback: function (self, work, command, args) {
                if (TssCompiler.HARDWARE_MODE_FAMICOM == work.mode) {
                    if (work.lineObject.directive == 2)
                        throw new TssCompiler.CompileError(work.lineObject,
                                work.offset,
                                "'@' is not supported in famicom mode " +
                                        "channel 3");
                    else if ((2 != args[0]) && (4 != args[0]) &&
                            (6 != args[0]) && (7 != args[0]))
                        throw new TssCompiler.CompileError(work.lineObject,
                                work.offset,
                                "voice id " + args[0] +
                                        " is invalid in famicom mode");
                }
                work.data.push(TsdPlayer.CMD_VOICE_CHANGE);
                work.data.push(args[0]);
            }
        },
        '@c': {  // control change
            args: [
                { def: 0, min: 0, max: 127 },
                { def: 0, min: 0, max: 127 }
            ],
            callback: function (self, work, command, args) {
                work.data.push(TsdPlayer.CMD_CONTROL_CHANGE);
                work.data.push(args[0]);
                work.data.push(args[1]);
            }
        },
        '@i': {  // input pipe
            args: [
                { def: 0, min: 0, max: 8 },
                { def: 0, min: 0, max: 3 }
            ],
            callback: function (self, work, command, args) {
                work.data.push(TsdPlayer.CMD_FM_IN);
                work.data.push((args[0] << 4) | args[1]);
            }
        },
        '@o': {  // output pipe
            args: [
                { def: 0, min: 0, max: 2 },
                { def: 0, min: 0, max: 3 }
            ],
            callback: function (self, work, command, args) {
                work.data.push(TsdPlayer.CMD_FM_OUT);
                work.data.push((args[0] << 4) | args[1]);
            }
        },
        '@p': {  // id and channel change
            args: [
                { def: 0, min: 0, max: 3 },
                { def: 0, min: 0, max: 127 }
            ],
            callback: function (self, work, command, args) {
                work.data.push(TsdPlayer.CMD_PORT_CHANGE);
                work.data.push(args[0]);
                work.data.push(args[1]);
            }
        },
        '@v': {  // fine volume
            args: [
                { def: 10, min: 0, max: 255 },
                { def: 0, min: 0, max: 255 }
            ],
            callback: function (self, work, command, args) {
                work.volumeShift = 0;
                if (1 == args.length) {
                    work.currentVolume.l = args[0];
                    work.currentVolume.r = -1;
                    work.data.push(TsdPlayer.CMD_VOLUME_MONO);
                    work.data.push(args[0]);
                } else {
                    work.currentVolume.l = args[0];
                    work.currentVolume.r = args[1];
                    work.data.push(TsdPlayer.CMD_VOLUME_LEFT);
                    work.data.push(args[0]);
                    work.data.push(TsdPlayer.CMD_VOLUME_RIGHT);
                    work.data.push(args[1]);
                }
            }
        },
        ']': {  // loop end
            args: [],
            callback: function (self, work, command, args) {
                if (0 == work.loop.count)
                    throw new TssCompiler.CompileError(work.lineObject,
                            work.offset, "']' found without '['");
                if (--work.loop.count == 0)
                    return;
                work.loop.end.line = work.line;
                work.loop.end.offset = work.offset;
                work.line = work.loop.line;
                work.offset = work.loop.offset;
                work.lineObject =
                        self.channels[work.lineObject.directive][work.line];
            }
        },
        '[': {  // loop start
            args: [ { def: 2, min: 2, max: 65535 } ],
            callback: function (self, work, command, args) {
                work.loop.count = args[0];
                work.loop.line = work.line;
                work.loop.offset = work.offset;
            }
        },
        '_': {  // relative volume up
            args: [],  // TODO
            callback: notImplemented
        },
        '|': {  // loop break
            args: [],
            callback: function (self, work, command, args) {
                if (work.loop.count > 1)
                    return;
                work.line = work.loop.end.line;
                work.offset = work.loop.end.offset;
                work.lineObject =
                        self.channels[work.lineObject.directive][work.line];
            }
        },
        '~': {  // relative volume down
            args: [],  // TODO
            callback: notImplemented
        },
        'k': {  // detune
            args: [ { def: 0, min: -128, max: 127 } ],
            callback: function (self, work, command, args) {
                work.data.push(TsdPlayer.CMD_DETUNE);
                work.data.push(TssCompiler._toUint8(args[0]));
            }
        },
        'l': {  // default note length
            args: [ { def: 4, min: 1, max: 1024 } ],
            callback: function (self, work, command, args) {
                work.defaultLength = args[0];
                work.defaultDot = 0;
                for (;;) {
                    var position = TssCompiler._getCharacter(
                        work.lineObject, work.offset, '.');
                    if (position < 0)
                        break;
                    work.offset = position + 1;
                    work.defaultDot++;
                }
            }
        },
        'm': {  // multiple
            sequence: "p",
            args: [],  // TODO
            callback: notImplemented
        },
        'mp': {  // pitch modulation
            args: [
                { def: undefined, min: 0, max: 65535 },  // delay
                { def: undefined, min: 0, max: 255 },  // depth
                { def: undefined, min: 0, max: 255 },  // width
                { def: undefined, min: -128, max: 127 },  // height
                { def: undefined, min: 0, max: 255 }  // delta
            ],
            callback: function (self, work, command, args) {
                if (typeof args[0] != "undefined") {
                    work.data.push(TsdPlayer.CMD_PITCH_MODULATION_DELAY);
                    work.data.push(args[0] >> 8);
                    work.data.push(args[0]& 0xff);
                }
                if (args.length < 2)
                    return;
                if (typeof args[1] != "undefined") {
                    work.data.push(TsdPlayer.CMD_PITCH_MODULATION_DEPTH);
                    work.data.push(args[1]);
                }
                if (args.length < 3)
                    return;
                if (typeof args[2] != "undefined") {
                    work.data.push(TsdPlayer.CMD_PITCH_MODULATION_WIDTH);
                    work.data.push(args[2]);
                }
                if (args.length < 4)
                    return;
                if (typeof args[3] != "undefined") {
                    work.data.push(TsdPlayer.CMD_PITCH_MODULATION_HEIGHT);
                    work.data.push(TssCompiler._toUint8(args[3]));
                }
                if (args.length < 5)
                    return;
                if (typeof args[4] != "undefined") {
                    work.data.push(TsdPlayer.CMD_PITCH_MODULATION_DELTA);
                    work.data.push(args[4]);
                }
            }
        },
        'n': {  // n/a
            sequence: "ast"
        },
        'na': {  // amp envelope
            args: [
                { def: 0, min: 0, max: 255 },
                { def: 0, min: 0, max: 255 }
            ],
            callback: function (self, work, command, args) {
                work.data.push(TsdPlayer.CMD_AMP_EMVELOPE);
                work.data.push(args[0]);
                work.data.push(args[1]);
            }
        },
        'ns': {  // note emvelope
            args: [],  // TODO
            callback: notImplemented
        },
        'nt': {  // note shift
            args: [],  // TODO
            callback: notImplemented
        },
        'o': {  // octave
            args: [ { def: 4, min: 0, max: 10 } ],
            callback: function (self, work, command, args) {
                work.currentOctave = args[0];
            }
        },
        'p': {  // panpot
            sequence: "h",
            args: [ { def: 0, min: 0, max: 3 } ],
            callback: function (self, work, command, args) {
                work.data.push(TsdPlayer.CMD_PANPOT);
                work.data.push(args[0]);
            }
        },
        'ph': {  // key-on phase
            args: [],  // TODO
            callback: notImplemented
        },
        'q': {  // gate time
            args: [ { def: maxGate, min: 0, max: maxGate } ],
            callback: function (self, work, command, args) {
                work.currentGate = args[0];
            }
        },
        'r': {  // note on/off
            args:[],
            callback: function (self, work, command, args) {
                if ('r' != command) {
                    if ((work.currentOctave < 0) || (10 < work.currentOctave))
                        throw new TssCompiler.CompileError(work.lineObject,
                                work.offset, "current octave is out of range");
                }
                work.offset +=
                    work.lineObject.data.countSpaces(work.offset);
                var fine = 0;
                if (work.offset < work.lineObject.data.byteLength()) {
                    var c = work.lineObject.data.charAt(work.offset);
                    if (('-' == c) || ('+' == c) || ('#' == c)) {
                        work.offset++;
                        if ('-' == c)
                            fine = -1;
                        else
                            fine = 1;
                    }
                }
                var totalCount = 0;
                for (;;) {
                    var result = TssCompiler._getNumberParameter(
                            work.lineObject, work.offset);
                    var length = 0;
                    var dot = 0;
                    if (typeof result.parameter == "undefined") {
                        length = work.defaultLength;
                        dot = work.defaultDot;
                    } else {
                        length = result.parameter;
                        work.offset = result.end + 1;
                    }
                    for (;;) {
                        var position = TssCompiler._getCharacter(
                                work.lineObject, work.offset, '.');
                        if (position < 0)
                            break;
                        work.offset = position + 1;
                        dot++;
                    }
                    if (0 != (work.clock % length))
                        Log.getLog().warn("TSS: time resolution is not " +
                                "enough for length " + length);
                    var count = ~~(work.clock / length);
                    totalCount += count;
                    while (dot-- > 0) {
                        if (0 != (count % 2))
                            throw new TssCompiler.CompileError(work.lineObject,
                                    work.offset, "too many '.' against time" +
                                            " resolution");
                        count /= 2;
                        totalCount += count;
                    }
                    position = TssCompiler._getCharacter(work.lineObject,
                        work.offset, '^');
                    if (position < 0)
                        break;
                    work.offset = position + 1;
                }
                // TODO: Handle '&'.
                var restCount = 0;
                work.count += totalCount;
                if ('r' == command) {
                    work.data.push(TsdPlayer.CMD_NOTE_OFF);
                } else {
                    // TODO: Handle note shift.
                    fine += work.currentOctave * 12 +
                            TssCompiler._TONE_TABLE[command];
                    if (fine < 0) {
                        Log.getLog().warn("TSS: too low tone (clamped)");
                        fine = 0;
                    } else if (fine > 127) {
                        Log.getLog().warn("TSS: too high tone (clamped)");
                        fine = 127;
                    }
                    work.data.push(fine);
                    // TODO: Handle '&'.
                    restCount = totalCount;
                    totalCount = ~~(totalCount * work.currentGate /
                            work.maxGate);
                    restCount -= totalCount;
                }
                if (self.logMmlCompile)
                    Log.getLog().info(totalCount + "," + restCount);
                if (totalCount < 255) {
                    work.data.push(totalCount);
                } else if (totalCount < 65535) {
                    work.data.push(255);
                    work.data.push(totalCount >> 8);
                    work.data.push(totalCount & 0xff);
                } else {
                    throw new TssCompiler.CompileError(work.lineObject,
                            work.offset, "note length is too long");
                }
                if (restCount > 0) {
                    work.data.push(TsdPlayer.CMD_NOTE_OFF)
                    if (restCount < 255) {
                        work.data.push(restCount);
                    } else if (restCount < 65535) {
                        work.data.push(255);
                        work.data.push(restCount >> 8);
                        work.data.push(restCount & 0xff);
                    } else {
                        throw new TssCompiler.CompileError(work.lineObject,
                            work.offset, "rest length is too long");
                    }
                }
            }
        },
        's': {  // sustain
            args: [
                { def: undefined, min: 0, max: 255 },
                { def: undefined, min: -128, max: 127 }
            ],
            callback: function (self, work, command, args) {
                if (typeof args[0] != "undefined") {
                    work.data.push(TsdPlayer.CMD_SUSTAIN_MODE);
                    work.data.push(args[0]);
                }
                if ((2 == args.length) && (typeof args[1] != "undefined")) {
                    work.data.push(TsdPlayer.CMD_PORTAMENT);
                    work.data.push(TssCompiler._toUint8(args[1]));
                }
            }
        },
        't': {  // tempo
            args: [ { def: 120, min: 1, max: 512 } ],
            callback: function (self, work, command, args) {
                var n = ~~(22050 * 4 * 60 / 192 / args[0]);
                work.data.push(TsdPlayer.CMD_TEMPO);
                work.data.push(n >> 8);
                work.data.push(n & 0xff);
            }
        },
        'v': {  // volume
            args: [
                { def: 10, min: 0, max: 15 },
                { def: 0, min: 0, max: 15 }
            ],
            callback: function (self, work, command, args) {
                if ((TsdPlayer.HARDWARE_MODE_GAMEBOY == work.mode) &&
                        (2 == work.lineObject.directive))
                    for (var i = 0; i < args.length; i++)
                        if (args[i] > 3)
                            throw new TssCompiler.CompileError(work.lineObject,
                                    work.offset, "volume must be less than 4" +
                                            " for channel 2 in gameboy mode");
                var base = 0;
                work.volumeShift = 3;
                if (TsdPlayer.HARDWARE_MODE_GAMEBOY == work.mode)
                    work.volumeShift = 0;
                else if (TssCompiler.VOLUME_RANGE_MODE_NORMAL ==
                        work.volumeRangeMode)
                    work.volumeShift = 4;
                else
                    base = 128;
                if (1 == args.length) {
                    // mono
                    work.currentVolume.l =
                            base + (args[0] << work.volumeShift);
                    work.currentVolume.r = -1;
                    work.data.push(TsdPlayer.CMD_VOLUME_MONO);
                    work.data.push(work.currentVolume.l);
                } else {
                    // stereo
                    work.currentVolume.l =
                            base + (args[0] << work.volumeShift);
                    work.currentVolume.r =
                            base + (args[1] << work.volumeShift);
                    work.data.push(TsdPlayer.CMD_VOLUME_LEFT);
                    work.data.push(work.currentVolume.l);
                    work.data.push(TsdPlayer.CMD_VOLUME_RIGHT);
                    work.data.push(work.currentVolume.r);
                }
            }
        },
        'x': {  // volume and pitch mode
            args: [
                { def: undefined, min: 0, max: 17 },
                { def: undefined, min: 0, max: 3 }
            ],
            callback: function (self, work, command, args) {
                if (args[0] != undefined) {
                    if ((args[0] & 0x0f) > 1)
                        throw new TssCompiler.CompileError(work.lineObject,
                                work.offset, "invalid volume mode " +
                                args[0] + " for 'x'");
                    if ((args[0] & 0x10) == 0)
                        work.volumeRangeMode =
                                TssCompiler.VOLUME_RANGE_MODE_NORMAL;
                    else
                        work.volumeRangeMode =
                                TssCompiler.VOLUME_RANGE_MODE_UPPER;
                    work.data.push(TsdPlayer.CMD_VOLUME_MODE_CHANGE);
                    work.data.push(args[0] & 0x0f);
                }
                if (args[1] != undefined) {
                    work.data.push(TsdPlayer.CMD_FREQUENCY_MODE_CHANGE);
                    work.data.push(args[1]);
                }
            }
        }
    };
    for (var ch = 0; ch < this.tags.channels; ch++) {
        var work = {
            offset: 0,
            line: 0,
            lineObject: null,
            clock: 192, // TODO #CLOCK
            maxGate: maxGate,
            mode: this.modes.hardware,
            volumeRangeMode: TssCompiler.VOLUME_RANGE_MODE_NORMAL,
            volumeRelativeMode: this.modes.volumeRelative,
            volumeShift: 0,
            octaveMode: this.modes.octave,
            currentVolume: { l: 0, r: 0 },
            currentOctave: 4,
            currentGate: maxGate,
            defaultDot: 0,
            defaultLength: 4,
            loop: {
                offset: 0,
                line: 0,
                count: 0,
                end: {
                    offset: 0,
                    line: 0
                }
            },
            localLoopId: 0,
            count: 0,
            data: [],
            dataLength: 0
        };
        if (0 == ch) {
            work.data.push(TsdPlayer.CMD_FINENESS);
            work.data.push(this.tags.fineness >> 8);
            work.data.push(this.tags.fineness & 0xff);
        }
        if (TssCompiler.HARDWARE_MODE_FAMICOM == work.mode) {
            work.data.push(TsdPlayer.CMD_MODULE_CHANGE);
            if (2 != ch)
                work.data.push(1);
            else
                work.data.push(4);
        } else if (TssCompiler.HARDWARE_MODE_GAMEBOY == work.mode) {
            work.data.push(TsdPlayer.CMD_MODULE_CHANGE);
            if (3 == ch)
                work.data.push(15);
            else if (2 == ch)
                work.data.push(14);
            else
                work.data.push(13);
            work.data.push(TsdPlayer.CMD_FREQUENCY_MODE_CHANGE);
            if (2 == ch)
                work.data.push(3);
        }
        for (work.line = 0; work.line < this.channels[ch].length;
                work.line++) {
            work.lineObject = this.channels[ch][work.line];
            for (work.offset = 0;
                    work.offset < work.lineObject.data.byteLength(); ) {
                work.offset += work.lineObject.data.countSpaces(work.offset);
                if (work.offset >= work.lineObject.data.byteLength())
                    break;
                var c = work.lineObject.data.lowerCharAt(work.offset);
                var command = c;
                var args = [];
                if (('a' <= c) && (c <= 'g'))
                    c = 'r';
                if (!syntax[c])
                    throw new TssCompiler.CompileError(work.lineObject,
                        work.offset,
                        "unknown command '" + c + "'");
                work.offset++;
                if (syntax[c].sequence) {
                    work.offset +=
                            work.lineObject.data.countSpaces(work.offset);
                    if (work.offset >= work.lineObject.data.byteLength())
                        break;
                    var next = work.lineObject.data.lowerCharAt(work.offset);
                    if (syntax[c].sequence.indexOf(next) >= 0) {
                        c += next;
                        command = c;
                        work.offset++;
                    }
                }
                if (this.logMmlCompile)
                    Log.getLog().info("command " + command +
                            " with parameters as follows");
                for (var i = 0; i < syntax[c].args.length; i++) {
                    if (0 != i) {
                        var position = TssCompiler._getCharacter(
                                work.lineObject, work.offset, ',');
                        if (position < 0)
                            break;
                        work.offset = position + 1;
                    }
                    var result = TssCompiler._getNumberParameter(
                            work.lineObject, work.offset);
                    if (typeof result.parameter == "undefined") {
                        if ((typeof syntax[c].args[i].def == "undefined") &&
                                (syntax[c].args[i].mandatory))
                            throw new TssCompiler.CompileError(work.lineObject,
                                    work.offset,
                                    "missing argument for '" + c + "'");
                        args.push(syntax[c].args[i].def);
                    } else {
                        args.push(result.parameter);
                        work.offset = result.end + 1;
                    }
                }
                if (this.logMmlCompile)
                    Log.getLog().info(args);
                work.dataLength = work.data.length;
                if (syntax[c].callback)
                    syntax[c].callback(this, work, command, args);
                if (this.logMmlCompile) {
                    var message = "> " + work.dataLength.toString(16) + ": ";
                    for (i = work.dataLength; i < work.data.length; i++) {
                        if (i != work.dataLength)
                            message += ", ";
                        message += work.data[i].toString(16);
                    }
                    Log.getLog().info(message);
                }
                work.dataLength = work.data.length;
            }
        }
        work.data.push(TsdPlayer.CMD_END);
        this.channelData[ch] = work.data;
        Log.getLog().info("TSS: DATA " + (ch + 1) + "> " + work.data.length +
                " Byte(s) / " + work.count + " Tick(s)");
    }
};

/**
 * Generate TSD data.
 */
TssCompiler.prototype._generateTsd = function () {
    // Header size.
    var titleSize = this.tags.title.byteLength();
    if (0 != (titleSize % 2))
        titleSize++;
    var headerSize =
            14 +  // "T'SoundSystem", 0x00
            2 +  // Version.Release
            2 +  // Title length
            titleSize +  // title
            2 +  // number of channels
            8 * this.tags.channels +  // channel headers
            4;  // voice data offset
    var dataSize = headerSize;
    Log.getLog().info("TSS: HEADER SIZE> " + dataSize);

    // Data size.
    var i;
    for (i = 0; i < this.tags.channels; i++)
        dataSize += this.channelData[i].length;
    var voiceOffset = dataSize;

    // Wave data size
    dataSize += 2;  // number of waves
    Log.getLog().info("TSS: WAVE> " + this.validWaves);
    for (i = 0; i < this.waves.length; i++) {
        if (!this.waves[i])
            continue;
        Log.getLog().info("TSS:  " + i + "> " + this.waves[i].length);
        dataSize += 2 + this.waves[i].length;  // id, size, wave
    }

    // Table data size
    dataSize += 2;  // number of tables
    Log.getLog().info("TSS: TABLE> " + this.validTables);
    for (i = 0; i < this.tables.length; i++) {
        if (!this.tables[i])
            continue;
        Log.getLog().info("TSS:  " + i + "> " + this.tables[i].length);
        dataSize += 2 + this.tables[i].length;  // id, size, table
    }

    // Create data.
    var tsd = new Uint8Array(dataSize);
    Log.getLog().info("TSS: TOTAL SIZE> " + dataSize);
    var tsdWriter = TString.createFromUint8Array(tsd);
    // Magic: "T'SoundSystem", 0x00
    var offset = tsdWriter.setASCII(0, "T'SoundSystem");
    // Version.Release
    tsdWriter.setAt(offset++, Math.floor(TssCompiler.VERSION));
    tsdWriter.setAt(offset++, Math.floor(TssCompiler.VERSION * 100) % 100);
    // Title length, UTF-8 string, and padding.
    offset = tsdWriter.setUint16(offset, this.tags.title.byteLength());
    offset = tsdWriter.setTString(offset, this.tags.title);
    if (0 == (this.tags.title.byteLength() % 2))
        offset--;
    // Number of channels.
    offset = tsdWriter.setUint16(offset, this.tags.channels);
    // Channel headers.
    var channelOffset = headerSize;
    for (i = 0; i < this.tags.channels; i++) {
        var channelSize = this.channelData[i].length;
        offset = tsdWriter.setUint32(offset, channelOffset);
        offset = tsdWriter.setUint32(offset, channelSize);
        // Channel data.
        for (var n = 0; n < channelSize; n++)
            tsdWriter.setAt(channelOffset + n, this.channelData[i][n]);
        channelOffset += channelSize;
    }
    // Voice data offset.
    offset = tsdWriter.setUint32(offset, voiceOffset);

    // Wave data
    offset = tsdWriter.setUint16(voiceOffset, this.validWaves);
    for (i = 0; i < this.validWaves; i++) {
        if (!this.waves[i])
            continue;
        tsdWriter.setAt(offset++, i);
        var dataLength = this.waves[i].length;
        tsdWriter.setAt(offset++, dataLength);
        for (var dataOffset = 0; dataOffset < dataLength; dataOffset++)
            tsdWriter.setAt(offset++,
                    TssCompiler._toUint8(this.waves[i][dataOffset]));
    }

    // Table data
    offset = tsdWriter.setUint16(offset, this.validTables);
    for (i = 0; i < this.validTables; i++) {
        if (!this.tables[i])
            continue;
        tsdWriter.setAt(offset++, i);
        dataLength = this.tables[i].length;
        tsdWriter.setAt(offset++, dataLength);
        for (dataOffset = 0; dataOffset < dataLength; dataOffset++)
            tsdWriter.setAt(offset++,
                TssCompiler._toUint8(this.tables[i][dataOffset]));
    }

    return tsd.buffer;
};

/**
 * Compile TSS source internally.
 */
TssCompiler.prototype._compile = function () {
    try {
        this._parseLines();
        this._parseDirectives();
        this._parseChannels();
        return this._generateTsd();
    } catch (e) {
        Log.getLog().error(e.stack);
        Log.getLog().error(e.toString());
        return null;
    }
};

/**
 * Compile TSS source data.
 * @param source string or ArrayBuffer object containing TSS source data
 */
TssCompiler.prototype.compile = function (source) {
    if (typeof source == "string")
        this.source = TString.createFromString(source);
    else
        this.source = TString.createFromUint8Array(new Uint8Array(source));
    return this._compile();
};
/**
 * T'SoundSystem for JavaScript
 */

/**
 * TString prototype
 *
 * Contain string in UTF-8 and performs various functions around string
 * processing.
 * @author Takashi Toyoshima <toyoshim@gmail.com>
 *
 * @constructor
 */
var TString = function () {
    this.object = null;
}

TString.CODE_NUL = 0x00;
TString.CODE_HT = 0x09;
TString.CODE_LF = 0x0a;
TString.CODE_CR = 0x0d;
TString.CODE_SP = 0x20;
TString.CODE_0 = 0x30;
TString.CODE_9 = 0x39;
TString.CODE_A = 0x41;
TString.CODE_Z = 0x5a;
TString.CODE_a = 0x61;
TString.CODE_z = 0x7a;

/**
 * Check if the specified code is BMP.
 * @param code character code in UTF-16
 * @return return true if the code is BMP
 */
TString._isBMP = function (code) {
    if ((code < 0) || (0x10000 <= code))
        return false;
    if (code < 0xd800)
        return true;
    if (code >= 0xe000)
        return true;
    return false;
};

/**
 * Check if the specified code is the first code of surroage pair.
 * @param code character code in UTF-16
 * @return return true if the code is the first code of surrogate pair
 */
TString._isHighSurrogates = function (code) {
    if ((0xd800 <= code) && (code < 0xdc00))
        return true;
    return false;
};

/**
 * Check if the specified code is the second code of surroage pair.
 * @param code character code in UTF-16
 * @return return true if the code is the second code of surrogate pair
 */
TString._isLowSurrogates = function (code) {
    if ((0xdc00 <= code) && (code < 0xe000))
        return true;
    return false;
};

/**
 * Decode UTF-16 surrogate pair and return UCS-2 code.
 * @param first the first code of a pair
 * @param second the second code of a pair
 * @return UCS-2 code
 * @throws RangeError when the specified code pair is an invalid sarrogate pair
 */
TString._decodeSurrogatePair = function (first, second) {
    if (!TString._isHighSurrogates(first) ||
            !TString._isLowSurrogates(second))
        throw new RangeError("TString: invalid surrogate pair (" + first +
                ", " + second + ")");
    var w = (first >> 6) & 0xf;
    var u = w + 1;
    var x = ((first & 0x3f) << 10) | (second & 0x3ff);
    var i32 = (u << 16) + x;
    if (i32 < 0)
        return 0x100000000 + i32;
    return i32;
};

/**
 * Calculate code size in UTF-8.
 * @param code UCS-2 code
 * @return size in bytes
 */
TString._bytesInUTF8 = function (code) {
    if (code < 0)
        throw new RangeError("TString: invalid UCS-2 code " + code);
    if (code < 0x80)
        return 1;
    if (code < 0x800)
        return 2;
    if (code < 0x10000)
        return 3;
    if (code < 0x200000)
        return 4;
    if (code < 0x4000000)
        return 5;
    if (code < 0x80000000)
        return 6;
    throw new RangeError("TString: invalid UCS-2 code " + code)
};

/**
 * Count UCS-2 string length in UTF-8 bytes.
 * @param string string object to count
 */
TString._countString = function (string) {
    var length = 0;
    for (var i = 0; i < string.length; i++) {
        var code = string.charCodeAt(i);
        if (!TString._isBMP(code)) {
            if (++i >= string.length)
                throw new RangeError("TString: invalid surrogate pair");
            code = TString._decodeSurrogatePair(code, string.charCodeAt(i));
        }
        length += TString._bytesInUTF8(code);
    }
    return length;
};

/**
 * Set UCS2 code to Uint8Array in UTF-8.
 * @param array Uint8Array where store UTF-8 codes
 * @param offset offset in array where store UTF-8 codes
 * @param code code to be stored
 */
TString._setUcs2 = function (array, offset, code) {
    if (code < 0)
        throw new RangeError("TString: invalid UCS-2 code " + code);
    if (code < 0x80) {  // 7bit
        array[offset] = code;  // 7bit
        return 1;
    }
    if (code < 0x800) {  // 11bit
        array[offset + 0] = 0xc0 | (code >> 6);  // 5bit
        array[offset + 1] = 0x80 | (code & 0x3f);  // 6bit
        return 2;
    }
    if (code < 0x10000) {  // 16bit
        array[offset + 0] = 0xe0 | (code >> 12); // 4bit
        array[offset + 1] = 0x80 | ((code >> 6) & 0x3f);  // 6bit
        array[offset + 2] = 0x80 | (code & 0x3f);  // 6bit
        return 3;
    }
    if (code < 0x200000) {  // 21bit
        array[offset + 0] = 0xf0 | (code >> 18); // 3bit
        array[offset + 1] = 0x80 | ((code >> 12) & 0x3f); // 6bit
        array[offset + 2] = 0x80 | ((code >> 6) & 0x3f);  // 6bit
        array[offset + 3] = 0x80 | (code & 0x3f);  // 6bit
        return 4;
    }
    if (code < 0x4000000) {  // 26bit
        array[offset + 0] = 0xf8 | (code >> 24); // 2bit
        array[offset + 1] = 0x80 | ((code >> 18) & 0x3f); // 6bit
        array[offset + 2] = 0x80 | ((code >> 12) & 0x3f); // 6bit
        array[offset + 3] = 0x80 | ((code >> 6) & 0x3f);  // 6bit
        array[offset + 4] = 0x80 | (code & 0x3f);  // 6bit
        return 5;
    }
    if (code < 0x80000000) {  // 31bit
        array[offset + 0] = 0xfc | (code >> 30); // 1bit
        array[offset + 1] = 0x80 | ((code >> 24) & 0x3f); // 6bit
        array[offset + 2] = 0x80 | ((code >> 18) & 0x3f); // 6bit
        array[offset + 3] = 0x80 | ((code >> 12) & 0x3f); // 6bit
        array[offset + 4] = 0x80 | ((code >> 6) & 0x3f);  // 6bit
        array[offset + 5] = 0x80 | (code & 0x3f);  // 6bit
        return 6;
    }
    throw new RangeError("TString: invalid UCS-2 code " + code)
};

/**
 * Build Uint8ArrayString in UTF-8 from string.
 * @param string string object to convert
 */
TString._buildUint8ArrayString = function (string) {
    var size = TString._countString(string);
    var array = new Uint8Array(size);
    var offset = 0;
    for (var i = 0; i < string.length; i++) {
        var code = string.charCodeAt(i);
        if (!TString._isBMP(code)) {
            if (++i >= string.length)
                throw new RangeError("TString: invalid surrogate pair");
            code = TString._decodeSurrogatePair(code, string.charCodeAt(i));
        }
        offset += TString._setUcs2(array, offset, code);
    }
    return array;
};

/**
 * Create TString object from string object.
 * @param string string object
 */
TString.createFromString = function (string) {
    var s = new TString();
    s._fromString(string);
    return s;
};

/**
 * Create TString object from Uint8Array object.
 * This TString object will share the original object.
 * @param array Uint8Array object
 */
TString.createFromUint8Array = function (array) {
    var s = new TString();
    s._fromUint8Array(array);
    return s;
};

/**
 * Contain string object as a internal string. string must be in UTF-16.
 * @param string string object.
 */
TString.prototype._fromString = function (string) {
    this.object = TString._buildUint8ArrayString(string);
};

/**
 * Contain Uint8Array object as a internal string. Uint8Array must be in
 * UTF-8.
 * @param array
 */
TString.prototype._fromUint8Array = function (array) {
    this.object = array;
};

/**
 * Get a byte code from the internal UTF-8 byte array.
 * @param offset offset
 * @return code
 * @throws RangeError when offset is out of range
 */
TString.prototype.at = function (offset) {
    if (offset >= this.object.byteLength)
        throw new RangeError("TString: offset is out of range");
    return this.object[offset];
};

/**
 * Get string from the internal UTF-8 byte array.
 * @param offset offset
 * @return character
 * @throws RangeError when offset is out of range
 */
TString.prototype.charAt = function (offset) {
    return String.fromCharCode(this.at(offset));
};

/**
 * Get lower string from the internal UTF-8 byte array.
 * @param offset offset
 * @return character
 * @throws RangeError when offset is out of range
 */
TString.prototype.lowerCharAt = function (offset) {
    var code = this.at(offset);
    if ((TString.CODE_A <= code) && (code <= TString.CODE_Z))
        code |= 0x20;
    return String.fromCharCode(code);
};

/**
 * Get number from the interrnal UTF-8 byte array.
 * @param offset offset
 * @return the number if the code is number, otherwise -1
 */
TString.prototype.numberAt = function (offset) {
    if (!this.isNumber(offset))
        return -1;
    return this.object[offset] - TString.CODE_0;
};

/**
 * Set a bytes code to the internal UTF-8 byte array.
 * @param offset offset
 * @param code code
 * @throws RangeError when offset is out of range
 */
TString.prototype.setAt = function (offset, code) {
    if (offset >= this.object.byteLength)
        throw new RangeError("TString: offset is out of range");
    this.object[offset] = code;
};

/**
 * Set a character to the internal UTF-8 byte array.
 * @param offset offset
 * @param ch character
 * @throws RangeError when offset is out of range
 */
TString.prototype.setCharAt = function (offset, ch) {
    this.setAt(offset, ch.charCodeAt(0));
};

/**
 * Set a ASCII string to the internal UTF-8 byte array.
 * @param offset offset
 * @param string ASCII string
 * @throws RangeError when offset is out of range
 */
TString.prototype.setASCII = function (offset, string) {
    for (var i = 0; i < string.length; i++)
        this.setAt(offset + i, string.charCodeAt(i));
    this.setAt(offset + string.length, 0);
    return offset + string.length + 1;
};

/**
 * Set a TString to the internal UTF-8 byte array.
 * @param offset offset
 * @param string TString
 * @throws RangeError when offset is out of range
 */
TString.prototype.setTString = function (offset, string) {
    for (var i = 0; i < string.byteLength(); i++)
        this.setAt(offset + i, string.at(i));
    this.setAt(offset + string.byteLength(), 0);
    return offset + string.byteLength() + 1;
};

/**
 * Set a number to the internal UTF-8 byte array as Uint16.
 * @param offset offset
 * @param n Uint16 number
 * @throws RangeError when offset is out of range
 */
TString.prototype.setUint16 = function (offset, n) {
    this.setAt(offset, n >> 8);
    this.setAt(offset + 1, n & 0xff);
    return offset + 2;
};

/**
 * Set a number to the internal UTF-8 byte array as Uint32.
 * @param offset offset
 * @param n Uint32 number
 * @throws RangeError when offset is out of range
 */
TString.prototype.setUint32 = function (offset, n) {
    this.setAt(offset, n >> 24);
    this.setAt(offset + 1, (n >> 16) & 0xff);
    this.setAt(offset + 2, (n >> 8) & 0xff);
    this.setAt(offset + 3, n & 0xff);
    return offset + 4;
};

/**
 * Get the interrnal UTF-8 byte array length.
 * @return length
 */
TString.prototype.byteLength = function () {
    return this.object.length;
};

/**
 * Duplicate a part of this object.
 * @param begin start offset
 * @param end end offset (start + size)
 */
TString.prototype.slice = function (begin, end) {
    return TString.createFromUint8Array(this.object.subarray(begin, end));
};

/**
 * Check if this object contains the specified string from offset.
 * @param offset start offset of the interrnal UTF-8 byte array
 * @param string string to be checked
 * @return true if the internal array contains specified data
 */
TString.prototype.containString = function (offset, string) {
    var t = TString.createFromString(string);
    return this.containUint8Array(offset, t.object);
};

/**
 * Check if this object contains the specified byte sequence from offset.
 * @param offset start offset of the internal UTF-8 byte array
 * @param array Uint8Array object containing byte sequence to be checked
 * @return true if the internal array contains specified data
 */
TString.prototype.containUint8Array = function (offset, array) {
    for (var i = 0; i < array.length; i++)
        if (this.object[offset + i] != array[i])
            return false;
    return true;
};

/**
 * Check if this object contains the specified ASCII string from offset.
 * The string must contain character in the range of 0x00 to 0x7f.
 * @param offset start offset of the internal UTF-8 byte array
 * @param ascii ASCII string to be checked
 * @return true if the internal array contains specified data
 */
TString.prototype.containASCII = function (offset, ascii) {
    for (var i = 0; i < ascii.length; i++)
        if (this.object[offset + i] != ascii.charCodeAt(i))
            return false;
    return true;
};

/**
 * Count line size in bytes except for line delimiter.
 * @param offset start offset
 */
TString.prototype.countLine = function (offset) {
    var count = 0;
    for (var i = offset; i < this.object.length; i++) {
        var c = this.object[i];
        if ((TString.CODE_CR == c)|| (TString.CODE_LF == c))
            break;
        count++;
    }
    return count;
};

/**
 * Count line delimiter size.
 * @param offset start offset
 */
TString.prototype.countLineDelimiter = function (offset) {
    if (offset >= this.object.length)
        return 0;
    var count = 0;
    var c = this.object[offset++];
    if (TString.CODE_CR == c) {
        if (offset == this.object.length)
            return 1;
        count++;
        c = this.object[offset];
    }
    if (TString.CODE_LF == c)
        count++;
    return count;
};

/**
 * Count white saces.
 * @param offset start offset
 * @return number of spaces
 */
TString.prototype.countSpaces = function (offset) {
    var n = 0;
    for (var i = offset; i < this.object.length; i++) {
        var c = this.object[i];
        if ((TString.CODE_NUL != c) && (TString.CODE_HT != c) &&
                (TString.CODE_SP != c))
            break;
        n++;
    }
    return n;
};

/**
 * Return an alphabetical order position from 'a' or 'A' of character in
 * offset if it is alphabet. Otherwise return -1.
 * @param offset offset
 * @return an alphabetical order position from 'a' or 'A', or -1.
 */
TString.prototype.alphabetIndex = function (offset) {
    var c = this.object[offset];
    if ((TString.CODE_A <= c) && (c <= TString.CODE_Z))
        return c - TString.CODE_A;
    else if ((TString.CODE_a <= c) && (c <= TString.CODE_z))
        return c - TString.CODE_a;
    return -1;
};

/**
 * Check if the code in position of offset is a character for a number.
 * @param offset offset
 * @return true if the code is a character for a number.
 */
TString.prototype.isNumber = function (offset) {
    if (offset >= this.object.byteLength)
        return false;
    var c = this.object[offset];
    if ((c < TString.CODE_0) || (TString.CODE_9 < c))
        return false;
    return true;
};

/**
 * Find code from internal UTF-8 array at offset.
 * @param offset start offset
 * @param code code to find
 * @return offset if the code is found, otherwise -1
 */
TString.prototype.find = function (offset, code) {
    for (var i = offset; i < this.object.length; i++)
        if (this.object[i] == code)
            return i;
    return -1;
};

/**
 * Create UTF-16 string object from internal UTF-8 byte array from offset.
 * @param offset start offset (default: 0)
 * @param size size in byte (default: byteLength() - offset)
 * @return UTF-16 string object
 * @throws TypeError when internal UTF-8 byte array contains invalid code
 */
TString.prototype.toString = function (offset, size) {
    if (arguments.length < 1)
        offset = 0;
    if (arguments.length < 2)
        size = this.byteLength() - offset;
    var result = "";
    var first = true;
    var length = 1;
    var value = 0;
    for (var i = 0; (i < size) && (i < this.object.length); i++) {
        var c = this.object[offset + i];
        if (first) {
            if (0 == c)
                break;
            if (c < 0x80) {
                // 1 Byte UTF-8 string
                result += String.fromCharCode(c);
                continue;
            }
            first = false;
            if (c < 0xc2) {
                // Invalid character
                throw new TypeError("TString: invalid UTF-8");
            } else if (c < 0xe0) {
                // 2 Bytes UTF-8 string
                length = 2;
                value = c & 0x1f;
            } else if (c < 0xf0) {
                // 3 Bytes UTF-8 string
                length = 3;
                value = c & 0x0f;
            } else if (c < 0xf8) {
                // 4 Bytes UTF-8 string
                length = 4;
                value = c & 0x07;
            } else if (c < 0xfc) {
                // 5 Bytes UTF-8 string
                length = 5;
                value = c & 0x03;
            } else if (c < 0xfe) {
                // 6 Bytes UTF-8 string
                length = 6;
                value = c & 0x01;
            } else {
                // Invalid character
                throw new TypeError("TString: invalid UTF-8");
            }
            length--;
        } else {
            if ((c < 0x80) || (0xbf < c)) {
                // Invalid character
                throw new TypeError("TString: invalid UTF-8");
            }
            value = (value << 6) | (c & 0x3f);
            length--;
            if (0 == length) {
                first = true;
                if ((value < 0xd800) || (0xe000 <= value)) {
                    result += String.fromCharCode(value);
                } else {
                    var u = (value >> 16) & 0x1f;
                    var w = u - 1;
                    var x = value & 0xffff;
                    result += String.fromCharCode(
                        0xd800 + (w << 6) + (x >> 10));
                    result += String.fromCharCode(0xdc00 + (x & 0x3ff));
                }
            }
        }
    }
    if(!first)
        throw new TypeError("TString: invalid UTF-8");
    return result;
};

exports.TString = TString;
/**
 * T'SoundSystem for JavaScript
 */

/**
 * VgmPlayer prototype
 *
 * Play VGM format files.
 * @see http://www.smspower.org/uploads/Music/vgmspec161.txt
 * @author Takashi Toyoshima <toyoshim@gmail.com>
 */
var VgmPlayer = function () {
    this.masterChannel = null;
    this.input = null;
    this.offset = 0;
    this.psg = null;
    this.minorVersion = 0;
    this.snClock = PsgDeviceChannel.CLOCK_3_58MHZ;
    this.error = false;
    this.loop = false;
    this.loopSkipOffset = 0;
    this.interval = VgmPlayer._PLAYER_INTERVAL_NTSC;
    this.wait = 0;
    this.writtenSamples = 0;
}

VgmPlayer._GZ_ID1 = 0x1f;
VgmPlayer._GZ_ID2 = 0x8b;
VgmPlayer._VGM_ID1 = 'V'.charCodeAt(0);
VgmPlayer._VGM_ID2 = 'g'.charCodeAt(0);
VgmPlayer._VGM_ID3 = 'm'.charCodeAt(0);
VgmPlayer._VGM_ID4 = ' '.charCodeAt(0);
VgmPlayer._VGM_IDENT_SIZE = 4;
VgmPlayer._VGM_VERSION_SIZE = 4;
VgmPlayer._VERSION_1_00 = 0x00;
VgmPlayer._VERSION_1_01 = 0x01;
VgmPlayer._VERSION_1_10 = 0x10;
VgmPlayer._VERSION_1_50 = 0x50;
VgmPlayer._UINT_SIZE = 4;
VgmPlayer._BYTE_MASK = 0xff;
VgmPlayer._OFFSET_0 = 0;
VgmPlayer._OFFSET_1 = 1;
VgmPlayer._OFFSET_2 = 2;
VgmPlayer._OFFSET_3 = 3;
VgmPlayer._LSHIFT_0_BYTE = 0;
VgmPlayer._LSHIFT_1_BYTE = 8;
VgmPlayer._LSHIFT_2_BYTE = 16;
VgmPlayer._LSHIFT_3_BYTE = 24;
VgmPlayer._PLAYER_INTERVAL_NTSC = 17;
VgmPlayer._PLAYER_INTERVAL_PAL = 20;
VgmPlayer._VGM_DEFAULT_DATA_OFFSET = 0x40;
VgmPlayer._VGM_1_00_EOH = 0x24;
VgmPlayer._CMD_WRITE_GG = 0x4f;
VgmPlayer._CMD_WRITE_SN = 0x50;
VgmPlayer._CMD_WRITE_YM2413 = 0x51;
VgmPlayer._CMD_WRITE_YM2612A = 0x52;
VgmPlayer._CMD_WRITE_YM2612B = 0x53;
VgmPlayer._CMD_WRITE_YM2151 = 0x54;
VgmPlayer._CMD_WAIT_NNNN = 0x61;
VgmPlayer._CMD_WAIT_735 = 0x62;
VgmPlayer._CMD_WAIT_882 =  0x63;
VgmPlayer._CMD_EOD = 0x66;
VgmPlayer._WAIT_735 = 735;
VgmPlayer._WAIT_882 = 882;

/**
 * Read unsigned int value from InputStream.
 * @param input InputStream to read
 * @return read unsigned int value
 * @throws Error exception on reading
 */
VgmPlayer.prototype.readUInt = function (input, offset) {
    if (input.length <= (offset + VgmPlayer._UINT_SIZE))
        throw new Error("Unexpected EOF");
    var l = (input[offset + VgmPlayer._OFFSET_0] & VgmPlayer._BYTE_MASK) <<
            VgmPlayer._LSHIFT_0_BYTE;
    var k = (input[offset + VgmPlayer._OFFSET_1] & VgmPlayer._BYTE_MASK) <<
            VgmPlayer._LSHIFT_1_BYTE;
    var j = (input[offset + VgmPlayer._OFFSET_2] & VgmPlayer._BYTE_MASK) <<
            VgmPlayer._LSHIFT_2_BYTE;
    var h = (input[offset + VgmPlayer._OFFSET_3] & VgmPlayer._BYTE_MASK) <<
            VgmPlayer._LSHIFT_3_BYTE;
    var i32 = h | j | k | l;
    if (i32 < 0)
        return 0x100000000 + i32;
    return i32;
};

/**
 * Set master channel to write output stream.
 * @param channel master channel
 */
VgmPlayer.prototype.setMasterChannel = function (channel) {
    this.psg = new PsgDeviceChannel();
    this.psg.setMode(PsgDeviceChannel.MODE_SIGNED);
    this.psg.setDevice(PsgDeviceChannel.DEVICE_SN76489);
    channel.clearChannel();
    channel.addChannel(this.psg);
    channel.setPlayer(this);
    // TODO: msec is not sufficient for NTSC (16.6... is not 17!)
    channel.setPlayerInterval(VgmPlayer._PLAYER_INTERVAL_NTSC);
    this.interval = VgmPlayer._WAIT_735;
    Log.getLog().info("VGM: assume as NTSC");
    this.masterChannel = channel;
};

/**
 * Channel reach to periodical call back point.
 */
VgmPlayer.prototype.updateDevice = function () {
    if (this.error || (this.input == null)) {
        return;
    }
    this.wait -= this.interval;
    if (this.wait > 0)
        return;
    try {
        while (true) {
            var command = this.input[this.offset++];
            var argument1;
            var argument2;
            switch (command) {
            case VgmPlayer._CMD_WRITE_GG:
                argument1 = this.input[this.offset++];
                this.psg.writeRegister(0, argument1 & VgmPlayer._BYTE_MASK);
                this.writtenSamples++;
                break;
            case VgmPlayer._CMD_WRITE_SN:
                argument1 = this.input[this.offset++];
                this.psg.writeRegister(0, argument1 & VgmPlayer._BYTE_MASK);
                this.writtenSamples++;
                break;
            case VgmPlayer._CMD_WRITE_YM2413:
            case VgmPlayer._CMD_WRITE_YM2612A:
            case VgmPlayer._CMD_WRITE_YM2612B:
            case VgmPlayer._CMD_WRITE_YM2151:
                this.error = true;
                Log.getLog().warn("VGM: FM sound is not supported");
                return;
            case VgmPlayer._CMD_WAIT_NNNN:
                argument1 = this.input[this.offset++];
                argument2 = this.input[this.offset++];
                this.wait = (argument1 & VgmPlayer._BYTE_MASK) | ((argument2 &
                        VgmPlayer._BYTE_MASK) << VgmPlayer._LSHIFT_1_BYTE);
                return;
            case VgmPlayer._CMD_WAIT_735:
                this.wait += VgmPlayer._WAIT_735;
                this.masterChannel.setPlayerInterval(
                        VgmPlayer._PLAYER_INTERVAL_NTSC);
                if (this.interval != VgmPlayer._WAIT_735) {
                    Log.getLog().info("VGM: detect as NTSC");
                    this.interval = VgmPlayer._WAIT_735;
                }
                return;
            case VgmPlayer._CMD_WAIT_882:
                this.wait += VgmPlayer._WAIT_882;
                this.masterChannel.setPlayerInterval(
                        VgmPlayer._PLAYER_INTERVAL_PAL);
                if (this.interval != VgmPlayer._WAIT_882) {
                    Log.getLog().info("VGM: detect as PAL");
                    this.interval = VgmPlayer._WAIT_882;
                }
                return;
            case VgmPlayer._CMD_EOD:
                if (this.loop) {
                    this.offset = this.loopSkipOffset;
                    Log.getLog().info("VGM: loop");
                } else {
                    // set error flag to stop music
                    this.error = true;
                    return;
                }
                break;
            default:
                Log.getLog().warn("VGM: unknown command 0x" + (command &
                        VgmPlayer._BYTE_MASK).toString(16));
                Log.getLog().warn("written samples = " + this.writtenSamples);
                return;
            }
        }
    } catch (e) {
        Log.getLog().error("VGM: " + e.toString());
        this.error = true;
    }
};

/**
 * Decode and play.
 * @param newInput ArrayBuffer to play
 * @return success or not
 */
VgmPlayer.prototype.play = function (newInput) {
    try {
        this.input = null;
        this.offset = 0;
        this.error = false;
        this.loop = false;

        var input = new Uint8Array(newInput);

        // check gzip or not
        if (VgmPlayer._GZ_ID1 == input[0] && VgmPlayer._GZ_ID2 == input[1]) {
            Log.getLog().info("VGM: GZip compressed, aka VGZ");
            Log.getLog().error("VGZ: Not supported");
            return false;
        }

        // check vgm header
        var offset = 0;
        if (input.byteLength <= (offset + VgmPlayer._VGM_IDENT_SIZE))
            return false;
        if ((input[offset + VgmPlayer._OFFSET_0] != VgmPlayer._VGM_ID1) ||
                (input[offset + VgmPlayer._OFFSET_1] != VgmPlayer._VGM_ID2) ||
                (input[offset + VgmPlayer._OFFSET_2] != VgmPlayer._VGM_ID3) ||
                (input[offset + VgmPlayer._OFFSET_3] != VgmPlayer._VGM_ID4)) {
            Log.getLog().error("VGM: Invalid IDENT");
            return false;
        }
        offset += VgmPlayer._VGM_IDENT_SIZE;
        Log.getLog().info("VGM: detect VGM indent");

        // EoF offset
        var vgmLength = this.readUInt(input, offset) + VgmPlayer._UINT_SIZE;
        offset += 4;
        Log.getLog().info("VGM: file length = " + vgmLength);

        // Version
        if (input.byteLength <= offset + VgmPlayer._VGM_VERSION_SIZE)
            return false;
        var vgmVersion = new Array(VgmPlayer._VGM_VERSION_SIZE);
        for (var i = 0; i < VgmPlayer._VGM_VERSION_SIZE; i++)
            vgmVersion[i] = input[offset++];
        if ((vgmVersion[VgmPlayer._OFFSET_3] != 0) ||
                (vgmVersion[VgmPlayer._OFFSET_2] != 0) ||
                (vgmVersion[VgmPlayer._OFFSET_1] != 1)) {
            Log.getLog().error("VGM: version is not 1.x ("
                    + vgmVersion[VgmPlayer._OFFSET_3] + "."
                    + vgmVersion[VgmPlayer._OFFSET_2] + "."
                    + vgmVersion[VgmPlayer._OFFSET_1] + "."
                    + vgmVersion[VgmPlayer._OFFSET_0] + ")");
            return false;
        }
        this.minorVersion = vgmVersion[VgmPlayer._OFFSET_0] &
                VgmPlayer._BYTE_MASK;
        switch (this.minorVersion) {
        case VgmPlayer._VERSION_1_00:
            Log.getLog().info("VGM: version 1.00");
            break;
        case VgmPlayer._VERSION_1_01:
            Log.getLog().info("VGM: version 1.01");
            break;
        case VgmPlayer._VERSION_1_10:
            Log.getLog().info("VGM: version 1.10");
            break;
        case VgmPlayer._VERSION_1_50:
            Log.getLog().info("VGM: version 1.50");
            break;
        default:
            Log.getLog().info("VGM: unknown version 1.["
                    + this.minorVersion + "]");
            return false;
        }

        // clock settings
        var clock;
        clock = this.readUInt(input, offset);
        offset += 4;
        if (0 == clock) {
            Log.getLog().warn("VGM: SN76489 is not used");
            return false;
        }
        Log.getLog().info("VGM: SN76489 clock is " + clock + " Hz");
        if (clock != this.snClock) {
            Log.getLog().info("VGM:   not " + this.snClock + " Hz");
            this.snClock = clock;
        }
        this.psg.setClock(this.snClock);
        clock = this.readUInt(input, offset);
        offset += 4;
        if (0 != clock) {
            // TODO: support YM2413
            Log.getLog().info("VGM: YM2413 clock is " + clock + " Hz");
            return false;
        }

        // GD3 tag (TODO: support GD3 tag)
        var gd3Offset = this.readUInt(input, offset);
        offset += 4;
        Log.getLog().info("VGM: GD3 offset = " + gd3Offset);

        // check offsets
        var totalSamples = this.readUInt(input, offset);
        Log.getLog().info("VGM: Total # samples = " + totalSamples);
        offset += 4;
        var loopOffset = this.readUInt(input, offset);
        Log.getLog().info("VGM: Loop offset = " + loopOffset);
        if (0 != loopOffset) {
            this.loop = true;
            this.loopSkipOffset = offset + loopOffset;
        }
        offset += 4;
        var loopSamples = this.readUInt(input, offset);
        Log.getLog().info("VGM: Loop # samples = " + loopSamples);
        offset += 4;

        // 1.00 complete
        if (this.minorVersion == VgmPlayer._VERSION_1_00) {
            offset += VgmPlayer._VGM_DEFAULT_DATA_OFFSET -
                    VgmPlayer._VGM_1_00_EOH;
            this.offset = offset;
            this.input = input;
            return true;
        }

        // 1.01 features
        // TODO

        // 1.10 features
        // TODO
        if (this.minorVersion <= VgmPlayer._VERSION_1_50) {
            offset += VgmPlayer._VGM_DEFAULT_DATA_OFFSET -
                    VgmPlayer._VGM_1_00_EOH;
            this.offset = offset;
            this.input = input;
            return true;
        }

        // 1.50 features
        // TODO

        // 1.51 features
        // TODO

        // 1.60 features
        // TODO

        // 1.61 feature
        // TODO
        return false;
    } catch (e) {
        return false;
    }
};
/**
 * T'SoundSystem for JavaScript
 */

/**
 * WebMidiChannel prototype
 *
 * This prototype implements MIDI device connected via Web MIDI API.
 * See, https://dvcs.w3.org/hg/audio/raw-file/tip/midi/specification.html, and
 * latest draft https://github.com/WebAudio/web-midi-api .
 * @author Takashi Toyoshima <toyoshim@gmail.com>
 *
 * @constructor
 * @param port MIDIOutput interface
 */
var WebMidiChannel = function (port) {
    this.port = port;
}

WebMidiChannel.prototype = new MidiChannel();
WebMidiChannel.prototype.constructor = WebMidiChannel;

WebMidiChannel.initialized = false;
WebMidiChannel.inputs = [];
WebMidiChannel.outputs = [];
WebMidiChannel._access = null;

WebMidiChannel.initialize = function (callback) {
    if (WebMidiChannel.initialized) {
        if (callback)
            callback(true);
        return true;
    }
    if (navigator.requestMIDIAccess === undefined) {
        Log.getLog().info("Web MIDI API is not available.");
        if (callback)
            callback(false);
        return false;
    }
    var cb = callback;
    navigator.requestMIDIAccess({'sysex': true}).then(function(access) {
        // Success.
        WebMidiChannel._access = access;
        Log.getLog().info("Web MIDI API is available.");
        WebMidiChannel.initialized = true;
        if (cb)
            cb(true);
        WebMidiChannel.inputs = access.inputs();
        Log.getLog().info("MIDI inputs: " + WebMidiChannel.inputs.length);
        WebMidiChannel.outputs = access.outputs();
        Log.getLog().info("MIDI outputs: " + WebMidiChannel.outputs.length);
        for (var i = 0; i < WebMidiChannel.outputs.length; ++i) {
            Log.getLog().info("<" + i + ">");
            Log.getLog().info("  id          : " +
                    WebMidiChannel.outputs[i].id)
            Log.getLog().info("  manufacturer: " +
                    WebMidiChannel.outputs[i].manufacturer);
            Log.getLog().info("  name        : " +
                    WebMidiChannel.outputs[i].name);
            Log.getLog().info("  version     : " +
                    WebMidiChannel.outputs[i].version);
        }
    }, function(error) {
        // Error.
        Log.getLog().error("Web MIDI API report an error on initialization.");
        Log.getLog().error(error);
        if (cb)
            cb(false);
    })
};

(function() {WebMidiChannel.initialize(); })();

/**
 * Process note off event.
 * @see MidiChannel
 */
WebMidiChannel.prototype.processNoteOff = function (ch, note, velocity) {
    this.sendToMIDI(0x80 + ch, note, velocity);
};

/**
 * Process note on event.
 * @see MidiChannel
 */
WebMidiChannel.prototype.processNoteOn = function (ch, note, velocity) {
    this.sendToMIDI(0x90 + ch, note, velocity);
};

/**
 * Process key pressure event.
 * @see MidiChannel
 */
WebMidiChannel.prototype.processKeyPressure = function (ch, note, pressure) {
    this.sendToMIDI(0xa0 + ch, note, pressure);
};

/**
 * Process control change event.
 * @see MidiChannel
 */
WebMidiChannel.prototype.processControlChange = function (ch, number, value) {
    this.sendToMIDI(0xb0 + ch, number, value);
};

/**
 * Process program change event.
 * @see MidiChannel
 */
WebMidiChannel.prototype.processProgramChange = function (ch, number) {
    this.sendToMIDI(0xc0 + ch, number);
};

/**
 * Process program change event.
 * @see MidiChannel
 */
WebMidiChannel.prototype.processChannelPressure = function (ch, pressure) {
    this.sendToMIDI(0xd0 + ch, pressure);
};

/**
 * Process pitch bend event.
 * @see MidiChannel
 */
WebMidiChannel.prototype.processPitchBend = function (ch, bend) {
    this.sendToMIDI(0xe0 + ch, (bend >> 7) & 0x7f, bend & 0x7f);
};

/**
 * Process one system exclusive event.
 * @see MidiChannel
 */
WebMidiChannel.prototype.processSystemExclusive = function (sysex) {
    this.sendToMIDI.apply(this, sysex);
};

/**
 * Process one system common message event.
 * @see MidiChannel
 */
WebMidiChannel.prototype.processSystemCommonMessage = function (common) {
    this.sendToMIDI.apply(this, common);
};

/**
 * Process one system realtime message event.
 * @see MidiChannel
 */
WebMidiChannel.prototype.processSystemRealtimeMessage = function (realtime) {
    this.sendToMIDI.apply(this, realtime);
};

/**
 * Process system reset message event.
 * @see MidiChannel
 */
WebMidiChannel.prototype.processSystemReset = function () {
    this.sendToMIDI(0xff);
};

/**
 * Process meta data event.
 * @see MidiChannel
 */
WebMidiChannel.prototype.processMetaData = function (meta) {
    this.sendToMIDI.apply(this, meta);
};

/**
 * Send a sequence of MIDI data to the connected MIDI device.
 */
WebMidiChannel.prototype.sendToMIDI = function () {
    if (this.port)
        this.port.send(Array.prototype.slice.call(arguments));
};
/**
 * T'SoundSystem for JavaScript
 */

/**
 * WebMidiLinkMidiChannel prototype
 *
 * This prototype implements MIDI device connected via WebMidiLink.
 * See, http://www.g200kg.com/en/docs/webmidilink/ for details.
 * @author Takashi Toyoshima <toyoshim@gmail.com>
 */
var WebMidiLinkMidiChannel = function (port) {
    this.port = port;
}

WebMidiLinkMidiChannel.prototype = new MidiChannel();
WebMidiLinkMidiChannel.prototype.constructor = WebMidiLinkMidiChannel;

/**
 * Process note off event.
 * @see MidiChannel
 */
WebMidiLinkMidiChannel.prototype.processNoteOff =
        function (ch, note, velocity) {
    this.sendToWebMidiLink(0x80 + ch, note, velocity);
};

/**
 * Process note on event.
 * @see MidiChannel
 */
WebMidiLinkMidiChannel.prototype.processNoteOn =
        function (ch, note, velocity) {
    this.sendToWebMidiLink(0x90 + ch, note, velocity);
};

/**
 * Process key pressure event.
 * @see MidiChannel
 */
WebMidiLinkMidiChannel.prototype.processKeyPressure =
        function (ch, note, pressure) {
    this.sendToWebMidiLink(0xa0 + ch, note, pressure);
};

/**
 * Process control change event.
 * @see MidiChannel
 */
WebMidiLinkMidiChannel.prototype.processControlChange =
        function (ch, number, value) {
    this.sendToWebMidiLink(0xb0 + ch, number, value);
};

/**
 * Process program change event.
 * @see MidiChannel
 */
WebMidiLinkMidiChannel.prototype.processProgramChange = function (ch, number) {
    this.sendToWebMidiLink(0xc0 + ch, number);
};

/**
 * Process program change event.
 * @see MidiChannel
 */
WebMidiLinkMidiChannel.prototype.processChannelPressure =
        function (ch, pressure) {
    this.sendToWebMidiLink(0xd0 + ch, pressure);
};

/**
 * Process pitch bend event.
 * @see MidiChannel
 */
WebMidiLinkMidiChannel.prototype.processPitchBend = function (ch, bend) {
    this.sendToWebMidiLink(0xe0 + ch, (bend >> 7) & 0x7f, bend & 0x7f);
};

/**
 * Process one system exclusive event.
 * @see MidiChannel
 */
WebMidiLinkMidiChannel.prototype.processSystemExclusive = function (sysex) {
    this.sendToWebMidiLink.apply(this, sysex);
};

/**
 * Process one system common message event.
 * @see MidiChannel
 */
WebMidiLinkMidiChannel.prototype.processSystemCommonMessage =
        function (common) {
    this.sendToWebMidiLink.apply(this, common);
};

/**
 * Process one system realtime message event.
 * @see MidiChannel
 */
WebMidiLinkMidiChannel.prototype.processSystemRealtimeMessage =
        function (realtime) {
    this.sendToWebMidiLink.apply(this, realtime);
};

/**
 * Process system reset message event.
 * @see MidiChannel
 */
WebMidiLinkMidiChannel.prototype.processSystemReset = function () {
    this.sendToWebMidiLink(0xff);
};

/**
 * Process meta data event.
 * @see MidiChannel
 */
WebMidiLinkMidiChannel.prototype.processMetaData = function (meta) {
    this.sendToWebMidiLink.apply(this, meta);
};

/**
 * Send a sequence of MIDI data to the connected WebMidiLink device.
 */
WebMidiLinkMidiChannel.prototype.sendToWebMidiLink = function () {
    var commands = [ "midi" ];
    for (var i = 0; i < arguments.length; ++i)
        commands.push(arguments[i].toString(16));
    if (this.port)
        this.port.postMessage(commands.join(","), "*");
};
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
    this.AudioLooper = AudioLooper;
    this.BiquadFilterChannel = BiquadFilterChannel;
    this.Format = Format;
    this.FrequencyConversionChannel = FrequencyConversionChannel;
    this.MasterChannel = MasterChannel;
    this.MidiChannel = MidiChannel;
    this.PsgDeviceChannel = PsgDeviceChannel;
    this.SimpleMidiChannel = SimpleMidiChannel;
    this.SimpleSlaveChannel = SimpleSlaveChannel;
    this.SmfPlayer = SmfPlayer;
    this.TimerMasterChannel = TimerMasterChannel;
    this.TssChannel = TssChannel;
    this.TsdPlayer = TsdPlayer;
    this.TssCompiler = TssCompiler;
    this.TString = TString;
    this.VgmPlayer = VgmPlayer;
    this.WebMidiChannel = WebMidiChannel;
    this.WebMidiLinkMidiChannel = WebMidiLinkMidiChannel;
    this.WhiteNoiseChannel = WhiteNoiseChannel;
    this.createAudioLooper = function (bufferSize) {
      return new AudioLooper(bufferSize);
    };
    this.createBiquadFilterChannel = function () {
      return new BiquadFilterChannel();
    };
    this.createFrequencyConversionChannel = function () {
      return new FrequencyConversionChannel();
    };
    this.createMasterChannel = function () {
      return new MasterChannel();
    };
    this.createMidiChannel = function () {
      return new MidiChannel();
    };
    this.createPsgDeviceChannel = function () {
      return new PsgDeviceChannel();
    };
    this.createSimpleMidiChannel = function () {
      return new SimpleMidiChannel();
    };
    this.createSimpleSlaveChannel = function (frequency) {
      return new SimpleSlaveChannel(frequency);
    };
    this.createSmfPlayer = function () {
      return new SmfPlayer();
    };
    this.createTimerMasterChannel = function (mode) {
      return new TimerMasterChannel(mode);
    };
    this.createTssChannel = function () {
      return new TssChannel();
    };
    this.createTString = function () {
      return new TString();
    };
    this.createVgmPlayer = function () {
      return new VgmPlayer();
    };
    this.createWebMidiChannel = function (port) {
      return new WebMidiChannel(port);
    };
    this.createWebMidiLinkMidiChannel = function () {
      return new WebMidiLinkMidiChannel(port);
    };
    this.createWhiteNoiseChannel = function () {
      return new WhiteNoiseChannel();
    };
  }
});
