import { WorkerError, CodeListingMap, SourceLocation, SourceLine } from "../workertypes";

export interface BASICOptions {
    dialectName : string;               // use this to select the dialect 
    // SYNTAX AND PARSING
    asciiOnly : boolean;                // reject non-ASCII chars?
    uppercaseOnly : boolean;            // convert everything to uppercase?
    optionalLabels : boolean;			// can omit line numbers and use labels?
    optionalWhitespace : boolean;       // can "crunch" keywords? also, eat extra ":" delims
    varNaming : 'A'|'A1'|'AA'|'*';      // only allow A0-9 for numerics, single letter for arrays/strings
    squareBrackets : boolean;           // "[" and "]" interchangable with "(" and ")"?
    tickComments : boolean;             // support 'comments?
    hexOctalConsts : boolean;           // support &H and &O integer constants?
    chainAssignments : boolean;         // support A = B = value (HP2000)
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
    maxLinesPerFile? : number;          // limit on # of lines
    maxArrayElements? : number;         // max array elements (all dimensions)
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
//                FLOAT                             INT       HEXOCTAL                    REMARK   IDENT           STRING   RELOP        EXP    OPERATORS             OTHER  WS
const re_toks = /([0-9.]+[E][+-]?\d+|\d+[.][E0-9]*|[.][E0-9]+)|[0]*(\d+)|&([OH][0-9A-F]+)|(['].*)|([A-Z_]\w*[$]?)|(".*?")|([<>]?[=<>#])|(\*\*)|([-+*/^,;:()\[\]\?\\])|(\S+)|(\s+)/gi;

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
    lexprs: IndOp[];
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

export interface CHANGE_Statement {
    command: "CHANGE";
    src: Expr;
    dest: IndOp;
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
    '==':   {f:'eq',p:50},
    '<>':   {f:'ne',p:50},
    '><':   {f:'ne',p:50},
    '!=':   {f:'ne',p:50},
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

function isLiteral(arg: Expr): arg is Literal {
    return (arg as any).value != null;
}
function isLookup(arg: Expr): arg is IndOp {
    return (arg as any).name != null;
}
function isBinOp(arg: Expr): arg is BinOp {
    return (arg as any).op != null && (arg as any).left != null && (arg as any).right != null;
}
function isUnOp(arg: Expr): arg is UnOp {
    return (arg as any).op != null && (arg as any).expr != null;
}

///// BASIC PARSER

export class BASICParser {
    opts : BASICOptions = DIALECTS['DEFAULT'];
    optionCount : number;
    errors: WorkerError[];
    listings: CodeListingMap;
    labels: { [label: string]: BASICLine };
    targets: { [targetlabel: string]: SourceLocation };
    varrefs: { [name: string]: SourceLocation }; // references
    fnrefs: { [name: string]: string[] }; // DEF FN call graph
    maxlinelen : number = 255; // maximum line length

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
        this.varrefs = {};
        this.fnrefs = {};
        this.optionCount = 0;
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
    peekToken(lookahead?: number): Token {
        var tok = this.tokens[lookahead || 0];
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
                this.setCurrentLabel(line, tok.str);
                break;
            case TokenType.HexOctalInt:
            case TokenType.Float:
                this.compileError(`Line numbers must be positive integers.`);
                break;
            default:
                if (this.opts.optionalLabels) this.compileError(`A line must start with a line number, command, or label.`);
                else this.compileError(`A line must start with a line number.`);
            case TokenType.Remark:
                break;
        }
    }
    setCurrentLabel(line: BASICLine, str: string) {
        if (this.labels[str] != null) this.compileError(`There's a duplicated label "${str}".`);
        this.labels[str] = line;
        line.label = str;
        this.curlabel = str;
        this.tokens.forEach((tok) => tok.$loc.label = str);
    }
    parseFile(file: string, path: string) : BASICProgram {
        this.path = path;
        var txtlines = file.split(/\n|\r\n?/);
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
    _tokenize(line: string) : void {
        // split identifier regex (if token-crunching enabled)
        let splitre = this.opts.optionalWhitespace && new RegExp('('+this.opts.validKeywords.map(s => `${s}`).join('|')+')');
        // iterate over each token via re_toks regex
        var lastTokType = TokenType.CatchAll;
        var m : RegExpMatchArray;
        while (m = re_toks.exec(line)) {
            for (var i = 1; i <= lastTokType; i++) {
                let s : string = m[i];
                if (s != null) {
                    let loc = { path: this.path, line: this.lineno, start: m.index, end: m.index+s.length };
                    // maybe we don't support unicode in 1975?
                    if (this.opts.asciiOnly && !/^[\x00-\x7F]*$/.test(s))
                        this.dialectError(`non-ASCII characters`);
                    // uppercase all identifiers, and maybe more
                    if (i == TokenType.Ident || i == TokenType.HexOctalInt || this.opts.uppercaseOnly) {
                        s = s.toUpperCase();
                        // DATA statement captures whitespace too
                        if (s == 'DATA') lastTokType = TokenType.Whitespace;
                        // certain keywords shouldn't split for rest of line
                        if (s == 'DATA') splitre = null;
                        if (s == 'OPTION') splitre = null;
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
                        var splittoks = s.split(splitre).filter((s) => s != ''); // only non-empties
                        if (splittoks.length > 1) {
                            splittoks.forEach((ss) => {
                                // check to see if leftover might be integer, or identifier
                                if (/^[0-9]+$/.test(ss)) i = TokenType.Int;
                                else if (/^[A-Z_]\w*[$]?$/.test(ss)) i = TokenType.Ident;
                                else this.compileError(`Try adding whitespace before "${ss}".`);
                                this.tokens.push({str: ss, type: i, $loc:loc});
                            });
                            s = null;
                        }
                    }
                    // add token to list
                    if (s) this.tokens.push({str: s, type: i, $loc:loc});
                    break;
                }
            }
        }
    }
    tokenize(line: string) : void {
        this.lineno++;
        this.tokens = []; // can't have errors until this is set
        this.eol = { type: TokenType.EOL, str: "", $loc: { path: this.path, line: this.lineno, start: line.length } };
        if (line.length > this.maxlinelen) this.compileError(`A line should be no more than ${this.maxlinelen} characters long.`);
        this._tokenize(line);
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
    supportsKeyword(keyword: string) {
        if (this['stmt__' + keyword] != null) return true;
        return false;
    }
    parseStatement(): Statement | null {
        // eat extra ":" (should have separate property for this)
        if (this.opts.optionalWhitespace && this.peekToken().str == ':') return null;
        // get the command word
        var cmdtok = this.consumeToken();
        var cmd = cmdtok.str;
        var stmt;
        switch (cmdtok.type) {
            case TokenType.Remark:
                if (cmdtok.str.startsWith("'") && !this.opts.tickComments) this.dialectError(`tick remarks`);
                return null;
            case TokenType.Operator:
                // "?" is alias for "PRINT" on some platforms
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
                } else {
                    this.compileError(`I don't understand the command "${cmd}".`);
                }
            case TokenType.EOL:
                if (this.opts.optionalWhitespace) return null;
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
                this.varrefs[tok.str] = tok.$loc;
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
    visitExpr(expr: Expr, callback: (expr:Expr) => void) {
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

    //// STATEMENTS

    stmt__LET(): LET_Statement {
        var lexprs = [ this.parseLexpr() ];
        this.expectToken("=");
        // look for A=B=expr (TODO: doesn't work on arrays)
        while (this.opts.chainAssignments && this.peekToken().type == TokenType.Ident && this.peekToken(1).str == '=') {
            lexprs.push(this.parseLexpr());
            this.expectToken("=");
        }
        var right = this.parseExpr();
        return { command: "LET", lexprs: lexprs, right: right };
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
        // we accept GOTO or THEN if line number provided (DEC accepts GO TO)
        var thengoto = this.expectTokens(['THEN','GOTO','GO']);
        if (thengoto.str == 'GO') this.expectToken('TO');
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
            for (var arrdim of arr.args) {
                if (isLiteral(arrdim) && arrdim.value < this.opts.defaultArrayBase)
                    this.compileError(`An array dimension cannot be less than ${this.opts.defaultArrayBase}.`);
            }
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
        var cmd = {GOTO:'ONGOTO', THEN:'ONGOTO', GOSUB:'ONGOSUB'}[gotok.str]; // THEN only for DEC basic?
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
        // build call graph to detect cycles
        this.visitExpr(func, (expr:Expr) => {
            if (isLookup(expr) && expr.name.startsWith('FN')) {
                if (!this.fnrefs[lexpr.name])
                    this.fnrefs[lexpr.name] = [];
                this.fnrefs[lexpr.name].push(expr.name);
            }
        });
        this.checkCallGraph(lexpr.name, new Set());
        return { command:'DEF', lexpr:lexpr, def:func };
    }
    // detect cycles in call graph starting at function 'name'
    checkCallGraph(name: string, visited: Set<string>) {
        if (visited.has(name)) this.compileError(`There was a cycle in the function definition graph for ${name}.`);
        visited.add(name);
        var refs = this.fnrefs[name] || [];
        for (var ref of refs)
            this.checkCallGraph(ref, visited); // recurse
        visited.delete(name);
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
    stmt__CHANGE() : CHANGE_Statement {
        var src = this.parseExpr();
        this.expectToken('TO');
        var dest = this.parseLexpr();
        return { command:'CHANGE', src:src, dest:dest };
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
        this.optionCount++;
        switch (stmt.optname) {
            case 'DIALECT':
                if (this.optionCount > 1)
                    this.compileError(`OPTION DIALECT must be the first OPTION statement in the file.`);
                let dname = arg || "";
                let dialect = DIALECTS[dname.toUpperCase()];
                if (dialect) this.opts = dialect;
                else this.compileError(`OPTION DIALECT ${dname} is not supported by this compiler.`);
                break;
            case 'BASE':
                let base = parseInt(arg);
                if (base == 0 || base == 1) this.opts.defaultArrayBase = base;
                else this.compileError("OPTION BASE can only be 0 or 1.");
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
    chainAssignments : false,
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
    chainAssignments : false,
}


export const HP_TIMESHARED_BASIC : BASICOptions = {
    dialectName: "HP2000",
    asciiOnly : true,
    uppercaseOnly : false, // the terminal is usually uppercase
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
        'POS','RND','SGN','SIN','SPA','SQR','TAB','TAN','TIM','TYP','UPS$', // TODO: POS,
        'NFORMAT$', // non-standard, substitute for PRINT USING
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
    chainAssignments : true,
    // TODO: max line number, array index 9999
}

export const DEC_BASIC_11 : BASICOptions = {
    dialectName: "DEC11",
    asciiOnly : true,
    uppercaseOnly : true, // translates all lower to upper
    optionalLabels : false,
    optionalWhitespace : false,
    varNaming : "A1",
    staticArrays : true,
    sharedArrayNamespace : false,
    defaultArrayBase : 0,
    defaultArraySize : 11,
    defaultValues : true,
    stringConcat : true, // can also use &
    typeConvert : false,
    maxDimensions : 2,
    maxDefArgs : 255, // ?
    maxStringLength : 255,
    tickComments : false,
    hexOctalConsts : false,
    validKeywords : [
        'OPTION',
        'DATA','DEF','DIM','END','FOR','STEP','GOSUB','GOTO','GO','TO',
        'IF','THEN','INPUT','LET','NEXT','ON','PRINT','RANDOMIZE',
        'READ','REM','RESET','RESTORE','RETURN','STOP',
    ],
    validFunctions : [
        'ABS','ATN','COS','EXP','INT','LOG','LOG10','PI','RND','SGN','SIN','SQR','TAB',
        'ASC','BIN','CHR$','CLK$','DAT$','LEN','OCT','POS','SEG$','STR$','TRM$','VAL',
        'NFORMAT$', // non-standard, substitute for PRINT USING
    ],
    validOperators : [
        '=', '<>', '><', '<', '>', '<=', '>=', '+', '-', '*', '/', '^',
    ],
    printZoneLength : 14,
    numericPadding : true,
    checkOverflow : true, // non-fatal; subst 0 and continue
    testInitialFor : true,
    optionalNextVar : false,
    multipleNextVars : false,
    bitwiseLogic : false,
    checkOnGotoIndex : true, // might continue
    computedGoto : false,
    restoreWithLabel : false,
    squareBrackets : false,
    arraysContainChars : false,
    endStmtRequired : false,
    chainAssignments : false,
    // TODO: max line number 32767
    // TODO: \ separator, % int vars and constants, 'single' quoted
    // TODO: can't compare strings and numbers
}

export const DEC_BASIC_PLUS : BASICOptions = {
    dialectName: "DECPLUS",
    asciiOnly : true,
    uppercaseOnly : false,
    optionalLabels : false,
    optionalWhitespace : false,
    varNaming : "A1",
    staticArrays : true,
    sharedArrayNamespace : false,
    defaultArrayBase : 0,
    defaultArraySize : 11,
    defaultValues : true,
    stringConcat : true, // can also use "&"
    typeConvert : false,
    maxDimensions : 2,
    maxDefArgs : 255, // ?
    maxStringLength : 255,
    tickComments : true, // actually use "!"
    hexOctalConsts : false,
    validKeywords : [
        'OPTION',
        'REM','LET','DIM','RANDOM','RANDOMIZE','IF','THEN','ELSE',
        'FOR','TO','STEP','WHILE','UNTIL','NEXT','DEF','ON','GOTO','GOSUB',
        'RETURN','CHANGE','READ','DATA','RESTORE','PRINT','USING',
        'INPUT','LINE','NAME','AS','ERROR','RESUME','CHAIN','STOP','END',
        'MAT','UNLESS','SLEEP','WAIT',
    ],
    validFunctions : [
        'ABS','ATN','COS','EXP','INT','LOG','LOG10','PI','RND','SGN','SIN','SQR','TAB','TAN',
        'POS','TAB','ASCII','CHR$','CVT%$','CVTF$','CVT$%','CVT$F',
        'LEFT$','RIGHT$','MID$','LEN','INSTR','SPACE$','NUM$','VAL','XLATE',
        'DATE$','TIME$','TIME','ERR','ERL','SWAP%','RAD$',
        'NFORMAT$', // non-standard, substitute for PRINT USING
    ],
    validOperators : [
        '=', '<>', '<', '>', '<=', '>=', '+', '-', '*', '/', '^',
        '**', '==',
        'NOT', 'AND', 'OR', 'XOR', 'IMP', 'EQV',
    ],
    printZoneLength : 14,
    numericPadding : true,
    checkOverflow : true, // non-fatal; subst 0 and continue
    testInitialFor : true,
    optionalNextVar : false,
    multipleNextVars : false,
    bitwiseLogic : false,
    checkOnGotoIndex : true, // might continue
    computedGoto : false,
    restoreWithLabel : false,
    squareBrackets : false,
    arraysContainChars : false,
    endStmtRequired : false,
    chainAssignments : false, // TODO: can chain with "," not "="
    // TODO: max line number 32767
    // TODO: \ separator, % int vars and constants, 'single' quoted
    // TODO: can't compare strings and numbers
    // TODO: WHILE/UNTIL/FOR extra statements, etc
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
    chainAssignments : false,
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
    chainAssignments : false,
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
    chainAssignments : false,
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
    chainAssignments : false,
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
    chainAssignments : false,
}

// TODO: integer vars
// TODO: DEFINT/DEFSTR
// TODO: excess INPUT ignored, error msg

export const DIALECTS = {
    "DEFAULT":      ALTAIR_BASIC41,
    "ALTAIR":       ALTAIR_BASIC41,
    "ALTAIR4":      ALTAIR_BASIC41,
    "ALTAIR41":     ALTAIR_BASIC41,
    "TINY":         TINY_BASIC,
    "ECMA55":       ECMA55_MINIMAL,
    "MINIMAL":      ECMA55_MINIMAL,
    "HP":           HP_TIMESHARED_BASIC,
    "HPB":          HP_TIMESHARED_BASIC,
    "HPTSB":        HP_TIMESHARED_BASIC,
    "HP2000":       HP_TIMESHARED_BASIC,
    "HPBASIC":      HP_TIMESHARED_BASIC,
    "HPACCESS":     HP_TIMESHARED_BASIC,
    "DEC11":        DEC_BASIC_11,
    "DEC":          DEC_BASIC_PLUS,
    "DECPLUS":      DEC_BASIC_PLUS,
    "BASICPLUS":    DEC_BASIC_PLUS,
    "BASICODE":     BASICODE,
    "APPLESOFT":    APPLESOFT_BASIC,
    "BASIC80":      BASIC80,
    "MODERN":       MODERN_BASIC,
};
