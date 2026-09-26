"use strict";
// projectcore - build logic shared by the IDE (CodeProject), the CLI
// (testlib), and the VS Code extension: dependency resolution, worker-message
// assembly, and build-result post-processing. No DOM, no fs, no Worker;
// callers supply file access through a FileProvider.
Object.defineProperty(exports, "__esModule", { value: true });
exports.stripLocalPath = stripLocalPath;
exports.candidatePaths = candidatePaths;
exports.parseDependencies = parseDependencies;
exports.resolveDependencies = resolveDependencies;
exports.buildWorkerMessage = buildWorkerMessage;
exports.processListings = processListings;
exports.findSourceFileForPath = findSourceFileForPath;
exports.getListingForFile = getListingForFile;
exports.mergeSegments = mergeSegments;
const util_1 = require("./util");
const toolmeta_1 = require("./toolmeta");
const workertypes_1 = require("./workertypes");
/** Remove the main file's folder from `path`; the worker sees paths relative to it. */
function stripLocalPath(path, mainPath) {
    if (mainPath) {
        var folder = (0, util_1.getFolderForPath)(mainPath);
        // TODO: kinda weird if folder is same name as file prefix
        if (folder != '' && path.startsWith(folder + '/')) {
            path = path.substring(folder.length + 1);
        }
    }
    return path;
}
/** Paths to try for a file named by a directive in `fromPath`, most specific first. */
function candidatePaths(fn, fromPath) {
    var dir = (0, util_1.getFolderForPath)(fromPath);
    if (dir.length > 0 && dir != 'local') // TODO
        return [dir + '/' + fn, fn];
    return [fn];
}
/**
 * The files a source names in its include and link directives. Patterns come
 * from the tool registry (toolmeta.ts), keyed by `tool`; the platform is only
 * a fallback. Each entry is a list of candidate paths (see candidatePaths).
 */
function parseDependencies(text, fromPath, tool, platformId) {
    var find = (patterns) => (0, toolmeta_1.matchDependencyPatterns)(text, patterns).map((fn) => candidatePaths(fn, fromPath));
    return {
        includes: find((0, toolmeta_1.getIncludePatterns)(tool, platformId)),
        links: find((0, toolmeta_1.getLinkPatterns)(tool, platformId)),
    };
}
/**
 * Every file the main file depends on, following includes of includes.
 * Breadth-first, so the main file's own dependencies keep their order. Each
 * file appears once, keyed by its stripped filename; the first candidate path
 * that exists wins. Included files are scanned with the tool of the file that
 * includes them; linked files with their own tool.
 */
async function resolveDependencies(fp, mainPath, mainText, platformId, getToolForFilename) {
    var result = [];
    var seen = new Set([stripLocalPath(mainPath, mainPath)]);
    var queue = [
        { path: mainPath, text: mainText, tool: getToolForFilename(mainPath) }
    ];
    while (queue.length) {
        var { path: fromPath, text, tool } = queue.shift();
        var deps = parseDependencies(text, fromPath, tool, platformId);
        var named = deps.includes.map((c) => ({ candidates: c, link: false }))
            .concat(deps.links.map((c) => ({ candidates: c, link: true })));
        for (var { candidates, link } of named) {
            for (var path of candidates) {
                var filename = stripLocalPath(path, mainPath);
                if (seen.has(filename))
                    break;
                var data = await fp.readFile(path);
                if (data == null)
                    continue;
                seen.add(filename);
                result.push({ path, filename, link, data });
                if (typeof data === 'string') {
                    queue.push({ path, text: data, tool: link ? getToolForFilename(path) : tool });
                }
                break;
            }
        }
    }
    return result;
}
/**
 * Assemble the worker message for a build. The main file is one step; each
 * linked file is a step of its own, except for remote tools (which ship
 * everything in the main step) and single-pass tools like oscar64 (which
 * compile linked sources with the main file).
 */
