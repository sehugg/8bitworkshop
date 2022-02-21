/**
 * T'SoundSystem for JavaScript
 */

/**
 * OtisMidiChannel prototype
 *
 * This prototype implements virtual MIDI device using OTIS sound chip.
 * @author Takashi Toyoshima <toyoshim@gmail.com>
 */
var OtisMidiChannel = function () {
    this.fconv = new FrequencyConversionChannel();
    this.fconv.setOutputFrequency(MasterChannel.DEFAULT_SAMPLE_FREQUENCY);
    this.fconv.setInputFrequency(29714.1975);
    this.otis = new OtisDeviceChannel();
    this.fconv.setChannel(this.otis);
    this.rom = [ null, null ];
    this.snd = [ new F3SampleFormat(), new F3SampleFormat() ];
    this.programs = [];
    this.channel = new Array(OtisMidiChannel._MAX_CHANNEL);
    for (var ch = 0; ch < OtisMidiChannel._MAX_CHANNEL; ch++)
        this.channel[ch] = new OtisMidiChannel.Channel();
    this.voice = new Array(OtisMidiChannel._MAX_VOICE);
    for (var v = 0; v < OtisMidiChannel._MAX_VOICE; ++v)
        this.voice[v] = false;
    this.activeVoices = 0;
    this.searchingVoice = 0;
    this.processSystemReset();
}

OtisMidiChannel.prototype = new MidiChannel();
OtisMidiChannel.prototype.constructor = OtisMidiChannel;

OtisMidiChannel._MAX_CHANNEL = 16;
OtisMidiChannel._MAX_VOICE = 32;

/**
 * Set ROM data.
 * @param bank bank number
 * @param rom rom data in Uint8Array
 */
OtisMidiChannel.prototype.setROM = function(bank, rom) {
    if (bank >= 2)
        return;
    this.rom[bank] = rom;
    this.snd[bank].load(rom);
    this.otis.setROM(bank, rom);
};

/**
 * Set voice data.
 * param voices Array of voice data in object
 */
OtisMidiChannel.prototype.setVoice = function(voice) {
    this.programs = voice;
}

/**
 * Find usable voice number.
 */
OtisMidiChannel.prototype._findVoice = function () {
    var voice = 0;
    if (OtisMidiChannel._MAX_VOICE == this.activeVoices) {
        Log.getLog.info('OtisMidiChannel: voice overflow');
        return -1;
    } else {
        for (var i = 0; i < OtisMidiChannel._MAX_VOICE; i++) {
            // Search inactive channel.
            voice = this.searchingVoice + i;
            if (voice >= OtisMidiChannel._MAX_VOICE)
                voice -= OtisMidiChannel._MAX_VOICE;
            if (!this.voice[voice]) {
                this.searchingVoice = voice + 1;
                break;
            }
        }
    }
    if (this.searchingVoice >= OtisMidiChannel._MAX_VOICE)
        this.searchingVoice -= OtisMidiChannel._MAX_VOICE;
    return voice;
};

/**
 * @see MasterChannel
 * @param length buffer length or size in shorts
 */
OtisMidiChannel.prototype.setBufferLength = function (length) {
    this.fconv.setBufferLength(length);
};

/**
 * @see MasterChannel
 * @param rate sample rate
 */
OtisMidiChannel.prototype.setSampleRate = function (rate) {
    this.fconv.setOutputFrequency(rate);
};

/**
 * @see MasterChannel
 * @return audio stream buffer
 */
OtisMidiChannel.prototype.getBuffer = function () {
    return this.fconv.getBuffer();
};

/**
 * Generate specified length sound stream into internal buffer.
 * @see MasterChannel
 * @param length sound length in short to generate
 */
OtisMidiChannel.prototype.generate = function (length) {
    this.fconv.generate(length);
};

/**
 * Process note off event.
 * @see MidiChannel
 * @param ch channel
 * @param note note number
 * @param velocity key off velocity
 */
OtisMidiChannel.prototype.processNoteOff = function (ch, note, velocity) {
    var voice = this.channel[ch].voiceForNote(note);
    if (voice === undefined)
        return;
    this.channel[ch].noteOff(note);
    this.voice[voice] = false;
    this.activeVoices--;

    this.otis.writeRegister(OtisDeviceChannel.REGISTER_PAGE, voice);
    this.otis.writeRegister(OtisDeviceChannel.REGISTER_VOICE_CR, 1);
    this.otis.writeRegister(OtisDeviceChannel.REGISTER_VOICE_LVOL, 0);
    this.otis.writeRegister(OtisDeviceChannel.REGISTER_VOICE_RVOL, 0);
};

/**
 * Process note on event.
 * @see MidiChannel
 * @param ch channel
 * @param note note number
 * @param velocity key on velocity
 */
