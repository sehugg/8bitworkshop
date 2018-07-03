
var assert = require('assert');
var fs = require('fs');
var wtu = require('./workertestutils.js');

global.onmessage({data:{preload:'cc65', platform:'nes'}});
global.onmessage({data:{preload:'ca65', platform:'nes'}});
global.onmessage({data:{preload:'sdcc'}});

// TODO: check msg against spec

function compile(tool, code, platform, callback, outlen, nlines, nerrors) {
  var msgs = [{code:code, platform:platform, tool:tool, path:'src.'+tool}];
  doBuild(msgs, callback, outlen, nlines, nerrors);
}

function compileFiles(tool, files, platform, callback, outlen, nlines, nerrors) {
  var msg = {updates:[], buildsteps:[]};
  for (var fn of files) {
    var text = ab2str(fs.readFileSync('presets/'+platform+'/'+fn));
    msg.updates.push({path:fn, data:text});
    msg.buildsteps.push({path:fn, platform:platform, tool:tool});
  }
  doBuild([msg], callback, outlen, nlines, nerrors);
}



function doBuild(msgs, callback, outlen, nlines, nerrors) {
    var msgcount = msgs.length;
    global.postMessage = function(msg) {
      if (!msg.unchanged) {
        if (msg.errors && msg.errors.length) {
          console.log(msg.errors);
          assert.equal(nerrors, msg.errors.length, "errors");
        } else {
          assert.equal(nerrors||0, 0, "errors");
          assert.equal(msg.output.code?msg.output.code.length:msg.output.length, outlen, "output binary");
          if (nlines) {
            if (typeof nlines === 'number')
              nlines = [nlines];
            //console.log(msg.listings, nlines);
            var i = 0;
            var lstkeys = Object.keys(msg.listings);
            lstkeys.sort();
            for (var key of lstkeys) {
              var listing = msg.listings[key];
              assert.equal(listing.lines.length, nlines[i++], "listing lines");
            }
          }
        }
      }
      if (--msgcount == 0)
        callback(null, msg);
      else
        console.log(msgcount + ' msgs left');
    };
    global.onmessage({data:{reset:true}});
    for (var i=0; i<msgs.length; i++) {
      global.onmessage({data:msgs[i]});
    } 
}

