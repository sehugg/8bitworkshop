import { getPlatformToolConfig, getToolMeta } from "../common/toolmeta";
import { convertDataToUint8Array, getBasePlatform } from "../common/util";
import { WorkerBuildStep, WorkerError, WorkerErrorResult, WorkerMessage, WorkerResult, WorkingStore } from "../common/workertypes";
import { PLATFORM_PARAMS } from "./platforms";
import { TOOLS } from "./workertools";

/// working file store and build steps

const PSRC = "../../src/";
export const PWORKER = PSRC + "worker/";

export type FileData = string | Uint8Array;

export type FileEntry = {
  path: string
  encoding: string
  data: FileData
  ts: number
};

export type BuildOptions = {
  mainFilePath: string,
  processFn?: (s: string, d: FileData) => FileData
};

// TODO
export type BuildStepResult = WorkerResult | WorkerNextToolResult;

export interface WorkerNextToolResult {
  nexttool?: string
  linktool?: string
  path?: string
  args: string[]
  files: string[]
  bblines?: boolean
}

export interface BuildStep extends WorkerBuildStep {
  files?: string[]
  args?: string[]
  nextstep?: BuildStep
  linkstep?: BuildStep
  params?
  result?: BuildStepResult
  code?
  prefix?
  maxts?
  debuginfo?
};

///

export function fixLineEndings(data: any): any {
  if (typeof data === 'string') {
    // C build tools require LF line endings.
    return data.replace(/\r\n/g, '\n');
  }
  return data;
}

export class FileWorkingStore implements WorkingStore {
  workfs: { [path: string]: FileEntry } = {};
  workerseq: number = 0;
  items: {};

  constructor() {
    this.reset();
  }
  reset() {
    this.workfs = {};
    this.newVersion();
  }
  currentVersion() {
    return this.workerseq;
  }
  newVersion() {
    let ts = new Date().getTime();
    if (ts <= this.workerseq)
      ts = ++this.workerseq;
    return ts;
  }
  putFile(path: string, data: FileData): FileEntry {
    var encoding = (typeof data === 'string') ? 'utf8' : 'binary';
    var entry = this.workfs[path];
    if (!entry || !compareData(entry.data, data) || entry.encoding != encoding) {
      this.workfs[path] = entry = { path: path, data: data, encoding: encoding, ts: this.newVersion() };
      console.log('+++', entry.path, entry.encoding, entry.data.length, entry.ts);
    }
    return entry;
  }
  hasFile(path: string) {
    return this.workfs[path] != null;
  }
  getFileData(path: string): FileData {
    return this.workfs[path] && this.workfs[path].data;
  }
  getFileAsString(path: string): string {
    let data = this.getFileData(path);
    if (data != null && typeof data !== 'string')
      throw new Error(`${path}: expected string`)
    return fixLineEndings(data) as string; // TODO
  }
  getFileEntry(path: string): FileEntry {
    return this.workfs[path];
  }
  setItem(key: string, value: object) {
    this.items[key] = value;
  }
}

export var store = new FileWorkingStore();

///

export function errorResult(msg: string): WorkerErrorResult {
  return { errors: [{ line: 0, msg: msg }] };
}

export class Builder {
  steps: BuildStep[] = [];
  startseq: number = 0;
  // platform params for the build in progress -- see paramsForBuild()
  buildParams: { [platform: string]: {} } = {};

  // returns true if file changed during this build step
  wasChanged(entry: FileEntry): boolean {
    return entry.ts > this.startseq;
  }

  /**
   * The platform params for this build. Tools rewrite them in place --
   * fixParamsWithDefines() applies the source build directives (//#symbol,
   * //#flag, //#tooldef, plus the legacy #define CFGFILE/LIBARGS/NES_MAPPER
   * forms), and ecs picks its own cfgfile -- and later steps read the result,
   * which is how the linker learns which config file to use. So the copy is
   * per build, not per step: shared by every step of one build, thrown away
   * afterwards so one source file's directives can't follow the next build
   * around.
   */
  paramsForBuild(platform: string) {
    if (!this.buildParams[platform]) {
      const params = PLATFORM_PARAMS[platform] || PLATFORM_PARAMS[getBasePlatform(platform)];
      this.buildParams[platform] = cloneParams(params);
    }
    return this.buildParams[platform];
  }

