// Tokenizes every assembly preset with the generated grammars and lists
// the words read as macro calls. A mnemonic or directive in that list is
// one the grammar is missing.
//
//   npm run build && node out/grammarsurvey.js [count]
import * as fs from 'fs';
import * as path from 'path';
import { getToolForPlatform } from '../../src/common/toolselect';
import { TOOL_META } from '../../src/common/toolmeta';
import { ASM_LANGUAGES } from '../src/syntaxgen';
import { loadGrammar, tokens } from './tmtokenize';

const PRESETS = path.resolve(__dirname, '..', '..', 'presets');
const count = Number(process.argv[2]) || 60;

(async () => {
  const calls = new Map<string, number>();
  let nfiles = 0;
  for (const platform of fs.readdirSync(PRESETS)) {
    const dir = path.join(PRESETS, platform);
    if (!fs.statSync(dir).isDirectory()) continue;
    for (const f of fs.readdirSync(dir)) {
      if (!/\.(a|s|asm|inc|dasm|ca65|xa|nesasm|z|zmac|sgb|xasm|lwasm)$/.test(f)) continue;
      const style = TOOL_META[getToolForPlatform(platform, f)]?.editorStyle;
      const lang = ASM_LANGUAGES.find((l) => l.cpu === style);
      if (!lang) continue;
      const g = await loadGrammar(lang.cpu);
      nfiles++;
      for (const line of fs.readFileSync(path.join(dir, f), 'latin1').split(/\r?\n/)) {
        for (const [text, scope] of tokens(g, line)) {
          if (!scope.endsWith('macro.call')) continue;
          const key = `${lang.cpu} ${text.toLowerCase()}`;
          calls.set(key, (calls.get(key) || 0) + 1);
        }
      }
    }
  }
  console.log(`${nfiles} files; words read as macro calls:`);
  for (const [w, n] of [...calls].sort((a, b) => b[1] - a[1]).slice(0, count))
    console.log(`${String(n).padStart(5)}  ${w}`);
})();
