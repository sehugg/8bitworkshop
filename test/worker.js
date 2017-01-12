
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

global.XMLHttpRequest = function() {
    var txt;
    this.open = function(a,b,c) {
        txt = fs.readFileSync('src/worker/'+b);
        if (this.responseType == 'json') {
            this.response = JSON.parse(txt);
        } else if (this.responseType == 'blob') {
            this.response = txt; //new Uint8Array(txt);
            //console.log(this.response.slice(0,100));
        }
    }
    this.send = function() { }
}

global.FileReaderSync = function() {
  this.readAsArrayBuffer = function(blob) {
    return blob.slice(0);
  }
}

global.onmessage = null;
global.postMessage = null;

includeInThisContext("src/worker/workermain.js");

function compile(tool, code, callback, outlen) {
    global.postMessage = function(msg) {
        //console.log(msg);
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
  /*
  it('should compile CC65', function(done) {
    compile('cc65', '#include <stdio.h>\nint main() {\nint x=1;\nreturn x+2;\n}', done, 5);
  });
  */
});
