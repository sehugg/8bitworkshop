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

function newGH(store) {
  // pzpinfo user
  return new serv.GithubService(new Octokat({token:'ec64fdd81dedab8b7547388eabef09288e9243a9'}), store);
}

describe('Store', function() {

  it('Should import from Github', function(done) {
    var store = mstore.createNewPersistentStore(test_platform_id, function(store) {
      var gh = newGH(store);
      gh.import('https://github.com/sehugg/genemedic/extra/garbage').then( (sess) => {
        assert.equal(4, sess.paths.length);
        // TODO: test for presence in local storage, make sure returns keys
        done();
      });
    });
  });

  it('Should publish (fail) on Github', function(done) {
    var store = mstore.createNewPersistentStore(test_platform_id, function(store) {
      var gh = newGH(store);
      // should fail
      gh.publish('testrepo4').catch( (e) => {
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
      var sess = {prefix:'prefix', url:'_'};
      gh.bind(sess, true);
      assert.equal(gh.getBoundURL('prefix', '_'));
      gh.bind(sess, false);
      assert.equal(gh.getBoundURL('prefix', null));
      done();
    });
  });

});
