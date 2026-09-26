# 8bitworkshop for VS Code

A plan for wrapping this repo as a VS Code extension (or small family of
extensions) with syntax highlighting, in-editor compilation + diagnostics,
and the emulator/debugger.

The guiding constraint: **reuse the existing emulators, toolchains, and build
pipeline; don't port the browser IDE.** The web IDE (`src/ide/ui.ts`,
CodeMirror, DOM layout, LocalForage) stays as-is. The extension is a second
front end over the same `Platform`/`Machine`/`Tool` core.

---

## 1. Design principles

1. **Native VS Code surfaces.** Use the built-in text editor, file explorer,
   Problems panel, Output, and the Debug Adapter Protocol. Do not embed
   CodeMirror or the IDE's window manager.
2. **The emulator screen is the only webview.** Video output, keyboard input,
   and (later) audio go through a minimal canvas webview. Everything else is
   native.
3. **Reuse the headless core.** `src/tools/emutarget.ts` and
   `src/tools/testlib.ts` already drive emulation and compilation in Node with
   no browser. The extension host uses the same code the `8bws` CLI uses.
4. **Lazy-load by platform.** Do not bundle every emulator and toolchain into
   the extension entry. See §7.
5. **One worker-message contract.** Share dependency/tool/build-message logic
   between `CodeProject`, `testlib`, and the extension (§6). This is a
   prerequisite, not a follow-up. Debug logic (breakpoints, stepping) follows
   the same rule: the CLI and DAP share one implementation (§8).

## 2. Architecture

```
┌───────────────────────── VS Code window ──────────────────────────┐
│  Text editor (native)   Problems (native)   Webview (screen+keys) │
└───────┬────────────────────────┬───────────────────────┬──────────┘
        │ didChange / save       │ diagnostics           │ frames / keys
        ▼                        ▲                       ▼
┌────────────────────────── Extension host (Node) ──────────────────┐
│  BuildService  ── testlib / workerlib (in-process)                │
│      uses projectcore (§6)            + PLATFORM_PARAMS / TOOLS    │
│  EmulatorService ── EmuTarget + loadPlatform                      │
│  DebugSession (DAP) ── EmuTarget stepping, listings, breakcond    │
│  SymbolService  ── listings/symbolmap from the last build         │
└────────────────────────────┬──────────────────────────────────────┘
                             │ dynamic import()
                             ▼
   src/platform/*   src/machine/*   src/common/*   src/worker/{tools,wasm,fs}
```

The extension host is a Node process, so all the existing `installNodeMocks()`
plumbing in `emutarget.ts` applies unchanged.

### What we reuse

| Need | Existing code |
| --- | --- |
| Compile/assemble | `src/tools/testlib.ts` → `src/worker/builder.ts` (`handleMessage`) |
| Tool selection | `src/common/toolselect.ts` (new, §6), `src/common/toolmeta.ts` |
| Emulation | `src/tools/emutarget.ts` (`loadPlatform`, `EmuTarget`) |
| Platforms/machines | `src/platform/*`, `src/machine/*` |
| Breakpoint conditions | `src/common/breakcond.ts` (`compileCondition`, `parseTarget`), `src/common/breakpoints.ts` (`resolveBreakpoint`) |
| Run/step/break logic | `src/tools/runscript.ts` → `DebugController` (§8) |
| Listings → source lines | `SourceFile` in `src/common/workertypes.ts` |
| Token sets / grammars | `src/parser/*` |
| Toolchain assets | `src/worker/{wasm,asmjs,fs}` |

### What we build (new)

| Piece | Notes |
| --- | --- |
| `extension/` host code | activation, commands, services, DAP (~2–3k LOC) |
| Emulator webview | canvas + key capture (~300 LOC) |
| TextMate grammars | generated from `src/parser` token sets |
| `src/common/projectcore.ts` | shared pure build logic (§6) |
| `src/common/toolselect.ts` | single tool-selection table (§6) |
| `DebugController` | stepping/breaks over `EmuTarget`, shared with the CLI (§8) |
| Workspace `FileProvider` | adapts `vscode.workspace.fs` to the build |

## 3. Extension layout

Single extension for the common case, split only if install size forces it
(§7). Proposed tree:

```
extension/
  src/
    extension.ts        // activate(): register commands, providers, DAP
    buildservice.ts     // compile workspace → ROM + diagnostics + symbols
    emulatorservice.ts  // loadPlatform/EmuTarget lifecycle, frame pump
    debugsession.ts     // DebugSession implementation (DAP)
    webview.ts          // EmulatorPanel: canvas, keys, frames
    symbols.ts          // listings/symbolmap index
    config.ts           // platform / main file / entry detection
  syntaxes/             // generated .tmLanguage.json
  syntaxes/generate.mjs // generator reading src/parser
  package.json          // contributes: languages, commands, debuggers, config
  tsconfig.json
```

`package.json` `contributes` (shipped shape):

- `languages`: one per editor style (6502, z80, 6809, c, verilog, basic, …).
- `grammars`: the generated TextMate files.
- `commands`: Build, Run, Reset, Pause/Resume, Step, Step Over, Step Out,
  Restart at Cursor, Run to Cursor.
- `debuggers`: type `8bitworkshop`, plus a launch-snippet.
- `commands` for starting a project: New Project, Open Example, Copy to
  Workspace, Set as Main File, Run This File, Run Main File, Detect
  Projects (see "Plan: starting a project").
- `configuration`: `8bitworkshop.platform`, `8bitworkshop.mainFile`,
  `8bitworkshop.tool`, `8bitworkshop.folders`, `8bitworkshop.setLanguage`,
  `8bitworkshop.cLanguage`, `8bitworkshop.autoBuild`,
  `8bitworkshop.reloadOnBuild`,
  `8bitworkshop.toolchainPath` (restricted in untrusted workspaces).

## 4. Syntax highlighting

VS Code highlighting is TextMate grammars (and optionally semantic tokens).
The repo already has the hard part — token classification — in two forms:

- **Labeled token sets** in `src/parser/tokens-6502.ts`, `tokens-z80.ts`,
  `tokens-6809.ts`: `opcodes`, `illegalOpcodes`, `registers`, `pseudoOps`,
  `mac`, `hexOp`, etc.
- **Lezer grammars** `src/parser/lang-6502.grammar`, `lang-z80.grammar`, and
  stream parsers for other languages.

Lezer grammars can't be consumed by VS Code directly, so:

1. Write `extension/syntaxes/generate.mjs` that imports the token sets and the
   language stream parsers and emits `.tmLanguage.json` files:
   - keyword lists from `opcodes` → `keyword.mnemonic.6502`
   - `illegalOpcodes` → `invalid.illegal` or a distinct scope
   - `registers` → `variable.language`
   - `pseudoOps`/`mac` → `keyword.control`
   - numbers/labels/comments via generic patterns plus the existing regexes.
2. Map files to languages using the **same registry the IDE uses**:
   `ToolMeta.editorStyle` in `src/common/toolmeta.ts`, prefixed so the IDs
   never collide with other extensions (`8bws-6502`, `8bws-z80`,
   `8bws-6809`, `8bws-wiz`, `8bws-ecs`, ...). C stays the built-in `c`, and
   verilog stays `verilog` when another extension provides it. See "Plan:
   language features and file identification" below for which files get
   these IDs.
3. Add semantic tokens in a `DocumentSemanticTokensProvider` fed by the
   `SymbolService` (labels/equates/symbols from the last build's listings and
   symbolmap). This is the VS Code analogue of the IDE's symbol search
   (`src/ide/search/`) and gives Go to Definition / Rename for free.

Prefer generation over hand-maintained grammars so the opcode tables stay in
one place. `npm run tsbuild` outputs the parser modules to `gen/`; the
generator can import from `gen/parser/` or use `tsx`/esbuild against `src/`.

### Plan: language features and file identification

**The problem.** `.c`, `.h`, `.s`, `.asm`, `.inc`, `.bas` and `.v` belong to
lots of projects and lots of extensions (cpptools, clangd, ARM/x86 asm
extensions, VB, Verilog, Coq). The extension must not change how those
files behave anywhere outside an 8bitworkshop project, and should not
fight another extension inside one.

Identifying a file takes three questions, answered in order: which
project owns it, what role it plays there, and which tool reads it. The
language ID and every feature follow from the answers.

#### Step 1: which project owns the file

