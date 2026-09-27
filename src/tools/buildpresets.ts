
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
//   npm run buildpresets -- --run            # run each build for 300 frames
//   npm run buildpresets -- --run --png dir  # ... and save a screenshot each
//
// With --run each preset that builds is loaded into its platform headlessly,
// advanced for --frames frames (default 300), and its screen checked for
// obvious trouble -- a blank or single-color frame, which usually means the
// program never got going. --png writes a screenshot for each one.
//
// Tool output is hidden unless the build it belongs to fails, and a tool that
// exits, aborts, or wedges fails just its own preset (see --timeout, ms).
//
// It also warns when a platform's examples are built with a tool but it has
// no skeleton for it, which drops that tool from the IDE's new-file menu.
//
// With --baseline it exits nonzero when a preset that used to build stops
// building (or a known-broken one starts building), so it can gate a commit.

import * as fs from 'fs';
import * as path from 'path';
import * as util from 'util';
import { CompileResult, TOOLS, compileSourceFile, getToolForFilename, preload, romBytes } from './testlib';
import { EmuTarget, VideoOutput, captureRejectionListeners, dropAbortHandlers, installNodeMocks, loadPlatform } from './emutarget';
import { EmuHalt, PLATFORMS } from '../common/emu';
import { getSkeletonName, getToolMeta } from '../common/toolmeta';
import { getBasePlatform } from '../common/util';
import { c } from './cliformat';

const PRESETS_DIR = 'presets';
const PLATFORM_SRC_DIR = 'src/platform';

export interface RunResult {
    ok: boolean;            // platform started and ran without throwing
    frames: number;         // frames actually advanced
    verdict: 'ok' | 'solid' | 'blank' | 'novideo' | 'halted' | 'error';
    width?: number;
    height?: number;
    colors?: number;        // distinct pixel colors on the last frame
    dominant?: number;      // fraction of pixels sharing the most common color
    color?: number;         // that color, as 0xAARRGGBB
    error?: string;
    png?: string;           // screenshot path, when --png was given
    ms: number;
    log?: string;           // what the platform printed, kept only on failure
}

export interface PresetResult {
    preset: string;         // path relative to presets/
    platform: string;
    tool: string;
    ok: boolean;
    size?: number;          // bytes of output, when it built
    ms: number;
    errors?: string[];
    log?: string;           // what the tool printed, kept only when it failed
    run?: RunResult;        // present when built with --run
}

export interface PresetEntry {
    preset: string;         // path relative to presets/
    platform: string;
    tool: string;
    buildAs?: string;       // filename to build it under, when it differs
}

export interface BuildOptions {
    timeout?: number;       // ms before a wedged tool is given up on
    verbose?: boolean;      // let tools print as they run, even when they work
    run?: boolean;          // load each build and run it
    frames?: number;        // frames to advance when running (default 300)
    pngDir?: string;        // directory to write a screenshot into, when running
}

const DEFAULT_TIMEOUT = 120000;
const DEFAULT_RUN_FRAMES = 300;

// A frame this uniform after a few seconds almost always means nothing drew;
// a real screen has a background plus text or sprites.
const SOLID_FRACTION = 0.999;

// skip these platforms, they aren't ready yet or otherwise broken
const SKIP_PLATFORMS = [
    'vector-ataribw',
    'williams-defender',
    'astrocade-arcade',
    'mcr',
];

// Load every platform module so it registers itself in PLATFORMS. A couple of
// them touch the DOM at import time and can't run here; they're reported
// rather than hidden.
let platformsLoaded = false;
async function importAllPlatforms(warn: (s: string) => void) {
    if (platformsLoaded) return;
    platformsLoaded = true;
    acquireRejectionGuard();
    // listeners that exist before any platform module loads are the ones to keep
    const keep = captureRejectionListeners();
    installNodeMocks();
    for (const entry of fs.readdirSync(PLATFORM_SRC_DIR).sort()) {
        if (!entry.endsWith('.ts') || entry.startsWith('_')) continue;
        try {
            await import('../platform/' + entry.replace(/\.ts$/, ''));
        } catch (e) {
            warn(`platform module ${entry}: ${e}`);
        }
    }
    dropAbortHandlers(keep);
}

