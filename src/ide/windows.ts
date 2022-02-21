
import $ = require("jquery");
import { CodeProject } from "./project";
import { WorkerError, FileData } from "../common/workertypes";
import { getFilenamePrefix, getFilenameForPath } from "../common/util";
import { ProjectView } from "./views/baseviews";

type WindowCreateFunction = (id:string) => ProjectView;
type WindowShowFunction = (id:string, view:ProjectView) => void;

export class ProjectWindows {
  containerdiv : HTMLElement;
  project : CodeProject;
  id2window : {[id:string]:ProjectView} = {};
  id2createfn : {[id:string]:WindowCreateFunction} = {};
  id2showfn : {[id:string]:WindowShowFunction} = {};
  id2div : {[id:string]:HTMLElement} = {};
  activeid : string;
  activewnd : ProjectView;
  activediv : HTMLElement;
  lasterrors : WorkerError[];
  undofiles : string[];

  constructor(containerdiv:HTMLElement, project:CodeProject) {
    this.containerdiv = containerdiv;
    this.project = project;
    this.undofiles = [];
  }
  // TODO: delete windows ever?

  isWindow(id:string) : boolean {
    return this.id2createfn[id] != null;
  }

  setCreateFunc(id:string, createfn:WindowCreateFunction) : void {
    this.id2createfn[id] = createfn;
  }
  
  setShowFunc(id:string, showfn:WindowShowFunction) : void {
    this.id2showfn[id] = showfn;
  }

  create(id:string) : ProjectView {
    var wnd = this.id2window[id];
    if (!wnd) {
      console.log("creating window",id);
      wnd = this.id2window[id] = this.id2createfn[id](id);
    }
    var div = this.id2div[id];
    if (!div) {
      div = this.id2div[id] = wnd.createDiv(this.containerdiv);
      $(div).hide();
    }
    return wnd;
  }

  createOrShow(id: string, moveCursor?: boolean) : ProjectView {
    var wnd = this.create(id);
    var div = this.id2div[id];
    if (this.activewnd != wnd) {
      this.activediv && $(this.activediv).hide();
      this.activewnd && this.activewnd.setVisible && this.activewnd.setVisible(false);
      this.activediv = div;
      this.activewnd = wnd;
      $(div).show();
      this.refresh(true); // needed to tell asset editor 1st time running, but that's bad
      this.refreshErrors();
      wnd.setVisible && wnd.setVisible(true);
      this.id2showfn[id] && this.id2showfn[id](id, wnd);
    } else {
      this.refresh(moveCursor);
    }
    this.activeid = id;
    return wnd;
  }

  put(id:string, window:ProjectView) : void {
    this.id2window[id] = window;
  }

  refresh(moveCursor:boolean) : void {
    // refresh current window
    if (this.activewnd && this.activewnd.refresh)
      this.activewnd.refresh(moveCursor);
  }

  tick() : void {
    if (this.activewnd && this.activewnd.tick)
      this.activewnd.tick();
  }

  setErrors(errors:WorkerError[]) : void {
    this.lasterrors = errors;
    this.refreshErrors();
  }

  refreshErrors() : void {
    if (this.activewnd && this.activewnd.markErrors) {
      if (this.lasterrors && this.lasterrors.length)
        this.activewnd.markErrors(this.lasterrors);
      else
        this.activewnd.clearErrors();
    }
  }

  getActive() : ProjectView { return this.activewnd; }

  getActiveID() : string { return this.activeid; }

  getCurrentText() : string {
    if (this.activewnd && this.activewnd.getValue)
      return this.activewnd.getValue();
    else
      bootbox.alert("Please switch to an editor window.");
  }

  resize() : void {
    if (this.activeid && this.activewnd && this.activewnd.recreateOnResize) {
      this.activewnd = null;
      this.id2window[this.activeid] = null;
      this.id2div[this.activeid] = null;
      this.createOrShow(this.activeid);
    }
  }

  updateFile(fileid:string, data:FileData) {
    // is there an editor? if so, use it
    var wnd = this.id2window[fileid];
    if (wnd && wnd.setText && typeof data === 'string') {
      wnd.setText(data);
      this.undofiles.push(fileid);
    } else {
      this.project.updateFile(fileid, data);
    }
  }
  
  undoStep() {
    var fileid = this.undofiles.pop();
    var wnd = this.id2window[fileid];
    if (wnd && wnd.undoStep) {
      wnd.undoStep();
    } else {
      bootbox.alert("No more steps to undo.");
    }
  }

  updateAllOpenWindows(store) {
    for (var fileid in this.id2window) {
      var wnd = this.id2window[fileid];
      if (wnd && wnd.setText) {
        store.getItem(fileid).then((data) => {
          this.updateFile(fileid, data);
        });
      }
    }
  }

  findWindowWithFilePrefix(filename : string) : string {
    filename = getFilenameForPath(getFilenamePrefix(filename));
    for (var fileid in this.id2createfn) {
      // ignore include files (TODO)
      if (fileid.toLowerCase().endsWith('.h') || fileid.toLowerCase().endsWith('.inc')  || fileid.toLowerCase().endsWith('.bas'))
        continue;
      if (getFilenameForPath(getFilenamePrefix(fileid)) == filename) return fileid;
    }
    return null;
  }
};
