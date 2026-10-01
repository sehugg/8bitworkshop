# Call Graph

The Call Graph window reconstructs the program's call graph from runtime
stack activity, and shows where the clocks go. It is available on
platforms that implement `startProbing`.

Each node represents a routine, and its children are the routines it
called. Beside each name is a summary:

    12x 45.2% 3400/800 @20-31

- `12x` is how many times the routine was called.
- `45.2%` is its share of all clocks the graph has seen.
- `3400/800` is the clocks spent in the routine *and* its callees,
  then the clocks in the routine alone (`self`), not counting callees. The
  `/self` part is left out when the routine calls nothing.
- `@20-31` is the scanline range where it last ran (raster platforms).

Interrupt handlers appear as calls from whatever was running when the
interrupt fired. A call or return instruction's own clocks are counted in
the routine it started in.

Because the tree is built from stack pushes and pops (and, where the
disassembler can tell, call and return instructions), it reflects what the
program actually did rather than what the source says.

Counts and clocks are cumulative: the tree keeps growing as the program
runs. The probe buffer is cleared on each refresh, and the graph resets
when the emulator is reset.

Expanding a node reveals its callees, so you can drill into a hot
routine and see where the time is going. The same call tree is available
from the command line with `8bws run ... -e "profile 60"`.
