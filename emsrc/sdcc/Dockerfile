FROM apiaryio/emcc
RUN apt-get update
RUN apt-get install -y bison flex bzip2 g++ texinfo sdcc
COPY boost* /tmp
RUN mkdir /boost
WORKDIR /boost
RUN tar xvjf /tmp/boost*
WORKDIR /boost/boost_1_63_0/
RUN emconfigure ./bootstrap.sh
RUN emmake ./b2 install --prefix=/emscripten/system --with-graph link=static variant=release threading=single runtime-link=static
RUN apt-get install -y zlib1g-dev
WORKDIR /src
