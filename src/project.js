"use strict";

function SourceFile(lines, text) {
  lines = lines || [];
  this.lines = lines;
  this.text = text;
  this.offset2line = {};
  this.line2offset = {};
  for (var info of lines) {
    if (info.offset >= 0) {
      this.offset2line[info.offset] = info.line;
      this.line2offset[info.line] = info.offset;
    }
  }
  this.findLineForOffset = function(PC) {
    if (this.offset2line) {
      for (var i=0; i<16; i++) {
        var line = this.offset2line[PC];
        if (line >= 0) {
          return line;
        }
        PC--;
      }
    }
    return 0;
  }
  this.lineCount = function() { return this.line2offset.length; }
}

function CodeProject(worker, platform_id, platform, store) {
  var self = this;
  
  self.callbackResendFiles = function() { }; // TODO?
  self.callbackBuildResult = function(result) { };
  self.callbackBuildStatus = function(busy) { };
  
  var pendingWorkerMessages = 0;

  var tools_preloaded = {};
  function preloadWorker(path) {
    var tool = platform.getToolForFilename(path);
    if (tool && !tools_preloaded[tool]) {
      worker.postMessage({preload:tool, platform:platform_id});
      tools_preloaded[tool] = true;
    }
  }
  
  self.loadFiles = function(filenames, callback) {
    var result = [];
    function loadNext() {
      var fn = filenames.shift();
      if (!fn) {
        callback(null, result); // TODO?
      } else {
        store.getItem(fn, function(err, value) {
          if (err) {
            callback(err);
          } else if (value) {
            result.push({
              path:fn,
              data:value
            });
            loadNext();
          } else {
            var webpath = "presets/" + platform_id + "/" + fn;
            if (platform_id == 'vcs' && webpath.indexOf('.') <= 0)
              webpath += ".a"; // legacy stuff
            $.get( webpath, function( text ) {
              console.log("GET",webpath,text.length,'bytes');
              result.push({
                path:fn,
                data:text
              });
              loadNext();
            }, 'text')
            .fail(function() {
              callback("Could not load preset " + fn);
            });
          }
        });
      }
    }
    loadNext(); // load first file
  }

  // TODO: merge with loadFiles()
  function loadFileDependencies(text, callback) {
    var filenames = [];
    if (platform_id == 'verilog') {
      var re = /^(`include|[.]include)\s+"(.+?)"/gm;
      var m;
      while (m = re.exec(text)) {
        filenames.push(m[2]);
      }
    }
    var result = [];
    function loadNextDependency() {
      var fn = filenames.shift();
      if (!fn) {
        callback(result);
      } else {
        store.getItem(fn, function(err, value) {
          result.push({
            filename:fn,
            prefix:platform_id,
            text:value // might be null, that's ok
          });
          loadNextDependency();
        });
      }
    }
    loadNextDependency(); // load first dependency
  }
  
  function okToSend() {
    return pendingWorkerMessages++ == 0;
  }

  function updateFileInStore(path, text) {
    // protect against accidential whole-file deletion
    if (text.trim().length) {
      // TODO? (originalFileID != path || text != originalText)) {
      store.setItem(path, text);
    }
  }
    
  self.updateFile = function(path, text, isBinary) {
    updateFileInStore(path, text); // TODO: isBinary
    preloadWorker(path);
    if (okToSend()) {
      self.callbackBuildStatus(true);
      loadFileDependencies(text, function(depends) {
        worker.postMessage({
          code:text,
          dependencies:depends,
          platform:platform_id,
          tool:platform.getToolForFilename(path)
        });
      });
    }
  };
  
  function processBuildResult(data) {
    if (data.listings) {
      for (var lstname in data.listings) {
        var lst = data.listings[lstname];
        if (lst.lines)
          lst.sourcefile = new SourceFile(lst.lines);
        if (lst.asmlines)
          lst.assemblyfile = new SourceFile(lst.asmlines, lst.text);
      }
    }
  }

  worker.onmessage = function(e) {
    if (pendingWorkerMessages > 1) {
      self.callbackResendFiles(); // TODO: we should handle this internally
      pendingWorkerMessages = 0;
    } else {
      pendingWorkerMessages = 0;
    }
    self.callbackBuildStatus(false);
    if (e.data && !e.data.unchanged) {
      processBuildResult(e.data);
      self.callbackBuildResult(e.data);
    }
  };

  // TODO: parse output, listings, files, etc
}

