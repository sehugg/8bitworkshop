
import { SourceLocated, SourceLocation } from "../workertypes";
import { Bin, Packer } from "./binpack";

export class ECSError extends Error {
    $loc: SourceLocation;
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
    include: ComponentType[]; // TODO: make ComponentType
    exclude?: ComponentType[];
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

export const SELECT_TYPE = ['once', 'foreach', 'join', 'with', 'if', 'select'] as const;

export type SelectType = typeof SELECT_TYPE[number];

export class ActionStats {
    callcount: number = 0;
}

export interface ActionOwner {
    system: System
    scope: EntityScope | null
}

export class ActionNode implements SourceLocated {
    constructor(
        public readonly owner: ActionOwner,
        public readonly $loc: SourceLocation
    ) { }
}

export class CodeLiteralNode extends ActionNode {
    constructor(
        owner: ActionOwner,
        $loc: SourceLocation,
        public readonly text: string
    ) {
        super(owner, $loc);
    }
}

export class CodePlaceholderNode extends ActionNode {
    constructor(
        owner: ActionOwner,
        $loc: SourceLocation,
        public readonly args: string[]
    ) {
        super(owner, $loc);
    }
}


export interface ActionBase extends SourceLocated {
    select: SelectType;
    event: string;
    text: string;
}

export interface ActionOnce extends ActionBase {
    select: 'once'
}

export interface ActionWithQuery extends ActionBase {
    select: 'foreach' | 'join' | 'with' | 'if' | 'select'
    query: Query
    direction?: 'asc' | 'desc'
}

export interface ActionWithJoin extends ActionWithQuery {
    select: 'join'
    join?: Query
}

export type Action = ActionWithQuery | ActionWithJoin | ActionOnce;

export type DataValue = number | boolean | Uint8Array | Uint16Array | Uint32Array;

export type DataField = { name: string } & DataType;

export type DataType = IntType | ArrayType | RefType;

export interface IntType {
    dtype: 'int'
    lo: number
    hi: number
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

interface ComponentFieldPair {
    c: ComponentType;
    f: DataField;
}

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

