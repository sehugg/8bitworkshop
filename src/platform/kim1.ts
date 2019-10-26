
import { Platform, getOpcodeMetadata_6502, getToolForFilename_6502 } from "../common/baseplatform";
import { PLATFORMS } from "../common/emu";
import { KIM1 } from "../machine/kim1";
import { Base6502MachinePlatform } from "../common/baseplatform";

var KIM1_PRESETS = [
  {id:'hello.dasm', name:'Hello World (ASM)'},
];

class KIM1Platform extends Base6502MachinePlatform<KIM1> implements Platform {

  newMachine()          { return new KIM1(); }
  getPresets()          { return KIM1_PRESETS; }
  getDefaultExtension() { return ".dasm"; };
  readAddress(a)        { return this.machine.readConst(a); }

  getMemoryMap = function() { return { main:[
      {name:'RAM',          start:0x0000,size:0x1400,type:'ram'},
      {name:'6530',         start:0x1700,size:0x0040,type:'io'},
      {name:'6530',         start:0x1740,size:0x0040,type:'io'},
      {name:'RAM',          start:0x1780,size:0x0080,type:'ram'},
      {name:'BIOS',         start:0x1800,size:0x0800,type:'rom'},
  ] } };
}

///

PLATFORMS['kim1'] = KIM1Platform;

// https://github.com/jefftranter/6502/blob/master/asm/KIM-1/ROMs/kim.s
const KIM1_BIOS_LZG = `TFpHAAAIAAAABY3ivWkoAQsOJSiprY3sFyAyGaknjUIXqb+NQxeiZKkWIHoZytD4qSoo4a35FyBhGa31FyBeGa32KKPtF833F63uF+34F5AkqS8lXeclnegooqICqQQOBTgAhfqF+0xPHCDsJXAg6hlMMxgPGamNDgVrTI3vF61xGI3wF61yGI3xF6kHDgJ8/43pFyBBGk7pFw3pFyUErekXyRbQ7aIKICQaJQHfytD2JUIq8AYlBtHw8yDzGc35F/ANrfkXyQAlDf/wF9CcJQ0gTBmN7RcOBQHuF0z4GCXEKKSiAiV9L/AUIAAa0CPK0PElDEzsFw4CnCWhzecX0Awo4ugX0ASpAPACqf8OBcWt9ReN7Ret9heN7hepYI3vF6kAjecXjegXYKgYbSUB5xet6BdpACUJmGAgTBmoSigBIG8ZmChiYCkPyQoYMAJpB2kwjukXjOoXoAggnhlKsAYooUyRGSDEKEKI0Ouu6Res6hdgoglILEcXEPupfo1EF6mnjUIXDgkHDiKqytDfaGCiBg4FHsMODB4lhw4HHu7tF9AD7u4XYCAkGiAAGiikYMkwMB7JRxAayUAwAxhpCSooAaQEKi7pF4jQ+a3pF6AAYMhgjusXoggOIovqFw3qF43qF8rQ8a3qFypKrusXYCxCFxD7rUYXoP+MKIEUiND9JQow+zjtDgYLByULSf8pgGAOSFsOBJeaDgymJYclW0x1Gv8oHygfKB4oGWsaKCKF82iF8WiF74X6aIXwhfuE9Ib1uobyIIgeTE8cbPoXbP4Xov+aJYmp/43zF6kBLEAX0Bkw+an8GGkBkAPu8xesQBcQ843yDkIbah4gjB4l2x4gLx6iCiAxHkyvHakAhfiF+SBaHskB8AYgrB9M2x0gGR/Q0yWi8MwlBPD0KILvIGofyRUQu8kU8ETJEPAsyREoYRLwL8kT8DEKKAGF/KIEpP/QCrH6BvwqkfpMwxwKJvom+8rQ6vAIqQHQAqkAhf8OgmZjHyihTMgdpe+F+qXwDoR6Wh7JO9D5JRr3hfYgnR+qIJEfKMGF+yjl+ijhivAPJQORJUMlO8rQ8uglB8X20BcowvfQE4rQuaIMDkOaDgLPTxwlD6IR0O4OBNYoofaF9yAvHqk7IKAepfrN9xel+w6iGRipACA7HiDMHyAeHqX2JQOl9yiBTGQcqRiqJVGRJVGgALH6DgUFDgJy8A4IIeb40ALm+UxIHSV6Lx4lJCCeDgcnng4CQCUqTKwdpvKapftIpfpIpfFIpvWk9KXzQMkg8MrJf/AbyQ3w28kK8BzJLvAmyUfw1clR8ArJTPAJTGocDiIgQh1M5xw4pfrpAYX6sALG+0ysHaAApfiR+kzCHaX7DgSOpQ4FlmCiB73VHyCgHsoQ92CF/A6D00wepfwogw6K1UygHob9oggORAQiMPkg1B4g6x6tQBcpgEb+Bf6F/iUJytDvJQym/aX+KkpgogGG/6IAjkEXoj+OQxeiB45CF9h4YKkghf6G/SUkrUIXKf4OInLUHqIIJYVG/mkAJcnK0O4lCgkBJcam/WCt8xeN9Bet8hc46QGwA870F6z0FxDzDggPSk70F5DjCYCw4KADogGp/45CF+joLUAXiND1oAeMQhcJgEn/YA4iXIX5qX+NQReiCaADufgADgPmSB8lAikPKOGI0OslMakAJRlM/h6E/Ki55x+gAIxAFyUOjUAXoH+I0P3o6KT8YOb60ALm+2CiIaABIAIf0AfgJ9D1qRVgoP8KsAPIEPqKKQ9KqpgQAxhpB8rQ+mAYZfeF96X2aQCF9mAgWh4grB8opKX4DqKkG8lHEBcOqaSgBCom+Cb5iA7iZWCl+IX6pfmF+2AAKAMKDU1JSyATUlJFIBO/htvP5u39h//v9/y53vnx////HBwiHB8c`;

