
import { SampledAudioSink } from "./devices";

// from TSS
declare var MasterChannel, AudioLooper, PsgDeviceChannel;

export class MasterAudio {
  master = new MasterChannel();
  looper;
  start() {
    if (!this.looper) {
      this.looper = new AudioLooper(512);
      this.looper.setChannel(this.master);
      this.looper.activate();
    }
  }
  stop() {
    if (this.looper) {
      this.looper.setChannel(null);
      this.looper = null;
    }
  }
}

export class AY38910_Audio {
  master : MasterAudio;
  psg = new PsgDeviceChannel();
  curreg = 0;

  constructor(master : MasterAudio) {
    this.master = master;
    this.psg.setMode(PsgDeviceChannel.MODE_SIGNED);
    this.psg.setDevice(PsgDeviceChannel.DEVICE_AY_3_8910);
    master.master.addChannel(this.psg);
  }

  reset() {
    for (var i=15; i>=0; i--) {
      this.selectRegister(i);
      this.setData(0);
    }
  }
  selectRegister(val : number) {
    this.curreg = val & 0xf;
  }
  setData(val : number) {
    this.psg.writeRegisterAY(this.curreg, val & 0xff);
  }
  readData() {
    return this.psg.readRegister(this.curreg);
  }
  currentRegister() { return this.curreg; }
}

export class SN76489_Audio {
  master : MasterAudio;
  psg = new PsgDeviceChannel();

  constructor(master : MasterAudio) {
    this.master = master;
    this.psg.setMode(PsgDeviceChannel.MODE_SIGNED);
    this.psg.setDevice(PsgDeviceChannel.DEVICE_SN76489);
    master.master.addChannel(this.psg);
  }
  reset() {
    // TODO
  }
  setData(val : number) {
    this.psg.writeRegisterSN(0, val & 0xff);
  }
}

// https://en.wikipedia.org/wiki/POKEY
// https://user.xmission.com/~trevin/atari/pokey_regs.html
// http://krap.pl/mirrorz/atari/homepage.ntlworld.com/kryten_droid/Atari/800XL/atari_hw/pokey.htm

export function newPOKEYAudio(count:number) {
  var audio = new MasterAudio();
  for (var i=1; i<=count; i++) {
    var pokey = new POKEYDeviceChannel();
    audio['pokey'+i] = pokey; // TODO: cheezy
    audio.master.addChannel(pokey);
  }
  return audio;
}

function combinePolys(a, b) {
  var arr = new Uint8Array(a.length * b.length);
  var n = 0;
  for (var i=0; i<arr.length; i++) {
    arr[i] = b[n % b.length];
    if (a[i % a.length]) n++;
  }
  return arr;
}

function divideBy(n) {
  var arr = new Uint8Array(n*2);
  arr.fill(1, 0, n);
  return arr;
}

