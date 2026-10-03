// views - the debug views in the 8bitworkshop panel container (Machine now;
// Waveform and the rest follow the same path, see notes/PLAN.md).
//
// The emulator worker owns the data. A view tells the host when it is shown
// or hidden, the host passes the list of showing views to the worker
// (setViews), and the worker sends 'view' events only for those. The host
// relays each to its webview, one in flight at a time: while the webview is
// still drawing, only the newest data waits, so a slow view never queues up.

import * as vscode from 'vscode';
import type { ViewEvent } from './emuworker';

/** view id (as the worker knows it) -> the viewType in package.json */
const VIEW_TYPES: { [id: string]: string } = {
  machine: '8bitworkshop.machine',
  waveform: '8bitworkshop.waveform',
};

interface Shown {
  view: vscode.WebviewView;
  inFlight: boolean;
  /** newest data that arrived while one was in flight */
  pending?: ViewEvent;
}

export class DebugViews {
  private shown = new Map<string, Shown>();
  /** the latest data per view, replayed when a view is shown again */
  private last = new Map<string, ViewEvent>();

  /**
   * `onChange` gets the ids of the visible views whenever they change;
   * `onSetSignal` gets a value the user set in the Waveform view.
   */
  constructor(private onChange: (ids: string[]) => void,
              private onSetSignal: (index: number, value: number) => void) { }

  register(extensionUri: vscode.Uri): vscode.Disposable[] {
    return Object.keys(VIEW_TYPES).map(id =>
      vscode.window.registerWebviewViewProvider(VIEW_TYPES[id], {
        resolveWebviewView: view => this.resolve(id, view, extensionUri),
      }, { webviewOptions: { retainContextWhenHidden: true } }));
  }

  /** The ids of the views that are showing. */
  subscriptions(): string[] {
    return [...this.shown].filter(([, s]) => s.view.visible).map(([id]) => id);
  }

  /** Data from the worker for a view. */
  show(ev: ViewEvent) {
    this.last.set(ev.id, ev);
    const s = this.shown.get(ev.id);
    if (s && s.view.visible) this.send(s, ev);
  }

  /** Forget what the views showed, e.g. when the emulator closes. */
  clear() {
    this.last.clear();
    for (const s of this.shown.values()) {
      s.pending = undefined;
      s.view.webview.postMessage({ type: 'clear' });
    }
  }

  private resolve(id: string, view: vscode.WebviewView, extensionUri: vscode.Uri) {
    const s: Shown = { view, inFlight: false };
    this.shown.set(id, s);
    const out = vscode.Uri.joinPath(extensionUri, 'out');
    view.webview.options = { enableScripts: true, localResourceRoots: [out] };
    view.webview.html = id === 'waveform'
      ? waveformHtml(view.webview, vscode.Uri.joinPath(out, 'waveformview.js'))
      : machineHtml();
    view.webview.onDidReceiveMessage(msg => {
      if (msg.type === 'ack') {
        s.inFlight = false;
        if (s.pending) { const p = s.pending; s.pending = undefined; this.send(s, p); }
      } else if (msg.type === 'setSignal') {
        this.onSetSignal(Number(msg.index), Number(msg.value));
      }
    });
    view.onDidChangeVisibility(() => {
      if (view.visible) {
        // the page kept its state; bring it up to date
        const ev = this.last.get(id);
        if (ev) this.send(s, ev);
      }
      this.onChange(this.subscriptions());
    });
    view.onDidDispose(() => {
      this.shown.delete(id);
      this.onChange(this.subscriptions());
    });
    this.onChange(this.subscriptions());
  }

  private send(s: Shown, ev: ViewEvent) {
    if (s.inFlight) { s.pending = ev; return; }
    s.inFlight = true;
    s.view.webview.postMessage({ type: 'data', ...ev }).then(ok => {
      // a refused message gets no ack, so don't wait for one
      if (!ok) s.inFlight = false;
    }, () => { s.inFlight = false; });
  }
}

function makeNonce() {
  return Math.random().toString(36).slice(2) + Date.now().toString(36);
}

/**
 * The Waveform view: the page is a shell for src/webview/waveformview.ts
 * (bundled to out/waveformview.js), which draws with the IDE's waveform code.
 */
