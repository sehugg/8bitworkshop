"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.VerilogXMLParser = exports.CompileError = void 0;
const util_1 = require("../util");
const hdltypes_1 = require("./hdltypes");
/**
 * Whaa?
 *
 * Each hierarchy takes (uint32[] -> uint32[])
 * - convert to/from js object
 * - JS or WASM
 * - Fixed-size packets
 * - state is another uint32[]
 * Find optimal packing of bits
 * Find clocks
 * Find pivots (reset, state) concat them together
 * Dependency cycles
 * https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/SharedArrayBuffer
 */
class CompileError extends Error {
    constructor($loc, msg) {
        super(msg);
        this.$loc = $loc;
        Object.setPrototypeOf(this, CompileError.prototype);
    }
}
exports.CompileError = CompileError;
class VerilogXMLParser {
    constructor() {
        this.files = {};
        this.dtypes = {};
        this.modules = {};
        this.hierarchies = {};
        this.cur_deferred = [];
        // TODO: other types?
        this.dtypes['QData'] = { left: 63, right: 0, signed: false };
        this.dtypes['IData'] = { left: 31, right: 0, signed: false };
        this.dtypes['SData'] = { left: 15, right: 0, signed: false };
        this.dtypes['CData'] = { left: 7, right: 0, signed: false };
        this.dtypes['byte'] = { left: 7, right: 0, signed: true };
        this.dtypes['shortint'] = { left: 15, right: 0, signed: true };
        this.dtypes['int'] = { left: 31, right: 0, signed: true };
        this.dtypes['integer'] = { left: 31, right: 0, signed: true };
        this.dtypes['longint'] = { left: 63, right: 0, signed: true };
        this.dtypes['time'] = { left: 63, right: 0, signed: false };
    }
    defer(fn) {
        this.cur_deferred.unshift(fn);
    }
    defer2(fn) {
        this.cur_deferred.push(fn);
    }
    run_deferred() {
        this.cur_deferred.forEach((fn) => fn());
        this.cur_deferred = [];
    }
    name2js(s) {
        if (s == null)
            throw new CompileError(this.cur_loc, `no name`);
        return s.replace(/[^a-z0-9_]/gi, '$');
    }
    findChildren(node, type, required) {
        var arr = node.children.filter((n) => n.type == type);
        if (arr.length == 0 && required)
            throw new CompileError(this.cur_loc, `no child of type ${type}`);
        return arr;
    }
    parseSourceLocation(node) {
        var loc = node.attrs['loc'];
        if (loc) {
            if (loc == this.cur_loc_str) {
                return this.cur_loc; // cache last parsed $loc object
            }
            else {
                var [fileid, line, col, end_line, end_col] = loc.split(',');
                var $loc = {
                    hdlfile: this.files[fileid],
                    path: this.files[fileid].filename,
                    line: parseInt(line),
                    start: parseInt(col) - 1,
                    end_line: parseInt(end_line),
                    end: parseInt(end_col) - 1,
                };
                this.cur_loc = $loc;
                this.cur_loc_str = loc;
                return $loc;
            }
        }
        else {
            return null;
        }
    }
    open_module(node) {
        var module = {
            $loc: this.parseSourceLocation(node),
            name: node.attrs['name'],
            origName: node.attrs['origName'],
            blocks: [],
            instances: [],
            vardefs: {},
        };
        if (this.cur_module)
            throw new CompileError(this.cur_loc, `nested modules not supported`);
        this.cur_module = module;
        return module;
    }
    deferDataType(node, def) {
        var dtype_id = node.attrs['dtype_id'];
        if (dtype_id != null) {
            this.defer(() => {
                def.dtype = this.dtypes[dtype_id];
                if (!def.dtype) {
                    throw new CompileError(this.cur_loc, `Unknown data type ${dtype_id} for ${node.type}`);
                }
            });
        }
    }
    parseConstValue(s) {
        const re_const = /(\d+)'([s]?)h([0-9a-f]+)/i;
        var m = re_const.exec(s);
        if (m) {
            var numstr = m[3];
            if (numstr.length <= 8)
                return parseInt(numstr, 16);
            else
                return BigInt('0x' + numstr);
        }
        else {
            throw new CompileError(this.cur_loc, `could not parse constant "${s}"`);
        }
    }
    resolveVar(s, mod) {
        var def = mod.vardefs[s];
        if (def == null)
            throw new CompileError(this.cur_loc, `could not resolve variable "${s}"`);
        return def;
    }
    resolveModule(s) {
        var mod = this.modules[s];
        if (mod == null)
            throw new CompileError(this.cur_loc, `could not resolve module "${s}"`);
        return mod;
    }
    //
    visit_verilator_xml(node) {
    }
    visit_package(node) {
    }
    visit_module(node) {
        this.findChildren(node, 'var', false).forEach((n) => {
            if ((0, hdltypes_1.isVarDecl)(n.obj)) {
                this.cur_module.vardefs[n.obj.name] = n.obj;
            }
        });
        this.modules[this.cur_module.name] = this.cur_module;
        this.cur_module = null;
    }
    visit_var(node) {
        var name = node.attrs['name'];
        name = this.name2js(name);
        var vardef = {
            $loc: this.parseSourceLocation(node),
            name: name,
            origName: node.attrs['origName'],
            isInput: node.attrs['dir'] == 'input',
            isOutput: node.attrs['dir'] == 'output',
            isParam: node.attrs['param'] == 'true',
            dtype: null,
        };
        this.deferDataType(node, vardef);
        var const_nodes = this.findChildren(node, 'const', false);
        if (const_nodes.length) {
            vardef.constValue = const_nodes[0].obj;
        }
        var init_nodes = this.findChildren(node, 'initarray', false);
        if (init_nodes.length) {
            vardef.initValue = init_nodes[0].obj;
        }
        return vardef;
    }
    visit_const(node) {
        var name = node.attrs['name'];
        var cvalue = this.parseConstValue(name);
        var constdef = {
            $loc: this.parseSourceLocation(node),
            dtype: null,
            cvalue: typeof cvalue === 'number' ? cvalue : null,
            bigvalue: typeof cvalue === 'bigint' ? cvalue : null,
        };
        this.deferDataType(node, constdef);
        return constdef;
    }
    visit_varref(node) {
        var name = node.attrs['name'];
        name = this.name2js(name);
        var varref = {
            $loc: this.parseSourceLocation(node),
            dtype: null,
            refname: name
        };
        this.deferDataType(node, varref);
        var mod = this.cur_module;
        /*
        this.defer2(() => {
            varref.vardef = this.resolveVar(name, mod);
        });
        */
        return varref;
    }
    visit_sentree(node) {
        // TODO
    }
    visit_always(node) {
        // TODO
        var sentree;
        var expr;
        if (node.children.length == 2) {
            sentree = node.children[0].obj;
            expr = node.children[1].obj;
            // TODO: check sentree
        }
        else {
            sentree = null;
            expr = node.children[0].obj;
        }
        var always = {
            $loc: this.parseSourceLocation(node),
            blocktype: node.type,
            name: null,
            senlist: sentree,
            exprs: [expr],
        };
        this.cur_module.blocks.push(always);
        return always;
    }
    visit_begin(node) {
        var exprs = [];
        node.children.forEach((n) => exprs.push(n.obj));
        return {
            $loc: this.parseSourceLocation(node),
            blocktype: node.type,
            name: node.attrs['name'],
            exprs: exprs,
        };
    }
    visit_initarray(node) {
        return this.visit_begin(node);
    }
    visit_inititem(node) {
        this.expectChildren(node, 1, 1);
        return {
            index: parseInt(node.attrs['index']),
            expr: node.children[0].obj
        };
    }
    visit_cfunc(node) {
        if (this.cur_module == null) { // TODO?
            //console.log('no module open, skipping', node);
            return;
        }
        var block = this.visit_begin(node);
        block.exprs = [];
        node.children.forEach((n) => block.exprs.push(n.obj));
        this.cur_module.blocks.push(block);
        return block;
    }
    visit_cuse(node) {
    }
    visit_instance(node) {
        var instance = {
            $loc: this.parseSourceLocation(node),
            name: node.attrs['name'],
            origName: node.attrs['origName'],
            ports: [],
            module: null,
        };
        node.children.forEach((child) => {
            instance.ports.push(child.obj);
        });
        this.cur_module.instances.push(instance);
        this.defer(() => {
            instance.module = this.resolveModule(node.attrs['defName']);
        });
        return instance;
    }
    visit_iface(node) {
        throw new CompileError(this.cur_loc, `interfaces not supported`);
    }
    visit_intfref(node) {
        throw new CompileError(this.cur_loc, `interfaces not supported`);
    }
    visit_port(node) {
        this.expectChildren(node, 1, 1);
        var varref = {
            $loc: this.parseSourceLocation(node),
            name: node.attrs['name'],
            expr: node.children[0].obj
        };
        return varref;
    }
    visit_netlist(node) {
    }
    visit_files(node) {
    }
    visit_module_files(node) {
        node.children.forEach((n) => {
            if (n.obj) {
                var file = this.files[n.obj.id];
                if (file)
                    file.isModule = true;
            }
        });
    }
    visit_file(node) {
        return this.visit_file_or_module(node, false);
    }
    // TODO
    visit_scope(node) {
    }
    visit_topscope(node) {
    }
    visit_file_or_module(node, isModule) {
        var file = {
            id: node.attrs['id'],
            filename: node.attrs['filename'],
            isModule: isModule,
        };
        this.files[file.id] = file;
        return file;
    }
    visit_cells(node) {
        this.expectChildren(node, 1, 9999);
        var hier = node.children[0].obj;
        if (hier != null) {
            var hiername = hier.name;
            this.hierarchies[hiername] = hier;
        }
    }
    visit_cell(node) {
        var hier = {
            $loc: this.parseSourceLocation(node),
            name: node.attrs['name'],
            module: null,
            parent: null,
            children: node.children.map((n) => n.obj),
        };
        if (node.children.length > 0)
            throw new CompileError(this.cur_loc, `multiple non-flattened modules not yet supported`);
        node.children.forEach((n) => n.obj.parent = hier);
        this.defer(() => {
            hier.module = this.resolveModule(node.attrs['submodname']);
        });
        return hier;
    }
    visit_basicdtype(node) {
        let id = node.attrs['id'];
        var dtype;
        var dtypename = node.attrs['name'];
        switch (dtypename) {
            case 'logic':
            case 'integer': // TODO?
            case 'bit':
                let dlogic = {
                    $loc: this.parseSourceLocation(node),
                    left: parseInt(node.attrs['left'] || "0"),
                    right: parseInt(node.attrs['right'] || "0"),
                    signed: node.attrs['signed'] == 'true'
                };
                dtype = dlogic;
                break;
            case 'string':
                let dstring = {
                    $loc: this.parseSourceLocation(node),
                    jstype: 'string'
                };
                dtype = dstring;
                break;
            default:
                dtype = this.dtypes[dtypename];
                if (dtype == null) {
                    throw new CompileError(this.cur_loc, `unknown data type ${dtypename}`);
                }
        }
        this.dtypes[id] = dtype;
        return dtype;
    }
    visit_refdtype(node) {
    }
    visit_enumdtype(node) {
    }
    visit_enumitem(node) {
    }
    visit_packarraydtype(node) {
        // TODO: packed?
        return this.visit_unpackarraydtype(node);
    }
    visit_memberdtype(node) {
        throw new CompileError(null, `structs not supported`);
    }
    visit_constdtype(node) {
        // TODO? throw new CompileError(null, `constant data types not supported`);
    }
    visit_paramtypedtype(node) {
        // TODO? throw new CompileError(null, `constant data types not supported`);
    }
    visit_unpackarraydtype(node) {
        let id = node.attrs['id'];
        let sub_dtype_id = node.attrs['sub_dtype_id'];
        let range = node.children[0].obj;
        if ((0, hdltypes_1.isConstExpr)(range.left) && (0, hdltypes_1.isConstExpr)(range.right)) {
            var dtype = {
                $loc: this.parseSourceLocation(node),
                subtype: null,
                low: range.left,
                high: range.right,
            };
            this.dtypes[id] = dtype;
            this.defer(() => {
                dtype.subtype = this.dtypes[sub_dtype_id];
                if (!dtype.subtype)
                    throw new CompileError(this.cur_loc, `Unknown data type ${sub_dtype_id} for array`);
            });
            return dtype;
        }
        else {
            throw new CompileError(this.cur_loc, `could not parse constant exprs in array`);
        }
    }
    visit_senitem(node) {
        var edgeType = node.attrs['edgeType'];
        if (edgeType != "POS" && edgeType != "NEG")
            throw new CompileError(this.cur_loc, "POS/NEG required");
        return {
            $loc: this.parseSourceLocation(node),
            edgeType: edgeType,
            expr: node.obj
        };
    }
    visit_text(node) {
    }
    visit_cstmt(node) {
    }
    visit_cfile(node) {
    }
    visit_typetable(node) {
    }
    visit_constpool(node) {
    }
    visit_comment(node) {
    }
    expectChildren(node, low, high) {
        if (node.children.length < low || node.children.length > high)
            throw new CompileError(this.cur_loc, `expected between ${low} and ${high} children`);
    }
    __visit_unop(node) {
        this.expectChildren(node, 1, 1);
        var expr = {
            $loc: this.parseSourceLocation(node),
            op: node.type,
            dtype: null,
            left: node.children[0].obj,
        };
        this.deferDataType(node, expr);
        return expr;
    }
    visit_extend(node) {
        var unop = this.__visit_unop(node);
        unop.width = parseInt(node.attrs['width']);
        unop.widthminv = parseInt(node.attrs['widthminv']);
        if (unop.width != 32)
            throw new CompileError(this.cur_loc, `extends width ${unop.width} != 32`);
        return unop;
    }
    visit_extends(node) {
        return this.visit_extend(node);
    }
    __visit_binop(node) {
        this.expectChildren(node, 2, 2);
        var expr = {
            $loc: this.parseSourceLocation(node),
            op: node.type,
            dtype: null,
            left: node.children[0].obj,
            right: node.children[1].obj,
        };
        this.deferDataType(node, expr);
        return expr;
    }
    visit_if(node) {
        this.expectChildren(node, 2, 3);
        var expr = {
            $loc: this.parseSourceLocation(node),
            op: 'if',
            dtype: null,
            cond: node.children[0].obj,
            left: node.children[1].obj,
            right: node.children[2] && node.children[2].obj,
        };
        return expr;
    }
    // while and for loops
    visit_while(node) {
        this.expectChildren(node, 2, 4);
        var expr = {
            $loc: this.parseSourceLocation(node),
            op: 'while',
            dtype: null,
            precond: node.children[0].obj,
            loopcond: node.children[1].obj,
            body: node.children[2] && node.children[2].obj,
            inc: node.children[3] && node.children[3].obj,
        };
        return expr;
    }
    __visit_triop(node) {
        this.expectChildren(node, 3, 3);
        var expr = {
            $loc: this.parseSourceLocation(node),
            op: node.type,
            dtype: null,
            cond: node.children[0].obj,
            left: node.children[1].obj,
            right: node.children[2].obj,
        };
        this.deferDataType(node, expr);
        return expr;
    }
    __visit_func(node) {
        var expr = {
            $loc: this.parseSourceLocation(node),
            dtype: null,
            funcname: node.attrs['func'] || ('$' + node.type),
            args: node.children.map(n => n.obj)
        };
        this.deferDataType(node, expr);
        return expr;
    }
    visit_not(node) { return this.__visit_unop(node); }
    visit_negate(node) { return this.__visit_unop(node); }
    visit_redand(node) { return this.__visit_unop(node); }
    visit_redor(node) { return this.__visit_unop(node); }
    visit_redxor(node) { return this.__visit_unop(node); }
    visit_initial(node) { return this.__visit_unop(node); }
    visit_ccast(node) { return this.__visit_unop(node); }
    visit_creset(node) { return this.__visit_unop(node); }
    visit_creturn(node) { return this.__visit_unop(node); }
    visit_contassign(node) { return this.__visit_binop(node); }
    visit_assigndly(node) { return this.__visit_binop(node); }
    visit_assignpre(node) { return this.__visit_binop(node); }
    visit_assignpost(node) { return this.__visit_binop(node); }
    visit_assign(node) { return this.__visit_binop(node); }
    visit_arraysel(node) { return this.__visit_binop(node); }
    visit_wordsel(node) { return this.__visit_binop(node); }
    visit_eq(node) { return this.__visit_binop(node); }
    visit_neq(node) { return this.__visit_binop(node); }
    visit_lte(node) { return this.__visit_binop(node); }
    visit_gte(node) { return this.__visit_binop(node); }
    visit_lt(node) { return this.__visit_binop(node); }
    visit_gt(node) { return this.__visit_binop(node); }
    visit_and(node) { return this.__visit_binop(node); }
    visit_or(node) { return this.__visit_binop(node); }
    visit_xor(node) { return this.__visit_binop(node); }
    visit_add(node) { return this.__visit_binop(node); }
    visit_sub(node) { return this.__visit_binop(node); }
    visit_concat(node) { return this.__visit_binop(node); } // TODO?
    visit_shiftl(node) { return this.__visit_binop(node); }
    visit_shiftr(node) { return this.__visit_binop(node); }
    visit_shiftrs(node) { return this.__visit_binop(node); }
    visit_mul(node) { return this.__visit_binop(node); }
    visit_div(node) { return this.__visit_binop(node); }
    visit_moddiv(node) { return this.__visit_binop(node); }
    visit_muls(node) { return this.__visit_binop(node); }
    visit_divs(node) { return this.__visit_binop(node); }
    visit_moddivs(node) { return this.__visit_binop(node); }
    visit_gts(node) { return this.__visit_binop(node); }
    visit_lts(node) { return this.__visit_binop(node); }
    visit_gtes(node) { return this.__visit_binop(node); }
    visit_ltes(node) { return this.__visit_binop(node); }
    // TODO: more?
    visit_range(node) { return this.__visit_binop(node); }
    visit_cond(node) { return this.__visit_triop(node); }
    visit_condbound(node) { return this.__visit_triop(node); }
    visit_sel(node) { return this.__visit_triop(node); }
    visit_changedet(node) {
        if (node.children.length == 0)
            return null; //{ op: "changedet", dtype:null, left:null, right:null }
        else
            return this.__visit_binop(node);
    }
    visit_ccall(node) { return this.__visit_func(node); }
    visit_finish(node) { return this.__visit_func(node); }
    visit_stop(node) { return this.__visit_func(node); }
    visit_rand(node) { return this.__visit_func(node); }
    visit_time(node) { return this.__visit_func(node); }
    visit_display(node) { return null; }
    visit_sformatf(node) { return null; }
    visit_scopename(node) { return null; }
    visit_readmem(node) { return this.__visit_func(node); }
    //
    xml_open(node) {
        this.cur_node = node;
        var method = this[`open_${node.type}`];
        if (method) {
            return method.bind(this)(node);
        }
    }
    xml_close(node) {
        this.cur_node = node;
        var method = this[`visit_${node.type}`];
        if (method) {
            return method.bind(this)(node);
        }
        else {
            throw new CompileError(this.cur_loc, `no visitor for ${node.type}`);
        }
    }
    parse(xmls) {
        (0, util_1.parseXMLPoorly)(xmls, this.xml_open.bind(this), this.xml_close.bind(this));
        this.cur_node = null;
        this.run_deferred();
    }
}
exports.VerilogXMLParser = VerilogXMLParser;
//# sourceMappingURL=vxmlparser.js.map