"use strict";
// testlib - Clean async API for compiling and testing 8bitworkshop projects
// Wraps the worker build system for use in tests and CLI tools
// FOR TESTING ONLY
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
Object.defineProperty(exports, "__esModule", { value: true });
exports.TOOLS = exports.PLATFORM_PARAMS = exports.TOOL_PRELOADFS = exports.store = void 0;
exports.initialize = initialize;
exports.preload = preload;
exports.compile = compile;
exports.compileFile = compileFile;
exports.getToolForFilename = getToolForFilename;
exports.compileSourceFile = compileSourceFile;
exports.listTools = listTools;
exports.listPlatforms = listPlatforms;
exports.ab2str = ab2str;
exports.createMockLocalStorage = createMockLocalStorage;
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
const util_1 = require("../common/util");
const baseplatform_1 = require("../common/baseplatform");
const workerlib_1 = require("../worker/workerlib");
Object.defineProperty(exports, "store", { enumerable: true, get: function () { return workerlib_1.store; } });
Object.defineProperty(exports, "TOOL_PRELOADFS", { enumerable: true, get: function () { return workerlib_1.TOOL_PRELOADFS; } });
const platforms_1 = require("../worker/platforms");
Object.defineProperty(exports, "PLATFORM_PARAMS", { enumerable: true, get: function () { return platforms_1.PLATFORM_PARAMS; } });
const workertools_1 = require("../worker/workertools");
Object.defineProperty(exports, "TOOLS", { enumerable: true, get: function () { return workertools_1.TOOLS; } });
let initialized = false;
/**
 * Initialize the Node.js environment for compilation.
 * Must be called once before any compile/preload calls.
 */
async function initialize() {
    if (initialized)
        return;
    (0, workerlib_1.setupNodeEnvironment)();
    // The worker tools are already registered through the import chain:
    // workerlib -> workertools -> tools/* and builder -> TOOLS
    // No need to load the esbuild bundle.
    initialized = true;
}
/**
 * Preload a tool's filesystem (e.g. CC65 standard libraries).
 */
async function preload(tool, platform) {
    await initialize();
    var msg = { preload: tool };
    if (platform)
        msg.platform = platform;
    await (0, workerlib_1.handleMessage)(msg);
}
/**
 * Compile source code with the specified tool and platform.
 */
async function compile(options) {
    await initialize();
    // Reset the store for a clean build
    await (0, workerlib_1.handleMessage)({ reset: true });
    let result;
    if (options.files && options.buildsteps) {
        // Multi-file build
        var msg = {
            updates: options.files.map(f => ({ path: f.path, data: f.data })),
            buildsteps: options.buildsteps
        };
        result = await (0, workerlib_1.handleMessage)(msg);
    }
    else {
        // Single-file build
        var msg = {
            code: options.code,
            platform: options.platform,
            tool: options.tool,
            path: options.path || ('src.' + options.tool),
            mainfile: options.mainfile !== false
        };
        result = await (0, workerlib_1.handleMessage)(msg);
    }
    return workerResultToCompileResult(result);
}
/**
 * Compile a file from the presets directory.
 */
async function compileFile(tool, platform, presetPath) {
    await initialize();
    var code = fs.readFileSync('presets/' + platform + '/' + presetPath, 'utf-8');
    return compile({
        tool: tool,
        platform: platform,
        code: code,
        path: presetPath,
    });
}
/**
 * Parse include and link dependencies from source text.
 * Extracted from CodeProject.parseIncludeDependencies / parseLinkDependencies.
 * TODO: project.ts should be refactored so we don't have to duplicate the logic
 */
