/**
 * T'SoundSystem for JavaScript
 */

/**
 * OtisDeviceChannel prototype
 *
 * This prototype implements ES-5505 OTIS sound device as Device and Channel.
 * @author Takashi Toyoshima <toyoshim@gmail.com>
 */
var OtisDeviceChannel = function () {
    this.clock = OtisDeviceChannel.CLOCK_F3;
    this.buffer = null;
    this.page = 0;
    this.numberOfVoices = OtisDeviceChannel.MAX_VOICES;
    this.sampleRate = OtisDeviceChannel.SAMPLE_RATE_BASE *
            this.clock / OtisDeviceChannel.CLOCK_BASE *
            OtisDeviceChannel.MAX_VOICES / this.numberOfVoices;
    this.rom = [ null, null ];
    this.voice = new Array(OtisDeviceChannel.MAX_VOICES);
    for (var ch = 0; ch < 32; ++ch)
        this.voice[ch] = new OtisDeviceChannel.Voice();
}

OtisDeviceChannel.CLOCK_F3 = 15238050;
OtisDeviceChannel.CLOCK_10MHZ = 10000000;
OtisDeviceChannel.CLOCK_BASE = OtisDeviceChannel.CLOCK_10MHZ;
OtisDeviceChannel.SAMPLE_RATE_BASE = 19500;
OtisDeviceChannel.MAX_VOICES = 32;
OtisDeviceChannel.REGISTER_ACT = 0xd;
OtisDeviceChannel.REGISTER_IRQV = 0xe;
OtisDeviceChannel.REGISTER_PAGE = 0xf;
OtisDeviceChannel.REGISTER_VOICE_CR = 0x0;
OtisDeviceChannel.REGISTER_VOICE_FC = 0x1;
OtisDeviceChannel.REGISTER_VOICE_STRT_HIGH = 0x2;
OtisDeviceChannel.REGISTER_VOICE_STRT_LOW = 0x3;
OtisDeviceChannel.REGISTER_VOICE_END_HIGH = 0x4;
OtisDeviceChannel.REGISTER_VOICE_END_LOW = 0x5;
OtisDeviceChannel.REGISTER_VOICE_K2 = 0x6;
OtisDeviceChannel.REGISTER_VOICE_K1 = 0x7;
OtisDeviceChannel.REGISTER_VOICE_LVOL = 0x8;
OtisDeviceChannel.REGISTER_VOICE_RVOL = 0x9;
OtisDeviceChannel.REGISTER_VOICE_ACCH = 0xa;
OtisDeviceChannel.REGISTER_VOICE_ACCL = 0xb;
OtisDeviceChannel.REGISTER_FILTER_P4NM1 = 0x1;
OtisDeviceChannel.REGISTER_FILTER_P3NM1 = 0x2;
OtisDeviceChannel.REGISTER_FILTER_P3NM2 = 0x3;
OtisDeviceChannel.REGISTER_FILTER_P2NM1 = 0x4;
OtisDeviceChannel.REGISTER_FILTER_P2NM2 = 0x5;
OtisDeviceChannel.REGISTER_FILTER_P1NM1 = 0x6;

/**
 * Set device clock frequency in Hz.
 * @param hz clock frequency in Hz
 */
OtisDeviceChannel.prototype.setClock = function (hz) {
    this.clock = hz;
};

/**
 * Set sampling ROM data.
 * @param bank bank number
 * @param rom sampling data
 */
OtisDeviceChannel.prototype.setROM = function (bank, rom) {
    this.rom[bank] = rom;
    var sub = rom.subarray(0x100000);
    for (var ch = 0; ch < 32; ++ch) {
        this.voice[ch].setROM(bank * 2 + 0, rom);
        this.voice[ch].setROM(bank * 2 + 1, sub);
    }
};

/**
 * Set channel ROM bank.
 * @param channel channel
 * @bank bank number
 */
OtisDeviceChannel.prototype.setBank = function (channel, bank) {
    this.voice[channel].setBank(bank);
};

/**
 * @see Channel
 * @param length buffer length or size in shorts
 */
OtisDeviceChannel.prototype.setBufferLength = function (length) {
    this.buffer = new Int32Array(length);
};

