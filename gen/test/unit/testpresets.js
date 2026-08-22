"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const assert_1 = __importDefault(require("assert"));
const mocha_1 = require("mocha");
const fs_1 = __importDefault(require("fs"));
const path_1 = __importDefault(require("path"));
const pixeleditor_1 = require("../../src/ide/pixeleditor");
// Scans every file under presets/ for asset editor blocks (/*{...}*/ and ;;{...};;)
// and validates them the same way the AssetEditorView does:
//  - headers must parse (valid lenient JSON, closed by ';', ';;' or 'end')
//  - inline data blocks must contain exactly the number of words required by fmt
//  - #embed'd binary files must exist and have exactly the required byte length
const PRESETS_DIR = path_1.default.join(process.cwd(), 'presets');
const TEXT_EXTENSIONS = new Set(['.c', '.h', '.a', '.s', '.asm', '.dasm', '.v', '.inc', '.cfg', '.mac']);
function isVerilogFile(relpath) {
    return relpath.includes('verilog') || relpath.endsWith('.v');
}
function* walkFiles(dir) {
    for (const entry of fs_1.default.readdirSync(dir, { withFileTypes: true })) {
        const p = path_1.default.join(dir, entry.name);
        if (entry.isDirectory())
            yield* walkFiles(p);
        else if (entry.isFile())
            yield p;
    }
}
function isTextPresetFile(relpath) {
    if (relpath.endsWith('~'))
        return false; // editor backups
    const ext = path_1.default.extname(relpath);
    return ext !== '' && TEXT_EXTENSIONS.has(ext);
}
function scanAllPresets() {
    var result = [];
    for (const filepath of walkFiles(PRESETS_DIR)) {
        const relpath = path_1.default.relative(PRESETS_DIR, filepath).split(path_1.default.sep).join('/');
        if (!isTextPresetFile(relpath))
            continue;
        let data;
        try {
            data = fs_1.default.readFileSync(filepath, 'utf8');
        }
        catch (e) {
            continue;
        }
        // skip binary files that slipped through the extension filter
        if (/\0/.test(data.slice(0, 2000)))
            continue;
        for (const frag of (0, pixeleditor_1.scanTextForAssetFragments)(data, isVerilogFile(relpath))) {
            result.push({ relpath, frag });
        }
    }
    return result;
}
(0, mocha_1.describe)('Presets (asset editor blocks)', function () {
    var scanned;
    before(function () {
        assert_1.default.ok(fs_1.default.existsSync(PRESETS_DIR), `presets directory not found at ${PRESETS_DIR}`);
        scanned = scanAllPresets();
    });
    (0, mocha_1.it)('should find a reasonable number of asset declarations', function () {
        assert_1.default.ok(scanned.length > 100, `only found ${scanned.length} asset declarations in presets/`);
    });
    (0, mocha_1.it)('should have no parse errors in asset headers', function () {
        var errors = scanned.filter(({ relpath, frag }) => frag.error)
            .map(({ relpath, frag }) => `${relpath}:${frag.startline} ${frag.header} -> ${frag.error}`);
        assert_1.default.deepEqual(errors, []);
    });
    (0, mocha_1.it)('should have valid data sizes for inline data blocks', function () {
        var errors = [];
        for (var { relpath, frag } of scanned) {
            if (frag.error || !frag.fmt)
                continue;
            if (frag.embedFile)
                continue; // checked below
            if (!(frag.fmt.w > 0 && frag.fmt.h > 0) && !frag.fmt.pal)
                continue;
            const data = fs_1.default.readFileSync(path_1.default.join(PRESETS_DIR, relpath), 'utf8');
            const err = (0, pixeleditor_1.validateAssetData)(data.substring(frag.start, frag.end), frag.fmt);
            if (err)
                errors.push(`${relpath}:${frag.startline} ${frag.header} -> ${err}`);
        }
        assert_1.default.deepEqual(errors, []);
    });
    (0, mocha_1.it)('should resolve #embed files and match their byte length to the format', function () {
        var errors = [];
        // (presets may not use #embed yet, but validate any that do)
        for (var { relpath, frag } of scanned) {
            if (frag.error || !frag.fmt || !frag.embedFile)
                continue;
            const resolved = (0, pixeleditor_1.resolveEmbedPath)(relpath, frag.embedFile, (p) => fs_1.default.existsSync(path_1.default.join(PRESETS_DIR, p)));
            if (!resolved) {
                errors.push(`${relpath}:${frag.startline} #embed file not found: "${frag.embedFile}"`);
                continue;
            }
            const bytelen = fs_1.default.statSync(path_1.default.join(PRESETS_DIR, resolved)).size;
            const err = (0, pixeleditor_1.validateAssetByteLength)(bytelen, frag.fmt);
            if (err)
                errors.push(`${relpath}:${frag.startline} ${frag.header} (${resolved}) -> ${err}`);
        }
        assert_1.default.deepEqual(errors, []);
    });
});
//# sourceMappingURL=testpresets.js.map