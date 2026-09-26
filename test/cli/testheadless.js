
var assert = require('assert');
var { loadPlatform } = require('../../gen/tools/emutarget.js');

// Platforms must start without the IDE: no #emuoverlay, no jQuery, and no
// main element (loadPlatform passes null, like the CLI and the extension).
describe('headless platform start', function () {
    it('should start verilog without the IDE', async function () {
        var target = await loadPlatform('verilog');
        await target.start();
        var video = target.getVideo();
        assert.equal(video.width, 292);
        assert.equal(video.height, 256);
    });
});
