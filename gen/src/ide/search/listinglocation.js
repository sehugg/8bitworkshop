"use strict";
/**
 * findListingLocation - given a PC value, finds the best known source (or
 * assembly-listing) window and line to show it at. Used both to follow the
 * live PC while debugging and to jump to a specific address on demand (e.g.
 * clicking a symbol/address breakpoint).
 *
 * Kept free of DOM / ui.ts dependencies so it can be unit tested.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.findListingLocation = findListingLocation;
/** Find the best known listing window + source line for a PC value.
 * `lookahead` should match the caller's PC_LINE_LOOKAHEAD constant. */
function findListingLocation(pc, ctx, lookahead) {
    let bestid = null;
    let bestscore = 256;
    let bestline = 0;
    const listings = ctx.listings;
    if (listings) {
        for (let lstfn in listings) {
            let lst = listings[lstfn];
            let file = lst.assemblyfile || lst.sourcefile;
            // pick either listing or source file
            let wndid = ctx.filename2path[lstfn] || lstfn;
            if (file == lst.sourcefile)
                wndid = ctx.findWindowWithFilePrefix(lstfn);
            // does this window exist?
            if (wndid && ctx.isWindow(wndid)) {
                // find the source line at the PC or closely before it
                let srcline1 = file && file.findLineForOffset(pc, lookahead);
                if (srcline1) {
                    // try to find the next line and bound the PC
                    let srcline2 = file.lines[srcline1.line + 1];
                    if (!srcline2 || pc < srcline2.offset) {
                        let score = pc - srcline1.offset;
                        if (score < bestscore) {
                            bestid = wndid;
                            bestscore = score;
                            bestline = srcline1.line;
                        }
                    }
                }
            }
        }
    }
    return bestid ? { wndid: bestid, line: bestline } : null;
}
//# sourceMappingURL=listinglocation.js.map