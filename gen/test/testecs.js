"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const child_process_1 = require("child_process");
const fs_1 = require("fs");
const mocha_1 = require("mocha");
const binpack_1 = require("../common/ecs/binpack");
const compiler_1 = require("../common/ecs/compiler");
const ecs_1 = require("../common/ecs/ecs");
function testCompiler() {
    let em = new ecs_1.EntityManager(new ecs_1.Dialect_CA65()); // TODO
    let c = new compiler_1.ECSCompiler(em, true);
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
        //const lines = $c0
    end
    entity nobmp [Bitmap]
        const data = [4]
    end
    entity bmp [Bitmap]
        const data = [1,2,3]
    end
    entity player1 [HasBitmap]
            init bitmap = #bmp
    end
end

`, 'foo.txt');
        //console.log('json', c.em.toJSON());
        let src = new ecs_1.SourceFileExport();
        c.exportToFile(src);
        // TODO: test?
        console.log(src.toString());
        return em;
    }
    catch (e) {
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
(0, mocha_1.describe)('Tokenizer', function () {
    it('Should use Compiler', function () {
        testCompiler();
    });
});
(0, mocha_1.describe)('Compiler', function () {
    let testdir = './test/ecs/';
    let files = (0, fs_1.readdirSync)(testdir).filter(f => f.endsWith('.ecs'));
    files.forEach((ecsfn) => {
        it('Should compile ' + ecsfn, function () {
            let asmfn = ecsfn.replace('.ecs', '.asm');
            let goodfn = ecsfn.replace('.ecs', '.txt');
            let ecspath = testdir + ecsfn;
            let goodpath = testdir + goodfn;
            let dialect = new ecs_1.Dialect_CA65();
            let em = new ecs_1.EntityManager(dialect);
            em.mainPath = ecspath;
            let compiler = new compiler_1.ECSCompiler(em, true);
            compiler.getImportFile = (path) => {
                return (0, fs_1.readFileSync)(testdir + path, 'utf-8');
            };
            let code = (0, fs_1.readFileSync)(ecspath, 'utf-8');
            var outtxt = '';
            try {
                compiler.parseFile(code, ecspath);
                // TODO: errors
                let out = new ecs_1.SourceFileExport();
                em.exportToFile(out);
                outtxt = out.toString();
            }
            catch (e) {
                outtxt = e.toString();
                console.log(e);
            }
            if (compiler.errors.length)
                outtxt = compiler.errors.map(e => `${e.line}:${e.msg}`).join('\n');
            let goodtxt = (0, fs_1.existsSync)(goodpath) ? (0, fs_1.readFileSync)(goodpath, 'utf-8') : '';
            if (outtxt.trim() != goodtxt.trim()) {
                let asmpath = '/tmp/' + asmfn;
                (0, fs_1.writeFileSync)(asmpath, outtxt, 'utf-8');
                console.log((0, child_process_1.spawnSync)('/usr/bin/diff', [goodpath, asmpath], { encoding: 'utf-8' }).stdout);
                throw new Error(`files different; to fix: cp ${asmpath} ${goodpath}`);
            }
        });
    });
});
function testPack(bins, boxes) {
    let packer = new binpack_1.Packer();
    for (let bin of bins)
        packer.bins.push(bin);
    for (let bc of boxes)
        packer.boxes.push(bc);
    if (!packer.pack())
        throw new Error('cannot pack');
    //console.log(packer.boxes);
    //console.log(packer.bins[0].free)
}
(0, mocha_1.describe)('Box Packer', function () {
    it('Should pack boxes', function () {
        testPack([
            new binpack_1.Bin({ left: 0, top: 0, right: 10, bottom: 10 })
        ], [
            { width: 5, height: 5 },
            { width: 5, height: 5 },
            { width: 5, height: 5 },
            { width: 5, height: 5 },
        ]);
    });
    it('Should pack top-aligned boxes', function () {
        testPack([
            new binpack_1.Bin({ left: 0, top: 0, right: 10, bottom: 10 })
        ], [
            { width: 5, height: 7, top: 0 },
            { width: 5, height: 7, top: 1 },
            { width: 5, height: 1 },
            { width: 5, height: 1 },
            { width: 5, height: 3 },
            { width: 5, height: 1 },
        ]);
    });
    it('Should pack unaligned boxes', function () {
        testPack([
            new binpack_1.Bin({ left: 0, top: 0, right: 10, bottom: 10 })
        ], [
            { width: 3, height: 7, top: 0 },
            { width: 3, height: 7, top: 1 },
            { width: 3, height: 7, top: 2 },
            { width: 5, height: 1 },
            { width: 3, height: 1 },
        ]);
    });
    it('Should pack multiple bins', function () {
        testPack([
            new binpack_1.Bin({ left: 0, top: 0, right: 10, bottom: 10 }),
            new binpack_1.Bin({ left: 0, top: 0, right: 10, bottom: 10 })
        ], [
            { width: 5, height: 10 },
            { width: 5, height: 10 },
            { width: 5, height: 5 },
            { width: 5, height: 10 },
            { width: 5, height: 5 },
        ]);
    });
});
//# sourceMappingURL=testecs.js.map