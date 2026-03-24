"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.debugHighlightTagsCompartment = exports.tabsToSpacesCompartment = exports.closeBracketsCompartment = exports.tabSizeCompartment = exports.highlightTrailingWhitespaceCompartment = exports.highlightWhitespaceCompartment = exports.highlightSpecialCharsCompartment = void 0;
exports.loadSettings = loadSettings;
exports.saveSettings = saveSettings;
exports.settingsExtensions = settingsExtensions;
exports.registerEditor = registerEditor;
exports.unregisterEditor = unregisterEditor;
exports.applySettingsToAll = applySettingsToAll;
exports.openSettings = openSettings;
const autocomplete_1 = require("@codemirror/autocomplete");
const language_1 = require("@codemirror/language");
const state_1 = require("@codemirror/state");
const view_1 = require("@codemirror/view");
const debug_1 = require("./views/debug");
const tabs_1 = require("./views/tabs");
exports.highlightSpecialCharsCompartment = new state_1.Compartment();
exports.highlightWhitespaceCompartment = new state_1.Compartment();
exports.highlightTrailingWhitespaceCompartment = new state_1.Compartment();
exports.tabSizeCompartment = new state_1.Compartment();
exports.closeBracketsCompartment = new state_1.Compartment();
exports.tabsToSpacesCompartment = new state_1.Compartment();
exports.debugHighlightTagsCompartment = new state_1.Compartment();
const SETTINGS_KEY = "8bitworkshop/editorSettings";
const defaultSettings = {
    tabSize: 8,
    tabsToSpaces: true,
    highlightSpecialChars: false,
    highlightWhitespace: false,
    highlightTrailingWhitespace: false,
    closeBrackets: false,
    debugHighlightTags: false,
};
function loadSettings() {
    try {
        var stored = localStorage.getItem(SETTINGS_KEY);
        if (stored) {
            return Object.assign(Object.assign({}, defaultSettings), JSON.parse(stored));
        }
    }
    catch (e) { }
    return Object.assign({}, defaultSettings);
}
function saveSettings(settings) {
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
}
const compartmentValues = [
    [exports.tabSizeCompartment, s => [state_1.EditorState.tabSize.of(s.tabSize), language_1.indentUnit.of(" ".repeat(s.tabSize))]],
    [exports.tabsToSpacesCompartment, s => view_1.keymap.of(s.tabsToSpaces ? tabs_1.smartIndentKeymap : tabs_1.insertTabKeymap)],
    [exports.highlightSpecialCharsCompartment, s => s.highlightSpecialChars ? (0, view_1.highlightSpecialChars)() : []],
    [exports.highlightWhitespaceCompartment, s => s.highlightWhitespace ? (0, view_1.highlightWhitespace)() : []],
    [exports.highlightTrailingWhitespaceCompartment, s => s.highlightTrailingWhitespace ? (0, view_1.highlightTrailingWhitespace)() : []],
    [exports.closeBracketsCompartment, s => s.closeBrackets ? [(0, autocomplete_1.closeBrackets)(), view_1.keymap.of([{ key: "Backspace", run: autocomplete_1.deleteBracketPair }])] : []],
    [exports.debugHighlightTagsCompartment, s => s.debugHighlightTags ? debug_1.debugHighlightTagsTooltip : []],
];
function settingsExtensions(settings) {
    return compartmentValues.map(([c, fn]) => c.of(fn(settings)));
}
// Track all active editor views so we can reconfigure them
const activeEditors = new Set();
function registerEditor(editor) {
    activeEditors.add(editor);
}
function unregisterEditor(editor) {
    activeEditors.delete(editor);
}
function applySettingsToAll(settings) {
    var effects = compartmentValues.map(([c, fn]) => c.reconfigure(fn(settings)));
    for (var editor of activeEditors) {
        editor.dispatch({ effects });
    }
}
function openSettings() {
    var settings = loadSettings();
    bootbox.dialog({
        onEscape: true,
        title: "Settings",
        message: `<form id="settingsForm" onsubmit="return false">
       <h5>Editor preferences</h5>
       <div class="form-group"><label>Tab size: <input type="number" id="setting_tabSize" min="1" max="40" value="${settings.tabSize}" style="width:4em"></label></div>
       <div class="checkbox"><label><input type="checkbox" id="setting_tabsToSpaces" ${settings.tabsToSpaces ? 'checked' : ''}> Insert spaces when pressing TAB</label></div>
       <div class="checkbox"><label><input type="checkbox" id="setting_highlightSpecialChars" ${settings.highlightSpecialChars ? 'checked' : ''}> Highlight special characters</label></div>
       <div class="checkbox"><label><input type="checkbox" id="setting_highlightWhitespace" ${settings.highlightWhitespace ? 'checked' : ''}> Highlight whitespace</label></div>
       <div class="checkbox"><label><input type="checkbox" id="setting_highlightTrailingWhitespace" ${settings.highlightTrailingWhitespace ? 'checked' : ''}> Highlight unwanted trailing whitespace</label></div>
       <div class="checkbox"><label><input type="checkbox" id="setting_closeBrackets" ${settings.closeBrackets ? 'checked' : ''}> Automatically add and remove closing brackets</label></div>
       <hr>
       <h5>8bitworkshop IDE internal settings</h5>
       <div class="checkbox"><label><input type="checkbox" id="setting_debugHighlightTags" ${settings.debugHighlightTags ? 'checked' : ''}> Debug editor syntax highlighting tags</label></div>
      </form>`,
        buttons: {
            cancel: {
                label: "Cancel",
                className: "btn-default"
            },
            ok: {
                label: "SAVE",
                className: "btn-primary",
                callback: () => {
                    settings.tabSize = parseInt($('#setting_tabSize').val()) || 8;
                    settings.tabsToSpaces = $('#setting_tabsToSpaces').is(':checked');
                    settings.highlightSpecialChars = $('#setting_highlightSpecialChars').is(':checked');
                    settings.highlightWhitespace = $('#setting_highlightWhitespace').is(':checked');
                    settings.highlightTrailingWhitespace = $('#setting_highlightTrailingWhitespace').is(':checked');
                    settings.closeBrackets = $('#setting_closeBrackets').is(':checked');
                    settings.debugHighlightTags = $('#setting_debugHighlightTags').is(':checked');
                    saveSettings(settings);
                    applySettingsToAll(settings);
                }
            }
        }
    });
}
//# sourceMappingURL=settings.js.map