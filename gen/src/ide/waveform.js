"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.WaveformView = void 0;
const toolbar_1 = require("./toolbar");
const vlist_1 = require("../common/vlist");
const dompurify_1 = __importDefault(require("dompurify"));
const BUILTIN_INPUT_PORTS = [
    'clk', 'reset',
];
class WaveformView {
    constructor(parent, wfp) {
        this.lines = [];
        this.zoom = 8;
        this.t0 = 0;
        this.tsel = -1;
        this.tnow = -1;
        this.hexformat = true;
        this.scrollbarWidth = 12;
        this.parent = parent;
        this.wfp = wfp;
        this.recreate();
    }
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
        if (!this.meta)
            return;
        var width = $(this.parent).width();
        this.pageWidth = width - this.scrollbarWidth;
        var rowHeight = 40; // TODO
        this.setClocksPerPage();
        this.clockMax = 0;
        this.wavelist = new vlist_1.VirtualList({
            w: width,
            h: $(this.parent).height(),
            itemHeight: rowHeight,
            totalRows: this.meta.length + 1,
            generatorFn: (row) => {
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
                if (metarow && metarow.input && BUILTIN_INPUT_PORTS.indexOf(metarow.label) < 0) {
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
        this.toolbar = new toolbar_1.Toolbar(this.parent, this.parent);
        this.toolbar.span.css('display', 'inline-block');
        this.clklabel = document.createElement('span');
        this.clklabel.innerText = "-";
        $(this.parent).append(this.clklabel);
        $(this.parent).append(wlc);
        var down = false;
        var selfn = (e) => {
            this.setSelTime(e.offsetX / this.zoom + this.t0 - 0.5);
        };
        $(wlc).mousedown((e) => {
            down = true;
            selfn(e);
            //if (e['pointerId']) e.target.setPointerCapture(e['pointerId']);
        });
        $(wlc).mousemove((e) => {
            if (down)
                selfn(e);
        });
        $(wlc).mouseup((e) => {
            down = false;
            //if (e['pointerId']) e.target.releasePointerCapture(e['pointerId']);
        });
        // scroll left/right
        $(wlc).on('wheel', (event) => {
            if (Math.abs(event.originalEvent.deltaX) > Math.abs(event.originalEvent.deltaY)) {
                var xdelta = Math.max(-1000, Math.min(1000, event.originalEvent.deltaX));
                if (xdelta)
                    this.setOrgTime(this.t0 + xdelta);
            }
        });
        this.toolbar.add('=', 'Zoom In', 'glyphicon-zoom-in', (e, combo) => {
            this.setZoom(this.zoom * 2);
        });
        this.toolbar.add('+', 'Zoom In', null, (e, combo) => {
            this.setZoom(this.zoom * 2);
        });
        this.toolbar.add('-', 'Zoom Out', 'glyphicon-zoom-out', (e, combo) => {
            this.setZoom(this.zoom / 2);
        });
        this.toolbar.add('ctrl+shift+left', 'Move to beginning', 'glyphicon-backward', (e, combo) => {
            this.setSelTime(0);
            this.setOrgTime(0);
        });
        this.toolbar.add('shift+left', 'Move left 1/4 page', 'glyphicon-fast-backward', (e, combo) => {
            this.setSelTime(this.tsel - this.clocksPerPage / 4);
        });
        this.toolbar.add('left', 'Move left 1 clock', 'glyphicon-step-backward', (e, combo) => {
            this.setSelTime(this.tsel - 1);
        });
        this.toolbar.add('right', 'Move right 1 clock', 'glyphicon-step-forward', (e, combo) => {
            this.setSelTime(this.tsel + 1);
        });
        this.toolbar.add('shift+right', 'Move right 1/4 page', 'glyphicon-fast-forward', (e, combo) => {
            this.setSelTime(this.tsel + this.clocksPerPage / 4);
        });
        this.toolbar.add('space', 'Go to current time', 'glyphicon-flash', (e, combo) => {
            this.setOrgTime(this.tnow);
            this.setSelTime(this.tnow);
        });
        this.toolbar.add('h', 'Switch between hex/decimal format', 'glyphicon-barcode', (e, combo) => {
            this.hexformat = !this.hexformat;
            this.refresh();
        });
        $(window).resize(() => {
            this.recreate();
        }); // TODO: remove?
    }
    roundT(t) {
        t = Math.round(t);
        t = Math.max(0, t); // make sure >= 0
        t = Math.min(this.clockMax + this.clocksPerPage / 2, t); // make sure <= end
        return t;
    }
    setOrgTime(t) {
        this.t0 = this.roundT(t);
        this.refresh();
    }
    setCurrentTime(t) {
        this.tnow = this.roundT(t);
        this.refresh();
    }
    setSelTime(t) {
        t = this.roundT(t);
        if (t >= this.t0 + this.clocksPerPage - 1)
            this.t0 += this.clocksPerPage / 4;
        if (t <= this.t0 + 2)
            this.t0 -= this.clocksPerPage / 4;
        this.tsel = t;
        this.setOrgTime(this.t0);
        this.clklabel.innerText = " clk " + this.tsel;
    }
    setClocksPerPage() {
        this.clocksPerPage = Math.floor(this.pageWidth / this.zoom) - 1;
    }
    setZoom(zoom) {
        this.zoom = Math.max(1 / 16, Math.min(64, zoom));
        this.setClocksPerPage();
        this.t0 = Math.max(0, Math.round(this.tsel - this.clocksPerPage / 2));
        this.refresh();
    }
    refresh() {
        if (!this.meta)
            this.recreate();
        if (!this.meta)
            return;
        for (var i = 0; i < this.meta.length; i++) {
            this.refreshRow(i);
        }
    }
    value2str(val, meta) {
        var radix = this.hexformat ? 16 : 10;
        var txt = val.toString(radix);
        if (radix == 16 && meta && meta.len > 3)
            txt = `${meta.len}'h${txt}`;
        //else if (radix == 10 && meta.len > 3)
        //txt = `${meta.len}'d${txt}`;
        return txt;
    }
    refreshRow(row) {
        var canvas = this.lines[row];
        var meta = this.meta[row];
        if (!canvas || !meta)
            return;
        var isclk = (meta.label == 'clk');
        var w = canvas.width;
        var h = canvas.height;
        var ctx = canvas.getContext("2d");
        var fontbig = "14px Andale Mono, Lucida Console, monospace";
        var fontsml = "10px Andale Mono, Lucida Console, monospace";
        ctx.font = fontbig;
        // clear to black
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        // highlighted?
        var tags = [];
        if (meta.input && BUILTIN_INPUT_PORTS.indexOf(meta.label) < 0)
            tags.push('input');
        //if (meta.output) tags.push('output');
        // draw waveform
        var fh = 12;
        var b1 = fh + 4;
        var b2 = 4;
        var h2 = h - b1 - b2;
        var yrange = meta.len == 32 ? 4294967296.0 : ((1 << meta.len) - 1) || 0;
        var data = this.wfp.getSignalData(row, this.t0, Math.ceil(w / this.zoom));
        this.clockMax = Math.max(this.clockMax, this.t0 + data.length);
        var printvals = meta.len > 1 && this.zoom >= 32;
        var ycen = b1 + h2 - 4;
        ctx.fillStyle = "#336633";
        ctx.fillRect(0, fh / 2, 3, b1 + h2 - fh / 2); // draw left tag
        const COLOR_LINE = ctx.strokeStyle = "#33dd33";
        const COLOR_HILITE = ctx.fillStyle = "#66ffff";
        const COLOR_NAME = "#dddddd";
        // draw waveform
        ctx.beginPath();
        var x = 0;
        var y = 0;
        var lastval = -1;
        for (var i = 0; i < data.length; i++) {
            var val = data[i];
            if (printvals && val != lastval && x < w - 100) { // close to right edge? omit
                var ytext = ycen;
                var txt = this.value2str(val, null);
                if (txt.length > 4)
                    ctx.font = fontsml;
                ctx.fillText(txt, x + this.zoom / 4, ytext);
            }
            if (i > 0)
                ctx.lineTo(x, y);
            y = b1 + (1.0 - val / yrange) * h2;
            if (!isclk)
                x += this.zoom * (1 / 8);
            if (i == 0)
                ctx.moveTo(x, y);
            else
                ctx.lineTo(x, y);
            if (this.zoom > 0.75 && lastval != val && Math.abs(lastval - val) < yrange * 0.1)
                ctx.fillRect(x, y, 1 + this.zoom / 4, 1);
            if (isclk)
                x += this.zoom;
            else
                x += this.zoom * (7 / 8);
            lastval = val;
        }
        ctx.stroke();
        // draw selection thingie
        ctx.font = fontbig;
        if (this.tsel >= this.t0) {
            ctx.strokeStyle = ctx.fillStyle = "#ff66ff";
            ctx.beginPath();
            x = (this.tsel - this.t0) * this.zoom + this.zoom / 2;
            ctx.moveTo(x, 0);
            ctx.lineTo(x, h);
            ctx.stroke();
            // print value
            var val = data[this.tsel - this.t0];
            ctx.textAlign = 'right';
            if (val !== undefined) {
                var s = this.value2str(val, meta);
                var x = w - fh;
                var dims = ctx.measureText(s);
                ctx.fillStyle = 'black';
                ctx.fillRect(x - dims.width - 2, ycen - 13, dims.width + 4, 17);
                ctx.fillStyle = "#ff66ff";
                ctx.fillText(s, x, ycen);
            }
        }
        // draw current line
        if (this.tnow >= this.t0) {
            ctx.strokeStyle = ctx.fillStyle = "#6666cc";
            ctx.beginPath();
            x = (this.tnow - this.t0) * this.zoom + this.zoom / 2;
            ctx.moveTo(x, 0);
            ctx.lineTo(x, h);
            ctx.stroke();
        }
        // draw labels
        ctx.fillStyle = COLOR_NAME;
        ctx.textAlign = "left";
        var lbl = meta.label;
        if (tags.length > 0) {
            lbl += " (" + tags.join(', ') + ")";
        }
        ctx.fillText(lbl, 5, fh);
    }
    changeInputValue(row) {
        var meta = this.meta[row];
        if (!meta)
            return;
        var data = this.wfp.getSignalData(row, this.t0, 1);
        var oldValue = data[0] || 0;
        var min = 0;
        var max = (1 << meta.len) - 1;
        //console.log(meta, oldValue, min, max);
        if (max == 1) {
            this.wfp.setSignalValue(row, oldValue > 0 ? 0 : 1);
        }
        else {
            var rangestr = `${min} to ${max}`;
            bootbox.prompt({
                value: oldValue + "",
                inputType: "number",
                //min: 0,
                //max: meta.len-1,
                //placeholder: rangestr,
                title: `Enter new value for "${dompurify_1.default.sanitize(meta.label)}" (${rangestr}):`,
                callback: (result) => {
                    if (result != null) {
                        var value = parseInt(result);
                        if (value >= min && value <= max) {
                            this.wfp.setSignalValue(row, parseInt(result));
                        }
                    }
                }
            });
        }
    }
}
exports.WaveformView = WaveformView;
//# sourceMappingURL=waveform.js.map