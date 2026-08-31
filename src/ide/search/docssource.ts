import { SymbolIndex } from "./symbolindex";
import { SymbolSourceKind, PrebuiltIndex, SYMIDX_VERSION } from "../../common/searchtypes";
import { SearchHit, SearchSource } from "./types";

export class DocsSource implements SearchSource {
  id: string = 'docs';
  kind: SymbolSourceKind = 'docs';
  private index: SymbolIndex | null = null;
  private readyPromise: Promise<void> | null = null;

  constructor() {}

  async ready() {
    if (this.readyPromise) return this.readyPromise;
    this.readyPromise = this.load();
    return this.readyPromise;
  }

  private async load() {
    return; // TODO
    try {
      const response = await fetch('/docs/searchindex.json');
      if (!response.ok) {
        return;
      }
      const json = await response.json();
      if (json.version !== SYMIDX_VERSION) {
        return;
      }
      const indexData = json as PrebuiltIndex;
      const idx = new SymbolIndex(indexData.records);
      await idx.init();
      if (indexData.ms) {
        await idx.setMiniSearch(indexData.ms);
      }
      this.index = idx;
    } catch (e) {
      console.debug('Docs search index unavailable');
    }
  }

  query(needle: string, limit: number): SearchHit[] {
    if (!this.index) return [];
    return this.index.query(needle, limit);
  }
}