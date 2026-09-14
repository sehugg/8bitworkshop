"use strict";
// Pane layout for the IDE.
//
// On wide screens the sidebar, editor and emulator sit side by side as three
// resizable panes (Split.js). On small screens they become a tab bar instead,
// showing one pane at a time; switching tabs just moves the splits
// programmatically with setSizes() (hence the zero minSize in tab mode).
Object.defineProperty(exports, "__esModule", { value: true });
exports.showTab = showTab;
exports.setupSplits = setupSplits;
const Split = require("split.js");
const baseviews_1 = require("./views/baseviews");
// panes, in Split.js order
const PANES = ['#sidebar', '#workspace', '#emulator'];
// split sizes for each tab (collapse the other two)
const TAB_SIZES = {
    sidebar: [100, 0, 0],
    editor: [0, 100, 0],
    emulator: [0, 0, 100],
};
var hooks = null;
// Split.js instance; kept around so tabs can move the splits
var notebookSplit = null;
// true when the panes are shown as tabs (one at a time) instead of side by side
var tabMode = false;
var activeTab = 'workspace';
// the side-by-side sizes to restore when we leave tab mode
var desktopSizes = null;
var splitStorageName = null;
// live query (isMobileDevice in baseviews is computed once at load and
// wouldn't react to rotating the device or resizing the window)
var mobileMediaQuery = (typeof window !== 'undefined' && window.matchMedia)
    ? window.matchMedia("only screen and (max-width: 760px)") : null;
var wired = false;
function isTabLayout() {
    return mobileMediaQuery ? mobileMediaQuery.matches : baseviews_1.isMobileDevice;
}
function createSplit(sizes) {
    if (notebookSplit) {
        notebookSplit.destroy();
        notebookSplit = null;
    }
    notebookSplit = Split(PANES, {
        sizes: sizes,
        // tab mode collapses two panes to 0, so the desktop minSize can't apply
        minSize: tabMode ? [0, 0, 0] : [0, 250, 250],
        onDrag: () => {
            hooks.resizePlatform();
        },
        onDragEnd: () => {
            if (!tabMode && hooks.hasLocalStorage)
                localStorage.setItem(splitStorageName, JSON.stringify(notebookSplit.getSizes()));
            hooks.resizeWindows();
        },
    });
}
function applyTabSizes() {
    notebookSplit.setSizes(TAB_SIZES[activeTab] || TAB_SIZES.editor);
}
function setActiveTabClass(tab) {
    activeTab = TAB_SIZES[tab] ? tab : 'editor';
    $("#mobiletabs .mobiletab").removeClass("active");
    $("#mobiletabs .mobiletab[data-tab='" + activeTab + "']").addClass("active");
    $("#sidebar,#workspace,#emulator").removeClass("active");
    var sel = activeTab === 'sidebar' ? '#sidebar' : activeTab === 'emulator' ? '#emulator' : '#workspace';
    $(sel).addClass("active");
}
function setTabMode(on) {
    tabMode = on;
    if (typeof document === 'undefined')
        return;
    $("body").toggleClass("tab-layout", on);
}
function showTab(tab) {
    setActiveTabClass(tab);
    if (!tabMode || !notebookSplit)
        return;
    applyTabSizes();
    // the revealed pane was 0px wide; let it relayout once it's visible
    setTimeout(() => {
        if (activeTab === 'emulator')
            hooks.resizePlatform();
        if (activeTab === 'editor')
            hooks.resizeWindows();
    }, 0);
}
function updateSplitLayout() {
    var wantTabs = isTabLayout();
    if (wantTabs === tabMode)
        return;
    if (wantTabs) {
        // entering tab mode: remember the side-by-side sizes, recreate with 0 mins
        if (notebookSplit)
            desktopSizes = notebookSplit.getSizes();
        setTabMode(true);
        createSplit(desktopSizes || [0, 55, 45]);
        showTab(activeTab);
    }
    else {
        // leaving tab mode: restore the side-by-side panes and their sizes
        setTabMode(false);
        $("#sidebar,#workspace,#emulator").removeClass("active");
        createSplit(desktopSizes || [12, 44, 44]);
        hooks.resizePlatform();
        hooks.resizeWindows();
    }
}
function setupSplits(h) {
    hooks = h;
    var platform_id = hooks.getPlatformId();
    splitStorageName = 'workspace-split3-' + platform_id;
    if (hooks.isEmbed)
        splitStorageName = 'embed-' + splitStorageName;
    var sizes;
    if (platform_id.startsWith('vcs'))
        sizes = [0, 50, 50];
    else if (hooks.isEmbed || baseviews_1.isMobileDevice)
        sizes = [0, 55, 45];
    else
        sizes = [12, 44, 44];
    var sizesStr = hooks.hasLocalStorage && localStorage.getItem(splitStorageName);
    if (sizesStr) {
        try {
            sizes = JSON.parse(sizesStr);
        }
        catch (e) {
            console.log(e);
        }
    }
    if (isTabLayout())
        desktopSizes = sizes; // these came from localStorage; keep them for desktop
    setTabMode(isTabLayout());
    createSplit(sizes);
    if (tabMode) {
        applyTabSizes();
        setActiveTabClass(activeTab);
    }
    else {
        $("#sidebar,#workspace,#emulator").removeClass("active");
    }
    if (!wired) {
        wired = true;
        $("#mobiletabs").on("click", ".mobiletab", function () {
            showTab($(this).attr("data-tab"));
        });
        if (mobileMediaQuery) {
            if (mobileMediaQuery.addEventListener)
                mobileMediaQuery.addEventListener("change", updateSplitLayout);
            else if (mobileMediaQuery.addListener)
                mobileMediaQuery.addListener(updateSplitLayout);
        }
    }
}
//# sourceMappingURL=layout.js.map