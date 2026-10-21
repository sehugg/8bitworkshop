
// https://nightwatchjs.org/js/app/api/method.html

//var IDEURL = 'https://8bitworkshop.com/dev/';
var IDEURL = 'http://localhost:8000/';
var QS = '?embed=1&platform=c64&file0_name=test.dasm&file0_data=%0A%20%20%20%20%20 processor 6502%0A%20%20%20%20%20 org %24803%0AFoo%3A%20 lda %231%0A%20%20%20%20%20 rts';
var PLAY_C64 = 'http://localhost:8000/player.html?p=c64&r=TFpHAAAAagAAAGPy6Sf6AQECBQYAgAmAJYDDws04MI4W0CCj%2FSBQ%2FSAV%2FSBb%2F1jqBgl4oACMINC5W4DwCRhpwJkpBMjQ8q0R0DD7rRLQzRLQ8PtKShhlA40g0AUNEOsFI8YDTDmASEVMTE9gV09STERhAA%3D%3D';
var PLAY_VCS = 'http://localhost:8000/player.html?p=vcs&r=TFpHAAAQAAAAAznPvjFnAQsSExSFAoQGOOkPsPxJBwoUAZUQlSBgABQeFByxiDGGhRuxiqqxkDGOhQKFHIYGsZKFBwQA6hQHiBIMHBIFGrGEqoixhJUAxIPQu2AA%2F9jY2NzY1NSsFAGopEhGAM%2FubGwcPHx1vbW%2B9n58PGb%2F%2F9tJfhQBPACGhIaEiISIKCQUI%2Fr4%2Bvz%2B%2FP5IRhMsxtbmJig4SFhoWEg4KIiOFATo5OjkEh7lFB4UGxQD%2FxQLEh%2BGFB8UGgkgCB8OIggPDgcOJAhCCQMU4Q8OJhMMKAgsCD8O%2Fw8ACAAPFDbwDyQIJgj4DywSChwNAA4TTiwI%2BA7gDRIYNhN0%2Fg8mCP8SBjYN4A0mCOANEwYJFDsJ%2FxQ7%2FwkASEhQUFB4fPz0f3REZgD2FAKqrg4eFAISA%2BwyfK1WoF%2FYGBgSDgbWFALKyMYORHREfnw8ODAQEAgABAQIAAAeHiw6OERCMEREMjAODtTw%2Fhrz8%2FP04gwMKPP09PR42KIAiqjKmkjQ%2B6kBhQqpAIWEqfOFhakOhQKFAErQ%2BakqhQKNlgLmgKWAqWSFxBShHoXQEx64EwbFqZaF0RMuuaWAKX%2BFxhShHwlgqVWF0qkChboTTBhpEIXHE48gEy%2FTEw%2B7qQqFyBRh1KkDhbygAKIAIHn2oAGiCBTBhQKgAqIQIGb2oAOiGBTCBKIgFMGpEIW2pcQTIQDwpcWiARTBhQKFKoUrpZWFg6IAhgSGBYYm6IYlrYQC0PuFAqkAhQGp5RIDq6C0IIDwwADQA0w%2B9hKGgIWBEoSLjBMDjRMkHKWBhQamtrWGhY61h4WPtYyFgqWMhRuljYUGEoaeE14SGzeFAqWCEqmAhYKFERMLEh0%2BpYKFIaa2tYiFkLWJhZG1ioWStYuFkxIGPxIC6xIcQxIHyI2Fg4oYaQiFthIIORIKN0wi9RTBG4UchQ2FDoUPEiY0AoUBqSASIzQSBQpMXfS5xACVjLnQACn%2BGGkYlYWpAJWNEwaFganXOOWBlYap8ekAlYe5uACouTb0E0qIuTr0EwuJuT4Th4q5QhNHixLekhQfFB8UHxQfFB8UHxQfFB8UHxQfFB8UHxQfFB8UHxQfFB8UHxQDRvQUIg%3D%3D';

// nightwatch's execute() returns the raw value, but some versions wrap it
function execResult(r) {
  return (r && typeof r === 'object' && 'value' in r) ? r.value : r;
}

