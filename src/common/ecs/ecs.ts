
// entity scopes contain entities, and are nested
// also contain segments (code, bss, rodata)
// components and systems are global
// component fields are stored in arrays, range of entities, can be bit-packed
// some values can be constant, are stored in rodata (or loaded immediate)
// optional components? on or off
// union components? either X or Y or Z...
//
// systems receive and send events, execute code on entities
// systems are generated on a per-scope basis
// system queries can only contain entities from self and parent scopes
// starting from the 'init' event walk the event tree
// include systems that have at least 1 entity in scope (except init?)
//
// when entering scope, entities are initialized (zero or init w/ data)
// to change scope, fire event w/ scope name
// - how to handle bank-switching?
//
// helps with:
// - rapid prototyping w/ reasonable defaults
// - deconstructing objects into arrays
// - packing/unpacking bitfields
// - initializing objects
// - building lookup tables
// - selecting and iterating objects
// - managing events
// - managing memory and scope
// - converting assets to native formats?
// - removing unused data
//
// it's more convenient to have loops be zero-indexed
// for page cross, temp storage, etc
// should references be zero-indexed to a field, or global?
// should we limit # of entities passed to systems? min-max

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

export interface Entity {
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

export interface ComponentType {
    name: string;
    fields: DataField[];
    optional?: boolean;
}

export interface Query {
    include: string[]; // TODO: make ComponentType
    listen?: string[];
    exclude?: string[];
    updates?: string[];
}

export interface System {
    name: string;
    actions: Action[];
    tempbytes?: number;
}

export interface Action {
    text: string;
    event: string;
    query: Query;
    select: SelectType
    emits?: string[];
}

export type SelectType = 'once' | 'foreach' | 'source';

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
    {{code}}
    inx
    cpx #{{ecount}}
    bne @__each
`;
    readonly INIT_FROM_ARRAY = `
    ldy #{{nbytes}}
:   lda {{src}}-1,y
    sta {{dest}}-1,y
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
}

// TODO: merge with Dialect?
export class SourceFileExport {
    lines: string[] = [];

