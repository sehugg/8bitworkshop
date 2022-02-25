
import type { SourceLocation, SourceLine, WorkerError, SourceLocated } from "./workertypes";

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
    CatchAll = 'catch-all',
}

export class Token implements SourceLocated {
    str: string;
    type: string;
    eol: boolean;   // end of line?
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

export class TokenizerRuleSet {
    rules: TokenRule[];
    regex: RegExp;
    constructor(rules: TokenRule[]) {
        this.rules = rules.concat(CATCH_ALL_RULES);
        var pattern = this.rules.map(re_escape).join('|');
        this.regex = new RegExp(pattern, "gs"); // global, dotall
    }
}

export class Tokenizer {
    ruleset: TokenizerRuleSet;
    lineindex: number[];
    path: string;
    lineno: number;
    tokens: Token[];
    lasttoken: Token;
    errors: WorkerError[];
    curlabel: string;
    eof: Token;
    errorOnCatchAll = false;
    deferred: (() => void)[] = [];

    constructor() {
        this.errors = [];
        this.lineno = 0;
        this.lineindex = [];
        this.tokens = [];
    }
    setTokenRuleSet(ruleset: TokenizerRuleSet) {
        this.ruleset = ruleset;
    }
    setTokenRules(rules: TokenRule[]) {
        this.setTokenRuleSet(new TokenizerRuleSet(rules));
    }
    tokenizeFile(contents: string, path: string) {
        this.path = path;
        let m;
        let re = /\n|\r\n?/g;
        this.lineindex.push(0);
        while (m = re.exec(contents)) {
            this.lineindex.push(m.index);
        }
        this._tokenize(contents);
        this.eof = { type: TokenType.EOF, str: "", eol: true, $loc: { path: this.path, line: this.lineno } };
        this.pushToken(this.eof);
    }
    _tokenize(text: string): void {
        // iterate over each token via re_toks regex
        let m: RegExpMatchArray;
        this.lineno = 0;
        while (m = this.ruleset.regex.exec(text)) {
            let found = false;
            // find line #
            while (m.index >= this.lineindex[this.lineno]) {
                this.lineno++;
            }
            // find out which capture group was matched, and thus token type
            let rules = this.ruleset.rules;
            for (let i = 0; i < rules.length; i++) {
                let s: string = m[i + 1];
                if (s != null) {
                    found = true;
                    let col = m.index - (this.lineindex[this.lineno-1] || -1) - 1;
                    let loc = { path: this.path, line: this.lineno, start: col, end: col + s.length };
                    let rule = rules[i];
                    // add token to list
                    switch (rule.type) {
                        case TokenType.CatchAll:
                            if (this.errorOnCatchAll) {
                                this.compileError(`I didn't expect the character "${m[0]}" here.`, loc);
                            }
                        default:
                            this.pushToken({ str: s, type: rule.type, $loc: loc, eol: false });
                            break;
                        case TokenType.EOL:
                            // set EOL for last token
                            if (this.tokens.length)
                                this.tokens[this.tokens.length-1].eol = true;
                        case TokenType.Comment:
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
    }
    pushToken(token: Token) {
        this.tokens.push(token);
    }
    addError(msg: string, loc?: SourceLocation) {
        let tok = this.lasttoken || this.peekToken();
        if (!loc) loc = tok.$loc;
        this.errors.push({ path: loc.path, line: loc.line, label: this.curlabel, start: loc.start, end: loc.end, msg: msg });
    }
    internalError() {
        return this.compileError("Internal error.");
    }
    notImplementedError() {
        return this.compileError("Not yet implemented.");
    }
    compileError(msg: string, loc?: SourceLocation, loc2?: SourceLocation) : CompileError {
        this.addError(msg, loc);
        //if (loc2 != null) this.addError(`...`, loc2);
        let e = new CompileError(msg, loc);
        throw e;
        return e;
    }
    peekToken(lookahead?: number): Token {
        let tok = this.tokens[lookahead || 0];
        return tok ? tok : this.eof;
    }
    consumeToken(): Token {
        let tok = this.lasttoken = (this.tokens.shift() || this.eof);
        return tok;
    }
    ifToken(match: string): Token | undefined {
        if (this.peekToken().str == match) return this.consumeToken();
    }
    expectToken(str: string, msg?: string): Token {
        let tok = this.consumeToken();
        let tokstr = tok.str;
        if (str != tokstr) {
            this.compileError(msg || `There should be a "${str}" here.`);
        }
        return tok;
    }
    expectTokens(strlist: readonly string[], msg?: string): Token {
        let tok = this.consumeToken();
        let tokstr = tok.str;
        if (!strlist.includes(tokstr)) {
            this.compileError(msg || `These keywords are valid here: ${strlist.join(', ')}`);
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
    runDeferred() {
        while (this.deferred.length) {
            this.deferred.shift()();
        }
    }
}
