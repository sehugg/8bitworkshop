
// Manual debug aid: dumps the DASM listing and the parsed line map for a
// snippet. Not a test -- mocha loads every file in this directory, so it only
// runs when invoked directly: NODE_PATH=$(pwd) node test/cli/dbg-dasm.js
if (require.main !== module) return;

var wtu = require('./workertestutils.js');

var code = '\tprocessor 6502\n\torg $f000\n MAC mack\n lda #0\n ENDM\nfoo: mack\n mack\n';

global.postMessage = function(msg) {
  if (msg.unchanged) return;
  if (msg.errors && msg.errors.length) {
    console.log(msg.errors);
    return;
  }
  for (var path in msg.listings) {
    console.log('=== ' + path);
    for (var line of msg.listings[path].lines) {
      console.log(line);
    }
  }
  console.log('=== symbols');
  console.log(msg.symbolmap);
};
global.onmessage({data:{code:code, platform:'vcs.mame', tool:'dasm', path:'src.dasm', mainfile:true}});
