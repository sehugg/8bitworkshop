
import { getFolderForPath, isProbablyBinary, stringToByteArray } from "./util";
import { FileData } from "./workertypes";
import { CodeProject } from "./project";

// in index.html
declare var exports;
declare var firebase;

interface GHSession {
  url : string;
  user : string;
  reponame : string;
  repo : any;
  prefix : string;
  paths? : string[];
}

export class GithubService {

  github;
  store;
  project : CodeProject;
  branch : string = "master";

  constructor(github, store, project : CodeProject) {
    this.github = github;
    this.store = store;
    this.project = project;
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
    console.log(toks);
    if (toks.length < 5) return null;
    if (toks[0] != 'https:') return null;
    if (toks[2] != 'github.com') return null;
    return {user:toks[3], repo:toks[4]};
  }
  
  getPrefix(user, reponame) : string {
    return 'shared/' + user + '-' + reponame + '/';
  }

  getGithubRepo(ghurl:string) : Promise<GHSession> {
    return new Promise( (yes,no) => {
      var urlparse = this.parseGithubURL(ghurl);
      if (!urlparse) {
        no("Please enter a valid GitHub URL.");
      }
      var sess = {
        url: ghurl,
        user: urlparse.user,
        reponame: urlparse.repo,
        prefix: this.getPrefix(urlparse.user, urlparse.repo),
        repo: this.github.repos(urlparse.user, urlparse.repo)
      };
      yes(sess);
    });
  }

  // bind a folder path to the Github URL in local storage  
  bind(sess : GHSession, dobind : boolean) {
    var key = '__github_url_' + sess.prefix;
    // TODO: this doesn't work b/c it binds the entire root to a url
    if (!key.endsWith('/'))
      key = key + '/';
    console.log('bind', key, dobind);
    if (dobind)
      localStorage.setItem(key, sess.url);
    else
      localStorage.removeItem(key);
  }
  
  getBoundURL(path : string) : string {
    var p = getFolderForPath(path);
    var key = '__github_url_' + p + '/';
    console.log(key);
    return localStorage.getItem(key) as string; // TODO
  }

  import(ghurl:string) : Promise<GHSession> {
    var sess : GHSession;
    return this.getGithubRepo(ghurl).then( (session) => {
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
          var read = sess.repo.git.blobs(item.sha).readBinary().then( (blob) => {
            var path = sess.prefix + item.path;
            var size = item.size;
            var isBinary = isProbablyBinary(blob);
            var data = isBinary ? stringToByteArray(blob) : blob; //byteArrayToUTF8(blob);
            return this.store.setItem(path, data);
          });
          blobreads.push(read);
        } else {
          console.log("ignoring " + item.path);
        }
      });
      return Promise.all(blobreads);
    })
    .then( (blobs) => {
      this.bind(sess, true);
      return sess;
    });
  }

  publish(reponame:string, desc:string, license:string, isprivate:boolean) : Promise<GHSession> {
    return this.github.user.repos.create({
      name: reponame,
      description: desc,
      private: isprivate,
      auto_init: true,
      license_template: license
    })
    .then( (repo) => {
      let sess = {
        url: repo.htmlUrl,
        user: repo.owner.login,
        reponame: reponame,
        repo: repo,
        prefix : ''
      };
      this.bind(sess, true);
      return sess;
    });
  }
  
  commitPush( ghurl:string, message:string, files:{path:string,data:FileData}[] ) : Promise<GHSession> {
    var sess : GHSession;
    var repo;
    var head;
    var tree;
    return this.getGithubRepo(ghurl).then( (session) => {
      sess = session;
      repo = sess.repo;
      return repo.git.refs.heads(this.branch).fetch();
    }).then( (_head) => {
      head = _head;
      return repo.git.trees(head.object.sha).fetch();
    }).then( (_tree) => {
      tree = _tree;
      return Promise.all(files.map( (file) => {
        return repo.git.blobs.create({
          content: file.data,
          encoding: 'utf-8'
        });
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

}
