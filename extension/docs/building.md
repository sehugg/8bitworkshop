# Building

8bitworkshop builds your program with the compilers and assemblers built
into the extension, as you type or when you save.

## When it builds

| `8bitworkshop.autoBuild` | Builds |
|---|---|
| `onType` (default) | after you stop typing for a moment |
| `onSave` | when you save |
| `off` | only when you run **8bitworkshop: Build** or **Run** |

Only changes to the program that runs, or to a file its last build read,
start a build. Editing a file the program doesn't use starts nothing.

If builds take longer than about a second, 8bitworkshop waits longer
after you stop typing.

Some compilers, such as llvm-mos, build on a server. They build only
when you save, whatever the setting says. The status bar's tooltip says
so.

## Errors

Errors appear as red underlines and in the **Problems** panel. The
**8bitworkshop** output channel logs each build, its tool, and its size.

Code you're halfway through typing often doesn't compile, so errors from
a build you didn't save wait until you pause for about a second. The
last version that built keeps running in the emulator until you fix
them.

## Restarting the game

| `8bitworkshop.reloadOnBuild` | After a successful build |
|---|---|
| `always` (default) | the game restarts with the new code |
| `onSave` | the game restarts only when you save; errors still update as you type |
| `never` | the game keeps running until you click **Run** |

A change that doesn't change the output, such as editing a comment,
doesn't restart the game.

## Where included files come from

8bitworkshop looks for files your program includes or links in two
places, in order:

1. The folder of the main file (and the paths you give, such as
   `#include "lib/util.h"`).
2. The examples folder for the platform. For NES, that has `neslib.h`
   and `chr_generic.s`, among others.

That's why a copied example builds even though **Copy to Workspace**
copies only its own files. To edit a library file, copy it into your
folder: your copy wins. When you copy an example, **Also copy library
files** does this for you.

The build tools' own headers, such as cc65's `nes.h`, are built in.

8bitworkshop never runs a Makefile or other build script. It builds
with its own tools.

## The build tool

8bitworkshop picks the tool from the platform and the file's extension,
the same way the 8bitworkshop website does. For example, on the NES,
`.c` builds with cc65, `.s` with ca65, and `.dasm` with DASM.

To use another tool for the main file, set `8bitworkshop.tool`. See
[Platform detection](detection.md) for how it notices code written for
another assembler.
