
import { HDLBinop, HDLBlock, HDLConstant, HDLDataType, HDLExpr, HDLExtendop, HDLFuncCall, HDLModuleDef, HDLModuleRunner, HDLSourceLocation, HDLTriop, HDLUnop, HDLValue, HDLVariableDef, HDLVarRef, HDLWhileOp, isArrayItem, isArrayType, isBinop, isBlock, isConstExpr, isFuncCall, isLogicType, isTriop, isUnop, isVarDecl, isVarRef, isWhileop } from "./hdltypes";
import binaryen = require('binaryen');

interface VerilatorUnit {
    _ctor_var_reset(state) : void;
    _eval_initial(state) : void;
    _eval_settle(state) : void;
    _eval(state) : void;
    _change_request(state) : boolean;
}

const VERILATOR_UNIT_FUNCTIONS = [
    "_ctor_var_reset",
    "_eval_initial",
    "_eval_settle",
    "_eval",
    "_change_request"
];

interface Options {
    store?: boolean;
    funcblock?: HDLBlock;
    resulttype?: number;
}

const GLOBAL = "$$GLOBAL";
const CHANGEDET = "$$CHANGE";
const MEMORY = "0";

///

export class HDLError extends Error {
    obj: any;
    constructor(obj: any, msg: string) {
        super(msg);
        Object.setPrototypeOf(this, HDLError.prototype);
        this.obj = obj;
        if (obj) console.log(obj);
    }
}

function getDataTypeSize(dt: HDLDataType) : number {
    if (isLogicType(dt)) {
        if (dt.left <= 7)
            return 1;
        else if (dt.left <= 15)
            return 2;
        else if (dt.left <= 31)
            return 4;
        else if (dt.left <= 63)
            return 8;
        else
            return (dt.left >> 6) * 8 + 8; // 64-bit words
    } else if (isArrayType(dt)) {
        // TODO: additional padding for array?
        return (Math.abs(dt.high.cvalue - dt.low.cvalue) + 1) * getDataTypeSize(dt.subtype);
    } else {
        throw new HDLError(dt, `don't know data type`);
    }
}

function getArrayElementSize(e: HDLExpr) : number {
    if (isVarRef(e) && isArrayType(e.dtype)) {
        return getDataTypeSize(e.dtype.subtype);
    } else if (isBinop(e) && isArrayType(e.dtype)) {
        return getDataTypeSize(e.dtype.subtype);
    }
    throw new HDLError(e, `cannot figure out array element size`);
}

function getArrayValueSize(e: HDLExpr) : number {
    if (isVarRef(e)) {
        var dt = e.dtype;
        while (isArrayType(dt))
            dt = dt.subtype;
        return getDataTypeSize(dt);
    } else if (isBinop(e) && e.op == 'arraysel') {
        return getArrayValueSize(e.left);
    }
    throw new HDLError(e, `cannot figure out array value size`);
}

function getAlignmentForSize(size) {
    if (size <= 1) return 1;
    else if (size <= 2) return 2;
    else if (size <= 4) return 4;
    else return 8;
}

function getBinaryenType(size: number) {
    return size <= 4 || size > 8 ? binaryen.i32 : binaryen.i64
}

interface StructRec {
    name: string;
    type: HDLDataType;
    offset: number;
    size: number;
    itype: number;
    index: number;
    init: HDLBlock;
}

class Struct {
    parent : Struct;
    len : number = 0;
    vars : {[name: string] : StructRec} = {};
    locals : StructRec[] = [];
    params : StructRec[] = [];
    
    addVar(vardef: HDLVariableDef) {
        var size = getDataTypeSize(vardef.dtype);
        var rec = this.addEntry(vardef.name, getBinaryenType(size), size, vardef.dtype, false);
        rec.init = vardef.initValue;
        if (vardef.constValue) throw new HDLError(vardef, `can't handle constants`);
        return rec;
    }

    addEntry(name: string, itype: number, size: number, hdltype: HDLDataType, isParam: boolean) : StructRec {
        var align = getAlignmentForSize(size);
        while (this.len % align) this.len++;
        // pointers are 32 bits, so if size > 8 it's a pointer
        var rec : StructRec = {
            name: name,
            type: hdltype,
            size: size,
            itype: itype,
            index: this.params.length + this.locals.length,
            offset: this.len,
            init: null,
        }
        this.len += size;
        if (rec.name != null) this.vars[rec.name] = rec;
        if (isParam) this.params.push(rec);
        else this.locals.push(rec);
        return rec;
    }

