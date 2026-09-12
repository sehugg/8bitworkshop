# Call Stack

The Call Stack window reconstructs the program's call graph from runtime
stack activity. It is available on platforms that implement
`startProbing`.

Each node represents a routine, and its children are the routines it
called. A node shows how many times it was called and (while expanded)
the scanline range where it ran. Because the tree is built from stack
pushes and pops plus the observed jump distances, it reflects what the
program actually did rather than what the source says.

Counts are cumulative: the tree keeps growing as the program runs. The
probe buffer is cleared on each refresh, and the graph resets when the
emulator is reset.

Expanding a node reveals its callees, so you can drill into a hot
routine and see where the time and calls are going.
