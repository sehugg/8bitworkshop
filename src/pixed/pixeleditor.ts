"use strict";

import { hex, rgb2bgr, rle_unpack } from "../util";
import { ProjectWindows } from "../windows";

export type UintArray = number[] | Uint8Array | Uint16Array | Uint32Array; //{[i:number]:number};

// TODO: separate view/controller
export interface EditorContext {
  setCurrentEditor(div:JQuery, editing:JQuery) : void;
  getPalettes(matchlen : number) : SelectablePalette[];
  getTilemaps(matchlen : number) : SelectableTilemap[];
}

export type SelectablePalette = {
  node:PixNode
  name:string
  palette:Uint32Array
}

export type SelectableTilemap = {
  node:PixNode
  name:string
  images:Uint8Array[]
  rgbimgs:Uint32Array[] // TODO: different palettes?
}

export type PixelEditorImageFormat = {
  w:number
  h:number
  count?:number
  bpp?:number
  np?:number
  bpw?:number
  sl?:number
  pofs?:number
  remap?:number[]
  brev?:boolean
  destfmt?:PixelEditorImageFormat
  xform?:string
};

export type PixelEditorPaletteFormat = {
  pal?:number|string
  n?:number
  layout?:string
};

export type PixelEditorPaletteLayout = [string, number, number][];

type PixelEditorMessage = {
  fmt : PixelEditorImageFormat
  palfmt : PixelEditorPaletteFormat
  bytestr : string
  palstr : string
};

