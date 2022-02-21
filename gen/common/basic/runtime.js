"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.BASICRuntime = void 0;
const emu_1 = require("../emu");
const util_1 = require("../util");
function isLiteral(arg) {
    return arg.value != null;
}
function isLookup(arg) {
    return arg.name != null;
}
function isBinOp(arg) {
    return arg.op != null && arg.left != null && arg.right != null;
}
function isUnOp(arg) {
    return arg.op != null && arg.expr != null;
}
// expr2js() options
class ExprOptions {
}
class RNG {
    constructor() {
        let f = () => {
            var a, b, c, d;
            this.seed = function (aa, bb, cc, dd) {
                a = aa;
                b = bb;
                c = cc;
                d = dd;
            };
            this.seedfloat = function (n) {
                this.seed(n, n * 4294, n * 429496, n * 4294967296);
                this.next();
                this.next();
                this.next();
            };
            this.next = function () {
                // sfc32
                a >>>= 0;
                b >>>= 0;
                c >>>= 0;
                d >>>= 0;
                var t = (a + b) | 0;
                a = b ^ b >>> 9;
                b = c + (c << 3) | 0;
                c = (c << 21 | c >>> 11);
                d = d + 1 | 0;
                t = t + d | 0;
                c = c + t | 0;
                return (t >>> 0) / 4294967296;
            };
        };
        f();
        this.seedfloat(-1);
    }
    randomize() {
        this.seed(Math.random() * 0x7fffffff, Math.random() * 0x7fffffff, Math.random() * 0x7fffffff, Math.random() * 0x7fffffff);
    }
}
;
const DEFAULT_MAX_ARRAY_ELEMENTS = 1024 * 1024;
class BASICRuntime {
    constructor() {
        this.margin = 80; // number of columns
        this.running = false;
        this.exited = true;
        this.trace = false;
    }
    load(program) {
        // get previous label and offset for hot reload
        let prevlabel = null;
        let prevpcofs = 0;
        if (this.pc2label != null) {
            let pc = this.curpc;
            while (pc > 0 && (prevlabel = this.pc2label.get(pc)) == null) {
                pc--;
            }
            prevpcofs = this.curpc - pc;
            console.log('oldpc=', this.curpc, 'restart @ label', prevlabel, '+', prevpcofs);
        }
        // initialize program
        this.program = program;
        this.opts = program.opts;
        if (!this.opts.maxArrayElements)
            this.opts.maxArrayElements = DEFAULT_MAX_ARRAY_ELEMENTS;
        this.allstmts = program.stmts;
        this.label2pc = program.labels;
        this.label2dataptr = {};
        this.pc2label = new Map();
        this.datums = [];
        this.subroutines = {};
        this.builtins = this.getBuiltinFunctions();
        // TODO: detect undeclared vars
        // build PC -> label lookup
        for (var label in program.labels) {
            var targetpc = program.labels[label];
            this.pc2label.set(targetpc, label);
        }
        // iterate through all the statements
        this.allstmts.forEach((stmt, pc) => {
            // compile statements ahead of time
            this.curpc = pc + 1; // for error reporting
            this.compileStatement(stmt);
            // parse DATA literals
            if (stmt.command == 'DATA') {
                this.label2dataptr[stmt.$loc.label] = this.datums.length;
                stmt.datums.forEach(datum => {
                    this.curpc = stmt.$loc.offset; // for error reporting
                    this.datums.push(datum);
                });
            }
        });
        // try to resume where we left off after loading
        if (this.label2pc[prevlabel] != null) {
            this.curpc = this.label2pc[prevlabel] + prevpcofs;
            return true;
        }
        else {
            this.curpc = 0;
            return false;
        }
    }
    reset() {
        this.curpc = 0;
        this.dataptr = 0;
        this.clearVars();
        this.returnStack = [];
        this.column = 0;
        this.running = true;
        this.exited = false;
    }
    clearVars() {
        this.globals = this.vars = {};
        this.arrays = {};
        this.defs = {}; // TODO? only in interpreters
        this.forLoops = {};
        this.forLoopStack = [];
        this.whileLoops = [];
        this.rng = new RNG();
        // initialize arrays?
        if (this.opts && this.opts.staticArrays) {
            this.allstmts.filter((stmt) => stmt.command == 'DIM').forEach((dimstmt) => {
                dimstmt.args.forEach((arg) => this.compileJS(this._DIM(arg))());
            });
        }
    }
    // TODO: saveState(), loadState()
    saveState() {
        // TODO: linked list loop?
        return $.extend(true, {}, this);
    }
    loadState(state) {
        $.extend(true, this, state);
    }
    getBuiltinFunctions() {
        var fnames = this.program && this.opts.validFunctions;
        // if no valid function list, look for ABC...() functions in prototype
        if (!fnames)
            fnames = Object.getOwnPropertyNames(BASICRuntime.prototype).filter((name) => /^[A-Z]{3,}[$]?$/.test(name));
        var dict = {};
        for (var fn of fnames)
            if (this.supportsFunction(fn))
                dict[fn] = this[fn].bind(this);
        return dict;
    }
    supportsFunction(fnname) {
        return typeof this[fnname] === 'function';
    }
    runtimeError(msg) {
        this.curpc--; // we did curpc++ before executing statement
        throw new emu_1.EmuHalt(msg, this.getCurrentSourceLocation());
    }
    dialectError(what) {
        this.runtimeError(`I can't ${what} in this dialect of BASIC.`);
    }
    getLineForPC(pc) {
        var stmt = this.allstmts[pc];
        return stmt && stmt.$loc && stmt.$loc.line;
    }
    getLabelForPC(pc) {
        var stmt = this.allstmts[pc];
        return stmt && stmt.$loc && stmt.$loc.label;
    }
    getCurrentSourceLocation() {
        var stmt = this.getStatement();
        return stmt && stmt.$loc;
    }
    getCurrentLabel() {
        var loc = this.getCurrentSourceLocation();
        return loc && loc.label;
    }
    getStatement() {
        return this.allstmts[this.curpc];
    }
    step() {
        if (!this.running)
            return false;
        var stmt = this.getStatement();
        // end of program?
        if (!stmt) {
            this.running = false;
            this.exited = true;
            return false;
        }
        if (this.trace)
            console.log(this.curpc, stmt, this.vars, Object.keys(this.arrays));
        // skip to next statment
        this.curpc++;
        // compile (unless cached) and execute statement
        this.executeStatement(stmt);
        return this.running;
    }
    compileStatement(stmt) {
        if (stmt.$run == null) {
            try {
                var stmtfn = this['do__' + stmt.command];
                if (stmtfn == null)
                    this.runtimeError(`I don't know how to "${stmt.command}".`);
                var functext = stmtfn.bind(this)(stmt);
                if (this.trace)
                    console.log(functext);
                stmt.$run = this.compileJS(functext);
            }
            catch (e) {
                if (functext)
                    console.log(functext);
                throw e;
            }
        }
    }
    compileJS(functext) {
        return new Function(functext).bind(this);
    }
    executeStatement(stmt) {
        // compile (unless cached)
        this.compileStatement(stmt);
        // run compiled statement
        stmt.$run();
    }
    // TODO: this only works because each line has a label
    skipToEOL() {
        do {
            this.curpc++;
        } while (this.curpc < this.allstmts.length && !this.pc2label.get(this.curpc));
    }
    skipToElse() {
        while (this.curpc < this.allstmts.length) {
            // in Altair BASIC, ELSE is bound to the right-most IF
            // TODO: this is complicated, we should just have nested expressions
            var cmd = this.allstmts[this.curpc].command;
            if (cmd == 'ELSE') {
                this.curpc++;
                break;
            }
            else if (cmd == 'IF')
                return this.skipToEOL();
            this.curpc++;
            if (this.pc2label.get(this.curpc))
                break;
        }
    }
    skipToEOF() {
        this.curpc = this.allstmts.length;
    }
    skipToAfterNext(forname) {
        var pc = this.curpc;
        while (pc < this.allstmts.length) {
            var stmt = this.allstmts[pc];
            if (stmt.command == 'NEXT') {
                var nextlexpr = stmt.lexpr;
                if (nextlexpr && nextlexpr.name == forname) {
                    this.curpc = pc + 1;
                    return;
                }
            }
            pc++;
        }
        this.runtimeError(`I couldn't find a matching NEXT ${forname} to skip this for loop.`);
    }
    skipToAfterWend() {
        var pc = this.curpc - 1;
        var nesting = 0;
        while (pc < this.allstmts.length) {
            var stmt = this.allstmts[pc];
            //console.log(nesting, pc, stmt);
            if (stmt.command == 'WHILE') {
                nesting++;
            }
            else if (stmt.command == 'WEND') {
                nesting--;
                if (nesting == 0) {
                    this.curpc = pc + 1;
                    return;
                }
            }
            pc++;
        }
        this.runtimeError(`I couldn't find a matching WEND for this WHILE.`);
    }
    gotoLabel(label) {
        var pc = this.label2pc[label];
        if (pc >= 0) {
            this.curpc = pc;
        }
        else {
            this.runtimeError(`I tried to go to the label "${label}" but couldn't find it.`);
        }
    }
    newLocalScope() {
        this.vars = Object.create(this.vars);
    }
    popLocalScope() {
        if (this.vars !== this.globals)
            this.vars = Object.getPrototypeOf(this.vars);
    }
    gosubLabel(label) {
        if (this.returnStack.length > 32767) // TODO: const?
            this.runtimeError(`I did too many GOSUBs without a RETURN.`);
        this.returnStack.push(this.curpc);
        this.gotoLabel(label);
    }
    returnFromGosub() {
        if (this.returnStack.length == 0)
            this.runtimeError("I tried to RETURN, but there wasn't a corresponding GOSUB."); // RETURN BEFORE GOSUB
        var pc = this.returnStack.pop();
        this.curpc = pc;
        this.popLocalScope();
    }
    popReturnStack() {
        if (this.returnStack.length == 0)
            this.runtimeError("I tried to POP, but there wasn't a corresponding GOSUB.");
        this.returnStack.pop();
    }
    valueToString(obj, padding) {
        var str;
        if (typeof obj === 'number') {
            var numstr = this.float2str(obj, this.opts.printZoneLength - 4);
            if (!padding)
                return numstr;
            else if (numstr.startsWith('-'))
                return `${numstr} `;
            else
                return ` ${numstr} `;
        }
        else if (obj == '\n') {
            this.column = 0;
            str = obj;
        }
        else if (obj == '\t') {
            var l = this.opts.printZoneLength;
            var curgroup = Math.floor(this.column / l);
            var nextcol = (curgroup + 1) * this.opts.printZoneLength;
            if (nextcol + l > this.margin) {
                this.column = 0;
                str = "\n";
            } // return to left margin
            else
                str = this.TAB(nextcol); // next column
        }
        else {
            str = `${obj}`;
        }
        return str;
    }
    float2str(arg, numlen) {
        var numstr = arg.toString().toUpperCase();
        if (numlen > 0) {
            var prec = numlen;
            while (numstr.length > numlen) {
                numstr = arg.toPrecision(prec--);
            }
            if (numstr.startsWith('0.'))
                numstr = numstr.substr(1);
            else if (numstr.startsWith('-0.'))
                numstr = '-' + numstr.substr(2);
        }
        return numstr;
    }
    printExpr(obj) {
        var str = this.valueToString(obj, this.opts.numericPadding);
        this.column += str.length;
        this.print(str);
    }
    // override this
    print(str) {
        console.log(str);
    }
    // override this
    async input(prompt, nargs) {
        return { line: "", vals: [] };
    }
    // override this
    resume() { }
    expr2js(expr, opts) {
        if (!opts)
            opts = {};
        if (isLiteral(expr)) {
            return JSON.stringify(expr.value);
        }
        else if (isLookup(expr)) {
            if (!expr.args && opts.locals && opts.locals.indexOf(expr.name) >= 0) {
                return expr.name; // local arg in DEF
            }
            else {
                if (opts.isconst)
                    this.runtimeError(`I expected a constant value here.`); // TODO: check at compile-time?
                var s = '';
                var qname = JSON.stringify(expr.name);
                let jsargs = expr.args ? expr.args.map((arg) => this.expr2js(arg, opts)).join(', ') : [];
                if (expr.name.startsWith("FN")) { // is it a user-defined function?
                    // TODO: check argument count?
                    s += `this.getDef(${qname})(${jsargs})`;
                    // TODO: detect recursion?
                }
                else if (this.builtins[expr.name]) { // is it a built-in function?
                    this.checkFuncArgs(expr, this.builtins[expr.name]);
                    s += `this.builtins.${expr.name}(${jsargs})`;
                }
                else if (expr.args) {
                    // get array slice (HP BASIC)
                    if (this.opts.arraysContainChars && expr.name.endsWith('$'))
                        s += `this.getStringSlice(this.vars.${expr.name}, ${jsargs})`;
                    else
                        s += `this.arrayGet(${qname}, ${jsargs})`;
                }
                else { // just a variable
                    s += `this.vars.${expr.name}`;
                }
                return opts.novalid ? s : `this.checkValue(${s}, ${qname})`;
            }
        }
        else if (isBinOp(expr)) {
            var left = this.expr2js(expr.left, opts);
            var right = this.expr2js(expr.right, opts);
            return `this.${expr.op}(${left}, ${right})`;
        }
        else if (isUnOp(expr)) {
            var e = this.expr2js(expr.expr, opts);
            return `this.${expr.op}(${e})`;
        }
    }
    assign2js(expr, opts) {
        if (!opts)
            opts = {};
        var s = '';
        // is it a function? not allowed
        if (expr.name.startsWith("FN") || this.builtins[expr.name])
            this.runtimeError(`I can't call a function here.`);
        // is it a subscript?
        if (expr.args) {
            // TODO: set array slice (HP BASIC)
            if (this.opts.arraysContainChars && expr.name.endsWith('$')) {
                this.runtimeError(`I can't set array slices via this command yet.`);
            }
            else {
                s += this.array2js(expr, opts);
            }
        }
        else { // just a variable
            s = `this.globals.${expr.name}`;
        }
        return s;
    }
    array2js(expr, opts) {
        var qname = JSON.stringify(expr.name);
        var args = expr.args || [];
        return this.expr2js(expr, { novalid: true }) // check array bounds
            + `;this.getArray(${qname}, ${args.length})`
            + args.map((arg) => '[this.ROUND(' + this.expr2js(arg, opts) + ')]').join('');
    }
    checkFuncArgs(expr, fn) {
        // TODO: check types?
        var nargs = expr.args ? expr.args.length : 0;
        // exceptions
        if (expr.name == 'RND' && nargs == 0)
            return;
        if (expr.name == 'MID$' && nargs == 2)
            return;
        if (expr.name == 'INSTR' && nargs == 2)
            return;
        if (fn.length != nargs)
            this.runtimeError(`I expected ${fn.length} arguments for the ${expr.name} function, but I got ${nargs}.`);
    }
    startForLoop(forname, init, targ, step, endpc) {
        // save start PC and label in case of hot reload (only works if FOR is first stmt in line)
        var looppc = this.curpc - 1;
        var looplabel = this.pc2label.get(looppc);
        if (!step)
            step = 1;
        this.vars[forname] = init;
        if (this.trace)
            console.log(`FOR ${forname} = ${init} TO ${targ} STEP ${step}`);
        // create done function
        var loopdone = () => {
            return step >= 0 ? this.vars[forname] > targ : this.vars[forname] < targ;
        };
        // skip entire for loop before first iteration? (Minimal BASIC)
        if (this.opts.testInitialFor && loopdone()) {
            if (endpc != null)
                this.curpc = endpc + 1;
            else
                this.skipToAfterNext(forname);
        }
        // save for var name on stack, remove existing entry
        if (this.forLoopStack[forname] != null)
            this.forLoopStack = this.forLoopStack.filter((n) => n == forname);
        this.forLoopStack.push(forname);
        // create for loop record
        this.forLoops[forname] = {
            $next: (nextname) => {
                if (nextname && forname != nextname)
                    this.runtimeError(`I executed NEXT "${nextname}", but the last FOR was for "${forname}".`);
                this.vars[forname] += step;
                var done = loopdone();
                if (done) {
                    // delete entry, pop FOR off the stack and continue
                    this.forLoopStack.pop();
                    delete this.forLoops[forname];
                }
                else {
                    // go back to FOR loop, adjusting for hot reload (fetch pc by label)
                    this.curpc = ((looplabel != null && this.label2pc[looplabel]) || looppc) + 1;
                }
                if (this.trace)
                    console.log(`NEXT ${forname}: ${this.vars[forname]} TO ${targ} STEP ${step} DONE=${done}`);
            }
        };
    }
    nextForLoop(name) {
        // get FOR loop entry, or get top of stack if NEXT var is optional 
        var fl = this.forLoops[name || (this.opts.optionalNextVar && this.forLoopStack[this.forLoopStack.length - 1])];
        if (!fl)
            this.runtimeError(`I couldn't find a matching FOR for this NEXT.`);
        fl.$next(name);
    }
    whileLoop(cond) {
        if (cond) {
            this.whileLoops.push(this.curpc - 1);
        }
        else {
            this.skipToAfterWend();
        }
    }
    nextWhileLoop() {
        var pc = this.whileLoops.pop();
        if (pc == null)
            this.runtimeError(`I couldn't find a matching WHILE for this WEND.`);
        else
            this.curpc = pc;
    }
    // converts a variable to string/number based on var name
    assign(name, right, isRead) {
        // convert data? READ always converts if read into string
        if (isRead && name.endsWith("$"))
            return this.checkValue(this.convert(name, right), name);
        // TODO: use options
        if (name.endsWith("$")) {
            return this.convertToString(right, name);
        }
        else {
            return this.convertToNumber(right, name);
        }
    }
    convert(name, right) {
        if (name.endsWith("$")) {
            return right == null ? "" : right.toString();
        }
        else if (typeof right === 'number') {
            return right;
        }
        else {
            return parseFloat(right + "");
        }
    }
    convertToString(right, name) {
        if (typeof right !== 'string')
            this.runtimeError(`I can't convert ${right} to a string.`);
        else
            return right;
    }
    convertToNumber(right, name) {
        if (typeof right !== 'number')
            this.runtimeError(`I can't convert ${right} to a number.`);
        else
            return this.checkNum(right);
    }
    // dimension array
    dimArray(name, ...dims) {
        // TODO: maybe do this check at compile-time?
        dims = dims.map(Math.round);
        if (this.arrays[name] != null) {
            if (this.opts.staticArrays)
                return;
            else
                this.runtimeError(`I already dimensioned this array (${name}) earlier.`);
        }
        var total = this.getTotalArrayLength(dims);
        if (total > this.opts.maxArrayElements)
            this.runtimeError(`I can't create an array with this many elements.`);
        var isstring = name.endsWith('$');
        // if numeric value, we use Float64Array which inits to 0
        var arrcons = isstring ? Array : Float64Array;
        if (dims.length == 1) {
            this.arrays[name] = new arrcons(dims[0] + 1);
        }
        else if (dims.length == 2) {
            this.arrays[name] = new Array(dims[0] + 1);
            for (var i = 0; i < dims[0] + 1; i++) {
                this.arrays[name][i] = new arrcons(dims[1] + 1);
            }
        }
        else {
            this.runtimeError(`I only support arrays of one or two dimensions.`);
        }
    }
    getTotalArrayLength(dims) {
        var n = 1;
        for (var i = 0; i < dims.length; i++) {
            if (dims[i] < this.opts.defaultArrayBase)
                this.runtimeError(`I can't create an array with a dimension less than ${this.opts.defaultArrayBase}.`);
            n *= dims[i];
        }
        return n;
    }
    getArray(name, order) {
        if (!this.arrays[name]) {
            if (this.opts.defaultArraySize == 0)
                this.dialectError(`automatically declare arrays without a DIM statement (or did you mean to call a function?)`);
            if (order == 1)
                this.dimArray(name, this.opts.defaultArraySize - 1);
            else if (order == 2)
                this.dimArray(name, this.opts.defaultArraySize - 1, this.opts.defaultArraySize - 1);
            else
                this.runtimeError(`I only support arrays of one or two dimensions.`); // TODO
        }
        return this.arrays[name];
    }
    arrayGet(name, ...indices) {
        var arr = this.getArray(name, indices.length);
        indices = indices.map(this.ROUND.bind(this));
        var v = arr;
        for (var i = 0; i < indices.length; i++) {
            var idx = indices[i];
            if (!(0, util_1.isArray)(v))
                this.runtimeError(`I tried to lookup ${name}(${indices}) but used too many dimensions.`);
            if (idx < this.opts.defaultArrayBase)
                this.runtimeError(`I tried to lookup ${name}(${indices}) but an index was less than ${this.opts.defaultArrayBase}.`);
            if (idx >= v.length) // TODO: also can happen when mispelling function name
                this.runtimeError(`I tried to lookup ${name}(${indices}) but it exceeded the dimensions of the array.`);
            v = v[indices[i]];
        }
        if ((0, util_1.isArray)(v)) // i.e. is an array?
            this.runtimeError(`I tried to lookup ${name}(${indices}) but used too few dimensions.`);
        return v;
    }
    // for HP BASIC string slicing (TODO?)
    modifyStringSlice(orig, add, start, end) {
        orig = orig || "";
        this.checkString(orig);
        this.checkString(add);
        if (!end)
            end = start;
        start = this.ROUND(start);
        end = this.ROUND(end);
        if (start < 1)
            this.dialectError(`accept a string slice index less than 1`);
        if (end < start)
            this.dialectError(`accept a string slice index less than the starting index`);
        return (orig + ' '.repeat(start)).substr(0, start - 1) + add.substr(0, end + 1 - start) + orig.substr(end);
    }
    getStringSlice(s, start, end) {
        s = this.checkString(s);
        start = this.ROUND(start);
        if (start < 1)
            this.dialectError(`accept a string slice index less than 1`);
        if (end != null) {
            end = this.ROUND(end);
            if (end < start)
                this.dialectError(`accept a string slice index less than the starting index`);
            return s.substr(start - 1, end + 1 - start);
        }
        else {
            return s.substr(start - 1);
        }
    }
    checkOnGoto(value, labels) {
        value = this.ROUND(value);
        if (value < 0) // > 255 ?
            this.runtimeError(`I needed a number between 1 and ${labels.length}, but I got ${value}.`);
        if (this.opts.checkOnGotoIndex && (value < 1 || value > labels.length))
            this.runtimeError(`I needed a number between 1 and ${labels.length}, but I got ${value}.`);
        if (value < 1 || value > labels.length)
            return 0;
        return value;
    }
    onGotoLabel(value, ...labels) {
        value = this.checkOnGoto(value, labels);
        if (value)
            this.gotoLabel(labels[value - 1]);
    }
    onGosubLabel(value, ...labels) {
        value = this.checkOnGoto(value, labels);
        if (value)
            this.gosubLabel(labels[value - 1]);
    }
    nextDatum() {
        if (this.dataptr >= this.datums.length)
            this.runtimeError("I tried to READ, but ran out of data.");
        return this.datums[this.dataptr++].value;
    }
    //// STATEMENTS
    do__PRINT(stmt) {
        var s = '';
        for (var arg of stmt.args) {
            var expr = this.expr2js(arg);
            var name = expr.name;
            s += `this.printExpr(this.checkValue(${expr}, ${JSON.stringify(name)}));`;
        }
        return s;
    }
    preInput() {
        this.running = false;
        this.curpc--;
    }
    postInput(valid) {
        if (valid)
            this.curpc++;
        this.running = true;
        this.resume();
    }
    do__INPUT(stmt) {
        var prompt = stmt.prompt != null ? this.expr2js(stmt.prompt) : '""';
        var elapsed = stmt.elapsed != null ? this.assign2js(stmt.elapsed) : "let ___";
        var setvals = '';
        stmt.args.forEach((arg, index) => {
            var lexpr = this.assign2js(arg);
            setvals += `
            var value = this.convert(${JSON.stringify(arg.name)}, response.vals[${index}]);
            valid &= this.isValid(value);
            ${lexpr} = value;
            `;
        });
        return `this.preInput();
                this.input(${prompt}, ${stmt.args.length}).then((response) => {
                    let valid = 1;
                    ${setvals}
                    this.postInput(valid);
                    this.column = 0; // assume linefeed
                    ${elapsed} = response.elapsed;
                })`;
    }
    do__LET(stmt) {
        var right = this.expr2js(stmt.right);
        var s = `let _right = ${right};`;
        for (var lexpr of stmt.lexprs) {
            // HP BASIC string-slice syntax?
            if (this.opts.arraysContainChars && lexpr.args && lexpr.name.endsWith('$')) {
                s += `this.globals.${lexpr.name} = this.modifyStringSlice(this.vars.${lexpr.name}, _right, `;
                s += lexpr.args.map((arg) => this.expr2js(arg)).join(', ');
                s += ');';
            }
            else {
                var ljs = this.assign2js(lexpr);
                s += `${ljs} = this.assign(${JSON.stringify(lexpr.name)}, _right);`;
            }
        }
        return s;
    }
    do__FOR(stmt) {
        var name = JSON.stringify(stmt.lexpr.name);
        var init = this.expr2js(stmt.initial);
        var targ = this.expr2js(stmt.target);
        var step = stmt.step ? this.expr2js(stmt.step) : 'null';
        return `this.startForLoop(${name}, ${init}, ${targ}, ${step}, ${stmt.endpc})`;
    }
    do__NEXT(stmt) {
        var name = stmt.lexpr && JSON.stringify(stmt.lexpr.name);
        return `this.nextForLoop(${name})`;
    }
    do__IF(stmt) {
        var cond = this.expr2js(stmt.cond);
        if (stmt.endpc != null)
            return `if (!(${cond})) { this.curpc = ${stmt.endpc}; }`;
        else
            return `if (!(${cond})) { this.skipToElse(); }`;
    }
    do__ELSE(stmt) {
        if (stmt.endpc != null)
            return `this.curpc = ${stmt.endpc}`;
        else
            return `this.skipToEOL()`;
    }
    do__WHILE(stmt) {
        var cond = this.expr2js(stmt.cond);
        if (stmt.endpc != null)
            return `if (!(${cond})) { this.curpc = ${stmt.endpc + 1}; }`;
        else
            return `this.whileLoop(${cond})`;
    }
    do__WEND(stmt) {
        if (stmt.startpc != null)
            return `this.curpc = ${stmt.startpc}`;
        else
            return `this.nextWhileLoop()`;
    }
    do__DEF(stmt) {
        var args = [];
        for (var arg of stmt.lexpr.args || []) {
            if (isLookup(arg)) {
                args.push(arg.name);
            }
            else {
                this.runtimeError("I found a DEF statement with arguments other than variable names.");
            }
        }
        var functext = this.expr2js(stmt.def, { locals: args });
        //this.defs[stmt.lexpr.name] = new Function(args.join(','), functext).bind(this);
        return `this.defs.${stmt.lexpr.name} = function(${args.join(',')}) { return ${functext}; }.bind(this)`;
    }
    _DIM(dim) {
        // HP BASIC doesn't really have string arrays, just strings
        if (this.opts.arraysContainChars && dim.name.endsWith('$'))
            return '';
        // dimension an array
        var argsstr = '';
        for (var arg of dim.args) {
            argsstr += ', ' + this.expr2js(arg, { isconst: this.opts.staticArrays });
        }
        return `this.dimArray(${JSON.stringify(dim.name)}${argsstr});`;
    }
    do__DIM(stmt) {
        if (this.opts.staticArrays)
            return; // DIM at reset()
        var s = '';
        stmt.args.forEach((dim) => s += this._DIM(dim));
        return s;
    }
    do__GOTO(stmt) {
        var label = this.expr2js(stmt.label);
        return `this.gotoLabel(${label})`;
    }
    do__GOSUB(stmt) {
        var label = this.expr2js(stmt.label);
        return `this.gosubLabel(${label})`;
    }
    do__RETURN(stmt) {
        return `this.returnFromGosub()`;
    }
    do__ONGOTO(stmt) {
        var expr = this.expr2js(stmt.expr);
        var labels = stmt.labels.map((arg) => this.expr2js(arg, { isconst: true })).join(', ');
        if (stmt.command == 'ONGOTO')
            return `this.onGotoLabel(${expr}, ${labels})`;
        else
            return `this.onGosubLabel(${expr}, ${labels})`;
    }
    do__ONGOSUB(stmt) {
        return this.do__ONGOTO(stmt);
    }
    do__DATA() {
        // data is preprocessed
    }
    do__READ(stmt) {
        var s = '';
        stmt.args.forEach((arg) => {
            s += `${this.assign2js(arg)} = this.assign(${JSON.stringify(arg.name)}, this.nextDatum(), true);`;
        });
        return s;
    }
    do__RESTORE(stmt) {
        if (stmt.label != null)
            return `this.dataptr = this.label2dataptr[${this.expr2js(stmt.label, { isconst: true })}] || 0`;
        else
            return `this.dataptr = 0`;
    }
    do__END() {
        return `this.skipToEOF()`;
    }
    do__STOP() {
        return `this.skipToEOF()`;
    }
    do__OPTION(stmt) {
        // already parsed in compiler
    }
    do__POP() {
        return `this.popReturnStack()`;
    }
    do__GET(stmt) {
        var lexpr = this.assign2js(stmt.lexpr);
        // TODO: single key input
        return `this.preInput();
                this.input().then((vals) => {
                    ${lexpr} = this.convert(${JSON.stringify(stmt.lexpr.name)}, vals[0]);
                    this.postInput(true);
                })`;
    }
    do__CLEAR() {
        return 'this.clearVars()';
    }
    do__RANDOMIZE() {
        return `this.rng.randomize()`;
    }
    do__CHANGE(stmt) {
        var arr2str = stmt.dest.name.endsWith('$');
        if (arr2str) { // array -> string
            let arrname = stmt.src.name || this.runtimeError("I can only change to a string from an array.");
            let dest = this.assign2js(stmt.dest);
            return `
            let arrname = ${JSON.stringify(arrname)};
            let len = this.arrayGet(arrname, 0);
            let s = '';
            for (let i=0; i<len; i++) {
                s += String.fromCharCode(this.arrayGet(arrname, i+1));
            }
            ${dest} = s;
            `;
        }
        else { // string -> array
            let src = this.expr2js(stmt.src);
            let dest = this.array2js(stmt.dest);
            return `
            let src = ${src}+"";
            ${dest}[0] = src.length;
            for (let i=0; i<src.length; i++) {
                ${dest}[i+1] = src.charCodeAt(i);
            }
            `;
        }
    }
    do__CONVERT(stmt) {
        var num2str = stmt.dest.name.endsWith('$');
        let src = this.expr2js(stmt.src);
        let dest = this.assign2js(stmt.dest);
        if (num2str) {
            return `${dest} = this.valueToString(${src}, false)`;
        }
        else {
            return `${dest} = this.VAL(${src})`;
        }
    }
    do__SUB(stmt) {
        this.subroutines[stmt.lexpr.name] = stmt;
        // skip the SUB definition
        return `this.curpc = ${stmt.endpc}`;
    }
    do__CALL(stmt) {
        var substmt = this.subroutines[stmt.call.name];
        if (substmt == null)
            this.runtimeError(`I can't find a subroutine named "${stmt.call.name}".`);
        var subargs = substmt.lexpr.args || [];
        var callargs = stmt.call.args || [];
        if (subargs.length != callargs.length)
            this.runtimeError(`I tried to call ${stmt.call.name} with the wrong number of parameters.`);
        var s = '';
        s += `this.gosubLabel(${JSON.stringify(stmt.call.name)});`;
        s += `this.newLocalScope();`;
        for (var i = 0; i < subargs.length; i++) {
            var arg = subargs[i];
            s += `this.vars.${arg.name} = ${this.expr2js(callargs[i])};`;
        }
        return s;
    }
    // TODO: ONERR, ON ERROR GOTO
    // TODO: memory quota
    // TODO: useless loop (! 4th edition)
    // TODO: other 4th edition errors
    // TODO: ecma55 all-or-none input checking?
    // FUNCTIONS
    isValid(obj) {
        if (typeof obj === 'number' && !isNaN(obj) && (!this.opts.checkOverflow || isFinite(obj)))
            return true;
        else if (typeof obj === 'string')
            return true;
        else
            return false;
    }
    checkValue(obj, exprname) {
        // check for unreferenced value
        if (typeof obj !== 'number' && typeof obj !== 'string') {
            // assign default value?
            if (obj == null && this.opts.defaultValues) {
                return exprname.endsWith("$") ? "" : 0;
            }
            if (exprname != null && obj == null) {
                this.runtimeError(`I haven't assigned a value to ${exprname}.`);
            }
            else if (exprname != null) {
                this.runtimeError(`I got an invalid value for ${exprname}: ${obj}`);
            }
            else {
                this.runtimeError(`I got an invalid value: ${obj}`);
            }
        }
        return obj;
    }
    getDef(exprname) {
        var fn = this.defs[exprname];
        if (!fn)
            this.runtimeError(`I haven't run a DEF statement for ${exprname}.`);
        return fn;
    }
    checkNum(n) {
        this.checkValue(n, 'this');
        if (n === Infinity)
            this.runtimeError(`I computed a number too big to store.`);
        if (isNaN(n))
            this.runtimeError(`I computed an invalid number.`);
        return n;
    }
    checkString(s) {
        this.checkValue(s, 'this');
        if (typeof s !== 'string')
            this.runtimeError(`I expected a string here.`);
        else if (s.length > this.opts.maxStringLength)
            this.dialectError(`create strings longer than ${this.opts.maxStringLength} characters`);
        return s;
    }
    add(a, b) {
        // TODO: if string-concat
        if (typeof a === 'number' && typeof b === 'number')
            return this.checkNum(a + b);
        else if (this.opts.stringConcat)
            return this.checkString(a + b);
        else
            this.dialectError(`use the "+" operator to concatenate strings`);
    }
    sub(a, b) {
        return this.checkNum(a - b);
    }
    mul(a, b) {
        return this.checkNum(a * b);
    }
    div(a, b) {
        if (b == 0)
            this.runtimeError(`I can't divide by zero.`);
        return this.checkNum(a / b);
    }
    idiv(a, b) {
        return this.FIX(this.INT(a) / this.INT(b));
    }
    mod(a, b) {
        return this.checkNum(a % b);
    }
    pow(a, b) {
        if (a == 0 && b < 0)
            this.runtimeError(`I can't raise zero to a negative power.`);
        return this.checkNum(Math.pow(a, b));
    }
    band(a, b) {
        return a & b;
    }
    bor(a, b) {
        return a | b;
    }
    bnot(a) {
        return ~a;
    }
    bxor(a, b) {
        return a ^ b;
    }
    bimp(a, b) {
        return this.bor(this.bnot(a), b);
    }
    beqv(a, b) {
        return this.bnot(this.bxor(a, b));
    }
    land(a, b) {
        return a && b ? (this.opts.bitwiseLogic ? -1 : 1) : 0;
    }
    lor(a, b) {
        return a || b ? (this.opts.bitwiseLogic ? -1 : 1) : 0;
    }
    lnot(a) {
        return a ? 0 : (this.opts.bitwiseLogic ? -1 : 1);
    }
    neg(a) {
        return -a;
    }
    eq(a, b) {
        return a == b ? (this.opts.bitwiseLogic ? -1 : 1) : 0;
    }
    ne(a, b) {
        return a != b ? (this.opts.bitwiseLogic ? -1 : 1) : 0;
    }
    lt(a, b) {
        return a < b ? (this.opts.bitwiseLogic ? -1 : 1) : 0;
    }
    gt(a, b) {
        return a > b ? (this.opts.bitwiseLogic ? -1 : 1) : 0;
    }
    le(a, b) {
        return a <= b ? (this.opts.bitwiseLogic ? -1 : 1) : 0;
    }
    ge(a, b) {
        return a >= b ? (this.opts.bitwiseLogic ? -1 : 1) : 0;
    }
    min(a, b) {
        return a < b ? a : b;
    }
    max(a, b) {
        return a > b ? a : b;
    }
    // FUNCTIONS (uppercase)
    // TODO: swizzle names for type-checking
    ABS(arg) {
        return this.checkNum(Math.abs(arg));
    }
    ASC(arg) {
        arg = this.checkString(arg);
        if (arg == '')
            this.runtimeError(`I tried to call ASC() on an empty string.`);
        return arg.charCodeAt(0);
    }
    ATN(arg) {
        return this.checkNum(Math.atan(arg));
    }
    CHR$(arg) {
        return String.fromCharCode(this.checkNum(arg));
    }
    CINT(arg) {
        return this.ROUND(arg);
    }
    COS(arg) {
        return this.checkNum(Math.cos(arg));
    }
    COT(arg) {
        return this.checkNum(1.0 / Math.tan(arg)); // 4th edition only
    }
    CTL(arg) {
        return this.CHR$(arg);
    }
    EXP(arg) {
        return this.checkNum(Math.exp(arg));
    }
    FIX(arg) {
        return this.checkNum(arg < 0 ? Math.ceil(arg) : Math.floor(arg));
    }
    HEX$(arg) {
        return this.ROUND(arg).toString(16);
    }
    INSTR(a, b, c) {
        if (c != null) {
            return this.checkString(b).indexOf(this.checkString(c), this.checkNum(a) - 1) + 1;
        }
        else {
            return this.checkString(a).indexOf(this.checkString(b)) + 1;
        }
    }
    INT(arg) {
        return this.checkNum(Math.floor(arg));
    }
    LEFT$(arg, count) {
        arg = this.checkString(arg);
        count = this.ROUND(count);
        return arg.substr(0, count);
    }
    LEN(arg) {
        return this.checkString(arg).length;
    }
    LIN(arg) {
        return this.STRING$(arg, '\n');
    }
    LOG(arg) {
        if (arg == 0)
            this.runtimeError(`I can't take the logarithm of zero (${arg}).`);
        if (arg < 0)
            this.runtimeError(`I can't take the logarithm of a negative number (${arg}).`);
        return this.checkNum(Math.log(arg));
    }
    LOG10(arg) {
        if (arg == 0)
            this.runtimeError(`I can't take the logarithm of zero (${arg}).`);
        if (arg < 0)
            this.runtimeError(`I can't take the logarithm of a negative number (${arg}).`);
        return this.checkNum(Math.log10(arg));
    }
    MID$(arg, start, count) {
        arg = this.checkString(arg);
        if (!count)
            count = arg.length;
        start = this.ROUND(start);
        count = this.ROUND(count);
        if (start < 1)
            this.runtimeError(`I can't compute MID$ if the starting index is less than 1.`);
        return arg.substr(start - 1, count);
    }
    OCT$(arg) {
        return this.ROUND(arg).toString(8);
    }
    PI() {
        return Math.PI;
    }
    // TODO: POS(haystack, needle, start)
    POS(arg1, arg2) {
        if (typeof arg1 == 'string' && typeof arg2 == 'string')
            return arg1.indexOf(arg2) >= 0 + 1;
        else
            return this.column + 1;
    }
    RIGHT$(arg, count) {
        arg = this.checkString(arg);
        count = this.ROUND(count);
        return arg.substr(arg.length - count, count);
    }
    RND(arg) {
        // TODO: X<0 restart w/ seed, X=0 repeats
        if (arg < 0)
            this.rng.seedfloat(arg);
        return this.rng.next();
    }
    ROUND(arg) {
        return this.checkNum(Math.round(arg));
    }
    SGN(arg) {
        this.checkNum(arg);
        return (arg < 0) ? -1 : (arg > 0) ? 1 : 0;
    }
    SIN(arg) {
        return this.checkNum(Math.sin(arg));
    }
    SPACE$(arg) {
        return this.STRING$(arg, ' ');
    }
    SPC(arg) {
        return this.SPACE$(arg);
    }
    SQR(arg) {
        if (arg < 0)
            this.runtimeError(`I can't take the square root of a negative number (${arg}).`);
        return this.checkNum(Math.sqrt(arg));
    }
    STR$(arg) {
        return this.valueToString(this.checkNum(arg), false);
    }
    STRING$(len, chr) {
        len = this.ROUND(len);
        if (len <= 0)
            return '';
        if (len > this.opts.maxStringLength)
            this.dialectError(`create a string longer than ${this.opts.maxStringLength} characters`);
        if (typeof chr === 'string')
            return chr.substr(0, 1).repeat(len);
        else
            return String.fromCharCode(chr).repeat(len);
    }
    TAB(arg) {
        if (arg < 1) {
            arg = 1;
        } // TODO: SYSTEM MESSAGE IDENTIFYING THE EXCEPTION
        var spaces = this.ROUND(arg) - 1 - this.column;
        return this.SPACE$(spaces);
    }
    TAN(arg) {
        return this.checkNum(Math.tan(arg));
    }
    TIM(arg) {
        var d = new Date();
        switch (this.ROUND(arg)) {
            case 0: return d.getMinutes();
            case 1: return d.getHours();
            case 2:
                var dayCount = [0, 31, 59, 90, 120, 151, 181, 212, 243, 273, 304, 334];
                var mn = d.getMonth();
                var dn = d.getDate();
                var dayOfYear = dayCount[mn] + dn;
                var isLeapYear = (d.getFullYear() & 3) == 0; // TODO: wrong
                if (mn > 1 && isLeapYear)
                    dayOfYear++;
                return dayOfYear;
            case 3: return d.getFullYear() % 100; // Y@K!
            case 4: return d.getSeconds();
            default: return 0;
        }
    }
    TIMER() {
        return Date.now() / 1000;
    }
    UPS$(arg) {
        return this.checkString(arg).toUpperCase();
    }
    VAL(arg) {
        var n = parseFloat(this.checkString(arg));
        return isNaN(n) ? 0 : n; // TODO? altair works this way
    }
    LPAD$(arg, len) {
        arg = this.checkString(arg);
        while (arg.length < len)
            arg = " " + arg;
        return arg;
    }
    RPAD$(arg, len) {
        arg = this.checkString(arg);
        while (arg.length < len)
            arg = arg + " ";
        return arg;
    }
    NFORMAT$(arg, numlen) {
        var s = this.float2str(arg, numlen);
        return (numlen > 0) ? this.LPAD$(s, numlen) : this.RPAD$(s, -numlen);
    }
}
exports.BASICRuntime = BASICRuntime;
//# sourceMappingURL=runtime.js.map