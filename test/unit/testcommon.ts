
import assert from "assert";
import { describe, it } from "mocha";
import {
  lpad, rpad, byte2signed, getFilenameForPath, getFolderForPath,
  getFilenamePrefix, hex, tobin, toradix, arrayCompare, invertMap,
  stringToByteArray, byteArrayToString, byteArrayToUTF8, removeBOM,
  isProbablyBinary, clamp, safeident, rgb2bgr, RGBA, findIntegerFactors,
  replaceAll, highlightDifferences, decodeQueryString, parseBool,
  safe_extend, printFlags, byteToASCII, coerceToArray
} from "../../src/common/util";

describe('String Padding Functions', function () {
  it('lpad should pad strings on the left', function () {
    assert.strictEqual(lpad('5', 3), '  5');
    assert.strictEqual(lpad('hello', 8), '   hello');
    assert.strictEqual(lpad('x', 1), 'x');
    assert.strictEqual(lpad('123', 5), '  123');
  });

  it('rpad should pad strings on the right', function () {
    assert.strictEqual(rpad('5', 3), '5  ');
    assert.strictEqual(rpad('hello', 8), 'hello   ');
    assert.strictEqual(rpad('x', 1), 'x');
    assert.strictEqual(rpad('123', 5), '123  ');
  });
});

describe('Number Conversion Functions', function () {
  it('hex should format numbers in hexadecimal', function () {
    assert.strictEqual(hex(255), 'FF');
    assert.strictEqual(hex(0), '00');
    assert.strictEqual(hex(255, 4), '00FF');
    assert.strictEqual(hex(65535, 4), 'FFFF');
    assert.strictEqual(hex(0x12345678, 8), '12345678');
    assert.strictEqual(hex(15, 2), '0F');
  });

  it('tobin should format numbers in binary', function () {
    assert.strictEqual(tobin(0), '00000000');
    assert.strictEqual(tobin(255), '11111111');
    assert.strictEqual(tobin(5), '00000101');
    assert.strictEqual(tobin(15, 4), '1111');
    assert.strictEqual(tobin(128), '10000000');
  });

  it('toradix should convert to various bases', function () {
    assert.strictEqual(toradix(10, 4, 16), '000A');
    assert.strictEqual(toradix(255, 8, 16), '000000FF');
    assert.strictEqual(toradix(7, 3, 2), '111');
    assert.strictEqual(toradix(100, 4, 10), '0100');
  });

  it('byte2signed should convert unsigned to signed bytes', function () {
    assert.strictEqual(byte2signed(0), 0);
    assert.strictEqual(byte2signed(127), 127);
    assert.strictEqual(byte2signed(128), -128);
    assert.strictEqual(byte2signed(255), -1);
    assert.strictEqual(byte2signed(200), -56);
    assert.strictEqual(byte2signed(0x80), -128);
  });
});

describe('File Path Functions', function () {
  it('getFilenameForPath should extract filename from path', function () {
    assert.strictEqual(getFilenameForPath('path/to/file.txt'), 'file.txt');
    assert.strictEqual(getFilenameForPath('file.txt'), 'file.txt');
    assert.strictEqual(getFilenameForPath('/a/b/c/d.js'), 'd.js');
    assert.strictEqual(getFilenameForPath('a/b'), 'b');
  });

  it('getFolderForPath should extract folder from path', function () {
    assert.strictEqual(getFolderForPath('path/to/file.txt'), 'path/to');
    assert.strictEqual(getFolderForPath('file.txt'), '');
    assert.strictEqual(getFolderForPath('/a/b/c/d.js'), '/a/b/c');
    assert.strictEqual(getFolderForPath('a/b/c'), 'a/b');
  });

  it('getFilenamePrefix should extract name without extension', function () {
    assert.strictEqual(getFilenamePrefix('file.txt'), 'file');
    assert.strictEqual(getFilenamePrefix('archive.tar.gz'), 'archive.tar');
    assert.strictEqual(getFilenamePrefix('noext'), 'noext');
    assert.strictEqual(getFilenamePrefix('.hidden'), '.hidden');
  });
});

