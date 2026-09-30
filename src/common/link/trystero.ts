
// WebRTC link-cable transport using Trystero (https://github.com/dmotz/trystero).
// Peers find each other by room code through public Nostr relays, so no server
// of our own is needed. Import this file lazily (await import(...)) so the
// library is only loaded when someone opens a link.
import { joinRoom } from "trystero";
import { LinkTransport } from "./link";

const APP_ID = '8bitworkshop-link';

const TURN_URL = 'https://8bitworkshop.com/turn.php';

// TURN relay credentials from our server (web/turn.php). Direct WebRTC fails behind
// strict NATs, so this is what makes those links work; if the fetch fails we just
// fall back to STUN-only.
export async function fetchTurnConfig(): Promise<RTCIceServer[]> {
  try {
    const res = await fetch(TURN_URL, { signal: AbortSignal.timeout(4000) });
    if (!res.ok) return [];
    const data = await res.json();
    return Array.isArray(data.iceServers) ? data.iceServers : [];
  } catch (e) {
    console.log("link: no TURN servers available", e);
    return [];
  }
}

export type LinkStatus = 'waiting' | 'open' | 'closed' | 'full';

export class TrysteroLinkTransport implements LinkTransport {
  onstatus: ((s: LinkStatus) => void) | null = null;
  status: LinkStatus = 'waiting';
  private room: ReturnType<typeof joinRoom>;
  private sender: (msg: Uint8Array, target: string) => void;
  private peer: string | null = null;
  private pending: Uint8Array[] = []; // arrived before onmessage was set
  private _onmessage: ((msg: Uint8Array) => void) | null = null;

  constructor(public roomCode: string, turnConfig: RTCIceServer[] = []) {
    this.room = joinRoom({ appId: APP_ID, turnConfig }, roomCode);
    const action = this.room.makeAction<Uint8Array>('link');
    this.sender = (msg, target) => { action.send(msg, { target }); };
    action.onMessage = (data, { peerId }) => {
      if (peerId !== this.peer) return;
      const msg = data instanceof Uint8Array ? data : new Uint8Array(data as any);
      if (this._onmessage) this._onmessage(msg);
      else this.pending.push(msg);
    };
    this.room.onPeerJoin = (id) => {
      if (this.peer) { this.setStatus('full'); return; } // link cable has two ends
      this.peer = id;
      this.setStatus('open');
    };
    this.room.onPeerLeave = (id) => {
      if (id === this.peer) { this.peer = null; this.setStatus('closed'); }
    };
  }

  private setStatus(s: LinkStatus) {
    this.status = s;
    this.onstatus?.(s);
  }

  // packets that arrive before the session is attached are replayed, not lost
  set onmessage(fn: ((msg: Uint8Array) => void) | null) {
    this._onmessage = fn;
    if (fn) for (const m of this.pending.splice(0)) fn(m);
  }
  get onmessage() { return this._onmessage; }

  send(msg: Uint8Array) {
    if (this.peer) this.sender(msg, this.peer);
  }

  close() {
    this._onmessage = null;
    this.room.leave();
  }
}

// 6 characters from an unambiguous alphabet, e.g. "K7QM4X"; the code acts as the room password
export function newRoomCode(): string {
  const chars = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
  const buf = crypto.getRandomValues(new Uint8Array(6));
  return Array.from(buf, b => chars[b % chars.length]).join('');
}
