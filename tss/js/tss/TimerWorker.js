/**
 * T'SoundSystem for JavaScript
 */

/**
 * Background timer implementation.
 *
 * @author Takashi Toyoshima <toyoshim@gmail.com>
 */
var timerId = undefined;

onmessage = function(e) {
    if (timerId) {
        clearInterval(timerId);
        timerId = undefined;
    }
    if (e.data > 0) {
        timerId = setInterval(function() {
            postMessage(null);
        }, e.data);
    }
};