/**
 * @see Channel
 * @return audio stream buffer
 */
OtisDeviceChannel.prototype.getBuffer = function () {
    return this.buffer;
};

/**
 * Generate specified length sound stream into internal buffer.
 * @see Channel
 * @param length sound length to generate
 */
OtisDeviceChannel.prototype.generate = function (length) {
    if (!this.buffer)
        return;

    for (var i = 0; i < length; ++i)
        this.buffer[i] = 0;
    for (var ch = 0; ch < this.numberOfVoices; ++ch)
        this.voice[ch].generate(this.buffer, length);
};

/**
 * Write to voice specific registers.
 * @param address register address to write
 * @param value register value to write
 */
OtisDeviceChannel.prototype._writeVoiceSpecificRegister =
        function (address, value) {
    switch (address) {
        case OtisDeviceChannel.REGISTER_VOICE_CR:
            //Log.getLog().info("ch " + this.page + "; cr: " + value);
            this.voice[this.page].cr = value & 0x0fff;
            this.voice[this.page].stp = value & 0x0003;
            this.voice[this.page].bs = 0 !== (value & (1 << 2));  // Bank (N/A)
            this.voice[this.page].lpe = 0 !== (value & (1 << 3));  // Loop
            this.voice[this.page].ble = 0 !== (value & (1 << 4));  // Bidi Loop
            this.voice[this.page].irqe = 0 !== (value & (1 << 5));  // (N/A)
            this.voice[this.page].dir = 0 !== (value & (1 << 6));  // Direction
            this.voice[this.page].irq = 0 !== (value & (1 << 7));  // (N/A)
            this.voice[this.page].ca = (value >> 8) & 0x0003;  // (N/A)
            this.voice[this.page].lp = (value >> 10) & 0x0003;  // LP4, LP3
            break;
        case OtisDeviceChannel.REGISTER_VOICE_FC:
            //Log.getLog().info("ch " + this.page + "; fc: " + value);
            this.voice[this.page].fc = (value >> 1) & 0x7fff;
            break;
        case OtisDeviceChannel.REGISTER_VOICE_STRT_HIGH:
            //Log.getLog().info("ch " + this.page + "; start high: " + value);
            this.voice[this.page].strt &= 0x0000ffff;
            this.voice[this.page].strt |= ((value << 16) & 0x1fff0000);
            break;
        case OtisDeviceChannel.REGISTER_VOICE_STRT_LOW:
            //Log.getLog().info("ch " + this.page + "; start low: " + value);
            this.voice[this.page].strt &= 0xffff0000;
            this.voice[this.page].strt |= (value & 0xffe0);
            break;
        case OtisDeviceChannel.REGISTER_VOICE_END_HIGH:
            //Log.getLog().info("ch " + this.page + "; end high: " + value);
            this.voice[this.page].end &= 0x0000ffff;
            this.voice[this.page].end |= ((value << 16) & 0x1fff0000);
            break;
        case OtisDeviceChannel.REGISTER_VOICE_END_LOW:
            //Log.getLog().info("ch " + this.page + "; end low: " + value);
            this.voice[this.page].end &= 0xffff0000;
            this.voice[this.page].end |= (value & 0xffe0);
            break;
        case OtisDeviceChannel.REGISTER_VOICE_K2:
            //Log.getLog().info("ch " + this.page + "; k2: " + value);
            this.voice[this.page].k2 = (value & 0xfff0) >> 4;
            break;
        case OtisDeviceChannel.REGISTER_VOICE_K1:
            //Log.getLog().info("ch " + this.page + "; k1: " + value);
            this.voice[this.page].k1 = (value & 0xfff0) >> 4;
            break;
        case OtisDeviceChannel.REGISTER_VOICE_LVOL:
            //Log.getLog().info("ch " + this.page + "; lvol: " + value);
            this.voice[this.page].lvol = (value >> 8) & 0x00ff;
            break;
        case OtisDeviceChannel.REGISTER_VOICE_RVOL:
            //Log.getLog().info("ch " + this.page + "; rvol: " + value);
            this.voice[this.page].rvol = (value >> 8) & 0x00ff;
            break;
        case OtisDeviceChannel.REGISTER_VOICE_ACCH:
            //Log.getLog().info("ch " + this.page + "; acc high: " + value);
            this.voice[this.page].acc &= 0x0000ffff;
            this.voice[this.page].acc |= ((value << 16) & 0x1fff0000);
            break;
        case OtisDeviceChannel.REGISTER_VOICE_ACCL:
            //Log.getLog().info("ch " + this.page + "; acc low: " + value);
            this.voice[this.page].acc &= 0xffff0000;
            this.voice[this.page].acc |= (value & 0xffff);
            break;
        default:
            Log.getLog().warn("unknown voice specific register: " + address +
                    " <= " + value + " @ " + this.page);
    }
};

