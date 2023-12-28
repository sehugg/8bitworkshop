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
        assert.strictEqual(22, elfParser.sectionHeaders.length);
        assert.strictEqual(31, elfParser.getSymbols().length);
        assert.ok(elfParser.sectionHeaders.find((section) => section.name === '.text') != null);
        assert.ok(elfParser.getSymbols().find((symbol) => symbol.name === 'main') != null);
    });

    it('should parse DWARF info', () => {
        const dwarf = new DWARFParser(elfParser);
        /*
        const info = dwarf.getCompilationUnits()[0];
        assert.ok(info != null);
        assert.ok(info!.lineNumberProgram != null);
        assert.ok(info!.lineNumberProgram!.length > 0);
        assert.ok(info!.lineNumberProgram![0].file != null);
        assert.ok(info!.lineNumberProgram![0].file!.name != null);
        assert.ok(info!.lineNumberProgram![0].file!.name!.length > 0);
        */
    });
});
