
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

function compile(tool, code, callback, outlen, nlines, nerrors) {
    global.postMessage = function(msg) {
        if (msg.listing.errors && msg.listing.errors.length) {
          console.log(msg.listing.errors);
          assert.equal(nerrors, msg.listing.errors.length, "errors");
        } else {
          assert.equal(nerrors||0, 0, "errors");
          assert.equal(msg.output.length, outlen, "output binary");
          assert.equal(msg.listing.lines.length, nlines, "listing lines");
        }
        callback(null, msg);
    };
    global.onmessage({
        data:{code:code, tool:tool}
    });
}

describe('Worker', function() {
  it('should assemble DASM', function(done) {
    compile('dasm', '\tprocessor 6502\n\torg $f000\nfoo lda #0\n', done, 2, 1);
  });
  it('should compile PLASMA', function(done) {
    compile('plasm', 'word x = 0', done, 5, 0);
  });
  it('should compile CC65', function(done) {
    compile('cc65', '#include <stdio.h>\nint main() {\nint x=1;\nprintf("%d",x);\nreturn x+2;\n}', done, 2947, 4);
  });
  it('should NOT assemble Z80ASM', function(done) {
    compile('z80asm', 'ddwiuweq', done, 0, 0, 1);
  });
  it('should assemble Z80ASM', function(done) {
    compile('z80asm', '\tMODULE test\n\tXREF _puts\n\tld	hl,$0000\n\tret\n', done, 4, 2, 0);
  });
  it('should compile SDCC', function(done) {
    compile('sdcc', 'int main(int argc) {\nint x=1; int y=2;\nreturn x+y+argc;\n}', done, 16, 8, 0);
  });
});
