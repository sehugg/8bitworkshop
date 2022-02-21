/**
 * T'SoundSystem for JavaScript
 */

/**
 * PsglogPlayer prototype
 *
 * Play AY-3-8910 device control log files.
 * @author Takashi Toyoshima <toyoshim@gmail.com>
 */
var PsglogPlayer = function () {
    this.input = null;
    this.offset = 0;
    this.psg = null;
    this.sync = 0;
    this.pkt = new Uint8Array(2);
}

PsglogPlayer._PKT_REGISTER = 0;
PsglogPlayer._PKT_VALUE = 1;
PsglogPlayer._PKT_SYNC = 0xff;
PsglogPlayer._BYTE_MASK = 0xff;
PsglogPlayer._PLAYER_INTERVAL = 17;

/**
 * Set master channel to write output stream.
 * @param channel master channel
 */
PsglogPlayer.prototype.setMasterChannel = function(channel) {
    this.psg = new PsgDeviceChannel();
    this.psg.setMode(PsgDeviceChannel.MODE_SIGNED);
    this.psg.setDevice(PsgDeviceChannel.DEVICE_AY_3_8910);
    channel.clearChannel();
    channel.addChannel(this.psg);
    channel.setPlayer(this);
    channel.setPlayerInterval(PsglogPlayer._PLAYER_INTERVAL);
};

/**
 * Channel reach to periodical call back point.
 */
PsglogPlayer.prototype.updateDevice = function () {
    if (this.input == null)
        return;

    // Logged at the first callback.
    if (this.firstUpdateDevice == undefined) {
        this.firstUpdateDevice = true;
        Log.getLog().info("PsglogPlayer.updateDevice");
        Log.getLog().info(this);
    }
    if (0 != this.sync) {
        this.sync--;
        return;
    }
    do {
        if (this.input.byteLength < this.offset + 2)
            return;
        this.pkt[0] = this.input[this.offset++];
        this.pkt[1] = this.input[this.offset++];
        if (this.pkt[PsglogPlayer._PKT_REGISTER] != PsglogPlayer._PKT_SYNC) {
            this.psg.writeRegister(this.pkt[PsglogPlayer._PKT_REGISTER],
                    this.pkt[PsglogPlayer._PKT_VALUE]);
        } else {
            this.sync = this.pkt[PsglogPlayer._PKT_VALUE];
            return;
        }
    } while (true);
};

/**
 *  Decode and play.
 * @param newInput ArrayBuffer to play
 * @return success or not
 */
PsglogPlayer.prototype.play = function (newInput) {
    this.input = new Uint8Array(newInput);
    this.offset = 0;
    return true;
};
