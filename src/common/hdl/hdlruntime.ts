
import { EmuHalt } from "../emu";
import { byteArrayToString, safe_extend } from "../util";
import { HDLBinop, HDLBlock, HDLConstant, HDLDataType, HDLExpr, HDLExtendop, HDLFuncCall, HDLModuleDef, HDLModuleRunner, HDLSourceLocation, HDLTriop, HDLUnop, HDLValue, HDLVariableDef, HDLVarRef, isArrayItem, isArrayType, isBigConstExpr, isBinop, isBlock, isConstExpr, isFuncCall, isLogicType, isTriop, isUnop, isVarDecl, isVarRef, isWhileop } from "./hdltypes";

interface VerilatorUnit {
    _ctor_var_reset(state) : void;
    _eval_initial(state) : void;
    _eval_settle(state) : void;
    _eval(state) : void;
    _change_request(state) : boolean;
}

export class HDLError extends EmuHalt {
    obj: any;
    constructor(obj: any, msg: string) {
        super(msg, obj ? obj.$loc : null);
        Object.setPrototypeOf(this, HDLError.prototype);
        this.obj = obj;
        if (obj) console.log(obj);
    }
}

export class HDLModuleJS implements HDLModuleRunner {

    mod: HDLModuleDef;
    constpool: HDLModuleDef;
    globals: {[name: string] : HDLVariableDef};
    locals: {[name: string] : HDLVariableDef};
    state: {[name: string] : HDLValue};
    basefuncs: VerilatorUnit;
    curfuncs: VerilatorUnit;
    finished: boolean = false;
    stopped: boolean = false;
    settleTime: number = 0;
    curconsts: {};
    constused: number;
    specfuncs: VerilatorUnit[] = [];
    getFileData = null;
    resetStartTimeMsec : number;
    
    constructor(mod: HDLModuleDef, constpool: HDLModuleDef) {
        this.mod = mod;
        this.constpool = constpool;
        this.basefuncs = {} as any;
        this.state = {}; //new Object(this.funcs) as any;
        this.globals = {};
        // set built-in functions
        Object.getOwnPropertyNames(Object.getPrototypeOf(this)).filter((f) => f.startsWith('$')).forEach((f) => {
            this.basefuncs[f] = this[f].bind(this);
        })
        // set initial state
        if (this.constpool) {
            var cp = new HDLModuleJS(this.constpool, null);
            cp.init();
            Object.assign(this.state, cp.state);
            Object.assign(this.globals, cp.globals);
        }
        for (var varname in this.mod.vardefs) {
            var vardef = this.mod.vardefs[varname];
            this.globals[varname] = vardef;
            this.state[varname] = this.defaultValue(vardef.dtype, vardef);
        }
        // generate functions
        this.basefuncs = this.genFuncs({});
        this.curfuncs = this.basefuncs;
        /*
        for (var i=0; i<16; i++) {
            this.specfuncs[i] = this.genFuncs({
                //reset:(i&1),
                //clk:(i&2),
                //CPU16$state:i
                test_CPU16_top$cpu$state:i
            });
        }
        */
    }

    init() {
    }

    dispose() {
    }

    genFuncs(constants: {}) : VerilatorUnit {
        var funcs = Object.create(this.basefuncs);
        this.curconsts = constants;
        for (var block of this.mod.blocks) {
            this.locals = {};
            // if we have at least 1 constant value, check for it (set counter to zero)
            this.constused = (Object.keys(this.curconsts).length == 0) ? 99999 : 0;
            var s = this.block2js(block);
            if (this.constused) {
                try {
                    var funcname = block.name||'__anon';
                    var funcbody = `'use strict'; function ${funcname}(o) { ${s} }; return ${funcname};`;
                    var func = new Function('', funcbody)();
                    funcs[block.name] = func;
                    //console.log(funcbody);
                } catch (e) {
                    console.log(funcbody);
                    throw e;
                }
            }
            //if (this.constused) console.log('FUNC',constants,funcname,this.constused);
        }
        return funcs;
    }

