
import { Tokenizer, TokenType } from "../tokenizer";
import { Action, ArrayType, ComponentType, DataField, DataType, DataValue, Dialect_CA65, Entity, EntityArchetype, EntityManager, EntityScope, IntType, Query, RefType, SelectType, SourceFileExport, System } from "./ecs";

export enum ECSTokenType {
    Ellipsis = 'ellipsis',
    Operator = 'delimiter',
    QuotedString = 'quoted-string',
    Integer = 'integer',
}

export class ECSCompiler extends Tokenizer {

    em = new EntityManager(new Dialect_CA65()); // TODO
    currentScope: EntityScope | null = null;

    constructor() {
        super();
        //this.includeEOL = true;
        this.setTokenRules([
            { type: TokenType.Ident, regex: /[A-Za-z_][A-Za-z0-9_]*/ },
            { type: TokenType.CodeFragment, regex: /---/ },
            { type: ECSTokenType.Ellipsis, regex: /\.\./ },
            { type: ECSTokenType.Operator, regex: /[#=,:(){}\[\]]/ },
            { type: ECSTokenType.QuotedString, regex: /".*?"/ },
            { type: ECSTokenType.Integer, regex: /[-]?0x[A-Fa-f0-9]+/ },
            { type: ECSTokenType.Integer, regex: /[-]?\$[A-Fa-f0-9]+/ },
            { type: ECSTokenType.Integer, regex: /[-]?\d+/ },
            { type: TokenType.Ignore, regex: /\s+/ },
        ]);
        this.errorOnCatchAll = true;
    }
    
    parseFile(text: string, path: string) {
        this.tokenizeFile(text, path);
        while (!this.isEOF()) {
            this.parseTopLevel();
        }
    }

    parseTopLevel() {
        //this.skipBlankLines();
        let tok = this.expectTokens(['component', 'system', 'scope', 'comment']);
        if (tok.str == 'component') {
            return this.em.defineComponent(this.parseComponentDefinition());
        }
        if (tok.str == 'system') {
            return this.em.defineSystem(this.parseSystem());
        }
        if (tok.str == 'scope') {
            return this.parseScope();
        }
        if (tok.str == 'comment') {
            this.expectTokenTypes([TokenType.CodeFragment]);
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
            this.expectToken('array');
            this.expectToken('of');
            return { dtype: 'array', elem: this.parseDataType() } as ArrayType;
        }
        this.compileError(`Unknown data type`); // TODO
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
                let atypes = this.em.archetypesMatching(reftype.query);
                let entities = this.currentScope.entitiesMatching(atypes);
                if (entities.length == 0) this.compileError(`This entitiy doesn't seem to fit the reference type.`);
                id -= entities[0].id;
            }
            return id;
        }
        this.compileError(`Unknown data value`); // TODO
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
        while ((cmd = this.consumeToken().str) != 'end') {
            if (cmd == 'on') {
                actions.push(this.parseAction());
            } else if (cmd == 'locals') {
                system.tempbytes = this.expectInteger();
            } else {
                this.compileError(`Unexpected system keyword: ${cmd}`);
            }
        }
        return system;
    }

    parseAction(): Action {
        let event = this.expectIdent().str;
        this.expectToken('do');
        let select = this.expectTokens(['once', 'each', 'source']).str as SelectType; // TODO: type check?
        let query = this.parseQuery();
        let emits;
        if (this.peekToken().str == 'emit') {
            this.consumeToken();
            this.expectToken('(');
            emits = this.parseEventList();
            this.expectToken(')');
        }
        let text = this.parseCode();
        return { text, event, query, select };
    }
    
    parseQuery() {
        let q: Query = { include: [] };
        this.expectToken('[');
        q.include = this.parseList(this.parseComponentRef, ',').map(c => c.name);
        // TODO: other params
        this.expectToken(']');
        return q;
    }

    parseEvent() {
        return this.expectIdent().str;
    }

    parseEventList() {
        return this.parseList(this.parseEvent, ",");
    }

    parseCode(): string {
        return this.expectTokenTypes([TokenType.CodeFragment]).str;
    }
    
    parseScope() : EntityScope {
        let name = this.expectIdent().str;
        let scope = this.em.newScope(name, this.currentScope);
        this.currentScope = scope;
        let cmd;
        while ((cmd = this.consumeToken().str) != 'end') {
            if (cmd == 'entity') {
                this.parseEntity();
            } else {
                this.compileError(`Unexpected scope keyword: ${cmd}`);
            }
        }
        this.currentScope = scope.parent;
        return scope;
    }

    parseEntity() : Entity {
        let name = '';
        if (this.peekToken().type == TokenType.Ident) {
            name = this.expectIdent().str;
        }
        let etype = this.parseEntityArchetype();
        let e = this.currentScope.newEntity(etype);
        e.name = name;
        let cmd;
        while ((cmd = this.consumeToken().str) != 'end') {
            // TODO: check data types
            if (cmd == 'const' || cmd == 'init') {
                let name = this.expectIdent().str;
                this.expectToken('=');
                let comps = this.em.componentsWithFieldName([{etype: e.etype, cmatch:e.etype.components}], name);
                if (comps.length == 0) this.compileError(`I couldn't find a field named "${name}" for this entity.`)
                if (comps.length > 1) this.compileError(`I found more than one field named "${name}" for this entity.`)
                let field = comps[0].fields.find(f => f.name == name);
                if (!field) this.internalError();
                let value = this.parseDataValue(field);
                if (cmd == 'const') this.currentScope.setConstValue(e, comps[0], name, value);
                if (cmd == 'init') this.currentScope.setInitValue(e, comps[0], name, value);
            } else {
                this.compileError(`Unexpected scope keyword: ${cmd}`);
            }
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
        this.expectToken('#');
        let name = this.expectIdent().str;
        let eref = this.currentScope.entities.find(e => e.name == name);
        if (!eref) this.compileError(`I couldn't find an entity named "${name}" in this scope.`)
        return eref;
    }

    exportToFile(src: SourceFileExport) {
        for (let scope of Object.values(this.em.scopes)) {
            scope.analyzeEntities();
            scope.generateCode();
            scope.dump(src);
        }
    }

    export() {
        let src = new SourceFileExport();
        this.exportToFile(src);
        return src.toString();
    }
}
