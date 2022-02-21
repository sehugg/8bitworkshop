
import { Z80, Z80State } from "../common/cpu/ZilogZ80";
import { BasicScanlineMachine } from "../common/devices";
import { BaseZ80VDPBasedMachine } from "./vdp_z80";
import { KeyFlags, newAddressDecoder, padBytes, Keys, makeKeycodeMap, newKeyboardHandler } from "../common/emu";
import { hex, lzgmini, stringToByteArray } from "../common/util";
import { TssChannelAdapter, MasterAudio, AY38910_Audio } from "../common/audio";
import { TMS9918A } from "../common/video/tms9918a";


var MSX_KEYCODE_MAP = makeKeycodeMap([
  [Keys.UP,       0, 0x1],
  [Keys.DOWN,     0, 0x2],
  [Keys.LEFT,     0, 0x4],
  [Keys.RIGHT,    0, 0x8],
  [Keys.A,        0, 0x10],
  [Keys.B,        0, 0x20],

  [Keys.P2_UP,    1, 0x1],
  [Keys.P2_DOWN,  1, 0x2],
  [Keys.P2_LEFT,  1, 0x4],
  [Keys.P2_RIGHT, 1, 0x8],
  [Keys.P2_A,     1, 0x10],
  [Keys.P2_B,     1, 0x20],

  [Keys.ANYKEY,   2, 0x0],
]);

const JOY_INPUT_0 = 0;
const JOY_INPUT_1 = 1;
const KEYBOARD_ROW_0 = 16;

const MSX_KEYMATRIX_INTL_NOSHIFT = [
  Keys.VK_7, Keys.VK_6, Keys.VK_5, Keys.VK_4, Keys.VK_3, Keys.VK_2, Keys.VK_1, Keys.VK_0,
  Keys.VK_SEMICOLON, Keys.VK_CLOSE_BRACKET, Keys.VK_OPEN_BRACKET, Keys.VK_BACK_SLASH, Keys.VK_EQUALS, Keys.VK_MINUS, Keys.VK_9, Keys.VK_8,
  Keys.VK_B, Keys.VK_A, null/*DEAD*/, Keys.VK_SLASH, Keys.VK_PERIOD, Keys.VK_COMMA, Keys.VK_ACUTE, Keys.VK_QUOTE,
  Keys.VK_J, Keys.VK_I, Keys.VK_H, Keys.VK_G, Keys.VK_F, Keys.VK_E, Keys.VK_D, Keys.VK_C,
  Keys.VK_R, Keys.VK_Q, Keys.VK_P, Keys.VK_O, Keys.VK_N, Keys.VK_M, Keys.VK_L, Keys.VK_K,
  Keys.VK_Z, Keys.VK_Y, Keys.VK_X, Keys.VK_W, Keys.VK_V, Keys.VK_U, Keys.VK_T, Keys.VK_S,
  Keys.VK_F3, Keys.VK_F2, Keys.VK_F1, null, Keys.VK_CAPS_LOCK, null, Keys.VK_CONTROL, Keys.VK_SHIFT,
  Keys.VK_ENTER, null, Keys.VK_BACK_SPACE, null, Keys.VK_TAB, Keys.VK_ESCAPE, Keys.VK_F5, Keys.VK_F4,
  Keys.VK_RIGHT, Keys.VK_DOWN, Keys.VK_UP, Keys.VK_LEFT, Keys.VK_DELETE, Keys.VK_INSERT, Keys.VK_HOME, Keys.VK_SPACE,
  null, null, null, null, null, null, null, null, 
  null, null, null, null, null, null, null, null, 
  // TODO: null keycodes
];

/// standard emulator

interface MSXSlot {
  read(addr:number) : number;
  write(addr:number, val:number) : void;
}

export class MSX1 extends BaseZ80VDPBasedMachine {

  numVisibleScanlines = 240;
  defaultROMSize = 0x8000;
  ram = new Uint8Array(0x10000);

  vdp : TMS9918A;
  bios : Uint8Array;
  slots : MSXSlot[];
  slotmask : number = 0;
  ppi_c : number = 0;
  
  constructor() {
    super();
    this.init(this, this.newIOBus(), new AY38910_Audio(new MasterAudio()));
    this.bios = new lzgmini().decode(stringToByteArray(atob(MSX1_BIOS_LZG)));
    // skip splash screen
    this.bios[0xdd5] = 0;
    this.bios[0xdd6] = 0;
    this.bios[0xdd7] = 0;
    // slot definitions
    this.slots = [
       // slot 0 : BIOS
       {
         read: (a) => { return this.bios[a] | 0; },
         write: (a,v) => { }
       },
       // slot 1: cartridge
       {
         read: (a) => { return this.rom[a - 0x4000] | 0; },
         write: (a,v) => { }
       },
       // slot 2: cartridge
       {
         read: (a) => { return this.rom[a - 0x4000] | 0; },
         write: (a,v) => { }
       },
       // slot 3 : RAM
       {
         read: (a) => { return this.ram[a] | 0; },
         write: (a,v) => { this.ram[a] = v; }
       },
    ];
  }
  
  
  getKeyboardMap() { return MSX_KEYCODE_MAP; }

