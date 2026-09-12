"use strict";
/**
 * Search View - bootbox-based palette for searching project files,
 * toolchain headers, and docs. Opens an overlay dialog with a live
 * input; results are clickable and open the associated file/header.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.openSearchHit = openSearchHit;
exports.openSearchDialog = openSearchDialog;
const service_1 = require("./service");
const util_1 = require("../../common/util");
const ui_1 = require("../ui");
const editors_1 = require("../views/editors");
const debugviews_1 = require("../views/debugviews");
const debuggerhit_1 = require("./debuggerhit");
/** Debounce helper */
function debounce(fn, ms) {
    let timer = null;
    return () => {
        if (timer)
            clearTimeout(timer);
        timer = setTimeout(fn, ms);
    };
}
/** Max results shown in the palette */
const MAX_RESULTS = 30;
function escapeHtml(s) {
    return String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}
/** Open the file/header/doc associated with a search hit. */
function openSearchHit(hit) {
    var _a;
    const rec = hit.record;
    if (rec.source === 'project') {
        // Open a project file at the matching line
        const path = rec.file;
        if (!path || !ui_1.projectWindows.isWindow(path))
            return;
        const wnd = ui_1.projectWindows.createOrShow(path);
        if (wnd instanceof editors_1.SourceEditor && rec.line) {
            wnd.navigateToLine(rec.line);
        }
    }
    else if (rec.source === 'toolchain') {
        // Open a shared header file
        const fn = rec.file;
        if (!fn)
            return;
        (0, ui_1.openHeaderFile)(fn);
        const wnd = ui_1.projectWindows.createOrShow('#headerview/' + fn);
        if (wnd instanceof editors_1.HeaderView && rec.line) {
            wnd.navigateToLine(rec.line);
        }
    }
    else if (rec.source === 'debugger') {
        // Runtime symbol/address with no source: jump to it in the
        // disassembler (code segments) or memory browser (everything else)
        const addr = (_a = rec.addr) !== null && _a !== void 0 ? _a : -1;
        if (addr < 0)
            return;
        if (rec.kind === 'label' && ui_1.projectWindows.isWindow('#disasm')) {
            const wnd = ui_1.projectWindows.createOrShow('#disasm');
            if (wnd instanceof editors_1.DisassemblerView)
                wnd.goToAddress(addr);
        }
        else {
            const wnd = ui_1.projectWindows.createOrShow('#memory');
            if (wnd instanceof debugviews_1.MemoryView)
                wnd.goToAddress(addr);
        }
    }
    else if (rec.source === 'docs') {
        // In-IDE help pages route through ProjectWindows; anything else is an
        // external URL opened in a new tab.
        const url = rec.url || '';
        if (url.startsWith('#help/')) {
            ui_1.projectWindows.createOrShow(url);
        }
        else if (url) {
            window.open(url, '_blank');
        }
    }
}
function openSearchDialog() {
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
    let currentHits = [];
    let selectedIdx = -1;
    /** Highlight the list item at index i (or none if i < 0). */
    const selectRow = (i) => {
        selectedIdx = Math.max(-1, Math.min(i, currentHits.length - 1));
        resultsDiv.find('li.search-hit').each((j, el) => {
            $(el).toggleClass('active', j === selectedIdx);
        });
        if (selectedIdx >= 0) {
            const box = resultsDiv[0];
            const li = resultsDiv.find('li.search-hit').eq(selectedIdx);
            if (li.length) {
                const item = li[0];
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
                }
                else if (relTop + itemRect.height > boxRect.height) {
                    // selected item below the visible area: scroll down to reveal it
                    box.scrollTop += relTop + itemRect.height - boxRect.height;
                }
            }
        }
    };
    /** Open the currently selected (or given) hit. */
    const openSelected = (i = selectedIdx) => {
        const hit = currentHits[i];
        if (!hit)
            return;
        openSearchHit(hit);
        bootbox.hideAll();
    };
    const render = (hits) => {
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
            const loc = rec.source === 'debugger' ? (0, util_1.hex)(rec.addr, 4)
                : rec.file && rec.line ? `${rec.file}:${rec.line}` : (rec.file || '');
            const isSmart = rec.kind !== 'text';
            const li = $('<li class="list-group-item search-hit" style="cursor:pointer;padding:6px 10px;display:flex;align-items:center;overflow:hidden"></li>');
            li.html(`<span class="search-kind" style="margin-right:6px;font-weight:bold;flex:0 0 auto">${kindIcon}</span>` +
                `<span class="search-name" style="flex:1 1 auto;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">` +
                (isSmart ? `<strong>${escapeHtml(rec.name)}</strong>` : `<span class="search-dumb">${escapeHtml(rec.name)}</span>`) +
                (rec.brief ? ` <span class="text-muted">- ${escapeHtml(rec.brief)}</span>` : '') +
                `</span>` +
                `<span class="search-loc" style="flex:0 0 auto;margin-left:8px;font-style:italic;font-size:small;white-space:nowrap">${loc ? escapeHtml(loc) : ''}</span>`);
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
        const needle = input.val();
        if (!needle) {
            currentHits = [];
            selectedIdx = -1;
            resultsDiv.empty();
            return;
        }
        try {
            const hits = await service_1.searchService.query(needle, MAX_RESULTS);
            // offer a jump to the emulator views for runtime symbols/addresses;
            // exact symbol matches always appear (below source hits), raw hex
            // addresses only when there are no source hits
            const target = (0, debuggerhit_1.resolveDebuggerTarget)(needle, ui_1.platform && ui_1.platform.debugSymbols && ui_1.platform.debugSymbols.symbolmap);
            if (target && (0, debuggerhit_1.shouldOfferDebuggerHit)(target, hits.length > 0)) {
                hits.push((0, debuggerhit_1.makeDebuggerHit)(needle, target, ui_1.current_project && ui_1.current_project.segments));
            }
            render(hits);
        }
        catch (e) {
            resultsDiv.html('<div class="text-danger" style="padding:8px">Search failed.</div>');
        }
    }, 150);
    input.on('input', doSearch);
    input.on('keydown', (e) => {
        if (e.key === 'ArrowDown') {
            e.preventDefault();
            selectRow(selectedIdx + 1);
        }
        else if (e.key === 'ArrowUp') {
            e.preventDefault();
            selectRow(selectedIdx - 1);
        }
        else if (e.key === 'Enter') {
            e.preventDefault();
            if (selectedIdx >= 0) {
                openSelected();
            }
            else {
                doSearch();
            }
        }
        else if (e.key === 'Home') {
            e.preventDefault();
            selectRow(0);
        }
        else if (e.key === 'End') {
            e.preventDefault();
            selectRow(currentHits.length - 1);
        }
    });
}
//# sourceMappingURL=searchview.js.map