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
  // the explicit import switch, so bundlers can find every platform module
  await importPlatform(baseId);
  const PlatformClass = PLATFORMS[platformId] || PLATFORMS[baseId];
  if (!PlatformClass) {
    throw new Error(`Platform '${platformId}' not found. Available: ${Object.keys(PLATFORMS).sort().join(', ')}`);
  }
  return new EmuCore(platformId, new PlatformClass(null));
}

let mocksInstalled = false;

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
