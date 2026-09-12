# Memory Map

The Memory Map draws the memory image produced by the linker: each
segment is a bar whose position is its start address, whose height is
proportional to its size, and whose color reflects its type.

The window appears when the current project has segment information,
which most linker-based toolchains provide.

- Hover a segment to see a tooltip with its start and end addresses and
  its size in bytes.
- Free space between segments is drawn as an empty bar.
- Segments without a concrete address come from the linker rather than
  an explicit memory area.

## Navigating

Click any segment to open the [Memory Browser](memory.md) and
scroll it to that segment's start address.

## Notes

- Overlapping segments (for example ROM and a load segment) currently
  share the same row; the map does not yet stack them.
