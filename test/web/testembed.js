
//var IDEURL = 'https://8bitworkshop.com/dev/';
var IDEURL = 'http://localhost:8000/';
var QS = '?embed=1&ignore=1&platform=c64&file0_name=test.dasm&file0_data=%0A%20%20%20%20%20 processor 6502%0A%20%20%20%20%20 org %24803%0AFoo%3A%20 lda %231%0A%20%20%20%20%20 rts';
var EMBEDURL = 'http://localhost:8000/';

exports['test iframe'] = function(browser) {

  browser.url(IDEURL + QS)
    .waitForElementNotVisible('#compile_spinner', time=10000)
    .waitForElementNotVisible('#error_alert')
    .waitForElementVisible('#emuscreen')
    .waitForElementVisible('.emuvideo')

}

exports['test embed.html'] = function(browser) {

  browser.url(EMBEDURL)
    .waitForElementNotVisible('#error_alert')
    .waitForElementVisible('.emuvideo')

}
