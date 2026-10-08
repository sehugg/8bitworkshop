/* vgr3_play.c -- see vgr3_play.h. No libc calls. */
#include "vgr3_play.h"

static uint16_t rd16(const uint8_t *p) {
    return (uint16_t)(p[0] | (p[1] << 8));
}

static const uint8_t bitTab[8] = {1, 2, 4, 8, 16, 32, 64, 128};

/* Table lookup, not 1 << (r & 7): cc65/sdcc compile a variable shift as a
 * loop. A macro so the SET loop pays no call. */
#define PUT(p, r, v) do { \
    (p)->regs[r] = (v); \
    (p)->dirty[(r) >> 3] |= bitTab[(r) & 7]; \
} while (0)

/* Executes a SET whose opcode is `op` and whose operands start at q.
 * Returns the address after the operands. */
static const uint8_t *doSet(Vgr3Ctx *p, Vgr3Chan *c, uint8_t op, const uint8_t *q) {
    uint8_t mask = (uint8_t)((op & 0x7F) >> c->k);
    uint8_t wait = (uint8_t)(op & c->wmask);
    uint8_t r = c->base;
    while (mask) {
        if (mask & 1) { PUT(p, r, *q); q++; }
        mask >>= 1;
        r++;
    }
    if (!wait) wait = *q++;
    c->wait = wait;
    return q;
}

static void call(Vgr3Chan *c, const uint8_t *target, uint8_t count) {
    Vgr3Frame *f = c->sp++;
    f->ret = c->pc;
    f->left = count;
    c->pc = target;
}

/* Runs one item. */
static void step(Vgr3Ctx *p, Vgr3Chan *c) {
    const uint8_t *at;
    uint8_t op;
    Vgr3Frame *f = c->sp;      /* one past the top frame; == c->stack when empty */
    while (f != c->stack && f[-1].left == 0) c->pc = (--f)->ret;
    c->sp = f;
    at = c->pc;
    op = *c->pc++;
    if (f != c->stack) f[-1].left--;

    if (op & 0x80) {
        c->pc = doSet(p, c, op, c->pc);
    } else if (op < VGR3_OP_DICT_END) {
        /* the entry is a SET, or a CALLM/CALLL (returns to after this op) */
        const uint8_t *q = p->data + rd16(p->dict + op * 2);
        if (q[0] & 0x80) doSet(p, c, q[0], q + 1);
        else call(c, p->data + rd16(q + 1), (uint8_t)(q[0] == VGR3_OP_CALLL ? q[3] : (q[0] & 15) + 1));
    } else if (op >= VGR3_OP_CALLM) {
        const uint8_t *t = p->data + rd16(c->pc);
        c->pc += 2;
        call(c, t, (uint8_t)((op & 15) + 1));
    } else if (op >= VGR3_OP_CALLS) {
        const uint8_t *t = at - *c->pc++;
        call(c, t, (uint8_t)((op & 15) + 1));
    } else if (op == VGR3_OP_CALLL) {
        const uint8_t *t = p->data + rd16(c->pc);
        uint8_t n = c->pc[2];
        c->pc += 3;
        call(c, t, n);
    } else if (op == VGR3_OP_JUMP) {
        c->pc = p->data + rd16(c->pc);
    } else {
#if VGR3_FEAT_EXT
        if (op == VGR3_OP_EXT) {
            uint8_t sub = *c->pc++;
            if (sub == VGR3_EXT_LOAD) {
                uint8_t i;
                for (i = 0; i < c->width; i++) {
                    uint8_t r = (uint8_t)(c->base + i);
                    PUT(p, r, *c->pc);
                    c->pc++;
                }
                return;
            }
        }
#endif
        /* END or unknown: hold */
        c->pc = at;
        c->wait = 255;
#ifdef VGR3_MIXER
        if (!c->ended) c->ended = 1;
#endif
    }
}

static void initChan(Vgr3Chan *c, const uint8_t *ct, const uint8_t *data) {
    c->base = ct[0];
    c->width = ct[1];
    c->k = (uint8_t)(c->width <= VGR3_MASK_MAX_W ? 7 - c->width : 7);
    c->wmask = (uint8_t)((1 << c->k) - 1);
    c->pc = data + rd16(ct + 2);
    c->wait = 0;
    c->sp = c->stack;
#ifdef VGR3_MIXER
    c->ended = 0;
#endif
}

