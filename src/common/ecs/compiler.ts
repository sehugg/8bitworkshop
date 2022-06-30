
import { mergeLocs, Token, Tokenizer, TokenType } from "../tokenizer";
import { SourceLocated, SourceLocation } from "../workertypes";
import { newDecoder } from "./decoder";
import { Action, ActionContext, ArrayType, CodeLiteralNode, CodePlaceholderNode, ComponentType, DataField, DataType, DataValue, ECSError, Entity, EntityArchetype, EntityManager, EntityScope, IntType, Query, RefType, SelectType, SELECT_TYPE, SourceFileExport, System, SystemInstance, SystemInstanceParameters, ComponentFieldPair, Expr, ExprBase, ForwardRef, isLiteral, EntityFieldOp, LExpr, Statement, QueryExpr } from "./ecs";

export enum ECSTokenType {
    Ellipsis = 'ellipsis',
    Operator = 'operator',
    Relational = 'relational',
    QuotedString = 'quoted-string',
    Integer = 'integer',
    CodeFragment = 'code-fragment',
    Placeholder = 'placeholder',
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
};

function getOperator(op: string) {
    return (OPERATORS as any)[op];
}

function getPrecedence(tok: Token): number {
    switch (tok.type) {
        case ECSTokenType.Operator:
        case ECSTokenType.Relational:
        case TokenType.Ident:
            let op = getOperator(tok.str);
            if (op) return op.p;
    }
    return -1;
}

// is token an end of statement marker? (":" or end of line)
function isEOS(tok: Token) {
    return tok.type == TokenType.EOL || tok.type == TokenType.Comment
        || tok.str == ':' || tok.str == 'ELSE'; // TODO: only ELSE if ifElse==true
}

///

export class ECSCompiler extends Tokenizer {

    currentScope: EntityScope | null = null;
    currentContext: ActionContext | null = null;
    includeDebugInfo = false;

