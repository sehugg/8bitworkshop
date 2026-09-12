/**
 * DocsSource - searches the IDE's own documentation.
 *
 * The help docs are already bundled as rendered HTML strings (the `.md`
 * imports in ../views/helpview.ts), so rather than fetch a prebuilt
 * `searchindex.json` we derive records from those same strings at runtime.
 * That keeps the docs searchable in every deploy (dev, prod, gh-pages, the
 * embedded IDE) with no extra build step or artifact to keep in sync.
 *
 * helpview registers the topic list via setDocsProvider() during IDE startup.
 * The HTML-to-records extraction below is a pure function so it can be
 * exercised under plain Node (where `HELP_TOPICS`'s `.md` imports can't load).
 */

import { SymbolIndex } from "./symbolindex";
import { SymbolRecord, SymbolSourceKind } from "../../common/searchtypes";
import { SearchHit, SearchSource } from "./types";

/** A help topic, mirroring HelpTopic in ../views/helpview.ts. */
export interface DocTopic {
  id: string;     // help topic id, e.g. 'editor'
  title: string;  // window/sidebar title, e.g. 'Editor'
  html: string;   // rendered Markdown
}

type DocsProvider = () => DocTopic[];
let docsProvider: DocsProvider = () => [];

/** Register the help-topic list. Called once during IDE startup. */
export function setDocsProvider(fn: DocsProvider) {
  docsProvider = fn;
}

const HEADING_RE = /<h([1-3])\b[^>]*>([\s\S]*?)<\/h\1>/gi;

/** Decode the handful of entities markdown-it emits into plain text. */
function decodeEntities(s: string): string {
  return s
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#(?:0*39|x27);/gi, "'")
    .replace(/&nbsp;/g, ' ')
    .replace(/&hellip;/g, '…')
    .replace(/&mdash;/g, '—')
    .replace(/&ndash;/g, '–')
    .replace(/&rsquo;|&lsquo;/g, "'")
    .replace(/&rdquo;|&ldquo;/g, '"')
    .replace(/&raquo;/g, '»')
    .replace(/&laquo;/g, '«')
    .replace(/&amp;/g, '&');
}

/** Strip tags/entities to a single line of searchable text. */
export function htmlToText(html: string): string {
  return decodeEntities(html.replace(/<[^>]+>/g, ' ')).replace(/\s+/g, ' ').trim();
}

/** First sentence (or a leading snippet) of some prose. */
function firstSentence(text: string, max = 180): string | undefined {
  const t = text.trim();
  if (!t) return undefined;
  const head = t.slice(0, max);
  const m = head.match(/^([\s\S]*?[.!?])(?:\s|$)/);
  if (m) return m[1];
  return t.length <= max ? t : t.slice(0, max - 1) + '…';
}

/**
 * Turn one rendered doc page into SymbolRecords: one for the page itself and
 * one per section heading. The section text lands in `brief`/`detail`, which
 * MiniSearch indexes for prose queries.
 */
export function extractDocRecords(topic: DocTopic): SymbolRecord[] {
  const records: SymbolRecord[] = [];
  const route = '#help/' + topic.id;
  const file = topic.title || topic.id;

  const html = topic.html || '';
  const headings: { name: string; start: number; end: number }[] = [];
  const re = new RegExp(HEADING_RE.source, 'gi');
  let m: RegExpExecArray | null;
  while ((m = re.exec(html))) {
    headings.push({ name: htmlToText(m[2]), start: m.index, end: re.lastIndex });
  }

  const addRecord = (index: number, name: string, text: string) => {
    if (!name) return;
    const brief = firstSentence(text);
    // Keep the whole section in `detail` so text past the first sentence
    // (later table rows, lists) is still searchable via MiniSearch.
    const detail = brief && text.startsWith(brief) ? text.slice(brief.length).trim() : text;
    records.push({
      id: `${topic.id}:${index}`,
      name,
      kind: 'doc',
      brief,
      detail: detail || undefined,
      source: 'docs',
      file,
      url: route,
    });
  };

  // Intro before the first heading belongs to the page record. Pages usually
  // open with their <h1> at offset 0, in which case there is no intro; the
  // page record still gets a name so the title itself is searchable.
  const firstHeadingStart = headings.length ? headings[0].start : html.length;
  const introText = htmlToText(html.slice(0, firstHeadingStart));
  const pageTitle = (headings.length && headings[0].start === 0)
    ? (headings[0].name || topic.title) : (topic.title || topic.id);
  addRecord(0, pageTitle, introText);

  for (let i = 0; i < headings.length; i++) {
    // Skip the page's own title heading; the page record already covers it.
    if (i === 0 && headings[0].start === 0) continue;
    const contentEnd = i + 1 < headings.length ? headings[i + 1].start : html.length;
    addRecord(i + 1, headings[i].name, htmlToText(html.slice(headings[i].end, contentEnd)));
  }

  return records;
}

export class DocsSource implements SearchSource {
  id: string = 'docs';
  kind: SymbolSourceKind = 'docs';
  private index: SymbolIndex | null = null;
  private readyPromise: Promise<void> | null = null;

  async ready() {
    if (this.readyPromise) return this.readyPromise;
    this.readyPromise = this.load();
    return this.readyPromise;
  }

  private async load() {
    const topics = docsProvider() || [];
    if (topics.length === 0) return;
    const records: SymbolRecord[] = [];
    for (const topic of topics) {
      records.push(...extractDocRecords(topic));
    }
    if (records.length === 0) return;
    const idx = new SymbolIndex(records);
    await idx.init();
    this.index = idx;
  }

  async query(needle: string, limit: number): Promise<SearchHit[]> {
    await this.ready();
    if (!this.index) return [];
    return this.index.query(needle, limit);
  }
}