/**
 * T'SoundSystem for JavaScript
 */

/**
 * TString prototype
 *
 * Contain string in UTF-8 and performs various functions around string
 * processing.
 * @author Takashi Toyoshima <toyoshim@gmail.com>
 *
 * @constructor
 */
var TString = function () {
    this.object = null;
}

TString.CODE_NUL = 0x00;
TString.CODE_HT = 0x09;
TString.CODE_LF = 0x0a;
TString.CODE_CR = 0x0d;
TString.CODE_SP = 0x20;
TString.CODE_0 = 0x30;
TString.CODE_9 = 0x39;
TString.CODE_A = 0x41;
TString.CODE_Z = 0x5a;
TString.CODE_a = 0x61;
TString.CODE_z = 0x7a;

/**
 * Check if the specified code is BMP.
 * @param code character code in UTF-16
 * @return return true if the code is BMP
 */
TString._isBMP = function (code) {
    if ((code < 0) || (0x10000 <= code))
        return false;
    if (code < 0xd800)
        return true;
    if (code >= 0xe000)
        return true;
    return false;
};

/**
 * Check if the specified code is the first code of surroage pair.
 * @param code character code in UTF-16
 * @return return true if the code is the first code of surrogate pair
 */
TString._isHighSurrogates = function (code) {
    if ((0xd800 <= code) && (code < 0xdc00))
        return true;
    return false;
};

/**
 * Check if the specified code is the second code of surroage pair.
 * @param code character code in UTF-16
 * @return return true if the code is the second code of surrogate pair
 */
TString._isLowSurrogates = function (code) {
    if ((0xdc00 <= code) && (code < 0xe000))
        return true;
    return false;
};

/**
 * Decode UTF-16 surrogate pair and return UCS-2 code.
 * @param first the first code of a pair
 * @param second the second code of a pair
 * @return UCS-2 code
 * @throws RangeError when the specified code pair is an invalid sarrogate pair
 */
TString._decodeSurrogatePair = function (first, second) {
    if (!TString._isHighSurrogates(first) ||
            !TString._isLowSurrogates(second))
        throw new RangeError("TString: invalid surrogate pair (" + first +
                ", " + second + ")");
    var w = (first >> 6) & 0xf;
    var u = w + 1;
    var x = ((first & 0x3f) << 10) | (second & 0x3ff);
    var i32 = (u << 16) + x;
    if (i32 < 0)
        return 0x100000000 + i32;
    return i32;
};

/**
 * Calculate code size in UTF-8.
 * @param code UCS-2 code
 * @return size in bytes
 */
TString._bytesInUTF8 = function (code) {
    if (code < 0)
        throw new RangeError("TString: invalid UCS-2 code " + code);
    if (code < 0x80)
        return 1;
    if (code < 0x800)
        return 2;
    if (code < 0x10000)
        return 3;
    if (code < 0x200000)
        return 4;
    if (code < 0x4000000)
        return 5;
    if (code < 0x80000000)
        return 6;
    throw new RangeError("TString: invalid UCS-2 code " + code)
};

/**
 * Count UCS-2 string length in UTF-8 bytes.
 * @param string string object to count
 */
TString._countString = function (string) {
    var length = 0;
    for (var i = 0; i < string.length; i++) {
        var code = string.charCodeAt(i);
        if (!TString._isBMP(code)) {
            if (++i >= string.length)
                throw new RangeError("TString: invalid surrogate pair");
            code = TString._decodeSurrogatePair(code, string.charCodeAt(i));
        }
        length += TString._bytesInUTF8(code);
    }
    return length;
};

/**
 * Set UCS2 code to Uint8Array in UTF-8.
 * @param array Uint8Array where store UTF-8 codes
 * @param offset offset in array where store UTF-8 codes
 * @param code code to be stored
 */