A **project** is what the IDE calls one: a main file, the platform, the
tool, and a root (the main file's directory, which include paths resolve
from). A project with no main file is a directory of programs: each
source file there is its own main file (see "Plan: starting a
project").

```ts
interface Project {
  root: string;             // uri of the main file's directory
  platform: string;
  mainFile?: string;        // relative to root; unset = the active file
                            // (the run target, per user, is separate)
  tool?: string;            // only when it differs from toolselect's choice
  origin: 'settings' | 'folders' | 'readme' | 'window' | 'preset';
}
```

`projectFor(uri)` checks these in order and stops at the first hit:

1. **`8bws-preset:` scheme.** The platform comes from the path and the
   main file is the document itself (see "Plan: examples").
2. **`8bitworkshop.folders` entry** whose directory contains the file;
   the longest match wins.
3. **Workspace settings** `8bitworkshop.platform` (plus `mainFile`) for
   the file's workspace folder. The root is `mainFile`'s directory, else
   the workspace folder.
4. **README badge** in the repo (see "Plan: platform and main-file
   detection"). The author declared it, so it counts without a write.
5. **Window-only choice**: a platform chosen for a file opened with no
   folder. There are no workspace settings to write, so it lasts until
   the window closes (see "Plan: starting a project", case 2b).
6. **The last build.** A file outside the root that a build read
   (`../lib/util.h`) belongs to that build's project.

No hit means the file isn't ours. A detection alone never creates a
project; a click, a setting or a badge does.

`projectFor` lives in `extension/src/projectinfo.ts` with no `vscode`
import. It takes the settings, `folders`, and window-only choices as plain
data, so unit tests cover it. A `ProjectScope` in the extension holds the
current list of projects and fires `onDidChange` when settings or builds
change it. Multi-root workspaces work because each
workspace folder has its own settings; the current code's
`workspaceFolders[0]` goes away.

#### Step 2: what role the file plays

| Role | Identified by | Gets |
|---|---|---|
| Main | `project.mainFile` | Build/Run target; all features |
| Dependency | in the last build's `paths` | the reading tool's language; all features |
| Other source | under the root, `isSourceFile()` | language from `toolselect`; features after a build that reads it |
| Asset | binary, or an extension no tool reads (`.chr`, `.pal`, `.nam`, `.rle`) | nothing yet; the asset editor later (§8) |
| Library file | resolved from `presets/<base>` or extracted tool headers | read-only; opened through `8bws-preset:` or the include cache |

**Build and Run target the project's run target**, whatever editor is
active, so pressing Run in a header or a linked file runs the program.
The run target is the main file unless the user switched it; see
"Switching the run target" in "Plan: starting a project".

#### Step 3: which tool reads it, and the language ID

- **Main file**: `project.tool`, else `getToolForPlatform(platform,
  mainFile)`.
- **Dependency**: the tool of the file that included it. `.inc` is dasm
  under a dasm main and ca65 under a ca65 main; `toolselect` can't tell
  from the name alone. `resolveDependencies` already knows the parent of
  each file and whether it was an include or a link; have `BuildOutcome`
  return `files: { path, tool, link }[]` in place of `paths`.
- **Other source**: `getToolForPlatform(platform, fn)`.

The tool maps to a language through `TOOL_META[tool].editorStyle`,
prefixed so IDs never collide with other extensions (`8bws-6502`,
`8bws-z80`, `8bws-6809`, `8bws-wiz`, `8bws-ecs`, ...). Users see these
in the status bar's language mode, so each has a readable alias:
"8bitworkshop C", "6502 Assembly (ca65)", "Z80 Assembly (zmac)". `languageFor(uri)`
returns that ID; the rules below decide whether to apply it.

**Rule 1: features never depend on the language ID.** Register every
provider (hover, definition, references, symbols, completion, links)
with a selector built from the project roots, not a language:

```ts
roots.map(r => ({ scheme: 'file', pattern: new vscode.RelativePattern(r, '**/*') }))
```

plus `{ scheme: '8bws-preset' }`. Re-register when `ProjectScope`
changes. Our features work on a file in a project whatever its language
is; a `.c` file anywhere else sees nothing from us.

**Rule 2: claim a language ID only where nobody else does.**

- *Extensions only 8bitworkshop uses* (`.dasm`, `.ca65`, `.acme`, `.xa`,
  `.nesasm`, `.z`, `.xasm`, `.lwasm`, `.vasm`, `.wiz`, `.ecs`, `.bb`,
  `.cc2600`, `.cc7800`, ...): list them in
  `contributes.languages[].extensions`, generated from `toolmeta.ts`.
  Before each release, check the Marketplace for collisions.
- *Shared extensions* (`.s`, `.asm`, `.inc`, `.a`, `.bas`, `.v`):
  contribute the languages with no `extensions`. When a document opens
  in a project (or a project appears around an open document), call
  `languages.setTextDocumentLanguage(doc, languageFor(uri))`, but only
  when:
  - the document's language is `plaintext` (no other extension claimed it),
  - the user has no `files.associations` entry that matches it, and
  - `8bitworkshop.setLanguage` is not `never` (`auto` is the default).
- *C*: depends on the tool (see below).
- *Undoing it*: remember each document's language before we changed
  it. When its project goes away, set it back.
- *Persisting it*: the extension writes `files.associations` only to a
  `.vscode/settings.json` it creates itself (starting from a template),
  scoped with a folder glob. For other folders, the Project
  Settings page offers "Use 8bitworkshop highlighting for .s files",
  which writes the same entry only when the user clicks it. Nothing pops
  up to ask.

**C: feed clangd and cpptools, don't take files away from them.** Other
extensions for these compilers (VS64 for cc65/llvm-mos/oscar64, Embedded IDE
for SDCC, GBDK's docs) all hand cpptools include paths and defines, and
none claim a language ID of their own. A clang run over the presets
(`extension/scripts/clangcheck.ts`, 2026-09-26) shows that works once the
headers, defines and flags match the compiler:

| Tool | Files with no errors | Errors left |
|---|---|---|
| cc65 (nes, c64) | 70 of 74 | 14: 11 real (cc65 rejects them too), 3 from old-style handlers passed as `irq_handler` |
| sdcc (z80, gb) | 150 of 205 | all in user `.c` files: `__asm ... __endasm;` blocks and `__at 0x7F` without parentheses |

The headers themselves parse clean. What it takes, all in
`extension/src/cheaders.ts` (no `vscode` import):

- *Headers*: `extractHeaders()` writes the tool's preload package
  (`src/worker/fs/fs65-nes.data`, `fssdcc.data`, ...) and the platform's
  `src/worker/lib/<platform>/*.h` to
  `globalStorageUri/include/<extension version>/<tool>-<platform>/`,
  outside the user's workspace. Our include links use them too.
- *Patches*: `patchHeaderForClang()` rewrites what clang rejects and the
  compiler accepts: cc65's `extern void x[]`; SDCC's `__at 0xbe` and
  `__asm` blocks in header functions. Headers only; never user files.
- *Shims*: a forced include per tool, `extension/shims/cc65.h` and
  `sdcc.h`, defines away keywords (`__fastcall__`, `__at(x)`, `__sfr`,
  `__banked`, `__interrupt`, `__asm__(...)`, `restrict`, ...).
- *Defines and flags*: `clangConfig()` takes `define` and
  `extra_preproc_args` from `PLATFORM_PARAMS` (`__C64__ __CBM__`,
  `CV_MSX`), adds the tool's own (`__CC65__`, `__SDCC_z80`, version from
  `TOOL_META`), `-funsigned-char`, `-std=gnu89` (cc65) or `gnu99` (sdcc),
  and downgrades errors the compiler allows (`int-conversion`,
  `implicit-function-declaration`, ...). `--target=msp430` gives 16-bit
  `int` and pointers, which also catches real truncation bugs.
- *cpptools*: gets the config through its `CustomConfigurationProvider`
  (the `vscode-cpptools` npm API) for files in our projects; writes no
  files. It has no 16-bit mode, so `sizeof(int)` is wrong there: a few
  false warnings, no false errors.
- *clangd*: needs `compile_commands.json` (from `clangArgs()`) on disk, so
  it gets the explicit command "Generate compile_commands.json", which
  also writes `.clangd` with `--target=msp430`. Nothing automatic.
- *`8bws-c`*: opt-in only, for people who want no false errors at all
  (mostly SDCC projects with inline assembly).
  `8bitworkshop.cLanguage`: `c` (default: leave C to cpptools/clangd,
  configured as above) or `8bitworkshop` (set `8bws-c`, so they never see
  it). Its grammar `include`s the built-in `source.c`; nothing of our own.
  When set, the old mechanics apply: `setTextDocumentLanguage` for `.c`/`.h`
  in our projects only, `files.associations` to avoid the brief `c` open,
  and our providers in place of IntelliSense.
- *Other tools*: llvm-mos and oscar64 need no shims. sccz80, cmoc,
  cc2600, cc7800, smlrc and armtcc are untested; run `clangcheck` on them
  before adding a shim.

#### Language features, by what they need

Each tier needs only what the one before it has. Ship them in order.

| Tier | Needs | Features | Source |
|---|---|---|---|
| A | nothing | highlighting | generated TextMate grammars (§4) |
| A | nothing | comment toggling, brackets, word pattern | `language-configuration.json` per style (`;` for asm, `//` for C, `REM`/`'` for BASIC), generated with the grammars |
| A | nothing | outline, go to definition within a file | a light label scan (`label:` / column-0 names, `EQU`, `=`) |
| A | nothing | include links | `parseDependencies` + `candidatePaths`, then `presets/<base>`, then the extracted headers |
| A | nothing | hover on a mnemonic | the opcode tables in `src/parser/tokens-*.ts` |
| B | a build | diagnostics | build errors (done) |
| B | a build | outline, go to definition and references across files | labels and equates from the listings and `symbolmap` |
| B | a build | hover on a label | its address and segment |
| B | a build | completion | labels, mnemonics, directives, header symbols |
| B | a build | semantic tokens | labels vs. equates vs. hardware registers |
| C | a platform | hover on a hardware register (`PPUCTRL`, `$D020`) | `getMemoryMap()` and `debugSymbols` |
| D | a running emulator | label values in hover; inline values while paused | the emulator worker's memory reads |

Build data goes stale as soon as the user types. Look symbols up by name,
not by line, so a stale build still answers correctly for most labels.
Positions for go to definition come from the listing and shift with the
edit until the next build; with auto-build on (the default) that's
under a second for most tools.

**Out of scope for v1**: rename, formatting, quick fixes (except "Switch
platform" and "Insert skeleton", see "Plan: starting a project"),
type-aware C completion, and anything across projects.

**Language server or not.** Start in-process, with the logic in a plain
module (`src/common/langsvc/`, no `vscode` import) that takes a project
and the last build result and returns LSP-shaped ranges and results. The
extension wraps it in `vscode.languages.register*` providers. It reads
build results; it doesn't run builds. Keeping those results fresh is
auto-build's job (see "Plan: auto-build as you type"). Reasons:

- The data comes from the build worker, which already runs beside the
  extension host. A separate server process would need its own worker and
  its own copy of the build state.
- The build worker already keeps builds off the extension host thread.

Later, `8bws lsp` in the CLI wraps the same module with
`vscode-languageserver` over stdio, for Neovim, Emacs, Zed, etc. The IDE
can also use it for CodeMirror hover and completion. That makes it the
fourth host of the shared core, like the debug core in §8.

**Tests.**

- Unit tests for `projectFor`: each of the six sources, the order between
  them, the longest `folders` match, and a file under no project.
- Unit tests for `languageFor`: `.s` on nes and on a z80 platform, `.inc`
  under a dasm main and a ca65 main, `c` for `.c` with cc65 by default and
  `8bws-c` with `cLanguage: 8bitworkshop`.
- Unit tests for `cheaders.ts` (done: `test/cheaders.test.ts`).
- Extension test: a `.c` and a `.s` outside any project keep their
  language and get no hover from us. A `.c` in an nes (cc65) project stays
  `c`, and cpptools gets our configuration for it. The `.s` becomes
  `8bws-6502`, and hover on a label returns its address after a build.

## 5. Compiling and errors

### Pipeline

```
didChange/didSave → BuildService.build(workspaceFolder)
  → projectcore.resolveDependencies(workspaceFileProvider, ...)
  → projectcore.buildWorkerMessage(...)   (same struct as the IDE/CLI)
  → workerlib.handleMessage(msg)          (in-process, no Worker)
  → CompileResult { output, errors, listings, symbolmap, segments }
  → DiagnosticCollection + output channel + SymbolService
```

`src/worker/workerlib.ts` runs the builder in-process; `setupNodeEnvironment()`
must be called once. `src/tools/testlib.ts` exposes the convenient wrappers
(`initialize`, `preload`, `compile`, `compileSourceFile`).

### Workspace files

The IDE goes through `ProjectFilesystem` (`src/ide/project.ts`) and the CLI
goes through `fs`. The extension needs a third provider over
`vscode.workspace.fs`. Implement a small `FileProvider`:

```ts
interface FileProvider {
  readFile(path: string): Promise<FileData | null>;  // null if missing
}
```

and pass it to `resolveDependencies` (§6). The provider owns the search
order (workspace folder, then bundled `presets/<base>`). The main file is the
project's (`projectFor`, see "Plan: language features and file
identification"); the active editor is used only until a project has one.

### Plan: platform and main-file detection

Today the platform comes only from `8bitworkshop.platform` (or a quick pick),
and the main file from `8bitworkshop.mainFile` or the active editor. Opening a
folder, a file, or a cloned repo should work without either, and a wrong
guess should be easy to fix (see "Project settings page" below).

**Shared detector: `src/common/detect.ts`** (no DOM, no Node, no vscode).
`detectProject(files)` takes a file listing plus a reader and returns ranked
candidates, each with a score and the evidence behind it:

```ts
interface Detection {
  platform: string; mainFile?: string; tool?: string;
  score: number;                          // 0..1
  evidence: { file: string; line?: number; reason: string }[];
}
```

Hosts show the evidence ("`#include "neslib.h"` in main.c"), so a wrong
guess is easy to understand and correct. The same function serves:
- the extension (folder open, file open, clone);
- the CLI (`8bws build` / `run` without `--platform`, and `8bws detect
  <path>` printing the candidates and evidence);
- the IDE (GitHub import of a repo with no README badge, and file or zip
  import).

**Signals, strongest first:**
1. **Explicit settings.** `8bitworkshop.platform` / `mainFile` in the
   workspace (or the folder overrides below) always win; detection only runs
   when they're unset or the user asks.
2. **The README badge.** Repos exported from the IDE have
   `8bitworkshop.com/...?platform=<id>&file=<main>` in `README.md` (written
   from `README_md_template`, read by `GithubService` in
   `src/ide/services.ts`). Reuse that parsing; it gives both the platform and
   the main file.
3. **ROM files.** `.nes`, `.a26`, `.a78`, `.gb`, `.sms`, `.col`, ... map
   directly (`ROM_PLATFORMS` in `src/tools/8bws.ts`; move it to `detect.ts`).
4. **Includes.** A header → platforms table (`nes.h`, `neslib.h` → nes;
   `vcs.h` → vcs; `c64.h` → c64; `gb/gb.h` → gb; `cv.h` → the libcv
   platforms; ...). Generate it: for each platform, list the headers in
   `presets/<platform>/` and in the tool's system include directory for that
   platform. A header found under only one platform is strong evidence;
   one shared by a family (the libcv or sms platforms) narrows it to the
   family.
5. **File extensions.** Narrow the candidates to platforms whose tool
   selector accepts the main file's extension (`getToolForPlatform`):
   `.v` → verilog, `.bas` → basic, `.bb` / `.ecs` → vcs, `.inf` /
   `.dg` → zmachine. Many extensions (`.c`, `.s`, `.wiz`) fit many
   platforms and only narrow the list.
6. **Assembly fingerprints.** Register names and addresses (`WSYNC` /
   `VSYNC` → vcs; `PPUCTRL` / `$2000` writes → nes; `$D020` / `$D021` →
   c64; `$C030` → apple2), directives (`processor 6502`), segment names
   (`"HEADER"`, `"CHARS"` → nes), and load addresses (`org $0801` → c64).
7. **Build files.** `cl65 -t <target>` or `--target` in a Makefile, cc65
   `.cfg` names (`nes.cfg`), SDCC `-mz80`, and similar.
8. **Folder names.** A directory named like a platform id (`nes/`,
   `c64/`): weak, but it makes the `presets/` layout work.

**Confidence handling.**
- A README badge: use it with no prompt; the author declared it.
- One clear winner (e.g. a unique header): show a notification, "Using
  NES (`#include "neslib.h"` in main.c). [Change]".
- Several close candidates: a quick pick sorted by score, with the evidence
  as each item's detail and the top one preselected.
- Nothing: the full platform picker.
- The accepted choice is written to `.vscode/settings.json`, so detection
  doesn't run again.

**Main file.** For each directory: the README badge's `file=`, else a
source file that no other file includes or links, preferring one named
`main.*`, one with `main()`, or one with a reset vector. When one
candidate stands out, use it. When several are equally likely (every
file has a `main()` and nothing includes the others), the directory is
a directory of programs and gets no `mainFile` (see "Plan: starting a
project").

**Folders with several projects.** A repo like `presets/` has many platforms
in one workspace, but VS Code settings are per workspace folder, not per
subdirectory. Detect per directory of the main file, and keep overrides in a
map: `"8bitworkshop.folders": { "nes": { "platform": "nes", "mainFile":
"shoot2.c" } }`, keyed by the directory relative to the workspace. The
top-level `platform` / `mainFile` remain the default.

**Noticing a wrong platform.** Some build failures suggest the platform is
wrong, not the code: a missing platform header (`nes.h: No such file`), or
a tool that doesn't accept the file. When one occurs, run detection again,
and if another platform scores higher, offer "This looks like a <platform>
project. [Switch] [Keep <current>]" in the error notification.

**Opening and importing.** When detection runs, and what happens to its
result, is in "Plan: starting a project" (cases 2 and 3). Projects made
from templates get their settings written, so they need no detection.

**Testing.** `presets/<platform>/` is a labeled corpus: every file's true
platform is its directory. A test runs `detectProject` on each preset's
main file and checks the top candidate: an exact match, or the same family
where the family can't be told apart without more context (the libcv and
sms variants). Record the accuracy and fail on regressions. Add cloned
public repos to the corpus as they turn up.

### Plan: starting a project

There are three ways in. All three end in the same state: a `Project`
(see "Plan: language features and file identification") that
`projectFor` finds, the main file open, and a finished build. They
differ only in where the files and the platform come from.

| Start from | Files come from | Platform comes from | Writes |
|---|---|---|---|
| 1. A template (preset or blank) | `presets/<base>/`, copied | the user's pick | files + settings |
| 2. An existing file | the user | detection, confirmed | settings |
| 3. A checked-out repo | the user | README badge, else detection | settings once accepted; nothing for a badge |

**Templates: presets and skeletons are one list.** Most skeletons are a
hello world for one tool, and the user doesn't care which kind a
template is. The index (`out/presets.json`, see "Plan: examples") lists
each `skeleton.<tool>` as a template too: `{ id: 'skeleton.cc65', name:
'Blank C program (cc65)', category: 'Start here', tool, rename: true }`.
The only difference left is the name: a skeleton is copied as `main`
plus the tool's first extension (`skeleton.cc65` → `main.c`), because
`skeleton.<tool>` isn't a name every tool accepts (`skeletonBuildName`
in `buildpresets.ts`; move it to `toolmeta.ts`). A preset keeps its
name. "Start here" sorts first, one item per tool, the platform's
default tool at the top. The IDE's New File menu can read the same list
later.

**Commands.** Few, with names that say what they change:

| Command | Where | Does |
|---|---|---|
| New Project... | welcome view, walkthrough, palette, Examples tree | case 1 |
| Open Example | palette, Examples tree | opens a template read-only; changes nothing |
| Copy to Workspace | title bar of a read-only example | case 1, starting at step 3 |
| Set as Main File | explorer and editor context menus | case 2 |
| Run This File | editor title context menu, status bar menu | makes this file the run target and runs it; changes no settings |
| Run Main File | status bar menu, shown while the target isn't the main file | switches the run target back |

**Shared pieces.**

- **Where a choice is kept: always `.vscode/settings.json`.** Every
  accepted platform, main file and tool is written there, so there's one
  place to look and one thing to explain. Cloned repos pay for it with a
  changed or new file in `git status`; users commit it (and teammates
  skip detection) or ignore `.vscode/`. Nothing is written until the
  user acts: a README badge alone writes nothing, and detection writes
  only after Use It. The one exception is a file opened with no folder
  (case 2b). The run target is per user and never goes in settings (see
  "Switching the run target").
- **Which setting.** One project whose root is the workspace folder uses
  the top-level `platform` / `mainFile`. A project in a subdirectory uses
  an `8bitworkshop.folders` entry. `tool` is written only when it isn't
  what `toolselect` would choose.
- **Destination, one rule for every copy.**
  - Workspace folder open and empty: copy into it.
  - Workspace folder open with files: a new subfolder named after the
    template, with a `folders` entry. The input box shows the path and
    has an "Elsewhere..." button.
  - No folder open, or "Elsewhere...": pick a parent directory and a
    name, create the folder, and open it in this window (a new one if
    this window has a folder).
- **`saveProject(project)`** writes a project to settings (top-level or
  a `folders` entry). Every command and the Project Settings page use
  it.
- **`copyTemplate(template, destDir)`** copies text and binary files
  through `vscode.workspace.fs`. If a file exists it asks (overwrite,
  skip, or cancel), never overwriting silently.
- **Last step, every time**: open the main file, build, and show the
  result in the status bar. Don't start the emulator unasked; the Run
  button is one click away.
- **Where our UI appears.** The Run button, the status bar item and the
  code lenses appear only for files in a project, and for files with an
  8bitworkshop-only extension (`.dasm`, `.ca65`, ...). A `.c` or `.s`
  file anywhere else shows only the "Set as Main File" context menu
  item, so C developers who happen to have the extension installed
  don't see a Run button on their code. The welcome view and the
  walkthrough are how new users find the rest.

#### 1. Starting from a template

*Entry points*: New Project... (welcome view, walkthrough, palette, the
Examples tree's context menu on a platform), and Copy to Workspace on a
read-only example. Later, a URI handler
(`vscode://8bitworkshop.8bitworkshop/open?platform=nes&file=hello.c`)
so the website can link "Open in VS Code".

1. **Platform.** A quick pick grouped by family, the current platform
   first, each with its full name ("NES", "Atari 2600 (VCS)") and its
   book, if any, as the detail. Platforms whose tools are in a pack that
   isn't installed (§7) say so ("downloads 12 MB"); picking one installs
   the pack before step 2, so the first build doesn't fail on a missing
   tool.
2. **Template.** "Start here" (the blanks) first, then the presets by
   `category`, with the file name and tool as the description ("hello.c
   · cc65"). The quick pick previews as you move: the focused item opens
   read-only in a preview editor.
3. **Destination**, by the rule above.
4. **Copy.** The main file (renamed for a blank), plus each file the
   index lists for this template that no other template reads. Files
   several presets share (`neslib.h`, `chr_generic.s`) still resolve
   from `presets/<base>/`, because local files come first and the
   presets directory is the fallback. A checkbox, "Also copy library
   files", copies those too, for people who want to edit them or build
   without the extension.
5. **Settings**: `platform` (the id the user picked, not the preset
   directory: `gb` and `gb.color` both read `presets/gb/`), `mainFile`,
   and `files.associations` for the shared extensions the template uses
   (Rule 2), in `.vscode/settings.json`, or a `folders` entry for a
   subfolder.
6. Open the copy (replacing the read-only editor, if any) and build.

**Read-only examples.** Open Example, the Examples tree, and the preview
in step 2 open `8bws-preset:/<platform>/<id>` read-only. Build and Run
work there at once (`origin: 'preset'`); nothing is written. Typing in
one is the first thing a new user will try, so register the file system
with a `readonlyMessage` ("Examples are read-only. [Copy to
Workspace](command:...) to edit this one.") in place of VS Code's
generic "Cannot edit in read-only editor".

*Edge cases*: a template the build can't handle is marked in the index
and isn't offered in New Project. A preset id with a directory
(`nes/chase/...`) keeps that directory under the destination.

*Insert skeleton*: an empty file that is a project's main file (the user
made `game.c` by hand and chose Set as Main File) gets a code lens,
"Insert blank NES program (cc65)". That covers the IDE's other path,
where a missing main file starts as the skeleton.

#### 2. Starting from an existing file

*Situations*:
(a) a folder is open and the file is in it, with no project;
(b) the file is open with no folder (`code game.s`);
(c) the file is in a folder that already has a project with another
main file.

*Entry points*: Set as Main File; Build or Run from the palette with a
file no project owns; the Run button and status bar item on
8bitworkshop-only extensions. Opening a `.c` or `.s` file alone does not
prompt; the file may not be ours.

1. Run `detectProject` on the file and its directory.
2. **Confirm the platform.** A clear winner shows a notification with
   the evidence: "Using NES (`#include "neslib.h"` in main.c).
   [Change]". Close candidates show a quick pick with
   the evidence as each item's detail. Nothing found shows the full
   platform picker.
3. **Confirm the tool.** Extensions mean different things to different
   assemblers: `.asm` goes to dasm on the 6502 platforms, and `.s` to
   ca65 or sdasz80. Detection also reads the dialect (ca65's `.segment`
   and `.proc`; dasm's `processor` and `seg`; zmac vs. sdasz80 syntax),
   and when it disagrees with `toolselect`, the notification says so and
   offers the tool: "This looks like ca65 code; `.asm` builds with dasm.
   [Use ca65] [Keep dasm]". Choosing ca65 stores `tool`.
4. **Save it** (`saveProject`). The file is the
   main file, its directory is the root, and the language rules apply to
   it and its neighbors.
5. Build.

*Per situation*:
- (a) The key is the file's directory: top-level settings if that is the
  workspace folder, else a `folders` entry.
- (b) There's no workspace to save to. The choice lasts until the window
  closes, and the notification offers "Open Containing Folder", which
  opens the folder and writes the settings there. Includes still resolve
  from the file's directory.
- (c) Set as Main File asks: "Make game2.c the main file" or "Start a
  second project in this folder". The second adds a `folders` entry if
  the file is in a subdirectory; for the same directory it clears
  `mainFile` (see "a directory of programs" below).

*A directory of programs.* Some folders hold many small programs, each
its own main file, all for one platform: `presets/nes/`, a course's
exercises, the IDE's local storage exported to disk. A project with a
platform and no `mainFile` builds the active editor if it's a main file
candidate (not included or linked by another file), else the last main
file. Detection sets it up this way when a directory has several main
file candidates of the same platform, and the status bar shows
`$(chip) NES · (active file)`.

#### Switching the run target

Games grow test programs: `test_scroll.c` links the game's scrolling
code and draws a test pattern, `soundtest.s` plays every effect. The
user wants to run one, fix the code it tests, save, see it again, then
go back to the game. None of that should touch the committed settings.

Keep two things apart:

| | Main file | Run target |
|---|---|---|
| What | the project's program | what Build, Run and build-on-save use right now |
| Stored in | settings (`mainFile`), shared through git | `workspaceState`, per user, never committed |
| Changed by | Set as Main File, Project Settings | Run This File, the status bar, a launch configuration |
| Default | detection or the template | the main file |

- **Switching.** Run This File makes the file the run target and runs
  it. It stays the target: saving `scroll.c` rebuilds `test_scroll.c`
  and reloads the emulator with it, which is the loop the user wants.
  The status bar shows the target, `$(chip) NES · test_scroll.c`, and its
  tooltip names the main file.
- **Going back.** The status bar menu lists the main file first ("Run
  Main File"), then recent targets, then "Follow Active Editor", then
  the other main file candidates in the root. While the target isn't the
  main file, it also offers "Add Launch Configuration" for it (below).
  Reloading the window keeps
  the target; there's no timeout that silently switches back.
- **Follow Active Editor** makes the target whatever main file candidate
  is active. It's the default for a directory of programs (no
  `mainFile`), and anyone can turn it on for a project that has one.
- **Named targets people share: launch configurations.** VS Code already
  has a switcher for this, the Run and Debug dropdown, and F5 runs the
  selected entry. Each `8bitworkshop` launch configuration names a
  `mainFile` (and may name a different `platform` or `tool`: the same
  game on `c64` and `vic20`, or on `gb` and `gb.color`). Starting one
  sets the run target to it. The status bar menu lists them too. They
  live in `.vscode/launch.json`, so a team can commit their test
  programs; a single user never has to.
- **Build results per target.** Keep the last build of each recent
  target (a few), not just the last one. Language features look a file
  up in the build that read it, preferring the current target, so
  hover and go to definition in `scroll.c` still work while
  `test_scroll.c` is the target. Diagnostics show the current target's
  build only; a "Build All Targets" command (after v1) builds the main
  file and each launch configuration and shows all their errors.
- **The emulator** restarts on the new target's ROM when the target
  changes. The old target's machine state is lost until save states
  exist (§8).
- **Later: variants of one file.** Testing a feature with a flag
  (`-DTEST_SCROLL`) instead of a second file needs a `defines` field in
  the launch configuration and a way to pass it through the build
  message to each tool. Not in v1.

#### 3. Starting from a checked-out repo

*Entry points*: opening a folder with no 8bitworkshop settings, whether
from `Git: Clone`, "Open Folder", or `code .`. Activate with
`workspaceContains` on the 8bitworkshop-only extensions and
`README.md`, in addition to `onStartupFinished`, so detection runs as
soon as the folder opens.

1. **Workspace trust.** Detection only reads files, and builds run
   sandboxed WASM tools on a virtual file system, so both work in
   restricted mode (`capabilities.untrustedWorkspaces: { supported:
   'limited' }`). `8bitworkshop.toolchainPath` loads JavaScript, so list
   it in `restrictedConfigurations`: an untrusted repo can't point it at
   its own code.
2. **README badge.** If the README has the IDE's badge
   (`8bitworkshop.com/...?platform=<id>&file=<main>`), that is the
   project (`origin: 'readme'`): no detection and no prompt, just the
   status bar item. Share the parsing with `GithubService`
   (`src/ide/services.ts`) through `detect.ts`.
3. **Scan.** Otherwise list the source files (skip `.git`,
   `node_modules`, and `files.exclude`; stop after a few thousand), group
   them by directory, and run `detectProject` on each directory with
   main file candidates.
4. **Results.** Only strong evidence prompts: a platform header, a
   hardware register fingerprint, a cc65 target, a ROM file. `.c` and
   `.s` files alone never do.
   - *One project*: "This looks like an NES project (`#include
     "neslib.h"` in main.c). [Use It] [Choose...] [Not Now]". Unlike case
     2, the user didn't ask, so nothing applies until they click Use It,
     which writes the settings.
   - *Several* (a book repo, a repo with `nes/` and `c64/` folders): one
     notification, "Found 5 8bitworkshop projects. [Review]". Review
     opens a **Projects** view in the 8bitworkshop activity-bar
     container: one item per directory with its platform, main file, and
     evidence, and Accept / Change / Ignore on each.
   - *Weak or nothing*: no notification. Most repos aren't ours. The
     user can still run Set as Main File, or "8bitworkshop: Detect
     Projects".
   - *Dismissed*: closing the notification without choosing is "not
     now"; "Don't ask for this folder" is remembered. Either way the
     Projects view keeps the findings.
5. **Other build systems.** Makefiles, cc65 `.cfg` files, and linker
   scripts are evidence for detection only. We build with our own
   toolchains and never run `make`. If the repo needs include paths
   (`-I lib`), that's an `8bitworkshop.includePaths` setting, after v1.
6. Build the accepted project(s), and show errors if the repo doesn't
   build with our tools. A missing platform header triggers the "wrong
   platform?" check from "Plan: platform and main-file detection".

*Round trip with the IDE*: repos the IDE pushed to GitHub have the
badge, so they open in VS Code with no questions. The other way, an
"Open in 8bitworkshop IDE" command builds the badge URL for a repo with
a GitHub remote. Adding a badge to the README is an explicit command,
never automatic.

#### Scenarios

What a user sees, step by step. Each was a check that the plan above
doesn't leave them stuck or surprised; the fixes are already folded in.

**A. First run, nothing open.** The welcome view offers "New
Project..." and "Open Example", and the walkthrough starts. The user
opens Open Example → NES → Hello World. It runs. They type in it: the
read-only message offers Copy to Workspace. With no folder open, that
asks for a parent directory and name, creates `hello/`, opens it, and
builds. Pressing Run again works, and saving rebuilds.
*Fixed*: VS Code's generic read-only error, and a separate "New Project
from Example" command that did the same thing as Copy to Workspace.

**B. "I just want a blank C program for the 2600."** New Project... →
Atari 2600 → "Blank C program (cc65)" at the top of the list → empty
workspace, so it lands in the root as `main.c`. Nothing asks whether
they meant a preset or a skeleton.
*Fixed*: two lists and two commands for what is one choice.

**C. A tutorial file, no folder.** `code game.asm`, written for ca65
from an NESdev tutorial. `.asm` is shared, so no Run button and no
status bar item; they run "8bitworkshop: Run" from the palette.
Detection finds `PPUCTRL` and `.segment "HEADER"`: "Using NES ... This
looks like ca65 code; `.asm` builds with dasm. [Use ca65] [Keep dasm]",
then "[Open Containing Folder]". It builds with ca65.
*Fixed*: `.asm` silently going to dasm and failing with dozens of
syntax errors.
*Still weak*: a user who doesn't know the palette command. The walkthrough
has a step for "Already have code? Set as Main File".

**D. Cloning a repo the IDE exported.** The README badge names vcs and
`game.dasm`. The status bar shows `$(chip) VCS · game.dasm` and nothing
pops up. Run works. Nothing is written, so `git status` stays clean.

**E. Cloning an unrelated C project** with the extension installed. No
notification, no Run button, no status bar item, no language changes,
clangd works as before.
*Fixed*: an earlier draft prompted on any single-candidate detection,
which `.c` files alone could produce.

**F. Opening the repo's `presets/` folder** (or a course's exercises).
"Found 38 8bitworkshop projects. [Review]". Each platform directory is
a directory of programs: opening `nes/climber.c` and pressing Run builds
and runs climber.c; switching to `hello.c` and pressing Run builds that.
*Fixed*: "Build and Run always target the main file" made this layout
unusable, which is also how the extension is developed today.

**G. Adding a second file.** In the project from A, the user creates
`sprites.c` and adds `//#link "sprites.c"` to `hello.c`. Pressing Run
with `sprites.c` active builds `hello.c`, which the status bar shows as
the main file. After the build `sprites.c` is a dependency and gets
hover and go to definition.

**H. A second program next to the first.** The user creates
`game2.c` in the same folder and wants to run it. Run This File makes
it the run target. Set as Main File asks "Make game2.c the main file"
or "Start a second project in this folder"; the second turns the folder
into a directory of programs (F).

**J. Testing a feature.** The game is `game.c`, linking `scroll.c`. The
user writes `test_scroll.c`, which links `scroll.c` too, and chooses Run
This File. They fix a bug in `scroll.c` and save: `test_scroll.c`
rebuilds and the emulator reloads it, not the game. The status bar says
`NES · test_scroll.c`; its menu's first item, Run Main File, goes back.
`git status` shows nothing new. If they want the test for good, "Add
Launch Configuration" in the same menu writes it to `launch.json`, and
it appears in the Run and Debug dropdown.
*Fixed*: an earlier draft ran another file only once, so the first save
rebuilt the game and the test vanished from the screen.

**I. A wrong guess.** Detection picked `sms-sg1000-libcv`; the user
meant `coleco` (they share `cv.h`). The status bar item → Change
platform. Or the build fails on a missing header and offers the better
match. The Projects view shows the evidence either way.

#### Tests

An extension test per case, each ending in a successful build and
`projectFor(main)` returning the expected project:

1. New Project for (nes, `hello.c`) into an empty folder: the settings
   are written and no library file is copied. New Project for (vcs,
   blank dasm): `main.dasm` is written and builds.
2. Open `presets/c64/hello.c` with no folder; accept the detection;
   check that nothing was written and the choice holds for the window. A
   ca65
   `.asm` file gets `tool: ca65`.
3. A fixture repo with a README badge (no prompt); one with `nes/` and
   `c64/` subfolders (two projects in the Projects view); and a plain C
   repo (no prompt, no language change).
4. A directory of programs: Run follows the active editor.
5. Run target: after Run This File on `test_scroll.c`, saving a file it
   links rebuilds `test_scroll.c`; Run Main File goes back; settings are
   unchanged. A launch configuration with its own `mainFile` sets the
   target when started.

Scenarios A–J are the manual checklist before each release.

### Plan: project settings page

VS Code's own Settings UI already lists `8bitworkshop.*`. Make it usable:
- Give `8bitworkshop.platform` an `enum` with `enumDescriptions` (platform
  names), generated into `package.json` at build time from the platform
  list, so it's a dropdown.
- Add `markdownDescription` to each setting.

Add **"8bitworkshop: Project Settings"**, a webview page for the current
project (the main file's directory):
- **Platform**: a dropdown grouped by family, showing what detection found
  and why (the evidence list), with a "Detect again" button.
- **Main file**: a dropdown of the candidates, with the reason for each.
- **Tool**: the tools valid for the platform and main file, with the
  default marked ("default: cc65").
- **Build**: the auto-build mode (see "Plan: auto-build as you type") and the toolchain
  path.
- **Scope**: save for the whole workspace, or for this directory only
  (writes the `8bitworkshop.folders` override).
- Saving writes `.vscode/settings.json`, says so, then rebuilds and restarts
  the emulator if the platform changed.

The status bar item becomes `$(chip) NES · main.c`, showing the run
target. Clicking it opens a short menu: Run Main File and recent targets
(see "Switching the run target"), Follow Active Editor, Change platform,
Change main file, Add Launch Configuration, Detect again, Project
settings. `extension/docs/QUICKSTART.md` describes this menu; keep them
in step.

### Plan: examples (presets)

There's no preset UI yet. The IDE lists each platform's presets from
`platform.getPresets()` (`{id, name, category?}`) and loads
`presets/<platform>/<id>`; library headers the preset includes come from the
same directory at build time (`ProjectFileProvider` in `buildcore.ts` already
falls back to `presets/<base>/`).

**Preset index.** Platform modules are only loaded in the emuworker, so
generate `out/presets.json` at extension build time instead: platform → presets
(`id`, `name`, `category`) plus, for each preset, the files its build
reads (from a build's `paths`). `src/tools/buildpresets.ts` already loads
every platform headlessly, calls `getPresets()`, and builds each preset;
have it write this index (it has `--json` for its report already). Presets
the build can't handle stay in the index but are marked.

**Browse without copying: an `8bws-preset:` file system.** A read-only
`FileSystemProvider` serves `8bws-preset:/nes/hello.c` from
`<toolchain root>/presets/`. Opening a preset opens that document:
highlighting works, and Build/Run work because `runBuild` reads through
`vscode.workspace.fs` (the platform comes from the path, so no settings
are needed). An editor title action, "Copy to Workspace", turns it into a
project.

**Entry points.**
- **Command "8bitworkshop: Open Example"**: a two-step quick pick.
  Platform first (the current platform at the top, then the rest by
  family), then the preset, grouped by `category` with separators, `name`
  as the label and the file name as the description. It opens the preset
  read-only (above).
- **An "Examples" tree view** in an 8bitworkshop activity-bar container:
  platforms → categories → presets. Clicking opens the read-only preset;
  the context menu has "Copy to Workspace" (on a preset) and "New
  Project..." (on a platform). "Start here" (the blank templates) is the
  first category under each platform.
  Filter to the current platform by default, with a toggle for all.
- **A walkthrough** (`contributes.walkthroughs`) for the first run: pick a
  platform, open an example, run it, change something, watch it rebuild.
- **The empty-workspace welcome view** (`viewsWelcome`) links to "New
  Project..." and "Open Example".

**Copying.** New Project... and Copy to Workspace are case 1 of "Plan:
starting a project", which also lists the skeletons as templates.

**Packaging.** Examples need `presets/` shipped with the toolchain assets
(section 7).

### Plan: books

The IDE's Books menu (`index.html`, `.book-*` links) highlights the book for
the current platform (`updateBooksMenu` in `src/ide/ui.ts`): nes, vcs,
verilog, c64, or the arcade book when the main file's tool is `sdcc`. Most
presets are the books' example code, so the extension can make the link
where it's relevant, not in pop-ups.

**Shared table.** Move the mapping to `src/common/books.ts`: `{ id, title,
url, cover, platforms, tools }` plus `bookForProject(platform, tool)`.
`updateBooksMenu` uses it, and the extension imports it.

**Links.** Point at `https://8bitworkshop.com/books/<id>` redirects rather
than store URLs, so links (and affiliate tags) can change without an
extension release, and clicks can be counted on the server instead of by
telemetry in the extension. Open them with `vscode.env.openExternal`.

**Where they appear:**
- **Marketplace page.** The extension README gets a "Books" section with
  covers and one line on each; set `sponsor.url` in `package.json` if there's
  a page for supporting the project.
- **Examples.** In the Examples tree (see "Plan: examples"), a platform with
  a book shows it as the first child ("📖 Making Games for the NES"), and
  presets from the book show it in their tooltip. The "Open Example" quick
  pick shows the book as the platform item's detail.
- **Walkthrough.** The last step, "Learn more", shows the book for the
  platform the user picked (walkthrough steps take `when` clauses and a
  cover image).
- **Help.** An "8bitworkshop: Books" command, and a "Books & docs" entry in
  the status bar menu (see the settings page plan) listing all the books,
  the current platform's first.
- **The welcome view** of the Examples view: one line for the current
  platform's book.

**What not to do.** No notifications or pop-ups for books, nothing in the
emulator panel or the editor, and no repeated prompts. Marketplace
reviews punish nagging (check the current Marketplace guidelines before
publishing).

### Diagnostics

`CompileResult.errors` is `{ line, msg, path? }[]`. Map each to a
`vscode.Diagnostic` on the right document (default to the main file when
`path` is absent), severity Error, range `[line-1, 0] .. [line-1, lineLen]`.
Clear the collection at the start of every build. Multi-file errors already
carry a path, so opening the wrong file is avoidable.

### Build triggers

Today: `buildOnSave` (default on) and an explicit **Build** command.

### Plan: auto-build as you type

The IDE builds about 300 ms after each change (`refreshDelayMsec` in
`src/ide/views/editors.ts`, 1000 ms for remote files) and reloads the
emulator, so the game changes while you type. That is the feel people
come to 8bitworkshop for, and the extension should have it.

**It supplements the language features; it doesn't replace them.** The
two are producer and consumer:

- Auto-build *produces* the Tier B data (see "Language features, by what
  they need"): diagnostics, listings, `symbolmap`, segments. Without it
  that data is only as fresh as the last save.
- The language service (`src/common/langsvc/`) *answers queries* from
  that data plus Tier A scans, synchronously. A hover or a completion
  can't wait 200 ms to seconds for a compiler, and half-typed code
  doesn't compile, so the last good build keeps answering while the
  current one fails.
- Tier A features (highlighting, label scan, include links, mnemonic
  hover) need no build at all, so they work in files no build has read
  yet and in projects whose build is broken.

With auto-build on, stale build data mostly goes away, so the langsvc
can stay simple: no incremental parser of its own.

**Setting**: `8bitworkshop.autoBuild`: `onType` / `onSave` / `off`,
replacing `buildOnSave`. **Default: `onType`**, with the limits below,
because it matches the IDE and the templates and examples are small.
What makes it safe as a default:

1. **Only what the build reads.** Changes to the run target or a file in
   its last build's `paths` trigger a build; other files don't.
2. **Debounce and coalesce.** Wait 300 ms after the last change. While a
   build runs, remember that another is needed and start one when it
   finishes, with the newest buffers; never queue one per keystroke. The
   build worker already runs builds one at a time.
3. **Slow tools back off.** Measure each build. If builds of this target
   take more than about a second (sdcc on a big file, verilator,
   armtcc), stretch the debounce to twice the last build time. Remote
   tools (`TOOL_META[tool].remote`, llvm-mos) never build on type: they
   cost the server and the network, so they use `onSave` whatever the
   setting says, and the status bar tooltip says why.
4. **Errors don't flicker.** A build that fails while the user is still
   typing keeps the previous diagnostics on other lines, and shows new
   ones only after 1 s with no typing, or on save. A successful build
   clears them at once. Log type-builds to the output channel only when
   they fail after the pause.
5. **The emulator follows successful builds only.** A failed build
   leaves the last good ROM running. A build whose ROM is byte-for-byte
   the same (a comment edit) doesn't reload, as in the IDE's
   `arrayCompare` check in `ui.ts`. Setting
   `8bitworkshop.reloadOnBuild`: `always` (default; the IDE's behavior:
   the game restarts on each successful change), `onSave` (type-builds
   update diagnostics and symbols, and only a save restarts the game),
   or `never`.
6. **Not during a debug session.** While a debug session is paused or
   has breakpoints armed, builds still run (for diagnostics and symbols)
   but the ROM loads on resume, restart, or an explicit Reload, so the
   code under the debugger doesn't change beneath it. The Debug toolbar
   shows "New build available".
7. **Nothing written.** Type-builds read unsaved buffers (the file
   reader already prefers them) and never write the ROM to disk. Saving
   stays the user's choice.

**When `onSave` is better**, the Project Settings page and the status
bar tooltip say so: big projects, slow tools, and anyone who finds a
restarting game distracting (`reloadOnBuild: onSave` is often the
better fix for that).

**Tests.** With a fake clock: five edits within 300 ms cause one build;
an edit during a build causes exactly one more; an edit to a file
outside `paths` causes none; a remote tool never builds on type; a
failed type-build keeps the last ROM loaded and the old diagnostics; an
identical ROM doesn't reload.

### Native-vs-toolchain detail

The toolchain assets (`src/worker/wasm`, `asmjs`, `fs`) are loaded at runtime
by name, so they do **not** need to be bundled. But the Node shims resolve
paths relative to `process.cwd()`:

- `src/worker/workerlib.ts`: `importScripts` → `path.resolve(process.cwd(), …)`
- `src/worker/wasmutils.ts`: `PWORKER = "../../src/worker/"`

The extension must redirect these to `context.extensionPath` (or a configured
`8bitworkshop.toolchainPath`) rather than inherit VS Code's cwd. This is the
single most important packaging detail; without it, builds fail to find wasm.
Either make the shims accept a configurable root or `process.chdir()` to the
resource root at activation (the CLI relies on cwd, so a configurable root is
cleaner).

## 6. Shared build core

`CodeProject` (`src/ide/project.ts`) and `testlib` (`src/tools/testlib.ts`)
duplicate dependency resolution, tool selection, and worker-message assembly,
and the two have **drifted**. A third copy in the extension would make it
worse. Extract the environment-free parts first, and pin today's behavior with
a test before moving code.

### Known drift

| Area | IDE (`CodeProject`) | CLI (`testlib`) | Shared version |
| --- | --- | --- | --- |
| Nested includes | main file only (`sendBuild` TODO) | recursive | recursive |
| Duplicates | `fn` and `dir/fn` both load, same stripped filename sent twice | deduped by filename | dedupe by stripped filename |
| Where files are found | `fn`, `mainDir/fn` via overlay FS | `sourceDir`, `presets/<base>`, cwd | core emits candidates; `FileProvider` decides where to look |
| Message with no deps | `updates` + `buildsteps` | legacy `{code, path, tool}` | always `updates` + `buildsteps` |
| Tool for a link step | from `dep.path` | from `dep.filename` | from `dep.filename` |
| Remote tools (`remote:`) | all deps in the main step | no concept; link deps split | IDE behavior |
| Tool selection | `Platform.getToolForFilename` | hand-copied override table | one table (below) |

The CLI's hand-copied table already produces wrong results: atari7800 lacks
`.cc7800`/`.c78`, vcs lacks `-llvm.c`, and channelf has no `PLATFORM_PARAMS`
entry, so it falls back to the Z80 table (`.c` → sdcc instead of cc65).

### Tool selection: `src/common/toolselect.ts`

Move every `getToolForFilename_*` function into one lightweight module:

- the per-arch functions from `baseplatform.ts` (`_6502`, `_z80`, `_6809`,
  `_arm32`);
- the per-platform ones (`_vcs`, `_Atari8`, and the inline versions in
  `atari7800`, `apple2`, `nes`, `channelf`, `pce`, `verilog`, `x86`,
  `zmachine`, `basic`);
- a `getToolForPlatform(platformId, fn)` entry that picks by platform id, then
  base platform, then arch.

Platform classes set `getToolForFilename = fn => getToolForPlatform(id, fn)`.
`testlib`'s table is deleted. The module must not import `baseplatform.ts`,
which statically pulls in CPU cores, `emu.ts`, and audio.

### Build core: `src/common/projectcore.ts`

No DOM, no `fs`, no `Worker`.

```ts
export interface FileProvider {
  /** Return file contents, or null if missing. Search order is the provider's. */
  readFile(path: string): Promise<FileData | null>;
}

export function stripLocalPath(path: string, mainPath: string): string;

/** Candidate paths for each include/link directive (fn, and dir/fn). */
export function parseDependencies(text: string, mainPath: string, tool: string,
                                  platformId: string): { includes: string[]; links: string[] };

/** Recursive, deduped by stripped filename. */
export function resolveDependencies(fp: FileProvider, mainPath: string, mainText: string,
                                    tool: string, platformId: string): Promise<Dependency[]>;

export interface BuildMessageSource {
  mainPath: string;
  mainData: FileData;
  platformId: string;
  getToolForFilename: (path: string) => string;   // may return "remote:..."
  symbols?: BuildSymbolLists;
  buildArgs?: BuildArgLists;
  dataItems?: WorkerItemUpdate[];
}
export function buildWorkerMessage(src: BuildMessageSource, deps: Dependency[]):
  { msg: WorkerMessage; filename2path: { [k: string]: string }; preloads: string[] };

// build-result post-processing, used by the IDE editors, CLI, and DAP
export function processListings(listings: CodeListingMap): void;  // SourceFile + per-path sourcefiles
export function getListingForFile(listings: CodeListingMap, path: string, mainPath: string): CodeListing;
export function mergeSegments(nativeSegs: Segment[], linkerSegs: Segment[]): Segment[];
```

`processListings` and `getListingForFile` come from `CodeProject`
(`processBuildListings`, `getListingForFile`, `withSourceFileForPath`,
`findSourceFileForPath`). The DAP needs them for source-line breakpoints.

Callers keep only their environment-specific halves:

- `CodeProject`: `ProjectFilesystem` + its `filedata` cache wrapped as a
  `FileProvider`, the real `Worker`, `pendingWorkerMessages` coalescing, `qid`
  queries, posting `preloads`, callbacks, `onFileSystemUpdate`.
- `testlib`: a `FileProvider` over `fs` (source dir → `presets/<base>` → cwd)
  and in-process `handleMessage`.
- extension: a `FileProvider` over `vscode.workspace.fs` and in-process
  `handleMessage`.

### Status: done

- `src/common/toolselect.ts` holds every tool-selection function and the
  per-platform table. Platform classes point at it; `testlib`'s copy is gone.
- `src/common/projectcore.ts` holds `resolveDependencies`,
  `buildWorkerMessage`, `processListings`, `getListingForFile`, and
  `mergeSegments`. `CodeProject` and `testlib` both call it.
- Dependency resolution is breadth-first (the main file's own deps keep their
  order), tries `dir/fn` before `fn`, and takes the first candidate that
  exists.
- Tests: `test/unit/testprojectparity.ts` (every preset, IDE vs CLI message),
  `testprojectcore.ts`, and `testtoolselect.ts` (every platform object vs the
  table).
- All 373 presets build with the same tool, result, and output size as before.

## 7. Platform separation and packaging

Almost everything is already lazy; the extension must not defeat it.

- **Emulators** are lazily imported via `src/platform/_index.ts` (`import()`
  switch). Keep the extension entry free of static imports of `src/platform/*`
  or a barrel that pulls them all in.
- **Toolchains** are loaded on demand from `src/worker/{wasm,fs,asmjs}` by
  `wasmutils.ts`. ~66MB total, but only the invoked tool's assets load.
- **`binaryen` is the one eager offender**: `src/common/hdl/hdlwasm.ts`
  statically imports it, so the verilog path drags 7.3MB into whatever chunk
  contains `hdlwasm` (the current web build emits a 6.8MB `verilog-*.js`
  chunk). Make it a dynamic import inside the methods that use it
  (`getBinaryenType`, `init`, `genModule`):

  ```ts
  let binaryen: typeof import('binaryen');
  async init() { binaryen ??= await import('binaryen'); /* ... */ }
  ```

Packaging sizes to plan around:

| Asset group | Size |
| --- | --- |
| `src/worker/wasm` | 38 MB |
| `src/worker/fs` | 27 MB |
| `presets/` | 9.3 MB |
| `binaryen` | 7.3 MB |
| `verilator_bin.wasm` alone | 5.9 MB |

A single VSIX carrying all toolchains is ~80MB and every user pays for it.
Recommended:

- **`8bitworkshop`** base extension: host code, common emulators, presets,
  small toolchains (6502/Z80 assemblers, cc65, sdcc).
- **Optional per-family packs** (Marketplace or first-use download):
  `verilog` (verilator + binaryen + yosys), `arm32`, `m6809/cmoc`,
  `oscar64`, `cc7800/cc2600`. These carry the large wasm and the emulator
  module for that family.

The natural lazy boundaries (`importPlatform`, `loadNative`) already match
these packs, so splitting is mostly a distribution decision, not a code
change.

**Packs carry assets, not features.** A pack holds wasm, fs packages, npm
modules (`binaryen`) and presets. Commands, views, the build and emulator
workers, and detection stay in the base, so there's no extension API to
design and version. A standalone Verilog extension would need one (or copies
of the workers and panel); the waveform view's host is also shared with the
other debug views, so it belongs in the base.

What a pack needs from the base:
1. **Asset roots per tool.** `rootDir()` returns one toolchain root, and the
   build worker loads everything from it. Resolve each tool's assets (and
   `binaryen` in the emuworker) from a list of roots: the base, then each
   installed pack (`vscode.extensions.getExtension(id).extensionPath`).
   Build Verilog support this way from the start.
2. **Missing-pack prompt.** When the main file's tool lives in a pack that
   isn't installed (e.g. verilator, yosys, silice), offer to install it.
   Detection already knows the platform.
3. **Packaging.** A `package.json` per pack with `extensionDependencies` on
   the base, a build step that copies its assets, and a VSIX and CI job
   each. Release base and packs together from this repo, so versions match.

The Verilog pack: `verilator_bin.wasm` (6MB), `silice.wasm` and `fsSilice`
(2MB+), `binaryen`, `presets/verilog`. `yosys.wasm` isn't in
`src/worker/wasm`; check that tool still works. The jsasm `editorStyle` fix
(milestone 3) goes with the Verilog work. `.v` stays with other Verilog
extensions (Rule 2) either way. Create the second package at the packaging
milestone, along with the other packs.

### Extension-host build format

Avoid one monolithic CommonJS bundle with `binaryen` inlined. Ship the tsc
output tree (like the CLI) or bundle ESM with `splitting: true` and mark
`binaryen` external, so each `require('platform/verilog')` /
`require('binaryen')` resolves lazily at runtime.

### TODO: keep the IDE out of platform modules

Platforms now call `haltEmulation()` from `src/common/emu.ts`, which runs the
handler the host installs with `setHaltHandler()` (the IDE pauses and shows
the halt; the extension's emuworker reports `halted`; headless runs ignore
it). That cut the IDE modules in `extension/out/emuworker.js` from 40 to 8.

The help-topic registry moved from `views/helpview.ts` (which imports every
help page) to `src/ide/helptopics.ts`, so the docs left the emulator bundle
(4.3MB to 1.8MB) and the extension build no longer needs `mdPlugin` or
`src/md.d.ts`.

The verilog platform no longer imports the IDE. It asks an `HDLHost`
(`src/common/hdl/hdlhost.ts`) for its scope and toolbar controls:
`createScope(video, provider)` returns a `WaveformScope`
(`src/common/waveform.ts`, which also holds `WaveformMeta` and
`WaveformProvider`), and `showVideoControls` / `showSettleCount` replace the
`$("#speed_bar")` and `$("#verilog_bar")` calls in `verilog.ts` and
`hdlruntime.ts`. The IDE installs its host at startup (`src/ide/hdlhost.ts`,
with `SplitWaveformScope` in `waveform.ts`); headless runs install none and
get no scope. The emuworker bundle now has no IDE modules (1.7MB), the
extension no longer needs `bootbox` types, and `test/cli/testheadless.js`
starts verilog without the IDE.

**TODO: verilog in the extension.** `start()` now works headlessly. Still to
check: loading a real design (the survey's zero ROM isn't one; the CLI's
`run` refuses verilog output because it isn't a byte array), and
`binaryen`, which is external. Then:

- **Extension HDL host.** Install an `HDLHost` in the emuworker whose scope
  forwards trace data to the Waveform view; the platform keeps producing
  `trace_signals` / `trace_buffer` and the host decides how to show it.
- **VCD export.** Write the trace buffer as a VCD file, from the IDE, the CLI
  (`8bws run`), and the extension. VS Code users can open it in an existing
  waveform viewer (e.g. VaporView, Surfer, WaveTrace -- check their current
  state). Cheap, but a snapshot, not a live view.
- **Live waveform view.** A dedicated Waveform view, not part of the
  emulator panel; see "Plan: dedicated debug views" in section 8.

`basic` and `devel-*` also don't run headlessly: their constructors build UI
with jQuery on the main element, and `loadPlatform` passes `null`.

## 8. Emulator and debugging

### Emulator service

`loadPlatform(id)` returns an `EmuTarget`; `start()` swaps in headless video
stand-ins. For the extension we still want those stand-ins (we render in the
webview, not with `RasterVideo`), so `EmuTarget` is used as-is:

- Run loop: drive `advanceFrame()` on a timer (~60Hz) in the extension host,
  then `getVideo()` → `{ pixels: Uint32Array, width, height }`.
- Send frames to the webview. Transfer the buffer (or use `postMessage` with
  an `ArrayBuffer` transfer) to avoid copies. The webview does
  `new ImageData(new Uint8ClampedArray(buf), w, h)` → `putImageData`.
- Input: webview captures keydown/keyup, posts `{key, flags}`; call
  `EmuTarget.setKeyInput(key, code, flags)` with `Keys`/`KeyFlags` from
  `src/common/emu.ts`.
- Reset: `EmuTarget.reset()`. Load ROM: `loadROM(bytes)`.
- Audio (phase 2): implement a `SampledAudioSink` that forwards samples to
  the webview's Web Audio context instead of the silent `NullAudio`.

The webview only needs a canvas and a `message` handler — no IDE assets, no
CodeMirror, no jQuery.

**First-time players.** Writing the quickstart showed two things a new
user can't guess:
- *Focus.* Keys go to the emulator only while the panel has focus. When
  it does, the controls hint fades in, as in the IDE; it fades out on
  blur (a "Click to play" overlay was too much). The webview's
  `focus`/`blur` events drive it. Keys never go to the emulator while
  the editor has focus.
- *Controls.* Show a one-line controls hint under the canvas ("Arrows:
  joystick · Space: fire · Enter: start"), generated from the platform's
  key map (`KeyMapEntry` tables in `src/common/emu.ts`), not written by
  hand per platform. Hide it with a toggle; remember that per user.

### TODO: platforms that don't run in the extension

Survey (2026-09-25): started each `listPlatforms` id in `emuworker.js` with a
ROM from `test/roms/` (or zeros) and watched for frames. These work: apple2,
astrocade, atari7800, atari8-800/5200, c64, coleco, exidy, galaxian(-scramble),
gb, mcr, msx, mw8080bw, nes, pacman, sms-*, sound_williams-z80, vic20,
vicdual, williams, zx. Since then (2026-09-26), vcs and arm32 work too. These don't:

| Platform | Symptom | Cause / fix |
|---|---|---|
| `vcs` | fixed | `loadScript` hook, headless frame capture, keys: see "Plan: VCS, verilog, and vector first". |
| `x86` | `null.appendChild` | Scripts load now (`loadScript` hook); `start()` builds its console UI on the null main element. |
| `arm32` | fixed | The `loadScript` hook loads capstone; needs a real ROM to check. |
| `basic`, `devel-6502` | `null.style`, then `$ is not defined` | Constructors build UI with jQuery on the main element; `loadPlatform` passes `null`. |
| `verilog` | `$ is not defined` (fixed: starts headlessly) | UI moved behind `HDLHost`; still needs a real design loaded and a waveform view (see the plans below and in section 8). |
| `pce` | `Ctx.createImageData is not a function` | Draws through its own canvas context; the headless stand-in context lacks it. |
| `williams-defender`, `williams-z80` | `Worker is not defined` | The sound CPU runs in a web `Worker` (`src/common/audio/z80worker.js`). Stub it out headlessly or map it to `worker_threads`. |
| `vectrex` | halts: `Cannot set properties of undefined (setting '14')` | Not investigated. |
| `vector-*` | no frames | Vector video isn't forwarded; the webview needs line drawing (`VectorVideo.drawLine` ops). |
| `kim1` | no frames | LED display, no raster video; needs its own view. |

Also:
- **Start timeout.** A platform whose `start()` never settles leaves the
  panel blank with no error (the CLI already reports "never finished
  starting"). Time out `start` in the emuworker and report it.
- **Platform ids.** `listPlatforms` returns build ids; some have no emulator
  by that name: `atari8-800xl`, `atari8-800xl.disk`, `cpc`, `cpc.rslib`,
  `base_z80` ("not found. Available: cpc.464, cpc.6128, ..."). Map them the
  way the IDE does, or only offer ids that have both a tool and an emulator.
- **Keep the survey.** Turn it into an extension test that fails when a
  working platform stops producing frames. For now, run
  `node extension/scripts/survey.js [platform...]` after `npm run build`
  (`ROMSIZE=16384` sets the size of the zero ROM it uses when `test/roms/`
  has none).

### Plan: VCS, verilog, and vector first

Order: vector (smallest), VCS, then verilog. The other broken platforms wait
behind a "not supported yet" message (step 0).

**0. "Not supported yet" message.** Keep a list of platforms the extension
can't run yet in `extension/src/`, generated from the survey. `run` on one of
them still builds, then shows "8bitworkshop: running <platform> in VS Code
isn't supported yet; the build succeeded (<n> bytes)" instead of opening a
blank panel. Also add the `start` timeout so a platform missing from the list
fails with a message instead of hanging. The survey test (above) keeps the
list honest.

**1. Vector (`vector-*`, `vectrex`).** Frames are line lists, not pixels.
- The headless `VectorVideo` stand-in in `emutarget.ts` records each
  `drawLine(x1, y1, x2, y2, intensity, color)` into a flat `Float32Array` and
  `clear()` starts a new frame. `VideoOutput` gets a `kind: 'raster' |
  'vector'` with `lines` and the 1024x1024 coordinate size.
- The emuworker posts the line buffer (transferred) in place of pixels; the
  webview draws it the way `VectorVideoImpl` does (same `COLORS`, gamma,
  `lighter` compositing, persistence fade on `clear()`), so it looks like the IDE.
- The stand-in takes no constructor arguments today, so `width`/`height` are
  unset; vectrex's halt (`setting '14'`) is probably that. Check it first.
- CLI: `run --platform vector-z80color` gets a line count per frame;
  `--png` could rasterize the lines later.

**2. VCS.** Done (2026-09-26). Uses Javatari (`vcs`), not Stellerator.
- Why: the IDE's VCS debugging (step, step back, breakpoints, `readAddress`,
  `saveState`, the probe) is all Javatari. `VCSStellaPlatform` is a thin
  wrapper with none of it, and Stellerator runs its core in its own web
  Worker and draws with WebGL, so it can't run in the node worker. It could
  run in the webview (a browser) as an optional "accurate mode" later, but
  without debugging.
- Scripts: `loadScript()` in `common/util.ts` goes through a replaceable
  loader (`setScriptLoader`). `mockScripts()` in `src/tools/nodemock.ts`
  evaluates files from the asset root in the global scope, once each.
  `installNodeMocks()` installs it, and `testplatforms.js` uses it too.
- DOM: `vcs.ts` uses plain DOM calls, not jQuery, and skips the
  `ResizeObserver` when there isn't one. The jsdom page has
  `#javatari-div`/`-screen`/`-console-panel`; `mockDOM()` adds a stub 2D
  context (real `ImageData` buffers, no drawing), `Image`, and an in-memory
  `localStorage`.
- Video: `VCSPlatform.captureVideo()` turns on a copy of each TIA line's
  visible window (`monitor.getDisplayParameters()`) into a `VideoOutput`
  (160x213 NTSC, aspect 1.5). `EmuCore.start()` asks for it when the
  platform built no `RasterVideo`. The IDE never calls it.
- Frames: `nextFrame()` calls `clockPulse()`; `loadROM` leaves Javatari's
  own clock paused, so only EmuCore advances frames.
- Keys: `VCSPlatform.setKeyInput()` calls
  `Javatari.room.controls.processKeyEvent()` (arrows + space for P0).
- Debugging: frame-granular only. EmuCore ignores the stand-in `machine`
  object vcs keeps for the probe views. Javatari's own stepping replays
  from the start of the frame (`setDebugCondition`), which doesn't fit
  EmuCore's trap model yet.
- The CLI exits once it has written its result; Javatari's on-screen
  message timer otherwise kept node alive for ~2.5s.
- Bundling (not done): the extension reads `javatari/javatari.js` from the
  repo root. A packaged extension must ship it next to `emuworker.js`.
- Tests: `test/cli/testcli.js` "run --platform vcs (Javatari)"; survey gives
  `vcs ok 160x213`.

**3. Verilog.** The biggest job: it runs, but builds its UI inside the
platform.
- ~~Take the UI out of `_VerilogPlatform.start()`~~ (done: `HDLHost`, §7).
  In VS Code the waveform is a dedicated view (see "Plan: dedicated debug
  views"); in the IDE, `SplitWaveformScope` builds the split for now.
- Designs without video (`hasvideo` false) show only the waveform. Until the
  Waveform view exists they show "no video output" (VCD export, if it lands
  first, gives them something to look at).
- `binaryen` is external: the emuworker must resolve it from the toolchain
  root's `node_modules` (check it does from a packaged extension). Check
  whether `HDLModuleWASM` or `HDLModuleJS` is used and which one headless
  runs should use.
- Mouse and paddles: `getMousePos` on the canvas. Add mouse events to the
  webview protocol (`mousemove`, scaled to the frame) for the paddle
  presets.
- Test: `test_hvsync.v` and `racing_game.v` (from `presets/verilog`) build
  and produce frames in the emuworker.

**Later.** The rest of the table (basic, devel-6502, arm32, x86, pce,
williams-defender/-z80, kim1) stays on the "not supported yet" list until
there's a reason to fix it. basic and devel mostly need their teletype/serial
output shown, which would be a text panel rather than a canvas.

### Shared debug core

The CLI already implements break, step, and SP-based step-out over `EmuTarget`
in `RunScript` (`src/tools/runscript.ts`). Don't reimplement it in the DAP.
Extract before building the adapter:

- ~~**`breakcond.ts` → `src/common/`.**~~ Done.
- ~~**`breakpoints.ts`**~~ Done. `src/common/breakpoints.ts` has the
  `Breakpoint` types and `resolveBreakpoint(bp, ctx)`, where a
  `BreakpointContext` gives the symbols, `getListingForFile`, and the
  platform (CPU fields, memory, raster). `src/ide/breakpoints.ts` keeps the
  localStorage store and builds its context from `ui`.
- **`DebugController`** over `EmuTarget`: `runUntil(trap, maxFrames)`,
  `stepInsn`, `stepOver` (same source line, via `projectcore` listings),
  `stepOut` (SP-based, from `RunScript`), `runTo(addr)`. `RunScript` commands
  and the DAP handlers both become thin wrappers. The IDE can adopt it later.
- ~~**`EmuTarget`** split~~ Done. The driver is `EmuCore`
  (`src/common/emucore.ts`, no DOM, no Node); `src/tools/emutarget.ts` keeps
  `installNodeMocks()` and `loadPlatform()` and exports `EmuCore` as
  `EmuTarget`, so the CLI and the extension didn't change. The IDE can wrap
  its already-started platform in an `EmuCore` without calling `start()`.
- ~~`parseSymbolFile`~~ Done: `src/common/symbols/symbolfile.ts`, with
  `lookupSymbol()`, which the CLI and breakpoints share (`main` finds
  `_main`, `.loop` finds `loop`).

### Plan: one debug and rewind core for IDE, CLI, and VS Code

**Today there are two debuggers.**
- IDE: debugging lives inside the platform (`BaseDebugPlatform` in
  `common/baseplatform.ts`). It saves state at each frame start
  (`debugSavedState`); stepping reloads that state and re-runs to a target
  clock (`runToFrameClock`, `stepBack` replays to `clock - 25` and keeps the
  last state before the target). Rewind across frames is `StateRecorderImpl`
  (`common/recorder.ts`): a checkpoint every 10 frames plus each frame's
  controls and noise seed, replayed from the nearest checkpoint.
- CLI: `EmuTarget` drives the Machine with a `TrapCondition` and a
  single-clock stepper (`stepInsn`, `runUntil`, `runToPC`); `RunScript` adds
  break, step, and SP-based step-out. No rewind.

Both are correct in their own way; they don't share code, and the VS Code
debugger shouldn't become a third.

**Layers** (all in `src/common/`, no DOM, no Node, synchronous):

1. **`EmuCore`**: the platform-driving part of `EmuTarget` (advance a
   frame with an optional trap, step one instruction or clock, read/write
   memory, CPU state, save/load state, disassemble, capabilities). The Node
   part (`installNodeMocks`, headless video) stays in `src/tools/emutarget.ts`
   and wraps it. The IDE builds an `EmuCore` over its live platform.
2. **`Timeline`**: rewind, generalizing `StateRecorderImpl`. It records
   checkpoints (every N frames, a memory budget instead of a fixed count)
   plus an input log: controls and noise seed per frame, and key events
   stamped with their frame. A position is `(frame, step)` (see "Break
   state vs. `saveState()`" below), and `seek(frame, step)` loads the nearest earlier checkpoint and replays
   inputs up to the position, muting audio. Seeking past the end is just
   running. Recording while scrubbed truncates the future (new branch).
3. **`DebugController`**: the operations every host needs, built on the two
   above.
   - `run(budget)`: run until a breakpoint, a stop request, or the frame
     budget runs out; returns a `StopEvent` (`breakpoint`, `step`, `pause`,
     `halt`, `exception`) or `null` if the budget ran out.
   - `stepInstruction`, `stepOver` (source line from listings, or a call
     instruction), `stepOut` (SP-based, from `RunScript`), `runTo(addr)`,
     `runToVsync`.
   - Reverse: `stepBack` (seek to the previous instruction boundary: seek
     to the frame's checkpoint and replay, like `BaseDebugPlatform` does
     now), `reverseContinue` (replay forward from checkpoints and keep the
     last breakpoint hit before now), `seekFrame(n)` for scrubbing.
   - Breakpoints: source line, address, symbol, and conditions, resolved
     through the shared `breakpoints.ts` / `breakcond.ts` (see "Shared debug
     core" above), compiled to one `TrapCondition`.
   - Everything is synchronous and bounded. Each host supplies its own
     loop: `run(budget)` from its timer, and a stop request between calls.

**Hosts.**
- **IDE**: `ui.ts` drives `DebugController` from its animation timer. Its
  toolbar buttons (step, step over, step out, step back, run to line,
  timeline slider) call the controller instead of platform methods. Move
  one operation at a time and keep `BaseDebugPlatform` working until the
  last one moves; then its debug fields go.
- **CLI**: `RunScript` commands become thin wrappers (`run`, `break`,
  `step`, `pc`, ...), and it gains `back [n]` and `seek <frame>`. Scripted
  tests of rewind run here, headless, fast.
- **VS Code**: `DebugController` runs in the emuworker, next to the
  emulator, and is exposed over the existing RPC. The Debug Adapter (next
  section) runs in the extension host and translates DAP to RPC. DAP has
  reverse debugging built in: report `supportsStepBack`, and handle
  `stepBack` and `reverseContinue`. Scrubbing (`seekFrame`) is a timeline
  slider in the emulator panel. Non-debug runs ("Run" without "Debug")
  still record the timeline, so rewind works without starting a debug
  session.

**Things to get right.**
- **Determinism.** Replay must reproduce the run exactly: every input goes
  through the input log (webview keys are applied at frame boundaries, as
  the recorder does now), the noise seed is logged, and nothing reads wall
  time. A test: record N frames, seek to 0, replay, compare state hashes
  every frame. Run it for every supported platform, in the CLI.
- **Cost.** `saveState()` size varies a lot between platforms. Budget
  checkpoints by bytes, and keep the frame-start state for stepping
  separately from rewind checkpoints.
- **Platforms without a Machine** (`vcs`, `verilog`, `x86`) have their own
  step and state code (VCS's step/step back come from Javatari). `EmuCore`
  reports what each supports (`supportsTrap`, `supportsStep`,
  `supportsStepBack`), and hosts disable what's missing instead of faking
  it. Frame-granular breaking says so.
- **Pause is not a stop.** A user pause stops between frames; the
  controller still reports a `StopEvent` with a PC and source location so
  every host shows where it is.

**Break state vs. `saveState()`.** A trap stops the CPU loop, not the
frame. When `trap()` returns true, `advanceFrame` breaks out of its CPU loop,
but code after the loop still runs:
- `BasicScanlineMachine.advanceFrame` (`common/devices.ts`) sets `sl = 999`,
  then still calls `drawScanline()` and the probe hooks for that line.
- Subclasses do more after `super.advanceFrame(trap)` returns: `mcr` and
  `pacman` decrement the watchdog and raise the vblank interrupt, `apple2`
  redraws the screen, and `atari7800` breaks out mid-line and still runs that
  line's DMA.
- Then `BaseMachinePlatform.advance()` updates the video in a `finally`.
- Platforms without a Machine (`vcs` via Javatari's `onBreakpointHit`,
  `verilog`, `x86`) have their own rules.

So after a break, the live machine is not in the state it was in at the
break. Also, the frame loop's position (`sl`, `frameCycles`, `endLineClock`)
is local to `advanceFrame` and not in `saveState()`, so even the exact
break-time state can't resume mid-frame: the next `advanceFrame()` starts
again at scanline 0 while the CPU is partway through the frame.

The IDE already handles this. `breakpointHit()` saves `debugBreakState`
inside the trap, at the exact break point. `postFrame()` loads it back after
the frame loop finishes. Resuming (`restartDebugging`) reloads the frame-start
state (`debugSavedState`) and re-runs to `debugTargetClock` with the
breakpoint check suppressed until then. The CLI doesn't: `EmuTarget` keeps
the live machine after the trap (post-trap work included), and the next
`advanceFrame()` starts a new frame from that state, so the frame after a
break is short and the timing drifts.

The shared core adopts the IDE's model:
- **A position is `(frame, step)`.** `frame` names a frame-start state,
  and `step` counts trap calls since then (one per `advanceCPU()` or per
  clock, whatever the machine calls `trap()` on).
- **Only frame-start states are resumable.** Timeline checkpoints and the
  "current frame" state are always taken at frame start, before
  `advanceFrame`. Mid-frame states are only for looking at.
- **Stopping captures a snapshot inside the trap**: `saveState()`, CPU state,
  and raster position, taken in the callback before the trap returns true.
  Registers, memory, the disassembly, and the debug views all read the
  snapshot, not the live machine. After `advanceFrame` returns, the core
  loads the snapshot back (as `postFrame` does) so memory reads and writes
  go to the right state.
- **Resuming or stepping always replays**: load the frame-start state and
  run to `step + n` with breakpoints suppressed until `step`. Step back
  replays to `step - 1` (a step count, not the IDE's `clock - 25`
  guess). Crossing a frame boundary backward needs each frame's total step
  count, which the timeline records.
- **The screen at a break** is whatever the frame buffer holds after the
  truncated frame (partially drawn), plus a crosshair at the snapshot's
  raster position, as the IDE draws now.
- **Writes while stopped** (memory pokes from a debug view or DAP
  `writeMemory`) change the snapshot, and so the replay no longer
  reproduces it. Record a write as an input event at `(frame, step)` and
  apply it during replay, or restrict writes to frame boundaries. Decide
  when implementing `writeMemory`.

Tests for this, per platform, in the CLI:
1. Frame-boundary round trip: `saveState → run N frames → loadState →
   run N frames` gives the same state hash every frame.
   `test/cli/testplatforms.js` already notes `vcs` fails the weaker
   `saveState` round trip.
2. Break-and-replay: run to a breakpoint mid-frame and keep the snapshot;
   reload the frame start and replay to the same step; the states must
   match.
3. Continue after a break: the frame after the break has the same length
   and end-of-frame state as a run without the break.

Platforms that fail these keep frame-granular debugging and report it
(`supportsStepBack: false`) instead of doing it wrong.

**Order.**
1. Extract `breakcond.ts` / `breakpoints.ts` and split `EmuCore` out of
   `EmuTarget` (the "Shared debug core" steps above).
2. `DebugController` forward operations with the snapshot/replay model
   above; move `RunScript` onto it (CLI tests keep passing) and fix the CLI's
   post-break drift. Add the break-state tests.
3. The VS Code debug adapter over RPC (forward only).
4. `Timeline` plus the determinism test; CLI `back` / `seek`.
5. Reverse operations in the controller; DAP `stepBack` /
   `reverseContinue`; the emulator panel's timeline slider.
6. Move the IDE onto the controller and `Timeline`, one toolbar operation at
   a time; retire `BaseDebugPlatform`'s debug state and `StateRecorderImpl`.

### Debug Adapter

Implement a VS Code `DebugSession` (inline adapter is fine; no separate
process needed) over `DebugController`/`EmuTarget`:

| DAP request | Implementation |
| --- | --- |
| `initialize` / `launch` | load platform, load ROM from the build, `start()` |
| `setBreakpoints` | source line → PC via `projectcore.getListingForFile` + `SourceFile.line2offset`; address/symbol via `parseTarget` (`breakcond.ts`) |
| `configurationDone` | attach resolved breakpoints, resume |
| `stopped` | `EmuTarget.advanceFrame(trap)` with a `TrapCondition` from the resolved breakpoints |
| `next` (step over) | `DebugController.stepOver()` |
| `stepIn` | `DebugController.stepInsn()` |
| `stepOut` | `DebugController.stepOut()` (SP-based, from `RunScript`) |
| `continue` | resume the frame loop, checking traps |
| `pause` | stop the frame loop |
| `threads` | one thread per CPU |
| `stackTrace` | synthesize a frame from PC + listing location |
| `scopes` / `variables` | registers from `getCPUState()`, symbols from `symbolmap` |
| `readMemory` / `writeMemory` | `EmuTarget.read(addr)` / machine write |
| `evaluate` | `breakcond.ts` expression language (PC, A, X, [#mem], symbols) |
| `disassemble` | `EmuTarget.disassemble(addr)` |

Capability detection is already centralized on `EmuTarget`:
`supportsTrap`, `supportsStep`. Frame-granular platforms (no `Machine`) should
report that breaking is frame-accurate rather than silently pretending.

Launch config (`launch.json`):

```json
{
  "type": "8bitworkshop",
  "request": "launch",
  "name": "Run on C64",
  "platform": "c64",
  "mainFile": "src/main.c",
  "build": true
}
```

### Non-debug run mode

The common case is "build and play": the **Run** command starts the emulator
and streams frames to the webview with no DAP session. Switch to a debug
session when the user sets a breakpoint or issues **Start Debugging**.

### Debug views

Reuse the build's `listings`, `symbolmap`, `segments`, and `getDebugInfo()`
sections. VS Code-native equivalents of the IDE sidebar windows:

- Memory / Disassembly → tree views or the Debug Console.
- Memory map / segments → a custom read-only editor or webview (later).
- Registers/CPU state → the **Variables** view via DAP.
- Probe/heatmap/callstack views → optional custom webviews; not required for
  v1.

### Plan: dedicated debug views (waveform first)

Debug views get their own VS Code views instead of sharing the emulator
panel. The first is the verilog waveform, which replaces verilog's Split pane
(the scope under the CRT). The same structure then carries the IDE's other
debug views.

**Where they live.** A `8bitworkshop` view container in the bottom panel
(`contributes.viewsContainers.panel`) holding one `WebviewView` per view:
Waveform first, then Memory, Probe log, Scanline I/O, Heatmaps, Call stack,
Memory map. Each view's `when` clause uses a context key set from the
running target's capabilities (`8bitworkshop.hasWaveform`,
`8bitworkshop.hasProbe`, ...), so only the views that apply show up. Users
can drag a view into the sidebar or an editor group; a view that needs more
room (e.g. the memory map) can also open as a `WebviewPanel` in an editor
group.

**Data flow.** The emuworker owns the data; views subscribe to it.
- A view sends `subscribe(viewId)` / `unsubscribe` when it becomes visible or
  hidden. The worker only produces data for subscribed views, so a hidden
  view costs nothing (as the emulator panel does now).
- After each frame (or on pause, for the heavier views) the worker posts a
  snapshot per subscribed view. The extension host only relays messages
  between worker and view, like frames today. Views ack for backpressure.
- The IDE views call their data sources synchronously (e.g. `WaveformProvider.
  getSignalData(index, start, len)`), which can't cross a message boundary.
  So each view keeps a local mirror of what it reads -- the trace buffer
  for the waveform, the probe buffer for probe views, memory pages for the
  memory view -- and the synchronous interface reads the mirror. Writes
  (`setSignalValue`, poking memory, clicking a PC to set a breakpoint) go
  back as messages.

**Reusing the IDE views.** The views in `src/ide/views/` (`debugviews.ts`,
`traceviews.ts`) and `src/ide/waveform.ts` are DOM code and can run in a
webview, but they reach into `ui.ts` globals (`platform`, `lastDebugState`,
`current_project`, `projectWindows`, `openLocationForPC`, `runToPC`,
`setupBreakpoint`).
- Give each view a `ViewHost` interface with what it uses: a data source
  (the platform in the IDE, the mirror in VS Code), symbols and listings,
  and actions (go to source location, run to PC, set breakpoint). The IDE
  implements it over `ui.ts`; the extension implements it over messages
  (go to source becomes `vscode.window.showTextDocument` at the listing's
  line).
- Move one view at a time, starting with `WaveformView`, which only needs
  `WaveformProvider` plus the toolbar/shortcut modules and one
  `bootbox.prompt`. The IDE must keep working after each move.
- Build: `extension/scripts/build.mjs` adds a browser bundle
  (`out/views.js`, `platform: 'browser'`) loaded by every debug webview via
  `webview.asWebviewUri`, with the nonce CSP the emulator panel uses. CSS
  comes from the IDE's stylesheets for these views, themed with VS Code's
  CSS variables where it's cheap.

**Waveform view (first).**
- Platform side: the waveform-injection TODO above (move `WaveformMeta` /
  `WaveformProvider` to `src/common/`; the platform stops creating the view).
- Worker: `getSignalMetadata()` once per ROM; then new trace data (the
  `trace_buffer` range since the last post) each frame while subscribed,
  plus the current time. `setSignalValue` comes back as a message.
- View: `WaveformView` in the webview, over a provider that reads the
  mirrored trace buffer. Its `bootbox.prompt` becomes a message the host
  answers with `showInputBox`. The existing IDE help page
  (`verilog-waveform.md`) can open from the view's title bar.
- Verilog designs with no video show only the waveform view; the emulator
  panel shows "no video output".
- VCD export is a title-bar action on the view.

**IDE.** Once the platform no longer creates the view, the IDE needs to
host it itself. Short term: `ui.ts` creates it in the same `#emuoverlay`
split the platform used to build. Later, a waveform window alongside the
other debug windows (`ProjectWindows`), matching the VS Code layout.

### Plan: asset editor

**How the IDE does it today.** `src/ide/views/asseteditor.ts` scans every
project file for asset headers (`/*{w:8,h:8,bpp:1,...}*/` or
`;;{...};;` before a hex array, and `#embed "file.bin"`), plus NES `.chr`
and `.pal` files. For each one it builds a chain of `PixNode`s
(`src/ide/pixeleditor.ts`):

```
TextDataNode | FileDataNode -> [Compressor] -> [Mapper] -> Palettizer -> CharmapEditor / MapEditor / PaletteEditor
```

`updateRight()` decodes source text into pixels; `updateLeft()` encodes
pixels back and writes the source. The pure parts (header scan, hex
parse and replace, image and palette formats) are already DOM-free and
have unit tests (`test/unit/testassetscan.ts`, `testpixelpalette.ts`,
`testpixelclipboard.ts`). The editors are jQuery and canvas, which run
fine in a webview. The coupling to the IDE is small:

- `asseteditor.ts` imports `current_project`, `platform_id` and
  `projectWindows` from `ui.ts`, and uses Mousetrap for undo keys.
- The data nodes call five `ProjectWindows` methods: `updateFile`,
  `setAssetRange`, `getAssetText`, `replaceAssetText`, `clearAssetRanges`
  (plus `project.getFile`). The IDE keeps its own undo stack on top.
- `pixeleditor.ts` imports `ProjectWindows` only as a type.

**Step 1: an `AssetHost` seam (IDE-only refactor).** Replace the
`ProjectWindows` parameter with an interface:

```ts
interface AssetHost {
  platformId: string;
  getFile(path: string): FileData | undefined;
  updateFile(path: string, data: Uint8Array): void;        // binary assets
  setAssetRange(path: string, id: string, from: number, to: number): void;
  getAssetText(path: string, id: string): string | null;
  replaceAssetText(path: string, id: string, text: string): void;
  clearAssetRanges(path: string): void;
  revealSource(path: string, startLine: number, endLine: number): void;
  undo?(): void; redo?(): void;                            // IDE only
}
```

`AssetEditorView` takes an `AssetHost` in its constructor instead of
importing `ui.ts`. `ProjectWindows` implements it for the IDE, so the IDE
behaves the same; run the web tests to confirm. Move the DOM-free code out
of `pixeleditor.ts` into `src/common/assets/` so the extension host can
scan headers without loading the editors.

**Step 2: source assets as a custom text editor.** Register a
`CustomTextEditorProvider` (`8bitworkshop.assetEditor`) for the source
extensions, with `priority: "option"` so it never becomes the default
editor for `.c`/`.s`. The document stays a normal `TextDocument`, so:

- VS Code owns undo/redo, dirty state, save and hot exit. Drop the IDE
  undo stack in this host (`undo`/`redo` left out of `AssetHost`).
- The text editor and the asset editor can be open side by side and stay
  in sync.

Ways in (only under project roots, per the language-features plan):

- A CodeLens "Edit asset" on each header line, the counterpart of the
  IDE's "↗ Asset Editor" badge (`assetdecorations.ts`). It opens the asset
  editor beside the source (`ViewColumn.Beside`) and scrolls to that
  asset.
- "Open With… → 8bitworkshop Asset Editor", and an "8bitworkshop: Edit
  Assets" command for the active file.

Data flow between the webview and the extension host:

| Direction | Message | Effect |
|---|---|---|
| host → webview | `init {platform, path, text, version, related}` | build the node chains (`refresh(true)`) |
| host → webview | `text {text, version}` | after a typed edit, undo, or revert: rebuild, keeping the selected asset by header index |
| webview → host | `edit {path, from, to, text, version}` | `WorkspaceEdit.replace`, refused if the version is stale (the host then resends `text`) |
| webview → host | `reveal {path, startLine, endLine}` | `showTextDocument` with that selection |

The webview side of `AssetHost` keeps ranges as offsets in its own copy
of the text, updates them on its own edits, and resets them on every
`text` message. Pixel edits can come fast, so batch them into one edit per
animation frame; each batch is one VS Code undo step.

**Step 3: assets in other files.** Palettes and tilemaps often live in
another file (`getPalettes()` and `getTilemaps()` search all root nodes).
The host scans the project's source files with `src/common/assets/` (open
documents first, then disk) and sends the matches as `related`. Editing a
palette from another file sends an `edit` with that file's path, and the
host applies it to that document (opened in the background, not shown).
Watch those files and resend `related` when they change.

**Step 4: binary assets.** NES `.chr` and `.pal` files, and `#embed`
targets, get a `CustomEditorProvider` with its own `CustomDocument`
(the bytes). Report each change through `onDidChangeCustomDocument` with
undo and redo callbacks, and implement save, revert and backup. The build's
file reader must read a dirty custom document's bytes, the same way it
already prefers unsaved text buffers. Needs a platform: `.chr` means NES
CHR only on nes projects.

**Step 5: webview bundle and styling.** Build `pixeleditor` and
`asseteditor` into the browser bundle planned for the debug views
(`out/views.js`), with jQuery. Load the asset editor CSS from `css/` and
map its colors to VS Code theme variables (`--vscode-editor-background`,
...). Set a CSP that allows only the bundle and inline canvas data. Leave
undo keys to VS Code; drop the Mousetrap binding in this host.

**Live preview.** With auto-build (§5), each committed edit rebuilds and
reloads the running emulator, so a sprite change shows up in the game.
Pixel edits should rebuild on the debounce, not per pixel.

**Tests.**

- Unit: `src/common/assets/` scan and encode, which the existing tests
  cover once they import from the new path.
- Extension: open a preset with a bitmap header in the asset editor, send
  a fake `edit` message, and check that the document text changed and
  that one undo restores it. Send a stale version and check that the
  edit is refused and `text` is resent.
- IDE: the web tests for the asset editor still pass after step 1.

### Plan: documentation for people and for LLMs

One set of Markdown sources, written so both can use it. `src/docs/`
already has 21 topics, bundled into the IDE's help view. Many of them
(asset headers, build directives, toolchains, symbols, waveform) apply
to the extension too.

**Sources.**

- *Shared topics* stay in `src/docs/`. Where the IDE and VS Code differ
  (keys, buttons, menus), mark the passage with
  `<!-- host:ide -->`...`<!-- /host -->` or `<!-- host:vscode -->`; each build
  keeps its own passages and drops the others. Most topics need none.
- *Extension-only topics* go in `extension/docs/` (getting started,
  project settings, detection, debugging, the language features).
  Written so far: `QUICKSTART.md`, `projects.md`, `detection.md`,
  `building.md`, `emulator.md`. This plan lives in `extension/notes/`
  so it never ships with the user docs. Write the user doc for a feature
  before building it; if it's hard to explain, fix the plan.
- *Generated reference*, never edited by hand: platforms (id, CPU, tools,
  what runs in the extension), tools and file extensions (from
  `toolmeta.ts`), settings and commands (from `package.json`), and run
  script commands (from the CLI). A test fails when a generated file is
  out of date, so docs can't drift from the code.
- *Style*: the CLAUDE.md rules (short, active voice). Each topic starts
  with a one-sentence summary, stands on its own, and has stable headings
  and file names that links can point to. Show commands and code in text,
  not only in screenshots.

**For people.**

- `extension/README.md` is the Marketplace page: what it does, a GIF of
  Open Example → Run, the platform table, settings, books. Plus a
  `CHANGELOG.md`.
- The walkthrough (`contributes.walkthroughs`) has one short Markdown
  file per step in `extension/media/walkthrough/`.
- `markdownDescription` on every setting, with a link to its topic.
- "8bitworkshop: Help" opens the topic list; a topic opens in VS Code's
  Markdown preview (`markdown.showPreview`) from the packaged copy, so it
  works offline. Hovers, diagnostics and the Project Settings page link to
  the relevant topic (for example, an asset header hover links to
  `asset-headers.md`).
- The same topics go to the website, so a search lands on the same text.

**For LLMs.** There are two cases.

1. *An agent working in the user's project* (Copilot agent mode, Claude
   Code, Cursor, ...). Useful text helps less than useful tools:
   - The CLI is already the headless interface. `8bws build` and
     `8bws run -e "..." --json` give an agent build errors, frames,
     screenshots, memory and breakpoints without a GUI. The docs should
     say so first.
   - `8bws docs [topic]` prints topics as Markdown (with the CLI's
     passages), so an agent in a terminal reads the docs that match the
     installed version, without the web.
   - Language model tools: the extension registers Build, Run frames and
     screenshot, Read memory, and Break at symbol
     (`contributes.languageModelTools` and `vscode.lm.registerTool`),
     wrapping the shared debug core. Later, `8bws mcp` offers the same
     tools to agents outside VS Code, and the extension can register it
     as an MCP server definition. Check which VS Code version these
     APIs need before raising `engines.vscode`.
   - An "8bitworkshop: Add AI Instructions" command writes an
     `AGENTS.md` (and a `CLAUDE.md` pointing to it) for the project: the
     platform and tool, how to build and run with `8bws`, the platform's
     memory map summary, and the gotchas (16-bit `int` in cc65, SDCC
     wants a trailing newline, asset header format). Only on that
     command, or when New Project asks and the user agrees;
     never on its own.
   - Per-platform cheat sheets (memory map, registers, video and input,
     the headers to include) are generated from platform metadata plus
     short hand-written notes. The same page serves as a help topic for
     people and goes into `AGENTS.md`.
2. *A model answering about 8bitworkshop in general.* Publish
   `llms.txt` on the website: a short index of topics with one line each,
   linking to the Markdown sources, plus `llms-full.txt` with all of
   them concatenated. Both are built from the same sources.

**Tests.**

- Links between topics resolve, including in the host-filtered builds.
- Generated reference files are up to date.
- Doc tests: shell code blocks that start with `8bws` run in
  `test-cli` (with a frame limit), so the examples keep working.

### Refactoring index

Every change to *existing* code that the plans above call for, in one
list. New modules (language service, debug adapter, syntax generator) are
not listed. Numbers are stable IDs, not the order of work.

**Done:** shared build core (`toolselect.ts`, `projectcore.ts`, §6);
`haltEmulation` via `setHaltHandler`; help topic registry moved to
`helptopics.ts`; `EmuTarget` key input through the platform's video key
handler; item 1 (verilog UI behind `HDLHost`); items 7–10 (shared
breakpoints, `EmuCore`, symbol files).

**A. Keep UI out of platform modules** (§7, §8 "platforms that don't run")

1. ~~verilog: move `WaveformMeta`/`WaveformProvider` to `src/common/`, host
   installs a view factory; take the Split pane and scope out of
   `_VerilogPlatform.start()`.~~ Done: see §7.
2. basic, devel-*: constructors build jQuery UI on the main element; the
   host supplies it instead.
3. ~~A host `loadScript` hook for vcs (Javatari), x86 and arm32.~~ Done:
   `setScriptLoader` / `mockScripts`. x86 still builds UI on the main element.
4. ~~vcs: read pixels from Javatari's monitor, not its canvas.~~ Done:
   `VCSPlatform.captureVideo()`.
5. pce's own canvas context; williams-defender/-z80 sound `Worker`;
   forward vector line ops; a kim1 LED view.
6. One table that maps `listPlatforms` build ids (`cpc`, `atari8-800xl`,
   ...) to emulator ids.

**B. Debug and rewind core** (§8, in dependency order)

7. ~~`breakcond.ts` → `src/common/`, as is.~~ Done.
8. ~~`breakpoints.ts` takes a context (symbols, listings, CPU reader)
   instead of `current_project`/`platform` from `ui`.~~ Done.
9. ~~Split `EmuTarget`: `EmuCore` to `src/common/`, Node mocks stay in
   `src/tools/`.~~ Done.
10. ~~`parseSymbolFile` out of `runscript.ts`, with the symbol helpers.~~
    Done. See "Shared debug core" in §8 for all four.
11. `DebugController` out of `RunScript`; CLI commands become wrappers.
12. `Timeline` generalizes `StateRecorderImpl`, plus the (frame, step)
    break snapshot.
13. The IDE moves onto the controller and `Timeline`
    (`BaseDebugPlatform`'s `debugBreakState`, `restartDebugging`,
    `postFrame` reload). Largest and riskiest; one toolbar operation at a
    time.

**C. Views** (§8 debug views, asset editor)

14. `ViewHost` interface; views stop using `ui.ts` globals, starting with
    `WaveformView`; browser bundle `out/views.js`.
15. Asset editor: `AssetHost` replaces the `ProjectWindows` calls;
    `asseteditor.ts` drops its `ui.ts` imports and Mousetrap; DOM-free code
    from `pixeleditor.ts` moves to `src/common/assets/`.

**D. Shared tables**

16. `ROM_PLATFORMS` from `8bws.ts` to `src/common/detect.ts` (§5).
17. Book mapping from `updateBooksMenu` and `index.html` to
    `src/common/books.ts` (§5).
18. `toolmeta.ts`: prefixed language IDs, a per-tool flag for how well
    desktop C tools handle the compiler, and the C keyword/defines table
    (§4).
19. The presets index reuses `buildpresets.ts` (§5).
20. Docs: `<!-- host:... -->` markers in `src/docs/`, filtered by the help
    view; generated reference pages (documentation plan).

**Suggested order.** 1–2 and 7–10 first: small, mechanical, and they
unblock verilog in the extension and the debug adapter. Then 14–15, for
the waveform view and asset editor. 13 last. 3–6 are platform fixes;
do them when a platform is the priority (VCS needs 3–4).

## 9. Milestones

0. **Shared build core** (done). Parity test, `toolselect.ts`, `projectcore.ts`,
   and the `CodeProject`/`testlib` switch-over (§6). Lands in this repo with
   no extension code; fixes the IDE/CLI drift on its own.
1. **Bootstrap + build.** Extension skeleton; `FileProvider` over
   `vscode.workspace.fs`; in-process build; diagnostics in the Problems panel.
   *Outcome: edit a `.c`/`.asm` file and see errors.*

   **Status: done.** `extension/src/buildcore.ts` (no `vscode` imports)
   runs builds in-process: `resolveDependencies` → `buildWorkerMessage` →
   tool preloads → `handleMessage`, and maps error paths back through
   `filename2path`. `extension/src/extension.ts` adds the Build and Select
   Platform commands, build-on-save (for source files and the last build's
   dependencies), a platform status-bar item, and Problems diagnostics.
   Unsaved editor contents take precedence over disk; missing files fall
   back to `presets/<base>`. Paths are relative to the main file's
   directory. `setupNodeEnvironment(rootDir)` now takes the asset root, so
   builds no longer depend on cwd. Build with `npm run build` in
   `extension/`; `npm test` runs the tests in `extension/test/` under mocha.
   Launch a development host from the repo root with:

   ```bash
   (cd extension && npm run build)
   code --extensionDevelopmentPath="$PWD/extension" "$PWD/presets/nes"
   ```
2. **Run.** Load the built ROM into `EmuTarget`; webview canvas frame pump;
   keyboard input; Run/Reset/Pause commands.
   *Outcome: build and play a game in VS Code.*

   **Status: done (pending a manual run in VS Code).** Builds and emulation
   run in `worker_threads` (`buildworker.ts`, `emuworker.ts`), not in the
   extension host: `setupNodeEnvironment` and `installNodeMocks` replace
   `fetch`, `window`, `document` and `XMLHttpRequest`, and every extension
   shares the host's globals. `rpc.ts` carries calls and events both ways;
   the build worker calls back to the host's `readFile` so builds still go
   through `vscode.workspace.fs`. `emuworker` paces frames to the platform's
   `AnimationTimer` rate and posts a copy of each frame; `EmulatorPanel`
   drops frames while the webview is still drawing one. Commands: Run
   (build, then start), Reset, Pause/Resume, Stop, with title-bar buttons on
   the panel. A save that rebuilds reloads the running emulator. Hiding the
   panel pauses it. Core changes: `emu.setVideoClasses()` replaces the
   export reassignment `EmuTarget` relied on (bundled ES imports are
   read-only); `loadPlatform` uses `importPlatform`; `installNodeMocks(rootDir)`
   serves BIOS/wasm fetches from the asset root; `getVideo()` returns the
   first `RasterVideo` (NES built a nametable view second, and the CLI
   reported 512x480); `VideoOutput` carries `rotate`/`aspect` and
   `EmuTarget.frameRate`. `binaryen` is external to the bundle for now (§7).
   Not yet: audio, gamepad/joystick mapping beyond the platform's keys, and
   vector platforms (no raster output).
2b. **Projects, templates, auto-build** ("Plan: starting a project",
   "Switching the run target", "Plan: auto-build as you type", the
   detection plan, and the emulator's first-time-player notes).

   **Status: done (pending a manual run in VS Code).**
   - `src/common/detect.ts`: `detectProject`, `isClearWinner`,
     `findMainCandidates`, `toolForDialect`, `parseReadmeBadge`,
     `ROM_PLATFORMS` (moved from `8bws.ts`). `test/unit/testdetect.ts`
     checks the preset corpus (72% of single preset files; a tie for
     first counts). `8bws detect <file|dir>` prints candidates and
     evidence, and `8bws build`/`run` without `--platform` use a clear
     winner or fail listing the candidates.
   - `extension/src/projectinfo.ts`: `projectFor`, `listProjects`,
     `resolveRunTarget` (pure, tested). `projectscope.ts` reads settings,
     `folders`, README badges and window-only choices, saves projects, and
     keeps run targets in `workspaceState`.
   - `autobuild.ts`: `BuildScheduler` (debounce, one pending build, slow
     builds stretch the wait), tested with a fake clock. Settings
     `autoBuild` (default `onType`) and `reloadOnBuild`; server tools build
     on save; failed type-builds hold their errors until typing pauses.
   - `scripts/presetindex.ts` writes `out/presets.json` (`npm run build`
     runs it): the IDE menu's platforms, names and families (parsed from
     `index.html`), each platform's blank programs ("Start here", named
     from `getDefaultExtensions()`), its examples with own and shared
     files, and the detection header table. `templates.ts` has the
     `8bws-preset:` read-only file system (with the Copy to Workspace
     message), the pickers (with preview), destinations, and copying.
   - Commands: New Project, Open Example, Copy to Workspace, Set as Main
     File, Change Main File, Change Platform, Run This File, Run Main
     File, Follow Active Editor, Detect Projects, Add Launch
     Configuration, and the status bar menu. F5 on an `8bitworkshop`
     launch configuration runs it through a `DebugConfigurationProvider`
     that returns `undefined` (no debug session until milestone 4).
   - Each Run starts a new emulator worker: platforms keep global state
     (Javatari deletes its own `start()`), so `emuworker` refuses a
     second `start`. A rebuild with an identical ROM doesn't reload.
   - A hidden panel stops the worker's frames (`setVisible`) without
     changing its paused/running state, so showing it resumes only what
     was running. `Builder` keeps each main file's last output, so Run
     works when the build is unchanged (e.g. running twice).
   - Control hints moved out of `index.html` into `src/common/controls.ts`;
     the IDE renders them from there, and the emulator panel shows them in
     a bar you can hide, styled like the IDE's and shown while it has focus.
     Platforms with no entry get hints generated from their key map
     (`describeControls` in `emu.ts`).
   - Changed from the plan: "Review" is a checklist quick pick, not a
     Projects view. Not done yet: the Examples tree view, the walkthrough,
     the "Insert skeleton" code lens, the URI handler, and moving
     `skeletonBuildName` to `toolmeta.ts`. `basic` and `zmachine` are
     missing from the index (their constructors need the DOM).
3. **Syntax highlighting.** Generated TextMate grammars + language IDs from
   `editorStyle`; basic symbol semantic tokens.
   *Outcome: real highlighting and Go to Definition.*

   **Status: assembler grammars done.** One grammar per CPU (`8bws-6502`,
   `8bws-z80`, `8bws-6809`) covers every assembler for it: dasm (column-0
   labels, plain directives, `{1}`), ca65 (dot directives, `@local`, `:+`,
   `.lobyte`), sdas (`.area`, `10$:`), zmac (`name MACRO`, `0FFh`, `101b`),
   and Motorola-style 6809 (`*` comments). Any other word in statement
   position is a macro call. `extension/src/syntaxgen.ts` builds them from
   `src/parser/asmkeywords.ts`, the tables the IDE's Lezer tokenizers now
   share; `scripts/syntaxes.ts` writes `out/syntaxes/`. `test/syntaxes.test.ts`
   tokenizes with `vscode-textmate` and checks `package.json` against
   `makeContributions()`. Only extensions no one else uses are claimed
   (`.dasm .ca65 .xa .nesasm .z .zmac .sgb .xasm .lwasm`); `.s .asm .inc .a`
   wait for per-project language assignment (Rule 2).
   - Decided: no C grammar of our own. C goes to clangd/cpptools with our
     headers, defines and shims (`cheaders.ts`, §4 "C: feed clangd and
     cpptools"); `8bws-c` is opt-in and `include`s `source.c`.
   - `scripts/grammarsurvey.ts` lists words the grammars read as macro
     calls, to find missing mnemonics. It shows that the verilog
     platform's `.asm` files (jsasm, custom CPUs) get `editorStyle: 'z80'`;
     they need a style of their own before `.asm` gets a language.
   - Deferred: BASIC, inform6, dialog; acme, ecs, wiz, vasm, gas.
   - Not done: Rule 2 language assignment, the cpptools provider and
     compile_commands command, `8bws-c`, Tier A providers,
     semantic tokens.
4. **Debugging.** Shared debug core first (`breakcond` move, `breakpoints`
   context, `DebugController`, `RunScript` on top of it). Then DAP session: source breakpoints, stepping, registers,
   memory, disassembly, conditional breakpoints via `breakcond.ts`.
5. **Packaging.** Asset-root override, lazy platform loading, binaryen
   dynamic import, base + per-family packs, VSIX/CI.

### Plan: fuzzing

Fuzz the parts that don't need VS Code: grammars, the build and emulator
workers, and the pure helpers. The repo already has `jsfuzz` harnesses
(`fuzzbasic`, `fuzzhdl` in the root `package.json`).

Each target is a mocha test in `extension/test/` with a fixed seed and a
small iteration count, so CI runs it. `FUZZ_ITERS=n` runs longer locally and
writes failing inputs to `out/fuzz/` for replay. If random mutation stops
finding bugs, drive targets 2 and 3 with `jsfuzz`'s coverage guidance.

In order:
1. **Grammars.** VS Code tokenizes every line as you type, so a regex that
   backtracks badly freezes the editor. Feed mutated lines from preset asm
   files, and random punctuation-heavy strings, through
   `scripts/tmtokenize.ts`. Check: each line tokenizes in a few ms, and the
   tokens cover the line with no gaps or overlaps.
2. **Build worker.** Mutate preset sources (delete lines, swap tokens,
   truncate, insert junk bytes) and build them with `Builder`
   (`buildcore.ts`). Check: every build ends with output or errors within a
   timeout; the worker survives for the next build; every error names a real
   file and a line inside it. Covers the compilers' wasm, error parsing,
   listing and symbol parsing, and diagnostics.
3. **Emulator worker.** Load random or mutated ROMs on each platform, then
   send random keys, pause/step/reset and visibility changes. Check: frames
   keep coming, status stays valid, and the worker never dies silently.
   Reaches the CPU emulators' illegal-opcode and out-of-range memory paths.
4. **Property tests** (e.g. `fast-check`) for pure functions: detection
   over random file trees (`src/common/detect.ts`, `projectinfo.ts`), path
   edge cases in `isInside` (`..`, trailing slashes, letter case), and
   `patchHeaderForClang` (applying it twice gives the same result, and
   headers with nothing to patch come through unchanged).
5. **Random command sequences** (later, nightly). Under
   `@vscode/test-electron`, open presets, build, run, close the panel and
   change settings in random order. Catches lifecycle bugs (a disposed
   panel, the build scheduler running after deactivate), but it's slow and
   flaky.

Skip the webview messages: there are three types (`key`, `frameDone`,
`controlsVisible`), and a field check covers them.

## 10. Risks and open questions

- **cwd / asset root.** Worker shims assume repo-root cwd; must be made
  configurable before anything ships.
- **`binaryen` chunk.** Verify the verilog chunk shrinks after the dynamic
  import, and that the ESM/splitting build works under the extension host.
- **Frame transfer cost.** Large buffers at 60Hz; test `ArrayBuffer` transfer
  vs. shared memory in the webview.
- **Main file / project model.** Decided: settings (top-level or
  `8bitworkshop.folders`) or a README badge, resolved
  by `projectFor` ("Plan: language features and file identification").
  No `8bitworkshop.json` manifest. Revisit if `folders` gets unwieldy in
  repos with many projects.
- **Platform × extension × tool mapping** must stay in one place
  (`toolselect.ts` + `toolmeta.ts`); the extension should not duplicate it.
- **Licensing.** GPL-3.0 for the repo; check Marketplace compatibility and
  third-party toolchain licenses before distribution.
- **Debug UX parity.** Some IDE features (replay/rewind, probe heatmaps, CRT
  probe) depend on the recorder and would need dedicated work; explicitly out
  of scope for v1.

## 11. Reference index

| Topic | File |
| --- | --- |
| Headless emulator driver | `src/tools/emutarget.ts` |
| Headless build API (CLI) | `src/tools/testlib.ts`, `src/tools/8bws.ts` |
| In-process worker entry | `src/worker/workerlib.ts`, `src/worker/workermain.ts` |
| Build pipeline / message shape | `src/worker/builder.ts`, `src/common/workertypes.ts` |
| Tool metadata (editorStyle, patterns) | `src/common/toolmeta.ts` |
| Tool selection | `src/common/baseplatform.ts` (`getToolForFilename_*`) → `src/common/toolselect.ts` |
| Lazy platform loading | `src/platform/_index.ts` |
| Worker message + deps (IDE) | `src/ide/project.ts` (`CodeProject`) |
| Breakpoint expressions | `src/common/breakcond.ts`, `src/common/breakpoints.ts`, `src/ide/breakpoints.ts` (store) |
| CLI run/step/break | `src/tools/runscript.ts` |
| Token sets / grammars | `src/parser/tokens-*.ts`, `src/parser/*.grammar` |
| Toolchain assets | `src/worker/wasm`, `src/worker/fs`, `src/worker/asmjs` |
| Proposed shared core | `src/common/projectcore.ts`, `src/common/toolselect.ts` (new) |