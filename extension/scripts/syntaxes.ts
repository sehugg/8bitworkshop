// Writes the assembler grammars and language configurations to
// out/syntaxes/ (npm run build runs it). package.json's contributes.languages
// and contributes.grammars must match makeContributions(); a test checks.
import { mkdirSync, writeFileSync } from 'fs';
import path from 'path';
import { ASM_LANGUAGES, makeGrammar, makeLanguageConfiguration } from '../src/syntaxgen';

const outDir = path.resolve(__dirname, 'syntaxes');
mkdirSync(outDir, { recursive: true });
for (const lang of ASM_LANGUAGES) {
  writeFileSync(path.join(outDir, `${lang.id}.tmLanguage.json`), JSON.stringify(makeGrammar(lang), null, 1));
  writeFileSync(path.join(outDir, `${lang.id}.language-configuration.json`), JSON.stringify(makeLanguageConfiguration(lang), null, 1));
}
console.error(`[syntaxes] wrote ${ASM_LANGUAGES.length} grammars to ${outDir}`);