    getJSCode() : string {
        var s = '';
        for (var funcname in this.basefuncs) {
            if (funcname && funcname.startsWith("_")) {
                s += this.basefuncs[funcname].toString();
                s += "\n";
            }
        }
        return s;
    }

    powercycle() {
        this.resetStartTimeMsec = new Date().getTime() - 1;
        this.finished = false;
        this.stopped = false;
        this.basefuncs._ctor_var_reset(this.state);
        this.basefuncs._eval_initial(this.state);
        for (var i=0; i<100; i++) {
            this.basefuncs._eval_settle(this.state);
            this.basefuncs._eval(this.state);
            var Vchange = this.basefuncs._change_request(this.state);
            if (!Vchange) {
                this.settleTime = i;
                return;
            }
        }
        throw new HDLError(null, `model did not converge on reset()`)
    }

    eval() {
        var clk = this.state.clk as number;
        var reset = this.state.reset as number;
        var state = this.state.test_CPU16_top$cpu$state as number;
        var opcode = this.state.CPU$opcode as number;
        var aluop = this.state.CPU$aluop as number;
        var fi = state;
        //this.curfuncs = this.specfuncs[fi & 0xff];
        this.curfuncs = this.basefuncs;
        for (var i=0; i<100; i++) {
            this.curfuncs._eval(this.state);
            var Vchange = this.curfuncs._change_request(this.state);
            /*
            --- don't do it this way! it's like 4x slower...
            this.call('_eval');
            var Vchange = this.call('_change_request');
            */
            if (!Vchange) {
                this.settleTime = i;
                return;
            }
        }
        throw new HDLError(null, `model did not converge on eval()`)
    }

    tick2(iters: number) {
        while (iters-- > 0) {
            this.state.clk = 0;
            this.eval();
            this.state.clk = 1;
            this.eval();
        }
    }

    defaultValue(dt: HDLDataType, vardef?: HDLVariableDef) : HDLValue {
        if (isLogicType(dt)) {
            if (dt.left <= 31)
                return 0;
            else
                return BigInt(0);
        } else if (isArrayType(dt) && typeof dt.high.cvalue === 'number' && typeof dt.low.cvalue === 'number') {
            let arr;
            let arrlen = dt.high.cvalue - dt.low.cvalue + 1;
            if (arrlen < 0) arrlen = -arrlen; // TODO?
            if (isLogicType(dt.subtype)) {
                if (dt.subtype.left <= 7)
                    arr = new Uint8Array(arrlen);
                else if (dt.subtype.left <= 15)
                    arr = new Uint16Array(arrlen);
                else if (dt.subtype.left <= 31)
                    arr = new Uint32Array(arrlen);
                else {
                    arr = []; // TODO?
                }
            } else {
                arr = [];
                for (let i=0; i<arrlen; i++) {
                    arr[i] = this.defaultValue(dt.subtype);
                }
            }
            if (vardef != null && vardef.initValue != null) {
                for (let i=0; i<vardef.initValue.exprs.length; i++) {
                    let e = vardef.initValue.exprs[i];
                    if (isArrayItem(e) && isConstExpr(e.expr)) {
                        arr[e.index] = e.expr.cvalue;
                    } else {
                        throw new HDLError(dt, `non-const expr in initarray`);
                    }
                }
            }
            return arr;
        }
        throw new HDLError(dt, `no default value for var type: ${vardef.name}`);
    }

    constValue(expr: HDLExpr) : number {
        if (isConstExpr(expr)) {
            return expr.cvalue;
        } else {
            throw new HDLError(expr, `no const value for expr`);
        }
    }

    block2js(block: HDLBlock) : string {
        return this.expr2js(block);
    }