function buildWorkerMessage(src, depends) {
    var msg = { updates: [], buildsteps: [] };
    var filename2path = {};
    var preloads = [];
    var addPreload = (tool) => { if (tool && preloads.indexOf(tool) < 0)
        preloads.push(tool); };
    // TODO: add preproc directive for __MAINFILE__
    var mainfilename = stripLocalPath(src.mainPath, src.mainPath);
    msg.updates.push({ path: mainfilename, data: src.mainData });
    filename2path[mainfilename] = src.mainPath;
    var tool = src.getToolForFilename(src.mainPath);
    addPreload(tool);
    var usesRemoteTool = tool.startsWith('remote:');
    var compileLinkedSources = (0, toolmeta_1.getCompileLinkedSources)(tool);
    var depfiles = [];
    var linkfiles = [];
    for (var dep of depends) {
        if (!dep.link || usesRemoteTool || compileLinkedSources) {
            msg.updates.push({ path: dep.filename, data: dep.data });
            depfiles.push(dep.filename);
            if (dep.link && compileLinkedSources)
                linkfiles.push(dep.filename);
        }
        filename2path[dep.filename] = dep.path;
    }
    var mainstep = {
        path: mainfilename,
        files: [mainfilename].concat(depfiles),
        platform: src.platformId,
        tool: tool,
        mainfile: true,
    };
    if (linkfiles.length)
        mainstep.linkfiles = linkfiles;
    if (src.symbols)
        mainstep.symbols = src.symbols;
    if (src.buildArgs)
        mainstep.buildArgs = src.buildArgs;
    msg.buildsteps.push(mainstep);
    if (!usesRemoteTool && !compileLinkedSources) {
        for (var dep of depends) {
            if (dep.data && dep.link) {
                var linktool = src.getToolForFilename(dep.filename);
                addPreload(linktool);
                msg.updates.push({ path: dep.filename, data: dep.data });
                msg.buildsteps.push({
                    path: dep.filename,
                    files: [dep.filename].concat(depfiles),
                    platform: src.platformId,
                    tool: linktool,
                });
            }
        }
    }
    if (src.dataItems)
        msg.setitems = src.dataItems;
    return { msg, filename2path, preloads };
}
////// build results
/**
 * Attach SourceFile views to each listing. A single-pass tool (oscar64) emits
 * one listing that mixes source lines from the main file and every linked
 * library, each tagged with its own path; split those so each file can find
 * its own lines (see getListingForFile).
 */
function processListings(listings) {
    if (!listings)
        return;
    for (var lstname in listings) {
        var lst = listings[lstname];
        if (lst.lines) {
            lst.sourcefile = new workertypes_1.SourceFile(lst.lines, lst.text);
            var bypath = {};
            for (var info of lst.lines) {
                var p = info.path || '';
                (bypath[p] || (bypath[p] = [])).push(info);
            }
            var paths = Object.keys(bypath);
            if (paths.length > 1 || (paths.length == 1 && paths[0] != '')) {
                lst.sourcefiles = {};
                for (var p of paths)
                    lst.sourcefiles[p] = new workertypes_1.SourceFile(bypath[p], lst.text);
            }
        }
        if (lst.asmlines)
            lst.assemblyfile = new workertypes_1.SourceFile(lst.asmlines, lst.text);
    }
}
// look up the per-source-file view (see processListings) for `path`
function findSourceFileForPath(lst, path) {
    if (!lst || !lst.sourcefiles)
        return null;
    var want = (0, util_1.getFilenameForPath)((0, util_1.getFilenamePrefix)(path));
    for (var p in lst.sourcefiles) {
        if ((0, util_1.getFilenameForPath)((0, util_1.getFilenamePrefix)(p)) == want)
            return lst.sourcefiles[p];
    }
    return null;
}
// a copy of `lst` whose sourcefile holds only the lines for `path`, or `lst`
// unchanged if it has no per-source-file views
function withSourceFileForPath(lst, path) {
    var sf = findSourceFileForPath(lst, path);
    return sf ? Object.assign({}, lst, { sourcefile: sf }) : lst;
}
/** The listing for a project file: by exact name, then by filename prefix, then by source path within a mixed listing. */
function getListingForFile(listings, path, mainPath) {
    if (!listings)
        return undefined;
    var stripped = stripLocalPath(path, mainPath);
    var fnprefix = (0, util_1.getFilenamePrefix)(stripped);
    for (var lstfn in listings) {
        if (lstfn == path || lstfn == stripped)
            return withSourceFileForPath(listings[lstfn], stripped);
    }
    for (var lstfn in listings) {
        if ((0, util_1.getFilenamePrefix)(lstfn) == fnprefix)
            return withSourceFileForPath(listings[lstfn], stripped);
    }
    // no listing named after this file; it may be one source among many in a
    // single mixed listing (e.g. an oscar64 "//#link"ed source)
    for (var lstfn in listings) {
        var sf = findSourceFileForPath(listings[lstfn], stripped);
        if (sf)
            return Object.assign({}, listings[lstfn], { sourcefile: sf });
    }
}
/** The platform's native memory map merged with the linker's segments, sorted by address. */
function mergeSegments(nativeSegs, linkerSegs) {
    var segs = nativeSegs || [];
    segs.forEach(seg => seg.source = 'native');
    if (linkerSegs) {
        linkerSegs.forEach(seg => seg.source = 'linker');
        segs = segs.concat(linkerSegs);
    }
    segs.sort((a, b) => a.start - b.start);
    return segs;
}
//# sourceMappingURL=projectcore.js.map