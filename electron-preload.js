// preload.js for Electron app
const { ipcRenderer } = require('electron');
const fs = require('fs');
const modpath = require('path');

process.once('loaded', () => {
  // workspace root path
  // reload() clears this, so we have to set it every time
  var wsroot;
  // from browser: read workspace file synchronously
  window.getWorkspaceFile = function(path, filetype) {
    if (wsroot == null) throw Error("no workspace root set");
    try {
      // TODO: detect text or binary, or decide based on incbin vs. source file
      var fullpath = modpath.join(wsroot, modpath.normalize(path));
      var encoding = filetype == 'text' ? 'utf8' : null;
      var data = fs.readFileSync(fullpath, {encoding:encoding});
      if (encoding == null) data = new Uint8Array(data);
      console.log("getWorkspaceFile", path, filetype, data.length);
      // TODO: add to watched files
      return data;
    } catch (e) {
      console.log(e);
      return null;
    }
  }
  // from browser: put workspace file
  window.putWorkspaceFile = function(path, data) {
    if (wsroot == null) throw Error("no workspace root set");
    var fullpath = modpath.join(wsroot, modpath.normalize(path));
    var encoding = typeof data === 'string' ? 'utf8' : null;
    fs.writeFileSync(fullpath, data, {encoding:encoding});
  }
  // from electron.js: set workspace root directory
  ipcRenderer.on('setWorkspaceRoot', (event, data) => {
    wsroot = data.root;
    var binpath = modpath.join(wsroot, 'bin');
    if (!fs.existsSync(binpath)) fs.mkdirSync(binpath, {});
    console.log('setWorkspaceRoot', wsroot);
  });
  // from electron.js: file changed
  ipcRenderer.on('fileChanged', (event, data) => {
    var path = data.path;
    console.log('fileChanged', path);
    window.reloadWorkspaceFile(path);
  });
});
