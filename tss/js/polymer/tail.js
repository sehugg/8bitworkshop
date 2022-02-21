    this.AudioLooper = AudioLooper;
    this.BiquadFilterChannel = BiquadFilterChannel;
    this.Format = Format;
    this.FrequencyConversionChannel = FrequencyConversionChannel;
    this.MasterChannel = MasterChannel;
    this.MidiChannel = MidiChannel;
    this.PsgDeviceChannel = PsgDeviceChannel;
    this.SimpleMidiChannel = SimpleMidiChannel;
    this.SimpleSlaveChannel = SimpleSlaveChannel;
    this.SmfPlayer = SmfPlayer;
    this.TimerMasterChannel = TimerMasterChannel;
    this.TssChannel = TssChannel;
    this.TsdPlayer = TsdPlayer;
    this.TssCompiler = TssCompiler;
    this.TString = TString;
    this.VgmPlayer = VgmPlayer;
    this.WebMidiChannel = WebMidiChannel;
    this.WebMidiLinkMidiChannel = WebMidiLinkMidiChannel;
    this.WhiteNoiseChannel = WhiteNoiseChannel;
    this.createAudioLooper = function (bufferSize) {
      return new AudioLooper(bufferSize);
    };
    this.createBiquadFilterChannel = function () {
      return new BiquadFilterChannel();
    };
    this.createFrequencyConversionChannel = function () {
      return new FrequencyConversionChannel();
    };
    this.createMasterChannel = function () {
      return new MasterChannel();
    };
    this.createMidiChannel = function () {
      return new MidiChannel();
    };
    this.createPsgDeviceChannel = function () {
      return new PsgDeviceChannel();
    };
    this.createSimpleMidiChannel = function () {
      return new SimpleMidiChannel();
    };
    this.createSimpleSlaveChannel = function (frequency) {
      return new SimpleSlaveChannel(frequency);
    };
    this.createSmfPlayer = function () {
      return new SmfPlayer();
    };
    this.createTimerMasterChannel = function (mode) {
      return new TimerMasterChannel(mode);
    };
    this.createTssChannel = function () {
      return new TssChannel();
    };
    this.createTString = function () {
      return new TString();
    };
    this.createVgmPlayer = function () {
      return new VgmPlayer();
    };
    this.createWebMidiChannel = function (port) {
      return new WebMidiChannel(port);
    };
    this.createWebMidiLinkMidiChannel = function () {
      return new WebMidiLinkMidiChannel(port);
    };
    this.createWhiteNoiseChannel = function () {
      return new WhiteNoiseChannel();
    };
  }
});
