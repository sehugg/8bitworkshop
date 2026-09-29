// toolroot - where the CLI finds toolchains, presets and BIOS images: a
// directory laid out like the repo (src/worker/..., presets/, res/).

/**
 * $EIGHTBITWORKSHOP_ROOT when set (the VS Code extension's launcher points it
 * at the extension's toolchains), else the current directory (a checkout).
 */
export function toolRoot(): string {
  return process.env.EIGHTBITWORKSHOP_ROOT || process.cwd();
}
