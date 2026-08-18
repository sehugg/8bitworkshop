// Persistent storage (StorageManager API) helpers.
// https://developer.mozilla.org/en-US/docs/Web/API/StorageManager
//
// Browsers disagree about how persistence is granted, and none of them
// treat a denial as an error:
//  - Firefox prompts the user the first time persist() is called.
//  - Chrome/Edge never prompt; persistence is granted silently once the site
//    scores high enough (bookmarked, installed, notification permission...)
//    and persist() just resolves false otherwise.
//  - Safari uses its own heuristics; data for sites the user doesn't revisit
//    may be evicted after a few days.
// So a false result is normal, and we report it as advice instead of an error.

export type BrowserKind = 'chromium' | 'firefox' | 'safari' | 'other';

export interface StorageStatus {
    supported: boolean;  // does this browser expose persist()?
    persisted: boolean;  // is storage persistent right now?
    granted?: boolean;   // did the request we just made change anything?
    usage?: number;
    quota?: number;
}

// subset of StorageManager we use, so tests can pass a stub
export interface StorageManagerLike {
    persist?: () => Promise<boolean>;
    persisted?: () => Promise<boolean>;
    estimate?: () => Promise<{ usage?: number, quota?: number }>;
}

function defaultStorageManager(): StorageManagerLike {
    return typeof navigator !== 'undefined' ? (navigator as any).storage : null;
}

export function isPersistSupported(sm?: StorageManagerLike): boolean {
    var mgr = sm !== undefined ? sm : defaultStorageManager();
    return !!(mgr && typeof mgr.persist === 'function');
}

export async function getStorageEstimate(sm?: StorageManagerLike): Promise<{ usage?: number, quota?: number }> {
    var mgr = sm !== undefined ? sm : defaultStorageManager();
    try {
        if (mgr && typeof mgr.estimate === 'function') {
            var est = await mgr.estimate();
            return { usage: est && est.usage, quota: est && est.quota };
        }
    } catch (e) {
        console.log("storage.estimate() failed", e);
    }
    return {};
}

// query current state; never prompts
export async function getStorageStatus(sm?: StorageManagerLike): Promise<StorageStatus> {
    var mgr = sm !== undefined ? sm : defaultStorageManager();
    var status: StorageStatus = { supported: isPersistSupported(mgr), persisted: false };
    try {
        if (mgr && typeof mgr.persisted === 'function')
            status.persisted = await mgr.persisted();
    } catch (e) {
        console.log("storage.persisted() failed", e);
    }
    var est = await getStorageEstimate(mgr);
    status.usage = est.usage;
    status.quota = est.quota;
    return status;
}

// ask for persistence, but only if we don't already have it
export async function requestPersistentStorage(sm?: StorageManagerLike): Promise<StorageStatus> {
    var mgr = sm !== undefined ? sm : defaultStorageManager();
    var status = await getStorageStatus(mgr);
    if (!status.supported || status.persisted) {
        status.granted = false;
        return status;
    }
    try {
        status.persisted = await mgr.persist();
        status.granted = status.persisted;
    } catch (e) {
        // Safari and cross-origin iframes can reject instead of returning false
        console.log("storage.persist() failed", e);
        status.granted = false;
    }
    return status;
}

export function detectBrowserKind(ua?: string): BrowserKind {
    if (ua == null) ua = typeof navigator !== 'undefined' ? navigator.userAgent : '';
    if (!ua) return 'other';
    // Edge/Opera/Brave all report Chrome, and all use the same heuristics
    if (/Edg\/|OPR\/|Chrome\/|Chromium\//.test(ua)) return 'chromium';
    if (/Firefox\/|FxiOS\//.test(ua)) return 'firefox';
    if (/Safari\//.test(ua)) return 'safari'; // after Chrome, which also says Safari
    return 'other';
}

export function formatStorageSize(n?: number): string {
    if (typeof n !== 'number' || !isFinite(n)) return "?";
    var units = ['bytes', 'KB', 'MB', 'GB', 'TB'];
    var i = 0;
    while (n >= 1024 && i < units.length - 1) { n /= 1024; i++; }
    return (i == 0 ? n.toFixed(0) : n.toFixed(1)) + ' ' + units[i];
}

export function getStorageUsageMessage(status: StorageStatus): string {
    if (status.usage == null && status.quota == null) return "";
    return "This site is using " + formatStorageSize(status.usage) +
        " of the " + formatStorageSize(status.quota) + " your browser allows.";
}

const BACKUP_ADVICE = "Your edits are still saved in this browser either way &mdash; " +
    "persistence only protects them if the browser needs to reclaim disk space. " +
    "Use <b>File &gt; Download All Changes as ZIP</b> (or push to GitHub) to keep a backup.";

// what the user can actually do about a denial, which is browser-specific
export function getPersistAdvice(kind?: BrowserKind): string {
    switch (kind || detectBrowserKind()) {
        case 'chromium':
            return "Chrome and Edge never ask &mdash; they grant persistent storage on their own " +
                "to sites you use regularly. Bookmarking this page, or installing it as an app, " +
                "usually qualifies it; then try <b>Request Local Storage Permissions</b> again.";
        case 'firefox':
            return "Firefox asks for permission the first time. If you dismissed or blocked that " +
                "prompt, clear it from the padlock icon in the address bar and try " +
                "<b>Request Local Storage Permissions</b> again.";
        case 'safari':
            return "Safari decides on its own, and may delete site data after several days " +
                "without a visit. Adding this page to your Favorites or Home Screen makes " +
                "eviction less likely.";
        default:
            return "This browser decides on its own whether to keep site data.";
    }
}

export function getPersistUnsupportedMessage(): string {
    return "This browser doesn't support persistent storage, so it may discard your local " +
        "file edits when it needs disk space. " + BACKUP_ADVICE;
}

// message shown when the user explicitly asks about storage permissions
export function getPersistStatusMessage(status: StorageStatus, requested: boolean): string {
    var usage = getStorageUsageMessage(status);
    var msg: string;
    if (!status.supported) {
        msg = getPersistUnsupportedMessage();
    } else if (status.persisted) {
        msg = (status.granted ? "Your browser just granted persistent storage. "
            : "Your browser is already persisting your local file edits. ") + BACKUP_ADVICE;
    } else {
        msg = "Your browser has not granted persistent storage, so it may discard your " +
            "local file edits when it needs disk space.<br><br>" +
            getPersistAdvice() + "<br><br>" + BACKUP_ADVICE;
    }
    return usage ? msg + "<br><br>" + usage : msg;
}

export function getQuotaExceededMessage(status: StorageStatus): string {
    return "Your browser ran out of space for this site, so your last edit may not have " +
        "been saved.<br><br>" + getStorageUsageMessage(status) +
        " Delete unused projects, or use <b>File &gt; Download All Changes as ZIP</b> " +
        "to back up your work before it is lost." +
        (status.supported && !status.persisted ? "<br><br>" + getPersistAdvice() : "");
}