static void clearCtx(Vgr3Ctx *p) {
    uint8_t i;
    for (i = 0; i < VGR3_MAX_REGS; i++) p->regs[i] = 0;
    for (i = 0; i < VGR3_MAX_REGS / 8; i++) p->dirty[i] = 0;
}

static int badFile(const uint8_t *file) {
    return file[0] != 'V' || file[1] != 'G' || file[2] != 'R' || file[3] != '3' ||
           file[4] != VGR3_VERSION || file[7] > VGR3_MAX_CHANS;
}

int vgr3Init(Vgr3Player *p, const uint8_t *file) {
    const uint8_t *ct;
    uint8_t i, nd;
    if (badFile(file)) return 0;
    p->numChans = file[7];
    nd = file[8];
    ct = file + VGR3_HEADER_SIZE;
    p->dict = ct + p->numChans * VGR3_CHAN_SIZE;
    p->data = p->dict + nd * 2;
    clearCtx((Vgr3Ctx *)p);
    for (i = 0; i < p->numChans; i++, ct += VGR3_CHAN_SIZE)
        initChan(&p->chans[i], ct, p->data);
    return 1;
}

void vgr3Frame(Vgr3Player *p) {
    uint8_t i;
    Vgr3Chan *c = p->chans;     /* walk, don't index: &chans[i] is a multiply on cc65/sdcc */
    for (i = p->numChans; i; i--, c++) {
        while (c->wait == 0) step((Vgr3Ctx *)p, c);
        c->wait--;
    }
}

#ifdef VGR3_MIXER
/* ---- mixer ----
 * Written for cc65/sdcc: no per-iteration struct-size multiplies (walk
 * pointers, keep a direct ctx pointer in each channel), bounded loops
 * (chanTop, fadeMask) and a music-only fast path. */

#ifdef VGR3_SINGLE_MIXER
Vgr3Mixer g_mixer;
#define M (&g_mixer)
#else
#define M m
#endif

/* Highest active layer below `above` whose mask covers the byte at
 * index i, bit b; VGR3_MAX_LAYERS if none. */
static uint8_t ownerBelow(const Vgr3Mixer *mx, uint8_t above, uint8_t i, uint8_t b) {
    uint8_t l = above;
    while (l--) {
        if ((mx->active & bitTab[l]) && (mx->layer[l].mask[i] & b)) return l;
    }
    return VGR3_MAX_LAYERS;
}

/* Value layer l presents for register r (shadow, attenuated if fading and r
 * is a volume byte; i = r >> 3, bm = 1 << (r & 7)). */
static uint8_t layerVal(const Vgr3Mixer *mx, uint8_t l, const Vgr3Layer *La,
                        uint8_t r, uint8_t i, uint8_t bm) {
    uint8_t v = La->regs[r];
#ifdef VGR3_FADE
    if ((mx->fadeMask & bitTab[l]) && (mx->fadeOps->volMask[i] & bm))
        v = mx->fadeOps->atten(mx->fadeLevel[l], r, v);
#else
    (void)mx; (void)l; (void)i; (void)bm;
#endif
    return v;
}

/* Emit the bits d of byte i from layer l. */
static void emit(VGR3_MIXER_PARAM_C uint8_t l, const Vgr3Layer *La, uint8_t i, uint8_t d) {
    uint8_t r = (uint8_t)(i << 3), bm = 1;
    M->outDirty[i] |= d;
    for (; d; d >>= 1, r++, bm <<= 1)
        if (d & 1) M->outRegs[r] = layerVal(M, l, La, r, i, bm);
}

static void trimTop(VGR3_MIXER_PARAM) {
    while (M->chanTop && !M->chans[M->chanTop - 1].ctx) M->chanTop--;
}

/* `layer` no longer owns register r: re-emit it from the layer below that
 * covers it, unless a layer above still owns it. */
static void giveBack(VGR3_MIXER_PARAM_C uint8_t layer, uint8_t r) {
    uint8_t i = (uint8_t)(r >> 3), b = bitTab[r & 7], l;
    for (l = (uint8_t)(layer + 1); l < VGR3_MAX_LAYERS; l++)
        if ((M->active & bitTab[l]) && (M->layer[l].mask[i] & b)) return;
    if (M->seMask && (M->seMask[i] & b)) return;
    l = ownerBelow(M, layer, i, b);
    if (l == VGR3_MAX_LAYERS) return;
    M->outRegs[r] = layerVal(M, l, &M->layer[l], r, i, b);
    M->outDirty[i] |= b;
}

