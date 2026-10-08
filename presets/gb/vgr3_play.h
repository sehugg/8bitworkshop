/* vgr3_play.h -- VGR3 decoder (see vgr3_format.h).
 *
 * Call vgr3Frame() once per tick. It updates regs[] and sets a bit in
 * dirty[] for every byte written this frame; platform glue then writes
 * the dirty bytes to the hardware in whatever order the chip wants
 * (ascending works for NES/GB; SN76489 needs latch/data pairs) and
 * clears dirty[].
 *
 * RAM: VGR3_MAX_REGS + VGR3_MAX_REGS/8 bytes, plus per channel
 * 9 + 3*VGR3_MAX_DEPTH bytes on a target with 2-byte pointers.
 */

#ifndef VGR3_PLAY_H
#define VGR3_PLAY_H

#include <stdint.h>
#include "vgr3_format.h"

typedef struct {
    const uint8_t *ret;
    uint8_t left;       /* items still to run at this level */
} Vgr3Frame;

/* What step() needs from whatever it decodes into: the song's blob and
 * dict, and the shadow register file. Vgr3Player and Vgr3Layer both start
 * with these fields, so step() takes a pointer to either. */
#define VGR3_CTX_FIELDS                 \
    const uint8_t *data;    /* data blob */          \
    const uint8_t *dict;    /* dict offset table */  \
    uint8_t regs[VGR3_MAX_REGS];                     \
    uint8_t dirty[VGR3_MAX_REGS / 8];

typedef struct { VGR3_CTX_FIELDS } Vgr3Ctx;

typedef struct {
    const uint8_t *pc;
    uint8_t base;
    uint8_t width;
    uint8_t k;          /* wait bits in a SET opcode */
    uint8_t wait;       /* frames until the next item */
    uint8_t wmask;      /* (1 << k) - 1: the wait bits of a SET opcode */
    Vgr3Frame *sp;      /* one past the top stack frame */
#ifdef VGR3_MIXER
    Vgr3Ctx *ctx;       /* owning layer's context; NULL if the slot is unused */
    uint8_t ended;      /* 0 running, 1 just parked on END, 2 handled */
#endif
    Vgr3Frame stack[VGR3_MAX_DEPTH];
} Vgr3Chan;

typedef struct {
    VGR3_CTX_FIELDS
    uint8_t numChans;
    Vgr3Chan chans[VGR3_MAX_CHANS];
} Vgr3Player;

/* file must stay valid while playing (it is read in place). Returns 0
 * if it isn't a VGR3 file this decoder can play. */
int vgr3Init(Vgr3Player *p, const uint8_t *file);
void vgr3Frame(Vgr3Player *p);

#if defined(VGR3_FADE) && !defined(VGR3_MIXER)
#error VGR3_FADE needs VGR3_MIXER
#endif

#ifdef VGR3_MIXER
/* ---- Optional mixer: several songs at once (music + SFX overlays) ----
 *
 * Define VGR3_MIXER to build it; without it none of this exists and the
 * decoder is unchanged apart from one tag byte per channel being absent.
 * See notes/sfxfade.md. Layer 0 is the music, higher layers are overlays
 * and win the bytes their channels cover (`mask`). All layers' channels
 * run every frame (the music never pauses); only the merge decides which
 * layer's write reaches outRegs/outDirty. Platform glue flushes those
 * instead of a player's regs/dirty, then clears outDirty.
 *
 * Size the arrays per platform by defining these before including this
 * header. */
#ifndef VGR3_MAX_LAYERS
#define VGR3_MAX_LAYERS 3           /* 0 = music, 1..N-1 = sfx */
#endif

#ifdef VGR3_FADE
/* Per-chip fade hooks, supplied by the platform glue: which register
 * bytes are volumes (VGR3_MAX_REGS/8 bytes) and how to attenuate one by
 * `level` (0..15, 0 = no change, 15 = silent). See vgr3AttenLow4 etc. */
typedef struct {
    const uint8_t *volMask;
    uint8_t (*atten)(uint8_t level, uint8_t reg, uint8_t v);
} Vgr3FadeOps;
#endif

typedef struct {
    VGR3_CTX_FIELDS
    uint8_t mask[VGR3_MAX_REGS / 8];    /* bytes this layer's channels may write */
} Vgr3Layer;

