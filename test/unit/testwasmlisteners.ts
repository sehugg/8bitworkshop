import assert from "assert";
import { describe, it } from "mocha";
import { compile, initialize, preload } from "../../src/tools/testlib";

// Emscripten glue adds process-wide uncaughtException/unhandledRejection
// handlers each time a tool module is instantiated. Those handlers rethrow or
// abort, which kills a long-lived host (the VS Code extension), and they pile up.
describe("emscripten process listeners", function () {
  this.timeout(60000);

  const counts = () => ({
    uncaught: process.listenerCount('uncaughtException'),
    rejection: process.listenerCount('unhandledRejection'),
  });

  it("stay flat across builds", async function () {
    await preload('ca65', 'nes');
    const before = counts();
    for (let i = 0; i < 12; i++) {
      const result = await compile({
        tool: 'ca65', platform: 'nes', path: 'main.s',
        code: `\t.export _main\n\t.segment "CODE"\n_main:\tlda #${i}\n\trts\n`,
      });
      assert.ok(result.errors === undefined || result.errors.length === 0, JSON.stringify(result.errors));
    }
    assert.deepStrictEqual(counts(), before);
  });

  it("keeps listeners the host adds itself", async function () {
    await initialize();
    const mine = () => { };
    process.on('unhandledRejection', mine);
    try {
      assert.ok(process.listeners('unhandledRejection').includes(mine));
    } finally {
      process.off('unhandledRejection', mine);
    }
  });
});
