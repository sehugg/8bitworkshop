// The Waveform view's page script (bundled to out/waveformview.js, which
// waveformHtml in views.ts loads). The drawing, zooming and keys are the IDE's
// (WaveformCore); this adds the DOM, over a copy of the platform's trace.

import { WaveformCore } from '../../../src/common/waveformcore';
import { TraceMirror, WaveformMeta, WaveformSnapshot } from '../../../src/common/waveform';
import { VirtualList } from '../../../src/common/vlist';

declare function acquireVsCodeApi(): { postMessage(msg: any): void };
const vscode = acquireVsCodeApi();

const ROW_HEIGHT = 40;
const SCROLLBAR_WIDTH = 12;

const byId = (id: string) => document.getElementById(id)!;

/** Does the keyboard event match a binding like `ctrl+shift+left` (see WaveformCore.getActions)? */
function keyMatches(e: KeyboardEvent, binding: string) {
  const parts = binding.split('+');
  const k = parts.pop()!;
  const name = ({ left: 'ArrowLeft', right: 'ArrowRight', space: ' ' } as any)[k] || k;
  const zoom = k === '=' || k === '-';
  if (zoom ? e.key !== k && !(k === '=' && e.key === '+') : e.key.toLowerCase() !== name.toLowerCase()) return false;
  if (e.ctrlKey !== parts.includes('ctrl')) return false;
  return zoom || e.shiftKey === parts.includes('shift');
}

class WebviewWaveform extends WaveformCore {
  mirror: TraceMirror;
  wavelist: any;
  rows = byId('rows');
  clklabel = document.createElement('span');
  private metaKey = '';

  constructor() {
    const mirror = new TraceMirror((index, value) => vscode.postMessage({ type: 'setSignal', index, value }));
    super(mirror);
    this.mirror = mirror;
    this.meta = [];
    this.clockMax = 0;
    this.setupBar();
    this.clklabel.id = 'clk';
    byId('bar').appendChild(this.clklabel);
    this.rows.addEventListener('keydown', e => {
      for (const act of this.getActions()) {
        if (keyMatches(e, act.key)) { e.preventDefault(); act.fn(); return; }
      }
    });
    new ResizeObserver(() => this.recreate()).observe(this.rows);
  }

  private setupBar() {
    const bar = byId('bar');
    const labels: { [key: string]: string } = {
      '=': '+', '-': '−', 'ctrl+shift+left': '⏮', 'shift+left': '⏪', left: '◀', right: '▶',
      'shift+right': '⏩', space: '⌖', h: '0x',
    };
    for (const act of this.getActions()) {
      const b = document.createElement('button');
      b.textContent = labels[act.key] || act.label;
      b.title = `${act.label} (${act.key})`;
      b.addEventListener('click', () => { act.fn(); this.rows.focus(); });
      bar.appendChild(b);
    }
  }

  /** New trace data from the worker. */
  show(snapshot: WaveformSnapshot | null) {
    this.mirror.snapshot = snapshot;
    const key = snapshot ? snapshot.meta.map(m => `${m.label}:${m.len}:${m.input}`).join(',') : '';
    byId('empty').hidden = !!snapshot;
    this.rows.hidden = !snapshot;
    if (key !== this.metaKey) {
      this.metaKey = key;
      this.recreate();
    } else {
      this.refresh();
    }
    if (snapshot) this.setCurrentTime(snapshot.now);
  }

  recreate() {
    if (this.wavelist) {
      this.wavelist.container.remove();
      this.wavelist = null;
    }
    this.lines = [];
    this.meta = this.wfp.getSignalMetadata();
    const width = this.rows.clientWidth;
    const height = this.rows.clientHeight;
    if (!this.meta.length || !width || !height) return;
    this.pageWidth = width - SCROLLBAR_WIDTH;
    this.setClocksPerPage();
    this.wavelist = new (VirtualList as any)({
      w: width,
      h: height,
      itemHeight: ROW_HEIGHT,
      totalRows: this.meta.length + 1,
      generatorFn: (row: number) => {
        const linediv = document.createElement('div');
        const canvas = document.createElement('canvas');
        canvas.width = width - SCROLLBAR_WIDTH;
        canvas.height = ROW_HEIGHT;
        linediv.appendChild(canvas);
        linediv.classList.add('waverow');
        this.lines[row] = canvas;
        this.refreshRow(row);
        if (this.isEditable(this.meta[row])) {
          linediv.onmousedown = () => this.changeInputValue(row);
          linediv.classList.add('editable');
        }
        return linediv;
      },
    });
    const wlc = this.wavelist.container as HTMLElement;
    this.rows.appendChild(wlc);
    // click or drag in the waves to move the cursor
    let down = false;
    const sel = (e: MouseEvent) => this.setSelTime(e.offsetX / this.zoom + this.t0 - 0.5);
    wlc.addEventListener('mousedown', e => {
      down = true;
      sel(e);
      // (a click on an input opens the value prompt, which keeps the focus)
      if (byId('prompt').hidden) this.rows.focus();
    });
    wlc.addEventListener('mousemove', e => { if (down) sel(e); });
    wlc.addEventListener('mouseup', () => { down = false; });
    wlc.addEventListener('mouseleave', () => { down = false; });
    wlc.addEventListener('wheel', e => {
      if (Math.abs(e.deltaX) > Math.abs(e.deltaY)) {
        const dx = Math.max(-1000, Math.min(1000, e.deltaX));
        if (dx) this.setOrgTime(this.t0 + dx);
      }
    });
  }

  protected selectionChanged() {
    this.clklabel.textContent = ' clk ' + this.tsel;
  }

  protected promptValue(meta: WaveformMeta, oldValue: number, min: number, max: number) {
    return new Promise<number | null>(resolve => {
      const box = byId('prompt');
      const input = box.querySelector('input')!;
      box.querySelector('label')!.textContent = `${meta.label} (${min} to ${max}):`;
      input.value = oldValue + '';
      box.hidden = false;
      input.focus();
      input.select();
      const done = (value: number | null) => {
        box.hidden = true;
        input.onkeydown = input.onblur = null;
        this.rows.focus();
        resolve(value);
      };
      input.onkeydown = e => {
        if (e.key === 'Enter') done(parseInt(input.value));
        else if (e.key === 'Escape') done(null);
      };
      input.onblur = () => done(null);
    });
  }
}

const view = new WebviewWaveform();
view.show(null);

window.addEventListener('message', e => {
  const msg = e.data;
  if (msg.type === 'data') {
    const w = msg.waveform as WaveformSnapshot | undefined;
    if (w) {
      // a typed array can arrive as a plain view or its buffer
      const d: any = w.data;
      w.data = d instanceof Uint32Array ? d : new Uint32Array(d.buffer || d);
    }
    view.show(w || null);
    vscode.postMessage({ type: 'ack' });
  } else if (msg.type === 'clear') {
    view.show(null);
  }
});