    getLocals() {
        var vars = [];
        for (const rec of this.locals) {
            vars.push(rec.itype);
        }
        return vars;
    }

    lookup(name: string) : StructRec {
        return this.vars[name];
    }
}

///

export class HDLModuleWASM implements HDLModuleRunner {

    bmod: binaryen.Module;
    instance: WebAssembly.Instance;

    hdlmod: HDLModuleDef;
    constpool: HDLModuleDef;
    globals: Struct;
    locals: Struct;
    finished: boolean;
    stopped: boolean;
    databuf: Buffer;
    data8: Uint8Array;
    state: any;
    statebytes: number;
    outputbytes: number;

    constructor(moddef: HDLModuleDef, constpool: HDLModuleDef) {
        this.hdlmod = moddef;
        this.constpool = constpool;
        this.bmod = new binaryen.Module();
        this.genTypes();
        var memsize = Math.ceil(this.globals.len / 65536) + 1;
        this.bmod.setMemory(memsize, memsize, MEMORY); // memory is in 64k chunks
        this.genFuncs();
    }

    async init() {
        await this.genModule();
        this.genInitData();
    }

    genTypes() {
        // generate global variables
        var state = new Struct();
        // outputs are first
        for (const [varname, vardef] of Object.entries(this.hdlmod.vardefs)) {
            if (vardef.isOutput) state.addVar(vardef);
        }
        this.outputbytes = state.len;
        // followed by inputs and internal vars
        for (const [varname, vardef] of Object.entries(this.hdlmod.vardefs)) {
            if (!vardef.isOutput) state.addVar(vardef);
        }
        this.statebytes = state.len;
        // followed by constant pool
        for (const [varname, vardef] of Object.entries(this.constpool.vardefs)) {
            state.addVar(vardef);
        }
        this.globals = state;
    }

    genFuncs() {
         // function type (dsegptr)
         var fsig = binaryen.createType([binaryen.i32])
         for (var block of this.hdlmod.blocks) {
             // TODO: cfuncs only
             var fnname = block.name;
             // find locals of function
             var fscope = new Struct();
             fscope.addEntry(GLOBAL, binaryen.i32, 4, null, true); // 1st param to function
             // add __req local if change_request function
             if (this.funcResult(block) == binaryen.i32) {
                 fscope.addEntry(CHANGEDET, binaryen.i32, 1, null, false);
             }
             this.pushScope(fscope);
             block.exprs.forEach((e) => {
                 if (e && isVarDecl(e)) {
                     fscope.addVar(e);
                 }
             })
             // create function body
             var fbody = this.block2wasm(block, {funcblock:block});
             //var fbody = this.bmod.return(this.bmod.i32.const(0));
             var fret = this.funcResult(block);
             var fref = this.bmod.addFunction(fnname, fsig, fret, fscope.getLocals(), fbody);
             this.popScope();
         }
         // export functions
         for (var fname of VERILATOR_UNIT_FUNCTIONS) {
             this.bmod.addFunctionExport(fname, fname);
         }
         // create helper functions
         this.addHelperFunctions();
         // create wasm module
         //console.log(this.bmod.emitText());
         //this.bmod.optimize();
         if (!this.bmod.validate())
             throw new HDLError(this.bmod.emitText(), `could not validate wasm module`);
    }

    async genModule() {
        //console.log(this.bmod.emitText());
        var wasmData = this.bmod.emitBinary();
        var compiled = await WebAssembly.compile(wasmData);
        this.instance = await WebAssembly.instantiate(compiled, {});
        this.databuf = (this.instance.exports[MEMORY] as any).buffer;
        this.data8 = new Uint8Array(this.databuf);
        this.state = new Proxy({}, {
            // TODO
            get: (target, prop, receiver) => {
                var vref = this.globals.lookup(prop.toString());
                if (vref !== undefined) {
                    if (isLogicType(vref.type)) {
                        return this.data8[vref.offset]; // TODO: other types
                    } else if (isArrayType(vref.type)) {
                        return new Uint8Array(this.databuf, vref.offset, vref.size); // TODO: other types
                    } else
                        throw new HDLError(vref, `can't get property ${prop.toString()}`);
                }
                return undefined;
            },
            set: (obj, prop, value) => {
                var vref = this.globals.lookup(prop.toString());
                if (vref !== undefined) {
                    if (isLogicType(vref.type)) {
                        this.data8[vref.offset] = value; // TODO: other types
                        return true;
                    } else if (isArrayType(vref.type)) {
                        throw new HDLError(vref, `can't set property ${prop.toString()}`);
                    } else {
                        return true;
                    }
                } else {
                    return true; // silently fail
                }
            }
        });
    }

