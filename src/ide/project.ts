
import { FileData, Dependency, SourceLine, SourceFile, CodeListing, CodeListingMap, WorkerError, Segment, WorkerResult, WorkerOutputResult, isUnchanged, isOutputResult, WorkerMessage, WorkerItemUpdate, WorkerErrorResult, isErrorResult } from "../common/workertypes";
import { getFilenamePrefix, getFolderForPath, isProbablyBinary, getBasePlatform, getWithBinary } from "../common/util";
import { Platform } from "../common/baseplatform";
import localforage from "localforage";

export interface ProjectFilesystem {
  getFileData(path: string) : Promise<FileData>;
  setFileData(path: string, data: FileData) : Promise<void>;
}

export class WebPresetsFileSystem implements ProjectFilesystem {
  preset_id : string;
  constructor(platform_id: string) {
    this.preset_id = getBasePlatform(platform_id); // remove .suffix from preset name
  }
  async getRemoteFile(path: string): Promise<FileData> {
    return new Promise( (yes,no)=> {
      return getWithBinary(path, yes, isProbablyBinary(path) ? 'arraybuffer' : 'text');
    });
  }
  async getFileData(path: string) : Promise<FileData> {
    // found on remote fetch?
    var webpath = "presets/" + this.preset_id + "/" + path;
    var data = await this.getRemoteFile(webpath);
    if (data) console.log("read",webpath,data.length,'bytes');
    return data;
  }
  async setFileData(path: string, data: FileData) : Promise<void> {
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
}

export class LocalForageFilesystem {
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
}

type BuildResultCallback = (result:WorkerResult) => void;
type BuildStatusCallback = (busy:boolean) => void;
type IterateFilesCallback = (path:string, data:FileData) => void;

function isEmptyString(text : FileData) {
  return typeof text == 'string' && text.trim && text.trim().length == 0;
}

export class CodeProject {
  filedata : {[path:string]:FileData} = {};
  listings : CodeListingMap;
  segments : Segment[];
  mainPath : string;
  pendingWorkerMessages = 0;
  tools_preloaded = {};
  worker : Worker;
  platform_id : string;
  platform : Platform;
  isCompiling : boolean = false;
  filename2path = {}; // map stripped paths to full paths
  filesystem : ProjectFilesystem;
  dataItems : WorkerItemUpdate[];

  callbackBuildResult : BuildResultCallback;
  callbackBuildStatus : BuildStatusCallback;

  constructor(worker, platform_id:string, platform, filesystem: ProjectFilesystem) {
    this.worker = worker;
    this.platform_id = platform_id;
    this.platform = platform;
    this.filesystem = filesystem;

    worker.onmessage = (e) => {
      this.receiveWorkerMessage(e.data);
    };
  }

