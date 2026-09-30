
// Generic "link cable" abstraction between two emulated machines.
//
// A machine that has a link port implements HasLinkPort. The session layer
// (loopback for tests, WebRTC for the browser) hands it a LinkEndpoint. Each
// platform defines what its channels mean, e.g. for the Game Boy
// channel 0 is master->slave and channel 1 is slave->master.

export interface LinkEndpoint {
  // false when no peer is attached (cable unplugged)
  isConnected(): boolean;
  // queue a value for the peer on channel `ch`
  send(ch: number, value: number): void;
  // pop the oldest value the peer sent on `ch`, or undefined if none is waiting
  recv(ch: number): number | undefined;
}

export interface HasLinkPort {
  connectLink(link: LinkEndpoint | null): void;
}

export function hasLinkPort(arg: any): arg is HasLinkPort {
  return typeof arg.connectLink === 'function';
}

// A byte pipe between two sessions (WebRTC data channel, or in-process for tests)
export interface LinkTransport {
  send(msg: Uint8Array): void;
  onmessage: ((msg: Uint8Array) => void) | null;
  close(): void;
}

// LinkEndpoint that talks to a peer through a LinkTransport.
// Wire format is 2 bytes per value: [channel, value].
export class TransportLinkEndpoint implements LinkEndpoint {
  private queues: number[][] = [];
  private connected = true;

  constructor(private transport: LinkTransport) {
    transport.onmessage = (msg) => {
      for (let i = 0; i + 1 < msg.length; i += 2) {
        (this.queues[msg[i]] ||= []).push(msg[i + 1]);
      }
    };
  }
  isConnected() { return this.connected; }
  setConnected(b: boolean) { this.connected = b; }
  send(ch: number, value: number) {
    this.transport.send(new Uint8Array([ch & 0xff, value & 0xff]));
  }
  recv(ch: number) {
    return this.queues[ch]?.shift();
  }
  close() {
    this.connected = false;
    this.transport.close();
  }
}

// Two in-process transports wired to each other (tests, same-page two-player).
export function createLoopbackTransports(): [LinkTransport, LinkTransport] {
  const mk = (): LinkTransport & { peer?: LinkTransport } => ({
    onmessage: null,
    send(msg) { this.peer?.onmessage?.(msg); },
    close() { this.onmessage = null; },
  });
  const a = mk(), b = mk();
  a.peer = b;
  b.peer = a;
  return [a, b];
}

export function createLoopbackLink(): [TransportLinkEndpoint, TransportLinkEndpoint] {
  const [ta, tb] = createLoopbackTransports();
  return [new TransportLinkEndpoint(ta), new TransportLinkEndpoint(tb)];
}

// Frame-lockstep session over a LinkTransport.
//
// Both peers run the same frame numbers. Values a machine sends during frame F
// are batched into one packet and become visible to the peer's machine at the
// start of its frame F+delay. A peer may not start frame F until it has the
// other's packet for frame F-delay, so both machines see identical data at
// identical frame numbers. That keeps the emulations deterministic, at the cost
// of `delay` frames of latency each way. Pausing, single-stepping or loading
// state on only one side desyncs the pair.
//
// Usage per frame: if (canAdvance()) { beginFrame(); machine.advanceFrame(); endFrame(); }
export class LinkSession implements LinkEndpoint {
  frame = 0;
  private outgoing: number[] = [];               // [ch, value, ch, value, ...]
  private incoming = new Map<number, number[]>(); // peer frame -> [ch, value, ...]
  private queues: number[][] = [];                // delivered values, per channel
  private open = true;

  constructor(private transport: LinkTransport, public delay = 2) {
    transport.onmessage = (msg) => this.onPacket(msg);
  }

  // packet: u32 frame (big endian), then [ch, value] pairs
  private onPacket(msg: Uint8Array) {
    if (msg.length < 4) return;
    const frame = ((msg[0] << 24) | (msg[1] << 16) | (msg[2] << 8) | msg[3]) >>> 0;
    this.incoming.set(frame, Array.from(msg.subarray(4)));
  }

  isConnected() { return this.open; }
  setConnected(b: boolean) { this.open = b; }

  send(ch: number, value: number) {
    this.outgoing.push(ch & 0xff, value & 0xff);
  }
  recv(ch: number) {
    return this.queues[ch]?.shift();
  }

  // Do we have the peer's data needed to run the current frame?
  canAdvance(): boolean {
    if (!this.open) return true; // cable unplugged: run free
    return this.frame < this.delay || this.incoming.has(this.frame - this.delay);
  }

  beginFrame() {
    const pkt = this.incoming.get(this.frame - this.delay);
    if (pkt) {
      this.incoming.delete(this.frame - this.delay);
      for (let i = 0; i + 1 < pkt.length; i += 2) {
        (this.queues[pkt[i]] ||= []).push(pkt[i + 1]);
      }
    }
  }

  endFrame() {
    if (this.open) {
      const f = this.frame;
      const msg = new Uint8Array(4 + this.outgoing.length);
      msg[0] = f >>> 24; msg[1] = f >>> 16; msg[2] = f >>> 8; msg[3] = f;
      msg.set(this.outgoing, 4);
      this.transport.send(msg);
    }
    this.outgoing = [];
    this.frame++;
  }

  close() {
    this.open = false;
    this.transport.close();
  }
}
