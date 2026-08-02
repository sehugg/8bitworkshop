/*
 * PC Engine graphics pipeline benchmark.
 *
 * Isolates vsync / SATB / BAT / put_tile / TIA / game-shaped workloads.
 * After each scenario finishes, paints a bar chart:
 *
 *   Columns  0..9  : OVER  (brick)  — vsync overruns (want 0)
 *   Columns 10..19 : BUSY  (floor)  — avg SATB-idle wait iters / 4
 *   Columns 20..29 : SLACK (sky)    — free loops until next VB >> 6
 *   Column  31     : star           — row marker
 *
 * Row 0 = legend. Rows 2+ = scenarios. Row 27 = live progress while running.
 * I / RUN restarts.
 *
 * Build: scripts/build_pce_local.sh perftest [mame|geargrafx]
 */
//#resource "pcegfx.h"
//#resource "gfxtest_gfx.h"
//#link "pcegfx.c"
//#link "pcegfx_tia.s"

#include <joystick.h>
#include "pcegfx.h"
#include "gfxtest_gfx.h"

#define TILE0 PCE_TILE_BASE
#define SPR0  PCE_SPR_BASE
#define TEST_FRAMES 30

typedef void (*work_fn)(void);

typedef struct {
  const char *name;
  work_fn work;
  byte use_busy; /* 1 = pce_wait_vsync, 0 = VB only */
  word over;
  word busy_avg;
  word slack;
} Scenario;

static word bat_row[32];
static unsigned char burst_buf[256];
static word frame_i;
static byte done;
static byte scen;

/* Exported so MAME/lua can peek progress: $22xx via map */
unsigned char pce_perf_scen = 0;
unsigned char pce_perf_done = 0;

static word slack_until_vb(void) {
  word n = 0;
  if (pce_vb_pending()) return 0;
  while (!pce_vb_pending()) {
    if (++n == 0) return 0xFFFF;
  }
  return n;
}

static void work_none(void) {}

static void work_satb15(void) {
  byte i;
  word a = PCE_SPR_PRI | PCE_SPR_PAL(0);
  for (i = 0; i < 15; i++)
    PCE_SPR_SET(i, (word)(PCE_SPR_X0 + i * 8), PCE_SPR_Y0 + 90,
                PCE_SPR_PATTERN(i % 3), a);
  pce_satb_update_n(15);
}

static void work_satb64(void) {
  byte i;
  word a = PCE_SPR_PRI | PCE_SPR_PAL(0);
  for (i = 0; i < 64; i++)
    PCE_SPR_SET(i, (word)(PCE_SPR_X0 + (i & 15) * 12),
                (word)(PCE_SPR_Y0 + (i >> 4) * 18),
                PCE_SPR_PATTERN(i % 3), a);
  pce_satb_update_n(64);
}

static void work_bat1(void) {
  byte i;
  for (i = 0; i < 32; i++)
    bat_row[i] = PCE_BAT(TILE0 + 2, 0);
  pce_put_bat_row(0, (byte)(8 + (frame_i & 7)), bat_row, 32);
}

static void work_bat4(void) {
  byte r;
  work_bat1();
  for (r = 1; r < 4; r++)
    pce_put_bat_row(0, (byte)(8 + r), bat_row, 32);
}

static void work_put32(void) {
  byte x, y = (byte)(8 + (frame_i & 7));
  for (x = 0; x < 32; x++)
    pce_put_tile(x, y, PCE_BAT(TILE0 + 3, 0));
}

static void work_tia64(void)  { pce_vram_burst(0x1000, burst_buf, 64); }
static void work_tia256(void) { pce_vram_burst(0x1000, burst_buf, 256); }

static void work_solar(void) { work_bat1(); work_satb15(); }

