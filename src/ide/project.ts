
import localforage from "localforage";
import { Platform } from "../common/baseplatform";
import { getBasePlatform, getWithBinary, isProbablyBinary } from "../common/util";
import { FileProvider, buildWorkerMessage, getListingForFile, mergeSegments, processListings, resolveDependencies, stripLocalPath } from "../common/projectcore";
import { BuildArgLists, BuildSymbolLists, CodeListing, CodeListingMap, Dependency, FileData, Segment, WorkerErrorResult, WorkerItemUpdate, WorkerMessage, WorkerOutputResult, WorkerResult, isErrorResult, isOutputResult } from "../common/workertypes";

export interface ProjectFilesystem {
  getFileData(path: string): Promise<FileData>;
  setFileData(path: string, data: FileData): Promise<void>;
  onFileSystemUpdate(callback: (path: string) => void): void;
}

export class WebPresetsFileSystem implements ProjectFilesystem {
  preset_id: string;
  constructor(platform_id: string) {
    this.preset_id = getBasePlatform(platform_id); // remove .suffix from preset name
  }
  async getRemoteFile(path: string): Promise<FileData> {
    return new Promise((yes, no) => {
      return getWithBinary(path, yes, isProbablyBinary(path) ? 'arraybuffer' : 'text');
    });
  }
  async getFileData(path: string): Promise<FileData> {
    // found on remote fetch?
    var webpath = "presets/" + this.preset_id + "/" + path;
    var data = await this.getRemoteFile(webpath);
    if (data) console.log("read", webpath, data.length, 'bytes');
    return data;
  }
  async setFileData(path: string, data: FileData): Promise<void> {
    // not implemented
  }
  onFileSystemUpdate(callback: (path: string) => void): void {
    // not implemented
  }
}

export class NullFilesystem implements ProjectFilesystem {
  gets = [];
  sets = [];
  getFileData(path: string): Promise<FileData> {
    this.gets.push(path);
    return null;
  }
  setFileData(path: string, data: FileData): Promise<void> {
    this.sets.push(path);
    return;
  }
  onFileSystemUpdate(callback: (path: string) => void): void {
    // not implemented
  }
}

export class OverlayFilesystem implements ProjectFilesystem {
  basefs: ProjectFilesystem;
  overlayfs: ProjectFilesystem;
  constructor(basefs: ProjectFilesystem, overlayfs: ProjectFilesystem) {
    this.basefs = basefs;
    this.overlayfs = overlayfs;
  }
  async getFileData(path: string): Promise<FileData> {
    var data = await this.overlayfs.getFileData(path);
    if (data == null) {
      return this.basefs.getFileData(path);
    } else {
      return data;
    }
  }
  async setFileData(path: string, data: FileData): Promise<void> {
    await this.overlayfs.setFileData(path, data);
    return this.basefs.setFileData(path, data);
  }
  onFileSystemUpdate(callback: (path: string) => void): void {
    this.overlayfs.onFileSystemUpdate(callback);
    this.basefs.onFileSystemUpdate(callback);
  }
}

export class LocalForageFilesystem implements ProjectFilesystem {
  store: any;
  constructor(store: any) {
    this.store = store;
  }
  async getFileData(path: string): Promise<FileData> {
    return this.store.getItem(path);
  }
  async setFileData(path: string, data: FileData): Promise<void> {
    return this.store.setItem(path, data);
  }
  onFileSystemUpdate(callback: (path: string) => void): void {
    // not implemented
  }
}

type BuildResultCallback = (result: WorkerResult) => void;
type BuildStatusCallback = (busy: boolean) => void;
type IterateFilesCallback = (path: string, data: FileData) => void;

function isEmptyString(text: FileData) {
  return typeof text == 'string' && text.trim && text.trim().length == 0;
}

export class CodeProject {
  filedata: { [path: string]: FileData } = {};
  listings: CodeListingMap;
  segments: Segment[];
  mainPath: string;
  pendingWorkerMessages = 0;
  tools_preloaded = {};
  worker: Worker;
  platform_id: string;
  platform: Platform;
  isCompiling: boolean = false;
  filename2path = {}; // map stripped paths to full paths
  filesystem: ProjectFilesystem;
  dataItems: WorkerItemUpdate[];
  remoteTool?: string;
  // per-project build overrides, applied under the source's own directives.
  // Set via setBuildOverrides(); no settings UI yet.
  buildSymbols?: BuildSymbolLists;
  buildArgs?: BuildArgLists;

