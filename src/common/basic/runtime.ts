
import * as basic from "./compiler";
import { EmuHalt } from "../emu";

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
    check: boolean;
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

    curpc : number;
    dataptr : number;
    vars : {};
    arrays : {};
    forLoops : {};
    returnStack : number[];
    column : number;
    abase : number; // array base

    running : boolean = false;
    exited : boolean = false;
    trace : boolean = false;

    load(program: basic.BASICProgram) {
        this.program = program;
        this.label2lineidx = {};
        this.label2pc = {};
        this.allstmts = [];
        this.line2pc = [];
        this.pc2line = new Map();
        this.datums = [];
        // TODO: lines start @ 1?
        program.lines.forEach((line, idx) => {
            // make lookup tables
            if (line.label != null) this.label2lineidx[line.label] = idx;
            if (line.label != null) this.label2pc[line.label] = this.allstmts.length;
            this.line2pc.push(this.allstmts.length);
            this.pc2line.set(this.allstmts.length, idx);
            // combine all statements into single list
            line.stmts.forEach((stmt) => this.allstmts.push(stmt));
            // parse DATA literals
            line.stmts.filter((stmt) => stmt.command == 'DATA').forEach((datastmt) => {
                (datastmt as basic.DATA_Statement).datums.forEach(d => {
                    var functext = this.expr2js(d, {check:true, isconst:true});
                    // TODO: catch exceptions
                    // TODO: any value doing this ahead of time?
                    var value = new Function(`return ${functext};`).bind(this)();
                    this.datums.push({value:value});
                });
            });
            // TODO: compile statements?
            //line.stmts.forEach((stmt) => this.compileStatement(stmt));
        });
    }

    reset() {
        this.curpc = 0;
        this.dataptr = 0;
        this.vars = {};
        this.arrays = {};
        this.forLoops = {};
        this.returnStack = [];
        this.column = 0;
        this.abase = 1;
        this.running = true;
        this.exited = false;
    }

    runtimeError(msg : string) {
        this.curpc--; // we did curpc++ before executing statement
        // TODO: pass source location to error
        throw new EmuHalt(`${msg} (line ${this.getLabelForPC(this.curpc)})`);
    }

    // TODO: sometimes on next line
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
        // compile statement to JS?
        this.compileStatement(stmt);
        this.executeStatement(stmt);
        return this.running;
    }

    compileStatement(stmt: basic.Statement & CompiledStatement) {
        if (stmt.$run == null) {
            var stmtfn = this['do__' + stmt.command];
            if (stmtfn == null) this.runtimeError(`I don't know how to "${stmt.command}".`);
            var functext = stmtfn.bind(this)(stmt);
            if (this.trace) console.log(functext);
            stmt.$run = new Function(functext).bind(this);
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
        this.returnStack.push(this.curpc + 1);
        this.gotoLabel(label);
    }

    returnFromGosub() {
        if (this.returnStack.length == 0)
            this.runtimeError("I tried to RETURN, but there wasn't a corresponding GOSUB."); // RETURN BEFORE GOSUB
        var pc = this.returnStack.pop();
        this.curpc = pc;
    }
    
    valueToString(obj) : string {
        var str;
        if (typeof obj === 'number') {
            var numstr = obj.toString().toUpperCase();
            var prec = 11;
            while (numstr.length > 11) {
                numstr = obj.toPrecision(prec--);
            }
            if (numstr.startsWith('0.'))
                numstr = numstr.substr(1);
            else if (numstr.startsWith('-0.'))
                numstr = '-'+numstr.substr(2);
            if (numstr.startsWith('-')) {
                str = `${numstr} `;
            } else {
                str = ` ${numstr} `;
            }
        } else if (obj == '\n') {
            this.column = 0;
            str = obj;
        } else if (obj == '\t') {
            var curgroup = Math.floor(this.column / 15);
            var nextcol = (curgroup + 1) * 15;
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

    expr2js(expr: basic.Expr, opts: ExprOptions) : string {
        if (isLiteral(expr)) {
            return JSON.stringify(expr.value);
        } else if (isLookup(expr)) {
            if (opts.locals && opts.locals.indexOf(expr.name) >= 0) {
                return expr.name; // local arg in DEF
            } else {
                if (opts.isconst) this.runtimeError(`I expected a constant value here`);
                var s = '';
                if (expr.args && this[expr.name]) { // is it a function?
                    s += `this.${expr.name}(`;
                    s += expr.args.map((arg) => this.expr2js(arg, opts)).join(', ');
                    s += ')';
                } else if (expr.args) { // is it a subscript?
                    s += `this.getArray(${JSON.stringify(expr.name)}, ${expr.args.length})`;
                    s += expr.args.map((arg) => '[this.ROUND('+this.expr2js(arg, opts)+')]').join('');
                } else {
                    // just a variable
                    s = `this.vars.${expr.name}`;
                }
                if (opts.check)
                    return `this.checkValue(${s}, ${JSON.stringify(expr.name)})`; // TODO: better error
                else
                    return s;
            }
        } else if (isBinOp(expr)) {
            var left = this.expr2js(expr.left, opts);
            var right = this.expr2js(expr.right, opts);
            return `this.${expr.op}(${left}, ${right})`;
        } else if (isUnOp(expr) && expr.op == 'neg') {
            var e = this.expr2js(expr.expr, opts);
            return `-(${e})`; // TODO: other ops?
        }
    }

    startForLoop(name, init, targ, step) {
        // TODO: check for loop params
        var pc = this.curpc;
        if (!step) step = 1;
        this.vars[name] = init;
        if (this.trace) console.log(`FOR ${name} = ${this.vars[name]} TO ${targ} STEP ${step}`);
        this.forLoops[name] = {
            next: () => {
                var done = step >= 0 ? this.vars[name] >= targ : this.vars[name] <= targ;
                if (done) {
                    delete this.forLoops[name];
                } else {
                    this.vars[name] += step;
                    this.curpc = pc;
                }
                if (this.trace) console.log(`NEXT ${name}: ${this.vars[name]} TO ${targ} STEP ${step} DONE=${done}`);
            }
        };
    }

    nextForLoop(name) {
        // TODO: check for for loop
        var fl = this.forLoops[name];
        if (!fl) this.runtimeError(`I couldn't find a matching FOR for this NEXT.`)
        this.forLoops[name].next();
    }

    // converts a variable to string/number based on var name
    convert(name: string, right: number|string) : number|string {
        // TODO: error check?
        if (name.endsWith("$"))
            return right+"";
        else if (typeof right === 'string')
            return parseFloat(right);
        else if (typeof right === 'number')
            return right;
        else
            return this.checkValue(right, name);
    }

    // dimension array
    dimArray(name: string, ...dims:number[]) {
        var isstring = name.endsWith('$');
        // TODO: option for undefined float array elements?
        var arrcons = isstring ? Array : Float64Array;
        var ab = this.abase;
        if (dims.length == 1) {
            this.arrays[name] = new arrcons(dims[0]+ab);
        } else if (dims.length == 2) {
            this.arrays[name] = new Array(dims[0]+ab);
            for (var i=ab; i<dims[0]+ab; i++)
                this.arrays[name][i] = new arrcons(dims[1]+ab);
        } else {
            this.runtimeError(`I only support arrays of one or two dimensions.`)
        }
    }

    getArray(name: string, order: number) : [] {
        if (!this.arrays[name]) {
            if (order == 1)
                this.dimArray(name, 11);
            else if (order == 2)
                this.dimArray(name, 11, 11);
            else
                this.runtimeError(`I only support arrays of one or two dimensions.`)
        }
        return this.arrays[name];
    }

    onGotoLabel(value: number, ...labels: string[]) {
        value = this.ROUND(value);
        if (value < 1 || value > labels.length)
            this.runtimeError(`I needed a number between 1 and ${labels.length}, but I got ${value}.`);
        this.gotoLabel(labels[value-1]);
    }

    nextDatum() : string|number {
        if (this.dataptr >= this.datums.length)
            this.runtimeError("I tried to READ, but ran out of data.");
        return this.datums[this.dataptr++].value;
    }

    //// STATEMENTS

    do__PRINT(stmt : basic.PRINT_Statement) {
        var s = '';
        for (var arg of stmt.args) {
            var expr = this.expr2js(arg, {check:true});
            s += `this.printExpr(${expr});`;
        }
        return s;
    }

    do__INPUT(stmt : basic.INPUT_Statement) {
        var prompt = this.expr2js(stmt.prompt, {check:true});
        var setvals = '';
        stmt.args.forEach((arg, index) => {
            var lexpr = this.expr2js(arg, {check:false});
            setvals += `${lexpr} = this.convert(${JSON.stringify(arg.name)}, vals[${index}]);`
        });
        return `this.running=false; this.input(${prompt}, ${stmt.args.length}).then((vals) => {${setvals}; this.running=true; this.resume();})`;
    }

    do__LET(stmt : basic.LET_Statement) {
        var lexpr = this.expr2js(stmt.lexpr, {check:false});
        var right = this.expr2js(stmt.right, {check:true});
        return `${lexpr} = this.convert(${JSON.stringify(stmt.lexpr.name)}, ${right});`;
    }

    do__FOR(stmt : basic.FOR_Statement) {
        var name = JSON.stringify(stmt.lexpr.name); // TODO: args?
        var init = this.expr2js(stmt.initial, {check:true});
        var targ = this.expr2js(stmt.target, {check:true});
        var step = stmt.step ? this.expr2js(stmt.step, {check:true}) : 'null';
        return `this.startForLoop(${name}, ${init}, ${targ}, ${step})`;
    }

    do__NEXT(stmt : basic.NEXT_Statement) {
        var name = JSON.stringify(stmt.lexpr.name); // TODO: args? lexpr == null?
        return `this.nextForLoop(${name})`;
    }

    do__IF(stmt : basic.IF_Statement) {
        var cond = this.expr2js(stmt.cond, {check:true});
        return `if (!(${cond})) { this.skipToEOL(); }`
    }

    do__DEF(stmt : basic.DEF_Statement) {
        var lexpr = `this.${stmt.lexpr.name}`;
        var args = [];
        for (var arg of stmt.lexpr.args) {
            if (isLookup(arg)) {
                args.push(arg.name);
            } else {
                this.runtimeError("I found a DEF statement with arguments other than variable names.");
            }
        }
        var functext = this.expr2js(stmt.def, {check:true, locals:args});
        // TODO: use stmt.args to add function params
        return `${lexpr} = function(${args.join(',')}) { return ${functext}; }`;
    }

    _DIM(dim : basic.IndOp) {
        var argsstr = '';
        for (var arg of dim.args) {
            // TODO: check for float
            argsstr += ', ' + this.expr2js(arg, {check:true});
        }
        return `this.dimArray(${JSON.stringify(dim.name)}${argsstr});`;
    }

    do__DIM(stmt : basic.DIM_Statement) {
        var s = '';
        stmt.args.forEach((dim) => s += this._DIM(dim));
        return s;
    }

    do__GOTO(stmt : basic.GOTO_Statement) {
        var label = this.expr2js(stmt.label, {check:true});
        return `this.gotoLabel(${label})`;
    }

    do__GOSUB(stmt : basic.GOSUB_Statement) {
        var label = this.expr2js(stmt.label, {check:true});
        return `this.gosubLabel(${label})`;
    }

    do__RETURN(stmt : basic.RETURN_Statement) {
        return `this.returnFromGosub()`;
    }

    do__ONGOTO(stmt : basic.ONGOTO_Statement) {
        var expr = this.expr2js(stmt.expr, {check:true});
        var labels = stmt.labels.map((arg) => this.expr2js(arg, {check:true})).join(', ');
        return `this.onGotoLabel(${expr}, ${labels})`;
    }

    do__DATA() {
        // data is preprocessed
    }

    do__READ(stmt : basic.READ_Statement) {
        var s = '';
        stmt.args.forEach((arg) => {
            s += `${this.expr2js(arg, {check:false})} = this.convert(${JSON.stringify(arg.name)}, this.nextDatum());`;
        });
        return s;
    }

    do__RESTORE() {
        this.dataptr = 0; // TODO: line number?
    }

    do__END() {
        return `this.skipToEOF()`;
    }

    do__STOP() {
        return `this.skipToEOF()`;
    }

    do__OPTION(stmt: basic.OPTION_Statement) {
        switch (stmt.optname) {
            case 'BASE': 
                let base = parseInt(stmt.optargs[0]);
                if (base == 0 || base == 1) this.abase = base;
                else this.runtimeError("OPTION BASE can only be 0 or 1.");
                break;
            default:
                this.runtimeError(`OPTION ${stmt.optname} is not supported by this compiler.`);
                break;
        }
    }

    // TODO: "SUBSCRIPT ERROR"
    // TODO: gosubs nested too deeply
    // TODO: memory quota

    // FUNCTIONS

    checkValue(obj:number|string, exprname:string) {
        if (typeof obj !== 'number' && typeof obj !== 'string') {
            if (exprname != null && obj == null) {
                this.runtimeError(`I didn't find a value for ${exprname}`);
            } else if (exprname != null) {
                this.runtimeError(`I got an invalid value for ${exprname}: ${obj}`);
            } else {
                this.runtimeError(`I got an invalid value: ${obj}`);
            }
        }
        return obj;
    }

    checkNum(n:number) : number {
        if (n === Infinity) this.runtimeError(`I computed a number too big to store.`);
        if (isNaN(n)) this.runtimeError(`I computed an invalid number.`);
        return n;
    }

    checkString(s:string) : string {
        if (typeof s !== 'string') this.runtimeError(`I expected a string here.`);
        return s;
    }
    
    add(a, b) : number|string {
        // TODO: if string-concat
        if (typeof a === 'number' && typeof b === 'number')
            return this.checkNum(a + b);
        else
            return a + b;
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
    pow(a:number, b:number) : number {
        if (a == 0 && b < 0) this.runtimeError(`I can't raise zero to a negative power.`);
        return this.checkNum(Math.pow(a, b));
    }
    land(a:number, b:number) : number {
        return a && b;
    }
    lor(a:number, b:number) : number {
        return a || b;
    }
    eq(a:number, b:number) : boolean {
        return a == b;
    }
    ne(a:number, b:number) : boolean {
        return a != b;
    }
    lt(a:number, b:number) : boolean {
        return a < b;
    }
    gt(a:number, b:number) : boolean {
        return a > b;
    }
    le(a:number, b:number) : boolean {
        return a <= b;
    }
    ge(a:number, b:number) : boolean {
        return a >= b;
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
    EXP(arg : number) : number {
        return this.checkNum(Math.exp(arg));
    }
    FIX(arg : number) : number {
        return this.checkNum(arg - Math.floor(arg));
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
        if (start < 1) this.runtimeError(`The second parameter to MID$ must be between 1 and the length of the string in the first parameter.`)
        return arg.substr(start-1, count);
    }
    RIGHT$(arg : string, count : number) : string {
        return arg.substr(arg.length - count, count);
    }
    RND(arg : number) : number {
        return Math.random(); // argument ignored
    }
    ROUND(arg : number) : number {
        return this.checkNum(Math.round(arg)); // TODO?
    }
    SGN(arg : number) : number {
        return (arg < 0) ? -1 : (arg > 0) ? 1 : 0;
    }
    SIN(arg : number) : number {
        return this.checkNum(Math.sin(arg));
    }
    SPACE$(arg : number) : string {
        return ' '.repeat(this.checkNum(arg));
    }
    SQR(arg : number) : number {
        if (arg < 0) this.runtimeError(`I can't take the square root of a negative number (${arg}).`)
        return this.checkNum(Math.sqrt(arg));
    }
    STR$(arg) : string {
        return this.valueToString(arg);
    }
    TAB(arg : number) : string {
        if (arg < 0) this.runtimeError(`I got a negative value for the TAB() function.`);
        var spaces = this.ROUND(arg) - this.column;
        return (spaces > 0) ? ' '.repeat(spaces) : '';
    }
    TAN(arg : number) : number {
        return this.checkNum(Math.tan(arg));
    }
    VAL(arg) : number {
        return parseFloat(arg+"");
    }
}
