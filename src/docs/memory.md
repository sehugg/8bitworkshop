# Memory Browser

The Memory Browser shows a hex dump of CPU memory. It is available on
platforms that implement `readAddress`.

The dump is laid out 16 bytes per row:

```
0000  00 01 02 03 04 05 06 07  08 09 0a 0b 0c 0d 0e 0f
```

- Each row begins with the address of its first byte.
- Rows are color-coded by the memory segment they fall into, using the
  same segment data as the [Memory Map](memmap.md).
- When the window opens it scrolls to the program's data segment.

## Navigating

- **Go To Address** scrolls to an address or symbol and highlights the
  row containing it.
- Clicking a segment in the [Memory Map](memmap.md) opens this
  window and scrolls to that segment's start address.
