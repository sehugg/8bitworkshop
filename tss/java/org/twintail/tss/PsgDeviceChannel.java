/**
 * T'SoundSystem for Java
 */
package org.twintail.tss;

/**
 * class PsgDeviceChannel
 *
 * This class implements PSG sound device as Device and Channel.
 * AY-3-8910 is a reference model.
 * @author Takashi Toyoshima <toyoshim@gmail.com>
 */
public final class PsgDeviceChannel implements Device, Channel {
    public static final int CLOCK_4MHZ = 4000000;
    public static final int CLOCK_3_58MHZ = 3579545;
    public static final int MODE_UNSIGNED = 0;
    public static final int MODE_SIGNED = 1;
    public static final int DEVICE_PSG = 0;
    public static final int DEVICE_SSG = 1;
    public static final int DEVICE_AY_3_8910 = 0;
    public static final int DEVICE_YM_2149 = 1;
    public static final int DEVICE_SN76489 = 2;
    public static final int REGISTER_AY_CH_A_TP_LOW = 0;
    public static final int REGISTER_AY_CH_A_TP_HIGH = 1;
    public static final int REGISTER_AY_CH_B_TP_LOW = 2;
    public static final int REGISTER_AY_CH_B_TP_HIGH = 3;
    public static final int REGISTER_AY_CH_C_TP_LOW = 4;
    public static final int REGISTER_AY_CH_C_TP_HIGH = 5;
    public static final int REGISTER_AY_NOISE_TP = 6;
    public static final int REGISTER_AY_MIXER = 7;
    public static final int REGISTER_AY_CH_A_VOLUME = 8;
    public static final int REGISTER_AY_CH_B_VOLUME = 9;
    public static final int REGISTER_AY_CH_C_VOLUME = 10;
    public static final int REGISTER_AY_EP_LOW = 11;
    public static final int REGISTER_AY_EP_HIGH = 12;
    public static final int REGISTER_AY_EP_CONTROL = 13;
    public static final int REGISTER_AY_IO_A = 14;
    public static final int REGISTER_AY_IO_B = 15;
    public static final int REGISTER_SN_CH_A_TP = 8;
    public static final int REGISTER_SN_CH_A_VOLUME = 9;
    public static final int REGISTER_SN_CH_B_TP = 10;
    public static final int REGISTER_SN_CH_B_VOLUME = 11;
    public static final int REGISTER_SN_CH_C_TP = 12;
    public static final int REGISTER_SN_CH_C_VOLUME = 13;
    public static final int REGISTER_SN_NOISE_CONTROL = 14;
    public static final int REGISTER_SN_NOISE_VOLUME = 15;
    public static final int REGISTER_SN_CH_A_TP_HIGH = 0;
    public static final int REGISTER_SN_CH_B_TP_HIGH = 2;
    public static final int REGISTER_SN_CH_C_TP_HIGH = 4;

