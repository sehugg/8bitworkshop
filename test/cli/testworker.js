
var assert = require('assert');
var fs = require('fs');
var wtu = require('./workertestutils.js');
//var heapdump = require('heapdump');

// TODO: await might be needed later
global.onmessage({data:{preload:'cc65', platform:'nes'}});
global.onmessage({data:{preload:'ca65', platform:'nes'}});
global.onmessage({data:{preload:'cc65', platform:'apple2'}});
global.onmessage({data:{preload:'ca65', platform:'apple2'}});
global.onmessage({data:{preload:'cc65', platform:'c64'}});
global.onmessage({data:{preload:'ca65', platform:'c64'}});
global.onmessage({data:{preload:'cc65', platform:'atari8'}});
global.onmessage({data:{preload:'ca65', platform:'atari8'}});
global.onmessage({data:{preload:'cc65', platform:'atari2600'}});
global.onmessage({data:{preload:'ca65', platform:'atari2600'}});
global.onmessage({data:{preload:'cc65', platform:'pce'}});
global.onmessage({data:{preload:'ca65', platform:'pce'}});
global.onmessage({data:{preload:'sdcc'}});
global.onmessage({data:{preload:'sdcc', platform:'coleco'}}); // SDCC 3.6.5 (Emscripten) filesystem
global.onmessage({data:{preload:'inform6'}});

// TODO: check msg against spec

function compile(tool, code, platform, callback, outlen, nlines, nerrors, options) {
  var msgs = [{code:code, platform:platform, tool:tool, path:'src.'+tool, mainfile:true}];
  doBuild(msgs, callback, outlen, nlines, nerrors, options);
}

function compileFiles(tool, files, platform, callback, outlen, nlines, nerrors, options) {
  var msg = {updates:[], buildsteps:[]};
  for (var fn of files) {
    var text = ab2str(fs.readFileSync('presets/'+platform+'/'+fn));
    msg.updates.push({path:fn, data:text});
    msg.buildsteps.push({path:fn, platform:platform, tool:tool});
  }
  doBuild([msg], callback, outlen, nlines, nerrors, options);
}

// send an ad-hoc (qid-tagged) query to the worker and await its response
async function queryWorker(msg) {
  return new Promise((resolve) => {
    global.postMessage = function(result) {
      resolve(result);
    };
    global.onmessage({data:msg});
  });
}

async function doBuild(msgs, callback, outlen, nlines, nerrors, options) {
    var msgcount = msgs.length;
    global.postMessage = function(msg) {
      if (!msg.unchanged) {
        if (msg.errors && msg.errors.length) {
          for (var err of msg.errors) {
            console.log(err);
            assert.ok(err.line >= 0);
            if (options && !options.ignoreErrorPath) {
              assert.equal(msgs[0].path, err.path);
            }
            assert.ok(err.msg);
          }
          if (nerrors != msg.errors.length) console.log(msg);
          assert.equal(nerrors, msg.errors.length);
        } else {
          assert.equal(nerrors||0, 0);
          if (msg.output.stmts) { // AST for BASIC
            assert.equal(msg.output.stmts.length, outlen);
          } else {
            assert.equal(msg.output.code?msg.output.code.length:msg.output.length, outlen);
            assert.ok(msg.output.code || msg.output instanceof Uint8Array);
          }
          if (nlines) {
            if (typeof nlines === 'number')
              nlines = [nlines];
            //console.log(msg.listings, nlines);
            var i = 0;
            var lstkeys = Object.keys(msg.listings);
            lstkeys.sort();
            for (var key of lstkeys) {
              var listing = msg.listings[key];
              assert.equal(listing.lines.length, nlines[i++]);
            }
          }
        }
      }
      if (--msgcount == 0) {
        callback(null, msg);
        //heapdump.writeSnapshot();
      } else
        console.log(msgcount + ' msgs left');
    };
    await global.onmessage({data:{reset:true}});
    for (var i=0; i<msgs.length; i++) {
      await global.onmessage({data:msgs[i]});
    } 
}

