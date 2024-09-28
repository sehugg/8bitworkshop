"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.setWaitDialog = setWaitDialog;
exports.setWaitProgress = setWaitProgress;
exports.alertError = alertError;
exports.alertInfo = alertInfo;
exports.fatalError = fatalError;
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
function setWaitProgress(prog) {
    $("#pleaseWaitProgressBar").css('width', (prog * 100) + '%').show();
}
function alertError(s) {
    setWaitDialog(false);
    bootbox.alert({
        title: '<span class="glyphicon glyphicon-alert" aria-hidden="true"></span> Alert',
        message: dompurify_1.default.sanitize(s)
    });
}
function alertInfo(s) {
    setWaitDialog(false);
    bootbox.alert(dompurify_1.default.sanitize(s));
}
function fatalError(s) {
    alertError(s);
    throw new Error(s);
}
//# sourceMappingURL=dialogs.js.map