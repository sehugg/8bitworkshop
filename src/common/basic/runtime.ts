
import * as basic from "./compiler";
import { EmuHalt } from "../emu";
import { SourceLocation } from "../workertypes";

function isLiteral(arg: basic.Expr): arg is basic.Literal {
    return (arg as any).value != null;
}
function isLookup(arg: basic.Expr): arg is basic.IndOp {
    return (arg as any).name != null;
}
function isBinOp(arg: basic.Expr): arg is basic.BinOp {
    return (arg as any).op != null && (arg as any).left != null && (arg as any).right != null;
}
function isUnOp(arg: basic.Expr): arg is basic.UnOp {
    return (arg as any).op != null && (arg as any).expr != null;
}

class ExprOptions {
    isconst?: boolean;
    locals?: string[];
}

interface CompiledStatement {
    $run?: () => void;
}

export class BASICRuntime {

    program : basic.BASICProgram;
    allstmts : basic.Statement[];
    line2pc : number[];
    pc2line : Map<number,number>;
    label2lineidx : {[label : string] : number};
    label2pc : {[label : string] : number};
    datums : basic.Literal[];
    builtins : {};
    opts : basic.BASICOptions;

    curpc : number;
    dataptr : number;
    vars : {};
    arrays : {};
    defs : {};
    forLoops : {varname:string, next:(name:string) => void}[];
    returnStack : number[];
    column : number;

    running : boolean = false;
    exited : boolean = true;
    trace : boolean = false;

    load(program: basic.BASICProgram) {
        let prevlabel = this.label2pc && this.getLabelForPC(this.curpc);
        this.program = program;
        this.opts = program.opts;
        this.label2lineidx = {};
        this.label2pc = {};
        this.allstmts = [];
        this.line2pc = [];
        this.pc2line = new Map();
        this.datums = [];
        this.builtins = this.getBuiltinFunctions();
        // TODO: lines start @ 1?
        program.lines.forEach((line, idx) => {
            // make lookup tables
            this.curpc = this.allstmts.length + 1; // set for error reporting
            if (line.label != null) this.label2lineidx[line.label] = idx;
            if (line.label != null) this.label2pc[line.label] = this.allstmts.length;
            this.line2pc.push(this.allstmts.length);
            this.pc2line.set(this.allstmts.length, idx);
            // combine all statements into single list
            line.stmts.forEach((stmt) => this.allstmts.push(stmt));
            // parse DATA literals
            line.stmts.filter((stmt) => stmt.command == 'DATA').forEach((datastmt) => {
                (datastmt as basic.DATA_Statement).datums.forEach(d => {
                    var functext = this.expr2js(d, {isconst:true});
                    var value = new Function(`return ${functext};`).bind(this)();
                    this.datums.push({value:value});
                });
            });
            // compile statements ahead of time
            line.stmts.forEach((stmt) => this.compileStatement(stmt));
        });
        // try to resume where we left off after loading
        this.curpc = this.label2pc[prevlabel] || 0;
        this.dataptr = Math.min(this.dataptr, this.datums.length);
    }

    reset() {
        this.curpc = 0;
        this.dataptr = 0;
        this.vars = {};
        this.arrays = {};
        this.defs = {};
        this.forLoops = [];
        this.returnStack = [];
        this.column = 0;
        this.running = true;
        this.exited = false;
    }

    getBuiltinFunctions() {
        var fnames = this.program && this.opts.validFunctions;
        // if no valid function list, look for ABC...() functions in prototype
        if (!fnames) fnames = Object.keys(BASICRuntime.prototype).filter((name) => /^[A-Z]{3,}[$]?$/.test(name));
        var dict = {};
        for (var fn of fnames) if (this[fn]) dict[fn] = this[fn].bind(this);
        return dict;
    }

    runtimeError(msg : string) {
        this.curpc--; // we did curpc++ before executing statement
        throw new EmuHalt(msg, this.getCurrentSourceLocation());
    }
    
    dialectError(what : string) {
        this.runtimeError(`I can't ${what} in this dialect of BASIC.`);
    }

