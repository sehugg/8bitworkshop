"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.newDecoder = exports.VCSBitmap48Decoder = exports.VCSVersatilePlayfieldDecoder = exports.VCSPlayfieldDecoder = exports.VCSBitmapDecoder = exports.VCSSpriteDecoder = void 0;
const ecs_1 = require("./ecs");
class LineDecoder {
    constructor(text) {
        this.curline = 0; // for debugging, zero-indexed
        // split the text into lines and into tokens
        this.lines = text.split('\n').map(s => s.trim()).filter(s => !!s).map(s => s.split(/\s+/));
    }
    decodeBits(s, n, msbfirst) {
        if (s.length != n)
            throw new ecs_1.ECSError(`Expected ${n} characters`);
        let b = 0;
        for (let i = 0; i < n; i++) {
            let bit;
            let ch = s.charAt(i);
            if (ch == 'x' || ch == 'X' || ch == '1')
                bit = 1;
            else if (ch == '.' || ch == '0')
                bit = 0;
            else
                throw new ecs_1.ECSError('need x or . (or 0 or 1)');
            if (bit) {
                if (msbfirst)
                    b |= 1 << (n - 1 - i);
                else
                    b |= 1 << i;
            }
        }
        return b;
    }
    assertTokens(toks, count) {
        if (toks.length != count)
            throw new ecs_1.ECSError(`Expected ${count} tokens on line.`);
    }
    hex(s) {
        let v = parseInt(s, 16);
        if (isNaN(v))
            throw new ecs_1.ECSError(`Invalid hex value: ${s}`);
        return v;
    }
    getErrorLocation($loc) {
        // TODO: blank lines mess this up
        $loc.line += this.curline + 1;
        return $loc;
    }
}
class VCSSpriteDecoder extends LineDecoder {
    parse() {
        let height = this.lines.length;
        let bitmapdata = new Uint8Array(height);
        let colormapdata = new Uint8Array(height);
        for (let i = 0; i < height; i++) {
            this.curline = height - 1 - i;
            let toks = this.lines[this.curline];
            this.assertTokens(toks, 2);
            bitmapdata[i] = this.decodeBits(toks[0], 8, true);
            colormapdata[i] = this.hex(toks[1]);
        }
        return {
            properties: {
                bitmapdata, colormapdata, height: height - 1
            }
        };
    }
}
exports.VCSSpriteDecoder = VCSSpriteDecoder;
class VCSBitmapDecoder extends LineDecoder {
    parse() {
        let height = this.lines.length;
        let bitmapdata = new Uint8Array(height);
        for (let i = 0; i < height; i++) {
            this.curline = height - 1 - i;
            let toks = this.lines[this.curline];
            this.assertTokens(toks, 1);
            bitmapdata[i] = this.decodeBits(toks[0], 8, true);
        }
        return {
            properties: {
                bitmapdata, height: height - 1
            }
        };
    }
}
exports.VCSBitmapDecoder = VCSBitmapDecoder;
class VCSPlayfieldDecoder extends LineDecoder {
    parse() {
        let height = this.lines.length;
        let pf = new Uint32Array(height);
        for (let i = 0; i < height; i++) {
            this.curline = height - 1 - i;
            let toks = this.lines[this.curline];
            this.assertTokens(toks, 1);
            let pf0 = this.decodeBits(toks[0].substring(0, 4), 4, false) << 4;
            let pf1 = this.decodeBits(toks[0].substring(4, 12), 8, true);
            let pf2 = this.decodeBits(toks[0].substring(12, 20), 8, false);
            pf[i] = (pf0 << 0) | (pf1 << 8) | (pf2 << 16);
        }
        return {
            properties: {
                pf
            }
        };
    }
}
exports.VCSPlayfieldDecoder = VCSPlayfieldDecoder;
class VCSVersatilePlayfieldDecoder extends LineDecoder {
    parse() {
        let height = this.lines.length;
        let data = new Uint8Array(height * 2);
        data.fill(0x3f);
        // pf0 pf1 pf2 colupf colubk ctrlpf trash
        const regs = [0x0d, 0x0e, 0x0f, 0x08, 0x09, 0x0a, 0x3f];
        let prev = [0, 0, 0, 0, 0, 0, 0];
        let cur = [0, 0, 0, 0, 0, 0, 0];
        for (let i = 0; i < height; i++) {
            let dataofs = height * 2 - i * 2;
            this.curline = i;
            let toks = this.lines[this.curline];
            if (toks.length == 2) {
                data[dataofs - 1] = this.hex(toks[0]);
                data[dataofs - 2] = this.hex(toks[1]);
                continue;
            }
            this.assertTokens(toks, 4);
            cur[0] = this.decodeBits(toks[0].substring(0, 4), 4, false) << 4;
            cur[1] = this.decodeBits(toks[0].substring(4, 12), 8, true);
            cur[2] = this.decodeBits(toks[0].substring(12, 20), 8, false);
            if (toks[1] != '..')
                cur[3] = this.hex(toks[1]);
            if (toks[2] != '..')
                cur[4] = this.hex(toks[2]);
            if (toks[3] != '..')
                cur[5] = this.hex(toks[3]);
            let changed = [];
            for (let j = 0; j < cur.length; j++) {
                if (cur[j] != prev[j])
                    changed.push(j);
            }
            if (changed.length > 1) {
                console.log(changed, cur, prev);
                throw new ecs_1.ECSError(`More than one register change in line ${i + 1}: [${changed}]`);
            }
            let chgidx = changed.length ? changed[0] : regs.length - 1;
            data[dataofs - 1] = regs[chgidx];
            data[dataofs - 2] = cur[chgidx];
            prev[chgidx] = cur[chgidx];
        }
        return {
            properties: {
                data
            }
        };
    }
}
exports.VCSVersatilePlayfieldDecoder = VCSVersatilePlayfieldDecoder;
class VCSBitmap48Decoder extends LineDecoder {
    parse() {
        let height = this.lines.length;
        let bitmap0 = new Uint8Array(height);
        let bitmap1 = new Uint8Array(height);
        let bitmap2 = new Uint8Array(height);
        let bitmap3 = new Uint8Array(height);
        let bitmap4 = new Uint8Array(height);
        let bitmap5 = new Uint8Array(height);
        for (let i = 0; i < height; i++) {
            this.curline = height - 1 - i;
            let toks = this.lines[this.curline];
            this.assertTokens(toks, 1);
            bitmap0[i] = this.decodeBits(toks[0].slice(0, 8), 8, true);
            bitmap1[i] = this.decodeBits(toks[0].slice(8, 16), 8, true);
            bitmap2[i] = this.decodeBits(toks[0].slice(16, 24), 8, true);
            bitmap3[i] = this.decodeBits(toks[0].slice(24, 32), 8, true);
            bitmap4[i] = this.decodeBits(toks[0].slice(32, 40), 8, true);
            bitmap5[i] = this.decodeBits(toks[0].slice(40, 48), 8, true);
        }
        return {
            properties: {
                bitmap0, bitmap1, bitmap2, bitmap3, bitmap4, bitmap5,
                height: height - 1
            }
        };
    }
}
exports.VCSBitmap48Decoder = VCSBitmap48Decoder;
function newDecoder(name, text) {
    let cons = DECODERS[name];
    if (cons)
        return new cons(text);
}
exports.newDecoder = newDecoder;
const DECODERS = {
    'vcs_sprite': VCSSpriteDecoder,
    'vcs_bitmap': VCSBitmapDecoder,
    'vcs_playfield': VCSPlayfieldDecoder,
    'vcs_versatile': VCSVersatilePlayfieldDecoder,
    'vcs_bitmap48': VCSBitmap48Decoder,
};
//# sourceMappingURL=decoder.js.map