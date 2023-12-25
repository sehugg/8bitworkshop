"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.processEmbedDirective = exports.fixParamsWithDefines = exports.anyTargetChanged = exports.staleFiles = exports.populateExtraFiles = exports.populateFiles = exports.getPrefix = exports.gatherFiles = exports.populateEntry = exports.getWorkFileAsString = exports.putWorkFile = exports.endtime = exports.starttime = exports.builder = exports.Builder = exports.errorResult = exports.store = exports.FileWorkingStore = exports.PWORKER = void 0;
const util_1 = require("../common/util");
const platforms_1 = require("./platforms");
const workertools_1 = require("./workertools");
/// working file store and build steps
const PSRC = "../../src/";
exports.PWORKER = PSRC + "worker/";
;
///
class FileWorkingStore {
    constructor() {
        this.workfs = {};
        this.workerseq = 0;
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
    putFile(path, data) {
        var encoding = (typeof data === 'string') ? 'utf8' : 'binary';
        var entry = this.workfs[path];
        if (!entry || !compareData(entry.data, data) || entry.encoding != encoding) {
            this.workfs[path] = entry = { path: path, data: data, encoding: encoding, ts: this.newVersion() };
            console.log('+++', entry.path, entry.encoding, entry.data.length, entry.ts);
        }
        return entry;
    }
    hasFile(path) {
        return this.workfs[path] != null;
    }
    getFileData(path) {
        return this.workfs[path] && this.workfs[path].data;
    }
    getFileAsString(path) {
        let data = this.getFileData(path);
        if (data != null && typeof data !== 'string')
            throw new Error(`${path}: expected string`);
        return data; // TODO
    }
    getFileEntry(path) {
        return this.workfs[path];
    }
    setItem(key, value) {
        this.items[key] = value;
    }
}
exports.FileWorkingStore = FileWorkingStore;
exports.store = new FileWorkingStore();
///
function errorResult(msg) {
    return { errors: [{ line: 0, msg: msg }] };
}
exports.errorResult = errorResult;
class Builder {
    constructor() {
        this.steps = [];
        this.startseq = 0;
    }
    // returns true if file changed during this build step
    wasChanged(entry) {
        return entry.ts > this.startseq;
    }
    async executeBuildSteps() {
        this.startseq = exports.store.currentVersion();
        var linkstep = null;
        while (this.steps.length) {
            var step = this.steps.shift(); // get top of array
            var platform = step.platform;
            var [tool, remoteTool] = step.tool.split(':', 2);
            var toolfn = workertools_1.TOOLS[tool];
            if (!toolfn) {
                throw Error(`no tool named "${tool}"`);
            }
            if (remoteTool) {
                step.tool = remoteTool;
            }
            step.params = platforms_1.PLATFORM_PARAMS[(0, util_1.getBasePlatform)(platform)];
            try {
                step.result = await toolfn(step);
            }
            catch (e) {
                console.log("EXCEPTION", e, e.stack);
                return errorResult(e + ""); // TODO: catch errors already generated?
            }
            if (step.result) {
                step.result.params = step.params; // TODO: type check
                if (step.debuginfo) {
                    let r = step.result; // TODO
                    if (!r.debuginfo)
                        r.debuginfo = {};
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
                    }
                    else {
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
                    var asmstep = Object.assign({ tool: step.result.nexttool, platform: platform }, step.result);
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
    async handleMessage(data) {
        this.steps = [];
        // file updates
        if (data.updates) {
            data.updates.forEach((u) => exports.store.putFile(u.path, u.data));
        }
        // object update
        if (data.setitems) {
            data.setitems.forEach((i) => exports.store.setItem(i.key, i.value));
        }
        // build steps
        if (data.buildsteps) {
            this.steps.push.apply(this.steps, data.buildsteps);
        }
        // single-file
        if (data.code) {
            this.steps.push(data); // TODO: remove cast
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
exports.Builder = Builder;
function applyDefaultErrorPath(errors, path) {
    if (!path)
        return;
    for (var i = 0; i < errors.length; i++) {
        var err = errors[i];
        if (!err.path && err.line)
            err.path = path;
    }
}
function compareData(a, b) {
    if (a.length != b.length)
        return false;
    if (typeof a === 'string' && typeof b === 'string') {
        return a == b;
    }
    else {
        for (var i = 0; i < a.length; i++) {
            //if (a[i] != b[i]) console.log('differ at byte',i,a[i],b[i]);
            if (a[i] != b[i])
                return false;
        }
        return true;
    }
}
exports.builder = new Builder();
var _t1;
function starttime() { _t1 = new Date(); }
exports.starttime = starttime;
function endtime(msg) { var _t2 = new Date(); console.log(msg, _t2.getTime() - _t1.getTime(), "ms"); }
exports.endtime = endtime;
///
function putWorkFile(path, data) {
    return exports.store.putFile(path, data);
}
exports.putWorkFile = putWorkFile;
function getWorkFileAsString(path) {
    return exports.store.getFileAsString(path);
}
exports.getWorkFileAsString = getWorkFileAsString;
function populateEntry(fs, path, entry, options) {
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
            }
            catch (e) { }
    }
    // write file
    fs.writeFile(path, data, { encoding: entry.encoding });
    var time = new Date(entry.ts);
    fs.utime(path, time, time);
    console.log("<<<", path, entry.data.length);
}
exports.populateEntry = populateEntry;
// can call multiple times (from populateFiles)
function gatherFiles(step, options) {
    var maxts = 0;
    if (step.files) {
        for (var i = 0; i < step.files.length; i++) {
            var path = step.files[i];
            var entry = exports.store.workfs[path];
            if (!entry) {
                throw new Error("No entry for path '" + path + "'");
            }
            else {
                maxts = Math.max(maxts, entry.ts);
            }
        }
    }
    else if (step.code) {
        var path = step.path ? step.path : options.mainFilePath; // TODO: what if options null
        if (!path)
            throw Error("need path or mainFilePath");
        var code = step.code;
        var entry = putWorkFile(path, code);
        step.path = path;
        step.files = [path];
        maxts = entry.ts;
    }
    else if (step.path) {
        var path = step.path;
        var entry = exports.store.workfs[path];
        maxts = entry.ts;
        step.files = [path];
    }
    if (step.path && !step.prefix) {
        step.prefix = getPrefix(step.path);
    }
    step.maxts = maxts;
    return maxts;
}
exports.gatherFiles = gatherFiles;
function getPrefix(s) {
    var pos = s.lastIndexOf('.');
    return (pos > 0) ? s.substring(0, pos) : s;
}
exports.getPrefix = getPrefix;
function populateFiles(step, fs, options) {
    gatherFiles(step, options);
    if (!step.files)
        throw Error("call gatherFiles() first");
    for (var i = 0; i < step.files.length; i++) {
        var path = step.files[i];
        populateEntry(fs, path, exports.store.workfs[path], options);
    }
}
exports.populateFiles = populateFiles;
function populateExtraFiles(step, fs, extrafiles) {
    if (extrafiles) {
        for (var i = 0; i < extrafiles.length; i++) {
            var xfn = extrafiles[i];
            // is this file cached?
            if (exports.store.workfs[xfn]) {
                fs.writeFile(xfn, exports.store.workfs[xfn].data, { encoding: 'binary' });
                continue;
            }
            // fetch from network
            var xpath = "lib/" + (0, util_1.getBasePlatform)(step.platform) + "/" + xfn;
            var xhr = new XMLHttpRequest();
            xhr.responseType = 'arraybuffer';
            xhr.open("GET", exports.PWORKER + xpath, false); // synchronous request
            xhr.send(null);
            if (xhr.response && xhr.status == 200) {
                var data = new Uint8Array(xhr.response);
                fs.writeFile(xfn, data, { encoding: 'binary' });
                putWorkFile(xfn, data);
                console.log(":::", xfn, data.length);
            }
            else {
                throw Error("Could not load extra file " + xpath);
            }
        }
    }
}
exports.populateExtraFiles = populateExtraFiles;
function staleFiles(step, targets) {
    if (!step.maxts)
        throw Error("call populateFiles() first");
    // see if any target files are more recent than inputs
    for (var i = 0; i < targets.length; i++) {
        var entry = exports.store.workfs[targets[i]];
        if (!entry || step.maxts > entry.ts)
            return true;
    }
    console.log("unchanged", step.maxts, targets);
    return false;
}
exports.staleFiles = staleFiles;
function anyTargetChanged(step, targets) {
    if (!step.maxts)
        throw Error("call populateFiles() first");
    // see if any target files are more recent than inputs
    for (var i = 0; i < targets.length; i++) {
        var entry = exports.store.workfs[targets[i]];
        if (!entry || entry.ts > step.maxts)
            return true;
    }
    console.log("unchanged", step.maxts, targets);
    return false;
}
exports.anyTargetChanged = anyTargetChanged;
function fixParamsWithDefines(path, params) {
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
            var re = /^[;]?#define\s+(\w+)\s+(\S+)/gmi; // TODO: empty string?
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
                }
                else if (ident == 'CFGFILE' && value) {
                    params.cfgfile = value;
                }
                else if (ident == 'LIBARGS' && value) {
                    params.libargs = value.split(',').filter((s) => { return s != ''; });
                    console.log('Using libargs', params.libargs);
                }
                else if (ident == 'CC65_FLAGS' && value) {
                    params.extra_compiler_args = value.split(',').filter((s) => { return s != ''; });
                    console.log('Using compiler flags', params.extra_compiler_args);
                }
            }
        }
    }
}
exports.fixParamsWithDefines = fixParamsWithDefines;
function processEmbedDirective(code) {
    let re3 = /^\s*#embed\s+"(.+?)"/gm;
    // find #embed "filename.bin" and replace with C array data
    return code.replace(re3, (m, m1) => {
        let filename = m1;
        let filedata = exports.store.getFileData(filename);
        let bytes = (0, util_1.convertDataToUint8Array)(filedata);
        if (!bytes)
            throw new Error('#embed: file not found: "' + filename + '"');
        let out = '';
        for (let i = 0; i < bytes.length; i++) {
            out += bytes[i].toString() + ',';
        }
        return out.substring(0, out.length - 1);
    });
}
exports.processEmbedDirective = processEmbedDirective;
//# sourceMappingURL=builder.js.map