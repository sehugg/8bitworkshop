"use strict";
/**
 * SymbolIndex - shared machinery for searching a SymbolRecord[] corpus.
 * Uses uFuzzy for identifier lookup and MiniSearch for prose.
 */
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.SymbolIndex = void 0;
const SOURCE_WEIGHTS = {
    project: 1.3,
    toolchain: 1.0,
    docs: 0.7,
    debugger: 0.9, // runtime symbols (never indexed here; weight unused)
};
// Declarations (real code symbols) rank above docs; text hits rank lowest.
const KIND_WEIGHTS = {
    func: 1.2,
    macro: 1.2,
    type: 1.2,
    struct: 1.2,
    enum: 1.2,
    var: 1.1,
    label: 1.1,
    equate: 1.1,
    proc: 1.2,
    module: 1.2,
    doc: 0.8,
    text: 0.3,
};
const PROSE_THRESHOLD = 4;
// Base score for a uFuzzy match before quality/weight adjustments.
// Domain: ~0-1000. Exact matches ~1000, fuzzy/degraded matches lower.
const BASE_MATCH_SCORE = 1000;
/**
 * Helper to resolve a CommonJS module that may be exported as
 * `module.exports = Class` (uFuzzy, MiniSearch) into the class itself.
 * Works for both `import()` (bundled) and `require()` (tsc CJS output).
 */
