import { Platform } from "../common/baseplatform";
import { PLATFORMS } from "../common/emu";
import { PacmanMachine } from "../machine/pacman";
import { BaseZ80MachinePlatform } from "../common/baseplatform";

const PACMAN_PRESETS = [
  { id: 'hello.c', name: 'Hello World' },
  { id: 'sprites.c', name: 'Sprite Test' },
  { id: 'music.c', name: 'Music Demo' },
  { id: 'solarian.c', name: 'Solarian' },
  { id: 'siege.c', name: 'Siege Game' },
  { id: 'climber.c', name: 'Climber Game' },
  { id: 'chase.c', name: 'Chase' },
];

class PacmanPlatform extends BaseZ80MachinePlatform<PacmanMachine> implements Platform {

  newMachine()          { return new PacmanMachine(); }
  getPresets()          { return PACMAN_PRESETS; }
  getDefaultExtension() { return ".c"; };
  readAddress(a)        { return this.machine.readConst(a); }
  readVRAMAddress(a)    { 
    if (a < 0x400) return this.machine.vram[a]; 
    else if (a < 0x800) return this.machine.cram[a-0x400];
    else return this.machine.ram[0x7f0 + ((a-0x800) & 0xf)]; 
  }
  
  getMemoryMap = function() { return { main:[
    {name:'Program ROM', start:0x0000,size:0x4000,type:'rom'},
    {name:'Video RAM',   start:0x4000,size:0x400, type:'ram'},
    {name:'Color RAM',   start:0x4400,size:0x400, type:'ram'},
    {name:'Work RAM',    start:0x4800,size:0x7f0, type:'ram'},
    {name:'Sprite RAM',  start:0x4ff0,size:0x10,  type:'ram'},
    {name:'I/O Regs',    start:0x5000,size:0x100, type:'io'},
    {name:'Color PROM',  start:0x6000,size:0x20,  type:'rom'},
    {name:'Palette PROM',start:0x6100,size:0x100, type:'rom'},
    {name:'Wave ROM',    start:0x6200,size:0x100, type:'rom'},
  ] } };
  showHelp() { return "https://8bitworkshop.com/docs/platforms/arcade/index.html#pacman-hardware" }
  
  getDebugTree() {
    let tree = super.getDebugTree();
    tree['palette'] = {
      $$: () => {
        let paletteData = {};
        for (let i = 0; i < this.machine.gfx.colors.length; i++) {
          let color = this.machine.gfx.colors[i];
          paletteData[`color_${i.toString().padStart(2, '0')}`] =
            '#' + (color & 0xffffff).toString(16).padStart(6, '0');
        }
        return paletteData;
      }
    };
    tree['sprites'] = {
      $$: () => {
        let spriteData = {};
        for (let i = 0; i < 8; i++) {
          let base = 0x7f0 + i * 2;
          spriteData[`sprite_${i}`] = {
            shape: '$' + this.machine.ram[base].toString(16).padStart(2, '0'),
            color: '$' + this.machine.ram[base + 1].toString(16).padStart(2, '0'),
            x: this.machine.gfx.spritePos[i * 2],
            y: this.machine.gfx.spritePos[i * 2 + 1],
          };
        }
        return spriteData;
      }
    };
    return tree;
  }
}

PLATFORMS['pacman'] = PacmanPlatform; 