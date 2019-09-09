#!/usr/bin/env node

var fs = require('fs'),
    PNG = require('pngjs').PNG,
    RgbQuant = require('rgbquant');

var data = fs.readFileSync(process.argv[2]);
var png = PNG.sync.read(data);
q = new RgbQuant();
q.colors = 4;
q.sample(png.data);
pal = q.palette(false, true);
//console.log(q);

function readfonttxt(s) {
  var lines = s.split(/\r?\n/);// TODO
}

function remapBits(x, arr) {
  if (!arr) return x;
  var y = 0;
  for (var i=0; i<arr.length; i++) {
    var s = arr[i];
    if (s < 0) {
      s = -s-1;
      y ^= 1 << s;
    }
    if (x & (1 << i)) {
      y ^= 1 << s;
    }
  }
  return y;
}

function reorder(arrin, remap) {
    var out = [];
    for (var i=0; i<arrin.length; i++) {
      var j = remapBits(i, remap);
      //console.log(i,j);
      if (j >= arrin.length) throw i+" -> "+j+" >= "+arrin.length;
      out.push(arrin[j] | 0);
    }
    return out;
}

function packbits(arrin, bpp, brev) {
  var out = new Uint8Array((arrin.length * bpp) >> 3);
  for (var i=0; i<arrin.length; i++) {
    var j = (i * bpp) >> 3;
    var s = (i * bpp) & 7;
    if (brev) s = 8-bpp-s;
    out[j] |= arrin[i] << s;
  }
  return out;
}

function hex(n) {
  return (n < 16 ? "0" : "") + n.toString(16);
}

function dump(arr, bpl) {
  var s = '';
  for (var i=0; i<arr.length; i++) {
    if (i % bpl == 0) {
      s += '\n.byte ';
    } else {
      s += ',';
    }
    s += '$' + hex(arr[i]);
  }
  s += '\n';
  return s;
}

idximg = q.reduce(png.data, 2);
//idximg = idximg.slice(0, 8*16*128);
//idximg = idximg.slice(8*16*64);
idx2 = reorder(idximg, [0,1,2,3,4,5,6,11,12,13,-8,-9,-10,-11]); // 8x16 font
//idx2 = reorder(idximg, [0,1,2,3,5,6,11,12,13,99,-8,-9,-10,-5]); // 8x16 CHR tileset
idx3 = packbits(idx2, 2, true);
//console.log(idximg.length, idx2.length, idx3.length);
console.log(dump(idx3, 8));
console.log(";;",idx3.length,"bytes,",pal.length/4,'colors');