    expr2js(e: HDLExpr, options?:{store?:boolean,cond?:boolean}) : string {
        if (e == null) {
            return "/*null*/"; // TODO
        }
        if (isVarRef(e)) {
            if (this.curconsts[e.refname] != null && !(options||{}).store) {
                this.constused++;
                return `${this.curconsts[e.refname]}`;
            } else if (this.locals[e.refname]) {
                return `${e.refname}`;
            } else if (this.globals[e.refname]) {
                return `o.${e.refname}`;
            } else
                throw new HDLError(e, `cannot find variable '${e.refname}'`)
        } else if (isVarDecl(e)) {
            this.locals[e.name] = e;
            let s = `var ${e.name}`;
            if (e.constValue != null) {
                s += ` = ${this.constValue(e)}`; // TODO?
            } else if (e.initValue != null) {
                // TODO?
                throw new HDLError(e, `can't init array here`);
            } else if (isLogicType(e.dtype) && e.dtype.left > 31) {
                // TODO: hack for big ints ($readmem)
                s += ` = []`;
            }
            return s;
        } else if (isConstExpr(e)) {
            return `0x${e.cvalue.toString(16)}`;
        } else if (isBigConstExpr(e)) {
            return e.bigvalue.toString(); // TODO?
        } else if (isTriop(e)) {
            switch (e.op) {
                case 'if':
                    if (e.right == null || (isBlock(e.right) && e.right.exprs.length == 0))
                        return `if (${this.expr2js(e.cond, {cond:true})}) { ${this.expr2js(e.left)} }`;
                    else
                        return `if (${this.expr2js(e.cond, {cond:true})}) { ${this.expr2js(e.left)} } else { ${this.expr2js(e.right)} }`;
                case 'cond':
                case 'condbound':
                    return `(${this.expr2js(e.cond, {cond:true})} ? ${this.expr2js(e.left)} : ${this.expr2js(e.right)})`;
                default:
                    throw new HDLError(e, `unknown triop ${e.op}`);
            }
        } else if (isBinop(e)) {
            switch (e.op) {
                case 'contassign':
                case 'assign':
                case 'assignpre':
                case 'assigndly':
                case 'assignpost':
                    return `${this.expr2js(e.right, {store:true})} = ${this.expr2js(e.left)}`;
                case 'arraysel':
                case 'wordsel':
                    return `${this.expr2js(e.left)}[${this.expr2js(e.right)}]`;
                case 'changedet':
                    // __req |= ((vlTOPp->control_test_top__02Ehsync ^ vlTOPp->__Vchglast__TOP__control_test_top__02Ehsync)
                    // vlTOPp->__Vchglast__TOP__control_test_top__02Ehsync = vlTOPp->control_test_top__02Ehsync;
                    return `$$req |= (${this.expr2js(e.left)} ^ ${this.expr2js(e.right)}); ${this.expr2js(e.right)} = ${this.expr2js(e.left)}`;
                default:
                    var jsop = OP2JS[e.op];
                    if (!jsop) {
                        throw new HDLError(e, `unknown binop ${e.op}`)
                    }
                    if (jsop.startsWith('?')) {
                        jsop = jsop.substr(1);
                        if (!options || !options.cond) {
                            return `((${this.expr2js(e.left)} ${jsop} ${this.expr2js(e.right)})?1:0)`;
                        }
                    }
                    return `(${this.expr2js(e.left)} ${jsop} ${this.expr2js(e.right)})`;
            }
        } else if (isUnop(e)) {
            switch (e.op) {
                case 'ccast': // TODO: cast ints, cast bools?
                    return this.expr2js(e.left);
                case 'creturn':
                    return `return ${this.expr2js(e.left)}`;
                case 'creset':
                    return this.expr2reset(e.left);
                case 'not':
                    return `(~${this.expr2js(e.left)})`;
                    //return `(${this.expr2js(e.left)}?0:1)`;
                case 'negate':
                    return `(-${this.expr2js(e.left)})`;
                case 'extends':
                    let shift = 32 - (e as HDLExtendop).widthminv;
                    return `((${this.expr2js(e.left)} << ${shift}) >> ${shift})`;
                case 'redxor':
                    return `this.$$${e.op}(${this.expr2js(e.left)})`;
                default:
                    throw new HDLError(e, `unknown unop ${e.op}`);
            }
        } else if (isBlock(e)) {
            // TODO: { e } ?
            var body = e.exprs.map((x) => this.expr2js(x)).join(';\n');
            if (e.name) {
                if (e.name.startsWith('_change_request')) {
                    return `var $$req = 0;\n${body}\n;return $$req;`
                } else if (e.blocktype == 'sformatf') {
                    var args = e.exprs.map((x) => this.expr2js(x));
                    args = [JSON.stringify(e.name)].concat(args);
                    return args.join(', ');
                }
            }
            return body;
        } else if (isWhileop(e)) {
            return `for (${this.expr2js(e.precond)}; ${this.expr2js(e.loopcond)}; ${this.expr2js(e.inc)}) { ${this.expr2js(e.body)} }`
        } else if (isFuncCall(e)) {
            if ((e.funcname == '$stop' || e.funcname == '$finish') && e.$loc) {
                return `this.${e.funcname}(o, ${JSON.stringify(e.$loc)})`;
            } else if (e.args == null || e.args.length == 0) {
                return `this.${e.funcname}(o)`;
            } else {
                return `this.${e.funcname}(o, ${ e.args.map(arg => this.expr2js(arg)).join(', ') })`;
            }
        }
        console.log(e);
        throw new Error(`unrecognized expr: ${JSON.stringify(e)}`);
    }

