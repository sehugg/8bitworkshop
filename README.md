[![Build Status](https://travis-ci.org/sehugg/8bitworkshop.svg?branch=master)](https://travis-ci.org/sehugg/8bitworkshop)

The latest release is online at http://8bitworkshop.com/

## Install

To build the 8bitworkshop IDE:

```sh
git submodule init
git submodule update
npm i
npm run build
```

## Usage

Start a web server on http://localhost:8000/ while TypeScript compiles in the background:

```sh
make tsweb
```

## Run Tests

```sh
npm test
```

## License

Copyright © 2019 [Steven Hugg](https://github.com/sehugg).

This project is [GPL-3.0](https://github.com/sehugg/8bitworkshop/blob/master/LICENSE) licensed.

Dependencies retain their original licenses.

All included code samples (all files under the presets/ directory) are licensed under
[CC0](https://creativecommons.org/publicdomain/zero/1.0/)
unless otherwise licensed.
