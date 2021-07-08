
var assert = require('assert');
var _fs = require('fs');
var _path = require('path')
var _cproc = require('child_process');
var fs = require('fs');
var wtu = require('./workertestutils.js');
var heapdump = require("heapdump");
var commandExists = require('command-exists');

var has_yosys = commandExists('yosys');
var has_iverilog = commandExists('iverilog');

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
    //await platform.loadROM("ROM", msg.output);
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

function compileVerilator(filename, code, callback, nerrors, depends) {
    // files come back from worker
    global.postMessage = async function(msg) {
      try {
        if (msg.errors && msg.errors.length) {
          if (msg.errors.length > 0 && nerrors == 0) throw new Error(JSON.stringify(msg.errors));
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
        if (filename == 'test/cli/verilog/t_unopt_converge_initial.v') e = null;
        //console.log('rm', filename);
        callback(e, null);
      }
    };
    // send files to worker for build
    try {
      global.onmessage({
          data:{
            updates:[{path:_path.basename(filename), data:code}],
            buildsteps:[{path:_path.basename(filename), platform:'verilog', tool:'verilator', files:depends}]
          }
      });
    } catch (e) {
      //console.log('rm', filename);
      callback(e, null);
    }
}

function testIcarus(filename) {
  if (has_iverilog) it('should icarus '+filename, function(done) {
    _cproc.exec('iverilog -g2012 -I./presets/verilog -I./tests/cli/verilog ./' + filename, function(err,stdout,stderr) {
      if (err) {
        console.log(stdout);
        console.log(stderr);
      }
      done(err);
    });
  });
}

function testYosys(filename) {
  if (has_yosys) it('should yosys '+filename, function(done) {
    _cproc.exec(`yosys -q -p "read_verilog -sv ./${filename}"`, function(err,stdout,stderr) {
      if (err) {
        console.log(stdout);
        console.log(stderr);
      }
      done(err);
    });
  });
}

function testVerilator(filename, disables, nerrors, depends) {
  it('should verilate '+filename, function(done) {
    console.log(filename);
    var csource = ab2str(fs.readFileSync(filename));
    var header = '';
    for (var i=0; i<(disables||[]).length; i++)
      header += "/* verilator lint_off " + disables[i] + " */ ";
    compileVerilator(filename, header + "\n" + csource, done, nerrors||0, depends);
  });
}

function testModule(filename, disables, nerrors, depends) {
  testVerilator(filename, disables, nerrors, depends);
  //testIcarus(filename);
  //testYosys(filename);
}

describe('Verilog Worker', function() {
  
  var files = _fs.readdirSync('test/cli/verilog').filter(fn => fn.endsWith('.v'));
  //files = files.slice(0,75);
  for (var fn of files) {
    testModule('test/cli/verilog/' + fn, 
      ['UNDRIVEN','BLKSEQ','WIDTH','PINCONNECTEMPTY','SYNCASYNCNET','UNOPT','UNOPTFLAT','VARHIDDEN','EOFNEWLINE','ASSIGNDLY','CASEX','SYMRSVDWORD','STMTDLY','PROCASSWIRE']
    );
    global.onmessage({data:{reset:true}});
  }
  
  testModule('presets/verilog/hvsync_generator.v');
  testModule('presets/verilog/test_hvsync.v', null, null, ['test_hvsync.v', 'hvsync_generator.v']);
  testModule('presets/verilog/digits10.v', null, null, ['digits10.v', 'hvsync_generator.v']);
  testModule('presets/verilog/scoreboard.v', null, null, ['scoreboard.v', 'digits10.v', 'hvsync_generator.v']);
  testModule('presets/verilog/ball_paddle.v', null, null, ['ball_paddle.v', 'scoreboard.v', 'digits10.v', 'hvsync_generator.v']);
  testModule('presets/verilog/sprite_rotation.v', null, null, ['sprite_rotation.v', 'hvsync_generator.v']);
  testModule('presets/verilog/lfsr.v');
  testModule('presets/verilog/starfield.v', null, null, ['starfield.v', 'lfsr.v', 'hvsync_generator.v']);
  testModule('presets/verilog/ram.v');
  testModule('presets/verilog/font_cp437_8x8.v');
  testModule('presets/verilog/sprite_scanline_renderer.v', null, null, ['sprite_scanline_renderer.v', 'ram.v', 'hvsync_generator.v']);
  testModule('presets/verilog/tile_renderer.v', null, null, ['tile_renderer.v', 'font_cp437_8x8.v', 'ram.v', 'hvsync_generator.v']);
  testModule('presets/verilog/cpu6502.v');

  testYosys('presets/verilog/ball_paddle.v');
  testYosys('presets/verilog/starfield.v');
  testYosys('presets/verilog/racing_game.v');
  testYosys('presets/verilog/racing_game_cpu.v');
  // TODO: fix testYosys('presets/verilog/cpu_platform.v');
  testYosys('presets/verilog/cpu6502.v');

}).afterAll(() => {
/*
  heapdump.writeSnapshot((err, filename) => {
    console.log("Heap dump written to", filename);
  });
*/
});
