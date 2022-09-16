"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const emu_1 = require("../common/emu");
class MarkdownPlatform {
    constructor(mainElement) {
        this.mainElement = mainElement;
        this.iframe = $('<iframe sandbox="allow-same-origin" width="100%" height="100%"/>').appendTo(mainElement)[0];
        this.iframe.style.backgroundColor = 'white';
        mainElement.classList.add("vertical-scroll"); //100% height
        mainElement.style.overflowY = 'auto';
    }
    start() {
    }
    reset() {
    }
    pause() {
    }
    resume() {
    }
    loadROM(title, data) {
        $(this.iframe).contents().find('body').html(data);
    }
    isRunning() {
        return false;
    }
    isDebugging() {
        return false;
    }
    getToolForFilename(fn) {
        return "markdown";
    }
    getDefaultExtension() {
        return ".md";
    }
    getPresets() {
        return [
            { id: 'hello.md', name: 'Hello' },
        ];
    }
    showHelp() {
        return "https://github.com/showdownjs/showdown/wiki/Showdown's-Markdown-syntax";
    }
}
emu_1.PLATFORMS['markdown'] = MarkdownPlatform;
//# sourceMappingURL=markdown.js.map