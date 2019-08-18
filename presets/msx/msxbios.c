
/*
http://map.grauw.nl/resources/msxbios.php
http://map.grauw.nl/resources/msxsystemvars.php
https://www.msx.org/wiki/System_variables_and_work_area
*/

#include "msxbios.h"

#define MSXUSR_LOAD_A()		__asm__("ld a,l");
#define MSXUSR_LOAD_E()		__asm__("ld e,h");
#define MSXUSR_RTN_A()		__asm__("ld l,a");
#define MSXUSR_RTN_Z()\
  __asm__("ld l,#0");\
  __asm__("ret nz");\
  __asm__("inc l");
#define MSXUSR_RTN_C()\
  __asm__("ld l,#0");\
  __asm__("ret nc");\
  __asm__("inc l");


union {
  struct {
    uint16_t iy,ix,de,bc,af,hl;
  } w;
  struct {
    uint8_t iyl,iyh,ixl,ixh,e,d,c,b,f,a,l,h;
  } b;
} REGS;

void LOAD_REGS() {
  __asm__("ld de,(_REGS+4)");
  __asm__("ld bc,(_REGS+6)");
  __asm__("ld a,(_REGS+9)");
  __asm__("ld hl,(_REGS+10)");
  // TODO: load other regs?
}

#define MSXUSR_LOAD_REGS(bioscall)\
	LOAD_REGS();\
        MSXUSR(bioscall);

void RDSLT(uint8_t slot, uint16_t addr) {
  REGS.b.a = slot;
  REGS.w.hl = addr;
  MSXUSR_LOAD_REGS(0x000c);
}

void WRSLT(uint8_t slot, uint16_t addr, uint8_t value) {
  REGS.b.a = slot;
  REGS.w.hl = addr;
  REGS.b.e = value;
  MSXUSR_LOAD_REGS(0x0014);
}

void DISSCR() __z88dk_fastcall {
  MSXUSR(0x0041);
}

void ENASCR() __z88dk_fastcall {
  MSXUSR(0x0044);
}

void WRTVDP(uint16_t reg_data) __z88dk_fastcall {
  reg_data;
  __asm__("ld b,l");
  __asm__("ld c,h");
  MSXUSR(0x0047);
}

uint8_t RDVRM(uint16_t addr) __z88dk_fastcall {
  addr;
  MSXUSR(0x004a);
  MSXUSR_RTN_A();
}

void WRTVRM(uint16_t addr, uint8_t data) {
  REGS.w.hl = addr;
  REGS.b.a = data;
  MSXUSR_LOAD_REGS(0x004d);
}

void SETRD() {
  MSXUSR(0x0050);
}

void SETWRT() {
  MSXUSR(0x0053);
}

void FILVRM(uint16_t start, uint16_t len, uint8_t data) {
  REGS.w.hl = start;
  REGS.w.bc = len;
  REGS.b.a = data;
  MSXUSR_LOAD_REGS(0x0056);
}

void LDIRMV(uint8_t* mdest, uint16_t vsrc, uint16_t count) {
  REGS.w.de = (uint16_t)mdest;
  REGS.w.hl = vsrc;
  REGS.w.bc = count;
  MSXUSR_LOAD_REGS(0x0059);
}

void LDIRVM(uint16_t vdest, const uint8_t* msrc, uint16_t count) {
  REGS.w.de = vdest;
  REGS.w.hl = (uint16_t)msrc;
  REGS.w.bc = count;
  MSXUSR_LOAD_REGS(0x005c);
}

void CHGMOD(uint8_t mode) __z88dk_fastcall {
  mode;
  MSXUSR_LOAD_A();
  MSXUSR(0x005f);
}

void CHGCLR() __z88dk_fastcall {
  // TODO
  MSXUSR(0x0062);
}

void CLRSPR() __z88dk_fastcall {
  MSXUSR(0x0069);
}

void INITXT() __z88dk_fastcall {
  MSXUSR(0x006c);
}

void INIT32() __z88dk_fastcall {
  MSXUSR(0x006f);
}

void INIGRP() __z88dk_fastcall {
  MSXUSR(0x0072);
}

void INIMLT() __z88dk_fastcall {
  MSXUSR(0x0075);
}

uint16_t CALPAT() __z88dk_fastcall {
  MSXUSR(0x0084);
  MSXUSR_RTN_A();
}

uint16_t CALATR() __z88dk_fastcall {
  MSXUSR(0x0087);
  MSXUSR_RTN_A();
}

uint16_t GSPSIZ() __z88dk_fastcall {
  MSXUSR(0x008a);
  MSXUSR_RTN_A();
}

