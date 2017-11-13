
var moduleName, symsName;

function parseDecls(text, arr, name, bin, bout) {
  var re = new RegExp(name + "(\\d+)[(](\\w+),(\\d+),(\\d+)[)]", 'gm');
  var m;
  while ((m = re.exec(text))) {
    arr.push({
      wordlen:parseInt(m[1]),
      name:m[2],
      len:parseInt(m[3]),
      ofs:parseInt(m[4]),
    });
  }
}

function buildModule(o) {
  var m = '"use strict";\n';
  m += '\tvar self = this;\n';
  m += '\tvar VL_RAND_RESET_I = base.VL_RAND_RESET_I;\n';
  for (var i=0; i<o.ports.length; i++) {
    m += "\tself." + o.ports[i].name + ";\n";
  }
  for (var i=0; i<o.signals.length; i++) {
    m += "\tself." + o.signals[i].name + ";\n";
  }
  for (var i=0; i<o.funcs.length; i++) {
    m += o.funcs[i];
  }
  return m;
}

function translateFunction(text) {
  text = text.trim();
  var funcname = text.match(/(\w+)/)[1];
  text = text.replace(symsName + "* __restrict ", "");
  text = text.replace(moduleName + "* __restrict vlTOPp VL_ATTR_UNUSED", "var vlTOPp");
  text = text.replace(/VL_DEBUG_IF/g,"//VL_DEBUG_IF");
  text = text.replace(/VL_SIG\d+[(](\w+),(\d+),(\d+)[)]/g, 'var $1');
  text = text.replace(/\b->\b/g, ".");
  text = text.replace('VL_INLINE_OPT', '');
  text = text.replace(/[(]IData[)]/g, '');
  text = text.replace(/\b(0x[0-9a-f]+)U/gi, '$1');
  text = text.replace(/\b([0-9]+)U/gi, '$1');
  text = text.replace(/\bQData /, 'var ');
  text = text.replace(/\bbool /, '');
  text = text.replace(/(\w+ = VL_RAND_RESET_I)/g, 'self.$1');
  text = text.replace(/^#/gm, '//#');
  text = text.replace(/VL_LIKELY/g, '!!');
  text = text.replace(/VL_UNLIKELY/g, '!!');
  text = text.replace(/Verilated::(\w+)Error/g, 'console.log');
  return "function " + text + "\nself." + funcname + " = " + funcname + ";\n";
}

function translateStaticVars(text) {
  var s = "";
  var m;
  var re = /VL_ST_SIG(\d+)[(](\w+?)::(\w+).(\d+).,(\d+),(\d+)[)]/g;
  while (m = re.exec(text)) {
    s += "var " + m[3] + " = this." + m[3] + " = new Uint" + m[1] + "Array(" + m[4] + ");\n";
  }
  return s;
}

function translateVerilatorOutputToJS(htext, cpptext) {
  // parse header file
  moduleName = /VL_MODULE.(\w+)./.exec(htext)[1];
  symsName = moduleName + "__Syms";
  var ports = [];
  parseDecls(htext, ports, 'VL_IN', true, false);
  parseDecls(htext, ports, 'VL_OUT', false, true);
  var signals = [];
  parseDecls(htext, signals, 'VL_SIG');

  // parse cpp file
  // split functions
  var re_fnsplit = new RegExp("(?:void|QData) " + moduleName + "::");
  var functexts = cpptext.split(re_fnsplit);
  var funcs = [];
  funcs.push(translateStaticVars(functexts[0]));
  for (var i=4; i<functexts.length; i++) {
    var fntxt = translateFunction(functexts[i]);
    funcs.push(fntxt);
  }

  return {
    output:buildModule({
      name:moduleName,
      ports:ports,
      signals:signals,
      funcs:funcs,
    }),
    name:moduleName,
    ports:ports,
    signals:signals,
  };
}

////

// TODO: unit test
/*
incpp = "obj_dir/Vhvsync_generator.cpp"
inh = "obj_dir/Vhvsync_generator.h"

fs = require('fs')
fs.readFile(incpp, 'utf8', function (err,datacpp) {
  fs.readFile(inh, 'utf8', function (err,datah) {
    var modtext = translateVerilatorOutputToJS(datah, datacpp);
    console.log(modtext);
    var mod = new Function('base',modtext);
    var gen = new mod(new VerilatorBase());
    console.log(gen);
    gen._ctor_var_reset();
    var top = {TOPp:gen};
    gen._eval_settle(top);
    for (var i=0; i<1000000; i++)
      gen._eval(top);
    console.log(gen);
  });
});
*/
