
import { WasmFs } from "@wasmer/wasmfs";
import { CpuState, EmuState } from "./baseplatform";
import { CPU, SampledAudioSink, ProbeAll, NullProbe } from "./devices";
import { EmuHalt } from "./emu";

// WASM Support
// TODO: detangle from c64

export abstract class BaseWASMMachine {
  prefix : string;
  instance : WebAssembly.Instance;
  exports : any;
  sys : number;
  pixel_dest : Uint32Array;
  pixel_src : Uint32Array;
  stateptr : number;
  statearr : Uint8Array;
  cpustateptr : number;
  cpustatearr : Uint8Array;
  ctrlstateptr : number;
  ctrlstatearr : Uint8Array;
  cpu : CPU;
  romptr : number;
  romlen : number;
  romarr : Uint8Array;
  biosptr : number;
  biosarr : Uint8Array;
  audio : SampledAudioSink;
  audioarr : Float32Array;
  probe : ProbeAll;
  maxROMSize : number = 0x40000;

  abstract getCPUState() : CpuState;
  abstract saveState() : EmuState;
  abstract loadState(state: EmuState);

  constructor(prefix: string) {
    this.prefix = prefix;
    var self = this;
    this.cpu = {
      getPC: self.getPC.bind(self),
      getSP: self.getSP.bind(self),
      isStable: self.isStable.bind(self),
      reset: self.reset.bind(self),
      saveState: () => {
        return self.getCPUState();
      },
      loadState: () => {
        console.log("loadState not implemented")
      },
      connectMemoryBus() {
        console.log("connectMemoryBus not implemented")
      },
    }
  }
  getImports(wmod: WebAssembly.Module) {
    return {};
  }
  async fetchWASM() {
    var wasmResponse = await fetch('res/'+this.prefix+'.wasm');
    if (wasmResponse.status == 200 || (wasmResponse as any as Blob).size) {
      var wasmBinary = await wasmResponse.arrayBuffer();
      var wasmCompiled = await WebAssembly.compile(wasmBinary);
      var wasmResult = await WebAssembly.instantiate(wasmCompiled, this.getImports(wasmCompiled));
      this.instance = wasmResult;
      this.exports = wasmResult.exports;
    } else throw new Error('could not load WASM file');
  }
  async fetchBIOS() {
    var biosResponse = await fetch('res/'+this.prefix+'.bios');
    if (biosResponse.status == 200 || (biosResponse as any as Blob).size) {
      var biosBinary = await biosResponse.arrayBuffer();
      this.biosptr = this.exports.malloc(biosBinary.byteLength);
      this.biosarr = new Uint8Array(this.exports.memory.buffer, this.biosptr, biosBinary.byteLength);
      this.loadBIOS(new Uint8Array(biosBinary));
    } else throw new Error('could not load BIOS file');
  }
  async initWASM() {
    // init machine instance
    this.sys = this.exports.machine_init(this.biosptr);
    let statesize = this.exports.machine_get_state_size();
    this.stateptr = this.exports.malloc(statesize);
    let ctrlstatesize = this.exports.machine_get_controls_state_size();
    this.ctrlstateptr = this.exports.malloc(ctrlstatesize);
    let cpustatesize = this.exports.machine_get_cpu_state_size();
    this.cpustateptr = this.exports.malloc(cpustatesize);
    this.romptr = this.exports.malloc(this.maxROMSize);
    // create state buffers
    // must do this after allocating memory (and everytime we grow memory?)
    this.statearr = new Uint8Array(this.exports.memory.buffer, this.stateptr, statesize);
    this.ctrlstatearr = new Uint8Array(this.exports.memory.buffer, this.ctrlstateptr, ctrlstatesize);
    this.cpustatearr = new Uint8Array(this.exports.memory.buffer, this.cpustateptr, cpustatesize);
    // create audio buffer
    let sampbufsize = 4096*4;
    this.audioarr = new Float32Array(this.exports.memory.buffer, this.exports.machine_get_sample_buffer(), sampbufsize);
    // create ROM buffer
    this.romarr = new Uint8Array(this.exports.memory.buffer, this.romptr, this.maxROMSize);
    // enable c64 joystick map to arrow keys (TODO)
    //this.exports.c64_set_joystick_type(this.sys, 1);
    console.log('machine_init', this.sys, statesize, ctrlstatesize, cpustatesize, sampbufsize);
  }
  async loadWASM() {
    await this.fetchWASM();
    this.exports.memory.grow(96); // TODO: need more when probing?
    await this.fetchBIOS();
    await this.initWASM();
  }
  getPC() : number {
    return this.exports.machine_cpu_get_pc(this.sys);
  }
  getSP() : number {
    return this.exports.machine_cpu_get_sp(this.sys);
  }
  isStable() : boolean {
    return this.exports.machine_cpu_is_stable(this.sys);
  }
  loadROM(rom: Uint8Array) {
    if (rom.length > this.maxROMSize) throw new EmuHalt(`Rom size too big: ${rom.length} bytes`);
    this.romarr.set(rom);
    this.romlen = rom.length;
    console.log('load rom', rom.length, 'bytes');
    this.reset(); // TODO?
  }
  // TODO: can't load after machine_init
  loadBIOS(srcArray: Uint8Array) {
    this.biosarr.set(srcArray);
  }
  reset() {
    this.exports.machine_reset(this.sys);
  }
  /* TODO: we don't need this because c64_exec does this?
  pollControls() {
    this.exports.machine_start_frame(this.sys);
  }
  */
  read(address: number) : number {
    return this.exports.machine_mem_read(this.sys, address & 0xffff);
  }
  readConst(address: number) : number {
    return this.exports.machine_mem_read(this.sys, address & 0xffff);
  }
  write(address: number, value: number) : void {
    this.exports.machine_mem_write(this.sys, address & 0xffff, value & 0xff);
  }
  getAudioParams() {
    return {sampleRate:44100, stereo:false};
  }
  videoOffsetBytes = 0;
  connectVideo(pixels:Uint32Array) : void {
    this.pixel_dest = pixels;
    var pixbuf = this.exports.machine_get_pixel_buffer(this.sys); // save video pointer
    console.log('connectVideo', pixbuf, pixels.length);
    this.pixel_src = new Uint32Array(this.exports.memory.buffer, pixbuf+this.videoOffsetBytes, pixels.length);
  }
  syncVideo() {
    if (this.exports.machine_update_video) {
      this.exports.machine_update_video(this.sys);
    }
    if (this.pixel_dest != null) {
      this.pixel_dest.set(this.pixel_src);
    }
  }
  // assume controls buffer is smaller than cpu buffer
  saveControlsState() : any {
    //console.log(1, this.romptr, this.romlen, this.ctrlstateptr, this.romarr.slice(0,4), this.ctrlstatearr.slice(0,4));
    this.exports.machine_save_controls_state(this.sys, this.ctrlstateptr);
    //console.log(2, this.romptr, this.romlen, this.ctrlstateptr, this.romarr.slice(0,4), this.ctrlstatearr.slice(0,4));
    return { controls:this.ctrlstatearr.slice(0) }
  }
  loadControlsState(state) : void {
    this.ctrlstatearr.set(state.controls);
    this.exports.machine_load_controls_state(this.sys, this.ctrlstateptr);
  }
  connectAudio(audio : SampledAudioSink) : void {
    this.audio = audio;
  }
  syncAudio() {
    if (this.audio != null) {
      var n = this.exports.machine_get_sample_count();
      for (var i=0; i<n; i++) {
        this.audio.feedSample(this.audioarr[i], 1);
      }
    }
  }
  // TODO: tick might advance 1 instruction
  advanceFrameClock(trap, cpf:number) : number {
    var i : number;
    if (trap) {
      for (i=0; i<cpf; i++) {
        if (trap()) {
          break;
        }
        this.exports.machine_tick(this.sys);
      }
    } else {
      this.exports.machine_exec(this.sys, cpf);
      i = cpf;
    }
    this.syncVideo();
    this.syncAudio();
    return i;
  }
  copyProbeData() {
    if (this.probe && !(this.probe instanceof NullProbe)) {
      var datalen = this.exports.machine_get_probe_buffer_size();
      var dataaddr = this.exports.machine_get_probe_buffer_address();
      // TODO: more efficient way to put into probe
      var databuf = new Uint32Array(this.exports.memory.buffer, dataaddr, datalen);
      this.probe.logNewFrame(); // TODO: machine should do this
      this.probe.addLogBuffer(databuf);
    }
  }
  connectProbe(probe: ProbeAll): void {
    this.probe = probe;
  }
  getDebugTree() {
    return this.saveState();
  }
}

