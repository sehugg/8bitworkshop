
// engine - starts the build and emulator worker threads on demand and
// restarts them if they exit.

import * as path from 'path';
import { Worker } from 'worker_threads';
import { Rpc } from './rpc';

export class WorkerHandle {
  private rpc: Rpc | null = null;
  private listeners: { [name: string]: (data: any) => void } = {};

  constructor(
    readonly script: string,
    readonly rootDir: string,
    readonly handlers: { [method: string]: (...args: any[]) => any } = {},
    readonly log: (msg: string) => void = () => { }) { }

  get(): Rpc {
    if (!this.rpc) {
      var worker = new Worker(path.join(__dirname, this.script), { workerData: { rootDir: this.rootDir } });
      var rpc = new Rpc(worker, this.handlers);
      for (var name in this.listeners) rpc.on(name, this.listeners[name]);
      var fail = (err: Error) => {
        if (this.rpc === rpc) this.rpc = null;
        rpc.rejectAll(err);
      };
      worker.on('error', err => {
        this.log(`${this.script}: ${err && err.stack || err}`);
        fail(err);
      });
      worker.on('exit', code => fail(new Error(`${this.script} exited (${code})`)));
      this.rpc = rpc;
    }
    return this.rpc;
  }

  call<T = any>(method: string, ...args: any[]): Promise<T> {
    return this.get().call<T>(method, ...args);
  }

  on(name: string, fn: (data: any) => void) {
    this.listeners[name] = fn;
    this.rpc?.on(name, fn);
  }

  get started() {
    return this.rpc != null;
  }

  dispose() {
    if (this.rpc) (this.rpc.port as Worker).terminate();
    this.rpc = null;
  }
}
