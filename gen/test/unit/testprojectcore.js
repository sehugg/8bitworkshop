"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const assert_1 = __importDefault(require("assert"));
const mocha_1 = require("mocha");
const projectcore_1 = require("../../src/common/projectcore");
const toolselect_1 = require("../../src/common/toolselect");
class MemFiles {
    constructor(files) {
        this.files = files;
        this.reads = [];
    }
    async readFile(path) {
        var _a;
        this.reads.push(path);
        return (_a = this.files[path]) !== null && _a !== void 0 ? _a : null;
    }
}
const c64tool = (fn) => (0, toolselect_1.getToolForPlatform)('c64', fn);
function resolve(files, mainPath, tool = c64tool) {
    return (0, projectcore_1.resolveDependencies)(new MemFiles(files), mainPath, files[mainPath], 'c64', tool);
}
(0, mocha_1.describe)('projectcore.resolveDependencies', () => {
    (0, mocha_1.it)('should follow includes of includes, main file deps first', async () => {
        const deps = await resolve({
            'main.c': '#include "a.h"\n#include "b.h"\n',
            'a.h': '#include "nested.h"\n',
            'b.h': '',
            'nested.h': '',
        }, 'main.c');
        assert_1.default.deepStrictEqual(deps.map((d) => d.filename), ['a.h', 'b.h', 'nested.h']);
    });
    (0, mocha_1.it)('should send each file once', async () => {
        const deps = await resolve({
            'main.c': '#include "a.h"\n#include "a.h"\n#include "b.h"\n',
            'a.h': '#include "b.h"\n#include "main.c"\n',
            'b.h': '#include "a.h"\n',
        }, 'main.c');
        assert_1.default.deepStrictEqual(deps.map((d) => d.filename), ['a.h', 'b.h']);
    });
    (0, mocha_1.it)('should mark linked files and skip missing ones', async () => {
        const deps = await resolve({
            'main.c': '//#link "lib.s"\n//#link "gone.s"\n#include "a.h"\n',
            'a.h': '',
            'lib.s': '',
        }, 'main.c');
        assert_1.default.deepStrictEqual(deps.map((d) => [d.filename, d.link]), [['a.h', false], ['lib.s', true]]);
    });
    (0, mocha_1.it)('should prefer the file in the main file folder', async () => {
        const deps = await resolve({
            'proj/main.c': '#include "x.h"\n',
            'proj/x.h': 'local',
            'x.h': 'preset',
        }, 'proj/main.c');
        assert_1.default.deepStrictEqual(deps.map((d) => [d.path, d.filename, d.data]), [['proj/x.h', 'x.h', 'local']]);
    });
    (0, mocha_1.it)('should fall back to the bare name', async () => {
        const deps = await resolve({
            'proj/main.c': '#include "x.h"\n',
            'x.h': 'preset',
        }, 'proj/main.c');
        assert_1.default.deepStrictEqual(deps.map((d) => [d.path, d.filename]), [['x.h', 'x.h']]);
    });
    (0, mocha_1.it)('should not look in the "local" folder', () => {
        assert_1.default.deepStrictEqual((0, projectcore_1.candidatePaths)('x.h', 'local/main.c'), ['x.h']);
        assert_1.default.deepStrictEqual((0, projectcore_1.candidatePaths)('x.h', 'main.c'), ['x.h']);
        assert_1.default.deepStrictEqual((0, projectcore_1.candidatePaths)('x.h', 'a/main.c'), ['a/x.h', 'x.h']);
    });
});
(0, mocha_1.describe)('projectcore.buildWorkerMessage', () => {
    const deps = [
        { path: 'a.h', filename: 'a.h', link: false, data: 'h' },
        { path: 'lib.s', filename: 'lib.s', link: true, data: 's' },
    ];
    (0, mocha_1.it)('should give each linked file its own step and tool', () => {
        const { msg, preloads, filename2path } = (0, projectcore_1.buildWorkerMessage)({ mainPath: 'proj/main.c', mainData: 'm', platformId: 'c64', getToolForFilename: c64tool }, deps);
        assert_1.default.deepStrictEqual(msg.updates.map((u) => u.path), ['main.c', 'a.h', 'lib.s']);
        assert_1.default.deepStrictEqual(msg.buildsteps, [
            { path: 'main.c', files: ['main.c', 'a.h'], platform: 'c64', tool: 'cc65', mainfile: true },
            { path: 'lib.s', files: ['lib.s', 'a.h'], platform: 'c64', tool: 'ca65' },
        ]);
        assert_1.default.deepStrictEqual(preloads, ['cc65', 'ca65']);
        assert_1.default.strictEqual(filename2path['main.c'], 'proj/main.c');
    });
    (0, mocha_1.it)('should ship linked files in the main step for remote tools', () => {
        const { msg, preloads } = (0, projectcore_1.buildWorkerMessage)({ mainPath: 'main.c', mainData: 'm', platformId: 'c64', getToolForFilename: () => 'remote:llvm-mos' }, deps);
        assert_1.default.deepStrictEqual(msg.buildsteps, [
            { path: 'main.c', files: ['main.c', 'a.h', 'lib.s'], platform: 'c64', tool: 'remote:llvm-mos', mainfile: true },
        ]);
        assert_1.default.deepStrictEqual(preloads, ['remote:llvm-mos']);
    });
    (0, mocha_1.it)('should compile linked sources with the main file for single-pass tools', () => {
        const { msg } = (0, projectcore_1.buildWorkerMessage)({ mainPath: 'main.cpp', mainData: 'm', platformId: 'c64', getToolForFilename: () => 'oscar64' }, [{ path: 'lib.c', filename: 'lib.c', link: true, data: 'c' }]);
        assert_1.default.deepStrictEqual(msg.buildsteps, [
            { path: 'main.cpp', files: ['main.cpp', 'lib.c'], platform: 'c64', tool: 'oscar64', mainfile: true, linkfiles: ['lib.c'] },
        ]);
    });
    (0, mocha_1.it)('should pass build overrides and data items', () => {
        const { msg } = (0, projectcore_1.buildWorkerMessage)({
            mainPath: 'main.c', mainData: 'm', platformId: 'c64', getToolForFilename: c64tool,
            symbols: { compile: ['X=1'] }, dataItems: [{ key: 'k', value: {} }],
        }, []);
        assert_1.default.deepStrictEqual(msg.buildsteps[0].symbols, { compile: ['X=1'] });
        assert_1.default.deepStrictEqual(msg.setitems, [{ key: 'k', value: {} }]);
    });
});
(0, mocha_1.describe)('projectcore.mergeSegments', () => {
    (0, mocha_1.it)('should tag and sort native and linker segments', () => {
        const segs = (0, projectcore_1.mergeSegments)([{ name: 'RAM', start: 0, size: 0x800, type: 'ram' }], [{ name: 'CODE', start: 0x8000, size: 0x100, type: 'rom' }, { name: 'ZP', start: 0x80, size: 0x10, type: 'ram' }]);
        assert_1.default.deepStrictEqual(segs.map((s) => [s.name, s.source]), [['RAM', 'native'], ['ZP', 'linker'], ['CODE', 'linker']]);
        assert_1.default.deepStrictEqual((0, projectcore_1.mergeSegments)(null, null), []);
    });
});
//# sourceMappingURL=testprojectcore.js.map