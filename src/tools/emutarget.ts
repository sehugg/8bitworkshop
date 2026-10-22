// The Node side of headless emulation: browser mocks and platform loading.
// The emulator driver itself is EmuCore (src/common/emucore.ts); EmuTarget is
// the name the CLI and the extension know it by.

import { EmuCore } from "../common/emucore";
import { PLATFORMS } from "../common/emu";
import { getRootBasePlatform } from "../common/util";
import { importPlatform } from "../platform/_index";
import { ensureToolchains, toolRoot } from "./toolroot";
import { mockAudio, mockDOM, mockFetch, mockGlobals, mockScripts, resetScripts } from "./nodemock";

export { EmuCore as EmuTarget, DEFAULT_MAX_FRAMES } from "../common/emucore";
export type { VideoOutput, DebugSection } from "../common/emucore";
type EmuTarget = EmuCore;

/** Load a platform module by ID (e.g. "nes", "c64.wasm", "atari8-5200"). */
export async function loadPlatform(platformId: string, options?: any): Promise<EmuTarget> {
  await ensureToolchains(platformId);
  installNodeMocks(toolRoot());
  // a headless host may load more than one platform (or the same one twice)
  // in a process; scripts kept global state, so evaluate them fresh each time
  resetScripts();
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
  return new EmuCore(platformId, new PlatformClass(null, options));
}

let mocksInstalled = false;

/**
 * The process-level events an Emscripten runtime hooks to abort the host: an
 * unhandled rejection makes it abort, and its uncaughtException handler
 * rethrows anything that is not one of its own runtime errors, which node
 * turns into exit code 7. Both take the host down with them, so they are
 * dropped when a platform module is loaded.
 */
const RUNTIME_EVENTS = ['unhandledRejection', 'uncaughtException'] as const;

/** The process-level listeners currently installed, for the events above. */
export function captureRejectionListeners(): Map<string, Set<Function>> {
  const snapshot = new Map<string, Set<Function>>();
  for (const event of RUNTIME_EVENTS) snapshot.set(event, new Set(process.listeners(event as any)));
  return snapshot;
}

/**
 * Drop process-level handlers added since `keep` was captured. Emscripten
 * runtimes (binaryen, imported by the verilog platform) register one that
 * aborts the host, so a stray async rejection from an emulator would
 * otherwise kill the process or worker thread. A host that wants to collect
 * the rejections installs its own listener before capturing; otherwise a
 * logging one is left so Node doesn't fall back to its default throw.
 */
export function dropAbortHandlers(keep: Map<string, Set<Function>>) {
  for (const event of RUNTIME_EVENTS) {
    const before = keep.get(event);
    for (const listener of process.listeners(event as any)) {
      if (!before || !before.has(listener)) process.removeListener(event as any, listener);
    }
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
  // the binaryen shim (extension build) reads this when it is imported on the
  // main thread, where workerData is unavailable (presetindex)
  (globalThis as any).__8bitworkshopAssetRoot = rootDir;
  if (mocksInstalled) return;
  mocksInstalled = true;
  mockGlobals();
  mockAudio();
  mockFetch(rootDir);
  mockScripts(rootDir);
  mockDOM();
}
