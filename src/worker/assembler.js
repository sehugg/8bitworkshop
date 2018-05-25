
EXAMPLE_SPEC = {
  name:'femto8',
  vars:{
    reg:{bits:2, toks:['a', 'b', 'ip', 'none']},
    unop:{bits:3, toks:['mova','movb','inc','dec','asl','lsr','rol','ror']},
    binop:{bits:3, toks:['or','and','xor','zero','add','sub','adc','sbb']},
    imm4:{bits:4},
    imm8:{bits:8},
    rel:{bits:8, iprel:true, ipofs:1},
  },
  rules:[
    {fmt:'~binop ~reg,b', bits:['00',1,'1',0]},
    {fmt:'~binop ~reg,#~imm8', bits:['01',1,'1',0,2]},
    {fmt:'~binop ~reg,[b]', bits:['11',1,'1',0]},
    {fmt:'~unop ~reg', bits:['00',1,'0',0]},
    {fmt:'mov ~reg,[b]', bits:['11',0,'0001']},
    {fmt:'zero ~reg', bits:['00',0,'1011']},
    {fmt:'lda #~imm8', bits:['01','00','0001',0]},
    {fmt:'ldb #~imm8', bits:['01','01','0001',0]},
    {fmt:'jmp ~imm8',  bits:['01','10','0001',0]},
    {fmt:'sta ~imm4',  bits:['1001',0]},
    {fmt:'bcc ~imm8', bits:['1010','0001',0]},
    {fmt:'bcs ~imm8', bits:['1010','0011',0]},
    {fmt:'bz ~imm8',  bits:['1010','1100',0]},
    {fmt:'bnz ~imm8', bits:['1010','0100',0]},
    {fmt:'clc', bits:['10001000']},
    {fmt:'swapab', bits:['10000001']},
    {fmt:'reset', bits:['10001111']},
  ]
}

