
var Disassembler6502 = function() {

this.disassemble = function(mem, start, end, ips) {
  var i;
  var lines = [];
  function print_func(s) {
    lines[i] = s;
  }
  for (i = start; i < end;) {
  	var opcode = OPS[mem[i]];
  	if (!opcode) {
  		print_func("#" + formatHex(mem[i], 2));
  		i += 1;
    } else {
	  	var bytes = opcode.bytes;
	  	var args = mem.slice(i+1, i+1+bytes);
      //console.log(opcode, bytes, args);
	  	print_func(opcode.toString.call(opcode, args));
	  	i += bytes;
	  }
  }
  return lines;
};

function formatHex(number, len) {
  if (typeof number === "undefined" || number === null || isNaN(number)) {
    throw new Error("Invalid value \"" + number + "\" passed to formatHex()");
  }
  var str = number.toString(16).toUpperCase();
  if (!len) {
    if (str.length % 2 == 1) {
      len = str.length+1;
    }
  }
  while (str.length < len) {
    str = "0" + str;
  }
  return str;
}

function formatImmediate (args) {
	return this.name + " #$" + formatHex(args[0]);
}

function formatZeroPage (args) {
	return this.name + " $" + formatHex(args[0]);
}

function formatZeroPageIndexedX (args) {
	return formatZeroPage.call(this, args) + ",X";
}

function formatZeroPageIndexedY (args) {
	return formatZeroPage.call(this, args) + ",Y";
}

function formatAbsolute (args) {
	return this.name + " $" + formatHex(args[1], 2) + formatHex(args[0], 2);
}

function formatAbsoluteIndexedX (args) {
	return formatAbsolute.call(this, args) + ",X";
}

function formatAbsoluteIndexedY (args) {
	return formatAbsolute.call(this, args) + ",Y";
}

function formatIndirect (args) {
	return this.name + " ($" + formatHex(args[0], 2) + ")";
}

function formatIndirectIndexedX (args) {
	return this.name + " ($" + formatHex(args[0], 2) + ",X)";
}

function formatIndirectIndexedY (args) {
	return this.name + " ($" + formatHex(args[0], 2) + "),Y";
}

function formatName() {
	return this.name;
}

function formatRelative (args) {
	return this.name + " $" + formatHex(args[0], 2);
}

function formatAccumulator (args) {
	return this.name + " A";
}



var OPS = {
  0xA0 : { name: "LDY", bytes: 2, toString: formatImmediate },
  0xA4 : { name: "LDY", bytes: 2, toString: formatZeroPage },
  0xB4 : { name: "LDY", bytes: 2, toString: formatZeroPageIndexedX },
  0xAC : { name: "LDY", bytes: 3, toString: formatAbsolute },
  0xBC : { name: "LDY", bytes: 3, toString: formatAbsoluteIndexedX },
  0xA2 : { name: "LDX", bytes: 2, toString: formatImmediate },
  0xA6 : { name: "LDX", bytes: 2, toString: formatZeroPage },
  0xB6 : { name: "LDX", bytes: 2, toString: formatZeroPageIndexedY },
  0xAE : { name: "LDX", bytes: 3, toString: formatAbsolute },
  0xBE : { name: "LDX", bytes: 3, toString: formatAbsoluteIndexedY },
  0xA9 : { name: "LDA", bytes: 2, toString: formatImmediate },
  0xA5 : { name: "LDA", bytes: 2, toString: formatZeroPage },
  0xB5 : { name: "LDA", bytes: 2, toString: formatZeroPageIndexedX },
  0xAD : { name: "LDA", bytes: 3, toString: formatAbsolute },
  0xBD : { name: "LDA", bytes: 3, toString: formatAbsoluteIndexedX },
  0xB9 : { name: "LDA", bytes: 3, toString: formatAbsoluteIndexedY },
  0xA1 : { name: "LDA", bytes: 2, toString: formatIndirectIndexedX },
  0xB1 : { name: "LDA", bytes: 2, toString: formatIndirectIndexedY },
  0x86 : { name: "STX", bytes: 2, toString: formatZeroPage },
  0x96 : { name: "STX", bytes: 2, toString: formatZeroPageIndexedY },
  0x8E : { name: "STX", bytes: 3, toString: formatAbsolute },
  0x84 : { name: "STY", bytes: 2, toString: formatZeroPage },
  0x94 : { name: "STY", bytes: 2, toString: formatZeroPageIndexedX },
  0x8C : { name: "STY", bytes: 3, toString: formatAbsolute },
  0x85 : { name: "STA", bytes: 2, toString: formatZeroPage },
  0x95 : { name: "STA", bytes: 2, toString: formatZeroPageIndexedX },
  0x8D : { name: "STA", bytes: 3, toString: formatAbsolute },
  0x9D : { name: "STA", bytes: 3, toString: formatAbsoluteIndexedX },
  0x99 : { name: "STA", bytes: 3, toString: formatAbsoluteIndexedY },
  0x81 : { name: "STA", bytes: 2, toString: formatIndirectIndexedX },
  0x91 : { name: "STA", bytes: 2, toString: formatIndirectIndexedY },
  0xE8 : { name: "INX", bytes: 1, toString: formatName },
  0xC8 : { name: "INY", bytes: 1, toString: formatName },
  0xCA : { name: "DEX", bytes: 1, toString: formatName },
  0x88 : { name: "DEY", bytes: 1, toString: formatName },
  0xE6 : { name: "INC", bytes: 2, toString: formatZeroPage },
  0xF6 : { name: "INC", bytes: 2, toString: formatZeroPageIndexedX },
  0xEE : { name: "INC", bytes: 3, toString: formatAbsolute },
  0xFE : { name: "INC", bytes: 3, toString: formatAbsoluteIndexedX },
  0xC6 : { name: "DEC", bytes: 2, toString: formatZeroPage },
  0xD6 : { name: "DEC", bytes: 2, toString: formatZeroPageIndexedX },
  0xCE : { name: "DEC", bytes: 3, toString: formatAbsolute },
  0xDE : { name: "DEC", bytes: 3, toString: formatAbsoluteIndexedX },
  0x38 : { name: "SEC", bytes: 1, toString: formatName },
  0xF8 : { name: "SED", bytes: 1, toString: formatName },
  0x78 : { name: "SEI", bytes: 1, toString: formatName },
  0x18 : { name: "CLC", bytes: 1, toString: formatName },
  0xD8 : { name: "CLD", bytes: 1, toString: formatName },
  0x58 : { name: "CLI", bytes: 1, toString: formatName },
  0xB8 : { name: "CLV", bytes: 1, toString: formatName },
  0xAA : { name: "TAX", bytes: 1, toString: formatName },
  0x8A : { name: "TXA", bytes: 1, toString: formatName },
  0xA8 : { name: "TAY", bytes: 1, toString: formatName },
  0x98 : { name: "TYA", bytes: 1, toString: formatName },
  0xBA : { name: "TSX", bytes: 1, toString: formatName },
  0x9A : { name: "TXS", bytes: 1, toString: formatName },
  0x48 : { name: "PHA", bytes: 1, toString: formatName },
  0x08 : { name: "PHP", bytes: 1, toString: formatName },
  0x68 : { name: "PLA", bytes: 1, toString: formatName },
  0x28 : { name: "PLP", bytes: 1, toString: formatName },
  0x29 : { name: "AND", bytes: 2, toString: formatImmediate },
  0x25 : { name: "AND", bytes: 2, toString: formatZeroPage },
  0x35 : { name: "AND", bytes: 2, toString: formatZeroPageIndexedX },
  0x2D : { name: "AND", bytes: 3, toString: formatAbsolute },
  0x3D : { name: "AND", bytes: 3, toString: formatAbsoluteIndexedX },
  0x39 : { name: "AND", bytes: 3, toString: formatAbsoluteIndexedY },
  0x21 : { name: "AND", bytes: 2, toString: formatIndirectIndexedX },
  0x31 : { name: "AND", bytes: 2, toString: formatIndirectIndexedY },
  0x09 : { name: "ORA", bytes: 2, toString: formatImmediate },
  0x05 : { name: "ORA", bytes: 2, toString: formatZeroPage },
  0x15 : { name: "ORA", bytes: 2, toString: formatZeroPageIndexedX },
  0x0D : { name: "ORA", bytes: 3, toString: formatAbsolute },
  0x1D : { name: "ORA", bytes: 3, toString: formatAbsoluteIndexedX },
  0x19 : { name: "ORA", bytes: 3, toString: formatAbsoluteIndexedY },
  0x01 : { name: "ORA", bytes: 2, toString: formatIndirectIndexedX },
  0x11 : { name: "ORA", bytes: 2, toString: formatIndirectIndexedY },
  0x49 : { name: "EOR", bytes: 2, toString: formatImmediate },
  0x45 : { name: "EOR", bytes: 2, toString: formatZeroPage },
  0x55 : { name: "EOR", bytes: 2, toString: formatZeroPageIndexedX },
  0x4D : { name: "EOR", bytes: 3, toString: formatAbsolute },
  0x5D : { name: "EOR", bytes: 3, toString: formatAbsoluteIndexedX },
  0x59 : { name: "EOR", bytes: 3, toString: formatAbsoluteIndexedY },
  0x41 : { name: "EOR", bytes: 2, toString: formatIndirectIndexedX },
  0x51 : { name: "EOR", bytes: 2, toString: formatIndirectIndexedY },
  0x4C : { name: "JMP", bytes: 3, toString: formatAbsolute },
  0x6C : { name: "JMP", bytes: 3, toString: formatIndirect },
  0x20 : { name: "JSR", bytes: 3, toString: formatAbsolute },
  0x60 : { name: "RTS", bytes: 1, toString: formatName },
  0x40 : { name: "RTI", bytes: 1, toString: formatName },
  0x90 : { name: "BCC", bytes: 2, toString: formatRelative },
  0xB0 : { name: "BCS", bytes: 2, toString: formatRelative },
  0xF0 : { name: "BEQ", bytes: 2, toString: formatRelative },
  0xD0 : { name: "BNE", bytes: 2, toString: formatRelative },
  0x10 : { name: "BPL", bytes: 2, toString: formatRelative },
  0x30 : { name: "BMI", bytes: 2, toString: formatRelative },
  0x50 : { name: "BVC", bytes: 2, toString: formatRelative },
  0x70 : { name: "BVS", bytes: 2, toString: formatRelative },
  0x2A : { name: "ROL", bytes: 1, toString: formatAccumulator },
  0x26 : { name: "ROL", bytes: 2, toString: formatZeroPage },
  0x36 : { name: "ROL", bytes: 2, toString: formatZeroPageIndexedX },
  0x2E : { name: "ROL", bytes: 3, toString: formatAbsolute },
  0x3E : { name: "ROL", bytes: 3, toString: formatAbsoluteIndexedX },
  0x6A : { name: "ROR", bytes: 1, toString: formatAccumulator },
  0x66 : { name: "ROR", bytes: 2, toString: formatZeroPage },
  0x76 : { name: "ROR", bytes: 2, toString: formatZeroPageIndexedX },
  0x6E : { name: "ROR", bytes: 3, toString: formatAbsolute },
  0x7E : { name: "ROR", bytes: 3, toString: formatAbsoluteIndexedX },
  0x4A : { name: "LSR", bytes: 1, toString: formatAccumulator },
  0x46 : { name: "LSR", bytes: 2, toString: formatZeroPage },
  0x56 : { name: "LSR", bytes: 2, toString: formatZeroPageIndexedX },
  0x4E : { name: "LSR", bytes: 3, toString: formatAbsolute },
  0x5E : { name: "LSR", bytes: 3, toString: formatAbsoluteIndexedX },
  0x0A : { name: "ASL", bytes: 1, toString: formatAccumulator },
  0x06 : { name: "ASL", bytes: 2, toString: formatZeroPage },
  0x16 : { name: "ASL", bytes: 2, toString: formatZeroPageIndexedX },
  0x0E : { name: "ASL", bytes: 3, toString: formatAbsolute },
  0x1E : { name: "ASL", bytes: 3, toString: formatAbsoluteIndexedX },
  0xC9 : { name: "CMP", bytes: 2, toString: formatImmediate },
  0xC5 : { name: "CMP", bytes: 2, toString: formatZeroPage },
  0xD5 : { name: "CMP", bytes: 2, toString: formatZeroPageIndexedX },
  0xCD : { name: "CMP", bytes: 3, toString: formatAbsolute },
  0xDD : { name: "CMP", bytes: 3, toString: formatAbsoluteIndexedX },
  0xD9 : { name: "CMP", bytes: 3, toString: formatAbsoluteIndexedY },
  0xC1 : { name: "CMP", bytes: 2, toString: formatIndirectIndexedX },
  0xD1 : { name: "CMP", bytes: 2, toString: formatIndirectIndexedY },
  0xE0 : { name: "CPX", bytes: 2, toString: formatImmediate },
  0xE4 : { name: "CPX", bytes: 2, toString: formatZeroPage },
  0xEC : { name: "CPX", bytes: 3, toString: formatAbsolute },
  0xC0 : { name: "CPY", bytes: 2, toString: formatImmediate },
  0xC4 : { name: "CPY", bytes: 2, toString: formatZeroPage },
  0xCC : { name: "CPY", bytes: 3, toString: formatAbsolute },
  0x24 : { name: "BIT", bytes: 2, toString: formatZeroPage },
  0x2C : { name: "BIT", bytes: 3, toString: formatAbsolute },
  0x69 : { name: "ADC", bytes: 2, toString: formatImmediate },
  0x65 : { name: "ADC", bytes: 2, toString: formatZeroPage },
  0x75 : { name: "ADC", bytes: 2, toString: formatZeroPageIndexedX },
  0x6D : { name: "ADC", bytes: 3, toString: formatAbsolute },
  0x7D : { name: "ADC", bytes: 3, toString: formatAbsoluteIndexedX },
  0x79 : { name: "ADC", bytes: 3, toString: formatAbsoluteIndexedY },
  0x61 : { name: "ADC", bytes: 2, toString: formatIndirectIndexedX },
  0x71 : { name: "ADC", bytes: 2, toString: formatIndirectIndexedY },
  0xE9 : { name: "SBC", bytes: 2, toString: formatImmediate },
  0xE5 : { name: "SBC", bytes: 2, toString: formatZeroPage },
  0xF5 : { name: "SBC", bytes: 2, toString: formatZeroPageIndexedX },
  0xED : { name: "SBC", bytes: 3, toString: formatAbsolute },
  0xFD : { name: "SBC", bytes: 3, toString: formatAbsoluteIndexedX },
  0xF9 : { name: "SBC", bytes: 3, toString: formatAbsoluteIndexedY },
  0xE1 : { name: "SBC", bytes: 2, toString: formatIndirectIndexedX },
  0xF1 : { name: "SBC", bytes: 2, toString: formatIndirectIndexedY },
  0xEA : { name: "NOP", bytes: 1, toString: formatName },
  0x00 : { name: "BRK", bytes: 1, toString: formatName },
};

}
