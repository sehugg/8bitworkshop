
// TODO: merge with workertestutils

var assert = require('assert');
var fs = require('fs');
var vm = require('vm');

var worker = {};

global.includeInThisContext = function(path) {
    var code = fs.readFileSync(path);
    vm.runInThisContext(code, path);
};

global.importScripts = function(path) {
    includeInThisContext('./'+path);
}

function Blob(blob) {
  this.size = blob.length;
  this.length = blob.length;
  this.slice = function(a,b) {
    var data = blob.slice(a,b);
    var b = new Blob(data);
    return b;
  }
  this.asArrayBuffer = function() {
    var buf = new ArrayBuffer(blob.length);
    var arr = new Uint8Array(buf);
    for (var i=0; i<blob.length; i++)
      arr[i] = blob[i].charCodeAt(0);
    return arr;
  }
}

global.XMLHttpRequest = function() {
    this.open = function(a,b,c) {
        if (this.responseType == 'json') {
            var txt = fs.readFileSync('./'+b);
            this.response = JSON.parse(txt);
        } else if (this.responseType == 'blob') {
            var data = fs.readFileSync('./'+b, {encoding:'binary'});
            this.response = new Blob(data);
        } else if (this.responseType == 'arraybuffer') {
            var data = fs.readFileSync('./'+b, {encoding:'binary'});
            this.response = new Blob(data).asArrayBuffer();
        } else {
            throw new Error("responseType " + this.responseType + " not handled");
        }
    }
    this.send = function() { }
}

global.FileReaderSync = function() {
  this.readAsArrayBuffer = function(blob) {
    return blob.asArrayBuffer();
  }
}

global.onmessage = null;
global.postMessage = null;

includeInThisContext("./workermain.js");

global.ab2str = function(buf) {
  return String.fromCharCode.apply(null, new Uint16Array(buf));
}

if (require.main == module) {
  var data = fs.readFileSync(process.argv[2]);
  var msgs = JSON.parse(data);
  for (var i=0; i<msgs.length; i++) {
    var result = handleMessage(msgs[i]);
    //console.log(result);
    if (result && result.intermediate) {
      for (var fn in result.intermediate) {
        console.log("==="+fn);
        console.log(result.intermediate[fn]);
      }
    }
    for (var fn in workfs) {
      if (fn.endsWith('.lstxxx'))
        console.log(workfs[fn].data);
    }
  }
}
