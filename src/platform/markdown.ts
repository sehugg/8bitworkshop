"use strict";

import { PLATFORMS } from "../common/emu";
import { Platform } from "../common/baseplatform";

class MarkdownPlatform implements Platform {
  mainElement;
  htmlDiv;

  constructor(mainElement:HTMLElement) {
    this.mainElement = mainElement;
    this.htmlDiv = $('<div class="markdown">').appendTo(mainElement);
    $(mainElement).css('overflowY', 'auto');
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
    this.htmlDiv.html(data);
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