export var POKEYDeviceChannel = function() {

  /* definitions for AUDCx (D201, D203, D205, D207) */
  var NOTPOLY5    = 0x80     /* selects POLY5 or direct CLOCK */
  var POLY4       = 0x40     /* selects POLY4 or POLY17 */
  var PURE        = 0x20     /* selects POLY4/17 or PURE tone */
  var VOL_ONLY    = 0x10     /* selects VOLUME OUTPUT ONLY */
  var VOLUME_MASK = 0x0f     /* volume mask */

  /* definitions for AUDCTL (D208) */
  var POLY9       = 0x80     /* selects POLY9 or POLY17 */
  var CH1_179     = 0x40     /* selects 1.78979 MHz for Ch 1 */
  var CH3_179     = 0x20     /* selects 1.78979 MHz for Ch 3 */
  var CH1_CH2     = 0x10     /* clocks channel 1 w/channel 2 */
  var CH3_CH4     = 0x08     /* clocks channel 3 w/channel 4 */
  var CH1_FILTER  = 0x04     /* selects channel 1 high pass filter */
  var CH2_FILTER  = 0x02     /* selects channel 2 high pass filter */
  var CLOCK_15    = 0x01     /* selects 15.6999kHz or 63.9210kHz */

  /* for accuracy, the 64kHz and 15kHz clocks are exact divisions of
     the 1.79MHz clock */
  var DIV_64      = 28       /* divisor for 1.79MHz clock to 64 kHz */
  var DIV_15      = 114      /* divisor for 1.79MHz clock to 15 kHz */

  /* the size (in entries) of the 4 polynomial tables */
  var POLY4_SIZE  = 0x000f
  var POLY5_SIZE  = 0x001f
  var POLY9_SIZE  = 0x01ff

  var POLY17_SIZE = 0x0001ffff    /* else use the full 17 bits */

  /* channel/chip definitions */
  var CHAN1       = 0
  var CHAN2       = 1
  var CHAN3       = 2
  var CHAN4       = 3
  var CHIP1       = 0
  var CHIP2       = 4
  var CHIP3       = 8
  var CHIP4       = 12
  var SAMPLE      = 127

  var FREQ_17_EXACT     = 1789790.0  /* exact 1.79 MHz clock freq */
  var FREQ_17_APPROX    = 1787520.0  /* approximate 1.79 MHz clock freq */

  // LFSR sequences
  var bit1 = new Uint8Array( [ 1 ] );
  var bit2 = new Uint8Array( [ 0,1 ] ); // TODO?
  var bit4 = new Uint8Array( [ 1,1,0,1,1,1,0,0,0,0,1,0,1,0,0 ] );
  var bit5 = new Uint8Array( [ 0,0,1,1,0,0,0,1,1,1,1,0,0,1,0,1,0,1,1,0,1,1,1,0,1,0,0,0,0,0,1 ] );
  var bit9 = new Uint8Array( [ 0,0,1,0,1,0,0,0,1,0,0,0,0,0,0,0,1,0,1,1,1,0,0,1,0,1,0,0,1,1,1,1,1,0,0,1,1,0,1,1,0,1,0,1,1,1,0,1,1,0,0,1,0,0,1,1,1,1,0,1,0,0,0,0,1,1,0,1,1,0,0,0,1,0,0,0,1,1,1,1,0,1,0,1,1,0,1,0,1,0,0,0,0,1,1,0,1,0,1,0,0,0,1,0,1,0,0,0,1,1,1,0,0,1,1,0,1,1,0,0,1,1,1,1,1,0,0,1,1,0,0,0,1,1,0,1,0,0,0,1,1,0,0,1,1,1,1,0,0,1,0,0,0,1,1,1,0,0,1,1,0,1,0,1,1,0,1,1,0,1,0,0,1,0,0,1,1,1,1,1,1,0,1,1,1,1,0,1,1,0,0,0,0,1,1,1,1,1,0,0,0,1,0,0,0,0,1,0,0,0,1,0,1,0,1,1,0,0,0,0,1,0,1,1,1,1,0,1,0,0,0,1,1,0,0,0,1,1,1,0,1,1,1,0,1,0,0,0,0,0,0,0,0,1,0,1,0,0,1,0,0,0,0,1,1,1,0,0,0,1,1,1,0,0,1,1,0,0,1,0,0,1,0,1,1,0,0,0,0,1,0,0,0,1,0,0,0,1,0,1,1,1,1,0,0,0,1,1,1,0,0,0,1,0,0,1,1,1,1,0,1,1,1,1,1,1,1,0,1,1,1,1,1,1,0,1,1,0,1,0,1,1,1,1,0,0,1,0,1,0,1,1,1,0,0,0,0,0,1,1,0,1,1,0,0,0,1,0,1,0,1,0,0,0,0,1,0,1,1,1,0,0,0,0,1,0,0,1,0,1,0,0,0,1,0,1,1,1,0,0,1,1,1,1,1,1,1,0,0,0,0,0,1,0,0,1,1,0,1,0,0,1,0,0,0,1,0,0,1,0,1,0,0,0,1,1,0,1,0,0,0,0,0,1,1,1,1,0,0,1,0,0,1,0,1,1,1,1,1,1,1,0,1,0,0,1,0,0,0,1,1,0,1,1,1,0,0,0,1,0,1,0,0,1,0,1,0,1,0,1,1,1,0,0,1,0,1,1,0,0,1,1,1,1,1,0,0,0,1,1,0 ] );
  var bit15 = new Uint8Array( [1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1,0,0,0,0,0,0,0,0,0,0,0,0] );
  var bit31 = new Uint8Array( [1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,0,0,0,0,0,0,0,0,0,0,0,0,0] );
  var bit17 = new Uint8Array(1<<14);
  for (var i=0; i<bit17.length; i++) {
    bit17[i] = Math.random() > 0.5 ? 1 : 0;
  }
  var bit17_5 = combinePolys(bit17, bit5);
  var bit5_4 = combinePolys(bit5, bit4);
  var wavetones = [
    bit17_5, bit5, bit5_4, bit5,
    bit17, bit2, bit4, bit2
  ];
  // TIA
  var div2 = divideBy(2);
  var div6 = divideBy(6);
  var div31 = divideBy(31);
  var div93 = divideBy(93);
  var bit15_4 = combinePolys(bit15, bit4);
  var bit5_2 = combinePolys(bit5, div2);
  var bit5_6 = combinePolys(bit5, div6);
  var tiawavetones = [
    bit1, bit4, bit15_4, bit5_4,
    div2, div2, div31, bit5_2,
    bit9, bit5, div31, bit1,
    div6, div6, div93, bit5_6
  ];
  
  // registers
  var regs = new Uint8Array(16);
  var counters = new Float32Array(4);
  var deltas = new Float32Array(4);
  var volume = new Float32Array(4);
  var audc = new Uint8Array(4);
  var waveforms = [bit1, bit1, bit1, bit1];
  var buffer;
  var sampleRate;
  var clock, baseDelta;
  var dirty = true;

  //

  this.setBufferLength = function (length) {
    buffer = new Int32Array(length);
  };

  this.getBuffer = function () {
    return buffer;
  };

  this.setSampleRate = function (rate) {
    sampleRate = rate;
    baseDelta = FREQ_17_EXACT / rate / 1.2; // TODO?
  };

  function updateValues(addr) {
    var ctrl = regs[8];
    var base = (ctrl & CLOCK_15) ? DIV_15 : DIV_64;
    var div;
    var i = addr & 4;
    var j = i>>1;
    var k = i>>2;
    if (ctrl & (CH1_CH2>>k)) {
      if (ctrl & (CH1_179>>k))
         div = regs[i+2] * 256 + regs[i+0] + 7;
      else
         div = (regs[i+2] * 256 + regs[i+0] + 1) * base;
      deltas[j+1] = baseDelta / div;
      deltas[j+0] = 0;
    } else {
      if (ctrl & (CH1_179>>k)) {
        div = regs[i+0] + 4;
      } else {
        div = (regs[i+0] + 1) * base;
      }
      deltas[j+0] = baseDelta / div;
      div = (regs[i+2] + 1) * base;
      deltas[j+1] = baseDelta / div;
    }
    //console.log(addr, ctrl.toString(16), div, deltas[j+0], deltas[j+1]);
  }

  this.setRegister = function(addr, value) {
    addr &= 0xf;
    value &= 0xff;
    if (regs[addr] != value) {
      regs[addr] = value;
      switch (addr) {
        case 0:
        case 2:
        case 4:
        case 6: // AUDF
        case 8: // ctrl
          dirty = true;
          break;
        case 1:
        case 3:
        case 5:
        case 7: // AUDC
          volume[addr>>1] = value & 0xf;
          waveforms[addr>>1] = wavetones[value>>5];
          break;
      }
    }
  }
  
  this.setTIARegister = function(addr, value) {
    switch (addr) {
      case 0x17:
      case 0x18:
        regs[(addr&1)*4] = value & 0x1f;
        dirty = true;
        break;
      case 0x15:
      case 0x16:
        waveforms[(addr&1)*2] = tiawavetones[value & 0xf];
        break;
      case 0x19:
      case 0x1a:
        volume[(addr&1)*2] = value & 0xf;
        break;
    }
  }

  this.generate = function (length) {
    if (dirty) {
      updateValues(0);
      updateValues(4);
      dirty = false;
    }
    for (var s=0; s<length; s+=2) {
      var sample = 0;
      for (var i=0; i<4; i++) {
        var d = deltas[i];
        var v = volume[i];
        if (d > 0 && d < 1 && v > 0) {
          var wav = waveforms[i];
          var cnt = counters[i] += d;
          if (cnt > wav.length) {
            cnt = counters[i] = cnt - Math.floor(cnt / wav.length) * wav.length;
          }
          var on = wav[Math.floor(cnt)];
          if (on) {
            sample += v;
          }
        }
      }
      sample *= 64;
      buffer[s] = sample;
      buffer[s+1] = sample;
    }
  }
}

