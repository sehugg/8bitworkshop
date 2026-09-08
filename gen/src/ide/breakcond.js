"use strict";
// Breakpoint condition expressions: a small, safe expression language
// evaluated against the CPU state while the emulator is running.
// (No eval() -- a tiny recursive-descent parser compiles the expression
// to a closure, so bad input can only fail at compile time.)
//
// Values:
//   numbers    123, $1a2f, 0x1a2f
//   registers  PC, A, X, Y, SP ... (numeric fields of the CPU state)
//   symbols    resolved from the debug symbol map (baked in at compile time)
//   memory     [expr] reads a byte at expr
// Operators (C-like precedence): ! ~ - + (unary), * / %, + -, << >>,
//   < <= > >=, == !=, &, ^, |, &&, ||, and parentheses.
// The whole expression is true when it evaluates to non-zero.
Object.defineProperty(exports, "__esModule", { value: true });
exports.compileCondition = compileCondition;
exports.parseTarget = parseTarget;
const OPERATORS2 = ['<<', '>>', '<=', '>=', '==', '!=', '&&', '||'];
const OPERATORS1 = '+-*/%<>!~&|^()[]';
function tokenize(src) {
    let toks = [];
    let i = 0;
    while (i < src.length) {
        let ch = src[i];
        if (/\s/.test(ch)) {
            i++;
            continue;
        }
        if (ch == '$' && /[0-9a-fA-F]/.test(src[i + 1] || '')) {
            let j = i + 1;
            while (j < src.length && /[0-9a-fA-F]/.test(src[j]))
                j++;
            toks.push({ t: 'num', v: src.substring(i, j), num: parseInt(src.substring(i + 1, j), 16) });
            i = j;
            continue;
        }
        if (/[0-9]/.test(ch)) {
            if (ch == '0' && (src[i + 1] == 'x' || src[i + 1] == 'X')) {
                let j = i + 2;
                while (j < src.length && /[0-9a-fA-F]/.test(src[j]))
                    j++;
                if (j == i + 2)
                    throw new Error("bad hex number");
                toks.push({ t: 'num', v: src.substring(i, j), num: parseInt(src.substring(i + 2, j), 16) });
                i = j;
            }
            else {
                let j = i;
                while (j < src.length && /[0-9]/.test(src[j]))
                    j++;
                toks.push({ t: 'num', v: src.substring(i, j), num: parseInt(src.substring(i, j), 10) });
                i = j;
            }
            continue;
        }
        if (/[A-Za-z_.]/.test(ch)) {
            let j = i;
            while (j < src.length && /[A-Za-z0-9_.$]/.test(src[j]))
                j++;
            toks.push({ t: 'id', v: src.substring(i, j) });
            i = j;
            continue;
        }
        let two = src.substring(i, i + 2);
        if (OPERATORS2.includes(two)) {
            toks.push({ t: 'op', v: two });
            i += 2;
            continue;
        }
        if (OPERATORS1.includes(ch)) {
            toks.push({ t: 'op', v: ch });
            i++;
            continue;
        }
        throw new Error("unexpected character '" + ch + "'");
    }
    return toks;
}
class Parser {
    constructor(toks) {
        this.pos = 0;
        this.toks = toks;
    }
    peek() { return this.toks[this.pos]; }
    next() { return this.toks[this.pos++]; }
    atOp(...ops) {
        let t = this.peek();
        return (t && t.t == 'op' && ops.includes(t.v)) ? t.v : null;
    }
    expect(v) {
        let t = this.next();
        if (!t || t.t != 'op' || t.v != v)
            throw new Error("expected '" + v + "'");
    }
    parse() {
        let n = this.parseOr();
        if (this.pos != this.toks.length)
            throw new Error("unexpected '" + this.peek().v + "'");
        return n;
    }
    parseOr() {
        let a = this.parseAnd();
        while (this.atOp('||')) {
            this.next();
            a = { t: 'bin', op: '||', a: a, b: this.parseAnd() };
        }
        return a;
    }
    parseAnd() {
        let a = this.parseBitOr();
        while (this.atOp('&&')) {
            this.next();
            a = { t: 'bin', op: '&&', a: a, b: this.parseBitOr() };
        }
        return a;
    }
    parseBitOr() {
        let a = this.parseBitXor();
        while (this.atOp('|')) {
            this.next();
            a = { t: 'bin', op: '|', a: a, b: this.parseBitXor() };
        }
        return a;
    }
    parseBitXor() {
        let a = this.parseBitAnd();
        while (this.atOp('^')) {
            this.next();
            a = { t: 'bin', op: '^', a: a, b: this.parseBitAnd() };
        }
        return a;
    }
    parseBitAnd() {
        let a = this.parseEquality();
        while (this.atOp('&')) {
            this.next();
            a = { t: 'bin', op: '&', a: a, b: this.parseEquality() };
        }
        return a;
    }
    parseEquality() {
        let a = this.parseRelational();
        let op;
        while (op = this.atOp('==', '!=')) {
            this.next();
            a = { t: 'bin', op: op, a: a, b: this.parseRelational() };
        }
        return a;
    }
    parseRelational() {
        let a = this.parseShift();
        let op;
        while (op = this.atOp('<', '<=', '>', '>=')) {
            this.next();
            a = { t: 'bin', op: op, a: a, b: this.parseShift() };
        }
        return a;
    }
    parseShift() {
        let a = this.parseAdditive();
        let op;
        while (op = this.atOp('<<', '>>')) {
            this.next();
            a = { t: 'bin', op: op, a: a, b: this.parseAdditive() };
        }
        return a;
    }
    parseAdditive() {
        let a = this.parseMultiplicative();
        let op;
        while (op = this.atOp('+', '-')) {
            this.next();
            a = { t: 'bin', op: op, a: a, b: this.parseMultiplicative() };
        }
        return a;
    }
    parseMultiplicative() {
        let a = this.parseUnary();
        let op;
        while (op = this.atOp('*', '/', '%')) {
            this.next();
            a = { t: 'bin', op: op, a: a, b: this.parseUnary() };
        }
        return a;
    }
    parseUnary() {
        let op = this.atOp('-', '!', '~', '+');
        if (op) {
            this.next();
            return { t: 'un', op: op, a: this.parseUnary() };
        }
        return this.parsePrimary();
    }
    parsePrimary() {
        let t = this.next();
        if (!t)
            throw new Error("unexpected end of expression");
        if (t.t == 'num')
            return { t: 'num', v: t.num };
        if (t.t == 'id')
            return { t: 'id', name: t.v };
        if (t.t == 'op' && t.v == '(') {
            let n = this.parseOr();
            this.expect(')');
            return n;
        }
        if (t.t == 'op' && t.v == '[') {
            let n = this.parseOr();
            this.expect(']');
            return { t: 'mem', a: n };
        }
        throw new Error("unexpected '" + t.v + "'");
    }
}
function compileNode(n, ctx) {
    switch (n.t) {
        case 'num': {
            const v = n.v;
            return () => v;
        }
        case 'id': {
            const name = n.name;
            if (ctx.cpuFields.has(name)) {
                return (c) => {
                    const v = c[name];
                    return typeof v === 'number' ? v : 0;
                };
            }
            let v = ctx.symbol(name);
            if (typeof v === 'number') {
                const val = v;
                return () => val;
            }
            throw new Error("unknown identifier '" + name + "'");
        }
        case 'mem': {
            const a = compileNode(n.a, ctx);
            return (c) => {
                if (!ctx.readMem)
                    throw new Error("memory reads not supported");
                const v = ctx.readMem(a(c) & 0xffff);
                if (typeof v !== 'number')
                    throw new Error("cannot read memory");
                return v;
            };
        }
        case 'un': {
            const a = compileNode(n.a, ctx);
            switch (n.op) {
                case '-': return (c) => -a(c);
                case '~': return (c) => ~a(c);
                case '!': return (c) => a(c) ? 0 : 1;
                case '+': return a;
            }
            break;
        }
        case 'bin': {
            const a = compileNode(n.a, ctx);
            const b = compileNode(n.b, ctx);
            switch (n.op) {
                case '||': return (c) => (a(c) || b(c)) ? 1 : 0;
                case '&&': return (c) => (a(c) && b(c)) ? 1 : 0;
                case '|': return (c) => a(c) | b(c);
                case '^': return (c) => a(c) ^ b(c);
                case '&': return (c) => a(c) & b(c);
                case '==': return (c) => a(c) == b(c) ? 1 : 0;
                case '!=': return (c) => a(c) != b(c) ? 1 : 0;
                case '<': return (c) => a(c) < b(c) ? 1 : 0;
                case '<=': return (c) => a(c) <= b(c) ? 1 : 0;
                case '>': return (c) => a(c) > b(c) ? 1 : 0;
                case '>=': return (c) => a(c) >= b(c) ? 1 : 0;
                case '<<': return (c) => a(c) << b(c);
                case '>>': return (c) => a(c) >> b(c);
                case '+': return (c) => a(c) + b(c);
                case '-': return (c) => a(c) - b(c);
                case '*': return (c) => a(c) * b(c);
                case '/': return (c) => { const d = b(c); return d === 0 ? 0 : (a(c) / d) | 0; };
                case '%': return (c) => { const d = b(c); return d === 0 ? 0 : a(c) % d; };
            }
            break;
        }
    }
    throw new Error("bad expression node");
}
// Compile a condition expression; throws on syntax errors or unknown identifiers.
// The returned function never throws: if evaluation fails (e.g. unreadable
// memory) it returns false so the emulator loop is never interrupted.
function compileCondition(src, ctx) {
    let ast = new Parser(tokenize(src)).parse();
    let fn = compileNode(ast, ctx);
    return (c) => {
        try {
            return fn(c) != 0;
        }
        catch (e) {
            return false;
        }
    };
}
// Parse a breakpoint target: '$hex', '0xhex', decimal, or a symbol name.
function parseTarget(target, symbol) {
    let s = (target || '').trim();
    if (!s)
        return { error: "empty address" };
    let m;
    if ((m = s.match(/^\$([0-9a-fA-F]+)$/)) || (m = s.match(/^0[xX]([0-9a-fA-F]+)$/))) {
        return { pc: parseInt(m[1], 16) };
    }
    if (/^\d+$/.test(s)) {
        return { pc: parseInt(s, 10) };
    }
    let v = symbol(s);
    if (typeof v === 'number')
        return { pc: v };
    return { error: "unknown symbol '" + s + "'" };
}
//# sourceMappingURL=breakcond.js.map