    expr2reset(e: HDLExpr) {
        if (isVarRef(e)) {
            if (this.curconsts[e.refname] != null) {
                return `${e.refname}`;
            } else if (isLogicType(e.dtype)) {
                if (e.dtype.left <= 31)
                    return `${this.expr2js(e)} = 0`;
                else
                    return `${this.expr2js(e)} = BigInt(0)`;
            } else if (isArrayType(e.dtype)) {
                if (isLogicType(e.dtype.subtype)) {
                    return `${this.expr2js(e)}.fill(0)`;
                } else if (isArrayType(e.dtype.subtype) && isLogicType(e.dtype.subtype.subtype)) {
                    return `${this.expr2js(e)}.forEach((a) => a.fill(0))`
                } else {
                    // TODO: 3d arrays?
                    throw new HDLError(e, `unsupported data type for reset: ${JSON.stringify(e.dtype)}`);
                }
            }
        } else {
            throw new HDLError(e, `can only reset var refs`);
        }
    }

    // runtime methods
    // TODO: $time, $display, etc

    $finish(o, loc) {
        if (!this.finished) {
            console.log("Simulation $finish", loc);
            this.finished = true;
        }
    }

    $stop(o, loc) {
        if (!this.stopped) {
            console.log("Simulation $stop", loc);
            this.stopped = true;
        }
    }

    $rand(o) : number {
        return Math.random() | 0;
    }

    $display(o, fmt, ...args) {
        // TODO: replace args, etc
        console.log(fmt, args);
    }

    // TODO: implement arguments, XML
    $readmem(o, filename, memp, lsbp, msbp, ishex) {
        // parse filename from 32-bit values into characters
        var barr = [];
        for (var i=0; i<filename.length; i++) {
            barr.push((filename[i] >> 0)  & 0xff);
            barr.push((filename[i] >> 8)  & 0xff);
            barr.push((filename[i] >> 16) & 0xff);
            barr.push((filename[i] >> 24) & 0xff);
        }
        barr = barr.filter(x => x != 0); // ignore zeros
        barr.reverse(); // reverse it
        var strfn = byteArrayToString(barr); // convert to string
        // parse hex/binary file
        var strdata = this.getFileData(strfn) as string;
        if (strdata == null) throw new HDLError(null, "Could not $readmem '" + strfn + "'");
        var data = strdata.split('\n').filter(s => s !== '').map(s => parseInt(s, ishex ? 16 : 2));
        console.log('$readmem', ishex, strfn, data.length);
        // copy into destination array
        if (memp === null) throw new HDLError(null, "No destination array to $readmem " + strfn);
        if (memp.length < data.length) throw new HDLError(null, "Destination array too small to $readmem " + strfn);
        for (i=0; i<data.length; i++)
            memp[i] = data[i];
    }

    $time(o) {
        return (new Date().getTime() - this.resetStartTimeMsec); // TODO: timescale
    }