uint16_t GRPPRT(char ch) __z88dk_fastcall {
  ch;
  MSXUSR_LOAD_A();
  MSXUSR(0x008d);
}

uint16_t GICINI() __z88dk_fastcall {
  MSXUSR(0x0090);
}

uint16_t WRTPSG(uint16_t reg_data) __z88dk_fastcall {
  reg_data;
  MSXUSR_LOAD_A();
  MSXUSR_LOAD_E();
  MSXUSR(0x0096);
}

uint8_t CHSNS() __z88dk_fastcall {
  MSXUSR(0x009c);
  MSXUSR_RTN_Z();
}

char CHGET() __z88dk_fastcall {
  MSXUSR(0x009f);
  MSXUSR_RTN_A();
}

void CHPUT(char ch) __z88dk_fastcall {
  ch;
  MSXUSR_LOAD_A();
  MSXUSR(0x00a2);
}

void LPTOUT(char ch) __z88dk_fastcall {
  ch;
  MSXUSR_LOAD_A();
  MSXUSR(0x00a5);
}

void BEEP() __z88dk_fastcall {
  MSXUSR(0x00c0);
}

void CLS() __z88dk_fastcall {
  __asm__("xor a");
  MSXUSR(0x00c3);
}

void POSIT(uint16_t yx) __z88dk_fastcall {
  yx;
  MSXUSR(0x00c6);
}

void TOTEXT() __z88dk_fastcall {
  MSXUSR(0x00d2);
}

uint8_t GTSTCK(uint8_t index) __z88dk_fastcall {
  index;
  MSXUSR_LOAD_A();
  MSXUSR(0x00d5);
  MSXUSR_RTN_A();
}

uint8_t GTTRIG(uint8_t index) __z88dk_fastcall {
  index;
  MSXUSR_LOAD_A();
  MSXUSR(0x00d8);
  MSXUSR_RTN_A();
}

uint8_t GTPAD(uint8_t index) __z88dk_fastcall {
  index;
  MSXUSR_LOAD_A();
  MSXUSR(0x00db);
  MSXUSR_RTN_A();
}

uint8_t GTPDL(uint8_t index) __z88dk_fastcall {
  index;
  MSXUSR_LOAD_A();
  MSXUSR(0x00de);
  MSXUSR_RTN_A();
}

/*
void RIGHTC() __z88dk_fastcall {
  MSXUSR(0x00fc);
}

void LEFTC() __z88dk_fastcall {
  MSXUSR(0x00ff);
}

void UPC() __z88dk_fastcall {
  MSXUSR(0x0102);
}

uint8_t TUPC() __z88dk_fastcall {
  MSXUSR(0x0105);
  MSXUSR_RTN_C();
}

void DOWNC() __z88dk_fastcall {
  MSXUSR(0x0108);
}

uint8_t TDOWNC() __z88dk_fastcall {
  MSXUSR(0x010b);
  MSXUSR_RTN_C();
}

void SCALXY() __z88dk_fastcall {
  MSXUSR(0x010e);
}
*/

void MAPXY() __z88dk_fastcall {
  MSXUSR(0x0111);
}

uint16_t FETCHC_ADDR() __z88dk_fastcall {
  MSXUSR(0x0114);
}

/*
void STOREC(uint16_t addr, uint8_t mask) {
  REGS.w.hl = addr;
  REGS.b.a = mask;
  MSXUSR_LOAD_REGS(0x0117);
}

void SETATR(uint8_t attr) __z88dk_fastcall {
  attr;
  MSXUSR_LOAD_A();
  MSXUSR(0x011a);
}

uint8_t READC() __z88dk_fastcall {
  MSXUSR(0x011d);
  MSXUSR_RTN_A();
}

void SETC() __z88dk_fastcall {
  MSXUSR(0x0120);
}

void NSETCX(uint16_t fillcount) __z88dk_fastcall {
  fillcount;
  MSXUSR(0x0123);
}
*/

uint8_t RDVDP() __z88dk_fastcall {
  MSXUSR(0x013e);
  MSXUSR_RTN_A();
}

uint8_t SNSMAT(uint8_t row) __z88dk_fastcall {
  row;
  MSXUSR_LOAD_A();
  MSXUSR(0x0141);
  MSXUSR_RTN_A();
}

void KILBUF() __z88dk_fastcall {
  MSXUSR(0x0156);
}

// for stdio.h
int putchar(int ch) {
  CHPUT(ch);
  if (ch == '\n') CHPUT('\r'); // convert CR to CRLF
  return ch;
}
char getchar() {
  char ch = CHGET();
  putchar(ch); // echo
  if (ch == '\r') ch = '\n';
  return ch;
}
