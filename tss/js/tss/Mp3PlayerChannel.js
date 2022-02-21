/**
 * T'SoundSystem for JavaScript
 */

/**
 * Mp3PlayerChannel prototype
 *
 * Play mp3 format files.
 * @author Takashi Toyoshima <toyoshim@gmail.com>
 */
var Mp3PlayerChannel = function () {
    this.input = null;
    this.byteOffset = 0;
    this.bitOffset = 0;
    this.buffer = null;
    this.header = null;
    this.audio = null;
    this.sampleRate = MasterChannel.DEFAULT_SAMPLE_FREQUENCY;
}

Mp3PlayerChannel.SYNCWORD = 0xfff;
Mp3PlayerChannel.ID = 1;
Mp3PlayerChannel.LAYER = [
    "reserved",
    "Layer III",
    "Layer II",
    "Layer I"
];
Mp3PlayerChannel.LAYER3 = 1;
Mp3PlayerChannel.BIT_RATE_3 = [
    0, 32, 40, 48, 56, 64, 80, 96, 112, 128, 160, 192, 224, 256, 320, 0
];
Mp3PlayerChannel.SAMPLING_FREQUENCY = [
    44100, 48000, 32000, 0
];
Mp3PlayerChannel.MODE = [
    "stereo",
    "joint stereo",
    "dual channel",
    "single channel"
];
Mp3PlayerChannel.MODE_STEREO = 0;
Mp3PlayerChannel.MODE_JOINT_STEREO = 1;
Mp3PlayerChannel.MODE_DUAL_CHANNEL = 2;
Mp3PlayerChannel.MODE_SINGLE_CHANNEL = 3;
Mp3PlayerChannel.MODE_EX_MS_STEREO = 1;
Mp3PlayerChannel.MODE_EX_INTENSITY_STEREO = 2;
Mp3PlayerChannel.EMPHASIS = [
    "no emphasis",
    "50/15 microsec. emphasis",
    "reserved",
    "CCITT J.17"
];

/**
 * @see MasterChannel
 * @param length buffer length or size in shorts
 */
Mp3PlayerChannel.prototype.setBufferLength = function (length) {
    this.buffer = new Int32Array(length);
};

/**
 * @see MasterChannel
 * @param rate sample rate
 */
Mp3PlayerChannel.prototype.setSampleRate = function (rate) {
    this.sampleRate = rate;
};

/**
 * @see MasterChannel
 * @return audio stream buffer
 */
Mp3PlayerChannel.prototype.getBuffer = function () {
    return this.buffer;
};

/**
 * Generate specified length sound stream into internal buffer.
 * @see MasterChannel
 * @param length sound length in short to generate
 */
Mp3PlayerChannel.prototype.generate = function (length) {
};

/**
 * Read data from bit stream.
 * @param bits bit width to read
 * @return read data
 * @throw RangeError end of data
 */
Mp3PlayerChannel.prototype._readBits = function (bits) {
    var result = 0;
    while (bits > 0) {
        var restBits = 8 - this.bitOffset;
        if (bits < restBits) {
            var mask = 0xff >> (8 - bits);
            result <<= bits;
            var byteData = this.input[this.byteOffset];
            result += (byteData >> (restBits - bits)) & mask;
            this.bitOffset += bits;
            bits = 0;
        } else {
            var mask = 0xff >> (8 - restBits);
            result <<= restBits;
            result += this.input[this.byteOffset] & mask;
            this.bitOffset = 0;
            this.byteOffset++;
            bits -= restBits;
        }
        if (this.byteOffset >= this.input.byteLength) {
              throw RangeError("End of data");
        }
    }
    return result;
};

/**
 * Compare header object
 * @param a an object
 * @param b an object
 * @return true if a and b are equal
 */
