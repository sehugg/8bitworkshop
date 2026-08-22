
import type { WorkerResult, WorkerMessage, WorkerError, SourceLine } from "../common/workertypes";
import { getBasePlatform, getRootBasePlatform } from "../common/util";
import { getPreloadFSName } from "../common/toolmeta";
import { store, builder, errorResult, getWorkFileAsString } from "./builder";
import { emglobal, fsMeta, loadFilesystem, listSharedFiles, readSharedFile, ensureFilesystem } from "./wasmutils";

declare function importScripts(path: string);
declare function postMessage(msg);

export function setupRequireFunction() {
  var exports = {};
  exports['jsdom'] = {
    JSDOM: function (a, b) {
      this.window = {};
    }
  };
  emglobal['require'] = (modname: string) => {
    // Emscripten glue may ask for Node builtins when running outside the browser
    if (modname === 'path' || modname === 'fs') {
      try { return require(modname); } catch (e) { }
    }
    console.log('require', modname, exports[modname] != null);
    return exports[modname];
  }
}

////////////////////////////

//const waitFor = delay => new Promise(resolve => setTimeout(resolve, delay)); // for testing

async function handleMessage(data: WorkerMessage): Promise<WorkerResult> {
  // preload file system
  if (data.preload) {
    var fs = getPreloadFSName(data.preload, data.platform && getBasePlatform(data.platform))
      || getPreloadFSName(data.preload, data.platform && getRootBasePlatform(data.platform));
    if (fs && !fsMeta[fs])
      loadFilesystem(fs);
    return;
  }
  // read a file from a filesystem package (shared code)
  if (data.readshared) {
    ensureFilesystem(data.preload_fs);
    var contents = await readSharedFile(data.preload_fs, data.readshared);
    return { output: contents, qid: data.qid } as WorkerResult;
  }
  // list files in a filesystem package directory (shared code)
  if (data.listshared != null) {
    ensureFilesystem(data.preload_fs);
    var files = listSharedFiles(data.preload_fs, data.listshared);
    return { output: files, qid: data.qid } as WorkerResult;
  }
  // preload a filesystem package directly by name
  if (data.preload_fs) {
    ensureFilesystem(data.preload_fs);
    return;
  }
  // clear filesystem? (TODO: buildkey)
  if (data.reset) {
    store.reset();
    return;
  }
  return builder.handleMessage(data);
}

const ENVIRONMENT_IS_WORKER = typeof importScripts === 'function';
if (ENVIRONMENT_IS_WORKER) {
  var lastpromise = null;
  onmessage = async function (e) {
    await lastpromise; // wait for previous message to complete
    lastpromise = handleMessage(e.data);
    var result = await lastpromise;
    lastpromise = null;
    if (result) {
      try {
        postMessage(result);
      } catch (e) {
        console.log(e);
        postMessage(errorResult(`${e}`));
      }
    }
  }
}
