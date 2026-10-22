
// gluehandlers.ts - keep the Emscripten glue from taking the host down
//
// The WASM builds of the compilers and assemblers are Emscripten modules.
// Under Node they install process-level handlers when they load: one that
// aborts the host on an unhandled rejection, and one that rethrows any
// uncaught exception that is not one of their own exit-status errors. Node
// turns a rethrow from an uncaughtException handler into exit code 7, so a
// single stray error anywhere in the host takes the whole process down: a
// mocha worker dies with it (and the test that caused it is never reported),
// and the CLI exits 7 with no message.
//
// The host owns these events. Ignore the handlers the glue adds; the build
// catches tool errors itself.

/** The process events the glue hooks to abort the host. */
const GLUE_EVENTS = ['uncaughtException', 'unhandledRejection'];

/** The glue lives in these directories, under src/ or gen/. */
const GLUE_PATH = /[\\/](?:src|gen)[\\/]worker[\\/](?:wasm|asmjs)[\\/]/;

/** The glue scripts this host has loaded, by path. */
const glueScripts = new Set<string>();

let installed = false;

/** Note a glue script, so its handlers are recognized by path. */
export function noteGlueScript(path: string) {
  glueScripts.add(path);
}

/**
 * Stop the Emscripten glue from adding process-level uncaughtException and
 * unhandledRejection handlers. Call it before the first tool is loaded.
 * Safe to call more than once.
 */
export function ignoreGlueProcessHandlers() {
  if (installed) return;
  installed = true;
  const fromGlue = () => {
    const stack = new Error().stack || '';
    for (const script of glueScripts) if (stack.includes(script)) return true;
    // the glue may have been loaded through another importScripts shim
    return GLUE_PATH.test(stack);
  };
  for (const method of ['on', 'addListener', 'prependListener'] as const) {
    const original = process[method];
    (process as any)[method] = function (event: string | symbol, listener: (...args: any[]) => void) {
      if (GLUE_EVENTS.includes(event as string) && fromGlue()) return this;
      return original.call(this, event, listener);
    };
  }
}
