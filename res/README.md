# `res/` — machine firmware and BIOS images

Per-platform firmware blobs and resources, loaded by fetch().

```
res/<platform>/<name>.wasm   machine core compiled to wasm (c64, cpc, vic20, zx)
res/<platform>/<name>.bios   default BIOS/kernel ROM for that core
res/atari8/altirra/          Altirra kernels (.rom) and their debug listings
res/x86/                     SeaBIOS/VGA BIOS and the FreeDOS floppy image
res/common/                  files shared by platforms
```

## How files are loaded

| Directory | Loaded by |
| --- | --- |
| `c64/`, `cpc/`, `vic20/`, `zx/` | `src/common/wasmplatform.ts` fetches `res/<prefix>/<prefix>.{wasm,bios}` |
| `atari8/altirra/` | `src/platform/atari8.ts` |
| `x86/` | `src/platform/x86.ts` |
| `common/` | `src/platform/basic.ts` |

The browser IDE serves this directory as static files; the VS Code extension
ships it in the base asset pack. Everything except the Altirra debug listings,
the x86 images and the CPC and VIC-20 files is included (see `src/tools/exclusions.ts`).

## Provenance

- **c64.bios, vic20.bios** — built from [open-roms](https://github.com/MEGA65/open-roms):

  ```
  git clone https://github.com/MEGA65/open-roms
  cd open-roms && make && cd build
  cat basic_generic.rom chargen_openroms.rom kernal_generic.rom > c64.bios
  ```

- **atari8/altirra/\*** — kernels and listings from the Altirra emulator
- **zx.bios** -- [SEBASIC 3.1.2 open source ROMs](https://zxdesign.itch.io/opense)
- **cpc.bios** — from https://github.com/floooh/chips
- **x86/\*** — SeaBIOS, VGA BIOS and FreeDOS image; x86 is not offered by the
  VS Code extension.

