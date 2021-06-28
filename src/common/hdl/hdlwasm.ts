
import { HDLBinop, HDLBlock, HDLConstant, HDLDataType, HDLExpr, HDLExtendop, HDLFuncCall, HDLModuleDef, HDLTriop, HDLUnop, HDLValue, HDLVariableDef, HDLVarRef, isArrayItem, isArrayType, isBinop, isBlock, isConstExpr, isFuncCall, isLogicType, isTriop, isUnop, isVarDecl, isVarRef, isWhileop } from "./hdltypes";
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
}

const GLOBAL = "$$GLOBAL";
const CHANGEDET = "$$CHANGE";
const MEMORY = "0";

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
        return (dt.high.cvalue - dt.low.cvalue + 1) * getDataTypeSize(dt.subtype);
        //return (asValue(dt.high) - asValue(dt.low) + 1) * dt.
    } else {
        console.log(dt);
        throw Error(`don't know data type`);
    }
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
}

class Struct {
    parent : Struct;
    len : number = 0;
    vars : {[name: string] : StructRec} = {};
    locals : StructRec[] = [];
    params : StructRec[] = [];
    
    addVar(vardef: HDLVariableDef) {
        var size = getDataTypeSize(vardef.dtype);
        return this.addEntry(vardef.name, getBinaryenType(size), size, vardef.dtype, false);
    }

