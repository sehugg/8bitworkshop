import { WorkerError, CodeListingMap, SourceLocation, SourceLine } from "../workertypes";

export interface BASICOptions {
    dialectName : string;               // use this to select the dialect 
    // SYNTAX AND PARSING
    asciiOnly : boolean;                // reject non-ASCII chars?
    uppercaseOnly : boolean;            // convert everything to uppercase?
    optionalLabels : boolean;			// can omit line numbers and use labels?
    optionalWhitespace : boolean;       // can "crunch" keywords?
    varNaming : 'A'|'A1'|'AA'|'*';          // only allow A0-9 for numerics, single letter for arrays/strings
    squareBrackets : boolean;           // "[" and "]" interchangable with "(" and ")"?
    tickComments : boolean;             // support 'comments?
    hexOctalConsts : boolean;           // support &H and &O integer constants?
    validKeywords : string[];           // valid keywords (or null for accept all)
    validFunctions : string[];          // valid functions (or null for accept all)
    validOperators : string[];          // valid operators (or null for accept all)
    // VALUES AND OPERATORS
    defaultValues : boolean;            // initialize unset variables to default value? (0 or "")
    stringConcat : boolean;             // can concat strings with "+" operator?
    typeConvert : boolean;              // type convert strings <-> numbers?
    checkOverflow : boolean;            // check for overflow of numerics?
    bitwiseLogic : boolean;             // -1 = TRUE, 0 = FALSE, AND/OR/NOT done with bitwise ops
    maxStringLength : number;           // maximum string length in chars
    maxDefArgs : number;                // maximum # of arguments for user-defined functions
    // ARRAYS
    staticArrays : boolean;             // can only DIM with constant value? (and never redim)
    sharedArrayNamespace : boolean;     // arrays and variables have same namespace? (TODO)
    defaultArrayBase : number;          // arrays start at this number (0 or 1)
    defaultArraySize : number;          // arrays are allocated w/ this size (starting @ 0)
    maxDimensions : number;             // max number of dimensions for arrays
    arraysContainChars : boolean;       // HP BASIC array-slicing syntax
    // PRINTING
    printZoneLength : number;           // print zone length
    numericPadding : boolean;           // " " or "-" before and " " after numbers?
    // CONTROL FLOW
    testInitialFor : boolean;           // can we skip a NEXT statement? (can't interleave tho)
    optionalNextVar : boolean;          // can do NEXT without variable
    multipleNextVars : boolean;         // NEXT J,I
    checkOnGotoIndex : boolean;         // fatal error when ON..GOTO index out of bounds
    computedGoto : boolean;             // non-const expr GOTO label (and GOTO..OF expression)
    restoreWithLabel : boolean;         // RESTORE <label>
    endStmtRequired : boolean;          // need END at end?
    // MISC
    commandsPerSec? : number;           // how many commands per second?
}

export interface SourceLocated {
    $loc?: SourceLine;
}

export class CompileError extends Error {
    $loc : SourceLocation;
    constructor(msg: string, loc: SourceLocation) {
        super(msg);
        Object.setPrototypeOf(this, CompileError.prototype);
        this.$loc = loc;
    }
}

