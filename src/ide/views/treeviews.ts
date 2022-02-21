import { dumpRAM } from "../../common/emu";
import { ProbeFlags } from "../../common/recorder";
import { hex } from "../../common/util";
import { platform } from "../ui";
import { ProjectView } from "./baseviews";
import { ProbeViewBaseBase } from "./debugviews";

const MAX_CHILDREN = 256;
const MAX_STRING_LEN = 100;

var TREE_SHOW_DOLLAR_IDENTS = false;

class TreeNode {
  parent : TreeNode;
  name : string;
  _div : HTMLElement;
  _header : HTMLElement;
  _inline : HTMLElement;
  _content : HTMLElement;
  children : Map<string,TreeNode>;
  expanded = false;
  level : number;
  view : ProjectView;

  constructor(parent : TreeNode, name : string) {
    this.parent = parent;
    this.name = name;
    this.children = new Map();
    this.level = parent ? (parent.level+1) : -1;
    this.view = parent ? parent.view : null;
  }
  getDiv() {
    if (this._div == null) {
      this._div = document.createElement("div");
      this._div.classList.add("vertical-scroll");
      this._div.classList.add("tree-content");
      this._header = document.createElement("div");
      this._header.classList.add("tree-header");
      this._header.classList.add("tree-level-" + this.level);
      this._header.append(this.name);
      this._inline = document.createElement("span");
      this._inline.classList.add("tree-value");
      this._header.append(this._inline);
      this._div.append(this._header);
      this.parent._content.append(this._div);
      this._header.onclick = (e) => {
        this.toggleExpanded();
      };
    }
    if (this.expanded && this._content == null) {
      this._content = document.createElement("div");
      this._div.append(this._content);
    }
    else if (!this.expanded && this._content != null) {
      this._content.remove();
      this._content = null;
      this.children.clear();
    }
    return this._div;
  }
  toggleExpanded() {
    this.expanded = !this.expanded;
    this.view.tick();
  }
  remove() {
    this._div.remove();
    this._div = null;
  }
  update(obj : any) {
    this.getDiv();
    var text = "";
    // is it a function? call it first, if we are expanded
    // TODO: only call functions w/ signature
    if (obj && obj.$$ && typeof obj.$$ == 'function' && this._content != null) {
      obj = obj.$$();
    }
    // check null first
    if (obj == null) {
      text = obj+"";
    // primitive types
    } else if (typeof obj == 'number') {
      if (obj != (obj|0)) text = obj.toString(); // must be a float
      else text = obj + "\t($" + hex(obj) + ")";
    } else if (typeof obj == 'boolean') {
      text = obj.toString();
    } else if (typeof obj == 'string') {
      if (obj.length < MAX_STRING_LEN)
        text = obj;
      else
        text = obj.substring(0, MAX_STRING_LEN) + "...";
    // typed byte array (TODO: other kinds)
    } else if (obj.buffer && obj.length <= MAX_CHILDREN) {
      text = dumpRAM(obj, 0, obj.length);
    // recurse into object? (or function)
    } else if (typeof obj == 'object' || typeof obj == 'function') {
      // only if expanded
      if (this._content != null) {
        // split big arrays
        if (obj.slice && obj.length > MAX_CHILDREN) {
          let newobj = {};
          let oldobj = obj;
          var slicelen = MAX_CHILDREN;
          while (obj.length / slicelen > MAX_CHILDREN) slicelen *= 2;
          for (let ofs=0; ofs<oldobj.length; ofs+=slicelen) {
            newobj["$"+hex(ofs)] = {$$: () => { return oldobj.slice(ofs, ofs+slicelen); }}
          }
          obj = newobj;
        }
        // get object keys
        let names = obj instanceof Array ? Array.from(obj.keys()) : Object.getOwnPropertyNames(obj);
        if (names.length > MAX_CHILDREN) { // max # of child objects
          let newobj = {};
          let oldobj = obj;
          var slicelen = 100;
          while (names.length / slicelen > 100) slicelen *= 2;
          for (let ofs=0; ofs<names.length; ofs+=slicelen) {
            var newdict = {};
            for (var i=ofs; i<ofs+slicelen; i++)
              newdict[names[i]] = oldobj[names[i]];
            newobj["["+ofs+"...]"] = newdict;
          }
          obj = newobj;
          names = Object.getOwnPropertyNames(obj);
        }
        // track deletions
        let orphans = new Set(this.children.keys());
        // visit all children
        names.forEach((name) => {
          // hide $xxx idents?
          var hidden = !TREE_SHOW_DOLLAR_IDENTS && typeof name === 'string' && name.startsWith("$$");
          if (!hidden) {
            let childnode = this.children.get(name);
            if (childnode == null) {
              childnode = new TreeNode(this, name);
              this.children.set(name, childnode);
            }
            childnode.update(obj[name]);
          }
          orphans.delete(name);
        });
        // remove orphans
        orphans.forEach((delname) => {
          let childnode = this.children.get(delname);
          childnode.remove();
          this.children.delete(delname);
        });
        this._header.classList.add("tree-expanded");
        this._header.classList.remove("tree-collapsed");
      } else {
        this._header.classList.add("tree-collapsed");
        this._header.classList.remove("tree-expanded");
      }
    } else {
      text = typeof obj; // fallthrough
    }
    // change DOM object if needed
    if (this._inline.innerText != text) {
      this._inline.innerText = text;
    }
  }
}