void vgr3MixerStop(VGR3_MIXER_PARAM_C uint8_t layer) {
    Vgr3Layer *La = &M->layer[layer];
    Vgr3Chan *c;
    uint8_t i, r;
    if (!(M->active & bitTab[layer])) return;
    for (c = M->chans, i = M->chanTop; i; i--, c++)
        if (c->ctx == (Vgr3Ctx *)La) c->ctx = 0;
    trimTop(VGR3_MIXER_ARG_ONLY);
    M->active &= (uint8_t)~bitTab[layer];
#ifdef VGR3_FADE
    M->fadeMask &= (uint8_t)~bitTab[layer];
#endif
    for (r = 0; r < VGR3_MAX_REGS; r++)
        if (La->mask[r >> 3] & bitTab[r & 7]) giveBack(VGR3_MIXER_ARG layer, r);
    for (i = 0; i < VGR3_MAX_REGS / 8; i++) {
        La->dirty[i] = 0;
        La->mask[i] = 0;
    }
}

/* Channel c of an overlay layer parked on END: give its bytes back to the
 * layers below now, and stop the layer once all its channels have ended. */
static void endChan(VGR3_MIXER_PARAM_C Vgr3Chan *c) {
    Vgr3Layer *La = (Vgr3Layer *)c->ctx;
    uint8_t layer = (uint8_t)(La - M->layer), r, i, b;
    Vgr3Chan *o;
    c->ended = 2;
    if (!layer) return;         /* nothing below the music */
    for (r = c->base; r < c->base + c->width; r++) {
        i = (uint8_t)(r >> 3);
        b = bitTab[r & 7];
        if (!(La->mask[i] & b)) continue;
        La->mask[i] &= (uint8_t)~b;
        La->dirty[i] &= (uint8_t)~b;
        giveBack(VGR3_MIXER_ARG layer, r);
    }
    for (o = M->chans, i = M->chanTop; i; i--, o++)
        if (o->ctx == c->ctx && o->ended != 2) return;
    vgr3MixerStop(VGR3_MIXER_ARG layer);
}

int vgr3MixerPlay(VGR3_MIXER_PARAM_C uint8_t layer, const uint8_t *file) {
    Vgr3Layer *La;
    const uint8_t *ct;
    uint8_t i, n, nd, slot;
    if (layer >= VGR3_MAX_LAYERS) return 0;
    vgr3MixerStop(VGR3_MIXER_ARG layer);
    if (badFile(file)) return 0;
    La = &M->layer[layer];
    n = file[7];
    nd = file[8];
    /* need n free slots */
    for (i = 0, slot = 0; i < VGR3_MAX_CHANS; i++)
        if (!M->chans[i].ctx) slot++;
    if (slot < n) return 0;
    ct = file + VGR3_HEADER_SIZE;
    La->dict = ct + n * VGR3_CHAN_SIZE;
    La->data = La->dict + nd * 2;
    clearCtx((Vgr3Ctx *)La);
    for (i = 0; i < VGR3_MAX_REGS / 8; i++) La->mask[i] = 0;
    slot = 0;
    for (i = 0; i < n; i++, ct += VGR3_CHAN_SIZE) {
        Vgr3Chan *c;
        while (M->chans[slot].ctx) slot++;
        c = &M->chans[slot];
        c->ctx = (Vgr3Ctx *)La;
        initChan(c, ct, La->data);
        slot++;
        if (slot > M->chanTop) M->chanTop = slot;
    }
    M->active |= bitTab[layer];
    return 1;
}

int vgr3MixerInit(VGR3_MIXER_PARAM_C const uint8_t *file) {
    uint8_t i;
    for (i = 0; i < VGR3_MAX_CHANS; i++) M->chans[i].ctx = 0;
    for (i = 0; i < VGR3_MAX_REGS; i++) M->outRegs[i] = 0;
    for (i = 0; i < VGR3_MAX_REGS / 8; i++) M->outDirty[i] = 0;
    M->active = 0;
    M->chanTop = 0;
#ifdef VGR3_FADE
    M->fadeKick = 0;
    M->fadeMask = 0;
    M->fadeOps = 0;
    for (i = 0; i < VGR3_MAX_LAYERS; i++) M->fadeStep[i] = 0;
#endif
    M->seMask = 0;
    return vgr3MixerPlay(VGR3_MIXER_ARG 0, file);
}

