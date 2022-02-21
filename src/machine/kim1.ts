
import { MOS6502, MOS6502State } from "../common/cpu/MOS6502";
import { BasicHeadlessMachine } from "../common/devices";
import { padBytes, Keys, KeyFlags, newAddressDecoder } from "../common/emu"; // TODO
import { hex, stringToByteArray, lzgmini } from "../common/util";

const KIM1_KEYMATRIX_NOSHIFT = [
  Keys.VK_DELETE, Keys.VK_ENTER, Keys.VK_RIGHT, Keys.VK_F7,	Keys.VK_F1, Keys.VK_F3, Keys.VK_F5, Keys.VK_DOWN,
  Keys.VK_3, Keys.VK_W, Keys.VK_A, Keys.VK_4,			Keys.VK_Z, Keys.VK_S, Keys.VK_E, Keys.VK_SHIFT,
  Keys.VK_5, Keys.VK_R, Keys.VK_D, Keys.VK_6,			Keys.VK_C, Keys.VK_F, Keys.VK_T, Keys.VK_X,
  Keys.VK_7, Keys.VK_Y, Keys.VK_G, Keys.VK_8,			Keys.VK_B, Keys.VK_H, Keys.VK_U, Keys.VK_V,
  Keys.VK_9, Keys.VK_I, Keys.VK_J, Keys.VK_0,			Keys.VK_M, Keys.VK_K, Keys.VK_O, Keys.VK_N,
  null/*Keys.VK_PLUS*/, Keys.VK_P, Keys.VK_L, Keys.VK_MINUS,	Keys.VK_PERIOD, null/*Keys.VK_COLON*/, null/*Keys.VK_AT*/, Keys.VK_COMMA,
  null/*Keys.VK_POUND*/, null/*TIMES*/, Keys.VK_SEMICOLON, Keys.VK_HOME, Keys.VK_SHIFT/*right*/, Keys.VK_EQUALS, Keys.VK_TILDE, Keys.VK_SLASH,
  Keys.VK_1, Keys.VK_LEFT, Keys.VK_CONTROL, Keys.VK_2,		Keys.VK_SPACE, Keys.VK_ALT, Keys.VK_Q, null/*STOP*/,
];

const KEYBOARD_ROW_0 = 0;

class RRIOT_6530 {

  regs = new Uint8Array(16);
  ina : number = 0;
  inb : number = 0;

  read(a:number) : number {
    //console.log('read', hex(a), hex(this.regs[a]));
    return this.regs[a];
  }

  write(a:number,v:number) {
    this.regs[a] = v;
    //console.log('write', hex(a), hex(v));
  }
  
  input_a() { return this.ina & ~this.regs[1]; }
  input_b() { return this.inb & ~this.regs[1]; }
  output_a() { return (this.regs[0] ^ 0xff) | this.regs[1]; }
  output_b() { return (this.regs[2] ^ 0xff) | this.regs[3]; }
}

export class KIM1 extends BasicHeadlessMachine {
  cpuFrequency = 1000000;
  defaultROMSize = 0x1000;
  
  cpu = new MOS6502();
  ram = new Uint8Array(0x1800);
  bios : Uint8Array;

  rriot1 : RRIOT_6530 = new RRIOT_6530();
  rriot2 : RRIOT_6530 = new RRIOT_6530();
  digits = [];

  constructor() {
    super();
    this.bios = new lzgmini().decode(stringToByteArray(atob(KIM1_BIOS_LZG)));
    this.connectCPUMemoryBus(this);
  }

  read = newAddressDecoder([
    [0x1700, 0x173f, 0x000f, (a) => { return this.readIO_1(a); }],
    [0x1740, 0x177f, 0x000f, (a) => { return this.readIO_2(a); }],
    [0x0000, 0x17ff, 0x1fff, (a) => { return this.ram[a]; }],
    [0x1800, 0x1fff, 0x07ff, (a) => { return this.bios[a]; }],
  ], {gmask:0x1fff});
  
  write = newAddressDecoder([
    [0x1700, 0x173f, 0x000f, (a,v) => { return this.writeIO_1(a,v); }],
    [0x1740, 0x177f, 0x000f, (a,v) => { return this.writeIO_2(a,v); }],
    [0x0000, 0x17ff, 0x1fff, (a,v) => { this.ram[a] = v; }],
  ], {gmask:0x1fff});
  
  readConst(a:number) : number {
    return this.read(a);
  }

  readIO_1(a:number) : number {
    return this.rriot1.read(a);
  }
  
  writeIO_1(a:number, v:number) {
    this.rriot1.write(a,v);
  }
  
  readIO_2(a:number) : number {
    switch (a & 0xf) {
      case 0x0:
        let cols = 0;
        for (let i=0; i<8; i++)
          if ((this.rriot2.regs[0] & (1<<i)) == 0)
            cols |= this.inputs[KEYBOARD_ROW_0 + i];
        //if (cols) console.log(this.rriot1.regs[0], cols);
        this.rriot2.ina = cols ^ 0xff;
    }
    return this.rriot2.read(a);
  }
  
  writeIO_2(a:number, v:number) {
    this.rriot2.write(a,v);
    // update LED
    let digit = this.rriot2.output_a();
    let segments = this.rriot2.output_b();
    console.log(digit, segments);
  }
  
  loadROM(data) {
    super.loadROM(data);
    this.ram.set(this.rom, 0x400);
    this.reset();
  }

  loadBIOS(data) {
    this.bios = padBytes(data, 0x800);
    this.reset();
  }

