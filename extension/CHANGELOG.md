# Changelog

## 0.1.1 (unreleased)

- The Verilog and Verilog (VGA) platforms now appear in New Project and Open
  Example.
- Verilog syntax highlighting.
- The mouse is a paddle in the emulator panel, for programs that read one
  (Verilog designs with `hpaddle`/`vpaddle` inputs, and platforms with paddles).
- Reloading the window closes the emulator tab instead of restoring it blank.
- Debugging a Verilog program shows its signals in Variables, nested by module,
  under a stack frame named for the frame and clock cycle.
- A Machine view in a new 8bitworkshop panel shows the platform's debug info,
  live while the program runs, for platforms that have it.
- A Waveform view in the 8bitworkshop panel shows a Verilog design's signals
  as it runs: zoom, move the cursor, switch hex/decimal, and click an input to
  change it. It shares its drawing and keys with the IDE's waveform pane.
  It records only while it is showing, so opening it while paused runs the
  last frame again to fill it. A design with no video opens it by itself.
- **Record Signals to VCD...** writes a Verilog design's signal changes to a
  `.vcd` file as it runs, without holding them in memory, up to
  1 GB. `8bws run` has a
  matching `vcd FILE` / `vcd off` script command.
- Infer symbol sizes from build output, instead of one byte per variable.
- Removed Hex Editor extension integration, we'll come up with a better one.
- Removed the assetUrl setting.
- Dialog, Inform 6, armips, YASM, arm-tcc and smlrc, which no extension
  platform uses, are no longer packed.

## 0.1.0

First preview.

- New Project and Open Example, with blank programs and the 8bitworkshop
  examples for each platform.
- Platform and main-file detection for existing folders.
- Builds as you type, with errors in the Problems panel.
- Emulator panel with pause, reset, and mute.
- Syntax highlighting for 6502, Z80, and 6809 assembly, and for Verilog
  (including inline `__asm` blocks).
- Toolchains download on first use, checked against built-in hashes.
- Compiler and emulator crashes send an error report to 8bitworkshop.com,
  following VS Code's `telemetry.telemetryLevel` setting. See the README.
- Debugging with <kbd>F5</kbd>: breakpoints on lines, functions and
  conditions; step, step over, step out, step back and reverse continue;
  a timeline to scrub through the recording while paused.
- Debug views: registers, the machine's internal state (the IDE's Debug
  Tree), symbols, a call stack walked from return addresses, and
  disassembly.
- `.s`, `.asm`, `.inc` and `.a` files in a project get the highlighting
  for the platform's CPU. `.acme` files get 6502 highlighting.
- An `8bws` command in the integrated terminal builds and runs programs
  from the command line, for scripts and AI agents.
- Build and Run tools for AI agents in VS Code, such as Copilot's agent
  mode. Run returns a screenshot from a hidden emulator.
- New Project writes a README with build instructions and the link that
  platform detection reads.
- The platform list shows the 8bitworkshop book for each platform that
  has one, with a button to open it.