    genInitData() {
        for (var rec of this.globals.locals) {
            if (rec.init) {
                var arr = this.state[rec.name];
                if (!arr) throw new HDLError(rec, `no array to init`);
                for (let i=0; i<rec.init.exprs.length; i++) {
                    let e = rec.init.exprs[i];
                    if (isArrayItem(e) && isConstExpr(e.expr)) {
                        arr[e.index] = e.expr.cvalue;
                    } else {
                        throw new HDLError(e, `non-const expr in initarray`);
                    }
                }
                //console.log(rec.name, rec.type, arr);
            }
        }
    }

    powercycle() {
        this.finished = false;
        this.stopped = false;
        (this.instance.exports as any)._ctor_var_reset(0);
        (this.instance.exports as any)._eval_initial(0);
        for (var i=0; i<100; i++) {
            (this.instance.exports as any)._eval_settle(0);
            (this.instance.exports as any)._eval(0);
            var Vchange = (this.instance.exports as any)._change_request(0);
            if (!Vchange) {
                return;
            }
        }
        throw new HDLError(null, `model did not converge on reset()`)
    }

    eval() {
        (this.instance.exports as any).eval(0);
    }

    tick() {
        // TODO: faster
        this.state.clk ^= 1;
        (this.instance.exports as any).eval(0);
    }

    tick2(iters: number) {
        (this.instance.exports as any).tick2(0, iters);
    }

    isFinished() { return this.finished; }

    isStopped() { return this.stopped; }

    saveState() {
        return { o: this.data8.slice(0, this.statebytes) };
    }

    loadState(state) {
        this.data8.set(state.o as Uint8Array);
    }

    test() {
        //console.log(this.globals);
        this.state.reset = 1;
        for (var i=0; i<50; i++) {
            this.tick();
            this.tick();
            if (i==5) this.state.reset = 0;
        }
        console.log(this.databuf);
        var t1 = new Date().getTime();
        var tickiters = 10000;
        var looplen = Math.round(100000000/tickiters);
        for (var i=0; i<looplen; i++) {
            this.tick2(tickiters);
        }
        var t2 = new Date().getTime();
        console.log('wasm:',t2-t1,'msec',i*tickiters,'iterations');
        console.log(this.databuf);
    }

    addHelperFunctions() {
        this.bmod.addFunction("eval",
            binaryen.createType([binaryen.i32]),    // (dataptr)
            binaryen.i32,                           // return # of iterations
            [],                                     // no locals
            this.makeTickFunction(0)
        );
        this.bmod.addFunctionExport("eval", "eval");

        // TODO: what if there is no clk? (e.g. ALU)
        var l_dseg = this.bmod.local.get(0, binaryen.i32);
        var l_count = this.bmod.local.get(1, binaryen.i32);
        this.bmod.addFunction("tick2",
            binaryen.createType([binaryen.i32, binaryen.i32]),    // (dataptr, iters)
            binaryen.none,                                        // return nothing
            [],                                                   // no locals
            this.bmod.loop("@loop", this.bmod.block(null, [
                this.makeSetVariableFunction("clk", 0),
                this.bmod.drop(this.bmod.call("eval", [l_dseg], binaryen.i32)),
                this.makeSetVariableFunction("clk", 1),
                this.bmod.drop(this.bmod.call("eval", [l_dseg], binaryen.i32)),
                // dec $1
                this.bmod.local.set(1, this.bmod.i32.sub(l_count, this.bmod.i32.const(1))),
                // goto @loop if $1
                this.bmod.br_if("@loop", l_count)
            ]))
        );
        this.bmod.addFunctionExport("tick2", "tick2");
    }

    makeGetVariableFunction(name: string, value: number) {
        var dtype = this.globals.lookup(name).type;
        var src : HDLVarRef = {refname:name, dtype:dtype};
        return this.e2w(src);
    }

    makeSetVariableFunction(name: string, value: number) {
        var dtype = this.globals.lookup(name).type;
        var dest : HDLVarRef = {refname:name, dtype:dtype};
        var src : HDLConstant = {cvalue:value, dtype:dtype};
        return this.assign2wasm(dest, src);
    }