TString._setUcs2 = function (array, offset, code) {
    if (code < 0)
        throw new RangeError("TString: invalid UCS-2 code " + code);
    if (code < 0x80) {  // 7bit
        array[offset] = code;  // 7bit
        return 1;
    }
    if (code < 0x800) {  // 11bit
        array[offset + 0] = 0xc0 | (code >> 6);  // 5bit
        array[offset + 1] = 0x80 | (code & 0x3f);  // 6bit
        return 2;
    }
    if (code < 0x10000) {  // 16bit
        array[offset + 0] = 0xe0 | (code >> 12); // 4bit
        array[offset + 1] = 0x80 | ((code >> 6) & 0x3f);  // 6bit
        array[offset + 2] = 0x80 | (code & 0x3f);  // 6bit
        return 3;
    }
    if (code < 0x200000) {  // 21bit
        array[offset + 0] = 0xf0 | (code >> 18); // 3bit
        array[offset + 1] = 0x80 | ((code >> 12) & 0x3f); // 6bit
        array[offset + 2] = 0x80 | ((code >> 6) & 0x3f);  // 6bit
        array[offset + 3] = 0x80 | (code & 0x3f);  // 6bit
        return 4;
    }
    if (code < 0x4000000) {  // 26bit
        array[offset + 0] = 0xf8 | (code >> 24); // 2bit
        array[offset + 1] = 0x80 | ((code >> 18) & 0x3f); // 6bit
        array[offset + 2] = 0x80 | ((code >> 12) & 0x3f); // 6bit
        array[offset + 3] = 0x80 | ((code >> 6) & 0x3f);  // 6bit
        array[offset + 4] = 0x80 | (code & 0x3f);  // 6bit
        return 5;
    }
    if (code < 0x80000000) {  // 31bit
        array[offset + 0] = 0xfc | (code >> 30); // 1bit
        array[offset + 1] = 0x80 | ((code >> 24) & 0x3f); // 6bit
        array[offset + 2] = 0x80 | ((code >> 18) & 0x3f); // 6bit
        array[offset + 3] = 0x80 | ((code >> 12) & 0x3f); // 6bit
        array[offset + 4] = 0x80 | ((code >> 6) & 0x3f);  // 6bit
        array[offset + 5] = 0x80 | (code & 0x3f);  // 6bit
        return 6;
    }
    throw new RangeError("TString: invalid UCS-2 code " + code)
};

/**
 * Build Uint8ArrayString in UTF-8 from string.
 * @param string string object to convert
 */
TString._buildUint8ArrayString = function (string) {
    var size = TString._countString(string);
    var array = new Uint8Array(size);
    var offset = 0;
    for (var i = 0; i < string.length; i++) {
        var code = string.charCodeAt(i);
        if (!TString._isBMP(code)) {
            if (++i >= string.length)
                throw new RangeError("TString: invalid surrogate pair");
            code = TString._decodeSurrogatePair(code, string.charCodeAt(i));
        }
        offset += TString._setUcs2(array, offset, code);
    }
    return array;
};

/**
 * Create TString object from string object.
 * @param string string object
 */
TString.createFromString = function (string) {
    var s = new TString();
    s._fromString(string);
    return s;
};

/**
 * Create TString object from Uint8Array object.
 * This TString object will share the original object.
 * @param array Uint8Array object
 */
TString.createFromUint8Array = function (array) {
    var s = new TString();
    s._fromUint8Array(array);
    return s;
};

/**
 * Contain string object as a internal string. string must be in UTF-16.
 * @param string string object.
 */
TString.prototype._fromString = function (string) {
    this.object = TString._buildUint8ArrayString(string);
};

/**
 * Contain Uint8Array object as a internal string. Uint8Array must be in
 * UTF-8.
 * @param array
 */
TString.prototype._fromUint8Array = function (array) {
    this.object = array;
};

/**
 * Get a byte code from the internal UTF-8 byte array.
 * @param offset offset
 * @return code
 * @throws RangeError when offset is out of range
 */
TString.prototype.at = function (offset) {
    if (offset >= this.object.byteLength)
        throw new RangeError("TString: offset is out of range");
    return this.object[offset];
};

/**
 * Get string from the internal UTF-8 byte array.
 * @param offset offset
 * @return character
 * @throws RangeError when offset is out of range
 */
TString.prototype.charAt = function (offset) {
    return String.fromCharCode(this.at(offset));
};

/**
 * Get lower string from the internal UTF-8 byte array.
 * @param offset offset
 * @return character
 * @throws RangeError when offset is out of range
 */
TString.prototype.lowerCharAt = function (offset) {
    var code = this.at(offset);
    if ((TString.CODE_A <= code) && (code <= TString.CODE_Z))
        code |= 0x20;
    return String.fromCharCode(code);
};

/**
 * Get number from the interrnal UTF-8 byte array.
 * @param offset offset
 * @return the number if the code is number, otherwise -1
 */
TString.prototype.numberAt = function (offset) {
    if (!this.isNumber(offset))
        return -1;
    return this.object[offset] - TString.CODE_0;
};

