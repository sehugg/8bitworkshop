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
    if (window['AudioContext']) {
        Log.getLog().info("AudioLooper: detect Web Audio API");
        this.audioContext = new AudioContext();
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
    if (this.bufferSource['noteOn'])
        this.bufferSource['noteOn'](0);
};

