"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.LibRetroRunner = void 0;
const wasishim_1 = require("./wasishim");
class LibRetroRunner extends wasishim_1.WASIRunner {
    constructor() {
        super();
    }
    getEnv() {
        return Object.assign(Object.assign({}, super.getEnv()), { retro_environment_callback: (cmd, data) => {
                console.log(`retro_environment_callback: ${cmd}, ${data}`);
                return 0;
            }, retro_video_refresh_callback: (data, width, height, pitch) => {
                console.log(`retro_video_refresh_callback: ${data}, ${width}, ${height}, ${pitch}`);
            }, retro_audio_sample_batch_callback: (data, frames) => {
                console.log(`retro_audio_sample_batch_callback: ${data}, ${frames}`);
            }, retro_audio_sample_callback: (left, right) => {
                console.log(`retro_audio_sample_callback: ${left}, ${right}`);
                return 0;
            }, retro_input_poll_callback: () => {
                console.log(`retro_input_poll_callback`);
            }, retro_input_state_callback: (port, device, index, id) => {
                console.log(`retro_input_state_callback: ${port}, ${device}, ${index}, ${id}`);
                return 0;
            } });
    }
    retro_init() {
        let errno = this.initialize();
        // TODO: if (errno) throw new Error(`retro_init failed: ${errno}`);
        this.exports().retro_init_callbacks();
        this.exports().retro_init();
        this.exports().retro_set_controller_port_device(0, 1);
        this.exports().retro_set_controller_port_device(1, 1);
    }
    retro_api_version() {
        return this.exports().retro_api_version();
    }
    load_rom(path, data) {
        const meta = '';
        this.exports().retro_load_rom(path, data, data.length, meta);
    }
    reset() {
        this.exports().retro_reset();
    }
    advance() {
        this.exports().retro_run();
    }
}
exports.LibRetroRunner = LibRetroRunner;
//# sourceMappingURL=libretro.js.map