
import fs from 'fs';
import path from 'path';
import { spawn } from 'child_process';
import { CodeListing, CodeListingMap, Segment, WorkerBuildStep, WorkerErrorResult, WorkerFileUpdate, WorkerResult, isOutputResult } from '../../common/workertypes';
import { getFilenamePrefix, getRootBasePlatform, replaceAll } from '../../common/util';
import { parseObjDump } from './clang';
import { BuildStep } from '../builder';
import { makeErrorMatcher } from '../listingutils';

interface ServerBuildTool {
    name: string;
    version: string;
    extensions: string[];
    archs: string[];
    platforms: string[];
    platform_configs: { [platform: string]: ServerBuildToolPlatformConfig };
    processErrors(step: WorkerBuildStep, errorData: string): Promise<WorkerErrorResult>;
    processOutput(step: WorkerBuildStep, outfile: string): Promise<WorkerResult>;
}

interface ServerBuildToolPlatformConfig {
    binpath?: string;
    command?: string;
    args?: string[];
    libargs?: string[];
    outfile?: string;
}

const LLVM_MOS_TOOL: ServerBuildTool = {
    name: 'llvm-mos',
    version: '',
    extensions: ['.c', '.cpp', '.s', '.S', '.C'],
    archs: ['6502'],
    platforms: ['atari8', 'c64', 'nes', 'pce', 'vcs'],
    processOutput: basicProcessOutput,
    processErrors: llvmMosProcessErrors,
    platform_configs: {
        default: {
            binpath: 'llvm-mos/bin',
            command: 'mos-clang',
            args: ['-Os', '-g', '-D', '__8BITWORKSHOP__', '-o', '$OUTFILE', '$INFILES'],
        },
        debug: { // TODO
            binpath: 'llvm-mos/bin',
            command: 'llvm-objdump',
            args: ['-l', '-t', '$WORKDIR/a.out.elf', '>$WORKDIR/debug.out']
        },
        c64: {
            command: 'mos-c64-clang',
        },
        atari8: {
            command: 'mos-atari8-clang',
        },
        nes: {
            command: 'mos-nes-nrom-clang', // TODO
            libargs: ['-lneslib', '-lfamitone2']
        },
        pce: {
            command: 'mos-pce-clang', // TODO
        },
        vcs: {
            command: 'mos-atari2600-3e-clang', // TODO
        },
    }
}

async function basicProcessOutput(step: WorkerBuildStep, outfile: string): Promise<WorkerResult> {
    let output = await fs.promises.readFile(outfile, { encoding: 'base64' });
    return { output };
}

async function llvmMosProcessErrors(step: WorkerBuildStep, errorData: string): Promise<WorkerErrorResult> {
    errorData = errorData.replace(/(\/var\/folders\/.+?\/).+?:/g, ''); // TODO?
    let errors = [];
    // split errorData into lines
    let errorMatcher = makeErrorMatcher(errors, /([^:/]+):(\d+):(\d+):\s*(.+)/, 2, 4, step.path, 1);
    for (let line of errorData.split('\n')) {
        errorMatcher(line);
    }
    return { errors };
}


const OSCAR64_TOOL: ServerBuildTool = {
    name: 'oscar64',
    version: '',
    extensions: ['.c', '.cc', '.cpp'],
    archs: ['6502'],
    platforms: ['atari8', 'c64', 'nes'],
    processOutput: oscar64ProcessOutput,
    processErrors: oscar64ProcessErrors,
    platform_configs: {
        default: {
            binpath: 'oscar64/bin',
            command: 'oscar64',
            args: ['-Os', '-g', '-d__8BITWORKSHOP__', '-o=$OUTFILE', '$INFILES'],
        },
        c64: {
            outfile: 'a.prg',
        }
    }
}

