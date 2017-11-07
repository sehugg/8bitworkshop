
rm -fr /tmp/sdcc
mkdir /tmp/sdcc
git archive --format tar HEAD |tar x -C /tmp/sdcc
pushd /tmp/sdcc/sdcc

#echo Configuring sdbinutils...
#cd support/sdbinutils
#./configure
#make
#cd ../..

echo Configuring SDCC...
emconfigure ./configure \
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
emmake make

echo Making Emscripten files...
popd
mkdir -p ./js ./wasm
cp /tmp/sdcc/sdcc/bin/sdcc js/sdcc.bc
cp /tmp/sdcc/sdcc/bin/sdasz80 js/sdasz80.bc
cp /tmp/sdcc/sdcc/bin/sdldz80 js/sdldz80.bc
make -f Makefile.local
