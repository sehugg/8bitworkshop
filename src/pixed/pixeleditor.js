"use strict";

function PixelEditor(parentDiv, width, height, palette, initialData) {

  function createCanvas() {
    var c = document.createElement('canvas');
    c.width = width;
    c.height = height;
    c.classList.add("pixels");
    c.classList.add("pixelated");
    //canvas.tabIndex = "-1";               // Make it focusable
    $(parentDiv).empty().append(c);
    return c;
  }

  function updateImage() {
    ctx.putImageData(pixdata, 0, 0);
  }

  function fitCanvas() {
    var w = $(parentDiv).width();
    var h = $(parentDiv).height();
    pixcanvas.style.height = Math.floor(h)+"px";
    // TODO
  }
  this.resize = fitCanvas;

  palette = new Uint32Array(palette);
  var pixcanvas = createCanvas();
  var ctx = pixcanvas.getContext('2d');
  var pixdata = ctx.createImageData(pixcanvas.width, pixcanvas.height);
  var pixints = new Uint32Array(pixdata.data.buffer);
  for (var i=0; i<pixints.length; i++) {
    pixints[i] = initialData ? palette[initialData[i]] : palette[0];
  }

  updateImage();
  fitCanvas();
  createPaletteButtons();

  function revrgb(x) {
    var y = 0;
    y |= ((x >> 0) & 0xff) << 16;
    y |= ((x >> 8) & 0xff) << 8;
    y |= ((x >> 16) & 0xff) << 0;
    return y;
  }

  function createPaletteButtons() {
    var span = $("#palette_group").empty();
    for (var i=0; i<palette.length; i++) {
      var btn = $('<button class="palbtn">');
      var rgb = palette[i] & 0xffffff;
      var color = "#" + hex(revrgb(rgb), 6);
      btn.click(setCurrentColor.bind(this, i));
      btn.attr('id', 'palcol_' + i);
      btn.css('backgroundColor', color).text(i.toString(16));
      if ((rgb & 0x808080) != 0x808080) { btn.css('color', 'white'); }
      span.append(btn);
    }
    setCurrentColor(1);
  }

  function getPixelByOffset(ofs) {
    var oldrgba = pixints[ofs];
    for (var i=0; i<palette.length; i++) {
      if (oldrgba == palette[i]) return i;
    }
    return 0;
  }

  function getPixel(x, y) {
    var ofs = x+y*pixcanvas.width;
    return getPixelByOffset(ofs);
  }

  function setPixel(x, y, col) {
    var ofs = x+y*pixcanvas.width;
    var oldrgba = pixints[ofs];
    var rgba = palette[col];
    if (oldrgba != rgba) {
      pixints[ofs] = rgba;
      updateImage();
    }
  }

  function getPositionFromEvent(e) {
    var x = Math.floor(e.offsetX * width / pxls.width());
    var y = Math.floor(e.offsetY * height / pxls.height());
    return {x:x, y:y};
  }

  function setCurrentColor(col) {
    if (curpalcol != col) {
      if (curpalcol >= 0)
        $("#palcol_" + curpalcol).removeClass('selected');
      curpalcol = col;
      $("#palcol_" + col).addClass('selected');
    }
  }
  this.setCurrentColor = setCurrentColor;

  var curpalcol = -1;
  setCurrentColor(1);

  var dragcol = 1;
  var dragging = false;

  var pxls = $(pixcanvas);
  pxls.mousedown(function(e) {
    var pos = getPositionFromEvent(e);
    dragcol = getPixel(pos.x, pos.y) == curpalcol ? 0 : curpalcol;
    setPixel(pos.x, pos.y, curpalcol);
    dragging = true;
  })
  .mousemove(function(e) {
    var pos = getPositionFromEvent(e);
    if (dragging) {
      setPixel(pos.x, pos.y, dragcol);
    }
  })
  .mouseup(function(e) {
    var pos = getPositionFromEvent(e);
    setPixel(pos.x, pos.y, dragcol);
    dragging = false;
  });

  this.getImageColors = function() {
    var pixcols = new Uint8Array(pixints.length);
    for (var i=0; i<pixints.length; i++)
      pixcols[i] = getPixelByOffset(i);
    return pixcols;
  }

}

function parseHexBytes(s) {
  var arr = [];
  var re = /0x([0-9a-f]+)/gi;
  var m;
  while (m = re.exec(s)) {
    if (m[0].startsWith('0x'))
      arr.push(parseInt(m[1],16));
    else
      arr.push(parseInt(m[1]));
  }
  return arr;
}

function replaceHexBytes(s, bytes) {
  var result = "";
  var re = /0x([0-9a-f]+)/gi;
  var m;
  var li = 0;
  var i = 0;
  while (m = re.exec(s)) {
    result += s.slice(li, re.lastIndex - m[0].length);
    li = re.lastIndex;
    if (m[0].startsWith('0x'))
      result += "0x" + hex(bytes[i++]);
    else
      result += bytes[i++].toString();
  }
  result += s.slice(li);
  return result;
}

