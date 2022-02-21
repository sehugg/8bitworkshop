"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.isOutputResult = exports.isErrorResult = exports.isUnchanged = exports.SourceFile = void 0;
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
                if (!this.offset2loc[info.offset])
                    this.offset2loc[info.offset] = info;
                if (!this.line2offset[info.line])
                    this.line2offset[info.line] = info.offset;
            }
        }
    }
    // TODO: smarter about looking for source lines between two addresses
    findLineForOffset(PC, lookbehind) {
        if (this.offset2loc) {
            for (var i = 0; i <= lookbehind; i++) {
                var loc = this.offset2loc[PC];
                if (loc) {
                    return loc;
                }
                PC--;
            }
        }
        return null;
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
exports.isUnchanged = isUnchanged;
function isErrorResult(result) {
    return ('errors' in result);
}
exports.isErrorResult = isErrorResult;
function isOutputResult(result) {
    return ('output' in result);
}
exports.isOutputResult = isOutputResult;
//# sourceMappingURL=workertypes.js.map