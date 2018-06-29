"use strict";

var vm = require('vm');
var fs = require('fs');
var assert = require('assert');
var includeInThisContext = function(path) {
    var code = fs.readFileSync(path);
    vm.runInThisContext(code, path);
};

includeInThisContext("localForage/dist/localforage.nopromises.js");
includeInThisContext("src/store.js");

var testplatform = "__TEST__";

var localItems = {};

global.localStorage = {
 getItem: function(k) {
  return localItems[k];
 },
 setItem: function(k,v) {
  localItems[k] = v;
 }
};

describe('Store', function() {
  it('Should create persistent store', function() {
   var store = createNewPersistentStore(testplatform);
   // TODO
  });
});