  async executeBuildSteps(): Promise<WorkerResult> {
    this.startseq = store.currentVersion();
    this.buildParams = {};
    var linkstep: BuildStep = null;
    while (this.steps.length) {
      var step = this.steps.shift(); // get top of array
      var platform = step.platform;
      var [tool, remoteTool] = step.tool.split(':', 2);
      var toolfn = TOOLS[tool];
      if (!toolfn) {
        throw Error(`no tool named "${tool}"`);
      }
      if (remoteTool) {
        step.tool = remoteTool;
      }
      step.params = this.paramsForBuild(platform);
      try {
        applyPlatformAndStepParams(step);
        step.result = await toolfn(step);
      } catch (e) {
        console.log("EXCEPTION", e, e.stack);
        return errorResult(e + ""); // TODO: catch errors already generated?
      }
      if (step.result) {
        (step.result as any).params = step.params; // TODO: type check
        if (step.debuginfo) {
          let r = step.result as any; // TODO
          if (!r.debuginfo) r.debuginfo = {};
          Object.assign(r.debuginfo, step.debuginfo);
        }
        // errors? return them
        if ('errors' in step.result && step.result.errors.length) {
          applyDefaultErrorPath(step.result.errors, step.path);
          return step.result;
        }
        // if we got some output, return it immediately
        if ('output' in step.result && step.result.output) {
          return step.result;
        }
        // combine files with a link tool?
        if ('linktool' in step.result) {
          // add to existing link step
          if (linkstep) {
            linkstep.files = linkstep.files.concat(step.result.files);
            linkstep.args = linkstep.args.concat(step.result.args);
          } else {
            linkstep = {
              tool: step.result.linktool,
              platform: platform,
              files: step.result.files,
              args: step.result.args
            };
          }
          linkstep.debuginfo = step.debuginfo; // TODO: multiple debuginfos
        }
        // process with another tool?
        if ('nexttool' in step.result) {
          var asmstep: BuildStep = {
            tool: step.result.nexttool,
            platform: platform,
            ...step.result
          }
          this.steps.push(asmstep);
        }
        // process final step?
        if (this.steps.length == 0 && linkstep) {
          this.steps.push(linkstep);
          linkstep = null;
        }
      }
    }
  }
  async handleMessage(data: WorkerMessage): Promise<WorkerResult> {
    this.steps = [];
    // file updates
    if (data.updates) {
      data.updates.forEach((u) => store.putFile(u.path, u.data));
    }
    // object update
    if (data.setitems) {
      data.setitems.forEach((i) => store.setItem(i.key, i.value));
    }
    // build steps
    if (data.buildsteps) {
      this.steps.push.apply(this.steps, data.buildsteps);
    }
    // single-file
    if (data.code) {
      this.steps.push(data as BuildStep); // TODO: remove cast
    }
    // execute build steps
    if (this.steps.length) {
      var result = await this.executeBuildSteps();
      return result ? result : { unchanged: true };
    }
    // TODO: cache results
    // message not recognized
    console.log("Unknown message", data);
  }
}

function applyDefaultErrorPath(errors: WorkerError[], path: string) {
  if (!path) return;
  for (var i = 0; i < errors.length; i++) {
    var err = errors[i];
    if (!err.path && err.line) err.path = path;
  }
}

function compareData(a: FileData, b: FileData): boolean {
  if (a.length != b.length) return false;
  if (typeof a === 'string' && typeof b === 'string') {
    return a == b;
  } else {
    for (var i = 0; i < a.length; i++) {
      //if (a[i] != b[i]) console.log('differ at byte',i,a[i],b[i]);
      if (a[i] != b[i]) return false;
    }
    return true;
  }
}

