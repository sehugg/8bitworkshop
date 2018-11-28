#ifndef CVU_INPUT_H
#define CVU_INPUT_H 1

#include <stdint.h>

#include "cv_input.h"

// For the super action controllers this gives the spinner movement (total relative movement since last call, negative for left, positive for right)
// For the roller controller this gives the ball movement (total relative as above).
// Using this function will set a libvu-specific spint handler, so it is incompatible with using a custom spint handler.

int_fast8_t cvu_get_spinner(uint_fast8_t controller);

#endif

