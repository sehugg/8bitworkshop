// Error reports sent to our own server (web/error.php), shared by the web IDE
// and the VS Code extension. Each front end supplies a sender; this module
// limits sizes and volume so an error in a loop can't flood the server.

/** Where the report came from: the IDE page, a build tool, the emulator, or VS Code. */
export type ErrorSource = 'ide' | 'worker' | 'emu' | 'vscode';

export const ERROR_REPORT_URL = 'https://8bitworkshop.com/error.php';

export const MAX_REPORTS_PER_SESSION = 10;
const MAX_FIELD = 2000;

/** Fields beyond msg/stack; error.php keeps any short alphanumeric key. */
export interface ErrorReportFields {
  platform?: string;
  tool?: string;
  window?: string;
  [key: string]: any;
}

/** A tool or emulator failure that isn't the user's fault, carried as plain data. */
export interface InternalError {
  msg: string;
  stack?: string;
}

export type ErrorPayload = { [k: string]: string };

export function clampField(val: any, max: number): string {
  if (val == null) return '';
  try {
    var s = typeof val === 'string' ? val : (typeof val === 'object' ? JSON.stringify(val) : val + '');
    return s.substring(0, max);
  } catch (e) {
    return '<unserializable: ' + e + '>';
  }
}

export function toInternalError(e: any): InternalError {
  return { msg: String(e && e.message || e), stack: e && e.stack };
}

export class ErrorReporter {
  private sent = 0;
  private seen = new Set<string>();

  constructor(
    readonly source: ErrorSource,
    private send: (payload: ErrorPayload) => void,
    readonly common: ErrorReportFields = {}) { }

  /**
   * Report an error once per session: the same message from the same source
   * and tool (a build that crashes on every keystroke, say) goes out once.
   * Returns true if it was sent.
   */
  report(msg: string, stack?: string, fields?: ErrorReportFields, source?: ErrorSource): boolean {
    source = source || this.source;
    var key = [source, fields && fields.tool, msg].join('|');
    if (this.sent >= MAX_REPORTS_PER_SESSION || this.seen.has(key)) return false;
    this.seen.add(key);
    this.sent++;
    var payload: ErrorPayload = {
      source,
      msg: clampField(msg, 500),
      stack: clampField(stack, MAX_FIELD),
      clientTime: new Date().toISOString(),
    };
    var extra = { ...this.common, ...fields };
    for (var k in extra) {
      if (!(k in payload) && extra[k] != null) payload[k] = clampField(extra[k], MAX_FIELD);
    }
    this.send(payload);
    return true;
  }

  reportError(err: any, fields?: ErrorReportFields, source?: ErrorSource): boolean {
    var ie = toInternalError(err);
    return this.report(ie.msg, ie.stack, fields, source);
  }
}
