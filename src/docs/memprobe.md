# Memory Probe

The Memory Probe is a heat map of memory activity. It is available on
platforms that implement `startProbing`.

The canvas is a 256&times;256 grid of the 64K address space:

- **X** is the low byte of the address.
- **Y** is the high byte.
- The faint background shows a compressed view of current memory
  contents, so the map is still readable before anything executes.

Activity is drawn in color by operation type:

| Color | Operation |
| --- | --- |
| Green | Execute |
| Red | Memory read |
| Blue | Memory write |
| Teal | I/O read |
| Magenta | I/O write |
| Yellow | DMA/VRAM read |
| Light blue | DMA/VRAM write |
| Bright green | Interrupt |
| White | Illegal / error |
| Pink | Wait |

The view shows a complete frame, and might be incomplete during debugging.

## Tooltips

Hovering the map shows the routines and operations that touched that
address, including the program counter that performed each access and
any associated value.