export const builder = new Builder();

var _t1;
export function starttime() { _t1 = new Date(); }
export function endtime(msg) { var _t2 = new Date(); console.log(msg, _t2.getTime() - _t1.getTime(), "ms"); }

///

export function putWorkFile(path: string, data: FileData) {
  return store.putFile(path, data);
}

export function getWorkFileAsString(path: string): string {
  return store.getFileAsString(path);
}

export function populateEntry(fs, path: string, entry: FileEntry, options: BuildOptions) {
  var data = entry.data;
  if (options && options.processFn) {
    data = options.processFn(path, data);
  }
  data = fixLineEndings(data);
  // create subfolders
  var toks = path.split('/');
  if (toks.length > 1) {
    for (var i = 0; i < toks.length - 1; i++)
      try {
        fs.mkdir(toks[i]);
      } catch (e) { }
  }
  // write file
  fs.writeFile(path, data, { encoding: entry.encoding });
  var time = new Date(entry.ts);
  fs.utime(path, time, time);
  console.log("<<<", path, entry.data.length);
}

// can call multiple times (from populateFiles)
export function gatherFiles(step: BuildStep, options?: BuildOptions): number {
  var maxts = 0;
  if (step.files) {
    for (var i = 0; i < step.files.length; i++) {
      var path = step.files[i];
      var entry = store.workfs[path];
      if (!entry) {
        throw new Error("No entry for path '" + path + "'");
      } else {
        maxts = Math.max(maxts, entry.ts);
      }
    }
  }
  else if (step.code) {
    var path = step.path ? step.path : options.mainFilePath; // TODO: what if options null
    if (!path) throw Error("need path or mainFilePath");
    var code = step.code;
    var entry = putWorkFile(path, code);
    step.path = path;
    step.files = [path];
    maxts = entry.ts;
  }
  else if (step.path) {
    var path = step.path;
    var entry = store.workfs[path];
    maxts = entry.ts;
    step.files = [path];
  }
  if (step.path && !step.prefix) {
    step.prefix = getPrefix(step.path);
  }
  step.maxts = maxts;
  return maxts;
}

export function getPrefix(s: string): string {
  var pos = s.lastIndexOf('.');
  return (pos > 0) ? s.substring(0, pos) : s;
}

export function populateFiles(step: BuildStep, fs, options?: BuildOptions) {
  gatherFiles(step, options);
  if (!step.files) throw Error("call gatherFiles() first");
  for (var i = 0; i < step.files.length; i++) {
    var path = step.files[i];
    populateEntry(fs, path, store.workfs[path], options);
  }
}

export function populateExtraFiles(step: BuildStep, fs, extrafiles) {
  if (extrafiles) {
    for (var i = 0; i < extrafiles.length; i++) {
      var xfn = extrafiles[i];
      // is this file cached?
      if (store.workfs[xfn]) {
        fs.writeFile(xfn, store.workfs[xfn].data, { encoding: 'binary' });
        continue;
      }
      // fetch from network
      var xpath = "lib/" + getBasePlatform(step.platform) + "/" + xfn;
      var xhr = new XMLHttpRequest();
      xhr.responseType = 'arraybuffer';
      xhr.open("GET", PWORKER + xpath, false);  // synchronous request
      xhr.send(null);
      if (xhr.response && xhr.status == 200) {
        var data = new Uint8Array(xhr.response);
        fs.writeFile(xfn, data, { encoding: 'binary' });
        putWorkFile(xfn, data);
        console.log(":::", xfn, data.length);
      } else {
        throw Error("Could not load extra file " + xpath);
      }
    }
  }
}

export function staleFiles(step: BuildStep, targets: string[]) {
  if (!step.maxts) throw Error("call populateFiles() first");
  // see if any target files are more recent than inputs
  for (var i = 0; i < targets.length; i++) {
    var entry = store.workfs[targets[i]];
    if (!entry || step.maxts > entry.ts)
      return true;
  }
  console.log("unchanged", step.maxts, targets);
  return false;
}

