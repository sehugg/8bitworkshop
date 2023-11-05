"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.ServerBuildEnv = exports.TOOLS = exports.findBestTool = void 0;
const fs_1 = __importDefault(require("fs"));
const path_1 = __importDefault(require("path"));
const child_process_1 = require("child_process");
const workertypes_1 = require("../../common/workertypes");
const util_1 = require("../../common/util");
const workermain_1 = require("../workermain");
const clang_1 = require("./clang");
const LLVM_MOS_TOOL = {
    name: 'llvm-mos',
    version: '',
    extensions: ['.c', '.cpp', '.s'],
    archs: ['6502'],
    platforms: ['atari8', 'c64', 'nes', 'pce', 'vcs'],
    platform_configs: {
        default: {
            binpath: 'llvm-mos/bin',
            command: 'mos-clang',
            args: ['-Os', '-g', '-o', '$OUTFILE', '$INFILES'],
        },
        debug: {
            binpath: 'llvm-mos/bin',
            command: 'llvm-objdump',
            args: ['-l', '-t', '$WORKDIR/a.out.elf', '>$WORKDIR/debug.out']
        },
        c64: {
            command: 'mos-c64-clang',
            libargs: ['-D', '__C64__']
        },
        atari8: {
            command: 'mos-atari8-clang',
            libargs: ['-D', '__ATARI__']
        },
        nes: {
            command: 'mos-nes-nrom-clang',
            libargs: ['-lneslib', '-lfamitone2']
        },
        pce: {
            command: 'mos-pce-clang',
            libargs: ['-lpce', '-D', '__PCE__']
        },
    }
};
function findBestTool(step) {
    if (!(step === null || step === void 0 ? void 0 : step.tool))
        throw new Error('No tool specified');
    const [name, version] = step.tool.split('@');
    for (let tool of exports.TOOLS) {
        if (tool.name === name && (!version || version === 'latest' || tool.version === version)) {
            return tool;
        }
    }
    throw new Error(`Tool not found: ${step.tool}`);
}
exports.findBestTool = findBestTool;
exports.TOOLS = [
    Object.assign({}, LLVM_MOS_TOOL, { version: '0.13.2' }),
];
class ServerBuildEnv {
    constructor(rootdir, sessionID, tool) {
        this.rootdir = path_1.default.resolve(rootdir);
        this.sessionID = sessionID;
        this.tool = tool;
        // make sure sessionID is well-formed
        if (!sessionID.match(/^[a-zA-Z0-9_-]+$/)) {
            throw new Error(`Invalid sessionID: ${sessionID}`);
        }
        // create sessionID directory if it doesn't exist
        this.sessionDir = path_1.default.join(this.rootdir, 'sessions', sessionID);
        if (!fs_1.default.existsSync(this.sessionDir)) {
            fs_1.default.mkdirSync(this.sessionDir);
        }
    }
    async addFileUpdate(file) {
        // make sure file.path contains no path components
        if (file.path.match(/[\\\/]/)) {
            throw new Error(`Invalid file path: ${file.path}`);
        }
        await fs_1.default.promises.writeFile(path_1.default.join(this.sessionDir, file.path), file.data);
    }
    async build(step, platform) {
        // build config
        let platformID = platform || (0, util_1.getRootBasePlatform)(step.platform);
        let config = this.tool.platform_configs[platformID];
        if (!config) {
            throw new Error(`No config for platform ${platformID}`);
        }
        let defaultConfig = this.tool.platform_configs.default;
        if (!defaultConfig) {
            throw new Error(`No default config for tool ${this.tool.name}`);
        }
        config = Object.assign({}, defaultConfig, config); // combine configs
        // copy args
        let args = config.args.slice(0); //copy array
        let command = config.command;
        // replace $OUTFILE
        let outfile = path_1.default.join(this.sessionDir, 'a.out'); // TODO? a.out
        for (let i = 0; i < args.length; i++) {
            args[i] = args[i].replace(/\$OUTFILE/g, outfile);
            args[i] = args[i].replace(/\$WORKDIR/g, this.sessionDir);
        }
        // replace $INFILES with the list of input files
        // TODO
        let infiles = [];
        for (let i = 0; i < step.files.length; i++) {
            let f = step.files[i];
            for (let ext of this.tool.extensions) {
                if (f.endsWith(ext)) {
                    infiles.push(path_1.default.join(this.sessionDir, f));
                    break;
                }
            }
        }
        for (let i = 0; i < args.length; i++) {
            if (args[i] === '$INFILES') {
                args = args.slice(0, i).concat(infiles).concat(args.slice(i + 1));
                break;
            }
        }
        if (config.libargs) {
            args = args.concat(config.libargs);
        }
        console.log(`Running: ${command} ${args.join(' ')}`);
        // spawn after setting PATH env var
        // TODO
        let childProcess = (0, child_process_1.spawn)(command, args, {
            shell: true,
            cwd: this.rootdir,
            env: { PATH: path_1.default.join(this.rootdir, config.binpath)
            }
        });
        let outputData = '';
        let errorData = '';
        // TODO?
        childProcess.stdout.on('data', (data) => {
            outputData += data.toString();
        });
        childProcess.stderr.on('data', (data) => {
            errorData += data.toString();
        });
        return new Promise((resolve, reject) => {
            childProcess.on('close', async (code) => {
                if (code === 0) {
                    if (platform === 'debug') {
                        resolve(this.processDebugInfo(step));
                    }
                    else {
                        resolve(this.processOutput(step));
                    }
                }
                else {
                    let errorResult = await this.processErrors(step, errorData);
                    if (errorResult.errors.length === 0) {
                        errorResult.errors.push({ line: 0, msg: `Build failed.\n\n${errorData}` });
                    }
                    resolve(errorResult);
                }
            });
        });
    }
    async processErrors(step, errorData) {
        let errors = [];
        // split errorData into lines
        let errorMatcher = (0, workermain_1.makeErrorMatcher)(errors, /([^:/]+):(\d+):(\d+):\s*(.+)/, 2, 4, step.path, 1);
        for (let line of errorData.split('\n')) {
            errorMatcher(line);
        }
        return { errors };
    }
    async processOutput(step) {
        let outfile = path_1.default.join(this.sessionDir, 'a.out');
        let output = await fs_1.default.promises.readFile(outfile, { encoding: 'base64' });
        return { output };
    }
    async processDebugInfo(step) {
        let dbgfile = path_1.default.join(this.sessionDir, 'debug.out');
        let dbglist = await fs_1.default.promises.readFile(dbgfile);
        let listings = (0, clang_1.parseObjDumpListing)(dbglist.toString());
        let symbolmap = (0, clang_1.parseObjDumpSymbolTable)(dbglist.toString());
        return { output: [], listings, symbolmap };
    }
    async compileAndLink(step, updates) {
        for (let file of updates) {
            await this.addFileUpdate(file);
        }
        try {
            let result = await this.build(step);
            // did we succeed?
            if ((0, workertypes_1.isOutputResult)(result)) {
                // do the debug info
                const debugInfo = await this.build(step, 'debug');
                if ((0, workertypes_1.isOutputResult)(debugInfo)) {
                    result.listings = debugInfo.listings;
                    result.symbolmap = debugInfo.symbolmap;
                }
            }
            return result;
        }
        catch (err) {
            return { errors: [{ line: 0, msg: err.toString() }] };
        }
    }
}
exports.ServerBuildEnv = ServerBuildEnv;
//# sourceMappingURL=buildenv.js.map