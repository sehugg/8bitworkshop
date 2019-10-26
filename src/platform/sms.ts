
import { SG1000, SMS } from "../machine/sms";
import { Platform, BaseZ80MachinePlatform, BaseMAMEPlatform, getToolForFilename_z80 } from "../common/baseplatform";
import { PLATFORMS } from "../common/emu";

// TODO: merge w/ coleco
export var SG1000_PRESETS = [
  {id:'text.c', name:'Text Mode'},
  {id:'hello.c', name:'Scrolling Text'},
  {id:'text32.c', name:'32-Column Color Text'},
  {id:'stars.c', name:'Scrolling Starfield'},
  {id:'cursorsmooth.c', name:'Moving Cursor'},
  {id:'simplemusic.c', name:'Simple Music'},
  {id:'musicplayer.c', name:'Multivoice Music'},
  {id:'mode2bitmap.c', name:'Mode 2 Bitmap'},
  {id:'mode2compressed.c', name:'Mode 2 Bitmap (LZG)'},
  {id:'lines.c', name:'Mode 2 Lines'},
  {id:'multicolor.c', name:'Multicolor Mode'},
  {id:'siegegame.c', name:'Siege Game'},
  {id:'shoot.c', name:'Solarian Game'},
  {id:'climber.c', name:'Climber Game'},
];

export var SMS_PRESETS = [
  {id:'mode4test.c', name:'Mode 4 Test'},
  {id:'climber.c', name:'Climber Game'},
];

///

class SG1000Platform extends BaseZ80MachinePlatform<SG1000> implements Platform {

  newMachine()          { return new SG1000(); }
  getPresets()          { return SG1000_PRESETS; }
  getDefaultExtension() { return ".c"; };
  readAddress(a)        { return this.machine.read(a); }
  readVRAMAddress(a)    { return this.machine.readVRAMAddress(a); }
}

class SMSPlatform extends BaseZ80MachinePlatform<SMS> implements Platform {

  newMachine()          { return new SMS(); }
  getPresets()          { return SMS_PRESETS; }
  getDefaultExtension() { return ".c"; };
  readAddress(a)        { return this.machine.read(a); }
  readVRAMAddress(a)    { return this.machine.readVRAMAddress(a); }
}

///

PLATFORMS['sms-sg1000-libcv'] = SG1000Platform;
PLATFORMS['sms-sms-libcv'] = SMSPlatform;
