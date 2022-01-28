
import * as YAML from "js-yaml";

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

function mksymbol(c: ComponentType, fieldName: string) {
    return c.name + '_' + fieldName;
}
function mkscopesymbol(s: EntityScope, c: ComponentType, fieldName: string) {
    return s.name + '_' + c.name + '_' + fieldName;
}

export interface Entity {
    id: number;
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
    include: string[];
    listen?: string[];
    exclude?: string[];
    updates?: string[];
}

export interface System {
    name: string;
    actions: Action[];
    tempbytes?: number;
    emits?: string[];
}

export interface Action {
    text: string;
    event: string;
    query: Query;
    select: 'once' | 'each' | 'source'
}

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

class Dialect_CA65 {
    readonly ASM_ITERATE_EACH = `
    ldx #0
%{@__each}:
    %{code}
    inx
    cpx #%{ecount}
    bne %{@__each}
`;
    readonly INIT_FROM_ARRAY = `
    ldy #%{nbytes}
:
    lda %{src}-1,y
    sta %{dest}-1,y
    dey
    bne -
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
}

class SourceFileExport {
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
            if (b < 0 || b > 255) throw new Error(`out of range byte ${b}`);
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
        if (this.symbols[name]) return this.symbols[name]; // TODO: check size
        let ofs = this.size;
        this.symbols[name] = ofs;
        if (!this.ofs2sym.has(ofs))
            this.ofs2sym.set(ofs, []);
        this.ofs2sym.get(ofs)?.push(name);
        this.size += bytes;
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
        if (!a) throw new Error('getOriginSymbol');
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
        fields.sort((a, b) => (a.ehi - a.elo + 1) * getPackedFieldSize(a.field));
        let f;
        while (f = fields.pop()) {
            let name = mksymbol(f.component, f.field.name);
            // TODO: doesn't work for packed arrays too well
            let bits = getPackedFieldSize(f.field);
            // variable size? make it a pointer
            if (bits == 0) bits = 16; // TODO?
            let rangelen = (f.ehi - f.elo + 1);
            let bytesperelem = Math.ceil(bits / 8) * rangelen;
            // TODO: packing bits
            // TODO: split arrays
            f.access = [];
            for (let i = 0; i < bits; i += 8) {
                let symbol = name + '_b' + i;
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
                    let datasym = `${c.name}_${f.name}_e${e.id}`;
                    let ptrlosym = `${c.name}_${f.name}_b0`;
                    let ptrhisym = `${c.name}_${f.name}_b8`;
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
                        let datasym = `${c.name}_${f.name}_b0`;
                        let base = segment.allocateBytes(datasym, entcount);
                        segment.initdata[base + e.id - fieldrange.elo] = v;
                    }
                } else {
                    throw new Error(`unhandled constant ${e.id}:${cfname}`);
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
                    throw new Error(`cannot access ${scfname}`);
                }
            }
        }
        // build the final init buffer
        // TODO: compress 0s?
        let bufsym = this.name + '__INITDATA';
        let bufofs = this.rodata.allocateInitData(bufsym, initbytes);
        let code = this.dialect.INIT_FROM_ARRAY;
        //TODO: function to repalce from dict?
        code = code.replace('%{nbytes}', initbytes.length.toString())
        code = code.replace('%{src}', bufsym);
        code = code.replace('%{dest}', segment.getOriginSymbol());
        return code;
    }
    setConstValue(e: Entity, component: ComponentType, fieldName: string, value: DataValue) {
        // TODO: check to make sure component exists
        e.consts[mksymbol(component, fieldName)] = value;
    }
    setInitValue(e: Entity, component: ComponentType, fieldName: string, value: DataValue) {
        // TODO: check to make sure component exists
        e.inits[mkscopesymbol(this, component, fieldName)] = value;
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
            if (sys.tempbytes) this.allocateTempBytes(sys.tempbytes);
            if (sys.emits) {
                for (let emit of sys.emits) {
                    if (emitcode[emit]) {
                        console.log(`already emitted for ${sys.name}:${event}`);
                    }
                    //console.log('>', emit);
                    // TODO: cycles
                    emitcode[emit] = this.generateCodeForEvent(emit);
                    //console.log('<', emit, emitcode[emit].length);
                }
            }
            if (sys.tempbytes) this.allocateTempBytes(-sys.tempbytes);
            for (let action of sys.actions) {
                if (action.event == event) {
                    let code = this.replaceCode(action.text, sys, action);
                    s += `\n; <action ${sys.name}:${event}>\n`;
                    s += code;
                    s += `\n; </action ${sys.name}:${event}>\n`;
                    // TODO: check that this happens once?
                }
            }
        }
        return s;
    }
    allocateTempBytes(n: number) {
        this.tempOffset += n;
        this.maxTempBytes = Math.max(this.tempOffset, this.maxTempBytes);
    }
    replaceCode(code: string, sys: System, action: Action): string {
        const re = /\%\{(.+?)\}/g;
        let label = sys.name + '_' + action.event;
        let atypes = this.em.archetypesMatching(action.query);
        let entities = this.entitiesMatching(atypes);
        // TODO: detect cycles
        // TODO: "source"?
        if (action.select == 'each') {
            code = this.wrapCodeInLoop(code, sys, action, entities);
            //console.log(sys.name, action.event, ents);
            //frag = this.iterateCode(frag);
        }
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
                case '^': // reference
                    return this.includeSubroutine(rest);
                default:
                    //throw new Error(`unrecognized command ${cmd} in ${entire}`);
                    console.log(`unrecognized command ${cmd} in ${entire}`);
                    return entire;
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
        s = s.replace('%{elo}', ents[0].id.toString());
        s = s.replace('%{ehi}', ents[ents.length - 1].id.toString());
        s = s.replace('%{ecount}', ents.length.toString());
        s = s.replace('%{code}', code);
        return s;
    }
    generateCodeForField(sys: System, action: Action,
        atypes: ArchetypeMatch[], entities: Entity[],
        fieldName: string, bitofs: number): string {
        // find archetypes
        let component = this.em.componentWithFieldName(atypes, fieldName);
        if (!component) {
            throw new Error(`cannot find component with field "${fieldName}" in ${sys.name}:${action.event}`);
        }
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
        //let range = this.bss.getFieldRange(component, fieldName);
        // TODO: dialect
        if (action.select == 'once') {
            if (entities.length != 1)
                throw new Error(`can't choose multiple entities for ${fieldName} with select=once`);
            return `${component.name}_${fieldName}_b${bitofs}` // TODO? check there's only 1 entity?
        } else {
            return `${component.name}_${fieldName}_b${bitofs},x` // TODO? ,x?
        }
    }
    entitiesMatching(atypes: ArchetypeMatch[]) {
        let result = [];
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
        let result = [];
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
    dialect = new Dialect_CA65();
    archtypes = new Set<EntityArchetype>();
    components: { [name: string]: ComponentType } = {};
    systems: { [name: string]: System } = {};
    scopes: { [name: string]: EntityScope } = {};

    newScope(name: string, parent?: EntityScope) {
        let scope = new EntityScope(this, this.dialect, name, parent);
        if (this.scopes[name]) throw new Error(`scope ${name} already defined`);
        this.scopes[name] = scope;
        return scope;
    }
    defineComponent(ctype: ComponentType) {
        if (this.components[ctype.name]) throw new Error(`component ${ctype.name} already defined`);
        return this.components[ctype.name] = ctype;
    }
    defineSystem(system: System) {
        if (this.systems[system.name]) throw new Error(`system ${system.name} already defined`);
        this.systems[system.name] = system;
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
    componentWithFieldName(atypes: ArchetypeMatch[], fieldName: string) {
        // TODO???
        for (let at of atypes) {
            for (let c of at.cmatch) {
                for (let f of c.fields) {
                    if (f.name == fieldName)
                        return c;
                }
            }
        }
    }
    toYAML() {
        return YAML.dump({
            components: this.components,
            systems: this.systems,
        })
    }
}

///

const TEMPLATE1 = `
%{@NextFrame}:
    FRAME_START
    %{!preframe}
    KERNEL_START
    %{!kernel}
    KERNEL_END
    %{!postframe}
    FRAME_END
    lsr SWCHB	    ; test Game Reset switch
    bcs @NoStart
    jmp Start
@NoStart:
    jmp %{@NextFrame}
`;

// TODO: two sticks?
const TEMPLATE2_a = `
    lda SWCHA
    sta %{$0}
`
const TEMPLATE2_b = `
    asl %{$0}
    bcs %{@SkipMoveRight}
    %{!joyright}
%{@SkipMoveRight}:
    asl %{$0}
    bcs %{@SkipMoveLeft}
    %{!joyleft}
%{@SkipMoveLeft}:
    asl %{$0}
    bcs %{@SkipMoveDown}
    %{!joydown}
%{@SkipMoveDown}:
    asl %{$0}
    bcs %{@SkipMoveUp}
    %{!joyup}
%{@SkipMoveUp}:
`;

const TEMPLATE3_L = `
    lda %{<xpos}
    sec
    sbc #1
    bcc %{@nomove}
    sta %{<xpos}
%{@nomove}:
`;

const TEMPLATE3_R = `
    lda %{<xpos}
    clc
    adc #1
    cmp #150
    bcs %{@nomove}
    sta %{<xpos}
%{@nomove}:
`;

const TEMPLATE3_U = `
    lda %{<ypos}
    sec
    sbc #1
    bcc %{@nomove}
    sta %{<ypos}
%{@nomove}:
`;

const TEMPLATE3_D = `
    lda %{<ypos}
    clc
    adc #1
    cmp #150
    bcs %{@nomove}
    sta %{<ypos}
%{@nomove}:
`;

const TEMPLATE4_S1 = `
.macro %{@KernelSetup} ent,ofs
    lda #192 ; TODO: numlines
    sec
    sbc ypos_ypos_b0+ent
    sta %{$5}+ofs

    ldy hasbitmap_bitmap_b0+ent
    lda bitmap_bitmapdata_b0,y
    sec
    sbc %{$5}+ofs
    sta %{$0}+ofs
    lda bitmap_bitmapdata_b8,y
    sbc #0
    sta %{$1}+ofs

    ldy hascolormap_colormap_b0+ent
    lda colormap_colormapdata_b0,y
    sec
    sbc %{$5}+ofs
    sta %{$2}+ofs
    lda colormap_colormapdata_b8,y
    sbc #0
    sta %{$3}+ofs

    lda sprite_height_b0+ent
    sta %{$4}+ofs
    lda ypos_ypos_b0+ent
    sta %{$5}+ofs
.endmacro
`
const TEMPLATE4_S2 = `
    %{@KernelSetup} 0,0
    %{@KernelSetup} 1,6
`

// https://atariage.com/forums/topic/75982-skipdraw-and-graphics/?tab=comments#comment-928232
// https://atariage.com/forums/topic/129683-advice-on-a-masking-kernel/
// https://atariage.com/forums/topic/128147-having-trouble-with-2-free-floating-player-graphics/?tab=comments#comment-1547059
const TEMPLATE4_K = `
    lda %{<bgcolor}
    sta COLUBK
    ldy %{<lines}
@LVScan:
    lda %{$4} ; height
    dcp %{$5}
    bcs @DoDraw1
    lda #0
    .byte $2C
@DoDraw1:
    lda (%{$0}),y
    sta WSYNC
    sta GRP0
    lda (%{$2}),y
    sta COLUP0

    lda %{$10} ; height
    dcp %{$11}
    bcs @DoDraw2
    lda #0
    .byte $2C
@DoDraw2:
    lda (%{$6}),y
    sta GRP1
    lda (%{$8}),y
    sta COLUP1

    dey		; decrement
    bne @LVScan	; repeat until 192 lines
`;

const SET_XPOS = `
    lda %{<xpos}
    ldy %{<plyrindex}
    sta HMCLR
    jsr %{^SetHorizPos}
`

const SETHORIZPOS = `
; SetHorizPos routine
; A = X coordinate
; Y = player number (0 or 1)
SetHorizPos:
	sta WSYNC	; start a new line
	sec		    ; set carry flag
    nop
@DivideLoop:
	sbc #15		; subtract 15
	bcs @DivideLoop	; branch until negative
	eor #7		; calculate fine offset
	asl
	asl
	asl
	asl
	sta RESP0,y	; fix coarse position
	sta HMP0,y	; set fine offset
    sta WSYNC
    sta HMOVE
	rts		; return to caller
`

const INITFROMSPARSE = `
MemSrc equ $80
MemDest equ $82
InitMemory:
	ldy #0
	lda (MemSrc),y
        beq .done
        tax
        iny
	lda (MemSrc),y
        sta MemDest
        iny
	lda (MemSrc),y
        sta MemDest+1
.loop
        iny
        lda (MemSrc),y
        sta (MemDest),y
        dex
        bne .loop
.done	rts
`


function test() {
    let em = new EntityManager();

    let c_kernel = em.defineComponent({
        name: 'kernel', fields: [
            { name: 'lines', dtype: 'int', lo: 0, hi: 255 },
            { name: 'bgcolor', dtype: 'int', lo: 0, hi: 255 },
        ]
    })
    let c_sprite = em.defineComponent({
        name: 'sprite', fields: [
            { name: 'height', dtype: 'int', lo: 0, hi: 255 },
            { name: 'plyrindex', dtype: 'int', lo: 0, hi: 1 },
        ]
    })
    let c_plyrflags = em.defineComponent({
        name: 'nusizable', fields: [
            { name: 'plyrflags', dtype: 'int', lo: 0, hi: 63 },
        ]
    })
    let c_player = em.defineComponent({
        name: 'player', fields: [
            //TODO: optional?
        ]
    })
    let c_hasbitmap = em.defineComponent({
        name: 'hasbitmap', fields: [
            { name: 'bitmap', dtype: 'ref', query: { include: ['bitmap'] } },
        ]
    })
    let c_hascolormap = em.defineComponent({
        name: 'hascolormap', fields: [
            { name: 'colormap', dtype: 'ref', query: { include: ['colormap'] } },
        ]
    })
    let c_bitmap = em.defineComponent({
        name: 'bitmap', fields: [
            { name: 'bitmapdata', dtype: 'array', elem: { dtype: 'int', lo: 0, hi: 255 } }
        ]
    })
    let c_colormap = em.defineComponent({
        name: 'colormap', fields: [
            { name: 'colormapdata', dtype: 'array', elem: { dtype: 'int', lo: 0, hi: 255 } }
        ]
    })
    let c_xpos = em.defineComponent({
        name: 'xpos', fields: [
            { name: 'xpos', dtype: 'int', lo: 0, hi: 255 }
        ]
    })
    let c_ypos = em.defineComponent({
        name: 'ypos', fields: [
            { name: 'ypos', dtype: 'int', lo: 0, hi: 255 }
        ]
    })
    let c_xyvel = em.defineComponent({
        name: 'xyvel', fields: [
            { name: 'xvel', dtype: 'int', lo: -8, hi: 7 },
            { name: 'yvel', dtype: 'int', lo: -8, hi: 7 }
        ]
    })

    // init -> [start] -> frameloop
    // frameloop -> [preframe] [kernel] [postframe]

    // temp between preframe + frame?
    // TODO: check names for identifierness
    em.defineSystem({
        name: 'kernel_simple',
        tempbytes: 8,
        actions: [
            {
                text: TEMPLATE4_S1, event: 'preframe', select: 'once', query: {
                    include: ['kernel']
                }
            },
            {
                // TODO: should include kernel for numlines
                text: TEMPLATE4_S2, event: 'preframe', select: 'once', query: {
                    include: ['sprite', 'hasbitmap', 'hascolormap', 'ypos'],
                },
            },
            {
                text: TEMPLATE4_K, event: 'kernel', select: 'once', query: {
                    include: ['kernel']
                }
            },
        ]
    })
    em.defineSystem({
        name: 'set_xpos',
        actions: [
            {
                text: SET_XPOS, event: 'preframe', select: 'each', query: {
                    include: ['sprite', 'xpos']
                },
            },
            //{ text:SETHORIZPOS },
        ]
    })
    // https://docs.unity3d.com/Packages/com.unity.entities@0.17/manual/ecs_systems.html
    em.defineSystem({
        name: 'frameloop',
        emits: ['preframe', 'kernel', 'postframe'],
        actions: [
            { text: TEMPLATE1, event: 'start', select: 'once', query: { include: ['kernel'] } }
        ]
    })
    em.defineSystem({
        name: 'joyread',
        tempbytes: 1,
        emits: ['joyup', 'joydown', 'joyleft', 'joyright', 'joybutton'],
        actions: [
            { text: TEMPLATE2_a, event: 'postframe', select: 'once', query: { include: ['player'] } },
            { text: TEMPLATE2_b, event: 'postframe', select: 'each', query: { include: ['player'] } }
        ]
    });
    em.defineSystem({
        name: 'move_x',
        actions: [
            { text: TEMPLATE3_L, event: 'joyleft', select: 'source', query: { include: ['player', 'xpos'] }, },
            { text: TEMPLATE3_R, event: 'joyright', select: 'source', query: { include: ['player', 'xpos'] }, },
        ]
    });
    em.defineSystem({
        name: 'move_y',
        actions: [
            { text: TEMPLATE3_U, event: 'joyup', select: 'source', query: { include: ['player', 'ypos'] } },
            { text: TEMPLATE3_D, event: 'joydown', select: 'source', query: { include: ['player', 'ypos'] } },
        ]
    });
    em.defineSystem({
        name: 'SetHorizPos',
        actions: [
            { text: SETHORIZPOS, event: 'SetHorizPos', select: 'once', query: { include: ['xpos'] } },
        ]
    });

    let root = em.newScope("Root");
    let scene = em.newScope("Scene", root);
    let e_ekernel = root.newEntity({ components: [c_kernel] });
    root.setConstValue(e_ekernel, c_kernel, 'lines', 192);
    //root.setConstValue(e_ekernel, c_kernel, 'bgcolor', 0x92);
    root.setInitValue(e_ekernel, c_kernel, 'bgcolor', 0x92);

    let e_bitmap0 = root.newEntity({ components: [c_bitmap] });
    // TODO: store array sizes?
    root.setConstValue(e_bitmap0, c_bitmap, 'bitmapdata', new Uint8Array([1, 1, 3, 7, 15, 31, 63, 127]));

    let e_colormap0 = root.newEntity({ components: [c_colormap] });
    root.setConstValue(e_colormap0, c_colormap, 'colormapdata', new Uint8Array([6, 3, 6, 9, 12, 14, 31, 63]));

    let ea_playerSprite = { components: [c_sprite, c_hasbitmap, c_hascolormap, c_xpos, c_ypos, c_player] };
    let e_player0 = root.newEntity(ea_playerSprite);
    root.setConstValue(e_player0, c_sprite, 'plyrindex', 0);
    root.setInitValue(e_player0, c_sprite, 'height', 8);
    root.setInitValue(e_player0, c_xpos, 'xpos', 50);
    root.setInitValue(e_player0, c_ypos, 'ypos', 50);
    let e_player1 = root.newEntity(ea_playerSprite);
    root.setConstValue(e_player1, c_sprite, 'plyrindex', 1);
    root.setInitValue(e_player1, c_sprite, 'height', 8);
    root.setInitValue(e_player1, c_xpos, 'xpos', 100);
    root.setInitValue(e_player1, c_ypos, 'ypos', 60);

    //console.log(em.archetypesMatching({ include:['xpos','ypos']})[0])

    let src = new SourceFileExport();
    root.analyzeEntities();
    root.generateCode();
    root.dump(src);
    console.log(src.toString());
    //console.log(em.toYAML());
}

// TODO: files in markdown?
// TODO: jsr OperModeExecutionTree?

test();

