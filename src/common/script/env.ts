import { WorkerError } from "../workertypes";
import ErrorStackParser = require("error-stack-parser");
import yufka from 'yufka';
import * as bitmap from "./bitmap";
import * as io from "./io";
import * as output from "./output";
import { escapeHTML } from "../util";

export interface Cell {
    id: string;
    object?: any;
}

const IMPORTS = {
    'bitmap': bitmap,
    'io': io,
    'output': output
}

const LINE_NUMBER_OFFSET = 3;

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

export class Environment {
    preamble: string;
    postamble: string;
    obj: {};

    constructor(
        public readonly globalenv: any,
        public readonly path: string
    ) {
        var badlst = Object.getOwnPropertyNames(this.globalenv).filter(name => GLOBAL_GOODLIST.indexOf(name) < 0);
        this.preamble = `'use strict';var ${badlst.join(',')};`;
        for (var impname in IMPORTS) {
            this.preamble += `var ${impname}=$$.${impname};`
        }
        this.preamble += '{\n';
        this.postamble = '\n}';
    }
    preprocess(code: string): string {
        var declvars = {};
        const result = yufka(code, (node, { update, source, parent }) => {
            switch (node.type) {
                case 'Identifier':
                    if (GLOBAL_BADLIST.indexOf(source()) >= 0) {
                        update(`__FORBIDDEN__KEYWORD__${source()}__`) // TODO? how to preserve line number?
                    }
                    break;
                case 'AssignmentExpression':
                    /*
                    // x = expr --> var x = expr
                    if (parent().type === 'ExpressionStatement' && parent(2) && parent(2).type === 'Program') { // TODO
                        let left = node['left'];
                        if (left && left.type === 'Identifier' && declvars[left.name] == null) {
                            update(`var ${source()}`)
                            declvars[left.name] = true;
                        }
                    }
                    */
                    break;
            }
        })
        return result.toString();
    }
    async run(code: string): Promise<void> {
        code = this.preprocess(code);
        this.obj = {};
        const AsyncFunction = Object.getPrototypeOf(async function () { }).constructor;
        const fn = new AsyncFunction('$$', this.preamble + code + this.postamble).bind(this.obj, IMPORTS);
        await fn.call(this);
        this.checkResult();
    }
    checkResult() {
        for (var [key, value] of Object.entries(this.obj)) {
            if (value instanceof Promise) {
                throw new Error(`'${key}' is unresolved. Use 'await' before expression.`) // TODO?
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
        if (e['loc'] != null) {
            return [{
                path: this.path,
                msg: e.message,
                line: e['loc'].line,
                start: e['loc'].column,
            }]
        }
        // TODO: Cannot parse given Error object
        var frames = ErrorStackParser.parse(e);
        var frame = frames.find(f => f.functionName === 'anonymous');
        return [{
            path: this.path,
            msg: e.message,
            line: frame ? frame.lineNumber - LINE_NUMBER_OFFSET : 0,
            start: frame ? frame.columnNumber : 0,
        }];
    }
}
