
import { getFolderForPath, isProbablyBinary, stringToByteArray, byteArrayToString, byteArrayToUTF8 } from "./util";
import { FileData } from "./workertypes";
import { CodeProject } from "./project";

// in index.html
declare var exports;
declare var firebase;

export interface GHRepoMetadata {
  url : string;		// github url
  platform_id : string; // e.g. "vcs"
  mainPath?: string;	// main file path
}

export interface GHSession extends GHRepoMetadata {
  url : string;		// github url
  user : string;	// user name
  reponame : string;	// repo name
  repopath : string;	// "user/repo"
  prefix : string;	// file prefix, "local/" or ""
  repo : any;		// [repo object]
  paths? : string[];
}

const README_md_template = "$NAME\n=====\n\nCompatible with the [$PLATFORM](http://8bitworkshop.com/redir.html?platform=$PLATFORM&importURL=$GITHUBURL) platform in [8bitworkshop](http://8bitworkshop.com/). Main file is [$MAINFILE]($MAINFILE#mainfile).\n";

export function getRepos() : {[key:string]:GHRepoMetadata} {
  return JSON.parse(localStorage.getItem('__repos') || '{}');
}
  
export class GithubService {

  githubCons;
  githubToken;
  github;
  store;
  project : CodeProject;
  branch : string = "master";

  constructor(githubCons:() => any, githubToken:string, store, project : CodeProject) {
    this.githubCons = githubCons;
    this.githubToken = githubToken;
    this.store = store;
    this.project = project;
    this.recreateGithub();
  }
  
  recreateGithub() {
    this.github = new this.githubCons({token:this.githubToken});
  }
  
  login() : Promise<void> {
    // already logged in? return immediately
    if (this.githubToken && this.githubToken.length) {
      return new Promise<void>( (yes,no) => {
        yes();
      });
    }
    // login via popup
    var provider = new firebase.auth.GithubAuthProvider();
    provider.addScope('repo');
    return firebase.auth().signInWithPopup(provider).then( (result) => {
      this.githubToken = result.credential.accessToken;
      var user = result.user;
      this.recreateGithub();
      document.cookie = "__github_key=" + this.githubToken + ";path=/;max-age=31536000";
      console.log("Stored GitHub OAUTH key");
    }).catch( (error) => {
      console.log(error);
      alert("Could not login to GitHub: " + error);
    });
  }
  
  isFileIgnored(s : string) : boolean {
    s = s.toUpperCase();
    if (s.startsWith("LICENSE")) return true;
    if (s.startsWith("README")) return true;
    if (s.startsWith(".")) return true;
    return false;
  }

  parseGithubURL(ghurl:string) {
    var toks = ghurl.split('/');
    if (toks.length < 5) return null;
    if (toks[0] != 'https:') return null;
    if (toks[2] != 'github.com') return null;
    return {user:toks[3], repo:toks[4], repopath:toks[3]+'/'+toks[4]};
  }
  
  getGithubSession(ghurl:string) : Promise<GHSession> {
    return new Promise( (yes,no) => {
      var urlparse = this.parseGithubURL(ghurl);
      if (!urlparse) {
        no("Please enter a valid GitHub URL.");
      }
      var sess = {
        url: ghurl,
        user: urlparse.user,
        reponame: urlparse.repo,
        repopath: urlparse.repopath,
        prefix: '', //this.getPrefix(urlparse.user, urlparse.repo),
        repo: this.github.repos(urlparse.user, urlparse.repo),
        platform_id: this.project.platform_id
      };
      yes(sess);
    });
  }
  
  bind(sess:GHSession, dobind:boolean) {
    var repos = getRepos();
    if (dobind) {
      repos[sess.repopath] = {url:sess.url, platform_id:sess.platform_id, mainPath:sess.mainPath};
    } else {
      delete repos[sess.repopath];
    }
    localStorage.setItem('__repos', JSON.stringify(repos));
  }
  
