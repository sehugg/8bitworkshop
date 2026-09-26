# Platform detection

8bitworkshop can tell the platform of existing code from clues in it, and
it always shows you the clue it used.

## When it runs

- **Set as Main File**, or **Build** or **Run** on a file with no
  project. You asked, so a clear answer applies at once: "Using NES
  (game.c:3 includes "neslib.h"). [Change]". If the answer isn't clear,
  a list shows the likely platforms first, each with its clue.
- **Opening a folder** that has no 8bitworkshop settings. A notification
  appears only when the clues are strong and point at one platform:
  "This looks like an NES project (...). [Use It] [Choose...] [Not Now]
  [Don't Ask]". Nothing changes until you choose **Use It**.
- **8bitworkshop: Detect Projects** scans the folder again, even after
  **Don't Ask**.

If a folder holds several projects, such as `nes/` and `c64/`
subfolders, the notification says how many it found. Click **Review**
and check the ones to use; each gets its own entry in
`8bitworkshop.folders`.

## The clues

Strongest first:

| Clue | Example |
|---|---|
| The 8bitworkshop link in `README.md` | `8bitworkshop.com/...?platform=vcs&file=game.dasm` |
| A ROM file | `game.nes`, `game.a26`, `game.gb` |
| A platform's header or include file | `#include "neslib.h"`, `include "nesdefs.dasm"` |
| Hardware registers | `WSYNC`, `COLUBK` (VCS); `PPUCTRL` (NES); `$D020` (C64) |
| A cc65 target in a Makefile, or a cc65 linker config | `cl65 -t c64`, `nes.cfg` |
| A file extension few platforms use | `.cc2600`, `.bb` |
| A folder named after a platform | `nes/`, `c64/` |

Plain C or assembly with none of these never brings up a notification,
so other projects you open aren't interrupted.

Some platforms share everything detection can see. For example, the
ColecoVision, MSX and Sega platforms all use `cv.h`. Then the list shows
them all and you choose.

## Assembler syntax

A file extension can mean different assemblers: `.asm` builds with DASM
on the 6502 platforms. When you set a main file that's written for
another assembler, 8bitworkshop says so:

> This looks like ca65 code; .asm builds with dasm. [Use ca65] [Keep dasm]

Choosing **Use ca65** saves `8bitworkshop.tool` for the project. When
you accept a project found on opening a folder, the right tool is saved
without asking.

## Fix a wrong guess

Click the status bar, then choose one of these:

- **Change Platform...** to pick another platform.
- **Detect Again** to look at the clues again.

## From the command line

`8bws detect` prints the same guesses and clues:

```bash
8bws detect game.c
8bws detect path/to/folder
```

`8bws build` and `8bws run` use detection when you leave out
`--platform`. If no platform clearly wins, they list the candidates and
ask for `--platform`.
