
var assert = require('assert');
var fs = require('fs');
var wtu = require('./workertestutils.js');

includeInThisContext('src/emu.js');
includeInThisContext('src/platform/verilog.js');

function loadPlatform(msg) {
  var platform = new VerilogPlatform();
  try {
    platform.loadROM("ROM", msg.output);
    vl_finished = vl_stopped = false;
    for (var i=0; i<10000 && !(vl_finished||vl_stopped); i++)
      platform.tick();
    assert.ok(!vl_stopped);
  } catch (e) {
    //platform.printErrorCodeContext(e, msg.output.code);
    console.log(msg.intermediate.listing);
    console.log(msg.output.code);
    console.log(e);
    throw e;
  }
  return platform;
}

function compileVerilator(code, callback, nerrors) {
    global.postMessage = function(msg) {
        if (msg.errors && msg.errors.length) {
          console.log(msg.errors);
          assert.equal(nerrors||0, msg.errors.length, "errors");
        } else {
          assert.equal(nerrors||0, 0, "errors");
          loadPlatform(msg);
        }
        callback(null, msg);
    };
    global.onmessage({
        data:{code:code, platform:'verilog', tool:'verilator'}
    });
}

function testVerilator(filename, disables, nerrors) {
  it('should translate '+filename, function(done) {
    var csource = ab2str(fs.readFileSync(filename));
    for (var i=0; i<(disables||[]).length; i++)
      csource = "/* verilator lint_off " + disables[i] + " */\n" + csource;
    compileVerilator(csource, done, nerrors||0);
  });
}

describe('Verilog Worker', function() {

/* TODO: fix tests
  testVerilator('test/cli/verilog/t_order_doubleloop.v', ['BLKSEQ']);
  testVerilator('test/cli/verilog/t_alw_combdly.v');
  testVerilator('test/cli/verilog/t_math_const.v', ['BLKSEQ']);
  testVerilator('test/cli/verilog/t_clk_gen.v', ['BLKSEQ']);
  testVerilator('test/cli/verilog/t_clk_first.v', ['UNDRIVEN','SYNCASYNCNET']);
  testVerilator('test/cli/verilog/t_clk_2in.v', ['BLKSEQ']);
*/
  testVerilator('test/cli/verilog/t_gen_alw.v');
  testVerilator('test/cli/verilog/t_case_huge_sub3.v');

  //testVerilator('test/cli/verilog/t_order.v');
  //testVerilator('test/cli/verilog/t_order_2d.v');
  //testVerilator('test/cli/verilog/t_order_a.v');
  //testVerilator('test/cli/verilog/t_order_b.v');
  //testVerilator('test/cli/verilog/t_order_clkinst.v');
  testVerilator('test/cli/verilog/t_order_comboclkloop.v');
  //testVerilator('test/cli/verilog/t_order_comboloop.v', ['BLKSEQ']);
  testVerilator('test/cli/verilog/t_order_first.v');
  testVerilator('test/cli/verilog/t_order_loop_bad.v', ['BLKSEQ'], 10);
  testVerilator('test/cli/verilog/t_order_multialways.v');
  testVerilator('test/cli/verilog/t_order_multidriven.v', ['UNDRIVEN']);
  //testVerilator('test/cli/verilog/t_order_quad.v');
  testVerilator('test/cli/verilog/t_order_wireloop.v', ['UNOPT']);

  testVerilator('test/cli/verilog/t_mem.v');

  testVerilator('test/cli/verilog/t_alw_dly.v', ['BLKSEQ']);
  testVerilator('test/cli/verilog/t_alw_split.v', ['BLKSEQ']);
  testVerilator('test/cli/verilog/t_alw_splitord.v', ['BLKSEQ']);

  testVerilator('test/cli/verilog/t_array_compare.v');

  testVerilator('test/cli/verilog/t_math_arith.v', ['BLKSEQ']);
  //testVerilator('test/cli/verilog/t_math_div.v');
  testVerilator('test/cli/verilog/t_math_div0.v');

  testVerilator('test/cli/verilog/t_clk_powerdn.v', ['BLKSEQ','SYNCASYNCNET']);
  //testVerilator('test/cli/verilog/t_clk_latchgate.v', ['BLKSEQ']);
  //testVerilator('test/cli/verilog/t_clk_latch.v');
  //testVerilator('test/cli/verilog/t_clk_gater.v', ['BLKSEQ']);
  testVerilator('test/cli/verilog/t_clk_dsp.v');
  testVerilator('test/cli/verilog/t_clk_dpulse.v');
  testVerilator('test/cli/verilog/t_clk_condflop_nord.v');
  testVerilator('test/cli/verilog/t_clk_condflop.v', ['BLKSEQ']);

  testVerilator('presets/verilog/hvsync_generator.v');
  /*
  it('should compile verilog example', function(done) {
    var csource = ab2str(fs.readFileSync('presets/verilog/hvsync_generator.v'));
    compileVerilator(csource, done);
  });
  */
});
