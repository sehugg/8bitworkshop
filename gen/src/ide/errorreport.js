"use strict";
// Error reporting from the web IDE to our own server (replaces sentry).
// POSTs a small JSON payload to /error.php (see web/error.php), which logs
// it. Fire-and-forget: safe to call from error handlers, never throws.
// ErrorReporter (common/telemetry) limits volume.
Object.defineProperty(exports, "__esModule", { value: true });
exports.reportErrorToServer = reportErrorToServer;
exports.reportInternalError = reportInternalError;
const telemetry_1 = require("../common/telemetry");
const SEND_URL = '/error.php';
function send(payload) {
    payload.url = window.location.href.substring(0, 500);
    payload.userAgent = navigator.userAgent.substring(0, 500);
    payload.language = navigator.language;
    var body = JSON.stringify(payload);
    // sendBeacon survives page unload; fall back to fetch with keepalive
    if (navigator.sendBeacon) {
        navigator.sendBeacon(SEND_URL, new Blob([body], { type: 'application/json' }));
    }
    else {
        fetch(SEND_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: body,
            keepalive: true,
        }).catch(e => console.log('error report failed', e));
    }
}
const reporter = new telemetry_1.ErrorReporter('ide', send);
function reportErrorToServer(msg, err, fields, source) {
    try {
        reporter.report(msg, err && err.stack, fields, source);
    }
    catch (e) {
        console.log('error report failed', e);
    }
}
/** A build tool crash that the worker returned as `internal` on its result. */
function reportInternalError(source, ie, fields) {
    try {
        reporter.report(ie.msg, ie.stack, fields, source);
    }
    catch (e) {
        console.log('error report failed', e);
    }
}
//# sourceMappingURL=errorreport.js.map