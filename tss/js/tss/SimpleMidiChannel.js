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
