"use strict";
var Z80_fast = function (opts) {
	var self = {};

	var memory = opts.memory;
var ioBus = opts.ioBus;
var display = opts.display;

var registerBuffer = new ArrayBuffer(26);
/* Expose registerBuffer as both register pairs and individual registers */
var regPairs = new Uint16Array(registerBuffer);
var regs = new Uint8Array(registerBuffer);

var tstates = 0; /* number of tstates since start of this frame */
var iff1 = 0;
var iff2 = 0;
var im = 0;
var halted = false;

/* tables for setting Z80 flags */

/*
	Whether a half carry occurred or not can be determined by looking at
	the 3rd bit of the two arguments and the result; these are hashed
	into this table in the form r12, where r is the 3rd bit of the
	result, 1 is the 3rd bit of the 1st argument and 2 is the
	third bit of the 2nd argument; the tables differ for add and subtract
	operations
*/
var halfcarryAddTable = new Uint8Array([0, 16, 16, 16, 0, 0, 0, 16]);
var halfcarrySubTable = new Uint8Array([0, 0, 16, 0, 16, 0, 16, 16]);

/*
	Similarly, overflow can be determined by looking at the 7th bits; again
	the hash into this table is r12
*/
var overflowAddTable = new Uint8Array([0, 0, 0, 4, 4, 0, 0, 0]);
var overflowSubTable = new Uint8Array([0, 4, 0, 0, 0, 0, 4, 0]);

var sz53Table = new Uint8Array(0x100); /* The S, Z, 5 and 3 bits of the index */
var parityTable = new Uint8Array(0x100); /* The parity of the lookup value */
var sz53pTable = new Uint8Array(0x100); /* OR the above two tables together */

for (var i = 0; i < 0x100; i++) {
	sz53Table[i] = i & ( 168 );
	var j = i;
	var parity = 0;
	for (var k = 0; k < 8; k++) {
		parity ^= j & 1;
		j >>=1;
	}

	parityTable[i] = (parity ? 0 : 4);
	sz53pTable[i] = sz53Table[i] | parityTable[i];

	sz53Table[0] |= 64;
	sz53pTable[0] |= 64;
}

var interruptible = true;
var interruptPending = false;
var interruptDataBus = 0;
var opcodePrefix = '';

	self.requestInterrupt = function(dataBus) {
		interruptPending = true;
		interruptDataBus = dataBus & 0xffff;
		/* TODO: use event scheduling to keep the interrupt line active for a fixed
		~48T window, to support retriggered interrupts and interrupt blocking via
		chains of EI or DD/FD prefixes */
	}
	self.nonMaskableInterrupt = function() {
		iff1 = 1;
		self.requestInterrupt(0x66);
	}
	var z80Interrupt = function() {
		if (iff1) {
			if (halted) {
				/* move PC on from the HALT opcode */
				regPairs[12]++;
				halted = false;
			}

			iff1 = iff2 = 0;

			/* push current PC in readiness for call to interrupt handler */
			regPairs[11]--; tstates += ( 3);
while (display.nextEventTime != null && display.nextEventTime < tstates) display.doEvent();
memory.write(regPairs[11], regPairs[12] >> 8);;
			regPairs[11]--; tstates += ( 3);
while (display.nextEventTime != null && display.nextEventTime < tstates) display.doEvent();
memory.write(regPairs[11], regPairs[12] & 0xff);;

			/* TODO: R register */

			switch (im) {
				case 0:
					regPairs[12] = interruptDataBus; // assume always RST
					tstates += 6;
					break;
				case 1:
					regPairs[12] = 0x0038;
					tstates += 7;
					break;
				case 2:
					inttemp = (regs[21] << 8) | (interruptDataBus & 0xff);
					l = (tstates += ( 3), memory.read(inttemp));
					inttemp = (inttemp+1) & 0xffff;
					h = (tstates += ( 3), memory.read(inttemp));
					console.log(hex(interruptDataBus), hex(inttemp), hex(l), hex(h));
					regPairs[12] = (h<<8) | l;
					tstates += 7;
					break;
			}
		}
	};

	self.runFrame = function(frameLength) {
		var lastOpcodePrefix, offset, opcode;

		while (tstates < frameLength || opcodePrefix) {
			if (interruptible && interruptPending) {
				z80Interrupt();
				interruptPending = false;
			}
			interruptible = true; /* unless overridden by opcode */
			lastOpcodePrefix = opcodePrefix;
			opcodePrefix = '';
			switch (lastOpcodePrefix) {
				case '':
					tstates += ( 4);
					opcode = memory.read(regPairs[12]); regPairs[12]++;
					regs[20] = ((regs[20] + 1) & 0x7f) | (regs[20] & 0x80);
					switch (opcode) {
	case 0:
	
			
	break;case 1:
	
	var l = (tstates += ( 3), memory.read(regPairs[12])); regPairs[12]++;
var h = (tstates += ( 3), memory.read(regPairs[12])); regPairs[12]++;
regPairs[1] = (h<<8) | l;
	break;case 2:
	
	tstates += ( 3);
while (display.nextEventTime != null && display.nextEventTime < tstates) display.doEvent();
memory.write(regPairs[1], regs[1]);;
	break;case 3:
	
	regPairs[1]++;
tstates += ( 1);
tstates += ( 1);
	break;case 4:
	
	

regs[0] = (regs[0] & 1) | (regs[3] & 0x0f ? 0 : 16) | 2;
regs[3] = (regs[3] + 1) ;


regs[0] = (regs[0] & 1) | ( regs[3] == 0x80 ? 4 : 0 ) | ( regs[3] & 0x0f ? 0 : 16 ) | sz53Table[regs[3]];
	break;case 5:
	
	

regs[0] = (regs[0] & 1 ) | ( regs[3] & 0x0f ? 0 : 16 ) | 2;
regs[3] = (regs[3] - 1) ;


regs[0] |= (regs[3] == 0x7f ? 4 : 0) | sz53Table[regs[3]];
	break;case 6:
	
	regs[3] = (tstates += ( 3), memory.read(regPairs[12])); regPairs[12]++;
	break;case 7:
	
	regs[1] = (regs[1] << 1) | (regs[1] >> 7);
regs[0] = (regs[0] & 196) | (regs[1] & 41);
	break;case 8:
	
	var temp = regPairs[0];
regPairs[0] = regPairs[4];
regPairs[4] = temp;
	break;case 9:
	
	var add16temp = regPairs[3] + regPairs[1];
var lookup = ( (regPairs[3] & 0x0800) >> 11 ) | ( (regPairs[1] & 0x0800) >> 10 ) | ( (add16temp & 0x0800) >>  9 );
regPairs[3] = add16temp;
regs[0] = ( regs[0] & ( 196 ) ) | ( add16temp & 0x10000 ? 1 : 0 ) | ( ( add16temp >> 8 ) & ( 40 ) ) | halfcarryAddTable[lookup];
tstates += ( 1);
tstates += ( 1);
tstates += ( 1);
tstates += ( 1);
tstates += ( 1);
tstates += ( 1);
tstates += ( 1);
	break;case 10:
	
	regs[1] = (tstates += ( 3), memory.read(regPairs[1]));
	break;case 11:
	
	regPairs[1]--;
tstates += ( 1);
tstates += ( 1);
	break;case 12:
	
	

regs[0] = (regs[0] & 1) | (regs[2] & 0x0f ? 0 : 16) | 2;
regs[2] = (regs[2] + 1) ;


regs[0] = (regs[0] & 1) | ( regs[2] == 0x80 ? 4 : 0 ) | ( regs[2] & 0x0f ? 0 : 16 ) | sz53Table[regs[2]];
	break;case 13:
	
	

regs[0] = (regs[0] & 1 ) | ( regs[2] & 0x0f ? 0 : 16 ) | 2;
regs[2] = (regs[2] - 1) ;


regs[0] |= (regs[2] == 0x7f ? 4 : 0) | sz53Table[regs[2]];
	break;case 14:
	
	regs[2] = (tstates += ( 3), memory.read(regPairs[12])); regPairs[12]++;
	break;case 15:
	
	regs[0] = (regs[0] & 196) | (regs[1] & 1);
regs[1] = (regs[1] >> 1) | (regs[1] << 7);
regs[0] |= (regs[1] & 40);
	break;case 16:
	
	tstates += ( 1);
regs[3]--;
if (regs[3]) {
	/* take branch */
	var offset = (tstates += ( 3), memory.read(regPairs[12]));
	tstates += ( 1);
	tstates += ( 1);
	tstates += ( 1);
	tstates += ( 1);
	tstates += ( 1);
	regPairs[12]++;
	regPairs[12] += (offset & 0x80 ? offset - 0x100 : offset);
} else {
	/* do not take branch */
	tstates += ( 3);
	regPairs[12]++;
}
	break;case 17:
	
	var l = (tstates += ( 3), memory.read(regPairs[12])); regPairs[12]++;
var h = (tstates += ( 3), memory.read(regPairs[12])); regPairs[12]++;
regPairs[2] = (h<<8) | l;
	break;case 18:
	
	tstates += ( 3);
while (display.nextEventTime != null && display.nextEventTime < tstates) display.doEvent();
memory.write(regPairs[2], regs[1]);;
	break;case 19:
	
	regPairs[2]++;
tstates += ( 1);
tstates += ( 1);
	break;case 20:
	
	

regs[0] = (regs[0] & 1) | (regs[5] & 0x0f ? 0 : 16) | 2;
regs[5] = (regs[5] + 1) ;


regs[0] = (regs[0] & 1) | ( regs[5] == 0x80 ? 4 : 0 ) | ( regs[5] & 0x0f ? 0 : 16 ) | sz53Table[regs[5]];
	break;case 21:
	
	

regs[0] = (regs[0] & 1 ) | ( regs[5] & 0x0f ? 0 : 16 ) | 2;
regs[5] = (regs[5] - 1) ;


regs[0] |= (regs[5] == 0x7f ? 4 : 0) | sz53Table[regs[5]];
	break;case 22:
	
	regs[5] = (tstates += ( 3), memory.read(regPairs[12])); regPairs[12]++;
	break;case 23:
	
	var bytetemp = regs[1];
regs[1] = (regs[1] << 1) | (regs[0] & 1);
regs[0] = (regs[0] & 196) | (regs[1] & 40) | (bytetemp >> 7);
	break;case 24:
	
	var offset = (tstates += ( 3), memory.read(regPairs[12]));
tstates += ( 1);
tstates += ( 1);
tstates += ( 1);
tstates += ( 1);
tstates += ( 1);
regPairs[12]++;
regPairs[12] += (offset & 0x80 ? offset - 0x100 : offset);
	break;case 25:
	
	var add16temp = regPairs[3] + regPairs[2];
var lookup = ( (regPairs[3] & 0x0800) >> 11 ) | ( (regPairs[2] & 0x0800) >> 10 ) | ( (add16temp & 0x0800) >>  9 );
regPairs[3] = add16temp;
regs[0] = ( regs[0] & ( 196 ) ) | ( add16temp & 0x10000 ? 1 : 0 ) | ( ( add16temp >> 8 ) & ( 40 ) ) | halfcarryAddTable[lookup];
tstates += ( 1);
tstates += ( 1);
tstates += ( 1);
tstates += ( 1);
tstates += ( 1);
tstates += ( 1);
tstates += ( 1);
	break;case 26:
	
	regs[1] = (tstates += ( 3), memory.read(regPairs[2]));
	break;case 27:
	
	regPairs[2]--;
tstates += ( 1);
tstates += ( 1);
	break;case 28:
	
	

regs[0] = (regs[0] & 1) | (regs[4] & 0x0f ? 0 : 16) | 2;
regs[4] = (regs[4] + 1) ;


regs[0] = (regs[0] & 1) | ( regs[4] == 0x80 ? 4 : 0 ) | ( regs[4] & 0x0f ? 0 : 16 ) | sz53Table[regs[4]];
	break;case 29:
	
	

regs[0] = (regs[0] & 1 ) | ( regs[4] & 0x0f ? 0 : 16 ) | 2;
regs[4] = (regs[4] - 1) ;


regs[0] |= (regs[4] == 0x7f ? 4 : 0) | sz53Table[regs[4]];
	break;case 30:
	
	regs[4] = (tstates += ( 3), memory.read(regPairs[12])); regPairs[12]++;
	break;case 31:
	
	var bytetemp = regs[1];
regs[1] = (bytetemp >> 1) | (regs[0] << 7);
regs[0] = (regs[0] & 196) | (regs[1] & 40) | (bytetemp & 1);
	break;case 32:
	
	if (!(regs[0] & 64)) {
	var offset = (tstates += ( 3), memory.read(regPairs[12]));
	tstates += ( 1);
	tstates += ( 1);
	tstates += ( 1);
	tstates += ( 1);
	tstates += ( 1);
	regPairs[12]++;
	regPairs[12] += (offset & 0x80 ? offset - 0x100 : offset);
} else {
	tstates += ( 3);
	regPairs[12]++; /* skip past offset byte */
}
	break;case 33:
	
	var l = (tstates += ( 3), memory.read(regPairs[12])); regPairs[12]++;
var h = (tstates += ( 3), memory.read(regPairs[12])); regPairs[12]++;
regPairs[3] = (h<<8) | l;
	break;case 34:
	
	var l = (tstates += ( 3), memory.read(regPairs[12])); regPairs[12]++;
var h = (tstates += ( 3), memory.read(regPairs[12])); regPairs[12]++;
var addr = (h<<8) | l;
tstates += ( 3);
while (display.nextEventTime != null && display.nextEventTime < tstates) display.doEvent();
memory.write(addr, regPairs[3] & 0xff);;
addr = (addr + 1) & 0xffff;
tstates += ( 3);
while (display.nextEventTime != null && display.nextEventTime < tstates) display.doEvent();
memory.write(addr, regPairs[3] >> 8);;
	break;case 35:
	
	regPairs[3]++;
tstates += ( 1);
tstates += ( 1);
	break;case 36:
	
	

regs[0] = (regs[0] & 1) | (regs[7] & 0x0f ? 0 : 16) | 2;
regs[7] = (regs[7] + 1) ;


regs[0] = (regs[0] & 1) | ( regs[7] == 0x80 ? 4 : 0 ) | ( regs[7] & 0x0f ? 0 : 16 ) | sz53Table[regs[7]];
	break;case 37:
	
	

regs[0] = (regs[0] & 1 ) | ( regs[7] & 0x0f ? 0 : 16 ) | 2;
regs[7] = (regs[7] - 1) ;


regs[0] |= (regs[7] == 0x7f ? 4 : 0) | sz53Table[regs[7]];
	break;case 38:
	
	regs[7] = (tstates += ( 3), memory.read(regPairs[12])); regPairs[12]++;
	break;case 39:
	
	var add = 0;
var carry = regs[0] & 1;
if( ( regs[0] & 16 ) || ( ( regs[1] & 0x0f ) > 9 ) ) add = 6;
if( carry || ( regs[1] > 0x99 ) ) add |= 0x60;
if( regs[1] > 0x99 ) carry = 1;
if( regs[0] & 2 ) {
	
var subtemp = regs[1] - add;
var lookup = ( (regs[1] & 0x88) >> 3 ) | ( (add & 0x88) >> 2 ) | ( (subtemp & 0x88) >> 1 );
regs[1] = subtemp;
regs[0] = ( subtemp & 0x100 ? 1 : 0 ) | 2 | halfcarrySubTable[lookup & 0x07] | overflowSubTable[lookup >> 4] | sz53Table[regs[1]];
} else {
	

var addtemp = regs[1] + add;
var lookup = ( (regs[1] & 0x88) >> 3 ) | ( (add & 0x88) >> 2 ) | ( (addtemp & 0x88) >> 1 );
regs[1] = addtemp;
regs[0] = ( addtemp & 0x100 ? 1 : 0 ) | halfcarryAddTable[lookup & 0x07] | overflowAddTable[lookup >> 4] | sz53Table[regs[1]];
}
regs[0] = ( regs[0] & -6 ) | carry | parityTable[regs[1]];
	break;case 40:
	
	if (regs[0] & 64) {
	var offset = (tstates += ( 3), memory.read(regPairs[12]));
	tstates += ( 1);
	tstates += ( 1);
	tstates += ( 1);
	tstates += ( 1);
	tstates += ( 1);
	regPairs[12]++;
	regPairs[12] += (offset & 0x80 ? offset - 0x100 : offset);
} else {
	tstates += ( 3);
	regPairs[12]++; /* skip past offset byte */
}
	break;case 41:
	
	var add16temp = regPairs[3] + regPairs[3];
var lookup = ( (regPairs[3] & 0x0800) >> 11 ) | ( (regPairs[3] & 0x0800) >> 10 ) | ( (add16temp & 0x0800) >>  9 );
regPairs[3] = add16temp;
regs[0] = ( regs[0] & ( 196 ) ) | ( add16temp & 0x10000 ? 1 : 0 ) | ( ( add16temp >> 8 ) & ( 40 ) ) | halfcarryAddTable[lookup];
tstates += ( 1);
tstates += ( 1);
tstates += ( 1);
tstates += ( 1);
tstates += ( 1);
tstates += ( 1);
tstates += ( 1);
	break;case 42:
	
	var l = (tstates += ( 3), memory.read(regPairs[12])); regPairs[12]++;
var h = (tstates += ( 3), memory.read(regPairs[12])); regPairs[12]++;
var addr = (h<<8) | l;
l = (tstates += ( 3), memory.read(addr));
addr = (addr + 1) & 0xffff;
h = (tstates += ( 3), memory.read(addr));
regPairs[3] = (h<<8) | l;
	break;case 43:
	
	regPairs[3]--;
tstates += ( 1);
tstates += ( 1);
	break;case 44:
	
	

regs[0] = (regs[0] & 1) | (regs[6] & 0x0f ? 0 : 16) | 2;
regs[6] = (regs[6] + 1) ;


regs[0] = (regs[0] & 1) | ( regs[6] == 0x80 ? 4 : 0 ) | ( regs[6] & 0x0f ? 0 : 16 ) | sz53Table[regs[6]];
	break;case 45:
	
	

regs[0] = (regs[0] & 1 ) | ( regs[6] & 0x0f ? 0 : 16 ) | 2;
regs[6] = (regs[6] - 1) ;


regs[0] |= (regs[6] == 0x7f ? 4 : 0) | sz53Table[regs[6]];
	break;case 46:
	
	regs[6] = (tstates += ( 3), memory.read(regPairs[12])); regPairs[12]++;
	break;case 47:
	
	regs[1] ^= 0xff;
regs[0] = (regs[0] & 197) | (regs[1] & 40) | 18;
	break;case 48:
	
	if (!(regs[0] & 1)) {
	var offset = (tstates += ( 3), memory.read(regPairs[12]));
	tstates += ( 1);
	tstates += ( 1);
	tstates += ( 1);
	tstates += ( 1);
	tstates += ( 1);
	regPairs[12]++;
	regPairs[12] += (offset & 0x80 ? offset - 0x100 : offset);
} else {
	tstates += ( 3);
	regPairs[12]++; /* skip past offset byte */
}
	break;case 49:
	
	var l = (tstates += ( 3), memory.read(regPairs[12])); regPairs[12]++;
var h = (tstates += ( 3), memory.read(regPairs[12])); regPairs[12]++;
regPairs[11] = (h<<8) | l;
	break;case 50:
	
	var l = (tstates += ( 3), memory.read(regPairs[12])); regPairs[12]++;
var h = (tstates += ( 3), memory.read(regPairs[12])); regPairs[12]++;
var addr = (h<<8) | l;
tstates += ( 3);
while (display.nextEventTime != null && display.nextEventTime < tstates) display.doEvent();
memory.write(addr, regs[1]);;
	break;case 51:
	
	regPairs[11]++;
tstates += ( 1);
tstates += ( 1);
	break;case 52:
	
	var val = (tstates += ( 3), memory.read(regPairs[3]));

regs[0] = (regs[0] & 1) | (val & 0x0f ? 0 : 16) | 2;
val = (val + 1) & 0xff;

tstates += ( 1);
tstates += ( 3);
while (display.nextEventTime != null && display.nextEventTime < tstates) display.doEvent();
memory.write(regPairs[3], val);;
regs[0] = (regs[0] & 1) | ( val == 0x80 ? 4 : 0 ) | ( val & 0x0f ? 0 : 16 ) | sz53Table[val];
	break;case 53:
	
	var val = (tstates += ( 3), memory.read(regPairs[3]));

regs[0] = (regs[0] & 1 ) | ( val & 0x0f ? 0 : 16 ) | 2;
val = (val - 1) & 0xff;

tstates += ( 1);
tstates += ( 3);
while (display.nextEventTime != null && display.nextEventTime < tstates) display.doEvent();
memory.write(regPairs[3], val);;
regs[0] |= (val == 0x7f ? 4 : 0) | sz53Table[val];
	break;case 54:
	
	var n = (tstates += ( 3), memory.read(regPairs[12])); regPairs[12]++;
tstates += ( 3);
while (display.nextEventTime != null && display.nextEventTime < tstates) display.doEvent();
memory.write(regPairs[3], n);;
	break;case 55:
	
	regs[0] = (regs[0] & 196) | (regs[1] & 40) | 1;
	break;case 56:
	
	if (regs[0] & 1) {
	var offset = (tstates += ( 3), memory.read(regPairs[12]));
	tstates += ( 1);
	tstates += ( 1);
	tstates += ( 1);
	tstates += ( 1);
	tstates += ( 1);
	regPairs[12]++;
	regPairs[12] += (offset & 0x80 ? offset - 0x100 : offset);
} else {
	tstates += ( 3);
	regPairs[12]++; /* skip past offset byte */
}
	break;case 57:
	
	var add16temp = regPairs[3] + regPairs[11];
var lookup = ( (regPairs[3] & 0x0800) >> 11 ) | ( (regPairs[11] & 0x0800) >> 10 ) | ( (add16temp & 0x0800) >>  9 );
regPairs[3] = add16temp;
regs[0] = ( regs[0] & ( 196 ) ) | ( add16temp & 0x10000 ? 1 : 0 ) | ( ( add16temp >> 8 ) & ( 40 ) ) | halfcarryAddTable[lookup];
tstates += ( 1);
tstates += ( 1);
tstates += ( 1);
tstates += ( 1);
tstates += ( 1);
tstates += ( 1);
tstates += ( 1);
	break;case 58:
	
	var l = (tstates += ( 3), memory.read(regPairs[12])); regPairs[12]++;
var h = (tstates += ( 3), memory.read(regPairs[12])); regPairs[12]++;
var addr = (h<<8) | l;
regs[1] = (tstates += ( 3), memory.read(addr));
	break;case 59:
	
	regPairs[11]--;
tstates += ( 1);
tstates += ( 1);
	break;case 60:
	
	

regs[0] = (regs[0] & 1) | (regs[1] & 0x0f ? 0 : 16) | 2;
regs[1] = (regs[1] + 1) ;


regs[0] = (regs[0] & 1) | ( regs[1] == 0x80 ? 4 : 0 ) | ( regs[1] & 0x0f ? 0 : 16 ) | sz53Table[regs[1]];
	break;case 61:
	
	

regs[0] = (regs[0] & 1 ) | ( regs[1] & 0x0f ? 0 : 16 ) | 2;
regs[1] = (regs[1] - 1) ;


regs[0] |= (regs[1] == 0x7f ? 4 : 0) | sz53Table[regs[1]];
	break;case 62:
	
	regs[1] = (tstates += ( 3), memory.read(regPairs[12])); regPairs[12]++;
	break;case 63:
	
	regs[0] = ( regs[0] & 196 ) | ( (regs[0] & 1) ? 16 : 1 ) | ( regs[1] & 40 );
	break;case 64:
	
	regs[3] = regs[3];
	break;case 65:
	
	regs[3] = regs[2];
	break;case 66:
	
	regs[3] = regs[5];
	break;case 67:
	
	regs[3] = regs[4];
	break;case 68:
	
	regs[3] = regs[7];
	break;case 69:
	
	regs[3] = regs[6];
	break;case 70:
	
	regs[3] = (tstates += ( 3), memory.read(regPairs[3]));
	break;case 71:
	
	regs[3] = regs[1];
	break;case 72:
	
	regs[2] = regs[3];
	break;case 73:
	
	regs[2] = regs[2];
	break;case 74:
	
	regs[2] = regs[5];
	break;case 75:
	
	regs[2] = regs[4];
	break;case 76:
	
	regs[2] = regs[7];
	break;case 77:
	
	regs[2] = regs[6];
	break;case 78:
	
	regs[2] = (tstates += ( 3), memory.read(regPairs[3]));
	break;case 79:
	
	regs[2] = regs[1];
	break;case 80:
	
	regs[5] = regs[3];
	break;case 81:
	
	regs[5] = regs[2];
	break;case 82:
	
	regs[5] = regs[5];
	break;case 83:
	
	regs[5] = regs[4];
	break;case 84:
	
	regs[5] = regs[7];
	break;case 85:
	
	regs[5] = regs[6];
	break;case 86:
	
	regs[5] = (tstates += ( 3), memory.read(regPairs[3]));
	break;case 87:
	
	regs[5] = regs[1];
	break;case 88:
	
	regs[4] = regs[3];
	break;case 89:
	
	regs[4] = regs[2];
	break;case 90:
	
	regs[4] = regs[5];
	break;case 91:
	
	regs[4] = regs[4];
	break;case 92:
	
	regs[4] = regs[7];
	break;case 93:
	
	regs[4] = regs[6];
	break;case 94:
	
	regs[4] = (tstates += ( 3), memory.read(regPairs[3]));
	break;case 95:
	
	regs[4] = regs[1];
	break;case 96:
	
	regs[7] = regs[3];
	break;case 97:
	
	regs[7] = regs[2];
	break;case 98:
	
	regs[7] = regs[5];
	break;case 99:
	
	regs[7] = regs[4];
	break;case 100:
	
	regs[7] = regs[7];
	break;case 101:
	
	regs[7] = regs[6];
	break;case 102:
	
	regs[7] = (tstates += ( 3), memory.read(regPairs[3]));
	break;case 103:
	
	regs[7] = regs[1];
	break;case 104:
	
	regs[6] = regs[3];
	break;case 105:
	
	regs[6] = regs[2];
	break;case 106:
	
	regs[6] = regs[5];
	break;case 107:
	
	regs[6] = regs[4];
	break;case 108:
	
	regs[6] = regs[7];
	break;case 109:
	
	regs[6] = regs[6];
	break;case 110:
	
	regs[6] = (tstates += ( 3), memory.read(regPairs[3]));
	break;case 111:
	
	regs[6] = regs[1];
	break;case 112:
	
	tstates += ( 3);
while (display.nextEventTime != null && display.nextEventTime < tstates) display.doEvent();
memory.write(regPairs[3], regs[3]);;
	break;case 113:
	
	tstates += ( 3);
while (display.nextEventTime != null && display.nextEventTime < tstates) display.doEvent();
memory.write(regPairs[3], regs[2]);;
	break;case 114:
	
	tstates += ( 3);
while (display.nextEventTime != null && display.nextEventTime < tstates) display.doEvent();
memory.write(regPairs[3], regs[5]);;
	break;case 115:
	
	tstates += ( 3);
while (display.nextEventTime != null && display.nextEventTime < tstates) display.doEvent();
memory.write(regPairs[3], regs[4]);;
	break;case 116:
	
	tstates += ( 3);
while (display.nextEventTime != null && display.nextEventTime < tstates) display.doEvent();
memory.write(regPairs[3], regs[7]);;
	break;case 117:
	
	tstates += ( 3);
while (display.nextEventTime != null && display.nextEventTime < tstates) display.doEvent();
memory.write(regPairs[3], regs[6]);;
	break;case 118:
	
	halted = true;
regPairs[12]--;
	break;case 119:
	
	tstates += ( 3);
while (display.nextEventTime != null && display.nextEventTime < tstates) display.doEvent();
memory.write(regPairs[3], regs[1]);;
	break;case 120:
	
	regs[1] = regs[3];
	break;case 121:
	
	regs[1] = regs[2];
	break;case 122:
	
	regs[1] = regs[5];
	break;case 123:
	
	regs[1] = regs[4];
	break;case 124:
	
	regs[1] = regs[7];
	break;case 125:
	
	regs[1] = regs[6];
	break;case 126:
	
	regs[1] = (tstates += ( 3), memory.read(regPairs[3]));
	break;case 127:
	
	regs[1] = regs[1];
	break;case 128:
	
	

var addtemp = regs[1] + regs[3];
var lookup = ( (regs[1] & 0x88) >> 3 ) | ( (regs[3] & 0x88) >> 2 ) | ( (addtemp & 0x88) >> 1 );
regs[1] = addtemp;
regs[0] = ( addtemp & 0x100 ? 1 : 0 ) | halfcarryAddTable[lookup & 0x07] | overflowAddTable[lookup >> 4] | sz53Table[regs[1]];
	break;case 129:
	
	

var addtemp = regs[1] + regs[2];
var lookup = ( (regs[1] & 0x88) >> 3 ) | ( (regs[2] & 0x88) >> 2 ) | ( (addtemp & 0x88) >> 1 );
regs[1] = addtemp;
regs[0] = ( addtemp & 0x100 ? 1 : 0 ) | halfcarryAddTable[lookup & 0x07] | overflowAddTable[lookup >> 4] | sz53Table[regs[1]];
	break;case 130:
	
	

var addtemp = regs[1] + regs[5];
var lookup = ( (regs[1] & 0x88) >> 3 ) | ( (regs[5] & 0x88) >> 2 ) | ( (addtemp & 0x88) >> 1 );
regs[1] = addtemp;
regs[0] = ( addtemp & 0x100 ? 1 : 0 ) | halfcarryAddTable[lookup & 0x07] | overflowAddTable[lookup >> 4] | sz53Table[regs[1]];
	break;case 131:
	
	

var addtemp = regs[1] + regs[4];
var lookup = ( (regs[1] & 0x88) >> 3 ) | ( (regs[4] & 0x88) >> 2 ) | ( (addtemp & 0x88) >> 1 );
regs[1] = addtemp;
regs[0] = ( addtemp & 0x100 ? 1 : 0 ) | halfcarryAddTable[lookup & 0x07] | overflowAddTable[lookup >> 4] | sz53Table[regs[1]];
	break;case 132:
	
	

var addtemp = regs[1] + regs[7];
var lookup = ( (regs[1] & 0x88) >> 3 ) | ( (regs[7] & 0x88) >> 2 ) | ( (addtemp & 0x88) >> 1 );
regs[1] = addtemp;
regs[0] = ( addtemp & 0x100 ? 1 : 0 ) | halfcarryAddTable[lookup & 0x07] | overflowAddTable[lookup >> 4] | sz53Table[regs[1]];
	break;case 133:
	
	

var addtemp = regs[1] + regs[6];
var lookup = ( (regs[1] & 0x88) >> 3 ) | ( (regs[6] & 0x88) >> 2 ) | ( (addtemp & 0x88) >> 1 );
regs[1] = addtemp;
regs[0] = ( addtemp & 0x100 ? 1 : 0 ) | halfcarryAddTable[lookup & 0x07] | overflowAddTable[lookup >> 4] | sz53Table[regs[1]];
	break;case 134:
	
	var val = (tstates += ( 3), memory.read(regPairs[3]));

var addtemp = regs[1] + val;
var lookup = ( (regs[1] & 0x88) >> 3 ) | ( (val & 0x88) >> 2 ) | ( (addtemp & 0x88) >> 1 );
regs[1] = addtemp;
regs[0] = ( addtemp & 0x100 ? 1 : 0 ) | halfcarryAddTable[lookup & 0x07] | overflowAddTable[lookup >> 4] | sz53Table[regs[1]];
	break;case 135:
	
	

var addtemp = regs[1] + regs[1];
var lookup = ( (regs[1] & 0x88) >> 3 ) | ( (regs[1] & 0x88) >> 2 ) | ( (addtemp & 0x88) >> 1 );
regs[1] = addtemp;
regs[0] = ( addtemp & 0x100 ? 1 : 0 ) | halfcarryAddTable[lookup & 0x07] | overflowAddTable[lookup >> 4] | sz53Table[regs[1]];
	break;case 136:
	
	

var adctemp = regs[1] + regs[3] + (regs[0] & 1);
var lookup = ( (regs[1] & 0x88) >> 3 ) | ( (regs[3] & 0x88) >> 2 ) | ( (adctemp & 0x88) >> 1 );
regs[1] = adctemp;
regs[0] = ( adctemp & 0x100 ? 1 : 0 ) | halfcarryAddTable[lookup & 0x07] | overflowAddTable[lookup >> 4] | sz53Table[regs[1]];
	break;case 137:
	
	

var adctemp = regs[1] + regs[2] + (regs[0] & 1);
var lookup = ( (regs[1] & 0x88) >> 3 ) | ( (regs[2] & 0x88) >> 2 ) | ( (adctemp & 0x88) >> 1 );
regs[1] = adctemp;
regs[0] = ( adctemp & 0x100 ? 1 : 0 ) | halfcarryAddTable[lookup & 0x07] | overflowAddTable[lookup >> 4] | sz53Table[regs[1]];
	break;case 138:
	
	

var adctemp = regs[1] + regs[5] + (regs[0] & 1);
var lookup = ( (regs[1] & 0x88) >> 3 ) | ( (regs[5] & 0x88) >> 2 ) | ( (adctemp & 0x88) >> 1 );
regs[1] = adctemp;
regs[0] = ( adctemp & 0x100 ? 1 : 0 ) | halfcarryAddTable[lookup & 0x07] | overflowAddTable[lookup >> 4] | sz53Table[regs[1]];
	break;case 139:
	
	

var adctemp = regs[1] + regs[4] + (regs[0] & 1);
var lookup = ( (regs[1] & 0x88) >> 3 ) | ( (regs[4] & 0x88) >> 2 ) | ( (adctemp & 0x88) >> 1 );
regs[1] = adctemp;
regs[0] = ( adctemp & 0x100 ? 1 : 0 ) | halfcarryAddTable[lookup & 0x07] | overflowAddTable[lookup >> 4] | sz53Table[regs[1]];
	break;case 140:
	
	

var adctemp = regs[1] + regs[7] + (regs[0] & 1);
var lookup = ( (regs[1] & 0x88) >> 3 ) | ( (regs[7] & 0x88) >> 2 ) | ( (adctemp & 0x88) >> 1 );
regs[1] = adctemp;
regs[0] = ( adctemp & 0x100 ? 1 : 0 ) | halfcarryAddTable[lookup & 0x07] | overflowAddTable[lookup >> 4] | sz53Table[regs[1]];
	break;case 141:
	
	

var adctemp = regs[1] + regs[6] + (regs[0] & 1);
var lookup = ( (regs[1] & 0x88) >> 3 ) | ( (regs[6] & 0x88) >> 2 ) | ( (adctemp & 0x88) >> 1 );
regs[1] = adctemp;
regs[0] = ( adctemp & 0x100 ? 1 : 0 ) | halfcarryAddTable[lookup & 0x07] | overflowAddTable[lookup >> 4] | sz53Table[regs[1]];
	break;case 142:
	
	var val = (tstates += ( 3), memory.read(regPairs[3]));

var adctemp = regs[1] + val + (regs[0] & 1);
var lookup = ( (regs[1] & 0x88) >> 3 ) | ( (val & 0x88) >> 2 ) | ( (adctemp & 0x88) >> 1 );
regs[1] = adctemp;
regs[0] = ( adctemp & 0x100 ? 1 : 0 ) | halfcarryAddTable[lookup & 0x07] | overflowAddTable[lookup >> 4] | sz53Table[regs[1]];
	break;case 143:
	
	

var adctemp = regs[1] + regs[1] + (regs[0] & 1);
var lookup = ( (regs[1] & 0x88) >> 3 ) | ( (regs[1] & 0x88) >> 2 ) | ( (adctemp & 0x88) >> 1 );
regs[1] = adctemp;
regs[0] = ( adctemp & 0x100 ? 1 : 0 ) | halfcarryAddTable[lookup & 0x07] | overflowAddTable[lookup >> 4] | sz53Table[regs[1]];
	break;case 144:
	
	
var subtemp = regs[1] - regs[3];
var lookup = ( (regs[1] & 0x88) >> 3 ) | ( (regs[3] & 0x88) >> 2 ) | ( (subtemp & 0x88) >> 1 );
regs[1] = subtemp;
regs[0] = ( subtemp & 0x100 ? 1 : 0 ) | 2 | halfcarrySubTable[lookup & 0x07] | overflowSubTable[lookup >> 4] | sz53Table[regs[1]];
	break;case 145:
	
	
var subtemp = regs[1] - regs[2];
var lookup = ( (regs[1] & 0x88) >> 3 ) | ( (regs[2] & 0x88) >> 2 ) | ( (subtemp & 0x88) >> 1 );
regs[1] = subtemp;
regs[0] = ( subtemp & 0x100 ? 1 : 0 ) | 2 | halfcarrySubTable[lookup & 0x07] | overflowSubTable[lookup >> 4] | sz53Table[regs[1]];
	break;case 146:
	
	
var subtemp = regs[1] - regs[5];
var lookup = ( (regs[1] & 0x88) >> 3 ) | ( (regs[5] & 0x88) >> 2 ) | ( (subtemp & 0x88) >> 1 );
regs[1] = subtemp;
regs[0] = ( subtemp & 0x100 ? 1 : 0 ) | 2 | halfcarrySubTable[lookup & 0x07] | overflowSubTable[lookup >> 4] | sz53Table[regs[1]];
	break;case 147:
	
	
var subtemp = regs[1] - regs[4];
var lookup = ( (regs[1] & 0x88) >> 3 ) | ( (regs[4] & 0x88) >> 2 ) | ( (subtemp & 0x88) >> 1 );
regs[1] = subtemp;
regs[0] = ( subtemp & 0x100 ? 1 : 0 ) | 2 | halfcarrySubTable[lookup & 0x07] | overflowSubTable[lookup >> 4] | sz53Table[regs[1]];
	break;case 148:
	
	
var subtemp = regs[1] - regs[7];
var lookup = ( (regs[1] & 0x88) >> 3 ) | ( (regs[7] & 0x88) >> 2 ) | ( (subtemp & 0x88) >> 1 );
regs[1] = subtemp;
regs[0] = ( subtemp & 0x100 ? 1 : 0 ) | 2 | halfcarrySubTable[lookup & 0x07] | overflowSubTable[lookup >> 4] | sz53Table[regs[1]];
	break;case 149:
	
	
var subtemp = regs[1] - regs[6];
var lookup = ( (regs[1] & 0x88) >> 3 ) | ( (regs[6] & 0x88) >> 2 ) | ( (subtemp & 0x88) >> 1 );
regs[1] = subtemp;
regs[0] = ( subtemp & 0x100 ? 1 : 0 ) | 2 | halfcarrySubTable[lookup & 0x07] | overflowSubTable[lookup >> 4] | sz53Table[regs[1]];
	break;case 150:
	
	var val = (tstates += ( 3), memory.read(regPairs[3]));
var subtemp = regs[1] - val;
var lookup = ( (regs[1] & 0x88) >> 3 ) | ( (val & 0x88) >> 2 ) | ( (subtemp & 0x88) >> 1 );
regs[1] = subtemp;
regs[0] = ( subtemp & 0x100 ? 1 : 0 ) | 2 | halfcarrySubTable[lookup & 0x07] | overflowSubTable[lookup >> 4] | sz53Table[regs[1]];
	break;case 151:
	
	
var subtemp = regs[1] - regs[1];
var lookup = ( (regs[1] & 0x88) >> 3 ) | ( (regs[1] & 0x88) >> 2 ) | ( (subtemp & 0x88) >> 1 );
regs[1] = subtemp;
regs[0] = ( subtemp & 0x100 ? 1 : 0 ) | 2 | halfcarrySubTable[lookup & 0x07] | overflowSubTable[lookup >> 4] | sz53Table[regs[1]];
	break;case 152:
	
	
var sbctemp = regs[1] - regs[3] - (regs[0] & 1);
var lookup = ( (regs[1] & 0x88) >> 3 ) | ( (regs[3] & 0x88) >> 2 ) | ( (sbctemp & 0x88) >> 1 );
regs[1] = sbctemp;
regs[0] = ( sbctemp & 0x100 ? 1 : 0 ) | 2 | halfcarrySubTable[lookup & 0x07] | overflowSubTable[lookup >> 4] | sz53Table[regs[1]];
	break;case 153:
	
	
var sbctemp = regs[1] - regs[2] - (regs[0] & 1);
var lookup = ( (regs[1] & 0x88) >> 3 ) | ( (regs[2] & 0x88) >> 2 ) | ( (sbctemp & 0x88) >> 1 );
regs[1] = sbctemp;
regs[0] = ( sbctemp & 0x100 ? 1 : 0 ) | 2 | halfcarrySubTable[lookup & 0x07] | overflowSubTable[lookup >> 4] | sz53Table[regs[1]];
	break;case 154:
	
	
var sbctemp = regs[1] - regs[5] - (regs[0] & 1);
var lookup = ( (regs[1] & 0x88) >> 3 ) | ( (regs[5] & 0x88) >> 2 ) | ( (sbctemp & 0x88) >> 1 );
regs[1] = sbctemp;
regs[0] = ( sbctemp & 0x100 ? 1 : 0 ) | 2 | halfcarrySubTable[lookup & 0x07] | overflowSubTable[lookup >> 4] | sz53Table[regs[1]];
	break;case 155:
	
	
var sbctemp = regs[1] - regs[4] - (regs[0] & 1);
var lookup = ( (regs[1] & 0x88) >> 3 ) | ( (regs[4] & 0x88) >> 2 ) | ( (sbctemp & 0x88) >> 1 );
regs[1] = sbctemp;
regs[0] = ( sbctemp & 0x100 ? 1 : 0 ) | 2 | halfcarrySubTable[lookup & 0x07] | overflowSubTable[lookup >> 4] | sz53Table[regs[1]];
	break;case 156:
	
	
var sbctemp = regs[1] - regs[7] - (regs[0] & 1);
var lookup = ( (regs[1] & 0x88) >> 3 ) | ( (regs[7] & 0x88) >> 2 ) | ( (sbctemp & 0x88) >> 1 );
regs[1] = sbctemp;
regs[0] = ( sbctemp & 0x100 ? 1 : 0 ) | 2 | halfcarrySubTable[lookup & 0x07] | overflowSubTable[lookup >> 4] | sz53Table[regs[1]];
	break;case 157:
	
	
var sbctemp = regs[1] - regs[6] - (regs[0] & 1);
var lookup = ( (regs[1] & 0x88) >> 3 ) | ( (regs[6] & 0x88) >> 2 ) | ( (sbctemp & 0x88) >> 1 );
regs[1] = sbctemp;
regs[0] = ( sbctemp & 0x100 ? 1 : 0 ) | 2 | halfcarrySubTable[lookup & 0x07] | overflowSubTable[lookup >> 4] | sz53Table[regs[1]];
	break;case 158:
	
	var val = (tstates += ( 3), memory.read(regPairs[3]));
var sbctemp = regs[1] - val - (regs[0] & 1);
var lookup = ( (regs[1] & 0x88) >> 3 ) | ( (val & 0x88) >> 2 ) | ( (sbctemp & 0x88) >> 1 );
regs[1] = sbctemp;
regs[0] = ( sbctemp & 0x100 ? 1 : 0 ) | 2 | halfcarrySubTable[lookup & 0x07] | overflowSubTable[lookup >> 4] | sz53Table[regs[1]];
	break;case 159:
	
	
var sbctemp = regs[1] - regs[1] - (regs[0] & 1);
var lookup = ( (regs[1] & 0x88) >> 3 ) | ( (regs[1] & 0x88) >> 2 ) | ( (sbctemp & 0x88) >> 1 );
regs[1] = sbctemp;
regs[0] = ( sbctemp & 0x100 ? 1 : 0 ) | 2 | halfcarrySubTable[lookup & 0x07] | overflowSubTable[lookup >> 4] | sz53Table[regs[1]];
	break;case 160:
	
	

regs[1] &= regs[3];
regs[0] = 16 | sz53pTable[regs[1]];
	break;case 161:
	
	

regs[1] &= regs[2];
regs[0] = 16 | sz53pTable[regs[1]];
	break;case 162:
	
	

regs[1] &= regs[5];
regs[0] = 16 | sz53pTable[regs[1]];
	break;case 163:
	
	

regs[1] &= regs[4];
regs[0] = 16 | sz53pTable[regs[1]];
	break;case 164:
	
	

regs[1] &= regs[7];
regs[0] = 16 | sz53pTable[regs[1]];
	break;case 165:
	
	

regs[1] &= regs[6];
regs[0] = 16 | sz53pTable[regs[1]];
	break;case 166:
	
	var val = (tstates += ( 3), memory.read(regPairs[3]));

regs[1] &= val;
regs[0] = 16 | sz53pTable[regs[1]];
	break;case 167:
	
	

regs[1] &= regs[1];
regs[0] = 16 | sz53pTable[regs[1]];
	break;case 168:
	
	
regs[1] ^= regs[3];
regs[0] = sz53pTable[regs[1]];
	break;case 169:
	
	
regs[1] ^= regs[2];
regs[0] = sz53pTable[regs[1]];
	break;case 170:
	
	
regs[1] ^= regs[5];
regs[0] = sz53pTable[regs[1]];
	break;case 171:
	
	
regs[1] ^= regs[4];
regs[0] = sz53pTable[regs[1]];
	break;case 172:
	
	
regs[1] ^= regs[7];
regs[0] = sz53pTable[regs[1]];
	break;case 173:
	
	
regs[1] ^= regs[6];
regs[0] = sz53pTable[regs[1]];
	break;case 174:
	
	var val = (tstates += ( 3), memory.read(regPairs[3]));
regs[1] ^= val;
regs[0] = sz53pTable[regs[1]];
	break;case 175:
	
	
regs[1] ^= regs[1];
regs[0] = sz53pTable[regs[1]];
	break;case 176:
	
	

regs[1] |= regs[3];
regs[0] = sz53pTable[regs[1]];
	break;case 177:
	
	

regs[1] |= regs[2];
regs[0] = sz53pTable[regs[1]];
	break;case 178:
	
	

regs[1] |= regs[5];
regs[0] = sz53pTable[regs[1]];
	break;case 179:
	
	

regs[1] |= regs[4];
regs[0] = sz53pTable[regs[1]];
	break;case 180:
	
	

regs[1] |= regs[7];
regs[0] = sz53pTable[regs[1]];
	break;case 181:
	
	

regs[1] |= regs[6];
regs[0] = sz53pTable[regs[1]];
	break;case 182:
	
	var val = (tstates += ( 3), memory.read(regPairs[3]));

regs[1] |= val;
regs[0] = sz53pTable[regs[1]];
	break;case 183:
	
	

regs[1] |= regs[1];
regs[0] = sz53pTable[regs[1]];
	break;case 184:
	
	

var cptemp = regs[1] - regs[3];
var lookup = ( (regs[1] & 0x88) >> 3 ) | ( (regs[3] & 0x88) >> 2 ) | ( (cptemp & 0x88) >> 1 );
regs[0] = ( cptemp & 0x100 ? 1 : ( cptemp ? 0 : 64 ) ) | 2 | halfcarrySubTable[lookup & 0x07] | overflowSubTable[lookup >> 4] | ( regs[3] & 40 ) | ( cptemp & 128 );
	break;case 185:
	
	

var cptemp = regs[1] - regs[2];
var lookup = ( (regs[1] & 0x88) >> 3 ) | ( (regs[2] & 0x88) >> 2 ) | ( (cptemp & 0x88) >> 1 );
regs[0] = ( cptemp & 0x100 ? 1 : ( cptemp ? 0 : 64 ) ) | 2 | halfcarrySubTable[lookup & 0x07] | overflowSubTable[lookup >> 4] | ( regs[2] & 40 ) | ( cptemp & 128 );
	break;case 186:
	
	

var cptemp = regs[1] - regs[5];
var lookup = ( (regs[1] & 0x88) >> 3 ) | ( (regs[5] & 0x88) >> 2 ) | ( (cptemp & 0x88) >> 1 );
regs[0] = ( cptemp & 0x100 ? 1 : ( cptemp ? 0 : 64 ) ) | 2 | halfcarrySubTable[lookup & 0x07] | overflowSubTable[lookup >> 4] | ( regs[5] & 40 ) | ( cptemp & 128 );
	break;case 187:
	
	

var cptemp = regs[1] - regs[4];
var lookup = ( (regs[1] & 0x88) >> 3 ) | ( (regs[4] & 0x88) >> 2 ) | ( (cptemp & 0x88) >> 1 );
regs[0] = ( cptemp & 0x100 ? 1 : ( cptemp ? 0 : 64 ) ) | 2 | halfcarrySubTable[lookup & 0x07] | overflowSubTable[lookup >> 4] | ( regs[4] & 40 ) | ( cptemp & 128 );
	break;case 188:
	
	

var cptemp = regs[1] - regs[7];
var lookup = ( (regs[1] & 0x88) >> 3 ) | ( (regs[7] & 0x88) >> 2 ) | ( (cptemp & 0x88) >> 1 );
regs[0] = ( cptemp & 0x100 ? 1 : ( cptemp ? 0 : 64 ) ) | 2 | halfcarrySubTable[lookup & 0x07] | overflowSubTable[lookup >> 4] | ( regs[7] & 40 ) | ( cptemp & 128 );
	break;case 189:
	
	

var cptemp = regs[1] - regs[6];
var lookup = ( (regs[1] & 0x88) >> 3 ) | ( (regs[6] & 0x88) >> 2 ) | ( (cptemp & 0x88) >> 1 );
regs[0] = ( cptemp & 0x100 ? 1 : ( cptemp ? 0 : 64 ) ) | 2 | halfcarrySubTable[lookup & 0x07] | overflowSubTable[lookup >> 4] | ( regs[6] & 40 ) | ( cptemp & 128 );
	break;case 190:
	
	var val = (tstates += ( 3), memory.read(regPairs[3]));

var cptemp = regs[1] - val;
var lookup = ( (regs[1] & 0x88) >> 3 ) | ( (val & 0x88) >> 2 ) | ( (cptemp & 0x88) >> 1 );
regs[0] = ( cptemp & 0x100 ? 1 : ( cptemp ? 0 : 64 ) ) | 2 | halfcarrySubTable[lookup & 0x07] | overflowSubTable[lookup >> 4] | ( val & 40 ) | ( cptemp & 128 );
	break;case 191:
	
	

var cptemp = regs[1] - regs[1];
var lookup = ( (regs[1] & 0x88) >> 3 ) | ( (regs[1] & 0x88) >> 2 ) | ( (cptemp & 0x88) >> 1 );
regs[0] = ( cptemp & 0x100 ? 1 : ( cptemp ? 0 : 64 ) ) | 2 | halfcarrySubTable[lookup & 0x07] | overflowSubTable[lookup >> 4] | ( regs[1] & 40 ) | ( cptemp & 128 );
	break;case 192:
	
	tstates += ( 1);
if (!(regs[0] & 64)) {
	var l = (tstates += ( 3), memory.read(regPairs[11])); regPairs[11]++;
	var h = (tstates += ( 3), memory.read(regPairs[11])); regPairs[11]++;
	regPairs[12] = (h<<8) | l;
}
	break;case 193:
	
	var l = (tstates += ( 3), memory.read(regPairs[11])); regPairs[11]++;
var h = (tstates += ( 3), memory.read(regPairs[11])); regPairs[11]++;
regPairs[1] = (h<<8) | l;
	break;case 194:
	
	if (!(regs[0] & 64)) {
	var l = (tstates += ( 3), memory.read(regPairs[12])); regPairs[12]++;
	var h = (tstates += ( 3), memory.read(regPairs[12])); regPairs[12]++;
	regPairs[12] = (h<<8) | l;
} else {
	tstates += ( 3);
	regPairs[12]++;
	tstates += ( 3);
	regPairs[12]++;
}
	break;case 195:
	
	var l = (tstates += ( 3), memory.read(regPairs[12])); regPairs[12]++;
var h = (tstates += ( 3), memory.read(regPairs[12])); regPairs[12]++;
regPairs[12] = (h<<8) | l;
	break;case 196:
	
	if (!(regs[0] & 64)) {
	var l = (tstates += ( 3), memory.read(regPairs[12])); regPairs[12]++;
	var h = (tstates += ( 3), memory.read(regPairs[12]));
	tstates += ( 1);
	regPairs[12]++;
	regPairs[11]--; tstates += ( 3);
while (display.nextEventTime != null && display.nextEventTime < tstates) display.doEvent();
memory.write(regPairs[11], regPairs[12] >> 8);;
	regPairs[11]--; tstates += ( 3);
while (display.nextEventTime != null && display.nextEventTime < tstates) display.doEvent();
memory.write(regPairs[11], regPairs[12] & 0xff);;
	regPairs[12] = (h<<8) | l;
} else {
	tstates += ( 3);
	regPairs[12]++;
	tstates += ( 3);
	regPairs[12]++;
}
	break;case 197:
	
	tstates += ( 1);
regPairs[11]--; tstates += ( 3);
while (display.nextEventTime != null && display.nextEventTime < tstates) display.doEvent();
memory.write(regPairs[11], regPairs[1] >> 8);;
regPairs[11]--; tstates += ( 3);
while (display.nextEventTime != null && display.nextEventTime < tstates) display.doEvent();
memory.write(regPairs[11], regPairs[1] & 0xff);;
	break;case 198:
	
	var val = (tstates += ( 3), memory.read(regPairs[12])); regPairs[12]++;

var addtemp = regs[1] + val;
var lookup = ( (regs[1] & 0x88) >> 3 ) | ( (val & 0x88) >> 2 ) | ( (addtemp & 0x88) >> 1 );
regs[1] = addtemp;
regs[0] = ( addtemp & 0x100 ? 1 : 0 ) | halfcarryAddTable[lookup & 0x07] | overflowAddTable[lookup >> 4] | sz53Table[regs[1]];
	break;case 199:
	
	tstates += ( 1);
regPairs[11]--; tstates += ( 3);
while (display.nextEventTime != null && display.nextEventTime < tstates) display.doEvent();
memory.write(regPairs[11], regPairs[12] >> 8);;
regPairs[11]--; tstates += ( 3);
while (display.nextEventTime != null && display.nextEventTime < tstates) display.doEvent();
memory.write(regPairs[11], regPairs[12] & 0xff);;
regPairs[12] = 0;
	break;case 200:
	
	tstates += ( 1);
if (regs[0] & 64) {
	var l = (tstates += ( 3), memory.read(regPairs[11])); regPairs[11]++;
	var h = (tstates += ( 3), memory.read(regPairs[11])); regPairs[11]++;
	regPairs[12] = (h<<8) | l;
}
	break;case 201:
	
	var l = (tstates += ( 3), memory.read(regPairs[11])); regPairs[11]++;
var h = (tstates += ( 3), memory.read(regPairs[11])); regPairs[11]++;
regPairs[12] = (h<<8) | l;
	break;case 202:
	
	if (regs[0] & 64) {
	var l = (tstates += ( 3), memory.read(regPairs[12])); regPairs[12]++;
	var h = (tstates += ( 3), memory.read(regPairs[12])); regPairs[12]++;
	regPairs[12] = (h<<8) | l;
} else {
	tstates += ( 3);
	regPairs[12]++;
	tstates += ( 3);
	regPairs[12]++;
}
	break;case 203:
	
	opcodePrefix = 'CB';
interruptible = false;
	break;case 204:
	
	if (regs[0] & 64) {
	var l = (tstates += ( 3), memory.read(regPairs[12])); regPairs[12]++;
	var h = (tstates += ( 3), memory.read(regPairs[12]));
	tstates += ( 1);
	regPairs[12]++;
	regPairs[11]--; tstates += ( 3);
while (display.nextEventTime != null && display.nextEventTime < tstates) display.doEvent();
memory.write(regPairs[11], regPairs[12] >> 8);;
	regPairs[11]--; tstates += ( 3);
while (display.nextEventTime != null && display.nextEventTime < tstates) display.doEvent();
memory.write(regPairs[11], regPairs[12] & 0xff);;
	regPairs[12] = (h<<8) | l;
} else {
	tstates += ( 3);
	regPairs[12]++;
	tstates += ( 3);
	regPairs[12]++;
}
	break;case 205:
	
	var l = (tstates += ( 3), memory.read(regPairs[12])); regPairs[12]++;
var h = (tstates += ( 3), memory.read(regPairs[12]));
tstates += ( 1);
regPairs[12]++;
regPairs[11]--; tstates += ( 3);
while (display.nextEventTime != null && display.nextEventTime < tstates) display.doEvent();
memory.write(regPairs[11], regPairs[12] >> 8);;
regPairs[11]--; tstates += ( 3);
while (display.nextEventTime != null && display.nextEventTime < tstates) display.doEvent();
memory.write(regPairs[11], regPairs[12] & 0xff);;
regPairs[12] = (h<<8) | l;
	break;case 206:
	
	var val = (tstates += ( 3), memory.read(regPairs[12])); regPairs[12]++;

var adctemp = regs[1] + val + (regs[0] & 1);
var lookup = ( (regs[1] & 0x88) >> 3 ) | ( (val & 0x88) >> 2 ) | ( (adctemp & 0x88) >> 1 );
regs[1] = adctemp;
regs[0] = ( adctemp & 0x100 ? 1 : 0 ) | halfcarryAddTable[lookup & 0x07] | overflowAddTable[lookup >> 4] | sz53Table[regs[1]];
	break;case 207:
	
	tstates += ( 1);
regPairs[11]--; tstates += ( 3);
while (display.nextEventTime != null && display.nextEventTime < tstates) display.doEvent();
memory.write(regPairs[11], regPairs[12] >> 8);;
regPairs[11]--; tstates += ( 3);
while (display.nextEventTime != null && display.nextEventTime < tstates) display.doEvent();
memory.write(regPairs[11], regPairs[12] & 0xff);;
regPairs[12] = 8;
	break;case 208:
	
	tstates += ( 1);
if (!(regs[0] & 1)) {
	var l = (tstates += ( 3), memory.read(regPairs[11])); regPairs[11]++;
	var h = (tstates += ( 3), memory.read(regPairs[11])); regPairs[11]++;
	regPairs[12] = (h<<8) | l;
}
	break;case 209:
	
	var l = (tstates += ( 3), memory.read(regPairs[11])); regPairs[11]++;
var h = (tstates += ( 3), memory.read(regPairs[11])); regPairs[11]++;
regPairs[2] = (h<<8) | l;
	break;case 210:
	
	if (!(regs[0] & 1)) {
	var l = (tstates += ( 3), memory.read(regPairs[12])); regPairs[12]++;
	var h = (tstates += ( 3), memory.read(regPairs[12])); regPairs[12]++;
	regPairs[12] = (h<<8) | l;
} else {
	tstates += ( 3);
	regPairs[12]++;
	tstates += ( 3);
	regPairs[12]++;
}
	break;case 211:
	
	var port = (regs[1] << 8) | (tstates += ( 3), memory.read(regPairs[12])); regPairs[12]++;
tstates += 1;
ioBus.write(port, regs[1], tstates);
tstates += 3;
	break;case 212:
	
	if (!(regs[0] & 1)) {
	var l = (tstates += ( 3), memory.read(regPairs[12])); regPairs[12]++;
	var h = (tstates += ( 3), memory.read(regPairs[12]));
	tstates += ( 1);
	regPairs[12]++;
	regPairs[11]--; tstates += ( 3);
while (display.nextEventTime != null && display.nextEventTime < tstates) display.doEvent();
memory.write(regPairs[11], regPairs[12] >> 8);;
	regPairs[11]--; tstates += ( 3);
while (display.nextEventTime != null && display.nextEventTime < tstates) display.doEvent();
memory.write(regPairs[11], regPairs[12] & 0xff);;
	regPairs[12] = (h<<8) | l;
} else {
	tstates += ( 3);
	regPairs[12]++;
	tstates += ( 3);
	regPairs[12]++;
}
	break;case 213:
	
	tstates += ( 1);
regPairs[11]--; tstates += ( 3);
while (display.nextEventTime != null && display.nextEventTime < tstates) display.doEvent();
memory.write(regPairs[11], regPairs[2] >> 8);;
regPairs[11]--; tstates += ( 3);
while (display.nextEventTime != null && display.nextEventTime < tstates) display.doEvent();
memory.write(regPairs[11], regPairs[2] & 0xff);;
	break;case 214:
	
	var val = (tstates += ( 3), memory.read(regPairs[12])); regPairs[12]++;
var subtemp = regs[1] - val;
var lookup = ( (regs[1] & 0x88) >> 3 ) | ( (val & 0x88) >> 2 ) | ( (subtemp & 0x88) >> 1 );
regs[1] = subtemp;
regs[0] = ( subtemp & 0x100 ? 1 : 0 ) | 2 | halfcarrySubTable[lookup & 0x07] | overflowSubTable[lookup >> 4] | sz53Table[regs[1]];
	break;case 215:
	
	tstates += ( 1);
regPairs[11]--; tstates += ( 3);
while (display.nextEventTime != null && display.nextEventTime < tstates) display.doEvent();
memory.write(regPairs[11], regPairs[12] >> 8);;
regPairs[11]--; tstates += ( 3);
while (display.nextEventTime != null && display.nextEventTime < tstates) display.doEvent();
memory.write(regPairs[11], regPairs[12] & 0xff);;
regPairs[12] = 16;
	break;case 216:
	
	tstates += ( 1);
if (regs[0] & 1) {
	var l = (tstates += ( 3), memory.read(regPairs[11])); regPairs[11]++;
	var h = (tstates += ( 3), memory.read(regPairs[11])); regPairs[11]++;
	regPairs[12] = (h<<8) | l;
}
	break;case 217:
	
	var wordtemp;
wordtemp = regPairs[1]; regPairs[1] = regPairs[5]; regPairs[5] = wordtemp;
wordtemp = regPairs[2]; regPairs[2] = regPairs[6]; regPairs[6] = wordtemp;
wordtemp = regPairs[3]; regPairs[3] = regPairs[7]; regPairs[7] = wordtemp;
	break;case 218:
	
	if (regs[0] & 1) {
	var l = (tstates += ( 3), memory.read(regPairs[12])); regPairs[12]++;
	var h = (tstates += ( 3), memory.read(regPairs[12])); regPairs[12]++;
	regPairs[12] = (h<<8) | l;
} else {
	tstates += ( 3);
	regPairs[12]++;
	tstates += ( 3);
	regPairs[12]++;
}
	break;case 219:
	
	var val = (tstates += ( 3), memory.read(regPairs[12])); regPairs[12]++;
var port = (regs[1] << 8) | val;
tstates += 1;
regs[1] = ioBus.read(port);
tstates += 3;
	break;case 220:
	
	if (regs[0] & 1) {
	var l = (tstates += ( 3), memory.read(regPairs[12])); regPairs[12]++;
	var h = (tstates += ( 3), memory.read(regPairs[12]));
	tstates += ( 1);
	regPairs[12]++;
	regPairs[11]--; tstates += ( 3);
while (display.nextEventTime != null && display.nextEventTime < tstates) display.doEvent();
memory.write(regPairs[11], regPairs[12] >> 8);;
	regPairs[11]--; tstates += ( 3);
while (display.nextEventTime != null && display.nextEventTime < tstates) display.doEvent();
memory.write(regPairs[11], regPairs[12] & 0xff);;
	regPairs[12] = (h<<8) | l;
} else {
	tstates += ( 3);
	regPairs[12]++;
	tstates += ( 3);
	regPairs[12]++;
}
	break;case 221:
	
	opcodePrefix = 'DD';
interruptible = false;
	break;case 222:
	
	var val = (tstates += ( 3), memory.read(regPairs[12])); regPairs[12]++;
var sbctemp = regs[1] - val - (regs[0] & 1);
var lookup = ( (regs[1] & 0x88) >> 3 ) | ( (val & 0x88) >> 2 ) | ( (sbctemp & 0x88) >> 1 );
regs[1] = sbctemp;
regs[0] = ( sbctemp & 0x100 ? 1 : 0 ) | 2 | halfcarrySubTable[lookup & 0x07] | overflowSubTable[lookup >> 4] | sz53Table[regs[1]];
	break;case 223:
	
	tstates += ( 1);
regPairs[11]--; tstates += ( 3);
while (display.nextEventTime != null && display.nextEventTime < tstates) display.doEvent();
memory.write(regPairs[11], regPairs[12] >> 8);;
regPairs[11]--; tstates += ( 3);
while (display.nextEventTime != null && display.nextEventTime < tstates) display.doEvent();
memory.write(regPairs[11], regPairs[12] & 0xff);;
regPairs[12] = 24;
	break;case 224:
	
	tstates += ( 1);
if (!(regs[0] & 4)) {
	var l = (tstates += ( 3), memory.read(regPairs[11])); regPairs[11]++;
	var h = (tstates += ( 3), memory.read(regPairs[11])); regPairs[11]++;
	regPairs[12] = (h<<8) | l;
}
	break;case 225:
	
	var l = (tstates += ( 3), memory.read(regPairs[11])); regPairs[11]++;
var h = (tstates += ( 3), memory.read(regPairs[11])); regPairs[11]++;
regPairs[3] = (h<<8) | l;
	break;case 226:
	
	if (!(regs[0] & 4)) {
	var l = (tstates += ( 3), memory.read(regPairs[12])); regPairs[12]++;
	var h = (tstates += ( 3), memory.read(regPairs[12])); regPairs[12]++;
	regPairs[12] = (h<<8) | l;
} else {
	tstates += ( 3);
	regPairs[12]++;
	tstates += ( 3);
	regPairs[12]++;
}
	break;case 227:
	
	var l = (tstates += ( 3), memory.read(regPairs[11]));
var spPlus1 = (regPairs[11] + 1) & 0xffff;
var h = (tstates += ( 3), memory.read(spPlus1));
tstates += ( 1);
tstates += ( 3);
while (display.nextEventTime != null && display.nextEventTime < tstates) display.doEvent();
memory.write(spPlus1, regPairs[3] >> 8);;
tstates += ( 3);
while (display.nextEventTime != null && display.nextEventTime < tstates) display.doEvent();
memory.write(regPairs[11], regPairs[3] & 0xff);;
regPairs[3] = (h<<8) | l;
tstates += ( 1);
tstates += ( 1);
	break;case 228:
	
	if (!(regs[0] & 4)) {
	var l = (tstates += ( 3), memory.read(regPairs[12])); regPairs[12]++;
	var h = (tstates += ( 3), memory.read(regPairs[12]));
	tstates += ( 1);
	regPairs[12]++;
	regPairs[11]--; tstates += ( 3);
while (display.nextEventTime != null && display.nextEventTime < tstates) display.doEvent();
memory.write(regPairs[11], regPairs[12] >> 8);;
	regPairs[11]--; tstates += ( 3);
while (display.nextEventTime != null && display.nextEventTime < tstates) display.doEvent();
memory.write(regPairs[11], regPairs[12] & 0xff);;
	regPairs[12] = (h<<8) | l;
} else {
	tstates += ( 3);
	regPairs[12]++;
	tstates += ( 3);
	regPairs[12]++;
}
	break;case 229:
	
	tstates += ( 1);
regPairs[11]--; tstates += ( 3);
while (display.nextEventTime != null && display.nextEventTime < tstates) display.doEvent();
memory.write(regPairs[11], regPairs[3] >> 8);;
regPairs[11]--; tstates += ( 3);
while (display.nextEventTime != null && display.nextEventTime < tstates) display.doEvent();
memory.write(regPairs[11], regPairs[3] & 0xff);;
	break;case 230:
	
	var val = (tstates += ( 3), memory.read(regPairs[12])); regPairs[12]++;

regs[1] &= val;
regs[0] = 16 | sz53pTable[regs[1]];
	break;case 231:
	
	tstates += ( 1);
regPairs[11]--; tstates += ( 3);
while (display.nextEventTime != null && display.nextEventTime < tstates) display.doEvent();
memory.write(regPairs[11], regPairs[12] >> 8);;
regPairs[11]--; tstates += ( 3);
while (display.nextEventTime != null && display.nextEventTime < tstates) display.doEvent();
memory.write(regPairs[11], regPairs[12] & 0xff);;
regPairs[12] = 32;
	break;case 232:
	
	tstates += ( 1);
if (regs[0] & 4) {
	var l = (tstates += ( 3), memory.read(regPairs[11])); regPairs[11]++;
	var h = (tstates += ( 3), memory.read(regPairs[11])); regPairs[11]++;
	regPairs[12] = (h<<8) | l;
}
	break;case 233:
	
	regPairs[12] = regPairs[3];
	break;case 234:
	
	if (regs[0] & 4) {
	var l = (tstates += ( 3), memory.read(regPairs[12])); regPairs[12]++;
	var h = (tstates += ( 3), memory.read(regPairs[12])); regPairs[12]++;
	regPairs[12] = (h<<8) | l;
} else {
	tstates += ( 3);
	regPairs[12]++;
	tstates += ( 3);
	regPairs[12]++;
}
	break;case 235:
	
	var temp = regPairs[2];
regPairs[2] = regPairs[3];
regPairs[3] = temp;
	break;case 236:
	
	if (regs[0] & 4) {
	var l = (tstates += ( 3), memory.read(regPairs[12])); regPairs[12]++;
	var h = (tstates += ( 3), memory.read(regPairs[12]));
	tstates += ( 1);
	regPairs[12]++;
	regPairs[11]--; tstates += ( 3);
while (display.nextEventTime != null && display.nextEventTime < tstates) display.doEvent();
memory.write(regPairs[11], regPairs[12] >> 8);;
	regPairs[11]--; tstates += ( 3);
while (display.nextEventTime != null && display.nextEventTime < tstates) display.doEvent();
memory.write(regPairs[11], regPairs[12] & 0xff);;
	regPairs[12] = (h<<8) | l;
} else {
	tstates += ( 3);
	regPairs[12]++;
	tstates += ( 3);
	regPairs[12]++;
}
	break;case 237:
	
	opcodePrefix = 'ED';
interruptible = false;
	break;case 238:
	
	var val = (tstates += ( 3), memory.read(regPairs[12])); regPairs[12]++;
regs[1] ^= val;
regs[0] = sz53pTable[regs[1]];
	break;case 239:
	
	tstates += ( 1);
regPairs[11]--; tstates += ( 3);
while (display.nextEventTime != null && display.nextEventTime < tstates) display.doEvent();
memory.write(regPairs[11], regPairs[12] >> 8);;
regPairs[11]--; tstates += ( 3);
while (display.nextEventTime != null && display.nextEventTime < tstates) display.doEvent();
memory.write(regPairs[11], regPairs[12] & 0xff);;
regPairs[12] = 40;
	break;case 240:
	
	tstates += ( 1);
if (!(regs[0] & 128)) {
	var l = (tstates += ( 3), memory.read(regPairs[11])); regPairs[11]++;
	var h = (tstates += ( 3), memory.read(regPairs[11])); regPairs[11]++;
	regPairs[12] = (h<<8) | l;
}
	break;case 241:
	
	var l = (tstates += ( 3), memory.read(regPairs[11])); regPairs[11]++;
var h = (tstates += ( 3), memory.read(regPairs[11])); regPairs[11]++;
regPairs[0] = (h<<8) | l;
	break;case 242:
	
	if (!(regs[0] & 128)) {
	var l = (tstates += ( 3), memory.read(regPairs[12])); regPairs[12]++;
	var h = (tstates += ( 3), memory.read(regPairs[12])); regPairs[12]++;
	regPairs[12] = (h<<8) | l;
} else {
	tstates += ( 3);
	regPairs[12]++;
	tstates += ( 3);
	regPairs[12]++;
}
	break;case 243:
	
	iff1 = iff2 = 0;
	break;case 244:
	
	if (!(regs[0] & 128)) {
	var l = (tstates += ( 3), memory.read(regPairs[12])); regPairs[12]++;
	var h = (tstates += ( 3), memory.read(regPairs[12]));
	tstates += ( 1);
	regPairs[12]++;
	regPairs[11]--; tstates += ( 3);
while (display.nextEventTime != null && display.nextEventTime < tstates) display.doEvent();
memory.write(regPairs[11], regPairs[12] >> 8);;
	regPairs[11]--; tstates += ( 3);
while (display.nextEventTime != null && display.nextEventTime < tstates) display.doEvent();
memory.write(regPairs[11], regPairs[12] & 0xff);;
	regPairs[12] = (h<<8) | l;
} else {
	tstates += ( 3);
	regPairs[12]++;
	tstates += ( 3);
	regPairs[12]++;
}
	break;case 245:
	
	tstates += ( 1);
regPairs[11]--; tstates += ( 3);
while (display.nextEventTime != null && display.nextEventTime < tstates) display.doEvent();
memory.write(regPairs[11], regPairs[0] >> 8);;
regPairs[11]--; tstates += ( 3);
while (display.nextEventTime != null && display.nextEventTime < tstates) display.doEvent();
memory.write(regPairs[11], regPairs[0] & 0xff);;
	break;case 246:
	
	var val = (tstates += ( 3), memory.read(regPairs[12])); regPairs[12]++;

regs[1] |= val;
regs[0] = sz53pTable[regs[1]];
	break;case 247:
	
	tstates += ( 1);
regPairs[11]--; tstates += ( 3);
while (display.nextEventTime != null && display.nextEventTime < tstates) display.doEvent();
memory.write(regPairs[11], regPairs[12] >> 8);;
regPairs[11]--; tstates += ( 3);
while (display.nextEventTime != null && display.nextEventTime < tstates) display.doEvent();
memory.write(regPairs[11], regPairs[12] & 0xff);;
regPairs[12] = 48;
	break;case 248:
	
	tstates += ( 1);
if (regs[0] & 128) {
	var l = (tstates += ( 3), memory.read(regPairs[11])); regPairs[11]++;
	var h = (tstates += ( 3), memory.read(regPairs[11])); regPairs[11]++;
	regPairs[12] = (h<<8) | l;
}
	break;case 249:
	
	regPairs[11] = regPairs[3];
tstates += ( 1);
tstates += ( 1);
	break;case 250:
	
	if (regs[0] & 128) {
	var l = (tstates += ( 3), memory.read(regPairs[12])); regPairs[12]++;
	var h = (tstates += ( 3), memory.read(regPairs[12])); regPairs[12]++;
	regPairs[12] = (h<<8) | l;
} else {
	tstates += ( 3);
	regPairs[12]++;
	tstates += ( 3);
	regPairs[12]++;
}
	break;case 251:
	
	iff1 = iff2 = 1;
interruptible = false;
	break;case 252:
	
	if (regs[0] & 128) {
	var l = (tstates += ( 3), memory.read(regPairs[12])); regPairs[12]++;
	var h = (tstates += ( 3), memory.read(regPairs[12]));
	tstates += ( 1);
	regPairs[12]++;
	regPairs[11]--; tstates += ( 3);
while (display.nextEventTime != null && display.nextEventTime < tstates) display.doEvent();
memory.write(regPairs[11], regPairs[12] >> 8);;
	regPairs[11]--; tstates += ( 3);
while (display.nextEventTime != null && display.nextEventTime < tstates) display.doEvent();
memory.write(regPairs[11], regPairs[12] & 0xff);;
	regPairs[12] = (h<<8) | l;
} else {
	tstates += ( 3);
	regPairs[12]++;
	tstates += ( 3);
	regPairs[12]++;
}
	break;case 253:
	
	opcodePrefix = 'FD';
interruptible = false;
	break;case 254:
	
	var val = (tstates += ( 3), memory.read(regPairs[12])); regPairs[12]++;

var cptemp = regs[1] - val;
var lookup = ( (regs[1] & 0x88) >> 3 ) | ( (val & 0x88) >> 2 ) | ( (cptemp & 0x88) >> 1 );
regs[0] = ( cptemp & 0x100 ? 1 : ( cptemp ? 0 : 64 ) ) | 2 | halfcarrySubTable[lookup & 0x07] | overflowSubTable[lookup >> 4] | ( val & 40 ) | ( cptemp & 128 );
	break;case 255:
	
	tstates += ( 1);
regPairs[11]--; tstates += ( 3);
while (display.nextEventTime != null && display.nextEventTime < tstates) display.doEvent();
memory.write(regPairs[11], regPairs[12] >> 8);;
regPairs[11]--; tstates += ( 3);
while (display.nextEventTime != null && display.nextEventTime < tstates) display.doEvent();
memory.write(regPairs[11], regPairs[12] & 0xff);;
regPairs[12] = 56;
	break;
	default:
		var addr = regPairs[12] - 1;
		throw("Unimplemented opcode " + opcode + " in page 0 - PC = " + addr);
}
					break;
				case 'CB':
					tstates += ( 4);
					opcode = memory.read(regPairs[12]); regPairs[12]++;
					regs[20] = ((regs[20] + 1) & 0x7f) | (regs[20] & 0x80);
					switch (opcode) {
	case 0:
	
	
regs[3] = ( (regs[3] << 1) | (regs[3] >> 7) ) ;
regs[0] = (regs[3] & 1) | sz53pTable[regs[3]];

	break;case 1:
	
	
regs[2] = ( (regs[2] << 1) | (regs[2] >> 7) ) ;
regs[0] = (regs[2] & 1) | sz53pTable[regs[2]];

	break;case 2:
	
	
regs[5] = ( (regs[5] << 1) | (regs[5] >> 7) ) ;
regs[0] = (regs[5] & 1) | sz53pTable[regs[5]];

	break;case 3:
	
	
regs[4] = ( (regs[4] << 1) | (regs[4] >> 7) ) ;
regs[0] = (regs[4] & 1) | sz53pTable[regs[4]];

	break;case 4:
	
	
regs[7] = ( (regs[7] << 1) | (regs[7] >> 7) ) ;
regs[0] = (regs[7] & 1) | sz53pTable[regs[7]];

	break;case 5:
	
	
regs[6] = ( (regs[6] << 1) | (regs[6] >> 7) ) ;
regs[0] = (regs[6] & 1) | sz53pTable[regs[6]];

	break;case 6:
	
	var val = (tstates += ( 3), memory.read(regPairs[3]));
val = ( (val << 1) | (val >> 7) ) & 0xff;
regs[0] = (val & 1) | sz53pTable[val];
tstates += ( 1);
tstates += ( 3);
while (display.nextEventTime != null && display.nextEventTime < tstates) display.doEvent();
memory.write(regPairs[3], val);;
	break;case 7:
	
	
regs[1] = ( (regs[1] << 1) | (regs[1] >> 7) ) ;
regs[0] = (regs[1] & 1) | sz53pTable[regs[1]];

	break;case 8:
	
	
regs[0] = regs[3] & 1;
regs[3] = ( (regs[3] >> 1) | (regs[3] << 7) ) ;
regs[0] |= sz53pTable[regs[3]];

	break;case 9:
	
	
regs[0] = regs[2] & 1;
regs[2] = ( (regs[2] >> 1) | (regs[2] << 7) ) ;
regs[0] |= sz53pTable[regs[2]];

	break;case 10:
	
	
regs[0] = regs[5] & 1;
regs[5] = ( (regs[5] >> 1) | (regs[5] << 7) ) ;
regs[0] |= sz53pTable[regs[5]];

	break;case 11:
	
	
regs[0] = regs[4] & 1;
regs[4] = ( (regs[4] >> 1) | (regs[4] << 7) ) ;
regs[0] |= sz53pTable[regs[4]];

	break;case 12:
	
	
regs[0] = regs[7] & 1;
regs[7] = ( (regs[7] >> 1) | (regs[7] << 7) ) ;
regs[0] |= sz53pTable[regs[7]];

	break;case 13:
	
	
regs[0] = regs[6] & 1;
regs[6] = ( (regs[6] >> 1) | (regs[6] << 7) ) ;
regs[0] |= sz53pTable[regs[6]];

	break;case 14:
	
	var val = (tstates += ( 3), memory.read(regPairs[3]));
regs[0] = val & 1;
val = ( (val >> 1) | (val << 7) ) & 0xff;
regs[0] |= sz53pTable[val];
tstates += ( 1);
tstates += ( 3);
while (display.nextEventTime != null && display.nextEventTime < tstates) display.doEvent();
memory.write(regPairs[3], val);;
	break;case 15:
	
	
regs[0] = regs[1] & 1;
regs[1] = ( (regs[1] >> 1) | (regs[1] << 7) ) ;
regs[0] |= sz53pTable[regs[1]];

	break;case 16:
	
	
var rltemp = regs[3];
regs[3] = ( (regs[3] << 1) | (regs[0] & 1) ) ;
regs[0] = ( rltemp >> 7 ) | sz53pTable[regs[3]];

	break;case 17:
	
	
var rltemp = regs[2];
regs[2] = ( (regs[2] << 1) | (regs[0] & 1) ) ;
regs[0] = ( rltemp >> 7 ) | sz53pTable[regs[2]];

	break;case 18:
	
	
var rltemp = regs[5];
regs[5] = ( (regs[5] << 1) | (regs[0] & 1) ) ;
regs[0] = ( rltemp >> 7 ) | sz53pTable[regs[5]];

	break;case 19:
	
	
var rltemp = regs[4];
regs[4] = ( (regs[4] << 1) | (regs[0] & 1) ) ;
regs[0] = ( rltemp >> 7 ) | sz53pTable[regs[4]];

	break;case 20:
	
	
var rltemp = regs[7];
regs[7] = ( (regs[7] << 1) | (regs[0] & 1) ) ;
regs[0] = ( rltemp >> 7 ) | sz53pTable[regs[7]];

	break;case 21:
	
	
var rltemp = regs[6];
regs[6] = ( (regs[6] << 1) | (regs[0] & 1) ) ;
regs[0] = ( rltemp >> 7 ) | sz53pTable[regs[6]];

	break;case 22:
	
	var val = (tstates += ( 3), memory.read(regPairs[3]));
var rltemp = val;
val = ( (val << 1) | (regs[0] & 1) ) & 0xff;
regs[0] = ( rltemp >> 7 ) | sz53pTable[val];
tstates += ( 1);
tstates += ( 3);
while (display.nextEventTime != null && display.nextEventTime < tstates) display.doEvent();
memory.write(regPairs[3], val);;
	break;case 23:
	
	
var rltemp = regs[1];
regs[1] = ( (regs[1] << 1) | (regs[0] & 1) ) ;
regs[0] = ( rltemp >> 7 ) | sz53pTable[regs[1]];

	break;case 24:
	
	
var rrtemp = regs[3];
regs[3] = ( (regs[3] >> 1) | ( regs[0] << 7 ) ) ;
regs[0] = (rrtemp & 1) | sz53pTable[regs[3]];

	break;case 25:
	
	
var rrtemp = regs[2];
regs[2] = ( (regs[2] >> 1) | ( regs[0] << 7 ) ) ;
regs[0] = (rrtemp & 1) | sz53pTable[regs[2]];

	break;case 26:
	
	
var rrtemp = regs[5];
regs[5] = ( (regs[5] >> 1) | ( regs[0] << 7 ) ) ;
regs[0] = (rrtemp & 1) | sz53pTable[regs[5]];

	break;case 27:
	
	
var rrtemp = regs[4];
regs[4] = ( (regs[4] >> 1) | ( regs[0] << 7 ) ) ;
regs[0] = (rrtemp & 1) | sz53pTable[regs[4]];

	break;case 28:
	
	
var rrtemp = regs[7];
regs[7] = ( (regs[7] >> 1) | ( regs[0] << 7 ) ) ;
regs[0] = (rrtemp & 1) | sz53pTable[regs[7]];

	break;case 29:
	
	
var rrtemp = regs[6];
regs[6] = ( (regs[6] >> 1) | ( regs[0] << 7 ) ) ;
regs[0] = (rrtemp & 1) | sz53pTable[regs[6]];

	break;case 30:
	
	var val = (tstates += ( 3), memory.read(regPairs[3]));
var rrtemp = val;
val = ( (val >> 1) | ( regs[0] << 7 ) ) & 0xff;
regs[0] = (rrtemp & 1) | sz53pTable[val];
tstates += ( 1);
tstates += ( 3);
while (display.nextEventTime != null && display.nextEventTime < tstates) display.doEvent();
memory.write(regPairs[3], val);;
	break;case 31:
	
	
var rrtemp = regs[1];
regs[1] = ( (regs[1] >> 1) | ( regs[0] << 7 ) ) ;
regs[0] = (rrtemp & 1) | sz53pTable[regs[1]];

	break;case 32:
	
	
regs[0] = regs[3] >> 7;
regs[3] = (regs[3] << 1) ;
regs[0] |= sz53pTable[regs[3]];

	break;case 33:
	
	
regs[0] = regs[2] >> 7;
regs[2] = (regs[2] << 1) ;
regs[0] |= sz53pTable[regs[2]];

	break;case 34:
	
	
regs[0] = regs[5] >> 7;
regs[5] = (regs[5] << 1) ;
regs[0] |= sz53pTable[regs[5]];

	break;case 35:
	
	
regs[0] = regs[4] >> 7;
regs[4] = (regs[4] << 1) ;
regs[0] |= sz53pTable[regs[4]];

	break;case 36:
	
	
regs[0] = regs[7] >> 7;
regs[7] = (regs[7] << 1) ;
regs[0] |= sz53pTable[regs[7]];

	break;case 37:
	
	
regs[0] = regs[6] >> 7;
regs[6] = (regs[6] << 1) ;
regs[0] |= sz53pTable[regs[6]];

	break;case 38:
	
	var val = (tstates += ( 3), memory.read(regPairs[3]));
regs[0] = val >> 7;
val = (val << 1) & 0xff;
regs[0] |= sz53pTable[val];
tstates += ( 1);
tstates += ( 3);
while (display.nextEventTime != null && display.nextEventTime < tstates) display.doEvent();
memory.write(regPairs[3], val);;
	break;case 39:
	
	
regs[0] = regs[1] >> 7;
regs[1] = (regs[1] << 1) ;
regs[0] |= sz53pTable[regs[1]];

	break;case 40:
	
	
regs[0] = regs[3] & 1;
regs[3] = ( (regs[3] & 0x80) | (regs[3] >> 1) ) ;
regs[0] |= sz53pTable[regs[3]];

	break;case 41:
	
	
regs[0] = regs[2] & 1;
regs[2] = ( (regs[2] & 0x80) | (regs[2] >> 1) ) ;
regs[0] |= sz53pTable[regs[2]];

	break;case 42:
	
	
regs[0] = regs[5] & 1;
regs[5] = ( (regs[5] & 0x80) | (regs[5] >> 1) ) ;
regs[0] |= sz53pTable[regs[5]];

	break;case 43:
	
	
regs[0] = regs[4] & 1;
regs[4] = ( (regs[4] & 0x80) | (regs[4] >> 1) ) ;
regs[0] |= sz53pTable[regs[4]];

	break;case 44:
	
	
regs[0] = regs[7] & 1;
regs[7] = ( (regs[7] & 0x80) | (regs[7] >> 1) ) ;
regs[0] |= sz53pTable[regs[7]];

	break;case 45:
	
	
regs[0] = regs[6] & 1;
regs[6] = ( (regs[6] & 0x80) | (regs[6] >> 1) ) ;
regs[0] |= sz53pTable[regs[6]];

	break;case 46:
	
	var val = (tstates += ( 3), memory.read(regPairs[3]));
regs[0] = val & 1;
val = ( (val & 0x80) | (val >> 1) ) & 0xff;
regs[0] |= sz53pTable[val];
tstates += ( 1);
tstates += ( 3);
while (display.nextEventTime != null && display.nextEventTime < tstates) display.doEvent();
memory.write(regPairs[3], val);;
	break;case 47:
	
	
regs[0] = regs[1] & 1;
regs[1] = ( (regs[1] & 0x80) | (regs[1] >> 1) ) ;
regs[0] |= sz53pTable[regs[1]];

	break;case 48:
	
	
regs[0] =  regs[3] >> 7;
regs[3] = (((regs[3]) << 1) ) | 0x01;
regs[0] |= sz53pTable[regs[3]];

	break;case 49:
	
	
regs[0] =  regs[2] >> 7;
regs[2] = (((regs[2]) << 1) ) | 0x01;
regs[0] |= sz53pTable[regs[2]];

	break;case 50:
	
	
regs[0] =  regs[5] >> 7;
regs[5] = (((regs[5]) << 1) ) | 0x01;
regs[0] |= sz53pTable[regs[5]];

	break;case 51:
	
	
regs[0] =  regs[4] >> 7;
regs[4] = (((regs[4]) << 1) ) | 0x01;
regs[0] |= sz53pTable[regs[4]];

	break;case 52:
	
	
regs[0] =  regs[7] >> 7;
regs[7] = (((regs[7]) << 1) ) | 0x01;
regs[0] |= sz53pTable[regs[7]];

	break;case 53:
	
	
regs[0] =  regs[6] >> 7;
regs[6] = (((regs[6]) << 1) ) | 0x01;
regs[0] |= sz53pTable[regs[6]];

	break;case 54:
	
	var val = (tstates += ( 3), memory.read(regPairs[3]));
regs[0] =  val >> 7;
val = (((val) << 1) & 0xff) | 0x01;
regs[0] |= sz53pTable[val];
tstates += ( 1);
tstates += ( 3);
while (display.nextEventTime != null && display.nextEventTime < tstates) display.doEvent();
memory.write(regPairs[3], val);;
	break;case 55:
	
	
regs[0] =  regs[1] >> 7;
regs[1] = (((regs[1]) << 1) ) | 0x01;
regs[0] |= sz53pTable[regs[1]];

	break;case 56:
	
	
regs[0] =  regs[3] & 1;
regs[3] >>= 1;
regs[0] |= sz53pTable[regs[3]];

	break;case 57:
	
	
regs[0] =  regs[2] & 1;
regs[2] >>= 1;
regs[0] |= sz53pTable[regs[2]];

	break;case 58:
	
	
regs[0] =  regs[5] & 1;
regs[5] >>= 1;
regs[0] |= sz53pTable[regs[5]];

	break;case 59:
	
	
regs[0] =  regs[4] & 1;
regs[4] >>= 1;
regs[0] |= sz53pTable[regs[4]];

	break;case 60:
	
	
regs[0] =  regs[7] & 1;
regs[7] >>= 1;
regs[0] |= sz53pTable[regs[7]];

	break;case 61:
	
	
regs[0] =  regs[6] & 1;
regs[6] >>= 1;
regs[0] |= sz53pTable[regs[6]];

	break;case 62:
	
	var val = (tstates += ( 3), memory.read(regPairs[3]));
regs[0] =  val & 1;
val >>= 1;
regs[0] |= sz53pTable[val];
tstates += ( 1);
tstates += ( 3);
while (display.nextEventTime != null && display.nextEventTime < tstates) display.doEvent();
memory.write(regPairs[3], val);;
	break;case 63:
	
	
regs[0] =  regs[1] & 1;
regs[1] >>= 1;
regs[0] |= sz53pTable[regs[1]];

	break;case 64:
	
	regs[0] = ( regs[0] & 1 ) | 16 | ( regs[3] & 40 );
if( !(regs[3] & 1) ) regs[0] |= 68;

	break;case 65:
	
	regs[0] = ( regs[0] & 1 ) | 16 | ( regs[2] & 40 );
if( !(regs[2] & 1) ) regs[0] |= 68;

	break;case 66:
	
	regs[0] = ( regs[0] & 1 ) | 16 | ( regs[5] & 40 );
if( !(regs[5] & 1) ) regs[0] |= 68;

	break;case 67:
	
	regs[0] = ( regs[0] & 1 ) | 16 | ( regs[4] & 40 );
if( !(regs[4] & 1) ) regs[0] |= 68;

	break;case 68:
	
	regs[0] = ( regs[0] & 1 ) | 16 | ( regs[7] & 40 );
if( !(regs[7] & 1) ) regs[0] |= 68;

	break;case 69:
	
	regs[0] = ( regs[0] & 1 ) | 16 | ( regs[6] & 40 );
if( !(regs[6] & 1) ) regs[0] |= 68;

	break;case 70:
	
	var addr = regPairs[3];
var value = (tstates += ( 3), memory.read(addr));
tstates += ( 1);
regs[0] = ( regs[0] & 1 ) | 16 | ( value & 40 );
if( !(value & 1) ) regs[0] |= 68;

	break;case 71:
	
	regs[0] = ( regs[0] & 1 ) | 16 | ( regs[1] & 40 );
if( !(regs[1] & 1) ) regs[0] |= 68;

	break;case 72:
	
	regs[0] = ( regs[0] & 1 ) | 16 | ( regs[3] & 40 );
if( !(regs[3] & 2) ) regs[0] |= 68;

	break;case 73:
	
	regs[0] = ( regs[0] & 1 ) | 16 | ( regs[2] & 40 );
if( !(regs[2] & 2) ) regs[0] |= 68;

	break;case 74:
	
	regs[0] = ( regs[0] & 1 ) | 16 | ( regs[5] & 40 );
if( !(regs[5] & 2) ) regs[0] |= 68;

	break;case 75:
	
	regs[0] = ( regs[0] & 1 ) | 16 | ( regs[4] & 40 );
if( !(regs[4] & 2) ) regs[0] |= 68;

	break;case 76:
	
	regs[0] = ( regs[0] & 1 ) | 16 | ( regs[7] & 40 );
if( !(regs[7] & 2) ) regs[0] |= 68;

	break;case 77:
	
	regs[0] = ( regs[0] & 1 ) | 16 | ( regs[6] & 40 );
if( !(regs[6] & 2) ) regs[0] |= 68;

	break;case 78:
	
	var addr = regPairs[3];
var value = (tstates += ( 3), memory.read(addr));
tstates += ( 1);
regs[0] = ( regs[0] & 1 ) | 16 | ( value & 40 );
if( !(value & 2) ) regs[0] |= 68;

	break;case 79:
	
	regs[0] = ( regs[0] & 1 ) | 16 | ( regs[1] & 40 );
if( !(regs[1] & 2) ) regs[0] |= 68;

	break;case 80:
	
	regs[0] = ( regs[0] & 1 ) | 16 | ( regs[3] & 40 );
if( !(regs[3] & 4) ) regs[0] |= 68;

	break;case 81:
	
	regs[0] = ( regs[0] & 1 ) | 16 | ( regs[2] & 40 );
if( !(regs[2] & 4) ) regs[0] |= 68;

	break;case 82:
	
	regs[0] = ( regs[0] & 1 ) | 16 | ( regs[5] & 40 );
if( !(regs[5] & 4) ) regs[0] |= 68;

	break;case 83:
	
	regs[0] = ( regs[0] & 1 ) | 16 | ( regs[4] & 40 );
if( !(regs[4] & 4) ) regs[0] |= 68;

	break;case 84:
	
	regs[0] = ( regs[0] & 1 ) | 16 | ( regs[7] & 40 );
if( !(regs[7] & 4) ) regs[0] |= 68;

	break;case 85:
	
	regs[0] = ( regs[0] & 1 ) | 16 | ( regs[6] & 40 );
if( !(regs[6] & 4) ) regs[0] |= 68;

	break;case 86:
	
	var addr = regPairs[3];
var value = (tstates += ( 3), memory.read(addr));
tstates += ( 1);
regs[0] = ( regs[0] & 1 ) | 16 | ( value & 40 );
if( !(value & 4) ) regs[0] |= 68;

	break;case 87:
	
	regs[0] = ( regs[0] & 1 ) | 16 | ( regs[1] & 40 );
if( !(regs[1] & 4) ) regs[0] |= 68;

	break;case 88:
	
	regs[0] = ( regs[0] & 1 ) | 16 | ( regs[3] & 40 );
if( !(regs[3] & 8) ) regs[0] |= 68;

	break;case 89:
	
	regs[0] = ( regs[0] & 1 ) | 16 | ( regs[2] & 40 );
if( !(regs[2] & 8) ) regs[0] |= 68;

	break;case 90:
	
	regs[0] = ( regs[0] & 1 ) | 16 | ( regs[5] & 40 );
if( !(regs[5] & 8) ) regs[0] |= 68;

	break;case 91:
	
	regs[0] = ( regs[0] & 1 ) | 16 | ( regs[4] & 40 );
if( !(regs[4] & 8) ) regs[0] |= 68;

	break;case 92:
	
	regs[0] = ( regs[0] & 1 ) | 16 | ( regs[7] & 40 );
if( !(regs[7] & 8) ) regs[0] |= 68;

	break;case 93:
	
	regs[0] = ( regs[0] & 1 ) | 16 | ( regs[6] & 40 );
if( !(regs[6] & 8) ) regs[0] |= 68;

	break;case 94:
	
	var addr = regPairs[3];
var value = (tstates += ( 3), memory.read(addr));
tstates += ( 1);
regs[0] = ( regs[0] & 1 ) | 16 | ( value & 40 );
if( !(value & 8) ) regs[0] |= 68;

	break;case 95:
	
	regs[0] = ( regs[0] & 1 ) | 16 | ( regs[1] & 40 );
if( !(regs[1] & 8) ) regs[0] |= 68;

	break;case 96:
	
	regs[0] = ( regs[0] & 1 ) | 16 | ( regs[3] & 40 );
if( !(regs[3] & 16) ) regs[0] |= 68;

	break;case 97:
	
	regs[0] = ( regs[0] & 1 ) | 16 | ( regs[2] & 40 );
if( !(regs[2] & 16) ) regs[0] |= 68;

	break;case 98:
	
	regs[0] = ( regs[0] & 1 ) | 16 | ( regs[5] & 40 );
if( !(regs[5] & 16) ) regs[0] |= 68;

	break;case 99:
	
	regs[0] = ( regs[0] & 1 ) | 16 | ( regs[4] & 40 );
if( !(regs[4] & 16) ) regs[0] |= 68;

	break;case 100:
	
	regs[0] = ( regs[0] & 1 ) | 16 | ( regs[7] & 40 );
if( !(regs[7] & 16) ) regs[0] |= 68;

	break;case 101:
	
	regs[0] = ( regs[0] & 1 ) | 16 | ( regs[6] & 40 );
if( !(regs[6] & 16) ) regs[0] |= 68;

	break;case 102:
	
	var addr = regPairs[3];
var value = (tstates += ( 3), memory.read(addr));
tstates += ( 1);
regs[0] = ( regs[0] & 1 ) | 16 | ( value & 40 );
if( !(value & 16) ) regs[0] |= 68;

	break;case 103:
	
	regs[0] = ( regs[0] & 1 ) | 16 | ( regs[1] & 40 );
if( !(regs[1] & 16) ) regs[0] |= 68;

	break;case 104:
	
	regs[0] = ( regs[0] & 1 ) | 16 | ( regs[3] & 40 );
if( !(regs[3] & 32) ) regs[0] |= 68;

	break;case 105:
	
	regs[0] = ( regs[0] & 1 ) | 16 | ( regs[2] & 40 );
if( !(regs[2] & 32) ) regs[0] |= 68;

	break;case 106:
	
	regs[0] = ( regs[0] & 1 ) | 16 | ( regs[5] & 40 );
if( !(regs[5] & 32) ) regs[0] |= 68;

	break;case 107:
	
	regs[0] = ( regs[0] & 1 ) | 16 | ( regs[4] & 40 );
if( !(regs[4] & 32) ) regs[0] |= 68;

	break;case 108:
	
	regs[0] = ( regs[0] & 1 ) | 16 | ( regs[7] & 40 );
if( !(regs[7] & 32) ) regs[0] |= 68;

	break;case 109:
	
	regs[0] = ( regs[0] & 1 ) | 16 | ( regs[6] & 40 );
if( !(regs[6] & 32) ) regs[0] |= 68;

	break;case 110:
	
	var addr = regPairs[3];
var value = (tstates += ( 3), memory.read(addr));
tstates += ( 1);
regs[0] = ( regs[0] & 1 ) | 16 | ( value & 40 );
if( !(value & 32) ) regs[0] |= 68;

	break;case 111:
	
	regs[0] = ( regs[0] & 1 ) | 16 | ( regs[1] & 40 );
if( !(regs[1] & 32) ) regs[0] |= 68;

	break;case 112:
	
	regs[0] = ( regs[0] & 1 ) | 16 | ( regs[3] & 40 );
if( !(regs[3] & 64) ) regs[0] |= 68;

	break;case 113:
	
	regs[0] = ( regs[0] & 1 ) | 16 | ( regs[2] & 40 );
if( !(regs[2] & 64) ) regs[0] |= 68;

	break;case 114:
	
	regs[0] = ( regs[0] & 1 ) | 16 | ( regs[5] & 40 );
if( !(regs[5] & 64) ) regs[0] |= 68;

	break;case 115:
	
	regs[0] = ( regs[0] & 1 ) | 16 | ( regs[4] & 40 );
if( !(regs[4] & 64) ) regs[0] |= 68;

	break;case 116:
	
	regs[0] = ( regs[0] & 1 ) | 16 | ( regs[7] & 40 );
if( !(regs[7] & 64) ) regs[0] |= 68;

	break;case 117:
	
	regs[0] = ( regs[0] & 1 ) | 16 | ( regs[6] & 40 );
if( !(regs[6] & 64) ) regs[0] |= 68;

	break;case 118:
	
	var addr = regPairs[3];
var value = (tstates += ( 3), memory.read(addr));
tstates += ( 1);
regs[0] = ( regs[0] & 1 ) | 16 | ( value & 40 );
if( !(value & 64) ) regs[0] |= 68;

	break;case 119:
	
	regs[0] = ( regs[0] & 1 ) | 16 | ( regs[1] & 40 );
if( !(regs[1] & 64) ) regs[0] |= 68;

	break;case 120:
	
	regs[0] = ( regs[0] & 1 ) | 16 | ( regs[3] & 40 );
if( !(regs[3] & 128) ) regs[0] |= 68;
if (regs[3] & 0x80) regs[0] |= 128;
	break;case 121:
	
	regs[0] = ( regs[0] & 1 ) | 16 | ( regs[2] & 40 );
if( !(regs[2] & 128) ) regs[0] |= 68;
if (regs[2] & 0x80) regs[0] |= 128;
	break;case 122:
	
	regs[0] = ( regs[0] & 1 ) | 16 | ( regs[5] & 40 );
if( !(regs[5] & 128) ) regs[0] |= 68;
if (regs[5] & 0x80) regs[0] |= 128;
	break;case 123:
	
	regs[0] = ( regs[0] & 1 ) | 16 | ( regs[4] & 40 );
if( !(regs[4] & 128) ) regs[0] |= 68;
if (regs[4] & 0x80) regs[0] |= 128;
	break;case 124:
	
	regs[0] = ( regs[0] & 1 ) | 16 | ( regs[7] & 40 );
if( !(regs[7] & 128) ) regs[0] |= 68;
if (regs[7] & 0x80) regs[0] |= 128;
	break;case 125:
	
	regs[0] = ( regs[0] & 1 ) | 16 | ( regs[6] & 40 );
if( !(regs[6] & 128) ) regs[0] |= 68;
if (regs[6] & 0x80) regs[0] |= 128;
	break;case 126:
	
	var addr = regPairs[3];
var value = (tstates += ( 3), memory.read(addr));
tstates += ( 1);
regs[0] = ( regs[0] & 1 ) | 16 | ( value & 40 );
if( !(value & 128) ) regs[0] |= 68;
if (value & 0x80) regs[0] |= 128;
	break;case 127:
	
	regs[0] = ( regs[0] & 1 ) | 16 | ( regs[1] & 40 );
if( !(regs[1] & 128) ) regs[0] |= 68;
if (regs[1] & 0x80) regs[0] |= 128;
	break;case 128:
	
	
regs[3] &= 254;

	break;case 129:
	
	
regs[2] &= 254;

	break;case 130:
	
	
regs[5] &= 254;

	break;case 131:
	
	
regs[4] &= 254;

	break;case 132:
	
	
regs[7] &= 254;

	break;case 133:
	
	
regs[6] &= 254;

	break;case 134:
	
	var val = (tstates += ( 3), memory.read(regPairs[3]));
val &= 254;
tstates += ( 1);
tstates += ( 3);
while (display.nextEventTime != null && display.nextEventTime < tstates) display.doEvent();
memory.write(regPairs[3], val);;
	break;case 135:
	
	
regs[1] &= 254;

	break;case 136:
	
	
regs[3] &= 253;

	break;case 137:
	
	
regs[2] &= 253;

	break;case 138:
	
	
regs[5] &= 253;

	break;case 139:
	
	
regs[4] &= 253;

	break;case 140:
	
	
regs[7] &= 253;

	break;case 141:
	
	
regs[6] &= 253;

	break;case 142:
	
	var val = (tstates += ( 3), memory.read(regPairs[3]));
val &= 253;
tstates += ( 1);
tstates += ( 3);
while (display.nextEventTime != null && display.nextEventTime < tstates) display.doEvent();
memory.write(regPairs[3], val);;
	break;case 143:
	
	
regs[1] &= 253;

	break;case 144:
	
	
regs[3] &= 251;

	break;case 145:
	
	
regs[2] &= 251;

	break;case 146:
	
	
regs[5] &= 251;

	break;case 147:
	
	
regs[4] &= 251;

	break;case 148:
	
	
regs[7] &= 251;

	break;case 149:
	
	
regs[6] &= 251;

	break;case 150:
	
	var val = (tstates += ( 3), memory.read(regPairs[3]));
val &= 251;
tstates += ( 1);
tstates += ( 3);
while (display.nextEventTime != null && display.nextEventTime < tstates) display.doEvent();
memory.write(regPairs[3], val);;
	break;case 151:
	
	
regs[1] &= 251;

	break;case 152:
	
	
regs[3] &= 247;

	break;case 153:
	
	
regs[2] &= 247;

	break;case 154:
	
	
regs[5] &= 247;

	break;case 155:
	
	
regs[4] &= 247;

	break;case 156:
	
	
regs[7] &= 247;

	break;case 157:
	
	
regs[6] &= 247;

	break;case 158:
	
	var val = (tstates += ( 3), memory.read(regPairs[3]));
val &= 247;
tstates += ( 1);
tstates += ( 3);
while (display.nextEventTime != null && display.nextEventTime < tstates) display.doEvent();
memory.write(regPairs[3], val);;
	break;case 159:
	
	
regs[1] &= 247;

	break;case 160:
	
	
regs[3] &= 239;

	break;case 161:
	
	
regs[2] &= 239;

	break;case 162:
	
	
regs[5] &= 239;

	break;case 163:
	
	
regs[4] &= 239;

	break;case 164:
	
	
regs[7] &= 239;

	break;case 165:
	
	
regs[6] &= 239;

	break;case 166:
	
	var val = (tstates += ( 3), memory.read(regPairs[3]));
val &= 239;
tstates += ( 1);
tstates += ( 3);
while (display.nextEventTime != null && display.nextEventTime < tstates) display.doEvent();
memory.write(regPairs[3], val);;
	break;case 167:
	
	
regs[1] &= 239;

	break;case 168:
	
	
regs[3] &= 223;

	break;case 169:
	
	
regs[2] &= 223;

	break;case 170:
	
	
regs[5] &= 223;

	break;case 171:
	
	
regs[4] &= 223;

	break;case 172:
	
	
regs[7] &= 223;

	break;case 173:
	
	
regs[6] &= 223;

	break;case 174:
	
	var val = (tstates += ( 3), memory.read(regPairs[3]));
val &= 223;
tstates += ( 1);
tstates += ( 3);
while (display.nextEventTime != null && display.nextEventTime < tstates) display.doEvent();
memory.write(regPairs[3], val);;
	break;case 175:
	
	
regs[1] &= 223;

	break;case 176:
	
	
regs[3] &= 191;

	break;case 177:
	
	
regs[2] &= 191;

	break;case 178:
	
	
regs[5] &= 191;

	break;case 179:
	
	
regs[4] &= 191;

	break;case 180:
	
	
regs[7] &= 191;

	break;case 181:
	
	
regs[6] &= 191;

	break;case 182:
	
	var val = (tstates += ( 3), memory.read(regPairs[3]));
val &= 191;
tstates += ( 1);
tstates += ( 3);
while (display.nextEventTime != null && display.nextEventTime < tstates) display.doEvent();
memory.write(regPairs[3], val);;
	break;case 183:
	
	
regs[1] &= 191;

	break;case 184:
	
	
regs[3] &= 127;

	break;case 185:
	
	
regs[2] &= 127;

	break;case 186:
	
	
regs[5] &= 127;

	break;case 187:
	
	
regs[4] &= 127;

	break;case 188:
	
	
regs[7] &= 127;

	break;case 189:
	
	
regs[6] &= 127;

	break;case 190:
	
	var val = (tstates += ( 3), memory.read(regPairs[3]));
val &= 127;
tstates += ( 1);
tstates += ( 3);
while (display.nextEventTime != null && display.nextEventTime < tstates) display.doEvent();
memory.write(regPairs[3], val);;
	break;case 191:
	
	
regs[1] &= 127;

	break;case 192:
	
	
regs[3] |= 1;

	break;case 193:
	
	
regs[2] |= 1;

	break;case 194:
	
	
regs[5] |= 1;

	break;case 195:
	
	
regs[4] |= 1;

	break;case 196:
	
	
regs[7] |= 1;

	break;case 197:
	
	
regs[6] |= 1;

	break;case 198:
	
	var val = (tstates += ( 3), memory.read(regPairs[3]));
val |= 1;
tstates += ( 1);
tstates += ( 3);
while (display.nextEventTime != null && display.nextEventTime < tstates) display.doEvent();
memory.write(regPairs[3], val);;
	break;case 199:
	
	
regs[1] |= 1;

	break;case 200:
	
	
regs[3] |= 2;

	break;case 201:
	
	
regs[2] |= 2;

	break;case 202:
	
	
regs[5] |= 2;

	break;case 203:
	
	
regs[4] |= 2;

	break;case 204:
	
	
regs[7] |= 2;

	break;case 205:
	
	
regs[6] |= 2;

	break;case 206:
	
	var val = (tstates += ( 3), memory.read(regPairs[3]));
val |= 2;
tstates += ( 1);
tstates += ( 3);
while (display.nextEventTime != null && display.nextEventTime < tstates) display.doEvent();
memory.write(regPairs[3], val);;
	break;case 207:
	
	
regs[1] |= 2;

	break;case 208:
	
	
regs[3] |= 4;

	break;case 209:
	
	
regs[2] |= 4;

	break;case 210:
	
	
regs[5] |= 4;

	break;case 211:
	
	
regs[4] |= 4;

	break;case 212:
	
	
regs[7] |= 4;

	break;case 213:
	
	
regs[6] |= 4;

	break;case 214:
	
	var val = (tstates += ( 3), memory.read(regPairs[3]));
val |= 4;
tstates += ( 1);
tstates += ( 3);
while (display.nextEventTime != null && display.nextEventTime < tstates) display.doEvent();
memory.write(regPairs[3], val);;
	break;case 215:
	
	
regs[1] |= 4;

	break;case 216:
	
	
regs[3] |= 8;

	break;case 217:
	
	
regs[2] |= 8;

	break;case 218:
	
	
regs[5] |= 8;

	break;case 219:
	
	
regs[4] |= 8;

	break;case 220:
	
	
regs[7] |= 8;

	break;case 221:
	
	
regs[6] |= 8;

	break;case 222:
	
	var val = (tstates += ( 3), memory.read(regPairs[3]));
val |= 8;
tstates += ( 1);
tstates += ( 3);
while (display.nextEventTime != null && display.nextEventTime < tstates) display.doEvent();
memory.write(regPairs[3], val);;
	break;case 223:
	
	
regs[1] |= 8;

	break;case 224:
	
	
regs[3] |= 16;

	break;case 225:
	
	
regs[2] |= 16;

	break;case 226:
	
	
regs[5] |= 16;

	break;case 227:
	
	
regs[4] |= 16;

	break;case 228:
	
	
regs[7] |= 16;

	break;case 229:
	
	
regs[6] |= 16;

	break;case 230:
	
	var val = (tstates += ( 3), memory.read(regPairs[3]));
val |= 16;
tstates += ( 1);
tstates += ( 3);
while (display.nextEventTime != null && display.nextEventTime < tstates) display.doEvent();
memory.write(regPairs[3], val);;
	break;case 231:
	
	
regs[1] |= 16;

	break;case 232:
	
	
regs[3] |= 32;

	break;case 233:
	
	
regs[2] |= 32;

	break;case 234:
	
	
regs[5] |= 32;

	break;case 235:
	
	
regs[4] |= 32;

	break;case 236:
	
	
regs[7] |= 32;

	break;case 237:
	
	
regs[6] |= 32;

	break;case 238:
	
	var val = (tstates += ( 3), memory.read(regPairs[3]));
val |= 32;
tstates += ( 1);
tstates += ( 3);
while (display.nextEventTime != null && display.nextEventTime < tstates) display.doEvent();
memory.write(regPairs[3], val);;
	break;case 239:
	
	
regs[1] |= 32;

	break;case 240:
	
	
regs[3] |= 64;

	break;case 241:
	
	
regs[2] |= 64;

	break;case 242:
	
	
regs[5] |= 64;

	break;case 243:
	
	
regs[4] |= 64;

	break;case 244:
	
	
regs[7] |= 64;

	break;case 245:
	
	
regs[6] |= 64;

	break;case 246:
	
	var val = (tstates += ( 3), memory.read(regPairs[3]));
val |= 64;
tstates += ( 1);
tstates += ( 3);
while (display.nextEventTime != null && display.nextEventTime < tstates) display.doEvent();
memory.write(regPairs[3], val);;
	break;case 247:
	
	
regs[1] |= 64;

	break;case 248:
	
	
regs[3] |= 128;

	break;case 249:
	
	
regs[2] |= 128;

	break;case 250:
	
	
regs[5] |= 128;

	break;case 251:
	
	
regs[4] |= 128;

	break;case 252:
	
	
regs[7] |= 128;

	break;case 253:
	
	
regs[6] |= 128;

	break;case 254:
	
	var val = (tstates += ( 3), memory.read(regPairs[3]));
val |= 128;
tstates += ( 1);
tstates += ( 3);
while (display.nextEventTime != null && display.nextEventTime < tstates) display.doEvent();
memory.write(regPairs[3], val);;
	break;case 255:
	
	
regs[1] |= 128;

	break;
	default:
		var addr = regPairs[12] - 1;
		throw("Unimplemented opcode " + opcode + " in page cb - PC = " + addr);
}
					break;
				case 'DD':
					tstates += ( 4);
					opcode = memory.read(regPairs[12]); regPairs[12]++;
					regs[20] = ((regs[20] + 1) & 0x7f) | (regs[20] & 0x80);
					switch (opcode) {
	case 0:
	
			
	break;case 1:
	
	var l = (tstates += ( 3), memory.read(regPairs[12])); regPairs[12]++;
var h = (tstates += ( 3), memory.read(regPairs[12])); regPairs[12]++;
regPairs[1] = (h<<8) | l;
	break;case 2:
	
	tstates += ( 3);
while (display.nextEventTime != null && display.nextEventTime < tstates) display.doEvent();
memory.write(regPairs[1], regs[1]);;
	break;case 3:
	
	regPairs[1]++;
tstates += ( 1);
tstates += ( 1);
	break;case 4:
	
	

regs[0] = (regs[0] & 1) | (regs[3] & 0x0f ? 0 : 16) | 2;
regs[3] = (regs[3] + 1) ;


regs[0] = (regs[0] & 1) | ( regs[3] == 0x80 ? 4 : 0 ) | ( regs[3] & 0x0f ? 0 : 16 ) | sz53Table[regs[3]];
	break;case 5:
	
	

regs[0] = (regs[0] & 1 ) | ( regs[3] & 0x0f ? 0 : 16 ) | 2;
regs[3] = (regs[3] - 1) ;


regs[0] |= (regs[3] == 0x7f ? 4 : 0) | sz53Table[regs[3]];
	break;case 6:
	
	regs[3] = (tstates += ( 3), memory.read(regPairs[12])); regPairs[12]++;
	break;case 7:
	
	regs[1] = (regs[1] << 1) | (regs[1] >> 7);
regs[0] = (regs[0] & 196) | (regs[1] & 41);
	break;case 8:
	
	var temp = regPairs[0];
regPairs[0] = regPairs[4];
regPairs[4] = temp;
	break;case 9:
	
	var add16temp = regPairs[8] + regPairs[1];
var lookup = ( (regPairs[8] & 0x0800) >> 11 ) | ( (regPairs[1] & 0x0800) >> 10 ) | ( (add16temp & 0x0800) >>  9 );
regPairs[8] = add16temp;
regs[0] = ( regs[0] & ( 196 ) ) | ( add16temp & 0x10000 ? 1 : 0 ) | ( ( add16temp >> 8 ) & ( 40 ) ) | halfcarryAddTable[lookup];
tstates += ( 1);
tstates += ( 1);
tstates += ( 1);
tstates += ( 1);
tstates += ( 1);
tstates += ( 1);
tstates += ( 1);
	break;case 10:
	
	regs[1] = (tstates += ( 3), memory.read(regPairs[1]));
	break;case 11:
	
	regPairs[1]--;
tstates += ( 1);
tstates += ( 1);
	break;case 12:
	
	

regs[0] = (regs[0] & 1) | (regs[2] & 0x0f ? 0 : 16) | 2;
regs[2] = (regs[2] + 1) ;


regs[0] = (regs[0] & 1) | ( regs[2] == 0x80 ? 4 : 0 ) | ( regs[2] & 0x0f ? 0 : 16 ) | sz53Table[regs[2]];
	break;case 13:
	
	

regs[0] = (regs[0] & 1 ) | ( regs[2] & 0x0f ? 0 : 16 ) | 2;
regs[2] = (regs[2] - 1) ;


regs[0] |= (regs[2] == 0x7f ? 4 : 0) | sz53Table[regs[2]];
	break;case 14:
	
	regs[2] = (tstates += ( 3), memory.read(regPairs[12])); regPairs[12]++;
	break;case 15:
	
	regs[0] = (regs[0] & 196) | (regs[1] & 1);
regs[1] = (regs[1] >> 1) | (regs[1] << 7);
regs[0] |= (regs[1] & 40);
	break;case 16:
	
	tstates += ( 1);
regs[3]--;
if (regs[3]) {
	/* take branch */
	var offset = (tstates += ( 3), memory.read(regPairs[12]));
	tstates += ( 1);
	tstates += ( 1);
	tstates += ( 1);
	tstates += ( 1);
	tstates += ( 1);
	regPairs[12]++;
	regPairs[12] += (offset & 0x80 ? offset - 0x100 : offset);
} else {
	/* do not take branch */
	tstates += ( 3);
	regPairs[12]++;
}
	break;case 17:
	
	var l = (tstates += ( 3), memory.read(regPairs[12])); regPairs[12]++;
var h = (tstates += ( 3), memory.read(regPairs[12])); regPairs[12]++;
regPairs[2] = (h<<8) | l;
	break;case 18:
	
	tstates += ( 3);
while (display.nextEventTime != null && display.nextEventTime < tstates) display.doEvent();
memory.write(regPairs[2], regs[1]);;
	break;case 19:
	
	regPairs[2]++;
tstates += ( 1);
tstates += ( 1);
	break;case 20:
	
	

regs[0] = (regs[0] & 1) | (regs[5] & 0x0f ? 0 : 16) | 2;
regs[5] = (regs[5] + 1) ;


regs[0] = (regs[0] & 1) | ( regs[5] == 0x80 ? 4 : 0 ) | ( regs[5] & 0x0f ? 0 : 16 ) | sz53Table[regs[5]];
	break;case 21:
	
	

regs[0] = (regs[0] & 1 ) | ( regs[5] & 0x0f ? 0 : 16 ) | 2;
regs[5] = (regs[5] - 1) ;


regs[0] |= (regs[5] == 0x7f ? 4 : 0) | sz53Table[regs[5]];
	break;case 22:
	
	regs[5] = (tstates += ( 3), memory.read(regPairs[12])); regPairs[12]++;
	break;case 23:
	
	var bytetemp = regs[1];
regs[1] = (regs[1] << 1) | (regs[0] & 1);
regs[0] = (regs[0] & 196) | (regs[1] & 40) | (bytetemp >> 7);
	break;case 24:
	
	var offset = (tstates += ( 3), memory.read(regPairs[12]));
tstates += ( 1);
tstates += ( 1);
tstates += ( 1);
tstates += ( 1);
tstates += ( 1);
regPairs[12]++;
regPairs[12] += (offset & 0x80 ? offset - 0x100 : offset);
	break;case 25:
	
	var add16temp = regPairs[8] + regPairs[2];
var lookup = ( (regPairs[8] & 0x0800) >> 11 ) | ( (regPairs[2] & 0x0800) >> 10 ) | ( (add16temp & 0x0800) >>  9 );
regPairs[8] = add16temp;
regs[0] = ( regs[0] & ( 196 ) ) | ( add16temp & 0x10000 ? 1 : 0 ) | ( ( add16temp >> 8 ) & ( 40 ) ) | halfcarryAddTable[lookup];
tstates += ( 1);
tstates += ( 1);
tstates += ( 1);
tstates += ( 1);
tstates += ( 1);
tstates += ( 1);
tstates += ( 1);
	break;case 26:
	
	regs[1] = (tstates += ( 3), memory.read(regPairs[2]));
	break;case 27:
	
	regPairs[2]--;
tstates += ( 1);
tstates += ( 1);
	break;case 28:
	
	

regs[0] = (regs[0] & 1) | (regs[4] & 0x0f ? 0 : 16) | 2;
regs[4] = (regs[4] + 1) ;


regs[0] = (regs[0] & 1) | ( regs[4] == 0x80 ? 4 : 0 ) | ( regs[4] & 0x0f ? 0 : 16 ) | sz53Table[regs[4]];
	break;case 29:
	
	

regs[0] = (regs[0] & 1 ) | ( regs[4] & 0x0f ? 0 : 16 ) | 2;
regs[4] = (regs[4] - 1) ;


regs[0] |= (regs[4] == 0x7f ? 4 : 0) | sz53Table[regs[4]];
	break;case 30:
	
	regs[4] = (tstates += ( 3), memory.read(regPairs[12])); regPairs[12]++;
	break;case 31:
	
	var bytetemp = regs[1];
regs[1] = (bytetemp >> 1) | (regs[0] << 7);
regs[0] = (regs[0] & 196) | (regs[1] & 40) | (bytetemp & 1);
	break;case 32:
	
	if (!(regs[0] & 64)) {
	var offset = (tstates += ( 3), memory.read(regPairs[12]));
	tstates += ( 1);
	tstates += ( 1);
	tstates += ( 1);
	tstates += ( 1);
	tstates += ( 1);
	regPairs[12]++;
	regPairs[12] += (offset & 0x80 ? offset - 0x100 : offset);
} else {
	tstates += ( 3);
	regPairs[12]++; /* skip past offset byte */
}
	break;case 33:
	
	var l = (tstates += ( 3), memory.read(regPairs[12])); regPairs[12]++;
var h = (tstates += ( 3), memory.read(regPairs[12])); regPairs[12]++;
regPairs[8] = (h<<8) | l;
	break;case 34:
	
	var l = (tstates += ( 3), memory.read(regPairs[12])); regPairs[12]++;
var h = (tstates += ( 3), memory.read(regPairs[12])); regPairs[12]++;
var addr = (h<<8) | l;
tstates += ( 3);
while (display.nextEventTime != null && display.nextEventTime < tstates) display.doEvent();
memory.write(addr, regPairs[8] & 0xff);;
addr = (addr + 1) & 0xffff;
tstates += ( 3);
while (display.nextEventTime != null && display.nextEventTime < tstates) display.doEvent();
memory.write(addr, regPairs[8] >> 8);;
	break;case 35:
	
	regPairs[8]++;
tstates += ( 1);
tstates += ( 1);
	break;case 36:
	
	

regs[0] = (regs[0] & 1) | (regs[17] & 0x0f ? 0 : 16) | 2;
regs[17] = (regs[17] + 1) ;


regs[0] = (regs[0] & 1) | ( regs[17] == 0x80 ? 4 : 0 ) | ( regs[17] & 0x0f ? 0 : 16 ) | sz53Table[regs[17]];
	break;case 37:
	
	

regs[0] = (regs[0] & 1 ) | ( regs[17] & 0x0f ? 0 : 16 ) | 2;
regs[17] = (regs[17] - 1) ;


regs[0] |= (regs[17] == 0x7f ? 4 : 0) | sz53Table[regs[17]];
	break;case 38:
	
	regs[17] = (tstates += ( 3), memory.read(regPairs[12])); regPairs[12]++;
	break;case 39:
	
	var add = 0;
var carry = regs[0] & 1;
if( ( regs[0] & 16 ) || ( ( regs[1] & 0x0f ) > 9 ) ) add = 6;
if( carry || ( regs[1] > 0x99 ) ) add |= 0x60;
if( regs[1] > 0x99 ) carry = 1;
if( regs[0] & 2 ) {
	
var subtemp = regs[1] - add;
var lookup = ( (regs[1] & 0x88) >> 3 ) | ( (add & 0x88) >> 2 ) | ( (subtemp & 0x88) >> 1 );
regs[1] = subtemp;
regs[0] = ( subtemp & 0x100 ? 1 : 0 ) | 2 | halfcarrySubTable[lookup & 0x07] | overflowSubTable[lookup >> 4] | sz53Table[regs[1]];
} else {
	

var addtemp = regs[1] + add;
var lookup = ( (regs[1] & 0x88) >> 3 ) | ( (add & 0x88) >> 2 ) | ( (addtemp & 0x88) >> 1 );
regs[1] = addtemp;
regs[0] = ( addtemp & 0x100 ? 1 : 0 ) | halfcarryAddTable[lookup & 0x07] | overflowAddTable[lookup >> 4] | sz53Table[regs[1]];
}
regs[0] = ( regs[0] & -6 ) | carry | parityTable[regs[1]];
	break;case 40:
	
	if (regs[0] & 64) {
	var offset = (tstates += ( 3), memory.read(regPairs[12]));
	tstates += ( 1);
	tstates += ( 1);
	tstates += ( 1);
	tstates += ( 1);
	tstates += ( 1);
	regPairs[12]++;
	regPairs[12] += (offset & 0x80 ? offset - 0x100 : offset);
} else {
	tstates += ( 3);
	regPairs[12]++; /* skip past offset byte */
}
	break;case 41:
	
	var add16temp = regPairs[8] + regPairs[8];
var lookup = ( (regPairs[8] & 0x0800) >> 11 ) | ( (regPairs[8] & 0x0800) >> 10 ) | ( (add16temp & 0x0800) >>  9 );
regPairs[8] = add16temp;
regs[0] = ( regs[0] & ( 196 ) ) | ( add16temp & 0x10000 ? 1 : 0 ) | ( ( add16temp >> 8 ) & ( 40 ) ) | halfcarryAddTable[lookup];
tstates += ( 1);
tstates += ( 1);
tstates += ( 1);
tstates += ( 1);
tstates += ( 1);
tstates += ( 1);
tstates += ( 1);
	break;case 42:
	
	var l = (tstates += ( 3), memory.read(regPairs[12])); regPairs[12]++;
var h = (tstates += ( 3), memory.read(regPairs[12])); regPairs[12]++;
var addr = (h<<8) | l;
l = (tstates += ( 3), memory.read(addr));
addr = (addr + 1) & 0xffff;
h = (tstates += ( 3), memory.read(addr));
regPairs[8] = (h<<8) | l;
	break;case 43:
	
	regPairs[8]--;
tstates += ( 1);
tstates += ( 1);
	break;case 44:
	
	

regs[0] = (regs[0] & 1) | (regs[16] & 0x0f ? 0 : 16) | 2;
regs[16] = (regs[16] + 1) ;


regs[0] = (regs[0] & 1) | ( regs[16] == 0x80 ? 4 : 0 ) | ( regs[16] & 0x0f ? 0 : 16 ) | sz53Table[regs[16]];
	break;case 45:
	
	

regs[0] = (regs[0] & 1 ) | ( regs[16] & 0x0f ? 0 : 16 ) | 2;
regs[16] = (regs[16] - 1) ;


regs[0] |= (regs[16] == 0x7f ? 4 : 0) | sz53Table[regs[16]];
	break;case 46:
	
	regs[16] = (tstates += ( 3), memory.read(regPairs[12])); regPairs[12]++;
	break;case 47:
	
	regs[1] ^= 0xff;
regs[0] = (regs[0] & 197) | (regs[1] & 40) | 18;
	break;case 48:
	
	if (!(regs[0] & 1)) {
	var offset = (tstates += ( 3), memory.read(regPairs[12]));
	tstates += ( 1);
	tstates += ( 1);
	tstates += ( 1);
	tstates += ( 1);
	tstates += ( 1);
	regPairs[12]++;
	regPairs[12] += (offset & 0x80 ? offset - 0x100 : offset);
} else {
	tstates += ( 3);
	regPairs[12]++; /* skip past offset byte */
}
	break;case 49:
	
	var l = (tstates += ( 3), memory.read(regPairs[12])); regPairs[12]++;
var h = (tstates += ( 3), memory.read(regPairs[12])); regPairs[12]++;
regPairs[11] = (h<<8) | l;
	break;case 50:
	
	var l = (tstates += ( 3), memory.read(regPairs[12])); regPairs[12]++;
var h = (tstates += ( 3), memory.read(regPairs[12])); regPairs[12]++;
var addr = (h<<8) | l;
tstates += ( 3);
while (display.nextEventTime != null && display.nextEventTime < tstates) display.doEvent();
memory.write(addr, regs[1]);;
	break;case 51:
	
	regPairs[11]++;
tstates += ( 1);
tstates += ( 1);
	break;case 52:
	
	var offset = (tstates += ( 3), memory.read(regPairs[12]));
if (offset & 0x80) offset -= 0x100;
tstates += ( 1);
tstates += ( 1);
tstates += ( 1);
tstates += ( 1);
tstates += ( 1);
regPairs[12]++;var addr = (regPairs[8] + offset) & 0xffff;
var val = (tstates += ( 3), memory.read(addr));

regs[0] = (regs[0] & 1) | (val & 0x0f ? 0 : 16) | 2;
val = (val + 1) & 0xff;

tstates += ( 1);
tstates += ( 3);
while (display.nextEventTime != null && display.nextEventTime < tstates) display.doEvent();
memory.write(addr, val);;
regs[0] = (regs[0] & 1) | ( val == 0x80 ? 4 : 0 ) | ( val & 0x0f ? 0 : 16 ) | sz53Table[val];
	break;case 53:
	
	var offset = (tstates += ( 3), memory.read(regPairs[12]));
if (offset & 0x80) offset -= 0x100;
tstates += ( 1);
tstates += ( 1);
tstates += ( 1);
tstates += ( 1);
tstates += ( 1);
regPairs[12]++;var addr = (regPairs[8] + offset) & 0xffff;
var val = (tstates += ( 3), memory.read(addr));

regs[0] = (regs[0] & 1 ) | ( val & 0x0f ? 0 : 16 ) | 2;
val = (val - 1) & 0xff;

tstates += ( 1);
tstates += ( 3);
while (display.nextEventTime != null && display.nextEventTime < tstates) display.doEvent();
memory.write(addr, val);;
regs[0] |= (val == 0x7f ? 4 : 0) | sz53Table[val];
	break;case 54:
	
	var offset = (tstates += ( 3), memory.read(regPairs[12])); regPairs[12]++;
if (offset & 0x80) offset -= 0x100;
var addr = (regPairs[8] + offset) & 0xffff;

var val = (tstates += ( 3), memory.read(regPairs[12]));
tstates += ( 1);
tstates += ( 1);
regPairs[12]++;
tstates += ( 3);
while (display.nextEventTime != null && display.nextEventTime < tstates) display.doEvent();
memory.write(addr, val);;
	break;case 55:
	
	regs[0] = (regs[0] & 196) | (regs[1] & 40) | 1;
	break;case 56:
	
	if (regs[0] & 1) {
	var offset = (tstates += ( 3), memory.read(regPairs[12]));
	tstates += ( 1);
	tstates += ( 1);
	tstates += ( 1);
	tstates += ( 1);
	tstates += ( 1);
	regPairs[12]++;
	regPairs[12] += (offset & 0x80 ? offset - 0x100 : offset);
} else {
	tstates += ( 3);
	regPairs[12]++; /* skip past offset byte */
}
	break;case 57:
	
	var add16temp = regPairs[8] + regPairs[11];
var lookup = ( (regPairs[8] & 0x0800) >> 11 ) | ( (regPairs[11] & 0x0800) >> 10 ) | ( (add16temp & 0x0800) >>  9 );
regPairs[8] = add16temp;
regs[0] = ( regs[0] & ( 196 ) ) | ( add16temp & 0x10000 ? 1 : 0 ) | ( ( add16temp >> 8 ) & ( 40 ) ) | halfcarryAddTable[lookup];
tstates += ( 1);
tstates += ( 1);
tstates += ( 1);
tstates += ( 1);
tstates += ( 1);
tstates += ( 1);
tstates += ( 1);
	break;case 58:
	
	var l = (tstates += ( 3), memory.read(regPairs[12])); regPairs[12]++;
var h = (tstates += ( 3), memory.read(regPairs[12])); regPairs[12]++;
var addr = (h<<8) | l;
regs[1] = (tstates += ( 3), memory.read(addr));
	break;case 59:
	
	regPairs[11]--;
tstates += ( 1);
tstates += ( 1);
	break;case 60:
	
	

regs[0] = (regs[0] & 1) | (regs[1] & 0x0f ? 0 : 16) | 2;
regs[1] = (regs[1] + 1) ;


regs[0] = (regs[0] & 1) | ( regs[1] == 0x80 ? 4 : 0 ) | ( regs[1] & 0x0f ? 0 : 16 ) | sz53Table[regs[1]];
	break;case 61:
	
	

regs[0] = (regs[0] & 1 ) | ( regs[1] & 0x0f ? 0 : 16 ) | 2;
regs[1] = (regs[1] - 1) ;


regs[0] |= (regs[1] == 0x7f ? 4 : 0) | sz53Table[regs[1]];
	break;case 62:
	
	regs[1] = (tstates += ( 3), memory.read(regPairs[12])); regPairs[12]++;
	break;case 63:
	
	regs[0] = ( regs[0] & 196 ) | ( (regs[0] & 1) ? 16 : 1 ) | ( regs[1] & 40 );
	break;case 64:
	
	regs[3] = regs[3];
	break;case 65:
	
	regs[3] = regs[2];
	break;case 66:
	
	regs[3] = regs[5];
	break;case 67:
	
	regs[3] = regs[4];
	break;case 68:
	
	regs[3] = regs[17];
	break;case 69:
	
	regs[3] = regs[16];
	break;case 70:
	
	var offset = (tstates += ( 3), memory.read(regPairs[12]));
tstates += ( 1);
tstates += ( 1);
tstates += ( 1);
tstates += ( 1);
tstates += ( 1);
regPairs[12]++;
if (offset & 0x80) offset -= 0x100;
var addr = (regPairs[8] + offset) & 0xffff;

regs[3] = (tstates += ( 3), memory.read(addr));
	break;case 71:
	
	regs[3] = regs[1];
	break;case 72:
	
	regs[2] = regs[3];
	break;case 73:
	
	regs[2] = regs[2];
	break;case 74:
	
	regs[2] = regs[5];
	break;case 75:
	
	regs[2] = regs[4];
	break;case 76:
	
	regs[2] = regs[17];
	break;case 77:
	
	regs[2] = regs[16];
	break;case 78:
	
	var offset = (tstates += ( 3), memory.read(regPairs[12]));
tstates += ( 1);
tstates += ( 1);
tstates += ( 1);
tstates += ( 1);
tstates += ( 1);
regPairs[12]++;
if (offset & 0x80) offset -= 0x100;
var addr = (regPairs[8] + offset) & 0xffff;

regs[2] = (tstates += ( 3), memory.read(addr));
	break;case 79:
	
	regs[2] = regs[1];
	break;case 80:
	
	regs[5] = regs[3];
	break;case 81:
	
	regs[5] = regs[2];
	break;case 82:
	
	regs[5] = regs[5];
	break;case 83:
	
	regs[5] = regs[4];
	break;case 84:
	
	regs[5] = regs[17];
	break;case 85:
	
	regs[5] = regs[16];
	break;case 86:
	
	var offset = (tstates += ( 3), memory.read(regPairs[12]));
tstates += ( 1);
tstates += ( 1);
tstates += ( 1);
tstates += ( 1);
tstates += ( 1);
regPairs[12]++;
if (offset & 0x80) offset -= 0x100;
var addr = (regPairs[8] + offset) & 0xffff;

regs[5] = (tstates += ( 3), memory.read(addr));
	break;case 87:
	
	regs[5] = regs[1];
	break;case 88:
	
	regs[4] = regs[3];
	break;case 89:
	
	regs[4] = regs[2];
	break;case 90:
	
	regs[4] = regs[5];
	break;case 91:
	
	regs[4] = regs[4];
	break;case 92:
	
	regs[4] = regs[17];
	break;case 93:
	
	regs[4] = regs[16];
	break;case 94:
	
	var offset = (tstates += ( 3), memory.read(regPairs[12]));
tstates += ( 1);
tstates += ( 1);
tstates += ( 1);
tstates += ( 1);
tstates += ( 1);
regPairs[12]++;
if (offset & 0x80) offset -= 0x100;
var addr = (regPairs[8] + offset) & 0xffff;

regs[4] = (tstates += ( 3), memory.read(addr));
	break;case 95:
	
	regs[4] = regs[1];
	break;case 96:
	
	regs[17] = regs[3];
	break;case 97:
	
	regs[17] = regs[2];
	break;case 98:
	
	regs[17] = regs[5];
	break;case 99:
	
	regs[17] = regs[4];
	break;case 100:
	
	regs[17] = regs[17];
	break;case 101:
	
	regs[17] = regs[16];
	break;case 102:
	
	var offset = (tstates += ( 3), memory.read(regPairs[12]));
tstates += ( 1);
tstates += ( 1);
tstates += ( 1);
tstates += ( 1);
tstates += ( 1);
regPairs[12]++;
if (offset & 0x80) offset -= 0x100;
var addr = (regPairs[8] + offset) & 0xffff;

regs[7] = (tstates += ( 3), memory.read(addr));
	break;case 103:
	
	regs[17] = regs[1];
	break;case 104:
	
	regs[16] = regs[3];
	break;case 105:
	
	regs[16] = regs[2];
	break;case 106:
	
	regs[16] = regs[5];
	break;case 107:
	
	regs[16] = regs[4];
	break;case 108:
	
	regs[16] = regs[17];
	break;case 109:
	
	regs[16] = regs[16];
	break;case 110:
	
	var offset = (tstates += ( 3), memory.read(regPairs[12]));
tstates += ( 1);
tstates += ( 1);
tstates += ( 1);
tstates += ( 1);
tstates += ( 1);
regPairs[12]++;
if (offset & 0x80) offset -= 0x100;
var addr = (regPairs[8] + offset) & 0xffff;

regs[6] = (tstates += ( 3), memory.read(addr));
	break;case 111:
	
	regs[16] = regs[1];
	break;case 112:
	
	var offset = (tstates += ( 3), memory.read(regPairs[12]));
tstates += ( 1);
tstates += ( 1);
tstates += ( 1);
tstates += ( 1);
tstates += ( 1);
regPairs[12]++;
if (offset & 0x80) offset -= 0x100;
var addr = (regPairs[8] + offset) & 0xffff;

tstates += ( 3);
while (display.nextEventTime != null && display.nextEventTime < tstates) display.doEvent();
memory.write(addr, regs[3]);;
	break;case 113:
	
	var offset = (tstates += ( 3), memory.read(regPairs[12]));
tstates += ( 1);
tstates += ( 1);
tstates += ( 1);
tstates += ( 1);
tstates += ( 1);
regPairs[12]++;
if (offset & 0x80) offset -= 0x100;
var addr = (regPairs[8] + offset) & 0xffff;

tstates += ( 3);
while (display.nextEventTime != null && display.nextEventTime < tstates) display.doEvent();
memory.write(addr, regs[2]);;
	break;case 114:
	
	var offset = (tstates += ( 3), memory.read(regPairs[12]));
tstates += ( 1);
tstates += ( 1);
tstates += ( 1);
tstates += ( 1);
tstates += ( 1);
regPairs[12]++;
if (offset & 0x80) offset -= 0x100;
var addr = (regPairs[8] + offset) & 0xffff;

tstates += ( 3);
while (display.nextEventTime != null && display.nextEventTime < tstates) display.doEvent();
memory.write(addr, regs[5]);;
	break;case 115:
	
	var offset = (tstates += ( 3), memory.read(regPairs[12]));
tstates += ( 1);
tstates += ( 1);
tstates += ( 1);
tstates += ( 1);
tstates += ( 1);
regPairs[12]++;
if (offset & 0x80) offset -= 0x100;
var addr = (regPairs[8] + offset) & 0xffff;

tstates += ( 3);
while (display.nextEventTime != null && display.nextEventTime < tstates) display.doEvent();
memory.write(addr, regs[4]);;
	break;case 116:
	
	var offset = (tstates += ( 3), memory.read(regPairs[12]));
tstates += ( 1);
tstates += ( 1);
tstates += ( 1);
tstates += ( 1);
tstates += ( 1);
regPairs[12]++;
if (offset & 0x80) offset -= 0x100;
var addr = (regPairs[8] + offset) & 0xffff;

tstates += ( 3);
while (display.nextEventTime != null && display.nextEventTime < tstates) display.doEvent();
memory.write(addr, regs[7]);;
	break;case 117:
	
	var offset = (tstates += ( 3), memory.read(regPairs[12]));
tstates += ( 1);
tstates += ( 1);
tstates += ( 1);
tstates += ( 1);
tstates += ( 1);
regPairs[12]++;
if (offset & 0x80) offset -= 0x100;
var addr = (regPairs[8] + offset) & 0xffff;

tstates += ( 3);
while (display.nextEventTime != null && display.nextEventTime < tstates) display.doEvent();
memory.write(addr, regs[6]);;
	break;case 118:
	
	halted = true;
regPairs[12]--;
	break;case 119:
	
	var offset = (tstates += ( 3), memory.read(regPairs[12]));
tstates += ( 1);
tstates += ( 1);
tstates += ( 1);
tstates += ( 1);
tstates += ( 1);
regPairs[12]++;
if (offset & 0x80) offset -= 0x100;
var addr = (regPairs[8] + offset) & 0xffff;

tstates += ( 3);
while (display.nextEventTime != null && display.nextEventTime < tstates) display.doEvent();
memory.write(addr, regs[1]);;
	break;case 120:
	
	regs[1] = regs[3];
	break;case 121:
	
	regs[1] = regs[2];
	break;case 122:
	
	regs[1] = regs[5];
	break;case 123:
	
	regs[1] = regs[4];
	break;case 124:
	
	regs[1] = regs[17];
	break;case 125:
	
	regs[1] = regs[16];
	break;case 126:
	
	var offset = (tstates += ( 3), memory.read(regPairs[12]));
tstates += ( 1);
tstates += ( 1);
tstates += ( 1);
tstates += ( 1);
tstates += ( 1);
regPairs[12]++;
if (offset & 0x80) offset -= 0x100;
var addr = (regPairs[8] + offset) & 0xffff;

regs[1] = (tstates += ( 3), memory.read(addr));
	break;case 127:
	
	regs[1] = regs[1];
	break;case 128:
	
	

var addtemp = regs[1] + regs[3];
var lookup = ( (regs[1] & 0x88) >> 3 ) | ( (regs[3] & 0x88) >> 2 ) | ( (addtemp & 0x88) >> 1 );
regs[1] = addtemp;
regs[0] = ( addtemp & 0x100 ? 1 : 0 ) | halfcarryAddTable[lookup & 0x07] | overflowAddTable[lookup >> 4] | sz53Table[regs[1]];
	break;case 129:
	
	

var addtemp = regs[1] + regs[2];
var lookup = ( (regs[1] & 0x88) >> 3 ) | ( (regs[2] & 0x88) >> 2 ) | ( (addtemp & 0x88) >> 1 );
regs[1] = addtemp;
regs[0] = ( addtemp & 0x100 ? 1 : 0 ) | halfcarryAddTable[lookup & 0x07] | overflowAddTable[lookup >> 4] | sz53Table[regs[1]];
	break;case 130:
	
	

var addtemp = regs[1] + regs[5];
var lookup = ( (regs[1] & 0x88) >> 3 ) | ( (regs[5] & 0x88) >> 2 ) | ( (addtemp & 0x88) >> 1 );
regs[1] = addtemp;
regs[0] = ( addtemp & 0x100 ? 1 : 0 ) | halfcarryAddTable[lookup & 0x07] | overflowAddTable[lookup >> 4] | sz53Table[regs[1]];
	break;case 131:
	
	

var addtemp = regs[1] + regs[4];
var lookup = ( (regs[1] & 0x88) >> 3 ) | ( (regs[4] & 0x88) >> 2 ) | ( (addtemp & 0x88) >> 1 );
regs[1] = addtemp;
regs[0] = ( addtemp & 0x100 ? 1 : 0 ) | halfcarryAddTable[lookup & 0x07] | overflowAddTable[lookup >> 4] | sz53Table[regs[1]];
	break;case 132:
	
	

var addtemp = regs[1] + regs[17];
var lookup = ( (regs[1] & 0x88) >> 3 ) | ( (regs[17] & 0x88) >> 2 ) | ( (addtemp & 0x88) >> 1 );
regs[1] = addtemp;
regs[0] = ( addtemp & 0x100 ? 1 : 0 ) | halfcarryAddTable[lookup & 0x07] | overflowAddTable[lookup >> 4] | sz53Table[regs[1]];
	break;case 133:
	
	

var addtemp = regs[1] + regs[16];
var lookup = ( (regs[1] & 0x88) >> 3 ) | ( (regs[16] & 0x88) >> 2 ) | ( (addtemp & 0x88) >> 1 );
regs[1] = addtemp;
regs[0] = ( addtemp & 0x100 ? 1 : 0 ) | halfcarryAddTable[lookup & 0x07] | overflowAddTable[lookup >> 4] | sz53Table[regs[1]];
	break;case 134:
	
	var offset = (tstates += ( 3), memory.read(regPairs[12]));
if (offset & 0x80) offset -= 0x100;
tstates += ( 1);
tstates += ( 1);
tstates += ( 1);
tstates += ( 1);
tstates += ( 1);
regPairs[12]++;var addr = (regPairs[8] + offset) & 0xffff;
var val = (tstates += ( 3), memory.read(addr));

var addtemp = regs[1] + val;
var lookup = ( (regs[1] & 0x88) >> 3 ) | ( (val & 0x88) >> 2 ) | ( (addtemp & 0x88) >> 1 );
regs[1] = addtemp;
regs[0] = ( addtemp & 0x100 ? 1 : 0 ) | halfcarryAddTable[lookup & 0x07] | overflowAddTable[lookup >> 4] | sz53Table[regs[1]];
	break;case 135:
	
	

var addtemp = regs[1] + regs[1];
var lookup = ( (regs[1] & 0x88) >> 3 ) | ( (regs[1] & 0x88) >> 2 ) | ( (addtemp & 0x88) >> 1 );
regs[1] = addtemp;
regs[0] = ( addtemp & 0x100 ? 1 : 0 ) | halfcarryAddTable[lookup & 0x07] | overflowAddTable[lookup >> 4] | sz53Table[regs[1]];
	break;case 136:
	
	

var adctemp = regs[1] + regs[3] + (regs[0] & 1);
var lookup = ( (regs[1] & 0x88) >> 3 ) | ( (regs[3] & 0x88) >> 2 ) | ( (adctemp & 0x88) >> 1 );
regs[1] = adctemp;
regs[0] = ( adctemp & 0x100 ? 1 : 0 ) | halfcarryAddTable[lookup & 0x07] | overflowAddTable[lookup >> 4] | sz53Table[regs[1]];
	break;case 137:
	
	

var adctemp = regs[1] + regs[2] + (regs[0] & 1);
var lookup = ( (regs[1] & 0x88) >> 3 ) | ( (regs[2] & 0x88) >> 2 ) | ( (adctemp & 0x88) >> 1 );
regs[1] = adctemp;
regs[0] = ( adctemp & 0x100 ? 1 : 0 ) | halfcarryAddTable[lookup & 0x07] | overflowAddTable[lookup >> 4] | sz53Table[regs[1]];
	break;case 138:
	
	

var adctemp = regs[1] + regs[5] + (regs[0] & 1);
var lookup = ( (regs[1] & 0x88) >> 3 ) | ( (regs[5] & 0x88) >> 2 ) | ( (adctemp & 0x88) >> 1 );
regs[1] = adctemp;
regs[0] = ( adctemp & 0x100 ? 1 : 0 ) | halfcarryAddTable[lookup & 0x07] | overflowAddTable[lookup >> 4] | sz53Table[regs[1]];
	break;case 139:
	
	

var adctemp = regs[1] + regs[4] + (regs[0] & 1);
var lookup = ( (regs[1] & 0x88) >> 3 ) | ( (regs[4] & 0x88) >> 2 ) | ( (adctemp & 0x88) >> 1 );
regs[1] = adctemp;
regs[0] = ( adctemp & 0x100 ? 1 : 0 ) | halfcarryAddTable[lookup & 0x07] | overflowAddTable[lookup >> 4] | sz53Table[regs[1]];
	break;case 140:
	
	

var adctemp = regs[1] + regs[17] + (regs[0] & 1);
var lookup = ( (regs[1] & 0x88) >> 3 ) | ( (regs[17] & 0x88) >> 2 ) | ( (adctemp & 0x88) >> 1 );
regs[1] = adctemp;
regs[0] = ( adctemp & 0x100 ? 1 : 0 ) | halfcarryAddTable[lookup & 0x07] | overflowAddTable[lookup >> 4] | sz53Table[regs[1]];
	break;case 141:
	
	

var adctemp = regs[1] + regs[16] + (regs[0] & 1);
var lookup = ( (regs[1] & 0x88) >> 3 ) | ( (regs[16] & 0x88) >> 2 ) | ( (adctemp & 0x88) >> 1 );
regs[1] = adctemp;
regs[0] = ( adctemp & 0x100 ? 1 : 0 ) | halfcarryAddTable[lookup & 0x07] | overflowAddTable[lookup >> 4] | sz53Table[regs[1]];
	break;case 142:
	
	var offset = (tstates += ( 3), memory.read(regPairs[12]));
if (offset & 0x80) offset -= 0x100;
tstates += ( 1);
tstates += ( 1);
tstates += ( 1);
tstates += ( 1);
tstates += ( 1);
regPairs[12]++;var addr = (regPairs[8] + offset) & 0xffff;
var val = (tstates += ( 3), memory.read(addr));

var adctemp = regs[1] + val + (regs[0] & 1);
var lookup = ( (regs[1] & 0x88) >> 3 ) | ( (val & 0x88) >> 2 ) | ( (adctemp & 0x88) >> 1 );
regs[1] = adctemp;
regs[0] = ( adctemp & 0x100 ? 1 : 0 ) | halfcarryAddTable[lookup & 0x07] | overflowAddTable[lookup >> 4] | sz53Table[regs[1]];
	break;case 143:
	
	

var adctemp = regs[1] + regs[1] + (regs[0] & 1);
var lookup = ( (regs[1] & 0x88) >> 3 ) | ( (regs[1] & 0x88) >> 2 ) | ( (adctemp & 0x88) >> 1 );
regs[1] = adctemp;
regs[0] = ( adctemp & 0x100 ? 1 : 0 ) | halfcarryAddTable[lookup & 0x07] | overflowAddTable[lookup >> 4] | sz53Table[regs[1]];
	break;case 144:
	
	
var subtemp = regs[1] - regs[3];
var lookup = ( (regs[1] & 0x88) >> 3 ) | ( (regs[3] & 0x88) >> 2 ) | ( (subtemp & 0x88) >> 1 );
regs[1] = subtemp;
regs[0] = ( subtemp & 0x100 ? 1 : 0 ) | 2 | halfcarrySubTable[lookup & 0x07] | overflowSubTable[lookup >> 4] | sz53Table[regs[1]];
	break;case 145:
	
	
var subtemp = regs[1] - regs[2];
var lookup = ( (regs[1] & 0x88) >> 3 ) | ( (regs[2] & 0x88) >> 2 ) | ( (subtemp & 0x88) >> 1 );
regs[1] = subtemp;
regs[0] = ( subtemp & 0x100 ? 1 : 0 ) | 2 | halfcarrySubTable[lookup & 0x07] | overflowSubTable[lookup >> 4] | sz53Table[regs[1]];
	break;case 146:
	
	
var subtemp = regs[1] - regs[5];
var lookup = ( (regs[1] & 0x88) >> 3 ) | ( (regs[5] & 0x88) >> 2 ) | ( (subtemp & 0x88) >> 1 );
regs[1] = subtemp;
regs[0] = ( subtemp & 0x100 ? 1 : 0 ) | 2 | halfcarrySubTable[lookup & 0x07] | overflowSubTable[lookup >> 4] | sz53Table[regs[1]];
	break;case 147:
	
	
var subtemp = regs[1] - regs[4];
var lookup = ( (regs[1] & 0x88) >> 3 ) | ( (regs[4] & 0x88) >> 2 ) | ( (subtemp & 0x88) >> 1 );
regs[1] = subtemp;
regs[0] = ( subtemp & 0x100 ? 1 : 0 ) | 2 | halfcarrySubTable[lookup & 0x07] | overflowSubTable[lookup >> 4] | sz53Table[regs[1]];
	break;case 148:
	
	
var subtemp = regs[1] - regs[17];
var lookup = ( (regs[1] & 0x88) >> 3 ) | ( (regs[17] & 0x88) >> 2 ) | ( (subtemp & 0x88) >> 1 );
regs[1] = subtemp;
regs[0] = ( subtemp & 0x100 ? 1 : 0 ) | 2 | halfcarrySubTable[lookup & 0x07] | overflowSubTable[lookup >> 4] | sz53Table[regs[1]];
	break;case 149:
	
	
var subtemp = regs[1] - regs[16];
var lookup = ( (regs[1] & 0x88) >> 3 ) | ( (regs[16] & 0x88) >> 2 ) | ( (subtemp & 0x88) >> 1 );
regs[1] = subtemp;
regs[0] = ( subtemp & 0x100 ? 1 : 0 ) | 2 | halfcarrySubTable[lookup & 0x07] | overflowSubTable[lookup >> 4] | sz53Table[regs[1]];
	break;case 150:
	
	var offset = (tstates += ( 3), memory.read(regPairs[12]));
if (offset & 0x80) offset -= 0x100;
tstates += ( 1);
tstates += ( 1);
tstates += ( 1);
tstates += ( 1);
tstates += ( 1);
regPairs[12]++;var addr = (regPairs[8] + offset) & 0xffff;
var val = (tstates += ( 3), memory.read(addr));
var subtemp = regs[1] - val;
var lookup = ( (regs[1] & 0x88) >> 3 ) | ( (val & 0x88) >> 2 ) | ( (subtemp & 0x88) >> 1 );
regs[1] = subtemp;
regs[0] = ( subtemp & 0x100 ? 1 : 0 ) | 2 | halfcarrySubTable[lookup & 0x07] | overflowSubTable[lookup >> 4] | sz53Table[regs[1]];
	break;case 151:
	
	
var subtemp = regs[1] - regs[1];
var lookup = ( (regs[1] & 0x88) >> 3 ) | ( (regs[1] & 0x88) >> 2 ) | ( (subtemp & 0x88) >> 1 );
regs[1] = subtemp;
regs[0] = ( subtemp & 0x100 ? 1 : 0 ) | 2 | halfcarrySubTable[lookup & 0x07] | overflowSubTable[lookup >> 4] | sz53Table[regs[1]];
	break;case 152:
	
	
var sbctemp = regs[1] - regs[3] - (regs[0] & 1);
var lookup = ( (regs[1] & 0x88) >> 3 ) | ( (regs[3] & 0x88) >> 2 ) | ( (sbctemp & 0x88) >> 1 );
regs[1] = sbctemp;
regs[0] = ( sbctemp & 0x100 ? 1 : 0 ) | 2 | halfcarrySubTable[lookup & 0x07] | overflowSubTable[lookup >> 4] | sz53Table[regs[1]];
	break;case 153:
	
	
var sbctemp = regs[1] - regs[2] - (regs[0] & 1);
var lookup = ( (regs[1] & 0x88) >> 3 ) | ( (regs[2] & 0x88) >> 2 ) | ( (sbctemp & 0x88) >> 1 );
regs[1] = sbctemp;
regs[0] = ( sbctemp & 0x100 ? 1 : 0 ) | 2 | halfcarrySubTable[lookup & 0x07] | overflowSubTable[lookup >> 4] | sz53Table[regs[1]];
	break;case 154:
	
	
var sbctemp = regs[1] - regs[5] - (regs[0] & 1);
var lookup = ( (regs[1] & 0x88) >> 3 ) | ( (regs[5] & 0x88) >> 2 ) | ( (sbctemp & 0x88) >> 1 );
regs[1] = sbctemp;
regs[0] = ( sbctemp & 0x100 ? 1 : 0 ) | 2 | halfcarrySubTable[lookup & 0x07] | overflowSubTable[lookup >> 4] | sz53Table[regs[1]];
	break;case 155:
	
	
var sbctemp = regs[1] - regs[4] - (regs[0] & 1);
var lookup = ( (regs[1] & 0x88) >> 3 ) | ( (regs[4] & 0x88) >> 2 ) | ( (sbctemp & 0x88) >> 1 );
regs[1] = sbctemp;
regs[0] = ( sbctemp & 0x100 ? 1 : 0 ) | 2 | halfcarrySubTable[lookup & 0x07] | overflowSubTable[lookup >> 4] | sz53Table[regs[1]];
	break;case 156:
	
	
var sbctemp = regs[1] - regs[17] - (regs[0] & 1);
var lookup = ( (regs[1] & 0x88) >> 3 ) | ( (regs[17] & 0x88) >> 2 ) | ( (sbctemp & 0x88) >> 1 );
regs[1] = sbctemp;
regs[0] = ( sbctemp & 0x100 ? 1 : 0 ) | 2 | halfcarrySubTable[lookup & 0x07] | overflowSubTable[lookup >> 4] | sz53Table[regs[1]];
	break;case 157:
	
	
var sbctemp = regs[1] - regs[16] - (regs[0] & 1);
var lookup = ( (regs[1] & 0x88) >> 3 ) | ( (regs[16] & 0x88) >> 2 ) | ( (sbctemp & 0x88) >> 1 );
regs[1] = sbctemp;
regs[0] = ( sbctemp & 0x100 ? 1 : 0 ) | 2 | halfcarrySubTable[lookup & 0x07] | overflowSubTable[lookup >> 4] | sz53Table[regs[1]];
	break;case 158:
	
	var offset = (tstates += ( 3), memory.read(regPairs[12]));
if (offset & 0x80) offset -= 0x100;
tstates += ( 1);
tstates += ( 1);
tstates += ( 1);
tstates += ( 1);
tstates += ( 1);
regPairs[12]++;var addr = (regPairs[8] + offset) & 0xffff;
var val = (tstates += ( 3), memory.read(addr));
var sbctemp = regs[1] - val - (regs[0] & 1);
var lookup = ( (regs[1] & 0x88) >> 3 ) | ( (val & 0x88) >> 2 ) | ( (sbctemp & 0x88) >> 1 );
regs[1] = sbctemp;
regs[0] = ( sbctemp & 0x100 ? 1 : 0 ) | 2 | halfcarrySubTable[lookup & 0x07] | overflowSubTable[lookup >> 4] | sz53Table[regs[1]];
	break;case 159:
	
	
var sbctemp = regs[1] - regs[1] - (regs[0] & 1);
var lookup = ( (regs[1] & 0x88) >> 3 ) | ( (regs[1] & 0x88) >> 2 ) | ( (sbctemp & 0x88) >> 1 );
regs[1] = sbctemp;
regs[0] = ( sbctemp & 0x100 ? 1 : 0 ) | 2 | halfcarrySubTable[lookup & 0x07] | overflowSubTable[lookup >> 4] | sz53Table[regs[1]];
	break;case 160:
	
	

regs[1] &= regs[3];
regs[0] = 16 | sz53pTable[regs[1]];
	break;case 161:
	
	

regs[1] &= regs[2];
regs[0] = 16 | sz53pTable[regs[1]];
	break;case 162:
	
	

regs[1] &= regs[5];
regs[0] = 16 | sz53pTable[regs[1]];
	break;case 163:
	
	

regs[1] &= regs[4];
regs[0] = 16 | sz53pTable[regs[1]];
	break;case 164:
	
	

regs[1] &= regs[17];
regs[0] = 16 | sz53pTable[regs[1]];
	break;case 165:
	
	

regs[1] &= regs[16];
regs[0] = 16 | sz53pTable[regs[1]];
	break;case 166:
	
	var offset = (tstates += ( 3), memory.read(regPairs[12]));
if (offset & 0x80) offset -= 0x100;
tstates += ( 1);
tstates += ( 1);
tstates += ( 1);
tstates += ( 1);
tstates += ( 1);
regPairs[12]++;var addr = (regPairs[8] + offset) & 0xffff;
var val = (tstates += ( 3), memory.read(addr));

regs[1] &= val;
regs[0] = 16 | sz53pTable[regs[1]];
	break;case 167:
	
	

regs[1] &= regs[1];
regs[0] = 16 | sz53pTable[regs[1]];
	break;case 168:
	
	
regs[1] ^= regs[3];
regs[0] = sz53pTable[regs[1]];
	break;case 169:
	
	
regs[1] ^= regs[2];
regs[0] = sz53pTable[regs[1]];
	break;case 170:
	
	
regs[1] ^= regs[5];
regs[0] = sz53pTable[regs[1]];
	break;case 171:
	
	
regs[1] ^= regs[4];
regs[0] = sz53pTable[regs[1]];
	break;case 172:
	
	
regs[1] ^= regs[17];
regs[0] = sz53pTable[regs[1]];
	break;case 173:
	
	
regs[1] ^= regs[16];
regs[0] = sz53pTable[regs[1]];
	break;case 174:
	
	var offset = (tstates += ( 3), memory.read(regPairs[12]));
if (offset & 0x80) offset -= 0x100;
tstates += ( 1);
tstates += ( 1);
tstates += ( 1);
tstates += ( 1);
tstates += ( 1);
regPairs[12]++;var addr = (regPairs[8] + offset) & 0xffff;
var val = (tstates += ( 3), memory.read(addr));
regs[1] ^= val;
regs[0] = sz53pTable[regs[1]];
	break;case 175:
	
	
regs[1] ^= regs[1];
regs[0] = sz53pTable[regs[1]];
	break;case 176:
	
	

regs[1] |= regs[3];
regs[0] = sz53pTable[regs[1]];
	break;case 177:
	
	

regs[1] |= regs[2];
regs[0] = sz53pTable[regs[1]];
	break;case 178:
	
	

regs[1] |= regs[5];
regs[0] = sz53pTable[regs[1]];
	break;case 179:
	
	

regs[1] |= regs[4];
regs[0] = sz53pTable[regs[1]];
	break;case 180:
	
	

regs[1] |= regs[17];
regs[0] = sz53pTable[regs[1]];
	break;case 181:
	
	

regs[1] |= regs[16];
regs[0] = sz53pTable[regs[1]];
	break;case 182:
	
	var offset = (tstates += ( 3), memory.read(regPairs[12]));
if (offset & 0x80) offset -= 0x100;
tstates += ( 1);
tstates += ( 1);
tstates += ( 1);
tstates += ( 1);
tstates += ( 1);
regPairs[12]++;var addr = (regPairs[8] + offset) & 0xffff;
var val = (tstates += ( 3), memory.read(addr));

regs[1] |= val;
regs[0] = sz53pTable[regs[1]];
	break;case 183:
	
	

regs[1] |= regs[1];
regs[0] = sz53pTable[regs[1]];
	break;case 184:
	
	

var cptemp = regs[1] - regs[3];
var lookup = ( (regs[1] & 0x88) >> 3 ) | ( (regs[3] & 0x88) >> 2 ) | ( (cptemp & 0x88) >> 1 );
regs[0] = ( cptemp & 0x100 ? 1 : ( cptemp ? 0 : 64 ) ) | 2 | halfcarrySubTable[lookup & 0x07] | overflowSubTable[lookup >> 4] | ( regs[3] & 40 ) | ( cptemp & 128 );
	break;case 185:
	
	

var cptemp = regs[1] - regs[2];
var lookup = ( (regs[1] & 0x88) >> 3 ) | ( (regs[2] & 0x88) >> 2 ) | ( (cptemp & 0x88) >> 1 );
regs[0] = ( cptemp & 0x100 ? 1 : ( cptemp ? 0 : 64 ) ) | 2 | halfcarrySubTable[lookup & 0x07] | overflowSubTable[lookup >> 4] | ( regs[2] & 40 ) | ( cptemp & 128 );
	break;case 186:
	
	

var cptemp = regs[1] - regs[5];
var lookup = ( (regs[1] & 0x88) >> 3 ) | ( (regs[5] & 0x88) >> 2 ) | ( (cptemp & 0x88) >> 1 );
regs[0] = ( cptemp & 0x100 ? 1 : ( cptemp ? 0 : 64 ) ) | 2 | halfcarrySubTable[lookup & 0x07] | overflowSubTable[lookup >> 4] | ( regs[5] & 40 ) | ( cptemp & 128 );
	break;case 187:
	
	

var cptemp = regs[1] - regs[4];
var lookup = ( (regs[1] & 0x88) >> 3 ) | ( (regs[4] & 0x88) >> 2 ) | ( (cptemp & 0x88) >> 1 );
regs[0] = ( cptemp & 0x100 ? 1 : ( cptemp ? 0 : 64 ) ) | 2 | halfcarrySubTable[lookup & 0x07] | overflowSubTable[lookup >> 4] | ( regs[4] & 40 ) | ( cptemp & 128 );
	break;case 188:
	
	

var cptemp = regs[1] - regs[17];
var lookup = ( (regs[1] & 0x88) >> 3 ) | ( (regs[17] & 0x88) >> 2 ) | ( (cptemp & 0x88) >> 1 );
regs[0] = ( cptemp & 0x100 ? 1 : ( cptemp ? 0 : 64 ) ) | 2 | halfcarrySubTable[lookup & 0x07] | overflowSubTable[lookup >> 4] | ( regs[17] & 40 ) | ( cptemp & 128 );
	break;case 189:
	
	

var cptemp = regs[1] - regs[16];
var lookup = ( (regs[1] & 0x88) >> 3 ) | ( (regs[16] & 0x88) >> 2 ) | ( (cptemp & 0x88) >> 1 );
regs[0] = ( cptemp & 0x100 ? 1 : ( cptemp ? 0 : 64 ) ) | 2 | halfcarrySubTable[lookup & 0x07] | overflowSubTable[lookup >> 4] | ( regs[16] & 40 ) | ( cptemp & 128 );
	break;case 190:
	
	var offset = (tstates += ( 3), memory.read(regPairs[12]));
if (offset & 0x80) offset -= 0x100;
tstates += ( 1);
tstates += ( 1);
tstates += ( 1);
tstates += ( 1);
tstates += ( 1);
regPairs[12]++;var addr = (regPairs[8] + offset) & 0xffff;
var val = (tstates += ( 3), memory.read(addr));

var cptemp = regs[1] - val;
var lookup = ( (regs[1] & 0x88) >> 3 ) | ( (val & 0x88) >> 2 ) | ( (cptemp & 0x88) >> 1 );
regs[0] = ( cptemp & 0x100 ? 1 : ( cptemp ? 0 : 64 ) ) | 2 | halfcarrySubTable[lookup & 0x07] | overflowSubTable[lookup >> 4] | ( val & 40 ) | ( cptemp & 128 );
	break;case 191:
	
	

var cptemp = regs[1] - regs[1];
var lookup = ( (regs[1] & 0x88) >> 3 ) | ( (regs[1] & 0x88) >> 2 ) | ( (cptemp & 0x88) >> 1 );
regs[0] = ( cptemp & 0x100 ? 1 : ( cptemp ? 0 : 64 ) ) | 2 | halfcarrySubTable[lookup & 0x07] | overflowSubTable[lookup >> 4] | ( regs[1] & 40 ) | ( cptemp & 128 );
	break;case 192:
	
	tstates += ( 1);
if (!(regs[0] & 64)) {
	var l = (tstates += ( 3), memory.read(regPairs[11])); regPairs[11]++;
	var h = (tstates += ( 3), memory.read(regPairs[11])); regPairs[11]++;
	regPairs[12] = (h<<8) | l;
}
	break;case 193:
	
	var l = (tstates += ( 3), memory.read(regPairs[11])); regPairs[11]++;
var h = (tstates += ( 3), memory.read(regPairs[11])); regPairs[11]++;
regPairs[1] = (h<<8) | l;
	break;case 194:
	
	if (!(regs[0] & 64)) {
	var l = (tstates += ( 3), memory.read(regPairs[12])); regPairs[12]++;
	var h = (tstates += ( 3), memory.read(regPairs[12])); regPairs[12]++;
	regPairs[12] = (h<<8) | l;
} else {
	tstates += ( 3);
	regPairs[12]++;
	tstates += ( 3);
	regPairs[12]++;
}
	break;case 195:
	
	var l = (tstates += ( 3), memory.read(regPairs[12])); regPairs[12]++;
var h = (tstates += ( 3), memory.read(regPairs[12])); regPairs[12]++;
regPairs[12] = (h<<8) | l;
	break;case 196:
	
	if (!(regs[0] & 64)) {
	var l = (tstates += ( 3), memory.read(regPairs[12])); regPairs[12]++;
	var h = (tstates += ( 3), memory.read(regPairs[12]));
	tstates += ( 1);
	regPairs[12]++;
	regPairs[11]--; tstates += ( 3);
while (display.nextEventTime != null && display.nextEventTime < tstates) display.doEvent();
memory.write(regPairs[11], regPairs[12] >> 8);;
	regPairs[11]--; tstates += ( 3);
while (display.nextEventTime != null && display.nextEventTime < tstates) display.doEvent();
memory.write(regPairs[11], regPairs[12] & 0xff);;
	regPairs[12] = (h<<8) | l;
} else {
	tstates += ( 3);
	regPairs[12]++;
	tstates += ( 3);
	regPairs[12]++;
}
	break;case 197:
	
	tstates += ( 1);
regPairs[11]--; tstates += ( 3);
while (display.nextEventTime != null && display.nextEventTime < tstates) display.doEvent();
memory.write(regPairs[11], regPairs[1] >> 8);;
regPairs[11]--; tstates += ( 3);
while (display.nextEventTime != null && display.nextEventTime < tstates) display.doEvent();
memory.write(regPairs[11], regPairs[1] & 0xff);;
	break;case 198:
	
	var val = (tstates += ( 3), memory.read(regPairs[12])); regPairs[12]++;

var addtemp = regs[1] + val;
var lookup = ( (regs[1] & 0x88) >> 3 ) | ( (val & 0x88) >> 2 ) | ( (addtemp & 0x88) >> 1 );
regs[1] = addtemp;
regs[0] = ( addtemp & 0x100 ? 1 : 0 ) | halfcarryAddTable[lookup & 0x07] | overflowAddTable[lookup >> 4] | sz53Table[regs[1]];
	break;case 199:
	
	tstates += ( 1);
regPairs[11]--; tstates += ( 3);
while (display.nextEventTime != null && display.nextEventTime < tstates) display.doEvent();
memory.write(regPairs[11], regPairs[12] >> 8);;
regPairs[11]--; tstates += ( 3);
while (display.nextEventTime != null && display.nextEventTime < tstates) display.doEvent();
memory.write(regPairs[11], regPairs[12] & 0xff);;
regPairs[12] = 0;
	break;case 200:
	
	tstates += ( 1);
if (regs[0] & 64) {
	var l = (tstates += ( 3), memory.read(regPairs[11])); regPairs[11]++;
	var h = (tstates += ( 3), memory.read(regPairs[11])); regPairs[11]++;
	regPairs[12] = (h<<8) | l;
}
	break;case 201:
	
	var l = (tstates += ( 3), memory.read(regPairs[11])); regPairs[11]++;
var h = (tstates += ( 3), memory.read(regPairs[11])); regPairs[11]++;
regPairs[12] = (h<<8) | l;
	break;case 202:
	
	if (regs[0] & 64) {
	var l = (tstates += ( 3), memory.read(regPairs[12])); regPairs[12]++;
	var h = (tstates += ( 3), memory.read(regPairs[12])); regPairs[12]++;
	regPairs[12] = (h<<8) | l;
} else {
	tstates += ( 3);
	regPairs[12]++;
	tstates += ( 3);
	regPairs[12]++;
}
	break;case 203:
	
	opcodePrefix = 'DDCB';
interruptible = false;
	break;case 204:
	
	if (regs[0] & 64) {
	var l = (tstates += ( 3), memory.read(regPairs[12])); regPairs[12]++;
	var h = (tstates += ( 3), memory.read(regPairs[12]));
	tstates += ( 1);
	regPairs[12]++;
	regPairs[11]--; tstates += ( 3);
while (display.nextEventTime != null && display.nextEventTime < tstates) display.doEvent();
memory.write(regPairs[11], regPairs[12] >> 8);;
	regPairs[11]--; tstates += ( 3);
while (display.nextEventTime != null && display.nextEventTime < tstates) display.doEvent();
memory.write(regPairs[11], regPairs[12] & 0xff);;
	regPairs[12] = (h<<8) | l;
} else {
	tstates += ( 3);
	regPairs[12]++;
	tstates += ( 3);
	regPairs[12]++;
}
	break;case 205:
	
	var l = (tstates += ( 3), memory.read(regPairs[12])); regPairs[12]++;
var h = (tstates += ( 3), memory.read(regPairs[12]));
tstates += ( 1);
regPairs[12]++;
regPairs[11]--; tstates += ( 3);
while (display.nextEventTime != null && display.nextEventTime < tstates) display.doEvent();
memory.write(regPairs[11], regPairs[12] >> 8);;
regPairs[11]--; tstates += ( 3);
while (display.nextEventTime != null && display.nextEventTime < tstates) display.doEvent();
memory.write(regPairs[11], regPairs[12] & 0xff);;
regPairs[12] = (h<<8) | l;
	break;case 206:
	
	var val = (tstates += ( 3), memory.read(regPairs[12])); regPairs[12]++;

var adctemp = regs[1] + val + (regs[0] & 1);
var lookup = ( (regs[1] & 0x88) >> 3 ) | ( (val & 0x88) >> 2 ) | ( (adctemp & 0x88) >> 1 );
regs[1] = adctemp;
regs[0] = ( adctemp & 0x100 ? 1 : 0 ) | halfcarryAddTable[lookup & 0x07] | overflowAddTable[lookup >> 4] | sz53Table[regs[1]];
	break;case 207:
	
	tstates += ( 1);
regPairs[11]--; tstates += ( 3);
while (display.nextEventTime != null && display.nextEventTime < tstates) display.doEvent();
memory.write(regPairs[11], regPairs[12] >> 8);;
regPairs[11]--; tstates += ( 3);
while (display.nextEventTime != null && display.nextEventTime < tstates) display.doEvent();
memory.write(regPairs[11], regPairs[12] & 0xff);;
regPairs[12] = 8;
	break;case 208:
	
	tstates += ( 1);
if (!(regs[0] & 1)) {
	var l = (tstates += ( 3), memory.read(regPairs[11])); regPairs[11]++;
	var h = (tstates += ( 3), memory.read(regPairs[11])); regPairs[11]++;
	regPairs[12] = (h<<8) | l;
}
	break;case 209:
	
	var l = (tstates += ( 3), memory.read(regPairs[11])); regPairs[11]++;
var h = (tstates += ( 3), memory.read(regPairs[11])); regPairs[11]++;
regPairs[2] = (h<<8) | l;
	break;case 210:
	
	if (!(regs[0] & 1)) {
	var l = (tstates += ( 3), memory.read(regPairs[12])); regPairs[12]++;
	var h = (tstates += ( 3), memory.read(regPairs[12])); regPairs[12]++;
	regPairs[12] = (h<<8) | l;
} else {
	tstates += ( 3);
	regPairs[12]++;
	tstates += ( 3);
	regPairs[12]++;
}
	break;case 211:
	
	var port = (regs[1] << 8) | (tstates += ( 3), memory.read(regPairs[12])); regPairs[12]++;
tstates += 1;
ioBus.write(port, regs[1], tstates);
tstates += 3;
	break;case 212:
	
	if (!(regs[0] & 1)) {
	var l = (tstates += ( 3), memory.read(regPairs[12])); regPairs[12]++;
	var h = (tstates += ( 3), memory.read(regPairs[12]));
	tstates += ( 1);
	regPairs[12]++;
	regPairs[11]--; tstates += ( 3);
while (display.nextEventTime != null && display.nextEventTime < tstates) display.doEvent();
memory.write(regPairs[11], regPairs[12] >> 8);;
	regPairs[11]--; tstates += ( 3);
while (display.nextEventTime != null && display.nextEventTime < tstates) display.doEvent();
memory.write(regPairs[11], regPairs[12] & 0xff);;
	regPairs[12] = (h<<8) | l;
} else {
	tstates += ( 3);
	regPairs[12]++;
	tstates += ( 3);
	regPairs[12]++;
}
	break;case 213:
	
	tstates += ( 1);
regPairs[11]--; tstates += ( 3);
while (display.nextEventTime != null && display.nextEventTime < tstates) display.doEvent();
memory.write(regPairs[11], regPairs[2] >> 8);;
regPairs[11]--; tstates += ( 3);
while (display.nextEventTime != null && display.nextEventTime < tstates) display.doEvent();
memory.write(regPairs[11], regPairs[2] & 0xff);;
	break;case 214:
	
	var val = (tstates += ( 3), memory.read(regPairs[12])); regPairs[12]++;
var subtemp = regs[1] - val;
var lookup = ( (regs[1] & 0x88) >> 3 ) | ( (val & 0x88) >> 2 ) | ( (subtemp & 0x88) >> 1 );
regs[1] = subtemp;
regs[0] = ( subtemp & 0x100 ? 1 : 0 ) | 2 | halfcarrySubTable[lookup & 0x07] | overflowSubTable[lookup >> 4] | sz53Table[regs[1]];
	break;case 215:
	
	tstates += ( 1);
regPairs[11]--; tstates += ( 3);
while (display.nextEventTime != null && display.nextEventTime < tstates) display.doEvent();
memory.write(regPairs[11], regPairs[12] >> 8);;
regPairs[11]--; tstates += ( 3);
while (display.nextEventTime != null && display.nextEventTime < tstates) display.doEvent();
memory.write(regPairs[11], regPairs[12] & 0xff);;
regPairs[12] = 16;
	break;case 216:
	
	tstates += ( 1);
if (regs[0] & 1) {
	var l = (tstates += ( 3), memory.read(regPairs[11])); regPairs[11]++;
	var h = (tstates += ( 3), memory.read(regPairs[11])); regPairs[11]++;
	regPairs[12] = (h<<8) | l;
}
	break;case 217:
	
	var wordtemp;
wordtemp = regPairs[1]; regPairs[1] = regPairs[5]; regPairs[5] = wordtemp;
wordtemp = regPairs[2]; regPairs[2] = regPairs[6]; regPairs[6] = wordtemp;
wordtemp = regPairs[3]; regPairs[3] = regPairs[7]; regPairs[7] = wordtemp;
	break;case 218:
	
	if (regs[0] & 1) {
	var l = (tstates += ( 3), memory.read(regPairs[12])); regPairs[12]++;
	var h = (tstates += ( 3), memory.read(regPairs[12])); regPairs[12]++;
	regPairs[12] = (h<<8) | l;
} else {
	tstates += ( 3);
	regPairs[12]++;
	tstates += ( 3);
	regPairs[12]++;
}
	break;case 219:
	
	var val = (tstates += ( 3), memory.read(regPairs[12])); regPairs[12]++;
var port = (regs[1] << 8) | val;
tstates += 1;
regs[1] = ioBus.read(port);
tstates += 3;
	break;case 220:
	
	if (regs[0] & 1) {
	var l = (tstates += ( 3), memory.read(regPairs[12])); regPairs[12]++;
	var h = (tstates += ( 3), memory.read(regPairs[12]));
	tstates += ( 1);
	regPairs[12]++;
	regPairs[11]--; tstates += ( 3);
while (display.nextEventTime != null && display.nextEventTime < tstates) display.doEvent();
memory.write(regPairs[11], regPairs[12] >> 8);;
	regPairs[11]--; tstates += ( 3);
while (display.nextEventTime != null && display.nextEventTime < tstates) display.doEvent();
memory.write(regPairs[11], regPairs[12] & 0xff);;
	regPairs[12] = (h<<8) | l;
} else {
	tstates += ( 3);
	regPairs[12]++;
	tstates += ( 3);
	regPairs[12]++;
}
	break;case 221:
	
	opcodePrefix = 'DD';
interruptible = false;
	break;case 222:
	
	var val = (tstates += ( 3), memory.read(regPairs[12])); regPairs[12]++;
var sbctemp = regs[1] - val - (regs[0] & 1);
var lookup = ( (regs[1] & 0x88) >> 3 ) | ( (val & 0x88) >> 2 ) | ( (sbctemp & 0x88) >> 1 );
regs[1] = sbctemp;
regs[0] = ( sbctemp & 0x100 ? 1 : 0 ) | 2 | halfcarrySubTable[lookup & 0x07] | overflowSubTable[lookup >> 4] | sz53Table[regs[1]];
	break;case 223:
	
	tstates += ( 1);
regPairs[11]--; tstates += ( 3);
while (display.nextEventTime != null && display.nextEventTime < tstates) display.doEvent();
memory.write(regPairs[11], regPairs[12] >> 8);;
regPairs[11]--; tstates += ( 3);
while (display.nextEventTime != null && display.nextEventTime < tstates) display.doEvent();
memory.write(regPairs[11], regPairs[12] & 0xff);;
regPairs[12] = 24;
	break;case 224:
	
	tstates += ( 1);
if (!(regs[0] & 4)) {
	var l = (tstates += ( 3), memory.read(regPairs[11])); regPairs[11]++;
	var h = (tstates += ( 3), memory.read(regPairs[11])); regPairs[11]++;
	regPairs[12] = (h<<8) | l;
}
	break;case 225:
	
	var l = (tstates += ( 3), memory.read(regPairs[11])); regPairs[11]++;
var h = (tstates += ( 3), memory.read(regPairs[11])); regPairs[11]++;
regPairs[8] = (h<<8) | l;
	break;case 226:
	
	if (!(regs[0] & 4)) {
	var l = (tstates += ( 3), memory.read(regPairs[12])); regPairs[12]++;
	var h = (tstates += ( 3), memory.read(regPairs[12])); regPairs[12]++;
	regPairs[12] = (h<<8) | l;
} else {
	tstates += ( 3);
	regPairs[12]++;
	tstates += ( 3);
	regPairs[12]++;
}
	break;case 227:
	
	var l = (tstates += ( 3), memory.read(regPairs[11]));
var spPlus1 = (regPairs[11] + 1) & 0xffff;
var h = (tstates += ( 3), memory.read(spPlus1));
tstates += ( 1);
tstates += ( 3);
while (display.nextEventTime != null && display.nextEventTime < tstates) display.doEvent();
memory.write(spPlus1, regPairs[8] >> 8);;
tstates += ( 3);
while (display.nextEventTime != null && display.nextEventTime < tstates) display.doEvent();
memory.write(regPairs[11], regPairs[8] & 0xff);;
regPairs[8] = (h<<8) | l;
tstates += ( 1);
tstates += ( 1);
	break;case 228:
	
	if (!(regs[0] & 4)) {
	var l = (tstates += ( 3), memory.read(regPairs[12])); regPairs[12]++;
	var h = (tstates += ( 3), memory.read(regPairs[12]));
	tstates += ( 1);
	regPairs[12]++;
	regPairs[11]--; tstates += ( 3);
while (display.nextEventTime != null && display.nextEventTime < tstates) display.doEvent();
memory.write(regPairs[11], regPairs[12] >> 8);;
	regPairs[11]--; tstates += ( 3);
while (display.nextEventTime != null && display.nextEventTime < tstates) display.doEvent();
memory.write(regPairs[11], regPairs[12] & 0xff);;
	regPairs[12] = (h<<8) | l;
} else {
	tstates += ( 3);
	regPairs[12]++;
	tstates += ( 3);
	regPairs[12]++;
}
	break;case 229:
	
	tstates += ( 1);
regPairs[11]--; tstates += ( 3);
while (display.nextEventTime != null && display.nextEventTime < tstates) display.doEvent();
memory.write(regPairs[11], regPairs[8] >> 8);;
regPairs[11]--; tstates += ( 3);
while (display.nextEventTime != null && display.nextEventTime < tstates) display.doEvent();
memory.write(regPairs[11], regPairs[8] & 0xff);;
	break;case 230:
	
	var val = (tstates += ( 3), memory.read(regPairs[12])); regPairs[12]++;

regs[1] &= val;
regs[0] = 16 | sz53pTable[regs[1]];
	break;case 231:
	
	tstates += ( 1);
regPairs[11]--; tstates += ( 3);
while (display.nextEventTime != null && display.nextEventTime < tstates) display.doEvent();
memory.write(regPairs[11], regPairs[12] >> 8);;
regPairs[11]--; tstates += ( 3);
while (display.nextEventTime != null && display.nextEventTime < tstates) display.doEvent();
memory.write(regPairs[11], regPairs[12] & 0xff);;
regPairs[12] = 32;
	break;case 232:
	
	tstates += ( 1);
if (regs[0] & 4) {
	var l = (tstates += ( 3), memory.read(regPairs[11])); regPairs[11]++;
	var h = (tstates += ( 3), memory.read(regPairs[11])); regPairs[11]++;
	regPairs[12] = (h<<8) | l;
}
	break;case 233:
	
	regPairs[12] = regPairs[8];
	break;case 234:
	
	if (regs[0] & 4) {
	var l = (tstates += ( 3), memory.read(regPairs[12])); regPairs[12]++;
	var h = (tstates += ( 3), memory.read(regPairs[12])); regPairs[12]++;
	regPairs[12] = (h<<8) | l;
} else {
	tstates += ( 3);
	regPairs[12]++;
	tstates += ( 3);
	regPairs[12]++;
}
	break;case 235:
	
	var temp = regPairs[2];
regPairs[2] = regPairs[3];
regPairs[3] = temp;
	break;case 236:
	
	if (regs[0] & 4) {
	var l = (tstates += ( 3), memory.read(regPairs[12])); regPairs[12]++;
	var h = (tstates += ( 3), memory.read(regPairs[12]));
	tstates += ( 1);
	regPairs[12]++;
	regPairs[11]--; tstates += ( 3);
while (display.nextEventTime != null && display.nextEventTime < tstates) display.doEvent();
memory.write(regPairs[11], regPairs[12] >> 8);;
	regPairs[11]--; tstates += ( 3);
while (display.nextEventTime != null && display.nextEventTime < tstates) display.doEvent();
memory.write(regPairs[11], regPairs[12] & 0xff);;
	regPairs[12] = (h<<8) | l;
} else {
	tstates += ( 3);
	regPairs[12]++;
	tstates += ( 3);
	regPairs[12]++;
}
	break;case 237:
	
	opcodePrefix = 'ED';
interruptible = false;
	break;case 238:
	
	var val = (tstates += ( 3), memory.read(regPairs[12])); regPairs[12]++;
regs[1] ^= val;
regs[0] = sz53pTable[regs[1]];
	break;case 239:
	
	tstates += ( 1);
regPairs[11]--; tstates += ( 3);
while (display.nextEventTime != null && display.nextEventTime < tstates) display.doEvent();
memory.write(regPairs[11], regPairs[12] >> 8);;
regPairs[11]--; tstates += ( 3);
while (display.nextEventTime != null && display.nextEventTime < tstates) display.doEvent();
memory.write(regPairs[11], regPairs[12] & 0xff);;
regPairs[12] = 40;
	break;case 240:
	
	tstates += ( 1);
if (!(regs[0] & 128)) {
	var l = (tstates += ( 3), memory.read(regPairs[11])); regPairs[11]++;
	var h = (tstates += ( 3), memory.read(regPairs[11])); regPairs[11]++;
	regPairs[12] = (h<<8) | l;
}
	break;case 241:
	
	var l = (tstates += ( 3), memory.read(regPairs[11])); regPairs[11]++;
var h = (tstates += ( 3), memory.read(regPairs[11])); regPairs[11]++;
regPairs[0] = (h<<8) | l;
	break;case 242:
	
	if (!(regs[0] & 128)) {
	var l = (tstates += ( 3), memory.read(regPairs[12])); regPairs[12]++;
	var h = (tstates += ( 3), memory.read(regPairs[12])); regPairs[12]++;
	regPairs[12] = (h<<8) | l;
} else {
	tstates += ( 3);
	regPairs[12]++;
	tstates += ( 3);
	regPairs[12]++;
}
	break;case 243:
	
	iff1 = iff2 = 0;
	break;case 244:
	
	if (!(regs[0] & 128)) {
	var l = (tstates += ( 3), memory.read(regPairs[12])); regPairs[12]++;
	var h = (tstates += ( 3), memory.read(regPairs[12]));
	tstates += ( 1);
	regPairs[12]++;
	regPairs[11]--; tstates += ( 3);
while (display.nextEventTime != null && display.nextEventTime < tstates) display.doEvent();
memory.write(regPairs[11], regPairs[12] >> 8);;
	regPairs[11]--; tstates += ( 3);
while (display.nextEventTime != null && display.nextEventTime < tstates) display.doEvent();
memory.write(regPairs[11], regPairs[12] & 0xff);;
	regPairs[12] = (h<<8) | l;
} else {
	tstates += ( 3);
	regPairs[12]++;
	tstates += ( 3);
	regPairs[12]++;
}
	break;case 245:
	
	tstates += ( 1);
regPairs[11]--; tstates += ( 3);
while (display.nextEventTime != null && display.nextEventTime < tstates) display.doEvent();
memory.write(regPairs[11], regPairs[0] >> 8);;
regPairs[11]--; tstates += ( 3);
while (display.nextEventTime != null && display.nextEventTime < tstates) display.doEvent();
memory.write(regPairs[11], regPairs[0] & 0xff);;
	break;case 246:
	
	var val = (tstates += ( 3), memory.read(regPairs[12])); regPairs[12]++;

regs[1] |= val;
regs[0] = sz53pTable[regs[1]];
	break;case 247:
	
	tstates += ( 1);
regPairs[11]--; tstates += ( 3);
while (display.nextEventTime != null && display.nextEventTime < tstates) display.doEvent();
memory.write(regPairs[11], regPairs[12] >> 8);;
regPairs[11]--; tstates += ( 3);
while (display.nextEventTime != null && display.nextEventTime < tstates) display.doEvent();
memory.write(regPairs[11], regPairs[12] & 0xff);;
regPairs[12] = 48;
	break;case 248:
	
	tstates += ( 1);
if (regs[0] & 128) {
	var l = (tstates += ( 3), memory.read(regPairs[11])); regPairs[11]++;
	var h = (tstates += ( 3), memory.read(regPairs[11])); regPairs[11]++;
	regPairs[12] = (h<<8) | l;
}
	break;case 249:
	
	regPairs[11] = regPairs[8];
tstates += ( 1);
tstates += ( 1);
	break;case 250:
	
	if (regs[0] & 128) {
	var l = (tstates += ( 3), memory.read(regPairs[12])); regPairs[12]++;
	var h = (tstates += ( 3), memory.read(regPairs[12])); regPairs[12]++;
	regPairs[12] = (h<<8) | l;
} else {
	tstates += ( 3);
	regPairs[12]++;
	tstates += ( 3);
	regPairs[12]++;
}
	break;case 251:
	
	iff1 = iff2 = 1;
interruptible = false;
	break;case 252:
	
	if (regs[0] & 128) {
	var l = (tstates += ( 3), memory.read(regPairs[12])); regPairs[12]++;
	var h = (tstates += ( 3), memory.read(regPairs[12]));
	tstates += ( 1);
	regPairs[12]++;
	regPairs[11]--; tstates += ( 3);
while (display.nextEventTime != null && display.nextEventTime < tstates) display.doEvent();
memory.write(regPairs[11], regPairs[12] >> 8);;
	regPairs[11]--; tstates += ( 3);
while (display.nextEventTime != null && display.nextEventTime < tstates) display.doEvent();
memory.write(regPairs[11], regPairs[12] & 0xff);;
	regPairs[12] = (h<<8) | l;
} else {
	tstates += ( 3);
	regPairs[12]++;
	tstates += ( 3);
	regPairs[12]++;
}
	break;case 253:
	
	opcodePrefix = 'FD';
interruptible = false;
	break;case 254:
	
	var val = (tstates += ( 3), memory.read(regPairs[12])); regPairs[12]++;

var cptemp = regs[1] - val;
var lookup = ( (regs[1] & 0x88) >> 3 ) | ( (val & 0x88) >> 2 ) | ( (cptemp & 0x88) >> 1 );
regs[0] = ( cptemp & 0x100 ? 1 : ( cptemp ? 0 : 64 ) ) | 2 | halfcarrySubTable[lookup & 0x07] | overflowSubTable[lookup >> 4] | ( val & 40 ) | ( cptemp & 128 );
	break;case 255:
	
	tstates += ( 1);
regPairs[11]--; tstates += ( 3);
while (display.nextEventTime != null && display.nextEventTime < tstates) display.doEvent();
memory.write(regPairs[11], regPairs[12] >> 8);;
regPairs[11]--; tstates += ( 3);
while (display.nextEventTime != null && display.nextEventTime < tstates) display.doEvent();
memory.write(regPairs[11], regPairs[12] & 0xff);;
regPairs[12] = 56;
	break;
	default:
		var addr = regPairs[12] - 1;
		throw("Unimplemented opcode " + opcode + " in page dd - PC = " + addr);
}
					break;
				case 'DDCB':
					offset = (tstates += ( 3), memory.read(regPairs[12])); regPairs[12]++;
					if (offset & 0x80) offset -= 0x100;
					tstates += ( 3);
					opcode = memory.read(regPairs[12]);
					tstates += ( 1);
					tstates += ( 1);
					regPairs[12]++;
					switch (opcode) {
	case 0:
	
	var addr = (regPairs[8] + offset) & 0xffff;
regs[3] = (tstates += ( 3), memory.read(addr));

regs[3] = ( (regs[3] << 1) | (regs[3] >> 7) ) ;
regs[0] = (regs[3] & 1) | sz53pTable[regs[3]];

tstates += ( 1);
tstates += ( 3);
while (display.nextEventTime != null && display.nextEventTime < tstates) display.doEvent();
memory.write(addr, regs[3]);;
	break;case 1:
	
	var addr = (regPairs[8] + offset) & 0xffff;
regs[2] = (tstates += ( 3), memory.read(addr));

regs[2] = ( (regs[2] << 1) | (regs[2] >> 7) ) ;
regs[0] = (regs[2] & 1) | sz53pTable[regs[2]];

tstates += ( 1);
tstates += ( 3);
while (display.nextEventTime != null && display.nextEventTime < tstates) display.doEvent();
memory.write(addr, regs[2]);;
	break;case 2:
	
	var addr = (regPairs[8] + offset) & 0xffff;
regs[5] = (tstates += ( 3), memory.read(addr));

regs[5] = ( (regs[5] << 1) | (regs[5] >> 7) ) ;
regs[0] = (regs[5] & 1) | sz53pTable[regs[5]];

tstates += ( 1);
tstates += ( 3);
while (display.nextEventTime != null && display.nextEventTime < tstates) display.doEvent();
memory.write(addr, regs[5]);;
	break;case 3:
	
	var addr = (regPairs[8] + offset) & 0xffff;
regs[4] = (tstates += ( 3), memory.read(addr));

regs[4] = ( (regs[4] << 1) | (regs[4] >> 7) ) ;
regs[0] = (regs[4] & 1) | sz53pTable[regs[4]];

tstates += ( 1);
tstates += ( 3);
while (display.nextEventTime != null && display.nextEventTime < tstates) display.doEvent();
memory.write(addr, regs[4]);;
	break;case 4:
	
	var addr = (regPairs[8] + offset) & 0xffff;
regs[7] = (tstates += ( 3), memory.read(addr));

regs[7] = ( (regs[7] << 1) | (regs[7] >> 7) ) ;
regs[0] = (regs[7] & 1) | sz53pTable[regs[7]];

tstates += ( 1);
tstates += ( 3);
while (display.nextEventTime != null && display.nextEventTime < tstates) display.doEvent();
memory.write(addr, regs[7]);;
	break;case 5:
	
	var addr = (regPairs[8] + offset) & 0xffff;
regs[6] = (tstates += ( 3), memory.read(addr));

regs[6] = ( (regs[6] << 1) | (regs[6] >> 7) ) ;
regs[0] = (regs[6] & 1) | sz53pTable[regs[6]];

tstates += ( 1);
tstates += ( 3);
while (display.nextEventTime != null && display.nextEventTime < tstates) display.doEvent();
memory.write(addr, regs[6]);;
	break;case 6:
	
	var addr = (regPairs[8] + offset) & 0xffff;
var val = (tstates += ( 3), memory.read(addr));
val = ( (val << 1) | (val >> 7) ) & 0xff;
regs[0] = (val & 1) | sz53pTable[val];
tstates += ( 1);
tstates += ( 3);
while (display.nextEventTime != null && display.nextEventTime < tstates) display.doEvent();
memory.write(addr, val);;
	break;case 7:
	
	var addr = (regPairs[8] + offset) & 0xffff;
regs[1] = (tstates += ( 3), memory.read(addr));

regs[1] = ( (regs[1] << 1) | (regs[1] >> 7) ) ;
regs[0] = (regs[1] & 1) | sz53pTable[regs[1]];

tstates += ( 1);
tstates += ( 3);
while (display.nextEventTime != null && display.nextEventTime < tstates) display.doEvent();
memory.write(addr, regs[1]);;
	break;case 8:
	
	var addr = (regPairs[8] + offset) & 0xffff;
regs[3] = (tstates += ( 3), memory.read(addr));

regs[0] = regs[3] & 1;
regs[3] = ( (regs[3] >> 1) | (regs[3] << 7) ) ;
regs[0] |= sz53pTable[regs[3]];

tstates += ( 1);
tstates += ( 3);
while (display.nextEventTime != null && display.nextEventTime < tstates) display.doEvent();
memory.write(addr, regs[3]);;
	break;case 9:
	
	var addr = (regPairs[8] + offset) & 0xffff;
regs[2] = (tstates += ( 3), memory.read(addr));

regs[0] = regs[2] & 1;
regs[2] = ( (regs[2] >> 1) | (regs[2] << 7) ) ;
regs[0] |= sz53pTable[regs[2]];

tstates += ( 1);
tstates += ( 3);
while (display.nextEventTime != null && display.nextEventTime < tstates) display.doEvent();
memory.write(addr, regs[2]);;
	break;case 10:
	
	var addr = (regPairs[8] + offset) & 0xffff;
regs[5] = (tstates += ( 3), memory.read(addr));

regs[0] = regs[5] & 1;
regs[5] = ( (regs[5] >> 1) | (regs[5] << 7) ) ;
regs[0] |= sz53pTable[regs[5]];

tstates += ( 1);
tstates += ( 3);
while (display.nextEventTime != null && display.nextEventTime < tstates) display.doEvent();
memory.write(addr, regs[5]);;
	break;case 11:
	
	var addr = (regPairs[8] + offset) & 0xffff;
regs[4] = (tstates += ( 3), memory.read(addr));

regs[0] = regs[4] & 1;
regs[4] = ( (regs[4] >> 1) | (regs[4] << 7) ) ;
regs[0] |= sz53pTable[regs[4]];

tstates += ( 1);
tstates += ( 3);
while (display.nextEventTime != null && display.nextEventTime < tstates) display.doEvent();
memory.write(addr, regs[4]);;
	break;case 12:
	
	var addr = (regPairs[8] + offset) & 0xffff;
regs[7] = (tstates += ( 3), memory.read(addr));

regs[0] = regs[7] & 1;
regs[7] = ( (regs[7] >> 1) | (regs[7] << 7) ) ;
regs[0] |= sz53pTable[regs[7]];

tstates += ( 1);
tstates += ( 3);
while (display.nextEventTime != null && display.nextEventTime < tstates) display.doEvent();
memory.write(addr, regs[7]);;
	break;case 13:
	
	var addr = (regPairs[8] + offset) & 0xffff;
regs[6] = (tstates += ( 3), memory.read(addr));

regs[0] = regs[6] & 1;
regs[6] = ( (regs[6] >> 1) | (regs[6] << 7) ) ;
regs[0] |= sz53pTable[regs[6]];

tstates += ( 1);
tstates += ( 3);
while (display.nextEventTime != null && display.nextEventTime < tstates) display.doEvent();
memory.write(addr, regs[6]);;
	break;case 14:
	
	var addr = (regPairs[8] + offset) & 0xffff;
var val = (tstates += ( 3), memory.read(addr));
regs[0] = val & 1;
val = ( (val >> 1) | (val << 7) ) & 0xff;
regs[0] |= sz53pTable[val];
tstates += ( 1);
tstates += ( 3);
while (display.nextEventTime != null && display.nextEventTime < tstates) display.doEvent();
memory.write(addr, val);;
	break;case 15:
	
	var addr = (regPairs[8] + offset) & 0xffff;
regs[1] = (tstates += ( 3), memory.read(addr));

regs[0] = regs[1] & 1;
regs[1] = ( (regs[1] >> 1) | (regs[1] << 7) ) ;
regs[0] |= sz53pTable[regs[1]];

tstates += ( 1);
tstates += ( 3);
while (display.nextEventTime != null && display.nextEventTime < tstates) display.doEvent();
memory.write(addr, regs[1]);;
	break;case 16:
	
	var addr = (regPairs[8] + offset) & 0xffff;
regs[3] = (tstates += ( 3), memory.read(addr));

var rltemp = regs[3];
regs[3] = ( (regs[3] << 1) | (regs[0] & 1) ) ;
regs[0] = ( rltemp >> 7 ) | sz53pTable[regs[3]];

tstates += ( 1);
tstates += ( 3);
while (display.nextEventTime != null && display.nextEventTime < tstates) display.doEvent();
memory.write(addr, regs[3]);;
	break;case 17:
	
	var addr = (regPairs[8] + offset) & 0xffff;
regs[2] = (tstates += ( 3), memory.read(addr));

var rltemp = regs[2];
regs[2] = ( (regs[2] << 1) | (regs[0] & 1) ) ;
regs[0] = ( rltemp >> 7 ) | sz53pTable[regs[2]];

tstates += ( 1);
tstates += ( 3);
while (display.nextEventTime != null && display.nextEventTime < tstates) display.doEvent();
memory.write(addr, regs[2]);;
	break;case 18:
	
	var addr = (regPairs[8] + offset) & 0xffff;
regs[5] = (tstates += ( 3), memory.read(addr));

var rltemp = regs[5];
regs[5] = ( (regs[5] << 1) | (regs[0] & 1) ) ;
regs[0] = ( rltemp >> 7 ) | sz53pTable[regs[5]];

tstates += ( 1);
tstates += ( 3);
while (display.nextEventTime != null && display.nextEventTime < tstates) display.doEvent();
memory.write(addr, regs[5]);;
	break;case 19:
	
	var addr = (regPairs[8] + offset) & 0xffff;
regs[4] = (tstates += ( 3), memory.read(addr));

var rltemp = regs[4];
regs[4] = ( (regs[4] << 1) | (regs[0] & 1) ) ;
regs[0] = ( rltemp >> 7 ) | sz53pTable[regs[4]];

tstates += ( 1);
tstates += ( 3);
while (display.nextEventTime != null && display.nextEventTime < tstates) display.doEvent();
memory.write(addr, regs[4]);;
	break;case 20:
	
	var addr = (regPairs[8] + offset) & 0xffff;
regs[7] = (tstates += ( 3), memory.read(addr));

var rltemp = regs[7];
regs[7] = ( (regs[7] << 1) | (regs[0] & 1) ) ;
regs[0] = ( rltemp >> 7 ) | sz53pTable[regs[7]];

tstates += ( 1);
tstates += ( 3);
while (display.nextEventTime != null && display.nextEventTime < tstates) display.doEvent();
memory.write(addr, regs[7]);;
	break;case 21:
	
	var addr = (regPairs[8] + offset) & 0xffff;
regs[6] = (tstates += ( 3), memory.read(addr));

var rltemp = regs[6];
regs[6] = ( (regs[6] << 1) | (regs[0] & 1) ) ;
regs[0] = ( rltemp >> 7 ) | sz53pTable[regs[6]];

tstates += ( 1);
tstates += ( 3);
while (display.nextEventTime != null && display.nextEventTime < tstates) display.doEvent();
memory.write(addr, regs[6]);;
	break;case 22:
	
	var addr = (regPairs[8] + offset) & 0xffff;
var val = (tstates += ( 3), memory.read(addr));
var rltemp = val;
val = ( (val << 1) | (regs[0] & 1) ) & 0xff;
regs[0] = ( rltemp >> 7 ) | sz53pTable[val];
tstates += ( 1);
tstates += ( 3);
while (display.nextEventTime != null && display.nextEventTime < tstates) display.doEvent();
memory.write(addr, val);;
	break;case 23:
	
	var addr = (regPairs[8] + offset) & 0xffff;
regs[1] = (tstates += ( 3), memory.read(addr));

var rltemp = regs[1];
regs[1] = ( (regs[1] << 1) | (regs[0] & 1) ) ;
regs[0] = ( rltemp >> 7 ) | sz53pTable[regs[1]];

tstates += ( 1);
tstates += ( 3);
while (display.nextEventTime != null && display.nextEventTime < tstates) display.doEvent();
memory.write(addr, regs[1]);;
	break;case 24:
	
	var addr = (regPairs[8] + offset) & 0xffff;
regs[3] = (tstates += ( 3), memory.read(addr));

var rrtemp = regs[3];
regs[3] = ( (regs[3] >> 1) | ( regs[0] << 7 ) ) ;
regs[0] = (rrtemp & 1) | sz53pTable[regs[3]];

tstates += ( 1);
tstates += ( 3);
while (display.nextEventTime != null && display.nextEventTime < tstates) display.doEvent();
memory.write(addr, regs[3]);;
	break;case 25:
	
	var addr = (regPairs[8] + offset) & 0xffff;
regs[2] = (tstates += ( 3), memory.read(addr));

var rrtemp = regs[2];
regs[2] = ( (regs[2] >> 1) | ( regs[0] << 7 ) ) ;
regs[0] = (rrtemp & 1) | sz53pTable[regs[2]];

tstates += ( 1);
tstates += ( 3);
while (display.nextEventTime != null && display.nextEventTime < tstates) display.doEvent();
memory.write(addr, regs[2]);;
	break;case 26:
	
	var addr = (regPairs[8] + offset) & 0xffff;
regs[5] = (tstates += ( 3), memory.read(addr));

var rrtemp = regs[5];
regs[5] = ( (regs[5] >> 1) | ( regs[0] << 7 ) ) ;
regs[0] = (rrtemp & 1) | sz53pTable[regs[5]];

tstates += ( 1);
tstates += ( 3);
while (display.nextEventTime != null && display.nextEventTime < tstates) display.doEvent();
memory.write(addr, regs[5]);;
	break;case 27:
	
	var addr = (regPairs[8] + offset) & 0xffff;
regs[4] = (tstates += ( 3), memory.read(addr));

var rrtemp = regs[4];
regs[4] = ( (regs[4] >> 1) | ( regs[0] << 7 ) ) ;
regs[0] = (rrtemp & 1) | sz53pTable[regs[4]];

tstates += ( 1);
tstates += ( 3);
while (display.nextEventTime != null && display.nextEventTime < tstates) display.doEvent();
memory.write(addr, regs[4]);;
	break;case 28:
	
	var addr = (regPairs[8] + offset) & 0xffff;
regs[7] = (tstates += ( 3), memory.read(addr));

var rrtemp = regs[7];
regs[7] = ( (regs[7] >> 1) | ( regs[0] << 7 ) ) ;
regs[0] = (rrtemp & 1) | sz53pTable[regs[7]];

tstates += ( 1);
tstates += ( 3);
while (display.nextEventTime != null && display.nextEventTime < tstates) display.doEvent();
memory.write(addr, regs[7]);;
	break;case 29:
	
	var addr = (regPairs[8] + offset) & 0xffff;
regs[6] = (tstates += ( 3), memory.read(addr));

var rrtemp = regs[6];
regs[6] = ( (regs[6] >> 1) | ( regs[0] << 7 ) ) ;
regs[0] = (rrtemp & 1) | sz53pTable[regs[6]];

tstates += ( 1);
tstates += ( 3);
while (display.nextEventTime != null && display.nextEventTime < tstates) display.doEvent();
memory.write(addr, regs[6]);;
	break;case 30:
	
	var addr = (regPairs[8] + offset) & 0xffff;
var val = (tstates += ( 3), memory.read(addr));
var rrtemp = val;
val = ( (val >> 1) | ( regs[0] << 7 ) ) & 0xff;
regs[0] = (rrtemp & 1) | sz53pTable[val];
tstates += ( 1);
tstates += ( 3);
while (display.nextEventTime != null && display.nextEventTime < tstates) display.doEvent();
memory.write(addr, val);;
	break;case 31:
	
	var addr = (regPairs[8] + offset) & 0xffff;
regs[1] = (tstates += ( 3), memory.read(addr));

var rrtemp = regs[1];
regs[1] = ( (regs[1] >> 1) | ( regs[0] << 7 ) ) ;
regs[0] = (rrtemp & 1) | sz53pTable[regs[1]];

tstates += ( 1);
tstates += ( 3);
while (display.nextEventTime != null && display.nextEventTime < tstates) display.doEvent();
memory.write(addr, regs[1]);;
	break;case 32:
	
	var addr = (regPairs[8] + offset) & 0xffff;
regs[3] = (tstates += ( 3), memory.read(addr));

regs[0] = regs[3] >> 7;
regs[3] = (regs[3] << 1) ;
regs[0] |= sz53pTable[regs[3]];

tstates += ( 1);
tstates += ( 3);
while (display.nextEventTime != null && display.nextEventTime < tstates) display.doEvent();
memory.write(addr, regs[3]);;
	break;case 33:
	
	var addr = (regPairs[8] + offset) & 0xffff;
regs[2] = (tstates += ( 3), memory.read(addr));

regs[0] = regs[2] >> 7;
regs[2] = (regs[2] << 1) ;
regs[0] |= sz53pTable[regs[2]];

tstates += ( 1);
tstates += ( 3);
while (display.nextEventTime != null && display.nextEventTime < tstates) display.doEvent();
memory.write(addr, regs[2]);;
	break;case 34:
	
	var addr = (regPairs[8] + offset) & 0xffff;
regs[5] = (tstates += ( 3), memory.read(addr));

regs[0] = regs[5] >> 7;
regs[5] = (regs[5] << 1) ;
regs[0] |= sz53pTable[regs[5]];

tstates += ( 1);
tstates += ( 3);
while (display.nextEventTime != null && display.nextEventTime < tstates) display.doEvent();
memory.write(addr, regs[5]);;
	break;case 35:
	
	var addr = (regPairs[8] + offset) & 0xffff;
regs[4] = (tstates += ( 3), memory.read(addr));

regs[0] = regs[4] >> 7;
regs[4] = (regs[4] << 1) ;
regs[0] |= sz53pTable[regs[4]];

tstates += ( 1);
tstates += ( 3);
while (display.nextEventTime != null && display.nextEventTime < tstates) display.doEvent();
memory.write(addr, regs[4]);;
	break;case 36:
	
	var addr = (regPairs[8] + offset) & 0xffff;
regs[7] = (tstates += ( 3), memory.read(addr));

regs[0] = regs[7] >> 7;
regs[7] = (regs[7] << 1) ;
regs[0] |= sz53pTable[regs[7]];

tstates += ( 1);
tstates += ( 3);
while (display.nextEventTime != null && display.nextEventTime < tstates) display.doEvent();
memory.write(addr, regs[7]);;
	break;case 37:
	
	var addr = (regPairs[8] + offset) & 0xffff;
regs[6] = (tstates += ( 3), memory.read(addr));

regs[0] = regs[6] >> 7;
regs[6] = (regs[6] << 1) ;
regs[0] |= sz53pTable[regs[6]];

tstates += ( 1);
tstates += ( 3);
while (display.nextEventTime != null && display.nextEventTime < tstates) display.doEvent();
memory.write(addr, regs[6]);;
	break;case 38:
	
	var addr = (regPairs[8] + offset) & 0xffff;
var val = (tstates += ( 3), memory.read(addr));
regs[0] = val >> 7;
val = (val << 1) & 0xff;
regs[0] |= sz53pTable[val];
tstates += ( 1);
tstates += ( 3);
while (display.nextEventTime != null && display.nextEventTime < tstates) display.doEvent();
memory.write(addr, val);;
	break;case 39:
	
	var addr = (regPairs[8] + offset) & 0xffff;
regs[1] = (tstates += ( 3), memory.read(addr));

regs[0] = regs[1] >> 7;
regs[1] = (regs[1] << 1) ;
regs[0] |= sz53pTable[regs[1]];

tstates += ( 1);
tstates += ( 3);
while (display.nextEventTime != null && display.nextEventTime < tstates) display.doEvent();
memory.write(addr, regs[1]);;
	break;case 40:
	
	var addr = (regPairs[8] + offset) & 0xffff;
regs[3] = (tstates += ( 3), memory.read(addr));

regs[0] = regs[3] & 1;
regs[3] = ( (regs[3] & 0x80) | (regs[3] >> 1) ) ;
regs[0] |= sz53pTable[regs[3]];

tstates += ( 1);
tstates += ( 3);
while (display.nextEventTime != null && display.nextEventTime < tstates) display.doEvent();
memory.write(addr, regs[3]);;
	break;case 41:
	
	var addr = (regPairs[8] + offset) & 0xffff;
regs[2] = (tstates += ( 3), memory.read(addr));

regs[0] = regs[2] & 1;
regs[2] = ( (regs[2] & 0x80) | (regs[2] >> 1) ) ;
regs[0] |= sz53pTable[regs[2]];

tstates += ( 1);
tstates += ( 3);
while (display.nextEventTime != null && display.nextEventTime < tstates) display.doEvent();
memory.write(addr, regs[2]);;
	break;case 42:
	
	var addr = (regPairs[8] + offset) & 0xffff;
regs[5] = (tstates += ( 3), memory.read(addr));

regs[0] = regs[5] & 1;
regs[5] = ( (regs[5] & 0x80) | (regs[5] >> 1) ) ;
regs[0] |= sz53pTable[regs[5]];

tstates += ( 1);
tstates += ( 3);
while (display.nextEventTime != null && display.nextEventTime < tstates) display.doEvent();
memory.write(addr, regs[5]);;
	break;case 43:
	
	var addr = (regPairs[8] + offset) & 0xffff;
regs[4] = (tstates += ( 3), memory.read(addr));

regs[0] = regs[4] & 1;
regs[4] = ( (regs[4] & 0x80) | (regs[4] >> 1) ) ;
regs[0] |= sz53pTable[regs[4]];

tstates += ( 1);
tstates += ( 3);
while (display.nextEventTime != null && display.nextEventTime < tstates) display.doEvent();
memory.write(addr, regs[4]);;
	break;case 44:
	
	var addr = (regPairs[8] + offset) & 0xffff;
regs[7] = (tstates += ( 3), memory.read(addr));

regs[0] = regs[7] & 1;
regs[7] = ( (regs[7] & 0x80) | (regs[7] >> 1) ) ;
regs[0] |= sz53pTable[regs[7]];

tstates += ( 1);
tstates += ( 3);
while (display.nextEventTime != null && display.nextEventTime < tstates) display.doEvent();
memory.write(addr, regs[7]);;
	break;case 45:
	
	var addr = (regPairs[8] + offset) & 0xffff;
regs[6] = (tstates += ( 3), memory.read(addr));

regs[0] = regs[6] & 1;
regs[6] = ( (regs[6] & 0x80) | (regs[6] >> 1) ) ;
regs[0] |= sz53pTable[regs[6]];

tstates += ( 1);
tstates += ( 3);
while (display.nextEventTime != null && display.nextEventTime < tstates) display.doEvent();
memory.write(addr, regs[6]);;
	break;case 46:
	
	var addr = (regPairs[8] + offset) & 0xffff;
var val = (tstates += ( 3), memory.read(addr));
regs[0] = val & 1;
val = ( (val & 0x80) | (val >> 1) ) & 0xff;
regs[0] |= sz53pTable[val];
tstates += ( 1);
tstates += ( 3);
while (display.nextEventTime != null && display.nextEventTime < tstates) display.doEvent();
memory.write(addr, val);;
	break;case 47:
	
	var addr = (regPairs[8] + offset) & 0xffff;
regs[1] = (tstates += ( 3), memory.read(addr));

regs[0] = regs[1] & 1;
regs[1] = ( (regs[1] & 0x80) | (regs[1] >> 1) ) ;
regs[0] |= sz53pTable[regs[1]];

tstates += ( 1);
tstates += ( 3);
while (display.nextEventTime != null && display.nextEventTime < tstates) display.doEvent();
memory.write(addr, regs[1]);;
	break;case 48:
	
	var addr = (regPairs[8] + offset) & 0xffff;
regs[3] = (tstates += ( 3), memory.read(addr));

regs[0] =  regs[3] >> 7;
regs[3] = (((regs[3]) << 1) ) | 0x01;
regs[0] |= sz53pTable[regs[3]];

tstates += ( 1);
tstates += ( 3);
while (display.nextEventTime != null && display.nextEventTime < tstates) display.doEvent();
memory.write(addr, regs[3]);;
	break;case 49:
	
	var addr = (regPairs[8] + offset) & 0xffff;
regs[2] = (tstates += ( 3), memory.read(addr));

regs[0] =  regs[2] >> 7;
regs[2] = (((regs[2]) << 1) ) | 0x01;
regs[0] |= sz53pTable[regs[2]];

tstates += ( 1);
tstates += ( 3);
while (display.nextEventTime != null && display.nextEventTime < tstates) display.doEvent();
memory.write(addr, regs[2]);;
	break;case 50:
	
	var addr = (regPairs[8] + offset) & 0xffff;
regs[5] = (tstates += ( 3), memory.read(addr));

regs[0] =  regs[5] >> 7;
regs[5] = (((regs[5]) << 1) ) | 0x01;
regs[0] |= sz53pTable[regs[5]];

tstates += ( 1);
tstates += ( 3);
while (display.nextEventTime != null && display.nextEventTime < tstates) display.doEvent();
memory.write(addr, regs[5]);;
	break;case 51:
	
	var addr = (regPairs[8] + offset) & 0xffff;
regs[4] = (tstates += ( 3), memory.read(addr));

regs[0] =  regs[4] >> 7;
regs[4] = (((regs[4]) << 1) ) | 0x01;
regs[0] |= sz53pTable[regs[4]];

tstates += ( 1);
tstates += ( 3);
while (display.nextEventTime != null && display.nextEventTime < tstates) display.doEvent();
memory.write(addr, regs[4]);;
	break;case 52:
	
	var addr = (regPairs[8] + offset) & 0xffff;
regs[7] = (tstates += ( 3), memory.read(addr));

regs[0] =  regs[7] >> 7;
regs[7] = (((regs[7]) << 1) ) | 0x01;
regs[0] |= sz53pTable[regs[7]];

tstates += ( 1);
tstates += ( 3);
while (display.nextEventTime != null && display.nextEventTime < tstates) display.doEvent();
memory.write(addr, regs[7]);;
	break;case 53:
	
	var addr = (regPairs[8] + offset) & 0xffff;
regs[6] = (tstates += ( 3), memory.read(addr));

regs[0] =  regs[6] >> 7;
regs[6] = (((regs[6]) << 1) ) | 0x01;
regs[0] |= sz53pTable[regs[6]];

tstates += ( 1);
tstates += ( 3);
while (display.nextEventTime != null && display.nextEventTime < tstates) display.doEvent();
memory.write(addr, regs[6]);;
	break;case 54:
	
	var addr = (regPairs[8] + offset) & 0xffff;
var val = (tstates += ( 3), memory.read(addr));
regs[0] =  val >> 7;
val = (((val) << 1) & 0xff) | 0x01;
regs[0] |= sz53pTable[val];
tstates += ( 1);
tstates += ( 3);
while (display.nextEventTime != null && display.nextEventTime < tstates) display.doEvent();
memory.write(addr, val);;
	break;case 55:
	
	var addr = (regPairs[8] + offset) & 0xffff;
regs[1] = (tstates += ( 3), memory.read(addr));

regs[0] =  regs[1] >> 7;
regs[1] = (((regs[1]) << 1) ) | 0x01;
regs[0] |= sz53pTable[regs[1]];

tstates += ( 1);
tstates += ( 3);
while (display.nextEventTime != null && display.nextEventTime < tstates) display.doEvent();
memory.write(addr, regs[1]);;
	break;case 56:
	
	var addr = (regPairs[8] + offset) & 0xffff;
regs[3] = (tstates += ( 3), memory.read(addr));

regs[0] =  regs[3] & 1;
regs[3] >>= 1;
regs[0] |= sz53pTable[regs[3]];

tstates += ( 1);
tstates += ( 3);
while (display.nextEventTime != null && display.nextEventTime < tstates) display.doEvent();
memory.write(addr, regs[3]);;
	break;case 57:
	
	var addr = (regPairs[8] + offset) & 0xffff;
regs[2] = (tstates += ( 3), memory.read(addr));

regs[0] =  regs[2] & 1;
regs[2] >>= 1;
regs[0] |= sz53pTable[regs[2]];

tstates += ( 1);
tstates += ( 3);
while (display.nextEventTime != null && display.nextEventTime < tstates) display.doEvent();
memory.write(addr, regs[2]);;
	break;case 58:
	
	var addr = (regPairs[8] + offset) & 0xffff;
regs[5] = (tstates += ( 3), memory.read(addr));

regs[0] =  regs[5] & 1;
regs[5] >>= 1;
regs[0] |= sz53pTable[regs[5]];

tstates += ( 1);
tstates += ( 3);
while (display.nextEventTime != null && display.nextEventTime < tstates) display.doEvent();
memory.write(addr, regs[5]);;
	break;case 59:
	
	var addr = (regPairs[8] + offset) & 0xffff;
regs[4] = (tstates += ( 3), memory.read(addr));

regs[0] =  regs[4] & 1;
regs[4] >>= 1;
regs[0] |= sz53pTable[regs[4]];

tstates += ( 1);
tstates += ( 3);
while (display.nextEventTime != null && display.nextEventTime < tstates) display.doEvent();
memory.write(addr, regs[4]);;
	break;case 60:
	
	var addr = (regPairs[8] + offset) & 0xffff;
regs[7] = (tstates += ( 3), memory.read(addr));

regs[0] =  regs[7] & 1;
regs[7] >>= 1;
regs[0] |= sz53pTable[regs[7]];

tstates += ( 1);
tstates += ( 3);
while (display.nextEventTime != null && display.nextEventTime < tstates) display.doEvent();
memory.write(addr, regs[7]);;
	break;case 61:
	
	var addr = (regPairs[8] + offset) & 0xffff;
regs[6] = (tstates += ( 3), memory.read(addr));

regs[0] =  regs[6] & 1;
regs[6] >>= 1;
regs[0] |= sz53pTable[regs[6]];

tstates += ( 1);
tstates += ( 3);
while (display.nextEventTime != null && display.nextEventTime < tstates) display.doEvent();
memory.write(addr, regs[6]);;
	break;case 62:
	
	var addr = (regPairs[8] + offset) & 0xffff;
var val = (tstates += ( 3), memory.read(addr));
regs[0] =  val & 1;
val >>= 1;
regs[0] |= sz53pTable[val];
tstates += ( 1);
tstates += ( 3);
while (display.nextEventTime != null && display.nextEventTime < tstates) display.doEvent();
memory.write(addr, val);;
	break;case 63:
	
	var addr = (regPairs[8] + offset) & 0xffff;
regs[1] = (tstates += ( 3), memory.read(addr));

regs[0] =  regs[1] & 1;
regs[1] >>= 1;
regs[0] |= sz53pTable[regs[1]];

tstates += ( 1);
tstates += ( 3);
while (display.nextEventTime != null && display.nextEventTime < tstates) display.doEvent();
memory.write(addr, regs[1]);;
	break;case 64:
	
	var addr = (regPairs[8] + offset) & 0xffff;
var value = (tstates += ( 3), memory.read(addr));
regs[0] = ( regs[0] & 1 ) | 16 | ( ( addr >> 8 ) & 40 );
if ( !(value & 1) ) regs[0] |= 68;

tstates += ( 1);
	break;case 65:
	
	var addr = (regPairs[8] + offset) & 0xffff;
var value = (tstates += ( 3), memory.read(addr));
regs[0] = ( regs[0] & 1 ) | 16 | ( ( addr >> 8 ) & 40 );
if ( !(value & 1) ) regs[0] |= 68;

tstates += ( 1);
	break;case 66:
	
	var addr = (regPairs[8] + offset) & 0xffff;
var value = (tstates += ( 3), memory.read(addr));
regs[0] = ( regs[0] & 1 ) | 16 | ( ( addr >> 8 ) & 40 );
if ( !(value & 1) ) regs[0] |= 68;

tstates += ( 1);
	break;case 67:
	
	var addr = (regPairs[8] + offset) & 0xffff;
var value = (tstates += ( 3), memory.read(addr));
regs[0] = ( regs[0] & 1 ) | 16 | ( ( addr >> 8 ) & 40 );
if ( !(value & 1) ) regs[0] |= 68;

tstates += ( 1);
	break;case 68:
	
	var addr = (regPairs[8] + offset) & 0xffff;
var value = (tstates += ( 3), memory.read(addr));
regs[0] = ( regs[0] & 1 ) | 16 | ( ( addr >> 8 ) & 40 );
if ( !(value & 1) ) regs[0] |= 68;

tstates += ( 1);
	break;case 69:
	
	var addr = (regPairs[8] + offset) & 0xffff;
var value = (tstates += ( 3), memory.read(addr));
regs[0] = ( regs[0] & 1 ) | 16 | ( ( addr >> 8 ) & 40 );
if ( !(value & 1) ) regs[0] |= 68;

tstates += ( 1);
	break;case 70:
	
	var addr = (regPairs[8] + offset) & 0xffff;
var value = (tstates += ( 3), memory.read(addr));
regs[0] = ( regs[0] & 1 ) | 16 | ( ( addr >> 8 ) & 40 );
if ( !(value & 1) ) regs[0] |= 68;

tstates += ( 1);
	break;case 71:
	
	var addr = (regPairs[8] + offset) & 0xffff;
var value = (tstates += ( 3), memory.read(addr));
regs[0] = ( regs[0] & 1 ) | 16 | ( ( addr >> 8 ) & 40 );
if ( !(value & 1) ) regs[0] |= 68;

tstates += ( 1);
	break;case 72:
	
	var addr = (regPairs[8] + offset) & 0xffff;
var value = (tstates += ( 3), memory.read(addr));
regs[0] = ( regs[0] & 1 ) | 16 | ( ( addr >> 8 ) & 40 );
if ( !(value & 2) ) regs[0] |= 68;

tstates += ( 1);
	break;case 73:
	
	var addr = (regPairs[8] + offset) & 0xffff;
var value = (tstates += ( 3), memory.read(addr));
regs[0] = ( regs[0] & 1 ) | 16 | ( ( addr >> 8 ) & 40 );
if ( !(value & 2) ) regs[0] |= 68;

tstates += ( 1);
	break;case 74:
	
	var addr = (regPairs[8] + offset) & 0xffff;
var value = (tstates += ( 3), memory.read(addr));
regs[0] = ( regs[0] & 1 ) | 16 | ( ( addr >> 8 ) & 40 );
if ( !(value & 2) ) regs[0] |= 68;

tstates += ( 1);
	break;case 75:
	
	var addr = (regPairs[8] + offset) & 0xffff;
var value = (tstates += ( 3), memory.read(addr));
regs[0] = ( regs[0] & 1 ) | 16 | ( ( addr >> 8 ) & 40 );
if ( !(value & 2) ) regs[0] |= 68;

tstates += ( 1);
	break;case 76:
	
	var addr = (regPairs[8] + offset) & 0xffff;
var value = (tstates += ( 3), memory.read(addr));
regs[0] = ( regs[0] & 1 ) | 16 | ( ( addr >> 8 ) & 40 );
if ( !(value & 2) ) regs[0] |= 68;

tstates += ( 1);
	break;case 77:
	
	var addr = (regPairs[8] + offset) & 0xffff;
var value = (tstates += ( 3), memory.read(addr));
regs[0] = ( regs[0] & 1 ) | 16 | ( ( addr >> 8 ) & 40 );
if ( !(value & 2) ) regs[0] |= 68;

tstates += ( 1);
	break;case 78:
	
	var addr = (regPairs[8] + offset) & 0xffff;
var value = (tstates += ( 3), memory.read(addr));
regs[0] = ( regs[0] & 1 ) | 16 | ( ( addr >> 8 ) & 40 );
if ( !(value & 2) ) regs[0] |= 68;

tstates += ( 1);
	break;case 79:
	
	var addr = (regPairs[8] + offset) & 0xffff;
var value = (tstates += ( 3), memory.read(addr));
regs[0] = ( regs[0] & 1 ) | 16 | ( ( addr >> 8 ) & 40 );
if ( !(value & 2) ) regs[0] |= 68;

tstates += ( 1);
	break;case 80:
	
	var addr = (regPairs[8] + offset) & 0xffff;
var value = (tstates += ( 3), memory.read(addr));
regs[0] = ( regs[0] & 1 ) | 16 | ( ( addr >> 8 ) & 40 );
if ( !(value & 4) ) regs[0] |= 68;

tstates += ( 1);
	break;case 81:
	
	var addr = (regPairs[8] + offset) & 0xffff;
var value = (tstates += ( 3), memory.read(addr));
regs[0] = ( regs[0] & 1 ) | 16 | ( ( addr >> 8 ) & 40 );
if ( !(value & 4) ) regs[0] |= 68;

tstates += ( 1);
	break;case 82:
	
	var addr = (regPairs[8] + offset) & 0xffff;
var value = (tstates += ( 3), memory.read(addr));
regs[0] = ( regs[0] & 1 ) | 16 | ( ( addr >> 8 ) & 40 );
if ( !(value & 4) ) regs[0] |= 68;

tstates += ( 1);
	break;case 83:
	
	var addr = (regPairs[8] + offset) & 0xffff;
var value = (tstates += ( 3), memory.read(addr));
regs[0] = ( regs[0] & 1 ) | 16 | ( ( addr >> 8 ) & 40 );
if ( !(value & 4) ) regs[0] |= 68;

tstates += ( 1);
	break;case 84:
	
	var addr = (regPairs[8] + offset) & 0xffff;
var value = (tstates += ( 3), memory.read(addr));
regs[0] = ( regs[0] & 1 ) | 16 | ( ( addr >> 8 ) & 40 );
if ( !(value & 4) ) regs[0] |= 68;

tstates += ( 1);
	break;case 85:
	
	var addr = (regPairs[8] + offset) & 0xffff;
var value = (tstates += ( 3), memory.read(addr));
regs[0] = ( regs[0] & 1 ) | 16 | ( ( addr >> 8 ) & 40 );
if ( !(value & 4) ) regs[0] |= 68;

tstates += ( 1);
	break;case 86:
	
	var addr = (regPairs[8] + offset) & 0xffff;
var value = (tstates += ( 3), memory.read(addr));
regs[0] = ( regs[0] & 1 ) | 16 | ( ( addr >> 8 ) & 40 );
if ( !(value & 4) ) regs[0] |= 68;

tstates += ( 1);
	break;case 87:
	
	var addr = (regPairs[8] + offset) & 0xffff;
var value = (tstates += ( 3), memory.read(addr));
regs[0] = ( regs[0] & 1 ) | 16 | ( ( addr >> 8 ) & 40 );
if ( !(value & 4) ) regs[0] |= 68;

tstates += ( 1);
	break;case 88:
	
	var addr = (regPairs[8] + offset) & 0xffff;
var value = (tstates += ( 3), memory.read(addr));
regs[0] = ( regs[0] & 1 ) | 16 | ( ( addr >> 8 ) & 40 );
if ( !(value & 8) ) regs[0] |= 68;

tstates += ( 1);
	break;case 89:
	
	var addr = (regPairs[8] + offset) & 0xffff;
var value = (tstates += ( 3), memory.read(addr));
regs[0] = ( regs[0] & 1 ) | 16 | ( ( addr >> 8 ) & 40 );
if ( !(value & 8) ) regs[0] |= 68;

tstates += ( 1);
	break;case 90:
	
	var addr = (regPairs[8] + offset) & 0xffff;
var value = (tstates += ( 3), memory.read(addr));
regs[0] = ( regs[0] & 1 ) | 16 | ( ( addr >> 8 ) & 40 );
if ( !(value & 8) ) regs[0] |= 68;

tstates += ( 1);
	break;case 91:
	
	var addr = (regPairs[8] + offset) & 0xffff;
var value = (tstates += ( 3), memory.read(addr));
regs[0] = ( regs[0] & 1 ) | 16 | ( ( addr >> 8 ) & 40 );
if ( !(value & 8) ) regs[0] |= 68;

tstates += ( 1);
	break;case 92:
	
	var addr = (regPairs[8] + offset) & 0xffff;
var value = (tstates += ( 3), memory.read(addr));
regs[0] = ( regs[0] & 1 ) | 16 | ( ( addr >> 8 ) & 40 );
if ( !(value & 8) ) regs[0] |= 68;

tstates += ( 1);
	break;case 93:
	
	var addr = (regPairs[8] + offset) & 0xffff;
var value = (tstates += ( 3), memory.read(addr));
regs[0] = ( regs[0] & 1 ) | 16 | ( ( addr >> 8 ) & 40 );
if ( !(value & 8) ) regs[0] |= 68;

tstates += ( 1);
	break;case 94:
	
	var addr = (regPairs[8] + offset) & 0xffff;
var value = (tstates += ( 3), memory.read(addr));
regs[0] = ( regs[0] & 1 ) | 16 | ( ( addr >> 8 ) & 40 );
if ( !(value & 8) ) regs[0] |= 68;

tstates += ( 1);
	break;case 95:
	
	var addr = (regPairs[8] + offset) & 0xffff;
var value = (tstates += ( 3), memory.read(addr));
regs[0] = ( regs[0] & 1 ) | 16 | ( ( addr >> 8 ) & 40 );
if ( !(value & 8) ) regs[0] |= 68;

tstates += ( 1);
	break;case 96:
	
	var addr = (regPairs[8] + offset) & 0xffff;
var value = (tstates += ( 3), memory.read(addr));
regs[0] = ( regs[0] & 1 ) | 16 | ( ( addr >> 8 ) & 40 );
if ( !(value & 16) ) regs[0] |= 68;

tstates += ( 1);
	break;case 97:
	
	var addr = (regPairs[8] + offset) & 0xffff;
var value = (tstates += ( 3), memory.read(addr));
regs[0] = ( regs[0] & 1 ) | 16 | ( ( addr >> 8 ) & 40 );
if ( !(value & 16) ) regs[0] |= 68;

tstates += ( 1);
	break;case 98:
	
	var addr = (regPairs[8] + offset) & 0xffff;
var value = (tstates += ( 3), memory.read(addr));
regs[0] = ( regs[0] & 1 ) | 16 | ( ( addr >> 8 ) & 40 );
if ( !(value & 16) ) regs[0] |= 68;

tstates += ( 1);
	break;case 99:
	
	var addr = (regPairs[8] + offset) & 0xffff;
var value = (tstates += ( 3), memory.read(addr));
regs[0] = ( regs[0] & 1 ) | 16 | ( ( addr >> 8 ) & 40 );
if ( !(value & 16) ) regs[0] |= 68;

tstates += ( 1);
	break;case 100:
	
	var addr = (regPairs[8] + offset) & 0xffff;
var value = (tstates += ( 3), memory.read(addr));
regs[0] = ( regs[0] & 1 ) | 16 | ( ( addr >> 8 ) & 40 );
if ( !(value & 16) ) regs[0] |= 68;

tstates += ( 1);
	break;case 101:
	
	var addr = (regPairs[8] + offset) & 0xffff;
var value = (tstates += ( 3), memory.read(addr));
regs[0] = ( regs[0] & 1 ) | 16 | ( ( addr >> 8 ) & 40 );
if ( !(value & 16) ) regs[0] |= 68;

tstates += ( 1);
	break;case 102:
	
	var addr = (regPairs[8] + offset) & 0xffff;
var value = (tstates += ( 3), memory.read(addr));
regs[0] = ( regs[0] & 1 ) | 16 | ( ( addr >> 8 ) & 40 );
if ( !(value & 16) ) regs[0] |= 68;

tstates += ( 1);
	break;case 103:
	
	var addr = (regPairs[8] + offset) & 0xffff;
var value = (tstates += ( 3), memory.read(addr));
regs[0] = ( regs[0] & 1 ) | 16 | ( ( addr >> 8 ) & 40 );
if ( !(value & 16) ) regs[0] |= 68;

tstates += ( 1);
	break;case 104:
	
	var addr = (regPairs[8] + offset) & 0xffff;
var value = (tstates += ( 3), memory.read(addr));
regs[0] = ( regs[0] & 1 ) | 16 | ( ( addr >> 8 ) & 40 );
if ( !(value & 32) ) regs[0] |= 68;

tstates += ( 1);
	break;case 105:
	
	var addr = (regPairs[8] + offset) & 0xffff;
var value = (tstates += ( 3), memory.read(addr));
regs[0] = ( regs[0] & 1 ) | 16 | ( ( addr >> 8 ) & 40 );
if ( !(value & 32) ) regs[0] |= 68;

tstates += ( 1);
	break;case 106:
	
	var addr = (regPairs[8] + offset) & 0xffff;
var value = (tstates += ( 3), memory.read(addr));
regs[0] = ( regs[0] & 1 ) | 16 | ( ( addr >> 8 ) & 40 );
if ( !(value & 32) ) regs[0] |= 68;

tstates += ( 1);
	break;case 107:
	
	var addr = (regPairs[8] + offset) & 0xffff;
var value = (tstates += ( 3), memory.read(addr));
regs[0] = ( regs[0] & 1 ) | 16 | ( ( addr >> 8 ) & 40 );
if ( !(value & 32) ) regs[0] |= 68;

tstates += ( 1);
	break;case 108:
	
	var addr = (regPairs[8] + offset) & 0xffff;
var value = (tstates += ( 3), memory.read(addr));
regs[0] = ( regs[0] & 1 ) | 16 | ( ( addr >> 8 ) & 40 );
if ( !(value & 32) ) regs[0] |= 68;

tstates += ( 1);
	break;case 109:
	
	var addr = (regPairs[8] + offset) & 0xffff;
var value = (tstates += ( 3), memory.read(addr));
regs[0] = ( regs[0] & 1 ) | 16 | ( ( addr >> 8 ) & 40 );
if ( !(value & 32) ) regs[0] |= 68;

tstates += ( 1);
	break;case 110:
	
	var addr = (regPairs[8] + offset) & 0xffff;
var value = (tstates += ( 3), memory.read(addr));
regs[0] = ( regs[0] & 1 ) | 16 | ( ( addr >> 8 ) & 40 );
if ( !(value & 32) ) regs[0] |= 68;

tstates += ( 1);
	break;case 111:
	
	var addr = (regPairs[8] + offset) & 0xffff;
var value = (tstates += ( 3), memory.read(addr));
regs[0] = ( regs[0] & 1 ) | 16 | ( ( addr >> 8 ) & 40 );
if ( !(value & 32) ) regs[0] |= 68;

tstates += ( 1);
	break;case 112:
	
	var addr = (regPairs[8] + offset) & 0xffff;
var value = (tstates += ( 3), memory.read(addr));
regs[0] = ( regs[0] & 1 ) | 16 | ( ( addr >> 8 ) & 40 );
if ( !(value & 64) ) regs[0] |= 68;

tstates += ( 1);
	break;case 113:
	
	var addr = (regPairs[8] + offset) & 0xffff;
var value = (tstates += ( 3), memory.read(addr));
regs[0] = ( regs[0] & 1 ) | 16 | ( ( addr >> 8 ) & 40 );
if ( !(value & 64) ) regs[0] |= 68;

tstates += ( 1);
	break;case 114:
	
	var addr = (regPairs[8] + offset) & 0xffff;
var value = (tstates += ( 3), memory.read(addr));
regs[0] = ( regs[0] & 1 ) | 16 | ( ( addr >> 8 ) & 40 );
if ( !(value & 64) ) regs[0] |= 68;

tstates += ( 1);
	break;case 115:
	
	var addr = (regPairs[8] + offset) & 0xffff;
var value = (tstates += ( 3), memory.read(addr));
regs[0] = ( regs[0] & 1 ) | 16 | ( ( addr >> 8 ) & 40 );
if ( !(value & 64) ) regs[0] |= 68;

tstates += ( 1);
	break;case 116:
	
	var addr = (regPairs[8] + offset) & 0xffff;
var value = (tstates += ( 3), memory.read(addr));
regs[0] = ( regs[0] & 1 ) | 16 | ( ( addr >> 8 ) & 40 );
if ( !(value & 64) ) regs[0] |= 68;

tstates += ( 1);
	break;case 117:
	
	var addr = (regPairs[8] + offset) & 0xffff;
var value = (tstates += ( 3), memory.read(addr));
regs[0] = ( regs[0] & 1 ) | 16 | ( ( addr >> 8 ) & 40 );
if ( !(value & 64) ) regs[0] |= 68;

tstates += ( 1);
	break;case 118:
	
	var addr = (regPairs[8] + offset) & 0xffff;
var value = (tstates += ( 3), memory.read(addr));
regs[0] = ( regs[0] & 1 ) | 16 | ( ( addr >> 8 ) & 40 );
if ( !(value & 64) ) regs[0] |= 68;

tstates += ( 1);
	break;case 119:
	
	var addr = (regPairs[8] + offset) & 0xffff;
var value = (tstates += ( 3), memory.read(addr));
regs[0] = ( regs[0] & 1 ) | 16 | ( ( addr >> 8 ) & 40 );
if ( !(value & 64) ) regs[0] |= 68;

tstates += ( 1);
	break;case 120:
	
	var addr = (regPairs[8] + offset) & 0xffff;
var value = (tstates += ( 3), memory.read(addr));
regs[0] = ( regs[0] & 1 ) | 16 | ( ( addr >> 8 ) & 40 );
if ( !(value & 128) ) regs[0] |= 68;
if (value & 0x80) regs[0] |= 128;
tstates += ( 1);
	break;case 121:
	
	var addr = (regPairs[8] + offset) & 0xffff;
var value = (tstates += ( 3), memory.read(addr));
regs[0] = ( regs[0] & 1 ) | 16 | ( ( addr >> 8 ) & 40 );
if ( !(value & 128) ) regs[0] |= 68;
if (value & 0x80) regs[0] |= 128;
tstates += ( 1);
	break;case 122:
	
	var addr = (regPairs[8] + offset) & 0xffff;
var value = (tstates += ( 3), memory.read(addr));
regs[0] = ( regs[0] & 1 ) | 16 | ( ( addr >> 8 ) & 40 );
if ( !(value & 128) ) regs[0] |= 68;
if (value & 0x80) regs[0] |= 128;
tstates += ( 1);
	break;case 123:
	
	var addr = (regPairs[8] + offset) & 0xffff;
var value = (tstates += ( 3), memory.read(addr));
regs[0] = ( regs[0] & 1 ) | 16 | ( ( addr >> 8 ) & 40 );
if ( !(value & 128) ) regs[0] |= 68;
if (value & 0x80) regs[0] |= 128;
tstates += ( 1);
	break;case 124:
	
	var addr = (regPairs[8] + offset) & 0xffff;
var value = (tstates += ( 3), memory.read(addr));
regs[0] = ( regs[0] & 1 ) | 16 | ( ( addr >> 8 ) & 40 );
if ( !(value & 128) ) regs[0] |= 68;
if (value & 0x80) regs[0] |= 128;
tstates += ( 1);
	break;case 125:
	
	var addr = (regPairs[8] + offset) & 0xffff;
var value = (tstates += ( 3), memory.read(addr));
regs[0] = ( regs[0] & 1 ) | 16 | ( ( addr >> 8 ) & 40 );
if ( !(value & 128) ) regs[0] |= 68;
if (value & 0x80) regs[0] |= 128;
tstates += ( 1);
	break;case 126:
	
	var addr = (regPairs[8] + offset) & 0xffff;
var value = (tstates += ( 3), memory.read(addr));
regs[0] = ( regs[0] & 1 ) | 16 | ( ( addr >> 8 ) & 40 );
if ( !(value & 128) ) regs[0] |= 68;
if (value & 0x80) regs[0] |= 128;
tstates += ( 1);
	break;case 127:
	
	var addr = (regPairs[8] + offset) & 0xffff;
var value = (tstates += ( 3), memory.read(addr));
regs[0] = ( regs[0] & 1 ) | 16 | ( ( addr >> 8 ) & 40 );
if ( !(value & 128) ) regs[0] |= 68;
if (value & 0x80) regs[0] |= 128;
tstates += ( 1);
	break;case 128:
	
	var addr = (regPairs[8] + offset) & 0xffff;
regs[3] = (tstates += ( 3), memory.read(addr));

regs[3] &= 254;

tstates += ( 1);
tstates += ( 3);
while (display.nextEventTime != null && display.nextEventTime < tstates) display.doEvent();
memory.write(addr, regs[3]);;
	break;case 129:
	
	var addr = (regPairs[8] + offset) & 0xffff;
regs[2] = (tstates += ( 3), memory.read(addr));

regs[2] &= 254;

tstates += ( 1);
tstates += ( 3);
while (display.nextEventTime != null && display.nextEventTime < tstates) display.doEvent();
memory.write(addr, regs[2]);;
	break;case 130:
	
	var addr = (regPairs[8] + offset) & 0xffff;
regs[5] = (tstates += ( 3), memory.read(addr));

regs[5] &= 254;

tstates += ( 1);
tstates += ( 3);
while (display.nextEventTime != null && display.nextEventTime < tstates) display.doEvent();
memory.write(addr, regs[5]);;
	break;case 131:
	
	var addr = (regPairs[8] + offset) & 0xffff;
regs[4] = (tstates += ( 3), memory.read(addr));

regs[4] &= 254;

tstates += ( 1);
tstates += ( 3);
while (display.nextEventTime != null && display.nextEventTime < tstates) display.doEvent();
memory.write(addr, regs[4]);;
	break;case 132:
	
	var addr = (regPairs[8] + offset) & 0xffff;
regs[7] = (tstates += ( 3), memory.read(addr));

regs[7] &= 254;

tstates += ( 1);
tstates += ( 3);
while (display.nextEventTime != null && display.nextEventTime < tstates) display.doEvent();
memory.write(addr, regs[7]);;
	break;case 133:
	
	var addr = (regPairs[8] + offset) & 0xffff;
regs[6] = (tstates += ( 3), memory.read(addr));

regs[6] &= 254;

tstates += ( 1);
tstates += ( 3);
while (display.nextEventTime != null && display.nextEventTime < tstates) display.doEvent();
memory.write(addr, regs[6]);;
	break;case 134:
	
	var addr = (regPairs[8] + offset) & 0xffff;
var val = (tstates += ( 3), memory.read(addr));
val &= 254;
tstates += ( 1);
tstates += ( 3);
while (display.nextEventTime != null && display.nextEventTime < tstates) display.doEvent();
memory.write(addr, val);;
	break;case 135:
	
	var addr = (regPairs[8] + offset) & 0xffff;
regs[1] = (tstates += ( 3), memory.read(addr));

regs[1] &= 254;

tstates += ( 1);
tstates += ( 3);
while (display.nextEventTime != null && display.nextEventTime < tstates) display.doEvent();
memory.write(addr, regs[1]);;
	break;case 136:
	
	var addr = (regPairs[8] + offset) & 0xffff;
regs[3] = (tstates += ( 3), memory.read(addr));

regs[3] &= 253;

tstates += ( 1);
tstates += ( 3);
while (display.nextEventTime != null && display.nextEventTime < tstates) display.doEvent();
memory.write(addr, regs[3]);;
	break;case 137:
	
	var addr = (regPairs[8] + offset) & 0xffff;
regs[2] = (tstates += ( 3), memory.read(addr));

regs[2] &= 253;

tstates += ( 1);
tstates += ( 3);
while (display.nextEventTime != null && display.nextEventTime < tstates) display.doEvent();
memory.write(addr, regs[2]);;
	break;case 138:
	
	var addr = (regPairs[8] + offset) & 0xffff;
regs[5] = (tstates += ( 3), memory.read(addr));

regs[5] &= 253;

tstates += ( 1);
tstates += ( 3);
while (display.nextEventTime != null && display.nextEventTime < tstates) display.doEvent();
memory.write(addr, regs[5]);;
	break;case 139:
	
	var addr = (regPairs[8] + offset) & 0xffff;
regs[4] = (tstates += ( 3), memory.read(addr));

regs[4] &= 253;

tstates += ( 1);
tstates += ( 3);
while (display.nextEventTime != null && display.nextEventTime < tstates) display.doEvent();
memory.write(addr, regs[4]);;
	break;case 140:
	
	var addr = (regPairs[8] + offset) & 0xffff;
regs[7] = (tstates += ( 3), memory.read(addr));

regs[7] &= 253;

tstates += ( 1);
tstates += ( 3);
while (display.nextEventTime != null && display.nextEventTime < tstates) display.doEvent();
memory.write(addr, regs[7]);;
	break;case 141:
	
	var addr = (regPairs[8] + offset) & 0xffff;
regs[6] = (tstates += ( 3), memory.read(addr));

regs[6] &= 253;

tstates += ( 1);
tstates += ( 3);
while (display.nextEventTime != null && display.nextEventTime < tstates) display.doEvent();
memory.write(addr, regs[6]);;
	break;case 142:
	
	var addr = (regPairs[8] + offset) & 0xffff;
var val = (tstates += ( 3), memory.read(addr));
val &= 253;
tstates += ( 1);
tstates += ( 3);
while (display.nextEventTime != null && display.nextEventTime < tstates) display.doEvent();
memory.write(addr, val);;
	break;case 143:
	
	var addr = (regPairs[8] + offset) & 0xffff;
regs[1] = (tstates += ( 3), memory.read(addr));

regs[1] &= 253;

tstates += ( 1);
tstates += ( 3);
while (display.nextEventTime != null && display.nextEventTime < tstates) display.doEvent();
memory.write(addr, regs[1]);;
	break;case 144:
	
	var addr = (regPairs[8] + offset) & 0xffff;
regs[3] = (tstates += ( 3), memory.read(addr));

regs[3] &= 251;

tstates += ( 1);
tstates += ( 3);
while (display.nextEventTime != null && display.nextEventTime < tstates) display.doEvent();
memory.write(addr, regs[3]);;
	break;case 145:
	
	var addr = (regPairs[8] + offset) & 0xffff;
regs[2] = (tstates += ( 3), memory.read(addr));

regs[2] &= 251;

tstates += ( 1);
tstates += ( 3);
while (display.nextEventTime != null && display.nextEventTime < tstates) display.doEvent();
memory.write(addr, regs[2]);;
	break;case 146:
	
	var addr = (regPairs[8] + offset) & 0xffff;
regs[5] = (tstates += ( 3), memory.read(addr));

regs[5] &= 251;

tstates += ( 1);
tstates += ( 3);
while (display.nextEventTime != null && display.nextEventTime < tstates) display.doEvent();
memory.write(addr, regs[5]);;
	break;case 147:
	
	var addr = (regPairs[8] + offset) & 0xffff;
regs[4] = (tstates += ( 3), memory.read(addr));

regs[4] &= 251;

tstates += ( 1);
tstates += ( 3);
while (display.nextEventTime != null && display.nextEventTime < tstates) display.doEvent();
memory.write(addr, regs[4]);;
	break;case 148:
	
	var addr = (regPairs[8] + offset) & 0xffff;
regs[7] = (tstates += ( 3), memory.read(addr));

regs[7] &= 251;

tstates += ( 1);
tstates += ( 3);
while (display.nextEventTime != null && display.nextEventTime < tstates) display.doEvent();
memory.write(addr, regs[7]);;
	break;case 149:
	
	var addr = (regPairs[8] + offset) & 0xffff;
regs[6] = (tstates += ( 3), memory.read(addr));

regs[6] &= 251;

tstates += ( 1);
tstates += ( 3);
while (display.nextEventTime != null && display.nextEventTime < tstates) display.doEvent();
memory.write(addr, regs[6]);;
	break;case 150:
	
	var addr = (regPairs[8] + offset) & 0xffff;
var val = (tstates += ( 3), memory.read(addr));
val &= 251;
tstates += ( 1);
tstates += ( 3);
while (display.nextEventTime != null && display.nextEventTime < tstates) display.doEvent();
memory.write(addr, val);;
	break;case 151:
	
	var addr = (regPairs[8] + offset) & 0xffff;
regs[1] = (tstates += ( 3), memory.read(addr));

regs[1] &= 251;

tstates += ( 1);
tstates += ( 3);
while (display.nextEventTime != null && display.nextEventTime < tstates) display.doEvent();
memory.write(addr, regs[1]);;
	break;case 152:
	
	var addr = (regPairs[8] + offset) & 0xffff;
regs[3] = (tstates += ( 3), memory.read(addr));

regs[3] &= 247;

tstates += ( 1);
tstates += ( 3);
while (display.nextEventTime != null && display.nextEventTime < tstates) display.doEvent();
memory.write(addr, regs[3]);;
	break;case 153:
	
	var addr = (regPairs[8] + offset) & 0xffff;
regs[2] = (tstates += ( 3), memory.read(addr));

regs[2] &= 247;

tstates += ( 1);
tstates += ( 3);
while (display.nextEventTime != null && display.nextEventTime < tstates) display.doEvent();
memory.write(addr, regs[2]);;
	break;case 154:
	
	var addr = (regPairs[8] + offset) & 0xffff;
regs[5] = (tstates += ( 3), memory.read(addr));

regs[5] &= 247;

tstates += ( 1);
tstates += ( 3);
while (display.nextEventTime != null && display.nextEventTime < tstates) display.doEvent();
memory.write(addr, regs[5]);;
	break;case 155:
	
	var addr = (regPairs[8] + offset) & 0xffff;
regs[4] = (tstates += ( 3), memory.read(addr));

regs[4] &= 247;

tstates += ( 1);
tstates += ( 3);
while (display.nextEventTime != null && display.nextEventTime < tstates) display.doEvent();
memory.write(addr, regs[4]);;
	break;case 156:
	
	var addr = (regPairs[8] + offset) & 0xffff;
regs[7] = (tstates += ( 3), memory.read(addr));

regs[7] &= 247;

tstates += ( 1);
tstates += ( 3);
while (display.nextEventTime != null && display.nextEventTime < tstates) display.doEvent();
memory.write(addr, regs[7]);;
	break;case 157:
	
	var addr = (regPairs[8] + offset) & 0xffff;
regs[6] = (tstates += ( 3), memory.read(addr));

regs[6] &= 247;

tstates += ( 1);
tstates += ( 3);
while (display.nextEventTime != null && display.nextEventTime < tstates) display.doEvent();
memory.write(addr, regs[6]);;
	break;case 158:
	
	var addr = (regPairs[8] + offset) & 0xffff;
var val = (tstates += ( 3), memory.read(addr));
val &= 247;
tstates += ( 1);
tstates += ( 3);
while (display.nextEventTime != null && display.nextEventTime < tstates) display.doEvent();
memory.write(addr, val);;
	break;case 159:
	
	var addr = (regPairs[8] + offset) & 0xffff;
regs[1] = (tstates += ( 3), memory.read(addr));

regs[1] &= 247;

tstates += ( 1);
tstates += ( 3);
while (display.nextEventTime != null && display.nextEventTime < tstates) display.doEvent();
memory.write(addr, regs[1]);;
	break;case 160:
	
	var addr = (regPairs[8] + offset) & 0xffff;
regs[3] = (tstates += ( 3), memory.read(addr));

regs[3] &= 239;

tstates += ( 1);
tstates += ( 3);
while (display.nextEventTime != null && display.nextEventTime < tstates) display.doEvent();
memory.write(addr, regs[3]);;
	break;case 161:
	
	var addr = (regPairs[8] + offset) & 0xffff;
regs[2] = (tstates += ( 3), memory.read(addr));

regs[2] &= 239;

tstates += ( 1);
tstates += ( 3);
while (display.nextEventTime != null && display.nextEventTime < tstates) display.doEvent();
memory.write(addr, regs[2]);;
	break;case 162:
	
	var addr = (regPairs[8] + offset) & 0xffff;
regs[5] = (tstates += ( 3), memory.read(addr));

regs[5] &= 239;

tstates += ( 1);
tstates += ( 3);
while (display.nextEventTime != null && display.nextEventTime < tstates) display.doEvent();
memory.write(addr, regs[5]);;
	break;case 163:
	
	var addr = (regPairs[8] + offset) & 0xffff;
regs[4] = (tstates += ( 3), memory.read(addr));

regs[4] &= 239;

tstates += ( 1);
tstates += ( 3);
while (display.nextEventTime != null && display.nextEventTime < tstates) display.doEvent();
memory.write(addr, regs[4]);;
	break;case 164:
	
	var addr = (regPairs[8] + offset) & 0xffff;
regs[7] = (tstates += ( 3), memory.read(addr));

regs[7] &= 239;

tstates += ( 1);
tstates += ( 3);
while (display.nextEventTime != null && display.nextEventTime < tstates) display.doEvent();
memory.write(addr, regs[7]);;
	break;case 165:
	
	var addr = (regPairs[8] + offset) & 0xffff;
regs[6] = (tstates += ( 3), memory.read(addr));

regs[6] &= 239;

tstates += ( 1);
tstates += ( 3);
while (display.nextEventTime != null && display.nextEventTime < tstates) display.doEvent();
memory.write(addr, regs[6]);;
	break;case 166:
	
	var addr = (regPairs[8] + offset) & 0xffff;
var val = (tstates += ( 3), memory.read(addr));
val &= 239;
tstates += ( 1);
tstates += ( 3);
while (display.nextEventTime != null && display.nextEventTime < tstates) display.doEvent();
memory.write(addr, val);;
	break;case 167:
	
	var addr = (regPairs[8] + offset) & 0xffff;
regs[1] = (tstates += ( 3), memory.read(addr));

regs[1] &= 239;

tstates += ( 1);
tstates += ( 3);
while (display.nextEventTime != null && display.nextEventTime < tstates) display.doEvent();
memory.write(addr, regs[1]);;
	break;case 168:
	
	var addr = (regPairs[8] + offset) & 0xffff;
regs[3] = (tstates += ( 3), memory.read(addr));

regs[3] &= 223;

tstates += ( 1);
tstates += ( 3);
while (display.nextEventTime != null && display.nextEventTime < tstates) display.doEvent();
memory.write(addr, regs[3]);;
	break;case 169:
	
	var addr = (regPairs[8] + offset) & 0xffff;
regs[2] = (tstates += ( 3), memory.read(addr));

regs[2] &= 223;

tstates += ( 1);
tstates += ( 3);
while (display.nextEventTime != null && display.nextEventTime < tstates) display.doEvent();
memory.write(addr, regs[2]);;
	break;case 170:
	
	var addr = (regPairs[8] + offset) & 0xffff;
regs[5] = (tstates += ( 3), memory.read(addr));

regs[5] &= 223;

tstates += ( 1);
tstates += ( 3);
while (display.nextEventTime != null && display.nextEventTime < tstates) display.doEvent();
memory.write(addr, regs[5]);;
	break;case 171:
	
	var addr = (regPairs[8] + offset) & 0xffff;
regs[4] = (tstates += ( 3), memory.read(addr));

regs[4] &= 223;

tstates += ( 1);
tstates += ( 3);
while (display.nextEventTime != null && display.nextEventTime < tstates) display.doEvent();
memory.write(addr, regs[4]);;
	break;case 172:
	
	var addr = (regPairs[8] + offset) & 0xffff;
regs[7] = (tstates += ( 3), memory.read(addr));

regs[7] &= 223;

tstates += ( 1);
tstates += ( 3);
while (display.nextEventTime != null && display.nextEventTime < tstates) display.doEvent();
memory.write(addr, regs[7]);;
	break;case 173:
	
	var addr = (regPairs[8] + offset) & 0xffff;
regs[6] = (tstates += ( 3), memory.read(addr));

regs[6] &= 223;

tstates += ( 1);
tstates += ( 3);
while (display.nextEventTime != null && display.nextEventTime < tstates) display.doEvent();
memory.write(addr, regs[6]);;
	break;case 174:
	
	var addr = (regPairs[8] + offset) & 0xffff;
var val = (tstates += ( 3), memory.read(addr));
val &= 223;
tstates += ( 1);
tstates += ( 3);
while (display.nextEventTime != null && display.nextEventTime < tstates) display.doEvent();
memory.write(addr, val);;
	break;case 175:
	
	var addr = (regPairs[8] + offset) & 0xffff;
regs[1] = (tstates += ( 3), memory.read(addr));

regs[1] &= 223;

tstates += ( 1);
tstates += ( 3);
while (display.nextEventTime != null && display.nextEventTime < tstates) display.doEvent();
memory.write(addr, regs[1]);;
	break;case 176:
	
	var addr = (regPairs[8] + offset) & 0xffff;
regs[3] = (tstates += ( 3), memory.read(addr));

regs[3] &= 191;

tstates += ( 1);
tstates += ( 3);
while (display.nextEventTime != null && display.nextEventTime < tstates) display.doEvent();
memory.write(addr, regs[3]);;
	break;case 177:
	
	var addr = (regPairs[8] + offset) & 0xffff;
regs[2] = (tstates += ( 3), memory.read(addr));

regs[2] &= 191;

tstates += ( 1);
tstates += ( 3);
while (display.nextEventTime != null && display.nextEventTime < tstates) display.doEvent();
memory.write(addr, regs[2]);;
	break;case 178:
	
	var addr = (regPairs[8] + offset) & 0xffff;
regs[5] = (tstates += ( 3), memory.read(addr));

regs[5] &= 191;

tstates += ( 1);
tstates += ( 3);
while (display.nextEventTime != null && display.nextEventTime < tstates) display.doEvent();
memory.write(addr, regs[5]);;
	break;case 179:
	
	var addr = (regPairs[8] + offset) & 0xffff;
regs[4] = (tstates += ( 3), memory.read(addr));

regs[4] &= 191;

tstates += ( 1);
tstates += ( 3);
while (display.nextEventTime != null && display.nextEventTime < tstates) display.doEvent();
memory.write(addr, regs[4]);;
	break;case 180:
	
	var addr = (regPairs[8] + offset) & 0xffff;
regs[7] = (tstates += ( 3), memory.read(addr));

regs[7] &= 191;

tstates += ( 1);
tstates += ( 3);
while (display.nextEventTime != null && display.nextEventTime < tstates) display.doEvent();
memory.write(addr, regs[7]);;
	break;case 181:
	
	var addr = (regPairs[8] + offset) & 0xffff;
regs[6] = (tstates += ( 3), memory.read(addr));

regs[6] &= 191;

tstates += ( 1);
tstates += ( 3);
while (display.nextEventTime != null && display.nextEventTime < tstates) display.doEvent();
memory.write(addr, regs[6]);;
	break;case 182:
	
	var addr = (regPairs[8] + offset) & 0xffff;
var val = (tstates += ( 3), memory.read(addr));
val &= 191;
tstates += ( 1);
tstates += ( 3);
while (display.nextEventTime != null && display.nextEventTime < tstates) display.doEvent();
memory.write(addr, val);;
	break;case 183:
	
	var addr = (regPairs[8] + offset) & 0xffff;
regs[1] = (tstates += ( 3), memory.read(addr));

regs[1] &= 191;

tstates += ( 1);
tstates += ( 3);
while (display.nextEventTime != null && display.nextEventTime < tstates) display.doEvent();
memory.write(addr, regs[1]);;
	break;case 184:
	
	var addr = (regPairs[8] + offset) & 0xffff;
regs[3] = (tstates += ( 3), memory.read(addr));

regs[3] &= 127;

tstates += ( 1);
tstates += ( 3);
while (display.nextEventTime != null && display.nextEventTime < tstates) display.doEvent();
memory.write(addr, regs[3]);;
	break;case 185:
	
	var addr = (regPairs[8] + offset) & 0xffff;
regs[2] = (tstates += ( 3), memory.read(addr));

regs[2] &= 127;

tstates += ( 1);
tstates += ( 3);
while (display.nextEventTime != null && display.nextEventTime < tstates) display.doEvent();
memory.write(addr, regs[2]);;
	break;case 186:
	
	var addr = (regPairs[8] + offset) & 0xffff;
regs[5] = (tstates += ( 3), memory.read(addr));

regs[5] &= 127;

tstates += ( 1);
tstates += ( 3);
while (display.nextEventTime != null && display.nextEventTime < tstates) display.doEvent();
memory.write(addr, regs[5]);;
	break;case 187:
	
	var addr = (regPairs[8] + offset) & 0xffff;
regs[4] = (tstates += ( 3), memory.read(addr));

regs[4] &= 127;

tstates += ( 1);
tstates += ( 3);
while (display.nextEventTime != null && display.nextEventTime < tstates) display.doEvent();
memory.write(addr, regs[4]);;
	break;case 188:
	
	var addr = (regPairs[8] + offset) & 0xffff;
regs[7] = (tstates += ( 3), memory.read(addr));

regs[7] &= 127;

tstates += ( 1);
tstates += ( 3);
while (display.nextEventTime != null && display.nextEventTime < tstates) display.doEvent();
memory.write(addr, regs[7]);;
	break;case 189:
	
	var addr = (regPairs[8] + offset) & 0xffff;
regs[6] = (tstates += ( 3), memory.read(addr));

regs[6] &= 127;

tstates += ( 1);
tstates += ( 3);
while (display.nextEventTime != null && display.nextEventTime < tstates) display.doEvent();
memory.write(addr, regs[6]);;
	break;case 190:
	
	var addr = (regPairs[8] + offset) & 0xffff;
var val = (tstates += ( 3), memory.read(addr));
val &= 127;
tstates += ( 1);
tstates += ( 3);
while (display.nextEventTime != null && display.nextEventTime < tstates) display.doEvent();
memory.write(addr, val);;
	break;case 191:
	
	var addr = (regPairs[8] + offset) & 0xffff;
regs[1] = (tstates += ( 3), memory.read(addr));

regs[1] &= 127;

tstates += ( 1);
tstates += ( 3);
while (display.nextEventTime != null && display.nextEventTime < tstates) display.doEvent();
memory.write(addr, regs[1]);;
	break;case 192:
	
	var addr = (regPairs[8] + offset) & 0xffff;
regs[3] = (tstates += ( 3), memory.read(addr));

regs[3] |= 1;

tstates += ( 1);
tstates += ( 3);
while (display.nextEventTime != null && display.nextEventTime < tstates) display.doEvent();
memory.write(addr, regs[3]);;
	break;case 193:
	
	var addr = (regPairs[8] + offset) & 0xffff;
regs[2] = (tstates += ( 3), memory.read(addr));

regs[2] |= 1;

tstates += ( 1);
tstates += ( 3);
while (display.nextEventTime != null && display.nextEventTime < tstates) display.doEvent();
memory.write(addr, regs[2]);;
	break;case 194:
	
	var addr = (regPairs[8] + offset) & 0xffff;
regs[5] = (tstates += ( 3), memory.read(addr));

regs[5] |= 1;

tstates += ( 1);
tstates += ( 3);
while (display.nextEventTime != null && display.nextEventTime < tstates) display.doEvent();
memory.write(addr, regs[5]);;
	break;case 195:
	
	var addr = (regPairs[8] + offset) & 0xffff;
regs[4] = (tstates += ( 3), memory.read(addr));

regs[4] |= 1;

tstates += ( 1);
tstates += ( 3);
while (display.nextEventTime != null && display.nextEventTime < tstates) display.doEvent();
memory.write(addr, regs[4]);;
	break;case 196:
	
	var addr = (regPairs[8] + offset) & 0xffff;
regs[7] = (tstates += ( 3), memory.read(addr));

regs[7] |= 1;

tstates += ( 1);
tstates += ( 3);
while (display.nextEventTime != null && display.nextEventTime < tstates) display.doEvent();
memory.write(addr, regs[7]);;
	break;case 197:
	
	var addr = (regPairs[8] + offset) & 0xffff;
regs[6] = (tstates += ( 3), memory.read(addr));

regs[6] |= 1;

tstates += ( 1);
tstates += ( 3);
while (display.nextEventTime != null && display.nextEventTime < tstates) display.doEvent();
memory.write(addr, regs[6]);;
	break;case 198:
	
	var addr = (regPairs[8] + offset) & 0xffff;
var val = (tstates += ( 3), memory.read(addr));
val |= 1;
tstates += ( 1);
tstates += ( 3);
while (display.nextEventTime != null && display.nextEventTime < tstates) display.doEvent();
memory.write(addr, val);;
	break;case 199:
	
	var addr = (regPairs[8] + offset) & 0xffff;
regs[1] = (tstates += ( 3), memory.read(addr));

regs[1] |= 1;

tstates += ( 1);
tstates += ( 3);
while (display.nextEventTime != null && display.nextEventTime < tstates) display.doEvent();
memory.write(addr, regs[1]);;
	break;case 200:
	
	var addr = (regPairs[8] + offset) & 0xffff;
regs[3] = (tstates += ( 3), memory.read(addr));

regs[3] |= 2;

tstates += ( 1);
tstates += ( 3);
while (display.nextEventTime != null && display.nextEventTime < tstates) display.doEvent();
memory.write(addr, regs[3]);;
	break;case 201:
	
	var addr = (regPairs[8] + offset) & 0xffff;
regs[2] = (tstates += ( 3), memory.read(addr));

regs[2] |= 2;

tstates += ( 1);
tstates += ( 3);
while (display.nextEventTime != null && display.nextEventTime < tstates) display.doEvent();
memory.write(addr, regs[2]);;
	break;case 202:
	
	var addr = (regPairs[8] + offset) & 0xffff;
regs[5] = (tstates += ( 3), memory.read(addr));

regs[5] |= 2;

tstates += ( 1);
tstates += ( 3);
while (display.nextEventTime != null && display.nextEventTime < tstates) display.doEvent();
memory.write(addr, regs[5]);;
	break;case 203:
	
	var addr = (regPairs[8] + offset) & 0xffff;
regs[4] = (tstates += ( 3), memory.read(addr));

regs[4] |= 2;

tstates += ( 1);
tstates += ( 3);
while (display.nextEventTime != null && display.nextEventTime < tstates) display.doEvent();
memory.write(addr, regs[4]);;
	break;case 204:
	
	var addr = (regPairs[8] + offset) & 0xffff;
regs[7] = (tstates += ( 3), memory.read(addr));

regs[7] |= 2;

tstates += ( 1);
tstates += ( 3);
while (display.nextEventTime != null && display.nextEventTime < tstates) display.doEvent();
memory.write(addr, regs[7]);;
	break;case 205:
	
	var addr = (regPairs[8] + offset) & 0xffff;
regs[6] = (tstates += ( 3), memory.read(addr));

regs[6] |= 2;

tstates += ( 1);
tstates += ( 3);
while (display.nextEventTime != null && display.nextEventTime < tstates) display.doEvent();
memory.write(addr, regs[6]);;
	break;case 206:
	
	var addr = (regPairs[8] + offset) & 0xffff;
var val = (tstates += ( 3), memory.read(addr));
val |= 2;
tstates += ( 1);
tstates += ( 3);
while (display.nextEventTime != null && display.nextEventTime < tstates) display.doEvent();
memory.write(addr, val);;
	break;case 207:
	
	var addr = (regPairs[8] + offset) & 0xffff;
regs[1] = (tstates += ( 3), memory.read(addr));

regs[1] |= 2;

tstates += ( 1);
tstates += ( 3);
while (display.nextEventTime != null && display.nextEventTime < tstates) display.doEvent();
memory.write(addr, regs[1]);;
	break;case 208:
	
	var addr = (regPairs[8] + offset) & 0xffff;
regs[3] = (tstates += ( 3), memory.read(addr));

regs[3] |= 4;

tstates += ( 1);
tstates += ( 3);
while (display.nextEventTime != null && display.nextEventTime < tstates) display.doEvent();
memory.write(addr, regs[3]);;
	break;case 209:
	
	var addr = (regPairs[8] + offset) & 0xffff;
regs[2] = (tstates += ( 3), memory.read(addr));

regs[2] |= 4;

tstates += ( 1);
tstates += ( 3);
while (display.nextEventTime != null && display.nextEventTime < tstates) display.doEvent();
memory.write(addr, regs[2]);;
	break;case 210:
	
	var addr = (regPairs[8] + offset) & 0xffff;
regs[5] = (tstates += ( 3), memory.read(addr));

regs[5] |= 4;

tstates += ( 1);
tstates += ( 3);
while (display.nextEventTime != null && display.nextEventTime < tstates) display.doEvent();
memory.write(addr, regs[5]);;
	break;case 211:
	
	var addr = (regPairs[8] + offset) & 0xffff;
regs[4] = (tstates += ( 3), memory.read(addr));

regs[4] |= 4;

tstates += ( 1);
tstates += ( 3);
while (display.nextEventTime != null && display.nextEventTime < tstates) display.doEvent();
memory.write(addr, regs[4]);;
	break;case 212:
	
	var addr = (regPairs[8] + offset) & 0xffff;
regs[7] = (tstates += ( 3), memory.read(addr));

regs[7] |= 4;

tstates += ( 1);
tstates += ( 3);
while (display.nextEventTime != null && display.nextEventTime < tstates) display.doEvent();
memory.write(addr, regs[7]);;
	break;case 213:
	
	var addr = (regPairs[8] + offset) & 0xffff;
regs[6] = (tstates += ( 3), memory.read(addr));

regs[6] |= 4;

tstates += ( 1);
tstates += ( 3);
while (display.nextEventTime != null && display.nextEventTime < tstates) display.doEvent();
memory.write(addr, regs[6]);;
	break;case 214:
	
	var addr = (regPairs[8] + offset) & 0xffff;
var val = (tstates += ( 3), memory.read(addr));
val |= 4;
tstates += ( 1);
tstates += ( 3);
while (display.nextEventTime != null && display.nextEventTime < tstates) display.doEvent();
memory.write(addr, val);;
	break;case 215:
	
	var addr = (regPairs[8] + offset) & 0xffff;
regs[1] = (tstates += ( 3), memory.read(addr));

regs[1] |= 4;

tstates += ( 1);
tstates += ( 3);
while (display.nextEventTime != null && display.nextEventTime < tstates) display.doEvent();
memory.write(addr, regs[1]);;
	break;case 216:
	
	var addr = (regPairs[8] + offset) & 0xffff;
regs[3] = (tstates += ( 3), memory.read(addr));

regs[3] |= 8;

tstates += ( 1);
tstates += ( 3);
while (display.nextEventTime != null && display.nextEventTime < tstates) display.doEvent();
memory.write(addr, regs[3]);;
	break;case 217:
	
	var addr = (regPairs[8] + offset) & 0xffff;
regs[2] = (tstates += ( 3), memory.read(addr));

regs[2] |= 8;

tstates += ( 1);
tstates += ( 3);
while (display.nextEventTime != null && display.nextEventTime < tstates) display.doEvent();
memory.write(addr, regs[2]);;
	break;case 218:
	
	var addr = (regPairs[8] + offset) & 0xffff;
regs[5] = (tstates += ( 3), memory.read(addr));

regs[5] |= 8;

tstates += ( 1);
tstates += ( 3);
while (display.nextEventTime != null && display.nextEventTime < tstates) display.doEvent();
memory.write(addr, regs[5]);;
	break;case 219:
	
	var addr = (regPairs[8] + offset) & 0xffff;
regs[4] = (tstates += ( 3), memory.read(addr));

regs[4] |= 8;

tstates += ( 1);
tstates += ( 3);
while (display.nextEventTime != null && display.nextEventTime < tstates) display.doEvent();
memory.write(addr, regs[4]);;
	break;case 220:
	
	var addr = (regPairs[8] + offset) & 0xffff;
regs[7] = (tstates += ( 3), memory.read(addr));

regs[7] |= 8;

tstates += ( 1);
tstates += ( 3);
while (display.nextEventTime != null && display.nextEventTime < tstates) display.doEvent();
memory.write(addr, regs[7]);;
	break;case 221:
	
	var addr = (regPairs[8] + offset) & 0xffff;
regs[6] = (tstates += ( 3), memory.read(addr));

regs[6] |= 8;

tstates += ( 1);
tstates += ( 3);
while (display.nextEventTime != null && display.nextEventTime < tstates) display.doEvent();
memory.write(addr, regs[6]);;
	break;case 222:
	
	var addr = (regPairs[8] + offset) & 0xffff;
var val = (tstates += ( 3), memory.read(addr));
val |= 8;
tstates += ( 1);
tstates += ( 3);
while (display.nextEventTime != null && display.nextEventTime < tstates) display.doEvent();
memory.write(addr, val);;
	break;case 223:
	
	var addr = (regPairs[8] + offset) & 0xffff;
regs[1] = (tstates += ( 3), memory.read(addr));

regs[1] |= 8;

tstates += ( 1);
tstates += ( 3);
while (display.nextEventTime != null && display.nextEventTime < tstates) display.doEvent();
memory.write(addr, regs[1]);;
	break;case 224:
	
	var addr = (regPairs[8] + offset) & 0xffff;
regs[3] = (tstates += ( 3), memory.read(addr));

regs[3] |= 16;

tstates += ( 1);
tstates += ( 3);
while (display.nextEventTime != null && display.nextEventTime < tstates) display.doEvent();
memory.write(addr, regs[3]);;
	break;case 225:
	
	var addr = (regPairs[8] + offset) & 0xffff;
regs[2] = (tstates += ( 3), memory.read(addr));

regs[2] |= 16;

tstates += ( 1);
tstates += ( 3);
while (display.nextEventTime != null && display.nextEventTime < tstates) display.doEvent();
memory.write(addr, regs[2]);;
	break;case 226:
	
	var addr = (regPairs[8] + offset) & 0xffff;
regs[5] = (tstates += ( 3), memory.read(addr));

regs[5] |= 16;

tstates += ( 1);
tstates += ( 3);
while (display.nextEventTime != null && display.nextEventTime < tstates) display.doEvent();
memory.write(addr, regs[5]);;
	break;case 227:
	
	var addr = (regPairs[8] + offset) & 0xffff;
regs[4] = (tstates += ( 3), memory.read(addr));

regs[4] |= 16;

tstates += ( 1);
tstates += ( 3);
while (display.nextEventTime != null && display.nextEventTime < tstates) display.doEvent();
memory.write(addr, regs[4]);;
	break;case 228:
	
	var addr = (regPairs[8] + offset) & 0xffff;
regs[7] = (tstates += ( 3), memory.read(addr));

regs[7] |= 16;

tstates += ( 1);
tstates += ( 3);
while (display.nextEventTime != null && display.nextEventTime < tstates) display.doEvent();
memory.write(addr, regs[7]);;
	break;case 229:
	
	var addr = (regPairs[8] + offset) & 0xffff;
regs[6] = (tstates += ( 3), memory.read(addr));

regs[6] |= 16;

tstates += ( 1);
tstates += ( 3);
while (display.nextEventTime != null && display.nextEventTime < tstates) display.doEvent();
memory.write(addr, regs[6]);;
	break;case 230:
	
	var addr = (regPairs[8] + offset) & 0xffff;
var val = (tstates += ( 3), memory.read(addr));
val |= 16;
tstates += ( 1);
tstates += ( 3);
while (display.nextEventTime != null && display.nextEventTime < tstates) display.doEvent();
memory.write(addr, val);;
	break;case 231:
	
	var addr = (regPairs[8] + offset) & 0xffff;
regs[1] = (tstates += ( 3), memory.read(addr));

regs[1] |= 16;

tstates += ( 1);
tstates += ( 3);
while (display.nextEventTime != null && display.nextEventTime < tstates) display.doEvent();
memory.write(addr, regs[1]);;
	break;case 232:
	
	var addr = (regPairs[8] + offset) & 0xffff;
regs[3] = (tstates += ( 3), memory.read(addr));

regs[3] |= 32;

tstates += ( 1);
tstates += ( 3);
while (display.nextEventTime != null && display.nextEventTime < tstates) display.doEvent();
memory.write(addr, regs[3]);;
	break;case 233:
	
	var addr = (regPairs[8] + offset) & 0xffff;
regs[2] = (tstates += ( 3), memory.read(addr));

regs[2] |= 32;

tstates += ( 1);
tstates += ( 3);
while (display.nextEventTime != null && display.nextEventTime < tstates) display.doEvent();
memory.write(addr, regs[2]);;
	break;case 234:
	
	var addr = (regPairs[8] + offset) & 0xffff;
regs[5] = (tstates += ( 3), memory.read(addr));

regs[5] |= 32;

tstates += ( 1);
tstates += ( 3);
while (display.nextEventTime != null && display.nextEventTime < tstates) display.doEvent();
memory.write(addr, regs[5]);;
	break;case 235:
	
	var addr = (regPairs[8] + offset) & 0xffff;
regs[4] = (tstates += ( 3), memory.read(addr));

regs[4] |= 32;

tstates += ( 1);
tstates += ( 3);
while (display.nextEventTime != null && display.nextEventTime < tstates) display.doEvent();
memory.write(addr, regs[4]);;
	break;case 236:
	
	var addr = (regPairs[8] + offset) & 0xffff;
regs[7] = (tstates += ( 3), memory.read(addr));

regs[7] |= 32;

tstates += ( 1);
tstates += ( 3);
while (display.nextEventTime != null && display.nextEventTime < tstates) display.doEvent();
memory.write(addr, regs[7]);;
	break;case 237:
	
	var addr = (regPairs[8] + offset) & 0xffff;
regs[6] = (tstates += ( 3), memory.read(addr));

regs[6] |= 32;

tstates += ( 1);
tstates += ( 3);
while (display.nextEventTime != null && display.nextEventTime < tstates) display.doEvent();
memory.write(addr, regs[6]);;
	break;case 238:
	
	var addr = (regPairs[8] + offset) & 0xffff;
var val = (tstates += ( 3), memory.read(addr));
val |= 32;
tstates += ( 1);
tstates += ( 3);
while (display.nextEventTime != null && display.nextEventTime < tstates) display.doEvent();
memory.write(addr, val);;
	break;case 239:
	
	var addr = (regPairs[8] + offset) & 0xffff;
regs[1] = (tstates += ( 3), memory.read(addr));

regs[1] |= 32;

tstates += ( 1);
tstates += ( 3);
while (display.nextEventTime != null && display.nextEventTime < tstates) display.doEvent();
memory.write(addr, regs[1]);;
	break;case 240:
	
	var addr = (regPairs[8] + offset) & 0xffff;
regs[3] = (tstates += ( 3), memory.read(addr));

regs[3] |= 64;

tstates += ( 1);
tstates += ( 3);
while (display.nextEventTime != null && display.nextEventTime < tstates) display.doEvent();
memory.write(addr, regs[3]);;
	break;case 241:
	
	var addr = (regPairs[8] + offset) & 0xffff;
regs[2] = (tstates += ( 3), memory.read(addr));

regs[2] |= 64;

tstates += ( 1);
tstates += ( 3);
while (display.nextEventTime != null && display.nextEventTime < tstates) display.doEvent();
memory.write(addr, regs[2]);;
	break;case 242:
	
	var addr = (regPairs[8] + offset) & 0xffff;
regs[5] = (tstates += ( 3), memory.read(addr));

regs[5] |= 64;

tstates += ( 1);
tstates += ( 3);
while (display.nextEventTime != null && display.nextEventTime < tstates) display.doEvent();
memory.write(addr, regs[5]);;
	break;case 243:
	
	var addr = (regPairs[8] + offset) & 0xffff;
regs[4] = (tstates += ( 3), memory.read(addr));

regs[4] |= 64;

tstates += ( 1);
tstates += ( 3);
while (display.nextEventTime != null && display.nextEventTime < tstates) display.doEvent();
memory.write(addr, regs[4]);;
	break;case 244:
	
	var addr = (regPairs[8] + offset) & 0xffff;
regs[7] = (tstates += ( 3), memory.read(addr));

regs[7] |= 64;

tstates += ( 1);
tstates += ( 3);
while (display.nextEventTime != null && display.nextEventTime < tstates) display.doEvent();
memory.write(addr, regs[7]);;
	break;case 245:
	
	var addr = (regPairs[8] + offset) & 0xffff;
regs[6] = (tstates += ( 3), memory.read(addr));

regs[6] |= 64;

tstates += ( 1);
tstates += ( 3);
while (display.nextEventTime != null && display.nextEventTime < tstates) display.doEvent();
memory.write(addr, regs[6]);;
	break;case 246:
	
	var addr = (regPairs[8] + offset) & 0xffff;
var val = (tstates += ( 3), memory.read(addr));
val |= 64;
tstates += ( 1);
tstates += ( 3);
while (display.nextEventTime != null && display.nextEventTime < tstates) display.doEvent();
memory.write(addr, val);;
	break;case 247:
	
	var addr = (regPairs[8] + offset) & 0xffff;
regs[1] = (tstates += ( 3), memory.read(addr));

regs[1] |= 64;

tstates += ( 1);
tstates += ( 3);
while (display.nextEventTime != null && display.nextEventTime < tstates) display.doEvent();
memory.write(addr, regs[1]);;
	break;case 248:
	
	var addr = (regPairs[8] + offset) & 0xffff;
regs[3] = (tstates += ( 3), memory.read(addr));

regs[3] |= 128;

tstates += ( 1);
tstates += ( 3);
while (display.nextEventTime != null && display.nextEventTime < tstates) display.doEvent();
memory.write(addr, regs[3]);;
	break;case 249:
	
	var addr = (regPairs[8] + offset) & 0xffff;
regs[2] = (tstates += ( 3), memory.read(addr));

regs[2] |= 128;

tstates += ( 1);
tstates += ( 3);
while (display.nextEventTime != null && display.nextEventTime < tstates) display.doEvent();
memory.write(addr, regs[2]);;
	break;case 250:
	
	var addr = (regPairs[8] + offset) & 0xffff;
regs[5] = (tstates += ( 3), memory.read(addr));

regs[5] |= 128;

tstates += ( 1);
tstates += ( 3);
while (display.nextEventTime != null && display.nextEventTime < tstates) display.doEvent();
memory.write(addr, regs[5]);;
	break;case 251:
	
	var addr = (regPairs[8] + offset) & 0xffff;
regs[4] = (tstates += ( 3), memory.read(addr));

regs[4] |= 128;

tstates += ( 1);
tstates += ( 3);
while (display.nextEventTime != null && display.nextEventTime < tstates) display.doEvent();
memory.write(addr, regs[4]);;
	break;case 252:
	
	var addr = (regPairs[8] + offset) & 0xffff;
regs[7] = (tstates += ( 3), memory.read(addr));

regs[7] |= 128;

tstates += ( 1);
tstates += ( 3);
while (display.nextEventTime != null && display.nextEventTime < tstates) display.doEvent();
memory.write(addr, regs[7]);;
	break;case 253:
	
	var addr = (regPairs[8] + offset) & 0xffff;
regs[6] = (tstates += ( 3), memory.read(addr));

regs[6] |= 128;

tstates += ( 1);
tstates += ( 3);
while (display.nextEventTime != null && display.nextEventTime < tstates) display.doEvent();
memory.write(addr, regs[6]);;
	break;case 254:
	
	var addr = (regPairs[8] + offset) & 0xffff;
var val = (tstates += ( 3), memory.read(addr));
val |= 128;
tstates += ( 1);
tstates += ( 3);
while (display.nextEventTime != null && display.nextEventTime < tstates) display.doEvent();
memory.write(addr, val);;
	break;case 255:
	
	var addr = (regPairs[8] + offset) & 0xffff;
regs[1] = (tstates += ( 3), memory.read(addr));

regs[1] |= 128;

tstates += ( 1);
tstates += ( 3);
while (display.nextEventTime != null && display.nextEventTime < tstates) display.doEvent();
memory.write(addr, regs[1]);;
	break;
	default:
		var addr = regPairs[12] - 1;
		throw("Unimplemented opcode " + opcode + " in page ddcb - PC = " + addr);
}
					break;
				case 'ED':
					tstates += ( 4);
					opcode = memory.read(regPairs[12]); regPairs[12]++;
					regs[20] = ((regs[20] + 1) & 0x7f) | (regs[20] & 0x80);
					switch (opcode) {
	case 64:
	
	var port = regPairs[1];
tstates += 1;
regs[3] = ioBus.read(port);
tstates += 3;
regs[0] = (regs[0] & 1) | sz53pTable[regs[3]];
	break;case 65:
	
	tstates += 1;
ioBus.write(regPairs[1], regs[3], tstates);
tstates += 3;
	break;case 66:
	
	var sub16temp = regPairs[3] - regPairs[1] - (regs[0] & 1);
var lookup = ( (regPairs[3] & 0x8800) >> 11 ) | ( (regPairs[1] & 0x8800) >> 10 ) | ( (sub16temp & 0x8800) >>  9 );
regPairs[3] = sub16temp;
regs[0] = ( sub16temp & 0x10000 ? 1 : 0 ) | 2 | overflowSubTable[lookup >> 4] | (regs[7] & 168) | halfcarrySubTable[lookup&0x07] | (regPairs[3] ? 0 : 64);
tstates += ( 1);
tstates += ( 1);
tstates += ( 1);
tstates += ( 1);
tstates += ( 1);
tstates += ( 1);
tstates += ( 1);
	break;case 67:
	
	var l = (tstates += ( 3), memory.read(regPairs[12])); regPairs[12]++;
var h = (tstates += ( 3), memory.read(regPairs[12])); regPairs[12]++;
var addr = (h<<8) | l;
tstates += ( 3);
while (display.nextEventTime != null && display.nextEventTime < tstates) display.doEvent();
memory.write(addr, regPairs[1] & 0xff);;
addr = (addr + 1) & 0xffff;
tstates += ( 3);
while (display.nextEventTime != null && display.nextEventTime < tstates) display.doEvent();
memory.write(addr, regPairs[1] >> 8);;
	break;case 68:
	
	var val = regs[1];
var subtemp = -val;
var lookup = ( (val & 0x88) >> 2 ) | ( (subtemp & 0x88) >> 1 );
regs[1] = subtemp;
regs[0] = ( subtemp & 0x100 ? 1 : 0 ) | 2 | halfcarrySubTable[lookup & 0x07] | overflowSubTable[lookup >> 4] | sz53Table[regs[1]];
	break;case 69:
	
	iff1 = iff2;
var l = (tstates += ( 3), memory.read(regPairs[11])); regPairs[11]++;
var h = (tstates += ( 3), memory.read(regPairs[11])); regPairs[11]++;
regPairs[12] = (h<<8) | l;
	break;case 70:
	
	im = 0;
	break;case 71:
	
	tstates += ( 1);
regs[21] = regs[1];
	break;case 72:
	
	var port = regPairs[1];
tstates += 1;
regs[2] = ioBus.read(port);
tstates += 3;
regs[0] = (regs[0] & 1) | sz53pTable[regs[2]];
	break;case 73:
	
	tstates += 1;
ioBus.write(regPairs[1], regs[2], tstates);
tstates += 3;
	break;case 74:
	
	var add16temp = regPairs[3] + regPairs[1] + (regs[0] & 1);
var lookup = (
	( (regPairs[3] & 0x8800) >> 11 ) |
	( (regPairs[1] & 0x8800) >> 10 ) |
	( (add16temp & 0x8800) >>  9 )
);
regPairs[3] = add16temp;
regs[0] = (
	(add16temp & 0x10000 ? 1 : 0) |
	overflowAddTable[lookup >> 4] |
	(regs[7] & 168) |
	halfcarryAddTable[lookup & 0x07] |
	(regPairs[3] ? 0 : 64)
);
tstates += ( 1);
tstates += ( 1);
tstates += ( 1);
tstates += ( 1);
tstates += ( 1);
tstates += ( 1);
tstates += ( 1);
	break;case 75:
	
	var l = (tstates += ( 3), memory.read(regPairs[12])); regPairs[12]++;
var h = (tstates += ( 3), memory.read(regPairs[12])); regPairs[12]++;
var addr = (h<<8) | l;
l = (tstates += ( 3), memory.read(addr));
addr = (addr + 1) & 0xffff;
h = (tstates += ( 3), memory.read(addr));
regPairs[1] = (h<<8) | l;
	break;case 76:
	
	var val = regs[1];
var subtemp = -val;
var lookup = ( (val & 0x88) >> 2 ) | ( (subtemp & 0x88) >> 1 );
regs[1] = subtemp;
regs[0] = ( subtemp & 0x100 ? 1 : 0 ) | 2 | halfcarrySubTable[lookup & 0x07] | overflowSubTable[lookup >> 4] | sz53Table[regs[1]];
	break;case 77:
	
	iff1 = iff2;
var l = (tstates += ( 3), memory.read(regPairs[11])); regPairs[11]++;
var h = (tstates += ( 3), memory.read(regPairs[11])); regPairs[11]++;
regPairs[12] = (h<<8) | l;
	break;case 78:
	
	im = 0;
	break;case 79:
	
	tstates += ( 1);
regs[20] = regs[1];
	break;case 80:
	
	var port = regPairs[1];
tstates += 1;
regs[5] = ioBus.read(port);
tstates += 3;
regs[0] = (regs[0] & 1) | sz53pTable[regs[5]];
	break;case 81:
	
	tstates += 1;
ioBus.write(regPairs[1], regs[5], tstates);
tstates += 3;
	break;case 82:
	
	var sub16temp = regPairs[3] - regPairs[2] - (regs[0] & 1);
var lookup = ( (regPairs[3] & 0x8800) >> 11 ) | ( (regPairs[2] & 0x8800) >> 10 ) | ( (sub16temp & 0x8800) >>  9 );
regPairs[3] = sub16temp;
regs[0] = ( sub16temp & 0x10000 ? 1 : 0 ) | 2 | overflowSubTable[lookup >> 4] | (regs[7] & 168) | halfcarrySubTable[lookup&0x07] | (regPairs[3] ? 0 : 64);
tstates += ( 1);
tstates += ( 1);
tstates += ( 1);
tstates += ( 1);
tstates += ( 1);
tstates += ( 1);
tstates += ( 1);
	break;case 83:
	
	var l = (tstates += ( 3), memory.read(regPairs[12])); regPairs[12]++;
var h = (tstates += ( 3), memory.read(regPairs[12])); regPairs[12]++;
var addr = (h<<8) | l;
tstates += ( 3);
while (display.nextEventTime != null && display.nextEventTime < tstates) display.doEvent();
memory.write(addr, regPairs[2] & 0xff);;
addr = (addr + 1) & 0xffff;
tstates += ( 3);
while (display.nextEventTime != null && display.nextEventTime < tstates) display.doEvent();
memory.write(addr, regPairs[2] >> 8);;
	break;case 84:
	
	var val = regs[1];
var subtemp = -val;
var lookup = ( (val & 0x88) >> 2 ) | ( (subtemp & 0x88) >> 1 );
regs[1] = subtemp;
regs[0] = ( subtemp & 0x100 ? 1 : 0 ) | 2 | halfcarrySubTable[lookup & 0x07] | overflowSubTable[lookup >> 4] | sz53Table[regs[1]];
	break;case 85:
	
	iff1 = iff2;
var l = (tstates += ( 3), memory.read(regPairs[11])); regPairs[11]++;
var h = (tstates += ( 3), memory.read(regPairs[11])); regPairs[11]++;
regPairs[12] = (h<<8) | l;
	break;case 86:
	
	im = 1;
	break;case 87:
	
	tstates += ( 1);
regs[1] = regs[21];regs[0] = (regs[0] & 1) | sz53Table[regs[1]] | ( iff2 ? 4 : 0 );
	break;case 88:
	
	var port = regPairs[1];
tstates += 1;
regs[4] = ioBus.read(port);
tstates += 3;
regs[0] = (regs[0] & 1) | sz53pTable[regs[4]];
	break;case 89:
	
	tstates += 1;
ioBus.write(regPairs[1], regs[4], tstates);
tstates += 3;
	break;case 90:
	
	var add16temp = regPairs[3] + regPairs[2] + (regs[0] & 1);
var lookup = (
	( (regPairs[3] & 0x8800) >> 11 ) |
	( (regPairs[2] & 0x8800) >> 10 ) |
	( (add16temp & 0x8800) >>  9 )
);
regPairs[3] = add16temp;
regs[0] = (
	(add16temp & 0x10000 ? 1 : 0) |
	overflowAddTable[lookup >> 4] |
	(regs[7] & 168) |
	halfcarryAddTable[lookup & 0x07] |
	(regPairs[3] ? 0 : 64)
);
tstates += ( 1);
tstates += ( 1);
tstates += ( 1);
tstates += ( 1);
tstates += ( 1);
tstates += ( 1);
tstates += ( 1);
	break;case 91:
	
	var l = (tstates += ( 3), memory.read(regPairs[12])); regPairs[12]++;
var h = (tstates += ( 3), memory.read(regPairs[12])); regPairs[12]++;
var addr = (h<<8) | l;
l = (tstates += ( 3), memory.read(addr));
addr = (addr + 1) & 0xffff;
h = (tstates += ( 3), memory.read(addr));
regPairs[2] = (h<<8) | l;
	break;case 92:
	
	var val = regs[1];
var subtemp = -val;
var lookup = ( (val & 0x88) >> 2 ) | ( (subtemp & 0x88) >> 1 );
regs[1] = subtemp;
regs[0] = ( subtemp & 0x100 ? 1 : 0 ) | 2 | halfcarrySubTable[lookup & 0x07] | overflowSubTable[lookup >> 4] | sz53Table[regs[1]];
	break;case 93:
	
	iff1 = iff2;
var l = (tstates += ( 3), memory.read(regPairs[11])); regPairs[11]++;
var h = (tstates += ( 3), memory.read(regPairs[11])); regPairs[11]++;
regPairs[12] = (h<<8) | l;
	break;case 94:
	
	im = 2;
	break;case 95:
	
	tstates += ( 1);
regs[1] = regs[20];regs[0] = (regs[0] & 1) | sz53Table[regs[1]] | ( iff2 ? 4 : 0 );
	break;case 96:
	
	var port = regPairs[1];
tstates += 1;
regs[7] = ioBus.read(port);
tstates += 3;
regs[0] = (regs[0] & 1) | sz53pTable[regs[7]];
	break;case 97:
	
	tstates += 1;
ioBus.write(regPairs[1], regs[7], tstates);
tstates += 3;
	break;case 98:
	
	var sub16temp = regPairs[3] - regPairs[3] - (regs[0] & 1);
var lookup = ( (regPairs[3] & 0x8800) >> 11 ) | ( (regPairs[3] & 0x8800) >> 10 ) | ( (sub16temp & 0x8800) >>  9 );
regPairs[3] = sub16temp;
regs[0] = ( sub16temp & 0x10000 ? 1 : 0 ) | 2 | overflowSubTable[lookup >> 4] | (regs[7] & 168) | halfcarrySubTable[lookup&0x07] | (regPairs[3] ? 0 : 64);
tstates += ( 1);
tstates += ( 1);
tstates += ( 1);
tstates += ( 1);
tstates += ( 1);
tstates += ( 1);
tstates += ( 1);
	break;case 99:
	
	var l = (tstates += ( 3), memory.read(regPairs[12])); regPairs[12]++;
var h = (tstates += ( 3), memory.read(regPairs[12])); regPairs[12]++;
var addr = (h<<8) | l;
tstates += ( 3);
while (display.nextEventTime != null && display.nextEventTime < tstates) display.doEvent();
memory.write(addr, regPairs[3] & 0xff);;
addr = (addr + 1) & 0xffff;
tstates += ( 3);
while (display.nextEventTime != null && display.nextEventTime < tstates) display.doEvent();
memory.write(addr, regPairs[3] >> 8);;
	break;case 100:
	
	var val = regs[1];
var subtemp = -val;
var lookup = ( (val & 0x88) >> 2 ) | ( (subtemp & 0x88) >> 1 );
regs[1] = subtemp;
regs[0] = ( subtemp & 0x100 ? 1 : 0 ) | 2 | halfcarrySubTable[lookup & 0x07] | overflowSubTable[lookup >> 4] | sz53Table[regs[1]];
	break;case 101:
	
	iff1 = iff2;
var l = (tstates += ( 3), memory.read(regPairs[11])); regPairs[11]++;
var h = (tstates += ( 3), memory.read(regPairs[11])); regPairs[11]++;
regPairs[12] = (h<<8) | l;
	break;case 102:
	
	im = 0;
	break;case 103:
	
	var bytetemp = (tstates += ( 3), memory.read(regPairs[3]));
tstates += ( 1);
tstates += ( 1);
tstates += ( 1);
tstates += ( 1);
var val = (regs[1] << 4) | (bytetemp >> 4);
tstates += ( 3);
while (display.nextEventTime != null && display.nextEventTime < tstates) display.doEvent();
memory.write(regPairs[3], val);;
regs[1] = (regs[1] & 0xf0) | (bytetemp & 0x0f);
regs[0] = (regs[0] & 1) | sz53pTable[regs[1]];
	break;case 104:
	
	var port = regPairs[1];
tstates += 1;
regs[6] = ioBus.read(port);
tstates += 3;
regs[0] = (regs[0] & 1) | sz53pTable[regs[6]];
	break;case 105:
	
	tstates += 1;
ioBus.write(regPairs[1], regs[6], tstates);
tstates += 3;
	break;case 106:
	
	var add16temp = regPairs[3] + regPairs[3] + (regs[0] & 1);
var lookup = (
	( (regPairs[3] & 0x8800) >> 11 ) |
	( (regPairs[3] & 0x8800) >> 10 ) |
	( (add16temp & 0x8800) >>  9 )
);
regPairs[3] = add16temp;
regs[0] = (
	(add16temp & 0x10000 ? 1 : 0) |
	overflowAddTable[lookup >> 4] |
	(regs[7] & 168) |
	halfcarryAddTable[lookup & 0x07] |
	(regPairs[3] ? 0 : 64)
);
tstates += ( 1);
tstates += ( 1);
tstates += ( 1);
tstates += ( 1);
tstates += ( 1);
tstates += ( 1);
tstates += ( 1);
	break;case 107:
	
	var l = (tstates += ( 3), memory.read(regPairs[12])); regPairs[12]++;
var h = (tstates += ( 3), memory.read(regPairs[12])); regPairs[12]++;
var addr = (h<<8) | l;
l = (tstates += ( 3), memory.read(addr));
addr = (addr + 1) & 0xffff;
h = (tstates += ( 3), memory.read(addr));
regPairs[3] = (h<<8) | l;
	break;case 108:
	
	var val = regs[1];
var subtemp = -val;
var lookup = ( (val & 0x88) >> 2 ) | ( (subtemp & 0x88) >> 1 );
regs[1] = subtemp;
regs[0] = ( subtemp & 0x100 ? 1 : 0 ) | 2 | halfcarrySubTable[lookup & 0x07] | overflowSubTable[lookup >> 4] | sz53Table[regs[1]];
	break;case 109:
	
	iff1 = iff2;
var l = (tstates += ( 3), memory.read(regPairs[11])); regPairs[11]++;
var h = (tstates += ( 3), memory.read(regPairs[11])); regPairs[11]++;
regPairs[12] = (h<<8) | l;
	break;case 110:
	
	im = 0;
	break;case 111:
	
	var bytetemp =  (tstates += ( 3), memory.read(regPairs[3]));
tstates += ( 1);
tstates += ( 1);
tstates += ( 1);
tstates += ( 1);
var val = (bytetemp << 4) | (regs[1] & 0x0f);
tstates += ( 3);
while (display.nextEventTime != null && display.nextEventTime < tstates) display.doEvent();
memory.write(regPairs[3], val);;
regs[1] = (regs[1] & 0xf0) | (bytetemp >> 4);
regs[0] = (regs[0] & 1) | sz53pTable[regs[1]];
	break;case 112:
	
	var port = regPairs[1];
tstates += 1;
var result = ioBus.read(port);
tstates += 3;
regs[0] = (regs[0] & 1) | sz53pTable[result];
	break;case 113:
	
	tstates += 1;
ioBus.write(regPairs[1], 0, tstates);
tstates += 3;
	break;case 114:
	
	var sub16temp = regPairs[3] - regPairs[11] - (regs[0] & 1);
var lookup = ( (regPairs[3] & 0x8800) >> 11 ) | ( (regPairs[11] & 0x8800) >> 10 ) | ( (sub16temp & 0x8800) >>  9 );
regPairs[3] = sub16temp;
regs[0] = ( sub16temp & 0x10000 ? 1 : 0 ) | 2 | overflowSubTable[lookup >> 4] | (regs[7] & 168) | halfcarrySubTable[lookup&0x07] | (regPairs[3] ? 0 : 64);
tstates += ( 1);
tstates += ( 1);
tstates += ( 1);
tstates += ( 1);
tstates += ( 1);
tstates += ( 1);
tstates += ( 1);
	break;case 115:
	
	var l = (tstates += ( 3), memory.read(regPairs[12])); regPairs[12]++;
var h = (tstates += ( 3), memory.read(regPairs[12])); regPairs[12]++;
var addr = (h<<8) | l;
tstates += ( 3);
while (display.nextEventTime != null && display.nextEventTime < tstates) display.doEvent();
memory.write(addr, regPairs[11] & 0xff);;
addr = (addr + 1) & 0xffff;
tstates += ( 3);
while (display.nextEventTime != null && display.nextEventTime < tstates) display.doEvent();
memory.write(addr, regPairs[11] >> 8);;
	break;case 116:
	
	var val = regs[1];
var subtemp = -val;
var lookup = ( (val & 0x88) >> 2 ) | ( (subtemp & 0x88) >> 1 );
regs[1] = subtemp;
regs[0] = ( subtemp & 0x100 ? 1 : 0 ) | 2 | halfcarrySubTable[lookup & 0x07] | overflowSubTable[lookup >> 4] | sz53Table[regs[1]];
	break;case 117:
	
	iff1 = iff2;
var l = (tstates += ( 3), memory.read(regPairs[11])); regPairs[11]++;
var h = (tstates += ( 3), memory.read(regPairs[11])); regPairs[11]++;
regPairs[12] = (h<<8) | l;
	break;case 118:
	
	im = 1;
	break;case 120:
	
	var port = regPairs[1];
tstates += 1;
regs[1] = ioBus.read(port);
tstates += 3;
regs[0] = (regs[0] & 1) | sz53pTable[regs[1]];
	break;case 121:
	
	tstates += 1;
ioBus.write(regPairs[1], regs[1], tstates);
tstates += 3;
	break;case 122:
	
	var add16temp = regPairs[3] + regPairs[11] + (regs[0] & 1);
var lookup = (
	( (regPairs[3] & 0x8800) >> 11 ) |
	( (regPairs[11] & 0x8800) >> 10 ) |
	( (add16temp & 0x8800) >>  9 )
);
regPairs[3] = add16temp;
regs[0] = (
	(add16temp & 0x10000 ? 1 : 0) |
	overflowAddTable[lookup >> 4] |
	(regs[7] & 168) |
	halfcarryAddTable[lookup & 0x07] |
	(regPairs[3] ? 0 : 64)
);
tstates += ( 1);
tstates += ( 1);
tstates += ( 1);
tstates += ( 1);
tstates += ( 1);
tstates += ( 1);
tstates += ( 1);
	break;case 123:
	
	var l = (tstates += ( 3), memory.read(regPairs[12])); regPairs[12]++;
var h = (tstates += ( 3), memory.read(regPairs[12])); regPairs[12]++;
var addr = (h<<8) | l;
l = (tstates += ( 3), memory.read(addr));
addr = (addr + 1) & 0xffff;
h = (tstates += ( 3), memory.read(addr));
regPairs[11] = (h<<8) | l;
	break;case 124:
	
	var val = regs[1];
var subtemp = -val;
var lookup = ( (val & 0x88) >> 2 ) | ( (subtemp & 0x88) >> 1 );
regs[1] = subtemp;
regs[0] = ( subtemp & 0x100 ? 1 : 0 ) | 2 | halfcarrySubTable[lookup & 0x07] | overflowSubTable[lookup >> 4] | sz53Table[regs[1]];
	break;case 125:
	
	iff1 = iff2;
var l = (tstates += ( 3), memory.read(regPairs[11])); regPairs[11]++;
var h = (tstates += ( 3), memory.read(regPairs[11])); regPairs[11]++;
regPairs[12] = (h<<8) | l;
	break;case 126:
	
	im = 2;
	break;case 160:
	
	var bytetemp = (tstates += ( 3), memory.read(regPairs[3]));
regPairs[1]--;
tstates += ( 3);
while (display.nextEventTime != null && display.nextEventTime < tstates) display.doEvent();
memory.write(regPairs[2],bytetemp);;
var originalDE = regPairs[2];
regPairs[2]++; regPairs[3]++;
bytetemp = (bytetemp + regs[1]) & 0xff;
regs[0] = (regs[0] & 193) | (regPairs[1] ? 4 : 0) | (bytetemp & 8) | ((bytetemp & 0x02) ? 32 : 0);
tstates += ( 1);
tstates += ( 1);
	break;case 161:
	
	var value = (tstates += ( 3), memory.read(regPairs[3]));
var bytetemp = (regs[1] - value) & 0xff;
var lookup = ((regs[1] & 0x08) >> 3) | ((value & 0x08) >> 2) | ((bytetemp & 0x08) >> 1);
var originalHL = regPairs[3];
tstates += ( 1);
tstates += ( 1);
tstates += ( 1);
tstates += ( 1);
tstates += ( 1);
regPairs[3]++; regPairs[1]--;
regs[0] = (regs[0] & 1) | (regPairs[1] ? 6 : 2) | halfcarrySubTable[lookup] | (bytetemp ? 0 : 64) | (bytetemp & 128);
if (regs[0] & 16) bytetemp--;
regs[0] |= (bytetemp & 8) | ( (bytetemp & 0x02) ? 32 : 0 );
	break;case 162:
	
	tstates += ( 1);
tstates += 1;
var initemp = ioBus.read(regPairs[1]);
tstates += 3;
tstates += ( 3);
while (display.nextEventTime != null && display.nextEventTime < tstates) display.doEvent();
memory.write(regPairs[3], initemp);;
regs[3]--;
var originalHL = regPairs[3];
regPairs[3]++;
var initemp2 = (initemp + regs[2] + 1) & 0xff;

regs[0] = (initemp & 0x80 ? 2 : 0) | ((initemp2 < initemp) ? 17 : 0 ) | ( parityTable[ (initemp2 & 0x07) ^ regs[3] ] ? 4 : 0 ) | sz53Table[regs[3]];
	break;case 163:
	
	tstates += ( 1);
var outitemp = (tstates += ( 3), memory.read(regPairs[3]));
regs[3]--;	/* This does happen first, despite what the specs say */
tstates += 1;
ioBus.write(regPairs[1], outitemp, tstates);
tstates += 3;

regPairs[3]++;
outitemp2 = (outitemp + regs[6]) & 0xff;
regs[0] = (outitemp & 0x80 ? 2 : 0) | ( (outitemp2 < outitemp) ? 17 : 0) | (parityTable[ (outitemp2 & 0x07) ^ regs[3] ] ? 4 : 0 ) | sz53Table[ regs[3] ];
	break;case 168:
	
	var bytetemp = (tstates += ( 3), memory.read(regPairs[3]));
regPairs[1]--;
tstates += ( 3);
while (display.nextEventTime != null && display.nextEventTime < tstates) display.doEvent();
memory.write(regPairs[2],bytetemp);;
var originalDE = regPairs[2];
regPairs[2]--; regPairs[3]--;
bytetemp = (bytetemp + regs[1]) & 0xff;
regs[0] = (regs[0] & 193) | (regPairs[1] ? 4 : 0) | (bytetemp & 8) | ((bytetemp & 0x02) ? 32 : 0);
tstates += ( 1);
tstates += ( 1);
	break;case 169:
	
	var value = (tstates += ( 3), memory.read(regPairs[3]));
var bytetemp = (regs[1] - value) & 0xff;
var lookup = ((regs[1] & 0x08) >> 3) | ((value & 0x08) >> 2) | ((bytetemp & 0x08) >> 1);
var originalHL = regPairs[3];
tstates += ( 1);
tstates += ( 1);
tstates += ( 1);
tstates += ( 1);
tstates += ( 1);
regPairs[3]--; regPairs[1]--;
regs[0] = (regs[0] & 1) | (regPairs[1] ? 6 : 2) | halfcarrySubTable[lookup] | (bytetemp ? 0 : 64) | (bytetemp & 128);
if (regs[0] & 16) bytetemp--;
regs[0] |= (bytetemp & 8) | ( (bytetemp & 0x02) ? 32 : 0 );
	break;case 170:
	
	tstates += ( 1);
tstates += 1;
var initemp = ioBus.read(regPairs[1]);
tstates += 3;
tstates += ( 3);
while (display.nextEventTime != null && display.nextEventTime < tstates) display.doEvent();
memory.write(regPairs[3], initemp);;
regs[3]--;
var originalHL = regPairs[3];
regPairs[3]--;
var initemp2 = (initemp + regs[2] - 1) & 0xff;

regs[0] = (initemp & 0x80 ? 2 : 0) | ((initemp2 < initemp) ? 17 : 0 ) | ( parityTable[ (initemp2 & 0x07) ^ regs[3] ] ? 4 : 0 ) | sz53Table[regs[3]];
	break;case 171:
	
	tstates += ( 1);
var outitemp = (tstates += ( 3), memory.read(regPairs[3]));
regs[3]--;	/* This does happen first, despite what the specs say */
tstates += 1;
ioBus.write(regPairs[1], outitemp, tstates);
tstates += 3;

regPairs[3]--;
outitemp2 = (outitemp + regs[6]) & 0xff;
regs[0] = (outitemp & 0x80 ? 2 : 0) | ( (outitemp2 < outitemp) ? 17 : 0) | (parityTable[ (outitemp2 & 0x07) ^ regs[3] ] ? 4 : 0 ) | sz53Table[ regs[3] ];
	break;case 176:
	
	var bytetemp = (tstates += ( 3), memory.read(regPairs[3]));
regPairs[1]--;
tstates += ( 3);
while (display.nextEventTime != null && display.nextEventTime < tstates) display.doEvent();
memory.write(regPairs[2],bytetemp);;
var originalDE = regPairs[2];
regPairs[2]++; regPairs[3]++;
bytetemp = (bytetemp + regs[1]) & 0xff;
regs[0] = (regs[0] & 193) | (regPairs[1] ? 4 : 0) | (bytetemp & 8) | ((bytetemp & 0x02) ? 32 : 0);
tstates += ( 1);
tstates += ( 1);
if (regPairs[1]) {
	regPairs[12]-=2;
	tstates += ( 1);
	tstates += ( 1);
	tstates += ( 1);
	tstates += ( 1);
	tstates += ( 1);
}
	break;case 177:
	
	var value = (tstates += ( 3), memory.read(regPairs[3]));
var bytetemp = (regs[1] - value) & 0xff;
var lookup = ((regs[1] & 0x08) >> 3) | ((value & 0x08) >> 2) | ((bytetemp & 0x08) >> 1);
var originalHL = regPairs[3];
tstates += ( 1);
tstates += ( 1);
tstates += ( 1);
tstates += ( 1);
tstates += ( 1);
regPairs[3]++; regPairs[1]--;
regs[0] = (regs[0] & 1) | (regPairs[1] ? 6 : 2) | halfcarrySubTable[lookup] | (bytetemp ? 0 : 64) | (bytetemp & 128);
if (regs[0] & 16) bytetemp--;
regs[0] |= (bytetemp & 8) | ( (bytetemp & 0x02) ? 32 : 0 );
if ((regs[0] & 68) == 4) {
	regPairs[12] -= 2;
	tstates += ( 1);
	tstates += ( 1);
	tstates += ( 1);
	tstates += ( 1);
	tstates += ( 1);
}
	break;case 178:
	
	tstates += ( 1);
tstates += 1;
var initemp = ioBus.read(regPairs[1]);
tstates += 3;
tstates += ( 3);
while (display.nextEventTime != null && display.nextEventTime < tstates) display.doEvent();
memory.write(regPairs[3], initemp);;
regs[3]--;
var originalHL = regPairs[3];
regPairs[3]++;
var initemp2 = (initemp + regs[2] + 1) & 0xff;

regs[0] = (initemp & 0x80 ? 2 : 0) | ((initemp2 < initemp) ? 17 : 0 ) | ( parityTable[ (initemp2 & 0x07) ^ regs[3] ] ? 4 : 0 ) | sz53Table[regs[3]];
if (regs[3]) {
	tstates += ( 1);
	tstates += ( 1);
	tstates += ( 1);
	tstates += ( 1);
	tstates += ( 1);
	regPairs[12] -= 2;
}
	break;case 179:
	
	tstates += ( 1);
var outitemp = (tstates += ( 3), memory.read(regPairs[3]));
regs[3]--;	/* This does happen first, despite what the specs say */
tstates += 1;
ioBus.write(regPairs[1], outitemp, tstates);
tstates += 3;

regPairs[3]++;
outitemp2 = (outitemp + regs[6]) & 0xff;
regs[0] = (outitemp & 0x80 ? 2 : 0) | ( (outitemp2 < outitemp) ? 17 : 0) | (parityTable[ (outitemp2 & 0x07) ^ regs[3] ] ? 4 : 0 ) | sz53Table[ regs[3] ];
if (regs[3]) {
	regPairs[12]-=2;
	tstates += ( 1);
	tstates += ( 1);
	tstates += ( 1);
	tstates += ( 1);
	tstates += ( 1);
}
	break;case 184:
	
	var bytetemp = (tstates += ( 3), memory.read(regPairs[3]));
regPairs[1]--;
tstates += ( 3);
while (display.nextEventTime != null && display.nextEventTime < tstates) display.doEvent();
memory.write(regPairs[2],bytetemp);;
var originalDE = regPairs[2];
regPairs[2]--; regPairs[3]--;
bytetemp = (bytetemp + regs[1]) & 0xff;
regs[0] = (regs[0] & 193) | (regPairs[1] ? 4 : 0) | (bytetemp & 8) | ((bytetemp & 0x02) ? 32 : 0);
tstates += ( 1);
tstates += ( 1);
if (regPairs[1]) {
	regPairs[12]-=2;
	tstates += ( 1);
	tstates += ( 1);
	tstates += ( 1);
	tstates += ( 1);
	tstates += ( 1);
}
	break;case 185:
	
	var value = (tstates += ( 3), memory.read(regPairs[3]));
var bytetemp = (regs[1] - value) & 0xff;
var lookup = ((regs[1] & 0x08) >> 3) | ((value & 0x08) >> 2) | ((bytetemp & 0x08) >> 1);
var originalHL = regPairs[3];
tstates += ( 1);
tstates += ( 1);
tstates += ( 1);
tstates += ( 1);
tstates += ( 1);
regPairs[3]--; regPairs[1]--;
regs[0] = (regs[0] & 1) | (regPairs[1] ? 6 : 2) | halfcarrySubTable[lookup] | (bytetemp ? 0 : 64) | (bytetemp & 128);
if (regs[0] & 16) bytetemp--;
regs[0] |= (bytetemp & 8) | ( (bytetemp & 0x02) ? 32 : 0 );
if ((regs[0] & 68) == 4) {
	regPairs[12] -= 2;
	tstates += ( 1);
	tstates += ( 1);
	tstates += ( 1);
	tstates += ( 1);
	tstates += ( 1);
}
	break;case 186:
	
	tstates += ( 1);
tstates += 1;
var initemp = ioBus.read(regPairs[1]);
tstates += 3;
tstates += ( 3);
while (display.nextEventTime != null && display.nextEventTime < tstates) display.doEvent();
memory.write(regPairs[3], initemp);;
regs[3]--;
var originalHL = regPairs[3];
regPairs[3]--;
var initemp2 = (initemp + regs[2] - 1) & 0xff;

regs[0] = (initemp & 0x80 ? 2 : 0) | ((initemp2 < initemp) ? 17 : 0 ) | ( parityTable[ (initemp2 & 0x07) ^ regs[3] ] ? 4 : 0 ) | sz53Table[regs[3]];
if (regs[3]) {
	tstates += ( 1);
	tstates += ( 1);
	tstates += ( 1);
	tstates += ( 1);
	tstates += ( 1);
	regPairs[12] -= 2;
}
	break;case 187:
	
	tstates += ( 1);
var outitemp = (tstates += ( 3), memory.read(regPairs[3]));
regs[3]--;	/* This does happen first, despite what the specs say */
tstates += 1;
ioBus.write(regPairs[1], outitemp, tstates);
tstates += 3;

regPairs[3]--;
outitemp2 = (outitemp + regs[6]) & 0xff;
regs[0] = (outitemp & 0x80 ? 2 : 0) | ( (outitemp2 < outitemp) ? 17 : 0) | (parityTable[ (outitemp2 & 0x07) ^ regs[3] ] ? 4 : 0 ) | sz53Table[ regs[3] ];
if (regs[3]) {
	regPairs[12]-=2;
	tstates += ( 1);
	tstates += ( 1);
	tstates += ( 1);
	tstates += ( 1);
	tstates += ( 1);
}
	break;
	default:
		var addr = regPairs[12] - 1;
		throw("Unimplemented opcode " + opcode + " in page ed - PC = " + addr);
}
					break;
				case 'FD':
					tstates += ( 4);
					opcode = memory.read(regPairs[12]); regPairs[12]++;
					regs[20] = ((regs[20] + 1) & 0x7f) | (regs[20] & 0x80);
					switch (opcode) {
	case 0:
	
			
	break;case 1:
	
	var l = (tstates += ( 3), memory.read(regPairs[12])); regPairs[12]++;
var h = (tstates += ( 3), memory.read(regPairs[12])); regPairs[12]++;
regPairs[1] = (h<<8) | l;
	break;case 2:
	
	tstates += ( 3);
while (display.nextEventTime != null && display.nextEventTime < tstates) display.doEvent();
memory.write(regPairs[1], regs[1]);;
	break;case 3:
	
	regPairs[1]++;
tstates += ( 1);
tstates += ( 1);
	break;case 4:
	
	

regs[0] = (regs[0] & 1) | (regs[3] & 0x0f ? 0 : 16) | 2;
regs[3] = (regs[3] + 1) ;


regs[0] = (regs[0] & 1) | ( regs[3] == 0x80 ? 4 : 0 ) | ( regs[3] & 0x0f ? 0 : 16 ) | sz53Table[regs[3]];
	break;case 5:
	
	

regs[0] = (regs[0] & 1 ) | ( regs[3] & 0x0f ? 0 : 16 ) | 2;
regs[3] = (regs[3] - 1) ;


regs[0] |= (regs[3] == 0x7f ? 4 : 0) | sz53Table[regs[3]];
	break;case 6:
	
	regs[3] = (tstates += ( 3), memory.read(regPairs[12])); regPairs[12]++;
	break;case 7:
	
	regs[1] = (regs[1] << 1) | (regs[1] >> 7);
regs[0] = (regs[0] & 196) | (regs[1] & 41);
	break;case 8:
	
	var temp = regPairs[0];
regPairs[0] = regPairs[4];
regPairs[4] = temp;
	break;case 9:
	
	var add16temp = regPairs[9] + regPairs[1];
var lookup = ( (regPairs[9] & 0x0800) >> 11 ) | ( (regPairs[1] & 0x0800) >> 10 ) | ( (add16temp & 0x0800) >>  9 );
regPairs[9] = add16temp;
regs[0] = ( regs[0] & ( 196 ) ) | ( add16temp & 0x10000 ? 1 : 0 ) | ( ( add16temp >> 8 ) & ( 40 ) ) | halfcarryAddTable[lookup];
tstates += ( 1);
tstates += ( 1);
tstates += ( 1);
tstates += ( 1);
tstates += ( 1);
tstates += ( 1);
tstates += ( 1);
	break;case 10:
	
	regs[1] = (tstates += ( 3), memory.read(regPairs[1]));
	break;case 11:
	
	regPairs[1]--;
tstates += ( 1);
tstates += ( 1);
	break;case 12:
	
	

regs[0] = (regs[0] & 1) | (regs[2] & 0x0f ? 0 : 16) | 2;
regs[2] = (regs[2] + 1) ;


regs[0] = (regs[0] & 1) | ( regs[2] == 0x80 ? 4 : 0 ) | ( regs[2] & 0x0f ? 0 : 16 ) | sz53Table[regs[2]];
	break;case 13:
	
	

regs[0] = (regs[0] & 1 ) | ( regs[2] & 0x0f ? 0 : 16 ) | 2;
regs[2] = (regs[2] - 1) ;


regs[0] |= (regs[2] == 0x7f ? 4 : 0) | sz53Table[regs[2]];
	break;case 14:
	
	regs[2] = (tstates += ( 3), memory.read(regPairs[12])); regPairs[12]++;
	break;case 15:
	
	regs[0] = (regs[0] & 196) | (regs[1] & 1);
regs[1] = (regs[1] >> 1) | (regs[1] << 7);
regs[0] |= (regs[1] & 40);
	break;case 16:
	
	tstates += ( 1);
regs[3]--;
if (regs[3]) {
	/* take branch */
	var offset = (tstates += ( 3), memory.read(regPairs[12]));
	tstates += ( 1);
	tstates += ( 1);
	tstates += ( 1);
	tstates += ( 1);
	tstates += ( 1);
	regPairs[12]++;
	regPairs[12] += (offset & 0x80 ? offset - 0x100 : offset);
} else {
	/* do not take branch */
	tstates += ( 3);
	regPairs[12]++;
}
	break;case 17:
	
	var l = (tstates += ( 3), memory.read(regPairs[12])); regPairs[12]++;
var h = (tstates += ( 3), memory.read(regPairs[12])); regPairs[12]++;
regPairs[2] = (h<<8) | l;
	break;case 18:
	
	tstates += ( 3);
while (display.nextEventTime != null && display.nextEventTime < tstates) display.doEvent();
memory.write(regPairs[2], regs[1]);;
	break;case 19:
	
	regPairs[2]++;
tstates += ( 1);
tstates += ( 1);
	break;case 20:
	
	

regs[0] = (regs[0] & 1) | (regs[5] & 0x0f ? 0 : 16) | 2;
regs[5] = (regs[5] + 1) ;


regs[0] = (regs[0] & 1) | ( regs[5] == 0x80 ? 4 : 0 ) | ( regs[5] & 0x0f ? 0 : 16 ) | sz53Table[regs[5]];
	break;case 21:
	
	

regs[0] = (regs[0] & 1 ) | ( regs[5] & 0x0f ? 0 : 16 ) | 2;
regs[5] = (regs[5] - 1) ;


regs[0] |= (regs[5] == 0x7f ? 4 : 0) | sz53Table[regs[5]];
	break;case 22:
	
	regs[5] = (tstates += ( 3), memory.read(regPairs[12])); regPairs[12]++;
	break;case 23:
	
	var bytetemp = regs[1];
regs[1] = (regs[1] << 1) | (regs[0] & 1);
regs[0] = (regs[0] & 196) | (regs[1] & 40) | (bytetemp >> 7);
	break;case 24:
	
	var offset = (tstates += ( 3), memory.read(regPairs[12]));
tstates += ( 1);
tstates += ( 1);
tstates += ( 1);
tstates += ( 1);
tstates += ( 1);
regPairs[12]++;
regPairs[12] += (offset & 0x80 ? offset - 0x100 : offset);
	break;case 25:
	
	var add16temp = regPairs[9] + regPairs[2];
var lookup = ( (regPairs[9] & 0x0800) >> 11 ) | ( (regPairs[2] & 0x0800) >> 10 ) | ( (add16temp & 0x0800) >>  9 );
regPairs[9] = add16temp;
regs[0] = ( regs[0] & ( 196 ) ) | ( add16temp & 0x10000 ? 1 : 0 ) | ( ( add16temp >> 8 ) & ( 40 ) ) | halfcarryAddTable[lookup];
tstates += ( 1);
tstates += ( 1);
tstates += ( 1);
tstates += ( 1);
tstates += ( 1);
tstates += ( 1);
tstates += ( 1);
	break;case 26:
	
	regs[1] = (tstates += ( 3), memory.read(regPairs[2]));
	break;case 27:
	
	regPairs[2]--;
tstates += ( 1);
tstates += ( 1);
	break;case 28:
	
	

regs[0] = (regs[0] & 1) | (regs[4] & 0x0f ? 0 : 16) | 2;
regs[4] = (regs[4] + 1) ;


regs[0] = (regs[0] & 1) | ( regs[4] == 0x80 ? 4 : 0 ) | ( regs[4] & 0x0f ? 0 : 16 ) | sz53Table[regs[4]];
	break;case 29:
	
	

regs[0] = (regs[0] & 1 ) | ( regs[4] & 0x0f ? 0 : 16 ) | 2;
regs[4] = (regs[4] - 1) ;


regs[0] |= (regs[4] == 0x7f ? 4 : 0) | sz53Table[regs[4]];
	break;case 30:
	
	regs[4] = (tstates += ( 3), memory.read(regPairs[12])); regPairs[12]++;
	break;case 31:
	
	var bytetemp = regs[1];
regs[1] = (bytetemp >> 1) | (regs[0] << 7);
regs[0] = (regs[0] & 196) | (regs[1] & 40) | (bytetemp & 1);
	break;case 32:
	
	if (!(regs[0] & 64)) {
	var offset = (tstates += ( 3), memory.read(regPairs[12]));
	tstates += ( 1);
	tstates += ( 1);
	tstates += ( 1);
	tstates += ( 1);
	tstates += ( 1);
	regPairs[12]++;
	regPairs[12] += (offset & 0x80 ? offset - 0x100 : offset);
} else {
	tstates += ( 3);
	regPairs[12]++; /* skip past offset byte */
}
	break;case 33:
	
	var l = (tstates += ( 3), memory.read(regPairs[12])); regPairs[12]++;
var h = (tstates += ( 3), memory.read(regPairs[12])); regPairs[12]++;
regPairs[9] = (h<<8) | l;
	break;case 34:
	
	var l = (tstates += ( 3), memory.read(regPairs[12])); regPairs[12]++;
var h = (tstates += ( 3), memory.read(regPairs[12])); regPairs[12]++;
var addr = (h<<8) | l;
tstates += ( 3);
while (display.nextEventTime != null && display.nextEventTime < tstates) display.doEvent();
memory.write(addr, regPairs[9] & 0xff);;
addr = (addr + 1) & 0xffff;
tstates += ( 3);
while (display.nextEventTime != null && display.nextEventTime < tstates) display.doEvent();
memory.write(addr, regPairs[9] >> 8);;
	break;case 35:
	
	regPairs[9]++;
tstates += ( 1);
tstates += ( 1);
	break;case 36:
	
	

regs[0] = (regs[0] & 1) | (regs[19] & 0x0f ? 0 : 16) | 2;
regs[19] = (regs[19] + 1) ;


regs[0] = (regs[0] & 1) | ( regs[19] == 0x80 ? 4 : 0 ) | ( regs[19] & 0x0f ? 0 : 16 ) | sz53Table[regs[19]];
	break;case 37:
	
	

regs[0] = (regs[0] & 1 ) | ( regs[19] & 0x0f ? 0 : 16 ) | 2;
regs[19] = (regs[19] - 1) ;


regs[0] |= (regs[19] == 0x7f ? 4 : 0) | sz53Table[regs[19]];
	break;case 38:
	
	regs[19] = (tstates += ( 3), memory.read(regPairs[12])); regPairs[12]++;
	break;case 39:
	
	var add = 0;
var carry = regs[0] & 1;
if( ( regs[0] & 16 ) || ( ( regs[1] & 0x0f ) > 9 ) ) add = 6;
if( carry || ( regs[1] > 0x99 ) ) add |= 0x60;
if( regs[1] > 0x99 ) carry = 1;
if( regs[0] & 2 ) {
	
var subtemp = regs[1] - add;
var lookup = ( (regs[1] & 0x88) >> 3 ) | ( (add & 0x88) >> 2 ) | ( (subtemp & 0x88) >> 1 );
regs[1] = subtemp;
regs[0] = ( subtemp & 0x100 ? 1 : 0 ) | 2 | halfcarrySubTable[lookup & 0x07] | overflowSubTable[lookup >> 4] | sz53Table[regs[1]];
} else {
	

var addtemp = regs[1] + add;
var lookup = ( (regs[1] & 0x88) >> 3 ) | ( (add & 0x88) >> 2 ) | ( (addtemp & 0x88) >> 1 );
regs[1] = addtemp;
regs[0] = ( addtemp & 0x100 ? 1 : 0 ) | halfcarryAddTable[lookup & 0x07] | overflowAddTable[lookup >> 4] | sz53Table[regs[1]];
}
regs[0] = ( regs[0] & -6 ) | carry | parityTable[regs[1]];
	break;case 40:
	
	if (regs[0] & 64) {
	var offset = (tstates += ( 3), memory.read(regPairs[12]));
	tstates += ( 1);
	tstates += ( 1);
	tstates += ( 1);
	tstates += ( 1);
	tstates += ( 1);
	regPairs[12]++;
	regPairs[12] += (offset & 0x80 ? offset - 0x100 : offset);
} else {
	tstates += ( 3);
	regPairs[12]++; /* skip past offset byte */
}
	break;case 41:
	
	var add16temp = regPairs[9] + regPairs[9];
var lookup = ( (regPairs[9] & 0x0800) >> 11 ) | ( (regPairs[9] & 0x0800) >> 10 ) | ( (add16temp & 0x0800) >>  9 );
regPairs[9] = add16temp;
regs[0] = ( regs[0] & ( 196 ) ) | ( add16temp & 0x10000 ? 1 : 0 ) | ( ( add16temp >> 8 ) & ( 40 ) ) | halfcarryAddTable[lookup];
tstates += ( 1);
tstates += ( 1);
tstates += ( 1);
tstates += ( 1);
tstates += ( 1);
tstates += ( 1);
tstates += ( 1);
	break;case 42:
	
	var l = (tstates += ( 3), memory.read(regPairs[12])); regPairs[12]++;
var h = (tstates += ( 3), memory.read(regPairs[12])); regPairs[12]++;
var addr = (h<<8) | l;
l = (tstates += ( 3), memory.read(addr));
addr = (addr + 1) & 0xffff;
h = (tstates += ( 3), memory.read(addr));
regPairs[9] = (h<<8) | l;
	break;case 43:
	
	regPairs[9]--;
tstates += ( 1);
tstates += ( 1);
	break;case 44:
	
	

regs[0] = (regs[0] & 1) | (regs[18] & 0x0f ? 0 : 16) | 2;
regs[18] = (regs[18] + 1) ;


regs[0] = (regs[0] & 1) | ( regs[18] == 0x80 ? 4 : 0 ) | ( regs[18] & 0x0f ? 0 : 16 ) | sz53Table[regs[18]];
	break;case 45:
	
	

regs[0] = (regs[0] & 1 ) | ( regs[18] & 0x0f ? 0 : 16 ) | 2;
regs[18] = (regs[18] - 1) ;


regs[0] |= (regs[18] == 0x7f ? 4 : 0) | sz53Table[regs[18]];
	break;case 46:
	
	regs[18] = (tstates += ( 3), memory.read(regPairs[12])); regPairs[12]++;
	break;case 47:
	
	regs[1] ^= 0xff;
regs[0] = (regs[0] & 197) | (regs[1] & 40) | 18;
	break;case 48:
	
	if (!(regs[0] & 1)) {
	var offset = (tstates += ( 3), memory.read(regPairs[12]));
	tstates += ( 1);
	tstates += ( 1);
	tstates += ( 1);
	tstates += ( 1);
	tstates += ( 1);
	regPairs[12]++;
	regPairs[12] += (offset & 0x80 ? offset - 0x100 : offset);
} else {
	tstates += ( 3);
	regPairs[12]++; /* skip past offset byte */
}
	break;case 49:
	
	var l = (tstates += ( 3), memory.read(regPairs[12])); regPairs[12]++;
var h = (tstates += ( 3), memory.read(regPairs[12])); regPairs[12]++;
regPairs[11] = (h<<8) | l;
	break;case 50:
	
	var l = (tstates += ( 3), memory.read(regPairs[12])); regPairs[12]++;
var h = (tstates += ( 3), memory.read(regPairs[12])); regPairs[12]++;
var addr = (h<<8) | l;
tstates += ( 3);
while (display.nextEventTime != null && display.nextEventTime < tstates) display.doEvent();
memory.write(addr, regs[1]);;
	break;case 51:
	
	regPairs[11]++;
tstates += ( 1);
tstates += ( 1);
	break;case 52:
	
	var offset = (tstates += ( 3), memory.read(regPairs[12]));
if (offset & 0x80) offset -= 0x100;
tstates += ( 1);
tstates += ( 1);
tstates += ( 1);
tstates += ( 1);
tstates += ( 1);
regPairs[12]++;var addr = (regPairs[9] + offset) & 0xffff;
var val = (tstates += ( 3), memory.read(addr));

regs[0] = (regs[0] & 1) | (val & 0x0f ? 0 : 16) | 2;
val = (val + 1) & 0xff;

tstates += ( 1);
tstates += ( 3);
while (display.nextEventTime != null && display.nextEventTime < tstates) display.doEvent();
memory.write(addr, val);;
regs[0] = (regs[0] & 1) | ( val == 0x80 ? 4 : 0 ) | ( val & 0x0f ? 0 : 16 ) | sz53Table[val];
	break;case 53:
	
	var offset = (tstates += ( 3), memory.read(regPairs[12]));
if (offset & 0x80) offset -= 0x100;
tstates += ( 1);
tstates += ( 1);
tstates += ( 1);
tstates += ( 1);
tstates += ( 1);
regPairs[12]++;var addr = (regPairs[9] + offset) & 0xffff;
var val = (tstates += ( 3), memory.read(addr));

regs[0] = (regs[0] & 1 ) | ( val & 0x0f ? 0 : 16 ) | 2;
val = (val - 1) & 0xff;

tstates += ( 1);
tstates += ( 3);
while (display.nextEventTime != null && display.nextEventTime < tstates) display.doEvent();
memory.write(addr, val);;
regs[0] |= (val == 0x7f ? 4 : 0) | sz53Table[val];
	break;case 54:
	
	var offset = (tstates += ( 3), memory.read(regPairs[12])); regPairs[12]++;
if (offset & 0x80) offset -= 0x100;
var addr = (regPairs[9] + offset) & 0xffff;

var val = (tstates += ( 3), memory.read(regPairs[12]));
tstates += ( 1);
tstates += ( 1);
regPairs[12]++;
tstates += ( 3);
while (display.nextEventTime != null && display.nextEventTime < tstates) display.doEvent();
memory.write(addr, val);;
	break;case 55:
	
	regs[0] = (regs[0] & 196) | (regs[1] & 40) | 1;
	break;case 56:
	
	if (regs[0] & 1) {
	var offset = (tstates += ( 3), memory.read(regPairs[12]));
	tstates += ( 1);
	tstates += ( 1);
	tstates += ( 1);
	tstates += ( 1);
	tstates += ( 1);
	regPairs[12]++;
	regPairs[12] += (offset & 0x80 ? offset - 0x100 : offset);
} else {
	tstates += ( 3);
	regPairs[12]++; /* skip past offset byte */
}
	break;case 57:
	
	var add16temp = regPairs[9] + regPairs[11];
var lookup = ( (regPairs[9] & 0x0800) >> 11 ) | ( (regPairs[11] & 0x0800) >> 10 ) | ( (add16temp & 0x0800) >>  9 );
regPairs[9] = add16temp;
regs[0] = ( regs[0] & ( 196 ) ) | ( add16temp & 0x10000 ? 1 : 0 ) | ( ( add16temp >> 8 ) & ( 40 ) ) | halfcarryAddTable[lookup];
tstates += ( 1);
tstates += ( 1);
tstates += ( 1);
tstates += ( 1);
tstates += ( 1);
tstates += ( 1);
tstates += ( 1);
	break;case 58:
	
	var l = (tstates += ( 3), memory.read(regPairs[12])); regPairs[12]++;
var h = (tstates += ( 3), memory.read(regPairs[12])); regPairs[12]++;
var addr = (h<<8) | l;
regs[1] = (tstates += ( 3), memory.read(addr));
	break;case 59:
	
	regPairs[11]--;
tstates += ( 1);
tstates += ( 1);
	break;case 60:
	
	

regs[0] = (regs[0] & 1) | (regs[1] & 0x0f ? 0 : 16) | 2;
regs[1] = (regs[1] + 1) ;


regs[0] = (regs[0] & 1) | ( regs[1] == 0x80 ? 4 : 0 ) | ( regs[1] & 0x0f ? 0 : 16 ) | sz53Table[regs[1]];
	break;case 61:
	
	

regs[0] = (regs[0] & 1 ) | ( regs[1] & 0x0f ? 0 : 16 ) | 2;
regs[1] = (regs[1] - 1) ;


regs[0] |= (regs[1] == 0x7f ? 4 : 0) | sz53Table[regs[1]];
	break;case 62:
	
	regs[1] = (tstates += ( 3), memory.read(regPairs[12])); regPairs[12]++;
	break;case 63:
	
	regs[0] = ( regs[0] & 196 ) | ( (regs[0] & 1) ? 16 : 1 ) | ( regs[1] & 40 );
	break;case 64:
	
	regs[3] = regs[3];
	break;case 65:
	
	regs[3] = regs[2];
	break;case 66:
	
	regs[3] = regs[5];
	break;case 67:
	
	regs[3] = regs[4];
	break;case 68:
	
	regs[3] = regs[19];
	break;case 69:
	
	regs[3] = regs[18];
	break;case 70:
	
	var offset = (tstates += ( 3), memory.read(regPairs[12]));
tstates += ( 1);
tstates += ( 1);
tstates += ( 1);
tstates += ( 1);
tstates += ( 1);
regPairs[12]++;
if (offset & 0x80) offset -= 0x100;
var addr = (regPairs[9] + offset) & 0xffff;

regs[3] = (tstates += ( 3), memory.read(addr));
	break;case 71:
	
	regs[3] = regs[1];
	break;case 72:
	
	regs[2] = regs[3];
	break;case 73:
	
	regs[2] = regs[2];
	break;case 74:
	
	regs[2] = regs[5];
	break;case 75:
	
	regs[2] = regs[4];
	break;case 76:
	
	regs[2] = regs[19];
	break;case 77:
	
	regs[2] = regs[18];
	break;case 78:
	
	var offset = (tstates += ( 3), memory.read(regPairs[12]));
tstates += ( 1);
tstates += ( 1);
tstates += ( 1);
tstates += ( 1);
tstates += ( 1);
regPairs[12]++;
if (offset & 0x80) offset -= 0x100;
var addr = (regPairs[9] + offset) & 0xffff;

regs[2] = (tstates += ( 3), memory.read(addr));
	break;case 79:
	
	regs[2] = regs[1];
	break;case 80:
	
	regs[5] = regs[3];
	break;case 81:
	
	regs[5] = regs[2];
	break;case 82:
	
	regs[5] = regs[5];
	break;case 83:
	
	regs[5] = regs[4];
	break;case 84:
	
	regs[5] = regs[19];
	break;case 85:
	
	regs[5] = regs[18];
	break;case 86:
	
	var offset = (tstates += ( 3), memory.read(regPairs[12]));
tstates += ( 1);
tstates += ( 1);
tstates += ( 1);
tstates += ( 1);
tstates += ( 1);
regPairs[12]++;
if (offset & 0x80) offset -= 0x100;
var addr = (regPairs[9] + offset) & 0xffff;

regs[5] = (tstates += ( 3), memory.read(addr));
	break;case 87:
	
	regs[5] = regs[1];
	break;case 88:
	
	regs[4] = regs[3];
	break;case 89:
	
	regs[4] = regs[2];
	break;case 90:
	
	regs[4] = regs[5];
	break;case 91:
	
	regs[4] = regs[4];
	break;case 92:
	
	regs[4] = regs[19];
	break;case 93:
	
	regs[4] = regs[18];
	break;case 94:
	
	var offset = (tstates += ( 3), memory.read(regPairs[12]));
tstates += ( 1);
tstates += ( 1);
tstates += ( 1);
tstates += ( 1);
tstates += ( 1);
regPairs[12]++;
if (offset & 0x80) offset -= 0x100;
var addr = (regPairs[9] + offset) & 0xffff;

regs[4] = (tstates += ( 3), memory.read(addr));
	break;case 95:
	
	regs[4] = regs[1];
	break;case 96:
	
	regs[19] = regs[3];
	break;case 97:
	
	regs[19] = regs[2];
	break;case 98:
	
	regs[19] = regs[5];
	break;case 99:
	
	regs[19] = regs[4];
	break;case 100:
	
	regs[19] = regs[19];
	break;case 101:
	
	regs[19] = regs[18];
	break;case 102:
	
	var offset = (tstates += ( 3), memory.read(regPairs[12]));
tstates += ( 1);
tstates += ( 1);
tstates += ( 1);
tstates += ( 1);
tstates += ( 1);
regPairs[12]++;
if (offset & 0x80) offset -= 0x100;
var addr = (regPairs[9] + offset) & 0xffff;

regs[7] = (tstates += ( 3), memory.read(addr));
	break;case 103:
	
	regs[19] = regs[1];
	break;case 104:
	
	regs[18] = regs[3];
	break;case 105:
	
	regs[18] = regs[2];
	break;case 106:
	
	regs[18] = regs[5];
	break;case 107:
	
	regs[18] = regs[4];
	break;case 108:
	
	regs[18] = regs[19];
	break;case 109:
	
	regs[18] = regs[18];
	break;case 110:
	
	var offset = (tstates += ( 3), memory.read(regPairs[12]));
tstates += ( 1);
tstates += ( 1);
tstates += ( 1);
tstates += ( 1);
tstates += ( 1);
regPairs[12]++;
if (offset & 0x80) offset -= 0x100;
var addr = (regPairs[9] + offset) & 0xffff;

regs[6] = (tstates += ( 3), memory.read(addr));
	break;case 111:
	
	regs[18] = regs[1];
	break;case 112:
	
	var offset = (tstates += ( 3), memory.read(regPairs[12]));
tstates += ( 1);
tstates += ( 1);
tstates += ( 1);
tstates += ( 1);
tstates += ( 1);
regPairs[12]++;
if (offset & 0x80) offset -= 0x100;
var addr = (regPairs[9] + offset) & 0xffff;

tstates += ( 3);
while (display.nextEventTime != null && display.nextEventTime < tstates) display.doEvent();
memory.write(addr, regs[3]);;
	break;case 113:
	
	var offset = (tstates += ( 3), memory.read(regPairs[12]));
tstates += ( 1);
tstates += ( 1);
tstates += ( 1);
tstates += ( 1);
tstates += ( 1);
regPairs[12]++;
if (offset & 0x80) offset -= 0x100;
var addr = (regPairs[9] + offset) & 0xffff;

tstates += ( 3);
while (display.nextEventTime != null && display.nextEventTime < tstates) display.doEvent();
memory.write(addr, regs[2]);;
	break;case 114:
	
	var offset = (tstates += ( 3), memory.read(regPairs[12]));
tstates += ( 1);
tstates += ( 1);
tstates += ( 1);
tstates += ( 1);
tstates += ( 1);
regPairs[12]++;
if (offset & 0x80) offset -= 0x100;
var addr = (regPairs[9] + offset) & 0xffff;

tstates += ( 3);
while (display.nextEventTime != null && display.nextEventTime < tstates) display.doEvent();
memory.write(addr, regs[5]);;
	break;case 115:
	
	var offset = (tstates += ( 3), memory.read(regPairs[12]));
tstates += ( 1);
tstates += ( 1);
tstates += ( 1);
tstates += ( 1);
tstates += ( 1);
regPairs[12]++;
if (offset & 0x80) offset -= 0x100;
var addr = (regPairs[9] + offset) & 0xffff;

tstates += ( 3);
while (display.nextEventTime != null && display.nextEventTime < tstates) display.doEvent();
memory.write(addr, regs[4]);;
	break;case 116:
	
	var offset = (tstates += ( 3), memory.read(regPairs[12]));
tstates += ( 1);
tstates += ( 1);
tstates += ( 1);
tstates += ( 1);
tstates += ( 1);
regPairs[12]++;
if (offset & 0x80) offset -= 0x100;
var addr = (regPairs[9] + offset) & 0xffff;

tstates += ( 3);
while (display.nextEventTime != null && display.nextEventTime < tstates) display.doEvent();
memory.write(addr, regs[7]);;
	break;case 117:
	
	var offset = (tstates += ( 3), memory.read(regPairs[12]));
tstates += ( 1);
tstates += ( 1);
tstates += ( 1);
tstates += ( 1);
tstates += ( 1);
regPairs[12]++;
if (offset & 0x80) offset -= 0x100;
var addr = (regPairs[9] + offset) & 0xffff;

tstates += ( 3);
while (display.nextEventTime != null && display.nextEventTime < tstates) display.doEvent();
memory.write(addr, regs[6]);;
	break;case 118:
	
	halted = true;
regPairs[12]--;
	break;case 119:
	
	var offset = (tstates += ( 3), memory.read(regPairs[12]));
tstates += ( 1);
tstates += ( 1);
tstates += ( 1);
tstates += ( 1);
tstates += ( 1);
regPairs[12]++;
if (offset & 0x80) offset -= 0x100;
var addr = (regPairs[9] + offset) & 0xffff;

tstates += ( 3);
while (display.nextEventTime != null && display.nextEventTime < tstates) display.doEvent();
memory.write(addr, regs[1]);;
	break;case 120:
	
	regs[1] = regs[3];
	break;case 121:
	
	regs[1] = regs[2];
	break;case 122:
	
	regs[1] = regs[5];
	break;case 123:
	
	regs[1] = regs[4];
	break;case 124:
	
	regs[1] = regs[19];
	break;case 125:
	
	regs[1] = regs[18];
	break;case 126:
	
	var offset = (tstates += ( 3), memory.read(regPairs[12]));
tstates += ( 1);
tstates += ( 1);
tstates += ( 1);
tstates += ( 1);
tstates += ( 1);
regPairs[12]++;
if (offset & 0x80) offset -= 0x100;
var addr = (regPairs[9] + offset) & 0xffff;

regs[1] = (tstates += ( 3), memory.read(addr));
	break;case 127:
	
	regs[1] = regs[1];
	break;case 128:
	
	

var addtemp = regs[1] + regs[3];
var lookup = ( (regs[1] & 0x88) >> 3 ) | ( (regs[3] & 0x88) >> 2 ) | ( (addtemp & 0x88) >> 1 );
regs[1] = addtemp;
regs[0] = ( addtemp & 0x100 ? 1 : 0 ) | halfcarryAddTable[lookup & 0x07] | overflowAddTable[lookup >> 4] | sz53Table[regs[1]];
	break;case 129:
	
	

var addtemp = regs[1] + regs[2];
var lookup = ( (regs[1] & 0x88) >> 3 ) | ( (regs[2] & 0x88) >> 2 ) | ( (addtemp & 0x88) >> 1 );
regs[1] = addtemp;
regs[0] = ( addtemp & 0x100 ? 1 : 0 ) | halfcarryAddTable[lookup & 0x07] | overflowAddTable[lookup >> 4] | sz53Table[regs[1]];
	break;case 130:
	
	

var addtemp = regs[1] + regs[5];
var lookup = ( (regs[1] & 0x88) >> 3 ) | ( (regs[5] & 0x88) >> 2 ) | ( (addtemp & 0x88) >> 1 );
regs[1] = addtemp;
regs[0] = ( addtemp & 0x100 ? 1 : 0 ) | halfcarryAddTable[lookup & 0x07] | overflowAddTable[lookup >> 4] | sz53Table[regs[1]];
	break;case 131:
	
	

var addtemp = regs[1] + regs[4];
var lookup = ( (regs[1] & 0x88) >> 3 ) | ( (regs[4] & 0x88) >> 2 ) | ( (addtemp & 0x88) >> 1 );
regs[1] = addtemp;
regs[0] = ( addtemp & 0x100 ? 1 : 0 ) | halfcarryAddTable[lookup & 0x07] | overflowAddTable[lookup >> 4] | sz53Table[regs[1]];
	break;case 132:
	
	

var addtemp = regs[1] + regs[19];
var lookup = ( (regs[1] & 0x88) >> 3 ) | ( (regs[19] & 0x88) >> 2 ) | ( (addtemp & 0x88) >> 1 );
regs[1] = addtemp;
regs[0] = ( addtemp & 0x100 ? 1 : 0 ) | halfcarryAddTable[lookup & 0x07] | overflowAddTable[lookup >> 4] | sz53Table[regs[1]];
	break;case 133:
	
	

var addtemp = regs[1] + regs[18];
var lookup = ( (regs[1] & 0x88) >> 3 ) | ( (regs[18] & 0x88) >> 2 ) | ( (addtemp & 0x88) >> 1 );
regs[1] = addtemp;
regs[0] = ( addtemp & 0x100 ? 1 : 0 ) | halfcarryAddTable[lookup & 0x07] | overflowAddTable[lookup >> 4] | sz53Table[regs[1]];
	break;case 134:
	
	var offset = (tstates += ( 3), memory.read(regPairs[12]));
if (offset & 0x80) offset -= 0x100;
tstates += ( 1);
tstates += ( 1);
tstates += ( 1);
tstates += ( 1);
tstates += ( 1);
regPairs[12]++;var addr = (regPairs[9] + offset) & 0xffff;
var val = (tstates += ( 3), memory.read(addr));

var addtemp = regs[1] + val;
var lookup = ( (regs[1] & 0x88) >> 3 ) | ( (val & 0x88) >> 2 ) | ( (addtemp & 0x88) >> 1 );
regs[1] = addtemp;
regs[0] = ( addtemp & 0x100 ? 1 : 0 ) | halfcarryAddTable[lookup & 0x07] | overflowAddTable[lookup >> 4] | sz53Table[regs[1]];
	break;case 135:
	
	

var addtemp = regs[1] + regs[1];
var lookup = ( (regs[1] & 0x88) >> 3 ) | ( (regs[1] & 0x88) >> 2 ) | ( (addtemp & 0x88) >> 1 );
regs[1] = addtemp;
regs[0] = ( addtemp & 0x100 ? 1 : 0 ) | halfcarryAddTable[lookup & 0x07] | overflowAddTable[lookup >> 4] | sz53Table[regs[1]];
	break;case 136:
	
	

var adctemp = regs[1] + regs[3] + (regs[0] & 1);
var lookup = ( (regs[1] & 0x88) >> 3 ) | ( (regs[3] & 0x88) >> 2 ) | ( (adctemp & 0x88) >> 1 );
regs[1] = adctemp;
regs[0] = ( adctemp & 0x100 ? 1 : 0 ) | halfcarryAddTable[lookup & 0x07] | overflowAddTable[lookup >> 4] | sz53Table[regs[1]];
	break;case 137:
	
	

var adctemp = regs[1] + regs[2] + (regs[0] & 1);
var lookup = ( (regs[1] & 0x88) >> 3 ) | ( (regs[2] & 0x88) >> 2 ) | ( (adctemp & 0x88) >> 1 );
regs[1] = adctemp;
regs[0] = ( adctemp & 0x100 ? 1 : 0 ) | halfcarryAddTable[lookup & 0x07] | overflowAddTable[lookup >> 4] | sz53Table[regs[1]];
	break;case 138:
	
	

var adctemp = regs[1] + regs[5] + (regs[0] & 1);
var lookup = ( (regs[1] & 0x88) >> 3 ) | ( (regs[5] & 0x88) >> 2 ) | ( (adctemp & 0x88) >> 1 );
regs[1] = adctemp;
regs[0] = ( adctemp & 0x100 ? 1 : 0 ) | halfcarryAddTable[lookup & 0x07] | overflowAddTable[lookup >> 4] | sz53Table[regs[1]];
	break;case 139:
	
	

var adctemp = regs[1] + regs[4] + (regs[0] & 1);
var lookup = ( (regs[1] & 0x88) >> 3 ) | ( (regs[4] & 0x88) >> 2 ) | ( (adctemp & 0x88) >> 1 );
regs[1] = adctemp;
regs[0] = ( adctemp & 0x100 ? 1 : 0 ) | halfcarryAddTable[lookup & 0x07] | overflowAddTable[lookup >> 4] | sz53Table[regs[1]];
	break;case 140:
	
	

var adctemp = regs[1] + regs[19] + (regs[0] & 1);
var lookup = ( (regs[1] & 0x88) >> 3 ) | ( (regs[19] & 0x88) >> 2 ) | ( (adctemp & 0x88) >> 1 );
regs[1] = adctemp;
regs[0] = ( adctemp & 0x100 ? 1 : 0 ) | halfcarryAddTable[lookup & 0x07] | overflowAddTable[lookup >> 4] | sz53Table[regs[1]];
	break;case 141:
	
	

var adctemp = regs[1] + regs[18] + (regs[0] & 1);
var lookup = ( (regs[1] & 0x88) >> 3 ) | ( (regs[18] & 0x88) >> 2 ) | ( (adctemp & 0x88) >> 1 );
regs[1] = adctemp;
regs[0] = ( adctemp & 0x100 ? 1 : 0 ) | halfcarryAddTable[lookup & 0x07] | overflowAddTable[lookup >> 4] | sz53Table[regs[1]];
	break;case 142:
	
	var offset = (tstates += ( 3), memory.read(regPairs[12]));
if (offset & 0x80) offset -= 0x100;
tstates += ( 1);
tstates += ( 1);
tstates += ( 1);
tstates += ( 1);
tstates += ( 1);
regPairs[12]++;var addr = (regPairs[9] + offset) & 0xffff;
var val = (tstates += ( 3), memory.read(addr));

var adctemp = regs[1] + val + (regs[0] & 1);
var lookup = ( (regs[1] & 0x88) >> 3 ) | ( (val & 0x88) >> 2 ) | ( (adctemp & 0x88) >> 1 );
regs[1] = adctemp;
regs[0] = ( adctemp & 0x100 ? 1 : 0 ) | halfcarryAddTable[lookup & 0x07] | overflowAddTable[lookup >> 4] | sz53Table[regs[1]];
	break;case 143:
	
	

var adctemp = regs[1] + regs[1] + (regs[0] & 1);
var lookup = ( (regs[1] & 0x88) >> 3 ) | ( (regs[1] & 0x88) >> 2 ) | ( (adctemp & 0x88) >> 1 );
regs[1] = adctemp;
regs[0] = ( adctemp & 0x100 ? 1 : 0 ) | halfcarryAddTable[lookup & 0x07] | overflowAddTable[lookup >> 4] | sz53Table[regs[1]];
	break;case 144:
	
	
var subtemp = regs[1] - regs[3];
var lookup = ( (regs[1] & 0x88) >> 3 ) | ( (regs[3] & 0x88) >> 2 ) | ( (subtemp & 0x88) >> 1 );
regs[1] = subtemp;
regs[0] = ( subtemp & 0x100 ? 1 : 0 ) | 2 | halfcarrySubTable[lookup & 0x07] | overflowSubTable[lookup >> 4] | sz53Table[regs[1]];
	break;case 145:
	
	
var subtemp = regs[1] - regs[2];
var lookup = ( (regs[1] & 0x88) >> 3 ) | ( (regs[2] & 0x88) >> 2 ) | ( (subtemp & 0x88) >> 1 );
regs[1] = subtemp;
regs[0] = ( subtemp & 0x100 ? 1 : 0 ) | 2 | halfcarrySubTable[lookup & 0x07] | overflowSubTable[lookup >> 4] | sz53Table[regs[1]];
	break;case 146:
	
	
var subtemp = regs[1] - regs[5];
var lookup = ( (regs[1] & 0x88) >> 3 ) | ( (regs[5] & 0x88) >> 2 ) | ( (subtemp & 0x88) >> 1 );
regs[1] = subtemp;
regs[0] = ( subtemp & 0x100 ? 1 : 0 ) | 2 | halfcarrySubTable[lookup & 0x07] | overflowSubTable[lookup >> 4] | sz53Table[regs[1]];
	break;case 147:
	
	
var subtemp = regs[1] - regs[4];
var lookup = ( (regs[1] & 0x88) >> 3 ) | ( (regs[4] & 0x88) >> 2 ) | ( (subtemp & 0x88) >> 1 );
regs[1] = subtemp;
regs[0] = ( subtemp & 0x100 ? 1 : 0 ) | 2 | halfcarrySubTable[lookup & 0x07] | overflowSubTable[lookup >> 4] | sz53Table[regs[1]];
	break;case 148:
	
	
var subtemp = regs[1] - regs[19];
var lookup = ( (regs[1] & 0x88) >> 3 ) | ( (regs[19] & 0x88) >> 2 ) | ( (subtemp & 0x88) >> 1 );
regs[1] = subtemp;
regs[0] = ( subtemp & 0x100 ? 1 : 0 ) | 2 | halfcarrySubTable[lookup & 0x07] | overflowSubTable[lookup >> 4] | sz53Table[regs[1]];
	break;case 149:
	
	
var subtemp = regs[1] - regs[18];
var lookup = ( (regs[1] & 0x88) >> 3 ) | ( (regs[18] & 0x88) >> 2 ) | ( (subtemp & 0x88) >> 1 );
regs[1] = subtemp;
regs[0] = ( subtemp & 0x100 ? 1 : 0 ) | 2 | halfcarrySubTable[lookup & 0x07] | overflowSubTable[lookup >> 4] | sz53Table[regs[1]];
	break;case 150:
	
	var offset = (tstates += ( 3), memory.read(regPairs[12]));
if (offset & 0x80) offset -= 0x100;
tstates += ( 1);
tstates += ( 1);
tstates += ( 1);
tstates += ( 1);
tstates += ( 1);
regPairs[12]++;var addr = (regPairs[9] + offset) & 0xffff;
var val = (tstates += ( 3), memory.read(addr));
var subtemp = regs[1] - val;
var lookup = ( (regs[1] & 0x88) >> 3 ) | ( (val & 0x88) >> 2 ) | ( (subtemp & 0x88) >> 1 );
regs[1] = subtemp;
regs[0] = ( subtemp & 0x100 ? 1 : 0 ) | 2 | halfcarrySubTable[lookup & 0x07] | overflowSubTable[lookup >> 4] | sz53Table[regs[1]];
	break;case 151:
	
	
var subtemp = regs[1] - regs[1];
var lookup = ( (regs[1] & 0x88) >> 3 ) | ( (regs[1] & 0x88) >> 2 ) | ( (subtemp & 0x88) >> 1 );
regs[1] = subtemp;
regs[0] = ( subtemp & 0x100 ? 1 : 0 ) | 2 | halfcarrySubTable[lookup & 0x07] | overflowSubTable[lookup >> 4] | sz53Table[regs[1]];
	break;case 152:
	
	
var sbctemp = regs[1] - regs[3] - (regs[0] & 1);
var lookup = ( (regs[1] & 0x88) >> 3 ) | ( (regs[3] & 0x88) >> 2 ) | ( (sbctemp & 0x88) >> 1 );
regs[1] = sbctemp;
regs[0] = ( sbctemp & 0x100 ? 1 : 0 ) | 2 | halfcarrySubTable[lookup & 0x07] | overflowSubTable[lookup >> 4] | sz53Table[regs[1]];
	break;case 153:
	
	
var sbctemp = regs[1] - regs[2] - (regs[0] & 1);
var lookup = ( (regs[1] & 0x88) >> 3 ) | ( (regs[2] & 0x88) >> 2 ) | ( (sbctemp & 0x88) >> 1 );
regs[1] = sbctemp;
regs[0] = ( sbctemp & 0x100 ? 1 : 0 ) | 2 | halfcarrySubTable[lookup & 0x07] | overflowSubTable[lookup >> 4] | sz53Table[regs[1]];
	break;case 154:
	
	
var sbctemp = regs[1] - regs[5] - (regs[0] & 1);
var lookup = ( (regs[1] & 0x88) >> 3 ) | ( (regs[5] & 0x88) >> 2 ) | ( (sbctemp & 0x88) >> 1 );
regs[1] = sbctemp;
regs[0] = ( sbctemp & 0x100 ? 1 : 0 ) | 2 | halfcarrySubTable[lookup & 0x07] | overflowSubTable[lookup >> 4] | sz53Table[regs[1]];
	break;case 155:
	
	
var sbctemp = regs[1] - regs[4] - (regs[0] & 1);
var lookup = ( (regs[1] & 0x88) >> 3 ) | ( (regs[4] & 0x88) >> 2 ) | ( (sbctemp & 0x88) >> 1 );
regs[1] = sbctemp;
regs[0] = ( sbctemp & 0x100 ? 1 : 0 ) | 2 | halfcarrySubTable[lookup & 0x07] | overflowSubTable[lookup >> 4] | sz53Table[regs[1]];
	break;case 156:
	
	
var sbctemp = regs[1] - regs[19] - (regs[0] & 1);
var lookup = ( (regs[1] & 0x88) >> 3 ) | ( (regs[19] & 0x88) >> 2 ) | ( (sbctemp & 0x88) >> 1 );
regs[1] = sbctemp;
regs[0] = ( sbctemp & 0x100 ? 1 : 0 ) | 2 | halfcarrySubTable[lookup & 0x07] | overflowSubTable[lookup >> 4] | sz53Table[regs[1]];
	break;case 157:
	
	
var sbctemp = regs[1] - regs[18] - (regs[0] & 1);
var lookup = ( (regs[1] & 0x88) >> 3 ) | ( (regs[18] & 0x88) >> 2 ) | ( (sbctemp & 0x88) >> 1 );
regs[1] = sbctemp;
regs[0] = ( sbctemp & 0x100 ? 1 : 0 ) | 2 | halfcarrySubTable[lookup & 0x07] | overflowSubTable[lookup >> 4] | sz53Table[regs[1]];
	break;case 158:
	
	var offset = (tstates += ( 3), memory.read(regPairs[12]));
if (offset & 0x80) offset -= 0x100;
tstates += ( 1);
tstates += ( 1);
tstates += ( 1);
tstates += ( 1);
tstates += ( 1);
regPairs[12]++;var addr = (regPairs[9] + offset) & 0xffff;
var val = (tstates += ( 3), memory.read(addr));
var sbctemp = regs[1] - val - (regs[0] & 1);
var lookup = ( (regs[1] & 0x88) >> 3 ) | ( (val & 0x88) >> 2 ) | ( (sbctemp & 0x88) >> 1 );
regs[1] = sbctemp;
regs[0] = ( sbctemp & 0x100 ? 1 : 0 ) | 2 | halfcarrySubTable[lookup & 0x07] | overflowSubTable[lookup >> 4] | sz53Table[regs[1]];
	break;case 159:
	
	
var sbctemp = regs[1] - regs[1] - (regs[0] & 1);
var lookup = ( (regs[1] & 0x88) >> 3 ) | ( (regs[1] & 0x88) >> 2 ) | ( (sbctemp & 0x88) >> 1 );
regs[1] = sbctemp;
regs[0] = ( sbctemp & 0x100 ? 1 : 0 ) | 2 | halfcarrySubTable[lookup & 0x07] | overflowSubTable[lookup >> 4] | sz53Table[regs[1]];
	break;case 160:
	
	

regs[1] &= regs[3];
regs[0] = 16 | sz53pTable[regs[1]];
	break;case 161:
	
	

regs[1] &= regs[2];
regs[0] = 16 | sz53pTable[regs[1]];
	break;case 162:
	
	

regs[1] &= regs[5];
regs[0] = 16 | sz53pTable[regs[1]];
	break;case 163:
	
	

regs[1] &= regs[4];
regs[0] = 16 | sz53pTable[regs[1]];
	break;case 164:
	
	

regs[1] &= regs[19];
regs[0] = 16 | sz53pTable[regs[1]];
	break;case 165:
	
	

regs[1] &= regs[18];
regs[0] = 16 | sz53pTable[regs[1]];
	break;case 166:
	
	var offset = (tstates += ( 3), memory.read(regPairs[12]));
if (offset & 0x80) offset -= 0x100;
tstates += ( 1);
tstates += ( 1);
tstates += ( 1);
tstates += ( 1);
tstates += ( 1);
regPairs[12]++;var addr = (regPairs[9] + offset) & 0xffff;
var val = (tstates += ( 3), memory.read(addr));

regs[1] &= val;
regs[0] = 16 | sz53pTable[regs[1]];
	break;case 167:
	
	

regs[1] &= regs[1];
regs[0] = 16 | sz53pTable[regs[1]];
	break;case 168:
	
	
regs[1] ^= regs[3];
regs[0] = sz53pTable[regs[1]];
	break;case 169:
	
	
regs[1] ^= regs[2];
regs[0] = sz53pTable[regs[1]];
	break;case 170:
	
	
regs[1] ^= regs[5];
regs[0] = sz53pTable[regs[1]];
	break;case 171:
	
	
regs[1] ^= regs[4];
regs[0] = sz53pTable[regs[1]];
	break;case 172:
	
	
regs[1] ^= regs[19];
regs[0] = sz53pTable[regs[1]];
	break;case 173:
	
	
regs[1] ^= regs[18];
regs[0] = sz53pTable[regs[1]];
	break;case 174:
	
	var offset = (tstates += ( 3), memory.read(regPairs[12]));
if (offset & 0x80) offset -= 0x100;
tstates += ( 1);
tstates += ( 1);
tstates += ( 1);
tstates += ( 1);
tstates += ( 1);
regPairs[12]++;var addr = (regPairs[9] + offset) & 0xffff;
var val = (tstates += ( 3), memory.read(addr));
regs[1] ^= val;
regs[0] = sz53pTable[regs[1]];
	break;case 175:
	
	
regs[1] ^= regs[1];
regs[0] = sz53pTable[regs[1]];
	break;case 176:
	
	

regs[1] |= regs[3];
regs[0] = sz53pTable[regs[1]];
	break;case 177:
	
	

regs[1] |= regs[2];
regs[0] = sz53pTable[regs[1]];
	break;case 178:
	
	

regs[1] |= regs[5];
regs[0] = sz53pTable[regs[1]];
	break;case 179:
	
	

regs[1] |= regs[4];
regs[0] = sz53pTable[regs[1]];
	break;case 180:
	
	

regs[1] |= regs[19];
regs[0] = sz53pTable[regs[1]];
	break;case 181:
	
	

regs[1] |= regs[18];
regs[0] = sz53pTable[regs[1]];
	break;case 182:
	
	var offset = (tstates += ( 3), memory.read(regPairs[12]));
if (offset & 0x80) offset -= 0x100;
tstates += ( 1);
tstates += ( 1);
tstates += ( 1);
tstates += ( 1);
tstates += ( 1);
regPairs[12]++;var addr = (regPairs[9] + offset) & 0xffff;
var val = (tstates += ( 3), memory.read(addr));

regs[1] |= val;
regs[0] = sz53pTable[regs[1]];
	break;case 183:
	
	

regs[1] |= regs[1];
regs[0] = sz53pTable[regs[1]];
	break;case 184:
	
	

var cptemp = regs[1] - regs[3];
var lookup = ( (regs[1] & 0x88) >> 3 ) | ( (regs[3] & 0x88) >> 2 ) | ( (cptemp & 0x88) >> 1 );
regs[0] = ( cptemp & 0x100 ? 1 : ( cptemp ? 0 : 64 ) ) | 2 | halfcarrySubTable[lookup & 0x07] | overflowSubTable[lookup >> 4] | ( regs[3] & 40 ) | ( cptemp & 128 );
	break;case 185:
	
	

var cptemp = regs[1] - regs[2];
var lookup = ( (regs[1] & 0x88) >> 3 ) | ( (regs[2] & 0x88) >> 2 ) | ( (cptemp & 0x88) >> 1 );
regs[0] = ( cptemp & 0x100 ? 1 : ( cptemp ? 0 : 64 ) ) | 2 | halfcarrySubTable[lookup & 0x07] | overflowSubTable[lookup >> 4] | ( regs[2] & 40 ) | ( cptemp & 128 );
	break;case 186:
	
	

var cptemp = regs[1] - regs[5];
var lookup = ( (regs[1] & 0x88) >> 3 ) | ( (regs[5] & 0x88) >> 2 ) | ( (cptemp & 0x88) >> 1 );
regs[0] = ( cptemp & 0x100 ? 1 : ( cptemp ? 0 : 64 ) ) | 2 | halfcarrySubTable[lookup & 0x07] | overflowSubTable[lookup >> 4] | ( regs[5] & 40 ) | ( cptemp & 128 );
	break;case 187:
	
	

var cptemp = regs[1] - regs[4];
var lookup = ( (regs[1] & 0x88) >> 3 ) | ( (regs[4] & 0x88) >> 2 ) | ( (cptemp & 0x88) >> 1 );
regs[0] = ( cptemp & 0x100 ? 1 : ( cptemp ? 0 : 64 ) ) | 2 | halfcarrySubTable[lookup & 0x07] | overflowSubTable[lookup >> 4] | ( regs[4] & 40 ) | ( cptemp & 128 );
	break;case 188:
	
	

var cptemp = regs[1] - regs[19];
var lookup = ( (regs[1] & 0x88) >> 3 ) | ( (regs[19] & 0x88) >> 2 ) | ( (cptemp & 0x88) >> 1 );
regs[0] = ( cptemp & 0x100 ? 1 : ( cptemp ? 0 : 64 ) ) | 2 | halfcarrySubTable[lookup & 0x07] | overflowSubTable[lookup >> 4] | ( regs[19] & 40 ) | ( cptemp & 128 );
	break;case 189:
	
	

var cptemp = regs[1] - regs[18];
var lookup = ( (regs[1] & 0x88) >> 3 ) | ( (regs[18] & 0x88) >> 2 ) | ( (cptemp & 0x88) >> 1 );
regs[0] = ( cptemp & 0x100 ? 1 : ( cptemp ? 0 : 64 ) ) | 2 | halfcarrySubTable[lookup & 0x07] | overflowSubTable[lookup >> 4] | ( regs[18] & 40 ) | ( cptemp & 128 );
	break;case 190:
	
	var offset = (tstates += ( 3), memory.read(regPairs[12]));
if (offset & 0x80) offset -= 0x100;
tstates += ( 1);
tstates += ( 1);
tstates += ( 1);
tstates += ( 1);
tstates += ( 1);
regPairs[12]++;var addr = (regPairs[9] + offset) & 0xffff;
var val = (tstates += ( 3), memory.read(addr));

var cptemp = regs[1] - val;
var lookup = ( (regs[1] & 0x88) >> 3 ) | ( (val & 0x88) >> 2 ) | ( (cptemp & 0x88) >> 1 );
regs[0] = ( cptemp & 0x100 ? 1 : ( cptemp ? 0 : 64 ) ) | 2 | halfcarrySubTable[lookup & 0x07] | overflowSubTable[lookup >> 4] | ( val & 40 ) | ( cptemp & 128 );
	break;case 191:
	
	

var cptemp = regs[1] - regs[1];
var lookup = ( (regs[1] & 0x88) >> 3 ) | ( (regs[1] & 0x88) >> 2 ) | ( (cptemp & 0x88) >> 1 );
regs[0] = ( cptemp & 0x100 ? 1 : ( cptemp ? 0 : 64 ) ) | 2 | halfcarrySubTable[lookup & 0x07] | overflowSubTable[lookup >> 4] | ( regs[1] & 40 ) | ( cptemp & 128 );
	break;case 192:
	
	tstates += ( 1);
if (!(regs[0] & 64)) {
	var l = (tstates += ( 3), memory.read(regPairs[11])); regPairs[11]++;
	var h = (tstates += ( 3), memory.read(regPairs[11])); regPairs[11]++;
	regPairs[12] = (h<<8) | l;
}
	break;case 193:
	
	var l = (tstates += ( 3), memory.read(regPairs[11])); regPairs[11]++;
var h = (tstates += ( 3), memory.read(regPairs[11])); regPairs[11]++;
regPairs[1] = (h<<8) | l;
	break;case 194:
	
	if (!(regs[0] & 64)) {
	var l = (tstates += ( 3), memory.read(regPairs[12])); regPairs[12]++;
	var h = (tstates += ( 3), memory.read(regPairs[12])); regPairs[12]++;
	regPairs[12] = (h<<8) | l;
} else {
	tstates += ( 3);
	regPairs[12]++;
	tstates += ( 3);
	regPairs[12]++;
}
	break;case 195:
	
	var l = (tstates += ( 3), memory.read(regPairs[12])); regPairs[12]++;
var h = (tstates += ( 3), memory.read(regPairs[12])); regPairs[12]++;
regPairs[12] = (h<<8) | l;
	break;case 196:
	
	if (!(regs[0] & 64)) {
	var l = (tstates += ( 3), memory.read(regPairs[12])); regPairs[12]++;
	var h = (tstates += ( 3), memory.read(regPairs[12]));
	tstates += ( 1);
	regPairs[12]++;
	regPairs[11]--; tstates += ( 3);
while (display.nextEventTime != null && display.nextEventTime < tstates) display.doEvent();
memory.write(regPairs[11], regPairs[12] >> 8);;
	regPairs[11]--; tstates += ( 3);
while (display.nextEventTime != null && display.nextEventTime < tstates) display.doEvent();
memory.write(regPairs[11], regPairs[12] & 0xff);;
	regPairs[12] = (h<<8) | l;
} else {
	tstates += ( 3);
	regPairs[12]++;
	tstates += ( 3);
	regPairs[12]++;
}
	break;case 197:
	
	tstates += ( 1);
regPairs[11]--; tstates += ( 3);
while (display.nextEventTime != null && display.nextEventTime < tstates) display.doEvent();
memory.write(regPairs[11], regPairs[1] >> 8);;
regPairs[11]--; tstates += ( 3);
while (display.nextEventTime != null && display.nextEventTime < tstates) display.doEvent();
memory.write(regPairs[11], regPairs[1] & 0xff);;
	break;case 198:
	
	var val = (tstates += ( 3), memory.read(regPairs[12])); regPairs[12]++;

var addtemp = regs[1] + val;
var lookup = ( (regs[1] & 0x88) >> 3 ) | ( (val & 0x88) >> 2 ) | ( (addtemp & 0x88) >> 1 );
regs[1] = addtemp;
regs[0] = ( addtemp & 0x100 ? 1 : 0 ) | halfcarryAddTable[lookup & 0x07] | overflowAddTable[lookup >> 4] | sz53Table[regs[1]];
	break;case 199:
	
	tstates += ( 1);
regPairs[11]--; tstates += ( 3);
while (display.nextEventTime != null && display.nextEventTime < tstates) display.doEvent();
memory.write(regPairs[11], regPairs[12] >> 8);;
regPairs[11]--; tstates += ( 3);
while (display.nextEventTime != null && display.nextEventTime < tstates) display.doEvent();
memory.write(regPairs[11], regPairs[12] & 0xff);;
regPairs[12] = 0;
	break;case 200:
	
	tstates += ( 1);
if (regs[0] & 64) {
	var l = (tstates += ( 3), memory.read(regPairs[11])); regPairs[11]++;
	var h = (tstates += ( 3), memory.read(regPairs[11])); regPairs[11]++;
	regPairs[12] = (h<<8) | l;
}
	break;case 201:
	
	var l = (tstates += ( 3), memory.read(regPairs[11])); regPairs[11]++;
var h = (tstates += ( 3), memory.read(regPairs[11])); regPairs[11]++;
regPairs[12] = (h<<8) | l;
	break;case 202:
	
	if (regs[0] & 64) {
	var l = (tstates += ( 3), memory.read(regPairs[12])); regPairs[12]++;
	var h = (tstates += ( 3), memory.read(regPairs[12])); regPairs[12]++;
	regPairs[12] = (h<<8) | l;
} else {
	tstates += ( 3);
	regPairs[12]++;
	tstates += ( 3);
	regPairs[12]++;
}
	break;case 203:
	
	opcodePrefix = 'FDCB';
interruptible = false;
	break;case 204:
	
	if (regs[0] & 64) {
	var l = (tstates += ( 3), memory.read(regPairs[12])); regPairs[12]++;
	var h = (tstates += ( 3), memory.read(regPairs[12]));
	tstates += ( 1);
	regPairs[12]++;
	regPairs[11]--; tstates += ( 3);
while (display.nextEventTime != null && display.nextEventTime < tstates) display.doEvent();
memory.write(regPairs[11], regPairs[12] >> 8);;
	regPairs[11]--; tstates += ( 3);
while (display.nextEventTime != null && display.nextEventTime < tstates) display.doEvent();
memory.write(regPairs[11], regPairs[12] & 0xff);;
	regPairs[12] = (h<<8) | l;
} else {
	tstates += ( 3);
	regPairs[12]++;
	tstates += ( 3);
	regPairs[12]++;
}
	break;case 205:
	
	var l = (tstates += ( 3), memory.read(regPairs[12])); regPairs[12]++;
var h = (tstates += ( 3), memory.read(regPairs[12]));
tstates += ( 1);
regPairs[12]++;
regPairs[11]--; tstates += ( 3);
while (display.nextEventTime != null && display.nextEventTime < tstates) display.doEvent();
memory.write(regPairs[11], regPairs[12] >> 8);;
regPairs[11]--; tstates += ( 3);
while (display.nextEventTime != null && display.nextEventTime < tstates) display.doEvent();
memory.write(regPairs[11], regPairs[12] & 0xff);;
regPairs[12] = (h<<8) | l;
	break;case 206:
	
	var val = (tstates += ( 3), memory.read(regPairs[12])); regPairs[12]++;

var adctemp = regs[1] + val + (regs[0] & 1);
var lookup = ( (regs[1] & 0x88) >> 3 ) | ( (val & 0x88) >> 2 ) | ( (adctemp & 0x88) >> 1 );
regs[1] = adctemp;
regs[0] = ( adctemp & 0x100 ? 1 : 0 ) | halfcarryAddTable[lookup & 0x07] | overflowAddTable[lookup >> 4] | sz53Table[regs[1]];
	break;case 207:
	
	tstates += ( 1);
regPairs[11]--; tstates += ( 3);
while (display.nextEventTime != null && display.nextEventTime < tstates) display.doEvent();
memory.write(regPairs[11], regPairs[12] >> 8);;
regPairs[11]--; tstates += ( 3);
while (display.nextEventTime != null && display.nextEventTime < tstates) display.doEvent();
memory.write(regPairs[11], regPairs[12] & 0xff);;
regPairs[12] = 8;
	break;case 208:
	
	tstates += ( 1);
if (!(regs[0] & 1)) {
	var l = (tstates += ( 3), memory.read(regPairs[11])); regPairs[11]++;
	var h = (tstates += ( 3), memory.read(regPairs[11])); regPairs[11]++;
	regPairs[12] = (h<<8) | l;
}
	break;case 209:
	
	var l = (tstates += ( 3), memory.read(regPairs[11])); regPairs[11]++;
var h = (tstates += ( 3), memory.read(regPairs[11])); regPairs[11]++;
regPairs[2] = (h<<8) | l;
	break;case 210:
	
	if (!(regs[0] & 1)) {
	var l = (tstates += ( 3), memory.read(regPairs[12])); regPairs[12]++;
	var h = (tstates += ( 3), memory.read(regPairs[12])); regPairs[12]++;
	regPairs[12] = (h<<8) | l;
} else {
	tstates += ( 3);
	regPairs[12]++;
	tstates += ( 3);
	regPairs[12]++;
}
	break;case 211:
	
	var port = (regs[1] << 8) | (tstates += ( 3), memory.read(regPairs[12])); regPairs[12]++;
tstates += 1;
ioBus.write(port, regs[1], tstates);
tstates += 3;
	break;case 212:
	
	if (!(regs[0] & 1)) {
	var l = (tstates += ( 3), memory.read(regPairs[12])); regPairs[12]++;
	var h = (tstates += ( 3), memory.read(regPairs[12]));
	tstates += ( 1);
	regPairs[12]++;
	regPairs[11]--; tstates += ( 3);
while (display.nextEventTime != null && display.nextEventTime < tstates) display.doEvent();
memory.write(regPairs[11], regPairs[12] >> 8);;
	regPairs[11]--; tstates += ( 3);
while (display.nextEventTime != null && display.nextEventTime < tstates) display.doEvent();
memory.write(regPairs[11], regPairs[12] & 0xff);;
	regPairs[12] = (h<<8) | l;
} else {
	tstates += ( 3);
	regPairs[12]++;
	tstates += ( 3);
	regPairs[12]++;
}
	break;case 213:
	
	tstates += ( 1);
regPairs[11]--; tstates += ( 3);
while (display.nextEventTime != null && display.nextEventTime < tstates) display.doEvent();
memory.write(regPairs[11], regPairs[2] >> 8);;
regPairs[11]--; tstates += ( 3);
while (display.nextEventTime != null && display.nextEventTime < tstates) display.doEvent();
memory.write(regPairs[11], regPairs[2] & 0xff);;
	break;case 214:
	
	var val = (tstates += ( 3), memory.read(regPairs[12])); regPairs[12]++;
var subtemp = regs[1] - val;
var lookup = ( (regs[1] & 0x88) >> 3 ) | ( (val & 0x88) >> 2 ) | ( (subtemp & 0x88) >> 1 );
regs[1] = subtemp;
regs[0] = ( subtemp & 0x100 ? 1 : 0 ) | 2 | halfcarrySubTable[lookup & 0x07] | overflowSubTable[lookup >> 4] | sz53Table[regs[1]];
	break;case 215:
	
	tstates += ( 1);
regPairs[11]--; tstates += ( 3);
while (display.nextEventTime != null && display.nextEventTime < tstates) display.doEvent();
memory.write(regPairs[11], regPairs[12] >> 8);;
regPairs[11]--; tstates += ( 3);
while (display.nextEventTime != null && display.nextEventTime < tstates) display.doEvent();
memory.write(regPairs[11], regPairs[12] & 0xff);;
regPairs[12] = 16;
	break;case 216:
	
	tstates += ( 1);
if (regs[0] & 1) {
	var l = (tstates += ( 3), memory.read(regPairs[11])); regPairs[11]++;
	var h = (tstates += ( 3), memory.read(regPairs[11])); regPairs[11]++;
	regPairs[12] = (h<<8) | l;
}
	break;case 217:
	
	var wordtemp;
wordtemp = regPairs[1]; regPairs[1] = regPairs[5]; regPairs[5] = wordtemp;
wordtemp = regPairs[2]; regPairs[2] = regPairs[6]; regPairs[6] = wordtemp;
wordtemp = regPairs[3]; regPairs[3] = regPairs[7]; regPairs[7] = wordtemp;
	break;case 218:
	
	if (regs[0] & 1) {
	var l = (tstates += ( 3), memory.read(regPairs[12])); regPairs[12]++;
	var h = (tstates += ( 3), memory.read(regPairs[12])); regPairs[12]++;
	regPairs[12] = (h<<8) | l;
} else {
	tstates += ( 3);
	regPairs[12]++;
	tstates += ( 3);
	regPairs[12]++;
}
	break;case 219:
	
	var val = (tstates += ( 3), memory.read(regPairs[12])); regPairs[12]++;
var port = (regs[1] << 8) | val;
tstates += 1;
regs[1] = ioBus.read(port);
tstates += 3;
	break;case 220:
	
	if (regs[0] & 1) {
	var l = (tstates += ( 3), memory.read(regPairs[12])); regPairs[12]++;
	var h = (tstates += ( 3), memory.read(regPairs[12]));
	tstates += ( 1);
	regPairs[12]++;
	regPairs[11]--; tstates += ( 3);
while (display.nextEventTime != null && display.nextEventTime < tstates) display.doEvent();
memory.write(regPairs[11], regPairs[12] >> 8);;
	regPairs[11]--; tstates += ( 3);
while (display.nextEventTime != null && display.nextEventTime < tstates) display.doEvent();
memory.write(regPairs[11], regPairs[12] & 0xff);;
	regPairs[12] = (h<<8) | l;
} else {
	tstates += ( 3);
	regPairs[12]++;
	tstates += ( 3);
	regPairs[12]++;
}
	break;case 221:
	
	opcodePrefix = 'DD';
interruptible = false;
	break;case 222:
	
	var val = (tstates += ( 3), memory.read(regPairs[12])); regPairs[12]++;
var sbctemp = regs[1] - val - (regs[0] & 1);
var lookup = ( (regs[1] & 0x88) >> 3 ) | ( (val & 0x88) >> 2 ) | ( (sbctemp & 0x88) >> 1 );
regs[1] = sbctemp;
regs[0] = ( sbctemp & 0x100 ? 1 : 0 ) | 2 | halfcarrySubTable[lookup & 0x07] | overflowSubTable[lookup >> 4] | sz53Table[regs[1]];
	break;case 223:
	
	tstates += ( 1);
regPairs[11]--; tstates += ( 3);
while (display.nextEventTime != null && display.nextEventTime < tstates) display.doEvent();
memory.write(regPairs[11], regPairs[12] >> 8);;
regPairs[11]--; tstates += ( 3);
while (display.nextEventTime != null && display.nextEventTime < tstates) display.doEvent();
memory.write(regPairs[11], regPairs[12] & 0xff);;
regPairs[12] = 24;
	break;case 224:
	
	tstates += ( 1);
if (!(regs[0] & 4)) {
	var l = (tstates += ( 3), memory.read(regPairs[11])); regPairs[11]++;
	var h = (tstates += ( 3), memory.read(regPairs[11])); regPairs[11]++;
	regPairs[12] = (h<<8) | l;
}
	break;case 225:
	
	var l = (tstates += ( 3), memory.read(regPairs[11])); regPairs[11]++;
var h = (tstates += ( 3), memory.read(regPairs[11])); regPairs[11]++;
regPairs[9] = (h<<8) | l;
	break;case 226:
	
	if (!(regs[0] & 4)) {
	var l = (tstates += ( 3), memory.read(regPairs[12])); regPairs[12]++;
	var h = (tstates += ( 3), memory.read(regPairs[12])); regPairs[12]++;
	regPairs[12] = (h<<8) | l;
} else {
	tstates += ( 3);
	regPairs[12]++;
	tstates += ( 3);
	regPairs[12]++;
}
	break;case 227:
	
	var l = (tstates += ( 3), memory.read(regPairs[11]));
var spPlus1 = (regPairs[11] + 1) & 0xffff;
var h = (tstates += ( 3), memory.read(spPlus1));
tstates += ( 1);
tstates += ( 3);
while (display.nextEventTime != null && display.nextEventTime < tstates) display.doEvent();
memory.write(spPlus1, regPairs[9] >> 8);;
tstates += ( 3);
while (display.nextEventTime != null && display.nextEventTime < tstates) display.doEvent();
memory.write(regPairs[11], regPairs[9] & 0xff);;
regPairs[9] = (h<<8) | l;
tstates += ( 1);
tstates += ( 1);
	break;case 228:
	
	if (!(regs[0] & 4)) {
	var l = (tstates += ( 3), memory.read(regPairs[12])); regPairs[12]++;
	var h = (tstates += ( 3), memory.read(regPairs[12]));
	tstates += ( 1);
	regPairs[12]++;
	regPairs[11]--; tstates += ( 3);
while (display.nextEventTime != null && display.nextEventTime < tstates) display.doEvent();
memory.write(regPairs[11], regPairs[12] >> 8);;
	regPairs[11]--; tstates += ( 3);
while (display.nextEventTime != null && display.nextEventTime < tstates) display.doEvent();
memory.write(regPairs[11], regPairs[12] & 0xff);;
	regPairs[12] = (h<<8) | l;
} else {
	tstates += ( 3);
	regPairs[12]++;
	tstates += ( 3);
	regPairs[12]++;
}
	break;case 229:
	
	tstates += ( 1);
regPairs[11]--; tstates += ( 3);
while (display.nextEventTime != null && display.nextEventTime < tstates) display.doEvent();
memory.write(regPairs[11], regPairs[9] >> 8);;
regPairs[11]--; tstates += ( 3);
while (display.nextEventTime != null && display.nextEventTime < tstates) display.doEvent();
memory.write(regPairs[11], regPairs[9] & 0xff);;
	break;case 230:
	
	var val = (tstates += ( 3), memory.read(regPairs[12])); regPairs[12]++;

regs[1] &= val;
regs[0] = 16 | sz53pTable[regs[1]];
	break;case 231:
	
	tstates += ( 1);
regPairs[11]--; tstates += ( 3);
while (display.nextEventTime != null && display.nextEventTime < tstates) display.doEvent();
memory.write(regPairs[11], regPairs[12] >> 8);;
regPairs[11]--; tstates += ( 3);
while (display.nextEventTime != null && display.nextEventTime < tstates) display.doEvent();
memory.write(regPairs[11], regPairs[12] & 0xff);;
regPairs[12] = 32;
	break;case 232:
	
	tstates += ( 1);
if (regs[0] & 4) {
	var l = (tstates += ( 3), memory.read(regPairs[11])); regPairs[11]++;
	var h = (tstates += ( 3), memory.read(regPairs[11])); regPairs[11]++;
	regPairs[12] = (h<<8) | l;
}
	break;case 233:
	
	regPairs[12] = regPairs[9];
	break;case 234:
	
	if (regs[0] & 4) {
	var l = (tstates += ( 3), memory.read(regPairs[12])); regPairs[12]++;
	var h = (tstates += ( 3), memory.read(regPairs[12])); regPairs[12]++;
	regPairs[12] = (h<<8) | l;
} else {
	tstates += ( 3);
	regPairs[12]++;
	tstates += ( 3);
	regPairs[12]++;
}
	break;case 235:
	
	var temp = regPairs[2];
regPairs[2] = regPairs[3];
regPairs[3] = temp;
	break;case 236:
	
	if (regs[0] & 4) {
	var l = (tstates += ( 3), memory.read(regPairs[12])); regPairs[12]++;
	var h = (tstates += ( 3), memory.read(regPairs[12]));
	tstates += ( 1);
	regPairs[12]++;
	regPairs[11]--; tstates += ( 3);
while (display.nextEventTime != null && display.nextEventTime < tstates) display.doEvent();
memory.write(regPairs[11], regPairs[12] >> 8);;
	regPairs[11]--; tstates += ( 3);
while (display.nextEventTime != null && display.nextEventTime < tstates) display.doEvent();
memory.write(regPairs[11], regPairs[12] & 0xff);;
	regPairs[12] = (h<<8) | l;
} else {
	tstates += ( 3);
	regPairs[12]++;
	tstates += ( 3);
	regPairs[12]++;
}
	break;case 237:
	
	opcodePrefix = 'ED';
interruptible = false;
	break;case 238:
	
	var val = (tstates += ( 3), memory.read(regPairs[12])); regPairs[12]++;
regs[1] ^= val;
regs[0] = sz53pTable[regs[1]];
	break;case 239:
	
	tstates += ( 1);
regPairs[11]--; tstates += ( 3);
while (display.nextEventTime != null && display.nextEventTime < tstates) display.doEvent();
memory.write(regPairs[11], regPairs[12] >> 8);;
regPairs[11]--; tstates += ( 3);
while (display.nextEventTime != null && display.nextEventTime < tstates) display.doEvent();
memory.write(regPairs[11], regPairs[12] & 0xff);;
regPairs[12] = 40;
	break;case 240:
	
	tstates += ( 1);
if (!(regs[0] & 128)) {
	var l = (tstates += ( 3), memory.read(regPairs[11])); regPairs[11]++;
	var h = (tstates += ( 3), memory.read(regPairs[11])); regPairs[11]++;
	regPairs[12] = (h<<8) | l;
}
	break;case 241:
	
	var l = (tstates += ( 3), memory.read(regPairs[11])); regPairs[11]++;
var h = (tstates += ( 3), memory.read(regPairs[11])); regPairs[11]++;
regPairs[0] = (h<<8) | l;
	break;case 242:
	
	if (!(regs[0] & 128)) {
	var l = (tstates += ( 3), memory.read(regPairs[12])); regPairs[12]++;
	var h = (tstates += ( 3), memory.read(regPairs[12])); regPairs[12]++;
	regPairs[12] = (h<<8) | l;
} else {
	tstates += ( 3);
	regPairs[12]++;
	tstates += ( 3);
	regPairs[12]++;
}
	break;case 243:
	
	iff1 = iff2 = 0;
	break;case 244:
	
	if (!(regs[0] & 128)) {
	var l = (tstates += ( 3), memory.read(regPairs[12])); regPairs[12]++;
	var h = (tstates += ( 3), memory.read(regPairs[12]));
	tstates += ( 1);
	regPairs[12]++;
	regPairs[11]--; tstates += ( 3);
while (display.nextEventTime != null && display.nextEventTime < tstates) display.doEvent();
memory.write(regPairs[11], regPairs[12] >> 8);;
	regPairs[11]--; tstates += ( 3);
while (display.nextEventTime != null && display.nextEventTime < tstates) display.doEvent();
memory.write(regPairs[11], regPairs[12] & 0xff);;
	regPairs[12] = (h<<8) | l;
} else {
	tstates += ( 3);
	regPairs[12]++;
	tstates += ( 3);
	regPairs[12]++;
}
	break;case 245:
	
	tstates += ( 1);
regPairs[11]--; tstates += ( 3);
while (display.nextEventTime != null && display.nextEventTime < tstates) display.doEvent();
memory.write(regPairs[11], regPairs[0] >> 8);;
regPairs[11]--; tstates += ( 3);
while (display.nextEventTime != null && display.nextEventTime < tstates) display.doEvent();
memory.write(regPairs[11], regPairs[0] & 0xff);;
	break;case 246:
	
	var val = (tstates += ( 3), memory.read(regPairs[12])); regPairs[12]++;

regs[1] |= val;
regs[0] = sz53pTable[regs[1]];
	break;case 247:
	
	tstates += ( 1);
regPairs[11]--; tstates += ( 3);
while (display.nextEventTime != null && display.nextEventTime < tstates) display.doEvent();
memory.write(regPairs[11], regPairs[12] >> 8);;
regPairs[11]--; tstates += ( 3);
while (display.nextEventTime != null && display.nextEventTime < tstates) display.doEvent();
memory.write(regPairs[11], regPairs[12] & 0xff);;
regPairs[12] = 48;
	break;case 248:
	
	tstates += ( 1);
if (regs[0] & 128) {
	var l = (tstates += ( 3), memory.read(regPairs[11])); regPairs[11]++;
	var h = (tstates += ( 3), memory.read(regPairs[11])); regPairs[11]++;
	regPairs[12] = (h<<8) | l;
}
	break;case 249:
	
	regPairs[11] = regPairs[9];
tstates += ( 1);
tstates += ( 1);
	break;case 250:
	
	if (regs[0] & 128) {
	var l = (tstates += ( 3), memory.read(regPairs[12])); regPairs[12]++;
	var h = (tstates += ( 3), memory.read(regPairs[12])); regPairs[12]++;
	regPairs[12] = (h<<8) | l;
} else {
	tstates += ( 3);
	regPairs[12]++;
	tstates += ( 3);
	regPairs[12]++;
}
	break;case 251:
	
	iff1 = iff2 = 1;
interruptible = false;
	break;case 252:
	
	if (regs[0] & 128) {
	var l = (tstates += ( 3), memory.read(regPairs[12])); regPairs[12]++;
	var h = (tstates += ( 3), memory.read(regPairs[12]));
	tstates += ( 1);
	regPairs[12]++;
	regPairs[11]--; tstates += ( 3);
while (display.nextEventTime != null && display.nextEventTime < tstates) display.doEvent();
memory.write(regPairs[11], regPairs[12] >> 8);;
	regPairs[11]--; tstates += ( 3);
while (display.nextEventTime != null && display.nextEventTime < tstates) display.doEvent();
memory.write(regPairs[11], regPairs[12] & 0xff);;
	regPairs[12] = (h<<8) | l;
} else {
	tstates += ( 3);
	regPairs[12]++;
	tstates += ( 3);
	regPairs[12]++;
}
	break;case 253:
	
	opcodePrefix = 'FD';
interruptible = false;
	break;case 254:
	
	var val = (tstates += ( 3), memory.read(regPairs[12])); regPairs[12]++;

var cptemp = regs[1] - val;
var lookup = ( (regs[1] & 0x88) >> 3 ) | ( (val & 0x88) >> 2 ) | ( (cptemp & 0x88) >> 1 );
regs[0] = ( cptemp & 0x100 ? 1 : ( cptemp ? 0 : 64 ) ) | 2 | halfcarrySubTable[lookup & 0x07] | overflowSubTable[lookup >> 4] | ( val & 40 ) | ( cptemp & 128 );
	break;case 255:
	
	tstates += ( 1);
regPairs[11]--; tstates += ( 3);
while (display.nextEventTime != null && display.nextEventTime < tstates) display.doEvent();
memory.write(regPairs[11], regPairs[12] >> 8);;
regPairs[11]--; tstates += ( 3);
while (display.nextEventTime != null && display.nextEventTime < tstates) display.doEvent();
memory.write(regPairs[11], regPairs[12] & 0xff);;
regPairs[12] = 56;
	break;
	default:
		var addr = regPairs[12] - 1;
		throw("Unimplemented opcode " + opcode + " in page dd - PC = " + addr);
}
					break;
				case 'FDCB':
					offset = (tstates += ( 3), memory.read(regPairs[12])); regPairs[12]++;
					if (offset & 0x80) offset -= 0x100;
					tstates += ( 3);
					opcode = memory.read(regPairs[12]);
					tstates += ( 1);
					tstates += ( 1);
					regPairs[12]++;
					switch (opcode) {
	case 0:
	
	var addr = (regPairs[9] + offset) & 0xffff;
regs[3] = (tstates += ( 3), memory.read(addr));

regs[3] = ( (regs[3] << 1) | (regs[3] >> 7) ) ;
regs[0] = (regs[3] & 1) | sz53pTable[regs[3]];

tstates += ( 1);
tstates += ( 3);
while (display.nextEventTime != null && display.nextEventTime < tstates) display.doEvent();
memory.write(addr, regs[3]);;
	break;case 1:
	
	var addr = (regPairs[9] + offset) & 0xffff;
regs[2] = (tstates += ( 3), memory.read(addr));

regs[2] = ( (regs[2] << 1) | (regs[2] >> 7) ) ;
regs[0] = (regs[2] & 1) | sz53pTable[regs[2]];

tstates += ( 1);
tstates += ( 3);
while (display.nextEventTime != null && display.nextEventTime < tstates) display.doEvent();
memory.write(addr, regs[2]);;
	break;case 2:
	
	var addr = (regPairs[9] + offset) & 0xffff;
regs[5] = (tstates += ( 3), memory.read(addr));

regs[5] = ( (regs[5] << 1) | (regs[5] >> 7) ) ;
regs[0] = (regs[5] & 1) | sz53pTable[regs[5]];

tstates += ( 1);
tstates += ( 3);
while (display.nextEventTime != null && display.nextEventTime < tstates) display.doEvent();
memory.write(addr, regs[5]);;
	break;case 3:
	
	var addr = (regPairs[9] + offset) & 0xffff;
regs[4] = (tstates += ( 3), memory.read(addr));

regs[4] = ( (regs[4] << 1) | (regs[4] >> 7) ) ;
regs[0] = (regs[4] & 1) | sz53pTable[regs[4]];

tstates += ( 1);
tstates += ( 3);
while (display.nextEventTime != null && display.nextEventTime < tstates) display.doEvent();
memory.write(addr, regs[4]);;
	break;case 4:
	
	var addr = (regPairs[9] + offset) & 0xffff;
regs[7] = (tstates += ( 3), memory.read(addr));

regs[7] = ( (regs[7] << 1) | (regs[7] >> 7) ) ;
regs[0] = (regs[7] & 1) | sz53pTable[regs[7]];

tstates += ( 1);
tstates += ( 3);
while (display.nextEventTime != null && display.nextEventTime < tstates) display.doEvent();
memory.write(addr, regs[7]);;
	break;case 5:
	
	var addr = (regPairs[9] + offset) & 0xffff;
regs[6] = (tstates += ( 3), memory.read(addr));

regs[6] = ( (regs[6] << 1) | (regs[6] >> 7) ) ;
regs[0] = (regs[6] & 1) | sz53pTable[regs[6]];

tstates += ( 1);
tstates += ( 3);
while (display.nextEventTime != null && display.nextEventTime < tstates) display.doEvent();
memory.write(addr, regs[6]);;
	break;case 6:
	
	var addr = (regPairs[9] + offset) & 0xffff;
var val = (tstates += ( 3), memory.read(addr));
val = ( (val << 1) | (val >> 7) ) & 0xff;
regs[0] = (val & 1) | sz53pTable[val];
tstates += ( 1);
tstates += ( 3);
while (display.nextEventTime != null && display.nextEventTime < tstates) display.doEvent();
memory.write(addr, val);;
	break;case 7:
	
	var addr = (regPairs[9] + offset) & 0xffff;
regs[1] = (tstates += ( 3), memory.read(addr));

regs[1] = ( (regs[1] << 1) | (regs[1] >> 7) ) ;
regs[0] = (regs[1] & 1) | sz53pTable[regs[1]];

tstates += ( 1);
tstates += ( 3);
while (display.nextEventTime != null && display.nextEventTime < tstates) display.doEvent();
memory.write(addr, regs[1]);;
	break;case 8:
	
	var addr = (regPairs[9] + offset) & 0xffff;
regs[3] = (tstates += ( 3), memory.read(addr));

regs[0] = regs[3] & 1;
regs[3] = ( (regs[3] >> 1) | (regs[3] << 7) ) ;
regs[0] |= sz53pTable[regs[3]];

tstates += ( 1);
tstates += ( 3);
while (display.nextEventTime != null && display.nextEventTime < tstates) display.doEvent();
memory.write(addr, regs[3]);;
	break;case 9:
	
	var addr = (regPairs[9] + offset) & 0xffff;
regs[2] = (tstates += ( 3), memory.read(addr));

regs[0] = regs[2] & 1;
regs[2] = ( (regs[2] >> 1) | (regs[2] << 7) ) ;
regs[0] |= sz53pTable[regs[2]];

tstates += ( 1);
tstates += ( 3);
while (display.nextEventTime != null && display.nextEventTime < tstates) display.doEvent();
memory.write(addr, regs[2]);;
	break;case 10:
	
	var addr = (regPairs[9] + offset) & 0xffff;
regs[5] = (tstates += ( 3), memory.read(addr));

regs[0] = regs[5] & 1;
regs[5] = ( (regs[5] >> 1) | (regs[5] << 7) ) ;
regs[0] |= sz53pTable[regs[5]];

tstates += ( 1);
tstates += ( 3);
while (display.nextEventTime != null && display.nextEventTime < tstates) display.doEvent();
memory.write(addr, regs[5]);;
	break;case 11:
	
	var addr = (regPairs[9] + offset) & 0xffff;
regs[4] = (tstates += ( 3), memory.read(addr));

regs[0] = regs[4] & 1;
regs[4] = ( (regs[4] >> 1) | (regs[4] << 7) ) ;
regs[0] |= sz53pTable[regs[4]];

tstates += ( 1);
tstates += ( 3);
while (display.nextEventTime != null && display.nextEventTime < tstates) display.doEvent();
memory.write(addr, regs[4]);;
	break;case 12:
	
	var addr = (regPairs[9] + offset) & 0xffff;
regs[7] = (tstates += ( 3), memory.read(addr));

regs[0] = regs[7] & 1;
regs[7] = ( (regs[7] >> 1) | (regs[7] << 7) ) ;
regs[0] |= sz53pTable[regs[7]];

tstates += ( 1);
tstates += ( 3);
while (display.nextEventTime != null && display.nextEventTime < tstates) display.doEvent();
memory.write(addr, regs[7]);;
	break;case 13:
	
	var addr = (regPairs[9] + offset) & 0xffff;
regs[6] = (tstates += ( 3), memory.read(addr));

regs[0] = regs[6] & 1;
regs[6] = ( (regs[6] >> 1) | (regs[6] << 7) ) ;
regs[0] |= sz53pTable[regs[6]];

tstates += ( 1);
tstates += ( 3);
while (display.nextEventTime != null && display.nextEventTime < tstates) display.doEvent();
memory.write(addr, regs[6]);;
	break;case 14:
	
	var addr = (regPairs[9] + offset) & 0xffff;
var val = (tstates += ( 3), memory.read(addr));
regs[0] = val & 1;
val = ( (val >> 1) | (val << 7) ) & 0xff;
regs[0] |= sz53pTable[val];
tstates += ( 1);
tstates += ( 3);
while (display.nextEventTime != null && display.nextEventTime < tstates) display.doEvent();
memory.write(addr, val);;
	break;case 15:
	
	var addr = (regPairs[9] + offset) & 0xffff;
regs[1] = (tstates += ( 3), memory.read(addr));

regs[0] = regs[1] & 1;
regs[1] = ( (regs[1] >> 1) | (regs[1] << 7) ) ;
regs[0] |= sz53pTable[regs[1]];

tstates += ( 1);
tstates += ( 3);
while (display.nextEventTime != null && display.nextEventTime < tstates) display.doEvent();
memory.write(addr, regs[1]);;
	break;case 16:
	
	var addr = (regPairs[9] + offset) & 0xffff;
regs[3] = (tstates += ( 3), memory.read(addr));

var rltemp = regs[3];
regs[3] = ( (regs[3] << 1) | (regs[0] & 1) ) ;
regs[0] = ( rltemp >> 7 ) | sz53pTable[regs[3]];

tstates += ( 1);
tstates += ( 3);
while (display.nextEventTime != null && display.nextEventTime < tstates) display.doEvent();
memory.write(addr, regs[3]);;
	break;case 17:
	
	var addr = (regPairs[9] + offset) & 0xffff;
regs[2] = (tstates += ( 3), memory.read(addr));

var rltemp = regs[2];
regs[2] = ( (regs[2] << 1) | (regs[0] & 1) ) ;
regs[0] = ( rltemp >> 7 ) | sz53pTable[regs[2]];

tstates += ( 1);
tstates += ( 3);
while (display.nextEventTime != null && display.nextEventTime < tstates) display.doEvent();
memory.write(addr, regs[2]);;
	break;case 18:
	
	var addr = (regPairs[9] + offset) & 0xffff;
regs[5] = (tstates += ( 3), memory.read(addr));

var rltemp = regs[5];
regs[5] = ( (regs[5] << 1) | (regs[0] & 1) ) ;
regs[0] = ( rltemp >> 7 ) | sz53pTable[regs[5]];

tstates += ( 1);
tstates += ( 3);
while (display.nextEventTime != null && display.nextEventTime < tstates) display.doEvent();
memory.write(addr, regs[5]);;
	break;case 19:
	
	var addr = (regPairs[9] + offset) & 0xffff;
regs[4] = (tstates += ( 3), memory.read(addr));

var rltemp = regs[4];
regs[4] = ( (regs[4] << 1) | (regs[0] & 1) ) ;
regs[0] = ( rltemp >> 7 ) | sz53pTable[regs[4]];

tstates += ( 1);
tstates += ( 3);
while (display.nextEventTime != null && display.nextEventTime < tstates) display.doEvent();
memory.write(addr, regs[4]);;
	break;case 20:
	
	var addr = (regPairs[9] + offset) & 0xffff;
regs[7] = (tstates += ( 3), memory.read(addr));

var rltemp = regs[7];
regs[7] = ( (regs[7] << 1) | (regs[0] & 1) ) ;
regs[0] = ( rltemp >> 7 ) | sz53pTable[regs[7]];

tstates += ( 1);
tstates += ( 3);
while (display.nextEventTime != null && display.nextEventTime < tstates) display.doEvent();
memory.write(addr, regs[7]);;
	break;case 21:
	
	var addr = (regPairs[9] + offset) & 0xffff;
regs[6] = (tstates += ( 3), memory.read(addr));

var rltemp = regs[6];
regs[6] = ( (regs[6] << 1) | (regs[0] & 1) ) ;
regs[0] = ( rltemp >> 7 ) | sz53pTable[regs[6]];

tstates += ( 1);
tstates += ( 3);
while (display.nextEventTime != null && display.nextEventTime < tstates) display.doEvent();
memory.write(addr, regs[6]);;
	break;case 22:
	
	var addr = (regPairs[9] + offset) & 0xffff;
var val = (tstates += ( 3), memory.read(addr));
var rltemp = val;
val = ( (val << 1) | (regs[0] & 1) ) & 0xff;
regs[0] = ( rltemp >> 7 ) | sz53pTable[val];
tstates += ( 1);
tstates += ( 3);
while (display.nextEventTime != null && display.nextEventTime < tstates) display.doEvent();
memory.write(addr, val);;
	break;case 23:
	
	var addr = (regPairs[9] + offset) & 0xffff;
regs[1] = (tstates += ( 3), memory.read(addr));

var rltemp = regs[1];
regs[1] = ( (regs[1] << 1) | (regs[0] & 1) ) ;
regs[0] = ( rltemp >> 7 ) | sz53pTable[regs[1]];

tstates += ( 1);
tstates += ( 3);
while (display.nextEventTime != null && display.nextEventTime < tstates) display.doEvent();
memory.write(addr, regs[1]);;
	break;case 24:
	
	var addr = (regPairs[9] + offset) & 0xffff;
regs[3] = (tstates += ( 3), memory.read(addr));

var rrtemp = regs[3];
regs[3] = ( (regs[3] >> 1) | ( regs[0] << 7 ) ) ;
regs[0] = (rrtemp & 1) | sz53pTable[regs[3]];

tstates += ( 1);
tstates += ( 3);
while (display.nextEventTime != null && display.nextEventTime < tstates) display.doEvent();
memory.write(addr, regs[3]);;
	break;case 25:
	
	var addr = (regPairs[9] + offset) & 0xffff;
regs[2] = (tstates += ( 3), memory.read(addr));

var rrtemp = regs[2];
regs[2] = ( (regs[2] >> 1) | ( regs[0] << 7 ) ) ;
regs[0] = (rrtemp & 1) | sz53pTable[regs[2]];

tstates += ( 1);
tstates += ( 3);
while (display.nextEventTime != null && display.nextEventTime < tstates) display.doEvent();
memory.write(addr, regs[2]);;
	break;case 26:
	
	var addr = (regPairs[9] + offset) & 0xffff;
regs[5] = (tstates += ( 3), memory.read(addr));

var rrtemp = regs[5];
regs[5] = ( (regs[5] >> 1) | ( regs[0] << 7 ) ) ;
regs[0] = (rrtemp & 1) | sz53pTable[regs[5]];

tstates += ( 1);
tstates += ( 3);
while (display.nextEventTime != null && display.nextEventTime < tstates) display.doEvent();
memory.write(addr, regs[5]);;
	break;case 27:
	
	var addr = (regPairs[9] + offset) & 0xffff;
regs[4] = (tstates += ( 3), memory.read(addr));

var rrtemp = regs[4];
regs[4] = ( (regs[4] >> 1) | ( regs[0] << 7 ) ) ;
regs[0] = (rrtemp & 1) | sz53pTable[regs[4]];

tstates += ( 1);
tstates += ( 3);
while (display.nextEventTime != null && display.nextEventTime < tstates) display.doEvent();
memory.write(addr, regs[4]);;
	break;case 28:
	
	var addr = (regPairs[9] + offset) & 0xffff;
regs[7] = (tstates += ( 3), memory.read(addr));

var rrtemp = regs[7];
regs[7] = ( (regs[7] >> 1) | ( regs[0] << 7 ) ) ;
regs[0] = (rrtemp & 1) | sz53pTable[regs[7]];

tstates += ( 1);
tstates += ( 3);
while (display.nextEventTime != null && display.nextEventTime < tstates) display.doEvent();
memory.write(addr, regs[7]);;
	break;case 29:
	
	var addr = (regPairs[9] + offset) & 0xffff;
regs[6] = (tstates += ( 3), memory.read(addr));

var rrtemp = regs[6];
regs[6] = ( (regs[6] >> 1) | ( regs[0] << 7 ) ) ;
regs[0] = (rrtemp & 1) | sz53pTable[regs[6]];

tstates += ( 1);
tstates += ( 3);
while (display.nextEventTime != null && display.nextEventTime < tstates) display.doEvent();
memory.write(addr, regs[6]);;
	break;case 30:
	
	var addr = (regPairs[9] + offset) & 0xffff;
var val = (tstates += ( 3), memory.read(addr));
var rrtemp = val;
val = ( (val >> 1) | ( regs[0] << 7 ) ) & 0xff;
regs[0] = (rrtemp & 1) | sz53pTable[val];
tstates += ( 1);
tstates += ( 3);
while (display.nextEventTime != null && display.nextEventTime < tstates) display.doEvent();
memory.write(addr, val);;
	break;case 31:
	
	var addr = (regPairs[9] + offset) & 0xffff;
regs[1] = (tstates += ( 3), memory.read(addr));

var rrtemp = regs[1];
regs[1] = ( (regs[1] >> 1) | ( regs[0] << 7 ) ) ;
regs[0] = (rrtemp & 1) | sz53pTable[regs[1]];

tstates += ( 1);
tstates += ( 3);
while (display.nextEventTime != null && display.nextEventTime < tstates) display.doEvent();
memory.write(addr, regs[1]);;
	break;case 32:
	
	var addr = (regPairs[9] + offset) & 0xffff;
regs[3] = (tstates += ( 3), memory.read(addr));

regs[0] = regs[3] >> 7;
regs[3] = (regs[3] << 1) ;
regs[0] |= sz53pTable[regs[3]];

tstates += ( 1);
tstates += ( 3);
while (display.nextEventTime != null && display.nextEventTime < tstates) display.doEvent();
memory.write(addr, regs[3]);;
	break;case 33:
	
	var addr = (regPairs[9] + offset) & 0xffff;
regs[2] = (tstates += ( 3), memory.read(addr));

regs[0] = regs[2] >> 7;
regs[2] = (regs[2] << 1) ;
regs[0] |= sz53pTable[regs[2]];

tstates += ( 1);
tstates += ( 3);
while (display.nextEventTime != null && display.nextEventTime < tstates) display.doEvent();
memory.write(addr, regs[2]);;
	break;case 34:
	
	var addr = (regPairs[9] + offset) & 0xffff;
regs[5] = (tstates += ( 3), memory.read(addr));

regs[0] = regs[5] >> 7;
regs[5] = (regs[5] << 1) ;
regs[0] |= sz53pTable[regs[5]];

tstates += ( 1);
tstates += ( 3);
while (display.nextEventTime != null && display.nextEventTime < tstates) display.doEvent();
memory.write(addr, regs[5]);;
	break;case 35:
	
	var addr = (regPairs[9] + offset) & 0xffff;
regs[4] = (tstates += ( 3), memory.read(addr));

regs[0] = regs[4] >> 7;
regs[4] = (regs[4] << 1) ;
regs[0] |= sz53pTable[regs[4]];

tstates += ( 1);
tstates += ( 3);
while (display.nextEventTime != null && display.nextEventTime < tstates) display.doEvent();
memory.write(addr, regs[4]);;
	break;case 36:
	
	var addr = (regPairs[9] + offset) & 0xffff;
regs[7] = (tstates += ( 3), memory.read(addr));

regs[0] = regs[7] >> 7;
regs[7] = (regs[7] << 1) ;
regs[0] |= sz53pTable[regs[7]];

tstates += ( 1);
tstates += ( 3);
while (display.nextEventTime != null && display.nextEventTime < tstates) display.doEvent();
memory.write(addr, regs[7]);;
	break;case 37:
	
	var addr = (regPairs[9] + offset) & 0xffff;
regs[6] = (tstates += ( 3), memory.read(addr));

regs[0] = regs[6] >> 7;
regs[6] = (regs[6] << 1) ;
regs[0] |= sz53pTable[regs[6]];

tstates += ( 1);
tstates += ( 3);
while (display.nextEventTime != null && display.nextEventTime < tstates) display.doEvent();
memory.write(addr, regs[6]);;
	break;case 38:
	
	var addr = (regPairs[9] + offset) & 0xffff;
var val = (tstates += ( 3), memory.read(addr));
regs[0] = val >> 7;
val = (val << 1) & 0xff;
regs[0] |= sz53pTable[val];
tstates += ( 1);
tstates += ( 3);
while (display.nextEventTime != null && display.nextEventTime < tstates) display.doEvent();
memory.write(addr, val);;
	break;case 39:
	
	var addr = (regPairs[9] + offset) & 0xffff;
regs[1] = (tstates += ( 3), memory.read(addr));

regs[0] = regs[1] >> 7;
regs[1] = (regs[1] << 1) ;
regs[0] |= sz53pTable[regs[1]];

tstates += ( 1);
tstates += ( 3);
while (display.nextEventTime != null && display.nextEventTime < tstates) display.doEvent();
memory.write(addr, regs[1]);;
	break;case 40:
	
	var addr = (regPairs[9] + offset) & 0xffff;
regs[3] = (tstates += ( 3), memory.read(addr));

regs[0] = regs[3] & 1;
regs[3] = ( (regs[3] & 0x80) | (regs[3] >> 1) ) ;
regs[0] |= sz53pTable[regs[3]];

tstates += ( 1);
tstates += ( 3);
while (display.nextEventTime != null && display.nextEventTime < tstates) display.doEvent();
memory.write(addr, regs[3]);;
	break;case 41:
	
	var addr = (regPairs[9] + offset) & 0xffff;
regs[2] = (tstates += ( 3), memory.read(addr));

regs[0] = regs[2] & 1;
regs[2] = ( (regs[2] & 0x80) | (regs[2] >> 1) ) ;
regs[0] |= sz53pTable[regs[2]];

tstates += ( 1);
tstates += ( 3);
while (display.nextEventTime != null && display.nextEventTime < tstates) display.doEvent();
memory.write(addr, regs[2]);;
	break;case 42:
	
	var addr = (regPairs[9] + offset) & 0xffff;
regs[5] = (tstates += ( 3), memory.read(addr));

regs[0] = regs[5] & 1;
regs[5] = ( (regs[5] & 0x80) | (regs[5] >> 1) ) ;
regs[0] |= sz53pTable[regs[5]];

tstates += ( 1);
tstates += ( 3);
while (display.nextEventTime != null && display.nextEventTime < tstates) display.doEvent();
memory.write(addr, regs[5]);;
	break;case 43:
	
	var addr = (regPairs[9] + offset) & 0xffff;
regs[4] = (tstates += ( 3), memory.read(addr));

regs[0] = regs[4] & 1;
regs[4] = ( (regs[4] & 0x80) | (regs[4] >> 1) ) ;
regs[0] |= sz53pTable[regs[4]];

tstates += ( 1);
tstates += ( 3);
while (display.nextEventTime != null && display.nextEventTime < tstates) display.doEvent();
memory.write(addr, regs[4]);;
	break;case 44:
	
	var addr = (regPairs[9] + offset) & 0xffff;
regs[7] = (tstates += ( 3), memory.read(addr));

regs[0] = regs[7] & 1;
regs[7] = ( (regs[7] & 0x80) | (regs[7] >> 1) ) ;
regs[0] |= sz53pTable[regs[7]];

tstates += ( 1);
tstates += ( 3);
while (display.nextEventTime != null && display.nextEventTime < tstates) display.doEvent();
memory.write(addr, regs[7]);;
	break;case 45:
	
	var addr = (regPairs[9] + offset) & 0xffff;
regs[6] = (tstates += ( 3), memory.read(addr));

regs[0] = regs[6] & 1;
regs[6] = ( (regs[6] & 0x80) | (regs[6] >> 1) ) ;
regs[0] |= sz53pTable[regs[6]];

tstates += ( 1);
tstates += ( 3);
while (display.nextEventTime != null && display.nextEventTime < tstates) display.doEvent();
memory.write(addr, regs[6]);;
	break;case 46:
	
	var addr = (regPairs[9] + offset) & 0xffff;
var val = (tstates += ( 3), memory.read(addr));
regs[0] = val & 1;
val = ( (val & 0x80) | (val >> 1) ) & 0xff;
regs[0] |= sz53pTable[val];
tstates += ( 1);
tstates += ( 3);
while (display.nextEventTime != null && display.nextEventTime < tstates) display.doEvent();
memory.write(addr, val);;
	break;case 47:
	
	var addr = (regPairs[9] + offset) & 0xffff;
regs[1] = (tstates += ( 3), memory.read(addr));

regs[0] = regs[1] & 1;
regs[1] = ( (regs[1] & 0x80) | (regs[1] >> 1) ) ;
regs[0] |= sz53pTable[regs[1]];

tstates += ( 1);
tstates += ( 3);
while (display.nextEventTime != null && display.nextEventTime < tstates) display.doEvent();
memory.write(addr, regs[1]);;
	break;case 48:
	
	var addr = (regPairs[9] + offset) & 0xffff;
regs[3] = (tstates += ( 3), memory.read(addr));

regs[0] =  regs[3] >> 7;
regs[3] = (((regs[3]) << 1) ) | 0x01;
regs[0] |= sz53pTable[regs[3]];

tstates += ( 1);
tstates += ( 3);
while (display.nextEventTime != null && display.nextEventTime < tstates) display.doEvent();
memory.write(addr, regs[3]);;
	break;case 49:
	
	var addr = (regPairs[9] + offset) & 0xffff;
regs[2] = (tstates += ( 3), memory.read(addr));

regs[0] =  regs[2] >> 7;
regs[2] = (((regs[2]) << 1) ) | 0x01;
regs[0] |= sz53pTable[regs[2]];

tstates += ( 1);
tstates += ( 3);
while (display.nextEventTime != null && display.nextEventTime < tstates) display.doEvent();
memory.write(addr, regs[2]);;
	break;case 50:
	
	var addr = (regPairs[9] + offset) & 0xffff;
regs[5] = (tstates += ( 3), memory.read(addr));

regs[0] =  regs[5] >> 7;
regs[5] = (((regs[5]) << 1) ) | 0x01;
regs[0] |= sz53pTable[regs[5]];

tstates += ( 1);
tstates += ( 3);
while (display.nextEventTime != null && display.nextEventTime < tstates) display.doEvent();
memory.write(addr, regs[5]);;
	break;case 51:
	
	var addr = (regPairs[9] + offset) & 0xffff;
regs[4] = (tstates += ( 3), memory.read(addr));

regs[0] =  regs[4] >> 7;
regs[4] = (((regs[4]) << 1) ) | 0x01;
regs[0] |= sz53pTable[regs[4]];

tstates += ( 1);
tstates += ( 3);
while (display.nextEventTime != null && display.nextEventTime < tstates) display.doEvent();
memory.write(addr, regs[4]);;
	break;case 52:
	
	var addr = (regPairs[9] + offset) & 0xffff;
regs[7] = (tstates += ( 3), memory.read(addr));

regs[0] =  regs[7] >> 7;
regs[7] = (((regs[7]) << 1) ) | 0x01;
regs[0] |= sz53pTable[regs[7]];

tstates += ( 1);
tstates += ( 3);
while (display.nextEventTime != null && display.nextEventTime < tstates) display.doEvent();
memory.write(addr, regs[7]);;
	break;case 53:
	
	var addr = (regPairs[9] + offset) & 0xffff;
regs[6] = (tstates += ( 3), memory.read(addr));

regs[0] =  regs[6] >> 7;
regs[6] = (((regs[6]) << 1) ) | 0x01;
regs[0] |= sz53pTable[regs[6]];

tstates += ( 1);
tstates += ( 3);
while (display.nextEventTime != null && display.nextEventTime < tstates) display.doEvent();
memory.write(addr, regs[6]);;
	break;case 54:
	
	var addr = (regPairs[9] + offset) & 0xffff;
var val = (tstates += ( 3), memory.read(addr));
regs[0] =  val >> 7;
val = (((val) << 1) & 0xff) | 0x01;
regs[0] |= sz53pTable[val];
tstates += ( 1);
tstates += ( 3);
while (display.nextEventTime != null && display.nextEventTime < tstates) display.doEvent();
memory.write(addr, val);;
	break;case 55:
	
	var addr = (regPairs[9] + offset) & 0xffff;
regs[1] = (tstates += ( 3), memory.read(addr));

regs[0] =  regs[1] >> 7;
regs[1] = (((regs[1]) << 1) ) | 0x01;
regs[0] |= sz53pTable[regs[1]];

tstates += ( 1);
tstates += ( 3);
while (display.nextEventTime != null && display.nextEventTime < tstates) display.doEvent();
memory.write(addr, regs[1]);;
	break;case 56:
	
	var addr = (regPairs[9] + offset) & 0xffff;
regs[3] = (tstates += ( 3), memory.read(addr));

regs[0] =  regs[3] & 1;
regs[3] >>= 1;
regs[0] |= sz53pTable[regs[3]];

tstates += ( 1);
tstates += ( 3);
while (display.nextEventTime != null && display.nextEventTime < tstates) display.doEvent();
memory.write(addr, regs[3]);;
	break;case 57:
	
	var addr = (regPairs[9] + offset) & 0xffff;
regs[2] = (tstates += ( 3), memory.read(addr));

regs[0] =  regs[2] & 1;
regs[2] >>= 1;
regs[0] |= sz53pTable[regs[2]];

tstates += ( 1);
tstates += ( 3);
while (display.nextEventTime != null && display.nextEventTime < tstates) display.doEvent();
memory.write(addr, regs[2]);;
	break;case 58:
	
	var addr = (regPairs[9] + offset) & 0xffff;
regs[5] = (tstates += ( 3), memory.read(addr));

regs[0] =  regs[5] & 1;
regs[5] >>= 1;
regs[0] |= sz53pTable[regs[5]];

tstates += ( 1);
tstates += ( 3);
while (display.nextEventTime != null && display.nextEventTime < tstates) display.doEvent();
memory.write(addr, regs[5]);;
	break;case 59:
	
	var addr = (regPairs[9] + offset) & 0xffff;
regs[4] = (tstates += ( 3), memory.read(addr));

regs[0] =  regs[4] & 1;
regs[4] >>= 1;
regs[0] |= sz53pTable[regs[4]];

tstates += ( 1);
tstates += ( 3);
while (display.nextEventTime != null && display.nextEventTime < tstates) display.doEvent();
memory.write(addr, regs[4]);;
	break;case 60:
	
	var addr = (regPairs[9] + offset) & 0xffff;
regs[7] = (tstates += ( 3), memory.read(addr));

regs[0] =  regs[7] & 1;
regs[7] >>= 1;
regs[0] |= sz53pTable[regs[7]];

tstates += ( 1);
tstates += ( 3);
while (display.nextEventTime != null && display.nextEventTime < tstates) display.doEvent();
memory.write(addr, regs[7]);;
	break;case 61:
	
	var addr = (regPairs[9] + offset) & 0xffff;
regs[6] = (tstates += ( 3), memory.read(addr));

regs[0] =  regs[6] & 1;
regs[6] >>= 1;
regs[0] |= sz53pTable[regs[6]];

tstates += ( 1);
tstates += ( 3);
while (display.nextEventTime != null && display.nextEventTime < tstates) display.doEvent();
memory.write(addr, regs[6]);;
	break;case 62:
	
	var addr = (regPairs[9] + offset) & 0xffff;
var val = (tstates += ( 3), memory.read(addr));
regs[0] =  val & 1;
val >>= 1;
regs[0] |= sz53pTable[val];
tstates += ( 1);
tstates += ( 3);
while (display.nextEventTime != null && display.nextEventTime < tstates) display.doEvent();
memory.write(addr, val);;
	break;case 63:
	
	var addr = (regPairs[9] + offset) & 0xffff;
regs[1] = (tstates += ( 3), memory.read(addr));

regs[0] =  regs[1] & 1;
regs[1] >>= 1;
regs[0] |= sz53pTable[regs[1]];

tstates += ( 1);
tstates += ( 3);
while (display.nextEventTime != null && display.nextEventTime < tstates) display.doEvent();
memory.write(addr, regs[1]);;
	break;case 64:
	
	var addr = (regPairs[9] + offset) & 0xffff;
var value = (tstates += ( 3), memory.read(addr));
regs[0] = ( regs[0] & 1 ) | 16 | ( ( addr >> 8 ) & 40 );
if ( !(value & 1) ) regs[0] |= 68;

tstates += ( 1);
	break;case 65:
	
	var addr = (regPairs[9] + offset) & 0xffff;
var value = (tstates += ( 3), memory.read(addr));
regs[0] = ( regs[0] & 1 ) | 16 | ( ( addr >> 8 ) & 40 );
if ( !(value & 1) ) regs[0] |= 68;

tstates += ( 1);
	break;case 66:
	
	var addr = (regPairs[9] + offset) & 0xffff;
var value = (tstates += ( 3), memory.read(addr));
regs[0] = ( regs[0] & 1 ) | 16 | ( ( addr >> 8 ) & 40 );
if ( !(value & 1) ) regs[0] |= 68;

tstates += ( 1);
	break;case 67:
	
	var addr = (regPairs[9] + offset) & 0xffff;
var value = (tstates += ( 3), memory.read(addr));
regs[0] = ( regs[0] & 1 ) | 16 | ( ( addr >> 8 ) & 40 );
if ( !(value & 1) ) regs[0] |= 68;

tstates += ( 1);
	break;case 68:
	
	var addr = (regPairs[9] + offset) & 0xffff;
var value = (tstates += ( 3), memory.read(addr));
regs[0] = ( regs[0] & 1 ) | 16 | ( ( addr >> 8 ) & 40 );
if ( !(value & 1) ) regs[0] |= 68;

tstates += ( 1);
	break;case 69:
	
	var addr = (regPairs[9] + offset) & 0xffff;
var value = (tstates += ( 3), memory.read(addr));
regs[0] = ( regs[0] & 1 ) | 16 | ( ( addr >> 8 ) & 40 );
if ( !(value & 1) ) regs[0] |= 68;

tstates += ( 1);
	break;case 70:
	
	var addr = (regPairs[9] + offset) & 0xffff;
var value = (tstates += ( 3), memory.read(addr));
regs[0] = ( regs[0] & 1 ) | 16 | ( ( addr >> 8 ) & 40 );
if ( !(value & 1) ) regs[0] |= 68;

tstates += ( 1);
	break;case 71:
	
	var addr = (regPairs[9] + offset) & 0xffff;
var value = (tstates += ( 3), memory.read(addr));
regs[0] = ( regs[0] & 1 ) | 16 | ( ( addr >> 8 ) & 40 );
if ( !(value & 1) ) regs[0] |= 68;

tstates += ( 1);
	break;case 72:
	
	var addr = (regPairs[9] + offset) & 0xffff;
var value = (tstates += ( 3), memory.read(addr));
regs[0] = ( regs[0] & 1 ) | 16 | ( ( addr >> 8 ) & 40 );
if ( !(value & 2) ) regs[0] |= 68;

tstates += ( 1);
	break;case 73:
	
	var addr = (regPairs[9] + offset) & 0xffff;
var value = (tstates += ( 3), memory.read(addr));
regs[0] = ( regs[0] & 1 ) | 16 | ( ( addr >> 8 ) & 40 );
if ( !(value & 2) ) regs[0] |= 68;

tstates += ( 1);
	break;case 74:
	
	var addr = (regPairs[9] + offset) & 0xffff;
var value = (tstates += ( 3), memory.read(addr));
regs[0] = ( regs[0] & 1 ) | 16 | ( ( addr >> 8 ) & 40 );
if ( !(value & 2) ) regs[0] |= 68;

tstates += ( 1);
	break;case 75:
	
	var addr = (regPairs[9] + offset) & 0xffff;
var value = (tstates += ( 3), memory.read(addr));
regs[0] = ( regs[0] & 1 ) | 16 | ( ( addr >> 8 ) & 40 );
if ( !(value & 2) ) regs[0] |= 68;

tstates += ( 1);
	break;case 76:
	
	var addr = (regPairs[9] + offset) & 0xffff;
var value = (tstates += ( 3), memory.read(addr));
regs[0] = ( regs[0] & 1 ) | 16 | ( ( addr >> 8 ) & 40 );
if ( !(value & 2) ) regs[0] |= 68;

tstates += ( 1);
	break;case 77:
	
	var addr = (regPairs[9] + offset) & 0xffff;
var value = (tstates += ( 3), memory.read(addr));
regs[0] = ( regs[0] & 1 ) | 16 | ( ( addr >> 8 ) & 40 );
if ( !(value & 2) ) regs[0] |= 68;

tstates += ( 1);
	break;case 78:
	
	var addr = (regPairs[9] + offset) & 0xffff;
var value = (tstates += ( 3), memory.read(addr));
regs[0] = ( regs[0] & 1 ) | 16 | ( ( addr >> 8 ) & 40 );
if ( !(value & 2) ) regs[0] |= 68;

tstates += ( 1);
	break;case 79:
	
	var addr = (regPairs[9] + offset) & 0xffff;
var value = (tstates += ( 3), memory.read(addr));
regs[0] = ( regs[0] & 1 ) | 16 | ( ( addr >> 8 ) & 40 );
if ( !(value & 2) ) regs[0] |= 68;

tstates += ( 1);
	break;case 80:
	
	var addr = (regPairs[9] + offset) & 0xffff;
var value = (tstates += ( 3), memory.read(addr));
regs[0] = ( regs[0] & 1 ) | 16 | ( ( addr >> 8 ) & 40 );
if ( !(value & 4) ) regs[0] |= 68;

tstates += ( 1);
	break;case 81:
	
	var addr = (regPairs[9] + offset) & 0xffff;
var value = (tstates += ( 3), memory.read(addr));
regs[0] = ( regs[0] & 1 ) | 16 | ( ( addr >> 8 ) & 40 );
if ( !(value & 4) ) regs[0] |= 68;

tstates += ( 1);
	break;case 82:
	
	var addr = (regPairs[9] + offset) & 0xffff;
var value = (tstates += ( 3), memory.read(addr));
regs[0] = ( regs[0] & 1 ) | 16 | ( ( addr >> 8 ) & 40 );
if ( !(value & 4) ) regs[0] |= 68;

tstates += ( 1);
	break;case 83:
	
	var addr = (regPairs[9] + offset) & 0xffff;
var value = (tstates += ( 3), memory.read(addr));
regs[0] = ( regs[0] & 1 ) | 16 | ( ( addr >> 8 ) & 40 );
if ( !(value & 4) ) regs[0] |= 68;

tstates += ( 1);
	break;case 84:
	
	var addr = (regPairs[9] + offset) & 0xffff;
var value = (tstates += ( 3), memory.read(addr));
regs[0] = ( regs[0] & 1 ) | 16 | ( ( addr >> 8 ) & 40 );
if ( !(value & 4) ) regs[0] |= 68;

tstates += ( 1);
	break;case 85:
	
	var addr = (regPairs[9] + offset) & 0xffff;
var value = (tstates += ( 3), memory.read(addr));
regs[0] = ( regs[0] & 1 ) | 16 | ( ( addr >> 8 ) & 40 );
if ( !(value & 4) ) regs[0] |= 68;

tstates += ( 1);
	break;case 86:
	
	var addr = (regPairs[9] + offset) & 0xffff;
var value = (tstates += ( 3), memory.read(addr));
regs[0] = ( regs[0] & 1 ) | 16 | ( ( addr >> 8 ) & 40 );
if ( !(value & 4) ) regs[0] |= 68;

tstates += ( 1);
	break;case 87:
	
	var addr = (regPairs[9] + offset) & 0xffff;
var value = (tstates += ( 3), memory.read(addr));
regs[0] = ( regs[0] & 1 ) | 16 | ( ( addr >> 8 ) & 40 );
if ( !(value & 4) ) regs[0] |= 68;

tstates += ( 1);
	break;case 88:
	
	var addr = (regPairs[9] + offset) & 0xffff;
var value = (tstates += ( 3), memory.read(addr));
regs[0] = ( regs[0] & 1 ) | 16 | ( ( addr >> 8 ) & 40 );
if ( !(value & 8) ) regs[0] |= 68;

tstates += ( 1);
	break;case 89:
	
	var addr = (regPairs[9] + offset) & 0xffff;
var value = (tstates += ( 3), memory.read(addr));
regs[0] = ( regs[0] & 1 ) | 16 | ( ( addr >> 8 ) & 40 );
if ( !(value & 8) ) regs[0] |= 68;

tstates += ( 1);
	break;case 90:
	
	var addr = (regPairs[9] + offset) & 0xffff;
var value = (tstates += ( 3), memory.read(addr));
regs[0] = ( regs[0] & 1 ) | 16 | ( ( addr >> 8 ) & 40 );
if ( !(value & 8) ) regs[0] |= 68;

tstates += ( 1);
	break;case 91:
	
	var addr = (regPairs[9] + offset) & 0xffff;
var value = (tstates += ( 3), memory.read(addr));
regs[0] = ( regs[0] & 1 ) | 16 | ( ( addr >> 8 ) & 40 );
if ( !(value & 8) ) regs[0] |= 68;

tstates += ( 1);
	break;case 92:
	
	var addr = (regPairs[9] + offset) & 0xffff;
var value = (tstates += ( 3), memory.read(addr));
regs[0] = ( regs[0] & 1 ) | 16 | ( ( addr >> 8 ) & 40 );
if ( !(value & 8) ) regs[0] |= 68;

tstates += ( 1);
	break;case 93:
	
	var addr = (regPairs[9] + offset) & 0xffff;
var value = (tstates += ( 3), memory.read(addr));
regs[0] = ( regs[0] & 1 ) | 16 | ( ( addr >> 8 ) & 40 );
if ( !(value & 8) ) regs[0] |= 68;

tstates += ( 1);
	break;case 94:
	
	var addr = (regPairs[9] + offset) & 0xffff;
var value = (tstates += ( 3), memory.read(addr));
regs[0] = ( regs[0] & 1 ) | 16 | ( ( addr >> 8 ) & 40 );
if ( !(value & 8) ) regs[0] |= 68;

tstates += ( 1);
	break;case 95:
	
	var addr = (regPairs[9] + offset) & 0xffff;
var value = (tstates += ( 3), memory.read(addr));
regs[0] = ( regs[0] & 1 ) | 16 | ( ( addr >> 8 ) & 40 );
if ( !(value & 8) ) regs[0] |= 68;

tstates += ( 1);
	break;case 96:
	
	var addr = (regPairs[9] + offset) & 0xffff;
var value = (tstates += ( 3), memory.read(addr));
regs[0] = ( regs[0] & 1 ) | 16 | ( ( addr >> 8 ) & 40 );
if ( !(value & 16) ) regs[0] |= 68;

tstates += ( 1);
	break;case 97:
	
	var addr = (regPairs[9] + offset) & 0xffff;
var value = (tstates += ( 3), memory.read(addr));
regs[0] = ( regs[0] & 1 ) | 16 | ( ( addr >> 8 ) & 40 );
if ( !(value & 16) ) regs[0] |= 68;

tstates += ( 1);
	break;case 98:
	
	var addr = (regPairs[9] + offset) & 0xffff;
var value = (tstates += ( 3), memory.read(addr));
regs[0] = ( regs[0] & 1 ) | 16 | ( ( addr >> 8 ) & 40 );
if ( !(value & 16) ) regs[0] |= 68;

tstates += ( 1);
	break;case 99:
	
	var addr = (regPairs[9] + offset) & 0xffff;
var value = (tstates += ( 3), memory.read(addr));
regs[0] = ( regs[0] & 1 ) | 16 | ( ( addr >> 8 ) & 40 );
if ( !(value & 16) ) regs[0] |= 68;

tstates += ( 1);
	break;case 100:
	
	var addr = (regPairs[9] + offset) & 0xffff;
var value = (tstates += ( 3), memory.read(addr));
regs[0] = ( regs[0] & 1 ) | 16 | ( ( addr >> 8 ) & 40 );
if ( !(value & 16) ) regs[0] |= 68;

tstates += ( 1);
	break;case 101:
	
	var addr = (regPairs[9] + offset) & 0xffff;
var value = (tstates += ( 3), memory.read(addr));
regs[0] = ( regs[0] & 1 ) | 16 | ( ( addr >> 8 ) & 40 );
if ( !(value & 16) ) regs[0] |= 68;

tstates += ( 1);
	break;case 102:
	
	var addr = (regPairs[9] + offset) & 0xffff;
var value = (tstates += ( 3), memory.read(addr));
regs[0] = ( regs[0] & 1 ) | 16 | ( ( addr >> 8 ) & 40 );
if ( !(value & 16) ) regs[0] |= 68;

tstates += ( 1);
	break;case 103:
	
	var addr = (regPairs[9] + offset) & 0xffff;
var value = (tstates += ( 3), memory.read(addr));
regs[0] = ( regs[0] & 1 ) | 16 | ( ( addr >> 8 ) & 40 );
if ( !(value & 16) ) regs[0] |= 68;

tstates += ( 1);
	break;case 104:
	
	var addr = (regPairs[9] + offset) & 0xffff;
var value = (tstates += ( 3), memory.read(addr));
regs[0] = ( regs[0] & 1 ) | 16 | ( ( addr >> 8 ) & 40 );
if ( !(value & 32) ) regs[0] |= 68;

tstates += ( 1);
	break;case 105:
	
	var addr = (regPairs[9] + offset) & 0xffff;
var value = (tstates += ( 3), memory.read(addr));
regs[0] = ( regs[0] & 1 ) | 16 | ( ( addr >> 8 ) & 40 );
if ( !(value & 32) ) regs[0] |= 68;

tstates += ( 1);
	break;case 106:
	
	var addr = (regPairs[9] + offset) & 0xffff;
var value = (tstates += ( 3), memory.read(addr));
regs[0] = ( regs[0] & 1 ) | 16 | ( ( addr >> 8 ) & 40 );
if ( !(value & 32) ) regs[0] |= 68;

tstates += ( 1);
	break;case 107:
	
	var addr = (regPairs[9] + offset) & 0xffff;
var value = (tstates += ( 3), memory.read(addr));
regs[0] = ( regs[0] & 1 ) | 16 | ( ( addr >> 8 ) & 40 );
if ( !(value & 32) ) regs[0] |= 68;

tstates += ( 1);
	break;case 108:
	
	var addr = (regPairs[9] + offset) & 0xffff;
var value = (tstates += ( 3), memory.read(addr));
regs[0] = ( regs[0] & 1 ) | 16 | ( ( addr >> 8 ) & 40 );
if ( !(value & 32) ) regs[0] |= 68;

tstates += ( 1);
	break;case 109:
	
	var addr = (regPairs[9] + offset) & 0xffff;
var value = (tstates += ( 3), memory.read(addr));
regs[0] = ( regs[0] & 1 ) | 16 | ( ( addr >> 8 ) & 40 );
if ( !(value & 32) ) regs[0] |= 68;

tstates += ( 1);
	break;case 110:
	
	var addr = (regPairs[9] + offset) & 0xffff;
var value = (tstates += ( 3), memory.read(addr));
regs[0] = ( regs[0] & 1 ) | 16 | ( ( addr >> 8 ) & 40 );
if ( !(value & 32) ) regs[0] |= 68;

tstates += ( 1);
	break;case 111:
	
	var addr = (regPairs[9] + offset) & 0xffff;
var value = (tstates += ( 3), memory.read(addr));
regs[0] = ( regs[0] & 1 ) | 16 | ( ( addr >> 8 ) & 40 );
if ( !(value & 32) ) regs[0] |= 68;

tstates += ( 1);
	break;case 112:
	
	var addr = (regPairs[9] + offset) & 0xffff;
var value = (tstates += ( 3), memory.read(addr));
regs[0] = ( regs[0] & 1 ) | 16 | ( ( addr >> 8 ) & 40 );
if ( !(value & 64) ) regs[0] |= 68;

tstates += ( 1);
	break;case 113:
	
	var addr = (regPairs[9] + offset) & 0xffff;
var value = (tstates += ( 3), memory.read(addr));
regs[0] = ( regs[0] & 1 ) | 16 | ( ( addr >> 8 ) & 40 );
if ( !(value & 64) ) regs[0] |= 68;

tstates += ( 1);
	break;case 114:
	
	var addr = (regPairs[9] + offset) & 0xffff;
var value = (tstates += ( 3), memory.read(addr));
regs[0] = ( regs[0] & 1 ) | 16 | ( ( addr >> 8 ) & 40 );
if ( !(value & 64) ) regs[0] |= 68;

tstates += ( 1);
	break;case 115:
	
	var addr = (regPairs[9] + offset) & 0xffff;
var value = (tstates += ( 3), memory.read(addr));
regs[0] = ( regs[0] & 1 ) | 16 | ( ( addr >> 8 ) & 40 );
if ( !(value & 64) ) regs[0] |= 68;

tstates += ( 1);
	break;case 116:
	
	var addr = (regPairs[9] + offset) & 0xffff;
var value = (tstates += ( 3), memory.read(addr));
regs[0] = ( regs[0] & 1 ) | 16 | ( ( addr >> 8 ) & 40 );
if ( !(value & 64) ) regs[0] |= 68;

tstates += ( 1);
	break;case 117:
	
	var addr = (regPairs[9] + offset) & 0xffff;
var value = (tstates += ( 3), memory.read(addr));
regs[0] = ( regs[0] & 1 ) | 16 | ( ( addr >> 8 ) & 40 );
if ( !(value & 64) ) regs[0] |= 68;

tstates += ( 1);
	break;case 118:
	
	var addr = (regPairs[9] + offset) & 0xffff;
var value = (tstates += ( 3), memory.read(addr));
regs[0] = ( regs[0] & 1 ) | 16 | ( ( addr >> 8 ) & 40 );
if ( !(value & 64) ) regs[0] |= 68;

tstates += ( 1);
	break;case 119:
	
	var addr = (regPairs[9] + offset) & 0xffff;
var value = (tstates += ( 3), memory.read(addr));
regs[0] = ( regs[0] & 1 ) | 16 | ( ( addr >> 8 ) & 40 );
if ( !(value & 64) ) regs[0] |= 68;

tstates += ( 1);
	break;case 120:
	
	var addr = (regPairs[9] + offset) & 0xffff;
var value = (tstates += ( 3), memory.read(addr));
regs[0] = ( regs[0] & 1 ) | 16 | ( ( addr >> 8 ) & 40 );
if ( !(value & 128) ) regs[0] |= 68;
if (value & 0x80) regs[0] |= 128;
tstates += ( 1);
	break;case 121:
	
	var addr = (regPairs[9] + offset) & 0xffff;
var value = (tstates += ( 3), memory.read(addr));
regs[0] = ( regs[0] & 1 ) | 16 | ( ( addr >> 8 ) & 40 );
if ( !(value & 128) ) regs[0] |= 68;
if (value & 0x80) regs[0] |= 128;
tstates += ( 1);
	break;case 122:
	
	var addr = (regPairs[9] + offset) & 0xffff;
var value = (tstates += ( 3), memory.read(addr));
regs[0] = ( regs[0] & 1 ) | 16 | ( ( addr >> 8 ) & 40 );
if ( !(value & 128) ) regs[0] |= 68;
if (value & 0x80) regs[0] |= 128;
tstates += ( 1);
	break;case 123:
	
	var addr = (regPairs[9] + offset) & 0xffff;
var value = (tstates += ( 3), memory.read(addr));
regs[0] = ( regs[0] & 1 ) | 16 | ( ( addr >> 8 ) & 40 );
if ( !(value & 128) ) regs[0] |= 68;
if (value & 0x80) regs[0] |= 128;
tstates += ( 1);
	break;case 124:
	
	var addr = (regPairs[9] + offset) & 0xffff;
var value = (tstates += ( 3), memory.read(addr));
regs[0] = ( regs[0] & 1 ) | 16 | ( ( addr >> 8 ) & 40 );
if ( !(value & 128) ) regs[0] |= 68;
if (value & 0x80) regs[0] |= 128;
tstates += ( 1);
	break;case 125:
	
	var addr = (regPairs[9] + offset) & 0xffff;
var value = (tstates += ( 3), memory.read(addr));
regs[0] = ( regs[0] & 1 ) | 16 | ( ( addr >> 8 ) & 40 );
if ( !(value & 128) ) regs[0] |= 68;
if (value & 0x80) regs[0] |= 128;
tstates += ( 1);
	break;case 126:
	
	var addr = (regPairs[9] + offset) & 0xffff;
var value = (tstates += ( 3), memory.read(addr));
regs[0] = ( regs[0] & 1 ) | 16 | ( ( addr >> 8 ) & 40 );
if ( !(value & 128) ) regs[0] |= 68;
if (value & 0x80) regs[0] |= 128;
tstates += ( 1);
	break;case 127:
	
	var addr = (regPairs[9] + offset) & 0xffff;
var value = (tstates += ( 3), memory.read(addr));
regs[0] = ( regs[0] & 1 ) | 16 | ( ( addr >> 8 ) & 40 );
if ( !(value & 128) ) regs[0] |= 68;
if (value & 0x80) regs[0] |= 128;
tstates += ( 1);
	break;case 128:
	
	var addr = (regPairs[9] + offset) & 0xffff;
regs[3] = (tstates += ( 3), memory.read(addr));

regs[3] &= 254;

tstates += ( 1);
tstates += ( 3);
while (display.nextEventTime != null && display.nextEventTime < tstates) display.doEvent();
memory.write(addr, regs[3]);;
	break;case 129:
	
	var addr = (regPairs[9] + offset) & 0xffff;
regs[2] = (tstates += ( 3), memory.read(addr));

regs[2] &= 254;

tstates += ( 1);
tstates += ( 3);
while (display.nextEventTime != null && display.nextEventTime < tstates) display.doEvent();
memory.write(addr, regs[2]);;
	break;case 130:
	
	var addr = (regPairs[9] + offset) & 0xffff;
regs[5] = (tstates += ( 3), memory.read(addr));

regs[5] &= 254;

tstates += ( 1);
tstates += ( 3);
while (display.nextEventTime != null && display.nextEventTime < tstates) display.doEvent();
memory.write(addr, regs[5]);;
	break;case 131:
	
	var addr = (regPairs[9] + offset) & 0xffff;
regs[4] = (tstates += ( 3), memory.read(addr));

regs[4] &= 254;

tstates += ( 1);
tstates += ( 3);
while (display.nextEventTime != null && display.nextEventTime < tstates) display.doEvent();
memory.write(addr, regs[4]);;
	break;case 132:
	
	var addr = (regPairs[9] + offset) & 0xffff;
regs[7] = (tstates += ( 3), memory.read(addr));

regs[7] &= 254;

tstates += ( 1);
tstates += ( 3);
while (display.nextEventTime != null && display.nextEventTime < tstates) display.doEvent();
memory.write(addr, regs[7]);;
	break;case 133:
	
	var addr = (regPairs[9] + offset) & 0xffff;
regs[6] = (tstates += ( 3), memory.read(addr));

regs[6] &= 254;

tstates += ( 1);
tstates += ( 3);
while (display.nextEventTime != null && display.nextEventTime < tstates) display.doEvent();
memory.write(addr, regs[6]);;
	break;case 134:
	
	var addr = (regPairs[9] + offset) & 0xffff;
var val = (tstates += ( 3), memory.read(addr));
val &= 254;
tstates += ( 1);
tstates += ( 3);
while (display.nextEventTime != null && display.nextEventTime < tstates) display.doEvent();
memory.write(addr, val);;
	break;case 135:
	
	var addr = (regPairs[9] + offset) & 0xffff;
regs[1] = (tstates += ( 3), memory.read(addr));

regs[1] &= 254;

tstates += ( 1);
tstates += ( 3);
while (display.nextEventTime != null && display.nextEventTime < tstates) display.doEvent();
memory.write(addr, regs[1]);;
	break;case 136:
	
	var addr = (regPairs[9] + offset) & 0xffff;
regs[3] = (tstates += ( 3), memory.read(addr));

regs[3] &= 253;

tstates += ( 1);
tstates += ( 3);
while (display.nextEventTime != null && display.nextEventTime < tstates) display.doEvent();
memory.write(addr, regs[3]);;
	break;case 137:
	
	var addr = (regPairs[9] + offset) & 0xffff;
regs[2] = (tstates += ( 3), memory.read(addr));

regs[2] &= 253;

tstates += ( 1);
tstates += ( 3);
while (display.nextEventTime != null && display.nextEventTime < tstates) display.doEvent();
memory.write(addr, regs[2]);;
	break;case 138:
	
	var addr = (regPairs[9] + offset) & 0xffff;
regs[5] = (tstates += ( 3), memory.read(addr));

regs[5] &= 253;

tstates += ( 1);
tstates += ( 3);
while (display.nextEventTime != null && display.nextEventTime < tstates) display.doEvent();
memory.write(addr, regs[5]);;
	break;case 139:
	
	var addr = (regPairs[9] + offset) & 0xffff;
regs[4] = (tstates += ( 3), memory.read(addr));

regs[4] &= 253;

tstates += ( 1);
tstates += ( 3);
while (display.nextEventTime != null && display.nextEventTime < tstates) display.doEvent();
memory.write(addr, regs[4]);;
	break;case 140:
	
	var addr = (regPairs[9] + offset) & 0xffff;
regs[7] = (tstates += ( 3), memory.read(addr));

regs[7] &= 253;

tstates += ( 1);
tstates += ( 3);
while (display.nextEventTime != null && display.nextEventTime < tstates) display.doEvent();
memory.write(addr, regs[7]);;
	break;case 141:
	
	var addr = (regPairs[9] + offset) & 0xffff;
regs[6] = (tstates += ( 3), memory.read(addr));

regs[6] &= 253;

tstates += ( 1);
tstates += ( 3);
while (display.nextEventTime != null && display.nextEventTime < tstates) display.doEvent();
memory.write(addr, regs[6]);;
	break;case 142:
	
	var addr = (regPairs[9] + offset) & 0xffff;
var val = (tstates += ( 3), memory.read(addr));
val &= 253;
tstates += ( 1);
tstates += ( 3);
while (display.nextEventTime != null && display.nextEventTime < tstates) display.doEvent();
memory.write(addr, val);;
	break;case 143:
	
	var addr = (regPairs[9] + offset) & 0xffff;
regs[1] = (tstates += ( 3), memory.read(addr));

regs[1] &= 253;

tstates += ( 1);
tstates += ( 3);
while (display.nextEventTime != null && display.nextEventTime < tstates) display.doEvent();
memory.write(addr, regs[1]);;
	break;case 144:
	
	var addr = (regPairs[9] + offset) & 0xffff;
regs[3] = (tstates += ( 3), memory.read(addr));

regs[3] &= 251;

tstates += ( 1);
tstates += ( 3);
while (display.nextEventTime != null && display.nextEventTime < tstates) display.doEvent();
memory.write(addr, regs[3]);;
	break;case 145:
	
	var addr = (regPairs[9] + offset) & 0xffff;
regs[2] = (tstates += ( 3), memory.read(addr));

regs[2] &= 251;

tstates += ( 1);
tstates += ( 3);
while (display.nextEventTime != null && display.nextEventTime < tstates) display.doEvent();
memory.write(addr, regs[2]);;
	break;case 146:
	
	var addr = (regPairs[9] + offset) & 0xffff;
regs[5] = (tstates += ( 3), memory.read(addr));

regs[5] &= 251;

tstates += ( 1);
tstates += ( 3);
while (display.nextEventTime != null && display.nextEventTime < tstates) display.doEvent();
memory.write(addr, regs[5]);;
	break;case 147:
	
	var addr = (regPairs[9] + offset) & 0xffff;
regs[4] = (tstates += ( 3), memory.read(addr));

regs[4] &= 251;

tstates += ( 1);
tstates += ( 3);
while (display.nextEventTime != null && display.nextEventTime < tstates) display.doEvent();
memory.write(addr, regs[4]);;
	break;case 148:
	
	var addr = (regPairs[9] + offset) & 0xffff;
regs[7] = (tstates += ( 3), memory.read(addr));

regs[7] &= 251;

tstates += ( 1);
tstates += ( 3);
while (display.nextEventTime != null && display.nextEventTime < tstates) display.doEvent();
memory.write(addr, regs[7]);;
	break;case 149:
	
	var addr = (regPairs[9] + offset) & 0xffff;
regs[6] = (tstates += ( 3), memory.read(addr));

regs[6] &= 251;

tstates += ( 1);
tstates += ( 3);
while (display.nextEventTime != null && display.nextEventTime < tstates) display.doEvent();
memory.write(addr, regs[6]);;
	break;case 150:
	
	var addr = (regPairs[9] + offset) & 0xffff;
var val = (tstates += ( 3), memory.read(addr));
val &= 251;
tstates += ( 1);
tstates += ( 3);
while (display.nextEventTime != null && display.nextEventTime < tstates) display.doEvent();
memory.write(addr, val);;
	break;case 151:
	
	var addr = (regPairs[9] + offset) & 0xffff;
regs[1] = (tstates += ( 3), memory.read(addr));

regs[1] &= 251;

tstates += ( 1);
tstates += ( 3);
while (display.nextEventTime != null && display.nextEventTime < tstates) display.doEvent();
memory.write(addr, regs[1]);;
	break;case 152:
	
	var addr = (regPairs[9] + offset) & 0xffff;
regs[3] = (tstates += ( 3), memory.read(addr));

regs[3] &= 247;

tstates += ( 1);
tstates += ( 3);
while (display.nextEventTime != null && display.nextEventTime < tstates) display.doEvent();
memory.write(addr, regs[3]);;
	break;case 153:
	
	var addr = (regPairs[9] + offset) & 0xffff;
regs[2] = (tstates += ( 3), memory.read(addr));

regs[2] &= 247;

tstates += ( 1);
tstates += ( 3);
while (display.nextEventTime != null && display.nextEventTime < tstates) display.doEvent();
memory.write(addr, regs[2]);;
	break;case 154:
	
	var addr = (regPairs[9] + offset) & 0xffff;
regs[5] = (tstates += ( 3), memory.read(addr));

regs[5] &= 247;

tstates += ( 1);
tstates += ( 3);
while (display.nextEventTime != null && display.nextEventTime < tstates) display.doEvent();
memory.write(addr, regs[5]);;
	break;case 155:
	
	var addr = (regPairs[9] + offset) & 0xffff;
regs[4] = (tstates += ( 3), memory.read(addr));

regs[4] &= 247;

tstates += ( 1);
tstates += ( 3);
while (display.nextEventTime != null && display.nextEventTime < tstates) display.doEvent();
memory.write(addr, regs[4]);;
	break;case 156:
	
	var addr = (regPairs[9] + offset) & 0xffff;
regs[7] = (tstates += ( 3), memory.read(addr));

regs[7] &= 247;

tstates += ( 1);
tstates += ( 3);
while (display.nextEventTime != null && display.nextEventTime < tstates) display.doEvent();
memory.write(addr, regs[7]);;
	break;case 157:
	
	var addr = (regPairs[9] + offset) & 0xffff;
regs[6] = (tstates += ( 3), memory.read(addr));

regs[6] &= 247;

tstates += ( 1);
tstates += ( 3);
while (display.nextEventTime != null && display.nextEventTime < tstates) display.doEvent();
memory.write(addr, regs[6]);;
	break;case 158:
	
	var addr = (regPairs[9] + offset) & 0xffff;
var val = (tstates += ( 3), memory.read(addr));
val &= 247;
tstates += ( 1);
tstates += ( 3);
while (display.nextEventTime != null && display.nextEventTime < tstates) display.doEvent();
memory.write(addr, val);;
	break;case 159:
	
	var addr = (regPairs[9] + offset) & 0xffff;
regs[1] = (tstates += ( 3), memory.read(addr));

regs[1] &= 247;

tstates += ( 1);
tstates += ( 3);
while (display.nextEventTime != null && display.nextEventTime < tstates) display.doEvent();
memory.write(addr, regs[1]);;
	break;case 160:
	
	var addr = (regPairs[9] + offset) & 0xffff;
regs[3] = (tstates += ( 3), memory.read(addr));

regs[3] &= 239;

tstates += ( 1);
tstates += ( 3);
while (display.nextEventTime != null && display.nextEventTime < tstates) display.doEvent();
memory.write(addr, regs[3]);;
	break;case 161:
	
	var addr = (regPairs[9] + offset) & 0xffff;
regs[2] = (tstates += ( 3), memory.read(addr));

regs[2] &= 239;

tstates += ( 1);
tstates += ( 3);
while (display.nextEventTime != null && display.nextEventTime < tstates) display.doEvent();
memory.write(addr, regs[2]);;
	break;case 162:
	
	var addr = (regPairs[9] + offset) & 0xffff;
regs[5] = (tstates += ( 3), memory.read(addr));

regs[5] &= 239;

tstates += ( 1);
tstates += ( 3);
while (display.nextEventTime != null && display.nextEventTime < tstates) display.doEvent();
memory.write(addr, regs[5]);;
	break;case 163:
	
	var addr = (regPairs[9] + offset) & 0xffff;
regs[4] = (tstates += ( 3), memory.read(addr));

regs[4] &= 239;

tstates += ( 1);
tstates += ( 3);
while (display.nextEventTime != null && display.nextEventTime < tstates) display.doEvent();
memory.write(addr, regs[4]);;
	break;case 164:
	
	var addr = (regPairs[9] + offset) & 0xffff;
regs[7] = (tstates += ( 3), memory.read(addr));

regs[7] &= 239;

tstates += ( 1);
tstates += ( 3);
while (display.nextEventTime != null && display.nextEventTime < tstates) display.doEvent();
memory.write(addr, regs[7]);;
	break;case 165:
	
	var addr = (regPairs[9] + offset) & 0xffff;
regs[6] = (tstates += ( 3), memory.read(addr));

regs[6] &= 239;

tstates += ( 1);
tstates += ( 3);
while (display.nextEventTime != null && display.nextEventTime < tstates) display.doEvent();
memory.write(addr, regs[6]);;
	break;case 166:
	
	var addr = (regPairs[9] + offset) & 0xffff;
var val = (tstates += ( 3), memory.read(addr));
val &= 239;
tstates += ( 1);
tstates += ( 3);
while (display.nextEventTime != null && display.nextEventTime < tstates) display.doEvent();
memory.write(addr, val);;
	break;case 167:
	
	var addr = (regPairs[9] + offset) & 0xffff;
regs[1] = (tstates += ( 3), memory.read(addr));

regs[1] &= 239;

tstates += ( 1);
tstates += ( 3);
while (display.nextEventTime != null && display.nextEventTime < tstates) display.doEvent();
memory.write(addr, regs[1]);;
	break;case 168:
	
	var addr = (regPairs[9] + offset) & 0xffff;
regs[3] = (tstates += ( 3), memory.read(addr));

regs[3] &= 223;

tstates += ( 1);
tstates += ( 3);
while (display.nextEventTime != null && display.nextEventTime < tstates) display.doEvent();
memory.write(addr, regs[3]);;
	break;case 169:
	
	var addr = (regPairs[9] + offset) & 0xffff;
regs[2] = (tstates += ( 3), memory.read(addr));

regs[2] &= 223;

tstates += ( 1);
tstates += ( 3);
while (display.nextEventTime != null && display.nextEventTime < tstates) display.doEvent();
memory.write(addr, regs[2]);;
	break;case 170:
	
	var addr = (regPairs[9] + offset) & 0xffff;
regs[5] = (tstates += ( 3), memory.read(addr));

regs[5] &= 223;

tstates += ( 1);
tstates += ( 3);
while (display.nextEventTime != null && display.nextEventTime < tstates) display.doEvent();
memory.write(addr, regs[5]);;
	break;case 171:
	
	var addr = (regPairs[9] + offset) & 0xffff;
regs[4] = (tstates += ( 3), memory.read(addr));

regs[4] &= 223;

tstates += ( 1);
tstates += ( 3);
while (display.nextEventTime != null && display.nextEventTime < tstates) display.doEvent();
memory.write(addr, regs[4]);;
	break;case 172:
	
	var addr = (regPairs[9] + offset) & 0xffff;
regs[7] = (tstates += ( 3), memory.read(addr));

regs[7] &= 223;

tstates += ( 1);
tstates += ( 3);
while (display.nextEventTime != null && display.nextEventTime < tstates) display.doEvent();
memory.write(addr, regs[7]);;
	break;case 173:
	
	var addr = (regPairs[9] + offset) & 0xffff;
regs[6] = (tstates += ( 3), memory.read(addr));

regs[6] &= 223;

tstates += ( 1);
tstates += ( 3);
while (display.nextEventTime != null && display.nextEventTime < tstates) display.doEvent();
memory.write(addr, regs[6]);;
	break;case 174:
	
	var addr = (regPairs[9] + offset) & 0xffff;
var val = (tstates += ( 3), memory.read(addr));
val &= 223;
tstates += ( 1);
tstates += ( 3);
while (display.nextEventTime != null && display.nextEventTime < tstates) display.doEvent();
memory.write(addr, val);;
	break;case 175:
	
	var addr = (regPairs[9] + offset) & 0xffff;
regs[1] = (tstates += ( 3), memory.read(addr));

regs[1] &= 223;

tstates += ( 1);
tstates += ( 3);
while (display.nextEventTime != null && display.nextEventTime < tstates) display.doEvent();
memory.write(addr, regs[1]);;
	break;case 176:
	
	var addr = (regPairs[9] + offset) & 0xffff;
regs[3] = (tstates += ( 3), memory.read(addr));

regs[3] &= 191;

tstates += ( 1);
tstates += ( 3);
while (display.nextEventTime != null && display.nextEventTime < tstates) display.doEvent();
memory.write(addr, regs[3]);;
	break;case 177:
	
	var addr = (regPairs[9] + offset) & 0xffff;
regs[2] = (tstates += ( 3), memory.read(addr));

regs[2] &= 191;

tstates += ( 1);
tstates += ( 3);
while (display.nextEventTime != null && display.nextEventTime < tstates) display.doEvent();
memory.write(addr, regs[2]);;
	break;case 178:
	
	var addr = (regPairs[9] + offset) & 0xffff;
regs[5] = (tstates += ( 3), memory.read(addr));

regs[5] &= 191;

tstates += ( 1);
tstates += ( 3);
while (display.nextEventTime != null && display.nextEventTime < tstates) display.doEvent();
memory.write(addr, regs[5]);;
	break;case 179:
	
	var addr = (regPairs[9] + offset) & 0xffff;
regs[4] = (tstates += ( 3), memory.read(addr));

regs[4] &= 191;

tstates += ( 1);
tstates += ( 3);
while (display.nextEventTime != null && display.nextEventTime < tstates) display.doEvent();
memory.write(addr, regs[4]);;
	break;case 180:
	
	var addr = (regPairs[9] + offset) & 0xffff;
regs[7] = (tstates += ( 3), memory.read(addr));

regs[7] &= 191;

tstates += ( 1);
tstates += ( 3);
while (display.nextEventTime != null && display.nextEventTime < tstates) display.doEvent();
memory.write(addr, regs[7]);;
	break;case 181:
	
	var addr = (regPairs[9] + offset) & 0xffff;
regs[6] = (tstates += ( 3), memory.read(addr));

regs[6] &= 191;

tstates += ( 1);
tstates += ( 3);
while (display.nextEventTime != null && display.nextEventTime < tstates) display.doEvent();
memory.write(addr, regs[6]);;
	break;case 182:
	
	var addr = (regPairs[9] + offset) & 0xffff;
var val = (tstates += ( 3), memory.read(addr));
val &= 191;
tstates += ( 1);
tstates += ( 3);
while (display.nextEventTime != null && display.nextEventTime < tstates) display.doEvent();
memory.write(addr, val);;
	break;case 183:
	
	var addr = (regPairs[9] + offset) & 0xffff;
regs[1] = (tstates += ( 3), memory.read(addr));

regs[1] &= 191;

tstates += ( 1);
tstates += ( 3);
while (display.nextEventTime != null && display.nextEventTime < tstates) display.doEvent();
memory.write(addr, regs[1]);;
	break;case 184:
	
	var addr = (regPairs[9] + offset) & 0xffff;
regs[3] = (tstates += ( 3), memory.read(addr));

regs[3] &= 127;

tstates += ( 1);
tstates += ( 3);
while (display.nextEventTime != null && display.nextEventTime < tstates) display.doEvent();
memory.write(addr, regs[3]);;
	break;case 185:
	
	var addr = (regPairs[9] + offset) & 0xffff;
regs[2] = (tstates += ( 3), memory.read(addr));

regs[2] &= 127;

tstates += ( 1);
tstates += ( 3);
while (display.nextEventTime != null && display.nextEventTime < tstates) display.doEvent();
memory.write(addr, regs[2]);;
	break;case 186:
	
	var addr = (regPairs[9] + offset) & 0xffff;
regs[5] = (tstates += ( 3), memory.read(addr));

regs[5] &= 127;

tstates += ( 1);
tstates += ( 3);
while (display.nextEventTime != null && display.nextEventTime < tstates) display.doEvent();
memory.write(addr, regs[5]);;
	break;case 187:
	
	var addr = (regPairs[9] + offset) & 0xffff;
regs[4] = (tstates += ( 3), memory.read(addr));

regs[4] &= 127;

tstates += ( 1);
tstates += ( 3);
while (display.nextEventTime != null && display.nextEventTime < tstates) display.doEvent();
memory.write(addr, regs[4]);;
	break;case 188:
	
	var addr = (regPairs[9] + offset) & 0xffff;
regs[7] = (tstates += ( 3), memory.read(addr));

regs[7] &= 127;

tstates += ( 1);
tstates += ( 3);
while (display.nextEventTime != null && display.nextEventTime < tstates) display.doEvent();
memory.write(addr, regs[7]);;
	break;case 189:
	
	var addr = (regPairs[9] + offset) & 0xffff;
regs[6] = (tstates += ( 3), memory.read(addr));

regs[6] &= 127;

tstates += ( 1);
tstates += ( 3);
while (display.nextEventTime != null && display.nextEventTime < tstates) display.doEvent();
memory.write(addr, regs[6]);;
	break;case 190:
	
	var addr = (regPairs[9] + offset) & 0xffff;
var val = (tstates += ( 3), memory.read(addr));
val &= 127;
tstates += ( 1);
tstates += ( 3);
while (display.nextEventTime != null && display.nextEventTime < tstates) display.doEvent();
memory.write(addr, val);;
	break;case 191:
	
	var addr = (regPairs[9] + offset) & 0xffff;
regs[1] = (tstates += ( 3), memory.read(addr));

regs[1] &= 127;

tstates += ( 1);
tstates += ( 3);
while (display.nextEventTime != null && display.nextEventTime < tstates) display.doEvent();
memory.write(addr, regs[1]);;
	break;case 192:
	
	var addr = (regPairs[9] + offset) & 0xffff;
regs[3] = (tstates += ( 3), memory.read(addr));

regs[3] |= 1;

tstates += ( 1);
tstates += ( 3);
while (display.nextEventTime != null && display.nextEventTime < tstates) display.doEvent();
memory.write(addr, regs[3]);;
	break;case 193:
	
	var addr = (regPairs[9] + offset) & 0xffff;
regs[2] = (tstates += ( 3), memory.read(addr));

regs[2] |= 1;

tstates += ( 1);
tstates += ( 3);
while (display.nextEventTime != null && display.nextEventTime < tstates) display.doEvent();
memory.write(addr, regs[2]);;
	break;case 194:
	
	var addr = (regPairs[9] + offset) & 0xffff;
regs[5] = (tstates += ( 3), memory.read(addr));

regs[5] |= 1;

tstates += ( 1);
tstates += ( 3);
while (display.nextEventTime != null && display.nextEventTime < tstates) display.doEvent();
memory.write(addr, regs[5]);;
	break;case 195:
	
	var addr = (regPairs[9] + offset) & 0xffff;
regs[4] = (tstates += ( 3), memory.read(addr));

regs[4] |= 1;

tstates += ( 1);
tstates += ( 3);
while (display.nextEventTime != null && display.nextEventTime < tstates) display.doEvent();
memory.write(addr, regs[4]);;
	break;case 196:
	
	var addr = (regPairs[9] + offset) & 0xffff;
regs[7] = (tstates += ( 3), memory.read(addr));

regs[7] |= 1;

tstates += ( 1);
tstates += ( 3);
while (display.nextEventTime != null && display.nextEventTime < tstates) display.doEvent();
memory.write(addr, regs[7]);;
	break;case 197:
	
	var addr = (regPairs[9] + offset) & 0xffff;
regs[6] = (tstates += ( 3), memory.read(addr));

regs[6] |= 1;

tstates += ( 1);
tstates += ( 3);
while (display.nextEventTime != null && display.nextEventTime < tstates) display.doEvent();
memory.write(addr, regs[6]);;
	break;case 198:
	
	var addr = (regPairs[9] + offset) & 0xffff;
var val = (tstates += ( 3), memory.read(addr));
val |= 1;
tstates += ( 1);
tstates += ( 3);
while (display.nextEventTime != null && display.nextEventTime < tstates) display.doEvent();
memory.write(addr, val);;
	break;case 199:
	
	var addr = (regPairs[9] + offset) & 0xffff;
regs[1] = (tstates += ( 3), memory.read(addr));

regs[1] |= 1;

tstates += ( 1);
tstates += ( 3);
while (display.nextEventTime != null && display.nextEventTime < tstates) display.doEvent();
memory.write(addr, regs[1]);;
	break;case 200:
	
	var addr = (regPairs[9] + offset) & 0xffff;
regs[3] = (tstates += ( 3), memory.read(addr));

regs[3] |= 2;

tstates += ( 1);
tstates += ( 3);
while (display.nextEventTime != null && display.nextEventTime < tstates) display.doEvent();
memory.write(addr, regs[3]);;
	break;case 201:
	
	var addr = (regPairs[9] + offset) & 0xffff;
regs[2] = (tstates += ( 3), memory.read(addr));

regs[2] |= 2;

tstates += ( 1);
tstates += ( 3);
while (display.nextEventTime != null && display.nextEventTime < tstates) display.doEvent();
memory.write(addr, regs[2]);;
	break;case 202:
	
	var addr = (regPairs[9] + offset) & 0xffff;
regs[5] = (tstates += ( 3), memory.read(addr));

regs[5] |= 2;

tstates += ( 1);
tstates += ( 3);
while (display.nextEventTime != null && display.nextEventTime < tstates) display.doEvent();
memory.write(addr, regs[5]);;
	break;case 203:
	
	var addr = (regPairs[9] + offset) & 0xffff;
regs[4] = (tstates += ( 3), memory.read(addr));

regs[4] |= 2;

tstates += ( 1);
tstates += ( 3);
while (display.nextEventTime != null && display.nextEventTime < tstates) display.doEvent();
memory.write(addr, regs[4]);;
	break;case 204:
	
	var addr = (regPairs[9] + offset) & 0xffff;
regs[7] = (tstates += ( 3), memory.read(addr));

regs[7] |= 2;

tstates += ( 1);
tstates += ( 3);
while (display.nextEventTime != null && display.nextEventTime < tstates) display.doEvent();
memory.write(addr, regs[7]);;
	break;case 205:
	
	var addr = (regPairs[9] + offset) & 0xffff;
regs[6] = (tstates += ( 3), memory.read(addr));

regs[6] |= 2;

tstates += ( 1);
tstates += ( 3);
while (display.nextEventTime != null && display.nextEventTime < tstates) display.doEvent();
memory.write(addr, regs[6]);;
	break;case 206:
	
	var addr = (regPairs[9] + offset) & 0xffff;
var val = (tstates += ( 3), memory.read(addr));
val |= 2;
tstates += ( 1);
tstates += ( 3);
while (display.nextEventTime != null && display.nextEventTime < tstates) display.doEvent();
memory.write(addr, val);;
	break;case 207:
	
	var addr = (regPairs[9] + offset) & 0xffff;
regs[1] = (tstates += ( 3), memory.read(addr));

regs[1] |= 2;

tstates += ( 1);
tstates += ( 3);
while (display.nextEventTime != null && display.nextEventTime < tstates) display.doEvent();
memory.write(addr, regs[1]);;
	break;case 208:
	
	var addr = (regPairs[9] + offset) & 0xffff;
regs[3] = (tstates += ( 3), memory.read(addr));

regs[3] |= 4;

tstates += ( 1);
tstates += ( 3);
while (display.nextEventTime != null && display.nextEventTime < tstates) display.doEvent();
memory.write(addr, regs[3]);;
	break;case 209:
	
	var addr = (regPairs[9] + offset) & 0xffff;
regs[2] = (tstates += ( 3), memory.read(addr));

regs[2] |= 4;

tstates += ( 1);
tstates += ( 3);
while (display.nextEventTime != null && display.nextEventTime < tstates) display.doEvent();
memory.write(addr, regs[2]);;
	break;case 210:
	
	var addr = (regPairs[9] + offset) & 0xffff;
regs[5] = (tstates += ( 3), memory.read(addr));

regs[5] |= 4;

tstates += ( 1);
tstates += ( 3);
while (display.nextEventTime != null && display.nextEventTime < tstates) display.doEvent();
memory.write(addr, regs[5]);;
	break;case 211:
	
	var addr = (regPairs[9] + offset) & 0xffff;
regs[4] = (tstates += ( 3), memory.read(addr));

regs[4] |= 4;

tstates += ( 1);
tstates += ( 3);
while (display.nextEventTime != null && display.nextEventTime < tstates) display.doEvent();
memory.write(addr, regs[4]);;
	break;case 212:
	
	var addr = (regPairs[9] + offset) & 0xffff;
regs[7] = (tstates += ( 3), memory.read(addr));

regs[7] |= 4;

tstates += ( 1);
tstates += ( 3);
while (display.nextEventTime != null && display.nextEventTime < tstates) display.doEvent();
memory.write(addr, regs[7]);;
	break;case 213:
	
	var addr = (regPairs[9] + offset) & 0xffff;
regs[6] = (tstates += ( 3), memory.read(addr));

regs[6] |= 4;

tstates += ( 1);
tstates += ( 3);
while (display.nextEventTime != null && display.nextEventTime < tstates) display.doEvent();
memory.write(addr, regs[6]);;
	break;case 214:
	
	var addr = (regPairs[9] + offset) & 0xffff;
var val = (tstates += ( 3), memory.read(addr));
val |= 4;
tstates += ( 1);
tstates += ( 3);
while (display.nextEventTime != null && display.nextEventTime < tstates) display.doEvent();
memory.write(addr, val);;
	break;case 215:
	
	var addr = (regPairs[9] + offset) & 0xffff;
regs[1] = (tstates += ( 3), memory.read(addr));

regs[1] |= 4;

tstates += ( 1);
tstates += ( 3);
while (display.nextEventTime != null && display.nextEventTime < tstates) display.doEvent();
memory.write(addr, regs[1]);;
	break;case 216:
	
	var addr = (regPairs[9] + offset) & 0xffff;
regs[3] = (tstates += ( 3), memory.read(addr));

regs[3] |= 8;

tstates += ( 1);
tstates += ( 3);
while (display.nextEventTime != null && display.nextEventTime < tstates) display.doEvent();
memory.write(addr, regs[3]);;
	break;case 217:
	
	var addr = (regPairs[9] + offset) & 0xffff;
regs[2] = (tstates += ( 3), memory.read(addr));

regs[2] |= 8;

tstates += ( 1);
tstates += ( 3);
while (display.nextEventTime != null && display.nextEventTime < tstates) display.doEvent();
memory.write(addr, regs[2]);;
	break;case 218:
	
	var addr = (regPairs[9] + offset) & 0xffff;
regs[5] = (tstates += ( 3), memory.read(addr));

regs[5] |= 8;

tstates += ( 1);
tstates += ( 3);
while (display.nextEventTime != null && display.nextEventTime < tstates) display.doEvent();
memory.write(addr, regs[5]);;
	break;case 219:
	
	var addr = (regPairs[9] + offset) & 0xffff;
regs[4] = (tstates += ( 3), memory.read(addr));

regs[4] |= 8;

tstates += ( 1);
tstates += ( 3);
while (display.nextEventTime != null && display.nextEventTime < tstates) display.doEvent();
memory.write(addr, regs[4]);;
	break;case 220:
	
	var addr = (regPairs[9] + offset) & 0xffff;
regs[7] = (tstates += ( 3), memory.read(addr));

regs[7] |= 8;

tstates += ( 1);
tstates += ( 3);
while (display.nextEventTime != null && display.nextEventTime < tstates) display.doEvent();
memory.write(addr, regs[7]);;
	break;case 221:
	
	var addr = (regPairs[9] + offset) & 0xffff;
regs[6] = (tstates += ( 3), memory.read(addr));

regs[6] |= 8;

tstates += ( 1);
tstates += ( 3);
while (display.nextEventTime != null && display.nextEventTime < tstates) display.doEvent();
memory.write(addr, regs[6]);;
	break;case 222:
	
	var addr = (regPairs[9] + offset) & 0xffff;
var val = (tstates += ( 3), memory.read(addr));
val |= 8;
tstates += ( 1);
tstates += ( 3);
while (display.nextEventTime != null && display.nextEventTime < tstates) display.doEvent();
memory.write(addr, val);;
	break;case 223:
	
	var addr = (regPairs[9] + offset) & 0xffff;
regs[1] = (tstates += ( 3), memory.read(addr));

regs[1] |= 8;

tstates += ( 1);
tstates += ( 3);
while (display.nextEventTime != null && display.nextEventTime < tstates) display.doEvent();
memory.write(addr, regs[1]);;
	break;case 224:
	
	var addr = (regPairs[9] + offset) & 0xffff;
regs[3] = (tstates += ( 3), memory.read(addr));

regs[3] |= 16;

tstates += ( 1);
tstates += ( 3);
while (display.nextEventTime != null && display.nextEventTime < tstates) display.doEvent();
memory.write(addr, regs[3]);;
	break;case 225:
	
	var addr = (regPairs[9] + offset) & 0xffff;
regs[2] = (tstates += ( 3), memory.read(addr));

regs[2] |= 16;

tstates += ( 1);
tstates += ( 3);
while (display.nextEventTime != null && display.nextEventTime < tstates) display.doEvent();
memory.write(addr, regs[2]);;
	break;case 226:
	
	var addr = (regPairs[9] + offset) & 0xffff;
regs[5] = (tstates += ( 3), memory.read(addr));

regs[5] |= 16;

tstates += ( 1);
tstates += ( 3);
while (display.nextEventTime != null && display.nextEventTime < tstates) display.doEvent();
memory.write(addr, regs[5]);;
	break;case 227:
	
	var addr = (regPairs[9] + offset) & 0xffff;
regs[4] = (tstates += ( 3), memory.read(addr));

regs[4] |= 16;

tstates += ( 1);
tstates += ( 3);
while (display.nextEventTime != null && display.nextEventTime < tstates) display.doEvent();
memory.write(addr, regs[4]);;
	break;case 228:
	
	var addr = (regPairs[9] + offset) & 0xffff;
regs[7] = (tstates += ( 3), memory.read(addr));

regs[7] |= 16;

tstates += ( 1);
tstates += ( 3);
while (display.nextEventTime != null && display.nextEventTime < tstates) display.doEvent();
memory.write(addr, regs[7]);;
	break;case 229:
	
	var addr = (regPairs[9] + offset) & 0xffff;
regs[6] = (tstates += ( 3), memory.read(addr));

regs[6] |= 16;

tstates += ( 1);
tstates += ( 3);
while (display.nextEventTime != null && display.nextEventTime < tstates) display.doEvent();
memory.write(addr, regs[6]);;
	break;case 230:
	
	var addr = (regPairs[9] + offset) & 0xffff;
var val = (tstates += ( 3), memory.read(addr));
val |= 16;
tstates += ( 1);
tstates += ( 3);
while (display.nextEventTime != null && display.nextEventTime < tstates) display.doEvent();
memory.write(addr, val);;
	break;case 231:
	
	var addr = (regPairs[9] + offset) & 0xffff;
regs[1] = (tstates += ( 3), memory.read(addr));

regs[1] |= 16;

tstates += ( 1);
tstates += ( 3);
while (display.nextEventTime != null && display.nextEventTime < tstates) display.doEvent();
memory.write(addr, regs[1]);;
	break;case 232:
	
	var addr = (regPairs[9] + offset) & 0xffff;
regs[3] = (tstates += ( 3), memory.read(addr));

regs[3] |= 32;

tstates += ( 1);
tstates += ( 3);
while (display.nextEventTime != null && display.nextEventTime < tstates) display.doEvent();
memory.write(addr, regs[3]);;
	break;case 233:
	
	var addr = (regPairs[9] + offset) & 0xffff;
regs[2] = (tstates += ( 3), memory.read(addr));

regs[2] |= 32;

tstates += ( 1);
tstates += ( 3);
while (display.nextEventTime != null && display.nextEventTime < tstates) display.doEvent();
memory.write(addr, regs[2]);;
	break;case 234:
	
	var addr = (regPairs[9] + offset) & 0xffff;
regs[5] = (tstates += ( 3), memory.read(addr));

regs[5] |= 32;

tstates += ( 1);
tstates += ( 3);
while (display.nextEventTime != null && display.nextEventTime < tstates) display.doEvent();
memory.write(addr, regs[5]);;
	break;case 235:
	
	var addr = (regPairs[9] + offset) & 0xffff;
regs[4] = (tstates += ( 3), memory.read(addr));

regs[4] |= 32;

tstates += ( 1);
tstates += ( 3);
while (display.nextEventTime != null && display.nextEventTime < tstates) display.doEvent();
memory.write(addr, regs[4]);;
	break;case 236:
	
	var addr = (regPairs[9] + offset) & 0xffff;
regs[7] = (tstates += ( 3), memory.read(addr));

regs[7] |= 32;

tstates += ( 1);
tstates += ( 3);
while (display.nextEventTime != null && display.nextEventTime < tstates) display.doEvent();
memory.write(addr, regs[7]);;
	break;case 237:
	
	var addr = (regPairs[9] + offset) & 0xffff;
regs[6] = (tstates += ( 3), memory.read(addr));

regs[6] |= 32;

tstates += ( 1);
tstates += ( 3);
while (display.nextEventTime != null && display.nextEventTime < tstates) display.doEvent();
memory.write(addr, regs[6]);;
	break;case 238:
	
	var addr = (regPairs[9] + offset) & 0xffff;
var val = (tstates += ( 3), memory.read(addr));
val |= 32;
tstates += ( 1);
tstates += ( 3);
while (display.nextEventTime != null && display.nextEventTime < tstates) display.doEvent();
memory.write(addr, val);;
	break;case 239:
	
	var addr = (regPairs[9] + offset) & 0xffff;
regs[1] = (tstates += ( 3), memory.read(addr));

regs[1] |= 32;

tstates += ( 1);
tstates += ( 3);
while (display.nextEventTime != null && display.nextEventTime < tstates) display.doEvent();
memory.write(addr, regs[1]);;
	break;case 240:
	
	var addr = (regPairs[9] + offset) & 0xffff;
regs[3] = (tstates += ( 3), memory.read(addr));

regs[3] |= 64;

tstates += ( 1);
tstates += ( 3);
while (display.nextEventTime != null && display.nextEventTime < tstates) display.doEvent();
memory.write(addr, regs[3]);;
	break;case 241:
	
	var addr = (regPairs[9] + offset) & 0xffff;
regs[2] = (tstates += ( 3), memory.read(addr));

regs[2] |= 64;

tstates += ( 1);
tstates += ( 3);
while (display.nextEventTime != null && display.nextEventTime < tstates) display.doEvent();
memory.write(addr, regs[2]);;
	break;case 242:
	
	var addr = (regPairs[9] + offset) & 0xffff;
regs[5] = (tstates += ( 3), memory.read(addr));

regs[5] |= 64;

tstates += ( 1);
tstates += ( 3);
while (display.nextEventTime != null && display.nextEventTime < tstates) display.doEvent();
memory.write(addr, regs[5]);;
	break;case 243:
	
	var addr = (regPairs[9] + offset) & 0xffff;
regs[4] = (tstates += ( 3), memory.read(addr));

regs[4] |= 64;

tstates += ( 1);
tstates += ( 3);
while (display.nextEventTime != null && display.nextEventTime < tstates) display.doEvent();
memory.write(addr, regs[4]);;
	break;case 244:
	
	var addr = (regPairs[9] + offset) & 0xffff;
regs[7] = (tstates += ( 3), memory.read(addr));

regs[7] |= 64;

tstates += ( 1);
tstates += ( 3);
while (display.nextEventTime != null && display.nextEventTime < tstates) display.doEvent();
memory.write(addr, regs[7]);;
	break;case 245:
	
	var addr = (regPairs[9] + offset) & 0xffff;
regs[6] = (tstates += ( 3), memory.read(addr));

regs[6] |= 64;

tstates += ( 1);
tstates += ( 3);
while (display.nextEventTime != null && display.nextEventTime < tstates) display.doEvent();
memory.write(addr, regs[6]);;
	break;case 246:
	
	var addr = (regPairs[9] + offset) & 0xffff;
var val = (tstates += ( 3), memory.read(addr));
val |= 64;
tstates += ( 1);
tstates += ( 3);
while (display.nextEventTime != null && display.nextEventTime < tstates) display.doEvent();
memory.write(addr, val);;
	break;case 247:
	
	var addr = (regPairs[9] + offset) & 0xffff;
regs[1] = (tstates += ( 3), memory.read(addr));

regs[1] |= 64;

tstates += ( 1);
tstates += ( 3);
while (display.nextEventTime != null && display.nextEventTime < tstates) display.doEvent();
memory.write(addr, regs[1]);;
	break;case 248:
	
	var addr = (regPairs[9] + offset) & 0xffff;
regs[3] = (tstates += ( 3), memory.read(addr));

regs[3] |= 128;

tstates += ( 1);
tstates += ( 3);
while (display.nextEventTime != null && display.nextEventTime < tstates) display.doEvent();
memory.write(addr, regs[3]);;
	break;case 249:
	
	var addr = (regPairs[9] + offset) & 0xffff;
regs[2] = (tstates += ( 3), memory.read(addr));

regs[2] |= 128;

tstates += ( 1);
tstates += ( 3);
while (display.nextEventTime != null && display.nextEventTime < tstates) display.doEvent();
memory.write(addr, regs[2]);;
	break;case 250:
	
	var addr = (regPairs[9] + offset) & 0xffff;
regs[5] = (tstates += ( 3), memory.read(addr));

regs[5] |= 128;

tstates += ( 1);
tstates += ( 3);
while (display.nextEventTime != null && display.nextEventTime < tstates) display.doEvent();
memory.write(addr, regs[5]);;
	break;case 251:
	
	var addr = (regPairs[9] + offset) & 0xffff;
regs[4] = (tstates += ( 3), memory.read(addr));

regs[4] |= 128;

tstates += ( 1);
tstates += ( 3);
while (display.nextEventTime != null && display.nextEventTime < tstates) display.doEvent();
memory.write(addr, regs[4]);;
	break;case 252:
	
	var addr = (regPairs[9] + offset) & 0xffff;
regs[7] = (tstates += ( 3), memory.read(addr));

regs[7] |= 128;

tstates += ( 1);
tstates += ( 3);
while (display.nextEventTime != null && display.nextEventTime < tstates) display.doEvent();
memory.write(addr, regs[7]);;
	break;case 253:
	
	var addr = (regPairs[9] + offset) & 0xffff;
regs[6] = (tstates += ( 3), memory.read(addr));

regs[6] |= 128;

tstates += ( 1);
tstates += ( 3);
while (display.nextEventTime != null && display.nextEventTime < tstates) display.doEvent();
memory.write(addr, regs[6]);;
	break;case 254:
	
	var addr = (regPairs[9] + offset) & 0xffff;
var val = (tstates += ( 3), memory.read(addr));
val |= 128;
tstates += ( 1);
tstates += ( 3);
while (display.nextEventTime != null && display.nextEventTime < tstates) display.doEvent();
memory.write(addr, val);;
	break;case 255:
	
	var addr = (regPairs[9] + offset) & 0xffff;
regs[1] = (tstates += ( 3), memory.read(addr));

regs[1] |= 128;

tstates += ( 1);
tstates += ( 3);
while (display.nextEventTime != null && display.nextEventTime < tstates) display.doEvent();
memory.write(addr, regs[1]);;
	break;
	default:
		var addr = regPairs[12] - 1;
		throw("Unimplemented opcode " + opcode + " in page ddcb - PC = " + addr);
}
					break;
				default:
					throw("Unknown opcode prefix: " + lastOpcodePrefix);
			}
		}
		while (display.nextEventTime != null && display.nextEventTime <= tstates) display.doEvent();
	};

	self.reset = function() {
		regPairs[12] = regPairs[10] = 0;
		iff1 = 0; iff2 = 0; im = 0; halted = false;
	};

	self.loadState = function(snapRegs) {
		regPairs[0] = snapRegs['AF'];
		regPairs[1] = snapRegs['BC'];
		regPairs[2] = snapRegs['DE'];
		regPairs[3] = snapRegs['HL'];
		regPairs[4] = snapRegs['AF_'];
		regPairs[5] = snapRegs['BC_'];
		regPairs[6] = snapRegs['DE_'];
		regPairs[7] = snapRegs['HL_'];
		regPairs[8] = snapRegs['IX'];
		regPairs[9] = snapRegs['IY'];
		regPairs[11] = snapRegs['SP'];
		regPairs[12] = snapRegs['PC'];
		regPairs[10] = snapRegs['IR'];
		iff1 = snapRegs['iff1'] & 0xffff;
		iff2 = snapRegs['iff2'] & 0xffff;
		im = snapRegs['im'] & 0xffff;
		halted = !!snapRegs['halted'];
		tstates = snapRegs['T'] * 1;
		interruptPending = !!snapRegs['intp'];
		interruptDataBus = snapRegs['intd'] & 0xffff;
	};

	self.saveState = function() {
		return {
			AF: regPairs[0],
			BC: regPairs[1],
			DE: regPairs[2],
			HL: regPairs[3],
			AF_: regPairs[4],
			BC_: regPairs[5],
			DE_: regPairs[6],
			HL_: regPairs[7],
			IX: regPairs[8],
			IY: regPairs[9],
			SP: regPairs[11],
			PC: regPairs[12],
			IR: regPairs[10],
			iff1: iff1,
			iff2: iff2,
			im: im,
			halted: halted,
			T: tstates,
			intp: interruptPending,
			intd: interruptDataBus,
		};
	};

	/* Register / flag accessors (used for tape trapping and test harness) */
	self.getAF = function() {
		return regPairs[0];
	}
	self.getBC = function() {
		return regPairs[1];
	}
	self.getDE = function() {
		return regPairs[2];
	}
	self.getHL = function() {
		return regPairs[3];
	}
	self.getAF_ = function() {
		return regPairs[4];
	}
	self.getBC_ = function() {
		return regPairs[5];
	}
	self.getDE_ = function() {
		return regPairs[6];
	}
	self.getHL_ = function() {
		return regPairs[7];
	}
	self.getIX = function() {
		return regPairs[8];
	}
	self.getIY = function() {
		return regPairs[9];
	}
	self.getI = function() {
		return regs[21];
	}
	self.getR = function() {
		return regs[20];
	}
	self.getSP = function() {
		return regPairs[11];
	}
	self.getPC = function() {
		return regPairs[12];
	}
	self.getIFF1 = function() {
		return iff1;
	}
	self.getIFF2 = function() {
		return iff2;
	}
	self.getIM = function() {
		return im;
	}
	self.getHalted = function() {
		return halted;
	}

	self.setAF = function(val) {
		regPairs[0] = val;
	}
	self.setBC = function(val) {
		regPairs[1] = val;
	}
	self.setDE = function(val) {
		regPairs[2] = val;
	}
	self.setHL = function(val) {
		regPairs[3] = val;
	}
	self.setAF_ = function(val) {
		regPairs[4] = val;
	}
	self.setBC_ = function(val) {
		regPairs[5] = val;
	}
	self.setDE_ = function(val) {
		regPairs[6] = val;
	}
	self.setHL_ = function(val) {
		regPairs[7] = val;
	}
	self.setIX = function(val) {
		regPairs[8] = val;
	}
	self.setIY = function(val) {
		regPairs[9] = val;
	}
	self.setI = function(val) {
		regs[21] = val;
	}
	self.setR = function(val) {
		regs[20] = val;
	}
	self.setSP = function(val) {
		regPairs[11] = val;
	}
	self.setPC = function(val) {
		regPairs[12] = val;
	}
	self.setIFF1 = function(val) {
		iff1 = val & 0xffff;
	}
	self.setIFF2 = function(val) {
		iff2 = val & 0xffff;
	}
	self.setIM = function(val) {
		im = val & 0xffff;
	}
	self.setHalted = function(val) {
		halted = !!val;
	}

	self.getTstates = function() {
		return tstates;
	}
	self.setTstates = function(val) {
		tstates = val * 1;
	}

	self.getCarry_ = function() {
		return regs[8] & 1;
	};
	self.setCarry = function(val) {
		if (val) {
			regs[0] |= 1;
		} else {
			regs[0] &= -2;
		}
	};
	self.getA_ = function() {
		return regs[9];
	};

	return self;
}