  // http://map.grauw.nl/articles/keymatrix.php
  getKeyboardFunction() {
    return (o,key,code,flags) => {
      //console.log(o,key,code,flags);
      var keymap = MSX_KEYMATRIX_INTL_NOSHIFT;
      for (var i=0; i<keymap.length; i++) {
        if (keymap[i] && keymap[i].c == key) {
          let row = i >> 3;
          let bit = 7 - (i & 7);
          //console.log(key, row, bit);
          if (flags & KeyFlags.KeyDown) {
            this.inputs[KEYBOARD_ROW_0+row] |= (1<<bit);
          } else if (flags & KeyFlags.KeyUp) {
            this.inputs[KEYBOARD_ROW_0+row] &= ~(1<<bit);
          }
          break;
        }
      }
    };
  }
  
   read = (a) => {
     let shift = (a >> 14) << 1;
     let slotnum = (this.slotmask >> shift) & 3;
     let slot = this.slots[slotnum];
     return slot ? slot.read(a) : 0;
   };
   
   write = (a,v) => {
     let shift = (a >> 14) << 1;
     let slotnum = (this.slotmask >> shift) & 3;
     let slot = this.slots[slotnum];
     if (slot) slot.write(a, v);
   };
  
  newIOBus() {
    return {
      read: (addr) => {
        addr &= 0xff;
        //console.log('IO read', hex(addr,4));
        switch (addr) {
          case 0x98: return this.vdp.readData();
          case 0x99: return this.vdp.readStatus();
          case 0xa2:
            if (this.psg.currentRegister() == 14) return ~this.inputs[JOY_INPUT_0]; // TODO: joy 1?
            else return this.psg.readData();
          case 0xa8: return this.slotmask;
          case 0xa9: return ~this.inputs[KEYBOARD_ROW_0 + (this.ppi_c & 15)];
          case 0xaa: return this.ppi_c; // TODO?
          //default: throw new EmuHalt("Read I/O " + hex(addr));
        }
        return 0;
      },
      write: (addr, val) => {
        addr &= 0xff;
        val &= 0xff;
        //console.log('IO write', hex(addr,4), hex(val,2));
        switch (addr) {
          case 0x98: this.vdp.writeData(val); break;
          case 0x99: this.vdp.writeAddress(val); break;
          case 0xa8: this.slotmask = val; break;
          case 0xaa: this.ppi_c = val; break;
          case 0xab: // command register, modifies PPI C
            let ibit = (val >> 1) & 7;
            this.ppi_c = (this.ppi_c & ~(1<<ibit)) | ((val&1)<<ibit);
            break;
          case 0xa0: this.psg.selectRegister(val); break;
          case 0xa1: this.psg.setData(val); break; 
          case 0xfc:
          case 0xfd:
          case 0xfe:
          case 0xff:
            break; // memory mapper (MSX2)
          //default: throw new EmuHalt("Write I/O " + hex(addr));
        }
      }
    };
  }

  vdpInterrupt() {
    this.probe.logInterrupt(0xff);
    this.cpu.interrupt(0xff); // RST 0x38
  }

  loadState(state) {
    super.loadState(state);
    this.slotmask = state['slotmask'];
    this.ppi_c = state['ppi_c'];
    this.psg.selectRegister(state['psgRegister']);
  }
  saveState() {
    var state = super.saveState();
    state['slotmask'] = this.slotmask;
    state['ppi_c'] = this.ppi_c;
    state['psgRegister'] = this.psg.currentRegister();
    return state;
  }
  reset() {
    super.reset();
    this.slotmask = 0;
    this.ppi_c = 0;
  }
  /* TODO
  resume() {
    super.resume();
    this.resetInputs();
  }*/
  resetInputs() {
    // clear keyboard matrix
    this.inputs.fill(0);
  }
}


///