    constructor(
        public readonly em: EntityManager,
        public readonly isMainFile: boolean) {
        super();
        //this.includeEOL = true;
        this.setTokenRules([
            { type: ECSTokenType.Ellipsis, regex: /\.\./ },
            { type: ECSTokenType.QuotedString, regex: /".*?"/ },
            { type: ECSTokenType.CodeFragment, regex: /---.*?---/ },
            { type: ECSTokenType.Integer, regex: /0[xX][A-Fa-f0-9]+/ },
            { type: ECSTokenType.Integer, regex: /\$[A-Fa-f0-9]+/ },
            { type: ECSTokenType.Integer, regex: /[%][01]+/ },
            { type: ECSTokenType.Integer, regex: /\d+/ },
            { type: ECSTokenType.Relational, regex: /[=<>][=<>]?/ },
            { type: ECSTokenType.Operator, regex: /[.#,:(){}\[\]\-\+]/ },
            { type: TokenType.Ident, regex: /[A-Za-z_][A-Za-z0-9_]*/ },
            { type: TokenType.Ignore, regex: /\/\/.*?[\n\r]/ },
            { type: TokenType.Ignore, regex: /\/\*.*?\*\// },
            { type: TokenType.EOL, regex: /[\n\r]+/ },
            { type: TokenType.Ignore, regex: /\s+/ },
        ]);
        this.errorOnCatchAll = true;
    }

    annotate<T extends SourceLocated>(fn: () => T) {
        let start = this.peekToken();
        let obj = fn();
        let end = this.lasttoken;
        let $loc = end ? mergeLocs(start.$loc, end.$loc) : start.$loc;
        if (obj) (obj as SourceLocated).$loc = $loc;
        return obj;
    }

    parseFile(text: string, path: string) {
        this.tokenizeFile(text, path);
        while (!this.isEOF()) {
            let top = this.parseTopLevel();
            if (top) {
                let t = top;
                this.annotate(() => t); // TODO? typescript bug?
            }
        }
        this.runDeferred();
    }

    getImportFile: (path: string) => string;

    importFile(path: string) {
        if (!this.em.imported[path]) { // already imported?
            let text = this.getImportFile && this.getImportFile(path);
            if (!text) this.compileError(`I can't find the import file "${path}".`);
            this.em.imported[path] = true;
            let comp = new ECSCompiler(this.em, false);
            comp.includeDebugInfo = this.includeDebugInfo; // TODO: clone compiler
            try {
                comp.parseFile(text, path);
            } catch (e) {
                for (var err of comp.errors) this.errors.push(err);
                throw e;
            }
        }
    }

    parseTopLevel() {
        //this.skipBlankLines();
        let tok = this.expectTokens(['component', 'system', 'scope', 'resource', 'import', 'demo', 'comment']);
        if (tok.str == 'component') {
            return this.em.defineComponent(this.parseComponentDefinition());
        }
        if (tok.str == 'system') {
            return this.em.defineSystem(this.parseSystem());
        }
        if (tok.str == 'scope') {
            return this.parseScope();
        }
        if (tok.str == 'resource') {
            return this.em.defineSystem(this.parseResource());
        }
        if (tok.str == 'import') {
            let tok = this.expectTokenTypes([ECSTokenType.QuotedString]);
            let path = tok.str.substring(1, tok.str.length - 1);
            return this.importFile(path);
        }
        if (tok.str == 'demo') {
            if (this.isMainFile) {
                let scope = this.parseScope();
                scope.isDemo = true;
                this.expectToken('demo');
                return scope;
            } else {
                this.skipDemo(); // don't even parse it, just skip it
                return;
            }
        }
        if (tok.str == 'comment') {
            this.expectTokenTypes([ECSTokenType.CodeFragment]);
            return;
        }
        this.compileError(`Unexpected top-level keyword: ${tok.str}`);
    }

    skipDemo() {
        var tok;
        while ((tok = this.consumeToken()) && !this.isEOF()) {
            if (tok.str == 'end' && this.peekToken().str == 'demo') {
                this.consumeToken();
                return;
            }
        }
        throw new ECSError(`Expected "end demo" after a "demo" declaration.`);
    }

    parseComponentDefinition(): ComponentType {
        let name = this.expectIdent().str;
        let fields = [];
        this.em.deferComponent(name);
        while (this.peekToken().str != 'end') {
            fields.push(this.parseComponentField());
        }
        this.expectToken('end');
        return { name, fields };
    }

    parseComponentField(): DataField {
        let name = this.expectIdent();
        this.expectToken(':', 'I expected either a ":" or "end" here.'); // TODO
        let type = this.parseDataType();
        return { name: name.str, $loc: name.$loc, ...type };
    }

    parseDataType(): DataType {
        if (this.peekToken().type == 'integer') {
            let lo = this.parseIntegerConstant();
            this.expectToken('..');
            let hi = this.parseIntegerConstant();
            this.checkLowerLimit(lo, -0x80000000, "lower int range");
            this.checkUpperLimit(hi, 0x7fffffff, "upper int range");
            this.checkUpperLimit(hi-lo, 0xffffffff, "int range");
            this.checkLowerLimit(hi, lo, "int range");
            // TODO: use default value?
            let defvalue;
            if (this.ifToken('default')) {
                defvalue = this.parseIntegerConstant();
            }
            // TODO: check types
            return { dtype: 'int', lo, hi, defvalue } as IntType;
        }
        if (this.peekToken().str == '[') {
            return { dtype: 'ref', query: this.parseQuery() } as RefType;
        }
        if (this.ifToken('array')) {
            let index: IntType | undefined = undefined;
            if (this.peekToken().type == ECSTokenType.Integer) {
                index = this.parseDataType() as IntType;
            }
            this.expectToken('of');
            let elem = this.parseDataType();
            let baseoffset;
            if (this.ifToken('baseoffset')) {
                baseoffset = this.parseIntegerConstant();
                this.checkLowerLimit(baseoffset, -32768, "base offset");
                this.checkUpperLimit(baseoffset, 32767, "base offset");
            }
            return { dtype: 'array', index, elem, baseoffset } as ArrayType;
        }
        if (this.ifToken('enum')) {
            this.expectToken('[');
            let enumtoks = this.parseList(this.parseEnumIdent, ',');
            this.expectToken(']');
            if (enumtoks.length == 0) this.compileError(`must define at least one enum`);
            let lo = 0;
            let hi = enumtoks.length-1;
            this.checkLowerLimit(hi, 0, "enum count");
            this.checkUpperLimit(hi, 255, "enum count");
            let enums : {[name:string]:number} = {};
            for (let i=0; i<=hi; i++)
                enums[enumtoks[i].str] = i;
            // TODO: use default value?
            let defvalue;
            if (this.ifToken('default')) {
                defvalue = this.parseIntegerConstant();
            }
            return { dtype: 'int', lo, hi, defvalue, enums } as IntType;
        }
        throw this.compileError(`I expected a data type here.`);
    }

    parseEnumIdent() {
        let tok = this.expectTokenTypes([TokenType.Ident]);
        return tok;
    }
    parseEnumValue(tok: Token, field: IntType) {
        if (!field.enums) throw new ECSError(`field is not an enum`);
        let value = field.enums[tok.str];
        if (value == null) throw new ECSError(`unknown enum "${tok.str}"`);
        return value;
    }

    parseDataValue(field: DataField): DataValue | ForwardRef {
        let tok = this.peekToken();
        // TODO: move to expr
        if (tok.type == TokenType.Ident && field.dtype == 'int') {
            return this.parseEnumValue(this.consumeToken(), field);
        }
        if (tok.type == TokenType.Ident) {
            let entity = this.currentScope?.getEntityByName(tok.str);
            if (!entity)
                this.compileError('no entity named "${tok.str}"');
            else {
                this.consumeToken();
                this.expectToken('.');
                let fieldName = this.expectIdent().str;
                let constValue = this.currentScope?.getConstValue(entity, fieldName);
                if (constValue == null)
                    throw new ECSError(`"${fieldName}" is not defined as a constant`, entity);
                else
                    return constValue;
            }
        }
        if (tok.str == '[') {
            // TODO: 16-bit?
            return new Uint8Array(this.parseDataArray());
        }
        if (tok.str == '#') {
            this.consumeToken();
            let reftype = field.dtype == 'ref' ? field as RefType : undefined;
            return this.parseEntityForwardRef(reftype);
        }
        // TODO?
        return this.parseIntegerConstant();
        // TODO: throw this.compileError(`I expected a ${field.dtype} here.`);
    }

    parseEntityForwardRef(reftype?: RefType): ForwardRef {
        let token = this.expectIdent();
        return { reftype, token };
    }

    parseDataArray() {
        this.expectToken('[');
        let arr = this.parseList(this.parseIntegerConstant, ',');
        this.expectToken(']');
        return arr;
    }

    expectInteger(): number {
        let s = this.consumeToken().str;
        let i: number;
        if (s.startsWith('$'))
            i = parseInt(s.substring(1), 16); // hex $...
        else if (s.startsWith('%'))
            i = parseInt(s.substring(1), 2); // binary %...
        else
            i = parseInt(s); // default base 10 or 16 (0x...)
        if (isNaN(i)) this.compileError('There should be an integer here.');
        return i;
    }

    parseSystem(): System {
        let name = this.expectIdent().str;
        let actions: Action[] = [];
        let system: System = { name, actions };
        let cmd;
        while ((cmd = this.expectTokens(['on', 'locals', 'end']).str) != 'end') {
            if (cmd == 'on') {
                let action = this.annotate(() => this.parseAction(system));
                actions.push(action);
            } else if (cmd == 'locals') {
                system.tempbytes = this.parseIntegerConstant();
            } else {
                this.compileError(`Unexpected system keyword: ${cmd}`);
            }
        }
        return system;
    }

    parseResource(): System {
        let name = this.expectIdent().str;
        let tempbytes;
        if (this.peekToken().str == 'locals') {
            this.consumeToken();
            tempbytes = this.parseIntegerConstant();
        }
        let system: System = { name, tempbytes, actions: [] };
        let expr = this.annotate(() => this.parseBlockStatement());
        let action: Action = { expr, event: name };
        system.actions.push(action);
        return system;
    }

    parseAction(system: System): Action {
        // TODO: unused events?
        const event = this.expectIdent().str;
        this.expectToken('do');
        let fitbytes = undefined;
        let critical = undefined;
        if (this.ifToken('critical')) critical = true;
        if (this.ifToken('fit')) fitbytes = this.parseIntegerConstant();
        let expr = this.annotate(() => this.parseBlockStatement());
        //query, join, select, direction, 
        let action : Action = { expr, event, fitbytes, critical };
        return action as Action;
    }

    parseQuery() {
        let q: Query = { include: [] };
        let start = this.expectToken('[');
        this.parseList(() => this.parseQueryItem(q), ',');
        this.expectToken(']');
        // TODO: other params
        q.$loc = mergeLocs(start.$loc, this.lasttoken.$loc);
        return q;
    }

    parseQueryItem(q: Query) {
        let prefix = this.peekToken();
        if (prefix.type != TokenType.Ident) {
            this.consumeToken();
        }
        if (prefix.type == TokenType.Ident) {
            let cref = this.parseComponentRef();
            q.include.push(cref);
        } else if (prefix.str == '-') {
            let cref = this.parseComponentRef();
            if (!q.exclude) q.exclude = [];
            q.exclude.push(cref);
        } else if (prefix.str == '#') {
            const scope = this.currentScope;
            if (scope == null) {
                throw this.compileError('You can only reference specific entities inside of a scope.');
            }
            let eref = this.parseEntityForwardRef();
            this.deferred.push(() => {
                let refvalue = this.resolveEntityRef(scope, eref);
                if (!q.entities) q.entities = [];
                q.entities.push(scope.entities[refvalue]);
            });
        } else {
            this.compileError(`Query components may be preceded only by a '-'.`);
        }
    }

    parseEventName() {
        return this.expectIdent().str;
    }

    parseEventList() {
        return this.parseList(this.parseEventName, ",");
    }

    parseCode(): string { // TODOActionNode[] {
        // TODO: add $loc
        let tok = this.expectTokenTypes([ECSTokenType.CodeFragment]);
        let code = tok.str.substring(3, tok.str.length - 3);
        // TODO: add after parsing maybe?
        let lines = code.split('\n');
        if (this.includeDebugInfo) this.addDebugInfo(lines, tok.$loc.line);
        code = lines.join('\n');

        //let acomp = new ECSActionCompiler(context);
        //let nodes = acomp.parseFile(code, this.path);
        // TODO: return nodes
        return code;
    }

    addDebugInfo(lines: string[], startline: number) {
        const re = /^\s*(;|\/\/|$)/; // ignore comments and blank lines
        for (let i = 0; i < lines.length; i++) {
            if (!lines[i].match(re))
                lines[i] = this.em.dialect.debug_line(this.path, startline + i) + '\n' + lines[i];
        }
    }

    parseScope(): EntityScope {
        let name = this.expectIdent().str;
        let scope = this.em.newScope(name, this.currentScope || undefined);
        scope.filePath = this.path;
        this.currentScope = scope;
        let cmd;
        while ((cmd = this.expectTokens(['end', 'using', 'entity', 'scope', 'comment', 'system']).str) != 'end') {
            if (cmd == 'using') {
                this.parseScopeUsing();
            }
            if (cmd == 'entity') {
                this.annotate(() => this.parseEntity());
            }
            if (cmd == 'scope') {
                this.annotate(() => this.parseScope());
            }
            if (cmd == 'comment') {
                this.expectTokenTypes([ECSTokenType.CodeFragment]);
            }
            // TODO: need to make these local names, otherwise we get "duplicate name"
            if (cmd == 'system') {
                let sys = this.annotate(() => this.parseSystem());
                this.em.defineSystem(sys);
                this.currentScope.newSystemInstanceWithDefaults(sys);
            }
        }
        this.currentScope = scope.parent || null;
        return scope;
    }

    parseScopeUsing() {
        let instlist = this.parseList(this.parseSystemInstanceRef, ',');
        let params = {};
        if (this.peekToken().str == 'with') {
            this.consumeToken();
            params = this.parseSystemInstanceParameters();
        }
        for (let inst of instlist) {
            inst.params = params;
            this.currentScope?.newSystemInstance(inst);
        }
    }

    parseEntity(): Entity {
        if (!this.currentScope) { throw this.internalError(); }
        const scope = this.currentScope;
        let entname = '';
        if (this.peekToken().type == TokenType.Ident) {
            entname = this.expectIdent().str;
        }
        let etype = this.parseEntityArchetype();
        let entity = this.currentScope.newEntity(etype, entname);
        let cmd2: string;
        // TODO: remove init?
        while ((cmd2 = this.expectTokens(['const', 'init', 'var', 'decode', 'end']).str) != 'end') {
            let cmd = cmd2; // put in scope
            if (cmd == 'var') cmd = 'init'; // TODO: remove?
            if (cmd == 'init' || cmd == 'const') {
                this.parseInitConst(cmd, scope, entity);
            } else if (cmd == 'decode') {
                this.parseDecode(scope, entity);
            }
        }
        return entity;
    }

    parseInitConst(cmd: string, scope: EntityScope, entity: Entity) {
        // TODO: check data types
        let name = this.expectIdent().str;
        let { c, f } = this.getEntityField(entity, name);
        let symtype = scope.isConstOrInit(c, name);
        if (symtype && symtype != cmd)
            this.compileError(`I can't mix const and init values for a given field in a scope.`);
        this.expectToken('=');
        let valueOrRef = this.parseDataValue(f);
        if ((valueOrRef as ForwardRef).token != null) {
            this.deferred.push(() => {
                this.lasttoken = (valueOrRef as ForwardRef).token; // for errors
                let refvalue = this.resolveEntityRef(scope, valueOrRef as ForwardRef);
                if (cmd == 'const') scope.setConstValue(entity, c, f, refvalue);
                if (cmd == 'init') scope.setInitValue(entity, c, f, refvalue);
            });
        } else {
            if (cmd == 'const') scope.setConstValue(entity, c, f, valueOrRef as DataValue);
            if (cmd == 'init') scope.setInitValue(entity, c, f, valueOrRef as DataValue);
        }
    }

    parseDecode(scope: EntityScope, entity: Entity) {
        let decoderid = this.expectIdent().str;
        let codetok = this.expectTokenTypes([ECSTokenType.CodeFragment]);
        let code = codetok.str;
        code = code.substring(3, code.length - 3);
        let decoder = newDecoder(decoderid, code);
        if (!decoder) { throw this.compileError(`I can't find a "${decoderid}" decoder.`); }
        let result;
        try {
            result = decoder.parse();
        } catch (e) {
            throw new ECSError(e.message, decoder.getErrorLocation(codetok.$loc));
        }
        for (let entry of Object.entries(result.properties)) {
            let { c, f } = this.getEntityField(entity, entry[0]);
            scope.setConstValue(entity, c, f, entry[1] as DataValue);
        }
    }

    getEntityField(e: Entity, name: string): ComponentFieldPair {
        if (!this.currentScope) { throw this.internalError(); }
        let comps = this.em.componentsWithFieldName([e.etype], name);
        if (comps.length == 0) this.compileError(`I couldn't find a field named "${name}" for this entity.`)
        if (comps.length > 1) this.compileError(`I found more than one field named "${name}" for this entity.`)
        let component = comps[0];
        let field = component.fields.find(f => f.name == name);
        if (!field) { throw this.internalError(); }
        return { c: component, f: field };
    }

    parseEntityArchetype(): EntityArchetype {
        this.expectToken('[');
        let components = this.parseList(this.parseComponentRef, ',');
        this.expectToken(']');
        return { components };
    }

    parseComponentRef(): ComponentType {
        let name = this.expectIdent().str;
        let cref = this.em.getComponentByName(name);
        if (!cref) this.compileError(`I couldn't find a component named "${name}".`)
        return cref;
    }

    findEntityByName(scope: EntityScope, token: Token) {
        let name = token.str;
        let eref = scope.entities.find(e => e.name == name);
        if (!eref) {
            throw this.compileError(`I couldn't find an entity named "${name}" in this scope.`, token.$loc)
        }
        return eref;
    }

    resolveEntityRef(scope: EntityScope, ref: ForwardRef): number {
        let id = this.findEntityByName(scope, ref.token).id;
        if (ref.reftype) {
            // TODO: make this a function? elo ehi etc?
            let atypes = this.em.archetypesMatching(ref.reftype.query);
            let entities = scope.entitiesMatching(atypes);
            if (entities.length == 0)
                throw this.compileError(`This entity doesn't seem to fit the reference type.`, ref.token.$loc);
            id -= entities[0].id;
        }
        return id;
    }

    parseSystemInstanceRef(): SystemInstance {
        let name = this.expectIdent().str;
        let system = this.em.getSystemByName(name);
        if (!system) throw this.compileError(`I couldn't find a system named "${name}".`, this.lasttoken.$loc);
        let params = {};
        let inst = { system, params, id: 0 };
        return inst;
    }

    parseSystemInstanceParameters(): SystemInstanceParameters {
        let scope = this.currentScope;
        if (scope == null) throw this.internalError();
        if (this.peekToken().str == '[') {
            return { query: this.parseQuery() };
        }
        this.expectToken('#');
        let entname = this.expectIdent();
        this.expectToken('.');
        let fieldname = this.expectIdent();
        let entity = this.findEntityByName(scope, entname);
        let cf = this.getEntityField(entity, fieldname.str);
        return { refEntity: entity, refField: cf };
    }

    exportToFile(src: SourceFileExport) {
        this.em.exportToFile(src);
    }

    export() {
        let src = new SourceFileExport();
        src.line(this.em.dialect.debug_file(this.path));
        for (let path of Object.keys(this.em.imported))
            src.line(this.em.dialect.debug_file(path));
        this.exportToFile(src);
        return src.toString();
    }

    checkUpperLimit(value: number, upper: number, what: string) {
        if (value > upper) this.compileError(`This ${what} is too high; must be ${upper} or less`);
    }
    checkLowerLimit(value: number, lower: number, what: string) {
        if (value < lower) this.compileError(`This ${what} is too low; must be ${lower} or more`);
    }

    // expression stuff

    parseConstant(): DataValue {
        let expr = this.parseExpr();
        expr = this.em.evalExpr(expr, this.currentScope);
        if (isLiteral(expr)) return expr.value;
        throw this.compileError('This expression is not a constant.');
    }
    parseIntegerConstant(): number {
        let value = this.parseConstant();
        if (typeof value === 'number') return value;
        throw this.compileError('This expression is not an integer.');
    }
    parseExpr(): Expr {
        var startloc = this.peekToken().$loc;
        var expr = this.parseExpr1(this.parsePrimary(), 0);
        var endloc = this.lasttoken.$loc;
        expr.$loc = mergeLocs(startloc, endloc);
        return expr;
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
            var opfn = getOperator(op.str).f;
            // use logical operators instead of bitwise?
            if (op.str == 'and') opfn = 'land';
            if (op.str == 'or') opfn = 'lor';
            var valtype = this.exprTypeForOp(opfn, left, right, op);
            left = { valtype:valtype, op:opfn, left: left, right: right };
        }
        return left;
    }
    parsePrimary(): Expr {
        let tok = this.consumeToken();
        switch (tok.type) {
            case ECSTokenType.Integer:
                this.pushbackToken(tok);
                let value = this.expectInteger();
                let valtype : IntType = { dtype: 'int', lo: value, hi: value };
                return { valtype, value };
            case TokenType.Ident:
                if (tok.str == 'not') {
                    let expr = this.parsePrimary();
                    let valtype : IntType = { dtype: 'int', lo: 0, hi: 1 };
                    return { valtype, op: 'lnot', expr: expr };
                } else {
                    this.pushbackToken(tok);
                    return this.parseVarSubscriptOrFunc();
                }
            case ECSTokenType.Operator:
                if (tok.str == '(') {
                    let expr = this.parseExpr();
                    this.expectToken(')', `There should be another expression or a ")" here.`);
                    return expr;
                } else if (tok.str == '-') {
                    let expr = this.parsePrimary(); // TODO: -2^2=-4 and -2-2=-4
                    let valtype = (expr as ExprBase).valtype;
                    if (valtype?.dtype == 'int') {
                        let hi = Math.abs(valtype.hi);
                        let negtype : IntType = { dtype: 'int', lo: -hi, hi: hi };
                        return { valtype: negtype, op: 'neg', expr: expr };
                    }
                } else if (tok.str == '+') {
                    return this.parsePrimary(); // ignore unary +
                }
            default:
                throw this.compileError(`The expression is incomplete.`);
        }
    }
    parseVarSubscriptOrFunc(): LExpr {
        var tok = this.consumeToken();
        switch (tok.type) {
            case TokenType.Ident:
                // component:field
                if (this.ifToken(':')) {
                    let ftok = this.consumeToken();
                    let component = this.em.getComponentByName(tok.str);
                    if (!component) throw this.compileError(`A component named "${tok.str}" has not been defined.`);
                    let field = component.fields.find(f => f.name == ftok.str);
                    if (!field) throw this.compileError(`There is no "${ftok.str}" field in the ${tok.str} component.`);
                    if (!this.currentScope) throw this.compileError(`This operation only works inside of a scope.`);
                    let atypes = this.em.archetypesMatching({ include: [component] })
                    let entities = this.currentScope.entitiesMatching(atypes);
                    return { entities, field } as EntityFieldOp;
                }
                // entity.field
                if (this.ifToken('.')) {
                    let ftok = this.consumeToken();
                    if (!this.currentScope) throw this.compileError(`This operation only works inside of a scope.`);
                    let entity = this.currentScope.getEntityByName(tok.str);
                    if (!entity) throw this.compileError(`An entity named "${tok.str}" has not been defined.`);
                    let component = this.em.singleComponentWithFieldName([entity.etype], ftok.str, ftok);
                    let field = component.fields.find(f => f.name == ftok.str);
                    if (!field) throw this.compileError(`There is no "${ftok.str}" field in this entity.`);
                    let entities = [entity];
                    return { entities, field } as EntityFieldOp;
                }
                let args : Expr[] = [];
                if (this.ifToken('(')) {
                    args = this.parseExprList();
                    this.expectToken(')', `There should be another expression or a ")" here.`);
                }
                var loc = mergeLocs(tok.$loc, this.lasttoken.$loc);
                var valtype = this.exprTypeForSubscript(tok.str, args, loc);
                return { valtype: valtype, name: tok.str, args: args, $loc:loc };
            default:
                throw this.compileError(`There should be a variable name here.`);
        }
    }
    parseLexpr(): LExpr {
        var lexpr = this.parseVarSubscriptOrFunc();
        //this.vardefs[lexpr.name] = lexpr;
        //this.validateVarName(lexpr);
        return lexpr;
    }
    exprTypeForOp(fnname: string, left: Expr, right: Expr, optok: Token) : DataType {
        return { dtype: 'int', lo:0, hi:255 }; // TODO?
    }
    exprTypeForSubscript(fnname: string, args: Expr[], loc: SourceLocation) : DataType {
        return { dtype: 'int', lo:0, hi:255 }; // TODO?
    }
    parseLexprList(): LExpr[] {
        return this.parseList(this.parseLexpr, ',');
    }
    parseExprList(): Expr[] {
        return this.parseList(this.parseExpr, ',');
    }
    // TODO: annotate with location
    parseBlockStatement(): Statement {
        let valtype : IntType = { dtype:'int', lo:0, hi: 0 } // TODO?
        if (this.peekToken().type == ECSTokenType.CodeFragment) {
            return { valtype, code: this.parseCode() };
        }
        if (this.ifToken('begin')) {
            let stmts = [];
            while (this.peekToken().str != 'end') {
                stmts.push(this.annotate(() => this.parseBlockStatement()));
            }
            this.expectToken('end');
            return { valtype, stmts };
        }
        let cmd = this.peekToken();
        if (SELECT_TYPE.includes(cmd.str as any)) {
            return this.parseQueryStatement();
        }
        throw this.compileError(`There should be a statement or "end" here.`, cmd.$loc);
    }
    parseQueryStatement() : QueryExpr {
        // TODO: include modifiers in error msg
        const select = this.expectTokens(SELECT_TYPE).str as SelectType; // TODO: type check?
        let all = this.ifToken('all') != null;
        let query = undefined;
        let join = undefined;
        if (select == 'once') {
            if (this.peekToken().str == '[') this.compileError(`A "${select}" action can't include a query.`)
        } else {
            query = this.parseQuery();
        }
        if (select == 'join') {
            this.expectToken('with');
            join = this.parseQuery();
        }
        if (this.ifToken('limit')) {
            if (!query) { this.compileError(`A "${select}" query can't include a limit.`); }
            else query.limit = this.parseIntegerConstant();
        }
        const all_modifiers = ['asc', 'desc']; // TODO
        const modifiers = this.parseModifiers(all_modifiers);
        let direction = undefined;
        if (modifiers['asc']) direction = 'asc';
        else if (modifiers['desc']) direction = 'desc';
        let body = this.annotate(() => this.parseBlockStatement());
        return { select, query, join, direction, all, stmts: [body], loop: select == 'foreach' } as QueryExpr;
    }
}

///

export class ECSActionCompiler extends Tokenizer {
    constructor(
        public readonly context: ActionContext) {
        super();
        this.setTokenRules([
            { type: ECSTokenType.Placeholder, regex: /\{\{.*?\}\}/ },
            { type: TokenType.CatchAll, regex: /[^{\n]+\n*/ },
        ]);
        this.errorOnCatchAll = false;
    }

    parseFile(text: string, path: string) {
        this.tokenizeFile(text, path);
        let nodes = [];
        while (!this.isEOF()) {
            let tok = this.consumeToken();
            if (tok.type == ECSTokenType.Placeholder) {
                let args = tok.str.substring(2, tok.str.length - 2).split(/\s+/);
                nodes.push(new CodePlaceholderNode(this.context, tok.$loc, args));
            } else if (tok.type == TokenType.CatchAll) {
                nodes.push(new CodeLiteralNode(this.context, tok.$loc, tok.str));
            }
        }
        return nodes;
    }
}
