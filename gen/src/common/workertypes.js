"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.SourceFile = void 0;
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
    // provided it is within `lookbehind` bytes; null otherwise
    findLineForOffset(PC, lookbehind) {
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
        if (PC - off > lookbehind)
            return null;
        return this.offset2loc.get(off);
    }
    lineCount() { return this.lines.length; }
}
exports.SourceFile = SourceFile;
;
;
;
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