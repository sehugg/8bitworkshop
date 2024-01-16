/*
 * Copyright (c) 2024 Steven E. Hugg
 *
 * Permission is hereby granted, free of charge, to any person obtaining a copy
 * of this software and associated documentation files (the "Software"), to deal
 * in the Software without restriction, including without limitation the rights
 * to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
 * copies of the Software, and to permit persons to whom the Software is
 * furnished to do so, subject to the following conditions:
 * 
 * The above copyright notice and this permission notice shall be included in all
 * copies or substantial portions of the Software.
 *
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
 * IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
 * FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
 * AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
 * LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
 * OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
 * SOFTWARE.
 */

import assert from "assert";
import { DWARFParser, ELFParser } from "../common/binutils";

describe('test ELFParser', () => {

    const fs = require('fs');
    const data = fs.readFileSync('./test/exes/arm32.elf');
    const elfParser = new ELFParser(new Uint8Array(data));

    it('should parse sections and symbols', () => {
        /*
        elfParser.sectionHeaders.forEach((section, index) => {
            console.log('section', index, section.name, section.type, section.vaddr.toString(16), section.size.toString(16));
        });
        elfParser.getSymbols().forEach((symbol, index) => {
            console.log('symbol', index, symbol.info, symbol.other, symbol.name, symbol.value.toString(16));
        });
        */
        assert.strictEqual(21, elfParser.sectionHeaders.length);
        assert.strictEqual(29, elfParser.getSymbols().length);
        assert.ok(elfParser.sectionHeaders.find((section) => section.name === '.text') != null);
        assert.ok(elfParser.getSymbols().find((symbol) => symbol.name === 'main') != null);
    });

    it('should parse DWARF info', () => {
        const dwarf = new DWARFParser(elfParser);
        assert.strictEqual(2, dwarf.units.length);
        const cu = dwarf.units[0];
        // TODO: check info content
        const li = dwarf.lineInfos[0];
        assert.strictEqual('crt0.c', li.files[1].name);
        /*
        assert.ok(info != null);
        assert.ok(info!.lineNumberProgram != null);
        assert.ok(info!.lineNumberProgram!.length > 0);
        assert.ok(info!.lineNumberProgram![0].file != null);
        assert.ok(info!.lineNumberProgram![0].file!.name != null);
        assert.ok(info!.lineNumberProgram![0].file!.name!.length > 0);
        */
    });
});