// Lexer regular expression -- each (capture group) handles a different token type
//                FLOAT                             INT       HEXOCTAL         REMARK   IDENT      STRING  RELOP        EXP    OPERATORS             OTHER  WS
const re_toks = /([0-9.]+[E][+-]?\d+|\d+[.][E0-9]*|[.][E0-9]+)|[0]*(\d+)|&([OH][0-9A-F]+)|(['].*)|(\w+[$]?)|(".*?")|([<>]?[=<>#])|(\*\*)|([-+*/^,;:()\[\]?\\])|(\S+)|(\s+)/gi;

export enum TokenType {
    EOL = 0,
    Float,
    Int,
    HexOctalInt,
    Remark,
    Ident,
    String,
    Relational,
    DoubleStar,
    Operator,
    CatchAll,
    Whitespace,
    _LAST,
}

export type ExprTypes = BinOp | UnOp | IndOp | Literal;

export type Expr = ExprTypes; // & SourceLocated;

export type Opcode = string;

export type Value = string | number;

export interface Literal {
    value: Value;
}

export interface BinOp {
    op: Opcode;
    left: Expr;
    right: Expr;
}

export interface UnOp {
    op: 'neg' | 'lnot' | 'bnot';
    expr: Expr;
}

export interface IndOp {
    name: string;
    args: Expr[];
}

export interface PRINT_Statement {
    command: "PRINT";
    args: Expr[];
}

export interface LET_Statement {
    command: "LET";
    lexpr: IndOp;
    right: Expr;
}

export interface DIM_Statement {
    command: "DIM";
    args: IndOp[];
}

export interface GOTO_Statement {
    command: "GOTO";
    label: Expr;
}

export interface GOSUB_Statement {
    command: "GOSUB";
    label: Expr;
}

export interface RETURN_Statement {
    command: "RETURN";
}

export interface ONGO_Statement {
    command: "ONGOTO" | "ONGOSUB";
    expr: Expr;
    labels: Expr[];
}

export interface IF_Statement {
    command: "IF";
    cond: Expr;
}

export interface ELSE_Statement {
    command: "ELSE";
}

export interface FOR_Statement {
    command: "FOR";
    lexpr: IndOp;
    initial: Expr;
    target: Expr;
    step?: Expr;
}

export interface NEXT_Statement {
    command: "NEXT";
    lexpr?: IndOp;
}

export interface WHILE_Statement {
    command: "WHILE";
    cond: Expr;
}

export interface WEND_Statement {
    command: "WEND";
}

export interface INPUT_Statement {
    command: "INPUT";
    prompt: Expr;
    args: IndOp[];
}

export interface DATA_Statement {
    command: "DATA";
    datums: Literal[];
}

export interface READ_Statement {
    command: "READ";
    args: IndOp[];
}

export interface RESTORE_Statement {
    command: "RESTORE";
    label: Expr;
}

export interface DEF_Statement {
    command: "DEF";
    lexpr: IndOp;
    def: Expr;
}

export interface OPTION_Statement {
    command: "OPTION";
    optname: string;
    optargs: string[];
}

export interface GET_Statement { // applesoft only?
    command: "GET";
    lexpr: IndOp;
}

export interface NoArgStatement {
    command: string;
}

export type StatementTypes = PRINT_Statement | LET_Statement | GOTO_Statement | GOSUB_Statement
    | IF_Statement | FOR_Statement | NEXT_Statement | DIM_Statement
    | INPUT_Statement | READ_Statement | DEF_Statement | ONGO_Statement
    | DATA_Statement | OPTION_Statement | GET_Statement | RESTORE_Statement
    | NoArgStatement;

export type Statement = StatementTypes & SourceLocated;

export interface BASICLine {
    label: string;
    stmts: Statement[];
}

export interface BASICProgram {
    opts: BASICOptions;
    lines: BASICLine[];
}

class Token {
    str: string;
    type: TokenType;
    $loc: SourceLocation;
}

const OPERATORS = {
    'IMP':  {f:'bimp',p:4},
    'EQV':  {f:'beqv',p:5},
    'XOR':  {f:'bxor',p:6},
    'OR':   {f:'bor',p:7}, // or "lor" for logical
    'AND':  {f:'band',p:8}, // or "land" for logical
    '||':   {f:'lor',p:17}, // not used
    '&&':   {f:'land',p:18}, // not used
    '=':    {f:'eq',p:50},
    //'==':   {f:'eq',p:50},
    '<>':   {f:'ne',p:50},
    '><':   {f:'ne',p:50},
    //'!=':   {f:'ne',p:50},
    '#':    {f:'ne',p:50},
    '<':    {f:'lt',p:50},
    '>':    {f:'gt',p:50},
    '<=':   {f:'le',p:50},
    '>=':   {f:'ge',p:50},
    'MIN':  {f:'min',p:75},
    'MAX':  {f:'max',p:75},
    '+':    {f:'add',p:100},
    '-':    {f:'sub',p:100},
    '%':    {f:'mod',p:140},
    '\\':   {f:'idiv',p:150},
    '*':    {f:'mul',p:200},
    '/':    {f:'div',p:200},
    '^':    {f:'pow',p:300},
    '**':   {f:'pow',p:300},
};

function getOperator(op: string) {
    return OPERATORS[op];
}

function getPrecedence(tok: Token): number {
    switch (tok.type) {
        case TokenType.Operator:
        case TokenType.DoubleStar:
        case TokenType.Relational:
        case TokenType.Ident:
            let op = getOperator(tok.str);
            if (op) return op.p;
    }
    return -1;
}

// is token an end of statement marker? (":" or end of line)
function isEOS(tok: Token) {
    return tok.type == TokenType.EOL || tok.type == TokenType.Remark
        || tok.str == ':' || tok.str == 'ELSE'; // TODO: only ELSE if ifElse==true
}

function stripQuotes(s: string) {
    // TODO: assert
    return s.substr(1, s.length-2);
}

///// BASIC PARSER

export class BASICParser {
    opts : BASICOptions = DIALECTS['DEFAULT'];
    errors: WorkerError[];
    listings: CodeListingMap;
    labels: { [label: string]: BASICLine };
    targets: { [targetlabel: string]: SourceLocation };
    refs: { [name: string]: SourceLocation }; // references

    path : string;
    lineno : number;
    tokens: Token[];
    eol: Token;
    curlabel: string;
    lasttoken: Token;

    constructor() {
        this.labels = {};
        this.targets = {};
        this.errors = [];
        this.lineno = 0;
        this.curlabel = null;
        this.listings = {};
        this.refs = {};
    }
    addError(msg: string, loc?: SourceLocation) {
        if (!loc) loc = this.peekToken().$loc;
        this.errors.push({path:loc.path, line:loc.line, label:this.curlabel, start:loc.start, end:loc.end, msg:msg});
    }
    compileError(msg: string, loc?: SourceLocation) {
        this.addError(msg, loc);
        throw new CompileError(msg, loc);
    }
    dialectError(what: string, loc?: SourceLocation) {
        this.compileError(`The selected BASIC dialect (${this.opts.dialectName}) doesn't support ${what}.`, loc); // TODO
    }
    consumeToken(): Token {
        var tok = this.lasttoken = (this.tokens.shift() || this.eol);
        return tok;
    }
    expectToken(str: string, msg?: string) : Token {
        var tok = this.consumeToken();
        var tokstr = tok.str;
        if (str != tokstr) {
            this.compileError(msg || `There should be a "${str}" here.`);
        }
        return tok;
    }
    expectTokens(strlist: string[], msg?: string) : Token {
        var tok = this.consumeToken();
        var tokstr = tok.str;
        if (strlist.indexOf(tokstr) < 0) {
            this.compileError(msg || `There should be a ${strlist.map((s) => `"${s}"`).join(' or ')} here.`);
        }
        return tok;
    }
    peekToken(): Token {
        var tok = this.tokens[0];
        return tok ? tok : this.eol;
    }
    pushbackToken(tok: Token) {
        this.tokens.unshift(tok);
    }
    parseOptLabel(line: BASICLine) {
        let tok = this.consumeToken();
        switch (tok.type) {
            case TokenType.Ident:
                if (this.opts.optionalLabels) {
                    if (this.peekToken().str == ':') { // is it a label:
                        this.consumeToken(); // eat the ":"
                        // fall through to the next case
                    } else {
                        this.pushbackToken(tok); // nope
                        break;
                    }
                } else this.dialectError(`optional line numbers`);
            case TokenType.Int:
                if (this.labels[tok.str] != null) this.compileError(`There's a duplicated label "${tok.str}".`);
                this.labels[tok.str] = line;
                line.label = tok.str;
                this.curlabel = tok.str;
                break;
            case TokenType.HexOctalInt:
            case TokenType.Float:
                this.compileError(`Line numbers must be positive integers.`);
                break;
            default:
                if (this.opts.optionalLabels) this.compileError(`A line must start with a line number, command, or label.`);
                else this.compileError(`A line must start with a line number.`);
                break;
        }
    }
    parseFile(file: string, path: string) : BASICProgram {
        this.path = path;
        var txtlines = file.split(/\n|\r\n/);
        var pgmlines = txtlines.map((line) => this.parseLine(line));
        var program = { opts: this.opts, lines: pgmlines };
        this.checkAll(program);
        this.listings[path] = this.generateListing(file, program);
        return program;
    }
    parseLine(line: string) : BASICLine {
        try {
            this.tokenize(line);
            return this.parse();
        } catch (e) {
            if (!(e instanceof CompileError)) throw e; // ignore compile errors since errors[] list captures them
            return {label:null, stmts:[]};
        }
    }
    tokenize(line: string) : void {
        this.lineno++;
        this.tokens = [];
        // split identifier regex (if token-crunching enabled)
        let splitre = this.opts.optionalWhitespace && new RegExp('('+this.opts.validKeywords.map(s => `${s}`).join('|')+')');
        // iterate over each token via re_toks regex
        var lastTokType = TokenType.CatchAll;
        var m : RegExpMatchArray;
        while (m = re_toks.exec(line)) {
            for (var i = 1; i <= lastTokType; i++) {
                let s : string = m[i];
                if (s != null) {
                    let loc = { path: this.path, line: this.lineno, start: m.index, end: m.index+s.length, label: this.curlabel };
                    // maybe we don't support unicode in 1975?
                    if (this.opts.asciiOnly && !/^[\x00-\x7F]*$/.test(s))
                        this.dialectError(`non-ASCII characters`);
                    // uppercase all identifiers, and maybe more
                    if (i == TokenType.Ident || i == TokenType.HexOctalInt || this.opts.uppercaseOnly) {
                        s = s.toUpperCase();
                        // DATA statement captures whitespace too
                        if (s == 'DATA') lastTokType = TokenType.Whitespace;
                        // REM means ignore rest of statement
                        if (lastTokType == TokenType.CatchAll && s.startsWith('REM')) {
                            s = 'REM';
                            lastTokType = TokenType.EOL;
                        }
                    }
                    // convert brackets
                    if (s == '[' || s == ']') {
                        if (!this.opts.squareBrackets) this.dialectError(`square brackets`);
                        if (s == '[') s = '(';
                        if (s == ']') s = ')';
                    }
                    // un-crunch tokens?
                    if (splitre && i == TokenType.Ident) {
                        var splittoks = s.split(splitre);
                        splittoks.forEach((ss) => {
                            if (ss != '') {
                                // leftover might be integer
                                i = /^[0-9]+$/.test(ss) ? TokenType.Int : TokenType.Ident;
                                // disable crunching after this token?
                                if (ss == 'DATA' || ss == 'OPTION')
                                    splitre = null;
                                this.tokens.push({str: ss, type: i, $loc:loc});
                            }
                        });
                    } else {
                        // add token to list
                        this.tokens.push({str: s, type: i, $loc:loc});
                    }
                    break;
                }
            }
        }
        this.eol = { type: TokenType.EOL, str: "", $loc: { path: this.path, line: this.lineno, start: line.length, label: this.curlabel } };
    }
    parse() : BASICLine {
        var line = {label: null, stmts: []};
        // not empty line?
        if (this.tokens.length) {
            this.parseOptLabel(line);
            if (this.tokens.length) {
                line.stmts = this.parseCompoundStatement();
            }
            this.curlabel = null;
        }
        return line;
    }
    parseCompoundStatement(): Statement[] {
        var list = this.parseList(this.parseStatement, ':');
        var next = this.peekToken();
        if (!isEOS(next))
            this.compileError(`Expected end of line or ':'`, next.$loc);
        if (next.str == 'ELSE')
            return list.concat(this.parseCompoundStatement());
        else
            return list;
    }
    validKeyword(keyword: string) : string {
        return (this.opts.validKeywords && this.opts.validKeywords.indexOf(keyword) < 0) ? null : keyword;
    }
    parseStatement(): Statement | null {
        var cmdtok = this.consumeToken();
        var cmd = cmdtok.str;
        var stmt;
        switch (cmdtok.type) {
            case TokenType.Remark:
                if (cmdtok.str.startsWith("'") && !this.opts.tickComments) this.dialectError(`tick remarks`);
                return null;
            case TokenType.Operator:
                if (cmd == this.validKeyword('?')) cmd = 'PRINT';
            case TokenType.Ident:
                // ignore remarks
                if (cmd == 'REM') return null;
                // look for "GO TO" and "GO SUB"
                if (cmd == 'GO' && this.peekToken().str == 'TO') {
                    this.consumeToken();
                    cmd = 'GOTO';
                } else if (cmd == 'GO' && this.peekToken().str == 'SUB') {
                    this.consumeToken();
                    cmd = 'GOSUB';
                }
                // lookup JS function for command
                var fn = this['stmt__' + cmd];
                if (fn) {
                    if (this.validKeyword(cmd) == null)
                        this.dialectError(`the ${cmd} keyword`);
                    stmt = fn.bind(this)() as Statement;
                    break;
                } else if (this.peekToken().str == '=' || this.peekToken().str == '(') {
                    // 'A = expr' or 'A(X) = expr'
                    this.pushbackToken(cmdtok);
                    stmt = this.stmt__LET();
                    break;
                }
            case TokenType.EOL:
            default:
                this.compileError(`There should be a command here.`);
                return null;
        }
        if (stmt) stmt.$loc = { path: cmdtok.$loc.path, line: cmdtok.$loc.line, start: cmdtok.$loc.start, end: this.peekToken().$loc.start, label: this.curlabel };
        return stmt;
    }
    parseVarSubscriptOrFunc(): IndOp {
        var tok = this.consumeToken();
        switch (tok.type) {
            case TokenType.Ident:
                this.refs[tok.str] = tok.$loc;
                let args = null;
                if (this.peekToken().str == '(') {
                    this.expectToken('(');
                    args = this.parseExprList();
                    this.expectToken(')', `There should be another expression or a ")" here.`);
                }
                return { name: tok.str, args: args };
            default:
                this.compileError(`There should be a variable name here.`);
                break;
        }
    }
    parseLexpr(): IndOp {
        var lexpr = this.parseVarSubscriptOrFunc();
        this.validateVarName(lexpr);
        return lexpr;
    }
    parseForNextLexpr() : IndOp {
        var lexpr = this.parseLexpr();
        if (lexpr.args || lexpr.name.endsWith('$'))
            this.compileError(`A FOR ... NEXT loop can only use numeric variables.`);
        return lexpr;
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
    parseLexprList(): IndOp[] {
        return this.parseList(this.parseLexpr, ',');
    }
    parseExprList(): Expr[] {
        return this.parseList(this.parseExpr, ',');
    }
    parseLabelList(): Expr[] {
        return this.parseList(this.parseLabel, ',');
    }
    parseLabel() : Expr {
        // parse full expr?
        if (this.opts.computedGoto) {
            // parse expression, but still add to list of label targets if constant
            var expr = this.parseExpr();
            if ((expr as Literal).value != null) {
                this.targets[(expr as Literal).value] = this.lasttoken.$loc;
            }
            return expr;
        }
        // parse a single number or ident label
        var tok = this.consumeToken();
        switch (tok.type) {
            case TokenType.Ident:
                if (!this.opts.optionalLabels) this.dialectError(`labels other than line numbers`)
            case TokenType.Int:
                var label = tok.str;
                this.targets[label] = tok.$loc;
                return {value:label};
            default:
                if (this.opts.optionalLabels) this.compileError(`There should be a line number or label here.`);
                else this.compileError(`There should be a line number here.`);
        }
    }
    parseDatumList(): Literal[] {
        return this.parseList(this.parseDatum, ',');
    }
    parseDatum(): Literal {
        var tok = this.consumeToken();
        // get rid of leading whitespace
        while (tok.type == TokenType.Whitespace)
            tok = this.consumeToken();
        if (isEOS(tok)) this.compileError(`There should be a datum here.`);
        // parse constants
        if (tok.type <= TokenType.HexOctalInt) {
            return this.parseValue(tok);
        }
        if (tok.str == '-' && this.peekToken().type <= TokenType.HexOctalInt) {
            tok = this.consumeToken();
            return { value: -this.parseValue(tok).value };
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
        return { value: s }; // trim leading and trailing whitespace
    }
    parseValue(tok: Token): Literal {
        switch (tok.type) {
            case TokenType.HexOctalInt:
                if (!this.opts.hexOctalConsts) this.dialectError(`hex/octal constants`);
                let base = tok.str.startsWith('H') ? 16 : 8;
                return { value: parseInt(tok.str.substr(1), base) };
            case TokenType.Int:
            case TokenType.Float:
                return { value: this.parseNumber(tok.str) };
            case TokenType.String:
                return { value: stripQuotes(tok.str) };
            default:
                return { value: tok.str }; // only used in DATA statement
        }
    }
    parsePrimary(): Expr {
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
                    return { op: this.opts.bitwiseLogic ? 'bnot' : 'lnot', expr: expr };
                } else {
                    this.pushbackToken(tok);
                    return this.parseVarSubscriptOrFunc();
                }
            case TokenType.Operator:
                if (tok.str == '(') {
                    let expr = this.parseExpr();
                    this.expectToken(')', `There should be another expression or a ")" here.`);
                    return expr;
                } else if (tok.str == '-') {
                    let expr = this.parsePrimary(); // TODO: -2^2=-4 and -2-2=-4
                    return { op: 'neg', expr: expr };
                } else if (tok.str == '+') {
                    return this.parsePrimary(); // ignore unary +
                }
            default:
                this.compileError(`The expression is incomplete.`);
                return;
        }
        this.compileError(`There was an unexpected "${tok.str}" in this expression.`);
    }
    parseNumber(str: string) : number {
        var n = parseFloat(str);
        if (isNaN(n))
            this.compileError(`The number ${str} is not a valid floating-point number.`);
        if (this.opts.checkOverflow && !isFinite(n))
            this.compileError(`The number ${str} is too big to fit into a floating-point value.`);
        return n;
    }
    parseExpr1(left: Expr, minPred: number): Expr {
        let look = this.peekToken();
        while (getPrecedence(look) >= minPred) {
            let op = this.consumeToken();
            if (this.opts.validOperators && this.opts.validOperators.indexOf(op.str) < 0)
                this.dialectError(`the "${op.str}" operator`);
            let right: Expr = this.parsePrimary();
            look = this.peekToken();
            while (getPrecedence(look) > getPrecedence(op)) {
                right = this.parseExpr1(right, getPrecedence(look));
                look = this.peekToken();
            }
            var opfn = getOperator(op.str).f;
            // use logical operators instead of bitwise?
            if (!this.opts.bitwiseLogic && op.str == 'AND') opfn = 'land';
            if (!this.opts.bitwiseLogic && op.str == 'OR') opfn = 'lor';
            left = { op:opfn, left: left, right: right };
        }
        return left;
    }
    parseExpr(): Expr {
        return this.parseExpr1(this.parsePrimary(), 0);
    }
    validateVarName(lexpr: IndOp) {
        switch (this.opts.varNaming) {
            case 'A': // TINY BASIC, no strings
                if (!/^[A-Z]$/i.test(lexpr.name))
                    this.dialectError(`variable names other than a single letter`);
                break;
            case 'A1':
                if (lexpr.args == null && !/^[A-Z][0-9]?[$]?$/i.test(lexpr.name))
                    this.dialectError(`variable names other than a letter followed by an optional digit`);
                if (lexpr.args != null && !/^[A-Z]?[$]?$/i.test(lexpr.name))
                    this.dialectError(`array names other than a single letter`);
                break;
            case 'AA':
                if (lexpr.args == null && !/^[A-Z][A-Z0-9]?[$]?$/i.test(lexpr.name))
                    this.dialectError(`variable names other than a letter followed by an optional letter or digit`);
                break;
            case '*':
                break;
        }
    }

    //// STATEMENTS

    stmt__LET(): LET_Statement {
        var lexpr = this.parseLexpr();
        this.expectToken("=");
        var right = this.parseExpr();
        return { command: "LET", lexpr: lexpr, right: right };
    }
    stmt__PRINT(): PRINT_Statement {
        var sep, lastsep;
        var list = [];
        do {
            sep = this.peekToken();
            if (isEOS(sep)) {
                break;
            } else if (sep.str == ';') {
                this.consumeToken();
                lastsep = sep;
            } else if (sep.str == ',') {
                this.consumeToken();
                list.push({value:'\t'});
                lastsep = sep;
            } else {
                list.push(this.parseExpr());
                lastsep = null;
            }
        } while (true);
        if (!(lastsep && (lastsep.str == ';' || sep.str != ','))) {
            list.push({value:'\n'});
        }
        return { command: "PRINT", args: list };
    }
    stmt__GOTO(): GOTO_Statement | GOSUB_Statement | ONGO_Statement {
        return this.__GO("GOTO");
    }
    stmt__GOSUB(): GOTO_Statement | GOSUB_Statement | ONGO_Statement {
        return this.__GO("GOSUB");
    }
    __GO(cmd: "GOTO"|"GOSUB"): GOTO_Statement | GOSUB_Statement | ONGO_Statement {
        var expr = this.parseLabel();
        // GOTO (expr) OF (labels...)
        if (this.opts.computedGoto && this.peekToken().str == 'OF') {
            this.expectToken('OF');
            let newcmd : 'ONGOTO'|'ONGOSUB' = (cmd == 'GOTO') ? 'ONGOTO' : 'ONGOSUB';
            return { command:newcmd, expr:expr, labels:this.parseLabelList() };
        }
        // regular GOTO or GOSUB
        return { command: cmd, label: expr };
    }
    stmt__IF(): IF_Statement {
        var cond = this.parseExpr();
        var iftrue: Statement[];
        // we accept GOTO or THEN if line number provided
        var thengoto = this.expectTokens(['THEN','GOTO']);
        var lineno = this.peekToken();
        // assume GOTO if number given after THEN
        if (lineno.type == TokenType.Int) {
            this.pushbackToken({type:TokenType.Ident, str:'GOTO', $loc:lineno.$loc});
        }
        // add fake ":"
        this.pushbackToken({type:TokenType.Operator, str:':', $loc:lineno.$loc});
        return { command: "IF", cond: cond };
    }
    stmt__ELSE(): ELSE_Statement {
        var lineno = this.peekToken();
        // assume GOTO if number given after ELSE
        if (lineno.type == TokenType.Int) {
            this.pushbackToken({type:TokenType.Ident, str:'GOTO', $loc:lineno.$loc});
        }
        // add fake ":"
        this.pushbackToken({type:TokenType.Operator, str:':', $loc:lineno.$loc});
        return { command: "ELSE" };
    }
    stmt__FOR() : FOR_Statement {
        var lexpr = this.parseForNextLexpr();
        this.expectToken('=');
        var init = this.parseExpr();
        this.expectToken('TO');
        var targ = this.parseExpr();
        if (this.peekToken().str == 'STEP') {
            this.consumeToken();
            var step = this.parseExpr();
        }
        return { command:'FOR', lexpr:lexpr, initial:init, target:targ, step:step };
    }
    stmt__NEXT() : NEXT_Statement {
        var lexpr = null;
        // NEXT var might be optional
        if (!this.opts.optionalNextVar || !isEOS(this.peekToken())) {
            lexpr = this.parseForNextLexpr();
            // convert ',' to ':' 'NEXT'
            if (this.opts.multipleNextVars && this.peekToken().str == ',') {
                this.consumeToken(); // consume ','
                this.tokens.unshift({type:TokenType.Ident, str:'NEXT', $loc:this.peekToken().$loc});
                this.tokens.unshift({type:TokenType.Operator, str:':', $loc:this.peekToken().$loc});
            }
        }
        return { command:'NEXT', lexpr:lexpr };
    }
    stmt__WHILE(): WHILE_Statement {
        var cond = this.parseExpr();
        return { command:'WHILE', cond:cond };
    }
    stmt__WEND(): WEND_Statement {
        return { command:'WEND' };
    }
    stmt__DIM() : DIM_Statement {
        var lexprs = this.parseLexprList();
        lexprs.forEach((arr) => {
            if (arr.args == null || arr.args.length == 0) 
                this.compileError(`An array defined by DIM must have at least one dimension.`)
            else if (arr.args.length > this.opts.maxDimensions) 
                this.dialectError(`more than ${this.opts.maxDimensions} dimensional arrays`);
        });
        return { command:'DIM', args:lexprs };
    }
    stmt__INPUT() : INPUT_Statement {
        var prompt = this.consumeToken();
        var promptstr;
        if (prompt.type == TokenType.String) {
            this.expectTokens([';', ',']);
            promptstr = stripQuotes(prompt.str);
        } else {
            this.pushbackToken(prompt);
            promptstr = "";
        }
        return { command:'INPUT', prompt:{ value: promptstr }, args:this.parseLexprList() };
    }
    /* for HP BASIC only */
    stmt__ENTER() : INPUT_Statement {
        var secs = this.parseExpr();
        this.expectToken(',');
        var result = this.parseLexpr(); // TODO: this has to go somewheres
        this.expectToken(',');
        return this.stmt__INPUT();
    }
    // TODO: DATA statement doesn't read unquoted strings
    stmt__DATA() : DATA_Statement {
        return { command:'DATA', datums:this.parseDatumList() };
    }
    stmt__READ() : READ_Statement {
        return { command:'READ', args:this.parseLexprList() };
    }
    stmt__RESTORE() : RESTORE_Statement {
        var label = null;
        if (this.opts.restoreWithLabel && !isEOS(this.peekToken()))
            label = this.parseLabel();
        return { command:'RESTORE', label:label };
    }
    stmt__RETURN() {
        return { command:'RETURN' };
    }
    stmt__STOP() {
        return { command:'STOP' };
    }
    stmt__END() {
        return { command:'END' };
    }
    stmt__ON() : ONGO_Statement {
        var expr = this.parseExpr();
        var gotok = this.consumeToken();
        var cmd = {GOTO:'ONGOTO', GOSUB:'ONGOSUB'}[gotok.str];
        if (!cmd) this.compileError(`There should be a GOTO or GOSUB here.`);
        var labels = this.parseLabelList();
        return { command:cmd, expr:expr, labels:labels };
    }
    stmt__DEF() : DEF_Statement {
        var lexpr = this.parseVarSubscriptOrFunc();
        if (lexpr.args && lexpr.args.length > this.opts.maxDefArgs)
            this.compileError(`There can be no more than ${this.opts.maxDefArgs} arguments to a function or subscript.`);
        if (!lexpr.name.startsWith('FN')) this.compileError(`Functions defined with DEF must begin with the letters "FN".`)
        this.expectToken("=");
        var func = this.parseExpr();
        return { command:'DEF', lexpr:lexpr, def:func };
    }
    stmt__POP() : NoArgStatement {
        return { command:'POP' };
    }
    stmt__GET() : GET_Statement {
        var lexpr = this.parseLexpr();
        return { command:'GET', lexpr:lexpr };
    }
    stmt__CLEAR() : NoArgStatement {
        return { command:'CLEAR' };
    }
    stmt__RANDOMIZE() : NoArgStatement {
        return { command:'RANDOMIZE' };
    }
    // TODO: CHANGE A TO A$ (4th edition, A(0) is len and A(1..) are chars)
    stmt__OPTION() : OPTION_Statement {
        var tokname = this.consumeToken();
        if (tokname.type != TokenType.Ident) this.compileError(`There must be a name after the OPTION statement.`)
        var list : string[] = [];
        var tok;
        do {
            tok = this.consumeToken();
            if (isEOS(tok)) break;
            list.push(tok.str);
        } while (true);
        this.pushbackToken(tok);
        var stmt : OPTION_Statement = { command:'OPTION', optname:tokname.str, optargs:list };
        this.parseOptions(stmt);
        return stmt;
    }
    parseOptions(stmt: OPTION_Statement) {
        var arg = stmt.optargs[0];
        switch (stmt.optname) {
            case 'BASE': 
                let base = parseInt(arg);
                if (base == 0 || base == 1) this.opts.defaultArrayBase = base;
                else this.compileError("OPTION BASE can only be 0 or 1.");
                break;
            case 'DIALECT':
                let dname = arg || "";
                let dialect = DIALECTS[dname.toUpperCase()];
                if (dialect) this.opts = dialect;
                else this.compileError(`OPTION DIALECT ${dname} is not supported by this compiler.`);
                break;
            case 'CPUSPEED':
                if (!(this.opts.commandsPerSec = Math.min(1e7, arg=='MAX' ? Infinity : parseFloat(arg))))
                    this.compileError(`OPTION CPUSPEED takes a positive number or MAX.`);
                break;
            default:
                // maybe it's one of the options?
                var name = Object.getOwnPropertyNames(this.opts).find((n) => n.toUpperCase() == stmt.optname);
                if (name != null) switch (typeof this.opts[name]) {
                    case 'boolean' : this.opts[name] = arg ? true : false; return;
                    case 'number' : this.opts[name] = parseFloat(arg); return;
                    case 'string' : this.opts[name] = arg; return;
                    case 'object' :
                        if (Array.isArray(this.opts[name]) && arg == 'ALL') {
                            this.opts[name] = null;
                            return;
                        }
                }
                this.compileError(`OPTION ${stmt.optname} is not supported by this compiler.`);
                break;
        }
    }
    
    // for workermain
    generateListing(file: string, program: BASICProgram) {
        var srclines = [];
        var pc = 0;
        var laststmt : Statement;
        program.lines.forEach((line, idx) => {
            line.stmts.forEach((stmt) => {
                laststmt = stmt;
                var sl = stmt.$loc;
                sl.offset = pc++; // TODO: could Statement have offset field?
                srclines.push(sl);
            });
        });
        if (this.opts.endStmtRequired && (laststmt == null || laststmt.command != 'END'))
            this.dialectError(`programs without an final END statement`);
        return { lines: srclines };
    }
    getListings() : CodeListingMap {
        return this.listings;
    }

    // LINT STUFF
    checkAll(program : BASICProgram) {
        this.checkLabels();
    }
    checkLabels() {
        for (let targ in this.targets) {
            if (this.labels[targ] == null) {
                this.addError(`There isn't a line number ${targ}.`, this.targets[targ]);
            }
        }
    }
}

///// BASIC DIALECTS

export const ECMA55_MINIMAL : BASICOptions = {
    dialectName: "ECMA55",
    asciiOnly : true,
    uppercaseOnly : true,
    optionalLabels : false,
    optionalWhitespace : false,
    varNaming : "A1",
    staticArrays : true,
    sharedArrayNamespace : true,
    defaultArrayBase : 0,
    defaultArraySize : 11,
    defaultValues : false,
    stringConcat : false,
    typeConvert : false,
    maxDimensions : 2,
    maxDefArgs : 255,
    maxStringLength : 255,
    tickComments : false,
    hexOctalConsts : false,
    validKeywords : [
        'BASE','DATA','DEF','DIM','END',
        'FOR','GO','GOSUB','GOTO','IF','INPUT','LET','NEXT','ON','OPTION','PRINT',
        'RANDOMIZE','READ','REM','RESTORE','RETURN','STEP','STOP','SUB','THEN','TO'
    ],
    validFunctions : [
        'ABS','ATN','COS','EXP','INT','LOG','RND','SGN','SIN','SQR','TAB','TAN'
    ],
    validOperators : [
        '=', '<>', '<', '>', '<=', '>=', '+', '-', '*', '/', '^'
    ],
    printZoneLength : 15,
    numericPadding : true,
    checkOverflow : true,
    testInitialFor : true,
    optionalNextVar : false,
    multipleNextVars : false,
    bitwiseLogic : false,
    checkOnGotoIndex : true,
    computedGoto : false,
    restoreWithLabel : false,
    squareBrackets : false,
    arraysContainChars : false,
    endStmtRequired : true,
}

// TODO: only integers supported
export const TINY_BASIC : BASICOptions = {
    dialectName: "TINY",
    asciiOnly : true,
    uppercaseOnly : true,
    optionalLabels : false,
    optionalWhitespace : false,
    varNaming : "A",
    staticArrays : false,
    sharedArrayNamespace : true,
    defaultArrayBase : 0,
    defaultArraySize : 0,
    defaultValues : true,
    stringConcat : false,
    typeConvert : false,
    maxDimensions : 0,
    maxDefArgs : 255,
    maxStringLength : 255,
    tickComments : false,
    hexOctalConsts : false,
    validKeywords : [
        'OPTION',
        'PRINT','IF','THEN','GOTO','INPUT','LET','GOSUB','RETURN','CLEAR','END'
    ],
    validFunctions : [
    ],
    validOperators : [
        '=', '<>', '><', '<', '>', '<=', '>=', '+', '-', '*', '/',
    ],
    printZoneLength : 1,
    numericPadding : false,
    checkOverflow : false,
    testInitialFor : false,
    optionalNextVar : false,
    multipleNextVars : false,
    bitwiseLogic : false,
    checkOnGotoIndex : false,
    computedGoto : true, // TODO: is it really though?
    restoreWithLabel : false,
    squareBrackets : false,
    arraysContainChars : false,
    endStmtRequired : false,
}


export const HP_TIMESHARED_BASIC : BASICOptions = {
    dialectName: "HP2000",
    asciiOnly : true,
    uppercaseOnly : false,
    optionalLabels : false,
    optionalWhitespace : false,
    varNaming : "A1",
    staticArrays : true,
    sharedArrayNamespace : false,
    defaultArrayBase : 1,
    defaultArraySize : 11,
    defaultValues : false,
    stringConcat : false,
    typeConvert : false,
    maxDimensions : 2,
    maxDefArgs : 255,
    maxStringLength : 255,
    tickComments : false, // TODO: HP BASIC has 'hh char constants
    hexOctalConsts : false,
    validKeywords : [
        'BASE','DATA','DEF','DIM','END',
        'FOR','GO','GOSUB','GOTO','IF','INPUT','LET','NEXT','OPTION','PRINT',
        'RANDOMIZE','READ','REM','RESTORE','RETURN','STEP','STOP','SUB','THEN','TO',
        'ENTER','MAT','CONVERT','OF','IMAGE','USING'
    ],
    validFunctions : [
        'ABS','ATN','BRK','COS','CTL','EXP','INT','LEN','LIN','LOG','NUM',
        'POS','RND','SGN','SIN','SPA','SQR','TAB','TAN','TIM','TYP','UPS$' // TODO: POS,
    ],
    validOperators : [
        '=', '<>', '<', '>', '<=', '>=', '+', '-', '*', '/', '^',
        '**', '#', 'NOT', 'AND', 'OR', 'MIN', 'MAX',
    ],
    printZoneLength : 15,
    numericPadding : true,
    checkOverflow : false,
    testInitialFor : true,
    optionalNextVar : false,
    multipleNextVars : false,
    bitwiseLogic : false,
    checkOnGotoIndex : false,
    computedGoto : true,
    restoreWithLabel : true,
    squareBrackets : true,
    arraysContainChars : true,
    endStmtRequired : true,
    // TODO: max line number, array index 9999
}

export const BASICODE : BASICOptions = {
    dialectName: "BASICODE",
    asciiOnly : true,
    uppercaseOnly : false,
    optionalLabels : false,
    optionalWhitespace : true,
    varNaming : "AA",
    staticArrays : true,
    sharedArrayNamespace : false,
    defaultArrayBase : 0,
    defaultArraySize : 11,
    defaultValues : false,
    stringConcat : true,
    typeConvert : false,
    maxDimensions : 2,
    maxDefArgs : 255,
    maxStringLength : 255,
    tickComments : false,
    hexOctalConsts : false,
    validKeywords : [
        'BASE','DATA','DEF','DIM','END',
        'FOR','GO','GOSUB','GOTO','IF','INPUT','LET','NEXT','ON','OPTION','PRINT',
        'READ','REM','RESTORE','RETURN','STEP','STOP','SUB','THEN','TO',
        'AND', 'NOT', 'OR'
    ],
    validFunctions : [
        'ABS','ASC','ATN','CHR$','COS','EXP','INT','LEFT$','LEN','LOG',    
        'MID$','RIGHT$','SGN','SIN','SQR','TAB','TAN','VAL'
    ],
    validOperators : [
        '=', '<>', '<', '>', '<=', '>=', '+', '-', '*', '/', '^', 'AND', 'NOT', 'OR'
    ],
    printZoneLength : 15,
    numericPadding : true,
    checkOverflow : true,
    testInitialFor : true,
    optionalNextVar : false,
    multipleNextVars : false,
    bitwiseLogic : false,
    checkOnGotoIndex : true,
    computedGoto : false,
    restoreWithLabel : false,
    squareBrackets : false,
    arraysContainChars : false,
    endStmtRequired : false,
}

export const ALTAIR_BASIC41 : BASICOptions = {
    dialectName: "ALTAIR41",
    asciiOnly : true,
    uppercaseOnly : true,
    optionalLabels : false,
    optionalWhitespace : true,
    varNaming : "*", // or AA
    staticArrays : false,
    sharedArrayNamespace : true,
    defaultArrayBase : 0,
    defaultArraySize : 11,
    defaultValues : true,
    stringConcat : true,
    typeConvert : false,
    maxDimensions : 128, // "as many as will fit on a single line" ... ?
    maxDefArgs : 255,
    maxStringLength : 255,
    tickComments : false,
    hexOctalConsts : false,
    validKeywords : [
        'OPTION',
        'CONSOLE','DATA','DEF','DEFUSR','DIM','END','ERASE','ERROR',
        'FOR','GOTO','GOSUB','IF','THEN','ELSE','INPUT','LET','LINE',
        'PRINT','LPRINT','USING','NEXT','ON','OUT','POKE',
        'READ','REM','RESTORE','RESUME','RETURN','STOP','SWAP',
        'TROFF','TRON','WAIT',
        'TO','STEP',
        'AND', 'NOT', 'OR', 'XOR', 'IMP', 'EQV', 'MOD'
    ],
    validFunctions : [
        'ABS','ASC','ATN','CDBL','CHR$','CINT','COS','ERL','ERR',
        'EXP','FIX','FRE','HEX$','INP','INSTR','INT',
        'LEFT$','LEN','LOG','LPOS','MID$',
        'OCT$','POS','RIGHT$','RND','SGN','SIN','SPACE$','SPC',
        'SQR','STR$','STRING$','TAB','TAN','USR','VAL','VARPTR'
    ],
    validOperators : [
        '=', '<>', '<', '>', '<=', '>=', '+', '-', '*', '/', '^', '\\',
        'AND', 'NOT', 'OR', 'XOR', 'IMP', 'EQV', 'MOD'
    ],
    printZoneLength : 15,
    numericPadding : true,
    checkOverflow : true,
    testInitialFor : false,
    optionalNextVar : true,
    multipleNextVars : true,
    bitwiseLogic : true,
    checkOnGotoIndex : false,
    computedGoto : false,
    restoreWithLabel : false,
    squareBrackets : false,
    arraysContainChars : false,
    endStmtRequired : false,
}

export const APPLESOFT_BASIC : BASICOptions = {
    dialectName: "APPLESOFT",
    asciiOnly : true,
    uppercaseOnly : false,
    optionalLabels : false,
    optionalWhitespace : true,
    varNaming : "*", // or AA
    staticArrays : false,
    sharedArrayNamespace : false,
    defaultArrayBase : 0,
    defaultArraySize : 11,
    defaultValues : true,
    stringConcat : true,
    typeConvert : false,
    maxDimensions : 88,
    maxDefArgs : 1, // TODO: no string FNs
    maxStringLength : 255,
    tickComments : false,
    hexOctalConsts : false,
    validKeywords : [
        'OPTION',
        'CLEAR','LET','DIM','DEF','GOTO','GOSUB','RETURN','ON','POP',
        'FOR','NEXT','IF','THEN','END','STOP','ONERR','RESUME',
        'PRINT','INPUT','GET','HOME','HTAB','VTAB',
        'INVERSE','FLASH','NORMAL','TEXT',
        'GR','COLOR','PLOT','HLIN','VLIN',
        'HGR','HGR2','HPLOT','HCOLOR','AT',
        'DATA','READ','RESTORE',
        'REM','TRACE','NOTRACE',
        'TO','STEP',
        'AND', 'NOT', 'OR'
    ],
    validFunctions : [
        'ABS','ATN','COS','EXP','INT','LOG','RND','SGN','SIN','SQR','TAN',
        'LEN','LEFT$','MID$','RIGHT$','STR$','VAL','CHR$','ASC',
        'FRE','SCRN','PDL','PEEK','POS'
    ],
    validOperators : [
        '=', '<>', '<', '>', '<=', '>=', '+', '-', '*', '/', '^',
        'AND', 'NOT', 'OR'
    ],
    printZoneLength : 16,
    numericPadding : false,
    checkOverflow : true,
    testInitialFor : false,
    optionalNextVar : true,
    multipleNextVars : true,
    bitwiseLogic : false,
    checkOnGotoIndex : false,
    computedGoto : false,
    restoreWithLabel : false,
    squareBrackets : false,
    arraysContainChars : false,
    endStmtRequired : false,
}

export const BASIC80 : BASICOptions = {
    dialectName: "BASIC80",
    asciiOnly : true,
    uppercaseOnly : false,
    optionalLabels : false,
    optionalWhitespace : true,
    varNaming : "*",
    staticArrays : false,
    sharedArrayNamespace : true,
    defaultArrayBase : 0,
    defaultArraySize : 11,
    defaultValues : true,
    stringConcat : true,
    typeConvert : false,
    maxDimensions : 255,
    maxDefArgs : 255,
    maxStringLength : 255,
    //maxElements : 32767, // TODO
    tickComments : true,
    hexOctalConsts : true,
    validKeywords : [
        'OPTION',
        'CONSOLE','DATA','DEF','DEFUSR','DIM','END','ERASE','ERROR',
        'FOR','GOTO','GOSUB','IF','THEN','ELSE','INPUT','LET','LINE',
        'PRINT','LPRINT','USING','NEXT','ON','OUT','POKE',
        'READ','REM','RESTORE','RESUME','RETURN','STOP','SWAP',
        'TROFF','TRON','WAIT',
        'CALL','CHAIN','COMMON','WHILE','WEND','WRITE','RANDOMIZE',
        'TO','STEP',
        'AND', 'NOT', 'OR', 'XOR', 'IMP', 'EQV', 'MOD'
    ],
    validFunctions : [
        'ABS','ASC','ATN','CDBL','CHR$','CINT','COS','CSNG','CVI','CVS','CVD',
        'EOF','EXP','FIX','FRE','HEX$','INP','INPUT$','INSTR','INT',
        'LEFT$','LEN','LOC','LOG','LPOS','MID$','MKI$','MKS$','MKD$',
        'OCT$','PEEK','POS','RIGHT$','RND','SGN','SIN','SPACE$','SPC',
        'SQR','STR$','STRING$','TAB','TAN','USR','VAL','VARPTR'
    ],
    validOperators : [
        '=', '<>', '<', '>', '<=', '>=', '+', '-', '*', '/', '^', '\\',
        'AND', 'NOT', 'OR', 'XOR', 'IMP', 'EQV', 'MOD'
    ],
    printZoneLength : 14,
    numericPadding : true,
    checkOverflow : false, // TODO: message displayed when overflow, division by zero = ok
    testInitialFor : true,
    optionalNextVar : true,
    multipleNextVars : true,
    bitwiseLogic : true,
    checkOnGotoIndex : false,
    computedGoto : false,
    restoreWithLabel : true,
    squareBrackets : false,
    arraysContainChars : false,
    endStmtRequired : false,
}

export const MODERN_BASIC : BASICOptions = {
    dialectName: "MODERN",
    asciiOnly : false,
    uppercaseOnly : false,
    optionalLabels : true,
    optionalWhitespace : false,
    varNaming : "*",
    staticArrays : false,
    sharedArrayNamespace : false,
    defaultArrayBase : 0,
    defaultArraySize : 0, // DIM required
    defaultValues : false,
    stringConcat : true,
    typeConvert : true,
    maxDimensions : 255,
    maxDefArgs : 255,
    maxStringLength : 2048, // TODO?
    tickComments : true,
    hexOctalConsts : true,
    validKeywords : null, // all
    validFunctions : null, // all
    validOperators : null, // all
    printZoneLength : 16,
    numericPadding : false,
    checkOverflow : true,
    testInitialFor : true,
    optionalNextVar : true,
    multipleNextVars : true,
    bitwiseLogic : true,
    checkOnGotoIndex : true,
    computedGoto : true,
    restoreWithLabel : true,
    squareBrackets : true,
    arraysContainChars : false,
    endStmtRequired : false,
}

// TODO: integer vars
// TODO: DEFINT/DEFSTR

export const DIALECTS = {
    "DEFAULT":      ALTAIR_BASIC41,
    "ALTAIR":       ALTAIR_BASIC41,
    "ALTAIR4":      ALTAIR_BASIC41,
    "ALTAIR41":     ALTAIR_BASIC41,
    "ECMA55":       ECMA55_MINIMAL,
    "MINIMAL":      ECMA55_MINIMAL,
    "HP":           HP_TIMESHARED_BASIC,
    "HPB":          HP_TIMESHARED_BASIC,
    "HPTSB":        HP_TIMESHARED_BASIC,
    "HP2000":       HP_TIMESHARED_BASIC,
    "HPBASIC":      HP_TIMESHARED_BASIC,
    "HPACCESS":     HP_TIMESHARED_BASIC,
    "BASICODE":     BASICODE,
    "APPLESOFT":    APPLESOFT_BASIC,
    "BASIC80":      BASIC80,
    "MODERN":       MODERN_BASIC,
    "TINY":         TINY_BASIC,
};
