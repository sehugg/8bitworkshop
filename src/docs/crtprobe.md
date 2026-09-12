# CRT Probe

The CRT Probe shows memory and I/O activity laid out by *raster
position* instead of by address, so you can see what the CPU touches at
each point of the display sweep. It is available on platforms that
implement `startProbing`.

The canvas axes are:

- **X** is the cycle within the scanline.
- **Y** is the scanline.

Activity is color-coded:

| Color | Operation |
| --- | --- |
| Grey ramp | Execute (shade reflects stack depth, so call depth is visible) |
| Blue | Memory write |
| Cyan | VRAM write |
| Light blue | I/O write |
| Green | I/O read |
| Green fill | Wait |
| Pink | Interrupt |

Illegal operations and DMA reads are drawn in grey. Gaps in the trace
are filled with the previous color, so the display does not show false
black bands.

The view shows a complete frame, and might be incomplete during debugging.