/**
 * Set a bytes code to the internal UTF-8 byte array.
 * @param offset offset
 * @param code code
 * @throws RangeError when offset is out of range
 */
TString.prototype.setAt = function (offset, code) {
    if (offset >= this.object.byteLength)
        throw new RangeError("TString: offset is out of range");
    this.object[offset] = code;
};

/**
 * Set a character to the internal UTF-8 byte array.
 * @param offset offset
 * @param ch character
 * @throws RangeError when offset is out of range
 */
TString.prototype.setCharAt = function (offset, ch) {
    this.setAt(offset, ch.charCodeAt(0));
};

/**
 * Set a ASCII string to the internal UTF-8 byte array.
 * @param offset offset
 * @param string ASCII string
 * @throws RangeError when offset is out of range
 */
TString.prototype.setASCII = function (offset, string) {
    for (var i = 0; i < string.length; i++)
        this.setAt(offset + i, string.charCodeAt(i));
    this.setAt(offset + string.length, 0);
    return offset + string.length + 1;
};

/**
 * Set a TString to the internal UTF-8 byte array.
 * @param offset offset
 * @param string TString
 * @throws RangeError when offset is out of range
 */
TString.prototype.setTString = function (offset, string) {
    for (var i = 0; i < string.byteLength(); i++)
        this.setAt(offset + i, string.at(i));
    this.setAt(offset + string.byteLength(), 0);
    return offset + string.byteLength() + 1;
};

/**
 * Set a number to the internal UTF-8 byte array as Uint16.
 * @param offset offset
 * @param n Uint16 number
 * @throws RangeError when offset is out of range
 */
TString.prototype.setUint16 = function (offset, n) {
    this.setAt(offset, n >> 8);
    this.setAt(offset + 1, n & 0xff);
    return offset + 2;
};

/**
 * Set a number to the internal UTF-8 byte array as Uint32.
 * @param offset offset
 * @param n Uint32 number
 * @throws RangeError when offset is out of range
 */
TString.prototype.setUint32 = function (offset, n) {
    this.setAt(offset, n >> 24);
    this.setAt(offset + 1, (n >> 16) & 0xff);
    this.setAt(offset + 2, (n >> 8) & 0xff);
    this.setAt(offset + 3, n & 0xff);
    return offset + 4;
};

/**
 * Get the interrnal UTF-8 byte array length.
 * @return length
 */
TString.prototype.byteLength = function () {
    return this.object.length;
};

/**
 * Duplicate a part of this object.
 * @param begin start offset
 * @param end end offset (start + size)
 */
TString.prototype.slice = function (begin, end) {
    return TString.createFromUint8Array(this.object.subarray(begin, end));
};

/**
 * Check if this object contains the specified string from offset.
 * @param offset start offset of the interrnal UTF-8 byte array
 * @param string string to be checked
 * @return true if the internal array contains specified data
 */
TString.prototype.containString = function (offset, string) {
    var t = TString.createFromString(string);
    return this.containUint8Array(offset, t.object);
};

/**
 * Check if this object contains the specified byte sequence from offset.
 * @param offset start offset of the internal UTF-8 byte array
 * @param array Uint8Array object containing byte sequence to be checked
 * @return true if the internal array contains specified data
 */
TString.prototype.containUint8Array = function (offset, array) {
    for (var i = 0; i < array.length; i++)
        if (this.object[offset + i] != array[i])
            return false;
    return true;
};

/**
 * Check if this object contains the specified ASCII string from offset.
 * The string must contain character in the range of 0x00 to 0x7f.
 * @param offset start offset of the internal UTF-8 byte array
 * @param ascii ASCII string to be checked
 * @return true if the internal array contains specified data
 */
TString.prototype.containASCII = function (offset, ascii) {
    for (var i = 0; i < ascii.length; i++)
        if (this.object[offset + i] != ascii.charCodeAt(i))
            return false;
    return true;
};

/**
 * Count line size in bytes except for line delimiter.
 * @param offset start offset
 */
TString.prototype.countLine = function (offset) {
    var count = 0;
    for (var i = offset; i < this.object.length; i++) {
        var c = this.object[i];
        if ((TString.CODE_CR == c)|| (TString.CODE_LF == c))
            break;
        count++;
    }
    return count;
};

/**
 * Count line delimiter size.
 * @param offset start offset
 */
