
// emulatorpanel - the webview that shows emulator frames and captures keys.
// It only draws; the emulator runs in emuworker.

import * as vscode from 'vscode';
import type { FrameEvent, EmuStatus } from './emuworker';

export const VIEW_TYPE = '8bitworkshop.emulator';

export interface PanelEvents {
  onKey(key: number, code: number, flags: number): void;
  onVisible(visible: boolean): void;
  onDispose(): void;
}

export class EmulatorPanel {
  private panel: vscode.WebviewPanel;
  // drop frames while the webview is still drawing the last one
  private frameInFlight = false;

  constructor(readonly events: PanelEvents) {
    this.panel = vscode.window.createWebviewPanel(VIEW_TYPE, 'Emulator',
      { viewColumn: vscode.ViewColumn.Beside, preserveFocus: true },
      { enableScripts: true, retainContextWhenHidden: true, localResourceRoots: [] });
    this.panel.webview.html = getHtml();
    this.panel.webview.onDidReceiveMessage(msg => {
      if (msg.type === 'key') this.events.onKey(msg.key, msg.code, msg.flags);
      else if (msg.type === 'frameDone') this.frameInFlight = false;
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

function getHtml() {
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
  #status { position: absolute; left: 8px; bottom: 6px; font: 12px var(--vscode-font-family); color: #ccc;
            text-shadow: 0 0 3px #000; pointer-events: none; }
</style>
</head>
<body>
<div id="wrap"><canvas id="screen" tabindex="0" width="1" height="1"></canvas></div>
<div id="status"></div>
<script nonce="${nonce}">
  const vscode = acquireVsCodeApi();
  const canvas = document.getElementById('screen');
  const ctx = canvas.getContext('2d');
  const statusEl = document.getElementById('status');
  let image = null;
  let layout = { w: 0, h: 0, rotate: 0, aspect: 0 };

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
  document.addEventListener('mousedown', () => canvas.focus());
  window.addEventListener('focus', () => canvas.focus());
  window.addEventListener('resize', fit);

  // scale the canvas to fill the panel, keeping its aspect ratio
  function fit() {
    const { w, h, rotate, aspect } = layout;
    if (!w) return;
    const sideways = Math.abs(rotate) % 180 == 90;
    let ratio = aspect || w / h;
    if (sideways) ratio = 1 / ratio;
    const W = window.innerWidth, H = window.innerHeight;
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
      statusEl.textContent = !s ? '' : s.state == 'running' ? '' : s.state == 'halted' ? 'Halted: ' + (s.message || '') : 'Paused';
    }
  });
  canvas.focus();
</script>
</body>
</html>`;
}
