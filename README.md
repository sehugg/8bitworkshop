# 8bitworkshop

![Build Status](https://github.com/sehugg/8bitworkshop/actions/workflows/node.js.yml/badge.svg)


## Use Online

Latest release:
- https://8bitworkshop.com/latest/ or
- https://sehugg.github.io/8bitworkshop/

## Install Locally

To clone just the main branch:

```sh
git clone -b master --single-branch git@github.com:sehugg/8bitworkshop.git
```

To build the 8bitworkshop IDE:

```sh
git submodule init
git submodule update
npm i
npm run build
npm run esbuild
```

To use GitHub integration locally, download the Firebase config file, e.g. https://8bitworkshop.com/v[version]/config.js

### Start Local Web Server

Start a web server on http://localhost:8000/ while TypeScript compiles in the background:

```sh
make tsweb
```

### Run Tests

```sh
# To avoid "API rate limited exceeded" errors, set `TEST8BIT_GITHUB_TOKEN`,
# see: htps://github.com > Settings > Developer settings > Personal access tokens
export TEST8BIT_GITHUB_TOKEN="<github_personal_access_token>"

npm test
```

## License

Copyright © 2016-2024 [Steven E. Hugg](https://github.com/sehugg).


This project, unless specifically noted, is multi-licensed.
You may choose to adhere to the terms of either the [GPL-3.0](https://github.com/sehugg/8bitworkshop/blob/master/LICENSE) License for the entire project or respect the individual licenses of its dependencies and included code samples, as applicable.

This project includes various dependencies, modules, and components that retain their original licenses. 
For detailed licensing information for each dependency, please refer to the respective files and documentation.

All included code samples located in the presets/ directory are licensed under
[CC0](https://creativecommons.org/publicdomain/zero/1.0/)
unless a different license is explicitly stated within the specific code sample.


## Dependencies

### Emulators

* https://javatari.org/
* https://jsnes.org/
* https://www.mamedev.org/
* https://github.com/floooh/chips
* https://github.com/DrGoldfire/Z80.js
* http://www.twitchasylum.com/jsvecx/
* https://github.com/curiousdannii/ifvms.js/
* https://6502ts.github.io/typedoc/stellerator-embedded/
* https://github.com/yhzmr442/jspce

### Compilers

* https://cc65.github.io/
* http://sdcc.sourceforge.net/
* http://perso.b2b2c.ca/~sarrazip/dev/cmoc.html
* https://github.com/batari-Basic/batari-Basic
* https://www.veripool.org/wiki/verilator
* http://mcpp.sourceforge.net/
* http://www.ifarchive.org/indexes/if-archiveXinfocomXcompilersXinform6.html
* https://github.com/dmsc/fastbasic
* https://github.com/wiz-lang/wiz
* https://github.com/sylefeb/Silice
* https://github.com/steux/cc7800
* https://bellard.org/tcc/

### Assemblers/Linkers

* https://dasm-assembler.github.io/
* http://atjs.mbnet.fi/mc6809/Assembler/xasm-990104.tar.gz
* http://48k.ca/zmac.html
* https://github.com/apple2accumulator/merlin32
* https://github.com/camsaul/nesasm

### Dev Kits / Libraries

* https://shiru.untergrund.net/code.shtml
* http://www.colecovision.eu/ColecoVision/development/libcv.shtml
* https://github.com/toyoshim/tss
* https://github.com/lronaldo/cpctelera

### Firmware

* http://www.virtualdub.org/altirra.html
* https://github.com/MEGA65/open-roms
* https://sourceforge.net/projects/cbios/
* https://www.pledgebank.com/opense

### Related Projects

* https://github.com/sehugg/8bitworkshop-compilers
* https://github.com/sehugg/8bit-tools
* https://github.com/sehugg/awesome-8bitgamedev
* https://github.com/sehugg?tab=repositories


## Tool Server (experimental)

This is an experimental feature that relies on a Docker container to provide compiler tools like [llvm-mos](https://github.com/llvm-mos/llvm-mos-sdk).
Right now, you have to run locally and build your own docker container.

```sh
docker build -t 8bitws-server-debian scripts/docker
docker run -p 3009:3009 8bitws-server-debian
echo '{"REMOTE_URL":"http://localhost:3009/build"}' > remote.json
```

Then add "&tool=llvm-mos" to your URL, like
[this](http://localhost:8000/?platform=c64&file=sprite_collision.c&tool=llvm-mos).
You can also rename your C files to have the suffix "-llvm.c".
Right now only the platforms c64, atari8, nes (NROM), and pce are supported.
Not very many of the current examples work with the new toolchain.
