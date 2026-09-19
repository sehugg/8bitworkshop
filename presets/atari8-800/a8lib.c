/*
 * a8lib.c - helper library for cc65 Atari 8-bit programming.
 * See a8lib.h for the interface and libdemo.c for an example.
 */

#include "a8lib.h"

/*==========================================================================*/
/* Display list builder                                                     */
/*==========================================================================*/

/* Make sure this array doesn't cross a 1K boundary */
#ifdef __CC65__
/* we really should use a custom .cfg file with the align attribute */
/* but let's just put it here and maybe no one will notice */
#if defined(__ATARI5200__)
byte* a8_dlist = (byte*)0x1700;
#else
byte* a8_dlist = (byte*)0x9700;
#endif
#else
byte a8_dlist[256];
#pragma align(a8_dlist, 0x100)
#endif

byte  a8_dlist_len;
byte  a8_dli_count;
byte a8_dli_lines = 1;    /* DLI bits in the installed list */
byte a8_dmactl_val = 0x22;   /* playfield normal + DMA fetch */

void a8_set_dmactl(byte v) {
  a8_dmactl_val = v;
  A8_SDMCTL = v;
  ANTIC.dmactl = v;
}

void a8_dlist_reset(void) {
  a8_dlist_len = 0;
  a8_dli_count = 0;
  a8_dli_lines = 1;
  // TODO: a8_dli_clear();
  // TODO: a8_scroll_reset();
}

void a8_dlist_byte(byte b) {
  a8_dlist[a8_dlist_len++] = b;
}

void a8_dlist_blank(byte n) {
  if (n < 1) n = 1;
  while (n > 8) {
    a8_dlist_byte(0x70);   /* DL_BLK8 */
    n -= 8;
  }
  a8_dlist_byte((byte)((n - 1) << 4));
}

byte a8_dlist_line(byte mode, const void* data, byte dli) {
  byte idx = 0xff;
  if (dli) {
    mode = DL_DLI(mode);
    idx = a8_dli_count;
    if (a8_dli_count < 0xff) a8_dli_count++;
  }
  if (data) mode = DL_LMS(mode);
  a8_dlist_byte(mode);
  if (data) {
    word a = (word)data;
    a8_dlist_byte((byte)(a & 0xff));
    a8_dlist_byte((byte)(a >> 8));
  }
  return idx;
}

void a8_dlist_finish(void) {
  word a = (word)a8_dlist;
  a8_dlist_byte(DL_JVB);
  a8_dlist_byte((byte)(a & 0xff));
  a8_dlist_byte((byte)(a >> 8));
  /* One DLI fires per frame for each flagged line, so wrapping the
     dispatch index at this count keeps it in phase without a VBI hook. */
  a8_dli_lines = a8_dli_count ? a8_dli_count : 1;
}

void a8_dlist_install(void) {
  word a = (word)a8_dlist;
#if defined(__ATARI5200__)
  *(byte*)A8_SDLSTL_ADDR = (byte)(a & 0xff);
  *(byte*)A8_SDLSTH_ADDR = (byte)(a >> 8);
#else
#ifdef __CC65__
  OS.sdlstl = (byte)(a & 0xff);
  OS.sdlsth = (byte)(a >> 8);
#else
  OS._sdl._st.stl = (byte)(a & 0xff);
  OS._sdl._st.sth = (byte)(a >> 8);
#endif
#endif
  ANTIC.dlistl = (byte)(a & 0xff);
  ANTIC.dlisth = (byte)(a >> 8);
  a8_set_dmactl(0x22);
  a8_waitvsync();
}

void a8_dlist_off(void) {
  a8_set_dmactl(0x00);
}

void a8_set_playfield_width(byte w) {
  a8_set_dmactl((byte)((a8_dmactl_val & ~0x03) | (w & 0x03)));
}


/*==========================================================================*/
/* Colors                                                                   */
/*==========================================================================*/

void a8_set_colpf(byte i, byte c) {
  if (i > 3) i = 3;
  ((byte*)&GTIA_WRITE.colpf0)[i] = c;
  A8_SHDW_PF[i] = c;
}

void a8_set_colbk(byte c) {
  GTIA_WRITE.colbk = c;
  A8_SHDW_BK = c;
}

void a8_set_colpm(byte i, byte c) {
  if (i > 3) i = 3;
  ((byte*)&GTIA_WRITE.colpm0)[i] = c;
  A8_SHDW_PM[i] = c;
}


/*==========================================================================*/
/* Input and utility                                                        */
/*==========================================================================*/

byte a8_get_console(void) {
  return GTIA_READ.consol;
}

byte a8_get_trigger(byte n) {
  return (byte)(((byte*)&GTIA_READ.trig0)[n] & 1 ? 0 : 1);
}

#if !defined(__ATARI5200__)
byte a8_get_stick(byte n) {
  byte v = n ? PIA.portb : PIA.porta;
  return (byte)((~v) & 0x1f);
}
#endif

void a8_waitvsync(void) {
#if __CC65__
  waitvsync();
#else
#if defined(__ATARI5200__)
  volatile byte* rtc = (volatile byte*)0x0002;  /* RTCLOK+1 */
#else
  volatile byte* rtc = &OS.rtclok[2];           /* frame counter */
#endif
  byte t = *rtc;
  while (*rtc == t) ;
#endif
}
