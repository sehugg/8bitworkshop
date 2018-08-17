"use strict";

// TODO: use modules; export type for LocalForageDbMethods
//import * as localforage from "localforage";
declare var localforage;

var OldFileStore = function(storage, prefix:string) {
  var self = this;
  this.saveFile = function(name, text) {
    storage.setItem(prefix + name, text);
  }
  this.loadFile = function(name) {
    return storage.getItem(prefix + name) || storage.getItem(name);
  }
  this.getFiles = function(prefix2) {
    // iterate over files with <platform>/<dir> prefix
    var files = [];
    for (var i = 0; i < storage.length; i++) {
      var key = storage.key(i);
      if (key.startsWith(prefix + prefix2)) {
        var name = key.substring(prefix.length + prefix2.length);
        files.push(name);
      }
    }
    return files;
  }
  this.deleteFile = function(name) {
    storage.removeItem(prefix + name);
    storage.removeItem(prefix + 'local/' + name); //TODO?
  }
}

/*
// localforage-compatible driver for old file store format
var OldFileStoreDriver = {
    _driver: 'oldFileStoreDriver',
    _initStorage: function(options) {
        this._store = new OldFileStore(localStorage, options.name + '/');
    },
    clear: function(callback) {
      // Custom implementation here...
    },
    getItem: function(key, callback) {
      callback(null, this._store.loadFile(key));
    },
    iterate: function(iteratorCallback, successCallback) {
      // Custom implementation here...
    },
    key: function(n, callback) {
        // Custom implementation here...
    },
    keys: function(callback) {
      callback(this._store.getFiles(''));
    },
    length: function(callback) {
      callback(this._store.getFiles('').length);
    },
    removeItem: function(key, callback) {
      this._store.deleteFile(key);
      callback();
    },
    setItem: function(key, value, callback) {
      this._store.saveFile(key, value);
      callback();
    }
}
localforage.defineDriver(OldFileStoreDriver);
*/

// copy localStorage to new driver
function copyFromOldStorageFormat(platformid:string, newstore, conversioncallback:()=>void) {
  var alreadyMigratedKey = "__migrated_" + platformid;
  //localStorage.removeItem(alreadyMigratedKey);
  if (localStorage.getItem(alreadyMigratedKey))
    return;
  var oldstore = new OldFileStore(localStorage, platformid + '/');
  var keys = oldstore.getFiles('');
  // no files to convert?
  if (keys.length == 0) {
    localStorage.setItem(alreadyMigratedKey, 'true');
    return;
  }
  // convert function
  function migrateNext() {
    var key = keys.shift();
    var value = oldstore.loadFile(key);
    newstore.setItem(key, value, function(err, result) {
      if (err) {
        console.log(err);
      } else {
        console.log("Converted " + key);
        if (keys.length) {
          migrateNext();
        } else {
          newstore.length(function(err, len) {
            if (err) throw err;
            console.log("Migrated " + len + " local files to new data store");
            if (len) {
              localStorage.setItem(alreadyMigratedKey, 'true');
              if (conversioncallback)
                conversioncallback();
              else
                window.location.reload();
            }
          });
        }
      }
    });
  }
  migrateNext(); // start the conversion
}

export function createNewPersistentStore(platformid:string, callback:()=>void) {
  var store = localforage.createInstance({
    name: "__" + platformid,
    version: 2.0
  });
  copyFromOldStorageFormat(platformid, store, callback);
  return store;
}
