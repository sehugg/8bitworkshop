import { threadId } from "worker_threads";
import { DataValue, ECSError } from "./ecs";

export interface DecoderResult {
    properties: {[name: string] : DataValue}
}

abstract class LineDecoder {
    lines : string[][];

    constructor(
        text: string
    ) {
        // split the text into lines and into tokens
        this.lines = text.split('\n').map(s => s.trim()).filter(s => !!s).map(s => s.split(/\s+/));
    }

    decodeBits(s: string, n: number, msbfirst: boolean) {
        if (s.length != n) throw new ECSError(`Expected ${n} characters`);
        let b = 0;
        for (let i=0; i<n; i++) {
            let bit;
            if (s.charAt(i) == 'x') bit = 1;
            else if (s.charAt(i) == '.') bit = 0;
            else throw new ECSError('need x or .');
            if (bit) {
                if (msbfirst) b |= 1 << (n-1-i);
                else b |= 1 << i;
            }
        }
        return b;
    }

    assertTokens(toks: string[], count: number) {
        if (toks.length != count) throw new ECSError(`Expected ${count} tokens on line.`);
    }

    hex(s: string) {
        let v = parseInt(s, 16);
        if (isNaN(v)) throw new ECSError(`Invalid hex value: ${s}`)
        return v;
    }

    abstract parse() : DecoderResult;
}

export class VCSSpriteDecoder extends LineDecoder {
    parse() {
        let height = this.lines.length;
        let bitmapdata = new Uint8Array(height);
        let colormapdata = new Uint8Array(height);
        for (let i=0; i<height; i++) {
            let toks = this.lines[height - 1 - i];
            this.assertTokens(toks, 2);
            bitmapdata[i] = this.decodeBits(toks[0], 8, true);
            colormapdata[i] = this.hex(toks[1]);
        }
        return {
            properties: {
                bitmapdata, colormapdata, height: height-1
            }
        }
    }
}

export class VCSVersatilePlayfieldDecoder extends LineDecoder {
    parse() {
        let height = this.lines.length;
        let data = new Uint8Array(192) //height * 2); TODO
        data.fill(0x3f);
        // pf0 pf1 pf2 colupf colubk ctrlpf trash
        const regs = [0x0d, 0x0e, 0x0f, 0x08, 0x09, 0x0a, 0x3f];
        let prev = [0,0,0,0,0,0,0];
        let cur  = [0,0,0,0,0,0,0];
        for (let i=0; i<height; i++) {
            let toks = this.lines[i];
            this.assertTokens(toks, 4);
            cur[0] = this.decodeBits(toks[0].substring(0,4), 4, false) << 4;
            cur[1] = this.decodeBits(toks[0].substring(4,12), 8, true);
            cur[2] = this.decodeBits(toks[0].substring(12,20), 8, false);
            if (toks[1] != '..') cur[3] = this.hex(toks[1]);
            if (toks[2] != '..') cur[4] = this.hex(toks[2]);
            if (toks[3] != '..') cur[5] = this.hex(toks[3]);
            let changed = [];
            for (let j=0; j<cur.length; j++) {
                if (cur[j] != prev[j])
                    changed.push(j);
            }
            if (changed.length > 1) {
                console.log(changed, cur, prev);
                throw new ECSError(`More than one register change in line ${i+1}: [${changed}]`);
            }
            let chgidx = changed.length ? changed[0] : regs.length-1;
            data[height*2 - i*2 - 1] = regs[chgidx];
            data[height*2 - i*2 - 2] = cur[chgidx];
            prev[chgidx] = cur[chgidx];
        }
        return {
            properties: {
                data
            }
        }
    }
}

export function newDecoder(name: string, text: string) : LineDecoder | undefined {
    let cons = (DECODERS as any)[name];
    if (cons) return new cons(text);
}

const DECODERS = {
    'vcs_sprite': VCSSpriteDecoder,
    'vcs_versatile': VCSVersatilePlayfieldDecoder,
}