// Which tool builds a preset: the same table the IDE's platform objects use
// (src/common/toolselect.ts).
function toolForPreset(relpath: string, platform: string): string | null {
    const tool = getToolForFilename(path.basename(relpath), platform);
    // remote: tools need a build server, so they can't be checked offline
    if (!tool || tool.startsWith('remote:') || !TOOLS[tool]) return null;
    return tool;
}

// skeleton.<name> -> the tool that template belongs to. The name is usually
// the tool id, but a tool can override it (getSkeletonName).
function toolsBySkeletonName(): { [name: string]: string } {
    const map: { [name: string]: string } = {};
    for (const tool of Object.keys(TOOLS)) {
        const name = getSkeletonName(tool);
        // a local tool wins over the remote spelling of the same one
        if (!map[name] || tool.indexOf('remote:') !== 0) map[name] = tool;
    }
    return map;
}

// The IDE loads a skeleton into a file the user names, so it has to be built
// under a name the tool will accept -- cmoc, for one, refuses skeleton.cmoc.
function skeletonBuildName(tool: string, skelname: string): string {
    const meta = getToolMeta(tool);
    const ext = meta && meta.extensions && meta.extensions[0];
    return 'skeleton' + (ext || '.' + skelname);
}

// The new-file templates a platform offers, which the IDE finds the same way:
// by looking for presets/<base platform>/skeleton.<tool>.
function listSkeletons(dir: string, platform: string, skelTools: { [name: string]: string }): PresetEntry[] {
    const found: PresetEntry[] = [];
    let entries: string[];
    try {
        entries = fs.readdirSync(path.join(PRESETS_DIR, dir)).sort();
    } catch (e) {
        return found;
    }
    for (const entry of entries) {
        if (entry.indexOf('skeleton.') !== 0 || entry.endsWith('~')) continue;
        const skelname = entry.substring('skeleton.'.length);
        const tool = skelTools[skelname];
        // skeleton.llvm-mos and friends name a tool that only exists remotely
        if (!tool || tool.indexOf('remote:') === 0) continue;
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
export async function listPresets(
    filter?: string, platform?: string,
    warn: (s: string) => void = () => { },
    err: (s: string) => void = () => { }
): Promise<PresetEntry[]> {
    await importAllPlatforms(warn);
    const found: PresetEntry[] = [];
    const seen = new Set<string>();
    const skelTools = toolsBySkeletonName();
    // a platform whose preset folder isn't in this tree; reported in one line
    const missing: { [platform: string]: number } = {};
    // platform variants share a preset folder, so their skeleton gaps are the
    // same; report each dir+tool pair once
    const noSkeleton = new Set<string>();
    const keep = (e: PresetEntry) => {
        if (seen.has(e.preset)) return;
        seen.add(e.preset);
        if (platform && e.platform !== platform) return;
        if (filter && e.preset.indexOf(filter) < 0) return;
        found.push(e);
    };
    for (const id of Object.keys(PLATFORMS).sort()) {
        if (SKIP_PLATFORMS.includes(id)) continue;

        let presets: { id: string }[];
        let plat: any;
        try {
            plat = new PLATFORMS[id](null);
            presets = plat.getPresets ? plat.getPresets() : [];
            if (presets.length === 0) {
                warn(`platform ${id}: no presets listed in getPresets()`);
            }
        } catch (e) {
            warn(`platform ${id}: ${e}`);
            continue;
        }
        // presets are served from presets/<base platform>/, as the IDE's
        // WebPresetsFileSystem does it
        const dir = getBasePlatform(id);
        const presetTools = new Set<string>();
        for (const preset of presets || []) {
            if (!preset || !preset.id) continue;
            const relpath = dir + '/' + preset.id;
            if (!seen.has(relpath) && !fs.existsSync(path.join(PRESETS_DIR, relpath))) {
                missing[id] = (missing[id] || 0) + 1;
                seen.add(relpath);
                warn(`platform ${id}: ${relpath} not found`);
                continue;
            }
            const tool = toolForPreset(relpath, id);
            if (!tool) continue;
            presetTools.add(tool);
            keep({ preset: relpath, platform: id, tool });
        }
        const skeletons = listSkeletons(dir, id, skelTools);
        for (const skel of skeletons) keep(skel);
        // a platform whose examples are built with a tool but that ships no
        // skeleton.<tool> can't offer that tool in the IDE's new-file menu
        const have = new Set(skeletons.map((s) => s.tool));
        for (const tool of presetTools) {
            if (have.has(tool)) continue;
            const key = dir + '/' + tool;
            if (noSkeleton.has(key)) continue;
            noSkeleton.add(key);
            warn(`platform ${id}: no skeleton for tool ${tool} ` +
                `(${PRESETS_DIR}/${dir}/skeleton.${getSkeletonName(tool)})`);
        }
    }
    for (const id of Object.keys(missing).sort()) {
        err(`platform ${id}: ${missing[id]} preset(s) not in presets/${getBasePlatform(id)}/`);
    }
    found.sort((a, b) => a.preset < b.preset ? -1 : a.preset > b.preset ? 1 : 0);
    return found;
}

function outputSize(result: CompileResult): number | undefined {
    const out: any = result.output;
    if (!out) return undefined;
    if (out.length != null) return out.length;
    if (out.code && out.code.length != null) return out.code.length;
    return undefined;
}

// tools like ca65/cc65 need their support filesystem loaded first, the same
// way `8bws build` does it
const preloaded = new Set<string>();
async function preloadOnce(tool: string, platform: string) {
    const key = tool + '/' + platform;
    if (preloaded.has(key)) return;
    preloaded.add(key);
    try {
        await preload(tool, platform);
    } catch (e) {
        // a tool with no filesystem to preload is fine
    }
}

// --- surviving a tool that misbehaves --------------------------------------

// Several of the Emscripten-built tools answer a fatal error by ending the
// host process (cmoc does it when it dislikes a filename), which would stop
// the sweep partway through with no report. Trap exit/abort and turn them
// into a failure of whatever preset is being built at the time.
class ProcessExitError extends Error { }

let exitTrap: ((e: Error) => void) | null = null;
let guardRefs = 0;
let restoreGuard: (() => void) | null = null;

function installExitGuard(): () => void {
    const proc: any = process;  // reallyExit is undeclared but real
    const real = {
        exit: proc.exit,
        reallyExit: proc.reallyExit,
        abort: proc.abort,
    };
    const trap = (call: string): never => {
        const err = new ProcessExitError(`tool called ${call}`);
        // fail the build in flight, then unwind the tool itself
        if (exitTrap) exitTrap(err);
        throw err;
    };
    proc.exit = (code?: number) => trap(`process.exit(${code != null ? code : ''})`);
    proc.reallyExit = (code?: number) => trap(`process.reallyExit(${code != null ? code : ''})`);
    proc.abort = () => trap('process.abort()');
    return () => {
        proc.exit = real.exit;
        proc.reallyExit = real.reallyExit;
        proc.abort = real.abort;
    };
}

function acquireExitGuard() {
    if (guardRefs++ === 0) restoreGuard = installExitGuard();
}

function releaseExitGuard() {
    if (--guardRefs === 0 && restoreGuard) { restoreGuard(); restoreGuard = null; }
}

// A platform's start() may kick off async work that rejects after we've moved
// on (an emulator failing to attach its canvas, say). Left alone, that kills
// the sweep: the Emscripten runtimes some platform modules import (binaryen,
// by way of verilog) register their own unhandledRejection handler that calls
// abort, so the whole process exits 7 with no report. Collect the rejections
// instead, and drop the abort handlers the platform imports installed.
export interface StrayError {
    message: string;
    stack?: string;
}

const strayErrors: StrayError[] = [];
let rejectGuard: (() => void) | null = null;

function acquireRejectionGuard() {
    if (rejectGuard) return;
    const handler = (reason: any) => {
        strayErrors.push({
            message: '' + ((reason && reason.message) || reason),
            stack: reason && reason.stack,
        });
    };
    process.on('unhandledRejection', handler);
    rejectGuard = () => { process.off('unhandledRejection', handler); rejectGuard = null; };
}

// Tools chatter on stdout/stderr while they run -- banners, warnings, the
// occasional fatal error. Buffer it all and only show the part that belongs
// to a build that failed.
function captureOutput() {
    const chunks: string[] = [];
    let truncated = false;
    const push = (s: string) => {
        if (chunks.length < 1000) chunks.push(s); else truncated = true;
    };
    const realWrite = { stdout: process.stdout.write, stderr: process.stderr.write };
    const realConsole: { [name: string]: any } = {};
    const hook = (stream: NodeJS.WriteStream) => {
        stream.write = ((chunk: any, enc?: any, cb?: any) => {
            push(typeof chunk === 'string' ? chunk : Buffer.from(chunk).toString());
            const done = typeof enc === 'function' ? enc : cb;
            if (typeof done === 'function') done();
            return true;
        }) as any;
    };
    hook(process.stdout);
    hook(process.stderr);
    // a tool may have grabbed its own reference to console.log at load time
    for (const name of ['log', 'error', 'warn', 'info', 'debug', 'trace']) {
        realConsole[name] = (console as any)[name];
        (console as any)[name] = (...args: any[]) => push(util.format(...args) + '\n');
    }
    return {
        stop(): string {
            process.stdout.write = realWrite.stdout;
            process.stderr.write = realWrite.stderr;
            for (const name of Object.keys(realConsole)) (console as any)[name] = realConsole[name];
            const text = chunks.join('').replace(/\s+$/, '');
            return truncated ? text + '\n...output truncated...' : text;
        }
    };
}

// A build step can reach for a second tool -- a project that links sources of
// more than one kind -- whose filesystem nobody preloaded. Load it and retry.
const RE_NO_FS = /No filesystem for '([^']+)'/;

