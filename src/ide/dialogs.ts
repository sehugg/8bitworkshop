import DOMPurify from "dompurify";

export function setWaitDialog(b: boolean) {
    if (b) {
        setWaitProgress(0);
        $("#pleaseWaitModal").modal('show');
    } else {
        setWaitProgress(1);
        $("#pleaseWaitModal").modal('hide');
    }
}

export function setWaitProgress(prog: number) {
    $("#pleaseWaitProgressBar").css('width', (prog * 100) + '%').show();
}

export function alertError(s: string) {
    setWaitDialog(false);
    bootbox.alert({
        title: '<span class="glyphicon glyphicon-alert" aria-hidden="true"></span> Alert',
        message: DOMPurify.sanitize(s)
    });
}

export function alertInfo(s: string) {
    setWaitDialog(false);
    bootbox.alert(DOMPurify.sanitize(s));
}

export function fatalError(s: string) {
    alertError(s);
    throw new Error(s);
}

