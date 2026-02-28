"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.currentPcMarker = exports.statusMarkers = exports.errorMarkers = exports.breakpointMarkers = exports.clock = exports.bytes = exports.offset = void 0;
const state_1 = require("@codemirror/state");
const view_1 = require("@codemirror/view");
const util_1 = require("../../common/util");
const setOffset = state_1.StateEffect.define();
const setBytes = state_1.StateEffect.define();
const setClock = state_1.StateEffect.define();
const toggleBreakpoint = state_1.StateEffect.define();
const setErrors = state_1.StateEffect.define();
const setCurrentPc = state_1.StateEffect.define();
const runToLineEffect = state_1.StateEffect.define();
const showErrorMessage = state_1.StateEffect.define();
const offsetField = state_1.StateField.define({
    create() { return state_1.RangeSet.empty; },
    update(value, tr) {
        value = value.map(tr.changes);
        for (let e of tr.effects) {
            if (e.is(setOffset)) {
                const map = e.value;
                const ranges = [];
                for (let [line, val] of map.entries()) {
                    if (line >= 1 && line <= tr.state.doc.lines) {
                        const pos = tr.state.doc.line(line).from;
                        ranges.push(new OffsetMarker((0, util_1.hex)(val, 4)).range(pos));
                    }
                }
                value = state_1.RangeSet.of(ranges, true);
            }
        }
        return value;
    },
});
const bytesField = state_1.StateField.define({
    create() { return state_1.RangeSet.empty; },
    update(value, tr) {
        value = value.map(tr.changes);
        for (let e of tr.effects) {
            if (e.is(setBytes)) {
                const map = e.value;
                const ranges = [];
                for (let [line, val] of map.entries()) {
                    if (line >= 1 && line <= tr.state.doc.lines) {
                        const pos = tr.state.doc.line(line).from;
                        ranges.push(new BytesMarker(val).range(pos));
                    }
                }
                value = state_1.RangeSet.of(ranges, true);
            }
        }
        return value;
    },
});
const clockField = state_1.StateField.define({
    create() { return state_1.RangeSet.empty; },
    update(value, tr) {
        value = value.map(tr.changes);
        for (let e of tr.effects) {
            if (e.is(setClock)) {
                const map = e.value;
                const ranges = [];
                for (let [line, val] of map.entries()) {
                    if (line >= 1 && line <= tr.state.doc.lines) {
                        const pos = tr.state.doc.line(line).from;
                        ranges.push(new ClockMarker(val).range(pos));
                    }
                }
                value = state_1.RangeSet.of(ranges, true);
            }
        }
        return value;
    },
});
const breakpointField = state_1.StateField.define({
    create() { return state_1.RangeSet.empty; },
    update(value, tr) {
        value = value.map(tr.changes);
        for (let e of tr.effects) {
            if (e.is(toggleBreakpoint)) {
                if (e.value === null) {
                    value = state_1.RangeSet.empty;
                }
                else {
                    const line = e.value;
                    if (line >= 1 && line <= tr.state.doc.lines) {
                        const pos = tr.state.doc.line(line).from;
                        let hasBreakpoint = false;
                        value.between(pos, pos, () => { hasBreakpoint = true; return false; });
                        if (hasBreakpoint) {
                            value = value.update({ filter: from => from !== pos });
                        }
                        else {
                            value = value.update({ add: [BREAKPOINT_MARKER.range(pos)] });
                        }
                    }
                }
            }
        }
        return value;
    },
});
const errorField = state_1.StateField.define({
    create() { return state_1.RangeSet.empty; },
    update(value, tr) {
        value = value.map(tr.changes);
        for (let e of tr.effects) {
            if (e.is(setErrors)) {
                const map = e.value;
                const ranges = [];
                for (let [line, msg] of map.entries()) {
                    if (line >= 1 && line <= tr.state.doc.lines) {
                        const pos = tr.state.doc.line(line).from;
                        ranges.push(new ErrorMarker(line, msg).range(pos));
                    }
                }
                value = state_1.RangeSet.of(ranges, true);
            }
        }
        return value;
    },
});
const currentPcField = state_1.StateField.define({
    create() { return state_1.RangeSet.empty; },
    update(value, tr) {
        value = value.map(tr.changes);
        for (let e of tr.effects) {
            if (e.is(setCurrentPc)) {
                if (e.value === null) {
                    value = state_1.RangeSet.empty;
                }
                else {
                    const line = e.value;
                    if (line >= 1 && line <= tr.state.doc.lines) {
                        const pos = tr.state.doc.line(line).from;
                        value = state_1.RangeSet.of(CURRENT_PC_MARKER.range(pos));
                    }
                }
            }
        }
        return value;
    },
});
class OffsetMarker extends view_1.GutterMarker {
    constructor(hex) {
        super();
        this.hex = hex;
    }
    toDOM() { return document.createTextNode(this.hex); }
    eq(other) { return this.hex == other.hex; }
}
class BytesMarker extends view_1.GutterMarker {
    constructor(bytes) {
        super();
        this.bytes = bytes;
    }
    toDOM() { return document.createTextNode(this.bytes); }
    eq(other) { return this.bytes == other.bytes; }
}
class ClockMarker extends view_1.GutterMarker {
    constructor(clock) {
        super();
        this.clock = clock;
    }
    toDOM() { return document.createTextNode(this.clock); }
    eq(other) { return this.clock == other.clock; }
}
const BREAKPOINT_PLACEHOLDER_MARKER = new class extends view_1.GutterMarker {
    toDOM() {
        const span = document.createElement("span");
        span.textContent = "●";
        span.style.color = "transparent";
        span.style.cursor = "pointer";
        span.addEventListener("mouseenter", () => {
            span.style.color = "rgba(255, 0, 0, 0.5)";
        });
        span.addEventListener("mouseleave", () => {
            span.style.color = "transparent";
        });
        return span;
    }
};
const BREAKPOINT_MARKER = new class extends view_1.GutterMarker {
    toDOM() {
        const span = document.createElement("span");
        span.innerHTML = "●";
        span.style.color = "rgba(255, 0, 0, 1.0)";
        span.style.cursor = "pointer";
        span.title = "Click to run to here"; // "Click to toggle breakpoint";
        return span;
    }
};
class ErrorMarker extends view_1.GutterMarker {
    constructor(line, msg) {
        super();
        this.line = line;
        this.msg = msg;
    }
    toDOM() {
        const span = document.createElement("span");
        span.innerHTML = "ⓧ";
        span.style.color = "red";
        span.style.cursor = "pointer";
        span.title = this.msg;
        return span;
    }
    eq(other) { return this.line == other.line && this.msg == other.msg; }
}
const CURRENT_PC_PLACEHOLDER_MARKER = new class extends view_1.GutterMarker {
    toDOM() {
        const span = document.createElement("span");
        span.textContent = "▶";
        span.style.color = "transparent";
        span.style.cursor = "pointer";
        span.title = "Click to run to here";
        span.addEventListener("mouseenter", () => {
            span.style.color = "#ffee66";
        });
        span.addEventListener("mouseleave", () => {
            span.style.color = "transparent";
        });
        return span;
    }
};
const CURRENT_PC_MARKER = new class extends view_1.GutterMarker {
    toDOM() {
        const span = document.createElement("span");
        span.innerHTML = "▶";
        span.style.color = "#ff66ee";
        span.style.cursor = "pointer";
        span.title = "Current PC";
        return span;
    }
};
const offsetGutter = (0, view_1.gutter)({
    class: "gutter-offset",
    markers: v => v.state.field(offsetField),
    initialSpacer: () => new OffsetMarker("0000")
});
const bytesGutter = (0, view_1.gutter)({
    class: "gutter-bytes",
    markers: v => v.state.field(bytesField),
    initialSpacer: () => new BytesMarker("00 00 00")
});
const clockGutter = (0, view_1.gutter)({
    class: "gutter-clock",
    markers: v => v.state.field(clockField),
    initialSpacer: () => new ClockMarker("00")
});
const statusGutter = (0, view_1.gutter)({
    class: "gutter-status",
    lineMarker(view, line, otherMarkers) {
        // Show invisible placeholder on lines without markers, to enable hover.
        return otherMarkers.length === 0 ? BREAKPOINT_PLACEHOLDER_MARKER : null;
    },
    markers: v => {
        const errorMarkers = v.state.field(errorField);
        if (errorMarkers.size > 0) {
            return errorMarkers;
        }
        return v.state.field(breakpointField);
    },
    initialSpacer: () => new ErrorMarker(0, "ⓧ"), // "ⓧ" is wider than "●".
    domEventHandlers: {
        click(view, line) {
            const errorMarkers = view.state.field(errorField);
            if (errorMarkers.size > 0) {
                const pos = line.from;
                let msg = "";
                errorMarkers.between(pos, pos, (from, to, marker) => {
                    msg = marker.msg;
                });
                if (msg) {
                    const lineNum = view.state.doc.lineAt(line.from).number;
                    view.dispatch({
                        effects: showErrorMessage.of({ line: lineNum, msg, toggle: true })
                    });
                }
            }
            else {
                const lineNum = view.state.doc.lineAt(line.from).number;
                view.dispatch({
                    effects: toggleBreakpoint.of(lineNum)
                });
            }
            return true;
        }
    }
});
const currentPcGutter = (0, view_1.gutter)({
    class: "gutter-currentpc",
    lineMarker(view, line, otherMarkers) {
        // Show invisible placeholder on lines without markers, to enable hover.
        return otherMarkers.length === 0 ? CURRENT_PC_PLACEHOLDER_MARKER : null;
    },
    markers: v => v.state.field(currentPcField),
    initialSpacer: () => CURRENT_PC_MARKER,
    domEventHandlers: {
        click(view, line) {
            const lineNum = view.state.doc.lineAt(line.from).number;
            view.dispatch({
                effects: runToLineEffect.of(lineNum)
            });
            return true;
        }
    }
});
exports.offset = {
    set: setOffset,
    field: offsetField,
    gutter: offsetGutter,
};
exports.bytes = {
    set: setBytes,
    field: bytesField,
    gutter: bytesGutter,
};
exports.clock = {
    set: setClock,
    field: clockField,
    gutter: clockGutter,
};
exports.breakpointMarkers = {
    set: toggleBreakpoint,
    field: breakpointField,
};
exports.errorMarkers = {
    set: setErrors,
    field: errorField,
    showMessage: showErrorMessage
};
exports.statusMarkers = {
    gutter: statusGutter
};
exports.currentPcMarker = {
    set: setCurrentPc,
    runToLine: runToLineEffect,
    field: currentPcField,
    gutter: currentPcGutter,
};
//# sourceMappingURL=gutter.js.map