exports['test embed IDE in iframe'] = function(browser) {

  browser.url(IDEURL + QS)
    .waitForElementNotPresent('#step-0')
    .waitForElementNotVisible('#compile_spinner', time=10000)
    .waitForElementNotVisible('#error_alert')
    .waitForElementVisible('#emuscreen')
    .waitForElementVisible('.emuvideo')

  browser.url(IDEURL + QS + "&ignore=1")
    .waitForElementNotVisible('#compile_spinner', time=10000)
    .waitForElementNotVisible('#error_alert')
    .waitForElementVisible('#emuscreen')
    .waitForElementVisible('.emuvideo')

  browser.url(IDEURL + QS + "&highlight=2,4")
    .waitForElementNotVisible('#compile_spinner', time=10000)
    .waitForElementNotVisible('#error_alert')
    .waitForElementVisible('#emuscreen')
    .waitForElementVisible('.emuvideo')
    //.waitForElementVisible('.hilite-span')

  browser.url(IDEURL + "?embed=1&platform=vcs")
    .waitForElementNotVisible('#compile_spinner', time=10000)
    .waitForElementNotVisible('#error_alert')
    .waitForElementVisible('#javatari-div')

  browser.url(IDEURL + "?embed=1&platform=nes")
    .waitForElementNotVisible('#compile_spinner', time=10000)
    .waitForElementNotVisible('#error_alert')
    .waitForElementVisible('#emuscreen')
    .waitForElementVisible('.emuvideo')

  browser.url(IDEURL + "?embed=1&platform=c64&importURL=/presets/c64/hello.dasm")
    .waitForElementNotVisible('#compile_spinner', time=10000)
    .waitForElementNotVisible('#error_alert')
    .waitForElementVisible('#emuscreen')
    .waitForElementVisible('.emuvideo')

  browser.url(IDEURL + "?embed=1&platform=c64&importURL=/presets/c64/hello.dasm")
    .waitForElementNotVisible('#compile_spinner', time=10000)
    .waitForElementNotVisible('#error_alert')
    .waitForElementVisible('#emuscreen')
    .waitForElementVisible('.emuvideo')

  browser.url(IDEURL + "?embed=1")
    .waitForElementVisible('.bootbox-alert')

  /* TODO
  browser.url(IDEURL + "?embed=1&platform=nes&githubURL=https://github.com/8bitworkshop/NES-ca65-example")
    .waitForElementNotVisible('#compile_spinner', time=10000)
    .waitForElementNotVisible('#error_alert')
    .waitForElementVisible('#emuscreen')
    .waitForElementVisible('.emuvideo')
  */
}

exports['test sdcc platform builds and runs'] = async function(browser) {
  // sdcc-based platforms load a big toolchain filesystem package. Firefox
  // used to hang on that forever (see src/worker/wasmutils.ts), so wait for
  // the program to actually run, not just for the page to load.
  await browser.url(IDEURL + "?embed=1&platform=gb")
    .waitForElementVisible('#emuscreen', 10000)
    .waitForElementVisible('.emuvideo', 10000);

  var drew = false;
  for (var i = 0; i < 30 && !drew; i++) {
    var r = await browser.execute(function() {
      var c = document.querySelector('canvas');
      if (!c) return false;
      var ctx = c.getContext('2d');
      var data = ctx.getImageData(0, 0, c.width, c.height).data;
      var colors = {};
      for (var i = 0; i < data.length; i += 4) {
        colors[data[i] + ',' + data[i + 1] + ',' + data[i + 2]] = 1;
      }
      return Object.keys(colors).length > 1; // the program drew something
    });
    drew = (execResult(r) === true);
    if (!drew) await browser.pause(1000);
  }
  browser.assert.ok(drew, 'the Game Boy program never drew anything');

  var alert = await browser.execute(function() {
    var e = document.querySelector('#error_alert');
    return e ? getComputedStyle(e).display : 'none';
  });
  browser.assert.notStrictEqual(execResult(alert), 'block', 'the IDE reported an error');
}

exports['test narrow tab layout'] = function(browser) {
  // below the 760px breakpoint the panes become tabs (see ide/layout.ts)
  browser.windowSize('current', 600, 900)
    .url(IDEURL + QS)
    .waitForElementNotVisible('#compile_spinner', time=10000)
    .waitForElementNotVisible('#error_alert')
    .waitForElementVisible('#mobiletabs')
    .click('.mobiletab[data-tab="emulator"]')
    .waitForElementVisible('#emuscreen')
    .waitForElementVisible('.emuvideo')
    .click('.mobiletab[data-tab="editor"]')
    .waitForElementVisible('#workspace')
    .waitForElementNotVisible('#emuscreen')

  // widening the window should restore the side-by-side panes
  browser.windowSize('current', 1280, 1024)
    .waitForElementNotVisible('#mobiletabs')
    .waitForElementVisible('#workspace')
    .waitForElementVisible('#emuscreen')
    .waitForElementVisible('.emuvideo')
}

exports['test standalone player'] = function(browser) {

  browser.url(PLAY_C64)
    .waitForElementVisible('.emuvideo')

  browser.url(PLAY_VCS)
    .waitForElementVisible('#javatari-div')

}