TString.prototype.countLineDelimiter = function (offset) {
    if (offset >= this.object.length)
        return 0;
    var count = 0;
    var c = this.object[offset++];
    if (TString.CODE_CR == c) {
        if (offset == this.object.length)
            return 1;
        count++;
        c = this.object[offset];
    }
    if (TString.CODE_LF == c)
        count++;
    return count;
};

/**
 * Count white saces.
 * @param offset start offset
 * @return number of spaces
 */
TString.prototype.countSpaces = function (offset) {
    var n = 0;
    for (var i = offset; i < this.object.length; i++) {
        var c = this.object[i];
        if ((TString.CODE_NUL != c) && (TString.CODE_HT != c) &&
                (TString.CODE_SP != c))
            break;
        n++;
    }
    return n;
};

/**
 * Return an alphabetical order position from 'a' or 'A' of character in
 * offset if it is alphabet. Otherwise return -1.
 * @param offset offset
 * @return an alphabetical order position from 'a' or 'A', or -1.
 */
TString.prototype.alphabetIndex = function (offset) {
    var c = this.object[offset];
    if ((TString.CODE_A <= c) && (c <= TString.CODE_Z))
        return c - TString.CODE_A;
    else if ((TString.CODE_a <= c) && (c <= TString.CODE_z))
        return c - TString.CODE_a;
    return -1;
};

/**
 * Check if the code in position of offset is a character for a number.
 * @param offset offset
 * @return true if the code is a character for a number.
 */
TString.prototype.isNumber = function (offset) {
    if (offset >= this.object.byteLength)
        return false;
    var c = this.object[offset];
    if ((c < TString.CODE_0) || (TString.CODE_9 < c))
        return false;
    return true;
};

/**
 * Find code from internal UTF-8 array at offset.
 * @param offset start offset
 * @param code code to find
 * @return offset if the code is found, otherwise -1
 */
TString.prototype.find = function (offset, code) {
    for (var i = offset; i < this.object.length; i++)
        if (this.object[i] == code)
            return i;
    return -1;
};

/**
 * Create UTF-16 string object from internal UTF-8 byte array from offset.
 * @param offset start offset (default: 0)
 * @param size size in byte (default: byteLength() - offset)
 * @return UTF-16 string object
 * @throws TypeError when internal UTF-8 byte array contains invalid code
 */
TString.prototype.toString = function (offset, size) {
    if (arguments.length < 1)
        offset = 0;
    if (arguments.length < 2)
        size = this.byteLength() - offset;
    var result = "";
    var first = true;
    var length = 1;
    var value = 0;
    for (var i = 0; (i < size) && (i < this.object.length); i++) {
        var c = this.object[offset + i];
        if (first) {
            if (0 == c)
                break;
            if (c < 0x80) {
                // 1 Byte UTF-8 string
                result += String.fromCharCode(c);
                continue;
            }
            first = false;
            if (c < 0xc2) {
                // Invalid character
                throw new TypeError("TString: invalid UTF-8");
            } else if (c < 0xe0) {
                // 2 Bytes UTF-8 string
                length = 2;
                value = c & 0x1f;
            } else if (c < 0xf0) {
                // 3 Bytes UTF-8 string
                length = 3;
                value = c & 0x0f;
            } else if (c < 0xf8) {
                // 4 Bytes UTF-8 string
                length = 4;
                value = c & 0x07;
            } else if (c < 0xfc) {
                // 5 Bytes UTF-8 string
                length = 5;
                value = c & 0x03;
            } else if (c < 0xfe) {
                // 6 Bytes UTF-8 string
                length = 6;
                value = c & 0x01;
            } else {
                // Invalid character
                throw new TypeError("TString: invalid UTF-8");
            }
            length--;
        } else {
            if ((c < 0x80) || (0xbf < c)) {
                // Invalid character
                throw new TypeError("TString: invalid UTF-8");
            }
            value = (value << 6) | (c & 0x3f);
            length--;
            if (0 == length) {
                first = true;
                if ((value < 0xd800) || (0xe000 <= value)) {
                    result += String.fromCharCode(value);
                } else {
                    var u = (value >> 16) & 0x1f;
                    var w = u - 1;
                    var x = value & 0xffff;
                    result += String.fromCharCode(
                        0xd800 + (w << 6) + (x >> 10));
                    result += String.fromCharCode(0xdc00 + (x & 0x3ff));
                }
            }
        }
    }
    if(!first)
        throw new TypeError("TString: invalid UTF-8");
    return result;
};

exports.TString = TString;
