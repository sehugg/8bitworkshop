#ifndef CVU_C_H
#define CVU_C_H 1

#include "cvu_f.h"

// Complex fixed-point type
struct cvu_c
{
	cvu_f r;
	cvu_f i;
};

// Addition
//extern void cadd(struct c *l, const struct c *r);
#define cvu_cadd(x, y) {(x)->r += (y)->r; (x)->i += (y)->i;}

// Subtraction
//extern void csub(struct c *l, const struct c *r);
#define cvu_csub(x, y) {(x)->r -= (y)->r; (x)->i -= (y)->i;}

// Multiplication
extern void cvu_cmul(struct cvu_c *l, const struct cvu_c *r);

// Very inaccurate approximation
extern cvu_f cvu_cabs(const struct cvu_c *l);

// Dot product: Returns l.r^2 + l.i^2
extern cvu_f cvu_cdot(const struct cvu_c *l);

// Multiplication by fixed-point number.
extern void cvu_cfmul(struct cvu_c *l, cvu_f r);

// Convert from polar to coordinate representation
extern void cvu_c_from_polar(struct cvu_c *c, cvu_f phi, cvu_f d);

#endif

