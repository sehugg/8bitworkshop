#!/bin/bash

rm -fr /tmp/sdcc
mkdir /tmp/sdcc
git archive --format tar HEAD |tar xv -C /tmp/sdcc
cd /tmp/sdcc/sdcc

echo Configuring SDCC...
docker run --rm -v `pwd`:/src -e USERID=$UID -t sehugg/emcc emconfigure ./configure --host x86_64-unknown-linux-gnu --includedir /src \
	 --enable-z80-port \
  --disable-mcs51-port    \
  --disable-z180-port     \
  --disable-r2k-port      \
  --disable-r3ka-port     \
  --enable-gbz80-port    \
  --disable-tlcs90-port   \
  --disable-ds390-port    \
  --disable-ds400-port    \
  --disable-pic14-port    \
  --disable-pic16-port    \
  --disable-hc08-port     \
  --disable-s08-port      \
  --disable-stm8-port     \
  --disable-ucsim         \
  --disable-device-lib    \
  --disable-packihx       \
  --disable-sdcpp         \
  --disable-sdcdb         \
  --disable-sdbinutils    \
  --disable-non-free      \

echo Configuring sdbinutils...
cd support/sdbinutils
./configure
make
cd ../..

echo Making SDCC...
docker run --rm -v `pwd`:/src -e USERID=$UID -t sehugg/emcc emmake make

echo Making JS files...
mkdir -p ./js
cp /tmp/sdcc/sdcc/bin/sdcc js/sdcc.bc
cp /tmp/sdcc/sdcc/bin/sdasz80 js/sdasz80.bc
cp /tmp/sdcc/sdcc/bin/sdldz80 js/sdldz80.bc
make -f Makefile.emcc