    makeTickFunction(count: number) {
        var dseg = this.bmod.local.get(0, binaryen.i32);
        if (count > 4)
            return this.bmod.i32.const(count);
        return this.bmod.block(null, [
            this.bmod.call("_eval", [dseg], binaryen.none),
            this.bmod.if(
                this.bmod.call("_change_request", [dseg], binaryen.i32),
                this.makeTickFunction(count+1),
                this.bmod.return(this.bmod.local.get(0, binaryen.i32))
            )
        ], binaryen.i32)
    }

    funcResult(func: HDLBlock) {
        // only _change functions return a result
        return func.name.startsWith("_change_request") ? binaryen.i32 : binaryen.none;
    }

    pushScope(scope: Struct) {
        scope.parent = this.locals;
        this.locals = scope;
    }

    popScope() {
        this.locals = this.locals.parent;
    }

    i3264(dt: HDLDataType) {
        var size = getDataTypeSize(dt);
        var type = getBinaryenType(size);
        if (type == binaryen.i32) return this.bmod.i32;
        else if (type == binaryen.i64) return this.bmod.i64;
        else throw new HDLError(null, `unknown type for i3264 ${type}`);
    }

    dataptr() : number {
        return this.bmod.local.get(0, binaryen.i32); // 1st param of function == data ptr 
    }

    e2w(e: HDLExpr, opts?:Options) : number {
        if (e == null) {
            return this.bmod.nop();
        } else if (isBlock(e)) {
            return this.block2wasm(e, opts);
        } else if (isVarDecl(e)) {
            return this.local2wasm(e, opts);
        } else if (isVarRef(e)) {
            return this.varref2wasm(e, opts);
        } else if (isConstExpr(e)) {
            return this.const2wasm(e, opts);
        } else if (isFuncCall(e)) {
            return this.funccall2wasm(e, opts);
        } else if (isUnop(e) || isBinop(e) || isTriop(e) || isWhileop(e)) {
            var n = `_${e.op}2wasm`;
            var fn = this[n];
            if (fn == null) { throw new HDLError(e, `no such method ${n}`) }
            return this[n](e, opts);
        } else {
            throw new HDLError(e, `could not translate expr`)
        }
    }

    block2wasm(e: HDLBlock, opts?:Options) : number {
        var stmts = e.exprs.map((stmt) => this.e2w(stmt));
        var ret = opts && opts.funcblock ? this.funcResult(opts.funcblock) : binaryen.none;
        // must have return value for change_request function
        if (ret == binaryen.i32) { 
            stmts.push(this.bmod.return(this.bmod.local.get(this.locals.lookup(CHANGEDET).index, ret)));
        }
        // return block value for loop condition 
        if (opts && opts.resulttype) {
            ret = binaryen.i32;
        }
        return this.bmod.block(e.name, stmts, ret);
    }

    funccall2wasm(e: HDLFuncCall, opts?:Options) : number {
        var args = [this.dataptr()];
        var ret = e.funcname.startsWith("_change_request") ? binaryen.i32 : binaryen.none;
        return this.bmod.call(e.funcname, args, ret);
    }

    const2wasm(e: HDLConstant, opts: Options) : number {
        var size = getDataTypeSize(e.dtype);
        if (isLogicType(e.dtype)) {
            if (size <= 4)
                return this.bmod.i32.const(e.cvalue);
            else
                throw new HDLError(e, `constants > 32 bits not supported`)
        } else {
            throw new HDLError(e, `non-logic constants not supported`)
        }
    }

    varref2wasm(e: HDLVarRef, opts: Options) : number {
        if (opts && opts.store) throw Error(`cannot store here`);
        var local = this.locals && this.locals.lookup(e.refname);
        var global = this.globals.lookup(e.refname);
        if (local != null) {
            return this.bmod.local.get(local.index, local.itype);
        } else if (global != null) {
            return this.loadmem(this.dataptr(), global.offset, global.size);
        }
        throw new HDLError(e, `cannot lookup variable ${e.refname}`)
    }

    local2wasm(e: HDLVariableDef, opts:Options) : number {
        var local = this.locals.lookup(e.name);
        if (local == null) throw Error(`no local for ${e.name}`)
        return this.bmod.nop(); // TODO
    }