/**
 * Write to filter storage registers.
 * @param address register address to write
 * @param value register value to write
 */
OtisDeviceChannel.prototype._writeFilterStorageRegister =
        function (address, value) {
    switch (address) {
        case OtisDeviceChannel.REGISTER_FILTER_P4NM1:
        case OtisDeviceChannel.REGISTER_FILTER_P3NM1:
        case OtisDeviceChannel.REGISTER_FILTER_P3NM2:
        case OtisDeviceChannel.REGISTER_FILTER_P2NM1:
        case OtisDeviceChannel.REGISTER_FILTER_P2NM2:
        case OtisDeviceChannel.REGISTER_FILTER_P1NM1:
            // TODO
            break;
        default:
            Log.getLog().warn("unknown filter storage register: " + address +
                    " <= " + value + " @ " + this.page);
    }
};

/**
 * Write to channel registers.
 * @param address register address to write
 * @param value register value to write
 */
OtisDeviceChannel.prototype._writeChannelRegister = function (address, value) {
    // TODO
    return;
};

/**
 * @see Device
 * @param address register address to write
 * @param value register value to write
 */
OtisDeviceChannel.prototype.writeRegister = function (address, value) {
    switch (address) {
        case OtisDeviceChannel.REGISTER_ACT:
            this.numberOfVoices = (value & 0x1f) + 1;
            Log.getLog().info('OTIS: number of voices ' + this.numberOfVoices);
            this.sampleRate = this.clock / (16 * this.numberOfVoices);
            Log.getLog().info('OTIS: sample rate ' + this.sampleRate + ' Hz');
            break;
        case OtisDeviceChannel.REGISTER_IRQV:
            // TODO
            break;
        case OtisDeviceChannel.REGISTER_PAGE:
            this.page = value & 0x7f;
            break;
        default:
            if (this.page < 32)
                this._writeVoiceSpecificRegister(address, value);
            else if (this.page < 64)
                this._writeFilterStorageRegister(address, value);
            else
                this._writeChannelRegister(address, value);
            break;
    }
};

/**
 * @see Device
 * @param address register address to read
 * @return read register value
 */
OtisDeviceChannel.prototype.readRegister = function (address) {
    // TODO
};

/**
 * OtisDeviceChannel.Voice prototype
 *
 * This prototype implements OTIS voice channel.
 * @author Takashi Toyoshima <toyoshim@gmail.com>
 */
OtisDeviceChannel.Voice = function () {
    this.cr = 0;
    this.bs = 0;  // This bit is not used in Taito F3 system
    this.stp = 3;
    this.lpe = false;
    this.ble = false;
    this.irqe = false;
    this.dir = false;
    this.irq = false;
    this.ca = 0;
    this.lp = 0;
    this.fc = 0;
    this.strt = 0;
    this.end = 0;
    this.k2 = 0;
    this.k1 = 0;
    this.lvol = 0;
    this.rvol = 0;
    this.acc = 0;
    this.p4nm1 = 0;
    this.p3nm1 = 0;
    this.p3nm2 = 0;
    this.p2nm1 = 0;
    this.p2nm2 = 0;
    this.p1nm1 = 0;
    this.bank = 0;
    this.rom = [ null ];
};

OtisDeviceChannel.Voice._VOLUME_TABLE = new Int32Array(0x100);

