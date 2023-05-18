
import fs from 'fs';
import path from 'path';
import { spawn } from 'child_process';
import { WorkerBuildStep, WorkerError, WorkerFileUpdate, WorkerResult } from '../../common/workertypes';
import { getBasePlatform, getRootBasePlatform } from '../../common/util';
import { BuildStep, makeErrorMatcher } from '../workermain';


const LLVM_MOS_TOOL: ServerBuildTool = {
    name: 'llvm-mos',
    version: '',
    extensions: ['.c'],
    archs: ['6502'],
    platforms: ['atari8', 'c64', 'nes'],
    platform_configs: {
        c64: {
            binpath: 'llvm-mos/bin',
            command: 'mos-c64-clang',
            args: ['-Os', '-g', '-o', '$OUTFILE', '$INFILES']
        },
        debug: { // TODO
            binpath: 'llvm-mos/bin',
            command: 'llvm-objdump',
            args: ['-l', '-t', '$ELFFILE']
        }
    }
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
    Object.assign({}, LLVM_MOS_TOOL, { version: '0.13.2' }),
];

interface ServerBuildTool {
    name: string;
    version: string;
    extensions: string[];
    archs: string[];
    platforms: string[];
    platform_configs: { [platform: string]: ServerBuildToolPlatformConfig };
}

interface ServerBuildToolPlatformConfig {
    binpath: string;
    command: string;
    args: string[];
}


export class ServerBuildEnv {

    rootdir: string;
    sessionID: string;
    tool: ServerBuildTool;
    sessionDir: string;
    errors: WorkerError[] = [];

    constructor(rootdir: string, sessionID: string, tool: ServerBuildTool) {
        this.rootdir = rootdir;
        this.sessionID = sessionID;
        this.tool = tool;
        // make sure sessionID is well-formed
        if (!sessionID.match(/^[a-zA-Z0-9_-]+$/)) {
            throw new Error(`Invalid sessionID: ${sessionID}`);
        }
        // create sessionID directory if it doesn't exist
        this.sessionDir = path.join(rootdir, 'sessions', sessionID);
        if (!fs.existsSync(this.sessionDir)) {
            fs.mkdirSync(this.sessionDir);
        }
    }

    async addFileUpdate(file: WorkerFileUpdate) {
        // make sure file.path contains no path components
        if (file.path.match(/[\\\/]/)) {
            throw new Error(`Invalid file path: ${file.path}`);
        }
        await fs.promises.writeFile(path.join(this.sessionDir, file.path), file.data);
    }

    async build(step: WorkerBuildStep): Promise<void> {
        let platformID = getRootBasePlatform(step.platform);
        let config = this.tool.platform_configs[platformID];
        if (!config) {
            throw new Error(`No config for platform ${platformID}`);
        }
        let args = config.args.slice(0); //copy array
        let command = config.command;
        // replace $OUTFILE
        let outfile = path.join(this.sessionDir, 'a.out');
        for (let i = 0; i < args.length; i++) {
            if (args[i] === '$OUTFILE') {
                args[i] = outfile;
            }
        }
        // replace $INFILES with the list of input files
        // TODO
        let infiles = [];
        for (let i = 0; i < step.files.length; i++) {
            let f = step.files[i];
            if (f.endsWith(this.tool.extensions[0])) {
                infiles.push(path.join(this.sessionDir, f));
            }
        }
        for (let i = 0; i < args.length; i++) {
            if (args[i] === '$INFILES') {
                args = args.slice(0, i).concat(infiles).concat(args.slice(i + 1));
                break;
            }
        }
        console.log(`Running: ${command} ${args.join(' ')}`);
        // spawn after setting PATH env var
        // TODO
        let childProcess = spawn(command, args, { shell: true, env: { PATH: path.join(this.rootdir, config.binpath) } });
        let outputData = '';
        let errorData = '';
        let errors = [];
        let errorMatcher = makeErrorMatcher(errors, /([^:/]+):(\d+):(\d+):\s*(.+)/, 2, 4, step.path, 1);
        childProcess.stdout.on('data', (data) => {
            outputData += data.toString();
        });
        childProcess.stderr.on('data', (data) => {
            errorData += data.toString();
        });
        await new Promise((resolve, reject) => {
            childProcess.on('close', (code) => {
                // split errorData into lines
                for (let line of errorData.split('\n')) {
                    errorMatcher(line);
                }
                if (code === 0) {
                    this.errors = [];
                    resolve(0);
                } else {
                    this.errors = errors;
                    resolve(0);
                }
            });
        });
    }

    async processResult(): Promise<WorkerResult> {
        if (this.errors.length) {
            return { errors: this.errors };
        } else {
            let outfile = path.join(this.sessionDir, 'a.out');
            let output = await fs.promises.readFile(outfile, { encoding: 'base64' });
            return { output };
        }
    }
}

