// Parser for the oscar64 compiler's auxiliary output files.
// oscar64 writes a .map (memory map), .lbl (label file) and .asm
// (assembly listing with C source line markers) next to the output.
// This module is shared by the browser/WASM tool (src/worker/tools/oscar64.ts)
// and the native server tool (src/worker/server/buildenv.ts).

import { CodeListingMap, Segment, SourceLine } from "../../common/workertypes";

export interface Oscar64ParseResult {
    segments: Segment[];
    symbolmap: { [sym: string]: number };
    listings: CodeListingMap;
}

/**
 * Parse an oscar64 .map file.
 * Returns segments (from the 'sections' section) and a symbol map
 * (from the 'objects' section).
 *
 * Sample:
 *   sections
 *   0880 - 0889 : DATA, code
 *   0889 - 088a : DATA, data
 *   ...
 *   objects
 *   0801 - 0853 : startup, NATIVE_CODE:startup
 *   0880 - 0889 : main, NATIVE_CODE:code
 */
export function parseOscar64Map(mapout: string) {
    let segments: Segment[] = [];
    let symbolmap: { [sym: string]: number } = {};
    let section = '';
    for (let line of mapout.split('\n')) {
        line = line.trim();
        if (line === 'sections' || line === 'regions' || line === 'objects' || line === 'objects by size') {
            section = line;
            continue;
        }
        // "0880 - 0889 : DATA, code"  or  "0801 - 0853 : startup, NATIVE_CODE:startup"
        let m = /^([0-9a-f]+) - ([0-9a-f]+) : ([^,]+), (.+)$/.exec(line);
        if (m) {
            const start = parseInt(m[1], 16);
            const end = parseInt(m[2], 16);
            const name = m[4].trim();
            if (section === 'sections') {
                // derive rom/ram classification from the segment name
                let type = 'ram';
                if (/code/.test(m[4]) || m[4] === 'startup' || /rom/.test(m[4])) {
                    type = 'rom';
                }
                segments.push({ name: m[4], start, size: end - start, type });
            } else if (section === 'objects') {
                if (m[3] !== '*') symbolmap[m[3]] = start;
            }
        }
    }
    return { segments, symbolmap };
}

/**
 * Parse an oscar64 .lbl file (VICE label format), e.g. "al 0880 .main".
 * Used as a fallback when the .map has no "objects" section.
 */
export function parseOscar64Lbl(lblout: string) {
    let symbolmap: { [sym: string]: number } = {};
    for (let line of lblout.split('\n')) {
        let toks = line.trim().split(/\s+/);
        if (toks[0] == 'al' && toks.length >= 3) {
            const ofs = parseInt(toks[1], 16);
            const name = toks[2];
            // prefer the un-dotted form used by the assembler listing
            const clean = name.replace(/^\./, '');
            if (!symbolmap[clean]) symbolmap[clean] = ofs;
        }
    }
    return symbolmap;
}

/**
 * Parse an oscar64 .asm listing.
 * Returns source lines (each instruction offset mapped to its C source line)
 * and assembly lines (one entry per assembly line in the listing).
 *
 * Sample:
 *   ; Compiled with 1.32.266
 *   --------------------------------------------------------------------
 *   startup: ; startup
 *   0801 : 0b __ __ INV
 *   ...
 *   main: ; main()->i16
 *   ;   2, "/test.c"
 *   .s4:
 *   ;   2, "/test.c"
 *   0880 : a9 04 __ LDA #$04
 */
export function parseOscar64Listing(asmout: string, asmfn: string) {
    let srclines: SourceLine[] = [];
    let asmlines: SourceLine[] = [];
    let c_lineno = 0;
    let c_path = '';
    let asm_lineno = 0;
    // ;   2, "/test.c"
    let re_src = /^;\s*(\d+), "(.+?)"/;
    // 0801 : 0b __ __ INV
    let re_insn = /^([0-9a-f]+) : ([0-9a-f _]{8}) (.*)/;
    for (let line of asmout.split('\n')) {
        asm_lineno++;
        let m2 = re_src.exec(line);
        if (m2) {
            c_lineno = parseInt(m2[1]);
            // path may be absolute; use basename for source line mapping
            c_path = m2[2].split('/').pop();
        }
        let m = re_insn.exec(line);
        if (m) {
            let offset = parseInt(m[1], 16);
            let hex = m[2];
            let asm = m[3];
            let insns = (hex + ' ' + asm).trim();
            asmlines.push({
                line: asm_lineno,
                path: asmfn,
                offset,
                insns,
                iscode: true,
            });
            if (c_path) {
                srclines.push({
                    line: c_lineno,
                    path: c_path,
                    offset,
                    iscode: true,
                });
                c_path = '';
            }
        }
    }
    return { srclines, asmlines };
}