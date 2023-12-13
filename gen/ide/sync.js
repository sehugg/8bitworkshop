"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports._removeRepository = exports._pullProjectFromGithub = exports._pushProjectToGithub = exports._publishProjectToGithub = exports._importProjectFromGithub = exports._logoutOfGithub = exports._loginToGithub = exports.importProjectFromGithub = exports.getBoundGithubURL = exports.getGithubService = void 0;
const dompurify_1 = __importDefault(require("dompurify"));
const util_1 = require("../common/util");
const analytics_1 = require("./analytics");
const dialogs_1 = require("./dialogs");
const project_1 = require("./project");
const services_1 = require("./services");
const ui_1 = require("./ui");
var githubService;
async function getGithubService() {
    if (!githubService) {
        // load github API client
        await (0, util_1.loadScript)('lib/octokat.js');
        // load firebase
        await (0, util_1.loadScript)('https://www.gstatic.com/firebasejs/8.8.1/firebase-app.js');
        await (0, util_1.loadScript)('https://www.gstatic.com/firebasejs/8.8.1/firebase-auth.js');
        await (0, util_1.loadScript)('https://8bitworkshop.com/config.js');
        // get github API key from cookie
        // TODO: move to service?
        var ghkey = (0, util_1.getCookie)('__github_key');
        githubService = new services_1.GithubService(Octokat, ghkey, (0, ui_1.getPlatformStore)(), (0, ui_1.getCurrentProject)());
        console.log("loaded github service");
    }
    return githubService;
}
exports.getGithubService = getGithubService;
function getBoundGithubURL() {
    var toks = (ui_1.repo_id || '').split('/');
    if (toks.length != 2) {
        (0, dialogs_1.alertError)("You are not in a GitHub repository. Choose one from the pulldown, or Import or Publish one.");
        return null;
    }
    return 'https://github.com/' + toks[0] + '/' + toks[1];
}
exports.getBoundGithubURL = getBoundGithubURL;
// GITHUB stuff (TODO: move)
async function importProjectFromGithub(githuburl, replaceURL) {
    var sess;
    var urlparse = (0, services_1.parseGithubURL)(githuburl);
    if (!urlparse) {
        (0, dialogs_1.alertError)('Could not parse Github URL.');
        return;
    }
    // redirect to repo if exists
    var existing = (0, services_1.getRepos)()[urlparse.repopath];
    if (existing && !confirm("You've already imported " + urlparse.repopath + " -- do you want to replace all local files?")) {
        return;
    }
    // create new store for imported repository
    (0, dialogs_1.setWaitDialog)(true);
    var newstore = (0, project_1.createNewPersistentStore)(urlparse.repopath);
    // import into new store
    (0, dialogs_1.setWaitProgress)(0.25);
    var gh = await getGithubService();
    return gh.import(githuburl).then((sess1) => {
        sess = sess1;
        (0, dialogs_1.setWaitProgress)(0.75);
        return gh.pull(githuburl, newstore);
    }).then((sess2) => {
        // TODO: only first session has mainPath?
        // reload repo
        (0, dialogs_1.setWaitDialog)(false);
        (0, analytics_1.gaEvent)('sync', 'import', githuburl);
        (0, ui_1.gotoNewLocation)(replaceURL, { repo: urlparse.repopath }); // file:sess.mainPath, platform:sess.platform_id};
    }).catch((e) => {
        (0, dialogs_1.setWaitDialog)(false);
        console.log(e);
        (0, dialogs_1.alertError)("Could not import " + githuburl + "." + e);
    });
}
exports.importProjectFromGithub = importProjectFromGithub;
async function _loginToGithub(e) {
    var gh = await getGithubService();
    gh.login().then(() => {
        (0, dialogs_1.alertInfo)("You are signed in to Github.");
    }).catch((e) => {
        (0, dialogs_1.alertError)("Could not sign in." + e);
    });
}
exports._loginToGithub = _loginToGithub;
async function _logoutOfGithub(e) {
    var gh = await getGithubService();
    gh.logout().then(() => {
        (0, dialogs_1.alertInfo)("You are logged out of Github.");
    });
}
exports._logoutOfGithub = _logoutOfGithub;
function _importProjectFromGithub(e) {
    var modal = $("#importGithubModal");
    var btn = $("#importGithubButton");
    modal.modal('show');
    btn.off('click').on('click', () => {
        var githuburl = $("#importGithubURL").val() + "";
        modal.modal('hide');
        importProjectFromGithub(githuburl, false);
    });
}
exports._importProjectFromGithub = _importProjectFromGithub;
function _publishProjectToGithub(e) {
    if (ui_1.repo_id) {
        if (!confirm("This project (" + (0, ui_1.getCurrentProject)().mainPath + ") is already bound to a Github repository. Do you want to re-publish to a new repository? (You can instead choose 'Push Changes' to update files in the existing repository.)"))
            return;
    }
    var modal = $("#publishGithubModal");
    var btn = $("#publishGithubButton");
    $("#githubRepoName").val((0, util_1.getFilenamePrefix)((0, util_1.getFilenameForPath)((0, ui_1.getCurrentProject)().mainPath)));
    modal.modal('show');
    btn.off('click').on('click', async () => {
        var name = $("#githubRepoName").val() + "";
        var desc = $("#githubRepoDesc").val() + "";
        var priv = $("#githubRepoPrivate").val() == 'private';
        var license = $("#githubRepoLicense").val() + "";
        var sess;
        if (!name) {
            (0, dialogs_1.alertError)("You did not enter a project name.");
            return;
        }
        modal.modal('hide');
        (0, dialogs_1.setWaitDialog)(true);
        var gh = await getGithubService();
        gh.login().then(() => {
            (0, dialogs_1.setWaitProgress)(0.25);
            return gh.publish(name, desc, license, priv);
        }).then((_sess) => {
            sess = _sess;
            (0, dialogs_1.setWaitProgress)(0.5);
            //repo_id = qs.repo = sess.repopath;
            return pushChangesToGithub('initial import from 8bitworkshop.com');
        }).then(() => {
            (0, analytics_1.gaEvent)('sync', 'publish', priv ? "" : name);
            importProjectFromGithub(sess.url, false);
        }).catch((e) => {
            (0, dialogs_1.setWaitDialog)(false);
            console.log(e);
            (0, dialogs_1.alertError)("Could not publish GitHub repository: " + e);
        });
    });
}
exports._publishProjectToGithub = _publishProjectToGithub;
function _pushProjectToGithub(e) {
    var ghurl = getBoundGithubURL();
    if (!ghurl)
        return;
    var modal = $("#pushGithubModal");
    var btn = $("#pushGithubButton");
    modal.modal('show');
    btn.off('click').on('click', () => {
        var commitMsg = $("#githubCommitMsg").val() + "";
        modal.modal('hide');
        pushChangesToGithub(commitMsg);
    });
}
exports._pushProjectToGithub = _pushProjectToGithub;
function _pullProjectFromGithub(e) {
    var ghurl = getBoundGithubURL();
    if (!ghurl)
        return;
    bootbox.confirm("Pull from repository and replace all local files? Any changes you've made will be overwritten.", async (ok) => {
        if (ok) {
            (0, dialogs_1.setWaitDialog)(true);
            var gh = await getGithubService();
            gh.pull(ghurl).then((sess) => {
                (0, dialogs_1.setWaitDialog)(false);
                ui_1.projectWindows.updateAllOpenWindows((0, ui_1.getPlatformStore)());
            });
        }
    });
}
exports._pullProjectFromGithub = _pullProjectFromGithub;
function confirmCommit(sess) {
    return new Promise((resolve, reject) => {
        var files = sess.commit.files;
        console.log(files);
        // anything changed?
        if (files.length == 0) {
            (0, dialogs_1.setWaitDialog)(false);
            (0, dialogs_1.alertInfo)("No files changed.");
            return;
        }
        // build commit confirm message
        var msg = "";
        for (var f of files) {
            msg += dompurify_1.default.sanitize(f.filename) + ": " + f.status;
            if (f.additions || f.deletions || f.changes) {
                msg += " (" + f.additions + " additions, " + f.deletions + " deletions, " + f.changes + " changes)";
            }
            ;
            msg += "<br/>";
        }
        // show dialog, continue when yes
        bootbox.confirm(msg, (ok) => {
            if (ok) {
                resolve(sess);
            }
            else {
                (0, dialogs_1.setWaitDialog)(false);
            }
        });
    });
}
async function pushChangesToGithub(message) {
    var ghurl = getBoundGithubURL();
    if (!ghurl)
        return;
    // build file list for push
    var files = [];
    for (var path in (0, ui_1.getCurrentProject)().filedata) {
        var newpath = (0, ui_1.getCurrentProject)().stripLocalPath(path);
        var data = (0, ui_1.getCurrentProject)().filedata[path];
        if (newpath && data) {
            files.push({ path: newpath, data: data });
        }
    }
    // include built ROM file in bin/[mainfile].rom
    if ((0, ui_1.getCurrentOutput)() instanceof Uint8Array) {
        let binpath = "bin/" + (0, ui_1.getCurrentMainFilename)() + ".rom";
        files.push({ path: binpath, data: (0, ui_1.getCurrentOutput)() });
    }
    // push files
    (0, dialogs_1.setWaitDialog)(true);
    var gh = await getGithubService();
    return gh.login().then(() => {
        (0, dialogs_1.setWaitProgress)(0.5);
        return gh.commit(ghurl, message, files);
    }).then((sess) => {
        return confirmCommit(sess);
    }).then((sess) => {
        return gh.push(sess);
    }).then((sess) => {
        (0, dialogs_1.setWaitDialog)(false);
        (0, dialogs_1.alertInfo)("Pushed files to " + ghurl);
        return sess;
    }).catch((e) => {
        (0, dialogs_1.setWaitDialog)(false);
        console.log(e);
        (0, dialogs_1.alertError)("Could not push GitHub repository: " + e);
    });
}
function _removeRepository() {
    var ghurl = getBoundGithubURL();
    if (!ghurl)
        return;
    bootbox.prompt("<p>Are you sure you want to delete this repository (" + dompurify_1.default.sanitize(ghurl) + ") from browser storage?</p><p>All changes since last commit will be lost.</p><p>Type DELETE to proceed.<p>", (yes) => {
        if (yes.trim().toUpperCase() == "DELETE") {
            removeRepository();
        }
    });
}
exports._removeRepository = _removeRepository;
async function removeRepository() {
    var ghurl = getBoundGithubURL();
    (0, dialogs_1.setWaitDialog)(true);
    let gh = await getGithubService();
    let sess = await gh.getGithubSession(ghurl);
    gh.bind(sess, false);
    // delete all keys in (repo) storage
    await (0, ui_1.getPlatformStore)().keys().then((keys) => {
        return Promise.all(keys.map((key) => {
            return (0, ui_1.getPlatformStore)().removeItem(key);
        }));
    });
    (0, dialogs_1.setWaitDialog)(false);
    // leave repository
    (0, ui_1.gotoNewLocation)(false, { repo: '/' });
}
//# sourceMappingURL=sync.js.map