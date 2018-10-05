
var fs = require('fs');
var asm = require('../../gen/worker/assembler.js');
var stdinBuffer = fs.readFileSync(0);
var code = stdinBuffer.toString();
var asm = new asm.Assembler();
asm.loadJSON = function(filename) {
  return JSON.parse(fs.readFileSync(filename, 'utf8'));
};
asm.loadInclude = function(filename) {
  filename = filename.substr(1, filename.length-2); // remove quotes
  //return fs.readFileSync(filename, 'utf8');
};
asm.loadModule = function(top_module) {
 //TODO
};
var out = asm.assembleFile(code);
//console.log(out);
out.output.forEach(function(x) {
  console.log(x.toString(16));
});
