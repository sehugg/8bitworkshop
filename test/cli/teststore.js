"use strict";

var vm = require('vm');
var fs = require('fs');
var assert = require('assert');
var includeInThisContext = function(path) {
    var code = fs.readFileSync(path);
    vm.runInThisContext(code, path);
};

var localItems = {};
var localMods = 0;

global.localStorage = {
 clear: function() {
  localItems = {};
  localMods = 0;
  this.length = 0;
 },
 getItem: function(k) {
  console.log('get',k);
  return localItems[k];
 },
 setItem: function(k,v) {
  console.log('set',k,v);
  if (!localItems[k]) this.length++;
  localItems[k] = v;
  localMods++;
 },
 removeItem: function(k) {
  if (localItems[k]) {
   this.length--;
   delete localItems[k];
   localMods++;
  }
 },
 length: 0,
 key: function(i) {
  var keys = [];
  for (var k in localItems)
   keys.push(k);
  console.log(i,keys[i]);
  return keys[i];
 }
};

includeInThisContext("localForage/dist/localforage.js");
includeInThisContext("gen/util.js");
includeInThisContext("src/store.js");
var prj = require("../../gen/project.js");

var test_platform_id = "_TEST";

describe('Store', function() {
  it('Should convert from local storage', function(done) {
   localStorage.clear();
   localStorage.setItem('_TEST/test', 'a');
   localStorage.setItem('_TEST/local/test', 'b');
   assert.equal(2, localMods);
   var store = createNewPersistentStore(test_platform_id, function() {
    assert.equal('true', localItems['__migrated__TEST']);
    store.getItem('test', function(err, result) {
      if (err) done(err);
      assert.equal(result, 'a');
      assert.equal(7, localMods);
      done();
    });
   });
  });

  it('Should load local project', function(done) {
   localStorage.clear();
   localStorage.setItem('_TEST/test', 'a');
   var store = createNewPersistentStore(test_platform_id, function() {
    var worker = {};
    var platform = {};
    var project = new prj.CodeProject(worker, test_platform_id, platform, store);
    project.loadFiles(['test'], function(err, result) {
     assert.equal(null, err);
     assert.deepEqual([ { path: 'test', filename: 'test', data: 'a' } ], result);
     done();
    });
   });
  });
  
  it('Should build project', function(done) {
   localStorage.clear();
   localItems['__migrated__TEST'] = 'true';
   var msgs = [];
   var expectmsgs = [
    true,
    { preload: 'dasm', platform: '_TEST' },
    { 
      buildsteps: [
       { path: "test.a", platform: "_TEST", tool: "dasm", mainfile:true },
      ],
      updates: [
       { path: "test.a", data: " lda #0" }
      ]
    }
   ];
   var store = createNewPersistentStore(test_platform_id);
   var worker = {
    postMessage: function(m) { msgs.push(m); },
   };
   var platform = {
    getToolForFilename: function(fn) { return 'dasm'; },
   };
   var project = new prj.CodeProject(worker, test_platform_id, platform, store);
   project.callbackBuildStatus = function(b) { msgs.push(b) };
   project.updateFile('test.a', ' lda #0');
   project.updateFile('test.a', ' lda #1'); // don't send twice (yet)
   assert.deepEqual(msgs, expectmsgs);
   store.getItem('test.a', function(err, result) {
    assert.equal(null, err);
    assert.equal(' lda #1', result);
    done();
   });
  });

  // lines: [ { line: 3, offset: 61440, insns: 'a9 00', iscode: true } ] }

  it('Should build project', function(done) {
   localStorage.clear();
   localItems['__migrated__TEST'] = 'true';
   var msgs = [];
   var store = createNewPersistentStore(test_platform_id);
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
   assert.equal(3, lst.sourcefile.findLineForOffset(61440+15));
   assert.equal(null, lst.sourcefile.findLineForOffset(61440+16));
   assert.equal(null, lst.sourcefile.findLineForOffset(61440-1));
   assert.equal(1, lst.sourcefile.lineCount());
   done();
  });

});
