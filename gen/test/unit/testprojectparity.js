"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const assert_1 = __importDefault(require("assert"));
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
const mocha_1 = require("mocha");
const buildpresets_1 = require("../../src/tools/buildpresets");
const testlib_1 = require("../../src/tools/testlib");
const project_1 = require("../../src/ide/project");
const emu_1 = require("../../src/common/emu");
const util_1 = require("../../src/common/util");
// The IDE (CodeProject) and the CLI (testlib) must send the worker the same
// build for the same source. For every preset, build the worker message both
// ways and compare them. Both go through src/common/projectcore.ts; this
// checks the parts that stay separate -- file lookup and tool selection.
// the IDE serves presets from presets/<base platform>/ (WebPresetsFileSystem)
class DiskPresetsFileSystem {
    constructor(dir) {
        this.dir = dir;
    }
    async getFileData(p) {
        const fp = path.join('presets', this.dir, p);
        if (!fs.existsSync(fp) || !fs.statSync(fp).isFile())
            return null;
        return (0, util_1.isProbablyBinary)(p) ? new Uint8Array(fs.readFileSync(fp)) : fs.readFileSync(fp, 'utf-8');
    }
    async setFileData(p, data) { }
    onFileSystemUpdate(cb) { }
}
async function ideMessage(e, mainPath) {
    const dir = (0, util_1.getBasePlatform)(e.platform);
    const plat = new emu_1.PLATFORMS[e.platform](null);
    const msgs = [];
    const worker = { postMessage: (m) => msgs.push(m) };
    const proj = new project_1.CodeProject(worker, e.platform, plat, new DiskPresetsFileSystem(dir));
    proj.filedata[mainPath] = fs.readFileSync(path.join('presets', e.preset), 'utf-8');
    proj.mainPath = mainPath;
    await proj.sendBuild();
    return msgs.find((m) => m.buildsteps);
}
// reduce a message to what the worker acts on
function normalize(msg) {
    if (!msg)
        return null;
    return {
        updates: msg.updates.map((u) => u.path),
        buildsteps: msg.buildsteps,
    };
}
(0, mocha_1.describe)('IDE/CLI build message parity', function () {
    this.timeout(120000);
    (0, mocha_1.it)('should build every preset the same way in the IDE and CLI', async () => {
        const presets = await (0, buildpresets_1.listPresets)();
        assert_1.default.ok(presets.length > 100, 'found ' + presets.length + ' presets');
        const diffs = [];
        for (const e of presets) {
            const dir = (0, util_1.getBasePlatform)(e.platform);
            const mainPath = e.buildAs || e.preset.substring(dir.length + 1);
            let ide, cli;
            try {
                ide = normalize(await ideMessage(e, mainPath));
                cli = normalize(await (0, testlib_1.buildSourceFileMessage)(null, e.platform, path.join('presets', e.preset), e.buildAs));
            }
            catch (err) {
                diffs.push(`${e.preset}: ${err}`);
                continue;
            }
            const dups = ide.updates.filter((p, i) => ide.updates.indexOf(p) != i);
            if (dups.length)
                diffs.push(`${e.preset}: sent twice: ${dups}`);
            try {
                assert_1.default.deepStrictEqual(cli, ide);
            }
            catch (err) {
                diffs.push(`${e.preset} (${e.platform}):\n  ide=${JSON.stringify(ide)}\n  cli=${JSON.stringify(cli)}`);
            }
        }
        assert_1.default.deepStrictEqual(diffs, []);
    });
});
//# sourceMappingURL=testprojectparity.js.map