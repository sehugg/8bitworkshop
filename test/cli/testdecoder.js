
var vm = require('vm');
var fs = require('fs');
var includeInThisContext = function(path) {
    var code = fs.readFileSync(path);
    vm.runInThisContext(code, path);
};

includeInThisContext("gen/emu.js");

function assert(b, msg) {
  if (!b) { throw new Error(msg); }
}
function assertEquals(a,b) {
  assert(a==b, a + " != " + b);
}

describe('Address decoder', function() {
  it('Should work empty', function() {
    var decoder = new AddressDecoder([]);
    assertEquals(0, decoder(0x1234));
    assertEquals(0, decoder(0x123456));
  });
  it('Should work with 1 range', function() {
    var decoder = new AddressDecoder([
      [0x1000, 0x7fff, 0xff, function(a) { return a+2; }]
    ]);
    assertEquals(0, decoder(0xfff));
    assertEquals(2, decoder(0x1000));
    assertEquals(1, decoder(0x7fff));
    assertEquals(0, decoder(0x8000));
  });
});
