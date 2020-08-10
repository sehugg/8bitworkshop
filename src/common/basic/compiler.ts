import { WorkerError, CodeListingMap, SourceLocation } from "../workertypes";

export interface SourceLocated {
    $loc?: SourceLocation;
}

class CompileError extends Error {
    constructor(msg: string) {
        super(msg);
        Object.setPrototypeOf(this, CompileError.prototype);
    }
}

// Lexer regular expression -- each (capture group) handles a different token type

const re_toks = /([0-9.]+[E][+-]?\d+)|(\d*[.]\d*[E0-9]*)|[0]*(\d+)|(['].*)|(\w+[$]?)|(".*?")|([<>]?[=<>])|([-+*/^,;:()?\\])|(\S+)/gi;

export enum TokenType {
    EOL = 0,
    Float1,
    Float2,
    Int,
    Remark,
    Ident,
    String,
    Relational,
    Operator,
    CatchAll,
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

export interface ONGOTO_Statement {
    command: "ONGOTO";
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

export interface INPUT_Statement {
    command: "INPUT";
    prompt: Expr;
    args: IndOp[];
}

export interface DATA_Statement {
    command: "DATA";
    datums: Expr[];
}

export interface READ_Statement {
    command: "READ";
    args: IndOp[];
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

export interface GET_Statement {
    command: "GET";
    lexpr: IndOp;
}

export interface NoArgStatement {
    command: string;
}

export type StatementTypes = PRINT_Statement | LET_Statement | GOTO_Statement | GOSUB_Statement
    | IF_Statement | FOR_Statement | NEXT_Statement | DIM_Statement
    | INPUT_Statement | READ_Statement | DEF_Statement | ONGOTO_Statement
    | DATA_Statement | OPTION_Statement | NoArgStatement;

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
    'OR':   {f:'lor',p:7}, // or "bor"
    'AND':  {f:'land',p:8}, // or "band"
    '=':    {f:'eq',p:50},
    '<>':   {f:'ne',p:50},
    '<':    {f:'lt',p:50},
    '>':    {f:'gt',p:50},
    '<=':   {f:'le',p:50},
    '>=':   {f:'ge',p:50},
    '+':    {f:'add',p:100},
    '-':    {f:'sub',p:100},
    '%':    {f:'mod',p:140},
    '\\':   {f:'idiv',p:150},
    '*':    {f:'mul',p:200},
    '/':    {f:'div',p:200},
    '^':    {f:'pow',p:300}
};

function getOperator(op: string) {
    return OPERATORS[op];
}

function getPrecedence(tok: Token): number {
    switch (tok.type) {
        case TokenType.Operator:
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

// TODO: implement these
export interface BASICOptions {
    dialectName : string;               // use this to select the dialect 
    asciiOnly : boolean;                // reject non-ASCII chars?
    uppercaseOnly : boolean;            // convert everything to uppercase?
    optionalLabels : boolean;			// can omit line numbers and use labels?
    strictVarNames : boolean;           // only allow A0-9 for numerics, single letter for arrays/strings
    tickComments : boolean;             // support 'comments?
    defaultValues : boolean;            // initialize unset variables to default value? (0 or "")
    sharedArrayNamespace : boolean;     // arrays and variables have same namespace? (conflict)
    defaultArrayBase : number;          // arrays start at this number (0 or 1) (TODO: check)
    defaultArraySize : number;          // arrays are allocated w/ this size (starting @ 0)
    stringConcat : boolean;             // can concat strings with "+" operator?
    typeConvert : boolean;              // type convert strings <-> numbers? (TODO)
    checkOverflow : boolean;            // check for overflow of numerics?
    sparseArrays : boolean;             // true == don't require DIM for arrays (TODO)
    printZoneLength : number;           // print zone length
    numericPadding : boolean;           // " " or "-" before and " " after numbers?
    outOfOrderNext : boolean;           // can we skip a NEXT statement? (can't interleave tho)
    multipleNextVars : boolean;         // NEXT Y,X (TODO)
    ifElse : boolean;                   // IF...ELSE construct
    bitwiseLogic : boolean;             // -1 = TRUE, 0 = FALSE, AND/OR/NOT done with bitwise ops
    maxDimensions : number;             // max number of dimensions for arrays
    maxDefArgs : number;                // maximum # of arguments for user-defined functions
    maxStringLength : number;           // maximum string length in chars
    validKeywords : string[];           // valid keywords (or null for accept all)
    validFunctions : string[];          // valid functions (or null for accept all)
    validOperators : string[];          // valid operators (or null for accept all)
    commandsPerSec? : number;           // how many commands per second?
}

///// BASIC PARSER

export class BASICParser {
    opts : BASICOptions = ALTAIR_BASIC40;
    errors: WorkerError[];
    listings: CodeListingMap;
    labels: { [label: string]: BASICLine };
    targets: { [targetlabel: string]: SourceLocation };
    decls: { [name: string]: SourceLocation }; // declared/set vars
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
        this.decls = {};
        this.refs = {};
    }
    compileError(msg: string, loc?: SourceLocation) {
        if (!loc) loc = this.peekToken().$loc;
        // TODO: pass SourceLocation to errors
        this.errors.push({path:loc.path, line:loc.line, label:loc.label, msg:msg});
        throw new CompileError(`${msg} (line ${loc.line})`); // TODO: label too?
    }
    dialectError(what: string, loc?: SourceLocation) {
        this.compileError(`The selected BASIC dialect doesn't support ${what}.`, loc); // TODO
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
            case TokenType.Float1:
            case TokenType.Float2:
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
        var pgmlines = file.split("\n").map((line) => this.parseLine(line));
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
        var m : RegExpMatchArray;
        while (m = re_toks.exec(line)) {
            for (var i = 1; i < TokenType._LAST; i++) {
                let s : string = m[i];
                if (s != null) {
                    // maybe we don't support unicode in 1975?
                    if (this.opts.asciiOnly && !/^[\x00-\x7F]*$/.test(s))
                        this.dialectError(`non-ASCII characters`);
                    // uppercase all identifiers, and maybe more
                    if (i == TokenType.Ident || this.opts.uppercaseOnly)
                        s = s.toUpperCase();
                    // add token to list
                    this.tokens.push({
                        str: s,
                        type: i,
                        $loc: { path: this.path, line: this.lineno, start: m.index, end: m.index+s.length, label: this.curlabel }
                    });
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
                if (!this.opts.tickComments) this.dialectError(`tick remarks`);
                return null;
            case TokenType.Operator:
                if (cmd == this.validKeyword('?')) cmd = 'PRINT';
            case TokenType.Ident:
                // remark? ignore all tokens to eol
                if (cmd == 'REM') {
                    while (this.consumeToken().type != TokenType.EOL) { }
                    return null;
                }
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
        var list = this.parseList(this.parseLexpr, ',');
        list.forEach((lexpr) => this.decls[lexpr.name] = this.lasttoken.$loc);
        return list;
    }
    parseExprList(): Expr[] {
        return this.parseList(this.parseExpr, ',');
    }
    parseLabelList(): Expr[] {
        return this.parseList(this.parseLabel, ',');
    }
    parseLabel() : Expr {
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
    parsePrimary(): Expr {
        let tok = this.consumeToken();
        switch (tok.type) {
            case TokenType.Int:
            case TokenType.Float1:
            case TokenType.Float2:
                return { value: this.parseNumber(tok.str)/*, $loc: tok.$loc*/ };
            case TokenType.String:
                return { value: stripQuotes(tok.str)/*, $loc: tok.$loc*/ };
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
            case TokenType.EOL:
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
            if (this.opts.bitwiseLogic && opfn == 'land') opfn = 'band';
            if (this.opts.bitwiseLogic && opfn == 'lor') opfn = 'bor';
            left = { op:opfn, left: left, right: right };
        }
        return left;
    }
    parseExpr(): Expr {
        return this.parseExpr1(this.parsePrimary(), 0);
    }
    validateVarName(lexpr: IndOp) {
        if (this.opts.strictVarNames) {
            if (lexpr.args == null && !/^[A-Z][0-9]?[$]?$/.test(lexpr.name))
                this.dialectError(`variable names other than a letter followed by an optional digit`);
            if (lexpr.args != null && !/^[A-Z]?[$]?$/.test(lexpr.name))
                this.dialectError(`array names other than a single letter`);
        }
    }

    //// STATEMENTS

    stmt__LET(): LET_Statement {
        var lexpr = this.parseLexpr();
        this.expectToken("=");
        this.decls[lexpr.name] = this.lasttoken.$loc;
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
    stmt__GOTO(): GOTO_Statement {
        return { command: "GOTO", label: this.parseLabel() };
    }
    stmt__GOSUB(): GOSUB_Statement {
        return { command: "GOSUB", label: this.parseLabel() };
    }
    stmt__IF(): IF_Statement {
        var cond = this.parseExpr();
        var iftrue: Statement[];
        this.expectToken('THEN');
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
        if (!this.opts.ifElse) this.dialectError(`IF...ELSE statements`);
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
        var lexpr = this.parseLexpr(); // TODO: parseNumVar()
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
        if (!isEOS(this.peekToken())) {
            lexpr = this.parseExpr();
        }
        return { command:'NEXT', lexpr:lexpr };
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
            this.expectToken(';');
            promptstr = stripQuotes(prompt.str);
        } else {
            this.pushbackToken(prompt);
            promptstr = "";
        }
        return { command:'INPUT', prompt:{ value: promptstr }, args:this.parseLexprList() };
    }
    stmt__DATA() : DATA_Statement {
        return { command:'DATA', datums:this.parseExprList() };
    }
    stmt__READ() : READ_Statement {
        return { command:'READ', args:this.parseLexprList() };
    }
    stmt__RESTORE() {
        return { command:'RESTORE' };
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
    stmt__ON() : ONGOTO_Statement {
        var expr = this.parseExpr();
        this.expectToken('GOTO');
        var labels = this.parseLabelList();
        return { command:'ONGOTO', expr:expr, labels:labels };
    }
    stmt__DEF() : DEF_Statement {
        var lexpr = this.parseVarSubscriptOrFunc();
        if (lexpr.args && lexpr.args.length > this.opts.maxDefArgs)
            this.compileError(`There can be no more than ${this.opts.maxDefArgs} arguments to a function or subscript.`);
        if (!lexpr.name.startsWith('FN')) this.compileError(`Functions defined with DEF must begin with the letters "FN".`)
        this.expectToken("=");
        this.decls[lexpr.name] = this.lasttoken.$loc;
        var func = this.parseExpr();
        return { command:'DEF', lexpr:lexpr, def:func };
    }
    stmt__POP() : NoArgStatement {
        return { command:'POP' };
    }
    stmt__GET() : GET_Statement {
        var lexpr = this.parseLexpr();
        this.decls[lexpr.name] = this.lasttoken.$loc;
        return { command:'GET', lexpr:lexpr };
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
                this.compileError(`OPTION ${stmt.optname} is not supported by this compiler.`);
                break;
        }
    }
    
    // for workermain
    generateListing(file: string, program: BASICProgram) {
        var srclines = [];
        var pc = 0;
        program.lines.forEach((line, idx) => {
            srclines.push({offset: pc, line: idx+1});
            pc += line.stmts.length;
        });
        return { lines: srclines };
    }
    getListings() : CodeListingMap {
        return this.listings;
    }

    // LINT STUFF
    checkAll(program : BASICProgram) {
        this.checkLabels();
        //this.checkUnsetVars();
    }
    checkLabels() {
        for (let targ in this.targets) {
            if (this.labels[targ] == null) {
                this.compileError(`There isn't a line number ${targ}.`, this.targets[targ]);
            }
        }
    }
    checkUnsetVars() {
        for (var ref in this.refs) {
            if (this.decls[ref] == null)
                this.compileError(`The variable "${ref}" was used but not set with a LET, DIM, READ, or INPUT statement.`);
        }
    }
}

///// BASIC DIALECTS

// TODO

export const ECMA55_MINIMAL : BASICOptions = {
    dialectName: "ECMA55",
    asciiOnly : true,
    uppercaseOnly : true,
    optionalLabels : false,
    strictVarNames : true,
    sharedArrayNamespace : true,
    defaultArrayBase : 0,
    defaultArraySize : 11,
    defaultValues : false,
    stringConcat : false,
    typeConvert : false,
    maxDimensions : 2,
    maxDefArgs : 255,
    maxStringLength : 255,
    sparseArrays : false,
    tickComments : false,
    validKeywords : ['BASE','DATA','DEF','DIM','END',
        'FOR','GO','GOSUB','GOTO','IF','INPUT','LET','NEXT','ON','OPTION','PRINT',
        'RANDOMIZE','READ','REM','RESTORE','RETURN','STEP','STOP','SUB','THEN','TO'
    ],
    validFunctions : ['ABS','ATN','COS','EXP','INT','LOG','RND','SGN','SIN','SQR','TAB','TAN'],
    validOperators : ['=', '<>', '<', '>', '<=', '>=', '+', '-', '*', '/', '^'],
    printZoneLength : 15,
    numericPadding : true,
    checkOverflow : true,
    outOfOrderNext : false,
    multipleNextVars : false,
    ifElse : false,
    bitwiseLogic : false,
}

export const ALTAIR_BASIC40 : BASICOptions = {
    dialectName: "ALTAIR40",
    asciiOnly : true,
    uppercaseOnly : true,
    optionalLabels : false,
    strictVarNames : false,
    sharedArrayNamespace : true,
    defaultArrayBase : 0,
    defaultArraySize : 11,
    defaultValues : true,
    stringConcat : true,
    typeConvert : false,
    maxDimensions : 128, // "as many as will fit on a single line" ... ?
    maxDefArgs : 255,
    maxStringLength : 255,
    sparseArrays : false,
    tickComments : false,
    validKeywords : null, // all
    validFunctions : null, // all
    validOperators : null, // all ['\\','MOD','NOT','AND','OR','XOR','EQV','IMP'],
    printZoneLength : 15,
    numericPadding : true,
    checkOverflow : true,
    outOfOrderNext : true,
    multipleNextVars : true, // TODO: not supported
    ifElse : true,
    bitwiseLogic : true,
}

export const APPLESOFT_BASIC : BASICOptions = {
    dialectName: "APPLESOFT",
    asciiOnly : true,
    uppercaseOnly : false,
    optionalLabels : false,
    strictVarNames : false, // TODO: first two alphanum chars
    sharedArrayNamespace : false,
    defaultArrayBase : 0,
    defaultArraySize : 9, // A(0) to A(8)
    defaultValues : true,
    stringConcat : true,
    typeConvert : false,
    maxDimensions : 88,
    maxDefArgs : 1, // TODO: no string FNs
    maxStringLength : 255,
    sparseArrays : false,
    tickComments : false,
    validKeywords : null, // all
    validFunctions : ['ABS','ATN','COS','EXP','INT','LOG','RND','SGN','SIN','SQR','TAN',
                      'LEN','LEFT$','MID$','RIGHT$','STR$','VAL','CHR$','ASC',
                      'FRE','SCRN','PDL','PEEK'], // TODO
    validOperators : ['=', '<>', '<', '>', '<=', '>=', '+', '-', '*', '/', '^', 'AND', 'NOT', 'OR'],
    printZoneLength : 16,
    numericPadding : false,
    checkOverflow : true,
    outOfOrderNext : true,
    multipleNextVars : false,
    ifElse : false,
    bitwiseLogic : false,
}

export const MAX8_BASIC : BASICOptions = {
    dialectName: "MAX8",
    asciiOnly : false,
    uppercaseOnly : false,
    optionalLabels : true,
    strictVarNames : false, // TODO: first two alphanum chars
    sharedArrayNamespace : false,
    defaultArrayBase : 0,
    defaultArraySize : 11,
    defaultValues : false,
    stringConcat : true,
    typeConvert : true,
    maxDimensions : 255,
    maxDefArgs : 255, // TODO: no string FNs
    maxStringLength : 1024, // TODO?
    sparseArrays : false,
    tickComments : true,
    validKeywords : null, // all
    validFunctions : null, // all
    validOperators : null, // all
    printZoneLength : 15,
    numericPadding : false,
    checkOverflow : true,
    outOfOrderNext : true,
    multipleNextVars : true,
    ifElse : true,
    bitwiseLogic : true,
}

// TODO: integer vars

export const DIALECTS = {
    "DEFAULT":      ALTAIR_BASIC40,
    "ALTAIR":       ALTAIR_BASIC40,
    "ALTAIR40":     ALTAIR_BASIC40,
    "ECMA55":       ECMA55_MINIMAL,
    "MINIMAL":      ECMA55_MINIMAL,
    "APPLESOFT":    APPLESOFT_BASIC,
};
