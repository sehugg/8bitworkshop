#ifndef CV_INPUT_H
#define CV_INPUT_H 1

#include <stdint.h>

#ifndef CV_SMS

#define CV_FIRE_0 0x40
#define CV_FIRE_1 0x80
#define CV_FIRE_2 0x10
#define CV_FIRE_3 0x20
#define CV_LEFT 0x08
#define CV_DOWN 0x04
#define CV_RIGHT 0x02
#define CV_UP 0x01

#else

#define CV_UP 0x01
#define CV_DOWN 0x02
#define CV_LEFT 0x04
#define CV_RIGHT 0x08
#define CV_FIRE_0 0x10
#define CV_FIRE_1 0x20

#endif

struct cv_controller_state
{
	uint8_t keypad;	// Keypad: 0 - 9 as on keypad, * as 0xa, # as 0xb, 0xf for no key pressed or error.
	uint8_t joystick;// Joystick: lowest 4 bit for joystick, higher 4 bit for fire buttons.	
};

// Get keypad and joystick values.
void cv_get_controller_state(struct cv_controller_state *state, uint_fast8_t controller);

#define CV_SPIN_ACTIVE 0x10
#define CV_SPIN_RIGHT 0x20

// Set the handler for the spinner interrupt.
// This handler will be called when the wheel on the super action controller or the ball in the roller controller spin.
// The parameters passed to the handler correspond to the two super action controllers or
// the two axis in the roller controller. They can be anded with the above masks to test if they spinned, and which direction.
void cv_set_spint_handler(void (* handler)(uint_fast8_t, uint_fast8_t));

#endif

