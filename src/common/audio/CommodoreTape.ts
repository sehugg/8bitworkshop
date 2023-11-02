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

export class OutputSoundFile {
    options: any;
    sampleRate: number;
    soundData: number[];
    tapData: number[];

    constructor(options: any) {
        this.options = options;
        this.sampleRate = 44100.0;
        this.soundData = [];
        //00000000  43 36 34 2d 54 41 50 45  2d 52 41 57 01 00 00 00  |C64-TAPE-RAW....|
        //00000010  1e 62 03 00 
        this.tapData = [0x43,0x36,0x34,0x2d,0x54,0x41,0x50,0x45,0x2d,0x52,0x41,0x57,0x01,0x00,0x00,0x00,0,0,0,0];
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

    addSilence(lengthInSeconds: number): void {
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

    addCycle(cycles: number): void {
        this.tapData.push(cycles);
        const numberOfSamples = Math.floor(this.sampleRate * TAPFile.TAP_LENGTH_IN_SECONDS * cycles);
        for (let i = 0; i < numberOfSamples; i++) {
            let value;
            if (this.options.sine_wave) {
                value = - Math.sin((i / numberOfSamples) * 2.0 * Math.PI);
            } else {
                if (i < numberOfSamples / 2) {
                    value = -1;
                } else {
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

    getTAPData(): Uint8Array {
        this.updateTAPHeader();
        return new Uint8Array(this.tapData);
    }

    getSoundData(): Uint8Array {
        let header = this.getWAVHeader();
        let data = new Uint8Array(header.length + this.soundData.length);
        data.set(header, 0);
        data.set(new Uint8Array(this.soundData), header.length);
        return data;
    }
}

export class TAPFile {
    
    static CLOCK_RATE = 985248.0;
    static TAP_LENGTH_IN_SECONDS = 8.0 / this.CLOCK_RATE;
    static FILENAME_BUFFER_SIZE = 0x10;
    static FILE_TYPE_NONE = 0;
    static FILE_TYPE_RELOCATABLE = 1;
    static FILE_TYPE_SEQUENTIAL = 2;
    static FILE_TYPE_NON_RELOCATABLE = 3;
    static LEADER_TYPE_HEADER = 0;
    static LEADER_TYPE_CONTENT = 1;
    static LEADER_TYPE_REPEATED = 2;
    static NUMBER_OF_PADDING_BYTES = 171;
    static PADDING_CHARACTER = 0x20;
    static SHORT_PULSE = 0x30;
    static MEDIUM_PULSE = 0x42;
    static LONG_PULSE = 0x56;

    options: any;
    checksum: number;
    data: Uint8Array;
    filenameData: number[];
    startAddress: number;
    endAddress: number;
    fileType: number;
    waveFile: OutputSoundFile;

    constructor(filename: string, options?: any) {
        this.options = options;
        this.checksum = 0;
        this.data = new Uint8Array(0);
        this.filenameData = this.makeFilename(filename);
        this.startAddress = 0;
        this.endAddress = 0;
        this.fileType = TAPFile.FILE_TYPE_NONE;
        this.waveFile = null;
    }

    makeFilename(filename: string): number[] {
        const filenameBuffer = [];
        const space = 0x20;
        filename = filename.toUpperCase(); // for PETSCII
        for (let i = 0; i < TAPFile.FILENAME_BUFFER_SIZE; i++) {
            if (filename.length <= i) {
                filenameBuffer.push(space);
            } else {
                let ch = filename.charCodeAt(i);
                filenameBuffer.push(ch);
            }
        }
        return filenameBuffer;
    }

    setContent(inputFile: { data: Uint8Array, startAddress: number, type: number }): void {
        this.data = inputFile.data;
        this.startAddress = inputFile.startAddress;
        this.endAddress = inputFile.startAddress + inputFile.data.length;
        this.fileType = inputFile.type;
    }

    generateSound(outputWaveFile: OutputSoundFile): void {
        this.waveFile = outputWaveFile;
        this.addHeader(false);
        this.addHeader(true);
        outputWaveFile.addSilence(0.1);
        this.addFile();
    }

    addTapCycle(tapValue: number): void {
        this.waveFile.addCycle(tapValue);
    }

    addBit(value: number): void {
        if (value === 0) {
            this.addTapCycle(TAPFile.SHORT_PULSE);
            this.addTapCycle(TAPFile.MEDIUM_PULSE);
        } else {
            this.addTapCycle(TAPFile.MEDIUM_PULSE);
            this.addTapCycle(TAPFile.SHORT_PULSE);
        }
    }

    addDataMarker(moreToFollow: boolean): void {
        if (moreToFollow) {
            this.addTapCycle(TAPFile.LONG_PULSE);
            this.addTapCycle(TAPFile.MEDIUM_PULSE);
        } else {
            this.addTapCycle(TAPFile.LONG_PULSE);
            this.addTapCycle(TAPFile.SHORT_PULSE);
        }
    }

    resetChecksum(): void {
        this.checksum = 0;
    }

    addByteFrame(value: number, moreToFollow: boolean): void {
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

    addLeader(fileType: number): void {
        let numberofPulses;
        if (fileType === TAPFile.LEADER_TYPE_HEADER) {
            numberofPulses = 0x6a00;
        } else if (fileType === TAPFile.LEADER_TYPE_CONTENT) {
            numberofPulses = 0x1a00;
        } else {
            numberofPulses = 0x4f;
        }
        for (let i = 0; i < numberofPulses; i++) {
            this.addTapCycle(TAPFile.SHORT_PULSE);
        }
    }

    addSyncChain(repeated: boolean): void {
        let value;
        if (repeated) {
            value = 0x09;
        } else {
            value = 0x89;
        }
        let count = 9;
        while (count > 0) {
            this.addByteFrame(value, true);
            value -= 1;
            count -= 1;
        }
    }

    addData(): void {
        for (let i = 0; i < this.data.length; i++) {
            this.addByteFrame(this.data[i], true);
        }
    }

    addFilename(): void {
        for (let i = 0; i < this.filenameData.length; i++) {
            this.addByteFrame(this.filenameData[i], true);
        }
    }

    addHeader(repeated: boolean): void {
        if (repeated) {
            this.addLeader(TAPFile.LEADER_TYPE_REPEATED);
        } else {
            this.addLeader(TAPFile.LEADER_TYPE_HEADER);
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
        for (let i = 0; i < TAPFile.NUMBER_OF_PADDING_BYTES; i++) {
            this.addByteFrame(TAPFile.PADDING_CHARACTER, true);
        }
        this.addByteFrame(this.checksum, false);
    }

    addFile(): void {
        let repeated = false;
        for (let i = 0; i < 2; i++) {
            if (!repeated) {
                this.addLeader(TAPFile.LEADER_TYPE_CONTENT);
            } else {
                this.addLeader(TAPFile.LEADER_TYPE_REPEATED);
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
