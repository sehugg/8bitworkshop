
var assert = require('assert');
var fs = require('fs');
var path = require('path');
var os = require('os');
var { execFileSync } = require('child_process');

const CLI = path.join(__dirname, '../../gen/tools/8bws.js');

// run the CLI and return { stdout, json } -- --json puts the CLIResult on stdout
function cli(...args) {
    var stdout = execFileSync('node', [CLI, ...args], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
    return stdout;
}
// in --json mode stdout is the CLIResult and nothing else
function cliJSON(...args) {
    return JSON.parse(cli(...args, '--json'));
}
function cliFails(...args) {
    try { cli(...args); } catch (e) { return e; }
    assert.fail('expected the command to fail: ' + args.join(' '));
}

describe('8bws CLI', function () {

    describe('discovery', function () {
        it('should list platforms', function () {
            var r = cliJSON('list-platforms');
            assert.ok(r.success);
            assert.ok(r.data.count > 20);
            assert.equal(r.data.platforms['nes'].arch, '6502');
        });
        it('should put nothing but JSON on stdout in --json mode', function () {
            // the compiler chatters on console.log; it must not corrupt the result
            var r = cliJSON('run', '--platform', 'gb', 'presets/gb/hello.c', '--frames', '5');
            assert.equal(r.data.frames, 5);
        });
        it('should list tools', function () {
            var r = cliJSON('list-tools');
            assert.ok(r.data.tools.includes('cc65'));
        });
    });

    describe('build', function () {
        it('should build a source file', function () {
            var out = path.join(os.tmpdir(), '8bws-test-hello.gb');
            var r = cliJSON('build', '--platform', 'gb', 'presets/gb/hello.c', '-o', out);
            assert.ok(r.success, r.error);
            assert.equal(r.data.tool, 'sdcc');
            assert.ok(r.data.outputSize > 0);
            assert.equal(fs.statSync(out).size, r.data.outputSize);
        });
        it('should check without writing output', function () {
            var r = cliJSON('build', '--platform', 'gb', 'presets/gb/hello.c', '--check');
            assert.ok(r.success, r.error);
            assert.equal(r.command, 'check');
        });
        it('should report compile errors', function () {
            var src = path.join(os.tmpdir(), '8bws-test-bad.c');
            fs.writeFileSync(src, 'int main() { this is not C }\n');
            var e = cliFails('build', '--platform', 'gb', src);
            assert.ok(e.status !== 0);
        });
        it('should require a platform', function () {
            cliFails('build', 'presets/gb/hello.c');
        });
    });

    describe('run --platform', function () {
        it('should run a ROM for N frames', function () {
            var r = cliJSON('run', '--platform', 'nes', '--frames', '30', 'test/roms/nes/shoot2.c.rom');
            assert.ok(r.success, r.error);
            assert.equal(r.data.frames, 30);
            assert.equal(r.data.width, 512);
        });
        it('should build and run a source file', function () {
            var r = cliJSON('run', '--platform', 'gb', 'presets/gb/hello.c', '--frames', '10');
            assert.ok(r.success, r.error);
            assert.equal(r.data.frames, 10);
        });
        it('should break on a symbol from the build', function () {
            var out = cli('run', '--platform', 'gb', 'presets/gb/hello.c', '-e', 'break _main 600; pc 2');
            assert.ok(/break \$[0-9A-F]+: HIT/.test(out), out);
            assert.ok(/_main:/.test(out), out);
        });
        it('should write a screenshot', function () {
            var png = path.join(os.tmpdir(), '8bws-test-shot.png');
            if (fs.existsSync(png)) fs.unlinkSync(png);
            cliJSON('run', '--platform', 'nes', '--frames', '10', '--png', png, 'test/roms/nes/shoot2.c.rom');
            assert.ok(fs.statSync(png).size > 0);
        });
        it('should infer the platform from a ROM extension', function () {
            var gb = path.join(os.tmpdir(), '8bws-test-infer.gb');
            fs.copyFileSync('test/roms/gb/cpu_instrs.gb', gb);
            var r = cliJSON('run', gb, '--frames', '5');
            assert.equal(r.data.platform, 'gb');
        });
        it('should refuse an unrecognized ROM without a platform', function () {
            cliFails('run', 'test/roms/nes/shoot2.c.rom');
        });
    });

    describe('run: emulator control', function () {
        // these all reach through the Platform to its Machine (common/devices.ts)
        it('should reject an unknown platform', function () {
            cliFails('run', '--platform', 'nosuchplatform', '--frames', '1', 'test/roms/apple2/cosmic.c.rom');
        });
        it('should disassemble a 6502 platform', function () {
            var out = cli('run', '--platform', 'apple2', '-e', 'run 20; pc 2', 'test/roms/apple2/cosmic.c.rom');
            assert.ok(/PC=\$[0-9A-F]{4}/.test(out), out);
            assert.ok(/\$[0-9A-F]{4}\s+[0-9A-F]{2}/.test(out), out);
        });
        it('should disassemble a z80 platform', function () {
            var out = cli('run', '--platform', 'vicdual', '-e', 'run 20; pc 2', 'test/roms/vicdual/snake1.c.rom');
            assert.ok(/PC=\$[0-9A-F]{4}/.test(out), out);
        });
        it('should disassemble a 6809 platform', function () {
            var out = cli('run', '--platform', 'williams', '-e', 'run 20; pc 2', 'test/roms/williams/vidfill.asm.rom');
            assert.ok(!/no disassembler/.test(out), out);
        });
        it('should step one instruction at a time', function () {
            var out = cli('run', '--platform', 'apple2', '-e', 'run 20; step 3', 'test/roms/apple2/cosmic.c.rom');
            var addrs = out.match(/^\s+\$[0-9A-F]{4}\s/gm) || [];
            assert.equal(addrs.length, 3, out);
            // 6502 registers and flags should be shown while stepping
            assert.ok(/A=\$[0-9A-F]{2} X=\$[0-9A-F]{2} Y=\$[0-9A-F]{2} SP=\$[0-9A-F]{2} [NnVvDdIiZzCc]{6}/.test(out), out);
        });
        it('should record an instruction history', function () {
            var out = cli('run', '--platform', 'apple2', '-e', 'run 20; hist 5', 'test/roms/apple2/cosmic.c.rom');
            assert.ok(/instructions shown/.test(out), out);
        });
        it('should dump memory', function () {
            var out = cli('run', '--platform', 'apple2', '-f', '20', '--memdump', '400,40f', 'test/roms/apple2/cosmic.c.rom');
            assert.ok(/^0400:( [0-9A-F]{2}){8}/m.test(out), out);
        });
    });

    describe('run script', function () {
        it('should reject an unknown command', function () {
            cliFails('run', '--platform', 'apple2', '-e', 'frobnicate', 'test/roms/apple2/cosmic.c.rom');
        });
        it('should run a script from a file', function () {
            var f = path.join(os.tmpdir(), '8bws-test.script');
            fs.writeFileSync(f, '# comment\nrun 5\necho hello-from-script\n');
            var out = cli('run', '--platform', 'apple2', '--script', f, 'test/roms/apple2/cosmic.c.rom');
            assert.ok(/hello-from-script/.test(out), out);
        });
        it('should resolve symbols from a label file', function () {
            var f = path.join(os.tmpdir(), '8bws-test.lbl');
            fs.writeFileSync(f, 'al 004000 .mysym\n');
            var out = cli('run', '--platform', 'apple2', '--symbols', f, '-e', 'break mysym 2', 'test/roms/apple2/cosmic.c.rom');
            assert.ok(/break \$4000/.test(out), out);
        });
    });

    describe('legacy aliases', function () {
        it('should accept compile, check and compilerun', function () {
            assert.equal(cliJSON('compile', '--platform', 'gb', 'presets/gb/hello.c', '--check').command, 'check');
            assert.equal(cliJSON('check', '--platform', 'gb', 'presets/gb/hello.c').command, 'check');
            assert.ok(cliJSON('compilerun', '--platform', 'gb', 'presets/gb/hello.c', '--frames', '5').success);
        });
    });
});
