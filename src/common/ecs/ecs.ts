
import { Token } from "../tokenizer";
import { SourceLocated, SourceLocation } from "../workertypes";
import { Bin, Packer } from "./binpack";

export class ECSError extends Error implements SourceLocated {
    $loc: SourceLocation;
    $sources: SourceLocated[] = [];

    constructor(msg: string, obj?: SourceLocation | SourceLocated) {
        super(msg);
        Object.setPrototypeOf(this, ECSError.prototype);
        if (obj) this.$loc = (obj as SourceLocated).$loc || (obj as SourceLocation);
    }
}

function mksymbol(c: ComponentType, fieldName: string) {
    return c.name + '_' + fieldName;
}
function mkscopesymbol(s: EntityScope, c: ComponentType, fieldName: string) {
    return s.name + '_' + c.name + '_' + fieldName;
}

export interface Entity extends SourceLocated {
    id: number;
    name?: string;
    etype: EntityArchetype;
    consts: { [component_field: string]: DataValue };
    // TODO: need scope scoping?
    inits: { [scope_component_field: string]: DataValue };
}

export interface EntityConst {
    component: ComponentType;
    name: string;
    value: DataValue;
}

export interface EntityArchetype {
    components: ComponentType[];
}

export interface ComponentType extends SourceLocated {
    name: string;
    fields: DataField[];
    optional?: boolean;
}

export interface Query extends SourceLocated {
    include: ComponentType[];
    exclude?: ComponentType[];
    entities?: Entity[];
    limit?: number;
}

export class SystemStats {
    tempstartseq: number | undefined;
    tempendseq: number | undefined;
}

export interface System extends SourceLocated {
    name: string;
    actions: Action[];
    tempbytes?: number;
}

export interface SystemInstanceParameters {
    query?: Query;
    refEntity?: Entity;
    refField?: ComponentFieldPair;
}

export interface SystemInstance extends SourceLocated {
    system: System;
    params: SystemInstanceParameters;
    id: number;
}

export const SELECT_TYPE = ['once', 'foreach', 'join', 'with', 'if', 'select', 'unroll'] as const;

export type SelectType = typeof SELECT_TYPE[number];

// TODO?
export interface ActionContext {
    system: System
    scope: EntityScope | null
}

export class ActionNode implements SourceLocated {
    constructor(
        public readonly owner: ActionContext,
        public readonly $loc: SourceLocation
    ) { }

    children?: ActionNode[];
}

export class CodeLiteralNode extends ActionNode {
    constructor(
        owner: ActionContext,
        $loc: SourceLocation,
        public readonly text: string
    ) {
        super(owner, $loc);
    }
}

export class CodePlaceholderNode extends ActionNode {
    constructor(
        owner: ActionContext,
        $loc: SourceLocation,
        public readonly args: string[]
    ) {
        super(owner, $loc);
    }
}

export interface Action extends SourceLocated {
    event: string;
    expr: Statement;
    critical?: boolean;
    fitbytes?: number;
}

export type DataValue = number | boolean | Uint8Array | Uint16Array | Uint32Array;

export type DataField = { name: string; $loc: SourceLocation } & DataType;

export type DataType = IntType | ArrayType | RefType;

export interface IntType {
    dtype: 'int'
    lo: number
    hi: number
    defvalue?: number
    enums?: { [name: string] : number }
}

export interface ArrayType {
    dtype: 'array'
    elem: DataType
    index?: DataType
    baseoffset?: number
}

export interface RefType {
    dtype: 'ref'
    query: Query
}

interface FieldArray {
    component: ComponentType;
    field: DataField;
    elo: number;
    ehi: number;
    access?: FieldAccess[];
}

interface FieldAccess {
    symbol: string;
    bit: number;
    width: number;
}

interface ConstByte {
    symbol: string;
    bitofs: number;
}

export interface ComponentFieldPair {
    c: ComponentType;
    f: DataField;
}

// Expressions

export interface ForwardRef extends SourceLocated {
    reftype: RefType | undefined
    token: Token
}

export type LExpr = IndOp | EntityFieldOp;
export type Statement = InlineCode | BlockExpr | QueryExpr;
export type Expr = BinOp | UnOp | Literal | ForwardRef | LExpr | Statement;
export type Opcode = string;

export interface ExprBase extends SourceLocated {
    valtype: DataType;
}

export interface Literal extends ExprBase {
    value: DataValue;
}

export interface LiteralInt extends Literal {
    value: number;
    valtype: IntType;
}

export interface BinOp extends ExprBase {
    op: Opcode;
    left: Expr;
    right: Expr;
}

export interface UnOp extends ExprBase {
    op: 'neg' | 'lnot' | 'bnot';
    expr: Expr;
}

export interface IndOp extends ExprBase {
    name: string;
    args: Expr[];
}

export interface CondOp extends ExprBase {
    cond: Expr;
    iftrue?: Expr;
    iffalse?: Expr;
}

export interface BranchOp extends ExprBase {
    branch: BlockExpr;
}

export interface EntityFieldOp extends ExprBase {
    entities: Entity[];
    field: DataField;
}

export interface EntityContextOp extends ExprBase {
    entities: Entity[];
}

export interface InlineCode extends ExprBase {
    code: string;
}

export interface BlockExpr extends ExprBase {
    loop?: boolean;
    stmts: Expr[];
}

export interface QueryExpr extends BlockExpr {
    select: SelectType
    query: Query
    direction?: 'asc' | 'desc'
    join?: Query
    all?: boolean
}


export function isLiteral(arg: Expr): arg is Literal {
    return (arg as any).value != null;
}
export function isLiteralInt(arg: Expr): arg is LiteralInt {
    return isLiteral(arg) && arg.valtype.dtype == 'int';
}
export function isLookup(arg: Expr): arg is IndOp {
    return (arg as any).name != null;
}
export function isBinOp(arg: Expr): arg is BinOp {
    return (arg as any).op != null && (arg as any).left != null && (arg as any).right != null;
}
export function isUnOp(arg: Expr): arg is UnOp {
    return (arg as any).op != null && (arg as any).expr != null;
}
export function isBlockStmt(arg: Expr): arg is BlockExpr {
    return (arg as any).stmts != null;
}
export function isInlineCode(arg: Expr): arg is InlineCode {
    return (arg as any).code != null;
}
export function isQueryExpr(arg: Expr): arg is QueryExpr {
    return (arg as any).query != null;
}


/// DIALECT

export class Dialect_CA65 {

    ASM_ITERATE_EACH_ASC = `
    ldx #0
@__each:
    {{%code}}
    inx
    cpx #{{%ecount}}
    jne @__each
@__exit:
`;

    ASM_ITERATE_EACH_DESC = `
    ldx #{{%ecount}}-1
@__each:
    {{%code}}
    dex
    jpl @__each
@__exit:
`;

    ASM_ITERATE_JOIN_ASC = `
    ldy #0
@__each:
    ldx {{%joinfield}},y
    {{%code}}
    iny
    cpy #{{%ecount}}
    jne @__each
@__exit:
`;

    ASM_ITERATE_JOIN_DESC = `
    ldy #{{%ecount}}-1
@__each:
    ldx {{%joinfield}},y
    {{%code}}
    dey
    jpl @__each
@__exit:
`;

    ASM_FILTER_RANGE_LO_X = `
    cpx #{{%xofs}}
    jcc @__skipxlo
    {{%code}}
@__skipxlo:
`

    ASM_FILTER_RANGE_HI_X = `
    cpx #{{%xofs}}+{{%ecount}}
    jcs @__skipxhi
    {{%code}}
@__skipxhi:
`

    ASM_LOOKUP_REF_X = `
    ldx {{%reffield}}
    {{%code}}
`

    INIT_FROM_ARRAY = `
    ldy #{{%nbytes}}
:   lda {{%src}}-1,y
    sta {{%dest}}-1,y
    dey
    bne :-
`