describe('Worker', function() {
  it('should list shared files in filesystem package', async function() {
    var msg = await queryWorker({preload_fs:'wasi:cc65-fs-nes.zip', listshared:'/share/cc65/include', updates:[], buildsteps:[], qid:123});
    assert.ok(Array.isArray(msg.output));
    assert.ok(msg.output.length > 0);
    assert.ok(msg.output.includes('share/cc65/include/nes.h'));
    assert.equal(msg.qid, 123);
  });
  it('should read a shared header from filesystem package', async function() {
    var msg = await queryWorker({preload_fs:'wasi:cc65-fs-nes.zip', readshared:'/share/cc65/include/nes.h', updates:[], buildsteps:[], qid:124});
    assert.ok(msg.output instanceof Uint8Array);
    assert.ok(msg.output.length > 100);
    assert.equal(msg.qid, 124);
  });
  it('should return null for missing shared file', async function() {
    var msg = await queryWorker({preload_fs:'wasi:cc65-fs-nes.zip', readshared:'/share/cc65/include/nosuchfile.h', updates:[], buildsteps:[], qid:125});
    assert.equal(msg.output, null);
    assert.equal(msg.qid, 125);
  });
  it('should read a platform library header', async function() {
    var msg = await queryWorker({platform:'nes', readlib:'neslib.h', updates:[], buildsteps:[], qid:140});
    assert.ok(msg.output instanceof Uint8Array);
    assert.ok(new TextDecoder().decode(msg.output).includes('ppu_on_all'));
    assert.equal(msg.qid, 140);
    msg = await queryWorker({platform:'gb.color', readlib:'gb/gb.h', updates:[], buildsteps:[], qid:141});
    assert.ok(new TextDecoder().decode(msg.output).includes('wait_vbl_done'));
  });
  it('should return null for a file the platform library does not list', async function() {
    var msg = await queryWorker({platform:'nes', readlib:'neslib2.lib', updates:[], buildsteps:[], qid:142});
    assert.equal(msg.output, null);
    msg = await queryWorker({platform:'nes', readlib:'nosuchfile.h', updates:[], buildsteps:[], qid:143});
    assert.equal(msg.output, null);
  });
  it('should list shared files in WASI filesystem zip', async function() {
    var msg = await queryWorker({preload_fs:'wasi:cc7800-fs.zip', listshared:'/headers', updates:[], buildsteps:[], qid:126});
    assert.ok(Array.isArray(msg.output));
    assert.ok(msg.output.length > 0);
    assert.ok(msg.output.includes('headers/prosystem.h'));
    assert.equal(msg.qid, 126);
  });
  it('should read a shared header from WASI filesystem zip', async function() {
    var msg = await queryWorker({preload_fs:'wasi:cc2600-fs.zip', readshared:'/headers/vcs.h', updates:[], buildsteps:[], qid:127});
    assert.ok(msg.output instanceof Uint8Array);
    assert.ok(msg.output.length > 100);
    assert.equal(msg.qid, 127);
  });
  it('should return null for missing file in WASI filesystem zip', async function() {
    var msg = await queryWorker({preload_fs:'wasi:cc2600-fs.zip', readshared:'/headers/nosuchfile.h', updates:[], buildsteps:[], qid:128});
    assert.equal(msg.output, null);
    assert.equal(msg.qid, 128);
  });
  it('should assemble DASM', function(done) {
    compile('dasm', '\tprocessor 6502\n\torg $f000\n MAC mack\n lda #0\n ENDM\nfoo: mack\n mack\n', 'vcs.mame', done, 4, 4);
  });
  it('should compile batari Basic', function(done) {
    compileFiles('bataribasic', ['bb/helloworld.bas'], 'vcs', done, 4096);
  });
  it('should NOT compile batari Basic (compile error)', function(done) {
    compile('bataribasic', 'foo bar baz\n', 'vcs', done, 0, 0, 1);
  });
  it('should NOT assemble DASM', function(done) {
    compile('dasm', '\tprocessor 6502\n\torg $f000 ; this is a comment\nfoo asl a\n', 'vcs', done, 0, 0, 2);
  });
  it('should compile CC65', function(done) {
    compile('cc65', '#if defined(__8BITWORKSHOP__) && defined(__MAIN__)\nint main() {\nint x=1;\nreturn x+2;\n}\n#endif', 'nes.mame', done, 40976, 3);
  });
  it('should compile CC65 with a warning (warnings are not errors)', function(done) {
    compile('cc65', '#if defined(__8BITWORKSHOP__) && defined(__MAIN__)\nint main() {\nconst const int x=1;\nreturn x+2;\n}\n#endif', 'nes.mame', done, 40976, 3, 0);
  });
  it('should NOT compile CC65 (compile error)', function(done) {
    compile('cc65', 'int main() {\nint x=1;\nprintf("%d",x);\nreturn x+2;\n}', 'nes', done, 0, 0, 1);
  });
  it('should NOT compile CC65 (link error)', function(done) {
    compile('cc65', 'extern void bad();\nint main() {\nbad();\nreturn 0;\n}', 'nes', done, 0, 0, 1, {ignoreErrorPath:true});
  });
  it('should NOT compile CC65 (preproc error)', function(done) {
    compile('cc65', '#include "NOSUCH.file"\n', 'nes', done, 0, 0, 1, {ignoreErrorPath:true});
  });
  it('should assemble SDASZ80', function(done) {
    compile('sdasz80', '\tld	hl,#0\n\tret\n', 'mw8080bw', done, 8192, 2);
  });
  it('should NOT assemble SDASZ80', function(done) {
    compile('sdasz80', '\txxx hl,#0\n\tret\n', 'mw8080bw', done, 0, 0, 1);
  });
  it('should NOT link SDASZ80', function(done) {
    compile('sdasz80', '\tcall divxxx\n', 'mw8080bw', done, 0, 0, 1, {ignoreErrorPath:true});
  });
  // 3.6.5 marks fewer source lines than 4.x (3 here, vs 4)
  const SDCC_TEST_SRC = 'int foo=0; // comment\n#if defined(__8BITWORKSHOP__) && defined(__MAIN__)\nint main(int argc) {\nint x=1;\nint y=2+argc;\nreturn x+y+argc;\n}\n#endif\n';
  const SDCC_DEFAULT = +/SDCC_DEFAULT_VERSION[^=]*= *(\d)/.exec(fs.readFileSync('src/common/toolmeta.ts', 'utf8'))[1];
  const sdccLines = (n3, n4) => SDCC_DEFAULT == 4 ? n4 : n3; // listing line counts differ by version
  it('should compile SDCC with the default version', function(done) {
    compile('sdcc', SDCC_TEST_SRC, 'mw8080bw', done, 8192, sdccLines(3, 4), 0);
  });
  it('should compile SDCC 3 with //#tooldef c sdcc=3', function(done) {
    compile('sdcc', '//#tooldef c sdcc=3\n' + SDCC_TEST_SRC, 'mw8080bw', done, 8192, 3, 0);
  });
  it('should compile SDCC 4 with //#tooldef c sdcc=4', function(done) {
    compile('sdcc', '//#tooldef c sdcc=4\n' + SDCC_TEST_SRC, 'mw8080bw', done, 8192, 4, 0);
  });
  it('should pass --max-allocs-per-node unless #pragma opt_code', async function() {
    for (const platform of ['mw8080bw', 'gb']) {
      for (const ver of platform == 'gb' ? [3] : [3, 4]) {
        for (const pragma of ['', '#pragma opt_code_speed\n']) {
          var result;
          global.postMessage = (msg) => { result = msg; };
          await global.onmessage({data:{reset:true}});
          const logs = []; const ol = console.log; console.log = (...a) => logs.push(a.join(' '));
          try {
            await global.onmessage({data:{code:'//#tooldef c sdcc=' + ver + '\n' + pragma + 'void main() {\n}\n',
              platform:platform, tool:'sdcc', path:'src.sdcc', mainfile:true}});
          } finally { console.log = ol; }
          const what = [platform, 'sdcc', ver, JSON.stringify(pragma)].join(' ');
          // the test worker has no gb filesystem package, so only the compile command is checked there
          if (platform != 'gb') assert.ok(!result.errors || !result.errors.length, what + ': ' + JSON.stringify(result.errors));
          const cmd = logs.find(l => /^exec sdcc --vc/.test(l)) || '';
          assert.equal(/--no-peep --nolospre --max-allocs-per-node 500/.test(cmd), !pragma, what + ': ' + cmd);
        }
      }
    }
  });
  it('should NOT compile SDCC 4 for a 3.x-library platform', function(done) {
    compile('sdcc', '//#tooldef c sdcc=4\nvoid main() {\n}\n', 'coleco', done, 0, 0, 1, {ignoreErrorPath:true});
  });
  it('should compile SDCC w/ include', function(done) {
    compile('sdcc', '#include <string.h>\nvoid main() {\nstrlen(0);\n}\n', 'mw8080bw', done, 8192, sdccLines(2, 3), 0);
  });
  it('should compile SDCC 4 mos6502 and run it on devel-6502', function(done) {
    var {Devel6502} = require('../../gen/machine/devel.js');
    var csource = ab2str(fs.readFileSync('presets/devel-6502/hello-sdcc.c'));
    compile('sdcc', csource, 'devel-6502', function(err, msg) {
      var rom = msg.output;
      assert.equal(rom[0x7ffa] | rom[0x7ffb] << 8, 0x8000); // vectors -> crt0
      assert.ok(msg.symbolmap._main >= 0x8000);
      assert.equal(msg.symbolmap._counter, 0x200);
      var out = '';
      var m = new Devel6502();
      m.connectSerialIO({byteAvailable:()=>false, recvByte:()=>0, clearToSend:()=>true,
        sendByte:(b)=>{ out += String.fromCharCode(b); }, advance(){}, reset(){}});
      m.loadROM(rom);
      m.reset();
      for (var i=0; i<10 && !m.isHalted(); i++) m.advanceFrame(()=>false);
      assert.ok(m.isHalted());
      // the initialized global (counter = 3) was copied to RAM by crt0
      assert.equal(out, 'Hello, SDCC 6502!\nagain\nagain\nagain\n');
      done();
    }, 32768, 0, 0);
  });
  it('should link SDCC mos6502 as a DOS 3.3 binary on apple2', function(done) {
    var csource = ab2str(fs.readFileSync('presets/apple2/hello-sdcc.c'));
    compile('sdcc', csource, 'apple2', function(err, msg) {
      var bin = msg.output;
      assert.equal(bin[0] | bin[1] << 8, 0x803);            // load address
      assert.equal(bin[2] | bin[3] << 8, bin.length - 4);   // length: what the loader checks
      assert.ok(bin.length < 1024);                          // trimmed to the program
      done();
    }, 377, 0, 0);
  });
  it('should link SDCC mos6502 as a PRG with a BASIC stub on c64', function(done) {
    var csource = ab2str(fs.readFileSync('presets/c64/hello-sdcc.c'));
    compile('sdcc', csource, 'c64', function(err, msg) {
      var bin = msg.output;
      assert.deepEqual(Array.from(bin.slice(0, 12)), [1,8, 0x0b,8, 10,0, 0x9e, 0x32,0x30,0x36,0x31, 0]); // 10 SYS 2061
      assert.ok(bin.length < 1024);                          // trimmed to the program
      done();
    }, 332, 0, 0);
  });
  it('should compile oscar64 and return listings/symbols/segments', async function() {
    var msgs = [{code:'#include <stdio.h>\nint main() { printf("FOO"); return 0; }', platform:'c64', tool:'oscar64', path:'main.c', mainfile:true}];
    var result = await new Promise(function(resolve, reject) {
      global.postMessage = function(msg) {
        if (!msg.unchanged) {
          assert.ok(!msg.errors || msg.errors.length === 0, JSON.stringify(msg.errors));
          resolve(msg);
        }
      };
      (async function() {
        await global.onmessage({data:{reset:true}});
        await global.onmessage({data:msgs[0]});
      })().catch(reject);
    });
    assert.ok(result.listings && Object.keys(result.listings).length > 0, 'no listings');
    var lst = result.listings[Object.keys(result.listings)[0]];
    assert.ok(lst.lines.length > 0, 'no source lines');
    assert.ok(lst.asmlines.length > 0, 'no asm lines');
    assert.ok(result.symbolmap && result.symbolmap['main'] > 0, 'no main symbol');
    assert.ok(result.segments && result.segments.length > 0, 'no segments');
  });

  it('should compile oscar64 for atari8 into an XEX image', async function() {
    var msgs = [{code:'#include <stdio.h>\n#include <conio.h>\nint main() { clrscr(); printf("FOO"); return 0; }', platform:'atari8-800', tool:'oscar64', path:'main.c', mainfile:true}];
    var result = await new Promise(function(resolve, reject) {
      global.postMessage = function(msg) {
        if (!msg.unchanged) {
          assert.ok(!msg.errors || msg.errors.length === 0, JSON.stringify(msg.errors));
          resolve(msg);
        }
      };
      (async function() {
        await global.onmessage({data:{reset:true}});
        await global.onmessage({data:msgs[0]});
      })().catch(reject);
    });
    // the atari target writes a binary-load file: 0xFFFF header, then a segment at 0x2000
    var out = result.output;
    assert.ok(out.length > 6, 'output too small: ' + out.length);
    assert.equal(out[0], 0xff, 'missing XEX header');
    assert.equal(out[1], 0xff, 'missing XEX header');
    assert.equal(out[2], 0x00, 'unexpected XEX load address lo');
    assert.equal(out[3], 0x20, 'unexpected XEX load address hi');
  });

  it('should compile oscar64 for nes into an iNES image', async function() {
    var src = '#include <nes/neslib.h>\n' +
      '#pragma section( tiles, 0 )\n' +
      '#pragma region( tbank, 0x0000, 0x2000, , 0, { tiles } )\n' +
      '#pragma data(tiles)\n' +
      '__export char tiles[16] = { 0 };\n' +
      '#pragma data(data)\n' +
      'void nes_game(void) { ppu_on_all(); while (1) ; }\n';
    var msgs = [{code:src, platform:'nes', tool:'oscar64', path:'main.c', mainfile:true}];
    var result = await new Promise(function(resolve, reject) {
      global.postMessage = function(msg) {
        if (!msg.unchanged) {
          assert.ok(!msg.errors || msg.errors.length === 0, JSON.stringify(msg.errors));
          resolve(msg);
        }
      };
      (async function() {
        await global.onmessage({data:{reset:true}});
        await global.onmessage({data:msgs[0]});
      })().catch(reject);
    });
    // iNES header: 'N', 'E', 'S', 0x1a, then 2 PRG banks and 1 CHR bank
    var out = result.output;
    assert.ok(out.length === 16 + 0x8000 + 0x2000, 'unexpected size: ' + out.length);
    assert.equal(out[0], 0x4e, 'missing iNES header');
    assert.equal(out[1], 0x45, 'missing iNES header');
    assert.equal(out[2], 0x53, 'missing iNES header');
    assert.equal(out[3], 0x1a, 'missing iNES header');
    assert.equal(out[4], 0x02, 'unexpected PRG bank count');
    assert.equal(out[5], 0x01, 'unexpected CHR bank count');
    // NES listings are banked ("00:8000 : ..."); the parser must still map
    // C source lines to their 16-bit offsets so the editor shows hex addresses
    var keys = Object.keys(result.listings || {});
    assert.ok(keys.length > 0, 'no listings');
    var lst = result.listings[keys[0]];
    assert.ok(lst.lines.length > 0, 'no source lines');
    assert.ok(lst.lines[0].offset >= 0x8000, 'source line missing NES offset: ' + lst.lines[0].offset);
    assert.ok(result.symbolmap && result.symbolmap['nes_game'] >= 0x8000, 'no nes_game symbol');
  });

  it('should compile mw8080 skeleton', function(done) {
    var csource = ab2str(fs.readFileSync('presets/mw8080bw/skeleton.sdcc'));
    compile('sdcc', csource, 'mw8080bw', done, 8192, sdccLines(84, 97), 0);
  });
  it('should compile galaxian skeleton', function(done) {
    var csource = ab2str(fs.readFileSync('presets/galaxian-scramble/skeleton.sdcc'));
    compile('sdcc', csource, 'galaxian-scramble', done, 20512, sdccLines(28, 36), 0);
  });
  it('should compile vector skeleton', function(done) {
    var csource = ab2str(fs.readFileSync('presets/vector-z80color/skeleton.sdcc'));
    compile('sdcc', csource, 'vector-z80color', done, 32768, sdccLines(23, 26), 0);
  });
  it('should compile williams skeleton', function(done) {
    var csource = ab2str(fs.readFileSync('presets/williams-z80/skeleton.sdcc'));
    compile('sdcc', csource, 'williams-z80', done, 38912, sdccLines(40, 43), 0);
  });
  it('should compile williams_sound skeleton', function(done) {
    var csource = ab2str(fs.readFileSync('presets/sound_williams-z80/skeleton.sdcc'));
    compile('sdcc', csource, 'sound_williams-z80', done, 16384, sdccLines(6, 7), 0);
  });
  it('should compile coleco skeleton', function(done) {
    var csource = ab2str(fs.readFileSync('presets/coleco/cursorsmooth.c'));
    compile('sdcc', csource, 'coleco', done, 32768, 59, 0);
  });
  it('should compile sg1000 skeleton', function(done) {
    var csource = ab2str(fs.readFileSync('presets/sms-sg1000-libcv/cursorsmooth.c'));
    compile('sdcc', csource, 'sms-sg1000-libcv', done, 49152, 80, 0);
  });
  it('should NOT preprocess SDCC', function(done) {
    compile('sdcc', 'int x=0\n#bah\n', 'mw8080bw', done, 0, 0, 1);
  });
  it('should compile XASM6809', function(done) {
    compile('xasm6809', '\tasld\n\tasld\n', 'williams', done, 4, 2, 0);
  });
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
            {"path":"main.c", "platform":"nes", "tool":"cc65"},
            {"path":"fn.c", "platform":"nes", "tool":"cc65"}
        ]
    };
    var m2 = {
        "updates":[
            {"path":"main.c", "data":"extern int mul2(int x); \nint main() { return mul2(2); }\n"}
        ],
        "buildsteps":[
            {"path":"main.c", "platform":"nes", "tool":"cc65"},
            {"path":"fn.c", "platform":"nes", "tool":"cc65"}
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
  it('should rebuild unchanged files when //#tooldef c sdcc changes', async function() {
    var build = (main) => ({
        "updates":[
            {"path":"main.c", "data":main + "extern int mul2(int x);\nint main() { return mul2(2); }\n"},
            {"path":"fn.c", "data":"int mul2(int x) { return x*x; }\n"}
        ],
        "buildsteps":[
            {"path":"main.c", "platform":"mw8080bw", "tool":"sdcc"},
            {"path":"fn.c", "platform":"mw8080bw", "tool":"sdcc"}
        ]
    });
    // fn.c has no directive, and doesn't change: its asm banner shows which SDCC built it
    var fnVersion = async (main) => {
      var result;
      global.postMessage = (msg) => { result = msg; };
      await global.onmessage({data:build(main)});
      assert.ok(!result.errors || !result.errors.length, JSON.stringify(result.errors));
      return /; Version (\d+)\./.exec(result.listings['fn.lst'].text)[1];
    };
    await global.onmessage({data:{reset:true}});
    assert.equal(await fnVersion("//#tooldef c sdcc=4\n"), '4');
    assert.equal(await fnVersion("//#tooldef c sdcc=3\n"), '3');
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
        ],
        "path":"fn.c"
    };
    var msgs = [m];
    doBuild(msgs, done, 8192, [1,1], 2); // TODO: check error file
  });
  it('should compile vicdual skeleton', function(done) {
    var files = ['skeleton.sdcc', 'cp437.c'];
    compileFiles('sdcc', files, 'vicdual', done, 16416, [0, sdccLines(45, 55)], 0); // TODO?
  });
  it('should compile apple2 skeleton with CC65', function(done) {
    var csource = ab2str(fs.readFileSync('presets/apple2/skeleton.cc65'));
    compile('cc65', csource, 'apple2', done, 3382, 4, 0);
  });
  // TODO: test if compile, errors, then compile same file
  it('should compile CC65 banked', function(done) {
    compile('cc65', '#define NES_MAPPER 4\nint main() {\nint x=1;\nreturn x+2;\n}', 'nes', done, 131088, 3);
  });
  // the plain (unbanked) nes config -- the NES_MAPPER 4 of the build above no
  // longer follows one build into the next
  it('should assemble CA65', function(done) {
    compile('ca65', ';#define LIBARGS ,\n\t.segment "HEADER"\n\t.segment "STARTUP"\n\t.segment "CHARS"\n\t.segment "VECTORS"\n\t.segment "SAMPLES"\n\t.segment "CODE"\n.ifdef __MAIN__\n\tlda #0\n\tsta $1\n.endif\n', 'nes', done, 40976, 2);
  });
  it('should compile C64 cc65 skeleton', function(done) {
    var csource = ab2str(fs.readFileSync('presets/c64/skeleton.cc65'));
    csource = csource.replace('#include "','//');
    compile('cc65', csource, 'c64.wasm', done, 3026, 3, 0);
  });
  it('should compile zmachine inform6 skeleton', function(done) {
    var csource = ab2str(fs.readFileSync('presets/zmachine/skeleton.inform6'));
    compile('inform6', csource, 'hello.z5', done, 92672, 0, 0);
  });
  // TODO: vectrex, x86
  it('should compile basic example', function(done) {
    var csource = ab2str(fs.readFileSync('presets/basic/wumpus.bas'));
    var msgs = [{code:csource, platform:"basic", tool:"basic", path:'wumpus.bas'}];
    var done2 = function(err, msg) {
      var ast = msg.output;
      assert.ok(ast);
      done(err, msg);
    };
    doBuild(msgs, done2, 205, 0, 0);
  });
  it('should compile CC65 flags', function(done) {
    compile('cc65', '#define CC65_FLAGS -Or,-g,-j\nint main() {\nint x=1;\nreturn x+2;\n}', 'apple2', done, 489, 2);
  });
  /*
  it('should compile gameboy', function(done) {
    compile('sdcc', '//#link "gb/sfr.sgb"\n//#link "gb/crt0.sgb"\nvoid main(void){}\n', 'gb', done, 416+58, 3);
  });
  it('should compile ACME', function(done) {
    compile('acme', 'nop', 'c64', done, 416, 3);
  });
  it('should compile CMOC', function(done) {
    compile('cmoc', 'int foo=0; // comment\n#if defined(__8BITWORKSHOP__) && defined(__MAIN__)\nint main(int argc) {\nint x=1;\nint y=2+argc;\nreturn x+y+argc;\n}\n#endif\n', 'williams', done, 8192, 3, 0, {filename:'test.c'});
  });
  */

});
