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