    getLineForPC(pc:number) {
        var line;
        do {
            line = this.pc2line.get(pc);
            if (line != null) break;
        } while (--pc >= 0);
        return line;
    }

    getLabelForPC(pc:number) {
        var lineno = this.getLineForPC(pc);
        var pgmline = this.program.lines[lineno];
        return pgmline ? pgmline.label : '?';
    }

    getCurrentSourceLocation() : SourceLocation {
        var stmt = this.getStatement();
        return stmt && stmt.$loc;
    }

    getStatement() {
        return this.allstmts[this.curpc];
    }

    step() : boolean {
        if (!this.running) return false;
        var stmt = this.getStatement();
        // end of program?
        if (!stmt) {
            this.running = false;
            this.exited = true;
            return false;
        }
        if (this.trace) console.log(this.curpc, stmt, this.vars, Object.keys(this.arrays));
        // skip to next statment
        this.curpc++;
        // compile (unless cached) and execute statement
        this.compileStatement(stmt);
        this.executeStatement(stmt);
        return this.running;
    }

    compileStatement(stmt: basic.Statement & CompiledStatement) {
        if (stmt.$run == null) {
            try {
                var stmtfn = this['do__' + stmt.command];
                if (stmtfn == null) this.runtimeError(`I don't know how to "${stmt.command}".`);
                var functext = stmtfn.bind(this)(stmt);
                if (this.trace) console.log(functext);
                stmt.$run = new Function(functext).bind(this);
            } catch (e) {
                console.log(functext);
                throw e;
            }
        }
    }
    executeStatement(stmt: basic.Statement & CompiledStatement) {
        // run compiled statement
        stmt.$run();
    }

    skipToEOL() {
        do {
            this.curpc++;
        } while (this.curpc < this.allstmts.length && !this.pc2line.get(this.curpc));
    }

    skipToElse() {
        do {
            // in Altair BASIC, ELSE is bound to the right-most IF
            // TODO: this is complicated, we should just have nested expressions
            if (this.opts.ifElse) {
                var cmd = this.allstmts[this.curpc].command;
                if (cmd == 'ELSE') { this.curpc++; break; }
                else if (cmd == 'IF') return this.skipToEOL();
            }
            this.curpc++;
        } while (this.curpc < this.allstmts.length && !this.pc2line.get(this.curpc));
    }

    skipToEOF() {
        this.curpc = this.allstmts.length;
    }

    gotoLabel(label) {
        var pc = this.label2pc[label];
        if (pc >= 0) {
            this.curpc = pc;
        } else {
            this.runtimeError(`I tried to go to the label "${label}" but couldn't find it.`);
        }
    }

    gosubLabel(label) {
        this.returnStack.push(this.curpc);
        this.gotoLabel(label);
    }

    returnFromGosub() {
        if (this.returnStack.length == 0)
            this.runtimeError("I tried to RETURN, but there wasn't a corresponding GOSUB."); // RETURN BEFORE GOSUB
        var pc = this.returnStack.pop();
        this.curpc = pc;
    }

    popReturnStack() {
        if (this.returnStack.length == 0)
            this.runtimeError("I tried to POP, but there wasn't a corresponding GOSUB.");
        this.returnStack.pop();
    }
    
    valueToString(obj) : string {
        var str;
        if (typeof obj === 'number') {
            var numstr = obj.toString().toUpperCase();
            var numlen = this.opts.printZoneLength - 4;
            var prec = numlen;
            while (numstr.length > numlen) {
                numstr = obj.toPrecision(prec--);
            }
            if (numstr.startsWith('0.'))
                numstr = numstr.substr(1);
            else if (numstr.startsWith('-0.'))
                numstr = '-'+numstr.substr(2);
            if (!this.opts.numericPadding)
                str = numstr;
            else if (numstr.startsWith('-'))
                str = `${numstr} `;
            else
                str = ` ${numstr} `;
        } else if (obj == '\n') {
            this.column = 0;
            str = obj;
        } else if (obj == '\t') {
            var curgroup = Math.floor(this.column / this.opts.printZoneLength);
            var nextcol = (curgroup + 1) * this.opts.printZoneLength;
            str = this.TAB(nextcol);
        } else {
            str = `${obj}`;
        }
        return str;
    }

