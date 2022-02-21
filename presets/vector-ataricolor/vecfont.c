
#include "vecops.h"

#pragma rodata-name(push,"DVGROM")
const word VECFONT_32[] = { _SVEC(12,0,0), _RTSL() };
const word VECFONT_33[] = { _SVEC(4,0,0), _SVEC(-1,2,4), _SVEC(2,0,4), _SVEC(-1,-2,4), _SVEC(0,4,0), _SVEC(0,8,4), _SVEC(8,-12,0), _RTSL() };
const word VECFONT_34[] = { _SVEC(2,10,0), _SVEC(0,-4,4), _SVEC(4,4,0), _SVEC(0,-4,4), _SVEC(6,-6,0), _RTSL() };
const word VECFONT_35[] = { _SVEC(0,4,0), _SVEC(8,0,4), _SVEC(-2,-2,4), _SVEC(0,8,4), _SVEC(2,-2,4), _SVEC(-8,0,4), _SVEC(2,2,4), _SVEC(0,-8,4), _SVEC(10,-2,0), _RTSL() };
const word VECFONT_36[] = { _SVEC(6,2,0), _SVEC(-4,4,4), _SVEC(4,4,4), _SVEC(-2,2,0), _SVEC(0,-12,4), _SVEC(8,0,0), _RTSL() };
const word VECFONT_37[] = { _SVEC(0,0,0), _SVEC(8,12,4), _SVEC(-6,-2,0), _SVEC(0,-2,4), _SVEC(4,-4,0), _SVEC(0,-2,4), _SVEC(6,-2,0), _RTSL() };
const word VECFONT_38[] = { _SVEC(8,0,0), _SVEC(-4,12,4), _SVEC(4,-4,4), _SVEC(-8,-4,4), _SVEC(4,-4,4), _SVEC(4,4,4), _SVEC(4,-4,0), _RTSL() };
const word VECFONT_39[] = { _SVEC(0,12,0), _SVEC(8,-12,4), _SVEC(4,0,0), _RTSL() };
const word VECFONT_40[] = { _SVEC(6,0,0), _SVEC(-4,4,4), _SVEC(0,4,4), _SVEC(4,4,4), _SVEC(6,-12,0), _RTSL() };
const word VECFONT_41[] = { _SVEC(2,0,0), _SVEC(4,4,4), _SVEC(0,4,4), _SVEC(-4,4,4), _SVEC(10,-12,0), _RTSL() };
const word VECFONT_42[] = { _SVEC(0,0,0), _SVEC(4,12,4), _SVEC(4,-12,4), _SVEC(-8,8,4), _SVEC(8,0,4), _SVEC(-8,-8,4), _SVEC(12,0,0), _RTSL() };
const word VECFONT_43[] = { _SVEC(1,6,0), _SVEC(6,0,4), _SVEC(-3,3,0), _SVEC(0,-6,4), _SVEC(8,-3,0), _RTSL() };
const word VECFONT_44[] = { _SVEC(2,0,0), _SVEC(2,2,4), _SVEC(8,-2,0), _RTSL() };
const word VECFONT_45[] = { _SVEC(2,6,0), _SVEC(4,0,4), _SVEC(6,-6,0), _RTSL() };
const word VECFONT_46[] = { _SVEC(3,0,0), _SVEC(1,0,4), _SVEC(8,0,0), _RTSL() };
const word VECFONT_47[] = { _SVEC(0,0,0), _SVEC(8,12,4), _SVEC(4,-12,0), _RTSL() };
const word VECFONT_48[] = { _SVEC(0,0,0), _SVEC(8,0,4), _SVEC(0,12,4), _SVEC(-8,0,4), _SVEC(0,-12,4), _SVEC(8,12,4), _SVEC(4,-12,0), _RTSL() };
const word VECFONT_49[] = { _SVEC(4,0,0), _SVEC(0,12,4), _SVEC(-1,-2,4), _SVEC(9,-10,0), _RTSL() };
const word VECFONT_50[] = { _SVEC(0,12,0), _SVEC(8,0,4), _SVEC(0,-5,4), _SVEC(-8,-2,4), _SVEC(0,-5,4), _SVEC(8,0,4), _SVEC(4,0,0), _RTSL() };
const word VECFONT_51[] = { _SVEC(0,12,0), _SVEC(8,0,4), _SVEC(0,-12,4), _SVEC(-8,0,4), _SVEC(0,6,0), _SVEC(8,0,4), _SVEC(4,-6,0), _RTSL() };
const word VECFONT_52[] = { _SVEC(0,12,0), _SVEC(0,-6,4), _SVEC(8,0,4), _SVEC(0,6,0), _SVEC(0,-12,4), _SVEC(4,0,0), _RTSL() };
const word VECFONT_53[] = { _SVEC(0,0,0), _SVEC(8,0,4), _SVEC(0,6,4), _SVEC(-8,1,4), _SVEC(0,5,4), _SVEC(8,0,4), _SVEC(4,-12,0), _RTSL() };
const word VECFONT_54[] = { _SVEC(0,12,0), _SVEC(0,-12,4), _SVEC(8,0,4), _SVEC(0,5,4), _SVEC(-8,2,4), _SVEC(12,-7,0), _RTSL() };
const word VECFONT_55[] = { _SVEC(0,12,0), _SVEC(8,0,4), _SVEC(0,-6,4), _SVEC(-4,-6,4), _SVEC(8,0,0), _RTSL() };
const word VECFONT_56[] = { _SVEC(0,0,0), _SVEC(8,0,4), _SVEC(0,12,4), _SVEC(-8,0,4), _SVEC(0,-12,4), _SVEC(0,6,0), _SVEC(8,0,4), _SVEC(4,-6,0), _RTSL() };
const word VECFONT_57[] = { _SVEC(8,0,0), _SVEC(0,12,4), _SVEC(-8,0,4), _SVEC(0,-5,4), _SVEC(8,-2,4), _SVEC(4,-5,0), _RTSL() };
const word VECFONT_58[] = { _SVEC(4,9,0), _SVEC(0,-2,4), _SVEC(0,-2,0), _SVEC(0,-2,4), _SVEC(8,-3,0), _RTSL() };
const word VECFONT_59[] = { _SVEC(4,9,0), _SVEC(0,-2,4), _SVEC(0,-2,0), _SVEC(-3,-3,4), _SVEC(11,-2,0), _RTSL() };
const word VECFONT_60[] = { _SVEC(6,0,0), _SVEC(-4,6,4), _SVEC(4,6,4), _SVEC(6,-12,0), _RTSL() };
const word VECFONT_61[] = { _SVEC(1,4,0), _SVEC(6,0,4), _SVEC(-6,4,0), _SVEC(6,0,4), _SVEC(5,-8,0), _RTSL() };
const word VECFONT_62[] = { _SVEC(2,0,0), _SVEC(4,6,4), _SVEC(-4,6,4), _SVEC(10,-12,0), _RTSL() };
const word VECFONT_63[] = { _SVEC(0,8,0), _SVEC(4,4,4), _SVEC(4,-4,4), _SVEC(-4,-4,4), _SVEC(0,-3,0), _SVEC(0,-1,4), _SVEC(8,0,0), _RTSL() };
const word VECFONT_64[] = { _SVEC(8,4,0), _SVEC(-4,-4,4), _SVEC(-4,4,4), _SVEC(0,4,4), _SVEC(4,4,4), _SVEC(4,-4,4), _SVEC(-4,-4,4), _SVEC(-1,2,4), _SVEC(9,-6,0), _RTSL() };
const word VECFONT_65[] = { _SVEC(0,0,0), _SVEC(0,8,4), _SVEC(4,4,4), _SVEC(4,-4,4), _SVEC(0,-8,4), _SVEC(-8,4,0), _SVEC(8,0,4), _SVEC(4,-4,0), _RTSL() };
const word VECFONT_66[] = { _SVEC(0,0,0), _SVEC(0,12,4), _SVEC(4,0,4), _SVEC(4,-2,4), _SVEC(-4,-4,4), _SVEC(4,-4,4), _SVEC(-4,-2,4), _SVEC(-4,0,4), _SVEC(12,0,0), _RTSL() };
const word VECFONT_67[] = { _SVEC(8,0,0), _SVEC(-8,0,4), _SVEC(0,12,4), _SVEC(8,0,4), _SVEC(4,-12,0), _RTSL() };
const word VECFONT_68[] = { _SVEC(0,0,0), _SVEC(0,12,4), _SVEC(4,0,4), _SVEC(4,-4,4), _SVEC(0,-4,4), _SVEC(-4,-4,4), _SVEC(-4,0,4), _SVEC(12,0,0), _RTSL() };
const word VECFONT_69[] = { _SVEC(8,0,0), _SVEC(-8,0,4), _SVEC(0,12,4), _SVEC(8,0,4), _SVEC(-8,-6,0), _SVEC(6,0,4), _SVEC(6,-6,0), _RTSL() };
const word VECFONT_70[] = { _SVEC(0,0,0), _SVEC(0,12,4), _SVEC(8,0,4), _SVEC(-8,-6,0), _SVEC(6,0,4), _SVEC(6,-6,0), _RTSL() };
const word VECFONT_71[] = { _SVEC(6,6,0), _SVEC(2,-2,4), _SVEC(0,-4,4), _SVEC(-8,0,4), _SVEC(0,12,4), _SVEC(8,0,4), _SVEC(4,-12,0), _RTSL() };
const word VECFONT_72[] = { _SVEC(0,0,0), _SVEC(0,12,4), _SVEC(0,-6,0), _SVEC(8,0,4), _SVEC(0,6,0), _SVEC(0,-12,4), _SVEC(4,0,0), _RTSL() };
const word VECFONT_73[] = { _SVEC(0,0,0), _SVEC(8,0,4), _SVEC(-4,0,0), _SVEC(0,12,4), _SVEC(-4,0,0), _SVEC(8,0,4), _SVEC(4,-12,0), _RTSL() };
const word VECFONT_74[] = { _SVEC(0,4,0), _SVEC(4,-4,4), _SVEC(4,0,4), _SVEC(0,12,4), _SVEC(4,-12,0), _RTSL() };
const word VECFONT_75[] = { _SVEC(0,0,0), _SVEC(0,12,4), _SVEC(8,0,0), _SVEC(-8,-6,4), _SVEC(6,-6,4), _SVEC(6,0,0), _RTSL() };
const word VECFONT_76[] = { _SVEC(8,0,0), _SVEC(-8,0,4), _SVEC(0,12,4), _SVEC(12,-12,0), _RTSL() };
const word VECFONT_77[] = { _SVEC(0,0,0), _SVEC(0,12,4), _SVEC(4,-4,4), _SVEC(4,4,4), _SVEC(0,-12,4), _SVEC(4,0,0), _RTSL() };
const word VECFONT_78[] = { _SVEC(0,0,0), _SVEC(0,12,4), _SVEC(8,-12,4), _SVEC(0,12,4), _SVEC(4,-12,0), _RTSL() };
const word VECFONT_79[] = { _SVEC(0,0,0), _SVEC(0,12,4), _SVEC(8,0,4), _SVEC(0,-12,4), _SVEC(-8,0,4), _SVEC(12,0,0), _RTSL() };
const word VECFONT_80[] = { _SVEC(0,0,0), _SVEC(0,12,4), _SVEC(8,0,4), _SVEC(0,-6,4), _SVEC(-8,-1,4), _SVEC(12,-5,0), _RTSL() };
const word VECFONT_81[] = { _SVEC(0,0,0), _SVEC(0,12,4), _SVEC(8,0,4), _SVEC(0,-8,4), _SVEC(-8,-4,4), _SVEC(4,4,0), _SVEC(4,-4,4), _SVEC(4,0,0), _RTSL() };
const word VECFONT_82[] = { _SVEC(0,0,0), _SVEC(0,12,4), _SVEC(8,0,4), _SVEC(0,-6,4), _SVEC(-8,-1,4), _SVEC(4,0,0), _SVEC(4,-5,4), _SVEC(4,0,0), _RTSL() };
const word VECFONT_83[] = { _SVEC(0,2,0), _SVEC(2,-2,4), _SVEC(6,0,4), _SVEC(0,5,4), _SVEC(-8,2,4), _SVEC(0,5,4), _SVEC(6,0,4), _SVEC(2,-2,4), _SVEC(4,-10,0), _RTSL() };
const word VECFONT_84[] = { _SVEC(0,12,0), _SVEC(8,0,4), _SVEC(-4,0,0), _SVEC(0,-12,4), _SVEC(8,0,0), _RTSL() };
const word VECFONT_85[] = { _SVEC(0,12,0), _SVEC(0,-10,4), _SVEC(4,-2,4), _SVEC(4,2,4), _SVEC(0,10,4), _SVEC(4,-12,0), _RTSL() };
const word VECFONT_86[] = { _SVEC(0,12,0), _SVEC(4,-12,4), _SVEC(4,12,4), _SVEC(4,-12,0), _RTSL() };
const word VECFONT_87[] = { _SVEC(0,12,0), _SVEC(2,-12,4), _SVEC(2,4,4), _SVEC(2,-4,4), _SVEC(2,12,4), _SVEC(4,-12,0), _RTSL() };
const word VECFONT_88[] = { _SVEC(0,0,0), _SVEC(8,12,4), _SVEC(-8,0,0), _SVEC(8,-12,4), _SVEC(4,0,0), _RTSL() };
const word VECFONT_89[] = { _SVEC(0,12,0), _SVEC(4,-6,4), _SVEC(4,6,4), _SVEC(-4,-6,0), _SVEC(0,-6,4), _SVEC(8,0,0), _RTSL() };
const word VECFONT_90[] = { _SVEC(0,12,0), _SVEC(8,0,4), _SVEC(-8,-12,4), _SVEC(8,0,4), _SVEC(-6,6,0), _SVEC(4,0,4), _SVEC(6,-6,0), _RTSL() };
const word* const VECFONT[] = { VECFONT_32,VECFONT_33,VECFONT_34,VECFONT_35,VECFONT_36,VECFONT_37,VECFONT_38,VECFONT_39,VECFONT_40,VECFONT_41,VECFONT_42,VECFONT_43,VECFONT_44,VECFONT_45,VECFONT_46,VECFONT_47,VECFONT_48,VECFONT_49,VECFONT_50,VECFONT_51,VECFONT_52,VECFONT_53,VECFONT_54,VECFONT_55,VECFONT_56,VECFONT_57,VECFONT_58,VECFONT_59,VECFONT_60,VECFONT_61,VECFONT_62,VECFONT_63,VECFONT_64,VECFONT_65,VECFONT_66,VECFONT_67,VECFONT_68,VECFONT_69,VECFONT_70,VECFONT_71,VECFONT_72,VECFONT_73,VECFONT_74,VECFONT_75,VECFONT_76,VECFONT_77,VECFONT_78,VECFONT_79,VECFONT_80,VECFONT_81,VECFONT_82,VECFONT_83,VECFONT_84,VECFONT_85,VECFONT_86,VECFONT_87,VECFONT_88,VECFONT_89,VECFONT_90, };
#pragma rodata-name(pop)

void draw_char(char ch) {
  const word* vec = VECFONT[ch - ' '];
  if (ch < ' ' || ch > 'Z') return;
  JSRPTR(vec);
}

void draw_string(const char* str, byte spacing) {
  while (*str) {
    draw_char(*str++);
    if (spacing) SVEC(spacing, 0, 0);
  }
}

