
import Mousetrap = require('mousetrap');

/// TOOLBAR

export class Toolbar {
    span : JQuery;
    grp : JQuery;
    mousetrap;
    boundkeys = [];
    
    constructor(parentDiv:HTMLElement, focusDiv:HTMLElement) {
      this.mousetrap = focusDiv ? new Mousetrap(focusDiv) : Mousetrap;
      this.span = $(document.createElement("span")).addClass("btn_toolbar");
      parentDiv.appendChild(this.span[0]);
      this.newGroup();
    }
    destroy() {
      if (this.span) {
        this.span.remove();
        this.span = null;
      }
      if (this.mousetrap) {
        for (var key of this.boundkeys) {
          this.mousetrap.unbind(key);
        }
        this.mousetrap = null;
      }
    }
    newGroup() {
      return this.grp = $(document.createElement("span")).addClass("btn_group").appendTo(this.span).hide();
    }
    add(key:string, alttext:string, icon:string, fn:(e,combo) => void) {
      var btn = null;
      if (icon) {
        btn = $(document.createElement("button")).addClass("btn");
        if (icon.startsWith('glyphicon')) {
          icon = '<span class="glyphicon ' + icon + '" aria-hidden="true"></span>';
        }
        btn.html(icon);
        btn.prop("title", key ? (alttext+" ("+key+")") : alttext);
        btn.click(fn);
        this.grp.append(btn).show();
      }
      if (key) {
        this.mousetrap.bind(key, fn);
        this.boundkeys.push(key);
      }
      return btn;
    }
    
  }
  