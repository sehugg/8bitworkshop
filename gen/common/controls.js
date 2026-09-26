"use strict";
// controls - the control hints shown under the emulator ("←↑↓→ Joystick,
// Space Button"), per root platform. The IDE and the VS Code emulator panel
// both render them; platforms missing here fall back to hints generated from
// their key map (describeControls in emu.ts).
Object.defineProperty(exports, "__esModule", { value: true });
exports.PLATFORM_CONTROLS = void 0;
exports.controlsText = controlsText;
const ARROWS = '←↑↓→';
const LEFT_RIGHT = '← →';
const JOYPAD_AB = [
    { keys: [ARROWS], action: 'Joypad' },
    { keys: ['Space'], action: 'Button A' },
    { keys: ['Shift'], action: 'Button B' },
];
const ARCADE = [
    { keys: [ARROWS], action: 'Joystick' },
    { keys: ['Space'], action: 'Button 1' },
    { keys: ['Shift'], action: 'Button 2' },
    { keys: ['\\'], action: 'Coin' },
    { keys: ['Enter'], action: 'Start' },
];
const CONSOLE = [
    ...JOYPAD_AB,
    { keys: ['\\'], action: 'Select' },
    { keys: ['Enter'], action: 'Start' },
];
const JOYSTICK_SPACE = [
    { keys: [ARROWS], action: 'Joystick' },
    { keys: ['Space'], action: 'Button' },
];
/** Keyed by getRootBasePlatform(platform id). */
exports.PLATFORM_CONTROLS = {
    vcs: JOYSTICK_SPACE,
    c64: JOYSTICK_SPACE,
    apple2: [
        { keys: ['Mouse'], action: 'Paddles/Joystick' },
        { keys: ['Click'], action: 'Button 1' },
        { keys: ['SHIFT-Click'], action: 'Button 2' },
        { keys: ['ALT-Click'], action: 'Button 3' },
    ],
    nes: CONSOLE,
    atari7800: CONSOLE,
    pce: CONSOLE,
    gb: CONSOLE,
    msx: JOYPAD_AB,
    coleco: JOYPAD_AB,
    sms: [...JOYPAD_AB, { keys: ['Enter'], action: 'Start' }],
    vicdual: ARCADE,
    galaxian: ARCADE,
    vector: ARCADE,
    mw8080bw: [
        { keys: [LEFT_RIGHT], action: 'Joystick' },
        { keys: ['Space'], action: 'Fire' },
    ],
    williams: [
        { keys: ['A W S D'], action: 'Move' },
        { keys: [ARROWS], action: 'Fire' },
        { keys: ['\\'], action: 'Coin' },
        { keys: ['Enter'], action: 'Start' },
        { keys: ['6 7 8 9'], action: 'Extra' },
    ],
    astrocade: [
        { keys: [ARROWS], action: 'Joystick' },
        { keys: ['Space'], action: 'Trigger' },
        { keys: ['Mouse X'], action: 'Knob' },
        { keys: ['U I O P\nJ K L /\n7 8 9 X\n4 5 6 -\n1 2 3 ,\n\\ 0 . ='], action: 'Keypad' },
    ],
    vectrex: [
        { keys: [ARROWS], action: 'Joystick' },
        { keys: ['Z X C V'], action: 'Buttons' },
    ],
    atari8: [
        { keys: [ARROWS], action: 'Joystick' },
        { keys: ['Shift'], action: 'Button' },
        { keys: ['F1'], action: 'Start' },
        { keys: ['F2'], action: 'Select' },
        { keys: ['F3'], action: 'Option' },
    ],
    pacman: [
        { keys: [LEFT_RIGHT], action: 'Joystick' },
        { keys: ['Space'], action: 'Fire' },
        { keys: ['5', '6'], action: 'Coin' },
        { keys: ['Enter', '2'], action: 'Start' },
    ],
};
/** One line of plain text: "←↑↓→ Joystick · Space Button". */
function controlsText(hints) {
    return (hints || []).map(h => h.keys.map(k => k.replace(/\n/g, ' ')).join(' ') + ' ' + h.action).join(' · ');
}
//# sourceMappingURL=controls.js.map