describe('Worker', function() {
  it('should assemble DASM', function(done) {
    compile('dasm', '\tprocessor 6502\n\torg $f000\nfoo lda #0\n', 'vcs', done, 2, 1);
  });
  it('should NOT assemble DASM', function(done) {
    compile('dasm', '\tprocessor 6502\n\torg $f000\nfoo xxx #0\n', 'vcs', done, 0, 0, 1);
  });
  /*
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
  */
  it('should compile CC65', function(done) {
    compile('cc65', 'int main() {\nint x=1;\nreturn x+2;\n}', 'nes-conio', done, 40976, 3);
  });
  it('should NOT compile CC65 (compile error)', function(done) {
    compile('cc65', 'int main() {\nint x=1;\nprintf("%d",x);\nreturn x+2;\n}', 'nes-conio', done, 0, 0, 1);
  });
  it('should NOT compile CC65 (link error)', function(done) {
    compile('cc65', 'extern void bad();\nint main() {\nbad();\nreturn 0;\n}', 'nes-conio', done, 0, 0, 1);
  });
  it('should assemble CA65', function(done) {
    compile('ca65', '\t.segment "HEADER"\n\t.segment "STARTUP"\n\t.segment "CHARS"\n\t.segment "VECTORS"\n\tlda #0\n\tsta $1\n', 'nes-conio', done, 40976, 2);
  });
  /*
  it('should assemble Z80ASM', function(done) {
    compile('z80asm', '\tMODULE test\n\tEXTERN _puts\n\tld	hl,$0000\n\tret\n', 'mw8080bw', done, 4, 2, 0);
  });
  it('should NOT assemble Z80ASM', function(done) {
    compile('z80asm', 'ddwiuweq', 'mw8080bw', done, 0, 0, 1);
  });
  */
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
  /*
  it('should compile vicdual skeleton', function(done) {
    var csource = ab2str(fs.readFileSync('presets/vicdual/skeleton.sdcc'));
    compile('sdcc', csource, 'vicdual', done, 16416, 45, 0);
  });
  */
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
    compile('verilator', csource, 'verilog', done, 2782, 0, 0);
  });
  it('should compile verilog inline assembler (JSASM)', function(done) {
    var csource = ab2str(fs.readFileSync('presets/verilog/test2.asm'));
    var dependfiles = ["hvsync_generator.v", "font_cp437_8x8.v", "ram.v", "tile_renderer.v", "sprite_scanline_renderer.v", "lfsr.v", "sound_generator.v", "cpu16.v", "cpu_platform.v"];
    var depends = [];
    for (var dfile of dependfiles) {
      var code = ab2str(fs.readFileSync('presets/verilog/' + dfile));
      depends.push({filename:dfile, data:code, prefix:"verilog"});
    }
    var msgs = [{code:csource, platform:"verilog", tool:"jsasm", dependencies:depends}];
    var done2 = function(err, msg) {
      var jscode = msg.output.code;
      var fn = new Function(jscode);
      assert.ok(fn);
      done(err, msg);
    };
    doBuild(msgs, done2, 253177, 0, 0);
  });
  it('should NOT preprocess SDCC', function(done) {
    compile('sdcc', 'int x=0\n#bah\n', 'mw8080bw', done, 0, 0, 1);
  });
  /*
  it('should compile XASM6809', function(done) {
    compile('xasm6809', '\tasld\n\tasld\n', 'mw8080bw', done, 4, 2, 0);
  });
  */
  it('should link two files with SDCC', function(done) {
    var msgs = [
    {
        "updates":[
            {"path":"main.c", "data":"extern int mul2(int x);\nint main() { return mul2(2); }\n"},
            {"path":"fn.c", "data":"int mul2(int x) { return x*x; }\n"}
        ],
        "buildsteps":[
            {"path":"main.c", "platform":"mw8080bw", "tool":"sdcc"},
            {"path":"fn.c", "platform":"mw8080bw", "tool":"sdcc"}
        ]
    }
    ];
    doBuild(msgs, done, 8192, [1,1], 0);
  });
  // TODO: tests don't fail if too many compile steps
  it('should not build unchanged files with CC65', function(done) {
    var m = {
        "updates":[
            {"path":"main.c", "data":"extern int mul2(int x);\n int main() { return mul2(2); }\n"},
            {"path":"fn.c", "data":"int mul2(int x) { return x*x; }\n"}
        ],
        "buildsteps":[
            {"path":"main.c", "platform":"nes-conio", "tool":"cc65"},
            {"path":"fn.c", "platform":"nes-conio", "tool":"cc65"}
        ]
    };
    var m2 = {
        "updates":[
            {"path":"main.c", "data":"extern int mul2(int x); \nint main() { return mul2(2); }\n"}
        ],
        "buildsteps":[
            {"path":"main.c", "platform":"nes-conio", "tool":"cc65"},
            {"path":"fn.c", "platform":"nes-conio", "tool":"cc65"}
        ]
    };
    var msgs = [m, m, m2];
    doBuild(msgs, done, 40976, [1,1], 0);
  });
  it('should not build unchanged files with SDCC', function(done) {
    var m = {
        "updates":[
            {"path":"main.c", "data":"extern int mul2(int x);\n int main() { return mul2(2); }\n"},
            {"path":"fn.c", "data":"int mul2(int x) { return x*x; }\n"}
        ],
        "buildsteps":[
            {"path":"main.c", "platform":"mw8080bw", "tool":"sdcc"},
            {"path":"fn.c", "platform":"mw8080bw", "tool":"sdcc"}
        ]
    };
    var m2 = {
        "updates":[
            {"path":"main.c", "data":"extern int mul2(int x); \nint main() { return mul2(2); }\n"}
        ],
        "buildsteps":[
            {"path":"main.c", "platform":"mw8080bw", "tool":"sdcc"},
            {"path":"fn.c", "platform":"mw8080bw", "tool":"sdcc"}
        ]
    };
    var msgs = [m, m, m2];
    doBuild(msgs, done, 8192, [1,1], 0);
  });
  it('should include filename in compile errors', function(done) {
    var m = {
        "updates":[
            {"path":"main.c", "data":"extern int mul2(int x);\n int main() { return mul2(2); }\n"},
            {"path":"fn.c", "data":"void int mul2(int x) { return x*x; }\n"}
        ],
        "buildsteps":[
            {"path":"main.c", "platform":"mw8080bw", "tool":"sdcc"},
            {"path":"fn.c", "platform":"mw8080bw", "tool":"sdcc"}
        ]
    };
    var msgs = [m];
    doBuild(msgs, function(err, result) {
      for (var msg of result.errors)
        assert.equal(msg.path, "fn.c");
      done();
    }, 8192, [1,1], 2); // TODO: check error file
  });
  it('should compile vicdual skeleton', function(done) {
    var files = ['skeleton.sdcc', 'cp437.c'];
    compileFiles('sdcc', files, 'vicdual', done, 16416, [0,45], 0); // TODO?
  });
  // TODO: test if compile, errors, then compile same file

});
