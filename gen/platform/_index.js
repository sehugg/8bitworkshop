"use strict";
// hard-code platform files for esbuild code-splitting
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    Object.defineProperty(o, k2, { enumerable: true, get: function() { return m[k]; } });
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || function (mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null) for (var k in mod) if (k !== "default" && Object.prototype.hasOwnProperty.call(mod, k)) __createBinding(result, mod, k);
    __setModuleDefault(result, mod);
    return result;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.importPlatform = void 0;
function importPlatform(name) {
    switch (name) {
        case "apple2": return Promise.resolve().then(() => __importStar(require("../platform/apple2")));
        case "arm32": return Promise.resolve().then(() => __importStar(require("../platform/arm32")));
        case "astrocade": return Promise.resolve().then(() => __importStar(require("../platform/astrocade")));
        case "atari7800": return Promise.resolve().then(() => __importStar(require("../platform/atari7800")));
        case "atari8": return Promise.resolve().then(() => __importStar(require("../platform/atari8")));
        case "basic": return Promise.resolve().then(() => __importStar(require("../platform/basic")));
        case "c64": return Promise.resolve().then(() => __importStar(require("../platform/c64")));
        case "coleco": return Promise.resolve().then(() => __importStar(require("../platform/coleco")));
        case "cpc": return Promise.resolve().then(() => __importStar(require("../platform/cpc")));
        case "devel": return Promise.resolve().then(() => __importStar(require("../platform/devel")));
        case "galaxian": return Promise.resolve().then(() => __importStar(require("../platform/galaxian")));
        case "kim1": return Promise.resolve().then(() => __importStar(require("../platform/kim1")));
        case "markdown": return Promise.resolve().then(() => __importStar(require("../platform/markdown")));
        case "msx": return Promise.resolve().then(() => __importStar(require("../platform/msx")));
        case "mw8080bw": return Promise.resolve().then(() => __importStar(require("../platform/mw8080bw")));
        case "nes": return Promise.resolve().then(() => __importStar(require("../platform/nes")));
        case "script": return Promise.resolve().then(() => __importStar(require("../platform/script")));
        case "sms": return Promise.resolve().then(() => __importStar(require("../platform/sms")));
        case "sound_konami": return Promise.resolve().then(() => __importStar(require("../platform/sound_konami")));
        case "sound_williams": return Promise.resolve().then(() => __importStar(require("../platform/sound_williams")));
        case "vcs": return Promise.resolve().then(() => __importStar(require("../platform/vcs")));
        case "vector": return Promise.resolve().then(() => __importStar(require("../platform/vector")));
        case "vectrex": return Promise.resolve().then(() => __importStar(require("../platform/vectrex")));
        case "verilog": return Promise.resolve().then(() => __importStar(require("../platform/verilog")));
        case "vic20": return Promise.resolve().then(() => __importStar(require("../platform/vic20")));
        case "vicdual": return Promise.resolve().then(() => __importStar(require("../platform/vicdual")));
        case "williams": return Promise.resolve().then(() => __importStar(require("../platform/williams")));
        case "x86": return Promise.resolve().then(() => __importStar(require("../platform/x86")));
        case "zmachine": return Promise.resolve().then(() => __importStar(require("../platform/zmachine")));
        case "zx": return Promise.resolve().then(() => __importStar(require("../platform/zx")));
        default: throw new Error(`Platform not recognized: '${name}'`);
    }
}
exports.importPlatform = importPlatform;
//# sourceMappingURL=_index.js.map