    comment(s: string) {
        return `\n;;; ${s}\n`;
    }
    absolute(ident: string, offset?: number) {
        return this.addOffset(ident, offset || 0);
    }
    addOffset(ident: string, offset: number) {
        if (offset > 0) return `${ident}+${offset}`;
        if (offset < 0) return `${ident}-${-offset}`;
        return ident;
    }
    indexed_x(ident: string, offset: number) {
        return this.addOffset(ident, offset) + ',x';
    }
    indexed_y(ident: string, offset: number) {
        return this.addOffset(ident, offset) + ',y';
    }
    fieldsymbol(component: ComponentType, field: DataField, bitofs: number) {
        return `${component.name}_${field.name}_b${bitofs}`;
    }
    datasymbol(component: ComponentType, field: DataField, eid: number, bitofs: number) {
        return `${component.name}_${field.name}_e${eid}_b${bitofs}`;
    }
    debug_file(path: string) {
        return `.dbg file, "${path}", 0, 0`
    }
    debug_line(path: string, line: number) {
        return `.dbg line, "${path}", ${line}`
    }
    startScope(name: string) {
        return `.scope ${name}`
    }
    endScope(name: string) {
        return `.endscope\n${this.scopeSymbol(name)} = ${name}::__Start`
    }
    scopeSymbol(name: string) {
        return `${name}__Start`;
    }
    align(value: number) {
        return `.align ${value}`;
    }
    alignSegmentStart() {
        return this.label('__ALIGNORIGIN');
    }
    warningIfPageCrossed(startlabel: string) {
        return `
.assert >(${startlabel}) = >(*), error, "${startlabel} crosses a page boundary!"`
    }
    warningIfMoreThan(bytes: number, startlabel: string) {
        return `
.assert (* - ${startlabel}) <= ${bytes}, error, .sprintf("${startlabel} does not fit in ${bytes} bytes, it took %d!", (* - ${startlabel}))`
    }
    alignIfLessThan(bytes: number) {
        return `
.if <(* - __ALIGNORIGIN) > 256-${bytes}
.align $100
.endif`
    }
    segment(segtype: 'rodata' | 'bss' | 'code') {
        if (segtype == 'bss') {
            return `.zeropage`;
        } else if (segtype == 'rodata') {
            return '.rodata';
        } else {
            return `.code`;
        }
    }
    label(sym: string) {
        return `${sym}:`;
    }
    byte(b: number | ConstByte | undefined) {
        if (b === undefined) {
            return `.res 1`
        } else if (typeof b === 'number') {
            if (b < 0 || b > 255) throw new ECSError(`out of range byte ${b}`);
            return `.byte ${b}`
        } else {
            if (b.bitofs == 0) return `.byte <${b.symbol}`
            else if (b.bitofs == 8) return `.byte >${b.symbol}`
            else return `.byte ((${b.symbol} >> ${b.bitofs})&255)`
        }
    }
    tempLabel(inst: SystemInstance) {
        return `${inst.system.name}__${inst.id}__tmp`;
    }
    equate(symbol: string, value: string): string {
        return `${symbol} = ${value}`;
    }
    define(symbol: string, value?: string): string {
        if (value) return `.define ${symbol} ${value}`;
        else return `.define ${symbol}`;
    }
    call(symbol: string) {
        return ` jsr ${symbol}`;
    }
    jump(symbol: string) {
        return ` jmp ${symbol}`;
    }
    return() {
        return ' rts';
    }
}

// TODO: merge with Dialect?
export class SourceFileExport {
    lines: string[] = [];

    line(s: string) {
        this.text(s);
    }
    text(s: string) {
        for (let l of s.split('\n'))
            this.lines.push(l);
    }
    toString() {
        return this.lines.join('\n');
    }
}

class CodeSegment {
    codefrags: string[] = [];

    addCodeFragment(code: string) {
        this.codefrags.push(code);
    }
    dump(file: SourceFileExport) {
        for (let code of this.codefrags) {
            file.text(code);
        }
    }
}

class DataSegment {
    symbols: { [sym: string]: number } = {};
    equates: { [sym: string]: string } = {};
    ofs2sym = new Map<number, string[]>();
    fieldranges: { [cfname: string]: FieldArray } = {};
    size: number = 0;
    initdata: (number | ConstByte | undefined)[] = [];

    allocateBytes(name: string, bytes: number) {
        let ofs = this.symbols[name];
        if (ofs == null) {
            ofs = this.size;
            this.declareSymbol(name, ofs);
            this.size += bytes;
        }
        return ofs;
    }
    declareSymbol(name: string, ofs: number) {
        this.symbols[name] = ofs;
        if (!this.ofs2sym.has(ofs))
            this.ofs2sym.set(ofs, []);
        this.ofs2sym.get(ofs)?.push(name);
    }
    // TODO: ordering should not matter, but it does
    findExistingInitData(bytes: Uint8Array) {
        for (let i=0; i<this.size - bytes.length; i++) {
            for (var j=0; j<bytes.length; j++) {
                if (this.initdata[i+j] !== bytes[j]) break;
            }
            if (j == bytes.length) return i;
        }
        return -1;
    }
    allocateInitData(name: string, bytes: Uint8Array) {
        let ofs = this.findExistingInitData(bytes);
        if (ofs >= 0) {
            this.declareSymbol(name, ofs);
        } else {
            ofs = this.allocateBytes(name, bytes.length);
            for (let i = 0; i < bytes.length; i++) {
                this.initdata[ofs + i] = bytes[i];
            }
        }
    }
    dump(file: SourceFileExport, dialect: Dialect_CA65) {
        // TODO: fewer lines
        for (let i = 0; i < this.size; i++) {
            let syms = this.ofs2sym.get(i);
            if (syms) {
                for (let sym of syms)
                    file.line(dialect.label(sym));
            }
            file.line(dialect.byte(this.initdata[i]));
        }
        for (let [symbol,value] of Object.entries(this.equates)) {
            file.line(dialect.equate(symbol, value));
        }
    }
    // TODO: move cfname functions in here too
    getFieldRange(component: ComponentType, fieldName: string) {
        return this.fieldranges[mksymbol(component, fieldName)];
    }
    getByteOffset(range: FieldArray, access: FieldAccess, entityID: number) {
        if (entityID < range.elo) throw new ECSError(`entity ID ${entityID} too low for ${access.symbol}`);
        if (entityID > range.ehi) throw new ECSError(`entity ID ${entityID} too high for ${access.symbol}`);
        let ofs = this.symbols[access.symbol];
        if (ofs !== undefined) {
            return ofs + entityID - range.elo;
        }
        throw new ECSError(`cannot find field access for ${access.symbol}`);
    }
    getOriginSymbol() {
        let a = this.ofs2sym.get(0);
        if (!a) throw new ECSError('getOriginSymbol(): no symbol at offset 0'); // TODO
        return a[0];
    }
}

class UninitDataSegment extends DataSegment {
}

class ConstDataSegment extends DataSegment {
}

// TODO: none of this makes sense
function getFieldBits(f: IntType) {
    //let n = Math.abs(f.lo) + f.hi + 1;
    let n = f.hi - f.lo + 1;
    return Math.ceil(Math.log2(n));
}

function getFieldLength(f: DataType) {
    if (f.dtype == 'int') {
        return f.hi - f.lo + 1;
    } else {
        return 1; //TODO?
    }
}

function getPackedFieldSize(f: DataType, constValue?: DataValue): number {
    if (f.dtype == 'int') {
        return getFieldBits(f);
    } if (f.dtype == 'array' && f.index) {
        return 0; // TODO? getFieldLength(f.index) * getPackedFieldSize(f.elem);
    } if (f.dtype == 'array' && constValue != null && Array.isArray(constValue)) {
        return constValue.length * getPackedFieldSize(f.elem);
    } if (f.dtype == 'ref') {
        return 8; // TODO: > 256 entities?
    }
    return 0;
}

class EntitySet {
    atypes: EntityArchetype[];
    entities: Entity[];
    scope;

    constructor(scope: EntityScope, query?: Query, e?: Entity[]) {
        this.scope = scope;
        if (query) {
            if (query.entities) {
                this.entities = query.entities.slice(0);
            } else {
                this.atypes = scope.em.archetypesMatching(query);
                this.entities = scope.entitiesMatching(this.atypes);
            }
            // TODO: desc?
            if (query.limit) {
                this.entities = this.entities.slice(0, query.limit);
            }
        } else if (e) {
            this.entities = e;
        } else {
            throw new ECSError('invalid EntitySet constructor')
        }
        if (!this.atypes) {
            let at = new Set<EntityArchetype>();
            for (let e of this.entities) at.add(e.etype);
            this.atypes = Array.from(at.values());
        }
    }
    contains(c: ComponentType, f: DataField, where: SourceLocated) {
        // TODO: action for error msg
        return this.scope.em.singleComponentWithFieldName(this.atypes, f.name, where);
    }
    intersection(qr: EntitySet) {
        let ents = this.entities.filter(e => qr.entities.includes(e));
        return new EntitySet(this.scope, undefined, ents);
    }
    union(qr: EntitySet) {
        // TODO: remove dups
        let ents = this.entities.concat(qr.entities);
        let atypes = this.atypes.concat(qr.atypes);
        return new EntitySet(this.scope, undefined, ents);
    }
    isContiguous() {
        if (this.entities.length == 0) return true;
        let id = this.entities[0].id;
        for (let i = 1; i < this.entities.length; i++) {
            if (this.entities[i].id != ++id) return false;
        }
        return true;
    }
}

