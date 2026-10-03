
import { Toolbar } from "./toolbar";
import { registerElementShortcuts, Shortcut } from "./shortcutbar";
import { registerElementHelpTopic } from "./helptopics";
import { VirtualList } from "../common/vlist";
import { WaveformMeta, WaveformProvider, WaveformScope } from "../common/waveform";
import { WaveformCore } from "../common/waveformcore";
import Split = require("split.js");
import DOMPurify from "dompurify";

// The IDE's waveform view: jQuery DOM and a toolbar over WaveformCore.
export class WaveformView extends WaveformCore {
  parent : HTMLElement;
  toolbar : Toolbar;
  clklabel : HTMLElement;
  wavelist;
  scrollbarWidth = 12;

  constructor(parent:HTMLElement, wfp:WaveformProvider) {
    super(wfp);
    this.parent = parent;
    // focusable container + chip registration so the shortcut bar can show
    // this widget's keys while it has focus (the canvas itself can't take focus)
    this.parent.setAttribute('tabindex', '-1');
    // preventDefault: stop the browser's own click-to-focus from re-targeting
    // focus onto a nested focusable child (e.g. the wavelist container) right
    // after we focus the outer container -- that flicker confuses the shortcut
    // bar's focus tracking (see shortcutbar.ts)
    this.parent.addEventListener('mousedown', (e) => { e.preventDefault(); this.parent.focus(); });
    registerElementShortcuts(this.parent, () => this.getShortcuts());
    registerElementHelpTopic(this.parent, 'verilog-waveform');
    this.recreate();
  }

  // chips for the widget's mousetrap-scoped toolbar bindings
  getShortcuts(): Shortcut[] {
    return this.getActions();
  }

  wtimer;
  recreate() {
    clearTimeout(this.wtimer);
    this.wtimer = setTimeout(() => {
      this.destroy();
      // create new thing
      this._recreate();
    }, 0);
  }
  
  destroy() {
    // remove old thing
    if (this.wavelist) {
      $(this.wavelist.container).remove();
      this.wavelist = null;
    }
    if (this.toolbar) {
      this.toolbar.destroy();
      this.toolbar = null;
    }
    if (this.clklabel) {
      this.clklabel.remove();
      this.clklabel = null;
    }
  }
  
  _recreate() {
    this.meta = this.wfp.getSignalMetadata();
    if (!this.meta) return;
    var width = $(this.parent).width();
    this.pageWidth = width - this.scrollbarWidth;
    var rowHeight = 40; // TODO
    this.setClocksPerPage();
    this.clockMax = 0;
    this.wavelist = new VirtualList({
      w: width,
      h: $(this.parent).height(),
      itemHeight: rowHeight,
      totalRows: this.meta.length+1,
      generatorFn: (row : number) => {
        var metarow = this.meta[row]; // TODO: why null?
        //var s = metarow != null ? metarow.label : "";
        let linediv = document.createElement("div");
        let canvas = document.createElement("canvas");
        canvas.width = width - 12; // room for scrollbar
        canvas.height = rowHeight;
        linediv.appendChild(canvas); //document.createTextNode(s));
        linediv.classList.add('waverow');
        this.lines[row] = canvas;
        this.refreshRow(row);
        // click to change input
        if (this.isEditable(metarow)) {
          linediv.onmousedown = (e) => {
            var meta = this.meta[row];
            if (meta && meta.input) {
              this.changeInputValue(row);
            }
          };
          linediv.classList.add('editable');
          linediv.style.cursor = 'grab';
        }
        return linediv;
      }
    });
    var wlc = this.wavelist.container;
    wlc.tabIndex = -1; // make it focusable
    //wlc.style = "overflow-x: hidden"; // TODO?
    this.toolbar = new Toolbar(this.parent, this.parent);
    this.toolbar.span.css('display','inline-block');
    this.clklabel = document.createElement('span');
    this.clklabel.innerText = "-";
    $(this.parent).append(this.clklabel);
    $(this.parent).append(wlc);
    
    var down = false;
    var selfn = (e) => {
      this.setSelTime(e.offsetX / this.zoom + this.t0 - 0.5);
    };
    $(wlc).mousedown( (e) => {
      down = true;
      selfn(e);
      //if (e['pointerId']) e.target.setPointerCapture(e['pointerId']);
    });
    $(wlc).mousemove( (e) => {
      if (down) selfn(e);
    });
    $(wlc).mouseup( (e) => {
      down = false;
      //if (e['pointerId']) e.target.releasePointerCapture(e['pointerId']);
    });
    // scroll left/right
    $(wlc).on('wheel', (event:any) => {
      if (Math.abs(event.originalEvent.deltaX) > Math.abs(event.originalEvent.deltaY)) {
        var xdelta = Math.max(-1000, Math.min(1000, event.originalEvent.deltaX));
        if (xdelta) this.setOrgTime(this.t0 + xdelta);
      }
    });
    for (const act of this.getActions()) {
      this.toolbar.add(act.key, act.label, act.icon, act.fn);
    }
    // '+' zooms in too, without a button
    this.toolbar.add('+', 'Zoom In', null, () => this.setZoom(this.zoom * 2));
    $(window).resize(() => {
      this.recreate();
    }); // TODO: remove?
  }
  
  protected selectionChanged() {
    this.clklabel.innerText = " clk " + this.tsel;
  }

  protected promptValue(meta:WaveformMeta, oldValue:number, min:number, max:number) {
    return new Promise<number | null>((resolve) => {
      bootbox.prompt({
        value: oldValue+"",
        inputType: "number",
        title: `Enter new value for "${DOMPurify.sanitize(meta.label)}" (${min} to ${max}):`,
        callback: (result) => resolve(result != null ? parseInt(result) : null),
      });
    });
  }
}

// The IDE's scope: splits the emulator overlay into the video on top and a
// WaveformView below. The view is created the first time the scope is shown.
export class SplitWaveformScope implements WaveformScope {
  topdiv : HTMLElement;
  wavediv : HTMLElement;
  split;
  waveview : WaveformView;

  constructor(video:HTMLCanvasElement, readonly provider:WaveformProvider) {
    var overlay = $("#emuoverlay").show();
    this.topdiv = $('<div class="emuspacer">').appendTo(overlay)[0];
    this.topdiv.appendChild(video);
    this.wavediv = $('<div class="emuscope">').appendTo(overlay)[0];
    this.split = Split( [this.topdiv, this.wavediv], {
      minSize: [0,0],
      sizes: [99,1],
      direction: 'vertical',
      gutterSize: 16,
      onDrag: () => this.resize(),
    });
  }
  isVisible() {
    return this.split.getSizes()[1] > 2; // TODO?
  }
  show() {
    this.split.setSizes([0,100]);
  }
  setCurrentTime(t:number) {
    if (this.waveview) this.waveview.setCurrentTime(t);
  }
  update() {
    if (this.isVisible()) {
      if (!this.waveview) {
        this.waveview = new WaveformView(this.wavediv, this.provider);
      } else {
        this.waveview.refresh();
      }
    }
  }
  resize() {
    if (this.waveview) this.waveview.recreate();
  }
}
