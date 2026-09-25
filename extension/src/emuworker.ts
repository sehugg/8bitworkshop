
// emuworker - worker thread that runs one emulator and paces its frames.
// Platform modules expect browser globals (installNodeMocks), which must not
// leak into the shared extension host.

import { parentPort, workerData } from 'worker_threads';
import { performance } from 'perf_hooks';
import { Rpc } from './rpc';
import { EmuTarget, installNodeMocks, loadPlatform } from '../../src/tools/emutarget';

export interface FrameEvent {
  pixels: ArrayBuffer;
  width: number;
  height: number;
  rotate?: number;
  aspect?: number;
}

export interface EmuStatus {
  state: 'running' | 'paused' | 'halted';
  platform: string;
  frame: number;
  message?: string;
}

// frames to run at once when catching up, before giving up and resyncing
const MAX_CATCHUP_FRAMES = 4;

installNodeMocks(workerData.rootDir);

let target: EmuTarget | null = null;
let running = false;
let timer: NodeJS.Timeout | null = null;
let nextTime = 0;

const rpc = new Rpc(parentPort, {
  async start(platform: string, rom: any) {
    stop();
    target = await loadPlatform(platform);
    await target.start();
    target.loadROM(rom);
    resume();
    return status();
  },
  loadROM(rom: any) {
    if (!target) throw new Error('emulator not started');
    target.loadROM(rom);
    resume();
    return status();
  },
  reset() {
    if (!target) return null;
    target.reset();
    sendFrame();
    return status();
  },
  pause() {
    pause();
    return status();
  },
  resume() {
    resume();
    return status();
  },
  key(key: number, code: number, flags: number) {
    try {
      target?.setKeyInput(key, code, flags);
    } catch (e) {
      // platforms without keyboard input ignore keys
    }
  },
  stop() {
    stop();
  },
  status,
});

function status(): EmuStatus | null {
  if (!target) return null;
  return { state: running ? 'running' : 'paused', platform: target.id, frame: target.frameCount };
}

function resume() {
  if (!target || running) return;
  running = true;
  nextTime = performance.now();
  tick();
  rpc.emit('status', status());
}

function pause() {
  running = false;
  if (timer) clearTimeout(timer);
  timer = null;
  rpc.emit('status', status());
}

function stop() {
  pause();
  target = null;
}

function tick() {
  timer = null;
  if (!running || !target) return;
  var interval = 1000 / target.frameRate;
  var now = performance.now();
  var frames = 0;
  try {
    while (nextTime <= now && frames < MAX_CATCHUP_FRAMES) {
      target.advanceFrame();
      nextTime += interval;
      frames++;
    }
  } catch (e) {
    running = false;
    sendFrame();
    rpc.emit('status', { ...status(), state: 'halted', message: String(e && e.message || e) });
    return;
  }
  if (now - nextTime > interval * MAX_CATCHUP_FRAMES) nextTime = now;  // too far behind
  if (frames) sendFrame();
  timer = setTimeout(tick, Math.max(0, nextTime - performance.now()));
}

function sendFrame() {
  var video = target?.getVideo();
  if (!video) return;
  // the platform keeps drawing into its buffer, so send a copy
  var pixels = video.pixels.slice().buffer;
  var frame: FrameEvent = { pixels, width: video.width, height: video.height, rotate: video.rotate, aspect: video.aspect };
  rpc.emit('frame', frame, [pixels]);
}
