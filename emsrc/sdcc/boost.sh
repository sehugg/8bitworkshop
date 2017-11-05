#!/bin/sh
rm -fr /tmp/boost
mkdir /tmp/boost
cd /tmp/boost
tar xjf ~/PuzzlingPlans/8bitworkshop/emsrc/sdcc/boost*.bz2
cd boost_1_63_0
emconfigure ./bootstrap.sh
emmake ./b2 install --prefix=$EMSCRIPTEN/system --with-graph link=static variant=release threading=single runtime-link=static