export function anyTargetChanged(step: BuildStep, targets: string[]) {
  if (!step.maxts) throw Error("call populateFiles() first");
  // see if any target files are more recent than inputs
  for (var i = 0; i < targets.length; i++) {
    var entry = store.workfs[targets[i]];
    if (!entry || entry.ts > step.maxts)
      return true;
  }
  console.log("unchanged", step.maxts, targets);
  return false;
}

/**
 * Some platforms link a hand-written assembly project differently than a C one.
 * The VCS is the case in point: a ca65 program supplies its own reset code and
 * interrupt vectors, so linking it against crt0.o (which has vectors of its
 * own) and the bank-switched config its C programs use can only collide. A
 * platform spells the difference out with asm_-prefixed copies of the link
 * params -- asm_cfgfile, asm_libargs, asm_extra_link_files -- which the
 * assembler applies when the project's main file is its own source, and which
 * nothing else looks at. Runs before fixParamsWithDefines() so that a source
 * file's own directive (//#tooldef ... cfgfile=, or a legacy CFGFILE define)
 * still has the last word.
 */
export function applyAsmProjectParams(params) {
  for (const key of Object.keys(params)) {
    if (key.startsWith('asm_')) params[key.substring(4)] = params[key];
  }
}

/**
 * Build directives. Three explicit, comment-marked forms replace the ad-hoc
 * `#define CFGFILE/LIBARGS/CC65_FLAGS/NES_MAPPER` scan:
 *
 *   //#symbol [<phase>] NAME[=VALUE]   phase in c|as|ld (default c)
 *   //#flag   <phase> <args...>        raw argv for one phase
 *   //#tooldef <phase> NAME=VALUE      typed knob (linker: cfgfile, libargs)
 *
 * Symbols are phase-scoped because they are different things: a preprocessor
 * macro (`c`) takes text, while an assembler/linker global (`as`/`ld`) is an
 * integer expression (ld65 `-D sym=val` errors on strings; sdldz80 `-g` hard-
 * errors on redefinition). `#flag` is the opaque escape hatch that the build
 * engine can neither interpret nor validate.
 *
 * The marker is a comment to every tool (`//` in C, `;` in asm) and the
 * keywords are not language tokens, so a directive never collides with a real
 * #define or macro. Commenting out must break the marker (////# or ;;#),
 * which is deliberately not recognized -- unlike the legacy `;#define`, where
 * a comment character still arms the directive.
 */
export type BuildPhase = 'compiler' | 'assembler' | 'linker';

export interface PhaseLists {
  compiler: string[];
  assembler: string[];
  linker: string[];
}

export interface SourceDirectives {
  /** `//#symbol` defines, keyed by phase (NAME or NAME=VALUE) */
  symbols: PhaseLists;
  /** `//#flag` raw argv, keyed by phase */
  flags: PhaseLists;
  /** `//#tooldef` typed knobs */
  tooldefs: { phase: BuildPhase; name: string; value: string }[];
  errors: string[];
}

const PHASE_ALIASES: { [k: string]: BuildPhase } = {
  c: 'compiler', cc: 'compiler', compiler: 'compiler',
  as: 'assembler', asm: 'assembler', assembler: 'assembler',
  ld: 'linker', link: 'linker', linker: 'linker',
};

const PHASES: BuildPhase[] = ['compiler', 'assembler', 'linker'];

/** Deep-copy platform params so a build can't mutate PLATFORM_PARAMS. */
function cloneParams(params) {
  if (!params || typeof params !== 'object') return params;
  if (Array.isArray(params)) return params.slice();
  let copy = {};
  for (const key in params) copy[key] = cloneParams(params[key]);
  return copy;
}

