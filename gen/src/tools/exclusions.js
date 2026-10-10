"use strict";
// exclusions - everything the packaged distributions leave out, in one place.
// Plain data with no imports, so build scripts can load it (scripts/build.mjs
// compiles this file on the fly) as well as the CLI and the pack builder.
//
//   1. PACKS: files the toolchain packs (src/tools/assetpacks.ts) don't carry
//   2. BUNDLE: emulators compiled out of the extension/CLI bundle
//   3. UNSUPPORTED_PLATFORMS: what follows for the packaged CLI
//   4. EXTENSION_UI: platform menu entries the VS Code extension doesn't offer
//
// A full checkout has all of it; only the packaged distributions are limited.
Object.defineProperty(exports, "__esModule", { value: true });
exports.EXTENSION_SKIP_PLATFORMS = exports.EXTENSION_SKIP_FAMILIES = exports.UNSUPPORTED_PLATFORMS = exports.EXCLUDED_PLATFORM_MODULES = exports.UNREVIEWED_TOOLS = exports.ASSET_EXCLUDE = void 0;
// ---- 1. PACKS ----
/**
 * Tracked files the extension never loads. res/: Altirra debug listings, the
 * x86 BIOSes (x86 isn't offered in the extension), CPC and VIC-20 (not offered). Everything else under
 * res/ (kernels, BIOSes, wasm cores) goes in the base pack. src/worker/: the
 * Dialog, Inform 6, armips, YASM, arm-tcc and smlrc toolchains, whose
 * platforms (Z-machine, MIPS, x86, ARM) the extension doesn't offer.
 */
exports.ASSET_EXCLUDE = new RegExp('^(' + [
    'res/atari8/altirra/.*\\.(lab|lst)',
    'res/x86/.*',
    'res/cpc/.*',
    'res/vic20/.*',
    'presets/vic20/.*',
    'src/worker/wasm/(dialogc|armips|inform|yasm|arm-tcc|smlrc)\\.(js|wasm)',
    'src/worker/lib/arm32/.*',
    'src/worker/lib/cpc/.*',
    'src/worker/fs/cc65-fs-vic20\\.zip',
    'src/worker/fs/(dialog-fs\\.zip|arm32-fs\\.zip|fsinform\\.|fssmlrc\\.)[^/]*',
].join('|') + ')$');
/**
 * Toolchain components left out of the packs because their license has not
 * been cleared for redistribution. Review each license, then remove its entry
 * to ship the tool again.
 *
 * Only the packs are affected, so the VS Code bundle and the download servers
 * won't carry these files. A full checkout still works through
 * `8bitworkshop.toolchainPath`, and platforms that need an excluded tool fail
 * to build with a missing-file error until their license is cleared.
 *
 * Each key is a tool id (src/common/toolmeta.ts). Each pattern matches the
 * files that belong to it, under ASSET_DIRS or EXTRA_FILES.
 */
exports.UNREVIEWED_TOOLS = {
    nesasm: [/^src\/worker\/wasm\/nesasm\.(js|wasm)$/],
    merlin32: [/^src\/worker\/wasm\/merlin32\.(js|wasm)$/],
    xasm6809: [/^src\/worker\/asmjs\/xasm6809\.js$/],
    // vasm has a license, but it only allows non-commercial redistribution
    vasm: [/^src\/worker\/wasm\/vasmarm_std\.(js|wasm)$/],
    // TODO: review these too. They are libraries/emulators or tools whose
    // upstream we could not resolve, so their files are not mapped yet.
    //   shiru       shiru's NES/Atari libraries        (presets, src/worker/lib, assumed PD)
    //   makewav     WAV tool, not shipped here
};
// ---- 2. BUNDLE ----
/**
 * Platform modules (src/platform/<id>.ts) replaced by an empty stub in the
 * extension and CLI bundles, so their emulators aren't compiled in. Loading
 * one fails with the usual "Platform not found". Vectrex: the jsvecx emulator
 * (a license still to review, see UNREVIEWED_TOOLS) and its BIOS isn't tracked.
 */
exports.EXCLUDED_PLATFORM_MODULES = ['vectrex'];
// ---- 3. UNSUPPORTED_PLATFORMS ----
/**
 * Platforms the packaged CLI can't build or run: x86 and ARM have no
 * toolchain in the packs, CPC has no library or core, and VIC-20 has no BIOS or
 * core (the open-roms BIOS isn't tracked; see ASSET_EXCLUDE);
 * the modules in EXCLUDED_PLATFORM_MODULES have no emulator. The CLI reports them as
 * unavailable instead of failing partway.
 */
exports.UNSUPPORTED_PLATFORMS = ['x86', 'arm32', 'cpc', 'vic20', ...exports.EXCLUDED_PLATFORM_MODULES];
// ---- 4. EXTENSION_UI ----
/** Families from the IDE's platform menu that the extension can't run. */
exports.EXTENSION_SKIP_FAMILIES = ['MAME/Other', 'Interpreters'];
/**
 * Platforms never offered in the extension, even if the menu lists them.
 * TODO: vector-* need vector video in the webview, williams-z80 a headless
 * sound Worker (notes/PLAN.md, "platforms that don't run in the extension").
 */
exports.EXTENSION_SKIP_PLATFORMS = ['x86', 'vectrex', 'exidy', 'arm32', 'vic20',
    'vector-z80color', 'vector-ataricolor', 'williams-z80', 'cpc'];
//# sourceMappingURL=exclusions.js.map