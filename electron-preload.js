"use strict";

// preload.js for Electron app
const { ipcRenderer } = require('electron');
const fs = require('fs');
const _path = require('path');
const chokidar = require('chokidar');

const homeDirectory = require('os').homedir();
const wsroot = _path.join(homeDirectory, '8bitworkshop');

function getLocalDir() {
  const _ui = window.ui_1 || window.ui || window; // TODO: module naming
  var dir = _ui.repo_id || _ui.platform_id || 'default';
  return _path.join(wsroot, dir);
}
function getLocalFilePath(path) {
  return _path.join(getLocalDir(), path);
}

function isProbablyBinary(path, data) {
  var score = 0;
  // decode as UTF-8
  for (var i = 0; i < (data?data.length:0);) {
    let c = data[i++];
    if ((c & 0x80) == 0) {
      // more likely binary if we see a NUL or obscure control character
      if (c < 9 || (c >= 14 && c < 26) || c == 0x7f) {
        score++;
        break;
      }
    } else {
      // look for invalid unicode sequences
      var nextra = 0;
      if ((c & 0xe0) == 0xc0) nextra = 1;
      else if ((c & 0xf0) == 0xe0) nextra = 2;
      else if ((c & 0xf8) == 0xf0) nextra = 3;
      else if (c < 0xa0) score++;
      else if (c == 0xff) score++;
      while (nextra--) {
        if (i >= data.length || (data[i++] & 0xc0) != 0x80) {
          score++;
          break;
        }
      }
    }
  }
  return score > 0;
}

// this is before startUI is called
process.once('loaded', () => {
  var watcher;
  var allfiles = new Set();
  // get workspace root dir
  // from browser: read workspace files asynchronously
  window.alternateLocalFilesystem = {
    getFileData: (path) => {
      let fullpath = getLocalFilePath(path);
      allfiles.add(fullpath);
      if (!fs.existsSync(fullpath)) {
        return null;
      }
      return new Promise( (resolve, reject) => {
        fs.readFile(fullpath, (err,buf) => {
          if (err) {
            resolve(err);
          } else {
            let isBinary = isProbablyBinary(path, buf);
            let data = isBinary ? buf : buf.toString('utf-8');
            console.log("getWorkspaceFile", path, isBinary, data.length);
            resolve(data);
          }
        });
      });
    },
    setFileData: (path, data) => {
      let fullpath = getLocalFilePath(path);
      allfiles.add(fullpath);
      let encoding = typeof data === 'string' ? 'utf8' : null;
      console.log("setWorkspaceFile", fullpath, data.length);
      return new Promise( (resolve, reject) => {
        fs.mkdir(_path.dirname(fullpath), {recursive:true}, (err,dirpath) => {
          fs.writeFile(fullpath, data, {encoding:encoding}, (err) => {
            if (err) {
              reject(err);
            } else {
              resolve();
            }
          });
        });
      });
    }
  }
  // watch/unwatch files as browser loses/gains focus
  window.addEventListener("blur", (e) => {
    let localdir = getLocalDir();
    if (!watcher && localdir) {
      // watch files for changes
      watcher = chokidar.watch(Array.from(allfiles), {
        //awaitWriteFinish: {pollInterval:50,stabilityThreshold:300},
        ignoreInitial: true
      });
      watcher.on('all', (event, path) => {
        path = path.substring(localdir.length + 1); //strip off prefix
        console.log('WATCH', event, path);
        // we don't use awaitWriteFinish b/c we might close() the watcher
        setTimeout(() => {
          window.reloadWorkspaceFile(path);
        }, 300);
      });
      console.log('watching', getLocalDir());
    }
  });
  window.addEventListener("focus", (e) => {
    if (watcher) {
      watcher.close();
      watcher = null;
    }
    console.log('stopped watching');
  });

  // from electron.js: set workspace root directory
  /*
  TODO
  ipcRenderer.on('setWorkspaceRoot', (event, data) => {
    wsroot = data.root;
    var binpath = _path.join(wsroot, 'bin');
    if (!fs.existsSync(binpath)) fs.mkdirSync(binpath, {});
    console.log('setWorkspaceRoot', wsroot);
  });
  // from electron.js: file changed
  ipcRenderer.on('fileChanged', (event, data) => {
    var path = data.path;
    window.reloadWorkspaceFile(path);
  });
  */
  console.log('loaded preload', window.alternateLocalFilesystem, window.startUI);
});
