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
exports.NodeFileProvider = exports.TOOLS = exports.PLATFORM_PARAMS = exports.store = void 0;
exports.initialize = initialize;
exports.preload = preload;
exports.compile = compile;
exports.compileFile = compileFile;
exports.getToolForFilename = getToolForFilename;
exports.compileSourceFile = compileSourceFile;
exports.buildSourceFileMessage = buildSourceFileMessage;
exports.listTools = listTools;
exports.listPlatforms = listPlatforms;
exports.ab2str = ab2str;
exports.createMockLocalStorage = createMockLocalStorage;
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
const util_1 = require("../common/util");
const toolselect_1 = require("../common/toolselect");
const projectcore_1 = require("../common/projectcore");
const workerlib_1 = require("../worker/workerlib");
Object.defineProperty(exports, "store", { enumerable: true, get: function () { return workerlib_1.store; } });
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
            mainfile: options.mainfile !== false,
        };
        if (options.symbols)
            msg.symbols = options.symbols;
        if (options.buildArgs)
            msg.buildArgs = options.buildArgs;
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
 * Reads files for a build from the source file's directory, then
 * presets/<base platform>, then the current directory.
 */
class NodeFileProvider {
    constructor(sourceDir, platform) {
        this.sourceDir = sourceDir;
        this.platform = platform;
    }
    async readFile(filePath) {
        var searchPaths = [];
        if (this.sourceDir)
            searchPaths.push(path.resolve(this.sourceDir, filePath));
        searchPaths.push(path.resolve('presets', (0, util_1.getBasePlatform)(this.platform), filePath));
        searchPaths.push(path.resolve(filePath));
        for (var p of searchPaths) {
            try {
                if (fs.existsSync(p) && fs.statSync(p).isFile()) {
                    return (0, util_1.isProbablyBinary)(filePath) ? new Uint8Array(fs.readFileSync(p)) : fs.readFileSync(p, 'utf-8');
                }
            }
            catch (e) {
                // continue searching
            }
        }
        return null;
    }
}
exports.NodeFileProvider = NodeFileProvider;
/**
 * Select the appropriate tool for a filename on a platform.
 */
function getToolForFilename(fn, platform) {
    return (0, toolselect_1.getToolForPlatform)(platform, fn);
}
/**
 * Compile an arbitrary source file path.
 * Parses include/link/resource directives and loads dependent files.
 * `buildAs` renames the file for the build, for sources whose name on disk
 * isn't one the tool accepts (the IDE's skeleton.<tool> templates).
 */
async function compileSourceFile(tool, platform, filePath, buildAs, opts) {
    await initialize();
    var msg = await buildSourceFileMessage(tool, platform, filePath, buildAs, opts);
    await (0, workerlib_1.handleMessage)({ reset: true });
    return workerResultToCompileResult(await (0, workerlib_1.handleMessage)(msg));
}
/**
 * The worker message compileSourceFile sends for a source file -- the same
 * one the IDE builds (src/common/projectcore.ts). A `tool` overrides the
 * main file's tool; linked files get the platform's tool for their name.
 */
async function buildSourceFileMessage(tool, platform, filePath, buildAs, opts) {
    var code = fs.readFileSync(filePath, 'utf-8');
    var basename = buildAs || path.basename(filePath);
    var getTool = (fn) => (tool && fn === basename) ? tool : (0, toolselect_1.getToolForPlatform)(platform, fn);
    var fp = new NodeFileProvider(path.dirname(path.resolve(filePath)), platform);
    var deps = await (0, projectcore_1.resolveDependencies)(fp, basename, code, platform, getTool);
    return (0, projectcore_1.buildWorkerMessage)({
        mainPath: basename,
        mainData: code,
        platformId: platform,
        getToolForFilename: getTool,
        symbols: opts && opts.symbols,
        buildArgs: opts && opts.buildArgs,
    }, deps).msg;
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
            segments: result.segments,
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