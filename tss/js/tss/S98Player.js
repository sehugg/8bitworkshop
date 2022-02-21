/**
 * T'SoundSystem for JavaScript
 */

/**
 * S98Player prototype
 *
 * Play S98 format files.
 * See http://www.vesta.dti.ne.jp/~tsato/arc/s98spec3.zip
 * @author Takashi Toyoshima <toyoshim@gmail.com>
 */
var S98Player = function () {
    this.data = null;
    this.dataOffset = 0;
    this.loopOffset = 0;
    this.interval = 0.01;
    this.master = null;
    this.wait = 0;
    this.fm = null;
}

S98Player._MAGIC = [ 'S'.charCodeAt(0), '9'.charCodeAt(0), '8'.charCodeAt(0) ];
S98Player._COMMAND_DEVICE1_NORMAL = 0x00;
S98Player._COMMAND_DEVICE1_EXTEND = 0x01;
S98Player._COMMAND_END_OR_LOOP = 0xfd;
S98Player._COMMAND_N_SYNC = 0xfe;
S98Player._COMMAND_1_SYNC = 0xff;


/**
 * Set master channel to write output stream.
 * @param channel master channel
 */
S98Player.prototype.setMasterChannel = function(channel) {
    if (null != channel) {
        this.fm = new OpnDeviceChannel();
        this.fm.setClock(OpnDeviceChannel.CLOCK_PC88);
        this.fm.setDevice(OpnDeviceChannel.DEVICE_YM2203);
        channel.clearChannel();
        channel.addChannel(this.fm);
        channel.setPlayer(this);
    }
    this.master = channel;
};

/**
 * Write data to virtual devices.
 * @param device device number
 * @param address data address
 * @param value write value
 */
S98Player.prototype._write = function (device, address, value) {
    if (0 != device)
        return;
    this.fm.writeRegister(address, value);
};

/**
 * Channel reach to periodical call back point.
 */
S98Player.prototype.updateDevice = function () {
    if (this.data == null)
        return;
    this.wait--;
    while (0 == this.wait) {
        if (this.dataOffset == this.data.byteLength)
            break;
        var command = this.data[this.dataOffset++];
        var address;
        var value;
        if (S98Player._COMMAND_DEVICE1_NORMAL == command) {
            if ((this.dataOffset + 2) == this.data.byteLength)
                break;
            address = this.data[this.dataOffset++];
            value = this.data[this.dataOffset++];
            this._write(0, address, value);
        } else if (S98Player._COMMAND_DEVICE1_EXTEND == command) {
            if ((this.dataOffset + 2) == this.data.byteLength)
                break;
            address = this.data[this.dataOffset++];
            value = this.data[this.dataOffset++];
            this._write(1, address, value);
        } else if (S98Player._COMMAND_END_OR_LOOP == command) {
            if (0 == this.loopOffset)
                break;
            this.dataOffset = this.loopOffset;
        } else if (S98Player._COMMAND_N_SYNC == command) {
            var shift = 0;
            value = 0;
            while (this.dataOffset < this.data.byteLength) {
                value |= (this.data[this.dataOffset] & 0x7f) << shift;
                shift += 7;
                if (0 == (this.data[this.dataOffset++] & 0x80))
                    break;
            }
            if (this.dataOffset == this.data.byteLength)
                break;
            this.wait = value + 2;
        } else if (S98Player._COMMAND_1_SYNC == command) {
            this.wait = 1;
        } else {
            Log.getLog().error("S98: unknown command " + command);
            break;
        }
    }
    if (0 == this.wait) {
        Log.getLog().error("S98: stop because of error");
        this.data = null;
    }
};

/**
 *  Decode and play.
 * @param newInput ArrayBuffer to play
 * @return success or not
 */
S98Player.prototype.play = function (newInput) {
    var data = new Uint8Array(newInput);
    var offset = 0;
    Log.getLog().info("S98: loading...");
    if (data.byteLength < 28) {
        Log.getLog().error("S98: header size is too small");
        return false;
    }
    if ((data[0] != S98Player._MAGIC[0]) || (data[1] != S98Player._MAGIC[1]) ||
            (data[2] != S98Player._MAGIC[2])) {
        Log.getLog().error("S98: invalid header magic");
        return false;
    }
    var version = data[3] - '0'.charCodeAt(0);
    Log.getLog().info("S98: version " + version);
    if (1 != version) {
        Log.getLog().error("S98: unsupported version");
        return false;
    }
    var numerator = Format.readU32LE(data, 4);
    if (0 == numerator)
        numerator = 10;
    var denominator = Format.readU32LE(data, 8);
    if (0 == denominator)
        denominator = 1000;
    this.interval = numerator / denominator;
    Log.getLog().info("S98: timer interval " + numerator + "/" + denominator +
            " sec");
    var compressing = Format.readU32LE(data, 12);
    if (0 != compressing) {
        Log.getLog().error("S98: compression is not supported");
        return false;
    }

    // Reset data to stop playback safely.
    this.data = null;

    var nameOffset = Format.readU32LE(data, 16);
    Log.getLog().info("S98: name offset " + nameOffset);
    this.dataOffset = Format.readU32LE(data, 20);
    Log.getLog().info("S98: data offset " + this.dataOffset);
    this.loopOffset = Format.readU32LE(data, 24);
    Log.getLog().info("S98: loop offset " + this.loopOffset);

    var nameLength = Format.stringLength(data, nameOffset);
    try {
        var name = TString.createFromUint8Array(data.subarray(nameOffset,
            nameOffset + nameLength)).toString();
        Log.getLog().info("S98: title " + name);
    } catch (e) {
        Log.getLog().warn("S98: title is not in UTF-8");
    }

    if (null != this.master)
        this.master.setPlayerInterval(this.interval * 1000);

    // Set data to start playback.
    this.wait = 1;
    this.data = data;
    return true;
};
