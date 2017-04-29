unsigned int lfsr = 1;

unsigned int rand() {
  char lsb = lfsr & 1;
  lfsr >>= 1;
  if (lsb) lfsr ^= 0xd400;
  return lfsr;
}
