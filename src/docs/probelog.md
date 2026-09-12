# Probe Log

The Probe Log is a chronological text view of CPU and memory activity
for a frame. It is available on platforms that implement `startProbing`.

Each line describes one clock tick:

```
(row, col)  <disassembled instruction>  <operations...>
```

- The first pair is the scanline and cycle within the scanline.
- The instruction column shows the disassembly of the code executing at
  that clock.
- The remaining columns list what the instruction did — reads, writes,
  I/O and VRAM accesses, stack pushes and pops, and interrupts — with
  addresses and, where relevant, values.

Write operations are colored differently from reads so they stand out.

The view shows a complete frame, and might be incomplete during debugging.
