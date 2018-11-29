#ifndef CVU_SOUND_H
#define CVU_SOUND 1

#include <stdint.h>

#include "cv_sound.h"

extern const uint16_t CVU_TUNING_ISO16_EQUAL[15];	// ISO 16 pitch (A at 440 Hz) with equal tuning.
extern const uint16_t CVU_TUNING_SCIENTIFIC_EQUAL[15];	// Scientific pitch (C at 256 Hz) with equal tuning.

extern const uint8_t CVU_VOLUME_DEFAULT[4];

extern const uint16_t CVU_EMPTY_MUSIC;

// channel holds the channel that will be used to play the music.
// volume is a pointer to an array of loudnesses in Dezibel for p, mp, mf, f.
// tuning is a pointer to an arrays of frequency dividers for the halftones of oktave 0.
// sixteenth_notes_per_second should explain itself.
// notes is a pointer to the music in the following format:
// Every note cosists of 16 bits. The most significant four mark the octave, the next 4
// the halftone (0xf means pause) the next 4 bits give the absolute length. The next 2
// give the relative length. the last 2 bits are the loudness.
// The rest of the structure's members are for internal use by cvu_play_music().
struct cvu_music
{
	enum cv_soundchannel channel;
	const uint8_t *volume;
	const uint16_t *tuning;
	uint8_t sixteenth_notes_per_second;
	const uint16_t *notes;
	
	uint16_t note_ticks_remaining;
	uint16_t pause_ticks_remaining;
};

// This will initialize a cvu_music structure with default values for all
// members except notes.
extern void cvu_init_music(struct cvu_music *music);

// This function should be placed inside the vint handler or triggered by the vint handler.
// It will return false once it is finished playing the music.
extern bool cvu_play_music(struct cvu_music *restrict music);

#endif

