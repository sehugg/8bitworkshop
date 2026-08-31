"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.DocsSource = void 0;
const symbolindex_1 = require("./symbolindex");
const searchtypes_1 = require("../../common/searchtypes");
class DocsSource {
    constructor() {
        this.id = 'docs';
        this.kind = 'docs';
        this.index = null;
        this.readyPromise = null;
    }
    async ready() {
        if (this.readyPromise)
            return this.readyPromise;
        this.readyPromise = this.load();
        return this.readyPromise;
    }
    async load() {
        return; // TODO
        try {
            const response = await fetch('/docs/searchindex.json');
            if (!response.ok) {
                return;
            }
            const json = await response.json();
            if (json.version !== searchtypes_1.SYMIDX_VERSION) {
                return;
            }
            const indexData = json;
            const idx = new symbolindex_1.SymbolIndex(indexData.records);
            await idx.init();
            if (indexData.ms) {
                await idx.setMiniSearch(indexData.ms);
            }
            this.index = idx;
        }
        catch (e) {
            console.debug('Docs search index unavailable');
        }
    }
    query(needle, limit) {
        if (!this.index)
            return [];
        return this.index.query(needle, limit);
    }
}
exports.DocsSource = DocsSource;
//# sourceMappingURL=docssource.js.map