  receiveWorkerMessage(data : WorkerResult) {
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

  preloadWorker(path:string) {
    var tool = this.platform.getToolForFilename(path);
    if (tool && !this.tools_preloaded[tool]) {
      this.worker.postMessage({preload:tool, platform:this.platform_id});
      this.tools_preloaded[tool] = true;
    }
  }

  pushAllFiles(files:string[], fn:string) {
    // look for local and preset files
    files.push(fn);
    // look for files in current (main file) folder
    var dir = getFolderForPath(this.mainPath);
    if (dir.length > 0 && dir != 'local') // TODO
      files.push(dir + '/' + fn);
  }

  // TODO: use tool id to parse files, not platform
  parseIncludeDependencies(text:string):string[] {
    let files = [];
    let m;
    if (this.platform_id.startsWith('script')) { // TODO
      let re1 = /\b\w+[.]read\(["'](.+?)["']/gmi;
      while (m = re1.exec(text)) {
        if (m[1] && m[1].indexOf(':/') < 0) // TODO: ignore URLs
          this.pushAllFiles(files, m[1]);
      }
    } else if (this.platform_id.startsWith('verilog')) {
      // include verilog includes
      let re1 = /^\s*(`include|[.]include)\s+"(.+?)"/gmi;
      while (m = re1.exec(text)) {
        this.pushAllFiles(files, m[2]);
      }
      // for Silice
      let re1a = /^\s*\$(include|\$dofile|\$write_image_in_table)\('(.+?)'/gmi;
      while (m = re1a.exec(text)) {
        this.pushAllFiles(files, m[2]);
      }
      // include .arch (json) statements
      let re2 = /^\s*([.]arch)\s+(\w+)/gmi;
      while (m = re2.exec(text)) {
        this.pushAllFiles(files, m[2]+".json");
      }
      // include $readmem[bh] (TODO)
      let re3 = /\$readmem[bh]\("(.+?)"/gmi;
      while (m = re3.exec(text)) {
        this.pushAllFiles(files, m[1]);
      }
    } else {
      // for .asm -- [.%]include "file"
      // for .c -- #include "file"
      let re2 = /^\s*[.#%]?(include|incbin)\s+"(.+?)"/gmi;
      while (m = re2.exec(text)) {
        this.pushAllFiles(files, m[2]);
      }
      // for .c -- //#resource "file" (or ;resource or #resource)
      let re3 = /^\s*([;']|[/][/])#resource\s+"(.+?)"/gm;
      while (m = re3.exec(text)) {
        this.pushAllFiles(files, m[2]);
      }
      // for XASM only (USE include.ext)
      // for merlin32 (ASM include.ext)
      let re4 = /^\s+(USE|ASM)\s+(\S+[.]\S+)/gm;
      while (m = re4.exec(text)) {
        this.pushAllFiles(files, m[2]);
      }
      // for wiz
      let re5 = /^\s*(import|embed)\s*"(.+?)";/gmi;
      while (m = re5.exec(text)) {
        if (m[1] == 'import')
          this.pushAllFiles(files, m[2] + ".wiz");
        else
          this.pushAllFiles(files, m[2]);
      }
      // for ecs
      let re6 = /^\s*(import)\s*"(.+?)"/gmi;
      while (m = re6.exec(text)) {
        this.pushAllFiles(files, m[2]);
      }
    }
    return files;
  }

  parseLinkDependencies(text:string):string[] {
    let files = [];
    let m;
    if (this.platform_id.startsWith('verilog')) {
      //
    } else {
      // for .c -- //#link "file" (or ;link or #link)
      let re = /^\s*([;]|[/][/])#link\s+"(.+?)"/gm;
      while (m = re.exec(text)) {
        this.pushAllFiles(files, m[2]);
      }
    }
    return files;
  }
  
  loadFileDependencies(text:string) : Promise<Dependency[]> {
    let includes = this.parseIncludeDependencies(text);
    let linkfiles = this.parseLinkDependencies(text);
    let allfiles = includes.concat(linkfiles);
    return this.loadFiles(allfiles).then((result) => {
      // set 'link' property on files that are link dependencies (must match filename)
      if (result) {
        for (let dep of result) {
          dep.link = linkfiles.indexOf(dep.path) >= 0;
        }
      }
      return result;
    });
  }

  okToSend():boolean {
    return this.pendingWorkerMessages++ == 0 && this.mainPath != null;
  }

  updateFileInStore(path:string, text:FileData) {
    this.filesystem.setFileData(path, text);
  }

  // TODO: test duplicate files, local paths mixed with presets
  buildWorkerMessage(depends:Dependency[]) : WorkerMessage {
    this.preloadWorker(this.mainPath);
    var msg : WorkerMessage = {updates:[], buildsteps:[]};
    // TODO: add preproc directive for __MAINFILE__
    var mainfilename = this.stripLocalPath(this.mainPath);
    var maintext = this.getFile(this.mainPath);
    var depfiles = [];
    msg.updates.push({path:mainfilename, data:maintext});
    this.filename2path[mainfilename] = this.mainPath;
    for (var dep of depends) {
      if (!dep.link) {
        msg.updates.push({path:dep.filename, data:dep.data});
        depfiles.push(dep.filename);
      }
      this.filename2path[dep.filename] = dep.path;
    }
    msg.buildsteps.push({
      path:mainfilename,
      files:[mainfilename].concat(depfiles),
      platform:this.platform_id,
      tool:this.platform.getToolForFilename(this.mainPath),
      mainfile:true});
    for (var dep of depends) {
      if (dep.data && dep.link) {
        this.preloadWorker(dep.filename);
        msg.updates.push({path:dep.filename, data:dep.data});
        msg.buildsteps.push({
          path:dep.filename,
          files:[dep.filename].concat(depfiles),
          platform:this.platform_id,
          tool:this.platform.getToolForFilename(dep.path)});
      }
    }
    if (this.dataItems) msg.setitems = this.dataItems;
    return msg;
  }

  // TODO: get local file as well as presets?
  async loadFiles(paths:string[]) : Promise<Dependency[]> {
    var result : Dependency[] = [];
    var addResult = (path:string, data:FileData) => {
      result.push({
        path:path,
        filename:this.stripLocalPath(path),
        link:true,
        data:data
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

  getFile(path:string):FileData {
    return this.filedata[path];
  }

  // TODO: purge files not included in latest build?
  iterateFiles(callback:IterateFilesCallback) {
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
        output:maindata,
        errors:[],
        listings:null,
        symbolmap:null,
        params:{}
      });
      return;
    }
    // otherwise, make it a string
    var text = typeof maindata === "string" ? maindata : '';
    // TODO: load dependencies of non-main files
    return this.loadFileDependencies(text).then( (depends) => {
      if (!depends) depends = [];
      var workermsg = this.buildWorkerMessage(depends);
      this.worker.postMessage(workermsg);
      this.isCompiling = true;
    });
  }

  updateFile(path:string, text:FileData) {
    if (this.filedata[path] == text) return; // unchanged, don't update
    this.updateFileInStore(path, text); // TODO: isBinary
    this.filedata[path] = text;
    if (this.okToSend()) {
      if (this.callbackBuildStatus) this.callbackBuildStatus(true);
      this.sendBuild();
    }
  };

  setMainFile(path:string) {
    this.mainPath = path;
    if (this.callbackBuildStatus) this.callbackBuildStatus(true);
    this.sendBuild();
  }

  processBuildListings(data: WorkerOutputResult<any> | WorkerErrorResult) {
    // TODO: link listings with source files
    if (data.listings) {
      this.listings = data.listings;
      for (var lstname in this.listings) {
        var lst = this.listings[lstname];
        if (lst.lines)
          lst.sourcefile = new SourceFile(lst.lines, lst.text);
        if (lst.asmlines)
          lst.assemblyfile = new SourceFile(lst.asmlines, lst.text);
      }
    }
  }

  processBuildResult(data: WorkerOutputResult<any>) {
    this.processBuildListings(data);
    this.processBuildSegments(data);
  }

  processBuildSegments(data: WorkerOutputResult<any>) {
    // save and sort segment list
    var segs = (this.platform.getMemoryMap && this.platform.getMemoryMap()["main"]) || [];
    if (data.segments) { segs = segs.concat(data.segments || []); }
    segs.sort((a,b) => {return a.start-b.start});
    this.segments = segs;
  }

  getListings() : CodeListingMap {
    return this.listings;
  }

  // returns first listing in format [prefix].lst (TODO: could be better)
  getListingForFile(path: string) : CodeListing {
    // ignore include files (TODO)
    //if (path.toLowerCase().endsWith('.h') || path.toLowerCase().endsWith('.inc'))
      //return;
    var fnprefix = getFilenamePrefix(this.stripLocalPath(path));
    var listings = this.getListings();
    var onlyfile = null;
    for (var lstfn in listings) {
      if (lstfn == path)
        return listings[lstfn];
    }
    for (var lstfn in listings) {
      onlyfile = lstfn;
      if (getFilenamePrefix(lstfn) == fnprefix) {
        return listings[lstfn];
      }
    }
  }
  
  stripLocalPath(path : string) : string {
    if (this.mainPath) {
      var folder = getFolderForPath(this.mainPath);
      if (folder != '' && path.startsWith(folder)) {
        path = path.substring(folder.length+1);
      }
    }
    return path;
  }

  updateDataItems(items: WorkerItemUpdate[]) {
    this.dataItems = items;
    if (this.okToSend()) { // TODO? mainpath == null?
      this.sendBuild(); // TODO: don't need entire build?
    }
  }

}

export function createNewPersistentStore(storeid:string) : LocalForage {
  var store = localforage.createInstance({
    name: "__" + storeid,
    version: 2.0
  });
  return store;
}

