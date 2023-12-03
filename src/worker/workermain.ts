
import type { WorkerResult, WorkerMessage, WorkerError, SourceLine } from "../common/workertypes";
import { getBasePlatform, getRootBasePlatform } from "../common/util";
import { TOOL_PRELOADFS } from "./workertools";
import { store, builder, errorResult, getWorkFileAsString } from "./builder";
import { emglobal, fsMeta, loadFilesystem } from "./wasmutils";

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
    console.log('require', modname, exports[modname] != null);
    return exports[modname];
  }
}

////////////////////////////

//const waitFor = delay => new Promise(resolve => setTimeout(resolve, delay)); // for testing

async function handleMessage(data: WorkerMessage): Promise<WorkerResult> {
  // preload file system
  if (data.preload) {
    var fs = TOOL_PRELOADFS[data.preload];
    if (!fs && data.platform)
      fs = TOOL_PRELOADFS[data.preload + '-' + getBasePlatform(data.platform)];
    if (!fs && data.platform)
      fs = TOOL_PRELOADFS[data.preload + '-' + getRootBasePlatform(data.platform)];
    if (fs && !fsMeta[fs])
      loadFilesystem(fs);
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
