/**
 * DocsSource tests - the IDE help docs are bundled as rendered HTML, so the
 * docs index is built at runtime from help topics registered via
 * setDocsProvider(). These tests exercise the pure HTML->records extraction
 * and the source's query path without needing the `.md` imports (which only
 * esbuild can resolve).
 */

import * as assert from 'assert';
import { DocsSource, setDocsProvider, extractDocRecords, htmlToText, DocTopic } from '../../src/ide/search/docssource';

const EDITOR_TOPIC: DocTopic = {
  id: 'editor',
  title: 'Editor',
  html: [
    '<h1>Editor</h1>',
    '<p>The source editor is based on CodeMirror 6.</p>',
    '<h2>Gutter</h2>',
    '<p>Click the red circle to toggle a breakpoint.</p>',
    '<h2>Keyboard shortcuts</h2>',
    '<p>Press Tab to indent.</p>',
    '<p>Press Backspace to outdent a selection.</p>',
  ].join(''),
};

describe('htmlToText', function () {
  it('should strip tags, collapse whitespace, and decode entities', function () {
    assert.strictEqual(htmlToText('<p>a &amp; b</p>\n  <p>c</p>'), 'a & b c');
    assert.strictEqual(htmlToText('<code>mod+shift+f</code>'), 'mod+shift+f');
  });
});

describe('extractDocRecords', function () {
  it('should emit a page record plus one record per heading', function () {
    const records = extractDocRecords(EDITOR_TOPIC);
    const names = records.map(r => r.name);
    assert.ok(names.includes('Editor'), 'page title recorded');
    assert.ok(names.includes('Gutter'));
    assert.ok(names.includes('Keyboard shortcuts'));
    assert.strictEqual(records.length, 3, 'page + two sections');
  });

  it('should route every record back to the help topic', function () {
    for (const rec of extractDocRecords(EDITOR_TOPIC)) {
      assert.strictEqual(rec.source, 'docs');
      assert.strictEqual(rec.kind, 'doc');
      assert.strictEqual(rec.url, '#help/editor');
      assert.strictEqual(rec.file, 'Editor');
    }
  });

  it('should capture section prose in brief/detail for search', function () {
    const rec = extractDocRecords(EDITOR_TOPIC).find(r => r.name === 'Gutter');
    assert.ok(rec);
    assert.strictEqual(rec.brief, 'Click the red circle to toggle a breakpoint.');
  });

  it('should keep text past the first sentence in detail', function () {
    const rec = extractDocRecords(EDITOR_TOPIC).find(r => r.name === 'Keyboard shortcuts');
    assert.ok(rec);
    assert.ok((rec.detail || '').includes('Backspace'), 'later paragraphs stay searchable');
  });

  it('should assign unique ids', function () {
    const ids = extractDocRecords(EDITOR_TOPIC).map(r => r.id);
    assert.strictEqual(new Set(ids).size, ids.length);
  });
});

describe('DocsSource', function () {
  after(function () {
    setDocsProvider(() => []);
  });

  it('should find a doc by heading name', async function () {
    setDocsProvider(() => [EDITOR_TOPIC]);
    const ds = new DocsSource();
    const hits = await ds.query('Gutter', 10);
    assert.ok(hits.length >= 1, 'should find the Gutter section');
    assert.ok(hits.some(h => h.record.name === 'Gutter'));
    assert.strictEqual(hits[0].record.source, 'docs');
  });

  it('should find docs by prose in the body', async function () {
    setDocsProvider(() => [EDITOR_TOPIC]);
    const ds = new DocsSource();
    const hits = await ds.query('Backspace', 10);
    assert.ok(hits.length >= 1, 'prose search should match section text past the brief');
    // Prose hits come back through MiniSearch; the url must survive so
    // openSearchHit() can route to the help page instead of opening a tab.
    assert.strictEqual(hits[0].record.url, '#help/editor');
  });

  it('should return nothing when no provider is registered', async function () {
    setDocsProvider(() => []);
    const ds = new DocsSource();
    const hits = await ds.query('editor', 10);
    assert.deepStrictEqual(hits, []);
  });
});