# Build Directives

A project can contain multiple files. The build system decides how each
file is used based on directives in your source, and each file's
extension selects the tool that compiles or assembles it.

## Projects with multiple files

All files in a project must be referenced from the main project file with
one of these reference types:

- **Include file** — a source file embedded in another using an
  `#include` or similar directive.
- **Linked file** — a source file compiled/assembled and linked into the
  project alongside the main file, using the `//#link` or `;#link`
  directive. A binary file can be included in an assembly project with the
  `incbin` directive.
- **Resource file** — a file that must be included in the project but is
  neither included nor linked from the main file (for example it is
  included from a non-main file). Use the `//#resource` or `;#resource`
  directive.

Here's a C example:

```c
//#link "lzg.c"
#include "lzg.h"
```

If a file cannot be found, check the syntax. Often double quotes are
required, e.g. `#include "file.inc"`.

Only system files that are part of the compiler toolchain can be found
with the `<foo.h>` syntax.

Assembler files can include files using the `.include` or `.incbin`
directives:

```
.segment "CHARS"
.incbin "tileset.chr"
```

## C preprocessor defines

The preprocessor macro `__MAIN__` is defined when compiling the main C
file of a project. You can use this to run tests on your module files:

```c
//#link "file_needed_for_test.c"
#ifdef __MAIN__
#include "file_needed_for_test.h"
void main() {
    test_my_module();
}
#endif
```

The macro `__8BITWORKSHOP__` is defined on all C files.

## Build directives

Build directives are comment lines that tell the build system how to
compile, assemble, or link a project. They can appear in any source file
and are never seen by the toolchain:

- C, SDCC, and cmoc sources mark them with `//`.
- Assembly sources mark them with `;`.

The keyword follows the comment marker and a `#`, and the line must
begin with the comment (leading whitespace is allowed).

### `//#symbol` — define a symbol

Defines a preprocessor macro, an assembler symbol, or a linker symbol:

~~~c
//#symbol [<phase>] NAME[=VALUE]
~~~

The optional *phase* is one of:

| Phase | Meaning |
| --- | --- |
| `c`, `cc`, `compiler` | C preprocessor define (default) |
| `as`, `asm`, `assembler` | assembler symbol |
| `ld`, `link`, `linker` | linker symbol |

A compiler define takes a text value (`cc65 -D`, `sdcc -D`). Assembler
and linker symbols take an integer expression:

~~~c
//#symbol VERSION=3
//#symbol as START=$8000
//#symbol ld NES_MAPPER=4
~~~

A linker symbol defined by a source file replaces (rather than
duplicates) a symbol of the same name that the platform already defines,
so `//#symbol ld NES_MAPPER=...` can select a different mapper without
editing the platform defaults. Linker values must be integer
expressions; a text value is reported as a build error rather than
passed to the linker.

### `//#flag` — pass a raw argument

Passes arguments straight to one tool phase, with no interpretation:

~~~c
//#flag <phase> <arg> [<arg> ...]
~~~

~~~c
//#flag c -Osir
//#flag as --cpu 65c02
//#flag ld -m map.txt
~~~

Arguments may be quoted with single or double quotes when they contain
spaces. This is an escape hatch that the build system cannot validate.

### `//#tooldef` — set a typed build parameter

Sets a named build parameter that the build system understands:

~~~c
//#tooldef <phase> NAME=VALUE
~~~

For the linker phase, the supported parameters are:

| Name | Meaning |
| --- | --- |
| `cfgfile` | linker configuration file to use (e.g. for CC65's ld65) |
| `libargs` | comma-separated list of library/symbol arguments |

~~~c
//#tooldef ld cfgfile=apple2-hgr2.cfg
//#tooldef ld libargs=,nes.lib
~~~

### Commenting out a directive

To disable a directive, break the marker; for example, use `////#` in C
or `;;#` in assembly. A directive that is already commented out is
deliberately *not* recognized.

### Legacy `#define` directives

For backwards compatibility the build system still understands the older
`#define`-based forms:

| Legacy form | Same as |
| --- | --- |
| `#define CFGFILE <file>` | `//#tooldef ld cfgfile=<file>` |
| `#define LIBARGS <a,b,...>` | `//#tooldef ld libargs=<a,b,...>` |
| `#define NES_MAPPER <n>` | `//#symbol ld NES_MAPPER=<n>` |
| `#define CC65_FLAGS <a,b,...>` | `//#flag c <a> <b> ...` |

These may be prefixed with `;` or `/` as well (for example `;#define`),
so they can appear in assembly sources. New code should prefer the
explicit `//#` directives above.

## CC65 custom config files

CC65's linker is controlled with
[configuration files](https://www.cc65.org/doc/ld65-5.html) that define
memory areas and the layout of the final binary or ROM.

Tell the linker to use a custom config file from your main C program:

~~~c
//#tooldef ld cfgfile=apple2-hgr2.cfg
//#resource "apple2-hgr2.cfg"
~~~

The legacy form is also supported:

~~~c
#define CFGFILE apple2-hgr2.cfg
//#resource "apple2-hgr2.cfg"
~~~

Note the lack of quotes around the file name.

## CC65 `#embed` directive

You can include binary files directly in
CC65 `.c` files, a feature not available from the CC65 command line. For
example, given an uploaded file `image-c64.multi.lz4`:

~~~c
const char image_c64_multi_lz4[] = {
#embed "image-c64.multi.lz4"
};
~~~

This creates a byte array named `image_c64_multi_lz4` with the contents
of the binary file.

The `#embed` directive is also supported in Oscar64 and Wiz files.

## SDCC `#pragma`

With SDCC, enable additional optimization by adding one of these lines to
the top of the file:

~~~c
#pragma opt_code_size  // for smaller code
#pragma opt_code_speed // for faster code
~~~

Either pragma slows builds but produces faster and smaller code.

## File extensions

The extension of your source file determines the tool used to assemble
or compile it. Common extensions:

| Extension | File type | Tool |
| --- | --- | --- |
| `.c` | C source file | cc65, sdcc, cmoc |
| `.s` `.ca65` | Assembler file | ca65 |
| `.a` | Assembler file | dasm |
| `.zmac` | Assembler file | zmac (Z80) |
| `.v` | Verilog file | Verilator |
| `.bb` `.bas` | batariBASIC file | batariBASIC (vcs) |
| `.fb` `.bas` | FastBASIC file | FastBASIC (atari8) |
