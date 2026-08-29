import { SymbolIndex } from "./symbolindex";
import { SymbolSourceKind, PrebuiltIndex, SYMIDX_VERSION } from "../../common/searchtypes";
import { SearchHit, SearchSource } from "./types";
import { current_project } from "../ui";
import { getSharedFileSystemName } from "../../common/toolmeta";

export class ToolchainSource implements SearchSource {
  id: string = 'toolchain';
  kind: SymbolSourceKind = 'toolchain';
  private indices: Map<string, SymbolIndex> = new Map();
  private corpusReady: Map<string, boolean> = new Map();

  constructor() {}

  async ready() {
    const project = current_project;
    if (!project) return;

    const tool = project.getToolForFilename(project.mainPath);
    const corpus = getSharedFileSystemName(tool, project.platform_id);
    if (corpus) {
      await this.loadCorpus(corpus);
    }
  }

  async loadCorpus(corpus: string) {
    if (this.corpusReady.get(corpus)) return;

    try {
      const url = `gen/symidx/${corpus}.json`;
      const response = await fetch(url);
      if (!response.ok) {
        this.corpusReady.set(corpus, true);
        return;
      }
      const json = await response.json();
      if (json.version !== SYMIDX_VERSION) {
        this.corpusReady.set(corpus, true);
        return;
      }
      const indexData = json as PrebuiltIndex;
      const idx = new SymbolIndex(indexData.records);
      await idx.init();
      if (indexData.ms) {
        await idx.setMiniSearch(indexData.ms);
      }
      this.indices.set(corpus, idx);
      this.corpusReady.set(corpus, true);
    } catch (e) {
      console.debug('Failed to load toolchain index:', e);
      this.corpusReady.set(corpus, true);
    }
  }

  query(needle: string, limit: number): SearchHit[] {
    const hits: SearchHit[] = [];
    for (const idx of this.indices.values()) {
      const result = idx.query(needle, limit);
      hits.push(...result);
    }
    return hits.slice(0, limit);
  }

  invalidate() {
    this.indices.clear();
    this.corpusReady.clear();
  }
}