function emptyDirectives(): SourceDirectives {
  return {
    symbols: { compiler: [], assembler: [], linker: [] },
    flags: { compiler: [], assembler: [], linker: [] },
    tooldefs: [],
    errors: [],
  };
}

/** Fold b's lists (and errors) into a, so several sources share one apply. */
function mergeDirectives(a: SourceDirectives, b: SourceDirectives) {
  for (let phase of PHASES) {
    a.symbols[phase].push.apply(a.symbols[phase], b.symbols[phase]);
    a.flags[phase].push.apply(a.flags[phase], b.flags[phase]);
  }
  a.tooldefs.push.apply(a.tooldefs, b.tooldefs);
  a.errors.push.apply(a.errors, b.errors);
}

/** Platform/tool-default defines+args, routed to a phase by the tool's kind. */
function directivesFromConfig(tool: string, cfg): SourceDirectives {
  let dir = emptyDirectives();
  let meta = getToolMeta(tool);
  let symphase: BuildPhase = (meta && meta.kind === 'assembler') ? 'assembler' : 'compiler';
  if (cfg.defines) dir.symbols[symphase].push.apply(dir.symbols[symphase], cfg.defines);
  if (cfg.buildArgs) {
    for (let phase of PHASES) {
      if (cfg.buildArgs[phase]) dir.flags[phase].push.apply(dir.flags[phase], cfg.buildArgs[phase]);
    }
  }
  return dir;
}

/** CLI/project overrides carried on the step (symbols + raw args per phase). */
function directivesFromOverrides(symbols, buildArgs): SourceDirectives {
  let dir = emptyDirectives();
  if (symbols) {
    for (let phase of PHASES) if (symbols[phase]) dir.symbols[phase].push.apply(dir.symbols[phase], symbols[phase]);
  }
  if (buildArgs) {
    for (let phase of PHASES) if (buildArgs[phase]) dir.flags[phase].push.apply(dir.flags[phase], buildArgs[phase]);
  }
  return dir;
}

/**
 * Layer build config onto a step's params: platform/tool defaults first (once
 * per tool+platform), then CLI/project overrides carried on the step. Source
 * directives are applied later and have the last word.
 */
function applyPlatformAndStepParams(step: BuildStep) {
  let params = step.params;
  // tools whose platform has no params (e.g. inform6) have nothing to layer onto
  if (!params || typeof params !== 'object') return;
  let cfgKey = step.tool + '|' + step.platform;
  params.appliedPlatformCfg = params.appliedPlatformCfg || {};
  let dir = emptyDirectives();
  if (!params.appliedPlatformCfg[cfgKey]) {
    let cfg = getPlatformToolConfig(step.tool, step.platform);
    if (cfg && (cfg.defines || cfg.buildArgs)) {
      params.appliedPlatformCfg[cfgKey] = true;
      mergeDirectives(dir, directivesFromConfig(step.tool, cfg));
    }
  }
  let symbols = (step as any).symbols, buildArgs = (step as any).buildArgs;
  if (symbols || buildArgs)
    mergeDirectives(dir, directivesFromOverrides(symbols, buildArgs));
  applyBuildDirectives(dir, params);
  if (dir.errors.length)
    throw new Error('build config error: ' + dir.errors.join('; '));
}

/** Split a directive body into argv, honoring single/double quotes. */
function splitDirectiveArgs(s: string): string[] {
  let out: string[] = [];
  let re = /"([^"]*)"|'([^']*)'|(\S+)/g;
  let m;
  while ((m = re.exec(s)))
    out.push(m[1] != null ? m[1] : m[2] != null ? m[2] : m[3]);
  return out;
}

/**
 * A linker symbol value must be an integer expression. Rejecting text here is
 * what keeps a string define (`#symbol FOO=bar`) out of `ld65 -D FOO=bar`,
 * which would fail with "Constant expression expected".
 */
function isIntegerExpression(v: string): boolean {
  return v.length > 0 && /^[\s0-9a-fA-F$xX+\-*/%()&|^~<>]+$/.test(v);
}

