// A test client for the debug adapter, shared by the root and extension tests.

import { DebugProtocol } from "@vscode/debugprotocol";
import type { EmuDebugSession } from "../../src/tools/dapsession";

/** Just enough of a DAP client: requests by sequence number, events by name. */
export class DapClient {
  private seq = 1;
  private pending = new Map<number, (r: DebugProtocol.Response) => void>();
  private events: DebugProtocol.Event[] = [];
  private waiting: { name: string, resolve: (e: DebugProtocol.Event) => void }[] = [];

  constructor(readonly session: EmuDebugSession) {
    session.onDidSendMessage((m: any) => {
      if (m.type === 'response') this.pending.get(m.request_seq)?.(m);
      else if (m.type === 'event') {
        const w = this.waiting.findIndex(w => w.name === m.event);
        if (w >= 0) this.waiting.splice(w, 1)[0].resolve(m);
        else this.events.push(m);
      }
    });
  }

  request(command: string, args: any = {}): Promise<any> {
    const seq = this.seq++;
    return new Promise((resolve, reject) => {
      this.pending.set(seq, (r) => r.success ? resolve(r.body) : reject(new Error(r.message)));
      this.session.handleMessage({ seq, type: 'request', command, arguments: args } as any);
    });
  }

  /** The next event of this name, including one that already came. */
  event(name: string): Promise<any> {
    const i = this.events.findIndex(e => e.event === name);
    if (i >= 0) return Promise.resolve(this.events.splice(i, 1)[0].body);
    return new Promise(resolve => this.waiting.push({ name, resolve: e => resolve(e.body) }));
  }

  async where() {
    const { stackFrames } = await this.request('stackTrace', { threadId: 1 });
    return stackFrames[0];
  }
}