let stub = function() { console.log(arguments); return 0 }

export abstract class BaseWASIMachine extends BaseWASMMachine {
  m_wasi;
  wasiInstance;
  wasmFs : WasmFs;
  
  constructor(prefix: string) {
    super(prefix);
  }
  getImports(wmod: WebAssembly.Module) {
    var imports = this.wasiInstance.getImports(wmod);
    // TODO: eliminate these imports
    imports.env = {
      system: stub,
      __sys_mkdir: stub,
      __sys_chmod: stub,
      __sys_stat64: stub,
      __sys_unlink: stub,
      __sys_rename: stub,
      __sys_getdents64: stub,
      __sys_getcwd: stub,
      __sys_rmdir: stub,
      emscripten_thread_sleep: stub,
    }
    return imports;
  }
  stdoutWrite(buffer) {
    console.log('>>>', buffer.toString());
    return buffer.length;
  }
  async loadWASM() {
    let WASI = await import('@wasmer/wasi');
    let WasmFs = await import('@wasmer/wasmfs');
    this.wasmFs = new WasmFs.WasmFs();
    let bindings = WASI.WASI.defaultBindings;
    bindings.fs = this.wasmFs.fs;
    bindings.fs.mkdirSync('/tmp');
    bindings.path = bindings.path.default;
    this.wasiInstance = new WASI.WASI({
      preopenDirectories: {'/tmp':'/tmp'},
      env: {},
      args: [],
      bindings: bindings
    });
    this.wasmFs.volume.fds[1].write = this.stdoutWrite.bind(this);
    this.wasmFs.volume.fds[2].write = this.stdoutWrite.bind(this);
    await this.fetchWASM();
    this.wasiInstance.start(this.instance);
    await this.initWASM();
  }
}
