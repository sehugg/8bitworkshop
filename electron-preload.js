// preload.js for Electron app
const { ipcRenderer } = require('electron');
const fs = require('fs');
const modpath = require('path');

// workspace root path
// TODO: reloading clears this
var wsroot = null;

// from browser: read workspace file synchronously
window.getWorkspaceFile = function(path, filetype) {
  if (wsroot == null) throw Error("no workspace root set");
  try {
    // TODO: detect text or binary, or decide based on incbin vs. source file
    var fullpath = modpath.join(wsroot, modpath.normalize(path));
    var data = fs.readFileSync(fullpath, {encoding:filetype=='text'?'utf8':'binary'});
    console.log("getWorkspaceFile", path, filetype);
    // TODO: add to watched files
    return data;
  } catch (e) {
    console.log(e);
    return null;
  }
}

process.once('loaded', () => {
  // from electron.js: set workspace root directory
  ipcRenderer.on('setWorkspaceRoot', (event, data) => {
    wsroot = data.root;
    console.log('setWorkspaceRoot', wsroot);
  });
  // from electron.js: file changed
  ipcRenderer.on('fileChanged', (event, data) => {
    var path = data.path;
    console.log('fileChanged', path);
    window.reloadWorkspaceFile(path);
  });
});
