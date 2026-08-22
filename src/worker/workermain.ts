
import type { WorkerResult, WorkerMessage, WorkerError, SourceLine } from "../common/workertypes";
import { getBasePlatform, getRootBasePlatform } from "../common/util";
import { getPreloadFSName } from "../common/toolmeta";
import { store, builder, errorResult, getWorkFileAsString } from "./builder";
import { emglobal, fsMeta, loadFilesystem, listSharedFiles, readSharedFile, ensureFilesystem, readWasiSharedFile, listWasiSharedFiles, ensureWasiFilesystem } from "./wasmutils";

// shared FS names starting with 'wasi:' refer to a WASI filesystem zip
function splitWasiFSName(fsName: string): { wasi: boolean, name: string } {
  return fsName.startsWith('wasi:') ? { wasi: true, name: fsName.substring(5) } : { wasi: false, name: fsName };
}

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
    var fs1 = splitWasiFSName(data.preload_fs);
    var contents = fs1.wasi ? await readWasiSharedFile(fs1.name, data.readshared)
      : (ensureFilesystem(fs1.name), await readSharedFile(fs1.name, data.readshared));
    return { output: contents, qid: data.qid } as WorkerResult;
  }
  // list files in a filesystem package directory (shared code)
  if (data.listshared != null) {
    var fs2 = splitWasiFSName(data.preload_fs);
    var files = fs2.wasi ? await listWasiSharedFiles(fs2.name, data.listshared)
      : (ensureFilesystem(fs2.name), listSharedFiles(fs2.name, data.listshared));
    return { output: files, qid: data.qid } as WorkerResult;
  }
  // preload a filesystem package directly by name
  if (data.preload_fs) {
    var fs3 = splitWasiFSName(data.preload_fs);
    if (fs3.wasi) await ensureWasiFilesystem(fs3.name);
    else ensureFilesystem(fs3.name);
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