    // TODO
    ASM_MAP_RANGES = `
    txa
    pha
    lda {{%mapping}},x
    jmi @__mapskip
    tax
    {{%code}}
@__mapskip:
    pla
    tax
`;

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
    code() {
        return `.code\n`;
    }
    bss() {
        return `.bss\n`;
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
        return `.endscope\n${name}__Start = ${name}::__Start`
        // TODO: scope__start = scope::start
    }
    segment(seg: string, segtype: 'rodata' | 'bss' | 'code') {
        if (segtype == 'bss') {
            return `.zeropage`; // TODO
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
            else return `.byte (${b.symbol} >> ${b.bitofs})` // TODO?
        }
    }
    tempLabel(sys: System) {
        return `${sys.name}__tmp`;
    }
    equate(symbol: string, value: string): string {
        return `${symbol} = ${value}`;
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
            this.symbols[name] = ofs;
            if (!this.ofs2sym.has(ofs))
                this.ofs2sym.set(ofs, []);
            this.ofs2sym.get(ofs)?.push(name);
            this.size += bytes;
        }
        return ofs;
    }
    // TODO: optimize shared data
    allocateInitData(name: string, bytes: Uint8Array) {
        let ofs = this.allocateBytes(name, bytes.length);
        for (let i = 0; i < bytes.length; i++) {
            this.initdata[ofs + i] = bytes[i];
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
        let ofs = this.symbols[access.symbol];
        if (ofs !== undefined) {
            return ofs + entityID - range.elo;
        }
        // TODO: show entity name?
        throw new ECSError(`cannot find field access for ${access.symbol}`);
    }
    getSegmentByteOffset(component: ComponentType, fieldName: string, entityID: number, bitofs: number, width: number) {
        let range = this.getFieldRange(component, fieldName);
        if (range && range.access) {
            for (let a of range.access) {
                if (a.bit == bitofs && a.width == width) {
                    let ofs = this.symbols[a.symbol];
                    if (ofs !== undefined) {
                        return ofs + entityID - range.elo;
                    }
                }
            }
        }
        // TODO: show entity name?
        throw new ECSError(`cannot find field offset for ${component.name}:${fieldName} entity #${entityID} bits ${bitofs} ${width}`)
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

function getFieldBits(f: IntType) {
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

    constructor(scope: EntityScope, query?: Query, a?: EntityArchetype[], e?: Entity[]) {
        this.scope = scope;
        if (query) {
            this.atypes = scope.em.archetypesMatching(query);
            this.entities = scope.entitiesMatching(this.atypes);
            if (query.limit) {
                this.entities = this.entities.slice(0, query.limit);
            }
        } else if (a && e) {
            this.atypes = a;
            this.entities = e;
        }
    }
    contains(c: ComponentType, f: DataField, where: SourceLocated) {
        // TODO: action for error msg
        return this.scope.em.singleComponentWithFieldName(this.atypes, f.name, where);
    }
    intersection(qr: EntitySet) {
        let ents = this.entities.filter(e => qr.entities.includes(e));
        let atypes = this.atypes.filter(a1 => qr.atypes.find(a2 => a2 == a1));
        return new EntitySet(this.scope, undefined, atypes, ents);
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

// todo: generalize
class ActionCPUState {
    loops: EntitySet[] = [];
    x: EntitySet | null = null;
    y: EntitySet | null = null;
    xofs: number = 0;
    yofs: number = 0;
}

class ActionContext {
    
}

class ActionEval {
    em : EntityManager;
    dialect : Dialect_CA65;
    qr: EntitySet;
    jr: EntitySet | undefined;
    oldState : ActionCPUState;
    entities : Entity[];
    tmplabel = '';

    constructor(
        readonly scope: EntityScope,
        readonly sys: System,
        readonly action: Action)
    {
        this.em = scope.em;
        this.dialect = scope.em.dialect;
        this.oldState = scope.state;
        let q = (action as ActionWithQuery).query;
        if (q) this.qr = new EntitySet(scope, q);
        else this.qr = new EntitySet(scope, undefined, [], []);
        this.entities = this.qr.entities;
        //let query = (this.action as ActionWithQuery).query;
        //TODO? if (query && this.entities.length == 0)
            //throw new ECSError(`query doesn't match any entities`, query); // TODO 
    }
    begin() {
        let state = this.scope.state = Object.assign({}, this.scope.state);
        // TODO: generalize to other cpus/langs
        switch (this.action.select) {
            case 'foreach':
                if (state.x && state.y) throw new ECSError('no more index registers', this.action);
                if (state.x) state.y = this.qr;
                else state.x = this.qr;
                state.loops = state.loops.concat([this.qr]);
                break;
            case 'join':
                if (state.x || state.y) throw new ECSError('no free index registers for join', this.action);
                this.jr = new EntitySet(this.scope, (this.action as ActionWithJoin).join);
                state.y = this.qr;
                state.x = this.jr;
                state.loops = state.loops.concat([this.qr]);
                break;
            case 'if':
            case 'with':
                // TODO: what if not in X because 1 element?
                if (state.x) {
                    let int = state.x.intersection(this.qr);
                    if (int.entities.length == 0) {
                        if (this.action.select == 'with')
                            throw new ECSError('no entities match this query', this.action);
                        else
                            break;
                    } else {
                        let indofs = int.entities[0].id - state.x.entities[0].id;
                        state.xofs += indofs; // TODO: should merge with filter
                        state.x = int;
                        this.entities = int.entities; // TODO?
                    }
                } else if (this.action.select == 'with') {
                    if (this.qr.entities.length != 1)
                        throw new ECSError(`query outside of loop must match exactly one entity`, this.action);
                }
                break;
        }
    }
    end() {
        this.scope.state = this.oldState;
    }
    codeToString(): string {
        const tag_re = /\{\{(.+?)\}\}/g;
        const label_re = /@(\w+)\b/g;

        const allowEmpty = ['if','foreach','join'];
        if (this.entities.length == 0 && allowEmpty.includes(this.action.select))
           return '';

        let action = this.action;
        let sys = this.sys;
        let code = action.text;
        let label = `${sys.name}__${action.event}__${this.em.seq++}`; // TODO: better label that won't conflict (seq?)
        let props: { [name: string]: string } = {};
        if (action.select != 'once') {
            // TODO: detect cycles
            // TODO: "source"?
            // TODO: what if only 1 item?
            // TODO: what if join is subset of items?
            if (action.select == 'join' && this.jr) {
                let jentities = this.jr.entities;
                if (jentities.length == 0) return '';
                    // TODO? throw new ECSError(`join query doesn't match any entities`, (action as ActionWithJoin).join); // TODO 
                let joinfield = this.getJoinField(action, this.qr.atypes, this.jr.atypes);
                // TODO: what if only 1 item?
                // TODO: should be able to access fields via Y reg
                code = this.wrapCodeInLoop(code, action, this.qr.entities, joinfield);
                props['%joinfield'] = this.dialect.fieldsymbol(joinfield.c, joinfield.f, 0); //TODO?
            }
            // select subset of entities
            let fullEntityCount = this.qr.entities.length; //entities.length.toString();
            let entities = this.entities;
            let loops = this.scope.state.loops;
            let loopents = loops[loops.length-1]?.entities;
            // TODO: let loopreduce = !loopents || entities.length < loopents.length;
            //console.log(action.event, entities.length, loopents.length);
            // filter entities from loop?
            // TODO: when to ignore if entities.length == 1 and not in for loop?
            if (action.select == 'with') {
                code = this.wrapCodeInFilter(code);
            }
            if (action.select == 'if') {
                code = this.wrapCodeInFilter(code);
            }
            if (action.select == 'foreach' && entities.length > 1) {
                code = this.wrapCodeInLoop(code, action, this.qr.entities);
            }
            // define properties
            props['%elo'] = entities[0].id.toString();
            props['%ehi'] = entities[entities.length - 1].id.toString();
            props['%ecount'] = entities.length.toString();
            props['%efullcount'] = fullEntityCount.toString();
            props['%xofs'] = this.scope.state.xofs.toString();
            props['%yofs'] = this.scope.state.yofs.toString();
        }
        // replace @labels
        code = code.replace(label_re, (s: string, a: string) => `${label}__${a}`);
        // replace {{...}} tags
        code = code.replace(tag_re, (entire, group: string) => {
            let toks = group.split(/\s+/);
            if (toks.length == 0) throw new ECSError(`empty command`, action);
            let cmd = group.charAt(0);
            let rest = group.substring(1).trim();
            switch (cmd) {
                case '!': return this.__emit([rest]);
                case '$': return this.__local([rest]);
                case '^': return this.__use([rest]);
                case '<': return this.__get([rest, '0']);
                case '>': return this.__get([rest, '8']);
                default:
                    let value = props[toks[0]];
                    if (value) return value;
                    let fn = (this as any)['__' + toks[0]];
                    if (fn) return fn.bind(this)(toks.slice(1));
                    throw new ECSError(`unrecognized command {{${toks[0]}}}`, action);
            }
        });
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
        let component = this.em.singleComponentWithFieldName(this.qr.atypes, fieldName, this.action);
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
        if (this.qr.entities.length != 1) throw new ECSError(`data command operates on exactly one entity`); // TODO?
        let eid = this.qr.entities[0].id; // TODO?
        return this.dialect.datasymbol(component, field, eid, bitofs);
    }
    __index(args: string[]) {
        // TODO: check select type and if we actually have an index...
        let ident = args[0];
        if (this.entities.length == 1) {
            return this.dialect.absolute(ident);
        } else {
            return this.dialect.indexed_x(ident, 0); //TODO?
        }
    }
    __use(args: string[]) {
        return this.scope.includeResource(args[0]);
    }
    __emit(args: string[]) {
        let event = args[0];
        return this.scope.generateCodeForEvent(event);
    }
    __local(args: string[]) {
        let tempinc = parseInt(args[0]);
        if (isNaN(tempinc)) throw new ECSError(`bad temporary offset`, this.action);
        if (!this.sys.tempbytes) throw new ECSError(`this system has no locals`, this.action);
        if (tempinc < 0 || tempinc >= this.sys.tempbytes) throw new ECSError(`this system only has ${this.sys.tempbytes} locals`, this.action);
        this.scope.updateTempLiveness(this.sys);
        return `${this.tmplabel}+${tempinc}`;
    }
    __bss_init(args: string[]) {
        return this.scope.allocateInitData(this.scope.bss);
    }
    wrapCodeInLoop(code: string, action: ActionWithQuery, ents: Entity[], joinfield?: ComponentFieldPair): string {
        // TODO: check ents
        // TODO: check segment bounds
        // TODO: what if 0 or 1 entitites?
        // TODO: check > 127 or > 255
        let dir = action.direction;
        let s = dir == 'desc' ? this.dialect.ASM_ITERATE_EACH_DESC : this.dialect.ASM_ITERATE_EACH_ASC;
        if (joinfield) s = dir == 'desc' ? this.dialect.ASM_ITERATE_JOIN_DESC : this.dialect.ASM_ITERATE_JOIN_ASC;
        s = s.replace('{{%code}}', code);
        return s;
    }
    wrapCodeInFilter(code: string) {
        // TODO: :-p
        const ents = this.entities;
        const ents2 = this.oldState.x?.entities;
        if (ents && ents2) {
            let lo = ents[0].id;
            let hi = ents[ents.length - 1].id;
            let lo2 = ents2[0].id;
            let hi2 = ents2[ents2.length - 1].id;
            if (lo != lo2)
                code = this.dialect.ASM_FILTER_RANGE_LO_X.replace('{{%code}}', code);
            if (hi != hi2)
                code = this.dialect.ASM_FILTER_RANGE_HI_X.replace('{{%code}}', code);
        }
        return code;
    }
    generateCodeForField(fieldName: string, bitofs: number, canWrite: boolean): string {
        const action = this.action;
        const qr = this.jr || this.qr; // TODO: why not both!

        var component: ComponentType;
        var baseLookup = false;
        let entities: Entity[];
        // is qualified field?
        if (fieldName.indexOf('.') > 0) {
            let [entname, fname] = fieldName.split('.');
            let ent = this.scope.getEntityByName(entname);
            if (ent == null) throw new ECSError(`no entity named "${entname}" in this scope`, action);
            component = this.em.singleComponentWithFieldName(this.qr.atypes, fname, action);
            fieldName = fname;
            entities = [ent];
        } else if (fieldName.indexOf(':') > 0) {
            let [cname, fname] = fieldName.split(':');
            component = this.em.getComponentByName(cname);
            if (component == null) throw new ECSError(`no component named "${cname}"`, action)
            entities = this.entities;
            fieldName = fname;
            baseLookup = true;
        } else {
            component = this.em.singleComponentWithFieldName(qr.atypes, fieldName, action);
            entities = this.entities;
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
        let range = this.scope.bss.getFieldRange(component, fieldName) || this.scope.rodata.getFieldRange(component, fieldName);
        if (!range) throw new ECSError(`couldn't find field for ${component.name}:${fieldName}, maybe no entities?`); // TODO
        // TODO: dialect
        let eidofs = qr.entities.length && qr.entities[0].id - range.elo; // TODO: negative?
        // TODO: array field baseoffset?
        if (baseLookup) {
            return this.dialect.absolute(ident);
        } else if (entities.length == 1) {
            return this.dialect.absolute(ident, eidofs);
        } else {
            let ir;
            if (this.scope.state.x?.intersection(qr)) {
                ir = this.scope.state.x;
                eidofs -= this.scope.state.xofs;
            }
            else if (this.scope.state.y?.intersection(qr)) {
                ir = this.scope.state.y;
                eidofs -= this.scope.state.yofs;
            }
            if (!ir) throw new ECSError(`no intersection for index register`, action);
            if (ir.entities.length == 0) throw new ECSError(`no common entities for index register`, action);
            if (!ir.isContiguous()) throw new ECSError(`entities in query are not contiguous`, action);
            if (ir == this.scope.state.x)
                return this.dialect.indexed_x(ident, eidofs);
            if (ir == this.scope.state.y)
                return this.dialect.indexed_y(ident, eidofs);
            throw new ECSError(`cannot find "${component.name}:${field.name}" in state`, action);
        }
    }
    getJoinField(action: Action, atypes: EntityArchetype[], jtypes: EntityArchetype[]): ComponentFieldPair {
        let refs = Array.from(this.scope.iterateArchetypeFields(atypes, (c, f) => f.dtype == 'ref'));
        // TODO: better error message
        if (refs.length == 0) throw new ECSError(`cannot find join fields`, action);
        if (refs.length > 1) throw new ECSError(`cannot join multiple fields`, action);
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
}

export class EntityScope implements SourceLocated {
    $loc: SourceLocation;
    childScopes: EntityScope[] = [];
    systems: System[] = [];
    entities: Entity[] = [];
    fieldtypes: { [name: string]: 'init' | 'const' } = {};
    sysstats = new Map<System, SystemStats>();
    actionstats = new Map<Action, ActionStats>();
    bss = new UninitDataSegment();
    rodata = new ConstDataSegment();
    code = new CodeSegment();
    componentsInScope = new Set();
    eventSeq = 0;
    resources = new Set<string>();
    state = new ActionCPUState();
    isDemo = false;
    filePath = '';

    constructor(
        public readonly em: EntityManager,
        public readonly dialect: Dialect_CA65,
        public readonly name: string,
        public readonly parent: EntityScope | undefined
    ) {
        parent?.childScopes.push(this);
    }
    newEntity(etype: EntityArchetype): Entity {
        // TODO: add parent ID? lock parent scope?
        // TODO: name identical check?
        let id = this.entities.length;
        etype = this.em.addArchetype(etype);
        let entity: Entity = { id, etype, consts: {}, inits: {} };
        for (let c of etype.components) {
            this.componentsInScope.add(c.name);
        }
        this.entities.push(entity);
        return entity;
    }
    addUsingSystem(system: System) {
        if (!system) throw new Error();
        this.systems.push(system);
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
            let segment = v === undefined && f.dtype != 'array' ? this.bss : this.rodata;
            let cfname = mksymbol(c, f.name);
            // determine range of indices for entities
            let array = segment.fieldranges[cfname];
            if (!array) {
                array = segment.fieldranges[cfname] = { component: c, field: f, elo: i, ehi: i };
            } else {
                array.ehi = i;
            }
            //console.log(i,array,cfname);
        }
    }
    // TODO: cull unused entity fields
    allocateSegment(segment: DataSegment, alloc: boolean, type: 'init' | 'const' | undefined) {
        let fields: FieldArray[] = Object.values(segment.fieldranges);
        // TODO: fields.sort((a, b) => (a.ehi - a.elo + 1) * getPackedFieldSize(a.field));
        for (let f of fields) {
            if (this.fieldtypes[mksymbol(f.component, f.field.name)] == type) {
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
            let range = segment.fieldranges[cfname];
            let entcount = range ? range.ehi - range.elo + 1 : 0;
            // is this a constant value?
            if (v === undefined) {
                // this is not a constant
                // is it a bounded array? (TODO)
                if (f.dtype == 'array' && f.index) {
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
                }
            } else {
                // this is a constant
                // is it a byte array?
                //TODO? if (ArrayBuffer.isView(v) && f.dtype == 'array') {
                if (v instanceof Uint8Array && f.dtype == 'array') {
                    let datasym = this.dialect.datasymbol(c, f, e.id, 0);
                    segment.allocateInitData(datasym, v);
                    let ptrlosym = this.dialect.fieldsymbol(c, f, 0);
                    let ptrhisym = this.dialect.fieldsymbol(c, f, 8);
                    let loofs = segment.allocateBytes(ptrlosym, entcount);
                    let hiofs = segment.allocateBytes(ptrhisym, entcount);
                    if (f.baseoffset) datasym = `(${datasym}+${f.baseoffset})`;
                    segment.initdata[loofs + e.id - range.elo] = { symbol: datasym, bitofs: 0 };
                    segment.initdata[hiofs + e.id - range.elo] = { symbol: datasym, bitofs: 8 };
                } else if (typeof v === 'number') {
                    // more than 1 entity, add an array
                    if (entcount > 1) {
                        if (!range.access) throw new ECSError(`no access for field ${cfname}`)
                        for (let a of range.access) {
                            segment.allocateBytes(a.symbol, entcount);
                            let ofs = segment.getByteOffset(range, a, e.id);
                            segment.initdata[ofs] = (v >> a.bit) & 0xff;
                        }
                    }
                    // TODO: what if mix of var, const, and init values?
                } else {
                    // TODO: bad error message - should say "wrong type, should be array"
                    throw new ECSError(`unhandled constant ${e.id}:${cfname} -- ${typeof v}`);
                }
            }
        }
        //console.log(segment.initdata)
    }
    allocateInitData(segment: DataSegment) {
        if (segment.size == 0) return ''; // TODO: warning for no init data?
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
    // TODO: check type/range of value
    setConstValue(e: Entity, component: ComponentType, fieldName: string, value: DataValue) {
        let c = this.em.singleComponentWithFieldName([e.etype], fieldName, e);
        e.consts[mksymbol(component, fieldName)] = value;
        this.fieldtypes[mksymbol(component, fieldName)] = 'const';
    }
    setInitValue(e: Entity, component: ComponentType, fieldName: string, value: DataValue) {
        let c = this.em.singleComponentWithFieldName([e.etype], fieldName, e);
        e.inits[mkscopesymbol(this, component, fieldName)] = value;
        this.fieldtypes[mksymbol(component, fieldName)] = 'init';
    }
    isConstOrInit(component: ComponentType, fieldName: string) : 'const' | 'init' {
        return this.fieldtypes[mksymbol(component, fieldName)];
    }
    generateCodeForEvent(event: string): string {
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
        let s = this.dialect.code();
        //s += `\n; event ${event}\n`;
        systems = systems.filter(s => this.systems.includes(s));
        for (let sys of systems) {
            for (let action of sys.actions) {
                if (action.event == event) {
                    // TODO: use Tokenizer so error msgs are better
                    // TODO: keep event tree
                    let codeeval = new ActionEval(this, sys, action);
                    codeeval.tmplabel = this.dialect.tempLabel(sys);
                    codeeval.begin();
                    s += this.dialect.comment(`start action ${sys.name} ${event}`); // TODO
                    s += codeeval.codeToString();
                    s += this.dialect.comment(`end action ${sys.name} ${event}`);
                    // TODO: check that this happens once?
                    codeeval.end();
                    this.getActionStats(action).callcount++;
                }
            }
        }
        return s;
    }
    getSystemStats(sys: System) : SystemStats {
        let stats = this.sysstats.get(sys);
        if (!stats) {
            stats = new SystemStats();
            this.sysstats.set(sys, stats);
        }
        return stats;
    }
    getActionStats(action: Action) : ActionStats {
        let stats = this.actionstats.get(action);
        if (!stats) {
            stats = new ActionStats();
            this.actionstats.set(action, stats);
        }
        return stats;
    }
    updateTempLiveness(sys: System) {
        let stats = this.getSystemStats(sys);
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
        for (let sys of this.systems) {
            let stats = this.getSystemStats(sys);
            if (sys.tempbytes && stats.tempstartseq && stats.tempendseq) {
                let v = {
                    sys,
                    top: stats.tempstartseq,
                    bottom: stats.tempendseq+1,
                    width: sys.tempbytes,
                    height: stats.tempendseq - stats.tempstartseq + 1,
                };
                pack.boxes.push(v);
            }
        }
        if (!pack.pack()) console.log('cannot pack temporary local vars'); // TODO
        console.log('tempvars', pack);
        if (bssbin.extents.right > 0) {
            this.bss.allocateBytes('TEMP', bssbin.extents.right);
            for (let b of pack.boxes) {
                let sys : System = (b as any).sys;
                console.log(sys.name, b.box?.left);
                this.bss.equates[this.dialect.tempLabel(sys)] = `TEMP+${b.box?.left}`;
            }
        }
    }
    private analyzeEntities() {
        this.buildSegments();
        this.allocateSegment(this.bss, true, undefined);   // uninitialized vars
        this.allocateSegment(this.bss, true, 'init');  // initialized vars
        this.allocateSegment(this.rodata, false, 'const'); // constants
        this.allocateROData(this.rodata);
    }
    private generateCode() {
        let isMainScope = this.parent == null;
        let start;
        let initsys = this.em.getSystemByName('Init');
        if (isMainScope && initsys) {
            this.addUsingSystem(initsys); //TODO: what if none?
            start = this.generateCodeForEvent('main_init');
        } else {
            start = this.generateCodeForEvent('start');
        }
        this.code.addCodeFragment(start);
        for (let sub of Array.from(this.resources.values())) {
            let code = this.generateCodeForEvent(sub);
            this.code.addCodeFragment(code);
        }
        //this.showStats();
    }
    showStats() {
        for (let sys of this.systems) {
            console.log(sys.name, this.getSystemStats(sys));
        }
        for (let action of Array.from(this.actionstats.keys())) {
            console.log(action.event, this.getActionStats(action));
        }
    }
    private dumpCodeTo(file: SourceFileExport) {
        let dialect = this.dialect;
        file.line(dialect.startScope(this.name));
        file.line(dialect.segment(`${this.name}_DATA`, 'bss'));
        this.bss.dump(file, dialect);
        file.line(dialect.segment(`${this.name}_RODATA`, 'rodata'));
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
        if (existing && existing.fields.length > 0)
            throw new ECSError(`component ${ctype.name} already defined`, existing);
        for (let field of ctype.fields) {
            let list = this.name2cfpairs[field.name];
            if (!list) list = this.name2cfpairs[field.name] = [];
            list.push({ c: ctype, f: field });
        }
        if (existing) {
            existing.fields = ctype.fields;
            return existing;
        } else {
            return this.components[ctype.name] = ctype;
        }
    }
    defineSystem(system: System) {
        let existing = this.systems[system.name];
        if (existing) throw new ECSError(`system ${system.name} already defined`, existing);
        for (let a of system.actions) {
            let event = a.event;
            let list = this.event2systems[event];
            if (list == null) list = this.event2systems[event] = [];
            if (!list.includes(system)) list.push(system);
        }
        return this.systems[system.name] = system;
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
        let components = this.componentsWithFieldName(atypes, fieldName);
        // TODO: use name2cfpairs?
        if (components.length == 0) {
            throw new ECSError(`cannot find component with field "${fieldName}"`, where);
        }
        if (components.length > 1) {
            throw new ECSError(`ambiguous field name "${fieldName}"`, where);
        }
        return components[0];
    }
    toJSON() {
        return JSON.stringify({
            components: this.components,
            systems: this.systems
        })
    }
    exportToFile(file: SourceFileExport) {
        for (let scope of Object.values(this.topScopes)) {
            if (!scope.isDemo || scope.filePath == this.mainPath) {
                scope.dump(file);
            }
        }
    }
}
