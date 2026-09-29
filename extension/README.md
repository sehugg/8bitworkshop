# 8bitworkshop for VS Code

![8bitworkshop running a program in VS Code](https://8bitworkshop.com/images/vscode_demo.gif)

The original online 8-bit IDE, now in VS Code!

Write programs for classic consoles and computers, then build and play
them without leaving VS Code.

This extension bundles the assemblers,
compilers, and emulators from [8bitworkshop.com](https://8bitworkshop.com).

Supported platforms include 6502, Z80, and 6809 CPUs:

- **NES / Famicom**
- **Atari 2600 (VCS)**, **Atari 7800**, and **Atari 8-bit** computers
- **Commodore 64** and **VIC-20**
- **ColecoVision**, **MSX**, **ZX Spectrum**, **Amstrad CPC**
- **Apple II**, **Game Boy**, **Sega Master System**, **PC Engine**
- **Arcade hardware** (Galaxian, Space Invaders, Pac-Man, Williams, VIC Dual, Atari Vector)

Supported programming languages include:

- **Assembler** with DASM, ca65, zmac, and more
- **C** with CC65, SDCC, and more
- **BASIC** with batariBASIC and FastBASIC
- **Verilog** for hardware design
- ...and others! There's a lot going on in here!

All building and emulation runs on your computer. The toolchains and
examples are included; only a few platforms, such as Verilog, download an
extra component the first time you use them.

## Get started

1. Open an empty window. In the Explorer, click **New 8bitworkshop
   Project**, or run **8bitworkshop: New Project...** from the Command
   Palette.
2. Choose a platform, such as **NES** or **Atari 2600 (VCS)**.
3. Choose a blank program or an example, then a folder to copy it to.
4. Click **Run** (▷) at the top right of the editor. The emulator opens
   beside your code.
5. Click the emulator to play. Click your code to type again.

Change something and the game rebuilds and restarts as you type. Errors
appear as red underlines and in the **Problems** panel, and the last
version that built keeps running until you fix them.

To look at the included examples without copying them, run **8bitworkshop: Open Example**.

To use code you already have, open its folder: the extension detects the appropriate platform and main file.

## Settings

Project settings, saved in `.vscode/settings.json`:

| Setting | What it does |
|---|---|
| `8bitworkshop.platform` | The platform, such as `nes`, `c64`, or `vcs` |
| `8bitworkshop.mainFile` | The file that runs. Empty: the file in the editor |
| `8bitworkshop.tool` | The build tool, when it isn't the usual one for the file |
| `8bitworkshop.folders` | Projects in subfolders |
| `8bitworkshop.exportRomPath` | Folder for exported ROMs, relative to the main file (`bin` by default) |

Your local user settings:

| Setting | What it does |
|---|---|
| `8bitworkshop.autoBuild` | `onType` (default), `onSave`, or `off` |
| `8bitworkshop.reloadOnBuild` | `always` (default), `onSave`, or `never` |
| `8bitworkshop.exportRom` | Write each successful build's ROM to the export folder |
| `8bitworkshop.toolchainPath` | Use a local 8bitworkshop checkout instead of the included toolchains |
| `8bitworkshop.assetUrl` | Server or local directory to download toolchains from, tried before the default servers |

## Commands

Every command is under **8bitworkshop:** in the Command Palette; several
also appear in the editor title bar, the Explorer, or **Project Options**.

| Command | What it does |
|---|---|
| **New Project...** | Create a project from an example or a blank program |
| **Open Example** | Open a bundled example without copying it |
| **Copy to Workspace** | Copy the open example into your workspace |
| **Set as Main File** | Make the active file the one that runs |
| **Change Main File...** | Pick the main file from the workspace |
| **Change Platform...** | Build the project for another platform |
| **Detect Projects** | Scan the folder for projects and platforms |
| **Add Launch Configuration** | Write a run configuration to `.vscode/launch.json`; <kbd>F5</kbd> debugs it, with step back |
| **Project Options** | Open the project menu |
| **Build** | Build without running |
| **Run** | Build and run in the emulator |
| **Debug** | Build and debug in the emulator, with breakpoints and step back |
| **Run This File** | Run the active file, without changing the project |
| **Run Main File** | Run the project's main file |
| **Follow Active Editor** | Run whichever program is in the editor |
| **Reset / Pause / Resume / Stop / Mute / Unmute Emulator** | Control the emulator panel (shown while it is open) |
| **Prepare Toolchains** | Unpack or download every platform's toolchain for offline use (shown only when a toolchain isn't bundled) |

## Books

Many of the examples come from the 8bitworkshop books. The New Project
and Open Example lists show which platforms have one.

- [Making Games For The Atari 2600](https://www.amazon.com/dp/1541021304)
- [Making Games for the NES](https://www.amazon.com/dp/1075952727)
- [Making Games for the C-64](https://www.amazon.com/dp/B0DMKH8NGL)
- [Making 8-bit Arcade Games in C](https://www.amazon.com/dp/1545484759): Midway 8080, VIC Dual, Galaxian/Scramble, Atari Color Vector, Williams
- [Designing Video Game Hardware in Verilog](https://www.amazon.com/dp/1728619440)

## More

- [Projects](https://github.com/sehugg/8bitworkshop/blob/master/extension/docs/projects.md)
- [Building](https://github.com/sehugg/8bitworkshop/blob/master/extension/docs/building.md)
- [The emulator](https://github.com/sehugg/8bitworkshop/blob/master/extension/docs/emulator.md)
- [Platform detection](https://github.com/sehugg/8bitworkshop/blob/master/extension/docs/detection.md)
- [Changelog](https://github.com/sehugg/8bitworkshop/blob/master/extension/CHANGELOG.md)
- [Report a problem](https://github.com/sehugg/8bitworkshop/issues)
- [Source code](https://github.com/sehugg/8bitworkshop)

## Error reports

When a compiler or the emulator crashes, the extension sends an error report
to 8bitworkshop.com: the error message, stack trace, platform, and tool, plus
VS Code and extension versions. It doesn't send your source files, and VS Code
removes file paths from the report before it leaves. Errors in your program,
like a syntax error or a crash in the emulated machine, aren't reported.

VS Code attaches identifiers to every report: a machine id (stable for your
VS Code install, not tied to your identity), a session id, and a device id.
These group reports from one install together.

The reports follow VS Code's `telemetry.telemetryLevel` setting: set it to
`off` to stop them.

## License

GPL-3.0. The included components (toolchains, emulators, libraries, firmware,
etc.) keep their own licenses; see [THIRD-PARTY-NOTICES.md](THIRD-PARTY-NOTICES.md).

