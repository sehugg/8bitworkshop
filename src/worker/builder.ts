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
    return data as string; // TODO
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

  // returns true if file changed during this build step
  wasChanged(entry: FileEntry): boolean {
    return entry.ts > this.startseq;
  }
  async executeBuildSteps(): Promise<WorkerResult> {
    this.startseq = store.currentVersion();
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
      step.params = PLATFORM_PARAMS[getBasePlatform(platform)];
      try {
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

export function fixParamsWithDefines(path: string, params) {
  var libargs = params.libargs;
  if (path && libargs) {
    var code = getWorkFileAsString(path);
    if (code) {
      var oldcfgfile = params.cfgfile;
      var ident2index = {};
      // find all lib args "IDENT=VALUE"
      for (var i = 0; i < libargs.length; i++) {
        var toks = libargs[i].split('=');
        if (toks.length == 2) {
          ident2index[toks[0]] = i;
        }
      }
      // find #defines and replace them
      var re = /^[;/]?#define\s+(\w+)\s+(\S+)/gmi; // TODO: empty string?
      var m;
      while (m = re.exec(code)) {
        var ident = m[1];
        var value = m[2];
        var index = ident2index[ident];
        if (index >= 0) {
          libargs[index] = ident + "=" + value;
          console.log('Using libargs', index, libargs[index]);
          // TODO: MMC3 mapper switch
          if (ident == 'NES_MAPPER' && value == '4') {
            params.cfgfile = 'nesbanked.cfg';
            console.log("using config file", params.cfgfile);
          }
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
  }
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

