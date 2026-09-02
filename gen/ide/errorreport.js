"use strict";
// Lightweight error reporting to our own server (replaces sentry).
// Sends a GET image beacon to /err.gif - the web server returns 404,
// but the request (with the error in the query string) lands in the
// access log. Grep it with:
//   grep 'err.gif' access.log
// No dependencies, fire-and-forget, safe to call from error handlers.
// NOTE: no server-side rate limiting or log rotation - the web
// server's log rotation handles size; client-side limits below
// prevent flooding.
Object.defineProperty(exports, "__esModule", { value: true });
exports.reportErrorToServer = reportErrorToServer;
const MAX_ERRORS_PER_SESSION = 10;
let errorsSent = 0;
let lastMsgSent = '';
let lastMsgTime = 0;
function reportErrorToServer(msg, err) {
    try {
        if (errorsSent >= MAX_ERRORS_PER_SESSION)
            return;
        // don't repeat the same error more than once per 10 seconds
        const now = Date.now();
        if (msg === lastMsgSent && now - lastMsgTime < 10000)
            return;
        errorsSent++;
        lastMsgSent = msg;
        lastMsgTime = now;
        var params = {
            msg: (msg + '').substring(0, 300),
            stack: (err && err.stack ? err.stack + '' : '').substring(0, 1000),
            url: window.location.href,
        };
        var qs = Object.keys(params).map((k) => k + '=' + encodeURIComponent(params[k])).join('&');
        var img = new Image();
        img.src = '/err.gif?' + qs;
    }
    catch (e) {
        // never let error reporting throw
    }
}
//# sourceMappingURL=errorreport.js.map