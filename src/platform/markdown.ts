"use strict";

import { PLATFORMS } from "../common/emu";
import { Platform } from "../common/baseplatform";

class MarkdownPlatform implements Platform {
  mainElement : HTMLElement;
  iframe : HTMLIFrameElement;

  constructor(mainElement:HTMLElement) {
    this.mainElement = mainElement;
    this.iframe = $('<iframe sandbox="allow-same-origin" width="100%" height="100%"/>').appendTo(mainElement)[0] as HTMLIFrameElement;
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
  loadROM(title, data:string) {
    $(this.iframe).contents().find('body').html(data);
  }
  isRunning() {
    return false;
  }
  isDebugging() : boolean {
    return false;
  }
  getToolForFilename(fn : string) : string {
    return "markdown";
  }
  getDefaultExtension() : string {
    return ".md";
  }
  getPresets() {
    return [
      {id:'hello.md', name:'Hello'},
    ];
  }
  showHelp() {
    window.open("https://github.com/showdownjs/showdown/wiki/Showdown's-Markdown-syntax", "_help");
  }
}

PLATFORMS['markdown'] = MarkdownPlatform;
