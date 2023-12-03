"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
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
const fs = __importStar(require("fs"));
const libretro_1 = require("../common/wasi/libretro");
async function loadLibretro() {
    const wasmdata = fs.readFileSync(`./wasi/stella2014_libretro_2.wasm`);
    let shim = new libretro_1.LibRetroRunner();
    await shim.loadAsync(wasmdata);
    return shim;
}
/*
describe('test WASI libretro', function () {
    it('libretro init', async function () {
        let shim = await loadLibretro();
        assert.strictEqual(1, shim.retro_api_version());
        shim.retro_init();
        let romdata = fs.readFileSync(`./test/roms/vcs/brickgame.rom`);
        shim.load_rom('brickgame.rom', romdata);
        shim.reset();
        shim.advance();
    });
});
*/
//# sourceMappingURL=testlibretro.js.map