class IndexRegister {
    lo: number | null;
    hi: number | null;
    elo: number;
    ehi: number;
    eset: EntitySet | undefined;

    constructor(
        public readonly scope: EntityScope,
        eset?: EntitySet
    ) {
        this.elo = 0;
        this.ehi = scope.entities.length - 1;
        this.lo = null;
        this.hi = null;
        if (eset) { this.narrowInPlace(eset); }
    }
    entityCount() {
        return this.ehi - this.elo + 1;
    }
    clone() {
        return Object.assign(new IndexRegister(this.scope), this);
    }
    narrow(eset: EntitySet, action?: SourceLocated) {
        let i = this.clone();
        return i.narrowInPlace(eset, action) ? i : null;
    }
    narrowInPlace(eset: EntitySet, action?: SourceLocated): boolean {
        if (this.scope != eset.scope) throw new ECSError(`scope mismatch`, action);
        if (!eset.isContiguous()) throw new ECSError(`entities are not contiguous`, action);
        if (this.eset) {
            this.eset = this.eset.intersection(eset);
        } else {
            this.eset = eset;
        }
        if (this.eset.entities.length == 0) {
            return false;
        }
        let newelo = this.eset.entities[0].id;
        let newehi = this.eset.entities[this.eset.entities.length - 1].id;
        if (this.lo === null || this.hi === null) {
            this.lo = 0;
            this.hi = newehi - newelo;
            this.elo = newelo;
            this.ehi = newehi;
        } else {
            //if (action) console.log((action as any).event, this.elo, '-', this.ehi, '->', newelo, '..', newehi);
            this.lo += newelo - this.elo;
            this.hi += newehi - this.ehi;
        }
        return true;
    }
    // TODO: removegi
    offset() {
        return this.lo || 0;
    }
}

// todo: generalize
class ActionCPUState {
    working: EntitySet;
    props: {[key: string] : string};
    xreg: IndexRegister | null = null;
    yreg: IndexRegister | null = null;
}

class ActionEval {
    em : EntityManager;
    dialect : Dialect_CA65;
    tmplabel = '';
    label : string;
    seq : number;
    //used = new Set<string>(); // TODO

    constructor(
        readonly scope: EntityScope,
        readonly instance: SystemInstance,
        readonly action: Action,
        readonly eventargs: string[])
    {
        this.em = scope.em;
        this.dialect = scope.em.dialect;
        this.tmplabel = this.dialect.tempLabel(this.instance);
        //let query = (this.action as ActionWithQuery).query;
        //TODO? if (query && this.entities.length == 0)
            //throw new ECSError(`query doesn't match any entities`, query); // TODO 
        this.seq = this.em.seq++;
        this.label = `${this.instance.system.name}__${action.event}__${this.seq}`;
    }
    begin() {
    }
    end() {
    }
    codeToString(): string {
        let code = this.exprToCode(this.action.expr);
        return code;
    }
    private replaceTags(code: string, action: Action, props: { [name: string]: string; }) {
        const tag_re = /\{\{(.+?)\}\}/g;
        code = code.replace(tag_re, (entire, group: string) => {
            let toks = group.split(/\s+/);
            if (toks.length == 0)
                throw new ECSError(`empty command`, action);
            let cmd = group.charAt(0);
            let arg0 = toks[0].substring(1).trim();
            let args = [arg0].concat(toks.slice(1));
            switch (cmd) {
                case '!': return this.__emit(args);
                case '$': return this.__local(args);
                case '^': return this.__use(args);
                case '#': return this.__arg(args);
                case '&': return this.__eid(args);
                case '<': return this.__get([arg0, '0']);
                case '>': return this.__get([arg0, '8']);
                default:
                    let value = props[toks[0]];
                    if (value)
                        return value;
                    let fn = (this as any)['__' + toks[0]];
                    if (fn)
                        return fn.bind(this)(toks.slice(1));
                    throw new ECSError(`unrecognized command {{${toks[0]}}}`, action);
            }
        });
        return code;
    }
    private replaceLabels(code: string) {
        const label_re = /@(\w+)\b/g;
        let seq = this.em.seq++;
        let label = `${this.instance.system.name}__${this.action.event}__${seq}`;
        code = code.replace(label_re, (s: string, a: string) => `${label}__${a}`);
        return code;
    }

