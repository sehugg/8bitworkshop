#!/bin/sh

cat \
head.js \
../Log.js \
../tss/AudioLooper.js \
../tss/BiquadFilterChannel.js \
../tss/Format.js \
../tss/FrequencyConversionChannel.js \
../tss/MasterChannel.js \
../tss/MidiChannel.js \
../tss/PsgDeviceChannel.js \
../tss/SimpleMidiChannel.js \
../tss/SimpleSlaveChannel.js \
../tss/SmfPlayer.js \
../tss/TimerMasterChannel.js \
../tss/TssChannel.js \
../tss/TsdPlayer.js \
../tss/TssCompiler.js \
../tss/TString.js \
../tss/VgmPlayer.js \
../tss/WebMidiChannel.js \
../tss/WebMidiLinkMidiChannel.js \
../tss/WhiteNoiseChannel.js \
tail.js \
| tee tss.js \
| ../../bower_components/uglify-js/bin/uglifyjs -nc -o tss.min.js