async function oscar64ProcessErrors(step: WorkerBuildStep, errorData: string): Promise<WorkerErrorResult> {
    let errors = [];
    // split errorData into lines
    let errorMatcher = makeErrorMatcher(errors, /\/([^(]+)\((\d+), (\d+)\) : \s*(.+)/, 2, 4, step.path, 1);
    for (let line of errorData.split('\n')) {
        errorMatcher(line);
    }
    return { errors };
}

async function oscar64ProcessOutput(step: WorkerBuildStep, outpath: string): Promise<WorkerResult> {
    let prefix_path = outpath.replace(/\.\w+$/, '');
    let output = await fs.promises.readFile(outpath, { encoding: 'base64' });
    let listings: CodeListingMap = {};
    let symbolmap: { [sym: string]: number } = {};
    let debuginfo = {};
    let segments: Segment[] = [];
    // read segments
    {
        let txt = await fs.promises.readFile(prefix_path + '.map', { encoding: 'utf-8' });
        for (let line of txt.split("\n")) {
            // 0880 - 0887 : DATA, code
            const m1 = line.match(/([0-9a-f]+) - ([0-9a-f]+) : ([A-Z_]+), (.+)/);
            if (m1) {
                const name = m1[4];
                const start = parseInt(m1[1], 16);
                const end = parseInt(m1[2], 16);
                segments.push({
                    name, start, size: end - start,
                });
            }
            // 0801 (0062) : startup, NATIVE_CODE:startup
            const m2 = line.match(/([0-9a-f]+) \(([0-9a-f]+)\) : ([^,]+), (.+)/);
            if (m2) {
                const addr = parseInt(m2[1], 16);
                const name = m2[3];
                symbolmap[name] = addr;
            }
        }
    }
    // read listings
    {
        let txt = await fs.promises.readFile(prefix_path + '.asm', { encoding: 'utf-8' });
        let lst : CodeListing = { lines: [], text: txt };
        let asm_lineno = 0;
        let c_lineno = 0;
        let c_path = '';
        const path = step.path;
        for (let line of txt.split("\n")) {
            asm_lineno++;
            //;   4, "/Users/sehugg/PuzzlingPlans/8bitworkshop/server-root/oscar64/main.c"
            let m2 = line.match(/;\s*(\d+), "(.+?)"/);
            if (m2) {
                c_lineno = parseInt(m2[1]);
                c_path = m2[2].split('/').pop(); // TODO
            }
            //0807 : 30 36 __ BMI $083f ; (startup + 62)
            let m = line.match(/([0-9a-f]+) : ([0-9a-f _]{8}) (.+)/);
            if (m) {
                let offset = parseInt(m[1], 16);
                let hex = m[2];
                let asm = m[3];
                if (c_path) {
                    lst.lines.push({
                        line: c_lineno,
                        path: c_path,
                        offset,
                        iscode: true
                    });
                    c_path = '';
                    c_lineno = 0;
                }
                /*
                lst.asmlines.push({
                    line: asm_lineno,
                    path,
                    offset,
                    insns: hex + ' ' + asm,
                    iscode: true });
                */
            }
        }
        listings[getFilenamePrefix(step.path) + '.lst'] = lst;
    }
    return { output, listings, symbolmap, segments, debuginfo };
}

export function findBestTool(step: BuildStep) {
    if (!step?.tool) throw new Error('No tool specified');
    const [name, version] = step.tool.split('@');
    for (let tool of TOOLS) {
        if (tool.name === name && (!version || version === 'latest' || tool.version === version)) {
            return tool;
        }
    }
    throw new Error(`Tool not found: ${step.tool}`);
}

export const TOOLS: ServerBuildTool[] = [
    Object.assign({}, LLVM_MOS_TOOL, { version: 'latest' }),
    Object.assign({}, OSCAR64_TOOL, { version: 'latest' }),
];


export class ServerBuildEnv {

    rootdir: string;
    sessionID: string;
    tool: ServerBuildTool;
    sessionDir: string;

    constructor(rootdir: string, sessionID: string, tool: ServerBuildTool) {
        this.rootdir = path.resolve(rootdir);
        this.sessionID = sessionID;
        this.tool = tool;
        // make sure sessionID is well-formed
        if (!sessionID.match(/^[a-zA-Z0-9_-]+$/)) {
            throw new Error(`Invalid sessionID: ${sessionID}`);
        }
        // create sessionID directory if it doesn't exist
        this.sessionDir = path.join(this.rootdir, 'sessions', sessionID);
        if (!fs.existsSync(this.sessionDir)) {
            fs.mkdirSync(this.sessionDir);
        }
    }

    async addFileUpdate(file: WorkerFileUpdate) {
        // make sure file.path contains no path components
        if (file.path.match(/[\\\/]/)) {
            throw new Error(`Invalid file path: ${file.path}`);
        }
        let data = file.data;
        if (typeof data === 'string' && data.startsWith('data:base64,')) {
            // convert data URL to base64
            let parts = data.split(',');
            if (parts.length !== 2) {
                throw new Error(`Invalid data URL: ${data}`);
            }
            data = Buffer.from(parts[1], 'base64');
        }
        await fs.promises.writeFile(path.join(this.sessionDir, file.path), data);
    }

    async build(step: WorkerBuildStep, platform?: string): Promise<WorkerResult> {
        // build config
        let platformID = platform || getRootBasePlatform(step.platform);
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
        let outfile = path.join(this.sessionDir, config.outfile || 'a.out');
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
                    infiles.push(path.join(this.sessionDir, f));
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
        let childProcess = spawn(command, args, {
            shell: true,
            cwd: this.rootdir,
            env: {
                PATH: path.join(this.rootdir, config.binpath)
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
                    } else {
                        resolve(this.tool.processOutput(step, outfile));
                    }
                } else {
                    errorData = replaceAll(errorData, this.sessionDir, '');
                    errorData = replaceAll(errorData, this.rootdir, '');
                    // remove folder paths
                    let errorResult = await this.tool.processErrors(step, errorData);
                    if (errorResult.errors.length === 0) {
                        errorResult.errors.push({ line: 0, msg: `Build failed.\n\n${errorData}` });
                    }
                    resolve(errorResult);
                }
            });
        });
    }

    async processOutput(step: WorkerBuildStep, outfile: string): Promise<WorkerResult> {
        let output = await fs.promises.readFile(outfile, { encoding: 'base64' });
        return { output };
    }

    async processDebugInfo(step: WorkerBuildStep): Promise<WorkerResult> {
        let dbgfile = path.join(this.sessionDir, 'debug.out');
        let dbglist = (await fs.promises.readFile(dbgfile)).toString();
        let { listings, symbolmap, segments } = parseObjDump(dbglist);
        return { output: [], listings, symbolmap, segments };
    }

    async compileAndLink(step: WorkerBuildStep, updates: WorkerFileUpdate[]): Promise<WorkerResult> {
        for (let file of updates) {
            await this.addFileUpdate(file);
        }
        try {
            let result = await this.build(step);
            // did we succeed?
            if (step.tool == 'llvm-mos' && isOutputResult(result)) {
                // do the debug info
                const debugInfo = await this.build(step, 'debug');
                if (isOutputResult(debugInfo)) {
                    result.listings = debugInfo.listings;
                    result.symbolmap = debugInfo.symbolmap;
                }
            }
            return result;
        } catch (err) {
            return { errors: [{ line: 0, msg: err.toString() }] };
        }
    }
}

