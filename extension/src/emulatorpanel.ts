
// emulatorpanel - the webview that shows emulator frames and captures keys.
// It only draws; the emulator runs in emuworker.

import * as vscode from 'vscode';
import type { FrameEvent, EmuStatus } from './emuworker';

export const VIEW_TYPE = '8bitworkshop.emulator';

export interface PanelEvents {
  onKey(key: number, code: number, flags: number): void;
  /** the user showed or hid the controls bar */
  onControlsVisible(visible: boolean): void;
  onVisible(visible: boolean): void;
  onDispose(): void;
}

export class EmulatorPanel {
  private panel: vscode.WebviewPanel;
  // drop frames while the webview is still drawing the last one
  private frameInFlight = false;

  constructor(readonly events: PanelEvents, controlsVisible = true) {
    this.panel = vscode.window.createWebviewPanel(VIEW_TYPE, 'Emulator',
      { viewColumn: vscode.ViewColumn.Beside, preserveFocus: true },
      { enableScripts: true, retainContextWhenHidden: true, localResourceRoots: [] });
    this.panel.webview.html = getHtml(controlsVisible);
    this.panel.webview.onDidReceiveMessage(msg => {
      if (msg.type === 'key') this.events.onKey(msg.key, msg.code, msg.flags);
      else if (msg.type === 'frameDone') this.frameInFlight = false;
      else if (msg.type === 'controlsVisible') this.events.onControlsVisible(!!msg.visible);
    });
    this.panel.onDidChangeViewState(e => this.events.onVisible(e.webviewPanel.visible));
    this.panel.onDidDispose(() => this.events.onDispose());
  }

  reveal() {
    this.panel.reveal(undefined, true);
  }

  setTitle(title: string) {
    this.panel.title = title;
  }

  showFrame(frame: FrameEvent) {
    if (this.frameInFlight || !this.panel.visible) return;
    this.frameInFlight = true;
    this.panel.webview.postMessage({ type: 'frame', ...frame, pixels: new Uint8Array(frame.pixels) })
      .then(ok => { if (!ok) this.frameInFlight = false; }, () => { this.frameInFlight = false; });
  }

  showStatus(status: EmuStatus | null) {
    this.panel.webview.postMessage({ type: 'status', status });
  }

  dispose() {
    this.panel.dispose();
  }
}

