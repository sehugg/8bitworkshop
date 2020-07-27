
var assert = require('assert');
var fs = require('fs');
var vm = require('vm');

var worker = {};

global.window = global;
global.exports = {};
global.self = global;
global.location = {href:'.'};
global.require = (modname) => {
  console.log("REQUIRE",modname);
  if (modname == 'path')
    return require(modname);
};

global.btoa = require('btoa');
global.atob = require('atob');

global.includeInThisContext = function(path) {
  var code = fs.readFileSync(path);
  vm.runInThisContext(code, path);
};

global.importScripts = function(path) {
  includeInThisContext('gen/worker/'+path);
}

function Blob(blob) {
  this.size = blob.length;
  this.length = blob.length;
  this.slice = function(a,b) {
    var data = blob.slice(a,b);
    var b = new Blob(data);
    //console.log(a, b, data.length, data.slice(0,64));
    //console.log(new Error().stack);
    return b;
  }
  this.arrayBuffer = this.asArrayBuffer = function() {
    var buf = new ArrayBuffer(blob.length);
    var arr = new Uint8Array(buf);
    for (var i=0; i<blob.length; i++)
      arr[i] = blob[i].charCodeAt(0);
    return arr;
  }
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
            this.response = new Blob(data).asArrayBuffer();
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

includeInThisContext("gen/worker/workermain.js");

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
