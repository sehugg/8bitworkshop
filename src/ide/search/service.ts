/**
 * Search Service - combines all search sources (project, toolchain, docs).
 * Provides unified search with query prefix support.
 */

import { SearchHit, SearchSource } from "./types";
import { SymbolSourceKind, SymbolRecord } from "../../common/searchtypes";
import { ProjectSource } from "./projectsource";
import { ToolchainSource } from "./toolchainsource";
import { DocsSource } from "./docssource";

const MAX_RESULTS = 50;

export class SearchService {
  private static instance: SearchService;
  private sources: Map<string, SearchSource> = new Map();
  private projectSource!: ProjectSource;
  private toolchainSource!: ToolchainSource;
  private docsSource!: DocsSource;

  private constructor() {
    this.projectSource = new ProjectSource();
    this.toolchainSource = new ToolchainSource();
    this.docsSource = new DocsSource();

    this.sources.set('project', this.projectSource);
    this.sources.set('toolchain', this.toolchainSource);
    this.sources.set('docs', this.docsSource);
  }

  static getInstance(): SearchService {
    if (!SearchService.instance) {
      SearchService.instance = new SearchService();
    }
    return SearchService.instance;
  }

  /** Parse a query string and extract prefix modifiers */
  private parseQuery(query: string): { needle: string; filter: 'all' | 'symbols' | 'files' | 'docs' } {
    if (query.startsWith('#')) {
      return { needle: query.slice(1).trim(), filter: 'symbols' };
    } else if (query.startsWith('>')) {
      return { needle: query.slice(1).trim(), filter: 'files' };
    } else if (query.startsWith('?')) {
      return { needle: query.slice(1).trim(), filter: 'docs' };
    }
    return { needle: query, filter: 'all' };
  }

  /** Execute a search query across all enabled sources */
  async query(queryStr: string, limit: number = MAX_RESULTS): Promise<SearchHit[]> {
    const { needle, filter } = this.parseQuery(queryStr);

    if (!needle) return [];

    const results: SearchHit[] = [];

    // Determine which sources to query
    const sourcesToQuery: SearchSource[] = [];
    if (filter === 'docs') {
      sourcesToQuery.push(this.docsSource);
    } else if (filter === 'files') {
      sourcesToQuery.push(this.projectSource);
    } else if (filter === 'symbols') {
      sourcesToQuery.push(this.projectSource);
      sourcesToQuery.push(this.toolchainSource);
    } else {
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
      } catch (e) {
        console.debug('Search source error:', e);
      }
    }

    // Sort by score (already scored by source)
    results.sort((a, b) => b.score - a.score);

    // Apply source weights: project > toolchain > docs
    const sourceWeights: Record<string, number> = {
      project: 1.3,
      toolchain: 1.0,
      docs: 0.7
    };

    for (const hit of results) {
      const weight = sourceWeights[hit.record.source as string] || 1.0;
      hit.score *= weight;
    }

    results.sort((a, b) => b.score - a.score);

    // Dedupe by ID
    const seen = new Set<string>();
    const deduped = results.filter(h => {
      if (seen.has(h.record.id)) return false;
      seen.add(h.record.id);
      return true;
    });

    return deduped.slice(0, limit);
  }
}

// Export singleton
export const searchService = SearchService.getInstance();