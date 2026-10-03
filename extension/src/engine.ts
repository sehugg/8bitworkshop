
// engine - starts the build and emulator worker threads on demand and
// restarts them if they exit.

import * as path from 'path';
import { Worker } from 'worker_threads';
import { Rpc } from './rpc';

/** Rejects calls still pending when the host disposes a worker on purpose. Not a crash. */
export class WorkerDisposedError extends Error {
  constructor(script: string) {
    super(`${script} was stopped`);
    this.name = 'WorkerDisposedError';
  }
}

export class WorkerHandle {
  private rpc: Rpc | null = null;
  private recent: string[] = [];
  private listeners: { [name: string]: (data: any) => void } = {};

  constructor(
    readonly script: string,
    readonly rootDir: string,
    readonly handlers: { [method: string]: (...args: any[]) => any } = {},
    readonly log: (msg: string) => void = () => { },
    readonly onCrash: (err: Error) => void = () => { }) { }

  get(): Rpc {
    if (!this.rpc) {
      this.recent = [];
      var worker = new Worker(path.join(__dirname, this.script), { workerData: { rootDir: this.rootDir }, stdout: true, stderr: true });
      // keep the worker's last console lines, for the 'exit' message below
      for (var stream of [worker.stdout, worker.stderr]) {
        stream.on('data', (chunk: Buffer) => {
          this.recent.push(...chunk.toString().split('\n').filter(l => l.trim()).map(l => l.slice(0, 200)));
          this.recent.splice(0, this.recent.length - 3);
        });
      }
      var rpc = new Rpc(worker, this.handlers);
      for (var name in this.listeners) rpc.on(name, this.listeners[name]);
      var fail = (err: Error) => {
        if (this.rpc === rpc) this.rpc = null;
        rpc.rejectAll(err);
      };
      worker.on('error', err => {
        this.log(`${this.script}: ${err && err.stack || err}`);
        this.onCrash(err);
        fail(err);
      });
      // an exit with no 'error' event means the thread quit on its own (e.g. a
      // tool called process.exit), so say what the worker last logged
      worker.on('exit', code => fail(new Error(`${this.script} exited (${code})` + (this.recent.length ? `; last output: ${this.recent.join(' | ')}` : ''))));
      this.rpc = rpc;
    }
    return this.rpc;
  }

  call<T = any>(method: string, ...args: any[]): Promise<T> {
    return this.get().call<T>(method, ...args);
  }

  /** call() without waiting for the reply. Disposal mid-call is expected, not an error. */
  notify(method: string, ...args: any[]) {
    this.call(method, ...args).catch(e => {
      if (!(e instanceof WorkerDisposedError)) this.log(`${this.script}: ${method}: ${e && e.message || e}`);
    });
  }

  on(name: string, fn: (data: any) => void) {
    this.listeners[name] = fn;
    this.rpc?.on(name, fn);
  }

  get started() {
    return this.rpc != null;
  }

  dispose() {
    var rpc = this.rpc;
    this.rpc = null;
    if (rpc) {
      // terminate() makes the worker exit with code 1; fail the callers first so
      // the 'exit' handler doesn't report that as a crash
      rpc.rejectAll(new WorkerDisposedError(this.script));
      (rpc.port as Worker).terminate();
    }
  }
}