    printExpr(obj) {
        var str = this.valueToString(obj);
        this.column += str.length;
        this.print(str);
    }

    // override this
    print(str: string) {
        console.log(str);
    }

    // override this
    async input(prompt: string, nargs: number) : Promise<string[]> {
        return [];
    }

    // override this
    resume() { }

    expr2js(expr: basic.Expr, opts?: ExprOptions) : string {
        if (!opts) opts = {};
        if (isLiteral(expr)) {
            return JSON.stringify(expr.value);
        } else if (isLookup(expr)) {
            if (!expr.args && opts.locals && opts.locals.indexOf(expr.name) >= 0) {
                return expr.name; // local arg in DEF
            } else {
                if (opts.isconst) this.runtimeError(`I expected a constant value here.`);
                var s = this.assign2js(expr, opts);
                return `this.checkValue(${s}, ${JSON.stringify(expr.name)})`;
            }
        } else if (isBinOp(expr)) {
            var left = this.expr2js(expr.left, opts);
            var right = this.expr2js(expr.right, opts);
            return `this.${expr.op}(${left}, ${right})`;
        } else if (isUnOp(expr)) {
            var e = this.expr2js(expr.expr, opts);
            return `this.${expr.op}(${e})`;
        }
    }

    assign2js(expr: basic.IndOp, opts?: ExprOptions) {
        if (!opts) opts = {};
        var s = '';
        var qname = JSON.stringify(expr.name);
        if (expr.name.startsWith("FN")) { // is it a user-defined function?
            // TODO: check argument count?
            let jsargs = expr.args && expr.args.map((arg) => this.expr2js(arg, opts)).join(', ');
            s += `this.getDef(${qname})(${jsargs})`;
            // TODO: detect recursion?
        } else if (this.builtins[expr.name]) { // is it a built-in function?
            this.checkFuncArgs(expr, this.builtins[expr.name]);
            let jsargs = expr.args && expr.args.map((arg) => this.expr2js(arg, opts)).join(', ');
            s += `this.builtins.${expr.name}(${jsargs})`;
        } else if (expr.args) { // is it a subscript?
            // TODO: check array bounds?
            s += `this.getArray(${qname}, ${expr.args.length})`;
            s += expr.args.map((arg) => '[this.ROUND('+this.expr2js(arg, opts)+')]').join('');
        } else { // just a variable
            s = `this.vars.${expr.name}`;
        }
        return s;
    }

    checkFuncArgs(expr: basic.IndOp, fn: Function) {
        // TODO: check types?
        var nargs = expr.args ? expr.args.length : 0;
        if (expr.name == 'MID$' && nargs == 2) return;
        if (expr.name == 'INSTR' && nargs == 2) return;
        if (fn.length != nargs)
            this.runtimeError(`I expected ${fn.length} arguments for the ${expr.name} function, but I got ${nargs}.`);
    }

    startForLoop(forname, init, targ, step) {
        // TODO: support 0-iteration loops
        var pc = this.curpc;
        if (!step) step = 1;
        this.vars[forname] = init;
        if (this.trace) console.log(`FOR ${forname} = ${init} TO ${targ} STEP ${step}`);
        this.forLoops.unshift({
            varname: forname,
            next: (nextname:string) => {
                if (nextname && forname != nextname)
                    this.runtimeError(`I executed NEXT "${nextname}", but the last FOR was for "${forname}".`)
                this.vars[forname] += step;
                var done = step >= 0 ? this.vars[forname] > targ : this.vars[forname] < targ;
                if (done) {
                    this.forLoops.shift(); // pop FOR off the stack and continue
                } else {
                    this.curpc = pc; // go back to FOR location
                }
                if (this.trace) console.log(`NEXT ${forname}: ${this.vars[forname]} TO ${targ} STEP ${step} DONE=${done}`);
            }
        });
    }

