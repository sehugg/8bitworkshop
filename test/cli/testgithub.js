"use strict";

var vm = require('vm');
var fs = require('fs');
var assert = require('assert');

var wtu = require('./workertestutils.js'); // loads localStorage
global.localforage = require("localForage/dist/localforage.js");
var util = require("gen/util.js");
var mstore = require("gen/store.js");
var prj = require("gen/project.js");
var serv = require("gen/services.js");
var Octokat = require('octokat');

var test_platform_id = "_TEST";

function newGH(store, platform_id) {
  localStorage.removeItem('__repos');
  // pzpinfo user
  var project = new prj.CodeProject({}, platform_id||test_platform_id, null, store);
  project.mainPath = 'local/main.asm';
  project.updateFileInStore(project.mainPath, '\torg $0 ; test\n');
  return new serv.GithubService(Octokat, process.env.TEST8BIT_GITHUB_TOKEN, store, project);
}

const t0 = new Date().getTime();

describe('Store', function() {

  it('Should import from Github (check README)', function(done) {
    var store = mstore.createNewPersistentStore('vcs', function(store) {
      var gh = newGH(store, 'vcs');
      gh.importAndPull('https://github.com/pzpinfo/test123123').then( (sess) => {
        console.log(sess.paths);
        assert.equal(2, sess.paths.length);
        assert.deepEqual(serv.getRepos(), {"pzpinfo/test123123":{url: 'https://github.com/pzpinfo/test123123', platform_id: 'vcs', mainPath:'helloworld.bas'}});
        done();
      });
    });
  });

  it('Should import from Github (binary files)', function(done) {
    var store = mstore.createNewPersistentStore('vcs', function(store) {
      var gh = newGH(store, 'vcs');
      gh.importAndPull('https://github.com/pzpinfo/testrepo3').then( (sess) => {
        console.log(sess.paths);
        assert.equal(4, sess.paths.length);
        var txt = localStorage.getItem('__vcs/text.txt');
        assert.equal(txt, '"hello world"');
        var bin = localStorage.getItem('__vcs/data.bin');
        console.log(bin);
        assert.equal(bin.length, 348+9); // encoded
        done();
      });
    });
  });

  it('Should import from Github (wrong platform)', function(done) {
    var store = mstore.createNewPersistentStore('_FOO', function(store) {
      var gh = newGH(store, '_FOO');
      gh.importAndPull('https://github.com/pzpinfo/testrepo1557326056720').catch( (e) => {
        assert.ok(e.startsWith('Platform mismatch'));
        done();
      });
    });
  });

  it('Should publish (fail) on Github', function(done) {
    var store = mstore.createNewPersistentStore(test_platform_id, function(store) {
      var gh = newGH(store);
      // should fail
      gh.publish('testrepo1').catch( (e) => {
        done();
      });
    });
  });

  it('Should publish new repository on Github', function(done) {
    var store = mstore.createNewPersistentStore(test_platform_id, function(store) {
      var gh = newGH(store);
      var reponame = 'testrepo'+t0;
      // should fail
      gh.publish(reponame, "new description", "mit", false).then( (sess) => {
        assert.ok(serv.getRepos()[sess.repopath]);
        return gh.deleteRepository(sess.url);
      }).then( () => {
        done();
      });
    });
  });

  it('Should commit/push to Github', function(done) {
    var store = mstore.createNewPersistentStore(test_platform_id, function(store) {
      var gh = newGH(store);
      var binfile = new Uint8Array(256);
      for (var i=0; i<256; i++)
        binfile[i] = i;
      var files = [
        {path:'text.txt', data:'hello world'},
        {path:'data.bin', data:binfile}
      ];
      gh.commitPush('https://github.com/pzpinfo/testrepo3', 'test commit', files).then( (sess) => {
        done();
      });
    });
  });

  it('Should bind paths to Github', function(done) {
    var store = mstore.createNewPersistentStore(test_platform_id, function(store) {
      var gh = newGH(store);
      var sess = {repopath:'foo/bar', url:'_', platform_id:'vcs',mainPath:'test.c'};
      gh.bind(sess, true);
      assert.deepEqual(serv.getRepos(), {'foo/bar':{url:'_',platform_id:'vcs',mainPath:'test.c'}});
      gh.bind(sess, false);
      assert.deepEqual(serv.getRepos(), {});
      gh.getGithubSession('https://github.com/foo/bar/baz').then((sess) => {
        assert.equal(sess.url, 'https://github.com/foo/bar');
        assert.equal(sess.repopath, 'foo/bar');
        done();
      });
    });
  });

});
