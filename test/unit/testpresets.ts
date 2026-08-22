
import assert from "assert";
import { describe, it } from "mocha";
import fs from "fs";
import path from "path";
import {
  scanTextForAssetFragments, resolveEmbedPath,
  validateAssetData, validateAssetByteLength, AssetFragment
} from "../../src/ide/pixeleditor";

// Scans every file under presets/ for asset editor blocks (/*{...}*/ and ;;{...};;)
// and validates them the same way the AssetEditorView does:
//  - headers must parse (valid lenient JSON, closed by ';', ';;' or 'end')
//  - inline data blocks must contain exactly the number of words required by fmt
//  - #embed'd binary files must exist and have exactly the required byte length

const PRESETS_DIR = path.join(process.cwd(), 'presets');

const TEXT_EXTENSIONS = new Set(['.c', '.h', '.a', '.s', '.asm', '.dasm', '.v', '.inc', '.cfg', '.mac']);

function isVerilogFile(relpath: string): boolean {
  return relpath.includes('verilog') || relpath.endsWith('.v');
}

function* walkFiles(dir: string): Generator<string> {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, entry.name);
    if (entry.isDirectory()) yield* walkFiles(p);
    else if (entry.isFile()) yield p;
  }
}

function isTextPresetFile(relpath: string): boolean {
  if (relpath.endsWith('~')) return false; // editor backups
  const ext = path.extname(relpath);
  return ext !== '' && TEXT_EXTENSIONS.has(ext);
}

type ScannedFragment = { relpath: string; frag: AssetFragment };

function scanAllPresets(): ScannedFragment[] {
  var result: ScannedFragment[] = [];
  for (const filepath of walkFiles(PRESETS_DIR)) {
    const relpath = path.relative(PRESETS_DIR, filepath).split(path.sep).join('/');
    if (!isTextPresetFile(relpath)) continue;
    let data: string;
    try {
      data = fs.readFileSync(filepath, 'utf8');
    } catch (e) {
      continue;
    }
    // skip binary files that slipped through the extension filter
    if (/\0/.test(data.slice(0, 2000))) continue;
    for (const frag of scanTextForAssetFragments(data, isVerilogFile(relpath))) {
      result.push({ relpath, frag });
    }
  }
  return result;
}

describe('Presets (asset editor blocks)', function () {

  var scanned: ScannedFragment[];

  before(function () {
    assert.ok(fs.existsSync(PRESETS_DIR), `presets directory not found at ${PRESETS_DIR}`);
    scanned = scanAllPresets();
  });

  it('should find a reasonable number of asset declarations', function () {
    assert.ok(scanned.length > 100, `only found ${scanned.length} asset declarations in presets/`);
  });

  it('should have no parse errors in asset headers', function () {
    var errors = scanned.filter(({ relpath, frag }) => frag.error)
      .map(({ relpath, frag }) => `${relpath}:${frag.startline} ${frag.header} -> ${frag.error}`);
    assert.deepEqual(errors, []);
  });

  it('should have valid data sizes for inline data blocks', function () {
    var errors: string[] = [];
    for (var { relpath, frag } of scanned) {
      if (frag.error || !frag.fmt) continue;
      if (frag.embedFile) continue; // checked below
      if (!(frag.fmt.w > 0 && frag.fmt.h > 0) && !frag.fmt.pal) continue;
      const data = fs.readFileSync(path.join(PRESETS_DIR, relpath), 'utf8');
      const err = validateAssetData(data.substring(frag.start!, frag.end!), frag.fmt);
      if (err) errors.push(`${relpath}:${frag.startline} ${frag.header} -> ${err}`);
    }
    assert.deepEqual(errors, []);
  });

  it('should resolve #embed files and match their byte length to the format', function () {
    var errors: string[] = [];
    // (presets may not use #embed yet, but validate any that do)
    for (var { relpath, frag } of scanned) {
      if (frag.error || !frag.fmt || !frag.embedFile) continue;
      const resolved = resolveEmbedPath(relpath, frag.embedFile,
        (p) => fs.existsSync(path.join(PRESETS_DIR, p)));
      if (!resolved) {
        errors.push(`${relpath}:${frag.startline} #embed file not found: "${frag.embedFile}"`);
        continue;
      }
      const bytelen = fs.statSync(path.join(PRESETS_DIR, resolved)).size;
      const err = validateAssetByteLength(bytelen, frag.fmt);
      if (err) errors.push(`${relpath}:${frag.startline} ${frag.header} (${resolved}) -> ${err}`);
    }
    assert.deepEqual(errors, []);
  });

});
