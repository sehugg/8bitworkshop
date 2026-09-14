# Breakpoints

The Breakpoints window lists every breakpoint in the project and lets you
add, edit, enable, or delete them. It is available on platforms that
implement `runEval` or `runToPC`.

## Kinds of breakpoints

| Kind | Created by | Identified by |
| --- | --- | --- |
| **Source** | Clicking the editor gutter, or **Run To Line** | file and line number |
| **Address** | Using the Breakpoints window | a symbol, `$hex`, or decimal address |

Source breakpoints are shown as red circles in the editor's gutter.

Address breakpoints are resolved against the debug symbol map, so a symbol from
a linker map works as well as a raw address.

A breakpoint that cannot be
resolved (for example a symbol that does not exist)
is shown with an error.

## Conditions

A breakpoint can carry a condition expression. The breakpoint only
stops when the expression evaluates to a non-zero value.

Supported values:

| Value | Example |
| --- | --- |
| Decimal number | `32` |
| Hex number | `$1a2f`, `0x1a2f` |
| CPU register | `PC`, `A`, `X`, `Y`, `SP`, &hellip; |
| Debug symbol | `mainloop` |
| Memory byte | `[$0200]` or `#mem[$0200]` |
| Memory word | `#mem16[$0200]` (little-endian) |
| Video RAM byte | `#vram[$2000]` |
| Video RAM word | `#vram16[$2000]` |
| Current scanline | `#scanline` |
| Current line clock | `#lineclock` |

Supported operators, in C-like precedence: `!` `~` `-` `+` (unary),
`*` `/` `%`, `+` `-`, `<<` `>>`, `<` `<=` `>` `>=`, `==` `!=`, `&`,
`^`, `|`, `&&`, `||`, and parentheses. The whole expression is true
when it evaluates to a non-zero value.

For example, `A == $20 && X < 4` stops only when the accumulator holds
`$20` and the X register is less than 4. A raster condition such as
`#scanline == 222` stops only once the beam has reached scanline 222.

## Managing breakpoints

- **Add** — type an address or symbol and an optional condition, then
  click **Add**. Adding the same address again updates that breakpoint
  instead of creating a duplicate.
- **Enable/disable** — toggle the checkbox on the left. Disabled
  breakpoints are dimmed.
- **Edit** — click the pencil to load a breakpoint into the form;
  **Save** applies the change.
- **Delete** — click the trash icon.
- **Go to Source** — click a breakpoint's location to open the source file, or
  the disassembly, at the breakpoint's address.

Breakpoints are persisted in browser local storage, scoped to the
current platform and project file, so they survive a reload.
