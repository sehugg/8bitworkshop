
import { hex } from "../util";

// TODO: outline, gradient, pixel colors (>=2 bpp), proportional fonts, select C/ASM output, fine offset

var font;

declare var FONTLIST : string;

var FONT_DEFAULT_PARAMS = {
    bpp:1,
    np:1,
    wbytes:1,
    width:8,
    height:8,
    yoffset:0,
    lochar:32,
    hichar:127,
    rotate:false,
    xflip:false,
    yflip:false,
    msbfirst:false,
    output:'c_nested',
};

var params;

var errors;

var previewCanvas = $("#previewCanvas");
var codeTextarea = $("#codeTextarea");
var paramsForm = $("#paramsForm");

var FONT_PRESETS = {
      _8x8: { },
    apple2: { width:7 },
       vcs: { output:'dasm', msbfirst:true },
  mw8080bw: { rotate:true, flip:true, msbfirst:true },
       nes: { np:2, msbfirst:true },
 astrocade: { output:'zmac', msbfirst:true },
};

function loadPreset(preset_id) {
  params = $.extend({}, FONT_DEFAULT_PARAMS, FONT_PRESETS[preset_id]);
  refreshToolbar();
}

function updateToolbarValue(event, id:string) {
  event.item = w2ui.toolbar.get(id);
  event.item.value = event.target.value;
  refreshToolbar(event);
}

function refreshToolbar(event?) {
  // update params from toolbar item?
  console.log(event);
  if (event && event.item) {
    switch (event.item.id) {
      case 'width':
      case 'height':
      case 'lochar':
      case 'hichar':
      case 'yoffset':
        params[event.item.id] = parseInt(event.item.value);
        break;
      case 'rotate':
      case 'xflip':
      case 'yflip':
      case 'msbfirst':
        params[event.item.id] = event.item.checked;
        break;
      case 'bpp':
        if (event.subItem)
          params[event.item.id] = parseInt(event.subItem.text);
        break;
      case 'preset':
        if (event.subItem)
          loadPreset(event.subItem.id);
        break;
      case 'charsel':
        if (event.subItem)
          loadCharSel(event.subItem.id);
        break;
      case 'output':
        if (event.subItem)
          params[event.item.id] = event.subItem.id;
        break;
    }
  }
  // set derived params
  params.wbytes = Math.floor((params.width*params.bpp+7)/8);
  // set toolbar items
  Object.keys(params).forEach(function(key) {
    var val = params[key];
    var item = w2ui.toolbar.get(key);
    switch (item && item.type) {
      case 'check': item.checked = val; break;
      case 'html': item.value = val; break;
      case 'menu-radio': item.selected = val; break;
    }
  });
  w2ui.toolbar.refresh();
  updateEncoding();
  previewFont();
}

function loadCharSel(id) {
  var toks = id.split('-');
  params.lochar = parseInt(toks[0]);
  params.hichar = parseInt(toks[1]);
}

function parseBDF(text) {
    var chars = {};
    var chord;
    var ch;
    var lines = text.split(/\r?\n/);
    var bounds = [0,0,0,0];
    for (var i=0; i<lines.length; i++) {
        var l = lines[i];
        var toks = l.split(/\s+/);
        if (toks.length == 0) continue;
        switch (toks[0]) {
            case 'ENCODING':
                chord = parseInt(toks[1]);
                ch = {ord:chord};
                break;
            case 'BITMAP':
                ch.bytes = [];
                break;
            case 'BBX':
                if (ch) {
                    ch.bbx = toks.slice(1).map(function(s) { return parseInt(s); });
                    bounds[0] = Math.min(bounds[0], ch.bbx[2]);
                    bounds[1] = Math.min(bounds[1], ch.bbx[3]);
                    bounds[2] = Math.max(bounds[2], ch.bbx[2]+ch.bbx[0]);
                    bounds[3] = Math.max(bounds[3], ch.bbx[3]+ch.bbx[1]);
                }
                break;
            case 'ENDCHAR':
                chars[chord] = ch;
                ch = null;
                break;
            default:
                if (ch && ch.bytes && toks.length == 1) {
                    var n = parseInt(toks[0], 16);
                    n <<= (6-toks[0].length) * 4;
                    ch.bytes.push(n);
                }
                break;
        }
    }
    return {chars:chars,bounds:bounds,pixbounds:[0,0,0,0]};
}

