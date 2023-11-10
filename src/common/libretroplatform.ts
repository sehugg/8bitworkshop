import { init, WASI } from '@wasmer/wasi';
import { AnimationTimer } from './emu';
import { Platform } from './baseplatform';

export class BaseLibretroPlatform { // implements Platform {

  mainElement: HTMLElement;
  timer: AnimationTimer;
  wasi: WASI;

  constructor(mainElement) {
    this.mainElement = mainElement;
    this.timer = new AnimationTimer(60, this.update.bind(this));
  }

  async start() {
    // This is needed to load the WASI library first (since is a Wasm module)
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

    const moduleBytes = fetch("res/quicknes_libretro.wasm");
    const module = await WebAssembly.compileStreaming(moduleBytes);
    // Instantiate the WASI module
    const instance = await wasi.instantiate(module, {});

    // Run the start function
    let exitCode = wasi.start();
    let stdout = wasi.getStdoutString();

    // This should print "hello world (exit code: 0)"
    console.log(`${stdout}(exit code: ${exitCode})`);

    this.wasi = wasi;
  }

  update() {
    // TODO
  }

  reset() {
  }
}
