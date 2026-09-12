# Asset Header

An **asset header** is a tiny note to the [Asset Editor](asseteditor.md)
that tells it what a block of data means. It is just a JSON object inside
a comment, sitting right above the bytes:

```c
/*{w:8,h:8,bpp:1,count:2,brev:1}*/
const byte tiles[] = { ... };
```

From that short comment the editor knows the data is two 8×8, 1-bit
images, most significant bit on the left. You write the header by hand
once, and from then on the Asset Editor can draw and edit the data for
you.

## Header syntax

A header is a comment containing a single JSON object, immediately
followed by a data block. The block ends at the next closing delimiter,
which depends on the language:

| Language | Header | Data block ends at |
| --- | --- | --- |
| C / C++ | `/*{w:8,h:8}*/` | next `;` |
| Assembly | `;;{w:8,h:8};;` | next `;;` |
| Verilog | `/*{w:8,h:8}*/` | next `end` |

**Each number needs a radix prefix so the editor can read it.** It
recognizes `0xNN`, `$NN`, `#$NN`, `%0101`, `0b0101`, `8'hNN`, `8'b0101`,
and assembler `hex 1f20…` statements. It also remembers the notation you
used and writes edits back the same way, so a file of `$`-prefixed bytes
stays `$`-prefixed. The one thing it will *not* read is **plain
decimal** — a block of `{24,60,126,…}` parses as zero values and reports
*"Expected 8 value(s), found 0"*.

```c
/*{w:8,h:8,bpp:1,count:2,brev:1}*/
const byte tiles[] = {
  0xff,0x81,0x81,0x81,0x81,0x81,0x81,0xff,
  0x18,0x3c,0x7e,0xff,0xff,0x7e,0x3c,0x18,
};
```

```asm
;;{w:8,h:8,count:1,brev:1,flip:1};;
PlayerGfx:
        .byte $18,$3c,$7e,$ff,$ff,$7e,$3c,$18
;;
```

### Writing JSON loosely

You don't have to quote the keys. The scanner rewrites `([A-Za-z]+):` to
`"$1":` before parsing, so `w:8` and `"w":8` mean the same thing. String
*values* still need their quotes, though: `pal:"nes"`, `comp:"rletag"`.

### Things to watch out for

- **The first `;` wins.** In C the block ends at the very next semicolon,
  so the array declaration must be the only statement between the header
  and that `;`. Anything else and the editor reads the wrong data.
- Keys are case-sensitive and must be alphabetic.
- A malformed header is reported inline in the Asset Editor tab, rather
  than being silently ignored.

### Reading data from another file with `#embed`

If the data block contains an `#embed` directive, the bytes are read
from that file instead of from the source text:

```c
/*{w:24,h:21,bpp:1,brev:1,wpimg:64,count:1}*/
const char sprite[] = {
#embed "sprite.bin"
};
```

The path is resolved first exactly as written, then relative to the
directory of the file containing the header (`sub/main.c` + `data.bin` →
`sub/data.bin`). The file's byte length is validated against the format
the same way inline data is.

## Field reference

### Image fields

These describe a bitmap or character set. Only `w` and `h` are required —
everything else falls back to a sensible default.

| Field | Default | Description |
| --- | --- | --- |
| `w` | *required* | Width in pixels |
| `h` | *required* | Height in pixels |
| `count` | `1` | Number of images |
| `bpp` | `1` | Bits per pixel |
| `np` | `1` | Number of bitplanes (colors = 2<sup>bpp&times;np</sup>) |
| `bpw` | `8` | Bits per word (8, 16, 32) |
| `sl` | `ceil(w*bpp/bpw)` | Words per scanline (stride) |
| `wpimg` | `sl*h` | Words per image — use when hardware pads images |
| `pofs` | `sl*h*count` | Distance between bitplanes, in words |
| `skip` | `0` | Words to skip at the start of the whole block |
| `brev` | `false` | MSB is the leftmost pixel |
| `flip` | `false` | Data is stored bottom row first |
| `il` | `false` | Interleave images row by row |
| `remap` | — | Bit permutation applied to the word offset |
| `reindex` | — | Per-column word/bit table |
| `aspect` | `1` | Pixel aspect ratio for display only |
| `art` | `false` | Apple II HGR artifact-color mode |
| `comp` | — | `"rletag"` = RLE-compressed block |
| `map` | — | `"nesnt"` = NES nametable, not a bitmap |
| `pacstrip` | — | Pac-Man/Namco vertical-strip layout |
| `xform` | — | CSS transform. Parsed and stored but currently inert |

### Palette fields

Give a block a `pal` and no `w`/`h`, and it becomes a palette editor
instead of an image editor.

