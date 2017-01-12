
var assert = require('assert');
var fs = require('fs');
var vm = require('vm');
var worker = {};

var includeInThisContext = function(path) {
    var code = fs.readFileSync(path);
    vm.runInThisContext(code, path);
};

global.importScripts = function(path) {
    includeInThisContext('src/worker/'+path);
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
            var txt = fs.readFileSync('src/worker/'+b);
            this.response = JSON.parse(txt);
        } else if (this.responseType == 'blob') {
            var data = fs.readFileSync('src/worker/'+b, {encoding:'binary'});
            //var buf = new ArrayBuffer(data.length);
            //var blob = new Uint8Array(buf);
            //blob.set(data);
            this.response = new Blob(data);
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

includeInThisContext("src/worker/workermain.js");

function compile(tool, code, callback, outlen) {
    global.postMessage = function(msg) {
        if (msg.listing.errors.length) console.log(msg.listing.errors);
        assert.ok(msg.listing.lines);
        assert.equal(msg.listing.errors.length, msg.listing.errors);
        assert.equal(msg.output.length, outlen);
        callback(null, msg);
    };
    global.onmessage({
        data:{code:code, tool:tool}
    });
}

describe('Worker', function() {
  it('should compile DASM', function(done) {
    compile('dasm', '\tprocessor 6502\n\torg $f000\nfoo lda #0\n', done, 2);
  });
  it('should compile PLASMA', function(done) {
    compile('plasm', 'word x = 0', done, 5);
  });
  it('should compile CC65', function(done) {
    compile('cc65', '#include <stdio.h>\nint main() {\nint x=1;\nprintf("%d",x);\nreturn x+2;\n}', done, 2947);
  });
});
