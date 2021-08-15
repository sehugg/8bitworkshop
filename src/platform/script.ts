
import { PLATFORMS, RasterVideo } from "../common/emu";
import { Platform } from "../common/baseplatform";
import { RunResult } from "../common/script/env";
import { Notebook } from "../common/script/ui/notebook";

class ScriptingPlatform implements Platform {
    mainElement: HTMLElement;
    iframe: HTMLIFrameElement;
    notebook: Notebook;

    constructor(mainElement: HTMLElement) {
        this.mainElement = mainElement;
        /*
        // https://developer.mozilla.org/en-US/docs/Web/HTML/Element/iframe
        this.iframe = $(`<iframe sandbox="allow-same-origin" width="100%" height="100%"/>`).appendTo(mainElement)[0] as HTMLIFrameElement;
        mainElement.classList.add("vertical-scroll"); //100% height
        mainElement.style.overflowY = 'auto';
        this.iframe.onload = (e) => {
            let head = this.iframe.contentDocument.head;
            head.appendChild($(`<link rel="stylesheet" href="css/script.css">`)[0]);
        };
        */
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
    /*
    showHelp() {
      window.open("https://github.com/showdownjs/showdown/wiki/Showdown's-Markdown-syntax", "_help");
    }
    */
}

PLATFORMS['script'] = ScriptingPlatform;
