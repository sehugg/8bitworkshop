"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ProjectWindows = void 0;
const $ = require("jquery");
const util_1 = require("../common/util");
class ProjectWindows {
    constructor(containerdiv, project) {
        this.id2window = {};
        this.id2createfn = {};
        this.id2showfn = {};
        this.id2div = {};
        this.containerdiv = containerdiv;
        this.project = project;
        this.undofiles = [];
        this.redofiles = [];
    }
    // TODO: delete windows ever?
    isWindow(id) {
        return this.id2createfn[id] != null;
    }
    setCreateFunc(id, createfn) {
        this.id2createfn[id] = createfn;
    }
    setShowFunc(id, showfn) {
        this.id2showfn[id] = showfn;
    }
    create(id) {
        var wnd = this.id2window[id];
        if (!wnd) {
            console.log("creating window", id);
            wnd = this.id2window[id] = this.id2createfn[id](id);
        }
        var div = this.id2div[id];
        if (!div) {
            div = this.id2div[id] = wnd.createDiv(this.containerdiv);
            $(div).hide();
        }
        return wnd;
    }
    createOrShow(id, moveCursor) {
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
        }
        else {
            this.refresh(moveCursor);
        }
        this.activeid = id;
        if (typeof window !== 'undefined') {
            const isMainFile = id === this.project.mainPath;
            if (isMainFile) {
                if (window.location.hash) {
                    history.replaceState(null, '', window.location.pathname + window.location.search);
                }
            }
            else {
                const hash = id.startsWith('#') ? id : '#' + encodeURIComponent(id);
                // don't overwrite an extended hash (e.g. #asseteditor/file/line) with the base hash
                if (window.location.hash !== hash && !window.location.hash.startsWith(hash + '/')) {
                    history.replaceState(null, '', hash);
                }
            }
            this.updateTitle(id);
        }
        return wnd;
    }
    updateTitle(id) {
        if (!this.titlePrefix)
            return;
        var mainName = (0, util_1.getFilenameForPath)(this.project.mainPath);
        if (id === this.project.mainPath) {
            document.title = this.titlePrefix + mainName;
        }
        else {
            var viewName = id.startsWith('#') ? id : (0, util_1.getFilenameForPath)(id);
            document.title = this.titlePrefix + mainName + ' | ' + viewName;
        }
    }
    put(id, window) {
        this.id2window[id] = window;
    }
    refresh(moveCursor) {
        // refresh current window
        if (this.activewnd && this.activewnd.refresh)
            this.activewnd.refresh(moveCursor);
    }
    tick() {
        if (this.activewnd && this.activewnd.tick)
            this.activewnd.tick();
    }
    setErrors(errors) {
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
    getActive() { return this.activewnd; }
    getActiveID() { return this.activeid; }
    getCurrentText() {
        if (this.activewnd && this.activewnd.getValue)
            return this.activewnd.getValue();
        else
            bootbox.alert("Please switch to an editor window.");
    }
    resize() {
        if (this.activeid && this.activewnd && this.activewnd.recreateOnResize) {
            this.activewnd = null;
            this.id2window[this.activeid] = null;
            this.id2div[this.activeid] = null;
            this.createOrShow(this.activeid);
        }
    }
    updateFile(fileid, data) {
        // is there an editor? if so, use it
        var wnd = this.id2window[fileid];
        if (wnd && wnd.setText && typeof data === 'string') {
            wnd.setText(data);
            this.undofiles.push(fileid);
            this.redofiles = [];
        }
        else {
            this.project.updateFile(fileid, data);
        }
    }
    replaceTextRange(fileid, from, to, text) {
        var wnd = this.id2window[fileid] || this.create(fileid);
        wnd.replaceTextRange(from, to, text);
        this.undofiles.push(fileid);
        this.redofiles = [];
    }
    undoStep() {
        var fileid = this.undofiles.pop();
        var wnd = this.id2window[fileid];
        if (wnd && wnd.undoStep) {
            wnd.undoStep();
            if (wnd.getValue) {
                this.project.updateFile(fileid, wnd.getValue());
            }
            this.redofiles.push(fileid);
            this.refresh(false);
        }
        else {
            this.showAlert("No more steps to undo.");
        }
    }
    redoStep() {
        var fileid = this.redofiles.pop();
        var wnd = this.id2window[fileid];
        if (wnd && wnd.redoStep) {
            wnd.redoStep();
            if (wnd.getValue) {
                this.project.updateFile(fileid, wnd.getValue());
            }
            this.undofiles.push(fileid);
            this.refresh(false);
        }
        else {
            this.showAlert("No more steps to redo.");
        }
    }
    showAlert(msg) {
        if (this.alerting)
            return;
        this.alerting = true;
        bootbox.alert(msg, () => { this.alerting = false; });
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
    findWindowWithFilePrefix(filename) {
        filename = (0, util_1.getFilenameForPath)((0, util_1.getFilenamePrefix)(filename));
        for (var fileid in this.id2createfn) {
            // ignore include files (TODO)
            if (fileid.toLowerCase().endsWith('.h') || fileid.toLowerCase().endsWith('.inc') || fileid.toLowerCase().endsWith('.bas'))
                continue;
            if ((0, util_1.getFilenameForPath)((0, util_1.getFilenamePrefix)(fileid)) == filename)
                return fileid;
        }
        return null;
    }
}
exports.ProjectWindows = ProjectWindows;
;
//# sourceMappingURL=windows.js.map