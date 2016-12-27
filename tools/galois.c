
/* test of 16-bit Galois LFSR */

#include "stdio.h"

int main()
{
    int n = 100;
    unsigned short x = 1;
    for (int i=0; i<n; i++) {
        int c = x&1;
        x >>= 1;
        if (c) x ^= 0xd400; // 0b1101010000000000
        printf("%4x\n", x);
    }
    for (int i=0; i<n; i++) {
        int c = x&0x8000;
        x <<= 1;
        if (c) x ^= 0xa801;
        printf("%4x\n", x);
    }
    return 0;
}
