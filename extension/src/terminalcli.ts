// terminalcli - the launcher script that puts 8bws on the integrated
// terminal's PATH. It runs out/8bws.js (cli.ts) with VS Code's own Node, so
// users need no Node install. No vscode import, so tests can drive it.

import * as fs from 'fs';
import * as path from 'path';

export interface LauncherOptions {
  /** VS Code's executable; ELECTRON_RUN_AS_NODE makes it plain Node */
  node: string;
  /** out/8bws.js */
  script: string;
  /** EIGHTBITWORKSHOP_* variables for cli.ts */
  env: { [name: string]: string };
}

function shQuote(s: string): string {
  return `'${s.replace(/'/g, `'\\''`)}'`;
}

/** The launcher files for `platform`: a shell script, plus a .cmd on Windows. */
export function launcherFiles(opts: LauncherOptions, platform: string = process.platform): { name: string, text: string }[] {
  var env = { ELECTRON_RUN_AS_NODE: '1', ...opts.env };
  var sh = [
    '#!/bin/sh',
    '# 8bitworkshop command line tool, written by the VS Code extension.',
    ...Object.entries(env).map(([k, v]) => `export ${k}=${shQuote(v)}`),
    `exec ${shQuote(opts.node)} ${shQuote(opts.script)} "$@"`,
    '',
  ].join('\n');
  var files = [{ name: '8bws', text: sh }];
  if (platform === 'win32') {
    files.push({
      name: '8bws.cmd', text: [
        '@echo off',
        'rem 8bitworkshop command line tool, written by the VS Code extension.',
        'setlocal',
        ...Object.entries(env).map(([k, v]) => `set "${k}=${v}"`),
        `"${opts.node}" "${opts.script}" %*`,
        '',
      ].join('\r\n'),
    });
  }
  return files;
}

/** Write the launcher into `binDir`, touching only files that changed. */
export function writeLauncher(binDir: string, opts: LauncherOptions, platform: string = process.platform) {
  fs.mkdirSync(binDir, { recursive: true });
  for (var f of launcherFiles(opts, platform)) {
    var file = path.join(binDir, f.name);
    var old = fs.existsSync(file) ? fs.readFileSync(file, 'utf-8') : null;
    if (old !== f.text) fs.writeFileSync(file, f.text);
    fs.chmodSync(file, 0o755);
  }
}

/**
 * README.md for a new project. The 8bitworkshop link names the platform and
 * main file, which detection reads (parseReadmeBadge in src/common/detect.ts),
 * so `8bws build` needs no --platform.
 */
export function projectReadme(name: string, platform: { id: string, name: string, romext?: string }, mainFile: string): string {
  var base = path.basename(mainFile, path.extname(mainFile));
  var rom = base + (platform.romext || '.bin');
  var link = `https://8bitworkshop.com/redir.html?platform=${encodeURIComponent(platform.id)}&file=${encodeURIComponent(mainFile)}`;
  return `# ${name}

A ${platform.name} program made with [8bitworkshop](${link}).

## Build and run

In VS Code with the 8bitworkshop extension, open \`${mainFile}\` and click **Run**.

From VS Code's integrated terminal, in this folder (turn on the
\`8bitworkshop.terminalCommand\` setting first):

\`\`\`sh
# compile to a ROM
8bws build ${mainFile} -o ${rom}
# run without a window for 120 frames, and save a screenshot
8bws run ${mainFile} --frames 120 --png screen.png
# all commands and options
8bws help
\`\`\`

Add \`--json\` for machine-readable output.
`;
}