    __get(args: string[]) {
        return this.getset(args, false);
    }
    __set(args: string[]) {
        return this.getset(args, true);
    }
    getset(args: string[], canwrite: boolean) {
        let fieldName = args[0];
        let bitofs = parseInt(args[1] || '0');
        return this.generateCodeForField(fieldName, bitofs, canwrite);
    }
    parseFieldArgs(args: string[]) {
        let fieldName = args[0];
        let bitofs = parseInt(args[1] || '0');
        let component = this.em.singleComponentWithFieldName(this.scope.state.working.atypes, fieldName, this.action);
        let field = component.fields.find(f => f.name == fieldName);
        if (field == null) throw new ECSError(`no field named "${fieldName}" in component`, this.action);
        return { component, field, bitofs };
    }
    __base(args: string[]) {
        let { component, field, bitofs } = this.parseFieldArgs(args);
        return this.dialect.fieldsymbol(component, field, bitofs);
    }
    __data(args: string[]) {
        let { component, field, bitofs } = this.parseFieldArgs(args);
        let entities = this.scope.state.working.entities;
        if (entities.length != 1) throw new ECSError(`data operates on exactly one entity`, this.action); // TODO?
        let eid = entities[0].id; // TODO?
        return this.dialect.datasymbol(component, field, eid, bitofs);
    }
    __const(args: string[]) {
        let { component, field, bitofs } = this.parseFieldArgs(args);
        let entities = this.scope.state.working.entities;
        if (entities.length != 1) throw new ECSError(`const operates on exactly one entity`, this.action); // TODO?
        let constVal = entities[0].consts[mksymbol(component, field.name)];
        if (constVal === undefined)  throw new ECSError(`field is not constant`, this.action); // TODO?
        if (typeof constVal !== 'number')  throw new ECSError(`field is not numeric`, this.action); // TODO?
        return constVal << bitofs;
    }
    __index(args: string[]) {
        // TODO: check select type and if we actually have an index...
        let ident = args[0];
        let index = parseInt(args[1] || '0');
        let entities = this.scope.state.working.entities;
        if (entities.length == 1) {
            return this.dialect.absolute(ident);
        } else {
            return this.dialect.indexed_x(ident, index); //TODO?
        }
    }
    __eid(args: string[]) {
        let e = this.scope.getEntityByName(args[0] || '?');
        if (!e) throw new ECSError(`can't find entity named "${args[0]}"`, this.action);
        return e.id.toString();
    }
    __use(args: string[]) {
        return this.scope.includeResource(args[0]);
    }
    __emit(args: string[]) {
        let event = args[0];
        let eventargs = args.slice(1);
        try {
            return this.scope.generateCodeForEvent(event, eventargs);
        } catch (e) {
            if (e.$sources) e.$sources.push(this.action);
            throw e;
        }
    }
    __local(args: string[]) {
        let tempinc = parseInt(args[0]);
        let tempbytes = this.instance.system.tempbytes;
        if (isNaN(tempinc)) throw new ECSError(`bad temporary offset`, this.action);
        if (!tempbytes) throw new ECSError(`this system has no locals`, this.action);
        if (tempinc < 0 || tempinc >= tempbytes) throw new ECSError(`this system only has ${tempbytes} locals`, this.action);
        this.scope.updateTempLiveness(this.instance);
        return `${this.tmplabel}+${tempinc}`;
    }
    __arg(args: string[]) {
        let argindex = parseInt(args[0] || '0');
        let argvalue = this.eventargs[argindex] || '';
        //this.used.add(`arg_${argindex}_${argvalue}`);
        return argvalue;
    }
    __start(args: string[]) {
        let startSymbol = this.dialect.scopeSymbol(args[0]);
        return this.dialect.jump(startSymbol);
    }
    generateCodeForField(fieldName: string, bitofs: number, canWrite: boolean): string {
        const action = this.action;
        const qr = this.scope.state.working;

        var component: ComponentType;
        var baseLookup = false;
        var entityLookup = false;
        let entities: Entity[];
        // is qualified field?
        if (fieldName.indexOf('.') > 0) {
            let [entname, fname] = fieldName.split('.');
            let ent = this.scope.getEntityByName(entname);
            if (ent == null) throw new ECSError(`no entity named "${entname}" in this scope`, action);
            component = this.em.singleComponentWithFieldName([ent.etype], fname, action);
            fieldName = fname;
            entities = [ent];
            entityLookup = true;
        } else if (fieldName.indexOf(':') > 0) {
            let [cname, fname] = fieldName.split(':');
            component = this.em.getComponentByName(cname);
            if (component == null) throw new ECSError(`no component named "${cname}"`, action)
            entities = this.scope.state.working.entities;
            fieldName = fname;
            baseLookup = true;
        } else {
            component = this.em.singleComponentWithFieldName(qr.atypes, fieldName, action);
            entities = this.scope.state.working.entities;
        }
        // find archetypes
        let field = component.fields.find(f => f.name == fieldName);
        if (field == null) throw new ECSError(`no field named "${fieldName}" in component`, action);
        let ident = this.dialect.fieldsymbol(component, field, bitofs);
        // see if all entities have the same constant value
        // TODO: should be done somewhere else?
        let constValues = new Set<DataValue>();
        let isConst = false;
        for (let e of entities) {
            let constVal = e.consts[mksymbol(component, fieldName)];
            if (constVal !== undefined) isConst = true;
            constValues.add(constVal); // constVal === undefined is allowed
        }
        // can't write to constant
        if (isConst && canWrite)
            throw new ECSError(`can't write to constant field ${fieldName}`, action);
        // is it a constant?
        if (constValues.size == 1) {
            let value = constValues.values().next().value as DataValue;
            // TODO: what about symbols?
            // TODO: use dialect
            if (typeof value === 'number') {
                return `#${(value >> bitofs) & 0xff}`;
            }
        }
        // TODO: offset > 0?
        // TODO: don't mix const and init data
        let range = this.scope.getFieldRange(component, field.name);
        if (!range) throw new ECSError(`couldn't find field for ${component.name}:${fieldName}, maybe no entities?`); // TODO
        // TODO: dialect
        // TODO: doesnt work for entity.field
        // TODO: array field baseoffset?
        if (baseLookup) {
            return this.dialect.absolute(ident);
        } else if (entities.length == 1) {
            // TODO: qr or this.entites?
            let eidofs = entities[0].id - range.elo; // TODO: negative?
            return this.dialect.absolute(ident, eidofs);
        } else {
            let ir;
            let int;
            let eidofs;
            let xreg = this.scope.state.xreg;
            let yreg = this.scope.state.yreg;
            if (xreg && (int = xreg.eset?.intersection(qr))) {
                //console.log(eidofs,'x',qr.entities[0].id,xreg.elo,int.entities[0].id,xreg.offset(),range.elo);
                ir = xreg.eset;
                //eidofs -= xreg.offset();
                //eidofs -= int.entities[0].id - xreg.elo;
                eidofs = xreg.elo - range.elo;
                // TODO? if (xreg.ehi > range.ehi) throw new ECSError(`field "${field.name}" could overflow`, action);
            } else if (yreg && (int = yreg.eset?.intersection(qr))) {
                ir = yreg.eset;
                //eidofs -= yreg.offset();
                eidofs = yreg.elo - range.elo;
            } else {
                ir = null;
                eidofs = 0;
            }
            if (!ir) {
                throw new ECSError(`no intersection for index register`, action);
            }
            if (ir.entities.length == 0) throw new ECSError(`no common entities for index register`, action);
            if (!ir.isContiguous()) throw new ECSError(`entities in query are not contiguous`, action);
            if (ir == this.scope.state.xreg?.eset)
                return this.dialect.indexed_x(ident, eidofs);
            if (ir == this.scope.state.yreg?.eset)
                return this.dialect.indexed_y(ident, eidofs);
            throw new ECSError(`cannot find "${component.name}:${field.name}" in state`, action);
        }
    }
    getJoinField(action: Action, atypes: EntityArchetype[], jtypes: EntityArchetype[]): ComponentFieldPair {
        let refs = Array.from(this.scope.iterateArchetypeFields(atypes, (c, f) => f.dtype == 'ref'));
        // TODO: better error message
        if (refs.length == 0) throw new ECSError(`cannot find join fields`, action);
        if (refs.length > 1) throw new ECSError(`cannot join multiple fields (${refs.map(r => r.f.name).join(' ')})`, action);
        // TODO: check to make sure join works
        return refs[0]; // TODO
        /* TODO
        let match = refs.map(ref => this.em.archetypesMatching((ref.f as RefType).query));
        for (let ref of refs) {
            let m = this.em.archetypesMatching((ref.f as RefType).query);
            for (let a of m) {
                if (jtypes.includes(a.etype)) {
                    console.log(a,m);
                }
            }
        }
        */
    }
    isSubroutineSized(code: string) {
        // TODO?
        if (code.length > 20000) return false;
        if (code.split('\n ').length >= 4) return true; // TODO: :^/
        return false;
    }
    exprToCode(expr: Expr) : string {
        if (isQueryExpr(expr)) {
            return this.queryExprToCode(expr);
        }
        if (isBlockStmt(expr)) {
            return this.blockStmtToCode(expr);
        }
        if (isInlineCode(expr)) {
            return this.evalInlineCode(expr.code);
        }
        throw new ECSError(`cannot convert expression to code`, expr);
    }
    evalInlineCode(code: string) {
        let props = this.scope.state.props || {};
        // replace @labels
        code = this.replaceLabels(code);
        // replace {{...}} tags
        // TODO: use nodes instead
        code = this.replaceTags(code, this.action, props);
        return code;
    }
    blockStmtToCode(expr: BlockExpr) {
        return expr.stmts.map(node => this.exprToCode(node)).join('\n');
    }
    queryExprToCode(qexpr: QueryExpr) : string {
        //console.log('query', this.action.event, qexpr.select, qexpr.query.include);
        let q = this.startQuery(qexpr);
        // TODO: move elsewhere? is "foreach" and "join" part of the empty set?
        const allowEmpty = ['if','foreach','join'];
        if (q.working.entities.length == 0 && allowEmpty.includes(qexpr.select)) {
            //console.log('empty', this.action.event);
            this.endQuery(q);
            return '';
        } else {
            this.scope.state.working = q.working;
            this.scope.state.props = q.props;
            //console.log('begin', this.action.event, this.scope.state);
            q.code = this.evalInlineCode(q.code);
            let body = this.blockStmtToCode(qexpr);
            this.endQuery(q);
            //console.log('end', this.action.event, this.scope.state);
            body = q.code.replace('%%CODE%%', body);
            return body;
        }
    }
    queryWorkingSet(qexpr: QueryExpr) {
        const scope = this.scope;
        const instance = this.instance;
        let select = qexpr.select;
        let q = qexpr.query;
        let qr = new EntitySet(scope, q);
        // narrow query w/ working set?
        if (!(qexpr.all || q.entities)) {
            let ir = qr.intersection(scope.state.working);
            // if intersection is empty, take the global set
            // if doing otherwise would generate an error (execpt for "if")
            // TODO: ambiguous?
            if (ir.entities.length || select == 'if') {
                qr = ir;
            }
        }
        // TODO? error if none?
        if (instance.params.refEntity && instance.params.refField) {
            let rf = instance.params.refField;
            if (rf.f.dtype == 'ref') {
                let rq = rf.f.query;
                qr = qr.intersection(new EntitySet(scope, rq));
                //console.log('with', instance.params, rq, this.qr);
            }
        } else if (instance.params.query) {
            qr = qr.intersection(new EntitySet(scope, instance.params.query));
        }
        return qr;
    }
    updateIndexRegisters(qr: EntitySet, jr: EntitySet | null, select: SelectType) {
        const action = this.action;
        const scope = this.scope;
        const instance = this.instance;
        const state = this.scope.state;
        // TODO: generalize to other cpus/langs
        if (qr.entities.length > 1) {
            switch (select) {
                case 'once':
                    break;
                case 'foreach':
                case 'unroll':
                    if (state.xreg && state.yreg) throw new ECSError('no more index registers', action);
                    if (state.xreg) state.yreg = new IndexRegister(scope, qr);
                    else state.xreg = new IndexRegister(scope, qr);
                    break;
                case 'join':
                    // TODO: Joins don't work in superman (arrays offset?)
                    // ignore the join query, use the ref
                    if (state.xreg || state.yreg) throw new ECSError('no free index registers for join', action);
                    if (jr) state.xreg = new IndexRegister(scope, jr);
                    state.yreg = new IndexRegister(scope, qr);
                    break;
                case 'if':
                case 'with':
                    // TODO: what if not in X because 1 element?
                    if (state.xreg && state.xreg.eset) {
                        state.xreg = state.xreg.narrow(qr, action);
                    } else if (select == 'with') {
                        if (instance.params.refEntity && instance.params.refField) {
                            if (state.xreg)
                                state.xreg.eset = qr;
                            else
                                state.xreg = new IndexRegister(scope, qr);
                            // ???
                        }
                    }
                    break;
            }
        }
    }
    getCodeAndProps(qexpr: QueryExpr, qr: EntitySet, jr: EntitySet|null, 
        oldState: ActionCPUState)
    {
        // get properties and code
        const entities = qr.entities;
        const select = qexpr.select;
        let code = '%%CODE%%';
        let props: { [name: string]: string } = {};
        // TODO: detect cycles
        // TODO: "source"?
        // TODO: what if only 1 item?
        // TODO: what if join is subset of items?
        if (select == 'join' && jr) {
            //let jentities = this.jr.entities;
            // TODO? 
                // TODO? throw new ECSError(`join query doesn't match any entities`, (action as ActionWithJoin).join); // TODO 
            //console.log('join', qr, jr);
            if (qr.entities.length) {
                let joinfield = this.getJoinField(this.action, qr.atypes, jr.atypes);
                // TODO: what if only 1 item?
                // TODO: should be able to access fields via Y reg
                code = this.wrapCodeInLoop(code, qexpr, qr.entities, joinfield);
                props['%joinfield'] = this.dialect.fieldsymbol(joinfield.c, joinfield.f, 0); //TODO?
            }
        }
        // select subset of entities
        let fullEntityCount = qr.entities.length; //entities.length.toString();
        // TODO: let loopreduce = !loopents || entities.length < loopents.length;
        //console.log(action.event, entities.length, loopents.length);
        // filter entities from loop?
        // TODO: when to ignore if entities.length == 1 and not in for loop?
        if (select == 'with') {
            // TODO? when to load x?
            if (this.instance.params.refEntity && this.instance.params.refField) {
                let re = this.instance.params.refEntity;
                let rf = this.instance.params.refField;
                code = this.wrapCodeInRefLookup(code);
                // TODO: only fetches 1st entity in list, need offset
                let range = this.scope.getFieldRange(rf.c, rf.f.name);
                let eidofs = re.id - range.elo;
                props['%reffield'] = `${this.dialect.fieldsymbol(rf.c, rf.f, 0)}+${eidofs}`;
            } else {
                code = this.wrapCodeInFilter(code, qr, oldState, props);
            }
        }
        if (select == 'if') {
            code = this.wrapCodeInFilter(code, qr, oldState, props);
        }
        if (select == 'foreach' && entities.length > 1) {
            code = this.wrapCodeInLoop(code, qexpr, qr.entities);
        }
        if (select == 'unroll' && entities.length > 1) {
            throw new ECSError('unroll is not yet implemented');
        }
        // define properties
        if (entities.length) {
            props['%elo'] = entities[0].id.toString();
            props['%ehi'] = entities[entities.length - 1].id.toString();
        }
        props['%ecount'] = entities.length.toString();
        props['%efullcount'] = fullEntityCount.toString();
        //console.log('working', action.event, working.entities.length, entities.length);
        return { code, props };
    }
    startQuery(qexpr: QueryExpr) {
        const scope = this.scope;
        const action = this.action;
        const select = qexpr.select;

        // save old state and make clone
        const oldState = this.scope.state;
        this.scope.state = Object.assign(new ActionCPUState(), oldState);

        // get working set for this query
        const qr = this.queryWorkingSet(qexpr);
        
        // is it a join? query that too
        const jr = qexpr.join && qr.entities.length ? new EntitySet(scope, qexpr.join) : null;

        // update x, y state
        this.updateIndexRegisters(qr, jr, select);

        const { code, props } = this.getCodeAndProps(qexpr, qr, jr, oldState);

        // if join, working set is union of both parts
        let working = jr ? qr.union(jr) : qr;
        
        return { working, oldState, props, code };
    }
    endQuery(q : { oldState: ActionCPUState }) {
        this.scope.state = q.oldState;
    }
    wrapCodeInLoop(code: string, qexpr: QueryExpr, ents: Entity[], joinfield?: ComponentFieldPair): string {
        // TODO: check ents
        // TODO: check segment bounds
        // TODO: what if 0 or 1 entitites?
        // TODO: check > 127 or > 255
        let dir = qexpr.direction;
        let s = dir == 'desc' ? this.dialect.ASM_ITERATE_EACH_DESC : this.dialect.ASM_ITERATE_EACH_ASC;
        if (joinfield) s = dir == 'desc' ? this.dialect.ASM_ITERATE_JOIN_DESC : this.dialect.ASM_ITERATE_JOIN_ASC;
        s = s.replace('{{%code}}', code);
        return s;
    }
    wrapCodeInFilter(code: string, qr: EntitySet, oldState: ActionCPUState, props: any) {
        // TODO: :-p filters too often?
        const ents = qr.entities;
        const ents2 = oldState.xreg?.eset?.entities;
        if (ents && ents.length && ents2) {
            let lo = ents[0].id;
            let hi = ents[ents.length - 1].id;
            let lo2 = ents2[0].id;
            let hi2 = ents2[ents2.length - 1].id;
            if (lo != lo2) {
                code = this.dialect.ASM_FILTER_RANGE_LO_X.replace('{{%code}}', code);
                props['%xofs'] = lo - lo2;
            }
            if (hi != hi2) {
                code = this.dialect.ASM_FILTER_RANGE_HI_X.replace('{{%code}}', code);
            }
        }
        return code;
    }
    wrapCodeInRefLookup(code: string) {
        code = this.dialect.ASM_LOOKUP_REF_X.replace('{{%code}}', code);
        return code;
    }
}

