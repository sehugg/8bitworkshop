/**
 * T'SoundSystem for JavaScript
 */

/**
 * Format prototype
 *
 * Contain data read and write functions.
 * TODO: Use this prototype from all files in the library.
 * @author Takashi Toyoshima <toyoshim@gmail.com>
 */
var Format = function () {
    this.endian = Format.BIG_ENDIAN;
};

Format.BIG_ENDIAN = 0;
Format.LITTLE_ENDIAN = 1;

Format.readI32BE = function (data, offset) {
    return (data[offset] << 24) | (data[offset + 1] << 16) |
            (data[offset + 2] << 8) | data[offset + 3];
};

Format.readU32BE = function (data, offset) {
    var i32 = Format.readI32BE(data, offset);
    if (i32 < 0)
        return 0x100000000 + i32;
    return i32;
};

Format.readI32LE = function (data, offset) {
    return data[offset] | (data[offset + 1] << 8) |
        (data[offset + 2] << 16) | (data[offset + 3] << 24);
};

Format.readU32LE = function (data, offset) {
    var i32 = Format.readI32LE(data, offset);
    if (i32 < 0)
        return 0x100000000 + i32;
    return i32;
};

Format.stringLength = function (data, offset) {
    var length = 0;
    for (var i = offset; i < data.byteLength; i++) {
        if (0 === data[offset])
            break;
        length++;
    }
    return length;
};

Format.prototype.setDefaultEndian = function (endian) {
    this.endian = endian;
};

Format.prototype.readI32 = function (data, offset) {
    if (this.endian == Format.BIG_ENDIAN)
        return Format.readI32BE(data, offset);
    return Format.readI32LE(data, offset);
};

Format.prototype.readU32 = function (data, offset) {
    if (this.endian == Format.BIG_ENDIAN)
        return Format.readU32BE(data, offset);
    return Format.readU32LE(data, offset);
};
