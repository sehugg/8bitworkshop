import * as assert from 'assert';
import { WorkerHandle, WorkerDisposedError } from '../src/engine';
import { Rpc } from '../src/rpc';

/** A handle whose rpc never gets a reply, so calls stay pending. */
function pendingHandle(log: (msg: string) => void) {
  var handle = new WorkerHandle('fake.js', '', {}, log);
  var port: any = { on() { }, postMessage() { }, terminate() { } };
  (handle as any).rpc = new Rpc(port);
  return handle;
}

describe('WorkerHandle.notify', function () {
  it('ignores a call pending when the worker is disposed', async function () {
    var logged: string[] = [];
    var handle = pendingHandle(m => logged.push(m));
    var unhandled: any[] = [];
    var onUnhandled = (e: any) => unhandled.push(e);
    process.on('unhandledRejection', onUnhandled);
    try {
      handle.notify('setMuted', true);
      handle.dispose();
      await new Promise(r => setImmediate(r));
    } finally {
      process.off('unhandledRejection', onUnhandled);
    }
    assert.deepEqual(unhandled, []);
    assert.deepEqual(logged, []);
  });

  it('logs other failures', async function () {
    var logged: string[] = [];
    var handle = pendingHandle(m => logged.push(m));
    handle.notify('setMuted', true);
    (handle as any).rpc.rejectAll(new Error('boom'));
    await new Promise(r => setImmediate(r));
    assert.equal(logged.length, 1);
    assert.ok(logged[0].includes('boom'), logged[0]);
  });

  it('call() still rejects with WorkerDisposedError on dispose', async function () {
    var handle = pendingHandle(() => { });
    var p = handle.call('x');
    handle.dispose();
    await assert.rejects(p, WorkerDisposedError);
  });
});
