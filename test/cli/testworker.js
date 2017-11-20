
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

global.onmessage({data:{preload:'cc65'}});
global.onmessage({data:{preload:'sdcc'}});

//

function compile(tool, code, platform, callback, outlen, nlines, nerrors) {
    global.postMessage = function(msg) {
        if (msg.errors && msg.errors.length) {
          console.log(msg.errors);
          assert.equal(nerrors, msg.errors.length, "errors");
        } else {
          assert.equal(nerrors||0, 0, "errors");
          assert.equal(msg.output.code?msg.output.code.length:msg.output.length, outlen, "output binary");
          assert.equal(msg.lines.length, nlines, "listing lines");
        }
        callback(null, msg);
    };
    global.onmessage({
        data:{code:code, platform:platform, tool:tool}
    });
}

function ab2str(buf) {
  return String.fromCharCode.apply(null, new Uint16Array(buf));
}

describe('Worker', function() {
  it('should assemble DASM', function(done) {
    compile('dasm', '\tprocessor 6502\n\torg $f000\nfoo lda #0\n', 'vcs', done, 2, 1);
  });
  it('should NOT assemble DASM', function(done) {
    compile('dasm', '\tprocessor 6502\n\torg $f000\nfoo xxx #0\n', 'vcs', done, 0, 0, 1);
  });
  it('should assemble ACME', function(done) {
    compile('acme', 'foo: lda #0\n', 'vcs', done, 2, 0); // TODO
  });
  it('should NOT assemble ACME', function(done) {
    compile('acme', 'foo: xxx #0\n', 'vcs', done, 0, 0, 2); // TODO
  });
  it('should compile PLASMA', function(done) {
    compile('plasm', 'word x = 0', 'apple2', done, 5, 0);
  });
  it('should NOT compile PLASMA', function(done) {
    compile('plasm', 'word x = ', 'apple2', done, 0, 0, 1);
  });
  it('should compile CC65', function(done) {
    compile('cc65', 'int main() {\nint x=1;\nreturn x+2;\n}', 'nes-conio', done, 40976, 3);
  });
  it('should NOT compile CC65', function(done) {
    compile('cc65', 'int main() {\nint x=1;\nprintf("%d",x);\nreturn x+2;\n}', 'nes-conio', done, 0, 0, 1);
  });
  it('should assemble Z80ASM', function(done) {
    compile('z80asm', '\tMODULE test\n\tXREF _puts\n\tld	hl,$0000\n\tret\n', 'mw8080bw', done, 4, 2, 0);
  });
  it('should NOT assemble Z80ASM', function(done) {
    compile('z80asm', 'ddwiuweq', 'none', done, 0, 0, 1);
  });
  it('should assemble SDASZ80', function(done) {
    compile('sdasz80', '\tld	hl,#0\n\tret\n', 'mw8080bw', done, 8192, 2);
  });
  it('should NOT assemble SDASZ80', function(done) {
    compile('sdasz80', '\txxx hl,#0\n\tret\n', 'mw8080bw', done, 0, 0, 1);
  });
  it('should NOT assemble SDASZ80', function(done) {
    compile('sdasz80', '\tcall divxxx\n', 'mw8080bw', done, 0, 0, 1);
  });
  it('should compile SDCC', function(done) {
    compile('sdcc', 'int foo=0; // comment\nint main(int argc) {\nint x=1;\nint y=2+argc;\nreturn x+y+argc;\n}\n', 'mw8080bw', done, 8192, 3, 0);
  });
  it('should compile SDCC w/ include', function(done) {
    compile('sdcc', '#include <string.h>\nvoid main() {\nstrlen(0);\n}\n', 'mw8080bw', done, 8192, 2, 0);
  });
  it('should compile vicdual skeleton', function(done) {
    var csource = ab2str(fs.readFileSync('presets/vicdual/skeleton.sdcc'));
    compile('sdcc', csource, 'vicdual', done, 16416, 45, 0);
  });
  it('should compile mw8080 skeleton', function(done) {
    var csource = ab2str(fs.readFileSync('presets/mw8080bw/skeleton.sdcc'));
    compile('sdcc', csource, 'mw8080bw', done, 8192, 84, 0);
  });
  it('should compile galaxian skeleton', function(done) {
    var csource = ab2str(fs.readFileSync('presets/galaxian-scramble/skeleton.sdcc'));
    compile('sdcc', csource, 'galaxian-scramble', done, 20512, 29, 0);
  });
  it('should compile vector skeleton', function(done) {
    var csource = ab2str(fs.readFileSync('presets/vector-z80color/skeleton.sdcc'));
    compile('sdcc', csource, 'vector-z80color', done, 32768, 23, 0);
  });
  it('should compile williams skeleton', function(done) {
    var csource = ab2str(fs.readFileSync('presets/williams-z80/skeleton.sdcc'));
    compile('sdcc', csource, 'williams-z80', done, 38912, 38, 0);
  });
  it('should compile williams_sound skeleton', function(done) {
    var csource = ab2str(fs.readFileSync('presets/sound_williams-z80/skeleton.sdcc'));
    compile('sdcc', csource, 'sound_williams-z80', done, 16384, 6, 0);
  });
  it('should compile coleco skeleton', function(done) {
    var csource = ab2str(fs.readFileSync('presets/coleco/skeleton.sdcc'));
    compile('sdcc', csource, 'coleco', done, 32768, 31, 0);
  });
  it('should compile verilog example', function(done) {
    var csource = ab2str(fs.readFileSync('presets/verilog/lfsr.v'));
    compile('verilator', csource, 'verilog', done, 3731, 0, 0);
  });
  it('should NOT compile SDCC', function(done) {
    compile('sdcc', 'foobar', 'mw8080bw', done, 0, 0, 1);
  });
  it('should NOT preprocess SDCC', function(done) {
    compile('sdcc', 'int x=0\n#bah\n', 'mw8080bw', done, 0, 0, 1);
  });
  it('should compile XASM6809', function(done) {
    compile('xasm6809', '\tasld\n\tasld\n', 'mw8080bw', done, 4, 2, 0);
  });
});
