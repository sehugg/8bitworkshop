"use strict";
// toolroot - where the CLI finds toolchains, presets and BIOS images: a
// directory laid out like the repo (src/worker/..., presets/, res/).
Object.defineProperty(exports, "__esModule", { value: true });
exports.toolRoot = toolRoot;
exports.setToolchainHost = setToolchainHost;
exports.ensureToolchains = ensureToolchains;
exports.toolchainSupportsPlatform = toolchainSupportsPlatform;
exports.toolchainProvidesTool = toolchainProvidesTool;
/**
 * $EIGHTBITWORKSHOP_ROOT when set (the VS Code extension's launcher points it
 * at the extension's toolchains), else the current directory (a checkout).
 */
function toolRoot() {
    return process.env.EIGHTBITWORKSHOP_ROOT || process.cwd();
}
let toolchainHost;
function setToolchainHost(host) {
    toolchainHost = host;
}
/** Make sure the files to build for or run `platform` are under toolRoot(). */
async function ensureToolchains(platform, tool, source) {
    if (toolchainHost)
        await toolchainHost.ensure(platform, tool, source);
}
/** Whether this install can build or run `platform` (every platform, in a checkout). */
function toolchainSupportsPlatform(platform) {
    return !toolchainHost || toolchainHost.supportsPlatform(platform);
}
/** Whether this install has build tool `tool`, or can fetch it (every tool, in a checkout). */
function toolchainProvidesTool(tool, wasmModule) {
    return !toolchainHost || toolchainHost.providesTool(tool, wasmModule);
}
//# sourceMappingURL=toolroot.js.map