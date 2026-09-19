
#ifdef __CC65__
#include <6502.h>
#endif
#include "a8lib.h"

/*==========================================================================*/
/* POKEY                                                                    */
/*==========================================================================*/

static byte a8_irq_stack[128];

void a8_pokey_init(void) {
  POKEY_WRITE.skctl = SKCTL_KEYBOARD_DEBOUNCE | SKCTL_KEYBOARD_SCANNING;
  POKEY_WRITE.audctl = AUDCTL_CLOCKBASE_15HZ;
  a8_pokey_stop_all();
}

void a8_pokey_sound(byte chan, byte freq, byte ctrl, byte vol) {
  byte* p = (byte*)&POKEY_WRITE.audf1 + (word)(chan << 1);
  p[0] = freq;
  p[1] = (byte)(ctrl | (vol & 0x0f));
}

void a8_pokey_stop(byte chan) {
  ((byte*)&POKEY_WRITE.audc1)[chan << 1] = 0;
}

void a8_pokey_stop_all(void) {
  byte i;
  for (i = 0; i < 4; i++) a8_pokey_stop(i);
}

#ifdef __CC65__
/* called from set_irq() */
unsigned char a8_pokey_music_update() {
  music_tick();
  music_duty();
  return IRQ_NOT_HANDLED;
}

void a8_pokey_music_init(void) {
  set_irq(a8_pokey_music_update, a8_irq_stack, sizeof(a8_irq_stack));
}

void a8_pokey_music_done(void) {
  reset_irq();
}
#endif

#ifdef __OSCAR64C__
void a8_pokey_music_update() {
  __asm { pha; txa; pha; tya; pha; } // save regs
  music_tick();
  music_duty();
  __asm { pla; tay; pla; tax; pla; } // restore regs
}

void a8_pokey_music_init(void) {
  OS.vvblki = a8_pokey_music_update;
}

void a8_pokey_music_done(void) {
  //reset_irq();
}
#endif

