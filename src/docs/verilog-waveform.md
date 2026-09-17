# Waveform Viewer

The Verilog platform shows a waveform trace below the emulator screen,
with one row per exposed signal. **Click** to give the waveform viewer
keyboard focus.

If the CRT is active, the waveform viewer is hidden by default, below the CRT frame.
You can **click and drag** its frame border up from the bottom of the screen.

## Which signals appear

The trace shows every scalar/vector `logic` signal from the flattened
design: top-level ports and internal registers and wires from every
submodule, not just the top level. These are omitted:

- Non-logic types (arrays, memories)
- Internal simulator temporaries (names starting with `__V`)
- If the design drives video output (it has `vsync`, `hsync`, and `rgb`
  signals), `clk` and `reset`

Multi-bit signals will display their hex or decimal values on top of the waveforms when zoomed in.

## Mouse actions

- **Click** on the trace to move the selection cursor to that clock.
- **Click and drag** to scrub through the trace.
- **Scroll horizontally** to pan left/right.
- For input signals (other than `clk` or `reset`)  **click** its row to change its
  value at the current clock.
