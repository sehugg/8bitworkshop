"use strict";
// Error reports sent to our own server (web/error.php), shared by the web IDE
// and the VS Code extension. Each front end supplies a sender; this module
// limits sizes and volume so an error in a loop can't flood the server.
Object.defineProperty(exports, "__esModule", { value: true });
exports.ErrorReporter = exports.MAX_REPORTS_PER_SESSION = exports.ERROR_REPORT_URL = void 0;
exports.clampField = clampField;
exports.toInternalError = toInternalError;
exports.ERROR_REPORT_URL = 'https://8bitworkshop.com/error.php';
exports.MAX_REPORTS_PER_SESSION = 10;
const MAX_FIELD = 2000;
function clampField(val, max) {
    if (val == null)
        return '';
    try {
        var s = typeof val === 'string' ? val : (typeof val === 'object' ? JSON.stringify(val) : val + '');
        return s.substring(0, max);
    }
    catch (e) {
        return '<unserializable: ' + e + '>';
    }
}
function toInternalError(e) {
    return { msg: String(e && e.message || e), stack: e && e.stack };
}
class ErrorReporter {
    constructor(source, send, common = {}) {
        this.source = source;
        this.send = send;
        this.common = common;
        this.sent = 0;
        this.seen = new Set();
    }
    /**
     * Report an error once per session: the same message from the same source
     * and tool (a build that crashes on every keystroke, say) goes out once.
     * Returns true if it was sent.
     */
    report(msg, stack, fields, source) {
        source = source || this.source;
        var key = [source, fields && fields.tool, msg].join('|');
        if (this.sent >= exports.MAX_REPORTS_PER_SESSION || this.seen.has(key))
            return false;
        this.seen.add(key);
        this.sent++;
        var payload = {
            source,
            msg: clampField(msg, 500),
            stack: clampField(stack, MAX_FIELD),
            clientTime: new Date().toISOString(),
        };
        var extra = Object.assign(Object.assign({}, this.common), fields);
        for (var k in extra) {
            if (!(k in payload) && extra[k] != null)
                payload[k] = clampField(extra[k], MAX_FIELD);
        }
        this.send(payload);
        return true;
    }
    reportError(err, fields, source) {
        var ie = toInternalError(err);
        return this.report(ie.msg, ie.stack, fields, source);
    }
}
exports.ErrorReporter = ErrorReporter;
//# sourceMappingURL=telemetry.js.map