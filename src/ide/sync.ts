import DOMPurify from "dompurify";
import { getCookie, getFilenameForPath, getFilenamePrefix, loadScript } from "../common/util";
import { gaEvent } from "./analytics";
import { alertError, alertInfo, setWaitDialog, setWaitProgress } from "./dialogs";
import { createNewPersistentStore } from "./project";
import { GHSession, GithubService, getRepos, parseGithubURL } from "./services";
import { getCurrentMainFilename, getCurrentOutput, getCurrentProject, getPlatformStore, gotoNewLocation, projectWindows, repo_id } from "./ui";

declare var Octokat;

var githubService: GithubService;

export async function getGithubService() {
    if (!githubService) {
        // load github API client
        await loadScript('lib/octokat.js');
        // load firebase
        await loadScript('https://www.gstatic.com/firebasejs/8.8.1/firebase-app.js');
        await loadScript('https://www.gstatic.com/firebasejs/8.8.1/firebase-auth.js');
        await loadScript('https://8bitworkshop.com/config.js');
        // get github API key from cookie
        // TODO: move to service?
        var ghkey = getCookie('__github_key');
        githubService = new GithubService(Octokat, ghkey, getPlatformStore(), getCurrentProject());
        console.log("loaded github service");
    }
    return githubService;
}

export function getBoundGithubURL(): string {
    var toks = (repo_id || '').split('/');
    if (toks.length != 2) {
        alertError("You are not in a GitHub repository. Choose one from the pulldown, or Import or Publish one.");
        return null;
    }
    return 'https://github.com/' + toks[0] + '/' + toks[1];
}

// GITHUB stuff (TODO: move)


export async function importProjectFromGithub(githuburl: string, replaceURL: boolean) {
    var sess: GHSession;
    var urlparse = parseGithubURL(githuburl);
    if (!urlparse) {
        alertError('Could not parse Github URL.');
        return;
    }
    // redirect to repo if exists
    var existing = getRepos()[urlparse.repopath];
    if (existing && !confirm("You've already imported " + urlparse.repopath + " -- do you want to replace all local files?")) {
        return;
    }
    // create new store for imported repository
    setWaitDialog(true);
    var newstore = createNewPersistentStore(urlparse.repopath);
    // import into new store
    setWaitProgress(0.25);
    var gh = await getGithubService();
    return gh.import(githuburl).then((sess1: GHSession) => {
        sess = sess1;
        setWaitProgress(0.75);
        return gh.pull(githuburl, newstore);
    }).then((sess2: GHSession) => {
        // TODO: only first session has mainPath?
        // reload repo
        setWaitDialog(false);
        gaEvent('sync', 'import', githuburl);
        gotoNewLocation(replaceURL, { repo: urlparse.repopath }); // file:sess.mainPath, platform:sess.platform_id};
    }).catch((e) => {
        setWaitDialog(false);
        console.log(e);
        alertError("Could not import " + githuburl + "." + e);
    });
}

export async function _loginToGithub(e) {
    var gh = await getGithubService();
    gh.login().then(() => {
        alertInfo("You are signed in to Github.");
    }).catch((e) => {
        alertError("Could not sign in." + e);
    });
}

export async function _logoutOfGithub(e) {
    var gh = await getGithubService();
    gh.logout().then(() => {
        alertInfo("You are logged out of Github.");
    });
}

export function _importProjectFromGithub(e) {
    var modal = $("#importGithubModal");
    var btn = $("#importGithubButton");
    modal.modal('show');
    btn.off('click').on('click', () => {
        var githuburl = $("#importGithubURL").val() + "";
        modal.modal('hide');
        importProjectFromGithub(githuburl, false);
    });
}

export function _publishProjectToGithub(e) {
    if (repo_id) {
        if (!confirm("This project (" + getCurrentProject().mainPath + ") is already bound to a Github repository. Do you want to re-publish to a new repository? (You can instead choose 'Push Changes' to update files in the existing repository.)"))
            return;
    }
    var modal = $("#publishGithubModal");
    var btn = $("#publishGithubButton");
    $("#githubRepoName").val(getFilenamePrefix(getFilenameForPath(getCurrentProject().mainPath)));
    modal.modal('show');
    btn.off('click').on('click', async () => {
        var name = $("#githubRepoName").val() + "";
        var desc = $("#githubRepoDesc").val() + "";
        var priv = $("#githubRepoPrivate").val() == 'private';
        var license = $("#githubRepoLicense").val() + "";
        var sess;
        if (!name) {
            alertError("You did not enter a project name.");
            return;
        }
        modal.modal('hide');
        setWaitDialog(true);
        var gh = await getGithubService();
        gh.login().then(() => {
            setWaitProgress(0.25);
            return gh.publish(name, desc, license, priv);
        }).then((_sess) => {
            sess = _sess;
            setWaitProgress(0.5);
            //repo_id = qs.repo = sess.repopath;
            return pushChangesToGithub('initial import from 8bitworkshop.com');
        }).then(() => {
            gaEvent('sync', 'publish', priv ? "" : name);
            importProjectFromGithub(sess.url, false);
        }).catch((e) => {
            setWaitDialog(false);
            console.log(e);
            alertError("Could not publish GitHub repository: " + e);
        });
    });
}

