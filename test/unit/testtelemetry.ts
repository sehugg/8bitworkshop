import assert from "assert";
import fs from "fs";
import os from "os";
import path from "path";
import { after, before, describe, it } from "mocha";
import { ErrorPayload, ErrorReporter, MAX_REPORTS_PER_SESSION } from "../../src/common/telemetry";
import { fixParamsWithDefines, gatherFiles } from "../../src/worker/builder";
import { TOOLS } from "../../src/worker/workertools";
import { compileSourceFile } from "../../src/tools/testlib";

describe("ErrorReporter", function () {
  function reporter() {
    const sent: ErrorPayload[] = [];
    return { sent, r: new ErrorReporter('ide', p => sent.push(p), { version: '1.2' }) };
  }

  it("sends source, message, and fields", function () {
    const { sent, r } = reporter();
    assert.ok(r.report("boom", "at foo", { tool: "cc65", platform: "nes" }, 'worker'));
    assert.strictEqual(sent.length, 1);
    assert.strictEqual(sent[0].source, 'worker');
    assert.strictEqual(sent[0].msg, 'boom');
    assert.strictEqual(sent[0].stack, 'at foo');
    assert.strictEqual(sent[0].tool, 'cc65');
    assert.strictEqual(sent[0].version, '1.2');
  });

  it("sends the same error once per session", function () {
    const { sent, r } = reporter();
    r.report("boom", "", { tool: "cc65" });
    assert.ok(!r.report("boom", "", { tool: "cc65" }));
    // a different tool is a different error
    assert.ok(r.report("boom", "", { tool: "sdcc" }));
    assert.strictEqual(sent.length, 2);
  });

  it("stops after the session limit", function () {
    const { sent, r } = reporter();
    for (let i = 0; i < MAX_REPORTS_PER_SESSION + 5; i++) r.report("error " + i);
    assert.strictEqual(sent.length, MAX_REPORTS_PER_SESSION);
  });

  it("clamps long fields", function () {
    const { sent, r } = reporter();
    r.report("x".repeat(10000), "y".repeat(10000));
    assert.strictEqual(sent[0].msg.length, 500);
    assert.strictEqual(sent[0].stack.length, 2000);
  });
});

describe("Build tool crashes", function () {
  let dir: string;
  const tools = TOOLS as any;

  before(function () {
    dir = fs.mkdtempSync(path.join(os.tmpdir(), "8bws-telemetry-"));
    tools.test_crash = () => { throw new TypeError("cannot read properties of undefined"); };
    // a malformed directive: the user's mistake, which a real tool reports the same way
    tools.test_usererror = (step: any) => {
      gatherFiles(step);
      fixParamsWithDefines(step.path, step.params);
      return { output: new Uint8Array(1) };
    };
  });

  after(function () {
    delete tools.test_crash;
    delete tools.test_usererror;
    fs.rmSync(dir, { recursive: true, force: true });
  });

  function source(name: string, code: string) {
    const fn = path.join(dir, name);
    fs.writeFileSync(fn, code);
    return fn;
  }

  it("flags an exception in a tool as internal", async function () {
    const result = await compileSourceFile("test_crash", "nes", source("crash.c", "int main;\n"));
    assert.ok(!result.success);
    assert.ok(result.internal, "expected internal");
    assert.strictEqual(result.internal.tool, "test_crash");
    assert.strictEqual(result.internal.platform, "nes");
    assert.match(result.internal.msg, /cannot read properties/);
    assert.match(result.internal.stack, /TypeError/);
    // the user still sees it as a build error
    assert.match(result.errors[0].msg, /cannot read properties/);
  });

  it("doesn't flag a bad build directive", async function () {
    const result = await compileSourceFile("test_usererror", "nes", source("bad.c", '//#symbol ld BAD="str"\n'));
    assert.ok(!result.success);
    assert.match(result.errors[0].msg, /build directive error/);
    assert.strictEqual(result.internal, undefined);
  });
});