    private static final int DEFAULT_AY_CH_A_TP_LOW = 0x55;
    private static final int DEFAULT_AY_CH_A_TP_HIGH = 0x00;
    private static final int DEFAULT_AY_CH_B_TP_LOW = 0x00;
    private static final int DEFAULT_AY_CH_B_TP_HIGH = 0x00;
    private static final int DEFAULT_AY_CH_C_TP_LOW = 0x00;
    private static final int DEFAULT_AY_CH_C_TP_HIGH = 0x00;
    private static final int DEFAULT_AY_NOISE_TP = 0x00;
    private static final int DEFAULT_AY_MIXER = 0xb8;
    private static final int DEFAULT_AY_CH_A_VOLUME = 0x00;
    private static final int DEFAULT_AY_CH_B_VOLUME = 0x00;
    private static final int DEFAULT_AY_CH_C_VOLUME = 0x00;
    private static final int DEFAULT_AY_EP_LOW = 0x0b;
    private static final int DEFAULT_AY_EP_HIGH = 0x00;
    private static final int DEFAULT_AY_EP_CONTROL = 0x00;
    private static final int DEFAULT_SN_CH_A_TP = 0x00;
    private static final int DEFAULT_SN_CH_A_VOLUME = 0x0f;
    private static final int DEFAULT_SN_CH_B_TP = 0x00;
    private static final int DEFAULT_SN_CH_B_VOLUME = 0x0f;
    private static final int DEFAULT_SN_CH_C_TP = 0x00;
    private static final int DEFAULT_SN_CH_C_VOLUME = 0x0f;
    private static final int DEFAULT_SN_NOISE_CONTROL = 0xe0;
    private static final int DEFAULT_SN_NOISE_VOLUME = 0xff;
    private static final int DEFAULT_SN_CH_A_TP_HIGH = 0x00;
    private static final int DEFAULT_SN_CH_B_TP_HIGH = 0x00;
    private static final int DEFAULT_SN_CH_C_TP_HIGH = 0x00;
    private static final int REGISTERS = 16;
    private static final int CHANNELS = 3;
    private static final int REGISTER_MIN_VALUE = 0;
    private static final int REGISTER_MAX_VALUE = 255;
    private static final int BITS_PER_BYTE = 8;
    private static final int NOISE_TP_MASK = 0x1f;
    private static final int MIXER_CH_A_TONE = 1;
    private static final int MIXER_CH_A_NOISE = 8;
    private static final int MIXER_CH_B_TONE = 2;
    private static final int MIXER_CH_B_NOISE = 16;
    private static final int MIXER_CH_C_TONE = 4;
    private static final int MIXER_CH_C_NOISE = 32;
    private static final int VOLUME_MASK = 0x0f;
    private static final int ENVELOPE_MASK = 0x10;
    private static final int CH_A = 0;
    private static final int CH_B = 1;
    private static final int CH_C = 2;
    private static final int CLOCK_BIAS = 16000;
    private static final int STEP_BIAS = 18;
    private static final int VOLUME_BIAS = 3;
    private static final short DEFAULT_AY_SEED = -1;
    private static final short DEFAULT_SN_SEED = -32768;
    private static final short UPDATE_SEED_MASK = 0x0009;
    private static final int UPDATE_SEED_RSHIFT = 3;
    private static final int UPDATE_SEED_LSHIFT = 15;
    private static final int SHORT_MASK = 0xffff;
    private static final int HALF_MASK = 0x0f;
    private static final int HALF_SHIFT = 4;
    private static final int BYTE_MSB_MASK = 0x80;
    private static final int ADDRESS_MASK = 0x07;
    private static final int VALUE_MASK = 0x3f;
    private static final int LOWER_TWO_BITS_MASK = 0x03;
    private static final short[][] VOLUME_TABLE = {
        { // DEVICE_AY_3_8910
            0x00, 0x01, 0x01, 0x02, 0x02, 0x03, 0x03, 0x04,
            0x05, 0x06, 0x07, 0x09, 0x0B, 0x0D, 0x0F, 0x12,
            0x16, 0x1A, 0x1F, 0x25, 0x2D, 0x35, 0x3F, 0x4C,
            0x5A, 0x6A, 0x7F, 0x97, 0xB4, 0xD6, 0xFF, 0xFF,
        },
        { // DEVICE_YM_2149
            0x00, 0x01, 0x01, 0x02, 0x02, 0x03, 0x03, 0x04,
            0x05, 0x06, 0x07, 0x09, 0x0B, 0x0D, 0x0F, 0x12,
            0x16, 0x1A, 0x1F, 0x25, 0x2D, 0x35, 0x3F, 0x4C,
            0x5A, 0x6A, 0x7F, 0x97, 0xB4, 0xD6, 0xFF, 0xFF,
        },
        { // DEVICE_SN76489
            0xFF, 0xCB, 0xA1, 0x80, 0x65, 0x50, 0x40, 0x33,
            0x28, 0x20, 0x19, 0x14, 0x10, 0x0C, 0x0A, 0x00,
            0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00,
            0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00,
        },
    };
    private static final int[] NOISE_TP_TABLE = {
        128, 256, 512, 0,
    };

