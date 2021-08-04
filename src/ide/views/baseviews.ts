
import { CodeAnalyzer } from "../../common/analysis";
import { SourceFile, WorkerError } from "../../common/workertypes";

export interface ProjectView {
    createDiv(parent: HTMLElement): HTMLElement;
    setVisible?(showing: boolean): void;
    refresh(moveCursor: boolean): void;
    tick?(): void;
    getPath?(): string;
    getValue?(): string;
    setText?(text: string): void;
    insertText?(text: string): void;
    getCursorPC?(): number;
    getSourceFile?(): SourceFile;
    setGutterBytes?(line: number, s: string): void;
    markErrors?(errors: WorkerError[]): void;
    clearErrors?(): void;
    setTimingResult?(result: CodeAnalyzer): void;
    recreateOnResize?: boolean;
    undoStep?(): void;
};

// detect mobile (https://stackoverflow.com/questions/3514784/what-is-the-best-way-to-detect-a-mobile-device)
export var isMobileDevice = window.matchMedia && window.matchMedia("only screen and (max-width: 760px)").matches;

export function newDiv(parent?, cls?: string) {
    var div = $(document.createElement("div"));
    if (parent) div.appendTo(parent)
    if (cls) div.addClass(cls);
    return div;
}