class EventCodeStats {
    constructor(
        public readonly inst: SystemInstance,
        public readonly action: Action,
        public readonly eventcode: string
    ) { }
    labels : string[] = [];
    count : number = 0;
}

export class EntityScope implements SourceLocated {
    $loc: SourceLocation;
    childScopes: EntityScope[] = [];
    instances: SystemInstance[] = [];
    entities: Entity[] = [];
    fieldtypes: { [name: string]: 'init' | 'const' } = {};
    sysstats = new Map<SystemInstance, SystemStats>();
    bss = new UninitDataSegment();
    rodata = new ConstDataSegment();
    code = new CodeSegment();
    componentsInScope = new Set();
    resources = new Set<string>();
    state;
    isDemo = false;
    filePath = '';

    eventSeq : number;
    eventCodeStats : { [code:string] : EventCodeStats };
    inCritical = 0;

    constructor(
        public readonly em: EntityManager,
        public readonly dialect: Dialect_CA65,
        public readonly name: string,
        public readonly parent: EntityScope | undefined
    ) {
        parent?.childScopes.push(this);
        this.state = new ActionCPUState();
        // TODO: parent scope entities too?
        this.state.working = new EntitySet(this, undefined, this.entities); // working set = all entities
    }
    newEntity(etype: EntityArchetype, name: string): Entity {
        // TODO: add parent ID? lock parent scope?
        // TODO: name identical check?
        if (name && this.getEntityByName(name))
            throw new ECSError(`already an entity named "${name}"`);
        let id = this.entities.length;
        etype = this.em.addArchetype(etype);
        let entity: Entity = { id, etype, consts: {}, inits: {} };
        for (let c of etype.components) {
            this.componentsInScope.add(c.name);
        }
        entity.name = name;
        this.entities.push(entity);
        return entity;
    }
    newSystemInstance(inst: SystemInstance) {
        if (!inst) throw new Error();
        inst.id = this.instances.length+1;
        this.instances.push(inst);
        this.em.registerSystemEvents(inst.system);
        return inst;
    }
    newSystemInstanceWithDefaults(system: System) {
        return this.newSystemInstance({ system, params: {}, id:0 });
    }
    getSystemInstanceNamed(name: string) {
        return this.instances.find(sys => sys.system.name == name);
    }
    getEntityByName(name: string) {
        return this.entities.find(e => e.name == name);
    }
    *iterateEntityFields(entities: Entity[]) {
        for (let i = 0; i < entities.length; i++) {
            let e = entities[i];
            for (let c of e.etype.components) {
                for (let f of c.fields) {
                    yield { i, e, c, f, v: e.consts[mksymbol(c, f.name)] };
                }
            }
        }
    }
    *iterateArchetypeFields(arch: EntityArchetype[], filter?: (c: ComponentType, f: DataField) => boolean) {
        for (let i = 0; i < arch.length; i++) {
            let a = arch[i];
            for (let c of a.components) {
                for (let f of c.fields) {
                    if (!filter || filter(c, f))
                        yield { i, c, f };
                }
            }
        }
    }
    *iterateChildScopes() {
        for (let scope of this.childScopes) {
            yield scope;
        }
    }
    entitiesMatching(atypes: EntityArchetype[]) {
        let result: Entity[] = [];
        for (let e of this.entities) {
            for (let a of atypes) {
                // TODO: what about subclasses?
                // TODO: very scary identity ocmpare
                if (e.etype === a) {
                    result.push(e);
                    break;
                }
            }
        }
        return result;
    }
    hasComponent(ctype: ComponentType) {
        return this.componentsInScope.has(ctype.name);
    }
    buildSegments() {
        // build FieldArray for each component/field pair
        // they will be different for bss/rodata segments
        let iter = this.iterateEntityFields(this.entities);
        for (var o = iter.next(); o.value; o = iter.next()) {
            let { i, e, c, f, v } = o.value;
            // constants and array pointers go into rodata
            let cfname = mksymbol(c, f.name);
            let ftype = this.fieldtypes[cfname];
            let isConst = ftype == 'const';
            let segment = isConst ? this.rodata : this.bss;
            if (v === undefined && isConst)
                throw new ECSError(`no value for const field ${cfname}`, e);
            // determine range of indices for entities
            let array = segment.fieldranges[cfname];
            if (!array) {
                array = segment.fieldranges[cfname] = { component: c, field: f, elo: i, ehi: i };
            } else {
                array.ehi = i;
                if (array.ehi - array.elo + 1 >= 256)
                    throw new ECSError(`too many entities have field ${cfname}, limit is 256`);
            }
            // set default values for entity/field
            if (!isConst) {
                if (f.dtype == 'int' && f.defvalue !== undefined) {
                    let ecfname = mkscopesymbol(this, c, f.name);
                    if (e.inits[ecfname] == null) {
                        this.setInitValue(e, c, f, f.defvalue);
                    }
                }
            }
        }
    }
    // TODO: cull unused entity fields
    allocateSegment(segment: DataSegment, alloc: boolean, type: 'init' | 'const' | undefined) {
        let fields: FieldArray[] = Object.values(segment.fieldranges);
        // TODO: fields.sort((a, b) => (a.ehi - a.elo + 1) * getPackedFieldSize(a.field));
        for (let f of fields) {
            if (this.fieldtypes[mksymbol(f.component, f.field.name)] == type) {
                //console.log(f.component.name, f.field.name, type);
                let rangelen = (f.ehi - f.elo + 1);
                // TODO: doesn't work for packed arrays too well
                let bits = getPackedFieldSize(f.field);
                // variable size? make it a pointer
                if (bits == 0) bits = 16; // TODO?
                let bytesperelem = Math.ceil(bits / 8);
                // TODO: packing bits
                // TODO: split arrays
                let access = [];
                for (let i = 0; i < bits; i += 8) {
                    let symbol = this.dialect.fieldsymbol(f.component, f.field, i);
                    access.push({ symbol, bit: i, width: 8 }); // TODO
                    if (alloc) {
                        segment.allocateBytes(symbol, rangelen); // TODO
                    }
                }
                f.access = access;
            }
        }
    }
    allocateROData(segment: DataSegment) {
        let iter = this.iterateEntityFields(this.entities);
        for (var o = iter.next(); o.value; o = iter.next()) {
            let { i, e, c, f, v } = o.value;
            let cfname = mksymbol(c, f.name);
            // TODO: what if mix of var, const, and init values?
            if (this.fieldtypes[cfname] == 'const') {
                let range = segment.fieldranges[cfname];
                let entcount = range ? range.ehi - range.elo + 1 : 0;
                if (v == null && f.dtype == 'int') v = 0;
                if (v == null && f.dtype == 'ref') v = 0;
                if (v == null && f.dtype == 'array')
                    throw new ECSError(`no default value for array ${cfname}`, e);
                //console.log(c.name, f.name, '#'+e.id, '=', v);
                // this is a constant
                // is it a byte array?
                //TODO? if (ArrayBuffer.isView(v) && f.dtype == 'array') {
                if (v instanceof Uint8Array && f.dtype == 'array') {
                    let ptrlosym = this.dialect.fieldsymbol(c, f, 0);
                    let ptrhisym = this.dialect.fieldsymbol(c, f, 8);
                    let loofs = segment.allocateBytes(ptrlosym, entcount);
                    let hiofs = segment.allocateBytes(ptrhisym, entcount);
                    let datasym = this.dialect.datasymbol(c, f, e.id, 0);
                    segment.allocateInitData(datasym, v);
                    if (f.baseoffset) datasym = `(${datasym}+${f.baseoffset})`;
                    segment.initdata[loofs + e.id - range.elo] = { symbol: datasym, bitofs: 0 };
                    segment.initdata[hiofs + e.id - range.elo] = { symbol: datasym, bitofs: 8 };
                } else if (typeof v === 'number') {
                    // more than 1 entity, add an array
                    // TODO: infer need for array by usage
                    /*if (entcount > 1)*/ {
                        if (!range.access) throw new ECSError(`no access for field ${cfname}`)
                        for (let a of range.access) {
                            segment.allocateBytes(a.symbol, entcount);
                            let ofs = segment.getByteOffset(range, a, e.id);
                            // TODO: this happens if you forget a const field on an object?
                            if (e.id < range.elo) throw new ECSError('entity out of range ' + c.name + ' ' + f.name, e);
                            if (segment.initdata[ofs] !== undefined) throw new ECSError('initdata already set ' + ofs), e;
                            segment.initdata[ofs] = (v >> a.bit) & 0xff;
                        }
                    }
                } else if (v == null && f.dtype == 'array' && f.index) {
                    // TODO
                    let datasym = this.dialect.datasymbol(c, f, e.id, 0);
                    let databytes = getFieldLength(f.index);
                    let offset = this.bss.allocateBytes(datasym, databytes);
                    // TODO? this.allocatePointerArray(c, f, datasym, entcount);
                    let ptrlosym = this.dialect.fieldsymbol(c, f, 0);
                    let ptrhisym = this.dialect.fieldsymbol(c, f, 8);
                    // TODO: what if we don't need a pointer array?
                    let loofs = segment.allocateBytes(ptrlosym, entcount);
                    let hiofs = segment.allocateBytes(ptrhisym, entcount);
                    if (f.baseoffset) datasym = `(${datasym}+${f.baseoffset})`;
                    segment.initdata[loofs + e.id - range.elo] = { symbol: datasym, bitofs: 0 };
                    segment.initdata[hiofs + e.id - range.elo] = { symbol: datasym, bitofs: 8 };
                } else {
                    // TODO: bad error message - should say "wrong type, should be array"
                    throw new ECSError(`unhandled constant ${e.id}:${cfname} -- ${typeof v}`);
                }
            }
        }
        //console.log(segment.initdata)
    }
    allocateInitData(segment: DataSegment) {
        if (segment.size == 0) return '';
        let initbytes = new Uint8Array(segment.size);
        let iter = this.iterateEntityFields(this.entities);
        for (var o = iter.next(); o.value; o = iter.next()) {
            let { i, e, c, f, v } = o.value;
            let scfname = mkscopesymbol(this, c, f.name);
            let initvalue = e.inits[scfname];
            if (initvalue !== undefined) {
                let range = segment.getFieldRange(c, f.name);
                if (!range) throw new ECSError(`no init range for ${scfname}`, e);  
                if (!range.access) throw new ECSError(`no init range access for ${scfname}`, e);
                if (typeof initvalue === 'number') {
                    for (let a of range.access) {
                        let offset = segment.getByteOffset(range, a, e.id);
                        initbytes[offset] = (initvalue >> a.bit) & ((1 << a.width) - 1);
                    }
                } else if (initvalue instanceof Uint8Array) {
                    // TODO: 16/32...
                    let datasym = this.dialect.datasymbol(c, f, e.id, 0);
                    let ofs = this.bss.symbols[datasym];
                    initbytes.set(initvalue, ofs);
                } else {
                    // TODO: init arrays?
                    throw new ECSError(`cannot initialize ${scfname} = ${initvalue}`); // TODO??
                }
            }
        }
        // build the final init buffer
        // TODO: compress 0s?
        let bufsym = this.name + '__INITDATA';
        let bufofs = this.rodata.allocateInitData(bufsym, initbytes);
        let code = this.dialect.INIT_FROM_ARRAY;
        //TODO: function to repalce from dict?
        code = code.replace('{{%nbytes}}', initbytes.length.toString())
        code = code.replace('{{%src}}', bufsym);
        code = code.replace('{{%dest}}', segment.getOriginSymbol());
        return code;
    }
    getFieldRange(c: ComponentType, fn: string) {
        return this.bss.getFieldRange(c, fn) || this.rodata.getFieldRange(c, fn);
    }
    setConstValue(e: Entity, component: ComponentType, field: DataField, value: DataValue) {
        this.setConstInitValue(e, component, field, value, 'const');
    }
    setInitValue(e: Entity, component: ComponentType, field: DataField, value: DataValue) {
        this.setConstInitValue(e, component, field, value, 'init');
    }
    setConstInitValue(e: Entity, component: ComponentType, field: DataField, value: DataValue,
        type: 'const'|'init')
    {
        this.checkFieldValue(field, value);
        let fieldName = field.name;
        let cfname = mksymbol(component, fieldName);
        let ecfname = mkscopesymbol(this, component, fieldName);
        if (e.consts[cfname] !== undefined) throw new ECSError(`"${fieldName}" is already defined as a constant`, e);
        if (e.inits[ecfname] !== undefined) throw new ECSError(`"${fieldName}" is already defined as a variable`, e);
        if (type == 'const') e.consts[cfname] = value;
        if (type == 'init') e.inits[ecfname] = value;
        this.fieldtypes[cfname] = type;
    }
    isConstOrInit(component: ComponentType, fieldName: string) : 'const' | 'init' {
        return this.fieldtypes[mksymbol(component, fieldName)];
    }
    getConstValue(entity: Entity, fieldName: string) {
        let component = this.em.singleComponentWithFieldName([entity.etype], fieldName, entity);
        let cfname = mksymbol(component, fieldName);
        return entity.consts[cfname];
    }
    checkFieldValue(field: DataField, value: DataValue) {
        if (field.dtype == 'array') {
            if (!(value instanceof Uint8Array))
                throw new ECSError(`This "${field.name}" value should be an array.`);
        } else if (typeof value !== 'number') {
            throw new ECSError(`This "${field.name}" ${field.dtype} value should be an number.`);
        } else {
            if (field.dtype == 'int') {
                if (value < field.lo || value > field.hi)
                    throw new ECSError(`This "${field.name}" value is out of range, should be between ${field.lo} and ${field.hi}.`);
            } else if (field.dtype == 'ref') {
                // TODO: allow override if number
                let eset = new EntitySet(this, field.query);
                if (value < 0 || value >= eset.entities.length)
                    throw new ECSError(`This "${field.name}" value is out of range for this ref type.`);
            }
        }
    }
    generateCodeForEvent(event: string, args?: string[], codelabel?: string): string {
        // find systems that respond to event
        // and have entities in this scope
        let systems = this.em.event2systems[event];
        if (!systems || systems.length == 0) {
            // TODO: error or warning?
            //throw new ECSError(`warning: no system responds to "${event}"`);
            console.log(`warning: no system responds to "${event}"`);
            return '';
        }
        this.eventSeq++;
        // generate code
        let code = '';
        // is there a label? generate it first
        if (codelabel) { code += this.dialect.label(codelabel) + '\n'; }
        // if "start" event, initialize data segment
        if (event == 'start') {
            code += this.allocateInitData(this.bss);
        }
        // iterate all instances and generate matching events
        let eventCount = 0;
        let instances = this.instances.filter(inst => systems.includes(inst.system));
        for (let inst of instances) {
            let sys = inst.system;
            for (let action of sys.actions) {
                if (action.event == event) {
                    eventCount++;
                    // TODO: use Tokenizer so error msgs are better
                    // TODO: keep event tree
                    let codeeval = new ActionEval(this, inst, action, args || []);
                    codeeval.begin();
                    if (action.critical) this.inCritical++;
                    let eventcode = codeeval.codeToString();
                    if (action.critical) this.inCritical--;
                    if (!this.inCritical && codeeval.isSubroutineSized(eventcode)) {
                        let normcode = this.normalizeCode(eventcode, action);
                        let estats = this.eventCodeStats[normcode];
                        if (!estats) {
                            estats = this.eventCodeStats[normcode] = new EventCodeStats(
                                inst, action, eventcode);
                        }
                        estats.labels.push(codeeval.label);
                        estats.count++;
                        if (action.critical) estats.count++; // always make critical event subroutines
                    }
                    let s = '';
                    s += this.dialect.comment(`start action ${codeeval.label}`);
                    s += eventcode;
                    s += this.dialect.comment(`end action ${codeeval.label}`);
                    code += s;
                    // TODO: check that this happens once?
                    codeeval.end();
                }
            }
        }
        if (eventCount == 0) {
            console.log(`warning: event ${event} not handled`);
        }
        return code;
    }
    normalizeCode(code: string, action: Action) {
        // TODO: use dialect to help with this
        code = code.replace(/\b(\w+__\w+__)(\d+)__(\w+)\b/g, (z,a,b,c) => a+c);
        return code;
    }
    getSystemStats(inst: SystemInstance) : SystemStats {
        let stats = this.sysstats.get(inst);
        if (!stats) {
            stats = new SystemStats();
            this.sysstats.set(inst, stats);
        }
        return stats;
    }
    updateTempLiveness(inst: SystemInstance) {
        let stats = this.getSystemStats(inst);
        let n = this.eventSeq;
        if (stats.tempstartseq && stats.tempendseq) {
            stats.tempstartseq = Math.min(stats.tempstartseq, n);
            stats.tempendseq = Math.max(stats.tempendseq, n);
        } else {
            stats.tempstartseq = stats.tempendseq = n;
        }
    }
    includeResource(symbol: string): string {
        this.resources.add(symbol);
        return symbol;
    }
    private allocateTempVars() {
        let pack = new Packer();
        let maxTempBytes = 128 - this.bss.size; // TODO: multiple data segs
        let bssbin = new Bin({ left:0, top:0, bottom: this.eventSeq+1, right: maxTempBytes });
        pack.bins.push(bssbin);
        for (let instance of this.instances) {
            let stats = this.getSystemStats(instance);
            if (instance.system.tempbytes && stats.tempstartseq && stats.tempendseq) {
                let v = {
                    inst: instance,
                    top: stats.tempstartseq,
                    bottom: stats.tempendseq+1,
                    width: instance.system.tempbytes,
                    height: stats.tempendseq - stats.tempstartseq + 1,
                    label: instance.system.name
                };
                pack.boxes.push(v);
            }
        }
        if (!pack.pack()) console.log('cannot pack temporary local vars'); // TODO
        //console.log('tempvars', pack);
        if (bssbin.extents.right > 0) {
            let tempofs = this.bss.allocateBytes('TEMP', bssbin.extents.right);
            for (let b of pack.boxes) {
                let inst : SystemInstance = (b as any).inst;
                //console.log(inst.system.name, b.box?.left);
                if (b.box) this.bss.declareSymbol(this.dialect.tempLabel(inst), tempofs + b.box.left);
                //this.bss.equates[this.dialect.tempLabel(inst)] = `TEMP+${b.box?.left}`;
            }
        }
        console.log(pack.toSVGUrl());
    }
    private analyzeEntities() {
        this.buildSegments();
        this.allocateSegment(this.bss, true, 'init');  // initialized vars
        this.allocateSegment(this.bss, true, undefined);   // uninitialized vars
        this.allocateSegment(this.rodata, false, 'const'); // constants
        this.allocateROData(this.rodata);
    }
    private generateCode() {
        this.eventSeq = 0;
        this.eventCodeStats = {};
        let isMainScope = this.parent == null;
        let start;
        let initsys = this.em.getSystemByName('Init');
        if (isMainScope && initsys) {
            this.newSystemInstanceWithDefaults(initsys); //TODO: what if none?
            start = this.generateCodeForEvent('main_init');
        } else {
            start = this.generateCodeForEvent('start');
        }
        start = this.replaceSubroutines(start);
        this.code.addCodeFragment(start);
        for (let sub of Array.from(this.resources.values())) {
            if (!this.getSystemInstanceNamed(sub)) {
                let sys = this.em.getSystemByName(sub);
                if (!sys) throw new ECSError(`cannot find resource named "${sub}"`);
                this.newSystemInstanceWithDefaults(sys);
            }
            let code = this.generateCodeForEvent(sub, [], sub);
            this.code.addCodeFragment(code); // TODO: should be rodata?
        }
        //this.showStats();
    }
    replaceSubroutines(code: string) {
        // TODO: bin-packing for critical code
        // TODO: doesn't work with nested subroutines?
        // TODO: doesn't work between scopes
        let allsubs : string[] = [];
        for (let stats of Object.values(this.eventCodeStats)) {
            if (stats.count > 1) {
                if (allsubs.length == 0) {
                    allsubs = [
                        this.dialect.segment('rodata'),
                        this.dialect.alignSegmentStart()
                    ]
                } else if (stats.action.fitbytes) {
                    allsubs.push(this.dialect.alignIfLessThan(stats.action.fitbytes));
                }
                let subcall = this.dialect.call(stats.labels[0]);
                for (let label of stats.labels) {
                    let startdelim = this.dialect.comment(`start action ${label}`).trim();
                    let enddelim = this.dialect.comment(`end action ${label}`).trim();
                    let istart = code.indexOf(startdelim);
                    let iend = code.indexOf(enddelim, istart);
                    if (istart >= 0 && iend > istart) {
                        code = code.substring(0, istart) + subcall + code.substring(iend + enddelim.length);
                    }
                }
                let substart = stats.labels[0];
                let sublines = [
                    this.dialect.segment('rodata'),
                    this.dialect.label(substart),
                    stats.eventcode,
                    this.dialect.return(),
                ];
                if (stats.action.critical) {
                    sublines.push(this.dialect.warningIfPageCrossed(substart));
                }
                if (stats.action.fitbytes) {
                    sublines.push(this.dialect.warningIfMoreThan(stats.action.fitbytes, substart));
                }
                allsubs = allsubs.concat(sublines);
            }
        }
        code += allsubs.join('\n');
        return code;
    }
    showStats() {
        for (let inst of this.instances) {
            // TODO?
            console.log(inst.system.name, this.getSystemStats(inst));
        }
    }
    private dumpCodeTo(file: SourceFileExport) {
        let dialect = this.dialect;
        file.line(dialect.startScope(this.name));
        file.line(dialect.segment('bss'));
        this.bss.dump(file, dialect);
        file.line(dialect.segment('code')); // TODO: rodata for aligned?
        this.rodata.dump(file, dialect);
        //file.segment(`${this.name}_CODE`, 'code');
        file.line(dialect.label('__Start'));
        this.code.dump(file);
        for (let subscope of this.childScopes) {
            // TODO: overlay child BSS segments
            subscope.dump(file);
        }
        file.line(dialect.endScope(this.name));
    }
    dump(file: SourceFileExport) {
        this.analyzeEntities();
        this.generateCode();
        this.allocateTempVars();
        this.dumpCodeTo(file);
    }
}