static void work_chase(void) {
  byte i;
  word a = PCE_SPR_PRI | PCE_SPR_PAL(0);
  static word cell[2];
  cell[0] = cell[1] = PCE_BAT(TILE0 + 2, 0);
  for (i = 0; i < 3; i++) {
    word addr = PCE_BAT_ADDR_XY((byte)(i * 4), (byte)(10 + i));
    pce_vram_burst(addr, cell, 4);
    pce_vram_burst((word)(addr + 32), cell, 4);
  }
  for (i = 0; i < 4; i++)
    PCE_SPR_SET(i, (word)(PCE_SPR_X0 + 50 + i * 20), PCE_SPR_Y0 + 140,
                PCE_SPR_PATTERN(i % 3), a);
  pce_satb_update_n(4);
}

static void work_cpu(void) {
  volatile word n = 0;
  word i;
  /* ~cheap CPU burn; 2k was enough to miss frames on 7.6MHz */
  for (i = 0; i < 800; i++) n += i;
}

static Scenario scenarios[] = {
  { "IDLE+BUSY", work_none,  1, 0, 0, 0 },
  { "IDLE VB",   work_none,  0, 0, 0, 0 },
  { "SATB15",    work_satb15,1, 0, 0, 0 },
  { "SATB64",    work_satb64,1, 0, 0, 0 },
  { "BAT1",      work_bat1,  1, 0, 0, 0 },
  { "BAT4",      work_bat4,  1, 0, 0, 0 },
  { "PUT32",     work_put32, 1, 0, 0, 0 },
  { "TIA64",     work_tia64, 1, 0, 0, 0 },
  { "TIA256",    work_tia256,1, 0, 0, 0 },
  { "SOLAR",     work_solar, 1, 0, 0, 0 },
  { "CHASE",     work_chase, 1, 0, 0, 0 },
  { "CPU2K",     work_cpu,   1, 0, 0, 0 },
  { "SOLAR VB",  work_solar, 0, 0, 0, 0 },
};
#define NSCENARIO (sizeof(scenarios) / sizeof(scenarios[0]))

static void paint_progress(byte s, word f) {
  byte x, filled;
  word brick = PCE_BAT(TILE0 + 3, 0);
  word blank = PCE_BAT(TILE0, 0);
  /* scenario index in cols 0..NSCENARIO-1 */
  for (x = 0; x < 32; x++)
    pce_put_tile(x, 27, x < s ? brick : blank);
  /* frame fraction in row 26 */
  filled = (byte)((f * 32) / TEST_FRAMES);
  for (x = 0; x < 32; x++)
    pce_put_tile(x, 26, x < filled ? PCE_BAT(TILE0 + 2, 0) : blank);
}

static void paint_chart(void) {
  byte i, x;
  word blank = PCE_BAT(TILE0, 0);
  word sky = PCE_BAT(TILE0 + 1, 0);
  word floor = PCE_BAT(TILE0 + 2, 0);
  word brick = PCE_BAT(TILE0 + 3, 0);
  word star = PCE_BAT(TILE0 + 4, 0);

  /* TIA tests may have clobbered tile data at $1000 — reload. */
  pce_load_tiles(TILE0, gfxtest_tiles, GFXTEST_NTILE);
  pce_satb_clear();
  pce_satb_update();

  pce_fill_bat(0, 0, 32, 28, blank);

  for (x = 0; x < 10; x++) pce_put_tile(x, 0, brick);
  for (x = 10; x < 20; x++) pce_put_tile(x, 0, floor);
  for (x = 20; x < 30; x++) pce_put_tile(x, 0, sky);
  pce_put_tile(31, 0, star);

  for (i = 0; i < NSCENARIO; i++) {
    Scenario *s = &scenarios[i];
    byte y = (byte)(2 + i);
    byte ow = s->over > 10 ? 10 : (byte)s->over;
    byte bw = (byte)(s->busy_avg >> 2);
    byte sw = (byte)(s->slack >> 6);
    if (bw > 10) bw = 10;
    if (sw > 10) sw = 10;
    for (x = 0; x < 10; x++)
      pce_put_tile(x, y, x < ow ? brick : blank);
    for (x = 0; x < 10; x++)
      pce_put_tile((byte)(10 + x), y, x < bw ? floor : blank);
    for (x = 0; x < 10; x++)
      pce_put_tile((byte)(20 + x), y, x < sw ? sky : blank);
    pce_put_tile(31, y, star);
  }
}

