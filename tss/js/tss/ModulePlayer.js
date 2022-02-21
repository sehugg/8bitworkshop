/**
 * T'SoundSystem for JavaScript
 */

/**
 * ModulePlayer prototype
 *
 * Play a MOD file.
 * @author Takashi Toyoshima <toyoshim@gmail.com>
 *
 * @constructor
 */
var ModulePlayer = function () {
  this._buffer = null;
  this._sampleRate = MasterChannel.DEFAULT_SAMPLE_FREQUENCY;
  this._playing = false;
  this._order = 0;
  this._division = 0;
  this._samplePerDivision = 0;
  this._samples = 0;
  this._channels = null;
}

ModulePlayer._PERIOD_TABLE = (function () {
  var tones = [
      'C ', 'C#', 'D ', 'D#', 'E ', 'F ', 'F#', 'G ', 'G#', 'A ', 'A#', 'B '
  ];
  // Octave 0 and 4 are not officially supported in a standard MOD format.
  // Note that an unknown tracker may use other values insteads.
  var periods = [
      [1712,1616,1525,1440,1357,1281,1209,1141,1077,1017, 961, 907 ],
      [ 856, 808, 762, 720, 678, 640, 604, 570, 538, 508, 480, 453 ],
      [ 428, 404, 381, 360, 339, 320, 302, 285, 269, 254, 240, 226 ],
      [ 214, 202, 190, 180, 170, 160, 151, 143, 135, 127, 120, 113 ],
      [ 107, 101,  95,  90,  85,  80,  76,  71,  67,  64,  60,  57 ]
  ];
  var i, j;
  var table = {};
  for (i = 0; i <= 4; ++i)
    for (j = 0; j < 12; ++j)
      table[periods[i][j]] = tones[j] + i;
  return table;
})();

/**
 * @see MasterChannel
 * @param length buffer length or size in shorts
 */
ModulePlayer.prototype.setBufferLength = function (length) {
  this._buffer = new Int32Array(length);
};

/**
 * @see MasterChannel
 * @return audio stream buffer
 */
ModulePlayer.prototype.getBuffer = function () {
  return this._buffer;
};

/**
 * @see MasterChannel
 * @param rate sample rate
 */
ModulePlayer.prototype.setSampleRate = function (rate) {
  this._sampleRate = rate;
};

/**
 * @see MasterChannel
 * @param length sound length in short to grenerate
 */
ModulePlayer.prototype.generate = function (length) {
  var offset;
  if (!this._playing) {
    for (offset = 0; offset < length; ++offset)
      this._buffer[offset] = 0;
  } else {
    for (offset = 0; offset < length; offset += 2) {
      this._buffer[offset + 0] =
          this._channels[0].generate() + this._channels[3].generate();
      this._buffer[offset + 1] =
          this._channels[1].generate() + this._channels[2].generate();
    }
  }
  this._samples += length / 2;
  if (this._samples >= this._samplePerDivision) {
    this._step();
    this._samples -= this._samplePerDivision;
  }
};

/**
 * Set master channel to write output stream.
 * @param channel master channel
 */
ModulePlayer.prototype.setMasterChannel = function(channel) {
  if (null != channel) {
    channel.clearChannel();
    channel.addChannel(this);
    channel.setPlayer(this);
  }
  this.master = channel;
};

ModulePlayer.prototype._loadString = function (data, offset, length) {
  var i;
  var last = offset + length - 1;
  var result = [];
  for (i = offset; i <= last; ++i) {
    if (data[i] == 0)
      break;
    result.push(String.fromCharCode(data[i]));
  }
  return result.join('');
};

ModulePlayer.prototype._loadWord = function (data, offset) {
  return data[offset] << 8 | data[offset + 1];
};

ModulePlayer.prototype._loadSignedHalf = function (data, offset) {
  var unsigned_half = data[offset] & 0x0f;
  if (unsigned_half < 0x08)
    return unsigned_half;
  return unsigned_half - 0x10;
};

