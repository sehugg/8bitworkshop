"use strict";

import $ = require("jquery");
import { CodeProject } from "./project";
import { WorkerError, FileData } from "./workertypes";
import { ProjectView } from "./views";

type WindowCreateFunction = (id:string) => ProjectView;

export class ProjectWindows {
  containerdiv : HTMLElement;
  project : CodeProject;
  id2window : {[id:string]:ProjectView} = {};
  id2createfn : {[id:string]:WindowCreateFunction} = {};
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

  setCreateFunc(id:string, createfn:WindowCreateFunction) : void {
    this.id2createfn[id] = createfn;
  }

  create(id:string) : ProjectView {
    var wnd = this.id2window[id];
    if (!wnd) {
      console.log("creating window",id);
      wnd = this.id2window[id] = this.id2createfn[id](id);
    }
    var div = this.id2div[id];
    if (!div) {
      var data = this.project.getFile(id)+""; // TODO: binary files
      div = this.id2div[id] = wnd.createDiv(this.containerdiv, data);
      $(div).hide();
    }
    return wnd;
  }

  createOrShow(id:string) : ProjectView {
    var wnd = this.create(id);
    var div = this.id2div[id];
    if (this.activewnd != wnd) {
      if (this.activediv)
        $(this.activediv).hide();
      if (this.activewnd && this.activewnd.setVisible)
        this.activewnd.setVisible(false);
      this.activediv = div;
      this.activewnd = wnd;
      $(div).show();
      this.refresh(true);
      this.refreshErrors();
      if (wnd.setVisible)
        wnd.setVisible(true);
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
      alert("Please switch to an editor window.");
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
    // is there an editor? we should create one...
    var wnd = this.create(fileid);
    if (wnd && wnd.setText && typeof data === 'string') {
      wnd.setText(data);
    } else {
      this.project.updateFile(fileid, data);
      if (wnd) {
        wnd.refresh(false);
      }
    }
    this.undofiles.push(fileid);
  }
  
  undoStep() {
    var fileid = this.undofiles.pop();
    var wnd = this.id2window[fileid];
    if (wnd && wnd.undoStep) {
      wnd.undoStep();
    } else {
      alert("No more steps to undo.");
    }
  }

};