////// Worker sound

export var WorkerSoundChannel = function(worker) {
  var sampleRate;
  var output;
  var pending = [];
  var pendingLength = 0;

  worker.onmessage = function(e) {
    if (e && e.data && e.data.samples && output) {
      pending.push(e.data.samples);
      pendingLength += e.data.samples.length;
    }
  };

  this.setBufferLength = function (length) {
    output = new Int16Array(length);
    //worker.postMessage({bufferLength:length,numChannels:2});
    pendingLength = 0;
  };

  this.getBuffer = function () {
    return output;
  };

  this.setSampleRate = function (rate) {
    sampleRate = rate;
    worker.postMessage({sampleRate:rate});
  };

  this.generate = function (length) {
    if (pendingLength < length*3) {
      //console.log(length, pendingLength);
      output.fill(0);
      return; // TODO: send sync msg?
    }
    for (var i=0; i<output.length;) {
      if (pending.length == 0) break; // TODO?
      var buf = pending.shift();
      pendingLength -= buf.length;
      var l = output.length-i;
      if (buf.length < l) {
        output.set(buf, i);
      } else {
        output.set(buf.slice(0, l), i);
        pending.unshift(buf.slice(l));
        pendingLength += buf.length-l;
      }
      i += buf.length;
    }
  }

}

