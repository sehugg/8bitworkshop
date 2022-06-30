"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.Tokenizer = exports.TokenizerRuleSet = exports.TokenRule = exports.Token = exports.TokenType = exports.mergeLocs = exports.CompileError = void 0;
class CompileError extends Error {
    constructor(msg, loc) {
        super(msg);
        Object.setPrototypeOf(this, CompileError.prototype);
        this.$loc = loc;
    }
}
exports.CompileError = CompileError;
function mergeLocs(a, b) {
    return {
        line: Math.min(a.line, b.line),
        start: Math.min(a.start, b.start),
        end: Math.max(a.end, b.end),
        label: a.label || b.label,
        path: a.path || b.path,
    };
}
exports.mergeLocs = mergeLocs;
var TokenType;
(function (TokenType) {
    TokenType["EOF"] = "eof";
    TokenType["EOL"] = "eol";
    TokenType["Ident"] = "ident";
    TokenType["Comment"] = "comment";
    TokenType["Ignore"] = "ignore";
    TokenType["CatchAll"] = "catch-all";
})(TokenType = exports.TokenType || (exports.TokenType = {}));
class Token {
}
exports.Token = Token;
class TokenRule {
}
exports.TokenRule = TokenRule;
const CATCH_ALL_RULES = [
    { type: TokenType.CatchAll, regex: /.+?/ }
];
function re_escape(rule) {
    return `(${rule.regex.source})`;
}
class TokenizerRuleSet {
    constructor(rules) {
        this.rules = rules.concat(CATCH_ALL_RULES);
        var pattern = this.rules.map(re_escape).join('|');
        this.regex = new RegExp(pattern, "gs"); // global, dotall
    }
}
exports.TokenizerRuleSet = TokenizerRuleSet;
class Tokenizer {
    constructor() {
        this.errorOnCatchAll = false;
        this.deferred = [];
        this.errors = [];
        this.lineno = 0;
        this.lineindex = [];
        this.tokens = [];
    }
    setTokenRuleSet(ruleset) {
        this.ruleset = ruleset;
    }
    setTokenRules(rules) {
        this.setTokenRuleSet(new TokenizerRuleSet(rules));
    }
    tokenizeFile(contents, path) {
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
    _tokenize(text) {
        // iterate over each token via re_toks regex
        let m;
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
                let s = m[i + 1];
                if (s != null) {
                    found = true;
                    let col = m.index - (this.lineindex[this.lineno - 1] || -1) - 1;
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
                                this.tokens[this.tokens.length - 1].eol = true;
                        case TokenType.Comment:
                        case TokenType.Ignore:
                            break;
                    }
                    break;
                }
            }
            if (!found) {
                this.compileError(`Could not parse token: <<${m[0]}>>`);
            }
        }
    }
    pushToken(token) {
        this.tokens.push(token);
    }
    addError(msg, loc) {
        let tok = this.lasttoken || this.peekToken();
        if (!loc)
            loc = tok.$loc;
        this.errors.push({ path: loc.path, line: loc.line, label: this.curlabel, start: loc.start, end: loc.end, msg: msg });
    }
    internalError() {
        return this.compileError("Internal error.");
    }
    notImplementedError() {
        return this.compileError("Not yet implemented.");
    }
    compileError(msg, loc, loc2) {
        this.addError(msg, loc);
        //if (loc2 != null) this.addError(`...`, loc2);
        let e = new CompileError(msg, loc);
        throw e;
        return e;
    }
    peekToken(lookahead) {
        let tok = this.tokens[lookahead || 0];
        return tok ? tok : this.eof;
    }
    consumeToken() {
        let tok = this.lasttoken = (this.tokens.shift() || this.eof);
        return tok;
    }
    ifToken(match) {
        if (this.peekToken().str == match)
            return this.consumeToken();
    }
    expectToken(str, msg) {
        let tok = this.consumeToken();
        let tokstr = tok.str;
        if (str != tokstr) {
            this.compileError(msg || `There should be a "${str}" here.`);
        }
        return tok;
    }
    expectTokens(strlist, msg) {
        let tok = this.consumeToken();
        let tokstr = tok.str;
        if (!strlist.includes(tokstr)) {
            this.compileError(msg || `These keywords are valid here: ${strlist.join(', ')}`);
        }
        return tok;
    }
    parseModifiers(modifiers) {
        let result = {};
        do {
            var tok = this.peekToken();
            if (modifiers.indexOf(tok.str) < 0)
                return result;
            this.consumeToken();
            result[tok.str] = true;
        } while (tok != null);
    }
    expectIdent(msg) {
        let tok = this.consumeToken();
        if (tok.type != TokenType.Ident)
            this.compileError(msg || `There should be an identifier here.`);
        return tok;
    }
    pushbackToken(tok) {
        this.tokens.unshift(tok);
    }
    isEOF() {
        return this.tokens.length == 0 || this.peekToken().type == 'eof'; // TODO?
    }
    expectEOL(msg) {
        let tok = this.consumeToken();
        if (tok.type != TokenType.EOL)
            this.compileError(msg || `There's too much stuff on this line.`);
    }
    skipBlankLines() {
        this.skipTokenTypes(['eol']);
    }
    skipTokenTypes(types) {
        while (types.includes(this.peekToken().type))
            this.consumeToken();
    }
    expectTokenTypes(types, msg) {
        let tok = this.consumeToken();
        if (!types.includes(tok.type))
            this.compileError(msg || `There should be a ${types.map((s) => `"${s}"`).join(' or ')} here. not a "${tok.type}".`);
        return tok;
    }
    parseList(parseFunc, delim) {
        var sep;
        var list = [];
        do {
            var el = parseFunc.bind(this)(); // call parse function
            if (el != null)
                list.push(el); // add parsed element to list
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
exports.Tokenizer = Tokenizer;
//# sourceMappingURL=tokenizer.js.map