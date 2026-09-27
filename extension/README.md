# 8bitworkshop for VS Code

Write programs for classic consoles and computers, then build and play
them without leaving VS Code. The extension uses the compilers,
assemblers, and emulators from [8bitworkshop.com](https://8bitworkshop.com):
NES, Atari 2600, Commodore 64, and many more.

Builds and emulation run on your computer. The first build downloads the
toolchains and examples; after that, everything works offline.

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

To look at examples without copying them, run **8bitworkshop: Open
Example**. To use code you already have, open its folder: 8bitworkshop
detects the platform and main file, and says why.

## Settings

| Setting | What it does |
|---|---|
| `8bitworkshop.platform` | The platform, such as `nes`, `c64`, or `vcs` |
| `8bitworkshop.mainFile` | The file that runs. Empty: the file in the editor |
| `8bitworkshop.autoBuild` | `onType` (default), `onSave`, or `off` |
| `8bitworkshop.reloadOnBuild` | `always` (default), `onSave`, or `never` |
| `8bitworkshop.toolchainPath` | Use a local 8bitworkshop checkout instead of downloading |

8bitworkshop saves your choices in `.vscode/settings.json`. Commit it so
people who clone your repo skip the questions.

## More

- [Projects and the file that runs](https://github.com/sehugg/8bitworkshop/blob/master/extension/docs/projects.md)
- [Platform detection](https://github.com/sehugg/8bitworkshop/blob/master/extension/docs/detection.md)
- [Building](https://github.com/sehugg/8bitworkshop/blob/master/extension/docs/building.md)
- [The emulator](https://github.com/sehugg/8bitworkshop/blob/master/extension/docs/emulator.md)
- [Report a problem](https://github.com/sehugg/8bitworkshop/issues)

## License

GPL-3.0. The downloaded components (toolchains, emulators, libraries, etc.) keep their own licenses.