void vgr3MixerFrame(VGR3_MIXER_PARAM) {
    uint8_t i, l, taken, d;
    Vgr3Chan *c;
    Vgr3Layer *La;
    for (c = M->chans, i = M->chanTop; i; i--, c++) {
        if (!c->ctx) continue;
        while (c->wait == 0) step(c->ctx, c);
        c->wait--;
        if (c->ended == 1) endChan(VGR3_MIXER_ARG c);
    }
#ifdef VGR3_FADE
    if (M->fadeMask) {
        for (l = 0; l < VGR3_MAX_LAYERS; l++) {
            if (!(M->fadeMask & bitTab[l])) continue;
            if (--M->fadeLeft[l]) continue;
            M->fadeLeft[l] = M->fadeStep[l];
            if (++M->fadeLevel[l] == 16) vgr3MixerStop(VGR3_MIXER_ARG l);
            else M->fadeKick |= bitTab[l];
        }
    }
#endif
    if (M->active == 1) {
        /* music only: nothing can be covered */
        La = &M->layer[0];
        for (i = 0; i < VGR3_MAX_REGS / 8; i++) {
            d = La->dirty[i];
            La->mask[i] |= d;
#ifdef VGR3_FADE
            if (M->fadeKick & 1) d |= (uint8_t)(M->fadeOps->volMask[i] & La->mask[i]);
#endif
            if (!d) continue;
            La->dirty[i] = 0;
            emit(VGR3_MIXER_ARG 0, La, i, d);
        }
    } else {
        /* A layer's write goes out only if no higher active layer covers the
         * byte; writes to bytes an overlay holds are dropped (the lower
         * layer's shadow keeps them for release). */
        for (i = 0; i < VGR3_MAX_REGS / 8; i++) {
            taken = 0;
            La = &M->layer[VGR3_MAX_LAYERS];
            for (l = VGR3_MAX_LAYERS; l--;) {
                La--;
                if (!(M->active & bitTab[l])) continue;
                d = La->dirty[i];
                La->mask[i] |= d;   /* a layer owns a byte once it has written it */
#ifdef VGR3_FADE
                if (M->fadeKick & bitTab[l]) d |= (uint8_t)(M->fadeOps->volMask[i] & La->mask[i]);
#endif
                d &= (uint8_t)~taken;
                La->dirty[i] = 0;
                taken |= La->mask[i];
                if (d) emit(VGR3_MIXER_ARG l, La, i, d);
            }
        }
    }
#ifdef VGR3_FADE
    M->fadeKick = 0;
#endif
}

#ifdef VGR3_FADE
void vgr3MixerFade(VGR3_MIXER_PARAM_C uint8_t layer, uint8_t stepLen) {
    if (layer >= VGR3_MAX_LAYERS || !stepLen || !M->fadeOps) return;
    M->fadeStep[layer] = stepLen;
    M->fadeLeft[layer] = stepLen;
    M->fadeLevel[layer] = 0;
    M->fadeMask |= bitTab[layer];
}

void vgr3MixerFadeCancel(VGR3_MIXER_PARAM_C uint8_t layer) {
    if (layer >= VGR3_MAX_LAYERS || !(M->fadeMask & bitTab[layer])) return;
    M->fadeMask &= (uint8_t)~bitTab[layer];
    M->fadeKick |= bitTab[layer];
}

void vgr3MixerSetFadeOps(VGR3_MIXER_PARAM_C const Vgr3FadeOps *ops) {
    M->fadeOps = ops;
}

uint8_t vgr3AttenLow4(uint8_t level, uint8_t reg, uint8_t v) {
    uint8_t cap = (uint8_t)(15 - level);
    (void)reg;
    return (uint8_t)((v & 15) > cap ? (v & 0xF0) | cap : v);
}

uint8_t vgr3AttenSN(uint8_t level, uint8_t reg, uint8_t v) {
    (void)reg;
    return (uint8_t)((v & 15) < level ? (v & 0xF0) | level : v);
}

uint8_t vgr3AttenGB(uint8_t level, uint8_t reg, uint8_t v) {
    uint8_t cap = (uint8_t)(7 - (level >> 1));
    uint8_t r = (uint8_t)(v & 7), l = (uint8_t)((v >> 4) & 7);
    (void)reg;
    if (r > cap) r = cap;
    if (l > cap) l = cap;
    return (uint8_t)((v & 0x88) | (l << 4) | r);
}
#endif /* VGR3_FADE */
#endif /* VGR3_MIXER */
