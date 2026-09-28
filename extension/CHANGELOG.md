# Changelog

## Unreleased

- The Atari 2600 now stops at breakpoints and steps by instruction, not by
  frame, and can step back.
- `.s`, `.asm`, `.inc` and `.a` files in a project get the highlighting
  for the platform's CPU. `.acme` files get 6502 highlighting.

## 0.1.0

First preview.

- New Project and Open Example, with blank programs and the 8bitworkshop
  examples for each platform.
- Platform and main-file detection for existing folders.
- Builds as you type, with errors in the Problems panel.
- Emulator panel with pause, reset, and mute.
- Syntax highlighting for 6502, Z80, and 6809 assembly.
- Toolchains download on first use, checked against built-in hashes.
