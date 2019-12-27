
//var IDEURL = 'https://8bitworkshop.com/dev/';
var IDEURL = 'http://localhost:8000/';

function testCompile(browser, platform_id, platform_name) {
  // wait for page to load
  browser
    .waitForElementVisible('body')
    .waitForElementVisible('#booksMenuButton')
    .waitForElementVisible('#preset_select')
    .assert.containsText('#platformsMenuButton', platform_name)
    .waitForElementNotVisible('#compile_spinner')
    .waitForElementNotVisible('#error_alert')
    .waitForElementNotPresent('.bootbox-alert');

  if (platform_id == 'vcs') {
    browser.waitForElementVisible('#javatari-screen');
  } else {
    browser.waitForElementVisible('#emuscreen');
    browser.waitForElementVisible('.emuvideo');
    browser.waitForElementVisible('a[data-wndid="#memmap"]');
  }
}

function testDebugging(browser) {
    // do some debugging
    browser
      .waitForElementVisible('#dbg_go.btn_active')
      .click('#dbg_step')
      .waitForElementVisible('#dbg_step.btn_stopped')
      .waitForElementVisible('#mem_info')
      .click('#dbg_reset')
      .waitForElementVisible('#dbg_reset.btn_stopped')
      .waitForElementVisible('#mem_info')
      .click('#dbg_tovsync')
      .waitForElementVisible('#dbg_tovsync.btn_stopped')
      .waitForElementVisible('#mem_info')
      .click('#dbg_go')
      .waitForElementVisible('#dbg_go.btn_active')
      .waitForElementNotVisible('#mem_info');
      /*
      .click('a[data-wndid="#disasm"]')
      .click('a[data-wndid="#memory"]')
      .click('a[data-wndid="#memmap"]')
      */
}

function testTourDialog(browser) {
    // tour dialog dismiss
    browser
      .waitForElementVisible('#step-0')
      .click('button[data-role="end"]');
}

function testPlatform(exports, platform_id, platform_name, numPresets) {
  exports['load_'+platform_id] = function(browser) {
      browser.url(IDEURL + '?platform='+platform_id+"&file=NOEXIST");
      browser.waitForElementVisible('.bootbox-alert'); // test unknown file alert (TODO: check text)
      browser.waitForElementNotVisible('#error_alert'); // but it will build anyway
      testTourDialog(browser);
  }
  for (let i=1; i<=numPresets; i++) {
    exports['load_'+platform_id+'_'+i] = function(browser) {
      browser.click('#preset_select option:nth-child('+(i+1)+')');
      testCompile(browser, platform_id, platform_name);
      browser.getTitle( (title) => { console.log(title); } );
      testDebugging(browser);
    }
  }
  exports['end_'+platform_id] = function(browser) {
    browser.end();
  }
}

///

testPlatform(this, 'vcs', 'Atari 2600', 35);
testPlatform(this, 'nes', 'NES', 30);
testPlatform(this, 'vicdual', 'VIC Dual', 7);
testPlatform(this, 'mw8080bw', 'Midway 8080', 3);
testPlatform(this, 'galaxian-scramble', 'Galaxian/Scramble', 3);
testPlatform(this, 'vector-z80color', 'Atari Color Vector (Z80)', 3);
testPlatform(this, 'williams-z80', 'Williams (Z80)', 3);
// TODO testPlatform(this, 'sound_williams-z80', 'Williams Sound (Z80)', 1);
testPlatform(this, 'coleco', 'ColecoVision', 12);
//testPlatform(this, 'sms-sg1000-libcv', 'Sega SG-1000', 3);
testPlatform(this, 'sms-sms-libcv', 'Sega Master System', 2);
testPlatform(this, 'atari7800', 'Atari 7800', 1);
testPlatform(this, 'astrocade', 'Bally Astrocade', 12);
testPlatform(this, 'apple2', 'Apple ][+', 10);

