
const char const str[] = "HELLO WORLD!";

int global = 0x1234;
int global2 = 0x123456;

#define VIDBASE ((int*)0x4000080)

int vidbuf[160*128];

int main() {
  *VIDBASE = (int)vidbuf;
  global += str[0];
  global++;
  global2++;
  int c = 0xff880000;
  c += str[0];
  int* p = (int*) vidbuf;
  for (int i=0; i<160*128; i++) {
    p[i] = c++;
  }
  return 0;
}


