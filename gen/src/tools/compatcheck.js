"use strict";
// compatcheck - build an older release's examples with today's toolchain.
//
// The compilers live in the repo as wasm binaries (src/worker/wasm), so
// swapping one out changes what every program in the IDE has to live with.
// This tool answers the question "does the new compiler still accept the old
// code?" by building an older release's examples with the current worker.
//
//   npm run compatcheck                              # the release we track
//   npm run compatcheck -- --tag 3.12.1
//   npm run compatcheck -- --dir ~/old/presets
//   npm run compatcheck -- --baseline test/compat/3.12.1.json
//   npm run compatcheck -- --write-baseline test/compat/3.12.1.json
//   npm run compatcheck -- --json out.json
//
// --tag checks the release out into a temporary worktree (removed when the
// run ends) and builds the examples it shipped. --dir builds a preset tree
// that is already on disk.
//
// The sources are the old ones, read the way the IDE reads them; the
// toolchain, the libraries and the build parameters are today's. A failure
// means the current toolchain no longer accepts that old source -- which is
// what the baseline records, so a new one shows up as breakage.
//
// With --baseline it exits nonzero when an example that used to build stops
// building, so it can gate a release. --write-baseline records the current
// results as that baseline.
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
exports.parseOldExamples = parseOldExamples;
exports.listCorpus = listCorpus;
const fs = __importStar(require("fs"));
const os = __importStar(require("os"));
const path = __importStar(require("path"));
const child_process_1 = require("child_process");
const emu_1 = require("../common/emu");
const toolmeta_1 = require("../common/toolmeta");
const util_1 = require("../common/util");
const buildpresets_1 = require("./buildpresets");
const testlib_1 = require("./testlib");
const toolroot_1 = require("./toolroot");
const cliformat_1 = require("./cliformat");
// The release whose examples we keep building. It is the last one before the
// toolchains started moving (sdcc 4, the cc65 upgrade, the WASI conversions),
// so its examples are the ones most likely to notice a change.
const DEFAULT_TAG = '3.12.1';
const useColor = !!process.stdout.isTTY && !process.env.NO_COLOR;
const paint = (code) => (s) => useColor ? `${code}${s}${cliformat_1.c.reset}` : `${s}`;
const bold = paint(cliformat_1.c.bold), dim = paint(cliformat_1.c.dim);
const green = paint(cliformat_1.c.green), red = paint(cliformat_1.c.red), yellow = paint(cliformat_1.c.yellow), cyan = paint(cliformat_1.c.cyan);
function arg(argv, name) {
    const i = argv.indexOf('--' + name);
    return i >= 0 ? argv[i + 1] : undefined;
}
/** Check a tag out into a worktree and return its presets directory. */
function checkoutTag(tag) {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), '8bws-compat-'));
    const wt = path.join(root, 'wt');
    let done = false;
    const cleanup = () => {
        if (done)
            return;
        done = true;
        process.off('exit', cleanup);
        try {
            (0, child_process_1.execFileSync)('git', ['worktree', 'remove', '--force', wt], { cwd: (0, toolroot_1.toolRoot)(), stdio: 'pipe' });
        }
        catch (e) { /* the worktree is removed below anyway */ }
        fs.rmSync(root, { recursive: true, force: true });
    };
    // a killed run must not leave a worktree behind
    process.on('exit', cleanup);
    try {
        (0, child_process_1.execFileSync)('git', ['worktree', 'add', '--detach', wt, tag], { cwd: (0, toolroot_1.toolRoot)(), stdio: 'pipe' });
    }
    catch (e) {
        cleanup();
        const msg = e.stderr ? '' + e.stderr : '' + e;
        throw new Error(`cannot check out ${tag}: ${msg.trim()}`);
    }
    const dir = path.join(wt, 'presets');
    if (!fs.existsSync(dir)) {
        cleanup();
        throw new Error(`${tag} has no presets/ directory`);
    }
    return { dir, tree: wt, label: tag, cleanup };
}
/** Strip the comments from a TypeScript source, so commented-out presets go. */
function stripComments(text) {
    return text
        .replace(/\/\*[\s\S]*?\*\//g, ' ')
        .replace(/\/\/[^\n]*/g, ' ');
}
/** The body of an array literal that starts at `from`, up to its closing bracket. */
function arrayBody(text, from) {
    let depth = 0;
    for (let i = from; i < text.length; i++) {
        const ch = text[i];
        if (ch === '[')
            depth++;
        else if (ch === ']') {
            depth--;
            if (depth === 0)
                return text.substring(from, i);
        }
    }
    return '';
}
/**
 * The examples an old release offered, read from its platform sources: every
 * platform's getPresets() list, which is what the Examples menu showed. The
 * other files in a preset folder are helpers and data that never built on
 * their own.
 */
function parseOldExamples(treeDir) {
    var _a;
    const examples = [];
    const problems = [];
    const platformDir = path.join(treeDir, 'src', 'platform');
    let files;
    try {
        files = fs.readdirSync(platformDir).filter((f) => f.endsWith('.ts')).sort();
    }
    catch (e) {
        return { examples, problems };
    }
    for (const file of files) {
        let text;
        try {
            text = stripComments(fs.readFileSync(path.join(platformDir, file), 'utf8'));
        }
        catch (e) {
            problems.push(`platform ${file}: cannot read it`);
            continue;
        }
        // every array in the file, with the ids it holds
        const arrays = parseArrays(text);
        // the scopes a platform can be written in: a class (which may extend
        // another one) or a function assigned to a variable
        const scopes = parseScopes(text);
        const scopeOf = (pos) => {
            let found = null;
            for (const s of scopes) {
                if (s.pos > pos)
                    break;
                found = s.name;
            }
            return found;
        };
        // the array each scope returns from getPresets()
        const arrayOf = new Map();
        const rePresets = /getPresets\s*(?:\(\s*\)|=\s*function\s*\(\s*\))\s*(?::[^;{]*?)?\{([^{}]*?)\}/g;
        let m;
        while ((m = rePresets.exec(text)) !== null) {
            const scope = scopeOf(m.index);
            const ret = /return\s+([A-Za-z0-9_]+)\s*;/.exec(m[1]);
            if (scope && ret)
                arrayOf.set(scope, ret[1]);
        }
        // the array a scope returns, looking up the inheritance chain and the
        // scopes nested inside it
        const arrayFor = (scope) => {
            var _a;
            const own = scopes.find((s) => s.name === scope);
            if (!own)
                return null;
            if (arrayOf.has(own.name))
                return arrayOf.get(own.name);
            let parent = own.parent || null;
            while (parent) {
                if (arrayOf.has(parent))
                    return arrayOf.get(parent);
                parent = ((_a = scopes.find((s) => s.name === parent)) === null || _a === void 0 ? void 0 : _a.parent) || null;
            }
            // a platform that wraps its class in a function
            const inside = scopes
                .filter((s) => s.pos > own.pos && s.end < own.end)
                .sort((a, b) => (b.end - b.pos) - (a.end - a.pos));
            for (const s of inside) {
                if (arrayOf.has(s.name))
                    return arrayOf.get(s.name);
            }
            return null;
        };
        // the platform ids each scope is registered under
        const idsOf = new Map();
        const reReg = /PLATFORMS\[\s*['"]([^'"]+)['"]\s*\]\s*=\s*([A-Za-z0-9_]+)/g;
        while ((m = reReg.exec(text)) !== null) {
            const list = idsOf.get(m[2]) || [];
            list.push(m[1]);
            idsOf.set(m[2], list);
        }
        for (const [cls, ids] of idsOf) {
            const array = arrayFor(cls);
            if (!array)
                continue;
            // the folder the platform's examples live in: the base of its id,
            // as long as that folder is really there ('nes-asm' shares 'nes')
            let folder = null;
            let owner = ids[0];
            for (const id of ids) {
                const base = (0, util_1.getBasePlatform)(id);
                if (fs.existsSync(path.join(treeDir, 'presets', base))) {
                    folder = base;
                    owner = id;
                    break;
                }
            }
            if (!folder)
                continue;
            for (const id of ((_a = arrays.get(array)) === null || _a === void 0 ? void 0 : _a.ids) || []) {
                examples.push({ id, folder, platform: owner });
            }
        }
    }
    // the same example can be offered by several platforms (an emulator
    // variant); keep one
    const seen = new Set();
    const unique = examples.filter((e) => {
        const key = e.folder + '/' + e.id;
        if (seen.has(key))
            return false;
        seen.add(key);
        return true;
    });
    return { examples: unique, problems };
}
function braceEnd(text, from) {
    let depth = 0;
    for (let i = from; i < text.length; i++) {
        const ch = text[i];
        if (ch === '{')
            depth++;
        else if (ch === '}') {
            depth--;
            if (depth === 0)
                return i;
        }
    }
    return text.length;
}
function parseScopes(text) {
    const scopes = [];
    const reClass = /\bclass\s+([A-Za-z0-9_]+)(?:\s+extends\s+([A-Za-z0-9_]+))?/g;
    let m;
    while ((m = reClass.exec(text)) !== null) {
        const brace = text.indexOf('{', m.index + m[0].length);
        scopes.push({
            name: m[1], pos: m.index, end: braceEnd(text, brace), parent: m[2],
        });
    }
    // the older platforms are plain functions assigned to a variable
    const reFunc = /(?:var|const|let)\s+([A-Za-z0-9_]+)\s*=\s*function\s*\(/g;
    while ((m = reFunc.exec(text)) !== null) {
        const brace = text.indexOf('{', m.index + m[0].length);
        scopes.push({ name: m[1], pos: m.index, end: braceEnd(text, brace) });
    }
    scopes.sort((a, b) => a.pos - b.pos);
    return scopes;
}
/** Every array literal in a source file, with the preset ids it holds. */ function parseArrays(text) {
    const arrays = new Map();
    const reDecl = /(?:const|var|let)\s+([A-Za-z0-9_]+)\b[^=;]*=\s*/g;
    let m;
    while ((m = reDecl.exec(text)) !== null) {
        const name = m[1];
        const start = m.index + m[0].length;
        const bracket = text.indexOf('[', start);
        if (bracket < 0)
            continue;
        // whatever sits between the '=' and the '[' names another array
        // whose entries are folded in ('Atari8_PRESETS.concat([...])')
        const head = text.substring(start, bracket);
        if (!/^[A-Za-z0-9_.\s()]*$/.test(head))
            continue;
        const body = arrayBody(text, bracket);
        const ids = [];
        const reId = /\{\s*id\s*:\s*['"]([^'"]+)['"]/g;
        let im;
        while ((im = reId.exec(body)) !== null)
            ids.push(im[1]);
        for (const [other, value] of arrays) {
            if (head.includes(other))
                ids.push(...value.ids);
        }
        arrays.set(name, { ids });
    }
    return arrays;
}
/**
 * The examples of an old release, with the tool that builds each one today.
 * Files that are still examples in this tree take their platform and tool
 * from there; the rest are matched by extension.
 */
async function listCorpus(corpus) {
    const current = await (0, buildpresets_1.listPresets)(undefined, undefined, () => { }, () => { });
    const byPath = new Map();
    const platformByFolder = new Map();
    for (const e of current) {
        byPath.set(e.preset, e);
        const folder = e.preset.split('/')[0];
        if (!platformByFolder.has(folder))
            platformByFolder.set(folder, e.platform);
    }
    const { examples, problems } = parseOldExamples(corpus.tree);
    const entries = [];
    const skipped = [];
    for (const p of problems)
        skipped.push({ preset: p, why: 'cannot read the old platform list' });
    // the platform that owns a folder today, when no example of it is left
    const folders = new Map();
    for (const id of Object.keys(emu_1.PLATFORMS).sort()) {
        const folder = (0, util_1.getBasePlatform)(id);
        const cur = folders.get(folder);
        if (!cur || (cur.includes('.') && !id.includes('.')))
            folders.set(folder, id);
    }
    const skeletonTools = (0, buildpresets_1.toolsBySkeletonName)();
    const add = (rel, platform, tool, buildAs) => {
        const abs = path.join(corpus.dir, rel);
        if (!fs.existsSync(abs)) {
            skipped.push({ preset: rel, why: 'not in this release' });
            return;
        }
        if (!platform) {
            skipped.push({ preset: rel, why: 'no platform uses this folder' });
            return;
        }
        if (!tool) {
            skipped.push({ preset: rel, why: 'no local tool for this file type' });
            return;
        }
        entries.push({ preset: rel, platform, tool, buildAs, abs });
    };
    for (const example of examples) {
        const rel = example.folder + '/' + example.id;
        const known = byPath.get(rel);
        if (known) {
            // still an example today: same platform, same tool
            add(rel, known.platform, known.tool, known.buildAs);
            continue;
        }
        const platform = platformByFolder.get(example.folder) || folders.get(example.folder) || null;
        if (!platform) {
            skipped.push({ preset: rel, why: 'no platform uses this folder' });
            continue;
        }
        // the tool that builds this file today
        const name = path.basename(example.id);
        const tool = (0, testlib_1.getToolForFilename)(name, platform);
        add(rel, platform, tool && !tool.startsWith('remote:') ? tool : null);
    }
    // the templates a platform offers for a new file are worth building too
    for (const folder of fs.readdirSync(corpus.dir).sort()) {
        const fdir = path.join(corpus.dir, folder);
        if (!fs.statSync(fdir).isDirectory())
            continue;
        for (const name of fs.readdirSync(fdir).sort()) {
            if (!name.startsWith('skeleton.'))
                continue;
            const rel = folder + '/' + name;
            const known = byPath.get(rel);
            if (known) {
                // still a template today: same platform, same tool
                add(rel, known.platform, known.tool, known.buildAs);
                continue;
            }
            const skelname = name.substring('skeleton.'.length);
            const tool = skeletonTools[skelname];
            const platform = platformByFolder.get(folder) || folders.get(folder) || null;
            if (!tool || tool.startsWith('remote:')) {
                skipped.push({ preset: rel, why: 'no local tool for this template' });
                continue;
            }
            add(rel, platform, tool, (0, buildpresets_1.skeletonBuildName)(tool, skelname));
        }
    }
    return { entries, skipped };
}
// --- reporting ------------------------------------------------------------
/** The version of each tool that took part, so a failure names a compiler. */
function toolVersions(tools) {
    const versions = [];
    for (const tool of [...new Set(tools)].sort()) {
        const meta = toolmeta_1.TOOL_META[tool];
        versions.push(`${tool}${meta && meta.version ? ' ' + meta.version : ''}`);
    }
    return versions.join(', ');
}
/** The baseline record of a build: what has to keep working. */
function baselineRecord(r) {
    const meta = toolmeta_1.TOOL_META[r.tool];
    return {
        preset: r.preset,
        platform: r.platform,
        tool: r.tool,
        toolVersion: meta ? meta.version : undefined,
        ok: r.ok,
        errors: r.errors,
        warnings: r.warnings,
    };
}
async function main() {
    const argv = process.argv.slice(2);
    const tag = arg(argv, 'tag') || DEFAULT_TAG;
    const dir = arg(argv, 'dir');
    const jsonFile = arg(argv, 'json');
    const baseline = arg(argv, 'baseline');
    const writeBaseline = arg(argv, 'write-baseline');
    const quiet = argv.includes('--quiet');
    const verbose = argv.includes('--verbose');
    const strict = argv.includes('--strict');
    const timeout = arg(argv, 'timeout') ? parseInt(arg(argv, 'timeout')) : undefined;
    let corpus;
    if (dir) {
        // either the tree or its presets folder will do
        const abs = path.resolve(dir);
        const presets = fs.existsSync(path.join(abs, 'presets')) ? path.join(abs, 'presets') : abs;
        const tree = fs.existsSync(path.join(abs, 'src', 'platform')) ? abs : path.dirname(abs);
        if (!fs.existsSync(presets)) {
            console.error(red(`error: no such directory: ${dir}`));
            return 2;
        }
        corpus = { dir: presets, tree, label: abs };
    }
    else {
        try {
            corpus = checkoutTag(tag);
        }
        catch (e) {
            console.error(red(`error: ${e.message || e}`));
            return 2;
        }
    }
    let code = 0;
    try {
        const { entries, skipped } = await listCorpus(corpus);
        console.log(bold(`building ${entries.length} examples from ${corpus.label} with today's toolchain...`));
        console.log(dim('tools: ' + toolVersions(entries.map((e) => e.tool))));
        if (skipped.length) {
            console.log(dim(`skipped ${skipped.length} file(s)`));
            for (const s of skipped)
                console.log(dim(`  ${s.preset}: ${s.why}`));
        }
        const results = await (0, buildpresets_1.buildAllPresets)({
            presets: entries,
            presetsDir: corpus.dir,
            timeout, verbose, strict,
            onResult: (r) => {
                if (quiet && r.ok && !r.warnings)
                    return;
                const status = r.ok ? green('ok  ') : red(bold('FAIL'));
                const size = r.size != null ? `${r.size} bytes` : '';
                console.log(`${status} ${r.preset} ${cyan(`[${r.tool}/${r.platform}]`)} ${dim(size)} ${dim(r.ms + 'ms')}`);
                for (const e of r.errors || [])
                    console.log(`       ${yellow(e)}`);
                if (r.ok)
                    for (const w of r.warnings || [])
                        console.log(`       ${dim('warning: ' + w)}`);
                if (r.internal)
                    console.log(`       ${red(bold('CRASH'))} ${red(r.internal)}`);
                if (r.log)
                    console.log(dim(r.log.split('\n').map((l) => '     | ' + l).join('\n')));
            },
        });
        const failed = results.filter((r) => !r.ok);
        const built = results.length - failed.length;
        const tally = `${built}/${results.length} examples build`;
        console.log('\n' + bold(failed.length ? yellow(tally) : green(tally)));
        if (failed.length) {
            const byTool = {};
            for (const r of failed)
                byTool[r.tool] = (byTool[r.tool] || 0) + 1;
            console.log('\n' + bold('failures:'));
            for (const r of failed)
                console.log(`  ${red(r.preset)} ${cyan(`[${r.tool}/${r.platform}]`)}`);
            console.log('\nby tool: ' + Object.keys(byTool).sort()
                .map((t) => `${cyan(t)}=${byTool[t]}`).join(' '));
        }
        const warned = results.filter((r) => r.ok && r.warnings);
        if (warned.length) {
            const nwarn = warned.reduce((n, r) => n + r.warnings.length, 0);
            console.log('\n' + yellow(`${nwarn} warning(s) in ${warned.length} example(s)`));
        }
        if (jsonFile) {
            const report = results.map((_a) => {
                var { log } = _a, r = __rest(_a, ["log"]);
                return (Object.assign(Object.assign({}, r), { log: undefined }));
            });
            fs.writeFileSync(jsonFile, JSON.stringify(report, null, 1));
            console.log(dim(`\nwrote ${jsonFile}`));
        }
        if (writeBaseline) {
            fs.writeFileSync(writeBaseline, JSON.stringify(results.map(baselineRecord), null, 1) + '\n');
            console.log(dim(`wrote ${writeBaseline}`));
        }
        if (baseline) {
            // the gate is about new breakage: an example that already failed
            // is in the baseline, and stays as it is
            const broke = (0, buildpresets_1.compareToBaseline)(results, baseline);
            if (broke)
                code = 1;
        }
        else if (failed.length) {
            code = 1;
        }
    }
    finally {
        // the worktree has to go before the process exits
        if (corpus.cleanup)
            corpus.cleanup();
    }
    return code;
}
if (require.main === module) {
    main().then((code) => process.exit(code))
        .catch((e) => { console.error(e); process.exit(2); });
}
//# sourceMappingURL=compatcheck.js.map