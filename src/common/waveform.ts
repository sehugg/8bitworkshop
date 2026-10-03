
// Signal traces that a platform (verilog) exposes to a waveform view.

export interface WaveformMeta {
  /** the key in the design's state, when it differs from the label (see vcd.ts) */
  name? : string;
  label : string;
  len : number;
  input : boolean;
  output : boolean;
}

export interface WaveformProvider {
  getSignalMetadata() : WaveformMeta[];
  getSignalData(index:number, start:number, len:number) : number[];
  setSignalValue(index:number, value:number);
}

// The scope a platform shows beside its video (see HDLHost).
export interface WaveformScope {
  /** true when the scope is on screen, so the platform should record traces */
  isVisible() : boolean;
  /** make the scope visible (designs with no video output) */
  show() : void;
  /** move the view's cursor to clock `t` */
  setCurrentTime(t:number) : void;
  /** draw the latest trace data, if visible */
  update() : void;
  /** the emulator pane changed size */
  resize() : void;
}

/**
 * One signal's values from a trace buffer of `nsig` signals' values per clock
 * (`index` is the signal's place in a clock, `start` the first clock). A
 * buffer that `wrap`s goes back to its start at `last`.
 */
export function readTraceSignal(buf:ArrayLike<number>, nsig:number, last:number, wrap:boolean,
                                index:number, start:number, len:number) : number[] {
  var a = [];
  index += nsig * start;
  while (index < last && a.length < len) {
    a.push(buf[index]);
    index += nsig;
    if (wrap && index >= last) // TODO: what if starts with index==last
      index = 0;
  }
  return a;
}

/** The trace a platform has so far, to copy to a view that can't call the platform. */
export interface WaveformSnapshot {
  meta: WaveformMeta[];
  /** the values, `meta.length` per clock */
  data: Uint32Array;
  wrap: boolean;
  /** the clock being run now */
  now: number;
}

/** A WaveformProvider over a snapshot; `setValue` sends writes back to the platform. */
export class TraceMirror implements WaveformProvider {
  snapshot : WaveformSnapshot | null = null;

  constructor(private setValue:(index:number, value:number) => void) { }

  getSignalMetadata() { return this.snapshot ? this.snapshot.meta : []; }

  getSignalData(index:number, start:number, len:number) {
    var s = this.snapshot;
    if (!s) return [];
    return readTraceSignal(s.data, s.meta.length, s.data.length, s.wrap, index, start, len);
  }

  setSignalValue(index:number, value:number) { this.setValue(index, value); }
}