/*
    C-BIOS is a BIOS compatible with the MSX BIOS
    C-BIOS was written from scratch by BouKiCHi
    C-BIOS is available for free, including its source code (2-clause BSD license)
    C-BIOS can be shipped with MSX emulators so they are usable out-of-the-box without copyright issues

    http://cbios.sourceforge.net/
*/
var MSX1_BIOS_LZG = `
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
weHV5TsMNno7CjZZzYXz0eVRtuHJCNnz/eXx3eXhV6dRMtVRIUcO/N3l8VF3hygHywDLAT0g+SFn
JOXbqPWhsNnDjPNRK9FRtgjZyfPlb1EqPqvGVQXyeyRXOwNuZ0c+wAcHBfKLJF8vT3qjR32n8tYk
Dw/mA+XFOwUipSSjR3rmwGfbqG/mwLRaBAxiobBPMv//fdOoIcX8euYDhW98zgBneXfB4duoobDT
qOHJVw8PX+bAb9uoT+Y/tdOoe+YDb3wmAxgCKSnWQDD6fC9nUX5fpLVRPm9506hRPE8GAH0hxfwJ
d8l6Dw/mwEdRs7BRM1EbOwcaUVlzydOoXhgD06hzetOoUQQIzZjzCPGT4cnd6QBaBQ87MC4yOTsk
8mNiaW9zLnNmLm5ldA0KQ2hhcmFjdGVyIHNldDogVVMNCkluUQdydXB0IGZyZXF1ZW5jeTogNjBI
eg0KS2V5Ym9hcmQgdHlwZVHmkyQASW5pdCBST00gaW4gc2xvdDogAENhbm5vdCBleGVjdXRlIGEg
QkFTSUNRXS5RKUVSUk9SOgBNRU1PUlkgTk9UIEZPVU5ELgBDQUxMRURRCk4gRVhJU1RJTkdR8i4A
U1RBQ0sgUbIuADsCb05vIGNhcnRyaWRnZSBmb3VuZC5RT1RoaXMgdmVyc2lvbiBvZiA7BfxjYW4N
Cm9ubHkgc3RRLjsIM3NRLlBsZWFzZSByZVHUeW91ciBNU1gNCihlbXVsYXRvcikgd2l0aCBhOwgw
DQppbnNlcnRlZC4AMDEyMzQ1Njc4OS09XFtdOwAnYCwuLwBhYmNkZWZnaGlqa2xtbm9wcXJzdHV2
d3h5eikhQCMkJV4mKihfK3x7fToifjw+PwBBQkNERUZHSElKS0xNTk9QUQBSU1RVVldYWVoACayr
uu+99PvsBxfxHgENBgW78/IdAMQRvMfNFBUT3MbdyAsbwtvMGNISwBrPHBkPCgD9/AAA9QAACB/w
FgIOBAP3rq/2AP4A+sHO1BDW38reyQzTw9fLqdEAxdXQ+ar465/Zv5uY4OHnh+7pAO3at7nlhqan
AISXjYuMlIGxoZGzteakoqODkwCJloKViIqghditnr6cnQAA4jvCpOjqtrjkjwCoAI5RBQCZmrAA
krK0AKUA41FHO4QvkwgbCQAIAA0gDAAAHR4fHCorLzspMywuAIBwgQCCAYT1h1oEAnWTH5Mfkx+T
H5Mfkx+TH5Mfkx+TH5Mfkx+TH5Mfkx+TH5Mfkx+THpMdkwPF5cEbe7IoAwkY+FoDGKu1Mc2fCT4g
0y560y970y/x4clST01CQVM7H6CTH5Mfkx+TH5Mfkx+TH5Mfkx+TH5Mfkx+TH5MekxyTBj46kz+T
P5Ms5fUhSTpaBRvgWgMMYHN0YXRlbWVudHMgYXJlIG5vdCBpbXBsUYtlZCB5ZXQ7P7uTH5Mfkx+T
H5Mfkx+TH5Mfkx+TH5Mfkx+TH5Mfkx+TH5Mfkx+TH5Mfkx+TH5Mfkx+TH5Mfkx+TH5Mfkx+TH5Mf
kx+TH5Mfkx+TH5Mfkx+TH5Mfkx+TH5Mfkx+TH5Mfkx+TH5Mfkx+TH5Mfkx+TH5Mfkx+TH5Mfkx+T
H5Mfkx+TH5Mfkx+TH5Mfkx+TH5Mfkx+TH5Mfkx+TH5Mfkx+TH5Mfkx+TH5Mfkx+TH5Mfkx+TBc2O
WgpBt5Mfkx+TH5Mfkx+TH5Mfkx+TH5Mfkx+TH5Mfkx+TH5Mfkx+TH5Mfkx+TH5Mfkx+TH5Mfkx+T
H5Mfkx+TH5Mfkx+TH5MfWh5ixDsfeZMfkx+TH5Mfkx+TH5Mfkx+TH5MeAOX1ISJ9WgQ60XVua25v
d25AN0QxNwA5fd0hiQHNPxrJ3SGFAcM/Wh9abpMeOw71H347DfVFMTQ735aTH5Mfkx6TC1oNaeX/
zW8AWgdqSmIAKiL5AQADPgDNVgABAALNRwABA5+TogQAk6FaA3T+B5MBR1oDcC9aA3AqyfNRIyok
US4ECesBMAMhvIDNXFHJAQnrKgQACQEAA1FKyfM7Bxvsg1HJEQABGVEWPvFReyL5AYQACeshHIcG
CsXl1QEYAFEd4QEgUQzhUQUJwRDpO01I/viTYh9/k6E/OwwSHzsIAvj+OwYDfx9aA1VJ/vz48B8/
US2TBVFIAFG+kwk7CS8Afz8f+Pw7CwdaBVbh/v4fP387CUH+/DsGUPiTAfCTAR+TAT+TAVFIUdBR
zTsGKzsGCDsHJMffUQ3wOwi3WgZcfjsDen8//pMB/Pz8fDsGKAAA/PgfP3/+UWnwf1Ef/FFk8FFr
fz8fH/D++PAff3z8+D8/f5MDOwZMOwYIOwaYUUdRUFEzkwN8PDw8x5MBHx7j45Pi/Pjw8FFhOwb/
OwUfkwT+fzstdn87B7hRKz9+kwFRHvAfHz9+OwJEOwK0k+J4eHh8UVg/OyRI/vz8+DsDTzsD0loI
XXOTBTsEcfD4/HyTAlEDf39/PzsKcFGIOwJkOwwv/B+TgfA7Itw8jx9/OwJ0n5MBfH5+f+M+Pz87
JE7wPlEiOwZEOyI6OyLQ/vjxPPA7Isc7JS1RkHz8+DsiaAA/OyJV8Pj8k8L4UT07TRc7TTU7BwY7
BFz++D87S3k7SYo7CEB/OwovOwYCOyJQ/viTofA7Tac7AvaTCztz8gkJk2KQkAmTgZNhkxFRGFGX
OwUnkAGTARmTAZGRkTsHHFEEkQmRGRlRVJMGOwYIOwcZOwUoOwU4kTsGeDsHETsFIFEUUbg7QoCT
CvGTAVFQCFEfCJCQkJPjk2GBUSyBUS07BhyTgQ8Pk8EPkwFRaJPiH1FBUVZRUTsJSJPiURFRhFEu
D/FRRlHBUWtRnzsFI/GAkJCAkICAOwJwCAkICAkYGRkYGRgYGVGVOwdEAQE7B1k7B1w7Bho7BnQ7
JBg7CA6TBFHOOwSsOwJzCAg7Al8ICfHx4ZNB4VE0Hh+T4lFIHx5RBJPlUVCT4VF4k+JRkPHhk+E7
BWA7BkoPDx47BXA7BEgICAhaA1/Qk+GTA1ETGJMC4ZMBDpMBUWST4x4eUQhRTuHhHpNikwFRhDsG
AVEnUUZRJx47BTCT4lHSUZ4BAVE5OwsQUU07BnQYGBiBkwIICDtEClELUQZRDTsHkFGak+GTAxiT
pBiBUW47BrRRq1EsUVU7CEA7AliT4pMCOwffUYWAURCEOwUhBDtmAwSTDVHOAICAgYKDhIWGhzsj
JpMJiImKi4yNjo+QjJMK45GSkwCUjJWWUUSXOwkQ5JiZmoyMm5ydnp+goaKjnaSlpp2TAYzkp6ip
jIyqq4yMrK2ur4yMsLGys7OztIzktbVRLraTYbe4ubqMjLu8vb6+v8CM5MHCw4yMxMXFxsfIycrL
zM3OxcXFz9CM5NHC0jsLgZMF5NPU1dbX2Nna2zsHC1YwLjI55IDc3d7C3+Dh4pMM5VoGXW2TH5Mf
kx+TH5Mfkx+TH5Mfkx+TH5Mfkx+TH5Mfkx+TH5Mfkx+TH5Mfkx+TH5Mfkx+TH5Mfkx+TH5Mfkx+T
H5Mfkx+TH5Mfkx+TH5Mfkx+TH5Mfkx+TH5Mfkx+TH5Mfkx+TH5Mfkx+TH5Mfkx+TH5Mfkx+TH5Mf
kx+TH5Mfkx+TH5Mfkx+TH5Mfkx+TH5Mfkx+TH5Mfkx+TH5Mfkx+TH5Mfkx+TH5Mfkx+TH5Mfkx+T
H5Mfkx+TH5Mfkx+TH5Mfkx+TH5Mfkx+TH5Mfkx+TH5Mfkx+TH5Mfkx+TH5Mfkx+THpMc/w==
`;
