"use strict";

var vm = require('vm');
var fs = require('fs');
var assert = require('assert');

var wtu = require('./workertestutils.js'); // loads localStorage
global.localforage = require("lib/localforage.min.js");
var util = require("gen/common/util.js");
var mstore = require("gen/ide/store.js");
var prj = require("gen/ide/project.js");
var serv = require("gen/ide/services.js");
var Octokat = require('octokat');

var test_platform_id = "_TEST";

function newGH(store, platform_id) {
  localStorage.clear();
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
      gh.importAndPull('https://github.com/pzpinfo/test123123/').then( (sess) => {
        console.log(sess.paths);
        assert.equal(2, sess.paths.length);
        assert.deepEqual(serv.getRepos(), {"pzpinfo/test123123":{
          url: 'https://github.com/pzpinfo/test123123/', 
          platform_id: 'vcs', 
          mainPath:'helloworld.bas', 
          branch:'master'
          //sha:'e466d777810838065b7682587ca592c3eefc0b1c'
          }});
        done();
      });
    });
  });

  it('Should import from Github (default branch)', function(done) {
    var store = mstore.createNewPersistentStore('nes', function(store) {
      var gh = newGH(store, 'nes');
      gh.importAndPull('https://github.com/sehugg/mdf2020-nes').then( (sess) => {
        console.log(sess.paths);
        done();
      });
    });
  });

  it('Should import from Github (explicit branch)', function(done) {
    var store = mstore.createNewPersistentStore('nes', function(store) {
      var gh = newGH(store, 'nes');
      gh.importAndPull('https://github.com/sehugg/mdf2020-nes/tree/main').then( (sess) => {
        console.log(sess.paths);
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
        assert.ok(e.message.startsWith('Platform mismatch'));
        done();
      });
    });
  });

  it('Should import from Github (invalid URL)', function(done) {
    var store = mstore.createNewPersistentStore('_FOO', function(store) {
      var gh = newGH(store, '_FOO');
      gh.importAndPull('https://github.com/pzpinfo/NOEXISTSREPO').catch( (e) => {
        console.log(e);
        assert.deepEqual(serv.getRepos(), {});
        done();
      });
    });
  });

  it('Should import from Github (subdirectory tree)', function(done) {
    var store = mstore.createNewPersistentStore('nes', function(store) {
      var gh = newGH(store, 'nes');
      gh.importAndPull('https://github.com/brovador/NESnake/tree/master/src').then( (sess) => {
        console.log(sess.paths);
        assert.equal(14, sess.paths.length);
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
        //assert.ok(serv.getRepos()[sess.repopath]);
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
      gh.commit('https://github.com/pzpinfo/testrepo3', 'test commit', files).then( (sess) => {
        return gh.push(sess);
      }).then( (sess) => {
        console.log(sess.commit);
        assert.equal(0, sess.commit.files.length);
        done();
      });
    });
  });

  it('Should commit/push to Github (subdirectory tree)', function(done) {
    var store = mstore.createNewPersistentStore(test_platform_id, function(store) {
      var gh = newGH(store);
      var files = [
        {path:'text.txt', data:'hello world'}
      ];
      gh.commit('https://github.com/brovador/NESnake/tree/master/src', 'test commit', files)
      .catch( (e) => {
        console.log(e);
        assert.equal(e.message, 'Sorry, right now you can only commit files to the root directory of a repository.');
        done();
      });
      /*.then( (sess) => {
        done();
      });*/
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
      gh.getGithubSession('https://github.com/foo/bar/tree').then((sess) => {
        assert.equal(sess.url, 'https://github.com/foo/bar/tree');
        assert.equal(sess.repopath, 'foo/bar');
        done();
      });
    });
  });

});
