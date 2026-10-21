var assert = require('assert');
var fs = require('fs');
var os = require('os');
var path = require('path');
var { execFileSync } = require('child_process');

const compatcheck = require('gen/tools/compatcheck.js');

// The release whose examples the compatibility check builds.
const TAG = '3.12.1';
const BASELINE = path.join(__dirname, '../compat/3.12.1.json');

// Is the tag in this checkout? A shallow clone (CI) may not have it.
function haveTag() {
    try {
        execFileSync('git', ['rev-parse', '--verify', TAG], { stdio: 'ignore' });
        return true;
    } catch (e) {
        return false;
    }
}

// A fake release tree, to check the example list parser without a checkout.
function makeTree(files) {
    var dir = fs.mkdtempSync(path.join(os.tmpdir(), '8bws-compat-test-'));
    fs.mkdirSync(path.join(dir, 'src/platform'), { recursive: true });
    fs.mkdirSync(path.join(dir, 'presets/demo'), { recursive: true });
    for (var name of Object.keys(files)) {
        fs.writeFileSync(path.join(dir, 'src/platform', name), files[name]);
    }
    return dir;
}

describe('compat check', function () {

    describe('the example list of an old release', function () {

        it('should read the presets of a platform class', function () {
            var tree = makeTree({
                'demo.ts': `
                    const DEMO_PRESETS = [
                      {id: 'hello.c', name: 'Hello World'},
                      {id: 'bye.c', name: 'Bye'},
                    ];
                    class DemoPlatform {
                      getPresets() { return DEMO_PRESETS; }
                    }
                    PLATFORMS['demo'] = DemoPlatform;
                `,
            });
            var r = compatcheck.parseOldExamples(tree);
            assert.equal(r.problems.length, 0);
            assert.deepEqual(r.examples.map((e) => e.id).sort(), ['bye.c', 'hello.c']);
            assert.equal(r.examples[0].folder, 'demo');
            fs.rmSync(tree, { recursive: true, force: true });
        });

        it('should read a platform written as a function', function () {
            var tree = makeTree({
                'demo.ts': `
                    var DEMO_PRESETS = [ {id: 'hello.c', name: 'Hello'} ];
                    var DemoPlatform = function(mainElement) {
                      this.getPresets = function() {
                        return DEMO_PRESETS;
                      }
                    }
                    PLATFORMS['demo'] = DemoPlatform;
                `,
            });
            var r = compatcheck.parseOldExamples(tree);
            assert.deepEqual(r.examples.map((e) => e.id), ['hello.c']);
            fs.rmSync(tree, { recursive: true, force: true });
        });

        it('should follow a class that inherits its presets', function () {
            var tree = makeTree({
                'demo.ts': `
                    const DEMO_PRESETS = [ {id: 'hello.c', name: 'Hello'} ];
                    class BaseDemoPlatform {
                      getPresets() { return DEMO_PRESETS; }
                    }
                    class DemoPlatform extends BaseDemoPlatform {
                    }
                    PLATFORMS['demo'] = DemoPlatform;
                `,
            });
            var r = compatcheck.parseOldExamples(tree);
            assert.deepEqual(r.examples.map((e) => e.id), ['hello.c']);
            fs.rmSync(tree, { recursive: true, force: true });
        });

        it('should ignore a preset that is commented out', function () {
            var tree = makeTree({
                'demo.ts': `
                    const DEMO_PRESETS = [
                      {id: 'hello.c', name: 'Hello'},
                    //  {id: 'old.dasm', name: 'Old'},
                    ];
                    class DemoPlatform {
                      getPresets() { return DEMO_PRESETS; }
                    }
                    PLATFORMS['demo'] = DemoPlatform;
                `,
            });
            var r = compatcheck.parseOldExamples(tree);
            assert.deepEqual(r.examples.map((e) => e.id), ['hello.c']);
            fs.rmSync(tree, { recursive: true, force: true });
        });

        it('should fold in the presets of an array it extends', function () {
            var tree = makeTree({
                'demo.ts': `
                    var DEMO_PRESETS = [ {id: 'hello.c', name: 'Hello'} ];
                    var DEMO2_PRESETS = DEMO_PRESETS.concat([ {id: 'more.c', name: 'More'} ]);
                    class DemoPlatform {
                      getPresets() { return DEMO2_PRESETS; }
                    }
                    PLATFORMS['demo'] = DemoPlatform;
                `,
            });
            var r = compatcheck.parseOldExamples(tree);
            assert.deepEqual(r.examples.map((e) => e.id).sort(), ['hello.c', 'more.c']);
            fs.rmSync(tree, { recursive: true, force: true });
        });
    });

    describe('the release we track', function () {

        it('should have a baseline', function () {
            assert.ok(fs.existsSync(BASELINE), 'missing ' + BASELINE);
            var baseline = JSON.parse(fs.readFileSync(BASELINE, 'utf8'));
            assert.ok(baseline.length > 300, 'baseline has only ' + baseline.length + ' entries');
            for (var entry of baseline) {
                assert.ok(entry.preset, 'a baseline entry has no preset');
                assert.ok(typeof entry.ok === 'boolean', entry.preset + ' has no result');
            }
        });

        it('should list the same examples as the baseline', function () {
            if (!haveTag()) return this.skip();   // no tag in this checkout
            var tree = fs.mkdtempSync(path.join(os.tmpdir(), '8bws-compat-test-'));
            try {
                execFileSync('git', ['worktree', 'add', '--detach', path.join(tree, 'wt'), TAG],
                    { stdio: 'ignore' });
                var old = compatcheck.parseOldExamples(path.join(tree, 'wt'));
                var baseline = JSON.parse(fs.readFileSync(BASELINE, 'utf8'));
                var listed = new Set(old.examples.map((e) => e.folder + '/' + e.id));
                var missing = baseline
                    .map((e) => e.preset)
                    .filter((p) => !listed.has(p) && !p.includes('/skeleton.'));
                assert.deepEqual(missing, [], 'the baseline has examples the release does not');
            } finally {
                try {
                    execFileSync('git', ['worktree', 'remove', '--force', path.join(tree, 'wt')],
                        { stdio: 'ignore' });
                } catch (e) { /* the temp dir goes away anyway */ }
                fs.rmSync(tree, { recursive: true, force: true });
            }
        });

        it('should build an old example with the current toolchain', async function () {
            if (!haveTag()) return this.skip();   // no tag in this checkout
            var tree = fs.mkdtempSync(path.join(os.tmpdir(), '8bws-compat-test-'));
            try {
                execFileSync('git', ['worktree', 'add', '--detach', path.join(tree, 'wt'), TAG],
                    { stdio: 'ignore' });
                var corpus = {
                    dir: path.join(tree, 'wt', 'presets'),
                    tree: path.join(tree, 'wt'),
                    label: TAG,
                };
                var listing = await compatcheck.listCorpus(corpus);
                var entry = listing.entries.find((e) => e.preset === 'c64/helloc.c');
                assert.ok(entry, 'c64/helloc.c is not in the corpus');
                var { compileSourceFile } = require('gen/tools/testlib.js');
                var result = await compileSourceFile(entry.tool, entry.platform, entry.abs);
                assert.ok(result.success, JSON.stringify(result.errors));
            } finally {
                try {
                    execFileSync('git', ['worktree', 'remove', '--force', path.join(tree, 'wt')],
                        { stdio: 'ignore' });
                } catch (e) { /* the temp dir goes away anyway */ }
                fs.rmSync(tree, { recursive: true, force: true });
            }
        });
    });
});
