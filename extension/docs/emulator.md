# The emulator

The emulator runs your program in a panel beside your code.

## Start it

Click **Run** (▷) at the top right of the editor, or run
**8bitworkshop: Run**. 8bitworkshop builds the program, then starts the
emulator from power-on. Each **Run** starts it fresh.

## Play

Click the emulator to play. Keys go to the game only while the emulator
has focus. When it doesn't, the screen dims and says **Click to play**.
Click your code to type again.

The bar under the screen shows the controls, such as
"←↑↓→ Joypad · Space Button A · Enter Start". To hide it, click **×**. To
show it again, click **Controls** at the bottom right. VS Code remembers
your choice.

## Control it

While the emulator panel is active, its title bar has these buttons:

| Button | Does |
|---|---|
| Pause / Resume | stops and restarts the game |
| Reset | presses the console's reset |
| Stop | closes the emulator |

The emulator pauses while its panel is hidden, and resumes when you show
it again.

## After a change

When a build succeeds, the running game restarts with the new code.
`8bitworkshop.reloadOnBuild` controls this; see [Building](building.md).
A build that fails leaves the last good version running.

## When a program stops

Some programs end, such as a BASIC program. Then the panel says
**Halted** and the reason. Click **Run** to start again.

## Go back in time

The emulator records as it runs. While it's paused, a timeline appears
under the screen. Drag it to see any recorded frame. **Resume** runs on
from the frame you're looking at. Pressing a key there starts a new
future and drops the one that was recorded.

The recording keeps about the last 50 seconds. The NES saves bigger
states, so it keeps about 10 seconds.

## Debug

Click **Debug** (the bug button beside **Run**, at the top right of the
editor) or run **8bitworkshop: Debug** to build the program and debug it.
In a folder with a launch configuration, <kbd>F5</kbd> does the same, and
<kbd>Ctrl</kbd>+<kbd>F5</kbd> (**Run Without Debugging**) just runs it.

- **Breakpoints:** click left of a line number in C or assembly. You can
  also add a breakpoint on a function by name (**+** in the Breakpoints
  view), or on an address in the Disassembly view. A condition such as
  `A == 3` or `[score] > 100` makes the breakpoint stop only when it's true.
- **Stepping:** Step Over, Step Into and Step Out go by source line. In the
  Disassembly view they go by instruction.
- **Step Back** and **Reverse Continue** run backwards through the
  recording, to the previous line or the previous breakpoint hit.
- **Variables** shows the CPU registers. **Watch** and hovers take the
  same expressions as conditions: registers, symbols, `[addr]` for a byte
  of memory, `#mem16[addr]` for a word.
- The **Debug Console** takes the commands of `8bws run -e`, such as
  `mem $0200 32`, `hist 10`, `back 5` and `rbreak main`. Type `help` to
  list them.

A launch configuration can also set:

| Setting | What it does |
|---|---|
| `stopOnEntry` | Stop before the first instruction instead of running |
| `script` | Debug Console commands to run once the program loads, such as `"break main"` |

While you debug, a rebuild doesn't restart the program. Press
<kbd>F5</kbd> again to debug the new build.

**Stop** on the Debug toolbar ends debugging and leaves the program
running in the panel, without breakpoints. Close the panel to stop the
program.

Some platforms, such as Verilog, can only stop between frames. There,
breakpoints and steps work a frame at a time.

## Sound

The emulator plays sound through the panel. Audio starts on your first click
or keypress, the same as the screen.

The panel title bar has **Mute** and **Unmute** buttons. VS Code remembers
whether sound is muted across runs.

## Not yet supported

- Game controllers. Use the keys the controls bar shows.
- Vector platforms, such as the Atari Color Vector and Vectrex, which
  don't draw to a regular screen.