function loadFont(rec) {
    font = {};
    var path = '../fonts/' + rec.path;
    $.get(path, function(text) {
        font = parseBDF(text);
        font.rec = rec;
        font.path = path;
        console.log(font);
        updateEncoding();
        previewFont();
    });
}

function updateEncoding() {
  if (font) {
    codeTextarea.text(encodeFont());
  }
}

function renderGlyph(glyph, putPixel) {
  if (glyph.ord < params.lochar || glyph.ord > params.hichar)
    return {w:8,h:8};
  var w = glyph.bbx[0];
  var h = glyph.bbx[1];
  var dx = glyph.bbx[2];
  var dy = glyph.bbx[3];
  var error_logged = false;
  for (var y=0; y<glyph.bytes.length; y++) {
      for (var x=0; x<w; x++) {
          if (glyph.bytes[glyph.bytes.length-y-1] & (0x800000 >> x)) {
              var xx = x+dx;
              var yy = y+dy;
              yy += params.yoffset || 0;
              var xoutrange = xx < 0 || x >= params.width;
              var youtrange = yy < 0 || y >= params.height;
              if (!xoutrange && !youtrange) {
                putPixel(xx, yy);
              } else if (!error_logged) {
                errors.push((xoutrange?"X":"Y") + " out of range on character " + String.fromCharCode(glyph.ord) + " " + x + "," + y);
                error_logged = true;
              }
          }
      }
  }
  return {w:w+dx,h:h+dy};
}

function drawChar(x0, y0, chord) {
    var ctx = (previewCanvas[0] as any).getContext('2d');
    ctx.fillStyle = "black";
    var glyph = font.chars[chord];
    if (glyph) {
        return renderGlyph(glyph, function(x,y) {
          ctx.fillRect( x0+x, y0-y, 1, 1 );
        });
    } else {
        return {w:8,h:8}; // TODO: avgwidth, height
    }
}

function drawString(x, y, str) {
    for (var i=0; i<str.length; i++) {
        x += drawChar(x, y, str.charCodeAt(i)).w+1;
    }
}

var TEST_SENTENCES = [
    "0123456789 ABCDEFGHIJKLMNOPQRSTUVWXYZ",
    "!@#$%^&*()+ -- == [] {} <>?,./;':\"",
    "THE QUICK BROWN FOX JUMPS OVER THE LAZY DOG'S BOWL",
    "the quick brown fox jumps over the lazy dog's bowl",
    //"Pack my box with five dozen liquor jugs.",
];

function previewFont() {
    if (!font) return;
    var ctx = (previewCanvas[0] as any).getContext('2d');
    ctx.fillStyle = "white";
    ctx.fillRect( 0, 0, 1024, 1024 );
    var x = 8;
    var y = 8;
    //console.log(font);
    TEST_SENTENCES.forEach(function(s) {
        y += font.rec.pixelsize + 1;
        drawString(x, y, s);
    });
}

function encodeGlyph(glyph, bytes) {
    var abort = false;
    renderGlyph(glyph, function(x,y) {
        if (params.yflip) { y = params.height-1-y; }
        if (params.xflip ^ params.rotate) { x = params.width-1-x; }
        if (params.rotate) {
           var y2 = x; var x2 = y; x = x2; y = y2;
        }
        var xoutrange = (x <  0 || x >= params.width);
        var youtrange = (y <  0 || y >= params.height);
        var bpb = 8 / (params.bpp||1);
        var ofs = Math.floor(x/bpb) + (params.height-1-y)*params.wbytes;
        var bit = x % bpb;
        if (params.msbfirst) { bit = 7-bit; }
        bytes[ofs] |= 1<<bit;
    });
}