export function _pushProjectToGithub(e) {
    var ghurl = getBoundGithubURL();
    if (!ghurl) return;
    var modal = $("#pushGithubModal");
    var btn = $("#pushGithubButton");
    modal.modal('show');
    btn.off('click').on('click', () => {
        var commitMsg = $("#githubCommitMsg").val() + "";
        modal.modal('hide');
        pushChangesToGithub(commitMsg);
    });
}

export function _pullProjectFromGithub(e) {
    var ghurl = getBoundGithubURL();
    if (!ghurl) return;
    bootbox.confirm("Pull from repository and replace all local files? Any changes you've made will be overwritten.",
        async (ok) => {
            if (ok) {
                setWaitDialog(true);
                var gh = await getGithubService();
                gh.pull(ghurl).then((sess: GHSession) => {
                    setWaitDialog(false);
                    projectWindows.updateAllOpenWindows(getPlatformStore());
                });
            }
        });
}

function confirmCommit(sess): Promise<GHSession> {
    return new Promise((resolve, reject) => {
        var files = sess.commit.files;
        console.log(files);
        // anything changed?
        if (files.length == 0) {
            setWaitDialog(false);
            alertInfo("No files changed.");
            return;
        }
        // build commit confirm message
        var msg = "";
        for (var f of files) {
            msg += DOMPurify.sanitize(f.filename) + ": " + f.status;
            if (f.additions || f.deletions || f.changes) {
                msg += " (" + f.additions + " additions, " + f.deletions + " deletions, " + f.changes + " changes)";
            };
            msg += "<br/>";
        }
        // show dialog, continue when yes
        bootbox.confirm(msg, (ok) => {
            if (ok) {
                resolve(sess);
            } else {
                setWaitDialog(false);
            }
        });
    });
}

async function pushChangesToGithub(message: string) {
    var ghurl = getBoundGithubURL();
    if (!ghurl) return;
    // build file list for push
    var files = [];
    for (var path in getCurrentProject().filedata) {
        var newpath = getCurrentProject().stripLocalPath(path);
        var data = getCurrentProject().filedata[path];
        if (newpath && data) {
            files.push({ path: newpath, data: data });
        }
    }
    // include built ROM file in bin/[mainfile].rom
    if (getCurrentOutput() instanceof Uint8Array) {
        let binpath = "bin/" + getCurrentMainFilename() + ".rom";
        files.push({ path: binpath, data: getCurrentOutput() });
    }
    // push files
    setWaitDialog(true);
    var gh = await getGithubService();
    return gh.login().then(() => {
        setWaitProgress(0.5);
        return gh.commit(ghurl, message, files);
    }).then((sess) => {
        return confirmCommit(sess);
    }).then((sess) => {
        return gh.push(sess);
    }).then((sess) => {
        setWaitDialog(false);
        alertInfo("Pushed files to " + ghurl);
        return sess;
    }).catch((e) => {
        setWaitDialog(false);
        console.log(e);
        alertError("Could not push GitHub repository: " + e);
    });
}

export function _removeRepository() {
    var ghurl = getBoundGithubURL();
    if (!ghurl) return;
    bootbox.prompt("<p>Are you sure you want to delete this repository (" + DOMPurify.sanitize(ghurl) + ") from browser storage?</p><p>All changes since last commit will be lost.</p><p>Type DELETE to proceed.<p>", (yes) => {
        if (yes.trim().toUpperCase() == "DELETE") {
            removeRepository();
        }
    });
}

async function removeRepository() {
    var ghurl = getBoundGithubURL();
    setWaitDialog(true);
    let gh = await getGithubService();
    let sess = await gh.getGithubSession(ghurl);
    gh.bind(sess, false);
    // delete all keys in (repo) storage
    await getPlatformStore().keys().then((keys: string[]) => {
        return Promise.all(keys.map((key) => {
            return getPlatformStore().removeItem(key);
        }));
    });
    setWaitDialog(false);
    // leave repository
    gotoNewLocation(false, { repo: '/' });
}

