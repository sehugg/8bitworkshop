/**
 * Search View - bootbox-based palette for searching project files,
 * toolchain headers, and docs. Opens an overlay dialog with a live
 * input; results are clickable and open the associated file/header.
 */

import { searchService } from "./service";
import { SearchHit } from "./types";
import { hex } from "../../common/util";
import { projectWindows, openHeaderFile, current_project, platform } from "../ui";
import { SourceEditor, HeaderView, DisassemblerView } from "../views/editors";
import { MemoryView } from "../views/debugviews";
import { resolveDebuggerTarget, makeDebuggerHit, shouldOfferDebuggerHit } from "./debuggerhit";

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
  } else if (rec.source === 'debugger') {
    // Runtime symbol/address with no source: jump to it in the
    // disassembler (code segments) or memory browser (everything else)
    const addr = rec.addr ?? -1;
    if (addr < 0) return;
    if (rec.kind === 'label' && projectWindows.isWindow('#disasm')) {
      const wnd = projectWindows.createOrShow('#disasm');
      if (wnd instanceof DisassemblerView) wnd.goToAddress(addr);
    } else {
      const wnd = projectWindows.createOrShow('#memory');
      if (wnd instanceof MemoryView) wnd.goToAddress(addr);
    }
  } else if (rec.source === 'docs') {
    // In-IDE help pages route through ProjectWindows; anything else is an
    // external URL opened in a new tab.
    const url = rec.url || '';
    if (url.startsWith('#help/')) {
      projectWindows.createOrShow(url);
    } else if (url) {
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
               placeholder="Search symbols, files, docs"
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

  // Current result list + selection index (for arrow-key navigation).
  let currentHits: SearchHit[] = [];
  let selectedIdx = -1;

  /** Highlight the list item at index i (or none if i < 0). */
  const selectRow = (i: number) => {
    selectedIdx = Math.max(-1, Math.min(i, currentHits.length - 1));
    resultsDiv.find('li.search-hit').each((j, el) => {
      $(el).toggleClass('active', j === selectedIdx);
    });
    if (selectedIdx >= 0) {
      const box = resultsDiv[0] as HTMLElement;
      const li = resultsDiv.find('li.search-hit').eq(selectedIdx);
      if (li.length) {
        const item = li[0] as HTMLElement;
        // Compare the item against the scroll container using viewport-relative
        // rects. offsetTop is measured from the nearest positioned ancestor
        // (the bootstrap modal is position:fixed), so it can't be compared
        // with box.scrollTop directly.
        const boxRect = box.getBoundingClientRect();
        const itemRect = item.getBoundingClientRect();
        const relTop = itemRect.top - boxRect.top;
        if (relTop < 0) {
          // selected item above the visible area: scroll up to reveal it
          box.scrollTop += relTop;
        } else if (relTop + itemRect.height > boxRect.height) {
          // selected item below the visible area: scroll down to reveal it
          box.scrollTop += relTop + itemRect.height - boxRect.height;
        }
      }
    }
  };

  /** Open the currently selected (or given) hit. */
  const openSelected = (i: number = selectedIdx) => {
    const hit = currentHits[i];
    if (!hit) return;
    openSearchHit(hit);
    bootbox.hideAll();
  };

  const render = (hits: SearchHit[]) => {
    currentHits = hits || [];
    if (currentHits.length === 0) {
      selectedIdx = -1;
      resultsDiv.html('<div class="text-muted" style="padding:8px">No matches.</div>');
      return;
    }
    const ul = $('<ul class="list-group" style="margin-bottom:0"></ul>');
    for (const hit of currentHits) {
      const rec = hit.record;
      const srcName = rec.source;
      const kindIcon = rec.kind === 'func' ? 'ƒ' :
        rec.kind === 'macro' ? '#' :
        rec.kind === 'label' ? ':' :
        rec.kind === 'struct' ? 'S' :
        rec.kind === 'enum' ? 'E' :
        rec.kind === 'text' ? '≡' : '•';
      const loc = rec.source === 'debugger' ? hex(rec.addr, 4)
        : rec.file && rec.line ? `${rec.file}:${rec.line}` : (rec.file || '');
      const isSmart = rec.kind !== 'text';
      const li = $('<li class="list-group-item search-hit" style="cursor:pointer;padding:6px 10px;display:flex;align-items:center;overflow:hidden"></li>');
      li.html(
        `<span class="search-kind" style="margin-right:6px;font-weight:bold;flex:0 0 auto">${kindIcon}</span>` +
        `<span class="search-name" style="flex:1 1 auto;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">` +
          (isSmart ? `<strong>${escapeHtml(rec.name)}</strong>` : `<span class="search-dumb">${escapeHtml(rec.name)}</span>`) +
          (rec.brief ? ` <span class="text-muted">- ${escapeHtml(rec.brief)}</span>` : '') +
        `</span>` +
        `<span class="search-loc" style="flex:0 0 auto;margin-left:8px;font-style:italic;font-size:small;white-space:nowrap">${loc ? escapeHtml(loc) : ''}</span>`
      );
      li.click(() => {
        openSelected(currentHits.indexOf(hit));
      });
      ul.append(li);
    }
    resultsDiv.empty().append(ul);
    // Auto-select the first result so Enter opens something immediately.
    selectRow(0);
  };

  const doSearch = debounce(async () => {
    const needle = input.val() as string;
    if (!needle) {
      currentHits = [];
      selectedIdx = -1;
      resultsDiv.empty();
      return;
    }
    try {
      const hits = await searchService.query(needle, MAX_RESULTS);
      // offer a jump to the emulator views for runtime symbols/addresses;
      // exact symbol matches always appear (below source hits), raw hex
      // addresses only when there are no source hits
      const target = resolveDebuggerTarget(needle, platform && platform.debugSymbols && platform.debugSymbols.symbolmap);
      if (target && shouldOfferDebuggerHit(target, hits.length > 0)) {
        hits.push(makeDebuggerHit(needle, target, current_project && current_project.segments));
      }
      render(hits);
    } catch (e) {
      resultsDiv.html('<div class="text-danger" style="padding:8px">Search failed.</div>');
    }
  }, 150);

  input.on('input', doSearch);
  input.on('keydown', (e) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      selectRow(selectedIdx + 1);
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      selectRow(selectedIdx - 1);
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (selectedIdx >= 0) {
        openSelected();
      } else {
        doSearch();
      }
    } else if (e.key === 'Home') {
      e.preventDefault();
      selectRow(0);
    } else if (e.key === 'End') {
      e.preventDefault();
      selectRow(currentHits.length - 1);
    }
  });
}