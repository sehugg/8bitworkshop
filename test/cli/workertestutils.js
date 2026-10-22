
var _require = require;
var assert = require('assert');
var fs = require('fs');
var vm = require('vm');

// The Emscripten glue that runs the tools adds process handlers that abort
// the host on an unhandled rejection and rethrow uncaught exceptions, which
// node turns into exit code 7. A mocha worker that dies that way takes the
// whole test file with it, and the failure that caused it is never reported.
// The host owns these events: ignore the handlers the glue adds.
var gluehandlers = require('../../gen/worker/gluehandlers.js');
gluehandlers.ignoreGlueProcessHandlers();

var worker = {};

//process.exit = function() { console.log("arggh you can't exit when i pass noExitRuntime! lol process.exit() go brrr") }

global.window = global;
global.exports = {};
global.self = global;
global.location = {href:'.'};
global.path = require('path');
global.btoa = require('btoa');
global.atob = require('atob');
global.navigator = global; // for mousetrap :P 
global.ResizeObserver = class { observe() { } }

global.includeInThisContext = function(path) {
  var code = fs.readFileSync(path);
  vm.runInThisContext(code, path);
};

global.importScripts = function(path) {
  var full = 'gen/worker/' + path;
  gluehandlers.noteGlueScript(full);
  includeInThisContext(full);
}

// like the browser's Blob: takes a binary string, an ArrayBuffer, a
// Uint8Array, or an array of those
function toBytes(parts) {
  if (typeof parts == 'string') {
    var b = new Uint8Array(parts.length);
    for (var i = 0; i < parts.length; i++) b[i] = parts.charCodeAt(i) & 0xff;
    return b;
  }
  if (parts instanceof Uint8Array) return parts;
  if (parts instanceof ArrayBuffer) return new Uint8Array(parts);
  if (Array.isArray(parts)) {
    var chunks = parts.map(toBytes);
    var total = 0;
    for (var c of chunks) total += c.length;
    var out = new Uint8Array(total);
    var off = 0;
    for (var c of chunks) { out.set(c, off); off += c.length; }
    return out;
  }
  return new Uint8Array(0);
}

function Blob(parts) {
  var bytes = toBytes(parts);
  this.size = bytes.length;
  this.length = bytes.length;
  this.slice = function(a,b) {
    return new Blob(bytes.slice(a,b));
  }
  this.arrayBuffer = this.asArrayBuffer = function() {
    return bytes.slice();
  }
}

// the worker code asks for a Blob through this (see wasmutils.makeBlob)
global.makeBlob = function(bytes) {
  return new Blob(bytes);
}

global.XMLHttpRequest = function() {
    this.open = function(a,b,c) {
        //console.log(':::xml',a,'src/worker/'+b,c,this.responseType);
        if (this.responseType == 'json') {
            var txt = fs.readFileSync('src/worker/'+b);
            this.response = JSON.parse(txt);
        } else if (this.responseType == 'blob') {
            var data = fs.readFileSync('src/worker/'+b, {encoding:'binary'});
            this.response = new Blob(data);
        } else if (this.responseType == 'arraybuffer') {
            var data = fs.readFileSync('src/worker/'+b, {encoding:'binary'});
            this.response = toBytes(data).buffer;
        }
        this.status = this.response ? 200 : 404;
        //console.log(':::xml',this.response.length);
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

//includeInThisContext("gen/worker/workermain.js");
require('gen/worker/bundle.js')

global.ab2str = function(buf) {
  return String.fromCharCode.apply(null, new Uint16Array(buf));
}

global.localItems = {};
global.localMods = 0;

global.localStorage = {
 clear: function() {
  localItems = {};
  localMods = 0;
  this.length = 0;
 },
 getItem: function(k) {
  console.log('get',k);
  return localItems[k];
 },
 setItem: function(k,v) {
  console.log('set',k,v.length<100?v:v.length);
  if (!localItems[k]) this.length++;
  localItems[k] = v;
  localMods++;
 },
 removeItem: function(k) {
  if (localItems[k]) {
   this.length--;
   delete localItems[k];
   localMods++;
  }
 },
 length: 0,
 key: function(i) {
  var keys = [];
  for (var k in localItems)
   keys.push(k);
  console.log(i,keys[i]);
  return keys[i];
 }
};

global.fetch = function(path) {
  return new Promise( (resolve, reject) => {
    try {
      var bin = fs.readFileSync(path, {encoding:'binary'});
      var response = new Blob(bin);
      resolve(response);
    } catch (e) {
      reject(e);
    }
  });
}

global.createTestDOM = function() {
  const jsdom = require('jsdom');
  const { JSDOM } = jsdom;
  const dom = new JSDOM(`<!DOCTYPE html><div id="emulator"><div id="javatari-screen"></div></div>`);
  global.window = dom.window;
  global.document = dom.window.document;
  global['$'] = require("jquery/jquery.min.js");
  dom.window.Audio = null;
  global.Image = function() { }
  return dom;
}
