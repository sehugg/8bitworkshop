import { alertError, alertInfo } from './dialogs';
import { platform } from './ui';

// Link cable dialog: host a room or join one by code (see common/link/link.ts).
// Trystero is imported on demand so it costs nothing until someone opens a link.

export function platformHasLink(): boolean {
    return typeof (platform as any).connectLinkTransport === 'function';
}

function isLinked(): boolean {
    return !!(platform as any).linkSession;
}

async function connect(roomCode: string, hosting: boolean) {
    const { TrysteroLinkTransport, fetchTurnConfig } = await import('../common/link/trystero');
    const transport = new TrysteroLinkTransport(roomCode, await fetchTurnConfig());
    const started = Date.now();
    let timer: any;
    // status dialog for both host and joiner; #link-status is updated as things happen
    const waitDialog = bootbox.dialog({
        title: hosting ? "Waiting for the other player..." : "Joining room " + roomCode + "...",
        message: (hosting
            ? "Tell them to choose <b>Link Cable &rarr; Join</b> and enter this code:"
                + "<h2 style='text-align:center;font-family:monospace'>" + roomCode + "</h2>"
            : "Looking for the host of room <b>" + roomCode + "</b>...")
            + "<p id='link-status' class='text-muted'></p>",
        onEscape: true,
        buttons: {
            cancel: {
                label: "Cancel", className: "btn-default",
                callback: () => { transport.close(); }
            }
        }
    });
    const setStatus = (msg: string) => { $('#link-status').text(msg); };
    const tick = () => {
        const secs = Math.round((Date.now() - started) / 1000);
        setStatus(secs < 15
            ? "Contacting signaling relays (" + secs + "s)..."
            : "Still waiting (" + secs + "s). Check that both sides use the same code. "
                + "If a peer was found, the WebRTC connection may be blocked by a firewall/NAT "
                + "(see the browser console).");
    };
    tick();
    timer = setInterval(tick, 1000);
    waitDialog.on('hidden.bs.modal', () => clearInterval(timer));
    transport.onstatus = (s) => {
        if (s === 'open') {
            clearInterval(timer);
            waitDialog.modal('hide');
            (platform as any).connectLinkTransport(transport);
            alertInfo("Link cable connected. Both sides must keep this tab visible and running, "
                + "or the other side will wait for it.");
        } else if (s === 'closed') {
            (platform as any).connectLinkTransport(null);
            alertInfo("The other side disconnected.");
        } else if (s === 'full') {
            alertError("A third player tried to join room " + roomCode + ". A link cable has only two ends.");
        }
    };
}

function disconnect() {
    (platform as any).connectLinkTransport(null);
    alertInfo("Link cable disconnected.");
}

export async function _linkCable() {
    if (!platformHasLink()) {
        alertError("This platform doesn't have a link port.");
        return;
    }
    if (isLinked()) {
        bootbox.confirm("Disconnect the link cable?", (ok) => { if (ok) disconnect(); });
        return;
    }
    const { newRoomCode } = await import('../common/link/trystero');
    bootbox.dialog({
        title: "Link Cable",
        message: "Connect to another player over the internet (WebRTC). "
            + "Both of you should be running the same program.",
        buttons: {
            host: {
                label: "Host", className: "btn-primary",
                callback: () => { connect(newRoomCode(), true); }
            },
            join: {
                label: "Join...", className: "btn-default",
                callback: () => {
                    bootbox.prompt("Enter the room code:", (code) => {
                        if (code && code.trim()) connect(code.trim().toUpperCase(), false);
                    });
                }
            }
        }
    });
}