static void run_one(Scenario *s) {
  word over0 = pce_vsync_overruns;
  word busy_sum = 0;
  word attr = PCE_SPR_PRI | PCE_SPR_PAL(0);

  for (frame_i = 0; frame_i < TEST_FRAMES; frame_i++) {
    if (s->use_busy)
      pce_wait_vsync();
    else
      pce_wait_vsync_vb();

    if (s->use_busy)
      busy_sum += pce_busy_wait_iters;

    s->work();

    PCE_SPR_SET(0, (word)(PCE_SPR_X0 + (frame_i * 3)),
                (word)(PCE_SPR_Y0 + 40 + scen * 8),
                PCE_SPR_PATTERN(0), attr);
    /* Heartbeat sprite when the workload itself doesn't upload SATB */
    if (s->work == work_none || s->work == work_bat1 || s->work == work_bat4 ||
        s->work == work_put32 || s->work == work_tia64 || s->work == work_tia256 ||
        s->work == work_cpu)
      pce_satb_update_n(1);
  }
  paint_progress((byte)(scen + 1), TEST_FRAMES);

  if (s->use_busy) pce_wait_vsync();
  else pce_wait_vsync_vb();
  s->work();
  s->slack = slack_until_vb();
  s->over = (word)(pce_vsync_overruns - over0);
  s->busy_avg = s->use_busy ? (word)(busy_sum / TEST_FRAMES) : 0;
}

static void setup(void) {
  word bi;
  pce_gfx_init();
  pce_disp_off();
  pce_load_palette(0, gfxtest_bg_pal, 16);
  pce_load_palette(256, gfxtest_spr_pal, 16);
  pce_load_tiles(TILE0, gfxtest_tiles, GFXTEST_NTILE);
  pce_load_sprites(SPR0, gfxtest_sprites, GFXTEST_NSPR);
  for (bi = 0; bi < sizeof(burst_buf); bi++)
    burst_buf[bi] = (unsigned char)bi;
  pce_fill_bat(0, 0, 32, 28, PCE_BAT(TILE0 + 1, 0));
  pce_satb_clear();
  pce_satb_update();
  pce_disp_on();
}

int main(void) {
  word attr = PCE_SPR_PRI | PCE_SPR_PAL(0);

  joy_install(joy_static_stddrv);
  setup();

  for (;;) {
    pce_perf_done = 0;

    for (frame_i = 0; frame_i < 30; frame_i++) {
      pce_wait_vsync();
      PCE_SPR_SET(0, (word)(PCE_SPR_X0 + frame_i * 2), PCE_SPR_Y0 + 80,
                  PCE_SPR_PATTERN(0), attr);
      pce_satb_update_n(1);
      paint_progress(0, frame_i);
    }

    pce_vsync_overruns = 0;
    done = 0;
    for (scen = 0; scen < NSCENARIO; scen++) {
      pce_perf_scen = scen;
      run_one(&scenarios[scen]);
    }

    paint_chart();
    done = 1;
    pce_perf_done = 1;

    for (;;) {
      byte joy;
      pce_wait_vsync();
      PCE_SPR_SET(0, (word)(PCE_SPR_X0 + ((frame_i++) & 127)),
                  PCE_SPR_Y0 + 200, PCE_SPR_PATTERN(1), attr);
      pce_satb_update_n(1);
      joy = joy_read(JOY_1);
      if (JOY_BTN_I(joy) || JOY_RUN(joy))
        break;
    }
    while (JOY_BTN_I(joy_read(JOY_1)) || JOY_RUN(joy_read(JOY_1)))
      pce_wait_vsync();
  }
  return 0;
}
