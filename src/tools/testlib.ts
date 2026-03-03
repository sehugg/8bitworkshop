
// testlib - Clean async API for compiling and testing 8bitworkshop projects
// Wraps the worker build system for use in tests and CLI tools

import * as fs from 'fs';
import type { WorkerResult, WorkerMessage, WorkerErrorResult, WorkerOutputResult } from "../common/workertypes";
import { setupNodeEnvironment, handleMessage, store, TOOL_PRELOADFS } from "../worker/workerlib";
import { PLATFORM_PARAMS } from "../worker/platforms";
import { TOOLS } from "../worker/workertools";

export { store, TOOL_PRELOADFS, PLATFORM_PARAMS, TOOLS };

export interface CompileOptions {
  tool: string;
  platform: string;
  code?: string;
  path?: string;
  files?: { path: string; data: string | Uint8Array }[];
  buildsteps?: { path: string; platform: string; tool: string }[];
  mainfile?: boolean;
}

export interface CompileResult {
  success: boolean;
  output?: Uint8Array | any;
  errors?: { line: number; msg: string; path?: string }[];
  listings?: any;
  symbolmap?: any;
  params?: any;
  unchanged?: boolean;
}

let initialized = false;

/**
 * Initialize the Node.js environment for compilation.
 * Must be called once before any compile/preload calls.
 */
export async function initialize(): Promise<void> {
  if (initialized) return;
  setupNodeEnvironment();
  // The worker tools are already registered through the import chain:
  // workerlib -> workertools -> tools/* and builder -> TOOLS
  // No need to load the esbuild bundle.
  initialized = true;
}

/**
 * Preload a tool's filesystem (e.g. CC65 standard libraries).
 */
export async function preload(tool: string, platform?: string): Promise<void> {
  await initialize();
  var msg: WorkerMessage = { preload: tool } as any;
  if (platform) (msg as any).platform = platform;
  await handleMessage(msg);
}

/**
 * Compile source code with the specified tool and platform.
 */
export async function compile(options: CompileOptions): Promise<CompileResult> {
  await initialize();

  // Reset the store for a clean build
  await handleMessage({ reset: true } as any);

  let result: WorkerResult;

  if (options.files && options.buildsteps) {
    // Multi-file build
    var msg: any = {
      updates: options.files.map(f => ({ path: f.path, data: f.data })),
      buildsteps: options.buildsteps
    };
    result = await handleMessage(msg);
  } else {
    // Single-file build
    var msg: any = {
      code: options.code,
      platform: options.platform,
      tool: options.tool,
      path: options.path || ('src.' + options.tool),
      mainfile: options.mainfile !== false
    };
    result = await handleMessage(msg);
  }

  return workerResultToCompileResult(result);
}

/**
 * Compile a file from the presets directory.
 */
export async function compileFile(tool: string, platform: string, presetPath: string): Promise<CompileResult> {
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
export async function compileSourceFile(tool: string, platform: string, filePath: string): Promise<CompileResult> {
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

function workerResultToCompileResult(result: WorkerResult): CompileResult {
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
      listings: (result as any).listings,
      symbolmap: (result as any).symbolmap,
      params: (result as any).params,
    };
  }
  return { success: false, errors: [{ line: 0, msg: 'Unknown result format' }] };
}

/**
 * List available compilation tools.
 */
export function listTools(): string[] {
  return Object.keys(TOOLS);
}

/**
 * List available target platforms.
 */
export function listPlatforms(): string[] {
  return Object.keys(PLATFORM_PARAMS);
}

/**
 * Convert a binary buffer to a hex string for display.
 */
export function ab2str(buf: Buffer | ArrayBuffer): string {
  return String.fromCharCode.apply(null, new Uint16Array(buf));
}

// Platform test harness utilities

/**
 * Create a mock localStorage for tests that need it.
 */
export function createMockLocalStorage(): Storage {
  var items: { [key: string]: string } = {};
  return {
    get length() {
      return Object.keys(items).length;
    },
    clear() {
      items = {};
    },
    getItem(k: string) {
      return items[k] || null;
    },
    setItem(k: string, v: string) {
      items[k] = v;
    },
    removeItem(k: string) {
      delete items[k];
    },
    key(i: number) {
      return Object.keys(items)[i] || null;
    }
  };
}
