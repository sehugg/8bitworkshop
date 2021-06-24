
type AssemblerVar = {
  bits : number,
  toks : string[],
  iprel? : boolean,
  ipofs? : number,
  ipmul? : number,
}

type AssemblerRuleSlice = {
  a : number; // argument index
  b : number; // bit index
  n : number; // # of bits
}

type AssemblerRule = {
  fmt : string,
  bits : (string | number | AssemblerRuleSlice)[],
  // added at runtime
  re? : RegExp,
  prefix? : string,
  varlist? : string[]
}

type AssemblerVarList = {[name:string] : AssemblerVar};

type AssemblerLine = {line:number, offset:number, nbits:number, insns?:string};

type AssemblerFixup = {
  sym:string,
  ofs:number,
  size:number;
  srcofs:number,
  dstofs:number,
  dstlen:number,
  line:number,
  iprel:boolean,
  ipofs:number,
  ipmul:number,
};

type AssemblerSpec = {
  name : string,
  width : number,
  vars : AssemblerVarList,
  rules : AssemblerRule[]
}

type AssemblerInstruction = {opcode:number, nbits : number};
type AssemblerErrorResult = {error:string};
type AssemblerLineResult = AssemblerErrorResult | AssemblerInstruction;

type AssemblerError = {msg:string, line:number};

type AssemblerState = {
  ip: number,
  line: number,
  origin: number,
  codelen: number,
  intermediate: any,
  output: number[],
  lines: AssemblerLine[],
  errors: AssemblerError[],
  fixups: AssemblerFixup[]
}

const isError = (o: AssemblerLineResult): o is AssemblerErrorResult => (<AssemblerErrorResult>o).error !== undefined

function hex(v:number, nd:number) {
  try {
    if (!nd) nd = 2;
    if (nd == 8) {
      return hex((v>>16)&0xffff,4) + hex(v&0xffff,4);
    }
    var s = v.toString(16).toUpperCase();
    while (s.length < nd)
      s = "0" + s;
    return s;
  } catch (e) {
    return v+"";
  }
}

function stringToData(s:string) : number[] {
  var data = [];
  for (var i=0; i<s.length; i++) {
    data[i] = s.charCodeAt(i);
  }
  return data;
}


export class Assembler {
  spec : AssemblerSpec;
  ip = 0;
  origin = 0;
  linenum = 0;
  symbols : {[name:string] : {value:number}} = {};
  errors : AssemblerError[] = [];
  outwords : number[] = [];
  asmlines : AssemblerLine[] = [];
  fixups : AssemblerFixup[] = [];
  width = 8;
  codelen = 0;
  aborted = false;
  
  constructor(spec : AssemblerSpec) {
    this.spec = spec;
    if (spec) {
      this.preprocessRules();
    }
  }

  rule2regex(rule : AssemblerRule, vars : AssemblerVarList) {
    var s = rule.fmt;
    if (!s || !(typeof s === 'string'))
      throw Error('Each rule must have a "fmt" string field');
    if (!rule.bits || !(rule.bits instanceof Array))
      throw Error('Each rule must have a "bits" array field');
    var varlist = [];
    rule.prefix = s.split(/\s+/)[0];
    s = s.replace(/\+/g, '\\+');
    s = s.replace(/\*/g, '\\*');
    s = s.replace(/\s+/g, '\\s+');
    s = s.replace(/\[/g, '\\[');
    s = s.replace(/\]/g, '\\]');
    s = s.replace(/\(/g, '\\(');
    s = s.replace(/\)/g, '\\)');
    s = s.replace(/\./g, '\\.');
    // TODO: more escapes?
    s = s.replace(/~\w+/g, (varname:string) => {
      varname = varname.substr(1);
      var v = vars[varname];
      varlist.push(varname);
      if (!v)
        throw Error('Could not find variable definition for "~' + varname + '"');
      else if (v.toks)
        return '(\\w+)';
      else
        return '([0-9]+|[$][0-9a-f]+|\\w+)';
    });
    try {
      rule.re = new RegExp('^'+s+'$', 'i');
    } catch (e) {
      throw Error("Bad regex for rule \"" + rule.fmt + "\": /" + s + "/ -- " + e);
    }
    rule.varlist = varlist;
    // TODO: check rule constraints
    return rule;
  }

