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

export enum FDType {
    UNKNOWN = 0,
    BLOCK_DEVICE = 1,
    CHARACTER_DEVICE = 2,
    DIRECTORY = 3,
    REGULAR_FILE = 4,
    SOCKET_DGRAM = 5,
    SOCKET_STREAM = 6,
    SYMBOLIC_LINK = 7,
}

export enum FDRights {
    FD_DATASYNC = 1,
    FD_READ = 2,
    FD_SEEK = 4,
    FD_FDSTAT_SET_FLAGS = 8,
    FD_SYNC = 16,
    FD_TELL = 32,
    FD_WRITE = 64,
    FD_ADVISE = 128,
    FD_ALLOCATE = 256,
    PATH_CREATE_DIRECTORY = 512,
    PATH_CREATE_FILE = 1024,
    PATH_LINK_SOURCE = 2048,
    PATH_LINK_TARGET = 4096,
    PATH_OPEN = 8192,
    FD_READDIR = 16384,
    PATH_READLINK = 32768,
    PATH_RENAME_SOURCE = 65536,
    PATH_RENAME_TARGET = 131072,
    PATH_FILESTAT_GET = 262144,
    PATH_FILESTAT_SET_SIZE = 524288,
    PATH_FILESTAT_SET_TIMES = 1048576,
    FD_FILESTAT_GET = 2097152,
    FD_FILESTAT_SET_SIZE = 4194304,
    FD_FILESTAT_SET_TIMES = 8388608,
    PATH_SYMLINK = 16777216,
    PATH_REMOVE_DIRECTORY = 33554432,
    PATH_UNLINK_FILE = 67108864,
    POLL_FD_READWRITE = 134217728,
    SOCK_SHUTDOWN = 268435456,
    FD_ALL = 536870911, // TODO?
}

export enum FDFlags {
    APPEND = 1,
    DSYNC = 2,
    NONBLOCK = 4,
    RSYNC = 8,
    SYNC = 16,
}

export enum FDOpenFlags {
    CREAT = 1,
    DIRECTORY = 2,
    EXCL = 4,
    TRUNC = 8,
}

export enum WASIErrors {
    SUCCESS = 0,
    TOOBIG = 1,
    ACCES = 2,
    ADDRINUSE = 3,
    ADDRNOTAVAIL = 4,
    AFNOSUPPORT = 5,
    AGAIN = 6,
    ALREADY = 7,
    BADF = 8,
    BADMSG = 9,
    BUSY = 10,
    CANCELED = 11,
    CHILD = 12,
    CONNABORTED = 13,
    CONNREFUSED = 14,
    CONNRESET = 15,
    DEADLK = 16,
    DESTADDRREQ = 17,
    DOM = 18,
    DQUOT = 19,
    EXIST = 20,
    FAULT = 21,
    FBIG = 22,
    HOSTUNREACH = 23,
    IDRM = 24,
    ILSEQ = 25,
    INPROGRESS = 26,
    INTR = 27,
    INVAL = 28,
    IO = 29,
    ISCONN = 30,
    ISDIR = 31,
    LOOP = 32,
    MFILE = 33,
    MLINK = 34,
    MSGSIZE = 35,
    MULTIHOP = 36,
    NAMETOOLONG = 37,
    NETDOWN = 38,
    NETRESET = 39,
    NETUNREACH = 40,
    NFILE = 41,
    NOBUFS = 42,
    NODEV = 43,
    NOENT = 44,
    NOEXEC = 45,
    NOLCK = 46,
    NOLINK = 47,
    NOMEM = 48,
    NOMSG = 49,
    NOPROTOOPT = 50,
    NOSPC = 51,
    NOSYS = 52,
    NOTCONN = 53,
    NOTDIR = 54,
    NOTEMPTY = 55,
    NOTRECOVERABLE = 56,
    NOTSOCK = 57,
    NOTSUP = 58,
    NOTTY = 59,
    NXIO = 60,
    OVERFLOW = 61,
    OWNERDEAD = 62,
    PERM = 63,
    PIPE = 64,
    PROTO = 65,
    PROTONOSUPPORT = 66,
    PROTOTYPE = 67,
    RANGE = 68,
    ROFS = 69,
    SPIPE = 70,
    SRCH = 71,
    STALE = 72,
    TIMEDOUT = 73,
    TXTBSY = 74,
    XDEV = 75,
    NOTCAPABLE = 76,
}