    nextForLoop(name) {
        var fl = this.forLoops[0];
        if (fl != null && name != null && fl.varname != name) {
            if (!this.opts.outOfOrderNext) this.dialectError(`execute out-of-order NEXT statements`);
            while (fl) {
                if (fl.varname == name) break;
                this.forLoops.shift();
                fl = this.forLoops[0];
            }
        }
        if (!fl) this.runtimeError(`I couldn't find a FOR for this NEXT.`)
        fl.next(name);
    }

    // converts a variable to string/number based on var name
    assign(name: string, right: number|string) : number|string {
        if (this.opts.typeConvert)
            return this.convert(name, right);
        // TODO: use options
        if (name.endsWith("$")) {
            return this.convertToString(right, name);
        } else {
            return this.convertToNumber(right, name);
        }
    }

    convert(name: string, right: number|string) : number|string {
        if (name.endsWith("$")) {
            return right+"";
        } else if (typeof right === 'number') {
            return right;
        } else {
            return parseFloat(right+"");
        }
    }

    convertToString(right: number|string, name?: string) {
        if (typeof right !== 'string') this.runtimeError(`I can't convert ${right} to a string.`);
        else return right;
    }

    convertToNumber(right: number|string, name?: string) {
        if (typeof right !== 'number') this.runtimeError(`I can't convert ${right} to a number.`);
        else return this.checkNum(right);
    }

    // dimension array
    dimArray(name: string, ...dims:number[]) {
        // TODO: maybe do this check at compile-time?
        if (this.arrays[name]) this.runtimeError(`I already dimensioned this array (${name}) earlier.`)
        var isstring = name.endsWith('$');
        // if defaultValues is true, we use Float64Array which inits to 0
        var arrcons = isstring || !this.opts.defaultValues ? Array : Float64Array;
        // TODO? var ab = this.opts.defaultArrayBase;
        if (dims.length == 1) {
            this.arrays[name] = new arrcons(dims[0]+1);
        } else if (dims.length == 2) {
            this.arrays[name] = new Array(dims[0]+1);
            for (var i=0; i<dims[0]+1; i++)
                this.arrays[name][i] = new arrcons(dims[1]+1);
        } else {
            this.runtimeError(`I only support arrays of one or two dimensions.`)
        }
    }

    getArray(name: string, order: number) : [] {
        if (!this.arrays[name]) {
            if (order == 1)
                this.dimArray(name, this.opts.defaultArraySize);
            else if (order == 2)
                this.dimArray(name, this.opts.defaultArraySize, this.opts.defaultArraySize);
            else
                this.runtimeError(`I only support arrays of one or two dimensions.`); // TODO
        }
        return this.arrays[name];
    }

    onGotoLabel(value: number, ...labels: string[]) {
        value = this.ROUND(value);
        if (value < 1 || value > labels.length)
            this.runtimeError(`I needed a number between 1 and ${labels.length}, but I got ${value}.`);
        this.gotoLabel(labels[value-1]);
    }

    nextDatum() : basic.Value {
        if (this.dataptr >= this.datums.length)
            this.runtimeError("I tried to READ, but ran out of data.");
        return this.datums[this.dataptr++].value;
    }

    //// STATEMENTS

    do__PRINT(stmt : basic.PRINT_Statement) {
        var s = '';
        for (var arg of stmt.args) {
            var expr = this.expr2js(arg);
            s += `this.printExpr(${expr});`;
        }
        return s;
    }

    do__INPUT(stmt : basic.INPUT_Statement) {
        var prompt = this.expr2js(stmt.prompt);
        var setvals = '';
        stmt.args.forEach((arg, index) => {
            var lexpr = this.assign2js(arg);
            setvals += `valid &= this.isValid(${lexpr} = this.convert(${JSON.stringify(arg.name)}, vals[${index}]));`
        });
        return `this.running=false;
                this.input(${prompt}, ${stmt.args.length}).then((vals) => {
                    let valid = 1;
                    ${setvals}
                    if (!valid) this.curpc--;
                    this.running=true;
                    this.resume();
                })`;
    }

