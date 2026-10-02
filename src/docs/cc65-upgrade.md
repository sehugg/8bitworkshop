# cc65 Toolchain Upgrade

The cc65 family (`cc65`, `ca65`, `ld65`) used by the 6502 platforms was upgraded
for 8bitworkshop 4.0.

| | Old build | Current build |
| --- | --- | --- |
| cc65 commit | `6ac4aa4` (2021-12-24) | `d8a486a` (V2.19-3867, 2026-09-26) |
| Runtime | Emscripten | WASI (`WASIRunner`) |
| Includes/libs | hand-mixed 2019–2023 objects | one set built from the same revision |
| Files | `fs65-*.data` (~22 MB) | `cc65-fs-<platform>.zip` (~10 MB) |

## Pitfalls

There are a few potential incompatibilities in the new compiler:

- **Inline assembly.** cc65 now optimizes non-volatile inline assembly.
  8bitworkshop runs with `--disable-opt OptLoadStore1` to prevent unexpected changes.
- **`NULL` is now `((void*)0)`** from `<stddef.h>`, so headers that
  defined their own `NULL` had to stop (see `neslib.h`).
- **Signed constant overflow warning**. For example, `128 << 8`
  is now an error-adjacent warning and needs an unsigned constant (`128u << 8`).
- **Recursing into `main()` is an error.** Programs that tail-called
  `main()` need an explicit loop instead.
- **`#pragma bss-name`/`data-name` regions must be closed.** Without a
  matching `pop`, the newer compiler could place earlier globals into
  `ZEROPAGE` and overflow the 256-byte area. (See `nes/chase.c`.)
- **`sp` was renamed to `c_sp`.** The old alias still works but emits an
  `ld65` deprecation warning. Assembly code may need to be modified.

## Warnings vs. errors

8bitworkshop treats only **errors** as build failures; `Warning:` lines are
ignored so a clean build does not fail on style or version noise.

## Apple II graphics

The stock lo-res driver (`a2.lo.s`) required a small upstream
patch (a stray branch in `INSTALL`).