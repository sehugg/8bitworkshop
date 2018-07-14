"use strict";

import $ = require("jquery");
import { CodeProject } from "./project";
import { WorkerError } from "./workertypes";
import { ProjectView } from "./views";

type WindowCreateFunction = (id:string) => ProjectView;

export class ProjectWindows {
  containerdiv:HTMLElement;
  project:CodeProject;

  id2window : {[id:string]:ProjectView} = {};
  id2createfn : {[id:string]:WindowCreateFunction} = {};
  id2div : {[id:string]:HTMLElement} = {};
  activeid : string;
  activewnd : ProjectView;
  activediv : HTMLElement;
  lasterrors : WorkerError[];
  
  constructor(containerdiv:HTMLElement, project:CodeProject) {
    this.containerdiv = containerdiv;
    this.project = project;
  }
  // TODO: delete windows ever?
  
  setCreateFunc(id:string, createfn:WindowCreateFunction) {
    this.id2createfn[id] = createfn;
  }
  
  createOrShow(id:string) {
    var wnd = this.id2window[id];
    if (!wnd) {
      wnd = this.id2window[id] = this.id2createfn[id](id);
    }
    var div = this.id2div[id];
    if (!div) {
      var data = this.project.getFile(id)+""; // TODO: binary files
      div = this.id2div[id] = wnd.createDiv(this.containerdiv, data);
    }
    if (this.activewnd != wnd) {
      if (this.activediv)
        $(this.activediv).hide();
      this.activediv = div;
      this.activewnd = wnd;
      $(div).show();
      this.refresh();
      this.refreshErrors();
    }
    this.activeid = id;
    return wnd;
  }

  put(id:string, window:ProjectView) {
    this.id2window[id] = window;
  }
  
  refresh() {
    if (this.activewnd && this.activewnd.refresh)
      this.activewnd.refresh();
  }
  
  tick() {
    if (this.activewnd && this.activewnd.tick)
      this.activewnd.tick();
  }

  setErrors(errors:WorkerError[]) {
    this.lasterrors = errors;
    this.refreshErrors();
  }
  
  refreshErrors() {
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
};