  preprocessRules() {
    if (this.spec.width) {
      this.width = this.spec.width|0;
    }
    for (var rule of this.spec.rules) {
      this.rule2regex(rule, this.spec.vars);
    }
  }
  warning(msg:string, line?:number) {
    this.errors.push({msg:msg, line:line?line:this.linenum});
  }
  fatal(msg:string, line?:number) {
    this.warning(msg, line);
    this.aborted = true;
  }
  fatalIf(msg?:string, line?:number) {
    if (msg) this.fatal(msg, line);
  }
  addBytes(result:AssemblerInstruction) {
    this.asmlines.push({
      line:this.linenum,
      offset:this.ip,
      nbits:result.nbits
    });
    var op = result.opcode;
    var nb = result.nbits/this.width;
    for (var i=0; i<nb; i++) {
      if (this.width < 32)
        this.outwords[this.ip++ - this.origin] = (op >> (nb-1-i)*this.width) & ((1<<this.width)-1);
      else
        this.outwords[this.ip++ - this.origin] = op;
    }
  }
  addWords(data:number[]) {
    this.asmlines.push({
      line:this.linenum,
      offset:this.ip,
      nbits:this.width*data.length
    });
    for (var i=0; i<data.length; i++) {
      if (this.width < 32)
        this.outwords[this.ip++ - this.origin] = data[i] & ((1<<this.width)-1);
      else
        this.outwords[this.ip++ - this.origin] = data[i];
    }
  }

  parseData(toks:string[]) : number[] {
    var data = [];
    for (var i=0; i<toks.length; i++) {
      data[i] = this.parseConst(toks[i]);
    }
    return data;
  }

  alignIP(align) {
    if (align < 1 || align > this.codelen)
      this.fatal("Invalid alignment value");
    else
      this.ip = Math.floor((this.ip+align-1)/align)*align;
  }

  parseConst(s:string, nbits?:number) : number {
    // TODO: check bit length
    if (s && s[0] == '$')
      return parseInt(s.substr(1), 16);
    else
      return parseInt(s);
  }

  buildInstruction(rule:AssemblerRule, m:string[]) : AssemblerLineResult {
    var opcode = 0;
    var oplen = 0;
    // iterate over each component of the rule output ("bits")
    for (var b of rule.bits) {
      var n,x;
      // is a string? then it's a bit constant
      // TODO
      if (typeof b === "string") {
        n = b.length;
        x = parseInt(b,2);
      } else {
        // is it a slice {a,b,n} or just a number?
        var index = typeof b === "number" ? b : b.a;
        // it's an indexed variable, look up its variable
        var id = m[index+1];
        var v = this.spec.vars[rule.varlist[index]];
        if (!v) {
          return {error:`Could not find matching identifier for '${m[0]}' index ${index}`};
        }
        n = v.bits;
        var shift = 0;
        if (typeof b !== "number") {
          n = b.n;
          shift = b.b;
        }
        // is it an enumerated type? look up the index of its keyword
        if (v.toks) {
          x = v.toks.indexOf(id);
          if (x < 0)
            return {error:"Can't use '" + id + "' here, only one of: " + v.toks.join(', ')};
        } else {
          // otherwise, parse it as a constant
          x = this.parseConst(id, n);
          // is it a label? add fixup
          if (isNaN(x)) {
            this.fixups.push({
              sym:id, ofs:this.ip, size:v.bits, line:this.linenum,
              dstlen:n, dstofs:oplen, srcofs:shift,
              iprel:!!v.iprel, ipofs:(v.ipofs+0), ipmul:v.ipmul||1
            });
            x = 0;
          } else {
            var mask = (1<<v.bits)-1;
            if ((x&mask) != x)
              return {error:"Value " + x + " does not fit in " + v.bits + " bits"};
          }
        }
        if (typeof b !== "number") {
          x = (x >>> shift) & ((1 << b.n)-1);
        }
      }
      opcode = (opcode << n) | x;
      oplen += n;
    }
    if (oplen == 0)
      this.warning("Opcode had zero length");
    else if (oplen > 32)
      this.warning("Opcodes > 32 bits not supported");
    else if ((oplen % this.width) != 0)
      this.warning("Opcode was not word-aligned (" + oplen + " bits)");
    return {opcode:opcode, nbits:oplen};
  }

  loadArch(arch:string) : string {
    if (this.loadJSON) {
      var json = this.loadJSON(arch + ".json");
      if (json && json.vars && json.rules) {
        this.spec = json;
        this.preprocessRules();
      } else {
        return ("Could not load arch file '" + arch + ".json'");
      }
    }
  }