    do__LET(stmt : basic.LET_Statement) {
        // TODO: range-checking for subscripts (get and set)
        var lexpr = this.assign2js(stmt.lexpr);
        var right = this.expr2js(stmt.right);
        return `${lexpr} = this.assign(${JSON.stringify(stmt.lexpr.name)}, ${right});`;
    }

    do__FOR(stmt : basic.FOR_Statement) {
        var name = JSON.stringify(stmt.lexpr.name); // TODO: args?
        var init = this.expr2js(stmt.initial);
        var targ = this.expr2js(stmt.target);
        var step = stmt.step ? this.expr2js(stmt.step) : 'null';
        return `this.startForLoop(${name}, ${init}, ${targ}, ${step})`;
    }

    do__NEXT(stmt : basic.NEXT_Statement) {
        var name = stmt.lexpr && JSON.stringify(stmt.lexpr.name); // TODO: args? lexpr == null?
        return `this.nextForLoop(${name})`;
    }

    do__IF(stmt : basic.IF_Statement) {
        var cond = this.expr2js(stmt.cond);
        return `if (!(${cond})) { this.skipToElse(); }`
    }

    do__ELSE() {
        return `this.skipToEOL()`
    }

    do__DEF(stmt : basic.DEF_Statement) {
        var args = [];
        for (var arg of stmt.lexpr.args || []) {
            if (isLookup(arg)) {
                args.push(arg.name);
            } else {
                this.runtimeError("I found a DEF statement with arguments other than variable names.");
            }
        }
        var functext = this.expr2js(stmt.def, {locals:args});
        //this.defs[stmt.lexpr.name] = new Function(args.join(','), functext).bind(this);
        return `this.defs.${stmt.lexpr.name} = function(${args.join(',')}) { return ${functext}; }.bind(this)`;
    }

    _DIM(dim : basic.IndOp) {
        var argsstr = '';
        for (var arg of dim.args) {
            // TODO: check for float (or at compile time)
            argsstr += ', ' + this.expr2js(arg);
        }
        return `this.dimArray(${JSON.stringify(dim.name)}${argsstr});`;
    }

    do__DIM(stmt : basic.DIM_Statement) {
        var s = '';
        stmt.args.forEach((dim) => s += this._DIM(dim));
        return s;
    }

    do__GOTO(stmt : basic.GOTO_Statement) {
        var label = this.expr2js(stmt.label, {isconst:true});
        return `this.gotoLabel(${label})`;
    }

    do__GOSUB(stmt : basic.GOSUB_Statement) {
        var label = this.expr2js(stmt.label, {isconst:true});
        return `this.gosubLabel(${label})`;
    }

    do__RETURN(stmt : basic.RETURN_Statement) {
        return `this.returnFromGosub()`;
    }

    do__ONGOTO(stmt : basic.ONGOTO_Statement) {
        var expr = this.expr2js(stmt.expr);
        var labels = stmt.labels.map((arg) => this.expr2js(arg, {isconst:true})).join(', ');
        return `this.onGotoLabel(${expr}, ${labels})`;
    }

    do__DATA() {
        // data is preprocessed
    }

    do__READ(stmt : basic.READ_Statement) {
        var s = '';
        stmt.args.forEach((arg) => {
            s += `${this.assign2js(arg)} = this.assign(${JSON.stringify(arg.name)}, this.nextDatum());`;
        });
        return s;
    }

    do__RESTORE() {
        return `this.dataptr = 0`;
    }

    do__END() {
        return `this.skipToEOF()`;
    }

    do__STOP() {
        return `this.skipToEOF()`;
    }

    do__OPTION(stmt: basic.OPTION_Statement) {
        // already parsed in compiler
    }

    do__POP() {
        return `this.popReturnStack()`;
    }

    do__GET(stmt : basic.GET_Statement) {
        var lexpr = this.assign2js(stmt.lexpr);
        // TODO: single key input
        return `this.running=false;
                this.input().then((vals) => {
                    ${lexpr} = this.convert(${JSON.stringify(stmt.lexpr.name)}, vals[0]);
                    this.running=true;
                    this.resume();
                })`;
    }

