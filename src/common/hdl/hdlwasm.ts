
import * as binaryen from 'binaryen';
//import binaryen = require("binaryen");
import { hasDataType, HDLBinop, HDLBlock, HDLConstant, HDLDataType, HDLDataTypeObject, HDLExpr, HDLExtendop, HDLFuncCall, HDLModuleDef, HDLModuleRunner, HDLSourceLocation, HDLSourceObject, HDLTriop, HDLUnop, HDLValue, HDLVariableDef, HDLVarRef, HDLWhileOp, isArrayItem, isArrayType, isBigConstExpr, isBinop, isBlock, isConstExpr, isFuncCall, isLogicType, isTriop, isUnop, isVarDecl, isVarRef, isWhileop } from "./hdltypes";
import { HDLError } from "./hdlruntime";

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
    funcarg?: boolean;
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
        throw new HDLError(e, `elements > 64 bits not supported`);
    }
    throw new HDLError(e, `cannot figure out array element size`);
}

function getArrayValueSize(e: HDLExpr) : number {
    return getDataTypeSize(getArrayValueType(e));
}

function getArrayValueType(e: HDLExpr) : HDLDataType {
    if (isVarRef(e)) {
        var dt = e.dtype;
        while (isArrayType(dt))
            dt = dt.subtype;
        return dt;
    } else if (isBinop(e) && e.op == 'arraysel') {
        return getArrayValueType(e.left);
    } else if (isBinop(e) && e.op == 'wordsel') {
        return getArrayValueType(e.left);
    }
    throw new HDLError(e, `cannot figure out array value type`);
}

function getAlignmentForSize(size) {
    if (size <= 1) return 1;
    else if (size <= 2) return 2;
    else if (size <= 4) return 4;
    else return 8;
}