function resolveClass(mod) {
    if (!mod)
        return undefined;
    // Direct class export (module.exports = Class): static props only
    if (typeof mod === 'function')
        return mod;
    // ESM namespace: { default: Class }
    if (typeof mod.default === 'function')
        return mod.default;
    // Named export
    if (typeof mod.MiniSearch === 'function')
        return mod.MiniSearch;
    if (typeof mod.uFuzzy === 'function')
        return mod.uFuzzy;
    return undefined;
}
class SymbolIndex {
    constructor(records = []) {
        this.records = [];
        this.nameHaystack = [];
        this.msIds = new Set();
        this.records = records;
        this.nameHaystack = records.map(r => r.name);
        this.applySourceBoosts = true;
        this.ufOptions = {
            // Allow intra-word insertions so typos like "joy_rd" match "joy_read"
            intraIns: 2,
            interIns: 2,
        };
        this.msOptions = {
            idField: 'id',
            fields: ['name', 'brief', 'detail'],
            storeFields: ['id', 'name', 'kind', 'brief', 'detail', 'source', 'file', 'line'],
        };
    }
    /** Initialize indexers (uFuzzy + MiniSearch) */
    async init() {
        const ufMod = await Promise.resolve().then(() => __importStar(require("@leeoniya/ufuzzy")));
        const Ufuzzy = resolveClass(ufMod);
        if (Ufuzzy) {
            this.uf = new Ufuzzy(this.ufOptions);
        }
        const msMod = await Promise.resolve().then(() => __importStar(require("minisearch")));
        const MiniSearch = resolveClass(msMod);
        if (MiniSearch) {
            this.ms = new MiniSearch(this.msOptions);
            // Re-add any records pushed before init().
            for (const rec of this.records) {
                this.addToMiniSearch(rec);
            }
        }
    }
    /** Add one record to MiniSearch, skipping duplicates by id. */
    addToMiniSearch(rec) {
        if (!this.ms || typeof this.ms.add !== 'function')
            return;
        if (this.msIds.has(rec.id))
            return;
        try {
            this.ms.add(rec);
            this.msIds.add(rec.id);
        }
        catch (e) {
            console.debug('MiniSearch add error:', e);
        }
    }
    /** Add new records to the index */
    pushRecords(records) {
        this.records.push(...records);
        this.nameHaystack.push(...records.map(r => r.name));
        // Add to MiniSearch if initialized
        for (const rec of records) {
            this.addToMiniSearch(rec);
        }
    }
    /** Clear all records */
    clear() {
        this.records = [];
        this.nameHaystack = [];
        this.msIds.clear();
        if (this.ms && typeof this.ms.removeAll === 'function') {
            this.ms.removeAll();
        }
    }
    /** Load MiniSearch index from serialized JSON */
    async setMiniSearch(msJSON) {
        const msMod = await Promise.resolve().then(() => __importStar(require("minisearch")));
        const MiniSearch = resolveClass(msMod);
        if (!MiniSearch)
            return;
        this.ms = new MiniSearch(this.msOptions);
        this.ms.loadJS(msJSON);
    }
    query(needle, limit) {
        var _a, _b;
        if (this.records.length === 0 || !needle)
            return [];
        const hits = [];
        // uFuzzy name search (priority)
        if (this.uf && typeof this.uf.search === 'function') {
            try {
                const result = this.uf.search(this.nameHaystack, needle);
                const info = result === null || result === void 0 ? void 0 : result[1];
                const order = result === null || result === void 0 ? void 0 : result[2];
                const srcIdxMap = info === null || info === void 0 ? void 0 : info.idx;
                if (srcIdxMap && order) {
                    for (let i = 0; i < order.length; i++) {
                        const ufuzzyOrderIdx = order[i];
                        const srcIdx = srcIdxMap[ufuzzyOrderIdx];
                        const record = this.records[srcIdx];
                        if (!record)
                            continue;
                        // Score based on uFuzzy match quality, then source weight
                        const base = this.baseScore(needle, info, ufuzzyOrderIdx);
                        const score = base * SOURCE_WEIGHTS[record.source] * ((_a = KIND_WEIGHTS[record.kind]) !== null && _a !== void 0 ? _a : 1);
                        hits.push({ record, score, ranges: (_b = info.ranges) === null || _b === void 0 ? void 0 : _b[ufuzzyOrderIdx] });
                    }
                }
            }
            catch (e) {
                console.debug('uFuzzy search error:', e);
            }
        }
        // MiniSearch prose search (if needle is long enough or has spaces)
        if (this.ms && typeof this.ms.search === 'function') {
            if (needle.length >= PROSE_THRESHOLD || needle.includes(' ')) {
                try {
                    const msResults = this.ms.search(needle, {
                        boost: { name: 3, brief: 1.5, detail: 1 },
                        combineWith: 'AND',
                    });
                    for (const r of msResults) {
                        const record = r;
                        if (record && !hits.some(h => h.record.id === record.id)) {
                            hits.push({
                                record,
                                score: (r.score || 0) * SOURCE_WEIGHTS[record.source] * KIND_WEIGHTS[r.kind] * 1000
                            });
                        }
                    }
                }
                catch (e) {
                    console.debug('MiniSearch error:', e);
                }
            }
        }
        // Sort by score descending
        hits.sort((a, b) => b.score - a.score);
        // Dedupe by ID
        const seen = new Set();
        const deduped = hits.filter(h => {
            if (seen.has(h.record.id))
                return false;
            seen.add(h.record.id);
            return true;
        });
        return deduped.slice(0, limit);
    }
    /**
     * Compute a match-quality score from uFuzzy info.
     * uFuzzy's `order` already sorts by quality (chars, intraIns, terms+prefix,
     * interIns, start, cases); we enrich it with source-weight and an absolute
     * scale so MiniSearch prose scores can be compared on the same axis.
     */
    baseScore(needle, info, i) {
        var _a, _b, _c, _d, _e, _f, _g, _h, _j, _k, _l, _m;
        const chars = (_b = (_a = info.chars) === null || _a === void 0 ? void 0 : _a[i]) !== null && _b !== void 0 ? _b : 0;
        const interIns = (_d = (_c = info.interIns) === null || _c === void 0 ? void 0 : _c[i]) !== null && _d !== void 0 ? _d : 0; // insertions between search terms
        const intraIns = (_f = (_e = info.intraIns) === null || _e === void 0 ? void 0 : _e[i]) !== null && _f !== void 0 ? _f : 0; // insertions within terms (typos)
        const start = (_h = (_g = info.start) === null || _g === void 0 ? void 0 : _g[i]) !== null && _h !== void 0 ? _h : 0; // offset of first match char
        const interLft2 = (_k = (_j = info.interLft2) === null || _j === void 0 ? void 0 : _j[i]) !== null && _k !== void 0 ? _k : 0;
        const interRgt2 = (_m = (_l = info.interRgt2) === null || _l === void 0 ? void 0 : _l[i]) !== null && _m !== void 0 ? _m : 0;
        // chars >= needle length = full needle matched
        const fullMatch = chars >= needle.length;
        // No intra-word insertions and no inter-term insertions = contiguous
        const contiguous = intraIns === 0 && interIns === 0;
        // Match starts at position 0 = prefix match (strong signal for identifiers)
        const prefixMatch = start === 0;
        let score = BASE_MATCH_SCORE;
        // Exact match: full needle, contiguous, prefix
        if (fullMatch && contiguous && prefixMatch)
            score = 1000;
        // Prefix match that's fully contiguous but missing chars (shorter needle)
        else if (contiguous && prefixMatch)
            score = 980;
        // Full but non-contiguous (spread across name)
        else if (fullMatch)
            score = 950;
        // Fuzzy
        else
            score = 900;
        // Each intra-word insertion (typo character) is expensive
        score -= intraIns * 20;
        // Inter-term insertions (underscores or gaps between terms)
        score -= interIns * 10;
        // Non-prefix start
        score -= start * 5;
        // Long tail to the right of the match means the match is not the whole name
        score -= interRgt2 * 3;
        return score;
    }
}
exports.SymbolIndex = SymbolIndex;
//# sourceMappingURL=symbolindex.js.map