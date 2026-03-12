// based on https://github.com/mamedev/mame/blob/master/src/devices/cpu/f8/f8.cpp
// license:BSD-3-Clause
// copyright-holders:Juergen Buchmueller
// and https://raw.githubusercontent.com/mamedev/mame/master/src/mame/fairchild/channelf.cpp
// license:GPL-2.0+
// copyright-holders:Juergen Buchmueller, Frank Palazzolo, Sean Riddle

import { hex } from "../util";

// Scratchpad register names for operands 0-14
function regName(r: number): string {
  if (r < 9) return 'r' + r;
  if (r === 9) return 'J';
  if (r === 10) return 'HU';
  if (r === 11) return 'HL';
  if (r === 12) return 'S';   // ISAR
  if (r === 13) return 'I';   // ISAR++
  if (r === 14) return 'D';   // ISAR--
  return '?';
}

export function disassembleF8(pc: number, b0: number, b1: number, b2: number): { line: string, nbytes: number, isaddr: boolean } {
  let mn = '';
  let args = '';
  let nb = 1;
  let isaddr = false;

  if (b0 <= 0x07) {
    const regs = ['KU', 'KL', 'QU', 'QL'];
    if (b0 < 4) { mn = 'LR'; args = 'A,' + regs[b0]; }
    else { mn = 'LR'; args = regs[b0 - 4] + ',A'; }
  } else if (b0 === 0x08) { mn = 'LR'; args = 'K,P'; }
  else if (b0 === 0x09) { mn = 'LR'; args = 'P,K'; }
  else if (b0 === 0x0A) { mn = 'LR'; args = 'A,IS'; }
  else if (b0 === 0x0B) { mn = 'LR'; args = 'IS,A'; }
  else if (b0 === 0x0C) { mn = 'PK'; }
  else if (b0 === 0x0D) { mn = 'LR'; args = 'P0,Q'; }
  else if (b0 === 0x0E) { mn = 'LR'; args = 'Q,DC'; }
  else if (b0 === 0x0F) { mn = 'LR'; args = 'DC,Q'; }
  else if (b0 === 0x10) { mn = 'LR'; args = 'DC,H'; }
  else if (b0 === 0x11) { mn = 'LR'; args = 'H,DC'; }
  else if (b0 === 0x12) { mn = 'SR'; args = '1'; }
  else if (b0 === 0x13) { mn = 'SL'; args = '1'; }
  else if (b0 === 0x14) { mn = 'SR'; args = '4'; }
  else if (b0 === 0x15) { mn = 'SL'; args = '4'; }
  else if (b0 === 0x16) { mn = 'LM'; }
  else if (b0 === 0x17) { mn = 'ST'; }
  else if (b0 === 0x18) { mn = 'COM'; }
  else if (b0 === 0x19) { mn = 'LNK'; }
  else if (b0 === 0x1A) { mn = 'DI'; }
  else if (b0 === 0x1B) { mn = 'EI'; }
  else if (b0 === 0x1C) { mn = 'POP'; }
  else if (b0 === 0x1D) { mn = 'LR'; args = 'W,J'; }
  else if (b0 === 0x1E) { mn = 'LR'; args = 'J,W'; }
  else if (b0 === 0x1F) { mn = 'INC'; }
  else if (b0 === 0x20) { mn = 'LI'; args = '$' + hex(b1, 2); nb = 2; }
  else if (b0 === 0x21) { mn = 'NI'; args = '$' + hex(b1, 2); nb = 2; }
  else if (b0 === 0x22) { mn = 'OI'; args = '$' + hex(b1, 2); nb = 2; }
  else if (b0 === 0x23) { mn = 'XI'; args = '$' + hex(b1, 2); nb = 2; }
  else if (b0 === 0x24) { mn = 'AI'; args = '$' + hex(b1, 2); nb = 2; }
  else if (b0 === 0x25) { mn = 'CI'; args = '$' + hex(b1, 2); nb = 2; }
  else if (b0 === 0x26) { mn = 'IN'; args = '$' + hex(b1, 2); nb = 2; }
  else if (b0 === 0x27) { mn = 'OUT'; args = '$' + hex(b1, 2); nb = 2; }
  else if (b0 === 0x28) {
    mn = 'PI'; args = '$' + hex((b1 << 8) | b2, 4); nb = 3; isaddr = true;
  }
  else if (b0 === 0x29) {
    mn = 'JMP'; args = '$' + hex((b1 << 8) | b2, 4); nb = 3; isaddr = true;
  }
  else if (b0 === 0x2A) {
    mn = 'DCI'; args = '$' + hex((b1 << 8) | b2, 4); nb = 3; isaddr = true;
  }
  else if (b0 === 0x2B) { mn = 'NOP'; }
  else if (b0 === 0x2C) { mn = 'XDC'; }
  else if (b0 <= 0x2F) { mn = '???'; }
  else if (b0 >= 0x30 && b0 <= 0x3E) {
    mn = 'DS'; args = regName(b0 & 0x0F); nb = 1;
  }
  else if (b0 === 0x3F) { mn = '???'; }
  else if (b0 >= 0x40 && b0 <= 0x4E) {
    mn = 'LR'; args = 'A,' + regName(b0 & 0x0F);
  }
  else if (b0 === 0x4F) { mn = '???'; }
  else if (b0 >= 0x50 && b0 <= 0x5E) {
    mn = 'LR'; args = regName(b0 & 0x0F) + ',A';
  }
  else if (b0 === 0x5F) { mn = '???'; }
  else if (b0 >= 0x60 && b0 <= 0x67) {
    mn = 'LISU'; args = '' + (b0 & 0x07);
  }
  else if (b0 >= 0x68 && b0 <= 0x6F) {
    mn = 'LISL'; args = '' + (b0 & 0x07);
  }
  else if (b0 >= 0x70 && b0 <= 0x7F) {
    mn = 'LIS'; args = '' + (b0 & 0x0F);
  }
  else if (b0 >= 0x80 && b0 <= 0x87) {
    const offset = (b1 & 0x80) ? (pc + 2 + b1 - 256) : (pc + 2 + b1);
    mn = 'BT'; args = '' + (b0 & 0x07) + ',$' + hex(offset & 0xFFFF, 4);
    nb = 2; isaddr = true;
  }
  else if (b0 === 0x88) { mn = 'AM'; }
  else if (b0 === 0x89) { mn = 'AMD'; }
  else if (b0 === 0x8A) { mn = 'NM'; }
  else if (b0 === 0x8B) { mn = 'OM'; }
  else if (b0 === 0x8C) { mn = 'XM'; }
  else if (b0 === 0x8D) { mn = 'CM'; }
  else if (b0 === 0x8E) { mn = 'ADC'; }
  else if (b0 === 0x8F) {
    const offset = (b1 & 0x80) ? (pc + 2 + b1 - 256) : (pc + 2 + b1);
    mn = 'BR7'; args = '$' + hex(offset & 0xFFFF, 4);
    nb = 2; isaddr = true;
  }
  else if (b0 >= 0x90 && b0 <= 0x9F) {
    const offset = (b1 & 0x80) ? (pc + 2 + b1 - 256) : (pc + 2 + b1);
    const mask = b0 & 0x0F;
    if (mask === 0) mn = 'BR';
    else mn = 'BF';
    if (mask !== 0) args = '' + mask + ',';
    args += '$' + hex(offset & 0xFFFF, 4);
    nb = 2; isaddr = true;
  }
  else if (b0 >= 0xA0 && b0 <= 0xA1) { mn = 'INS'; args = '' + (b0 & 0x0F); }
  else if (b0 >= 0xA2 && b0 <= 0xA3) { mn = '???'; }
  else if (b0 >= 0xA4 && b0 <= 0xAF) { mn = 'INS'; args = '' + (b0 & 0x0F); }
  else if (b0 >= 0xB0 && b0 <= 0xB1) { mn = 'OUTS'; args = '' + (b0 & 0x0F); }
  else if (b0 >= 0xB2 && b0 <= 0xB3) { mn = '???'; }
  else if (b0 >= 0xB4 && b0 <= 0xBF) { mn = 'OUTS'; args = '' + (b0 & 0x0F); }
  else if (b0 >= 0xC0 && b0 <= 0xCE) { mn = 'AS'; args = regName(b0 & 0x0F); }
  else if (b0 === 0xCF) { mn = '???'; }
  else if (b0 >= 0xD0 && b0 <= 0xDE) { mn = 'ASD'; args = regName(b0 & 0x0F); }
  else if (b0 === 0xDF) { mn = '???'; }
  else if (b0 >= 0xE0 && b0 <= 0xEE) { mn = 'XS'; args = regName(b0 & 0x0F); }
  else if (b0 === 0xEF) { mn = '???'; }
  else if (b0 >= 0xF0 && b0 <= 0xFE) { mn = 'NS'; args = regName(b0 & 0x0F); }
  else { mn = '???'; }

  return { line: mn + (args ? ' ' + args : ''), nbytes: nb, isaddr: isaddr };
}
