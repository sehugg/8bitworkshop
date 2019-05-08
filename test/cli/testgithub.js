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
  // pzpinfo user
  var project = new prj.CodeProject({}, platform_id||test_platform_id, null, store);
  project.mainPath = 'local/main.asm';
  project.updateFileInStore(project.mainPath, '\torg $0 ; test\n');
  return new serv.GithubService(Octokat, process.env.TEST8BIT_GITHUB_TOKEN, store, project);
}

const t0 = new Date().getTime();

describe('Store', function() {

  it('Should import from Github (check README)', function(done) {
    var store = mstore.createNewPersistentStore(test_platform_id, function(store) {
      var gh = newGH(store);
      gh.importAndPull('https://github.com/pzpinfo/testrepo1557322631070').then( (sess) => {
        console.log(sess.paths);
        assert.equal(2, sess.paths.length);
        // TODO: test for presence in local storage, make sure returns keys
        done();
      });
    });
  });

  it('Should import from Github (no README)', function(done) {
    var store = mstore.createNewPersistentStore(test_platform_id, function(store) {
      var gh = newGH(store);
      gh.importAndPull('https://github.com/pzpinfo/testrepo3').then( (sess) => {
        console.log(sess.paths);
        assert.equal(3, sess.paths.length);
        // TODO: test for presence in local storage, make sure returns keys
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
      // should fail
      gh.publish('testrepo'+t0, "new description", "mit", false).then( (sess) => {
        done();
      });
    });
  });

  it('Should commit/push to Github', function(done) {
    var store = mstore.createNewPersistentStore(test_platform_id, function(store) {
      var gh = newGH(store);
      var files = [
        {path:'text.txt', data:'hello world'}
      ];
      gh.commitPush('https://github.com/pzpinfo/testrepo3', 'test commit', files).then( (sess) => {
        done();
      });
    });
  });

  it('Should bind paths to Github', function(done) {
    var store = mstore.createNewPersistentStore(test_platform_id, function(store) {
      var gh = newGH(store);
      var sess = {repopath:'foo/bar', url:'_'};
      gh.bind(sess, true);
      assert.deepEqual(gh.getRepos(), {'foo/bar':'_'});
      gh.bind(sess, false);
      assert.deepEqual(gh.getRepos(), {});
      done();
    });
  });

});
