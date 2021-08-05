
// https://nightwatchjs.org/js/app/api/method.html

//var IDEURL = 'https://8bitworkshop.com/dev/';
var IDEURL = 'http://localhost:8000/';
var QS = '?embed=1&platform=c64&file0_name=test.dasm&file0_data=%0A%20%20%20%20%20 processor 6502%0A%20%20%20%20%20 org %24803%0AFoo%3A%20 lda %231%0A%20%20%20%20%20 rts';
var EMBEDURL = 'http://localhost:8000/embed.html?p=c64&r=TFpHAAAAagAAAGPy6Sf6AQECBQYAgAmAJYDDws04MI4W0CCj%2FSBQ%2FSAV%2FSBb%2F1jqBgl4oACMINC5W4DwCRhpwJkpBMjQ8q0R0DD7rRLQzRLQ8PtKShhlA40g0AUNEOsFI8YDTDmASEVMTE9gV09STERhAA%3D%3D';

exports['test embed iframe'] = function(browser) {

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
    .waitForElementVisible('.hilite-span')

  browser.url(IDEURL + "?embed=1")
    .waitForElementVisible('.bootbox-alert')

  /* TODO
  browser.url(IDEURL + "?embed=1&platform=nes&githubURL=https://github.com/sehugg/NES-ca65-example")
    .waitForElementNotVisible('#compile_spinner', time=10000)
    .waitForElementNotVisible('#error_alert')
    .waitForElementVisible('#emuscreen')
    .waitForElementVisible('.emuvideo')
  */
}

exports['test embed.html'] = function(browser) {

  browser.url(EMBEDURL)
    .waitForElementVisible('.emuvideo')

}
