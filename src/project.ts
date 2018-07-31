"use strict";

import { FileData, Dependency, SourceLine, SourceFile, CodeListing, CodeListingMap, WorkerError, WorkerResult } from "./workertypes";

type BuildResultCallback = (result:WorkerResult) => void;
type BuildStatusCallback = (busy:boolean) => void;
type LoadFilesCallback = (err:string, result?:Dependency[]) => void;
type IterateFilesCallback = (path:string, data:FileData) => void;
type GetRemoteCallback = any; // TODO (path:string, (text:string) => FileData) => void;

export class CodeProject {
  filedata : {[path:string]:FileData} = {};
  listings : CodeListingMap;
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
  mainPath: string;
  
  constructor(worker, platform_id:string, platform, store) {
    this.worker = worker;
    this.platform_id = platform_id;
    this.platform = platform;
    this.store = store;

    worker.onmessage = (e) => {
      var notfinal = this.pendingWorkerMessages > 1;
      if (notfinal) {
        this.sendBuild();
      } else {
        if (this.callbackBuildStatus) this.callbackBuildStatus(false);
      }
      this.pendingWorkerMessages = 0;
      if (e.data && !e.data.unchanged) {
        this.processBuildResult(e.data);
        if (this.callbackBuildResult) this.callbackBuildResult(e.data); // call with data when changed
      }
    };
  }
  
  preloadWorker(path:string) {
    var tool = this.platform.getToolForFilename(path);
    if (tool && !this.tools_preloaded[tool]) {
      this.worker.postMessage({preload:tool, platform:this.platform_id});
      this.tools_preloaded[tool] = true;
    }
  }

  // TODO: support link-time and compile-time (include) dependencies  
  parseFileDependencies(text:string):string[] {
    var files = [];
    if (this.platform_id == 'verilog') {
      var re = /^\s*(`include|[.]include)\s+"(.+?)"/gm;
      var m;
      while (m = re.exec(text)) {
        files.push(m[2]);
        //files.push('local/'+m[2]); // TODO: shows up 2x in interface
      }
    } else {
      var re = /^\s*([;#]|[/][/][#])link\s+"(.+?)"/gm;
      var m;
      while (m = re.exec(text)) {
        files.push(m[2]);
      }
    }
    return files;
  }

  loadFileDependencies(text:string, callback:LoadFilesCallback) {
    var paths = this.parseFileDependencies(text);
    this.loadFiles(paths, callback);
  }
  
  okToSend():boolean {
    return this.pendingWorkerMessages++ == 0;
  }

  updateFileInStore(path:string, text:FileData) {
    // protect against accidential whole-file deletion
    if ((<string>text).trim && (<string>text).trim().length) {
      // TODO? (originalFileID != path || text != originalText)) {
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
    msg.updates.push({path:mainfilename, data:maintext});
    msg.buildsteps.push({path:mainfilename, platform:this.platform_id, tool:this.platform.getToolForFilename(this.mainpath), mainfile:true});
    for (var i=0; i<depends.length; i++) {
      var dep = depends[i];
      if (dep.data) {
        this.preloadWorker(dep.filename);
        msg.updates.push({path:dep.filename, data:dep.data});
        msg.buildsteps.push({path:dep.filename, platform:this.platform_id, tool:this.platform.getToolForFilename(dep.path)});
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
              this.filedata[path] = value;
              addResult(path, value);
              loadNext();
            } else {
              // found on remote fetch?
              var webpath = "presets/" + this.platform_id + "/" + path;
              if (this.platform_id == 'vcs' && path.indexOf('.') <= 0)
                webpath += ".a"; // legacy stuff
              this.callbackGetRemote( webpath, (text:string) => {
                console.log("GET",webpath,text.length,'bytes');
                this.filedata[path] = text;
                addResult(path, text);
                loadNext();
              }, 'text')
              .fail( (err:XMLHttpRequest) => {
                console.log("Could not load preset", path, err);
                // only cache result if status is 404 (not found)
                if (err.status && err.status == 404)
                  this.filedata[path] = null;
                loadNext();
              });
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
  
  iterateFiles(callback:IterateFilesCallback) {
    for (var path in this.filedata) {
      callback(path, this.getFile(path));
    }
  }
  
  sendBuild() {
    var self = this;
    var maindata = this.getFile(this.mainpath);
    var text = typeof maindata === "string" ? maindata : '';
    this.loadFileDependencies(text, (err, depends) => {
      if (err) {
        console.log(err); // TODO?
      }
      if (!depends) depends = [];
      if (this.platform_id == 'verilog') {
        // TODO: should get rid of this msg format
        this.worker.postMessage({
          code:text,
          path:getFilenameForPath(this.mainpath),
          dependencies:depends,
          platform:this.platform_id,
          tool:this.platform.getToolForFilename(this.mainpath)
        });
      } else {
        var workermsg = this.buildWorkerMessage(depends);
        this.worker.postMessage(workermsg);
      }
    });
  }
  
  updateFile(path:string, text:FileData) {
    this.updateFileInStore(path, text); // TODO: isBinary
    this.filedata[path] = text;
    if (this.okToSend()) {
      if (!this.mainpath) this.mainpath = path;
      if (this.callbackBuildStatus) this.callbackBuildStatus(true);
      this.sendBuild();
    }
  };
  
  processBuildResult(data:WorkerResult) {
    // TODO: link listings with source files
    this.listings = data.listings;
    if (this.listings) {
      for (var lstname in this.listings) {
        var lst = this.listings[lstname];
        if (lst.lines)
          lst.sourcefile = new SourceFile(lst.lines);
        if (lst.asmlines)
          lst.assemblyfile = new SourceFile(lst.asmlines, lst.text);
      }
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