  callbackBuildResult: BuildResultCallback;
  callbackBuildStatus: BuildStatusCallback;
  onFileChanged: (path: string, data: FileData) => void;
  // pending ad-hoc worker queries (queryWorker), keyed by qid
  pendingQueries: { [qid: number]: (result: WorkerResult) => void } = {};
  queryCounter = 0;

  constructor(worker, platform_id: string, platform, filesystem: ProjectFilesystem) {
    this.worker = worker;
    this.platform_id = platform_id;
    this.platform = platform;
    this.filesystem = filesystem;

    worker.onmessage = (e) => {
      this.receiveWorkerMessage(e.data);
    };

    filesystem.onFileSystemUpdate(async (path: string) => {
      if (path in this.filedata) {
        var data = await this.filesystem.getFileData(path);
        if (data) {
          this.updateFile(path, data);
          if (this.onFileChanged) this.onFileChanged(path, data);
        }
      }
    });
  }

  receiveWorkerMessage(data: WorkerResult) {
    // ad-hoc query responses (queryWorker) are tagged with a qid
    if (data && (data as any).qid != null) {
      var qfn = this.pendingQueries[(data as any).qid];
      if (qfn) {
        delete this.pendingQueries[(data as any).qid];
        qfn(data);
      }
      return;
    }
    var notfinal = this.pendingWorkerMessages > 1;
    if (notfinal) {
      this.sendBuild();
      this.pendingWorkerMessages = 1;
    } else {
      if (this.callbackBuildStatus) this.callbackBuildStatus(false);
      if (!this.isCompiling) { console.log(this.pendingWorkerMessages); console.trace(); } // debug compile problems
      this.isCompiling = false;
      this.pendingWorkerMessages = 0;
    }
    if (data && isOutputResult(data)) {
      this.processBuildResult(data);
    } else if (isErrorResult(data)) {
      this.processBuildListings(data);
    }
    this.callbackBuildResult(data);
  }

  /**
   * Send an ad-hoc message to the worker and await its (qid-tagged) response.
   * Used for non-build queries like readshared/listshared. Resolves with the
   * raw WorkerResult, or null on timeout.
   */
  queryWorker<T extends WorkerResult>(msg: WorkerMessage): Promise<T | null> {
    return new Promise((resolve) => {
      var qid = ++this.queryCounter;
      this.pendingQueries[qid] = (result) => {
        clearTimeout(timer);
        resolve(result as T);
      };
      var timer = setTimeout(() => {
        delete this.pendingQueries[qid];
        resolve(null);
      }, 15000);
      msg.qid = qid;
      this.worker.postMessage(msg);
    });
  }

  getToolForFilename(path) {
    if (this.remoteTool) {
      return "remote:" + this.remoteTool;
    } else {
      return this.platform.getToolForFilename(path);
    }
  }

  preloadTool(tool: string) {
    if (tool && !this.tools_preloaded[tool]) {
      this.worker.postMessage({ preload: tool, platform: this.platform_id });
      this.tools_preloaded[tool] = true;
    }
  }

  /** Files are read through the project cache, then the filesystem. */
  fileProvider: FileProvider = {
    readFile: async (path: string) => (await this.loadFiles([path]))[0]?.data ?? null,
  };

  loadFileDependencies(text: string): Promise<Dependency[]> {
    return resolveDependencies(this.fileProvider, this.mainPath, text, this.platform_id,
      (path) => this.getToolForFilename(path));
  }

  okToSend(): boolean {
    return this.pendingWorkerMessages++ == 0 && this.mainPath != null;
  }

  updateFileInStore(path: string, text: FileData) {
    this.filesystem.setFileData(path, text);
  }

  buildWorkerMessage(depends: Dependency[]): WorkerMessage {
    var { msg, filename2path, preloads } = buildWorkerMessage({
      mainPath: this.mainPath,
      mainData: this.getFile(this.mainPath),
      platformId: this.platform_id,
      getToolForFilename: (path) => this.getToolForFilename(path),
      symbols: this.buildSymbols,
      buildArgs: this.buildArgs,
      dataItems: this.dataItems,
    }, depends);
    Object.assign(this.filename2path, filename2path);
    for (var tool of preloads) this.preloadTool(tool);
    return msg;
  }

