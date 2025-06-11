import { Platform } from "../common/baseplatform";
import { PLATFORMS } from "../common/emu";
import { PacmanMachine } from "../machine/pacman";
import { BaseZ80MachinePlatform } from "../common/baseplatform";

const PACMAN_PRESETS = [
  { id: 'hello.c', name: 'Hello World' },
  { id: 'maze.c', name: 'Maze Display' },
  { id: 'sprites.c', name: 'Sprite Test' },
];

class PacmanPlatform extends BaseZ80MachinePlatform<PacmanMachine> implements Platform {

  newMachine()          { return new PacmanMachine(); }
  getPresets()          { return PACMAN_PRESETS; }
  getDefaultExtension() { return ".c"; };
  readAddress(a)        { return this.machine.readConst(a); }
  readVRAMAddress(a)    { 
    if (a < 0x400) return this.machine.vram[a]; 
    else if (a < 0x800) return this.machine.cram[a-0x400];
    else return this.machine.oram[a-0x800]; 
  }
  
  // Override ROM size to include program + graphics + palette
  getROMSize() { return 0x6200; }  // 16KB program + 8KB graphics + palette space
  
  getMemoryMap = function() { return { main:[
    {name:'Program ROM',start:0x0000,size:0x4000,type:'rom'},
    {name:'Graphics ROM',start:0x4000,size:0x2000,type:'rom'}, 
    {name:'Palette ROM',start:0x6000,size:0x200,type:'rom'},
    {name:'Video RAM',start:0x4000,size:0x400,type:'ram'},
    {name:'Color RAM',start:0x4400,size:0x400,type:'ram'},
    {name:'Work RAM',start:0x4800,size:0x7F0,type:'ram'},
    {name:'Sprite RAM',start:0x4FF0,size:0x10,type:'ram'},
    {name:'I/O Registers',start:0x5000,size:0x100,type:'io'},
  ] } };
  showHelp() { return "https://8bitworkshop.com/docs/platforms/arcade/index.html#pacman-hardware" }
  
  getDebugTree() {
    let tree = super.getDebugTree();
    
    // Add palette visualization from extracted ROM data
    tree['palette'] = {
      $$: () => {
        let paletteData = {};
        for (let i = 0; i < this.machine.palette.length; i++) {
          let color = this.machine.palette[i];
          let hex = '#' + (color & 0xffffff).toString(16).padStart(6, '0');
          paletteData[`color_${i.toString().padStart(2, '0')}`] = hex;
        }
        return paletteData;
      }
    };
    
    // Add character ROM visualization
    tree['charROM'] = {
      $$: () => {
        let charData = {};
        for (let i = 0; i < Math.min(64, this.machine.charROM.length / 16); i++) {
          let charBytes = [];
          for (let j = 0; j < 16; j++) {
            let addr = i * 16 + j;
            if (addr < this.machine.charROM.length) {
              charBytes.push('$' + this.machine.charROM[addr].toString(16).padStart(2, '0'));
            }
          }
          charData[`char_${i.toString().padStart(2, '0')}`] = charBytes.join(' ');
        }
        return charData;
      }
    };
    
    // Add sprite RAM
    tree['sprites'] = {
      $$: () => {
        let spriteData = {};
        for (let i = 0; i < 8; i++) {
          let base = i * 2;
          if (base < this.machine.oram.length) {
            spriteData[`sprite_${i}`] = {
              shape: '$' + this.machine.oram[base].toString(16).padStart(2, '0'),
              color: '$' + this.machine.oram[base + 1].toString(16).padStart(2, '0')
            };
          }
        }
        return spriteData;
      }
    };
    
    // Add sprite coordinates 
    tree['sprite_coords'] = {
      $$: () => {
        let coordData = {};
        for (let i = 0; i < 8; i++) {
          let base = 0x10 + i * 2;
          if (base < this.machine.oram.length) {
            coordData[`sprite_${i}_coords`] = {
              x: this.machine.oram[base],
              y: this.machine.oram[base + 1]
            };
          }
        }
        return coordData;
      }
    };
    
    return tree;
  }
}

PLATFORMS['pacman'] = PacmanPlatform; 