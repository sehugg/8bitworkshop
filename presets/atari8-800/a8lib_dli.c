
#include <string.h>
#include "a8lib.h"

/*==========================================================================*/
/* DLI                                                                      */
/*==========================================================================*/

/* reg,val pairs terminated by A8_DLI_NONE in the reg slot */
byte a8_dli_tab[A8_DLI_LINES][A8_DLI_WRITES * 2];
byte a8_dli_line;
void (*a8_dli_hook)(void);

void a8_dli_clear(void) {
  memset(a8_dli_tab, 0xff, sizeof(a8_dli_tab));
  a8_dli_line = 0;
}

void a8_dli_set(byte line, byte reg, byte val) {
  byte j;
  byte* dli_line = a8_dli_tab[line];
  if (line >= A8_DLI_LINES) return;
  for (j = 0; j < A8_DLI_WRITES; j++) {
    if (*dli_line == 0xff) {
      dli_line[0] = reg;
      dli_line[1] = val;
      return;
    }
    dli_line += 2;
  }
}

void a8_dli_install(void) {
  a8_dli_line = 0;
  A8_VDSLST = a8_dli_stub;
  ANTIC.nmien = NMIEN_VBI | NMIEN_DLI;
}

void a8_dli_remove(void) {
  ANTIC.nmien = NMIEN_VBI;
}

#ifdef __OSCAR64C__
__hwinterrupt void a8_dli_stub() {
  if (a8_dli_line >= a8_dli_lines) a8_dli_line = 0;
  byte* w = &a8_dli_tab[a8_dli_line][0];
  for (byte i = 0; i < A8_DLI_WRITES; i++) {
    byte r = w[0];
    if (r == 0xff) break;
    void* base = r & 0x80 ? (void*)&ANTIC : (void*)&GTIA_WRITE;
    ((byte*)base)[r & 0x1f] = w[1];
    w += 2;
  }
  music_duty();
  a8_dli_line++;
}
#endif