    addEntry(name: string, itype: number, size: number, hdltype: HDLDataType, isParam: boolean) : StructRec {
        // pointers are 32 bits, so if size > 8 it's a pointer
        var rec : StructRec = {
            name: name,
            type: hdltype,
            size: size,
            itype: itype,
            index: this.params.length + this.locals.length,
            offset: this.len,
        }
        this.len += 8; //TODO: rec.size, alignment
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

export class HDLModuleWASM {

    bmod: binaryen.Module;
    hdlmod: HDLModuleDef;
    constpool: HDLModuleDef;
    globals: Struct;
    locals: Struct;

    constructor(moddef: HDLModuleDef, constpool: HDLModuleDef) {
        this.hdlmod = moddef;
        this.constpool = constpool;
    }

    init() {
        this.bmod = new binaryen.Module();
        this.genTypes();
        this.bmod.setMemory(this.globals.len, this.globals.len, MEMORY); // TODO?
        this.genFuncs();
    }

    genTypes() {
        var state = new Struct();
        for (const [varname, vardef] of Object.entries(this.hdlmod.vardefs)) {
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
        console.log(this.bmod.emitText());
        //this.bmod.optimize();
        if (!this.bmod.validate())
            throw Error(`could not validate wasm module`);
        //console.log(this.bmod.emitText());
        this.test();
    }

    test() {
        var wasmData = this.bmod.emitBinary();
        var compiled = new WebAssembly.Module(wasmData);
        var instance = new WebAssembly.Instance(compiled, {});
        var mem = (instance.exports[MEMORY] as any).buffer;
        (instance.exports as any)._ctor_var_reset(0);
        (instance.exports as any)._eval_initial(0);
        (instance.exports as any)._eval_settle(0);
        var data = new Uint8Array(mem);
        var o_clk = this.globals.lookup('clk').offset;
        var o_reset = this.globals.lookup('reset').offset
        data[o_reset] = 1;
        //new Uint8Array(mem)[this.globals.lookup('reset').offset] = 0;
        //new Uint8Array(mem)[this.globals.lookup('enable').offset] = 1;
        for (var i=0; i<20; i++) {
            data[o_clk] = 0;
            (instance.exports as any).tick(0);
            data[o_clk] = 1;
            (instance.exports as any).tick(0);
            if (i==5) new Uint8Array(mem)[this.globals.lookup('reset').offset] = 0;
        }
        console.log(mem);
        var t1 = new Date().getTime();
        var tickiters = 10000;
        var looplen = Math.round(100000000/tickiters);
        for (var i=0; i<looplen; i++) {
            (instance.exports as any).tick2(0,tickiters);
        }
        var t2 = new Date().getTime();
        console.log('wasm:',t2-t1,'msec',i*tickiters,'iterations');
        console.log(mem);
    }

    addHelperFunctions() {
        this.bmod.addFunction("tick",
            binaryen.createType([binaryen.i32]),    // (dataptr)
            binaryen.i32,                           // return # of iterations
            [],                                     // no locals
            this.makeTickFunction(0)
        );
        this.bmod.addFunctionExport("tick", "tick");

        var l_dseg = this.bmod.local.get(0, binaryen.i32);
        var l_count = this.bmod.local.get(1, binaryen.i32);
        this.bmod.addFunction("tick2",
            binaryen.createType([binaryen.i32, binaryen.i32]),    // (dataptr, iters)
            binaryen.none,                                        // return nothing
            [],                                                   // no locals
            this.bmod.loop("@loop", this.bmod.block(null, [
                this.makeSetVariableFunction("clk", 0),
                this.bmod.drop(this.bmod.call("tick", [l_dseg], binaryen.i32)),
                this.makeSetVariableFunction("clk", 1),
                this.bmod.drop(this.bmod.call("tick", [l_dseg], binaryen.i32)),
                // dec $1
                this.bmod.local.set(1, this.bmod.i32.sub(l_count, this.bmod.i32.const(1))),
                // goto @loop if $1
                this.bmod.br_if("@loop", l_count)
            ]))
        );
        this.bmod.addFunctionExport("tick2", "tick2");
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
        else throw Error();
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
            if (fn == null) { console.log(e); throw Error(`no such method ${n}`) }
            return this[n](e, opts);
        } else {
            console.log('expr', e);
            throw Error(`could not translate expr`)
        }
    }

    block2wasm(e: HDLBlock, opts?:Options) : number {
        var stmts = e.exprs.map((stmt) => this.e2w(stmt));
        var ret = opts && opts.funcblock ? this.funcResult(opts.funcblock) : binaryen.none;
        if (ret == binaryen.i32) { // must have return value
            stmts.push(this.bmod.return(this.bmod.local.get(this.locals.lookup(CHANGEDET).index, ret)));
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
                throw new Error(`constants > 32 bits not supported`)
        } else {
            console.log(e);
            throw new Error(`non-logic constants not supported`)
        }
    }

    varref2wasm(e: HDLVarRef, opts: Options) : number {
        if (opts && opts.store) throw Error(`cannot store here`);
        var local = this.locals && this.locals.lookup(e.refname);
        var global = this.globals.lookup(e.refname);
        if (local != null) {
            return this.bmod.local.get(local.index, local.itype);
        } else if (global != null) {
            if (global.size == 1) {
                return this.bmod.i32.load8_u(global.offset, 1, this.dataptr());
            } else if (global.size == 2) {
                return this.bmod.i32.load16_u(global.offset, 2, this.dataptr());
            } else if (global.size == 4) {
                return this.bmod.i32.load(global.offset, 4, this.dataptr());
            } else if (global.size == 8) {
                return this.bmod.i64.load(global.offset, 8, this.dataptr());
            }
        }
        throw new Error(`cannot lookup variable ${e.refname}`)
    }

    local2wasm(e: HDLVariableDef, opts:Options) : number {
        var local = this.locals.lookup(e.name);
        if (local == null) throw Error(`no local for ${e.name}`)
        return this.bmod.nop(); // TODO
    }

    assign2wasm(dest: HDLExpr, src: HDLExpr) {
        var value = this.e2w(src);
        if (isVarRef(dest)) {
            var local = this.locals && this.locals.lookup(dest.refname);
            var global = this.globals.lookup(dest.refname);
            if (local != null) {
                return this.bmod.local.set(local.index, value);
            } else if (global != null) {
                if (global.size == 1) {
                    return this.bmod.i32.store8(global.offset, 1, this.dataptr(), value);
                } else if (global.size == 2) {
                    return this.bmod.i32.store16(global.offset, 2, this.dataptr(), value);
                } else if (global.size == 4) {
                    return this.bmod.i32.store(global.offset, 4, this.dataptr(), value);
                } else if (global.size == 8) {
                    return this.bmod.i64.store(global.offset, 8, this.dataptr(), value);
                }
            }
        }
        console.log(dest, src);
        throw new Error(`cannot complete assignment`);
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
    _changedet2wasm(e: HDLBinop, opts:Options) {
        var req = this.locals.lookup(CHANGEDET);
        if (!req) throw Error(`no changedet local`);
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
}