// --- running a built preset ------------------------------------------------

// Reject when a platform's start() wedges, so one stuck emulator can't hold up
// the whole sweep. The underlying promise is abandoned, not cancelled.
function withTimeout<T>(p: Promise<T>, ms: number, what: string): Promise<T> {
    return new Promise<T>((resolve, reject) => {
        const timer = setTimeout(() => reject(new Error(`${what} timed out after ${ms}ms`)), ms);
        p.then(
            (v) => { clearTimeout(timer); resolve(v); },
            (e) => { clearTimeout(timer); reject(e); });
    });
}

// Some platforms pick a load format from the title's extension (an Atari XEX
// named .rom would load as a cartridge), the same as `8bws run`.
function romTitle(preset: string, rom: Uint8Array, target: EmuTarget): string {
    const base = path.basename(preset);
    const ext = target.platform.getROMExtension && target.platform.getROMExtension(rom);
    return ext ? base.replace(/\.[^.]*$/, '') + ext : base;
}

// Count the colors on the last frame. A single color -- or a frame nobody ever
// touched -- is the cheapest sign that a program didn't get going. Pure, so it
// can be checked without an emulator.
export function screenStats(pixels: Uint32Array, width = 0, height = 0):
    Pick<RunResult, 'width' | 'height' | 'colors' | 'dominant' | 'color' | 'verdict'> {
    const counts = new Map<number, number>();
    let top = 0, topColor = 0;
    for (let i = 0; i < pixels.length; i++) {
        const color = pixels[i];
        const n = (counts.get(color) || 0) + 1;
        counts.set(color, n);
        if (n > top) { top = n; topColor = color; }
    }
    const dominant = top / (pixels.length || 1);
    let verdict: RunResult['verdict'];
    if (counts.size <= 1) {
        // transparent black is the untouched headless buffer, not a drawn frame
        verdict = (topColor >>> 24) === 0 ? 'blank' : 'solid';
    } else {
        verdict = dominant >= SOLID_FRACTION ? 'solid' : 'ok';
    }
    return { width, height, colors: counts.size, dominant, color: topColor, verdict };
}

