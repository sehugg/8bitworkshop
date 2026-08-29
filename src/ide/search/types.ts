import { SymbolRecord, SymbolSourceKind } from "../../common/searchtypes";

export interface SearchHit {
  record: SymbolRecord;
  score: number;
  ranges?: number[];
}

export interface SearchSource {
  id: string;
  kind: SymbolSourceKind;
  ready(): Promise<void>;
  query(needle: string, limit: number): SearchHit[];
}

export interface SearchQuery {
  type: 'all' | 'symbols' | 'files' | 'docs';
  file?: string;
  needle: string;
}