// Calculate tables.
(function () {
    for (var i = 0; i < 0x100; i++) {
        var exponent = i >> 4;
        var mantissa = 0x10 | (i & 0x0f);
        OtisDeviceChannel.Voice._VOLUME_TABLE[i] = (mantissa << exponent) >> 10;
    }
})();

/**
 * Set sampling ROM data.
 * @param bank bank number
 * @param rom sampling data
 */
OtisDeviceChannel.Voice.prototype.setROM = function (bank, rom) {
    this.rom[bank] = rom;
};

OtisDeviceChannel.Voice.prototype.setBank = function (bank) {
    this.bank = bank;
};

/**
 * Add specified length sound stream into composition buffer.
 * @param buffer composition buffer
 * @param length sound length to generate
 */
OtisDeviceChannel.Voice.prototype.generate = function (buffer, length) {
    var rom = this.rom[this.bank];
    if (this.stp || !rom)
        return;
    
    var lvol = OtisDeviceChannel.Voice._VOLUME_TABLE[this.lvol];
    var rvol = OtisDeviceChannel.Voice._VOLUME_TABLE[this.rvol];
    var lpe = this.lpe;
    var ble = this.ble;
    var dir = this.dir;
    var loop = this.end - this.strt;
    var end = (dir == 0) ? this.end : this.strt;
    var acc = this.acc;
    var fc = (dir == 0) ? this.fc : -this.fc;
    var lp = this.lp;
    var k1 = this.k1 / 0x1000;
    var k2 = this.k2 / 0x1000;
    var p1nm1 = this.p1nm1;
    var p2nm1 = this.p2nm1;
    var p2nm2 = this.p2nm2;
    var p3nm1 = this.p3nm1;
    var p3nm2 = this.p3nm2;
    var p4nm1 = this.p4nm1;

    for (var i = 0; i < length; i += 2) {
        // TODO: Check if dir, ble, lpe, and stp are handled correctly.
        if (dir == 0) {
            if (end < acc) {
                if (!lpe)
                    break;
                if (ble) {
                    fc = -fc;
                    dir = 1;
                    end = this.strt;
                } else {
                    acc -= loop;
                }
            }
        } else {
            if (acc < end) {
                if (!lpe)
                    break;
                if (ble) {
                    fc = -fc;
                    dir = 0;
                    end = this.end;
                } else {
                    acc -= loop;
                }
            }
        }
        var pos = acc >> 9;
        var data = rom[pos] +
                (rom[(pos + 1) & 0x000fffff] - rom[pos]) * (acc & 0x1ff) / 0x200;

        p1nm1 = k1 * (data - p1nm1) + p1nm1;  // LPF K1
        p2nm2 = p2nm1;
        p2nm1 = k1 * (p1nm1 - p2nm1) + p2nm1;  // LPF K1
        p3nm2 = p3nm1;
        if (lp == 0) {
            p3nm1 = p2nm1 - p2nm2 + k2 * p3nm1;  // HPF K2
            p4nm1 = p3nm1 - p3nm2 + k2 * p4nm1;  // HPF K2
        } else if (lp == 1) {
            p3nm1 = k1 * (p2nm1 - p3nm1) + p3nm1; // LPF K1
            p4nm1 = p3nm1 - p3nm2 + k2 * p4nm1;  // HPF K2
        } else if (lp == 2) {
            p3nm1 = k2 * (p2nm1 - p3nm1) + p3nm1;  // LPF K2
            p4nm1 = k2 * (p3nm1 - p4nm1) + p4nm1;  // LPF K2
        } else {
            p3nm1 = k1 * (p2nm1 - p3nm1) + p3nm1;  // LPF K1
            p4nm1 = k2 * (p3nm1 - p4nm1) + p4nm1;  // LPF K2
        }

        buffer[i + 0] += p4nm1 * lvol;
        buffer[i + 1] += p4nm1 * rvol;
        acc = (acc + fc) & 0x1fffffff;
    }
    
    this.dir = dir;
    this.acc = acc;
    this.p1nm1 = p1nm1;
    this.p2nm1 = p2nm1;
    this.p2nm2 = p2nm2;
    this.p3nm1 = p3nm1;
    this.p3nm2 = p3nm2;
    this.p4nm1 = p4nm1;
};