    private int clock = CLOCK_3_58MHZ;
    private int mode = MODE_UNSIGNED;
    private int device = DEVICE_AY_3_8910;
    private int activeRegister = 0;
    private short[] volumeTable = VOLUME_TABLE[DEVICE_AY_3_8910];
    private int baseStep = 0;
    private short[] buffer = null;
    private int[] register = new int[REGISTERS];
    private short[] volume = new short[CHANNELS];
    private boolean[] envelope = new boolean[CHANNELS];
    private boolean[] active = new boolean[CHANNELS];
    private short seed = DEFAULT_AY_SEED;
    private int[] stepTone = new int[CHANNELS];
    private int[] countTone = new int[CHANNELS];
    private boolean[] mixerTone = new boolean[CHANNELS];
    private int stepNoise = 0;
    private int countNoise = 0;
    private boolean[] mixerNoise = new boolean[CHANNELS];
    private boolean feedback = false;
    private int volumeNoise = 0;

    /**
     * Class constructor.
     */
    public PsgDeviceChannel() {
        setClock(CLOCK_3_58MHZ);
        setMode(MODE_UNSIGNED);
        setDevice(DEVICE_AY_3_8910);
    }

    /**
     * Set device clock frequency in Hz.
     * @param hz clock frequency in Hz
     */
    public void setClock(final int hz) {
        clock = hz; // tone frequency = clock / 32TP
        baseStep = (int) ((long) CLOCK_BIAS * (long) clock
                / (long) MasterChannel.SAMPLE_FREQUENCY);
    }

    /**
     * Set wave form mode.
     * Original device generates unsigned square wave,
     * but it's not match with signed PCM one.
     * Signed mode generates signed square wave aligned to center,
     * and produces double height wave form.
     * @param newMode generate signed or unsigned wave
     */
    public void setMode(final int newMode) {
        mode = newMode;
    }

    /**
     * Set SN76489 register.
     * @param address register address
     * @param valueLow lower four bits to write
     * @param valueHigh higher six bits to write
     */
    private void setRegisterSN(final int address, final int valueLow,
            final int valueHigh) {
        writeRegisterSN(0, (address << HALF_SHIFT) | valueLow);
        if ((address == REGISTER_SN_CH_A_TP)
                || (address == REGISTER_SN_CH_B_TP)
                || (address == REGISTER_SN_CH_C_TP)) {
            writeRegisterSN(0, valueHigh);
        }

    }

    /**
     * Initialize SN76489 registers.
     */
    private void initRegisterSN() {
        setRegisterSN(REGISTER_SN_CH_A_TP, DEFAULT_SN_CH_A_TP,
                DEFAULT_SN_CH_A_TP_HIGH);
        setRegisterSN(REGISTER_SN_CH_A_VOLUME, DEFAULT_SN_CH_A_VOLUME, 0);
        setRegisterSN(REGISTER_SN_CH_B_TP, DEFAULT_SN_CH_B_TP,
                DEFAULT_SN_CH_B_TP_HIGH);
        setRegisterSN(REGISTER_SN_CH_B_VOLUME, DEFAULT_SN_CH_B_VOLUME, 0);
        setRegisterSN(REGISTER_SN_CH_C_TP, DEFAULT_SN_CH_C_TP,
                DEFAULT_SN_CH_C_TP_HIGH);
        setRegisterSN(REGISTER_SN_CH_C_VOLUME, DEFAULT_SN_CH_C_VOLUME, 0);
        setRegisterSN(REGISTER_SN_NOISE_CONTROL, DEFAULT_SN_NOISE_CONTROL, 0);
        setRegisterSN(REGISTER_SN_NOISE_VOLUME, DEFAULT_SN_NOISE_VOLUME, 0);
        activeRegister = 0;
        seed = DEFAULT_SN_SEED;
    }