| Field | Default | Description |
| --- | --- | --- |
| `pal` | — | Palette decoding, see below |
| `n` | — | Advisory entry count — the real count comes from the data |
| `layout` | — | Grouped editor layout: `nes`, `astrocade`, `pacman` |

`pal` is either:

- **A number** like `332` or `444` — the three digits are channel bit
  widths, applied **from the low bits upward**. A positive value puts red
  lowest (`pal:332` = RGB332, red in bits 0–2); a **negative** value puts
  blue lowest (`pal:-332` = blue in bits 0–2, red in the top 2 bits).
  The picker's color space is `1 << (sum of digits)` entries, which is why
  `pal:444` is a 4096-color chooser regardless of how many entries the
  block holds.
- **A name**: `"nes"`, `"vcs"`, `"c64"`, `"gb"`, `"ap2lores"`,
  `"astrocade"`, or `"pacman"` (Namco color-PROM bytes, decoded with
  MAME's resistor weights). These are the only recognized names — an
  unknown one reports `No palette named X`.

Bitmaps pick up their colors from palette blocks **anywhere in the open
project**, matched by entry count — a 4-color bitmap offers every 4-entry
palette (and every 4-entry slice named by a `layout`) in a dropdown. Game
Boy projects fall back to the DMG green scale when no palette block
matches.

```c
/*{pal:"nes",layout:"nes"}*/
const char PALETTE[8] = { 0x0F, 0x11,0x24,0x3C, 0x00, 0x01,0x15,0x25 };
```

`bpw` applies to palette blocks too — PC Engine palettes are 16-bit
words, so their blocks carry `bpw:16` for correct parsing and write-back.

## Bit order and planes

Two questions decide how the bits turn into pixels.

**Where do bits start?** `brev:1` means **MSB is the leftmost pixel** — the
usual arrangement for NES, Game Boy, TMS9918, VCS, and most tile-based
hardware. Without it, the LSB is leftmost (Apple II HGR, some bitmap
formats).

**How are colors decided?** Most formats use one of these two:

- **`bpp:N`** — the bits of one pixel are adjacent within a word. `bpp:4`
  packs two 16-color pixels per byte.
- **`np:N`** — the bits of one pixel live in N separate words, `pofs`
  apart. Plane `p` supplies bits `p*bpp`.

Game Boy 2bpp is `bpp:1,np:2,pofs:1,sl:2` — planes interleaved every
other byte. NES 2bpp is `bpp:1,np:2,pofs:8` — plane 0 in bytes 0–7,
plane 1 in bytes 8–15.

## The address model

Everything except the special modes below is described by one addressing
formula. Read it through once and the rest of the fields will make sense.

```
bpw        = bpw   ?? 8                      // bits per word
sl         = sl    ?? ceil(w * bpp / bpw)    // words per scanline
wpimg      = wpimg ?? sl * h                 // words per image
pofs       = pofs  ?? sl * h * count         // distance between bitplanes
rowstride  = sl                              // (see il: below)

for each image n, for each row y:
    yp    = flip ? h-1-y : y
    ofs0  = n*wpimg + yp*rowstride
    shift = 0
    for each column x:
        ofs = remap(ofs0)                       // bit permutation
        for each plane p:
            word  = data[ofs + p*pofs + skip]
            bits  = brev ? word >> (bpw-shift-bpp) : word >> shift
            color |= (bits & ((1<<bpp)-1)) << (p*bpp)
        shift += bpp
        if shift >= bpw:                        // move to next word in the row
            ofs0 += 1
            shift = 0
```

Four consequences worth internalizing:

1. **`remap` is applied to `ofs0` inside the `x` loop**, after the
   byte-advance. It therefore sees the byte index *within* a row as well
   as the row and image index — which is exactly what lets you describe
   multi-tile-wide sprites.
2. **`skip` is added last**, after `remap` and after the plane offset. It
   offsets the whole block, not each image.
3. **`pofs` defaults to "one plane block after another"**
   (`sl*h*count`). Set it explicitly for anything interleaved.
4. Total colors per pixel = `1 << (bpp * np)`.

### `il` — row interleaving

`il:1` stores all `count` images as one wide block, row by row: `wpimg`
becomes `sl`, and `rowstride` becomes `sl*count`. Useful for character
sets stored as a single wide strip.

## `remap` — matching hardware tile layouts

`remap` permutes the **bits of the word offset**.
It is useful for handling bitmaps in a
different order than row-major, or for rearranging sprite tiles.

Entry `i` of the array says which destination bit source bit `i` becomes:

```
remap(ofs)  =  OR over i of:  bit i of ofs  →  bit remap[i] of result
```

A **negative** entry `-n` maps source bit `i` to destination bit `n-1`
**and inverts it** — use it when the hardware stores the halves in the
opposite order.

This exists because the natural row-major offset (`n*wpimg + y*sl +
xbyte`) rarely matches how hardware stores multi-tile sprites. Writing
the two offsets side by side in binary tells you the array.

### Worked example: NES 16×16 metasprite

From `presets/nes/shoot2.c`:

```c
/*{w:16,h:16,bpp:1,count:16,brev:1,np:2,pofs:8,remap:[5,0,1,2,4,6,7,8,9,10,11,12]}*/
```

`sl` = 2, `wpimg` = 32, so the natural offset is `32n + 2y + xb`:

| Source bit | Meaning | → | Dest bit | Contributes |
| --- | --- | --- | --- | --- |
| 0 | `xb` (left/right byte) | → | 5 | 32 |
| 1,2,3 | `y0,y1,y2` | → | 0,1,2 | `y & 7` |
| 4 | `y3` (top/bottom half) | → | 4 | 16 |
| 5+ | image index `n` | → | 6+ | 64·n |

Physical offset = `64n + 32·xb + 16·y3 + (y&7)`, plus `p*8` for the
plane. That is exactly NES CHR: four 16-byte tiles per metasprite in
8×16 sprite order — upper-left, lower-left, upper-right, lower-right.

### Worked example: Game Boy 16×16 metasprite

From `presets/gb/pakupaku.c`:

```c
/*{w:16,h:16,bpp:1,count:19,brev:1,np:2,pofs:1,sl:2,wpimg:64,remap:[5,1,2,3,4,0,6,7,8,9,10,11,12]}*/
```

Game Boy interleaves its planes (`pofs:1`), so `sl:2` is already consumed
by the two planes of a single 8-pixel row, and the natural offset `64n +
2y + xb` puts `xb` in bit 0 and `y` in bits 1–4. Bit 5 is never set. The
remap sends bit 0 (the 8×16 column) up to bit 5 and folds the unused bit
5 down to 0, producing `64n + 32·xb + 16·y3 + 2·(y&7)` — the L-top,
L-bot, R-top, R-bot tile order the game's OAM code uses.

### `remap` must be a bijection

In other words, if you do it in reverse, you get the original order back.

The size check computes the required data length as `max over n,i of
remap(n*wpimg + i)` for `i` in `[0, wpimg)`, plus one. If your remap
isn't a permutation of that range, the maximum comes out wrong and you
get a spurious *"Expected N values, found M"* error. This is why the
Game Boy example above bothers to map the unused bit 5 down to bit 0
instead of leaving it alone — the mapping is never exercised during
decoding, but it keeps the range exact.

### Other patterns in the tree

| Format | Meaning |
| --- | --- |
| `remap:[0,1,2,4,5,6,7,8,9,10,11,12]` | NES 8×8: doubles the image stride to 16 bytes so the two 8-byte planes fit |
| `remap:[4,0,1,2,3,5,6,7,8,9]` | TMS9918 16×16 sprite: UL, LL, UR, LR (ColecoVision, MSX) |
| `remap:[-5,0,1,2,3,5,6,7,8,9]` | Same, with the halves stored right-first |
| `remap:[3,0,1,2,4,5,6,7,8,9,10]` | Galaxian/Scramble 16×16 sprite |

## `reindex`

`reindex` throws out the shift/advance logic and replaces it with a plain
per-column table. For column `x`, `reindex[x % len]` is a **bit index
within the row**: `>> 3` gives the word offset added to the row base, `&
7` gives the bit position (still subject to `brev`). Entry `15` therefore
means word 1, bit 7. Because it drives the offset directly, the automatic
`ofs0 += 1` advance is disabled.

It exists for hardware where pixel order within a row is not linear —
notably VCS playfields, where the three playfield registers are not all
in the same bit order:

```asm
;;{w:20,h:10,flip:1,reindex:[4,5,6,7,15,14,13,12,11,10,9,8,16,17,18,19]};;
```

## Special modes

### `comp:"rletag"`

The block is RLE-compressed: the first byte is the tag, a literal byte
sets the current value, and a tag byte is followed by a repeat count
(count 0 = end). Decompression happens before decoding, so the editor
shows the expanded image. Currently, these asset blocks are view-only.

### `map:"nesnt"`

The block is an NES nametable, not a bitmap. `w`/`h` are in **tiles**
(default 32×30) and the block is rendered as a tilemap using the project's
CHR data, with a map editor instead of a pixel editor. Usually paired with
`comp:"rletag"`:

```c
/*{w:32,h:30,bpp:8,comp:"rletag",map:"nesnt"}*/
```
Currently, these asset blocks are view-only.

### `pacstrip:1`

Pac-Man / Namco arcade layout: 8-byte vertical strips of 4 rows × 8
columns, 2bpp packed as bit `y` plus bit `y+4`, X/Y mirrored within each
strip. Tiles (8×8) use 2 strips; sprites (16×16) use 8 strips in hardware
order. The mode implies 4 colors regardless of `bpp`.

```c
/*{w:8,h:8,count:256,bpp:2,pacstrip:1}*/
/*{w:16,h:16,count:64,bpp:2,pacstrip:1}*/
```

### `art:1`

Apple II HGR artifact color: bit 7 of each byte selects the color set, and
the editor shows a per-group palette toggle. The artifact bit is bit 0
when `brev` is set, bit 7 otherwise.

## Validation

Before it creates an editor, the Asset Editor counts the parsed words
(these are bytes when `bpw` is 8) and checks them against the format:

```
required = max(remap(n*wpimg + i))  +  planeExtent  +  1  +  skip
planeExtent = (np-1)*pofs, or 0 if that is smaller than wpimg
```

The `planeExtent` rule distinguishes the two plane layouts: when planes
are interleaved (`pofs < wpimg`, Game Boy/SMS) the plane bytes are already
inside each image block; when planes are stored as separate blocks
(`pofs >= wpimg`, NES) the extra plane is counted at the end.

A mismatch shows as **"Expected N value(s), found M"** in the Asset
Editor tab. When that happens, check things in this order:

1. **`found 0`** — the literals have no radix prefix, or the data block
   ended early at a stray `;`.
2. `count` — the most common culprit otherwise.
3. `wpimg` — hardware often pads (C64 sprites are 24×21 bits in 64
   bytes).
4. `remap` — is it a bijection over `[0, wpimg)`?
5. `pofs` — interleaved planes need it set explicitly.

## Cookbook

Real formats to copy from the preset tree:

| Platform | Header |
| --- | --- |
| NES 8×8 CHR | `/*{w:8,h:8,bpp:1,count:256,brev:1,np:2,pofs:8,remap:[0,1,2,4,5,6,7,8,9,10,11,12]}*/` |
| NES 16×16 metasprite | `/*{w:16,h:16,bpp:1,count:16,brev:1,np:2,pofs:8,remap:[5,0,1,2,4,6,7,8,9,10,11,12]}*/` |
| NES palette | `/*{pal:"nes",layout:"nes"}*/` |
| NES nametable | `/*{w:32,h:30,bpp:8,comp:"rletag",map:"nesnt"}*/` |
| Game Boy 8×8 tile | `/*{w:8,h:8,bpp:1,count:4,brev:1,np:2,pofs:1,sl:2}*/` |
| Game Boy 16×16 metasprite | `/*{w:16,h:16,bpp:1,count:19,brev:1,np:2,pofs:1,sl:2,wpimg:64,remap:[5,1,2,3,4,0,6,7,8,9,10,11,12]}*/` |
| ColecoVision / MSX sprite | `/*{w:16,h:16,brev:1,remap:[4,0,1,2,3,5,6,7,8,9],count:2}*/` |
| ColecoVision layered 2-plane sprite | `/*{w:16,h:16,remap:[-5,0,1,2,3,5,6,7,8,9],count:5,np:2}*/` |
| C64 hires sprite | `/*{w:24,h:21,bpp:1,brev:1,wpimg:64,aspect:1,count:3}*/` |
| C64 multicolor sprite | `/*{w:12,h:21,bpp:2,brev:1,wpimg:64,count:4,aspect:2}*/` |
| VCS sprite | `;;{w:8,h:16,brev:1,flip:1};;` |
| VCS palette | `;;{pal:"vcs"};;` |
| Galaxian/Scramble tile ROM | `/*{w:16,h:16,remap:[3,0,1,2,4,5,6,7,8,9,10],brev:1,np:2,pofs:2048,count:64}*/` |
| Pac-Man tiles / sprites | `/*{w:8,h:8,count:256,bpp:2,pacstrip:1}*/` · `/*{w:16,h:16,count:64,bpp:2,pacstrip:1}*/` |
| Pac-Man color PROM | `/*{pal:"pacman",n:32}*/` |
| Astrocade | `/*{w:16,h:16,bpp:2,brev:1}*/` · `/*{pal:"astrocade",layout:"astrocade"}*/` |
| Williams | `/*{w:16,h:16,bpp:4,brev:1}*/` |
| PC Engine 16×16 sprite | `/*{w:16,h:16,bpp:1,count:3,brev:1,np:4,pofs:16,sl:1,bpw:16,wpimg:64}*/` |
| Apple II HGR | `/*{w:8,h:8,bpp:1,count:96}*/` (LSB-first, no `brev`) |
| Verilog 16-bit words | `/*{w:16,h:16,bpw:16,count:5}*/` |
