// Runs the Waveform view's page script (out/waveformview.js) in jsdom, to
// catch errors that only show up in a webview: it builds rows from a trace,
// draws them, and sends a click on an input back as a message.

import assert from 'assert';
import fs from 'fs';
import path from 'path';
import { JSDOM } from 'jsdom';
import type { WaveformSnapshot } from '../../src/common/waveform';

const PAGE = `<div id="bar"></div><div id="rows" tabindex="0"></div><div id="empty"></div>
<div id="prompt" hidden><label></label> <input type="number"></div>`;

describe('extension waveform view page', function () {
  var dom: JSDOM;
  var posted: any[];
  var drawn: number;

  beforeEach(function () {
    dom = new JSDOM(PAGE, { runScripts: 'outside-only', pretendToBeVisual: true });
    const w: any = dom.window;
    posted = [];
    drawn = 0;
    w.acquireVsCodeApi = () => ({ postMessage: (m: any) => posted.push(m) });
    w.ResizeObserver = class { observe() { } };
    Object.defineProperty(w.HTMLElement.prototype, 'clientWidth', { get: () => 600 });
    Object.defineProperty(w.HTMLElement.prototype, 'clientHeight', { get: () => 200 });
    // jsdom has no canvas: a recording stand-in for the 2D context
    w.HTMLCanvasElement.prototype.getContext = () => new Proxy({}, {
      get: (t: any, k) => k === 'measureText' ? () => ({ width: 10 }) : t[k] ?? (() => { drawn++; }),
      set: (t: any, k, v) => { t[k] = v; return true; },
    });
    dom.window.eval(fs.readFileSync(path.join(__dirname, '..', 'waveformview.js'), 'utf-8'));
  });

  // closing the window stops the virtual list's timer, which would keep mocha running
  afterEach(function () { dom.window.close(); });

  function snapshot(): WaveformSnapshot {
    const meta = [
      { label: 'sw', len: 4, input: true, output: false },
      { label: 'n', len: 8, input: false, output: true },
    ];
    const data = new Uint32Array(200);
    for (let i = 0; i < 100; i++) { data[i * 2] = 3; data[i * 2 + 1] = i; }
    return { meta, data, wrap: false, now: 50 };
  }

  function send(msg: any) {
    dom.window.dispatchEvent(new (dom.window as any).MessageEvent('message', { data: msg }));
  }

  it('draws a row per signal and acks the data', function () {
    send({ type: 'data', id: 'waveform', frame: 1, waveform: snapshot() });
    const doc = dom.window.document;
    assert.ok(doc.querySelectorAll('#rows canvas').length >= 2, 'rows');
    assert.ok(drawn > 0, 'drew something');
    assert.ok(doc.getElementById('empty')!.hidden);
    assert.ok(posted.some(m => m.type === 'ack'));
    assert.ok(doc.querySelectorAll('#bar button').length >= 9, 'toolbar');
    // a second push with the same signals keeps working
    send({ type: 'data', id: 'waveform', frame: 2, waveform: snapshot() });
    assert.equal(posted.filter(m => m.type === 'ack').length, 2);
  });

  it('flips a one-bit input and asks for others, sending the value back', function () {
    send({ type: 'data', id: 'waveform', frame: 1, waveform: snapshot() });
    const row = dom.window.document.querySelector('#rows .waverow.editable') as HTMLElement;
    assert.ok(row, 'sw is editable');
    row.dispatchEvent(new (dom.window as any).MouseEvent('mousedown', { bubbles: true }));
    const prompt = dom.window.document.getElementById('prompt')!;
    assert.ok(!prompt.hidden, 'prompts for a 4-bit value');
    const input = prompt.querySelector('input')!;
    input.value = '9';
    input.dispatchEvent(new (dom.window as any).KeyboardEvent('keydown', { key: 'Enter' }));
    return new Promise<void>(r => setTimeout(r, 0)).then(() => {
      assert.deepEqual(posted.find(m => m.type === 'setSignal'), { type: 'setSignal', index: 0, value: 9 });
    });
  });

  it('shows the empty message when cleared', function () {
    send({ type: 'data', id: 'waveform', frame: 1, waveform: snapshot() });
    send({ type: 'clear' });
    assert.ok(!dom.window.document.getElementById('empty')!.hidden);
  });
});
