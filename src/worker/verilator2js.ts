
type V2JS_Var = {
  wordlen:number,
  name:string,
  len:number,
  ofs:number,
  arrdim?:number[]
}

type V2JS_Code = {
  name:string,
  ports:V2JS_Var[],
  signals:V2JS_Var[],
  funcs:string[],
}

type V2JS_Output = {
  output:{
    code:V2JS_Code,
    name:string,
    ports:V2JS_Var[],
    signals:V2JS_Var[],
  }
}

function translateVerilatorOutputToJS(htext:string, cpptext:string) {

var moduleName : string;
var symsName : string;

function parseDecls(text:string, arr:V2JS_Var[], name:string, bin?:boolean, bout?:boolean) {
  var re = new RegExp(name + "(\\d*)[(](\\w+),(\\d+),(\\d+)[)]", 'gm');
  var m;
  while ((m = re.exec(text))) {
    arr.push({
      wordlen:parseInt(m[1]),
      name:m[2],
      len:parseInt(m[3])+1,
      ofs:parseInt(m[4]),
    });
  }
  re = new RegExp(name + "(\\d*)[(](\\w+)\\[(\\d+)\\],(\\d+),(\\d+)[)]", 'gm');
  var m;
  while ((m = re.exec(text))) {
    arr.push({
      wordlen:parseInt(m[1]),
      name:m[2],
      arrdim:[parseInt(m[3])],
      len:parseInt(m[4])+1,
      ofs:parseInt(m[5]),
    });
  }
  re = new RegExp(name + "(\\d*)[(](\\w+)\\[(\\d+)\\]\\[(\\d+)\\],(\\d+),(\\d+)[)]", 'gm');
  var m;
  while ((m = re.exec(text))) {
    arr.push({
      wordlen:parseInt(m[1]),
      name:m[2],
      arrdim:[parseInt(m[3]), parseInt(m[4])],
      len:parseInt(m[5])+1,
      ofs:parseInt(m[6]),
    });
  }
}

function buildModule(o : V2JS_Code) : string {
  var m = '"use strict";\n';
  for (var i=0; i<o.ports.length; i++) {
    m += "\tthis." + o.ports[i].name + ";\n";
  }
  for (var i=0; i<o.signals.length; i++) {
    var sig = o.signals[i];
    if (sig.arrdim) {
      if (sig.arrdim.length == 1) {
        m += "\tvar " + sig.name + " = this." + sig.name + " = [];\n";
      } else if (sig.arrdim.length == 2) {
        m += "\tvar " + sig.name + " = this." + sig.name + " = [];\n";
        m += "\tfor(var i=0; i<" + sig.arrdim[0] + "; i++) { " + sig.name + "[i] = []; }\n";
      }
    } else {
      m += "\tthis." + sig.name + ";\n";
    }
  }
  for (var i=0; i<o.funcs.length; i++) {
    m += o.funcs[i];
  }
  return m;
}

function getStats(o : V2JS_Code) {
  var nmembits = 0;
  var nlines = 0;
  for (var sig of o.signals.concat(o.ports)) {
    var len = sig.len || 0;
    if (sig.arrdim)
      for (var n of sig.arrdim)
        len *= n;
    nmembits += len;
  }
  for (var fn of o.funcs) {
    nlines += fn.split('\n').length;
  }
  //console.log(nmembits,'bits',nlines,'lines');
  return {bits:nmembits, lines:nlines};
}

function translateFunction(text : string) : string {
  text = text.trim();
  if (text.match(/VL_RAND_RESET_Q/))
    throw Error("Values longer than 32 bits are not supported");
  var funcname = text.match(/(\w+)/)[1];
  text = text.replace(symsName + "* __restrict ", "");
  text = text.replace(moduleName + "* __restrict vlTOPp VL_ATTR_UNUSED", "var vlTOPp");
  text = text.replace(/\bVL_DEBUG_IF\(([^]+?)\);\n/g,"/*VL_DEBUG_IF($1);*/\n");
  //text = text.replace(/\bVL_DEBUG_IF/g,"!__debug__?0:\n");
  text = text.replace(/\bVL_SIG(\d*)[(](\w+),(\d+),(\d+)[)]/g, 'var $2');
  text = text.replace(/\b->\b/g, ".");
  text = text.replace('VL_INLINE_OPT', '');
  text = text.replace(/[(]IData[)]/g, '');
  text = text.replace(/\b(0x[0-9a-f]+)U/gi, '$1');
  text = text.replace(/\b([0-9]+)U/gi, '$1');
  text = text.replace(/\bQData /g, 'var ');
  text = text.replace(/\bbool /g, '');
  text = text.replace(/\bint /g, 'var ');
  text = text.replace(/(\w+ = VL_RAND_RESET_)/g, 'this.$1'); // TODO?
  //text = text.replace(/^\s*(\w+ = \d+;)/gm, 'this.$1'); // TODO?
  //text = text.replace(/(\w+\[\w+\] = VL_RAND_RESET_I)/g, 'this.$1');
  text = text.replace(/^#/gm, '//#');
  text = text.replace(/VL_LIKELY/g, '!!');
  text = text.replace(/VL_UNLIKELY/g, '!!');
  // for memread
  text = text.replace(/VL_SIGW[(](\w+),(\d+),(\d+),(\d+)[)]/g, 'var $1 = new Uint32Array($4)');
  // convert VL_ULL() 64-bits into an array of two 32-bits
  text = text.replace(/VL_ULL[(]0x([0-9a-f]+?)([0-9a-f]{8})[)]/g, '[0x$2, 0x$1]');
  //[%0t] %Error: scoreboard.v:53: Assertion failed in %Nscoreboard_top.scoreboard_gen: reset 64 -935359306 Vscoreboard_top
  text = text.replace(/Verilated::(\w+)Error/g, 'console.log');
  text = text.replace(/vlSymsp.name[(][)]/g, '"'+moduleName+'"');
  return "function " + text + "\nthis." + funcname + " = " + funcname + ";\n";
}

function translateStaticVars(text : string) : string {
  var s = "";
  var m;
  var re = /VL_ST_SIG(\d+)[(](\w+?)::(\w+).(\d+).,(\d+),(\d+)[)]/g;
  while (m = re.exec(text)) {
    s += "var " + m[3] + " = this." + m[3] + " = new Uint" + m[1] + "Array(" + m[4] + ");\n";
  }
  return s;
}

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

  var modinput = {
    name:moduleName,
    ports:ports,
    signals:signals,
    funcs:funcs,
  };

  return {
    output:{
      code:buildModule(modinput),
      name:moduleName,
      ports:ports,
      signals:signals,
      //stats:getStats(modinput),
    }
  };

}
