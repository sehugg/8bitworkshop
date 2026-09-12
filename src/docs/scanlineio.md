# Scanline I/O

The Scanline I/O window shows the I/O and VRAM accesses made during each
scanline. It is available on platforms that implement `startProbing`.

Each row is one scanline:

- A leading scanline number.
- One character column per CPU cycle. An access at that cycle is shown
  as its device address in hex; cycles with no access are shown as `.`.
- The horizontal-blank boundary is marked with `|`.
- The symbol of the routine executing on that scanline is appended at the
  end, when known.

This makes it easy to see where per-scanline register writes (raster
effects) occur relative to the start of the visible line.

The view shows a complete frame, and might be incomplete during debugging.

