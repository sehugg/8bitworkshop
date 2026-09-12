# Debug Tree

The Debug Tree shows a hierarchical view of platform debug information.
It is available on platforms that implement `getDebugTree`.

The tree's shape is defined by the platform. Where the
[Call Stack](callstack.md) reconstructs call flow from observed
execution, the Debug Tree exposes whatever structured state the machine
implements — device registers, internal tables, subsystem state — as an
expandable tree.

## How values are shown

- Numbers are shown in decimal with their hex value.
- Booleans and strings are shown as-is.
- Byte arrays are shown as a short hex dump.
- Objects and functions expand to their properties. Functions marked as
  lazy are only called when the node is expanded.
- Large arrays are split into `$offset` chunks on demand.
- Maps are shown as their key/value pairs.

Nodes collapse and expand on click. The tree refreshes with the emulator
while debugging.
