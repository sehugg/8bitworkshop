
import type { SourceLocation, SourceLine, WorkerError } from "./workertypes";

// objects that have source code position info
export interface SourceLocated {
    $loc?: SourceLocation;
}
// statements also have the 'offset' (pc) field from SourceLine
export interface SourceLineLocated {
    $loc?: SourceLine;
}

export class CompileError extends Error {
    $loc: SourceLocation;
    constructor(msg: string, loc: SourceLocation) {
        super(msg);
        Object.setPrototypeOf(this, CompileError.prototype);
        this.$loc = loc;
    }
}

export function mergeLocs(a: SourceLocation, b: SourceLocation): SourceLocation {
    return {
        line: Math.min(a.line, b.line),
        start: Math.min(a.start, b.start),
        end: Math.max(a.end, b.end),
        label: a.label || b.label,
        path: a.path || b.path,
    }
}

export enum TokenType {
    EOF = 'eof',
    EOL = 'eol',
    Ident = 'ident',
    Comment = 'comment',
    Ignore = 'ignore',
    CodeFragment = 'code-fragment',
    CatchAll = 'catch-all',
}

export class Token implements SourceLocated {
    str: string;
    type: string;
    $loc: SourceLocation;
}

export class TokenRule {
    type: string;
    regex: RegExp;
}

const CATCH_ALL_RULES: TokenRule[] = [
    { type: TokenType.CatchAll, regex: /.+?/ }
]

function re_escape(rule: TokenRule): string {
    return `(${rule.regex.source})`;
}

export class Tokenizer {
    rules: TokenRule[];
    regex: RegExp;
    path: string;
    lineno: number;
    tokens: Token[];
    lasttoken: Token;
    errors: WorkerError[];
    curlabel: string;
    eol: Token;
    includeEOL = false;
    errorOnCatchAll = false;
    codeFragment : string | null = null;

    constructor() {
        this.lineno = 0;
        this.errors = [];
    }
    setTokenRules(rules: TokenRule[]) {
        this.rules = rules.concat(CATCH_ALL_RULES);
        var pattern = this.rules.map(re_escape).join('|');
        this.regex = new RegExp(pattern, "g");
    }
    tokenizeFile(contents: string, path: string) {
        this.path = path;
        this.tokens = []; // can't have errors until this is set
        let txtlines = contents.split(/\n|\r\n?/);
        txtlines.forEach((line) => this._tokenize(line));
        this._pushToken({ type: TokenType.EOF, str: "", $loc: { path: this.path, line: this.lineno } });
    }
    tokenizeLine(line: string) : void {
        this.lineno++;
        this._tokenize(line);
    }
    _tokenize(line: string): void {
        this.lineno++;
        this.eol = { type: TokenType.EOL, str: "", $loc: { path: this.path, line: this.lineno, start: line.length } };
        // iterate over each token via re_toks regex
        let m: RegExpMatchArray;
        while (m = this.regex.exec(line)) {
            let found = false;
            // find out which capture group was matched, and thus token type
            for (let i = 0; i < this.rules.length; i++) {
                let s: string = m[i + 1];
                if (s != null) {
                    found = true;
                    let loc = { path: this.path, line: this.lineno, start: m.index, end: m.index + s.length };
                    let rule = this.rules[i];
                    // add token to list
                    switch (rule.type) {
                        case TokenType.CodeFragment:
                            if (this.codeFragment) {
                                this._pushToken({ str: this.codeFragment, type: rule.type, $loc: loc }); //TODO: merge start/end
                                this.codeFragment = null;
                            } else {
                                this.codeFragment = '';
                                return; // don't add any more tokens (TODO: check for trash?)
                            }
                            break;
                        case TokenType.CatchAll:
                            if (this.errorOnCatchAll && this.codeFragment == null) {
                                this.compileError(`I didn't expect the character "${m[0]}" here.`);
                            }
                        default:
                            if (this.codeFragment == null) {
                                this._pushToken({ str: s, type: rule.type, $loc: loc });
                            }
                        case TokenType.Ignore:
                            break;
                    }
                    break;
                }
            }
            if (!found) {
                this.compileError(`Could not parse token: <<${m[0]}>>`)
            }
        }
        if (this.includeEOL) {
            this._pushToken(this.eol);
        }
        if (this.codeFragment != null) {
            this.codeFragment += line + '\n';
        }
    }
    _pushToken(token: Token) {
        this.tokens.push(token);
    }
    addError(msg: string, loc?: SourceLocation) {
        let tok = this.lasttoken || this.peekToken();
        if (!loc) loc = tok.$loc;
        this.errors.push({ path: loc.path, line: loc.line, label: this.curlabel, start: loc.start, end: loc.end, msg: msg });
    }
    internalError() {
        this.compileError("Internal error.");
    }
    notImplementedError() {
        this.compileError("Not yet implemented.");
    }
    compileError(msg: string, loc?: SourceLocation, loc2?: SourceLocation) {
        this.addError(msg, loc);
        //if (loc2 != null) this.addError(`...`, loc2);
        throw new CompileError(msg, loc);
    }
    peekToken(lookahead?: number): Token {
        let tok = this.tokens[lookahead || 0];
        return tok ? tok : this.eol;
    }
    consumeToken(): Token {
        let tok = this.lasttoken = (this.tokens.shift() || this.eol);
        return tok;
    }
    expectToken(str: string, msg?: string): Token {
        let tok = this.consumeToken();
        let tokstr = tok.str;
        if (str != tokstr) {
            this.compileError(msg || `There should be a "${str}" here.`);
        }
        return tok;
    }
    expectTokens(strlist: string[], msg?: string): Token {
        let tok = this.consumeToken();
        let tokstr = tok.str;
        if (strlist.indexOf(tokstr) < 0) {
            this.compileError(msg || `There should be a ${strlist.map((s) => `"${s}"`).join(' or ')} here, not "${tokstr}.`);
        }
        return tok;
    }
    parseModifiers(modifiers: string[]): { [modifier: string]: boolean } {
        let result = {};
        do {
            var tok = this.peekToken();
            if (modifiers.indexOf(tok.str) < 0)
                return result;
            this.consumeToken();
            result[tok.str] = true;
        } while (tok != null);
    }
    expectIdent(msg?: string): Token {
        let tok = this.consumeToken();
        if (tok.type != TokenType.Ident)
            this.compileError(msg || `There should be an identifier here.`);
        return tok;
    }
    pushbackToken(tok: Token) {
        this.tokens.unshift(tok);
    }
    isEOF() {
        return this.tokens.length == 0 || this.peekToken().type == 'eof'; // TODO?
    }
    expectEOL(msg?: string) {
        let tok = this.consumeToken();
        if (tok.type != TokenType.EOL)
            this.compileError(msg || `There's too much stuff on this line.`);
    }
    skipBlankLines() {
        this.skipTokenTypes(['eol']);
    }
    skipTokenTypes(types: string[]) {
        while (types.includes(this.peekToken().type))
            this.consumeToken();
    }
    expectTokenTypes(types: string[], msg?: string) {
        let tok = this.consumeToken();
        if (!types.includes(tok.type))
            this.compileError(msg || `There should be a ${types.map((s) => `"${s}"`).join(' or ')} here. not a "${tok.type}".`);
        return tok;
    }
    parseList<T>(parseFunc:()=>T, delim:string): T[] {
        var sep;
        var list = [];
        do {
            var el = parseFunc.bind(this)(); // call parse function
            if (el != null) list.push(el); // add parsed element to list
            sep = this.consumeToken(); // consume seperator token
        } while (sep.str == delim);
        this.pushbackToken(sep);
        return list;
    }
}
