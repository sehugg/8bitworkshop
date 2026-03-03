"use strict";
// testlib - Clean async API for compiling and testing 8bitworkshop projects
// Wraps the worker build system for use in tests and CLI tools
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
exports.compileSourceFile = compileSourceFile;
exports.listTools = listTools;
exports.listPlatforms = listPlatforms;
exports.ab2str = ab2str;
exports.createMockLocalStorage = createMockLocalStorage;
const fs = __importStar(require("fs"));
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
 * Compile an arbitrary source file path.
 */
async function compileSourceFile(tool, platform, filePath) {
    await initialize();
    var code = fs.readFileSync(filePath, 'utf-8');
    var basename = filePath.split('/').pop();
    return compile({
        tool: tool,
        platform: platform,
        code: code,
        path: basename,
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