function analyzeVideo(video: VideoOutput, run: RunResult) {
    Object.assign(run, screenStats(video.pixels, video.width, video.height));
}

async function writePresetPNG(video: VideoOutput, preset: string, dir: string): Promise<string> {
    const { encode } = await import('fast-png');
    const { pixels, width, height } = video;
    const png = encode({
        width, height,
        data: new Uint8Array(pixels.buffer, pixels.byteOffset, width * height * 4),
        channels: 4,
    });
    // flatten the preset path so presets/<platform>/foo.c and a sibling
    // foo.s never collide in the output directory
    const file = path.join(dir, preset.replace(/[\\/]/g, '_') + '.png');
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(file, png);
    return file;
}

/** Load a finished build into its platform and advance it a while. */
export async function runPreset(
    result: CompileResult, preset: string, platform: string, opts: BuildOptions = {}
): Promise<RunResult> {
    const started = Date.now();
    const frames = opts.frames || DEFAULT_RUN_FRAMES;
    const run: RunResult = { ok: false, frames, verdict: 'error', ms: 0 };
    const capture = opts.verbose ? null : captureOutput();
    let target: EmuTarget | null = null;
    try {
        target = await loadPlatform(platform);
        await withTimeout(target.start(), opts.timeout || DEFAULT_TIMEOUT, 'platform start');
        if (result.files) target.setFileData(result.files);
        const rom = romBytes(result);
        if (rom) await target.loadROM(rom, romTitle(preset, rom, target));
        else await target.loadROM(result.output, path.basename(preset));
        for (let i = 0; i < frames; i++) target.advanceFrame();
        run.ok = true;
        const video = target.getVideo();
        if (!video) {
            run.verdict = 'novideo';
        } else {
            analyzeVideo(video, run);
            if (opts.pngDir) run.png = await writePresetPNG(video, preset, opts.pngDir);
        }
    } catch (e) {
        if (e instanceof EmuHalt && e.normal) {
            // the program stopped by design (arm32 semihost exit); the emulator
            // did its job, so that's a clean halt. Other EmuHalts (HLT opcode,
            // watchdog, illegal instruction) are still failures.
            run.ok = true;
            run.verdict = 'halted';
            run.error = '' + (e.message || e);
        } else {
            run.ok = false;
            run.verdict = 'error';
            run.error = '' + (e && e.message ? e.message : e);
        }
    }
    // report what actually ran, which is less than requested if it threw
    if (target) run.frames = target.frameCount;
    if (capture) run.log = capture.stop() || undefined;
    run.ms = Date.now() - started;
    return run;
}