// SampleAudio

export var SampleAudio = function(clockfreq) {
  var self = this;
  var sfrac, sinc, accum;
  var buffer, bufpos, bufferlist;
  var idrain, ifill;
  var nbuffers = 4;

  function mix(ape) {
    var buflen=ape.outputBuffer.length;
    var lbuf = ape.outputBuffer.getChannelData(0);
    var m = this.module;
    if (!m) m = ape.srcElement.module;
    if (!m) return;
    if (m.callback) {
      m.callback(lbuf);
      return;
    } else {
      var buf = bufferlist[idrain];
      for (var i=0; i<lbuf.length; i++) {
        lbuf[i] = buf[i];
        //lbuf[i] = (i&128) ? 1.0 : 0.33;
      }
      idrain = (idrain + 1) % bufferlist.length;
    }
  }
  
  function clearBuffers() {
    if (bufferlist)
      for (var buf of bufferlist)
        buf.fill(0);
  }

  function createContext() {
    var AudioContext = window['AudioContext'] || window['webkitAudioContext'] || window['mozAudioContext'];
    if (! AudioContext) {
      console.log("no web audio context");
      return;
    }
    var ctx : AudioContext = new AudioContext();
    self.context = ctx;
    self.sr=self.context.sampleRate;
    self.bufferlen=2048;

    // remove DC bias
    self.filterNode=self.context.createBiquadFilter();
    self.filterNode.type='lowshelf';
    self.filterNode.frequency.value=100;
    self.filterNode.gain.value=-6;

    // mixer
    if ( typeof self.context.createScriptProcessor === 'function') {
      self.mixerNode=self.context.createScriptProcessor(self.bufferlen, 1, 1);
    } else {
      self.mixerNode=self.context.createJavaScriptNode(self.bufferlen, 1, 1);
    }

    self.mixerNode.module=self;
    self.mixerNode.onaudioprocess=mix;

    // compressor for a bit of volume boost, helps with multich tunes
    self.compressorNode=self.context.createDynamicsCompressor();

    // patch up some cables :)
    self.mixerNode.connect(self.filterNode);
    self.filterNode.connect(self.compressorNode);
    self.compressorNode.connect(self.context.destination);
  }

  this.start = function() {
    if (this.context) {
      // Chrome autoplay (https://goo.gl/7K7WLu)
      if (this.context.state == 'suspended') {
        this.context.resume();
      }
      return;   // already created
    }
    createContext();		// create it
    if (!this.context) return;  // not created?
    sinc = this.sr * 1.0 / clockfreq;
    sfrac = 0;
    accum = 0;
    bufpos = 0;
    bufferlist = [];
    idrain = 1;
    ifill = 0;
    for (var i=0; i<nbuffers; i++) {
      var arrbuf = new ArrayBuffer(self.bufferlen*4);
      bufferlist[i] = new Float32Array(arrbuf);
    }
    buffer = bufferlist[0];
  }
  
  this.stop = function() {
    this.context && this.context.suspend && this.context.suspend();
    clearBuffers(); // just in case it doesn't stop immediately
  }

  this.close = function() {
    if (this.context) {
      this.context.close();
      this.context = null;
    }
  }

  this.addSingleSample = function(value) {
    if (!buffer) return;
    buffer[bufpos++] = value;
    if (bufpos >= buffer.length) {
      bufpos = 0;
      bufferlist[ifill] = buffer;
      var inext = (ifill + 1) % bufferlist.length;
      if (inext == idrain) {
        ifill = Math.floor(idrain + nbuffers/2) % bufferlist.length;
        //console.log('SampleAudio: skipped buffer', idrain, ifill); // TODO
      } else {
        ifill = inext;
      }
      buffer = bufferlist[ifill];
    }
  }

  this.feedSample = function(value, count) {
    accum += value * count;
    sfrac += sinc * count;
    if (sfrac >= 1) {
      accum /= sfrac;
      while (sfrac >= 1) {
        this.addSingleSample(accum * sinc);
        sfrac -= 1;
      }
      accum *= sfrac;
    }
  }
  
}


