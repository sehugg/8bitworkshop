<!-- Describes the planned extension (../notes/PLAN.md, "Plan: starting a
project" and "Plan: auto-build as you type"). Update it as features land. -->

# Quickstart

Write a program for a classic console or computer, then build and play it
without leaving VS Code.

The extension includes the compilers, assemblers, and emulators from
8bitworkshop.com. Everything runs on your computer and works offline.
A few platforms, such as Verilog, need an extra download the first time
you choose them.

## Make your first program

1. Open an empty window (**File > New Window**). In the Explorer, click
   **New 8bitworkshop Project**. Or run **8bitworkshop: New Project...**
   from the Command Palette (<kbd>Ctrl+Shift+P</kbd>, or
   <kbd>Cmd+Shift+P</kbd> on a Mac).
2. Choose a platform, such as **NES** or **Atari 2600 (VCS)**. Platforms
   with a book show it here.
3. Choose where to start:
   - **Start here** lists a blank program for each language the platform
     supports, such as "Blank C program (cc65)". The first one is the
     usual choice.
   - The other groups are working examples, from "Hello World" to
     complete games. Move through the list to preview each one.
4. Choose a folder. 8bitworkshop copies the program there, opens it, and
   builds it.
5. Click **Run** (▷) at the top right of the editor. The emulator opens
   beside your code.
6. Click the emulator to play. The line under the screen shows the
   controls, such as "Arrows: joystick · Space: fire". Keys go to the
   game only while the emulator has focus; click your code to type
   again.

Now change something, such as a color or a message. The game rebuilds
and restarts as you type. Errors appear as red underlines and in the
**Problems** panel, and the last version that built keeps running until
you fix them.

## Look at examples without copying them

Run **8bitworkshop: Open Example**. Examples open read-only, and **Run** works on them
straight away. To change one, click **Copy to Workspace** at the top
right of the editor.

## Use code you already have

**A folder.** Open it. If the code clearly targets one platform, for
example it includes `neslib.h`, a notification says "This looks like an
NES project" and shows why. Click **Use It**, or **Choose...** to pick
another platform. If the folder holds
several projects, click **Review** and check the ones to use.

**A single file.** Right-click it in the Explorer or the editor and
choose **8bitworkshop: Set as Main File**, then choose the platform.

**A project from the 8bitworkshop website.** Projects the website pushed
to GitHub have a link in their README that names the platform and the
main file. Clone the repo and open it; there's nothing to answer.

8bitworkshop builds with its own tools. It reads Makefiles for clues
about the platform but never runs them.

If 8bitworkshop picks the wrong assembler, it says so: "This looks like
ca65 code; `.asm` builds with dasm. [Use ca65]".

## The status bar

The left side of the status bar shows the platform and the file that
runs, such as **NES · game.c**. Click it to:

- change the platform or the main file
- go back to the main file, or run a different file (see below)
- open **Project Settings**

## Run a different file

To try a test program, such as `test_scroll.c`, open it and choose
**Run This File** from the **...** menu at the top right of the editor.
It keeps running that file: when you save a file it uses, it rebuilds
and restarts it. The status bar shows **NES · test_scroll.c**. To go
back, click the status bar and choose **Run Main File**.

To keep a list of programs to switch between, click the status bar and
choose **Add Launch Configuration**. The program then appears in the
**Run and Debug** view's list, and <kbd>F5</kbd> runs the one you chose.

**A folder of small programs**, like a set of exercises, has no main
file. **Run** runs the program in the editor you're looking at. The
status bar shows **NES · (active file)**.

## Build settings

| Setting | Choices |
|---|---|
| `8bitworkshop.autoBuild` | `onType` (default): build as you type. `onSave`: build when you save. `off`: build with **8bitworkshop: Build** only. |
| `8bitworkshop.reloadOnBuild` | `always` (default): restart the game after each successful build. `onSave`: restart it only when you save. `never`. |

If the game restarting while you type gets in the way, set
`reloadOnBuild` to `onSave`. Errors still update as you type.

Some compilers, such as llvm-mos, build on a server. Those always wait
until you save.

## Other C and assembly extensions

In an 8bitworkshop project, C files use the **8bitworkshop C** language
mode (shown at the right of the status bar) for compilers like cc65 and
SDCC. That keeps C/C++ extensions and clangd from reporting errors that
only apply to desktop C. 8bitworkshop provides hover, go to definition,
and completion instead. Files outside 8bitworkshop projects don't
change.

To keep your usual C tools, set `8bitworkshop.cLanguage` to `c`.

## Where your choices are saved

8bitworkshop saves the platform, main file, and build tool in
`.vscode/settings.json`, whenever you choose or change one. Commit that
file so people who clone your repo skip these questions.

**Run This File** is just for you: VS Code remembers it on this
computer, and it never changes a file. **Add Launch Configuration**
saves to `.vscode/launch.json`.

If you open a single file with no folder, there's nowhere to save, so
the platform lasts until you close the window. Choose **Open Containing
Folder** in the notification to keep it.

## Next steps

- [Projects and the file that runs](projects.md): main files, test
  programs, folders of programs, and launch configurations.
- [Platform detection](detection.md): how 8bitworkshop recognizes
  existing code, and how to fix a wrong guess.
- [Building](building.md): build settings, errors, and where included
  files come from.
- [The emulator](emulator.md): controls, focus, and the panel's buttons.
