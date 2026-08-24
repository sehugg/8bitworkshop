// toolversions - probe the vendored .wasm build tools for version strings.
//
// The wasm binaries are committed to the repo, so a tool's version only
// changes when someone swaps the binary. That makes the version static,
// commit-time data -- which is why we store it in TOOL_META[].version
// rather than fetching it at runtime. This script is how it gets refreshed:
//
//   npm run toolversions                # probe everything, print a table
//   npm run toolversions -- --json out  # also write machine-readable results
//   npm run toolversions -- --check     # exit nonzero if a stored version
//                                       #   disagrees with what the binary reports
//
// Each probe runs in its own child process: several of these tools call
// exit()/abort() when given arguments they don't understand -- some even
// deep inside emscripten's callMain() -- and that would otherwise take down
// the whole sweep. The child installs a process.on('exit') handler so the
// version evidence survives even when the tool hard-exits the process.
// A tool that wedges (see the timeouts) or prints nothing recognizable is
// reported as such -- fill those in by hand from docs or release notes.

import * as fs from 'fs';
import * as path from 'path';
import { spawn } from 'child_process';
import { TOOL_META } from '../common/toolmeta';

const WASM_DIR = path.resolve(__dirname, '..', '..', 'src', 'worker', 'wasm');

interface ProbeResult {
    module: string;         // wasm module name (e.g. 'dasm-wasisdk')
    ids: string[];          // TOOL_META ids sharing this module
    status: 'ok' | 'empty' | 'crash' | 'timeout' | 'missing';
    output?: string;        // first lines of stdout+stderr, as evidence
    version?: string;       // extracted candidate version string, if any
}

// parent kill-switch must exceed the child's self-reported deadline,
// so a well-behaved child gets to file its own report
const CHILD_PROBE_TIMEOUT_MS = 15000;
const PROBE_TIMEOUT_MS = CHILD_PROBE_TIMEOUT_MS + 10000;

//// generic version-string extraction

function extractVersion(output: string): string | undefined {
    if (!output) return undefined;
    const patterns = [
        /\bV?v?(\d+\.\d+(\.\d+)?([a-z0-9.\-+]*)?)/,     // V2.19 / 4.2.1 / 2.20.13
        /[Vv]ersion\s+(\d+[^\s,;)]*)/,                  // "version 3.1.2"
    ];
    for (var re of patterns) {
        var m = re.exec(output);
        if (m) return m[1];
    }
    return undefined;
}

// argument sequences to try, in order: most tools answer --version; some
// only print their banner when invoked with no args at all; old Unix tools
// want -v. Stop as soon as one yields a version string.
const PROBE_ARG_SEQS: string[][] = [['--version'], [], ['-v']];

//// child mode state (only used inside --probe processes)

var childChunks: string[] = [];
var childModule: string | null = null;
var childReported = false;

function childCollect(line: string) {
    line = line.trim();
    if (line) childChunks.push(line);
}

function childFinish(status: ProbeResult['status']): ProbeResult {
    // dedupe, cap the evidence to something readable
    var lines = childChunks.filter((s, i) => childChunks.indexOf(s) === i).slice(0, 5);
    var output = lines.join('\n');
    return {
        module: childModule!,
        ids: [],
        status,
        output: output || undefined,
        version: extractVersion(output),
    };
}

function childReport(status: ProbeResult['status']) {
    if (childReported || !childModule) return;
    childReported = true;
    console.log(JSON.stringify(childFinish(status)));
}

async function probeEmscripten(moduleName: string, argv: string[]): Promise<void> {
    // emscripten glue (.js) present -> load through it, inject the binary so
    // node's fetch() doesn't try to parse the file path as a URL
    var gluePath = path.join(WASM_DIR, moduleName + '.js');
    var factory = require(gluePath);
    // pass the callback IN the config: several glues (sdasz80, sdcc, ...)
    // compile & initialize synchronously inside the factory call, so the
    // callback fires before we'd get a chance to assign it afterwards
    var initialized = false;
    var mod = factory({
        print: childCollect,
        printErr: childCollect,
        noInitialRun: true,
        onRuntimeInitialized: () => { initialized = true; },
        wasmBinary: fs.readFileSync(path.join(WASM_DIR, moduleName + '.wasm')),
        locateFile: (f: string) => path.join(WASM_DIR, f),
    });
    if (!initialized && !mod.calledRun) {
        await new Promise<void>((resolve, reject) => {
            mod.onRuntimeInitialized = () => resolve();
            setTimeout(() => reject(new Error('runtime init timeout')), CHILD_PROBE_TIMEOUT_MS);
        });
    }
    try {
        mod.callMain(argv);
    } catch (e) {
        // ExitStatus after printing is fine; let the output speak
    }
    // give async writers a moment, then report what we got
    await new Promise(resolve => setTimeout(resolve, 250));
}

async function probeWASI(moduleName: string, argv: string[]): Promise<void> {
    // raw WASI binary -> run it through the same shim the worker uses
    var { WASIRunner } = require('../common/wasi/wasishim');
    var runner = new WASIRunner();
    runner.loadSync(fs.readFileSync(path.join(WASM_DIR, moduleName + '.wasm')));
    runner.setArgs([moduleName, ...argv]);
    runner.addPreopenDirectory('.');
    try {
        runner.run();
    } catch (e) {
        // trap after output is fine (dasm does this even on success)
    }
    (runner.fds[1].getBytesAsString() + '\n' + runner.fds[2].getBytesAsString())
        .split('\n').forEach(childCollect);
}