    /**
     * Initialize AY-3-8910 and YM-2419 registers.
     */
    private void initRegisterAY() {
        writeRegister(REGISTER_AY_CH_A_TP_HIGH, DEFAULT_AY_CH_A_TP_HIGH);
        writeRegister(REGISTER_AY_CH_A_TP_LOW, DEFAULT_AY_CH_A_TP_LOW);
        writeRegister(REGISTER_AY_CH_B_TP_HIGH, DEFAULT_AY_CH_B_TP_HIGH);
        writeRegister(REGISTER_AY_CH_B_TP_LOW, DEFAULT_AY_CH_B_TP_LOW);
        writeRegister(REGISTER_AY_CH_C_TP_HIGH, DEFAULT_AY_CH_C_TP_HIGH);
        writeRegister(REGISTER_AY_CH_C_TP_LOW, DEFAULT_AY_CH_C_TP_LOW);
        writeRegister(REGISTER_AY_NOISE_TP, DEFAULT_AY_NOISE_TP);
        writeRegister(REGISTER_AY_MIXER, DEFAULT_AY_MIXER);
        writeRegister(REGISTER_AY_CH_A_VOLUME, DEFAULT_AY_CH_A_VOLUME);
        writeRegister(REGISTER_AY_CH_B_VOLUME, DEFAULT_AY_CH_B_VOLUME);
        writeRegister(REGISTER_AY_CH_C_VOLUME, DEFAULT_AY_CH_C_VOLUME);
        writeRegister(REGISTER_AY_EP_LOW, DEFAULT_AY_EP_LOW);
        writeRegister(REGISTER_AY_EP_HIGH, DEFAULT_AY_EP_HIGH);
        writeRegister(REGISTER_AY_EP_CONTROL, DEFAULT_AY_EP_CONTROL);
        seed = DEFAULT_AY_SEED;
    }

    /**
     * Set emulated device target.
     * @param target target device
     */
    public void setDevice(final int target) {
        device = target;
        volumeTable = VOLUME_TABLE[target];
        for (int i = 0; i < CHANNELS; i++) {
            active[i] = true;
            countTone[i] = 0;
        }
        if (device == DEVICE_SN76489) {
            initRegisterSN();
        } else {
            initRegisterAY();
        }
    }

    /**
     * @see Channel
     * @param length buffer length or size in shorts
     */
    public void setBufferLength(final int length) {
        buffer = new short[length];
    }

    /**
     * @see Channel
     * @return audio stream buffer
     */
    public short[] getBuffer() {
        return buffer;
    }

    /**
     * Generate specified length sound stream into internal buffer
     * of SN76489.
     * @see generate
     * @param length sound length in short to generate
     */
    private void generateSN(final int length) {
        final int step;
        if (0 == stepNoise) {
            step = stepTone[CH_C];
        } else {
            step = stepNoise;
        }
        for (int offset = 0; offset < length; offset += 2) {
            short value = 0;
            for (int channel = 0; channel < CHANNELS; channel++) {
                countTone[channel] += baseStep;
                if (countTone[channel] > stepTone[channel]) {
                    countTone[channel] -= stepTone[channel];
                    active[channel] = !active[channel];
                }
                if (active[channel]) {
                    value += volume[channel];
                } else if (mode == MODE_SIGNED) {
                    value -= volume[channel];
                }
            }
            countNoise += baseStep;
            if (countNoise > step) {
                if (feedback) {
                    short v = (short) (seed & UPDATE_SEED_MASK);
                    v ^= (v >>> UPDATE_SEED_RSHIFT);
                    seed = (short) (((int) seed & SHORT_MASK) >> 1);
                    seed |= ((v << UPDATE_SEED_LSHIFT) & SHORT_MASK);
                } else {
                    seed = (short) (((int) seed & SHORT_MASK) >> 1);
                    seed |= ((seed << UPDATE_SEED_LSHIFT) & SHORT_MASK);
                }
            }
            if (0 != (seed & 1)) {
                value += volumeNoise;
            } else if (mode == MODE_SIGNED) {
                value -= volumeNoise;
            }
            buffer[offset + 0] = value;
            buffer[offset + 1] = value;
        }
    }

