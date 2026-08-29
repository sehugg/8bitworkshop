import assert from "assert";
import { describe, it } from "mocha";
import { SymbolIndex } from "../../src/ide/search/symbolindex";
import { SymbolRecord, SymbolSourceKind, SymbolKind } from "../../src/common/searchtypes";

function createTestRecord(
  name: string,
  kind: SymbolKind,
  source: SymbolSourceKind = 'project',
  brief?: string,
  detail?: string,
  file: string = 'test.c',
  line: number = 1
): SymbolRecord {
  return {
    id: `${file}:${line}:${name}-${source}`,  // Unique ID with source suffix
    name,
    kind,
    brief,
    detail,
    source,
    file,
    line
  };
}

describe('SymbolIndex Search Ranking', function () {
  let index: SymbolIndex;

  before(async function () {
    index = new SymbolIndex();

    // Add test records with various match qualities
    const records: SymbolRecord[] = [
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

  describe('uFuzzy name matching', function () {
    it('should rank exact matches first', async function () {
      const results = await index.query('joy_read', 10);

      assert.ok(results.length >= 1, 'Should have at least one result');
      assert.strictEqual(results[0].record.name, 'joy_read', 'Exact match should be first');
      assert.strictEqual(results[0].record.kind, 'func');
    });

    it('should rank prefix matches after exact', async function () {
      const results = await index.query('joy', 10);

      // Should find all joy_* symbols
      const names = results.map(r => r.record.name);
      assert.ok(names.includes('joy_read'));
      assert.ok(names.includes('joy_write'));
      assert.ok(names.includes('joy_read_button'));
      assert.ok(names.includes('joy_read_axis'));
      assert.ok(names.includes('joy_read_all'));
    });

    it('should handle fuzzy matching (joy_rd -> joy_read)', async function () {
      const results = await index.query('joy_rd', 10);

      const names = results.map(r => r.record.name);
      assert.ok(names.includes('joy_read'), 'Should match joy_read with typo');
    });

    it('should rank project symbols above toolchain for same name', async function () {
      // Add duplicate name with project source - same name, different source
      // The project source has weight 1.3 vs toolchain 1.0, so project should rank higher
      const projectJoy = createTestRecord('joy_read', 'func', 'project', 'Project joy read');
      index.pushRecords([projectJoy]);

      const results = await index.query('joy_read', 10);

      // First result should be project source (higher weight)
      const first = results.find(r => r.record.name === 'joy_read');
      assert.ok(first, 'Should find joy_read');
      assert.strictEqual(first.record.source, 'project', 'Project source should win for equal match quality');
    });

    it('should handle case-insensitive matching', async function () {
      const results = await index.query('JOY_READ', 10);

      const names = results.map(r => r.record.name);
      assert.ok(names.includes('joy_read'), 'Should match case-insensitively');
    });

    it('should limit results to specified limit', async function () {
      const results = await index.query('joy', 3);

      assert.ok(results.length <= 3);
    });
  });

  describe('Source weight priority', function () {
    it('should prefer project over toolchain for equal match', async function () {
      // Add duplicate name with project source
      const projectMain = createTestRecord('main', 'func', 'project', 'Project main');
      const toolMain = createTestRecord('main', 'func', 'toolchain', 'Tool main');

      // Both have same name but project has weight 1.3 > toolchain 1.0
      const testIndex = new SymbolIndex([projectMain, toolMain]);
      await testIndex.init();

      const results = await testIndex.query('main', 10);

      // Project should rank higher due to source weight
      assert.strictEqual(results[0].record.source, 'project');
    });

    it('should prefer toolchain over docs for equal match', async function () {
      const toolMain = createTestRecord('getting_started', 'func', 'toolchain', 'Tool getting_started');
      const docMain = createTestRecord('Getting Started', 'doc', 'docs', 'Doc getting started');

      const testIndex = new SymbolIndex([toolMain, docMain]);
      await testIndex.init();

      const results = await testIndex.query('getting_started', 10);

      // Toolchain should rank higher than docs (weight 1.0 > 0.7)
      assert.strictEqual(results[0].record.source, 'toolchain');
    });
  });

  describe('MiniSearch prose search', function () {
    it('should find records by brief text', async function () {
      // search for a phrase in the brief field
      const results = await index.query('joystick state', 10);

      const names = results.map(r => r.record.name);
      assert.ok(names.includes('joy_read') || results.length > 0, 'Should find at least one record by brief text');
    });
  });

  describe('Deduplication', function () {
    it('should not return duplicate records by ID', async function () {
      // Create index with duplicate IDs
      const dupRecords: SymbolRecord[] = [
        createTestRecord('test', 'func', 'project'),
        createTestRecord('test', 'func', 'project'), // duplicate
      ];

      const testIndex = new SymbolIndex(dupRecords);
      await testIndex.init();

      const results = await testIndex.query('test', 10);

      assert.strictEqual(results.length, 1, 'Should deduplicate by ID');
    });
  });

  describe('Edge cases', function () {
    it('should return empty for empty query', async function () {
      const results = await index.query('', 10);
      assert.strictEqual(results.length, 0);
    });

    it('should return empty for empty index', async function () {
      const emptyIndex = new SymbolIndex([]);
      await emptyIndex.init();

      const results = await emptyIndex.query('test', 10);
      assert.strictEqual(results.length, 0);
    });

    it('should handle special characters in needle', async function () {
      // Add record with special chars
      const special = createTestRecord('foo$bar', 'macro', 'project');
      index.pushRecords([special]);

      const results = await index.query('foo$bar', 10);
      assert.ok(results.find(r => r.record.name === 'foo$bar'));
    });
  });
});

// ---------------------------------------------------------------------------
// ProjectSource full-text search (straight scan of project file data)
// ---------------------------------------------------------------------------
import { ProjectSource, setProjectProvider } from '../../src/ide/search/projectsource';

describe('ProjectSource full-text search', function () {
  let ps: ProjectSource;

  before(async function () {
    ps = new ProjectSource();
  });

  after(function () {
    setProjectProvider(() => null);
  });

  it('should find matching lines in project file text (case-insensitive)', async function () {
    // register stub project with a couple of files
    setProjectProvider(() => ({
      mainPath: 'main.c',
      iterateFiles: (cb: (path: string, data: any) => void) => {
        cb('main.c', 'int main() {\n  return 0;\n}\n');
        cb('game.s', 'foo:  lda #$10\n  sta $80\n');
      }
    }));

    const hits = (ps as any).fulltextQuery('return', 10);
    assert.ok(hits.length >= 1, 'Should find return');
    const rec = hits[0].record;
    assert.strictEqual(rec.kind, 'text');
    assert.strictEqual(rec.source, 'project');
    assert.strictEqual(rec.file, 'main.c');
    assert.strictEqual(rec.line, 2);
  });

  it('should not search binary files', async function () {
    setProjectProvider(() => ({
      mainPath: 'main.c',
      iterateFiles: (cb) => {
        cb('sprite.bin', new Uint8Array([0, 1, 2, 3]));
        cb('main.c', 'void setup() {}\n');
      }
    }));

    const hits = (ps as any).fulltextQuery('setup', 10);
    assert.ok(hits.length >= 1);
    assert.strictEqual(hits[0].record.file, 'main.c');
  });

  it('should require at least 2 chars', async function () {
    setProjectProvider(() => ({
      mainPath: 'main.c',
      iterateFiles: (cb) => cb('main.c', 'x\ny\n')
    }));
    const hits = (ps as any).fulltextQuery('x', 10);
    assert.strictEqual(hits.length, 0);
  });

  it('should rank symbol hits above text hits', async function () {
    setProjectProvider(() => ({
      mainPath: 'main.c',
      iterateFiles: (cb) => cb('main.c', 'int counter = 0;\n')
    }));
    // stub index: symbol hit for counter
    (ps as any).index = {
      query: () => [{
        record: { id: 'main.c:1:counter', name: 'counter', kind: 'var', source: 'project', file: 'main.c', line: 1 },
        score: 980
      }]
    };

    const hits = ps.query('counter', 10);
    assert.strictEqual(hits[0].record.kind, 'var', 'Symbol hit should rank first');
    assert.strictEqual(hits[0].score, 980);
  });
});