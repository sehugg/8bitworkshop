
import { hex } from "../util";

const Z80_OPS = ["nop","ld bc,xx","ld (bc),a","inc bc","inc b","dec b","ld b,x","rlca","ex af,af'","add hl,bc","ld a,(bc)","dec bc","inc c","dec c","ld c,x","rrca","djnz x","ld de,xx","ld (de),a","inc de","inc d","dec d","ld d,x","rla","jr x","add hl,de","ld a,(de)","dec de","inc e","dec e","ld e,x","rra","jr nz,x","ld hl,xx","ld (xx),hl","inc hl","inc h","dec h","ld h,x","daa","jr z,x","add hl,hl","ld hl,(xx)","dec hl","inc l","dec l","ld l,x","cpl","jr nc,x","ld sp,xx","ld (xx),a","inc sp","inc (hl)","dec (hl)","ld (hl),x","scf","jr c,x","add hl,sp","ld a,(xx)","dec sp","inc a","dec a","ld a,x","ccf","ld b,b","ld b,c","ld b,d","ld b,e","ld b,h","ld b,l","ld b,(hl)","ld b,a","ld c,b","ld c,c","ld c,d","ld c,e","ld c,h","ld c,l","ld c,(hl)","ld c,a","ld d,b","ld d,c","ld d,d","ld d,e","ld d,h","ld d,l","ld d,(hl)","ld d,a","ld e,b","ld e,c","ld e,d","ld e,e","ld e,h","ld e,l","ld e,(hl)","ld e,a","ld h,b","ld h,c","ld h,d","ld h,e","ld h,h","ld h,l","ld h,(hl)","ld h,a","ld l,b","ld l,c","ld l,d","ld l,e","ld l,h","ld l,l","ld l,(hl)","ld l,a","ld (hl),b","ld (hl),c","ld (hl),d","ld (hl),e","ld (hl),h","ld (hl),l","halt","ld (hl),a","ld a,b","ld a,c","ld a,d","ld a,e","ld a,h","ld a,l","ld a,(hl)","ld a,a","add a,b","add a,c","add a,d","add a,e","add a,h","add a,l","add a,(hl)","add a,a","adc a,b","adc a,c","adc a,d","adc a,e","adc a,h","adc a,l","adc a,(hl)","adc a,a","sub b","sub c","sub d","sub e","sub h","sub l","sub (hl)","sub a","sbc a,b","sbc a,c","sbc a,d","sbc a,e","sbc a,h","sbc a,l","sbc a,(hl)","sbc a,a","and b","and c","and d","and e","and h","and l","and (hl)","and a","xor b","xor c","xor d","xor e","xor h","xor l","xor (hl)","xor a","or b","or c","or d","or e","or h","or l","or (hl)","or a","cp b","cp c","cp d","cp e","cp h","cp l","cp (hl)","cp a","ret nz","pop bc","jp nz,xx","jp xx","call nz,xx","push bc","add a,x","rst 00h","ret z","ret","jp z,xx","xxBITxx","call z,xx","call xx","adc a,x","rst 08h","ret nc","pop de","jp nc,xx","out (x),a","call nc,xx","push de","sub x","rst 10h","ret c","exx","jp c,xx","in a,(x)","call c,xx","xxIXxx","sbc a,x","rst 18h","ret po","pop hl","jp po,xx","ex (sp),hl","call po,xx","push hl","and x","rst 20h","ret pe","jp (hl)","jp pe,xx","ex de,hl","call pe,xx","xx80xx","xor x","rst 28h","ret p","pop af","jp p,xx","di","call p,xx","push af","or x","rst 30h","ret m","ld sp,hl","jp m,xx","ei","call m,xx","xxIYxx","cp x","rst 38h"];
const Z80_OPS_ED = ["in b,(c)","out (c),b","sbc hl,bc","ld (xx),bc","neg","retn","im 0","ld i,a","in c,(c)","out (c),c","adc hl,bc","ld bc,(xx)","neg","reti","","ld r,a","in d,(c)","out (c),d","sbc hl,de","ld (xx),de","neg","retn","im 1","ld a,i","in e,(c)","out (c),e","adc hl,de","ld de,(xx)","neg","retn","im 2","ld a,r","in h,(c)","out (c),h","sbc hl,hl","ld (xx),hl","neg","retn","","rrd","in l,(c)","out (c),l","adc hl,hl","ld hl,(xx)","neg","retn","","rld","in f,(c)","out (c),f","sbc hl,sp","ld (xx),sp","neg","retn","","","in a,(c)","out (c),a","adc hl,sp","ld sp,(xx)","neg","reti","","","ldi","cpi","ini","outi","","","","","ldd","cpd","ind","outd","","","","","ldir","cpir","inir","otir","","","","","lddr","cpdr","indr","otdr","","","",""];
const Z80_OPS_CB = ["rlc b","rlc c","rlc d","rlc e","rlc h","rlc l","rlc (hl)","rlc a","rrc b","rrc c","rrc d","rrc e","rrc h","rrc l","rrc (hl)","rrc a","rl b","rl c","rl d","rl e","rl h","rl l","rl (hl)","rl a","rr b","rr c","rr d","rr e","rr h","rr l","rr (hl)","rr a","sla b","sla c","sla d","sla e","sla h","sla l","sla (hl)","sla a","sra b","sra c","sra d","sra e","sra h","sra l","sra (hl)","sra a","sll b","sll c","sll d","sll e","sll h","sll l","sll (hl)","sll a","srl b","srl c","srl d","srl e","srl h","srl l","srl (hl)","srl a","bit 0,b","bit 0,c","bit 0,d","bit 0,e","bit 0,h","bit 0,l","bit 0,(hl)","bit 0,a","bit 1,b","bit 1,c","bit 1,d","bit 1,e","bit 1,h","bit 1,l","bit 1,(hl)","bit 1,a","bit 2,b","bit 2,c","bit 2,d","bit 2,e","bit 2,h","bit 2,l","bit 2,(hl)","bit 2,a","bit 3,b","bit 3,c","bit 3,d","bit 3,e","bit 3,h","bit 3,l","bit 3,(hl)","bit 3,a","bit 4,b","bit 4,c","bit 4,d","bit 4,e","bit 4,h","bit 4,l","bit 4,(hl)","bit 4,a","bit 5,b","bit 5,c","bit 5,d","bit 5,e","bit 5,h","bit 5,l","bit 5,(hl)","bit 5,a","bit 6,b","bit 6,c","bit 6,d","bit 6,e","bit 6,h","bit 6,l","bit 6,(hl)","bit 6,a","bit 7,b","bit 7,c","bit 7,d","bit 7,e","bit 7,h","bit 7,l","bit 7,(hl)","bit 7,a","res 0,b","res 0,c","res 0,d","res 0,e","res 0,h","res 0,l","res 0,(hl)","res 0,a","res 1,b","res 1,c","res 1,d","res 1,e","res 1,h","res 1,l","res 1,(hl)","res 1,a","res 2,b","res 2,c","res 2,d","res 2,e","res 2,h","res 2,l","res 2,(hl)","res 2,a","res 3,b","res 3,c","res 3,d","res 3,e","res 3,h","res 3,l","res 3,(hl)","res 3,a","res 4,b","res 4,c","res 4,d","res 4,e","res 4,h","res 4,l","res 4,(hl)","res 4,a","res 5,b","res 5,c","res 5,d","res 5,e","res 5,h","res 5,l","res 5,(hl)","res 5,a","res 6,b","res 6,c","res 6,d","res 6,e","res 6,h","res 6,l","res 6,(hl)","res 6,a","res 7,b","res 7,c","res 7,d","res 7,e","res 7,h","res 7,l","res 7,(hl)","res 7,a","set 0,b","set 0,c","set 0,d","set 0,e","set 0,h","set 0,l","set 0,(hl)","set 0,a","set 1,b","set 1,c","set 1,d","set 1,e","set 1,h","set 1,l","set 1,(hl)","set 1,a","set 2,b","set 2,c","set 2,d","set 2,e","set 2,h","set 2,l","set 2,(hl)","set 2,a","set 3,b","set 3,c","set 3,d","set 3,e","set 3,h","set 3,l","set 3,(hl)","set 3,a","set 4,b","set 4,c","set 4,d","set 4,e","set 4,h","set 4,l","set 4,(hl)","set 4,a","set 5,b","set 5,c","set 5,d","set 5,e","set 5,h","set 5,l","set 5,(hl)","set 5,a","set 6,b","set 6,c","set 6,d","set 6,e","set 6,h","set 6,l","set 6,(hl)","set 6,a","set 7,b","set 7,c","set 7,d","set 7,e","set 7,h","set 7,l","set 7,(hl)","set 7,a"];

