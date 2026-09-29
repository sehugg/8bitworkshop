# Changelog

## 0.1.0

First preview.

- New Project and Open Example, with blank programs and the 8bitworkshop
  examples for each platform.
- Platform and main-file detection for existing folders.
- Builds as you type, with errors in the Problems panel.
- Emulator panel with pause, reset, and mute.
- Syntax highlighting for 6502, Z80, and 6809 assembly.
- Toolchains download on first use, checked against built-in hashes.
- Compiler and emulator crashes send an error report to 8bitworkshop.com,
  following VS Code's `telemetry.telemetryLevel` setting. See the README.
- The Atari 2600 now stops at breakpoints and steps by instruction, not by
  frame, and can step back.
- `.s`, `.asm`, `.inc` and `.a` files in a project get the highlighting
  for the platform's CPU. `.acme` files get 6502 highlighting.
- An `8bws` command in the integrated terminal builds and runs programs
  from the command line, for scripts and AI agents.
- New Project writes a README with build instructions and the link that
  platform detection reads.
- The platform list shows the 8bitworkshop book for each platform that
  has one, with a button to open it.
