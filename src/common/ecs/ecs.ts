/*
entity scopes contain entities, and are nested
also contain segments (code, bss, rodata)
components and systems are global
component fields are stored in arrays, range of entities, can be bit-packed
some values can be constant, are stored in rodata (or loaded immediate)
optional components? on or off
union components? either X or Y or Z...

systems receive and send events, execute code on entities
systems are generated on a per-scope basis
system queries can only contain entities from self and parent scopes
starting from the 'init' event walk the event tree
include systems that have at least 1 entity in scope (except init?)

when entering scope, entities are initialized (zero or init w/ data)
to change scope, fire event w/ scope name
- how to handle bank-switching?

helps with:
- rapid prototyping w/ reasonable defaults
- deconstructing objects into arrays
- packing/unpacking bitfields
- initializing objects
- building lookup tables
- selecting and iterating objects
- managing events
- managing memory and scope
- converting assets to native formats?
- removing unused data

it's more convenient to have loops be zero-indexed
for page cross, temp storage, etc
should references be zero-indexed to a field, or global?
should we limit # of entities passed to systems? min-max
join thru a reference? load both x and y

code fragments can be parameterized like macros
if two fragments are identical, do a JSR
(do we have to look for labels?)

*/


import { SourceLocated, SourceLocation } from "../workertypes";

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
    include: string[]; // TODO: make ComponentType
    listen?: string[];
    exclude?: string[];
    updates?: string[];
}

export interface System extends SourceLocated {
    name: string;
    actions: Action[];
    tempbytes?: number;
}

export interface Action extends SourceLocated {
    text: string;
    event: string;
    select: SelectType
    query: Query;
    join?: Query;
    limit?: number;
    emits?: string[];
}

export type SelectType = 'once' | 'foreach' | 'source' | 'join';

export type DataValue = number | boolean | Uint8Array | Uint16Array;

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

interface ArchetypeMatch {
    etype: EntityArchetype;
    cmatch: ComponentType[];
}

interface ComponentFieldPair {
    c: ComponentType;
    f: DataField;
}

export class Dialect_CA65 {

    readonly ASM_ITERATE_EACH = `
    ldx #0
@__each:
    {{%code}}
    inx
    cpx #{{%ecount}}
    bne @__each
@__exit:
`;

readonly ASM_ITERATE_JOIN = `
    ldy #0
@__each:
    ldx {{%joinfield}},y
    {{%code}}
    iny
    cpy #{{%ecount}}
    bne @__each
@__exit:
`;

    readonly INIT_FROM_ARRAY = `
    ldy #{{%nbytes}}
:   lda {{%src}}-1,y
    sta {{%dest}}-1,y
    dey
    bne :-
`
    readonly HEADER = `
.include "vcs-ca65.h"
`
    readonly FOOTER = `
.segment "VECTORS"
VecNMI:    .word Start
VecReset:  .word Start
VecBRK:    .word Start
`
    readonly TEMPLATE_INIT = `
Start:
    CLEAN_START
`

    comment(s: string) {
        return `\n;;; ${s}\n`;
    }
    absolute(ident: string) {
        return ident;
    }
    indexed_x(ident: string) {
        return ident + ',x';
    }
    fieldsymbol(component: ComponentType, field: DataField, bitofs: number) {
        return `${component.name}_${field.name}_b${bitofs}`;
    }
    datasymbol(component: ComponentType, field: DataField, eid: number) {
        return `${component.name}_${field.name}_e${eid}`;
    }
    code() {
        return `.code\n`;
    }
    bss() {
        return `.bss\n`;
    }
}

// TODO: merge with Dialect?
export class SourceFileExport {
    lines: string[] = [];

