"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.assembleXA = assembleXA;
const wasishim_1 = require("../../common/wasi/wasishim");
const builder_1 = require("../builder");
const listingutils_1 = require("../listingutils");
const wasmutils_1 = require("../wasmutils");
// xa listing lines look like this:
//     5 A:c000  a9 05                    start     lda #$05      ; comment
// (line number, segment:address, then fixed-width byte / label / source columns)
const re_listing = /^\s*(\d+) (\w):([0-9a-f]+)  (.*)$/i;
const LABEL_COL = 25; // width of the byte column
const SOURCE_COL = 35; // width of the byte + label columns
// xa writes errors to stderr, e.g.:
// main.xa:line 7: c00c:Overflow error
const re_error = /^(\S.*?):line (\d+): (?:[0-9a-f]+:)?\s*(.+)$/;
// the label file (-l) has one comma-separated entry per line:
// start, 0xc000, 0, 0x0000
const re_label = /^(\S+),\s*0x([0-9a-f]+)/i;
function parseXALabels(text) {
    const symbolmap = {};
    for (const line of text.split(listingutils_1.re_crlf)) {
        const m = re_label.exec(line);
        if (m) {
            symbolmap[m[1]] = parseInt(m[2], 16);
        }
    }
    return symbolmap;
}
function parseXAListing(lsttext, listings) {
    // xa prints the file name on its own line whenever it enters or resumes a file
    let path = null;
    let listing = null;
    let lastline = 0;
    const lastlines = {};
    for (const line of lsttext.split(listingutils_1.re_crlf)) {
        const m = re_listing.exec(line);
        if (!m) {
            // a file name switches us to another listing
            const newpath = line.trim();
            if (listings[newpath]) {
                if (path)
                    lastlines[path] = lastline;
                path = newpath;
                listing = listings[path];
                lastline = lastlines[path] || 0;
            }
            continue;
        }
        const linenum = parseInt(m[1]);
        const offset = parseInt(m[3], 16);
        const rest = m[4];
        const insns = rest.substring(0, LABEL_COL).replace('...', '').trim();
        const source = rest.substring(SOURCE_COL).trim();
        // when xa resumes a file after an include it repeats its line counter
        // for one line, so only accept line numbers that move forward
        if (insns && listing && linenum > lastline) {
            listing.lines.push({
                line: linenum,
                offset: offset,
                insns: insns,
                iscode: !source.startsWith('.'),
            });
        }
        if (linenum > lastline)
            lastline = linenum;
    }
}
// the origin is the address of the first byte written to the output file
function getListingOrigin(listings) {
    let origin;
    for (const key in listings) {
        for (const line of listings[key].lines) {
            if (origin === undefined || line.offset < origin)
                origin = line.offset;
        }
    }
    return origin;
}
let wasiModule = null;
function assembleXA(step) {
    var _a, _b, _c, _d;
    const errors = [];
    (0, builder_1.gatherFiles)(step, { mainFilePath: "main.xa" });
    const binpath = step.prefix + ".bin";
    const lstpath = step.prefix + ".lst";
    const sympath = step.prefix + ".lbl";
    if ((0, builder_1.staleFiles)(step, [binpath])) {
        if (!wasiModule) {
            wasiModule = new WebAssembly.Module((0, wasmutils_1.loadWASMBinary)("xa"));
        }
        const wasi = new wasishim_1.WASIRunner();
        wasi.initSync(wasiModule);
        for (const file of step.files) {
            wasi.fs.putFile("./" + file, builder_1.store.getFileData(file));
        }
        wasi.addPreopenDirectory(".");
        const args = ['xa', '-E', '-o', binpath, '-l', sympath, '-P', lstpath];
        if ((_a = step.params) === null || _a === void 0 ? void 0 : _a.xaargs) {
            args.push.apply(args, step.params.xaargs);
        }
        args.push("-D__8BITWORKSHOP__=1");
        if (step.mainfile) {
            args.push("-D__MAIN__=1");
        }
        args.push(step.path);
        wasi.setArgs(args);
        try {
            wasi.run();
        }
        catch (e) {
            errors.push({ line: 0, msg: e + "" });
        }
        const stderr = wasi.fds[2].getBytesAsString();
        for (const line of stderr.split(listingutils_1.re_crlf)) {
            const m = re_error.exec(line);
            if (m) {
                errors.push({ path: m[1], line: parseInt(m[2]), msg: m[3] });
            }
        }
        if (errors.length) {
            return { errors };
        }
        const lstout = ((_b = wasi.fs.getFile("./" + lstpath)) === null || _b === void 0 ? void 0 : _b.getBytesAsString()) || "";
        const symout = ((_c = wasi.fs.getFile("./" + sympath)) === null || _c === void 0 ? void 0 : _c.getBytesAsString()) || "";
        const output = (_d = wasi.fs.getFile("./" + binpath)) === null || _d === void 0 ? void 0 : _d.getBytes();
        if (!output) {
            return { errors: [{ line: 0, msg: "xa did not produce an output file" }] };
        }
        const listings = {};
        for (const path of step.files) {
            listings[path] = { lines: [] };
        }
        parseXAListing(lstout, listings);
        (0, builder_1.putWorkFile)(binpath, output);
        (0, builder_1.putWorkFile)(lstpath, lstout);
        (0, builder_1.putWorkFile)(sympath, symout);
        return {
            output,
            errors,
            listings,
            symbolmap: parseXALabels(symout),
            origin: getListingOrigin(listings),
        };
    }
}
//# sourceMappingURL=xa.js.map