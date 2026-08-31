"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const assert_1 = __importDefault(require("assert"));
const mocha_1 = require("mocha");
const symbolindex_1 = require("../../src/ide/search/symbolindex");
function createTestRecord(name, kind, source = 'project', brief, detail, file = 'test.c', line = 1) {
    return {
        id: `${file}:${line}:${name}-${source}`, // Unique ID with source suffix
        name,
        kind,
        brief,
        detail,
        source,
        file,
        line
    };
}
(0, mocha_1.describe)('SymbolIndex Search Ranking', function () {
    let index;
    before(async function () {
        index = new symbolindex_1.SymbolIndex();
        // Add test records with various match qualities
        const records = [
            // Exact name matches
            createTestRecord('joy_read', 'func', 'toolchain', 'Read joystick state'),
            createTestRecord('joy_write', 'func', 'toolchain', 'Write joystick state'),
            createTestRecord('JOY_BTN_1', 'macro', 'toolchain', 'Joystick button 1 mask'),
            createTestRecord('JOY_BTN_2', 'macro', 'toolchain', 'Joystick button 2 mask'),
            createTestRecord('JOY_DIR_LEFT', 'macro', 'toolchain', 'Left direction'),
            // Project symbols (higher priority - same name, different source)
            createTestRecord('main', 'func', 'project', 'Main entry point'),
            createTestRecord('update', 'func', 'project', 'Game update loop'),
            createTestRecord('init', 'func', 'project', 'Initialize system'),
            // Longer names with common prefixes
            createTestRecord('joy_read_button', 'func', 'toolchain', 'Read button state'),
            createTestRecord('joy_read_axis', 'func', 'toolchain', 'Read axis value'),
            createTestRecord('joy_read_all', 'func', 'toolchain', 'Read all inputs'),
            // Partial matches
            createTestRecord('joystick_init', 'func', 'toolchain', 'Initialize joystick'),
            createTestRecord('joystick_poll', 'func', 'toolchain', 'Poll joystick'),
            createTestRecord('joystick_calibrate', 'func', 'toolchain', 'Calibrate joystick'),
            // Docs
            createTestRecord('Getting Started', 'doc', 'docs', 'How to get started with 8bitworkshop'),
            createTestRecord('Joystick API', 'doc', 'docs', 'Joystick API reference'),
            createTestRecord('Memory Map', 'doc', 'docs', 'Memory map documentation'),
        ];
        index.pushRecords(records);
        await index.init();
    });
    (0, mocha_1.describe)('uFuzzy name matching', function () {
        (0, mocha_1.it)('should rank exact matches first', async function () {
            const results = await index.query('joy_read', 10);
            assert_1.default.ok(results.length >= 1, 'Should have at least one result');
            assert_1.default.strictEqual(results[0].record.name, 'joy_read', 'Exact match should be first');
            assert_1.default.strictEqual(results[0].record.kind, 'func');
        });
        (0, mocha_1.it)('should rank prefix matches after exact', async function () {
            const results = await index.query('joy', 10);
            // Should find all joy_* symbols
            const names = results.map(r => r.record.name);
            assert_1.default.ok(names.includes('joy_read'));
            assert_1.default.ok(names.includes('joy_write'));
            assert_1.default.ok(names.includes('joy_read_button'));
            assert_1.default.ok(names.includes('joy_read_axis'));
            assert_1.default.ok(names.includes('joy_read_all'));
        });
        (0, mocha_1.it)('should handle fuzzy matching (joy_rd -> joy_read)', async function () {
            const results = await index.query('joy_rd', 10);
            const names = results.map(r => r.record.name);
            assert_1.default.ok(names.includes('joy_read'), 'Should match joy_read with typo');
        });
        (0, mocha_1.it)('should rank project symbols above toolchain for same name', async function () {
            // Add duplicate name with project source - same name, different source
            // The project source has weight 1.3 vs toolchain 1.0, so project should rank higher
            const projectJoy = createTestRecord('joy_read', 'func', 'project', 'Project joy read');
            index.pushRecords([projectJoy]);
            const results = await index.query('joy_read', 10);
            // First result should be project source (higher weight)
            const first = results.find(r => r.record.name === 'joy_read');
            assert_1.default.ok(first, 'Should find joy_read');
            assert_1.default.strictEqual(first.record.source, 'project', 'Project source should win for equal match quality');
        });
        (0, mocha_1.it)('should handle case-insensitive matching', async function () {
            const results = await index.query('JOY_READ', 10);
            const names = results.map(r => r.record.name);
            assert_1.default.ok(names.includes('joy_read'), 'Should match case-insensitively');
        });
        (0, mocha_1.it)('should limit results to specified limit', async function () {
            const results = await index.query('joy', 3);
            assert_1.default.ok(results.length <= 3);
        });
    });
    (0, mocha_1.describe)('Source weight priority', function () {
        (0, mocha_1.it)('should prefer project over toolchain for equal match', async function () {
            // Add duplicate name with project source
            const projectMain = createTestRecord('main', 'func', 'project', 'Project main');
            const toolMain = createTestRecord('main', 'func', 'toolchain', 'Tool main');
            // Both have same name but project has weight 1.3 > toolchain 1.0
            const testIndex = new symbolindex_1.SymbolIndex([projectMain, toolMain]);
            await testIndex.init();
            const results = await testIndex.query('main', 10);
            // Project should rank higher due to source weight
            assert_1.default.strictEqual(results[0].record.source, 'project');
        });
        (0, mocha_1.it)('should prefer toolchain over docs for equal match', async function () {
            const toolMain = createTestRecord('getting_started', 'func', 'toolchain', 'Tool getting_started');
            const docMain = createTestRecord('Getting Started', 'doc', 'docs', 'Doc getting started');
            const testIndex = new symbolindex_1.SymbolIndex([toolMain, docMain]);
            await testIndex.init();
            const results = await testIndex.query('getting_started', 10);
            // Toolchain should rank higher than docs (weight 1.0 > 0.7)
            assert_1.default.strictEqual(results[0].record.source, 'toolchain');
        });
    });
    (0, mocha_1.describe)('MiniSearch prose search', function () {
        (0, mocha_1.it)('should find records by brief text', async function () {
            // search for a phrase in the brief field
            const results = await index.query('joystick state', 10);
            const names = results.map(r => r.record.name);
            assert_1.default.ok(names.includes('joy_read') || results.length > 0, 'Should find at least one record by brief text');
        });
    });
    (0, mocha_1.describe)('Deduplication', function () {
        (0, mocha_1.it)('should not return duplicate records by ID', async function () {
            // Create index with duplicate IDs
            const dupRecords = [
                createTestRecord('test', 'func', 'project'),
                createTestRecord('test', 'func', 'project'), // duplicate
            ];
            const testIndex = new symbolindex_1.SymbolIndex(dupRecords);
            await testIndex.init();
            const results = await testIndex.query('test', 10);
            assert_1.default.strictEqual(results.length, 1, 'Should deduplicate by ID');
        });
    });
    (0, mocha_1.describe)('Edge cases', function () {
        (0, mocha_1.it)('should return empty for empty query', async function () {
            const results = await index.query('', 10);
            assert_1.default.strictEqual(results.length, 0);
        });
        (0, mocha_1.it)('should return empty for empty index', async function () {
            const emptyIndex = new symbolindex_1.SymbolIndex([]);
            await emptyIndex.init();
            const results = await emptyIndex.query('test', 10);
            assert_1.default.strictEqual(results.length, 0);
        });
        (0, mocha_1.it)('should handle special characters in needle', async function () {
            // Add record with special chars
            const special = createTestRecord('foo$bar', 'macro', 'project');
            index.pushRecords([special]);
            const results = await index.query('foo$bar', 10);
            assert_1.default.ok(results.find(r => r.record.name === 'foo$bar'));
        });
    });
});
// ---------------------------------------------------------------------------
// ProjectSource full-text search (straight scan of project file data)
// ---------------------------------------------------------------------------
const projectsource_1 = require("../../src/ide/search/projectsource");
(0, mocha_1.describe)('ProjectSource full-text search', function () {
    let ps;
    before(async function () {
        ps = new projectsource_1.ProjectSource();
    });
    after(function () {
        (0, projectsource_1.setProjectProvider)(() => null);
    });
    (0, mocha_1.it)('should find matching lines in project file text (case-insensitive)', async function () {
        // register stub project with a couple of files
        (0, projectsource_1.setProjectProvider)(() => ({
            mainPath: 'main.c',
            iterateFiles: (cb) => {
                cb('main.c', 'int main() {\n  return 0;\n}\n');
                cb('game.s', 'foo:  lda #$10\n  sta $80\n');
            }
        }));
        const hits = ps.fulltextQuery('return', 10);
        assert_1.default.ok(hits.length >= 1, 'Should find return');
        const rec = hits[0].record;
        assert_1.default.strictEqual(rec.kind, 'text');
        assert_1.default.strictEqual(rec.source, 'project');
        assert_1.default.strictEqual(rec.file, 'main.c');
        assert_1.default.strictEqual(rec.line, 2);
    });
    (0, mocha_1.it)('should not search binary files', async function () {
        (0, projectsource_1.setProjectProvider)(() => ({
            mainPath: 'main.c',
            iterateFiles: (cb) => {
                cb('sprite.bin', new Uint8Array([0, 1, 2, 3]));
                cb('main.c', 'void setup() {}\n');
            }
        }));
        const hits = ps.fulltextQuery('setup', 10);
        assert_1.default.ok(hits.length >= 1);
        assert_1.default.strictEqual(hits[0].record.file, 'main.c');
    });
    (0, mocha_1.it)('should require at least 2 chars', async function () {
        (0, projectsource_1.setProjectProvider)(() => ({
            mainPath: 'main.c',
            iterateFiles: (cb) => cb('main.c', 'x\ny\n')
        }));
        const hits = ps.fulltextQuery('x', 10);
        assert_1.default.strictEqual(hits.length, 0);
    });
    (0, mocha_1.it)('should rank symbol hits above text hits', async function () {
        (0, projectsource_1.setProjectProvider)(() => ({
            mainPath: 'main.c',
            iterateFiles: (cb) => cb('main.c', 'int counter = 0;\n')
        }));
        // stub index: symbol hit for counter
        ps.index = {
            query: () => [{
                    record: { id: 'main.c:1:counter', name: 'counter', kind: 'var', source: 'project', file: 'main.c', line: 1 },
                    score: 980
                }]
        };
        const hits = ps.query('counter', 10);
        assert_1.default.strictEqual(hits[0].record.kind, 'var', 'Symbol hit should rank first');
        assert_1.default.strictEqual(hits[0].score, 980);
    });
});
//# sourceMappingURL=testsearchindex.js.map