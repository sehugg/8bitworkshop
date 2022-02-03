
import { mergeLocs, Tokenizer, TokenType } from "../tokenizer";
import { SourceLocated } from "../workertypes";
import { Action, ArrayType, ComponentType, DataField, DataType, DataValue, Entity, EntityArchetype, EntityManager, EntityScope, IntType, Query, RefType, SelectType, SourceFileExport, System } from "./ecs";

export enum ECSTokenType {
    Ellipsis = 'ellipsis',
    Operator = 'delimiter',
    QuotedString = 'quoted-string',
    Integer = 'integer',
    CodeFragment = 'code-fragment',
}

export class ECSCompiler extends Tokenizer {

    currentScope: EntityScope | null = null;

    constructor(
        public readonly em: EntityManager)
    {
        super();
        //this.includeEOL = true;
        this.setTokenRules([
            { type: ECSTokenType.Ellipsis, regex: /\.\./ },
            { type: ECSTokenType.QuotedString, regex: /".*?"/ },
            { type: ECSTokenType.CodeFragment, regex: /---.*?---/ },
            { type: ECSTokenType.Integer, regex: /[-]?0x[A-Fa-f0-9]+/ },
            { type: ECSTokenType.Integer, regex: /[-]?\$[A-Fa-f0-9]+/ },
            { type: ECSTokenType.Integer, regex: /[-]?\d+/ },
            { type: ECSTokenType.Operator, regex: /[#=,:(){}\[\]\-]/ },
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
    }

    getImportFile: (path: string) => string;

    importFile(path: string) {
        if (!this.em.imported[path]) { // already imported?
            let text = this.getImportFile && this.getImportFile(path);
            if (!text) this.compileError(`I can't find the import file "${path}".`);
            new ECSCompiler(this.em).parseFile(path, text);
            this.em.imported[path] = true;
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
        return { name: name.str, ...type };
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
        if (this.peekToken().str == 'array') {
            let index : IntType | undefined = undefined;
            this.expectToken('array');
            if (this.peekToken().type == ECSTokenType.Integer) {
                index = this.parseDataType() as IntType;
            }
            this.expectToken('of');
            return { dtype: 'array', index, elem: this.parseDataType() } as ArrayType;
        }
        this.internalError(); throw new Error();
    }

    parseDataValue(field: DataField) : DataValue {
        let tok = this.peekToken();
        if (tok.type == 'integer') {
            return this.expectInteger();
        }
        if (tok.str == '[') {
            // TODO: 16-bit?
            return new Uint8Array(this.parseDataArray());
        }
        if (tok.str == '#') {
            let reftype = field.dtype == 'ref' ? field as RefType : undefined;
            let e = this.parseEntityRef();
            let id = e.id;
            if (reftype) {
                // TODO: make this a function? elo ehi etc?
                if (!this.currentScope) {
                    this.compileError("This type can only exist inside of a scope."); throw new Error()
                };
                let atypes = this.em.archetypesMatching(reftype.query);
                let entities = this.currentScope.entitiesMatching(atypes);
                if (entities.length == 0) this.compileError(`This entitiy doesn't seem to fit the reference type.`);
                id -= entities[0].id;
            }
            return id;
        }
        this.internalError(); throw new Error();
    }

    parseDataArray() {
        this.expectToken('[');
        let arr = this.parseList(this.expectInteger, ',');
        this.expectToken(']');
        return arr;
    }

    expectInteger(): number {
        let s = this.consumeToken().str;
        if (s.startsWith('$')) s = '0x' + s.substring(1);
        let i = parseInt(s);
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
                let action = this.annotate(() => this.parseAction());
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
        let text = this.parseCode();
        let select : SelectType = 'once';
        let action : Action = { text, event: name, select };
        return { name, tempbytes, actions: [action] };
    }

    parseAction(): Action {
        // TODO: unused events?
        let event = this.expectIdent().str;
        this.expectToken('do');
        let select = this.expectTokens(
            ['once', 'foreach', 'join', 'with', 'if', 'select']).str as SelectType; // TODO: type check?
        let query = undefined;
        let join = undefined;
        if (select != 'once') {
            query = this.parseQuery();
        }
        if (select == 'join') {
            this.expectToken('with');
            join = this.parseQuery();
        }
        let emits;
        let limit;
        if (this.peekToken().str == 'limit') {
            this.consumeToken();
            if (!['foreach', 'join'].includes(select)) this.compileError(`A "${select}" query can't include a limit.`);
            limit = this.expectInteger();
        }
        if (this.peekToken().str == 'emit') {
            this.consumeToken();
            this.expectToken('(');
            emits = this.parseEventList();
            this.expectToken(')');
        }
        let text = this.parseCode();
        let action = { text, event, query, join, select, limit };
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

    parseEvent() {
        return this.expectIdent().str;
    }

    parseEventList() {
        return this.parseList(this.parseEvent, ",");
    }

    parseCode(): string {
        // TODO: add $loc
        let tok = this.expectTokenTypes([ECSTokenType.CodeFragment]);
        let code = tok.str.substring(3, tok.str.length-3);
        let lines = code.split('\n');
        for (let i=0; i<lines.length; i++) {
            lines[i] = ` .dbg line, "${this.path}", ${tok.$loc.line+i}\n` + lines[i];
        }
        return lines.join('\n');
    }
    
    parseScope() : EntityScope {
        let name = this.expectIdent().str;
        let scope = this.em.newScope(name, this.currentScope || undefined);
        scope.filePath = this.path;
        this.currentScope = scope;
        let cmd;
        while ((cmd = this.expectTokens(['using', 'entity', 'scope', 'comment', 'end']).str) != 'end') {
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
        }
        this.currentScope = scope.parent || null;
        return scope;
    }

    parseScopeUsing() {
        let syslist = this.parseList(this.parseSystemRef, ',');
        for (let sys of syslist) {
            this.currentScope?.systems.push(sys);
        }
    }

    parseEntity() : Entity {
        if (!this.currentScope) { this.internalError(); throw new Error(); }
        let name = '';
        if (this.peekToken().type == TokenType.Ident) {
            name = this.expectIdent().str;
        }
        let etype = this.parseEntityArchetype();
        let e = this.currentScope.newEntity(etype);
        e.name = name;
        let cmd;
        while ((cmd = this.expectTokens(['const', 'init', 'end']).str) != 'end') {
            // TODO: check data types
            let name = this.expectIdent().str;
            let comps = this.em.componentsWithFieldName([{etype: e.etype, cmatch:e.etype.components}], name);
            if (comps.length == 0) this.compileError(`I couldn't find a field named "${name}" for this entity.`)
            if (comps.length > 1) this.compileError(`I found more than one field named "${name}" for this entity.`)
            let field = comps[0].fields.find(f => f.name == name);
            if (!field) { this.internalError(); throw new Error(); }
            this.expectToken('=');
            let value = this.parseDataValue(field);
            if (cmd == 'const') this.currentScope.setConstValue(e, comps[0], name, value);
            if (cmd == 'init') this.currentScope.setInitValue(e, comps[0], name, value);
        }
        return e;
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

    parseEntityRef(reftype?: RefType) : Entity {
        if (!this.currentScope) { this.internalError(); throw new Error(); }
        this.expectToken('#');
        let name = this.expectIdent().str;
        let eref = this.currentScope.entities.find(e => e.name == name);
        if (!eref) {
            this.compileError(`I couldn't find an entity named "${name}" in this scope.`)
            throw new Error();
        }
        return eref;
    }

    parseSystemRef() : System {
        let name = this.expectIdent().str;
        let sys = this.em.getSystemByName(name);
        if (!sys) this.compileError(`I couldn't find a system named "${name}".`, this.lasttoken.$loc);
        return sys;
    }

    exportToFile(src: SourceFileExport) {
        this.em.exportToFile(src);
    }

    export() {
        let src = new SourceFileExport();
        src.debug_file(this.path);
        this.exportToFile(src);
        return src.toString();
    }
}
