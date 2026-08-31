"use strict";
/**
 * Search Service - combines all search sources (project, toolchain, docs).
 * Provides unified search with query prefix support.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.searchService = exports.SearchService = void 0;
const projectsource_1 = require("./projectsource");
const toolchainsource_1 = require("./toolchainsource");
const docssource_1 = require("./docssource");
const MAX_RESULTS = 50;
class SearchService {
    constructor() {
        this.sources = new Map();
        this.projectSource = new projectsource_1.ProjectSource();
        this.toolchainSource = new toolchainsource_1.ToolchainSource();
        this.docsSource = new docssource_1.DocsSource();
        this.sources.set('project', this.projectSource);
        this.sources.set('toolchain', this.toolchainSource);
        this.sources.set('docs', this.docsSource);
    }
    static getInstance() {
        if (!SearchService.instance) {
            SearchService.instance = new SearchService();
        }
        return SearchService.instance;
    }
    /** Parse a query string and extract prefix modifiers */
    parseQuery(query) {
        if (query.startsWith('#')) {
            return { needle: query.slice(1).trim(), filter: 'symbols' };
        }
        else if (query.startsWith('>')) {
            return { needle: query.slice(1).trim(), filter: 'files' };
        }
        else if (query.startsWith('?')) {
            return { needle: query.slice(1).trim(), filter: 'docs' };
        }
        return { needle: query, filter: 'all' };
    }
    /** Execute a search query across all enabled sources */
    async query(queryStr, limit = MAX_RESULTS) {
        const { needle, filter } = this.parseQuery(queryStr);
        if (!needle)
            return [];
        const results = [];
        // Determine which sources to query
        const sourcesToQuery = [];
        if (filter === 'docs') {
            sourcesToQuery.push(this.docsSource);
        }
        else if (filter === 'files') {
            sourcesToQuery.push(this.projectSource);
        }
        else if (filter === 'symbols') {
            sourcesToQuery.push(this.projectSource);
            sourcesToQuery.push(this.toolchainSource);
        }
        else {
            sourcesToQuery.push(this.projectSource);
            sourcesToQuery.push(this.toolchainSource);
            sourcesToQuery.push(this.docsSource);
        }
        // Query all sources
        for (const source of sourcesToQuery) {
            try {
                await source.ready();
                const hits = await source.query(needle, limit - results.length);
                results.push(...hits);
            }
            catch (e) {
                console.debug('Search source error:', e);
            }
        }
        // Sort by score (already scored by source)
        results.sort((a, b) => b.score - a.score);
        // Apply source weights: project > toolchain > docs
        const sourceWeights = {
            project: 1.3,
            toolchain: 1.0,
            docs: 0.7
        };
        for (const hit of results) {
            const weight = sourceWeights[hit.record.source] || 1.0;
            hit.score *= weight;
        }
        results.sort((a, b) => b.score - a.score);
        // Dedupe by ID
        const seen = new Set();
        const deduped = results.filter(h => {
            if (seen.has(h.record.id))
                return false;
            seen.add(h.record.id);
            return true;
        });
        return deduped.slice(0, limit);
    }
}
exports.SearchService = SearchService;
// Export singleton
exports.searchService = SearchService.getInstance();
//# sourceMappingURL=service.js.map