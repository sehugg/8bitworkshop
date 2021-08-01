
//var IDEURL = 'https://8bitworkshop.com/dev/';
var IDEURL = 'http://localhost:8000/';

function testCompile(browser, platform_id, platform_name) {
  // wait for page to load
  browser
    .waitForElementVisible('body')
    .waitForElementVisible('#booksMenuButton')
    .waitForElementVisible('#preset_select')
    .assert.containsText('#platformsMenuButton', platform_name)
    .waitForElementNotVisible('#compile_spinner', time=10000)
    .waitForElementNotVisible('#error_alert')
    .waitForElementNotPresent('.bootbox-alert');

  if (platform_id == 'vcs') {
    browser.waitForElementVisible('#javatari-screen');
  } else if (platform_id == 'verilog') {
    browser.waitForElementVisible('#emuoverlay');
  } else if (platform_id == 'basic' || platform_id == 'zmachine') {
    browser.waitForElementVisible('.transcript-line');
  } else {
    browser.waitForElementVisible('#emuscreen');
    browser.waitForElementVisible('.emuvideo');
    browser.waitForElementVisible('a[data-wndid="#memmap"]');
  }
}

function testDebugging(browser, platform_id) {
  if (platform_id == 'verilog') return;
  if (platform_id == 'basic') return;
  if (platform_id == 'zmachine') return;
    // do some debugging
    browser
      .waitForElementVisible('#dbg_go.btn_active')
      .click('#dbg_step')
      .waitForElementVisible('#dbg_step.btn_stopped')
      .waitForElementVisible('#mem_info')
      .click('#dbg_restart')
      .waitForElementVisible('#dbg_restart.btn_stopped')
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

function testInitialLoad(exports, platform_id) {
  exports['load '+platform_id+' none'] = function(browser) {
    var ext = "";
    if (platform_id == 'zmachine') ext = '.inf';
    browser.url(IDEURL + '?platform='+platform_id+"&file=NOEXIST" + ext);
    browser.waitForElementVisible('.bootbox-alert'); // test unknown file alert (TODO: check text)
    browser.waitForElementNotVisible('#error_alert'); // but it will build anyway
    testTourDialog(browser);
  }
}

function testPlatform(exports, platform_id, platform_name, numPresets) {
  testInitialLoad(exports, platform_id);
  for (let i=1; i<=numPresets; i++) {
    exports['load '+platform_id+' '+i] = function(browser) {
      browser.click('#preset_select option:nth-child('+(i+1)+')');
      testCompile(browser, platform_id, platform_name);
      browser.getTitle( (title) => { console.log(title); } );
      testDebugging(browser, platform_id);
    }
  }
  exports['end '+platform_id] = function(browser) {
    browser.end();
  }
  exports['@tags'].push(platform_id);
}

///

var ex = module.exports;
ex['@tags'] = []
testPlatform(ex, 'vcs', 'Atari 2600', 35);
testPlatform(ex, 'nes', 'NES', 30);
testPlatform(ex, 'vicdual', 'VIC Dual', 7);
testPlatform(ex, 'mw8080bw', 'Midway 8080', 3);
testPlatform(ex, 'galaxian-scramble', 'Galaxian/Scramble', 3);
testPlatform(ex, 'vector-z80color', 'Atari Color Vector (Z80)', 3);
testPlatform(ex, 'williams-z80', 'Williams (Z80)', 3);
// TODO testPlatform(ex, 'sound_williams-z80', 'Williams Sound (Z80)', 1);
testPlatform(ex, 'coleco', 'ColecoVision', 12);
//testPlatform(ex, 'sms-sg1000-libcv', 'Sega SG-1000', 3);
testPlatform(ex, 'sms-sms-libcv', 'Sega Master System', 2);
testPlatform(ex, 'atari7800', 'Atari 7800', 1);
testPlatform(ex, 'astrocade', 'Bally Astrocade', 12);
testPlatform(ex, 'verilog', 'Verilog', 33);
testPlatform(ex, 'apple2', 'Apple ][+', 10);
testPlatform(ex, 'basic', 'BASIC', 10);
testPlatform(ex, 'zmachine', 'Z-Machine', 19);
//testPlatform(ex, 'atari8-800xl.mame', 'Atari 800XL', 9);
testPlatform(ex, 'msx', 'MSX', 5);
testPlatform(ex, 'zx', 'ZX', 3);
