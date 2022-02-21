
import { newDiv, ProjectView } from "./baseviews";
import { platform_id, current_project, projectWindows } from "../ui";
import { FileData } from "../../common/workertypes";
import { hex, safeident, rgb2bgr } from "../../common/util";
import * as pixed from "../pixeleditor";
import Mousetrap = require('mousetrap');

export class AssetEditorView implements ProjectView, pixed.EditorContext {
    maindiv : JQuery;
    cureditordiv : JQuery;
    cureditelem : JQuery;
    cureditnode : pixed.PixNode;
    rootnodes : pixed.PixNode[];
    deferrednodes : pixed.PixNode[];
  
    createDiv(parent : HTMLElement) {
      this.maindiv = newDiv(parent, "vertical-scroll");
      return this.maindiv[0];
    }
  
    clearAssets() {
      this.rootnodes = [];
      this.deferrednodes = [];
    }
  
    registerAsset(type:string, node:pixed.PixNode, deferred:number) {
      this.rootnodes.push(node);
      if (deferred) {
        if (deferred > 1)
          this.deferrednodes.push(node);
        else
          this.deferrednodes.unshift(node);
      } else {
        node.refreshRight();
      }
    }
  
    getPalettes(matchlen : number) : pixed.SelectablePalette[] {
      var result = [];
      this.rootnodes.forEach((node) => {
        while (node != null) {
          if (node instanceof pixed.PaletteFormatToRGB) {
            // TODO: move to node class?
            var palette = node.palette;
            // match full palette length?
            if (matchlen == palette.length) {
              result.push({node:node, name:"Palette", palette:palette});
            }
            // look at palette slices
            if (node.layout) {
              node.layout.forEach(([name, start, len]) => {
                if (start < palette.length) {
                  if (len == matchlen) {
                    var rgbs = palette.slice(start, start+len);
                    result.push({node:node, name:name, palette:rgbs});
                  } else if (-len == matchlen) { // reverse order
                    var rgbs = palette.slice(start, start-len);
                    rgbs.reverse();
                    result.push({node:node, name:name, palette:rgbs});
                  } else if (len+1 == matchlen) {
                    var rgbs = new Uint32Array(matchlen);
                    rgbs[0] = palette[0];
                    rgbs.set(palette.slice(start, start+len), 1);
                    result.push({node:node, name:name, palette:rgbs});
                  }
                }
              });
            }
            break;
          }
          node = node.right;
        }
      });
      return result;
    }
  
    getTilemaps(matchlen : number) : pixed.SelectableTilemap[] {
      var result = [];
      this.rootnodes.forEach((node) => {
        while (node != null) {
          if (node instanceof pixed.Palettizer) {
            var rgbimgs = node.rgbimgs;
            if (rgbimgs && rgbimgs.length >= matchlen) {
              result.push({node:node, name:"Tilemap", images:node.images, rgbimgs:rgbimgs}); // TODO
            }
          }
          node = node.right;
        }
      });
      return result;
    }
    
    isEditing() {
      return this.cureditordiv != null;
    }
    
    getCurrentEditNode() {
      return this.cureditnode;
    }
  
    setCurrentEditor(div:JQuery, editing:JQuery, node:pixed.PixNode) {
      const timeout = 250;
      if (this.cureditordiv != div) {
        if (this.cureditordiv) {
          this.cureditordiv.hide(timeout);
          this.cureditordiv = null;
        }
        if (div) {
          this.cureditordiv = div;
          this.cureditordiv.show();
          this.cureditordiv[0].scrollIntoView({behavior: "smooth", block: "center"});
          //setTimeout(() => { this.cureditordiv[0].scrollIntoView({behavior: "smooth", block: "center"}) }, timeout);
        }
      }
      if (this.cureditelem) {
        this.cureditelem.removeClass('selected');
        this.cureditelem = null;
      }
      if (editing) {
        this.cureditelem = editing;
        this.cureditelem.addClass('selected');
      }
      while (node.left) {
        node = node.left;
      }
      this.cureditnode = node;
    }
  
