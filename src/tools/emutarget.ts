// The Node side of headless emulation: browser mocks and platform loading.
// The emulator driver itself is EmuCore (src/common/emucore.ts); EmuTarget is
// the name the CLI and the extension know it by.

import { EmuCore } from "../common/emucore";
import { PLATFORMS } from "../common/emu";
import { getRootBasePlatform } from "../common/util";
import { importPlatform } from "../platform/_index";
import { mockAudio, mockDOM, mockFetch, mockGlobals, mockScripts } from "./nodemock";

export { EmuCore as EmuTarget, DISASSEMBLERS, DEFAULT_MAX_FRAMES } from "../common/emucore";
export type { VideoOutput, DebugSection } from "../common/emucore";
type EmuTarget = EmuCore;

/** Load a platform module by ID (e.g. "nes", "c64.wasm", "atari8-5200"). */
export async function loadPlatform(platformId: string): Promise<EmuTarget> {
  installNodeMocks();
  const baseId = getRootBasePlatform(platformId);
  // a platform module (verilog) may pull in an Emscripten runtime whose
  // rejection handler aborts the host; disarm it around the import
  const keep = captureRejectionListeners();
  // the explicit import switch, so bundlers can find every platform module
  await importPlatform(baseId);
  dropAbortHandlers(keep);
  const PlatformClass = PLATFORMS[platformId] || PLATFORMS[baseId];
  if (!PlatformClass) {
    throw new Error(`Platform '${platformId}' not found. Available: ${Object.keys(PLATFORMS).sort().join(', ')}`);
  }
  return new EmuCore(platformId, new PlatformClass(null));
}

let mocksInstalled = false;

/**
 * The process-level unhandledRejection listeners currently installed. Capture
 * this before importing a platform (see dropAbortHandlers).
 */
export function captureRejectionListeners(): Set<Function> {
  return new Set(process.listeners('unhandledRejection'));
}

/**
 * Drop process-level unhandledRejection handlers added since `keep` was
 * captured. Emscripten runtimes (binaryen, imported by the verilog platform)
 * register one that aborts the host, so a stray async rejection from an
 * emulator would otherwise kill the process or worker thread. A host that
 * wants to collect the rejections installs its own listener before capturing;
 * otherwise a logging one is left so Node doesn't fall back to its default
 * throw.
 */
export function dropAbortHandlers(keep: Set<Function>) {
  for (const listener of process.listeners('unhandledRejection')) {
    if (!keep.has(listener)) process.removeListener('unhandledRejection', listener);
  }
  if (process.listenerCount('unhandledRejection') === 0) {
    process.on('unhandledRejection', (reason) => console.error('unhandled rejection:', reason));
  }
}

/**
 * Stub out the browser APIs that the platform modules expect. fetch() reads
 * files (BIOS images, wasm cores) and loadScript() evaluates scripts relative
 * to `rootDir`. Only the first call takes effect.
 */
export function installNodeMocks(rootDir: string = process.cwd()) {
  if (mocksInstalled) return;
  mocksInstalled = true;
  mockGlobals();
  mockAudio();
  mockFetch(rootDir);
  mockScripts(rootDir);
  mockDOM();
}
