"use strict";

global.window = global;

require('./z80.js');

var _global = window;
_global.buildZ80({
	applyContention: false
});
console.log('var Z80_fast = ' + _global.Z80 + '');

