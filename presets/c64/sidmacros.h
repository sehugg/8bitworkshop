
// SID voices are v1, v2, v3

// wave options flags
#define SID_GATE 0x01
#define SID_SYNC 0x02
#define SID_RINGMOD 0x04
#define SID_TESTBIT 0x08
#define SID_TRIANGLE 0x10
#define SID_SAWTOOTH 0x20
#define SID_SQUARE 0x40
#define SID_NOISE 0x80

// Init SID global volume
// volume: 0-15
// filters: bitmask
#define SID_INIT(volume, filters) \
   SID.amp = (volume) | ((filters)<<4);

// stop voice
#define SID_STOP(voice, options) \
  SID.voice.ctrl = options & ~SID_GATE;

// start voice
#define SID_START(voice, options) \
  SID.voice.ctrl = options | SID_GATE;

// set ADSR envelope
#define SID_ADSR(voice,attack,decay,sustain,release) \
  SID.voice.ad = ((decay)&15) | ((attack)<<4); \
  SID.voice.sr = ((release)&15) | ((sustain)<<4);

// set frequency (0 - 65535)
#define SID_FREQ(voice,_freq) \
  SID.voice.freq = (_freq);

// set pulse width (0 - 4095)
#define SID_PULSEWIDTH(voice,_pw) \
  SID.voice.pw = (_pw);

// play a quick square wave pulse
#define SID_PULSE_DECAY(voice, freq) \
  SID_STOP(voice,0) \
  SID_FREQ(voice,freq); \
  SID_PULSEWIDTH(voice,0x200); \
  SID_ADSR(voice,3,8,0,4); \
  SID_START(voice,SID_SQUARE); \

// play a tone if one is not already playing
#define SID_PLAY_TONE(freq) \
  if (!SID.read3) { SID_PULSE_DECAY(v3, (freq)) }