export class EntityManager {
    archetypes: { [key: string]: EntityArchetype } = {};
    components: { [name: string]: ComponentType } = {};
    systems: { [name: string]: System } = {};
    topScopes: { [name: string]: EntityScope } = {};
    event2systems: { [event: string]: System[] } = {};
    name2cfpairs: { [cfname: string]: ComponentFieldPair[] } = {};
    mainPath: string = '';
    imported: { [path: string]: boolean } = {};
    seq = 1;

    constructor(public readonly dialect: Dialect_CA65) {
    }
    newScope(name: string, parent?: EntityScope) {
        let existing = this.topScopes[name];
        if (existing && !existing.isDemo)
            throw new ECSError(`scope ${name} already defined`, existing);
        let scope = new EntityScope(this, this.dialect, name, parent);
        if (!parent) this.topScopes[name] = scope;
        return scope;
    }
    deferComponent(name: string) {
        this.components[name] = { name, fields: [] };
    }
    defineComponent(ctype: ComponentType) {
        let existing = this.components[ctype.name];
        // we can defer component definitions, just declare a component with 0 fields?
        if (existing && existing.fields.length > 0)
            throw new ECSError(`component ${ctype.name} already defined`, existing);
        if (existing) {
            existing.fields = ctype.fields;
            ctype = existing;
        }
        for (let field of ctype.fields) {
            let list = this.name2cfpairs[field.name];
            if (!list) list = this.name2cfpairs[field.name] = [];
            list.push({ c: ctype, f: field });
        }
        this.components[ctype.name] = ctype;
        return ctype;
    }
    defineSystem(system: System) {
        let existing = this.systems[system.name];
        if (existing) throw new ECSError(`system ${system.name} already defined`, existing);
        return this.systems[system.name] = system;
    }
    registerSystemEvents(system: System) {
        for (let a of system.actions) {
            let event = a.event;
            let list = this.event2systems[event];
            if (list == null) list = this.event2systems[event] = [];
            if (!list.includes(system)) list.push(system);
        }
    }
    addArchetype(atype: EntityArchetype): EntityArchetype {
        let key = atype.components.map(c => c.name).join(',');
        if (this.archetypes[key])
            return this.archetypes[key];
        else
            return this.archetypes[key] = atype;
    }
    componentsMatching(q: Query, etype: EntityArchetype) {
        let list = [];
        for (let c of etype.components) {
            if (q.exclude?.includes(c)) {
                return [];
            }
            // TODO: 0 includes == all entities?
            if (q.include.length == 0 || q.include.includes(c)) {
                list.push(c);
            }
        }
        return list.length == q.include.length ? list : [];
    }
    archetypesMatching(q: Query) {
        let result = new Set<EntityArchetype>();
        for (let etype of Object.values(this.archetypes)) {
            let cmatch = this.componentsMatching(q, etype);
            if (cmatch.length > 0) {
                result.add(etype);
            }
        }
        return Array.from(result.values());
    }
    componentsWithFieldName(atypes: EntityArchetype[], fieldName: string) {
        // TODO???
        let comps = new Set<ComponentType>();
        for (let at of atypes) {
            for (let c of at.components) {
                for (let f of c.fields) {
                    if (f.name == fieldName)
                        comps.add(c);
                }
            }
        }
        return Array.from(comps);
    }
    getComponentByName(name: string): ComponentType {
        return this.components[name];
    }
    getSystemByName(name: string): System {
        return this.systems[name];
    }
    singleComponentWithFieldName(atypes: EntityArchetype[], fieldName: string, where: SourceLocated) {
        let cfpairs = this.name2cfpairs[fieldName];
        if (!cfpairs) throw new ECSError(`cannot find field named "${fieldName}"`, where);
        let filtered = cfpairs.filter(cf => atypes.find(a => a.components.includes(cf.c)));
        if (filtered.length == 0) {
            throw new ECSError(`cannot find component with field "${fieldName}" in this context`, where);
        }
        if (filtered.length > 1) {
            throw new ECSError(`ambiguous field name "${fieldName}"`, where);
        }
        return filtered[0].c;
    }
    toJSON() {
        return JSON.stringify({
            components: this.components,
            systems: this.systems
        })
    }
    exportToFile(file: SourceFileExport) {
        for (let event of Object.keys(this.event2systems)) {
            file.line(this.dialect.equate(`EVENT__${event}`, '1'))
        }
        for (let scope of Object.values(this.topScopes)) {
            if (!scope.isDemo || scope.filePath == this.mainPath) {
                scope.dump(file);
            }
        }
    }
    *iterateScopes() {
        for (let scope of Object.values(this.topScopes)) {
            yield scope;
            scope.iterateChildScopes();
        }
    }
    getDebugTree() : {} {
        let scopes = this.topScopes;
        let components = this.components;
        let fields = this.name2cfpairs;
        let systems = this.systems;
        let events = this.event2systems;
        let entities : {[key:string]:Entity} = {};
        for (let scope of Array.from(this.iterateScopes())) {
            for (let e of scope.entities)
                entities[e.name || '#'+e.id.toString()] = e;
        }
        return { scopes, components, fields, systems, events, entities };
    }