  import(ghurl:string) : Promise<GHSession> {
    var sess : GHSession;
    return this.getGithubSession(ghurl).then( (session) => {
      sess = session;
      // load README
      return sess.repo.contents('README.md').read();
    })
    .catch( () => {
      console.log('no README.md found')
      return ''; // empty README
    })
    .then( (readme) => {
      var m;
      // check README for main file
      const re8main = /\(([^)]+)#mainfile\)/;
      m = re8main.exec(readme);
      if (m && m[1]) {
        console.log("main path: '" + m[1] + "'");
        sess.mainPath = m[1];
      }
      // check README for proper platform
      const re8plat = /8bitworkshop.com[^)]+platform=(\w+)/;
      m = re8plat.exec(readme);
      if (m) {
        console.log("platform id: '" + m[1] + "'");
        sess.platform_id = m[1];
        if (!this.project.platform_id.startsWith(m[1]))
          throw "Platform mismatch: Repository is " + m[1] + ", you have " + this.project.platform_id + " selected.";
      }
      // bind to repository
      this.bind(sess, true);
      // get head commit
      return sess;
    });
  }
  
  pull(ghurl:string, deststore?) : Promise<GHSession> {
    var sess : GHSession;
    return this.getGithubSession(ghurl).then( (session) => {
      sess = session;
      return sess.repo.commits(this.branch).fetch();
    })
    .then( (sha) => {
      return sess.repo.git.trees(sha.sha).fetch();
    })
    .then( (tree) => {
      let blobreads = [];
      sess.paths = [];
      tree.tree.forEach( (item) => {
        console.log(item.path, item.type, item.size);
        sess.paths.push(item.path);
        if (item.type == 'blob' && !this.isFileIgnored(item.path)) {
          var read = sess.repo.git.blobs(item.sha).fetch().then( (blob) => {
            var path = sess.prefix + item.path;
            var size = item.size;
            var encoding = blob.encoding;
            var isBinary = isProbablyBinary(item.path, blob);
            var data = blob.content;
            if (blob.encoding == 'base64') {
              var bindata = stringToByteArray(atob(data));
              data = isBinary ? bindata : byteArrayToUTF8(bindata);
            }
            if (blob.size != data.length) {
              data = data.slice(0, blob.size);
            }
            return (deststore || this.store).setItem(path, data);
          });
          blobreads.push(read);
        } else {
          console.log("ignoring " + item.path);
        }
      });
      return Promise.all(blobreads);
    })
    .then( (blobs) => {
      return sess;
    });
  }
  
  importAndPull(ghurl:string) {
    return this.import(ghurl).then((sess) => {
      return this.pull(ghurl);
    });
  }

  publish(reponame:string, desc:string, license:string, isprivate:boolean) : Promise<GHSession> {
    var repo;
    return this.github.user.repos.create({
      name: reponame,
      description: desc,
      private: isprivate,
      auto_init: false,
      license_template: license
    })
    .then( (_repo) => {
      repo = _repo;
      // create README.md
      var s = README_md_template;
      s = s.replace(/\$NAME/g, encodeURIComponent(reponame));
      s = s.replace(/\$PLATFORM/g, encodeURIComponent(this.project.platform_id));
      s = s.replace(/\$GITHUBURL/g, encodeURIComponent(repo.html_url));
      s = s.replace(/\$MAINFILE/g, encodeURIComponent(this.project.stripLocalPath(this.project.mainPath)));
      var config = {
        message: '8bitworkshop: updated metadata in README.md',
        content: btoa(s)
      }
      return repo.contents('README.md').add(config);
    })
    .then( () => {
      return this.getGithubSession(repo.htmlUrl);
    })
    .then( (sess) => {
      this.bind(sess, true);
      return sess;
    });
  }
  
  commitPush( ghurl:string, message:string, files:{path:string,data:FileData}[] ) : Promise<GHSession> {
    var sess : GHSession;
    var repo;
    var head;
    var tree;
    return this.getGithubSession(ghurl).then( (session) => {
      sess = session;
      repo = sess.repo;
      return repo.git.refs.heads(this.branch).fetch();
    }).then( (_head) => {
      head = _head;
      return repo.git.trees(head.object.sha).fetch();
    }).then( (_tree) => {
      tree = _tree;
      return Promise.all(files.map( (file) => {
        if (typeof file.data === 'string') {
          return repo.git.blobs.create({
            content: file.data,
            encoding: 'utf-8'
          });
        } else {
          return repo.git.blobs.create({
            content: btoa(byteArrayToString(file.data)),
            encoding: 'base64'
          });
        }
      }));
    }).then( (blobs) => {
      return repo.git.trees.create({
        tree: files.map( (file, index) => {
          return {
            path: file.path,
            mode: '100644',
            type: 'blob',
            sha: blobs[index]['sha']
          };
        }),
        base_tree: tree.sha
      });
    }).then( (tree) => {
      return repo.git.commits.create({
        message: message,
        tree: tree.sha,
        parents: [
          head.object.sha
        ]
      });
    }).then( (commit) => {
      return repo.git.refs.heads(this.branch).update({
        sha: commit.sha
      });
    }).then( (update) => {
      return sess;
    });
  }
  
  deleteRepository(ghurl:string) {
    return this.getGithubSession(ghurl).then( (session) => {
      return session.repo.remove();
    });
  }

}
