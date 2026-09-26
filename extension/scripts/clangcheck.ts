// Runs clang over the C presets the way clangd would see them, with
// cheaders.ts's headers, defines, flags and shims, and reports the errors.
// Measures how well clangd/cpptools can read cc65 and SDCC code.
//
//   npm run build && node out/clangcheck.js [platform...]
//
// Needs a clang with the msp430 target (Homebrew llvm has it; Apple's
// doesn't). Set CLANG to its path. Headers go to out/clangcheck/.
import { execFileSync } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';
import { getToolForPlatform } from '../../src/common/toolselect';
import { clangArgs, clangConfig, extractHeaders } from '../src/cheaders';

const EXT = path.resolve(__dirname, '..');
const REPO = path.resolve(EXT, '..');
const WORKER = path.join(REPO, 'src', 'worker');
const CLANG = process.env.CLANG || '/opt/homebrew/opt/llvm/bin/clang';
const DEFAULT_PLATFORMS = [
  // cc65
  'nes', 'c64',
  // sdcc
  'coleco', 'sms-sms-libcv', 'sms-sg1000-libcv', 'sms-gg-libcv', 'msx', 'msx-libcv',
  'zx', 'vicdual', 'mw8080bw', 'galaxian-scramble', 'williams-z80', 'astrocade',
  'astrocade-arcade', 'astrocade-bios', 'cpc', 'pacman', 'mcr', 'sound_williams-z80',
  'vector-z80color', 'base_z80', 'gb',
];

const platforms = process.argv.slice(2).length ? process.argv.slice(2) : DEFAULT_PLATFORMS;
const messages = new Map<string, number>();
let total = { files: 0, clean: 0, errors: 0, warnings: 0 };

for (const platform of platforms) {
  const dir = path.join(REPO, 'presets', platform);
  if (!fs.existsSync(dir)) { console.log(`${platform}: no presets`); continue; }
  const files = fs.readdirSync(dir).filter((f) => f.endsWith('.c') && !f.endsWith('-llvm.c'));
  const tool = getToolForPlatform(platform, 'main.c');
  const headerDir = path.join(EXT, 'out', 'clangcheck', `${tool}-${platform}`);
  extractHeaders(WORKER, tool, platform, headerDir);
  const config = clangConfig(tool, platform,
    { headerDir, shimDir: path.join(EXT, 'shims'), sourceDir: dir });
  if (!config) { console.log(`${platform}: ${tool} isn't supported`); continue; }
  const args = [...clangArgs(config), '-fsyntax-only', '-ferror-limit=0'];
  let row = { files: 0, clean: 0, errors: 0, warnings: 0 };
  for (const f of files) {
    let out = '';
    try {
      execFileSync(CLANG, [...args, path.join(dir, f)], { encoding: 'utf8', stdio: ['ignore', 'ignore', 'pipe'] });
    } catch (e: any) {
      if (e.code === 'ENOENT') throw new Error(`no clang at ${CLANG}; set CLANG`);
      out = e.stderr || '';
    }
    const errors = out.split('\n').filter((l) => / error: /.test(l));
    const warnings = out.split('\n').filter((l) => / warning: /.test(l));
    row.files++; row.errors += errors.length; row.warnings += warnings.length;
    if (!errors.length) row.clean++;
    for (const l of errors) {
      const where = l.replace(/:\d+:\d+:.*/, '').replace(/^.*\/(presets|include|lib)\//, '$1/');
      const msg = where + ' | ' + l.replace(/^.* error: /, '').replace(/'[^']*'/g, 'X');
      messages.set(msg, (messages.get(msg) || 0) + 1);
    }
  }
  console.log(`${platform.padEnd(20)} ${tool.padEnd(5)} ${row.files} files, ${row.clean} clean, ${row.errors} errors, ${row.warnings} warnings`);
  for (const k of Object.keys(total) as (keyof typeof total)[]) total[k] += row[k];
}
console.log(`${'total'.padEnd(26)} ${total.files} files, ${total.clean} clean, ${total.errors} errors, ${total.warnings} warnings\n`);
console.log('most frequent errors:');
for (const [msg, n] of [...messages].sort((a, b) => b[1] - a[1]).slice(0, 25))
  console.log(`${String(n).padStart(5)}  ${msg}`);