    assign2wasm(dest: HDLExpr, src: HDLExpr) : number {
        var value = this.e2w(src);
        if (isVarRef(dest)) {
            var local = this.locals && this.locals.lookup(dest.refname);
            var global = this.globals.lookup(dest.refname);
            if (local != null) {
                return this.bmod.local.set(local.index, value);
            } else if (global != null) {
                return this.storemem(this.dataptr(), global.offset, global.size, value);
            }
        } else if (isBinop(dest)) {
            // TODO: array bounds
            var addr = this.address2wasm(dest);
            return this.storemem(addr, 0, getDataTypeSize(dest.dtype), value);
        }
        throw new HDLError([dest, src], `cannot complete assignment`);
    }

    loadmem(ptr, offset:number, size:number) : number {
        if (size == 1) {
            return this.bmod.i32.load8_u(offset, 1, ptr);
        } else if (size == 2) {
            return this.bmod.i32.load16_u(offset, 2, ptr);
        } else if (size == 4) {
            return this.bmod.i32.load(offset, 4, ptr);
        } else if (size == 8) {
            return this.bmod.i64.load(offset, 8, ptr);
        } else {
            throw new HDLError(null, `bad size ${size}`)
        }
    }
    
    storemem(ptr, offset:number, size:number, value) : number {
        if (size == 1) {
            return this.bmod.i32.store8(offset, 1, ptr, value);
        } else if (size == 2) {
            return this.bmod.i32.store16(offset, 2, ptr, value);
        } else if (size == 4) {
            return this.bmod.i32.store(offset, 4, ptr, value);
        } else if (size == 8) {
            return this.bmod.i64.store(offset, 8, ptr, value);
        } else {
            throw new HDLError(null, `bad size ${size}`)
        }
    }

    address2wasm(e: HDLExpr) : number {
        if (isBinop(e) && e.op == 'arraysel') {
            var array = this.address2wasm(e.left);
            var elsize = getArrayElementSize(e.left);
            var index = this.e2w(e.right);
            return this.bmod.i32.add(
                array,
                this.bmod.i32.mul(this.bmod.i32.const(elsize), index)
            );
        } else if (isVarRef(e)) {
            var local = this.locals && this.locals.lookup(e.refname);
            var global = this.globals.lookup(e.refname);
            if (local != null) {
                throw new HDLError(e, `can't get array local address yet`);
            } else if (global != null) {
                return this.bmod.i32.const(global.offset);
            }
        }
        throw new HDLError(e, `cannot get address`);
    }

    // TODO: array bounds
    _arraysel2wasm(e: HDLBinop, opts:Options) : number {
        var addr = this.address2wasm(e);
        var elsize = getArrayValueSize(e);
        return this.loadmem(addr, 0, elsize);
    }

    _assign2wasm(e: HDLBinop, opts:Options) {
        return this.assign2wasm(e.right, e.left);
    }    
    _assignpre2wasm(e: HDLBinop, opts:Options) {
        return this._assign2wasm(e, opts);
    }
    _assigndly2wasm(e: HDLBinop, opts:Options) {
        return this._assign2wasm(e, opts);
    }
    _assignpost2wasm(e: HDLBinop, opts:Options) {
        return this._assign2wasm(e, opts);
    }
    _contassign2wasm(e: HDLBinop, opts:Options) {
        return this._assign2wasm(e, opts);
    }

    _if2wasm(e: HDLTriop, opts:Options) {
        return this.bmod.if(this.e2w(e.cond), this.e2w(e.left), this.e2w(e.right));
    }
    _cond2wasm(e: HDLTriop, opts:Options) {
        return this.bmod.select(this.e2w(e.cond), this.e2w(e.left), this.e2w(e.right));
    }
    _condbound2wasm(e: HDLTriop, opts:Options) {
        return this.bmod.select(this.e2w(e.cond), this.e2w(e.left), this.e2w(e.right));
    }

    _while2wasm(e: HDLWhileOp, opts:Options) {
        var block = [];
        if (e.precond) {
            block.push(this.e2w(e.precond));
        }
        if (e.loopcond) {
            block.push(this.bmod.br_if("@block", this.e2w(e.loopcond, {resulttype:binaryen.i32})));
        }
        if (e.body) {
            block.push(this.e2w(e.body));
        }
        if (e.inc) {
            block.push(this.e2w(e.inc));
        }
        block.push(this.bmod.br("@loop"));
        return this.bmod.loop("@loop", this.bmod.block("@block", block, binaryen.none));
    }

    _ccast2wasm(e: HDLUnop, opts:Options) {
        return this.e2w(e.left, opts);
    }
    _creset2wasm(e: HDLUnop, opts:Options) {
        // TODO return this.e2w(e.left, opts);
        return this.bmod.nop();
    }
    _creturn2wasm(e: HDLUnop, opts:Options) {
        return this.bmod.return(this.e2w(e.left, opts));
    }

