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
