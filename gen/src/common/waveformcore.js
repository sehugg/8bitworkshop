"use strict";
// The waveform view without a UI toolkit: its state (zoom, scroll position,
// cursors), the keys that move them, and how a row of signal data is drawn.
// The IDE (src/ide/waveform.ts, jQuery) and the VS Code Waveform view (a
// webview) both extend it and add the DOM.
Object.defineProperty(exports, "__esModule", { value: true });
exports.WaveformCore = exports.BUILTIN_INPUT_PORTS = void 0;
// the clock and reset can't be edited (see WaveformMeta)
exports.BUILTIN_INPUT_PORTS = [
    'clk', 'reset',
];
class WaveformCore {
    constructor(wfp) {
        this.lines = [];
        this.zoom = 8;
        this.t0 = 0;
        this.tsel = -1;
        this.tnow = -1;
        this.hexformat = true;
        this.wfp = wfp;
    }
    /** The selected time changed. */
    selectionChanged() { }
    /** The moves, as toolbar buttons and key bindings. */
    getActions() {
        return [
            { key: '=', label: 'Zoom In', icon: 'glyphicon-zoom-in', fn: () => this.setZoom(this.zoom * 2) },
            { key: '-', label: 'Zoom Out', icon: 'glyphicon-zoom-out', fn: () => this.setZoom(this.zoom / 2) },
            { key: 'ctrl+shift+left', label: 'To Start', icon: 'glyphicon-backward', fn: () => { this.setSelTime(0); this.setOrgTime(0); } },
            { key: 'shift+left', label: 'Page Left', icon: 'glyphicon-fast-backward', fn: () => this.setSelTime(this.tsel - this.clocksPerPage / 4) },
            { key: 'left', label: 'Left', icon: 'glyphicon-step-backward', fn: () => this.setSelTime(this.tsel - 1) },
            { key: 'right', label: 'Right', icon: 'glyphicon-step-forward', fn: () => this.setSelTime(this.tsel + 1) },
            { key: 'shift+right', label: 'Page Right', icon: 'glyphicon-fast-forward', fn: () => this.setSelTime(this.tsel + this.clocksPerPage / 4) },
            { key: 'space', label: 'Go To Current', icon: 'glyphicon-flash', fn: () => { this.setOrgTime(this.tnow); this.setSelTime(this.tnow); } },
            { key: 'h', label: 'Hex/Dec', icon: 'glyphicon-barcode', fn: () => { this.hexformat = !this.hexformat; this.refresh(); } },
        ];
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
        this.selectionChanged();
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
    /** True if clicking the row changes a signal. */
    isEditable(meta) {
        return meta && meta.input && exports.BUILTIN_INPUT_PORTS.indexOf(meta.label) < 0;
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
        if (this.isEditable(meta))
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
    /** Click on an input: flip a bit, or ask for a new value. */
    changeInputValue(row) {
        var meta = this.meta[row];
        if (!meta)
            return;
        var data = this.wfp.getSignalData(row, this.t0, 1);
        var oldValue = data[0] || 0;
        var min = 0;
        var max = (1 << meta.len) - 1;
        if (max == 1) {
            this.wfp.setSignalValue(row, oldValue > 0 ? 0 : 1);
        }
        else {
            this.promptValue(meta, oldValue, min, max).then((value) => {
                if (value != null && value >= min && value <= max) {
                    this.wfp.setSignalValue(row, value);
                }
            });
        }
    }
}
exports.WaveformCore = WaveformCore;
//# sourceMappingURL=waveformcore.js.map