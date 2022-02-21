/**
 * T'SoundSystem for JavaScript
 */

/**
 * SmfPlayer prototype
 *
 * Play Standard MIDI Files.
 * @author Takashi Toyoshima <toyoshim@gmail.com>
 */
var SmfPlayer = function () {
    this.masterChannel = null;
    this.defaultDevice = new MidiChannel();
    this.devices = [];
    this.tracks = [];
    this.numberOfTracks = 0;
    this.usecTempo = 1000 * 1000;
    this.timeUnit = 480;
    this.error = false;
    this.handleFalcomStyleInfiniteLoop = true;
}

SmfPlayer.TRACK_DEFAULT = -1;
SmfPlayer._SMF_CHUNK_HEADER = ('M'.charCodeAt(0) << 24) |
        ('T'.charCodeAt(0) << 16) |
        ('h'.charCodeAt(0) << 8) |
        'd'.charCodeAt(0);
SmfPlayer._SMF_CHUNK_TRACK = ('M'.charCodeAt(0) << 24) |
        ('T'.charCodeAt(0) << 16) |
        ('r'.charCodeAt(0) << 8) |
        'k'.charCodeAt(0);
SmfPlayer._SMF_FORMAT_0 = 0;
SmfPlayer._SMF_FORMAT_1 = 1;
SmfPlayer._SMF_EVENT_SYSEX = 0xf0;
SmfPlayer._SMF_EVENT_META = 0xff;
SmfPlayer._SMF_META_SEQUENCE_NUMBER = 0x00;
SmfPlayer._SMF_META_TEXT = 0x01;
SmfPlayer._SMF_META_COPYRIGHT = 0x02;
SmfPlayer._SMF_META_TRACK_NAME = 0x03;
SmfPlayer._SMF_META_INSTRUMENT_NAME = 0x04;
SmfPlayer._SMF_META_LYLIC = 0x05;
SmfPlayer._SMF_META_MARKER = 0x06;
SmfPlayer._SMF_META_CUE_POINT = 0x07;
SmfPlayer._SMF_META_CHANNEL_PREFIX = 0x20;
SmfPlayer._SMF_META_END_OF_TRACK = 0x2f;
SmfPlayer._SMF_META_SET_TEMPO = 0x51;
SmfPlayer._SMF_META_SMPTE_OFFSET = 0x54;
SmfPlayer._SMF_META_TIME_SIGNATURE = 0x58;
SmfPlayer._SMF_META_KEY_SIGNATURE = 0x59;

/**
 * Send MIDI events to a device
 * @param track track id
 * @param data data array
 */
SmfPlayer.prototype._sendEvent = function (track, data) {
    var device = this.devices[track];
    if (!device)
        device = this.defaultDevice;
    if (!device)
        return;
    var event = MidiChannel.createEvent(data);
    device.processEvents(event);
};

/**
 * Read unsigned 16bit data.
 * @param offset offset
 * @return unsigned 16bit data
 */
SmfPlayer.prototype._readUint16 = function (offset) {
    return (this.input[offset] << 8) |
            this.input[offset + 1];
};

/**
 * Read unsigned 32bit data.
 * @param offset offset
 * @return unsigned 32bit data
 */
SmfPlayer.prototype._readUint32 = function (offset) {
    var i32 = (this.input[offset] << 24) |
            (this.input[offset + 1] << 16) |
            (this.input[offset + 2] << 8) |
            this.input[offset + 3];
    if (i32 < 0)
        return 0x100000000 + i32;
    return i32;
};

/**
 * Read variable length unsigned integer data.
 * @param offset offset
 * @return object
 *      value: unsigned integer data
 *      length: variable length
 */
SmfPlayer.prototype._readUint = function (array, offset) {
    var n = 0;
    var length = array.byteLength;
    var success = false;
    for (var i = offset; i < length; i++) {
        var c = array[i];
        if (c < 0x80) {
            n += c;
            success = true;
            i++;
            break;
        } else {
            n += c & 0x7f;
            n <<= 7;
        }
    }
    return {
        value: n,
        length: i - offset,
        success: success
    }
};

/**
 * Read chunk header (8 bytes).
 * @param offset offset
 * @return object
 *      type: chunk type
 *      length: chunk length (except for header size)
 */
SmfPlayer.prototype._readChunkHeader = function (offset) {
    var type = this._readUint32(offset);
    var length = this._readUint32(offset + 4);
    if (SmfPlayer._SMF_CHUNK_HEADER == type)
        Log.getLog().info("SMF: MThd (header chunk)");
    else if (SmfPlayer._SMF_CHUNK_TRACK == type)
        Log.getLog().info("SMF: MTrk (track chunk)");
    else
        Log.getLog().warn("SMF: " + String.fromCharCode(offset) +
                String.fromCharCode(offset + 1) +
                String.fromCharCode(offset + 2) +
                String.fromCharCode(offset + 3) + " (unknown)");
    Log.getLog().info("SMF: length: " + length);
    return {
        type: type,
        length: length
    };
};