    // TODO: ONERR, ON ERROR GOTO
    // TODO: "SUBSCRIPT ERROR" (range check)
    // TODO: gosubs nested too deeply
    // TODO: memory quota
    // TODO: useless loop (! 4th edition)
    // TODO: other 4th edition errors


    // FUNCTIONS

    isValid(obj:number|string) : boolean {
        if (typeof obj === 'number' && !isNaN(obj))
            return true;
        else if (typeof obj === 'string')
            return true;
        else
            return false;
    }
    checkValue(obj:number|string, exprname:string) : number|string {
        // check for unreferenced value
        if (typeof obj !== 'number' && typeof obj !== 'string') {
            // assign default value?
            if (obj == null && this.opts.defaultValues) {
                return exprname.endsWith("$") ? "" : 0;
            }
            if (exprname != null && obj == null) {
                this.runtimeError(`I haven't set a value for ${exprname}.`);
            } else if (exprname != null) {
                this.runtimeError(`I got an invalid value for ${exprname}: ${obj}`);
            } else {
                this.runtimeError(`I got an invalid value: ${obj}`);
            }
        }
        return obj;
    }
    getDef(exprname: string) {
        var fn = this.defs[exprname];
        if (!fn) this.runtimeError(`I haven't run a DEF statement for ${exprname}.`);
        return fn;
    }
    checkNum(n:number) : number {
        if (n === Infinity) this.runtimeError(`I computed a number too big to store.`);
        if (isNaN(n)) this.runtimeError(`I computed an invalid number.`);
        return n;
    }
    checkString(s:string) : string {
        if (typeof s !== 'string')
            this.runtimeError(`I expected a string here.`);
        else if (s.length > this.opts.maxStringLength)
            this.dialectError(`create strings longer than ${this.opts.maxStringLength} characters`);
        return s;
    }
    
    add(a, b) : number|string {
        // TODO: if string-concat
        if (typeof a === 'number' && typeof b === 'number')
            return this.checkNum(a + b);
        else if (this.opts.stringConcat)
            return this.checkString(a + b);
        else
            this.dialectError(`use the "+" operator to concatenate strings`)
    }
    sub(a:number, b:number) : number {
        return this.checkNum(a - b);
    }
    mul(a:number, b:number) : number {
        return this.checkNum(a * b);
    }
    div(a:number, b:number) : number {
        if (b == 0) this.runtimeError(`I can't divide by zero.`);
        return this.checkNum(a / b);
    }
    idiv(a:number, b:number) : number {
        return this.FIX(this.INT(a) / this.INT(b));
    }
    mod(a:number, b:number) : number {
        return this.checkNum(a % b);
    }
    pow(a:number, b:number) : number {
        if (a == 0 && b < 0) this.runtimeError(`I can't raise zero to a negative power.`);
        return this.checkNum(Math.pow(a, b));
    }
    band(a:number, b:number) : number {
        return a & b;
    }
    bor(a:number, b:number) : number {
        return a | b;
    }
    bnot(a:number) : number {
        return ~a;
    }
    bxor(a:number, b:number) : number {
        return a ^ b;
    }
    bimp(a:number, b:number) : number {
        return this.bor(this.bnot(a), b);
    }
    beqv(a:number, b:number) : number {
        return this.bnot(this.bxor(a, b));
    }
    land(a:number, b:number) : number {
        return a && b ? (this.opts.bitwiseLogic ? -1 : 1) : 0;
    }
    lor(a:number, b:number) : number {
        return a || b ? (this.opts.bitwiseLogic ? -1 : 1) : 0;
    }
    lnot(a:number) : number {
        return a ? 0 : (this.opts.bitwiseLogic ? -1 : 1);
    }
    neg(a:number) : number {
        return -a;
    }
    eq(a:number, b:number) : number {
        return a == b ? (this.opts.bitwiseLogic ? -1 : 1) : 0;
    }
    ne(a:number, b:number) : number {
        return a != b ? (this.opts.bitwiseLogic ? -1 : 1) : 0;
    }
    lt(a:number, b:number) : number {
        return a < b ? (this.opts.bitwiseLogic ? -1 : 1) : 0;
    }
    gt(a:number, b:number) : number {
        return a > b ? (this.opts.bitwiseLogic ? -1 : 1) : 0;
    }
    le(a:number, b:number) : number {
        return a <= b ? (this.opts.bitwiseLogic ? -1 : 1) : 0;
    }
    ge(a:number, b:number) : number {
        return a >= b ? (this.opts.bitwiseLogic ? -1 : 1) : 0;
    }

