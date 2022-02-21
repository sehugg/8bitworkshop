"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const emu_1 = require("../common/emu");
const notebook_1 = require("../common/script/ui/notebook");
class ScriptingPlatform {
    constructor(mainElement) {
        this.mainElement = mainElement;
        this.notebook = new notebook_1.Notebook(document, mainElement);
    }
    start() {
    }
    reset() {
    }
    pause() {
    }
    resume() {
    }
    loadROM(title, run) {
        this.notebook.updateCells(run.cells);
        // TODO: save state file
    }
    isRunning() {
        return true;
    }
    isDebugging() {
        return false;
    }
    getToolForFilename(fn) {
        return "js";
    }
    getDefaultExtension() {
        return ".js";
    }
    getPresets() {
        return [];
    }
}
emu_1.PLATFORMS['script'] = ScriptingPlatform;
//# sourceMappingURL=script.js.map