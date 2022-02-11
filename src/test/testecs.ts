
import { spawnSync } from "child_process";
import { readdirSync, readFileSync, writeFileSync } from "fs";
import { describe } from "mocha";
import { Bin, BoxConstraints, Packer } from "../common/ecs/binpack";
import { ECSCompiler } from "../common/ecs/compiler";
import { Dialect_CA65, EntityManager, SourceFileExport } from "../common/ecs/ecs";

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
        //console.log('json', c.em.toJSON());
        let src = new SourceFileExport();
        c.exportToFile(src);
        // TODO: test?
        //console.log(src.toString());
        return em;
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
    it('Should use Compiler', function() {
        testCompiler();
    });
});

describe('Compiler', function() {
    let testdir = './test/ecs/';
    let files = readdirSync(testdir).filter(f => f.endsWith('.ecs'));
    files.forEach((ecsfn) => {
        let asmfn = ecsfn.replace('.ecs','.asm');
        let goodfn = ecsfn.replace('.ecs','.txt');
        let ecspath = testdir + ecsfn;
        let goodpath = testdir + goodfn;
        let dialect = new Dialect_CA65();
        let em = new EntityManager(dialect);
        em.mainPath = ecspath;
        let compiler = new ECSCompiler(em);
        compiler.getImportFile = (path: string) => {
            return readFileSync(testdir + path, 'utf-8');
        }
        let code = readFileSync(ecspath, 'utf-8');
        compiler.parseFile(code, ecspath);
        let out = new SourceFileExport();
        em.exportToFile(out);
        let outtxt = out.toString();
        let goodtxt = readFileSync(goodpath, 'utf-8');
        if (outtxt.trim() != goodtxt.trim()) {
            let asmpath = '/tmp/' + asmfn;
            writeFileSync(asmpath, outtxt, 'utf-8');
            console.log(spawnSync('/usr/bin/diff', [asmpath, goodpath], {encoding:'utf-8'}).stdout);
            throw new Error(`files different; to fix: cp ${asmpath} ${goodpath}`);
        }
    });
});

function testPack(bins: Bin[], boxes: BoxConstraints[]) {
    let packer = new Packer();
    for (let bin of bins) packer.bins.push(bin);
    for (let bc of boxes) packer.boxes.push(bc);
    if (!packer.pack()) throw new Error('cannot pack')
    console.log(packer.boxes);
    console.log(packer.bins[0].free)
}

describe('Box Packer', function() {
    it('Should pack boxes', function() {
        testPack(
            [
                new Bin({ left:0, top:0, right:10, bottom:10 })
            ], [
                { width: 5, height: 5 },
                { width: 5, height: 5 },
                { width: 5, height: 5 },
                { width: 5, height: 5 },
            ]
        );
    });
    it('Should pack top-aligned boxes', function() {
        testPack(
            [
                new Bin({ left:0, top:0, right:10, bottom:10 })
            ], [
                { width: 5, height: 7, top: 0 },
                { width: 5, height: 7, top: 1 },
                { width: 5, height: 1 },
                { width: 5, height: 1 },
                { width: 5, height: 3 },
                { width: 5, height: 1 },
            ]
        );
    });
    it('Should pack top-aligned boxes', function() {
        testPack(
            [
                new Bin({ left:0, top:0, right:10, bottom:10 })
            ], [
                { width: 3, height: 7, top: 0 },
                { width: 3, height: 7, top: 1 },
                { width: 3, height: 7, top: 2 },
                { width: 5, height: 1 },
                { width: 3, height: 1 },
            ]
        );
    });
});