OtisMidiChannel.prototype.processNoteOn = function (ch, note, velocity) {
    if (this.channel[ch].voiceForNote(note) !== undefined)
        this.processNoteOff(ch, note, 0);

    var program = this.programs.voice[this.channel[ch].program];
    if (!program)
        return;

    var fc;
    if (program.type == 'drum') {
        var keys = this.programs.drum[program.name];
        program = keys[note % keys.length];
        if (!program)
            return;
        fc = program.fc;
    } else {
        var bend = this.channel[ch].bend;
        var frequency = MidiChannel.getFrequencyForNoteWithBend(note, bend)
        fc = (program.fc *  frequency / 440) | 0;
    }

    var voice = this._findVoice();
    if (voice < 0)
        return;

    this.channel[ch].noteOn(note, voice);
    this.voice[voice] = true;
    this.activeVoices++;
    
    this.otis.writeRegister(OtisDeviceChannel.REGISTER_PAGE, voice);
    this.otis.writeRegister(OtisDeviceChannel.REGISTER_VOICE_CR, 1);
    this.otis.setBank(voice, program.acc >> 29);
    this.otis.writeRegister(OtisDeviceChannel.REGISTER_VOICE_FC, fc | 0);
    this.otis.writeRegister(OtisDeviceChannel.REGISTER_VOICE_ACCH,
            program.acc >> 16);
    this.otis.writeRegister(OtisDeviceChannel.REGISTER_VOICE_ACCL,
            program.acc & 0xffff);
    this.otis.writeRegister(OtisDeviceChannel.REGISTER_VOICE_STRT_HIGH,
            program.start >> 16);
    this.otis.writeRegister(OtisDeviceChannel.REGISTER_VOICE_STRT_LOW,
            program.start & 0xffff);
    this.otis.writeRegister(OtisDeviceChannel.REGISTER_VOICE_END_HIGH,
            program.end >> 16);
    this.otis.writeRegister(OtisDeviceChannel.REGISTER_VOICE_END_LOW,
            program.end & 0xffff);
    this.otis.writeRegister(OtisDeviceChannel.REGISTER_VOICE_K2, program.k2);
    this.otis.writeRegister(OtisDeviceChannel.REGISTER_VOICE_K1, program.k1);
    var panpot = this.channel[ch].panpot;
    // TODO: Support other parameters.
    this.otis.writeRegister(OtisDeviceChannel.REGISTER_VOICE_LVOL,
            (panpot == 127) ? 0 : (velocity << 9));
    this.otis.writeRegister(OtisDeviceChannel.REGISTER_VOICE_RVOL,
            (panpot == 0) ? 0 : (velocity << 9));
    this.otis.writeRegister(OtisDeviceChannel.REGISTER_VOICE_CR, program.cr);
};

/**
 * Process control change event. This function can be overwritten.
 * @see MidiChannel
 */
OtisMidiChannel.prototype.processControlChange = function (ch, number, value) {
    if (number == 10) {
        this.channel[ch].panpot = value;
    }
};

/**
 * Process program change event. This function can be overwritten.
 * @see MidiChannel
 */
OtisMidiChannel.prototype.processProgramChange = function (ch, number) {
    this.channel[ch].program = number;
};

/**
 * Process pitch bend event. This function can be overwritten.
 * @see MidiChannel
 */
OtisMidiChannel.prototype.processPitchBend = function (ch, bend) {
    this.channel[ch].bend = bend;
    // TODO: Affects immediately.
};

/**
 * Process system reset message event.
 * @see MidiChannel
 */
OtisMidiChannel.prototype.processSystemReset = function () {
    for (var ch = 0; ch < OtisMidiChannel._MAX_CHANNEL; ch++) {
        var notes = this.channel[ch].onNotes();
        for (var i = 0; i < notes.length; ++i)
            this.processNoteOff(ch, notes[i], 0);
        this.channel[ch].reset();
    }
    this.searchingVoice = 0;
};

OtisMidiChannel.Channel = function() {
    this.program = 0;
    this.bend = 0;
    this.panpot = 64;
    this.onNote = {};
};


OtisMidiChannel.Channel.prototype.reset = function () {
    this.program = 0;
    this.bend = 0;
    this.panpot = 64;
};

OtisMidiChannel.Channel.prototype.voiceForNote = function (note) {
    return this.onNote[note];
};

OtisMidiChannel.Channel.prototype.onNotes = function () {
    var notes = [];
    for (var key in this.onNote)
        notes.push(key);
    return notes;
};

OtisMidiChannel.Channel.prototype.noteOn = function (note, voice) {
    if (this.voiceForNote(note) !== undefined)
        return false;
    this.onNote[note] = voice;
}

OtisMidiChannel.Channel.prototype.noteOff = function (note) {
    if (this.voiceForNote(note) === undefined)
        return false;
    delete this.onNote[note];
}
