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
PsgDeviceChannel._STEP_BIAS = 4;
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
    this.baseStep = this.clock;
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
            this.countNoise -= step;
            this.countNoise |= 0; // truncate to 32-bit
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
        this.stepTone[PsgDeviceChannel._CH_A] *= this.sampleRate;
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
        this.stepTone[PsgDeviceChannel._CH_B] *= this.sampleRate;
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
        this.stepTone[PsgDeviceChannel._CH_C] *= this.sampleRate;
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
        this.stepNoise *= this.sampleRate;
        this.feedback = 0 !== (value & 4);
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
        this.stepTone[PsgDeviceChannel._CH_A] *= this.sampleRate;
        break;
    case PsgDeviceChannel.REGISTER_AY_CH_B_TP_LOW:
    case PsgDeviceChannel.REGISTER_AY_CH_B_TP_HIGH:
        this.stepTone[PsgDeviceChannel._CH_B] =
                ((this.register[PsgDeviceChannel.REGISTER_AY_CH_B_TP_HIGH] <<
                        PsgDeviceChannel._BITS_PER_BYTE) |
                        (this.register[
                                PsgDeviceChannel.REGISTER_AY_CH_B_TP_LOW])) <<
                        PsgDeviceChannel._STEP_BIAS;
        this.stepTone[PsgDeviceChannel._CH_B] *= this.sampleRate;
        break;
    case PsgDeviceChannel.REGISTER_AY_CH_C_TP_LOW:
    case PsgDeviceChannel.REGISTER_AY_CH_C_TP_HIGH:
        this.stepTone[PsgDeviceChannel._CH_C] =
                ((this.register[PsgDeviceChannel.REGISTER_AY_CH_C_TP_HIGH] <<
                        PsgDeviceChannel._BITS_PER_BYTE) |
                        (this.register[
                                PsgDeviceChannel.REGISTER_AY_CH_C_TP_LOW])) <<
                        PsgDeviceChannel._STEP_BIAS;
        this.stepTone[PsgDeviceChannel._CH_C] *= this.sampleRate;
        break;
    case PsgDeviceChannel.REGISTER_AY_NOISE_TP:
        this.stepNoise = ((value & PsgDeviceChannel._NOISE_TP_MASK) << 1) <<
                (PsgDeviceChannel._STEP_BIAS + 1);
        this.stepNoise *= this.sampleRate;
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