function convertBytesToImages(bytes, fmt) {
  var count = fmt.count ? fmt.count : 1;
  var width = fmt.w;
  var height = fmt.h;
  var bytesperline = fmt.sl ? fmt.sl : Math.ceil(fmt.w * fmt.bpp / 8);
  //console.log(width,height,bytesperline);
  var mask = (1 << fmt.bpp)-1;
  var images = [];
  var nplanes = fmt.np ? fmt.np : 1;
  for (var n=0; n<count; n++) {
    var imgdata = [];
    for (var y=0; y<height; y++) {
      var ofs = n*bytesperline*height + y*bytesperline;
      var shift = 0;
      for (var x=0; x<width; x++) {
        var color = 0;
        for (var p=0; p<nplanes; p++) {
          var byte = bytes[ofs + p*(fmt.pofs|0)];
          color |= ((fmt.brev ? byte>>(8-shift-fmt.bpp) : byte>>shift) & mask) << (p*fmt.bpp);
        }
        imgdata.push(color);
        shift += fmt.bpp;
        if (shift >= 8) {
          ofs += 1;
          shift = 0;
        }
      }
    }
    images.push(imgdata);
  }
  return images;
}

function convertImagesToBytes(images, fmt) {
  var count = fmt.count ? fmt.count : 1;
  var width = fmt.w;
  var height = fmt.h;
  var bytesperline = fmt.sl ? fmt.sl : Math.ceil(fmt.w * fmt.bpp / 8);
  var mask = (1 << fmt.bpp)-1;
  var nplanes = fmt.np ? fmt.np : 1;
  var i = 0;
  var bytes = new Uint8Array(bytesperline * height * nplanes * count);
  for (var n=0; n<count; n++) {
    var imgdata = images[n];
    for (var y=0; y<height; y++) {
      var ofs = n*bytesperline*height + y*bytesperline;
      var shift = 0;
      for (var x=0; x<width; x++) {
        var color = imgdata[i++];
        for (var p=0; p<nplanes; p++) {
          bytes[ofs + p*(fmt.pofs|0)] |= fmt.brev ? (color << (8-shift-fmt.bpp)) : (color << shift);
          /* TODO
          var byte = bytes[ofs + p*(fmt.pofs|0)];
          color |= ((fmt.brev ? byte>>(8-shift-fmt.bpp) : byte>>shift) & mask) << (p*fmt.bpp);
          */
        }
        shift += fmt.bpp;
        if (shift >= 8) {
          ofs += 1;
          shift = 0;
        }
      }
    }
  }
  return bytes;
}

function convertPaletteBytes(arr,r0,r1,g0,g1,b0,b1) {
  var result = [];
  for (var i=0; i<arr.length; i++) {
    var d = arr[i];
    var rgb = 0xff000000;
    rgb |= ((d >> r0) & ((1<<r1)-1)) << (0+8-r1);
    rgb |= ((d >> g0) & ((1<<g1)-1)) << (8+8-g1);
    rgb |= ((d >> b0) & ((1<<b1)-1)) << (16+8-b1);
    result.push(rgb);
  }
  return result;
}

var currentPixelEditor;
var parentSource;
var parentOrigin;
var allimages;
var currentFormat;
var currentByteStr;
var currentPaletteStr;
var currentPaletteFmt;

function pixelEditorReceiveMessage(e) {
  console.log(e.data);
  parentSource = e.source;
  parentOrigin = e.origin;
  currentFormat = e.data.fmt;
  currentByteStr = e.data.bytestr;
  currentPaletteFmt = e.data.palfmt;
  currentPaletteStr = e.data.palstr;
  var bytes = parseHexBytes(e.data.bytestr);
  allimages = convertBytesToImages(bytes, e.data.fmt);
  var palette = [0xff000000, 0xffffffff]; // TODO
  if (currentPaletteStr) {
    var palbytes = parseHexBytes(e.data.palstr);
    var rr = Math.floor(Math.abs(currentPaletteFmt.pal/100) % 10);
    var gg = Math.floor(Math.abs(currentPaletteFmt.pal/10) % 10);
    var bb = Math.floor(Math.abs(currentPaletteFmt.pal) % 10);
    if (currentPaletteFmt.pal >= 0)
      palette = convertPaletteBytes(palbytes, 0, rr, rr, gg, rr+gg, bb);
    else
      palette = convertPaletteBytes(palbytes, rr+gg, bb, rr, gg, 0, rr);
  }
  currentPixelEditor = new PixelEditor(maineditor, e.data.fmt.w, e.data.fmt.h, palette, allimages[0]);
}

function postToParentWindow(data) {
  if (data.save) {
    allimages[0] = currentPixelEditor.getImageColors();
    data.bytes = convertImagesToBytes(allimages, currentFormat);
    data.bytestr = replaceHexBytes(currentByteStr, data.bytes);
  }
  parentSource.postMessage(data, "*");
}

function pixelEditorResize(e) {
  if (currentPixelEditor) {
    currentPixelEditor.resize();
  }
}

function pixelEditorKeypress(e) {
  if (!currentPixelEditor) return;
  var c = e.charCode;
  if (c >= 48 && c <= 57) {
    currentPixelEditor.setCurrentColor(c-48);
  } else if (c >= 97 && c <= 102) {
    currentPixelEditor.setCurrentColor(c-97+10);
  }
}