    $$redxor(r: number) : number {
        r=(r^(r>>1)); r=(r^(r>>2)); r=(r^(r>>4)); r=(r^(r>>8)); r=(r^(r>>16));
        return r;
    }

    //

    isStopped() { return this.stopped; }
    isFinished() { return this.finished; }
    
    tick() {
        (this.state as any).clk ^= 1;
        this.eval();
    }

    get(varname: string) {
        return this.state[varname];
    }

    set(varname: string, value) {
        if (varname in this.state) {
            this.state[varname] = value;
        }
    }

    saveState() {
        return safe_extend(true, {}, this.state);
    }

    getGlobals() {
        return this.saveState();
    }

    loadState(state) {
        safe_extend(true, this.state, state);
    }

}

const OP2JS : {[key:string] : string} = {
    'eq'    :   '?===',
    'neq'   :   '?!==',
    'gt'    :   '?>',
    'lt'    :   '?<',
    'gte'   :   '?>=',
    'lte'   :   '?<=',
    'and'   :   '&',
    'or'    :   '|',
    'xor'   :   '^',
    'add'   :   '+',
    'sub'   :   '-',
    'shiftr':   '>>>', // TODO?
    'shiftl':   '<<',
    // TODO: correct?
    'mul'   :   '*',
    'moddiv':   '%',
    'div'   :   '/',
    // TODO: signed versions? functions?
    'muls'  :   '*',
    'moddivs':  '%',
    'divs'  :   '/',
    'gts'   :   '?>', 
    'gtes'  :   '?>=',
    'lts'   :   '?<', 
    'ltes'  :   '?<=',
}

