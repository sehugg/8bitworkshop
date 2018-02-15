
EXAMPLE_SPEC = {
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
    {fmt:'lda #~imm8', bits:['01','00','0001',0]},
    {fmt:'ldb #~imm8', bits:['01','01','0001',0]},
    {fmt:'jmp ~imm8',  bits:['01','10','0001',0]},
    {fmt:'sta ~imm4',  bits:['1001',0]},
    {fmt:'bcc ~rel', bits:['1010','0001',0]},
    {fmt:'bcs ~rel', bits:['1010','0011',0]},
    {fmt:'bz ~rel',  bits:['1010','1101',0]},
    {fmt:'bnz ~rel', bits:['1010','0101',0]},
    {fmt:'clc', bits:['10001000']},
    {fmt:'swapab', bits:['10000001']},
    {fmt:'reset', bits:['10001111']},
  ]
}

function rule2regex(rule, vars) {
  var s = rule.fmt;
  var varlist = [];
  rule.prefix = s.split(/\s+/)[0];
  s = s.replace(/\s+/g, '\\s');
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

var Assembler = function(spec) {
  var self = this;
  var ip = 0;
  var linenum = 0;
  var symbols = {};
  var errors = [];
  var outwords = [];
  var fixups = [];
  var width = 8;

  for (var i=0; i<spec.rules.length; i++)
    rule2regex(spec.rules[i], spec.vars);

  function warning(msg) {
    errors.push({msg:msg, line:linenum});
  }

  function addBytes(result) {
    var op = result.opcode;
    var nb = result.nbits/width;
    for (var i=0; i<nb; i++)
      outwords[ip++] = (op >> (nb-1-i)*width) & ((1<<width)-1);
  }

  self.buildInstruction = function(rule, m) {
    var opcode = 0;
    var oplen = 0;
    for (var i=0; i<rule.bits.length; i++) {
      var b = rule.bits[i];
      var n,x;
      if (b.length) {
        n = b.length;
        x = parseInt(b,2);
      } else {
        var id = m[b+1];
        var v = spec.vars[rule.varlist[b]];
        n = v.bits;
        if (v.toks) {
          x = v.toks.indexOf(id);
          if (x < 0)
            return null;
        } else {
          if (id.startsWith("$"))
            x = parseInt(id.substr(1), 16);
          else
            x = parseInt(id);
          // is it a label? add fixup
          if (isNaN(x)) {
            fixups.push({sym:id, ofs:ip, bitlen:n, bitofs:oplen, line:linenum, iprel:!!v.iprel, ipofs:(v.ipofs+0)});
            x = 0;
          }
        }
      }
      var mask = (1<<n)-1;
      if ((x&mask) != x)
        warning("Value " + x + " could not fit in " + n + " bits");
      opcode = (opcode << n) | x;
      oplen += n;
    }
    if (oplen == 0)
      warning("Opcode had zero length");
    else if ((oplen % width) != 0)
      warning("Opcode was not word-aligned (" + oplen + " bits)");
    return {opcode:opcode, nbits:oplen};
  }
  self.assemble = function(line) {
    linenum++;
    // remove comments
    line = line.replace(/[;].*/g, '');
    line = line.trim().toLowerCase();
    // is it a directive?
    if (line[0] == '.') {
      var tokens = line.split(/\s+/);
      if (tokens[0] == '.define')
        symbols[tokens[1]] = {value:tokens[2]};
      else
        warning("Unrecognized directive: " + line);
      return;
    }
    // find labels
    line = line.replace(/(\w+):/, function(_label, label) {
      symbols[label] = {value:ip};
      return '';
    });
    line = line.trim();
    // look at each rule in order
    for (var i=0; i<spec.rules.length; i++) {
      var rule = spec.rules[i];
      var m = rule.re.exec(line);
      if (m) {
        var result = self.buildInstruction(rule, m);
        if (result) {
          addBytes(result);
          return result;
        }
      }
    }
    warning("Could not decode instruction: " + line);
  }
  self.finish = function() {
    for (var i=0; i<fixups.length; i++) {
      var fix = fixups[i];
      var sym = symbols[fix.sym];
      if (sym) {
        var ofs = fix.ofs + (fix.bitofs>>3);
        var shift = fix.bitofs&7;
        var mask = ((1<<fix.bitlen)-1);
        var value = sym.value;
        if (fix.iprel) value -= fix.ofs + fix.ipofs;
        value &= mask;
        // TODO: check range
        // TODO: span multiple words?
        outwords[ofs] ^= value;
      } else {
        warning("Symbol '" + fix.sym + "' not found");
      }
    }
    fixups = [];
  }
  self.state = function() {
    return {ip:ip, line:linenum, output:outwords, errors:errors, fixups:fixups};
  }
}

var asm = new Assembler(EXAMPLE_SPEC);
console.log(EXAMPLE_SPEC);
console.log(asm.assemble(".define FOO 0xa")); // TODO
console.log(asm.assemble(" sta FOO"));
console.log(asm.assemble(" sta 10"));
console.log(asm.assemble(" add a,#25 ; comment "));
console.log(asm.assemble("Label: asl a "));
console.log(asm.assemble(" sub b,[b] "));
console.log(asm.assemble(" bz Label "));
asm.finish();
console.log(asm.state());
