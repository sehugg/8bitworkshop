# Breakpoints

The Breakpoints window lists every breakpoint in the project and lets you
add, edit, enable, or delete them. It is available on platforms that
implement `runEval` or `runToPC`.

## Kinds of breakpoints

| Kind | Created by | Identified by |
| --- | --- | --- |
| **Source** | Clicking a line in the editor gutter, or **Run To Line** | file and line number |
| **Address** | The form in this window | a symbol, `$hex`, or decimal address |

Source breakpoints are shown as red circles in the editor's gutter.

Address breakpoints are resolved against the debug symbol map, so a symbol from
a linker map works as well as a raw address.

A breakpoint that cannot be
resolved right now (for example a symbol that does not exist for the
current platform) is shown with an error instead of an address.

## Conditions

Any breakpoint can carry a condition expression. The breakpoint only
stops when the expression evaluates to a non-zero value. Conditions are
evaluated against CPU state while the emulator is running.

Supported values:

| Value | Example |
| --- | --- |
| Decimal number | `32` |
| Hex number | `$1a2f`, `0x1a2f` |
| CPU register | `PC`, `A`, `X`, `Y`, `SP`, &hellip; |
| Debug symbol | `mainloop` |
| Memory byte | `[$0200]` |

Supported operators, in C-like precedence: `!` `~` `-` `+` (unary),
`*` `/` `%`, `+` `-`, `<<` `>>`, `<` `<=` `>` `>=`, `==` `!=`, `&`,
`^`, `|`, `&&`, `||`, and parentheses. The whole expression is true
when it evaluates to a non-zero value.

For example, `A == $20 && X < 4` stops only when the accumulator holds
`$20` and the X register is less than 4.

Conditions are parsed to a small closure — never `eval()` — so an
invalid expression fails safely.

## Managing breakpoints

- **Add** — type an address or symbol and an optional condition, then
  click **Add**. Adding the same address again updates that breakpoint
  instead of creating a duplicate.
- **Enable/disable** — toggle the checkbox on the left. Disabled
  breakpoints are dimmed.
- **Edit** — click the pencil to load a breakpoint into the form;
  **Save** applies the change.
- **Delete** — click the trash icon.
- **Jump** — click a breakpoint's location to open the source file, or
  the disassembly, at the breakpoint's address.

The breakpoint that the CPU is currently stopped at is highlighted.

Breakpoints are persisted in browser local storage, scoped to the
current platform and project file, so they survive a reload.
