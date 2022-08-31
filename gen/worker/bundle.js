(() => {
  var __defProp = Object.defineProperty;
  var __getOwnPropSymbols = Object.getOwnPropertySymbols;
  var __hasOwnProp = Object.prototype.hasOwnProperty;
  var __propIsEnum = Object.prototype.propertyIsEnumerable;
  var __defNormalProp = (obj, key, value) => key in obj ? __defProp(obj, key, { enumerable: true, configurable: true, writable: true, value }) : obj[key] = value;
  var __spreadValues = (a, b) => {
    for (var prop in b || (b = {}))
      if (__hasOwnProp.call(b, prop))
        __defNormalProp(a, prop, b[prop]);
    if (__getOwnPropSymbols)
      for (var prop of __getOwnPropSymbols(b)) {
        if (__propIsEnum.call(b, prop))
          __defNormalProp(a, prop, b[prop]);
      }
    return a;
  };

  // src/common/util.ts
  function hex(v, nd) {
    if (!nd)
      nd = 2;
    if (nd == 8) {
      return hex(v >> 16 & 65535, 4) + hex(v & 65535, 4);
    } else {
      return toradix(v, nd, 16);
    }
  }
  function toradix(v, nd, radix) {
    try {
      var s = v.toString(radix).toUpperCase();
      while (s.length < nd)
        s = "0" + s;
      return s;
    } catch (e) {
      return v + "";
    }
  }
  function getBasePlatform(platform) {
    return platform.split(".")[0];
  }
  function getRootPlatform(platform) {
    return platform.split("-")[0];
  }
  function getRootBasePlatform(platform) {
    return getRootPlatform(getBasePlatform(platform));
  }
  var XMLParseError = class extends Error {
  };
  function escapeXML(s) {
    if (s.indexOf("&") >= 0) {
      return s.replace(/&apos;/g, "'").replace(/&quot;/g, '"').replace(/&gt;/g, ">").replace(/&lt;/g, "<").replace(/&amp;/g, "&");
    } else {
      return s;
    }
  }
  function parseXMLPoorly(s, openfn, closefn) {
    const tag_re = /[<]([/]?)([?a-z_-]+)([^>]*)[>]+|(\s*[^<]+)/gi;
    const attr_re = /\s*(\w+)="(.*?)"\s*/gi;
    var fm;
    var stack = [];
    var top;
    function closetop() {
      top = stack.pop();
      if (top == null || top.type != ident)
        throw new XMLParseError("mismatch close tag: " + ident);
      if (closefn) {
        top.obj = closefn(top);
      }
      if (stack.length == 0)
        throw new XMLParseError("close tag without open: " + ident);
      stack[stack.length - 1].children.push(top);
    }
    function parseattrs(as) {
      var am;
      var attrs2 = {};
      if (as != null) {
        while (am = attr_re.exec(as)) {
          attrs2[am[1]] = escapeXML(am[2]);
        }
      }
      return attrs2;
    }
    while (fm = tag_re.exec(s)) {
      var [_m0, close, ident, attrs, content] = fm;
      if (close) {
        closetop();
      } else if (ident) {
        var node = { type: ident, text: null, children: [], attrs: parseattrs(attrs), obj: null };
        stack.push(node);
        if (attrs) {
          parseattrs(attrs);
        }
        if (openfn) {
          node.obj = openfn(node);
        }
        if (attrs && attrs.endsWith("/"))
          closetop();
      } else if (content != null) {
        if (stack.length == 0)
          throw new XMLParseError("content without element");
        var txt = escapeXML(content).trim();
        if (txt.length)
          stack[stack.length - 1].text = txt;
      }
    }
    if (stack.length != 1)
      throw new XMLParseError("tag not closed");
    if (stack[0].type != "?xml")
      throw new XMLParseError("?xml needs to be first element");
    return top;
  }

  // src/common/basic/compiler.ts
  var CompileError = class extends Error {
    constructor(msg, loc) {
      super(msg);
      Object.setPrototypeOf(this, CompileError.prototype);
      this.$loc = loc;
    }
  };
  var re_toks = /([0-9.]+[E][+-]?\d+|\d+[.][E0-9]*|[.][E0-9]+)|[0]*(\d+)|&([OH][0-9A-F]+)|(['].*)|([A-Z_]\w*[$]?)|(".*?")|([<>]?[=<>#])|(\*\*)|([-+*/^,;:()\[\]\?\\])|(\S+)|(\s+)/gi;
  var TokenType;
  (function(TokenType3) {
    TokenType3[TokenType3["EOL"] = 0] = "EOL";
    TokenType3[TokenType3["Float"] = 1] = "Float";
    TokenType3[TokenType3["Int"] = 2] = "Int";
    TokenType3[TokenType3["HexOctalInt"] = 3] = "HexOctalInt";
    TokenType3[TokenType3["Remark"] = 4] = "Remark";
    TokenType3[TokenType3["Ident"] = 5] = "Ident";
    TokenType3[TokenType3["String"] = 6] = "String";
    TokenType3[TokenType3["Relational"] = 7] = "Relational";
    TokenType3[TokenType3["DoubleStar"] = 8] = "DoubleStar";
    TokenType3[TokenType3["Operator"] = 9] = "Operator";
    TokenType3[TokenType3["CatchAll"] = 10] = "CatchAll";
    TokenType3[TokenType3["Whitespace"] = 11] = "Whitespace";
    TokenType3[TokenType3["_LAST"] = 12] = "_LAST";
  })(TokenType || (TokenType = {}));
  var OPERATORS = {
    "IMP": { f: "bimp", p: 4 },
    "EQV": { f: "beqv", p: 5 },
    "XOR": { f: "bxor", p: 6 },
    "OR": { f: "bor", p: 7 },
    "AND": { f: "band", p: 8 },
    "||": { f: "lor", p: 17 },
    "&&": { f: "land", p: 18 },
    "=": { f: "eq", p: 50 },
    "==": { f: "eq", p: 50 },
    "<>": { f: "ne", p: 50 },
    "><": { f: "ne", p: 50 },
    "!=": { f: "ne", p: 50 },
    "#": { f: "ne", p: 50 },
    "<": { f: "lt", p: 50 },
    ">": { f: "gt", p: 50 },
    "<=": { f: "le", p: 50 },
    ">=": { f: "ge", p: 50 },
    "MIN": { f: "min", p: 75 },
    "MAX": { f: "max", p: 75 },
    "+": { f: "add", p: 100 },
    "-": { f: "sub", p: 100 },
    "%": { f: "mod", p: 140 },
    "MOD": { f: "mod", p: 140 },
    "\\": { f: "idiv", p: 150 },
    "*": { f: "mul", p: 200 },
    "/": { f: "div", p: 200 },
    "^": { f: "pow", p: 300 },
    "**": { f: "pow", p: 300 }
  };
  function getOperator(op) {
    return OPERATORS[op];
  }
  function getPrecedence(tok) {
    switch (tok.type) {
      case 9:
      case 8:
      case 7:
      case 5:
        let op = getOperator(tok.str);
        if (op)
          return op.p;
    }
    return -1;
  }
  function isEOS(tok) {
    return tok.type == 0 || tok.type == 4 || tok.str == ":" || tok.str == "ELSE";
  }
  function stripQuotes(s) {
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
      path: a.path || b.path
    };
  }
  var BASICParser = class {
    constructor() {
      this.opts = DIALECTS["DEFAULT"];
      this.maxlinelen = 255;
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
      this.errors.push({ path: loc.path, line: loc.line, label: this.curlabel, start: loc.start, end: loc.end, msg });
    }
    compileError(msg, loc, loc2) {
      this.addError(msg, loc);
      throw new CompileError(msg, loc);
    }
    dialectError(what, loc) {
      this.compileError(`${what} in this dialect of BASIC (${this.opts.dialectName}).`, loc);
    }
    dialectErrorNoSupport(what, loc) {
      this.compileError(`You can't use ${what} in this dialect of BASIC (${this.opts.dialectName}).`, loc);
    }
    consumeToken() {
      var tok = this.lasttoken = this.tokens.shift() || this.eol;
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
        this.compileError(msg || `There should be a ${strlist.map((s) => `"${s}"`).join(" or ")} here.`);
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
    parseOptLabel() {
      let tok = this.consumeToken();
      switch (tok.type) {
        case 5:
          if (this.opts.optionalLabels || tok.str == "OPTION") {
            if (this.peekToken().str == ":" && !this.supportsCommand(tok.str)) {
              this.consumeToken();
            } else {
              this.pushbackToken(tok);
              break;
            }
          } else
            this.dialectError(`Each line must begin with a line number`);
        case 2:
          this.addLabel(tok.str);
          return;
        case 3:
        case 1:
          this.compileError(`Line numbers must be positive integers.`);
          break;
        case 9:
          if (this.supportsCommand(tok.str) && this.validKeyword(tok.str)) {
            this.pushbackToken(tok);
            break;
          }
        default:
          if (this.opts.optionalLabels)
            this.compileError(`A line must start with a line number, command, or label.`);
          else
            this.compileError(`A line must start with a line number.`);
        case 4:
          break;
      }
      this.addLabel("#" + this.lineno);
    }
    getPC() {
      return this.stmts.length;
    }
    addStatement(stmt, cmdtok, endtok) {
      if (endtok == null)
        endtok = this.peekToken();
      stmt.$loc = {
        path: cmdtok.$loc.path,
        line: cmdtok.$loc.line,
        start: cmdtok.$loc.start,
        end: endtok.$loc.start,
        label: this.curlabel,
        offset: this.stmts.length
      };
      this.modifyScope(stmt);
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
      } catch (e) {
        if (!(e instanceof CompileError))
          throw e;
      }
    }
    _tokenize(line) {
      let splitre = this.opts.optionalWhitespace && new RegExp("(" + this.opts.validKeywords.map((s) => `${s}`).join("|") + ")");
      var lastTokType = 10;
      var m;
      while (m = re_toks.exec(line)) {
        for (var i = 1; i <= lastTokType; i++) {
          let s = m[i];
          if (s != null) {
            let loc = { path: this.path, line: this.lineno, start: m.index, end: m.index + s.length };
            if (this.opts.asciiOnly && !/^[\x00-\x7F]*$/.test(s))
              this.dialectErrorNoSupport(`non-ASCII characters`);
            if (i == 5 || i == 3 || this.opts.uppercaseOnly) {
              s = s.toUpperCase();
              if (s == "DATA")
                lastTokType = 11;
              if (s == "DATA")
                splitre = null;
              if (s == "OPTION")
                splitre = null;
              if (lastTokType == 10 && s.startsWith("REM")) {
                s = "REM";
                lastTokType = 0;
              }
            }
            if (s == "[" || s == "]") {
              if (!this.opts.squareBrackets)
                this.dialectErrorNoSupport(`square brackets`);
              if (s == "[")
                s = "(";
              if (s == "]")
                s = ")";
            }
            if (splitre && i == 5) {
              var splittoks = s.split(splitre).filter((s2) => s2 != "");
              if (splittoks.length > 1) {
                splittoks.forEach((ss) => {
                  if (/^[0-9]+$/.test(ss))
                    i = 2;
                  else if (/^[A-Z_]\w*[$]?$/.test(ss))
                    i = 5;
                  else
                    this.compileError(`Try adding whitespace before "${ss}".`);
                  this.tokens.push({ str: ss, type: i, $loc: loc });
                });
                s = null;
              }
            }
            if (s)
              this.tokens.push({ str: s, type: i, $loc: loc });
            break;
          }
        }
      }
    }
    tokenize(line) {
      this.lineno++;
      this.tokens = [];
      this.eol = { type: 0, str: "", $loc: { path: this.path, line: this.lineno, start: line.length } };
      if (line.length > this.maxlinelen)
        this.compileError(`A line should be no more than ${this.maxlinelen} characters long.`);
      this._tokenize(line);
    }
    parse() {
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
        this.parseList(this.parseStatement, ":");
      } else {
        this.parseList(this.parseStatement, "\0");
        if (this.peekToken().str == ":")
          this.dialectErrorNoSupport(`multiple statements on a line`);
      }
    }
    validKeyword(keyword) {
      return this.opts.validKeywords && this.opts.validKeywords.indexOf(keyword) < 0 ? null : keyword;
    }
    validFunction(funcname) {
      return this.opts.validFunctions && this.opts.validFunctions.indexOf(funcname) < 0 ? null : funcname;
    }
    supportsCommand(cmd) {
      if (cmd == "?")
        return this.stmt__PRINT;
      else
        return this["stmt__" + cmd];
    }
    parseStatement() {
      if (this.opts.optionalWhitespace && this.peekToken().str == ":")
        return null;
      var cmdtok = this.consumeToken();
      var cmd = cmdtok.str;
      var stmt;
      switch (cmdtok.type) {
        case 4:
          if (cmdtok.str.startsWith("'") && !this.opts.tickComments)
            this.dialectErrorNoSupport(`tick comments`);
          return null;
        case 9:
          if (cmd == this.validKeyword("?"))
            cmd = "PRINT";
        case 5:
          if (cmd == "REM")
            return null;
          if (cmd == "GO" && this.peekToken().str == "TO") {
            this.consumeToken();
            cmd = "GOTO";
          } else if (cmd == "GO" && this.peekToken().str == "SUB") {
            this.consumeToken();
            cmd = "GOSUB";
          }
          var fn = this.supportsCommand(cmd);
          if (fn) {
            if (this.validKeyword(cmd) == null)
              this.dialectErrorNoSupport(`the ${cmd} statement`);
            stmt = fn.bind(this)();
            break;
          } else if (this.peekToken().str == "=" || this.peekToken().str == "(") {
            if (!this.opts.optionalLet)
              this.dialectError(`Assignments must have a preceding LET`);
            this.pushbackToken(cmdtok);
            stmt = this.stmt__LET();
            break;
          } else {
            this.compileError(`I don't understand the command "${cmd}".`);
          }
        case 0:
          if (this.opts.optionalWhitespace)
            return null;
        default:
          this.compileError(`There should be a command here.`);
          return null;
      }
      if (stmt != null)
        this.addStatement(stmt, cmdtok);
      return stmt;
    }
    modifyScope(stmt) {
      if (this.opts.compiledBlocks) {
        var cmd = stmt.command;
        if (cmd == "FOR" || cmd == "WHILE" || cmd == "SUB") {
          this.scopestack.push(this.getPC());
        } else if (cmd == "NEXT") {
          this.popScope(stmt, "FOR");
        } else if (cmd == "WEND") {
          this.popScope(stmt, "WHILE");
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
      else if (close.command == "NEXT" && !this.opts.optionalNextVar && close.lexpr.name != popstmt.lexpr.name)
        this.compileError(`This NEXT statement is matched with the wrong FOR variable (${close.lexpr.name}).`, close.$loc, popstmt.$loc);
      close.startpc = popidx;
      popstmt.endpc = this.getPC();
    }
    popIfThenScope(nextpc) {
      var popidx = this.scopestack.pop();
      var popstmt = popidx != null ? this.stmts[popidx] : null;
      if (popstmt == null)
        this.compileError(`There's an END IF without a matching IF or ELSE.`);
      if (popstmt.command == "ELSE") {
        popstmt.endpc = this.getPC();
        this.popIfThenScope(popidx + 1);
      } else if (popstmt.command == "IF") {
        popstmt.endpc = nextpc != null ? nextpc : this.getPC();
      } else {
        this.compileError(`There's an END IF paired with a ${popstmt.command}, not IF or ELSE.`, this.lasttoken.$loc, popstmt.$loc);
      }
    }
    parseVarSubscriptOrFunc() {
      var tok = this.consumeToken();
      switch (tok.type) {
        case 5:
          let args = null;
          if (this.peekToken().str == "(") {
            this.expectToken("(");
            args = this.parseExprList();
            this.expectToken(")", `There should be another expression or a ")" here.`);
          }
          var loc = mergeLocs(tok.$loc, this.lasttoken.$loc);
          var valtype = this.exprTypeForSubscript(tok.str, args, loc);
          return { valtype, name: tok.str, args, $loc: loc };
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
      if (lexpr.args || lexpr.name.endsWith("$"))
        this.compileError(`A FOR ... NEXT loop can only use numeric variables.`, lexpr.$loc);
      return lexpr;
    }
    parseList(parseFunc, delim) {
      var sep;
      var list = [];
      do {
        var el = parseFunc.bind(this)();
        if (el != null)
          list.push(el);
        sep = this.consumeToken();
      } while (sep.str == delim);
      this.pushbackToken(sep);
      return list;
    }
    parseLexprList() {
      return this.parseList(this.parseLexpr, ",");
    }
    parseExprList() {
      return this.parseList(this.parseExpr, ",");
    }
    parseLabelList() {
      return this.parseList(this.parseLabel, ",");
    }
    parseLabel() {
      if (this.opts.computedGoto) {
        var expr = this.parseExpr();
        if (isLiteral(expr))
          this.targets[expr.value] = this.lasttoken.$loc;
        return expr;
      } else {
        var tok = this.consumeToken();
        switch (tok.type) {
          case 5:
            if (!this.opts.optionalLabels)
              this.dialectError(`All labels must be line numbers`);
          case 2:
            var label = tok.str;
            this.targets[label] = tok.$loc;
            return { valtype: "label", value: label };
          default:
            var what = this.opts.optionalLabels ? "label or line number" : "line number";
            this.compileError(`There should be a ${what} here.`);
        }
      }
    }
    parseDatumList() {
      return this.parseList(this.parseDatum, ",");
    }
    parseDatum() {
      var tok = this.consumeToken();
      while (tok.type == 11)
        tok = this.consumeToken();
      if (isEOS(tok))
        this.compileError(`There should be a datum here.`);
      if (tok.type <= 3) {
        return this.parseValue(tok);
      }
      if (tok.str == "-" && this.peekToken().type <= 3) {
        tok = this.consumeToken();
        return { valtype: "number", value: -this.parseValue(tok).value };
      }
      if (tok.str == "+" && this.peekToken().type <= 3) {
        tok = this.consumeToken();
        return this.parseValue(tok);
      }
      var s = "";
      while (!isEOS(tok) && tok.str != ",") {
        s += this.parseValue(tok).value;
        tok = this.consumeToken();
      }
      this.pushbackToken(tok);
      return { valtype: "string", value: s };
    }
    parseValue(tok) {
      switch (tok.type) {
        case 3:
          if (!this.opts.hexOctalConsts)
            this.dialectErrorNoSupport(`hex/octal constants`);
          let base = tok.str.startsWith("H") ? 16 : 8;
          return { valtype: "number", value: parseInt(tok.str.substr(1), base) };
        case 2:
        case 1:
          return { valtype: "number", value: this.parseNumber(tok.str) };
        case 6:
          return { valtype: "string", value: stripQuotes(tok.str) };
        default:
          return { valtype: "string", value: tok.str };
      }
    }
    parsePrimary() {
      let tok = this.consumeToken();
      switch (tok.type) {
        case 3:
        case 2:
        case 1:
        case 6:
          return this.parseValue(tok);
        case 5:
          if (tok.str == "NOT") {
            let expr = this.parsePrimary();
            return { valtype: "number", op: this.opts.bitwiseLogic ? "bnot" : "lnot", expr };
          } else {
            this.pushbackToken(tok);
            return this.parseVarSubscriptOrFunc();
          }
        case 9:
          if (tok.str == "(") {
            let expr = this.parseExpr();
            this.expectToken(")", `There should be another expression or a ")" here.`);
            return expr;
          } else if (tok.str == "-") {
            let expr = this.parsePrimary();
            return { valtype: "number", op: "neg", expr };
          } else if (tok.str == "+") {
            return this.parsePrimary();
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
        if (!this.opts.bitwiseLogic && op.str == "AND")
          opfn = "land";
        if (!this.opts.bitwiseLogic && op.str == "OR")
          opfn = "lor";
        var valtype = this.exprTypeForOp(opfn, left, right, op);
        left = { valtype, op: opfn, left, right };
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
        case "A":
          if (!/^[A-Z]$/i.test(lexpr.name))
            this.dialectErrorNoSupport(`variable names other than a single letter`);
          break;
        case "A1":
          if (lexpr.args == null && !/^[A-Z][0-9]?[$]?$/i.test(lexpr.name))
            this.dialectErrorNoSupport(`variable names other than a letter followed by an optional digit`);
          if (lexpr.args != null && !/^[A-Z]?[$]?$/i.test(lexpr.name))
            this.dialectErrorNoSupport(`array names other than a single letter`);
          break;
        case "A1$":
          if (!/^[A-Z][0-9]?[$]?$/i.test(lexpr.name))
            this.dialectErrorNoSupport(`variable names other than a letter followed by an optional digit`);
          break;
        case "AA":
          if (lexpr.args == null && !/^[A-Z][A-Z0-9]?[$]?$/i.test(lexpr.name))
            this.dialectErrorNoSupport(`variable names other than a letter followed by an optional letter or digit`);
          break;
        case "*":
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
    exprTypeForOp(fnname, left, right, optok) {
      if (left.valtype == "string" || right.valtype == "string") {
        if (fnname == "add") {
          if (this.opts.stringConcat)
            return "string";
          else
            this.dialectErrorNoSupport(`the "+" operator to concatenate strings`, optok.$loc);
        } else if (fnname.length != 2)
          this.compileError(`You can't do math on strings until they're converted to numbers.`, optok.$loc);
      }
      return "number";
    }
    exprTypeForSubscript(fnname, args, loc) {
      args = args || [];
      var defs = BUILTIN_MAP[fnname];
      if (defs != null) {
        if (!this.validFunction(fnname))
          this.dialectErrorNoSupport(`the ${fnname} function`, loc);
        for (var def of defs) {
          if (args.length == def.args.length)
            return def.result;
        }
        this.compileError(`The ${fnname} function takes ${def.args.length} arguments, but ${args.length} are given.`, loc);
      }
      this.varrefs[fnname] = loc;
      return fnname.endsWith("$") ? "string" : "number";
    }
    stmt__LET() {
      var lexprs = [this.parseLexpr()];
      this.expectToken("=");
      while (this.opts.chainAssignments && this.peekToken().type == 5 && this.peekToken(1).str == "=") {
        lexprs.push(this.parseLexpr());
        this.expectToken("=");
      }
      var right = this.parseExprWithType(lexprs[0].valtype);
      return { command: "LET", lexprs, right };
    }
    stmt__PRINT() {
      var sep, lastsep;
      var list = [];
      do {
        sep = this.peekToken();
        if (isEOS(sep)) {
          break;
        } else if (sep.str == ";") {
          this.consumeToken();
          lastsep = sep;
        } else if (sep.str == ",") {
          this.consumeToken();
          list.push({ value: "	" });
          lastsep = sep;
        } else {
          list.push(this.parseExpr());
          lastsep = null;
        }
      } while (true);
      if (!(lastsep && (lastsep.str == ";" || sep.str != ","))) {
        list.push({ value: "\n" });
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
      if (this.peekToken().str == this.validKeyword("OF")) {
        this.expectToken("OF");
        let newcmd = cmd == "GOTO" ? "ONGOTO" : "ONGOSUB";
        return { command: newcmd, expr, labels: this.parseLabelList() };
      } else {
        return { command: cmd, label: expr };
      }
    }
    stmt__IF() {
      var cmdtok = this.lasttoken;
      var cond = this.parseExprWithType("number");
      var ifstmt = { command: "IF", cond };
      this.addStatement(ifstmt, cmdtok);
      var thengoto = this.expectTokens(["THEN", "GOTO", "GO"]);
      if (thengoto.str == "GO")
        this.expectToken("TO");
      if (this.opts.multilineIfThen && isEOS(this.peekToken())) {
        this.scopestack.push(this.getPC() - 1);
      } else {
        this.parseGotoOrStatements();
        if (this.peekToken().str == "ELSE") {
          this.expectToken("ELSE");
          ifstmt.endpc = this.getPC() + 1;
          this.stmt__ELSE();
        } else {
          ifstmt.endpc = this.getPC();
        }
      }
    }
    stmt__ELSE() {
      var elsestmt = { command: "ELSE" };
      this.addStatement(elsestmt, this.lasttoken);
      var nexttok = this.peekToken();
      if (this.opts.multilineIfThen && isEOS(nexttok)) {
        this.scopestack.push(this.getPC() - 1);
      } else if (this.opts.multilineIfThen && nexttok.str == "IF") {
        this.scopestack.push(this.getPC() - 1);
        this.parseGotoOrStatements();
        this.elseifcount++;
      } else {
        this.parseGotoOrStatements();
        elsestmt.endpc = this.getPC();
      }
    }
    parseGotoOrStatements() {
      var lineno = this.peekToken();
      if (lineno.type == 2) {
        this.parseLabel();
        var gotostmt = { command: "GOTO", label: { valtype: "label", value: lineno.str } };
        this.addStatement(gotostmt, lineno);
      } else {
        this.parseCompoundStatement();
      }
    }
    stmt__FOR() {
      var lexpr = this.parseForNextLexpr();
      this.expectToken("=");
      var init = this.parseExprWithType("number");
      this.expectToken("TO");
      var targ = this.parseExprWithType("number");
      if (this.peekToken().str == "STEP") {
        this.consumeToken();
        var step = this.parseExprWithType("number");
      }
      return { command: "FOR", lexpr, initial: init, target: targ, step };
    }
    stmt__NEXT() {
      var lexpr = null;
      if (!this.opts.optionalNextVar || !isEOS(this.peekToken())) {
        lexpr = this.parseForNextLexpr();
        if (this.opts.multipleNextVars && this.peekToken().str == ",") {
          this.consumeToken();
          this.tokens.unshift({ type: 5, str: "NEXT", $loc: this.peekToken().$loc });
          this.tokens.unshift({ type: 9, str: ":", $loc: this.peekToken().$loc });
        }
      }
      return { command: "NEXT", lexpr };
    }
    stmt__WHILE() {
      var cond = this.parseExprWithType("number");
      return { command: "WHILE", cond };
    }
    stmt__WEND() {
      return { command: "WEND" };
    }
    stmt__DIM() {
      var lexprs = this.parseLexprList();
      lexprs.forEach((arr) => {
        if (arr.args == null || arr.args.length == 0)
          this.compileError(`An array defined by DIM must have at least one dimension.`);
        else if (arr.args.length > this.opts.maxDimensions)
          this.dialectErrorNoSupport(`arrays with more than ${this.opts.maxDimensions} dimensionals`);
        for (var arrdim of arr.args) {
          if (arrdim.valtype != "number")
            this.compileError(`Array dimensions must be numeric.`, arrdim.$loc);
          if (isLiteral(arrdim) && arrdim.value < this.opts.defaultArrayBase)
            this.compileError(`An array dimension cannot be less than ${this.opts.defaultArrayBase}.`, arrdim.$loc);
        }
      });
      return { command: "DIM", args: lexprs };
    }
    stmt__INPUT() {
      var prompt = this.consumeToken();
      var promptstr;
      if (prompt.type == 6) {
        this.expectTokens([";", ","]);
        promptstr = stripQuotes(prompt.str);
      } else {
        this.pushbackToken(prompt);
        promptstr = "";
      }
      return { command: "INPUT", prompt: { valtype: "string", value: promptstr }, args: this.parseLexprList() };
    }
    stmt__ENTER() {
      var timeout = this.parseExpr();
      this.expectToken(",");
      var elapsed = this.parseLexpr();
      this.expectToken(",");
      return { command: "INPUT", prompt: null, args: this.parseLexprList(), timeout, elapsed };
    }
    stmt__DATA() {
      return { command: "DATA", datums: this.parseDatumList() };
    }
    stmt__READ() {
      return { command: "READ", args: this.parseLexprList() };
    }
    stmt__RESTORE() {
      var label = null;
      if (this.opts.restoreWithLabel && !isEOS(this.peekToken()))
        label = this.parseLabel();
      return { command: "RESTORE", label };
    }
    stmt__RETURN() {
      return { command: "RETURN" };
    }
    stmt__STOP() {
      return { command: "STOP" };
    }
    stmt__END() {
      if (this.opts.multilineIfThen && this.scopestack.length) {
        let endtok = this.expectTokens(["IF", "SUB"]);
        if (endtok.str == "IF") {
          this.popIfThenScope();
          while (this.elseifcount--)
            this.popIfThenScope();
          this.elseifcount = 0;
        } else if (endtok.str == "SUB") {
          this.addStatement({ command: "RETURN" }, endtok);
          this.popScope({ command: "END" }, "SUB");
        }
      } else {
        return { command: "END" };
      }
    }
    stmt__ON() {
      var expr = this.parseExprWithType("number");
      var gotok = this.consumeToken();
      var cmd = { GOTO: "ONGOTO", THEN: "ONGOTO", GOSUB: "ONGOSUB" }[gotok.str];
      if (!cmd)
        this.compileError(`There should be a GOTO or GOSUB here.`);
      var labels = this.parseLabelList();
      return { command: cmd, expr, labels };
    }
    stmt__DEF() {
      var lexpr = this.parseVarSubscriptOrFunc();
      if (lexpr.args && lexpr.args.length > this.opts.maxDefArgs)
        this.compileError(`There can be no more than ${this.opts.maxDefArgs} arguments to a function or subscript.`, lexpr.$loc);
      if (!lexpr.name.startsWith("FN"))
        this.compileError(`Functions defined with DEF must begin with the letters "FN".`, lexpr.$loc);
      this.markVarDefs(lexpr);
      this.expectToken("=");
      var func = this.parseExpr();
      this.visitExpr(func, (expr) => {
        if (isLookup(expr) && expr.name.startsWith("FN")) {
          if (!this.fnrefs[lexpr.name])
            this.fnrefs[lexpr.name] = [];
          this.fnrefs[lexpr.name].push(expr.name);
        }
      });
      this.checkCallGraph(lexpr.name, new Set());
      return { command: "DEF", lexpr, def: func };
    }
    stmt__SUB() {
      var lexpr = this.parseVarSubscriptOrFunc();
      this.markVarDefs(lexpr);
      this.addLabel(lexpr.name, 1);
      return { command: "SUB", lexpr };
    }
    stmt__CALL() {
      return { command: "CALL", call: this.parseVarSubscriptOrFunc() };
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
    checkCallGraph(name, visited) {
      if (visited.has(name))
        this.compileError(`There was a cycle in the function definition graph for ${name}.`);
      visited.add(name);
      var refs = this.fnrefs[name] || [];
      for (var ref of refs)
        this.checkCallGraph(ref, visited);
      visited.delete(name);
    }
    stmt__POP() {
      return { command: "POP" };
    }
    stmt__GET() {
      var lexpr = this.parseLexpr();
      return { command: "GET", lexpr };
    }
    stmt__CLEAR() {
      return { command: "CLEAR" };
    }
    stmt__RANDOMIZE() {
      return { command: "RANDOMIZE" };
    }
    stmt__CHANGE() {
      var src = this.parseExpr();
      this.expectToken("TO");
      var dest = this.parseLexpr();
      if (dest.valtype == src.valtype)
        this.compileError(`CHANGE can only convert strings to numeric arrays, or vice-versa.`, mergeLocs(src.$loc, dest.$loc));
      return { command: "CHANGE", src, dest };
    }
    stmt__CONVERT() {
      var src = this.parseExpr();
      this.expectToken("TO");
      var dest = this.parseLexpr();
      if (dest.valtype == src.valtype)
        this.compileError(`CONVERT can only convert strings to numbers, or vice-versa.`, mergeLocs(src.$loc, dest.$loc));
      return { command: "CONVERT", src, dest };
    }
    stmt__OPTION() {
      this.optionCount++;
      var tokname = this.consumeToken();
      var optname = tokname.str.toUpperCase();
      if (tokname.type != 5)
        this.compileError(`There must be a name after the OPTION statement.`);
      var tokarg = this.consumeToken();
      var arg = tokarg.str.toUpperCase();
      switch (optname) {
        case "DIALECT":
          if (this.optionCount > 1)
            this.compileError(`OPTION DIALECT must be the first OPTION statement in the file.`, tokname.$loc);
          let dname = arg || "";
          if (dname == "")
            this.compileError(`OPTION DIALECT requires a dialect name.`, tokname.$loc);
          let dialect = DIALECTS[dname.toUpperCase()];
          if (dialect)
            this.opts = dialect;
          else
            this.compileError(`${dname} is not a valid dialect.`);
          break;
        case "BASE":
          let base = parseInt(arg);
          if (base == 0 || base == 1)
            this.opts.defaultArrayBase = base;
          else
            this.compileError("OPTION BASE can only be 0 or 1.");
          break;
        case "CPUSPEED":
          if (!(this.opts.commandsPerSec = Math.min(1e7, arg == "MAX" ? Infinity : parseFloat(arg))))
            this.compileError(`OPTION CPUSPEED takes a positive number or MAX.`);
          break;
        default:
          let propname = Object.getOwnPropertyNames(this.opts).find((n) => n.toUpperCase() == optname);
          if (propname == null)
            this.compileError(`${optname} is not a valid option.`, tokname.$loc);
          if (arg == null)
            this.compileError(`OPTION ${optname} requires a parameter.`);
          switch (typeof this.opts[propname]) {
            case "boolean":
              this.opts[propname] = arg.toUpperCase().startsWith("T") || arg > 0;
              return;
            case "number":
              this.opts[propname] = parseFloat(arg);
              return;
            case "string":
              this.opts[propname] = arg;
              return;
            case "object":
              if (Array.isArray(this.opts[propname]) && arg == "ALL") {
                this.opts[propname] = null;
                return;
              }
              this.compileError(`OPTION ${optname} ALL is the only option supported.`);
          }
          break;
      }
      return { command: "OPTION", optname, optargs: [arg] };
    }
    generateListing(file, program) {
      var srclines = [];
      var laststmt;
      program.stmts.forEach((stmt, idx) => {
        laststmt = stmt;
        srclines.push(stmt.$loc);
      });
      if (this.opts.endStmtRequired && (laststmt == null || laststmt.command != "END"))
        this.dialectError(`All programs must have a final END statement`);
      return { lines: srclines };
    }
    getListings() {
      return this.listings;
    }
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
  };
  var ECMA55_MINIMAL = {
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
      "BASE",
      "DATA",
      "DEF",
      "DIM",
      "END",
      "FOR",
      "GO",
      "GOSUB",
      "GOTO",
      "IF",
      "INPUT",
      "LET",
      "NEXT",
      "ON",
      "OPTION",
      "PRINT",
      "RANDOMIZE",
      "READ",
      "REM",
      "RESTORE",
      "RETURN",
      "STEP",
      "STOP",
      "THEN",
      "TO"
    ],
    validFunctions: [
      "ABS",
      "ATN",
      "COS",
      "EXP",
      "INT",
      "LOG",
      "RND",
      "SGN",
      "SIN",
      "SQR",
      "TAB",
      "TAN"
    ],
    validOperators: [
      "=",
      "<>",
      "<",
      ">",
      "<=",
      ">=",
      "+",
      "-",
      "*",
      "/",
      "^"
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
    compiledBlocks: true
  };
  var DARTMOUTH_4TH_EDITION = {
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
      "BASE",
      "DATA",
      "DEF",
      "DIM",
      "END",
      "FOR",
      "GO",
      "GOSUB",
      "GOTO",
      "IF",
      "INPUT",
      "LET",
      "NEXT",
      "ON",
      "OPTION",
      "PRINT",
      "RANDOMIZE",
      "READ",
      "REM",
      "RESTORE",
      "RETURN",
      "STEP",
      "STOP",
      "THEN",
      "TO",
      "CHANGE",
      "MAT",
      "RANDOM",
      "RESTORE$",
      "RESTORE*"
    ],
    validFunctions: [
      "ABS",
      "ATN",
      "COS",
      "EXP",
      "INT",
      "LOG",
      "RND",
      "SGN",
      "SIN",
      "SQR",
      "TAB",
      "TAN",
      "TRN",
      "INV",
      "DET",
      "NUM",
      "ZER"
    ],
    validOperators: [
      "=",
      "<>",
      "<",
      ">",
      "<=",
      ">=",
      "+",
      "-",
      "*",
      "/",
      "^"
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
    compiledBlocks: true
  };
  var TINY_BASIC = {
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
      "OPTION",
      "PRINT",
      "IF",
      "THEN",
      "GOTO",
      "INPUT",
      "LET",
      "GOSUB",
      "RETURN",
      "CLEAR",
      "END"
    ],
    validFunctions: [],
    validOperators: [
      "=",
      "<>",
      "><",
      "<",
      ">",
      "<=",
      ">=",
      "+",
      "-",
      "*",
      "/"
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
    compiledBlocks: false
  };
  var HP_TIMESHARED_BASIC = {
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
      "BASE",
      "DATA",
      "DEF",
      "DIM",
      "END",
      "FOR",
      "GO",
      "GOSUB",
      "GOTO",
      "IF",
      "INPUT",
      "LET",
      "NEXT",
      "OPTION",
      "PRINT",
      "RANDOMIZE",
      "READ",
      "REM",
      "RESTORE",
      "RETURN",
      "STEP",
      "STOP",
      "THEN",
      "TO",
      "ENTER",
      "MAT",
      "CONVERT",
      "OF",
      "IMAGE",
      "USING"
    ],
    validFunctions: [
      "ABS",
      "ATN",
      "BRK",
      "COS",
      "CTL",
      "EXP",
      "INT",
      "LEN",
      "LIN",
      "LOG",
      "NUM",
      "POS",
      "RND",
      "SGN",
      "SIN",
      "SPA",
      "SQR",
      "TAB",
      "TAN",
      "TIM",
      "TYP",
      "UPS$",
      "NFORMAT$"
    ],
    validOperators: [
      "=",
      "<>",
      "<",
      ">",
      "<=",
      ">=",
      "+",
      "-",
      "*",
      "/",
      "^",
      "**",
      "#",
      "NOT",
      "AND",
      "OR",
      "MIN",
      "MAX"
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
    maxArrayElements: 5e3
  };
  var DEC_BASIC_11 = {
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
      "OPTION",
      "DATA",
      "DEF",
      "DIM",
      "END",
      "FOR",
      "STEP",
      "GOSUB",
      "GOTO",
      "GO",
      "TO",
      "IF",
      "THEN",
      "INPUT",
      "LET",
      "NEXT",
      "ON",
      "PRINT",
      "RANDOMIZE",
      "READ",
      "REM",
      "RESET",
      "RESTORE",
      "RETURN",
      "STOP"
    ],
    validFunctions: [
      "ABS",
      "ATN",
      "COS",
      "EXP",
      "INT",
      "LOG",
      "LOG10",
      "PI",
      "RND",
      "SGN",
      "SIN",
      "SQR",
      "TAB",
      "ASC",
      "BIN",
      "CHR$",
      "CLK$",
      "DAT$",
      "LEN",
      "OCT",
      "POS",
      "SEG$",
      "STR$",
      "TRM$",
      "VAL",
      "NFORMAT$"
    ],
    validOperators: [
      "=",
      "<>",
      "><",
      "<",
      ">",
      "<=",
      ">=",
      "+",
      "-",
      "*",
      "/",
      "^"
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
    compiledBlocks: true
  };
  var DEC_BASIC_PLUS = {
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
      "OPTION",
      "REM",
      "LET",
      "DIM",
      "RANDOM",
      "RANDOMIZE",
      "IF",
      "THEN",
      "ELSE",
      "FOR",
      "TO",
      "STEP",
      "WHILE",
      "UNTIL",
      "NEXT",
      "DEF",
      "ON",
      "GOTO",
      "GOSUB",
      "RETURN",
      "CHANGE",
      "READ",
      "DATA",
      "RESTORE",
      "PRINT",
      "USING",
      "INPUT",
      "LINE",
      "NAME",
      "AS",
      "ERROR",
      "RESUME",
      "CHAIN",
      "STOP",
      "END",
      "MAT",
      "UNLESS",
      "SLEEP",
      "WAIT"
    ],
    validFunctions: [
      "ABS",
      "ATN",
      "COS",
      "EXP",
      "INT",
      "LOG",
      "LOG10",
      "PI",
      "RND",
      "SGN",
      "SIN",
      "SQR",
      "TAB",
      "TAN",
      "POS",
      "TAB",
      "ASCII",
      "CHR$",
      "CVT%$",
      "CVTF$",
      "CVT$%",
      "CVT$F",
      "LEFT$",
      "RIGHT$",
      "MID$",
      "LEN",
      "INSTR",
      "SPACE$",
      "NUM$",
      "VAL",
      "XLATE",
      "DATE$",
      "TIME$",
      "TIME",
      "ERR",
      "ERL",
      "SWAP%",
      "RAD$",
      "NFORMAT$"
    ],
    validOperators: [
      "=",
      "<>",
      "<",
      ">",
      "<=",
      ">=",
      "+",
      "-",
      "*",
      "/",
      "^",
      "**",
      "==",
      "NOT",
      "AND",
      "OR",
      "XOR",
      "IMP",
      "EQV"
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
    compiledBlocks: true
  };
  var BASICODE = {
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
      "BASE",
      "DATA",
      "DEF",
      "DIM",
      "END",
      "FOR",
      "GO",
      "GOSUB",
      "GOTO",
      "IF",
      "INPUT",
      "LET",
      "NEXT",
      "ON",
      "OPTION",
      "PRINT",
      "READ",
      "REM",
      "RESTORE",
      "RETURN",
      "STEP",
      "STOP",
      "THEN",
      "TO",
      "AND",
      "NOT",
      "OR"
    ],
    validFunctions: [
      "ABS",
      "ASC",
      "ATN",
      "CHR$",
      "COS",
      "EXP",
      "INT",
      "LEFT$",
      "LEN",
      "LOG",
      "MID$",
      "RIGHT$",
      "SGN",
      "SIN",
      "SQR",
      "TAB",
      "TAN",
      "VAL"
    ],
    validOperators: [
      "=",
      "<>",
      "<",
      ">",
      "<=",
      ">=",
      "+",
      "-",
      "*",
      "/",
      "^",
      "AND",
      "NOT",
      "OR"
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
    compiledBlocks: false
  };
  var ALTAIR_BASIC41 = {
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
      "OPTION",
      "CONSOLE",
      "DATA",
      "DEF",
      "DEFUSR",
      "DIM",
      "END",
      "ERASE",
      "ERROR",
      "FOR",
      "GOTO",
      "GOSUB",
      "IF",
      "THEN",
      "ELSE",
      "INPUT",
      "LET",
      "LINE",
      "PRINT",
      "LPRINT",
      "USING",
      "NEXT",
      "ON",
      "OUT",
      "POKE",
      "READ",
      "REM",
      "RESTORE",
      "RESUME",
      "RETURN",
      "STOP",
      "SWAP",
      "TROFF",
      "TRON",
      "WAIT",
      "TO",
      "STEP",
      "AND",
      "NOT",
      "OR",
      "XOR",
      "IMP",
      "EQV",
      "MOD",
      "RANDOMIZE"
    ],
    validFunctions: [
      "ABS",
      "ASC",
      "ATN",
      "CDBL",
      "CHR$",
      "CINT",
      "COS",
      "ERL",
      "ERR",
      "EXP",
      "FIX",
      "FRE",
      "HEX$",
      "INP",
      "INSTR",
      "INT",
      "LEFT$",
      "LEN",
      "LOG",
      "LPOS",
      "MID$",
      "OCT$",
      "POS",
      "RIGHT$",
      "RND",
      "SGN",
      "SIN",
      "SPACE$",
      "SPC",
      "SQR",
      "STR$",
      "STRING$",
      "TAB",
      "TAN",
      "USR",
      "VAL",
      "VARPTR"
    ],
    validOperators: [
      "=",
      "<>",
      "<",
      ">",
      "<=",
      ">=",
      "+",
      "-",
      "*",
      "/",
      "^",
      "\\",
      "AND",
      "NOT",
      "OR",
      "XOR",
      "IMP",
      "EQV",
      "MOD"
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
    compiledBlocks: false
  };
  var APPLESOFT_BASIC = {
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
      "OPTION",
      "CLEAR",
      "LET",
      "DIM",
      "DEF",
      "GOTO",
      "GOSUB",
      "RETURN",
      "ON",
      "POP",
      "FOR",
      "NEXT",
      "IF",
      "THEN",
      "END",
      "STOP",
      "ONERR",
      "RESUME",
      "PRINT",
      "INPUT",
      "GET",
      "HOME",
      "HTAB",
      "VTAB",
      "INVERSE",
      "FLASH",
      "NORMAL",
      "TEXT",
      "GR",
      "COLOR",
      "PLOT",
      "HLIN",
      "VLIN",
      "HGR",
      "HGR2",
      "HPLOT",
      "HCOLOR",
      "AT",
      "DATA",
      "READ",
      "RESTORE",
      "REM",
      "TRACE",
      "NOTRACE",
      "TO",
      "STEP",
      "AND",
      "NOT",
      "OR"
    ],
    validFunctions: [
      "ABS",
      "ATN",
      "COS",
      "EXP",
      "INT",
      "LOG",
      "RND",
      "SGN",
      "SIN",
      "SQR",
      "TAN",
      "LEN",
      "LEFT$",
      "MID$",
      "RIGHT$",
      "STR$",
      "VAL",
      "CHR$",
      "ASC",
      "FRE",
      "SCRN",
      "PDL",
      "PEEK",
      "POS"
    ],
    validOperators: [
      "=",
      "<>",
      "<",
      ">",
      "<=",
      ">=",
      "+",
      "-",
      "*",
      "/",
      "^",
      "AND",
      "NOT",
      "OR"
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
    compiledBlocks: false
  };
  var BASIC80 = {
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
    tickComments: true,
    hexOctalConsts: true,
    validKeywords: [
      "OPTION",
      "CONSOLE",
      "DATA",
      "DEF",
      "DEFUSR",
      "DIM",
      "END",
      "ERASE",
      "ERROR",
      "FOR",
      "GOTO",
      "GOSUB",
      "IF",
      "THEN",
      "ELSE",
      "INPUT",
      "LET",
      "LINE",
      "PRINT",
      "LPRINT",
      "USING",
      "NEXT",
      "ON",
      "OUT",
      "POKE",
      "READ",
      "REM",
      "RESTORE",
      "RESUME",
      "RETURN",
      "STOP",
      "SWAP",
      "TROFF",
      "TRON",
      "WAIT",
      "CALL",
      "CHAIN",
      "COMMON",
      "WHILE",
      "WEND",
      "WRITE",
      "RANDOMIZE",
      "TO",
      "STEP",
      "AND",
      "NOT",
      "OR",
      "XOR",
      "IMP",
      "EQV",
      "MOD"
    ],
    validFunctions: [
      "ABS",
      "ASC",
      "ATN",
      "CDBL",
      "CHR$",
      "CINT",
      "COS",
      "CSNG",
      "CVI",
      "CVS",
      "CVD",
      "EOF",
      "EXP",
      "FIX",
      "FRE",
      "HEX$",
      "INP",
      "INPUT$",
      "INSTR",
      "INT",
      "LEFT$",
      "LEN",
      "LOC",
      "LOG",
      "LPOS",
      "MID$",
      "MKI$",
      "MKS$",
      "MKD$",
      "OCT$",
      "PEEK",
      "POS",
      "RIGHT$",
      "RND",
      "SGN",
      "SIN",
      "SPACE$",
      "SPC",
      "SQR",
      "STR$",
      "STRING$",
      "TAB",
      "TAN",
      "USR",
      "VAL",
      "VARPTR"
    ],
    validOperators: [
      "=",
      "<>",
      "<",
      ">",
      "<=",
      ">=",
      "+",
      "-",
      "*",
      "/",
      "^",
      "\\",
      "AND",
      "NOT",
      "OR",
      "XOR",
      "IMP",
      "EQV",
      "MOD"
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
    compiledBlocks: false
  };
  var MODERN_BASIC = {
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
    multilineIfThen: true
  };
  var BUILTIN_DEFS = [
    ["ABS", ["number"], "number"],
    ["ASC", ["string"], "number"],
    ["ATN", ["number"], "number"],
    ["CHR$", ["number"], "string"],
    ["CINT", ["number"], "number"],
    ["COS", ["number"], "number"],
    ["COT", ["number"], "number"],
    ["CTL", ["number"], "string"],
    ["EXP", ["number"], "number"],
    ["FIX", ["number"], "number"],
    ["HEX$", ["number"], "string"],
    ["INSTR", ["number", "string", "string"], "number"],
    ["INSTR", ["string", "string"], "number"],
    ["INT", ["number"], "number"],
    ["LEFT$", ["string", "number"], "string"],
    ["LEN", ["string"], "number"],
    ["LIN", ["number"], "string"],
    ["LOG", ["number"], "number"],
    ["LOG10", ["number"], "number"],
    ["MID$", ["string", "number"], "string"],
    ["MID$", ["string", "number", "number"], "string"],
    ["OCT$", ["number"], "string"],
    ["PI", [], "number"],
    ["POS", ["number"], "number"],
    ["POS", ["string", "string"], "number"],
    ["RIGHT$", ["string", "number"], "string"],
    ["RND", [], "number"],
    ["RND", ["number"], "number"],
    ["ROUND", ["number"], "number"],
    ["SGN", ["number"], "number"],
    ["SIN", ["number"], "number"],
    ["SPACE$", ["number"], "string"],
    ["SPC", ["number"], "string"],
    ["SQR", ["number"], "number"],
    ["STR$", ["number"], "string"],
    ["STRING$", ["number", "number"], "string"],
    ["STRING$", ["number", "string"], "string"],
    ["TAB", ["number"], "string"],
    ["TAN", ["number"], "number"],
    ["TIM", ["number"], "number"],
    ["TIMER", [], "number"],
    ["UPS$", ["string"], "string"],
    ["VAL", ["string"], "number"],
    ["LPAD$", ["string", "number"], "string"],
    ["RPAD$", ["string", "number"], "string"],
    ["NFORMAT$", ["number", "number"], "string"]
  ];
  var BUILTIN_MAP = {};
  BUILTIN_DEFS.forEach((def, idx) => {
    let [name, args, result] = def;
    if (!BUILTIN_MAP[name])
      BUILTIN_MAP[name] = [];
    BUILTIN_MAP[name].push({ args, result });
  });
  var DIALECTS = {
    "DEFAULT": MODERN_BASIC,
    "DARTMOUTH": DARTMOUTH_4TH_EDITION,
    "DARTMOUTH4": DARTMOUTH_4TH_EDITION,
    "ALTAIR": ALTAIR_BASIC41,
    "ALTAIR4": ALTAIR_BASIC41,
    "ALTAIR41": ALTAIR_BASIC41,
    "TINY": TINY_BASIC,
    "ECMA55": ECMA55_MINIMAL,
    "MINIMAL": ECMA55_MINIMAL,
    "HP": HP_TIMESHARED_BASIC,
    "HPB": HP_TIMESHARED_BASIC,
    "HPTSB": HP_TIMESHARED_BASIC,
    "HP2000": HP_TIMESHARED_BASIC,
    "HPBASIC": HP_TIMESHARED_BASIC,
    "HPACCESS": HP_TIMESHARED_BASIC,
    "DEC11": DEC_BASIC_11,
    "DEC": DEC_BASIC_PLUS,
    "DECPLUS": DEC_BASIC_PLUS,
    "BASICPLUS": DEC_BASIC_PLUS,
    "BASICODE": BASICODE,
    "APPLESOFT": APPLESOFT_BASIC,
    "BASIC80": BASIC80,
    "MODERN": MODERN_BASIC
  };

  // src/worker/tools/misc.ts
  function translateShowdown(step) {
    setupRequireFunction();
    load("showdown.min");
    var showdown = emglobal["showdown"];
    var converter = new showdown.Converter({
      tables: "true",
      smoothLivePreview: "true",
      requireSpaceBeforeHeadingText: "true",
      emoji: "true"
    });
    var code = getWorkFileAsString(step.path);
    var html = converter.makeHtml(code);
    delete emglobal["require"];
    return {
      output: html
    };
  }
  function compileInform6(step) {
    loadNative("inform");
    var errors = [];
    gatherFiles(step, { mainFilePath: "main.inf" });
    var objpath = step.prefix + ".z5";
    if (staleFiles(step, [objpath])) {
      var errorMatcher = msvcErrorMatcher(errors);
      var lstout = "";
      var match_fn = (s) => {
        if (s.indexOf("Error:") >= 0) {
          errorMatcher(s);
        } else {
          lstout += s;
          lstout += "\n";
        }
      };
      var args = ["-afjnops", "-v5", "-Cu", "-E1", "-k", "+/share/lib", step.path];
      var inform = emglobal.inform({
        instantiateWasm: moduleInstFn("inform"),
        noInitialRun: true,
        print: match_fn,
        printErr: match_fn
      });
      var FS = inform.FS;
      setupFS(FS, "inform");
      populateFiles(step, FS);
      execMain(step, inform, args);
      if (errors.length)
        return { errors };
      var objout = FS.readFile(objpath, { encoding: "binary" });
      putWorkFile(objpath, objout);
      if (!anyTargetChanged(step, [objpath]))
        return;
      var symbolmap = {};
      var segments = [];
      var entitymap = {
        "object": {},
        "property": {},
        "attribute": {},
        "constant": {},
        "global-variable": {},
        "routine": {}
      };
      var dbgout = FS.readFile("gameinfo.dbg", { encoding: "utf8" });
      var xmlroot = parseXMLPoorly(dbgout);
      var segtype = "ram";
      xmlroot.children.forEach((node) => {
        switch (node.type) {
          case "global-variable":
          case "routine":
            var ident = node.children.find((c, v) => c.type == "identifier").text;
            var address = parseInt(node.children.find((c, v) => c.type == "address").text);
            symbolmap[ident] = address;
            entitymap[node.type][address] = ident;
            break;
          case "object":
          case "property":
          case "attribute":
            var ident = node.children.find((c, v) => c.type == "identifier").text;
            var value = parseInt(node.children.find((c, v) => c.type == "value").text);
            entitymap[node.type][value] = ident;
            break;
          case "story-file-section":
            var name = node.children.find((c, v) => c.type == "type").text;
            var address = parseInt(node.children.find((c, v) => c.type == "address").text);
            var endAddress = parseInt(node.children.find((c, v) => c.type == "end-address").text);
            if (name == "grammar table")
              segtype = "rom";
            segments.push({ name, start: address, size: endAddress - address, type: segtype });
        }
      });
      var listings = {};
      var lines = parseListing(lstout, /\s*(\d+)\s+[+]([0-9a-f]+)\s+([<*>]*)\s*(\w+)\s+(.+)/i, -1, 2, 4);
      var lstpath = step.prefix + ".lst";
      listings[lstpath] = { lines: [], asmlines: lines, text: lstout };
      return {
        output: objout,
        listings,
        errors,
        symbolmap,
        segments,
        debuginfo: entitymap
      };
    }
  }
  function compileBASIC(step) {
    var jsonpath = step.path + ".json";
    gatherFiles(step);
    if (staleFiles(step, [jsonpath])) {
      var parser = new BASICParser();
      var code = getWorkFileAsString(step.path);
      try {
        var ast = parser.parseFile(code, step.path);
      } catch (e) {
        console.log(e);
        if (parser.errors.length == 0)
          throw e;
      }
      if (parser.errors.length) {
        return { errors: parser.errors };
      }
      var json = JSON.stringify(ast, (key, value) => {
        return key == "$loc" ? void 0 : value;
      });
      putWorkFile(jsonpath, json);
      if (anyTargetChanged(step, [jsonpath]))
        return {
          output: ast,
          listings: parser.getListings()
        };
    }
  }
  function compileWiz(step) {
    loadNative("wiz");
    var params = step.params;
    gatherFiles(step, { mainFilePath: "main.wiz" });
    var destpath = step.prefix + (params.wiz_rom_ext || ".bin");
    var errors = [];
    if (staleFiles(step, [destpath])) {
      var wiz = emglobal.wiz({
        instantiateWasm: moduleInstFn("wiz"),
        noInitialRun: true,
        print: print_fn,
        printErr: makeErrorMatcher(errors, /(.+?):(\d+):\s*(.+)/, 2, 3, step.path, 1)
      });
      var FS = wiz.FS;
      setupFS(FS, "wiz");
      populateFiles(step, FS);
      populateExtraFiles(step, FS, params.extra_compile_files);
      const FWDIR = "/share/common";
      var args = [
        "-o",
        destpath,
        "-I",
        FWDIR + "/" + (params.wiz_inc_dir || step.platform),
        "-s",
        "wla",
        "--color=none",
        step.path
      ];
      args.push("--system", params.wiz_sys_type || params.arch);
      execMain(step, wiz, args);
      if (errors.length)
        return { errors };
      var binout = FS.readFile(destpath, { encoding: "binary" });
      putWorkFile(destpath, binout);
      var dbgout = FS.readFile(step.prefix + ".sym", { encoding: "utf8" });
      var symbolmap = {};
      for (var s of dbgout.split("\n")) {
        var toks = s.split(/ /);
        if (toks && toks.length >= 2) {
          var tokrange = toks[0].split(":");
          var start = parseInt(tokrange[1], 16);
          var sym = toks[1];
          symbolmap[sym] = start;
        }
      }
      return {
        output: binout,
        errors,
        symbolmap
      };
    }
  }

  // src/worker/tools/cc65.ts
  function parseCA65Listing(code, symbols, segments, params, dbg, listings) {
    var segofs = 0;
    var offset = 0;
    var dbgLineMatch = /^([0-9A-F]+)([r]?)\s+(\d+)\s+[.]dbg\s+(\w+), "([^"]+)", (.+)/;
    var funcLineMatch = /"(\w+)", (\w+), "(\w+)"/;
    var insnLineMatch = /^([0-9A-F]+)([r]?)\s{1,2}(\d+)\s{1,2}([0-9A-Frx ]{11})\s+(.*)/;
    var segMatch = /[.]segment\s+"(\w+)"/i;
    var origlines = [];
    var lines = origlines;
    var linenum = 0;
    let curpath = "";
    for (var line of code.split(re_crlf)) {
      var dbgm = dbgLineMatch.exec(line);
      if (dbgm && dbgm[1]) {
        var dbgtype = dbgm[4];
        offset = parseInt(dbgm[1], 16);
        curpath = dbgm[5];
        if (curpath && listings) {
          let l = listings[curpath];
          if (!l)
            l = listings[curpath] = { lines: [] };
          lines = l.lines;
        }
        if (dbgtype == "func") {
          var funcm = funcLineMatch.exec(dbgm[6]);
          if (funcm) {
            var funcofs = symbols[funcm[3]];
            if (typeof funcofs === "number") {
              segofs = funcofs - offset;
            }
          }
        }
      }
      if (dbg && dbgm && dbgtype == "line") {
        lines.push({
          path: dbgm[5],
          line: parseInt(dbgm[6]),
          offset: offset + segofs,
          insns: null
        });
      }
      linenum++;
      var linem = insnLineMatch.exec(line);
      var topfile = linem && linem[3] == "1";
      if (topfile && linem[1]) {
        var offset = parseInt(linem[1], 16);
        var insns = linem[4].trim();
        if (insns.length) {
          if (!dbg) {
            lines.push({
              path: curpath,
              line: linenum,
              offset: offset + segofs,
              insns,
              iscode: true
            });
          }
        } else {
          var sym = linem[5];
          if (sym.endsWith(":") && !sym.startsWith("@")) {
            var symofs = symbols[sym.substring(0, sym.length - 1)];
            if (typeof symofs === "number") {
              segofs = symofs - offset;
            }
          }
        }
      }
    }
    return origlines;
  }
  function assembleCA65(step) {
    loadNative("ca65");
    var errors = [];
    gatherFiles(step, { mainFilePath: "main.s" });
    var objpath = step.prefix + ".o";
    var lstpath = step.prefix + ".lst";
    if (staleFiles(step, [objpath, lstpath])) {
      var objout, lstout;
      var CA65 = emglobal.ca65({
        instantiateWasm: moduleInstFn("ca65"),
        noInitialRun: true,
        print: print_fn,
        printErr: makeErrorMatcher(errors, /(.+?):(\d+): (.+)/, 2, 3, step.path, 1)
      });
      var FS = CA65.FS;
      setupFS(FS, "65-" + getRootBasePlatform(step.platform));
      populateFiles(step, FS);
      fixParamsWithDefines(step.path, step.params);
      var args = ["-v", "-g", "-I", "/share/asminc", "-o", objpath, "-l", lstpath, step.path];
      args.unshift.apply(args, ["-D", "__8BITWORKSHOP__=1"]);
      if (step.mainfile) {
        args.unshift.apply(args, ["-D", "__MAIN__=1"]);
      }
      execMain(step, CA65, args);
      if (errors.length) {
        let listings = {};
        return { errors, listings };
      }
      objout = FS.readFile(objpath, { encoding: "binary" });
      lstout = FS.readFile(lstpath, { encoding: "utf8" });
      putWorkFile(objpath, objout);
      putWorkFile(lstpath, lstout);
    }
    return {
      linktool: "ld65",
      files: [objpath, lstpath],
      args: [objpath]
    };
  }
  function linkLD65(step) {
    var _a;
    loadNative("ld65");
    var params = step.params;
    gatherFiles(step);
    var binpath = "main";
    if (staleFiles(step, [binpath])) {
      var errors = [];
      var LD65 = emglobal.ld65({
        instantiateWasm: moduleInstFn("ld65"),
        noInitialRun: true,
        print: print_fn,
        printErr: function(s2) {
          errors.push({ msg: s2, line: 0 });
        }
      });
      var FS = LD65.FS;
      setupFS(FS, "65-" + getRootBasePlatform(step.platform));
      populateFiles(step, FS);
      populateExtraFiles(step, FS, params.extra_link_files);
      if (store.hasFile(params.cfgfile)) {
        populateEntry(FS, params.cfgfile, store.getFileEntry(params.cfgfile), null);
      }
      var libargs = params.libargs || [];
      var cfgfile = params.cfgfile;
      var args = [
        "--cfg-path",
        "/share/cfg",
        "--lib-path",
        "/share/lib",
        "-C",
        cfgfile,
        "-Ln",
        "main.vice",
        "-o",
        "main",
        "-m",
        "main.map"
      ].concat(step.args, libargs);
      execMain(step, LD65, args);
      if (errors.length)
        return { errors };
      var aout = FS.readFile("main", { encoding: "binary" });
      var mapout = FS.readFile("main.map", { encoding: "utf8" });
      var viceout = FS.readFile("main.vice", { encoding: "utf8" });
      putWorkFile("main", aout);
      putWorkFile("main.map", mapout);
      putWorkFile("main.vice", viceout);
      if (!anyTargetChanged(step, ["main", "main.map", "main.vice"]))
        return;
      var symbolmap = {};
      for (var s of viceout.split("\n")) {
        var toks = s.split(" ");
        if (toks[0] == "al") {
          let ident = toks[2].substr(1);
          if (ident.length != 5 || !ident.startsWith("L")) {
            let ofs = parseInt(toks[1], 16);
            symbolmap[ident] = ofs;
          }
        }
      }
      var segments = [];
      segments.push({ name: "CPU Stack", start: 256, size: 256, type: "ram" });
      segments.push({ name: "CPU Vectors", start: 65530, size: 6, type: "rom" });
      let re_seglist = /(\w+)\s+([0-9A-F]+)\s+([0-9A-F]+)\s+([0-9A-F]+)\s+([0-9A-F]+)/;
      let parseseglist = false;
      let m;
      for (let s2 of mapout.split("\n")) {
        if (parseseglist && (m = re_seglist.exec(s2))) {
          let seg = m[1];
          let start = parseInt(m[2], 16);
          let size = parseInt(m[4], 16);
          let type = "";
          if (seg.startsWith("CODE") || seg == "STARTUP" || seg == "RODATA" || seg.endsWith("ROM"))
            type = "rom";
          else if (seg == "ZP" || seg == "DATA" || seg == "BSS" || seg.endsWith("RAM"))
            type = "ram";
          segments.push({ name: seg, start, size, type });
        }
        if (s2 == "Segment list:")
          parseseglist = true;
        if (s2 == "")
          parseseglist = false;
      }
      var listings = {};
      for (var fn of step.files) {
        if (fn.endsWith(".lst")) {
          var lstout = FS.readFile(fn, { encoding: "utf8" });
          lstout = lstout.split("\n\n")[1] || lstout;
          putWorkFile(fn, lstout);
          console.log(step);
          let isECS = ((_a = step.debuginfo) == null ? void 0 : _a.entities) != null;
          if (isECS) {
            var asmlines = [];
            var srclines = parseCA65Listing(lstout, symbolmap, segments, params, true, listings);
            listings[fn] = {
              lines: [],
              text: lstout
            };
          } else {
            var asmlines = parseCA65Listing(lstout, symbolmap, segments, params, false);
            var srclines = parseCA65Listing(lstout, symbolmap, segments, params, true);
            listings[fn] = {
              asmlines: srclines.length ? asmlines : null,
              lines: srclines.length ? srclines : asmlines,
              text: lstout
            };
          }
        }
      }
      return {
        output: aout,
        listings,
        errors,
        symbolmap,
        segments
      };
    }
  }
  function compileCC65(step) {
    loadNative("cc65");
    var params = step.params;
    var re_err1 = /(.*?):(\d+): (.+)/;
    var errors = [];
    var errline = 0;
    function match_fn(s) {
      console.log(s);
      var matches = re_err1.exec(s);
      if (matches) {
        errline = parseInt(matches[2]);
        errors.push({
          line: errline,
          msg: matches[3],
          path: matches[1]
        });
      }
    }
    gatherFiles(step, { mainFilePath: "main.c" });
    var destpath = step.prefix + ".s";
    if (staleFiles(step, [destpath])) {
      var CC65 = emglobal.cc65({
        instantiateWasm: moduleInstFn("cc65"),
        noInitialRun: true,
        print: print_fn,
        printErr: match_fn
      });
      var FS = CC65.FS;
      setupFS(FS, "65-" + getRootBasePlatform(step.platform));
      populateFiles(step, FS);
      fixParamsWithDefines(step.path, params);
      var args = [
        "-I",
        "/share/include",
        "-I",
        ".",
        "-D",
        "__8BITWORKSHOP__"
      ];
      if (params.define) {
        params.define.forEach((x) => args.push("-D" + x));
      }
      if (step.mainfile) {
        args.unshift.apply(args, ["-D", "__MAIN__"]);
      }
      var customArgs = params.extra_compiler_args || ["-T", "-g", "-Oirs", "-Cl", "-W", "-pointer-sign,-no-effect"];
      args = args.concat(customArgs, args);
      args.push(step.path);
      execMain(step, CC65, args);
      if (errors.length)
        return { errors };
      var asmout = FS.readFile(destpath, { encoding: "utf8" });
      putWorkFile(destpath, asmout);
    }
    return {
      nexttool: "ca65",
      path: destpath,
      args: [destpath],
      files: [destpath]
    };
  }

  // src/worker/tools/dasm.ts
  function parseDASMListing(lstpath, lsttext, listings, errors, unresolved) {
    let lineMatch = /\s*(\d+)\s+(\S+)\s+([0-9a-f]+)\s+([?0-9a-f][?0-9a-f ]+)?\s+(.+)?/i;
    let equMatch = /\bequ\b/i;
    let macroMatch = /\bMAC\s+(\S+)?/i;
    let lastline = 0;
    let macros = {};
    let lstline = 0;
    let lstlist = listings[lstpath];
    for (let line of lsttext.split(re_crlf)) {
      lstline++;
      let linem = lineMatch.exec(line + "    ");
      if (linem && linem[1] != null) {
        let linenum = parseInt(linem[1]);
        let filename = linem[2];
        let offset = parseInt(linem[3], 16);
        let insns = linem[4];
        let restline = linem[5];
        if (insns && insns.startsWith("?"))
          insns = null;
        if (lstlist && lstlist.lines) {
          lstlist.lines.push({
            line: lstline,
            offset,
            insns,
            iscode: true
          });
        }
        let lst = listings[filename];
        if (lst) {
          var lines = lst.lines;
          let macmatch = macroMatch.exec(restline);
          if (macmatch) {
            macros[macmatch[1]] = { line: parseInt(linem[1]), file: linem[2].toLowerCase() };
          } else if (insns && restline && !restline.match(equMatch)) {
            lines.push({
              line: linenum,
              offset,
              insns,
              iscode: restline[0] != "."
            });
          }
          lastline = linenum;
        } else {
          let mac = macros[filename.toLowerCase()];
          if (mac && linenum == 0) {
            lines.push({
              line: lastline + 1,
              offset,
              insns,
              iscode: true
            });
          }
          if (insns && mac) {
            let maclst = listings[mac.file];
            if (maclst && maclst.lines) {
              maclst.lines.push({
                path: mac.file,
                line: mac.line + linenum,
                offset,
                insns,
                iscode: true
              });
            }
          } else {
            if (insns && linem[3] && lastline > 0) {
              lines.push({
                line: lastline + 1,
                offset,
                insns: null
              });
            }
          }
        }
        for (let key in unresolved) {
          let l = restline || line;
          let pos = l.indexOf(key);
          if (pos >= 0) {
            let cmt = l.indexOf(";");
            if (cmt < 0 || cmt > pos) {
              if (new RegExp("\\b" + key + "\\b").exec(l)) {
                errors.push({
                  path: filename,
                  line: linenum,
                  msg: "Unresolved symbol '" + key + "'"
                });
              }
            }
          }
        }
      }
      let errm = re_msvc.exec(line);
      if (errm) {
        errors.push({
          path: errm[1],
          line: parseInt(errm[2]),
          msg: errm[4]
        });
      }
    }
  }
  function assembleDASM(step) {
    load("dasm");
    var re_usl = /(\w+)\s+0000\s+[?][?][?][?]/;
    var unresolved = {};
    var errors = [];
    var errorMatcher = msvcErrorMatcher(errors);
    function match_fn(s2) {
      var matches = re_usl.exec(s2);
      if (matches) {
        var key = matches[1];
        if (key != "NO_ILLEGAL_OPCODES") {
          unresolved[matches[1]] = 0;
        }
      } else if (s2.startsWith("Warning:")) {
        errors.push({ line: 0, msg: s2.substr(9) });
      } else if (s2.startsWith("unable ")) {
        errors.push({ line: 0, msg: s2 });
      } else if (s2.startsWith("segment: ")) {
        errors.push({ line: 0, msg: "Segment overflow: " + s2.substring(9) });
      } else if (s2.toLowerCase().indexOf("error:") >= 0) {
        errors.push({ line: 0, msg: s2.trim() });
      } else {
        errorMatcher(s2);
      }
    }
    var Module = emglobal.DASM({
      noInitialRun: true,
      print: match_fn
    });
    var FS = Module.FS;
    populateFiles(step, FS, {
      mainFilePath: "main.a"
    });
    var binpath = step.prefix + ".bin";
    var lstpath = step.prefix + ".lst";
    var sympath = step.prefix + ".sym";
    execMain(step, Module, [
      step.path,
      "-f3",
      "-l" + lstpath,
      "-o" + binpath,
      "-s" + sympath
    ]);
    var alst = FS.readFile(lstpath, { "encoding": "utf8" });
    var listings = {};
    for (let path of step.files) {
      listings[path] = { lines: [] };
    }
    parseDASMListing(lstpath, alst, listings, errors, unresolved);
    if (errors.length) {
      return { errors };
    }
    var aout, asym;
    aout = FS.readFile(binpath);
    try {
      asym = FS.readFile(sympath, { "encoding": "utf8" });
    } catch (e) {
      console.log(e);
      errors.push({ line: 0, msg: "No symbol table generated, maybe segment overflow?" });
      return { errors };
    }
    putWorkFile(binpath, aout);
    putWorkFile(lstpath, alst);
    putWorkFile(sympath, asym);
    if (!anyTargetChanged(step, [binpath]))
      return;
    var symbolmap = {};
    for (var s of asym.split("\n")) {
      var toks = s.split(/\s+/);
      if (toks && toks.length >= 2 && !toks[0].startsWith("-")) {
        symbolmap[toks[0]] = parseInt(toks[1], 16);
      }
    }
    if (step["bblines"]) {
      let lst = listings[step.path];
      if (lst) {
        lst.asmlines = lst.lines;
        lst.text = alst;
        lst.lines = [];
      }
    }
    return {
      output: aout,
      listings,
      errors,
      symbolmap
    };
  }
  function preprocessBatariBasic(code) {
    load("bbpreprocess");
    var bbout = "";
    function addbbout_fn(s) {
      bbout += s;
      bbout += "\n";
    }
    var BBPRE = emglobal.preprocess({
      noInitialRun: true,
      print: addbbout_fn,
      printErr: print_fn,
      noFSInit: true
    });
    var FS = BBPRE.FS;
    setupStdin(FS, code);
    BBPRE.callMain([]);
    console.log("preprocess " + code.length + " -> " + bbout.length + " bytes");
    return bbout;
  }
  function compileBatariBasic(step) {
    load("bb2600basic");
    var params = step.params;
    var asmout = "";
    function addasmout_fn(s) {
      asmout += s;
      asmout += "\n";
    }
    var re_err1 = /[(](\d+)[)]:?\s*(.+)/;
    var errors = [];
    var errline = 0;
    function match_fn(s) {
      console.log(s);
      var matches = re_err1.exec(s);
      if (matches) {
        errline = parseInt(matches[1]);
        errors.push({
          line: errline,
          msg: matches[2]
        });
      }
    }
    gatherFiles(step, { mainFilePath: "main.bas" });
    var destpath = step.prefix + ".asm";
    if (staleFiles(step, [destpath])) {
      var BB = emglobal.bb2600basic({
        noInitialRun: true,
        print: addasmout_fn,
        printErr: match_fn,
        noFSInit: true,
        TOTAL_MEMORY: 64 * 1024 * 1024
      });
      var FS = BB.FS;
      populateFiles(step, FS);
      var code = getWorkFileAsString(step.path);
      code = preprocessBatariBasic(code);
      setupStdin(FS, code);
      setupFS(FS, "2600basic");
      execMain(step, BB, ["-i", "/share", step.path]);
      if (errors.length)
        return { errors };
      var includesout = FS.readFile("includes.bB", { encoding: "utf8" });
      var redefsout = FS.readFile("2600basic_variable_redefs.h", { encoding: "utf8" });
      var includes = includesout.trim().split("\n");
      var combinedasm = "";
      var splitasm = asmout.split("bB.asm file is split here");
      for (var incfile of includes) {
        var inctext;
        if (incfile == "bB.asm")
          inctext = splitasm[0];
        else if (incfile == "bB2.asm")
          inctext = splitasm[1];
        else
          inctext = FS.readFile("/share/includes/" + incfile, { encoding: "utf8" });
        console.log(incfile, inctext.length);
        combinedasm += "\n\n;;;" + incfile + "\n\n";
        combinedasm += inctext;
      }
      putWorkFile(destpath, combinedasm);
      putWorkFile("2600basic.h", FS.readFile("/share/includes/2600basic.h"));
      putWorkFile("2600basic_variable_redefs.h", redefsout);
    }
    return {
      nexttool: "dasm",
      path: destpath,
      args: [destpath],
      files: [destpath, "2600basic.h", "2600basic_variable_redefs.h"],
      bblines: true
    };
  }

  // src/worker/tools/sdcc.ts
  function hexToArray(s, ofs) {
    var buf = new ArrayBuffer(s.length / 2);
    var arr = new Uint8Array(buf);
    for (var i = 0; i < arr.length; i++) {
      arr[i] = parseInt(s.slice(i * 2 + ofs, i * 2 + ofs + 2), 16);
    }
    return arr;
  }
  function parseIHX(ihx, rom_start, rom_size, errors) {
    var output = new Uint8Array(new ArrayBuffer(rom_size));
    var high_size = 0;
    for (var s of ihx.split("\n")) {
      if (s[0] == ":") {
        var arr = hexToArray(s, 1);
        var count = arr[0];
        var address = (arr[1] << 8) + arr[2] - rom_start;
        var rectype = arr[3];
        if (rectype == 0) {
          for (var i = 0; i < count; i++) {
            var b = arr[4 + i];
            output[i + address] = b;
          }
          if (i + address > high_size)
            high_size = i + address;
        } else if (rectype == 1) {
          break;
        } else {
          console.log(s);
        }
      }
    }
    if (high_size > rom_size) {
    }
    return output;
  }
  function assembleSDASZ80(step) {
    loadNative("sdasz80");
    var objout, lstout, symout;
    var errors = [];
    gatherFiles(step, { mainFilePath: "main.asm" });
    var objpath = step.prefix + ".rel";
    var lstpath = step.prefix + ".lst";
    if (staleFiles(step, [objpath, lstpath])) {
      var match_asm_re1 = / in line (\d+) of (\S+)/;
      var match_asm_re2 = / <\w> (.+)/;
      var errline = 0;
      var errpath = step.path;
      var match_asm_fn = (s) => {
        var m = match_asm_re1.exec(s);
        if (m) {
          errline = parseInt(m[1]);
          errpath = m[2];
        } else {
          m = match_asm_re2.exec(s);
          if (m) {
            errors.push({
              line: errline,
              path: errpath,
              msg: m[1]
            });
          }
        }
      };
      var ASZ80 = emglobal.sdasz80({
        instantiateWasm: moduleInstFn("sdasz80"),
        noInitialRun: true,
        print: match_asm_fn,
        printErr: match_asm_fn
      });
      var FS = ASZ80.FS;
      populateFiles(step, FS);
      execMain(step, ASZ80, ["-plosgffwy", step.path]);
      if (errors.length) {
        return { errors };
      }
      objout = FS.readFile(objpath, { encoding: "utf8" });
      lstout = FS.readFile(lstpath, { encoding: "utf8" });
      putWorkFile(objpath, objout);
      putWorkFile(lstpath, lstout);
    }
    return {
      linktool: "sdldz80",
      files: [objpath, lstpath],
      args: [objpath]
    };
  }
  function linkSDLDZ80(step) {
    loadNative("sdldz80");
    var errors = [];
    gatherFiles(step);
    var binpath = "main.ihx";
    if (staleFiles(step, [binpath])) {
      var match_aslink_re = /\?ASlink-(\w+)-(.+)/;
      var match_aslink_fn = (s2) => {
        var matches = match_aslink_re.exec(s2);
        if (matches) {
          errors.push({
            line: 0,
            msg: matches[2]
          });
        }
      };
      var params = step.params;
      var LDZ80 = emglobal.sdldz80({
        instantiateWasm: moduleInstFn("sdldz80"),
        noInitialRun: true,
        print: match_aslink_fn,
        printErr: match_aslink_fn
      });
      var FS = LDZ80.FS;
      setupFS(FS, "sdcc");
      populateFiles(step, FS);
      populateExtraFiles(step, FS, params.extra_link_files);
      if (step.platform.startsWith("coleco")) {
        FS.writeFile("crt0.rel", FS.readFile("/share/lib/coleco/crt0.rel", { encoding: "utf8" }));
        FS.writeFile("crt0.lst", "\n");
      }
      var args = [
        "-mjwxyu",
        "-i",
        "main.ihx",
        "-b",
        "_CODE=0x" + params.code_start.toString(16),
        "-b",
        "_DATA=0x" + params.data_start.toString(16),
        "-k",
        "/share/lib/z80",
        "-l",
        "z80"
      ];
      if (params.extra_link_args)
        args.push.apply(args, params.extra_link_args);
      args.push.apply(args, step.args);
      execMain(step, LDZ80, args);
      var hexout = FS.readFile("main.ihx", { encoding: "utf8" });
      var noiout = FS.readFile("main.noi", { encoding: "utf8" });
      putWorkFile("main.ihx", hexout);
      putWorkFile("main.noi", noiout);
      if (!anyTargetChanged(step, ["main.ihx", "main.noi"]))
        return;
      var binout = parseIHX(hexout, params.rom_start !== void 0 ? params.rom_start : params.code_start, params.rom_size, errors);
      if (errors.length) {
        return { errors };
      }
      var listings = {};
      for (var fn of step.files) {
        if (fn.endsWith(".lst")) {
          var rstout = FS.readFile(fn.replace(".lst", ".rst"), { encoding: "utf8" });
          var asmlines = parseListing(rstout, /^\s*([0-9A-F]{4})\s+([0-9A-F][0-9A-F r]*[0-9A-F])\s+\[([0-9 ]+)\]?\s+(\d+) (.*)/i, 4, 1, 2, 3);
          var srclines = parseSourceLines(rstout, /^\s+\d+ ;<stdin>:(\d+):/i, /^\s*([0-9A-F]{4})/i);
          putWorkFile(fn, rstout);
          listings[fn] = {
            asmlines: srclines.length ? asmlines : null,
            lines: srclines.length ? srclines : asmlines,
            text: rstout
          };
        }
      }
      var symbolmap = {};
      for (var s of noiout.split("\n")) {
        var toks = s.split(" ");
        if (toks[0] == "DEF" && !toks[1].startsWith("A$")) {
          symbolmap[toks[1]] = parseInt(toks[2], 16);
        }
      }
      var seg_re = /^s__(\w+)$/;
      var segments = [];
      for (let ident in symbolmap) {
        let m = seg_re.exec(ident);
        if (m) {
          let seg = m[1];
          let segstart = symbolmap[ident];
          let segsize = symbolmap["l__" + seg];
          if (segstart >= 0 && segsize > 0) {
            var type = null;
            if (["INITIALIZER", "GSINIT", "GSFINAL"].includes(seg))
              type = "rom";
            else if (seg.startsWith("CODE"))
              type = "rom";
            else if (["DATA", "INITIALIZED"].includes(seg))
              type = "ram";
            if (type == "rom" || segstart > 0)
              segments.push({ name: seg, start: segstart, size: segsize, type });
          }
        }
      }
      return {
        output: binout,
        listings,
        errors,
        symbolmap,
        segments
      };
    }
  }
  function compileSDCC(step) {
    gatherFiles(step, {
      mainFilePath: "main.c"
    });
    var outpath = step.prefix + ".asm";
    if (staleFiles(step, [outpath])) {
      var errors = [];
      var params = step.params;
      loadNative("sdcc");
      var SDCC = emglobal.sdcc({
        instantiateWasm: moduleInstFn("sdcc"),
        noInitialRun: true,
        noFSInit: true,
        print: print_fn,
        printErr: msvcErrorMatcher(errors)
      });
      var FS = SDCC.FS;
      populateFiles(step, FS);
      var code = getWorkFileAsString(step.path);
      var preproc = preprocessMCPP(step, "sdcc");
      if (preproc.errors) {
        return { errors: preproc.errors };
      } else
        code = preproc.code;
      setupStdin(FS, code);
      setupFS(FS, "sdcc");
      var args = [
        "--vc",
        "--std-sdcc99",
        "-mz80",
        "--c1mode",
        "--less-pedantic",
        "-o",
        outpath
      ];
      if (!/^\s*#pragma\s+opt_code/m.exec(code)) {
        args.push.apply(args, [
          "--oldralloc",
          "--no-peep",
          "--nolospre"
        ]);
      }
      if (params.extra_compile_args) {
        args.push.apply(args, params.extra_compile_args);
      }
      execMain(step, SDCC, args);
      if (errors.length) {
        return { errors };
      }
      var asmout = FS.readFile(outpath, { encoding: "utf8" });
      asmout = " .area _HOME\n .area _CODE\n .area _INITIALIZER\n .area _DATA\n .area _INITIALIZED\n .area _BSEG\n .area _BSS\n .area _HEAP\n" + asmout;
      putWorkFile(outpath, asmout);
    }
    return {
      nexttool: "sdasz80",
      path: outpath,
      args: [outpath],
      files: [outpath]
    };
  }

  // src/worker/assembler.ts
  var isError = (o) => o.error !== void 0;
  function hex2(v, nd) {
    try {
      if (!nd)
        nd = 2;
      if (nd == 8) {
        return hex2(v >> 16 & 65535, 4) + hex2(v & 65535, 4);
      }
      var s = v.toString(16).toUpperCase();
      while (s.length < nd)
        s = "0" + s;
      return s;
    } catch (e) {
      return v + "";
    }
  }
  function stringToData(s) {
    var data = [];
    for (var i = 0; i < s.length; i++) {
      data[i] = s.charCodeAt(i);
    }
    return data;
  }
  var Assembler = class {
    constructor(spec) {
      this.ip = 0;
      this.origin = 0;
      this.linenum = 0;
      this.symbols = {};
      this.errors = [];
      this.outwords = [];
      this.asmlines = [];
      this.fixups = [];
      this.width = 8;
      this.codelen = 0;
      this.aborted = false;
      this.spec = spec;
      if (spec) {
        this.preprocessRules();
      }
    }
    rule2regex(rule, vars) {
      var s = rule.fmt;
      if (!s || !(typeof s === "string"))
        throw Error('Each rule must have a "fmt" string field');
      if (!rule.bits || !(rule.bits instanceof Array))
        throw Error('Each rule must have a "bits" array field');
      var varlist = [];
      rule.prefix = s.split(/\s+/)[0];
      s = s.replace(/\+/g, "\\+");
      s = s.replace(/\*/g, "\\*");
      s = s.replace(/\s+/g, "\\s+");
      s = s.replace(/\[/g, "\\[");
      s = s.replace(/\]/g, "\\]");
      s = s.replace(/\(/g, "\\(");
      s = s.replace(/\)/g, "\\)");
      s = s.replace(/\./g, "\\.");
      s = s.replace(/~\w+/g, (varname) => {
        varname = varname.substr(1);
        var v = vars[varname];
        varlist.push(varname);
        if (!v)
          throw Error('Could not find variable definition for "~' + varname + '"');
        else if (v.toks)
          return "(\\w+)";
        else
          return "([0-9]+|[$][0-9a-f]+|\\w+)";
      });
      try {
        rule.re = new RegExp("^" + s + "$", "i");
      } catch (e) {
        throw Error('Bad regex for rule "' + rule.fmt + '": /' + s + "/ -- " + e);
      }
      rule.varlist = varlist;
      return rule;
    }
    preprocessRules() {
      if (this.spec.width) {
        this.width = this.spec.width || 8;
      }
      for (var rule of this.spec.rules) {
        this.rule2regex(rule, this.spec.vars);
      }
    }
    warning(msg, line) {
      this.errors.push({ msg, line: line ? line : this.linenum });
    }
    fatal(msg, line) {
      this.warning(msg, line);
      this.aborted = true;
    }
    fatalIf(msg, line) {
      if (msg)
        this.fatal(msg, line);
    }
    addBytes(result) {
      this.asmlines.push({
        line: this.linenum,
        offset: this.ip,
        nbits: result.nbits
      });
      var op = result.opcode;
      var nb = result.nbits / this.width;
      for (var i = 0; i < nb; i++) {
        if (this.width < 32)
          this.outwords[this.ip++ - this.origin] = op >> (nb - 1 - i) * this.width & (1 << this.width) - 1;
        else
          this.outwords[this.ip++ - this.origin] = op;
      }
    }
    addWords(data) {
      this.asmlines.push({
        line: this.linenum,
        offset: this.ip,
        nbits: this.width * data.length
      });
      for (var i = 0; i < data.length; i++) {
        if (this.width < 32)
          this.outwords[this.ip++ - this.origin] = data[i] & (1 << this.width) - 1;
        else
          this.outwords[this.ip++ - this.origin] = data[i];
      }
    }
    parseData(toks) {
      var data = [];
      for (var i = 0; i < toks.length; i++) {
        data[i] = this.parseConst(toks[i]);
      }
      return data;
    }
    alignIP(align) {
      if (align < 1 || align > this.codelen)
        this.fatal("Invalid alignment value");
      else
        this.ip = Math.floor((this.ip + align - 1) / align) * align;
    }
    parseConst(s, nbits) {
      if (s && s[0] == "$")
        return parseInt(s.substr(1), 16);
      else
        return parseInt(s);
    }
    swapEndian(x, nbits) {
      var y = 0;
      while (nbits > 0) {
        var n = Math.min(nbits, this.width);
        var mask = (1 << n) - 1;
        y <<= n;
        y |= x & mask;
        x >>>= n;
        nbits -= n;
      }
      return y;
    }
    buildInstruction(rule, m) {
      var opcode = 0;
      var oplen = 0;
      for (let b of rule.bits) {
        let n, x;
        if (typeof b === "string") {
          n = b.length;
          x = parseInt(b, 2);
        } else {
          var index = typeof b === "number" ? b : b.a;
          var id = m[index + 1];
          var v = this.spec.vars[rule.varlist[index]];
          if (!v) {
            return { error: `Could not find matching identifier for '${m[0]}' index ${index}` };
          }
          n = v.bits;
          var shift = 0;
          if (typeof b !== "number") {
            n = b.n;
            shift = b.b;
          }
          if (v.toks) {
            x = v.toks.indexOf(id);
            if (x < 0)
              return { error: "Can't use '" + id + "' here, only one of: " + v.toks.join(", ") };
          } else {
            x = this.parseConst(id, n);
            if (isNaN(x)) {
              this.fixups.push({
                sym: id,
                ofs: this.ip,
                size: v.bits,
                line: this.linenum,
                dstlen: n,
                dstofs: oplen,
                srcofs: shift,
                endian: v.endian,
                iprel: !!v.iprel,
                ipofs: v.ipofs + 0,
                ipmul: v.ipmul || 1
              });
              x = 0;
            } else {
              var mask = (1 << v.bits) - 1;
              if ((x & mask) != x)
                return { error: "Value " + x + " does not fit in " + v.bits + " bits" };
            }
          }
          if (v.endian == "little")
            x = this.swapEndian(x, v.bits);
          if (typeof b !== "number") {
            x = x >>> shift & (1 << b.n) - 1;
          }
        }
        opcode = opcode << n | x;
        oplen += n;
      }
      if (oplen == 0)
        this.warning("Opcode had zero length");
      else if (oplen > 32)
        this.warning("Opcodes > 32 bits not supported");
      else if (oplen % this.width != 0)
        this.warning("Opcode was not word-aligned (" + oplen + " bits)");
      return { opcode, nbits: oplen };
    }
    loadArch(arch) {
      if (this.loadJSON) {
        var json = this.loadJSON(arch + ".json");
        if (json && json.vars && json.rules) {
          this.spec = json;
          this.preprocessRules();
        } else {
          return "Could not load arch file '" + arch + ".json'";
        }
      }
    }
    parseDirective(tokens) {
      var cmd = tokens[0].toLowerCase();
      if (cmd == ".define")
        this.symbols[tokens[1].toLowerCase()] = { value: tokens[2] };
      else if (cmd == ".org")
        this.ip = this.origin = parseInt(tokens[1]);
      else if (cmd == ".len")
        this.codelen = parseInt(tokens[1]);
      else if (cmd == ".width")
        this.width = parseInt(tokens[1]);
      else if (cmd == ".arch")
        this.fatalIf(this.loadArch(tokens[1]));
      else if (cmd == ".include")
        this.fatalIf(this.loadInclude(tokens[1]));
      else if (cmd == ".module")
        this.fatalIf(this.loadModule(tokens[1]));
      else if (cmd == ".data")
        this.addWords(this.parseData(tokens.slice(1)));
      else if (cmd == ".string")
        this.addWords(stringToData(tokens.slice(1).join(" ")));
      else if (cmd == ".align")
        this.alignIP(this.parseConst(tokens[1]));
      else
        this.warning("Unrecognized directive: " + tokens);
    }
    assemble(line) {
      this.linenum++;
      line = line.replace(/[;].*/g, "").trim();
      if (line[0] == ".") {
        var tokens = line.split(/\s+/);
        this.parseDirective(tokens);
        return;
      }
      line = line.toLowerCase();
      line = line.replace(/(\w+):/, (_label, label) => {
        this.symbols[label] = { value: this.ip };
        return "";
      });
      line = line.trim();
      if (line == "")
        return;
      if (!this.spec) {
        this.fatal("Need to load .arch first");
        return;
      }
      var lastError;
      for (var rule of this.spec.rules) {
        var m = rule.re.exec(line);
        if (m) {
          var result = this.buildInstruction(rule, m);
          if (!isError(result)) {
            this.addBytes(result);
            return result;
          } else {
            lastError = result.error;
          }
        }
      }
      this.warning(lastError ? lastError : "Could not decode instruction: " + line);
    }
    applyFixup(fix, sym) {
      var ofs = fix.ofs + Math.floor(fix.dstofs / this.width);
      var mask = (1 << fix.size) - 1;
      var value = this.parseConst(sym.value + "", fix.dstlen);
      if (fix.iprel)
        value = (value - fix.ofs) * fix.ipmul - fix.ipofs;
      if (fix.srcofs == 0 && (value > mask || value < -mask))
        this.warning("Symbol " + fix.sym + " (" + value + ") does not fit in " + fix.dstlen + " bits", fix.line);
      if (fix.srcofs > 0)
        value >>>= fix.srcofs;
      value &= (1 << fix.dstlen) - 1;
      if (this.width == 32) {
        var shift = 32 - fix.dstofs - fix.dstlen;
        value <<= shift;
      }
      if (fix.size <= this.width) {
        this.outwords[ofs - this.origin] ^= value;
      } else {
        if (fix.endian == "big")
          value = this.swapEndian(value, fix.size);
        while (value) {
          if (value & this.outwords[ofs - this.origin]) {
            this.warning("Instruction bits overlapped: " + hex2(this.outwords[ofs - this.origin], 8), hex2(value, 8));
          } else {
            this.outwords[ofs - this.origin] ^= value & (1 << this.width) - 1;
          }
          value >>>= this.width;
          ofs++;
        }
      }
    }
    finish() {
      for (var i = 0; i < this.fixups.length; i++) {
        var fix = this.fixups[i];
        var sym = this.symbols[fix.sym];
        if (sym) {
          this.applyFixup(fix, sym);
        } else {
          this.warning("Symbol '" + fix.sym + "' not found");
        }
      }
      for (var i = 0; i < this.asmlines.length; i++) {
        var al = this.asmlines[i];
        al.insns = "";
        for (var j = 0; j < al.nbits / this.width; j++) {
          var word = this.outwords[al.offset + j - this.origin];
          if (j > 0)
            al.insns += " ";
          al.insns += hex2(word, this.width / 4);
        }
      }
      while (this.outwords.length < this.codelen) {
        this.outwords.push(0);
      }
      this.fixups = [];
      return this.state();
    }
    assembleFile(text) {
      var lines = text.split(/\n/g);
      for (var i = 0; i < lines.length && !this.aborted; i++) {
        try {
          this.assemble(lines[i]);
        } catch (e) {
          console.log(e);
          this.fatal("Exception during assembly: " + e);
        }
      }
      return this.finish();
    }
    state() {
      return {
        ip: this.ip,
        line: this.linenum,
        origin: this.origin,
        codelen: this.codelen,
        intermediate: {},
        output: this.outwords,
        lines: this.asmlines,
        errors: this.errors,
        fixups: this.fixups
      };
    }
  };

  // src/common/hdl/hdltypes.ts
  function isVarDecl(arg) {
    return typeof arg.isParam !== "undefined";
  }
  function isConstExpr(arg) {
    return typeof arg.cvalue === "number";
  }

  // src/common/hdl/vxmlparser.ts
  var CompileError2 = class extends Error {
    constructor($loc, msg) {
      super(msg);
      this.$loc = $loc;
      Object.setPrototypeOf(this, CompileError2.prototype);
    }
  };
  var VerilogXMLParser = class {
    constructor() {
      this.files = {};
      this.dtypes = {};
      this.modules = {};
      this.hierarchies = {};
      this.cur_deferred = [];
      this.dtypes["QData"] = { left: 63, right: 0, signed: false };
      this.dtypes["IData"] = { left: 31, right: 0, signed: false };
      this.dtypes["SData"] = { left: 15, right: 0, signed: false };
      this.dtypes["CData"] = { left: 7, right: 0, signed: false };
      this.dtypes["byte"] = { left: 7, right: 0, signed: true };
      this.dtypes["shortint"] = { left: 15, right: 0, signed: true };
      this.dtypes["int"] = { left: 31, right: 0, signed: true };
      this.dtypes["integer"] = { left: 31, right: 0, signed: true };
      this.dtypes["longint"] = { left: 63, right: 0, signed: true };
      this.dtypes["time"] = { left: 63, right: 0, signed: false };
    }
    defer(fn) {
      this.cur_deferred.unshift(fn);
    }
    defer2(fn) {
      this.cur_deferred.push(fn);
    }
    run_deferred() {
      this.cur_deferred.forEach((fn) => fn());
      this.cur_deferred = [];
    }
    name2js(s) {
      if (s == null)
        throw new CompileError2(this.cur_loc, `no name`);
      return s.replace(/[^a-z0-9_]/gi, "$");
    }
    findChildren(node, type, required) {
      var arr = node.children.filter((n) => n.type == type);
      if (arr.length == 0 && required)
        throw new CompileError2(this.cur_loc, `no child of type ${type}`);
      return arr;
    }
    parseSourceLocation(node) {
      var loc = node.attrs["loc"];
      if (loc) {
        if (loc == this.cur_loc_str) {
          return this.cur_loc;
        } else {
          var [fileid, line, col, end_line, end_col] = loc.split(",");
          var $loc = {
            hdlfile: this.files[fileid],
            path: this.files[fileid].filename,
            line: parseInt(line),
            start: parseInt(col) - 1,
            end_line: parseInt(end_line),
            end: parseInt(end_col) - 1
          };
          this.cur_loc = $loc;
          this.cur_loc_str = loc;
          return $loc;
        }
      } else {
        return null;
      }
    }
    open_module(node) {
      var module = {
        $loc: this.parseSourceLocation(node),
        name: node.attrs["name"],
        origName: node.attrs["origName"],
        blocks: [],
        instances: [],
        vardefs: {}
      };
      if (this.cur_module)
        throw new CompileError2(this.cur_loc, `nested modules not supported`);
      this.cur_module = module;
      return module;
    }
    deferDataType(node, def) {
      var dtype_id = node.attrs["dtype_id"];
      if (dtype_id != null) {
        this.defer(() => {
          def.dtype = this.dtypes[dtype_id];
          if (!def.dtype) {
            throw new CompileError2(this.cur_loc, `Unknown data type ${dtype_id} for ${node.type}`);
          }
        });
      }
    }
    parseConstValue(s) {
      const re_const = /(\d+)'([s]?)h([0-9a-f]+)/i;
      var m = re_const.exec(s);
      if (m) {
        var numstr = m[3];
        if (numstr.length <= 8)
          return parseInt(numstr, 16);
        else
          return BigInt("0x" + numstr);
      } else {
        throw new CompileError2(this.cur_loc, `could not parse constant "${s}"`);
      }
    }
    resolveVar(s, mod) {
      var def = mod.vardefs[s];
      if (def == null)
        throw new CompileError2(this.cur_loc, `could not resolve variable "${s}"`);
      return def;
    }
    resolveModule(s) {
      var mod = this.modules[s];
      if (mod == null)
        throw new CompileError2(this.cur_loc, `could not resolve module "${s}"`);
      return mod;
    }
    visit_verilator_xml(node) {
    }
    visit_package(node) {
    }
    visit_module(node) {
      this.findChildren(node, "var", false).forEach((n) => {
        if (isVarDecl(n.obj)) {
          this.cur_module.vardefs[n.obj.name] = n.obj;
        }
      });
      this.modules[this.cur_module.name] = this.cur_module;
      this.cur_module = null;
    }
    visit_var(node) {
      var name = node.attrs["name"];
      name = this.name2js(name);
      var vardef = {
        $loc: this.parseSourceLocation(node),
        name,
        origName: node.attrs["origName"],
        isInput: node.attrs["dir"] == "input",
        isOutput: node.attrs["dir"] == "output",
        isParam: node.attrs["param"] == "true",
        dtype: null
      };
      this.deferDataType(node, vardef);
      var const_nodes = this.findChildren(node, "const", false);
      if (const_nodes.length) {
        vardef.constValue = const_nodes[0].obj;
      }
      var init_nodes = this.findChildren(node, "initarray", false);
      if (init_nodes.length) {
        vardef.initValue = init_nodes[0].obj;
      }
      return vardef;
    }
    visit_const(node) {
      var name = node.attrs["name"];
      var cvalue = this.parseConstValue(name);
      var constdef = {
        $loc: this.parseSourceLocation(node),
        dtype: null,
        cvalue: typeof cvalue === "number" ? cvalue : null,
        bigvalue: typeof cvalue === "bigint" ? cvalue : null
      };
      this.deferDataType(node, constdef);
      return constdef;
    }
    visit_varref(node) {
      var name = node.attrs["name"];
      name = this.name2js(name);
      var varref = {
        $loc: this.parseSourceLocation(node),
        dtype: null,
        refname: name
      };
      this.deferDataType(node, varref);
      var mod = this.cur_module;
      return varref;
    }
    visit_sentree(node) {
    }
    visit_always(node) {
      var sentree;
      var expr;
      if (node.children.length == 2) {
        sentree = node.children[0].obj;
        expr = node.children[1].obj;
      } else {
        sentree = null;
        expr = node.children[0].obj;
      }
      var always = {
        $loc: this.parseSourceLocation(node),
        blocktype: node.type,
        name: null,
        senlist: sentree,
        exprs: [expr]
      };
      this.cur_module.blocks.push(always);
      return always;
    }
    visit_begin(node) {
      var exprs = [];
      node.children.forEach((n) => exprs.push(n.obj));
      return {
        $loc: this.parseSourceLocation(node),
        blocktype: node.type,
        name: node.attrs["name"],
        exprs
      };
    }
    visit_initarray(node) {
      return this.visit_begin(node);
    }
    visit_inititem(node) {
      this.expectChildren(node, 1, 1);
      return {
        index: parseInt(node.attrs["index"]),
        expr: node.children[0].obj
      };
    }
    visit_cfunc(node) {
      if (this.cur_module == null) {
        return;
      }
      var block = this.visit_begin(node);
      block.exprs = [];
      node.children.forEach((n) => block.exprs.push(n.obj));
      this.cur_module.blocks.push(block);
      return block;
    }
    visit_cuse(node) {
    }
    visit_instance(node) {
      var instance = {
        $loc: this.parseSourceLocation(node),
        name: node.attrs["name"],
        origName: node.attrs["origName"],
        ports: [],
        module: null
      };
      node.children.forEach((child) => {
        instance.ports.push(child.obj);
      });
      this.cur_module.instances.push(instance);
      this.defer(() => {
        instance.module = this.resolveModule(node.attrs["defName"]);
      });
      return instance;
    }
    visit_iface(node) {
      throw new CompileError2(this.cur_loc, `interfaces not supported`);
    }
    visit_intfref(node) {
      throw new CompileError2(this.cur_loc, `interfaces not supported`);
    }
    visit_port(node) {
      this.expectChildren(node, 1, 1);
      var varref = {
        $loc: this.parseSourceLocation(node),
        name: node.attrs["name"],
        expr: node.children[0].obj
      };
      return varref;
    }
    visit_netlist(node) {
    }
    visit_files(node) {
    }
    visit_module_files(node) {
      node.children.forEach((n) => {
        if (n.obj) {
          var file = this.files[n.obj.id];
          if (file)
            file.isModule = true;
        }
      });
    }
    visit_file(node) {
      return this.visit_file_or_module(node, false);
    }
    visit_scope(node) {
    }
    visit_topscope(node) {
    }
    visit_file_or_module(node, isModule) {
      var file = {
        id: node.attrs["id"],
        filename: node.attrs["filename"],
        isModule
      };
      this.files[file.id] = file;
      return file;
    }
    visit_cells(node) {
      this.expectChildren(node, 1, 9999);
      var hier = node.children[0].obj;
      if (hier != null) {
        var hiername = hier.name;
        this.hierarchies[hiername] = hier;
      }
    }
    visit_cell(node) {
      var hier = {
        $loc: this.parseSourceLocation(node),
        name: node.attrs["name"],
        module: null,
        parent: null,
        children: node.children.map((n) => n.obj)
      };
      if (node.children.length > 0)
        throw new CompileError2(this.cur_loc, `multiple non-flattened modules not yet supported`);
      node.children.forEach((n) => n.obj.parent = hier);
      this.defer(() => {
        hier.module = this.resolveModule(node.attrs["submodname"]);
      });
      return hier;
    }
    visit_basicdtype(node) {
      let id = node.attrs["id"];
      var dtype;
      var dtypename = node.attrs["name"];
      switch (dtypename) {
        case "logic":
        case "integer":
        case "bit":
          let dlogic = {
            $loc: this.parseSourceLocation(node),
            left: parseInt(node.attrs["left"] || "0"),
            right: parseInt(node.attrs["right"] || "0"),
            signed: node.attrs["signed"] == "true"
          };
          dtype = dlogic;
          break;
        case "string":
          let dstring = {
            $loc: this.parseSourceLocation(node),
            jstype: "string"
          };
          dtype = dstring;
          break;
        default:
          dtype = this.dtypes[dtypename];
          if (dtype == null) {
            throw new CompileError2(this.cur_loc, `unknown data type ${dtypename}`);
          }
      }
      this.dtypes[id] = dtype;
      return dtype;
    }
    visit_refdtype(node) {
    }
    visit_enumdtype(node) {
    }
    visit_enumitem(node) {
    }
    visit_packarraydtype(node) {
      return this.visit_unpackarraydtype(node);
    }
    visit_memberdtype(node) {
      throw new CompileError2(null, `structs not supported`);
    }
    visit_constdtype(node) {
    }
    visit_paramtypedtype(node) {
    }
    visit_unpackarraydtype(node) {
      let id = node.attrs["id"];
      let sub_dtype_id = node.attrs["sub_dtype_id"];
      let range = node.children[0].obj;
      if (isConstExpr(range.left) && isConstExpr(range.right)) {
        var dtype = {
          $loc: this.parseSourceLocation(node),
          subtype: null,
          low: range.left,
          high: range.right
        };
        this.dtypes[id] = dtype;
        this.defer(() => {
          dtype.subtype = this.dtypes[sub_dtype_id];
          if (!dtype.subtype)
            throw new CompileError2(this.cur_loc, `Unknown data type ${sub_dtype_id} for array`);
        });
        return dtype;
      } else {
        throw new CompileError2(this.cur_loc, `could not parse constant exprs in array`);
      }
    }
    visit_senitem(node) {
      var edgeType = node.attrs["edgeType"];
      if (edgeType != "POS" && edgeType != "NEG")
        throw new CompileError2(this.cur_loc, "POS/NEG required");
      return {
        $loc: this.parseSourceLocation(node),
        edgeType,
        expr: node.obj
      };
    }
    visit_text(node) {
    }
    visit_cstmt(node) {
    }
    visit_cfile(node) {
    }
    visit_typetable(node) {
    }
    visit_constpool(node) {
    }
    visit_comment(node) {
    }
    expectChildren(node, low, high) {
      if (node.children.length < low || node.children.length > high)
        throw new CompileError2(this.cur_loc, `expected between ${low} and ${high} children`);
    }
    __visit_unop(node) {
      this.expectChildren(node, 1, 1);
      var expr = {
        $loc: this.parseSourceLocation(node),
        op: node.type,
        dtype: null,
        left: node.children[0].obj
      };
      this.deferDataType(node, expr);
      return expr;
    }
    visit_extend(node) {
      var unop = this.__visit_unop(node);
      unop.width = parseInt(node.attrs["width"]);
      unop.widthminv = parseInt(node.attrs["widthminv"]);
      if (unop.width != 32)
        throw new CompileError2(this.cur_loc, `extends width ${unop.width} != 32`);
      return unop;
    }
    visit_extends(node) {
      return this.visit_extend(node);
    }
    __visit_binop(node) {
      this.expectChildren(node, 2, 2);
      var expr = {
        $loc: this.parseSourceLocation(node),
        op: node.type,
        dtype: null,
        left: node.children[0].obj,
        right: node.children[1].obj
      };
      this.deferDataType(node, expr);
      return expr;
    }
    visit_if(node) {
      this.expectChildren(node, 2, 3);
      var expr = {
        $loc: this.parseSourceLocation(node),
        op: "if",
        dtype: null,
        cond: node.children[0].obj,
        left: node.children[1].obj,
        right: node.children[2] && node.children[2].obj
      };
      return expr;
    }
    visit_while(node) {
      this.expectChildren(node, 2, 4);
      var expr = {
        $loc: this.parseSourceLocation(node),
        op: "while",
        dtype: null,
        precond: node.children[0].obj,
        loopcond: node.children[1].obj,
        body: node.children[2] && node.children[2].obj,
        inc: node.children[3] && node.children[3].obj
      };
      return expr;
    }
    __visit_triop(node) {
      this.expectChildren(node, 3, 3);
      var expr = {
        $loc: this.parseSourceLocation(node),
        op: node.type,
        dtype: null,
        cond: node.children[0].obj,
        left: node.children[1].obj,
        right: node.children[2].obj
      };
      this.deferDataType(node, expr);
      return expr;
    }
    __visit_func(node) {
      var expr = {
        $loc: this.parseSourceLocation(node),
        dtype: null,
        funcname: node.attrs["func"] || "$" + node.type,
        args: node.children.map((n) => n.obj)
      };
      this.deferDataType(node, expr);
      return expr;
    }
    visit_not(node) {
      return this.__visit_unop(node);
    }
    visit_negate(node) {
      return this.__visit_unop(node);
    }
    visit_redand(node) {
      return this.__visit_unop(node);
    }
    visit_redor(node) {
      return this.__visit_unop(node);
    }
    visit_redxor(node) {
      return this.__visit_unop(node);
    }
    visit_initial(node) {
      return this.__visit_unop(node);
    }
    visit_ccast(node) {
      return this.__visit_unop(node);
    }
    visit_creset(node) {
      return this.__visit_unop(node);
    }
    visit_creturn(node) {
      return this.__visit_unop(node);
    }
    visit_contassign(node) {
      return this.__visit_binop(node);
    }
    visit_assigndly(node) {
      return this.__visit_binop(node);
    }
    visit_assignpre(node) {
      return this.__visit_binop(node);
    }
    visit_assignpost(node) {
      return this.__visit_binop(node);
    }
    visit_assign(node) {
      return this.__visit_binop(node);
    }
    visit_arraysel(node) {
      return this.__visit_binop(node);
    }
    visit_wordsel(node) {
      return this.__visit_binop(node);
    }
    visit_eq(node) {
      return this.__visit_binop(node);
    }
    visit_neq(node) {
      return this.__visit_binop(node);
    }
    visit_lte(node) {
      return this.__visit_binop(node);
    }
    visit_gte(node) {
      return this.__visit_binop(node);
    }
    visit_lt(node) {
      return this.__visit_binop(node);
    }
    visit_gt(node) {
      return this.__visit_binop(node);
    }
    visit_and(node) {
      return this.__visit_binop(node);
    }
    visit_or(node) {
      return this.__visit_binop(node);
    }
    visit_xor(node) {
      return this.__visit_binop(node);
    }
    visit_add(node) {
      return this.__visit_binop(node);
    }
    visit_sub(node) {
      return this.__visit_binop(node);
    }
    visit_concat(node) {
      return this.__visit_binop(node);
    }
    visit_shiftl(node) {
      return this.__visit_binop(node);
    }
    visit_shiftr(node) {
      return this.__visit_binop(node);
    }
    visit_shiftrs(node) {
      return this.__visit_binop(node);
    }
    visit_mul(node) {
      return this.__visit_binop(node);
    }
    visit_div(node) {
      return this.__visit_binop(node);
    }
    visit_moddiv(node) {
      return this.__visit_binop(node);
    }
    visit_muls(node) {
      return this.__visit_binop(node);
    }
    visit_divs(node) {
      return this.__visit_binop(node);
    }
    visit_moddivs(node) {
      return this.__visit_binop(node);
    }
    visit_gts(node) {
      return this.__visit_binop(node);
    }
    visit_lts(node) {
      return this.__visit_binop(node);
    }
    visit_gtes(node) {
      return this.__visit_binop(node);
    }
    visit_ltes(node) {
      return this.__visit_binop(node);
    }
    visit_range(node) {
      return this.__visit_binop(node);
    }
    visit_cond(node) {
      return this.__visit_triop(node);
    }
    visit_condbound(node) {
      return this.__visit_triop(node);
    }
    visit_sel(node) {
      return this.__visit_triop(node);
    }
    visit_changedet(node) {
      if (node.children.length == 0)
        return null;
      else
        return this.__visit_binop(node);
    }
    visit_ccall(node) {
      return this.__visit_func(node);
    }
    visit_finish(node) {
      return this.__visit_func(node);
    }
    visit_stop(node) {
      return this.__visit_func(node);
    }
    visit_rand(node) {
      return this.__visit_func(node);
    }
    visit_time(node) {
      return this.__visit_func(node);
    }
    visit_display(node) {
      return null;
    }
    visit_sformatf(node) {
      return null;
    }
    visit_scopename(node) {
      return null;
    }
    visit_readmem(node) {
      return this.__visit_func(node);
    }
    xml_open(node) {
      this.cur_node = node;
      var method = this[`open_${node.type}`];
      if (method) {
        return method.bind(this)(node);
      }
    }
    xml_close(node) {
      this.cur_node = node;
      var method = this[`visit_${node.type}`];
      if (method) {
        return method.bind(this)(node);
      } else {
        throw new CompileError2(this.cur_loc, `no visitor for ${node.type}`);
      }
    }
    parse(xmls) {
      parseXMLPoorly(xmls, this.xml_open.bind(this), this.xml_close.bind(this));
      this.cur_node = null;
      this.run_deferred();
    }
  };

  // src/worker/tools/verilog.ts
  function detectModuleName(code) {
    var m = /^\s*module\s+(\w+_top)\b/m.exec(code) || /^\s*module\s+(top|t)\b/m.exec(code) || /^\s*module\s+(\w+)\b/m.exec(code);
    return m ? m[1] : null;
  }
  function detectTopModuleName(code) {
    var topmod = detectModuleName(code) || "top";
    var m = /^\s*module\s+(\w+?_top)/m.exec(code);
    if (m && m[1])
      topmod = m[1];
    return topmod;
  }
  var jsasm_module_top;
  var jsasm_module_output;
  var jsasm_module_key;
  function compileJSASM(asmcode, platform, options, is_inline) {
    var asm = new Assembler(null);
    var includes = [];
    asm.loadJSON = (filename) => {
      var jsontext = getWorkFileAsString(filename);
      if (!jsontext)
        throw Error("could not load " + filename);
      return JSON.parse(jsontext);
    };
    asm.loadInclude = (filename) => {
      if (!filename.startsWith('"') || !filename.endsWith('"'))
        return 'Expected filename in "double quotes"';
      filename = filename.substr(1, filename.length - 2);
      includes.push(filename);
    };
    var loaded_module = false;
    asm.loadModule = (top_module) => {
      loaded_module = true;
      var key = top_module + "/" + includes;
      if (jsasm_module_key != key) {
        jsasm_module_key = key;
        jsasm_module_output = null;
      }
      jsasm_module_top = top_module;
      var main_filename = includes[includes.length - 1];
      var voutput = compileVerilator({ platform, files: includes, path: main_filename, tool: "verilator" });
      if (voutput)
        jsasm_module_output = voutput;
      return null;
    };
    var result = asm.assembleFile(asmcode);
    if (loaded_module && jsasm_module_output) {
      if (jsasm_module_output.errors && jsasm_module_output.errors.length)
        return jsasm_module_output;
      var asmout = result.output;
      result.output = jsasm_module_output.output;
      result.output.program_rom = asmout;
      result.output.program_rom_variable = jsasm_module_top + "$program_rom";
      result.listings = {};
      result.listings[options.path] = { lines: result.lines };
      return result;
    } else {
      return result;
    }
  }
  function compileJSASMStep(step) {
    gatherFiles(step);
    var code = getWorkFileAsString(step.path);
    var platform = step.platform || "verilog";
    return compileJSASM(code, platform, step, false);
  }
  function compileInlineASM(code, platform, options, errors, asmlines) {
    code = code.replace(/__asm\b([\s\S]+?)\b__endasm\b/g, function(s, asmcode, index) {
      var firstline = code.substr(0, index).match(/\n/g).length;
      var asmout = compileJSASM(asmcode, platform, options, true);
      if (asmout.errors && asmout.errors.length) {
        for (var i = 0; i < asmout.errors.length; i++) {
          asmout.errors[i].line += firstline;
          errors.push(asmout.errors[i]);
        }
        return "";
      } else if (asmout.output) {
        let s2 = "";
        var out = asmout.output;
        for (var i = 0; i < out.length; i++) {
          if (i > 0) {
            s2 += ",";
            if ((i & 255) == 0)
              s2 += "\n";
          }
          s2 += 0 | out[i];
        }
        if (asmlines) {
          var al = asmout.lines;
          for (var i = 0; i < al.length; i++) {
            al[i].line += firstline;
            asmlines.push(al[i]);
          }
        }
        return s2;
      }
    });
    return code;
  }
  function compileVerilator(step) {
    loadNative("verilator_bin");
    var platform = step.platform || "verilog";
    var errors = [];
    gatherFiles(step);
    if (staleFiles(step, [xmlPath])) {
      var match_fn = makeErrorMatcher(errors, /%(.+?): (.+?):(\d+)?[:]?\s*(.+)/i, 3, 4, step.path, 2);
      var verilator_mod = emglobal.verilator_bin({
        instantiateWasm: moduleInstFn("verilator_bin"),
        noInitialRun: true,
        noExitRuntime: true,
        print: print_fn,
        printErr: match_fn,
        wasmMemory: getWASMMemory()
      });
      var code = getWorkFileAsString(step.path);
      var topmod = detectTopModuleName(code);
      var FS = verilator_mod.FS;
      var listings = {};
      populateFiles(step, FS, {
        mainFilePath: step.path,
        processFn: (path, code2) => {
          if (typeof code2 === "string") {
            let asmlines = [];
            code2 = compileInlineASM(code2, platform, step, errors, asmlines);
            if (asmlines.length) {
              listings[path] = { lines: asmlines };
            }
          }
          return code2;
        }
      });
      starttime();
      var xmlPath = `obj_dir/V${topmod}.xml`;
      try {
        var args = [
          "--cc",
          "-O3",
          "-DEXT_INLINE_ASM",
          "-DTOPMOD__" + topmod,
          "-D__8BITWORKSHOP__",
          "-Wall",
          "-Wno-DECLFILENAME",
          "-Wno-UNUSED",
          "-Wno-EOFNEWLINE",
          "-Wno-PROCASSWIRE",
          "--x-assign",
          "fast",
          "--noassert",
          "--pins-sc-biguint",
          "--debug-check",
          "--top-module",
          topmod,
          step.path
        ];
        execMain(step, verilator_mod, args);
      } catch (e) {
        console.log(e);
        errors.push({ line: 0, msg: "Compiler internal error: " + e });
      }
      endtime("compile");
      errors = errors.filter(function(e) {
        return !/Exiting due to \d+/.exec(e.msg);
      }, errors);
      errors = errors.filter(function(e) {
        return !/Use ["][/][*]/.exec(e.msg);
      }, errors);
      if (errors.length) {
        return { errors };
      }
      starttime();
      var xmlParser = new VerilogXMLParser();
      try {
        var xmlContent = FS.readFile(xmlPath, { encoding: "utf8" });
        var xmlScrubbed = xmlContent.replace(/ fl=".+?" loc=".+?"/g, "");
        putWorkFile(xmlPath, xmlScrubbed);
        if (!anyTargetChanged(step, [xmlPath]))
          return;
        xmlParser.parse(xmlContent);
      } catch (e) {
        console.log(e, e.stack);
        if (e.$loc != null) {
          let $loc = e.$loc;
          errors.push({ msg: "" + e, path: $loc.path, line: $loc.line });
        } else {
          errors.push({ line: 0, msg: "" + e });
        }
        return { errors, listings };
      } finally {
        endtime("parse");
      }
      return {
        output: xmlParser,
        errors,
        listings
      };
    }
  }
  function compileYosys(step) {
    loadNative("yosys");
    var code = step.code;
    var errors = [];
    var match_fn = makeErrorMatcher(errors, /ERROR: (.+?) in line (.+?[.]v):(\d+)[: ]+(.+)/i, 3, 4, step.path);
    starttime();
    var yosys_mod = emglobal.yosys({
      instantiateWasm: moduleInstFn("yosys"),
      noInitialRun: true,
      print: print_fn,
      printErr: match_fn
    });
    endtime("create module");
    var topmod = detectTopModuleName(code);
    var FS = yosys_mod.FS;
    FS.writeFile(topmod + ".v", code);
    starttime();
    try {
      execMain(step, yosys_mod, ["-q", "-o", topmod + ".json", "-S", topmod + ".v"]);
    } catch (e) {
      console.log(e);
      endtime("compile");
      return { errors };
    }
    endtime("compile");
    if (errors.length)
      return { errors };
    try {
      var json_file = FS.readFile(topmod + ".json", { encoding: "utf8" });
      var json = JSON.parse(json_file);
      console.log(json);
      return { output: json, errors };
    } catch (e) {
      console.log(e);
      return { errors };
    }
  }
  function compileSilice(step) {
    loadNative("silice");
    var params = step.params;
    gatherFiles(step, { mainFilePath: "main.ice" });
    var destpath = step.prefix + ".v";
    var errors = [];
    var errfile;
    var errline;
    if (staleFiles(step, [destpath])) {
      var match_fn = (s) => {
        s = s.replaceAll(/\033\[\d+\w/g, "");
        var mf = /file:\s*(\w+)/.exec(s);
        var ml = /line:\s+(\d+)/.exec(s);
        var preproc = /\[preprocessor\] (\d+)\] (.+)/.exec(s);
        if (mf)
          errfile = mf[1];
        else if (ml)
          errline = parseInt(ml[1]);
        else if (preproc) {
          errors.push({ path: step.path, line: parseInt(preproc[1]), msg: preproc[2] });
        } else if (errfile && errline && s.length > 1) {
          if (s.length > 2) {
            errors.push({ path: errfile + ".ice", line: errline, msg: s });
          } else {
            errfile = null;
            errline = null;
          }
        } else
          console.log(s);
      };
      var silice = emglobal.silice({
        instantiateWasm: moduleInstFn("silice"),
        noInitialRun: true,
        print: match_fn,
        printErr: match_fn
      });
      var FS = silice.FS;
      setupFS(FS, "Silice");
      populateFiles(step, FS);
      populateExtraFiles(step, FS, params.extra_compile_files);
      const FWDIR = "/share/frameworks";
      var args = [
        "-D",
        "NTSC=1",
        "--frameworks_dir",
        FWDIR,
        "-f",
        `/8bitworkshop.v`,
        "-o",
        destpath,
        step.path
      ];
      execMain(step, silice, args);
      if (errors.length)
        return { errors };
      var vout = FS.readFile(destpath, { encoding: "utf8" });
      putWorkFile(destpath, vout);
    }
    return {
      nexttool: "verilator",
      path: destpath,
      args: [destpath],
      files: [destpath]
    };
  }

  // src/worker/tools/m6809.ts
  function assembleXASM6809(step) {
    load("xasm6809");
    var alst = "";
    var lasterror = null;
    var errors = [];
    function match_fn(s) {
      alst += s;
      alst += "\n";
      if (lasterror) {
        var line = parseInt(s.slice(0, 5)) || 0;
        errors.push({
          line,
          msg: lasterror
        });
        lasterror = null;
      } else if (s.startsWith("***** ")) {
        lasterror = s.slice(6);
      }
    }
    var Module = emglobal.xasm6809({
      noInitialRun: true,
      print: match_fn,
      printErr: print_fn
    });
    var FS = Module.FS;
    populateFiles(step, FS, {
      mainFilePath: "main.asm"
    });
    var binpath = step.prefix + ".bin";
    var lstpath = step.prefix + ".lst";
    execMain(step, Module, ["-c", "-l", "-s", "-y", "-o=" + binpath, step.path]);
    if (errors.length)
      return { errors };
    var aout = FS.readFile(binpath, { encoding: "binary" });
    if (aout.length == 0) {
      errors.push({ line: 0, msg: "Empty output file" });
      return { errors };
    }
    putWorkFile(binpath, aout);
    putWorkFile(lstpath, alst);
    var symbolmap = {};
    var asmlines = parseListing(alst, /^\s*([0-9]+) .+ ([0-9A-F]+)\s+\[([0-9 ]+)\]\s+([0-9A-F]+) (.*)/i, 1, 2, 4, 3);
    var listings = {};
    listings[step.prefix + ".lst"] = { lines: asmlines, text: alst };
    return {
      output: aout,
      listings,
      errors,
      symbolmap
    };
  }
  function compileCMOC(step) {
    loadNative("cmoc");
    var params = step.params;
    var re_err1 = /^[/]*([^:]*):(\d+): (.+)$/;
    var errors = [];
    var errline = 0;
    function match_fn(s) {
      var matches = re_err1.exec(s);
      if (matches) {
        errors.push({
          line: parseInt(matches[2]),
          msg: matches[3],
          path: matches[1] || step.path
        });
      } else {
        console.log(s);
      }
    }
    gatherFiles(step, { mainFilePath: "main.c" });
    var destpath = step.prefix + ".s";
    if (staleFiles(step, [destpath])) {
      var args = [
        "-S",
        "-Werror",
        "-V",
        "-I/share/include",
        "-I.",
        step.path
      ];
      var CMOC = emglobal.cmoc({
        instantiateWasm: moduleInstFn("cmoc"),
        noInitialRun: true,
        print: match_fn,
        printErr: match_fn
      });
      var code = getWorkFileAsString(step.path);
      var preproc = preprocessMCPP(step, null);
      if (preproc.errors) {
        return { errors: preproc.errors };
      } else
        code = preproc.code;
      var FS = CMOC.FS;
      populateFiles(step, FS);
      FS.writeFile(step.path, code);
      fixParamsWithDefines(step.path, params);
      if (params.extra_compile_args) {
        args.unshift.apply(args, params.extra_compile_args);
      }
      execMain(step, CMOC, args);
      if (errors.length)
        return { errors };
      var asmout = FS.readFile(destpath, { encoding: "utf8" });
      if (step.params.set_stack_end)
        asmout = asmout.replace("stack space in bytes", `
 lds #${step.params.set_stack_end}
`);
      putWorkFile(destpath, asmout);
    }
    return {
      nexttool: "lwasm",
      path: destpath,
      args: [destpath],
      files: [destpath]
    };
  }
  function assembleLWASM(step) {
    loadNative("lwasm");
    var errors = [];
    gatherFiles(step, { mainFilePath: "main.s" });
    var objpath = step.prefix + ".o";
    var lstpath = step.prefix + ".lst";
    const isRaw = step.path.endsWith(".asm");
    if (staleFiles(step, [objpath, lstpath])) {
      var objout, lstout;
      var args = ["-9", "-I/share/asminc", "-o" + objpath, "-l" + lstpath, step.path];
      args.push(isRaw ? "-r" : "--obj");
      var LWASM = emglobal.lwasm({
        instantiateWasm: moduleInstFn("lwasm"),
        noInitialRun: true,
        print: print_fn,
        printErr: msvcErrorMatcher(errors)
      });
      var FS = LWASM.FS;
      populateFiles(step, FS);
      fixParamsWithDefines(step.path, step.params);
      execMain(step, LWASM, args);
      if (errors.length)
        return { errors };
      objout = FS.readFile(objpath, { encoding: "binary" });
      lstout = FS.readFile(lstpath, { encoding: "utf8" });
      putWorkFile(objpath, objout);
      putWorkFile(lstpath, lstout);
      if (isRaw) {
        return {
          output: objout
        };
      }
    }
    return {
      linktool: "lwlink",
      files: [objpath, lstpath],
      args: [objpath]
    };
  }
  function linkLWLINK(step) {
    loadNative("lwlink");
    var params = step.params;
    gatherFiles(step);
    var binpath = "main";
    if (staleFiles(step, [binpath])) {
      var errors = [];
      var LWLINK = emglobal.lwlink({
        instantiateWasm: moduleInstFn("lwlink"),
        noInitialRun: true,
        print: print_fn,
        printErr: function(s2) {
          if (s2.startsWith("Warning:"))
            console.log(s2);
          else
            errors.push({ msg: s2, line: 0 });
        }
      });
      var FS = LWLINK.FS;
      populateFiles(step, FS);
      populateExtraFiles(step, FS, params.extra_link_files);
      var libargs = params.extra_link_args || [];
      var args = [
        "-L.",
        "--entry=program_start",
        "--raw",
        "--output=main",
        "--map=main.map"
      ].concat(libargs, step.args);
      console.log(args);
      execMain(step, LWLINK, args);
      if (errors.length)
        return { errors };
      var aout = FS.readFile("main", { encoding: "binary" });
      var mapout = FS.readFile("main.map", { encoding: "utf8" });
      putWorkFile("main", aout);
      putWorkFile("main.map", mapout);
      if (!anyTargetChanged(step, ["main", "main.map"]))
        return;
      var symbolmap = {};
      var segments = [];
      for (var s of mapout.split("\n")) {
        var toks = s.split(" ");
        if (toks[0] == "Symbol:") {
          let ident = toks[1];
          let ofs = parseInt(toks[4], 16);
          if (ident && ofs >= 0 && !ident.startsWith("l_") && !ident.startsWith("funcsize_") && !ident.startsWith("funcend_")) {
            symbolmap[ident] = ofs;
          }
        } else if (toks[0] == "Section:") {
          let seg = toks[1];
          let segstart = parseInt(toks[5], 16);
          let segsize = parseInt(toks[7], 16);
          segments.push({ name: seg, start: segstart, size: segsize });
        }
      }
      const re_segment = /\s*SECTION\s+(\w+)/i;
      const re_function = /\s*([0-9a-f]+).+?(\w+)\s+EQU\s+[*]/i;
      var listings = {};
      for (var fn of step.files) {
        if (fn.endsWith(".lst")) {
          var lstout = FS.readFile(fn, { encoding: "utf8" });
          var asmlines = parseListing(lstout, /^([0-9A-F]+)\s+([0-9A-F]+)\s+[(]\s*(.+?)[)]:(\d+) (.*)/i, 4, 1, 2, 3, re_function, re_segment);
          for (let l of asmlines) {
            l.offset += symbolmap[l.func] || 0;
          }
          var srclines = parseSourceLines(lstout, /Line .+?:(\d+)/i, /^([0-9A-F]{4})/i, re_function, re_segment);
          for (let l of srclines) {
            l.offset += symbolmap[l.func] || 0;
          }
          putWorkFile(fn, lstout);
          lstout = lstout.split("\n").map((l) => l.substring(0, 15) + l.substring(56)).join("\n");
          listings[fn] = {
            asmlines: srclines.length ? asmlines : null,
            lines: srclines.length ? srclines : asmlines,
            text: lstout
          };
        }
      }
      return {
        output: aout,
        listings,
        errors,
        symbolmap,
        segments
      };
    }
  }

  // src/worker/tools/m6502.ts
  function assembleNESASM(step) {
    loadNative("nesasm");
    var re_filename = /\#\[(\d+)\]\s+(\S+)/;
    var re_insn = /\s+(\d+)\s+([0-9A-F]+):([0-9A-F]+)/;
    var re_error = /\s+(.+)/;
    var errors = [];
    var state = 0;
    var lineno = 0;
    var filename;
    function match_fn(s2) {
      var m2;
      switch (state) {
        case 0:
          m2 = re_filename.exec(s2);
          if (m2) {
            filename = m2[2];
          }
          m2 = re_insn.exec(s2);
          if (m2) {
            lineno = parseInt(m2[1]);
            state = 1;
          }
          break;
        case 1:
          m2 = re_error.exec(s2);
          if (m2) {
            errors.push({ path: filename, line: lineno, msg: m2[1] });
            state = 0;
          }
          break;
      }
    }
    var Module = emglobal.nesasm({
      instantiateWasm: moduleInstFn("nesasm"),
      noInitialRun: true,
      print: match_fn
    });
    var FS = Module.FS;
    populateFiles(step, FS, {
      mainFilePath: "main.a"
    });
    var binpath = step.prefix + ".nes";
    var lstpath = step.prefix + ".lst";
    var sympath = step.prefix + ".fns";
    execMain(step, Module, [step.path, "-s", "-l", "2"]);
    var listings = {};
    try {
      var alst = FS.readFile(lstpath, { "encoding": "utf8" });
      var asmlines = parseListing(alst, /^\s*(\d+)\s+([0-9A-F]+):([0-9A-F]+)\s+([0-9A-F ]+?)  (.*)/i, 1, 3, 4);
      putWorkFile(lstpath, alst);
      listings[lstpath] = {
        lines: asmlines,
        text: alst
      };
    } catch (e) {
    }
    if (errors.length) {
      return { errors };
    }
    var aout, asym;
    aout = FS.readFile(binpath);
    try {
      asym = FS.readFile(sympath, { "encoding": "utf8" });
    } catch (e) {
      console.log(e);
      errors.push({ line: 0, msg: "No symbol table generated, maybe missing ENDM or segment overflow?" });
      return { errors };
    }
    putWorkFile(binpath, aout);
    putWorkFile(sympath, asym);
    if (alst)
      putWorkFile(lstpath, alst);
    if (!anyTargetChanged(step, [binpath, sympath]))
      return;
    var symbolmap = {};
    for (var s of asym.split("\n")) {
      if (!s.startsWith(";")) {
        var m = /(\w+)\s+=\s+[$]([0-9A-F]+)/.exec(s);
        if (m) {
          symbolmap[m[1]] = parseInt(m[2], 16);
        }
      }
    }
    return {
      output: aout,
      listings,
      errors,
      symbolmap
    };
  }
  function assembleMerlin32(step) {
    loadNative("merlin32");
    var errors = [];
    var lstfiles = [];
    gatherFiles(step, { mainFilePath: "main.lnk" });
    var objpath = step.prefix + ".bin";
    if (staleFiles(step, [objpath])) {
      var args = ["-v", step.path];
      var merlin32 = emglobal.merlin32({
        instantiateWasm: moduleInstFn("merlin32"),
        noInitialRun: true,
        print: (s) => {
          var m = /\s*=>\s*Creating Output file '(.+?)'/.exec(s);
          if (m) {
            lstfiles.push(m[1]);
          }
          var errpos = s.indexOf("Error");
          if (errpos >= 0) {
            s = s.slice(errpos + 6).trim();
            var mline = /\bline (\d+)\b/.exec(s);
            var mpath = /\bfile '(.+?)'/.exec(s);
            errors.push({
              line: parseInt(mline[1]) || 0,
              msg: s,
              path: mpath[1] || step.path
            });
          }
        },
        printErr: print_fn
      });
      var FS = merlin32.FS;
      populateFiles(step, FS);
      execMain(step, merlin32, args);
      if (errors.length)
        return { errors };
      var errout = null;
      try {
        errout = FS.readFile("error_output.txt", { encoding: "utf8" });
      } catch (e) {
      }
      var objout = FS.readFile(objpath, { encoding: "binary" });
      putWorkFile(objpath, objout);
      if (!anyTargetChanged(step, [objpath]))
        return;
      var symbolmap = {};
      var segments = [];
      var listings = {};
      lstfiles.forEach((lstfn) => {
        var lst = FS.readFile(lstfn, { encoding: "utf8" });
        lst.split("\n").forEach((line) => {
          var toks = line.split(/\s*\|\s*/);
          if (toks && toks[6]) {
            var toks2 = toks[1].split(/\s+/);
            var toks3 = toks[6].split(/[:/]/, 4);
            var path = toks2[1];
            if (path && toks2[2] && toks3[1]) {
              var lstline = {
                line: parseInt(toks2[2]),
                offset: parseInt(toks3[1].trim(), 16),
                insns: toks3[2],
                cycles: null,
                iscode: false
              };
              var lst2 = listings[path];
              if (!lst2)
                listings[path] = lst2 = { lines: [] };
              lst2.lines.push(lstline);
            }
          }
        });
      });
      return {
        output: objout,
        listings,
        errors,
        symbolmap,
        segments
      };
    }
  }
  function compileFastBasic(step) {
    loadNative("fastbasic-int");
    var params = step.params;
    gatherFiles(step, { mainFilePath: "main.fb" });
    var destpath = step.prefix + ".s";
    var errors = [];
    if (staleFiles(step, [destpath])) {
      var fastbasic = emglobal.fastbasic({
        instantiateWasm: moduleInstFn("fastbasic-int"),
        noInitialRun: true,
        print: print_fn,
        printErr: makeErrorMatcher(errors, /(.+?):(\d+):(\d+):\s*(.+)/, 2, 4, step.path, 1)
      });
      var FS = fastbasic.FS;
      populateFiles(step, FS);
      var libfile = "fastbasic-int.lib";
      params.libargs = [libfile];
      params.cfgfile = params.fastbasic_cfgfile;
      params.extra_link_files = [libfile, params.cfgfile];
      var args = [step.path, destpath];
      execMain(step, fastbasic, args);
      if (errors.length)
        return { errors };
      var asmout = FS.readFile(destpath, { encoding: "utf8" });
      putWorkFile(destpath, asmout);
    }
    return {
      nexttool: "ca65",
      path: destpath,
      args: [destpath],
      files: [destpath]
    };
  }

  // src/worker/tools/z80.ts
  function assembleZMAC(step) {
    loadNative("zmac");
    var hexout, lstout, binout;
    var errors = [];
    var params = step.params;
    gatherFiles(step, { mainFilePath: "main.asm" });
    var lstpath = step.prefix + ".lst";
    var binpath = step.prefix + ".cim";
    if (staleFiles(step, [binpath, lstpath])) {
      var ZMAC = emglobal.zmac({
        instantiateWasm: moduleInstFn("zmac"),
        noInitialRun: true,
        print: print_fn,
        printErr: makeErrorMatcher(errors, /([^( ]+)\s*[(](\d+)[)]\s*:\s*(.+)/, 2, 3, step.path)
      });
      var FS = ZMAC.FS;
      populateFiles(step, FS);
      execMain(step, ZMAC, ["-z", "-c", "--oo", "lst,cim", step.path]);
      if (errors.length) {
        return { errors };
      }
      lstout = FS.readFile("zout/" + lstpath, { encoding: "utf8" });
      binout = FS.readFile("zout/" + binpath, { encoding: "binary" });
      putWorkFile(binpath, binout);
      putWorkFile(lstpath, lstout);
      if (!anyTargetChanged(step, [binpath, lstpath]))
        return;
      var lines = parseListing(lstout, /\s*(\d+):\s*([0-9a-f]+)\s+([0-9a-f]+)\s+(.+)/i, 1, 2, 3);
      var listings = {};
      listings[lstpath] = { lines };
      var symbolmap = {};
      var sympos = lstout.indexOf("Symbol Table:");
      if (sympos > 0) {
        var symout = lstout.slice(sympos + 14);
        symout.split("\n").forEach(function(l) {
          var m = l.match(/(\S+)\s+([= ]*)([0-9a-f]+)/i);
          if (m) {
            symbolmap[m[1]] = parseInt(m[3], 16);
          }
        });
      }
      return {
        output: binout,
        listings,
        errors,
        symbolmap
      };
    }
  }

  // src/worker/tools/x86.ts
  function compileSmallerC(step) {
    loadNative("smlrc");
    var params = step.params;
    var re_err1 = /^Error in "[/]*(.+)" [(](\d+):(\d+)[)]/;
    var errors = [];
    var errline = 0;
    var errpath = step.path;
    function match_fn(s) {
      var matches = re_err1.exec(s);
      if (matches) {
        errline = parseInt(matches[2]);
        errpath = matches[1];
      } else {
        errors.push({
          line: errline,
          msg: s,
          path: errpath
        });
      }
    }
    gatherFiles(step, { mainFilePath: "main.c" });
    var destpath = step.prefix + ".asm";
    if (staleFiles(step, [destpath])) {
      var args = [
        "-seg16",
        "-no-externs",
        step.path,
        destpath
      ];
      var smlrc = emglobal.smlrc({
        instantiateWasm: moduleInstFn("smlrc"),
        noInitialRun: true,
        print: match_fn,
        printErr: match_fn
      });
      var code = getWorkFileAsString(step.path);
      var preproc = preprocessMCPP(step, null);
      if (preproc.errors) {
        return { errors: preproc.errors };
      } else
        code = preproc.code;
      var FS = smlrc.FS;
      populateFiles(step, FS);
      FS.writeFile(step.path, code);
      fixParamsWithDefines(step.path, params);
      if (params.extra_compile_args) {
        args.unshift.apply(args, params.extra_compile_args);
      }
      execMain(step, smlrc, args);
      if (errors.length)
        return { errors };
      var asmout = FS.readFile(destpath, { encoding: "utf8" });
      putWorkFile(destpath, asmout);
    }
    return {
      nexttool: "yasm",
      path: destpath,
      args: [destpath],
      files: [destpath]
    };
  }
  function assembleYASM(step) {
    loadNative("yasm");
    var errors = [];
    gatherFiles(step, { mainFilePath: "main.asm" });
    var objpath = step.prefix + ".exe";
    var lstpath = step.prefix + ".lst";
    var mappath = step.prefix + ".map";
    if (staleFiles(step, [objpath])) {
      var args = [
        "-X",
        "vc",
        "-a",
        "x86",
        "-f",
        "dosexe",
        "-p",
        "nasm",
        "-D",
        "freedos",
        "-o",
        objpath,
        "-l",
        lstpath,
        "--mapfile=" + mappath,
        step.path
      ];
      var YASM = emglobal.yasm({
        instantiateWasm: moduleInstFn("yasm"),
        noInitialRun: true,
        print: print_fn,
        printErr: msvcErrorMatcher(errors)
      });
      var FS = YASM.FS;
      populateFiles(step, FS);
      execMain(step, YASM, args);
      if (errors.length)
        return { errors };
      var objout, lstout, mapout;
      objout = FS.readFile(objpath, { encoding: "binary" });
      lstout = FS.readFile(lstpath, { encoding: "utf8" });
      mapout = FS.readFile(mappath, { encoding: "utf8" });
      putWorkFile(objpath, objout);
      putWorkFile(lstpath, lstout);
      if (!anyTargetChanged(step, [objpath]))
        return;
      var symbolmap = {};
      var segments = [];
      var lines = parseListing(lstout, /\s*(\d+)\s+([0-9a-f]+)\s+([0-9a-f]+)\s+(.+)/i, 1, 2, 3);
      var listings = {};
      listings[lstpath] = { lines, text: lstout };
      return {
        output: objout,
        listings,
        errors,
        symbolmap,
        segments
      };
    }
  }

  // src/worker/tools/arm.ts
  function assembleARMIPS(step) {
    loadNative("armips");
    var errors = [];
    gatherFiles(step, { mainFilePath: "main.asm" });
    var objpath = "main.bin";
    var lstpath = step.prefix + ".lst";
    var sympath = step.prefix + ".sym";
    var error_fn = makeErrorMatcher(errors, /^(.+?)\((\d+)\)\s+(fatal error|error|warning):\s+(.+)/, 2, 4, step.path, 1);
    if (staleFiles(step, [objpath])) {
      var args = [step.path, "-temp", lstpath, "-sym", sympath, "-erroronwarning"];
      var armips = emglobal.armips({
        instantiateWasm: moduleInstFn("armips"),
        noInitialRun: true,
        print: error_fn,
        printErr: error_fn
      });
      var FS = armips.FS;
      var code = getWorkFileAsString(step.path);
      code = `.arm.little :: .create "${objpath}",0 :: ${code}
  .close`;
      putWorkFile(step.path, code);
      populateFiles(step, FS);
      execMain(step, armips, args);
      if (errors.length)
        return { errors };
      var objout = FS.readFile(objpath, { encoding: "binary" });
      putWorkFile(objpath, objout);
      if (!anyTargetChanged(step, [objpath]))
        return;
      var symbolmap = {};
      var segments = [];
      var listings = {};
      var lstout = FS.readFile(lstpath, { encoding: "utf8" });
      var lines = lstout.split(re_crlf);
      var re_asmline = /^([0-9A-F]+) (.+?); [/](.+?) line (\d+)/;
      var lastofs = -1;
      for (var line of lines) {
        var m;
        if (m = re_asmline.exec(line)) {
          var path = m[3];
          var path2 = getPrefix(path) + ".lst";
          var lst = listings[path2];
          if (lst == null) {
            lst = listings[path2] = { lines: [] };
          }
          var ofs = parseInt(m[1], 16);
          if (lastofs == ofs) {
            lst.lines.pop();
          } else if (ofs > lastofs) {
            var lastline = lst.lines[lst.lines.length - 1];
            if (lastline && !lastline.insns) {
              var insns = objout.slice(lastofs, ofs).reverse();
              lastline.insns = Array.from(insns).map((b) => hex(b, 2)).join("");
            }
          }
          lst.lines.push({
            path,
            line: parseInt(m[4]),
            offset: ofs
          });
          lastofs = ofs;
        }
      }
      var symout = FS.readFile(sympath, { encoding: "utf8" });
      var re_symline = /^([0-9A-F]+)\s+(.+)/;
      for (var line of symout.split(re_crlf)) {
        var m;
        if (m = re_symline.exec(line)) {
          symbolmap[m[2]] = parseInt(m[1], 16);
        }
      }
      return {
        output: objout,
        listings,
        errors,
        symbolmap,
        segments
      };
    }
  }
  function assembleVASMARM(step) {
    loadNative("vasmarm_std");
    var re_err1 = /^(fatal error|error|warning)? (\d+) in line (\d+) of "(.+)": (.+)/;
    var re_err2 = /^(fatal error|error|warning)? (\d+): (.+)/;
    var re_undefsym = /symbol <(.+?)>/;
    var errors = [];
    var undefsyms = [];
    function findUndefinedSymbols(line2) {
      undefsyms.forEach((sym) => {
        if (line2.indexOf(sym) >= 0) {
          errors.push({
            path: curpath,
            line: curline,
            msg: "Undefined symbol: " + sym
          });
        }
      });
    }
    function match_fn(s) {
      let matches = re_err1.exec(s);
      if (matches) {
        errors.push({
          line: parseInt(matches[3]),
          path: matches[4],
          msg: matches[5]
        });
      } else {
        matches = re_err2.exec(s);
        if (matches) {
          let m2 = re_undefsym.exec(matches[3]);
          if (m2) {
            undefsyms.push(m2[1]);
          } else {
            errors.push({
              line: 0,
              msg: s
            });
          }
        } else {
          console.log(s);
        }
      }
    }
    gatherFiles(step, { mainFilePath: "main.asm" });
    var objpath = step.prefix + ".bin";
    var lstpath = step.prefix + ".lst";
    if (staleFiles(step, [objpath])) {
      var args = ["-Fbin", "-m7tdmi", "-x", "-wfail", step.path, "-o", objpath, "-L", lstpath];
      var vasm = emglobal.vasm({
        instantiateWasm: moduleInstFn("vasmarm_std"),
        noInitialRun: true,
        print: match_fn,
        printErr: match_fn
      });
      var FS = vasm.FS;
      populateFiles(step, FS);
      execMain(step, vasm, args);
      if (errors.length) {
        return { errors };
      }
      if (undefsyms.length == 0) {
        var objout = FS.readFile(objpath, { encoding: "binary" });
        putWorkFile(objpath, objout);
        if (!anyTargetChanged(step, [objpath]))
          return;
      }
      var lstout = FS.readFile(lstpath, { encoding: "utf8" });
      var symbolmap = {};
      var segments = [];
      var listings = {};
      var re_asmline = /^(\d+):([0-9A-F]+)\s+([0-9A-F ]+)\s+(\d+)([:M])/;
      var re_secline = /^(\d+):\s+"(.+)"/;
      var re_nameline = /^Source:\s+"(.+)"/;
      var re_symline = /^(\w+)\s+(\d+):([0-9A-F]+)/;
      var re_emptyline = /^\s+(\d+)([:M])/;
      var curpath = step.path;
      var curline = 0;
      var sections = {};
      var lines = lstout.split(re_crlf);
      var lstlines = [];
      for (var line of lines) {
        var m;
        if (m = re_secline.exec(line)) {
          sections[m[1]] = m[2];
        } else if (m = re_nameline.exec(line)) {
          curpath = m[1];
        } else if (m = re_symline.exec(line)) {
          symbolmap[m[1]] = parseInt(m[3], 16);
        } else if (m = re_asmline.exec(line)) {
          if (m[5] == ":") {
            curline = parseInt(m[4]);
          } else {
          }
          lstlines.push({
            path: curpath,
            line: curline,
            offset: parseInt(m[2], 16),
            insns: m[3].replaceAll(" ", "")
          });
          findUndefinedSymbols(line);
        } else if (m = re_emptyline.exec(line)) {
          curline = parseInt(m[1]);
          findUndefinedSymbols(line);
        } else {
        }
      }
      listings[lstpath] = { lines: lstlines, text: lstout };
      if (undefsyms.length && errors.length == 0) {
        errors.push({
          line: 0,
          msg: "Undefined symbols: " + undefsyms.join(", ")
        });
      }
      return {
        output: objout,
        listings,
        errors,
        symbolmap,
        segments
      };
    }
  }

  // src/common/tokenizer.ts
  var CompileError3 = class extends Error {
    constructor(msg, loc) {
      super(msg);
      Object.setPrototypeOf(this, CompileError3.prototype);
      this.$loc = loc;
    }
  };
  function mergeLocs2(a, b) {
    return {
      line: Math.min(a.line, b.line),
      start: Math.min(a.start, b.start),
      end: Math.max(a.end, b.end),
      label: a.label || b.label,
      path: a.path || b.path
    };
  }
  var TokenType2;
  (function(TokenType3) {
    TokenType3["EOF"] = "eof";
    TokenType3["EOL"] = "eol";
    TokenType3["Ident"] = "ident";
    TokenType3["Comment"] = "comment";
    TokenType3["Ignore"] = "ignore";
    TokenType3["CatchAll"] = "catch-all";
  })(TokenType2 || (TokenType2 = {}));
  var CATCH_ALL_RULES = [
    { type: TokenType2.CatchAll, regex: /.+?/ }
  ];
  function re_escape(rule) {
    return `(${rule.regex.source})`;
  }
  var TokenizerRuleSet = class {
    constructor(rules) {
      this.rules = rules.concat(CATCH_ALL_RULES);
      var pattern = this.rules.map(re_escape).join("|");
      this.regex = new RegExp(pattern, "gs");
    }
  };
  var Tokenizer = class {
    constructor() {
      this.errorOnCatchAll = false;
      this.deferred = [];
      this.errors = [];
      this.lineno = 0;
      this.lineindex = [];
      this.tokens = [];
    }
    setTokenRuleSet(ruleset) {
      this.ruleset = ruleset;
    }
    setTokenRules(rules) {
      this.setTokenRuleSet(new TokenizerRuleSet(rules));
    }
    tokenizeFile(contents, path) {
      this.path = path;
      let m;
      let re = /\n|\r\n?/g;
      this.lineindex.push(0);
      while (m = re.exec(contents)) {
        this.lineindex.push(m.index);
      }
      this._tokenize(contents);
      this.eof = { type: TokenType2.EOF, str: "", eol: true, $loc: { path: this.path, line: this.lineno } };
      this.pushToken(this.eof);
    }
    _tokenize(text) {
      let m;
      this.lineno = 0;
      while (m = this.ruleset.regex.exec(text)) {
        let found = false;
        while (m.index >= this.lineindex[this.lineno]) {
          this.lineno++;
        }
        let rules = this.ruleset.rules;
        for (let i = 0; i < rules.length; i++) {
          let s = m[i + 1];
          if (s != null) {
            found = true;
            let col = m.index - (this.lineindex[this.lineno - 1] || -1) - 1;
            let loc = { path: this.path, line: this.lineno, start: col, end: col + s.length };
            let rule = rules[i];
            switch (rule.type) {
              case TokenType2.CatchAll:
                if (this.errorOnCatchAll) {
                  this.compileError(`I didn't expect the character "${m[0]}" here.`, loc);
                }
              default:
                this.pushToken({ str: s, type: rule.type, $loc: loc, eol: false });
                break;
              case TokenType2.EOL:
                if (this.tokens.length)
                  this.tokens[this.tokens.length - 1].eol = true;
              case TokenType2.Comment:
              case TokenType2.Ignore:
                break;
            }
            break;
          }
        }
        if (!found) {
          this.compileError(`Could not parse token: <<${m[0]}>>`);
        }
      }
    }
    pushToken(token) {
      this.tokens.push(token);
    }
    addError(msg, loc) {
      let tok = this.lasttoken || this.peekToken();
      if (!loc)
        loc = tok.$loc;
      this.errors.push({ path: loc.path, line: loc.line, label: this.curlabel, start: loc.start, end: loc.end, msg });
    }
    internalError() {
      return this.compileError("Internal error.");
    }
    notImplementedError() {
      return this.compileError("Not yet implemented.");
    }
    compileError(msg, loc, loc2) {
      this.addError(msg, loc);
      let e = new CompileError3(msg, loc);
      throw e;
      return e;
    }
    peekToken(lookahead) {
      let tok = this.tokens[lookahead || 0];
      return tok ? tok : this.eof;
    }
    consumeToken() {
      let tok = this.lasttoken = this.tokens.shift() || this.eof;
      return tok;
    }
    ifToken(match) {
      if (this.peekToken().str == match)
        return this.consumeToken();
    }
    expectToken(str, msg) {
      let tok = this.consumeToken();
      let tokstr = tok.str;
      if (str != tokstr) {
        this.compileError(msg || `There should be a "${str}" here.`);
      }
      return tok;
    }
    expectTokens(strlist, msg) {
      let tok = this.consumeToken();
      let tokstr = tok.str;
      if (!strlist.includes(tokstr)) {
        this.compileError(msg || `These keywords are valid here: ${strlist.join(", ")}`);
      }
      return tok;
    }
    parseModifiers(modifiers) {
      let result = {};
      do {
        var tok = this.peekToken();
        if (modifiers.indexOf(tok.str) < 0)
          return result;
        this.consumeToken();
        result[tok.str] = true;
      } while (tok != null);
    }
    expectIdent(msg) {
      let tok = this.consumeToken();
      if (tok.type != TokenType2.Ident)
        this.compileError(msg || `There should be an identifier here.`);
      return tok;
    }
    pushbackToken(tok) {
      this.tokens.unshift(tok);
    }
    isEOF() {
      return this.tokens.length == 0 || this.peekToken().type == "eof";
    }
    expectEOL(msg) {
      let tok = this.consumeToken();
      if (tok.type != TokenType2.EOL)
        this.compileError(msg || `There's too much stuff on this line.`);
    }
    skipBlankLines() {
      this.skipTokenTypes(["eol"]);
    }
    skipTokenTypes(types) {
      while (types.includes(this.peekToken().type))
        this.consumeToken();
    }
    expectTokenTypes(types, msg) {
      let tok = this.consumeToken();
      if (!types.includes(tok.type))
        this.compileError(msg || `There should be a ${types.map((s) => `"${s}"`).join(" or ")} here. not a "${tok.type}".`);
      return tok;
    }
    parseList(parseFunc, delim) {
      var sep;
      var list = [];
      do {
        var el = parseFunc.bind(this)();
        if (el != null)
          list.push(el);
        sep = this.consumeToken();
      } while (sep.str == delim);
      this.pushbackToken(sep);
      return list;
    }
    runDeferred() {
      while (this.deferred.length) {
        this.deferred.shift()();
      }
    }
  };

  // src/common/ecs/binpack.ts
  var debug = false;
  var BoxPlacement;
  (function(BoxPlacement2) {
    BoxPlacement2[BoxPlacement2["TopLeft"] = 0] = "TopLeft";
    BoxPlacement2[BoxPlacement2["TopRight"] = 1] = "TopRight";
    BoxPlacement2[BoxPlacement2["BottomLeft"] = 2] = "BottomLeft";
    BoxPlacement2[BoxPlacement2["BottomRight"] = 3] = "BottomRight";
  })(BoxPlacement || (BoxPlacement = {}));
  function boxesIntersect(a, b) {
    return !(b.left >= a.right || b.right <= a.left || b.top >= a.bottom || b.bottom <= a.top);
  }
  function boxesContain(a, b) {
    return b.left >= a.left && b.top >= a.top && b.right <= a.right && b.bottom <= a.bottom;
  }
  var Bin = class {
    constructor(binbounds) {
      this.binbounds = binbounds;
      this.boxes = [];
      this.free = [];
      this.extents = { left: 0, top: 0, right: 0, bottom: 0 };
      this.free.push(binbounds);
    }
    getBoxes(bounds, limit, boxes) {
      let result = [];
      if (!boxes)
        boxes = this.boxes;
      for (let box of boxes) {
        if (boxesIntersect(bounds, box)) {
          result.push(box);
          if (result.length >= limit)
            break;
        }
      }
      return result;
    }
    fits(b) {
      if (!boxesContain(this.binbounds, b)) {
        if (debug)
          console.log("out of bounds!", b.left, b.top, b.right, b.bottom);
        return false;
      }
      if (this.getBoxes(b, 1).length > 0) {
        if (debug)
          console.log("intersect!", b.left, b.top, b.right, b.bottom);
        return false;
      }
      return true;
    }
    bestFit(b) {
      let bestscore = 0;
      let best = null;
      for (let f of this.free) {
        if (b.left != null && b.left < f.left)
          continue;
        if (b.left != null && b.left + b.width > f.right)
          continue;
        if (b.top != null && b.top < f.top)
          continue;
        if (b.top != null && b.top + b.height > f.bottom)
          continue;
        let dx = f.right - f.left - b.width;
        let dy = f.bottom - f.top - b.height;
        if (dx >= 0 && dy >= 0) {
          let score = 1 / (1 + dx + dy + f.left * 1e-3);
          if (score > bestscore) {
            best = f;
            bestscore = score;
            if (score == 1)
              break;
          }
        }
      }
      return best;
    }
    anyFit(b) {
      let bestscore = 0;
      let best = null;
      for (let f of this.free) {
        let box = {
          left: b.left != null ? b.left : f.left,
          right: f.left + b.width,
          top: b.top != null ? b.top : f.top,
          bottom: f.top + b.height
        };
        if (this.fits(box)) {
          let score = 1 / (1 + box.left + box.top);
          if (score > bestscore) {
            best = f;
            if (score == 1)
              break;
          }
        }
      }
      return best;
    }
    add(b) {
      if (debug)
        console.log("add", b.left, b.top, b.right, b.bottom);
      if (!this.fits(b)) {
        throw new Error(`bad fit ${b.left} ${b.top} ${b.right} ${b.bottom}`);
      }
      this.boxes.push(b);
      this.extents.right = Math.max(this.extents.right, b.right);
      this.extents.bottom = Math.max(this.extents.bottom, b.bottom);
      for (let p of b.parents) {
        let i = this.free.indexOf(p);
        if (i < 0)
          throw new Error("cannot find parent");
        if (debug)
          console.log("removed", p.left, p.top, p.right, p.bottom);
        this.free.splice(i, 1);
        this.addFree(p.left, p.top, b.left, p.bottom);
        this.addFree(b.right, p.top, p.right, p.bottom);
        this.addFree(b.left, p.top, b.right, b.top);
        this.addFree(b.left, b.bottom, b.right, p.bottom);
      }
    }
    addFree(left, top, right, bottom) {
      if (bottom > top && right > left) {
        let b = { left, top, right, bottom };
        if (debug)
          console.log("free", b.left, b.top, b.right, b.bottom);
        this.free.push(b);
      }
    }
  };
  var Packer = class {
    constructor() {
      this.bins = [];
      this.boxes = [];
      this.defaultPlacement = 0;
    }
    pack() {
      for (let bc of this.boxes) {
        let box = this.bestPlacement(bc);
        if (!box)
          return false;
        box.bin.add(box);
        bc.box = box;
      }
      return true;
    }
    bestPlacement(b) {
      for (let bin of this.bins) {
        let parent = bin.bestFit(b);
        let approx = false;
        if (!parent) {
          parent = bin.anyFit(b);
          approx = true;
          if (debug)
            console.log("anyfit", parent == null ? void 0 : parent.left, parent == null ? void 0 : parent.top);
        }
        if (parent) {
          let place = this.defaultPlacement;
          let box = {
            left: parent.left,
            top: parent.top,
            right: parent.left + b.width,
            bottom: parent.top + b.height
          };
          if (b.left != null) {
            box.left = b.left;
            box.right = b.left + b.width;
          }
          if (b.top != null) {
            box.top = b.top;
            box.bottom = b.top + b.height;
          }
          if (place == 2 || place == 3) {
            let h = box.bottom - box.top;
            box.top = parent.bottom - h;
            box.bottom = parent.bottom;
          }
          if (place == 1 || place == 3) {
            let w = box.right - box.left;
            box.left = parent.right - w;
            box.right = parent.right;
          }
          if (debug)
            console.log("place", b.label, box.left, box.top, box.right, box.bottom, parent == null ? void 0 : parent.left, parent == null ? void 0 : parent.top);
          let parents = [parent];
          if (approx)
            parents = bin.getBoxes(box, 100, bin.free);
          return __spreadValues({ parents, place, bin }, box);
        }
      }
      if (debug)
        console.log("cannot place!", b.left, b.top, b.width, b.height);
      return null;
    }
    toSVG() {
      let s = "";
      let r = { width: 100, height: 70 };
      for (let bin of this.bins) {
        r.width = Math.max(r.width, bin.binbounds.right);
        r.height = Math.max(r.height, bin.binbounds.bottom);
      }
      s += `<svg viewBox="0 0 ${r.width} ${r.height}" xmlns="http://www.w3.org/2000/svg"><style><![CDATA[text {font: 1px sans-serif;}]]></style>`;
      for (let bin of this.bins) {
        let be = bin.extents;
        s += "<g>";
        s += `<rect width="${be.right - be.left}" height="${be.bottom - be.top}" stroke="black" stroke-width="0.5" fill="none"/>`;
        let textx = be.right + 1;
        let texty = 0;
        for (let box of this.boxes) {
          let b = box.box;
          if (b) {
            if (b.bin == bin)
              s += `<rect width="${b.right - b.left}" height="${b.bottom - b.top}" x="${b.left}" y="${b.top}" stroke="black" stroke-width="0.25" fill="#ccc"/>`;
            if (b.top == texty)
              textx += 10;
            else
              textx = be.right + 1;
            texty = b.top;
            if (box.label)
              s += `<text x="${textx}" y="${texty}" height="1">${box.label}</text>`;
          }
        }
        s += "</g>";
      }
      s += `</svg>`;
      return s;
    }
    toSVGUrl() {
      return `data:image/svg+xml;base64,${btoa(this.toSVG())}`;
    }
  };

  // src/common/ecs/ecs.ts
  var ECSError = class extends Error {
    constructor(msg, obj) {
      super(msg);
      this.$sources = [];
      Object.setPrototypeOf(this, ECSError.prototype);
      if (obj)
        this.$loc = obj.$loc || obj;
    }
  };
  function mksymbol(c, fieldName) {
    return c.name + "_" + fieldName;
  }
  function mkscopesymbol(s, c, fieldName) {
    return s.name + "_" + c.name + "_" + fieldName;
  }
  var SystemStats = class {
  };
  var SELECT_TYPE = ["once", "foreach", "join", "with", "if", "select", "unroll"];
  function isLiteral2(arg) {
    return arg.value != null;
  }
  function isLiteralInt(arg) {
    return isLiteral2(arg) && arg.valtype.dtype == "int";
  }
  function isBinOp2(arg) {
    return arg.op != null && arg.left != null && arg.right != null;
  }
  function isUnOp2(arg) {
    return arg.op != null && arg.expr != null;
  }
  function isBlockStmt(arg) {
    return arg.stmts != null;
  }
  function isInlineCode(arg) {
    return arg.code != null;
  }
  function isQueryExpr(arg) {
    return arg.query != null;
  }
  var Dialect_CA65 = class {
    constructor() {
      this.ASM_ITERATE_EACH_ASC = `
    ldx #0
@__each:
    {{%code}}
    inx
    cpx #{{%ecount}}
    jne @__each
@__exit:
`;
      this.ASM_ITERATE_EACH_DESC = `
    ldx #{{%ecount}}-1
@__each:
    {{%code}}
    dex
    jpl @__each
@__exit:
`;
      this.ASM_ITERATE_JOIN_ASC = `
    ldy #0
@__each:
    ldx {{%joinfield}},y
    {{%code}}
    iny
    cpy #{{%ecount}}
    jne @__each
@__exit:
`;
      this.ASM_ITERATE_JOIN_DESC = `
    ldy #{{%ecount}}-1
@__each:
    ldx {{%joinfield}},y
    {{%code}}
    dey
    jpl @__each
@__exit:
`;
      this.ASM_FILTER_RANGE_LO_X = `
    cpx #{{%xofs}}
    jcc @__skipxlo
    {{%code}}
@__skipxlo:
`;
      this.ASM_FILTER_RANGE_HI_X = `
    cpx #{{%xofs}}+{{%ecount}}
    jcs @__skipxhi
    {{%code}}
@__skipxhi:
`;
      this.ASM_LOOKUP_REF_X = `
    ldx {{%reffield}}
    {{%code}}
`;
      this.INIT_FROM_ARRAY = `
    ldy #{{%nbytes}}
:   lda {{%src}}-1,y
    sta {{%dest}}-1,y
    dey
    bne :-
`;
    }
    comment(s) {
      return `
;;; ${s}
`;
    }
    absolute(ident, offset) {
      return this.addOffset(ident, offset || 0);
    }
    addOffset(ident, offset) {
      if (offset > 0)
        return `${ident}+${offset}`;
      if (offset < 0)
        return `${ident}-${-offset}`;
      return ident;
    }
    indexed_x(ident, offset) {
      return this.addOffset(ident, offset) + ",x";
    }
    indexed_y(ident, offset) {
      return this.addOffset(ident, offset) + ",y";
    }
    fieldsymbol(component, field, bitofs) {
      return `${component.name}_${field.name}_b${bitofs}`;
    }
    datasymbol(component, field, eid, bitofs) {
      return `${component.name}_${field.name}_e${eid}_b${bitofs}`;
    }
    debug_file(path) {
      return `.dbg file, "${path}", 0, 0`;
    }
    debug_line(path, line) {
      return `.dbg line, "${path}", ${line}`;
    }
    startScope(name) {
      return `.scope ${name}`;
    }
    endScope(name) {
      return `.endscope
${this.scopeSymbol(name)} = ${name}::__Start`;
    }
    scopeSymbol(name) {
      return `${name}__Start`;
    }
    align(value) {
      return `.align ${value}`;
    }
    alignSegmentStart() {
      return this.label("__ALIGNORIGIN");
    }
    warningIfPageCrossed(startlabel) {
      return `
.assert >(${startlabel}) = >(*), error, "${startlabel} crosses a page boundary!"`;
    }
    warningIfMoreThan(bytes, startlabel) {
      return `
.assert (* - ${startlabel}) <= ${bytes}, error, .sprintf("${startlabel} does not fit in ${bytes} bytes, it took %d!", (* - ${startlabel}))`;
    }
    alignIfLessThan(bytes) {
      return `
.if <(* - __ALIGNORIGIN) > 256-${bytes}
.align $100
.endif`;
    }
    segment(segtype) {
      if (segtype == "bss") {
        return `.zeropage`;
      } else if (segtype == "rodata") {
        return ".rodata";
      } else {
        return `.code`;
      }
    }
    label(sym) {
      return `${sym}:`;
    }
    byte(b) {
      if (b === void 0) {
        return `.res 1`;
      } else if (typeof b === "number") {
        if (b < 0 || b > 255)
          throw new ECSError(`out of range byte ${b}`);
        return `.byte ${b}`;
      } else {
        if (b.bitofs == 0)
          return `.byte <${b.symbol}`;
        else if (b.bitofs == 8)
          return `.byte >${b.symbol}`;
        else
          return `.byte ((${b.symbol} >> ${b.bitofs})&255)`;
      }
    }
    tempLabel(inst) {
      return `${inst.system.name}__${inst.id}__tmp`;
    }
    equate(symbol, value) {
      return `${symbol} = ${value}`;
    }
    define(symbol, value) {
      if (value)
        return `.define ${symbol} ${value}`;
      else
        return `.define ${symbol}`;
    }
    call(symbol) {
      return ` jsr ${symbol}`;
    }
    jump(symbol) {
      return ` jmp ${symbol}`;
    }
    return() {
      return " rts";
    }
  };
  var SourceFileExport = class {
    constructor() {
      this.lines = [];
    }
    line(s) {
      this.text(s);
    }
    text(s) {
      for (let l of s.split("\n"))
        this.lines.push(l);
    }
    toString() {
      return this.lines.join("\n");
    }
  };
  var CodeSegment = class {
    constructor() {
      this.codefrags = [];
    }
    addCodeFragment(code) {
      this.codefrags.push(code);
    }
    dump(file) {
      for (let code of this.codefrags) {
        file.text(code);
      }
    }
  };
  var DataSegment = class {
    constructor() {
      this.symbols = {};
      this.equates = {};
      this.ofs2sym = new Map();
      this.fieldranges = {};
      this.size = 0;
      this.initdata = [];
    }
    allocateBytes(name, bytes) {
      let ofs = this.symbols[name];
      if (ofs == null) {
        ofs = this.size;
        this.declareSymbol(name, ofs);
        this.size += bytes;
      }
      return ofs;
    }
    declareSymbol(name, ofs) {
      var _a;
      this.symbols[name] = ofs;
      if (!this.ofs2sym.has(ofs))
        this.ofs2sym.set(ofs, []);
      (_a = this.ofs2sym.get(ofs)) == null ? void 0 : _a.push(name);
    }
    findExistingInitData(bytes) {
      for (let i = 0; i < this.size - bytes.length; i++) {
        for (var j = 0; j < bytes.length; j++) {
          if (this.initdata[i + j] !== bytes[j])
            break;
        }
        if (j == bytes.length)
          return i;
      }
      return -1;
    }
    allocateInitData(name, bytes) {
      let ofs = this.findExistingInitData(bytes);
      if (ofs >= 0) {
        this.declareSymbol(name, ofs);
      } else {
        ofs = this.allocateBytes(name, bytes.length);
        for (let i = 0; i < bytes.length; i++) {
          this.initdata[ofs + i] = bytes[i];
        }
      }
    }
    dump(file, dialect) {
      for (let i = 0; i < this.size; i++) {
        let syms = this.ofs2sym.get(i);
        if (syms) {
          for (let sym of syms)
            file.line(dialect.label(sym));
        }
        file.line(dialect.byte(this.initdata[i]));
      }
      for (let [symbol, value] of Object.entries(this.equates)) {
        file.line(dialect.equate(symbol, value));
      }
    }
    getFieldRange(component, fieldName) {
      return this.fieldranges[mksymbol(component, fieldName)];
    }
    getByteOffset(range, access, entityID) {
      if (entityID < range.elo)
        throw new ECSError(`entity ID ${entityID} too low for ${access.symbol}`);
      if (entityID > range.ehi)
        throw new ECSError(`entity ID ${entityID} too high for ${access.symbol}`);
      let ofs = this.symbols[access.symbol];
      if (ofs !== void 0) {
        return ofs + entityID - range.elo;
      }
      throw new ECSError(`cannot find field access for ${access.symbol}`);
    }
    getOriginSymbol() {
      let a = this.ofs2sym.get(0);
      if (!a)
        throw new ECSError("getOriginSymbol(): no symbol at offset 0");
      return a[0];
    }
  };
  var UninitDataSegment = class extends DataSegment {
  };
  var ConstDataSegment = class extends DataSegment {
  };
  function getFieldBits(f) {
    let n = f.hi - f.lo + 1;
    return Math.ceil(Math.log2(n));
  }
  function getFieldLength(f) {
    if (f.dtype == "int") {
      return f.hi - f.lo + 1;
    } else {
      return 1;
    }
  }
  function getPackedFieldSize(f, constValue) {
    if (f.dtype == "int") {
      return getFieldBits(f);
    }
    if (f.dtype == "array" && f.index) {
      return 0;
    }
    if (f.dtype == "array" && constValue != null && Array.isArray(constValue)) {
      return constValue.length * getPackedFieldSize(f.elem);
    }
    if (f.dtype == "ref") {
      return 8;
    }
    return 0;
  }
  var EntitySet = class {
    constructor(scope, query, e) {
      this.scope = scope;
      if (query) {
        if (query.entities) {
          this.entities = query.entities.slice(0);
        } else {
          this.atypes = scope.em.archetypesMatching(query);
          this.entities = scope.entitiesMatching(this.atypes);
        }
        if (query.limit) {
          this.entities = this.entities.slice(0, query.limit);
        }
      } else if (e) {
        this.entities = e;
      } else {
        throw new ECSError("invalid EntitySet constructor");
      }
      if (!this.atypes) {
        let at = new Set();
        for (let e2 of this.entities)
          at.add(e2.etype);
        this.atypes = Array.from(at.values());
      }
    }
    contains(c, f, where) {
      return this.scope.em.singleComponentWithFieldName(this.atypes, f.name, where);
    }
    intersection(qr) {
      let ents = this.entities.filter((e) => qr.entities.includes(e));
      return new EntitySet(this.scope, void 0, ents);
    }
    union(qr) {
      let ents = this.entities.concat(qr.entities);
      let atypes = this.atypes.concat(qr.atypes);
      return new EntitySet(this.scope, void 0, ents);
    }
    isContiguous() {
      if (this.entities.length == 0)
        return true;
      let id = this.entities[0].id;
      for (let i = 1; i < this.entities.length; i++) {
        if (this.entities[i].id != ++id)
          return false;
      }
      return true;
    }
  };
  var IndexRegister = class {
    constructor(scope, eset) {
      this.scope = scope;
      this.elo = 0;
      this.ehi = scope.entities.length - 1;
      this.lo = null;
      this.hi = null;
      if (eset) {
        this.narrowInPlace(eset);
      }
    }
    entityCount() {
      return this.ehi - this.elo + 1;
    }
    clone() {
      return Object.assign(new IndexRegister(this.scope), this);
    }
    narrow(eset, action) {
      let i = this.clone();
      return i.narrowInPlace(eset, action) ? i : null;
    }
    narrowInPlace(eset, action) {
      if (this.scope != eset.scope)
        throw new ECSError(`scope mismatch`, action);
      if (!eset.isContiguous())
        throw new ECSError(`entities are not contiguous`, action);
      if (this.eset) {
        this.eset = this.eset.intersection(eset);
      } else {
        this.eset = eset;
      }
      if (this.eset.entities.length == 0) {
        return false;
      }
      let newelo = this.eset.entities[0].id;
      let newehi = this.eset.entities[this.eset.entities.length - 1].id;
      if (this.lo === null || this.hi === null) {
        this.lo = 0;
        this.hi = newehi - newelo;
        this.elo = newelo;
        this.ehi = newehi;
      } else {
        this.lo += newelo - this.elo;
        this.hi += newehi - this.ehi;
      }
      return true;
    }
    offset() {
      return this.lo || 0;
    }
  };
  var ActionCPUState = class {
    constructor() {
      this.xreg = null;
      this.yreg = null;
    }
  };
  var ActionEval = class {
    constructor(scope, instance, action, eventargs) {
      this.scope = scope;
      this.instance = instance;
      this.action = action;
      this.eventargs = eventargs;
      this.tmplabel = "";
      this.em = scope.em;
      this.dialect = scope.em.dialect;
      this.tmplabel = this.dialect.tempLabel(this.instance);
      this.seq = this.em.seq++;
      this.label = `${this.instance.system.name}__${action.event}__${this.seq}`;
    }
    begin() {
    }
    end() {
    }
    codeToString() {
      let code = this.exprToCode(this.action.expr);
      return code;
    }
    replaceTags(code, action, props) {
      const tag_re = /\{\{(.+?)\}\}/g;
      code = code.replace(tag_re, (entire, group) => {
        let toks = group.split(/\s+/);
        if (toks.length == 0)
          throw new ECSError(`empty command`, action);
        let cmd = group.charAt(0);
        let arg0 = toks[0].substring(1).trim();
        let args = [arg0].concat(toks.slice(1));
        switch (cmd) {
          case "!":
            return this.__emit(args);
          case "$":
            return this.__local(args);
          case "^":
            return this.__use(args);
          case "#":
            return this.__arg(args);
          case "&":
            return this.__eid(args);
          case "<":
            return this.__get([arg0, "0"]);
          case ">":
            return this.__get([arg0, "8"]);
          default:
            let value = props[toks[0]];
            if (value)
              return value;
            let fn = this["__" + toks[0]];
            if (fn)
              return fn.bind(this)(toks.slice(1));
            throw new ECSError(`unrecognized command {{${toks[0]}}}`, action);
        }
      });
      return code;
    }
    replaceLabels(code) {
      const label_re = /@(\w+)\b/g;
      let seq = this.em.seq++;
      let label = `${this.instance.system.name}__${this.action.event}__${seq}`;
      code = code.replace(label_re, (s, a) => `${label}__${a}`);
      return code;
    }
    __get(args) {
      return this.getset(args, false);
    }
    __set(args) {
      return this.getset(args, true);
    }
    getset(args, canwrite) {
      let fieldName = args[0];
      let bitofs = parseInt(args[1] || "0");
      return this.generateCodeForField(fieldName, bitofs, canwrite);
    }
    parseFieldArgs(args) {
      let fieldName = args[0];
      let bitofs = parseInt(args[1] || "0");
      let component = this.em.singleComponentWithFieldName(this.scope.state.working.atypes, fieldName, this.action);
      let field = component.fields.find((f) => f.name == fieldName);
      if (field == null)
        throw new ECSError(`no field named "${fieldName}" in component`, this.action);
      return { component, field, bitofs };
    }
    __base(args) {
      let { component, field, bitofs } = this.parseFieldArgs(args);
      return this.dialect.fieldsymbol(component, field, bitofs);
    }
    __data(args) {
      let { component, field, bitofs } = this.parseFieldArgs(args);
      let entities = this.scope.state.working.entities;
      if (entities.length != 1)
        throw new ECSError(`data operates on exactly one entity`, this.action);
      let eid = entities[0].id;
      return this.dialect.datasymbol(component, field, eid, bitofs);
    }
    __const(args) {
      let { component, field, bitofs } = this.parseFieldArgs(args);
      let entities = this.scope.state.working.entities;
      if (entities.length != 1)
        throw new ECSError(`const operates on exactly one entity`, this.action);
      let constVal = entities[0].consts[mksymbol(component, field.name)];
      if (constVal === void 0)
        throw new ECSError(`field is not constant`, this.action);
      if (typeof constVal !== "number")
        throw new ECSError(`field is not numeric`, this.action);
      return constVal << bitofs;
    }
    __index(args) {
      let ident = args[0];
      let index = parseInt(args[1] || "0");
      let entities = this.scope.state.working.entities;
      if (entities.length == 1) {
        return this.dialect.absolute(ident);
      } else {
        return this.dialect.indexed_x(ident, index);
      }
    }
    __eid(args) {
      let e = this.scope.getEntityByName(args[0] || "?");
      if (!e)
        throw new ECSError(`can't find entity named "${args[0]}"`, this.action);
      return e.id.toString();
    }
    __use(args) {
      return this.scope.includeResource(args[0]);
    }
    __emit(args) {
      let event = args[0];
      let eventargs = args.slice(1);
      try {
        return this.scope.generateCodeForEvent(event, eventargs);
      } catch (e) {
        if (e.$sources)
          e.$sources.push(this.action);
        throw e;
      }
    }
    __local(args) {
      let tempinc = parseInt(args[0]);
      let tempbytes = this.instance.system.tempbytes;
      if (isNaN(tempinc))
        throw new ECSError(`bad temporary offset`, this.action);
      if (!tempbytes)
        throw new ECSError(`this system has no locals`, this.action);
      if (tempinc < 0 || tempinc >= tempbytes)
        throw new ECSError(`this system only has ${tempbytes} locals`, this.action);
      this.scope.updateTempLiveness(this.instance);
      return `${this.tmplabel}+${tempinc}`;
    }
    __arg(args) {
      let argindex = parseInt(args[0] || "0");
      let argvalue = this.eventargs[argindex] || "";
      return argvalue;
    }
    __start(args) {
      let startSymbol = this.dialect.scopeSymbol(args[0]);
      return this.dialect.jump(startSymbol);
    }
    generateCodeForField(fieldName, bitofs, canWrite) {
      var _a, _b, _c, _d;
      const action = this.action;
      const qr = this.scope.state.working;
      var component;
      var baseLookup = false;
      var entityLookup = false;
      let entities;
      if (fieldName.indexOf(".") > 0) {
        let [entname, fname] = fieldName.split(".");
        let ent = this.scope.getEntityByName(entname);
        if (ent == null)
          throw new ECSError(`no entity named "${entname}" in this scope`, action);
        component = this.em.singleComponentWithFieldName([ent.etype], fname, action);
        fieldName = fname;
        entities = [ent];
        entityLookup = true;
      } else if (fieldName.indexOf(":") > 0) {
        let [cname, fname] = fieldName.split(":");
        component = this.em.getComponentByName(cname);
        if (component == null)
          throw new ECSError(`no component named "${cname}"`, action);
        entities = this.scope.state.working.entities;
        fieldName = fname;
        baseLookup = true;
      } else {
        component = this.em.singleComponentWithFieldName(qr.atypes, fieldName, action);
        entities = this.scope.state.working.entities;
      }
      let field = component.fields.find((f) => f.name == fieldName);
      if (field == null)
        throw new ECSError(`no field named "${fieldName}" in component`, action);
      let ident = this.dialect.fieldsymbol(component, field, bitofs);
      let constValues = new Set();
      let isConst = false;
      for (let e of entities) {
        let constVal = e.consts[mksymbol(component, fieldName)];
        if (constVal !== void 0)
          isConst = true;
        constValues.add(constVal);
      }
      if (isConst && canWrite)
        throw new ECSError(`can't write to constant field ${fieldName}`, action);
      if (constValues.size == 1) {
        let value = constValues.values().next().value;
        if (typeof value === "number") {
          return `#${value >> bitofs & 255}`;
        }
      }
      let range = this.scope.getFieldRange(component, field.name);
      if (!range)
        throw new ECSError(`couldn't find field for ${component.name}:${fieldName}, maybe no entities?`);
      if (baseLookup) {
        return this.dialect.absolute(ident);
      } else if (entities.length == 1) {
        let eidofs = entities[0].id - range.elo;
        return this.dialect.absolute(ident, eidofs);
      } else {
        let ir;
        let int;
        let eidofs;
        let xreg = this.scope.state.xreg;
        let yreg = this.scope.state.yreg;
        if (xreg && (int = (_a = xreg.eset) == null ? void 0 : _a.intersection(qr))) {
          ir = xreg.eset;
          eidofs = xreg.elo - range.elo;
        } else if (yreg && (int = (_b = yreg.eset) == null ? void 0 : _b.intersection(qr))) {
          ir = yreg.eset;
          eidofs = yreg.elo - range.elo;
        } else {
          ir = null;
          eidofs = 0;
        }
        if (!ir) {
          throw new ECSError(`no intersection for index register`, action);
        }
        if (ir.entities.length == 0)
          throw new ECSError(`no common entities for index register`, action);
        if (!ir.isContiguous())
          throw new ECSError(`entities in query are not contiguous`, action);
        if (ir == ((_c = this.scope.state.xreg) == null ? void 0 : _c.eset))
          return this.dialect.indexed_x(ident, eidofs);
        if (ir == ((_d = this.scope.state.yreg) == null ? void 0 : _d.eset))
          return this.dialect.indexed_y(ident, eidofs);
        throw new ECSError(`cannot find "${component.name}:${field.name}" in state`, action);
      }
    }
    getJoinField(action, atypes, jtypes) {
      let refs = Array.from(this.scope.iterateArchetypeFields(atypes, (c, f) => f.dtype == "ref"));
      if (refs.length == 0)
        throw new ECSError(`cannot find join fields`, action);
      if (refs.length > 1)
        throw new ECSError(`cannot join multiple fields (${refs.map((r) => r.f.name).join(" ")})`, action);
      return refs[0];
    }
    isSubroutineSized(code) {
      if (code.length > 2e4)
        return false;
      if (code.split("\n ").length >= 4)
        return true;
      return false;
    }
    exprToCode(expr) {
      if (isQueryExpr(expr)) {
        return this.queryExprToCode(expr);
      }
      if (isBlockStmt(expr)) {
        return this.blockStmtToCode(expr);
      }
      if (isInlineCode(expr)) {
        return this.evalInlineCode(expr.code);
      }
      throw new ECSError(`cannot convert expression to code`, expr);
    }
    evalInlineCode(code) {
      let props = this.scope.state.props || {};
      code = this.replaceLabels(code);
      code = this.replaceTags(code, this.action, props);
      return code;
    }
    blockStmtToCode(expr) {
      return expr.stmts.map((node) => this.exprToCode(node)).join("\n");
    }
    queryExprToCode(qexpr) {
      let q = this.startQuery(qexpr);
      const allowEmpty = ["if", "foreach", "join"];
      if (q.working.entities.length == 0 && allowEmpty.includes(qexpr.select)) {
        this.endQuery(q);
        return "";
      } else {
        this.scope.state.working = q.working;
        this.scope.state.props = q.props;
        q.code = this.evalInlineCode(q.code);
        let body = this.blockStmtToCode(qexpr);
        this.endQuery(q);
        body = q.code.replace("%%CODE%%", body);
        return body;
      }
    }
    queryWorkingSet(qexpr) {
      const scope = this.scope;
      const instance = this.instance;
      let select = qexpr.select;
      let q = qexpr.query;
      let qr = new EntitySet(scope, q);
      if (!(qexpr.all || q.entities)) {
        let ir = qr.intersection(scope.state.working);
        if (ir.entities.length || select == "if") {
          qr = ir;
        }
      }
      if (instance.params.refEntity && instance.params.refField) {
        let rf = instance.params.refField;
        if (rf.f.dtype == "ref") {
          let rq = rf.f.query;
          qr = qr.intersection(new EntitySet(scope, rq));
        }
      } else if (instance.params.query) {
        qr = qr.intersection(new EntitySet(scope, instance.params.query));
      }
      return qr;
    }
    updateIndexRegisters(qr, jr, select) {
      const action = this.action;
      const scope = this.scope;
      const instance = this.instance;
      const state = this.scope.state;
      if (qr.entities.length > 1) {
        switch (select) {
          case "once":
            break;
          case "foreach":
          case "unroll":
            if (state.xreg && state.yreg)
              throw new ECSError("no more index registers", action);
            if (state.xreg)
              state.yreg = new IndexRegister(scope, qr);
            else
              state.xreg = new IndexRegister(scope, qr);
            break;
          case "join":
            if (state.xreg || state.yreg)
              throw new ECSError("no free index registers for join", action);
            if (jr)
              state.xreg = new IndexRegister(scope, jr);
            state.yreg = new IndexRegister(scope, qr);
            break;
          case "if":
          case "with":
            if (state.xreg && state.xreg.eset) {
              state.xreg = state.xreg.narrow(qr, action);
            } else if (select == "with") {
              if (instance.params.refEntity && instance.params.refField) {
                if (state.xreg)
                  state.xreg.eset = qr;
                else
                  state.xreg = new IndexRegister(scope, qr);
              }
            }
            break;
        }
      }
    }
    getCodeAndProps(qexpr, qr, jr, oldState) {
      const entities = qr.entities;
      const select = qexpr.select;
      let code = "%%CODE%%";
      let props = {};
      if (select == "join" && jr) {
        if (qr.entities.length) {
          let joinfield = this.getJoinField(this.action, qr.atypes, jr.atypes);
          code = this.wrapCodeInLoop(code, qexpr, qr.entities, joinfield);
          props["%joinfield"] = this.dialect.fieldsymbol(joinfield.c, joinfield.f, 0);
        }
      }
      let fullEntityCount = qr.entities.length;
      if (select == "with") {
        if (this.instance.params.refEntity && this.instance.params.refField) {
          let re = this.instance.params.refEntity;
          let rf = this.instance.params.refField;
          code = this.wrapCodeInRefLookup(code);
          let range = this.scope.getFieldRange(rf.c, rf.f.name);
          let eidofs = re.id - range.elo;
          props["%reffield"] = `${this.dialect.fieldsymbol(rf.c, rf.f, 0)}+${eidofs}`;
        } else {
          code = this.wrapCodeInFilter(code, qr, oldState, props);
        }
      }
      if (select == "if") {
        code = this.wrapCodeInFilter(code, qr, oldState, props);
      }
      if (select == "foreach" && entities.length > 1) {
        code = this.wrapCodeInLoop(code, qexpr, qr.entities);
      }
      if (select == "unroll" && entities.length > 1) {
        throw new ECSError("unroll is not yet implemented");
      }
      if (entities.length) {
        props["%elo"] = entities[0].id.toString();
        props["%ehi"] = entities[entities.length - 1].id.toString();
      }
      props["%ecount"] = entities.length.toString();
      props["%efullcount"] = fullEntityCount.toString();
      return { code, props };
    }
    startQuery(qexpr) {
      const scope = this.scope;
      const action = this.action;
      const select = qexpr.select;
      const oldState = this.scope.state;
      this.scope.state = Object.assign(new ActionCPUState(), oldState);
      const qr = this.queryWorkingSet(qexpr);
      const jr = qexpr.join && qr.entities.length ? new EntitySet(scope, qexpr.join) : null;
      this.updateIndexRegisters(qr, jr, select);
      const { code, props } = this.getCodeAndProps(qexpr, qr, jr, oldState);
      let working = jr ? qr.union(jr) : qr;
      return { working, oldState, props, code };
    }
    endQuery(q) {
      this.scope.state = q.oldState;
    }
    wrapCodeInLoop(code, qexpr, ents, joinfield) {
      let dir = qexpr.direction;
      let s = dir == "desc" ? this.dialect.ASM_ITERATE_EACH_DESC : this.dialect.ASM_ITERATE_EACH_ASC;
      if (joinfield)
        s = dir == "desc" ? this.dialect.ASM_ITERATE_JOIN_DESC : this.dialect.ASM_ITERATE_JOIN_ASC;
      s = s.replace("{{%code}}", code);
      return s;
    }
    wrapCodeInFilter(code, qr, oldState, props) {
      var _a, _b;
      const ents = qr.entities;
      const ents2 = (_b = (_a = oldState.xreg) == null ? void 0 : _a.eset) == null ? void 0 : _b.entities;
      if (ents && ents.length && ents2) {
        let lo = ents[0].id;
        let hi = ents[ents.length - 1].id;
        let lo2 = ents2[0].id;
        let hi2 = ents2[ents2.length - 1].id;
        if (lo != lo2) {
          code = this.dialect.ASM_FILTER_RANGE_LO_X.replace("{{%code}}", code);
          props["%xofs"] = lo - lo2;
        }
        if (hi != hi2) {
          code = this.dialect.ASM_FILTER_RANGE_HI_X.replace("{{%code}}", code);
        }
      }
      return code;
    }
    wrapCodeInRefLookup(code) {
      code = this.dialect.ASM_LOOKUP_REF_X.replace("{{%code}}", code);
      return code;
    }
  };
  var EventCodeStats = class {
    constructor(inst, action, eventcode) {
      this.inst = inst;
      this.action = action;
      this.eventcode = eventcode;
      this.labels = [];
      this.count = 0;
    }
  };
  var EntityScope = class {
    constructor(em, dialect, name, parent) {
      this.em = em;
      this.dialect = dialect;
      this.name = name;
      this.parent = parent;
      this.childScopes = [];
      this.instances = [];
      this.entities = [];
      this.fieldtypes = {};
      this.sysstats = new Map();
      this.bss = new UninitDataSegment();
      this.rodata = new ConstDataSegment();
      this.code = new CodeSegment();
      this.componentsInScope = new Set();
      this.resources = new Set();
      this.isDemo = false;
      this.filePath = "";
      this.inCritical = 0;
      parent == null ? void 0 : parent.childScopes.push(this);
      this.state = new ActionCPUState();
      this.state.working = new EntitySet(this, void 0, this.entities);
    }
    newEntity(etype, name) {
      if (name && this.getEntityByName(name))
        throw new ECSError(`already an entity named "${name}"`);
      let id = this.entities.length;
      etype = this.em.addArchetype(etype);
      let entity = { id, etype, consts: {}, inits: {} };
      for (let c of etype.components) {
        this.componentsInScope.add(c.name);
      }
      entity.name = name;
      this.entities.push(entity);
      return entity;
    }
    newSystemInstance(inst) {
      if (!inst)
        throw new Error();
      inst.id = this.instances.length + 1;
      this.instances.push(inst);
      this.em.registerSystemEvents(inst.system);
      return inst;
    }
    newSystemInstanceWithDefaults(system) {
      return this.newSystemInstance({ system, params: {}, id: 0 });
    }
    getSystemInstanceNamed(name) {
      return this.instances.find((sys) => sys.system.name == name);
    }
    getEntityByName(name) {
      return this.entities.find((e) => e.name == name);
    }
    *iterateEntityFields(entities) {
      for (let i = 0; i < entities.length; i++) {
        let e = entities[i];
        for (let c of e.etype.components) {
          for (let f of c.fields) {
            yield { i, e, c, f, v: e.consts[mksymbol(c, f.name)] };
          }
        }
      }
    }
    *iterateArchetypeFields(arch, filter) {
      for (let i = 0; i < arch.length; i++) {
        let a = arch[i];
        for (let c of a.components) {
          for (let f of c.fields) {
            if (!filter || filter(c, f))
              yield { i, c, f };
          }
        }
      }
    }
    *iterateChildScopes() {
      for (let scope of this.childScopes) {
        yield scope;
      }
    }
    entitiesMatching(atypes) {
      let result = [];
      for (let e of this.entities) {
        for (let a of atypes) {
          if (e.etype === a) {
            result.push(e);
            break;
          }
        }
      }
      return result;
    }
    hasComponent(ctype) {
      return this.componentsInScope.has(ctype.name);
    }
    buildSegments() {
      let iter = this.iterateEntityFields(this.entities);
      for (var o = iter.next(); o.value; o = iter.next()) {
        let { i, e, c, f, v } = o.value;
        let cfname = mksymbol(c, f.name);
        let ftype = this.fieldtypes[cfname];
        let isConst = ftype == "const";
        let segment = isConst ? this.rodata : this.bss;
        if (v === void 0 && isConst)
          throw new ECSError(`no value for const field ${cfname}`, e);
        let array = segment.fieldranges[cfname];
        if (!array) {
          array = segment.fieldranges[cfname] = { component: c, field: f, elo: i, ehi: i };
        } else {
          array.ehi = i;
          if (array.ehi - array.elo + 1 >= 256)
            throw new ECSError(`too many entities have field ${cfname}, limit is 256`);
        }
        if (!isConst) {
          if (f.dtype == "int" && f.defvalue !== void 0) {
            let ecfname = mkscopesymbol(this, c, f.name);
            if (e.inits[ecfname] == null) {
              this.setInitValue(e, c, f, f.defvalue);
            }
          }
        }
      }
    }
    allocateSegment(segment, alloc, type) {
      let fields = Object.values(segment.fieldranges);
      for (let f of fields) {
        if (this.fieldtypes[mksymbol(f.component, f.field.name)] == type) {
          let rangelen = f.ehi - f.elo + 1;
          let bits = getPackedFieldSize(f.field);
          if (bits == 0)
            bits = 16;
          let bytesperelem = Math.ceil(bits / 8);
          let access = [];
          for (let i = 0; i < bits; i += 8) {
            let symbol = this.dialect.fieldsymbol(f.component, f.field, i);
            access.push({ symbol, bit: i, width: 8 });
            if (alloc) {
              segment.allocateBytes(symbol, rangelen);
            }
          }
          f.access = access;
        }
      }
    }
    allocateROData(segment) {
      let iter = this.iterateEntityFields(this.entities);
      for (var o = iter.next(); o.value; o = iter.next()) {
        let { i, e, c, f, v } = o.value;
        let cfname = mksymbol(c, f.name);
        if (this.fieldtypes[cfname] == "const") {
          let range = segment.fieldranges[cfname];
          let entcount = range ? range.ehi - range.elo + 1 : 0;
          if (v == null && f.dtype == "int")
            v = 0;
          if (v == null && f.dtype == "ref")
            v = 0;
          if (v == null && f.dtype == "array")
            throw new ECSError(`no default value for array ${cfname}`, e);
          if (v instanceof Uint8Array && f.dtype == "array") {
            let ptrlosym = this.dialect.fieldsymbol(c, f, 0);
            let ptrhisym = this.dialect.fieldsymbol(c, f, 8);
            let loofs = segment.allocateBytes(ptrlosym, entcount);
            let hiofs = segment.allocateBytes(ptrhisym, entcount);
            let datasym = this.dialect.datasymbol(c, f, e.id, 0);
            segment.allocateInitData(datasym, v);
            if (f.baseoffset)
              datasym = `(${datasym}+${f.baseoffset})`;
            segment.initdata[loofs + e.id - range.elo] = { symbol: datasym, bitofs: 0 };
            segment.initdata[hiofs + e.id - range.elo] = { symbol: datasym, bitofs: 8 };
          } else if (typeof v === "number") {
            {
              if (!range.access)
                throw new ECSError(`no access for field ${cfname}`);
              for (let a of range.access) {
                segment.allocateBytes(a.symbol, entcount);
                let ofs = segment.getByteOffset(range, a, e.id);
                if (e.id < range.elo)
                  throw new ECSError("entity out of range " + c.name + " " + f.name, e);
                if (segment.initdata[ofs] !== void 0)
                  throw new ECSError("initdata already set " + ofs), e;
                segment.initdata[ofs] = v >> a.bit & 255;
              }
            }
          } else if (v == null && f.dtype == "array" && f.index) {
            let datasym = this.dialect.datasymbol(c, f, e.id, 0);
            let databytes = getFieldLength(f.index);
            let offset = this.bss.allocateBytes(datasym, databytes);
            let ptrlosym = this.dialect.fieldsymbol(c, f, 0);
            let ptrhisym = this.dialect.fieldsymbol(c, f, 8);
            let loofs = segment.allocateBytes(ptrlosym, entcount);
            let hiofs = segment.allocateBytes(ptrhisym, entcount);
            if (f.baseoffset)
              datasym = `(${datasym}+${f.baseoffset})`;
            segment.initdata[loofs + e.id - range.elo] = { symbol: datasym, bitofs: 0 };
            segment.initdata[hiofs + e.id - range.elo] = { symbol: datasym, bitofs: 8 };
          } else {
            throw new ECSError(`unhandled constant ${e.id}:${cfname} -- ${typeof v}`);
          }
        }
      }
    }
    allocateInitData(segment) {
      if (segment.size == 0)
        return "";
      let initbytes = new Uint8Array(segment.size);
      let iter = this.iterateEntityFields(this.entities);
      for (var o = iter.next(); o.value; o = iter.next()) {
        let { i, e, c, f, v } = o.value;
        let scfname = mkscopesymbol(this, c, f.name);
        let initvalue = e.inits[scfname];
        if (initvalue !== void 0) {
          let range = segment.getFieldRange(c, f.name);
          if (!range)
            throw new ECSError(`no init range for ${scfname}`, e);
          if (!range.access)
            throw new ECSError(`no init range access for ${scfname}`, e);
          if (typeof initvalue === "number") {
            for (let a of range.access) {
              let offset = segment.getByteOffset(range, a, e.id);
              initbytes[offset] = initvalue >> a.bit & (1 << a.width) - 1;
            }
          } else if (initvalue instanceof Uint8Array) {
            let datasym = this.dialect.datasymbol(c, f, e.id, 0);
            let ofs = this.bss.symbols[datasym];
            initbytes.set(initvalue, ofs);
          } else {
            throw new ECSError(`cannot initialize ${scfname} = ${initvalue}`);
          }
        }
      }
      let bufsym = this.name + "__INITDATA";
      let bufofs = this.rodata.allocateInitData(bufsym, initbytes);
      let code = this.dialect.INIT_FROM_ARRAY;
      code = code.replace("{{%nbytes}}", initbytes.length.toString());
      code = code.replace("{{%src}}", bufsym);
      code = code.replace("{{%dest}}", segment.getOriginSymbol());
      return code;
    }
    getFieldRange(c, fn) {
      return this.bss.getFieldRange(c, fn) || this.rodata.getFieldRange(c, fn);
    }
    setConstValue(e, component, field, value) {
      this.setConstInitValue(e, component, field, value, "const");
    }
    setInitValue(e, component, field, value) {
      this.setConstInitValue(e, component, field, value, "init");
    }
    setConstInitValue(e, component, field, value, type) {
      this.checkFieldValue(field, value);
      let fieldName = field.name;
      let cfname = mksymbol(component, fieldName);
      let ecfname = mkscopesymbol(this, component, fieldName);
      if (e.consts[cfname] !== void 0)
        throw new ECSError(`"${fieldName}" is already defined as a constant`, e);
      if (e.inits[ecfname] !== void 0)
        throw new ECSError(`"${fieldName}" is already defined as a variable`, e);
      if (type == "const")
        e.consts[cfname] = value;
      if (type == "init")
        e.inits[ecfname] = value;
      this.fieldtypes[cfname] = type;
    }
    isConstOrInit(component, fieldName) {
      return this.fieldtypes[mksymbol(component, fieldName)];
    }
    getConstValue(entity, fieldName) {
      let component = this.em.singleComponentWithFieldName([entity.etype], fieldName, entity);
      let cfname = mksymbol(component, fieldName);
      return entity.consts[cfname];
    }
    checkFieldValue(field, value) {
      if (field.dtype == "array") {
        if (!(value instanceof Uint8Array))
          throw new ECSError(`This "${field.name}" value should be an array.`);
      } else if (typeof value !== "number") {
        throw new ECSError(`This "${field.name}" ${field.dtype} value should be an number.`);
      } else {
        if (field.dtype == "int") {
          if (value < field.lo || value > field.hi)
            throw new ECSError(`This "${field.name}" value is out of range, should be between ${field.lo} and ${field.hi}.`);
        } else if (field.dtype == "ref") {
          let eset = new EntitySet(this, field.query);
          if (value < 0 || value >= eset.entities.length)
            throw new ECSError(`This "${field.name}" value is out of range for this ref type.`);
        }
      }
    }
    generateCodeForEvent(event, args, codelabel) {
      let systems = this.em.event2systems[event];
      if (!systems || systems.length == 0) {
        console.log(`warning: no system responds to "${event}"`);
        return "";
      }
      this.eventSeq++;
      let code = "";
      if (codelabel) {
        code += this.dialect.label(codelabel) + "\n";
      }
      if (event == "start") {
        code += this.allocateInitData(this.bss);
      }
      let eventCount = 0;
      let instances = this.instances.filter((inst) => systems.includes(inst.system));
      for (let inst of instances) {
        let sys = inst.system;
        for (let action of sys.actions) {
          if (action.event == event) {
            eventCount++;
            let codeeval = new ActionEval(this, inst, action, args || []);
            codeeval.begin();
            if (action.critical)
              this.inCritical++;
            let eventcode = codeeval.codeToString();
            if (action.critical)
              this.inCritical--;
            if (!this.inCritical && codeeval.isSubroutineSized(eventcode)) {
              let normcode = this.normalizeCode(eventcode, action);
              let estats = this.eventCodeStats[normcode];
              if (!estats) {
                estats = this.eventCodeStats[normcode] = new EventCodeStats(inst, action, eventcode);
              }
              estats.labels.push(codeeval.label);
              estats.count++;
              if (action.critical)
                estats.count++;
            }
            let s = "";
            s += this.dialect.comment(`start action ${codeeval.label}`);
            s += eventcode;
            s += this.dialect.comment(`end action ${codeeval.label}`);
            code += s;
            codeeval.end();
          }
        }
      }
      if (eventCount == 0) {
        console.log(`warning: event ${event} not handled`);
      }
      return code;
    }
    normalizeCode(code, action) {
      code = code.replace(/\b(\w+__\w+__)(\d+)__(\w+)\b/g, (z, a, b, c) => a + c);
      return code;
    }
    getSystemStats(inst) {
      let stats = this.sysstats.get(inst);
      if (!stats) {
        stats = new SystemStats();
        this.sysstats.set(inst, stats);
      }
      return stats;
    }
    updateTempLiveness(inst) {
      let stats = this.getSystemStats(inst);
      let n = this.eventSeq;
      if (stats.tempstartseq && stats.tempendseq) {
        stats.tempstartseq = Math.min(stats.tempstartseq, n);
        stats.tempendseq = Math.max(stats.tempendseq, n);
      } else {
        stats.tempstartseq = stats.tempendseq = n;
      }
    }
    includeResource(symbol) {
      this.resources.add(symbol);
      return symbol;
    }
    allocateTempVars() {
      let pack = new Packer();
      let maxTempBytes = 128 - this.bss.size;
      let bssbin = new Bin({ left: 0, top: 0, bottom: this.eventSeq + 1, right: maxTempBytes });
      pack.bins.push(bssbin);
      for (let instance of this.instances) {
        let stats = this.getSystemStats(instance);
        if (instance.system.tempbytes && stats.tempstartseq && stats.tempendseq) {
          let v = {
            inst: instance,
            top: stats.tempstartseq,
            bottom: stats.tempendseq + 1,
            width: instance.system.tempbytes,
            height: stats.tempendseq - stats.tempstartseq + 1,
            label: instance.system.name
          };
          pack.boxes.push(v);
        }
      }
      if (!pack.pack())
        console.log("cannot pack temporary local vars");
      if (bssbin.extents.right > 0) {
        let tempofs = this.bss.allocateBytes("TEMP", bssbin.extents.right);
        for (let b of pack.boxes) {
          let inst = b.inst;
          if (b.box)
            this.bss.declareSymbol(this.dialect.tempLabel(inst), tempofs + b.box.left);
        }
      }
      console.log(pack.toSVGUrl());
    }
    analyzeEntities() {
      this.buildSegments();
      this.allocateSegment(this.bss, true, "init");
      this.allocateSegment(this.bss, true, void 0);
      this.allocateSegment(this.rodata, false, "const");
      this.allocateROData(this.rodata);
    }
    generateCode() {
      this.eventSeq = 0;
      this.eventCodeStats = {};
      let isMainScope = this.parent == null;
      let start;
      let initsys = this.em.getSystemByName("Init");
      if (isMainScope && initsys) {
        this.newSystemInstanceWithDefaults(initsys);
        start = this.generateCodeForEvent("main_init");
      } else {
        start = this.generateCodeForEvent("start");
      }
      start = this.replaceSubroutines(start);
      this.code.addCodeFragment(start);
      for (let sub of Array.from(this.resources.values())) {
        if (!this.getSystemInstanceNamed(sub)) {
          let sys = this.em.getSystemByName(sub);
          if (!sys)
            throw new ECSError(`cannot find resource named "${sub}"`);
          this.newSystemInstanceWithDefaults(sys);
        }
        let code = this.generateCodeForEvent(sub, [], sub);
        this.code.addCodeFragment(code);
      }
    }
    replaceSubroutines(code) {
      let allsubs = [];
      for (let stats of Object.values(this.eventCodeStats)) {
        if (stats.count > 1) {
          if (allsubs.length == 0) {
            allsubs = [
              this.dialect.segment("rodata"),
              this.dialect.alignSegmentStart()
            ];
          } else if (stats.action.fitbytes) {
            allsubs.push(this.dialect.alignIfLessThan(stats.action.fitbytes));
          }
          let subcall = this.dialect.call(stats.labels[0]);
          for (let label of stats.labels) {
            let startdelim = this.dialect.comment(`start action ${label}`).trim();
            let enddelim = this.dialect.comment(`end action ${label}`).trim();
            let istart = code.indexOf(startdelim);
            let iend = code.indexOf(enddelim, istart);
            if (istart >= 0 && iend > istart) {
              code = code.substring(0, istart) + subcall + code.substring(iend + enddelim.length);
            }
          }
          let substart = stats.labels[0];
          let sublines = [
            this.dialect.segment("rodata"),
            this.dialect.label(substart),
            stats.eventcode,
            this.dialect.return()
          ];
          if (stats.action.critical) {
            sublines.push(this.dialect.warningIfPageCrossed(substart));
          }
          if (stats.action.fitbytes) {
            sublines.push(this.dialect.warningIfMoreThan(stats.action.fitbytes, substart));
          }
          allsubs = allsubs.concat(sublines);
        }
      }
      code += allsubs.join("\n");
      return code;
    }
    showStats() {
      for (let inst of this.instances) {
        console.log(inst.system.name, this.getSystemStats(inst));
      }
    }
    dumpCodeTo(file) {
      let dialect = this.dialect;
      file.line(dialect.startScope(this.name));
      file.line(dialect.segment("bss"));
      this.bss.dump(file, dialect);
      file.line(dialect.segment("code"));
      this.rodata.dump(file, dialect);
      file.line(dialect.label("__Start"));
      this.code.dump(file);
      for (let subscope of this.childScopes) {
        subscope.dump(file);
      }
      file.line(dialect.endScope(this.name));
    }
    dump(file) {
      this.analyzeEntities();
      this.generateCode();
      this.allocateTempVars();
      this.dumpCodeTo(file);
    }
  };
  var EntityManager = class {
    constructor(dialect) {
      this.dialect = dialect;
      this.archetypes = {};
      this.components = {};
      this.systems = {};
      this.topScopes = {};
      this.event2systems = {};
      this.name2cfpairs = {};
      this.mainPath = "";
      this.imported = {};
      this.seq = 1;
    }
    newScope(name, parent) {
      let existing = this.topScopes[name];
      if (existing && !existing.isDemo)
        throw new ECSError(`scope ${name} already defined`, existing);
      let scope = new EntityScope(this, this.dialect, name, parent);
      if (!parent)
        this.topScopes[name] = scope;
      return scope;
    }
    deferComponent(name) {
      this.components[name] = { name, fields: [] };
    }
    defineComponent(ctype) {
      let existing = this.components[ctype.name];
      if (existing && existing.fields.length > 0)
        throw new ECSError(`component ${ctype.name} already defined`, existing);
      if (existing) {
        existing.fields = ctype.fields;
        ctype = existing;
      }
      for (let field of ctype.fields) {
        let list = this.name2cfpairs[field.name];
        if (!list)
          list = this.name2cfpairs[field.name] = [];
        list.push({ c: ctype, f: field });
      }
      this.components[ctype.name] = ctype;
      return ctype;
    }
    defineSystem(system) {
      let existing = this.systems[system.name];
      if (existing)
        throw new ECSError(`system ${system.name} already defined`, existing);
      return this.systems[system.name] = system;
    }
    registerSystemEvents(system) {
      for (let a of system.actions) {
        let event = a.event;
        let list = this.event2systems[event];
        if (list == null)
          list = this.event2systems[event] = [];
        if (!list.includes(system))
          list.push(system);
      }
    }
    addArchetype(atype) {
      let key = atype.components.map((c) => c.name).join(",");
      if (this.archetypes[key])
        return this.archetypes[key];
      else
        return this.archetypes[key] = atype;
    }
    componentsMatching(q, etype) {
      var _a;
      let list = [];
      for (let c of etype.components) {
        if ((_a = q.exclude) == null ? void 0 : _a.includes(c)) {
          return [];
        }
        if (q.include.length == 0 || q.include.includes(c)) {
          list.push(c);
        }
      }
      return list.length == q.include.length ? list : [];
    }
    archetypesMatching(q) {
      let result = new Set();
      for (let etype of Object.values(this.archetypes)) {
        let cmatch = this.componentsMatching(q, etype);
        if (cmatch.length > 0) {
          result.add(etype);
        }
      }
      return Array.from(result.values());
    }
    componentsWithFieldName(atypes, fieldName) {
      let comps = new Set();
      for (let at of atypes) {
        for (let c of at.components) {
          for (let f of c.fields) {
            if (f.name == fieldName)
              comps.add(c);
          }
        }
      }
      return Array.from(comps);
    }
    getComponentByName(name) {
      return this.components[name];
    }
    getSystemByName(name) {
      return this.systems[name];
    }
    singleComponentWithFieldName(atypes, fieldName, where) {
      let cfpairs = this.name2cfpairs[fieldName];
      if (!cfpairs)
        throw new ECSError(`cannot find field named "${fieldName}"`, where);
      let filtered = cfpairs.filter((cf) => atypes.find((a) => a.components.includes(cf.c)));
      if (filtered.length == 0) {
        throw new ECSError(`cannot find component with field "${fieldName}" in this context`, where);
      }
      if (filtered.length > 1) {
        throw new ECSError(`ambiguous field name "${fieldName}"`, where);
      }
      return filtered[0].c;
    }
    toJSON() {
      return JSON.stringify({
        components: this.components,
        systems: this.systems
      });
    }
    exportToFile(file) {
      for (let event of Object.keys(this.event2systems)) {
        file.line(this.dialect.equate(`EVENT__${event}`, "1"));
      }
      for (let scope of Object.values(this.topScopes)) {
        if (!scope.isDemo || scope.filePath == this.mainPath) {
          scope.dump(file);
        }
      }
    }
    *iterateScopes() {
      for (let scope of Object.values(this.topScopes)) {
        yield scope;
        scope.iterateChildScopes();
      }
    }
    getDebugTree() {
      let scopes = this.topScopes;
      let components = this.components;
      let fields = this.name2cfpairs;
      let systems = this.systems;
      let events = this.event2systems;
      let entities = {};
      for (let scope of Array.from(this.iterateScopes())) {
        for (let e of scope.entities)
          entities[e.name || "#" + e.id.toString()] = e;
      }
      return { scopes, components, fields, systems, events, entities };
    }
    evalExpr(expr, scope) {
      if (isLiteral2(expr))
        return expr;
      if (isBinOp2(expr) || isUnOp2(expr)) {
        var fn = this["evalop__" + expr.op];
        if (!fn)
          throw new ECSError(`no eval function for "${expr.op}"`);
      }
      if (isBinOp2(expr)) {
        expr.left = this.evalExpr(expr.left, scope);
        expr.right = this.evalExpr(expr.right, scope);
        let e = fn(expr.left, expr.right);
        return e || expr;
      }
      if (isUnOp2(expr)) {
        expr.expr = this.evalExpr(expr.expr, scope);
        let e = fn(expr.expr);
        return e || expr;
      }
      return expr;
    }
    evalop__neg(arg) {
      if (isLiteralInt(arg)) {
        let valtype = {
          dtype: "int",
          lo: -arg.valtype.hi,
          hi: arg.valtype.hi
        };
        return { valtype, value: -arg.value };
      }
    }
    evalop__add(left, right) {
      if (isLiteralInt(left) && isLiteralInt(right)) {
        let valtype = {
          dtype: "int",
          lo: left.valtype.lo + right.valtype.lo,
          hi: left.valtype.hi + right.valtype.hi
        };
        return { valtype, value: left.value + right.value };
      }
    }
    evalop__sub(left, right) {
      if (isLiteralInt(left) && isLiteralInt(right)) {
        let valtype = {
          dtype: "int",
          lo: left.valtype.lo - right.valtype.hi,
          hi: left.valtype.hi - right.valtype.lo
        };
        return { valtype, value: left.value - right.value };
      }
    }
  };

  // src/common/ecs/decoder.ts
  var LineDecoder = class {
    constructor(text) {
      this.curline = 0;
      this.lines = text.split("\n").map((s) => s.trim()).filter((s) => !!s).map((s) => s.split(/\s+/));
    }
    decodeBits(s, n, msbfirst) {
      if (s.length != n)
        throw new ECSError(`Expected ${n} characters`);
      let b = 0;
      for (let i = 0; i < n; i++) {
        let bit;
        let ch = s.charAt(i);
        if (ch == "x" || ch == "X" || ch == "1")
          bit = 1;
        else if (ch == "." || ch == "0")
          bit = 0;
        else
          throw new ECSError("need x or . (or 0 or 1)");
        if (bit) {
          if (msbfirst)
            b |= 1 << n - 1 - i;
          else
            b |= 1 << i;
        }
      }
      return b;
    }
    assertTokens(toks, count) {
      if (toks.length != count)
        throw new ECSError(`Expected ${count} tokens on line.`);
    }
    hex(s) {
      let v = parseInt(s, 16);
      if (isNaN(v))
        throw new ECSError(`Invalid hex value: ${s}`);
      return v;
    }
    getErrorLocation($loc) {
      $loc.line += this.curline + 1;
      return $loc;
    }
  };
  var VCSSpriteDecoder = class extends LineDecoder {
    parse() {
      let height = this.lines.length;
      let bitmapdata = new Uint8Array(height);
      let colormapdata = new Uint8Array(height);
      for (let i = 0; i < height; i++) {
        this.curline = height - 1 - i;
        let toks = this.lines[this.curline];
        this.assertTokens(toks, 2);
        bitmapdata[i] = this.decodeBits(toks[0], 8, true);
        colormapdata[i] = this.hex(toks[1]);
      }
      return {
        properties: {
          bitmapdata,
          colormapdata,
          height: height - 1
        }
      };
    }
  };
  var VCSBitmapDecoder = class extends LineDecoder {
    parse() {
      let height = this.lines.length;
      let bitmapdata = new Uint8Array(height);
      for (let i = 0; i < height; i++) {
        this.curline = height - 1 - i;
        let toks = this.lines[this.curline];
        this.assertTokens(toks, 1);
        bitmapdata[i] = this.decodeBits(toks[0], 8, true);
      }
      return {
        properties: {
          bitmapdata,
          height: height - 1
        }
      };
    }
  };
  var VCSPlayfieldDecoder = class extends LineDecoder {
    parse() {
      let height = this.lines.length;
      let pf = new Uint32Array(height);
      for (let i = 0; i < height; i++) {
        this.curline = height - 1 - i;
        let toks = this.lines[this.curline];
        this.assertTokens(toks, 1);
        let pf0 = this.decodeBits(toks[0].substring(0, 4), 4, false) << 4;
        let pf1 = this.decodeBits(toks[0].substring(4, 12), 8, true);
        let pf2 = this.decodeBits(toks[0].substring(12, 20), 8, false);
        pf[i] = pf0 << 0 | pf1 << 8 | pf2 << 16;
      }
      return {
        properties: {
          pf
        }
      };
    }
  };
  var VCSVersatilePlayfieldDecoder = class extends LineDecoder {
    parse() {
      let height = this.lines.length;
      let data = new Uint8Array(height * 2);
      data.fill(63);
      const regs = [13, 14, 15, 8, 9, 10, 63];
      let prev = [0, 0, 0, 0, 0, 0, 0];
      let cur = [0, 0, 0, 0, 0, 0, 0];
      for (let i = 0; i < height; i++) {
        let dataofs = height * 2 - i * 2;
        this.curline = i;
        let toks = this.lines[this.curline];
        if (toks.length == 2) {
          data[dataofs - 1] = this.hex(toks[0]);
          data[dataofs - 2] = this.hex(toks[1]);
          continue;
        }
        this.assertTokens(toks, 4);
        cur[0] = this.decodeBits(toks[0].substring(0, 4), 4, false) << 4;
        cur[1] = this.decodeBits(toks[0].substring(4, 12), 8, true);
        cur[2] = this.decodeBits(toks[0].substring(12, 20), 8, false);
        if (toks[1] != "..")
          cur[3] = this.hex(toks[1]);
        if (toks[2] != "..")
          cur[4] = this.hex(toks[2]);
        if (toks[3] != "..")
          cur[5] = this.hex(toks[3]);
        let changed = [];
        for (let j = 0; j < cur.length; j++) {
          if (cur[j] != prev[j])
            changed.push(j);
        }
        if (changed.length > 1) {
          console.log(changed, cur, prev);
          throw new ECSError(`More than one register change in line ${i + 1}: [${changed}]`);
        }
        let chgidx = changed.length ? changed[0] : regs.length - 1;
        data[dataofs - 1] = regs[chgidx];
        data[dataofs - 2] = cur[chgidx];
        prev[chgidx] = cur[chgidx];
      }
      return {
        properties: {
          data
        }
      };
    }
  };
  var VCSBitmap48Decoder = class extends LineDecoder {
    parse() {
      let height = this.lines.length;
      let bitmap0 = new Uint8Array(height);
      let bitmap1 = new Uint8Array(height);
      let bitmap2 = new Uint8Array(height);
      let bitmap3 = new Uint8Array(height);
      let bitmap4 = new Uint8Array(height);
      let bitmap5 = new Uint8Array(height);
      for (let i = 0; i < height; i++) {
        this.curline = height - 1 - i;
        let toks = this.lines[this.curline];
        this.assertTokens(toks, 1);
        bitmap0[i] = this.decodeBits(toks[0].slice(0, 8), 8, true);
        bitmap1[i] = this.decodeBits(toks[0].slice(8, 16), 8, true);
        bitmap2[i] = this.decodeBits(toks[0].slice(16, 24), 8, true);
        bitmap3[i] = this.decodeBits(toks[0].slice(24, 32), 8, true);
        bitmap4[i] = this.decodeBits(toks[0].slice(32, 40), 8, true);
        bitmap5[i] = this.decodeBits(toks[0].slice(40, 48), 8, true);
      }
      return {
        properties: {
          bitmap0,
          bitmap1,
          bitmap2,
          bitmap3,
          bitmap4,
          bitmap5,
          height: height - 1
        }
      };
    }
  };
  function newDecoder(name, text) {
    let cons = DECODERS[name];
    if (cons)
      return new cons(text);
  }
  var DECODERS = {
    "vcs_sprite": VCSSpriteDecoder,
    "vcs_bitmap": VCSBitmapDecoder,
    "vcs_playfield": VCSPlayfieldDecoder,
    "vcs_versatile": VCSVersatilePlayfieldDecoder,
    "vcs_bitmap48": VCSBitmap48Decoder
  };

  // src/common/ecs/compiler.ts
  var ECSTokenType;
  (function(ECSTokenType2) {
    ECSTokenType2["Ellipsis"] = "ellipsis";
    ECSTokenType2["Operator"] = "operator";
    ECSTokenType2["Relational"] = "relational";
    ECSTokenType2["QuotedString"] = "quoted-string";
    ECSTokenType2["Integer"] = "integer";
    ECSTokenType2["CodeFragment"] = "code-fragment";
    ECSTokenType2["Placeholder"] = "placeholder";
  })(ECSTokenType || (ECSTokenType = {}));
  var OPERATORS2 = {
    "IMP": { f: "bimp", p: 4 },
    "EQV": { f: "beqv", p: 5 },
    "XOR": { f: "bxor", p: 6 },
    "OR": { f: "bor", p: 7 },
    "AND": { f: "band", p: 8 },
    "||": { f: "lor", p: 17 },
    "&&": { f: "land", p: 18 },
    "=": { f: "eq", p: 50 },
    "==": { f: "eq", p: 50 },
    "<>": { f: "ne", p: 50 },
    "><": { f: "ne", p: 50 },
    "!=": { f: "ne", p: 50 },
    "#": { f: "ne", p: 50 },
    "<": { f: "lt", p: 50 },
    ">": { f: "gt", p: 50 },
    "<=": { f: "le", p: 50 },
    ">=": { f: "ge", p: 50 },
    "MIN": { f: "min", p: 75 },
    "MAX": { f: "max", p: 75 },
    "+": { f: "add", p: 100 },
    "-": { f: "sub", p: 100 }
  };
  function getOperator2(op) {
    return OPERATORS2[op];
  }
  function getPrecedence2(tok) {
    switch (tok.type) {
      case ECSTokenType.Operator:
      case ECSTokenType.Relational:
      case TokenType2.Ident:
        let op = getOperator2(tok.str);
        if (op)
          return op.p;
    }
    return -1;
  }
  var ECSCompiler = class extends Tokenizer {
    constructor(em, isMainFile) {
      super();
      this.em = em;
      this.isMainFile = isMainFile;
      this.currentScope = null;
      this.currentContext = null;
      this.includeDebugInfo = false;
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
        { type: TokenType2.Ident, regex: /[A-Za-z_][A-Za-z0-9_]*/ },
        { type: TokenType2.Ignore, regex: /\/\/.*?[\n\r]/ },
        { type: TokenType2.Ignore, regex: /\/\*.*?\*\// },
        { type: TokenType2.EOL, regex: /[\n\r]+/ },
        { type: TokenType2.Ignore, regex: /\s+/ }
      ]);
      this.errorOnCatchAll = true;
    }
    annotate(fn) {
      let start = this.peekToken();
      let obj = fn();
      let end = this.lasttoken;
      let $loc = end ? mergeLocs2(start.$loc, end.$loc) : start.$loc;
      if (obj)
        obj.$loc = $loc;
      return obj;
    }
    parseFile(text, path) {
      this.tokenizeFile(text, path);
      while (!this.isEOF()) {
        let top = this.parseTopLevel();
        if (top) {
          let t = top;
          this.annotate(() => t);
        }
      }
      this.runDeferred();
    }
    importFile(path) {
      if (!this.em.imported[path]) {
        let text = this.getImportFile && this.getImportFile(path);
        if (!text)
          this.compileError(`I can't find the import file "${path}".`);
        this.em.imported[path] = true;
        let comp = new ECSCompiler(this.em, false);
        comp.includeDebugInfo = this.includeDebugInfo;
        try {
          comp.parseFile(text, path);
        } catch (e) {
          for (var err of comp.errors)
            this.errors.push(err);
          throw e;
        }
      }
    }
    parseTopLevel() {
      let tok = this.expectTokens(["component", "system", "scope", "resource", "import", "demo", "comment"]);
      if (tok.str == "component") {
        return this.em.defineComponent(this.parseComponentDefinition());
      }
      if (tok.str == "system") {
        return this.em.defineSystem(this.parseSystem());
      }
      if (tok.str == "scope") {
        return this.parseScope();
      }
      if (tok.str == "resource") {
        return this.em.defineSystem(this.parseResource());
      }
      if (tok.str == "import") {
        let tok2 = this.expectTokenTypes([ECSTokenType.QuotedString]);
        let path = tok2.str.substring(1, tok2.str.length - 1);
        return this.importFile(path);
      }
      if (tok.str == "demo") {
        if (this.isMainFile) {
          let scope = this.parseScope();
          scope.isDemo = true;
          this.expectToken("demo");
          return scope;
        } else {
          this.skipDemo();
          return;
        }
      }
      if (tok.str == "comment") {
        this.expectTokenTypes([ECSTokenType.CodeFragment]);
        return;
      }
      this.compileError(`Unexpected top-level keyword: ${tok.str}`);
    }
    skipDemo() {
      var tok;
      while ((tok = this.consumeToken()) && !this.isEOF()) {
        if (tok.str == "end" && this.peekToken().str == "demo") {
          this.consumeToken();
          return;
        }
      }
      throw new ECSError(`Expected "end demo" after a "demo" declaration.`);
    }
    parseComponentDefinition() {
      let name = this.expectIdent().str;
      let fields = [];
      this.em.deferComponent(name);
      while (this.peekToken().str != "end") {
        fields.push(this.parseComponentField());
      }
      this.expectToken("end");
      return { name, fields };
    }
    parseComponentField() {
      let name = this.expectIdent();
      this.expectToken(":", 'I expected either a ":" or "end" here.');
      let type = this.parseDataType();
      return __spreadValues({ name: name.str, $loc: name.$loc }, type);
    }
    parseDataType() {
      if (this.peekToken().type == "integer") {
        let lo = this.parseIntegerConstant();
        this.expectToken("..");
        let hi = this.parseIntegerConstant();
        this.checkLowerLimit(lo, -2147483648, "lower int range");
        this.checkUpperLimit(hi, 2147483647, "upper int range");
        this.checkUpperLimit(hi - lo, 4294967295, "int range");
        this.checkLowerLimit(hi, lo, "int range");
        let defvalue;
        if (this.ifToken("default")) {
          defvalue = this.parseIntegerConstant();
        }
        return { dtype: "int", lo, hi, defvalue };
      }
      if (this.peekToken().str == "[") {
        return { dtype: "ref", query: this.parseQuery() };
      }
      if (this.ifToken("array")) {
        let index = void 0;
        if (this.peekToken().type == ECSTokenType.Integer) {
          index = this.parseDataType();
        }
        this.expectToken("of");
        let elem = this.parseDataType();
        let baseoffset;
        if (this.ifToken("baseoffset")) {
          baseoffset = this.parseIntegerConstant();
          this.checkLowerLimit(baseoffset, -32768, "base offset");
          this.checkUpperLimit(baseoffset, 32767, "base offset");
        }
        return { dtype: "array", index, elem, baseoffset };
      }
      if (this.ifToken("enum")) {
        this.expectToken("[");
        let enumtoks = this.parseList(this.parseEnumIdent, ",");
        this.expectToken("]");
        if (enumtoks.length == 0)
          this.compileError(`must define at least one enum`);
        let lo = 0;
        let hi = enumtoks.length - 1;
        this.checkLowerLimit(hi, 0, "enum count");
        this.checkUpperLimit(hi, 255, "enum count");
        let enums = {};
        for (let i = 0; i <= hi; i++)
          enums[enumtoks[i].str] = i;
        let defvalue;
        if (this.ifToken("default")) {
          defvalue = this.parseIntegerConstant();
        }
        return { dtype: "int", lo, hi, defvalue, enums };
      }
      throw this.compileError(`I expected a data type here.`);
    }
    parseEnumIdent() {
      let tok = this.expectTokenTypes([TokenType2.Ident]);
      return tok;
    }
    parseEnumValue(tok, field) {
      if (!field.enums)
        throw new ECSError(`field is not an enum`);
      let value = field.enums[tok.str];
      if (value == null)
        throw new ECSError(`unknown enum "${tok.str}"`);
      return value;
    }
    parseDataValue(field) {
      var _a, _b;
      let tok = this.peekToken();
      if (tok.type == TokenType2.Ident && field.dtype == "int") {
        return this.parseEnumValue(this.consumeToken(), field);
      }
      if (tok.type == TokenType2.Ident) {
        let entity = (_a = this.currentScope) == null ? void 0 : _a.getEntityByName(tok.str);
        if (!entity)
          this.compileError('no entity named "${tok.str}"');
        else {
          this.consumeToken();
          this.expectToken(".");
          let fieldName = this.expectIdent().str;
          let constValue = (_b = this.currentScope) == null ? void 0 : _b.getConstValue(entity, fieldName);
          if (constValue == null)
            throw new ECSError(`"${fieldName}" is not defined as a constant`, entity);
          else
            return constValue;
        }
      }
      if (tok.str == "[") {
        return new Uint8Array(this.parseDataArray());
      }
      if (tok.str == "#") {
        this.consumeToken();
        let reftype = field.dtype == "ref" ? field : void 0;
        return this.parseEntityForwardRef(reftype);
      }
      return this.parseIntegerConstant();
    }
    parseEntityForwardRef(reftype) {
      let token = this.expectIdent();
      return { reftype, token };
    }
    parseDataArray() {
      this.expectToken("[");
      let arr = this.parseList(this.parseIntegerConstant, ",");
      this.expectToken("]");
      return arr;
    }
    expectInteger() {
      let s = this.consumeToken().str;
      let i;
      if (s.startsWith("$"))
        i = parseInt(s.substring(1), 16);
      else if (s.startsWith("%"))
        i = parseInt(s.substring(1), 2);
      else
        i = parseInt(s);
      if (isNaN(i))
        this.compileError("There should be an integer here.");
      return i;
    }
    parseSystem() {
      let name = this.expectIdent().str;
      let actions = [];
      let system = { name, actions };
      let cmd;
      while ((cmd = this.expectTokens(["on", "locals", "end"]).str) != "end") {
        if (cmd == "on") {
          let action = this.annotate(() => this.parseAction(system));
          actions.push(action);
        } else if (cmd == "locals") {
          system.tempbytes = this.parseIntegerConstant();
        } else {
          this.compileError(`Unexpected system keyword: ${cmd}`);
        }
      }
      return system;
    }
    parseResource() {
      let name = this.expectIdent().str;
      let tempbytes;
      if (this.peekToken().str == "locals") {
        this.consumeToken();
        tempbytes = this.parseIntegerConstant();
      }
      let system = { name, tempbytes, actions: [] };
      let expr = this.annotate(() => this.parseBlockStatement());
      let action = { expr, event: name };
      system.actions.push(action);
      return system;
    }
    parseAction(system) {
      const event = this.expectIdent().str;
      this.expectToken("do");
      let fitbytes = void 0;
      let critical = void 0;
      if (this.ifToken("critical"))
        critical = true;
      if (this.ifToken("fit"))
        fitbytes = this.parseIntegerConstant();
      let expr = this.annotate(() => this.parseBlockStatement());
      let action = { expr, event, fitbytes, critical };
      return action;
    }
    parseQuery() {
      let q = { include: [] };
      let start = this.expectToken("[");
      this.parseList(() => this.parseQueryItem(q), ",");
      this.expectToken("]");
      q.$loc = mergeLocs2(start.$loc, this.lasttoken.$loc);
      return q;
    }
    parseQueryItem(q) {
      let prefix = this.peekToken();
      if (prefix.type != TokenType2.Ident) {
        this.consumeToken();
      }
      if (prefix.type == TokenType2.Ident) {
        let cref = this.parseComponentRef();
        q.include.push(cref);
      } else if (prefix.str == "-") {
        let cref = this.parseComponentRef();
        if (!q.exclude)
          q.exclude = [];
        q.exclude.push(cref);
      } else if (prefix.str == "#") {
        const scope = this.currentScope;
        if (scope == null) {
          throw this.compileError("You can only reference specific entities inside of a scope.");
        }
        let eref = this.parseEntityForwardRef();
        this.deferred.push(() => {
          let refvalue = this.resolveEntityRef(scope, eref);
          if (!q.entities)
            q.entities = [];
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
    parseCode() {
      let tok = this.expectTokenTypes([ECSTokenType.CodeFragment]);
      let code = tok.str.substring(3, tok.str.length - 3);
      let lines = code.split("\n");
      if (this.includeDebugInfo)
        this.addDebugInfo(lines, tok.$loc.line);
      code = lines.join("\n");
      return code;
    }
    addDebugInfo(lines, startline) {
      const re = /^\s*(;|\/\/|$)/;
      for (let i = 0; i < lines.length; i++) {
        if (!lines[i].match(re))
          lines[i] = this.em.dialect.debug_line(this.path, startline + i) + "\n" + lines[i];
      }
    }
    parseScope() {
      let name = this.expectIdent().str;
      let scope = this.em.newScope(name, this.currentScope || void 0);
      scope.filePath = this.path;
      this.currentScope = scope;
      let cmd;
      while ((cmd = this.expectTokens(["end", "using", "entity", "scope", "comment", "system"]).str) != "end") {
        if (cmd == "using") {
          this.parseScopeUsing();
        }
        if (cmd == "entity") {
          this.annotate(() => this.parseEntity());
        }
        if (cmd == "scope") {
          this.annotate(() => this.parseScope());
        }
        if (cmd == "comment") {
          this.expectTokenTypes([ECSTokenType.CodeFragment]);
        }
        if (cmd == "system") {
          let sys = this.annotate(() => this.parseSystem());
          this.em.defineSystem(sys);
          this.currentScope.newSystemInstanceWithDefaults(sys);
        }
      }
      this.currentScope = scope.parent || null;
      return scope;
    }
    parseScopeUsing() {
      var _a;
      let instlist = this.parseList(this.parseSystemInstanceRef, ",");
      let params = {};
      if (this.peekToken().str == "with") {
        this.consumeToken();
        params = this.parseSystemInstanceParameters();
      }
      for (let inst of instlist) {
        inst.params = params;
        (_a = this.currentScope) == null ? void 0 : _a.newSystemInstance(inst);
      }
    }
    parseEntity() {
      if (!this.currentScope) {
        throw this.internalError();
      }
      const scope = this.currentScope;
      let entname = "";
      if (this.peekToken().type == TokenType2.Ident) {
        entname = this.expectIdent().str;
      }
      let etype = this.parseEntityArchetype();
      let entity = this.currentScope.newEntity(etype, entname);
      let cmd2;
      while ((cmd2 = this.expectTokens(["const", "init", "var", "decode", "end"]).str) != "end") {
        let cmd = cmd2;
        if (cmd == "var")
          cmd = "init";
        if (cmd == "init" || cmd == "const") {
          this.parseInitConst(cmd, scope, entity);
        } else if (cmd == "decode") {
          this.parseDecode(scope, entity);
        }
      }
      return entity;
    }
    parseInitConst(cmd, scope, entity) {
      let name = this.expectIdent().str;
      let { c, f } = this.getEntityField(entity, name);
      let symtype = scope.isConstOrInit(c, name);
      if (symtype && symtype != cmd)
        this.compileError(`I can't mix const and init values for a given field in a scope.`);
      this.expectToken("=");
      let valueOrRef = this.parseDataValue(f);
      if (valueOrRef.token != null) {
        this.deferred.push(() => {
          this.lasttoken = valueOrRef.token;
          let refvalue = this.resolveEntityRef(scope, valueOrRef);
          if (cmd == "const")
            scope.setConstValue(entity, c, f, refvalue);
          if (cmd == "init")
            scope.setInitValue(entity, c, f, refvalue);
        });
      } else {
        if (cmd == "const")
          scope.setConstValue(entity, c, f, valueOrRef);
        if (cmd == "init")
          scope.setInitValue(entity, c, f, valueOrRef);
      }
    }
    parseDecode(scope, entity) {
      let decoderid = this.expectIdent().str;
      let codetok = this.expectTokenTypes([ECSTokenType.CodeFragment]);
      let code = codetok.str;
      code = code.substring(3, code.length - 3);
      let decoder = newDecoder(decoderid, code);
      if (!decoder) {
        throw this.compileError(`I can't find a "${decoderid}" decoder.`);
      }
      let result;
      try {
        result = decoder.parse();
      } catch (e) {
        throw new ECSError(e.message, decoder.getErrorLocation(codetok.$loc));
      }
      for (let entry of Object.entries(result.properties)) {
        let { c, f } = this.getEntityField(entity, entry[0]);
        scope.setConstValue(entity, c, f, entry[1]);
      }
    }
    getEntityField(e, name) {
      if (!this.currentScope) {
        throw this.internalError();
      }
      let comps = this.em.componentsWithFieldName([e.etype], name);
      if (comps.length == 0)
        this.compileError(`I couldn't find a field named "${name}" for this entity.`);
      if (comps.length > 1)
        this.compileError(`I found more than one field named "${name}" for this entity.`);
      let component = comps[0];
      let field = component.fields.find((f) => f.name == name);
      if (!field) {
        throw this.internalError();
      }
      return { c: component, f: field };
    }
    parseEntityArchetype() {
      this.expectToken("[");
      let components = this.parseList(this.parseComponentRef, ",");
      this.expectToken("]");
      return { components };
    }
    parseComponentRef() {
      let name = this.expectIdent().str;
      let cref = this.em.getComponentByName(name);
      if (!cref)
        this.compileError(`I couldn't find a component named "${name}".`);
      return cref;
    }
    findEntityByName(scope, token) {
      let name = token.str;
      let eref = scope.entities.find((e) => e.name == name);
      if (!eref) {
        throw this.compileError(`I couldn't find an entity named "${name}" in this scope.`, token.$loc);
      }
      return eref;
    }
    resolveEntityRef(scope, ref) {
      let id = this.findEntityByName(scope, ref.token).id;
      if (ref.reftype) {
        let atypes = this.em.archetypesMatching(ref.reftype.query);
        let entities = scope.entitiesMatching(atypes);
        if (entities.length == 0)
          throw this.compileError(`This entity doesn't seem to fit the reference type.`, ref.token.$loc);
        id -= entities[0].id;
      }
      return id;
    }
    parseSystemInstanceRef() {
      let name = this.expectIdent().str;
      let system = this.em.getSystemByName(name);
      if (!system)
        throw this.compileError(`I couldn't find a system named "${name}".`, this.lasttoken.$loc);
      let params = {};
      let inst = { system, params, id: 0 };
      return inst;
    }
    parseSystemInstanceParameters() {
      let scope = this.currentScope;
      if (scope == null)
        throw this.internalError();
      if (this.peekToken().str == "[") {
        return { query: this.parseQuery() };
      }
      this.expectToken("#");
      let entname = this.expectIdent();
      this.expectToken(".");
      let fieldname = this.expectIdent();
      let entity = this.findEntityByName(scope, entname);
      let cf = this.getEntityField(entity, fieldname.str);
      return { refEntity: entity, refField: cf };
    }
    exportToFile(src) {
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
    checkUpperLimit(value, upper, what) {
      if (value > upper)
        this.compileError(`This ${what} is too high; must be ${upper} or less`);
    }
    checkLowerLimit(value, lower, what) {
      if (value < lower)
        this.compileError(`This ${what} is too low; must be ${lower} or more`);
    }
    parseConstant() {
      let expr = this.parseExpr();
      expr = this.em.evalExpr(expr, this.currentScope);
      if (isLiteral2(expr))
        return expr.value;
      throw this.compileError("This expression is not a constant.");
    }
    parseIntegerConstant() {
      let value = this.parseConstant();
      if (typeof value === "number")
        return value;
      throw this.compileError("This expression is not an integer.");
    }
    parseExpr() {
      var startloc = this.peekToken().$loc;
      var expr = this.parseExpr1(this.parsePrimary(), 0);
      var endloc = this.lasttoken.$loc;
      expr.$loc = mergeLocs2(startloc, endloc);
      return expr;
    }
    parseExpr1(left, minPred) {
      let look = this.peekToken();
      while (getPrecedence2(look) >= minPred) {
        let op = this.consumeToken();
        let right = this.parsePrimary();
        look = this.peekToken();
        while (getPrecedence2(look) > getPrecedence2(op)) {
          right = this.parseExpr1(right, getPrecedence2(look));
          look = this.peekToken();
        }
        var opfn = getOperator2(op.str).f;
        if (op.str == "and")
          opfn = "land";
        if (op.str == "or")
          opfn = "lor";
        var valtype = this.exprTypeForOp(opfn, left, right, op);
        left = { valtype, op: opfn, left, right };
      }
      return left;
    }
    parsePrimary() {
      let tok = this.consumeToken();
      switch (tok.type) {
        case ECSTokenType.Integer:
          this.pushbackToken(tok);
          let value = this.expectInteger();
          let valtype = { dtype: "int", lo: value, hi: value };
          return { valtype, value };
        case TokenType2.Ident:
          if (tok.str == "not") {
            let expr = this.parsePrimary();
            let valtype2 = { dtype: "int", lo: 0, hi: 1 };
            return { valtype: valtype2, op: "lnot", expr };
          } else {
            this.pushbackToken(tok);
            return this.parseVarSubscriptOrFunc();
          }
        case ECSTokenType.Operator:
          if (tok.str == "(") {
            let expr = this.parseExpr();
            this.expectToken(")", `There should be another expression or a ")" here.`);
            return expr;
          } else if (tok.str == "-") {
            let expr = this.parsePrimary();
            let valtype2 = expr.valtype;
            if ((valtype2 == null ? void 0 : valtype2.dtype) == "int") {
              let hi = Math.abs(valtype2.hi);
              let negtype = { dtype: "int", lo: -hi, hi };
              return { valtype: negtype, op: "neg", expr };
            }
          } else if (tok.str == "+") {
            return this.parsePrimary();
          }
        default:
          throw this.compileError(`The expression is incomplete.`);
      }
    }
    parseVarSubscriptOrFunc() {
      var tok = this.consumeToken();
      switch (tok.type) {
        case TokenType2.Ident:
          if (this.ifToken(":")) {
            let ftok = this.consumeToken();
            let component = this.em.getComponentByName(tok.str);
            if (!component)
              throw this.compileError(`A component named "${tok.str}" has not been defined.`);
            let field = component.fields.find((f) => f.name == ftok.str);
            if (!field)
              throw this.compileError(`There is no "${ftok.str}" field in the ${tok.str} component.`);
            if (!this.currentScope)
              throw this.compileError(`This operation only works inside of a scope.`);
            let atypes = this.em.archetypesMatching({ include: [component] });
            let entities = this.currentScope.entitiesMatching(atypes);
            return { entities, field };
          }
          if (this.ifToken(".")) {
            let ftok = this.consumeToken();
            if (!this.currentScope)
              throw this.compileError(`This operation only works inside of a scope.`);
            let entity = this.currentScope.getEntityByName(tok.str);
            if (!entity)
              throw this.compileError(`An entity named "${tok.str}" has not been defined.`);
            let component = this.em.singleComponentWithFieldName([entity.etype], ftok.str, ftok);
            let field = component.fields.find((f) => f.name == ftok.str);
            if (!field)
              throw this.compileError(`There is no "${ftok.str}" field in this entity.`);
            let entities = [entity];
            return { entities, field };
          }
          let args = [];
          if (this.ifToken("(")) {
            args = this.parseExprList();
            this.expectToken(")", `There should be another expression or a ")" here.`);
          }
          var loc = mergeLocs2(tok.$loc, this.lasttoken.$loc);
          var valtype = this.exprTypeForSubscript(tok.str, args, loc);
          return { valtype, name: tok.str, args, $loc: loc };
        default:
          throw this.compileError(`There should be a variable name here.`);
      }
    }
    parseLexpr() {
      var lexpr = this.parseVarSubscriptOrFunc();
      return lexpr;
    }
    exprTypeForOp(fnname, left, right, optok) {
      return { dtype: "int", lo: 0, hi: 255 };
    }
    exprTypeForSubscript(fnname, args, loc) {
      return { dtype: "int", lo: 0, hi: 255 };
    }
    parseLexprList() {
      return this.parseList(this.parseLexpr, ",");
    }
    parseExprList() {
      return this.parseList(this.parseExpr, ",");
    }
    parseBlockStatement() {
      let valtype = { dtype: "int", lo: 0, hi: 0 };
      if (this.peekToken().type == ECSTokenType.CodeFragment) {
        return { valtype, code: this.parseCode() };
      }
      if (this.ifToken("begin")) {
        let stmts = [];
        while (this.peekToken().str != "end") {
          stmts.push(this.annotate(() => this.parseBlockStatement()));
        }
        this.expectToken("end");
        return { valtype, stmts };
      }
      let cmd = this.peekToken();
      if (SELECT_TYPE.includes(cmd.str)) {
        return this.parseQueryStatement();
      }
      throw this.compileError(`There should be a statement or "end" here.`, cmd.$loc);
    }
    parseQueryStatement() {
      const select = this.expectTokens(SELECT_TYPE).str;
      let all = this.ifToken("all") != null;
      let query = void 0;
      let join = void 0;
      if (select == "once") {
        if (this.peekToken().str == "[")
          this.compileError(`A "${select}" action can't include a query.`);
      } else {
        query = this.parseQuery();
      }
      if (select == "join") {
        this.expectToken("with");
        join = this.parseQuery();
      }
      if (this.ifToken("limit")) {
        if (!query) {
          this.compileError(`A "${select}" query can't include a limit.`);
        } else
          query.limit = this.parseIntegerConstant();
      }
      const all_modifiers = ["asc", "desc"];
      const modifiers = this.parseModifiers(all_modifiers);
      let direction = void 0;
      if (modifiers["asc"])
        direction = "asc";
      else if (modifiers["desc"])
        direction = "desc";
      let body = this.annotate(() => this.parseBlockStatement());
      return { select, query, join, direction, all, stmts: [body], loop: select == "foreach" };
    }
  };

  // src/worker/tools/ecs.ts
  function assembleECS(step) {
    let em = new EntityManager(new Dialect_CA65());
    let compiler = new ECSCompiler(em, true);
    compiler.getImportFile = (path) => {
      return getWorkFileAsString(path);
    };
    gatherFiles(step, { mainFilePath: "main.ecs" });
    if (step.mainfile)
      em.mainPath = step.path;
    var destpath = step.prefix + ".ca65";
    if (staleFiles(step, [destpath])) {
      let code = getWorkFileAsString(step.path);
      fixParamsWithDefines(step.path, step.params);
      try {
        compiler.includeDebugInfo = true;
        compiler.parseFile(code, step.path);
        let outtext = compiler.export().toString();
        putWorkFile(destpath, outtext);
        var listings = {};
        listings[destpath] = { lines: [], text: outtext };
        var debuginfo = compiler.em.getDebugTree();
      } catch (e) {
        if (e instanceof ECSError) {
          compiler.addError(e.message, e.$loc);
          for (let obj of e.$sources) {
            let name = obj.event;
            if (name == "start")
              break;
            compiler.addError(`... ${name}`, obj.$loc);
          }
          return { errors: compiler.errors };
        } else if (e instanceof CompileError3) {
          return { errors: compiler.errors };
        } else {
          throw e;
        }
      }
      return {
        nexttool: "ca65",
        path: destpath,
        args: [destpath],
        files: [destpath].concat(step.files),
        listings,
        debuginfo
      };
    }
  }

  // src/worker/workermain.ts
  var ENVIRONMENT_IS_WEB = typeof window === "object";
  var ENVIRONMENT_IS_WORKER = typeof importScripts === "function";
  var emglobal = ENVIRONMENT_IS_WORKER ? self : ENVIRONMENT_IS_WEB ? window : global;
  if (!emglobal["require"]) {
    emglobal["require"] = (modpath) => {
      if (modpath.endsWith(".js"))
        modpath = modpath.slice(-3);
      var modname = modpath.split("/").slice(-1)[0];
      var hasNamespace = emglobal[modname] != null;
      console.log("@@@ require", modname, modpath, hasNamespace);
      if (!hasNamespace) {
        exports = {};
        importScripts(`${modpath}.js`);
      }
      if (emglobal[modname] == null) {
        emglobal[modname] = exports;
      }
      return emglobal[modname];
    };
  }
  var _WASM_module_cache = {};
  var CACHE_WASM_MODULES = true;
  var wasmMemory;
  function getWASMMemory() {
    if (wasmMemory == null) {
      wasmMemory = new WebAssembly.Memory({
        "initial": 1024,
        "maximum": 16384
      });
    }
    return wasmMemory;
  }
  function getWASMModule(module_id) {
    var module = _WASM_module_cache[module_id];
    if (!module) {
      starttime();
      module = new WebAssembly.Module(wasmBlob[module_id]);
      if (CACHE_WASM_MODULES) {
        _WASM_module_cache[module_id] = module;
        delete wasmBlob[module_id];
      }
      endtime("module creation " + module_id);
    }
    return module;
  }
  function moduleInstFn(module_id) {
    return function(imports, ri) {
      var mod = getWASMModule(module_id);
      var inst = new WebAssembly.Instance(mod, imports);
      ri(inst);
      return inst.exports;
    };
  }
  var PLATFORM_PARAMS = {
    "vcs": {
      arch: "6502",
      code_start: 4096,
      code_size: 61440,
      data_start: 128,
      data_size: 128,
      wiz_rom_ext: ".a26",
      wiz_inc_dir: "2600",
      extra_link_files: ["atari2600.cfg"],
      cfgfile: "atari2600.cfg"
    },
    "mw8080bw": {
      arch: "z80",
      code_start: 0,
      rom_size: 8192,
      data_start: 8192,
      data_size: 1024,
      stack_end: 9216
    },
    "vicdual": {
      arch: "z80",
      code_start: 0,
      rom_size: 16416,
      data_start: 58368,
      data_size: 1024,
      stack_end: 59392
    },
    "galaxian": {
      arch: "z80",
      code_start: 0,
      rom_size: 16384,
      data_start: 16384,
      data_size: 1024,
      stack_end: 18432
    },
    "galaxian-scramble": {
      arch: "z80",
      code_start: 0,
      rom_size: 20512,
      data_start: 16384,
      data_size: 1024,
      stack_end: 18432
    },
    "williams": {
      arch: "6809",
      code_start: 0,
      rom_size: 49152,
      data_start: 38912,
      data_size: 10240,
      stack_end: 49152,
      set_stack_end: 49152,
      extra_link_files: ["williams.scr", "libcmoc-crt-vec.a", "libcmoc-std-vec.a"],
      extra_link_args: ["-swilliams.scr", "-lcmoc-crt-vec", "-lcmoc-std-vec"],
      extra_compile_files: ["assert.h", "cmoc.h", "stdarg.h", "stdlib.h"]
    },
    "williams-defender": {
      arch: "6809",
      code_start: 0,
      rom_size: 49152,
      data_start: 38912,
      data_size: 10240,
      stack_end: 49152
    },
    "williams-z80": {
      arch: "z80",
      code_start: 0,
      rom_size: 38912,
      data_start: 38912,
      data_size: 10240,
      stack_end: 49152
    },
    "vector-z80color": {
      arch: "z80",
      code_start: 0,
      rom_size: 32768,
      data_start: 57344,
      data_size: 8192,
      stack_end: 0
    },
    "vector-ataricolor": {
      arch: "6502",
      define: ["__VECTOR__"],
      cfgfile: "vector-color.cfg",
      libargs: ["crt0.o", "none.lib"],
      extra_link_files: ["crt0.o", "vector-color.cfg"]
    },
    "sound_williams-z80": {
      arch: "z80",
      code_start: 0,
      rom_size: 16384,
      data_start: 16384,
      data_size: 1024,
      stack_end: 32768
    },
    "base_z80": {
      arch: "z80",
      code_start: 0,
      rom_size: 32768,
      data_start: 32768,
      data_size: 32768,
      stack_end: 0
    },
    "coleco": {
      arch: "z80",
      rom_start: 32768,
      code_start: 33024,
      rom_size: 32768,
      data_start: 28672,
      data_size: 1024,
      stack_end: 32768,
      extra_preproc_args: ["-I", "/share/include/coleco", "-D", "CV_CV"],
      extra_link_args: ["-k", "/share/lib/coleco", "-l", "libcv", "-l", "libcvu", "crt0.rel"]
    },
    "msx": {
      arch: "z80",
      rom_start: 16384,
      code_start: 16384,
      rom_size: 32768,
      data_start: 49152,
      data_size: 12288,
      stack_end: 65535,
      extra_link_args: ["crt0-msx.rel"],
      extra_link_files: ["crt0-msx.rel", "crt0-msx.lst"],
      wiz_sys_type: "z80",
      wiz_inc_dir: "msx"
    },
    "msx-libcv": {
      arch: "z80",
      rom_start: 16384,
      code_start: 16384,
      rom_size: 32768,
      data_start: 49152,
      data_size: 12288,
      stack_end: 65535,
      extra_preproc_args: ["-I", ".", "-D", "CV_MSX"],
      extra_link_args: ["-k", ".", "-l", "libcv-msx", "-l", "libcvu-msx", "crt0-msx.rel"],
      extra_link_files: ["libcv-msx.lib", "libcvu-msx.lib", "crt0-msx.rel", "crt0-msx.lst"],
      extra_compile_files: ["cv.h", "cv_graphics.h", "cv_input.h", "cv_sound.h", "cv_support.h", "cvu.h", "cvu_c.h", "cvu_compression.h", "cvu_f.h", "cvu_graphics.h", "cvu_input.h", "cvu_sound.h"]
    },
    "sms-sg1000-libcv": {
      arch: "z80",
      rom_start: 0,
      code_start: 256,
      rom_size: 49152,
      data_start: 49152,
      data_size: 1024,
      stack_end: 57344,
      extra_preproc_args: ["-I", ".", "-D", "CV_SMS"],
      extra_link_args: ["-k", ".", "-l", "libcv-sms", "-l", "libcvu-sms", "crt0-sms.rel"],
      extra_link_files: ["libcv-sms.lib", "libcvu-sms.lib", "crt0-sms.rel", "crt0-sms.lst"],
      extra_compile_files: ["cv.h", "cv_graphics.h", "cv_input.h", "cv_sound.h", "cv_support.h", "cvu.h", "cvu_c.h", "cvu_compression.h", "cvu_f.h", "cvu_graphics.h", "cvu_input.h", "cvu_sound.h"]
    },
    "nes": {
      arch: "6502",
      define: ["__NES__"],
      cfgfile: "neslib2.cfg",
      libargs: [
        "crt0.o",
        "nes.lib",
        "neslib2.lib",
        "-D",
        "NES_MAPPER=0",
        "-D",
        "NES_PRG_BANKS=2",
        "-D",
        "NES_CHR_BANKS=1",
        "-D",
        "NES_MIRRORING=0"
      ],
      extra_link_files: ["crt0.o", "neslib2.lib", "neslib2.cfg", "nesbanked.cfg"],
      wiz_rom_ext: ".nes"
    },
    "apple2": {
      arch: "6502",
      define: ["__APPLE2__"],
      cfgfile: "apple2.cfg",
      libargs: ["--lib-path", "/share/target/apple2/drv", "-D", "__EXEHDR__=0", "apple2.lib"],
      __CODE_RUN__: 16384,
      code_start: 2051
    },
    "apple2-e": {
      arch: "6502",
      define: ["__APPLE2__"],
      cfgfile: "apple2.cfg",
      libargs: ["apple2.lib"]
    },
    "atari8-800xl.disk": {
      arch: "6502",
      define: ["__ATARI__"],
      cfgfile: "atari.cfg",
      libargs: ["atari.lib"],
      fastbasic_cfgfile: "fastbasic-cart.cfg"
    },
    "atari8-800xl": {
      arch: "6502",
      define: ["__ATARI__"],
      cfgfile: "atari-cart.cfg",
      libargs: ["atari.lib", "-D", "__CARTFLAGS__=4"],
      fastbasic_cfgfile: "fastbasic-cart.cfg"
    },
    "atari8-800": {
      arch: "6502",
      define: ["__ATARI__"],
      cfgfile: "atari-cart.cfg",
      libargs: ["atari.lib", "-D", "__CARTFLAGS__=4"],
      fastbasic_cfgfile: "fastbasic-cart.cfg"
    },
    "atari8-5200": {
      arch: "6502",
      define: ["__ATARI5200__"],
      cfgfile: "atari5200.cfg",
      libargs: ["atari5200.lib", "-D", "__CARTFLAGS__=255"],
      fastbasic_cfgfile: "fastbasic-cart.cfg"
    },
    "verilog": {
      arch: "verilog",
      extra_compile_files: ["8bitworkshop.v"]
    },
    "astrocade": {
      arch: "z80",
      code_start: 8192,
      rom_size: 8192,
      data_start: 19984,
      data_size: 496,
      stack_end: 20480
    },
    "astrocade-arcade": {
      arch: "z80",
      code_start: 0,
      rom_size: 16384,
      data_start: 32224,
      data_size: 544,
      stack_end: 32768
    },
    "astrocade-bios": {
      arch: "z80",
      code_start: 0,
      rom_size: 8192,
      data_start: 20430,
      data_size: 50,
      stack_end: 20430
    },
    "atari7800": {
      arch: "6502",
      define: ["__ATARI7800__"],
      cfgfile: "atari7800.cfg",
      libargs: ["crt0.o", "none.lib"],
      extra_link_files: ["crt0.o", "atari7800.cfg"]
    },
    "c64": {
      arch: "6502",
      define: ["__CBM__", "__C64__"],
      cfgfile: "c64.cfg",
      libargs: ["c64.lib"]
    },
    "vic20": {
      arch: "6502",
      define: ["__CBM__", "__VIC20__"],
      cfgfile: "vic20.cfg",
      libargs: ["vic20.lib"]
    },
    "kim1": {
      arch: "6502"
    },
    "vectrex": {
      arch: "6809",
      code_start: 0,
      rom_size: 32768,
      data_start: 51328,
      data_size: 896,
      stack_end: 52224,
      extra_compile_files: ["assert.h", "cmoc.h", "stdarg.h", "vectrex.h", "stdlib.h", "bios.h"],
      extra_link_files: ["vectrex.scr", "libcmoc-crt-vec.a", "libcmoc-std-vec.a"],
      extra_compile_args: ["--vectrex"],
      extra_link_args: ["-svectrex.scr", "-lcmoc-crt-vec", "-lcmoc-std-vec"]
    },
    "x86": {
      arch: "x86"
    },
    "zx": {
      arch: "z80",
      code_start: 23755,
      rom_size: 65368 - 23755,
      data_start: 61440,
      data_size: 65024 - 61440,
      stack_end: 65368,
      extra_link_args: ["crt0-zx.rel"],
      extra_link_files: ["crt0-zx.rel", "crt0-zx.lst"]
    },
    "devel-6502": {
      arch: "6502",
      cfgfile: "devel-6502.cfg",
      libargs: ["crt0.o", "none.lib"],
      extra_link_files: ["crt0.o", "devel-6502.cfg"]
    },
    "cpc.rslib": {
      arch: "z80",
      code_start: 16384,
      rom_size: 45312 - 16384,
      data_start: 45312,
      data_size: 45312 - 49152,
      stack_end: 49152,
      extra_compile_files: ["cpcrslib.h"],
      extra_link_args: ["crt0-cpc.rel", "cpcrslib.lib"],
      extra_link_files: ["crt0-cpc.rel", "crt0-cpc.lst", "cpcrslib.lib", "cpcrslib.lst"]
    },
    "cpc": {
      arch: "z80",
      code_start: 16384,
      rom_size: 45312 - 16384,
      data_start: 45312,
      data_size: 45312 - 49152,
      stack_end: 49152,
      extra_compile_files: ["cpctelera.h"],
      extra_link_args: ["crt0-cpc.rel", "cpctelera.lib"],
      extra_link_files: ["crt0-cpc.rel", "crt0-cpc.lst", "cpctelera.lib", "cpctelera.lst"]
    }
  };
  PLATFORM_PARAMS["sms-sms-libcv"] = PLATFORM_PARAMS["sms-sg1000-libcv"];
  PLATFORM_PARAMS["sms-gg-libcv"] = PLATFORM_PARAMS["sms-sms-libcv"];
  var _t1;
  function starttime() {
    _t1 = new Date();
  }
  function endtime(msg) {
    var _t2 = new Date();
    console.log(msg, _t2.getTime() - _t1.getTime(), "ms");
  }
  var FileWorkingStore = class {
    constructor() {
      this.workfs = {};
      this.workerseq = 0;
      this.reset();
    }
    reset() {
      this.workfs = {};
      this.newVersion();
    }
    currentVersion() {
      return this.workerseq;
    }
    newVersion() {
      let ts = new Date().getTime();
      if (ts <= this.workerseq)
        ts = ++this.workerseq;
      return ts;
    }
    putFile(path, data) {
      var encoding = typeof data === "string" ? "utf8" : "binary";
      var entry = this.workfs[path];
      if (!entry || !compareData(entry.data, data) || entry.encoding != encoding) {
        this.workfs[path] = entry = { path, data, encoding, ts: this.newVersion() };
        console.log("+++", entry.path, entry.encoding, entry.data.length, entry.ts);
      }
      return entry;
    }
    hasFile(path) {
      return this.workfs[path] != null;
    }
    getFileData(path) {
      return this.workfs[path] && this.workfs[path].data;
    }
    getFileAsString(path) {
      let data = this.getFileData(path);
      if (data != null && typeof data !== "string")
        throw new Error(`${path}: expected string`);
      return data;
    }
    getFileEntry(path) {
      return this.workfs[path];
    }
    setItem(key, value) {
      this.items[key] = value;
    }
  };
  var store = new FileWorkingStore();
  function errorResult(msg) {
    return { errors: [{ line: 0, msg }] };
  }
  var Builder = class {
    constructor() {
      this.steps = [];
      this.startseq = 0;
    }
    wasChanged(entry) {
      return entry.ts > this.startseq;
    }
    async executeBuildSteps() {
      this.startseq = store.currentVersion();
      var linkstep = null;
      while (this.steps.length) {
        var step = this.steps.shift();
        var platform = step.platform;
        var toolfn = TOOLS[step.tool];
        if (!toolfn)
          throw Error("no tool named " + step.tool);
        step.params = PLATFORM_PARAMS[getBasePlatform(platform)];
        try {
          step.result = await toolfn(step);
        } catch (e) {
          console.log("EXCEPTION", e, e.stack);
          return errorResult(e + "");
        }
        if (step.result) {
          step.result.params = step.params;
          if (step.debuginfo) {
            let r = step.result;
            if (!r.debuginfo)
              r.debuginfo = {};
            Object.assign(r.debuginfo, step.debuginfo);
          }
          if ("errors" in step.result && step.result.errors.length) {
            applyDefaultErrorPath(step.result.errors, step.path);
            return step.result;
          }
          if ("output" in step.result && step.result.output) {
            return step.result;
          }
          if ("linktool" in step.result) {
            if (linkstep) {
              linkstep.files = linkstep.files.concat(step.result.files);
              linkstep.args = linkstep.args.concat(step.result.args);
            } else {
              linkstep = {
                tool: step.result.linktool,
                platform,
                files: step.result.files,
                args: step.result.args
              };
            }
            linkstep.debuginfo = step.debuginfo;
          }
          if ("nexttool" in step.result) {
            var asmstep = __spreadValues({
              tool: step.result.nexttool,
              platform
            }, step.result);
            this.steps.push(asmstep);
          }
          if (this.steps.length == 0 && linkstep) {
            this.steps.push(linkstep);
            linkstep = null;
          }
        }
      }
    }
    async handleMessage(data) {
      this.steps = [];
      if (data.updates) {
        data.updates.forEach((u) => store.putFile(u.path, u.data));
      }
      if (data.setitems) {
        data.setitems.forEach((i) => store.setItem(i.key, i.value));
      }
      if (data.buildsteps) {
        this.steps.push.apply(this.steps, data.buildsteps);
      }
      if (data.code) {
        this.steps.push(data);
      }
      if (this.steps.length) {
        var result = await this.executeBuildSteps();
        return result ? result : { unchanged: true };
      }
      console.log("Unknown message", data);
    }
  };
  var builder = new Builder();
  function applyDefaultErrorPath(errors, path) {
    if (!path)
      return;
    for (var i = 0; i < errors.length; i++) {
      var err = errors[i];
      if (!err.path && err.line)
        err.path = path;
    }
  }
  function compareData(a, b) {
    if (a.length != b.length)
      return false;
    if (typeof a === "string" && typeof b === "string") {
      return a == b;
    } else {
      for (var i = 0; i < a.length; i++) {
        if (a[i] != b[i])
          return false;
      }
      return true;
    }
  }
  function putWorkFile(path, data) {
    return store.putFile(path, data);
  }
  function getWorkFileAsString(path) {
    return store.getFileAsString(path);
  }
  function populateEntry(fs, path, entry, options) {
    var data = entry.data;
    if (options && options.processFn) {
      data = options.processFn(path, data);
    }
    var toks = path.split("/");
    if (toks.length > 1) {
      for (var i = 0; i < toks.length - 1; i++)
        try {
          fs.mkdir(toks[i]);
        } catch (e) {
        }
    }
    fs.writeFile(path, data, { encoding: entry.encoding });
    var time = new Date(entry.ts);
    fs.utime(path, time, time);
    console.log("<<<", path, entry.data.length);
  }
  function gatherFiles(step, options) {
    var maxts = 0;
    if (step.files) {
      for (var i = 0; i < step.files.length; i++) {
        var path = step.files[i];
        var entry = store.workfs[path];
        if (!entry) {
          throw new Error("No entry for path '" + path + "'");
        } else {
          maxts = Math.max(maxts, entry.ts);
        }
      }
    } else if (step.code) {
      var path = step.path ? step.path : options.mainFilePath;
      if (!path)
        throw Error("need path or mainFilePath");
      var code = step.code;
      var entry = putWorkFile(path, code);
      step.path = path;
      step.files = [path];
      maxts = entry.ts;
    } else if (step.path) {
      var path = step.path;
      var entry = store.workfs[path];
      maxts = entry.ts;
      step.files = [path];
    }
    if (step.path && !step.prefix) {
      step.prefix = getPrefix(step.path);
    }
    step.maxts = maxts;
    return maxts;
  }
  function getPrefix(s) {
    var pos = s.lastIndexOf(".");
    return pos > 0 ? s.substring(0, pos) : s;
  }
  function populateFiles(step, fs, options) {
    gatherFiles(step, options);
    if (!step.files)
      throw Error("call gatherFiles() first");
    for (var i = 0; i < step.files.length; i++) {
      var path = step.files[i];
      populateEntry(fs, path, store.workfs[path], options);
    }
  }
  function populateExtraFiles(step, fs, extrafiles) {
    if (extrafiles) {
      for (var i = 0; i < extrafiles.length; i++) {
        var xfn = extrafiles[i];
        if (store.workfs[xfn]) {
          fs.writeFile(xfn, store.workfs[xfn].data, { encoding: "binary" });
          continue;
        }
        var xpath = "lib/" + getBasePlatform(step.platform) + "/" + xfn;
        var xhr = new XMLHttpRequest();
        xhr.responseType = "arraybuffer";
        xhr.open("GET", PWORKER + xpath, false);
        xhr.send(null);
        if (xhr.response && xhr.status == 200) {
          var data = new Uint8Array(xhr.response);
          fs.writeFile(xfn, data, { encoding: "binary" });
          putWorkFile(xfn, data);
          console.log(":::", xfn, data.length);
        } else {
          throw Error("Could not load extra file " + xpath);
        }
      }
    }
  }
  function staleFiles(step, targets) {
    if (!step.maxts)
      throw Error("call populateFiles() first");
    for (var i = 0; i < targets.length; i++) {
      var entry = store.workfs[targets[i]];
      if (!entry || step.maxts > entry.ts)
        return true;
    }
    console.log("unchanged", step.maxts, targets);
    return false;
  }
  function anyTargetChanged(step, targets) {
    if (!step.maxts)
      throw Error("call populateFiles() first");
    for (var i = 0; i < targets.length; i++) {
      var entry = store.workfs[targets[i]];
      if (!entry || entry.ts > step.maxts)
        return true;
    }
    console.log("unchanged", step.maxts, targets);
    return false;
  }
  function execMain(step, mod, args) {
    starttime();
    var run = mod.callMain || mod.run;
    run(args);
    endtime(step.tool);
  }
  var fsMeta = {};
  var fsBlob = {};
  var wasmBlob = {};
  var PSRC = "../../src/";
  var PWORKER = PSRC + "worker/";
  function loadFilesystem(name) {
    var xhr = new XMLHttpRequest();
    xhr.responseType = "blob";
    xhr.open("GET", PWORKER + "fs/fs" + name + ".data", false);
    xhr.send(null);
    fsBlob[name] = xhr.response;
    xhr = new XMLHttpRequest();
    xhr.responseType = "json";
    xhr.open("GET", PWORKER + "fs/fs" + name + ".js.metadata", false);
    xhr.send(null);
    fsMeta[name] = xhr.response;
    console.log("Loaded " + name + " filesystem", fsMeta[name].files.length, "files", fsBlob[name].size, "bytes");
  }
  var loaded = {};
  function load(modulename, debug2) {
    if (!loaded[modulename]) {
      importScripts(PWORKER + "asmjs/" + modulename + (debug2 ? "." + debug2 + ".js" : ".js"));
      loaded[modulename] = 1;
    }
  }
  function loadWASM(modulename, debug2) {
    if (!loaded[modulename]) {
      importScripts(PWORKER + "wasm/" + modulename + (debug2 ? "." + debug2 + ".js" : ".js"));
      var xhr = new XMLHttpRequest();
      xhr.responseType = "arraybuffer";
      xhr.open("GET", PWORKER + "wasm/" + modulename + ".wasm", false);
      xhr.send(null);
      if (xhr.response) {
        wasmBlob[modulename] = new Uint8Array(xhr.response);
        console.log("Loaded " + modulename + ".wasm (" + wasmBlob[modulename].length + " bytes)");
        loaded[modulename] = 1;
      } else {
        throw Error("Could not load WASM file " + modulename + ".wasm");
      }
    }
  }
  function loadNative(modulename) {
    if (CACHE_WASM_MODULES && typeof WebAssembly === "object") {
      loadWASM(modulename);
    } else {
      load(modulename);
    }
  }
  function setupFS(FS, name) {
    var WORKERFS = FS.filesystems["WORKERFS"];
    if (name === "65-vector")
      name = "65-none";
    if (name === "65-atari7800")
      name = "65-none";
    if (name === "65-devel")
      name = "65-none";
    if (name === "65-vcs")
      name = "65-none";
    if (!fsMeta[name])
      throw Error("No filesystem for '" + name + "'");
    FS.mkdir("/share");
    FS.mount(WORKERFS, {
      packages: [{ metadata: fsMeta[name], blob: fsBlob[name] }]
    }, "/share");
    var reader = WORKERFS.reader;
    var blobcache = {};
    WORKERFS.stream_ops.read = function(stream, buffer, offset, length, position) {
      if (position >= stream.node.size)
        return 0;
      var contents = blobcache[stream.path];
      if (!contents) {
        var ab = reader.readAsArrayBuffer(stream.node.contents);
        contents = blobcache[stream.path] = new Uint8Array(ab);
      }
      if (position + length > contents.length)
        length = contents.length - position;
      for (var i = 0; i < length; i++) {
        buffer[offset + i] = contents[position + i];
      }
      return length;
    };
  }
  var print_fn = function(s) {
    console.log(s);
  };
  var re_msvc = /[/]*([^( ]+)\s*[(](\d+)[)]\s*:\s*(.+?):\s*(.*)/;
  var re_msvc2 = /\s*(at)\s+(\d+)\s*(:)\s*(.*)/;
  function msvcErrorMatcher(errors) {
    return function(s) {
      var matches = re_msvc.exec(s) || re_msvc2.exec(s);
      if (matches) {
        var errline = parseInt(matches[2]);
        errors.push({
          line: errline,
          path: matches[1],
          msg: matches[4]
        });
      } else {
        console.log(s);
      }
    };
  }
  function makeErrorMatcher(errors, regex, iline, imsg, mainpath, ifilename) {
    return function(s) {
      var matches = regex.exec(s);
      if (matches) {
        errors.push({
          line: parseInt(matches[iline]) || 1,
          msg: matches[imsg],
          path: ifilename ? matches[ifilename] : mainpath
        });
      } else {
        console.log("??? " + s);
      }
    };
  }
  function extractErrors(regex, strings, path, iline, imsg, ifilename) {
    var errors = [];
    var matcher = makeErrorMatcher(errors, regex, iline, imsg, path, ifilename);
    for (var i = 0; i < strings.length; i++) {
      matcher(strings[i]);
    }
    return errors;
  }
  var re_crlf = /\r?\n/;
  var re_lineoffset = /\s*(\d+)\s+[%]line\s+(\d+)\+(\d+)\s+(.+)/;
  function parseListing(code, lineMatch, iline, ioffset, iinsns, icycles, funcMatch, segMatch) {
    var lines = [];
    var lineofs = 0;
    var segment = "";
    var func = "";
    var funcbase = 0;
    code.split(re_crlf).forEach((line, lineindex) => {
      let segm = segMatch && segMatch.exec(line);
      if (segm) {
        segment = segm[1];
      }
      let funcm = funcMatch && funcMatch.exec(line);
      if (funcm) {
        funcbase = parseInt(funcm[1], 16);
        func = funcm[2];
      }
      var linem = lineMatch.exec(line);
      if (linem && linem[1]) {
        var linenum = iline < 0 ? lineindex : parseInt(linem[iline]);
        var offset = parseInt(linem[ioffset], 16);
        var insns = linem[iinsns];
        var cycles = icycles ? parseInt(linem[icycles]) : null;
        var iscode = cycles > 0;
        if (insns) {
          lines.push({
            line: linenum + lineofs,
            offset: offset - funcbase,
            insns,
            cycles,
            iscode,
            segment,
            func
          });
        }
      } else {
        let m = re_lineoffset.exec(line);
        if (m) {
          lineofs = parseInt(m[2]) - parseInt(m[1]) - parseInt(m[3]);
        }
      }
    });
    return lines;
  }
  function parseSourceLines(code, lineMatch, offsetMatch, funcMatch, segMatch) {
    var lines = [];
    var lastlinenum = 0;
    var segment = "";
    var func = "";
    var funcbase = 0;
    for (var line of code.split(re_crlf)) {
      let segm = segMatch && segMatch.exec(line);
      if (segm) {
        segment = segm[1];
      }
      let funcm = funcMatch && funcMatch.exec(line);
      if (funcm) {
        funcbase = parseInt(funcm[1], 16);
        func = funcm[2];
      }
      var linem = lineMatch.exec(line);
      if (linem && linem[1]) {
        lastlinenum = parseInt(linem[1]);
      } else if (lastlinenum) {
        var linem = offsetMatch.exec(line);
        if (linem && linem[1]) {
          var offset = parseInt(linem[1], 16);
          lines.push({
            line: lastlinenum,
            offset: offset - funcbase,
            segment,
            func
          });
          lastlinenum = 0;
        }
      }
    }
    return lines;
  }
  function setupStdin(fs, code) {
    var i = 0;
    fs.init(function() {
      return i < code.length ? code.charCodeAt(i++) : null;
    });
  }
  function fixParamsWithDefines(path, params) {
    var libargs = params.libargs;
    if (path && libargs) {
      var code = getWorkFileAsString(path);
      if (code) {
        var oldcfgfile = params.cfgfile;
        var ident2index = {};
        for (var i = 0; i < libargs.length; i++) {
          var toks = libargs[i].split("=");
          if (toks.length == 2) {
            ident2index[toks[0]] = i;
          }
        }
        var re = /^[;]?#define\s+(\w+)\s+(\S+)/gmi;
        var m;
        while (m = re.exec(code)) {
          var ident = m[1];
          var value = m[2];
          var index = ident2index[ident];
          if (index >= 0) {
            libargs[index] = ident + "=" + value;
            console.log("Using libargs", index, libargs[index]);
            if (ident == "NES_MAPPER" && value == "4") {
              params.cfgfile = "nesbanked.cfg";
              console.log("using config file", params.cfgfile);
            }
          } else if (ident == "CFGFILE" && value) {
            params.cfgfile = value;
          } else if (ident == "LIBARGS" && value) {
            params.libargs = value.split(",").filter((s) => {
              return s != "";
            });
            console.log("Using libargs", params.libargs);
          } else if (ident == "CC65_FLAGS" && value) {
            params.extra_compiler_args = value.split(",").filter((s) => {
              return s != "";
            });
            console.log("Using compiler flags", params.extra_compiler_args);
          }
        }
      }
    }
  }
  function makeCPPSafe(s) {
    return s.replace(/[^A-Za-z0-9_]/g, "_");
  }
  function preprocessMCPP(step, filesys) {
    load("mcpp");
    var platform = step.platform;
    var params = PLATFORM_PARAMS[getBasePlatform(platform)];
    if (!params)
      throw Error("Platform not supported: " + platform);
    var errors = [];
    var match_fn = makeErrorMatcher(errors, /<stdin>:(\d+): (.+)/, 1, 2, step.path);
    var MCPP = emglobal.mcpp({
      noInitialRun: true,
      noFSInit: true,
      print: print_fn,
      printErr: match_fn
    });
    var FS = MCPP.FS;
    if (filesys)
      setupFS(FS, filesys);
    populateFiles(step, FS);
    populateExtraFiles(step, FS, params.extra_compile_files);
    var args = [
      "-D",
      "__8BITWORKSHOP__",
      "-D",
      "__SDCC_z80",
      "-D",
      makeCPPSafe(platform.toUpperCase()),
      "-I",
      "/share/include",
      "-Q",
      step.path,
      "main.i"
    ];
    if (step.mainfile) {
      args.unshift.apply(args, ["-D", "__MAIN__"]);
    }
    let platform_def = platform.toUpperCase().replaceAll(/[^a-zA-Z0-9]/g, "_");
    args.unshift.apply(args, ["-D", `__PLATFORM_${platform_def}__`]);
    if (params.extra_preproc_args) {
      args.push.apply(args, params.extra_preproc_args);
    }
    execMain(step, MCPP, args);
    if (errors.length)
      return { errors };
    var iout = FS.readFile("main.i", { encoding: "utf8" });
    iout = iout.replace(/^#line /gm, "\n# ");
    try {
      var errout = FS.readFile("mcpp.err", { encoding: "utf8" });
      if (errout.length) {
        var errors = extractErrors(/([^:]+):(\d+): (.+)/, errout.split("\n"), step.path, 2, 3, 1);
        if (errors.length == 0) {
          errors = errorResult(errout).errors;
        }
        return { errors };
      }
    } catch (e) {
    }
    return { code: iout };
  }
  function setupRequireFunction() {
    var exports2 = {};
    exports2["jsdom"] = {
      JSDOM: function(a, b) {
        this.window = {};
      }
    };
    emglobal["require"] = (modname) => {
      console.log("require", modname, exports2[modname] != null);
      return exports2[modname];
    };
  }
  var TOOLS = {
    "dasm": assembleDASM,
    "cc65": compileCC65,
    "ca65": assembleCA65,
    "ld65": linkLD65,
    "sdasz80": assembleSDASZ80,
    "sdldz80": linkSDLDZ80,
    "sdcc": compileSDCC,
    "xasm6809": assembleXASM6809,
    "cmoc": compileCMOC,
    "lwasm": assembleLWASM,
    "lwlink": linkLWLINK,
    "verilator": compileVerilator,
    "yosys": compileYosys,
    "jsasm": compileJSASMStep,
    "zmac": assembleZMAC,
    "nesasm": assembleNESASM,
    "smlrc": compileSmallerC,
    "yasm": assembleYASM,
    "bataribasic": compileBatariBasic,
    "markdown": translateShowdown,
    "inform6": compileInform6,
    "merlin32": assembleMerlin32,
    "fastbasic": compileFastBasic,
    "basic": compileBASIC,
    "silice": compileSilice,
    "wiz": compileWiz,
    "armips": assembleARMIPS,
    "vasmarm": assembleVASMARM,
    "ecs": assembleECS
  };
  var TOOL_PRELOADFS = {
    "cc65-apple2": "65-apple2",
    "ca65-apple2": "65-apple2",
    "cc65-c64": "65-c64",
    "ca65-c64": "65-c64",
    "cc65-vic20": "65-vic20",
    "ca65-vic20": "65-vic20",
    "cc65-nes": "65-nes",
    "ca65-nes": "65-nes",
    "cc65-atari8": "65-atari8",
    "ca65-atari8": "65-atari8",
    "cc65-vector": "65-none",
    "ca65-vector": "65-none",
    "cc65-atari7800": "65-none",
    "ca65-atari7800": "65-none",
    "cc65-devel": "65-none",
    "ca65-devel": "65-none",
    "ca65-vcs": "65-none",
    "sdasz80": "sdcc",
    "sdcc": "sdcc",
    "sccz80": "sccz80",
    "bataribasic": "2600basic",
    "inform6": "inform",
    "fastbasic": "65-atari8",
    "silice": "Silice",
    "wiz": "wiz",
    "ecs-vcs": "65-none",
    "ecs-nes": "65-nes",
    "ecs-c64": "65-c64"
  };
  async function handleMessage(data) {
    if (data.preload) {
      var fs = TOOL_PRELOADFS[data.preload];
      if (!fs && data.platform)
        fs = TOOL_PRELOADFS[data.preload + "-" + getBasePlatform(data.platform)];
      if (!fs && data.platform)
        fs = TOOL_PRELOADFS[data.preload + "-" + getRootBasePlatform(data.platform)];
      if (fs && !fsMeta[fs])
        loadFilesystem(fs);
      return;
    }
    if (data.reset) {
      store.reset();
      return;
    }
    return builder.handleMessage(data);
  }
  if (ENVIRONMENT_IS_WORKER) {
    lastpromise = null;
    onmessage = async function(e) {
      await lastpromise;
      lastpromise = handleMessage(e.data);
      var result = await lastpromise;
      lastpromise = null;
      if (result) {
        try {
          postMessage(result);
        } catch (e2) {
          console.log(e2);
          postMessage(errorResult(`${e2}`));
        }
      }
    };
  }
  var lastpromise;
})();
//# sourceMappingURL=bundle.js.map
