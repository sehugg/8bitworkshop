
import { WaveformProvider, WaveformScope } from "../waveform";

// The UI the verilog platform asks for. The IDE installs a host (a split
// pane with a waveform, toolbar buttons); headless runs install none, and the
// platform runs without it.
export interface HDLHost {
  /** the scope shown beside `video` */
  createScope(video:HTMLCanvasElement, provider:WaveformProvider) : WaveformScope;
  /** designs with video output get the speed, run and record controls */
  showVideoControls(show:boolean) : void;
  /** evaluations per clock to settle the design; null hides it */
  showSettleCount(evals:number | null) : void;
}

var host : HDLHost | null = null;

export function setHDLHost(h:HDLHost | null) { host = h; }
export function getHDLHost() : HDLHost | null { return host; }