  setKeyInput(key:number, code:number, flags:number) : void {
    //console.log(key,code,flags);
    var keymap = KIM1_KEYMATRIX_NOSHIFT;
    for (var i=0; i<keymap.length; i++) {
      if (keymap[i] && keymap[i].c == key) {
        let row = i >> 3;
        let col = i & 7;
        // is column selected?
        if (flags & KeyFlags.KeyDown) {
          this.inputs[KEYBOARD_ROW_0 + row] |= (1<<col);
        } else if (flags & KeyFlags.KeyUp) {
          this.inputs[KEYBOARD_ROW_0 + row] &= ~(1<<col);
        }
        console.log(key, row, col, hex(this.inputs[KEYBOARD_ROW_0 + row]));
        break;
      }
    }
  }
  
  advanceFrame(trap) : number {
    var clock = 0;
    while (clock < this.cpuFrequency/60) {
      if (trap && trap()) break;
      clock += this.advanceCPU();
    }
    return clock;
  }
}

// https://github.com/jefftranter/6502/blob/master/asm/KIM-1/ROMs/kim.s
const KIM1_BIOS_LZG = `TFpHAAAIAAAABY3ivWkoAQsOJSiprY3sFyAyGaknjUIXqb+NQxeiZKkWIHoZytD4qSoo4a35FyBhGa31FyBeGa32KKPtF833F63uF+34F5AkqS8lXeclnegooqICqQQOBTgAhfqF+0xPHCDsJXAg6hlMMxgPGamNDgVrTI3vF61xGI3wF61yGI3xF6kHDgJ8/43pFyBBGk7pFw3pFyUErekXyRbQ7aIKICQaJQHfytD2JUIq8AYlBtHw8yDzGc35F/ANrfkXyQAlDf/wF9CcJQ0gTBmN7RcOBQHuF0z4GCXEKKSiAiV9L/AUIAAa0CPK0PElDEzsFw4CnCWhzecX0Awo4ugX0ASpAPACqf8OBcWt9ReN7Ret9heN7hepYI3vF6kAjecXjegXYKgYbSUB5xet6BdpACUJmGAgTBmoSigBIG8ZmChiYCkPyQoYMAJpB2kwjukXjOoXoAggnhlKsAYooUyRGSDEKEKI0Ouu6Res6hdgoglILEcXEPupfo1EF6mnjUIXDgkHDiKqytDfaGCiBg4FHsMODB4lhw4HHu7tF9AD7u4XYCAkGiAAGiikYMkwMB7JRxAayUAwAxhpCSooAaQEKi7pF4jQ+a3pF6AAYMhgjusXoggOIovqFw3qF43qF8rQ8a3qFypKrusXYCxCFxD7rUYXoP+MKIEUiND9JQow+zjtDgYLByULSf8pgGAOSFsOBJeaDgymJYclW0x1Gv8oHygfKB4oGWsaKCKF82iF8WiF74X6aIXwhfuE9Ib1uobyIIgeTE8cbPoXbP4Xov+aJYmp/43zF6kBLEAX0Bkw+an8GGkBkAPu8xesQBcQ843yDkIbah4gjB4l2x4gLx6iCiAxHkyvHakAhfiF+SBaHskB8AYgrB9M2x0gGR/Q0yWi8MwlBPD0KILvIGofyRUQu8kU8ETJEPAsyREoYRLwL8kT8DEKKAGF/KIEpP/QCrH6BvwqkfpMwxwKJvom+8rQ6vAIqQHQAqkAhf8OgmZjHyihTMgdpe+F+qXwDoR6Wh7JO9D5JRr3hfYgnR+qIJEfKMGF+yjl+ijhivAPJQORJUMlO8rQ8uglB8X20BcowvfQE4rQuaIMDkOaDgLPTxwlD6IR0O4OBNYoofaF9yAvHqk7IKAepfrN9xel+w6iGRipACA7HiDMHyAeHqX2JQOl9yiBTGQcqRiqJVGRJVGgALH6DgUFDgJy8A4IIeb40ALm+UxIHSV6Lx4lJCCeDgcnng4CQCUqTKwdpvKapftIpfpIpfFIpvWk9KXzQMkg8MrJf/AbyQ3w28kK8BzJLvAmyUfw1clR8ArJTPAJTGocDiIgQh1M5xw4pfrpAYX6sALG+0ysHaAApfiR+kzCHaX7DgSOpQ4FlmCiB73VHyCgHsoQ92CF/A6D00wepfwogw6K1UygHob9oggORAQiMPkg1B4g6x6tQBcpgEb+Bf6F/iUJytDvJQym/aX+KkpgogGG/6IAjkEXoj+OQxeiB45CF9h4YKkghf6G/SUkrUIXKf4OInLUHqIIJYVG/mkAJcnK0O4lCgkBJcam/WCt8xeN9Bet8hc46QGwA870F6z0FxDzDggPSk70F5DjCYCw4KADogGp/45CF+joLUAXiND1oAeMQhcJgEn/YA4iXIX5qX+NQReiCaADufgADgPmSB8lAikPKOGI0OslMakAJRlM/h6E/Ki55x+gAIxAFyUOjUAXoH+I0P3o6KT8YOb60ALm+2CiIaABIAIf0AfgJ9D1qRVgoP8KsAPIEPqKKQ9KqpgQAxhpB8rQ+mAYZfeF96X2aQCF9mAgWh4grB8opKX4DqKkG8lHEBcOqaSgBCom+Cb5iA7iZWCl+IX6pfmF+2AAKAMKDU1JSyATUlJFIBO/htvP5u39h//v9/y53vnx////HBwiHB8c`;

