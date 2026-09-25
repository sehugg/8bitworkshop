
// buildcore - compiles a project in-process with the worker build system.
// No vscode imports, so tests can run it under plain Node.

import * as fs from 'fs';
import * as path from 'path';
import type { CodeListingMap, FileData, Segment, WorkerError, WorkerResult } from "../../src/common/workertypes";
import { getBasePlatform, isProbablyBinary } from "../../src/common/util";
import { getToolForPlatform } from "../../src/common/toolselect";
import { FileProvider, buildWorkerMessage, resolveDependencies } from "../../src/common/projectcore";
import { setupNodeEnvironment, handleMessage } from "../../src/worker/workerlib";
import { PLATFORM_PARAMS } from "../../src/worker/platforms";

export type { FileProvider };

export interface BuildRequest {
  platform: string;
  /** main file, relative to the project root (posix separators) */
  mainPath: string;
  mainText: string;
  files: FileProvider;
  /** overrides the tool for the main file */
  tool?: string;
}

export interface BuildDiagnostic {
  /** project-relative path */
  path: string;
  /** 1-based line number (0 = no line) */
  line: number;
  msg: string;
}

export interface BuildOutcome {
  success: boolean;
  tool: string;
  output?: Uint8Array;
  diagnostics: BuildDiagnostic[];
  listings?: CodeListingMap;
  symbolmap?: { [sym: string]: number };
  segments?: Segment[];
  /** every project path the build read */
  paths: string[];
  /** true when no inputs changed since the previous build */
  unchanged?: boolean;
}

/**
 * Runs builds against the toolchain assets under `rootDir/src/worker`.
 * The worker store is global, so builds run one at a time.
 */
export class Builder {
  private queue: Promise<any> = Promise.resolve();
  private initialized = false;
  private preloaded = new Set<string>();

  constructor(readonly rootDir: string) { }

  build(req: BuildRequest): Promise<BuildOutcome> {
    var next = this.queue.then(() => this.doBuild(req));
    this.queue = next.catch(() => { });
    return next;
  }

  private async doBuild(req: BuildRequest): Promise<BuildOutcome> {
    if (!this.initialized) {
      setupNodeEnvironment(this.rootDir);
      this.initialized = true;
    }
    var getTool = (fn: string) => (req.tool && fn === req.mainPath) ? req.tool : getToolForPlatform(req.platform, fn);
    var tool = getTool(req.mainPath);
    var deps = await resolveDependencies(req.files, req.mainPath, req.mainText, req.platform, getTool);
    var { msg, filename2path, preloads } = buildWorkerMessage({
      mainPath: req.mainPath,
      mainData: req.mainText,
      platformId: req.platform,
      getToolForFilename: getTool,
    }, deps);
    var paths = [req.mainPath].concat(deps.map(d => d.path));
    var result: WorkerResult;
    try {
      for (var t of preloads) {
        if (!this.preloaded.has(t + "/" + req.platform)) {
          await handleMessage({ preload: t, platform: req.platform } as any);
          this.preloaded.add(t + "/" + req.platform);
        }
      }
      result = await handleMessage(msg);
    } catch (e) {
      return { success: false, tool, paths, diagnostics: [{ path: req.mainPath, line: 0, msg: String(e && e.message || e) }] };
    }
    if (!result || ('unchanged' in result && result.unchanged)) {
      return { success: true, tool, paths, diagnostics: [], unchanged: true };
    }
    if ('errors' in result && result.errors && result.errors.length) {
      var toPath = (err: WorkerError) => (err.path && filename2path[err.path]) || err.path || req.mainPath;
      return {
        success: false, tool, paths,
        diagnostics: result.errors.map(err => ({ path: toPath(err), line: err.line || 0, msg: err.msg })),
      };
    }
    if ('output' in result) {
      // listings stay raw: SourceFile objects don't survive postMessage, so
      // the receiver runs projectcore.processListings on them
      var r = result as any;
      return {
        success: true, tool, paths, diagnostics: [],
        output: r.output, listings: r.listings, symbolmap: r.symbolmap, segments: r.segments,
      };
    }
    return { success: false, tool, paths, diagnostics: [{ path: req.mainPath, line: 0, msg: 'Unknown build result' }] };
  }
}

/**
 * Reads project files through `read`, then falls back to the bundled
 * presets/<base platform> directory (for shared headers and libraries).
 */
export class ProjectFileProvider implements FileProvider {
  constructor(
    readonly read: (relpath: string) => Promise<Uint8Array | null>,
    readonly rootDir: string,
    readonly platform: string) { }

  async readFile(relpath: string): Promise<FileData | null> {
    var data = await this.read(relpath);
    if (data == null) {
      var p = path.resolve(this.rootDir, 'presets', getBasePlatform(this.platform), relpath);
      try {
        if (fs.statSync(p).isFile()) data = new Uint8Array(fs.readFileSync(p));
      } catch (e) {
        return null;
      }
    }
    if (data == null) return null;
    return isProbablyBinary(relpath) ? data : new TextDecoder().decode(data);
  }
}

export function listPlatforms(): string[] {
  return Object.keys(PLATFORM_PARAMS).sort();
}
