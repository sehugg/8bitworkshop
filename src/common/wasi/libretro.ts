import { WASIRunner } from "./wasishim";

export class LibRetroRunner extends WASIRunner {
    constructor() {
        super();
    }
    getEnv() {
        return {
            ...super.getEnv(),
            retro_environment_callback: (cmd: number, data: number) => {
                console.log(`retro_environment_callback: ${cmd}, ${data}`);
                return 0;
            },
            retro_video_refresh_callback: (data: number, width: number, height: number, pitch: number) => {
                console.log(`retro_video_refresh_callback: ${data}, ${width}, ${height}, ${pitch}`);
            },
            retro_audio_sample_batch_callback: (data: number, frames: number) => {
                console.log(`retro_audio_sample_batch_callback: ${data}, ${frames}`);
            },
            retro_audio_sample_callback: (left: number, right: number) => {
                console.log(`retro_audio_sample_callback: ${left}, ${right}`);
                return 0;
            },
            retro_input_poll_callback: () => {
                console.log(`retro_input_poll_callback`);
            },
            retro_input_state_callback: (port: number, device: number, index: number, id: number) => {
                console.log(`retro_input_state_callback: ${port}, ${device}, ${index}, ${id}`);
                return 0;
            },
        }
    }
    retro_init() {
        let errno = this.initialize();
        // TODO: if (errno) throw new Error(`retro_init failed: ${errno}`);
        this.exports().retro_init_callbacks();
        this.exports().retro_init();
        this.exports().retro_set_controller_port_device(0,1);
        this.exports().retro_set_controller_port_device(1,1);
    }
    retro_api_version() {
        return this.exports().retro_api_version();
    }
    load_rom(path: string, data: Uint8Array) {
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