describe('Array/Collection Functions', function () {
  it('arrayCompare should compare arrays', function () {
    assert.ok(arrayCompare([1, 2, 3], [1, 2, 3]));
    assert.ok(!arrayCompare([1, 2, 3], [1, 2, 4]));
    assert.ok(!arrayCompare([1, 2], [1, 2, 3]));
    assert.ok(arrayCompare([], []));
    assert.ok(!arrayCompare([1], []));
    assert.ok(arrayCompare(null, null));
    assert.ok(!arrayCompare(null, [1]));
    assert.ok(!arrayCompare([1], null));
    const arr1 = new Uint8Array([1, 2, 3]);
    const arr2 = new Uint8Array([1, 2, 3]);
    assert.ok(arrayCompare(arr1, arr2));
  });

  it('invertMap should invert key-value pairs', function () {
    const map = { a: '1', b: '2', c: '3' };
    const inv = invertMap(map);
    assert.strictEqual(inv['1'], 'a');
    assert.strictEqual(inv['2'], 'b');
    assert.strictEqual(inv['3'], 'c');
  });

  it('coerceToArray should convert various types to arrays', function () {
    assert.deepStrictEqual(coerceToArray([1, 2, 3]), [1, 2, 3]);
    assert.deepStrictEqual(coerceToArray({ a: 1, b: 2 }), [1, 2]);
  });
});

describe('Byte Array Conversion Functions', function () {
  it('stringToByteArray should convert string to bytes', function () {
    const bytes = stringToByteArray('hello');
    assert.strictEqual(bytes.length, 5);
    assert.strictEqual(bytes[0], 104); // 'h'
    assert.strictEqual(bytes[4], 111); // 'o'
  });

  it('byteArrayToString should convert bytes to string', function () {
    const bytes = [72, 101, 108, 108, 111]; // "Hello"
    assert.strictEqual(byteArrayToString(bytes), 'Hello');
    assert.strictEqual(byteArrayToString(new Uint8Array([65, 66, 67])), 'ABC');
  });

  it('byteArrayToUTF8 should decode UTF-8', function () {
    const ascii = byteArrayToUTF8([72, 101, 108, 108, 111]);
    assert.strictEqual(ascii, 'Hello');
  });

  it('removeBOM should strip BOM if present', function () {
    assert.strictEqual(removeBOM('﻿hello'), 'hello');
    assert.strictEqual(removeBOM('hello'), 'hello');
  });
});

describe('Binary Detection', function () {
  it('isProbablyBinary should detect binary data', function () {
    assert.ok(!isProbablyBinary('test.txt', [104, 101, 108, 108, 111])); // "hello"
    assert.ok(isProbablyBinary('test.bin', [1, 2, 3]));
    assert.ok(isProbablyBinary('test.chr', [255, 255]));
    assert.ok(isProbablyBinary('test.dat', [0]));
    assert.ok(!isProbablyBinary('test.c', [47, 47, 105, 102])); // "//if"
    assert.ok(isProbablyBinary(null, [0, 0, 0, 0])); // null bytes
  });
});

describe('Color Functions', function () {
  it('rgb2bgr should swap red and blue channels', function () {
    assert.strictEqual(rgb2bgr(0xFF0000), 0x0000FF);
    assert.strictEqual(rgb2bgr(0x00FF00), 0x00FF00);
    assert.strictEqual(rgb2bgr(0x0000FF), 0xFF0000);
    assert.strictEqual(rgb2bgr(0xFFFFFF), 0xFFFFFF);
  });

  it('RGBA should create color value', function () {
    const white = RGBA(255, 255, 255);
    assert.strictEqual(white & 0xFFFFFF, 0xFFFFFF);
    const black = RGBA(0, 0, 0);
    assert.strictEqual(black & 0xFFFFFF, 0x000000);
  });

  it('clamp should constrain values', function () {
    assert.strictEqual(clamp(0, 10, 5), 5);
    assert.strictEqual(clamp(0, 10, -5), 0);
    assert.strictEqual(clamp(0, 10, 15), 10);
    assert.strictEqual(clamp(1, 1, 5), 1);
  });
});

