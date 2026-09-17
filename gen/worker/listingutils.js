"use strict";
// test.c(6) : warning 85: in function main unreferenced local variable : 'x'
// main.a (4): error: Unknown Mnemonic 'xxx'.
Object.defineProperty(exports, "__esModule", { value: true });
exports.re_lineoffset = exports.re_crlf = exports.re_msvc2 = exports.re_msvc = void 0;
exports.msvcErrorMatcher = msvcErrorMatcher;
exports.makeErrorMatcher = makeErrorMatcher;
exports.extractErrors = extractErrors;
exports.parseListing = parseListing;
exports.parseSourceLines = parseSourceLines;
// at 2: warning 190: ISO C forbids an empty source file
exports.re_msvc = /[/]*([^( ]+)\s*[(](\d+)[)]\s*:\s*(.+?):\s*(.*)/;
exports.re_msvc2 = /\s*(at)\s+(\d+)\s*(:)\s*(.*)/;
function msvcErrorMatcher(errors) {
    return function (s) {
        var matches = exports.re_msvc.exec(s) || exports.re_msvc2.exec(s);
        if (matches) {
            var errline = parseInt(matches[2]);
            errors.push({
                line: errline,
                path: matches[1],
                //type:matches[3],
                msg: matches[4]
            });
        }
        else {
            console.log(s);
        }
    };
}
function makeErrorMatcher(errors, regex, iline, imsg, mainpath, ifilename) {
    return function (s) {
        var matches = regex.exec(s);
        if (matches) {
            errors.push({
                line: parseInt(matches[iline]) || 1,
                msg: matches[imsg],
                path: ifilename ? matches[ifilename] : mainpath
            });
        }
        else {
            console.log("??? " + s);
        }
    };
}
function extractErrors(regex, strings, path, iline, imsg, ifilename) {
    var errors = [];
    var matcher = makeErrorMatcher(errors, regex, iline, imsg, path, ifilename);
    for (var i = 0; i < strings.length; i++) {
        matcher(strings[i]);
    }
    return errors;
}
exports.re_crlf = /\r?\n/;
//    1   %line 16+1 hello.asm
exports.re_lineoffset = /\s*(\d+)\s+[%]line\s+(\d+)\+(\d+)\s+(.+)/;
// update the segment/function context from a listing line
function parseSegFunc(line, segMatch, funcMatch, state) {
    let segm = segMatch && segMatch.exec(line);
    if (segm) {
        state.segment = segm[1];
    }
    let funcm = funcMatch && funcMatch.exec(line);
    if (funcm) {
        state.funcbase = parseInt(funcm[1], 16);
        state.func = funcm[2];
    }
}
function parseListing(code, lineMatch, iline, ioffset, iinsns, icycles, funcMatch, segMatch) {
    var lines = [];
    var lineofs = 0;
    var state = { segment: '', func: '', funcbase: 0 };
    code.split(exports.re_crlf).forEach((line, lineindex) => {
        parseSegFunc(line, segMatch, funcMatch, state);
        var linem = lineMatch.exec(line);
        if (linem && linem[1]) {
            var linenum = iline < 0 ? lineindex : parseInt(linem[iline]);
            var offset = parseInt(linem[ioffset], 16);
            var insns = linem[iinsns];
            var cycles = icycles ? parseInt(linem[icycles]) : null;
            var iscode = cycles > 0;
            if (insns) {
                lines.push({
                    line: linenum + lineofs,
                    offset: offset - state.funcbase,
                    insns,
                    cycles,
                    iscode,
                    segment: state.segment,
                    func: state.func
                });
            }
        }
        else {
            let m = exports.re_lineoffset.exec(line);
            // TODO: check filename too
            if (m) {
                lineofs = parseInt(m[2]) - parseInt(m[1]) - parseInt(m[3]);
            }
        }
    });
    return lines;
}
function parseSourceLines(code, lineMatch, offsetMatch, funcMatch, segMatch) {
    var lines = [];
    var lastlinenum = 0;
    var state = { segment: '', func: '', funcbase: 0 };
    for (var line of code.split(exports.re_crlf)) {
        parseSegFunc(line, segMatch, funcMatch, state);
        var linem = lineMatch.exec(line);
        if (linem && linem[1]) {
            lastlinenum = parseInt(linem[1]);
        }
        else if (lastlinenum) {
            var linem = offsetMatch.exec(line);
            if (linem && linem[1]) {
                var offset = parseInt(linem[1], 16);
                lines.push({
                    line: lastlinenum,
                    offset: offset - state.funcbase,
                    segment: state.segment,
                    func: state.func
                });
                lastlinenum = 0;
            }
        }
    }
    return lines;
}
//# sourceMappingURL=listingutils.js.map