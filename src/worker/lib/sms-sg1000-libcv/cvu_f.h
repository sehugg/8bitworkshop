// Fixed-point math can be useful where e.g. smooth movement is desired, but
// using float would make the application too slow and big.
// cvu_f is a 10.6 fixed point type. 10.6 has been chosen to ensure that the
// type can represent coordinates on the ColecoVision screen and in some
// "buffer" space surrounding it (to allow calculation of e.g. reflection).

#ifndef CVU_F_H
#define CVU_F_H 1

#include <stdint.h>
#include <limits.h>

typedef int16_t cvu_f;	// 10.6 fixed-point type.

#define CVU_F_R 6

#define CVU_F_PI 201
#define CVU_F_PI_2 100
#define CVU_F_SQRT2 90
#define CVU_F_SQRT1_2 45
#define CVU_F_MIN INT16_MIN
#define CVU_F_MAX INT16_MAX

// Convert integer to fixed-point
#define CVU_F2I(l) ((l) >> CVU_F_R)

// Convert fixed-point to integer
#define CVU_I2F(l) ((l) << CVU_F_R)

// Fixed-point multiplication
extern cvu_f cvu_fmul2(cvu_f l, cvu_f r);

// Fixed-point division
extern cvu_f cvu_fdiv2(cvu_f l, cvu_f r);

// Fixed-point sine
extern cvu_f cvu_fsin(cvu_f x);

// Fixed-point cosine
extern cvu_f cvu_fcos(cvu_f x);

// Fixed-point arcus tangens of x / y.
extern cvu_f cvu_fatan2(cvu_f y, cvu_f x);

#endif