function getHtml(controlsVisible: boolean) {
  var nonce = Math.random().toString(36).slice(2) + Date.now().toString(36);
  return `<!DOCTYPE html>
<html>
<head>
<meta charset="UTF-8">
<meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'nonce-${nonce}'; script-src 'nonce-${nonce}';">
<style nonce="${nonce}">
  html, body { margin: 0; padding: 0; width: 100%; height: 100%; overflow: hidden; background: #000; }
  #wrap { position: absolute; inset: 0; display: flex; align-items: center; justify-content: center; }
  canvas { image-rendering: pixelated; outline: none; }
  canvas:focus { box-shadow: 0 0 0 1px var(--vscode-focusBorder); }
  #status { position: absolute; left: 8px; top: 6px; font: 12px var(--vscode-font-family); color: #ccc;
            text-shadow: 0 0 3px #000; pointer-events: none; }
  /* the IDE's control hints (css/ui.css): key caps on black, shown while
     the emulator has focus, since keys only reach it then */
  #bar { position: absolute; left: 0; right: 0; bottom: 0; display: none; align-items: center; justify-content: center;
         flex-wrap: wrap; padding: 2px 28px; box-sizing: border-box; background: #000;
         font: 11px var(--vscode-font-family); opacity: 0; transition: opacity 200ms; }
  body.controls.hascontrols #bar { display: flex; }
  body:not(.unfocused) #bar { opacity: 1; }
  .def { color: #ccc; white-space: nowrap; line-height: 2em; }
  .key { border: 2px solid rgba(0,0,0,0.2); border-radius: 0.6em; padding: 0.2em 0.5em; margin-left: 1em;
         background-color: #eee; color: #666; white-space: pre; }
  .key + .key { margin-left: 0.25em; }
  #hide { position: absolute; right: 6px; top: 50%; transform: translateY(-50%); cursor: pointer; opacity: 0.7; border: 0;
          background: none; color: #ccc; font-size: 14px; }
  #show { position: absolute; right: 6px; bottom: 4px; display: none; cursor: pointer; font: 11px var(--vscode-font-family);
          color: #ccc; background: rgba(0,0,0,0.5); border: 0; border-radius: 3px; padding: 2px 6px; }
  body.hascontrols:not(.controls) #show { display: block; }
</style>
</head>
<body class="${controlsVisible ? 'controls' : ''}">
<div id="wrap"><canvas id="screen" tabindex="0" width="1" height="1"></canvas></div>
<div id="status"></div>
<div id="bar"><span id="hints"></span><button id="hide" title="Hide controls">&times;</button></div>
<button id="show" title="Show controls">Controls</button>
<script nonce="${nonce}">
  const vscode = acquireVsCodeApi();
  const canvas = document.getElementById('screen');
  const ctx = canvas.getContext('2d');
  const statusEl = document.getElementById('status');
  let image = null;
  let layout = { w: 0, h: 0, rotate: 0, aspect: 0 };
  let lastControls = null;

  // KeyFlags in src/common/emu.ts
  const KeyDown = 1, Shift = 2, Ctrl = 4, Alt = 8, Meta = 16, KeyUp = 64;
  function modFlags(e) {
    return (e.shiftKey ? Shift : 0) | (e.ctrlKey ? Ctrl : 0) | (e.altKey ? Alt : 0) | (e.metaKey ? Meta : 0);
  }
  // same as _charCodeOf in src/common/emu.ts
  function charCode(e) {
    return e.key != null && e.key.length == 1 ? e.key.charCodeAt(0) : e.keyCode;
  }
  canvas.addEventListener('keydown', e => {
    const flags = modFlags(e);
    vscode.postMessage({ type: 'key', key: e.which, code: charCode(e), flags: KeyDown | flags });
    if (!flags) e.preventDefault();
  });
  canvas.addEventListener('keyup', e => {
    vscode.postMessage({ type: 'key', key: e.which, code: charCode(e), flags: KeyUp | modFlags(e) });
  });
  document.addEventListener('mousedown', e => { if (!(e.target instanceof HTMLButtonElement)) canvas.focus(); });
  window.addEventListener('focus', () => canvas.focus());
  window.addEventListener('resize', fit);
  canvas.addEventListener('focus', () => document.body.classList.remove('unfocused'));
  canvas.addEventListener('blur', () => document.body.classList.add('unfocused'));

  // the controls bar: hints from the platform, hidden on request
  const bar = document.getElementById('bar');
  const hintsEl = document.getElementById('hints');
  function setControls(visible) {
    document.body.classList.toggle('controls', visible);
    vscode.postMessage({ type: 'controlsVisible', visible });
    fit();
  }
  document.getElementById('hide').addEventListener('click', () => setControls(false));
  document.getElementById('show').addEventListener('click', () => setControls(true));
  function showControls(hints) {
    hintsEl.textContent = '';
    for (const h of hints || []) {
      const def = document.createElement('span');
      def.className = 'def';
      for (const k of h.keys) {
        const cap = document.createElement('span');
        cap.className = 'key';
        cap.textContent = k;
        def.appendChild(cap);
      }
      def.appendChild(document.createTextNode(' ' + h.action));
      hintsEl.appendChild(def);
    }
    document.body.classList.toggle('hascontrols', !!(hints && hints.length));
    fit();
  }

  // scale the canvas to fill the panel, keeping its aspect ratio
  function fit() {
    const { w, h, rotate, aspect } = layout;
    if (!w) return;
    const sideways = Math.abs(rotate) % 180 == 90;
    let ratio = aspect || w / h;
    if (sideways) ratio = 1 / ratio;
    const barH = document.body.classList.contains('controls') ? bar.offsetHeight : 0;
    document.getElementById('wrap').style.bottom = barH + 'px';
    const W = window.innerWidth, H = window.innerHeight - barH;
    let dw = W, dh = W / ratio;
    if (dh > H) { dh = H; dw = H * ratio; }
    // the canvas box is pre-rotation, so swap its sides when sideways
    canvas.style.width = (sideways ? dh : dw) + 'px';
    canvas.style.height = (sideways ? dw : dh) + 'px';
    canvas.style.transform = rotate ? 'rotate(' + rotate + 'deg)' : '';
  }

  window.addEventListener('message', e => {
    const msg = e.data;
    if (msg.type === 'frame') {
      const { width, height } = msg;
      if (!image || image.width != width || image.height != height) {
        canvas.width = width;
        canvas.height = height;
        image = ctx.createImageData(width, height);
      }
      if (layout.w != width || layout.h != height || layout.rotate != (msg.rotate || 0) || layout.aspect != (msg.aspect || 0)) {
        layout = { w: width, h: height, rotate: msg.rotate || 0, aspect: msg.aspect || 0 };
        fit();
      }
      image.data.set(msg.pixels);
      ctx.putImageData(image, 0, 0);
      vscode.postMessage({ type: 'frameDone' });
    } else if (msg.type === 'status') {
      const s = msg.status;
      if (s && JSON.stringify(s.controls) !== lastControls) {
        lastControls = JSON.stringify(s.controls);
        showControls(s.controls);
      }
      statusEl.textContent = !s ? '' : s.state == 'running' ? '' : s.state == 'halted' ? 'Halted: ' + (s.message || '') : 'Paused';
    }
  });
  canvas.focus();
  if (!document.hasFocus()) document.body.classList.add('unfocused');
</script>
</body>
</html>`;
}
