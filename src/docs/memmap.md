# Memory Map

The Memory Map draws the program's memory layout as columns that share
one address axis. Each row starts at the address shown on the left, and
row height grows with the size of the range.

The window appears when the current project has segment information,
which most linker-based toolchains provide.

## Columns

- **System** shows the platform's native memory map (RAM, ROM, I/O).
  Gaps between areas appear as dashed "unmapped" bars, so the column
  covers the whole address space.
- **Segments** shows the segments the linker produced. Free space
  between segments appears as an empty bar.
- **Objects** shows large variables and arrays (16 bytes or more) in
  RAM. Sizes come from the toolchain when it reports them (cc65, oscar64);
  otherwise they are estimated from the distance to the next symbol.

A column is hidden when it has nothing to show. Overlapping areas (for
example ROM and a language card) appear side by side, up to two per
column. Further overlaps fold into a neighboring bar, marked `+N`; its
tooltip lists them all.

- Hover a bar to see its start and end addresses and its size in bytes.
  Estimated sizes are marked with `~`.

## Navigating

Click any bar to open the [Memory Browser](memory.md) and
scroll it to that bar's start address.
