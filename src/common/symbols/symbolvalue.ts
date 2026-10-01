import { hex } from "../util";

/** A symbol and the bytes at its address. */
export interface SymbolValue {
  name: string;
  addr: number;
  /** the first byte there */
  value: number;
  /** size in bytes, if the toolchain reported one */
  size?: number;
  /** the bytes there in memory order: `size` of them, up to MAX_SYMBOL_BYTES */
  bytes?: number[];
}

// most bytes of one symbol a client gets (a big array is just a prefix)
export const MAX_SYMBOL_BYTES = 32;

/** `$ADDR: $XX` for one byte; `$ADDR[size]: XX XX ...` (memory order) for more. */
export function formatSymbolValue(s: SymbolValue): string {
  const bytes = s.bytes || [s.value];
  if (bytes.length === 1) return `$${hex(s.addr, 4)}: $${hex(bytes[0], 2)}`;
  const more = s.size > bytes.length ? ' ...' : '';
  return `$${hex(s.addr, 4)}[${s.size}]: ${bytes.map(b => hex(b, 2)).join(' ')}${more}`;
}