    /**
     * Generate specified length sound stream into internal buffer
     * of AY-3-8910 or YM-2149.
     * @see generate
     * @param length sound length in short to generate
     */
    private void generateAY(final int length) {
        for (int offset = 0; offset < length; offset += 2) {
            countNoise += baseStep;
            if (countNoise > stepNoise) {
                short v = (short) (seed & UPDATE_SEED_MASK);
                v ^= (v >>> UPDATE_SEED_RSHIFT);
                seed = (short) (((int) seed & SHORT_MASK) >> 1);
                seed |= ((v << UPDATE_SEED_LSHIFT) & SHORT_MASK);
                countNoise -= stepNoise;
            }
            short value = 0;
            boolean noise = 0 != (seed & 1);
            for (int channel = 0; channel < CHANNELS; channel++) {
                countTone[channel] += baseStep;
                if (countTone[channel] > stepTone[channel]) {
                    countTone[channel] -= stepTone[channel];
                    active[channel] = !active[channel];
                }
                if ((mixerTone[channel] && active[channel])
                        || (mixerNoise[channel] && noise)) {
                    value += volume[channel];
                } else if (mixerTone[channel]
                                     && mixerNoise[channel]
                                                   && mode == MODE_SIGNED) {
                    value -= volume[channel];
                }
            }
            buffer[offset + 0] = value;
            buffer[offset + 1] = value;
        }
    }

    /**
     * Generate specified length sound stream into internal buffer.
     * @see Channel
     * @param length sound length in short to generate
     */
    public void generate(final int length) {
        if (device == DEVICE_SN76489) {
            generateSN(length);
        } else {
            generateAY(length);
        }
    }

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
    public void writeRegisterSN(final int address, final int value) {
        int pseudoAddress = 0;
        if (0 != (value & BYTE_MSB_MASK)) {
            // lower values is stored to register[address + 8]
            pseudoAddress = value >> HALF_SHIFT;
            register[pseudoAddress] = value & HALF_MASK;
            // set next accessed register to address
            activeRegister = pseudoAddress & ADDRESS_MASK;
        } else {
            pseudoAddress = activeRegister;
            register[pseudoAddress] = value & VALUE_MASK;
        }
        switch (pseudoAddress) {
        case REGISTER_SN_CH_A_TP:
        case REGISTER_SN_CH_A_TP_HIGH:
            stepTone[CH_A] = ((register[REGISTER_SN_CH_A_TP_HIGH] << HALF_SHIFT)
                    | register[REGISTER_SN_CH_A_TP]) << STEP_BIAS;
            break;
        case REGISTER_SN_CH_A_VOLUME:
            volume[CH_A] = (short) (volumeTable[register[pseudoAddress]]
                                                << VOLUME_BIAS);
            break;
        case REGISTER_SN_CH_B_TP:
        case REGISTER_SN_CH_B_TP_HIGH:
            stepTone[CH_B] = ((register[REGISTER_SN_CH_B_TP_HIGH] << HALF_SHIFT)
                    | register[REGISTER_SN_CH_B_TP]) << STEP_BIAS;
            break;
        case REGISTER_SN_CH_B_VOLUME:
            volume[CH_B] = (short) (volumeTable[register[pseudoAddress]]
                                                << VOLUME_BIAS);
            break;
        case REGISTER_SN_CH_C_TP:
        case REGISTER_SN_CH_C_TP_HIGH:
            stepTone[CH_C] = ((register[REGISTER_SN_CH_C_TP_HIGH] << HALF_SHIFT)
                    | register[REGISTER_SN_CH_C_TP]) << STEP_BIAS;
            break;
        case REGISTER_SN_CH_C_VOLUME:
            volume[CH_C] = (short) (volumeTable[register[pseudoAddress]]
                                                << VOLUME_BIAS);
            break;
        case REGISTER_SN_NOISE_CONTROL:
            stepNoise = NOISE_TP_TABLE[value & LOWER_TWO_BITS_MASK]
                                       << STEP_BIAS;
            feedback = 1 == (value >> 2);
            break;
        case REGISTER_SN_NOISE_VOLUME:
            volumeNoise = volumeTable[register[pseudoAddress]];
            break;
        default:
            break;
        }
    }