var Assembler = function(spec) {
  var self = this;
  var ip = 0;
  var origin = 0;
  var linenum = 0;
  var symbols = {};
  var errors = [];
  var outwords = [];
  var asmlines = [];
  var fixups = [];
  var width = 8;
  var codelen = 0;
  var aborted = false;

  function rule2regex(rule, vars) {
    var s = rule.fmt;
    var varlist = [];
    rule.prefix = s.split(/\s+/)[0];
    s = s.replace(/\s+/g, '\\s+');
    s = s.replace(/\[/g, '\\[');
    s = s.replace(/\]/g, '\\]');
    s = s.replace(/\./g, '\\.');
    s = s.replace(/~\w+/g, function(varname) {
      varname = varname.substr(1);
      var v = vars[varname];
      varlist.push(varname);
      if (!v)
        throw Error("Could not find rule for ~" + varname);
      else if (v.toks)
        return '(\\w+)';
      else
        return '([0-9]+|[$][0-9a-f]+|\\w+)';
    });
    rule.re = new RegExp('^'+s+'$', 'i');
    rule.varlist = varlist;
    // TODO: check rule constraints
    return rule;
  }

  function preprocessRules() {
    if (spec.width)
      width = spec.width|0;
    for (var i=0; i<spec.rules.length; i++)
      rule2regex(spec.rules[i], spec.vars);
  }
  if (spec) preprocessRules();

  function warning(msg, line) {
    errors.push({msg:msg, line:line?line:linenum});
  }
  function fatal(msg, line) {
    warning(msg, line);
    aborted = true;
  }
  function fatalIf(msg, line) {
    if (msg) fatal(msg, line);
  }
  function hex(v, nd) {
    try {
      if (!nd) nd = 2;
      var s = v.toString(16).toUpperCase();
      while (s.length < nd)
        s = "0" + s;
      return s;
    } catch (e) {
      return v+"";
    }
  }
  function addBytes(result) {
    asmlines.push({
      line:linenum,
      offset:ip,
      nbits:result.nbits
    });
    var op = result.opcode;
    var nb = result.nbits/width;
    for (var i=0; i<nb; i++) {
      outwords[ip++ - origin] = (op >> (nb-1-i)*width) & ((1<<width)-1);
    }
  }
  function addWords(data) {
    asmlines.push({
      line:linenum,
      offset:ip,
      nbits:width*data.length
    });
    for (var i=0; i<data.length; i++) {
      outwords[ip++ - origin] = data[i];
    }
  }
  
  function parseData(toks) {
    var data = [];
    for (var i=0; i<toks.length; i++) {
      data[i] = parseConst(toks[i]);
    }
    return data;
  }
  
  function stringToData(s) {
    var data = [];
    for (var i=0; i<s.length; i++) {
      data[i] = s.charCodeAt(i);
    }
    return data;
  }
  
  function alignIP(align) {
    if (align < 1 || align > codelen)
      fatal("Invalid alignment value");
    else
      ip = Math.floor((ip+align-1)/align)*align;
  }

  function parseConst(s, nbits) {
    // TODO: check bit length
    if (!s.length)
      return s;
    else if (s.startsWith("$"))
      return parseInt(s.substr(1), 16);
    else
      return parseInt(s);
  }

  self.buildInstruction = function(rule, m) {
    var opcode = 0;
    var oplen = 0;
    // iterate over each component of the rule output ("bits")
    for (var i=0; i<rule.bits.length; i++) {
      var b = rule.bits[i];
      var n,x;
      // is a string? then it's a bit constant
      // TODO
      if (b.length) {
        n = b.length;
        x = parseInt(b,2);
      } else {
        // it's an indexed variable, look up its variable
        var id = m[b+1];
        var v = spec.vars[rule.varlist[b]];
        if (!v) {
          return {error:"Could not find matching identifier for '" + m[0] + "'"};
        }
        n = v.bits;
        // is it an enumerated type? look up the index of its keyword
        if (v.toks) {
          x = v.toks.indexOf(id);
          if (x < 0)
            return null;
        } else {
          // otherwise, parse it as a constant
          x = parseConst(id, n);
          // is it a label? add fixup
          if (isNaN(x)) {
            fixups.push({sym:id, ofs:ip, bitlen:n, bitofs:oplen, line:linenum, iprel:!!v.iprel, ipofs:(v.ipofs+0)});
            x = 0;
          }
        }
      }
      var mask = (1<<n)-1;
      if ((x&mask) != x)
        return {error:"Value " + x + " does not fit in " + n + " bits"};
      opcode = (opcode << n) | x;
      oplen += n;
    }
    if (oplen == 0)
      warning("Opcode had zero length");
    else if (oplen > 32)
      warning("Opcodes > 32 bits not supported");
    else if ((oplen % width) != 0)
      warning("Opcode was not word-aligned (" + oplen + " bits)");
    return {opcode:opcode, nbits:oplen};
  }

  self.loadArch = function(arch) {
    if (self.loadJSON) {
      var json = self.loadJSON(arch + ".json");
      if (json && json.vars && json.rules) {
        spec = json;
        preprocessRules();
      } else {
        fatal("Could not load arch file '" + arch + ".json'");
      }
    }
  }

  function parseDirective(tokens) {
    var cmd = tokens[0].toLowerCase();
    if (cmd == '.define')
      symbols[tokens[1].toLowerCase()] = {value:tokens[2]};
    else if (cmd == '.org')
      ip = origin = parseInt(tokens[1]);
    else if (cmd == '.len')
      codelen = parseInt(tokens[1]);
    else if (cmd == '.width')
      width = parseInt(tokens[1]);
    else if (cmd == '.arch')
      fatalIf(self.loadArch(tokens[1]));
    else if (cmd == '.include')
      fatalIf(self.loadInclude(tokens[1]));
    else if (cmd == '.module')
      fatalIf(self.loadModule(tokens[1]));
    else if (cmd == '.data')
      addWords(parseData(tokens.slice(1)));
    else if (cmd == '.string')
      addWords(stringToData(tokens.slice(1).join(' ')));
    else if (cmd == '.align')
      alignIP(parseConst(tokens[1]));
    else
      warning("Unrecognized directive: " + tokens);
  }

  self.assemble = function(line) {
    linenum++;
    // remove comments
    line = line.replace(/[;].*/g, '').trim();
    // is it a directive?
    if (line[0] == '.') {
      var tokens = line.split(/\s+/);
      parseDirective(tokens);
      return;
    }
    // make it lowercase
    line = line.toLowerCase();
    // find labels
    line = line.replace(/(\w+):/, function(_label, label) {
      symbols[label] = {value:ip};
      return ''; // replace label with blank
    });
    line = line.trim();
    if (line == '')
      return; // empty line
    // look at each rule in order
    if (!spec) { fatal("Need to load .arch first"); return; }
    var lastError;
    for (var i=0; i<spec.rules.length; i++) {
      var rule = spec.rules[i];
      var m = rule.re.exec(line);
      if (m) {
        var result = self.buildInstruction(rule, m);
        if (result && result.nbits) {
          addBytes(result);
          return result;
        } else if (result && result.error) {
          lastError = result.error;
        }
      }
    }
    warning(lastError ? lastError : ("Could not decode instruction: " + line));
  }

  self.finish = function() {
    // apply fixups
    for (var i=0; i<fixups.length; i++) {
      var fix = fixups[i];
      var sym = symbols[fix.sym];
      if (sym) {
        var ofs = fix.ofs + Math.floor(fix.bitofs/width);
        var shift = fix.bitofs & (width-1);
        var mask = ((1<<fix.bitlen)-1);
        var value = parseConst(sym.value, fix.bitlen);
        if (fix.iprel)
          value -= fix.ofs + fix.ipofs;
        if (value > mask || value < -mask)
          warning("Symbol " + fix.sym + " (" + value + ") does not fit in " + fix.bitlen + " bits", fix.line);
        value &= mask;
        // TODO: check range
        // TODO: span multiple words?
        outwords[ofs - origin] ^= value; // TODO: << shift?
      } else {
        warning("Symbol '" + fix.sym + "' not found");
      }
    }
    // update asmlines
    for (var i=0; i<asmlines.length; i++) {
      var al = asmlines[i];
      al.insns = '';
      for (var j=0; j<al.nbits/width; j++) {
        var word = outwords[al.offset + j - origin];
        if (j>0) al.insns += ' ';
        al.insns += hex(word,width/4);
      }
    }
    while (outwords.length < codelen) {
      outwords.push(0);
    }
    fixups = [];
    return self.state();
  }

  self.assembleFile = function(text) {
    var lines = text.split(/\n/g);
    for (var i=0; i<lines.length && !aborted; i++) {
      try {
        self.assemble(lines[i]);
      } catch (e) {
        console.log(e);
        fatal("Exception during assembly: " + e);
      }
    }
    return self.finish();
  }

  self.state = function() {
    return {ip:ip, line:linenum, origin:origin, codelen:codelen,
      intermediate:{}, // TODO: listing, symbols?
      output:outwords, lines:asmlines, errors:errors, fixups:fixups};
  }
}

// Main
if (typeof module !== 'undefined' && require.main === module) {
  var fs = require('fs');
  var stdinBuffer = fs.readFileSync(0);
  var code = stdinBuffer.toString();
  var asm = new Assembler();
  asm.loadJSON = function(filename) {
    return JSON.parse(fs.readFileSync(filename, 'utf8'));
  };
  asm.loadInclude = function(filename) {
    filename = filename.substr(1, filename.length-2); // remove quotes
    //return fs.readFileSync(filename, 'utf8');
  };
  asm.loadModule = function(top_module) {
   //TODO
  };
  var out = asm.assembleFile(code);
  console.log(out);
}
