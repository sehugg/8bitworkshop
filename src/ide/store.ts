"use strict";

// TODO: don't need this file anymore?

declare var localforage;

export function createNewPersistentStore(storeid:string) {
  var store = localforage.createInstance({
    name: "__" + storeid,
    version: 2.0
  });
  return store;
}