function parseIncludeDependencies(text, platformId, mainPath) {
    let files = [];
    let m;
    var dir = (0, util_1.getFolderForPath)(mainPath);
    function pushFile(fn) {
        files.push(fn);
        if (dir.length > 0 && dir != 'local')
            files.push(dir + '/' + fn);
    }
    if (platformId.startsWith('verilog')) {
        let re1 = /^\s*(`include|[.]include)\s+"(.+?)"/gmi;
        while (m = re1.exec(text)) {
            pushFile(m[2]);
        }
        let re1a = /^\s*\$(include|\$dofile|\$write_image_in_table)\('(.+?)'/gmi;
        while (m = re1a.exec(text)) {
            pushFile(m[2]);
        }
        let re2 = /^\s*([.]arch)\s+(\w+)/gmi;
        while (m = re2.exec(text)) {
            pushFile(m[2] + ".json");
        }
        let re3 = /\$readmem[bh]\("(.+?)"/gmi;
        while (m = re3.exec(text)) {
            pushFile(m[1]);
        }
    }
    else {
        let re2 = /^\s*[.#%]?(include|incbin|embed)\s+"(.+?)"/gmi;
        while (m = re2.exec(text)) {
            pushFile(m[2]);
        }
        let re3 = /^\s*([;']|[/][/])#(resource)\s+"(.+?)"/gm;
        while (m = re3.exec(text)) {
            pushFile(m[3]);
        }
        let re4 = /^\s+(USE|ASM)\s+(\S+[.]\S+)/gm;
        while (m = re4.exec(text)) {
            pushFile(m[2]);
        }
        let re5 = /^\s*(import|embed)\s*"(.+?)";/gmi;
        while (m = re5.exec(text)) {
            if (m[1] == 'import')
                pushFile(m[2] + ".wiz");
            else
                pushFile(m[2]);
        }
        let re6 = /^\s*(import)\s*"(.+?)"/gmi;
        while (m = re6.exec(text)) {
            pushFile(m[2]);
        }
        let re7 = /^[!]src\s+"(.+?)"/gmi;
        while (m = re7.exec(text)) {
            pushFile(m[1]);
        }
    }
    return files;
}
function parseLinkDependencies(text, platformId, mainPath) {
    let files = [];
    let m;
    var dir = (0, util_1.getFolderForPath)(mainPath);
    function pushFile(fn) {
        files.push(fn);
        if (dir.length > 0 && dir != 'local')
            files.push(dir + '/' + fn);
    }
    if (!platformId.startsWith('verilog')) {
        let re = /^\s*([;]|[/][/])#link\s+"(.+?)"/gm;
        while (m = re.exec(text)) {
            pushFile(m[2]);
        }
    }
    return files;
}
/**
 * Try to resolve a file path by searching the source directory,
 * the presets directory for the platform, and the current working directory.
 */
function resolveFileData(filePath, sourceDir, platform) {
    var searchPaths = [];
    // Try relative to source file directory
    if (sourceDir) {
        searchPaths.push(path.resolve(sourceDir, filePath));
    }
    // Try presets directory
    var basePlatform = (0, util_1.getBasePlatform)(platform);
    searchPaths.push(path.resolve('presets', basePlatform, filePath));
    // Try current working directory
    searchPaths.push(path.resolve(filePath));
    for (var p of searchPaths) {
        try {
            if (fs.existsSync(p)) {
                if ((0, util_1.isProbablyBinary)(filePath)) {
                    return new Uint8Array(fs.readFileSync(p));
                }
                else {
                    return fs.readFileSync(p, 'utf-8');
                }
            }
        }
        catch (e) {
            // continue searching
        }
    }
    return null;
}
/**
 * Strips the main file's folder prefix from a path (matching CodeProject.stripLocalPath).
 */
function stripLocalPath(filePath, mainPath) {
    var folder = (0, util_1.getFolderForPath)(mainPath);
    if (folder != '' && filePath.startsWith(folder + '/')) {
        filePath = filePath.substring(folder.length + 1);
    }
    return filePath;
}
/**
 * Recursively resolve all file dependencies for a source file.
 */
function resolveAllDependencies(mainText, mainPath, platform, sourceDir) {
    var resolved = [];
    var seen = new Set();
    function resolve(text, currentPath) {
        var includes = parseIncludeDependencies(text, platform, currentPath);
        var links = parseLinkDependencies(text, platform, currentPath);
        var allPaths = includes.concat(links);
        var linkSet = new Set(links);
        for (var depPath of allPaths) {
            var filename = stripLocalPath(depPath, mainPath);
            if (seen.has(filename))
                continue;
            seen.add(filename);
            var data = resolveFileData(depPath, sourceDir, platform);
            if (data != null) {
                resolved.push({
                    path: depPath,
                    filename: filename,
                    data: data,
                    link: linkSet.has(depPath),
                });
                // Recursively parse text files for their own dependencies
                if (typeof data === 'string') {
                    resolve(data, depPath);
                }
            }
        }
    }
    resolve(mainText, mainPath);
    return resolved;
}
// TODO: refactor dependency parsing and tool selection into a common library
// shared between CodeProject (src/ide/project.ts) and testlib
/**
 * Select the appropriate tool for a filename based on platform architecture.
 */
function getToolForFilename(fn, platform) {
    var params = platforms_1.PLATFORM_PARAMS[(0, util_1.getBasePlatform)(platform)];
    var arch = params && params.arch;
    switch (arch) {
        case 'z80':
        case 'gbz80':
            return (0, baseplatform_1.getToolForFilename_z80)(fn);
        case '6502':
            return (0, baseplatform_1.getToolForFilename_6502)(fn);
        case '6809':
            return (0, baseplatform_1.getToolForFilename_6809)(fn);
        default:
            return (0, baseplatform_1.getToolForFilename_z80)(fn); // fallback
    }
}
/**
 * Compile an arbitrary source file path.
 * Parses include/link/resource directives and loads dependent files.
 */
async function compileSourceFile(tool, platform, filePath) {
    await initialize();
    var code = fs.readFileSync(filePath, 'utf-8');
    var basename = filePath.split('/').pop();
    var sourceDir = path.dirname(path.resolve(filePath));
    // Auto-detect tool from filename if not specified
    if (!tool) {
        tool = getToolForFilename(basename, platform);
    }
    // Parse and resolve all dependencies
    var deps = resolveAllDependencies(code, basename, platform, sourceDir);
    if (deps.length === 0) {
        // No dependencies found, use simple single-file path
        return compile({
            tool: tool,
            platform: platform,
            code: code,
            path: basename,
        });
    }
    // Build multi-file message with updates and buildsteps
    var files = [];
    var depFilenames = [];
    // Main file first
    files.push({ path: basename, data: code });
    // Include files (non-link dependencies)
    for (var dep of deps) {
        if (!dep.link) {
            files.push({ path: dep.filename, data: dep.data });
            depFilenames.push(dep.filename);
        }
    }
    // Build steps: main file first
    var buildsteps = [];
    buildsteps.push({
        path: basename,
        files: [basename].concat(depFilenames),
        platform: platform,
        tool: tool,
        mainfile: true,
    });
    // Link dependencies get their own build steps, with tool selected by extension
    for (var dep of deps) {
        if (dep.link && dep.data) {
            files.push({ path: dep.filename, data: dep.data });
            buildsteps.push({
                path: dep.filename,
                files: [dep.filename].concat(depFilenames),
                platform: platform,
                tool: getToolForFilename(dep.filename, platform),
            });
        }
    }
    return compile({
        tool: tool,
        platform: platform,
        files: files,
        buildsteps: buildsteps,
    });
}
function workerResultToCompileResult(result) {
    if (!result) {
        return { success: true, unchanged: true };
    }
    if ('unchanged' in result && result.unchanged) {
        return { success: true, unchanged: true };
    }
    if ('errors' in result && result.errors && result.errors.length > 0) {
        return {
            success: false,
            errors: result.errors,
        };
    }
    if ('output' in result) {
        return {
            success: true,
            output: result.output,
            listings: result.listings,
            symbolmap: result.symbolmap,
            params: result.params,
        };
    }
    return { success: false, errors: [{ line: 0, msg: 'Unknown result format' }] };
}
/**
 * List available compilation tools.
 */
function listTools() {
    return Object.keys(workertools_1.TOOLS);
}
/**
 * List available target platforms.
 */
function listPlatforms() {
    return Object.keys(platforms_1.PLATFORM_PARAMS);
}
/**
 * Convert a binary buffer to a hex string for display.
 */
function ab2str(buf) {
    return String.fromCharCode.apply(null, new Uint16Array(buf));
}
// Platform test harness utilities
/**
 * Create a mock localStorage for tests that need it.
 */
function createMockLocalStorage() {
    var items = {};
    return {
        get length() {
            return Object.keys(items).length;
        },
        clear() {
            items = {};
        },
        getItem(k) {
            return items[k] || null;
        },
        setItem(k, v) {
            items[k] = v;
        },
        removeItem(k) {
            delete items[k];
        },
        key(i) {
            return Object.keys(items)[i] || null;
        }
    };
}
//# sourceMappingURL=testlib.js.map