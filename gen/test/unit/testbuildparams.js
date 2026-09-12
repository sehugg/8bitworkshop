"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const assert_1 = __importDefault(require("assert"));
const fs_1 = __importDefault(require("fs"));
const path_1 = __importDefault(require("path"));
const mocha_1 = require("mocha");
const builder_1 = require("../../src/worker/builder");
const toolmeta_1 = require("../../src/common/toolmeta");
const testlib_1 = require("../../src/tools/testlib");
// Backwards-compatibility tests for the source build-directive scanner.
//
// fixParamsWithDefines() reads `//#define`/`;#define` lines out of the main
// source and rewrites the platform build params (cfgfile, libargs, compiler
// flags). These tests pin the behavior that must survive the move to an
// explicit directive grammar (//#symbol, //#arg, //#tooldef) and the
// introduction of a stage-keyed args channel. They also document the parts of
// the current contract that are load-bearing in presets/ today.
//
// The tests operate directly on fixParamsWithDefines()/applyAsmProjectParams()
// rather than through a full compile, so they're fast and don't need WASM.
let seq = 0;
function putSource(code, ext = ".c") {
    const path = `test_buildparams_${++seq}${ext}`;
    builder_1.store.putFile(path, code);
    return path;
}
// Mirror of PLATFORM_PARAMS['nes'] -- mapper lives both in libargs (passed to
// ld65 as -D) and in the source as a real preprocessor #define.
function nesParams() {
    return {
        arch: "6502",
        cfgfile: "neslib2.cfg",
        libargs: [
            "crt0.o", "nes.lib", "neslib2.lib",
            "-D", "NES_MAPPER=0",
            "-D", "NES_PRG_BANKS=2",
            "-D", "NES_CHR_BANKS=1",
            "-D", "NES_MIRRORING=0",
        ],
        extra_link_files: ["crt0.o", "neslib2.lib", "neslib2.cfg", "nesbanked.cfg"],
        symbolConfigs: { NES_MAPPER: { "4": "nesbanked.cfg" } },
    };
}
function applyDirectives(code, params) {
    const dir = (0, builder_1.parseBuildDirectives)(code);
    (0, builder_1.applyBuildDirectives)(dir, params);
    return dir;
}
function c64Params() {
    return {
        cfgfile: "c64.cfg",
        libargs: ["openroms-compat.o", "c64.lib"],
    };
}
(0, mocha_1.describe)("build directive scanner (backwards compatibility)", function () {
    (0, mocha_1.it)("CFGFILE selects a linker config", function () {
        const p = putSource("#define CFGFILE c64-sid.cfg\nint main(void){return 0;}\n");
        const params = c64Params();
        (0, builder_1.fixParamsWithDefines)(p, params);
        assert_1.default.strictEqual(params.cfgfile, "c64-sid.cfg");
    });
    (0, mocha_1.it)("does NOT read //#define (two slashes) -- commenting out disables it", function () {
        // The pattern is /^[;/]?#define/ -- a single optional ; or /. A C line
        // comment '//#define' has two slashes, so it is ignored. This is the only
        // form that reliably disables a directive in C source today.
        const p = putSource("//#define CFGFILE c64-sid.cfg\n");
        const params = c64Params();
        (0, builder_1.fixParamsWithDefines)(p, params);
        assert_1.default.strictEqual(params.cfgfile, "c64.cfg");
    });
    (0, mocha_1.it)("reads the single-slash /#define form", function () {
        // Quirk of the pattern: '/#define' (one slash) is treated as a directive.
        const p = putSource("/#define CFGFILE c64-sid.cfg\n");
        const params = c64Params();
        (0, builder_1.fixParamsWithDefines)(p, params);
        assert_1.default.strictEqual(params.cfgfile, "c64-sid.cfg");
    });
    (0, mocha_1.it)("reads the asm-comment ;#define form", function () {
        const p = putSource(";#define CFGFILE c64-sid.cfg\n", ".s");
        const params = c64Params();
        (0, builder_1.fixParamsWithDefines)(p, params);
        assert_1.default.strictEqual(params.cfgfile, "c64-sid.cfg");
    });
    (0, mocha_1.it)("LIBARGS replaces the linker argument list", function () {
        const p = putSource("#define LIBARGS a.lib,b.lib\n");
        const params = c64Params();
        (0, builder_1.fixParamsWithDefines)(p, params);
        assert_1.default.deepStrictEqual(params.libargs, ["a.lib", "b.lib"]);
    });
    (0, mocha_1.it)("CC65_FLAGS replaces the compiler argument list", function () {
        const p = putSource("#define CC65_FLAGS -O3,-T\n");
        const params = { libargs: ["crt0.o"] };
        (0, builder_1.fixParamsWithDefines)(p, params);
        assert_1.default.deepStrictEqual(params.extra_compiler_args, ["-O3", "-T"]);
    });
    (0, mocha_1.it)("overrides a matching IDENT=VALUE entry in libargs", function () {
        const p = putSource("#define NES_PRG_BANKS 4\n");
        const params = nesParams();
        (0, builder_1.fixParamsWithDefines)(p, params);
        assert_1.default.ok(params.libargs.includes("NES_PRG_BANKS=4"), "expected NES_PRG_BANKS=4");
        assert_1.default.ok(!params.libargs.includes("NES_PRG_BANKS=2"), "stale NES_PRG_BANKS=2 remained");
    });
    (0, mocha_1.it)("NES_MAPPER=4 switches to the banked config and updates the linker define", function () {
        const p = putSource("#define NES_MAPPER 4\t\t// Mapper 4 (MMC3)\n");
        const params = nesParams();
        (0, builder_1.fixParamsWithDefines)(p, params);
        assert_1.default.strictEqual(params.cfgfile, "nesbanked.cfg");
        assert_1.default.ok(params.libargs.includes("NES_MAPPER=4"));
    });
    (0, mocha_1.it)("NES_MAPPER=2 keeps the default config", function () {
        const p = putSource("#define NES_MAPPER 2\t// mapper 2 (UxROM mapper)\n");
        const params = nesParams();
        (0, builder_1.fixParamsWithDefines)(p, params);
        assert_1.default.strictEqual(params.cfgfile, "neslib2.cfg");
        assert_1.default.ok(params.libargs.includes("NES_MAPPER=2"));
    });
    (0, mocha_1.it)("honors commented-out directives -- presets/nes/skeleton.ca65 relies on it", function () {
        // ';#define LIBARGS ,' is a ca65 comment, but the scanner reads the ';'
        // form on purpose to clear libargs for the hand-written asm skeleton.
        const p = putSource(";#define LIBARGS ,\n", ".s");
        const params = nesParams();
        (0, builder_1.fixParamsWithDefines)(p, params);
        assert_1.default.deepStrictEqual(params.libargs, []);
    });
    (0, mocha_1.it)("ignores defines that are not build configuration", function () {
        const p = putSource("#define FOO 1\n#define BAR baz\n");
        const params = nesParams();
        (0, builder_1.fixParamsWithDefines)(p, params);
        assert_1.default.strictEqual(params.cfgfile, "neslib2.cfg");
        assert_1.default.deepStrictEqual(params.libargs, nesParams().libargs);
        assert_1.default.strictEqual(params.extra_compiler_args, undefined);
    });
    (0, mocha_1.it)("is a no-op without a source path", function () {
        const params = nesParams();
        const before = JSON.stringify(params);
        (0, builder_1.fixParamsWithDefines)(null, params);
        (0, builder_1.fixParamsWithDefines)("", params);
        (0, builder_1.fixParamsWithDefines)("does_not_exist_xyz.c", params);
        assert_1.default.strictEqual(JSON.stringify(params), before);
    });
    (0, mocha_1.it)("is a no-op when the platform has no libargs (current coupling)", function () {
        // Known wart: the whole scanner body is gated on params.libargs, so
        // CFGFILE/CC65_FLAGS are silently ignored on libargs-less platforms.
        const p = putSource("#define CFGFILE foo.cfg\n");
        const params = { cfgfile: "orig.cfg" };
        (0, builder_1.fixParamsWithDefines)(p, params);
        assert_1.default.strictEqual(params.cfgfile, "orig.cfg");
    });
});
(0, mocha_1.describe)("explicit build directives (//#symbol, //#flag, //#tooldef)", function () {
    (0, mocha_1.it)("#flag collects raw args per phase", function () {
        const params = {};
        applyDirectives("//#flag compiler -O3 -g\n//#flag ld -Wl,--large\n//#flag as -g\n", params);
        assert_1.default.deepStrictEqual(params.buildArgs.compiler, ["-O3", "-g"]);
        assert_1.default.deepStrictEqual(params.buildArgs.linker, ["-Wl,--large"]);
        assert_1.default.deepStrictEqual(params.buildArgs.assembler, ["-g"]);
    });
    (0, mocha_1.it)("#flag honors quoted arguments", function () {
        const params = {};
        applyDirectives('//#flag c "-DFOO=bar baz"\n', params);
        assert_1.default.deepStrictEqual(params.buildArgs.compiler, ["-DFOO=bar baz"]);
    });
    (0, mocha_1.it)("#symbol defaults to the compiler (preprocessor) phase", function () {
        const params = {};
        applyDirectives("//#symbol FOO=bar\n", params);
        assert_1.default.deepStrictEqual(params.symbols.compiler, ["FOO=bar"]);
        assert_1.default.deepStrictEqual(params.symbols.assembler, []);
        assert_1.default.deepStrictEqual(params.symbols.linker, []);
    });
    (0, mocha_1.it)("#symbol phases are independent", function () {
        const params = {};
        applyDirectives("//#symbol c COUNTER=1\n//#symbol as COUNTER=2\n", params);
        assert_1.default.deepStrictEqual(params.symbols.compiler, ["COUNTER=1"]);
        assert_1.default.deepStrictEqual(params.symbols.assembler, ["COUNTER=2"]);
    });
    (0, mocha_1.it)("#symbol merges by name (last definition wins, no duplicates)", function () {
        const params = {};
        applyDirectives("//#symbol c X=1\n//#symbol c Y=2\n//#symbol c X=9\n", params);
        assert_1.default.deepStrictEqual(params.symbols.compiler, ["Y=2", "X=9"]);
    });
    (0, mocha_1.it)("#symbol ld replaces the matching libargs entry and selects the config", function () {
        const params = nesParams();
        applyDirectives("//#symbol ld NES_MAPPER=4\n", params);
        assert_1.default.ok(params.libargs.includes("NES_MAPPER=4"));
        assert_1.default.ok(!params.libargs.includes("NES_MAPPER=0"));
        assert_1.default.strictEqual(params.cfgfile, "nesbanked.cfg");
        // merged into libargs, not queued again -> no redefinition on the link line
        assert_1.default.deepStrictEqual(params.symbols.linker, []);
    });
    (0, mocha_1.it)("#symbol ld queues a symbol that is not a platform libarg", function () {
        const params = nesParams();
        applyDirectives("//#symbol ld NEWSYM=0x10\n", params);
        assert_1.default.deepStrictEqual(params.symbols.linker, ["NEWSYM=0x10"]);
    });
    (0, mocha_1.it)("#symbol ld rejects a string value (would fail ld65 -D)", function () {
        const params = nesParams();
        const dir = applyDirectives('//#symbol ld BAD="str"\n', params);
        assert_1.default.strictEqual(dir.errors.length, 1);
        assert_1.default.deepStrictEqual(params.symbols.linker, []);
        assert_1.default.ok(params.libargs.includes("NES_MAPPER=0"));
    });
    (0, mocha_1.it)("#tooldef sets a typed linker knob", function () {
        const params = c64Params();
        applyDirectives("//#tooldef ld cfgfile=foo.cfg\n", params);
        assert_1.default.strictEqual(params.cfgfile, "foo.cfg");
    });
    (0, mocha_1.it)("#tooldef libargs replaces the linker argument list", function () {
        const params = c64Params();
        applyDirectives("//#tooldef ld libargs=a.lib,b.lib\n", params);
        assert_1.default.deepStrictEqual(params.libargs, ["a.lib", "b.lib"]);
    });
    (0, mocha_1.it)("#tooldef rejects unknown knobs", function () {
        const params = c64Params();
        const dir = applyDirectives("//#tooldef ld nonsense=1\n", params);
        assert_1.default.strictEqual(dir.errors.length, 1);
    });
    (0, mocha_1.it)("ignores directives that are commented out at the marker", function () {
        const params = {};
        applyDirectives("////#flag c -O3\n;;#symbol X=1\n;//#flag ld -x\n", params);
        assert_1.default.deepStrictEqual(params.buildArgs.compiler, []);
        assert_1.default.deepStrictEqual(params.symbols.compiler, []);
        assert_1.default.deepStrictEqual(params.buildArgs.linker, []);
    });
    (0, mocha_1.it)("accepts both the // and ; comment markers", function () {
        const params = {};
        applyDirectives("//#flag c -O3\n;#flag ld -x\n", params);
        assert_1.default.deepStrictEqual(params.buildArgs.compiler, ["-O3"]);
        assert_1.default.deepStrictEqual(params.buildArgs.linker, ["-x"]);
    });
    (0, mocha_1.it)("fixParamsWithDefines applies explicit directives too", function () {
        const p = putSource("//#flag c -O3\n//#symbol c HELLO=world\n");
        const params = c64Params();
        (0, builder_1.fixParamsWithDefines)(p, params);
        assert_1.default.deepStrictEqual(params.buildArgs.compiler, ["-O3"]);
        assert_1.default.deepStrictEqual(params.symbols.compiler, ["HELLO=world"]);
    });
    (0, mocha_1.it)("fixParamsWithDefines throws on a malformed directive", function () {
        const p = putSource('//#symbol ld BAD="str"\n');
        const params = nesParams();
        assert_1.default.throws(() => (0, builder_1.fixParamsWithDefines)(p, params), /build directive error/);
    });
    (0, mocha_1.it)("applies each source file's directives only once", function () {
        const p = putSource("//#flag c -O3\n");
        const params = c64Params();
        (0, builder_1.fixParamsWithDefines)(p, params);
        (0, builder_1.fixParamsWithDefines)(p, params);
        assert_1.default.deepStrictEqual(params.buildArgs.compiler, ["-O3"]);
    });
});
(0, mocha_1.describe)("platform tool config resolution", function () {
    (0, mocha_1.it)("resolves per-platform, root-base, and default configs", function () {
        assert_1.default.strictEqual((0, toolmeta_1.getPlatformToolConfig)('cc65', 'nes').preloadFS, '65-nes');
        assert_1.default.strictEqual((0, toolmeta_1.getPlatformToolConfig)('cc65', 'atari8-800').preloadFS, '65-atari8');
        assert_1.default.strictEqual((0, toolmeta_1.getPlatformToolConfig)('sdcc').preloadFS, 'sdcc');
        assert_1.default.strictEqual((0, toolmeta_1.getPlatformToolConfig)('dasm', 'nes'), undefined);
    });
});
(0, mocha_1.describe)("tool define/symbol formatting", function () {
    (0, mocha_1.it)("formats preprocessor defines per tool", function () {
        assert_1.default.deepStrictEqual((0, toolmeta_1.defineArgs)("cc65", ["FOO=1"]), ["-DFOO=1"]);
        assert_1.default.deepStrictEqual((0, toolmeta_1.defineArgs)("sdcc", ["FOO=1"]), ["-DFOO=1"]);
        assert_1.default.deepStrictEqual((0, toolmeta_1.defineArgs)("ca65", ["FOO=1"]), ["-D", "FOO=1"]);
        assert_1.default.deepStrictEqual((0, toolmeta_1.defineArgs)("sdasz80", ["FOO=1"]), []);
        assert_1.default.deepStrictEqual((0, toolmeta_1.defineArgs)("cc65", []), []);
    });
    (0, mocha_1.it)("formats link symbols per tool", function () {
        assert_1.default.deepStrictEqual((0, toolmeta_1.linkSymbolArgs)("ld65", ["A=1"]), ["-D", "A=1"]);
        assert_1.default.deepStrictEqual((0, toolmeta_1.linkSymbolArgs)("sdldz80", ["A=1"]), ["-g", "A=1"]);
        assert_1.default.deepStrictEqual((0, toolmeta_1.linkSymbolArgs)("cc65", ["A=1"]), []);
    });
    (0, mocha_1.it)("selects raw args by tool kind", function () {
        const args = { compiler: ["-O3"], assembler: ["-as"], linker: ["-x"] };
        assert_1.default.deepStrictEqual((0, toolmeta_1.extraArgsFor)("cc65", args), ["-O3"]);
        assert_1.default.deepStrictEqual((0, toolmeta_1.extraArgsFor)("ca65", args), ["-as"]);
        assert_1.default.deepStrictEqual((0, toolmeta_1.extraArgsFor)("ld65", args), ["-x"]);
        assert_1.default.deepStrictEqual((0, toolmeta_1.extraArgsFor)("sdldz80", args), ["-x"]);
    });
});
(0, mocha_1.describe)("applyAsmProjectParams (backwards compatibility)", function () {
    (0, mocha_1.it)("copies asm_* keys over their base keys", function () {
        const params = {
            cfgfile: "neslib2.cfg",
            libargs: ["crt0.o"],
            asm_cfgfile: "nes-asm.cfg",
            asm_libargs: ["none.o"],
            asm_extra_link_files: ["nes-asm.cfg"],
        };
        (0, builder_1.applyAsmProjectParams)(params);
        assert_1.default.strictEqual(params.cfgfile, "nes-asm.cfg");
        assert_1.default.deepStrictEqual(params.libargs, ["none.o"]);
        assert_1.default.deepStrictEqual(params.extra_link_files, ["nes-asm.cfg"]);
    });
    (0, mocha_1.it)("leaves non-asm keys untouched", function () {
        const params = { cfgfile: "base.cfg", extra_compiler_args: ["-O3"] };
        (0, builder_1.applyAsmProjectParams)(params);
        assert_1.default.strictEqual(params.cfgfile, "base.cfg");
        assert_1.default.deepStrictEqual(params.extra_compiler_args, ["-O3"]);
    });
    (0, mocha_1.it)("source CFGFILE still overrides asm_ project params", function () {
        // applyAsmProjectParams() runs first, then the source scan -- so a source
        // directive has the last word over the asm_* copies.
        const p = putSource("#define CFGFILE custom.cfg\n");
        const params = {
            cfgfile: "base.cfg",
            libargs: ["base.o"],
            asm_cfgfile: "asm.cfg",
            asm_libargs: ["asm.o"],
        };
        (0, builder_1.applyAsmProjectParams)(params);
        (0, builder_1.fixParamsWithDefines)(p, params);
        assert_1.default.strictEqual(params.cfgfile, "custom.cfg");
    });
});
(0, mocha_1.describe)("build directive wiring (integration)", function () {
    this.timeout(120000);
    const tmpdir = "/tmp/pi-agent/buildparams";
    (0, mocha_1.before)(function () { fs_1.default.mkdirSync(tmpdir, { recursive: true }); });
    function writeSource(name, code) {
        const p = path_1.default.join(tmpdir, name);
        fs_1.default.writeFileSync(p, code);
        return p;
    }
    const guard = "#ifndef MYFLAG\n#error MYFLAG missing\n#endif\nint main(void){return 0;}\n";
    (0, mocha_1.it)("control: undefined MYFLAG fails to compile", async function () {
        await (0, testlib_1.preload)('cc65', 'c64');
        const result = await (0, testlib_1.compileSourceFile)('cc65', 'c64', writeSource('ctrl.c', guard));
        assert_1.default.ok((result.errors || []).length > 0, "expected #error from missing MYFLAG");
    });
    (0, mocha_1.it)("//#symbol c reaches the preprocessor", async function () {
        await (0, testlib_1.preload)('cc65', 'c64');
        const code = "//#symbol c MYFLAG=1\n" + guard;
        const result = await (0, testlib_1.compileSourceFile)('cc65', 'c64', writeSource('sym.c', code));
        assert_1.default.deepStrictEqual(result.errors || [], []);
    });
    (0, mocha_1.it)("//#flag c reaches the compiler", async function () {
        await (0, testlib_1.preload)('cc65', 'c64');
        const code = "//#flag c -DMYFLAG=1\n" + guard;
        const result = await (0, testlib_1.compileSourceFile)('cc65', 'c64', writeSource('flag.c', code));
        assert_1.default.deepStrictEqual(result.errors || [], []);
    });
    (0, mocha_1.it)("step symbol overrides reach the compiler (CLI/project path)", async function () {
        await (0, testlib_1.preload)('cc65', 'c64');
        const result = await (0, testlib_1.compileSourceFile)('cc65', 'c64', writeSource('ovr1.c', guard), undefined, { symbols: { compiler: ['MYFLAG=1'] } });
        assert_1.default.deepStrictEqual(result.errors || [], []);
    });
    (0, mocha_1.it)("step raw-arg overrides reach the compiler", async function () {
        await (0, testlib_1.preload)('cc65', 'c64');
        const result = await (0, testlib_1.compileSourceFile)('cc65', 'c64', writeSource('ovr2.c', guard), undefined, { buildArgs: { compiler: ['-DMYFLAG=1'] } });
        assert_1.default.deepStrictEqual(result.errors || [], []);
    });
    (0, mocha_1.it)("rejects a text link symbol from step overrides", async function () {
        await (0, testlib_1.preload)('cc65', 'c64');
        const result = await (0, testlib_1.compileSourceFile)('cc65', 'c64', writeSource('ovr3.c', guard), undefined, { symbols: { linker: ['BAD=xyz'] } });
        assert_1.default.ok((result.errors || []).length > 0, "expected a link symbol error");
    });
    (0, mocha_1.it)("platform ToolMeta buildArgs reach the tool", async function () {
        await (0, testlib_1.preload)('cc65', 'c64');
        const meta = toolmeta_1.TOOL_META['cc65'];
        const saved = meta.platforms['c64'];
        try {
            meta.platforms['c64'] = Object.assign(Object.assign({}, saved), { buildArgs: { compiler: ['-DMYFLAG=1'] } });
            const result = await (0, testlib_1.compileSourceFile)('cc65', 'c64', writeSource('plat.c', guard));
            assert_1.default.deepStrictEqual(result.errors || [], []);
        }
        finally {
            meta.platforms['c64'] = saved;
        }
    });
});
//# sourceMappingURL=testbuildparams.js.map