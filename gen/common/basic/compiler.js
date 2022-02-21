"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.DIALECTS = exports.MODERN_BASIC = exports.BASIC80 = exports.APPLESOFT_BASIC = exports.ALTAIR_BASIC41 = exports.BASICODE = exports.DEC_BASIC_PLUS = exports.DEC_BASIC_11 = exports.HP_TIMESHARED_BASIC = exports.TINY_BASIC = exports.DARTMOUTH_4TH_EDITION = exports.ECMA55_MINIMAL = exports.BASICParser = exports.TokenType = exports.CompileError = void 0;
class CompileError extends Error {
    constructor(msg, loc) {
        super(msg);
        Object.setPrototypeOf(this, CompileError.prototype);
        this.$loc = loc;
    }
}
exports.CompileError = CompileError;
// Lexer regular expression -- each (capture group) handles a different token type
//                FLOAT                             INT       HEXOCTAL                    REMARK   IDENT           STRING   RELOP        EXP    OPERATORS             OTHER  WS
const re_toks = /([0-9.]+[E][+-]?\d+|\d+[.][E0-9]*|[.][E0-9]+)|[0]*(\d+)|&([OH][0-9A-F]+)|(['].*)|([A-Z_]\w*[$]?)|(".*?")|([<>]?[=<>#])|(\*\*)|([-+*/^,;:()\[\]\?\\])|(\S+)|(\s+)/gi;
var TokenType;
(function (TokenType) {
    TokenType[TokenType["EOL"] = 0] = "EOL";
    TokenType[TokenType["Float"] = 1] = "Float";
    TokenType[TokenType["Int"] = 2] = "Int";
    TokenType[TokenType["HexOctalInt"] = 3] = "HexOctalInt";
    TokenType[TokenType["Remark"] = 4] = "Remark";
    TokenType[TokenType["Ident"] = 5] = "Ident";
    TokenType[TokenType["String"] = 6] = "String";
    TokenType[TokenType["Relational"] = 7] = "Relational";
    TokenType[TokenType["DoubleStar"] = 8] = "DoubleStar";
    TokenType[TokenType["Operator"] = 9] = "Operator";
    TokenType[TokenType["CatchAll"] = 10] = "CatchAll";
    TokenType[TokenType["Whitespace"] = 11] = "Whitespace";
    TokenType[TokenType["_LAST"] = 12] = "_LAST";
})(TokenType = exports.TokenType || (exports.TokenType = {}));
class Token {
}
const OPERATORS = {
    'IMP': { f: 'bimp', p: 4 },
    'EQV': { f: 'beqv', p: 5 },
    'XOR': { f: 'bxor', p: 6 },
    'OR': { f: 'bor', p: 7 },
    'AND': { f: 'band', p: 8 },
    '||': { f: 'lor', p: 17 },
    '&&': { f: 'land', p: 18 },
    '=': { f: 'eq', p: 50 },
    '==': { f: 'eq', p: 50 },
    '<>': { f: 'ne', p: 50 },
    '><': { f: 'ne', p: 50 },
    '!=': { f: 'ne', p: 50 },
    '#': { f: 'ne', p: 50 },
    '<': { f: 'lt', p: 50 },
    '>': { f: 'gt', p: 50 },
    '<=': { f: 'le', p: 50 },
    '>=': { f: 'ge', p: 50 },
    'MIN': { f: 'min', p: 75 },
    'MAX': { f: 'max', p: 75 },
    '+': { f: 'add', p: 100 },
    '-': { f: 'sub', p: 100 },
    '%': { f: 'mod', p: 140 },
    'MOD': { f: 'mod', p: 140 },
    '\\': { f: 'idiv', p: 150 },
    '*': { f: 'mul', p: 200 },
    '/': { f: 'div', p: 200 },
    '^': { f: 'pow', p: 300 },
    '**': { f: 'pow', p: 300 },
};
function getOperator(op) {
    return OPERATORS[op];
}
function getPrecedence(tok) {
    switch (tok.type) {
        case TokenType.Operator:
        case TokenType.DoubleStar:
        case TokenType.Relational:
        case TokenType.Ident:
            let op = getOperator(tok.str);
            if (op)
                return op.p;
    }
    return -1;
}
// is token an end of statement marker? (":" or end of line)
function isEOS(tok) {
    return tok.type == TokenType.EOL || tok.type == TokenType.Remark
        || tok.str == ':' || tok.str == 'ELSE'; // TODO: only ELSE if ifElse==true
}
function stripQuotes(s) {
    // TODO: assert
    return s.substr(1, s.length - 2);
}
function isLiteral(arg) {
    return arg.value != null;
}
function isLookup(arg) {
    return arg.name != null;
}
function isBinOp(arg) {
    return arg.op != null && arg.left != null && arg.right != null;
}
function isUnOp(arg) {
    return arg.op != null && arg.expr != null;
}
function mergeLocs(a, b) {
    return {
        line: Math.min(a.line, b.line),
        start: Math.min(a.start, b.start),
        end: Math.max(a.end, b.end),
        label: a.label || b.label,
        path: a.path || b.path,
    };
}
///// BASIC PARSER
class BASICParser {
    constructor() {
        this.opts = exports.DIALECTS['DEFAULT'];
        this.maxlinelen = 255; // maximum line length (some like HP use 72 chars)
        this.optionCount = 0;
        this.lineno = 0;
        this.curlabel = null;
        this.stmts = [];
        this.labels = {};
        this.targets = {};
        this.errors = [];
        this.listings = {};
        this.vardefs = {};
        this.varrefs = {};
        this.fnrefs = {};
        this.scopestack = [];
        this.elseifcount = 0;
    }
    addError(msg, loc) {
        var tok = this.lasttoken || this.peekToken();
        if (!loc)
            loc = tok.$loc;
        this.errors.push({ path: loc.path, line: loc.line, label: this.curlabel, start: loc.start, end: loc.end, msg: msg });
    }
    compileError(msg, loc, loc2) {
        this.addError(msg, loc);
        //if (loc2 != null) this.addError(`...`, loc2);
        throw new CompileError(msg, loc);
    }
    dialectError(what, loc) {
        this.compileError(`${what} in this dialect of BASIC (${this.opts.dialectName}).`, loc);
    }
    dialectErrorNoSupport(what, loc) {
        this.compileError(`You can't use ${what} in this dialect of BASIC (${this.opts.dialectName}).`, loc); // TODO
    }
    consumeToken() {
        var tok = this.lasttoken = (this.tokens.shift() || this.eol);
        return tok;
    }
    expectToken(str, msg) {
        var tok = this.consumeToken();
        var tokstr = tok.str;
        if (str != tokstr) {
            this.compileError(msg || `There should be a "${str}" here.`);
        }
        return tok;
    }
    expectTokens(strlist, msg) {
        var tok = this.consumeToken();
        var tokstr = tok.str;
        if (strlist.indexOf(tokstr) < 0) {
            this.compileError(msg || `There should be a ${strlist.map((s) => `"${s}"`).join(' or ')} here.`);
        }
        return tok;
    }
    peekToken(lookahead) {
        var tok = this.tokens[lookahead || 0];
        return tok ? tok : this.eol;
    }
    pushbackToken(tok) {
        this.tokens.unshift(tok);
    }
    // this parses either a line number or "label:" -- or adds a default label to a line
    parseOptLabel() {
        let tok = this.consumeToken();
        switch (tok.type) {
            case TokenType.Ident:
                if (this.opts.optionalLabels || tok.str == 'OPTION') {
                    // is it a "label :" and not a keyword like "PRINT : "
                    if (this.peekToken().str == ':' && !this.supportsCommand(tok.str)) {
                        this.consumeToken(); // eat the ":"
                        // fall through to the next case
                    }
                    else {
                        this.pushbackToken(tok); // nope
                        break;
                    }
                }
                else
                    this.dialectError(`Each line must begin with a line number`);
            case TokenType.Int:
                this.addLabel(tok.str);
                return;
            // label added, return from function... other cases add default label
            case TokenType.HexOctalInt:
            case TokenType.Float:
                this.compileError(`Line numbers must be positive integers.`);
                break;
            case TokenType.Operator:
                if (this.supportsCommand(tok.str) && this.validKeyword(tok.str)) {
                    this.pushbackToken(tok);
                    break; // "?" is allowed
                }
            default:
                if (this.opts.optionalLabels)
                    this.compileError(`A line must start with a line number, command, or label.`);
                else
                    this.compileError(`A line must start with a line number.`);
            case TokenType.Remark:
                break;
        }
        // add default label
        this.addLabel('#' + this.lineno);
    }
    getPC() {
        return this.stmts.length;
    }
    addStatement(stmt, cmdtok, endtok) {
        // set location for statement, adding offset (PC) field
        if (endtok == null)
            endtok = this.peekToken();
        stmt.$loc = { path: cmdtok.$loc.path, line: cmdtok.$loc.line, start: cmdtok.$loc.start, end: endtok.$loc.start,
            label: this.curlabel,
            offset: this.stmts.length };
        // check IF/THEN WHILE/WEND FOR/NEXT etc
        this.modifyScope(stmt);
        // add to list
        this.stmts.push(stmt);
    }
    addLabel(str, offset) {
        if (this.labels[str] != null)
            this.compileError(`There's a duplicated label named "${str}".`);
        this.labels[str] = this.getPC() + (offset || 0);
        this.curlabel = str;
        this.tokens.forEach((tok) => tok.$loc.label = str);
    }
    parseFile(file, path) {
        this.path = path;
        var txtlines = file.split(/\n|\r\n?/);
        txtlines.forEach((line) => this.parseLine(line));
        var program = { opts: this.opts, stmts: this.stmts, labels: this.labels };
        this.checkAll(program);
        this.listings[path] = this.generateListing(file, program);
        return program;
    }
    parseLine(line) {
        try {
            this.tokenize(line);
            this.parse();
        }
        catch (e) {
            if (!(e instanceof CompileError))
                throw e; // ignore compile errors since errors[] list captures them
        }
    }
    _tokenize(line) {
        // split identifier regex (if token-crunching enabled)
        let splitre = this.opts.optionalWhitespace && new RegExp('(' + this.opts.validKeywords.map(s => `${s}`).join('|') + ')');
        // iterate over each token via re_toks regex
        var lastTokType = TokenType.CatchAll;
        var m;
        while (m = re_toks.exec(line)) {
            for (var i = 1; i <= lastTokType; i++) {
                let s = m[i];
                if (s != null) {
                    let loc = { path: this.path, line: this.lineno, start: m.index, end: m.index + s.length };
                    // maybe we don't support unicode in 1975?
                    if (this.opts.asciiOnly && !/^[\x00-\x7F]*$/.test(s))
                        this.dialectErrorNoSupport(`non-ASCII characters`);
                    // uppercase all identifiers, and maybe more
                    if (i == TokenType.Ident || i == TokenType.HexOctalInt || this.opts.uppercaseOnly) {
                        s = s.toUpperCase();
                        // DATA statement captures whitespace too
                        if (s == 'DATA')
                            lastTokType = TokenType.Whitespace;
                        // certain keywords shouldn't split for rest of line
                        if (s == 'DATA')
                            splitre = null;
                        if (s == 'OPTION')
                            splitre = null;
                        // REM means ignore rest of statement
                        if (lastTokType == TokenType.CatchAll && s.startsWith('REM')) {
                            s = 'REM';
                            lastTokType = TokenType.EOL;
                        }
                    }
                    // convert brackets
                    if (s == '[' || s == ']') {
                        if (!this.opts.squareBrackets)
                            this.dialectErrorNoSupport(`square brackets`);
                        if (s == '[')
                            s = '(';
                        if (s == ']')
                            s = ')';
                    }
                    // un-crunch tokens?
                    if (splitre && i == TokenType.Ident) {
                        var splittoks = s.split(splitre).filter((s) => s != ''); // only non-empties
                        if (splittoks.length > 1) {
                            splittoks.forEach((ss) => {
                                // check to see if leftover might be integer, or identifier
                                if (/^[0-9]+$/.test(ss))
                                    i = TokenType.Int;
                                else if (/^[A-Z_]\w*[$]?$/.test(ss))
                                    i = TokenType.Ident;
                                else
                                    this.compileError(`Try adding whitespace before "${ss}".`);
                                this.tokens.push({ str: ss, type: i, $loc: loc });
                            });
                            s = null;
                        }
                    }
                    // add token to list
                    if (s)
                        this.tokens.push({ str: s, type: i, $loc: loc });
                    break;
                }
            }
        }
    }
    tokenize(line) {
        this.lineno++;
        this.tokens = []; // can't have errors until this is set
        this.eol = { type: TokenType.EOL, str: "", $loc: { path: this.path, line: this.lineno, start: line.length } };
        if (line.length > this.maxlinelen)
            this.compileError(`A line should be no more than ${this.maxlinelen} characters long.`);
        this._tokenize(line);
    }
    parse() {
        // not empty line?
        if (this.tokens.length) {
            this.parseOptLabel();
            if (this.tokens.length) {
                this.parseCompoundStatement();
            }
            var next = this.peekToken();
            if (!isEOS(next))
                this.compileError(`Expected end of line or ':'`, next.$loc);
            this.curlabel = null;
        }
    }
    parseCompoundStatement() {
        if (this.opts.multipleStmtsPerLine) {
            this.parseList(this.parseStatement, ':');
        }
        else {
            this.parseList(this.parseStatement, '\0');
            if (this.peekToken().str == ':')
                this.dialectErrorNoSupport(`multiple statements on a line`);
        }
    }
    validKeyword(keyword) {
        return (this.opts.validKeywords && this.opts.validKeywords.indexOf(keyword) < 0) ? null : keyword;
    }
    validFunction(funcname) {
        return (this.opts.validFunctions && this.opts.validFunctions.indexOf(funcname) < 0) ? null : funcname;
    }
    supportsCommand(cmd) {
        if (cmd == '?')
            return this.stmt__PRINT;
        else
            return this['stmt__' + cmd];
    }
    parseStatement() {
        // eat extra ":" (should have separate property for this)
        if (this.opts.optionalWhitespace && this.peekToken().str == ':')
            return null;
        // get the command word
        var cmdtok = this.consumeToken();
        var cmd = cmdtok.str;
        var stmt;
        switch (cmdtok.type) {
            case TokenType.Remark:
                if (cmdtok.str.startsWith("'") && !this.opts.tickComments)
                    this.dialectErrorNoSupport(`tick comments`);
                return null;
            case TokenType.Operator:
                // "?" is alias for "PRINT" on some platforms
                if (cmd == this.validKeyword('?'))
                    cmd = 'PRINT';
            case TokenType.Ident:
                // ignore remarks
                if (cmd == 'REM')
                    return null;
                // look for "GO TO" and "GO SUB"
                if (cmd == 'GO' && this.peekToken().str == 'TO') {
                    this.consumeToken();
                    cmd = 'GOTO';
                }
                else if (cmd == 'GO' && this.peekToken().str == 'SUB') {
                    this.consumeToken();
                    cmd = 'GOSUB';
                }
                // lookup JS function for command
                var fn = this.supportsCommand(cmd);
                if (fn) {
                    if (this.validKeyword(cmd) == null)
                        this.dialectErrorNoSupport(`the ${cmd} statement`);
                    stmt = fn.bind(this)();
                    break;
                }
                else if (this.peekToken().str == '=' || this.peekToken().str == '(') {
                    if (!this.opts.optionalLet)
                        this.dialectError(`Assignments must have a preceding LET`);
                    // 'A = expr' or 'A(X) = expr'
                    this.pushbackToken(cmdtok);
                    stmt = this.stmt__LET();
                    break;
                }
                else {
                    this.compileError(`I don't understand the command "${cmd}".`);
                }
            case TokenType.EOL:
                if (this.opts.optionalWhitespace)
                    return null;
            default:
                this.compileError(`There should be a command here.`);
                return null;
        }
        // add statement to list
        if (stmt != null)
            this.addStatement(stmt, cmdtok);
        return stmt;
    }
    // check scope stuff (if compiledBlocks is true)
    modifyScope(stmt) {
        if (this.opts.compiledBlocks) {
            var cmd = stmt.command;
            if (cmd == 'FOR' || cmd == 'WHILE' || cmd == 'SUB') {
                this.scopestack.push(this.getPC()); // has to be before adding statment to list
            }
            else if (cmd == 'NEXT') {
                this.popScope(stmt, 'FOR');
            }
            else if (cmd == 'WEND') {
                this.popScope(stmt, 'WHILE');
            }
        }
    }
    popScope(close, open) {
        var popidx = this.scopestack.pop();
        var popstmt = popidx != null ? this.stmts[popidx] : null;
        if (popstmt == null)
            this.compileError(`There's a ${close.command} without a matching ${open}.`, close.$loc);
        else if (popstmt.command != open)
            this.compileError(`There's a ${close.command} paired with ${popstmt.command}, but it should be paired with ${open}.`, close.$loc, popstmt.$loc);
        else if (close.command == 'NEXT' && !this.opts.optionalNextVar
            && close.lexpr.name != popstmt.lexpr.name)
            this.compileError(`This NEXT statement is matched with the wrong FOR variable (${close.lexpr.name}).`, close.$loc, popstmt.$loc);
        // set start + end locations
        close.startpc = popidx;
        popstmt.endpc = this.getPC(); // has to be before adding statment to list
    }
    popIfThenScope(nextpc) {
        var popidx = this.scopestack.pop();
        var popstmt = popidx != null ? this.stmts[popidx] : null;
        if (popstmt == null)
            this.compileError(`There's an END IF without a matching IF or ELSE.`);
        if (popstmt.command == 'ELSE') {
            popstmt.endpc = this.getPC();
            this.popIfThenScope(popidx + 1); // IF goes to ELSE+1
        }
        else if (popstmt.command == 'IF') {
            popstmt.endpc = nextpc != null ? nextpc : this.getPC();
        }
        else {
            this.compileError(`There's an END IF paired with a ${popstmt.command}, not IF or ELSE.`, this.lasttoken.$loc, popstmt.$loc);
        }
    }
    parseVarSubscriptOrFunc() {
        var tok = this.consumeToken();
        switch (tok.type) {
            case TokenType.Ident:
                let args = null;
                if (this.peekToken().str == '(') {
                    this.expectToken('(');
                    args = this.parseExprList();
                    this.expectToken(')', `There should be another expression or a ")" here.`);
                }
                var loc = mergeLocs(tok.$loc, this.lasttoken.$loc);
                var valtype = this.exprTypeForSubscript(tok.str, args, loc);
                return { valtype: valtype, name: tok.str, args: args, $loc: loc };
            default:
                this.compileError(`There should be a variable name here.`);
                break;
        }
    }
    parseLexpr() {
        var lexpr = this.parseVarSubscriptOrFunc();
        this.vardefs[lexpr.name] = lexpr;
        this.validateVarName(lexpr);
        return lexpr;
    }
    parseForNextLexpr() {
        var lexpr = this.parseLexpr();
        if (lexpr.args || lexpr.name.endsWith('$'))
            this.compileError(`A FOR ... NEXT loop can only use numeric variables.`, lexpr.$loc);
        return lexpr;
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
    parseLexprList() {
        return this.parseList(this.parseLexpr, ',');
    }
    parseExprList() {
        return this.parseList(this.parseExpr, ',');
    }
    parseLabelList() {
        return this.parseList(this.parseLabel, ',');
    }
    parseLabel() {
        // parse full expr?
        if (this.opts.computedGoto) {
            // parse expression, but still add to list of label targets if constant
            var expr = this.parseExpr();
            if (isLiteral(expr))
                this.targets[expr.value] = this.lasttoken.$loc;
            return expr;
        }
        else {
            // parse a single number or ident label
            var tok = this.consumeToken();
            switch (tok.type) {
                case TokenType.Ident:
                    if (!this.opts.optionalLabels)
                        this.dialectError(`All labels must be line numbers`);
                case TokenType.Int:
                    var label = tok.str;
                    this.targets[label] = tok.$loc;
                    return { valtype: 'label', value: label };
                default:
                    var what = this.opts.optionalLabels ? "label or line number" : "line number";
                    this.compileError(`There should be a ${what} here.`);
            }
        }
    }
    parseDatumList() {
        return this.parseList(this.parseDatum, ',');
    }
    parseDatum() {
        var tok = this.consumeToken();
        // get rid of leading whitespace
        while (tok.type == TokenType.Whitespace)
            tok = this.consumeToken();
        if (isEOS(tok))
            this.compileError(`There should be a datum here.`);
        // parse constants
        if (tok.type <= TokenType.HexOctalInt) {
            return this.parseValue(tok);
        }
        if (tok.str == '-' && this.peekToken().type <= TokenType.HexOctalInt) {
            tok = this.consumeToken();
            return { valtype: 'number', value: -this.parseValue(tok).value };
        }
        if (tok.str == '+' && this.peekToken().type <= TokenType.HexOctalInt) {
            tok = this.consumeToken();
            return this.parseValue(tok);
        }
        // concat all stuff including whitespace
        // TODO: should trim whitespace only if not quoted string
        var s = '';
        while (!isEOS(tok) && tok.str != ',') {
            s += this.parseValue(tok).value;
            tok = this.consumeToken();
        }
        this.pushbackToken(tok);
        return { valtype: 'string', value: s }; // trim leading and trailing whitespace
    }
    parseValue(tok) {
        switch (tok.type) {
            case TokenType.HexOctalInt:
                if (!this.opts.hexOctalConsts)
                    this.dialectErrorNoSupport(`hex/octal constants`);
                let base = tok.str.startsWith('H') ? 16 : 8;
                return { valtype: 'number', value: parseInt(tok.str.substr(1), base) };
            case TokenType.Int:
            case TokenType.Float:
                return { valtype: 'number', value: this.parseNumber(tok.str) };
            case TokenType.String:
                return { valtype: 'string', value: stripQuotes(tok.str) };
            default:
                return { valtype: 'string', value: tok.str }; // only used in DATA statement
        }
    }
    parsePrimary() {
        let tok = this.consumeToken();
        switch (tok.type) {
            case TokenType.HexOctalInt:
            case TokenType.Int:
            case TokenType.Float:
            case TokenType.String:
                return this.parseValue(tok);
            case TokenType.Ident:
                if (tok.str == 'NOT') {
                    let expr = this.parsePrimary();
                    return { valtype: 'number', op: this.opts.bitwiseLogic ? 'bnot' : 'lnot', expr: expr };
                }
                else {
                    this.pushbackToken(tok);
                    return this.parseVarSubscriptOrFunc();
                }
            case TokenType.Operator:
                if (tok.str == '(') {
                    let expr = this.parseExpr();
                    this.expectToken(')', `There should be another expression or a ")" here.`);
                    return expr;
                }
                else if (tok.str == '-') {
                    let expr = this.parsePrimary(); // TODO: -2^2=-4 and -2-2=-4
                    return { valtype: 'number', op: 'neg', expr: expr };
                }
                else if (tok.str == '+') {
                    return this.parsePrimary(); // ignore unary +
                }
            default:
                this.compileError(`The expression is incomplete.`);
                return;
        }
    }
    parseNumber(str) {
        var n = parseFloat(str);
        if (isNaN(n))
            this.compileError(`The number ${str} is not a valid floating-point number.`);
        if (this.opts.checkOverflow && !isFinite(n))
            this.compileError(`The number ${str} is too big to fit into a floating-point value.`);
        return n;
    }
    parseExpr1(left, minPred) {
        let look = this.peekToken();
        while (getPrecedence(look) >= minPred) {
            let op = this.consumeToken();
            if (this.opts.validOperators && this.opts.validOperators.indexOf(op.str) < 0)
                this.dialectErrorNoSupport(`the "${op.str}" operator`);
            let right = this.parsePrimary();
            look = this.peekToken();
            while (getPrecedence(look) > getPrecedence(op)) {
                right = this.parseExpr1(right, getPrecedence(look));
                look = this.peekToken();
            }
            var opfn = getOperator(op.str).f;
            // use logical operators instead of bitwise?
            if (!this.opts.bitwiseLogic && op.str == 'AND')
                opfn = 'land';
            if (!this.opts.bitwiseLogic && op.str == 'OR')
                opfn = 'lor';
            var valtype = this.exprTypeForOp(opfn, left, right, op);
            left = { valtype: valtype, op: opfn, left: left, right: right };
        }
        return left;
    }
    parseExpr() {
        var startloc = this.peekToken().$loc;
        var expr = this.parseExpr1(this.parsePrimary(), 0);
        var endloc = this.lasttoken.$loc;
        expr.$loc = mergeLocs(startloc, endloc);
        return expr;
    }
    parseExprWithType(expecttype) {
        var expr = this.parseExpr();
        if (expr.valtype != expecttype)
            this.compileError(`There should be a ${expecttype} here, but this expression evaluates to a ${expr.valtype}.`, expr.$loc);
        return expr;
    }
    validateVarName(lexpr) {
        switch (this.opts.varNaming) {
            case 'A': // TINY BASIC, no strings
                if (!/^[A-Z]$/i.test(lexpr.name))
                    this.dialectErrorNoSupport(`variable names other than a single letter`);
                break;
            case 'A1':
                if (lexpr.args == null && !/^[A-Z][0-9]?[$]?$/i.test(lexpr.name))
                    this.dialectErrorNoSupport(`variable names other than a letter followed by an optional digit`);
                if (lexpr.args != null && !/^[A-Z]?[$]?$/i.test(lexpr.name))
                    this.dialectErrorNoSupport(`array names other than a single letter`);
                break;
            case 'A1$':
                if (!/^[A-Z][0-9]?[$]?$/i.test(lexpr.name))
                    this.dialectErrorNoSupport(`variable names other than a letter followed by an optional digit`);
                break;
            case 'AA':
                if (lexpr.args == null && !/^[A-Z][A-Z0-9]?[$]?$/i.test(lexpr.name))
                    this.dialectErrorNoSupport(`variable names other than a letter followed by an optional letter or digit`);
                break;
            case '*':
                break;
        }
    }
    visitExpr(expr, callback) {
        if (isBinOp(expr)) {
            this.visitExpr(expr.left, callback);
            this.visitExpr(expr.right, callback);
        }
        if (isUnOp(expr)) {
            this.visitExpr(expr.expr, callback);
        }
        if (isLookup(expr) && expr.args != null) {
            for (var arg of expr.args)
                this.visitExpr(arg, callback);
        }
        callback(expr);
    }
    // type-checking
    exprTypeForOp(fnname, left, right, optok) {
        if (left.valtype == 'string' || right.valtype == 'string') {
            if (fnname == 'add') {
                if (this.opts.stringConcat)
                    return 'string'; // concat strings
                else
                    this.dialectErrorNoSupport(`the "+" operator to concatenate strings`, optok.$loc);
            }
            else if (fnname.length != 2) // only relops are 2 chars long!
                this.compileError(`You can't do math on strings until they're converted to numbers.`, optok.$loc);
        }
        return 'number';
    }
    exprTypeForSubscript(fnname, args, loc) {
        args = args || [];
        // first check the built-in functions
        var defs = BUILTIN_MAP[fnname];
        if (defs != null) {
            if (!this.validFunction(fnname))
                this.dialectErrorNoSupport(`the ${fnname} function`, loc);
            for (var def of defs) {
                if (args.length == def.args.length)
                    return def.result; // TODO: check arg types
            }
            // TODO: check func arg types
            this.compileError(`The ${fnname} function takes ${def.args.length} arguments, but ${args.length} are given.`, loc);
        }
        // no function found, assume it's an array ref
        // TODO: validateVarName() later?
        this.varrefs[fnname] = loc;
        return fnname.endsWith('$') ? 'string' : 'number';
    }
    //// STATEMENTS
    stmt__LET() {
        var lexprs = [this.parseLexpr()];
        this.expectToken("=");
        // look for A=B=expr (TODO: doesn't work on arrays)
        while (this.opts.chainAssignments && this.peekToken().type == TokenType.Ident && this.peekToken(1).str == '=') {
            lexprs.push(this.parseLexpr());
            this.expectToken("=");
        }
        var right = this.parseExprWithType(lexprs[0].valtype);
        return { command: "LET", lexprs: lexprs, right: right };
    }
    stmt__PRINT() {
        var sep, lastsep;
        var list = [];
        do {
            sep = this.peekToken();
            if (isEOS(sep)) {
                break;
            }
            else if (sep.str == ';') {
                this.consumeToken();
                lastsep = sep;
            }
            else if (sep.str == ',') {
                this.consumeToken();
                list.push({ value: '\t' });
                lastsep = sep;
            }
            else {
                list.push(this.parseExpr());
                lastsep = null;
            }
        } while (true);
        if (!(lastsep && (lastsep.str == ';' || sep.str != ','))) {
            list.push({ value: '\n' });
        }
        return { command: "PRINT", args: list };
    }
    stmt__GOTO() {
        return this.__GO("GOTO");
    }
    stmt__GOSUB() {
        return this.__GO("GOSUB");
    }
    __GO(cmd) {
        var expr = this.parseLabel();
        // GOTO (expr) OF (labels...)
        if (this.peekToken().str == this.validKeyword('OF')) {
            this.expectToken('OF');
            let newcmd = (cmd == 'GOTO') ? 'ONGOTO' : 'ONGOSUB';
            return { command: newcmd, expr: expr, labels: this.parseLabelList() };
        }
        else {
            // regular GOTO or GOSUB
            return { command: cmd, label: expr };
        }
    }
    stmt__IF() {
        var cmdtok = this.lasttoken;
        var cond = this.parseExprWithType("number");
        var ifstmt = { command: "IF", cond: cond };
        this.addStatement(ifstmt, cmdtok);
        // we accept GOTO or THEN if line number provided (DEC accepts GO TO)
        var thengoto = this.expectTokens(['THEN', 'GOTO', 'GO']);
        if (thengoto.str == 'GO')
            this.expectToken('TO');
        // multiline IF .. THEN? push it to scope stack
        if (this.opts.multilineIfThen && isEOS(this.peekToken())) {
            this.scopestack.push(this.getPC() - 1); // we already added stmt to list, so - 1
        }
        else {
            // parse line number or statement clause
            this.parseGotoOrStatements();
            // is the next statement an ELSE?
            // gotta parse it now because it's an end-of-statement token
            if (this.peekToken().str == 'ELSE') {
                this.expectToken('ELSE');
                ifstmt.endpc = this.getPC() + 1;
                this.stmt__ELSE();
            }
            else {
                ifstmt.endpc = this.getPC();
            }
        }
    }
    stmt__ELSE() {
        var elsestmt = { command: "ELSE" };
        this.addStatement(elsestmt, this.lasttoken);
        // multiline ELSE? or ELSE IF?
        var nexttok = this.peekToken();
        if (this.opts.multilineIfThen && isEOS(nexttok)) {
            this.scopestack.push(this.getPC() - 1); // we already added stmt to list, so - 1
        }
        else if (this.opts.multilineIfThen && nexttok.str == 'IF') {
            this.scopestack.push(this.getPC() - 1); // we already added stmt to list, so - 1
            this.parseGotoOrStatements();
            this.elseifcount++;
        }
        else {
            // parse line number or statement clause
            this.parseGotoOrStatements();
            elsestmt.endpc = this.getPC();
        }
    }
    parseGotoOrStatements() {
        var lineno = this.peekToken();
        // assume GOTO if number given after THEN
        if (lineno.type == TokenType.Int) {
            this.parseLabel();
            var gotostmt = { command: 'GOTO', label: { valtype: 'label', value: lineno.str } };
            this.addStatement(gotostmt, lineno);
        }
        else {
            // parse rest of IF clause
            this.parseCompoundStatement();
        }
    }
    stmt__FOR() {
        var lexpr = this.parseForNextLexpr();
        this.expectToken('=');
        var init = this.parseExprWithType("number");
        this.expectToken('TO');
        var targ = this.parseExprWithType("number");
        if (this.peekToken().str == 'STEP') {
            this.consumeToken();
            var step = this.parseExprWithType("number");
        }
        return { command: 'FOR', lexpr: lexpr, initial: init, target: targ, step: step };
    }
    stmt__NEXT() {
        var lexpr = null;
        // NEXT var might be optional
        if (!this.opts.optionalNextVar || !isEOS(this.peekToken())) {
            lexpr = this.parseForNextLexpr();
            // convert ',' to ':' 'NEXT'
            if (this.opts.multipleNextVars && this.peekToken().str == ',') {
                this.consumeToken(); // consume ','
                this.tokens.unshift({ type: TokenType.Ident, str: 'NEXT', $loc: this.peekToken().$loc });
                this.tokens.unshift({ type: TokenType.Operator, str: ':', $loc: this.peekToken().$loc });
            }
        }
        return { command: 'NEXT', lexpr: lexpr };
    }
    stmt__WHILE() {
        var cond = this.parseExprWithType("number");
        return { command: 'WHILE', cond: cond };
    }
    stmt__WEND() {
        return { command: 'WEND' };
    }
    stmt__DIM() {
        var lexprs = this.parseLexprList();
        lexprs.forEach((arr) => {
            if (arr.args == null || arr.args.length == 0)
                this.compileError(`An array defined by DIM must have at least one dimension.`);
            else if (arr.args.length > this.opts.maxDimensions)
                this.dialectErrorNoSupport(`arrays with more than ${this.opts.maxDimensions} dimensionals`);
            for (var arrdim of arr.args) {
                if (arrdim.valtype != 'number')
                    this.compileError(`Array dimensions must be numeric.`, arrdim.$loc);
                if (isLiteral(arrdim) && arrdim.value < this.opts.defaultArrayBase)
                    this.compileError(`An array dimension cannot be less than ${this.opts.defaultArrayBase}.`, arrdim.$loc);
            }
        });
        return { command: 'DIM', args: lexprs };
    }
    stmt__INPUT() {
        var prompt = this.consumeToken();
        var promptstr;
        if (prompt.type == TokenType.String) {
            this.expectTokens([';', ',']);
            promptstr = stripQuotes(prompt.str);
        }
        else {
            this.pushbackToken(prompt);
            promptstr = "";
        }
        return { command: 'INPUT', prompt: { valtype: 'string', value: promptstr }, args: this.parseLexprList() };
    }
    /* for HP BASIC only */
    stmt__ENTER() {
        var timeout = this.parseExpr();
        this.expectToken(',');
        var elapsed = this.parseLexpr(); // TODO: this has to go somewheres
        this.expectToken(',');
        return { command: 'INPUT', prompt: null, args: this.parseLexprList(), timeout: timeout, elapsed: elapsed };
    }
    // TODO: DATA statement doesn't read unquoted strings
    stmt__DATA() {
        return { command: 'DATA', datums: this.parseDatumList() };
    }
    stmt__READ() {
        return { command: 'READ', args: this.parseLexprList() };
    }
    stmt__RESTORE() {
        var label = null;
        if (this.opts.restoreWithLabel && !isEOS(this.peekToken()))
            label = this.parseLabel();
        return { command: 'RESTORE', label: label };
    }
    stmt__RETURN() {
        return { command: 'RETURN' };
    }
    stmt__STOP() {
        return { command: 'STOP' };
    }
    stmt__END() {
        if (this.opts.multilineIfThen && this.scopestack.length) {
            let endtok = this.expectTokens(['IF', 'SUB']);
            if (endtok.str == 'IF') {
                this.popIfThenScope();
                while (this.elseifcount--)
                    this.popIfThenScope(); // pop additional ELSE IF blocks?
                this.elseifcount = 0;
            }
            else if (endtok.str == 'SUB') {
                this.addStatement({ command: 'RETURN' }, endtok);
                this.popScope({ command: 'END' }, 'SUB'); // fake command to avoid null
            }
        }
        else {
            return { command: 'END' };
        }
    }
    stmt__ON() {
        var expr = this.parseExprWithType("number");
        var gotok = this.consumeToken();
        var cmd = { GOTO: 'ONGOTO', THEN: 'ONGOTO', GOSUB: 'ONGOSUB' }[gotok.str]; // THEN only for DEC basic?
        if (!cmd)
            this.compileError(`There should be a GOTO or GOSUB here.`);
        var labels = this.parseLabelList();
        return { command: cmd, expr: expr, labels: labels };
    }
    stmt__DEF() {
        var lexpr = this.parseVarSubscriptOrFunc(); // TODO: only allow parameter names, not exprs
        if (lexpr.args && lexpr.args.length > this.opts.maxDefArgs)
            this.compileError(`There can be no more than ${this.opts.maxDefArgs} arguments to a function or subscript.`, lexpr.$loc);
        if (!lexpr.name.startsWith('FN'))
            this.compileError(`Functions defined with DEF must begin with the letters "FN".`, lexpr.$loc);
        this.markVarDefs(lexpr); // local variables need to be marked as referenced (TODO: only for this scope)
        this.expectToken("=");
        var func = this.parseExpr();
        // build call graph to detect cycles
        this.visitExpr(func, (expr) => {
            if (isLookup(expr) && expr.name.startsWith('FN')) {
                if (!this.fnrefs[lexpr.name])
                    this.fnrefs[lexpr.name] = [];
                this.fnrefs[lexpr.name].push(expr.name);
            }
        });
        this.checkCallGraph(lexpr.name, new Set());
        return { command: 'DEF', lexpr: lexpr, def: func };
    }
    stmt__SUB() {
        var lexpr = this.parseVarSubscriptOrFunc(); // TODO: only allow parameter names, not exprs
        this.markVarDefs(lexpr); // local variables need to be marked as referenced (TODO: only for this scope)
        this.addLabel(lexpr.name, 1); // offset +1 to skip SUB command
        return { command: 'SUB', lexpr: lexpr };
    }
    stmt__CALL() {
        return { command: 'CALL', call: this.parseVarSubscriptOrFunc() };
    }
    markVarDefs(lexpr) {
        this.vardefs[lexpr.name] = lexpr;
        if (lexpr.args != null)
            for (let arg of lexpr.args) {
                if (isLookup(arg) && arg.args == null)
                    this.vardefs[arg.name] = arg;
                else
                    this.compileError(`A definition can only define symbols, not expressions.`);
            }
    }
    // detect cycles in call graph starting at function 'name'
    checkCallGraph(name, visited) {
        if (visited.has(name))
            this.compileError(`There was a cycle in the function definition graph for ${name}.`);
        visited.add(name);
        var refs = this.fnrefs[name] || [];
        for (var ref of refs)
            this.checkCallGraph(ref, visited); // recurse
        visited.delete(name);
    }
    stmt__POP() {
        return { command: 'POP' };
    }
    stmt__GET() {
        var lexpr = this.parseLexpr();
        return { command: 'GET', lexpr: lexpr };
    }
    stmt__CLEAR() {
        return { command: 'CLEAR' };
    }
    stmt__RANDOMIZE() {
        return { command: 'RANDOMIZE' };
    }
    stmt__CHANGE() {
        var src = this.parseExpr();
        this.expectToken('TO');
        var dest = this.parseLexpr();
        if (dest.valtype == src.valtype)
            this.compileError(`CHANGE can only convert strings to numeric arrays, or vice-versa.`, mergeLocs(src.$loc, dest.$loc));
        return { command: 'CHANGE', src: src, dest: dest };
    }
    stmt__CONVERT() {
        var src = this.parseExpr();
        this.expectToken('TO');
        var dest = this.parseLexpr();
        if (dest.valtype == src.valtype)
            this.compileError(`CONVERT can only convert strings to numbers, or vice-versa.`, mergeLocs(src.$loc, dest.$loc));
        return { command: 'CONVERT', src: src, dest: dest };
    }
    // TODO: CHANGE A TO A$ (4th edition, A(0) is len and A(1..) are chars)
    stmt__OPTION() {
        this.optionCount++;
        var tokname = this.consumeToken();
        var optname = tokname.str.toUpperCase();
        if (tokname.type != TokenType.Ident)
            this.compileError(`There must be a name after the OPTION statement.`);
        var tokarg = this.consumeToken();
        var arg = tokarg.str.toUpperCase();
        switch (optname) {
            case 'DIALECT':
                if (this.optionCount > 1)
                    this.compileError(`OPTION DIALECT must be the first OPTION statement in the file.`, tokname.$loc);
                let dname = arg || "";
                if (dname == "")
                    this.compileError(`OPTION DIALECT requires a dialect name.`, tokname.$loc);
                let dialect = exports.DIALECTS[dname.toUpperCase()];
                if (dialect)
                    this.opts = dialect;
                else
                    this.compileError(`${dname} is not a valid dialect.`);
                break;
            case 'BASE':
                let base = parseInt(arg);
                if (base == 0 || base == 1)
                    this.opts.defaultArrayBase = base;
                else
                    this.compileError("OPTION BASE can only be 0 or 1.");
                break;
            case 'CPUSPEED':
                if (!(this.opts.commandsPerSec = Math.min(1e7, arg == 'MAX' ? Infinity : parseFloat(arg))))
                    this.compileError(`OPTION CPUSPEED takes a positive number or MAX.`);
                break;
            default:
                // maybe it's one of the options?
                let propname = Object.getOwnPropertyNames(this.opts).find((n) => n.toUpperCase() == optname);
                if (propname == null)
                    this.compileError(`${optname} is not a valid option.`, tokname.$loc);
                if (arg == null)
                    this.compileError(`OPTION ${optname} requires a parameter.`);
                switch (typeof this.opts[propname]) {
                    case 'boolean':
                        this.opts[propname] = arg.toUpperCase().startsWith("T") || arg > 0;
                        return;
                    case 'number':
                        this.opts[propname] = parseFloat(arg);
                        return;
                    case 'string':
                        this.opts[propname] = arg;
                        return;
                    case 'object':
                        if (Array.isArray(this.opts[propname]) && arg == 'ALL') {
                            this.opts[propname] = null;
                            return;
                        }
                        this.compileError(`OPTION ${optname} ALL is the only option supported.`);
                }
                break;
        }
        return { command: 'OPTION', optname: optname, optargs: [arg] };
    }
    // for workermain
    generateListing(file, program) {
        var srclines = [];
        var laststmt;
        program.stmts.forEach((stmt, idx) => {
            laststmt = stmt;
            srclines.push(stmt.$loc);
        });
        if (this.opts.endStmtRequired && (laststmt == null || laststmt.command != 'END'))
            this.dialectError(`All programs must have a final END statement`);
        return { lines: srclines };
    }
    getListings() {
        return this.listings;
    }
    // LINT STUFF
    checkAll(program) {
        this.checkLabels();
        this.checkScopes();
        this.checkVarRefs();
    }
    checkLabels() {
        for (let targ in this.targets) {
            if (this.labels[targ] == null) {
                var what = this.opts.optionalLabels && isNaN(parseInt(targ)) ? "label named" : "line number";
                this.addError(`There isn't a ${what} ${targ}.`, this.targets[targ]);
            }
        }
    }
    checkScopes() {
        if (this.opts.compiledBlocks && this.scopestack.length) {
            var open = this.stmts[this.scopestack.pop()];
            var close = { FOR: "NEXT", WHILE: "WEND", IF: "END IF", SUB: "END SUB" };
            this.compileError(`Don't forget to add a matching ${close[open.command]} statement.`, open.$loc);
        }
    }
    checkVarRefs() {
        if (!this.opts.defaultValues) {
            for (var varname in this.varrefs) {
                if (this.vardefs[varname] == null)
                    this.compileError(`The variable ${varname} isn't defined anywhere in the program.`, this.varrefs[varname]);
            }
        }
    }
}
exports.BASICParser = BASICParser;
///// BASIC DIALECTS
exports.ECMA55_MINIMAL = {
    dialectName: "ECMA55",
    asciiOnly: true,
    uppercaseOnly: true,
    optionalLabels: false,
    optionalWhitespace: false,
    multipleStmtsPerLine: false,
    varNaming: "A1",
    staticArrays: true,
    sharedArrayNamespace: true,
    defaultArrayBase: 0,
    defaultArraySize: 11,
    defaultValues: false,
    stringConcat: false,
    maxDimensions: 2,
    maxDefArgs: 255,
    maxStringLength: 255,
    tickComments: false,
    hexOctalConsts: false,
    validKeywords: [
        'BASE', 'DATA', 'DEF', 'DIM', 'END',
        'FOR', 'GO', 'GOSUB', 'GOTO', 'IF', 'INPUT', 'LET', 'NEXT', 'ON', 'OPTION', 'PRINT',
        'RANDOMIZE', 'READ', 'REM', 'RESTORE', 'RETURN', 'STEP', 'STOP', 'THEN', 'TO' // 'SUB'
    ],
    validFunctions: [
        'ABS', 'ATN', 'COS', 'EXP', 'INT', 'LOG', 'RND', 'SGN', 'SIN', 'SQR', 'TAB', 'TAN'
    ],
    validOperators: [
        '=', '<>', '<', '>', '<=', '>=', '+', '-', '*', '/', '^'
    ],
    printZoneLength: 15,
    numericPadding: true,
    checkOverflow: true,
    testInitialFor: true,
    optionalNextVar: false,
    multipleNextVars: false,
    bitwiseLogic: false,
    checkOnGotoIndex: true,
    computedGoto: false,
    restoreWithLabel: false,
    squareBrackets: false,
    arraysContainChars: false,
    endStmtRequired: true,
    chainAssignments: false,
    optionalLet: false,
    compiledBlocks: true,
};
exports.DARTMOUTH_4TH_EDITION = {
    dialectName: "DARTMOUTH4",
    asciiOnly: true,
    uppercaseOnly: true,
    optionalLabels: false,
    optionalWhitespace: false,
    multipleStmtsPerLine: false,
    varNaming: "A1",
    staticArrays: true,
    sharedArrayNamespace: false,
    defaultArrayBase: 0,
    defaultArraySize: 11,
    defaultValues: false,
    stringConcat: false,
    maxDimensions: 2,
    maxDefArgs: 255,
    maxStringLength: 255,
    tickComments: true,
    hexOctalConsts: false,
    validKeywords: [
        'BASE', 'DATA', 'DEF', 'DIM', 'END',
        'FOR', 'GO', 'GOSUB', 'GOTO', 'IF', 'INPUT', 'LET', 'NEXT', 'ON', 'OPTION', 'PRINT',
        'RANDOMIZE', 'READ', 'REM', 'RESTORE', 'RETURN', 'STEP', 'STOP', 'THEN', 'TO',
        'CHANGE', 'MAT', 'RANDOM', 'RESTORE$', 'RESTORE*',
    ],
    validFunctions: [
        'ABS', 'ATN', 'COS', 'EXP', 'INT', 'LOG', 'RND', 'SGN', 'SIN', 'SQR', 'TAB', 'TAN',
        'TRN', 'INV', 'DET', 'NUM', 'ZER', // NUM = # of strings input for MAT INPUT
    ],
    validOperators: [
        '=', '<>', '<', '>', '<=', '>=', '+', '-', '*', '/', '^'
    ],
    printZoneLength: 15,
    numericPadding: true,
    checkOverflow: true,
    testInitialFor: true,
    optionalNextVar: false,
    multipleNextVars: false,
    bitwiseLogic: false,
    checkOnGotoIndex: true,
    computedGoto: false,
    restoreWithLabel: false,
    squareBrackets: false,
    arraysContainChars: false,
    endStmtRequired: true,
    chainAssignments: true,
    optionalLet: false,
    compiledBlocks: true,
};
// TODO: only integers supported
exports.TINY_BASIC = {
    dialectName: "TINY",
    asciiOnly: true,
    uppercaseOnly: true,
    optionalLabels: false,
    optionalWhitespace: false,
    multipleStmtsPerLine: false,
    varNaming: "A",
    staticArrays: false,
    sharedArrayNamespace: true,
    defaultArrayBase: 0,
    defaultArraySize: 0,
    defaultValues: true,
    stringConcat: false,
    maxDimensions: 0,
    maxDefArgs: 255,
    maxStringLength: 255,
    tickComments: false,
    hexOctalConsts: false,
    validKeywords: [
        'OPTION',
        'PRINT', 'IF', 'THEN', 'GOTO', 'INPUT', 'LET', 'GOSUB', 'RETURN', 'CLEAR', 'END'
    ],
    validFunctions: [],
    validOperators: [
        '=', '<>', '><', '<', '>', '<=', '>=', '+', '-', '*', '/',
    ],
    printZoneLength: 1,
    numericPadding: false,
    checkOverflow: false,
    testInitialFor: false,
    optionalNextVar: false,
    multipleNextVars: false,
    bitwiseLogic: false,
    checkOnGotoIndex: false,
    computedGoto: true,
    restoreWithLabel: false,
    squareBrackets: false,
    arraysContainChars: false,
    endStmtRequired: false,
    chainAssignments: false,
    optionalLet: false,
    compiledBlocks: false,
};
exports.HP_TIMESHARED_BASIC = {
    dialectName: "HP2000",
    asciiOnly: true,
    uppercaseOnly: true,
    optionalLabels: false,
    optionalWhitespace: false,
    multipleStmtsPerLine: true,
    varNaming: "A1$",
    staticArrays: true,
    sharedArrayNamespace: false,
    defaultArrayBase: 1,
    defaultArraySize: 11,
    defaultValues: false,
    stringConcat: false,
    maxDimensions: 2,
    maxDefArgs: 255,
    maxStringLength: 255,
    tickComments: false,
    hexOctalConsts: false,
    validKeywords: [
        'BASE', 'DATA', 'DEF', 'DIM', 'END',
        'FOR', 'GO', 'GOSUB', 'GOTO', 'IF', 'INPUT', 'LET', 'NEXT', 'OPTION', 'PRINT',
        'RANDOMIZE', 'READ', 'REM', 'RESTORE', 'RETURN', 'STEP', 'STOP', 'THEN', 'TO',
        'ENTER', 'MAT', 'CONVERT', 'OF', 'IMAGE', 'USING'
    ],
    validFunctions: [
        'ABS', 'ATN', 'BRK', 'COS', 'CTL', 'EXP', 'INT', 'LEN', 'LIN', 'LOG', 'NUM',
        'POS', 'RND', 'SGN', 'SIN', 'SPA', 'SQR', 'TAB', 'TAN', 'TIM', 'TYP', 'UPS$',
        'NFORMAT$', // non-standard, substitute for PRINT USING
    ],
    validOperators: [
        '=', '<>', '<', '>', '<=', '>=', '+', '-', '*', '/', '^',
        '**', '#', 'NOT', 'AND', 'OR', 'MIN', 'MAX',
    ],
    printZoneLength: 15,
    numericPadding: true,
    checkOverflow: false,
    testInitialFor: true,
    optionalNextVar: false,
    multipleNextVars: false,
    bitwiseLogic: false,
    checkOnGotoIndex: false,
    computedGoto: true,
    restoreWithLabel: true,
    squareBrackets: true,
    arraysContainChars: true,
    endStmtRequired: true,
    chainAssignments: true,
    optionalLet: true,
    compiledBlocks: true,
    maxArrayElements: 5000,
    // TODO: max line number
};
exports.DEC_BASIC_11 = {
    dialectName: "DEC11",
    asciiOnly: true,
    uppercaseOnly: true,
    optionalLabels: false,
    optionalWhitespace: false,
    multipleStmtsPerLine: false,
    varNaming: "A1",
    staticArrays: true,
    sharedArrayNamespace: false,
    defaultArrayBase: 0,
    defaultArraySize: 11,
    defaultValues: true,
    stringConcat: true,
    maxDimensions: 2,
    maxDefArgs: 255,
    maxStringLength: 255,
    tickComments: false,
    hexOctalConsts: false,
    validKeywords: [
        'OPTION',
        'DATA', 'DEF', 'DIM', 'END', 'FOR', 'STEP', 'GOSUB', 'GOTO', 'GO', 'TO',
        'IF', 'THEN', 'INPUT', 'LET', 'NEXT', 'ON', 'PRINT', 'RANDOMIZE',
        'READ', 'REM', 'RESET', 'RESTORE', 'RETURN', 'STOP',
    ],
    validFunctions: [
        'ABS', 'ATN', 'COS', 'EXP', 'INT', 'LOG', 'LOG10', 'PI', 'RND', 'SGN', 'SIN', 'SQR', 'TAB',
        'ASC', 'BIN', 'CHR$', 'CLK$', 'DAT$', 'LEN', 'OCT', 'POS', 'SEG$', 'STR$', 'TRM$', 'VAL',
        'NFORMAT$', // non-standard, substitute for PRINT USING
    ],
    validOperators: [
        '=', '<>', '><', '<', '>', '<=', '>=', '+', '-', '*', '/', '^',
    ],
    printZoneLength: 14,
    numericPadding: true,
    checkOverflow: true,
    testInitialFor: true,
    optionalNextVar: false,
    multipleNextVars: false,
    bitwiseLogic: false,
    checkOnGotoIndex: true,
    computedGoto: false,
    restoreWithLabel: false,
    squareBrackets: false,
    arraysContainChars: false,
    endStmtRequired: false,
    chainAssignments: false,
    optionalLet: true,
    compiledBlocks: true,
    // TODO: max line number 32767
    // TODO: \ separator, % int vars and constants, 'single' quoted
    // TODO: can't compare strings and numbers
};
exports.DEC_BASIC_PLUS = {
    dialectName: "DECPLUS",
    asciiOnly: true,
    uppercaseOnly: false,
    optionalLabels: false,
    optionalWhitespace: false,
    multipleStmtsPerLine: true,
    varNaming: "A1",
    staticArrays: true,
    sharedArrayNamespace: false,
    defaultArrayBase: 0,
    defaultArraySize: 11,
    defaultValues: true,
    stringConcat: true,
    maxDimensions: 2,
    maxDefArgs: 255,
    maxStringLength: 255,
    tickComments: true,
    hexOctalConsts: false,
    validKeywords: [
        'OPTION',
        'REM', 'LET', 'DIM', 'RANDOM', 'RANDOMIZE', 'IF', 'THEN', 'ELSE',
        'FOR', 'TO', 'STEP', 'WHILE', 'UNTIL', 'NEXT', 'DEF', 'ON', 'GOTO', 'GOSUB',
        'RETURN', 'CHANGE', 'READ', 'DATA', 'RESTORE', 'PRINT', 'USING',
        'INPUT', 'LINE', 'NAME', 'AS', 'ERROR', 'RESUME', 'CHAIN', 'STOP', 'END',
        'MAT', 'UNLESS', 'SLEEP', 'WAIT',
    ],
    validFunctions: [
        'ABS', 'ATN', 'COS', 'EXP', 'INT', 'LOG', 'LOG10', 'PI', 'RND', 'SGN', 'SIN', 'SQR', 'TAB', 'TAN',
        'POS', 'TAB', 'ASCII', 'CHR$', 'CVT%$', 'CVTF$', 'CVT$%', 'CVT$F',
        'LEFT$', 'RIGHT$', 'MID$', 'LEN', 'INSTR', 'SPACE$', 'NUM$', 'VAL', 'XLATE',
        'DATE$', 'TIME$', 'TIME', 'ERR', 'ERL', 'SWAP%', 'RAD$',
        'NFORMAT$', // non-standard, substitute for PRINT USING
    ],
    validOperators: [
        '=', '<>', '<', '>', '<=', '>=', '+', '-', '*', '/', '^',
        '**', '==',
        'NOT', 'AND', 'OR', 'XOR', 'IMP', 'EQV',
    ],
    printZoneLength: 14,
    numericPadding: true,
    checkOverflow: true,
    testInitialFor: true,
    optionalNextVar: false,
    multipleNextVars: false,
    bitwiseLogic: false,
    checkOnGotoIndex: true,
    computedGoto: false,
    restoreWithLabel: false,
    squareBrackets: false,
    arraysContainChars: false,
    endStmtRequired: false,
    chainAssignments: false,
    optionalLet: true,
    compiledBlocks: true,
    // TODO: max line number 32767
    // TODO: \ separator, % int vars and constants, 'single' quoted
    // TODO: can't compare strings and numbers
    // TODO: WHILE/UNTIL/FOR extra statements, etc
};
exports.BASICODE = {
    dialectName: "BASICODE",
    asciiOnly: true,
    uppercaseOnly: false,
    optionalLabels: false,
    optionalWhitespace: true,
    multipleStmtsPerLine: true,
    varNaming: "AA",
    staticArrays: true,
    sharedArrayNamespace: false,
    defaultArrayBase: 0,
    defaultArraySize: 11,
    defaultValues: false,
    stringConcat: true,
    maxDimensions: 2,
    maxDefArgs: 255,
    maxStringLength: 255,
    tickComments: false,
    hexOctalConsts: false,
    validKeywords: [
        'BASE', 'DATA', 'DEF', 'DIM', 'END',
        'FOR', 'GO', 'GOSUB', 'GOTO', 'IF', 'INPUT', 'LET', 'NEXT', 'ON', 'OPTION', 'PRINT',
        'READ', 'REM', 'RESTORE', 'RETURN', 'STEP', 'STOP', 'THEN', 'TO',
        'AND', 'NOT', 'OR'
    ],
    validFunctions: [
        'ABS', 'ASC', 'ATN', 'CHR$', 'COS', 'EXP', 'INT', 'LEFT$', 'LEN', 'LOG',
        'MID$', 'RIGHT$', 'SGN', 'SIN', 'SQR', 'TAB', 'TAN', 'VAL'
    ],
    validOperators: [
        '=', '<>', '<', '>', '<=', '>=', '+', '-', '*', '/', '^', 'AND', 'NOT', 'OR'
    ],
    printZoneLength: 15,
    numericPadding: true,
    checkOverflow: true,
    testInitialFor: true,
    optionalNextVar: false,
    multipleNextVars: false,
    bitwiseLogic: false,
    checkOnGotoIndex: true,
    computedGoto: false,
    restoreWithLabel: false,
    squareBrackets: false,
    arraysContainChars: false,
    endStmtRequired: false,
    chainAssignments: false,
    optionalLet: true,
    compiledBlocks: false,
};
exports.ALTAIR_BASIC41 = {
    dialectName: "ALTAIR41",
    asciiOnly: true,
    uppercaseOnly: true,
    optionalLabels: false,
    optionalWhitespace: true,
    multipleStmtsPerLine: true,
    varNaming: "*",
    staticArrays: false,
    sharedArrayNamespace: true,
    defaultArrayBase: 0,
    defaultArraySize: 11,
    defaultValues: true,
    stringConcat: true,
    maxDimensions: 128,
    maxDefArgs: 255,
    maxStringLength: 255,
    tickComments: false,
    hexOctalConsts: false,
    validKeywords: [
        'OPTION',
        'CONSOLE', 'DATA', 'DEF', 'DEFUSR', 'DIM', 'END', 'ERASE', 'ERROR',
        'FOR', 'GOTO', 'GOSUB', 'IF', 'THEN', 'ELSE', 'INPUT', 'LET', 'LINE',
        'PRINT', 'LPRINT', 'USING', 'NEXT', 'ON', 'OUT', 'POKE',
        'READ', 'REM', 'RESTORE', 'RESUME', 'RETURN', 'STOP', 'SWAP',
        'TROFF', 'TRON', 'WAIT',
        'TO', 'STEP',
        'AND', 'NOT', 'OR', 'XOR', 'IMP', 'EQV', 'MOD',
        'RANDOMIZE' // not in Altair BASIC, but we add it anyway
    ],
    validFunctions: [
        'ABS', 'ASC', 'ATN', 'CDBL', 'CHR$', 'CINT', 'COS', 'ERL', 'ERR',
        'EXP', 'FIX', 'FRE', 'HEX$', 'INP', 'INSTR', 'INT',
        'LEFT$', 'LEN', 'LOG', 'LPOS', 'MID$',
        'OCT$', 'POS', 'RIGHT$', 'RND', 'SGN', 'SIN', 'SPACE$', 'SPC',
        'SQR', 'STR$', 'STRING$', 'TAB', 'TAN', 'USR', 'VAL', 'VARPTR'
    ],
    validOperators: [
        '=', '<>', '<', '>', '<=', '>=', '+', '-', '*', '/', '^', '\\',
        'AND', 'NOT', 'OR', 'XOR', 'IMP', 'EQV', 'MOD'
    ],
    printZoneLength: 15,
    numericPadding: true,
    checkOverflow: true,
    testInitialFor: false,
    optionalNextVar: true,
    multipleNextVars: true,
    bitwiseLogic: true,
    checkOnGotoIndex: false,
    computedGoto: false,
    restoreWithLabel: false,
    squareBrackets: false,
    arraysContainChars: false,
    endStmtRequired: false,
    chainAssignments: false,
    optionalLet: true,
    compiledBlocks: false,
};
exports.APPLESOFT_BASIC = {
    dialectName: "APPLESOFT",
    asciiOnly: true,
    uppercaseOnly: false,
    optionalLabels: false,
    optionalWhitespace: true,
    multipleStmtsPerLine: true,
    varNaming: "*",
    staticArrays: false,
    sharedArrayNamespace: false,
    defaultArrayBase: 0,
    defaultArraySize: 11,
    defaultValues: true,
    stringConcat: true,
    maxDimensions: 88,
    maxDefArgs: 1,
    maxStringLength: 255,
    tickComments: false,
    hexOctalConsts: false,
    validKeywords: [
        'OPTION',
        'CLEAR', 'LET', 'DIM', 'DEF', 'GOTO', 'GOSUB', 'RETURN', 'ON', 'POP',
        'FOR', 'NEXT', 'IF', 'THEN', 'END', 'STOP', 'ONERR', 'RESUME',
        'PRINT', 'INPUT', 'GET', 'HOME', 'HTAB', 'VTAB',
        'INVERSE', 'FLASH', 'NORMAL', 'TEXT',
        'GR', 'COLOR', 'PLOT', 'HLIN', 'VLIN',
        'HGR', 'HGR2', 'HPLOT', 'HCOLOR', 'AT',
        'DATA', 'READ', 'RESTORE',
        'REM', 'TRACE', 'NOTRACE',
        'TO', 'STEP',
        'AND', 'NOT', 'OR'
    ],
    validFunctions: [
        'ABS', 'ATN', 'COS', 'EXP', 'INT', 'LOG', 'RND', 'SGN', 'SIN', 'SQR', 'TAN',
        'LEN', 'LEFT$', 'MID$', 'RIGHT$', 'STR$', 'VAL', 'CHR$', 'ASC',
        'FRE', 'SCRN', 'PDL', 'PEEK', 'POS'
    ],
    validOperators: [
        '=', '<>', '<', '>', '<=', '>=', '+', '-', '*', '/', '^',
        'AND', 'NOT', 'OR'
    ],
    printZoneLength: 16,
    numericPadding: false,
    checkOverflow: true,
    testInitialFor: false,
    optionalNextVar: true,
    multipleNextVars: true,
    bitwiseLogic: false,
    checkOnGotoIndex: false,
    computedGoto: false,
    restoreWithLabel: false,
    squareBrackets: false,
    arraysContainChars: false,
    endStmtRequired: false,
    chainAssignments: false,
    optionalLet: true,
    compiledBlocks: false,
};
exports.BASIC80 = {
    dialectName: "BASIC80",
    asciiOnly: true,
    uppercaseOnly: false,
    optionalLabels: false,
    optionalWhitespace: true,
    multipleStmtsPerLine: true,
    varNaming: "*",
    staticArrays: false,
    sharedArrayNamespace: true,
    defaultArrayBase: 0,
    defaultArraySize: 11,
    defaultValues: true,
    stringConcat: true,
    maxDimensions: 255,
    maxDefArgs: 255,
    maxStringLength: 255,
    //maxElements : 32767, // TODO
    tickComments: true,
    hexOctalConsts: true,
    validKeywords: [
        'OPTION',
        'CONSOLE', 'DATA', 'DEF', 'DEFUSR', 'DIM', 'END', 'ERASE', 'ERROR',
        'FOR', 'GOTO', 'GOSUB', 'IF', 'THEN', 'ELSE', 'INPUT', 'LET', 'LINE',
        'PRINT', 'LPRINT', 'USING', 'NEXT', 'ON', 'OUT', 'POKE',
        'READ', 'REM', 'RESTORE', 'RESUME', 'RETURN', 'STOP', 'SWAP',
        'TROFF', 'TRON', 'WAIT',
        'CALL', 'CHAIN', 'COMMON', 'WHILE', 'WEND', 'WRITE', 'RANDOMIZE',
        'TO', 'STEP',
        'AND', 'NOT', 'OR', 'XOR', 'IMP', 'EQV', 'MOD'
    ],
    validFunctions: [
        'ABS', 'ASC', 'ATN', 'CDBL', 'CHR$', 'CINT', 'COS', 'CSNG', 'CVI', 'CVS', 'CVD',
        'EOF', 'EXP', 'FIX', 'FRE', 'HEX$', 'INP', 'INPUT$', 'INSTR', 'INT',
        'LEFT$', 'LEN', 'LOC', 'LOG', 'LPOS', 'MID$', 'MKI$', 'MKS$', 'MKD$',
        'OCT$', 'PEEK', 'POS', 'RIGHT$', 'RND', 'SGN', 'SIN', 'SPACE$', 'SPC',
        'SQR', 'STR$', 'STRING$', 'TAB', 'TAN', 'USR', 'VAL', 'VARPTR'
    ],
    validOperators: [
        '=', '<>', '<', '>', '<=', '>=', '+', '-', '*', '/', '^', '\\',
        'AND', 'NOT', 'OR', 'XOR', 'IMP', 'EQV', 'MOD'
    ],
    printZoneLength: 14,
    numericPadding: true,
    checkOverflow: false,
    testInitialFor: true,
    optionalNextVar: true,
    multipleNextVars: true,
    bitwiseLogic: true,
    checkOnGotoIndex: false,
    computedGoto: false,
    restoreWithLabel: true,
    squareBrackets: false,
    arraysContainChars: false,
    endStmtRequired: false,
    chainAssignments: false,
    optionalLet: true,
    compiledBlocks: false,
};
exports.MODERN_BASIC = {
    dialectName: "MODERN",
    asciiOnly: false,
    uppercaseOnly: false,
    optionalLabels: true,
    optionalWhitespace: false,
    multipleStmtsPerLine: true,
    varNaming: "*",
    staticArrays: false,
    sharedArrayNamespace: false,
    defaultArrayBase: 0,
    defaultArraySize: 0,
    defaultValues: false,
    stringConcat: true,
    maxDimensions: 255,
    maxDefArgs: 255,
    maxStringLength: 2048,
    tickComments: true,
    hexOctalConsts: true,
    validKeywords: null,
    validFunctions: null,
    validOperators: null,
    printZoneLength: 16,
    numericPadding: false,
    checkOverflow: true,
    testInitialFor: true,
    optionalNextVar: true,
    multipleNextVars: true,
    bitwiseLogic: true,
    checkOnGotoIndex: true,
    computedGoto: false,
    restoreWithLabel: true,
    squareBrackets: true,
    arraysContainChars: false,
    endStmtRequired: false,
    chainAssignments: true,
    optionalLet: true,
    compiledBlocks: true,
    multilineIfThen: true,
};
const BUILTIN_DEFS = [
    ['ABS', ['number'], 'number'],
    ['ASC', ['string'], 'number'],
    ['ATN', ['number'], 'number'],
    ['CHR$', ['number'], 'string'],
    ['CINT', ['number'], 'number'],
    ['COS', ['number'], 'number'],
    ['COT', ['number'], 'number'],
    ['CTL', ['number'], 'string'],
    ['EXP', ['number'], 'number'],
    ['FIX', ['number'], 'number'],
    ['HEX$', ['number'], 'string'],
    ['INSTR', ['number', 'string', 'string'], 'number'],
    ['INSTR', ['string', 'string'], 'number'],
    ['INT', ['number'], 'number'],
    ['LEFT$', ['string', 'number'], 'string'],
    ['LEN', ['string'], 'number'],
    ['LIN', ['number'], 'string'],
    ['LOG', ['number'], 'number'],
    ['LOG10', ['number'], 'number'],
    ['MID$', ['string', 'number'], 'string'],
    ['MID$', ['string', 'number', 'number'], 'string'],
    ['OCT$', ['number'], 'string'],
    ['PI', [], 'number'],
    ['POS', ['number'], 'number'],
    ['POS', ['string', 'string'], 'number'],
    ['RIGHT$', ['string', 'number'], 'string'],
    ['RND', [], 'number'],
    ['RND', ['number'], 'number'],
    ['ROUND', ['number'], 'number'],
    ['SGN', ['number'], 'number'],
    ['SIN', ['number'], 'number'],
    ['SPACE$', ['number'], 'string'],
    ['SPC', ['number'], 'string'],
    ['SQR', ['number'], 'number'],
    ['STR$', ['number'], 'string'],
    ['STRING$', ['number', 'number'], 'string'],
    ['STRING$', ['number', 'string'], 'string'],
    ['TAB', ['number'], 'string'],
    ['TAN', ['number'], 'number'],
    ['TIM', ['number'], 'number'],
    ['TIMER', [], 'number'],
    ['UPS$', ['string'], 'string'],
    ['VAL', ['string'], 'number'],
    ['LPAD$', ['string', 'number'], 'string'],
    ['RPAD$', ['string', 'number'], 'string'],
    ['NFORMAT$', ['number', 'number'], 'string'],
];
var BUILTIN_MAP = {};
BUILTIN_DEFS.forEach((def, idx) => {
    let [name, args, result] = def;
    if (!BUILTIN_MAP[name])
        BUILTIN_MAP[name] = [];
    BUILTIN_MAP[name].push({ args: args, result: result });
});
exports.DIALECTS = {
    "DEFAULT": exports.MODERN_BASIC,
    "DARTMOUTH": exports.DARTMOUTH_4TH_EDITION,
    "DARTMOUTH4": exports.DARTMOUTH_4TH_EDITION,
    "ALTAIR": exports.ALTAIR_BASIC41,
    "ALTAIR4": exports.ALTAIR_BASIC41,
    "ALTAIR41": exports.ALTAIR_BASIC41,
    "TINY": exports.TINY_BASIC,
    "ECMA55": exports.ECMA55_MINIMAL,
    "MINIMAL": exports.ECMA55_MINIMAL,
    "HP": exports.HP_TIMESHARED_BASIC,
    "HPB": exports.HP_TIMESHARED_BASIC,
    "HPTSB": exports.HP_TIMESHARED_BASIC,
    "HP2000": exports.HP_TIMESHARED_BASIC,
    "HPBASIC": exports.HP_TIMESHARED_BASIC,
    "HPACCESS": exports.HP_TIMESHARED_BASIC,
    "DEC11": exports.DEC_BASIC_11,
    "DEC": exports.DEC_BASIC_PLUS,
    "DECPLUS": exports.DEC_BASIC_PLUS,
    "BASICPLUS": exports.DEC_BASIC_PLUS,
    "BASICODE": exports.BASICODE,
    "APPLESOFT": exports.APPLESOFT_BASIC,
    "BASIC80": exports.BASIC80,
    "MODERN": exports.MODERN_BASIC,
};
//# sourceMappingURL=compiler.js.map