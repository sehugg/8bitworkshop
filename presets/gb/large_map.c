/*
Large scrolling map demo for Game Boy.
Ported from GBDK's examples/cross-platform/large_map.

The map image is 1248x528 pixels = 156x66 tiles, far bigger than
the GB's 32x32 tile background map. Only the visible window plus the
next row/column is poked into VRAM with set_bkg_submap(), and the
whole thing is scrolled with move_bkg(). This is the standard GBDK
way to scroll a map larger than the hardware tile map.

Notes on the port:
- The original uses DEVICE_SCREEN_* macros from gbdk/platform.h;
  on GB those are just the 20x18 visible area inside a 32x32 map.
- There is no CGB attribute plane here, so the attribute submap
  calls become no-ops.
- The map/tile data lives in bigmap.h (generated with png2asset).
*/

//#link "gb/sfr.sgb"
//#link "gb/crt0.sgb"
//#resource "gb/global.sgb"

#include <stdint.h>
#include "gb/types.h"
#include "gb/hardware.h"
#include "gb/gb.h"
#include "gb/cgb.h"
#include "bigmap.h"

#define DEVICE_SCREEN_WIDTH 20
#define DEVICE_SCREEN_HEIGHT 18
#define DEVICE_SCREEN_BUFFER_WIDTH 32
#define DEVICE_SCREEN_BUFFER_HEIGHT 32

#define bigmap_mapWidth (bigmap_WIDTH/bigmap_TILE_W)
#define bigmap_mapHeight (bigmap_HEIGHT/bigmap_TILE_H)

#define camera_max_y ((bigmap_mapHeight - DEVICE_SCREEN_HEIGHT) * 8)
#define camera_max_x ((bigmap_mapWidth - DEVICE_SCREEN_WIDTH) * 8)

#define WRAP_SCROLL_Y(y) ((y) % (DEVICE_SCREEN_BUFFER_HEIGHT * 8))

// one-byte-per-tile map, so no attributes to set on DMG
#define set_submap_attributes(x, y, w, h, map, map_w)

#define MIN(A,B) ((A)<(B)?(A):(B))

uint8_t joy;

// current and old positions of the camera in pixels
uint16_t camera_x, camera_y, old_camera_x, old_camera_y;
// current and old position of the map in tiles
uint8_t map_pos_x, map_pos_y, old_map_pos_x, old_map_pos_y;
// redraw flag, indicates that camera position was changed
uint8_t redraw;

inline uint8_t update_column_left(uint8_t map_pos_x) {
  return map_pos_x;
}

inline uint8_t update_column_right(uint8_t map_pos_x) {
  return map_pos_x + DEVICE_SCREEN_WIDTH;
}

inline uint8_t update_row_top(uint8_t map_pos_y) {
  return map_pos_y;
}

inline uint8_t update_row_bottom(uint8_t map_pos_y) {
  return map_pos_y + DEVICE_SCREEN_HEIGHT;
}

// The map is a 2D [row][column] array (one flat 10296-byte initializer
// overflows the SDCC front-end); the rows are contiguous, so pass the
// first row as the base pointer.
void set_submap_rows(uint8_t x, uint8_t y, uint8_t w, uint8_t h) {
  set_bkg_submap(x, y, w, h, bigmap_map[0], bigmap_mapWidth);
}

void set_camera(void)
{
  // update hardware scroll position
  move_bkg(camera_x, WRAP_SCROLL_Y(camera_y));
  // up or down
  map_pos_y = (uint8_t)(camera_y >> 3u);
  if (map_pos_y != old_map_pos_y)
  {
    if (camera_y < old_camera_y)
    {
      set_submap_rows(
        map_pos_x,
        update_row_top(map_pos_y),
        MIN(DEVICE_SCREEN_WIDTH + 1, bigmap_mapWidth-map_pos_x),
        1);
    }
    else
    {
      if ((bigmap_mapHeight - DEVICE_SCREEN_HEIGHT) > map_pos_y)
      {
        set_submap_rows(
          map_pos_x,
          update_row_bottom(map_pos_y),
          MIN(DEVICE_SCREEN_WIDTH + 1, bigmap_mapWidth-map_pos_x),
          1);
      }
    }
    old_map_pos_y = map_pos_y;
  }
  // left or right
  map_pos_x = (uint8_t)(camera_x >> 3u);
  if (map_pos_x != old_map_pos_x)
  {
    if (camera_x < old_camera_x)
    {
      set_submap_rows(
        update_column_left(map_pos_x),
        map_pos_y,
        1,
        MIN(DEVICE_SCREEN_HEIGHT + 1, bigmap_mapHeight - map_pos_y));
    }
    else
    {
      if ((bigmap_mapWidth - DEVICE_SCREEN_WIDTH) > map_pos_x)
      {
        set_submap_rows(
          update_column_right(map_pos_x),
          map_pos_y,
          1,
          MIN(DEVICE_SCREEN_HEIGHT + 1, bigmap_mapHeight - map_pos_y));
      }
    }
    old_map_pos_x = map_pos_x;
  }
  // set old camera position to current camera position
  old_camera_x = camera_x, old_camera_y = camera_y;
}

void init_camera(uint8_t x, uint8_t y) {

  // Set up tile data
  set_native_tile_data(0, bigmap_TILE_COUNT, bigmap_tiles);

  // Set up color palettes on GBC
  if (_cpu == CGB_TYPE) {
    set_bkg_palette(0, bigmap_PALETTE_COUNT, bigmap_palettes);
  }

  // Initial camera position in pixels set here.
  camera_x = x;
  camera_y = y;
  // Enforce map limits on initial camera position
  if (camera_x > camera_max_x) camera_x = camera_max_x;
  if (camera_y > camera_max_y) camera_y = camera_max_y;
  old_camera_x = camera_x; old_camera_y = camera_y;

  map_pos_x = camera_x >> 3;
  map_pos_y = camera_y >> 3;
  old_map_pos_x = old_map_pos_y = 255;
  move_bkg(camera_x, WRAP_SCROLL_Y(camera_y));

  // Draw the initial map view for the whole screen
  set_submap_rows(
    map_pos_x,
    map_pos_y,
    MIN(DEVICE_SCREEN_WIDTH + 1u, bigmap_mapWidth - map_pos_x),
    MIN(DEVICE_SCREEN_HEIGHT + 1u, bigmap_mapHeight - map_pos_y));

  redraw = 0;

  move_bkg(camera_x, WRAP_SCROLL_Y(camera_y));
}

void main(void){
  DISPLAY_OFF;
  init_camera(0, 0);

  SHOW_BKG;
  DISPLAY_ON;
  while (1) {
    joy = joypad();
    // up or down
    if (joy & J_UP) {
      if (camera_y) {
        camera_y--;
        redraw = 1;
      }
    } else if (joy & J_DOWN) {
      if (camera_y < camera_max_y) {
        camera_y++;
        redraw = 1;
      }
    }
    // left or right
    if (joy & J_LEFT) {
      if (camera_x) {
        camera_x--;
        redraw = 1;
      }
    } else if (joy & J_RIGHT) {
      if (camera_x < camera_max_x) {
        camera_x++;
        redraw = 1;
      }
    }
    if (redraw) {
      wait_vbl_done();
      set_camera();
      redraw = 0;
    } else wait_vbl_done();
  }
}