  // TODO: get local file as well as presets?
  async loadFiles(paths: string[]): Promise<Dependency[]> {
    var result: Dependency[] = [];
    var addResult = (path: string, data: FileData) => {
      result.push({
        path: path,
        filename: this.stripLocalPath(path),
        link: true,
        data: data
      });
    }
    for (var path of paths) {
      // look in cache
      if (path in this.filedata) { // found in cache?
        var data = this.filedata[path];
        if (data) {
          addResult(path, data);
        }
      } else {
        var data = await this.filesystem.getFileData(path);
        if (data) {
          this.filedata[path] = data; // do not update store, just cache
          addResult(path, data);
        } else {
          this.filedata[path] = null; // mark entry as invalid
        }
      }
    }
    return result;
  }

  getFile(path: string): FileData {
    return this.filedata[path];
  }

  // TODO: purge files not included in latest build?
  iterateFiles(callback: IterateFilesCallback) {
    for (var path in this.filedata) {
      callback(path, this.getFile(path));
    }
  }

  sendBuild() {
    if (!this.mainPath) throw Error("need to call setMainFile first");
    var maindata = this.getFile(this.mainPath);
    // if binary blob, just return it as ROM
    if (maindata instanceof Uint8Array) {
      this.isCompiling = true;
      this.receiveWorkerMessage({
        output: maindata,
        errors: [],
        listings: null,
        symbolmap: null,
        params: {}
      });
      return;
    }
    // otherwise, make it a string
    var text = typeof maindata === "string" ? maindata : '';
    return this.loadFileDependencies(text).then((depends) => {
      if (!depends) depends = [];
      var workermsg = this.buildWorkerMessage(depends);
      this.worker.postMessage(workermsg);
      this.isCompiling = true;
    });
  }

  updateFile(path: string, text: FileData) {
    if (this.filedata[path] == text) return; // unchanged, don't update
    this.updateFileInStore(path, text); // TODO: isBinary
    this.filedata[path] = text;
    if (this.okToSend()) {
      if (this.callbackBuildStatus) this.callbackBuildStatus(true);
      this.sendBuild();
    }
  };

  setMainFile(path: string) {
    this.mainPath = path;
    if (this.callbackBuildStatus) this.callbackBuildStatus(true);
    this.sendBuild();
  }

  processBuildListings(data: WorkerOutputResult<any> | WorkerErrorResult) {
    // TODO: link listings with source files
    if (data.listings) {
      this.listings = data.listings;
      processListings(this.listings);
    }
  }

  processBuildResult(data: WorkerOutputResult<any>) {
    this.processBuildListings(data);
    this.processBuildSegments(data);
  }

  processBuildSegments(data: WorkerOutputResult<any>) {
    var native = this.platform.getMemoryMap && this.platform.getMemoryMap()["main"];
    this.segments = mergeSegments(native, data.segments);
  }

  getListings(): CodeListingMap {
    return this.listings;
  }

  // returns first listing in format [prefix].lst (TODO: could be better)
  getListingForFile(path: string): CodeListing {
    return getListingForFile(this.getListings(), path, this.mainPath);
  }

  stripLocalPath(path: string): string {
    return stripLocalPath(path, this.mainPath);
  }

  /**
   * Set per-project build overrides (symbols / raw args per phase). These are
   * layered above platform defaults but below the source's own //# directives,
   * matching the CLI's --define/--cflag/... options. Triggers a rebuild.
   */
  setBuildOverrides(symbols?: BuildSymbolLists, buildArgs?: BuildArgLists) {
    this.buildSymbols = symbols;
    this.buildArgs = buildArgs;
    if (this.okToSend()) this.sendBuild();
  }

  updateDataItems(items: WorkerItemUpdate[]) {
    this.dataItems = items;
    if (this.okToSend()) { // TODO? mainpath == null?
      this.sendBuild(); // TODO: don't need entire build?
    }
  }

}

export function createNewPersistentStore(storeid: string): LocalForage {
  var store = localforage.createInstance({
    name: "__" + storeid,
    version: 2.0
  });
  return store;
}

