"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const assert_1 = __importDefault(require("assert"));
const mocha_1 = require("mocha");
const util_1 = require("../../src/common/util");
(0, mocha_1.describe)('String Padding Functions', function () {
    (0, mocha_1.it)('lpad should pad strings on the left', function () {
        assert_1.default.strictEqual((0, util_1.lpad)('5', 3), '  5');
        assert_1.default.strictEqual((0, util_1.lpad)('hello', 8), '   hello');
        assert_1.default.strictEqual((0, util_1.lpad)('x', 1), 'x');
        assert_1.default.strictEqual((0, util_1.lpad)('123', 5), '  123');
    });
    (0, mocha_1.it)('rpad should pad strings on the right', function () {
        assert_1.default.strictEqual((0, util_1.rpad)('5', 3), '5  ');
        assert_1.default.strictEqual((0, util_1.rpad)('hello', 8), 'hello   ');
        assert_1.default.strictEqual((0, util_1.rpad)('x', 1), 'x');
        assert_1.default.strictEqual((0, util_1.rpad)('123', 5), '123  ');
    });
});
(0, mocha_1.describe)('Number Conversion Functions', function () {
    (0, mocha_1.it)('hex should format numbers in hexadecimal', function () {
        assert_1.default.strictEqual((0, util_1.hex)(255), 'FF');
        assert_1.default.strictEqual((0, util_1.hex)(0), '00');
        assert_1.default.strictEqual((0, util_1.hex)(255, 4), '00FF');
        assert_1.default.strictEqual((0, util_1.hex)(65535, 4), 'FFFF');
        assert_1.default.strictEqual((0, util_1.hex)(0x12345678, 8), '12345678');
        assert_1.default.strictEqual((0, util_1.hex)(15, 2), '0F');
    });
    (0, mocha_1.it)('tobin should format numbers in binary', function () {
        assert_1.default.strictEqual((0, util_1.tobin)(0), '00000000');
        assert_1.default.strictEqual((0, util_1.tobin)(255), '11111111');
        assert_1.default.strictEqual((0, util_1.tobin)(5), '00000101');
        assert_1.default.strictEqual((0, util_1.tobin)(15, 4), '1111');
        assert_1.default.strictEqual((0, util_1.tobin)(128), '10000000');
    });
    (0, mocha_1.it)('toradix should convert to various bases', function () {
        assert_1.default.strictEqual((0, util_1.toradix)(10, 4, 16), '000A');
        assert_1.default.strictEqual((0, util_1.toradix)(255, 8, 16), '000000FF');
        assert_1.default.strictEqual((0, util_1.toradix)(7, 3, 2), '111');
        assert_1.default.strictEqual((0, util_1.toradix)(100, 4, 10), '0100');
    });
    (0, mocha_1.it)('byte2signed should convert unsigned to signed bytes', function () {
        assert_1.default.strictEqual((0, util_1.byte2signed)(0), 0);
        assert_1.default.strictEqual((0, util_1.byte2signed)(127), 127);
        assert_1.default.strictEqual((0, util_1.byte2signed)(128), -128);
        assert_1.default.strictEqual((0, util_1.byte2signed)(255), -1);
        assert_1.default.strictEqual((0, util_1.byte2signed)(200), -56);
        assert_1.default.strictEqual((0, util_1.byte2signed)(0x80), -128);
    });
});
(0, mocha_1.describe)('File Path Functions', function () {
    (0, mocha_1.it)('getFilenameForPath should extract filename from path', function () {
        assert_1.default.strictEqual((0, util_1.getFilenameForPath)('path/to/file.txt'), 'file.txt');
        assert_1.default.strictEqual((0, util_1.getFilenameForPath)('file.txt'), 'file.txt');
        assert_1.default.strictEqual((0, util_1.getFilenameForPath)('/a/b/c/d.js'), 'd.js');
        assert_1.default.strictEqual((0, util_1.getFilenameForPath)('a/b'), 'b');
    });
    (0, mocha_1.it)('getFolderForPath should extract folder from path', function () {
        assert_1.default.strictEqual((0, util_1.getFolderForPath)('path/to/file.txt'), 'path/to');
        assert_1.default.strictEqual((0, util_1.getFolderForPath)('file.txt'), '');
        assert_1.default.strictEqual((0, util_1.getFolderForPath)('/a/b/c/d.js'), '/a/b/c');
        assert_1.default.strictEqual((0, util_1.getFolderForPath)('a/b/c'), 'a/b');
    });
    (0, mocha_1.it)('getFilenamePrefix should extract name without extension', function () {
        assert_1.default.strictEqual((0, util_1.getFilenamePrefix)('file.txt'), 'file');
        assert_1.default.strictEqual((0, util_1.getFilenamePrefix)('archive.tar.gz'), 'archive.tar');
        assert_1.default.strictEqual((0, util_1.getFilenamePrefix)('noext'), 'noext');
        assert_1.default.strictEqual((0, util_1.getFilenamePrefix)('.hidden'), '.hidden');
    });
});
(0, mocha_1.describe)('Array/Collection Functions', function () {
    (0, mocha_1.it)('arrayCompare should compare arrays', function () {
        assert_1.default.ok((0, util_1.arrayCompare)([1, 2, 3], [1, 2, 3]));
        assert_1.default.ok(!(0, util_1.arrayCompare)([1, 2, 3], [1, 2, 4]));
        assert_1.default.ok(!(0, util_1.arrayCompare)([1, 2], [1, 2, 3]));
        assert_1.default.ok((0, util_1.arrayCompare)([], []));
        assert_1.default.ok(!(0, util_1.arrayCompare)([1], []));
        assert_1.default.ok((0, util_1.arrayCompare)(null, null));
        assert_1.default.ok(!(0, util_1.arrayCompare)(null, [1]));
        assert_1.default.ok(!(0, util_1.arrayCompare)([1], null));
        const arr1 = new Uint8Array([1, 2, 3]);
        const arr2 = new Uint8Array([1, 2, 3]);
        assert_1.default.ok((0, util_1.arrayCompare)(arr1, arr2));
    });
    (0, mocha_1.it)('invertMap should invert key-value pairs', function () {
        const map = { a: '1', b: '2', c: '3' };
        const inv = (0, util_1.invertMap)(map);
        assert_1.default.strictEqual(inv['1'], 'a');
        assert_1.default.strictEqual(inv['2'], 'b');
        assert_1.default.strictEqual(inv['3'], 'c');
    });
    (0, mocha_1.it)('coerceToArray should convert various types to arrays', function () {
        assert_1.default.deepStrictEqual((0, util_1.coerceToArray)([1, 2, 3]), [1, 2, 3]);
        assert_1.default.deepStrictEqual((0, util_1.coerceToArray)({ a: 1, b: 2 }), [1, 2]);
    });
});
(0, mocha_1.describe)('Byte Array Conversion Functions', function () {
    (0, mocha_1.it)('stringToByteArray should convert string to bytes', function () {
        const bytes = (0, util_1.stringToByteArray)('hello');
        assert_1.default.strictEqual(bytes.length, 5);
        assert_1.default.strictEqual(bytes[0], 104); // 'h'
        assert_1.default.strictEqual(bytes[4], 111); // 'o'
    });
    (0, mocha_1.it)('byteArrayToString should convert bytes to string', function () {
        const bytes = [72, 101, 108, 108, 111]; // "Hello"
        assert_1.default.strictEqual((0, util_1.byteArrayToString)(bytes), 'Hello');
        assert_1.default.strictEqual((0, util_1.byteArrayToString)(new Uint8Array([65, 66, 67])), 'ABC');
    });
    (0, mocha_1.it)('byteArrayToUTF8 should decode UTF-8', function () {
        const ascii = (0, util_1.byteArrayToUTF8)([72, 101, 108, 108, 111]);
        assert_1.default.strictEqual(ascii, 'Hello');
    });
    (0, mocha_1.it)('removeBOM should strip BOM if present', function () {
        assert_1.default.strictEqual((0, util_1.removeBOM)('﻿hello'), 'hello');
        assert_1.default.strictEqual((0, util_1.removeBOM)('hello'), 'hello');
    });
});
(0, mocha_1.describe)('Binary Detection', function () {
    (0, mocha_1.it)('isProbablyBinary should detect binary data', function () {
        assert_1.default.ok(!(0, util_1.isProbablyBinary)('test.txt', [104, 101, 108, 108, 111])); // "hello"
        assert_1.default.ok((0, util_1.isProbablyBinary)('test.bin', [1, 2, 3]));
        assert_1.default.ok((0, util_1.isProbablyBinary)('test.chr', [255, 255]));
        assert_1.default.ok((0, util_1.isProbablyBinary)('test.dat', [0]));
        assert_1.default.ok(!(0, util_1.isProbablyBinary)('test.c', [47, 47, 105, 102])); // "//if"
        assert_1.default.ok((0, util_1.isProbablyBinary)(null, [0, 0, 0, 0])); // null bytes
    });
});
(0, mocha_1.describe)('Color Functions', function () {
    (0, mocha_1.it)('rgb2bgr should swap red and blue channels', function () {
        assert_1.default.strictEqual((0, util_1.rgb2bgr)(0xFF0000), 0x0000FF);
        assert_1.default.strictEqual((0, util_1.rgb2bgr)(0x00FF00), 0x00FF00);
        assert_1.default.strictEqual((0, util_1.rgb2bgr)(0x0000FF), 0xFF0000);
        assert_1.default.strictEqual((0, util_1.rgb2bgr)(0xFFFFFF), 0xFFFFFF);
    });
    (0, mocha_1.it)('RGBA should create color value', function () {
        const white = (0, util_1.RGBA)(255, 255, 255);
        assert_1.default.strictEqual(white & 0xFFFFFF, 0xFFFFFF);
        const black = (0, util_1.RGBA)(0, 0, 0);
        assert_1.default.strictEqual(black & 0xFFFFFF, 0x000000);
    });
    (0, mocha_1.it)('clamp should constrain values', function () {
        assert_1.default.strictEqual((0, util_1.clamp)(0, 10, 5), 5);
        assert_1.default.strictEqual((0, util_1.clamp)(0, 10, -5), 0);
        assert_1.default.strictEqual((0, util_1.clamp)(0, 10, 15), 10);
        assert_1.default.strictEqual((0, util_1.clamp)(1, 1, 5), 1);
    });
});
(0, mocha_1.describe)('String Manipulation', function () {
    (0, mocha_1.it)('safeident should create valid identifiers', function () {
        assert_1.default.strictEqual((0, util_1.safeident)('valid_name'), 'valid_name');
        assert_1.default.strictEqual((0, util_1.safeident)('123abc'), '_123abc');
        assert_1.default.strictEqual((0, util_1.safeident)('-name'), '__name');
        assert_1.default.strictEqual((0, util_1.safeident)('name-with-dashes'), 'name_with_dashes');
        assert_1.default.strictEqual((0, util_1.safeident)('name@#$%'), 'name_');
    });
    (0, mocha_1.it)('replaceAll should replace all occurrences', function () {
        assert_1.default.strictEqual((0, util_1.replaceAll)('aaa', 'a', 'b'), 'bbb');
        assert_1.default.strictEqual((0, util_1.replaceAll)('hello world', ' ', '-'), 'hello-world');
        assert_1.default.strictEqual((0, util_1.replaceAll)('test', 'x', 'y'), 'test');
        assert_1.default.strictEqual((0, util_1.replaceAll)('', 'a', 'b'), '');
    });
    (0, mocha_1.it)('byteToASCII should convert bytes to readable chars', function () {
        assert_1.default.strictEqual((0, util_1.byteToASCII)(65), 'A');
        assert_1.default.strictEqual((0, util_1.byteToASCII)(32), ' ');
        assert_1.default.strictEqual((0, util_1.byteToASCII)(0), '␀'); // NULL control char
    });
});
(0, mocha_1.describe)('Query String Functions', function () {
    (0, mocha_1.it)('decodeQueryString should parse query parameters', function () {
        const qs1 = (0, util_1.decodeQueryString)('?key=value&foo=bar');
        assert_1.default.strictEqual(qs1['key'], 'value');
        assert_1.default.strictEqual(qs1['foo'], 'bar');
        const qs2 = (0, util_1.decodeQueryString)('a=1&b=2');
        assert_1.default.strictEqual(qs2['a'], '1');
        assert_1.default.strictEqual(qs2['b'], '2');
        const qs3 = (0, util_1.decodeQueryString)('key=value+with+spaces');
        assert_1.default.ok(qs3['key'].includes(' '));
    });
    (0, mocha_1.it)('parseBool should parse boolean strings', function () {
        assert_1.default.ok((0, util_1.parseBool)('true'));
        assert_1.default.ok((0, util_1.parseBool)('1'));
        assert_1.default.ok((0, util_1.parseBool)('yes'));
        assert_1.default.ok(!(0, util_1.parseBool)('false'));
        assert_1.default.ok(!(0, util_1.parseBool)('0'));
        assert_1.default.ok(!(0, util_1.parseBool)(''));
    });
});
(0, mocha_1.describe)('Complex Utility Functions', function () {
    (0, mocha_1.it)('findIntegerFactors should find factor pairs', function () {
        const f1 = (0, util_1.findIntegerFactors)(64, 1, 1, 1);
        assert_1.default.ok(f1.a >= f1.b);
        assert_1.default.strictEqual(f1.a * f1.b >= 64, true);
        const f2 = (0, util_1.findIntegerFactors)(100, 5, 5, 1);
        assert_1.default.ok(f2.a >= 5);
        assert_1.default.ok(f2.b >= 5);
    });
    (0, mocha_1.it)('safe_extend should copy primitive values and arrays', function () {
        const dest = { x: 1 };
        const src = { y: 2, arr: [1, 2, 3] };
        (0, util_1.safe_extend)(false, dest, src);
        assert_1.default.strictEqual(dest['x'], 1);
        assert_1.default.strictEqual(dest['y'], 2);
        assert_1.default.deepStrictEqual(dest['arr'], [1, 2, 3]);
        assert_1.default.ok(dest['arr'] !== src['arr']); // should be copy
    });
    (0, mocha_1.it)('printFlags should format flag values', function () {
        const names = ['CARRY', 'ZERO', 'IRQ_DISABLE', 'DECIMAL'];
        const result = (0, util_1.printFlags)(0x01, names, false);
        assert_1.default.ok(result.includes('CARRY'));
        const result2 = (0, util_1.printFlags)(0x00, names, false);
        assert_1.default.ok(result2.includes('-'));
    });
    (0, mocha_1.it)('highlightDifferences should mark changes in text', function () {
        const diff = (0, util_1.highlightDifferences)('hello world', 'hello there');
        assert_1.default.ok(diff.includes('hilite'));
    });
});
//# sourceMappingURL=testcommon.js.map