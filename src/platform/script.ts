
import { PLATFORMS } from "../emu";
import { Platform } from "../baseplatform";

// TODO: scripts run in global context

class NotebookItem {
  obj: any;
  el: JQuery<HTMLElement>;
  wrap: JQuery<HTMLElement>;
  
  setData(data: any) {
    this.obj = data;
    this.el = $("<div>");
    this.el.text(JSON.stringify(data, null, ' '));
    return true;
  }
  delete() {
    this.wrap && this.wrap.remove();
    this.wrap = null;
  }
}

class Notebook {
  top: HTMLElement;
  items: {[id:string]:NotebookItem};
  
  constructor(top: HTMLElement) {
    this.items = {};
    this.top = top;
    $(top).css('overflowY', 'auto');
  }
  update(obj: any) {
    var last = null;
    var unused = new Set<string>(Object.keys(this.items));
    for (var entry of Object.entries(obj)) {
      var id = entry[0];
      var data = entry[1];
      var item = this.items[id];
      //console.log(id,data,item);
      if (!item) {
        this.items[id] = item = new NotebookItem();
      }
      if (item.setData(data)) {
        if (!item.wrap) {
          item.wrap = $('<div class="markdown">');
          $(this.top).append(item.wrap);
        }
        item.wrap.empty().append(item.el);
      }
      unused.delete(id);
    }
    unused.forEach((id) => { this.items[id].delete(); });
  }
}

class ScriptPlatform implements Platform {
  mainElement;
  htmlDiv;
  notebook: Notebook;

  constructor(mainElement:HTMLElement) {
    this.mainElement = mainElement;
    this.notebook = new Notebook(mainElement);
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
    this.notebook.update(data);
  }
  isRunning() {
    return false;
  }
  isDebugging() : boolean {
    return false;
  }
  getToolForFilename(fn : string) : string {
    return "js";
  }
  getDefaultExtension() : string {
    return ".js";
  }
  getPresets() {
    return [
      {id:'hello.js', name:'Hello'},
    ];
  }
  /*
  showHelp() {
    window.open("https://github.com/showdownjs/showdown/wiki/Showdown's-Script-syntax", "_help");
  }
  */
}

PLATFORMS['script'] = ScriptPlatform;
