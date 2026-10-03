// The file a VCD recording streams to (see EmuCore.startVcd). Node only.

import * as fs from 'fs';
import * as zlib from 'zlib';

export interface VcdFile {
  write(chunk: string): void;
  close(): void;
  /** bytes written to the file so far (after compression) */
  readonly bytes: number;
  /** `maxBytes` has been reached: the recording should stop */
  readonly full: boolean;
}

/** The most the CLI writes unless told otherwise, about 400 frames of a design with video. */
export const DEFAULT_VCD_MAX_BYTES = 1 << 30;

/**
 * Open `file` for a recording. A name ending in `.gz` is gzipped as it goes:
 * each chunk is its own gzip member, which gunzip reads as one stream, so
 * nothing needs flushing at the end. VCD compresses about 4x.
 * `maxBytes` (0 for no limit) sets when `full` turns true; the file goes a
 * little past it, since the recording stops between clocks.
 */
export function openVcdFile(file: string, maxBytes = DEFAULT_VCD_MAX_BYTES): VcdFile {
  const fd = fs.openSync(file, 'w');
  const gzip = /\.gz$/i.test(file);
  const f = {
    bytes: 0,
    get full() { return maxBytes > 0 && f.bytes >= maxBytes; },
    write(chunk: string) {
      const data = gzip ? zlib.gzipSync(chunk, { level: 1 }) : Buffer.from(chunk);
      fs.writeSync(fd, data);
      f.bytes += data.length;
    },
    close() { fs.closeSync(fd); },
  };
  return f;
}
