import * as assert from 'assert';
import { describeControls, getLastKeycodeMap, clearLastKeycodeMap } from '../../src/common/emu';
import { PLATFORM_CONTROLS, controlsText } from '../../src/common/controls';
import { loadPlatform, installNodeMocks } from '../../src/tools/emutarget';
import { findRootDir } from '../src/projectinfo';

describe('emulator controls hint', function () {
  it('describes the NES controller from its key map', async function () {
    installNodeMocks(findRootDir(__dirname));
    clearLastKeycodeMap();
    var target = await loadPlatform('nes');
    await target.start();
    var hint = controlsText(describeControls(getLastKeycodeMap()));
    assert.ok(hint.startsWith('\u2190\u2191\u2193\u2192 Joystick'), hint);
    assert.ok(hint.includes('Enter Start'), hint);
  });

  it('has hand-written hints for the IDE platforms', function () {
    assert.equal(controlsText(PLATFORM_CONTROLS.mw8080bw), '\u2190\u00a0\u2192 Joystick \u00b7 Space Fire');
    assert.equal(PLATFORM_CONTROLS.williams[0].action, 'Move');
  });
});
