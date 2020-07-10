"use strict";

import { PLATFORMS } from "../common/emu";
import { Platform } from "../common/baseplatform";

class MarkdownPlatform implements Platform {
  mainElement : HTMLElement;
  iframe : HTMLIFrameElement;

  constructor(mainElement:HTMLElement) {
    this.mainElement = mainElement;
    this.iframe = $('<iframe sandbox seamless src="javascript:void(0);" width="100%" height="100%"/>').appendTo(mainElement)[0] as HTMLIFrameElement;
    //this.iframe = $('<iframe sandbox src="res/markdown-iframe.html" width="100%" height="100%"/>').appendTo(mainElement)[0] as HTMLIFrameElement;
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
    // have to do this b/c sandboxed without same origin
    // TODO: preserve scroll position
    if (this.iframe.srcdoc)
      this.iframe.srcdoc = data;
    else
      this.iframe.src = "data:text/html;charset=utf-8," + escape(data);
    //this.iframe.contentWindow.postMessage({body:data}, "*");
    //$(this.iframe).contents().find('body').html(data);
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
