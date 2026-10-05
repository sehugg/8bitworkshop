"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.SourceFile = void 0;
exports.buildProducts = buildProducts;
exports.isUnchanged = isUnchanged;
exports.isErrorResult = isErrorResult;
exports.isOutputResult = isOutputResult;
class SourceFile {
    constructor(lines, text) {
        lines = lines || [];
        this.lines = lines;
        this.text = text;
        this.offset2loc = new Map();
        this.line2offset = new Map();
        for (var info of lines) {
            if (info.offset >= 0) {
                // first line wins (is assigned to offset)
                // TODO: handle macros/includes w/ multiple offsets per line
                if (!this.offset2loc.has(info.offset))
                    this.offset2loc.set(info.offset, info);
                if (!this.line2offset.has(info.line))
                    this.line2offset.set(info.line, info.offset);
            }
        }
        this.sortedOffsets = Array.from(this.offset2loc.keys()).sort((a, b) => a - b);
    }
    // returns the line whose offset is nearest to (but not greater than) PC,
    // provided it is within `lookbehind` bytes; null otherwise.
    // `fnStart` (the start address of the function containing PC) clamps the
    // lookbehind: code after a function's label but before its first listed line
    // (a compiler prologue) belongs to that first line, and code that runs past
    // the end of the listing (e.g. into a library with no source) matches
    // nothing rather than the previous function's last line.
    findLineForOffset(PC, lookbehind, fnStart) {
        const offsets = this.sortedOffsets;
        // binary search for last offset <= PC
        var lo = 0, hi = offsets.length - 1, ans = -1;
        while (lo <= hi) {
            var mid = (lo + hi) >> 1;
            if (offsets[mid] <= PC) {
                ans = mid;
                lo = mid + 1;
            }
            else {
                hi = mid - 1;
            }
        }
        if (ans < 0)
            return null;
        var off = offsets[ans];
        if (fnStart != null && off < fnStart) {
            // the only line this PC may belong to is the first one at/after fnStart
            var next = this.firstOffsetAtOrAfter(fnStart, offsets);
            return next != null && next - PC <= lookbehind ? this.offset2loc.get(next) : null;
        }
        if (PC - off > lookbehind)
            return null;
        return this.offset2loc.get(off);
    }
    firstOffsetAtOrAfter(x, offsets) {
        var lo = 0, hi = offsets.length - 1, ans = -1;
        while (lo <= hi) {
            var mid = (lo + hi) >> 1;
            if (offsets[mid] >= x) {
                ans = mid;
                hi = mid - 1;
            }
            else {
                lo = mid + 1;
            }
        }
        return ans < 0 ? null : offsets[ans];
    }
    lineCount() { return this.lines.length; }
}
exports.SourceFile = SourceFile;
;
;
;
function buildProducts(r) {
    const { listings, symbolmap, symbolsizes, segments } = r;
    return { listings, symbolmap, symbolsizes, segments };
}
function isUnchanged(result) {
    return ('unchanged' in result);
}
function isErrorResult(result) {
    return ('errors' in result);
}
function isOutputResult(result) {
    return ('output' in result);
}
//# sourceMappingURL=workertypes.js.map