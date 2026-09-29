// Error reporting from the web IDE to our own server (replaces sentry).
// POSTs a small JSON payload to /error.php (see web/error.php), which logs
// it. Fire-and-forget: safe to call from error handlers, never throws.
// ErrorReporter (common/telemetry) limits volume.

import { ErrorReporter, ErrorPayload, ErrorReportFields, ErrorSource, InternalError, isBotUserAgent } from "../common/telemetry";

const SEND_URL = '/error.php';

// crawlers and automated browsers hit odd URLs; their errors are noise
const isBot = typeof navigator !== 'undefined' && (navigator.webdriver || isBotUserAgent(navigator.userAgent));

function send(payload: ErrorPayload) {
  if (isBot) return;
  payload.url = window.location.href.substring(0, 500);
  payload.userAgent = navigator.userAgent.substring(0, 500);
  payload.language = navigator.language;
  var body = JSON.stringify(payload);
  // sendBeacon survives page unload; fall back to fetch with keepalive
  if (navigator.sendBeacon) {
    navigator.sendBeacon(SEND_URL, new Blob([body], { type: 'application/json' }));
  } else {
    fetch(SEND_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: body,
      keepalive: true,
    }).catch(e => console.log('error report failed', e));
  }
}

const reporter = new ErrorReporter('ide', send);

export function reportErrorToServer(msg: string, err?: any, fields?: ErrorReportFields, source?: ErrorSource) {
  try {
    reporter.report(msg, err && err.stack, fields, source);
  } catch (e) {
    console.log('error report failed', e);
  }
}

/** A build tool crash that the worker returned as `internal` on its result. */
export function reportInternalError(source: ErrorSource, ie: InternalError, fields?: ErrorReportFields) {
  try {
    reporter.report(ie.msg, ie.stack, fields, source);
  } catch (e) {
    console.log('error report failed', e);
  }
}
