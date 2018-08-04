
var vm = require('vm');
var fs = require('fs');
var assert = require('assert');
var includeInThisContext = function(path) {
    var code = fs.readFileSync(path);
    vm.runInThisContext(code, path);
};

includeInThisContext("gen/emu.js");
includeInThisContext("gen/util.js");
includeInThisContext("src/platform/nes.js");

describe('LZG', function() {
  it('Should decode LZG', function() {
   var rom = new Uint8Array(new lzgmini().decode(NES_CONIO_ROM_LZG));
   assert.equal(40977, rom.length);
  });
});
