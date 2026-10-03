# Changelog

## 4.0.0 (unreleased)

### Visual Studio Code extension (preview)

See [extension/CHANGELOG.md](extension/CHANGELOG.md).

### Debugging and the `8bws` CLI

- New `8bws` command-line tool (`npm run cli`) to build and run programs headlessly: `build`, `run`, `verify-replay`, `profile`, `detect`, `list-platforms`, `list-tools`; scripted emulator control; `--png`, `--json`, `--symbols`, `--memdump`, `--info`; platform and main file detected from a project directory.
- Platform detection no longer confuses the Atari 8-bit targets: `atari.h` means the 800 (it is guarded by `__ATARI__`), `atari5200.h` means the 5200, and a folder named for a platform breaks a near-tie.
- Emulators now run on a timeline: step back, seek, reverse run, `rbreak`, and deterministic replay with a replay-verification test that found determinism bugs in several platforms.
- Step Over for C and assembly sources, a Breakpoints pane, and more breakpoint conditions.
- Call Stack view renamed Call Graph, with clocks and more detail per line.
- Reset clears the call graph; breakpoints are re-armed after a build.
- Click the hex offset in the gutter to run to that line.
- Waveform viewer for Verilog, with help and shortcuts.
- Faster line lookups in listings.
- Atari 8-bit: the XEX loader now calls each INIT vector before loading the next chunk (cc65's system-check chunk overlaps the main program), fixing a crash on startup of `tgidemo.c`.

### Editor and UI

- Editor moved from CodeMirror 5 to CodeMirror 6 with Lezer grammars for 6502, Z80, 6809, Verilog, BASIC, batari BASIC, FastBasic, Inform 6 and Wiz; new Cobalt and MBO themes and better indent handling.
- Source search across the project and toolchain headers (F1 for help), with arrow-key navigation, plus symbol search without source.
- Shortcut bar and keyboard shortcut help, F8 pause/resume, Cmd+Shift+G go to offset.
- Settings menu with developer options (highlight whitespace, highlight executed lines, line numbers off by default).
- Hash routing for windows, and per-page titles.
- Mobile layout: tab bar instead of split panes, and a flex toolbar.
- Click `#include`/`#link` decorations to open the file; offer to import a GitHub repo given by `repo=` ("user/repo" or a tree URL).
- Tool info dialog and generated toolchain docs; Help window with ID docs.
- File | New only lists extensions that have skeleton files.
- Removed the Markdown/Showdown platform, the old `script` platform, Google Analytics, Sentry (replaced with a new error-reporting endpoint) and the HTTPS redirect.

### Asset editor

- Undo/redo for edits, including binary files, and reliable undo for palette changes.
- Clickable decorations with start/end line numbers, header and error display, and `#asseteditor/file/line` links.
- Canvas up to 800x1000, interleaved pixel data, Apple II artifact colors, SMS/GG palette layouts, a large color picker, cut/paste, and `#embed` support.

### Platforms

- **Game Boy**: native emulator with GBC double speed, RTC and banking; C via a partial gbdk-2020 header set; presets ported from GBDK, plus Chase and Paku Paku; ghosting on the LCD.
- **Atari 8-bit**: `.atr` disk images, 5th player, ANTIC and POKEY fixes, a8lib common library, scrolling and libdemo examples, oscar64 support.
- **Atari 2600**: a Javatari-derived `vcs.jt4` machine that also runs headlessly; updated `vcs.h`/`macro.h`.
- **Apple II**: paddle/joystick and SW0-2 support, dynamic origin, DOS 3.3 and AppleSingle samples. New self-contained hi-res TGI driver (`a2hires.s`, 280x192, 8 colors, no ROM calls) used by the TGI demos.
- **NES**: updated jsnes and a fix for a write bug.
- **SMS/Game Gear/ColecoVision**: shared code, SMS Solarian port, more presets.
- **Arcade**: Pac-Man hardware, Williams, Galaxian and Astrocade accuracy updates; early Exidy, MCR and Channel F work.
- PC Engine Chase example; BASIC uppercase-only dialect fixes; 6502 KIL instructions halt the emulator.
- C64: openroms-compatible cc65 `_cgetc`/`PLOT` overrides.
- Verilog: fixed a non-convergence bug on settle and a shift-state bug on digit keys.
- `.xa` assembler and the Dialog interactive-fiction compiler added.

### Build tools

- Many toolchains are now WASI builds: cc65 (pinned to 2021 6ac4aa4), DASM 2.20.17, acme, zmac, yasm and merlin32.
- Updated batari BASIC; sdcc now parses `#symbol` directives and fixes lost link errors.
- New build directives replace the legacy CFGFILE-style ones; build parameters no longer leak between builds.
- `#pragma compile("...")` and oscar64 symbol/listing parsing.
- Tool metadata centralized in `src/common/toolmeta.ts`; `npm run toolversions` checks tool versions.
- cc65/ca65/ld65 warnings no longer fail the build; only errors are reported (the WASI tools print non-fatal `Warning:` lines such as duplicate `const` qualifiers).
- cc65 toolchain (cc65/ca65/ld65 WASI builds and the per-platform include/lib zips) updated from the 2021 build (`6ac4aa4`) to cc65 `d8a486a` (V2.19-3867, 2026-09-26). The compiler runs with `--disable-opt OptLoadStore1` (the new step drops stores after loads of the same address, which breaks hardware registers and inline asm) and `-unreachable-code`.
- cc65 `a2.lo.s` (Apple II lo-res TGI) patched in `8bitworkshop-compilers/patches/cc65-apple2-lo-tgi.patch`: a stray `bpl :+` in `INSTALL` made `tgi_install(a2_lo_tgi)` crash on a non-enhanced Apple II.
- Presets adjusted for the newer cc65: NES `chase` closes its zero-page `#pragma` region, C64 `side_scroller` uses an unsigned fixed-point constant, and the Atari vector presets no longer recurse into `main()`. `neslib.h` no longer redefines `NULL` if `stddef.h` already did.
- SDCC: both 3.6.5 and 4.x are bundled; 3.6.5 is the default (several times faster to build) and `//#tooldef c sdcc=4` opts in to 4.x (the default is `SDCC_DEFAULT_VERSION` in `toolmeta.ts`). Programs without an `opt_code*` pragma now build with `--no-peep --nolospre --max-allocs-per-node 500`, including Game Boy, which previously always got the full optimizer. See *SDCC versions* in the build directives docs.
- Build is now only `esbuild` through `scripts/build.mjs`; code split into a headless `src/common/projectcore.ts` / `toolselect.ts`.
- New `buildpresets` script that builds and runs every preset.

## 3.12.1 (2025-11-06)

- Verilog: FemtoRV32 RISC-V module and assembler fixes.
- VCS: `atari2600-ecs.cfg` and better ECS section alignment; cc2600 added; cc7800 build updated.
- Apple II: fixed the 0-9 keys.
- Removed Sentry; updated esbuild and TypeScript 5.9.2; builds on Node 20.x.

## 3.12.0 (2024-11-13)

- New ARM32 platform with arm-tcc, libc, an ELF/DWARF parser and FPU instructions.
- oscar64 compiler support (C64).
- `#embed` directive for sdcc and cmoc.
- Experimental Exidy platform; Astrocade arcade emulation work; Galaxian and Williams preset updates.
- Verilog example categories; sdcc link errors no longer vanish when there are compile errors.
- Debug info panel gets a close button; NES MMC3 RAM/SRAM areas swapped (issue #186); Apple II LC `$C08x` read fix.
- Clarified the multi-license, and more C64 presets and a book link.

## 3.11.0 (2023-11-06)

- New PC Engine platform (32 KB carts, Wiz hello world).
- VCS: preliminary cc65 support, TigerVision (3E/3F) mapper config, a vcslib demo.
- Atari 7800: missing graphics modes, color kill, Kangaroo mode, PIA timer, 7800.h, and a Debug Tree for display lists.
- Atari 8-bit: Debug Tree display list view.
- C64: `.tap` export, Wiz support, updated music player and SID macros, LZ4 example; `incbin` for C files.
- ca65: `.proc` symbols and listing parsing fixes.
- Game controller D-pad switches and 2-button mapping; multiple controllers no longer interfere.
- Removed the `script` platform and Google Analytics.

## 3.10.1 (2023-05-11)

- 6502 opcode stats corrected against TomHarte's ProcessorTests.
- Atari 5200 menu item and presets; Atari 8-bit paddle inputs and music preset.
- Fixed GitHub repository deletion; fixed C64 and vector-ataricolor presets.

## 3.10.0 (2022-10-04)

- New Atari 8-bit emulator, written in TypeScript and cycle-accurate. It replaces the MAME-based one, runs most cartridge games, and loads some well-behaved XEX files.
- New CRT Probe colors: interrupt routines purple, DMA black, normal CPU activity grey with subtle tints for reads, writes and stack changes. Click the CRT Probe or Memory Probe to set a breakpoint.
- New Sega Game Gear platform; the example code is shared with Master System.
- Download Debug Symbols for NES, in Mesen format (contributed by NotExactlySiev).
- Commodore 64: bug fixes, emulator improvements, many more examples (you may need to revert existing files).
- Apple ][ improvements (contributions from micahcowan).
- Single-stepping now switches between windows when appropriate.
- New Help menu with tool- and platform-specific documentation, replacing the "?" button.
- Better parsing of ca65 listing files, so line numbers are more accurate.
- Fixed bugs with GitHub repositories and the browser back button.
- Fixed keyboard issues on some computer platforms.
- Fixed minor bugs in the 6502 and Z80 emulators.
- Updated several compiler tools.

## 3.9.1 (2022-09-13)

Tagged the same day as 3.9.0; no separate notes.

## 3.9.0 (tagged 2022-09-13; announced 2021-12-21)

- The build now uses a JavaScript bundler (esbuild), improving modularity and startup time.
- New Amstrad CPC platform (CPC6128, 128K) with the cpctelera library for C.
- Stella (Stellerator) Atari 2600 emulator added to the MAME/Other menu: native TypeScript, CRT simulation, high accuracy, no IDE debugging.

## 3.8.0 (2021-07-22)

- New Verilog backend that translates modules to WebAssembly, based on Verilator 4: 20-50% faster, 64-bit support, better test compliance.
- Verilog: Scope View swipe support and ergonomic improvements, inline assembler fixes, module state shown in the Debug Tree.
- Updated the C64 and ZX emulators.
- Fixed include/import issues in Silice and Wiz.
- CC65 optimization flags can be overridden with `#define CC65_FLAGS <comma-separated args>`.

## 3.7.2.1 (2021-05-21)

- Upgraded Sentry.

## 3.7.2 (2021-05-19)

- VCS/DASM: better ca65 support (DASM is still preferred for VCS); better macro parsing (macros can be stepped through) and error messages.
- Improved cycle analysis tool: counts up to 76*4 scanlines and inspects JSR subroutines.
- The KIL ($02) instruction breaks into the debugger, usable for assertions.
- Verilog: 32-bit RGB output supported when the upper 8 bits are set (`$FFbbggrr`); a lone module's inputs can be toggled by clicking the Scope view.
- Experimental: Wiz, a "high-level assembly" language (examples for Atari 2600, NES, MSX).
- Experimental: Silice, a semi-procedural HDL (slow to simulate).

## 3.7.1 (2021-01-14)

- Verilog 32-bit RGB output (`$FFbbggrr`), tested with Silice.
- Embed mode: splits, UI tweaks, no line numbers, fixed `saveAs`.
- Fixed GitHub import and branch-name bugs.
- Serial test harness with `readFile`/`writeFile` and save/load state; `devel-6502` platform.

## 3.7.0 (2020-10-08)

- Vintage BASIC interpreter supporting multiple historical dialects via `OPTION DIALECT` (e.g. Dartmouth), with a teleprinter-style interface instead of a CRT.
  - Errors are highlighted as you type; successful edits hot-load into a running program where possible.
  - New "Restart at Line" button.
  - Debug Tree and variable inspection by highlighting a name.
- FastBasic, a BASIC interpreter for Atari 8-bit computers.

## 3.6.0 (2020-07-23)

New platforms:

- Commodore 64 (chips library, MEGA65 open-source BIOS; C and 6502 assembly, no BASIC or disk drive).
- ZX Spectrum 48K (SDCC for C, ZMAC for assembly, SEBASIC ROMs).
- Z-Machine, with Inform 6 and its example games; includes a Debug Tree for object hierarchy and globals.
- Atari 5200 (experimental; MAME-based, no debugging; Altirra BIOS).
- PC DOS x86 (experimental; v86 with FreeDOS, yasm and SmallerC; no debugging).

New tools and features:

- Dithertron: converts images to retro formats (C64 multi/hires, NES, TMS9918A, Apple ][ Hires, Atari ANTIC D, Atari VCS, Bally Astrocade), with export to sample programs for some formats.
- Probe Log: cycle- or instruction-level execution log.
- Symbol Probe: running read/execute/write counts per symbol.
- Call Stack: tree view with call counts and the raster lines where each subroutine starts and ends.
- Debug Tree: inspector for raw emulator state.
- All debug views now supported on VCS, C64 and ZX Spectrum.
- Improved Memory Probe: more symbol lookups on mouse-over, display kept when advancing a frame.
- Double-click a global symbol in the editor to show its value.
- Cycle-level replay slider; opens the relevant listing while rewinding.
- Run to PC by clicking the left gutter; fixed repeated use on the same line.
- Fixed line numbers in CA65 assembly.
- Requests browser storage permission on first new project or repository import (Safari) and reports whether changes will be preserved.
- Memory Map shows overlapping segments side by side.
- "?" toolbar icon links to platform/language help.
- Downloaded ROMs get an appropriate file extension.

## 3.5.2 (2020-06-28)

- Multi-file import with `file0_name`; new upload dialog.
- Started PC DOS support (v86, FreeDOS, FatFS, yasm, SmallerC).
- Started Vectrex (xasm and C) and added the cmoc 6809 compiler.
- C64: better PRG start address detection, F2/F4/F8/F10 keys, IRQ-based program start, ROM cart reset, clock correction, BIOS `gotoxy()` fix.
- Fixed Apple II colors; Player 2 gamepad buttons; Verilog player 2 keys.

## 3.5.1 (2020-04-09)

- C64 added to the platform menu, with scrolling and sprite libraries.
- Debug: variable values on inspect, textual probe view, click the gutter to run to cursor; probe output kept for the last frame.
- Asset editor toolbar and aspect ratios.
- Warns that Safari/iOS removes local data after 7 days.

## 3.5.0 (2019-12-27)

- Five new platforms, programmable in C or assembly: Bally Astrocade (with the open-source AstroLibre BIOS), ColecoVision, MSX (with open-source C-BIOS), Sega Master System, Atari 7800.
- libCV C library shared by the TMS9918A-based platforms.
- New Z80 simulator: much faster and no longer hiccups.
- Memory Probe and CRT Probe debug views.

## 3.4.2 (2019-09-08)

- Quota errors caught on local storage, with a "persist" menu item.
- Verilog: much faster `$readmem`, keycode/keystrobe, fixed the 6502 CPU.
- GitHub: import after publish to get all files.
- Uploads prompt for confirmation; audio buffers cleared when stopping.

## 3.4.1 (2019-08-22)

- Fixed audio autoplay in Chrome (VCS and SampleAudio).
- GitHub: check the repo exists before importing.
- Fixed POKEY/TIA sound, MSX presets and BIOS module, and Atari 7800 fixes.
- Added nesasm3; NES `.asm` uses DASM instead of ca65.
- Updated TypeScript to 3.5.3.

## 3.4.0 (2019-08-10)

- New Nintendo Entertainment System (NES) platform: C via cc65 with a fork of NESLib and Famitone for music/sound, plus 6502 assembly examples.
- Project gallery of homebrew creations, openable in the IDE.
- GitHub integration: publish projects to GitHub from a separate workspace. Limitations: all sources at the root; no conflict resolution (pulling replaces local files).
- Asset Editor for palettes and bitmaps, writing changes back to source via comment tags.
- Memory Map view of the platform's address space.
- Profiler view with a scanline-by-scanline account of executing code.
- Gamepad support, and keyboard controls shown while the emulator runs.
- HTTPS is now the default for new users (File menu option to move existing users).
- Verilog: `$readmemb` and `$readmemh`, Scope view icons, Ctrl-click the CRT to pause on a scanline, new "Verilog VGA" platform (slower, 25 MHz).
- Minor: new dialog boxes, Z80 cycle counts in the assembler editor, more debug info, nicer break-expression dialog, new emulator focus ring.
- Fixes: disappearing first editor line, debugging in listing view, segment names in Memory Viewer, DASM listing/error parser, assorted debugger issues.
- New files no longer get a `local/` prefix (existing files keep it and can be renamed).

## 3.3.0 (2018-12-22)

- Verilog platform: write Verilog and see it simulated in real time on a simulated CRT (about 5 million ticks/sec in JavaScript), with a Scope view, many examples, and a built-in assembler for custom CPUs (e.g. FEMTO-8).
- SDCC (Z80) now runs with `--oldralloc` for much faster compiles at slightly less optimal code. This breaks `bcd_add` and the vector game samples; use "Revert File" to restore the originals.
- VCS: Ctrl-click the monitor to break when the raster beam reaches that position.
- Binary files can be uploaded and included in 6502 assembly with `incbin`.

## 3.2.1 (2018-11-25)

- batari BASIC (Atari 2600) integrated, with presets from "Hello World" to complete games.
- New sidebar and three resizable panes; shows source files, includes, listings and tools.
- "Add Files to Project" menu items: new include files (`#include`) and linked C files (`//#link "..."`).
- Markdown platform with live preview (Showdown).

## 3.2.0 (2018-10-03)

- Debugging keyboard shortcuts: Ctrl+Alt+P pause, R resume, `.` reset, S single step, V single frame, L run to cursor, O run until return, B step backwards.
- Debugging of bankswitched VCS programs (standard 8K/16K/32K and Tigervision 3E/3F; ORG code at `$1000`). Force a mapper by appending its hex code to the filename, e.g. `MyGame[3E]`.
- Apple ][ cassette loading via the c2t tool.
- Bitmap Font Generator in the Tools menu.
- Z80 disassembler.

## 3.1.0 (2018-08-26)

- VCS: header/include files viewable and editable (use double quotes, not angle brackets); fixed emulator blank-screen and wrong-size ROM bugs and a wonky PC when single-stepping; Advance Frame button; Disassembler view using DASM symbols; Stack Info in the Debug Info panel; `TIMER_START`/`TIMER_WAIT` made reliable for every scanline count (a WSYNC is now forced after `TIMER_WAIT`); new PAL example.
- Instant Replay: records the last 120 seconds of game state to rewind and replay.
- Share Playable Link: the whole ROM is embedded in the URL, embeddable via iframe.
- Download ZIP archive of a project or of all changed files for a platform.
- The page is no longer loaded twice on startup.
- New Apple II+ (64K) platform with an alternate Monitor ROM (no Applesoft BASIC); C via cc65 and 6502 assembly.

## 3.0.0 (2018-08-07)

- New browser storage backend; local changes are migrated on first start, allowing many more saved projects.
- HTTPS support (local files on HTTPS and HTTP sites are separate).
- New WebAssembly worker build engine, much faster, with multiple include and link files.
- Window list (folder icon) with listing files, Memory Browser and Disassembler views.
- Error icons beside the editor expand to full messages on mouse-over.
- VCS: no sound while the debugger is stopped; PIA and TIA state shown during debugging.
- "Upload File" menu option.
- Removed "Share File as GitHub Gist" due to GitHub changes.

See the README for credits, third-party emulators, compilers and libraries, and the
[GitHub contributors graph](https://github.com/sehugg/8bitworkshop/graphs/contributors) for the full list.
