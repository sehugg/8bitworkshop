"use strict";
// CodeMirror 6 language support for Verilog/SystemVerilog
// Migrated from CodeMirror 5 mode
// Original copyright (c) by Marijn Haverbeke and others
// Distributed under an MIT license: https://codemirror.net/5/LICENSE
Object.defineProperty(exports, "__esModule", { value: true });
exports.verilog = verilog;
exports.systemverilog = systemverilog;
const language_1 = require("@codemirror/language");
const language_2 = require("@codemirror/language");
function words(str) {
    const obj = {};
    const wordList = str.split(" ");
    for (let i = 0; i < wordList.length; ++i)
        obj[wordList[i]] = true;
    return obj;
}
// TODO: Migrate to CodeMirror 6 Lezer parser.
function createVerilogParser(config = {}) {
    const statementIndentUnit = config.statementIndentUnit || 3;
    const dontAlignCalls = config.dontAlignCalls;
    const compilerDirectivesUseRegularIndentation = config.compilerDirectivesUseRegularIndentation;
    const noIndentKeywords = config.noIndentKeywords || [];
    const multiLineStrings = config.multiLineStrings;
    /**
     * Keywords from IEEE 1800-2012
     */
    const keywords = words("accept_on alias always always_comb always_ff always_latch and assert assign assume automatic before begin bind " +
        "bins binsof bit break buf bufif0 bufif1 byte case casex casez cell chandle checker class clocking cmos config " +
        "const constraint context continue cover covergroup coverpoint cross deassign default defparam design disable " +
        "dist do edge else end endcase endchecker endclass endclocking endconfig endfunction endgenerate endgroup " +
        "endinterface endmodule endpackage endprimitive endprogram endproperty endspecify endsequence endtable endtask " +
        "enum event eventually expect export extends extern final first_match for force foreach forever fork forkjoin " +
        "function generate genvar global highz0 highz1 if iff ifnone ignore_bins illegal_bins implements implies import " +
        "incdir include initial inout input inside instance int integer interconnect interface intersect join join_any " +
        "join_none large let liblist library local localparam logic longint macromodule matches medium modport module " +
        "nand negedge nettype new nexttime nmos nor noshowcancelled not notif0 notif1 null or output package packed " +
        "parameter pmos posedge primitive priority program property protected pull0 pull1 pulldown pullup " +
        "pulsestyle_ondetect pulsestyle_onevent pure rand randc randcase randsequence rcmos real realtime ref reg " +
        "reject_on release repeat restrict return rnmos rpmos rtran rtranif0 rtranif1 s_always s_eventually s_nexttime " +
        "s_until s_until_with scalared sequence shortint shortreal showcancelled signed small soft solve specify " +
        "specparam static string strong strong0 strong1 struct super supply0 supply1 sync_accept_on sync_reject_on " +
        "table tagged task this throughout time timeprecision timeunit tran tranif0 tranif1 tri tri0 tri1 triand trior " +
        "trireg type typedef union unique unique0 unsigned until until_with untyped use uwire var vectored virtual void " +
        "wait wait_order wand weak weak0 weak1 while wildcard wire with within wor xnor xor");
    const isOperatorChar = /[\+\-\*\/!~&|^%=?:<>]/;
    const isBracketChar = /[\[\]{}()]/;
    const unsignedNumber = /\d[0-9_]*/;
    const decimalLiteral = /\d*\s*'s?d\s*\d[0-9_]*/i;
    const binaryLiteral = /\d*\s*'s?b\s*[xz01][xz01_]*/i;
    const octLiteral = /\d*\s*'s?o\s*[xz0-7][xz0-7_]*/i;
    const hexLiteral = /\d*\s*'s?h\s*[0-9a-fxz?][0-9a-fxz?_]*/i;
    const realLiteral = /(\d[\d_]*(\.\d[\d_]*)?E-?[\d_]+)|(\d[\d_]*\.\d[\d_]*)/i;
    const closingBracketOrWord = /^((`?\w+)|[)}\]])/;
    const closingBracket = /[)}\]]/;
    const compilerDirectiveRegex = new RegExp("^(`(?:ifdef|ifndef|elsif|else|endif|undef|undefineall|define|include|begin_keywords|celldefine|default|" +
        "nettype|end_keywords|endcelldefine|line|nounconnected_drive|pragma|resetall|timescale|unconnected_drive))\\b");
    const compilerDirectiveBeginRegex = /^(`(?:ifdef|ifndef|elsif|else))\b/;
    const compilerDirectiveEndRegex = /^(`(?:elsif|else|endif))\b/;
    let curPunc;
    let curKeyword;
    // Block openings which are closed by a matching keyword in the form of ("end" + keyword)
    const blockKeywords = words("case checker class clocking config function generate interface module package " +
        "primitive program property specify sequence table task");
    // Opening/closing pairs
    const openClose = {};
    for (const keyword in blockKeywords) {
        openClose[keyword] = "end" + keyword;
    }
    openClose["begin"] = "end";
    openClose["casex"] = "endcase";
    openClose["casez"] = "endcase";
    openClose["do"] = "while";
    openClose["fork"] = "join;join_any;join_none";
    openClose["covergroup"] = "endgroup";
    openClose["macro_begin"] = "macro_end";
    for (const keyword of noIndentKeywords) {
        if (openClose[keyword]) {
            openClose[keyword] = undefined;
        }
    }
    // Keywords which open statements that are ended with a semi-colon
    const statementKeywords = words("always always_comb always_ff always_latch assert assign assume else export for foreach forever if import initial repeat while extern typedef");
    function tokenBase(stream, state) {
        const ch = stream.peek();
        let style;
        if (/[,;:\.]/.test(ch)) {
            curPunc = stream.next();
            return null;
        }
        if (isBracketChar.test(ch)) {
            curPunc = stream.next();
            return "bracket";
        }
        // Macros (tick-defines)
        if (ch == '`') {
            stream.next();
            if (stream.eatWhile(/[\w\$_]/)) {
                const cur = stream.current();
                curKeyword = cur;
                // Macros that end in _begin, are start of block and end with _end
                if (cur.startsWith("`uvm_") && cur.endsWith("_begin")) {
                    const keywordClose = curKeyword.substr(0, curKeyword.length - 5) + "end";
                    openClose[cur] = keywordClose;
                    curPunc = "newblock";
                }
                else {
                    stream.eatSpace();
                    if (stream.peek() == '(') {
                        // Check if this is a block
                        curPunc = "newmacro";
                    }
                    const withSpace = stream.current();
                    // Move the stream back before the spaces
                    stream.backUp(withSpace.length - cur.length);
                }
                return "keyword.control";
            }
            else {
                return null;
            }
        }
        // System calls
        if (ch == '$') {
            stream.next();
            if (stream.eatWhile(/[\w\$_]/)) {
                return "meta";
            }
            else {
                return null;
            }
        }
        // Time literals
        if (ch == '#') {
            stream.next();
            stream.eatWhile(/[\d_.]/);
            return "keyword.control";
        }
        // Event
        if (ch == '@') {
            stream.next();
            stream.eatWhile(/[@]/);
            return "keyword.control";
        }
        // Strings
        if (ch == '"') {
            stream.next();
            state.tokenize = tokenString(ch);
            return state.tokenize(stream, state);
        }
        // Comments
        if (ch == "/") {
            stream.next();
            if (stream.eat("*")) {
                state.tokenize = tokenComment;
                return tokenComment(stream, state);
            }
            if (stream.eat("/")) {
                stream.skipToEnd();
                return "comment";
            }
            stream.backUp(1);
        }
        // Numeric literals
        if (stream.match(realLiteral) ||
            stream.match(decimalLiteral) ||
            stream.match(binaryLiteral) ||
            stream.match(octLiteral) ||
            stream.match(hexLiteral) ||
            stream.match(unsignedNumber) ||
            stream.match(realLiteral)) {
            return "number";
        }
        // Operators
        if (stream.eatWhile(isOperatorChar)) {
            curPunc = stream.current();
            return "meta";
        }
        // Keywords / plain variables
        if (stream.eatWhile(/[\w\$_]/)) {
            const cur = stream.current();
            if (keywords[cur]) {
                if (openClose[cur]) {
                    curPunc = "newblock";
                    if (cur === "fork") {
                        // Fork can be a statement instead of block in cases of:
                        // "disable fork;" and "wait fork;" (trailing semicolon)
                        stream.eatSpace();
                        if (stream.peek() == ';') {
                            curPunc = "newstatement";
                        }
                        stream.backUp(stream.current().length - cur.length);
                    }
                }
                if (statementKeywords[cur]) {
                    curPunc = "newstatement";
                }
                curKeyword = cur;
                return "keyword";
            }
            return "variableName";
        }
        stream.next();
        return null;
    }
    function tokenString(quote) {
        return function (stream, state) {
            let escaped = false, next, end = false;
            while ((next = stream.next()) != null) {
                if (next == quote && !escaped) {
                    end = true;
                    break;
                }
                escaped = !escaped && next == "\\";
            }
            if (end || !(escaped || multiLineStrings))
                state.tokenize = tokenBase;
            return "string";
        };
    }
    function tokenComment(stream, state) {
        let maybeEnd = false, ch;
        while ((ch = stream.next())) {
            if (ch == "/" && maybeEnd) {
                state.tokenize = tokenBase;
                break;
            }
            maybeEnd = ch == "*";
        }
        return "comment";
    }
    function pushContext(state, col, type, scopekind) {
        const indent = state.indented;
        const c = {
            indented: indent,
            column: col,
            type: type,
            scopekind: scopekind ? scopekind : "",
            align: null,
            prev: state.context
        };
        return (state.context = c);
    }
    function popContext(state) {
        const t = state.context.type;
        if (t == ")" || t == "]" || t == "}") {
            state.indented = state.context.indented;
        }
        return (state.context = state.context.prev);
    }
    function isClosing(text, contextClosing) {
        if (text == contextClosing) {
            return true;
        }
        else {
            // contextClosing may be multiple keywords separated by ;
            const closingKeywords = contextClosing.split(";");
            for (const i in closingKeywords) {
                if (text == closingKeywords[i]) {
                    return true;
                }
            }
            return false;
        }
    }
    function isInsideScopeKind(ctx, scopekind) {
        if (ctx == null) {
            return false;
        }
        if (ctx.scopekind === scopekind) {
            return true;
        }
        return isInsideScopeKind(ctx.prev, scopekind);
    }
    return {
        startState() {
            return {
                tokenize: null,
                context: {
                    indented: 0,
                    column: 0,
                    type: "top",
                    scopekind: "top",
                    align: false,
                    prev: null
                },
                indented: 0,
                compilerDirectiveIndented: 0,
                startOfLine: true
            };
        },
        token(stream, state) {
            let ctx = state.context;
            if (stream.sol()) {
                if (ctx.align == null)
                    ctx.align = false;
                state.indented = stream.indentation();
                state.startOfLine = true;
            }
            if (stream.eatSpace())
                return null;
            curPunc = null;
            curKeyword = null;
            const style = (state.tokenize || tokenBase)(stream, state);
            if (style == "comment" || style == "meta" || style == "variableName") {
                if ((curPunc === "=" || curPunc === "<=") &&
                    !isInsideScopeKind(ctx, "assignment")) {
                    // '<=' could be nonblocking assignment or lessthan-equals (which shouldn't cause indent)
                    //      Search through the context to see if we are already in an assignment.
                    // '=' could be inside port declaration with comma or ')' afterward, or inside for(;;) block.
                    pushContext(state, stream.column() + curPunc.length, "assignment", "assignment");
                    if (ctx.align == null)
                        ctx.align = true;
                }
                return style;
            }
            if (ctx.align == null)
                ctx.align = true;
            const isClosingAssignment = ctx.type == "assignment" &&
                closingBracket.test(curPunc) &&
                ctx.prev &&
                ctx.prev.type === curPunc;
            if (curPunc == ctx.type || isClosingAssignment) {
                if (isClosingAssignment) {
                    ctx = popContext(state);
                }
                ctx = popContext(state);
                if (curPunc == ")") {
                    // Handle closing macros, assuming they could have a semicolon or begin/end block inside.
                    if (ctx && ctx.type === "macro") {
                        ctx = popContext(state);
                        while (ctx && (ctx.type == "statement" || ctx.type == "assignment"))
                            ctx = popContext(state);
                    }
                }
                else if (curPunc == "}") {
                    // Handle closing statements like constraint block: "foreach () {}" which
                    // do not have semicolon at end.
                    if (ctx && ctx.type === "statement") {
                        while (ctx && ctx.type == "statement")
                            ctx = popContext(state);
                    }
                }
            }
            else if (((curPunc == ";" || curPunc == ",") &&
                (ctx.type == "statement" || ctx.type == "assignment")) ||
                (ctx.type && isClosing(curKeyword, ctx.type))) {
                ctx = popContext(state);
                while (ctx && (ctx.type == "statement" || ctx.type == "assignment"))
                    ctx = popContext(state);
            }
            else if (curPunc == "{") {
                pushContext(state, stream.column(), "}");
            }
            else if (curPunc == "[") {
                pushContext(state, stream.column(), "]");
            }
            else if (curPunc == "(") {
                pushContext(state, stream.column(), ")");
            }
            else if (ctx && ctx.type == "endcase" && curPunc == ":") {
                pushContext(state, stream.column(), "statement", "case");
            }
            else if (curPunc == "newstatement") {
                pushContext(state, stream.column(), "statement", curKeyword);
            }
            else if (curPunc == "newblock") {
                if (curKeyword == "function" &&
                    ctx &&
                    (ctx.type == "statement" || ctx.type == "endgroup")) {
                    // The 'function' keyword can appear in some other contexts where it actually does not
                    // indicate a function (import/export DPI and covergroup definitions).
                    // Do nothing in this case
                }
                else if (curKeyword == "task" && ctx && ctx.type == "statement") {
                    // Same thing for task
                }
                else if (curKeyword == "class" && ctx && ctx.type == "statement") {
                    // Same thing for class (e.g. typedef)
                }
                else {
                    const close = openClose[curKeyword];
                    pushContext(state, stream.column(), close, curKeyword);
                }
            }
            else if (curPunc == "newmacro" ||
                (curKeyword && curKeyword.match(compilerDirectiveRegex))) {
                if (curPunc == "newmacro") {
                    // Macros (especially if they have parenthesis) potentially have a semicolon
                    // or complete statement/block inside, and should be treated as such.
                    pushContext(state, stream.column(), "macro", "macro");
                }
                if (curKeyword && curKeyword.match(compilerDirectiveEndRegex)) {
                    state.compilerDirectiveIndented -= statementIndentUnit;
                }
                if (curKeyword && curKeyword.match(compilerDirectiveBeginRegex)) {
                    state.compilerDirectiveIndented += statementIndentUnit;
                }
            }
            state.startOfLine = false;
            return style;
        },
        blankLine(state) {
            // Optional: handle blank lines
        }
    };
}
/**
 * Language support for Verilog
 */
function verilog() {
    return new language_2.LanguageSupport(language_1.StreamLanguage.define(createVerilogParser()));
}
/**
 * Language support for SystemVerilog
 */
function systemverilog() {
    return new language_2.LanguageSupport(language_1.StreamLanguage.define(createVerilogParser()));
}
//# sourceMappingURL=lang-verilog.js.map