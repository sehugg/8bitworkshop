
// Signal traces that a platform (verilog) exposes to a waveform view.

export interface WaveformMeta {
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
