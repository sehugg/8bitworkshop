/*
 * PC Engine graphics smoke test — BG tiles + bouncing sprites.
 *
 * Proves the pcegfx SDK (not conio). Pad moves the ship; ball/alien bounce.
 */
//#resource "pcegfx.h"
//#resource "gfxtest_gfx.h"
//#link "pcegfx.c"
//#link "pcegfx_tia.s"

#include <joystick.h>
#include "pcegfx.h"
#include "gfxtest_gfx.h"

#define TILE0   PCE_TILE_BASE
#define SPR0    PCE_SPR_BASE

static word ship_x, ship_y;
static word ball_x, ball_y;
static sbyte ball_dx, ball_dy;
static word alien_x, alien_y;
static sbyte alien_dx;

static void draw_playfield(void) {
  byte x, y;

  /* sky */
  pce_fill_bat(0, 0, 32, 28, PCE_BAT(TILE0 + 1, 0));

  /* checker floor */
  for (y = 24; y < 28; ++y)
    for (x = 0; x < 32; ++x)
      pce_put_tile(x, y, PCE_BAT(TILE0 + 2, 0));

  /* brick border */
  pce_fill_bat(0, 0, 32, 1, PCE_BAT(TILE0 + 3, 0));
  pce_fill_bat(0, 23, 32, 1, PCE_BAT(TILE0 + 3, 0));
  for (y = 1; y < 23; ++y) {
    pce_put_tile(0, y, PCE_BAT(TILE0 + 3, 0));
    pce_put_tile(31, y, PCE_BAT(TILE0 + 3, 0));
  }

  /* stars */
  pce_put_tile(4, 3, PCE_BAT(TILE0 + 4, 0));
  pce_put_tile(12, 5, PCE_BAT(TILE0 + 4, 0));
  pce_put_tile(20, 2, PCE_BAT(TILE0 + 4, 0));
  pce_put_tile(27, 6, PCE_BAT(TILE0 + 4, 0));
  pce_put_tile(8, 10, PCE_BAT(TILE0 + 4, 0));
  pce_put_tile(22, 12, PCE_BAT(TILE0 + 4, 0));
}

static void setup_gfx(void) {
  pce_gfx_init();
  pce_disp_off();

  pce_load_palette(0, gfxtest_bg_pal, 16);
  pce_load_palette(256, gfxtest_spr_pal, 16);

  pce_load_tiles(TILE0, gfxtest_tiles, GFXTEST_NTILE);
  pce_load_sprites(SPR0, gfxtest_sprites, GFXTEST_NSPR);

  draw_playfield();

  ship_x = PCE_SPR_X0 + 120;
  ship_y = PCE_SPR_Y0 + 180;
  ball_x = PCE_SPR_X0 + 80;
  ball_y = PCE_SPR_Y0 + 40;
  ball_dx = 2;
  ball_dy = 1;
  alien_x = PCE_SPR_X0 + 40;
  alien_y = PCE_SPR_Y0 + 60;
  alien_dx = 1;

  pce_satb_clear();
  pce_spr_set(0, ship_x, ship_y, PCE_SPR_PATTERN(0), PCE_SPR_PRI | PCE_SPR_PAL(0));
  pce_spr_set(1, ball_x, ball_y, PCE_SPR_PATTERN(1), PCE_SPR_PRI | PCE_SPR_PAL(0));
  pce_spr_set(2, alien_x, alien_y, PCE_SPR_PATTERN(2), PCE_SPR_PRI | PCE_SPR_PAL(0));
  pce_satb_update();
  pce_disp_on();
}

static void update_sprites(void) {
  unsigned char pad = joy_read(JOY_1);

  if (JOY_LEFT(pad) && ship_x > PCE_SPR_X0 + 8)
    ship_x -= 2;
  if (JOY_RIGHT(pad) && ship_x < PCE_SPR_X0 + 256 - 24)
    ship_x += 2;
  if (JOY_UP(pad) && ship_y > PCE_SPR_Y0 + 8)
    ship_y -= 2;
  if (JOY_DOWN(pad) && ship_y < PCE_SPR_Y0 + 224 - 24)
    ship_y += 2;

  ball_x += ball_dx;
  ball_y += ball_dy;
  if (ball_x <= PCE_SPR_X0 + 8 || ball_x >= PCE_SPR_X0 + 256 - 24)
    ball_dx = -ball_dx;
  if (ball_y <= PCE_SPR_Y0 + 8 || ball_y >= PCE_SPR_Y0 + 224 - 40)
    ball_dy = -ball_dy;

  alien_x += alien_dx;
  if (alien_x <= PCE_SPR_X0 + 8 || alien_x >= PCE_SPR_X0 + 256 - 24)
    alien_dx = -alien_dx;

  {
    word attr = PCE_SPR_PRI | PCE_SPR_PAL(0);
    PCE_SPR_SET(0, ship_x, ship_y, PCE_SPR_PATTERN(0), attr);
    PCE_SPR_SET(1, ball_x, ball_y, PCE_SPR_PATTERN(1), attr);
    PCE_SPR_SET(2, alien_x, alien_y, PCE_SPR_PATTERN(2), attr);
  }
  pce_satb_update_n(3);
}

int main(void) {
  joy_install(joy_static_stddrv);
  setup_gfx();

  for (;;) {
    pce_wait_vsync();
    update_sprites();
  }
  return 0;
}