  parseDirective(tokens) {
    var cmd = tokens[0].toLowerCase();
    if (cmd == '.define')
      this.symbols[tokens[1].toLowerCase()] = {value:tokens[2]};
    else if (cmd == '.org')
      this.ip = this.origin = parseInt(tokens[1]);
    else if (cmd == '.len')
      this.codelen = parseInt(tokens[1]);
    else if (cmd == '.width')
      this.width = parseInt(tokens[1]);
    else if (cmd == '.arch')
      this.fatalIf(this.loadArch(tokens[1]));
    else if (cmd == '.include')
      this.fatalIf(this.loadInclude(tokens[1]));
    else if (cmd == '.module')
      this.fatalIf(this.loadModule(tokens[1]));
    else if (cmd == '.data')
      this.addWords(this.parseData(tokens.slice(1)));
    else if (cmd == '.string')
      this.addWords(stringToData(tokens.slice(1).join(' ')));
    else if (cmd == '.align')
      this.alignIP(this.parseConst(tokens[1]));
    else
      this.warning("Unrecognized directive: " + tokens);
  }

  assemble(line:string) : AssemblerInstruction {
    this.linenum++;
    // remove comments
    line = line.replace(/[;].*/g, '').trim();
    // is it a directive?
    if (line[0] == '.') {
      var tokens = line.split(/\s+/);
      this.parseDirective(tokens);
      return;
    }
    // make it lowercase
    line = line.toLowerCase();
    // find labels
    line = line.replace(/(\w+):/, (_label, label) => {
      this.symbols[label] = {value:this.ip};
      return ''; // replace label with blank
    });
    line = line.trim();
    if (line == '')
      return; // empty line
    // look at each rule in order
    if (!this.spec) { this.fatal("Need to load .arch first"); return; }
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
    this.warning(lastError ? lastError : ("Could not decode instruction: " + line));
  }

  finish() : AssemblerState {
    // apply fixups
    for (var i=0; i<this.fixups.length; i++) {
      var fix = this.fixups[i];
      var sym = this.symbols[fix.sym];
      if (sym) {
        var ofs = fix.ofs + Math.floor(fix.dstofs/this.width);
        var mask = ((1<<fix.size)-1);
        var value = this.parseConst(sym.value+"", fix.dstlen);
        if (fix.iprel)
          value = (value - fix.ofs) * fix.ipmul - fix.ipofs;
        if (fix.srcofs == 0 && (value > mask || value < -mask))
          this.warning("Symbol " + fix.sym + " (" + value + ") does not fit in " + fix.dstlen + " bits", fix.line);
        //console.log(hex(value,8), fix.srcofs, fix.dstofs, fix.dstlen);
        if (fix.srcofs > 0)
          value >>>= fix.srcofs;
        value &= (1 << fix.dstlen) - 1;
        // TODO: make it work for all widths
        if (this.width == 32) {
          var shift = 32 - fix.dstofs - fix.dstlen;
          value <<= shift;
          //console.log(fix, shift, fix.dstlen, hex(value,8));
        }
        // TODO: check range
        // TODO: span multiple words?
        if (value & this.outwords[ofs - this.origin]) {
          //this.warning("Instruction bits overlapped: " + hex(this.outwords[ofs - this.origin],8), hex(value,8));
        }
        this.outwords[ofs - this.origin] ^= value; // TODO: << shift?
      } else {
        this.warning("Symbol '" + fix.sym + "' not found");
      }
    }
    // update asmlines
    for (var i=0; i<this.asmlines.length; i++) {
      var al = this.asmlines[i];
      al.insns = '';
      for (var j=0; j<al.nbits/this.width; j++) {
        var word = this.outwords[al.offset + j - this.origin];
        if (j>0) al.insns += ' ';
        al.insns += hex(word,this.width/4);
      }
    }
    while (this.outwords.length < this.codelen) {
      this.outwords.push(0);
    }
    this.fixups = [];
    return this.state();
  }

  assembleFile(text) : AssemblerState {
    var lines = text.split(/\n/g);
    for (var i=0; i<lines.length && !this.aborted; i++) {
      try {
        this.assemble(lines[i]);
      } catch (e) {
        console.log(e);
        this.fatal("Exception during assembly: " + e);
      }
    }
    return this.finish();
  }

  state() : AssemblerState {
    return {ip:this.ip, line:this.linenum, origin:this.origin, codelen:this.codelen,
      intermediate:{}, // TODO: listing, symbols?
      output:this.outwords,
      lines:this.asmlines,
      errors:this.errors,
      fixups:this.fixups};
  }
  
  // methods to implement in subclass
  
  loadJSON : (path : string) => any;
  loadInclude : (path : string) => string;
  loadModule : (path : string) => string;
}

