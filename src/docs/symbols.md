# Symbol Profiler

The Symbol Profiler counts memory reads and writes per symbol over time.
It is available on platforms that implement `startProbing`.

Each row lists a symbol with two counters:

| Column | Meaning |
| --- | --- |
| Symbol | The debug symbol covering that address |
| Reads | Number of memory reads at addresses belonging to the symbol |
| Writes | Number of memory writes |

Rows are color-coded:

- **Code** (green) — the symbol's address was executed.
- **I/O** (teal) — the symbol covers an I/O address.
- **Data** (blue) — the symbol was only read or written.

Counts are cumulative and the probe buffer is cleared each refresh, so
the numbers keep growing while you run and are reset when data is
collected again. Symbols from the debug map are listed even before they
are touched.
