/**
 * T'SoundSystem for JavaScript
 */

/**
 * F3SampleFormat prototype
 *
 * This prototype handles sampling format used in Taito F3 system.
 * @author Takashi Toyoshima <toyoshim@gmail.com>
 */
var F3SampleFormat = function () {
    this.data = null;
    this.voice = [];
}

/**
 * Load sampling format.
 * @param data sampling ROM data (Int8Array)
 */
F3SampleFormat.prototype.load = function (data) {
    this.data = data;
    var base = 0;
    for (var offset = 1; offset < data.length; offset += 14) {
        var meta = ((data[offset + 0] << 8) & 0xff00) |
                (data[offset + 1] & 0xff);
        if (meta == 0) {
            offset &= 0xfff80000;
            offset += 0x00080000;
            base = offset;
            offset -= 13;
            continue;
        }
        var name = [];
        for (var n = 0; n < 12; ++n)
            name[n] = String.fromCharCode(data[offset + 2 + n]);
        this._loadEntry(base + meta, name.join(''));
    }
};

/**
 * Load a sampling entry from meta data.
 * @param meta sampling data meta information offset
 * @param name sound name.
 */
F3SampleFormat.prototype._loadEntry = function (meta, name) {
    var loadAddress = function (from, base) {
        // The address contains 9 bit fractional part.
        var data = 0;
        for (var offset = 0; offset < 4; ++offset) {
            data <<= 8;
            data += from[base + offset] & 0xff;
        }
        var start = (base & 0xfff80000) << 9;
        return start + data;
    };
    var acc = loadAddress(this.data, meta + 2);
    var start = loadAddress(this.data, meta + 6);
    var end = loadAddress(this.data, meta + 10);
    var flags =
            ((this.data[meta] << 8) & 0xff00) | (this.data[meta + 1] & 0xff);
    
    this.voice.push({
       'name': name,
       'flags': flags,
       'acc': acc,
       'start': start,
       'end': end
    });
};
