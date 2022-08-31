"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.SMS_PRESETS = exports.SG1000_PRESETS = void 0;
const sms_1 = require("../machine/sms");
const baseplatform_1 = require("../common/baseplatform");
const emu_1 = require("../common/emu");
// TODO: merge w/ coleco
exports.SG1000_PRESETS = [
    { id: 'text.c', name: 'Text Mode' },
    { id: 'hello.c', name: 'Scrolling Text' },
    { id: 'text32.c', name: '32-Column Color Text' },
    { id: 'stars.c', name: 'Scrolling Starfield' },
    { id: 'cursorsmooth.c', name: 'Moving Cursor' },
    { id: 'simplemusic.c', name: 'Simple Music' },
    { id: 'musicplayer.c', name: 'Multivoice Music' },
    { id: 'mode2bitmap.c', name: 'Mode 2 Bitmap' },
    { id: 'mode2compressed.c', name: 'Mode 2 Bitmap (LZG)' },
    { id: 'lines.c', name: 'Mode 2 Lines' },
    { id: 'multicolor.c', name: 'Multicolor Mode' },
    { id: 'siegegame.c', name: 'Siege Game' },
    { id: 'shoot.c', name: 'Solarian Game' },
    { id: 'climber.c', name: 'Climber Game' },
];
exports.SMS_PRESETS = [
    { id: 'mode4test.c', name: 'Mode 4 Test' },
    { id: 'climber.c', name: 'Climber Game' },
];
///
class SG1000Platform extends baseplatform_1.BaseZ80MachinePlatform {
    newMachine() { return new sms_1.SG1000(); }
    getPresets() { return exports.SG1000_PRESETS; }
    getDefaultExtension() { return ".c"; }
    ;
    readAddress(a) { return this.machine.read(a); }
    readVRAMAddress(a) { return this.machine.readVRAMAddress(a); }
}
class SMSPlatform extends baseplatform_1.BaseZ80MachinePlatform {
    newMachine() { return new sms_1.SMS(); }
    getPresets() { return exports.SMS_PRESETS; }
    getDefaultExtension() { return ".c"; }
    ;
    readAddress(a) { return this.machine.read(a); }
    readVRAMAddress(a) { return this.machine.readVRAMAddress(a); }
}
class GameGearPlatform extends baseplatform_1.BaseZ80MachinePlatform {
    newMachine() { return new sms_1.GameGear(); }
    getPresets() { return exports.SMS_PRESETS; }
    getDefaultExtension() { return ".c"; }
    ;
    readAddress(a) { return this.machine.read(a); }
    readVRAMAddress(a) { return this.machine.readVRAMAddress(a); }
}
///
emu_1.PLATFORMS['sms-sg1000-libcv'] = SG1000Platform;
emu_1.PLATFORMS['sms-sms-libcv'] = SMSPlatform;
emu_1.PLATFORMS['sms-gg-libcv'] = GameGearPlatform;
//# sourceMappingURL=sms.js.map