export class SampledAudio {
  sa;
  constructor(sampleRate : number) {
    this.sa = new SampleAudio(sampleRate);
  }
  feedSample(value:number, count:number) {
    this.sa.feedSample(value, count);
  }
  start() {
    this.sa.start();
  }
  stop() {
    this.sa.stop();
  }
}

interface TssChannel {
  setBufferLength(len : number) : void;
  setSampleRate(rate : number) : void;
  getBuffer() : number[];
  generate(numSamples : number) : void;
}

export class TssChannelAdapter {
  channels : TssChannel[];
  audioGain = 1.0 / 8192;
  bufferLength : number;

  constructor(chans, oversample:number, sampleRate:number) {
    this.bufferLength = oversample * 2;
    this.channels = chans.generate ? [chans] : chans; // array or single channel
    this.channels.forEach((c) => {
      c.setBufferLength(this.bufferLength);
      c.setSampleRate(sampleRate);
    });
  }

  generate(sink:SampledAudioSink) {
    var l = this.bufferLength;
    var bufs = this.channels.map((ch) => ch.getBuffer());
    this.channels.forEach((ch) => {
      ch.generate(l);
    });
    for (let i=0; i<l; i+=2) {
      var total = 0;
      bufs.forEach((buf) => total += buf[i]);
      sink.feedSample(total * this.audioGain, 1);
    };
  }
}

