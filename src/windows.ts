"use strict";

import $ = require("jquery");
import { CodeProject } from "./project";

function ProjectWindows(containerdiv:HTMLElement, project:CodeProject) {
  var self = this;
  var id2window = {};
  var id2createfn = {};
  var id2div = {};
  var activewnd;
  var activediv;
  var lasterrors;
  // TODO: delete windows ever?
  
  this.setCreateFunc = function(id, createfn) {
    id2createfn[id] = createfn;
  }
  
  this.createOrShow = function(id) {
    var wnd = id2window[id];
    if (!wnd) {
      wnd = id2window[id] = id2createfn[id](id);
    }
    var div = id2div[id];
    if (!div) {
      div = id2div[id] = wnd.createDiv(containerdiv, project.getFile(id));
    }
    if (activewnd != wnd) {
      if (activediv)
        $(activediv).hide();
      activediv = div;
      activewnd = wnd;
      $(div).show();
      this.refresh();
      this.refreshErrors();
    }
    return wnd;
  }

  this.put = function(id, window) {
    id2window[id] = window;
  }
  
  this.refresh = function() {
    if (activewnd && activewnd.refresh)
      activewnd.refresh();
  }
  
  this.tick = function() {
    if (activewnd && activewnd.tick)
      activewnd.tick();
  }

  this.setErrors = function(errors) {
    lasterrors = errors;
    this.refreshErrors();
  }
  
  this.refreshErrors = function() {
    if (activewnd && activewnd.markErrors) {
      if (lasterrors && lasterrors.length)
        activewnd.markErrors(lasterrors);
      else
        activewnd.clearErrors();
    }
  }
  
  this.getActive = function() { return activewnd; }
  
  this.getCurrentText = function() {
    if (activewnd && activewnd.getValue)
      return activewnd.getValue();
    else
      alert("Please switch to an editor window.");
  }
};

