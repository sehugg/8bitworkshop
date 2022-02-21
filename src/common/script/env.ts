
import { WorkerError } from "../workertypes";
import ErrorStackParser = require("error-stack-parser");
import yufka from 'yufka';
import * as bitmap from "./lib/bitmap";
import * as io from "./lib/io";
import * as output from "./lib/output";
import * as color from "./lib/color";
import * as scriptui from "./lib/scriptui";

export const PROP_CONSTRUCTOR_NAME = "$$consname";

export interface Cell {
    id: string;
    object?: any;
}

export interface RunResult {
    cells: Cell[];
    state: {};
}

const IMPORTS = {
    'bitmap': bitmap,
    'io': io,
    'output': output,
    'color': color,
    'ui': scriptui,
}

const LINE_NUMBER_OFFSET = 3; // TODO: shouldnt need?

const GLOBAL_BADLIST = [
    'eval'
]

const GLOBAL_GOODLIST = [
    'eval', // 'eval' can't be defined or assigned to in strict mode code
    'Math', 'JSON',
    'parseFloat', 'parseInt', 'isFinite', 'isNaN',
    'String', 'Symbol', 'Number', 'Object', 'Boolean', 'NaN', 'Infinity', 'Date', 'BigInt',
    'Set', 'Map', 'RegExp', 'Array', 'ArrayBuffer', 'DataView',
    'Float32Array', 'Float64Array',
    'Int8Array', 'Int16Array', 'Int32Array',
    'Uint8Array', 'Uint16Array', 'Uint32Array', 'Uint8ClampedArray',
]

class RuntimeError extends Error {
    constructor(public loc: acorn.SourceLocation, msg: string) {
        super(msg);
    }
}

function setConstructorName(o: object) : void {
    let name = Object.getPrototypeOf(o)?.constructor?.name;
    if (name != null && name != 'Object') {
        o[PROP_CONSTRUCTOR_NAME] = name;
    }
}

export class Environment {
    preamble: string;
    postamble: string;
    obj: {};
    seq: number;
    declvars : {[name : string] : acorn.Node};
    builtins : {}