async function runProbe(moduleName: string, argv: string[]): Promise<ProbeResult> {
    childModule = moduleName;
    // rescue hatch: these glues call process.exit() from inside callMain()
    // (their own quit(), abort(), or an internal exit(0)) -- flush whatever
    // they printed before they took the process down
    process.on('exit', () => childReport('crash'));
    if (!fs.existsSync(path.join(WASM_DIR, moduleName + '.wasm'))) {
        return childFinish('missing');
    }
    if (fs.existsSync(path.join(WASM_DIR, moduleName + '.js'))) {
        await probeEmscripten(moduleName, argv);
    } else {
        await probeWASI(moduleName, argv);
    }
    return childFinish('ok');
}

// try each argument sequence until one extracts a version; keep the best
// evidence seen along the way (a tool that exits nonzero after printing
// usage still counts -- that's where several of them put their version)
async function probeModule(moduleName: string): Promise<ProbeResult> {
    var best: ProbeResult | null = null;
    for (var argv of PROBE_ARG_SEQS) {
        var r = await probeInChild(moduleName, argv);
        if (r.version) return r;
        // prefer evidence over silence; don't waste time re-probing wedges
        if (!best || (best.status === 'empty' && r.output)) best = r;
        if (r.status === 'timeout' || r.status === 'missing') break;
    }
    return best!;
}

//// parent mode: spawn one child per module, collect results

function probeInChild(moduleName: string, argv: string[]): Promise<ProbeResult> {
    return new Promise((resolve) => {
        var child = spawn(process.execPath,
            [__filename, '--probe', moduleName, '--args', argv.join(',')], {
            stdio: ['ignore', 'pipe', 'pipe'],
        });
        var stdout = '';
        var stderr = '';
        var timer = setTimeout(() => {
            child.kill('SIGKILL');
            resolve({ module: moduleName, ids: [], status: 'timeout' });
        }, PROBE_TIMEOUT_MS);
        child.stdout.on('data', (d) => stdout += d);
        child.stderr.on('data', (d) => stderr += d);
        child.on('close', () => {
            clearTimeout(timer);
            // the child prints exactly one JSON object as its last stdout line
            var lines = stdout.trim().split('\n');
            var last = lines[lines.length - 1];
            if (last && last.startsWith('{')) {
                try {
                    var result: ProbeResult = JSON.parse(last);
                    result.ids = [];
                    resolve(result);
                    return;
                } catch (e) { /* fall through */ }
            }
            // died before reporting anything usable
            resolve({
                module: moduleName, ids: [], status: 'crash',
                output: ((stdout + '\n' + stderr).trim().split('\n')
                    .filter((s) => s && !s.startsWith('{')).slice(0, 5).join('\n')) || undefined,
            });
        });
    });
}

async function main() {
    var args = process.argv.slice(2);

    // internal: single-module probe, used by the parent via spawn()
    var probeIdx = args.indexOf('--probe');
    if (probeIdx >= 0) {
        var moduleName = args[probeIdx + 1];
        var probeArgs = args[args.indexOf('--args') + 1]?.split(',') ?? ['--version'];
        // self-imposed deadline: report 'timeout' as JSON rather than making
        // the parent SIGKILL us, so the protocol stays uniform
        var watchdog = setTimeout(() => {
            childReport('timeout');
            process.exit(0);
        }, CHILD_PROBE_TIMEOUT_MS);
        var result = await runProbe(moduleName, probeArgs);
        clearTimeout(watchdog);
        childReport(result.status === 'ok' && !childChunks.length ? 'empty' : result.status);
        process.exit(0);
    }

    var jsonOut: string | null = null;
    var jsonIdx = args.indexOf('--json');
    if (jsonIdx >= 0) jsonOut = args[jsonIdx + 1];
    var checkOnly = args.includes('--check');

    // group tool ids by wasm module (arm-tcc serves two tools)
    var byModule: { [module: string]: string[] } = {};
    for (var id of Object.keys(TOOL_META)) {
        var meta = TOOL_META[id];
        if (meta.wasmModule) {
            (byModule[meta.wasmModule] = byModule[meta.wasmModule] || []).push(id);
        }
    }

    var results: ProbeResult[] = [];
    for (var moduleName of Object.keys(byModule)) {
        process.stderr.write('probing ' + moduleName + '...\n');
        var result = await probeModule(moduleName);
        result.ids = byModule[moduleName];
        results.push(result);
    }
    results.sort((a, b) => a.module.localeCompare(b.module));

    // report
    console.log('');
    var mismatches = 0;
    for (var r of results) {
        var label = r.ids.map((id) => TOOL_META[id].version != null ? id : id + '*').join(', ');
        var stored = r.ids.map((id) => TOOL_META[id].version).find((v) => v != null);
        var agree = stored == null || r.version == null || r.version === stored
            || stored.includes(r.version) || r.version.includes(stored);
        if (!agree) mismatches++;
        console.log(
            (r.version ? '' : '! ') +
            r.module.padEnd(16) +
            ('[' + r.status + ']').padEnd(10) +
            (r.version ? r.version.padEnd(14) : ''.padEnd(14)) +
            'meta:' + (stored ?? '-') +
            (agree ? '' : '  MISMATCH') +
            '  (' + label + ')'
        );
        if (r.output && !r.version) {
            console.log(''.padEnd(42) + '> ' + r.output.split('\n')[0]);
        }
    }

    console.log('\n* = tool has no version stored in TOOL_META yet\n');

    if (jsonOut) {
        fs.writeFileSync(jsonOut, JSON.stringify(results, null, 2) + '\n');
        console.log('wrote ' + jsonOut);
    }

    if (checkOnly && mismatches > 0) {
        console.error(mismatches + ' tool(s) disagree with TOOL_META');
        process.exit(1);
    }
    process.exit(0);
}

if (require.main === module) {
    main().catch((e) => {
        console.error(e);
        process.exit(1);
    });
}
