
import { hex, rgb2bgr, safeident } from "../../common/util";
import { FileData } from "../../common/workertypes";
import * as pixed from "../pixeleditor";
import { current_project, platform_id, projectWindows } from "../ui";
import { newDiv, ProjectView } from "./baseviews";
import Mousetrap = require('mousetrap');

function getLineNumber(data: string, offset: number): number {
  let line = 1;
  for (let i = 0; i < offset && i < data.length; i++) {
    if (data[i] === '\n') line++;
  }
  return line;
}


export class AssetEditorView implements ProjectView, pixed.EditorContext {
  maindiv: JQuery;
  cureditordiv: JQuery;
  cureditelem: JQuery;
  cureditnode: pixed.PixNode;
  rootnodes: pixed.PixNode[];
  deferrednodes: pixed.PixNode[];
  createDiv(parent: HTMLElement) {
    this.maindiv = newDiv(parent, "vertical-scroll");
    return this.maindiv[0];
  }

  clearAssets() {
    this.rootnodes = [];
    this.deferrednodes = [];
  }

  registerAsset(type: string, node: pixed.PixNode, deferred: number) {
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

  getPalettes(matchlen: number): pixed.SelectablePalette[] {
    var result = [];
    this.rootnodes.forEach((node) => {
      while (node != null) {
        if (node instanceof pixed.PaletteFormatToRGB) {
          // TODO: move to node class?
          var palette = node.palette;
          // match full palette length?
          if (matchlen == palette.length) {
            result.push({ node: node, name: "Palette", palette: palette });
          }
          // look at palette slices
          if (node.layout) {
            node.layout.forEach(([name, start, len]) => {
              if (start < palette.length) {
                if (len == matchlen) {
                  var rgbs = palette.slice(start, start + len);
                  result.push({ node: node, name: name, palette: rgbs });
                } else if (-len == matchlen) { // reverse order
                  var rgbs = palette.slice(start, start - len);
                  rgbs.reverse();
                  result.push({ node: node, name: name, palette: rgbs });
                } else if (len + 1 == matchlen) {
                  var rgbs = new Uint32Array(matchlen);
                  rgbs[0] = palette[0];
                  rgbs.set(palette.slice(start, start + len), 1);
                  result.push({ node: node, name: name, palette: rgbs });
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

  getTilemaps(matchlen: number): pixed.SelectableTilemap[] {
    var result = [];
    this.rootnodes.forEach((node) => {
      while (node != null) {
        if (node instanceof pixed.Palettizer) {
          var rgbimgs = node.rgbimgs;
          if (rgbimgs && rgbimgs.length >= matchlen) {
            result.push({ node: node, name: "Tilemap", images: node.images, rgbimgs: rgbimgs }); // TODO
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

  setCurrentEditor(div: JQuery, editing: JQuery, node: pixed.PixNode) {
    const timeout = 250;
    if (this.cureditordiv != div) {
      if (this.cureditordiv) {
        this.cureditordiv.hide(timeout);
        this.cureditordiv = null;
      }
      if (div) {
        this.cureditordiv = div;
        this.cureditordiv.show();
        this.cureditordiv[0].scrollIntoView({ behavior: "smooth", block: "center" });
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
    this.updateHashForSelection(div);
  }

  updateHashForSelection(div: JQuery) {
    if (typeof window === 'undefined') return;
    var block = div ? div.closest('.asset_block[data-fileid]') : null;
    var fileid = block && block.attr('data-fileid');
    var startline = block && block.attr('data-startline');
    var hash = '#asseteditor';
    if (fileid && startline) {
      hash += '/' + encodeURIComponent(fileid) + '/' + startline;
    }
    if (window.location.hash !== hash) {
      history.replaceState(null, '', hash);
    }
  }

  scanFileTextForAssets(id: string, data: string) {
    // scan file for assets
    // /*{json}*/ or ;;{json};;
    // TODO: put before ident, look for = {
    var re1 = /[/;][*;]([{].+[}])[*;][/;]/g;
    var result = [];
    var m;
    while (m = re1.exec(data)) {
      var start = m.index + m[0].length;
      var end;
      // TODO: verilog end
      if (platform_id.includes('verilog')) {
        end = data.indexOf("end", start); // asm
      } else if (m[0].startsWith(';;')) {
        end = data.indexOf(';;', start); // asm
        if (end == data.indexOf(';;{', start)) {
          // ignore start of next asset
          end = -1;
        }
      } else {
        end = data.indexOf(';', start); // C
      }
      //console.log(id, start, end, m[1], data.substring(start,end));
      var startline = getLineNumber(data, m.index);
      var header = m[0];
      var endline = end >= 0 ? getLineNumber(data, end) : '???';
      if (end < 0) {
        var closingDelim = platform_id.includes('verilog') ? '"end"' : m[0].startsWith(';;') ? '";;"' : '";"';
        result.push({ fileid: id, header: header, startline: startline, endline: endline, error: `No closing ${closingDelim} found after asset header` });
      } else if (end <= start) {
        result.push({ fileid: id, header: header, startline: startline, endline: endline, error: `Empty data block after asset header` });
      } else {
        try {
          var jsontxt = m[1].replace(/([A-Za-z]+):/g, '"$1":'); // fix lenient JSON
          var json = JSON.parse(jsontxt);
          // TODO: name?
          result.push({ fileid: id, header: header, startline: startline, endline: endline, fmt: json, start: start, end: end });
        } catch (e) {
          result.push({ fileid: id, header: header, startline: startline, endline: endline, error: `Invalid asset format: ${e.message}` });
        }
      }
    }
    // look for DEF_METASPRITE_2x2(playerRStand, 0xd8, 0)
    // TODO: this feature was never implemented, it would require a totally new type of editor and stuff
    /*
    var re2 = /DEF_METASPRITE_(\d+)x(\d+)[(](\w+),\s*(\w+),\s*(\w+)/gi;
    while (m = re2.exec(data)) {
      var width = parseInt(m[1]);
      var height = parseInt(m[2]);
      var ident = m[3];
      var tile = parseInt(m[4]);
      var attr = parseInt(m[5]);
      var metadefs = [];
      for (var x = 0; x < width; x++) {
        for (var y = 0; y < height; y++) {
          metadefs.push({ x: x * 8, y: y * 8, tile: tile, attr: attr });
        }
      }
      var meta = { defs: metadefs, width: width * 8, height: height * 8 };
      result.push({ fileid: id, label: ident, meta: meta });
    }
    */
    // TODO: look for decode <ident> --- ... ---
    /*
    var re3 = /\bdecode\s+(\w+)\s*---(.+?)---/gims;
    while (m = re3.exec(data)) {
    }
    */
    return result;
  }

  // TODO: move to pixeleditor.ts?
  addPaletteEditorViews(parentdiv: JQuery, pal2rgb: pixed.PaletteFormatToRGB, callback): () => void {
    var adual = $('<div class="asset_dual"/>').appendTo(parentdiv);
    var aeditor = $('<div class="asset_editor"/>').hide(); // contains editor, when selected
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
      for (var i = 0; i < len; i += imgsperline) {
        layout.push(["", i, Math.min(len - i, imgsperline)]);
      }
    }
    var cells: { cell: JQuery, index: number }[] = [];
    function updateCell(cell, j) {
      var val = pal2rgb.words[j];
      var rgb = pal2rgb.palette[j];
      var hexcol = '#' + hex(rgb2bgr(rgb), 6);
      var textcol = (rgb & 0x008000) ? 'black' : 'white';
      cell.text(hex(val, 2)).css('background-color', hexcol).css('color', textcol);
    }
    function updateAllCells() {
      cells.forEach(({ cell, index }) => updateCell(cell, index));
    }
    // iterate over each row of the layout
    layout.forEach(([name, start, len]) => {
      if (start < pal2rgb.palette.length) { // skip row if out of range
        var arow = $('<tr/>').appendTo(atable);
        $('<td/>').text(name).appendTo(arow);
        var inds = [];
        for (var k = start; k < start + Math.abs(len); k++)
          inds.push(k);
        if (len < 0)
          inds.reverse();
        inds.forEach((i) => {
          var cell = $('<td/>').addClass('asset_cell asset_editable').appendTo(arow);
          cells.push({ cell, index: i });
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
    return updateAllCells;
  }

  addPixelEditor(parentdiv: JQuery, firstnode: pixed.PixNode, fmt: pixed.PixelEditorImageFormat) {
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

  addPaletteEditor(parentdiv: JQuery, firstnode: pixed.PixNode, palfmt?) {
    // palette -> RGBA
    var pal2rgb = new pixed.PaletteFormatToRGB(palfmt);
    firstnode.addRight(pal2rgb);
    // TODO: refresh twice?
    firstnode.refreshRight();
    var updateAllCells = this.addPaletteEditorViews(parentdiv, pal2rgb,
      (index, newvalue) => {
        console.log('set entry', index, '=', newvalue);
        // TODO: this forces update of palette rgb colors and file data
        firstnode.words[index] = newvalue;
        pal2rgb.words = null;
        pal2rgb.updateRight();
        pal2rgb.refreshLeft();
      });
    // add view node to repaint cells when data changes (e.g. undo)
    pal2rgb.addRight(new pixed.PaletteEditorView(updateAllCells));
  }

  ensureFileDiv(fileid: string): JQuery<HTMLElement> {
    var divid = this.getFileDivId(fileid);
    var body = $(document.getElementById(divid));
    if (body.length === 0) {
      var filediv = newDiv(this.maindiv, 'asset_file');
      var header = newDiv(filediv, 'asset_file_header').text(fileid);
      body = newDiv(filediv).attr('id', divid).addClass('disable-select');
    }
    return body;
  }

  refreshAssetsInFile(fileid: string, data: FileData): number {
    let nassets = 0;
    // TODO: check fmt w/h/etc limits
    // TODO: defer editor creation
    // TODO: only refresh when needed
    if (platform_id.startsWith('nes') && fileid.endsWith('.chr') && data instanceof Uint8Array) {
      // is this a NES CHR?
      let node = new pixed.FileDataNode(projectWindows, fileid);
      const neschrfmt = { w: 8, h: 8, bpp: 1, count: (data.length >> 4), brev: true, np: 2, pofs: 8, remap: [0, 1, 2, 4, 5, 6, 7, 8, 9, 10, 11, 12] }; // TODO
      this.addPixelEditor(this.ensureFileDiv(fileid), node, neschrfmt);
      this.registerAsset("charmap", node, 1);
      nassets++;
    } else if (platform_id.startsWith('nes') && fileid.endsWith('.pal') && data instanceof Uint8Array) {
      // is this a NES PAL?
      let node = new pixed.FileDataNode(projectWindows, fileid);
      const nespalfmt = { pal: "nes", layout: "nes" };
      this.addPaletteEditor(this.ensureFileDiv(fileid), node, nespalfmt);
      this.registerAsset("palette", node, 0);
      nassets++;
    } else if (typeof data === 'string') {
      let textfrags = this.scanFileTextForAssets(fileid, data);
      for (let frag of textfrags) {
        const block = $('<div class="asset_block"/>')
          .attr({ 'data-fileid': fileid, 'data-startline': frag.startline })
          .appendTo(this.ensureFileDiv(fileid));
        var snip = $('<div class="asset_snip"/>').appendTo(block);
        var linenos = $('<span class="asset_linenos"/>').appendTo(snip);
        $('<span class="asset_lineno"/>').text('↗ ').appendTo(linenos);
        $('<span class="asset_lineno"/>').text(frag.startline).appendTo(linenos);
        linenos.append('-');
        $('<span class="asset_lineno"/>').text(frag.endline).appendTo(linenos);
        linenos.attr('title', 'Jump to source');
        linenos.click(() => {
          var editor = projectWindows.createOrShow(frag.fileid, true);
          if (editor && (editor as any).highlightLines) {
            (editor as any).highlightLines(frag.startline - 1, (frag.endline > 0 ? frag.endline : frag.startline) - 1);
          }
        });
        snip.append(' ' + frag.header);
        if (frag.error) {
          $('<div class="asset_error_msg"/>').text(frag.error).appendTo(block);
          continue;
        }
        if (frag.fmt) {
          // validate data block size before creating editors
          const assetError = pixed.validateAssetData(data.substring(frag.start, frag.end), frag.fmt);
          if (assetError) {
            $('<div class="asset_error_msg"/>').text(assetError).appendTo(block);
            continue;
          }

          let label = fileid; // TODO: label
          let node: pixed.PixNode = new pixed.TextDataNode(projectWindows, fileid, label, frag.start, frag.end, frag.fmt.bpw);
          let first = node;
          // rle-compressed? TODO: how to edit?
          if (frag.fmt.comp == 'rletag') {
            node = node.addRight(new pixed.Compressor());
          }
          // is this a nes nametable?
          if (frag.fmt.map == 'nesnt') {
            node = node.addRight(new pixed.NESNametableConverter(this));
            node = node.addRight(new pixed.Palettizer(this, { w: 8, h: 8, bpp: 4 }));
            const fmt = { w: 8 * (frag.fmt.w || 32), h: 8 * (frag.fmt.h || 30), count: 1 }; // TODO: can't do custom sizes
            node = node.addRight(new pixed.MapEditor(this, newDiv(block), fmt));
            this.registerAsset("nametable", first, 2);
            nassets++;
          }
          // is this a bitmap?
          else if (frag.fmt.w > 0 && frag.fmt.h > 0) {
            this.addPixelEditor(block, node, frag.fmt);
            this.registerAsset("charmap", first, 1);
            nassets++;
          }
          // is this a palette?
          else if (frag.fmt.pal) {
            this.addPaletteEditor(block, node, frag.fmt);
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

  getFileDivId(id: string) {
    return '__asset__' + safeident(id);
  }

  // TODO: recreate editors when refreshing
  // TODO: look for changes, not moveCursor
  refresh(moveCursor: boolean) {
    // clear and refresh all files/nodes?
    if (moveCursor) {
      this.maindiv.empty();
      this.clearAssets();
      current_project.iterateFiles((fileid, data) => {
        try {
          // Clear stale tracked ranges before re-scanning this file.
          projectWindows.clearAssetRanges(fileid);
          var nassets = this.refreshAssetsInFile(fileid, data);
        } catch (e) {
          console.log(e);
          this.ensureFileDiv(fileid).text(e + ""); // TODO: error msg?
        }
      });
      console.log("Found " + this.rootnodes.length + " assets");
      this.deferrednodes.forEach((node) => {
        try {
          node.refreshRight();
        } catch (e) {
          console.log(e);
          alert(e + "");
        }
      });
      this.deferrednodes = [];
      if (this.maindiv.children().length === 0) {
        $('<div class="asset_no_assets"/>')
          .text("No asset declarations found.")
          .appendTo(this.maindiv);
      }
      this.scrollToAssetFromHash();
    } else {
      if (this.rootnodes.length > 0) {
        this.maindiv.find('.asset_no_assets').remove();
      }
      for (var node of this.rootnodes) {
        node.refreshRight();
      }
    }
  }

  scrollToAssetFromHash(): void {
    var hash = window.location.hash;
    if (!hash || !hash.startsWith('#asseteditor/')) return;
    var parts = hash.substring(1).split('/'); // ['asseteditor', ...filename, startline]
    var fileid = decodeURIComponent(parts.slice(1, -1).join('/'));
    var startline = parts[parts.length - 1];
    if (!fileid || !startline) return;
    // defer to allow DOM to settle
    setTimeout(() => {
      const block = this.maindiv.find(`.asset_block[data-fileid="${fileid}"][data-startline="${startline}"]`);
      if (block.length) {
        block[0].scrollIntoView({ behavior: "smooth", block: "center" });
        block.addClass('asset_highlight');
        setTimeout(() => block.removeClass('asset_highlight'), 500);
      }
    }, 0);
  }

  setVisible?(showing: boolean): void {
    // TODO: make into toolbar?
    if (showing) {
      // ensure asset editor is safe to perform synchronous reads/writes
      projectWindows.flushAllWindows();
      // limit undo/redo to since opening this asset editor
      projectWindows.undoStack = [];
      projectWindows.redoStack = [];
      if (Mousetrap.bind) {
        Mousetrap.bind('mod+z', (e) => { projectWindows.undoStep(); return false; });
        Mousetrap.bind('mod+shift+z', (e) => { projectWindows.redoStep(); return false; });
      }
    } else {
      if (Mousetrap.unbind) {
        Mousetrap.unbind('mod+z');
        Mousetrap.unbind('mod+shift+z');
      }
    }
  }

}

