/*
Hi-res (280x192, 6 colors) TGI demo for the Apple ][.
Four full-screen animations; press a key to switch to the next (ESC quits):
  a Lissajous line figure, a swirl of dots, random lines, random bars.
Each shape is remembered in a ring buffer; when the buffer wraps, the
oldest shape is erased, so the picture keeps moving.
Uses our own hi-res TGI driver, a2hires.s (the stock one needs
Applesoft ROM routines). apple2-hgr2.cfg keeps $2000-$5FFF free.
*/
#include <stdlib.h>
#include <cc65.h>
#include <conio.h>
#include <tgi.h>
#include "a2hires.h"
//#link "a2hires.s"
//#tooldef ld cfgfile=apple2-hgr2.cfg
//#resource "apple2-hgr2.cfg"

#define W       280             // screen size
#define H       192
#define R       (H/2 - 4)       // radius of the figures
#define MAXSEG  240

// hi-res colors: 1 green, 2 violet, 5 orange, 6 blue
static const unsigned char Colors[4] = { 1, 2, 5, 6 };

#define SIN(a)  _sin((unsigned)(a) % 360)
#define COS(a)  _sin(((unsigned)(a) + 90) % 360)

typedef struct {
    int x1, y1, x2, y2;
    unsigned char color;
} Seg;

static Seg ring[MAXSEG];        // the shapes currently on screen
static unsigned head;           // next slot to overwrite
static unsigned count;          // slots in use
static unsigned T;              // time, advances every step
static unsigned char mode;
static const unsigned ringsize[4] = { 40, 240, 70, 14 };

// scale a sine value (-256..256) to -R..R
static int scale(int v)
{
    return (int)(((long)v * R) / 256);
}

static unsigned char randcolor(void)
{
    return Colors[rand() & 3];
}

// draw (or, with color 0, erase) one shape for the current mode
static void draw(const Seg* s, unsigned char color)
{
    int cx = W/2, cy = H/2;
    tgi_setcolor(color);
    switch (mode) {
    case 0:     // line, mirrored four ways
        tgi_line(cx + s->x1, cy + s->y1, cx + s->x2, cy + s->y2);
        tgi_line(cx - s->x1, cy + s->y1, cx - s->x2, cy + s->y2);
        tgi_line(cx + s->x1, cy - s->y1, cx + s->x2, cy - s->y2);
        tgi_line(cx - s->x1, cy - s->y1, cx - s->x2, cy - s->y2);
        break;
    case 1:     // dot
        tgi_setpixel(s->x1, s->y1);
        break;
    case 2:     // line
        tgi_line(s->x1, s->y1, s->x2, s->y2);
        break;
    case 3:     // bar
        tgi_bar(s->x1, s->y1, s->x2, s->y2);
        break;
    }
}

// Lissajous lines
static void make_lissajous(Seg* s)
{
    unsigned a = T * 2;
    s->x1 = scale(SIN(a * 3)) * 3/2;
    s->y1 = scale(COS(a * 2));
    s->x2 = scale(COS(a * 5 + T)) * 3/2;
    s->y2 = scale(SIN(a * 4));
    s->color = Colors[(T >> 4) & 3];
}

// dots on a wandering rose curve
static void make_swirl(Seg* s)
{
    unsigned a = T * 7;
    int r = scale(SIN(a * 5 + T / 2)) + scale(COS(a * 3)) / 2;
    s->x1 = W/2 + r * COS(a) / 128;
    s->y1 = H/2 + r * SIN(a) / 256;
    s->color = Colors[(a / 90) & 3];
}

// random horizontal and vertical lines
static void make_hatch(Seg* s)
{
    int x = rand() % W;
    int y = rand() % H;
    int len = 4 + rand() % 60;
    s->x1 = s->x2 = x;
    s->y1 = s->y2 = y;
    if (rand() & 1) {
        s->x2 = x + len < W ? x + len : W - 1;
    } else {
        s->y2 = y + len < H ? y + len : H - 1;
    }
    s->color = randcolor();
}

// random filled bars
static void make_bar(Seg* s)
{
    int x = rand() % (W - 8);
    int y = rand() % (H - 4);
    int w = 8 + rand() % (W/2);
    int h = 4 + rand() % 24;
    s->x1 = x;
    s->y1 = y;
    s->x2 = x + w < W ? x + w : W - 1;
    s->y2 = y + h < H ? y + h : H - 1;
    s->color = randcolor();
}

// add one shape, erasing the oldest if the ring is full
static void step(void)
{
    Seg* s = &ring[head];
    unsigned size = ringsize[mode];
    if (count == size) {
        draw(s, TGI_COLOR_BLACK);
    } else {
        count++;
    }
    switch (mode) {
    case 0: make_lissajous(s); break;
    case 1: make_swirl(s); break;
    case 2: make_hatch(s); break;
    case 3: make_bar(s); break;
    }
    draw(s, s->color);
    if (++head == size) head = 0;
    T++;
}

int main(void)
{
    tgi_install(a2hires_tgi);
    tgi_init();
    for (;;) {
        tgi_clear();
        head = count = T = 0;
        while (!kbhit()) {
            step();
            if (mode == 1) { step(); step(); step(); }
        }
        if (cgetc() == 27) break;
        mode = (mode + 1) & 3;
    }
    tgi_uninstall();
    return 0;
}