function waveformHtml(webview: vscode.Webview, script: vscode.Uri) {
  const n = makeNonce();
  return `<!DOCTYPE html>
<html>
<head>
<meta charset="UTF-8">
<meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'nonce-${n}'; script-src 'nonce-${n}' ${webview.cspSource};">
<style nonce="${n}">
  html, body { margin: 0; padding: 0; height: 100%; }
  body { display: flex; flex-direction: column; color: var(--vscode-foreground); overflow: hidden;
         background: var(--vscode-panel-background); font: var(--vscode-font-size) var(--vscode-font-family); }
  #bar { display: flex; flex-wrap: wrap; align-items: center; gap: 2px; padding: 2px 6px; flex: none; }
  #bar button { border: 0; background: none; cursor: pointer; color: var(--vscode-foreground);
                padding: 2px 6px; font: inherit; border-radius: 3px; }
  #bar button:hover { background: var(--vscode-toolbar-hoverBackground); }
  #clk { margin-left: 8px; opacity: 0.8; }
  #rows { flex: 1; overflow-y: auto; overflow-x: hidden; background: #333; outline: none; }
  .waverow { height: 40px; }
  .waverow.editable { cursor: pointer; }
  .waverow.editable:hover { background: #363; }
  #empty { padding: 8px; opacity: 0.7; }
  #prompt { position: fixed; top: 8px; left: 50%; transform: translateX(-50%); padding: 8px;
            background: var(--vscode-editorWidget-background); border: 1px solid var(--vscode-focusBorder); }
  #prompt input { width: 12em; }
  [hidden] { display: none !important; }
</style>
</head>
<body>
<div id="bar"></div>
<div id="rows" tabindex="0"></div>
<div id="empty">Run a Verilog program to see its signals.</div>
<div id="prompt" hidden><label></label> <input type="number"></div>
<script nonce="${n}" src="${webview.asWebviewUri(script)}"></script>
</body>
</html>`;
}

/**
 * The Machine view: the platform's debug info as text, a tab per category,
 * like the IDE's debug info window. The selected tab is kept as the text
 * updates.
 */
function machineHtml() {
  const nonce = makeNonce();
  return `<!DOCTYPE html>
<html>
<head>
<meta charset="UTF-8">
<meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'nonce-${nonce}'; script-src 'nonce-${nonce}';">
<style nonce="${nonce}">
  html, body { margin: 0; padding: 0; height: 100%; }
  body { display: flex; flex-direction: column; color: var(--vscode-foreground);
         background: var(--vscode-panel-background); font: var(--vscode-font-size) var(--vscode-font-family); }
  #tabs { display: flex; flex-wrap: wrap; gap: 2px; padding: 4px 8px 0; flex: none; }
  #tabs button { border: 0; border-bottom: 1px solid transparent; background: none; cursor: pointer;
                 color: var(--vscode-foreground); opacity: 0.7; padding: 2px 8px; font: inherit; }
  #tabs button.sel { opacity: 1; border-bottom-color: var(--vscode-focusBorder); }
  pre { flex: 1; margin: 0; padding: 6px 8px; overflow: auto; tab-size: 8;
        font: var(--vscode-editor-font-size) var(--vscode-editor-font-family); }
  #empty { padding: 8px; opacity: 0.7; }
</style>
</head>
<body>
<div id="tabs"></div>
<pre id="text"></pre>
<div id="empty">Run a program to see the machine state.</div>
<script nonce="${nonce}">
  const vscode = acquireVsCodeApi();
  const tabsEl = document.getElementById('tabs');
  const textEl = document.getElementById('text');
  const emptyEl = document.getElementById('empty');
  let sections = [], selected = null;

  function render() {
    if (!sections.some(s => s.category === selected)) selected = sections.length ? sections[0].category : null;
    emptyEl.style.display = sections.length ? 'none' : 'block';
    textEl.style.display = sections.length ? 'block' : 'none';
    tabsEl.style.display = sections.length > 1 ? 'flex' : 'none';
    // rebuild the tabs only when the categories change, so clicks aren't lost
    const names = sections.map(s => s.category).join('\\n');
    if (tabsEl.dataset.names !== names) {
      tabsEl.dataset.names = names;
      tabsEl.textContent = '';
      for (const s of sections) {
        const b = document.createElement('button');
        b.textContent = s.category;
        b.addEventListener('click', () => { selected = s.category; render(); });
        tabsEl.appendChild(b);
      }
    }
    sections.forEach((s, i) => tabsEl.children[i].classList.toggle('sel', s.category === selected));
    const cur = sections.find(s => s.category === selected);
    if (cur && textEl.textContent !== cur.text) {
      const top = textEl.scrollTop;
      textEl.textContent = cur.text;
      textEl.scrollTop = top;
    }
  }

  window.addEventListener('message', e => {
    const msg = e.data;
    if (msg.type === 'data') {
      sections = msg.sections || [];
      render();
      vscode.postMessage({ type: 'ack' });
    } else if (msg.type === 'clear') {
      sections = [];
      render();
    }
  });
  render();
</script>
</body>
</html>`;
}
