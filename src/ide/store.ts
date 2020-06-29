"use strict";

// TODO: don't need this file anymore?

declare var localforage;

export function createNewPersistentStore(storeid:string, callback?) {
  var store = localforage.createInstance({
    name: "__" + storeid,
    version: 2.0
  });
  if (callback != null) { callback(store); } // for tests only
  return store;
}
