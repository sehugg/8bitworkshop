Chiptune Sound Library - T'SoundSystem
======================================

What is this?
-------------

T'SoundSystem is a simple chiptune sound library.
It consists of three parts, platform dependent audio stream libraries,
chiptune device emulation libraries and music format playback libraries.
Early version was written in C++, but now I'm rewriting everything in various languages including Java,
JavaScript and C++. JavaScript version is mainly developed for now.
It covers from embedded devices like an Android phone to web browsers supporting Audio Data API,
or Web Audio API like latest Chrome, Firefox and Safari.

Status
------

### Supported environment
- Android (API Level 3 or later) / Java
- J2SE (Java Sound API) / Java
- Web Audio API / JavaScript
- Audio Data API (Firefox) / JavaScript - will be deprecated soon
- (POSIX / C++) - just a plan

### Emulated devices

| Device                  | Java | JavaScript | C++ |
|-------------------------|------|------------|-----|
| AY-3-8910 (PSG)         |  OK  |     OK     |  -  |
| YM2149 (PSG)            |  OK  |     OK     |  -  |
| SN76489 (PSG)           |  OK  |     OK     |  -  |
| pAPU                    |   -  |      -     |  -  |
| SCC                     |   -  |     OK     |  -  |
| YM2413 (OPLL)           |   -  |      -     |  -  |
| YM2203 (OPN)            |   -  |      -     |  -  |
| YM2608 (OPNA)           |   -  |      -     |  -  |
| YM2151 (OPM)            |   -  |      -     |  -  |
| ES5505 (PCM - Taito F3) |   -  |     OK     |  -  |
| TSS                     |   -  |     OK     |  -  |
| SoundFont 2             |   -  |      -     |  -  |
| MOD                     |   -  |     OK     |  -  |

### playable format

| Format | Java | JavaScript | ActionScript | C++ |
|--------|------|------------|--------------|-----|
| VGM    |  OK  |     OK     |       -      |  -  |
| AY     |   -  |      -     |       -      |  -  |
| SND    |   -  |      -     |       -      |  -  |
| GBS    |   -  |      -     |       -      |  -  |
| KSS    |   -  |      -     |       -      |  -  |
| S98    |   -  |     OK     |       -      |  -  |
| TSD    |   -  |     OK     |       -      |  -  |
| TSS    |   -  |     OK     |       -      |  -  |
| SMF    |   -  |     OK     |       -      |  -  |
| MOD    |   -  |     OK     |       -      |  -  |

### misc features

| Features                        | Java | JavaScript | ActionScript | C++ |
|---------------------------------|------|------------|--------------|-----|
| LSFR seudo noise generator      |   -  |     OK     |       -      |  -  |
| Biquad digital filter/equalizer |   -  |     OK     |       -      |  -  |
| Upsampling                      |   -  |     OK     |       -      |  -  |
| WebMidiLink                     |   -  |     OK     |       -      |  -  |

Manual
------

[MML Manul](https://github.com/toyoshim/tss/wiki/MML-Manual) is available in English, but it is not completed.
[Here](http://www.toyoshima-house.net/tss/) is very old document written in Japanese for ealier C++ version that may help.

Import as a Polymer component
-----------------------------
```
<script src="../bower_components/platform/platform.js"></script>
<script src="../bower_components/polymer/polymer.js"></script>
<link ref="import" href="../bower_components/tss/js/polymer/tss.html">
<tss></tss>
<script>
window.addEventListener('WebComponentsReady', function () {
  var tss = document.getElementsByTagName('tss')[0];
  tss.createAudioLooper(); // or new tss.AudioLooper()
  ...
});
</script>
```
