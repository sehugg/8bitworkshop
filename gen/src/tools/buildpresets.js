"use strict";
// buildpresets - build every example the IDE offers through the CLI's own
// compile path (src/tools/testlib), and report what does and doesn't build.
// FOR TESTING ONLY
//
// The list comes from the platforms themselves: each platform module is
// loaded headlessly and asked for getPresets(), the same list the IDE puts in
// its Examples menu, plus the skeleton.<tool> templates it offers for a new
// file. Files that happen to sit under presets/ but that no platform lists
// (headers, libraries, editor scratch) are not built.
//
//   npm run buildpresets                     # everything
//   npm run buildpresets -- --platform vcs   # one platform
//   npm run buildpresets -- --filter sprite  # paths matching a substring
//   npm run buildpresets -- --json out.json  # machine-readable report
//   npm run buildpresets -- --baseline test/presets-baseline.json
//   npm run buildpresets -- --verbose        # let the tools print as they run
//
// Tool output is hidden unless the build it belongs to fails, and a tool that
// exits, aborts, or wedges fails just its own preset (see --timeout, ms).
//
// With --baseline it exits nonzero when a preset that used to build stops
// building (or a known-broken one starts building), so it can gate a commit.
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __rest = (this && this.__rest) || function (s, e) {
    var t = {};
    for (var p in s) if (Object.prototype.hasOwnProperty.call(s, p) && e.indexOf(p) < 0)
        t[p] = s[p];
    if (s != null && typeof Object.getOwnPropertySymbols === "function")
        for (var i = 0, p = Object.getOwnPropertySymbols(s); i < p.length; i++) {
            if (e.indexOf(p[i]) < 0 && Object.prototype.propertyIsEnumerable.call(s, p[i]))
                t[p[i]] = s[p[i]];
        }
    return t;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.listPresets = listPresets;
exports.buildPreset = buildPreset;
exports.buildAllPresets = buildAllPresets;
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
const util = __importStar(require("util"));
const testlib_1 = require("./testlib");
const emutarget_1 = require("./emutarget");
const emu_1 = require("../common/emu");
const toolmeta_1 = require("../common/toolmeta");
const util_1 = require("../common/util");
const cliformat_1 = require("./cliformat");
const PRESETS_DIR = 'presets';
const PLATFORM_SRC_DIR = 'src/platform';
const DEFAULT_TIMEOUT = 120000;
// Load every platform module so it registers itself in PLATFORMS. A couple of
// them touch the DOM at import time and can't run here; they're reported
// rather than hidden.
let platformsLoaded = false;
async function importAllPlatforms(warn) {
    if (platformsLoaded)
        return;
    platformsLoaded = true;
    (0, emutarget_1.installNodeMocks)();
    for (const entry of fs.readdirSync(PLATFORM_SRC_DIR).sort()) {
        if (!entry.endsWith('.ts') || entry.startsWith('_'))
            continue;
        try {
            await Promise.resolve(`${'../platform/' + entry.replace(/\.ts$/, '')}`).then(s => __importStar(require(s)));
        }
        catch (e) {
            warn(`platform module ${entry}: ${e}`);
        }
    }
}
// Which tool builds a preset. The platform object answers this for the IDE,
// so ask it first; testlib's extension tables are the fallback for the
// platforms that don't implement it.
function toolForPreset(relpath, platform, plat) {
    const basename = path.basename(relpath);
    let tool = null;
    if (plat && plat.getToolForFilename) {
        try {
            tool = plat.getToolForFilename(basename);
        }
        catch (e) { }
    }
    if (!tool) {
        try {
            tool = (0, testlib_1.getToolForFilename)(basename, platform);
        }
        catch (e) {
            return null;
        }
    }
    // remote: tools need a build server, so they can't be checked offline
    if (!tool || tool.startsWith('remote:') || !testlib_1.TOOLS[tool])
        return null;
    return tool;
}
// skeleton.<name> -> the tool that template belongs to. The name is usually
// the tool id, but a tool can override it (getSkeletonName).
function toolsBySkeletonName() {
    const map = {};
    for (const tool of Object.keys(testlib_1.TOOLS)) {
        const name = (0, toolmeta_1.getSkeletonName)(tool);
        // a local tool wins over the remote spelling of the same one
        if (!map[name] || tool.indexOf('remote:') !== 0)
            map[name] = tool;
    }
    return map;
}
// The IDE loads a skeleton into a file the user names, so it has to be built
// under a name the tool will accept -- cmoc, for one, refuses skeleton.cmoc.
function skeletonBuildName(tool, skelname) {
    const meta = (0, toolmeta_1.getToolMeta)(tool);
    const ext = meta && meta.extensions && meta.extensions[0];
    return 'skeleton' + (ext || '.' + skelname);
}
// The new-file templates a platform offers, which the IDE finds the same way:
// by looking for presets/<base platform>/skeleton.<tool>.
function listSkeletons(dir, platform, skelTools) {
    const found = [];
    let entries;
    try {
        entries = fs.readdirSync(path.join(PRESETS_DIR, dir)).sort();
    }
    catch (e) {
        return found;
    }
    for (const entry of entries) {
        if (entry.indexOf('skeleton.') !== 0 || entry.endsWith('~'))
            continue;
        const skelname = entry.substring('skeleton.'.length);
        const tool = skelTools[skelname];
        // skeleton.llvm-mos and friends name a tool that only exists remotely
        if (!tool || tool.indexOf('remote:') === 0)
            continue;
        found.push({
            preset: dir + '/' + entry, platform, tool,
            buildAs: skeletonBuildName(tool, skelname),
        });
    }
    return found;
}
// Every preset any platform offers, in a stable order. Platform variants
// (.mame, .wasm, -defender) repeat their parent's list, so the same file can
// be named several times; it is built once, under the first platform that
// claims it.
async function listPresets(filter, platform, warn = () => { }) {
    await importAllPlatforms(warn);
    const found = [];
    const seen = new Set();
    const skelTools = toolsBySkeletonName();
    // a platform whose preset folder isn't in this tree; reported in one line
    const missing = {};
    const keep = (e) => {
        if (seen.has(e.preset))
            return;
        seen.add(e.preset);
        if (platform && e.platform !== platform)
            return;
        if (filter && e.preset.indexOf(filter) < 0)
            return;
        found.push(e);
    };
    for (const id of Object.keys(emu_1.PLATFORMS).sort()) {
        let presets;
        let plat;
        try {
            plat = new emu_1.PLATFORMS[id](null);
            presets = plat.getPresets ? plat.getPresets() : [];
        }
        catch (e) {
            warn(`platform ${id}: ${e}`);
            continue;
        }
        // presets are served from presets/<base platform>/, as the IDE's
        // WebPresetsFileSystem does it
        const dir = (0, util_1.getBasePlatform)(id);
        for (const preset of presets || []) {
            if (!preset || !preset.id)
                continue;
            const relpath = dir + '/' + preset.id;
            if (!seen.has(relpath) && !fs.existsSync(path.join(PRESETS_DIR, relpath))) {
                missing[id] = (missing[id] || 0) + 1;
                seen.add(relpath);
                continue;
            }
            const tool = toolForPreset(relpath, id, plat);
            if (!tool)
                continue;
            keep({ preset: relpath, platform: id, tool });
        }
        for (const skel of listSkeletons(dir, id, skelTools))
            keep(skel);
    }
    for (const id of Object.keys(missing).sort()) {
        warn(`platform ${id}: ${missing[id]} preset(s) not in presets/${(0, util_1.getBasePlatform)(id)}/`);
    }
    found.sort((a, b) => a.preset < b.preset ? -1 : a.preset > b.preset ? 1 : 0);
    return found;
}
function outputSize(result) {
    const out = result.output;
    if (!out)
        return undefined;
    if (out.length != null)
        return out.length;
    if (out.code && out.code.length != null)
        return out.code.length;
    return undefined;
}
// tools like ca65/cc65 need their support filesystem loaded first, the same
// way `8bws build` does it
const preloaded = new Set();
async function preloadOnce(tool, platform) {
    const key = tool + '/' + platform;
    if (preloaded.has(key))
        return;
    preloaded.add(key);
    try {
        await (0, testlib_1.preload)(tool, platform);
    }
    catch (e) {
        // a tool with no filesystem to preload is fine
    }
}
// --- surviving a tool that misbehaves --------------------------------------
// Several of the Emscripten-built tools answer a fatal error by ending the
// host process (cmoc does it when it dislikes a filename), which would stop
// the sweep partway through with no report. Trap exit/abort and turn them
// into a failure of whatever preset is being built at the time.
class ProcessExitError extends Error {
}
let exitTrap = null;
let guardRefs = 0;
let restoreGuard = null;
function installExitGuard() {
    const proc = process; // reallyExit is undeclared but real
    const real = {
        exit: proc.exit,
        reallyExit: proc.reallyExit,
        abort: proc.abort,
    };
    const trap = (call) => {
        const err = new ProcessExitError(`tool called ${call}`);
        // fail the build in flight, then unwind the tool itself
        if (exitTrap)
            exitTrap(err);
        throw err;
    };
    proc.exit = (code) => trap(`process.exit(${code != null ? code : ''})`);
    proc.reallyExit = (code) => trap(`process.reallyExit(${code != null ? code : ''})`);
    proc.abort = () => trap('process.abort()');
    return () => {
        proc.exit = real.exit;
        proc.reallyExit = real.reallyExit;
        proc.abort = real.abort;
    };
}
function acquireExitGuard() {
    if (guardRefs++ === 0)
        restoreGuard = installExitGuard();
}
function releaseExitGuard() {
    if (--guardRefs === 0 && restoreGuard) {
        restoreGuard();
        restoreGuard = null;
    }
}
// Tools chatter on stdout/stderr while they run -- banners, warnings, the
// occasional fatal error. Buffer it all and only show the part that belongs
// to a build that failed.
function captureOutput() {
    const chunks = [];
    let truncated = false;
    const push = (s) => {
        if (chunks.length < 1000)
            chunks.push(s);
        else
            truncated = true;
    };
    const realWrite = { stdout: process.stdout.write, stderr: process.stderr.write };
    const realConsole = {};
    const hook = (stream) => {
        stream.write = ((chunk, enc, cb) => {
            push(typeof chunk === 'string' ? chunk : Buffer.from(chunk).toString());
            const done = typeof enc === 'function' ? enc : cb;
            if (typeof done === 'function')
                done();
            return true;
        });
    };
    hook(process.stdout);
    hook(process.stderr);
    // a tool may have grabbed its own reference to console.log at load time
    for (const name of ['log', 'error', 'warn', 'info', 'debug', 'trace']) {
        realConsole[name] = console[name];
        console[name] = (...args) => push(util.format(...args) + '\n');
    }
    return {
        stop() {
            process.stdout.write = realWrite.stdout;
            process.stderr.write = realWrite.stderr;
            for (const name of Object.keys(realConsole))
                console[name] = realConsole[name];
            const text = chunks.join('').replace(/\s+$/, '');
            return truncated ? text + '\n...output truncated...' : text;
        }
    };
}
// A build step can reach for a second tool -- a project that links sources of
// more than one kind -- whose filesystem nobody preloaded. Load it and retry.
const RE_NO_FS = /No filesystem for '([^']+)'/;
async function buildPreset(preset, platform, tool, opts = {}) {
    const started = Date.now();
    const timeout = opts.timeout || DEFAULT_TIMEOUT;
    let result = null;
    let thrown = null;
    let errors = [];
    let log = '';
    for (let attempt = 0;; attempt++) {
        const capture = opts.verbose ? null : captureOutput();
        let timer = null;
        result = null;
        thrown = null;
        acquireExitGuard();
        try {
            // a tool that exits, or one that wedges, loses the race and fails
            // this preset instead of ending the sweep
            const exited = new Promise((_, reject) => { exitTrap = reject; });
            const expired = new Promise((_, reject) => {
                timer = setTimeout(() => reject(new Error(`timed out after ${timeout}ms`)), timeout);
            });
            await preloadOnce(tool, platform);
            result = await Promise.race([
                (0, testlib_1.compileSourceFile)(tool, platform, path.join(PRESETS_DIR, preset), opts.buildAs),
                exited,
                expired,
            ]);
        }
        catch (e) {
            thrown = e;
        }
        finally {
            exitTrap = null;
            if (timer)
                clearTimeout(timer);
            releaseExitGuard();
            if (capture)
                log = capture.stop();
        }
        if (thrown) {
            errors = ["" + (thrown && thrown.message ? thrown.message : thrown)];
        }
        else if (!result.success) {
            errors = (result.errors || []).map((e) => `${e.path || preset}:${e.line} ${e.msg}`);
            if (!errors.length)
                errors = ['build failed'];
        }
        else {
            errors = [];
        }
        const needsFS = attempt === 0 && RE_NO_FS.exec(errors.join('\n'));
        if (!needsFS)
            break;
        await preloadOnce(needsFS[1], platform);
    }
    const ms = Date.now() - started;
    if (errors.length)
        return { preset, platform, tool, ok: false, ms, errors, log: log || undefined };
    return { preset, platform, tool, ok: true, size: outputSize(result), ms };
}
async function buildAllPresets(opts = {}) {
    const results = [];
    const todo = opts.presets || await listPresets(opts.filter, opts.platform);
    // tools install their own handlers on every run; don't let node warn about it
    process.setMaxListeners(0);
    // hold the guard across the whole sweep, so an exit that arrives between
    // two builds can't slip through either
    acquireExitGuard();
    try {
        for (const { preset, platform, tool, buildAs } of todo) {
            const r = await buildPreset(preset, platform, tool, Object.assign(Object.assign({}, opts), { buildAs }));
            results.push(r);
            if (opts.onResult)
                opts.onResult(r);
        }
    }
    finally {
        releaseExitGuard();
    }
    return results;
}
// --- command line ---------------------------------------------------------
// ANSI only when a terminal is reading; piping to a file or a CI log gets
// plain text, and NO_COLOR turns it off everywhere.
const useColor = !!process.stdout.isTTY && !process.env.NO_COLOR;
const paint = (code) => (s) => useColor ? `${code}${s}${cliformat_1.c.reset}` : `${s}`;
const bold = paint(cliformat_1.c.bold), dim = paint(cliformat_1.c.dim);
const green = paint(cliformat_1.c.green), red = paint(cliformat_1.c.red), yellow = paint(cliformat_1.c.yellow), cyan = paint(cliformat_1.c.cyan);
function arg(argv, name) {
    const i = argv.indexOf('--' + name);
    return i >= 0 ? argv[i + 1] : undefined;
}
function compareToBaseline(results, baselinePath) {
    const baseline = JSON.parse(fs.readFileSync(baselinePath, 'utf8'));
    const was = {};
    for (const b of baseline)
        was[b.preset] = b.ok;
    let broke = 0, fixed = 0, added = 0;
    for (const r of results) {
        if (!(r.preset in was)) {
            console.log(`  ${yellow('NEW')}      ${r.preset} (${r.ok ? 'builds' : 'fails'})`);
            added++;
        }
        else if (was[r.preset] && !r.ok) {
            console.log(`  ${red(bold('BROKE'))}    ${r.preset}`);
            for (const e of r.errors || [])
                console.log(`             ${red(e)}`);
            broke++;
        }
        else if (!was[r.preset] && r.ok) {
            console.log(`  ${green('FIXED')}    ${r.preset}`);
            fixed++;
        }
    }
    const seen = new Set(results.map((r) => r.preset));
    for (const b of baseline) {
        if (!seen.has(b.preset))
            console.log(`  ${dim('MISSING')}  ${dim(b.preset)}`);
    }
    console.log(`\nvs baseline: ${broke ? red(broke + ' broke') : '0 broke'}, ` +
        `${fixed ? green(fixed + ' fixed') : '0 fixed'}, ${added} new`);
    return broke;
}
async function main() {
    const argv = process.argv.slice(2);
    const filter = arg(argv, 'filter');
    const platform = arg(argv, 'platform');
    const jsonFile = arg(argv, 'json');
    const baseline = arg(argv, 'baseline');
    const quiet = argv.includes('--quiet');
    const verbose = argv.includes('--verbose');
    const timeout = arg(argv, 'timeout') ? parseInt(arg(argv, 'timeout')) : undefined;
    const warnings = [];
    const presets = await listPresets(filter, platform, (w) => warnings.push(w));
    for (const w of warnings)
        console.log(dim(`note: ${w}`));
    console.log(bold(`building ${presets.length} presets...`));
    const results = await buildAllPresets({
        presets, timeout, verbose, onResult: (r) => {
            if (quiet && r.ok)
                return;
            const status = r.ok ? green('ok  ') : red(bold('FAIL'));
            const size = r.size != null ? `${r.size} bytes` : '';
            console.log(`${status} ${r.preset} ${cyan(`[${r.tool}/${r.platform}]`)} ${dim(size)} ${dim(r.ms + 'ms')}`);
            for (const e of r.errors || [])
                console.log(`       ${yellow(e)}`);
            // only a failure gets the tool's own output
            if (r.log)
                console.log(dim(r.log.split('\n').map((l) => '     | ' + l).join('\n')));
        }
    });
    const failed = results.filter((r) => !r.ok);
    const built = results.length - failed.length;
    const tally = `${built}/${results.length} presets build`;
    console.log('\n' + bold(failed.length ? yellow(tally) : green(tally)));
    if (failed.length) {
        console.log('\n' + bold('failures:'));
        const byTool = {};
        for (const r of failed) {
            byTool[r.tool] = (byTool[r.tool] || 0) + 1;
            console.log(`  ${red(r.preset)} ${cyan(`[${r.tool}/${r.platform}]`)}`);
        }
        console.log('\nby tool: ' + Object.keys(byTool).sort()
            .map((t) => `${cyan(t)}=${byTool[t]}`).join(' '));
    }
    if (jsonFile) {
        // the captured tool output is for reading on the console, not for
        // diffing against a baseline
        const report = results.map((_a) => {
            var { log } = _a, r = __rest(_a, ["log"]);
            return r;
        });
        fs.writeFileSync(jsonFile, JSON.stringify(report, null, 1));
        console.log(dim(`\nwrote ${jsonFile}`));
    }
    if (baseline) {
        process.exit(compareToBaseline(results, baseline) ? 1 : 0);
    }
}
if (require.main === module) {
    main().catch((e) => { console.error(e); process.exit(2); });
}
//# sourceMappingURL=buildpresets.js.map