export class WASIFileDescriptor {
    fdindex: number = -1;
    protected data: Uint8Array = new Uint8Array(16);
    flags: number = 0;
    size: number = 0;
    offset: number = 0;

    constructor(public name: string, public type: FDType, public rights: number) {
        this.rights = -1; // TODO?
    }
    ensureCapacity(size: number) {
        if (this.data.byteLength < size) {
            const newdata = new Uint8Array(size * 2); // TODO?
            newdata.set(this.data);
            this.data = newdata;
        }
    }
    write(chunk: Uint8Array) {
        this.ensureCapacity(this.offset + chunk.byteLength);
        this.data.set(chunk, this.offset);
        this.offset += chunk.byteLength;
        this.size = Math.max(this.size, this.offset);
    }
    read(chunk: Uint8Array) {
        const len = Math.min(chunk.byteLength, this.size - this.offset);
        chunk.set(this.data.subarray(this.offset, this.offset + len));
        this.offset += len;
        return len;
    }
    truncate() {
        this.size = 0;
        this.offset = 0;
    }
    llseek(offset: number, whence: number) {
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
        if (this.offset < 0) this.offset = 0;
        if (this.offset > this.size) this.offset = this.size;
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

class WASIStreamingFileDescriptor extends WASIFileDescriptor {
    constructor(fdindex: number, name: string, type: FDType, rights: number,
        private stream: NodeJS.WritableStream) {
        super(name, type, rights);
        this.fdindex = fdindex;
    }
    write(chunk: Uint8Array) {
        this.stream.write(chunk);
    }
}

export interface WASIFilesystem {
    getFile(name: string) : WASIFileDescriptor;
    getFiles() : WASIFileDescriptor[];
    getDirectories() : WASIFileDescriptor[];
}

export class WASIMemoryFilesystem implements WASIFilesystem {
    private parent: WASIFilesystem | null = null;
    private files: Map<string, WASIFileDescriptor> = new Map();
    private dirs: Map<string, WASIFileDescriptor> = new Map();

    constructor() {
        this.putDirectory("/");
    }
    setParent(parent: WASIFilesystem) {
        this.parent = parent;
    }
    putDirectory(name: string, rights?: number) {
        if (!rights) rights = FDRights.PATH_OPEN | FDRights.PATH_CREATE_DIRECTORY | FDRights.PATH_CREATE_FILE;
        if (name != '/' && name.endsWith('/')) name = name.substring(0, name.length - 1);
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
    putFile(name: string, data: string | Uint8Array, rights?: number) {
        if (typeof data === 'string') {
            data = new TextEncoder().encode(data);
        }
        if (!rights) rights = FDRights.FD_READ | FDRights.FD_WRITE;
        const file = new WASIFileDescriptor(name, FDType.REGULAR_FILE, rights);
        file.write(data);
        file.offset = 0;
        this.files.set(name, file);
        return file;
    }
    putSymbolicLink(name: string, target: string, rights?: number) {
        if (!rights) rights = FDRights.PATH_SYMLINK;
        const file = new WASIFileDescriptor(name, FDType.SYMBOLIC_LINK, rights);
        file.write(new TextEncoder().encode(target));
        file.offset = 0;
        this.files.set(name, file);
        return file;
    }
    getFile(name: string) {
        let file = this.files.get(name);
        if (!file) {
            file = this.parent?.getFile(name);
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

export class WASIRunner {
    #instance : any; // TODO
    #memarr8: Uint8Array;
    #memarr32: Int32Array;
    #args: Uint8Array[] = [];
    #envvars: Uint8Array[] = [];

    stdin : WASIFileDescriptor;
    stdout : WASIFileDescriptor;
    stderr : WASIFileDescriptor;

    fds: WASIFileDescriptor[] = [];
    exited = false;
    errno = -1;
    fs = new WASIMemoryFilesystem();

    constructor() {
        this.createStdioBrowser();
    }
    exports() {
        return this.#instance.exports;
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
    initSync(wasmModule: WebAssembly.Module) {
        this.#instance = new WebAssembly.Instance(wasmModule, this.getImportObject());
    }
    loadSync(wasmSource: Uint8Array) {
        let wasmModule = new WebAssembly.Module(wasmSource);
        this.initSync(wasmModule);
    }
    async loadAsync(wasmSource: Uint8Array) {
        let wasmModule = await WebAssembly.compile(wasmSource);
        this.#instance = await WebAssembly.instantiate(wasmModule, this.getImportObject());
    }
    setArgs(args: string[]) {
        this.#args = args.map(arg => new TextEncoder().encode(arg + '\0'));
    }
    addPreopenDirectory(name: string) {
        return this.openFile(name, FDOpenFlags.DIRECTORY | FDOpenFlags.CREAT);
    }
    openFile(path: string, o_flags: number, mode?: number): WASIFileDescriptor | number {
        let file = this.fs.getFile(path);
        mode = typeof mode == 'undefined' ? 438 /* 0666 */ : mode;
        if (o_flags & FDOpenFlags.CREAT) {
            if (file == null) {
                if (o_flags & FDOpenFlags.DIRECTORY) {
                    file = this.fs.putDirectory(path);
                } else {
                    file = this.fs.putFile(path, new Uint8Array(), FDRights.FD_ALL);
                }
            } else {
                if (o_flags & FDOpenFlags.TRUNC) { // truncate
                    file.truncate();
                } else return WASIErrors.INVAL;
            }
        } else {
            if (file == null) return WASIErrors.NOSYS;
            if (o_flags & FDOpenFlags.DIRECTORY) { // check type
                if (file.type !== FDType.DIRECTORY) return WASIErrors.NOSYS;
            }
            if (o_flags & FDOpenFlags.EXCL) return WASIErrors.INVAL; // already exists
            if (o_flags & FDOpenFlags.TRUNC) { // truncate
                file.truncate();
            } else {
                file.llseek(0, 0); // seek to start
            }
        }
        file.fdindex = this.fds.length;
        this.fds.push(file);
        return file;
    }
    mem8() {
        if (!this.#memarr8?.byteLength) {
            this.#memarr8 = new Uint8Array(this.#instance.exports.memory.buffer);
        }
        return this.#memarr8;
    }
    mem32() {
        if (!this.#memarr32?.byteLength) {
            this.#memarr32 = new Int32Array(this.#instance.exports.memory.buffer);
        }
        return this.#memarr32;
    }
    run() {
        try {
            this.#instance.exports._start();
            if (!this.exited) {
                this.exited = true;
                this.errno = 0;
            }
        } catch (err) {
            if (!this.exited) throw err;
        }
        return this.getErrno();
    }
    initialize() {
        this.#instance.exports._initialize();
        return this.getErrno();
    }
    getImportObject() {
        return {
            "wasi_snapshot_preview1": this.getWASISnapshotPreview1(),
            "env": this.getEnv(),
        }
    }
    peek8(ptr: number) {
        return this.mem8()[ptr];
    }
    peek16(ptr: number) {
        return this.mem8()[ptr] | (this.mem8()[ptr + 1] << 8);
    }
    peek32(ptr: number) {
        return this.mem32()[ptr >>> 2];
    }
    poke8(ptr: number, val: number) {
        this.mem8()[ptr] = val;
    }
    poke16(ptr: number, val: number) {
        this.mem8()[ptr] = val;
        this.mem8()[ptr + 1] = val >> 8;
    }
    poke32(ptr: number, val: number) {
        this.mem32()[ptr >>> 2] = val;
    }
    poke64(ptr: number, val: number) {
        this.mem32()[ptr >>> 2] = val;
        this.mem32()[(ptr >>> 2) + 1] = 0;
    }
    pokeUTF8(str: string, ptr: number, maxlen: number) {
        const enc = new TextEncoder();
        const bytes = enc.encode(str);
        const len = Math.min(bytes.length, maxlen);
        this.mem8().set(bytes.subarray(0, len), ptr);
        return len;
    }
    peekUTF8(ptr: number, maxlen: number) {
        const bytes = this.mem8().subarray(ptr, ptr + maxlen);
        const dec = new TextDecoder();
        return dec.decode(bytes);
    }
    getErrno() {
        return this.errno;
        //let errno_ptr = this.#instance.exports.__errno_location();
        //return this.peek32(errno_ptr);
    }
    poke_str_array_sizes(strs: Uint8Array[], count_ptr: number, buf_size_ptr: number) {
        this.poke32(count_ptr, strs.length);
        this.poke32(buf_size_ptr, strs.reduce((acc, arg) => acc + arg.length, 0));
    }
    poke_str_args(strs: Uint8Array[], argv_ptr: number, argv_buf_ptr: number) {
        let argv = argv_ptr;
        let argv_buf = argv_buf_ptr;
        for (let arg of this.#args) {
            this.poke32(argv, argv_buf);
            argv += 4;
            for (let i = 0; i < arg.length; i++) {
                this.poke8(argv_buf, arg[i]);
                argv_buf++;
            }
        }
    }
    args_sizes_get(argcount_ptr: number, argv_buf_size_ptr: number) {
        debug("args_sizes_get", argcount_ptr, argv_buf_size_ptr);
        this.poke_str_array_sizes(this.#args, argcount_ptr, argv_buf_size_ptr);
        return 0;
    }
    args_get(argv_ptr: number, argv_buf_ptr: number) {
        debug("args_get", argv_ptr, argv_buf_ptr);
        this.poke_str_args(this.#args, argv_ptr, argv_buf_ptr);
        return 0;
    }
    environ_sizes_get(environ_count_ptr: number, environ_buf_size_ptr: number) {
        debug("environ_sizes_get", environ_count_ptr, environ_buf_size_ptr);
        this.poke_str_array_sizes(this.#envvars, environ_count_ptr, environ_buf_size_ptr);
        return 0;
    }
    environ_get(environ_ptr: number, environ_buf_ptr: number) {
        debug("environ_get", environ_ptr, environ_buf_ptr);
        this.poke_str_args(this.#envvars, environ_ptr, environ_buf_ptr);
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
    fd_seek(fd: number, offset: number, whence: number, newoffset_ptr: number) {
        const file = this.fds[fd];
        if (typeof offset == 'bigint') offset = Number(offset);
        debug("fd_seek", fd, offset, whence, file+"");
        if (file != null) {
            file.llseek(offset, whence);
            this.poke64(newoffset_ptr, file.offset);
            return WASIErrors.SUCCESS;
        }
        return WASIErrors.BADF;
    }
    fd_close(fd: number) {
        debug("fd_close", fd);
        const file = this.fds[fd];
        if (file != null) {
            this.fds[fd] = null;
            return 0;
        }
        return WASIErrors.BADF;
    }
    proc_exit(errno: number) {
        debug("proc_exit", errno);
        this.errno = errno;
        this.exited = true;
    }
    fd_prestat_get(fd: number, prestat_ptr: number) {
        const file = this.fds[fd];
        debug("fd_prestat_get", fd, prestat_ptr, file?.name);
        if (file && file.type === FDType.DIRECTORY) {
            const enc_name = new TextEncoder().encode(file.name);
            this.poke8(prestat_ptr + 0, 0); // __WASI_PREOPENTYPE_DIR
            this.poke64(prestat_ptr + 8, enc_name.length);
            return WASIErrors.SUCCESS;
        }
        return WASIErrors.BADF;
    }
    fd_fdstat_get(fd: number, fdstat_ptr: number) {
        const file = this.fds[fd];
        debug("fd_fdstat_get", fd, fdstat_ptr, file + "");
        if (file != null) {
            this.poke16(fdstat_ptr + 0, file.type); // fs_filetype
            this.poke16(fdstat_ptr + 2, file.flags); // fs_flags
            this.poke64(fdstat_ptr + 8, file.rights); // fs_rights_base
            this.poke64(fdstat_ptr + 16, file.rights);  // fs_rights_inheriting
            return WASIErrors.SUCCESS;
        }
        return WASIErrors.BADF;
    }
    fd_prestat_dir_name(fd: number, path_ptr: number, path_len: number) {
        const file = this.fds[fd];
        debug("fd_prestat_dir_name", fd, path_ptr, path_len);
        if (file != null) {
            this.pokeUTF8(file.name, path_ptr, path_len);
            return WASIErrors.SUCCESS;
        }
        return WASIErrors.INVAL;
    }
    path_open(dirfd: number, dirflags: number, path_ptr: number, path_len: number,
        o_flags: number, fs_rights_base: number, fs_rights_inheriting: number,
        fd_flags: number, fd_ptr: number)
    {
        const dir = this.fds[dirfd];
        if (dir == null) return WASIErrors.BADF;
        if (dir.type !== FDType.DIRECTORY) return WASIErrors.NOTDIR;
        const filename = this.peekUTF8(path_ptr, path_len);
        const path = dir.name + '/' + filename;
        const fd = this.openFile(path, o_flags, fd_flags);
        debug("path_open", path, dirfd, dirflags, 
            o_flags, //fs_rights_base, fs_rights_inheriting,
            fd_flags, fd_ptr, '->', fd + "");
        if (typeof fd === 'number') return fd; // error msg
        this.poke32(fd_ptr, fd.fdindex);
        return WASIErrors.SUCCESS;
    }
    random_get(ptr: number, len: number) {
        debug("random_get", ptr, len);
        for (let i=0; i<len; i++) {
            // TODO: don't use for crypto
            this.poke8(ptr + i, Math.floor(Math.random() * 256));
        }
        return WASIErrors.SUCCESS;
    }
    path_filestat_get(dirfd: number, dirflags: number, path_ptr: number, path_len: number, filestat_ptr: number) {
        const dir = this.fds[dirfd];
        if (dir == null) return WASIErrors.BADF;
        if (dir.type !== FDType.DIRECTORY) return WASIErrors.NOTDIR;
        const filename = this.peekUTF8(path_ptr, path_len);
        const path = filename.startsWith('/') ? filename : dir.name + '/' + filename; // TODO?
        const fd = this.fs.getFile(path);
        console.log("path_filestat_get", dir+"", filename, path, filestat_ptr, '->', fd+"");
        if (!fd) return WASIErrors.NOENT;
        this.poke64(filestat_ptr, fd.fdindex); // dev
        this.poke64(filestat_ptr + 8, 0); // ino
        this.poke8(filestat_ptr + 16, fd.type); // filetype
        this.poke64(filestat_ptr + 24, 1); // nlink
        this.poke64(filestat_ptr + 32, fd.size); // size
        this.poke64(filestat_ptr + 40, 0); // atim
        this.poke64(filestat_ptr + 48, 0); // mtim
        this.poke64(filestat_ptr + 56, 0); // ctim
    }
    path_readlink(dirfd: number, path_ptr: number, path_len: number, buf_ptr: number, buf_len: number, buf_used_ptr: number) {
        const dir = this.fds[dirfd];
        debug("path_readlink", dirfd, path_ptr, path_len, buf_ptr, buf_len, buf_used_ptr, dir+"");
        if (dir == null) return WASIErrors.BADF;
        if (dir.type !== FDType.DIRECTORY) return WASIErrors.NOTDIR;
        const filename = this.peekUTF8(path_ptr, path_len); 
        const path = dir.name + '/' + filename;
        const fd = this.fs.getFile(path);
        debug("path_readlink", path, fd+"");
        if (!fd) return WASIErrors.NOENT;
        if (fd.type !== FDType.SYMBOLIC_LINK) return WASIErrors.INVAL;
        const target = fd.getBytesAsString();
        const len = this.pokeUTF8(target, buf_ptr, buf_len);
        this.poke32(buf_used_ptr, len);
        debug("path_readlink", path, '->', target);
        return WASIErrors.SUCCESS;
    }
    path_readlinkat(dirfd: number, path_ptr: number, path_len: number, buf_ptr: number, buf_len: number, buf_used_ptr: number) {
        return this.path_readlink(dirfd, path_ptr, path_len, buf_ptr, buf_len, buf_used_ptr);
    }
    path_unlink_file(dirfd: number, path_ptr: number, path_len: number) {
        const dir = this.fds[dirfd];
        if (dir == null) return WASIErrors.BADF;
        if (dir.type !== FDType.DIRECTORY) return WASIErrors.NOTDIR;
        const filename = this.peekUTF8(path_ptr, path_len);
        const path = dir.name + '/' + filename;
        const fd = this.fs.getFile(path);
        debug("path_unlink_file", dir+"", path, fd+"");
        if (!fd) return WASIErrors.NOENT;
        this.fs.getFile(path);
        return WASIErrors.SUCCESS;
    }
    clock_time_get(clock_id: number, precision: number, time_ptr: number) {
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
        }
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
        }
    }
}