    _not2wasm(e: HDLUnop, opts:Options) {
        var inst = this.i3264(e.dtype);
        return inst.xor(inst.const(-1, -1), this.e2w(e.left, opts));
    }
    _negate2wasm(e: HDLUnop, opts:Options) {
        var inst = this.i3264(e.dtype);
        return inst.sub(inst.const(0,0), this.e2w(e.left, opts));
    }
    _changedet2wasm(e: HDLBinop, opts:Options) {
        var req = this.locals.lookup(CHANGEDET);
        if (!req) throw new HDLError(e, `no changedet local`);
        var left = this.e2w(e.left);
        var right = this.e2w(e.right);
        return this.bmod.block(null, [
            // $$req |= (${this.expr2js(e.left)} ^ ${this.expr2js(e.right)})
            this.bmod.local.set(req.index,
                this.bmod.i32.or(
                    this.bmod.local.get(req.index, req.itype),
                    this.bmod.i32.xor(left, right) // TODO: i64?
                )
            ),
            // ${this.expr2js(e.right)} = ${this.expr2js(e.left)}`
            this.assign2wasm(e.right, e.left)
        ]);
    }
    _extends2wasm(e: HDLExtendop, opts:Options) {
        var value = this.e2w(e.left);
        var inst = this.i3264(e.dtype);
        /*
        if (e.widthminv == 8) {
            return inst.extend8_s(value);
        } else if (e.widthminv == 16) {
            return inst.extend16_s(value);
        } else if (e.widthminv == 32 && e.width == 64) {
            return this.bmod.i64.extend32_s(value);
        } else */ {
            var shift = this.bmod.i32.const(e.width - e.widthminv);
            return inst.shr_s(inst.shl(value, shift), shift);
        }
    }

    _or2wasm(e: HDLBinop, opts:Options) {
        return this.i3264(e.dtype).or(this.e2w(e.left), this.e2w(e.right));
    }
    _and2wasm(e: HDLBinop, opts:Options) {
        return this.i3264(e.dtype).and(this.e2w(e.left), this.e2w(e.right));
    }
    _xor2wasm(e: HDLBinop, opts:Options) {
        return this.i3264(e.dtype).xor(this.e2w(e.left), this.e2w(e.right));
    }
    _shiftl2wasm(e: HDLBinop, opts:Options) {
        return this.i3264(e.dtype).shl(this.e2w(e.left), this.e2w(e.right));
    }
    _shiftr2wasm(e: HDLBinop, opts:Options) {
        // TODO: signed?
        return this.i3264(e.dtype).shr_u(this.e2w(e.left), this.e2w(e.right));
    }
    _add2wasm(e: HDLBinop, opts:Options) {
        return this.i3264(e.dtype).add(this.e2w(e.left), this.e2w(e.right));
    }
    _sub2wasm(e: HDLBinop, opts:Options) {
        return this.i3264(e.dtype).sub(this.e2w(e.left), this.e2w(e.right));
    }

    _eq2wasm(e: HDLBinop, opts:Options) {
        return this.i3264(e.dtype).eq(this.e2w(e.left), this.e2w(e.right));
    }
    _neq2wasm(e: HDLBinop, opts:Options) {
        return this.i3264(e.dtype).ne(this.e2w(e.left), this.e2w(e.right));
    }
    _lt2wasm(e: HDLBinop, opts:Options) {
        return this.i3264(e.dtype).lt_u(this.e2w(e.left), this.e2w(e.right));
    }
    _gt2wasm(e: HDLBinop, opts:Options) {
        return this.i3264(e.dtype).gt_u(this.e2w(e.left), this.e2w(e.right));
    }
    _lte2wasm(e: HDLBinop, opts:Options) {
        return this.i3264(e.dtype).le_u(this.e2w(e.left), this.e2w(e.right));
    }
    _gte2wasm(e: HDLBinop, opts:Options) {
        return this.i3264(e.dtype).ge_u(this.e2w(e.left), this.e2w(e.right));
    }
    _gts2wasm(e: HDLBinop, opts:Options) {
        return this.i3264(e.dtype).gt_s(this.e2w(e.left), this.e2w(e.right));
    }
    _lts2wasm(e: HDLBinop, opts:Options) {
        return this.i3264(e.dtype).lt_s(this.e2w(e.left), this.e2w(e.right));
    }
}

