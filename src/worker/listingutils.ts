
// test.c(6) : warning 85: in function main unreferenced local variable : 'x'
// main.a (4): error: Unknown Mnemonic 'xxx'.

import { SourceLine, WorkerError } from "../common/workertypes";

// at 2: warning 190: ISO C forbids an empty source file
export const re_msvc = /[/]*([^( ]+)\s*[(](\d+)[)]\s*:\s*(.+?):\s*(.*)/;
export const re_msvc2 = /\s*(at)\s+(\d+)\s*(:)\s*(.*)/;

export function msvcErrorMatcher(errors: WorkerError[]) {
    return function (s: string) {
        var matches = re_msvc.exec(s) || re_msvc2.exec(s);
        if (matches) {
            var errline = parseInt(matches[2]);
            errors.push({
                line: errline,
                path: matches[1],
                //type:matches[3],
                msg: matches[4]
            });
        } else {
            console.log(s);
        }
    }
}

export function makeErrorMatcher(errors: WorkerError[], regex, iline: number, imsg: number, mainpath: string, ifilename?: number) {
    return function (s) {
        var matches = regex.exec(s);
        if (matches) {
            errors.push({
                line: parseInt(matches[iline]) || 1,
                msg: matches[imsg],
                path: ifilename ? matches[ifilename] : mainpath
            });
        } else {
            console.log("??? " + s);
        }
    }
}

export function extractErrors(regex, strings: string[], path: string, iline, imsg, ifilename) {
    var errors = [];
    var matcher = makeErrorMatcher(errors, regex, iline, imsg, path, ifilename);
    for (var i = 0; i < strings.length; i++) {
        matcher(strings[i]);
    }
    return errors;
}

export const re_crlf = /\r?\n/;
//    1   %line 16+1 hello.asm
export const re_lineoffset = /\s*(\d+)\s+[%]line\s+(\d+)\+(\d+)\s+(.+)/;

export function parseListing(code: string,
    lineMatch, iline: number, ioffset: number, iinsns: number, icycles?: number,
    funcMatch?, segMatch?): SourceLine[] {
    var lines: SourceLine[] = [];
    var lineofs = 0;
    var segment = '';
    var func = '';
    var funcbase = 0;
    code.split(re_crlf).forEach((line, lineindex) => {
        let segm = segMatch && segMatch.exec(line);
        if (segm) { segment = segm[1]; }
        let funcm = funcMatch && funcMatch.exec(line);
        if (funcm) { funcbase = parseInt(funcm[1], 16); func = funcm[2]; }

        var linem = lineMatch.exec(line);
        if (linem && linem[1]) {
            var linenum = iline < 0 ? lineindex : parseInt(linem[iline]);
            var offset = parseInt(linem[ioffset], 16);
            var insns = linem[iinsns];
            var cycles: number = icycles ? parseInt(linem[icycles]) : null;
            var iscode = cycles > 0;
            if (insns) {
                lines.push({
                    line: linenum + lineofs,
                    offset: offset - funcbase,
                    insns,
                    cycles,
                    iscode,
                    segment,
                    func
                });
            }
        } else {
            let m = re_lineoffset.exec(line);
            // TODO: check filename too
            if (m) {
                lineofs = parseInt(m[2]) - parseInt(m[1]) - parseInt(m[3]);
            }
        }
    });
    return lines;
}

export function parseSourceLines(code: string, lineMatch, offsetMatch, funcMatch?, segMatch?) {
    var lines = [];
    var lastlinenum = 0;
    var segment = '';
    var func = '';
    var funcbase = 0;
    for (var line of code.split(re_crlf)) {
        let segm = segMatch && segMatch.exec(line);
        if (segm) { segment = segm[1]; }
        let funcm = funcMatch && funcMatch.exec(line);
        if (funcm) { funcbase = parseInt(funcm[1], 16); func = funcm[2]; }

        var linem = lineMatch.exec(line);
        if (linem && linem[1]) {
            lastlinenum = parseInt(linem[1]);
        } else if (lastlinenum) {
            var linem = offsetMatch.exec(line);
            if (linem && linem[1]) {
                var offset = parseInt(linem[1], 16);
                lines.push({
                    line: lastlinenum,
                    offset: offset - funcbase,
                    segment,
                    func
                });
                lastlinenum = 0;
            }
        }
    }
    return lines;
}
