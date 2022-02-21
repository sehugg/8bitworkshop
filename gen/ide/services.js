"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.FirebaseProjectFilesystem = exports.GithubService = exports.parseGithubURL = exports.getRepos = void 0;
const util_1 = require("../common/util");
const README_md_template = "$NAME\n=====\n\n[Open this project in 8bitworkshop](http://8bitworkshop.com/redir.html?platform=$PLATFORM&githubURL=$GITHUBURL&file=$MAINFILE).\n";
function getRepos() {
    var repos = {};
    for (var i = 0; i < localStorage.length; i++) {
        var key = localStorage.key(i);
        if (key.startsWith('__repo__')) {
            var repodata = JSON.parse(localStorage.getItem(key));
            var path = key.substring('__repo__'.length);
            repos[path] = repodata;
        }
    }
    return repos;
}
exports.getRepos = getRepos;
function parseGithubURL(ghurl) {
    var toks = ghurl.split('/', 8);
    if (toks.length < 5)
        return null;
    if (toks[0] != 'https:')
        return null;
    if (toks[2] != 'github.com')
        return null;
    if (toks[5] && toks[5] != 'tree')
        return null;
    return { user: toks[3], repo: toks[4], repopath: toks[3] + '/' + toks[4], branch: toks[6], subtreepath: toks[7] };
}
exports.parseGithubURL = parseGithubURL;
class GithubService {
    constructor(githubCons, githubToken, store, project) {
        this.githubCons = githubCons;
        this.githubToken = githubToken;
        this.store = store;
        this.project = project;
        this.recreateGithub();
    }
    recreateGithub() {
        this.github = new this.githubCons({ token: this.githubToken });
    }
    login() {
        // already logged in? return immediately
        if (this.githubToken && this.githubToken.length) {
            return new Promise((yes, no) => {
                yes();
            });
        }
        // login via popup
        var provider = new firebase.auth.GithubAuthProvider();
        provider.addScope('repo');
        return firebase.auth().signInWithPopup(provider).then((result) => {
            this.githubToken = result.credential.accessToken;
            var user = result.user;
            this.recreateGithub();
            document.cookie = "__github_key=" + this.githubToken + ";path=/;max-age=31536000";
            console.log("Stored GitHub OAUTH key");
        });
    }
    logout() {
        // already logged out? return immediately
        if (!(this.githubToken && this.githubToken.length)) {
            return new Promise((yes, no) => {
                yes();
            });
        }
        // logout
        return firebase.auth().signOut().then(() => {
            document.cookie = "__github_key=;path=/;max-age=0";
            this.githubToken = null;
            this.recreateGithub();
        });
    }
    isFileIgnored(s) {
        s = s.toUpperCase();
        if (s.startsWith("LICENSE"))
            return true;
        if (s.startsWith("README"))
            return true;
        if (s.startsWith("."))
            return true;
        return false;
    }
    async getGithubSession(ghurl) {
        var urlparse = parseGithubURL(ghurl);
        if (!urlparse) {
            throw new Error("Please enter a valid GitHub URL.");
        }
        // use saved branch, or load default from rpo
        var saved = getRepos()[urlparse.repopath];
        var branch = urlparse.branch || (saved && saved.branch);
        var repo = this.github.repos(urlparse.user, urlparse.repo);
        if (1 || branch == null) {
            try {
                branch = (await repo.fetch()).defaultBranch || "master";
            }
            catch (e) {
                console.log("could not fetch default branch: " + e);
                branch = "main";
            }
            console.log("branch =", branch);
        }
        var sess = {
            url: ghurl,
            user: urlparse.user,
            reponame: urlparse.repo,
            repopath: urlparse.repopath,
            branch: branch,
            subtreepath: urlparse.subtreepath,
            prefix: '',
            repo: repo,
            platform_id: this.project ? this.project.platform_id : (saved ? saved.platform_id : null)
        };
        //console.log(sess);
        return sess;
    }
    getGithubHEADTree(ghurl) {
        var sess;
        return this.getGithubSession(ghurl).then((session) => {
            sess = session;
            return sess.repo.git.refs.heads(sess.branch).fetch();
        })
            .then((head) => {
            sess.head = head;
            sess.sha = head.object.sha;
            return sess.repo.git.trees(sess.sha).fetch();
        })
            .then((tree) => {
            if (sess.subtreepath) {
                for (let subtree of tree.tree) {
                    if (subtree.type == 'tree' && subtree.path == sess.subtreepath && subtree.sha) {
                        return sess.repo.git.trees(subtree.sha).fetch();
                    }
                }
                throw Error("Cannot find subtree '" + sess.subtreepath + "' in tree " + tree.sha);
            }
            return tree;
        })
            .then((tree) => {
            sess.tree = tree;
            return sess;
        });
    }
    bind(sess, dobind) {
        var key = '__repo__' + sess.repopath;
        if (dobind) {
            var repodata = {
                url: sess.url,
                branch: sess.branch,
                platform_id: sess.platform_id,
                mainPath: sess.mainPath,
                sha: sess.sha
            };
            console.log('storing', repodata);
            localStorage.setItem(key, JSON.stringify(repodata));
        }
        else {
            localStorage.removeItem(key);
        }
    }
    import(ghurl) {
        var sess;
        return this.getGithubSession(ghurl).then((session) => {
            sess = session;
            // load README
            return sess.repo.contents('README.md').read();
        })
            .catch((e) => {
            console.log(e);
            console.log('no README.md found');
            // make user repo exists
            return sess.repo.fetch().then((_repo) => {
                return ''; // empty README
            });
        })
            .then((readme) => {
            var m;
            // check README for main file
            const re8main = /8bitworkshop.com[^)]+file=([^)&]+)/;
            m = re8main.exec(readme);
            if (m && m[1]) {
                console.log("main path: '" + m[1] + "'");
                sess.mainPath = m[1];
            }
            // check README for proper platform
            // unless we use githubURL=
            const re8plat = /8bitworkshop.com[^)]+platform=([A-Za-z0-9._\-]+)/;
            m = re8plat.exec(readme);
            if (m) {
                console.log("platform id: '" + m[1] + "'");
                if (sess.platform_id && !sess.platform_id.startsWith(m[1]))
                    throw Error("Platform mismatch: Repository is " + m[1] + ", you have " + this.project.platform_id + " selected.");
                sess.platform_id = m[1];
            }
            // bind to repository
            this.bind(sess, true);
            // get head commit
            return sess;
        });
    }
    pull(ghurl, deststore) {
        var sess;
        return this.getGithubHEADTree(ghurl).then((session) => {
            sess = session;
            let blobreads = [];
            sess.paths = [];
            sess.tree.tree.forEach((item) => {
                console.log(item.path, item.type, item.size);
                sess.paths.push(item.path);
                if (item.type == 'blob' && !this.isFileIgnored(item.path)) {
                    var read = sess.repo.git.blobs(item.sha).fetch().then((blob) => {
                        var path = sess.prefix + item.path;
                        var size = item.size;
                        var encoding = blob.encoding;
                        var data = blob.content;
                        if (blob.encoding == 'base64') {
                            var bindata = (0, util_1.stringToByteArray)(atob(data));
                            var isBinary = (0, util_1.isProbablyBinary)(item.path, bindata);
                            data = isBinary ? bindata : (0, util_1.byteArrayToUTF8)(bindata);
                        }
                        if (blob.size != data.length) {
                            data = data.slice(0, blob.size);
                        }
                        return (deststore || this.store).setItem(path, data);
                    });
                    blobreads.push(read);
                }
                else {
                    console.log("ignoring " + item.path);
                }
            });
            return Promise.all(blobreads);
        })
            .then((blobs) => {
            return sess;
        });
    }
    importAndPull(ghurl) {
        return this.import(ghurl).then((sess) => {
            return this.pull(ghurl);
        });
    }
    publish(reponame, desc, license, isprivate) {
        var repo;
        var platform_id = this.project.platform_id;
        var mainPath = this.project.stripLocalPath(this.project.mainPath);
        return this.github.user.repos.create({
            name: reponame,
            description: desc,
            private: isprivate,
            auto_init: false,
            license_template: license
        })
            .then((_repo) => {
            repo = _repo;
            // create README.md
            var s = README_md_template;
            s = s.replace(/\$NAME/g, encodeURIComponent(reponame));
            s = s.replace(/\$PLATFORM/g, encodeURIComponent(platform_id));
            s = s.replace(/\$GITHUBURL/g, encodeURIComponent(repo.htmlUrl));
            s = s.replace(/\$MAINFILE/g, encodeURIComponent(mainPath));
            var config = {
                message: '8bitworkshop: updated metadata in README.md',
                content: btoa(s)
            };
            return repo.contents('README.md').add(config);
        }).then(() => {
            return this.getGithubSession(repo.htmlUrl);
        });
    }
    commit(ghurl, message, files) {
        var sess;
        if (!message) {
            message = "updated from 8bitworkshop.com";
        }
        return this.getGithubHEADTree(ghurl).then((session) => {
            sess = session;
            if (sess.subtreepath) {
                throw Error("Sorry, right now you can only commit files to the root directory of a repository.");
            }
            return Promise.all(files.map((file) => {
                if (typeof file.data === 'string') {
                    return sess.repo.git.blobs.create({
                        content: file.data,
                        encoding: 'utf-8'
                    });
                }
                else {
                    return sess.repo.git.blobs.create({
                        content: btoa((0, util_1.byteArrayToString)(file.data)),
                        encoding: 'base64'
                    });
                }
            }));
        }).then((blobs) => {
            return sess.repo.git.trees.create({
                tree: files.map((file, index) => {
                    return {
                        path: file.path,
                        mode: '100644',
                        type: 'blob',
                        sha: blobs[index]['sha']
                    };
                }),
                base_tree: sess.tree.sha
            });
        }).then((newtree) => {
            return sess.repo.git.commits.create({
                message: message,
                tree: newtree.sha,
                parents: [
                    sess.head.object.sha
                ]
            });
        }).then((commit1) => {
            return sess.repo.commits(commit1.sha).fetch();
        }).then((commit) => {
            sess.commit = commit;
            return sess;
        });
    }
    push(sess) {
        return sess.head.update({
            sha: sess.commit.sha
        }).then((update) => {
            return sess;
        });
    }
    deleteRepository(ghurl) {
        return this.getGithubSession(ghurl).then((session) => {
            return session.repo.remove();
        });
    }
}
exports.GithubService = GithubService;
//
class FirebaseProjectFilesystem {
    constructor(user_id, store_id) {
        var database = firebase.database();
        this.ref = database.ref('users/' + user_id + "/" + store_id);
    }
    getChildForPath(path) {
        var encodedPath = encodeURIComponent(path).replace('-', '%2D').replace('.', '%2E');
        return this.ref.child(encodedPath);
    }
    async getFileData(path) {
        console.log(this.getChildForPath("test"));
        var snapshot = await this.getChildForPath(path).get();
        return snapshot.exists() ? snapshot.val().filedata : null;
    }
    async setFileData(path, data) {
        return this.getChildForPath(path).set({
            filedata: data
        });
    }
}
exports.FirebaseProjectFilesystem = FirebaseProjectFilesystem;
//# sourceMappingURL=services.js.map