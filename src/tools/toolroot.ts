// toolroot - where the CLI finds toolchains, presets and BIOS images: a
// directory laid out like the repo (src/worker/..., presets/, res/).

/**
 * $EIGHTBITWORKSHOP_ROOT when set (the VS Code extension's launcher points it
 * at the extension's toolchains), else the current directory (a checkout).
 */
export function toolRoot(): string {
  return process.env.EIGHTBITWORKSHOP_ROOT || process.cwd();
}

/**
 * What a host that fetches toolchain packs on demand (the npm package and the
 * VS Code terminal command, extension/src/cli.ts) tells the CLI. A checkout
 * has every file already, so it sets none.
 */
export interface ToolchainHost {
  /** Install the packs `platform` (and build `tool`) need; `source` is the main file's text. Throws if the platform isn't offered. */
  ensure(platform?: string, tool?: string, source?: string): Promise<void>;
  /** False for a build tool (id, and its wasm module if any) the packs leave out. */
  providesTool(tool: string, wasmModule?: string): boolean;
  /** False for a platform the install can't build or run. */
  supportsPlatform(platform: string): boolean;
}

let toolchainHost: ToolchainHost | undefined;

export function setToolchainHost(host: ToolchainHost | undefined) {
  toolchainHost = host;
}

/** Make sure the files to build for or run `platform` are under toolRoot(). */
export async function ensureToolchains(platform?: string, tool?: string, source?: string): Promise<void> {
  if (toolchainHost) await toolchainHost.ensure(platform, tool, source);
}

/** Whether this install can build or run `platform` (every platform, in a checkout). */
export function toolchainSupportsPlatform(platform: string): boolean {
  return !toolchainHost || toolchainHost.supportsPlatform(platform);
}

/** Whether this install has build tool `tool`, or can fetch it (every tool, in a checkout). */
export function toolchainProvidesTool(tool: string, wasmModule?: string): boolean {
  return !toolchainHost || toolchainHost.providesTool(tool, wasmModule);
}
