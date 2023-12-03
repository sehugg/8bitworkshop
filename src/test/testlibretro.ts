import assert from "assert";
import * as fs from "fs";
import { LibRetroRunner } from "../common/wasi/libretro";

async function loadLibretro() {
    const wasmdata = fs.readFileSync(`./wasi/stella2014_libretro_2.wasm`);
    let shim = new LibRetroRunner();
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
