
var assert = require('assert');
var { VectorRaster } = require('../../gen/common/vectorraster.js');
var { loadPlatform } = require('../../gen/tools/emutarget.js');

function lit(r) {
    var n = 0;
    for (var p of r.pixels) if (p & 0xffffff) n++;
    return n;
}

// brightness of one channel (shift 0, 8, 16) summed down a pixel column
function column(r, x, shift) {
    var n = 0;
    for (var y = 0; y < r.height; y++) n += (r.pixels[y * r.width + x] >> shift) & 0xff;
    return n;
}

describe('VectorRaster', function () {
    it('scales the platform space so the long side is the size', function () {
        var r = new VectorRaster(900, 1100, 550);
        assert.equal(r.width, 450);
        assert.equal(r.height, 550);
    });
    it('draws a bright horizontal line, y up', function () {
        var r = new VectorRaster(1024, 1024, 512);
        r.drawLine(0, 768, 1023, 768, 255, 7); // 3/4 up is 1/4 down: row 128
        assert(Math.abs(column(r, 100, 0) - 255) < 4);
        assert.equal(r.pixels[128 * 512 + 100] & 0xffffff, r.pixels[127 * 512 + 100] & 0xffffff);
        assert.equal(r.pixels[400 * 512 + 100] & 0xffffff, 0);
        assert.equal(r.pixels[10 * 512 + 100] & 0xffffff, 0);
    });
    it('draws a point and ignores zero intensity', function () {
        var r = new VectorRaster(1024, 1024, 512);
        r.drawLine(100, 100, 100, 100, 0, 7);
        assert.equal(lit(r), 0);
        r.drawLine(100, 100, 100, 100, 255, 7);
        assert(lit(r) > 0);
    });
    it('fades by persistence on clear and wipes on a hard clear', function () {
        var r = new VectorRaster(256, 256, 256);
        r.drawLine(0, 128, 255, 128, 255, 7);
        var before = column(r, 100, 0);
        r.clear();
        var after = column(r, 100, 0);
        assert(Math.abs(after - before / 2) < 4);
        r.clear(true);
        assert.equal(lit(r), 0);
    });
    it('uses the palette', function () {
        var r = new VectorRaster(256, 256, 256);
        r.drawLine(0, 128, 255, 128, 255, 2); // green
        assert(column(r, 100, 8) > 200);
        assert(column(r, 100, 0) < 50);
    });
});

describe('headless vector platform', function () {
    this.timeout(60000);
    it('has a screen of the configured size', async function () {
        var target = await loadPlatform('vector-ataricolor');
        target.vectorSize = 256;
        await target.start();
        var video = target.getVideo();
        assert.equal(video.width, 256);
        assert.equal(video.height, 256);
    });
});