/**
 // SIMULATOR STUFF (should be global)

export var vl_finished = false;
export var vl_stopped = false;

export function VL_UL(x) { return x|0; }
//export function VL_ULL(x) { return x|0; }
export function VL_TIME_Q() { return (new Date().getTime())|0; }

  /// Return true if data[bit] set
export function VL_BITISSET_I(data,bit) { return (data & (VL_UL(1)<<VL_UL(bit))); }

export function VL_EXTENDSIGN_I(lbits, lhs) { return (-((lhs)&(VL_UL(1)<<(lbits-1)))); }

export function VL_EXTEND_II(obits,lbits,lhs) { return lhs; }

export function VL_EXTENDS_II(x,lbits,lhs) {
    return VL_EXTENDSIGN_I(lbits,lhs) | lhs;
  }

export function VL_NEGATE_I(x) { return -x; }

export function VL_LTS_III(x,lbits,y,lhs,rhs) {
    return (VL_EXTENDS_II(x,lbits,lhs) < VL_EXTENDS_II(x,lbits,rhs)) ? 1 : 0; }

export function VL_GTS_III(x,lbits,y,lhs,rhs) {
    return (VL_EXTENDS_II(x,lbits,lhs) > VL_EXTENDS_II(x,lbits,rhs)) ? 1 : 0; }

export function VL_LTES_III(x,lbits,y,lhs,rhs) {
    return (VL_EXTENDS_II(x,lbits,lhs) <= VL_EXTENDS_II(x,lbits,rhs)) ? 1 : 0; }

export function VL_GTES_III(x,lbits,y,lhs,rhs) {
    return (VL_EXTENDS_II(x,lbits,lhs) >= VL_EXTENDS_II(x,lbits,rhs)) ? 1 : 0; }

export function VL_DIV_III(lbits,lhs,rhs) {
    return (((rhs)==0)?0:(lhs)/(rhs)); }

export function VL_MULS_III(lbits,lhs,rhs) {
    return (((rhs)==0)?0:(lhs)*(rhs)); }
  
export function VL_MODDIV_III(lbits,lhs,rhs) {
    return (((rhs)==0)?0:(lhs)%(rhs)); }

export function VL_DIVS_III(lbits,lhs,rhs) {
  var lhs_signed = VL_EXTENDS_II(32, lbits, lhs);
  var  rhs_signed = VL_EXTENDS_II(32, lbits, rhs);
  return (((rhs_signed)==0)?0:(lhs_signed)/(rhs_signed));
}

export function VL_MODDIVS_III(lbits,lhs,rhs) {
  var lhs_signed = VL_EXTENDS_II(32, lbits, lhs);
  var  rhs_signed = VL_EXTENDS_II(32, lbits, rhs);
  return (((rhs_signed)==0)?0:(lhs_signed)%(rhs_signed));
}

export function VL_REDXOR_32(r) {
    r=(r^(r>>1)); r=(r^(r>>2)); r=(r^(r>>4)); r=(r^(r>>8)); r=(r^(r>>16));
    return r;
  }

export var VL_WRITEF = console.log; // TODO: $write

export function vl_finish(filename,lineno,hier) {
    if (!vl_finished) console.log("Finished at " + filename + ":" + lineno, hier);
    vl_finished = true;
  }
export function vl_stop(filename,lineno,hier) {
    if (!vl_stopped) console.log("Stopped at " + filename + ":" + lineno, hier);
    vl_stopped = true;
  }

export function VL_RAND_RESET_I(bits) { return 0 | Math.floor(Math.random() * (1<<bits)); }

export function VL_RANDOM_I(bits) { return 0 | Math.floor(Math.random() * (1<<bits)); }

export function VL_READMEM_Q(ishex,width,depth,array_lsb,fnwords,filename,memp,start,end) {
  VL_READMEM_W(ishex,width,depth,array_lsb,fnwords,filename,memp,start,end);
}
export function VL_READMEM_W(ishex,width,depth,array_lsb,fnwords,filename,memp,start,end) {
}

// SIMULATOR BASE

abstract class VerilatorBase {

  totalTicks = 0;
  maxVclockLoop = 0;
  clk = 0;
  reset = 0;

  vl_fatal(msg:string) {
    console.log(msg);
  }

  ticks() : number { return this.totalTicks; }
  setTicks(T:number) { this.totalTicks = T|0; }

  __reset() {
    if (this.reset !== undefined) {
      this.totalTicks = 0;
      this.reset = 0;
      this.tick2();
      this.reset = 1;
    }
  }


  tick2() {
    this.clk = 0;
    this.eval();
    this.clk = 1;
    this.eval();
  }
  
  abstract _eval(vlSymsp);
  abstract __Vm_didInit : boolean;
  abstract __Vm_activity : boolean;
  abstract _change_request(vlSymsp);
  abstract _eval_initial(vlSymsp);
  abstract _eval_settle(vlSymsp);

  eval() {
    let vlSymsp = this; //{TOPp:this};
    // Initialize
    if (!vlSymsp.__Vm_didInit)
      this._eval_initial_loop(vlSymsp);
    // Evaluate till stable
    //VL_DEBUG_IF(VL_PRINTF("\n----TOP Evaluate Vmain::eval\n"); );
    var __VclockLoop = 0;
    var __Vchange=1;
    while (__Vchange) {
        //VL_DEBUG_IF(VL_PRINTF(" Clock loop\n"););
        vlSymsp.__Vm_activity = true;
        this._eval(vlSymsp);
        __Vchange = this._change_request(vlSymsp);
        if (++__VclockLoop > 100) { this.vl_fatal("Verilated model didn't converge"); }
    }
    if (__VclockLoop > this.maxVclockLoop) {
      this.maxVclockLoop = __VclockLoop;
      if (this.maxVclockLoop > 1) {
        console.log("Graph took " + this.maxVclockLoop + " iterations to stabilize");
        $("#verilog_bar").show();
        $("#settle_label").text(this.maxVclockLoop+"");
      }
    }
    this.totalTicks++;
  }

  _eval_initial_loop(vlSymsp) {
    vlSymsp.TOPp = this;
    vlSymsp.__Vm_didInit = true;
    this._eval_initial(vlSymsp);
    vlSymsp.__Vm_activity = true;
    var __VclockLoop = 0;
    var __Vchange=1;
    while (__Vchange) {
        this._eval_settle(vlSymsp);
        this._eval(vlSymsp);
        __Vchange = this._change_request(vlSymsp);
        if (++__VclockLoop > 100) { this.vl_fatal("Verilated model didn't DC converge"); }
    }
  }
}

 */