export async function buildPreset(
    preset: string, platform: string, tool: string, opts: BuildOptions & { buildAs?: string } = {}
): Promise<PresetResult> {
    const started = Date.now();
    const timeout = opts.timeout || DEFAULT_TIMEOUT;
    let result: CompileResult = null;
    let thrown: any = null;
    let errors: string[] = [];
    let log = '';

    for (let attempt = 0; ; attempt++) {
        const capture = opts.verbose ? null : captureOutput();
        let timer: any = null;
        result = null;
        thrown = null;
        acquireExitGuard();
        try {
            // a tool that exits, or one that wedges, loses the race and fails
            // this preset instead of ending the sweep
            const exited = new Promise<never>((_, reject) => { exitTrap = reject; });
            const expired = new Promise<never>((_, reject) => {
                timer = setTimeout(() => reject(new Error(`timed out after ${timeout}ms`)), timeout);
            });
            await preloadOnce(tool, platform);
            result = await Promise.race([
                compileSourceFile(tool, platform, path.join(PRESETS_DIR, preset), opts.buildAs),
                exited,
                expired,
            ]);
        } catch (e) {
            thrown = e;
        } finally {
            exitTrap = null;
            if (timer) clearTimeout(timer);
            releaseExitGuard();
            if (capture) log = capture.stop();
        }
        if (thrown) {
            errors = ["" + (thrown && thrown.message ? thrown.message : thrown)];
        } else if (!result.success) {
            errors = (result.errors || []).map((e) => `${e.path || preset}:${e.line} ${e.msg}`);
            if (!errors.length) errors = ['build failed'];
        } else {
            errors = [];
        }
        const needsFS = attempt === 0 && RE_NO_FS.exec(errors.join('\n'));
        if (!needsFS) break;
        await preloadOnce(needsFS[1], platform);
    }

    const ms = Date.now() - started;
    if (errors.length) return { preset, platform, tool, ok: false, ms, errors, log: log || undefined };
    const built: PresetResult = { preset, platform, tool, ok: true, size: outputSize(result), ms };
    if (opts.run) built.run = await runPreset(result, preset, platform, opts);
    return built;
}

