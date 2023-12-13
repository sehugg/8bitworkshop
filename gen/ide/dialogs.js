"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.fatalError = exports.alertInfo = exports.alertError = exports.setWaitProgress = exports.setWaitDialog = void 0;
const dompurify_1 = __importDefault(require("dompurify"));
function setWaitDialog(b) {
    if (b) {
        setWaitProgress(0);
        $("#pleaseWaitModal").modal('show');
    }
    else {
        setWaitProgress(1);
        $("#pleaseWaitModal").modal('hide');
    }
}
exports.setWaitDialog = setWaitDialog;
function setWaitProgress(prog) {
    $("#pleaseWaitProgressBar").css('width', (prog * 100) + '%').show();
}
exports.setWaitProgress = setWaitProgress;
function alertError(s) {
    setWaitDialog(false);
    bootbox.alert({
        title: '<span class="glyphicon glyphicon-alert" aria-hidden="true"></span> Alert',
        message: dompurify_1.default.sanitize(s)
    });
}
exports.alertError = alertError;
function alertInfo(s) {
    setWaitDialog(false);
    bootbox.alert(dompurify_1.default.sanitize(s));
}
exports.alertInfo = alertInfo;
function fatalError(s) {
    alertError(s);
    throw new Error(s);
}
exports.fatalError = fatalError;
//# sourceMappingURL=dialogs.js.map