    comment(text: string) {
        this.lines.push(';' + text);
    }
    segment(seg: string, segtype: 'rodata' | 'bss' | 'code') {
        if (segtype == 'bss') {
            this.lines.push(`.zeropage`); // TODO
        } else {
            this.lines.push(`.code`);
        }
    }
    label(sym: string) {
        this.lines.push(`${sym}:`);
    }
    byte(b: number | ConstByte | undefined) {
        if (b === undefined) {
            this.lines.push(` .res 1`);
        } else if (typeof b === 'number') {
            if (b < 0 || b > 255) throw new ECSError(`out of range byte ${b}`);
            this.lines.push(` .byte ${b}`)
        } else {
            if (b.bitofs == 0) this.lines.push(` .byte <${b.symbol}`)
            else if (b.bitofs == 8) this.lines.push(` .byte >${b.symbol}`)
            else this.lines.push(` .byte (${b.symbol} >> ${b.bitofs})`) // TODO?
        }
    }
    text(s: string) {
        for (let l of s.split('\n'))
            this.lines.push(l);
    }
    debug_file(path: string) {
        this.lines.push(` .dbg file, "${path}", 0, 0`);
    }
    debug_line(path: string, line: number) {
        this.lines.push(` .dbg line, "${path}", ${line}`);
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
    dump(file: SourceFileExport) {
        for (let i = 0; i < this.size; i++) {
            let syms = this.ofs2sym.get(i);
            if (syms) {
                for (let sym of syms) file.label(sym);
            }
            file.byte(this.initdata[i]);
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

export class EntityScope implements SourceLocated {
    $loc: SourceLocation;
    childScopes: EntityScope[] = [];
    entities: Entity[] = [];
    bss = new DataSegment();
    rodata = new DataSegment();
    code = new CodeSegment();
    componentsInScope = new Set();
    tempOffset = 0;
    tempSize = 0;
    maxTempBytes = 0;
    resources = new Set<string>();

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
    *iterateArchetypeFields(arch: ArchetypeMatch[], filter?: (c:ComponentType,f:DataField) => boolean) {
        for (let i = 0; i < arch.length; i++) {
            let a = arch[i];
            for (let c of a.etype.components) {
                for (let f of c.fields) {
                    if (!filter || filter(c,f))
                        yield { i, c, f };
                }
            }
        }
    }
    entitiesMatching(atypes: ArchetypeMatch[]) {
        let result : Entity[] = [];
        for (let e of this.entities) {
            for (let a of atypes) {
                // TODO: what about subclasses?
                // TODO: very scary identity ocmpare
                if (e.etype === a.etype) {
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
    getJoinField(action: Action, atypes: ArchetypeMatch[], jtypes: ArchetypeMatch[]) : ComponentFieldPair {
        let refs = Array.from(this.iterateArchetypeFields(atypes, (c,f) => f.dtype == 'ref'));
        // TODO: better error message
        if (refs.length == 0) throw new ECSError(`cannot find join fields`, action.query);
        if (refs.length > 1) throw new ECSError(`cannot join multiple fields`, action.query);
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
    allocateSegment(segment: DataSegment, readonly: boolean) {
        let fields : FieldArray[] = Object.values(segment.fieldranges);
        // TODO: fields.sort((a, b) => (a.ehi - a.elo + 1) * getPackedFieldSize(a.field));
        let f : FieldArray | undefined;
        while (f = fields.pop()) {
            let rangelen = (f.ehi - f.elo + 1);
            let alloc = !readonly;
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
                    let datasym = this.dialect.datasymbol(c, f, e.id);
                    let offset = this.bss.allocateBytes(datasym, getFieldLength(f.index));
                    let ptrlosym = this.dialect.fieldsymbol(c, f, 0);
                    let ptrhisym = this.dialect.fieldsymbol(c, f, 8);
                    let loofs = segment.allocateBytes(ptrlosym, entcount);
                    let hiofs = segment.allocateBytes(ptrhisym, entcount);
                    segment.initdata[loofs + e.id - range.elo] = { symbol: datasym, bitofs: 0 };
                    segment.initdata[hiofs + e.id - range.elo] = { symbol: datasym, bitofs: 8 };
                }
            } else {
                // this is a constant
                // is it a byte array?
                if (v instanceof Uint8Array) {
                    let datasym = this.dialect.datasymbol(c, f, e.id);
                    segment.allocateInitData(datasym, v);
                    let ptrlosym = this.dialect.fieldsymbol(c, f, 0);
                    let ptrhisym = this.dialect.fieldsymbol(c, f, 8);
                    let loofs = segment.allocateBytes(ptrlosym, entcount);
                    let hiofs = segment.allocateBytes(ptrhisym, entcount);
                    segment.initdata[loofs + e.id - range.elo] = { symbol: datasym, bitofs: 0 };
                    segment.initdata[hiofs + e.id - range.elo] = { symbol: datasym, bitofs: 8 };
                    // TODO: } else if (v instanceof Uint16Array) {
                } else if (typeof v === 'number') {
                    // more than 1 entity, add an array
                    if (range.ehi > range.elo) {
                        if (!range.access) throw new ECSError(`no access for field ${cfname}`)
                        let base = segment.allocateBytes(range.access[0].symbol, range.ehi-range.elo+1);
                        for (let a of range.access) {
                            let ofs = segment.getByteOffset(range, a, e.id);
                            segment.initdata[ofs] = v;
                        }
                    }
                    // TODO: what if mix of var, const, and init values?
                } else {
                    throw new ECSError(`unhandled constant ${e.id}:${cfname}`);
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
                if (!range) throw new ECSError(`no range`, e);
                if (!range.access) throw new ECSError(`no range access`, e);
                if (typeof initvalue === 'number') {
                    for (let a of range.access) {
                        let offset = segment.getByteOffset(range, a, e.id);
                        initbytes[offset] = (initvalue >> a.bit) & ((1 << a.width)-1);
                    }
                } else if (initvalue instanceof Uint8Array) {
                    // TODO???
                    let datasym = this.dialect.datasymbol(c, f, e.id);
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
    setConstValue(e: Entity, component: ComponentType, fieldName: string, value: DataValue) {
        let c = this.em.singleComponentWithFieldName([{etype: e.etype, cmatch:[component]}], fieldName, "setConstValue");
        e.consts[mksymbol(component, fieldName)] = value;
        if (this.em.symbols[mksymbol(component, fieldName)] == 'init')
            throw new ECSError(`Can't mix const and init values for a component field`, e);
        this.em.symbols[mksymbol(component, fieldName)] = 'const';
    }
    setInitValue(e: Entity, component: ComponentType, fieldName: string, value: DataValue) {
        let c = this.em.singleComponentWithFieldName([{etype: e.etype, cmatch:[component]}], fieldName, "setInitValue");
        e.inits[mkscopesymbol(this, component, fieldName)] = value;
        if (this.em.symbols[mksymbol(component, fieldName)] == 'const')
            throw new ECSError(`Can't mix const and init values for a component field`, e);
        this.em.symbols[mksymbol(component, fieldName)] = 'init';
    }
    generateCodeForEvent(event: string): string {
        // find systems that respond to event
        // and have entities in this scope
        let systems = this.em.event2systems[event];
        if (!systems || systems.length == 0) {
            // TODO: error or warning?
            console.log(`warning: no system responds to "${event}"`); return '';
            //throw new ECSError(`warning: no system responds to "${event}"`);
        }
        let s = this.dialect.code();
        //s += `\n; event ${event}\n`;
        let emitcode: { [event: string]: string } = {};
        for (let sys of systems) {
            // TODO: does this work if multiple actions?
            // TODO: should 'emits' be on action?
            if (sys.tempbytes) this.allocateTempBytes(sys.tempbytes);
            for (let action of sys.actions) {
                if (action.event == event) {
                    if (action.emits) {
                        for (let emit of action.emits) {
                            if (emitcode[emit]) {
                                console.log(`already emitted for ${sys.name}:${event}`);
                            }
                            //console.log('>', emit);
                            // TODO: cycles
                            emitcode[emit] = this.generateCodeForEvent(emit);
                            //console.log('<', emit, emitcode[emit].length);
                        }
                    }
                    // TODO: use Tokenizer so error msgs are better
                    let code = this.replaceCode(action.text, sys, action);
                    s += this.dialect.comment(`<action ${sys.name}:${event}>`);
                    s += code;
                    s += this.dialect.comment(`</action ${sys.name}:${event}>`);
                    // TODO: check that this happens once?
                }
            }
            if (sys.tempbytes) this.allocateTempBytes(-sys.tempbytes);
        }
        return s;
    }
    allocateTempBytes(n: number) {
        if (n > 0) this.tempOffset = this.tempSize;
        this.tempSize += n;
        this.maxTempBytes = Math.max(this.tempSize, this.maxTempBytes);
        if (n < 0) this.tempOffset = this.tempSize;
    }
    replaceCode(code: string, sys: System, action: Action): string {
        const tag_re = /\{\{(.+?)\}\}/g;
        const label_re = /@(\w+)\b/g;
        
        let label = `${sys.name}__${action.event}`; // TODO: better label that won't conflict (seq?)
        let atypes = this.em.archetypesMatching(action.query);
        let entities = this.entitiesMatching(atypes);
        // TODO: detect cycles
        // TODO: "source"?
        // TODO: what if only 1 item?
        let props : {[name: string] : string} = {};
        if (action.select == 'foreach') {
            code = this.wrapCodeInLoop(code, action, entities);
        }
        if (action.select == 'join' && action.join) {
            let jtypes = this.em.archetypesMatching(action.join);
            let jentities = this.entitiesMatching(jtypes);
            if (jentities.length == 0)
                throw new ECSError(`join query for ${label} doesn't match any entities`, action.join); // TODO 
            let joinfield = this.getJoinField(action, atypes, jtypes);
            // TODO: what if only 1 item?
            // TODO: should be able to access fields via Y reg
            code = this.wrapCodeInLoop(code, action, entities, joinfield);
            atypes = jtypes;
            entities = jentities;
            props['%joinfield'] = this.dialect.fieldsymbol(joinfield.c, joinfield.f, 0);
        }
        props['%efullcount'] = entities.length.toString();
        if (action.limit) {
            entities = entities.slice(0, action.limit);
        }
        if (entities.length == 0)
            throw new ECSError(`query for ${label} doesn't match any entities`, action.query); // TODO 
        // define properties
        props['%elo'] = entities[0].id.toString();
        props['%ehi'] = entities[entities.length - 1].id.toString();
        props['%ecount'] = entities.length.toString();
        // replace @labels
        code = code.replace(label_re, (s: string, a: string) => `${label}__${a}`);
        // replace {{...}} tags
        code = code.replace(tag_re, (entire, group: string) => {
            let cmd = group.charAt(0);
            let rest = group.substring(1);
            switch (cmd) {
                case '!': // emit event
                    return this.generateCodeForEvent(rest);
                case '.': // auto label
                case '@': // auto label
                    return `${label}_${rest}`;
                case '$': // temp byte (TODO: check to make sure not overflowing)
                    let tempinc = parseInt(rest);
                    if (isNaN(tempinc)) throw new ECSError(`bad temporary offset`, action);
                    if (!sys.tempbytes) throw new ECSError(`this system has no locals`, action);
                    if (tempinc < 0 || tempinc >= sys.tempbytes) throw new ECSError(`this system only has ${sys.tempbytes} locals`, action);
                    return `TEMP+${this.tempOffset}+${tempinc}`;
                case '=':
                    // TODO?
                case '<': // low byte
                    return this.generateCodeForField(sys, action, atypes, entities, rest, 0);
                case '>': // high byte
                    return this.generateCodeForField(sys, action, atypes, entities, rest, 8);
                case '(': // higher byte (TODO)
                    return this.generateCodeForField(sys, action, atypes, entities, rest, 16);
                case ')': // higher byte (TODO)
                    return this.generateCodeForField(sys, action, atypes, entities, rest, 24);
                case '^': // resource reference
                    return this.includeResource(rest);
                default:
                    let value = props[group];
                    if (value) return value;
                    else throw new ECSError(`unrecognized command {{${group}}} in ${entire}`);
            }
        });
        return code;
    }
    includeResource(symbol: string): string {
        this.resources.add(symbol);
        return symbol;
    }
    wrapCodeInLoop(code: string, action: Action, ents: Entity[], joinfield?: ComponentFieldPair): string {
        // TODO: check ents
        // TODO: check segment bounds
        // TODO: what if 0 or 1 entitites?
        let s = this.dialect.ASM_ITERATE_EACH;
        if (joinfield) s = this.dialect.ASM_ITERATE_JOIN;
        s = s.replace('{{%code}}', code);
        return s;
    }
    generateCodeForField(sys: System, action: Action,
        atypes: ArchetypeMatch[], entities: Entity[],
        fieldName: string, bitofs: number): string {
        
        var component : ComponentType;
        var qualified = false;
        // is qualified field?
        if (fieldName.indexOf(':') > 0) {
            let [cname,fname] = fieldName.split(':');
            component = this.em.getComponentByName(cname);
            fieldName = fname;
            qualified = true;
            if (component == null) throw new ECSError(`no component named "${cname}"`)
        } else {
            component = this.em.singleComponentWithFieldName(atypes, fieldName, `${sys.name}:${action.event}`);
        }
        // find archetypes
        let field = component.fields.find(f => f.name == fieldName);
        if (field == null) throw new ECSError(`no field named "${fieldName}" in component`)
        // see if all entities have the same constant value
        let constValues = new Set<DataValue>();
        for (let e of entities) {
            let constVal = e.consts[mksymbol(component, fieldName)];
            constValues.add(constVal); // constVal === undefined is allowed
        }
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
        let range = this.bss.getFieldRange(component, fieldName) || this.rodata.getFieldRange(component, fieldName);
        if (!range) throw new ECSError(`couldn't find field for ${component.name}:${fieldName}, maybe no entities?`); // TODO
        let eidofs = range.elo - entities[0].id;
        // TODO: dialect
        let ident = this.dialect.fieldsymbol(component, field, bitofs);
        if (qualified) {
            return this.dialect.absolute(ident);
        } else if (action.select == 'once') {
            if (entities.length != 1)
                throw new ECSError(`can't choose multiple entities for ${fieldName} with select=once`);
            return this.dialect.absolute(ident);
        } else {
            // TODO: right direction?
            if (eidofs > 0) {
                ident += '+' + eidofs;
            } else if (eidofs < 0) {
                ident += '' + eidofs;
            }
            return this.dialect.indexed_x(ident);
        }
    }
    analyzeEntities() {
        this.buildSegments();
        this.allocateSegment(this.bss, false);
        this.allocateSegment(this.rodata, true);
        this.allocateROData(this.rodata);
    }
    generateCode() {
        this.tempOffset = this.maxTempBytes = 0;
        this.code.addCodeFragment(this.dialect.TEMPLATE_INIT);
        let initcode = this.allocateInitData(this.bss);
        this.code.addCodeFragment(initcode);
        let start = this.generateCodeForEvent('start');
        this.code.addCodeFragment(start);
        for (let sub of Array.from(this.resources.values())) {
            let code = this.generateCodeForEvent(sub);
            this.code.addCodeFragment(code);
        }
    }
    dump(file: SourceFileExport) {
        file.text(this.dialect.HEADER); // TODO
        file.segment(`${this.name}_DATA`, 'bss');
        if (this.maxTempBytes) this.bss.allocateBytes('TEMP', this.maxTempBytes);
        this.bss.dump(file);
        file.segment(`${this.name}_RODATA`, 'rodata');
        this.rodata.dump(file);
        //file.segment(`${this.name}_CODE`, 'code');
        this.code.dump(file);
        file.text(this.dialect.FOOTER); // TODO
    }
}

export class EntityManager {
    archetypes: { [key: string]: EntityArchetype } = {};
    components: { [name: string]: ComponentType } = {};
    systems: { [name: string]: System } = {};
    scopes: { [name: string]: EntityScope } = {};
    symbols: { [name: string] : 'init' | 'const' } = {};
    event2systems: { [name: string]: System[] } = {};
    name2cfpairs: { [name: string]: ComponentFieldPair[]} = {};

    constructor(public readonly dialect: Dialect_CA65) {
    }
    newScope(name: string, parent?: EntityScope) {
        let scope = new EntityScope(this, this.dialect, name, parent);
        if (this.scopes[name]) throw new ECSError(`scope ${name} already defined`);
        this.scopes[name] = scope;
        return scope;
    }
    defineComponent(ctype: ComponentType) {
        if (this.components[ctype.name]) throw new ECSError(`component ${ctype.name} already defined`);
        for (let field of ctype.fields) {
            let list = this.name2cfpairs[field.name];
            if (!list) list = this.name2cfpairs[field.name] = [];
            list.push({c: ctype, f: field});
        }
        return this.components[ctype.name] = ctype;
    }
    defineSystem(system: System) {
        if (this.systems[system.name]) throw new ECSError(`system ${system.name} already defined`);
        for (let a of system.actions) {
            let event = a.event;
            let list = this.event2systems[event];
            if (list == null) list = this.event2systems[event] = [];
            if (!list.includes(system)) list.push(system);
        }
        return this.systems[system.name] = system;
    }
    addArchetype(atype: EntityArchetype) : EntityArchetype {
        let key = atype.components.map(c => c.name).join(',');
        if (this.archetypes[key])
            return this.archetypes[key];
        else
            return this.archetypes[key] = atype;
    }
    componentsMatching(q: Query, etype: EntityArchetype) {
        let list = [];
        for (let c of etype.components) {
            let cname = c.name;
            if (q.exclude?.includes(cname)) {
                return [];
            }
            // TODO: 0 includes == all entities?
            if (q.include.length == 0 || q.include.includes(cname)) {
                list.push(c);
            }
        }
        return list.length == q.include.length ? list : [];
    }
    archetypesMatching(q: Query) {
        let result: ArchetypeMatch[] = [];
        for (let etype of Object.values(this.archetypes)) {
            let cmatch = this.componentsMatching(q, etype);
            if (cmatch.length > 0) {
                result.push({ etype, cmatch });
            }
        }
        return result;
    }
    componentsWithFieldName(atypes: ArchetypeMatch[], fieldName: string) {
        // TODO???
        let comps = new Set<ComponentType>();
        for (let at of atypes) {
            for (let c of at.cmatch) {
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
    singleComponentWithFieldName(atypes: ArchetypeMatch[], fieldName: string, where: string) {
        let components = this.componentsWithFieldName(atypes, fieldName);
        // TODO: use name2cfpairs?
        if (components.length == 0) {
            throw new ECSError(`cannot find component with field "${fieldName}" in ${where}`);
        }
        if (components.length > 1) {
            throw new ECSError(`ambiguous field name "${fieldName}" in ${where}`);
        }
        return components[0];
    }
    toJSON() {
        return JSON.stringify({
            components: this.components,
            systems: this.systems
        })
    }
}