function encodeFont() {
    var s = '';
    var c_output = params.output.startsWith('c_');
    if (c_output) {
      //s += '/* ' + JSON.stringify(params) + JSON.stringify(font.bounds) + JSON.stringify(font.pixbounds) + ' */\n';
      s += "#define LOCHAR " + params.lochar + "\n";
      s += "#define HICHAR " + params.hichar + "\n";
      s += "#define FONT_BWIDTH " + (params.wbytes*params.np) + "\n";
      s += "#define FONT_HEIGHT " + params.height + "\n";
      s += "const char FONT[HICHAR-LOCHAR+1][FONT_HEIGHT*FONT_BWIDTH] = {\n";
    } else {
      s += "LOCHAR\t\tequ " + params.lochar + "\n";
      s += "HICHAR\t\tequ " + params.hichar + "\n";
      s += "FONT_HEIGHT\tequ " + params.height + "\n";
      s += "FontData:\n";
    }
    errors = [];
    for (var chord=params.lochar; chord<=params.hichar; chord++) {
        var glyph = font.chars[chord];
        var bytes = new Uint8Array(params.wbytes*params.height*params.np);
        if (glyph) {
            encodeGlyph(glyph, bytes);
            if (params.output=='c_nested') s += "{ ";
            else if (params.output=='dasm') s += "\thex\t";
            else if (params.output=='zmac') s += "\tdb\t";
            for (var i=0; i<bytes.length; i++) {
              if (params.output == 'dasm')
                s += hex(bytes[i]);
              else
                s += "0x" + hex(bytes[i]) + ((i<bytes.length-1)?",":"");
            }
            if (params.output=='c_nested') s += " },";
            if (!c_output || params.newline) s += "\n";
        }
    }
    if (c_output) s += "};\n";
    while (errors.length) {
      if (c_output)
        s = "/* " + errors.pop() + " */\n" + s;
      else
        s = ";; " + errors.pop() + "\n" + s;
    }
    return s;
}

/////

var FONTRECS = [];

var li = 0;
for (var line of FONTLIST.split("\n")) {
    var ltoks = line.split("|");
    if (ltoks.length < 2)
      continue;
    var ftoks = ltoks[1].split("-");
    var rec = {
            recid: ++li,
             path: ltoks[0],
          foundry: ftoks[1],
           family: ftoks[2],
           weight: ftoks[3].toLowerCase(),
            slant: ftoks[4].toUpperCase(),
         setwidth: ftoks[5],
         addstyle: ftoks[6],
        pixelsize: parseInt(ftoks[7]),
        pointsize: parseInt(ftoks[8]),
             resx: parseInt(ftoks[9]),
             resy: parseInt(ftoks[10]),
          spacing: ftoks[11].toUpperCase(),
         avgwidth: parseFloat(ftoks[12])/10,
         registry: ftoks[13],
         encoding: ftoks[14],
    };
    FONTRECS.push(rec);
}

function toolbarHTMLItem(id, title, maxchars) {
    return function(item) {
        var html = '<div style="padding: 3px 5px;">' + title + '&nbsp;' +
            '<input size=' + maxchars + ' maxlength=' + maxchars +
            ' onchange="updateToolbarValue(event, \'' + id + '\');" '+
            ' value="'+ (item.value || '') + '"/></div>';
        return html;
    };
}