/**
 * Update timer callback.
 */
SmfPlayer.prototype._updateTimer = function () {
    var interval = (this.usecTempo / 1000) / this.timeUnit;
    Log.getLog().info("SMF: set timer interval as " + interval);
    this.masterChannel.setPlayerInterval(interval);
};

/**
 * Set master channel to write output stream.
 * @param channel master channel
 */
SmfPlayer.prototype.setMasterChannel = function (channel) {
    if (!channel) {
        this.masterChannel = null;
        return;
    }

    channel.clearChannel();
    if (this.defaultDevice)
        channel.addChannel(this.defaultDevice);
    for (var i = 0; i < this.devices.length; i++) {
        if (!this.devices[i])
            continue;
        channel.addChannel(this.devices[i]);
    }
    channel.setPlayer(this);
    this.masterChannel = channel;
};

/**
 * Set playback device for each track. If track is SmfPlayer.TRACK_DEFAULT
 * the device will be used for tracks which doesn't have specific setting.
 * @param track track to set
 * @param device device
 */
SmfPlayer.prototype.setDevice = function (track, device) {
    if (SmfPlayer.TRACK_DEFAULT == track) {
        if (this.masterChannel) {
            if (this.defaultDevice)
                this.masterChannel.removeChannel(this.defaultDevice);
            if (device)
                this.masterChannel.addChannel(device);
        }
        this.defaultDevice = device;
    } else {
        if (this.masterChannel) {
            if (this.devices[track])
                this.masterChannel.removeChannel(this.devices[track]);
            if (device)
                this.masterChannel.addChannel(device);
        }
        this.devices[track] = device;
    }
};

/**
 * Channel reach to periodical call back point.
 */
SmfPlayer.prototype.updateDevice = function () {
    if (this.error)
        return;
    for (var track = 0; track < this.numberOfTracks; track++) {
        var work = this.tracks[track];
        if (!work.active)
            continue;
        work.count--;
        if (0 != work.count)
            continue;
        var length = work.data.byteLength;
        do {
            if (work.offset == length) {
                Log.getLog().error("SMF: event not found");
                this.error = true;
                break;
            }
            var event = work.data[work.offset];
            // Handle running status.
            if (event >= 0x80) {
                work.lastEvent = event;
            } else {
                event = work.lastEvent;
                work.offset--;
            }
            var dataLength = 3;
            if ((0xc0 <= event) && (event < 0xe0))
                dataLength = 2;
            if ((work.offset + dataLength) > length) {
                Log.getLog().error("SMF: invalid event data at " +
                        work.offset);
                this.error = true;
                break;
            }
            if (SmfPlayer._SMF_EVENT_SYSEX == event) {
                work.offset++;
                dataLength = 1 + work.data[work.offset];
                if (work.offset + dataLength > length) {
                    Log.getLog().error("SMF: invalid sysex data");
                    this.error = true;
                    break;
                }
            } else if (SmfPlayer._SMF_EVENT_META == event) {
                var type = work.data[work.offset + 1];
                dataLength = 3 + work.data[work.offset + 2];
                if (work.offset + dataLength > length) {
                    Log.getLog().error("SMF: invalid meta data");
                    this.error = true;
                    break;
                }
                if (SmfPlayer._SMF_META_TRACK_NAME == type) {
                    try {
                        var text = TString.createFromUint8Array(
                                work.data.subarray(work.offset + 3,
                                        work.offset + dataLength));
                        Log.getLog().info("SMF: track name; " +
                                text.toString());
                    } catch (e) {
                        Log.getLog().warn("SMF: track name is not UTF-8 text");
                    }
                } else if (SmfPlayer._SMF_META_MARKER == type) {
                    try {
                        var marker = TString.createFromUint8Array(
                                work.data.subarray(work.offset + 3,
                                        work.offset + dataLength));
                        Log.getLog().info("SMF: marker; " + marker.toString());
                    } catch (e) {
                        Log.getLog().warn("SMF: marker is not UTF-8 text");
                    }
                    if (this.handleFalcomStyleInfiniteLoop &&
                            (1 == work.data[work.offset + 2])) {
                        var mark = work.data[work.offset + 3];
                        if (0x41 == mark) {
                            work.loopOffset = work.offset;
                            Log.getLog().info("SMF: marker A handled as " +
                                    "infinite loop start in falcom style");
                        } else if (0x42 == mark) {
                            work.offset = work.loopOffset;
                            Log.getLog().info("SMF: marker B handled as " +
                                "infinite loop end in falcom style");
                            continue;
                        }
                    }
                } else if (SmfPlayer._SMF_META_SET_TEMPO == type) {
                    this.usecTempo = (work.data[work.offset + 3] << 16) |
                        (work.data[work.offset + 4] << 8) |
                        work.data[work.offset + 5];
                    var tempo = ~~(60000000 / this.usecTempo);
                    Log.getLog().info("SMF: tempo " + tempo);
                    this._updateTimer();
                } else {
                    Log.getLog().info("SMF: meta type " + type);
                }
            } else if (0xf0 == (event & 0xf0)) {
                // Handle running status.
                Log.getLog().error("SMF: unsupported system common message " +
                        event.toString(16));
                this.error = true;
                break;
            } else if (event < 0x80) {
                Log.getLog().warn("SMF: skip invalid data " +
                        event.toString(16));
                work.offset++;
                continue;
            }
            if (SmfPlayer._SMF_EVENT_META != event) {
                var eventData = new Uint8Array(dataLength);
                eventData[0] = event;
                for (var offset = 1; offset < dataLength; offset++)
                    eventData[offset] = work.data[work.offset + offset];
                this._sendEvent(track, eventData);
            }
            work.offset += dataLength;

            var deltaTime = this._readUint(work.data, work.offset);
            if (!deltaTime.success) {
                if (0 == deltaTime.length) {
                    Log.getLog().info("SMF: track " + track + " end");
                    work.active = false;
                } else {
                    Log.getLog().error("SMF: invalid delta time");
                    this.error = true;
                }
                break;
            }
            work.count = deltaTime.value;
            work.offset += deltaTime.length;
        } while (0 == work.count);
    }
};