    // expression stuff

    evalExpr(expr: Expr, scope: EntityScope | null) : Expr {
        if (isLiteral(expr)) return expr;
        if (isBinOp(expr) || isUnOp(expr)) {
            var fn = (this as any)['evalop__' + expr.op];
            if (!fn) throw new ECSError(`no eval function for "${expr.op}"`);
        }
        if (isBinOp(expr)) {
            expr.left = this.evalExpr(expr.left, scope);
            expr.right = this.evalExpr(expr.right, scope);
            let e = fn(expr.left, expr.right);
            return e || expr;
        }
        if (isUnOp(expr)) {
            expr.expr = this.evalExpr(expr.expr, scope);
            let e = fn(expr.expr);
            return e || expr;
        }
        return expr;
    }
    evalop__neg(arg: Expr) : Expr | undefined {
        if (isLiteralInt(arg)) {
            let valtype : IntType = { dtype:'int',
                lo: -arg.valtype.hi,
                hi: arg.valtype.hi };
            return { valtype, value: -arg.value };
        }
    }
    evalop__add(left: Expr, right: Expr) : Expr | undefined {
        if (isLiteralInt(left) && isLiteralInt(right)) {
            let valtype : IntType = { dtype:'int', 
                lo: left.valtype.lo + right.valtype.lo, 
                hi: left.valtype.hi + right.valtype.hi };
            return { valtype, value: left.value + right.value };
        }
    }
    evalop__sub(left: Expr, right: Expr) : Expr | undefined {
        if (isLiteralInt(left) && isLiteralInt(right)) {
            let valtype : IntType = { dtype:'int', 
                lo: left.valtype.lo - right.valtype.hi, 
                hi: left.valtype.hi - right.valtype.lo };
            return { valtype, value: left.value - right.value };
        }
    }
}