Mp3PlayerChannel.prototype._areEqualHeader = function (a, b) {
    if ((null == a) || (null == b)) {
        return false;
    }
    return (a.syncword == b.syncword) &&
            (a.ID == b.ID) &&
            (a.layer == b.layer) &&
            (a.protection_bit == b.protection_bit) &&
            (a.bitrate_index == b.bitrate_index) &&
            (a.sampling_frequency == b.sampling_frequency) &&
            (a.padding_bit == b.padding_bit) &&
            (a.private_bit == b.private_bit) &&
            (a.mode == b.mode) &&
            (a.mode_extension == b.mode_extension) &&
            (a.copyright == b.copyright) &&
            (a.original == b.original) &&
            (a.emphasis == b.emphasis);
};

/**
 * Read mp3 header of current frame
 * @throw RangeError end of data
 * @throw ReferenceError invalid frame
 * @throw InternalError format is not supported
 */
Mp3PlayerChannel.prototype._readHeader = function () {
    Log.getLog().info("MP3: analyzing header...");
    try {
        var syncword = this._readBits(12);
    } catch (e) {
        throw e;
    }
    try {
        var header = {
            syncword: syncword,
            ID: this._readBits(1),
            layer: this._readBits(2),
            protection_bit: this._readBits(1),
            bitrate_index: this._readBits(4),
            sampling_frequency: this._readBits(2),
            padding_bit: this._readBits(1),
            private_bit: this._readBits(1),
            mode: this._readBits(2),
            mode_extension: this._readBits(2),
            copyright: this._readBits(1),
            original: this._readBits(1),
            emphasis: this._readBits(2)
        };
        if (0 == header.protection_bit) {
            // CRC Check
            // TODO: Check CRC.
            header.crc_check = this._readBits(16);
        }
    } catch (e) {
        throw ReferenceError("Incomplete header");
    }
    if (this._areEqualHeader(this.header, header)) {
        return;
    }
    this.header = header;
    Log.getLog().info(this.header);
    if ((this.header.syncword != Mp3PlayerChannel.SYNCWORD) ||
            (this.header.ID != Mp3PlayerChannel.ID) ||
            this.header.private_bit) {
        throw ReferenceError("Header sync error");
    }
    Log.getLog().info("MP3: MPEG audio " +
            Mp3PlayerChannel.LAYER[this.header.layer]);
    if (this.header.layer != Mp3PlayerChannel.LAYER3) {
        throw InternalError("Not supported");
    }
    Log.getLog().info("MP3: " +
            Mp3PlayerChannel.BIT_RATE_3[this.header.bitrate_index] +
            " kbps");
    Log.getLog().info("MP3: " +
            Mp3PlayerChannel.SAMPLING_FREQUENCY[
                this.header.sampling_frequency] +
            " Hz");
    Log.getLog().info("MP3: " +
            Mp3PlayerChannel.MODE[this.header.mode]);
    if (this.header.mode_extension &
            Mp3PlayerChannel.MODE_EX_INTENSITY_STEREO) {
        Log.getLog().info("MP3: intensity stereo");
    }
    if (this.header.mode_extension &
            Mp3PlayerChannel.MODE_EX_MS_STEREO) {
        Log.getLog().info("MP3: ms stereo");
    }
    Log.getLog().info("MP3: " +
            Mp3PlayerChannel.EMPHASIS[this.header.emphasis]);
};

/**
 * Decode mp3 Layer III audio data
 * @return success or not
 */
