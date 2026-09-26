"use strict";
// The Node side of headless emulation: browser mocks and platform loading.
// The emulator driver itself is EmuCore (src/common/emucore.ts); EmuTarget is
// the name the CLI and the extension know it by.
Object.defineProperty(exports, "__esModule", { value: true });
exports.DEFAULT_MAX_FRAMES = exports.DISASSEMBLERS = exports.EmuTarget = void 0;
exports.loadPlatform = loadPlatform;
exports.installNodeMocks = installNodeMocks;
const emucore_1 = require("../common/emucore");
const emu_1 = require("../common/emu");
const util_1 = require("../common/util");
const _index_1 = require("../platform/_index");
const nodemock_1 = require("./nodemock");
var emucore_2 = require("../common/emucore");
Object.defineProperty(exports, "EmuTarget", { enumerable: true, get: function () { return emucore_2.EmuCore; } });
Object.defineProperty(exports, "DISASSEMBLERS", { enumerable: true, get: function () { return emucore_2.DISASSEMBLERS; } });
Object.defineProperty(exports, "DEFAULT_MAX_FRAMES", { enumerable: true, get: function () { return emucore_2.DEFAULT_MAX_FRAMES; } });
/** Load a platform module by ID (e.g. "nes", "c64.wasm", "atari8-5200"). */
async function loadPlatform(platformId) {
    installNodeMocks();
    const baseId = (0, util_1.getRootBasePlatform)(platformId);
    // the explicit import switch, so bundlers can find every platform module
    await (0, _index_1.importPlatform)(baseId);
    const PlatformClass = emu_1.PLATFORMS[platformId] || emu_1.PLATFORMS[baseId];
    if (!PlatformClass) {
        throw new Error(`Platform '${platformId}' not found. Available: ${Object.keys(emu_1.PLATFORMS).sort().join(', ')}`);
    }
    return new emucore_1.EmuCore(platformId, new PlatformClass(null));
}
let mocksInstalled = false;
/**
 * Stub out the browser APIs that the platform modules expect. fetch() reads
 * files (BIOS images, wasm cores) and loadScript() evaluates scripts relative
 * to `rootDir`. Only the first call takes effect.
 */
function installNodeMocks(rootDir = process.cwd()) {
    if (mocksInstalled)
        return;
    mocksInstalled = true;
    (0, nodemock_1.mockGlobals)();
    (0, nodemock_1.mockAudio)();
    (0, nodemock_1.mockFetch)(rootDir);
    (0, nodemock_1.mockScripts)(rootDir);
    (0, nodemock_1.mockDOM)();
}
//# sourceMappingURL=emutarget.js.map