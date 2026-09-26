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

## Not yet supported

- Sound.
- Game controllers. Use the keys the controls bar shows.
- Vector platforms, such as the Atari Color Vector and Vectrex, which
  don't draw to a regular screen.