    scanFileTextForAssets(id : string, data : string) {
      // scan file for assets
      // /*{json}*/ or ;;{json};;
      // TODO: put before ident, look for = {
      var result = [];
      var re1 = /[/;][*;]([{].+[}])[*;][/;]/g;
      var m;
      while (m = re1.exec(data)) {
        var start = m.index + m[0].length;
        var end;
        // TODO: verilog end
        if (platform_id.includes('verilog')) {
          end = data.indexOf("end", start); // asm
        } else if (m[0].startsWith(';;')) {
          end = data.indexOf(';;', start); // asm
        } else {
          end = data.indexOf(';', start); // C
        }
        //console.log(id, start, end, m[1], data.substring(start,end));
        if (end > start) {
          try {
            var jsontxt = m[1].replace(/([A-Za-z]+):/g, '"$1":'); // fix lenient JSON
            var json = JSON.parse(jsontxt);
            // TODO: name?
            result.push({fileid:id,fmt:json,start:start,end:end});
          } catch (e) {
            console.log(e);
          }
        }
      }
      // look for DEF_METASPRITE_2x2(playerRStand, 0xd8, 0)
      // TODO: could also look in ROM
      var re2 = /DEF_METASPRITE_(\d+)x(\d+)[(](\w+),\s*(\w+),\s*(\w+)/gi;
      while (m = re2.exec(data)) {
        var width = parseInt(m[1]);
        var height = parseInt(m[2]);
        var ident = m[3];
        var tile = parseInt(m[4]);
        var attr = parseInt(m[5]);
        var metadefs = [];
        for (var x=0; x<width; x++) {
          for (var y=0; y<height; y++) {
            metadefs.push({x:x*8, y:y*8, tile:tile, attr:attr});
          }
        }
        var meta = {defs:metadefs,width:width*8,height:height*8};
        result.push({fileid:id,label:ident,meta:meta});
      }
      return result;
    }
  
    // TODO: move to pixeleditor.ts?
    addPaletteEditorViews(parentdiv:JQuery, pal2rgb:pixed.PaletteFormatToRGB, callback) {
      var adual = $('<div class="asset_dual"/>').appendTo(parentdiv);
      var aeditor = $('<div class="asset_editor"/>').hide(); // contains editor, when selected
      // TODO: they need to update when refreshed from right
      var allrgbimgs = [];
      pal2rgb.getAllColors().forEach((rgba) => { allrgbimgs.push(new Uint32Array([rgba])); }); // array of array of 1 rgb color (for picker)
      var atable = $('<table/>').appendTo(adual);
      aeditor.appendTo(adual);
      // make default layout if not exists
      var layout = pal2rgb.layout;
      if (!layout) {
        var len = pal2rgb.palette.length;
        var imgsperline = len > 32 ? 8 : 4; // TODO: use 'n'?
        layout = [];
        for (var i=0; i<len; i+=imgsperline) {
          layout.push(["", i, Math.min(len-i,imgsperline)]);
        }
      }
      function updateCell(cell, j) {
        var val = pal2rgb.words[j];
        var rgb = pal2rgb.palette[j];
        var hexcol = '#'+hex(rgb2bgr(rgb),6);
        var textcol = (rgb & 0x008000) ? 'black' : 'white';
        cell.text(hex(val,2)).css('background-color',hexcol).css('color',textcol);
      }
      // iterate over each row of the layout
      layout.forEach( ([name, start, len]) => {
        if (start < pal2rgb.palette.length) { // skip row if out of range
          var arow = $('<tr/>').appendTo(atable);
          $('<td/>').text(name).appendTo(arow);
          var inds = [];
          for (var k=start; k<start+Math.abs(len); k++)
            inds.push(k);
          if (len < 0)
            inds.reverse();
          inds.forEach( (i) => {
            var cell = $('<td/>').addClass('asset_cell asset_editable').appendTo(arow);
            updateCell(cell, i);
            cell.click((e) => {
              var chooser = new pixed.ImageChooser();
              chooser.rgbimgs = allrgbimgs;
              chooser.width = 1;
              chooser.height = 1;
              chooser.recreate(aeditor, (index, newvalue) => {
                callback(i, index);
                updateCell(cell, i);
              });
              this.setCurrentEditor(aeditor, cell, pal2rgb);
            });
          });
        }
      });
    }
  
    addPixelEditor(parentdiv:JQuery, firstnode:pixed.PixNode, fmt:pixed.PixelEditorImageFormat) {
      // data -> pixels
      fmt.xform = 'scale(2)';
      var mapper = new pixed.Mapper(fmt);
      // TODO: rotate node?
      firstnode.addRight(mapper);
      // pixels -> RGBA
      var palizer = new pixed.Palettizer(this, fmt);
      mapper.addRight(palizer);
      // add view objects
      palizer.addRight(new pixed.CharmapEditor(this, newDiv(parentdiv), fmt));
    }
  
    addPaletteEditor(parentdiv:JQuery, firstnode:pixed.PixNode, palfmt?) {
      // palette -> RGBA
      var pal2rgb = new pixed.PaletteFormatToRGB(palfmt);
      firstnode.addRight(pal2rgb);
      // TODO: refresh twice?
      firstnode.refreshRight();
      // TODO: add view objects
      // TODO: show which one is selected?
      this.addPaletteEditorViews(parentdiv, pal2rgb,
        (index, newvalue) => {
          console.log('set entry', index, '=', newvalue);
          // TODO: this forces update of palette rgb colors and file data
          firstnode.words[index] = newvalue;
          pal2rgb.words = null;
          pal2rgb.updateRight();
          pal2rgb.refreshLeft();
        });
    }
  
    ensureFileDiv(fileid : string) : JQuery<HTMLElement> {
      var divid = this.getFileDivId(fileid);
      var body = $(document.getElementById(divid));
      if (body.length === 0) {
        var filediv = newDiv(this.maindiv, 'asset_file');
        var header = newDiv(filediv, 'asset_file_header').text(fileid);
        body = newDiv(filediv).attr('id',divid).addClass('disable-select');
      }
      return body;
    }
  
    refreshAssetsInFile(fileid : string, data : FileData) : number {
      let nassets = 0;
      // TODO: check fmt w/h/etc limits
      // TODO: defer editor creation
      // TODO: only refresh when needed
      if (platform_id.startsWith('nes') && fileid.endsWith('.chr') && data instanceof Uint8Array) {
        // is this a NES CHR?
        let node = new pixed.FileDataNode(projectWindows, fileid);
        const neschrfmt = {w:8,h:8,bpp:1,count:(data.length>>4),brev:true,np:2,pofs:8,remap:[0,1,2,4,5,6,7,8,9,10,11,12]}; // TODO
        this.addPixelEditor(this.ensureFileDiv(fileid), node, neschrfmt);
        this.registerAsset("charmap", node, 1);
        nassets++;
      } else if (platform_id.startsWith('nes') && fileid.endsWith('.pal') && data instanceof Uint8Array) {
        // is this a NES PAL?
        let node = new pixed.FileDataNode(projectWindows, fileid);
        const nespalfmt = {pal:"nes",layout:"nes"};
        this.addPaletteEditor(this.ensureFileDiv(fileid), node, nespalfmt);
        this.registerAsset("palette", node, 0);
        nassets++;
      } else if (typeof data === 'string') {
        let textfrags = this.scanFileTextForAssets(fileid, data);
        for (let frag of textfrags) {
          if (frag.fmt) {
            let label = fileid; // TODO: label
            let node : pixed.PixNode = new pixed.TextDataNode(projectWindows, fileid, label, frag.start, frag.end);
            let first = node;
            // rle-compressed? TODO: how to edit?
            if (frag.fmt.comp == 'rletag') {
              node = node.addRight(new pixed.Compressor());
            }
            // is this a nes nametable?
            if (frag.fmt.map == 'nesnt') {
              node = node.addRight(new pixed.NESNametableConverter(this));
              node = node.addRight(new pixed.Palettizer(this, {w:8,h:8,bpp:4}));
              const fmt = {w:8*(frag.fmt.w||32),h:8*(frag.fmt.h||30),count:1}; // TODO: can't do custom sizes
              node = node.addRight(new pixed.MapEditor(this, newDiv(this.ensureFileDiv(fileid)), fmt));
              this.registerAsset("nametable", first, 2);
              nassets++;
            }
            // is this a bitmap?
            else if (frag.fmt.w > 0 && frag.fmt.h > 0) {
              this.addPixelEditor(this.ensureFileDiv(fileid), node, frag.fmt);
              this.registerAsset("charmap", first, 1);
              nassets++;
            }
            // is this a palette?
            else if (frag.fmt.pal) {
              this.addPaletteEditor(this.ensureFileDiv(fileid), node, frag.fmt);
              this.registerAsset("palette", first, 0);
              nassets++;
            }
            else {
              // TODO: other kinds of resources?
            }
          }
        }
      }
      return nassets;
    }
  
    getFileDivId(id : string) {
      return '__asset__' + safeident(id);
    }
  
  // TODO: recreate editors when refreshing
  // TODO: look for changes, not moveCursor
    refresh(moveCursor : boolean) {
      // clear and refresh all files/nodes?
      if (moveCursor) {
        this.maindiv.empty();
        this.clearAssets();
        current_project.iterateFiles((fileid, data) => {
          try {
            var nassets = this.refreshAssetsInFile(fileid, data);
          } catch (e) {
            console.log(e);
            this.ensureFileDiv(fileid).text(e+""); // TODO: error msg?
          }
        });
        console.log("Found " + this.rootnodes.length + " assets");
        this.deferrednodes.forEach((node) => {
          try {
            node.refreshRight();
          } catch (e) {
            console.log(e);
            alert(e+"");
          }
        });
        this.deferrednodes = [];
      } else {
        // only refresh nodes if not actively editing
        // since we could be in the middle of an operation that hasn't been committed
        for (var node of this.rootnodes) {
          if (node !== this.getCurrentEditNode()) {
            node.refreshRight();
          }
        }
      }
    }
  
    setVisible?(showing : boolean) : void {
      // TODO: make into toolbar?
      if (showing) {
        if (Mousetrap.bind) Mousetrap.bind('ctrl+z', projectWindows.undoStep.bind(projectWindows));
      } else {
        if (Mousetrap.unbind) Mousetrap.unbind('ctrl+z');
      }
    }
  
  }
  
