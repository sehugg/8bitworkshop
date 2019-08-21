"use strict";

var vm = require('vm');
var fs = require('fs');
var assert = require('assert');

var wtu = require('./workertestutils.js'); // loads localStorage
global.localforage = require("localForage/dist/localforage.js");
var util = require("gen/util.js");
var mstore = require("gen/store.js");
var prj = require("gen/project.js");

var test_platform_id = "_TEST";

describe('Store', function() {
  it('Should convert from local storage', function(done) {
   localStorage.clear();
   localStorage.setItem('_TEST/test', 'a');
   localStorage.setItem('_TEST/local/test', 'b');
   assert.equal(2, localMods);
   var store = mstore.createNewPersistentStore(test_platform_id, function(store) {
    assert.equal('true', localItems['__migrated__TEST']);
    store.getItem('test', function(err, result) {
      if (err) done(err);
      // did it convert?
      assert.equal(result, 'a');
      assert.equal(7, localMods);
      // did we not mess with original storage?
      assert.equal(localStorage.getItem('_TEST/test'), 'a');
      assert.equal(localStorage.getItem('_TEST/local/test'), 'b');
      done();
    });
   });
  });

  it('Should load local project', function(done) {
   localStorage.clear();
   localStorage.setItem('_TEST/local/test', 'a');
   var store = mstore.createNewPersistentStore(test_platform_id, function(store) {
    var worker = {};
    var platform = {};
    var project = new prj.CodeProject(worker, test_platform_id, platform, store);
    var remote = [];
    project.callbackGetRemote = function(path, success, datatype) {
      remote.push(path);
      success();
    };
    project.loadFiles(['local/test','test']).then((result) => {
     assert.deepEqual(["presets/_TEST/test"], remote);
     assert.deepEqual([ { path: 'local/test', filename: 'local/test', data: 'a', link:true } ], result);
     done();
    });
   });
  });

  it('Should build linked project', function(done) {
   localStorage.clear();
   localItems['__migrated__TEST'] = 'true';
   var msgs = [];
   var expectmsgs = [
    true,
    { preload: 'dasm', platform: '_TEST' },
    {
      buildsteps: [
       { path: "test.a", platform: "_TEST", tool: "dasm", mainfile:true, files:["test.a"] },
      ],
      updates: [
       { path: "test.a", data: " lda #0" }
      ]
    }
   ];
   var store = mstore.createNewPersistentStore(test_platform_id, (store) => {
    var worker = {
     postMessage: function(m) { msgs.push(m); },
    };
    var platform = {
     getToolForFilename: function(fn) { return 'dasm'; },
    };
    var project = new prj.CodeProject(worker, test_platform_id, platform, store);
    project.callbackBuildStatus = function(b) { msgs.push(b) };
    project.updateFile('test.a', ' lda #0');
    project.setMainFile('test.a');
    setTimeout(() => {
     project.updateFile('test.a', ' lda #1'); // don't send twice (yet)
     assert.deepEqual(msgs, expectmsgs);
     store.getItem('test.a', function(err, result) {
      assert.equal(null, err);
      assert.equal(' lda #1', result);
      done();
     });
    }, 1);
   });
  });

  // lines: [ { line: 3, offset: 61440, insns: 'a9 00', iscode: true } ] }

  it('Should build asm project', function(done) {
   localStorage.clear();
   localItems['__migrated__TEST'] = 'true';
   var msgs = [];
   var store = mstore.createNewPersistentStore(test_platform_id, (store) => {
    var worker = {
    };
    var platform = {
    };
    var project = new prj.CodeProject(worker, test_platform_id, platform, store);
    project.callbackBuildStatus = function(b) { msgs.push(b) };
    var buildresult = {
     listings: {
      test: {
       lines: [ { line: 3, offset: 61440, insns: 'a9 00', iscode: true } ]
      }
     }
    };
    worker.onmessage({data:buildresult});
    assert.deepEqual([false], msgs);
    var lst = buildresult.listings.test;
    console.log(lst);
    assert.equal(3, lst.sourcefile.findLineForOffset(61440+15, 15));
    assert.equal(null, lst.sourcefile.findLineForOffset(61440+16, 15));
    assert.equal(null, lst.sourcefile.findLineForOffset(61440+1, 0));
    assert.equal(null, lst.sourcefile.findLineForOffset(61440-1, 16));
    assert.equal(1, lst.sourcefile.lineCount());
    done();
   });
  });

});
