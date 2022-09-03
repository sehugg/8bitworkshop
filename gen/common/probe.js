"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ProbeRecorder = exports.ProbeFlags = void 0;
var ProbeFlags;
(function (ProbeFlags) {
    ProbeFlags[ProbeFlags["CLOCKS"] = 0] = "CLOCKS";
    ProbeFlags[ProbeFlags["EXECUTE"] = 16777216] = "EXECUTE";
    ProbeFlags[ProbeFlags["INTERRUPT"] = 134217728] = "INTERRUPT";
    ProbeFlags[ProbeFlags["ILLEGAL"] = 150994944] = "ILLEGAL";
    ProbeFlags[ProbeFlags["SP_PUSH"] = 167772160] = "SP_PUSH";
    ProbeFlags[ProbeFlags["SP_POP"] = 184549376] = "SP_POP";
    ProbeFlags[ProbeFlags["HAS_VALUE"] = 268435456] = "HAS_VALUE";
    ProbeFlags[ProbeFlags["MEM_READ"] = 301989888] = "MEM_READ";
    ProbeFlags[ProbeFlags["MEM_WRITE"] = 318767104] = "MEM_WRITE";
    ProbeFlags[ProbeFlags["IO_READ"] = 335544320] = "IO_READ";
    ProbeFlags[ProbeFlags["IO_WRITE"] = 352321536] = "IO_WRITE";
    ProbeFlags[ProbeFlags["VRAM_READ"] = 369098752] = "VRAM_READ";
    ProbeFlags[ProbeFlags["VRAM_WRITE"] = 385875968] = "VRAM_WRITE";
    ProbeFlags[ProbeFlags["DMA_READ"] = 402653184] = "DMA_READ";
    ProbeFlags[ProbeFlags["DMA_WRITE"] = 419430400] = "DMA_WRITE";
    ProbeFlags[ProbeFlags["WAIT"] = 520093696] = "WAIT";
    ProbeFlags[ProbeFlags["SCANLINE"] = 2113929216] = "SCANLINE";
    ProbeFlags[ProbeFlags["FRAME"] = 2130706432] = "FRAME";
})(ProbeFlags = exports.ProbeFlags || (exports.ProbeFlags = {}));
class ProbeFrame {
}
class ProbeRecorder {
    constructor(m, buflen) {
        this.idx = 0; // index into buffer
        this.sl = 0; // scanline
        this.cur_sp = -1; // last stack pointer
        this.singleFrame = true; // clear between frames
        this.m = m;
        this.reset(buflen || 0x100000);
    }
    start() {
        this.m.connectProbe(this);
    }
    stop() {
        this.m.connectProbe(null);
    }
    reset(newbuflen) {
        if (newbuflen)
            this.buf = new Uint32Array(newbuflen);
        this.sl = 0;
        this.cur_sp = -1;
        this.clear();
    }
    clear() {
        this.idx = 0;
    }
    logData(a) {
        this.log(a);
    }
    log(a) {
        // TODO: coalesce READ and EXECUTE and PUSH/POP
        if (this.idx >= this.buf.length)
            return;
        this.buf[this.idx++] = a;
    }
    relog(a) {
        this.buf[this.idx - 1] = a;
    }
    lastOp() {
        if (this.idx > 0)
            return this.buf[this.idx - 1] & 0xff000000;
        else
            return -1;
    }
    lastAddr() {
        if (this.idx > 0)
            return this.buf[this.idx - 1] & 0xffffff;
        else
            return -1;
    }
    addLogBuffer(src) {
        if (this.idx + src.length > this.buf.length) {
            src = src.slice(0, this.buf.length - this.idx);
        }
        this.buf.set(src, this.idx);
        this.idx += src.length;
    }
    logClocks(clocks) {
        clocks |= 0;
        if (clocks > 0) {
            if (this.lastOp() == ProbeFlags.CLOCKS)
                this.relog((this.lastAddr() + clocks) | ProbeFlags.CLOCKS); // coalesce clocks
            else
                this.log(clocks | ProbeFlags.CLOCKS);
        }
    }
    logNewScanline() {
        this.log(ProbeFlags.SCANLINE);
        this.sl++;
    }
    logNewFrame() {
        this.log(ProbeFlags.FRAME);
        this.sl = 0;
        if (this.singleFrame)
            this.clear();
    }
    logExecute(address, SP) {
        // record stack pushes/pops (from last instruction)
        if (this.cur_sp !== SP) {
            if (SP < this.cur_sp) {
                this.log(ProbeFlags.SP_PUSH | SP);
            }
            if (SP > this.cur_sp) {
                this.log(ProbeFlags.SP_POP | SP);
            }
            this.cur_sp = SP;
        }
        this.log(address | ProbeFlags.EXECUTE);
    }
    logInterrupt(type) {
        this.log(type | ProbeFlags.INTERRUPT);
    }
    logValue(address, value, op) {
        this.log((address & 0xffff) | ((value & 0xff) << 16) | op);
    }
    logRead(address, value) {
        this.logValue(address, value, ProbeFlags.MEM_READ);
    }
    logWrite(address, value) {
        this.logValue(address, value, ProbeFlags.MEM_WRITE);
    }
    logIORead(address, value) {
        this.logValue(address, value, ProbeFlags.IO_READ);
    }
    logIOWrite(address, value) {
        this.logValue(address, value, ProbeFlags.IO_WRITE);
    }
    logVRAMRead(address, value) {
        this.logValue(address, value, ProbeFlags.VRAM_READ);
    }
    logVRAMWrite(address, value) {
        this.logValue(address, value, ProbeFlags.VRAM_WRITE);
    }
    logIllegal(address) {
        this.log(address | ProbeFlags.ILLEGAL);
    }
    logWait(address) {
        this.log(address | ProbeFlags.WAIT);
    }
    logDMARead(address, value) {
        this.logValue(address, value, ProbeFlags.DMA_READ);
    }
    logDMAWrite(address, value) {
        this.logValue(address, value, ProbeFlags.DMA_WRITE);
    }
    countEvents(op) {
        var count = 0;
        for (var i = 0; i < this.idx; i++) {
            if ((this.buf[i] & 0xff000000) == op)
                count++;
        }
        return count;
    }
    countClocks() {
        var count = 0;
        for (var i = 0; i < this.idx; i++) {
            if ((this.buf[i] & 0xff000000) == ProbeFlags.CLOCKS)
                count += this.buf[i] & 0xffff;
        }
        return count;
    }
}
exports.ProbeRecorder = ProbeRecorder;
//# sourceMappingURL=probe.js.map