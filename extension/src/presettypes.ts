// presettypes - the shape of out/presets.json (written by scripts/presetindex.ts).

export interface TemplateInfo {
  /** file name in presets/<dir>/ (skeleton.<tool> for a blank program) */
  id: string;
  name: string;
  /** "Start here" for blank programs, else the IDE's category */
  category: string;
  tool: string;
  /** the name to copy a blank program as (main.c); presets keep their id */
  saveAs?: string;
  /** builds on a server, not offline */
  remote?: boolean;
  /** files only this template reads (copied with it) */
  files: string[];
  /** files other templates read too (resolved from presets/ unless copied) */
  shared: string[];
}

export interface PlatformInfo {
  id: string;
  name: string;
  /** the IDE's menu group: Game Consoles, Computers, Arcade Systems, ... */
  family: string;
  /** presets/<dir> */
  dir: string;
  templates: TemplateInfo[];
}

export interface PresetIndex {
  version: number;
  platforms: PlatformInfo[];
  /** header name -> platforms, for detection */
  headers: { [header: string]: string[] };
}