ModulePlayer.prototype._loadSampleHeader = function (data, offset) {
  var title = this._loadString(data, offset, 22);
  var length = this._loadWord(data, offset + 22);
  var finetune = this._loadSignedHalf(data, offset + 24);
  var volume = data[offset + 25];
  var repeatPoint = this._loadWord(data, offset + 26);
  var repeatLength = this._loadWord(data, offset + 28);
  if (volume > 64) {
    Log.getLog().warn('MOD: Unexpected sampling volume: ' + volume);
    volume = 64;
  }
  return {
    name: title,
    length: length,
    finetune: finetune,
    volume: volume,
    repeat: {
      point: repeatPoint,
      length: repeatLength
    }
  };
};

ModulePlayer.prototype._loadNote = function (data, offset, lastPeriod) {
  var b1 = data[offset];
  var period = (b1 & 0x0f) << 8 | data[offset + 1];
  var b3 = data[offset + 2];
  var sample = (b1 & 0xf0) | (b3 >> 4);
  var b4 = data[offset + 3];
  var effect = [b3 & 0x0f, b4 >> 4, b4 & 0x0f];
  var note = {};
  if (effect[0] || effect[1] || effect[2]) {
    // TODO: Decode details here?
    note['effect'] = effect;
  }
  if (sample == 0) {
    if (period != 0)
      Log.getLog().warn('MOD: Unexpected valid period for sample 0');
  } else {
    if (!period)
      period = lastPeriod;
    var noteName = ModulePlayer._PERIOD_TABLE[period];
    if (!noteName)
      Log.getLog().warn('MOD: Unexpected period value: ' + period);
    note['note'] = {
      sample: sample,
      period: period,
      note: noteName
    };
  }
  return note;
};

ModulePlayer.prototype._loadDivision = function (data, offset, lastPeriods) {
  var quad = [
    this._loadNote(data, offset, lastPeriods[0]),
    this._loadNote(data, offset + 4, lastPeriods[1]),
    this._loadNote(data, offset + 8, lastPeriods[2]),
    this._loadNote(data, offset + 12, lastPeriods[3])
  ];
  return quad;
};

ModulePlayer.prototype._loadPattern = function (data, offset) {
  var lastPeriods = [0, 0, 0, 0];
  var patterns = [];
  var i;
  for (i = 0; i < 64; ++i) {
    var pattern = this._loadDivision(data, offset + 16 * i, lastPeriods);
    var ch;
    for (ch = 0; ch < 4; ++ch) {
      if (pattern[ch].note)
        lastPeriods[ch] = pattern[ch].note.period;
    }
    patterns.push(pattern);
  }
  return patterns;
};

ModulePlayer.prototype._loadSampleData = function (sample, data, offset) {
  sample.length *= 2;
  sample.type = 's8';
  sample.channels = 1;
  sample.start = 2;
  if (sample.repeat) {
    sample.repeat.point *= 2;
    sample.repeat.length *= 2;
  }
  sample.data = new Int8Array(sample.length);
  var i;
  for (i = 0; i < sample.length; ++i)
    sample.data[i] = data[offset + i];
};

ModulePlayer.prototype._step = function () {
  if (!this._playing)
    return;
  var order = this._data.order[this._order];
  var pattern = this._data.patterns[order];
  var division = pattern[this._division];

  this._division++;
  if (this._division == 64) {
    this._division = 0;
    this._order++;
    if (this._order >= this._data.order.length)
      this._playing = false;
  }

  var ch;
  for (ch = 0; ch < 4; ++ch) {
    var note = division[ch].note;
    if (!note)
      continue;
    this._channels[ch].on(note.sample, note.period);
  }
};

/**
 * Load a data in ArrayBuffer to convert.
 * @param input input data in ArrayBuffer to convert
 * @return jmix object
 */
