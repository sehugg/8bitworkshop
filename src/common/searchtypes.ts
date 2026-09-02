export type SymbolKind =
  | 'func'
  | 'macro'
  | 'type'
  | 'struct'
  | 'enum'
  | 'var'
  | 'label'
  | 'equate'
  | 'proc'
  | 'module'
  | 'doc'
  | 'text';

export type SymbolSourceKind = 'project' | 'toolchain' | 'docs' | 'debugger';

export interface SymbolRecord {
  id: string;              // stable, unique within a corpus: \`${file}:${line}:${name}\`
  name: string;            // the identifier, or page title for docs
  kind: SymbolKind;
  signature?: string;      // rendered declaration, verbatim source text
  brief?: string;          // first sentence of the doc comment
  detail?: string;         // remainder of the doc comment
  section?: string;        // enclosing banner-comment heading, e.g. "Declarations"
  source: SymbolSourceKind;
  file: string;            // project path | '/include/joystick.h' | page URL
  line?: number;           // 1-based
  url?: string;            // docs only
  addr?: number;           // debugger only: runtime address of the symbol
}

/** On-disk shape of a prebuilt index (gen/symidx/<name>.json). */
export interface PrebuiltIndex {
  version: number;         // bump when the extractor changes; runtime rejects mismatches
  corpus: string;          // fs name, e.g. 'fs65-c64', or 'docs'
  generated: string;       // ISO date
  records: SymbolRecord[];
  ms?: object;             // MiniSearch.toJSON() output, loaded via loadJSAsync
}

export const SYMIDX_VERSION = 1;