/** Merge NAME=VALUE into a list, replacing any entry with the same NAME. */
function mergeByName(list: string[], entry: string): string[] {
  let name = entry.split('=')[0];
  return list.filter((e) => e.split('=')[0] !== name).concat(entry);
}

/**
 * A platform may map a link symbol value to a linker config (NES_MAPPER=4 ->
 * nesbanked.cfg). Kept data-driven so the parser has no platform special cases.
 */
function applySymbolConfigs(params, entries: string[]) {
  let configs = params && params.symbolConfigs;
  if (!configs) return;
  for (let e of entries) {
    let eq = e.indexOf('=');
    if (eq < 0) continue;
    let name = e.substring(0, eq), value = e.substring(eq + 1);
    let cfg = configs[name] && configs[name][value];
    if (cfg) { params.cfgfile = cfg; console.log('using config file', cfg); }
  }
}

/**
 * Record a linker symbol. If the platform already passes `NAME=...` in
 * libargs, the entry is replaced in place -- appending instead would define the
 * symbol twice ("Redefinition of symbol", "Definition of public symbol ...").
 */
function setLinkSymbol(params, symbols: PhaseLists, entry: string) {
  let name = entry.split('=')[0];
  let la = params.libargs;
  if (la) {
    for (let i = 0; i < la.length; i++) {
      if (la[i].split('=')[0] === name) {
        la[i] = entry;
        applySymbolConfigs(params, [entry]);
        return;
      }
    }
  }
  symbols.linker = mergeByName(symbols.linker, entry);
  applySymbolConfigs(params, [entry]);
}

/** Parse the explicit `//#` build directives out of source text. */
export function parseBuildDirectives(code: string): SourceDirectives {
  let out: SourceDirectives = emptyDirectives();
  if (!code) return out;
  let re = /^[ \t]*(?:\/\/|;)#(symbol|flag|tooldef)\b([^\n]*)/gmi;
  let m;
  while ((m = re.exec(code))) {
    let kw = m[1].toLowerCase();
    let raw = m[2].trim();
    let parts = raw.split(/\s+/);
    let phase: BuildPhase = 'compiler';
    let rest = raw;
    if (parts.length > 1 && PHASE_ALIASES[parts[0].toLowerCase()]) {
      phase = PHASE_ALIASES[parts[0].toLowerCase()];
      rest = raw.substring(parts[0].length).trim();
    }
    if (kw === 'flag') {
      let argv = splitDirectiveArgs(rest);
      if (!argv.length) { out.errors.push(`#flag: expected '<phase> args...'`); continue; }
      out.flags[phase].push.apply(out.flags[phase], argv);
    } else if (kw === 'symbol') {
      let sm = /^(\w+)(?:\s*=\s*(.+))?$/.exec(rest);
      if (!sm) { out.errors.push(`#symbol: expected 'NAME[=VALUE]': '${raw}'`); continue; }
      let value = sm[2] != null ? sm[2].trim() : null;
      let entry = value != null ? sm[1] + '=' + value : sm[1];
      if (phase === 'linker' && !isIntegerExpression(value || '')) {
        out.errors.push(`#symbol linker: value must be an integer expression: '${entry}'`);
        continue;
      }
      out.symbols[phase].push(entry);
    } else { // tooldef
      let tm = /^(\w+)\s*=\s*(.+)$/.exec(rest);
      if (!tm) { out.errors.push(`#tooldef: expected 'NAME=VALUE': '${raw}'`); continue; }
      out.tooldefs.push({ phase, name: tm[1], value: tm[2].trim() });
    }
  }
  return out;
}