    // FUNCTIONS (uppercase)

    ABS(arg : number) : number {
        return this.checkNum(Math.abs(arg));
    }
    ASC(arg : string) : number {
        return arg.charCodeAt(0);
    }
    ATN(arg : number) : number {
        return this.checkNum(Math.atan(arg));
    }
    CHR$(arg : number) : string {
        return String.fromCharCode(this.checkNum(arg));
    }
    COS(arg : number) : number {
        return this.checkNum(Math.cos(arg));
    }
    COT(arg : number) : number {
        return this.checkNum(1.0 / Math.tan(arg)); // 4th edition only
    }
    EXP(arg : number) : number {
        return this.checkNum(Math.exp(arg));
    }
    FIX(arg : number) : number {
        return this.checkNum(arg < 0 ? Math.ceil(arg) : Math.floor(arg));
    }
    HEX$(arg : number) : string {
        return arg.toString(16);
    }
    INSTR(a, b, c) : number {
        if (c != null) {
            return this.checkString(c).indexOf(this.checkString(b), a) + 1;
        } else {
            return this.checkString(b).indexOf(this.checkString(a)) + 1;
        }
    }
    INT(arg : number) : number {
        return this.checkNum(Math.floor(arg));
    }
    LEFT$(arg : string, count : number) : string {
        return arg.substr(0, count);
    }
    LEN(arg : string) : number {
        return arg.length;
    }
    LOG(arg : number) : number {
        if (arg == 0) this.runtimeError(`I can't take the logarithm of zero (${arg}).`)
        if (arg < 0) this.runtimeError(`I can't take the logarithm of a negative number (${arg}).`)
        return this.checkNum(Math.log(arg));
    }
    MID$(arg : string, start : number, count : number) : string {
        if (start < 1) this.runtimeError(`I can't compute MID$ if the starting index is less than 1.`)
        if (count == 0) count = arg.length;
        return arg.substr(start-1, count);
    }
    RIGHT$(arg : string, count : number) : string {
        return arg.substr(arg.length - count, count);
    }
    RND(arg : number) : number {
        return Math.random(); // argument ignored
    }
    ROUND(arg : number) : number {
        return this.checkNum(Math.round(arg));
    }
    SGN(arg : number) : number {
        return (arg < 0) ? -1 : (arg > 0) ? 1 : 0;
    }
    SIN(arg : number) : number {
        return this.checkNum(Math.sin(arg));
    }
    SPACE$(arg : number) : string {
        return (arg > 0) ? ' '.repeat(this.checkNum(arg)) : '';
    }
    SQR(arg : number) : number {
        if (arg < 0) this.runtimeError(`I can't take the square root of a negative number (${arg}).`)
        return this.checkNum(Math.sqrt(arg));
    }
    STR$(arg : number) : string {
        return this.valueToString(this.checkNum(arg));
    }
    TAB(arg : number) : string {
        if (arg < 1) { arg = 1; } // TODO: SYSTEM MESSAGE IDENTIFYING THE EXCEPTION
        var spaces = this.ROUND(arg) - 1 - this.column;
        return (spaces > 0) ? ' '.repeat(spaces) : '';
    }
    TAN(arg : number) : number {
        return this.checkNum(Math.tan(arg));
    }
    TIMER() : number {
        return Date.now() / 1000;
    }
    VAL(arg : string) : number {
        var n = parseFloat(this.checkString(arg));
        return isNaN(n) ? 0 : n; // TODO? altair works this way
    }
}
