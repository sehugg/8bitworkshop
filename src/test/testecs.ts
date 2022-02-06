import { readdirSync, readFileSync } from "fs";
import { describe } from "mocha";
import { ECSCompiler } from "../common/ecs/compiler";
import { Dialect_CA65, EntityManager, SourceFileExport } from "../common/ecs/ecs";

const TEMPLATE1 = `
@NextFrame:
    FRAME_START
    {{emit preframe}}
    KERNEL_START
    {{!kernel}}
    KERNEL_END
    {{!postframe}}
    FRAME_END
    lsr SWCHB	    ; test Game Reset switch
    bcs @NoStart
    jmp Start
@NoStart:
    jmp @NextFrame
`;


const TEMPLATE4_S1 = `
.macro @KernelSetup ent,ofs
    lda #192 ; TODO: numlines
    sec
    sbc ypos_ypos_b0+ent
    sta {{local 5}}+ofs

    ldy hasbitmap_bitmap_b0+ent
    lda bitmap_bitmapdata_b0,y
    sec
    sbc {{$5}}+ofs
    sta {{$0}}+ofs
    lda bitmap_bitmapdata_b8,y
    sbc #0
    sta {{$1}}+ofs

    ldy hascolormap_colormap_b0+ent
    lda colormap_colormapdata_b0,y
    sec
    sbc {{$5}}+ofs
    sta {{$2}}+ofs
    lda colormap_colormapdata_b8,y
    sbc #0
    sta {{$3}}+ofs

    lda sprite_height_b0+ent
    sta {{$4}}+ofs
    lda ypos_ypos_b0+ent
    sta {{$5}}+ofs
.endmacro
`
const TEMPLATE4_S2 = `
    @KernelSetup 0,0
    @KernelSetup 1,6
`

// https://atariage.com/forums/topic/75982-skipdraw-and-graphics/?tab=comments#comment-928232
// https://atariage.com/forums/topic/129683-advice-on-a-masking-kernel/
// https://atariage.com/forums/topic/128147-having-trouble-with-2-free-floating-player-graphics/?tab=comments#comment-1547059
const TEMPLATE4_K = `
    lda {{byte bgcolor}}
    sta COLUBK
    ldy {{byte lines}}
@LVScan:
    lda {{$4}} ; height
    dcp {{$5}}
    bcs @DoDraw1
    lda #0
    .byte $2C
@DoDraw1:
    lda ({{$0}}),y
    sta WSYNC
    sta GRP0
    lda ({{$2}}),y
    sta COLUP0

    lda {{$10}} ; height
    dcp {{$11}}
    bcs @DoDraw2
    lda #0
    .byte $2C
@DoDraw2:
    lda ({{$6}}),y
    sta GRP1
    lda ({{$8}}),y
    sta COLUP1

    dey		; decrement
    bne @LVScan	; repeat until 192 lines
`;

const SET_XPOS = `
    lda {{byte xpos}}
    ldy {{byte plyrindex}}
    sta HMCLR
    jsr {{use SetHorizPos}}
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


function testECS() {
    let em = new EntityManager(new Dialect_CA65());

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
    let c_hasbitmap = em.defineComponent({
        name: 'hasbitmap', fields: [
            { name: 'bitmap', dtype: 'ref', query: { include: [c_bitmap] } },
        ]
    })
    let c_hascolormap = em.defineComponent({
        name: 'hascolormap', fields: [
            { name: 'colormap', dtype: 'ref', query: { include: [c_colormap] } },
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

    // init -> [start] -> frameloop
    // frameloop -> [preframe] [kernel] [postframe]

    // temp between preframe + frame?
    // TODO: check names for identifierness
    em.defineSystem({
        name: 'kernel_simple',
        tempbytes: 12,
        actions: [
            {
                text: TEMPLATE4_S1, event: 'preframe', select: 'with', query: {
                    include: [c_kernel]
                }
            },
            {
                // TODO: should include kernel for numlines
                text: TEMPLATE4_S2, event: 'preframe', select: 'with', query: {
                    include: [c_sprite, c_hasbitmap, c_hascolormap, c_ypos],
                },
            },
            {
                text: TEMPLATE4_K, event: 'kernel', select: 'with', query: {
                    include: [c_kernel]
                }
            },
        ]
    })
    em.defineSystem({
        name: 'set_xpos',
        actions: [
            {
                text: SET_XPOS, event: 'preframe', select: 'foreach', query: {
                    include: [c_sprite, c_xpos]
                },
            },
            //{ text:SETHORIZPOS },
        ]
    })
    // https://docs.unity3d.com/Packages/com.unity.entities@0.17/manual/ecs_systems.html
    em.defineSystem({
        name: 'frameloop',
        actions: [
            { text: TEMPLATE1, event: 'start', select: 'with', query: { include: [c_kernel] } }
        ]
    })
    em.defineSystem({
        name: 'SetHorizPos',
        actions: [
            { text: SETHORIZPOS, event: 'SetHorizPos', select: 'with', query: { include: [c_xpos] } },
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

    root.analyzeEntities();
    root.generateCode();
    let src = new SourceFileExport();
    root.dump(src);
    //console.log(src.toString());
    //console.log(em.toYAML());
}

function testCompiler() {
    let em = new EntityManager(new Dialect_CA65()); // TODO
    let c = new ECSCompiler(em);
    try {
        c.parseFile(`
        // comment
        /*
        mju,fjeqowfjqewiofjqe
        */
component Kernel
    lines: 0..255
    bgcolor: 0..255
end

component Bitmap
    data: array of 0..255
end

component HasBitmap
    bitmap: [Bitmap]
end

system SimpleKernel
locals 8
on preframe do with [Kernel] --- JUNK_AT_END
    lda #5
    sta #6
Label:
---
end

comment ---

---

scope Root

    entity kernel [Kernel]
        const lines = 0xc0
        const lines = $c0
    end

    entity player1 [HasBitmap]
        init bitmap = 1
    end

end

`, 'foo.txt');
        console.log('json', c.em.toJSON());
        let src = new SourceFileExport();
        c.exportToFile(src);
        // TODO: test?
        //console.log(src.toString());
    } catch (e) {
        console.log(e);
        for (let err of c.errors) {
            console.log(err);
        }
        console.log(c.tokens);
        throw e;
    }
}

// TODO: files in markdown?
// TODO: jsr OperModeExecutionTree?

describe('Tokenizer', function() {
    it('Should use API', function() {
        testECS();
    });
    it('Should use Compiler', function() {
        testCompiler();
    });
});

describe('Compiler', function() {
    let testdir = './test/ecs/';
    let files = readdirSync(testdir).filter(f => f.endsWith('.ecs'));
    files.forEach((ecspath) => {
        let dialect = new Dialect_CA65();
        dialect.HEADER = '';
        dialect.FOOTER = '';
        let em = new EntityManager(dialect);
        let compiler = new ECSCompiler(em);
        let code = readFileSync(testdir + ecspath, 'utf-8');
        compiler.parseFile(code, ecspath);
        let out = new SourceFileExport();
        em.exportToFile(out);
        console.log(out.toString());
    });
});
