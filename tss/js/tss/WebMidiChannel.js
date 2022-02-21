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
        for (var input of access.inputs.values())
            WebMidiChannel.inputs.push(input);
        Log.getLog().info("MIDI inputs: " + WebMidiChannel.inputs.length);
        for (var output of access.outputs.values())
            WebMidiChannel.outputs.push(output);
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
