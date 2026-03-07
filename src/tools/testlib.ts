
// testlib - Clean async API for compiling and testing 8bitworkshop projects
// Wraps the worker build system for use in tests and CLI tools
// FOR TESTING ONLY

import * as fs from 'fs';
import * as path from 'path';
import type { WorkerResult, WorkerMessage, WorkerErrorResult, WorkerOutputResult, Dependency } from "../common/workertypes";
import { getFolderForPath, isProbablyBinary, getBasePlatform } from "../common/util";
import { getToolForFilename_z80, getToolForFilename_6502, getToolForFilename_6809 } from "../common/baseplatform";
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
  segments?: any;
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
 * Parse include and link dependencies from source text.
 * Extracted from CodeProject.parseIncludeDependencies / parseLinkDependencies.
 * TODO: project.ts should be refactored so we don't have to duplicate the logic
 */
function parseIncludeDependencies(text: string, platformId: string, mainPath: string): string[] {
  let files: string[] = [];
  let m;
  var dir = getFolderForPath(mainPath);

  function pushFile(fn: string) {
    files.push(fn);
    if (dir.length > 0 && dir != 'local')
      files.push(dir + '/' + fn);
  }

  if (platformId.startsWith('verilog')) {
    let re1 = /^\s*(`include|[.]include)\s+"(.+?)"/gmi;
    while (m = re1.exec(text)) { pushFile(m[2]); }
    let re1a = /^\s*\$(include|\$dofile|\$write_image_in_table)\('(.+?)'/gmi;
    while (m = re1a.exec(text)) { pushFile(m[2]); }
    let re2 = /^\s*([.]arch)\s+(\w+)/gmi;
    while (m = re2.exec(text)) { pushFile(m[2] + ".json"); }
    let re3 = /\$readmem[bh]\("(.+?)"/gmi;
    while (m = re3.exec(text)) { pushFile(m[1]); }
  } else {
    let re2 = /^\s*[.#%]?(include|incbin|embed)\s+"(.+?)"/gmi;
    while (m = re2.exec(text)) { pushFile(m[2]); }
    let re3 = /^\s*([;']|[/][/])#(resource)\s+"(.+?)"/gm;
    while (m = re3.exec(text)) { pushFile(m[3]); }
    let re4 = /^\s+(USE|ASM)\s+(\S+[.]\S+)/gm;
    while (m = re4.exec(text)) { pushFile(m[2]); }
    let re5 = /^\s*(import|embed)\s*"(.+?)";/gmi;
    while (m = re5.exec(text)) {
      if (m[1] == 'import') pushFile(m[2] + ".wiz");
      else pushFile(m[2]);
    }
    let re6 = /^\s*(import)\s*"(.+?)"/gmi;
    while (m = re6.exec(text)) { pushFile(m[2]); }
    let re7 = /^[!]src\s+"(.+?)"/gmi;
    while (m = re7.exec(text)) { pushFile(m[1]); }
  }
  return files;
}

function parseLinkDependencies(text: string, platformId: string, mainPath: string): string[] {
  let files: string[] = [];
  let m;
  var dir = getFolderForPath(mainPath);

  function pushFile(fn: string) {
    files.push(fn);
    if (dir.length > 0 && dir != 'local')
      files.push(dir + '/' + fn);
  }

  if (!platformId.startsWith('verilog')) {
    let re = /^\s*([;]|[/][/])#link\s+"(.+?)"/gm;
    while (m = re.exec(text)) { pushFile(m[2]); }
  }
  return files;
}

type FileData = string | Uint8Array;

interface ResolvedFile {
  path: string;       // path as referenced (may include folder prefix)
  filename: string;   // stripped filename for the worker
  data: FileData;
  link: boolean;
}

/**
 * Try to resolve a file path by searching the source directory,
 * the presets directory for the platform, and the current working directory.
 */
function resolveFileData(filePath: string, sourceDir: string, platform: string): FileData | null {
  var searchPaths = [];

  // Try relative to source file directory
  if (sourceDir) {
    searchPaths.push(path.resolve(sourceDir, filePath));
  }

  // Try presets directory
  var basePlatform = getBasePlatform(platform);
  searchPaths.push(path.resolve('presets', basePlatform, filePath));

  // Try current working directory
  searchPaths.push(path.resolve(filePath));

  for (var p of searchPaths) {
    try {
      if (fs.existsSync(p)) {
        if (isProbablyBinary(filePath)) {
          return new Uint8Array(fs.readFileSync(p));
        } else {
          return fs.readFileSync(p, 'utf-8');
        }
      }
    } catch (e) {
      // continue searching
    }
  }
  return null;
}

/**
 * Strips the main file's folder prefix from a path (matching CodeProject.stripLocalPath).
 */
function stripLocalPath(filePath: string, mainPath: string): string {
  var folder = getFolderForPath(mainPath);
  if (folder != '' && filePath.startsWith(folder + '/')) {
    filePath = filePath.substring(folder.length + 1);
  }
  return filePath;
}

/**
 * Recursively resolve all file dependencies for a source file.
 */
function resolveAllDependencies(
  mainText: string, mainPath: string, platform: string, sourceDir: string
): ResolvedFile[] {
  var resolved: ResolvedFile[] = [];
  var seen = new Set<string>();

  function resolve(text: string, currentPath: string) {
    var includes = parseIncludeDependencies(text, platform, currentPath);
    var links = parseLinkDependencies(text, platform, currentPath);
    var allPaths = includes.concat(links);
    var linkSet = new Set(links);

    for (var depPath of allPaths) {
      var filename = stripLocalPath(depPath, mainPath);
      if (seen.has(filename)) continue;
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
export function getToolForFilename(fn: string, platform: string): string {
  var params = PLATFORM_PARAMS[getBasePlatform(platform)];
  var arch = params && params.arch;
  switch (arch) {
    case 'z80':
    case 'gbz80':
      return getToolForFilename_z80(fn);
    case '6502':
      return getToolForFilename_6502(fn);
    case '6809':
      return getToolForFilename_6809(fn);
    default:
      return getToolForFilename_z80(fn); // fallback
  }
}

/**
 * Compile an arbitrary source file path.
 * Parses include/link/resource directives and loads dependent files.
 */
export async function compileSourceFile(tool: string, platform: string, filePath: string): Promise<CompileResult> {
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
  var files: { path: string; data: string | Uint8Array }[] = [];
  var depFilenames: string[] = [];

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
  var buildsteps: any[] = [];
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
      segments: (result as any).segments,
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