export function disassembleZ80(pc:number, b0:number, b1:number, b2:number, b3:number) : {line:string, nbytes:number, isaddr:boolean} {

  var op,n,am;
  var bytes = [b0,b1,b2,b3];
  var isaddr = false;
  n=1;
  switch (b0) {
    case 0xcb:
      am = Z80_OPS_CB[b1];
      n++;
      break;
    case 0xed:
      if (b1 >= 0x40 && b1 <= 0x7f) am = Z80_OPS_ED[b1 - 0x40];
      if (b1 >= 0xa0 && b1 <= 0xbf) am = Z80_OPS_ED[b1 - 0xa0 + 0x40];
      n++;
      break;
    case 0xdd:
    case 0xfd:
      var ireg = (b0 == 0xdd) ? 'ix' : 'iy';
      if (b1 == 0xcb) {
        // swap the 3rd and 4th bytes [$dd $cb displacement opcode]
        am = Z80_OPS_CB[b3];
        bytes[2] = b3;
        bytes[3] = b2;
        n++;
      } else {
        am = Z80_OPS[b1];
      }
      am = am.replace(/[(]hl[)]/, '('+ireg+'+x)');
      am = am.replace(/\bhl\b/, ireg);
      n++;
      break;
    default:
      am = Z80_OPS[b0];
      break;
  }
  if (!am || !am.length) am = "??";
  if (/\bxx\b/.test(am)) {
    am = am.replace(/\bxx\b/,'$'+hex(bytes[n]+(bytes[n+1]<<8), 4));
    n += 2;
    isaddr = true;
  } else if (/\bx\b/.test(am)) {
    if (am.startsWith('j')) {
      var offset = (b1 < 0x80) ? (pc+2+b1) : (pc+2-(256-b1));
      offset &= 0xffff;
      am = am.replace(/\bx\b/,'$'+hex(offset, 4));
      isaddr = true;
    } else {
      am = am.replace(/\bx\b/,'$'+hex(bytes[n], 2));
    }
    n += 1;
  }
  return {line:am.toUpperCase(), nbytes:n, isaddr:isaddr};
};
