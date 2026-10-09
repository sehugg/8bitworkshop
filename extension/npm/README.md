# 8bitworkshop command line

`8bws` builds and runs retro-computer and arcade programs without a browser:
NES, Atari, Commodore 64, ColecoVision, Game Boy, Apple II, ZX Spectrum, and
many more, with the same compilers, assemblers and emulators as
[8bitworkshop.com](https://8bitworkshop.com).

```sh
npx {{package}} build --check hello.c        # compile only
npx {{package}} build hello.c -o hello.nes   # platform is detected
npx {{package}} run hello.c --frames 60 --png screen.png
npx {{package}} help                          # every command and option
```

Add `--json` for machine-readable output. Requires Node 20 or later.

## Toolchains

The package holds only the command line. The first build downloads the
compilers it needs (about 13MB for most platforms, more for Verilog and a few
rarely used tools), checks their SHA-256 hashes, and unpacks them into your
cache directory:

| OS | Cache directory |
| --- | --- |
| macOS | `~/Library/Caches/8bitworkshop` |
| Linux | `$XDG_CACHE_HOME/8bitworkshop`, or `~/.cache/8bitworkshop` |
| Windows | `%LOCALAPPDATA%\8bitworkshop\Cache` |

- `EIGHTBITWORKSHOP_TOOLCHAINS` sets the cache directory.
- `EIGHTBITWORKSHOP_ASSETS` names a directory or URL to fetch the packs from
  first, for mirrors and offline use.
- `EIGHTBITWORKSHOP_ROOT` points at a full 8bitworkshop checkout and skips
  downloading.

## License

GPL-3.0-only. The downloaded toolchains keep their own licenses; see
`THIRD-PARTY-NOTICES.md`.
