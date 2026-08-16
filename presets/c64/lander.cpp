#include <c64/joystick.h>
#include <c64/vic.h>
#include <c64/sprites.h>
#include <stdlib.h>
#include <string.h>

byte landersprites[] = {
#embed "landersprites.bin"  
};

// Screen and color ram address

#define Screen ((byte *)0x0400)
#define Color ((byte *)0xd800)

struct Lander
{
  float  px, py, vx, vy;
};

enum GameState
{
  GS_READY,    // Getting ready
  GS_PLAYING,    // Playing the game
  GS_LANDED,    // Landed on pad
  GS_COLLIDE    // Collided with something
};

// State of the game
struct Game
{
  GameState  state;  
  byte       count;
  Lander     lander;  // use an array for multiplayer

}  TheGame;  // Only one game, so global variable

// Put one  char on screen
inline void screen_put(byte x, byte y, char ch, char color)
{
  __assume(y < 25);

  Screen[40 * y + x] = ch;
  Color[40 * y + x] = color;
}

// Get one char from screen
inline char screen_get(byte x, byte y)
{
  __assume(y < 25);

  return Screen[40 * y + x];
}

void screen_init(void)
{
  // Fill screen with spaces
  memset(Screen, ' ', 1000);

  for(char i=0; i<100; i++)
    screen_put(rand() % 40, rand() % 25, '.', VCOL_WHITE);

  sbyte  height[41];
  for(char i=0; i<41; i+=8)
    height[i] = 4 + rand() % 16;

  for(char step = 8; step > 1; step /= 2)
  {
    for(char i=0; i<40; i+=step)
    {
      char  p = (height[i] + height[i + step]) >> 1;
      p += rand() % step - (step / 2);
      height[i + step / 2] = p;
    }
  }

  char xp = 2 + rand() % 33;
  char yp = height[xp];
  for(char i=1; i<4; i++)
    if (height[xp + i] < yp)
      yp = height[xp + i];

  for(char i=0; i<4; i++)
    height[xp + i] = yp;

  for(char x=0; x<40; x++)
  {
    char h = height[x];
    for(char y=0; y<h; y++)
      screen_put(x, 24 - y, 160, VCOL_YELLOW);
  }


  for(char i=0; i<4; i++)
  {
    screen_put(xp + i, 24 - yp, 128 + 86, VCOL_MED_GREY);
    screen_put(xp + i, 23 - yp, 100, VCOL_WHITE);
  }

}

void lander_init(Lander * lander)
{
  lander->px = 160;
  lander->py = 50;
  lander->vx = 0;
  lander->vy = 0;

  spr_set(0, true, (int)lander->px, (int)lander->py, 0x0380 / 64, VCOL_DARK_GREY, false, false, false);
  spr_set(1, true, (int)lander->px, (int)lander->py, 0x0340 / 64, VCOL_LT_GREY, true, false, false);
  spr_set(2, false, (int)lander->px, (int)lander->py + 20, 0x03c0 / 64, VCOL_WHITE, false, false, false);
}  

char ExhaustColor[] = {VCOL_YELLOW, VCOL_WHITE, VCOL_ORANGE, VCOL_LT_BLUE};

void lander_move(Lander * lander, sbyte jx, sbyte jy)
{
  lander->px += lander->vx;
  lander->py += lander->vy;
  lander->vx += jx * 0.02;
  lander->vy += jy * 0.1 + 0.01;
}

void lander_show(Lander * lander, sbyte jx, sbyte jy)
{
  //vic.color_border++;

  int  ix = (int)lander->px, iy = (int)lander->py;

  spr_move(0, ix, iy);
  spr_move(1, ix, iy);
  if (jy < 0)
  {
    spr_move(2, ix, iy + 20);
    spr_color(2, ExhaustColor[rand() & 3]);
    spr_show(2, true);
  }
  else
    spr_show(2, false);

  //vic.color_border--;
}

void lander_flash(Lander * lander, char c)
{
  spr_color(0, rand() & 1);
}

enum LanderCollision
{
  LCOL_FREE,
  LCOL_GROUND,
  LCOL_PAD
};

LanderCollision lander_check(Lander * lander)
{
  sbyte  ix = (sbyte)((lander->px - 24) * 0.125);
  sbyte  iy = (sbyte)((lander->py - 29) * 0.125);

  if (iy > 24)
    return LCOL_GROUND;
  if (iy < 0)
    return LCOL_FREE;

  LanderCollision  col = LCOL_FREE;
  for(char i=0; i<4; i++)
  {
    if (ix >= 0 && ix < 40)
    {
      char ch = screen_get(ix, iy);
      if (ch == 160)
        return LCOL_GROUND;
      else if (ch == 128 + 86)
        col = LCOL_PAD;
    }
    ix++;
  }

  return col;
}

void game_state(GameState state)
{
  // Set new state
  TheGame.state = state;

  switch(state)
  {
  case GS_READY:
    // Clear the screen
    lander_init(&TheGame.lander);
    screen_init();
    TheGame.count = 32;
    break;

  case GS_PLAYING:
    break;

  case GS_LANDED:
    TheGame.lander.py = (sbyte)((TheGame.lander.py - 29) * 0.125) * 8 + 28;
    lander_show(&TheGame.lander, 0, 0);
    TheGame.count = 16;
    break;

  case GS_COLLIDE:
    TheGame.count = 32;
    lander_show(&TheGame.lander, 0, 0);
    break;
  }
}

// Main game loop, invoked every vsync
void game_loop(void)
{
  switch (TheGame.state)
  {
  case GS_READY:
    // Countdown ready to start
    if (!--TheGame.count)
      game_state(GS_PLAYING);
    break;
  case GS_PLAYING:
  {
    // Check player input on every frame
    joy_poll(0);
    lander_move(&TheGame.lander, joyx[0], joyy[0]);
    LanderCollision col = lander_check(&TheGame.lander);
    if (col == LCOL_GROUND)
      game_state(GS_COLLIDE);
    else if (col == LCOL_PAD)
      game_state(GS_LANDED);
    else
      lander_show(&TheGame.lander, joyx[0], joyy[0]);
  }  break;
  case GS_LANDED:
    if (!--TheGame.count)
      game_state(GS_READY);
    break;
  case GS_COLLIDE:
    lander_flash(&TheGame.lander, TheGame.count);
    if (!--TheGame.count)
      game_state(GS_READY);
    break;
  }

}



int main(void)
{  
  // Screen color to black
  vic.color_border = VCOL_BLACK;
  vic.color_back = VCOL_BLACK;

  vic.spr_mcolor0 = VCOL_MED_GREY;
  vic.spr_mcolor1 = VCOL_YELLOW;

  memcpy((char *)0x0340, landersprites, 192);

  spr_init(Screen);

  // Start the game in ready state  
  game_state(GS_READY);

  // Forever
  for(;;)
  {
    // One game loop iteration
    game_loop();

    // Wait one vsync
    vic_waitFrame();
  }

  // Never reached
  return 0;
}