export async function buildAllPresets(
    opts: BuildOptions & {
        filter?: string, platform?: string,
        presets?: PresetEntry[],            // already listed, to avoid a second pass
        onResult?: (r: PresetResult) => void,
    } = {}
): Promise<PresetResult[]> {
    const results: PresetResult[] = [];
    const todo = opts.presets || await listPresets(opts.filter, opts.platform);
    // tools install their own handlers on every run; don't let node warn about it
    process.setMaxListeners(0);
    // hold the guard across the whole sweep, so an exit that arrives between
    // two builds can't slip through either
    acquireExitGuard();
    try {
        for (const { preset, platform, tool, buildAs } of todo) {
            const r = await buildPreset(preset, platform, tool, { ...opts, buildAs });
            results.push(r);
            if (opts.onResult) opts.onResult(r);
        }
    } finally {
        releaseExitGuard();
    }
    return results;
}

// --- command line ---------------------------------------------------------

// ANSI only when a terminal is reading; piping to a file or a CI log gets
// plain text, and NO_COLOR turns it off everywhere.
const useColor = !!process.stdout.isTTY && !process.env.NO_COLOR;
const paint = (code: string) => (s: string | number) =>
    useColor ? `${code}${s}${c.reset}` : `${s}`;
const bold = paint(c.bold), dim = paint(c.dim);
const green = paint(c.green), red = paint(c.red), yellow = paint(c.yellow), cyan = paint(c.cyan);

function arg(argv: string[], name: string): string | undefined {
    const i = argv.indexOf('--' + name);
    return i >= 0 ? argv[i + 1] : undefined;
}

/** One short phrase describing what running a preset produced. */
function runStatus(run: RunResult): string {
    const info = run.error
        ? run.error
        : `${run.colors} color${run.colors === 1 ? '' : 's'}, ${(100 * (run.dominant ?? 1)).toFixed(1)}%` +
          (run.color != null ? ` #${(run.color >>> 0).toString(16).padStart(8, '0')}` : '');
    switch (run.verdict) {
        case 'ok': return green('run ok') + ' ' + dim(info);
        case 'halted': return dim('run halted') + ' ' + dim(info);
        case 'novideo': return dim('run: no video');
        case 'blank': return yellow(bold('run BLANK')) + ' ' + dim(info);
        case 'solid': return yellow(bold('run SOLID')) + ' ' + dim(info);
        default: return red(bold('run FAIL')) + ' ' + dim(info);
    }
}

