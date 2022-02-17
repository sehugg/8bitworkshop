
import { mergeLocs, Token, Tokenizer, TokenType } from "../tokenizer";
import { SourceLocated, SourceLocation } from "../workertypes";
import { newDecoder } from "./decoder";
import { Action, ActionContext, ActionNode, ActionWithJoin, ArrayType, CodeLiteralNode, CodePlaceholderNode, ComponentType, DataField, DataType, DataValue, ECSError, Entity, EntityArchetype, EntityManager, EntityScope, IntType, Query, RefType, SelectType, SELECT_TYPE, SourceFileExport, System, SystemInstance, SystemInstanceParameters, ComponentFieldPair } from "./ecs";

export enum ECSTokenType {
    Ellipsis = 'ellipsis',
    Operator = 'delimiter',
    QuotedString = 'quoted-string',
    Integer = 'integer',
    CodeFragment = 'code-fragment',
    Placeholder = 'placeholder',
}

interface ForwardRef {
    reftype: RefType | undefined
    token: Token
}

export class ECSCompiler extends Tokenizer {

    currentScope: EntityScope | null = null;
    currentContext: ActionContext | null = null;
    debuginfo = false;

    constructor(
        public readonly em: EntityManager)
    {
        super();
        //this.includeEOL = true;
        this.setTokenRules([
            { type: ECSTokenType.Ellipsis, regex: /\.\./ },
            { type: ECSTokenType.QuotedString, regex: /".*?"/ },
            { type: ECSTokenType.CodeFragment, regex: /---.*?---/ },
            { type: ECSTokenType.Integer, regex: /[-]?0[xX][A-Fa-f0-9]+/ },
            { type: ECSTokenType.Integer, regex: /[-]?\$[A-Fa-f0-9]+/ },
            { type: ECSTokenType.Integer, regex: /[-]?\d+/ },
            { type: ECSTokenType.Integer, regex: /[%][01]+/ },
            { type: ECSTokenType.Operator, regex: /[.#=,:(){}\[\]\-]/ },
            { type: TokenType.Ident, regex: /[A-Za-z_][A-Za-z0-9_]*/ },
            { type: TokenType.Ignore, regex: /\/\/.*?[\n\r]/ },
            { type: TokenType.Ignore, regex: /\/\*.*?\*\// },
            { type: TokenType.Ignore, regex: /\s+/ },
        ]);
        this.errorOnCatchAll = true;
    }

    annotate<T extends SourceLocated>(fn: () => T) {
        let tok = this.peekToken();
        let obj = fn();
        if (obj) (obj as SourceLocated).$loc = tok.$loc;
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
            let comp = new ECSCompiler(this.em);
            comp.debuginfo = this.debuginfo; // TODO: clone compiler
            try {
                comp.parseFile(text, path);
            } catch (e) {
                for (var err of comp.errors) this.errors.push(err);
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
            let path = tok.str.substring(1, tok.str.length-1);
            return this.importFile(path);
        }
        if (tok.str == 'demo') {
            let scope = this.parseScope();
            scope.isDemo = true;
            return scope;
        }
        if (tok.str == 'comment') {
            this.expectTokenTypes([ECSTokenType.CodeFragment]);
            return;
        }
        this.compileError(`Unexpected top-level keyword: ${tok.str}`);
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
            let lo = this.expectInteger();
            this.expectToken('..');
            let hi = this.expectInteger();
            return { dtype: 'int', lo, hi } as IntType;
        }
        if (this.peekToken().str == '[') {
            return { dtype: 'ref', query: this.parseQuery() } as RefType;
        }
        if (this.ifToken('array')) {
            let index : IntType | undefined = undefined;
            if (this.peekToken().type == ECSTokenType.Integer) {
                index = this.parseDataType() as IntType;
            }
            this.expectToken('of');
            let elem = this.parseDataType();
            let baseoffset;
            if (this.ifToken('baseoffset')) {
                baseoffset = this.expectInteger();
            }
            return { dtype: 'array', index, elem, baseoffset } as ArrayType;
        }
        this.compileError(`I expected a data type here.`); throw new Error();
    }

    parseDataValue(field: DataField) : DataValue | ForwardRef {
        let tok = this.peekToken();
        if (tok.type == 'integer') {
            return this.expectInteger();
        }
        if (tok.str == '[') {
            // TODO: 16-bit?
            return new Uint8Array(this.parseDataArray());
        }
        if (tok.str == '#') {
            this.consumeToken();
            let reftype = field.dtype == 'ref' ? field as RefType : undefined;
            let token = this.expectIdent();
            return { reftype, token };
        }
        this.compileError(`I expected a ${field.dtype} here.`); throw new Error();
    }

    parseDataArray() {
        this.expectToken('[');
        let arr = this.parseList(this.expectInteger, ',');
        this.expectToken(']');
        return arr;
    }

    expectInteger(): number {
        let s = this.consumeToken().str;
        let i : number;
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
        while ((cmd = this.expectTokens(['on','locals','end']).str) != 'end') {
            if (cmd == 'on') {
                let action = this.annotate(() => this.parseAction(system));
                actions.push(action);
            } else if (cmd == 'locals') {
                system.tempbytes = this.expectInteger();
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
            tempbytes = this.expectInteger();
        }
        let system : System = { name, tempbytes, actions: [] };
        let context : ActionContext = { scope: null, system };
        let text = this.parseCode(context);
        let select : SelectType = 'once';
        let action : Action = { text, event: name, select };
        system.actions.push(action);
        return system;
    }

    parseAction(system: System): Action {
        // TODO: unused events?
        const event = this.expectIdent().str;
        this.expectToken('do');
        // TODO: include modifiers in error msg
        const select = this.expectTokens(SELECT_TYPE).str as SelectType; // TODO: type check?
        const all_modifiers = ['cyclecritical','asc','desc']; // TODO
        const modifiers = this.parseModifiers(all_modifiers);
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
            else query.limit = this.expectInteger();
        }
        let context : ActionContext = { scope: null, system };
        let text = this.parseCode(context);
        let direction = undefined;
        if (modifiers['asc']) direction = 'asc';
        else if (modifiers['desc']) direction = 'desc';
        let action = { text, event, query, join, select, direction };
        return action as ActionWithJoin;
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
        let cref = this.parseComponentRef();
        if (prefix.type == TokenType.Ident) {
            q.include.push(cref);
        } else if (prefix.str == '-') {
            if (!q.exclude) q.exclude = [];
            q.exclude.push(cref);
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

    parseCode(context: ActionContext): string { // TODOActionNode[] {
        // TODO: add $loc
        let tok = this.expectTokenTypes([ECSTokenType.CodeFragment]);
        let code = tok.str.substring(3, tok.str.length-3);
        // TODO: add after parsing maybe?
        let lines = code.split('\n');
        if (this.debuginfo) this.addDebugInfo(lines, tok.$loc.line);
        code = lines.join('\n');
        
        let acomp = new ECSActionCompiler(context);
        let nodes = acomp.parseFile(code, this.path);
        // TODO: return nodes
        return code;
    }

    addDebugInfo(lines: string[], startline: number) {
        const re = /^\s*(;|\/\/|$)/; // ignore comments and blank lines
        for (let i=0; i<lines.length; i++) {
            if (!lines[i].match(re))
                lines[i] = this.em.dialect.debug_line(this.path, startline+i) + '\n' + lines[i];
        }
    }
    
    parseScope() : EntityScope {
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

    parseEntity() : Entity {
        if (!this.currentScope) { this.internalError(); throw new Error(); }
        const scope = this.currentScope;
        let entname = '';
        if (this.peekToken().type == TokenType.Ident) {
            entname = this.expectIdent().str;
        }
        let etype = this.parseEntityArchetype();
        let entity = this.currentScope.newEntity(etype);
        entity.name = entname;
        let cmd2 : string;
        // TODO: remove init?
        while ((cmd2 = this.expectTokens(['const', 'init', 'var', 'decode', 'end']).str) != 'end') {
            let cmd = cmd2; // put in scope
            if (cmd == 'var') cmd = 'init'; // TODO: remove?
            if (cmd == 'init' || cmd == 'const') {
                // TODO: check data types
                let name = this.expectIdent().str;
                let { c, f } = this.getEntityField(entity, name);
                let symtype = this.currentScope.isConstOrInit(c, name);
                if (symtype && symtype != cmd)
                    this.compileError(`I can't mix const and init values for a given field in a scope.`);
                this.expectToken('=');
                let valueOrRef = this.parseDataValue(f);
                if ((valueOrRef as ForwardRef).token != null) {
                    this.deferred.push(() => {
                        let refvalue = this.resolveEntityRef(scope, valueOrRef as ForwardRef);
                        if (cmd == 'const') scope.setConstValue(entity, c, name, refvalue);
                        if (cmd == 'init') scope.setInitValue(entity, c, name, refvalue);
                    });
                } else {
                    if (cmd == 'const') scope.setConstValue(entity, c, name, valueOrRef as DataValue);
                    if (cmd == 'init') scope.setInitValue(entity, c, name, valueOrRef as DataValue);
                }
            } else if (cmd == 'decode') {
                let decoderid = this.expectIdent().str;
                let codetok = this.expectTokenTypes([ECSTokenType.CodeFragment]);
                let code = codetok.str;
                code = code.substring(3, code.length-3);
                let decoder = newDecoder(decoderid, code);
                if (!decoder) { this.compileError(`I can't find a "${decoderid}" decoder.`); throw new Error() }
                let result;
                try {
                    result = decoder.parse();
                } catch (e) {
                    throw new ECSError(e.message, decoder.getErrorLocation(codetok.$loc));
                }
                for (let entry of Object.entries(result.properties)) {
                    let { c, f } = this.getEntityField(entity, entry[0]);
                    scope.setConstValue(entity, c, f.name, entry[1] as DataValue);
                }
            }
        }
        return entity;
    }

    getEntityField(e: Entity, name: string) : ComponentFieldPair {
        if (!this.currentScope) { this.internalError(); throw new Error(); }
        let comps = this.em.componentsWithFieldName([e.etype], name);
        if (comps.length == 0) this.compileError(`I couldn't find a field named "${name}" for this entity.`)
        if (comps.length > 1) this.compileError(`I found more than one field named "${name}" for this entity.`)
        let component = comps[0];
        let field = component.fields.find(f => f.name == name);
        if (!field) { this.internalError(); throw new Error(); }
        return { c: component, f: field };
    }

    parseEntityArchetype() : EntityArchetype {
        this.expectToken('[');
        let components = this.parseList(this.parseComponentRef, ',');
        this.expectToken(']');
        return {components};
    }
    
    parseComponentRef() : ComponentType {
        let name = this.expectIdent().str;
        let cref = this.em.getComponentByName(name);
        if (!cref) this.compileError(`I couldn't find a component named "${name}".`)
        return cref;
    }

    findEntityByName(scope: EntityScope, token: Token) {
        let name = token.str;
        let eref = scope.entities.find(e => e.name == name);
        if (!eref) {
            this.compileError(`I couldn't find an entity named "${name}" in this scope.`, token.$loc)
            throw new Error();
        }
        return eref;
    }

    resolveEntityRef(scope: EntityScope, ref: ForwardRef) : number {
        let id = this.findEntityByName(scope, ref.token).id;
        if (ref.reftype) {
            // TODO: make this a function? elo ehi etc?
            let atypes = this.em.archetypesMatching(ref.reftype.query);
            let entities = scope.entitiesMatching(atypes);
            if (entities.length == 0)
                this.compileError(`This entity doesn't seem to fit the reference type.`, ref.token.$loc);
            id -= entities[0].id;
        }
        return id;
    }
    
    parseSystemInstanceRef() : SystemInstance {
        let name = this.expectIdent().str;
        let system = this.em.getSystemByName(name);
        if (!system) this.compileError(`I couldn't find a system named "${name}".`, this.lasttoken.$loc);
        let params = {};
        let inst = { system, params, id: 0 };
        return inst;
    }

    parseSystemInstanceParameters() : SystemInstanceParameters {
        let scope = this.currentScope;
        if (scope == null) throw new Error();
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
}

export class ECSActionCompiler extends Tokenizer {
    constructor(
        public readonly context: ActionContext)
    {
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
                let args = tok.str.substring(2, tok.str.length-2).split(/\s+/);
                nodes.push(new CodePlaceholderNode(this.context, tok.$loc, args));
            } else if (tok.type == TokenType.CatchAll) {
                nodes.push(new CodeLiteralNode(this.context, tok.$loc, tok.str));
            }
        }
        return nodes;
    }
}