ModulePlayer.prototype.load = function (input) {
  var data = new Uint8Array(input);
  var title = this._loadString(data, 0, 20);
  var samples = [{length: 0}];
  var i;
  for (i = 0; i < 31; ++i)
    samples.push(this._loadSampleHeader(data, 20 + i * 30));
  var songLength = data[950];
  if (songLength > 128) {
    Log.getLog().error('MOD: Unexpected song length: ' + songLength);
    return null;
  }
  var maybe127 = data[951];
  if (maybe127 && maybe127 != 127)
    Log.getLog().warn('MOD: Unexpected pattern length: ' + maybe127);
  var songPositions = [];
  var highestPatternNumber = 0;
  for (i = 0; i < songLength; ++i) {
    var pattern = data[952 + i];
    songPositions[i] = pattern;
    if (pattern > highestPatternNumber)
      highestPatternNumber = pattern;
  }
  // TODO: Support '6CHN', '8CHN', 'FLT8', and so on.
  // Also, no letters will mean pattern starts here, and only 15 samples exist.
  var format = this._loadString(data, 1080, 4);
  if (format != 'M.K.' && format != 'M!K!' && format != 'FLT4') {
    Log.getLog().error('MOD: M.K. or FLT4 mark does not exist, but ' + format);
    return null;
  }
  var patterns = [];
  for (i = 0; i <= highestPatternNumber; ++i) {
    var pattern = this._loadPattern(data, 1084 + 1024 * i);
    patterns.push(pattern);
  }

  var offset = 1084 + 1024 * (highestPatternNumber + 1);
  for (i = 0; i < samples.length; ++i) {
    this._loadSampleData(samples[i], data, offset);
    offset += samples[i].length;
  }

  var jmix = {
    title: title,
    channel: 4,
    bpm: 125,
    order: songPositions,
    patterns: patterns,
    samples: samples
  };
  return jmix;
};

/**
 * Play a jmix object data.
 * @param jmix input data to play
 * @return success or not
 */
ModulePlayer.prototype.play = function (jmix) {
  this._playing = false;
  this._data = jmix;
  this._order = 0;
  this._division = 0;
  this._samplePerDivision = this._sampleRate * 60.0 / jmix.bpm / 4.0;
  this._samples = 0;
  this._playing = true;
  this._channels = [];
  var i;
  for (i = 0; i < 4; ++i) {
    this._channels[i] =
        new ModulePlayer.Channel(jmix.samples, this._sampleRate);
  }
};

/**
 * Channel prototype
 *
 * This prototype implements inner class to handle a sampling channel.
 * @constructor
 * @param samples sampling data array
 * @param rate sampling rate
 */
ModulePlayer.Channel = function (samples, rate) {
  this._samples = samples;
  this._sampleRate = rate;
  this._sample = null;
  this._offset = 0;
  this._end = 0;
  this._step = 0.0;
  this._volume = 0;
  this._playing = false;
};

/**
 * Note On.
 * @param sample sampling data number
 * @param period playback period
 */
ModulePlayer.Channel.prototype.on = function (sample, period) {
  this._sample = this._samples[sample];
  this._offset = 2;
  this._end = this._sample.data.length;
  this._playing = true;
  this._rate = 7093789.2 / period / 2.0;
  this._step = 0.0;
  this._volume = this._sample.volume;
};

ModulePlayer.Channel.prototype.generate = function () {
  if (!this._playing)
    return 0;
  var data = this._sample.data[this._offset];
  this._step += this._rate;
  if (this._step >= this._sampleRate) {
    this._step -= this._sampleRate;
    this._offset++;
    if (this._offset == this._end) {
      if (!this._sample.repeat || this._sample.repeat.length <= 2) {
        this._playing = false;
        this._offset--;
      } else {
        this._offset = this._sample.repeat.point;
        this._end = this._offset + this._sample.repeat.length;
      }
    }
    var rate = this._step / this._sampleRate;
    return (data * (1.0 - rate) +
            this._sample.data[this._offset] * rate) * this._volume;
  }
  return data * this._volume;
};
