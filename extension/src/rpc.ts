
// rpc - request/response and events over a worker_threads port.
// Both ends use the same class: call() the other side's handlers, emit()
// events to its `on` listeners.

import type { MessagePort, Transferable, Worker } from 'worker_threads';

type Port = MessagePort | Worker;
type Handler = (...args: any[]) => any;

interface CallMsg { t: 'call'; id: number; method: string; args: any[] }
interface ResultMsg { t: 'result'; id: number; value?: any; error?: { message: string; stack?: string } }
interface EventMsg { t: 'event'; name: string; data: any }

export class Rpc {
  private nextId = 1;
  private pending = new Map<number, { resolve: (v: any) => void; reject: (e: Error) => void }>();
  private listeners = new Map<string, (data: any) => void>();

  constructor(readonly port: Port, readonly handlers: { [method: string]: Handler } = {}) {
    port.on('message', (msg: CallMsg | ResultMsg | EventMsg) => this.receive(msg));
  }

  call<T = any>(method: string, ...args: any[]): Promise<T> {
    var id = this.nextId++;
    return new Promise<T>((resolve, reject) => {
      this.pending.set(id, { resolve, reject });
      this.port.postMessage({ t: 'call', id, method, args });
    });
  }

  emit(name: string, data: any, transfer?: Transferable[]) {
    this.port.postMessage({ t: 'event', name, data }, transfer as any);
  }

  on(name: string, fn: (data: any) => void) {
    this.listeners.set(name, fn);
  }

  /** Fail every outstanding call, e.g. when the worker dies. */
  rejectAll(err: Error) {
    for (var p of this.pending.values()) p.reject(err);
    this.pending.clear();
  }

  private async receive(msg: CallMsg | ResultMsg | EventMsg) {
    if (msg.t === 'call') {
      var handler = this.handlers[msg.method];
      try {
        if (!handler) throw new Error(`no handler for '${msg.method}'`);
        var value = await handler(...msg.args);
        this.port.postMessage({ t: 'result', id: msg.id, value });
      } catch (e) {
        var error = { message: String(e && e.message || e), stack: e && e.stack };
        this.port.postMessage({ t: 'result', id: msg.id, error });
      }
    } else if (msg.t === 'result') {
      var p = this.pending.get(msg.id);
      if (!p) return;
      this.pending.delete(msg.id);
      if (msg.error) {
        var err = new Error(msg.error.message);
        err.stack = msg.error.stack;
        p.reject(err);
      } else {
        p.resolve(msg.value);
      }
    } else if (msg.t === 'event') {
      var fn = this.listeners.get(msg.name);
      if (fn) fn(msg.data);
    }
  }
}
