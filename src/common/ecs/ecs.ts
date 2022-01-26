
// entity scopes contain entities, and are nested
// also contain segments (code, bss, rodata)
// components and systems are global
// component fields are stored in arrays, range of entities, can be bit-packed
// some values can be constant, are stored in rodata (or loaded immediate)
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

export interface Entity {
    id: number;
    etype: EntityArchetype;
    consts: {[name: string]: DataValue};
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
    query: Query;
    tempbytes?: number;
    actions: CodeFragment[];
    emits?: string[];
    live?: EntityArchetype[] | null;
}

export interface CodeFragment {
    text: string;
    event: string;
    iterate: 'once' | 'each'
}

export type DataValue = number | boolean | Uint8Array;

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

class SourceFileExport {
    lines : string[] = [];

    comment(text: string) {
        this.lines.push(';' + text);
    }
    segment(seg: string, segtype: 'rodata' | 'bss') {
        if (segtype == 'bss')
            this.lines.push(` seg.u ${seg}`);
        else
            this.lines.push(` seg ${seg}`);
    }
    label(sym: string) {
        this.lines.push(`${sym}:`);
    }
    byte(b: number | ConstByte | undefined) {
        if (b === undefined) {
            this.lines.push(` .ds 1`);
        } else if (typeof b === 'number') {
            if (b < 0 || b > 255) throw new Error(`out of range byte ${b}`);
            this.lines.push(` .byte ${b}`)
        } else {
            this.lines.push(` .byte (${b.symbol} >> ${b.bitofs}) & 0xff`)
        }
    }
    toString() {
        return this.lines.join('\n');
    }
}

class Segment {
    symbols: {[sym: string]: number} = {};
    ofs2sym = new Map<number,string[]>();
    fieldranges: {[cfname: string]: FieldArray} = {};
    size: number = 0;
    initdata: (number | ConstByte | undefined)[] = [];

