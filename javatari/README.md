# Javatari 0.91 (8bitworkshop fork), frozen

The `vcs` platform in the IDE (`VCSPlatform`, src/platform/vcs.ts) loads
`javatari/javatari.js` and drives Javatari's own screen and console UI.

These files are the prebuilt bundle from the javatari.js fork at commit
113cd57 (`release/javatari/`). That build carries the hooks the IDE calls:
`debugEval`, `getCPUState`, `saveControlsState`, `getOpcodeMetadata`, and
`Monitor.getDisplayParameters`.

The `javatari.js` submodule now tracks upstream v4 on the `v4-core` branch.
Its sources don't have these hooks and can't rebuild this bundle, so don't
replace it with a `grunt` build. The submodule supplies only
`release/core/javatari-core.js`, the headless core behind `vcs.jt4`
(src/machine/vcs.ts).

Javatari is copyright Paulo Augusto Peccin, under the AGPL v3; see
`license.txt`.
