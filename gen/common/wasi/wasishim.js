"use strict";
/*
 * Copyright (c) 2024 Steven E. Hugg
 *
 * Permission is hereby granted, free of charge, to any person obtaining a copy
 * of this software and associated documentation files (the "Software"), to deal
 * in the Software without restriction, including without limitation the rights
 * to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
 * copies of the Software, and to permit persons to whom the Software is
 * furnished to do so, subject to the following conditions:
 *
 * The above copyright notice and this permission notice shall be included in all
 * copies or substantial portions of the Software.
 *
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
 * IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
 * FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
 * AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
 * LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
 * OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
 * SOFTWARE.
 */
var __classPrivateFieldGet = (this && this.__classPrivateFieldGet) || function (receiver, state, kind, f) {
    if (kind === "a" && !f) throw new TypeError("Private accessor was defined without a getter");
    if (typeof state === "function" ? receiver !== state || !f : !state.has(receiver)) throw new TypeError("Cannot read private member from an object whose class did not declare it");
    return kind === "m" ? f : kind === "a" ? f.call(receiver) : f ? f.value : state.get(receiver);
};
var __classPrivateFieldSet = (this && this.__classPrivateFieldSet) || function (receiver, state, value, kind, f) {
    if (kind === "m") throw new TypeError("Private method is not writable");
    if (kind === "a" && !f) throw new TypeError("Private accessor was defined without a setter");
    if (typeof state === "function" ? receiver !== state || !f : !state.has(receiver)) throw new TypeError("Cannot write private member to an object whose class did not declare it");
    return (kind === "a" ? f.call(receiver, value) : f ? f.value = value : state.set(receiver, value)), value;
};
var _WASIRunner_instance, _WASIRunner_memarr8, _WASIRunner_memarr32, _WASIRunner_args, _WASIRunner_envvars;
Object.defineProperty(exports, "__esModule", { value: true });
exports.WASIRunner = exports.WASIMemoryFilesystem = exports.WASIFileDescriptor = exports.WASIErrors = exports.FDOpenFlags = exports.FDFlags = exports.FDRights = exports.FDType = void 0;
// https://dev.to/ndesmic/building-a-minimal-wasi-polyfill-for-browsers-4nel
// http://www.wasmtutor.com/webassembly-barebones-wasi
// https://github.com/emscripten-core/emscripten/blob/c017fc2d6961962ee87ae387462a099242dfbbd2/src/library_wasi.js#L451
// https://github.com/emscripten-core/emscripten/blob/c017fc2d6961962ee87ae387462a099242dfbbd2/src/library_fs.js
// https://github.com/WebAssembly/wasi-libc/blob/main/libc-bottom-half/sources/preopens.c
// https://fossies.org/linux/wasm3/source/extra/wasi_core.h
// https://wasix.org/docs/api-reference/wasi/fd_read
const use_debug = true;
const debug = use_debug ? console.log : () => { };
const warning = console.log;
var FDType;
(function (FDType) {
    FDType[FDType["UNKNOWN"] = 0] = "UNKNOWN";
    FDType[FDType["BLOCK_DEVICE"] = 1] = "BLOCK_DEVICE";
    FDType[FDType["CHARACTER_DEVICE"] = 2] = "CHARACTER_DEVICE";
    FDType[FDType["DIRECTORY"] = 3] = "DIRECTORY";
    FDType[FDType["REGULAR_FILE"] = 4] = "REGULAR_FILE";
    FDType[FDType["SOCKET_DGRAM"] = 5] = "SOCKET_DGRAM";
    FDType[FDType["SOCKET_STREAM"] = 6] = "SOCKET_STREAM";
    FDType[FDType["SYMBOLIC_LINK"] = 7] = "SYMBOLIC_LINK";
})(FDType || (exports.FDType = FDType = {}));
var FDRights;
(function (FDRights) {
    FDRights[FDRights["FD_DATASYNC"] = 1] = "FD_DATASYNC";
    FDRights[FDRights["FD_READ"] = 2] = "FD_READ";
    FDRights[FDRights["FD_SEEK"] = 4] = "FD_SEEK";
    FDRights[FDRights["FD_FDSTAT_SET_FLAGS"] = 8] = "FD_FDSTAT_SET_FLAGS";
    FDRights[FDRights["FD_SYNC"] = 16] = "FD_SYNC";
    FDRights[FDRights["FD_TELL"] = 32] = "FD_TELL";
    FDRights[FDRights["FD_WRITE"] = 64] = "FD_WRITE";
    FDRights[FDRights["FD_ADVISE"] = 128] = "FD_ADVISE";
    FDRights[FDRights["FD_ALLOCATE"] = 256] = "FD_ALLOCATE";
    FDRights[FDRights["PATH_CREATE_DIRECTORY"] = 512] = "PATH_CREATE_DIRECTORY";
    FDRights[FDRights["PATH_CREATE_FILE"] = 1024] = "PATH_CREATE_FILE";
    FDRights[FDRights["PATH_LINK_SOURCE"] = 2048] = "PATH_LINK_SOURCE";
    FDRights[FDRights["PATH_LINK_TARGET"] = 4096] = "PATH_LINK_TARGET";
    FDRights[FDRights["PATH_OPEN"] = 8192] = "PATH_OPEN";
    FDRights[FDRights["FD_READDIR"] = 16384] = "FD_READDIR";
    FDRights[FDRights["PATH_READLINK"] = 32768] = "PATH_READLINK";
    FDRights[FDRights["PATH_RENAME_SOURCE"] = 65536] = "PATH_RENAME_SOURCE";
    FDRights[FDRights["PATH_RENAME_TARGET"] = 131072] = "PATH_RENAME_TARGET";
    FDRights[FDRights["PATH_FILESTAT_GET"] = 262144] = "PATH_FILESTAT_GET";
    FDRights[FDRights["PATH_FILESTAT_SET_SIZE"] = 524288] = "PATH_FILESTAT_SET_SIZE";
    FDRights[FDRights["PATH_FILESTAT_SET_TIMES"] = 1048576] = "PATH_FILESTAT_SET_TIMES";
    FDRights[FDRights["FD_FILESTAT_GET"] = 2097152] = "FD_FILESTAT_GET";
    FDRights[FDRights["FD_FILESTAT_SET_SIZE"] = 4194304] = "FD_FILESTAT_SET_SIZE";
    FDRights[FDRights["FD_FILESTAT_SET_TIMES"] = 8388608] = "FD_FILESTAT_SET_TIMES";
    FDRights[FDRights["PATH_SYMLINK"] = 16777216] = "PATH_SYMLINK";
    FDRights[FDRights["PATH_REMOVE_DIRECTORY"] = 33554432] = "PATH_REMOVE_DIRECTORY";
    FDRights[FDRights["PATH_UNLINK_FILE"] = 67108864] = "PATH_UNLINK_FILE";
    FDRights[FDRights["POLL_FD_READWRITE"] = 134217728] = "POLL_FD_READWRITE";
    FDRights[FDRights["SOCK_SHUTDOWN"] = 268435456] = "SOCK_SHUTDOWN";
    FDRights[FDRights["FD_ALL"] = 536870911] = "FD_ALL";
})(FDRights || (exports.FDRights = FDRights = {}));
var FDFlags;
(function (FDFlags) {
    FDFlags[FDFlags["APPEND"] = 1] = "APPEND";
    FDFlags[FDFlags["DSYNC"] = 2] = "DSYNC";
    FDFlags[FDFlags["NONBLOCK"] = 4] = "NONBLOCK";
    FDFlags[FDFlags["RSYNC"] = 8] = "RSYNC";
    FDFlags[FDFlags["SYNC"] = 16] = "SYNC";
})(FDFlags || (exports.FDFlags = FDFlags = {}));
var FDOpenFlags;
(function (FDOpenFlags) {
    FDOpenFlags[FDOpenFlags["CREAT"] = 1] = "CREAT";
    FDOpenFlags[FDOpenFlags["DIRECTORY"] = 2] = "DIRECTORY";
    FDOpenFlags[FDOpenFlags["EXCL"] = 4] = "EXCL";
    FDOpenFlags[FDOpenFlags["TRUNC"] = 8] = "TRUNC";
})(FDOpenFlags || (exports.FDOpenFlags = FDOpenFlags = {}));
var WASIErrors;
(function (WASIErrors) {
    WASIErrors[WASIErrors["SUCCESS"] = 0] = "SUCCESS";
    WASIErrors[WASIErrors["TOOBIG"] = 1] = "TOOBIG";
    WASIErrors[WASIErrors["ACCES"] = 2] = "ACCES";
    WASIErrors[WASIErrors["ADDRINUSE"] = 3] = "ADDRINUSE";
    WASIErrors[WASIErrors["ADDRNOTAVAIL"] = 4] = "ADDRNOTAVAIL";
    WASIErrors[WASIErrors["AFNOSUPPORT"] = 5] = "AFNOSUPPORT";
    WASIErrors[WASIErrors["AGAIN"] = 6] = "AGAIN";
    WASIErrors[WASIErrors["ALREADY"] = 7] = "ALREADY";
    WASIErrors[WASIErrors["BADF"] = 8] = "BADF";
    WASIErrors[WASIErrors["BADMSG"] = 9] = "BADMSG";
    WASIErrors[WASIErrors["BUSY"] = 10] = "BUSY";
    WASIErrors[WASIErrors["CANCELED"] = 11] = "CANCELED";
    WASIErrors[WASIErrors["CHILD"] = 12] = "CHILD";
    WASIErrors[WASIErrors["CONNABORTED"] = 13] = "CONNABORTED";
    WASIErrors[WASIErrors["CONNREFUSED"] = 14] = "CONNREFUSED";
    WASIErrors[WASIErrors["CONNRESET"] = 15] = "CONNRESET";
    WASIErrors[WASIErrors["DEADLK"] = 16] = "DEADLK";
    WASIErrors[WASIErrors["DESTADDRREQ"] = 17] = "DESTADDRREQ";
    WASIErrors[WASIErrors["DOM"] = 18] = "DOM";
    WASIErrors[WASIErrors["DQUOT"] = 19] = "DQUOT";
    WASIErrors[WASIErrors["EXIST"] = 20] = "EXIST";
    WASIErrors[WASIErrors["FAULT"] = 21] = "FAULT";
    WASIErrors[WASIErrors["FBIG"] = 22] = "FBIG";
    WASIErrors[WASIErrors["HOSTUNREACH"] = 23] = "HOSTUNREACH";
    WASIErrors[WASIErrors["IDRM"] = 24] = "IDRM";
    WASIErrors[WASIErrors["ILSEQ"] = 25] = "ILSEQ";
    WASIErrors[WASIErrors["INPROGRESS"] = 26] = "INPROGRESS";
    WASIErrors[WASIErrors["INTR"] = 27] = "INTR";
    WASIErrors[WASIErrors["INVAL"] = 28] = "INVAL";
    WASIErrors[WASIErrors["IO"] = 29] = "IO";
    WASIErrors[WASIErrors["ISCONN"] = 30] = "ISCONN";
    WASIErrors[WASIErrors["ISDIR"] = 31] = "ISDIR";
    WASIErrors[WASIErrors["LOOP"] = 32] = "LOOP";
    WASIErrors[WASIErrors["MFILE"] = 33] = "MFILE";
    WASIErrors[WASIErrors["MLINK"] = 34] = "MLINK";
    WASIErrors[WASIErrors["MSGSIZE"] = 35] = "MSGSIZE";
    WASIErrors[WASIErrors["MULTIHOP"] = 36] = "MULTIHOP";
    WASIErrors[WASIErrors["NAMETOOLONG"] = 37] = "NAMETOOLONG";
    WASIErrors[WASIErrors["NETDOWN"] = 38] = "NETDOWN";
    WASIErrors[WASIErrors["NETRESET"] = 39] = "NETRESET";
    WASIErrors[WASIErrors["NETUNREACH"] = 40] = "NETUNREACH";
    WASIErrors[WASIErrors["NFILE"] = 41] = "NFILE";
    WASIErrors[WASIErrors["NOBUFS"] = 42] = "NOBUFS";
    WASIErrors[WASIErrors["NODEV"] = 43] = "NODEV";
    WASIErrors[WASIErrors["NOENT"] = 44] = "NOENT";
    WASIErrors[WASIErrors["NOEXEC"] = 45] = "NOEXEC";
    WASIErrors[WASIErrors["NOLCK"] = 46] = "NOLCK";
    WASIErrors[WASIErrors["NOLINK"] = 47] = "NOLINK";
    WASIErrors[WASIErrors["NOMEM"] = 48] = "NOMEM";
    WASIErrors[WASIErrors["NOMSG"] = 49] = "NOMSG";
    WASIErrors[WASIErrors["NOPROTOOPT"] = 50] = "NOPROTOOPT";
    WASIErrors[WASIErrors["NOSPC"] = 51] = "NOSPC";
    WASIErrors[WASIErrors["NOSYS"] = 52] = "NOSYS";
    WASIErrors[WASIErrors["NOTCONN"] = 53] = "NOTCONN";
    WASIErrors[WASIErrors["NOTDIR"] = 54] = "NOTDIR";
    WASIErrors[WASIErrors["NOTEMPTY"] = 55] = "NOTEMPTY";
    WASIErrors[WASIErrors["NOTRECOVERABLE"] = 56] = "NOTRECOVERABLE";
    WASIErrors[WASIErrors["NOTSOCK"] = 57] = "NOTSOCK";
    WASIErrors[WASIErrors["NOTSUP"] = 58] = "NOTSUP";
    WASIErrors[WASIErrors["NOTTY"] = 59] = "NOTTY";
    WASIErrors[WASIErrors["NXIO"] = 60] = "NXIO";
    WASIErrors[WASIErrors["OVERFLOW"] = 61] = "OVERFLOW";
    WASIErrors[WASIErrors["OWNERDEAD"] = 62] = "OWNERDEAD";
    WASIErrors[WASIErrors["PERM"] = 63] = "PERM";
    WASIErrors[WASIErrors["PIPE"] = 64] = "PIPE";
    WASIErrors[WASIErrors["PROTO"] = 65] = "PROTO";
    WASIErrors[WASIErrors["PROTONOSUPPORT"] = 66] = "PROTONOSUPPORT";
    WASIErrors[WASIErrors["PROTOTYPE"] = 67] = "PROTOTYPE";
    WASIErrors[WASIErrors["RANGE"] = 68] = "RANGE";
    WASIErrors[WASIErrors["ROFS"] = 69] = "ROFS";
    WASIErrors[WASIErrors["SPIPE"] = 70] = "SPIPE";
    WASIErrors[WASIErrors["SRCH"] = 71] = "SRCH";
    WASIErrors[WASIErrors["STALE"] = 72] = "STALE";
    WASIErrors[WASIErrors["TIMEDOUT"] = 73] = "TIMEDOUT";
    WASIErrors[WASIErrors["TXTBSY"] = 74] = "TXTBSY";
    WASIErrors[WASIErrors["XDEV"] = 75] = "XDEV";
    WASIErrors[WASIErrors["NOTCAPABLE"] = 76] = "NOTCAPABLE";
})(WASIErrors || (exports.WASIErrors = WASIErrors = {}));
class WASIFileDescriptor {
    constructor(name, type, rights) {
        this.name = name;
        this.type = type;
        this.rights = rights;
        this.fdindex = -1;
        this.data = new Uint8Array(16);
        this.flags = 0;
        this.size = 0;
        this.offset = 0;
        this.rights = -1; // TODO?
    }
    ensureCapacity(size) {
        if (this.data.byteLength < size) {
            const newdata = new Uint8Array(size * 2); // TODO?
            newdata.set(this.data);
            this.data = newdata;
        }
    }
    write(chunk) {
        this.ensureCapacity(this.offset + chunk.byteLength);
        this.data.set(chunk, this.offset);
        this.offset += chunk.byteLength;
        this.size = Math.max(this.size, this.offset);
    }
    read(chunk) {
        const len = Math.min(chunk.byteLength, this.size - this.offset);
        chunk.set(this.data.subarray(this.offset, this.offset + len));
        this.offset += len;
        return len;
    }
    truncate() {
        this.size = 0;
        this.offset = 0;
    }
    llseek(offset, whence) {
        switch (whence) {
            case 0: // SEEK_SET
                this.offset = offset;
                break;
            case 1: // SEEK_CUR
                this.offset += offset;
                break;
            case 2: // SEEK_END
                this.offset = this.size + offset;
                break;
        }
        if (this.offset < 0)
            this.offset = 0;
        if (this.offset > this.size)
            this.offset = this.size;
    }
    getBytes() {
        return this.data.subarray(0, this.size);
    }
    getBytesAsString() {
        return new TextDecoder().decode(this.getBytes());
    }
    toString() {
        return `FD(${this.fdindex} "${this.name}" 0x${this.type.toString(16)} 0x${this.rights.toString(16)} ${this.offset}/${this.size}/${this.data.byteLength})`;
    }
}
exports.WASIFileDescriptor = WASIFileDescriptor;
class WASIStreamingFileDescriptor extends WASIFileDescriptor {
    constructor(fdindex, name, type, rights, stream) {
        super(name, type, rights);
        this.stream = stream;
        this.fdindex = fdindex;
    }
    write(chunk) {
        this.stream.write(chunk);
    }
}
class WASIMemoryFilesystem {
    constructor() {
        this.parent = null;
        this.files = new Map();
        this.dirs = new Map();
        this.putDirectory("/");
    }
    setParent(parent) {
        this.parent = parent;
    }
    putDirectory(name, rights) {
        if (!rights)
            rights = FDRights.PATH_OPEN | FDRights.PATH_CREATE_DIRECTORY | FDRights.PATH_CREATE_FILE;
        if (name != '/' && name.endsWith('/'))
            name = name.substring(0, name.length - 1);
        // add parent directory(s)
        const parent = name.substring(0, name.lastIndexOf('/'));
        if (parent && parent != name) {
            this.putDirectory(parent, rights);
        }
        // add directory
        const dir = new WASIFileDescriptor(name, FDType.DIRECTORY, rights);
        this.dirs.set(name, dir);
        return dir;
    }
    putFile(name, data, rights) {
        if (typeof data === 'string') {
            data = new TextEncoder().encode(data);
        }
        if (!rights)
            rights = FDRights.FD_READ | FDRights.FD_WRITE;
        const file = new WASIFileDescriptor(name, FDType.REGULAR_FILE, rights);
        file.write(data);
        file.offset = 0;
        this.files.set(name, file);
        return file;
    }
    putSymbolicLink(name, target, rights) {
        if (!rights)
            rights = FDRights.PATH_SYMLINK;
        const file = new WASIFileDescriptor(name, FDType.SYMBOLIC_LINK, rights);
        file.write(new TextEncoder().encode(target));
        file.offset = 0;
        this.files.set(name, file);
        return file;
    }
    getFile(name) {
        var _a;
        let file = this.files.get(name);
        if (!file) {
            file = (_a = this.parent) === null || _a === void 0 ? void 0 : _a.getFile(name);
        }
        return file;
    }
    getDirectories() {
        return [...this.dirs.values()];
    }
    getFiles() {
        return [...this.files.values()];
    }
}
exports.WASIMemoryFilesystem = WASIMemoryFilesystem;
class WASIRunner {
    constructor() {
        _WASIRunner_instance.set(this, void 0); // TODO
        _WASIRunner_memarr8.set(this, void 0);
        _WASIRunner_memarr32.set(this, void 0);
        _WASIRunner_args.set(this, []);
        _WASIRunner_envvars.set(this, []);
        this.fds = [];
        this.exited = false;
        this.errno = -1;
        this.fs = new WASIMemoryFilesystem();
        this.createStdioBrowser();
    }
    exports() {
        return __classPrivateFieldGet(this, _WASIRunner_instance, "f").exports;
    }
    createStdioNode() {
        this.stdin = new WASIStreamingFileDescriptor(0, '<stdin>', FDType.CHARACTER_DEVICE, FDRights.FD_READ, process.stdin);
        this.stdout = new WASIStreamingFileDescriptor(1, '<stdout>', FDType.CHARACTER_DEVICE, FDRights.FD_WRITE, process.stdout);
        this.stderr = new WASIStreamingFileDescriptor(2, '<stderr>', FDType.CHARACTER_DEVICE, FDRights.FD_WRITE, process.stderr);
        this.fds[0] = this.stdin;
        this.fds[1] = this.stdout;
        this.fds[2] = this.stderr;
    }
    createStdioBrowser() {
        this.stdin = new WASIFileDescriptor('<stdin>', FDType.CHARACTER_DEVICE, FDRights.FD_READ);
        this.stdout = new WASIFileDescriptor('<stdout>', FDType.CHARACTER_DEVICE, FDRights.FD_WRITE);
        this.stderr = new WASIFileDescriptor('<stderr>', FDType.CHARACTER_DEVICE, FDRights.FD_WRITE);
        this.stdin.fdindex = 0;
        this.stdout.fdindex = 1;
        this.stderr.fdindex = 2;
        this.fds[0] = this.stdin;
        this.fds[1] = this.stdout;
        this.fds[2] = this.stderr;
    }
    initSync(wasmModule) {
        __classPrivateFieldSet(this, _WASIRunner_instance, new WebAssembly.Instance(wasmModule, this.getImportObject()), "f");
    }
    loadSync(wasmSource) {
        let wasmModule = new WebAssembly.Module(wasmSource);
        this.initSync(wasmModule);
    }
    async loadAsync(wasmSource) {
        let wasmModule = await WebAssembly.compile(wasmSource);
        __classPrivateFieldSet(this, _WASIRunner_instance, await WebAssembly.instantiate(wasmModule, this.getImportObject()), "f");
    }
    setArgs(args) {
        __classPrivateFieldSet(this, _WASIRunner_args, args.map(arg => new TextEncoder().encode(arg + '\0')), "f");
    }
    addPreopenDirectory(name) {
        return this.openFile(name, FDOpenFlags.DIRECTORY | FDOpenFlags.CREAT);
    }
    openFile(path, o_flags, mode) {
        let file = this.fs.getFile(path);
        mode = typeof mode == 'undefined' ? 438 /* 0666 */ : mode;
        if (o_flags & FDOpenFlags.CREAT) {
            if (file == null) {
                if (o_flags & FDOpenFlags.DIRECTORY) {
                    file = this.fs.putDirectory(path);
                }
                else {
                    file = this.fs.putFile(path, new Uint8Array(), FDRights.FD_ALL);
                }
            }
            else {
                if (o_flags & FDOpenFlags.TRUNC) { // truncate
                    file.truncate();
                }
                else
                    return WASIErrors.INVAL;
            }
        }
        else {
            if (file == null)
                return WASIErrors.NOSYS;
            if (o_flags & FDOpenFlags.DIRECTORY) { // check type
                if (file.type !== FDType.DIRECTORY)
                    return WASIErrors.NOSYS;
            }
            if (o_flags & FDOpenFlags.EXCL)
                return WASIErrors.INVAL; // already exists
            if (o_flags & FDOpenFlags.TRUNC) { // truncate
                file.truncate();
            }
            else {
                file.llseek(0, 0); // seek to start
            }
        }
        file.fdindex = this.fds.length;
        this.fds.push(file);
        return file;
    }
    mem8() {
        var _a;
        if (!((_a = __classPrivateFieldGet(this, _WASIRunner_memarr8, "f")) === null || _a === void 0 ? void 0 : _a.byteLength)) {
            __classPrivateFieldSet(this, _WASIRunner_memarr8, new Uint8Array(__classPrivateFieldGet(this, _WASIRunner_instance, "f").exports.memory.buffer), "f");
        }
        return __classPrivateFieldGet(this, _WASIRunner_memarr8, "f");
    }
    mem32() {
        var _a;
        if (!((_a = __classPrivateFieldGet(this, _WASIRunner_memarr32, "f")) === null || _a === void 0 ? void 0 : _a.byteLength)) {
            __classPrivateFieldSet(this, _WASIRunner_memarr32, new Int32Array(__classPrivateFieldGet(this, _WASIRunner_instance, "f").exports.memory.buffer), "f");
        }
        return __classPrivateFieldGet(this, _WASIRunner_memarr32, "f");
    }
    run() {
        try {
            __classPrivateFieldGet(this, _WASIRunner_instance, "f").exports._start();
            if (!this.exited) {
                this.exited = true;
                this.errno = 0;
            }
        }
        catch (err) {
            if (!this.exited)
                throw err;
        }
        return this.getErrno();
    }
    initialize() {
        __classPrivateFieldGet(this, _WASIRunner_instance, "f").exports._initialize();
        return this.getErrno();
    }
    getImportObject() {
        return {
            "wasi_snapshot_preview1": this.getWASISnapshotPreview1(),
            "env": this.getEnv(),
        };
    }
    peek8(ptr) {
        return this.mem8()[ptr];
    }
    peek16(ptr) {
        return this.mem8()[ptr] | (this.mem8()[ptr + 1] << 8);
    }
    peek32(ptr) {
        return this.mem32()[ptr >>> 2];
    }
    poke8(ptr, val) {
        this.mem8()[ptr] = val;
    }
    poke16(ptr, val) {
        this.mem8()[ptr] = val;
        this.mem8()[ptr + 1] = val >> 8;
    }
    poke32(ptr, val) {
        this.mem32()[ptr >>> 2] = val;
    }
    poke64(ptr, val) {
        this.mem32()[ptr >>> 2] = val;
        this.mem32()[(ptr >>> 2) + 1] = 0;
    }
    pokeUTF8(str, ptr, maxlen) {
        const enc = new TextEncoder();
        const bytes = enc.encode(str);
        const len = Math.min(bytes.length, maxlen);
        this.mem8().set(bytes.subarray(0, len), ptr);
        return len;
    }
    peekUTF8(ptr, maxlen) {
        const bytes = this.mem8().subarray(ptr, ptr + maxlen);
        const dec = new TextDecoder();
        return dec.decode(bytes);
    }
    getErrno() {
        return this.errno;
        //let errno_ptr = this.#instance.exports.__errno_location();
        //return this.peek32(errno_ptr);
    }
    poke_str_array_sizes(strs, count_ptr, buf_size_ptr) {
        this.poke32(count_ptr, strs.length);
        this.poke32(buf_size_ptr, strs.reduce((acc, arg) => acc + arg.length, 0));
    }
    poke_str_args(strs, argv_ptr, argv_buf_ptr) {
        let argv = argv_ptr;
        let argv_buf = argv_buf_ptr;
        for (let arg of __classPrivateFieldGet(this, _WASIRunner_args, "f")) {
            this.poke32(argv, argv_buf);
            argv += 4;
            for (let i = 0; i < arg.length; i++) {
                this.poke8(argv_buf, arg[i]);
                argv_buf++;
            }
        }
    }
    args_sizes_get(argcount_ptr, argv_buf_size_ptr) {
        debug("args_sizes_get", argcount_ptr, argv_buf_size_ptr);
        this.poke_str_array_sizes(__classPrivateFieldGet(this, _WASIRunner_args, "f"), argcount_ptr, argv_buf_size_ptr);
        return 0;
    }
    args_get(argv_ptr, argv_buf_ptr) {
        debug("args_get", argv_ptr, argv_buf_ptr);
        this.poke_str_args(__classPrivateFieldGet(this, _WASIRunner_args, "f"), argv_ptr, argv_buf_ptr);
        return 0;
    }
    environ_sizes_get(environ_count_ptr, environ_buf_size_ptr) {
        debug("environ_sizes_get", environ_count_ptr, environ_buf_size_ptr);
        this.poke_str_array_sizes(__classPrivateFieldGet(this, _WASIRunner_envvars, "f"), environ_count_ptr, environ_buf_size_ptr);
        return 0;
    }
    environ_get(environ_ptr, environ_buf_ptr) {
        debug("environ_get", environ_ptr, environ_buf_ptr);
        this.poke_str_args(__classPrivateFieldGet(this, _WASIRunner_envvars, "f"), environ_ptr, environ_buf_ptr);
        return 0;
    }
    fd_write(fd, iovs, iovs_len, nwritten_ptr) {
        const stream = this.fds[fd];
        const iovecs = this.mem32().subarray(iovs >>> 2, (iovs + iovs_len * 8) >>> 2);
        let total = 0;
        for (let i = 0; i < iovs_len; i++) {
            const ptr = iovecs[i * 2];
            const len = iovecs[i * 2 + 1];
            const chunk = this.mem8().subarray(ptr, ptr + len);
            total += len;
            stream.write(chunk);
        }
        this.poke32(nwritten_ptr, total);
        debug("fd_write", fd, iovs, iovs_len, '->', total);
        return 0;
    }
    fd_read(fd, iovs, iovs_len, nread_ptr) {
        const stream = this.fds[fd];
        const iovecs = this.mem32().subarray(iovs >>> 2, (iovs + iovs_len * 8) >>> 2);
        let total = 0;
        for (let i = 0; i < iovs_len; i++) {
            const ptr = iovecs[i * 2];
            const len = iovecs[i * 2 + 1];
            const chunk = this.mem8().subarray(ptr, ptr + len);
            total += stream.read(chunk);
        }
        this.poke32(nread_ptr, total);
        debug("fd_read", fd, iovs, iovs_len, '->', total);
        return WASIErrors.SUCCESS;
    }
    fd_seek(fd, offset, whence, newoffset_ptr) {
        const file = this.fds[fd];
        if (typeof offset == 'bigint')
            offset = Number(offset);
        debug("fd_seek", fd, offset, whence, file + "");
        if (file != null) {
            file.llseek(offset, whence);
            this.poke64(newoffset_ptr, file.offset);
            return WASIErrors.SUCCESS;
        }
        return WASIErrors.BADF;
    }
    fd_close(fd) {
        debug("fd_close", fd);
        const file = this.fds[fd];
        if (file != null) {
            this.fds[fd] = null;
            return 0;
        }
        return WASIErrors.BADF;
    }
    proc_exit(errno) {
        debug("proc_exit", errno);
        this.errno = errno;
        this.exited = true;
    }
    fd_prestat_get(fd, prestat_ptr) {
        const file = this.fds[fd];
        debug("fd_prestat_get", fd, prestat_ptr, file === null || file === void 0 ? void 0 : file.name);
        if (file && file.type === FDType.DIRECTORY) {
            const enc_name = new TextEncoder().encode(file.name);
            this.poke8(prestat_ptr + 0, 0); // __WASI_PREOPENTYPE_DIR
            this.poke64(prestat_ptr + 8, enc_name.length);
            return WASIErrors.SUCCESS;
        }
        return WASIErrors.BADF;
    }
    fd_fdstat_get(fd, fdstat_ptr) {
        const file = this.fds[fd];
        debug("fd_fdstat_get", fd, fdstat_ptr, file + "");
        if (file != null) {
            this.poke16(fdstat_ptr + 0, file.type); // fs_filetype
            this.poke16(fdstat_ptr + 2, file.flags); // fs_flags
            this.poke64(fdstat_ptr + 8, file.rights); // fs_rights_base
            this.poke64(fdstat_ptr + 16, file.rights); // fs_rights_inheriting
            return WASIErrors.SUCCESS;
        }
        return WASIErrors.BADF;
    }
    fd_prestat_dir_name(fd, path_ptr, path_len) {
        const file = this.fds[fd];
        debug("fd_prestat_dir_name", fd, path_ptr, path_len);
        if (file != null) {
            this.pokeUTF8(file.name, path_ptr, path_len);
            return WASIErrors.SUCCESS;
        }
        return WASIErrors.INVAL;
    }
    path_open(dirfd, dirflags, path_ptr, path_len, o_flags, fs_rights_base, fs_rights_inheriting, fd_flags, fd_ptr) {
        const dir = this.fds[dirfd];
        if (dir == null)
            return WASIErrors.BADF;
        if (dir.type !== FDType.DIRECTORY)
            return WASIErrors.NOTDIR;
        const filename = this.peekUTF8(path_ptr, path_len);
        const path = dir.name + '/' + filename;
        const fd = this.openFile(path, o_flags, fd_flags);
        debug("path_open", path, dirfd, dirflags, o_flags, //fs_rights_base, fs_rights_inheriting,
        fd_flags, fd_ptr, '->', fd + "");
        if (typeof fd === 'number')
            return fd; // error msg
        this.poke32(fd_ptr, fd.fdindex);
        return WASIErrors.SUCCESS;
    }
    random_get(ptr, len) {
        debug("random_get", ptr, len);
        for (let i = 0; i < len; i++) {
            // TODO: don't use for crypto
            this.poke8(ptr + i, Math.floor(Math.random() * 256));
        }
        return WASIErrors.SUCCESS;
    }
    path_filestat_get(dirfd, dirflags, path_ptr, path_len, filestat_ptr) {
        const dir = this.fds[dirfd];
        if (dir == null)
            return WASIErrors.BADF;
        if (dir.type !== FDType.DIRECTORY)
            return WASIErrors.NOTDIR;
        const filename = this.peekUTF8(path_ptr, path_len);
        const path = filename.startsWith('/') ? filename : dir.name + '/' + filename; // TODO?
        const fd = this.fs.getFile(path);
        console.log("path_filestat_get", dir + "", filename, path, filestat_ptr, '->', fd + "");
        if (!fd)
            return WASIErrors.NOENT;
        this.poke64(filestat_ptr, fd.fdindex); // dev
        this.poke64(filestat_ptr + 8, 0); // ino
        this.poke8(filestat_ptr + 16, fd.type); // filetype
        this.poke64(filestat_ptr + 24, 1); // nlink
        this.poke64(filestat_ptr + 32, fd.size); // size
        this.poke64(filestat_ptr + 40, 0); // atim
        this.poke64(filestat_ptr + 48, 0); // mtim
        this.poke64(filestat_ptr + 56, 0); // ctim
    }
    path_readlink(dirfd, path_ptr, path_len, buf_ptr, buf_len, buf_used_ptr) {
        const dir = this.fds[dirfd];
        debug("path_readlink", dirfd, path_ptr, path_len, buf_ptr, buf_len, buf_used_ptr, dir + "");
        if (dir == null)
            return WASIErrors.BADF;
        if (dir.type !== FDType.DIRECTORY)
            return WASIErrors.NOTDIR;
        const filename = this.peekUTF8(path_ptr, path_len);
        const path = dir.name + '/' + filename;
        const fd = this.fs.getFile(path);
        debug("path_readlink", path, fd + "");
        if (!fd)
            return WASIErrors.NOENT;
        if (fd.type !== FDType.SYMBOLIC_LINK)
            return WASIErrors.INVAL;
        const target = fd.getBytesAsString();
        const len = this.pokeUTF8(target, buf_ptr, buf_len);
        this.poke32(buf_used_ptr, len);
        debug("path_readlink", path, '->', target);
        return WASIErrors.SUCCESS;
    }
    path_readlinkat(dirfd, path_ptr, path_len, buf_ptr, buf_len, buf_used_ptr) {
        return this.path_readlink(dirfd, path_ptr, path_len, buf_ptr, buf_len, buf_used_ptr);
    }
    path_unlink_file(dirfd, path_ptr, path_len) {
        const dir = this.fds[dirfd];
        if (dir == null)
            return WASIErrors.BADF;
        if (dir.type !== FDType.DIRECTORY)
            return WASIErrors.NOTDIR;
        const filename = this.peekUTF8(path_ptr, path_len);
        const path = dir.name + '/' + filename;
        const fd = this.fs.getFile(path);
        debug("path_unlink_file", dir + "", path, fd + "");
        if (!fd)
            return WASIErrors.NOENT;
        this.fs.getFile(path);
        return WASIErrors.SUCCESS;
    }
    clock_time_get(clock_id, precision, time_ptr) {
        const time = Date.now();
        this.poke64(time_ptr, time);
        return WASIErrors.SUCCESS;
    }
    getWASISnapshotPreview1() {
        return {
            args_sizes_get: this.args_sizes_get.bind(this),
            args_get: this.args_get.bind(this),
            environ_sizes_get: this.environ_sizes_get.bind(this),
            environ_get: this.environ_get.bind(this),
            proc_exit: this.proc_exit.bind(this),
            path_open: this.path_open.bind(this),
            fd_prestat_get: this.fd_prestat_get.bind(this),
            fd_prestat_dir_name: this.fd_prestat_dir_name.bind(this),
            fd_fdstat_get: this.fd_fdstat_get.bind(this),
            fd_read: this.fd_read.bind(this),
            fd_write: this.fd_write.bind(this),
            fd_seek: this.fd_seek.bind(this),
            fd_close: this.fd_close.bind(this),
            path_filestat_get: this.path_filestat_get.bind(this),
            random_get: this.random_get.bind(this),
            path_readlink: this.path_readlink.bind(this),
            path_unlink_file: this.path_unlink_file.bind(this),
            clock_time_get: this.clock_time_get.bind(this),
            fd_fdstat_set_flags() { warning("TODO: fd_fdstat_set_flags"); return WASIErrors.NOTSUP; },
            fd_readdir() { warning("TODO: fd_readdir"); return WASIErrors.NOTSUP; },
            fd_tell() { warning("TODO: fd_tell"); return WASIErrors.NOTSUP; },
            path_remove_directory() { warning("TODO: path_remove_directory"); return 0; },
        };
    }
    getEnv() {
        return {
            __syscall_unlinkat() { warning('TODO: unlink'); return WASIErrors.NOTSUP; },
            __syscall_faccessat() { warning("TODO: faccessat"); return WASIErrors.NOTSUP; },
            __syscall_readlinkat: this.path_readlinkat.bind(this),
            __syscall_getcwd() { warning("TODO: getcwd"); return WASIErrors.NOTSUP; },
            __syscall_rmdir() { warning("TODO: rmdir"); return WASIErrors.NOTSUP; },
            segfault() { warning("TODO: segfault"); return WASIErrors.NOTSUP; },
            alignfault() { warning("TODO: alignfault"); return WASIErrors.NOTSUP; },
            __wasilibc_cwd: new WebAssembly.Global({
                value: 'i32',
                mutable: true
            }, 0)
        };
    }
}
exports.WASIRunner = WASIRunner;
_WASIRunner_instance = new WeakMap(), _WASIRunner_memarr8 = new WeakMap(), _WASIRunner_memarr32 = new WeakMap(), _WASIRunner_args = new WeakMap(), _WASIRunner_envvars = new WeakMap();
//# sourceMappingURL=wasishim.js.map