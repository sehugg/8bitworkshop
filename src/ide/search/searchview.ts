/**
 * Search View - bootbox-based palette for searching project files,
 * toolchain headers, and docs. Opens an overlay dialog with a live
 * input; results are clickable and open the associated file/header.
 */

import { searchService } from "./service";
import { SearchHit } from "./types";
import { projectWindows, openHeaderFile } from "../ui";
import { SourceEditor, HeaderView } from "../views/editors";

declare var $: JQueryStatic;
declare var bootbox: any;

/** Debounce helper */
function debounce(fn: () => void, ms: number) {
  let timer: any = null;
  return () => {
    if (timer) clearTimeout(timer);
    timer = setTimeout(fn, ms);
  };
}

/** Max results shown in the palette */
const MAX_RESULTS = 30;

function escapeHtml(s: string): string {
  return String(s).replace(/[&<>"']/g, (c) =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c] as string)
  );
}

/** Open the file/header/doc associated with a search hit. */
export function openSearchHit(hit: SearchHit) {
  const rec = hit.record;

  if (rec.source === 'project') {
    // Open a project file at the matching line
    const path = rec.file;
    if (!path || !projectWindows.isWindow(path)) return;
    const wnd = projectWindows.createOrShow(path);
    if (wnd instanceof SourceEditor && rec.line) {
      wnd.navigateToLine(rec.line);
    }
  } else if (rec.source === 'toolchain') {
    // Open a shared header file
    const fn = rec.file;
    if (!fn) return;
    openHeaderFile(fn);
    const wnd = projectWindows.createOrShow('#headerview/' + fn);
    if (wnd instanceof HeaderView && rec.line) {
      wnd.navigateToLine(rec.line);
    }
  } else if (rec.source === 'docs') {
    // External docs: open the URL in a new tab
    const url = rec.detail || rec.file || '';
    if (url) {
      window.open(url, '_blank');
    }
  }
}

export function openSearchDialog() {
  const modal = bootbox.dialog({
    title: 'Search',
    onEscape: true,
    message: `
      <div id="searchbox_form">
        <input type="text" id="searchboxInput" class="form-control"
               placeholder="Search symbols, files, docs... (# symbols, > files, ? docs)"
               autocomplete="off" style="margin-bottom:8px">
        <div id="searchboxResults" style="max-height:340px;overflow-y:auto"></div>
      </div>
    `,
    buttons: {
      close: {
        label: "Close",
        className: "btn-default"
      }
    }
  });

  // bootbox auto-focuses the first accept button on shown; bind after it so
  // our focus wins (jQuery calls handlers in binding order).
  modal.one('shown.bs.modal', () => {
    $('#searchboxInput').trigger('focus');
  });

  const input = $('#searchboxInput');

  const resultsDiv = $('#searchboxResults');

  const render = (hits: SearchHit[]) => {
    if (!hits || hits.length === 0) {
      resultsDiv.html('<div class="text-muted" style="padding:8px">No matches.</div>');
      return;
    }
    const ul = $('<ul class="list-group" style="margin-bottom:0"></ul>');
    for (const hit of hits) {
      const rec = hit.record;
      const srcName = rec.source;
      const kindIcon = rec.kind === 'func' ? 'ƒ' :
        rec.kind === 'macro' ? '#' :
        rec.kind === 'label' ? ':' :
        rec.kind === 'struct' ? 'S' :
        rec.kind === 'enum' ? 'E' :
        rec.kind === 'text' ? '≡' : '•';
      const loc = rec.file && rec.line ? `${rec.file}:${rec.line}` : (rec.file || '');
      const li = $('<li class="list-group-item search-hit" style="cursor:pointer;padding:6px 10px"></li>');
      li.html(
        `<span class="search-kind" style="margin-right:6px;font-weight:bold">${kindIcon}</span>` +
        `<strong>${escapeHtml(rec.name)}</strong>` +
        (rec.brief ? ` <span class="text-muted">- ${escapeHtml(rec.brief)}</span>` : '') +
        `<span class="pull-right text-muted" style="font-size:small">${escapeHtml(srcName)}${loc ? ' · ' + escapeHtml(loc) : ''}</span>`
      );
      li.click(() => {
        openSearchHit(hit);
        bootbox.hideAll();
      });
      ul.append(li);
    }
    resultsDiv.empty().append(ul);
  };

  const doSearch = debounce(async () => {
    const needle = input.val() as string;
    if (!needle) {
      resultsDiv.empty();
      return;
    }
    try {
      const hits = await searchService.query(needle, MAX_RESULTS);
      render(hits);
    } catch (e) {
      resultsDiv.html('<div class="text-danger" style="padding:8px">Search failed.</div>');
    }
  }, 150);

  input.on('input', doSearch);
  input.on('keydown', (e) => {
    if (e.key === 'Enter') doSearch();
  });
}