typedef struct {
    Vgr3Layer layer[VGR3_MAX_LAYERS];
    Vgr3Chan chans[VGR3_MAX_CHANS];     /* shared pool, each tagged with its layer */
    uint8_t active;                     /* bitmask of live layers */
    uint8_t chanTop;                    /* 1 + highest used slot in chans[] */
    uint8_t outRegs[VGR3_MAX_REGS];     /* merged output */
    uint8_t outDirty[VGR3_MAX_REGS / 8];
    /* Optional: bytes NOT to re-emit on release. NULL (the default) restores
     * every held byte, including note triggers such as NES $4003, so a voice
     * comes back audibly even if the music only rewrites the period low byte
     * for a long stretch; the cost is one retrigger of the held note. */
    const uint8_t *seMask;
#ifdef VGR3_FADE
    const Vgr3FadeOps *fadeOps;         /* set by the platform glue */
    uint8_t fadeStep[VGR3_MAX_LAYERS];  /* frames per level step; 0 = not fading */
    uint8_t fadeLeft[VGR3_MAX_LAYERS];  /* frames to the next step */
    uint8_t fadeLevel[VGR3_MAX_LAYERS]; /* 0..15 attenuation; 16 stops the layer */
    uint8_t fadeMask;                   /* layers currently fading */
    uint8_t fadeKick;                   /* layers whose volume bytes must be re-emitted */
#endif
} Vgr3Mixer;

/* On cc65/sdcc a pointer parameter costs a lot; with VGR3_SINGLE_MIXER the
 * API drops it and works on one static g_mixer. Host tests and multi-chip
 * boards build without it and pass a pointer. */
#ifdef VGR3_SINGLE_MIXER
extern Vgr3Mixer g_mixer;
#define VGR3_MIXER_PARAM void
#define VGR3_MIXER_PARAM_C
#define VGR3_MIXER_ARG
#define VGR3_MIXER_ARG_ONLY
#else
#define VGR3_MIXER_PARAM Vgr3Mixer *m
#define VGR3_MIXER_PARAM_C VGR3_MIXER_PARAM,
#define VGR3_MIXER_ARG m,
#define VGR3_MIXER_ARG_ONLY m
#endif

/* Clears everything and starts `file` as layer 0. */
int vgr3MixerInit(VGR3_MIXER_PARAM_C const uint8_t *file);
/* Starts `file` on `layer` (1..VGR3_MAX_LAYERS-1), replacing whatever the
 * layer was playing. Returns 0 on a bad file or if the channel pool is
 * full (the layer is left stopped). */
int vgr3MixerPlay(VGR3_MIXER_PARAM_C uint8_t layer, const uint8_t *file);
/* Stops a layer and hands its bytes back to the layers below: every held
 * byte is re-emitted from the lower layer's shadow (except seMask bytes). */
void vgr3MixerStop(VGR3_MIXER_PARAM_C uint8_t layer);
/* Steps every live channel and merges into outRegs/outDirty. */
void vgr3MixerFrame(VGR3_MIXER_PARAM);

#ifdef VGR3_FADE
/* Fades `layer` out: attenuation rises one level every `stepLen` frames
 * (1..255), so the fade lasts 16 * stepLen frames, then the layer is
 * stopped. Only volume bytes it owns are affected (an overlay's are not).
 * Needs fadeOps set (vgr3MixerSetFadeOps). */
void vgr3MixerFade(VGR3_MIXER_PARAM_C uint8_t layer, uint8_t stepLen);
/* Abandons a fade in progress and restores the layer's volumes. */
void vgr3MixerFadeCancel(VGR3_MIXER_PARAM_C uint8_t layer);
void vgr3MixerSetFadeOps(VGR3_MIXER_PARAM_C const Vgr3FadeOps *ops);

/* Ready-made atten functions. Low4: 4-bit volume in the low nibble,
 * 15 = loudest, clamped to 15 - level (NES $4000/$4004/$400C, AY R8-R10,
 * POKEY AUDCn, SID R24). SN: 4-bit attenuation, 0 = loudest, raised to at
 * least `level` (SN76489 volume regs). GB: NR50 master volume, two 3-bit
 * fields (NRx2 volume only applies on trigger, so fade NR50 instead). */
uint8_t vgr3AttenLow4(uint8_t level, uint8_t reg, uint8_t v);
uint8_t vgr3AttenSN(uint8_t level, uint8_t reg, uint8_t v);
uint8_t vgr3AttenGB(uint8_t level, uint8_t reg, uint8_t v);
#endif /* VGR3_FADE */
#endif /* VGR3_MIXER */

#endif /* VGR3_PLAY_H */
