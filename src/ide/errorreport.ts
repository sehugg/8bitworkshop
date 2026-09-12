// Lightweight error reporting to our own server (replaces sentry).
// POSTs a small JSON payload to /error.php, which logs it server-side.
// See web/error.php. No dependencies and fire-and-forget: safe to call
// from error handlers, never throws. Client-side limits below prevent
// flooding.

import { current_project } from "./ui";

const MAX_ERRORS_PER_SESSION = 10;
const MIN_MS_BETWEEN_IDENTICAL = 10000;
const SEND_URL = '/error.php';
const MAX_FIELD = 2000;

// Extra context passed by the caller (active IDE window, platform, etc.)
export interface ErrorReportContext {
  window?: string;
  platform?: string;
  [key: string]: any;
}

let errorsSent = 0;
let lastMsgSent = '';
let lastMsgTime = 0;

function clamp(val: any, max: number): string {
  try {
    if (val == null) return '';
    var s = typeof val === 'string' ? val : (typeof val === 'object' ? JSON.stringify(val) : val + '');
    return s.substring(0, max);
  } catch (e) {
    return '';
  }
}

export function reportErrorToServer(msg: string, err?: any, context?: ErrorReportContext) {
  try {
    if (errorsSent >= MAX_ERRORS_PER_SESSION) return;
    // don't repeat the same error more than once every 10 seconds
    var now = Date.now();
    if (msg === lastMsgSent && now - lastMsgTime < MIN_MS_BETWEEN_IDENTICAL) return;
    errorsSent++;
    lastMsgSent = msg;
    lastMsgTime = now;

    var payload: { [k: string]: string } = {
      msg: clamp(msg, 500),
      stack: clamp(err && err.stack, 2000),
      window: clamp(context && context.window, 200),
      platform: clamp(context && context.platform, 200),
      url: clamp(window.location.href, 500),
      userAgent: clamp(navigator.userAgent, 500),
      language: clamp(navigator.language, 50),
      clientTime: new Date().toISOString(),
    };

    // copy any extra caller-supplied context fields
    if (context) {
      for (var k in context) {
        if (!(k in payload)) payload[k] = clamp(context[k], MAX_FIELD);
      }
    }

    var body = JSON.stringify(payload);

    // sendBeacon survives page unload; fall back to fetch with keepalive
    if (typeof navigator !== 'undefined' && navigator.sendBeacon) {
      navigator.sendBeacon(SEND_URL, new Blob([body], { type: 'application/json' }));
    } else if (typeof fetch !== 'undefined') {
      fetch(SEND_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: body,
        keepalive: true,
      }).catch(function () { });
    }
  } catch (e) {
    // never let error reporting throw
  }
}
