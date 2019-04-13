
var asmmod = require('../../gen/worker/assembler');
var fs = require('fs');

var args = process.argv;
if (args.length < 3) {
    console.log("Usage: asmmain config.json [file.asm...]");
    process.exit(1);
}

// load JSON config
var configFilename = args[2];
var configFile = fs.readFileSync(configFilename, 'utf8');
var configJson = JSON.parse(configFile);

var binout = [];
for (var fi=3; fi<args.length; fi++) {
  // assemble file
  var asmFilename = args[fi];
  var asm = new asmmod.Assembler(configJson);
  asm.loadInclude = function(fn) { };
  asm.loadModule = function(fn) { };
  var asmtext = fs.readFileSync(asmFilename, 'utf8');
  var out = asm.assembleFile(asmtext);
  if (out.errors && out.errors.length) {
    for (var ei=0; ei<out.errors.length; ei++) {
      var err = out.errors[ei];
      console.log(asmFilename + "(" + err.line + "): " + err.msg);
    }
    process.exit(2);
  }
  binout = binout.concat(out.output);
}

// print output
for (var i=0; i<binout.length; i++) {
  console.log(binout[i].toString(16));
}
