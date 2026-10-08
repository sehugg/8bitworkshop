/* vgr3_format.h -- VGR3 ("per-voice channel") file format. See new.md.
 *
 * A song is a small set of channels. Each channel owns a contiguous
 * window [base, base+width) of a global shadow register file and runs
 * its own opcode stream. Ops write bytes into the register file and
 * mark them dirty; platform glue flushes dirty bytes once per frame.
 *
 * All multi-byte fields are little-endian.
 *
 *   Header (16 bytes):
 *     u8  magic[4]      "VGR3"
 *     u8  version       VGR3_VERSION
 *     u8  chipType      VGR3_CHIP_*
 *     u8  tickRate      frames/second, e.g. 60
 *     u8  numChans
 *     u8  dictCount     0..VGR3_DICT_MAX
 *     u8  reserved      0
 *     u16 dataSize      bytes in the data blob
 *     u16 totalFrames   song length (frame of the loop JUMP), <= 0xFFFE
 *     u16 loopFrame     0xFFFF if the song doesn't loop (info only:
 *                       the decoder just follows each channel's JUMP).
 *                       vgm2vgr3 --loop turns a source with no loop
 *                       point into a loop-at-frame-0 file (loopFrame 0,
 *                       each channel ends in a JUMP back to its start)
 *   Channel table [numChans] (4 bytes each):
 *     u8  base          first register-file byte this channel writes
 *     u8  width         W: number of bytes in its window
 *     u16 start         offset of its first op in the data blob
 *   Dict table [dictCount] (2 bytes each):
 *     u16 offset        of a SET, CALLM or CALLL item in the data blob
 *   Data blob (all u16 addresses below are offsets into it)
 *
 * Opcodes (one byte, operands follow):
 *
 *   1mmm mwww  SET   mask = (op & 0x7F) >> K, wait = op & ((1<<K)-1),
 *                    K = 7-W (W < 8) or 7 (W >= 8, no mask bits).
 *                    One value byte follows per set mask bit (bit 0 =
 *                    base+0). If wait == 0 a u8 wait (1-255) follows
 *                    the values. mask == 0 is a pure WAIT.
 *   0x00-0x5B  DICT  execute the item at dict[op] (pc not moved): a
 *                    SET, or a CALLM/CALLL that returns to after the
 *                    DICT op (one item of the caller, like a CALL)
 *   0x5C       EXT   prefix for a bulk op: the next byte selects it.
 *                    Current bulk ops:
 *                      0x00 LOAD: W value bytes (every byte of the
 *                           window); no wait, so a WAIT item follows (the
 *                           same wave then repeats as the same bytes)
 *                    (more bulk ops can be added as sub-opcodes here)
 *   0x5D       JUMP  u16 addr (loop; top level only)
 *   0x5E       END   hold forever
 *   0x5F       CALLL u16 addr, u8 count (1-255)
 *   0x6n       CALLS u8 dist: addr = (address of this op) - dist,
 *                    count = n+1
 *   0x7n       CALLM u16 addr, count = n+1
 *
 * An item is one op at the current level (a CALL is one item of its
 * caller, however much it runs). CALL runs `count` items starting at
 * addr, which may themselves be CALLs, up to VGR3_MAX_DEPTH levels,
 * then returns. Every SET item ends with a wait >= 1; each frame a
 * channel executes items until one sets a wait.
 */

#ifndef VGR3_FORMAT_H
#define VGR3_FORMAT_H

#define VGR3_MAGIC       "VGR3"
#define VGR3_VERSION     2
#define VGR3_HEADER_SIZE 16
#define VGR3_LOOP_NONE   0xFFFFu
#define VGR3_CHAN_SIZE   4

enum {
    VGR3_CHIP_SN76489 = 1,
    VGR3_CHIP_AY8910  = 2,
    VGR3_CHIP_NES_APU = 3,
    VGR3_CHIP_GB_DMG  = 4,
    VGR3_CHIP_POKEY   = 5,
    VGR3_CHIP_SID     = 6
};

/* Register-file layouts, per chip:
 *   SN76489: 0-8 = tone0 lo4, tone0 hi6, vol0, tone1 lo4, ..., vol2;
 *            9 = noise control, 10 = noise vol
 *   AY8910:  0-13 = R0-R13
 *   NES APU: 0x00-0x17 = $4000-$4017
 *   GB DMG:  0x00-0x16 = NR10-NR52 ($FF10-$FF26),
 *            0x20-0x2F = wave RAM ($FF30-$FF3F)
 *   POKEY:   0x00-0x0A = AUDF1/AUDC1/AUDF2/AUDC2/AUDF3/AUDC3/AUDF4/AUDC4,
 *            AUDCTL, STIMER, SKRES ($D200-$D20A); POT/POTGO are ignored
 *   SID:     0x00-0x06 = V1 freq(2), PW(2), control, AD, SR; 0x07-0x0D = V2;
 *            0x0E-0x14 = V3; 0x15-0x18 = filter cutoff(2), res/routing,
 *            mode/volume ($D400-$D418). The read-only POT/OSC/ENV registers
 *            ($D419-$D41C) are never written, so they are not modelled. */
#define VGR3_NREGS_SN76489 11
#define VGR3_NREGS_AY8910  14
#define VGR3_NREGS_NES_APU 0x18
#define VGR3_NREGS_GB_DMG  0x30
#define VGR3_NREGS_POKEY   11
#define VGR3_NREGS_SID     0x19
#ifndef VGR3_MAX_REGS       /* a platform build may shrink this to its chip's NREGS */
#define VGR3_MAX_REGS      0x30
#endif

#define VGR3_OP_DICT_END  0x5C  /* DICT is 0x00..0x5B */
#define VGR3_OP_EXT       0x5C  /* prefix: next byte is a bulk op */
#define VGR3_OP_JUMP      0x5D
#define VGR3_OP_END       0x5E
#define VGR3_OP_CALLL     0x5F
#define VGR3_OP_CALLS     0x60
#define VGR3_OP_CALLM     0x70
#define VGR3_OP_SET       0x80

/* Bulk ops: the byte following VGR3_OP_EXT. */
#define VGR3_EXT_LOAD     0x00  /* write all W window bytes (no wait) */

#define VGR3_DICT_MAX     VGR3_OP_DICT_END
#define VGR3_MAX_DEPTH    4
#ifndef VGR3_MAX_CHANS      /* likewise: music + sfx channels playing at once */
#define VGR3_MAX_CHANS    16
#endif
#define VGR3_MASK_MAX_W   7    /* widest channel that can use SET masks */

#endif /* VGR3_FORMAT_H */
