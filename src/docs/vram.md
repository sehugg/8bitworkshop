# VRAM Browser

The VRAM Browser is a hex dump of video memory. It is available on
systems with a separate video chip and a `readVRAMAddress` implementation.

It behaves like the [Memory Browser](memory.md) — 16 bytes per
row — but reads through the platform's video-memory accessor instead of
CPU memory, and its rows are all shown with the `video` segment color.

The dump does not scroll to a data segment on open, since VRAM has no
linker segments.
