/**
 * T'SoundSystem for JavaScript
 */

/**
 * SccDeviceChannel prototype
 *
 * This prototype implements SCC sound device as Device and Channel.
 * @author Takashi Toyoshima <toyoshim@gmail.com>
 */
var SccDeviceChannel = function () {
    this.clock = SccDeviceChannel.CLOCK_3_58MHZ;
    this.device = SccDeviceChannel.DEVICE_SCC;
    this.sampleRate = MasterChannel.DEFAULT_SAMPLE_FREQUENCY;
    this.registers = new Uint8Array(SccDeviceChannel._REGISTERS);
    this.channel = [];
    for (var i = 0; i < 5; ++i) {
        this.channel[i] = {
            tp: 0,
            limit: 0,
            count: 0,
            offset: 0,
            vol: 0,
            on: false,
            wt: new Int8Array(32)
        };
    }
}

SccDeviceChannel.CLOCK_3_58MHZ = 3579545;
SccDeviceChannel.DEVICE_SCC = 0;
SccDeviceChannel.DEVICE_SCC_PLUS = 1;
SccDeviceChannel._REGISTERS = 0xc1;

/**
 * Set device clock frequency in Hz.
 * @param hz clock frequency in Hz
 */
SccDeviceChannel.prototype.setClock = function (hz) {
    this.clock = hz; // tone frequency = clock / 32TP
};

/**
 * Set SCC+ register.
 * @param address register address
 * @param value data to write
 */
SccDeviceChannel.prototype._setRegisterPlus = function (address, value) {
    this.registers[address] = value;
    var ch;
    var offset;
    if (address <= 0x9f) {
        ch = address >> 5;
        offset = address & 0x1f;
        this.channel[ch].wt[offset] = value;
    } else if (address <= 0xa9) {
        ch = (address - 0xa0) >> 1;
        if (address & 1) {
            this.channel[ch].tp =
                    (this.channel[ch].tp & 0x00ff) | ((value & 0x0f) << 8);
        } else {
            this.channel[ch].tp = (this.channel[ch].tp & 0x0f00) | value;
        }
        this.channel[ch].limit = this.channel[ch].tp * this.sampleRate;
    } else if (address <= 0xae) {
        ch = address - 0xaa;
        this.channel[ch].vol = value & 0x0f;
    } else if (address == 0xaf) {
        this.channel[0].on = 0 != (value & (1 << 0));
        this.channel[1].on = 0 != (value & (1 << 1));
        this.channel[2].on = 0 != (value & (1 << 2));
        this.channel[3].on = 0 != (value & (1 << 3));
        this.channel[4].on = 0 != (value & (1 << 4));
    }
};

/**
 * Set emulated device target.
 * @param target target device
 */
SccDeviceChannel.prototype.setDevice = function (target) {
    this.device = target;
};

/**
 * @see MasterChannel
 * @param length buffer length or size in shorts
 */
SccDeviceChannel.prototype.setBufferLength = function (length) {
    this.buffer = new Int32Array(length);
};

/**
 * @see MasterChannel
 * @param rate sample rate
 */
SccDeviceChannel.prototype.setSampleRate = function (rate) {
    this.sampleRate = rate;
    this.setClock(this.clock);
};

/**
 * @see MasterChannel
 * @return audio stream buffer
 */
SccDeviceChannel.prototype.getBuffer = function () {
    return this.buffer;
};

/**
 * Generate specified length sound stream into internal buffer.
 * @see MasterChannel
 * @param length sound length in short to generate
 */
SccDeviceChannel.prototype.generate = function (length) {
    for (var offset = 0; offset < length; offset += 2) {
        var value = 0;
        for (var ch = 0; ch < 5; ch++) {
            this.channel[ch].count += this.clock;
            if (this.channel[ch].count >= this.channel[ch].limit) {
                this.channel[ch].count -= this.channel[ch].limit;
                this.channel[ch].offset++;
                this.channel[ch].offset &= 0x1f;
            }
            if (!this.channel[ch].on)
                continue;
            value += this.channel[ch].wt[this.channel[ch].offset] *
                     this.channel[ch].vol;
        }
        value = (value / 4) | 0;
        this.buffer[offset + 0] = value;
        this.buffer[offset + 1] = value;
    }
};

/**
 * @see Device
 * @param address register address to write
 * @param value register value to write
 */
SccDeviceChannel.prototype.writeRegister = function (address, value) {
    if (this.device == SccDeviceChannel.DEVICE_SCC) {
        if (address >= 0xe0) {
            this._setRegisterPlus(0xc0, value);
        } else if (address >= 0x90) {
        } else if (address >= 0x80) {
            this._setRegisterPlus(address + 0x20, value);
            return;
        } else if (address >= 0x60) {
            this._setRegisterPlus(address, value);
            this._setRegisterPlus(address + 0x20, value);
        } else {
            this._setRegisterPlus(address, value);
        }
    } else {
        if (0xb0 <= address && address < 0xc0)
            return;
        if (0xc0 <= address)
            this._setRegisterPlus(0xc0, value);
        else
            this._setRegisterPlus(address, value);
    }
};

/**
 * @see Device
 * @param address register address to read
 * @return read register value
 */
SccDeviceChannel.prototype.readRegister = function (address) {
    if (this.device == SccDeviceChannel.DEVICE_SCC) {
        if (address >= 0xe0)
            return this.registers[0xc0];
        else if (address >= 0x90)
            throw new RangeError("Undefined register: " + address);
        else if (address >= 0x60)
            return this.registers[address + 0x20];
        else
            return this.registers[address];
    } else {
        if (0xb0 <= address && address < 0xc0)
            throw new RangeError("Undefined register: " + address);
        if (0xc0 <= address)
            return this.registers[0xc0];
        return this.registers[address];
    }
};
