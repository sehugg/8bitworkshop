
import { PLATFORMS } from "../common/emu";
import { Platform } from "../common/baseplatform";
import { RunResult } from "../common/script/env";
import { Notebook } from "../common/script/ui/notebook";

class ScriptingPlatform implements Platform {
    mainElement: HTMLElement;
    iframe: HTMLIFrameElement;
    notebook: Notebook;

    constructor(mainElement: HTMLElement) {
        this.mainElement = mainElement;
        this.notebook = new Notebook(document, mainElement);
    }
    start() {
    }
    reset() {
    }
    pause() {
    }
    resume() {
    }
    loadROM(title, run: RunResult) {
        this.notebook.updateCells(run.cells);
        // TODO: save state file
    }
    isRunning() {
        return true;
    }
    isDebugging(): boolean {
        return false;
    }
    getToolForFilename(fn: string): string {
        return "js";
    }
    getDefaultExtension(): string {
        return ".js";
    }
    getPresets() {
        return [
        ];
    }
}

PLATFORMS['script'] = ScriptingPlatform;