$().w2toolbar({
	name: 'toolbar',
	onClick: function(event) {
	  // TODO?
	  setTimeout(function() { refreshToolbar(event); }, 1);
	},
	tooltip: 'bottom',
	items: [
		{ type: 'menu-radio', id: 'preset', caption: 'Presets', img: 'icon-folder',
		  tooltip: 'Preset encoding options for specific platforms',
		  //text: function(item) { refreshPreset(item); return item.caption; },
		  items: [
			 { text: 'Generic C 8x8', id: '_8x8' }, 
			 { text: 'Atari 2600',    id: 'vcs' }, 
			 { text: 'Midway 8080',   id: 'mw8080bw' }, 
			 { text: 'NES',           id: 'nes' },
			 { text: 'Apple ][',    	id: 'apple2' },
			 { text: 'Astrocade',    	id: 'astrocade' },
		  ]},
		{ type: 'check',  id: 'rotate', caption: 'Rotate', img: 'fas fa-sync', tooltip: 'Rotate 90 degrees (swap X/Y)' },
		{ type: 'check',  id: 'xflip', caption: 'Mirror', img: 'fas fa-arrows-alt-h', tooltip: 'Flip X axis' },
		{ type: 'check',  id: 'yflip', caption: 'Flip', img: 'fas fa-arrows-alt-v', tooltip: 'Flip Y axis' },
		{ type: 'check',  id: 'msbfirst', caption: 'MSB First', img: 'fas fa-arrow-alt-circle-right', tooltip: 'If selected, MSB (left) to LSB (right)' },
		{ type: 'menu-radio', id: 'bpp', caption: 'BPP', img: 'fas fa-dice-one', tooltip: 'Bits per pixel',
		  items: [
			 { text: '1' }, 
			 { text: '2' }, 
			 { text: '4' },
			 { text: '8' }
  		]},
		{ type: 'html', id: 'width', html: toolbarHTMLItem('width','Width:',2) },
		{ type: 'html', id: 'height', html: toolbarHTMLItem('height','Height:',2) },
		{ type: 'html', id: 'yoffset', html: toolbarHTMLItem('yoffset','Y Offset:',2) },
		{ type: 'menu-radio', id: 'output', caption: 'Output', img: 'icon-folder',
		  tooltip: 'Output format',
		  items: [
			 { text: 'C array (nested)', id: 'c_nested' }, 
			 { text: 'C array (flat)',   id: 'c_flat' }, 
			 { text: 'Assembler (DASM)', id: 'dasm' }, 
			 { text: 'Assembler (zmac)', id: 'zmac' },
		  ]},
		{ type: 'break', id: 'break1' },
		
		{ type: 'menu-radio', id: 'charsel', caption: 'Chars', img: 'icon-folder', 
		  tooltip: 'Range of characters to encode, from first to last',
		  items: [
			 //{ text: 'ISO (256 chars)', value:'0-255' }, 
			 { text: 'ASCII (upper only)', id:'32-95' }, 
			 { text: 'ASCII (upper+lower)', id:'32-127' }
		  ]},
		{ type: 'html', id: 'lochar', html: toolbarHTMLItem('lochar','First:',3) },
		{ type: 'html', id: 'hichar', html: toolbarHTMLItem('hichar','Last:',3) },
		/*	
		{ type: 'spacer' },
		{ type: 'button',  id: 'item5',  caption: 'Item 5', icon: 'fa-home' }
		*/
	]
});
    
$().w2grid({ 
    name   : 'fontGrid',
    show   : {
        toolbar : true
    },
    multiSearch: true,
    searches: [
        { field: 'weight', caption: 'Weight', type: 'list', options: { items: ['medium','bold','narrow']} },
        { field: 'slant', caption: 'Slant', type: 'list', options: { items: ['R','O']} },
        { field: 'spacing', caption: 'Spacing', type: 'list', options: { items: ['C','M','P']} },
        { field: 'pixelsize', caption: 'Pixel Size', type: 'int' },
        { field: 'avgwidth', caption: 'Avg. Width', type: 'int' },
    ],
    columns: [
        { field: 'foundry', caption: 'Foundry', size: '20%', sortable:true },
        { field: 'family', caption: 'Family', size: '20%', sortable:true },
        { field: 'weight', caption: 'Weight', size: '10%', sortable:true },
        { field: 'slant', caption: 'Slant', size: '10%', sortable:true },
        { field: 'pixelsize', caption: 'Pixel Size', size: '10%', sortable:true },
        { field: 'avgwidth', caption: 'Avg. Width', size: '10%', sortable:true },
        { field: 'spacing', caption: 'Spacing', size: '10%', sortable:true },
    ],
    records: FONTRECS,
    onClick: function (event) {
        var record = this.get(event.recid);
        loadFont(record);
    },
});

var pstyle = 'background-color: #F5F6F7; border: 1px solid #dfdfdf; padding: 5px;';
$('#layout').w2layout({
    name: 'layout',
    panels: [
        { type: 'top',  size: 50, resizable: false, style: pstyle, content: 'top' },
//        { type: 'left', size: 200, resizable: true, style: pstyle, content: paramsForm },
        { type: 'main', style: pstyle, content: codeTextarea },
        { type: 'preview', size: '50%', resizable: true, style: pstyle, content: previewCanvas },
        { type: 'left', size: '25%', resizable: true, style: pstyle, content: $("#instructions") },
        { type: 'bottom', size: 200, resizable: true, style: pstyle, content: 'bottom' }
    ]
});

w2ui['layout'].content('top', w2ui['toolbar']);
w2ui['layout'].content('bottom', w2ui['fontGrid']);

loadPreset('_8x8');