describe('String Manipulation', function () {
  it('safeident should create valid identifiers', function () {
    assert.strictEqual(safeident('valid_name'), 'valid_name');
    assert.strictEqual(safeident('123abc'), '_123abc');
    assert.strictEqual(safeident('-name'), '__name');
    assert.strictEqual(safeident('name-with-dashes'), 'name_with_dashes');
    assert.strictEqual(safeident('name@#$%'), 'name_');
  });

  it('replaceAll should replace all occurrences', function () {
    assert.strictEqual(replaceAll('aaa', 'a', 'b'), 'bbb');
    assert.strictEqual(replaceAll('hello world', ' ', '-'), 'hello-world');
    assert.strictEqual(replaceAll('test', 'x', 'y'), 'test');
    assert.strictEqual(replaceAll('', 'a', 'b'), '');
  });

  it('byteToASCII should convert bytes to readable chars', function () {
    assert.strictEqual(byteToASCII(65), 'A');
    assert.strictEqual(byteToASCII(32), ' ');
    assert.strictEqual(byteToASCII(0), '␀'); // NULL control char
  });
});

describe('Query String Functions', function () {
  it('decodeQueryString should parse query parameters', function () {
    const qs1 = decodeQueryString('?key=value&foo=bar');
    assert.strictEqual(qs1['key'], 'value');
    assert.strictEqual(qs1['foo'], 'bar');

    const qs2 = decodeQueryString('a=1&b=2');
    assert.strictEqual(qs2['a'], '1');
    assert.strictEqual(qs2['b'], '2');

    const qs3 = decodeQueryString('key=value+with+spaces');
    assert.ok(qs3['key'].includes(' '));
  });

  it('parseBool should parse boolean strings', function () {
    assert.ok(parseBool('true'));
    assert.ok(parseBool('1'));
    assert.ok(parseBool('yes'));
    assert.ok(!parseBool('false'));
    assert.ok(!parseBool('0'));
    assert.ok(!parseBool(''));
  });
});

describe('Complex Utility Functions', function () {
  it('findIntegerFactors should find factor pairs', function () {
    const f1 = findIntegerFactors(64, 1, 1, 1);
    assert.ok(f1.a >= f1.b);
    assert.strictEqual(f1.a * f1.b >= 64, true);

    const f2 = findIntegerFactors(100, 5, 5, 1);
    assert.ok(f2.a >= 5);
    assert.ok(f2.b >= 5);
  });

  it('safe_extend should copy primitive values and arrays', function () {
    const dest = { x: 1 };
    const src = { y: 2, arr: [1, 2, 3] };
    safe_extend(false, dest, src);
    assert.strictEqual(dest['x'], 1);
    assert.strictEqual(dest['y'], 2);
    assert.deepStrictEqual(dest['arr'], [1, 2, 3]);
    assert.ok(dest['arr'] !== src['arr']); // should be copy
  });

  it('printFlags should format flag values', function () {
    const names = ['CARRY', 'ZERO', 'IRQ_DISABLE', 'DECIMAL'];
    const result = printFlags(0x01, names, false);
    assert.ok(result.includes('CARRY'));
    const result2 = printFlags(0x00, names, false);
    assert.ok(result2.includes('-'));
  });

  it('highlightDifferences should mark changes in text', function () {
    const diff = highlightDifferences('hello world', 'hello there');
    assert.ok(diff.includes('hilite'));
  });
});