export function PixelEditor(parentDiv:HTMLElement,
                            fmt:PixelEditorImageFormat,
                            palette:Uint32Array,
                            initialData:Uint32Array,
                            thumbnails?) {
  var width = fmt.w;
  var height = fmt.h;

  function createCanvas() {
    var c = document.createElement('canvas');
    c.width = width;
    c.height = height;
    if (fmt.xform) c.style.transform = fmt.xform;
    c.classList.add("pixels");
    c.classList.add("pixelated");
    //canvas.tabIndex = "-1";               // Make it focusable
    $(parentDiv).empty().append(c);
    return c;
  }

  function updateImage() {
    ctx.putImageData(pixdata, 0, 0);
  }

  function commit() {
    if (!thumbnails) return;
    for (var i=0; i<thumbnails.length; i++) {
      thumbnails[i].copyImageFrom(this);
    }
    initialData.set(this.getImageColors());
  }

  this.copyImageFrom = function(src) {
    pixints.set(src.getImageData());
    updateImage();
  }

  this.getImageData = function() { return pixints.slice(0); }

  function fitCanvas() {
    pixcanvas.style.height = '50%'; // TODO?
    return;
  }
  this.resize = fitCanvas;

  var pixcanvas = createCanvas();
  var ctx = pixcanvas.getContext('2d');
  var pixdata = ctx.createImageData(width, height);
  var pixints = new Uint32Array(pixdata.data.buffer);
  for (var i=0; i<pixints.length; i++) {
    pixints[i] = initialData ? palette[initialData[i]] : palette[0];
  }
  this.canvas = pixcanvas;

  updateImage();


  this.createPaletteButtons = function() {
    var span = $("#palette_group").empty();
    for (var i=0; i<palette.length; i++) {
      var btn = $('<button class="palbtn">');
      var rgb = palette[i] & 0xffffff;
      var color = "#" + hex(rgb2bgr(rgb), 6);
      btn.click(this.setCurrentColor.bind(this, i));
      btn.attr('id', 'palcol_' + i);
      btn.css('backgroundColor', color).text(i.toString(16));
      if ((rgb & 0x808080) != 0x808080) { btn.css('color', 'white'); }
      span.append(btn);
    }
    this.setCurrentColor(1);
  }

  function getPixelByOffset(ofs) {
    var oldrgba = pixints[ofs] & 0xffffff;
    for (var i=0; i<palette.length; i++) {
      if (oldrgba == (palette[i] & 0xffffff)) return i;
    }
    return 0;
  }

  function getPixel(x, y) {
    var ofs = x+y*width;
    return getPixelByOffset(ofs);
  }

  function setPixel(x, y, col) {
    if (x < 0 || x >= width || y < 0 || y >= height) return;
    var ofs = x+y*width;
    var oldrgba = pixints[ofs];
    var rgba = palette[col];
    if (oldrgba != rgba) {
      pixints[ofs] = rgba;
      updateImage();
    }
  }

  this.getImageColors = function() {
    var pixcols = new Uint8Array(pixints.length);
    for (var i=0; i<pixints.length; i++)
      pixcols[i] = getPixelByOffset(i);
    return pixcols;
  }

  ///

  this.makeEditable = function() {
    var curpalcol = -1;
    setCurrentColor(1);

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

    var dragcol = 1;
    var dragging = false;

    var pxls = $(pixcanvas);
    pxls.mousedown( (e) => {
      var pos = getPositionFromEvent(e);
      dragcol = getPixel(pos.x, pos.y) == curpalcol ? 0 : curpalcol;
      setPixel(pos.x, pos.y, curpalcol);
      dragging = true;
      // TODO: pixcanvas.setCapture();
    })
    .mousemove( (e) => {
      var pos = getPositionFromEvent(e);
      if (dragging) {
        setPixel(pos.x, pos.y, dragcol);
      }
    })
    .mouseup( (e) => {
      var pos = getPositionFromEvent(e);
      setPixel(pos.x, pos.y, dragcol);
      dragging = false;
      commit();
      // TODO: pixcanvas.releaseCapture();
    });
  }

  function setPixels(p) {
    var i = 0;
    for (var y=0; y<height; y++) {
      for (var x=0; x<width; x++) {
        setPixel(x, y, p[i++]);
      }
    }
  }

  this.rotate = function(deg) {
    console.log("rotate " + deg);
    var s1 = Math.sin(deg * Math.PI / 180);
    var c1 = Math.cos(deg * Math.PI / 180);
    var p = this.getImageColors();
    var i = 0;
    for (var y=0; y<height; y++) {
      for (var x=0; x<width; x++) {
        var xx = x + 0.5 - width/2.0;
        var yy = y + 0.5 - height/2.0;
        var xx2 = xx*c1 - yy*s1 + width/2.0 - 0.5;
        var yy2 = yy*c1 + xx*s1 + height/2.0 - 0.5;
        var col = getPixel(Math.round(xx2), Math.round(yy2));
        p[i++] = col;
      }
    }
    setPixels(p);
    commit();
  }

  this.flipy = function() {
    console.log("flipy");
    var p = this.getImageColors();
    var i = 0;
    for (var y=0; y<height; y++) {
      for (var x=0; x<width; x++) {
        var col = getPixel(x, height-1-y);
        p[i++] = col;
      }
    }
    setPixels(p);
    commit();
  }

  this.flipx = function() {
    console.log("flipx");
    var p = this.getImageColors();
    var i = 0;
    for (var y=0; y<height; y++) {
      for (var x=0; x<width; x++) {
        var col = getPixel(width-1-x, y);
        p[i++] = col;
      }
    }
    setPixels(p);
    commit();
  }
}

/////////////////