    constructor(
        public readonly globalenv: any,
        public readonly path: string
    ) {
        var badlst = Object.getOwnPropertyNames(this.globalenv).filter(name => GLOBAL_GOODLIST.indexOf(name) < 0);
        this.builtins = {
            print: (...args) => this.print(args),
            ...IMPORTS
        }
        this.preamble = `'use strict';var ${badlst.join(',')};`;
        for (var impname in this.builtins) {
            this.preamble += `var ${impname}=$$.${impname};`
        }
        this.preamble += '{\n';
        this.postamble = '\n}';
    }
    error(varname: string, msg: string) {
        let obj = this.declvars && this.declvars[varname];
        console.log('ERROR', varname, obj, this);
        throw new RuntimeError(obj && obj.loc, msg);
    }
    print(args: any[]) {
        if (args && args.length > 0 && args[0] != null) {
            this.obj[`$print__${this.seq++}`] = args.length == 1 ? args[0] : args;
        }
    }
    preprocess(code: string): string {
        this.declvars = {};
        this.seq = 0;
        let options = {
            // https://www.npmjs.com/package/magic-string#sgeneratemap-options-
            sourceMap: {
                file: this.path,
                source: this.path,
                hires: false,
                includeContent: false
            },
            // https://github.com/acornjs/acorn/blob/master/acorn/README.md
            acorn: {
                ecmaVersion: 6 as any,
                locations: true,
                allowAwaitOutsideFunction: true,
                allowReturnOutsideFunction: true,
                allowReserved: true,
            }
        };
        const result = yufka(code, options, (node, { update, source, parent }) => {
            const isTopLevel = () => {
                return parent() && parent().type === 'ExpressionStatement' && parent(2) && parent(2).type === 'Program';
            }
            const convertTopToPrint = () => {
                if (isTopLevel()) {
                    let printkey = `$print__${this.seq++}`;
                    update(`this.${printkey} = io.data.load(${source()}, ${JSON.stringify(printkey)})`);
                    //update(`print(${source()});`)
                }
            }
            const left = node['left'];
            switch (node.type) {
                // add preamble, postamble
                case 'Program':
                    update(`${this.preamble}${source()}${this.postamble}`)
                    break;
                // error on forbidden keywords
                case 'Identifier':
                    if (GLOBAL_BADLIST.indexOf(source()) >= 0) {
                        update(`__FORBIDDEN__KEYWORD__${source()}__`) // TODO? how to preserve line number?
                    } else {
                        convertTopToPrint();
                    }
                    break;
                // x = expr --> var x = expr (first use)
                case 'AssignmentExpression':
                    if (isTopLevel()) {
                        if (left && left.type === 'Identifier') {
                            if (!this.declvars[left.name]) {
                                update(`var ${left.name}=io.data.load(this.${source()}, ${JSON.stringify(left.name)})`)
                                this.declvars[left.name] = left;
                            } else {
                                update(`${left.name}=this.${source()}`)
                            }
                        }
                    }
                    break;
                // convert lone expressions to print()
                case 'UnaryExpression':
                case 'BinaryExpression':
                case 'CallExpression':
                case 'MemberExpression':
                    convertTopToPrint();
                    break;
                // literal comments
                case 'Literal':
                    if (typeof node['value'] === 'string' && isTopLevel()) {
                        update(`this.$doc__${this.seq++} = { literaltext: ${source()} };`);
                    } else {
                        convertTopToPrint();
                    }
                    break;
            }
        });
        return result.toString();
    }
    async run(code: string): Promise<void> {
        // TODO: split into cells based on "--" linebreaks?
        code = this.preprocess(code);
        this.obj = {};
        const AsyncFunction = Object.getPrototypeOf(async function () { }).constructor;
        const fn = new AsyncFunction('$$', code).bind(this.obj, this.builtins);
        await fn.call(this);
        this.checkResult(this.obj, new Set(), []);
    }
    // https://developer.mozilla.org/en-US/docs/Web/API/Web_Workers_API/Structured_clone_algorithm
    // TODO: return initial location of thingie
    checkResult(o, checked: Set<object>, fullkey: string[]) {
        if (o == null) return;
        if (checked.has(o)) return;
        if (typeof o === 'object') {
            setConstructorName(o);
            delete o.$$callback; // clear callbacks (TODO? put somewhere else?)
            if (o.length > 100) return; // big array, don't bother
            if (o.BYTES_PER_ELEMENT > 0) return; // typed array, don't bother
            checked.add(o); // so we don't recurse if cycle
            function prkey() { return fullkey.join('.') }
            // go through all object properties recursively
            for (var [key, value] of Object.entries(o)) {
                if (value == null && fullkey.length == 0 && !key.startsWith("$")) {
                    this.error(key, `"${key}" has no value.`)
                }
                fullkey.push(key);
                if (typeof value === 'function') {
                    if (fullkey.length == 1)
                        this.error(fullkey[0], `"${prkey()}" is a function. Did you forget to pass parameters?`); // TODO? did you mean (needs to see entire expr)
                    else
                        this.error(fullkey[0], `This expression may be incomplete, or it contains a function object: ${prkey()}`); // TODO? did you mean (needs to see entire expr)
                }
                if (typeof value === 'symbol') {
                    this.error(fullkey[0], `"${prkey()}" is a Symbol, and can't be used.`) // TODO?
                }
                if (value instanceof Promise) {
                    this.error(fullkey[0], `"${prkey()}" is unresolved. Use "await" before expression.`) // TODO?
                }
                this.checkResult(value, checked, fullkey);
                fullkey.pop();
            }
        }
    }
    render(): Cell[] {
        var cells = [];
        for (var [key, value] of Object.entries(this.obj)) {
            if (typeof value === 'function') {
                // TODO: find other values, functions embedded in objects?
            } else {
                var cell: Cell = { id: key, object: value };
                cells.push(cell);
            }
        }
        return cells;
    }
    extractErrors(e: Error): WorkerError[] {
        let loc = e['loc'];
        if (loc && loc.start && loc.end) {
            return [{
                path: this.path,
                msg: e.message,
                line: loc.start.line,
                start: loc.start.column,
                end: loc.end.line,
            }]
        }
        if (loc && loc.line != null) {
            return [{
                path: this.path,
                msg: e.message,
                line: loc.line,
                start: loc.column,
            }]
        }
        // TODO: Cannot parse given Error object?
        let frames = ErrorStackParser.parse(e);
        let frame = frames.findIndex(f => f.functionName === 'anonymous');
        let errors = [];
        // if ErrorStackParser fails, resort to regex
        if (frame < 0 && e.stack != null) {
            let m = /.anonymous.:(\d+):(\d+)/g.exec(e.stack);
            if (m != null) {
                errors.push( {
                    path: this.path,
                    msg: e.message,
                    line: parseInt(m[1]) - LINE_NUMBER_OFFSET,
                });
            }
        }
        // otherwise iterate thru all the frames
        while (frame >= 0) {
            console.log(frames[frame]);
            if (frames[frame].fileName.endsWith('Function')) {
                // TODO: use source map
                errors.push( {
                    path: this.path,
                    msg: e.message,
                    line: frames[frame].lineNumber - LINE_NUMBER_OFFSET,
                    //start: frames[frame].columnNumber,
                } );
            }
            --frame;
        }
        // if no stack frames parsed, last resort error msg
        if (errors.length == 0) {
            errors.push( {
                path: this.path,
                msg: e.message,
                line: 0
            } );
        }
        return errors;
    }
    commitLoadableState() {
        // TODO: visit children?
        for (let [key, value] of Object.entries(this.obj)) {
            let loadable = <any>value as io.Loadable;
            io.data.save(loadable, key);
        }
        return io.$$getData();
    }
}
