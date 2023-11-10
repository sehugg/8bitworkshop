import * as fs from 'fs';
import { init, WASI } from '@wasmer/wasi';

describe('libretro WASI', function () {
    it('Should run core', async function () {
        await init();

        let wasi = new WASI({
            env: {
                // 'ENVVAR1': '1',
                // 'ENVVAR2': '2'
            },
            args: [
                // 'command', 'arg1', 'arg2'
            ],
        });

        // import sock_accept
        let imports = {
            wasi_snapshot_preview1: {
                sock_accept: function (fd, addr, addrlen) {
                    console.log('sock_accept', fd, addr, addrlen);
                }
            },
            env: {
                // A placeholder implementation of __cxa_allocate_exception
                __cxa_allocate_exception: (size) => {
                    console.error('__cxa_allocate_exception called with size:', size);
                    // You should allocate 'size' bytes and return a pointer to this memory
                    // The implementation here depends on how your WASM module handles memory
                    // This is just a dummy implementation and likely won't work correctly
                    return 0; // Returning 0 as a dummy pointer
                },
                __cxa_throw: (ptr, type, destructor) => {
                    console.error('__cxa_throw called, ptr:', ptr, 'type:', type, 'destructor:', destructor);
                    // This function should not return
                    // This is just a dummy implementation and likely won't work correctly
                    throw new Error('cxa_throw called');
                },
                retro_environment_callback: function (cmd, data) {
                    console.log('retro_environment_callback', cmd, data);
                    return 0;
                },
                retro_video_refresh_callback: function (data, width, height, pitch) {
                    console.log('retro_video_refresh_callback', data, width, height, pitch);
                },
                retro_audio_sample_callback: function (left, right) {
                    console.log('retro_audio_sample_callback', left, right);
                },
                retro_audio_sample_batch_callback: function (data, frames) {
                    console.log('retro_audio_sample_batch_callback', data, frames);
                    return frames;
                },
                retro_input_poll_callback: function () {
                    console.log('retro_input_poll_callback');
                },
                retro_input_state_callback: function (port, device, index, id) {
                    console.log('retro_input_state_callback', port, device, index, id);
                    return 1;
                },
            }
        };

        //const moduleBytes = fs.readFileSync("res/quicknes_libretro.wasm");
        const moduleBytes = fs.readFileSync("res/stella2014_libretro.wasm");
        const module = await WebAssembly.compile(moduleBytes);
        // Instantiate the WASI module
        const instance = await wasi.instantiate(module, imports);
        const exports: any = instance.exports;

        // Run the initialize function
        exports._initialize();

        console.log(exports);
        console.log('API version', exports.retro_api_version());
        console.log('callbacks')
        exports.retro_init_callbacks();
        console.log('init');
        exports.retro_init();
        console.log('loading');
        const rompath = 'test/roms/nes/shoot2.c.rom';
        // load rom bytes
        const romdata = fs.readFileSync(rompath);
        /*
        const RetroGameInfo = new Struct({
            path: 'string',
            data: ['char',0],
            size: 'size_t',
            meta: ['char',0]
        });
        const gameinfo = new RetroGameInfo({
            path: rompath,
            data: romdata,
            size: 40976,
            meta: []
        });
        const library = new Wrapper({
            manipulate: [RetroGameInfo],
        }, {memory: instance.exports.memory});
        library.manipulate(gameinfo);
        console.log(gameinfo, gameinfo.ref());
        exports.retro_load_game(gameinfo);
        */
        // TODO
        const rombytes = new Int32Array(romdata.buffer, 0, romdata.length / 4);
        //exports.retro_load_rom(rompath, rombytes, rombytes.length, "");

        let biosBinary = romdata.buffer;
        let biosptr = exports.malloc(biosBinary.byteLength);
        console.log(biosptr, romdata.length);
        //let biosarr = new Uint8Array(exports.memory.buffer, biosptr, biosBinary.byteLength);
        exports.retro_load_rom(rompath, biosptr, romdata.length, rompath);

        //console.log('callbacks again')
        //exports.retro_init_callbacks();
        console.log('set inputs');
        exports.retro_set_controller_port_device(0,1);
        exports.retro_set_controller_port_device(1,1);
        // run
        exports.retro_reset();
        console.log('running');
        exports.retro_run();
        console.log('ran');
    });
});