var pixel_re = /([0#]?)([x$%]|\d'[bh])([0-9a-f]+)/gi;

function convertToHexStatements(s:string) : string {
  // convert 'hex ....' asm format
  return s.replace(/(\shex\s+)([0-9a-f]+)/ig, function(m,hexprefix,hexstr) {
    var rtn = hexprefix;
    for (var i=0; i<hexstr.length; i+=2) {
      rtn += '0x'+hexstr.substr(i,2)+',';
    }
    return rtn;
  });
}

export function parseHexWords(s:string) : number[] {
  var arr = [];
  var m;
  while (m = pixel_re.exec(s)) {
    var n;
    if (m[2].startsWith('%') || m[2].endsWith("b"))
      n = parseInt(m[3],2);
    else if (m[2].startsWith('x') || m[2].startsWith('$') || m[2].endsWith('h'))
      n = parseInt(m[3],16);
    else
      n = parseInt(m[3]);
    arr.push(n);
  }
  return arr;
}

export function replaceHexWords(s:string, words:UintArray) : string {
  var result = "";
  var m;
  var li = 0;
  var i = 0;
  while (m = pixel_re.exec(s)) {
    result += s.slice(li, pixel_re.lastIndex - m[0].length);
    li = pixel_re.lastIndex;
    if (m[2].startsWith('%'))
      result += m[1] + "%" + words[i++].toString(2);
    else if (m[2].endsWith('b'))
      result += m[1] + m[2] + words[i++].toString(2); // TODO
    else if (m[2].endsWith('h'))
      result += m[1] + m[2] + words[i++].toString(16); // TODO
    else if (m[2].startsWith('x'))
      result += m[1] + "x" + hex(words[i++]);
    else if (m[2].startsWith('$'))
      result += m[1] + "$" + hex(words[i++]);
    else
      result += m[1] + words[i++].toString();
  }
  result += s.slice(li);
  // convert 'hex ....' asm format
  result = result.replace(/(\shex\s+)([,x0-9a-f]+)/ig, (m,hexprefix,hexstr) => {
    var rtn = hexprefix + hexstr;
    rtn = rtn.replace(/0x/ig,'').replace(/,/ig,'')
    return rtn;
  });
  return result;
}

function remapBits(x:number, arr:number[]) : number {
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

function convertWordsToImages(words:UintArray, fmt:PixelEditorImageFormat) : Uint8Array[] {
  var width = fmt.w;
  var height = fmt.h;
  var count = fmt.count || 1;
  var bpp = fmt.bpp || 1;
  var nplanes = fmt.np || 1;
  var bitsperword = fmt.bpw || 8;
  var wordsperline = fmt.sl || Math.ceil(width * bpp / bitsperword);
  var mask = (1 << bpp)-1;
  var pofs = fmt.pofs || wordsperline*height*count;
  var images = [];
  for (var n=0; n<count; n++) {
    var imgdata = [];
    for (var y=0; y<height; y++) {
      var ofs0 = n*wordsperline*height + y*wordsperline;
      var shift = 0;
      for (var x=0; x<width; x++) {
        var color = 0;
        var ofs = remapBits(ofs0, fmt.remap);
        for (var p=0; p<nplanes; p++) {
          var byte = words[ofs + p*pofs];
          color |= ((fmt.brev ? byte>>(bitsperword-shift-bpp) : byte>>shift) & mask) << (p*bpp);
        }
        imgdata.push(color);
        shift += bpp;
        if (shift >= bitsperword) {
          ofs0 += 1;
          shift = 0;
        }
      }
    }
    images.push(new Uint8Array(imgdata));
  }
  return images;
}

function convertImagesToWords(images:Uint8Array[], fmt:PixelEditorImageFormat) : number[] {
  if (fmt.destfmt) fmt = fmt.destfmt;
  var width = fmt.w;
  var height = fmt.h;
  var count = fmt.count || 1;
  var bpp = fmt.bpp || 1;
  var nplanes = fmt.np || 1;
  var bitsperword = fmt.bpw || 8;
  var wordsperline = fmt.sl || Math.ceil(fmt.w * bpp / bitsperword);
  var mask = (1 << bpp)-1;
  var pofs = fmt.pofs || wordsperline*height*count;
  var words;
  if (bitsperword <= 8)
    words = new Uint8Array(wordsperline*height*count*nplanes);
  else
    words = new Uint32Array(wordsperline*height*count*nplanes);
  for (var n=0; n<count; n++) {
    var imgdata = images[n];
    var i = 0;
    for (var y=0; y<height; y++) {
      var ofs0 = n*wordsperline*height + y*wordsperline;
      var shift = 0;
      for (var x=0; x<width; x++) {
        var color = imgdata[i++];
        var ofs = remapBits(ofs0, fmt.remap);
        for (var p=0; p<nplanes; p++) {
          var c = (color >> (p*bpp)) & mask;
          words[ofs + p*pofs] |= (fmt.brev ? (c << (bitsperword-shift-bpp)) : (c << shift));
        }
        shift += bpp;
        if (shift >= bitsperword) {
          ofs0 += 1;
          shift = 0;
        }
      }
    }
  }
  return words;
}

// TODO
function convertPaletteBytes(arr:UintArray,r0,r1,g0,g1,b0,b1) : number[] {
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

export var palette : Uint32Array;
export var paletteSets;
export var paletteSetIndex=0;
export var currentPixelEditor;
export var parentSource;
export var parentOrigin;
export var allimages;
export var currentFormat : PixelEditorImageFormat;
export var currentByteStr : string;
export var currentPaletteStr : string;
export var currentPaletteFmt : PixelEditorPaletteFormat;
export var allthumbs;

export function getPaletteLength(palfmt: PixelEditorPaletteFormat) : number {
  var pal = palfmt.pal;
  if (typeof pal === 'number') {
    var rr = Math.floor(Math.abs(pal/100) % 10);
    var gg = Math.floor(Math.abs(pal/10) % 10);
    var bb = Math.floor(Math.abs(pal) % 10);
    return 1<<(rr+gg+bb);
  } else {
    var paltable = PREDEF_PALETTES[pal];
    if (paltable) {
      return paltable.length;
    } else {
      throw new Error("No palette named " + pal);
    }
  }
}

function convertPaletteFormat(palbytes:UintArray, palfmt: PixelEditorPaletteFormat) : number[] {
  var pal = palfmt.pal;
  var newpalette;
  if (typeof pal === 'number') {
    var rr = Math.floor(Math.abs(pal/100) % 10);
    var gg = Math.floor(Math.abs(pal/10) % 10);
    var bb = Math.floor(Math.abs(pal) % 10);
    // TODO: n
    if (pal >= 0)
      newpalette = convertPaletteBytes(palbytes, 0, rr, rr, gg, rr+gg, bb);
    else
      newpalette = convertPaletteBytes(palbytes, rr+gg, bb, rr, gg, 0, rr);
  } else {
    var paltable = PREDEF_PALETTES[pal];
    if (paltable) {
      newpalette = new Uint32Array(palbytes).map((i) => { return paltable[i & (paltable.length-1)] | 0xff000000; });
    } else {
      throw new Error("No palette named " + pal);
    }
  }
  return newpalette;
}

export function pixelEditorDecodeMessage(e) {
  parentSource = e.source;
  parentOrigin = e.origin;
  let data : PixelEditorMessage = e.data;
  currentFormat = e.data.fmt;
  currentPaletteFmt = data.palfmt;
  currentPaletteStr = data.palstr;
  currentByteStr = convertToHexStatements(data.bytestr);
  var words = parseHexWords(currentByteStr);
  allimages = convertWordsToImages(words, data.fmt);
  var newpalette = [0xff000000, 0xffffffff]; // TODO
  if (currentPaletteStr) {
    var palbytes = parseHexWords(data.palstr);
    newpalette = convertPaletteFormat(palbytes, currentPaletteFmt) || newpalette;
    if (currentPaletteFmt.n) {
      paletteSets = [];
      for (var i=0; i<newpalette.length; i+=currentPaletteFmt.n) {
        paletteSets.push(newpalette.slice(i, i+currentPaletteFmt.n));
      }
      newpalette = paletteSets[paletteSetIndex = 0];
      // TODO: swap palettes
    }
  } else {
    var ncols = (currentFormat.bpp || 1) * (currentFormat.np || 1);
    switch (ncols) {
      case 2:
        newpalette = [0xff000000, 0xffff00ff, 0xffffff00, 0xffffffff];
        break;
      // TODO
    }
    // TODO: default palette?
  }
  palette = new Uint32Array(newpalette);
}

function pixelEditorCreateThumbnails(e) {
  // create thumbnail for all images
  $("#thumbnaildiv").empty();
  var parentdiv;
  var count = e.data.fmt.count || 1;
  allthumbs = [];
  for (var i=0; i<count; i++) {
    if ((i & 15) == 0) {
      parentdiv = $('<div class="thumbdiv">').appendTo("#thumbnaildiv");
    }
    allthumbs.push(createThumbnailForImage(parentdiv, i));
  }
}

function pixelEditorReceiveMessage(e) {
  pixelEditorDecodeMessage(e);
  pixelEditorCreateThumbnails(e);
  // create initial editor
  createEditorForImage(0);
}

function createThumbnailForImage(parentdiv, i) {
  var span = $('<span class="thumb">');
  var thumb = new PixelEditor(span[0] as HTMLElement, currentFormat, palette, allimages[i]);
  // double size of canvas thumbnail
  thumb.canvas.style.height = currentFormat.h*2+"px";
  thumb.canvas.style.width = currentFormat.w*2+"px";
  parentdiv.append(span);
  span.click(() => { createEditorForImage(i) });
  return thumb;
}

function createEditorForImage(i) {
  currentPixelEditor = new PixelEditor(document.getElementById('maineditor'), currentFormat, palette, allimages[i], [allthumbs[i]]);
  currentPixelEditor.resize();
  currentPixelEditor.makeEditable();
  currentPixelEditor.createPaletteButtons();
}

function postToParentWindow(data) {
  if (data.save) {
    var allimgs = [];
    for (var i=0; i<allthumbs.length; i++) {
      allimgs.push(allthumbs[i].getImageColors());
    }
    data.bytes = convertImagesToWords(allimgs, currentFormat);
    data.bytestr = replaceHexWords(currentByteStr, data.bytes);
  }
  if (parentSource) parentSource.postMessage(data, "*");
  return data;
}

function pixelEditorResize(e) {
  if (currentPixelEditor) {
    currentPixelEditor.resize();
  }
}

function pixelEditorKeypress(e) {
  if (!currentPixelEditor) return;
  //console.log(e);
  var c = e.charCode;
  if (c >= 48 && c <= 57) {
    currentPixelEditor.setCurrentColor(c-48);
  } else if (c >= 97 && c <= 102) {
    currentPixelEditor.setCurrentColor(c-97+10);
  } else {
    switch (e.keyCode) {
      case 82: // 'R'
        currentPixelEditor.rotate(-90);
        break;
      case 114: // 'r'
        currentPixelEditor.rotate(90);
        break;
      case 84: // 'T'
        currentPixelEditor.rotate(-45);
        break;
      case 116: // 't'
        currentPixelEditor.rotate(45);
        break;
    }
    switch (e.charCode) {
      case 104:
        currentPixelEditor.flipx();
        break;

        currentPixelEditor.flipy();
        break;
      default:
        console.log(e);
        break;
    }
  }
}

// TODO: illegal colors?
var PREDEF_PALETTES = {
  'nes':[
     0x525252, 0xB40000, 0xA00000, 0xB1003D, 0x740069, 0x00005B, 0x00005F, 0x001840, 0x002F10, 0x084A08, 0x006700, 0x124200, 0x6D2800, 0x000000, 0x000000, 0x000000,
     0xC4D5E7, 0xFF4000, 0xDC0E22, 0xFF476B, 0xD7009F, 0x680AD7, 0x0019BC, 0x0054B1, 0x006A5B, 0x008C03, 0x00AB00, 0x2C8800, 0xA47200, 0x000000, 0x000000, 0x000000,
     0xF8F8F8, 0xFFAB3C, 0xFF7981, 0xFF5BC5, 0xFF48F2, 0xDF49FF, 0x476DFF, 0x00B4F7, 0x00E0FF, 0x00E375, 0x03F42B, 0x78B82E, 0xE5E218, 0x787878, 0x000000, 0x000000,
     0xFFFFFF, 0xFFF2BE, 0xF8B8B8, 0xF8B8D8, 0xFFB6FF, 0xFFC3FF, 0xC7D1FF, 0x9ADAFF, 0x88EDF8, 0x83FFDD, 0xB8F8B8, 0xF5F8AC, 0xFFFFB0, 0xF8D8F8, 0x000000, 0x000000
   ]
};

var PREDEF_LAYOUTS : {[id:string]:PixelEditorPaletteLayout} = {
  'nes':[
    ['Screen Color',  0x00, 1],
    ['Background 1',  0x01, 3],
    ['Background 2',  0x05, 3],
    ['Background 3',  0x09, 3],
    ['Background 4',  0x0d, 3],
    ['Sprite 1',      0x11, 3],
    ['Sprite 2',      0x15, 3],
    ['Sprite 3',      0x19, 3],
    ['Sprite 4',      0x1d, 3]
  ],
};

/////

export abstract class PixNode {
  left : PixNode;		// toward text editor
  right : PixNode;		// toward pixel editor

  words? : UintArray;		// file data
  images? : Uint8Array[];	// array of indexed image data
  rgbimgs? : Uint32Array[];	// array of rgba imgages
  
  abstract updateLeft();	// update coming from right
  abstract updateRight();	// update coming from left
  
  refreshLeft() {
    var p : PixNode = this;
    while (p) {
      p.updateLeft();
      p = p.left;
    }
  }
  refreshRight() {
    var p : PixNode = this;
    while (p) {
      p.updateRight();
      p = p.right;
    }
  }
  addRight(node : PixNode) {
    this.right = node;
    node.left = this;
    return node;
  }
  addLeft(node : PixNode) {
    this.left = node;
    node.right = this;
    return node;
  }
}

abstract class CodeProjectDataNode extends PixNode {
  project : ProjectWindows;
  fileid : string;
  label : string;
  words : UintArray;
}

export class FileDataNode extends CodeProjectDataNode {
  
  constructor(project:ProjectWindows, fileid:string, data:Uint8Array) {
    super();
    this.project = project;
    this.fileid = fileid;
    this.label = fileid;
    this.words = data;
  }
  updateLeft() {
    if (this.project) {
      this.project.updateFile(this.fileid, this.words as Uint8Array);
    }
  }
  updateRight() {
  }
}

export class TextDataNode extends CodeProjectDataNode {
  text : string;
  start : number;
  end : number;

  constructor(project:ProjectWindows, fileid:string, label:string, text:string, start:number, end:number) {
    super();
    this.project = project;
    this.fileid = fileid;
    this.label = label;
    this.text = text;
    this.start = start;
    this.end = end;
  }  
  updateLeft() {
    // TODO: reload editors?
    var datastr = this.text.substring(this.start, this.end);
    datastr = replaceHexWords(datastr, this.words);
    this.text = this.text.substring(0, this.start) + datastr + this.text.substring(this.end);
    if (this.project) {
      this.project.updateFile(this.fileid, this.text);
      //this.project.replaceTextRange(this.fileid, this.start, this.end, datastr);
    }
  }
  updateRight() {
    var datastr = this.text.substring(this.start, this.end);
    datastr = convertToHexStatements(datastr); // TODO?
    var words = parseHexWords(datastr);
    this.words = words; //new Uint8Array(words); // TODO: 16/32?
  }
}

export class Compressor extends PixNode {

  words : UintArray;

  updateLeft() {
    // TODO: can't modify length of rle bytes
  }
  updateRight() {
    this.words = rle_unpack(new Uint8Array(this.left.words));
  }

}

export class Mapper extends PixNode {

  fmt : PixelEditorImageFormat;
  words : UintArray;
  images : Uint8Array[];
  
  updateLeft() {
    this.images = this.right.images;
    this.words = convertImagesToWords(this.images, this.fmt);
  }
  updateRight() {
    // convert each word array to images
    this.words = this.left.words;
    this.images = convertWordsToImages(this.words, this.fmt);
  }
}

class RGBAPalette {
  palcols;
  constructor(palcols : Uint32Array) {
    this.palcols = palcols;
  }
  indexOf(rgba : number) : number {
    return this.palcols.find(rgba);
  }
}

export class Palettizer extends PixNode {

  images : Uint8Array[];
  rgbimgs : Uint32Array[];
  palette : Uint32Array;
  
  ncolors : number;
  context : EditorContext;
  options : SelectablePalette[];
  selindex : number = 0;
  
// TODO: control to select palette for bitmaps

  constructor(context:EditorContext, fmt:PixelEditorImageFormat) {
    super();
    this.context = context;
    this.ncolors = 1 << ((fmt.bpp||1) * (fmt.np||1));
  }
  updateLeft() {
    this.rgbimgs = this.right.rgbimgs;
    var pal = new RGBAPalette(this.palette);
    this.images = this.rgbimgs.map( (im:Uint32Array) => {
      var out = new Uint8Array(im.length);
      for (var i=0; i<im.length; i++) {
        out[i] = pal.indexOf(im[i]);
      }
      return out;
    });
  }
  updateRight() {
    this.updatePalette();
    this.images = this.left.images;
    var mask = this.palette.length - 1; // must be power of 2
    // for each image, map bytes to RGB colors
    this.rgbimgs = this.images.map( (im:Uint8Array) => {
      var out = new Uint32Array(im.length);
      for (var i=0; i<im.length; i++) {
        out[i] = this.palette[im[i] & mask];
      }
      return out;
    });
  }
  updatePalette() {
    if (this.context != null) {
      this.options = this.context.getPalettes(this.ncolors);
      if (this.options && this.options.length > 0) {
        this.palette = this.options[this.selindex].palette;
      }
    }
    if (this.palette == null) {
      if (this.ncolors <= 2)
        this.palette = new Uint32Array([0xff000000, 0xffffffff]);
      else
        this.palette = new Uint32Array([0xff000000, 0xffff00ff, 0xffffff00, 0xffffffff]); // TODO: more palettes
    }
  }
}

function dedupPalette(cols : UintArray) : Uint32Array {
  var dup = new Map();
  var res = new Uint32Array(cols.length);
  var ndups = 0;
  for (var i=0; i<cols.length; i++) {
    var n = cols[i];
    while (dup[n]) {
      n ^= ++ndups;
    }
    res[i] = n;
    dup[n] = 1;
  }
  return res;
}

export class PaletteFormatToRGB extends PixNode {

  words : UintArray;
  rgbimgs : Uint32Array[];
  palette : Uint32Array;
  palfmt : PixelEditorPaletteFormat;
  layout : PixelEditorPaletteLayout;

  updateLeft() {
    //TODO
  }
  updateRight() {
    this.words = this.left.words;
    this.palette = dedupPalette(convertPaletteFormat(this.words, this.palfmt));
    this.layout = PREDEF_LAYOUTS[this.palfmt.layout];
    this.rgbimgs = [];
    this.palette.forEach( (rgba:number) => {
      this.rgbimgs.push(new Uint32Array([rgba]));
    });
  }
  getAllColors() {
    var arr = [];
    for (var i=0; i<getPaletteLength(this.palfmt); i++)
      arr.push(i);
    return convertPaletteFormat(arr, this.palfmt);
  }
}

export class NESNametableConverter extends PixNode {

  palette : Uint32Array;
  tilemap : Uint8Array[];	// tilemap images
  rgbimgs : Uint32Array[];	// output (1 image)
  width : number;
  height : number;
  cols : number;
  rows : number;
  baseofs : number;

  context : EditorContext;
  paloptions : SelectablePalette[];
  tileoptions : SelectableTilemap[];
  palindex : number = 0;
  tileindex : number = 0;

  constructor(context:EditorContext) {
    super();
    this.context = context;
  }
  updateLeft() {
    // TODO
  }  
  updateRight() {
    this.words = this.left.words;
    this.updatePalette();
    this.cols = 32;
    this.rows = 30;
    this.width = this.cols * 8;
    this.height = this.rows * 8;
    this.baseofs = 0;
    var idata = new Uint32Array(this.width * this.height);
    this.rgbimgs = [idata];
    var a = 0;
    var attraddr;
    for (var row=0; row<this.rows; row++) {
      for (var col=0; col<this.cols; col++) {
         var name = this.words[this.baseofs + a];
         var t = this.tilemap[name];
         attraddr = (a & 0x2c00) | 0x3c0 | (a & 0x0C00) | ((a >> 4) & 0x38) | ((a >> 2) & 0x07);
         var attr = this.words[attraddr];
         var tag = name ^ (attr<<9) ^ 0x80000000;
         var i = row*this.cols*8*8 + col*8;
         var j = 0;
         var attrshift = (col&2) + ((a&0x40)>>4);
         var coloradd = ((attr >> attrshift) & 3) << 2;
         for (var y=0; y<8; y++) {
           for (var x=0; x<8; x++) {
             var color = t[j++];
             if (color) color += coloradd;
             var rgb = this.palette[color];
             idata[i++] = rgb | 0xff000000;
           }
           i += this.cols*8-8;
         }
         a++;
      }
    }
    // TODO
  }
  updatePalette() {
    if (this.context != null) {
      this.paloptions = this.context.getPalettes(16);
      if (this.paloptions && this.paloptions.length > 0) {
        this.palette = this.paloptions[this.palindex].palette;
      }
      this.tileoptions = this.context.getTilemaps(256);
      if (this.tileoptions && this.tileoptions.length > 0) {
        this.tilemap = this.tileoptions[this.tileindex].images;
      }
    }
  }
}

///// UI CONTROLS

export class Viewer { // TODO: make PixNode

  width : number;
  height : number;
  canvas : HTMLCanvasElement;
  ctx : CanvasRenderingContext2D;
  pixdata : ImageData;

  recreate() {
    this.canvas = this.newCanvas();
    this.pixdata = this.ctx.createImageData(this.width, this.height);
  }

  createWith(pv : Viewer) {
    this.width = pv.width;
    this.height = pv.height;
    this.pixdata = pv.pixdata;
    this.canvas = this.newCanvas();
  }

  newCanvas() : HTMLCanvasElement {
    var c = document.createElement('canvas');
    c.width = this.width;
    c.height = this.height;
    //if (fmt.xform) c.style.transform = fmt.xform;
    c.classList.add("pixels");
    c.classList.add("pixelated");
    this.ctx = c.getContext('2d');
    return c;
  }

  updateImage(imdata : Uint32Array) {
    if (imdata) {
      new Uint32Array(this.pixdata.data.buffer).set(imdata);
    }
    this.ctx.putImageData(this.pixdata, 0, 0);
  }
}

export class ImageChooser {

  rgbimgs : Uint32Array[];
  width : number;
  height : number;
  
  recreate(parentdiv:JQuery, onclick) {
    var agrid = $('<div class="asset_grid"/>'); // grid (or 1) of preview images
    parentdiv.empty().append(agrid);
    var cscale = Math.max(2, Math.ceil(16/this.width)); // TODO
    var imgsperline = this.width <= 8 ? 16 : 8; // TODO
    var span = null;
    this.rgbimgs.forEach((imdata, i) => {
      var viewer = new Viewer();
      viewer.width = this.width;
      viewer.height = this.height;
      viewer.recreate();
      viewer.canvas.style.width = (viewer.width*cscale)+'px'; // TODO
      viewer.updateImage(imdata);
      $(viewer.canvas).addClass('asset_cell');
      $(viewer.canvas).click((e) => {
        onclick(i, viewer);
      });
      if (!span) {
        span = $('<span/>');
        agrid.append(span);
      }
      span.append(viewer.canvas);
      var brk = (i % imgsperline) == imgsperline-1;
      if (brk) {
        agrid.append($("<br/>"));
        span = null;
      }
    });
  }  
}

function newDiv(parent?, cls? : string) {
  var div = $(document.createElement("div"));
  if (parent) div.appendTo(parent)
  if (cls) div.addClass(cls);
  return div;
}

export class CharmapEditor extends PixNode {

  context;
  parentdiv;
  fmt;

  constructor(context:EditorContext, parentdiv:JQuery, fmt:PixelEditorImageFormat) {
    super();
    this.context = context;
    this.parentdiv = parentdiv;
    this.fmt = fmt;
  }
  
  updateLeft() { } // TODO
  
  updateRight() {
    this.rgbimgs = this.left.rgbimgs;
    var adual = newDiv(this.parentdiv.empty(), "asset_dual"); // contains grid and editor
    var agrid = newDiv(adual);
    var aeditor = newDiv(adual, "asset_editor").hide(); // contains editor, when selected
    // add image chooser grid
    var chooser = new ImageChooser();
    chooser.rgbimgs = this.rgbimgs;
    chooser.width = this.fmt.w || 1;
    chooser.height = this.fmt.h || 1;
    chooser.recreate(agrid, (index, viewer) => {
      var escale = Math.ceil(192 / this.fmt.w);
      var editview = new Viewer();
      editview.createWith(viewer);
      editview.updateImage(null);
      editview.canvas.style.width = (viewer.width*escale)+'px'; // TODO
      aeditor.empty().append(editview.canvas);
      this.context.setCurrentEditor(aeditor, $(viewer.canvas));
    });
    // add palette selector
    // TODO: only view when editing?
    var palizer = this.left;
    if (palizer instanceof Palettizer && palizer.options.length > 1) {
      var palselect = $(document.createElement('select'));
      palizer.options.forEach((palopt, i) => {
        // TODO: full identifier
        var sel = $(document.createElement('option')).text(palopt.name).val(i).appendTo(palselect);
        if (i == (palizer as Palettizer).selindex)
          sel.attr('selected','selected');
      });
      palselect.appendTo(agrid).change((e) => {
        var index = $(e.target).val() as number;
        (palizer as Palettizer).selindex = index;
        palizer.refreshRight();
      });
    }
  }

}