function createTreeRootNode(parent : HTMLElement, view : ProjectView) : TreeNode {
  var mainnode = new TreeNode(null, null);
  mainnode.view = view;
  mainnode._content = parent;
  var root = new TreeNode(mainnode, "/");
  root.expanded = true;
  root.getDiv(); // create it
  root._div.style.padding = '0px';
  return root; // should be cached
}

export abstract class TreeViewBase implements ProjectView {
  root : TreeNode;

  createDiv(parent : HTMLElement) : HTMLElement {
    this.root = createTreeRootNode(parent, this);
    return this.root.getDiv();
  }

  refresh() {
    this.tick();
  }

  tick() {
    this.root.update(this.getRootObject());
  }

  abstract getRootObject() : Object;
}

export class StateBrowserView extends TreeViewBase implements ProjectView {
  getRootObject() { return platform.saveState(); }
}

export class DebugBrowserView extends TreeViewBase implements ProjectView {
  getRootObject() { return platform.getDebugTree(); }
}

interface CallGraphNode {
  $$SP : number;
  $$PC : number;
  count : number;
  startLine : number;
  endLine : number;
  calls : {[id:string] : CallGraphNode};
}

// TODO: clear stack data when reset?
export class CallStackView extends ProbeViewBaseBase implements ProjectView {
  treeroot : TreeNode;
  graph : CallGraphNode;
  stack : CallGraphNode[];
  lastsp : number;
  lastpc : number;
  jsr : boolean;
  rts : boolean;
  cumulativeData = true;

  createDiv(parent : HTMLElement) : HTMLElement {
    this.clear();
    this.treeroot = createTreeRootNode(parent, this);
    return this.treeroot.getDiv();
  }

  refresh() {
    this.tick();
  }

  tick() {
    this.treeroot.update(this.getRootObject());
    if (this.probe) this.probe.clear(); // clear cumulative data (TODO: doesnt work with seeking or debugging)
  }

  clear() {
    this.graph = null;
    this.reset();
  }

  reset() {
    this.stack = [];
    this.lastsp = -1;
    this.lastpc = 0;
    this.jsr = false;
    this.rts = false;
  }

  newNode(pc : number, sp : number) {
    return {$$SP:sp, $$PC:pc, count:0, startLine:null, endLine:null, calls:{}};
  }

  newRoot(pc : number, sp : number) {
    if (this.stack.length == 0) {
      this.graph = this.newNode(null, sp);
      this.stack.unshift(this.graph);
    } else if (sp > this.stack[0].$$SP) {
      this.graph = this.newNode(null, sp);
      this.graph.calls[this.addr2str(pc)] = this.stack[0];
      this.stack.unshift(this.graph);
    }
  }

  getRootObject() : Object {
    // TODO: we don't capture every frame, so if we don't start @ the top frame we may have problems
    this.redraw((op,addr,col,row,clk,value) => {
      switch (op) {
        case ProbeFlags.SP_POP:
          this.newRoot(this.lastpc, this.lastsp);
        case ProbeFlags.SP_PUSH:
          if (this.stack.length) {
            let top = this.stack[this.stack.length-1];
            var delta = this.lastsp - addr;
            if ((delta == 2 || delta == 3) && addr < top.$$SP) { // TODO: look for opcode?
              this.jsr = true;
            }
            if ((delta == -2 || delta == -3) && this.stack.length > 1 && addr > top.$$SP) {
              this.rts = true;
            }
          }
          this.lastsp = addr;
          break;
        case ProbeFlags.EXECUTE:
          // TODO: better check for CALL/RET opcodes
          if (Math.abs(addr - this.lastpc) >= 4) { // make sure we're jumping a distance (TODO)
            if (this.jsr && this.stack.length) {
              let top = this.stack[this.stack.length-1];
              let sym = this.addr2str(addr);
              let child = top.calls[sym];
              if (child == null) { 
                child = top.calls[sym] = this.newNode(addr, this.lastsp);
              }
              else if (child.$$PC == null) child.$$PC = addr;
              //this.stack.forEach((node) => node.count++);
              this.stack.push(child);
              child.count++;
              child.startLine = row;
            }
            this.jsr = false;
            if (this.rts && this.stack.length) {
              this.stack.pop().endLine = row;
            }
            this.rts = false;
          }
          this.lastpc = addr;
          break;
      }
    });
    if (this.graph) this.graph['$$Stack'] = this.stack;
    return TREE_SHOW_DOLLAR_IDENTS ? this.graph : this.graph && this.graph.calls;
  }
}

export class FrameCallsView extends ProbeViewBaseBase implements ProjectView {
  treeroot : TreeNode;

  createDiv(parent : HTMLElement) : HTMLElement {
    this.treeroot = createTreeRootNode(parent, this);
    return this.treeroot.getDiv();
  }

  refresh() {
    this.tick();
  }

  tick() {
    this.treeroot.update(this.getRootObject());
  }

  getRootObject() : Object {
    var frame = {};
    this.redraw((op,addr,col,row,clk,value) => {
      switch (op) {
        case ProbeFlags.EXECUTE:
          let sym = this.addr2symbol(addr);
          if (sym) {
            if (!frame[sym]) {
              frame[sym] = row;
            }
          }
          break;
      }
    });
    return frame;
  }
}


///