    allocateBytes(name: string, bytes: number) {
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
        for (let i=0; i<bytes.length; i++) {
            this.initdata[ofs + i] = bytes[i];
        }
    }
    dump(file: SourceFileExport) {
        for (let i=0; i<this.size; i++) {
            let syms = this.ofs2sym.get(i);
            if (syms) {
                for (let sym of syms) file.label(sym);
            }
            file.byte(this.initdata[i]);
        }
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

const ASM_ITERATE_EACH = `
    ldx #%{elo}
.loop:
    %{action}
    inx
    cpx #%{ehi}+1
    bne .loop
`;

export class EntityScope {
    childScopes : EntityScope[] = [];
    entities : Entity[] = [];
    bss = new Segment();
    rodata = new Segment();
    code = new Segment();
    componentsInScope = new Set();

    constructor(
        public readonly em: EntityManager,
        public readonly name: string,
        public readonly parent: EntityScope | undefined
    ) {
        parent?.childScopes.push(this);
    }
    newEntity(etype: EntityArchetype) : Entity {
        // TODO: add parent ID? lock parent scope?
        let id = this.entities.length;
        let entity : Entity = {id, etype, consts:{}};
        this.em.archtypes.add(etype);
        for (let c of etype.components) {
            this.componentsInScope.add(c.name);
        }
        this.entities.push(entity);
        return entity;
    }
    *iterateFields() {
        for (let i=0; i<this.entities.length; i++) {
            let e = this.entities[i];
            for (let c of e.etype.components) {
                for (let f of c.fields) {
                    yield {i, e, c, f, v:e.consts[c.name + '.' + f.name]};
                }
            }
        }
    }
    analyzeEntities() {
        this.buildSegments();
        this.allocateSegment(this.bss, false);
        this.allocateSegment(this.rodata, true);
        this.allocateROData(this.rodata);
    }
    buildSegments() {
        let iter = this.iterateFields();
        for (var o=iter.next(); o.value; o=iter.next()) {
            let {i,e,c,f,v} = o.value;
            let segment = v === undefined ? this.bss : this.rodata;
            let cfname = c.name + '.' + f.name;
            let array = segment.fieldranges[cfname];
            if (!array) {
                array = segment.fieldranges[cfname] = {component:c, field:f, elo:i, ehi:i};
            } else {
                array.ehi = i;
            }
            //console.log(i,array,cfname);
        }
    }
    allocateSegment(segment: Segment, readonly: boolean) {
        let fields = Object.values(segment.fieldranges);
        fields.sort((a,b) => (a.ehi - a.elo + 1) * getPackedFieldSize(a.field));
        let f;
        while (f = fields.pop()) {
            let name = f.component.name + "_" + f.field.name;
            // TODO: doesn't work for packed arrays too well
            let bits = getPackedFieldSize(f.field);
            // variable size? make it a pointer
            if (bits == 0) bits = 16;
            let rangelen = (f.ehi - f.elo + 1);
            let bytesperelem = Math.ceil(bits/8) * rangelen;
            // TODO: packing bits
            // TODO: split arrays
            f.access = [];
            for (let i=0; i<bits; i+=8) {
                let symbol = name + '_b' + i;
                f.access.push({symbol, bit:0, width:8}); // TODO
                if (!readonly) {
                    segment.allocateBytes(symbol, rangelen * bytesperelem); // TODO
                }
            }
        }
    }
    allocateROData(segment: Segment) {
        let iter = this.iterateFields();
        for (var o=iter.next(); o.value; o=iter.next()) {
            let {i,e,c,f,v} = o.value;
            let cfname = c.name + '.' + f.name;
            let fieldrange = segment.fieldranges[cfname];
            if (v !== undefined) {
                // is it a byte array?
                if (v instanceof Uint8Array) {
                    let sym = c.name + '_' + f.name;
                    segment.allocateInitData(sym, v);
                } else if (fieldrange.ehi > fieldrange.elo) {
                    // more than one element, add an array
                    // TODO
                }
                //console.log(cfname, i, v, fieldrange);
                //segment.allocateInitData(cfname, );
            }
        }
        //console.log(segment.initdata)
    }
    setConstValue(e: Entity, component: ComponentType, fieldName: string, value: DataValue) {
        e.consts[component.name + '.' + fieldName] = value;
    }
    dump(file: SourceFileExport) {
        file.segment(`${this.name}_CODE`, 'rodata');
        this.rodata.dump(file);
        file.segment(`${this.name}_DATA`, 'bss');
        this.bss.dump(file);
    }
    generateCode() {
        let code = this.generateCodeForEvent('init');
        console.log(code);
    }
    generateCodeForEvent(event: string): string {
        // find systems that respond to event
        // and have entities in this scope
        let systems = this.getSystems([event]);
        if (systems.length == 0) {
            console.log(`no system responds to ${event}`); // TODO: warning
        }
        let s = '';
        //s += `\n; event ${event}\n`;
        let emitcode : {[event: string] : string} = {};
        for (let sys of systems) {
            if (sys.emits) {
                for (let emit of sys.emits) {
                    //console.log('>', emit);
                    // TODO: cycles
                    emitcode[emit] = this.generateCodeForEvent(emit);
                    //console.log('<', emit, emitcode[emit].length);
                }
            }
            for (let action of sys.actions) {
                let code = action.text;
                if (action.event == event) {
                    // TODO: find loops
                    if (action.iterate == 'each') {
                        let ents = this.entitiesMatching(sys.query);
                        console.log(sys.name, action.event, ents);
                        //frag = this.iterateCode(frag);
                    }
                    // TODO: better parser of ${}
                    for (let [k,v] of Object.entries(emitcode)) {
                        let frag = v;
                        code = code.replace(`%{${k}}`, frag);
                    }
                    // anything not replaced?
                    let unused = /\%\{.+?\}/.exec(code);
                    if (unused) {
                        //throw new Error(`${sys.name}:${action.event} did not replace ${unused[0]}`);
                    }
                    // TODO: check that this happens once?
                    s += `\n; action ${sys.name}:${action.event}\n`;
                    s += code;
                }
            }                
        }
        return s;
    }
    entitiesMatching(q: Query) {
        let result = [];
        let atypes = this.em.archetypesMatching(q);
        for (let e of this.entities) {
            for (let a of atypes) {
                if (e.etype == a.etype)
                    result.push(e);
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
                let archs = this.em.archetypesMatching(sys.query);
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
}

export class EntityManager {
    archtypes = new Set<EntityArchetype>();
    components : {[name: string]: ComponentType} = {};
    systems : {[name: string]: System} = {};
    scopes : {[name: string]: EntityScope} = {};

    newScope(name: string, parent?: EntityScope) {
        let scope = new EntityScope(this, name, parent);
        if (this.scopes[name]) throw new Error(`scope ${name} already defined`);
        this.scopes[name] = scope;
        return scope;
    }
    defineComponent(ctype: ComponentType) {
        if (this.components[ctype.name]) throw new Error(`component ${name} already defined`);
        return this.components[ctype.name] = ctype;
    }
    defineSystem(system: System) {
        if (this.systems[system.name]) throw new Error(`system ${name} already defined`);
        this.systems[system.name] = system;
    }
    componentsMatching(q: Query, etype: EntityArchetype) {
        let list = [];
        for (let c of etype.components) {
            let cname = c.name;
            // TODO: 0 includes == all entities?
            if (q.include.length == 0 || q.include.includes(cname)) {
                if (!q.exclude?.includes(cname)) {
                    list.push(c);
                }
            }
        }
        return list;
    }
    archetypesMatching(q: Query) {
        let result : {etype: EntityArchetype, cmatch: ComponentType[]}[] = [];
        this.archtypes.forEach(etype => {
            let cmatch = this.componentsMatching(q, etype);
            if (cmatch.length > 0) {
                result.push({etype, cmatch});
            }
        });
        return result;
    }
    emitCode(root: System) {
    }
}

///

const TEMPLATE_INIT = `
Start:
    CLEAN_START
    %{start}
`

const TEMPLATE1 = `
.NextFrame:
    lsr SWCHB	; test Game Reset switch
    bcc Start	; reset?
    VERTICAL_SYNC
    TIMER_SETUP 37
    %{preframe}
    TIMER_WAIT
    TIMER_SETUP 192
    %{kernel}
    TIMER_WAIT
    TIMER_SETUP 29
    %{postframe}
    TIMER_WAIT
    jmp .NextFrame
`;

const TEMPLATE2 = `
#ifdef EVENT_joyup
    lda #%00100000	;Up?
    bit SWCHA
	bne SkipMoveUp
    %{joyup}
.SkipMoveUp
#endif
`;

const TEMPLATE3 = `
    lda %{ypos},x
    sec
    sbc #1
    bcc .noclip
    sta %{ypos},x
.noclip
`;

const TEMPLATE4_S = `
    lda %{@sprite.bitmap+0}   ; bitmap address
    sta temp+0       ; temp space
    lda %{@sprite.bitmap+1}   ; bitmap address
    sta temp+1       ; temp space
`

const TEMPLATE4_K = `
    ldx %{kernel.numlines}    ; lines in kernel
LVScan
    	txa		; X -> A
        sec		; set carry for subtract
        sbc YPos	; local coordinate
        cmp %{sprite.height}   ; in sprite?
        bcc InSprite	; yes, skip over next
        lda #0		; not in sprite, load 0
InSprite
	    tay		; local coord -> Y
        lda (temp+0),y	; lookup color
        sta WSYNC	; sync w/ scanline
        sta GRP0	; store bitmap
        lda (temp+2),y ; lookup color
        sta COLUP0	; store color
        dex		; decrement X
        bne LVScan	; repeat until 192 lines
`;

const SET_XPOS = `
    lda %{sprite.xpos}
    ldx %(sprite.plyrindex}
    jsr SetHorizPos
`

const SETHORIZPOS = `
SetHorizPos: subroutine
        sta WSYNC       ; start a new line
        SLEEP 3
        sec             ; set carry flag
SetHorizPosLoop:
        sbc #15         ; subtract 15
        bcs SetHorizPosLoop  ; branch until negative
SetHorizPosAfter:
	ASSERT_SAME_PAGE SetHorizPosLoop, SetHorizPosAfter
        eor #7          ; calculate fine offset
        asl
        asl
        asl
        asl
        sta RESP0,x     ; fix coarse position
        sta HMP0,x      ; set fine offset
        sta WSYNC
Return:			; for SLEEP macro, etc.
	rts             ; return to caller
`

function test() {
    let em = new EntityManager();

    let c_kernel = em.defineComponent({name:'kernel', fields:[
        {name:'lines', dtype:'int', lo:0, hi:255}
    ]})
    let c_sprite = em.defineComponent({name:'sprite', fields:[
        {name:'height', dtype:'int', lo:0, hi:255},
        {name:'plyrindex', dtype:'int', lo:0, hi:1},
        {name:'flags', dtype:'int', lo:0, hi:255},
    ]})
    let c_player = em.defineComponent({name:'player', fields:[
        //TODO: optional?
    ]})
    let c_hasbitmap = em.defineComponent({name:'hasbitmap', fields:[
        {name:'bitmap', dtype:'ref', query:{include:['bitmap']}},
    ]})
    let c_hascolormap = em.defineComponent({name:'hascolormap', fields:[
        {name:'colormap', dtype:'ref', query:{include:['colormap']}},
    ]})
    let c_bitmap = em.defineComponent({name:'bitmap', fields:[
        {name:'data', dtype:'array', elem:{ dtype:'int', lo:0, hi:255 }}
    ]})
    let c_colormap = em.defineComponent({name:'colormap', fields:[
        {name:'data', dtype:'array', elem:{ dtype:'int', lo:0, hi:255 }}
    ]})
    let c_xpos = em.defineComponent({name:'xpos', fields:[
        {name:'xpos', dtype:'int', lo:0, hi:255}
    ]})
    let c_ypos = em.defineComponent({name:'ypos', fields:[
        {name:'ypos', dtype:'int', lo:0, hi:255}
    ]})
    let c_xyvel = em.defineComponent({name:'xyvel', fields:[
        {name:'xvel', dtype:'int', lo:-8, hi:7},
        {name:'yvel', dtype:'int', lo:-8, hi:7}
    ]})

    // init -> [start] -> frameloop
    // frameloop -> [preframe] [kernel] [postframe]

    // TODO: where is kernel numlines?
    // temp between preframe + frame?
    em.defineSystem({
        name:'kernel-simple',
        tempbytes:4,
        query:{
            include:['sprite','bitmap','colormap','ypos'],
        },
        actions:[
            { text:TEMPLATE4_S, event:'preframe', iterate:'once' },
            { text:TEMPLATE4_K, event:'kernel', iterate:'once' },
        ]
    })
    em.defineSystem({
        name:'set-xpos',
        query:{
            include:['sprite','xpos']
        },
        actions:[
            { text:SET_XPOS, event:'preframe', iterate:'each' },
            //{ text:SETHORIZPOS },
        ]
    })
    // TODO: how to have subsystems? maybe need Scopes
    // TODO: easy stagger of system update?
    // TODO: easy lookup tables
    // TODO: how to init?
    // https://docs.unity3d.com/Packages/com.unity.entities@0.17/manual/ecs_systems.html
    em.defineSystem({
        name:'init',
        emits:['start'],
        query:{
            include:[], // ???
        },
        actions:[
            { text:TEMPLATE_INIT, event:'init', iterate:'once' }
        ]
    })
    em.defineSystem({
        name:'frameloop',
        emits:['preframe','kernel','postframe'],
        query:{
            include:['kernel'], // ???
        },
        actions:[
            { text:TEMPLATE1, event:'start', iterate:'once' }
        ]
    })
    em.defineSystem({
        name:'joyread',
        query:{
            include:['player']
        },
        emits:['joyup','joydown','joyleft','joyright','joybutton'],
        actions:[
            { text:TEMPLATE2, event:'postframe', iterate:'each' }
        ]
    });
    em.defineSystem({
        name:'simple-move',
        query:{
            include:['player','xpos','ypos']
        },
        actions:[
            { text:TEMPLATE3, event:'joyup', iterate:'each' }
        ]
    });

    let root = em.newScope("Root");
    let scene = em.newScope("Scene", root);
    let e_ekernel = root.newEntity({components:[c_kernel]});
    root.setConstValue(e_ekernel, c_kernel, 'lines', 192);

    let e_bitmap0 = root.newEntity({components:[c_bitmap]});
    // TODO: store array sizes?
    root.setConstValue(e_bitmap0, c_bitmap, 'data', new Uint8Array([1,2,3,4,5]));

    let e_colormap0 = root.newEntity({components:[c_colormap]});
    root.setConstValue(e_colormap0, c_colormap, 'data', new Uint8Array([1,2,3,4,5]));

    let ea_playerSprite = {components:[c_sprite,c_hasbitmap,c_hascolormap,c_xpos,c_ypos,c_player]};
    let e_player0 = root.newEntity(ea_playerSprite);
    let e_player1 = root.newEntity(ea_playerSprite);

    let src = new SourceFileExport();
    root.analyzeEntities();
    root.generateCode();
    root.dump(src);
    console.log(src.toString());
}

test();
