"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.Assembler = void 0;
const isError = (o) => o.error !== undefined;
function hex(v, nd) {
    try {
        if (!nd)
            nd = 2;
        if (nd == 8) {
            return hex((v >> 16) & 0xffff, 4) + hex(v & 0xffff, 4);
        }
        var s = v.toString(16).toUpperCase();
        while (s.length < nd)
            s = "0" + s;
        return s;
    }
    catch (e) {
        return v + "";
    }
}
function stringToData(s) {
    var data = [];
    for (var i = 0; i < s.length; i++) {
        data[i] = s.charCodeAt(i);
    }
    return data;
}
class Assembler {
    constructor(spec) {
        this.ip = 0;
        this.origin = 0;
        this.linenum = 0;
        this.symbols = {};
        this.errors = [];
        this.outwords = [];
        this.asmlines = [];
        this.fixups = [];
        this.width = 8;
        this.codelen = 0;
        this.aborted = false;
        this.spec = spec;
        if (spec) {
            this.preprocessRules();
        }
    }
    rule2regex(rule, vars) {
        var s = rule.fmt;
        if (!s || !(typeof s === 'string'))
            throw Error('Each rule must have a "fmt" string field');
        if (!rule.bits || !(rule.bits instanceof Array))
            throw Error('Each rule must have a "bits" array field');
        var varlist = [];
        rule.prefix = s.split(/\s+/)[0];
        s = s.replace(/\+/g, '\\+');
        s = s.replace(/\*/g, '\\*');
        s = s.replace(/\s+/g, '\\s+');
        s = s.replace(/\[/g, '\\[');
        s = s.replace(/\]/g, '\\]');
        s = s.replace(/\(/g, '\\(');
        s = s.replace(/\)/g, '\\)');
        s = s.replace(/\./g, '\\.');
        // TODO: more escapes?
        s = s.replace(/~\w+/g, (varname) => {
            varname = varname.substr(1);
            var v = vars[varname];
            varlist.push(varname);
            if (!v)
                throw Error('Could not find variable definition for "~' + varname + '"');
            else if (v.toks)
                return '(\\w+)';
            else
                return '([0-9]+|[$][0-9a-f]+|\\w+)';
        });
        try {
            rule.re = new RegExp('^' + s + '$', 'i');
        }
        catch (e) {
            throw Error("Bad regex for rule \"" + rule.fmt + "\": /" + s + "/ -- " + e);
        }
        rule.varlist = varlist;
        // TODO: check rule constraints
        return rule;
    }
    preprocessRules() {
        if (this.spec.width) {
            this.width = this.spec.width || 8;
        }
        for (var rule of this.spec.rules) {
            this.rule2regex(rule, this.spec.vars);
        }
    }
    warning(msg, line) {
        this.errors.push({ msg: msg, line: line ? line : this.linenum });
    }
    fatal(msg, line) {
        this.warning(msg, line);
        this.aborted = true;
    }
    fatalIf(msg, line) {
        if (msg)
            this.fatal(msg, line);
    }
    addBytes(result) {
        this.asmlines.push({
            line: this.linenum,
            offset: this.ip,
            nbits: result.nbits
        });
        var op = result.opcode;
        var nb = result.nbits / this.width;
        for (var i = 0; i < nb; i++) {
            if (this.width < 32)
                this.outwords[this.ip++ - this.origin] = (op >> (nb - 1 - i) * this.width) & ((1 << this.width) - 1);
            else
                this.outwords[this.ip++ - this.origin] = op;
        }
    }
    addWords(data) {
        this.asmlines.push({
            line: this.linenum,
            offset: this.ip,
            nbits: this.width * data.length
        });
        for (var i = 0; i < data.length; i++) {
            if (this.width < 32)
                this.outwords[this.ip++ - this.origin] = data[i] & ((1 << this.width) - 1);
            else
                this.outwords[this.ip++ - this.origin] = data[i];
        }
    }
    parseData(toks) {
        var data = [];
        for (var i = 0; i < toks.length; i++) {
            data[i] = this.parseConst(toks[i]);
        }
        return data;
    }
    alignIP(align) {
        if (align < 1 || align > this.codelen)
            this.fatal("Invalid alignment value");
        else
            this.ip = Math.floor((this.ip + align - 1) / align) * align;
    }
    parseConst(s, nbits) {
        // TODO: check bit length
        if (s && s[0] == '$')
            return parseInt(s.substr(1), 16);
        else
            return parseInt(s);
    }
    swapEndian(x, nbits) {
        var y = 0;
        while (nbits > 0) {
            var n = Math.min(nbits, this.width);
            var mask = (1 << n) - 1;
            y <<= n;
            y |= (x & mask);
            x >>>= n;
            nbits -= n;
        }
        return y;
    }
    buildInstruction(rule, m) {
        var opcode = 0;
        var oplen = 0;
        // iterate over each component of the rule output ("bits")
        for (let b of rule.bits) {
            let n, x;
            // is a string? then it's a bit constant
            // TODO
            if (typeof b === "string") {
                n = b.length;
                x = parseInt(b, 2);
            }
            else {
                // is it a slice {a,b,n} or just a number?
                var index = typeof b === "number" ? b : b.a;
                // it's an indexed variable, look up its variable
                var id = m[index + 1];
                var v = this.spec.vars[rule.varlist[index]];
                if (!v) {
                    return { error: `Could not find matching identifier for '${m[0]}' index ${index}` };
                }
                n = v.bits;
                var shift = 0;
                if (typeof b !== "number") {
                    n = b.n;
                    shift = b.b;
                }
                // is it an enumerated type? look up the index of its keyword
                if (v.toks) {
                    x = v.toks.indexOf(id);
                    if (x < 0)
                        return { error: "Can't use '" + id + "' here, only one of: " + v.toks.join(', ') };
                }
                else {
                    // otherwise, parse it as a constant
                    x = this.parseConst(id, n);
                    // is it a label? add fixup
                    if (isNaN(x)) {
                        this.fixups.push({
                            sym: id, ofs: this.ip, size: v.bits, line: this.linenum,
                            dstlen: n, dstofs: oplen, srcofs: shift,
                            endian: v.endian,
                            iprel: !!v.iprel, ipofs: (v.ipofs + 0), ipmul: v.ipmul || 1
                        });
                        x = 0;
                    }
                    else {
                        var mask = (1 << v.bits) - 1;
                        if ((x & mask) != x)
                            return { error: "Value " + x + " does not fit in " + v.bits + " bits" };
                    }
                }
                // if little endian, we need to swap ordering
                if (v.endian == 'little')
                    x = this.swapEndian(x, v.bits);
                // is it an array slice? slice the bits
                if (typeof b !== "number") {
                    x = (x >>> shift) & ((1 << b.n) - 1);
                }
            }
            opcode = (opcode << n) | x;
            oplen += n;
        }
        if (oplen == 0)
            this.warning("Opcode had zero length");
        else if (oplen > 32)
            this.warning("Opcodes > 32 bits not supported");
        else if ((oplen % this.width) != 0)
            this.warning("Opcode was not word-aligned (" + oplen + " bits)");
        return { opcode: opcode, nbits: oplen };
    }
    loadArch(arch) {
        if (this.loadJSON) {
            var json = this.loadJSON(arch + ".json");
            if (json && json.vars && json.rules) {
                this.spec = json;
                this.preprocessRules();
            }
            else {
                return ("Could not load arch file '" + arch + ".json'");
            }
        }
    }
    parseDirective(tokens) {
        var cmd = tokens[0].toLowerCase();
        if (cmd == '.define')
            this.symbols[tokens[1].toLowerCase()] = { value: tokens[2] };
        else if (cmd == '.org')
            this.ip = this.origin = parseInt(tokens[1]);
        else if (cmd == '.len')
            this.codelen = parseInt(tokens[1]);
        else if (cmd == '.width')
            this.width = parseInt(tokens[1]);
        else if (cmd == '.arch')
            this.fatalIf(this.loadArch(tokens[1]));
        else if (cmd == '.include')
            this.fatalIf(this.loadInclude(tokens[1]));
        else if (cmd == '.module')
            this.fatalIf(this.loadModule(tokens[1]));
        else if (cmd == '.data')
            this.addWords(this.parseData(tokens.slice(1)));
        else if (cmd == '.string')
            this.addWords(stringToData(tokens.slice(1).join(' ')));
        else if (cmd == '.align')
            this.alignIP(this.parseConst(tokens[1]));
        else
            this.warning("Unrecognized directive: " + tokens);
    }
    assemble(line) {
        this.linenum++;
        // remove comments
        line = line.replace(/[;].*/g, '').trim();
        // is it a directive?
        if (line[0] == '.') {
            var tokens = line.split(/\s+/);
            this.parseDirective(tokens);
            return;
        }
        // make it lowercase
        line = line.toLowerCase();
        // find labels
        line = line.replace(/(\w+):/, (_label, label) => {
            this.symbols[label] = { value: this.ip };
            return ''; // replace label with blank
        });
        line = line.trim();
        if (line == '')
            return; // empty line
        // look at each rule in order
        if (!this.spec) {
            this.fatal("Need to load .arch first");
            return;
        }
        var lastError;
        for (var rule of this.spec.rules) {
            var m = rule.re.exec(line);
            if (m) {
                var result = this.buildInstruction(rule, m);
                if (!isError(result)) {
                    this.addBytes(result);
                    return result;
                }
                else {
                    lastError = result.error;
                }
            }
        }
        this.warning(lastError ? lastError : ("Could not decode instruction: " + line));
    }
    applyFixup(fix, sym) {
        var ofs = fix.ofs + Math.floor(fix.dstofs / this.width);
        var mask = ((1 << fix.size) - 1);
        var value = this.parseConst(sym.value + "", fix.dstlen);
        if (fix.iprel)
            value = (value - fix.ofs) * fix.ipmul - fix.ipofs;
        if (fix.srcofs == 0 && (value > mask || value < -mask))
            this.warning("Symbol " + fix.sym + " (" + value + ") does not fit in " + fix.dstlen + " bits", fix.line);
        //console.log(hex(value,8), fix.srcofs, fix.dstofs, fix.dstlen);
        if (fix.srcofs > 0)
            value >>>= fix.srcofs;
        value &= (1 << fix.dstlen) - 1;
        // TODO: make it work for all widths
        if (this.width == 32) {
            var shift = 32 - fix.dstofs - fix.dstlen;
            value <<= shift;
        }
        // TODO: check range
        if (fix.size <= this.width) {
            this.outwords[ofs - this.origin] ^= value;
        }
        else {
            // swap if we want big endian (we'll apply in LSB first order)
            if (fix.endian == 'big')
                value = this.swapEndian(value, fix.size);
            // apply multi-byte fixup
            while (value) {
                if (value & this.outwords[ofs - this.origin]) {
                    this.warning("Instruction bits overlapped: " + hex(this.outwords[ofs - this.origin], 8), hex(value, 8));
                }
                else {
                    this.outwords[ofs - this.origin] ^= value & ((1 << this.width) - 1);
                }
                value >>>= this.width;
                ofs++;
            }
        }
    }
    finish() {
        // apply fixups
        for (var i = 0; i < this.fixups.length; i++) {
            var fix = this.fixups[i];
            var sym = this.symbols[fix.sym];
            if (sym) {
                this.applyFixup(fix, sym);
            }
            else {
                this.warning("Symbol '" + fix.sym + "' not found");
            }
        }
        // update asmlines
        for (var i = 0; i < this.asmlines.length; i++) {
            var al = this.asmlines[i];
            al.insns = '';
            for (var j = 0; j < al.nbits / this.width; j++) {
                var word = this.outwords[al.offset + j - this.origin];
                if (j > 0)
                    al.insns += ' ';
                al.insns += hex(word, this.width / 4);
            }
        }
        while (this.outwords.length < this.codelen) {
            this.outwords.push(0);
        }
        this.fixups = [];
        return this.state();
    }
    assembleFile(text) {
        var lines = text.split(/\n/g);
        for (var i = 0; i < lines.length && !this.aborted; i++) {
            try {
                this.assemble(lines[i]);
            }
            catch (e) {
                console.log(e);
                this.fatal("Exception during assembly: " + e);
            }
        }
        return this.finish();
    }
    state() {
        return { ip: this.ip, line: this.linenum, origin: this.origin, codelen: this.codelen,
            intermediate: {}, // TODO: listing, symbols?
            output: this.outwords,
            lines: this.asmlines,
            errors: this.errors,
            fixups: this.fixups };
    }
}
exports.Assembler = Assembler;
//# sourceMappingURL=assembler.js.map