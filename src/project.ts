"use strict";

import { FileData, Dependency, SourceLine, SourceFile, CodeListing, CodeListingMap, WorkerError, Segment, WorkerResult } from "./workertypes";
import { getFilenameForPath, getFilenamePrefix, getFolderForPath, isProbablyBinary } from "./util";

type BuildResultCallback = (result:WorkerResult) => void;
type BuildStatusCallback = (busy:boolean) => void;
type LoadFilesCallback = (err:string, result?:Dependency[]) => void;
type IterateFilesCallback = (path:string, data:FileData) => void;
type GetRemoteCallback = (path:string, callback:(data:FileData) => void, datatype:'text'|'arraybuffer') => any;

export class CodeProject {
  filedata : {[path:string]:FileData} = {};
  listings : CodeListingMap;
  segments : Segment[];
  mainpath : string;
  pendingWorkerMessages = 0;
  tools_preloaded = {};
  callbackBuildResult : BuildResultCallback;
  callbackBuildStatus : BuildStatusCallback;
  worker : Worker;
  platform_id : string;
  platform: any; // TODO: use type
  store: any;
  callbackGetRemote : GetRemoteCallback;
  mainPath : string;
  isCompiling : boolean = false;

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
      if (this.callbackBuildResult) this.callbackBuildResult(data); // call with data when changed
    }
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
    files.push('local/'+fn);
    files.push(fn);
    // look for files in current (main file) folder
    var dir = getFolderForPath(this.mainpath);
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
      // include .arch (json) statements
      let re2 = /^\s*([.]arch)\s+(\w+)/gmi;
      while (m = re2.exec(text)) {
        this.pushAllFiles(files, m[2]+".json");
      }
      // include $readmem[bh] (TODO)
      let re3 = /\b\$readmem[bh]\("(.+?)"/gmi;
      while (m = re3.exec(text)) {
        this.pushAllFiles(files, m[2]);
      }
    } else {
      // for .asm -- [.]include "file"
      // for .c -- #include "file"
      let re2 = /^\s*[.#]?(include|incbin)\s+"(.+?)"/gmi;
      while (m = re2.exec(text)) {
        this.pushAllFiles(files, m[2]);
      }
      // for .c -- //#link "file" (or ;link or #link)
      let re3 = /^\s*([;#]|[/][/][#])resource\s+"(.+?)"/gm;
      while (m = re3.exec(text)) {
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
      let re = /^\s*([;#]|[/][/][#])link\s+"(.+?)"/gm;
      while (m = re.exec(text)) {
        this.pushAllFiles(files, m[2]);
      }
    }
    return files;
  }

  loadFileDependencies(text:string, callback:LoadFilesCallback) {
    let includes = this.parseIncludeDependencies(text);
    let linkfiles = this.parseLinkDependencies(text);
    let allfiles = includes.concat(linkfiles);
    this.loadFiles(allfiles, (err:string, result?:Dependency[]) => {
      // set 'link' property on files that are link dependencies (must match filename)
      if (result) {
        for (let dep of result) {
          dep.link = linkfiles.indexOf(dep.path) >= 0;
        }
      }
      callback(err, result);
    });
  }

  okToSend():boolean {
    return this.pendingWorkerMessages++ == 0;
  }

  updateFileInStore(path:string, text:FileData) {
    // protect against accidential whole-file deletion
    if ((<string>text).trim && (<string>text).trim().length) {
      this.store.setItem(path, text);
    }
  }

  // TODO: test duplicate files, local paths mixed with presets
  buildWorkerMessage(depends:Dependency[]) {
    this.preloadWorker(this.mainpath);
    var msg = {updates:[], buildsteps:[]};
    // TODO: add preproc directive for __MAINFILE__
    var mainfilename = getFilenameForPath(this.mainpath);
    var maintext = this.getFile(this.mainpath);
    var depfiles = [];
    msg.updates.push({path:mainfilename, data:maintext});
    for (var dep of depends) {
      if (!dep.link) {
        msg.updates.push({path:dep.filename, data:dep.data});
        depfiles.push(dep.filename);
      }
    }
    msg.buildsteps.push({path:mainfilename, files:[mainfilename].concat(depfiles), platform:this.platform_id, tool:this.platform.getToolForFilename(this.mainpath), mainfile:true});
    for (var dep of depends) {
      if (dep.data && dep.link) {
        this.preloadWorker(dep.filename);
        msg.updates.push({path:dep.filename, data:dep.data});
        msg.buildsteps.push({path:dep.filename, files:[dep.filename].concat(depfiles), platform:this.platform_id, tool:this.platform.getToolForFilename(dep.path)});
      }
    }
    return msg;
  }

  // TODO: get local file as well as presets?
  loadFiles(paths:string[], callback:LoadFilesCallback) {
    var result : Dependency[] = [];
    function addResult(path, data) {
      result.push({
        path:path,
        filename:getFilenameForPath(path),
        link:true,
        data:data
      });
    }
    var loadNext = () => {
      var path = paths.shift();
      if (!path) {
        // finished loading all files; return result
        callback(null, result);
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
              callback(err, result);
            } else if (value) { // found in store?
              this.filedata[path] = value; // do not update store, just cache
              addResult(path, value);
              loadNext();
            } else if (!path.startsWith("local/")) {
              // don't load local/
              // found on remote fetch?
              var preset_id = this.platform_id;
              preset_id = preset_id.replace(/[.]\w+/,''); // remove .suffix from preset name
              var webpath = "presets/" + preset_id + "/" + path;
              if (this.platform_id.startsWith('vcs') && path.indexOf('.') <= 0)
                webpath += ".a"; // legacy stuff
              // try to GET file, use file ext to determine text/binary
              this.callbackGetRemote( webpath, (data:FileData) => {
                if (data == null) {
                  console.log("Could not load preset file", path);
                  this.filedata[path] = null; // mark cache entry as invalid
                } else {
                  if (data instanceof ArrayBuffer)
                    data = new Uint8Array(data); // convert to typed array
                  console.log("GET",webpath,data.length,'bytes');
                  this.filedata[path] = data; // do not update store, just cache
                  addResult(path, data);
                }
                loadNext();
              }, isProbablyBinary(path) ? 'arraybuffer' : 'text');
            } else {
              // not gonna find it, keep going
              loadNext();
            }
          });
        }
      }
    }
    loadNext(); // load first file
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
    if (!this.mainpath) throw "need to call setMainFile first";
    var maindata = this.getFile(this.mainpath);
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
    this.loadFileDependencies(text, (err, depends) => {
      if (err) {
        console.log(err); // TODO?
      }
      if (!depends) depends = [];
      var workermsg = this.buildWorkerMessage(depends);
      this.worker.postMessage(workermsg);
      this.isCompiling = true;
    });
  }

  updateFile(path:string, text:FileData) {
    this.updateFileInStore(path, text); // TODO: isBinary
    this.filedata[path] = text;
    if (this.okToSend() && this.mainpath) {
      if (this.callbackBuildStatus) this.callbackBuildStatus(true);
      this.sendBuild();
    }
  };

  setMainFile(path:string) {
    this.mainpath = path;
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
    this.segments = data.segments;
    if (this.segments) {
      this.segments.sort((a,b) => {return a.start-b.start});
    }
  }

  getListings() : CodeListingMap {
    return this.listings;
  }

  // returns first listing in format [prefix].lst (TODO: could be better)
  getListingForFile(path) : CodeListing {
    var fnprefix = getFilenamePrefix(getFilenameForPath(path));
    var listings = this.getListings();
    for (var lstfn in listings) {
      if (getFilenamePrefix(lstfn) == fnprefix) {
        return listings[lstfn];
      }
    }
  }
}
