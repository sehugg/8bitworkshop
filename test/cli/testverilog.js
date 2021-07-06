
var assert = require('assert');
var _fs = require('fs');
var _path = require('path')
var _cproc = require('child_process');
var fs = require('fs');
var wtu = require('./workertestutils.js');

createTestDOM();

var emu = require('gen/common/emu.js');
var verilog = require('gen/platform/verilog.js');
var VerilogPlatform = emu.PLATFORMS['verilog'];

Object.assign(global, verilog); // copy global VL_* properties

// TODO: must define $

async function loadPlatform(msg) {
  var platform = new VerilogPlatform();
  platform.resume = function() { }; // prevent resume after reset
  try {
    //console.log(msg.output.ports);
    //console.log(msg.output.signals);
    await platform.loadROM("ROM", msg.output);
    await platform.loadROM("ROM", msg.output);
    for (var i=0; i<100000 && !platform.isBlocked(); i++) {
      platform.tick();
    }
    console.log(i, platform.isBlocked(), platform.isStopped());
    //assert.ok(platform.isBlocked());
    assert.ok(!platform.isStopped());
    var state = platform.saveState();
    platform.reset();
    platform.loadState(state);
    assert.deepEqual(state, platform.saveState());
  } catch (e) {
    //platform.printErrorCodeContext(e, msg.output.code);
    //console.log(msg.intermediate.listing);
    //console.log(msg.output.code);
    console.log(e);
    throw e;
  }
  return platform;
}

function testPerf(msg) {
  var platform = new VerilogPlatform();
  platform.loadROM("ROM", msg.output);
  var niters = 5000000;

  console.time("before");
  for (var i=0; i<niters && !platform.isBlocked(); i++)
    platform.tick();
  console.timeEnd("before");

  var state = platform.saveState();
  platform.reset();
  platform.loadState(state);
  console.time("after");
  for (var i=0; i<niters && !platform.isBlocked(); i++)
    platform.tick();
  console.timeEnd("after");

  return platform;
}

function compileVerilator(filename, code, callback, nerrors, depends) {
    global.postMessage = async function(msg) {
      try {
        if (msg.errors && msg.errors.length) {
          console.log(msg.errors);
          assert.equal(nerrors||0, msg.errors.length, "errors");
        } else {
          assert.equal(nerrors||0, 0, "errors");
          var platform = await loadPlatform(msg);
          //testPerf(msg);
          if (filename.indexOf('t_') >= 0) {
            //assert.ok(platform.isBlocked() && !platform.isStopped());
          }
          platform.dispose();
        }
        callback(null, msg);
      } catch (e) {
        if (e.msg && e.msg.indexOf('WebAssembly.Memory()') >= 0) {
          process.exit(1);
        } else {
          //fs.unlinkSync(filename);
          callback(e, null);
        }
      }
    };
    try {
      global.onmessage({
          data:{
            updates:[{path:_path.basename(filename), data:code}],
            buildsteps:[{path:_path.basename(filename), platform:'verilog', tool:'verilator', files:depends}]
          }
      });
    } catch (e) {
      if (e.msg && e.msg.indexOf('WebAssembly.Memory()') >= 0) {
        process.exit(1);
      } else {
        //fs.unlinkSync(filename);
        callback(e, null);
      }
    }
}

function testIcarus(filename) {
  _cproc.execSync('iverilog -I./presets/verilog ./' + filename);
}

function testVerilator(filename, disables, nerrors, depends) {
  it('should translate '+filename, function(done) {
    console.log(filename);
    //if (depends) testIcarus(filename);
    var csource = ab2str(fs.readFileSync(filename));
    for (var i=0; i<(disables||[]).length; i++)
      csource = "/* verilator lint_off " + disables[i] + " */\n" + csource;
    compileVerilator(filename, csource, done, nerrors||0, depends);
  });
}

describe('Verilog Worker', function() {
  
  var files = _fs.readdirSync('test/cli/verilog').filter(fn => fn.endsWith('.v'));
  files = files.slice(0,80);
  for (var fn of files) {
    testVerilator('test/cli/verilog/' + fn, 
      ['UNDRIVEN','BLKSEQ','WIDTH','PINCONNECTEMPTY','SYNCASYNCNET','UNOPT','UNOPTFLAT','VARHIDDEN','EOFNEWLINE']
    );
    global.onmessage({data:{reset:true}});
  }
  
  testVerilator('presets/verilog/hvsync_generator.v');
  testVerilator('presets/verilog/digits10.v', null, null, ['digits10.v', 'hvsync_generator.v']);
  testVerilator('presets/verilog/scoreboard.v', null, null, ['scoreboard.v', 'digits10.v', 'hvsync_generator.v']);
  testVerilator('presets/verilog/ball_paddle.v', null, null, ['ball_paddle.v', 'scoreboard.v', 'digits10.v', 'hvsync_generator.v']);
  testVerilator('presets/verilog/sprite_rotation.v', null, null, ['sprite_rotation.v', 'hvsync_generator.v']);
  testVerilator('presets/verilog/lfsr.v');
  testVerilator('presets/verilog/starfield.v', null, null, ['starfield.v', 'lfsr.v', 'hvsync_generator.v']);
  testVerilator('presets/verilog/ram.v');
  testVerilator('presets/verilog/font_cp437_8x8.v');
  testVerilator('presets/verilog/sprite_scanline_renderer.v', null, null, ['sprite_scanline_renderer.v', 'ram.v', 'hvsync_generator.v']);
  testVerilator('presets/verilog/tile_renderer.v', null, null, ['tile_renderer.v', 'font_cp437_8x8.v', 'ram.v', 'hvsync_generator.v']);
  testVerilator('presets/verilog/cpu6502.v');

});
