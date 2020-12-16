
import { FileData, Dependency, SourceLine, SourceFile, CodeListing, CodeListingMap, WorkerError, Segment, WorkerResult } from "../common/workertypes";
import { getFilenamePrefix, getFolderForPath, isProbablyBinary, getBasePlatform } from "../common/util";
import { Platform } from "../common/baseplatform";

type BuildResultCallback = (result:WorkerResult) => void;
type BuildStatusCallback = (busy:boolean) => void;
type IterateFilesCallback = (path:string, data:FileData) => void;
type GetRemoteCallback = (path:string, callback:(data:FileData) => void, datatype:'text'|'arraybuffer') => any;

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
  store : any;
  isCompiling : boolean = false;
  filename2path = {}; // map stripped paths to full paths
  persistent : boolean = true; // set to true and won't modify store

  callbackBuildResult : BuildResultCallback;
  callbackBuildStatus : BuildStatusCallback;
  callbackGetRemote : GetRemoteCallback;
  callbackStoreFile : IterateFilesCallback;

  constructor(worker, platform_id:string, platform, store) {
    this.worker = worker;
    this.platform_id = platform_id;
    this.platform = platform;
    this.store = store;

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
    if (data && !data.unchanged) {
      this.processBuildResult(data);
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

  parseIncludeDependencies(text:string):string[] {
    let files = [];
    let m;
    if (this.platform_id.startsWith('verilog')) {
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
    return this.pendingWorkerMessages++ == 0;
  }

  updateFileInStore(path:string, text:FileData) {
    // protect against accidential whole-file deletion
    if (this.persistent && !isEmptyString(text)) {
      this.store.setItem(path, text);
    }
    if (this.callbackStoreFile != null) {
      this.callbackStoreFile(path, text);
    }
  }

  // TODO: test duplicate files, local paths mixed with presets
  buildWorkerMessage(depends:Dependency[]) {
    this.preloadWorker(this.mainPath);
    var msg = {updates:[], buildsteps:[]};
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
    return msg;
  }

  // TODO: get local file as well as presets?
  loadFiles(paths:string[]) : Promise<Dependency[]> {
   return new Promise( (yes,no) => {
    var result : Dependency[] = [];
    var addResult = (path, data) => {
      result.push({
        path:path,
        filename:this.stripLocalPath(path),
        link:true,
        data:data
      });
    }
    var loadNext = () => {
      var path = paths.shift();
      if (!path) {
        // finished loading all files; return result
        yes(result);
      } else {
        // look in cache
        if (path in this.filedata) { // found in cache?
          var data = this.filedata[path];
          if (data)
            addResult(path, data);
          loadNext();
        } else {
          // look in store
          this.store.getItem(path, (err, value) => {
            if (err) { // err fetching from store
              no(err);
            } else if (value) { // found in store?
              this.filedata[path] = value; // do not update store, just cache
              addResult(path, value);
              loadNext();
            } else {
              // found on remote fetch?
              var preset_id = this.platform_id;
              preset_id = getBasePlatform(preset_id); // remove .suffix from preset name
              var webpath = "presets/" + preset_id + "/" + path;
              // try to GET file, use file ext to determine text/binary
              this.callbackGetRemote( webpath, (data:FileData) => {
                if (data == null) {
                  console.log("Could not load preset file", path);
                  this.filedata[path] = null; // mark cache entry as invalid
                } else {
                  if (data instanceof ArrayBuffer)
                    data = new Uint8Array(data); // convert to typed array
                  console.log("read",webpath,data.length,'bytes');
                  this.filedata[path] = data; // do not update store, just cache
                  addResult(path, data);
                }
                loadNext();
              }, isProbablyBinary(path) ? 'arraybuffer' : 'text');
            }
          });
        }
      }
    }
    loadNext(); // load first file
   });
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
    if (this.okToSend() && this.mainPath) {
      if (this.callbackBuildStatus) this.callbackBuildStatus(true);
      this.sendBuild();
    }
  };

  setMainFile(path:string) {
    this.mainPath = path;
    if (this.callbackBuildStatus) this.callbackBuildStatus(true);
    this.sendBuild();
  }

  processBuildResult(data:WorkerResult) {
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
  getListingForFile(path) : CodeListing {
    // ignore include files (TODO)
    if (path.toLowerCase().endsWith('.h') || path.toLowerCase().endsWith('.inc'))
      return;
    var fnprefix = getFilenamePrefix(this.stripLocalPath(path));
    var listings = this.getListings();
    for (var lstfn in listings) {
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

}
