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

const re_toks = /([0-9.]+[E][+-]?\d+)|(\d*[.]\d*[E0-9]*)|(\d+)|(['].*)|(\bAND\b)|(\bOR\b)|(\w+[$]?)|(".*?")|([<>]?[=<>])|([-+*/^,;:()])|(\S+)/gi;

export enum TokenType {
    EOL = 0,
    Float1,
    Float2,
    Int,
    Remark,
    And,
    Or,
    Ident,
    String,
    Relational,
    Operator,
    CatchAll,
    _LAST,
}

export type ExprTypes = BinOp | UnOp | IndOp | Literal;

export type Expr = ExprTypes & SourceLocated;

export type Opcode = 'add' | 'sub' | 'mul' | 'div' | 'pow' | 'eq' | 'ne' | 'lt' | 'gt' | 'le' | 'ge' | 'land' | 'lor';

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
    op: 'neg';
    expr: Expr;
}

export interface IndOp extends SourceLocated {
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

export interface IF_Statement {
    command: "IF";
    cond: Expr;
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

export interface DIM_Statement {
    command: "DIM";
    args: IndOp[];
}

export interface INPUT_Statement {
    command: "INPUT";
    prompt: Expr;
    args: IndOp[];
}

export interface READ_Statement {
    command: "INPUT";
    args: IndOp[];
}

export interface DEF_Statement {
    command: "DEF";
    lexpr: IndOp;
    def: Expr;
}

export interface ONGOTO_Statement {
    command: "ONGOTO";
    expr: Expr;
    labels: Expr[];
}

export interface DATA_Statement {
    command: "DATA";
    datums: Expr[];
}

export interface OPTION_Statement {
    command: "OPTION";
    optname: string;
    optargs: string[];
}

export type StatementTypes = PRINT_Statement | LET_Statement | GOTO_Statement | GOSUB_Statement
    | IF_Statement | FOR_Statement | DATA_Statement;

export type Statement = StatementTypes & SourceLocated;

export interface BASICLine {
    label: string;
    stmts: Statement[];
}

export interface BASICProgram {
    lines: BASICLine[];
}

class Token {
    str: string;
    type: TokenType;
    $loc: SourceLocation;
}

const OPERATORS = {
    'AND':  {f:'land',p:5},
    'OR':   {f:'lor',p:5},
    '=':    {f:'eq',p:10},
    '<>':   {f:'ne',p:10},
    '<':    {f:'lt',p:10},
    '>':    {f:'gt',p:10},
    '<=':   {f:'le',p:10},
    '>=':   {f:'ge',p:10},
    '+':    {f:'add',p:100},
    '-':    {f:'sub',p:100},
    '*':    {f:'mul',p:200},
    '/':    {f:'div',p:200},
    '^':    {f:'pow',p:300}
};

function getOpcodeForOperator(op: string): Opcode {
    return OPERATORS[op].f as Opcode;
}

function getPrecedence(tok: Token): number {
    switch (tok.type) {
        case TokenType.Operator:
        case TokenType.Relational:
        case TokenType.Ident:
            let op = OPERATORS[tok.str]
            if (op) return op.p;
    }
    return -1;
}

// is token an end of statement marker? (":" or end of line)
function isEOS(tok: Token) {
    return (tok.type == TokenType.EOL) || (tok.type == TokenType.Operator && tok.str == ':');
}

function stripQuotes(s: string) {
    // TODO: assert
    return s.substr(1, s.length-2);
}

// TODO
export interface BASICOptions {
    uppercaseOnly : boolean;            // convert everything to uppercase?
    strictVarNames : boolean;           // only allow A0-9 for numerics, single letter for arrays/strings
    sharedArrayNamespace : boolean;     // arrays and variables have same namespace? (conflict)
    defaultArrayBase : number;          // arrays start at this number (0 or 1)
    defaultArraySize : number;          // arrays are allocated w/ this size (starting @ 0)
    maxDimensions : number;             // max number of dimensions for arrays
    stringConcat : boolean;             // can concat strings with "+" operator?
    typeConvert : boolean;              // type convert strings <-> numbers?
    maxArguments : number;              // maximum # of arguments for user-defined functions
    sparseArrays : boolean;             // true == don't require DIM for arrays
    tickComments : boolean;             // support 'comments?
    validKeywords : string[];           // valid keywords (or null for accept all)
    validFunctions : string[];          // valid functions (or null for accept all)
    validOperators : string[];          // valid operators (or null for accept all)
    printZoneLength : number;           // print zone length
    printPrecision : number;            // print precision # of digits
    checkOverflow : boolean;            // check for overflow of numerics?
    defaultValues : boolean;            // initialize unset variables to default value? (0 or "")
}

///// BASIC PARSER

export class BASICParser {
    tokens: Token[];
    errors: WorkerError[];
    labels: { [label: string]: BASICLine };
    targets: { [targetlabel: string]: SourceLocation };
    eol: Token;
    lineno : number;
    curlabel: string;
    listings: CodeListingMap;
    lasttoken: Token;
    opts : BASICOptions = ALTAIR_BASIC40;

    constructor() {
        this.labels = {};
        this.targets = {};
        this.errors = [];
        this.lineno = 0;
        this.curlabel = null;
        this.listings = {};
    }
    compileError(msg: string, loc?: SourceLocation) {
        if (!loc) loc = this.peekToken().$loc;
        // TODO: pass SourceLocation to errors
        this.errors.push({line:loc.line, msg:msg});
        throw new CompileError(`${msg} (line ${loc.line})`); // TODO: label too?
    }
    dialectError(what: string, loc?: SourceLocation) {
        this.compileError(`The selected BASIC dialect doesn't support ${what}`, loc); // TODO
    }
    consumeToken(): Token {
        var tok = this.lasttoken = (this.tokens.shift() || this.eol);
        return tok;
    }
    expectToken(str: string) : Token {
        var tok = this.consumeToken();
        var tokstr = tok.str.toUpperCase();
        if (str != tokstr) {
            this.compileError(`I expected "${str}" here, but I saw "${tokstr}".`);
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
            case TokenType.Int:
                if (this.labels[tok.str] != null) this.compileError(`I saw a duplicated label "${tok.str}".`);
                this.labels[tok.str] = line;
                line.label = tok.str;
                this.curlabel = tok.str;
                break;
            default:
                // TODO
                this.pushbackToken(tok);
                break;
        }
    }
    parseFile(file: string, path: string) : BASICProgram {
        var pgmlines = file.split("\n").map((line) => this.parseLine(line));
        this.checkLabels();
        var program = { lines: pgmlines };
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
        var m;
        while (m = re_toks.exec(line)) {
            for (var i = 1; i < TokenType._LAST; i++) {
                let s = m[i];
                if (s != null) {
                    this.tokens.push({
                        str: s,
                        type: i,
                        $loc: { line: this.lineno, start: m.index, end: m.index+s.length }
                    });
                    break;
                }
            }
        }
        this.eol = { type: TokenType.EOL, str: "", $loc: { line: this.lineno, start: line.length } };
    }
    parse() : BASICLine {
        var line = {label: null, stmts: []};
        // not empty line?
        if (this.tokens.length) {
            this.parseOptLabel(line);
            line.stmts = this.parseCompoundStatement();
            this.curlabel = null;
        }
        return line;
    }
    parseCompoundStatement(): Statement[] {
        var list = this.parseList(this.parseStatement, ':');
        if (!isEOS(this.peekToken())) this.compileError(`Expected end of line or ':'`, this.peekToken().$loc);
        return list;
    }
    parseStatement(): Statement | null {
        var cmdtok = this.consumeToken();
        var stmt;
        switch (cmdtok.type) {
            case TokenType.Remark:
                if (!this.opts.tickComments) this.dialectError(`tick remarks`);
                return null;
            case TokenType.Ident:
                var cmd = cmdtok.str.toUpperCase();
                // remark? ignore to eol
                if (cmd == 'REM') {
                    while (this.consumeToken().type != TokenType.EOL) { }
                    return null;
                }
                // look for "GO TO"
                if (cmd == 'GO' && this.peekToken().str == 'TO') {
                    this.consumeToken();
                    cmd = 'GOTO';
                }
                var fn = this['stmt__' + cmd];
                if (fn) {
                    if (this.opts.validKeywords && this.opts.validKeywords.indexOf(cmd) < 0)
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
                this.compileError(`I expected a command here`);
                return null;
            default:
                this.compileError(`Unknown command "${cmdtok.str}"`);
                return null;
        }
        if (stmt) stmt.$loc = { line: cmdtok.$loc.line, start: cmdtok.$loc.start, end: this.peekToken().$loc.start };
        return stmt;
    }
    parseVarOrIndexedOrFunc(): IndOp {
        return this.parseVarOrIndexed();
    }
    parseVarOrIndexed(): IndOp {
        var tok = this.consumeToken();
        switch (tok.type) {
            case TokenType.Ident:
                let args = null;
                if (this.peekToken().str == '(') {
                    this.expectToken('(');
                    args = this.parseExprList();
                    this.expectToken(')');
                }
                return { name: tok.str, args: args, $loc: tok.$loc };
            default:
                this.compileError("Expected variable or array index");
                break;
        }
    }
    parseList<T>(parseFunc:()=>T, delim:string): T[] {
        var sep;
        var list = [];
        do {
            var el = parseFunc.bind(this)()
            if (el != null) list.push(el);
            sep = this.consumeToken();
        } while (sep.str == delim);
        this.pushbackToken(sep);
        return list;
    }
    parseVarOrIndexedList(): IndOp[] {
        return this.parseList(this.parseVarOrIndexed, ',');
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
            case TokenType.Int:
                var label = parseInt(tok.str).toString();
                this.targets[label] = tok.$loc;
                return {value:label};
            default:
                this.compileError(`I expected a line number here`);
                return;
        }
    }
    parsePrimary(): Expr {
        let tok = this.consumeToken();
        switch (tok.type) {
            case TokenType.Int:
            case TokenType.Float1:
            case TokenType.Float2:
                return { value: parseFloat(tok.str), $loc: tok.$loc };
            case TokenType.String:
                return { value: stripQuotes(tok.str), $loc: tok.$loc };
            case TokenType.Ident:
                this.pushbackToken(tok);
                return this.parseVarOrIndexedOrFunc();
            case TokenType.Operator:
                if (tok.str == '(') {
                    let expr = this.parseExpr();
                    this.expectToken(')');
                    return expr;
                } else if (tok.str == '-') {
                    let expr = this.parsePrimary(); // TODO: -2^2=-4 and -2-2=-4
                    return { op: 'neg', expr: expr };
                } else if (tok.str == '+') {
                    return this.parsePrimary(); // TODO?
                }
            default:
                this.compileError(`Unexpected "${tok.str}"`);
        }
    }
    parseExpr1(left: Expr, minPred: number): Expr {
        let look = this.peekToken();
        while (getPrecedence(look) >= minPred) {
            let op = this.consumeToken();
            let right: Expr = this.parsePrimary();
            look = this.peekToken();
            while (getPrecedence(look) > getPrecedence(op)) {
                right = this.parseExpr1(right, getPrecedence(look));
                look = this.peekToken();
            }
            left = { op: getOpcodeForOperator(op.str), left: left, right: right };
        }
        return left;
    }
    parseExpr(): Expr {
        return this.parseExpr1(this.parsePrimary(), 0);
    }

    //// STATEMENTS

    stmt__LET(): LET_Statement {
        var lexpr = this.parseVarOrIndexed();
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
    stmt__FOR() : FOR_Statement {
        var lexpr = this.parseVarOrIndexed(); // TODO: parseNumVar()
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
        return { command:'DIM', args:this.parseVarOrIndexedList() };
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
        return { command:'INPUT', prompt:{ value: promptstr, $loc: prompt.$loc }, args:this.parseVarOrIndexedList() };
    }
    stmt__DATA() : DATA_Statement {
        return { command:'DATA', datums:this.parseExprList() };
    }
    stmt__READ() {
        return { command:'READ', args:this.parseVarOrIndexedList() };
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
        var lexpr = this.parseVarOrIndexed();
        if (!lexpr.name.toUpperCase().startsWith('FN')) this.compileError(`Functions defined with DEF must begin with the letters "FN".`)
        this.expectToken("=");
        var func = this.parseExpr();
        return { command:'DEF', lexpr:lexpr, def:func };
    }
    stmt__OPTION() : OPTION_Statement {
        var tokname = this.consumeToken();
        if (tokname.type != TokenType.Ident) this.compileError(`I expected a name after the OPTION statement.`)
        var list : string[] = [];
        var tok;
        do {
            tok = this.consumeToken();
            if (isEOS(tok)) break;
            list.push(tok.str.toUpperCase());
        } while (true);
        return { command:'OPTION', optname:tokname.str.toUpperCase(), optargs:list };
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
    checkLabels() {
        for (let targ in this.targets) {
            if (this.labels[targ] == null) {
                this.compileError(`I couldn't find line number ${targ}`, this.targets[targ]);
            }
        }
    }
}

///// BASIC DIALECTS

// TODO

export const ECMA55_MINIMAL : BASICOptions = {
    uppercaseOnly : true,
    strictVarNames : true,
    sharedArrayNamespace : true,
    defaultArrayBase : 0,
    defaultArraySize : 11,
    defaultValues : false,
    stringConcat : false,
    typeConvert : false,
    maxDimensions : 2,
    maxArguments : Infinity,
    sparseArrays : false,
    tickComments : false,
    validKeywords : ['BASE','DATA','DEF','DIM','END',
        'FOR','GO','GOSUB','GOTO','IF','INPUT','LET','NEXT','ON','OPTION','PRINT',
        'RANDOMIZE','READ','REM','RESTORE','RETURN','STEP','STOP','SUB','THEN','TO'
    ],
    validFunctions : ['ABS','ATN','COS','EXP','INT','LOG','RND','SGN','SIN','SQR','TAN'],
    validOperators : ['=', '<>', '<', '>', '<=', '>=', '+', '-', '*', '/', '^'],
    printZoneLength : 15,
    printPrecision : 6,
    checkOverflow : true,
}

export const ALTAIR_BASIC40 : BASICOptions = {
    uppercaseOnly : true,
    strictVarNames : true,
    sharedArrayNamespace : true,
    defaultArrayBase : 0,
    defaultArraySize : 11,
    defaultValues : false,
    stringConcat : false,
    typeConvert : false,
    maxDimensions : 2,
    maxArguments : Infinity,
    sparseArrays : false,
    tickComments : false,
    validKeywords : null, // all
    validFunctions : null, // all
    validOperators : null, // all ['\\','MOD','NOT','AND','OR','XOR','EQV','IMP'],
    printZoneLength : 15,
    printPrecision : 6,
    checkOverflow : true,
}