function compareToBaseline(results: PresetResult[], baselinePath: string): number {
    const baseline: PresetResult[] = JSON.parse(fs.readFileSync(baselinePath, 'utf8'));
    const was: { [preset: string]: boolean } = {};
    for (const b of baseline) was[b.preset] = b.ok;
    let broke = 0, fixed = 0, added = 0;
    for (const r of results) {
        if (!(r.preset in was)) {
            console.log(`  ${yellow('NEW')}      ${r.preset} (${r.ok ? 'builds' : 'fails'})`);
            added++;
        } else if (was[r.preset] && !r.ok) {
            console.log(`  ${red(bold('BROKE'))}    ${r.preset}`);
            for (const e of r.errors || []) console.log(`             ${red(e)}`);
            broke++;
        } else if (!was[r.preset] && r.ok) {
            console.log(`  ${green('FIXED')}    ${r.preset}`);
            fixed++;
        }
    }
    const seen = new Set(results.map((r) => r.preset));
    for (const b of baseline) {
        if (!seen.has(b.preset)) console.log(`  ${dim('MISSING')}  ${dim(b.preset)}`);
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
    // asking for frames or a screenshot only makes sense while running
    const run = argv.includes('--run') || argv.includes('--frames') || argv.includes('--png');
    const frames = arg(argv, 'frames') ? parseInt(arg(argv, 'frames')) : undefined;
    const pngDir = arg(argv, 'png');
    const timeout = arg(argv, 'timeout') ? parseInt(arg(argv, 'timeout')) : undefined;
    // collect stray async rejections so a misbehaving platform can't abort the sweep
    acquireRejectionGuard();

    const warnings: string[] = [];
    const errors: string[] = [];
    const presets = await listPresets(filter, platform, (w) => warnings.push(w), (e) => errors.push(e));
    for (const w of warnings) console.log(dim(`note: ${w}`));
    for (const e of errors) console.log(red(`error: ${e}`));
    if (errors.length) {
        console.error(red(`aborting: ${errors.length} platform(s) list preset files that don't exist`));
    }
    console.log(bold(`${run ? 'building and running' : 'building'} ${presets.length} presets...`));
    const results = await buildAllPresets({
        presets, timeout, verbose, run, frames, pngDir, onResult: (r) => {
            const clean = !r.run || r.run.verdict === 'ok' || r.run.verdict === 'novideo' || r.run.verdict === 'halted';
            if (quiet && r.ok && clean) return;
            const status = r.ok ? green('ok  ') : red(bold('FAIL'));
            const size = r.size != null ? `${r.size} bytes` : '';
            const runText = r.run ? ' ' + runStatus(r.run) : '';
            console.log(`${status} ${r.preset} ${cyan(`[${r.tool}/${r.platform}]`)} ${dim(size)} ${dim(r.ms + 'ms')}${runText}`);
            for (const e of r.errors || []) console.log(`       ${yellow(e)}`);
            if (r.run?.png) console.log(`       ${dim(r.run.png)}`);
            // only a failure gets the tool's / platform's own output
            if (r.log) console.log(dim(r.log.split('\n').map((l) => '     | ' + l).join('\n')));
            if (r.run?.log && r.run.verdict === 'error') {
                console.log(dim(r.run.log.split('\n').map((l) => '     | ' + l).join('\n')));
            }
        }
    });

    const failed = results.filter((r) => !r.ok);
    const built = results.length - failed.length;
    const tally = `${built}/${results.length} presets build`;
    console.log('\n' + bold(failed.length ? yellow(tally) : green(tally)));
    if (failed.length) {
        console.log('\n' + bold('failures:'));
        const byTool: { [tool: string]: number } = {};
        for (const r of failed) {
            byTool[r.tool] = (byTool[r.tool] || 0) + 1;
            console.log(`  ${red(r.preset)} ${cyan(`[${r.tool}/${r.platform}]`)}`);
        }
        console.log('\nby tool: ' + Object.keys(byTool).sort()
            .map((t) => `${cyan(t)}=${byTool[t]}`).join(' '));
    }
    // what the builds did when loaded, separately from whether they built
    const ran = results.filter((r) => r.run);
    if (ran.length) {
        const problems = ran.filter((r) => r.run.verdict !== 'ok' && r.run.verdict !== 'novideo' && r.run.verdict !== 'halted');
        const tally2 = `${ran.length - problems.length}/${ran.length} presets run clean`;
        console.log('\n' + bold(problems.length ? yellow(tally2) : green(tally2)));
        if (problems.length) {
            console.log('\n' + bold('run problems:'));
            for (const r of problems) {
                console.log(`  ${red(r.preset)} ${cyan(`[${r.tool}/${r.platform}]`)} ${runStatus(r.run)}`);
            }
        }
    }
    // stray async failures from platforms that never settled
    if (strayErrors.length) {
        console.log('\n' + bold(yellow(`${strayErrors.length} stray async error(s):`)));
        for (const e of strayErrors) {
            console.log('  ' + red(e.message));
            if (verbose && e.stack) console.log(dim(e.stack.split('\n').map((l) => '     ' + l).join('\n')));
        }
    }
    if (jsonFile) {
        // captured output is for reading on the console, not for diffing
        // against a baseline
        const report = results.map(({ log, ...r }) => ({
            ...r,
            run: r.run ? { ...r.run, log: undefined } : undefined,
        }));
        fs.writeFileSync(jsonFile, JSON.stringify(report, null, 1));
        console.log(dim(`\nwrote ${jsonFile}`));
    }
    if (baseline) {
        process.exit(compareToBaseline(results, baseline) ? 1 : 0);
    }
    if (errors.length) {
        process.exit(1);
    }
}

if (require.main === module) {
    main().catch((e) => { console.error(e); process.exit(2); });
}
