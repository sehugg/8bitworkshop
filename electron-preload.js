// preload.js for Electron app
const { ipcRenderer } = require('electron');
const fs = require('fs');
const modpath = require('path');

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

process.once('loaded', () => {
  // workspace root path
  // reload() clears this, so we have to set it every time
  var wsroot;
  // from browser: read workspace file synchronously
  window.getWorkspaceFile = function(path, filetype) {
    if (wsroot == null) throw Error("no workspace root set");
    try {
      var fullpath = modpath.join(wsroot, modpath.normalize(path));
      var data = fs.readFileSync(fullpath); // read binary
      var buf = new Uint8Array(data); // convert to array
      var isBinary = filetype != 'text' || isProbablyBinary(path, buf);
      data = isBinary ? buf : data.toString('utf-8');
      console.log("getWorkspaceFile", path, isBinary, data.length);
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
    window.reloadWorkspaceFile(path);
  });
});
