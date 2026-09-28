"use strict";
// A test client for the debug adapter, shared by the root and extension tests.
Object.defineProperty(exports, "__esModule", { value: true });
exports.DapClient = void 0;
/** Just enough of a DAP client: requests by sequence number, events by name. */
class DapClient {
    constructor(session) {
        this.session = session;
        this.seq = 1;
        this.pending = new Map();
        this.events = [];
        this.waiting = [];
        session.onDidSendMessage((m) => {
            var _a;
            if (m.type === 'response')
                (_a = this.pending.get(m.request_seq)) === null || _a === void 0 ? void 0 : _a(m);
            else if (m.type === 'event') {
                const w = this.waiting.findIndex(w => w.name === m.event);
                if (w >= 0)
                    this.waiting.splice(w, 1)[0].resolve(m);
                else
                    this.events.push(m);
            }
        });
    }
    request(command, args = {}) {
        const seq = this.seq++;
        return new Promise((resolve, reject) => {
            this.pending.set(seq, (r) => r.success ? resolve(r.body) : reject(new Error(r.message)));
            this.session.handleMessage({ seq, type: 'request', command, arguments: args });
        });
    }
    /** The next event of this name, including one that already came. */
    event(name) {
        const i = this.events.findIndex(e => e.event === name);
        if (i >= 0)
            return Promise.resolve(this.events.splice(i, 1)[0].body);
        return new Promise(resolve => this.waiting.push({ name, resolve: e => resolve(e.body) }));
    }
    async where() {
        const { stackFrames } = await this.request('stackTrace', { threadId: 1 });
        return stackFrames[0];
    }
}
exports.DapClient = DapClient;
//# sourceMappingURL=dapclient.js.map