Mp3PlayerChannel.prototype._readLayer3 = function () {
    Log.getLog().info("MP3: decoding audio data...");
    if (Mp3PlayerChannel.MODE_STEREO != this.header.mode) {
        Log.getLog().error("MP3: " +
                Mp3PlayerChannel.EMPHASIS[this.header.emphasis] +
                " mode is not supported");
        return false;
    } else {
        this.audio = {
            main_data_end: this._readBits(9),
            private_bits: this._readBits(3),
            scfsi: [],
            part2_3_length: [],
            big_values: [],
            global_gain: [],
            scalefac_compress: [],
            blocksplit_flag: [],
            block_type: [],
            switch_point: [],
            table_select: [],
            subblock_gain: [],
            region_address1: [],
            region_address2: [],
            preflag: [],
            scalefac_scale: [],
            count1table_select: [],
            scalefac: []
        };
        var ch;
        var band;
        for (ch = 0; ch < 2; ch++) {
            this.audio.scfsi[ch] = [];
            for (band = 0; band < 4; band++) {
                this.audio.scfsi[ch][band] = this._readBits(1);
            }
        }
        var gr;
        var region;
        var win;
        for (gr = 0; gr < 2; gr++) {
            this.audio.part2_3_length[gr] = [];
            this.audio.big_values[gr] = [];
            this.audio.global_gain[gr] = [];
            this.audio.scalefac_compress[gr] = [];
            this.audio.blocksplit_flag[gr] = [];
            this.audio.block_type[gr] = [];
            this.audio.switch_point[gr] = [];
            this.audio.table_select[gr] = [];
            this.audio.subblock_gain[gr] = [];
            this.audio.region_address1[gr] = [];
            this.audio.region_address2[gr] = [];
            this.audio.preflag[gr] = [];
            this.audio.scalefac_scale[gr] = [];
            this.audio.count1table_select[gr] = [];
            for (ch = 0; ch < 2; ch++) {
                this.audio.part2_3_length[gr][ch] = this._readBits(12);
                this.audio.big_values[gr][ch] = this._readBits(9);
                this.audio.global_gain[gr][ch] = this._readBits(8);
                this.audio.scalefac_compress[gr][ch] = this._readBits(4);
                this.audio.blocksplit_flag[gr][ch] = this._readBits(1);
                if (this.audio.blocksplit_flag[gr][ch]) {
                    this.audio.block_type[gr][ch] = this._readBits(2);
                    this.audio.switch_point[gr][ch] = this._readBits(1);
                    this.audio.table_select[gr][ch] = [];
                    for (region = 0; region < 2; region++) {
                        this.audio.table_select[gr][ch][region] =
                                this._readBits(5);
                        this.audio.subblock_gain[gr][ch][win] =
                                this._readBits(3);
                    }
                } else {
                    this.audio.table_select[gr][ch] = [];
                    for (region = 0; region < 2; region++) {
                        this.audio.table_select[gr][ch][region] =
                                this._readBits(5);
                    }
                    this.audio.region_address1[gr][ch] = this._readBits(4);
                    this.audio.region_address2[gr][ch] = this._readBits(3);
                }
                this.audio.preflag[gr][ch] = this._readBits(1);
                this.audio.scalefac_scale[gr][ch] = this._readBits(1);
                this.audio.count1table_select[gr][ch] = this._readBits(1);
            }
        }
        Log.getLog().info(this.audio);
    }
    return true;
};

/**
 * Decode and play.
 * @param newInput ArrayBuffer to play
 * @return success or not
 */
Mp3PlayerChannel.prototype.play = function (newInput) {
    try {
        this.input = new Uint8Array(newInput);
        this.byteOffset = 0;
        this.bitOffset = 0;
        // TODO: This loop must be performed in generate()
        for (;;) {
            this._readHeader();
            var n = 144 * 1000 *
                    Mp3PlayerChannel.BIT_RATE_3[this.header.bitrate_index] /
                    Mp3PlayerChannel.SAMPLING_FREQUENCY[
                            this.header.sampling_frequency];
            n = ~~n + this.header.padding_bit;
            var nextOffset = this.byteOffset + n - 4;
            //this._readLayer3();
            this.byteOffset = nextOffset;
        }
        /*
        if (!this._readHeader()) {
            return false;
        }
        return this._readLayer3();
        */
    } catch (e) {
        Log.getLog().error(e);
        return false;
    }
    return true;
};