    /**
     * Write to AY-3-8910 or YM-2149 registers.
     * @see writeRegister
     * @param address register address to write
     * @param value register value to write
     */
    public void writeRegisterAY(final int address, final int value) {
        if ((address > REGISTERS)
                || (value < REGISTER_MIN_VALUE)
                || (REGISTER_MAX_VALUE < value)) {
            throw new IllegalArgumentException("Undefined register: "
                    + address);
        }
        register[address] = value;

        switch(address) {
        case REGISTER_AY_CH_A_TP_LOW:
        case REGISTER_AY_CH_A_TP_HIGH:
            stepTone[CH_A] = ((register[REGISTER_AY_CH_A_TP_HIGH]
                                        << BITS_PER_BYTE)
                                        | (register[REGISTER_AY_CH_A_TP_LOW]))
                                        << STEP_BIAS;
            break;
        case REGISTER_AY_CH_B_TP_LOW:
        case REGISTER_AY_CH_B_TP_HIGH:
            stepTone[CH_B] = ((register[REGISTER_AY_CH_B_TP_HIGH]
                                        << BITS_PER_BYTE)
                                        | (register[REGISTER_AY_CH_B_TP_LOW]))
                                        << STEP_BIAS;
            break;
        case REGISTER_AY_CH_C_TP_LOW:
        case REGISTER_AY_CH_C_TP_HIGH:
            stepTone[CH_C] = ((register[REGISTER_AY_CH_C_TP_HIGH]
                                        << BITS_PER_BYTE)
                                        | (register[REGISTER_AY_CH_C_TP_LOW]))
                                        << STEP_BIAS;
            break;
        case REGISTER_AY_NOISE_TP:
            stepNoise = ((value & NOISE_TP_MASK) << 1) << (STEP_BIAS + 1);
            if (stepNoise < baseStep) {
                stepNoise = baseStep;
            }
            break;
        case REGISTER_AY_MIXER:
            mixerTone[CH_A] = 0 == (value & MIXER_CH_A_TONE);
            mixerTone[CH_B] = 0 == (value & MIXER_CH_B_TONE);
            mixerTone[CH_C] = 0 == (value & MIXER_CH_C_TONE);
            mixerNoise[CH_A] = 0 == (value & MIXER_CH_A_NOISE);
            mixerNoise[CH_B] = 0 == (value & MIXER_CH_B_NOISE);
            mixerNoise[CH_C] = 0 == (value & MIXER_CH_C_NOISE);
            break;
        case REGISTER_AY_CH_A_VOLUME:
            volume[CH_A] = (short) (volumeTable[(value & VOLUME_MASK) << 1]
                                                 << VOLUME_BIAS);
            envelope[CH_A] = 0 != (value & ENVELOPE_MASK);
            break;
        case REGISTER_AY_CH_B_VOLUME:
            volume[CH_B] = (short) (volumeTable[(value & VOLUME_MASK) << 1]
                                                 << VOLUME_BIAS);
            envelope[CH_B] = 0 != (value & ENVELOPE_MASK);
            break;
        case REGISTER_AY_CH_C_VOLUME:
            volume[CH_C] = (short) (volumeTable[(value & VOLUME_MASK) << 1]
                                                 << VOLUME_BIAS);
            envelope[CH_C] = 0 != (value & ENVELOPE_MASK);
            break;
        case REGISTER_AY_EP_LOW:
            // TODO
            break;
        case REGISTER_AY_EP_HIGH:
            // TODO
            break;
        case REGISTER_AY_EP_CONTROL:
            // TODO
            break;
        case REGISTER_AY_IO_A:
            break;
        case REGISTER_AY_IO_B:
            break;
        default:
            break;
        }
    }

    /**
     * @see Device
     * @param address register address to write
     * @param value register value to write
     */
    public void writeRegister(final int address, final int value) {
        if (device == DEVICE_SN76489) {
            writeRegisterSN(address, value);
        } else {
            writeRegisterAY(address, value);
        }
    }

    /**
     * @see Device
     * @param address register address to read
     * @return read register value
     */
    public int readRegister(final int address) {
        if (address > REGISTERS) {
            throw new IllegalArgumentException("Undefined register: "
                    + address);
        }
        return register[address];
    }
}
