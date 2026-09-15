// Pane layout for the IDE.
//
// On wide screens the sidebar, editor and emulator sit side by side as three
// resizable panes (Split.js). On small screens they become a tab bar instead,
// showing one pane at a time; switching tabs just moves the splits
// programmatically with setSizes() (hence the zero minSize in tab mode).

import Split = require('split.js');
import { isMobileDevice } from "./views/baseviews";

declare var $: JQueryStatic; // use browser jquery

// panes, in Split.js order
const PANES = ['#sidebar', '#workspace', '#emulator'];
// split sizes for each tab (collapse the other two)
const TAB_SIZES = {
  sidebar: [100, 0, 0],
  editor: [0, 100, 0],
  emulator: [0, 0, 100],
};

// ui.ts injects these so this module doesn't have to import (and cycle with) it
export interface LayoutHooks {
  getPlatformId(): string;
  isEmbed: boolean;
  hasLocalStorage: boolean;
  resizePlatform(): void;
  resizeWindows(): void;
  // tab mode only: the visible pane changed (e.g. 'sidebar', 'editor', 'emulator')
  onTabChanged?(tab: string): void;
}

var hooks: LayoutHooks = null;
// Split.js instance; kept around so tabs can move the splits
var notebookSplit: any = null;
// true when the panes are shown as tabs (one at a time) instead of side by side
var tabMode = false;
var activeTab = 'workspace';
// the side-by-side sizes to restore when we leave tab mode
var desktopSizes: number[] = null;
var splitStorageName: string = null;
// live query (isMobileDevice in baseviews is computed once at load and
// wouldn't react to rotating the device or resizing the window)
var mobileMediaQuery = (typeof window !== 'undefined' && window.matchMedia)
  ? window.matchMedia("only screen and (max-width: 760px)") : null;
var wired = false;

function isTabLayout(): boolean {
  return mobileMediaQuery ? mobileMediaQuery.matches : isMobileDevice;
}

function createSplit(sizes: number[]) {
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
      if (!tabMode && hooks.hasLocalStorage) localStorage.setItem(splitStorageName, JSON.stringify(notebookSplit.getSizes()))
      hooks.resizeWindows();
    },
  });
}

function applyTabSizes() {
  notebookSplit.setSizes(TAB_SIZES[activeTab] || TAB_SIZES.editor);
}

function setActiveTabClass(tab: string) {
  activeTab = TAB_SIZES[tab] ? tab : 'editor';
  $("#mobiletabs .mobiletab").removeClass("active");
  $("#mobiletabs .mobiletab[data-tab='" + activeTab + "']").addClass("active");
  $("#sidebar,#workspace,#emulator").removeClass("active");
  var sel = activeTab === 'sidebar' ? '#sidebar' : activeTab === 'emulator' ? '#emulator' : '#workspace';
  $(sel).addClass("active");
  // only meaningful in tab mode; on desktop all panes stay visible
  if (tabMode && hooks && hooks.onTabChanged) hooks.onTabChanged(activeTab);
}

function setTabMode(on: boolean) {
  tabMode = on;
  if (typeof document === 'undefined') return;
  $("body").toggleClass("tab-layout", on);
}

export function showTab(tab: string) {
  setActiveTabClass(tab);
  if (!tabMode || !notebookSplit) return;
  applyTabSizes();
  // the revealed pane was 0px wide; let it relayout once it's visible
  setTimeout(() => {
    if (activeTab === 'emulator') hooks.resizePlatform();
    if (activeTab === 'editor') hooks.resizeWindows();
  }, 0);
}

function updateSplitLayout() {
  var wantTabs = isTabLayout();
  if (wantTabs === tabMode) return;
  if (wantTabs) {
    // entering tab mode: remember the side-by-side sizes, recreate with 0 mins
    if (notebookSplit) desktopSizes = notebookSplit.getSizes();
    setTabMode(true);
    createSplit(desktopSizes || [0, 55, 45]);
    showTab(activeTab);
  } else {
    // leaving tab mode: restore the side-by-side panes and their sizes
    setTabMode(false);
    $("#sidebar,#workspace,#emulator").removeClass("active");
    // all panes are visible again; let the emulator resume if a tab hid it
    if (hooks && hooks.onTabChanged) hooks.onTabChanged('emulator');
    createSplit(desktopSizes || [12, 44, 44]);
    hooks.resizePlatform();
    hooks.resizeWindows();
  }
}

export function setupSplits(h: LayoutHooks) {
  hooks = h;
  var platform_id = hooks.getPlatformId();
  splitStorageName = 'workspace-split3-' + platform_id;
  if (hooks.isEmbed) splitStorageName = 'embed-' + splitStorageName;
  var sizes;
  if (platform_id.startsWith('vcs'))
    sizes = [0, 50, 50];
  else if (hooks.isEmbed || isMobileDevice)
    sizes = [0, 55, 45];
  else
    sizes = [12, 44, 44];
  var sizesStr = hooks.hasLocalStorage && localStorage.getItem(splitStorageName);
  if (sizesStr) {
    try {
      sizes = JSON.parse(sizesStr);
    } catch (e) { console.log(e); }
  }
  if (isTabLayout()) desktopSizes = sizes; // these came from localStorage; keep them for desktop
  setTabMode(isTabLayout());
  createSplit(sizes);
  if (tabMode) {
    applyTabSizes();
    setActiveTabClass(activeTab);
  } else {
    $("#sidebar,#workspace,#emulator").removeClass("active");
  }
  if (!wired) {
    wired = true;
    $("#mobiletabs").on("click", ".mobiletab", function () {
      showTab($(this).attr("data-tab"));
    });
    // picking a window from the sidebar should reveal the workspace pane
    // (every sidebar entry opens a window there); no-op outside tab mode
    $("#sidebar").on("click", "a", function () {
      showTab("editor");
    });
    if (mobileMediaQuery) {
      if (mobileMediaQuery.addEventListener) mobileMediaQuery.addEventListener("change", updateSplitLayout);
      else if (mobileMediaQuery.addListener) mobileMediaQuery.addListener(updateSplitLayout);
    }
  }
}
