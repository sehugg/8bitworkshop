// Error reports to 8bitworkshop.com (web/error.php) through VS Code's
// TelemetryLogger, which honors the user's telemetry.telemetryLevel setting,
// and scrubs user paths and other personal data. Only errors are reported:
// tool and emulator crashes, and exceptions thrown by this extension.

import * as vscode from 'vscode';
import { ERROR_REPORT_URL, ErrorPayload, ErrorReporter, ErrorReportFields, ErrorSource, InternalError, MAX_REPORTS_PER_SESSION, clampField } from '../../src/common/telemetry';

export class ErrorTelemetry implements vscode.Disposable {
  private logger: vscode.TelemetryLogger;
  private reporter: ErrorReporter;
  private unhandled = 0;

  constructor(private log: (msg: string) => void, private url = ERROR_REPORT_URL) {
    this.logger = vscode.env.createTelemetryLogger({
      sendEventData: (_name, data) => this.post(data || {}),
      // exceptions VS Code caught from this extension
      sendErrorData: (err, data) => {
        if (this.unhandled++ >= MAX_REPORTS_PER_SESSION) return;
        this.post({ ...data, source: 'vscode', msg: err.message, stack: err.stack });
      },
    });
    this.reporter = new ErrorReporter('vscode', payload => this.logger.logError('error', payload));
  }

  /** A tool or emulator failure, as a worker returned it. */
  reportInternal(source: ErrorSource, ie: InternalError, fields?: ErrorReportFields) {
    this.reporter.report(ie.msg, ie.stack, fields, source);
  }

  reportError(source: ErrorSource, err: any, fields?: ErrorReportFields) {
    this.reporter.reportError(err, fields, source);
  }

  private post(data: Record<string, any>) {
    var payload: ErrorPayload = {};
    for (var k in data) payload[k] = clampField(data[k], 2000);
    fetch(this.url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    }).catch(e => this.log(`error report failed: ${e}`));
  }

  dispose() {
    this.logger.dispose();
  }
}