/** Apply parsed directives onto the shared per-build params object. */
export function applyBuildDirectives(dir: SourceDirectives, params) {
  if (!params) return;
  let S: PhaseLists = params.symbols;
  if (!S) S = params.symbols = { compiler: [], assembler: [], linker: [] };
  for (let phase of PHASES) if (!S[phase]) S[phase] = [];
  let B = params.buildArgs;
  if (!B) B = params.buildArgs = { compiler: [], assembler: [], linker: [] };
  for (let phase of PHASES) {
    for (let s of dir.symbols[phase]) {
      if (phase === 'linker') {
        // enforced here too, so CLI/project overrides can't smuggle text into ld65 -D
        let eq = s.indexOf('=');
        if (eq < 0 || !isIntegerExpression(s.substring(eq + 1))) {
          dir.errors.push(`link symbol must be NAME=INTEXPR: '${s}'`);
          continue;
        }
        setLinkSymbol(params, S, s);
      } else {
        S[phase] = mergeByName(S[phase], s);
      }
    }
    B[phase].push.apply(B[phase], dir.flags[phase]);
  }
  for (let td of dir.tooldefs) {
    if (td.phase === 'linker' && td.name === 'cfgfile') {
      params.cfgfile = td.value;
    } else if (td.phase === 'linker' && td.name === 'libargs') {
      params.libargs = td.value.split(',').filter((s) => s !== '');
    } else {
      dir.errors.push(`#tooldef: unknown ${td.phase} param '${td.name}'`);
    }
  }
}

/**
 * Legacy `#define` scan plus the explicit `//#` directives. Kept in one place
 * so every tool that used to call the old scanner keeps working; the legacy
 * forms can be retired once presets migrate.
 */
export function fixParamsWithDefines(path: string, params) {
  if (!path) return;
  var code = getWorkFileAsString(path);
  if (!code) return;
  // directives are per source file; a build can scan the same file from more
  // than one step, so apply each file once (raw #flag pushes are not idempotent)
  params.directivePaths = params.directivePaths || {};
  if (params.directivePaths[path]) return;
  params.directivePaths[path] = true;

  // 1. legacy `#define` scan -- semantics preserved exactly for compatibility
  var libargs = params.libargs;
  if (libargs) {
    var ident2index = {};
    for (var i = 0; i < libargs.length; i++) {
      var toks = libargs[i].split('=');
      if (toks.length == 2) ident2index[toks[0]] = i;
    }
    var re = /^[;/]?#define\s+(\w+)\s+(\S+)/gmi; // TODO: empty string?
    var m;
    while (m = re.exec(code)) {
      var ident = m[1];
      var value = m[2];
      var index = ident2index[ident];
      if (index >= 0) {
        libargs[index] = ident + "=" + value;
        console.log('Using libargs', index, libargs[index]);
        applySymbolConfigs(params, [libargs[index]]);
      } else if (ident == 'CFGFILE' && value) {
        params.cfgfile = value;
      } else if (ident == 'LIBARGS' && value) {
        params.libargs = value.split(',').filter((s) => { return s != ''; });
        console.log('Using libargs', params.libargs);
      } else if (ident == 'CC65_FLAGS' && value) {
        params.extra_compiler_args = value.split(',').filter((s) => { return s != ''; });
        console.log('Using compiler flags', params.extra_compiler_args);
      }
    }
  }

  // 2. explicit //# directives
  var dir = parseBuildDirectives(code);
  applyBuildDirectives(dir, params);
  // malformed directives are a build-config error, not a silent no-op
  if (dir.errors.length)
    throw new Error('build directive error: ' + dir.errors.join('; '));
}

export function processEmbedDirective(code: string) {
  let re3 = /^\s*#embed\s+"(.+?)"/gm;
  // find #embed "filename.bin" and replace with C array data
  return code.replace(re3, (m, m1) => {
      let filename = m1;
      let filedata = store.getFileData(filename);
      let bytes = convertDataToUint8Array(filedata);
      if (!bytes) throw new Error('#embed: file not found: "' + filename + '"');
      let out = '';
      for (let i = 0; i < bytes.length; i++) {
          out += bytes[i].toString() + ',';
      }
      return out.substring(0, out.length-1);
  });
}