/**
 * Decode and play.
 * @param newInput ArrayBuffer to play
 * @return success or not
 */
SmfPlayer.prototype.play = function (newInput) {
    this.input = new Uint8Array(newInput);
    var length = this.input.byteLength;
    Log.getLog().info("SMF: load " + length + " Bytes");

    var totalLength = 0;
    var headerProcessed = false;
    var processedTracks = 0;
    for (var offset = 0; offset < length; offset += totalLength) {
        var chunkHeader = this._readChunkHeader(offset);
        offset += 8;
        if (SmfPlayer._SMF_CHUNK_HEADER == chunkHeader.type) {
            if (headerProcessed) {
                Log.getLog().error("SMF: header chunks appear twice");
                return false;
            }
            headerProcessed = true;
            var format = this._readUint16(offset);
            this.numberOfTracks = this._readUint16(offset + 2);
            this.timeUnit = this._readUint16(offset + 4);
            if (6 != chunkHeader.length)
                Log.getLog().warn("SMF: invalid chunk header length: " +
                        chunkHeader.length);
            Log.getLog().info("SMF: format " + format);
            Log.getLog().info("SMF: tracks " + this.numberOfTracks);
            Log.getLog().info("SMF: time unit " + this.timeUnit);

            if (SmfPlayer._SMF_FORMAT_0 == format) {
                if (1 != this.numberOfTracks) {
                    Log.getLog().warn("SMF: invalid track number in format 0");
                    this.numberOfTracks = 1;
                }
            }
        } else if (SmfPlayer._SMF_CHUNK_TRACK == chunkHeader.type) {
            Log.getLog().info("SMF: track chunk " + processedTracks);
            if (processedTracks >= this.numberOfTracks) {
                Log.getLog().error("SMF: too many tracks");
                return false;
            }
            var subArray =
                    this.input.subarray(offset, offset + chunkHeader.length);
            var deltaTime = this._readUint(subArray, 0);
            if (!deltaTime.success) {
                Log.getLog().error("SMF: track " + processedTracks +
                        " has invalid data");
                return false;
            }
            Log.getLog().info("SMF: track " + processedTracks + " initial " +
                    "delta time " + deltaTime.value);
            this.tracks[processedTracks++] = {
                data: subArray,
                offset: deltaTime.length,
                count: deltaTime.value + 1,
                lastEvent: 0,
                loopOffset: 0,
                active: true
            };
        }
        offset += chunkHeader.length;
    }

    if (headerProcessed) {
        if (!this.masterChannel) {
            Log.getLog().error("SMF: master channel is not set");
            return false;
        }
        this._updateTimer();
    }
    this.error = !headerProcessed;
    return headerProcessed;
};

/**
 * Stop playback.
 */
SmfPlayer.prototype.stop = function () {
    this.error = true;
};
