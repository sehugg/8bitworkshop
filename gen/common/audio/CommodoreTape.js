"use strict";
/*
https://github.com/eightbitjim/commodore-tape-maker/blob/master/maketape.py

# MIT License
#
# Copyright (c) 2018 eightbitjim
#
# Permission is hereby granted, free of charge, to any person obtaining a copy
# of this software and associated documentation files (the "Software"), to deal
# in the Software without restriction, including without limitation the rights
# to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
# copies of the Software, and to permit persons to whom the Software is
# furnished to do so, subject to the following conditions:
#
# The above copyright notice and this permission notice shall be included in all
# copies or substantial portions of the Software.
#
# THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
# IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
# FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
# AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
# LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
# OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
# SOFTWARE.
*/
var _a;
Object.defineProperty(exports, "__esModule", { value: true });
exports.TAPFile = exports.OutputSoundFile = void 0;
class OutputSoundFile {
    constructor(options) {
        this.options = options;
        this.sampleRate = 44100.0;
        this.soundData = [];
        //00000000  43 36 34 2d 54 41 50 45  2d 52 41 57 01 00 00 00  |C64-TAPE-RAW....|
        //00000010  1e 62 03 00 
        this.tapData = [0x43, 0x36, 0x34, 0x2d, 0x54, 0x41, 0x50, 0x45, 0x2d, 0x52, 0x41, 0x57, 0x01, 0x00, 0x00, 0x00, 0, 0, 0, 0];
    }
    getWAVHeader() {
        const header = new Uint8Array(44);
        const view = new DataView(header.buffer);
        view.setUint32(0, 0x52494646, false); // "RIFF"
        view.setUint32(4, 44 + this.soundData.length, true); // ChunkSize
        view.setUint32(8, 0x57415645, false); // "WAVE"
        view.setUint32(12, 0x666d7420, false); // "fmt "
        view.setUint32(16, 16, true); // Subchunk1Size
        view.setUint16(20, 1, true); // AudioFormat (PCM)
        view.setUint16(22, 1, true); // NumChannels
        view.setUint32(24, this.sampleRate, true); // SampleRate
        view.setUint32(28, this.sampleRate * 2, true); // ByteRate
        view.setUint16(32, 1, true); // BlockAlign
        view.setUint16(34, 8, true); // BitsPerSample
        view.setUint32(36, 0x64617461, false); // "data"
        view.setUint32(40, this.soundData.length, true); // Subchunk2Size
        return header;
    }
    addSilence(lengthInSeconds) {
        const numberOfSamples = Math.floor(this.sampleRate * lengthInSeconds);
        for (let i = 0; i < numberOfSamples; i++) {
            this.soundData.push(0);
        }
        //For v1 and v2 TAP files, a $00 value is followed by 3 bytes containing the actual duration measured in clock cycles (not divided by 8). These 3 bytes are in low-high format.
        const numCycles = TAPFile.CLOCK_RATE * lengthInSeconds;
        this.tapData.push(0);
        this.tapData.push(numCycles & 0xff);
        this.tapData.push((numCycles >> 8) & 0xff);
        this.tapData.push((numCycles >> 16) & 0xff);
    }
    addCycle(cycles) {
        this.tapData.push(cycles);
        const numberOfSamples = Math.floor(this.sampleRate * TAPFile.TAP_LENGTH_IN_SECONDS * cycles);
        for (let i = 0; i < numberOfSamples; i++) {
            let value;
            if (this.options.sine_wave) {
                value = -Math.sin((i / numberOfSamples) * 2.0 * Math.PI);
            }
            else {
                if (i < numberOfSamples / 2) {
                    value = -1;
                }
                else {
                    value = 1;
                }
            }
            if (this.options.invert_waveform) {
                value = -value;
            }
            this.soundData.push(Math.round(128 + value * 127));
        }
    }
    updateTAPHeader() {
        let datalen = this.tapData.length - 0x14;
        // set bytes 0x10-0x13 to length
        this.tapData[0x10] = datalen & 0xff;
        this.tapData[0x11] = (datalen >> 8) & 0xff;
        this.tapData[0x12] = (datalen >> 16) & 0xff;
        this.tapData[0x13] = (datalen >> 24) & 0xff;
    }
    getTAPData() {
        this.updateTAPHeader();
        return new Uint8Array(this.tapData);
    }
    getSoundData() {
        let header = this.getWAVHeader();
        let data = new Uint8Array(header.length + this.soundData.length);
        data.set(header, 0);
        data.set(new Uint8Array(this.soundData), header.length);
        return data;
    }
}
exports.OutputSoundFile = OutputSoundFile;
class TAPFile {
    constructor(filename, options) {
        this.options = options;
        this.checksum = 0;
        this.data = new Uint8Array(0);
        this.filenameData = this.makeFilename(filename);
        this.startAddress = 0;
        this.endAddress = 0;
        this.fileType = _a.FILE_TYPE_NONE;
        this.waveFile = null;
    }
    makeFilename(filename) {
        const filenameBuffer = [];
        const space = 0x20;
        filename = filename.toUpperCase(); // for PETSCII
        for (let i = 0; i < _a.FILENAME_BUFFER_SIZE; i++) {
            if (filename.length <= i) {
                filenameBuffer.push(space);
            }
            else {
                let ch = filename.charCodeAt(i);
                filenameBuffer.push(ch);
            }
        }
        return filenameBuffer;
    }
    setContent(inputFile) {
        this.data = inputFile.data;
        this.startAddress = inputFile.startAddress;
        this.endAddress = inputFile.startAddress + inputFile.data.length;
        this.fileType = inputFile.type;
    }
    generateSound(outputWaveFile) {
        this.waveFile = outputWaveFile;
        this.addHeader(false);
        this.addHeader(true);
        outputWaveFile.addSilence(0.1);
        this.addFile();
    }
    addTapCycle(tapValue) {
        this.waveFile.addCycle(tapValue);
    }
    addBit(value) {
        if (value === 0) {
            this.addTapCycle(_a.SHORT_PULSE);
            this.addTapCycle(_a.MEDIUM_PULSE);
        }
        else {
            this.addTapCycle(_a.MEDIUM_PULSE);
            this.addTapCycle(_a.SHORT_PULSE);
        }
    }
    addDataMarker(moreToFollow) {
        if (moreToFollow) {
            this.addTapCycle(_a.LONG_PULSE);
            this.addTapCycle(_a.MEDIUM_PULSE);
        }
        else {
            this.addTapCycle(_a.LONG_PULSE);
            this.addTapCycle(_a.SHORT_PULSE);
        }
    }
    resetChecksum() {
        this.checksum = 0;
    }
    addByteFrame(value, moreToFollow) {
        let checkBit = 1;
        for (let i = 0; i < 8; i++) {
            const bit = (value & (1 << i)) !== 0 ? 1 : 0;
            this.addBit(bit);
            checkBit ^= bit;
        }
        this.addBit(checkBit);
        this.addDataMarker(moreToFollow);
        this.checksum ^= value;
    }
    addLeader(fileType) {
        let numberofPulses;
        if (fileType === _a.LEADER_TYPE_HEADER) {
            numberofPulses = 0x6a00;
        }
        else if (fileType === _a.LEADER_TYPE_CONTENT) {
            numberofPulses = 0x1a00;
        }
        else {
            numberofPulses = 0x4f;
        }
        for (let i = 0; i < numberofPulses; i++) {
            this.addTapCycle(_a.SHORT_PULSE);
        }
    }
    addSyncChain(repeated) {
        let value;
        if (repeated) {
            value = 0x09;
        }
        else {
            value = 0x89;
        }
        let count = 9;
        while (count > 0) {
            this.addByteFrame(value, true);
            value -= 1;
            count -= 1;
        }
    }
    addData() {
        for (let i = 0; i < this.data.length; i++) {
            this.addByteFrame(this.data[i], true);
        }
    }
    addFilename() {
        for (let i = 0; i < this.filenameData.length; i++) {
            this.addByteFrame(this.filenameData[i], true);
        }
    }
    addHeader(repeated) {
        if (repeated) {
            this.addLeader(_a.LEADER_TYPE_REPEATED);
        }
        else {
            this.addLeader(_a.LEADER_TYPE_HEADER);
        }
        this.addDataMarker(true);
        this.addSyncChain(repeated);
        this.resetChecksum();
        this.addByteFrame(this.fileType, true);
        this.addByteFrame(this.startAddress & 0x00ff, true);
        this.addByteFrame((this.startAddress & 0xff00) >> 8, true);
        this.addByteFrame(this.endAddress & 0x00ff, true);
        this.addByteFrame((this.endAddress & 0xff00) >> 8, true);
        this.addFilename();
        for (let i = 0; i < _a.NUMBER_OF_PADDING_BYTES; i++) {
            this.addByteFrame(_a.PADDING_CHARACTER, true);
        }
        this.addByteFrame(this.checksum, false);
    }
    addFile() {
        let repeated = false;
        for (let i = 0; i < 2; i++) {
            if (!repeated) {
                this.addLeader(_a.LEADER_TYPE_CONTENT);
            }
            else {
                this.addLeader(_a.LEADER_TYPE_REPEATED);
            }
            this.addDataMarker(true);
            this.addSyncChain(repeated);
            this.resetChecksum();
            this.addData();
            this.addByteFrame(this.checksum, false);
            repeated = true;
        }
        this.addLeader(1);
    }
}
exports.TAPFile = TAPFile;
_a = TAPFile;
TAPFile.CLOCK_RATE = 985248.0;
TAPFile.TAP_LENGTH_IN_SECONDS = 8.0 / _a.CLOCK_RATE;
TAPFile.FILENAME_BUFFER_SIZE = 0x10;
TAPFile.FILE_TYPE_NONE = 0;
TAPFile.FILE_TYPE_RELOCATABLE = 1;
TAPFile.FILE_TYPE_SEQUENTIAL = 2;
TAPFile.FILE_TYPE_NON_RELOCATABLE = 3;
TAPFile.LEADER_TYPE_HEADER = 0;
TAPFile.LEADER_TYPE_CONTENT = 1;
TAPFile.LEADER_TYPE_REPEATED = 2;
TAPFile.NUMBER_OF_PADDING_BYTES = 171;
TAPFile.PADDING_CHARACTER = 0x20;
TAPFile.SHORT_PULSE = 0x30;
TAPFile.MEDIUM_PULSE = 0x42;
TAPFile.LONG_PULSE = 0x56;
//# sourceMappingURL=CommodoreTape.js.map