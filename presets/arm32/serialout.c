
#define SERIAL_OUT ((int*)0x4000048)

void putchar_(char c) {
  *SERIAL_OUT = c;
}

