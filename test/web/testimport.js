
// https://nightwatchjs.org/api/

//var IDEURL = 'https://8bitworkshop.com/dev/';
var IDEURL = 'http://localhost:8000/'
var REPO = 'sehugg/happy2020'
var PLATFORM = 'astrocade'
var FILE = 'happy2020.c'
var PRESETFILE = 'hello.c'
var QS_GITHUBURL = '&githubURL=https%3A%2F%2Fgithub.com%2F' + REPO

try {
    var github_config = JSON.parse(require('fs').readFileSync('./github.json','utf-8'));
    exports['beforeEach'] = function(browser) {
        browser.setCookie({
            name: '__github_key',
            value: github_config.token,
            path: '/'
        });
    }
} catch (e) {
    console.log('warning: need ./github.json with {token:"..."}')
}

exports['test import Github'] = async function (browser) {

    await browser.url(`${IDEURL}?${QS_GITHUBURL}`)
        .waitForElementNotPresent('#step-0')
        .waitForElementNotVisible('#compile_spinner', time = 10000)
        .waitForElementNotVisible('#error_alert')
        .waitForElementVisible('#emuscreen')
        .waitForElementVisible('.emuvideo')
        .url(`${IDEURL}?repo=${REPO}`)

    browser.expect.url().to.contain(`platform=${PLATFORM}`)
    browser.expect.url().to.contain(`file=${FILE}`)
    browser.expect.url().to.contain(`repo=${REPO.replace('/', '%2F')}`)

    await browser.url(`${IDEURL}?`)
        .waitForElementNotVisible('#error_alert')
        .waitForElementVisible('#emuscreen')
        .waitForElementVisible('.emuvideo')

    browser.expect.url().to.contain(`platform=${PLATFORM}`)
    browser.expect.url().to.contain(`file=${FILE}`)
    browser.expect.url().to.contain(`repo=${REPO.replace('/', '%2F')}`)

    await browser.url(`${IDEURL}?repo=${REPO}`)
        .waitForElementNotVisible('#error_alert')
        .waitForElementVisible('#emuscreen')
        .waitForElementVisible('.emuvideo')

    browser.expect.url().to.contain(`platform=${PLATFORM}`)
    browser.expect.url().to.contain(`file=${FILE}`)
    browser.expect.url().to.contain(`repo=${REPO.replace('/', '%2F')}`)

    await browser.url(`${IDEURL}?platform=${PLATFORM}`)
        .waitForElementNotVisible('#error_alert')
        .waitForElementVisible('#emuscreen')
        .waitForElementVisible('.emuvideo')

    browser.expect.url().to.contain(`platform=${PLATFORM}`)
    browser.expect.url().to.contain(`file=${FILE}`)
    browser.expect.url().to.contain(`repo=${REPO.replace('/', '%2F')}`)

    await browser.url(`${IDEURL}?platform=apple2`)
        .waitForElementNotVisible('#error_alert')
        .waitForElementVisible('#emuscreen')
        .waitForElementVisible('.emuvideo')

    browser.expect.url().to.contain(`platform=apple2`)
    browser.expect.url().to.not.contain(`repo=${REPO.replace('/', '%2F')}`)

    await browser.url(`${IDEURL}?platform=${PLATFORM}&file=${PRESETFILE}`)
        .waitForElementNotVisible('#error_alert')
        .waitForElementVisible('#emuscreen')
        .waitForElementVisible('.emuvideo')

    browser.expect.url().to.contain(`platform=${PLATFORM}`)
    browser.expect.url().to.contain(`file=${PRESETFILE}`)
    browser.expect.url().to.not.contain(`repo=${REPO.replace('/', '%2F')}`)

}
