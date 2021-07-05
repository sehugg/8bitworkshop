
import { hasDataType, HDLBinop, HDLBlock, HDLConstant, HDLDataType, HDLDataTypeObject, HDLExpr, HDLExtendop, HDLFuncCall, HDLModuleDef, HDLModuleRunner, HDLSourceLocation, HDLTriop, HDLUnop, HDLValue, HDLVariableDef, HDLVarRef, HDLWhileOp, isArrayItem, isArrayType, isBigConstExpr, isBinop, isBlock, isConstExpr, isFuncCall, isLogicType, isTriop, isUnop, isVarDecl, isVarRef, isWhileop } from "./hdltypes";
import binaryen = require('binaryen');

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

const GLOBALOFS = 0;
const MEMORY = "$$MEM";
const GLOBAL = "$$GLOBAL";
const CHANGEDET = "$$CHANGE";
const TRACERECLEN = "$$treclen";
const TRACEOFS = "$$tofs";
const TRACEEND = "$$tend";
const TRACEBUF = "$$tbuf";

///

export class HDLError extends Error {
    obj: any;
    $loc: HDLSourceLocation;
    constructor(obj: any, msg: string) {
        super(msg);
        Object.setPrototypeOf(this, HDLError.prototype);
        this.obj = obj;
        if (obj && obj.$loc) this.$loc = obj.$loc;
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

function isReferenceType(dt: HDLDataType) : boolean {
    return getDataTypeSize(dt) > 8;
}

function getArrayElementSizeFromType(dtype: HDLDataType) : number {
    if (isArrayType(dtype)) {
        return getArrayElementSizeFromType(dtype.subtype);
    } else {
        return getDataTypeSize(dtype);
    }
}

function getArrayElementSizeFromExpr(e: HDLExpr) : number {
    if (hasDataType(e) && isArrayType(e.dtype)) {
        return getDataTypeSize(e.dtype.subtype);
    } else if (hasDataType(e) && isLogicType(e.dtype) && e.dtype.left > 63) {
        return 4; // TODO? for wordsel
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
    } else if (isBinop(e) && e.op == 'wordsel') {
        return 4; // TODO? for wordsel
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
    constval: HDLConstant;
}

class Struct {
    parent : Struct;
    len : number = 0;
    vars : {[name: string] : StructRec} = {};
    locals : StructRec[] = [];
    params : StructRec[] = [];
    
    addVar(vardef: HDLVariableDef) {
        var size = getDataTypeSize(vardef.dtype);
        var rec = this.addEntry(vardef.name, size, getBinaryenType(size), vardef.dtype, false);
        rec.init = vardef.initValue;
        rec.constval = vardef.constValue;
        return rec;
    }

    alignTo(align: number) : void {
        while (this.len % align) this.len++;
    }

    addEntry(name: string, size: number, itype?: number, hdltype?: HDLDataType, isParam?: boolean) : StructRec {
        this.alignTo(getAlignmentForSize(size));
        // pointers are 32 bits, so if size > 8 it's a pointer
        var rec : StructRec = {
            name: name,
            type: hdltype,
            size: size,
            itype: itype,
            index: this.params.length + this.locals.length,
            offset: this.len,
            init: null,
            constval: null,
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
    data16: Uint16Array;
    data32: Uint32Array;
    state: any;
    statebytes: number;
    outputbytes: number;
    traceBufferSize: number = 0xff000;
    traceRecordSize: number;
    traceReadOffset: number;
    traceStartOffset: number;
    traceEndOffset: number;
    trace: any;
    getFileData = null;

    constructor(moddef: HDLModuleDef, constpool: HDLModuleDef) {
        this.hdlmod = moddef;
        this.constpool = constpool;
        this.bmod = new binaryen.Module();
        this.genTypes();
        var membytes = this.globals.len;
        var memblks = Math.ceil(membytes / 65536);
        this.bmod.setMemory(memblks, memblks, MEMORY); // memory is in 64k chunks
        this.genFuncs();
    }

    async init() {
        await this.genModule();
        this.genInitData();
        this.enableTracing();
    }

    powercycle() {
        this.finished = false;
        this.stopped = false;
        (this.instance.exports as any)._ctor_var_reset(GLOBALOFS);
        (this.instance.exports as any)._eval_initial(GLOBALOFS);
        for (var i=0; i<100; i++) {
            (this.instance.exports as any)._eval_settle(GLOBALOFS);
            (this.instance.exports as any)._eval(GLOBALOFS);
            var Vchange = (this.instance.exports as any)._change_request(GLOBALOFS);
            if (!Vchange) {
                return;
            }
        }
        throw new HDLError(null, `model did not converge on reset()`)
    }

    eval() {
        (this.instance.exports as any).eval(GLOBALOFS);
    }

    tick() {
        this.state.clk ^= 1;
        this.eval();
    }

    tick2(iters: number) {
        (this.instance.exports as any).tick2(GLOBALOFS, iters);
    }

    isFinished() { return this.finished; }

    isStopped() { return this.stopped; }

    saveState() {
        return { o: this.data8.slice(0, this.statebytes) };
    }

    loadState(state) {
        this.data8.set(state.o as Uint8Array);
    }

    getGlobals() {
        var g = {};
        for (const [varname, vardef] of Object.entries(this.hdlmod.vardefs)) {
            var o = g;
            var toks = varname.split('$');
            for (var tok of toks.slice(0, -1)) {
                o[tok] = o[tok] || {};
                o = o[tok];
            }
            o[toks[toks.length-1]] = this.state[varname];
        }
        return g;
    }

    enableTracing() {
        if (this.outputbytes == 0) throw new Error(`outputbytes == 0`);
        if (this.outputbytes % 8) throw new Error(`outputbytes must be 8-byte aligned`);
        if (this.traceBufferSize % 8) throw new Error(`trace buffer size must be 8-byte aligned`);
        this.traceStartOffset = this.globals.lookup(TRACEBUF).offset;
        this.traceEndOffset = this.traceStartOffset + this.traceBufferSize - this.outputbytes;
        this.state[TRACEEND] = this.traceEndOffset;
        this.state[TRACERECLEN] = this.outputbytes;
        this.resetTrace();
        //console.log(this.state[TRACEOFS], this.state[TRACERECLEN], this.state[TRACEEND]);
        this.trace = new Proxy({}, this.makeScopeProxy(() => { return this.traceReadOffset }));
    }

    resetTrace() {
        this.traceReadOffset = this.traceStartOffset;
        this.state[TRACEOFS] = this.traceStartOffset;
    }

    nextTrace() {
        this.traceReadOffset += this.outputbytes;
        if (this.traceReadOffset >= this.traceEndOffset)
            this.traceReadOffset = this.traceStartOffset;
    }

    getTraceRecordSize() {
        return this.traceRecordSize;
    }

    dispose() {
        if (this.bmod) {
            this.bmod.dispose();
            this.bmod = null;
        }
    }

    //

    private genTypes() {
        // generate global variables
        var state = new Struct();
        this.globals = state;
        // TODO: sort globals by size
        // outputs are first
        for (const [varname, vardef] of Object.entries(this.hdlmod.vardefs)) {
            if (vardef.isOutput) state.addVar(vardef);
        }
        if (state.len == 0) state.addEntry("___", 1); // ensure as least 8 output bytes for trace buffer
        state.alignTo(8);
        this.outputbytes = state.len;
        // followed by inputs and internal vars
        for (const [varname, vardef] of Object.entries(this.hdlmod.vardefs)) {
            if (!vardef.isOutput) state.addVar(vardef);
        }
        state.alignTo(8);
        this.statebytes = state.len;
        // followed by constant pool
        for (const [varname, vardef] of Object.entries(this.constpool.vardefs)) {
            state.addVar(vardef);
        }
        state.alignTo(8);
        // and now the trace buffer
        state.addEntry(TRACERECLEN, 4, binaryen.i32);
        state.addEntry(TRACEOFS, 4, binaryen.i32);
        state.addEntry(TRACEEND, 4, binaryen.i32);
        state.addEntry(TRACEBUF, this.traceBufferSize);
        this.traceRecordSize = this.outputbytes;
    }

    private genFuncs() {
         // function type (dsegptr)
         var fsig = binaryen.createType([binaryen.i32])
         for (var block of this.hdlmod.blocks) {
             // TODO: cfuncs only
             var fnname = block.name;
             // find locals of function
             var fscope = new Struct();
             fscope.addEntry(GLOBAL, 4, binaryen.i32, null, true); // 1st param to function
             // add __req local if change_request function
             if (this.funcResult(block.name) == binaryen.i32) {
                 fscope.addEntry(CHANGEDET, 1, binaryen.i32, null, false);
             }
             this.pushScope(fscope);
             block.exprs.forEach((e) => {
                 if (e && isVarDecl(e)) {
                     // TODO: make local reference types, instead of promoting local arrays to global
                     if (isReferenceType(e.dtype)) {
                         this.globals.addVar(e);
                     } else {
                         fscope.addVar(e);
                     }
                 }
             })
             // create function body
             var fbody = this.block2wasm(block, {funcblock:block});
             //var fbody = this.bmod.return(this.bmod.i32.const(0));
             var fret = this.funcResult(block.name);
             var fref = this.bmod.addFunction(fnname, fsig, fret, fscope.getLocals(), fbody);
             this.popScope();
         }
         // export functions
         for (var fname of VERILATOR_UNIT_FUNCTIONS) {
             this.bmod.addFunctionExport(fname, fname);
         }
         // create helper functions
         this.addHelperFunctions();
         // link imported functions
         this.addImportedFunctions();
         // validate wasm module
         //console.log(this.bmod.emitText());
         //this.bmod.optimize();
         if (!this.bmod.validate()) {
            console.log(this.bmod.emitText());
             throw new HDLError(null, `could not validate wasm module`);
         }
    }

    private async genModule() {
        //console.log(this.bmod.emitText());
        var wasmData = this.bmod.emitBinary();
        var compiled = await WebAssembly.compile(wasmData);
        this.instance = await WebAssembly.instantiate(compiled, this.getImportObject());
        this.databuf = (this.instance.exports[MEMORY] as any).buffer;
        this.data8 = new Uint8Array(this.databuf);
        this.data16 = new Uint16Array(this.databuf);
        this.data32 = new Uint32Array(this.databuf);
        // proxy object to access globals (starting from 0)
        this.state = new Proxy({}, this.makeScopeProxy(() => 0));
    }

    private makeScopeProxy(basefn: () => number) {
        return {
            // TODO: more types, signed/unsigned
            get: (target, prop, receiver) => {
                var vref = this.globals.lookup(prop.toString());
                var base = basefn();
                if (vref !== undefined) {
                    if (vref.type && isArrayType(vref.type)) {
                        var elsize = getArrayElementSizeFromType(vref.type);
                        if (elsize == 1) {
                            return new Uint8Array(this.databuf, base + vref.offset, vref.size);
                        } else if (elsize == 2) {
                            return new Uint16Array(this.databuf, (base>>1) + vref.offset, vref.size >> 1);
                        } else if (elsize == 4) {
                            return new Uint32Array(this.databuf, (base>>2) + vref.offset, vref.size >> 2);
                        }
                    } else {
                        if (vref.size == 1) {
                            return this.data8[base + vref.offset];
                        } else if (vref.size == 2) {
                            return this.data16[(base + vref.offset) >> 1];
                        } else if (vref.size == 4) {
                            return this.data32[(base + vref.offset) >> 2];
                        }
                    }
                }
                return undefined;
            },
            set: (obj, prop, value) => {
                var vref = this.globals.lookup(prop.toString());
                var base = basefn();
                if (vref !== undefined) {
                    if (vref.size == 1) {
                        this.data8[(base + vref.offset)] = value;
                        return true;
                    } else if (vref.size == 2) {
                        this.data16[(base + vref.offset) >> 1] = value;
                        return true;
                    } else if (vref.size == 4) {
                        this.data32[(base + vref.offset) >> 2] = value;
                        return true;
                    } else {
                        throw new HDLError(vref, `can't set property ${prop.toString()}`);
                    }
                } else {
                    return true; // silently fail
                }
            }
        }        
    }

    private genInitData() {
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
            if (rec.constval) {
                this.state[rec.name] = rec.constval.cvalue || rec.constval.bigvalue;
            }
        }
    }

    private addHelperFunctions() {
        this.addCopyTraceRecFunction();
        this.addEvalFunction();
        this.addTick2Function();
    }

    private addImportedFunctions() {
        this.bmod.addFunctionImport("$finish_0", "builtins", "$finish", binaryen.createType([binaryen.i32]), binaryen.none);
        this.bmod.addFunctionImport("$stop_0", "builtins", "$stop", binaryen.createType([binaryen.i32]), binaryen.none);
        this.bmod.addFunctionImport("$time_0", "builtins", "$time", binaryen.createType([binaryen.i32]), binaryen.i64);
        this.bmod.addFunctionImport("$rand_0", "builtins", "$rand", binaryen.createType([binaryen.i32]), binaryen.i32);
        this.bmod.addFunctionImport("$readmem_2", "builtins", "$readmem", binaryen.createType([binaryen.i32, binaryen.i32, binaryen.i32]), binaryen.none);
    }

    private getImportObject() : {} {
        var n = 0;
        return {
            builtins: {
                $finish: (o) => { console.log('... Finished @', o); this.finished = true; },
                $stop: (o) => { console.log('... Stopped @', o); this.stopped = true; },
                $time: (o) => BigInt(new Date().getTime()), // TODO: timescale
                $rand: (o) => (Math.random() * (65536 * 65536)) | 0,
                $readmem: (o,a,b) => this.$readmem(a, b)
            }
        }
    }

    private $readmem(p_filename, p_rom) {
        var fn = '';
        for (var i=0; i<255; i++) {
            var charCode = this.data8[p_filename + i];
            if (charCode == 0) break;
            fn = String.fromCharCode(charCode) + fn;
        }
        var filedata = this.getFileData && this.getFileData(fn);
        if (filedata == null) throw new HDLError(fn, `no file "${fn}" for $readmem`);
        if (typeof filedata !== 'string') throw new HDLError(fn, `file "${fn}" must be lines of hex or binary values`);
        var ishex = !fn.endsWith('.binary'); // TODO: hex should be attribute in xml
        var data = filedata.split('\n').filter(s => s !== '').map(s => parseInt(s, ishex ? 16 : 2));
        for (var i=0; i<data.length; i++) {
            this.data8[p_rom + i] = data[i];
        }
        return 0;
    }

    private addCopyTraceRecFunction() {
        const m = this.bmod;
        const o_TRACERECLEN = this.globals.lookup(TRACERECLEN).offset;
        const o_TRACEOFS = this.globals.lookup(TRACEOFS).offset;
        const o_TRACEEND = this.globals.lookup(TRACEEND).offset;
        const o_TRACEBUF = this.globals.lookup(TRACEBUF).offset;
        var i32 = binaryen.i32;
        var none = binaryen.none;
        m.addFunction("copyTraceRec",
            binaryen.createType([]),
            none,
            [i32, i32, i32], // src, len, dest
            m.block("@block", [
                // $0 = 0 (start of globals)
                m.local.set(0, m.i32.const(GLOBALOFS)),
                // don't use $0 as data seg offset, assume trace buffer offsets start @ 0
                // $1 = TRACERECLEN
                m.local.set(1, m.i32.load(0, 4, m.i32.const(o_TRACERECLEN))),
                // $2 = TRACEOFS
                m.local.set(2, m.i32.load(0, 4, m.i32.const(o_TRACEOFS))),
                // while ($1--) [$0]++ = [$2]++
                m.loop("@loop", m.block(null, [
                    m.i64.store(0, 8, m.local.get(2, i32), m.i64.load(0, 8, m.local.get(0, i32))),
                    m.local.set(0, m.i32.add(m.local.get(0, i32), m.i32.const(8))),
                    m.local.set(2, m.i32.add(m.local.get(2, i32), m.i32.const(8))),
                    m.local.set(1, m.i32.sub(m.local.get(1, i32), m.i32.const(8))),
                    this.bmod.br_if("@loop", m.local.get(1, i32))
                ])),
                // TRACEOFS += TRACERECLEN
                m.i32.store(0, 4, m.i32.const(o_TRACEOFS),
                    m.i32.add(
                        m.i32.load(0, 4, m.i32.const(o_TRACEOFS)),
                        m.i32.load(0, 4, m.i32.const(o_TRACERECLEN))
                    )
                ),
                // break if TRACEOFS < TRACEEND
                m.br_if("@block", m.i32.lt_u(
                    m.i32.load(0, 4, m.i32.const(o_TRACEOFS)),
                    m.i32.load(0, 4, m.i32.const(o_TRACEEND))
                )),
                // TRACEOFS = @TRACEBUF
                m.i32.store(0, 4, m.i32.const(o_TRACEOFS), m.i32.const(o_TRACEBUF))
            ])
        );
    }

    private addTick2Function() {
        const m = this.bmod;
        if (this.globals.lookup('clk')) {
            var l_dseg = m.local.get(0, binaryen.i32);
            var l_count = m.local.get(1, binaryen.i32);
            m.addFunction("tick2",
                binaryen.createType([binaryen.i32, binaryen.i32]),
                binaryen.none,
                [],
                m.loop("@loop", m.block(null, [
                    this.makeSetVariableFunction("clk", 0),
                    m.drop(m.call("eval", [l_dseg], binaryen.i32)),
                    this.makeSetVariableFunction("clk", 1),
                    m.drop(m.call("eval", [l_dseg], binaryen.i32)),
                    // call copyTraceRec
                    m.call("copyTraceRec", [], binaryen.none),
                    // dec $1
                    m.local.set(1, m.i32.sub(l_count, m.i32.const(1))),
                    // goto @loop if $1
                    m.br_if("@loop", l_count)
                ]))
            );
            m.addFunctionExport("tick2", "tick2");
        } else {
            m.addFunctionExport("eval", "tick2");
        }
    }

    private addEvalFunction() {
        this.bmod.addFunction("eval",
            binaryen.createType([binaryen.i32]),
            binaryen.i32,
            [],
            this.makeTickFuncBody(0)
        );
        this.bmod.addFunctionExport("eval", "eval");
    }

    private makeGetVariableFunction(name: string, value: number) {
        var dtype = this.globals.lookup(name).type;
        var src : HDLVarRef = {refname:name, dtype:dtype};
        return this.e2w(src);
    }

    private makeSetVariableFunction(name: string, value: number) {
        var dtype = this.globals.lookup(name).type;
        var dest : HDLVarRef = {refname:name, dtype:dtype};
        var src : HDLConstant = {cvalue:value, bigvalue:null, dtype:dtype};
        return this.assign2wasm(dest, src);
    }

    private makeTickFuncBody(count: number) {
        var dseg = this.bmod.local.get(0, binaryen.i32);
        if (count > 4)
            return this.bmod.i32.const(count);
        return this.bmod.block(null, [
            this.bmod.call("_eval", [dseg], binaryen.none),
            this.bmod.if(
                this.bmod.call("_change_request", [dseg], binaryen.i32),
                this.makeTickFuncBody(count+1),
                this.bmod.return(this.bmod.local.get(0, binaryen.i32))
            )
        ], binaryen.i32)
    }

    private funcResult(funcname: string) {
        // only _change functions return a result
        if (funcname.startsWith("_change_request")) return binaryen.i32;
        else if (funcname == '$time') return binaryen.i64;
        else if (funcname == '$rand') return binaryen.i32;
        else return binaryen.none;
    }

    private pushScope(scope: Struct) {
        scope.parent = this.locals;
        this.locals = scope;
    }

    private popScope() {
        this.locals = this.locals.parent;
    }

    private i3264(dt: HDLDataType) {
        var size = getDataTypeSize(dt);
        var type = getBinaryenType(size);
        if (type == binaryen.i32) return this.bmod.i32;
        else if (type == binaryen.i64) return this.bmod.i64;
        else throw new HDLError(null, `unknown type for i3264 ${type}`);
    }

    private i3264rel(e: HDLBinop) {
        if (hasDataType(e.left) && hasDataType(e.right)) {
            var leftsize = getDataTypeSize(e.left.dtype);
            var rightsize = getDataTypeSize(e.right.dtype);
            // TODO: left size should equal right size, both can be > i32 though
            return leftsize > rightsize ? this.i3264(e.left.dtype) : this.i3264(e.right.dtype);
        }
        return this.i3264(e.dtype);
    }

    private dataptr() : number {
        return this.bmod.local.get(0, binaryen.i32); // 1st param of function == data ptr 
    }

    private e2w(e: HDLExpr, opts?:Options) : number {
        if (e == null) {
            return this.bmod.nop();
        } else if (isBlock(e)) {
            return this.block2wasm(e, opts);
        } else if (isVarDecl(e)) {
            return this.local2wasm(e, opts);
        } else if (isVarRef(e)) {
            return this.varref2wasm(e, opts);
        } else if (isConstExpr(e) || isBigConstExpr(e)) {
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
        var ret = opts && opts.funcblock ? this.funcResult(opts.funcblock.name) : binaryen.none;
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
        for (var arg of e.args) {
            args.push(this.e2w(arg));
        }
        var internal = e.funcname;
        if (e.funcname.startsWith('$')) {
            if ((e.funcname == '$stop' || e.funcname == '$finish') && e.$loc) {
                args = [this.bmod.i32.const(e.$loc.line)]; // line # of source code
            }
            internal += '_' + (args.length - 1);
        }
        var ret = this.funcResult(e.funcname);
        return this.bmod.call(internal, args, ret);
    }

    const2wasm(e: HDLConstant, opts: Options) : number {
        var size = getDataTypeSize(e.dtype);
        if (isLogicType(e.dtype)) {
            if (e.bigvalue != null)
                return this.i3264(e.dtype).const(
                    Number(e.bigvalue & BigInt(0xffffffff)),
                    Number(e.bigvalue >> BigInt(32)));
            else if (size <= 4)
                return this.bmod.i32.const(e.cvalue);
            else if (size <= 8)
                return this.bmod.i64.const(e.cvalue, e.cvalue >> 32); // TODO: bigint?
            else
                throw new HDLError(e, `constants > 64 bits not supported`)
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
            if (global.size <= 8)
                return this.loadmem(this.dataptr(), global.offset, global.size);
            else
                return this.address2wasm(e);
        }
        throw new HDLError(e, `cannot lookup variable ${e.refname}`)
    }

    local2wasm(e: HDLVariableDef, opts:Options) : number {
        var local = this.locals.lookup(e.name);
        //if (local == null) throw Error(`no local for ${e.name}`)
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
            var elsize = getArrayElementSizeFromExpr(dest.left);
            return this.storemem(addr, 0, elsize, value);
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
        if (isBinop(e) && (e.op == 'arraysel' || e.op == 'wordsel')) {
            var array = this.address2wasm(e.left);
            var elsize = getArrayElementSizeFromExpr(e.left);
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

    _wordsel2wasm(e: HDLBinop, opts:Options) : number {
        return this._arraysel2wasm(e, opts);
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
            block.push(this.bmod.if(
                    this.e2w(e.loopcond, {resulttype:binaryen.i32}),
                    this.bmod.nop(),
                    this.bmod.br("@block")  // exit loop
            ));
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
        if (hasDataType(e.left)) {
            return this.castexpr(this.e2w(e.left), e.left.dtype, e.dtype);
        } else
            throw new HDLError(e.left, `no data type for ccast`);
    }

    castexpr(val: number, tsrc: HDLDataType, tdst: HDLDataType) : number {
        if (isLogicType(tsrc) && isLogicType(tdst) && tsrc.right == 0 && tdst.right == 0) {
            if (tsrc.left == tdst.left) {
                return val;
            } else if (tsrc.left <= 31 && tdst.left <= 31) {
                return val;
            }
            // TODO: signed?
            else if (tsrc.left <= 31 && tdst.left == 63) { // 32 -> 64
                return this.bmod.i64.extend_u(val);
            } else if (tsrc.left == 63 && tdst.left <= 31) { // 64 -> 32
                return this.bmod.i32.wrap(val);
            }
        }
        throw new HDLError([tsrc, tdst], `cannot cast`);
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
        if (this.bmod.getFeatures() & binaryen.Features.SignExt) {
            if (e.widthminv == 8) {
                return inst.extend8_s(value);
            } else if (e.widthminv == 16) {
                return inst.extend16_s(value);
            } else if (e.widthminv == 32 && e.width == 64) {
                return this.bmod.i64.extend32_s(value);
            }
        }
        var shift = inst.const(e.width - e.widthminv, 0);
        return inst.shr_s(inst.shl(value, shift), shift);
    }

    // TODO: i32/i64
    _redxor2wasm(e: HDLUnop) {
        if (hasDataType(e.left)) {
            var left = this.e2w(e.left);
            var inst = this.i3264(e.left.dtype);
            var rtn = inst.and(
                inst.const(1, 0),
                inst.popcnt(left)); // (num_set_bits & 1)
            return rtn; //this.castexpr(rtn, e.dtype, e.left.dtype);
        } else
            throw new HDLError(e, '');
    }

    binop(e: HDLBinop, f_op: (a:number, b:number) => number, upcastLeft?: boolean, upcastRight?: boolean) {
        var left = this.e2w(e.left);
        var right = this.e2w(e.right);
        if (hasDataType(e.left) && hasDataType(e.right)) {
            var lsize = getDataTypeSize(e.left.dtype);
            var rsize = getDataTypeSize(e.right.dtype);
            if (lsize < rsize && upcastLeft)
                left = this.castexpr(left, e.left.dtype, e.right.dtype);
            else if (rsize < lsize && upcastRight)
                right = this.castexpr(right, e.right.dtype, e.left.dtype);
        }
        var rtn = f_op(left, right);
        return rtn;
    }

    relop(e: HDLBinop, f_op : (a:number,b:number)=>number) {
        return f_op(this.e2w(e.left), this.e2w(e.right));
    }

    _or2wasm(e: HDLBinop) {
        return this.binop(e, this.i3264(e.dtype).or);
    }
    _and2wasm(e: HDLBinop) {
        return this.binop(e, this.i3264(e.dtype).and);
    }
    _xor2wasm(e: HDLBinop) {
        return this.binop(e, this.i3264(e.dtype).xor);
    }
    _shiftl2wasm(e: HDLBinop) {
        return this.binop(e, this.i3264(e.dtype).shl, false, true);
    }
    _shiftr2wasm(e: HDLBinop) {
        // TODO: signed?
        return this.binop(e, this.i3264(e.dtype).shr_u, false, true);
    }
    _add2wasm(e: HDLBinop) {
        return this.binop(e, this.i3264(e.dtype).add);
    }
    _sub2wasm(e: HDLBinop) {
        return this.binop(e, this.i3264(e.dtype).sub);
    }
    _mul2wasm(e: HDLBinop) {
        return this.binop(e, this.i3264(e.dtype).mul);
    }
    _moddiv2wasm(e: HDLBinop) {
        return this.binop(e, this.i3264(e.dtype).rem_u);
    }
    _div2wasm(e: HDLBinop) {
        return this.binop(e, this.i3264(e.dtype).div_u);
    }
    _moddivs2wasm(e: HDLBinop) {
        return this.binop(e, this.i3264(e.dtype).rem_s);
    }
    _divs2wasm(e: HDLBinop) {
        return this.binop(e, this.i3264(e.dtype).div_s);
    }

    // TODO: i32/i64
    _eq2wasm(e: HDLBinop) {
        return this.relop(e, this.i3264rel(e).eq);
    }
    _neq2wasm(e: HDLBinop) {
        return this.relop(e, this.i3264rel(e).ne);
    }
    _lt2wasm(e: HDLBinop) {
        return this.relop(e, this.i3264rel(e).lt_u);
    }
    _gt2wasm(e: HDLBinop) {
        return this.relop(e, this.i3264rel(e).gt_u);
    }
    _lte2wasm(e: HDLBinop) {
        return this.relop(e, this.i3264rel(e).le_u);
    }
    _gte2wasm(e: HDLBinop) {
        return this.relop(e, this.i3264rel(e).ge_u);
    }
    _gts2wasm(e: HDLBinop) {
        return this.relop(e, this.i3264rel(e).gt_s);
    }
    _lts2wasm(e: HDLBinop) {
        return this.relop(e, this.i3264rel(e).lt_s);
    }
    _gtes2wasm(e: HDLBinop) {
        return this.relop(e, this.i3264rel(e).ge_s);
    }
    _ltes2wasm(e: HDLBinop) {
        return this.relop(e, this.i3264rel(e).le_s);
    }

}

