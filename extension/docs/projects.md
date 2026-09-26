# Projects and the file that runs

A project is a platform plus the program to build for it. This page
explains how 8bitworkshop decides which file runs, and where it saves
your choices.

## What makes a project

A folder becomes an 8bitworkshop project in one of these ways:

- **New Project** or **Copy to Workspace** creates it.
- You choose **Set as Main File** on a file, or run a file that has no
  project yet, and confirm its platform.
- You accept a detected platform when you open a folder. See
  [Platform detection](detection.md).
- The folder's README has the link the 8bitworkshop website adds when it
  pushes a project to GitHub. 8bitworkshop uses that link without asking.

Files outside a project behave exactly as they would without the
extension.

## The main file and the file that runs

The **main file** is the project's program. **Build** and **Run** build
it even when you're editing another file, such as a header or a file it
links. That way, pressing **Run** in `sprites.c` still runs your game.

The status bar shows the platform and the file that runs, such as
**NES · game.c**. Click it for the project menu.

### Run a different file

To run another program in the same folder, such as a test program:

1. Open it.
2. Choose **Run This File** from the **...** menu at the top right of the
   editor.

It keeps running that file. When you save a file it uses, it rebuilds and
restarts it. The status bar shows its name.

To go back, click the status bar and choose **Run Main File**.

**Run This File** doesn't change any settings. VS Code remembers the
choice for you on this computer.

### Follow the active editor

Choose **Follow Active Editor** from the project menu to run whichever
program you're looking at. Headers, and files another program includes
or links, don't count. The status bar adds **(active file)**.

### A folder of small programs

Some folders hold many separate programs, such as a set of exercises. A
project with no main file runs the program in the active editor. To set
this up, choose **Change Main File** from the project menu, then choose
**(none: run whichever program is open)**.

## Change the main file

Right-click a file and choose **8bitworkshop: Set as Main File**. If the
folder already has a project, you choose one of these:

- **Make game2.c the main file**: Build and Run use it from now on.
- **Run each program in this folder on its own**: the folder becomes a
  folder of small programs.
- **Start a second project in levels**: when the file is in a
  subfolder, that subfolder gets its own project.

Or click the status bar and choose **Change Main File...**.

## Keep a list of programs to run

To switch between programs with <kbd>F5</kbd>:

1. Run the program with **Run This File**.
2. Click the status bar and choose **Add Launch Configuration**.

The program appears in the **Run and Debug** view's list. Choose it there
and press <kbd>F5</kbd> to build and run it. A launch configuration can
also name another platform, so one program can run on `c64` and `vic20`:

```json
{
  "type": "8bitworkshop",
  "request": "launch",
  "name": "Run game.c (VIC-20)",
  "mainFile": "game.c",
  "platform": "vic20"
}
```

<kbd>F5</kbd> runs the program but doesn't debug it yet.

## Where your choices are saved

| Choice | Saved in |
|---|---|
| Platform, main file, build tool | `.vscode/settings.json` |
| Projects in subfolders | `.vscode/settings.json`, under `8bitworkshop.folders` |
| Run This File, Follow Active Editor | VS Code, on this computer only |
| Launch configurations | `.vscode/launch.json` |

Commit `.vscode/settings.json` so people who clone your repo skip these
questions.

A file opened with no folder has nowhere to save, so its platform lasts
until you close the window. Choose **Open Containing Folder** in the
notification to keep it.

## Settings

| Setting | Meaning |
|---|---|
| `8bitworkshop.platform` | The platform id, such as `nes` or `c64`. |
| `8bitworkshop.mainFile` | The main file, relative to the workspace folder. Leave it empty for a folder of small programs. |
| `8bitworkshop.tool` | The build tool, when it isn't the usual one for the file's extension (`ca65` for a `.asm` file, say). |
| `8bitworkshop.folders` | Projects in subfolders. The most specific folder wins. |

For example, a repo with a game at the top and a C64 port in a
subfolder:

```json
{
  "8bitworkshop.platform": "nes",
  "8bitworkshop.mainFile": "src/game.c",
  "8bitworkshop.folders": {
    "ports/c64": { "platform": "c64", "mainFile": "game.c" }
  }
}
```