    comment(text: string) {
        this.lines.push(';' + text);
    }
    segment(seg: string, segtype: 'rodata' | 'bss') {
        if (segtype == 'bss') {
            this.lines.push(`.segment "ZEROPAGE"`); // TODO
        } else {
            this.lines.push(`.segment "CODE"`); // TODO
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

class Segment {
    symbols: { [sym: string]: number } = {};
    ofs2sym = new Map<number, string[]>();
    fieldranges: { [cfname: string]: FieldArray } = {};
    size: number = 0;
    initdata: (number | ConstByte | undefined)[] = [];
    codefrags: string[] = [];

    addCodeFragment(code: string) {
        this.codefrags.push(code);
    }
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
        for (let code of this.codefrags) {
            file.text(code);
        }
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
    getSegmentByteOffset(component: ComponentType, fieldName: string, bitofs: number, entityID: number) {
        let range = this.getFieldRange(component, fieldName);
        if (range && range.access) {
            let a = range.access[0]; // TODO: bitofs
            let ofs = this.symbols[a.symbol];
            if (ofs !== undefined) {
                return ofs + entityID - range.elo;
            }
        }
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

function getPackedFieldSize(f: DataType, constValue?: DataValue): number {
    if (f.dtype == 'int') {
        return getFieldBits(f);
    } if (f.dtype == 'array' && f.index) {
        return getPackedFieldSize(f.index) * getPackedFieldSize(f.elem);
    } if (f.dtype == 'array' && constValue != null && Array.isArray(constValue)) {
        return constValue.length * getPackedFieldSize(f.elem);
    } if (f.dtype == 'ref') {
        return 8; // TODO: > 256 entities?
    }
    return 0;
}

export class EntityScope {
    childScopes: EntityScope[] = [];
    entities: Entity[] = [];
    bss = new Segment();
    rodata = new Segment();
    code = new Segment();
    componentsInScope = new Set();
    tempOffset = 0;
    tempSize = 0;
    maxTempBytes = 0;
    subroutines = new Set<string>();

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
        let id = this.entities.length;
        let entity: Entity = { id, etype, consts: {}, inits: {} };
        this.em.archtypes.add(etype);
        for (let c of etype.components) {
            this.componentsInScope.add(c.name);
        }
        this.entities.push(entity);
        return entity;
    }
    *iterateFields() {
        for (let i = 0; i < this.entities.length; i++) {
            let e = this.entities[i];
            for (let c of e.etype.components) {
                for (let f of c.fields) {
                    yield { i, e, c, f, v: e.consts[mksymbol(c, f.name)] };
                }
            }
        }
    }
    buildSegments() {
        let iter = this.iterateFields();
        for (var o = iter.next(); o.value; o = iter.next()) {
            let { i, e, c, f, v } = o.value;
            let segment = v === undefined ? this.bss : this.rodata;
            let cfname = mksymbol(c, f.name);
            let array = segment.fieldranges[cfname];
            if (!array) {
                array = segment.fieldranges[cfname] = { component: c, field: f, elo: i, ehi: i };
            } else {
                array.ehi = i;
            }
            //console.log(i,array,cfname);
        }
    }
    allocateSegment(segment: Segment, readonly: boolean) {
        let fields = Object.values(segment.fieldranges);
        // TODO: fields.sort((a, b) => (a.ehi - a.elo + 1) * getPackedFieldSize(a.field));
        let f;
        while (f = fields.pop()) {
            let name = mksymbol(f.component, f.field.name);
            // TODO: doesn't work for packed arrays too well
            let bits = getPackedFieldSize(f.field);
            // variable size? make it a pointer
            if (bits == 0) bits = 16; // TODO?
            let rangelen = (f.ehi - f.elo + 1);
            let bytesperelem = Math.ceil(bits / 8);
            // TODO: packing bits
            // TODO: split arrays
            f.access = [];
            for (let i = 0; i < bits; i += 8) {
                let symbol = this.dialect.fieldsymbol(f.component, f.field, i);
                f.access.push({ symbol, bit: 0, width: 8 }); // TODO
                if (!readonly) {
                    segment.allocateBytes(symbol, rangelen * bytesperelem); // TODO
                }
            }
        }
    }
    allocateROData(segment: Segment) {
        let iter = this.iterateFields();
        for (var o = iter.next(); o.value; o = iter.next()) {
            let { i, e, c, f, v } = o.value;
            let cfname = mksymbol(c, f.name);
            let fieldrange = segment.fieldranges[cfname];
            if (v !== undefined) {
                let entcount = fieldrange.ehi - fieldrange.elo + 1;
                // is it a byte array?
                if (v instanceof Uint8Array) {
                    let datasym = this.dialect.datasymbol(c, f, e.id);
                    let ptrlosym = this.dialect.fieldsymbol(c, f, 0);
                    let ptrhisym = this.dialect.fieldsymbol(c, f, 8);
                    segment.allocateInitData(datasym, v);
                    let loofs = segment.allocateBytes(ptrlosym, entcount);
                    let hiofs = segment.allocateBytes(ptrhisym, entcount);
                    segment.initdata[loofs + e.id - fieldrange.elo] = { symbol: datasym, bitofs: 0 };
                    segment.initdata[hiofs + e.id - fieldrange.elo] = { symbol: datasym, bitofs: 8 };
                    // TODO: } else if (v instanceof Uint16Array) {
                } else if (typeof v === 'number') {
                    // more than 1 entity, add an array
                    // TODO: what if > 8 bits?
                    // TODO: what if mix of var, const, and init values?
                    if (fieldrange.ehi > fieldrange.elo) {
                        let datasym = this.dialect.fieldsymbol(c, f, 0);
                        let base = segment.allocateBytes(datasym, entcount);
                        segment.initdata[base + e.id - fieldrange.elo] = v;
                        //console.error(cfname, datasym, base, e.id, fieldrange.elo, entcount, v);
                    }
                } else {
                    throw new ECSError(`unhandled constant ${e.id}:${cfname}`);
                }
            }
        }
        //console.log(segment.initdata)
    }
    allocateInitData(segment: Segment) {
        let initbytes = new Uint8Array(segment.size);
        let iter = this.iterateFields();
        for (var o = iter.next(); o.value; o = iter.next()) {
            let { i, e, c, f, v } = o.value;
            let scfname = mkscopesymbol(this, c, f.name);
            let initvalue = e.inits[scfname];
            if (initvalue !== undefined) {
                let offset = segment.getSegmentByteOffset(c, f.name, 0, e.id);
                if (offset !== undefined && typeof initvalue === 'number') {
                    initbytes[offset] = initvalue; // TODO: > 8 bits?
                } else {
                    // TODO: init arrays?
                    throw new ECSError(`cannot initialize ${scfname}: ${offset} ${initvalue}`); // TODO??
                }
            }
        }
        // build the final init buffer
        // TODO: compress 0s?
        let bufsym = this.name + '__INITDATA';
        let bufofs = this.rodata.allocateInitData(bufsym, initbytes);
        let code = this.dialect.INIT_FROM_ARRAY;
        //TODO: function to repalce from dict?
        code = code.replace('{{nbytes}}', initbytes.length.toString())
        code = code.replace('{{src}}', bufsym);
        code = code.replace('{{dest}}', segment.getOriginSymbol());
        return code;
    }
    setConstValue(e: Entity, component: ComponentType, fieldName: string, value: DataValue) {
        let c = this.em.singleComponentWithFieldName([{etype: e.etype, cmatch:[component]}], fieldName, "setConstValue");
        e.consts[mksymbol(component, fieldName)] = value;
        if (this.em.symbols[mksymbol(component, fieldName)] == 'init')
            throw new ECSError(`Can't mix const and init values for a component field`);
        this.em.symbols[mksymbol(component, fieldName)] = 'const';
    }
    setInitValue(e: Entity, component: ComponentType, fieldName: string, value: DataValue) {
        let c = this.em.singleComponentWithFieldName([{etype: e.etype, cmatch:[component]}], fieldName, "setInitValue");
        e.inits[mkscopesymbol(this, component, fieldName)] = value;
        if (this.em.symbols[mksymbol(component, fieldName)] == 'const')
            throw new ECSError(`Can't mix const and init values for a component field`);
        this.em.symbols[mksymbol(component, fieldName)] = 'init';
    }
    generateCodeForEvent(event: string): string {
        // find systems that respond to event
        // and have entities in this scope
        let systems = this.getSystems([event]);
        if (systems.length == 0) {
            console.log(`; warning: no system responds to ${event}`); // TODO: warning
        }
        let s = '';
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
        const re = /\{\{(.+?)\}\}/g;
        let label = `${sys.name}__${action.event}`;
        let atypes = this.em.archetypesMatching(action.query);
        let entities = this.entitiesMatching(atypes);
        // TODO: detect cycles
        // TODO: "source"?
        // TODO: what if only 1 item?
        if (action.select == 'foreach') {
            code = this.wrapCodeInLoop(code, sys, action, entities);
            //console.log(sys.name, action.event, ents);
            //frag = this.iterateCode(frag);
        }
        // replace @labels
        code = code.replace(/@(\w+)\b/g, (s: string, a: string) => `${label}__${a}`);
        // replace {{...}} tags
        return code.replace(re, (entire, group: string) => {
            let cmd = group.charAt(0);
            let rest = group.substring(1);
            switch (cmd) {
                case '!': // emit event
                    return this.generateCodeForEvent(rest);
                case '.': // auto label
                case '@': // auto label
                    return `${label}_${rest}`;
                case '$': // temp byte
                    return `TEMP+${this.tempOffset}+${rest}`;
                case '=':
                    // TODO?
                case '<': // low byte
                    return this.generateCodeForField(sys, action, atypes, entities, rest, 0);
                case '>': // high byte
                    return this.generateCodeForField(sys, action, atypes, entities, rest, 8);
                case '^': // subroutine reference
                    return this.includeSubroutine(rest);
                default:
                    throw new ECSError(`unrecognized command ${cmd} in ${entire}`);
            }
        });
    }
    includeSubroutine(symbol: string): string {
        this.subroutines.add(symbol);
        return symbol;
    }
    wrapCodeInLoop(code: string, sys: System, action: Action, ents: Entity[]): string {
        // TODO: check ents
        // TODO: check segment bounds
        let s = this.dialect.ASM_ITERATE_EACH;
        s = s.replace('{{elo}}', ents[0].id.toString());
        s = s.replace('{{ehi}}', ents[ents.length - 1].id.toString());
        s = s.replace('{{ecount}}', ents.length.toString());
        s = s.replace('{{code}}', code);
        return s;
    }
    generateCodeForField(sys: System, action: Action,
        atypes: ArchetypeMatch[], entities: Entity[],
        fieldName: string, bitofs: number): string {
        
        var component : ComponentType;
        var qualified = false;
        // is qualified field?
        if (fieldName.indexOf('.') > 0) {
            let [cname,fname] = fieldName.split('.');
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
                if (bitofs == 0) return `#<${value}`;
                if (bitofs == 8) return `#>${value}`;
                // TODO: bitofs?
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
    entitiesMatching(atypes: ArchetypeMatch[]) {
        let result : Entity[] = [];
        for (let e of this.entities) {
            for (let a of atypes) {
                // TODO: what about subclasses?
                if (e.etype == a.etype) {
                    result.push(e);
                    break;
                }
            }
        }
        return result;
    }
    getSystems(events: string[]) {
        let result : System[] = [];
        for (let sys of Object.values(this.em.systems)) {
            if (this.systemListensTo(sys, events)) {
                result.push(sys);
            }
        }
        return result;
    }
    systemListensTo(sys: System, events: string[]) {
        for (let action of sys.actions) {
            if (action.event != null && events.includes(action.event)) {
                let archs = this.em.archetypesMatching(action.query);
                for (let arch of archs) {
                    for (let ctype of arch.cmatch) {
                        if (this.hasComponent(ctype)) {
                            return true;
                        }
                    }
                }
            }
        }
    }
    hasComponent(ctype: ComponentType) {
        return this.componentsInScope.has(ctype.name);
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
        for (let sub of Array.from(this.subroutines.values())) {
            let code = this.generateCodeForEvent(sub);
            this.code.addCodeFragment(code);
        }
    }
    dump(file: SourceFileExport) {
        file.text(this.dialect.HEADER); // TODO
        file.segment(`${this.name}_DATA`, 'bss');
        if (this.maxTempBytes) this.bss.allocateBytes('TEMP', this.maxTempBytes);
        this.bss.dump(file);
        file.segment(`${this.name}_CODE`, 'rodata');
        this.rodata.dump(file);
        this.code.dump(file);
        file.text(this.dialect.FOOTER); // TODO
    }
}

export class EntityManager {
    archtypes = new Set<EntityArchetype>();
    components: { [name: string]: ComponentType } = {};
    systems: { [name: string]: System } = {};
    scopes: { [name: string]: EntityScope } = {};
    symbols: { [name: string] : 'init' | 'const' } = {};

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
        return this.components[ctype.name] = ctype;
    }
    defineSystem(system: System) {
        if (this.systems[system.name]) throw new ECSError(`system ${system.name} already defined`);
        return this.systems[system.name] = system;
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
        this.archtypes.forEach(etype => {
            let cmatch = this.componentsMatching(q, etype);
            if (cmatch.length > 0) {
                result.push({ etype, cmatch });
            }
        });
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
