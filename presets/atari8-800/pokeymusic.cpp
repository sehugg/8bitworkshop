/*
 * pokeymusic.cpp - POKEY music player for the Atari 8-bit.
 *
 * oscar64 C++ port of pokeymusic.ca65.  It exports the same entry points
 * that common.h declares, so an oscar64 program can link this file instead
 * of the ca65 original:
 *
 *   //#link "pokeymusic.cpp"
 *   music_start(song);
 *   // call music_tick() and music_duty() from an interrupt
 *
 * The ca65 version parks its song pointer in zero page ($fe) because cc65's
 * set_irq() saves and restores the whole zero page.  Here it is an ordinary
 * static pointer, so it survives an oscar64 __interrupt routine untouched.
 */

typedef unsigned char byte;

/* POKEY registers: the 800 decodes POKEY at $d2xx, the 5200 at $e8xx. */
#if defined(__ATARI5200__)
#define A8_AUDF   ((volatile byte*)0xe800)
#define A8_AUDC   ((volatile byte*)0xe801)
#define A8_AUDCTL (*(volatile byte*)0xe808)
#else
#define A8_AUDF   ((volatile byte*)0xd200)
#define A8_AUDC   ((volatile byte*)0xd201)
#define A8_AUDCTL (*(volatile byte*)0xd208)
#endif

/* Player state.  volatile because the music interrupt writes it while the
   main program reads it (e.g. through music_get_ptr / music_is_done). */
static volatile byte chan_dur[4];    /* current note duration per channel */
static volatile byte chan_note[4];   /* current note pitch per channel */
static volatile byte chan_duty[4];   /* current duty-cycle bits per channel */
static volatile byte duration_timer; /* ticks until the next command */
static volatile byte cur_channel;    /* next channel to add a note */
static volatile byte volume;         /* volume of a new note */

static const byte* volatile song_ptr; /* next byte in the song data */
static const byte* volatile song_rts; /* return address after a back-reference */
static volatile byte song_runlen;     /* bytes left in a back-reference */

/* Decode the next song byte, expanding 0xfe back-references.
   0xfe <offset> <length>: repeat <length> bytes starting
   <offset> bytes before the 0xfe marker. */
static byte next_music_byte(void)
{
  byte ch = *song_ptr++;
  if (song_runlen) {
    /* we are in a back-reference, count down */
    if (--song_runlen == 0) {
      song_ptr = song_rts;
      song_rts = nullptr;
    }
  } else if (ch == 0xfe) {
    byte offset = *song_ptr++;
    song_runlen = *song_ptr++;
    song_rts = song_ptr;
    song_ptr -= offset + 3;
    return next_music_byte();
  }
  return ch;
}

/* AUDF base value for each note (0-63). */
static const byte freqz[64] = {
  254, 254, 254, 255, 240, 227, 214, 202,
  190, 180, 169, 160, 151, 142, 134, 127,
  119, 113, 106, 100,  94,  89,  84,  79,
   75,  70,  66,  63,  59,  56,  52,  49,
   47,  44,  41,  39,  37,  34,  32,  31,
   29,  27,  25,  24,  23,  21,  20,  19,
   18,  17,  16,  15,  14,  13,  12,  11,
   11,  10,   9,   9,   8,   8,   7,   7
};

/* Duty-cycle rotation bits for each note. */
static const byte dutyz[64] = {
    0,   0,   0,   0, 181,   1,  17,   1,
  219,   0, 239,  17,  17, 181, 181,   0,
  239,   0, 181, 181, 239,  85,  73, 181,
    1, 239, 219,   0,  73,   0, 239, 219,
    0,  17, 219,  73,   0, 239, 239,   0,
   17,  85, 239,  73,   0, 181,  73,   1,
    0,   0,   0,   0,   1,  17,  85, 219,
    0,  73, 181,   1,  85,   0,  85,   0
};

/* Load a new note onto a channel. */
static void music_do_note(byte chan, byte note)
{
  chan_note[chan] = freqz[note];
  chan_duty[chan] = dutyz[note];
  chan_dur[chan]  = volume;
}

/* Hook called at end of song; present in the ca65 version as a stub. */
static void music_done(void)
{
}

/* Rotate each channel's duty bits and fold the bit that falls off the top
   into AUDF, which gives the notes their pulse-width flavour. */
/*
void music_duty(void)
{
  byte y = 0;
  for (byte x = 4; x-- != 0; y += 2) {
    if (chan_dur[x] != 0) {
      byte d = chan_duty[x];
      byte c = (byte)(d >> 7);
      chan_duty[x] = (byte)((d << 1) | c);
      if (chan_note[x] != 0)
        A8_AUDF[y] = (byte)(chan_note[x] + c);
    }
  }
}
*/
void music_duty(void) {
  __asm {
        ldx     #3
        ldy     #0
loop:
        lda     chan_dur,x
        beq     notplaying
        lda     chan_duty,x
        asl
        bcc     nobit
        ora     #1
nobit:
        sta     chan_duty,x
        lda     chan_note,x
        beq     notplaying
// If next bit is set, add 1 to AUDF0
        adc     #0
#if defined(__ATARI5200__)
        sta     $e800,y
#else
        sta     $d200,y
#endif
notplaying:
        iny
        iny
        dex
        bpl     loop
        rts
  }
}

/* Decrement the per-channel volumes and the next-note timer, and pull the
   next command out of the song when the timer runs out. */
void music_tick(void)
{
  byte y = 0;
  for (byte x = 4; x-- != 0; y += 2) {
    if (chan_dur[x] != 0) {
      A8_AUDC[y] = (byte)((chan_dur[x] >> 1) | 0xa0);
      chan_dur[x]--;
    }
  }

  if (duration_timer & 0x80)
    return;                       /* end of song, stop fetching */
  if (duration_timer != 0) {
    duration_timer--;
    return;
  }

  /* Timer expired: consume note bytes until a duration byte shows up. */
  for (;;) {
    byte b = next_music_byte();
    if (b & 0x80) {
      if (b == 0xff) {
        duration_timer = b;       /* stays $ff so music_is_done() is true */
        music_done();
        return;
      }
      duration_timer = (byte)(b & 0x7f);
      return;
    }
    music_do_note(cur_channel, b);
    cur_channel = (byte)((cur_channel + 1) & 3);
  }
}

/* Start playing the song at song. */
void music_start(const char* song)
{
  song_ptr = (const byte*)song;
  song_rts = nullptr;
  song_runlen = 0;
  volume = 24;
  duration_timer = 0;
  cur_channel = 0;
  for (byte x = 4; x-- != 0; )
    chan_dur[x] = 0;
  A8_AUDCTL = 0x01;
}

/* Current position in the song data. */
char* music_get_ptr(void)
{
  return (char*)song_ptr;
}

/* Nonzero once the song reaches its $ff terminator. */
char music_is_done(void)
{
  return (duration_timer & 0x80) ? 1 : 0;
}