function getBinaryenType(size: number) {
    if (size <= 4) return binaryen.i32;
    else if (size <= 8) return binaryen.i64;
    else return binaryen.none;
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
    reset: boolean;
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
            reset: false,
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
    databuf: Buffer;
    data8: Uint8Array;
    data16: Uint16Array;
    data32: Uint32Array;
    getFileData = null;
    maxMemoryMB: number;
    optimize: boolean = false;
    maxEvalIterations: number = 8;

    state: any;
    statebytes: number;
    outputbytes: number;

    traceBufferSize: number = 0xff000;
    traceRecordSize: number;
    traceReadOffset: number;
    traceStartOffset: number;
    traceEndOffset: number;
    trace: any;

    randomizeOnReset: boolean = false;
    finished: boolean;
    stopped: boolean;
    resetStartTimeMsec : number;

    constructor(moddef: HDLModuleDef, constpool: HDLModuleDef, maxMemoryMB?: number) {
        this.hdlmod = moddef;
        this.constpool = constpool;
        this.maxMemoryMB = maxMemoryMB || 16;
        this.genMemory();
        this.genFuncs();
        this.validate();
    }

    async init() {
        await this.genModule();
        this.genStateInterface();
        this.enableTracing();
    }

    initSync() {
        this.genModuleSync();
        this.genStateInterface();
        this.enableTracing();
    }

    powercycle() {
        // TODO: merge w/ JS runtime
        this.resetStartTimeMsec = new Date().getTime() - 1;
        this.finished = false;
        this.stopped = false;
        this.clearMutableState();
        this.setInitialValues();
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

    // get tree of global variables for debugging
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
        this.trace = this.makeScopeProxy(() => { return this.traceReadOffset });
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
            this.instance = null;
            this.databuf = null;
            this.data8 = null;
            this.data16 = null;
            this.data32 = null;
        }
    }

    //

    private genMemory() {
        this.bmod = new binaryen.Module();
        this.bmod.setFeatures(binaryen.Features.SignExt);
        this.genTypes();
        var membytes = this.globals.len;
        if (membytes > this.maxMemoryMB*1024*1024)
            throw new HDLError(null, `cannot allocate ${membytes} bytes, limit is ${this.maxMemoryMB} MB`);
        var memblks = Math.ceil(membytes / 65536);
        this.bmod.setMemory(memblks, memblks, MEMORY); // memory is in 64k chunks
    }

    private genTypes() {
        // generate global variables
        var state = new Struct();
        this.globals = state;
        // separate vars and constants
        var vardefs = Object.values(this.hdlmod.vardefs).filter(vd => vd.constValue == null);
        var constdefs = Object.values(this.hdlmod.vardefs).filter(vd => vd.constValue != null);
        // sort globals by output flag and size
        function getVarDefSortKey(vdef: HDLVariableDef) {
            var val = getDataTypeSize(vdef.dtype); // sort by size
            if (!vdef.isOutput) val += 1000000; // outputs are first in list
            return val;
        }
        vardefs.sort((a,b) => {
            return getVarDefSortKey(a) - getVarDefSortKey(b);
        });
        // outputs are contiguous so we can copy them to the trace buffer
        // so we put them all first in the struct order
        for (var vardef of vardefs) {
            if (vardef.isOutput) state.addVar(vardef);
        }
        if (state.len == 0) state.addEntry("___", 1); // ensure as least 8 output bytes for trace buffer
        state.alignTo(8);
        this.outputbytes = state.len;
        // followed by inputs and internal vars (arrays after logical types)
        for (var vardef of vardefs) {
            if (!vardef.isOutput) state.addVar(vardef);
        }
        state.alignTo(8);
        this.statebytes = state.len;
        // followed by constants and constant pool
        if (this.constpool) {
            for (const vardef of Object.values(constdefs)) {
                state.addVar(vardef);
            }
            for (const vardef of Object.values(this.constpool.vardefs)) {
                state.addVar(vardef);
            }
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
        for (var block of this.hdlmod.blocks) {
            this.genFunction(block);
        }
        // export functions
        for (var fname of VERILATOR_UNIT_FUNCTIONS) {
            this.bmod.addFunctionExport(fname, fname);
        }
        // create helper functions
        this.addHelperFunctions();
        // link imported functions
        this.addImportedFunctions();
    }

    private validate() {
        // optimize wasm module (default passes crash binaryen.js)
        if (this.optimize) {
            var size = this.bmod.emitBinary().length;
            // TODO: more passes?
            // https://github.com/WebAssembly/binaryen/blob/369b8bdd3d9d49e4d9e0edf62e14881c14d9e352/src/passes/pass.cpp#L396
            this.bmod.runPasses(['dce','optimize-instructions','precompute','simplify-locals','simplify-globals','rse','vacuum'/*,'dae-optimizing','inlining-optimizing'*/])
            var optsize = this.bmod.emitBinary().length;
            console.log('optimize', size, '->', optsize)
        }
        // validate wasm module
        if (!this.bmod.validate()) {
            //console.log(this.bmod.emitText());
            throw new HDLError(null, `could not validate wasm module`);
        }
    }

    private genFunction(block) {
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
        var fsig = binaryen.createType([binaryen.i32]); // pass dataptr()
        var fref = this.bmod.addFunction(fnname, fsig, fret, fscope.getLocals(), fbody);
        this.popScope();
    }

    private async genModule() {
        var wasmData = this.bmod.emitBinary();
        var compiled = await WebAssembly.compile(wasmData);
        this.instance = await WebAssembly.instantiate(compiled, this.getImportObject());
    }

    private genModuleSync() {
        var wasmData = this.bmod.emitBinary();
        var compiled = new WebAssembly.Module(wasmData);
        this.instance = new WebAssembly.Instance(compiled, this.getImportObject());
    }

    private genStateInterface() {
        this.databuf = (this.instance.exports[MEMORY] as any).buffer;
        this.data8 = new Uint8Array(this.databuf);
        this.data16 = new Uint16Array(this.databuf);
        this.data32 = new Uint32Array(this.databuf);
        // proxy object to access globals (starting from 0)
        this.state = this.makeScopeProxy(() => { return 0 });
    }

    private defineProperty(proxy, basefn: () => number, vref: StructRec) {
        var _this = this;
        // precompute some things
        var elsize = vref.type && getArrayElementSizeFromType(vref.type);
        var eltype = vref.type;
        while (eltype && isArrayType(eltype)) {
            eltype = eltype.subtype;
        }
        var mask = -1; // set all bits
        if (eltype && isLogicType(eltype) && eltype.left < 31) {
            mask = (1 << (eltype.left+1)) - 1; // set partial bits
        }
        // define get/set on proxy object
        Object.defineProperty(proxy, vref.name, {
            get() {
                let base = basefn();
                if (vref.type && isArrayType(vref.type)) {
                    // TODO: can't mask unused bits in array
                    if (elsize == 1) {
                        return new Uint8Array(_this.databuf, base + vref.offset, vref.size);
                    } else if (elsize == 2) {
                        return new Uint16Array(_this.databuf, (base>>1) + vref.offset, vref.size >> 1);
                    } else if (elsize == 4) {
                        return new Uint32Array(_this.databuf, (base>>2) + vref.offset, vref.size >> 2);
                    }
                } else {
                    if (vref.size == 1) {
                        return _this.data8[base + vref.offset];
                    } else if (vref.size == 2) {
                        return _this.data16[(base + vref.offset) >> 1];
                    } else if (vref.size == 4) {
                        return _this.data32[(base + vref.offset) >> 2];
                    }
                }
                return new Uint32Array(_this.databuf, (base>>2) + vref.offset, vref.size >> 2);
            },
            set(value) {
                var base = basefn();
                if (vref.size == 1) {
                    _this.data8[(base + vref.offset)] = value & mask;
                    return true;
                } else if (vref.size == 2) {
                    _this.data16[(base + vref.offset) >> 1] = value & mask;
                    return true;
                } else if (vref.size == 4) {
                    _this.data32[(base + vref.offset) >> 2] = value & mask;
                    return true;
                } else {
                    throw new HDLError(vref, `can't set property ${vref.name}`);
                }
            },
            enumerable: true,
            configurable: false
        });
    }

    private makeScopeProxy(basefn: () => number) : {} {
        var proxy = Object.create(null); // no inherited properties
        for (var vref of Object.values(this.globals.vars)) {
            if (vref != null) this.defineProperty(proxy, basefn, vref);
        }
        return proxy;
    }

    setInitialValues() {
        for (var rec of this.globals.locals) {
            this.setInitialValue(rec);
        }
    }

    private setInitialValue(rec: StructRec) {
        var arr = this.state[rec.name];
        if (rec.init) {
            if (!arr) throw new HDLError(rec, `no array to init`);
            for (let i=0; i<rec.init.exprs.length; i++) {
                let e = rec.init.exprs[i];
                if (isArrayItem(e) && isConstExpr(e.expr)) {
                    arr[e.index] = e.expr.cvalue;
                } else {
                    throw new HDLError(e, `non-const expr in initarray (multidimensional arrays not supported)`);
                }
            }
            //console.log(rec.name, rec.type, arr);
        } else if (rec.constval) {
            this.state[rec.name] = rec.constval.cvalue || rec.constval.bigvalue;
        } else if (rec.type && rec.reset && this.randomizeOnReset) {
            if (isLogicType(rec.type) && typeof arr === 'number') {
                this.state[rec.name] = Math.random() * 4294967296; // don't need to mask
            } else if (isArrayType(rec.type) && isLogicType(rec.type.subtype)) {
                // array types are't mask-protected yet
                var mask = (1 << (rec.type.subtype.left + 1)) - 1;
                for (var i=0; i<arr.length; i++) {
                    arr[i] = (Math.random() * 4294967296) & mask;
                }
            } else {
                console.log(`could not reset ${rec.name}`)
            }
        }
    }

    clearMutableState() {
        this.data32.fill(0, 0, this.statebytes >> 2);
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
            // TODO: merge w/ JS runtime
            builtins: {
                $finish: (o) => { if (!this.finished) console.log('... Finished @', o); this.finished = true; },
                $stop: (o) => { if (!this.stopped) console.log('... Stopped @', o); this.stopped = true; },
                $time: (o) => BigInt(new Date().getTime() - this.resetStartTimeMsec), // TODO: timescale
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

    // create a new unique label
    labelseq = 0;
    private label(s?: string) : string {
        return `@${s||"label"}_${++this.labelseq}`;
    }

    private addCopyTraceRecFunction() {
        const m = this.bmod;
        const o_TRACERECLEN = this.globals.lookup(TRACERECLEN).offset;
        const o_TRACEOFS = this.globals.lookup(TRACEOFS).offset;
        const o_TRACEEND = this.globals.lookup(TRACEEND).offset;
        const o_TRACEBUF = this.globals.lookup(TRACEBUF).offset;
        var i32 = binaryen.i32;
        var none = binaryen.none;
        var l_block = this.label("@block");
        var l_loop = this.label("@loop");
        m.addFunction("copyTraceRec",
            binaryen.createType([]),
            none,
            [i32, i32, i32], // src, len, dest
            m.block(l_block, [
                // $0 = 0 (start of globals)
                m.local.set(0, m.i32.const(GLOBALOFS)),
                // don't use $0 as data seg offset, assume trace buffer offsets start @ 0
                // $1 = TRACERECLEN
                m.local.set(1, m.i32.load(0, 4, m.i32.const(o_TRACERECLEN))),
                // $2 = TRACEOFS
                m.local.set(2, m.i32.load(0, 4, m.i32.const(o_TRACEOFS))),
                // while ($1--) [$0]++ = [$2]++
                m.loop(l_loop, m.block(null, [
                    m.i64.store(0, 8, m.local.get(2, i32), m.i64.load(0, 8, m.local.get(0, i32))),
                    m.local.set(0, m.i32.add(m.local.get(0, i32), m.i32.const(8))),
                    m.local.set(2, m.i32.add(m.local.get(2, i32), m.i32.const(8))),
                    m.local.set(1, m.i32.sub(m.local.get(1, i32), m.i32.const(8))),
                    this.bmod.br_if(l_loop, m.local.get(1, i32))
                ])),
                // TRACEOFS += TRACERECLEN
                m.i32.store(0, 4, m.i32.const(o_TRACEOFS),
                    m.i32.add(
                        m.i32.load(0, 4, m.i32.const(o_TRACEOFS)),
                        m.i32.load(0, 4, m.i32.const(o_TRACERECLEN))
                    )
                ),
                // break if TRACEOFS < TRACEEND
                m.br_if(l_block, m.i32.lt_u(
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
        var l_loop = this.label("@loop");
        if (this.globals.lookup('clk')) {
            var v_dseg = m.local.get(0, binaryen.i32);
            //var v_count = m.local.get(1, binaryen.i32);
            m.addFunction("tick2",
                binaryen.createType([binaryen.i32, binaryen.i32]),
                binaryen.none,
                [],
                m.loop(l_loop, m.block(null, [
                    this.makeSetVariableFunction("clk", 0),
                    m.drop(m.call("eval", [v_dseg], binaryen.i32)),
                    this.makeSetVariableFunction("clk", 1),
                    m.drop(m.call("eval", [v_dseg], binaryen.i32)),
                    // call copyTraceRec
                    m.call("copyTraceRec", [], binaryen.none),
                    // goto @loop if ($1 = $1 - 1)
                    m.br_if(l_loop, 
                        m.local.tee(1, 
                            m.i32.sub(
                                m.local.get(1, binaryen.i32),
                                m.i32.const(1)
                            ), binaryen.i32))
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
        if (count > this.maxEvalIterations)
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
        else throw new HDLError(dt, `data types > 64 bits not supported`);
    }

    private i3264rel(e: HDLBinop) {
        if (hasDataType(e.left) && hasDataType(e.right)) {
            var lsize = getDataTypeSize(e.left.dtype);
            var rsize = getDataTypeSize(e.right.dtype);
            if (lsize > rsize) return this.i3264(e.left.dtype);
            else return this.i3264(e.right.dtype);
        }
        throw new HDLError(e, `can't ${e.op} arguments`);
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
            args.push(this.e2w(arg, {funcarg:true}));
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
            if (e.bigvalue != null) {
                let low = e.bigvalue & BigInt(0xffffffff);
                let high = (e.bigvalue >> BigInt(32)) & BigInt(0xffffffff);
                return this.i3264(e.dtype).const(Number(low), Number(high));
            } else if (size <= 4)
                return this.bmod.i32.const(e.cvalue|0);
            else if (size <= 8)
                return this.bmod.i64.const(e.cvalue|0, 0);
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
            if (global.size > 8 && opts && opts.funcarg)
                return this.address2wasm(e); // TODO: only applies to wordsel
            else
                return this.loadmem(e, this.dataptr(), global.offset, global.size);
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
                return this.storemem(dest, this.dataptr(), global.offset, global.size, value);
            }
        } else if (isBinop(dest)) {
            var addr = this.address2wasm(dest);
            var elsize = dest.op == 'wordsel' ? getDataTypeSize(dest.dtype) : getArrayElementSizeFromExpr(dest.left);
            return this.storemem(dest, addr, 0, elsize, value);
        }
        throw new HDLError(dest, `cannot complete assignment`);
    }

    loadmem(e: HDLSourceObject, ptr, offset:number, size:number) : number {
        if (size == 1) {
            return this.bmod.i32.load8_u(offset, 1, ptr);
        } else if (size == 2) {
            return this.bmod.i32.load16_u(offset, 2, ptr);
        } else if (size == 4) {
            return this.bmod.i32.load(offset, 4, ptr);
        } else if (size == 8) {
            return this.bmod.i64.load(offset, 8, ptr);
        } else {
            throw new HDLError(e, `cannot load ${size} bytes (> 64 bits not supported)`)
        }
    }
    
    storemem(e: HDLSourceObject, ptr, offset:number, size:number, value) : number {
        if (size == 1) {
            return this.bmod.i32.store8(offset, 1, ptr, value);
        } else if (size == 2) {
            return this.bmod.i32.store16(offset, 2, ptr, value);
        } else if (size == 4) {
            return this.bmod.i32.store(offset, 4, ptr, value);
        } else if (size == 8) {
            return this.bmod.i64.store(offset, 8, ptr, value);
        } else {
            throw new HDLError(e, `cannot store ${size} bytes (> 64 bits not supported)`)
        }
    }

    address2wasm(e: HDLExpr) : number {
        if (isBinop(e) && (e.op == 'arraysel' || e.op == 'wordsel')) {
            var elsize = e.op == 'wordsel' ? getDataTypeSize(e.dtype) : getArrayElementSizeFromExpr(e.left);
            var array = this.address2wasm(e.left);
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
        var ret = this.loadmem(e, addr, 0, elsize);
        // cast to destination type, if it differs than fetch type
        if (elsize != getDataTypeSize(e.dtype)) {
            ret = this.castexpr(ret, getArrayValueType(e), e.dtype);
        }
        return ret;
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
        var l_block = this.label("@block");
        var l_loop = this.label("@loop");
        var block = [];
        if (e.precond) {
            block.push(this.e2w(e.precond));
        }
        if (e.loopcond) {
            // TODO: detect constant while loop condition
            block.push(this.bmod.if(
                    this.e2w(e.loopcond, {resulttype:binaryen.i32}),
                    this.bmod.nop(),
                    this.bmod.br(l_block)  // exit loop
            ));
        }
        if (e.body) {
            block.push(this.e2w(e.body));
        }
        if (e.inc) {
            block.push(this.e2w(e.inc));
        }
        block.push(this.bmod.br(l_loop));
        return this.bmod.loop(l_loop, this.bmod.block(l_block, block, binaryen.none));
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
            } else if (tsrc.left > 63 || tdst.left > 63) {
                throw new HDLError(tdst, `values > 64 bits not supported`);
            } else if (tsrc.left <= 31 && tdst.left <= 31 && !tsrc.signed && !tdst.signed) {
                return val;
            } else if (tsrc.left > 31 && tdst.left > 31 && !tsrc.signed && !tdst.signed) {
                return val;
            } else if (tsrc.left == 7 && tdst.left == 31 && tsrc.signed && tdst.signed) {
                return this.bmod.i32.extend8_s(val);
            } else if (tsrc.left == 15 && tdst.left == 31 && tsrc.signed && tdst.signed) {
                return this.bmod.i32.extend16_s(val);
            } else if (tsrc.left <= 31 && tdst.left > 31) { // 32 -> 64
                if (tsrc.signed)
                    return this.bmod.i64.extend_s(val);
                else
                    return this.bmod.i64.extend_u(val);
            } else if (tsrc.left > 31 && tdst.left <= 31) { // 64 -> 32
                return this.bmod.i32.wrap(val);
            } else if (tsrc.left < 31 && tdst.left == 31 && tsrc.signed) { // sign extend via shift (silice case)
                let inst = this.i3264(tdst);
                var shift = inst.const(31 - tsrc.left, 0);
                return inst.shr_s(inst.shl(val, shift), shift);
            }
            throw new HDLError([tsrc, tdst], `cannot cast ${tsrc.left}/${tsrc.signed} to ${tdst.left}/${tdst.signed}`);
        }
        throw new HDLError([tsrc, tdst], `cannot cast`);
    }

    _creset2wasm(e: HDLUnop, opts:Options) {
        if (isVarRef(e.left)) {
            var glob = this.globals.lookup(e.left.refname);
            // TODO: must be better way to tell non-randomize values
            // set clk and reset to known values so values are reset properly
            glob.reset = glob.name != 'clk' && glob.name != 'reset' && !glob.name.startsWith("__V");
        }
        // we reset values in powercycle()
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
        let datainst = this.i3264(hasDataType(e.left) && e.left.dtype);
        return this.bmod.block(null, [
            // if (left != right) req = 1;
            this.bmod.if(
                datainst.ne(left, right),
                this.bmod.local.set(req.index, this.bmod.i32.const(1)),
                this.bmod.nop(),
            ),
            // ${this.expr2js(e.right)} = ${this.expr2js(e.left)}`
            this.assign2wasm(e.right, e.left)
        ]);
    }

    _extend2wasm(e: HDLExtendop, opts:Options) {
        var value = this.e2w(e.left);
        if (e.widthminv == 32 && e.width == 64) {
            return this.bmod.i64.extend_u(value);
        }
        throw new HDLError(e, `cannot extend`);
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
        // TODO: this might not work? (t_math_signed2.v)
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
            return this.castexpr(rtn, e.left.dtype, e.dtype);
        } else
            throw new HDLError(e, '');
    }

    binop(e: HDLBinop, f_op: (a:number, b:number) => number) {
        var left = this.e2w(e.left);
        var right = this.e2w(e.right);
        var upcast = null;
        // if one argument is 64 bit and one is 32 bit, upcast the latter to 64 bits
        if (hasDataType(e.left) && hasDataType(e.right)) {
            var lsize = getDataTypeSize(e.left.dtype);
            var rsize = getDataTypeSize(e.right.dtype);
            var ltype = getBinaryenType(lsize);
            var rtype = getBinaryenType(rsize);
            if (ltype != rtype && rsize > lsize) {
                left = this.castexpr(left, e.left.dtype, e.right.dtype);
                upcast = e.right.dtype;
            } else if (ltype != rtype && lsize > rsize) {
                right = this.castexpr(right, e.right.dtype, e.left.dtype);
                upcast = e.left.dtype;
            } else if (ltype != rtype)
                throw new HDLError(e, `wrong argument sizes ${lsize} and ${rsize}`);
        }
        var rtn = f_op(left, right);
        // if we upcasted, and result is 32 bit, downcast to 32 bits
        if (upcast) {
            rtn = this.castexpr(rtn, upcast, e.dtype);
        }
        return rtn;
    }

    _or2wasm(e: HDLBinop) {
        return this.binop(e, this.i3264rel(e).or);
    }
    _and2wasm(e: HDLBinop) {
        return this.binop(e, this.i3264rel(e).and);
    }
    _xor2wasm(e: HDLBinop) {
        return this.binop(e, this.i3264rel(e).xor);
    }
    _shiftl2wasm(e: HDLBinop) {
        return this.binop(e, this.i3264rel(e).shl);
    }
    _shiftr2wasm(e: HDLBinop) {
        return this.binop(e, this.i3264rel(e).shr_u);
    }
    _shiftrs2wasm(e: HDLBinop) {
        return this.binop(e, this.i3264rel(e).shr_s);
    }
    _add2wasm(e: HDLBinop) {
        return this.binop(e, this.i3264rel(e).add);
    }
    _sub2wasm(e: HDLBinop) {
        return this.binop(e, this.i3264rel(e).sub);
    }
    _mul2wasm(e: HDLBinop) {
        return this.binop(e, this.i3264rel(e).mul);
    }
    _muls2wasm(e: HDLBinop) {
        return this.binop(e, this.i3264rel(e).mul); // TODO: signed?
    }
    _moddiv2wasm(e: HDLBinop) {
        return this.binop(e, this.i3264rel(e).rem_u);
    }
    _div2wasm(e: HDLBinop) {
        return this.binop(e, this.i3264rel(e).div_u);
    }
    _moddivs2wasm(e: HDLBinop) {
        return this.binop(e, this.i3264rel(e).rem_s);
    }
    _divs2wasm(e: HDLBinop) {
        return this.binop(e, this.i3264rel(e).div_s);
    }

    relop(e: HDLBinop, f_op : (a:number,b:number)=>number) {
        return f_op(this.e2w(e.left), this.e2w(e.right));
    }
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

