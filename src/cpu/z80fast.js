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
	case 0: { var fn0 = function() {
	
			
}; fn0(); }
	break;case 1: { var fn1 = function() {
	
	var l = (tstates += ( 3), memory.read(regPairs[12])); regPairs[12]++;
var h = (tstates += ( 3), memory.read(regPairs[12])); regPairs[12]++;
regPairs[1] = (h<<8) | l;
}; fn1(); }
	break;case 2: { var fn2 = function() {
	
	tstates += ( 3);
while (display.nextEventTime != null && display.nextEventTime < tstates) display.doEvent();
memory.write(regPairs[1], regs[1]);;
}; fn2(); }
	break;case 3: { var fn3 = function() {
	
	regPairs[1]++;
tstates += ( 1);
tstates += ( 1);
}; fn3(); }
	break;case 4: { var fn4 = function() {
	
	

regs[0] = (regs[0] & 1) | (regs[3] & 0x0f ? 0 : 16) | 2;
regs[3] = (regs[3] + 1) ;


regs[0] = (regs[0] & 1) | ( regs[3] == 0x80 ? 4 : 0 ) | ( regs[3] & 0x0f ? 0 : 16 ) | sz53Table[regs[3]];
}; fn4(); }
	break;case 5: { var fn5 = function() {
	
	

regs[0] = (regs[0] & 1 ) | ( regs[3] & 0x0f ? 0 : 16 ) | 2;
regs[3] = (regs[3] - 1) ;


regs[0] |= (regs[3] == 0x7f ? 4 : 0) | sz53Table[regs[3]];
}; fn5(); }
	break;case 6: { var fn6 = function() {
	
	regs[3] = (tstates += ( 3), memory.read(regPairs[12])); regPairs[12]++;
}; fn6(); }
	break;case 7: { var fn7 = function() {
	
	regs[1] = (regs[1] << 1) | (regs[1] >> 7);
regs[0] = (regs[0] & 196) | (regs[1] & 41);
}; fn7(); }
	break;case 8: { var fn8 = function() {
	
	var temp = regPairs[0];
regPairs[0] = regPairs[4];
regPairs[4] = temp;
}; fn8(); }
	break;case 9: { var fn9 = function() {
	
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
}; fn9(); }
	break;case 10: { var fn10 = function() {
	
	regs[1] = (tstates += ( 3), memory.read(regPairs[1]));
}; fn10(); }
	break;case 11: { var fn11 = function() {
	
	regPairs[1]--;
tstates += ( 1);
tstates += ( 1);
}; fn11(); }
	break;case 12: { var fn12 = function() {
	
	

regs[0] = (regs[0] & 1) | (regs[2] & 0x0f ? 0 : 16) | 2;
regs[2] = (regs[2] + 1) ;


regs[0] = (regs[0] & 1) | ( regs[2] == 0x80 ? 4 : 0 ) | ( regs[2] & 0x0f ? 0 : 16 ) | sz53Table[regs[2]];
}; fn12(); }
	break;case 13: { var fn13 = function() {
	
	

regs[0] = (regs[0] & 1 ) | ( regs[2] & 0x0f ? 0 : 16 ) | 2;
regs[2] = (regs[2] - 1) ;


regs[0] |= (regs[2] == 0x7f ? 4 : 0) | sz53Table[regs[2]];
}; fn13(); }
	break;case 14: { var fn14 = function() {
	
	regs[2] = (tstates += ( 3), memory.read(regPairs[12])); regPairs[12]++;
}; fn14(); }
	break;case 15: { var fn15 = function() {
	
	regs[0] = (regs[0] & 196) | (regs[1] & 1);
regs[1] = (regs[1] >> 1) | (regs[1] << 7);
regs[0] |= (regs[1] & 40);
}; fn15(); }
	break;case 16: { var fn16 = function() {
	
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
}; fn16(); }
	break;case 17: { var fn17 = function() {
	
	var l = (tstates += ( 3), memory.read(regPairs[12])); regPairs[12]++;
var h = (tstates += ( 3), memory.read(regPairs[12])); regPairs[12]++;
regPairs[2] = (h<<8) | l;
}; fn17(); }
	break;case 18: { var fn18 = function() {
	
	tstates += ( 3);
while (display.nextEventTime != null && display.nextEventTime < tstates) display.doEvent();
memory.write(regPairs[2], regs[1]);;
}; fn18(); }
	break;case 19: { var fn19 = function() {
	
	regPairs[2]++;
tstates += ( 1);
tstates += ( 1);
}; fn19(); }
	break;case 20: { var fn20 = function() {
	
	

regs[0] = (regs[0] & 1) | (regs[5] & 0x0f ? 0 : 16) | 2;
regs[5] = (regs[5] + 1) ;


regs[0] = (regs[0] & 1) | ( regs[5] == 0x80 ? 4 : 0 ) | ( regs[5] & 0x0f ? 0 : 16 ) | sz53Table[regs[5]];
}; fn20(); }
	break;case 21: { var fn21 = function() {
	
	

regs[0] = (regs[0] & 1 ) | ( regs[5] & 0x0f ? 0 : 16 ) | 2;
regs[5] = (regs[5] - 1) ;


regs[0] |= (regs[5] == 0x7f ? 4 : 0) | sz53Table[regs[5]];
}; fn21(); }
	break;case 22: { var fn22 = function() {
	
	regs[5] = (tstates += ( 3), memory.read(regPairs[12])); regPairs[12]++;
}; fn22(); }
	break;case 23: { var fn23 = function() {
	
	var bytetemp = regs[1];
regs[1] = (regs[1] << 1) | (regs[0] & 1);
regs[0] = (regs[0] & 196) | (regs[1] & 40) | (bytetemp >> 7);
}; fn23(); }
	break;case 24: { var fn24 = function() {
	
	var offset = (tstates += ( 3), memory.read(regPairs[12]));
tstates += ( 1);
tstates += ( 1);
tstates += ( 1);
tstates += ( 1);
tstates += ( 1);
regPairs[12]++;
regPairs[12] += (offset & 0x80 ? offset - 0x100 : offset);
}; fn24(); }
	break;case 25: { var fn25 = function() {
	
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
}; fn25(); }
	break;case 26: { var fn26 = function() {
	
	regs[1] = (tstates += ( 3), memory.read(regPairs[2]));
}; fn26(); }
	break;case 27: { var fn27 = function() {
	
	regPairs[2]--;
tstates += ( 1);
tstates += ( 1);
}; fn27(); }
	break;case 28: { var fn28 = function() {
	
	

regs[0] = (regs[0] & 1) | (regs[4] & 0x0f ? 0 : 16) | 2;
regs[4] = (regs[4] + 1) ;


regs[0] = (regs[0] & 1) | ( regs[4] == 0x80 ? 4 : 0 ) | ( regs[4] & 0x0f ? 0 : 16 ) | sz53Table[regs[4]];
}; fn28(); }
	break;case 29: { var fn29 = function() {
	
	

regs[0] = (regs[0] & 1 ) | ( regs[4] & 0x0f ? 0 : 16 ) | 2;
regs[4] = (regs[4] - 1) ;


regs[0] |= (regs[4] == 0x7f ? 4 : 0) | sz53Table[regs[4]];
}; fn29(); }
	break;case 30: { var fn30 = function() {
	
	regs[4] = (tstates += ( 3), memory.read(regPairs[12])); regPairs[12]++;
}; fn30(); }
	break;case 31: { var fn31 = function() {
	
	var bytetemp = regs[1];
regs[1] = (bytetemp >> 1) | (regs[0] << 7);
regs[0] = (regs[0] & 196) | (regs[1] & 40) | (bytetemp & 1);
}; fn31(); }
	break;case 32: { var fn32 = function() {
	
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
}; fn32(); }
	break;case 33: { var fn33 = function() {
	
	var l = (tstates += ( 3), memory.read(regPairs[12])); regPairs[12]++;
var h = (tstates += ( 3), memory.read(regPairs[12])); regPairs[12]++;
regPairs[3] = (h<<8) | l;
}; fn33(); }
	break;case 34: { var fn34 = function() {
	
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
}; fn34(); }
	break;case 35: { var fn35 = function() {
	
	regPairs[3]++;
tstates += ( 1);
tstates += ( 1);
}; fn35(); }
	break;case 36: { var fn36 = function() {
	
	

regs[0] = (regs[0] & 1) | (regs[7] & 0x0f ? 0 : 16) | 2;
regs[7] = (regs[7] + 1) ;


regs[0] = (regs[0] & 1) | ( regs[7] == 0x80 ? 4 : 0 ) | ( regs[7] & 0x0f ? 0 : 16 ) | sz53Table[regs[7]];
}; fn36(); }
	break;case 37: { var fn37 = function() {
	
	

regs[0] = (regs[0] & 1 ) | ( regs[7] & 0x0f ? 0 : 16 ) | 2;
regs[7] = (regs[7] - 1) ;


regs[0] |= (regs[7] == 0x7f ? 4 : 0) | sz53Table[regs[7]];
}; fn37(); }
	break;case 38: { var fn38 = function() {
	
	regs[7] = (tstates += ( 3), memory.read(regPairs[12])); regPairs[12]++;
}; fn38(); }
	break;case 39: { var fn39 = function() {
	
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
}; fn39(); }
	break;case 40: { var fn40 = function() {
	
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
}; fn40(); }
	break;case 41: { var fn41 = function() {
	
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
}; fn41(); }
	break;case 42: { var fn42 = function() {
	
	var l = (tstates += ( 3), memory.read(regPairs[12])); regPairs[12]++;
var h = (tstates += ( 3), memory.read(regPairs[12])); regPairs[12]++;
var addr = (h<<8) | l;
l = (tstates += ( 3), memory.read(addr));
addr = (addr + 1) & 0xffff;
h = (tstates += ( 3), memory.read(addr));
regPairs[3] = (h<<8) | l;
}; fn42(); }
	break;case 43: { var fn43 = function() {
	
	regPairs[3]--;
tstates += ( 1);
tstates += ( 1);
}; fn43(); }
	break;case 44: { var fn44 = function() {
	
	

regs[0] = (regs[0] & 1) | (regs[6] & 0x0f ? 0 : 16) | 2;
regs[6] = (regs[6] + 1) ;


regs[0] = (regs[0] & 1) | ( regs[6] == 0x80 ? 4 : 0 ) | ( regs[6] & 0x0f ? 0 : 16 ) | sz53Table[regs[6]];
}; fn44(); }
	break;case 45: { var fn45 = function() {
	
	

regs[0] = (regs[0] & 1 ) | ( regs[6] & 0x0f ? 0 : 16 ) | 2;
regs[6] = (regs[6] - 1) ;


regs[0] |= (regs[6] == 0x7f ? 4 : 0) | sz53Table[regs[6]];
}; fn45(); }
	break;case 46: { var fn46 = function() {
	
	regs[6] = (tstates += ( 3), memory.read(regPairs[12])); regPairs[12]++;
}; fn46(); }
	break;case 47: { var fn47 = function() {
	
	regs[1] ^= 0xff;
regs[0] = (regs[0] & 197) | (regs[1] & 40) | 18;
}; fn47(); }
	break;case 48: { var fn48 = function() {
	
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
}; fn48(); }
	break;case 49: { var fn49 = function() {
	
	var l = (tstates += ( 3), memory.read(regPairs[12])); regPairs[12]++;
var h = (tstates += ( 3), memory.read(regPairs[12])); regPairs[12]++;
regPairs[11] = (h<<8) | l;
}; fn49(); }
	break;case 50: { var fn50 = function() {
	
	var l = (tstates += ( 3), memory.read(regPairs[12])); regPairs[12]++;
var h = (tstates += ( 3), memory.read(regPairs[12])); regPairs[12]++;
var addr = (h<<8) | l;
tstates += ( 3);
while (display.nextEventTime != null && display.nextEventTime < tstates) display.doEvent();
memory.write(addr, regs[1]);;
}; fn50(); }
	break;case 51: { var fn51 = function() {
	
	regPairs[11]++;
tstates += ( 1);
tstates += ( 1);
}; fn51(); }
	break;case 52: { var fn52 = function() {
	
	var val = (tstates += ( 3), memory.read(regPairs[3]));

regs[0] = (regs[0] & 1) | (val & 0x0f ? 0 : 16) | 2;
val = (val + 1) & 0xff;

tstates += ( 1);
tstates += ( 3);
while (display.nextEventTime != null && display.nextEventTime < tstates) display.doEvent();
memory.write(regPairs[3], val);;
regs[0] = (regs[0] & 1) | ( val == 0x80 ? 4 : 0 ) | ( val & 0x0f ? 0 : 16 ) | sz53Table[val];
}; fn52(); }
	break;case 53: { var fn53 = function() {
	
	var val = (tstates += ( 3), memory.read(regPairs[3]));

regs[0] = (regs[0] & 1 ) | ( val & 0x0f ? 0 : 16 ) | 2;
val = (val - 1) & 0xff;

tstates += ( 1);
tstates += ( 3);
while (display.nextEventTime != null && display.nextEventTime < tstates) display.doEvent();
memory.write(regPairs[3], val);;
regs[0] |= (val == 0x7f ? 4 : 0) | sz53Table[val];
}; fn53(); }
	break;case 54: { var fn54 = function() {
	
	var n = (tstates += ( 3), memory.read(regPairs[12])); regPairs[12]++;
tstates += ( 3);
while (display.nextEventTime != null && display.nextEventTime < tstates) display.doEvent();
memory.write(regPairs[3], n);;
}; fn54(); }
	break;case 55: { var fn55 = function() {
	
	regs[0] = (regs[0] & 196) | (regs[1] & 40) | 1;
}; fn55(); }
	break;case 56: { var fn56 = function() {
	
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
}; fn56(); }
	break;case 57: { var fn57 = function() {
	
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
}; fn57(); }
	break;case 58: { var fn58 = function() {
	
	var l = (tstates += ( 3), memory.read(regPairs[12])); regPairs[12]++;
var h = (tstates += ( 3), memory.read(regPairs[12])); regPairs[12]++;
var addr = (h<<8) | l;
regs[1] = (tstates += ( 3), memory.read(addr));
}; fn58(); }
	break;case 59: { var fn59 = function() {
	
	regPairs[11]--;
tstates += ( 1);
tstates += ( 1);
}; fn59(); }
	break;case 60: { var fn60 = function() {
	
	

regs[0] = (regs[0] & 1) | (regs[1] & 0x0f ? 0 : 16) | 2;
regs[1] = (regs[1] + 1) ;


regs[0] = (regs[0] & 1) | ( regs[1] == 0x80 ? 4 : 0 ) | ( regs[1] & 0x0f ? 0 : 16 ) | sz53Table[regs[1]];
}; fn60(); }
	break;case 61: { var fn61 = function() {
	
	

regs[0] = (regs[0] & 1 ) | ( regs[1] & 0x0f ? 0 : 16 ) | 2;
regs[1] = (regs[1] - 1) ;


regs[0] |= (regs[1] == 0x7f ? 4 : 0) | sz53Table[regs[1]];
}; fn61(); }
	break;case 62: { var fn62 = function() {
	
	regs[1] = (tstates += ( 3), memory.read(regPairs[12])); regPairs[12]++;
}; fn62(); }
	break;case 63: { var fn63 = function() {
	
	regs[0] = ( regs[0] & 196 ) | ( (regs[0] & 1) ? 16 : 1 ) | ( regs[1] & 40 );
}; fn63(); }
	break;case 64: { var fn64 = function() {
	
	regs[3] = regs[3];
}; fn64(); }
	break;case 65: { var fn65 = function() {
	
	regs[3] = regs[2];
}; fn65(); }
	break;case 66: { var fn66 = function() {
	
	regs[3] = regs[5];
}; fn66(); }
	break;case 67: { var fn67 = function() {
	
	regs[3] = regs[4];
}; fn67(); }
	break;case 68: { var fn68 = function() {
	
	regs[3] = regs[7];
}; fn68(); }
	break;case 69: { var fn69 = function() {
	
	regs[3] = regs[6];
}; fn69(); }
	break;case 70: { var fn70 = function() {
	
	regs[3] = (tstates += ( 3), memory.read(regPairs[3]));
}; fn70(); }
	break;case 71: { var fn71 = function() {
	
	regs[3] = regs[1];
}; fn71(); }
	break;case 72: { var fn72 = function() {
	
	regs[2] = regs[3];
}; fn72(); }
	break;case 73: { var fn73 = function() {
	
	regs[2] = regs[2];
}; fn73(); }
	break;case 74: { var fn74 = function() {
	
	regs[2] = regs[5];
}; fn74(); }
	break;case 75: { var fn75 = function() {
	
	regs[2] = regs[4];
}; fn75(); }
	break;case 76: { var fn76 = function() {
	
	regs[2] = regs[7];
}; fn76(); }
	break;case 77: { var fn77 = function() {
	
	regs[2] = regs[6];
}; fn77(); }
	break;case 78: { var fn78 = function() {
	
	regs[2] = (tstates += ( 3), memory.read(regPairs[3]));
}; fn78(); }
	break;case 79: { var fn79 = function() {
	
	regs[2] = regs[1];
}; fn79(); }
	break;case 80: { var fn80 = function() {
	
	regs[5] = regs[3];
}; fn80(); }
	break;case 81: { var fn81 = function() {
	
	regs[5] = regs[2];
}; fn81(); }
	break;case 82: { var fn82 = function() {
	
	regs[5] = regs[5];
}; fn82(); }
	break;case 83: { var fn83 = function() {
	
	regs[5] = regs[4];
}; fn83(); }
	break;case 84: { var fn84 = function() {
	
	regs[5] = regs[7];
}; fn84(); }
	break;case 85: { var fn85 = function() {
	
	regs[5] = regs[6];
}; fn85(); }
	break;case 86: { var fn86 = function() {
	
	regs[5] = (tstates += ( 3), memory.read(regPairs[3]));
}; fn86(); }
	break;case 87: { var fn87 = function() {
	
	regs[5] = regs[1];
}; fn87(); }
	break;case 88: { var fn88 = function() {
	
	regs[4] = regs[3];
}; fn88(); }
	break;case 89: { var fn89 = function() {
	
	regs[4] = regs[2];
}; fn89(); }
	break;case 90: { var fn90 = function() {
	
	regs[4] = regs[5];
}; fn90(); }
	break;case 91: { var fn91 = function() {
	
	regs[4] = regs[4];
}; fn91(); }
	break;case 92: { var fn92 = function() {
	
	regs[4] = regs[7];
}; fn92(); }
	break;case 93: { var fn93 = function() {
	
	regs[4] = regs[6];
}; fn93(); }
	break;case 94: { var fn94 = function() {
	
	regs[4] = (tstates += ( 3), memory.read(regPairs[3]));
}; fn94(); }
	break;case 95: { var fn95 = function() {
	
	regs[4] = regs[1];
}; fn95(); }
	break;case 96: { var fn96 = function() {
	
	regs[7] = regs[3];
}; fn96(); }
	break;case 97: { var fn97 = function() {
	
	regs[7] = regs[2];
}; fn97(); }
	break;case 98: { var fn98 = function() {
	
	regs[7] = regs[5];
}; fn98(); }
	break;case 99: { var fn99 = function() {
	
	regs[7] = regs[4];
}; fn99(); }
	break;case 100: { var fn100 = function() {
	
	regs[7] = regs[7];
}; fn100(); }
	break;case 101: { var fn101 = function() {
	
	regs[7] = regs[6];
}; fn101(); }
	break;case 102: { var fn102 = function() {
	
	regs[7] = (tstates += ( 3), memory.read(regPairs[3]));
}; fn102(); }
	break;case 103: { var fn103 = function() {
	
	regs[7] = regs[1];
}; fn103(); }
	break;case 104: { var fn104 = function() {
	
	regs[6] = regs[3];
}; fn104(); }
	break;case 105: { var fn105 = function() {
	
	regs[6] = regs[2];
}; fn105(); }
	break;case 106: { var fn106 = function() {
	
	regs[6] = regs[5];
}; fn106(); }
	break;case 107: { var fn107 = function() {
	
	regs[6] = regs[4];
}; fn107(); }
	break;case 108: { var fn108 = function() {
	
	regs[6] = regs[7];
}; fn108(); }
	break;case 109: { var fn109 = function() {
	
	regs[6] = regs[6];
}; fn109(); }
	break;case 110: { var fn110 = function() {
	
	regs[6] = (tstates += ( 3), memory.read(regPairs[3]));
}; fn110(); }
	break;case 111: { var fn111 = function() {
	
	regs[6] = regs[1];
}; fn111(); }
	break;case 112: { var fn112 = function() {
	
	tstates += ( 3);
while (display.nextEventTime != null && display.nextEventTime < tstates) display.doEvent();
memory.write(regPairs[3], regs[3]);;
}; fn112(); }
	break;case 113: { var fn113 = function() {
	
	tstates += ( 3);
while (display.nextEventTime != null && display.nextEventTime < tstates) display.doEvent();
memory.write(regPairs[3], regs[2]);;
}; fn113(); }
	break;case 114: { var fn114 = function() {
	
	tstates += ( 3);
while (display.nextEventTime != null && display.nextEventTime < tstates) display.doEvent();
memory.write(regPairs[3], regs[5]);;
}; fn114(); }
	break;case 115: { var fn115 = function() {
	
	tstates += ( 3);
while (display.nextEventTime != null && display.nextEventTime < tstates) display.doEvent();
memory.write(regPairs[3], regs[4]);;
}; fn115(); }
	break;case 116: { var fn116 = function() {
	
	tstates += ( 3);
while (display.nextEventTime != null && display.nextEventTime < tstates) display.doEvent();
memory.write(regPairs[3], regs[7]);;
}; fn116(); }
	break;case 117: { var fn117 = function() {
	
	tstates += ( 3);
while (display.nextEventTime != null && display.nextEventTime < tstates) display.doEvent();
memory.write(regPairs[3], regs[6]);;
}; fn117(); }
	break;case 118: { var fn118 = function() {
	
	halted = true;
regPairs[12]--;
}; fn118(); }
	break;case 119: { var fn119 = function() {
	
	tstates += ( 3);
while (display.nextEventTime != null && display.nextEventTime < tstates) display.doEvent();
memory.write(regPairs[3], regs[1]);;
}; fn119(); }
	break;case 120: { var fn120 = function() {
	
	regs[1] = regs[3];
}; fn120(); }
	break;case 121: { var fn121 = function() {
	
	regs[1] = regs[2];
}; fn121(); }
	break;case 122: { var fn122 = function() {
	
	regs[1] = regs[5];
}; fn122(); }
	break;case 123: { var fn123 = function() {
	
	regs[1] = regs[4];
}; fn123(); }
	break;case 124: { var fn124 = function() {
	
	regs[1] = regs[7];
}; fn124(); }
	break;case 125: { var fn125 = function() {
	
	regs[1] = regs[6];
}; fn125(); }
	break;case 126: { var fn126 = function() {
	
	regs[1] = (tstates += ( 3), memory.read(regPairs[3]));
}; fn126(); }
	break;case 127: { var fn127 = function() {
	
	regs[1] = regs[1];
}; fn127(); }
	break;case 128: { var fn128 = function() {
	
	

var addtemp = regs[1] + regs[3];
var lookup = ( (regs[1] & 0x88) >> 3 ) | ( (regs[3] & 0x88) >> 2 ) | ( (addtemp & 0x88) >> 1 );
regs[1] = addtemp;
regs[0] = ( addtemp & 0x100 ? 1 : 0 ) | halfcarryAddTable[lookup & 0x07] | overflowAddTable[lookup >> 4] | sz53Table[regs[1]];
}; fn128(); }
	break;case 129: { var fn129 = function() {
	
	

var addtemp = regs[1] + regs[2];
var lookup = ( (regs[1] & 0x88) >> 3 ) | ( (regs[2] & 0x88) >> 2 ) | ( (addtemp & 0x88) >> 1 );
regs[1] = addtemp;
regs[0] = ( addtemp & 0x100 ? 1 : 0 ) | halfcarryAddTable[lookup & 0x07] | overflowAddTable[lookup >> 4] | sz53Table[regs[1]];
}; fn129(); }
	break;case 130: { var fn130 = function() {
	
	

var addtemp = regs[1] + regs[5];
var lookup = ( (regs[1] & 0x88) >> 3 ) | ( (regs[5] & 0x88) >> 2 ) | ( (addtemp & 0x88) >> 1 );
regs[1] = addtemp;
regs[0] = ( addtemp & 0x100 ? 1 : 0 ) | halfcarryAddTable[lookup & 0x07] | overflowAddTable[lookup >> 4] | sz53Table[regs[1]];
}; fn130(); }
	break;case 131: { var fn131 = function() {
	
	

var addtemp = regs[1] + regs[4];
var lookup = ( (regs[1] & 0x88) >> 3 ) | ( (regs[4] & 0x88) >> 2 ) | ( (addtemp & 0x88) >> 1 );
regs[1] = addtemp;
regs[0] = ( addtemp & 0x100 ? 1 : 0 ) | halfcarryAddTable[lookup & 0x07] | overflowAddTable[lookup >> 4] | sz53Table[regs[1]];
}; fn131(); }
	break;case 132: { var fn132 = function() {
	
	

var addtemp = regs[1] + regs[7];
var lookup = ( (regs[1] & 0x88) >> 3 ) | ( (regs[7] & 0x88) >> 2 ) | ( (addtemp & 0x88) >> 1 );
regs[1] = addtemp;
regs[0] = ( addtemp & 0x100 ? 1 : 0 ) | halfcarryAddTable[lookup & 0x07] | overflowAddTable[lookup >> 4] | sz53Table[regs[1]];
}; fn132(); }
	break;case 133: { var fn133 = function() {
	
	

var addtemp = regs[1] + regs[6];
var lookup = ( (regs[1] & 0x88) >> 3 ) | ( (regs[6] & 0x88) >> 2 ) | ( (addtemp & 0x88) >> 1 );
regs[1] = addtemp;
regs[0] = ( addtemp & 0x100 ? 1 : 0 ) | halfcarryAddTable[lookup & 0x07] | overflowAddTable[lookup >> 4] | sz53Table[regs[1]];
}; fn133(); }
	break;case 134: { var fn134 = function() {
	
	var val = (tstates += ( 3), memory.read(regPairs[3]));

var addtemp = regs[1] + val;
var lookup = ( (regs[1] & 0x88) >> 3 ) | ( (val & 0x88) >> 2 ) | ( (addtemp & 0x88) >> 1 );
regs[1] = addtemp;
regs[0] = ( addtemp & 0x100 ? 1 : 0 ) | halfcarryAddTable[lookup & 0x07] | overflowAddTable[lookup >> 4] | sz53Table[regs[1]];
}; fn134(); }
	break;case 135: { var fn135 = function() {
	
	

var addtemp = regs[1] + regs[1];
var lookup = ( (regs[1] & 0x88) >> 3 ) | ( (regs[1] & 0x88) >> 2 ) | ( (addtemp & 0x88) >> 1 );
regs[1] = addtemp;
regs[0] = ( addtemp & 0x100 ? 1 : 0 ) | halfcarryAddTable[lookup & 0x07] | overflowAddTable[lookup >> 4] | sz53Table[regs[1]];
}; fn135(); }
	break;case 136: { var fn136 = function() {
	
	

var adctemp = regs[1] + regs[3] + (regs[0] & 1);
var lookup = ( (regs[1] & 0x88) >> 3 ) | ( (regs[3] & 0x88) >> 2 ) | ( (adctemp & 0x88) >> 1 );
regs[1] = adctemp;
regs[0] = ( adctemp & 0x100 ? 1 : 0 ) | halfcarryAddTable[lookup & 0x07] | overflowAddTable[lookup >> 4] | sz53Table[regs[1]];
}; fn136(); }
	break;case 137: { var fn137 = function() {
	
	

var adctemp = regs[1] + regs[2] + (regs[0] & 1);
var lookup = ( (regs[1] & 0x88) >> 3 ) | ( (regs[2] & 0x88) >> 2 ) | ( (adctemp & 0x88) >> 1 );
regs[1] = adctemp;
regs[0] = ( adctemp & 0x100 ? 1 : 0 ) | halfcarryAddTable[lookup & 0x07] | overflowAddTable[lookup >> 4] | sz53Table[regs[1]];
}; fn137(); }
	break;case 138: { var fn138 = function() {
	
	

var adctemp = regs[1] + regs[5] + (regs[0] & 1);
var lookup = ( (regs[1] & 0x88) >> 3 ) | ( (regs[5] & 0x88) >> 2 ) | ( (adctemp & 0x88) >> 1 );
regs[1] = adctemp;
regs[0] = ( adctemp & 0x100 ? 1 : 0 ) | halfcarryAddTable[lookup & 0x07] | overflowAddTable[lookup >> 4] | sz53Table[regs[1]];
}; fn138(); }
	break;case 139: { var fn139 = function() {
	
	

var adctemp = regs[1] + regs[4] + (regs[0] & 1);
var lookup = ( (regs[1] & 0x88) >> 3 ) | ( (regs[4] & 0x88) >> 2 ) | ( (adctemp & 0x88) >> 1 );
regs[1] = adctemp;
regs[0] = ( adctemp & 0x100 ? 1 : 0 ) | halfcarryAddTable[lookup & 0x07] | overflowAddTable[lookup >> 4] | sz53Table[regs[1]];
}; fn139(); }
	break;case 140: { var fn140 = function() {
	
	

var adctemp = regs[1] + regs[7] + (regs[0] & 1);
var lookup = ( (regs[1] & 0x88) >> 3 ) | ( (regs[7] & 0x88) >> 2 ) | ( (adctemp & 0x88) >> 1 );
regs[1] = adctemp;
regs[0] = ( adctemp & 0x100 ? 1 : 0 ) | halfcarryAddTable[lookup & 0x07] | overflowAddTable[lookup >> 4] | sz53Table[regs[1]];
}; fn140(); }
	break;case 141: { var fn141 = function() {
	
	

var adctemp = regs[1] + regs[6] + (regs[0] & 1);
var lookup = ( (regs[1] & 0x88) >> 3 ) | ( (regs[6] & 0x88) >> 2 ) | ( (adctemp & 0x88) >> 1 );
regs[1] = adctemp;
regs[0] = ( adctemp & 0x100 ? 1 : 0 ) | halfcarryAddTable[lookup & 0x07] | overflowAddTable[lookup >> 4] | sz53Table[regs[1]];
}; fn141(); }
	break;case 142: { var fn142 = function() {
	
	var val = (tstates += ( 3), memory.read(regPairs[3]));

var adctemp = regs[1] + val + (regs[0] & 1);
var lookup = ( (regs[1] & 0x88) >> 3 ) | ( (val & 0x88) >> 2 ) | ( (adctemp & 0x88) >> 1 );
regs[1] = adctemp;
regs[0] = ( adctemp & 0x100 ? 1 : 0 ) | halfcarryAddTable[lookup & 0x07] | overflowAddTable[lookup >> 4] | sz53Table[regs[1]];
}; fn142(); }
	break;case 143: { var fn143 = function() {
	
	

var adctemp = regs[1] + regs[1] + (regs[0] & 1);
var lookup = ( (regs[1] & 0x88) >> 3 ) | ( (regs[1] & 0x88) >> 2 ) | ( (adctemp & 0x88) >> 1 );
regs[1] = adctemp;
regs[0] = ( adctemp & 0x100 ? 1 : 0 ) | halfcarryAddTable[lookup & 0x07] | overflowAddTable[lookup >> 4] | sz53Table[regs[1]];
}; fn143(); }
	break;case 144: { var fn144 = function() {
	
	
var subtemp = regs[1] - regs[3];
var lookup = ( (regs[1] & 0x88) >> 3 ) | ( (regs[3] & 0x88) >> 2 ) | ( (subtemp & 0x88) >> 1 );
regs[1] = subtemp;
regs[0] = ( subtemp & 0x100 ? 1 : 0 ) | 2 | halfcarrySubTable[lookup & 0x07] | overflowSubTable[lookup >> 4] | sz53Table[regs[1]];
}; fn144(); }
	break;case 145: { var fn145 = function() {
	
	
var subtemp = regs[1] - regs[2];
var lookup = ( (regs[1] & 0x88) >> 3 ) | ( (regs[2] & 0x88) >> 2 ) | ( (subtemp & 0x88) >> 1 );
regs[1] = subtemp;
regs[0] = ( subtemp & 0x100 ? 1 : 0 ) | 2 | halfcarrySubTable[lookup & 0x07] | overflowSubTable[lookup >> 4] | sz53Table[regs[1]];
}; fn145(); }
	break;case 146: { var fn146 = function() {
	
	
var subtemp = regs[1] - regs[5];
var lookup = ( (regs[1] & 0x88) >> 3 ) | ( (regs[5] & 0x88) >> 2 ) | ( (subtemp & 0x88) >> 1 );
regs[1] = subtemp;
regs[0] = ( subtemp & 0x100 ? 1 : 0 ) | 2 | halfcarrySubTable[lookup & 0x07] | overflowSubTable[lookup >> 4] | sz53Table[regs[1]];
}; fn146(); }
	break;case 147: { var fn147 = function() {
	
	
var subtemp = regs[1] - regs[4];
var lookup = ( (regs[1] & 0x88) >> 3 ) | ( (regs[4] & 0x88) >> 2 ) | ( (subtemp & 0x88) >> 1 );
regs[1] = subtemp;
regs[0] = ( subtemp & 0x100 ? 1 : 0 ) | 2 | halfcarrySubTable[lookup & 0x07] | overflowSubTable[lookup >> 4] | sz53Table[regs[1]];
}; fn147(); }
	break;case 148: { var fn148 = function() {
	
	
var subtemp = regs[1] - regs[7];
var lookup = ( (regs[1] & 0x88) >> 3 ) | ( (regs[7] & 0x88) >> 2 ) | ( (subtemp & 0x88) >> 1 );
regs[1] = subtemp;
regs[0] = ( subtemp & 0x100 ? 1 : 0 ) | 2 | halfcarrySubTable[lookup & 0x07] | overflowSubTable[lookup >> 4] | sz53Table[regs[1]];
}; fn148(); }
	break;case 149: { var fn149 = function() {
	
	
var subtemp = regs[1] - regs[6];
var lookup = ( (regs[1] & 0x88) >> 3 ) | ( (regs[6] & 0x88) >> 2 ) | ( (subtemp & 0x88) >> 1 );
regs[1] = subtemp;
regs[0] = ( subtemp & 0x100 ? 1 : 0 ) | 2 | halfcarrySubTable[lookup & 0x07] | overflowSubTable[lookup >> 4] | sz53Table[regs[1]];
}; fn149(); }
	break;case 150: { var fn150 = function() {
	
	var val = (tstates += ( 3), memory.read(regPairs[3]));
var subtemp = regs[1] - val;
var lookup = ( (regs[1] & 0x88) >> 3 ) | ( (val & 0x88) >> 2 ) | ( (subtemp & 0x88) >> 1 );
regs[1] = subtemp;
regs[0] = ( subtemp & 0x100 ? 1 : 0 ) | 2 | halfcarrySubTable[lookup & 0x07] | overflowSubTable[lookup >> 4] | sz53Table[regs[1]];
}; fn150(); }
	break;case 151: { var fn151 = function() {
	
	
var subtemp = regs[1] - regs[1];
var lookup = ( (regs[1] & 0x88) >> 3 ) | ( (regs[1] & 0x88) >> 2 ) | ( (subtemp & 0x88) >> 1 );
regs[1] = subtemp;
regs[0] = ( subtemp & 0x100 ? 1 : 0 ) | 2 | halfcarrySubTable[lookup & 0x07] | overflowSubTable[lookup >> 4] | sz53Table[regs[1]];
}; fn151(); }
	break;case 152: { var fn152 = function() {
	
	
var sbctemp = regs[1] - regs[3] - (regs[0] & 1);
var lookup = ( (regs[1] & 0x88) >> 3 ) | ( (regs[3] & 0x88) >> 2 ) | ( (sbctemp & 0x88) >> 1 );
regs[1] = sbctemp;
regs[0] = ( sbctemp & 0x100 ? 1 : 0 ) | 2 | halfcarrySubTable[lookup & 0x07] | overflowSubTable[lookup >> 4] | sz53Table[regs[1]];
}; fn152(); }
	break;case 153: { var fn153 = function() {
	
	
var sbctemp = regs[1] - regs[2] - (regs[0] & 1);
var lookup = ( (regs[1] & 0x88) >> 3 ) | ( (regs[2] & 0x88) >> 2 ) | ( (sbctemp & 0x88) >> 1 );
regs[1] = sbctemp;
regs[0] = ( sbctemp & 0x100 ? 1 : 0 ) | 2 | halfcarrySubTable[lookup & 0x07] | overflowSubTable[lookup >> 4] | sz53Table[regs[1]];
}; fn153(); }
	break;case 154: { var fn154 = function() {
	
	
var sbctemp = regs[1] - regs[5] - (regs[0] & 1);
var lookup = ( (regs[1] & 0x88) >> 3 ) | ( (regs[5] & 0x88) >> 2 ) | ( (sbctemp & 0x88) >> 1 );
regs[1] = sbctemp;
regs[0] = ( sbctemp & 0x100 ? 1 : 0 ) | 2 | halfcarrySubTable[lookup & 0x07] | overflowSubTable[lookup >> 4] | sz53Table[regs[1]];
}; fn154(); }
	break;case 155: { var fn155 = function() {
	
	
var sbctemp = regs[1] - regs[4] - (regs[0] & 1);
var lookup = ( (regs[1] & 0x88) >> 3 ) | ( (regs[4] & 0x88) >> 2 ) | ( (sbctemp & 0x88) >> 1 );
regs[1] = sbctemp;
regs[0] = ( sbctemp & 0x100 ? 1 : 0 ) | 2 | halfcarrySubTable[lookup & 0x07] | overflowSubTable[lookup >> 4] | sz53Table[regs[1]];
}; fn155(); }
	break;case 156: { var fn156 = function() {
	
	
var sbctemp = regs[1] - regs[7] - (regs[0] & 1);
var lookup = ( (regs[1] & 0x88) >> 3 ) | ( (regs[7] & 0x88) >> 2 ) | ( (sbctemp & 0x88) >> 1 );
regs[1] = sbctemp;
regs[0] = ( sbctemp & 0x100 ? 1 : 0 ) | 2 | halfcarrySubTable[lookup & 0x07] | overflowSubTable[lookup >> 4] | sz53Table[regs[1]];
}; fn156(); }
	break;case 157: { var fn157 = function() {
	
	
var sbctemp = regs[1] - regs[6] - (regs[0] & 1);
var lookup = ( (regs[1] & 0x88) >> 3 ) | ( (regs[6] & 0x88) >> 2 ) | ( (sbctemp & 0x88) >> 1 );
regs[1] = sbctemp;
regs[0] = ( sbctemp & 0x100 ? 1 : 0 ) | 2 | halfcarrySubTable[lookup & 0x07] | overflowSubTable[lookup >> 4] | sz53Table[regs[1]];
}; fn157(); }
	break;case 158: { var fn158 = function() {
	
	var val = (tstates += ( 3), memory.read(regPairs[3]));
var sbctemp = regs[1] - val - (regs[0] & 1);
var lookup = ( (regs[1] & 0x88) >> 3 ) | ( (val & 0x88) >> 2 ) | ( (sbctemp & 0x88) >> 1 );
regs[1] = sbctemp;
regs[0] = ( sbctemp & 0x100 ? 1 : 0 ) | 2 | halfcarrySubTable[lookup & 0x07] | overflowSubTable[lookup >> 4] | sz53Table[regs[1]];
}; fn158(); }
	break;case 159: { var fn159 = function() {
	
	
var sbctemp = regs[1] - regs[1] - (regs[0] & 1);
var lookup = ( (regs[1] & 0x88) >> 3 ) | ( (regs[1] & 0x88) >> 2 ) | ( (sbctemp & 0x88) >> 1 );
regs[1] = sbctemp;
regs[0] = ( sbctemp & 0x100 ? 1 : 0 ) | 2 | halfcarrySubTable[lookup & 0x07] | overflowSubTable[lookup >> 4] | sz53Table[regs[1]];
}; fn159(); }
	break;case 160: { var fn160 = function() {
	
	

regs[1] &= regs[3];
regs[0] = 16 | sz53pTable[regs[1]];
}; fn160(); }
	break;case 161: { var fn161 = function() {
	
	

regs[1] &= regs[2];
regs[0] = 16 | sz53pTable[regs[1]];
}; fn161(); }
	break;case 162: { var fn162 = function() {
	
	

regs[1] &= regs[5];
regs[0] = 16 | sz53pTable[regs[1]];
}; fn162(); }
	break;case 163: { var fn163 = function() {
	
	

regs[1] &= regs[4];
regs[0] = 16 | sz53pTable[regs[1]];
}; fn163(); }
	break;case 164: { var fn164 = function() {
	
	

regs[1] &= regs[7];
regs[0] = 16 | sz53pTable[regs[1]];
}; fn164(); }
	break;case 165: { var fn165 = function() {
	
	

regs[1] &= regs[6];
regs[0] = 16 | sz53pTable[regs[1]];
}; fn165(); }
	break;case 166: { var fn166 = function() {
	
	var val = (tstates += ( 3), memory.read(regPairs[3]));

regs[1] &= val;
regs[0] = 16 | sz53pTable[regs[1]];
}; fn166(); }
	break;case 167: { var fn167 = function() {
	
	

regs[1] &= regs[1];
regs[0] = 16 | sz53pTable[regs[1]];
}; fn167(); }
	break;case 168: { var fn168 = function() {
	
	
regs[1] ^= regs[3];
regs[0] = sz53pTable[regs[1]];
}; fn168(); }
	break;case 169: { var fn169 = function() {
	
	
regs[1] ^= regs[2];
regs[0] = sz53pTable[regs[1]];
}; fn169(); }
	break;case 170: { var fn170 = function() {
	
	
regs[1] ^= regs[5];
regs[0] = sz53pTable[regs[1]];
}; fn170(); }
	break;case 171: { var fn171 = function() {
	
	
regs[1] ^= regs[4];
regs[0] = sz53pTable[regs[1]];
}; fn171(); }
	break;case 172: { var fn172 = function() {
	
	
regs[1] ^= regs[7];
regs[0] = sz53pTable[regs[1]];
}; fn172(); }
	break;case 173: { var fn173 = function() {
	
	
regs[1] ^= regs[6];
regs[0] = sz53pTable[regs[1]];
}; fn173(); }
	break;case 174: { var fn174 = function() {
	
	var val = (tstates += ( 3), memory.read(regPairs[3]));
regs[1] ^= val;
regs[0] = sz53pTable[regs[1]];
}; fn174(); }
	break;case 175: { var fn175 = function() {
	
	
regs[1] ^= regs[1];
regs[0] = sz53pTable[regs[1]];
}; fn175(); }
	break;case 176: { var fn176 = function() {
	
	

regs[1] |= regs[3];
regs[0] = sz53pTable[regs[1]];
}; fn176(); }
	break;case 177: { var fn177 = function() {
	
	

regs[1] |= regs[2];
regs[0] = sz53pTable[regs[1]];
}; fn177(); }
	break;case 178: { var fn178 = function() {
	
	

regs[1] |= regs[5];
regs[0] = sz53pTable[regs[1]];
}; fn178(); }
	break;case 179: { var fn179 = function() {
	
	

regs[1] |= regs[4];
regs[0] = sz53pTable[regs[1]];
}; fn179(); }
	break;case 180: { var fn180 = function() {
	
	

regs[1] |= regs[7];
regs[0] = sz53pTable[regs[1]];
}; fn180(); }
	break;case 181: { var fn181 = function() {
	
	

regs[1] |= regs[6];
regs[0] = sz53pTable[regs[1]];
}; fn181(); }
	break;case 182: { var fn182 = function() {
	
	var val = (tstates += ( 3), memory.read(regPairs[3]));

regs[1] |= val;
regs[0] = sz53pTable[regs[1]];
}; fn182(); }
	break;case 183: { var fn183 = function() {
	
	

regs[1] |= regs[1];
regs[0] = sz53pTable[regs[1]];
}; fn183(); }
	break;case 184: { var fn184 = function() {
	
	

var cptemp = regs[1] - regs[3];
var lookup = ( (regs[1] & 0x88) >> 3 ) | ( (regs[3] & 0x88) >> 2 ) | ( (cptemp & 0x88) >> 1 );
regs[0] = ( cptemp & 0x100 ? 1 : ( cptemp ? 0 : 64 ) ) | 2 | halfcarrySubTable[lookup & 0x07] | overflowSubTable[lookup >> 4] | ( regs[3] & 40 ) | ( cptemp & 128 );
}; fn184(); }
	break;case 185: { var fn185 = function() {
	
	

var cptemp = regs[1] - regs[2];
var lookup = ( (regs[1] & 0x88) >> 3 ) | ( (regs[2] & 0x88) >> 2 ) | ( (cptemp & 0x88) >> 1 );
regs[0] = ( cptemp & 0x100 ? 1 : ( cptemp ? 0 : 64 ) ) | 2 | halfcarrySubTable[lookup & 0x07] | overflowSubTable[lookup >> 4] | ( regs[2] & 40 ) | ( cptemp & 128 );
}; fn185(); }
	break;case 186: { var fn186 = function() {
	
	

var cptemp = regs[1] - regs[5];
var lookup = ( (regs[1] & 0x88) >> 3 ) | ( (regs[5] & 0x88) >> 2 ) | ( (cptemp & 0x88) >> 1 );
regs[0] = ( cptemp & 0x100 ? 1 : ( cptemp ? 0 : 64 ) ) | 2 | halfcarrySubTable[lookup & 0x07] | overflowSubTable[lookup >> 4] | ( regs[5] & 40 ) | ( cptemp & 128 );
}; fn186(); }
	break;case 187: { var fn187 = function() {
	
	

var cptemp = regs[1] - regs[4];
var lookup = ( (regs[1] & 0x88) >> 3 ) | ( (regs[4] & 0x88) >> 2 ) | ( (cptemp & 0x88) >> 1 );
regs[0] = ( cptemp & 0x100 ? 1 : ( cptemp ? 0 : 64 ) ) | 2 | halfcarrySubTable[lookup & 0x07] | overflowSubTable[lookup >> 4] | ( regs[4] & 40 ) | ( cptemp & 128 );
}; fn187(); }
	break;case 188: { var fn188 = function() {
	
	

var cptemp = regs[1] - regs[7];
var lookup = ( (regs[1] & 0x88) >> 3 ) | ( (regs[7] & 0x88) >> 2 ) | ( (cptemp & 0x88) >> 1 );
regs[0] = ( cptemp & 0x100 ? 1 : ( cptemp ? 0 : 64 ) ) | 2 | halfcarrySubTable[lookup & 0x07] | overflowSubTable[lookup >> 4] | ( regs[7] & 40 ) | ( cptemp & 128 );
}; fn188(); }
	break;case 189: { var fn189 = function() {
	
	

var cptemp = regs[1] - regs[6];
var lookup = ( (regs[1] & 0x88) >> 3 ) | ( (regs[6] & 0x88) >> 2 ) | ( (cptemp & 0x88) >> 1 );
regs[0] = ( cptemp & 0x100 ? 1 : ( cptemp ? 0 : 64 ) ) | 2 | halfcarrySubTable[lookup & 0x07] | overflowSubTable[lookup >> 4] | ( regs[6] & 40 ) | ( cptemp & 128 );
}; fn189(); }
	break;case 190: { var fn190 = function() {
	
	var val = (tstates += ( 3), memory.read(regPairs[3]));

var cptemp = regs[1] - val;
var lookup = ( (regs[1] & 0x88) >> 3 ) | ( (val & 0x88) >> 2 ) | ( (cptemp & 0x88) >> 1 );
regs[0] = ( cptemp & 0x100 ? 1 : ( cptemp ? 0 : 64 ) ) | 2 | halfcarrySubTable[lookup & 0x07] | overflowSubTable[lookup >> 4] | ( val & 40 ) | ( cptemp & 128 );
}; fn190(); }
	break;case 191: { var fn191 = function() {
	
	

var cptemp = regs[1] - regs[1];
var lookup = ( (regs[1] & 0x88) >> 3 ) | ( (regs[1] & 0x88) >> 2 ) | ( (cptemp & 0x88) >> 1 );
regs[0] = ( cptemp & 0x100 ? 1 : ( cptemp ? 0 : 64 ) ) | 2 | halfcarrySubTable[lookup & 0x07] | overflowSubTable[lookup >> 4] | ( regs[1] & 40 ) | ( cptemp & 128 );
}; fn191(); }
	break;case 192: { var fn192 = function() {
	
	tstates += ( 1);
if (!(regs[0] & 64)) {
	var l = (tstates += ( 3), memory.read(regPairs[11])); regPairs[11]++;
	var h = (tstates += ( 3), memory.read(regPairs[11])); regPairs[11]++;
	regPairs[12] = (h<<8) | l;
}
}; fn192(); }
	break;case 193: { var fn193 = function() {
	
	var l = (tstates += ( 3), memory.read(regPairs[11])); regPairs[11]++;
var h = (tstates += ( 3), memory.read(regPairs[11])); regPairs[11]++;
regPairs[1] = (h<<8) | l;
}; fn193(); }
	break;case 194: { var fn194 = function() {
	
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
}; fn194(); }
	break;case 195: { var fn195 = function() {
	
	var l = (tstates += ( 3), memory.read(regPairs[12])); regPairs[12]++;
var h = (tstates += ( 3), memory.read(regPairs[12])); regPairs[12]++;
regPairs[12] = (h<<8) | l;
}; fn195(); }
	break;case 196: { var fn196 = function() {
	
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
}; fn196(); }
	break;case 197: { var fn197 = function() {
	
	tstates += ( 1);
regPairs[11]--; tstates += ( 3);
while (display.nextEventTime != null && display.nextEventTime < tstates) display.doEvent();
memory.write(regPairs[11], regPairs[1] >> 8);;
regPairs[11]--; tstates += ( 3);
while (display.nextEventTime != null && display.nextEventTime < tstates) display.doEvent();
memory.write(regPairs[11], regPairs[1] & 0xff);;
}; fn197(); }
	break;case 198: { var fn198 = function() {
	
	var val = (tstates += ( 3), memory.read(regPairs[12])); regPairs[12]++;

var addtemp = regs[1] + val;
var lookup = ( (regs[1] & 0x88) >> 3 ) | ( (val & 0x88) >> 2 ) | ( (addtemp & 0x88) >> 1 );
regs[1] = addtemp;
regs[0] = ( addtemp & 0x100 ? 1 : 0 ) | halfcarryAddTable[lookup & 0x07] | overflowAddTable[lookup >> 4] | sz53Table[regs[1]];
}; fn198(); }
	break;case 199: { var fn199 = function() {
	
	tstates += ( 1);
regPairs[11]--; tstates += ( 3);
while (display.nextEventTime != null && display.nextEventTime < tstates) display.doEvent();
memory.write(regPairs[11], regPairs[12] >> 8);;
regPairs[11]--; tstates += ( 3);
while (display.nextEventTime != null && display.nextEventTime < tstates) display.doEvent();
memory.write(regPairs[11], regPairs[12] & 0xff);;
regPairs[12] = 0;
}; fn199(); }
	break;case 200: { var fn200 = function() {
	
	tstates += ( 1);
if (regs[0] & 64) {
	var l = (tstates += ( 3), memory.read(regPairs[11])); regPairs[11]++;
	var h = (tstates += ( 3), memory.read(regPairs[11])); regPairs[11]++;
	regPairs[12] = (h<<8) | l;
}
}; fn200(); }
	break;case 201: { var fn201 = function() {
	
	var l = (tstates += ( 3), memory.read(regPairs[11])); regPairs[11]++;
var h = (tstates += ( 3), memory.read(regPairs[11])); regPairs[11]++;
regPairs[12] = (h<<8) | l;
}; fn201(); }
	break;case 202: { var fn202 = function() {
	
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
}; fn202(); }
	break;case 203: { var fn203 = function() {
	
	opcodePrefix = 'CB';
interruptible = false;
}; fn203(); }
	break;case 204: { var fn204 = function() {
	
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
}; fn204(); }
	break;case 205: { var fn205 = function() {
	
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
}; fn205(); }
	break;case 206: { var fn206 = function() {
	
	var val = (tstates += ( 3), memory.read(regPairs[12])); regPairs[12]++;

var adctemp = regs[1] + val + (regs[0] & 1);
var lookup = ( (regs[1] & 0x88) >> 3 ) | ( (val & 0x88) >> 2 ) | ( (adctemp & 0x88) >> 1 );
regs[1] = adctemp;
regs[0] = ( adctemp & 0x100 ? 1 : 0 ) | halfcarryAddTable[lookup & 0x07] | overflowAddTable[lookup >> 4] | sz53Table[regs[1]];
}; fn206(); }
	break;case 207: { var fn207 = function() {
	
	tstates += ( 1);
regPairs[11]--; tstates += ( 3);
while (display.nextEventTime != null && display.nextEventTime < tstates) display.doEvent();
memory.write(regPairs[11], regPairs[12] >> 8);;
regPairs[11]--; tstates += ( 3);
while (display.nextEventTime != null && display.nextEventTime < tstates) display.doEvent();
memory.write(regPairs[11], regPairs[12] & 0xff);;
regPairs[12] = 8;
}; fn207(); }
	break;case 208: { var fn208 = function() {
	
	tstates += ( 1);
if (!(regs[0] & 1)) {
	var l = (tstates += ( 3), memory.read(regPairs[11])); regPairs[11]++;
	var h = (tstates += ( 3), memory.read(regPairs[11])); regPairs[11]++;
	regPairs[12] = (h<<8) | l;
}
}; fn208(); }
	break;case 209: { var fn209 = function() {
	
	var l = (tstates += ( 3), memory.read(regPairs[11])); regPairs[11]++;
var h = (tstates += ( 3), memory.read(regPairs[11])); regPairs[11]++;
regPairs[2] = (h<<8) | l;
}; fn209(); }
	break;case 210: { var fn210 = function() {
	
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
}; fn210(); }
	break;case 211: { var fn211 = function() {
	
	var port = (regs[1] << 8) | (tstates += ( 3), memory.read(regPairs[12])); regPairs[12]++;
tstates += 1;
ioBus.write(port, regs[1], tstates);
tstates += 3;
}; fn211(); }
	break;case 212: { var fn212 = function() {
	
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
}; fn212(); }
	break;case 213: { var fn213 = function() {
	
	tstates += ( 1);
regPairs[11]--; tstates += ( 3);
while (display.nextEventTime != null && display.nextEventTime < tstates) display.doEvent();
memory.write(regPairs[11], regPairs[2] >> 8);;
regPairs[11]--; tstates += ( 3);
while (display.nextEventTime != null && display.nextEventTime < tstates) display.doEvent();
memory.write(regPairs[11], regPairs[2] & 0xff);;
}; fn213(); }
	break;case 214: { var fn214 = function() {
	
	var val = (tstates += ( 3), memory.read(regPairs[12])); regPairs[12]++;
var subtemp = regs[1] - val;
var lookup = ( (regs[1] & 0x88) >> 3 ) | ( (val & 0x88) >> 2 ) | ( (subtemp & 0x88) >> 1 );
regs[1] = subtemp;
regs[0] = ( subtemp & 0x100 ? 1 : 0 ) | 2 | halfcarrySubTable[lookup & 0x07] | overflowSubTable[lookup >> 4] | sz53Table[regs[1]];
}; fn214(); }
	break;case 215: { var fn215 = function() {
	
	tstates += ( 1);
regPairs[11]--; tstates += ( 3);
while (display.nextEventTime != null && display.nextEventTime < tstates) display.doEvent();
memory.write(regPairs[11], regPairs[12] >> 8);;
regPairs[11]--; tstates += ( 3);
while (display.nextEventTime != null && display.nextEventTime < tstates) display.doEvent();
memory.write(regPairs[11], regPairs[12] & 0xff);;
regPairs[12] = 16;
}; fn215(); }
	break;case 216: { var fn216 = function() {
	
	tstates += ( 1);
if (regs[0] & 1) {
	var l = (tstates += ( 3), memory.read(regPairs[11])); regPairs[11]++;
	var h = (tstates += ( 3), memory.read(regPairs[11])); regPairs[11]++;
	regPairs[12] = (h<<8) | l;
}
}; fn216(); }
	break;case 217: { var fn217 = function() {
	
	var wordtemp;
wordtemp = regPairs[1]; regPairs[1] = regPairs[5]; regPairs[5] = wordtemp;
wordtemp = regPairs[2]; regPairs[2] = regPairs[6]; regPairs[6] = wordtemp;
wordtemp = regPairs[3]; regPairs[3] = regPairs[7]; regPairs[7] = wordtemp;
}; fn217(); }
	break;case 218: { var fn218 = function() {
	
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
}; fn218(); }
	break;case 219: { var fn219 = function() {
	
	var val = (tstates += ( 3), memory.read(regPairs[12])); regPairs[12]++;
var port = (regs[1] << 8) | val;
tstates += 1;
regs[1] = ioBus.read(port);
tstates += 3;
}; fn219(); }
	break;case 220: { var fn220 = function() {
	
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
}; fn220(); }
	break;case 221: { var fn221 = function() {
	
	opcodePrefix = 'DD';
interruptible = false;
}; fn221(); }
	break;case 222: { var fn222 = function() {
	
	var val = (tstates += ( 3), memory.read(regPairs[12])); regPairs[12]++;
var sbctemp = regs[1] - val - (regs[0] & 1);
var lookup = ( (regs[1] & 0x88) >> 3 ) | ( (val & 0x88) >> 2 ) | ( (sbctemp & 0x88) >> 1 );
regs[1] = sbctemp;
regs[0] = ( sbctemp & 0x100 ? 1 : 0 ) | 2 | halfcarrySubTable[lookup & 0x07] | overflowSubTable[lookup >> 4] | sz53Table[regs[1]];
}; fn222(); }
	break;case 223: { var fn223 = function() {
	
	tstates += ( 1);
regPairs[11]--; tstates += ( 3);
while (display.nextEventTime != null && display.nextEventTime < tstates) display.doEvent();
memory.write(regPairs[11], regPairs[12] >> 8);;
regPairs[11]--; tstates += ( 3);
while (display.nextEventTime != null && display.nextEventTime < tstates) display.doEvent();
memory.write(regPairs[11], regPairs[12] & 0xff);;
regPairs[12] = 24;
}; fn223(); }
	break;case 224: { var fn224 = function() {
	
	tstates += ( 1);
if (!(regs[0] & 4)) {
	var l = (tstates += ( 3), memory.read(regPairs[11])); regPairs[11]++;
	var h = (tstates += ( 3), memory.read(regPairs[11])); regPairs[11]++;
	regPairs[12] = (h<<8) | l;
}
}; fn224(); }
	break;case 225: { var fn225 = function() {
	
	var l = (tstates += ( 3), memory.read(regPairs[11])); regPairs[11]++;
var h = (tstates += ( 3), memory.read(regPairs[11])); regPairs[11]++;
regPairs[3] = (h<<8) | l;
}; fn225(); }
	break;case 226: { var fn226 = function() {
	
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
}; fn226(); }
	break;case 227: { var fn227 = function() {
	
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
}; fn227(); }
	break;case 228: { var fn228 = function() {
	
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
}; fn228(); }
	break;case 229: { var fn229 = function() {
	
	tstates += ( 1);
regPairs[11]--; tstates += ( 3);
while (display.nextEventTime != null && display.nextEventTime < tstates) display.doEvent();
memory.write(regPairs[11], regPairs[3] >> 8);;
regPairs[11]--; tstates += ( 3);
while (display.nextEventTime != null && display.nextEventTime < tstates) display.doEvent();
memory.write(regPairs[11], regPairs[3] & 0xff);;
}; fn229(); }
	break;case 230: { var fn230 = function() {
	
	var val = (tstates += ( 3), memory.read(regPairs[12])); regPairs[12]++;

regs[1] &= val;
regs[0] = 16 | sz53pTable[regs[1]];
}; fn230(); }
	break;case 231: { var fn231 = function() {
	
	tstates += ( 1);
regPairs[11]--; tstates += ( 3);
while (display.nextEventTime != null && display.nextEventTime < tstates) display.doEvent();
memory.write(regPairs[11], regPairs[12] >> 8);;
regPairs[11]--; tstates += ( 3);
while (display.nextEventTime != null && display.nextEventTime < tstates) display.doEvent();
memory.write(regPairs[11], regPairs[12] & 0xff);;
regPairs[12] = 32;
}; fn231(); }
	break;case 232: { var fn232 = function() {
	
	tstates += ( 1);
if (regs[0] & 4) {
	var l = (tstates += ( 3), memory.read(regPairs[11])); regPairs[11]++;
	var h = (tstates += ( 3), memory.read(regPairs[11])); regPairs[11]++;
	regPairs[12] = (h<<8) | l;
}
}; fn232(); }
	break;case 233: { var fn233 = function() {
	
	regPairs[12] = regPairs[3];
}; fn233(); }
	break;case 234: { var fn234 = function() {
	
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
}; fn234(); }
	break;case 235: { var fn235 = function() {
	
	var temp = regPairs[2];
regPairs[2] = regPairs[3];
regPairs[3] = temp;
}; fn235(); }
	break;case 236: { var fn236 = function() {
	
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
}; fn236(); }
	break;case 237: { var fn237 = function() {
	
	opcodePrefix = 'ED';
interruptible = false;
}; fn237(); }
	break;case 238: { var fn238 = function() {
	
	var val = (tstates += ( 3), memory.read(regPairs[12])); regPairs[12]++;
regs[1] ^= val;
regs[0] = sz53pTable[regs[1]];
}; fn238(); }
	break;case 239: { var fn239 = function() {
	
	tstates += ( 1);
regPairs[11]--; tstates += ( 3);
while (display.nextEventTime != null && display.nextEventTime < tstates) display.doEvent();
memory.write(regPairs[11], regPairs[12] >> 8);;
regPairs[11]--; tstates += ( 3);
while (display.nextEventTime != null && display.nextEventTime < tstates) display.doEvent();
memory.write(regPairs[11], regPairs[12] & 0xff);;
regPairs[12] = 40;
}; fn239(); }
	break;case 240: { var fn240 = function() {
	
	tstates += ( 1);
if (!(regs[0] & 128)) {
	var l = (tstates += ( 3), memory.read(regPairs[11])); regPairs[11]++;
	var h = (tstates += ( 3), memory.read(regPairs[11])); regPairs[11]++;
	regPairs[12] = (h<<8) | l;
}
}; fn240(); }
	break;case 241: { var fn241 = function() {
	
	var l = (tstates += ( 3), memory.read(regPairs[11])); regPairs[11]++;
var h = (tstates += ( 3), memory.read(regPairs[11])); regPairs[11]++;
regPairs[0] = (h<<8) | l;
}; fn241(); }
	break;case 242: { var fn242 = function() {
	
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
}; fn242(); }
	break;case 243: { var fn243 = function() {
	
	iff1 = iff2 = 0;
}; fn243(); }
	break;case 244: { var fn244 = function() {
	
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
}; fn244(); }
	break;case 245: { var fn245 = function() {
	
	tstates += ( 1);
regPairs[11]--; tstates += ( 3);
while (display.nextEventTime != null && display.nextEventTime < tstates) display.doEvent();
memory.write(regPairs[11], regPairs[0] >> 8);;
regPairs[11]--; tstates += ( 3);
while (display.nextEventTime != null && display.nextEventTime < tstates) display.doEvent();
memory.write(regPairs[11], regPairs[0] & 0xff);;
}; fn245(); }
	break;case 246: { var fn246 = function() {
	
	var val = (tstates += ( 3), memory.read(regPairs[12])); regPairs[12]++;

regs[1] |= val;
regs[0] = sz53pTable[regs[1]];
}; fn246(); }
	break;case 247: { var fn247 = function() {
	
	tstates += ( 1);
regPairs[11]--; tstates += ( 3);
while (display.nextEventTime != null && display.nextEventTime < tstates) display.doEvent();
memory.write(regPairs[11], regPairs[12] >> 8);;
regPairs[11]--; tstates += ( 3);
while (display.nextEventTime != null && display.nextEventTime < tstates) display.doEvent();
memory.write(regPairs[11], regPairs[12] & 0xff);;
regPairs[12] = 48;
}; fn247(); }
	break;case 248: { var fn248 = function() {
	
	tstates += ( 1);
if (regs[0] & 128) {
	var l = (tstates += ( 3), memory.read(regPairs[11])); regPairs[11]++;
	var h = (tstates += ( 3), memory.read(regPairs[11])); regPairs[11]++;
	regPairs[12] = (h<<8) | l;
}
}; fn248(); }
	break;case 249: { var fn249 = function() {
	
	regPairs[11] = regPairs[3];
tstates += ( 1);
tstates += ( 1);
}; fn249(); }
	break;case 250: { var fn250 = function() {
	
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
}; fn250(); }
	break;case 251: { var fn251 = function() {
	
	iff1 = iff2 = 1;
interruptible = false;
}; fn251(); }
	break;case 252: { var fn252 = function() {
	
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
}; fn252(); }
	break;case 253: { var fn253 = function() {
	
	opcodePrefix = 'FD';
interruptible = false;
}; fn253(); }
	break;case 254: { var fn254 = function() {
	
	var val = (tstates += ( 3), memory.read(regPairs[12])); regPairs[12]++;

var cptemp = regs[1] - val;
var lookup = ( (regs[1] & 0x88) >> 3 ) | ( (val & 0x88) >> 2 ) | ( (cptemp & 0x88) >> 1 );
regs[0] = ( cptemp & 0x100 ? 1 : ( cptemp ? 0 : 64 ) ) | 2 | halfcarrySubTable[lookup & 0x07] | overflowSubTable[lookup >> 4] | ( val & 40 ) | ( cptemp & 128 );
}; fn254(); }
	break;case 255: { var fn255 = function() {
	
	tstates += ( 1);
regPairs[11]--; tstates += ( 3);
while (display.nextEventTime != null && display.nextEventTime < tstates) display.doEvent();
memory.write(regPairs[11], regPairs[12] >> 8);;
regPairs[11]--; tstates += ( 3);
while (display.nextEventTime != null && display.nextEventTime < tstates) display.doEvent();
memory.write(regPairs[11], regPairs[12] & 0xff);;
regPairs[12] = 56;
}; fn255(); }
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
	case 0: { var fn0 = function() {
	
	
regs[3] = ( (regs[3] << 1) | (regs[3] >> 7) ) ;
regs[0] = (regs[3] & 1) | sz53pTable[regs[3]];

}; fn0(); }
	break;case 1: { var fn1 = function() {
	
	
regs[2] = ( (regs[2] << 1) | (regs[2] >> 7) ) ;
regs[0] = (regs[2] & 1) | sz53pTable[regs[2]];

}; fn1(); }
	break;case 2: { var fn2 = function() {
	
	
regs[5] = ( (regs[5] << 1) | (regs[5] >> 7) ) ;
regs[0] = (regs[5] & 1) | sz53pTable[regs[5]];

}; fn2(); }
	break;case 3: { var fn3 = function() {
	
	
regs[4] = ( (regs[4] << 1) | (regs[4] >> 7) ) ;
regs[0] = (regs[4] & 1) | sz53pTable[regs[4]];

}; fn3(); }
	break;case 4: { var fn4 = function() {
	
	
regs[7] = ( (regs[7] << 1) | (regs[7] >> 7) ) ;
regs[0] = (regs[7] & 1) | sz53pTable[regs[7]];

}; fn4(); }
	break;case 5: { var fn5 = function() {
	
	
regs[6] = ( (regs[6] << 1) | (regs[6] >> 7) ) ;
regs[0] = (regs[6] & 1) | sz53pTable[regs[6]];

}; fn5(); }
	break;case 6: { var fn6 = function() {
	
	var val = (tstates += ( 3), memory.read(regPairs[3]));
val = ( (val << 1) | (val >> 7) ) & 0xff;
regs[0] = (val & 1) | sz53pTable[val];
tstates += ( 1);
tstates += ( 3);
while (display.nextEventTime != null && display.nextEventTime < tstates) display.doEvent();
memory.write(regPairs[3], val);;
}; fn6(); }
	break;case 7: { var fn7 = function() {
	
	
regs[1] = ( (regs[1] << 1) | (regs[1] >> 7) ) ;
regs[0] = (regs[1] & 1) | sz53pTable[regs[1]];

}; fn7(); }
	break;case 8: { var fn8 = function() {
	
	
regs[0] = regs[3] & 1;
regs[3] = ( (regs[3] >> 1) | (regs[3] << 7) ) ;
regs[0] |= sz53pTable[regs[3]];

}; fn8(); }
	break;case 9: { var fn9 = function() {
	
	
regs[0] = regs[2] & 1;
regs[2] = ( (regs[2] >> 1) | (regs[2] << 7) ) ;
regs[0] |= sz53pTable[regs[2]];

}; fn9(); }
	break;case 10: { var fn10 = function() {
	
	
regs[0] = regs[5] & 1;
regs[5] = ( (regs[5] >> 1) | (regs[5] << 7) ) ;
regs[0] |= sz53pTable[regs[5]];

}; fn10(); }
	break;case 11: { var fn11 = function() {
	
	
regs[0] = regs[4] & 1;
regs[4] = ( (regs[4] >> 1) | (regs[4] << 7) ) ;
regs[0] |= sz53pTable[regs[4]];

}; fn11(); }
	break;case 12: { var fn12 = function() {
	
	
regs[0] = regs[7] & 1;
regs[7] = ( (regs[7] >> 1) | (regs[7] << 7) ) ;
regs[0] |= sz53pTable[regs[7]];

}; fn12(); }
	break;case 13: { var fn13 = function() {
	
	
regs[0] = regs[6] & 1;
regs[6] = ( (regs[6] >> 1) | (regs[6] << 7) ) ;
regs[0] |= sz53pTable[regs[6]];

}; fn13(); }
	break;case 14: { var fn14 = function() {
	
	var val = (tstates += ( 3), memory.read(regPairs[3]));
regs[0] = val & 1;
val = ( (val >> 1) | (val << 7) ) & 0xff;
regs[0] |= sz53pTable[val];
tstates += ( 1);
tstates += ( 3);
while (display.nextEventTime != null && display.nextEventTime < tstates) display.doEvent();
memory.write(regPairs[3], val);;
}; fn14(); }
	break;case 15: { var fn15 = function() {
	
	
regs[0] = regs[1] & 1;
regs[1] = ( (regs[1] >> 1) | (regs[1] << 7) ) ;
regs[0] |= sz53pTable[regs[1]];

}; fn15(); }
	break;case 16: { var fn16 = function() {
	
	
var rltemp = regs[3];
regs[3] = ( (regs[3] << 1) | (regs[0] & 1) ) ;
regs[0] = ( rltemp >> 7 ) | sz53pTable[regs[3]];

}; fn16(); }
	break;case 17: { var fn17 = function() {
	
	
var rltemp = regs[2];
regs[2] = ( (regs[2] << 1) | (regs[0] & 1) ) ;
regs[0] = ( rltemp >> 7 ) | sz53pTable[regs[2]];

}; fn17(); }
	break;case 18: { var fn18 = function() {
	
	
var rltemp = regs[5];
regs[5] = ( (regs[5] << 1) | (regs[0] & 1) ) ;
regs[0] = ( rltemp >> 7 ) | sz53pTable[regs[5]];

}; fn18(); }
	break;case 19: { var fn19 = function() {
	
	
var rltemp = regs[4];
regs[4] = ( (regs[4] << 1) | (regs[0] & 1) ) ;
regs[0] = ( rltemp >> 7 ) | sz53pTable[regs[4]];

}; fn19(); }
	break;case 20: { var fn20 = function() {
	
	
var rltemp = regs[7];
regs[7] = ( (regs[7] << 1) | (regs[0] & 1) ) ;
regs[0] = ( rltemp >> 7 ) | sz53pTable[regs[7]];

}; fn20(); }
	break;case 21: { var fn21 = function() {
	
	
var rltemp = regs[6];
regs[6] = ( (regs[6] << 1) | (regs[0] & 1) ) ;
regs[0] = ( rltemp >> 7 ) | sz53pTable[regs[6]];

}; fn21(); }
	break;case 22: { var fn22 = function() {
	
	var val = (tstates += ( 3), memory.read(regPairs[3]));
var rltemp = val;
val = ( (val << 1) | (regs[0] & 1) ) & 0xff;
regs[0] = ( rltemp >> 7 ) | sz53pTable[val];
tstates += ( 1);
tstates += ( 3);
while (display.nextEventTime != null && display.nextEventTime < tstates) display.doEvent();
memory.write(regPairs[3], val);;
}; fn22(); }
	break;case 23: { var fn23 = function() {
	
	
var rltemp = regs[1];
regs[1] = ( (regs[1] << 1) | (regs[0] & 1) ) ;
regs[0] = ( rltemp >> 7 ) | sz53pTable[regs[1]];

}; fn23(); }
	break;case 24: { var fn24 = function() {
	
	
var rrtemp = regs[3];
regs[3] = ( (regs[3] >> 1) | ( regs[0] << 7 ) ) ;
regs[0] = (rrtemp & 1) | sz53pTable[regs[3]];

}; fn24(); }
	break;case 25: { var fn25 = function() {
	
	
var rrtemp = regs[2];
regs[2] = ( (regs[2] >> 1) | ( regs[0] << 7 ) ) ;
regs[0] = (rrtemp & 1) | sz53pTable[regs[2]];

}; fn25(); }
	break;case 26: { var fn26 = function() {
	
	
var rrtemp = regs[5];
regs[5] = ( (regs[5] >> 1) | ( regs[0] << 7 ) ) ;
regs[0] = (rrtemp & 1) | sz53pTable[regs[5]];

}; fn26(); }
	break;case 27: { var fn27 = function() {
	
	
var rrtemp = regs[4];
regs[4] = ( (regs[4] >> 1) | ( regs[0] << 7 ) ) ;
regs[0] = (rrtemp & 1) | sz53pTable[regs[4]];

}; fn27(); }
	break;case 28: { var fn28 = function() {
	
	
var rrtemp = regs[7];
regs[7] = ( (regs[7] >> 1) | ( regs[0] << 7 ) ) ;
regs[0] = (rrtemp & 1) | sz53pTable[regs[7]];

}; fn28(); }
	break;case 29: { var fn29 = function() {
	
	
var rrtemp = regs[6];
regs[6] = ( (regs[6] >> 1) | ( regs[0] << 7 ) ) ;
regs[0] = (rrtemp & 1) | sz53pTable[regs[6]];

}; fn29(); }
	break;case 30: { var fn30 = function() {
	
	var val = (tstates += ( 3), memory.read(regPairs[3]));
var rrtemp = val;
val = ( (val >> 1) | ( regs[0] << 7 ) ) & 0xff;
regs[0] = (rrtemp & 1) | sz53pTable[val];
tstates += ( 1);
tstates += ( 3);
while (display.nextEventTime != null && display.nextEventTime < tstates) display.doEvent();
memory.write(regPairs[3], val);;
}; fn30(); }
	break;case 31: { var fn31 = function() {
	
	
var rrtemp = regs[1];
regs[1] = ( (regs[1] >> 1) | ( regs[0] << 7 ) ) ;
regs[0] = (rrtemp & 1) | sz53pTable[regs[1]];

}; fn31(); }
	break;case 32: { var fn32 = function() {
	
	
regs[0] = regs[3] >> 7;
regs[3] = (regs[3] << 1) ;
regs[0] |= sz53pTable[regs[3]];

}; fn32(); }
	break;case 33: { var fn33 = function() {
	
	
regs[0] = regs[2] >> 7;
regs[2] = (regs[2] << 1) ;
regs[0] |= sz53pTable[regs[2]];

}; fn33(); }
	break;case 34: { var fn34 = function() {
	
	
regs[0] = regs[5] >> 7;
regs[5] = (regs[5] << 1) ;
regs[0] |= sz53pTable[regs[5]];

}; fn34(); }
	break;case 35: { var fn35 = function() {
	
	
regs[0] = regs[4] >> 7;
regs[4] = (regs[4] << 1) ;
regs[0] |= sz53pTable[regs[4]];

}; fn35(); }
	break;case 36: { var fn36 = function() {
	
	
regs[0] = regs[7] >> 7;
regs[7] = (regs[7] << 1) ;
regs[0] |= sz53pTable[regs[7]];

}; fn36(); }
	break;case 37: { var fn37 = function() {
	
	
regs[0] = regs[6] >> 7;
regs[6] = (regs[6] << 1) ;
regs[0] |= sz53pTable[regs[6]];

}; fn37(); }
	break;case 38: { var fn38 = function() {
	
	var val = (tstates += ( 3), memory.read(regPairs[3]));
regs[0] = val >> 7;
val = (val << 1) & 0xff;
regs[0] |= sz53pTable[val];
tstates += ( 1);
tstates += ( 3);
while (display.nextEventTime != null && display.nextEventTime < tstates) display.doEvent();
memory.write(regPairs[3], val);;
}; fn38(); }
	break;case 39: { var fn39 = function() {
	
	
regs[0] = regs[1] >> 7;
regs[1] = (regs[1] << 1) ;
regs[0] |= sz53pTable[regs[1]];

}; fn39(); }
	break;case 40: { var fn40 = function() {
	
	
regs[0] = regs[3] & 1;
regs[3] = ( (regs[3] & 0x80) | (regs[3] >> 1) ) ;
regs[0] |= sz53pTable[regs[3]];

}; fn40(); }
	break;case 41: { var fn41 = function() {
	
	
regs[0] = regs[2] & 1;
regs[2] = ( (regs[2] & 0x80) | (regs[2] >> 1) ) ;
regs[0] |= sz53pTable[regs[2]];

}; fn41(); }
	break;case 42: { var fn42 = function() {
	
	
regs[0] = regs[5] & 1;
regs[5] = ( (regs[5] & 0x80) | (regs[5] >> 1) ) ;
regs[0] |= sz53pTable[regs[5]];

}; fn42(); }
	break;case 43: { var fn43 = function() {
	
	
regs[0] = regs[4] & 1;
regs[4] = ( (regs[4] & 0x80) | (regs[4] >> 1) ) ;
regs[0] |= sz53pTable[regs[4]];

}; fn43(); }
	break;case 44: { var fn44 = function() {
	
	
regs[0] = regs[7] & 1;
regs[7] = ( (regs[7] & 0x80) | (regs[7] >> 1) ) ;
regs[0] |= sz53pTable[regs[7]];

}; fn44(); }
	break;case 45: { var fn45 = function() {
	
	
regs[0] = regs[6] & 1;
regs[6] = ( (regs[6] & 0x80) | (regs[6] >> 1) ) ;
regs[0] |= sz53pTable[regs[6]];

}; fn45(); }
	break;case 46: { var fn46 = function() {
	
	var val = (tstates += ( 3), memory.read(regPairs[3]));
regs[0] = val & 1;
val = ( (val & 0x80) | (val >> 1) ) & 0xff;
regs[0] |= sz53pTable[val];
tstates += ( 1);
tstates += ( 3);
while (display.nextEventTime != null && display.nextEventTime < tstates) display.doEvent();
memory.write(regPairs[3], val);;
}; fn46(); }
	break;case 47: { var fn47 = function() {
	
	
regs[0] = regs[1] & 1;
regs[1] = ( (regs[1] & 0x80) | (regs[1] >> 1) ) ;
regs[0] |= sz53pTable[regs[1]];

}; fn47(); }
	break;case 48: { var fn48 = function() {
	
	
regs[0] =  regs[3] >> 7;
regs[3] = (((regs[3]) << 1) ) | 0x01;
regs[0] |= sz53pTable[regs[3]];

}; fn48(); }
	break;case 49: { var fn49 = function() {
	
	
regs[0] =  regs[2] >> 7;
regs[2] = (((regs[2]) << 1) ) | 0x01;
regs[0] |= sz53pTable[regs[2]];

}; fn49(); }
	break;case 50: { var fn50 = function() {
	
	
regs[0] =  regs[5] >> 7;
regs[5] = (((regs[5]) << 1) ) | 0x01;
regs[0] |= sz53pTable[regs[5]];

}; fn50(); }
	break;case 51: { var fn51 = function() {
	
	
regs[0] =  regs[4] >> 7;
regs[4] = (((regs[4]) << 1) ) | 0x01;
regs[0] |= sz53pTable[regs[4]];

}; fn51(); }
	break;case 52: { var fn52 = function() {
	
	
regs[0] =  regs[7] >> 7;
regs[7] = (((regs[7]) << 1) ) | 0x01;
regs[0] |= sz53pTable[regs[7]];

}; fn52(); }
	break;case 53: { var fn53 = function() {
	
	
regs[0] =  regs[6] >> 7;
regs[6] = (((regs[6]) << 1) ) | 0x01;
regs[0] |= sz53pTable[regs[6]];

}; fn53(); }
	break;case 54: { var fn54 = function() {
	
	var val = (tstates += ( 3), memory.read(regPairs[3]));
regs[0] =  val >> 7;
val = (((val) << 1) & 0xff) | 0x01;
regs[0] |= sz53pTable[val];
tstates += ( 1);
tstates += ( 3);
while (display.nextEventTime != null && display.nextEventTime < tstates) display.doEvent();
memory.write(regPairs[3], val);;
}; fn54(); }
	break;case 55: { var fn55 = function() {
	
	
regs[0] =  regs[1] >> 7;
regs[1] = (((regs[1]) << 1) ) | 0x01;
regs[0] |= sz53pTable[regs[1]];

}; fn55(); }
	break;case 56: { var fn56 = function() {
	
	
regs[0] =  regs[3] & 1;
regs[3] >>= 1;
regs[0] |= sz53pTable[regs[3]];

}; fn56(); }
	break;case 57: { var fn57 = function() {
	
	
regs[0] =  regs[2] & 1;
regs[2] >>= 1;
regs[0] |= sz53pTable[regs[2]];

}; fn57(); }
	break;case 58: { var fn58 = function() {
	
	
regs[0] =  regs[5] & 1;
regs[5] >>= 1;
regs[0] |= sz53pTable[regs[5]];

}; fn58(); }
	break;case 59: { var fn59 = function() {
	
	
regs[0] =  regs[4] & 1;
regs[4] >>= 1;
regs[0] |= sz53pTable[regs[4]];

}; fn59(); }
	break;case 60: { var fn60 = function() {
	
	
regs[0] =  regs[7] & 1;
regs[7] >>= 1;
regs[0] |= sz53pTable[regs[7]];

}; fn60(); }
	break;case 61: { var fn61 = function() {
	
	
regs[0] =  regs[6] & 1;
regs[6] >>= 1;
regs[0] |= sz53pTable[regs[6]];

}; fn61(); }
	break;case 62: { var fn62 = function() {
	
	var val = (tstates += ( 3), memory.read(regPairs[3]));
regs[0] =  val & 1;
val >>= 1;
regs[0] |= sz53pTable[val];
tstates += ( 1);
tstates += ( 3);
while (display.nextEventTime != null && display.nextEventTime < tstates) display.doEvent();
memory.write(regPairs[3], val);;
}; fn62(); }
	break;case 63: { var fn63 = function() {
	
	
regs[0] =  regs[1] & 1;
regs[1] >>= 1;
regs[0] |= sz53pTable[regs[1]];

}; fn63(); }
	break;case 64: { var fn64 = function() {
	
	regs[0] = ( regs[0] & 1 ) | 16 | ( regs[3] & 40 );
if( !(regs[3] & 1) ) regs[0] |= 68;

}; fn64(); }
	break;case 65: { var fn65 = function() {
	
	regs[0] = ( regs[0] & 1 ) | 16 | ( regs[2] & 40 );
if( !(regs[2] & 1) ) regs[0] |= 68;

}; fn65(); }
	break;case 66: { var fn66 = function() {
	
	regs[0] = ( regs[0] & 1 ) | 16 | ( regs[5] & 40 );
if( !(regs[5] & 1) ) regs[0] |= 68;

}; fn66(); }
	break;case 67: { var fn67 = function() {
	
	regs[0] = ( regs[0] & 1 ) | 16 | ( regs[4] & 40 );
if( !(regs[4] & 1) ) regs[0] |= 68;

}; fn67(); }
	break;case 68: { var fn68 = function() {
	
	regs[0] = ( regs[0] & 1 ) | 16 | ( regs[7] & 40 );
if( !(regs[7] & 1) ) regs[0] |= 68;

}; fn68(); }
	break;case 69: { var fn69 = function() {
	
	regs[0] = ( regs[0] & 1 ) | 16 | ( regs[6] & 40 );
if( !(regs[6] & 1) ) regs[0] |= 68;

}; fn69(); }
	break;case 70: { var fn70 = function() {
	
	var addr = regPairs[3];
var value = (tstates += ( 3), memory.read(addr));
tstates += ( 1);
regs[0] = ( regs[0] & 1 ) | 16 | ( value & 40 );
if( !(value & 1) ) regs[0] |= 68;

}; fn70(); }
	break;case 71: { var fn71 = function() {
	
	regs[0] = ( regs[0] & 1 ) | 16 | ( regs[1] & 40 );
if( !(regs[1] & 1) ) regs[0] |= 68;

}; fn71(); }
	break;case 72: { var fn72 = function() {
	
	regs[0] = ( regs[0] & 1 ) | 16 | ( regs[3] & 40 );
if( !(regs[3] & 2) ) regs[0] |= 68;

}; fn72(); }
	break;case 73: { var fn73 = function() {
	
	regs[0] = ( regs[0] & 1 ) | 16 | ( regs[2] & 40 );
if( !(regs[2] & 2) ) regs[0] |= 68;

}; fn73(); }
	break;case 74: { var fn74 = function() {
	
	regs[0] = ( regs[0] & 1 ) | 16 | ( regs[5] & 40 );
if( !(regs[5] & 2) ) regs[0] |= 68;

}; fn74(); }
	break;case 75: { var fn75 = function() {
	
	regs[0] = ( regs[0] & 1 ) | 16 | ( regs[4] & 40 );
if( !(regs[4] & 2) ) regs[0] |= 68;

}; fn75(); }
	break;case 76: { var fn76 = function() {
	
	regs[0] = ( regs[0] & 1 ) | 16 | ( regs[7] & 40 );
if( !(regs[7] & 2) ) regs[0] |= 68;

}; fn76(); }
	break;case 77: { var fn77 = function() {
	
	regs[0] = ( regs[0] & 1 ) | 16 | ( regs[6] & 40 );
if( !(regs[6] & 2) ) regs[0] |= 68;

}; fn77(); }
	break;case 78: { var fn78 = function() {
	
	var addr = regPairs[3];
var value = (tstates += ( 3), memory.read(addr));
tstates += ( 1);
regs[0] = ( regs[0] & 1 ) | 16 | ( value & 40 );
if( !(value & 2) ) regs[0] |= 68;

}; fn78(); }
	break;case 79: { var fn79 = function() {
	
	regs[0] = ( regs[0] & 1 ) | 16 | ( regs[1] & 40 );
if( !(regs[1] & 2) ) regs[0] |= 68;

}; fn79(); }
	break;case 80: { var fn80 = function() {
	
	regs[0] = ( regs[0] & 1 ) | 16 | ( regs[3] & 40 );
if( !(regs[3] & 4) ) regs[0] |= 68;

}; fn80(); }
	break;case 81: { var fn81 = function() {
	
	regs[0] = ( regs[0] & 1 ) | 16 | ( regs[2] & 40 );
if( !(regs[2] & 4) ) regs[0] |= 68;

}; fn81(); }
	break;case 82: { var fn82 = function() {
	
	regs[0] = ( regs[0] & 1 ) | 16 | ( regs[5] & 40 );
if( !(regs[5] & 4) ) regs[0] |= 68;

}; fn82(); }
	break;case 83: { var fn83 = function() {
	
	regs[0] = ( regs[0] & 1 ) | 16 | ( regs[4] & 40 );
if( !(regs[4] & 4) ) regs[0] |= 68;

}; fn83(); }
	break;case 84: { var fn84 = function() {
	
	regs[0] = ( regs[0] & 1 ) | 16 | ( regs[7] & 40 );
if( !(regs[7] & 4) ) regs[0] |= 68;

}; fn84(); }
	break;case 85: { var fn85 = function() {
	
	regs[0] = ( regs[0] & 1 ) | 16 | ( regs[6] & 40 );
if( !(regs[6] & 4) ) regs[0] |= 68;

}; fn85(); }
	break;case 86: { var fn86 = function() {
	
	var addr = regPairs[3];
var value = (tstates += ( 3), memory.read(addr));
tstates += ( 1);
regs[0] = ( regs[0] & 1 ) | 16 | ( value & 40 );
if( !(value & 4) ) regs[0] |= 68;

}; fn86(); }
	break;case 87: { var fn87 = function() {
	
	regs[0] = ( regs[0] & 1 ) | 16 | ( regs[1] & 40 );
if( !(regs[1] & 4) ) regs[0] |= 68;

}; fn87(); }
	break;case 88: { var fn88 = function() {
	
	regs[0] = ( regs[0] & 1 ) | 16 | ( regs[3] & 40 );
if( !(regs[3] & 8) ) regs[0] |= 68;

}; fn88(); }
	break;case 89: { var fn89 = function() {
	
	regs[0] = ( regs[0] & 1 ) | 16 | ( regs[2] & 40 );
if( !(regs[2] & 8) ) regs[0] |= 68;

}; fn89(); }
	break;case 90: { var fn90 = function() {
	
	regs[0] = ( regs[0] & 1 ) | 16 | ( regs[5] & 40 );
if( !(regs[5] & 8) ) regs[0] |= 68;

}; fn90(); }
	break;case 91: { var fn91 = function() {
	
	regs[0] = ( regs[0] & 1 ) | 16 | ( regs[4] & 40 );
if( !(regs[4] & 8) ) regs[0] |= 68;

}; fn91(); }
	break;case 92: { var fn92 = function() {
	
	regs[0] = ( regs[0] & 1 ) | 16 | ( regs[7] & 40 );
if( !(regs[7] & 8) ) regs[0] |= 68;

}; fn92(); }
	break;case 93: { var fn93 = function() {
	
	regs[0] = ( regs[0] & 1 ) | 16 | ( regs[6] & 40 );
if( !(regs[6] & 8) ) regs[0] |= 68;

}; fn93(); }
	break;case 94: { var fn94 = function() {
	
	var addr = regPairs[3];
var value = (tstates += ( 3), memory.read(addr));
tstates += ( 1);
regs[0] = ( regs[0] & 1 ) | 16 | ( value & 40 );
if( !(value & 8) ) regs[0] |= 68;

}; fn94(); }
	break;case 95: { var fn95 = function() {
	
	regs[0] = ( regs[0] & 1 ) | 16 | ( regs[1] & 40 );
if( !(regs[1] & 8) ) regs[0] |= 68;

}; fn95(); }
	break;case 96: { var fn96 = function() {
	
	regs[0] = ( regs[0] & 1 ) | 16 | ( regs[3] & 40 );
if( !(regs[3] & 16) ) regs[0] |= 68;

}; fn96(); }
	break;case 97: { var fn97 = function() {
	
	regs[0] = ( regs[0] & 1 ) | 16 | ( regs[2] & 40 );
if( !(regs[2] & 16) ) regs[0] |= 68;

}; fn97(); }
	break;case 98: { var fn98 = function() {
	
	regs[0] = ( regs[0] & 1 ) | 16 | ( regs[5] & 40 );
if( !(regs[5] & 16) ) regs[0] |= 68;

}; fn98(); }
	break;case 99: { var fn99 = function() {
	
	regs[0] = ( regs[0] & 1 ) | 16 | ( regs[4] & 40 );
if( !(regs[4] & 16) ) regs[0] |= 68;

}; fn99(); }
	break;case 100: { var fn100 = function() {
	
	regs[0] = ( regs[0] & 1 ) | 16 | ( regs[7] & 40 );
if( !(regs[7] & 16) ) regs[0] |= 68;

}; fn100(); }
	break;case 101: { var fn101 = function() {
	
	regs[0] = ( regs[0] & 1 ) | 16 | ( regs[6] & 40 );
if( !(regs[6] & 16) ) regs[0] |= 68;

}; fn101(); }
	break;case 102: { var fn102 = function() {
	
	var addr = regPairs[3];
var value = (tstates += ( 3), memory.read(addr));
tstates += ( 1);
regs[0] = ( regs[0] & 1 ) | 16 | ( value & 40 );
if( !(value & 16) ) regs[0] |= 68;

}; fn102(); }
	break;case 103: { var fn103 = function() {
	
	regs[0] = ( regs[0] & 1 ) | 16 | ( regs[1] & 40 );
if( !(regs[1] & 16) ) regs[0] |= 68;

}; fn103(); }
	break;case 104: { var fn104 = function() {
	
	regs[0] = ( regs[0] & 1 ) | 16 | ( regs[3] & 40 );
if( !(regs[3] & 32) ) regs[0] |= 68;

}; fn104(); }
	break;case 105: { var fn105 = function() {
	
	regs[0] = ( regs[0] & 1 ) | 16 | ( regs[2] & 40 );
if( !(regs[2] & 32) ) regs[0] |= 68;

}; fn105(); }
	break;case 106: { var fn106 = function() {
	
	regs[0] = ( regs[0] & 1 ) | 16 | ( regs[5] & 40 );
if( !(regs[5] & 32) ) regs[0] |= 68;

}; fn106(); }
	break;case 107: { var fn107 = function() {
	
	regs[0] = ( regs[0] & 1 ) | 16 | ( regs[4] & 40 );
if( !(regs[4] & 32) ) regs[0] |= 68;

}; fn107(); }
	break;case 108: { var fn108 = function() {
	
	regs[0] = ( regs[0] & 1 ) | 16 | ( regs[7] & 40 );
if( !(regs[7] & 32) ) regs[0] |= 68;

}; fn108(); }
	break;case 109: { var fn109 = function() {
	
	regs[0] = ( regs[0] & 1 ) | 16 | ( regs[6] & 40 );
if( !(regs[6] & 32) ) regs[0] |= 68;

}; fn109(); }
	break;case 110: { var fn110 = function() {
	
	var addr = regPairs[3];
var value = (tstates += ( 3), memory.read(addr));
tstates += ( 1);
regs[0] = ( regs[0] & 1 ) | 16 | ( value & 40 );
if( !(value & 32) ) regs[0] |= 68;

}; fn110(); }
	break;case 111: { var fn111 = function() {
	
	regs[0] = ( regs[0] & 1 ) | 16 | ( regs[1] & 40 );
if( !(regs[1] & 32) ) regs[0] |= 68;

}; fn111(); }
	break;case 112: { var fn112 = function() {
	
	regs[0] = ( regs[0] & 1 ) | 16 | ( regs[3] & 40 );
if( !(regs[3] & 64) ) regs[0] |= 68;

}; fn112(); }
	break;case 113: { var fn113 = function() {
	
	regs[0] = ( regs[0] & 1 ) | 16 | ( regs[2] & 40 );
if( !(regs[2] & 64) ) regs[0] |= 68;

}; fn113(); }
	break;case 114: { var fn114 = function() {
	
	regs[0] = ( regs[0] & 1 ) | 16 | ( regs[5] & 40 );
if( !(regs[5] & 64) ) regs[0] |= 68;

}; fn114(); }
	break;case 115: { var fn115 = function() {
	
	regs[0] = ( regs[0] & 1 ) | 16 | ( regs[4] & 40 );
if( !(regs[4] & 64) ) regs[0] |= 68;

}; fn115(); }
	break;case 116: { var fn116 = function() {
	
	regs[0] = ( regs[0] & 1 ) | 16 | ( regs[7] & 40 );
if( !(regs[7] & 64) ) regs[0] |= 68;

}; fn116(); }
	break;case 117: { var fn117 = function() {
	
	regs[0] = ( regs[0] & 1 ) | 16 | ( regs[6] & 40 );
if( !(regs[6] & 64) ) regs[0] |= 68;

}; fn117(); }
	break;case 118: { var fn118 = function() {
	
	var addr = regPairs[3];
var value = (tstates += ( 3), memory.read(addr));
tstates += ( 1);
regs[0] = ( regs[0] & 1 ) | 16 | ( value & 40 );
if( !(value & 64) ) regs[0] |= 68;

}; fn118(); }
	break;case 119: { var fn119 = function() {
	
	regs[0] = ( regs[0] & 1 ) | 16 | ( regs[1] & 40 );
if( !(regs[1] & 64) ) regs[0] |= 68;

}; fn119(); }
	break;case 120: { var fn120 = function() {
	
	regs[0] = ( regs[0] & 1 ) | 16 | ( regs[3] & 40 );
if( !(regs[3] & 128) ) regs[0] |= 68;
if (regs[3] & 0x80) regs[0] |= 128;
}; fn120(); }
	break;case 121: { var fn121 = function() {
	
	regs[0] = ( regs[0] & 1 ) | 16 | ( regs[2] & 40 );
if( !(regs[2] & 128) ) regs[0] |= 68;
if (regs[2] & 0x80) regs[0] |= 128;
}; fn121(); }
	break;case 122: { var fn122 = function() {
	
	regs[0] = ( regs[0] & 1 ) | 16 | ( regs[5] & 40 );
if( !(regs[5] & 128) ) regs[0] |= 68;
if (regs[5] & 0x80) regs[0] |= 128;
}; fn122(); }
	break;case 123: { var fn123 = function() {
	
	regs[0] = ( regs[0] & 1 ) | 16 | ( regs[4] & 40 );
if( !(regs[4] & 128) ) regs[0] |= 68;
if (regs[4] & 0x80) regs[0] |= 128;
}; fn123(); }
	break;case 124: { var fn124 = function() {
	
	regs[0] = ( regs[0] & 1 ) | 16 | ( regs[7] & 40 );
if( !(regs[7] & 128) ) regs[0] |= 68;
if (regs[7] & 0x80) regs[0] |= 128;
}; fn124(); }
	break;case 125: { var fn125 = function() {
	
	regs[0] = ( regs[0] & 1 ) | 16 | ( regs[6] & 40 );
if( !(regs[6] & 128) ) regs[0] |= 68;
if (regs[6] & 0x80) regs[0] |= 128;
}; fn125(); }
	break;case 126: { var fn126 = function() {
	
	var addr = regPairs[3];
var value = (tstates += ( 3), memory.read(addr));
tstates += ( 1);
regs[0] = ( regs[0] & 1 ) | 16 | ( value & 40 );
if( !(value & 128) ) regs[0] |= 68;
if (value & 0x80) regs[0] |= 128;
}; fn126(); }
	break;case 127: { var fn127 = function() {
	
	regs[0] = ( regs[0] & 1 ) | 16 | ( regs[1] & 40 );
if( !(regs[1] & 128) ) regs[0] |= 68;
if (regs[1] & 0x80) regs[0] |= 128;
}; fn127(); }
	break;case 128: { var fn128 = function() {
	
	
regs[3] &= 254;

}; fn128(); }
	break;case 129: { var fn129 = function() {
	
	
regs[2] &= 254;

}; fn129(); }
	break;case 130: { var fn130 = function() {
	
	
regs[5] &= 254;

}; fn130(); }
	break;case 131: { var fn131 = function() {
	
	
regs[4] &= 254;

}; fn131(); }
	break;case 132: { var fn132 = function() {
	
	
regs[7] &= 254;

}; fn132(); }
	break;case 133: { var fn133 = function() {
	
	
regs[6] &= 254;

}; fn133(); }
	break;case 134: { var fn134 = function() {
	
	var val = (tstates += ( 3), memory.read(regPairs[3]));
val &= 254;
tstates += ( 1);
tstates += ( 3);
while (display.nextEventTime != null && display.nextEventTime < tstates) display.doEvent();
memory.write(regPairs[3], val);;
}; fn134(); }
	break;case 135: { var fn135 = function() {
	
	
regs[1] &= 254;

}; fn135(); }
	break;case 136: { var fn136 = function() {
	
	
regs[3] &= 253;

}; fn136(); }
	break;case 137: { var fn137 = function() {
	
	
regs[2] &= 253;

}; fn137(); }
	break;case 138: { var fn138 = function() {
	
	
regs[5] &= 253;

}; fn138(); }
	break;case 139: { var fn139 = function() {
	
	
regs[4] &= 253;

}; fn139(); }
	break;case 140: { var fn140 = function() {
	
	
regs[7] &= 253;

}; fn140(); }
	break;case 141: { var fn141 = function() {
	
	
regs[6] &= 253;

}; fn141(); }
	break;case 142: { var fn142 = function() {
	
	var val = (tstates += ( 3), memory.read(regPairs[3]));
val &= 253;
tstates += ( 1);
tstates += ( 3);
while (display.nextEventTime != null && display.nextEventTime < tstates) display.doEvent();
memory.write(regPairs[3], val);;
}; fn142(); }
	break;case 143: { var fn143 = function() {
	
	
regs[1] &= 253;

}; fn143(); }
	break;case 144: { var fn144 = function() {
	
	
regs[3] &= 251;

}; fn144(); }
	break;case 145: { var fn145 = function() {
	
	
regs[2] &= 251;

}; fn145(); }
	break;case 146: { var fn146 = function() {
	
	
regs[5] &= 251;

}; fn146(); }
	break;case 147: { var fn147 = function() {
	
	
regs[4] &= 251;

}; fn147(); }
	break;case 148: { var fn148 = function() {
	
	
regs[7] &= 251;

}; fn148(); }
	break;case 149: { var fn149 = function() {
	
	
regs[6] &= 251;

}; fn149(); }
	break;case 150: { var fn150 = function() {
	
	var val = (tstates += ( 3), memory.read(regPairs[3]));
val &= 251;
tstates += ( 1);
tstates += ( 3);
while (display.nextEventTime != null && display.nextEventTime < tstates) display.doEvent();
memory.write(regPairs[3], val);;
}; fn150(); }
	break;case 151: { var fn151 = function() {
	
	
regs[1] &= 251;

}; fn151(); }
	break;case 152: { var fn152 = function() {
	
	
regs[3] &= 247;

}; fn152(); }
	break;case 153: { var fn153 = function() {
	
	
regs[2] &= 247;

}; fn153(); }
	break;case 154: { var fn154 = function() {
	
	
regs[5] &= 247;

}; fn154(); }
	break;case 155: { var fn155 = function() {
	
	
regs[4] &= 247;

}; fn155(); }
	break;case 156: { var fn156 = function() {
	
	
regs[7] &= 247;

}; fn156(); }
	break;case 157: { var fn157 = function() {
	
	
regs[6] &= 247;

}; fn157(); }
	break;case 158: { var fn158 = function() {
	
	var val = (tstates += ( 3), memory.read(regPairs[3]));
val &= 247;
tstates += ( 1);
tstates += ( 3);
while (display.nextEventTime != null && display.nextEventTime < tstates) display.doEvent();
memory.write(regPairs[3], val);;
}; fn158(); }
	break;case 159: { var fn159 = function() {
	
	
regs[1] &= 247;

}; fn159(); }
	break;case 160: { var fn160 = function() {
	
	
regs[3] &= 239;

}; fn160(); }
	break;case 161: { var fn161 = function() {
	
	
regs[2] &= 239;

}; fn161(); }
	break;case 162: { var fn162 = function() {
	
	
regs[5] &= 239;

}; fn162(); }
	break;case 163: { var fn163 = function() {
	
	
regs[4] &= 239;

}; fn163(); }
	break;case 164: { var fn164 = function() {
	
	
regs[7] &= 239;

}; fn164(); }
	break;case 165: { var fn165 = function() {
	
	
regs[6] &= 239;

}; fn165(); }
	break;case 166: { var fn166 = function() {
	
	var val = (tstates += ( 3), memory.read(regPairs[3]));
val &= 239;
tstates += ( 1);
tstates += ( 3);
while (display.nextEventTime != null && display.nextEventTime < tstates) display.doEvent();
memory.write(regPairs[3], val);;
}; fn166(); }
	break;case 167: { var fn167 = function() {
	
	
regs[1] &= 239;

}; fn167(); }
	break;case 168: { var fn168 = function() {
	
	
regs[3] &= 223;

}; fn168(); }
	break;case 169: { var fn169 = function() {
	
	
regs[2] &= 223;

}; fn169(); }
	break;case 170: { var fn170 = function() {
	
	
regs[5] &= 223;

}; fn170(); }
	break;case 171: { var fn171 = function() {
	
	
regs[4] &= 223;

}; fn171(); }
	break;case 172: { var fn172 = function() {
	
	
regs[7] &= 223;

}; fn172(); }
	break;case 173: { var fn173 = function() {
	
	
regs[6] &= 223;

}; fn173(); }
	break;case 174: { var fn174 = function() {
	
	var val = (tstates += ( 3), memory.read(regPairs[3]));
val &= 223;
tstates += ( 1);
tstates += ( 3);
while (display.nextEventTime != null && display.nextEventTime < tstates) display.doEvent();
memory.write(regPairs[3], val);;
}; fn174(); }
	break;case 175: { var fn175 = function() {
	
	
regs[1] &= 223;

}; fn175(); }
	break;case 176: { var fn176 = function() {
	
	
regs[3] &= 191;

}; fn176(); }
	break;case 177: { var fn177 = function() {
	
	
regs[2] &= 191;

}; fn177(); }
	break;case 178: { var fn178 = function() {
	
	
regs[5] &= 191;

}; fn178(); }
	break;case 179: { var fn179 = function() {
	
	
regs[4] &= 191;

}; fn179(); }
	break;case 180: { var fn180 = function() {
	
	
regs[7] &= 191;

}; fn180(); }
	break;case 181: { var fn181 = function() {
	
	
regs[6] &= 191;

}; fn181(); }
	break;case 182: { var fn182 = function() {
	
	var val = (tstates += ( 3), memory.read(regPairs[3]));
val &= 191;
tstates += ( 1);
tstates += ( 3);
while (display.nextEventTime != null && display.nextEventTime < tstates) display.doEvent();
memory.write(regPairs[3], val);;
}; fn182(); }
	break;case 183: { var fn183 = function() {
	
	
regs[1] &= 191;

}; fn183(); }
	break;case 184: { var fn184 = function() {
	
	
regs[3] &= 127;

}; fn184(); }
	break;case 185: { var fn185 = function() {
	
	
regs[2] &= 127;

}; fn185(); }
	break;case 186: { var fn186 = function() {
	
	
regs[5] &= 127;

}; fn186(); }
	break;case 187: { var fn187 = function() {
	
	
regs[4] &= 127;

}; fn187(); }
	break;case 188: { var fn188 = function() {
	
	
regs[7] &= 127;

}; fn188(); }
	break;case 189: { var fn189 = function() {
	
	
regs[6] &= 127;

}; fn189(); }
	break;case 190: { var fn190 = function() {
	
	var val = (tstates += ( 3), memory.read(regPairs[3]));
val &= 127;
tstates += ( 1);
tstates += ( 3);
while (display.nextEventTime != null && display.nextEventTime < tstates) display.doEvent();
memory.write(regPairs[3], val);;
}; fn190(); }
	break;case 191: { var fn191 = function() {
	
	
regs[1] &= 127;

}; fn191(); }
	break;case 192: { var fn192 = function() {
	
	
regs[3] |= 1;

}; fn192(); }
	break;case 193: { var fn193 = function() {
	
	
regs[2] |= 1;

}; fn193(); }
	break;case 194: { var fn194 = function() {
	
	
regs[5] |= 1;

}; fn194(); }
	break;case 195: { var fn195 = function() {
	
	
regs[4] |= 1;

}; fn195(); }
	break;case 196: { var fn196 = function() {
	
	
regs[7] |= 1;

}; fn196(); }
	break;case 197: { var fn197 = function() {
	
	
regs[6] |= 1;

}; fn197(); }
	break;case 198: { var fn198 = function() {
	
	var val = (tstates += ( 3), memory.read(regPairs[3]));
val |= 1;
tstates += ( 1);
tstates += ( 3);
while (display.nextEventTime != null && display.nextEventTime < tstates) display.doEvent();
memory.write(regPairs[3], val);;
}; fn198(); }
	break;case 199: { var fn199 = function() {
	
	
regs[1] |= 1;

}; fn199(); }
	break;case 200: { var fn200 = function() {
	
	
regs[3] |= 2;

}; fn200(); }
	break;case 201: { var fn201 = function() {
	
	
regs[2] |= 2;

}; fn201(); }
	break;case 202: { var fn202 = function() {
	
	
regs[5] |= 2;

}; fn202(); }
	break;case 203: { var fn203 = function() {
	
	
regs[4] |= 2;

}; fn203(); }
	break;case 204: { var fn204 = function() {
	
	
regs[7] |= 2;

}; fn204(); }
	break;case 205: { var fn205 = function() {
	
	
regs[6] |= 2;

}; fn205(); }
	break;case 206: { var fn206 = function() {
	
	var val = (tstates += ( 3), memory.read(regPairs[3]));
val |= 2;
tstates += ( 1);
tstates += ( 3);
while (display.nextEventTime != null && display.nextEventTime < tstates) display.doEvent();
memory.write(regPairs[3], val);;
}; fn206(); }
	break;case 207: { var fn207 = function() {
	
	
regs[1] |= 2;

}; fn207(); }
	break;case 208: { var fn208 = function() {
	
	
regs[3] |= 4;

}; fn208(); }
	break;case 209: { var fn209 = function() {
	
	
regs[2] |= 4;

}; fn209(); }
	break;case 210: { var fn210 = function() {
	
	
regs[5] |= 4;

}; fn210(); }
	break;case 211: { var fn211 = function() {
	
	
regs[4] |= 4;

}; fn211(); }
	break;case 212: { var fn212 = function() {
	
	
regs[7] |= 4;

}; fn212(); }
	break;case 213: { var fn213 = function() {
	
	
regs[6] |= 4;

}; fn213(); }
	break;case 214: { var fn214 = function() {
	
	var val = (tstates += ( 3), memory.read(regPairs[3]));
val |= 4;
tstates += ( 1);
tstates += ( 3);
while (display.nextEventTime != null && display.nextEventTime < tstates) display.doEvent();
memory.write(regPairs[3], val);;
}; fn214(); }
	break;case 215: { var fn215 = function() {
	
	
regs[1] |= 4;

}; fn215(); }
	break;case 216: { var fn216 = function() {
	
	
regs[3] |= 8;

}; fn216(); }
	break;case 217: { var fn217 = function() {
	
	
regs[2] |= 8;

}; fn217(); }
	break;case 218: { var fn218 = function() {
	
	
regs[5] |= 8;

}; fn218(); }
	break;case 219: { var fn219 = function() {
	
	
regs[4] |= 8;

}; fn219(); }
	break;case 220: { var fn220 = function() {
	
	
regs[7] |= 8;

}; fn220(); }
	break;case 221: { var fn221 = function() {
	
	
regs[6] |= 8;

}; fn221(); }
	break;case 222: { var fn222 = function() {
	
	var val = (tstates += ( 3), memory.read(regPairs[3]));
val |= 8;
tstates += ( 1);
tstates += ( 3);
while (display.nextEventTime != null && display.nextEventTime < tstates) display.doEvent();
memory.write(regPairs[3], val);;
}; fn222(); }
	break;case 223: { var fn223 = function() {
	
	
regs[1] |= 8;

}; fn223(); }
	break;case 224: { var fn224 = function() {
	
	
regs[3] |= 16;

}; fn224(); }
	break;case 225: { var fn225 = function() {
	
	
regs[2] |= 16;

}; fn225(); }
	break;case 226: { var fn226 = function() {
	
	
regs[5] |= 16;

}; fn226(); }
	break;case 227: { var fn227 = function() {
	
	
regs[4] |= 16;

}; fn227(); }
	break;case 228: { var fn228 = function() {
	
	
regs[7] |= 16;

}; fn228(); }
	break;case 229: { var fn229 = function() {
	
	
regs[6] |= 16;

}; fn229(); }
	break;case 230: { var fn230 = function() {
	
	var val = (tstates += ( 3), memory.read(regPairs[3]));
val |= 16;
tstates += ( 1);
tstates += ( 3);
while (display.nextEventTime != null && display.nextEventTime < tstates) display.doEvent();
memory.write(regPairs[3], val);;
}; fn230(); }
	break;case 231: { var fn231 = function() {
	
	
regs[1] |= 16;

}; fn231(); }
	break;case 232: { var fn232 = function() {
	
	
regs[3] |= 32;

}; fn232(); }
	break;case 233: { var fn233 = function() {
	
	
regs[2] |= 32;

}; fn233(); }
	break;case 234: { var fn234 = function() {
	
	
regs[5] |= 32;

}; fn234(); }
	break;case 235: { var fn235 = function() {
	
	
regs[4] |= 32;

}; fn235(); }
	break;case 236: { var fn236 = function() {
	
	
regs[7] |= 32;

}; fn236(); }
	break;case 237: { var fn237 = function() {
	
	
regs[6] |= 32;

}; fn237(); }
	break;case 238: { var fn238 = function() {
	
	var val = (tstates += ( 3), memory.read(regPairs[3]));
val |= 32;
tstates += ( 1);
tstates += ( 3);
while (display.nextEventTime != null && display.nextEventTime < tstates) display.doEvent();
memory.write(regPairs[3], val);;
}; fn238(); }
	break;case 239: { var fn239 = function() {
	
	
regs[1] |= 32;

}; fn239(); }
	break;case 240: { var fn240 = function() {
	
	
regs[3] |= 64;

}; fn240(); }
	break;case 241: { var fn241 = function() {
	
	
regs[2] |= 64;

}; fn241(); }
	break;case 242: { var fn242 = function() {
	
	
regs[5] |= 64;

}; fn242(); }
	break;case 243: { var fn243 = function() {
	
	
regs[4] |= 64;

}; fn243(); }
	break;case 244: { var fn244 = function() {
	
	
regs[7] |= 64;

}; fn244(); }
	break;case 245: { var fn245 = function() {
	
	
regs[6] |= 64;

}; fn245(); }
	break;case 246: { var fn246 = function() {
	
	var val = (tstates += ( 3), memory.read(regPairs[3]));
val |= 64;
tstates += ( 1);
tstates += ( 3);
while (display.nextEventTime != null && display.nextEventTime < tstates) display.doEvent();
memory.write(regPairs[3], val);;
}; fn246(); }
	break;case 247: { var fn247 = function() {
	
	
regs[1] |= 64;

}; fn247(); }
	break;case 248: { var fn248 = function() {
	
	
regs[3] |= 128;

}; fn248(); }
	break;case 249: { var fn249 = function() {
	
	
regs[2] |= 128;

}; fn249(); }
	break;case 250: { var fn250 = function() {
	
	
regs[5] |= 128;

}; fn250(); }
	break;case 251: { var fn251 = function() {
	
	
regs[4] |= 128;

}; fn251(); }
	break;case 252: { var fn252 = function() {
	
	
regs[7] |= 128;

}; fn252(); }
	break;case 253: { var fn253 = function() {
	
	
regs[6] |= 128;

}; fn253(); }
	break;case 254: { var fn254 = function() {
	
	var val = (tstates += ( 3), memory.read(regPairs[3]));
val |= 128;
tstates += ( 1);
tstates += ( 3);
while (display.nextEventTime != null && display.nextEventTime < tstates) display.doEvent();
memory.write(regPairs[3], val);;
}; fn254(); }
	break;case 255: { var fn255 = function() {
	
	
regs[1] |= 128;

}; fn255(); }
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
	case 0: { var fn0 = function() {
	
			
}; fn0(); }
	break;case 1: { var fn1 = function() {
	
	var l = (tstates += ( 3), memory.read(regPairs[12])); regPairs[12]++;
var h = (tstates += ( 3), memory.read(regPairs[12])); regPairs[12]++;
regPairs[1] = (h<<8) | l;
}; fn1(); }
	break;case 2: { var fn2 = function() {
	
	tstates += ( 3);
while (display.nextEventTime != null && display.nextEventTime < tstates) display.doEvent();
memory.write(regPairs[1], regs[1]);;
}; fn2(); }
	break;case 3: { var fn3 = function() {
	
	regPairs[1]++;
tstates += ( 1);
tstates += ( 1);
}; fn3(); }
	break;case 4: { var fn4 = function() {
	
	

regs[0] = (regs[0] & 1) | (regs[3] & 0x0f ? 0 : 16) | 2;
regs[3] = (regs[3] + 1) ;


regs[0] = (regs[0] & 1) | ( regs[3] == 0x80 ? 4 : 0 ) | ( regs[3] & 0x0f ? 0 : 16 ) | sz53Table[regs[3]];
}; fn4(); }
	break;case 5: { var fn5 = function() {
	
	

regs[0] = (regs[0] & 1 ) | ( regs[3] & 0x0f ? 0 : 16 ) | 2;
regs[3] = (regs[3] - 1) ;


regs[0] |= (regs[3] == 0x7f ? 4 : 0) | sz53Table[regs[3]];
}; fn5(); }
	break;case 6: { var fn6 = function() {
	
	regs[3] = (tstates += ( 3), memory.read(regPairs[12])); regPairs[12]++;
}; fn6(); }
	break;case 7: { var fn7 = function() {
	
	regs[1] = (regs[1] << 1) | (regs[1] >> 7);
regs[0] = (regs[0] & 196) | (regs[1] & 41);
}; fn7(); }
	break;case 8: { var fn8 = function() {
	
	var temp = regPairs[0];
regPairs[0] = regPairs[4];
regPairs[4] = temp;
}; fn8(); }
	break;case 9: { var fn9 = function() {
	
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
}; fn9(); }
	break;case 10: { var fn10 = function() {
	
	regs[1] = (tstates += ( 3), memory.read(regPairs[1]));
}; fn10(); }
	break;case 11: { var fn11 = function() {
	
	regPairs[1]--;
tstates += ( 1);
tstates += ( 1);
}; fn11(); }
	break;case 12: { var fn12 = function() {
	
	

regs[0] = (regs[0] & 1) | (regs[2] & 0x0f ? 0 : 16) | 2;
regs[2] = (regs[2] + 1) ;


regs[0] = (regs[0] & 1) | ( regs[2] == 0x80 ? 4 : 0 ) | ( regs[2] & 0x0f ? 0 : 16 ) | sz53Table[regs[2]];
}; fn12(); }
	break;case 13: { var fn13 = function() {
	
	

regs[0] = (regs[0] & 1 ) | ( regs[2] & 0x0f ? 0 : 16 ) | 2;
regs[2] = (regs[2] - 1) ;


regs[0] |= (regs[2] == 0x7f ? 4 : 0) | sz53Table[regs[2]];
}; fn13(); }
	break;case 14: { var fn14 = function() {
	
	regs[2] = (tstates += ( 3), memory.read(regPairs[12])); regPairs[12]++;
}; fn14(); }
	break;case 15: { var fn15 = function() {
	
	regs[0] = (regs[0] & 196) | (regs[1] & 1);
regs[1] = (regs[1] >> 1) | (regs[1] << 7);
regs[0] |= (regs[1] & 40);
}; fn15(); }
	break;case 16: { var fn16 = function() {
	
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
}; fn16(); }
	break;case 17: { var fn17 = function() {
	
	var l = (tstates += ( 3), memory.read(regPairs[12])); regPairs[12]++;
var h = (tstates += ( 3), memory.read(regPairs[12])); regPairs[12]++;
regPairs[2] = (h<<8) | l;
}; fn17(); }
	break;case 18: { var fn18 = function() {
	
	tstates += ( 3);
while (display.nextEventTime != null && display.nextEventTime < tstates) display.doEvent();
memory.write(regPairs[2], regs[1]);;
}; fn18(); }
	break;case 19: { var fn19 = function() {
	
	regPairs[2]++;
tstates += ( 1);
tstates += ( 1);
}; fn19(); }
	break;case 20: { var fn20 = function() {
	
	

regs[0] = (regs[0] & 1) | (regs[5] & 0x0f ? 0 : 16) | 2;
regs[5] = (regs[5] + 1) ;


regs[0] = (regs[0] & 1) | ( regs[5] == 0x80 ? 4 : 0 ) | ( regs[5] & 0x0f ? 0 : 16 ) | sz53Table[regs[5]];
}; fn20(); }
	break;case 21: { var fn21 = function() {
	
	

regs[0] = (regs[0] & 1 ) | ( regs[5] & 0x0f ? 0 : 16 ) | 2;
regs[5] = (regs[5] - 1) ;


regs[0] |= (regs[5] == 0x7f ? 4 : 0) | sz53Table[regs[5]];
}; fn21(); }
	break;case 22: { var fn22 = function() {
	
	regs[5] = (tstates += ( 3), memory.read(regPairs[12])); regPairs[12]++;
}; fn22(); }
	break;case 23: { var fn23 = function() {
	
	var bytetemp = regs[1];
regs[1] = (regs[1] << 1) | (regs[0] & 1);
regs[0] = (regs[0] & 196) | (regs[1] & 40) | (bytetemp >> 7);
}; fn23(); }
	break;case 24: { var fn24 = function() {
	
	var offset = (tstates += ( 3), memory.read(regPairs[12]));
tstates += ( 1);
tstates += ( 1);
tstates += ( 1);
tstates += ( 1);
tstates += ( 1);
regPairs[12]++;
regPairs[12] += (offset & 0x80 ? offset - 0x100 : offset);
}; fn24(); }
	break;case 25: { var fn25 = function() {
	
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
}; fn25(); }
	break;case 26: { var fn26 = function() {
	
	regs[1] = (tstates += ( 3), memory.read(regPairs[2]));
}; fn26(); }
	break;case 27: { var fn27 = function() {
	
	regPairs[2]--;
tstates += ( 1);
tstates += ( 1);
}; fn27(); }
	break;case 28: { var fn28 = function() {
	
	

regs[0] = (regs[0] & 1) | (regs[4] & 0x0f ? 0 : 16) | 2;
regs[4] = (regs[4] + 1) ;


regs[0] = (regs[0] & 1) | ( regs[4] == 0x80 ? 4 : 0 ) | ( regs[4] & 0x0f ? 0 : 16 ) | sz53Table[regs[4]];
}; fn28(); }
	break;case 29: { var fn29 = function() {
	
	

regs[0] = (regs[0] & 1 ) | ( regs[4] & 0x0f ? 0 : 16 ) | 2;
regs[4] = (regs[4] - 1) ;


regs[0] |= (regs[4] == 0x7f ? 4 : 0) | sz53Table[regs[4]];
}; fn29(); }
	break;case 30: { var fn30 = function() {
	
	regs[4] = (tstates += ( 3), memory.read(regPairs[12])); regPairs[12]++;
}; fn30(); }
	break;case 31: { var fn31 = function() {
	
	var bytetemp = regs[1];
regs[1] = (bytetemp >> 1) | (regs[0] << 7);
regs[0] = (regs[0] & 196) | (regs[1] & 40) | (bytetemp & 1);
}; fn31(); }
	break;case 32: { var fn32 = function() {
	
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
}; fn32(); }
	break;case 33: { var fn33 = function() {
	
	var l = (tstates += ( 3), memory.read(regPairs[12])); regPairs[12]++;
var h = (tstates += ( 3), memory.read(regPairs[12])); regPairs[12]++;
regPairs[8] = (h<<8) | l;
}; fn33(); }
	break;case 34: { var fn34 = function() {
	
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
}; fn34(); }
	break;case 35: { var fn35 = function() {
	
	regPairs[8]++;
tstates += ( 1);
tstates += ( 1);
}; fn35(); }
	break;case 36: { var fn36 = function() {
	
	

regs[0] = (regs[0] & 1) | (regs[17] & 0x0f ? 0 : 16) | 2;
regs[17] = (regs[17] + 1) ;


regs[0] = (regs[0] & 1) | ( regs[17] == 0x80 ? 4 : 0 ) | ( regs[17] & 0x0f ? 0 : 16 ) | sz53Table[regs[17]];
}; fn36(); }
	break;case 37: { var fn37 = function() {
	
	

regs[0] = (regs[0] & 1 ) | ( regs[17] & 0x0f ? 0 : 16 ) | 2;
regs[17] = (regs[17] - 1) ;


regs[0] |= (regs[17] == 0x7f ? 4 : 0) | sz53Table[regs[17]];
}; fn37(); }
	break;case 38: { var fn38 = function() {
	
	regs[17] = (tstates += ( 3), memory.read(regPairs[12])); regPairs[12]++;
}; fn38(); }
	break;case 39: { var fn39 = function() {
	
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
}; fn39(); }
	break;case 40: { var fn40 = function() {
	
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
}; fn40(); }
	break;case 41: { var fn41 = function() {
	
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
}; fn41(); }
	break;case 42: { var fn42 = function() {
	
	var l = (tstates += ( 3), memory.read(regPairs[12])); regPairs[12]++;
var h = (tstates += ( 3), memory.read(regPairs[12])); regPairs[12]++;
var addr = (h<<8) | l;
l = (tstates += ( 3), memory.read(addr));
addr = (addr + 1) & 0xffff;
h = (tstates += ( 3), memory.read(addr));
regPairs[8] = (h<<8) | l;
}; fn42(); }
	break;case 43: { var fn43 = function() {
	
	regPairs[8]--;
tstates += ( 1);
tstates += ( 1);
}; fn43(); }
	break;case 44: { var fn44 = function() {
	
	

regs[0] = (regs[0] & 1) | (regs[16] & 0x0f ? 0 : 16) | 2;
regs[16] = (regs[16] + 1) ;


regs[0] = (regs[0] & 1) | ( regs[16] == 0x80 ? 4 : 0 ) | ( regs[16] & 0x0f ? 0 : 16 ) | sz53Table[regs[16]];
}; fn44(); }
	break;case 45: { var fn45 = function() {
	
	

regs[0] = (regs[0] & 1 ) | ( regs[16] & 0x0f ? 0 : 16 ) | 2;
regs[16] = (regs[16] - 1) ;


regs[0] |= (regs[16] == 0x7f ? 4 : 0) | sz53Table[regs[16]];
}; fn45(); }
	break;case 46: { var fn46 = function() {
	
	regs[16] = (tstates += ( 3), memory.read(regPairs[12])); regPairs[12]++;
}; fn46(); }
	break;case 47: { var fn47 = function() {
	
	regs[1] ^= 0xff;
regs[0] = (regs[0] & 197) | (regs[1] & 40) | 18;
}; fn47(); }
	break;case 48: { var fn48 = function() {
	
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
}; fn48(); }
	break;case 49: { var fn49 = function() {
	
	var l = (tstates += ( 3), memory.read(regPairs[12])); regPairs[12]++;
var h = (tstates += ( 3), memory.read(regPairs[12])); regPairs[12]++;
regPairs[11] = (h<<8) | l;
}; fn49(); }
	break;case 50: { var fn50 = function() {
	
	var l = (tstates += ( 3), memory.read(regPairs[12])); regPairs[12]++;
var h = (tstates += ( 3), memory.read(regPairs[12])); regPairs[12]++;
var addr = (h<<8) | l;
tstates += ( 3);
while (display.nextEventTime != null && display.nextEventTime < tstates) display.doEvent();
memory.write(addr, regs[1]);;
}; fn50(); }
	break;case 51: { var fn51 = function() {
	
	regPairs[11]++;
tstates += ( 1);
tstates += ( 1);
}; fn51(); }
	break;case 52: { var fn52 = function() {
	
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
}; fn52(); }
	break;case 53: { var fn53 = function() {
	
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
}; fn53(); }
	break;case 54: { var fn54 = function() {
	
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
}; fn54(); }
	break;case 55: { var fn55 = function() {
	
	regs[0] = (regs[0] & 196) | (regs[1] & 40) | 1;
}; fn55(); }
	break;case 56: { var fn56 = function() {
	
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
}; fn56(); }
	break;case 57: { var fn57 = function() {
	
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
}; fn57(); }
	break;case 58: { var fn58 = function() {
	
	var l = (tstates += ( 3), memory.read(regPairs[12])); regPairs[12]++;
var h = (tstates += ( 3), memory.read(regPairs[12])); regPairs[12]++;
var addr = (h<<8) | l;
regs[1] = (tstates += ( 3), memory.read(addr));
}; fn58(); }
	break;case 59: { var fn59 = function() {
	
	regPairs[11]--;
tstates += ( 1);
tstates += ( 1);
}; fn59(); }
	break;case 60: { var fn60 = function() {
	
	

regs[0] = (regs[0] & 1) | (regs[1] & 0x0f ? 0 : 16) | 2;
regs[1] = (regs[1] + 1) ;


regs[0] = (regs[0] & 1) | ( regs[1] == 0x80 ? 4 : 0 ) | ( regs[1] & 0x0f ? 0 : 16 ) | sz53Table[regs[1]];
}; fn60(); }
	break;case 61: { var fn61 = function() {
	
	

regs[0] = (regs[0] & 1 ) | ( regs[1] & 0x0f ? 0 : 16 ) | 2;
regs[1] = (regs[1] - 1) ;


regs[0] |= (regs[1] == 0x7f ? 4 : 0) | sz53Table[regs[1]];
}; fn61(); }
	break;case 62: { var fn62 = function() {
	
	regs[1] = (tstates += ( 3), memory.read(regPairs[12])); regPairs[12]++;
}; fn62(); }
	break;case 63: { var fn63 = function() {
	
	regs[0] = ( regs[0] & 196 ) | ( (regs[0] & 1) ? 16 : 1 ) | ( regs[1] & 40 );
}; fn63(); }
	break;case 64: { var fn64 = function() {
	
	regs[3] = regs[3];
}; fn64(); }
	break;case 65: { var fn65 = function() {
	
	regs[3] = regs[2];
}; fn65(); }
	break;case 66: { var fn66 = function() {
	
	regs[3] = regs[5];
}; fn66(); }
	break;case 67: { var fn67 = function() {
	
	regs[3] = regs[4];
}; fn67(); }
	break;case 68: { var fn68 = function() {
	
	regs[3] = regs[17];
}; fn68(); }
	break;case 69: { var fn69 = function() {
	
	regs[3] = regs[16];
}; fn69(); }
	break;case 70: { var fn70 = function() {
	
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
}; fn70(); }
	break;case 71: { var fn71 = function() {
	
	regs[3] = regs[1];
}; fn71(); }
	break;case 72: { var fn72 = function() {
	
	regs[2] = regs[3];
}; fn72(); }
	break;case 73: { var fn73 = function() {
	
	regs[2] = regs[2];
}; fn73(); }
	break;case 74: { var fn74 = function() {
	
	regs[2] = regs[5];
}; fn74(); }
	break;case 75: { var fn75 = function() {
	
	regs[2] = regs[4];
}; fn75(); }
	break;case 76: { var fn76 = function() {
	
	regs[2] = regs[17];
}; fn76(); }
	break;case 77: { var fn77 = function() {
	
	regs[2] = regs[16];
}; fn77(); }
	break;case 78: { var fn78 = function() {
	
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
}; fn78(); }
	break;case 79: { var fn79 = function() {
	
	regs[2] = regs[1];
}; fn79(); }
	break;case 80: { var fn80 = function() {
	
	regs[5] = regs[3];
}; fn80(); }
	break;case 81: { var fn81 = function() {
	
	regs[5] = regs[2];
}; fn81(); }
	break;case 82: { var fn82 = function() {
	
	regs[5] = regs[5];
}; fn82(); }
	break;case 83: { var fn83 = function() {
	
	regs[5] = regs[4];
}; fn83(); }
	break;case 84: { var fn84 = function() {
	
	regs[5] = regs[17];
}; fn84(); }
	break;case 85: { var fn85 = function() {
	
	regs[5] = regs[16];
}; fn85(); }
	break;case 86: { var fn86 = function() {
	
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
}; fn86(); }
	break;case 87: { var fn87 = function() {
	
	regs[5] = regs[1];
}; fn87(); }
	break;case 88: { var fn88 = function() {
	
	regs[4] = regs[3];
}; fn88(); }
	break;case 89: { var fn89 = function() {
	
	regs[4] = regs[2];
}; fn89(); }
	break;case 90: { var fn90 = function() {
	
	regs[4] = regs[5];
}; fn90(); }
	break;case 91: { var fn91 = function() {
	
	regs[4] = regs[4];
}; fn91(); }
	break;case 92: { var fn92 = function() {
	
	regs[4] = regs[17];
}; fn92(); }
	break;case 93: { var fn93 = function() {
	
	regs[4] = regs[16];
}; fn93(); }
	break;case 94: { var fn94 = function() {
	
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
}; fn94(); }
	break;case 95: { var fn95 = function() {
	
	regs[4] = regs[1];
}; fn95(); }
	break;case 96: { var fn96 = function() {
	
	regs[17] = regs[3];
}; fn96(); }
	break;case 97: { var fn97 = function() {
	
	regs[17] = regs[2];
}; fn97(); }
	break;case 98: { var fn98 = function() {
	
	regs[17] = regs[5];
}; fn98(); }
	break;case 99: { var fn99 = function() {
	
	regs[17] = regs[4];
}; fn99(); }
	break;case 100: { var fn100 = function() {
	
	regs[17] = regs[17];
}; fn100(); }
	break;case 101: { var fn101 = function() {
	
	regs[17] = regs[16];
}; fn101(); }
	break;case 102: { var fn102 = function() {
	
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
}; fn102(); }
	break;case 103: { var fn103 = function() {
	
	regs[17] = regs[1];
}; fn103(); }
	break;case 104: { var fn104 = function() {
	
	regs[16] = regs[3];
}; fn104(); }
	break;case 105: { var fn105 = function() {
	
	regs[16] = regs[2];
}; fn105(); }
	break;case 106: { var fn106 = function() {
	
	regs[16] = regs[5];
}; fn106(); }
	break;case 107: { var fn107 = function() {
	
	regs[16] = regs[4];
}; fn107(); }
	break;case 108: { var fn108 = function() {
	
	regs[16] = regs[17];
}; fn108(); }
	break;case 109: { var fn109 = function() {
	
	regs[16] = regs[16];
}; fn109(); }
	break;case 110: { var fn110 = function() {
	
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
}; fn110(); }
	break;case 111: { var fn111 = function() {
	
	regs[16] = regs[1];
}; fn111(); }
	break;case 112: { var fn112 = function() {
	
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
}; fn112(); }
	break;case 113: { var fn113 = function() {
	
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
}; fn113(); }
	break;case 114: { var fn114 = function() {
	
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
}; fn114(); }
	break;case 115: { var fn115 = function() {
	
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
}; fn115(); }
	break;case 116: { var fn116 = function() {
	
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
}; fn116(); }
	break;case 117: { var fn117 = function() {
	
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
}; fn117(); }
	break;case 118: { var fn118 = function() {
	
	halted = true;
regPairs[12]--;
}; fn118(); }
	break;case 119: { var fn119 = function() {
	
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
}; fn119(); }
	break;case 120: { var fn120 = function() {
	
	regs[1] = regs[3];
}; fn120(); }
	break;case 121: { var fn121 = function() {
	
	regs[1] = regs[2];
}; fn121(); }
	break;case 122: { var fn122 = function() {
	
	regs[1] = regs[5];
}; fn122(); }
	break;case 123: { var fn123 = function() {
	
	regs[1] = regs[4];
}; fn123(); }
	break;case 124: { var fn124 = function() {
	
	regs[1] = regs[17];
}; fn124(); }
	break;case 125: { var fn125 = function() {
	
	regs[1] = regs[16];
}; fn125(); }
	break;case 126: { var fn126 = function() {
	
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
}; fn126(); }
	break;case 127: { var fn127 = function() {
	
	regs[1] = regs[1];
}; fn127(); }
	break;case 128: { var fn128 = function() {
	
	

var addtemp = regs[1] + regs[3];
var lookup = ( (regs[1] & 0x88) >> 3 ) | ( (regs[3] & 0x88) >> 2 ) | ( (addtemp & 0x88) >> 1 );
regs[1] = addtemp;
regs[0] = ( addtemp & 0x100 ? 1 : 0 ) | halfcarryAddTable[lookup & 0x07] | overflowAddTable[lookup >> 4] | sz53Table[regs[1]];
}; fn128(); }
	break;case 129: { var fn129 = function() {
	
	

var addtemp = regs[1] + regs[2];
var lookup = ( (regs[1] & 0x88) >> 3 ) | ( (regs[2] & 0x88) >> 2 ) | ( (addtemp & 0x88) >> 1 );
regs[1] = addtemp;
regs[0] = ( addtemp & 0x100 ? 1 : 0 ) | halfcarryAddTable[lookup & 0x07] | overflowAddTable[lookup >> 4] | sz53Table[regs[1]];
}; fn129(); }
	break;case 130: { var fn130 = function() {
	
	

var addtemp = regs[1] + regs[5];
var lookup = ( (regs[1] & 0x88) >> 3 ) | ( (regs[5] & 0x88) >> 2 ) | ( (addtemp & 0x88) >> 1 );
regs[1] = addtemp;
regs[0] = ( addtemp & 0x100 ? 1 : 0 ) | halfcarryAddTable[lookup & 0x07] | overflowAddTable[lookup >> 4] | sz53Table[regs[1]];
}; fn130(); }
	break;case 131: { var fn131 = function() {
	
	

var addtemp = regs[1] + regs[4];
var lookup = ( (regs[1] & 0x88) >> 3 ) | ( (regs[4] & 0x88) >> 2 ) | ( (addtemp & 0x88) >> 1 );
regs[1] = addtemp;
regs[0] = ( addtemp & 0x100 ? 1 : 0 ) | halfcarryAddTable[lookup & 0x07] | overflowAddTable[lookup >> 4] | sz53Table[regs[1]];
}; fn131(); }
	break;case 132: { var fn132 = function() {
	
	

var addtemp = regs[1] + regs[17];
var lookup = ( (regs[1] & 0x88) >> 3 ) | ( (regs[17] & 0x88) >> 2 ) | ( (addtemp & 0x88) >> 1 );
regs[1] = addtemp;
regs[0] = ( addtemp & 0x100 ? 1 : 0 ) | halfcarryAddTable[lookup & 0x07] | overflowAddTable[lookup >> 4] | sz53Table[regs[1]];
}; fn132(); }
	break;case 133: { var fn133 = function() {
	
	

var addtemp = regs[1] + regs[16];
var lookup = ( (regs[1] & 0x88) >> 3 ) | ( (regs[16] & 0x88) >> 2 ) | ( (addtemp & 0x88) >> 1 );
regs[1] = addtemp;
regs[0] = ( addtemp & 0x100 ? 1 : 0 ) | halfcarryAddTable[lookup & 0x07] | overflowAddTable[lookup >> 4] | sz53Table[regs[1]];
}; fn133(); }
	break;case 134: { var fn134 = function() {
	
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
}; fn134(); }
	break;case 135: { var fn135 = function() {
	
	

var addtemp = regs[1] + regs[1];
var lookup = ( (regs[1] & 0x88) >> 3 ) | ( (regs[1] & 0x88) >> 2 ) | ( (addtemp & 0x88) >> 1 );
regs[1] = addtemp;
regs[0] = ( addtemp & 0x100 ? 1 : 0 ) | halfcarryAddTable[lookup & 0x07] | overflowAddTable[lookup >> 4] | sz53Table[regs[1]];
}; fn135(); }
	break;case 136: { var fn136 = function() {
	
	

var adctemp = regs[1] + regs[3] + (regs[0] & 1);
var lookup = ( (regs[1] & 0x88) >> 3 ) | ( (regs[3] & 0x88) >> 2 ) | ( (adctemp & 0x88) >> 1 );
regs[1] = adctemp;
regs[0] = ( adctemp & 0x100 ? 1 : 0 ) | halfcarryAddTable[lookup & 0x07] | overflowAddTable[lookup >> 4] | sz53Table[regs[1]];
}; fn136(); }
	break;case 137: { var fn137 = function() {
	
	

var adctemp = regs[1] + regs[2] + (regs[0] & 1);
var lookup = ( (regs[1] & 0x88) >> 3 ) | ( (regs[2] & 0x88) >> 2 ) | ( (adctemp & 0x88) >> 1 );
regs[1] = adctemp;
regs[0] = ( adctemp & 0x100 ? 1 : 0 ) | halfcarryAddTable[lookup & 0x07] | overflowAddTable[lookup >> 4] | sz53Table[regs[1]];
}; fn137(); }
	break;case 138: { var fn138 = function() {
	
	

var adctemp = regs[1] + regs[5] + (regs[0] & 1);
var lookup = ( (regs[1] & 0x88) >> 3 ) | ( (regs[5] & 0x88) >> 2 ) | ( (adctemp & 0x88) >> 1 );
regs[1] = adctemp;
regs[0] = ( adctemp & 0x100 ? 1 : 0 ) | halfcarryAddTable[lookup & 0x07] | overflowAddTable[lookup >> 4] | sz53Table[regs[1]];
}; fn138(); }
	break;case 139: { var fn139 = function() {
	
	

var adctemp = regs[1] + regs[4] + (regs[0] & 1);
var lookup = ( (regs[1] & 0x88) >> 3 ) | ( (regs[4] & 0x88) >> 2 ) | ( (adctemp & 0x88) >> 1 );
regs[1] = adctemp;
regs[0] = ( adctemp & 0x100 ? 1 : 0 ) | halfcarryAddTable[lookup & 0x07] | overflowAddTable[lookup >> 4] | sz53Table[regs[1]];
}; fn139(); }
	break;case 140: { var fn140 = function() {
	
	

var adctemp = regs[1] + regs[17] + (regs[0] & 1);
var lookup = ( (regs[1] & 0x88) >> 3 ) | ( (regs[17] & 0x88) >> 2 ) | ( (adctemp & 0x88) >> 1 );
regs[1] = adctemp;
regs[0] = ( adctemp & 0x100 ? 1 : 0 ) | halfcarryAddTable[lookup & 0x07] | overflowAddTable[lookup >> 4] | sz53Table[regs[1]];
}; fn140(); }
	break;case 141: { var fn141 = function() {
	
	

var adctemp = regs[1] + regs[16] + (regs[0] & 1);
var lookup = ( (regs[1] & 0x88) >> 3 ) | ( (regs[16] & 0x88) >> 2 ) | ( (adctemp & 0x88) >> 1 );
regs[1] = adctemp;
regs[0] = ( adctemp & 0x100 ? 1 : 0 ) | halfcarryAddTable[lookup & 0x07] | overflowAddTable[lookup >> 4] | sz53Table[regs[1]];
}; fn141(); }
	break;case 142: { var fn142 = function() {
	
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
}; fn142(); }
	break;case 143: { var fn143 = function() {
	
	

var adctemp = regs[1] + regs[1] + (regs[0] & 1);
var lookup = ( (regs[1] & 0x88) >> 3 ) | ( (regs[1] & 0x88) >> 2 ) | ( (adctemp & 0x88) >> 1 );
regs[1] = adctemp;
regs[0] = ( adctemp & 0x100 ? 1 : 0 ) | halfcarryAddTable[lookup & 0x07] | overflowAddTable[lookup >> 4] | sz53Table[regs[1]];
}; fn143(); }
	break;case 144: { var fn144 = function() {
	
	
var subtemp = regs[1] - regs[3];
var lookup = ( (regs[1] & 0x88) >> 3 ) | ( (regs[3] & 0x88) >> 2 ) | ( (subtemp & 0x88) >> 1 );
regs[1] = subtemp;
regs[0] = ( subtemp & 0x100 ? 1 : 0 ) | 2 | halfcarrySubTable[lookup & 0x07] | overflowSubTable[lookup >> 4] | sz53Table[regs[1]];
}; fn144(); }
	break;case 145: { var fn145 = function() {
	
	
var subtemp = regs[1] - regs[2];
var lookup = ( (regs[1] & 0x88) >> 3 ) | ( (regs[2] & 0x88) >> 2 ) | ( (subtemp & 0x88) >> 1 );
regs[1] = subtemp;
regs[0] = ( subtemp & 0x100 ? 1 : 0 ) | 2 | halfcarrySubTable[lookup & 0x07] | overflowSubTable[lookup >> 4] | sz53Table[regs[1]];
}; fn145(); }
	break;case 146: { var fn146 = function() {
	
	
var subtemp = regs[1] - regs[5];
var lookup = ( (regs[1] & 0x88) >> 3 ) | ( (regs[5] & 0x88) >> 2 ) | ( (subtemp & 0x88) >> 1 );
regs[1] = subtemp;
regs[0] = ( subtemp & 0x100 ? 1 : 0 ) | 2 | halfcarrySubTable[lookup & 0x07] | overflowSubTable[lookup >> 4] | sz53Table[regs[1]];
}; fn146(); }
	break;case 147: { var fn147 = function() {
	
	
var subtemp = regs[1] - regs[4];
var lookup = ( (regs[1] & 0x88) >> 3 ) | ( (regs[4] & 0x88) >> 2 ) | ( (subtemp & 0x88) >> 1 );
regs[1] = subtemp;
regs[0] = ( subtemp & 0x100 ? 1 : 0 ) | 2 | halfcarrySubTable[lookup & 0x07] | overflowSubTable[lookup >> 4] | sz53Table[regs[1]];
}; fn147(); }
	break;case 148: { var fn148 = function() {
	
	
var subtemp = regs[1] - regs[17];
var lookup = ( (regs[1] & 0x88) >> 3 ) | ( (regs[17] & 0x88) >> 2 ) | ( (subtemp & 0x88) >> 1 );
regs[1] = subtemp;
regs[0] = ( subtemp & 0x100 ? 1 : 0 ) | 2 | halfcarrySubTable[lookup & 0x07] | overflowSubTable[lookup >> 4] | sz53Table[regs[1]];
}; fn148(); }
	break;case 149: { var fn149 = function() {
	
	
var subtemp = regs[1] - regs[16];
var lookup = ( (regs[1] & 0x88) >> 3 ) | ( (regs[16] & 0x88) >> 2 ) | ( (subtemp & 0x88) >> 1 );
regs[1] = subtemp;
regs[0] = ( subtemp & 0x100 ? 1 : 0 ) | 2 | halfcarrySubTable[lookup & 0x07] | overflowSubTable[lookup >> 4] | sz53Table[regs[1]];
}; fn149(); }
	break;case 150: { var fn150 = function() {
	
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
}; fn150(); }
	break;case 151: { var fn151 = function() {
	
	
var subtemp = regs[1] - regs[1];
var lookup = ( (regs[1] & 0x88) >> 3 ) | ( (regs[1] & 0x88) >> 2 ) | ( (subtemp & 0x88) >> 1 );
regs[1] = subtemp;
regs[0] = ( subtemp & 0x100 ? 1 : 0 ) | 2 | halfcarrySubTable[lookup & 0x07] | overflowSubTable[lookup >> 4] | sz53Table[regs[1]];
}; fn151(); }
	break;case 152: { var fn152 = function() {
	
	
var sbctemp = regs[1] - regs[3] - (regs[0] & 1);
var lookup = ( (regs[1] & 0x88) >> 3 ) | ( (regs[3] & 0x88) >> 2 ) | ( (sbctemp & 0x88) >> 1 );
regs[1] = sbctemp;
regs[0] = ( sbctemp & 0x100 ? 1 : 0 ) | 2 | halfcarrySubTable[lookup & 0x07] | overflowSubTable[lookup >> 4] | sz53Table[regs[1]];
}; fn152(); }
	break;case 153: { var fn153 = function() {
	
	
var sbctemp = regs[1] - regs[2] - (regs[0] & 1);
var lookup = ( (regs[1] & 0x88) >> 3 ) | ( (regs[2] & 0x88) >> 2 ) | ( (sbctemp & 0x88) >> 1 );
regs[1] = sbctemp;
regs[0] = ( sbctemp & 0x100 ? 1 : 0 ) | 2 | halfcarrySubTable[lookup & 0x07] | overflowSubTable[lookup >> 4] | sz53Table[regs[1]];
}; fn153(); }
	break;case 154: { var fn154 = function() {
	
	
var sbctemp = regs[1] - regs[5] - (regs[0] & 1);
var lookup = ( (regs[1] & 0x88) >> 3 ) | ( (regs[5] & 0x88) >> 2 ) | ( (sbctemp & 0x88) >> 1 );
regs[1] = sbctemp;
regs[0] = ( sbctemp & 0x100 ? 1 : 0 ) | 2 | halfcarrySubTable[lookup & 0x07] | overflowSubTable[lookup >> 4] | sz53Table[regs[1]];
}; fn154(); }
	break;case 155: { var fn155 = function() {
	
	
var sbctemp = regs[1] - regs[4] - (regs[0] & 1);
var lookup = ( (regs[1] & 0x88) >> 3 ) | ( (regs[4] & 0x88) >> 2 ) | ( (sbctemp & 0x88) >> 1 );
regs[1] = sbctemp;
regs[0] = ( sbctemp & 0x100 ? 1 : 0 ) | 2 | halfcarrySubTable[lookup & 0x07] | overflowSubTable[lookup >> 4] | sz53Table[regs[1]];
}; fn155(); }
	break;case 156: { var fn156 = function() {
	
	
var sbctemp = regs[1] - regs[17] - (regs[0] & 1);
var lookup = ( (regs[1] & 0x88) >> 3 ) | ( (regs[17] & 0x88) >> 2 ) | ( (sbctemp & 0x88) >> 1 );
regs[1] = sbctemp;
regs[0] = ( sbctemp & 0x100 ? 1 : 0 ) | 2 | halfcarrySubTable[lookup & 0x07] | overflowSubTable[lookup >> 4] | sz53Table[regs[1]];
}; fn156(); }
	break;case 157: { var fn157 = function() {
	
	
var sbctemp = regs[1] - regs[16] - (regs[0] & 1);
var lookup = ( (regs[1] & 0x88) >> 3 ) | ( (regs[16] & 0x88) >> 2 ) | ( (sbctemp & 0x88) >> 1 );
regs[1] = sbctemp;
regs[0] = ( sbctemp & 0x100 ? 1 : 0 ) | 2 | halfcarrySubTable[lookup & 0x07] | overflowSubTable[lookup >> 4] | sz53Table[regs[1]];
}; fn157(); }
	break;case 158: { var fn158 = function() {
	
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
}; fn158(); }
	break;case 159: { var fn159 = function() {
	
	
var sbctemp = regs[1] - regs[1] - (regs[0] & 1);
var lookup = ( (regs[1] & 0x88) >> 3 ) | ( (regs[1] & 0x88) >> 2 ) | ( (sbctemp & 0x88) >> 1 );
regs[1] = sbctemp;
regs[0] = ( sbctemp & 0x100 ? 1 : 0 ) | 2 | halfcarrySubTable[lookup & 0x07] | overflowSubTable[lookup >> 4] | sz53Table[regs[1]];
}; fn159(); }
	break;case 160: { var fn160 = function() {
	
	

regs[1] &= regs[3];
regs[0] = 16 | sz53pTable[regs[1]];
}; fn160(); }
	break;case 161: { var fn161 = function() {
	
	

regs[1] &= regs[2];
regs[0] = 16 | sz53pTable[regs[1]];
}; fn161(); }
	break;case 162: { var fn162 = function() {
	
	

regs[1] &= regs[5];
regs[0] = 16 | sz53pTable[regs[1]];
}; fn162(); }
	break;case 163: { var fn163 = function() {
	
	

regs[1] &= regs[4];
regs[0] = 16 | sz53pTable[regs[1]];
}; fn163(); }
	break;case 164: { var fn164 = function() {
	
	

regs[1] &= regs[17];
regs[0] = 16 | sz53pTable[regs[1]];
}; fn164(); }
	break;case 165: { var fn165 = function() {
	
	

regs[1] &= regs[16];
regs[0] = 16 | sz53pTable[regs[1]];
}; fn165(); }
	break;case 166: { var fn166 = function() {
	
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
}; fn166(); }
	break;case 167: { var fn167 = function() {
	
	

regs[1] &= regs[1];
regs[0] = 16 | sz53pTable[regs[1]];
}; fn167(); }
	break;case 168: { var fn168 = function() {
	
	
regs[1] ^= regs[3];
regs[0] = sz53pTable[regs[1]];
}; fn168(); }
	break;case 169: { var fn169 = function() {
	
	
regs[1] ^= regs[2];
regs[0] = sz53pTable[regs[1]];
}; fn169(); }
	break;case 170: { var fn170 = function() {
	
	
regs[1] ^= regs[5];
regs[0] = sz53pTable[regs[1]];
}; fn170(); }
	break;case 171: { var fn171 = function() {
	
	
regs[1] ^= regs[4];
regs[0] = sz53pTable[regs[1]];
}; fn171(); }
	break;case 172: { var fn172 = function() {
	
	
regs[1] ^= regs[17];
regs[0] = sz53pTable[regs[1]];
}; fn172(); }
	break;case 173: { var fn173 = function() {
	
	
regs[1] ^= regs[16];
regs[0] = sz53pTable[regs[1]];
}; fn173(); }
	break;case 174: { var fn174 = function() {
	
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
}; fn174(); }
	break;case 175: { var fn175 = function() {
	
	
regs[1] ^= regs[1];
regs[0] = sz53pTable[regs[1]];
}; fn175(); }
	break;case 176: { var fn176 = function() {
	
	

regs[1] |= regs[3];
regs[0] = sz53pTable[regs[1]];
}; fn176(); }
	break;case 177: { var fn177 = function() {
	
	

regs[1] |= regs[2];
regs[0] = sz53pTable[regs[1]];
}; fn177(); }
	break;case 178: { var fn178 = function() {
	
	

regs[1] |= regs[5];
regs[0] = sz53pTable[regs[1]];
}; fn178(); }
	break;case 179: { var fn179 = function() {
	
	

regs[1] |= regs[4];
regs[0] = sz53pTable[regs[1]];
}; fn179(); }
	break;case 180: { var fn180 = function() {
	
	

regs[1] |= regs[17];
regs[0] = sz53pTable[regs[1]];
}; fn180(); }
	break;case 181: { var fn181 = function() {
	
	

regs[1] |= regs[16];
regs[0] = sz53pTable[regs[1]];
}; fn181(); }
	break;case 182: { var fn182 = function() {
	
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
}; fn182(); }
	break;case 183: { var fn183 = function() {
	
	

regs[1] |= regs[1];
regs[0] = sz53pTable[regs[1]];
}; fn183(); }
	break;case 184: { var fn184 = function() {
	
	

var cptemp = regs[1] - regs[3];
var lookup = ( (regs[1] & 0x88) >> 3 ) | ( (regs[3] & 0x88) >> 2 ) | ( (cptemp & 0x88) >> 1 );
regs[0] = ( cptemp & 0x100 ? 1 : ( cptemp ? 0 : 64 ) ) | 2 | halfcarrySubTable[lookup & 0x07] | overflowSubTable[lookup >> 4] | ( regs[3] & 40 ) | ( cptemp & 128 );
}; fn184(); }
	break;case 185: { var fn185 = function() {
	
	

var cptemp = regs[1] - regs[2];
var lookup = ( (regs[1] & 0x88) >> 3 ) | ( (regs[2] & 0x88) >> 2 ) | ( (cptemp & 0x88) >> 1 );
regs[0] = ( cptemp & 0x100 ? 1 : ( cptemp ? 0 : 64 ) ) | 2 | halfcarrySubTable[lookup & 0x07] | overflowSubTable[lookup >> 4] | ( regs[2] & 40 ) | ( cptemp & 128 );
}; fn185(); }
	break;case 186: { var fn186 = function() {
	
	

var cptemp = regs[1] - regs[5];
var lookup = ( (regs[1] & 0x88) >> 3 ) | ( (regs[5] & 0x88) >> 2 ) | ( (cptemp & 0x88) >> 1 );
regs[0] = ( cptemp & 0x100 ? 1 : ( cptemp ? 0 : 64 ) ) | 2 | halfcarrySubTable[lookup & 0x07] | overflowSubTable[lookup >> 4] | ( regs[5] & 40 ) | ( cptemp & 128 );
}; fn186(); }
	break;case 187: { var fn187 = function() {
	
	

var cptemp = regs[1] - regs[4];
var lookup = ( (regs[1] & 0x88) >> 3 ) | ( (regs[4] & 0x88) >> 2 ) | ( (cptemp & 0x88) >> 1 );
regs[0] = ( cptemp & 0x100 ? 1 : ( cptemp ? 0 : 64 ) ) | 2 | halfcarrySubTable[lookup & 0x07] | overflowSubTable[lookup >> 4] | ( regs[4] & 40 ) | ( cptemp & 128 );
}; fn187(); }
	break;case 188: { var fn188 = function() {
	
	

var cptemp = regs[1] - regs[17];
var lookup = ( (regs[1] & 0x88) >> 3 ) | ( (regs[17] & 0x88) >> 2 ) | ( (cptemp & 0x88) >> 1 );
regs[0] = ( cptemp & 0x100 ? 1 : ( cptemp ? 0 : 64 ) ) | 2 | halfcarrySubTable[lookup & 0x07] | overflowSubTable[lookup >> 4] | ( regs[17] & 40 ) | ( cptemp & 128 );
}; fn188(); }
	break;case 189: { var fn189 = function() {
	
	

var cptemp = regs[1] - regs[16];
var lookup = ( (regs[1] & 0x88) >> 3 ) | ( (regs[16] & 0x88) >> 2 ) | ( (cptemp & 0x88) >> 1 );
regs[0] = ( cptemp & 0x100 ? 1 : ( cptemp ? 0 : 64 ) ) | 2 | halfcarrySubTable[lookup & 0x07] | overflowSubTable[lookup >> 4] | ( regs[16] & 40 ) | ( cptemp & 128 );
}; fn189(); }
	break;case 190: { var fn190 = function() {
	
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
}; fn190(); }
	break;case 191: { var fn191 = function() {
	
	

var cptemp = regs[1] - regs[1];
var lookup = ( (regs[1] & 0x88) >> 3 ) | ( (regs[1] & 0x88) >> 2 ) | ( (cptemp & 0x88) >> 1 );
regs[0] = ( cptemp & 0x100 ? 1 : ( cptemp ? 0 : 64 ) ) | 2 | halfcarrySubTable[lookup & 0x07] | overflowSubTable[lookup >> 4] | ( regs[1] & 40 ) | ( cptemp & 128 );
}; fn191(); }
	break;case 192: { var fn192 = function() {
	
	tstates += ( 1);
if (!(regs[0] & 64)) {
	var l = (tstates += ( 3), memory.read(regPairs[11])); regPairs[11]++;
	var h = (tstates += ( 3), memory.read(regPairs[11])); regPairs[11]++;
	regPairs[12] = (h<<8) | l;
}
}; fn192(); }
	break;case 193: { var fn193 = function() {
	
	var l = (tstates += ( 3), memory.read(regPairs[11])); regPairs[11]++;
var h = (tstates += ( 3), memory.read(regPairs[11])); regPairs[11]++;
regPairs[1] = (h<<8) | l;
}; fn193(); }
	break;case 194: { var fn194 = function() {
	
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
}; fn194(); }
	break;case 195: { var fn195 = function() {
	
	var l = (tstates += ( 3), memory.read(regPairs[12])); regPairs[12]++;
var h = (tstates += ( 3), memory.read(regPairs[12])); regPairs[12]++;
regPairs[12] = (h<<8) | l;
}; fn195(); }
	break;case 196: { var fn196 = function() {
	
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
}; fn196(); }
	break;case 197: { var fn197 = function() {
	
	tstates += ( 1);
regPairs[11]--; tstates += ( 3);
while (display.nextEventTime != null && display.nextEventTime < tstates) display.doEvent();
memory.write(regPairs[11], regPairs[1] >> 8);;
regPairs[11]--; tstates += ( 3);
while (display.nextEventTime != null && display.nextEventTime < tstates) display.doEvent();
memory.write(regPairs[11], regPairs[1] & 0xff);;
}; fn197(); }
	break;case 198: { var fn198 = function() {
	
	var val = (tstates += ( 3), memory.read(regPairs[12])); regPairs[12]++;

var addtemp = regs[1] + val;
var lookup = ( (regs[1] & 0x88) >> 3 ) | ( (val & 0x88) >> 2 ) | ( (addtemp & 0x88) >> 1 );
regs[1] = addtemp;
regs[0] = ( addtemp & 0x100 ? 1 : 0 ) | halfcarryAddTable[lookup & 0x07] | overflowAddTable[lookup >> 4] | sz53Table[regs[1]];
}; fn198(); }
	break;case 199: { var fn199 = function() {
	
	tstates += ( 1);
regPairs[11]--; tstates += ( 3);
while (display.nextEventTime != null && display.nextEventTime < tstates) display.doEvent();
memory.write(regPairs[11], regPairs[12] >> 8);;
regPairs[11]--; tstates += ( 3);
while (display.nextEventTime != null && display.nextEventTime < tstates) display.doEvent();
memory.write(regPairs[11], regPairs[12] & 0xff);;
regPairs[12] = 0;
}; fn199(); }
	break;case 200: { var fn200 = function() {
	
	tstates += ( 1);
if (regs[0] & 64) {
	var l = (tstates += ( 3), memory.read(regPairs[11])); regPairs[11]++;
	var h = (tstates += ( 3), memory.read(regPairs[11])); regPairs[11]++;
	regPairs[12] = (h<<8) | l;
}
}; fn200(); }
	break;case 201: { var fn201 = function() {
	
	var l = (tstates += ( 3), memory.read(regPairs[11])); regPairs[11]++;
var h = (tstates += ( 3), memory.read(regPairs[11])); regPairs[11]++;
regPairs[12] = (h<<8) | l;
}; fn201(); }
	break;case 202: { var fn202 = function() {
	
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
}; fn202(); }
	break;case 203: { var fn203 = function() {
	
	opcodePrefix = 'DDCB';
interruptible = false;
}; fn203(); }
	break;case 204: { var fn204 = function() {
	
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
}; fn204(); }
	break;case 205: { var fn205 = function() {
	
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
}; fn205(); }
	break;case 206: { var fn206 = function() {
	
	var val = (tstates += ( 3), memory.read(regPairs[12])); regPairs[12]++;

var adctemp = regs[1] + val + (regs[0] & 1);
var lookup = ( (regs[1] & 0x88) >> 3 ) | ( (val & 0x88) >> 2 ) | ( (adctemp & 0x88) >> 1 );
regs[1] = adctemp;
regs[0] = ( adctemp & 0x100 ? 1 : 0 ) | halfcarryAddTable[lookup & 0x07] | overflowAddTable[lookup >> 4] | sz53Table[regs[1]];
}; fn206(); }
	break;case 207: { var fn207 = function() {
	
	tstates += ( 1);
regPairs[11]--; tstates += ( 3);
while (display.nextEventTime != null && display.nextEventTime < tstates) display.doEvent();
memory.write(regPairs[11], regPairs[12] >> 8);;
regPairs[11]--; tstates += ( 3);
while (display.nextEventTime != null && display.nextEventTime < tstates) display.doEvent();
memory.write(regPairs[11], regPairs[12] & 0xff);;
regPairs[12] = 8;
}; fn207(); }
	break;case 208: { var fn208 = function() {
	
	tstates += ( 1);
if (!(regs[0] & 1)) {
	var l = (tstates += ( 3), memory.read(regPairs[11])); regPairs[11]++;
	var h = (tstates += ( 3), memory.read(regPairs[11])); regPairs[11]++;
	regPairs[12] = (h<<8) | l;
}
}; fn208(); }
	break;case 209: { var fn209 = function() {
	
	var l = (tstates += ( 3), memory.read(regPairs[11])); regPairs[11]++;
var h = (tstates += ( 3), memory.read(regPairs[11])); regPairs[11]++;
regPairs[2] = (h<<8) | l;
}; fn209(); }
	break;case 210: { var fn210 = function() {
	
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
}; fn210(); }
	break;case 211: { var fn211 = function() {
	
	var port = (regs[1] << 8) | (tstates += ( 3), memory.read(regPairs[12])); regPairs[12]++;
tstates += 1;
ioBus.write(port, regs[1], tstates);
tstates += 3;
}; fn211(); }
	break;case 212: { var fn212 = function() {
	
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
}; fn212(); }
	break;case 213: { var fn213 = function() {
	
	tstates += ( 1);
regPairs[11]--; tstates += ( 3);
while (display.nextEventTime != null && display.nextEventTime < tstates) display.doEvent();
memory.write(regPairs[11], regPairs[2] >> 8);;
regPairs[11]--; tstates += ( 3);
while (display.nextEventTime != null && display.nextEventTime < tstates) display.doEvent();
memory.write(regPairs[11], regPairs[2] & 0xff);;
}; fn213(); }
	break;case 214: { var fn214 = function() {
	
	var val = (tstates += ( 3), memory.read(regPairs[12])); regPairs[12]++;
var subtemp = regs[1] - val;
var lookup = ( (regs[1] & 0x88) >> 3 ) | ( (val & 0x88) >> 2 ) | ( (subtemp & 0x88) >> 1 );
regs[1] = subtemp;
regs[0] = ( subtemp & 0x100 ? 1 : 0 ) | 2 | halfcarrySubTable[lookup & 0x07] | overflowSubTable[lookup >> 4] | sz53Table[regs[1]];
}; fn214(); }
	break;case 215: { var fn215 = function() {
	
	tstates += ( 1);
regPairs[11]--; tstates += ( 3);
while (display.nextEventTime != null && display.nextEventTime < tstates) display.doEvent();
memory.write(regPairs[11], regPairs[12] >> 8);;
regPairs[11]--; tstates += ( 3);
while (display.nextEventTime != null && display.nextEventTime < tstates) display.doEvent();
memory.write(regPairs[11], regPairs[12] & 0xff);;
regPairs[12] = 16;
}; fn215(); }
	break;case 216: { var fn216 = function() {
	
	tstates += ( 1);
if (regs[0] & 1) {
	var l = (tstates += ( 3), memory.read(regPairs[11])); regPairs[11]++;
	var h = (tstates += ( 3), memory.read(regPairs[11])); regPairs[11]++;
	regPairs[12] = (h<<8) | l;
}
}; fn216(); }
	break;case 217: { var fn217 = function() {
	
	var wordtemp;
wordtemp = regPairs[1]; regPairs[1] = regPairs[5]; regPairs[5] = wordtemp;
wordtemp = regPairs[2]; regPairs[2] = regPairs[6]; regPairs[6] = wordtemp;
wordtemp = regPairs[3]; regPairs[3] = regPairs[7]; regPairs[7] = wordtemp;
}; fn217(); }
	break;case 218: { var fn218 = function() {
	
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
}; fn218(); }
	break;case 219: { var fn219 = function() {
	
	var val = (tstates += ( 3), memory.read(regPairs[12])); regPairs[12]++;
var port = (regs[1] << 8) | val;
tstates += 1;
regs[1] = ioBus.read(port);
tstates += 3;
}; fn219(); }
	break;case 220: { var fn220 = function() {
	
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
}; fn220(); }
	break;case 221: { var fn221 = function() {
	
	opcodePrefix = 'DD';
interruptible = false;
}; fn221(); }
	break;case 222: { var fn222 = function() {
	
	var val = (tstates += ( 3), memory.read(regPairs[12])); regPairs[12]++;
var sbctemp = regs[1] - val - (regs[0] & 1);
var lookup = ( (regs[1] & 0x88) >> 3 ) | ( (val & 0x88) >> 2 ) | ( (sbctemp & 0x88) >> 1 );
regs[1] = sbctemp;
regs[0] = ( sbctemp & 0x100 ? 1 : 0 ) | 2 | halfcarrySubTable[lookup & 0x07] | overflowSubTable[lookup >> 4] | sz53Table[regs[1]];
}; fn222(); }
	break;case 223: { var fn223 = function() {
	
	tstates += ( 1);
regPairs[11]--; tstates += ( 3);
while (display.nextEventTime != null && display.nextEventTime < tstates) display.doEvent();
memory.write(regPairs[11], regPairs[12] >> 8);;
regPairs[11]--; tstates += ( 3);
while (display.nextEventTime != null && display.nextEventTime < tstates) display.doEvent();
memory.write(regPairs[11], regPairs[12] & 0xff);;
regPairs[12] = 24;
}; fn223(); }
	break;case 224: { var fn224 = function() {
	
	tstates += ( 1);
if (!(regs[0] & 4)) {
	var l = (tstates += ( 3), memory.read(regPairs[11])); regPairs[11]++;
	var h = (tstates += ( 3), memory.read(regPairs[11])); regPairs[11]++;
	regPairs[12] = (h<<8) | l;
}
}; fn224(); }
	break;case 225: { var fn225 = function() {
	
	var l = (tstates += ( 3), memory.read(regPairs[11])); regPairs[11]++;
var h = (tstates += ( 3), memory.read(regPairs[11])); regPairs[11]++;
regPairs[8] = (h<<8) | l;
}; fn225(); }
	break;case 226: { var fn226 = function() {
	
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
}; fn226(); }
	break;case 227: { var fn227 = function() {
	
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
}; fn227(); }
	break;case 228: { var fn228 = function() {
	
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
}; fn228(); }
	break;case 229: { var fn229 = function() {
	
	tstates += ( 1);
regPairs[11]--; tstates += ( 3);
while (display.nextEventTime != null && display.nextEventTime < tstates) display.doEvent();
memory.write(regPairs[11], regPairs[8] >> 8);;
regPairs[11]--; tstates += ( 3);
while (display.nextEventTime != null && display.nextEventTime < tstates) display.doEvent();
memory.write(regPairs[11], regPairs[8] & 0xff);;
}; fn229(); }
	break;case 230: { var fn230 = function() {
	
	var val = (tstates += ( 3), memory.read(regPairs[12])); regPairs[12]++;

regs[1] &= val;
regs[0] = 16 | sz53pTable[regs[1]];
}; fn230(); }
	break;case 231: { var fn231 = function() {
	
	tstates += ( 1);
regPairs[11]--; tstates += ( 3);
while (display.nextEventTime != null && display.nextEventTime < tstates) display.doEvent();
memory.write(regPairs[11], regPairs[12] >> 8);;
regPairs[11]--; tstates += ( 3);
while (display.nextEventTime != null && display.nextEventTime < tstates) display.doEvent();
memory.write(regPairs[11], regPairs[12] & 0xff);;
regPairs[12] = 32;
}; fn231(); }
	break;case 232: { var fn232 = function() {
	
	tstates += ( 1);
if (regs[0] & 4) {
	var l = (tstates += ( 3), memory.read(regPairs[11])); regPairs[11]++;
	var h = (tstates += ( 3), memory.read(regPairs[11])); regPairs[11]++;
	regPairs[12] = (h<<8) | l;
}
}; fn232(); }
	break;case 233: { var fn233 = function() {
	
	regPairs[12] = regPairs[8];
}; fn233(); }
	break;case 234: { var fn234 = function() {
	
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
}; fn234(); }
	break;case 235: { var fn235 = function() {
	
	var temp = regPairs[2];
regPairs[2] = regPairs[3];
regPairs[3] = temp;
}; fn235(); }
	break;case 236: { var fn236 = function() {
	
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
}; fn236(); }
	break;case 237: { var fn237 = function() {
	
	opcodePrefix = 'ED';
interruptible = false;
}; fn237(); }
	break;case 238: { var fn238 = function() {
	
	var val = (tstates += ( 3), memory.read(regPairs[12])); regPairs[12]++;
regs[1] ^= val;
regs[0] = sz53pTable[regs[1]];
}; fn238(); }
	break;case 239: { var fn239 = function() {
	
	tstates += ( 1);
regPairs[11]--; tstates += ( 3);
while (display.nextEventTime != null && display.nextEventTime < tstates) display.doEvent();
memory.write(regPairs[11], regPairs[12] >> 8);;
regPairs[11]--; tstates += ( 3);
while (display.nextEventTime != null && display.nextEventTime < tstates) display.doEvent();
memory.write(regPairs[11], regPairs[12] & 0xff);;
regPairs[12] = 40;
}; fn239(); }
	break;case 240: { var fn240 = function() {
	
	tstates += ( 1);
if (!(regs[0] & 128)) {
	var l = (tstates += ( 3), memory.read(regPairs[11])); regPairs[11]++;
	var h = (tstates += ( 3), memory.read(regPairs[11])); regPairs[11]++;
	regPairs[12] = (h<<8) | l;
}
}; fn240(); }
	break;case 241: { var fn241 = function() {
	
	var l = (tstates += ( 3), memory.read(regPairs[11])); regPairs[11]++;
var h = (tstates += ( 3), memory.read(regPairs[11])); regPairs[11]++;
regPairs[0] = (h<<8) | l;
}; fn241(); }
	break;case 242: { var fn242 = function() {
	
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
}; fn242(); }
	break;case 243: { var fn243 = function() {
	
	iff1 = iff2 = 0;
}; fn243(); }
	break;case 244: { var fn244 = function() {
	
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
}; fn244(); }
	break;case 245: { var fn245 = function() {
	
	tstates += ( 1);
regPairs[11]--; tstates += ( 3);
while (display.nextEventTime != null && display.nextEventTime < tstates) display.doEvent();
memory.write(regPairs[11], regPairs[0] >> 8);;
regPairs[11]--; tstates += ( 3);
while (display.nextEventTime != null && display.nextEventTime < tstates) display.doEvent();
memory.write(regPairs[11], regPairs[0] & 0xff);;
}; fn245(); }
	break;case 246: { var fn246 = function() {
	
	var val = (tstates += ( 3), memory.read(regPairs[12])); regPairs[12]++;

regs[1] |= val;
regs[0] = sz53pTable[regs[1]];
}; fn246(); }
	break;case 247: { var fn247 = function() {
	
	tstates += ( 1);
regPairs[11]--; tstates += ( 3);
while (display.nextEventTime != null && display.nextEventTime < tstates) display.doEvent();
memory.write(regPairs[11], regPairs[12] >> 8);;
regPairs[11]--; tstates += ( 3);
while (display.nextEventTime != null && display.nextEventTime < tstates) display.doEvent();
memory.write(regPairs[11], regPairs[12] & 0xff);;
regPairs[12] = 48;
}; fn247(); }
	break;case 248: { var fn248 = function() {
	
	tstates += ( 1);
if (regs[0] & 128) {
	var l = (tstates += ( 3), memory.read(regPairs[11])); regPairs[11]++;
	var h = (tstates += ( 3), memory.read(regPairs[11])); regPairs[11]++;
	regPairs[12] = (h<<8) | l;
}
}; fn248(); }
	break;case 249: { var fn249 = function() {
	
	regPairs[11] = regPairs[8];
tstates += ( 1);
tstates += ( 1);
}; fn249(); }
	break;case 250: { var fn250 = function() {
	
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
}; fn250(); }
	break;case 251: { var fn251 = function() {
	
	iff1 = iff2 = 1;
interruptible = false;
}; fn251(); }
	break;case 252: { var fn252 = function() {
	
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
}; fn252(); }
	break;case 253: { var fn253 = function() {
	
	opcodePrefix = 'FD';
interruptible = false;
}; fn253(); }
	break;case 254: { var fn254 = function() {
	
	var val = (tstates += ( 3), memory.read(regPairs[12])); regPairs[12]++;

var cptemp = regs[1] - val;
var lookup = ( (regs[1] & 0x88) >> 3 ) | ( (val & 0x88) >> 2 ) | ( (cptemp & 0x88) >> 1 );
regs[0] = ( cptemp & 0x100 ? 1 : ( cptemp ? 0 : 64 ) ) | 2 | halfcarrySubTable[lookup & 0x07] | overflowSubTable[lookup >> 4] | ( val & 40 ) | ( cptemp & 128 );
}; fn254(); }
	break;case 255: { var fn255 = function() {
	
	tstates += ( 1);
regPairs[11]--; tstates += ( 3);
while (display.nextEventTime != null && display.nextEventTime < tstates) display.doEvent();
memory.write(regPairs[11], regPairs[12] >> 8);;
regPairs[11]--; tstates += ( 3);
while (display.nextEventTime != null && display.nextEventTime < tstates) display.doEvent();
memory.write(regPairs[11], regPairs[12] & 0xff);;
regPairs[12] = 56;
}; fn255(); }
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
	case 0: { var fn0 = function() {
	
	var addr = (regPairs[8] + offset) & 0xffff;
regs[3] = (tstates += ( 3), memory.read(addr));

regs[3] = ( (regs[3] << 1) | (regs[3] >> 7) ) ;
regs[0] = (regs[3] & 1) | sz53pTable[regs[3]];

tstates += ( 1);
tstates += ( 3);
while (display.nextEventTime != null && display.nextEventTime < tstates) display.doEvent();
memory.write(addr, regs[3]);;
}; fn0(); }
	break;case 1: { var fn1 = function() {
	
	var addr = (regPairs[8] + offset) & 0xffff;
regs[2] = (tstates += ( 3), memory.read(addr));

regs[2] = ( (regs[2] << 1) | (regs[2] >> 7) ) ;
regs[0] = (regs[2] & 1) | sz53pTable[regs[2]];

tstates += ( 1);
tstates += ( 3);
while (display.nextEventTime != null && display.nextEventTime < tstates) display.doEvent();
memory.write(addr, regs[2]);;
}; fn1(); }
	break;case 2: { var fn2 = function() {
	
	var addr = (regPairs[8] + offset) & 0xffff;
regs[5] = (tstates += ( 3), memory.read(addr));

regs[5] = ( (regs[5] << 1) | (regs[5] >> 7) ) ;
regs[0] = (regs[5] & 1) | sz53pTable[regs[5]];

tstates += ( 1);
tstates += ( 3);
while (display.nextEventTime != null && display.nextEventTime < tstates) display.doEvent();
memory.write(addr, regs[5]);;
}; fn2(); }
	break;case 3: { var fn3 = function() {
	
	var addr = (regPairs[8] + offset) & 0xffff;
regs[4] = (tstates += ( 3), memory.read(addr));

regs[4] = ( (regs[4] << 1) | (regs[4] >> 7) ) ;
regs[0] = (regs[4] & 1) | sz53pTable[regs[4]];

tstates += ( 1);
tstates += ( 3);
while (display.nextEventTime != null && display.nextEventTime < tstates) display.doEvent();
memory.write(addr, regs[4]);;
}; fn3(); }
	break;case 4: { var fn4 = function() {
	
	var addr = (regPairs[8] + offset) & 0xffff;
regs[7] = (tstates += ( 3), memory.read(addr));

regs[7] = ( (regs[7] << 1) | (regs[7] >> 7) ) ;
regs[0] = (regs[7] & 1) | sz53pTable[regs[7]];

tstates += ( 1);
tstates += ( 3);
while (display.nextEventTime != null && display.nextEventTime < tstates) display.doEvent();
memory.write(addr, regs[7]);;
}; fn4(); }
	break;case 5: { var fn5 = function() {
	
	var addr = (regPairs[8] + offset) & 0xffff;
regs[6] = (tstates += ( 3), memory.read(addr));

regs[6] = ( (regs[6] << 1) | (regs[6] >> 7) ) ;
regs[0] = (regs[6] & 1) | sz53pTable[regs[6]];

tstates += ( 1);
tstates += ( 3);
while (display.nextEventTime != null && display.nextEventTime < tstates) display.doEvent();
memory.write(addr, regs[6]);;
}; fn5(); }
	break;case 6: { var fn6 = function() {
	
	var addr = (regPairs[8] + offset) & 0xffff;
var val = (tstates += ( 3), memory.read(addr));
val = ( (val << 1) | (val >> 7) ) & 0xff;
regs[0] = (val & 1) | sz53pTable[val];
tstates += ( 1);
tstates += ( 3);
while (display.nextEventTime != null && display.nextEventTime < tstates) display.doEvent();
memory.write(addr, val);;
}; fn6(); }
	break;case 7: { var fn7 = function() {
	
	var addr = (regPairs[8] + offset) & 0xffff;
regs[1] = (tstates += ( 3), memory.read(addr));

regs[1] = ( (regs[1] << 1) | (regs[1] >> 7) ) ;
regs[0] = (regs[1] & 1) | sz53pTable[regs[1]];

tstates += ( 1);
tstates += ( 3);
while (display.nextEventTime != null && display.nextEventTime < tstates) display.doEvent();
memory.write(addr, regs[1]);;
}; fn7(); }
	break;case 8: { var fn8 = function() {
	
	var addr = (regPairs[8] + offset) & 0xffff;
regs[3] = (tstates += ( 3), memory.read(addr));

regs[0] = regs[3] & 1;
regs[3] = ( (regs[3] >> 1) | (regs[3] << 7) ) ;
regs[0] |= sz53pTable[regs[3]];

tstates += ( 1);
tstates += ( 3);
while (display.nextEventTime != null && display.nextEventTime < tstates) display.doEvent();
memory.write(addr, regs[3]);;
}; fn8(); }
	break;case 9: { var fn9 = function() {
	
	var addr = (regPairs[8] + offset) & 0xffff;
regs[2] = (tstates += ( 3), memory.read(addr));

regs[0] = regs[2] & 1;
regs[2] = ( (regs[2] >> 1) | (regs[2] << 7) ) ;
regs[0] |= sz53pTable[regs[2]];

tstates += ( 1);
tstates += ( 3);
while (display.nextEventTime != null && display.nextEventTime < tstates) display.doEvent();
memory.write(addr, regs[2]);;
}; fn9(); }
	break;case 10: { var fn10 = function() {
	
	var addr = (regPairs[8] + offset) & 0xffff;
regs[5] = (tstates += ( 3), memory.read(addr));

regs[0] = regs[5] & 1;
regs[5] = ( (regs[5] >> 1) | (regs[5] << 7) ) ;
regs[0] |= sz53pTable[regs[5]];

tstates += ( 1);
tstates += ( 3);
while (display.nextEventTime != null && display.nextEventTime < tstates) display.doEvent();
memory.write(addr, regs[5]);;
}; fn10(); }
	break;case 11: { var fn11 = function() {
	
	var addr = (regPairs[8] + offset) & 0xffff;
regs[4] = (tstates += ( 3), memory.read(addr));

regs[0] = regs[4] & 1;
regs[4] = ( (regs[4] >> 1) | (regs[4] << 7) ) ;
regs[0] |= sz53pTable[regs[4]];

tstates += ( 1);
tstates += ( 3);
while (display.nextEventTime != null && display.nextEventTime < tstates) display.doEvent();
memory.write(addr, regs[4]);;
}; fn11(); }
	break;case 12: { var fn12 = function() {
	
	var addr = (regPairs[8] + offset) & 0xffff;
regs[7] = (tstates += ( 3), memory.read(addr));

regs[0] = regs[7] & 1;
regs[7] = ( (regs[7] >> 1) | (regs[7] << 7) ) ;
regs[0] |= sz53pTable[regs[7]];

tstates += ( 1);
tstates += ( 3);
while (display.nextEventTime != null && display.nextEventTime < tstates) display.doEvent();
memory.write(addr, regs[7]);;
}; fn12(); }
	break;case 13: { var fn13 = function() {
	
	var addr = (regPairs[8] + offset) & 0xffff;
regs[6] = (tstates += ( 3), memory.read(addr));

regs[0] = regs[6] & 1;
regs[6] = ( (regs[6] >> 1) | (regs[6] << 7) ) ;
regs[0] |= sz53pTable[regs[6]];

tstates += ( 1);
tstates += ( 3);
while (display.nextEventTime != null && display.nextEventTime < tstates) display.doEvent();
memory.write(addr, regs[6]);;
}; fn13(); }
	break;case 14: { var fn14 = function() {
	
	var addr = (regPairs[8] + offset) & 0xffff;
var val = (tstates += ( 3), memory.read(addr));
regs[0] = val & 1;
val = ( (val >> 1) | (val << 7) ) & 0xff;
regs[0] |= sz53pTable[val];
tstates += ( 1);
tstates += ( 3);
while (display.nextEventTime != null && display.nextEventTime < tstates) display.doEvent();
memory.write(addr, val);;
}; fn14(); }
	break;case 15: { var fn15 = function() {
	
	var addr = (regPairs[8] + offset) & 0xffff;
regs[1] = (tstates += ( 3), memory.read(addr));

regs[0] = regs[1] & 1;
regs[1] = ( (regs[1] >> 1) | (regs[1] << 7) ) ;
regs[0] |= sz53pTable[regs[1]];

tstates += ( 1);
tstates += ( 3);
while (display.nextEventTime != null && display.nextEventTime < tstates) display.doEvent();
memory.write(addr, regs[1]);;
}; fn15(); }
	break;case 16: { var fn16 = function() {
	
	var addr = (regPairs[8] + offset) & 0xffff;
regs[3] = (tstates += ( 3), memory.read(addr));

var rltemp = regs[3];
regs[3] = ( (regs[3] << 1) | (regs[0] & 1) ) ;
regs[0] = ( rltemp >> 7 ) | sz53pTable[regs[3]];

tstates += ( 1);
tstates += ( 3);
while (display.nextEventTime != null && display.nextEventTime < tstates) display.doEvent();
memory.write(addr, regs[3]);;
}; fn16(); }
	break;case 17: { var fn17 = function() {
	
	var addr = (regPairs[8] + offset) & 0xffff;
regs[2] = (tstates += ( 3), memory.read(addr));

var rltemp = regs[2];
regs[2] = ( (regs[2] << 1) | (regs[0] & 1) ) ;
regs[0] = ( rltemp >> 7 ) | sz53pTable[regs[2]];

tstates += ( 1);
tstates += ( 3);
while (display.nextEventTime != null && display.nextEventTime < tstates) display.doEvent();
memory.write(addr, regs[2]);;
}; fn17(); }
	break;case 18: { var fn18 = function() {
	
	var addr = (regPairs[8] + offset) & 0xffff;
regs[5] = (tstates += ( 3), memory.read(addr));

var rltemp = regs[5];
regs[5] = ( (regs[5] << 1) | (regs[0] & 1) ) ;
regs[0] = ( rltemp >> 7 ) | sz53pTable[regs[5]];

tstates += ( 1);
tstates += ( 3);
while (display.nextEventTime != null && display.nextEventTime < tstates) display.doEvent();
memory.write(addr, regs[5]);;
}; fn18(); }
	break;case 19: { var fn19 = function() {
	
	var addr = (regPairs[8] + offset) & 0xffff;
regs[4] = (tstates += ( 3), memory.read(addr));

var rltemp = regs[4];
regs[4] = ( (regs[4] << 1) | (regs[0] & 1) ) ;
regs[0] = ( rltemp >> 7 ) | sz53pTable[regs[4]];

tstates += ( 1);
tstates += ( 3);
while (display.nextEventTime != null && display.nextEventTime < tstates) display.doEvent();
memory.write(addr, regs[4]);;
}; fn19(); }
	break;case 20: { var fn20 = function() {
	
	var addr = (regPairs[8] + offset) & 0xffff;
regs[7] = (tstates += ( 3), memory.read(addr));

var rltemp = regs[7];
regs[7] = ( (regs[7] << 1) | (regs[0] & 1) ) ;
regs[0] = ( rltemp >> 7 ) | sz53pTable[regs[7]];

tstates += ( 1);
tstates += ( 3);
while (display.nextEventTime != null && display.nextEventTime < tstates) display.doEvent();
memory.write(addr, regs[7]);;
}; fn20(); }
	break;case 21: { var fn21 = function() {
	
	var addr = (regPairs[8] + offset) & 0xffff;
regs[6] = (tstates += ( 3), memory.read(addr));

var rltemp = regs[6];
regs[6] = ( (regs[6] << 1) | (regs[0] & 1) ) ;
regs[0] = ( rltemp >> 7 ) | sz53pTable[regs[6]];

tstates += ( 1);
tstates += ( 3);
while (display.nextEventTime != null && display.nextEventTime < tstates) display.doEvent();
memory.write(addr, regs[6]);;
}; fn21(); }
	break;case 22: { var fn22 = function() {
	
	var addr = (regPairs[8] + offset) & 0xffff;
var val = (tstates += ( 3), memory.read(addr));
var rltemp = val;
val = ( (val << 1) | (regs[0] & 1) ) & 0xff;
regs[0] = ( rltemp >> 7 ) | sz53pTable[val];
tstates += ( 1);
tstates += ( 3);
while (display.nextEventTime != null && display.nextEventTime < tstates) display.doEvent();
memory.write(addr, val);;
}; fn22(); }
	break;case 23: { var fn23 = function() {
	
	var addr = (regPairs[8] + offset) & 0xffff;
regs[1] = (tstates += ( 3), memory.read(addr));

var rltemp = regs[1];
regs[1] = ( (regs[1] << 1) | (regs[0] & 1) ) ;
regs[0] = ( rltemp >> 7 ) | sz53pTable[regs[1]];

tstates += ( 1);
tstates += ( 3);
while (display.nextEventTime != null && display.nextEventTime < tstates) display.doEvent();
memory.write(addr, regs[1]);;
}; fn23(); }
	break;case 24: { var fn24 = function() {
	
	var addr = (regPairs[8] + offset) & 0xffff;
regs[3] = (tstates += ( 3), memory.read(addr));

var rrtemp = regs[3];
regs[3] = ( (regs[3] >> 1) | ( regs[0] << 7 ) ) ;
regs[0] = (rrtemp & 1) | sz53pTable[regs[3]];

tstates += ( 1);
tstates += ( 3);
while (display.nextEventTime != null && display.nextEventTime < tstates) display.doEvent();
memory.write(addr, regs[3]);;
}; fn24(); }
	break;case 25: { var fn25 = function() {
	
	var addr = (regPairs[8] + offset) & 0xffff;
regs[2] = (tstates += ( 3), memory.read(addr));

var rrtemp = regs[2];
regs[2] = ( (regs[2] >> 1) | ( regs[0] << 7 ) ) ;
regs[0] = (rrtemp & 1) | sz53pTable[regs[2]];

tstates += ( 1);
tstates += ( 3);
while (display.nextEventTime != null && display.nextEventTime < tstates) display.doEvent();
memory.write(addr, regs[2]);;
}; fn25(); }
	break;case 26: { var fn26 = function() {
	
	var addr = (regPairs[8] + offset) & 0xffff;
regs[5] = (tstates += ( 3), memory.read(addr));

var rrtemp = regs[5];
regs[5] = ( (regs[5] >> 1) | ( regs[0] << 7 ) ) ;
regs[0] = (rrtemp & 1) | sz53pTable[regs[5]];

tstates += ( 1);
tstates += ( 3);
while (display.nextEventTime != null && display.nextEventTime < tstates) display.doEvent();
memory.write(addr, regs[5]);;
}; fn26(); }
	break;case 27: { var fn27 = function() {
	
	var addr = (regPairs[8] + offset) & 0xffff;
regs[4] = (tstates += ( 3), memory.read(addr));

var rrtemp = regs[4];
regs[4] = ( (regs[4] >> 1) | ( regs[0] << 7 ) ) ;
regs[0] = (rrtemp & 1) | sz53pTable[regs[4]];

tstates += ( 1);
tstates += ( 3);
while (display.nextEventTime != null && display.nextEventTime < tstates) display.doEvent();
memory.write(addr, regs[4]);;
}; fn27(); }
	break;case 28: { var fn28 = function() {
	
	var addr = (regPairs[8] + offset) & 0xffff;
regs[7] = (tstates += ( 3), memory.read(addr));

var rrtemp = regs[7];
regs[7] = ( (regs[7] >> 1) | ( regs[0] << 7 ) ) ;
regs[0] = (rrtemp & 1) | sz53pTable[regs[7]];

tstates += ( 1);
tstates += ( 3);
while (display.nextEventTime != null && display.nextEventTime < tstates) display.doEvent();
memory.write(addr, regs[7]);;
}; fn28(); }
	break;case 29: { var fn29 = function() {
	
	var addr = (regPairs[8] + offset) & 0xffff;
regs[6] = (tstates += ( 3), memory.read(addr));

var rrtemp = regs[6];
regs[6] = ( (regs[6] >> 1) | ( regs[0] << 7 ) ) ;
regs[0] = (rrtemp & 1) | sz53pTable[regs[6]];

tstates += ( 1);
tstates += ( 3);
while (display.nextEventTime != null && display.nextEventTime < tstates) display.doEvent();
memory.write(addr, regs[6]);;
}; fn29(); }
	break;case 30: { var fn30 = function() {
	
	var addr = (regPairs[8] + offset) & 0xffff;
var val = (tstates += ( 3), memory.read(addr));
var rrtemp = val;
val = ( (val >> 1) | ( regs[0] << 7 ) ) & 0xff;
regs[0] = (rrtemp & 1) | sz53pTable[val];
tstates += ( 1);
tstates += ( 3);
while (display.nextEventTime != null && display.nextEventTime < tstates) display.doEvent();
memory.write(addr, val);;
}; fn30(); }
	break;case 31: { var fn31 = function() {
	
	var addr = (regPairs[8] + offset) & 0xffff;
regs[1] = (tstates += ( 3), memory.read(addr));

var rrtemp = regs[1];
regs[1] = ( (regs[1] >> 1) | ( regs[0] << 7 ) ) ;
regs[0] = (rrtemp & 1) | sz53pTable[regs[1]];

tstates += ( 1);
tstates += ( 3);
while (display.nextEventTime != null && display.nextEventTime < tstates) display.doEvent();
memory.write(addr, regs[1]);;
}; fn31(); }
	break;case 32: { var fn32 = function() {
	
	var addr = (regPairs[8] + offset) & 0xffff;
regs[3] = (tstates += ( 3), memory.read(addr));

regs[0] = regs[3] >> 7;
regs[3] = (regs[3] << 1) ;
regs[0] |= sz53pTable[regs[3]];

tstates += ( 1);
tstates += ( 3);
while (display.nextEventTime != null && display.nextEventTime < tstates) display.doEvent();
memory.write(addr, regs[3]);;
}; fn32(); }
	break;case 33: { var fn33 = function() {
	
	var addr = (regPairs[8] + offset) & 0xffff;
regs[2] = (tstates += ( 3), memory.read(addr));

regs[0] = regs[2] >> 7;
regs[2] = (regs[2] << 1) ;
regs[0] |= sz53pTable[regs[2]];

tstates += ( 1);
tstates += ( 3);
while (display.nextEventTime != null && display.nextEventTime < tstates) display.doEvent();
memory.write(addr, regs[2]);;
}; fn33(); }
	break;case 34: { var fn34 = function() {
	
	var addr = (regPairs[8] + offset) & 0xffff;
regs[5] = (tstates += ( 3), memory.read(addr));

regs[0] = regs[5] >> 7;
regs[5] = (regs[5] << 1) ;
regs[0] |= sz53pTable[regs[5]];

tstates += ( 1);
tstates += ( 3);
while (display.nextEventTime != null && display.nextEventTime < tstates) display.doEvent();
memory.write(addr, regs[5]);;
}; fn34(); }
	break;case 35: { var fn35 = function() {
	
	var addr = (regPairs[8] + offset) & 0xffff;
regs[4] = (tstates += ( 3), memory.read(addr));

regs[0] = regs[4] >> 7;
regs[4] = (regs[4] << 1) ;
regs[0] |= sz53pTable[regs[4]];

tstates += ( 1);
tstates += ( 3);
while (display.nextEventTime != null && display.nextEventTime < tstates) display.doEvent();
memory.write(addr, regs[4]);;
}; fn35(); }
	break;case 36: { var fn36 = function() {
	
	var addr = (regPairs[8] + offset) & 0xffff;
regs[7] = (tstates += ( 3), memory.read(addr));

regs[0] = regs[7] >> 7;
regs[7] = (regs[7] << 1) ;
regs[0] |= sz53pTable[regs[7]];

tstates += ( 1);
tstates += ( 3);
while (display.nextEventTime != null && display.nextEventTime < tstates) display.doEvent();
memory.write(addr, regs[7]);;
}; fn36(); }
	break;case 37: { var fn37 = function() {
	
	var addr = (regPairs[8] + offset) & 0xffff;
regs[6] = (tstates += ( 3), memory.read(addr));

regs[0] = regs[6] >> 7;
regs[6] = (regs[6] << 1) ;
regs[0] |= sz53pTable[regs[6]];

tstates += ( 1);
tstates += ( 3);
while (display.nextEventTime != null && display.nextEventTime < tstates) display.doEvent();
memory.write(addr, regs[6]);;
}; fn37(); }
	break;case 38: { var fn38 = function() {
	
	var addr = (regPairs[8] + offset) & 0xffff;
var val = (tstates += ( 3), memory.read(addr));
regs[0] = val >> 7;
val = (val << 1) & 0xff;
regs[0] |= sz53pTable[val];
tstates += ( 1);
tstates += ( 3);
while (display.nextEventTime != null && display.nextEventTime < tstates) display.doEvent();
memory.write(addr, val);;
}; fn38(); }
	break;case 39: { var fn39 = function() {
	
	var addr = (regPairs[8] + offset) & 0xffff;
regs[1] = (tstates += ( 3), memory.read(addr));

regs[0] = regs[1] >> 7;
regs[1] = (regs[1] << 1) ;
regs[0] |= sz53pTable[regs[1]];

tstates += ( 1);
tstates += ( 3);
while (display.nextEventTime != null && display.nextEventTime < tstates) display.doEvent();
memory.write(addr, regs[1]);;
}; fn39(); }
	break;case 40: { var fn40 = function() {
	
	var addr = (regPairs[8] + offset) & 0xffff;
regs[3] = (tstates += ( 3), memory.read(addr));

regs[0] = regs[3] & 1;
regs[3] = ( (regs[3] & 0x80) | (regs[3] >> 1) ) ;
regs[0] |= sz53pTable[regs[3]];

tstates += ( 1);
tstates += ( 3);
while (display.nextEventTime != null && display.nextEventTime < tstates) display.doEvent();
memory.write(addr, regs[3]);;
}; fn40(); }
	break;case 41: { var fn41 = function() {
	
	var addr = (regPairs[8] + offset) & 0xffff;
regs[2] = (tstates += ( 3), memory.read(addr));

regs[0] = regs[2] & 1;
regs[2] = ( (regs[2] & 0x80) | (regs[2] >> 1) ) ;
regs[0] |= sz53pTable[regs[2]];

tstates += ( 1);
tstates += ( 3);
while (display.nextEventTime != null && display.nextEventTime < tstates) display.doEvent();
memory.write(addr, regs[2]);;
}; fn41(); }
	break;case 42: { var fn42 = function() {
	
	var addr = (regPairs[8] + offset) & 0xffff;
regs[5] = (tstates += ( 3), memory.read(addr));

regs[0] = regs[5] & 1;
regs[5] = ( (regs[5] & 0x80) | (regs[5] >> 1) ) ;
regs[0] |= sz53pTable[regs[5]];

tstates += ( 1);
tstates += ( 3);
while (display.nextEventTime != null && display.nextEventTime < tstates) display.doEvent();
memory.write(addr, regs[5]);;
}; fn42(); }
	break;case 43: { var fn43 = function() {
	
	var addr = (regPairs[8] + offset) & 0xffff;
regs[4] = (tstates += ( 3), memory.read(addr));

regs[0] = regs[4] & 1;
regs[4] = ( (regs[4] & 0x80) | (regs[4] >> 1) ) ;
regs[0] |= sz53pTable[regs[4]];

tstates += ( 1);
tstates += ( 3);
while (display.nextEventTime != null && display.nextEventTime < tstates) display.doEvent();
memory.write(addr, regs[4]);;
}; fn43(); }
	break;case 44: { var fn44 = function() {
	
	var addr = (regPairs[8] + offset) & 0xffff;
regs[7] = (tstates += ( 3), memory.read(addr));

regs[0] = regs[7] & 1;
regs[7] = ( (regs[7] & 0x80) | (regs[7] >> 1) ) ;
regs[0] |= sz53pTable[regs[7]];

tstates += ( 1);
tstates += ( 3);
while (display.nextEventTime != null && display.nextEventTime < tstates) display.doEvent();
memory.write(addr, regs[7]);;
}; fn44(); }
	break;case 45: { var fn45 = function() {
	
	var addr = (regPairs[8] + offset) & 0xffff;
regs[6] = (tstates += ( 3), memory.read(addr));

regs[0] = regs[6] & 1;
regs[6] = ( (regs[6] & 0x80) | (regs[6] >> 1) ) ;
regs[0] |= sz53pTable[regs[6]];

tstates += ( 1);
tstates += ( 3);
while (display.nextEventTime != null && display.nextEventTime < tstates) display.doEvent();
memory.write(addr, regs[6]);;
}; fn45(); }
	break;case 46: { var fn46 = function() {
	
	var addr = (regPairs[8] + offset) & 0xffff;
var val = (tstates += ( 3), memory.read(addr));
regs[0] = val & 1;
val = ( (val & 0x80) | (val >> 1) ) & 0xff;
regs[0] |= sz53pTable[val];
tstates += ( 1);
tstates += ( 3);
while (display.nextEventTime != null && display.nextEventTime < tstates) display.doEvent();
memory.write(addr, val);;
}; fn46(); }
	break;case 47: { var fn47 = function() {
	
	var addr = (regPairs[8] + offset) & 0xffff;
regs[1] = (tstates += ( 3), memory.read(addr));

regs[0] = regs[1] & 1;
regs[1] = ( (regs[1] & 0x80) | (regs[1] >> 1) ) ;
regs[0] |= sz53pTable[regs[1]];

tstates += ( 1);
tstates += ( 3);
while (display.nextEventTime != null && display.nextEventTime < tstates) display.doEvent();
memory.write(addr, regs[1]);;
}; fn47(); }
	break;case 48: { var fn48 = function() {
	
	var addr = (regPairs[8] + offset) & 0xffff;
regs[3] = (tstates += ( 3), memory.read(addr));

regs[0] =  regs[3] >> 7;
regs[3] = (((regs[3]) << 1) ) | 0x01;
regs[0] |= sz53pTable[regs[3]];

tstates += ( 1);
tstates += ( 3);
while (display.nextEventTime != null && display.nextEventTime < tstates) display.doEvent();
memory.write(addr, regs[3]);;
}; fn48(); }
	break;case 49: { var fn49 = function() {
	
	var addr = (regPairs[8] + offset) & 0xffff;
regs[2] = (tstates += ( 3), memory.read(addr));

regs[0] =  regs[2] >> 7;
regs[2] = (((regs[2]) << 1) ) | 0x01;
regs[0] |= sz53pTable[regs[2]];

tstates += ( 1);
tstates += ( 3);
while (display.nextEventTime != null && display.nextEventTime < tstates) display.doEvent();
memory.write(addr, regs[2]);;
}; fn49(); }
	break;case 50: { var fn50 = function() {
	
	var addr = (regPairs[8] + offset) & 0xffff;
regs[5] = (tstates += ( 3), memory.read(addr));

regs[0] =  regs[5] >> 7;
regs[5] = (((regs[5]) << 1) ) | 0x01;
regs[0] |= sz53pTable[regs[5]];

tstates += ( 1);
tstates += ( 3);
while (display.nextEventTime != null && display.nextEventTime < tstates) display.doEvent();
memory.write(addr, regs[5]);;
}; fn50(); }
	break;case 51: { var fn51 = function() {
	
	var addr = (regPairs[8] + offset) & 0xffff;
regs[4] = (tstates += ( 3), memory.read(addr));

regs[0] =  regs[4] >> 7;
regs[4] = (((regs[4]) << 1) ) | 0x01;
regs[0] |= sz53pTable[regs[4]];

tstates += ( 1);
tstates += ( 3);
while (display.nextEventTime != null && display.nextEventTime < tstates) display.doEvent();
memory.write(addr, regs[4]);;
}; fn51(); }
	break;case 52: { var fn52 = function() {
	
	var addr = (regPairs[8] + offset) & 0xffff;
regs[7] = (tstates += ( 3), memory.read(addr));

regs[0] =  regs[7] >> 7;
regs[7] = (((regs[7]) << 1) ) | 0x01;
regs[0] |= sz53pTable[regs[7]];

tstates += ( 1);
tstates += ( 3);
while (display.nextEventTime != null && display.nextEventTime < tstates) display.doEvent();
memory.write(addr, regs[7]);;
}; fn52(); }
	break;case 53: { var fn53 = function() {
	
	var addr = (regPairs[8] + offset) & 0xffff;
regs[6] = (tstates += ( 3), memory.read(addr));

regs[0] =  regs[6] >> 7;
regs[6] = (((regs[6]) << 1) ) | 0x01;
regs[0] |= sz53pTable[regs[6]];

tstates += ( 1);
tstates += ( 3);
while (display.nextEventTime != null && display.nextEventTime < tstates) display.doEvent();
memory.write(addr, regs[6]);;
}; fn53(); }
	break;case 54: { var fn54 = function() {
	
	var addr = (regPairs[8] + offset) & 0xffff;
var val = (tstates += ( 3), memory.read(addr));
regs[0] =  val >> 7;
val = (((val) << 1) & 0xff) | 0x01;
regs[0] |= sz53pTable[val];
tstates += ( 1);
tstates += ( 3);
while (display.nextEventTime != null && display.nextEventTime < tstates) display.doEvent();
memory.write(addr, val);;
}; fn54(); }
	break;case 55: { var fn55 = function() {
	
	var addr = (regPairs[8] + offset) & 0xffff;
regs[1] = (tstates += ( 3), memory.read(addr));

regs[0] =  regs[1] >> 7;
regs[1] = (((regs[1]) << 1) ) | 0x01;
regs[0] |= sz53pTable[regs[1]];

tstates += ( 1);
tstates += ( 3);
while (display.nextEventTime != null && display.nextEventTime < tstates) display.doEvent();
memory.write(addr, regs[1]);;
}; fn55(); }
	break;case 56: { var fn56 = function() {
	
	var addr = (regPairs[8] + offset) & 0xffff;
regs[3] = (tstates += ( 3), memory.read(addr));

regs[0] =  regs[3] & 1;
regs[3] >>= 1;
regs[0] |= sz53pTable[regs[3]];

tstates += ( 1);
tstates += ( 3);
while (display.nextEventTime != null && display.nextEventTime < tstates) display.doEvent();
memory.write(addr, regs[3]);;
}; fn56(); }
	break;case 57: { var fn57 = function() {
	
	var addr = (regPairs[8] + offset) & 0xffff;
regs[2] = (tstates += ( 3), memory.read(addr));

regs[0] =  regs[2] & 1;
regs[2] >>= 1;
regs[0] |= sz53pTable[regs[2]];

tstates += ( 1);
tstates += ( 3);
while (display.nextEventTime != null && display.nextEventTime < tstates) display.doEvent();
memory.write(addr, regs[2]);;
}; fn57(); }
	break;case 58: { var fn58 = function() {
	
	var addr = (regPairs[8] + offset) & 0xffff;
regs[5] = (tstates += ( 3), memory.read(addr));

regs[0] =  regs[5] & 1;
regs[5] >>= 1;
regs[0] |= sz53pTable[regs[5]];

tstates += ( 1);
tstates += ( 3);
while (display.nextEventTime != null && display.nextEventTime < tstates) display.doEvent();
memory.write(addr, regs[5]);;
}; fn58(); }
	break;case 59: { var fn59 = function() {
	
	var addr = (regPairs[8] + offset) & 0xffff;
regs[4] = (tstates += ( 3), memory.read(addr));

regs[0] =  regs[4] & 1;
regs[4] >>= 1;
regs[0] |= sz53pTable[regs[4]];

tstates += ( 1);
tstates += ( 3);
while (display.nextEventTime != null && display.nextEventTime < tstates) display.doEvent();
memory.write(addr, regs[4]);;
}; fn59(); }
	break;case 60: { var fn60 = function() {
	
	var addr = (regPairs[8] + offset) & 0xffff;
regs[7] = (tstates += ( 3), memory.read(addr));

regs[0] =  regs[7] & 1;
regs[7] >>= 1;
regs[0] |= sz53pTable[regs[7]];

tstates += ( 1);
tstates += ( 3);
while (display.nextEventTime != null && display.nextEventTime < tstates) display.doEvent();
memory.write(addr, regs[7]);;
}; fn60(); }
	break;case 61: { var fn61 = function() {
	
	var addr = (regPairs[8] + offset) & 0xffff;
regs[6] = (tstates += ( 3), memory.read(addr));

regs[0] =  regs[6] & 1;
regs[6] >>= 1;
regs[0] |= sz53pTable[regs[6]];

tstates += ( 1);
tstates += ( 3);
while (display.nextEventTime != null && display.nextEventTime < tstates) display.doEvent();
memory.write(addr, regs[6]);;
}; fn61(); }
	break;case 62: { var fn62 = function() {
	
	var addr = (regPairs[8] + offset) & 0xffff;
var val = (tstates += ( 3), memory.read(addr));
regs[0] =  val & 1;
val >>= 1;
regs[0] |= sz53pTable[val];
tstates += ( 1);
tstates += ( 3);
while (display.nextEventTime != null && display.nextEventTime < tstates) display.doEvent();
memory.write(addr, val);;
}; fn62(); }
	break;case 63: { var fn63 = function() {
	
	var addr = (regPairs[8] + offset) & 0xffff;
regs[1] = (tstates += ( 3), memory.read(addr));

regs[0] =  regs[1] & 1;
regs[1] >>= 1;
regs[0] |= sz53pTable[regs[1]];

tstates += ( 1);
tstates += ( 3);
while (display.nextEventTime != null && display.nextEventTime < tstates) display.doEvent();
memory.write(addr, regs[1]);;
}; fn63(); }
	break;case 64: { var fn64 = function() {
	
	var addr = (regPairs[8] + offset) & 0xffff;
var value = (tstates += ( 3), memory.read(addr));
regs[0] = ( regs[0] & 1 ) | 16 | ( ( addr >> 8 ) & 40 );
if ( !(value & 1) ) regs[0] |= 68;

tstates += ( 1);
}; fn64(); }
	break;case 65: { var fn65 = function() {
	
	var addr = (regPairs[8] + offset) & 0xffff;
var value = (tstates += ( 3), memory.read(addr));
regs[0] = ( regs[0] & 1 ) | 16 | ( ( addr >> 8 ) & 40 );
if ( !(value & 1) ) regs[0] |= 68;

tstates += ( 1);
}; fn65(); }
	break;case 66: { var fn66 = function() {
	
	var addr = (regPairs[8] + offset) & 0xffff;
var value = (tstates += ( 3), memory.read(addr));
regs[0] = ( regs[0] & 1 ) | 16 | ( ( addr >> 8 ) & 40 );
if ( !(value & 1) ) regs[0] |= 68;

tstates += ( 1);
}; fn66(); }
	break;case 67: { var fn67 = function() {
	
	var addr = (regPairs[8] + offset) & 0xffff;
var value = (tstates += ( 3), memory.read(addr));
regs[0] = ( regs[0] & 1 ) | 16 | ( ( addr >> 8 ) & 40 );
if ( !(value & 1) ) regs[0] |= 68;

tstates += ( 1);
}; fn67(); }
	break;case 68: { var fn68 = function() {
	
	var addr = (regPairs[8] + offset) & 0xffff;
var value = (tstates += ( 3), memory.read(addr));
regs[0] = ( regs[0] & 1 ) | 16 | ( ( addr >> 8 ) & 40 );
if ( !(value & 1) ) regs[0] |= 68;

tstates += ( 1);
}; fn68(); }
	break;case 69: { var fn69 = function() {
	
	var addr = (regPairs[8] + offset) & 0xffff;
var value = (tstates += ( 3), memory.read(addr));
regs[0] = ( regs[0] & 1 ) | 16 | ( ( addr >> 8 ) & 40 );
if ( !(value & 1) ) regs[0] |= 68;

tstates += ( 1);
}; fn69(); }
	break;case 70: { var fn70 = function() {
	
	var addr = (regPairs[8] + offset) & 0xffff;
var value = (tstates += ( 3), memory.read(addr));
regs[0] = ( regs[0] & 1 ) | 16 | ( ( addr >> 8 ) & 40 );
if ( !(value & 1) ) regs[0] |= 68;

tstates += ( 1);
}; fn70(); }
	break;case 71: { var fn71 = function() {
	
	var addr = (regPairs[8] + offset) & 0xffff;
var value = (tstates += ( 3), memory.read(addr));
regs[0] = ( regs[0] & 1 ) | 16 | ( ( addr >> 8 ) & 40 );
if ( !(value & 1) ) regs[0] |= 68;

tstates += ( 1);
}; fn71(); }
	break;case 72: { var fn72 = function() {
	
	var addr = (regPairs[8] + offset) & 0xffff;
var value = (tstates += ( 3), memory.read(addr));
regs[0] = ( regs[0] & 1 ) | 16 | ( ( addr >> 8 ) & 40 );
if ( !(value & 2) ) regs[0] |= 68;

tstates += ( 1);
}; fn72(); }
	break;case 73: { var fn73 = function() {
	
	var addr = (regPairs[8] + offset) & 0xffff;
var value = (tstates += ( 3), memory.read(addr));
regs[0] = ( regs[0] & 1 ) | 16 | ( ( addr >> 8 ) & 40 );
if ( !(value & 2) ) regs[0] |= 68;

tstates += ( 1);
}; fn73(); }
	break;case 74: { var fn74 = function() {
	
	var addr = (regPairs[8] + offset) & 0xffff;
var value = (tstates += ( 3), memory.read(addr));
regs[0] = ( regs[0] & 1 ) | 16 | ( ( addr >> 8 ) & 40 );
if ( !(value & 2) ) regs[0] |= 68;

tstates += ( 1);
}; fn74(); }
	break;case 75: { var fn75 = function() {
	
	var addr = (regPairs[8] + offset) & 0xffff;
var value = (tstates += ( 3), memory.read(addr));
regs[0] = ( regs[0] & 1 ) | 16 | ( ( addr >> 8 ) & 40 );
if ( !(value & 2) ) regs[0] |= 68;

tstates += ( 1);
}; fn75(); }
	break;case 76: { var fn76 = function() {
	
	var addr = (regPairs[8] + offset) & 0xffff;
var value = (tstates += ( 3), memory.read(addr));
regs[0] = ( regs[0] & 1 ) | 16 | ( ( addr >> 8 ) & 40 );
if ( !(value & 2) ) regs[0] |= 68;

tstates += ( 1);
}; fn76(); }
	break;case 77: { var fn77 = function() {
	
	var addr = (regPairs[8] + offset) & 0xffff;
var value = (tstates += ( 3), memory.read(addr));
regs[0] = ( regs[0] & 1 ) | 16 | ( ( addr >> 8 ) & 40 );
if ( !(value & 2) ) regs[0] |= 68;

tstates += ( 1);
}; fn77(); }
	break;case 78: { var fn78 = function() {
	
	var addr = (regPairs[8] + offset) & 0xffff;
var value = (tstates += ( 3), memory.read(addr));
regs[0] = ( regs[0] & 1 ) | 16 | ( ( addr >> 8 ) & 40 );
if ( !(value & 2) ) regs[0] |= 68;

tstates += ( 1);
}; fn78(); }
	break;case 79: { var fn79 = function() {
	
	var addr = (regPairs[8] + offset) & 0xffff;
var value = (tstates += ( 3), memory.read(addr));
regs[0] = ( regs[0] & 1 ) | 16 | ( ( addr >> 8 ) & 40 );
if ( !(value & 2) ) regs[0] |= 68;

tstates += ( 1);
}; fn79(); }
	break;case 80: { var fn80 = function() {
	
	var addr = (regPairs[8] + offset) & 0xffff;
var value = (tstates += ( 3), memory.read(addr));
regs[0] = ( regs[0] & 1 ) | 16 | ( ( addr >> 8 ) & 40 );
if ( !(value & 4) ) regs[0] |= 68;

tstates += ( 1);
}; fn80(); }
	break;case 81: { var fn81 = function() {
	
	var addr = (regPairs[8] + offset) & 0xffff;
var value = (tstates += ( 3), memory.read(addr));
regs[0] = ( regs[0] & 1 ) | 16 | ( ( addr >> 8 ) & 40 );
if ( !(value & 4) ) regs[0] |= 68;

tstates += ( 1);
}; fn81(); }
	break;case 82: { var fn82 = function() {
	
	var addr = (regPairs[8] + offset) & 0xffff;
var value = (tstates += ( 3), memory.read(addr));
regs[0] = ( regs[0] & 1 ) | 16 | ( ( addr >> 8 ) & 40 );
if ( !(value & 4) ) regs[0] |= 68;

tstates += ( 1);
}; fn82(); }
	break;case 83: { var fn83 = function() {
	
	var addr = (regPairs[8] + offset) & 0xffff;
var value = (tstates += ( 3), memory.read(addr));
regs[0] = ( regs[0] & 1 ) | 16 | ( ( addr >> 8 ) & 40 );
if ( !(value & 4) ) regs[0] |= 68;

tstates += ( 1);
}; fn83(); }
	break;case 84: { var fn84 = function() {
	
	var addr = (regPairs[8] + offset) & 0xffff;
var value = (tstates += ( 3), memory.read(addr));
regs[0] = ( regs[0] & 1 ) | 16 | ( ( addr >> 8 ) & 40 );
if ( !(value & 4) ) regs[0] |= 68;

tstates += ( 1);
}; fn84(); }
	break;case 85: { var fn85 = function() {
	
	var addr = (regPairs[8] + offset) & 0xffff;
var value = (tstates += ( 3), memory.read(addr));
regs[0] = ( regs[0] & 1 ) | 16 | ( ( addr >> 8 ) & 40 );
if ( !(value & 4) ) regs[0] |= 68;

tstates += ( 1);
}; fn85(); }
	break;case 86: { var fn86 = function() {
	
	var addr = (regPairs[8] + offset) & 0xffff;
var value = (tstates += ( 3), memory.read(addr));
regs[0] = ( regs[0] & 1 ) | 16 | ( ( addr >> 8 ) & 40 );
if ( !(value & 4) ) regs[0] |= 68;

tstates += ( 1);
}; fn86(); }
	break;case 87: { var fn87 = function() {
	
	var addr = (regPairs[8] + offset) & 0xffff;
var value = (tstates += ( 3), memory.read(addr));
regs[0] = ( regs[0] & 1 ) | 16 | ( ( addr >> 8 ) & 40 );
if ( !(value & 4) ) regs[0] |= 68;

tstates += ( 1);
}; fn87(); }
	break;case 88: { var fn88 = function() {
	
	var addr = (regPairs[8] + offset) & 0xffff;
var value = (tstates += ( 3), memory.read(addr));
regs[0] = ( regs[0] & 1 ) | 16 | ( ( addr >> 8 ) & 40 );
if ( !(value & 8) ) regs[0] |= 68;

tstates += ( 1);
}; fn88(); }
	break;case 89: { var fn89 = function() {
	
	var addr = (regPairs[8] + offset) & 0xffff;
var value = (tstates += ( 3), memory.read(addr));
regs[0] = ( regs[0] & 1 ) | 16 | ( ( addr >> 8 ) & 40 );
if ( !(value & 8) ) regs[0] |= 68;

tstates += ( 1);
}; fn89(); }
	break;case 90: { var fn90 = function() {
	
	var addr = (regPairs[8] + offset) & 0xffff;
var value = (tstates += ( 3), memory.read(addr));
regs[0] = ( regs[0] & 1 ) | 16 | ( ( addr >> 8 ) & 40 );
if ( !(value & 8) ) regs[0] |= 68;

tstates += ( 1);
}; fn90(); }
	break;case 91: { var fn91 = function() {
	
	var addr = (regPairs[8] + offset) & 0xffff;
var value = (tstates += ( 3), memory.read(addr));
regs[0] = ( regs[0] & 1 ) | 16 | ( ( addr >> 8 ) & 40 );
if ( !(value & 8) ) regs[0] |= 68;

tstates += ( 1);
}; fn91(); }
	break;case 92: { var fn92 = function() {
	
	var addr = (regPairs[8] + offset) & 0xffff;
var value = (tstates += ( 3), memory.read(addr));
regs[0] = ( regs[0] & 1 ) | 16 | ( ( addr >> 8 ) & 40 );
if ( !(value & 8) ) regs[0] |= 68;

tstates += ( 1);
}; fn92(); }
	break;case 93: { var fn93 = function() {
	
	var addr = (regPairs[8] + offset) & 0xffff;
var value = (tstates += ( 3), memory.read(addr));
regs[0] = ( regs[0] & 1 ) | 16 | ( ( addr >> 8 ) & 40 );
if ( !(value & 8) ) regs[0] |= 68;

tstates += ( 1);
}; fn93(); }
	break;case 94: { var fn94 = function() {
	
	var addr = (regPairs[8] + offset) & 0xffff;
var value = (tstates += ( 3), memory.read(addr));
regs[0] = ( regs[0] & 1 ) | 16 | ( ( addr >> 8 ) & 40 );
if ( !(value & 8) ) regs[0] |= 68;

tstates += ( 1);
}; fn94(); }
	break;case 95: { var fn95 = function() {
	
	var addr = (regPairs[8] + offset) & 0xffff;
var value = (tstates += ( 3), memory.read(addr));
regs[0] = ( regs[0] & 1 ) | 16 | ( ( addr >> 8 ) & 40 );
if ( !(value & 8) ) regs[0] |= 68;

tstates += ( 1);
}; fn95(); }
	break;case 96: { var fn96 = function() {
	
	var addr = (regPairs[8] + offset) & 0xffff;
var value = (tstates += ( 3), memory.read(addr));
regs[0] = ( regs[0] & 1 ) | 16 | ( ( addr >> 8 ) & 40 );
if ( !(value & 16) ) regs[0] |= 68;

tstates += ( 1);
}; fn96(); }
	break;case 97: { var fn97 = function() {
	
	var addr = (regPairs[8] + offset) & 0xffff;
var value = (tstates += ( 3), memory.read(addr));
regs[0] = ( regs[0] & 1 ) | 16 | ( ( addr >> 8 ) & 40 );
if ( !(value & 16) ) regs[0] |= 68;

tstates += ( 1);
}; fn97(); }
	break;case 98: { var fn98 = function() {
	
	var addr = (regPairs[8] + offset) & 0xffff;
var value = (tstates += ( 3), memory.read(addr));
regs[0] = ( regs[0] & 1 ) | 16 | ( ( addr >> 8 ) & 40 );
if ( !(value & 16) ) regs[0] |= 68;

tstates += ( 1);
}; fn98(); }
	break;case 99: { var fn99 = function() {
	
	var addr = (regPairs[8] + offset) & 0xffff;
var value = (tstates += ( 3), memory.read(addr));
regs[0] = ( regs[0] & 1 ) | 16 | ( ( addr >> 8 ) & 40 );
if ( !(value & 16) ) regs[0] |= 68;

tstates += ( 1);
}; fn99(); }
	break;case 100: { var fn100 = function() {
	
	var addr = (regPairs[8] + offset) & 0xffff;
var value = (tstates += ( 3), memory.read(addr));
regs[0] = ( regs[0] & 1 ) | 16 | ( ( addr >> 8 ) & 40 );
if ( !(value & 16) ) regs[0] |= 68;

tstates += ( 1);
}; fn100(); }
	break;case 101: { var fn101 = function() {
	
	var addr = (regPairs[8] + offset) & 0xffff;
var value = (tstates += ( 3), memory.read(addr));
regs[0] = ( regs[0] & 1 ) | 16 | ( ( addr >> 8 ) & 40 );
if ( !(value & 16) ) regs[0] |= 68;

tstates += ( 1);
}; fn101(); }
	break;case 102: { var fn102 = function() {
	
	var addr = (regPairs[8] + offset) & 0xffff;
var value = (tstates += ( 3), memory.read(addr));
regs[0] = ( regs[0] & 1 ) | 16 | ( ( addr >> 8 ) & 40 );
if ( !(value & 16) ) regs[0] |= 68;

tstates += ( 1);
}; fn102(); }
	break;case 103: { var fn103 = function() {
	
	var addr = (regPairs[8] + offset) & 0xffff;
var value = (tstates += ( 3), memory.read(addr));
regs[0] = ( regs[0] & 1 ) | 16 | ( ( addr >> 8 ) & 40 );
if ( !(value & 16) ) regs[0] |= 68;

tstates += ( 1);
}; fn103(); }
	break;case 104: { var fn104 = function() {
	
	var addr = (regPairs[8] + offset) & 0xffff;
var value = (tstates += ( 3), memory.read(addr));
regs[0] = ( regs[0] & 1 ) | 16 | ( ( addr >> 8 ) & 40 );
if ( !(value & 32) ) regs[0] |= 68;

tstates += ( 1);
}; fn104(); }
	break;case 105: { var fn105 = function() {
	
	var addr = (regPairs[8] + offset) & 0xffff;
var value = (tstates += ( 3), memory.read(addr));
regs[0] = ( regs[0] & 1 ) | 16 | ( ( addr >> 8 ) & 40 );
if ( !(value & 32) ) regs[0] |= 68;

tstates += ( 1);
}; fn105(); }
	break;case 106: { var fn106 = function() {
	
	var addr = (regPairs[8] + offset) & 0xffff;
var value = (tstates += ( 3), memory.read(addr));
regs[0] = ( regs[0] & 1 ) | 16 | ( ( addr >> 8 ) & 40 );
if ( !(value & 32) ) regs[0] |= 68;

tstates += ( 1);
}; fn106(); }
	break;case 107: { var fn107 = function() {
	
	var addr = (regPairs[8] + offset) & 0xffff;
var value = (tstates += ( 3), memory.read(addr));
regs[0] = ( regs[0] & 1 ) | 16 | ( ( addr >> 8 ) & 40 );
if ( !(value & 32) ) regs[0] |= 68;

tstates += ( 1);
}; fn107(); }
	break;case 108: { var fn108 = function() {
	
	var addr = (regPairs[8] + offset) & 0xffff;
var value = (tstates += ( 3), memory.read(addr));
regs[0] = ( regs[0] & 1 ) | 16 | ( ( addr >> 8 ) & 40 );
if ( !(value & 32) ) regs[0] |= 68;

tstates += ( 1);
}; fn108(); }
	break;case 109: { var fn109 = function() {
	
	var addr = (regPairs[8] + offset) & 0xffff;
var value = (tstates += ( 3), memory.read(addr));
regs[0] = ( regs[0] & 1 ) | 16 | ( ( addr >> 8 ) & 40 );
if ( !(value & 32) ) regs[0] |= 68;

tstates += ( 1);
}; fn109(); }
	break;case 110: { var fn110 = function() {
	
	var addr = (regPairs[8] + offset) & 0xffff;
var value = (tstates += ( 3), memory.read(addr));
regs[0] = ( regs[0] & 1 ) | 16 | ( ( addr >> 8 ) & 40 );
if ( !(value & 32) ) regs[0] |= 68;

tstates += ( 1);
}; fn110(); }
	break;case 111: { var fn111 = function() {
	
	var addr = (regPairs[8] + offset) & 0xffff;
var value = (tstates += ( 3), memory.read(addr));
regs[0] = ( regs[0] & 1 ) | 16 | ( ( addr >> 8 ) & 40 );
if ( !(value & 32) ) regs[0] |= 68;

tstates += ( 1);
}; fn111(); }
	break;case 112: { var fn112 = function() {
	
	var addr = (regPairs[8] + offset) & 0xffff;
var value = (tstates += ( 3), memory.read(addr));
regs[0] = ( regs[0] & 1 ) | 16 | ( ( addr >> 8 ) & 40 );
if ( !(value & 64) ) regs[0] |= 68;

tstates += ( 1);
}; fn112(); }
	break;case 113: { var fn113 = function() {
	
	var addr = (regPairs[8] + offset) & 0xffff;
var value = (tstates += ( 3), memory.read(addr));
regs[0] = ( regs[0] & 1 ) | 16 | ( ( addr >> 8 ) & 40 );
if ( !(value & 64) ) regs[0] |= 68;

tstates += ( 1);
}; fn113(); }
	break;case 114: { var fn114 = function() {
	
	var addr = (regPairs[8] + offset) & 0xffff;
var value = (tstates += ( 3), memory.read(addr));
regs[0] = ( regs[0] & 1 ) | 16 | ( ( addr >> 8 ) & 40 );
if ( !(value & 64) ) regs[0] |= 68;

tstates += ( 1);
}; fn114(); }
	break;case 115: { var fn115 = function() {
	
	var addr = (regPairs[8] + offset) & 0xffff;
var value = (tstates += ( 3), memory.read(addr));
regs[0] = ( regs[0] & 1 ) | 16 | ( ( addr >> 8 ) & 40 );
if ( !(value & 64) ) regs[0] |= 68;

tstates += ( 1);
}; fn115(); }
	break;case 116: { var fn116 = function() {
	
	var addr = (regPairs[8] + offset) & 0xffff;
var value = (tstates += ( 3), memory.read(addr));
regs[0] = ( regs[0] & 1 ) | 16 | ( ( addr >> 8 ) & 40 );
if ( !(value & 64) ) regs[0] |= 68;

tstates += ( 1);
}; fn116(); }
	break;case 117: { var fn117 = function() {
	
	var addr = (regPairs[8] + offset) & 0xffff;
var value = (tstates += ( 3), memory.read(addr));
regs[0] = ( regs[0] & 1 ) | 16 | ( ( addr >> 8 ) & 40 );
if ( !(value & 64) ) regs[0] |= 68;

tstates += ( 1);
}; fn117(); }
	break;case 118: { var fn118 = function() {
	
	var addr = (regPairs[8] + offset) & 0xffff;
var value = (tstates += ( 3), memory.read(addr));
regs[0] = ( regs[0] & 1 ) | 16 | ( ( addr >> 8 ) & 40 );
if ( !(value & 64) ) regs[0] |= 68;

tstates += ( 1);
}; fn118(); }
	break;case 119: { var fn119 = function() {
	
	var addr = (regPairs[8] + offset) & 0xffff;
var value = (tstates += ( 3), memory.read(addr));
regs[0] = ( regs[0] & 1 ) | 16 | ( ( addr >> 8 ) & 40 );
if ( !(value & 64) ) regs[0] |= 68;

tstates += ( 1);
}; fn119(); }
	break;case 120: { var fn120 = function() {
	
	var addr = (regPairs[8] + offset) & 0xffff;
var value = (tstates += ( 3), memory.read(addr));
regs[0] = ( regs[0] & 1 ) | 16 | ( ( addr >> 8 ) & 40 );
if ( !(value & 128) ) regs[0] |= 68;
if (value & 0x80) regs[0] |= 128;
tstates += ( 1);
}; fn120(); }
	break;case 121: { var fn121 = function() {
	
	var addr = (regPairs[8] + offset) & 0xffff;
var value = (tstates += ( 3), memory.read(addr));
regs[0] = ( regs[0] & 1 ) | 16 | ( ( addr >> 8 ) & 40 );
if ( !(value & 128) ) regs[0] |= 68;
if (value & 0x80) regs[0] |= 128;
tstates += ( 1);
}; fn121(); }
	break;case 122: { var fn122 = function() {
	
	var addr = (regPairs[8] + offset) & 0xffff;
var value = (tstates += ( 3), memory.read(addr));
regs[0] = ( regs[0] & 1 ) | 16 | ( ( addr >> 8 ) & 40 );
if ( !(value & 128) ) regs[0] |= 68;
if (value & 0x80) regs[0] |= 128;
tstates += ( 1);
}; fn122(); }
	break;case 123: { var fn123 = function() {
	
	var addr = (regPairs[8] + offset) & 0xffff;
var value = (tstates += ( 3), memory.read(addr));
regs[0] = ( regs[0] & 1 ) | 16 | ( ( addr >> 8 ) & 40 );
if ( !(value & 128) ) regs[0] |= 68;
if (value & 0x80) regs[0] |= 128;
tstates += ( 1);
}; fn123(); }
	break;case 124: { var fn124 = function() {
	
	var addr = (regPairs[8] + offset) & 0xffff;
var value = (tstates += ( 3), memory.read(addr));
regs[0] = ( regs[0] & 1 ) | 16 | ( ( addr >> 8 ) & 40 );
if ( !(value & 128) ) regs[0] |= 68;
if (value & 0x80) regs[0] |= 128;
tstates += ( 1);
}; fn124(); }
	break;case 125: { var fn125 = function() {
	
	var addr = (regPairs[8] + offset) & 0xffff;
var value = (tstates += ( 3), memory.read(addr));
regs[0] = ( regs[0] & 1 ) | 16 | ( ( addr >> 8 ) & 40 );
if ( !(value & 128) ) regs[0] |= 68;
if (value & 0x80) regs[0] |= 128;
tstates += ( 1);
}; fn125(); }
	break;case 126: { var fn126 = function() {
	
	var addr = (regPairs[8] + offset) & 0xffff;
var value = (tstates += ( 3), memory.read(addr));
regs[0] = ( regs[0] & 1 ) | 16 | ( ( addr >> 8 ) & 40 );
if ( !(value & 128) ) regs[0] |= 68;
if (value & 0x80) regs[0] |= 128;
tstates += ( 1);
}; fn126(); }
	break;case 127: { var fn127 = function() {
	
	var addr = (regPairs[8] + offset) & 0xffff;
var value = (tstates += ( 3), memory.read(addr));
regs[0] = ( regs[0] & 1 ) | 16 | ( ( addr >> 8 ) & 40 );
if ( !(value & 128) ) regs[0] |= 68;
if (value & 0x80) regs[0] |= 128;
tstates += ( 1);
}; fn127(); }
	break;case 128: { var fn128 = function() {
	
	var addr = (regPairs[8] + offset) & 0xffff;
regs[3] = (tstates += ( 3), memory.read(addr));

regs[3] &= 254;

tstates += ( 1);
tstates += ( 3);
while (display.nextEventTime != null && display.nextEventTime < tstates) display.doEvent();
memory.write(addr, regs[3]);;
}; fn128(); }
	break;case 129: { var fn129 = function() {
	
	var addr = (regPairs[8] + offset) & 0xffff;
regs[2] = (tstates += ( 3), memory.read(addr));

regs[2] &= 254;

tstates += ( 1);
tstates += ( 3);
while (display.nextEventTime != null && display.nextEventTime < tstates) display.doEvent();
memory.write(addr, regs[2]);;
}; fn129(); }
	break;case 130: { var fn130 = function() {
	
	var addr = (regPairs[8] + offset) & 0xffff;
regs[5] = (tstates += ( 3), memory.read(addr));

regs[5] &= 254;

tstates += ( 1);
tstates += ( 3);
while (display.nextEventTime != null && display.nextEventTime < tstates) display.doEvent();
memory.write(addr, regs[5]);;
}; fn130(); }
	break;case 131: { var fn131 = function() {
	
	var addr = (regPairs[8] + offset) & 0xffff;
regs[4] = (tstates += ( 3), memory.read(addr));

regs[4] &= 254;

tstates += ( 1);
tstates += ( 3);
while (display.nextEventTime != null && display.nextEventTime < tstates) display.doEvent();
memory.write(addr, regs[4]);;
}; fn131(); }
	break;case 132: { var fn132 = function() {
	
	var addr = (regPairs[8] + offset) & 0xffff;
regs[7] = (tstates += ( 3), memory.read(addr));

regs[7] &= 254;

tstates += ( 1);
tstates += ( 3);
while (display.nextEventTime != null && display.nextEventTime < tstates) display.doEvent();
memory.write(addr, regs[7]);;
}; fn132(); }
	break;case 133: { var fn133 = function() {
	
	var addr = (regPairs[8] + offset) & 0xffff;
regs[6] = (tstates += ( 3), memory.read(addr));

regs[6] &= 254;

tstates += ( 1);
tstates += ( 3);
while (display.nextEventTime != null && display.nextEventTime < tstates) display.doEvent();
memory.write(addr, regs[6]);;
}; fn133(); }
	break;case 134: { var fn134 = function() {
	
	var addr = (regPairs[8] + offset) & 0xffff;
var val = (tstates += ( 3), memory.read(addr));
val &= 254;
tstates += ( 1);
tstates += ( 3);
while (display.nextEventTime != null && display.nextEventTime < tstates) display.doEvent();
memory.write(addr, val);;
}; fn134(); }
	break;case 135: { var fn135 = function() {
	
	var addr = (regPairs[8] + offset) & 0xffff;
regs[1] = (tstates += ( 3), memory.read(addr));

regs[1] &= 254;

tstates += ( 1);
tstates += ( 3);
while (display.nextEventTime != null && display.nextEventTime < tstates) display.doEvent();
memory.write(addr, regs[1]);;
}; fn135(); }
	break;case 136: { var fn136 = function() {
	
	var addr = (regPairs[8] + offset) & 0xffff;
regs[3] = (tstates += ( 3), memory.read(addr));

regs[3] &= 253;

tstates += ( 1);
tstates += ( 3);
while (display.nextEventTime != null && display.nextEventTime < tstates) display.doEvent();
memory.write(addr, regs[3]);;
}; fn136(); }
	break;case 137: { var fn137 = function() {
	
	var addr = (regPairs[8] + offset) & 0xffff;
regs[2] = (tstates += ( 3), memory.read(addr));

regs[2] &= 253;

tstates += ( 1);
tstates += ( 3);
while (display.nextEventTime != null && display.nextEventTime < tstates) display.doEvent();
memory.write(addr, regs[2]);;
}; fn137(); }
	break;case 138: { var fn138 = function() {
	
	var addr = (regPairs[8] + offset) & 0xffff;
regs[5] = (tstates += ( 3), memory.read(addr));

regs[5] &= 253;

tstates += ( 1);
tstates += ( 3);
while (display.nextEventTime != null && display.nextEventTime < tstates) display.doEvent();
memory.write(addr, regs[5]);;
}; fn138(); }
	break;case 139: { var fn139 = function() {
	
	var addr = (regPairs[8] + offset) & 0xffff;
regs[4] = (tstates += ( 3), memory.read(addr));

regs[4] &= 253;

tstates += ( 1);
tstates += ( 3);
while (display.nextEventTime != null && display.nextEventTime < tstates) display.doEvent();
memory.write(addr, regs[4]);;
}; fn139(); }
	break;case 140: { var fn140 = function() {
	
	var addr = (regPairs[8] + offset) & 0xffff;
regs[7] = (tstates += ( 3), memory.read(addr));

regs[7] &= 253;

tstates += ( 1);
tstates += ( 3);
while (display.nextEventTime != null && display.nextEventTime < tstates) display.doEvent();
memory.write(addr, regs[7]);;
}; fn140(); }
	break;case 141: { var fn141 = function() {
	
	var addr = (regPairs[8] + offset) & 0xffff;
regs[6] = (tstates += ( 3), memory.read(addr));

regs[6] &= 253;

tstates += ( 1);
tstates += ( 3);
while (display.nextEventTime != null && display.nextEventTime < tstates) display.doEvent();
memory.write(addr, regs[6]);;
}; fn141(); }
	break;case 142: { var fn142 = function() {
	
	var addr = (regPairs[8] + offset) & 0xffff;
var val = (tstates += ( 3), memory.read(addr));
val &= 253;
tstates += ( 1);
tstates += ( 3);
while (display.nextEventTime != null && display.nextEventTime < tstates) display.doEvent();
memory.write(addr, val);;
}; fn142(); }
	break;case 143: { var fn143 = function() {
	
	var addr = (regPairs[8] + offset) & 0xffff;
regs[1] = (tstates += ( 3), memory.read(addr));

regs[1] &= 253;

tstates += ( 1);
tstates += ( 3);
while (display.nextEventTime != null && display.nextEventTime < tstates) display.doEvent();
memory.write(addr, regs[1]);;
}; fn143(); }
	break;case 144: { var fn144 = function() {
	
	var addr = (regPairs[8] + offset) & 0xffff;
regs[3] = (tstates += ( 3), memory.read(addr));

regs[3] &= 251;

tstates += ( 1);
tstates += ( 3);
while (display.nextEventTime != null && display.nextEventTime < tstates) display.doEvent();
memory.write(addr, regs[3]);;
}; fn144(); }
	break;case 145: { var fn145 = function() {
	
	var addr = (regPairs[8] + offset) & 0xffff;
regs[2] = (tstates += ( 3), memory.read(addr));

regs[2] &= 251;

tstates += ( 1);
tstates += ( 3);
while (display.nextEventTime != null && display.nextEventTime < tstates) display.doEvent();
memory.write(addr, regs[2]);;
}; fn145(); }
	break;case 146: { var fn146 = function() {
	
	var addr = (regPairs[8] + offset) & 0xffff;
regs[5] = (tstates += ( 3), memory.read(addr));

regs[5] &= 251;

tstates += ( 1);
tstates += ( 3);
while (display.nextEventTime != null && display.nextEventTime < tstates) display.doEvent();
memory.write(addr, regs[5]);;
}; fn146(); }
	break;case 147: { var fn147 = function() {
	
	var addr = (regPairs[8] + offset) & 0xffff;
regs[4] = (tstates += ( 3), memory.read(addr));

regs[4] &= 251;

tstates += ( 1);
tstates += ( 3);
while (display.nextEventTime != null && display.nextEventTime < tstates) display.doEvent();
memory.write(addr, regs[4]);;
}; fn147(); }
	break;case 148: { var fn148 = function() {
	
	var addr = (regPairs[8] + offset) & 0xffff;
regs[7] = (tstates += ( 3), memory.read(addr));

regs[7] &= 251;

tstates += ( 1);
tstates += ( 3);
while (display.nextEventTime != null && display.nextEventTime < tstates) display.doEvent();
memory.write(addr, regs[7]);;
}; fn148(); }
	break;case 149: { var fn149 = function() {
	
	var addr = (regPairs[8] + offset) & 0xffff;
regs[6] = (tstates += ( 3), memory.read(addr));

regs[6] &= 251;

tstates += ( 1);
tstates += ( 3);
while (display.nextEventTime != null && display.nextEventTime < tstates) display.doEvent();
memory.write(addr, regs[6]);;
}; fn149(); }
	break;case 150: { var fn150 = function() {
	
	var addr = (regPairs[8] + offset) & 0xffff;
var val = (tstates += ( 3), memory.read(addr));
val &= 251;
tstates += ( 1);
tstates += ( 3);
while (display.nextEventTime != null && display.nextEventTime < tstates) display.doEvent();
memory.write(addr, val);;
}; fn150(); }
	break;case 151: { var fn151 = function() {
	
	var addr = (regPairs[8] + offset) & 0xffff;
regs[1] = (tstates += ( 3), memory.read(addr));

regs[1] &= 251;

tstates += ( 1);
tstates += ( 3);
while (display.nextEventTime != null && display.nextEventTime < tstates) display.doEvent();
memory.write(addr, regs[1]);;
}; fn151(); }
	break;case 152: { var fn152 = function() {
	
	var addr = (regPairs[8] + offset) & 0xffff;
regs[3] = (tstates += ( 3), memory.read(addr));

regs[3] &= 247;

tstates += ( 1);
tstates += ( 3);
while (display.nextEventTime != null && display.nextEventTime < tstates) display.doEvent();
memory.write(addr, regs[3]);;
}; fn152(); }
	break;case 153: { var fn153 = function() {
	
	var addr = (regPairs[8] + offset) & 0xffff;
regs[2] = (tstates += ( 3), memory.read(addr));

regs[2] &= 247;

tstates += ( 1);
tstates += ( 3);
while (display.nextEventTime != null && display.nextEventTime < tstates) display.doEvent();
memory.write(addr, regs[2]);;
}; fn153(); }
	break;case 154: { var fn154 = function() {
	
	var addr = (regPairs[8] + offset) & 0xffff;
regs[5] = (tstates += ( 3), memory.read(addr));

regs[5] &= 247;

tstates += ( 1);
tstates += ( 3);
while (display.nextEventTime != null && display.nextEventTime < tstates) display.doEvent();
memory.write(addr, regs[5]);;
}; fn154(); }
	break;case 155: { var fn155 = function() {
	
	var addr = (regPairs[8] + offset) & 0xffff;
regs[4] = (tstates += ( 3), memory.read(addr));

regs[4] &= 247;

tstates += ( 1);
tstates += ( 3);
while (display.nextEventTime != null && display.nextEventTime < tstates) display.doEvent();
memory.write(addr, regs[4]);;
}; fn155(); }
	break;case 156: { var fn156 = function() {
	
	var addr = (regPairs[8] + offset) & 0xffff;
regs[7] = (tstates += ( 3), memory.read(addr));

regs[7] &= 247;

tstates += ( 1);
tstates += ( 3);
while (display.nextEventTime != null && display.nextEventTime < tstates) display.doEvent();
memory.write(addr, regs[7]);;
}; fn156(); }
	break;case 157: { var fn157 = function() {
	
	var addr = (regPairs[8] + offset) & 0xffff;
regs[6] = (tstates += ( 3), memory.read(addr));

regs[6] &= 247;

tstates += ( 1);
tstates += ( 3);
while (display.nextEventTime != null && display.nextEventTime < tstates) display.doEvent();
memory.write(addr, regs[6]);;
}; fn157(); }
	break;case 158: { var fn158 = function() {
	
	var addr = (regPairs[8] + offset) & 0xffff;
var val = (tstates += ( 3), memory.read(addr));
val &= 247;
tstates += ( 1);
tstates += ( 3);
while (display.nextEventTime != null && display.nextEventTime < tstates) display.doEvent();
memory.write(addr, val);;
}; fn158(); }
	break;case 159: { var fn159 = function() {
	
	var addr = (regPairs[8] + offset) & 0xffff;
regs[1] = (tstates += ( 3), memory.read(addr));

regs[1] &= 247;

tstates += ( 1);
tstates += ( 3);
while (display.nextEventTime != null && display.nextEventTime < tstates) display.doEvent();
memory.write(addr, regs[1]);;
}; fn159(); }
	break;case 160: { var fn160 = function() {
	
	var addr = (regPairs[8] + offset) & 0xffff;
regs[3] = (tstates += ( 3), memory.read(addr));

regs[3] &= 239;

tstates += ( 1);
tstates += ( 3);
while (display.nextEventTime != null && display.nextEventTime < tstates) display.doEvent();
memory.write(addr, regs[3]);;
}; fn160(); }
	break;case 161: { var fn161 = function() {
	
	var addr = (regPairs[8] + offset) & 0xffff;
regs[2] = (tstates += ( 3), memory.read(addr));

regs[2] &= 239;

tstates += ( 1);
tstates += ( 3);
while (display.nextEventTime != null && display.nextEventTime < tstates) display.doEvent();
memory.write(addr, regs[2]);;
}; fn161(); }
	break;case 162: { var fn162 = function() {
	
	var addr = (regPairs[8] + offset) & 0xffff;
regs[5] = (tstates += ( 3), memory.read(addr));

regs[5] &= 239;

tstates += ( 1);
tstates += ( 3);
while (display.nextEventTime != null && display.nextEventTime < tstates) display.doEvent();
memory.write(addr, regs[5]);;
}; fn162(); }
	break;case 163: { var fn163 = function() {
	
	var addr = (regPairs[8] + offset) & 0xffff;
regs[4] = (tstates += ( 3), memory.read(addr));

regs[4] &= 239;

tstates += ( 1);
tstates += ( 3);
while (display.nextEventTime != null && display.nextEventTime < tstates) display.doEvent();
memory.write(addr, regs[4]);;
}; fn163(); }
	break;case 164: { var fn164 = function() {
	
	var addr = (regPairs[8] + offset) & 0xffff;
regs[7] = (tstates += ( 3), memory.read(addr));

regs[7] &= 239;

tstates += ( 1);
tstates += ( 3);
while (display.nextEventTime != null && display.nextEventTime < tstates) display.doEvent();
memory.write(addr, regs[7]);;
}; fn164(); }
	break;case 165: { var fn165 = function() {
	
	var addr = (regPairs[8] + offset) & 0xffff;
regs[6] = (tstates += ( 3), memory.read(addr));

regs[6] &= 239;

tstates += ( 1);
tstates += ( 3);
while (display.nextEventTime != null && display.nextEventTime < tstates) display.doEvent();
memory.write(addr, regs[6]);;
}; fn165(); }
	break;case 166: { var fn166 = function() {
	
	var addr = (regPairs[8] + offset) & 0xffff;
var val = (tstates += ( 3), memory.read(addr));
val &= 239;
tstates += ( 1);
tstates += ( 3);
while (display.nextEventTime != null && display.nextEventTime < tstates) display.doEvent();
memory.write(addr, val);;
}; fn166(); }
	break;case 167: { var fn167 = function() {
	
	var addr = (regPairs[8] + offset) & 0xffff;
regs[1] = (tstates += ( 3), memory.read(addr));

regs[1] &= 239;

tstates += ( 1);
tstates += ( 3);
while (display.nextEventTime != null && display.nextEventTime < tstates) display.doEvent();
memory.write(addr, regs[1]);;
}; fn167(); }
	break;case 168: { var fn168 = function() {
	
	var addr = (regPairs[8] + offset) & 0xffff;
regs[3] = (tstates += ( 3), memory.read(addr));

regs[3] &= 223;

tstates += ( 1);
tstates += ( 3);
while (display.nextEventTime != null && display.nextEventTime < tstates) display.doEvent();
memory.write(addr, regs[3]);;
}; fn168(); }
	break;case 169: { var fn169 = function() {
	
	var addr = (regPairs[8] + offset) & 0xffff;
regs[2] = (tstates += ( 3), memory.read(addr));

regs[2] &= 223;

tstates += ( 1);
tstates += ( 3);
while (display.nextEventTime != null && display.nextEventTime < tstates) display.doEvent();
memory.write(addr, regs[2]);;
}; fn169(); }
	break;case 170: { var fn170 = function() {
	
	var addr = (regPairs[8] + offset) & 0xffff;
regs[5] = (tstates += ( 3), memory.read(addr));

regs[5] &= 223;

tstates += ( 1);
tstates += ( 3);
while (display.nextEventTime != null && display.nextEventTime < tstates) display.doEvent();
memory.write(addr, regs[5]);;
}; fn170(); }
	break;case 171: { var fn171 = function() {
	
	var addr = (regPairs[8] + offset) & 0xffff;
regs[4] = (tstates += ( 3), memory.read(addr));

regs[4] &= 223;

tstates += ( 1);
tstates += ( 3);
while (display.nextEventTime != null && display.nextEventTime < tstates) display.doEvent();
memory.write(addr, regs[4]);;
}; fn171(); }
	break;case 172: { var fn172 = function() {
	
	var addr = (regPairs[8] + offset) & 0xffff;
regs[7] = (tstates += ( 3), memory.read(addr));

regs[7] &= 223;

tstates += ( 1);
tstates += ( 3);
while (display.nextEventTime != null && display.nextEventTime < tstates) display.doEvent();
memory.write(addr, regs[7]);;
}; fn172(); }
	break;case 173: { var fn173 = function() {
	
	var addr = (regPairs[8] + offset) & 0xffff;
regs[6] = (tstates += ( 3), memory.read(addr));

regs[6] &= 223;

tstates += ( 1);
tstates += ( 3);
while (display.nextEventTime != null && display.nextEventTime < tstates) display.doEvent();
memory.write(addr, regs[6]);;
}; fn173(); }
	break;case 174: { var fn174 = function() {
	
	var addr = (regPairs[8] + offset) & 0xffff;
var val = (tstates += ( 3), memory.read(addr));
val &= 223;
tstates += ( 1);
tstates += ( 3);
while (display.nextEventTime != null && display.nextEventTime < tstates) display.doEvent();
memory.write(addr, val);;
}; fn174(); }
	break;case 175: { var fn175 = function() {
	
	var addr = (regPairs[8] + offset) & 0xffff;
regs[1] = (tstates += ( 3), memory.read(addr));

regs[1] &= 223;

tstates += ( 1);
tstates += ( 3);
while (display.nextEventTime != null && display.nextEventTime < tstates) display.doEvent();
memory.write(addr, regs[1]);;
}; fn175(); }
	break;case 176: { var fn176 = function() {
	
	var addr = (regPairs[8] + offset) & 0xffff;
regs[3] = (tstates += ( 3), memory.read(addr));

regs[3] &= 191;

tstates += ( 1);
tstates += ( 3);
while (display.nextEventTime != null && display.nextEventTime < tstates) display.doEvent();
memory.write(addr, regs[3]);;
}; fn176(); }
	break;case 177: { var fn177 = function() {
	
	var addr = (regPairs[8] + offset) & 0xffff;
regs[2] = (tstates += ( 3), memory.read(addr));

regs[2] &= 191;

tstates += ( 1);
tstates += ( 3);
while (display.nextEventTime != null && display.nextEventTime < tstates) display.doEvent();
memory.write(addr, regs[2]);;
}; fn177(); }
	break;case 178: { var fn178 = function() {
	
	var addr = (regPairs[8] + offset) & 0xffff;
regs[5] = (tstates += ( 3), memory.read(addr));

regs[5] &= 191;

tstates += ( 1);
tstates += ( 3);
while (display.nextEventTime != null && display.nextEventTime < tstates) display.doEvent();
memory.write(addr, regs[5]);;
}; fn178(); }
	break;case 179: { var fn179 = function() {
	
	var addr = (regPairs[8] + offset) & 0xffff;
regs[4] = (tstates += ( 3), memory.read(addr));

regs[4] &= 191;

tstates += ( 1);
tstates += ( 3);
while (display.nextEventTime != null && display.nextEventTime < tstates) display.doEvent();
memory.write(addr, regs[4]);;
}; fn179(); }
	break;case 180: { var fn180 = function() {
	
	var addr = (regPairs[8] + offset) & 0xffff;
regs[7] = (tstates += ( 3), memory.read(addr));

regs[7] &= 191;

tstates += ( 1);
tstates += ( 3);
while (display.nextEventTime != null && display.nextEventTime < tstates) display.doEvent();
memory.write(addr, regs[7]);;
}; fn180(); }
	break;case 181: { var fn181 = function() {
	
	var addr = (regPairs[8] + offset) & 0xffff;
regs[6] = (tstates += ( 3), memory.read(addr));

regs[6] &= 191;

tstates += ( 1);
tstates += ( 3);
while (display.nextEventTime != null && display.nextEventTime < tstates) display.doEvent();
memory.write(addr, regs[6]);;
}; fn181(); }
	break;case 182: { var fn182 = function() {
	
	var addr = (regPairs[8] + offset) & 0xffff;
var val = (tstates += ( 3), memory.read(addr));
val &= 191;
tstates += ( 1);
tstates += ( 3);
while (display.nextEventTime != null && display.nextEventTime < tstates) display.doEvent();
memory.write(addr, val);;
}; fn182(); }
	break;case 183: { var fn183 = function() {
	
	var addr = (regPairs[8] + offset) & 0xffff;
regs[1] = (tstates += ( 3), memory.read(addr));

regs[1] &= 191;

tstates += ( 1);
tstates += ( 3);
while (display.nextEventTime != null && display.nextEventTime < tstates) display.doEvent();
memory.write(addr, regs[1]);;
}; fn183(); }
	break;case 184: { var fn184 = function() {
	
	var addr = (regPairs[8] + offset) & 0xffff;
regs[3] = (tstates += ( 3), memory.read(addr));

regs[3] &= 127;

tstates += ( 1);
tstates += ( 3);
while (display.nextEventTime != null && display.nextEventTime < tstates) display.doEvent();
memory.write(addr, regs[3]);;
}; fn184(); }
	break;case 185: { var fn185 = function() {
	
	var addr = (regPairs[8] + offset) & 0xffff;
regs[2] = (tstates += ( 3), memory.read(addr));

regs[2] &= 127;

tstates += ( 1);
tstates += ( 3);
while (display.nextEventTime != null && display.nextEventTime < tstates) display.doEvent();
memory.write(addr, regs[2]);;
}; fn185(); }
	break;case 186: { var fn186 = function() {
	
	var addr = (regPairs[8] + offset) & 0xffff;
regs[5] = (tstates += ( 3), memory.read(addr));

regs[5] &= 127;

tstates += ( 1);
tstates += ( 3);
while (display.nextEventTime != null && display.nextEventTime < tstates) display.doEvent();
memory.write(addr, regs[5]);;
}; fn186(); }
	break;case 187: { var fn187 = function() {
	
	var addr = (regPairs[8] + offset) & 0xffff;
regs[4] = (tstates += ( 3), memory.read(addr));

regs[4] &= 127;

tstates += ( 1);
tstates += ( 3);
while (display.nextEventTime != null && display.nextEventTime < tstates) display.doEvent();
memory.write(addr, regs[4]);;
}; fn187(); }
	break;case 188: { var fn188 = function() {
	
	var addr = (regPairs[8] + offset) & 0xffff;
regs[7] = (tstates += ( 3), memory.read(addr));

regs[7] &= 127;

tstates += ( 1);
tstates += ( 3);
while (display.nextEventTime != null && display.nextEventTime < tstates) display.doEvent();
memory.write(addr, regs[7]);;
}; fn188(); }
	break;case 189: { var fn189 = function() {
	
	var addr = (regPairs[8] + offset) & 0xffff;
regs[6] = (tstates += ( 3), memory.read(addr));

regs[6] &= 127;

tstates += ( 1);
tstates += ( 3);
while (display.nextEventTime != null && display.nextEventTime < tstates) display.doEvent();
memory.write(addr, regs[6]);;
}; fn189(); }
	break;case 190: { var fn190 = function() {
	
	var addr = (regPairs[8] + offset) & 0xffff;
var val = (tstates += ( 3), memory.read(addr));
val &= 127;
tstates += ( 1);
tstates += ( 3);
while (display.nextEventTime != null && display.nextEventTime < tstates) display.doEvent();
memory.write(addr, val);;
}; fn190(); }
	break;case 191: { var fn191 = function() {
	
	var addr = (regPairs[8] + offset) & 0xffff;
regs[1] = (tstates += ( 3), memory.read(addr));

regs[1] &= 127;

tstates += ( 1);
tstates += ( 3);
while (display.nextEventTime != null && display.nextEventTime < tstates) display.doEvent();
memory.write(addr, regs[1]);;
}; fn191(); }
	break;case 192: { var fn192 = function() {
	
	var addr = (regPairs[8] + offset) & 0xffff;
regs[3] = (tstates += ( 3), memory.read(addr));

regs[3] |= 1;

tstates += ( 1);
tstates += ( 3);
while (display.nextEventTime != null && display.nextEventTime < tstates) display.doEvent();
memory.write(addr, regs[3]);;
}; fn192(); }
	break;case 193: { var fn193 = function() {
	
	var addr = (regPairs[8] + offset) & 0xffff;
regs[2] = (tstates += ( 3), memory.read(addr));

regs[2] |= 1;

tstates += ( 1);
tstates += ( 3);
while (display.nextEventTime != null && display.nextEventTime < tstates) display.doEvent();
memory.write(addr, regs[2]);;
}; fn193(); }
	break;case 194: { var fn194 = function() {
	
	var addr = (regPairs[8] + offset) & 0xffff;
regs[5] = (tstates += ( 3), memory.read(addr));

regs[5] |= 1;

tstates += ( 1);
tstates += ( 3);
while (display.nextEventTime != null && display.nextEventTime < tstates) display.doEvent();
memory.write(addr, regs[5]);;
}; fn194(); }
	break;case 195: { var fn195 = function() {
	
	var addr = (regPairs[8] + offset) & 0xffff;
regs[4] = (tstates += ( 3), memory.read(addr));

regs[4] |= 1;

tstates += ( 1);
tstates += ( 3);
while (display.nextEventTime != null && display.nextEventTime < tstates) display.doEvent();
memory.write(addr, regs[4]);;
}; fn195(); }
	break;case 196: { var fn196 = function() {
	
	var addr = (regPairs[8] + offset) & 0xffff;
regs[7] = (tstates += ( 3), memory.read(addr));

regs[7] |= 1;

tstates += ( 1);
tstates += ( 3);
while (display.nextEventTime != null && display.nextEventTime < tstates) display.doEvent();
memory.write(addr, regs[7]);;
}; fn196(); }
	break;case 197: { var fn197 = function() {
	
	var addr = (regPairs[8] + offset) & 0xffff;
regs[6] = (tstates += ( 3), memory.read(addr));

regs[6] |= 1;

tstates += ( 1);
tstates += ( 3);
while (display.nextEventTime != null && display.nextEventTime < tstates) display.doEvent();
memory.write(addr, regs[6]);;
}; fn197(); }
	break;case 198: { var fn198 = function() {
	
	var addr = (regPairs[8] + offset) & 0xffff;
var val = (tstates += ( 3), memory.read(addr));
val |= 1;
tstates += ( 1);
tstates += ( 3);
while (display.nextEventTime != null && display.nextEventTime < tstates) display.doEvent();
memory.write(addr, val);;
}; fn198(); }
	break;case 199: { var fn199 = function() {
	
	var addr = (regPairs[8] + offset) & 0xffff;
regs[1] = (tstates += ( 3), memory.read(addr));

regs[1] |= 1;

tstates += ( 1);
tstates += ( 3);
while (display.nextEventTime != null && display.nextEventTime < tstates) display.doEvent();
memory.write(addr, regs[1]);;
}; fn199(); }
	break;case 200: { var fn200 = function() {
	
	var addr = (regPairs[8] + offset) & 0xffff;
regs[3] = (tstates += ( 3), memory.read(addr));

regs[3] |= 2;

tstates += ( 1);
tstates += ( 3);
while (display.nextEventTime != null && display.nextEventTime < tstates) display.doEvent();
memory.write(addr, regs[3]);;
}; fn200(); }
	break;case 201: { var fn201 = function() {
	
	var addr = (regPairs[8] + offset) & 0xffff;
regs[2] = (tstates += ( 3), memory.read(addr));

regs[2] |= 2;

tstates += ( 1);
tstates += ( 3);
while (display.nextEventTime != null && display.nextEventTime < tstates) display.doEvent();
memory.write(addr, regs[2]);;
}; fn201(); }
	break;case 202: { var fn202 = function() {
	
	var addr = (regPairs[8] + offset) & 0xffff;
regs[5] = (tstates += ( 3), memory.read(addr));

regs[5] |= 2;

tstates += ( 1);
tstates += ( 3);
while (display.nextEventTime != null && display.nextEventTime < tstates) display.doEvent();
memory.write(addr, regs[5]);;
}; fn202(); }
	break;case 203: { var fn203 = function() {
	
	var addr = (regPairs[8] + offset) & 0xffff;
regs[4] = (tstates += ( 3), memory.read(addr));

regs[4] |= 2;

tstates += ( 1);
tstates += ( 3);
while (display.nextEventTime != null && display.nextEventTime < tstates) display.doEvent();
memory.write(addr, regs[4]);;
}; fn203(); }
	break;case 204: { var fn204 = function() {
	
	var addr = (regPairs[8] + offset) & 0xffff;
regs[7] = (tstates += ( 3), memory.read(addr));

regs[7] |= 2;

tstates += ( 1);
tstates += ( 3);
while (display.nextEventTime != null && display.nextEventTime < tstates) display.doEvent();
memory.write(addr, regs[7]);;
}; fn204(); }
	break;case 205: { var fn205 = function() {
	
	var addr = (regPairs[8] + offset) & 0xffff;
regs[6] = (tstates += ( 3), memory.read(addr));

regs[6] |= 2;

tstates += ( 1);
tstates += ( 3);
while (display.nextEventTime != null && display.nextEventTime < tstates) display.doEvent();
memory.write(addr, regs[6]);;
}; fn205(); }
	break;case 206: { var fn206 = function() {
	
	var addr = (regPairs[8] + offset) & 0xffff;
var val = (tstates += ( 3), memory.read(addr));
val |= 2;
tstates += ( 1);
tstates += ( 3);
while (display.nextEventTime != null && display.nextEventTime < tstates) display.doEvent();
memory.write(addr, val);;
}; fn206(); }
	break;case 207: { var fn207 = function() {
	
	var addr = (regPairs[8] + offset) & 0xffff;
regs[1] = (tstates += ( 3), memory.read(addr));

regs[1] |= 2;

tstates += ( 1);
tstates += ( 3);
while (display.nextEventTime != null && display.nextEventTime < tstates) display.doEvent();
memory.write(addr, regs[1]);;
}; fn207(); }
	break;case 208: { var fn208 = function() {
	
	var addr = (regPairs[8] + offset) & 0xffff;
regs[3] = (tstates += ( 3), memory.read(addr));

regs[3] |= 4;

tstates += ( 1);
tstates += ( 3);
while (display.nextEventTime != null && display.nextEventTime < tstates) display.doEvent();
memory.write(addr, regs[3]);;
}; fn208(); }
	break;case 209: { var fn209 = function() {
	
	var addr = (regPairs[8] + offset) & 0xffff;
regs[2] = (tstates += ( 3), memory.read(addr));

regs[2] |= 4;

tstates += ( 1);
tstates += ( 3);
while (display.nextEventTime != null && display.nextEventTime < tstates) display.doEvent();
memory.write(addr, regs[2]);;
}; fn209(); }
	break;case 210: { var fn210 = function() {
	
	var addr = (regPairs[8] + offset) & 0xffff;
regs[5] = (tstates += ( 3), memory.read(addr));

regs[5] |= 4;

tstates += ( 1);
tstates += ( 3);
while (display.nextEventTime != null && display.nextEventTime < tstates) display.doEvent();
memory.write(addr, regs[5]);;
}; fn210(); }
	break;case 211: { var fn211 = function() {
	
	var addr = (regPairs[8] + offset) & 0xffff;
regs[4] = (tstates += ( 3), memory.read(addr));

regs[4] |= 4;

tstates += ( 1);
tstates += ( 3);
while (display.nextEventTime != null && display.nextEventTime < tstates) display.doEvent();
memory.write(addr, regs[4]);;
}; fn211(); }
	break;case 212: { var fn212 = function() {
	
	var addr = (regPairs[8] + offset) & 0xffff;
regs[7] = (tstates += ( 3), memory.read(addr));

regs[7] |= 4;

tstates += ( 1);
tstates += ( 3);
while (display.nextEventTime != null && display.nextEventTime < tstates) display.doEvent();
memory.write(addr, regs[7]);;
}; fn212(); }
	break;case 213: { var fn213 = function() {
	
	var addr = (regPairs[8] + offset) & 0xffff;
regs[6] = (tstates += ( 3), memory.read(addr));

regs[6] |= 4;

tstates += ( 1);
tstates += ( 3);
while (display.nextEventTime != null && display.nextEventTime < tstates) display.doEvent();
memory.write(addr, regs[6]);;
}; fn213(); }
	break;case 214: { var fn214 = function() {
	
	var addr = (regPairs[8] + offset) & 0xffff;
var val = (tstates += ( 3), memory.read(addr));
val |= 4;
tstates += ( 1);
tstates += ( 3);
while (display.nextEventTime != null && display.nextEventTime < tstates) display.doEvent();
memory.write(addr, val);;
}; fn214(); }
	break;case 215: { var fn215 = function() {
	
	var addr = (regPairs[8] + offset) & 0xffff;
regs[1] = (tstates += ( 3), memory.read(addr));

regs[1] |= 4;

tstates += ( 1);
tstates += ( 3);
while (display.nextEventTime != null && display.nextEventTime < tstates) display.doEvent();
memory.write(addr, regs[1]);;
}; fn215(); }
	break;case 216: { var fn216 = function() {
	
	var addr = (regPairs[8] + offset) & 0xffff;
regs[3] = (tstates += ( 3), memory.read(addr));

regs[3] |= 8;

tstates += ( 1);
tstates += ( 3);
while (display.nextEventTime != null && display.nextEventTime < tstates) display.doEvent();
memory.write(addr, regs[3]);;
}; fn216(); }
	break;case 217: { var fn217 = function() {
	
	var addr = (regPairs[8] + offset) & 0xffff;
regs[2] = (tstates += ( 3), memory.read(addr));

regs[2] |= 8;

tstates += ( 1);
tstates += ( 3);
while (display.nextEventTime != null && display.nextEventTime < tstates) display.doEvent();
memory.write(addr, regs[2]);;
}; fn217(); }
	break;case 218: { var fn218 = function() {
	
	var addr = (regPairs[8] + offset) & 0xffff;
regs[5] = (tstates += ( 3), memory.read(addr));

regs[5] |= 8;

tstates += ( 1);
tstates += ( 3);
while (display.nextEventTime != null && display.nextEventTime < tstates) display.doEvent();
memory.write(addr, regs[5]);;
}; fn218(); }
	break;case 219: { var fn219 = function() {
	
	var addr = (regPairs[8] + offset) & 0xffff;
regs[4] = (tstates += ( 3), memory.read(addr));

regs[4] |= 8;

tstates += ( 1);
tstates += ( 3);
while (display.nextEventTime != null && display.nextEventTime < tstates) display.doEvent();
memory.write(addr, regs[4]);;
}; fn219(); }
	break;case 220: { var fn220 = function() {
	
	var addr = (regPairs[8] + offset) & 0xffff;
regs[7] = (tstates += ( 3), memory.read(addr));

regs[7] |= 8;

tstates += ( 1);
tstates += ( 3);
while (display.nextEventTime != null && display.nextEventTime < tstates) display.doEvent();
memory.write(addr, regs[7]);;
}; fn220(); }
	break;case 221: { var fn221 = function() {
	
	var addr = (regPairs[8] + offset) & 0xffff;
regs[6] = (tstates += ( 3), memory.read(addr));

regs[6] |= 8;

tstates += ( 1);
tstates += ( 3);
while (display.nextEventTime != null && display.nextEventTime < tstates) display.doEvent();
memory.write(addr, regs[6]);;
}; fn221(); }
	break;case 222: { var fn222 = function() {
	
	var addr = (regPairs[8] + offset) & 0xffff;
var val = (tstates += ( 3), memory.read(addr));
val |= 8;
tstates += ( 1);
tstates += ( 3);
while (display.nextEventTime != null && display.nextEventTime < tstates) display.doEvent();
memory.write(addr, val);;
}; fn222(); }
	break;case 223: { var fn223 = function() {
	
	var addr = (regPairs[8] + offset) & 0xffff;
regs[1] = (tstates += ( 3), memory.read(addr));

regs[1] |= 8;

tstates += ( 1);
tstates += ( 3);
while (display.nextEventTime != null && display.nextEventTime < tstates) display.doEvent();
memory.write(addr, regs[1]);;
}; fn223(); }
	break;case 224: { var fn224 = function() {
	
	var addr = (regPairs[8] + offset) & 0xffff;
regs[3] = (tstates += ( 3), memory.read(addr));

regs[3] |= 16;

tstates += ( 1);
tstates += ( 3);
while (display.nextEventTime != null && display.nextEventTime < tstates) display.doEvent();
memory.write(addr, regs[3]);;
}; fn224(); }
	break;case 225: { var fn225 = function() {
	
	var addr = (regPairs[8] + offset) & 0xffff;
regs[2] = (tstates += ( 3), memory.read(addr));

regs[2] |= 16;

tstates += ( 1);
tstates += ( 3);
while (display.nextEventTime != null && display.nextEventTime < tstates) display.doEvent();
memory.write(addr, regs[2]);;
}; fn225(); }
	break;case 226: { var fn226 = function() {
	
	var addr = (regPairs[8] + offset) & 0xffff;
regs[5] = (tstates += ( 3), memory.read(addr));

regs[5] |= 16;

tstates += ( 1);
tstates += ( 3);
while (display.nextEventTime != null && display.nextEventTime < tstates) display.doEvent();
memory.write(addr, regs[5]);;
}; fn226(); }
	break;case 227: { var fn227 = function() {
	
	var addr = (regPairs[8] + offset) & 0xffff;
regs[4] = (tstates += ( 3), memory.read(addr));

regs[4] |= 16;

tstates += ( 1);
tstates += ( 3);
while (display.nextEventTime != null && display.nextEventTime < tstates) display.doEvent();
memory.write(addr, regs[4]);;
}; fn227(); }
	break;case 228: { var fn228 = function() {
	
	var addr = (regPairs[8] + offset) & 0xffff;
regs[7] = (tstates += ( 3), memory.read(addr));

regs[7] |= 16;

tstates += ( 1);
tstates += ( 3);
while (display.nextEventTime != null && display.nextEventTime < tstates) display.doEvent();
memory.write(addr, regs[7]);;
}; fn228(); }
	break;case 229: { var fn229 = function() {
	
	var addr = (regPairs[8] + offset) & 0xffff;
regs[6] = (tstates += ( 3), memory.read(addr));

regs[6] |= 16;

tstates += ( 1);
tstates += ( 3);
while (display.nextEventTime != null && display.nextEventTime < tstates) display.doEvent();
memory.write(addr, regs[6]);;
}; fn229(); }
	break;case 230: { var fn230 = function() {
	
	var addr = (regPairs[8] + offset) & 0xffff;
var val = (tstates += ( 3), memory.read(addr));
val |= 16;
tstates += ( 1);
tstates += ( 3);
while (display.nextEventTime != null && display.nextEventTime < tstates) display.doEvent();
memory.write(addr, val);;
}; fn230(); }
	break;case 231: { var fn231 = function() {
	
	var addr = (regPairs[8] + offset) & 0xffff;
regs[1] = (tstates += ( 3), memory.read(addr));

regs[1] |= 16;

tstates += ( 1);
tstates += ( 3);
while (display.nextEventTime != null && display.nextEventTime < tstates) display.doEvent();
memory.write(addr, regs[1]);;
}; fn231(); }
	break;case 232: { var fn232 = function() {
	
	var addr = (regPairs[8] + offset) & 0xffff;
regs[3] = (tstates += ( 3), memory.read(addr));

regs[3] |= 32;

tstates += ( 1);
tstates += ( 3);
while (display.nextEventTime != null && display.nextEventTime < tstates) display.doEvent();
memory.write(addr, regs[3]);;
}; fn232(); }
	break;case 233: { var fn233 = function() {
	
	var addr = (regPairs[8] + offset) & 0xffff;
regs[2] = (tstates += ( 3), memory.read(addr));

regs[2] |= 32;

tstates += ( 1);
tstates += ( 3);
while (display.nextEventTime != null && display.nextEventTime < tstates) display.doEvent();
memory.write(addr, regs[2]);;
}; fn233(); }
	break;case 234: { var fn234 = function() {
	
	var addr = (regPairs[8] + offset) & 0xffff;
regs[5] = (tstates += ( 3), memory.read(addr));

regs[5] |= 32;

tstates += ( 1);
tstates += ( 3);
while (display.nextEventTime != null && display.nextEventTime < tstates) display.doEvent();
memory.write(addr, regs[5]);;
}; fn234(); }
	break;case 235: { var fn235 = function() {
	
	var addr = (regPairs[8] + offset) & 0xffff;
regs[4] = (tstates += ( 3), memory.read(addr));

regs[4] |= 32;

tstates += ( 1);
tstates += ( 3);
while (display.nextEventTime != null && display.nextEventTime < tstates) display.doEvent();
memory.write(addr, regs[4]);;
}; fn235(); }
	break;case 236: { var fn236 = function() {
	
	var addr = (regPairs[8] + offset) & 0xffff;
regs[7] = (tstates += ( 3), memory.read(addr));

regs[7] |= 32;

tstates += ( 1);
tstates += ( 3);
while (display.nextEventTime != null && display.nextEventTime < tstates) display.doEvent();
memory.write(addr, regs[7]);;
}; fn236(); }
	break;case 237: { var fn237 = function() {
	
	var addr = (regPairs[8] + offset) & 0xffff;
regs[6] = (tstates += ( 3), memory.read(addr));

regs[6] |= 32;

tstates += ( 1);
tstates += ( 3);
while (display.nextEventTime != null && display.nextEventTime < tstates) display.doEvent();
memory.write(addr, regs[6]);;
}; fn237(); }
	break;case 238: { var fn238 = function() {
	
	var addr = (regPairs[8] + offset) & 0xffff;
var val = (tstates += ( 3), memory.read(addr));
val |= 32;
tstates += ( 1);
tstates += ( 3);
while (display.nextEventTime != null && display.nextEventTime < tstates) display.doEvent();
memory.write(addr, val);;
}; fn238(); }
	break;case 239: { var fn239 = function() {
	
	var addr = (regPairs[8] + offset) & 0xffff;
regs[1] = (tstates += ( 3), memory.read(addr));

regs[1] |= 32;

tstates += ( 1);
tstates += ( 3);
while (display.nextEventTime != null && display.nextEventTime < tstates) display.doEvent();
memory.write(addr, regs[1]);;
}; fn239(); }
	break;case 240: { var fn240 = function() {
	
	var addr = (regPairs[8] + offset) & 0xffff;
regs[3] = (tstates += ( 3), memory.read(addr));

regs[3] |= 64;

tstates += ( 1);
tstates += ( 3);
while (display.nextEventTime != null && display.nextEventTime < tstates) display.doEvent();
memory.write(addr, regs[3]);;
}; fn240(); }
	break;case 241: { var fn241 = function() {
	
	var addr = (regPairs[8] + offset) & 0xffff;
regs[2] = (tstates += ( 3), memory.read(addr));

regs[2] |= 64;

tstates += ( 1);
tstates += ( 3);
while (display.nextEventTime != null && display.nextEventTime < tstates) display.doEvent();
memory.write(addr, regs[2]);;
}; fn241(); }
	break;case 242: { var fn242 = function() {
	
	var addr = (regPairs[8] + offset) & 0xffff;
regs[5] = (tstates += ( 3), memory.read(addr));

regs[5] |= 64;

tstates += ( 1);
tstates += ( 3);
while (display.nextEventTime != null && display.nextEventTime < tstates) display.doEvent();
memory.write(addr, regs[5]);;
}; fn242(); }
	break;case 243: { var fn243 = function() {
	
	var addr = (regPairs[8] + offset) & 0xffff;
regs[4] = (tstates += ( 3), memory.read(addr));

regs[4] |= 64;

tstates += ( 1);
tstates += ( 3);
while (display.nextEventTime != null && display.nextEventTime < tstates) display.doEvent();
memory.write(addr, regs[4]);;
}; fn243(); }
	break;case 244: { var fn244 = function() {
	
	var addr = (regPairs[8] + offset) & 0xffff;
regs[7] = (tstates += ( 3), memory.read(addr));

regs[7] |= 64;

tstates += ( 1);
tstates += ( 3);
while (display.nextEventTime != null && display.nextEventTime < tstates) display.doEvent();
memory.write(addr, regs[7]);;
}; fn244(); }
	break;case 245: { var fn245 = function() {
	
	var addr = (regPairs[8] + offset) & 0xffff;
regs[6] = (tstates += ( 3), memory.read(addr));

regs[6] |= 64;

tstates += ( 1);
tstates += ( 3);
while (display.nextEventTime != null && display.nextEventTime < tstates) display.doEvent();
memory.write(addr, regs[6]);;
}; fn245(); }
	break;case 246: { var fn246 = function() {
	
	var addr = (regPairs[8] + offset) & 0xffff;
var val = (tstates += ( 3), memory.read(addr));
val |= 64;
tstates += ( 1);
tstates += ( 3);
while (display.nextEventTime != null && display.nextEventTime < tstates) display.doEvent();
memory.write(addr, val);;
}; fn246(); }
	break;case 247: { var fn247 = function() {
	
	var addr = (regPairs[8] + offset) & 0xffff;
regs[1] = (tstates += ( 3), memory.read(addr));

regs[1] |= 64;

tstates += ( 1);
tstates += ( 3);
while (display.nextEventTime != null && display.nextEventTime < tstates) display.doEvent();
memory.write(addr, regs[1]);;
}; fn247(); }
	break;case 248: { var fn248 = function() {
	
	var addr = (regPairs[8] + offset) & 0xffff;
regs[3] = (tstates += ( 3), memory.read(addr));

regs[3] |= 128;

tstates += ( 1);
tstates += ( 3);
while (display.nextEventTime != null && display.nextEventTime < tstates) display.doEvent();
memory.write(addr, regs[3]);;
}; fn248(); }
	break;case 249: { var fn249 = function() {
	
	var addr = (regPairs[8] + offset) & 0xffff;
regs[2] = (tstates += ( 3), memory.read(addr));

regs[2] |= 128;

tstates += ( 1);
tstates += ( 3);
while (display.nextEventTime != null && display.nextEventTime < tstates) display.doEvent();
memory.write(addr, regs[2]);;
}; fn249(); }
	break;case 250: { var fn250 = function() {
	
	var addr = (regPairs[8] + offset) & 0xffff;
regs[5] = (tstates += ( 3), memory.read(addr));

regs[5] |= 128;

tstates += ( 1);
tstates += ( 3);
while (display.nextEventTime != null && display.nextEventTime < tstates) display.doEvent();
memory.write(addr, regs[5]);;
}; fn250(); }
	break;case 251: { var fn251 = function() {
	
	var addr = (regPairs[8] + offset) & 0xffff;
regs[4] = (tstates += ( 3), memory.read(addr));

regs[4] |= 128;

tstates += ( 1);
tstates += ( 3);
while (display.nextEventTime != null && display.nextEventTime < tstates) display.doEvent();
memory.write(addr, regs[4]);;
}; fn251(); }
	break;case 252: { var fn252 = function() {
	
	var addr = (regPairs[8] + offset) & 0xffff;
regs[7] = (tstates += ( 3), memory.read(addr));

regs[7] |= 128;

tstates += ( 1);
tstates += ( 3);
while (display.nextEventTime != null && display.nextEventTime < tstates) display.doEvent();
memory.write(addr, regs[7]);;
}; fn252(); }
	break;case 253: { var fn253 = function() {
	
	var addr = (regPairs[8] + offset) & 0xffff;
regs[6] = (tstates += ( 3), memory.read(addr));

regs[6] |= 128;

tstates += ( 1);
tstates += ( 3);
while (display.nextEventTime != null && display.nextEventTime < tstates) display.doEvent();
memory.write(addr, regs[6]);;
}; fn253(); }
	break;case 254: { var fn254 = function() {
	
	var addr = (regPairs[8] + offset) & 0xffff;
var val = (tstates += ( 3), memory.read(addr));
val |= 128;
tstates += ( 1);
tstates += ( 3);
while (display.nextEventTime != null && display.nextEventTime < tstates) display.doEvent();
memory.write(addr, val);;
}; fn254(); }
	break;case 255: { var fn255 = function() {
	
	var addr = (regPairs[8] + offset) & 0xffff;
regs[1] = (tstates += ( 3), memory.read(addr));

regs[1] |= 128;

tstates += ( 1);
tstates += ( 3);
while (display.nextEventTime != null && display.nextEventTime < tstates) display.doEvent();
memory.write(addr, regs[1]);;
}; fn255(); }
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
	case 64: { var fn64 = function() {
	
	var port = regPairs[1];
tstates += 1;
regs[3] = ioBus.read(port);
tstates += 3;
regs[0] = (regs[0] & 1) | sz53pTable[regs[3]];
}; fn64(); }
	break;case 65: { var fn65 = function() {
	
	tstates += 1;
ioBus.write(regPairs[1], regs[3], tstates);
tstates += 3;
}; fn65(); }
	break;case 66: { var fn66 = function() {
	
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
}; fn66(); }
	break;case 67: { var fn67 = function() {
	
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
}; fn67(); }
	break;case 68: { var fn68 = function() {
	
	var val = regs[1];
var subtemp = -val;
var lookup = ( (val & 0x88) >> 2 ) | ( (subtemp & 0x88) >> 1 );
regs[1] = subtemp;
regs[0] = ( subtemp & 0x100 ? 1 : 0 ) | 2 | halfcarrySubTable[lookup & 0x07] | overflowSubTable[lookup >> 4] | sz53Table[regs[1]];
}; fn68(); }
	break;case 69: { var fn69 = function() {
	
	iff1 = iff2;
var l = (tstates += ( 3), memory.read(regPairs[11])); regPairs[11]++;
var h = (tstates += ( 3), memory.read(regPairs[11])); regPairs[11]++;
regPairs[12] = (h<<8) | l;
}; fn69(); }
	break;case 70: { var fn70 = function() {
	
	im = 0;
}; fn70(); }
	break;case 71: { var fn71 = function() {
	
	tstates += ( 1);
regs[21] = regs[1];
}; fn71(); }
	break;case 72: { var fn72 = function() {
	
	var port = regPairs[1];
tstates += 1;
regs[2] = ioBus.read(port);
tstates += 3;
regs[0] = (regs[0] & 1) | sz53pTable[regs[2]];
}; fn72(); }
	break;case 73: { var fn73 = function() {
	
	tstates += 1;
ioBus.write(regPairs[1], regs[2], tstates);
tstates += 3;
}; fn73(); }
	break;case 74: { var fn74 = function() {
	
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
}; fn74(); }
	break;case 75: { var fn75 = function() {
	
	var l = (tstates += ( 3), memory.read(regPairs[12])); regPairs[12]++;
var h = (tstates += ( 3), memory.read(regPairs[12])); regPairs[12]++;
var addr = (h<<8) | l;
l = (tstates += ( 3), memory.read(addr));
addr = (addr + 1) & 0xffff;
h = (tstates += ( 3), memory.read(addr));
regPairs[1] = (h<<8) | l;
}; fn75(); }
	break;case 76: { var fn76 = function() {
	
	var val = regs[1];
var subtemp = -val;
var lookup = ( (val & 0x88) >> 2 ) | ( (subtemp & 0x88) >> 1 );
regs[1] = subtemp;
regs[0] = ( subtemp & 0x100 ? 1 : 0 ) | 2 | halfcarrySubTable[lookup & 0x07] | overflowSubTable[lookup >> 4] | sz53Table[regs[1]];
}; fn76(); }
	break;case 77: { var fn77 = function() {
	
	iff1 = iff2;
var l = (tstates += ( 3), memory.read(regPairs[11])); regPairs[11]++;
var h = (tstates += ( 3), memory.read(regPairs[11])); regPairs[11]++;
regPairs[12] = (h<<8) | l;
}; fn77(); }
	break;case 78: { var fn78 = function() {
	
	im = 0;
}; fn78(); }
	break;case 79: { var fn79 = function() {
	
	tstates += ( 1);
regs[20] = regs[1];
}; fn79(); }
	break;case 80: { var fn80 = function() {
	
	var port = regPairs[1];
tstates += 1;
regs[5] = ioBus.read(port);
tstates += 3;
regs[0] = (regs[0] & 1) | sz53pTable[regs[5]];
}; fn80(); }
	break;case 81: { var fn81 = function() {
	
	tstates += 1;
ioBus.write(regPairs[1], regs[5], tstates);
tstates += 3;
}; fn81(); }
	break;case 82: { var fn82 = function() {
	
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
}; fn82(); }
	break;case 83: { var fn83 = function() {
	
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
}; fn83(); }
	break;case 84: { var fn84 = function() {
	
	var val = regs[1];
var subtemp = -val;
var lookup = ( (val & 0x88) >> 2 ) | ( (subtemp & 0x88) >> 1 );
regs[1] = subtemp;
regs[0] = ( subtemp & 0x100 ? 1 : 0 ) | 2 | halfcarrySubTable[lookup & 0x07] | overflowSubTable[lookup >> 4] | sz53Table[regs[1]];
}; fn84(); }
	break;case 85: { var fn85 = function() {
	
	iff1 = iff2;
var l = (tstates += ( 3), memory.read(regPairs[11])); regPairs[11]++;
var h = (tstates += ( 3), memory.read(regPairs[11])); regPairs[11]++;
regPairs[12] = (h<<8) | l;
}; fn85(); }
	break;case 86: { var fn86 = function() {
	
	im = 1;
}; fn86(); }
	break;case 87: { var fn87 = function() {
	
	tstates += ( 1);
regs[1] = regs[21];regs[0] = (regs[0] & 1) | sz53Table[regs[1]] | ( iff2 ? 4 : 0 );
}; fn87(); }
	break;case 88: { var fn88 = function() {
	
	var port = regPairs[1];
tstates += 1;
regs[4] = ioBus.read(port);
tstates += 3;
regs[0] = (regs[0] & 1) | sz53pTable[regs[4]];
}; fn88(); }
	break;case 89: { var fn89 = function() {
	
	tstates += 1;
ioBus.write(regPairs[1], regs[4], tstates);
tstates += 3;
}; fn89(); }
	break;case 90: { var fn90 = function() {
	
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
}; fn90(); }
	break;case 91: { var fn91 = function() {
	
	var l = (tstates += ( 3), memory.read(regPairs[12])); regPairs[12]++;
var h = (tstates += ( 3), memory.read(regPairs[12])); regPairs[12]++;
var addr = (h<<8) | l;
l = (tstates += ( 3), memory.read(addr));
addr = (addr + 1) & 0xffff;
h = (tstates += ( 3), memory.read(addr));
regPairs[2] = (h<<8) | l;
}; fn91(); }
	break;case 92: { var fn92 = function() {
	
	var val = regs[1];
var subtemp = -val;
var lookup = ( (val & 0x88) >> 2 ) | ( (subtemp & 0x88) >> 1 );
regs[1] = subtemp;
regs[0] = ( subtemp & 0x100 ? 1 : 0 ) | 2 | halfcarrySubTable[lookup & 0x07] | overflowSubTable[lookup >> 4] | sz53Table[regs[1]];
}; fn92(); }
	break;case 93: { var fn93 = function() {
	
	iff1 = iff2;
var l = (tstates += ( 3), memory.read(regPairs[11])); regPairs[11]++;
var h = (tstates += ( 3), memory.read(regPairs[11])); regPairs[11]++;
regPairs[12] = (h<<8) | l;
}; fn93(); }
	break;case 94: { var fn94 = function() {
	
	im = 2;
}; fn94(); }
	break;case 95: { var fn95 = function() {
	
	tstates += ( 1);
regs[1] = regs[20];regs[0] = (regs[0] & 1) | sz53Table[regs[1]] | ( iff2 ? 4 : 0 );
}; fn95(); }
	break;case 96: { var fn96 = function() {
	
	var port = regPairs[1];
tstates += 1;
regs[7] = ioBus.read(port);
tstates += 3;
regs[0] = (regs[0] & 1) | sz53pTable[regs[7]];
}; fn96(); }
	break;case 97: { var fn97 = function() {
	
	tstates += 1;
ioBus.write(regPairs[1], regs[7], tstates);
tstates += 3;
}; fn97(); }
	break;case 98: { var fn98 = function() {
	
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
}; fn98(); }
	break;case 99: { var fn99 = function() {
	
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
}; fn99(); }
	break;case 100: { var fn100 = function() {
	
	var val = regs[1];
var subtemp = -val;
var lookup = ( (val & 0x88) >> 2 ) | ( (subtemp & 0x88) >> 1 );
regs[1] = subtemp;
regs[0] = ( subtemp & 0x100 ? 1 : 0 ) | 2 | halfcarrySubTable[lookup & 0x07] | overflowSubTable[lookup >> 4] | sz53Table[regs[1]];
}; fn100(); }
	break;case 101: { var fn101 = function() {
	
	iff1 = iff2;
var l = (tstates += ( 3), memory.read(regPairs[11])); regPairs[11]++;
var h = (tstates += ( 3), memory.read(regPairs[11])); regPairs[11]++;
regPairs[12] = (h<<8) | l;
}; fn101(); }
	break;case 102: { var fn102 = function() {
	
	im = 0;
}; fn102(); }
	break;case 103: { var fn103 = function() {
	
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
}; fn103(); }
	break;case 104: { var fn104 = function() {
	
	var port = regPairs[1];
tstates += 1;
regs[6] = ioBus.read(port);
tstates += 3;
regs[0] = (regs[0] & 1) | sz53pTable[regs[6]];
}; fn104(); }
	break;case 105: { var fn105 = function() {
	
	tstates += 1;
ioBus.write(regPairs[1], regs[6], tstates);
tstates += 3;
}; fn105(); }
	break;case 106: { var fn106 = function() {
	
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
}; fn106(); }
	break;case 107: { var fn107 = function() {
	
	var l = (tstates += ( 3), memory.read(regPairs[12])); regPairs[12]++;
var h = (tstates += ( 3), memory.read(regPairs[12])); regPairs[12]++;
var addr = (h<<8) | l;
l = (tstates += ( 3), memory.read(addr));
addr = (addr + 1) & 0xffff;
h = (tstates += ( 3), memory.read(addr));
regPairs[3] = (h<<8) | l;
}; fn107(); }
	break;case 108: { var fn108 = function() {
	
	var val = regs[1];
var subtemp = -val;
var lookup = ( (val & 0x88) >> 2 ) | ( (subtemp & 0x88) >> 1 );
regs[1] = subtemp;
regs[0] = ( subtemp & 0x100 ? 1 : 0 ) | 2 | halfcarrySubTable[lookup & 0x07] | overflowSubTable[lookup >> 4] | sz53Table[regs[1]];
}; fn108(); }
	break;case 109: { var fn109 = function() {
	
	iff1 = iff2;
var l = (tstates += ( 3), memory.read(regPairs[11])); regPairs[11]++;
var h = (tstates += ( 3), memory.read(regPairs[11])); regPairs[11]++;
regPairs[12] = (h<<8) | l;
}; fn109(); }
	break;case 110: { var fn110 = function() {
	
	im = 0;
}; fn110(); }
	break;case 111: { var fn111 = function() {
	
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
}; fn111(); }
	break;case 112: { var fn112 = function() {
	
	var port = regPairs[1];
tstates += 1;
var result = ioBus.read(port);
tstates += 3;
regs[0] = (regs[0] & 1) | sz53pTable[result];
}; fn112(); }
	break;case 113: { var fn113 = function() {
	
	tstates += 1;
ioBus.write(regPairs[1], 0, tstates);
tstates += 3;
}; fn113(); }
	break;case 114: { var fn114 = function() {
	
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
}; fn114(); }
	break;case 115: { var fn115 = function() {
	
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
}; fn115(); }
	break;case 116: { var fn116 = function() {
	
	var val = regs[1];
var subtemp = -val;
var lookup = ( (val & 0x88) >> 2 ) | ( (subtemp & 0x88) >> 1 );
regs[1] = subtemp;
regs[0] = ( subtemp & 0x100 ? 1 : 0 ) | 2 | halfcarrySubTable[lookup & 0x07] | overflowSubTable[lookup >> 4] | sz53Table[regs[1]];
}; fn116(); }
	break;case 117: { var fn117 = function() {
	
	iff1 = iff2;
var l = (tstates += ( 3), memory.read(regPairs[11])); regPairs[11]++;
var h = (tstates += ( 3), memory.read(regPairs[11])); regPairs[11]++;
regPairs[12] = (h<<8) | l;
}; fn117(); }
	break;case 118: { var fn118 = function() {
	
	im = 1;
}; fn118(); }
	break;case 120: { var fn120 = function() {
	
	var port = regPairs[1];
tstates += 1;
regs[1] = ioBus.read(port);
tstates += 3;
regs[0] = (regs[0] & 1) | sz53pTable[regs[1]];
}; fn120(); }
	break;case 121: { var fn121 = function() {
	
	tstates += 1;
ioBus.write(regPairs[1], regs[1], tstates);
tstates += 3;
}; fn121(); }
	break;case 122: { var fn122 = function() {
	
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
}; fn122(); }
	break;case 123: { var fn123 = function() {
	
	var l = (tstates += ( 3), memory.read(regPairs[12])); regPairs[12]++;
var h = (tstates += ( 3), memory.read(regPairs[12])); regPairs[12]++;
var addr = (h<<8) | l;
l = (tstates += ( 3), memory.read(addr));
addr = (addr + 1) & 0xffff;
h = (tstates += ( 3), memory.read(addr));
regPairs[11] = (h<<8) | l;
}; fn123(); }
	break;case 124: { var fn124 = function() {
	
	var val = regs[1];
var subtemp = -val;
var lookup = ( (val & 0x88) >> 2 ) | ( (subtemp & 0x88) >> 1 );
regs[1] = subtemp;
regs[0] = ( subtemp & 0x100 ? 1 : 0 ) | 2 | halfcarrySubTable[lookup & 0x07] | overflowSubTable[lookup >> 4] | sz53Table[regs[1]];
}; fn124(); }
	break;case 125: { var fn125 = function() {
	
	iff1 = iff2;
var l = (tstates += ( 3), memory.read(regPairs[11])); regPairs[11]++;
var h = (tstates += ( 3), memory.read(regPairs[11])); regPairs[11]++;
regPairs[12] = (h<<8) | l;
}; fn125(); }
	break;case 126: { var fn126 = function() {
	
	im = 2;
}; fn126(); }
	break;case 160: { var fn160 = function() {
	
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
}; fn160(); }
	break;case 161: { var fn161 = function() {
	
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
}; fn161(); }
	break;case 162: { var fn162 = function() {
	
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
}; fn162(); }
	break;case 163: { var fn163 = function() {
	
	tstates += ( 1);
var outitemp = (tstates += ( 3), memory.read(regPairs[3]));
regs[3]--;	/* This does happen first, despite what the specs say */
tstates += 1;
ioBus.write(regPairs[1], outitemp, tstates);
tstates += 3;

regPairs[3]++;
outitemp2 = (outitemp + regs[6]) & 0xff;
regs[0] = (outitemp & 0x80 ? 2 : 0) | ( (outitemp2 < outitemp) ? 17 : 0) | (parityTable[ (outitemp2 & 0x07) ^ regs[3] ] ? 4 : 0 ) | sz53Table[ regs[3] ];
}; fn163(); }
	break;case 168: { var fn168 = function() {
	
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
}; fn168(); }
	break;case 169: { var fn169 = function() {
	
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
}; fn169(); }
	break;case 170: { var fn170 = function() {
	
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
}; fn170(); }
	break;case 171: { var fn171 = function() {
	
	tstates += ( 1);
var outitemp = (tstates += ( 3), memory.read(regPairs[3]));
regs[3]--;	/* This does happen first, despite what the specs say */
tstates += 1;
ioBus.write(regPairs[1], outitemp, tstates);
tstates += 3;

regPairs[3]--;
outitemp2 = (outitemp + regs[6]) & 0xff;
regs[0] = (outitemp & 0x80 ? 2 : 0) | ( (outitemp2 < outitemp) ? 17 : 0) | (parityTable[ (outitemp2 & 0x07) ^ regs[3] ] ? 4 : 0 ) | sz53Table[ regs[3] ];
}; fn171(); }
	break;case 176: { var fn176 = function() {
	
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
}; fn176(); }
	break;case 177: { var fn177 = function() {
	
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
}; fn177(); }
	break;case 178: { var fn178 = function() {
	
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
}; fn178(); }
	break;case 179: { var fn179 = function() {
	
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
}; fn179(); }
	break;case 184: { var fn184 = function() {
	
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
}; fn184(); }
	break;case 185: { var fn185 = function() {
	
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
}; fn185(); }
	break;case 186: { var fn186 = function() {
	
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
}; fn186(); }
	break;case 187: { var fn187 = function() {
	
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
}; fn187(); }
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
	case 0: { var fn0 = function() {
	
			
}; fn0(); }
	break;case 1: { var fn1 = function() {
	
	var l = (tstates += ( 3), memory.read(regPairs[12])); regPairs[12]++;
var h = (tstates += ( 3), memory.read(regPairs[12])); regPairs[12]++;
regPairs[1] = (h<<8) | l;
}; fn1(); }
	break;case 2: { var fn2 = function() {
	
	tstates += ( 3);
while (display.nextEventTime != null && display.nextEventTime < tstates) display.doEvent();
memory.write(regPairs[1], regs[1]);;
}; fn2(); }
	break;case 3: { var fn3 = function() {
	
	regPairs[1]++;
tstates += ( 1);
tstates += ( 1);
}; fn3(); }
	break;case 4: { var fn4 = function() {
	
	

regs[0] = (regs[0] & 1) | (regs[3] & 0x0f ? 0 : 16) | 2;
regs[3] = (regs[3] + 1) ;


regs[0] = (regs[0] & 1) | ( regs[3] == 0x80 ? 4 : 0 ) | ( regs[3] & 0x0f ? 0 : 16 ) | sz53Table[regs[3]];
}; fn4(); }
	break;case 5: { var fn5 = function() {
	
	

regs[0] = (regs[0] & 1 ) | ( regs[3] & 0x0f ? 0 : 16 ) | 2;
regs[3] = (regs[3] - 1) ;


regs[0] |= (regs[3] == 0x7f ? 4 : 0) | sz53Table[regs[3]];
}; fn5(); }
	break;case 6: { var fn6 = function() {
	
	regs[3] = (tstates += ( 3), memory.read(regPairs[12])); regPairs[12]++;
}; fn6(); }
	break;case 7: { var fn7 = function() {
	
	regs[1] = (regs[1] << 1) | (regs[1] >> 7);
regs[0] = (regs[0] & 196) | (regs[1] & 41);
}; fn7(); }
	break;case 8: { var fn8 = function() {
	
	var temp = regPairs[0];
regPairs[0] = regPairs[4];
regPairs[4] = temp;
}; fn8(); }
	break;case 9: { var fn9 = function() {
	
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
}; fn9(); }
	break;case 10: { var fn10 = function() {
	
	regs[1] = (tstates += ( 3), memory.read(regPairs[1]));
}; fn10(); }
	break;case 11: { var fn11 = function() {
	
	regPairs[1]--;
tstates += ( 1);
tstates += ( 1);
}; fn11(); }
	break;case 12: { var fn12 = function() {
	
	

regs[0] = (regs[0] & 1) | (regs[2] & 0x0f ? 0 : 16) | 2;
regs[2] = (regs[2] + 1) ;


regs[0] = (regs[0] & 1) | ( regs[2] == 0x80 ? 4 : 0 ) | ( regs[2] & 0x0f ? 0 : 16 ) | sz53Table[regs[2]];
}; fn12(); }
	break;case 13: { var fn13 = function() {
	
	

regs[0] = (regs[0] & 1 ) | ( regs[2] & 0x0f ? 0 : 16 ) | 2;
regs[2] = (regs[2] - 1) ;


regs[0] |= (regs[2] == 0x7f ? 4 : 0) | sz53Table[regs[2]];
}; fn13(); }
	break;case 14: { var fn14 = function() {
	
	regs[2] = (tstates += ( 3), memory.read(regPairs[12])); regPairs[12]++;
}; fn14(); }
	break;case 15: { var fn15 = function() {
	
	regs[0] = (regs[0] & 196) | (regs[1] & 1);
regs[1] = (regs[1] >> 1) | (regs[1] << 7);
regs[0] |= (regs[1] & 40);
}; fn15(); }
	break;case 16: { var fn16 = function() {
	
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
}; fn16(); }
	break;case 17: { var fn17 = function() {
	
	var l = (tstates += ( 3), memory.read(regPairs[12])); regPairs[12]++;
var h = (tstates += ( 3), memory.read(regPairs[12])); regPairs[12]++;
regPairs[2] = (h<<8) | l;
}; fn17(); }
	break;case 18: { var fn18 = function() {
	
	tstates += ( 3);
while (display.nextEventTime != null && display.nextEventTime < tstates) display.doEvent();
memory.write(regPairs[2], regs[1]);;
}; fn18(); }
	break;case 19: { var fn19 = function() {
	
	regPairs[2]++;
tstates += ( 1);
tstates += ( 1);
}; fn19(); }
	break;case 20: { var fn20 = function() {
	
	

regs[0] = (regs[0] & 1) | (regs[5] & 0x0f ? 0 : 16) | 2;
regs[5] = (regs[5] + 1) ;


regs[0] = (regs[0] & 1) | ( regs[5] == 0x80 ? 4 : 0 ) | ( regs[5] & 0x0f ? 0 : 16 ) | sz53Table[regs[5]];
}; fn20(); }
	break;case 21: { var fn21 = function() {
	
	

regs[0] = (regs[0] & 1 ) | ( regs[5] & 0x0f ? 0 : 16 ) | 2;
regs[5] = (regs[5] - 1) ;


regs[0] |= (regs[5] == 0x7f ? 4 : 0) | sz53Table[regs[5]];
}; fn21(); }
	break;case 22: { var fn22 = function() {
	
	regs[5] = (tstates += ( 3), memory.read(regPairs[12])); regPairs[12]++;
}; fn22(); }
	break;case 23: { var fn23 = function() {
	
	var bytetemp = regs[1];
regs[1] = (regs[1] << 1) | (regs[0] & 1);
regs[0] = (regs[0] & 196) | (regs[1] & 40) | (bytetemp >> 7);
}; fn23(); }
	break;case 24: { var fn24 = function() {
	
	var offset = (tstates += ( 3), memory.read(regPairs[12]));
tstates += ( 1);
tstates += ( 1);
tstates += ( 1);
tstates += ( 1);
tstates += ( 1);
regPairs[12]++;
regPairs[12] += (offset & 0x80 ? offset - 0x100 : offset);
}; fn24(); }
	break;case 25: { var fn25 = function() {
	
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
}; fn25(); }
	break;case 26: { var fn26 = function() {
	
	regs[1] = (tstates += ( 3), memory.read(regPairs[2]));
}; fn26(); }
	break;case 27: { var fn27 = function() {
	
	regPairs[2]--;
tstates += ( 1);
tstates += ( 1);
}; fn27(); }
	break;case 28: { var fn28 = function() {
	
	

regs[0] = (regs[0] & 1) | (regs[4] & 0x0f ? 0 : 16) | 2;
regs[4] = (regs[4] + 1) ;


regs[0] = (regs[0] & 1) | ( regs[4] == 0x80 ? 4 : 0 ) | ( regs[4] & 0x0f ? 0 : 16 ) | sz53Table[regs[4]];
}; fn28(); }
	break;case 29: { var fn29 = function() {
	
	

regs[0] = (regs[0] & 1 ) | ( regs[4] & 0x0f ? 0 : 16 ) | 2;
regs[4] = (regs[4] - 1) ;


regs[0] |= (regs[4] == 0x7f ? 4 : 0) | sz53Table[regs[4]];
}; fn29(); }
	break;case 30: { var fn30 = function() {
	
	regs[4] = (tstates += ( 3), memory.read(regPairs[12])); regPairs[12]++;
}; fn30(); }
	break;case 31: { var fn31 = function() {
	
	var bytetemp = regs[1];
regs[1] = (bytetemp >> 1) | (regs[0] << 7);
regs[0] = (regs[0] & 196) | (regs[1] & 40) | (bytetemp & 1);
}; fn31(); }
	break;case 32: { var fn32 = function() {
	
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
}; fn32(); }
	break;case 33: { var fn33 = function() {
	
	var l = (tstates += ( 3), memory.read(regPairs[12])); regPairs[12]++;
var h = (tstates += ( 3), memory.read(regPairs[12])); regPairs[12]++;
regPairs[9] = (h<<8) | l;
}; fn33(); }
	break;case 34: { var fn34 = function() {
	
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
}; fn34(); }
	break;case 35: { var fn35 = function() {
	
	regPairs[9]++;
tstates += ( 1);
tstates += ( 1);
}; fn35(); }
	break;case 36: { var fn36 = function() {
	
	

regs[0] = (regs[0] & 1) | (regs[19] & 0x0f ? 0 : 16) | 2;
regs[19] = (regs[19] + 1) ;


regs[0] = (regs[0] & 1) | ( regs[19] == 0x80 ? 4 : 0 ) | ( regs[19] & 0x0f ? 0 : 16 ) | sz53Table[regs[19]];
}; fn36(); }
	break;case 37: { var fn37 = function() {
	
	

regs[0] = (regs[0] & 1 ) | ( regs[19] & 0x0f ? 0 : 16 ) | 2;
regs[19] = (regs[19] - 1) ;


regs[0] |= (regs[19] == 0x7f ? 4 : 0) | sz53Table[regs[19]];
}; fn37(); }
	break;case 38: { var fn38 = function() {
	
	regs[19] = (tstates += ( 3), memory.read(regPairs[12])); regPairs[12]++;
}; fn38(); }
	break;case 39: { var fn39 = function() {
	
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
}; fn39(); }
	break;case 40: { var fn40 = function() {
	
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
}; fn40(); }
	break;case 41: { var fn41 = function() {
	
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
}; fn41(); }
	break;case 42: { var fn42 = function() {
	
	var l = (tstates += ( 3), memory.read(regPairs[12])); regPairs[12]++;
var h = (tstates += ( 3), memory.read(regPairs[12])); regPairs[12]++;
var addr = (h<<8) | l;
l = (tstates += ( 3), memory.read(addr));
addr = (addr + 1) & 0xffff;
h = (tstates += ( 3), memory.read(addr));
regPairs[9] = (h<<8) | l;
}; fn42(); }
	break;case 43: { var fn43 = function() {
	
	regPairs[9]--;
tstates += ( 1);
tstates += ( 1);
}; fn43(); }
	break;case 44: { var fn44 = function() {
	
	

regs[0] = (regs[0] & 1) | (regs[18] & 0x0f ? 0 : 16) | 2;
regs[18] = (regs[18] + 1) ;


regs[0] = (regs[0] & 1) | ( regs[18] == 0x80 ? 4 : 0 ) | ( regs[18] & 0x0f ? 0 : 16 ) | sz53Table[regs[18]];
}; fn44(); }
	break;case 45: { var fn45 = function() {
	
	

regs[0] = (regs[0] & 1 ) | ( regs[18] & 0x0f ? 0 : 16 ) | 2;
regs[18] = (regs[18] - 1) ;


regs[0] |= (regs[18] == 0x7f ? 4 : 0) | sz53Table[regs[18]];
}; fn45(); }
	break;case 46: { var fn46 = function() {
	
	regs[18] = (tstates += ( 3), memory.read(regPairs[12])); regPairs[12]++;
}; fn46(); }
	break;case 47: { var fn47 = function() {
	
	regs[1] ^= 0xff;
regs[0] = (regs[0] & 197) | (regs[1] & 40) | 18;
}; fn47(); }
	break;case 48: { var fn48 = function() {
	
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
}; fn48(); }
	break;case 49: { var fn49 = function() {
	
	var l = (tstates += ( 3), memory.read(regPairs[12])); regPairs[12]++;
var h = (tstates += ( 3), memory.read(regPairs[12])); regPairs[12]++;
regPairs[11] = (h<<8) | l;
}; fn49(); }
	break;case 50: { var fn50 = function() {
	
	var l = (tstates += ( 3), memory.read(regPairs[12])); regPairs[12]++;
var h = (tstates += ( 3), memory.read(regPairs[12])); regPairs[12]++;
var addr = (h<<8) | l;
tstates += ( 3);
while (display.nextEventTime != null && display.nextEventTime < tstates) display.doEvent();
memory.write(addr, regs[1]);;
}; fn50(); }
	break;case 51: { var fn51 = function() {
	
	regPairs[11]++;
tstates += ( 1);
tstates += ( 1);
}; fn51(); }
	break;case 52: { var fn52 = function() {
	
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
}; fn52(); }
	break;case 53: { var fn53 = function() {
	
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
}; fn53(); }
	break;case 54: { var fn54 = function() {
	
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
}; fn54(); }
	break;case 55: { var fn55 = function() {
	
	regs[0] = (regs[0] & 196) | (regs[1] & 40) | 1;
}; fn55(); }
	break;case 56: { var fn56 = function() {
	
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
}; fn56(); }
	break;case 57: { var fn57 = function() {
	
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
}; fn57(); }
	break;case 58: { var fn58 = function() {
	
	var l = (tstates += ( 3), memory.read(regPairs[12])); regPairs[12]++;
var h = (tstates += ( 3), memory.read(regPairs[12])); regPairs[12]++;
var addr = (h<<8) | l;
regs[1] = (tstates += ( 3), memory.read(addr));
}; fn58(); }
	break;case 59: { var fn59 = function() {
	
	regPairs[11]--;
tstates += ( 1);
tstates += ( 1);
}; fn59(); }
	break;case 60: { var fn60 = function() {
	
	

regs[0] = (regs[0] & 1) | (regs[1] & 0x0f ? 0 : 16) | 2;
regs[1] = (regs[1] + 1) ;


regs[0] = (regs[0] & 1) | ( regs[1] == 0x80 ? 4 : 0 ) | ( regs[1] & 0x0f ? 0 : 16 ) | sz53Table[regs[1]];
}; fn60(); }
	break;case 61: { var fn61 = function() {
	
	

regs[0] = (regs[0] & 1 ) | ( regs[1] & 0x0f ? 0 : 16 ) | 2;
regs[1] = (regs[1] - 1) ;


regs[0] |= (regs[1] == 0x7f ? 4 : 0) | sz53Table[regs[1]];
}; fn61(); }
	break;case 62: { var fn62 = function() {
	
	regs[1] = (tstates += ( 3), memory.read(regPairs[12])); regPairs[12]++;
}; fn62(); }
	break;case 63: { var fn63 = function() {
	
	regs[0] = ( regs[0] & 196 ) | ( (regs[0] & 1) ? 16 : 1 ) | ( regs[1] & 40 );
}; fn63(); }
	break;case 64: { var fn64 = function() {
	
	regs[3] = regs[3];
}; fn64(); }
	break;case 65: { var fn65 = function() {
	
	regs[3] = regs[2];
}; fn65(); }
	break;case 66: { var fn66 = function() {
	
	regs[3] = regs[5];
}; fn66(); }
	break;case 67: { var fn67 = function() {
	
	regs[3] = regs[4];
}; fn67(); }
	break;case 68: { var fn68 = function() {
	
	regs[3] = regs[19];
}; fn68(); }
	break;case 69: { var fn69 = function() {
	
	regs[3] = regs[18];
}; fn69(); }
	break;case 70: { var fn70 = function() {
	
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
}; fn70(); }
	break;case 71: { var fn71 = function() {
	
	regs[3] = regs[1];
}; fn71(); }
	break;case 72: { var fn72 = function() {
	
	regs[2] = regs[3];
}; fn72(); }
	break;case 73: { var fn73 = function() {
	
	regs[2] = regs[2];
}; fn73(); }
	break;case 74: { var fn74 = function() {
	
	regs[2] = regs[5];
}; fn74(); }
	break;case 75: { var fn75 = function() {
	
	regs[2] = regs[4];
}; fn75(); }
	break;case 76: { var fn76 = function() {
	
	regs[2] = regs[19];
}; fn76(); }
	break;case 77: { var fn77 = function() {
	
	regs[2] = regs[18];
}; fn77(); }
	break;case 78: { var fn78 = function() {
	
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
}; fn78(); }
	break;case 79: { var fn79 = function() {
	
	regs[2] = regs[1];
}; fn79(); }
	break;case 80: { var fn80 = function() {
	
	regs[5] = regs[3];
}; fn80(); }
	break;case 81: { var fn81 = function() {
	
	regs[5] = regs[2];
}; fn81(); }
	break;case 82: { var fn82 = function() {
	
	regs[5] = regs[5];
}; fn82(); }
	break;case 83: { var fn83 = function() {
	
	regs[5] = regs[4];
}; fn83(); }
	break;case 84: { var fn84 = function() {
	
	regs[5] = regs[19];
}; fn84(); }
	break;case 85: { var fn85 = function() {
	
	regs[5] = regs[18];
}; fn85(); }
	break;case 86: { var fn86 = function() {
	
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
}; fn86(); }
	break;case 87: { var fn87 = function() {
	
	regs[5] = regs[1];
}; fn87(); }
	break;case 88: { var fn88 = function() {
	
	regs[4] = regs[3];
}; fn88(); }
	break;case 89: { var fn89 = function() {
	
	regs[4] = regs[2];
}; fn89(); }
	break;case 90: { var fn90 = function() {
	
	regs[4] = regs[5];
}; fn90(); }
	break;case 91: { var fn91 = function() {
	
	regs[4] = regs[4];
}; fn91(); }
	break;case 92: { var fn92 = function() {
	
	regs[4] = regs[19];
}; fn92(); }
	break;case 93: { var fn93 = function() {
	
	regs[4] = regs[18];
}; fn93(); }
	break;case 94: { var fn94 = function() {
	
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
}; fn94(); }
	break;case 95: { var fn95 = function() {
	
	regs[4] = regs[1];
}; fn95(); }
	break;case 96: { var fn96 = function() {
	
	regs[19] = regs[3];
}; fn96(); }
	break;case 97: { var fn97 = function() {
	
	regs[19] = regs[2];
}; fn97(); }
	break;case 98: { var fn98 = function() {
	
	regs[19] = regs[5];
}; fn98(); }
	break;case 99: { var fn99 = function() {
	
	regs[19] = regs[4];
}; fn99(); }
	break;case 100: { var fn100 = function() {
	
	regs[19] = regs[19];
}; fn100(); }
	break;case 101: { var fn101 = function() {
	
	regs[19] = regs[18];
}; fn101(); }
	break;case 102: { var fn102 = function() {
	
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
}; fn102(); }
	break;case 103: { var fn103 = function() {
	
	regs[19] = regs[1];
}; fn103(); }
	break;case 104: { var fn104 = function() {
	
	regs[18] = regs[3];
}; fn104(); }
	break;case 105: { var fn105 = function() {
	
	regs[18] = regs[2];
}; fn105(); }
	break;case 106: { var fn106 = function() {
	
	regs[18] = regs[5];
}; fn106(); }
	break;case 107: { var fn107 = function() {
	
	regs[18] = regs[4];
}; fn107(); }
	break;case 108: { var fn108 = function() {
	
	regs[18] = regs[19];
}; fn108(); }
	break;case 109: { var fn109 = function() {
	
	regs[18] = regs[18];
}; fn109(); }
	break;case 110: { var fn110 = function() {
	
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
}; fn110(); }
	break;case 111: { var fn111 = function() {
	
	regs[18] = regs[1];
}; fn111(); }
	break;case 112: { var fn112 = function() {
	
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
}; fn112(); }
	break;case 113: { var fn113 = function() {
	
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
}; fn113(); }
	break;case 114: { var fn114 = function() {
	
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
}; fn114(); }
	break;case 115: { var fn115 = function() {
	
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
}; fn115(); }
	break;case 116: { var fn116 = function() {
	
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
}; fn116(); }
	break;case 117: { var fn117 = function() {
	
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
}; fn117(); }
	break;case 118: { var fn118 = function() {
	
	halted = true;
regPairs[12]--;
}; fn118(); }
	break;case 119: { var fn119 = function() {
	
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
}; fn119(); }
	break;case 120: { var fn120 = function() {
	
	regs[1] = regs[3];
}; fn120(); }
	break;case 121: { var fn121 = function() {
	
	regs[1] = regs[2];
}; fn121(); }
	break;case 122: { var fn122 = function() {
	
	regs[1] = regs[5];
}; fn122(); }
	break;case 123: { var fn123 = function() {
	
	regs[1] = regs[4];
}; fn123(); }
	break;case 124: { var fn124 = function() {
	
	regs[1] = regs[19];
}; fn124(); }
	break;case 125: { var fn125 = function() {
	
	regs[1] = regs[18];
}; fn125(); }
	break;case 126: { var fn126 = function() {
	
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
}; fn126(); }
	break;case 127: { var fn127 = function() {
	
	regs[1] = regs[1];
}; fn127(); }
	break;case 128: { var fn128 = function() {
	
	

var addtemp = regs[1] + regs[3];
var lookup = ( (regs[1] & 0x88) >> 3 ) | ( (regs[3] & 0x88) >> 2 ) | ( (addtemp & 0x88) >> 1 );
regs[1] = addtemp;
regs[0] = ( addtemp & 0x100 ? 1 : 0 ) | halfcarryAddTable[lookup & 0x07] | overflowAddTable[lookup >> 4] | sz53Table[regs[1]];
}; fn128(); }
	break;case 129: { var fn129 = function() {
	
	

var addtemp = regs[1] + regs[2];
var lookup = ( (regs[1] & 0x88) >> 3 ) | ( (regs[2] & 0x88) >> 2 ) | ( (addtemp & 0x88) >> 1 );
regs[1] = addtemp;
regs[0] = ( addtemp & 0x100 ? 1 : 0 ) | halfcarryAddTable[lookup & 0x07] | overflowAddTable[lookup >> 4] | sz53Table[regs[1]];
}; fn129(); }
	break;case 130: { var fn130 = function() {
	
	

var addtemp = regs[1] + regs[5];
var lookup = ( (regs[1] & 0x88) >> 3 ) | ( (regs[5] & 0x88) >> 2 ) | ( (addtemp & 0x88) >> 1 );
regs[1] = addtemp;
regs[0] = ( addtemp & 0x100 ? 1 : 0 ) | halfcarryAddTable[lookup & 0x07] | overflowAddTable[lookup >> 4] | sz53Table[regs[1]];
}; fn130(); }
	break;case 131: { var fn131 = function() {
	
	

var addtemp = regs[1] + regs[4];
var lookup = ( (regs[1] & 0x88) >> 3 ) | ( (regs[4] & 0x88) >> 2 ) | ( (addtemp & 0x88) >> 1 );
regs[1] = addtemp;
regs[0] = ( addtemp & 0x100 ? 1 : 0 ) | halfcarryAddTable[lookup & 0x07] | overflowAddTable[lookup >> 4] | sz53Table[regs[1]];
}; fn131(); }
	break;case 132: { var fn132 = function() {
	
	

var addtemp = regs[1] + regs[19];
var lookup = ( (regs[1] & 0x88) >> 3 ) | ( (regs[19] & 0x88) >> 2 ) | ( (addtemp & 0x88) >> 1 );
regs[1] = addtemp;
regs[0] = ( addtemp & 0x100 ? 1 : 0 ) | halfcarryAddTable[lookup & 0x07] | overflowAddTable[lookup >> 4] | sz53Table[regs[1]];
}; fn132(); }
	break;case 133: { var fn133 = function() {
	
	

var addtemp = regs[1] + regs[18];
var lookup = ( (regs[1] & 0x88) >> 3 ) | ( (regs[18] & 0x88) >> 2 ) | ( (addtemp & 0x88) >> 1 );
regs[1] = addtemp;
regs[0] = ( addtemp & 0x100 ? 1 : 0 ) | halfcarryAddTable[lookup & 0x07] | overflowAddTable[lookup >> 4] | sz53Table[regs[1]];
}; fn133(); }
	break;case 134: { var fn134 = function() {
	
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
}; fn134(); }
	break;case 135: { var fn135 = function() {
	
	

var addtemp = regs[1] + regs[1];
var lookup = ( (regs[1] & 0x88) >> 3 ) | ( (regs[1] & 0x88) >> 2 ) | ( (addtemp & 0x88) >> 1 );
regs[1] = addtemp;
regs[0] = ( addtemp & 0x100 ? 1 : 0 ) | halfcarryAddTable[lookup & 0x07] | overflowAddTable[lookup >> 4] | sz53Table[regs[1]];
}; fn135(); }
	break;case 136: { var fn136 = function() {
	
	

var adctemp = regs[1] + regs[3] + (regs[0] & 1);
var lookup = ( (regs[1] & 0x88) >> 3 ) | ( (regs[3] & 0x88) >> 2 ) | ( (adctemp & 0x88) >> 1 );
regs[1] = adctemp;
regs[0] = ( adctemp & 0x100 ? 1 : 0 ) | halfcarryAddTable[lookup & 0x07] | overflowAddTable[lookup >> 4] | sz53Table[regs[1]];
}; fn136(); }
	break;case 137: { var fn137 = function() {
	
	

var adctemp = regs[1] + regs[2] + (regs[0] & 1);
var lookup = ( (regs[1] & 0x88) >> 3 ) | ( (regs[2] & 0x88) >> 2 ) | ( (adctemp & 0x88) >> 1 );
regs[1] = adctemp;
regs[0] = ( adctemp & 0x100 ? 1 : 0 ) | halfcarryAddTable[lookup & 0x07] | overflowAddTable[lookup >> 4] | sz53Table[regs[1]];
}; fn137(); }
	break;case 138: { var fn138 = function() {
	
	

var adctemp = regs[1] + regs[5] + (regs[0] & 1);
var lookup = ( (regs[1] & 0x88) >> 3 ) | ( (regs[5] & 0x88) >> 2 ) | ( (adctemp & 0x88) >> 1 );
regs[1] = adctemp;
regs[0] = ( adctemp & 0x100 ? 1 : 0 ) | halfcarryAddTable[lookup & 0x07] | overflowAddTable[lookup >> 4] | sz53Table[regs[1]];
}; fn138(); }
	break;case 139: { var fn139 = function() {
	
	

var adctemp = regs[1] + regs[4] + (regs[0] & 1);
var lookup = ( (regs[1] & 0x88) >> 3 ) | ( (regs[4] & 0x88) >> 2 ) | ( (adctemp & 0x88) >> 1 );
regs[1] = adctemp;
regs[0] = ( adctemp & 0x100 ? 1 : 0 ) | halfcarryAddTable[lookup & 0x07] | overflowAddTable[lookup >> 4] | sz53Table[regs[1]];
}; fn139(); }
	break;case 140: { var fn140 = function() {
	
	

var adctemp = regs[1] + regs[19] + (regs[0] & 1);
var lookup = ( (regs[1] & 0x88) >> 3 ) | ( (regs[19] & 0x88) >> 2 ) | ( (adctemp & 0x88) >> 1 );
regs[1] = adctemp;
regs[0] = ( adctemp & 0x100 ? 1 : 0 ) | halfcarryAddTable[lookup & 0x07] | overflowAddTable[lookup >> 4] | sz53Table[regs[1]];
}; fn140(); }
	break;case 141: { var fn141 = function() {
	
	

var adctemp = regs[1] + regs[18] + (regs[0] & 1);
var lookup = ( (regs[1] & 0x88) >> 3 ) | ( (regs[18] & 0x88) >> 2 ) | ( (adctemp & 0x88) >> 1 );
regs[1] = adctemp;
regs[0] = ( adctemp & 0x100 ? 1 : 0 ) | halfcarryAddTable[lookup & 0x07] | overflowAddTable[lookup >> 4] | sz53Table[regs[1]];
}; fn141(); }
	break;case 142: { var fn142 = function() {
	
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
}; fn142(); }
	break;case 143: { var fn143 = function() {
	
	

var adctemp = regs[1] + regs[1] + (regs[0] & 1);
var lookup = ( (regs[1] & 0x88) >> 3 ) | ( (regs[1] & 0x88) >> 2 ) | ( (adctemp & 0x88) >> 1 );
regs[1] = adctemp;
regs[0] = ( adctemp & 0x100 ? 1 : 0 ) | halfcarryAddTable[lookup & 0x07] | overflowAddTable[lookup >> 4] | sz53Table[regs[1]];
}; fn143(); }
	break;case 144: { var fn144 = function() {
	
	
var subtemp = regs[1] - regs[3];
var lookup = ( (regs[1] & 0x88) >> 3 ) | ( (regs[3] & 0x88) >> 2 ) | ( (subtemp & 0x88) >> 1 );
regs[1] = subtemp;
regs[0] = ( subtemp & 0x100 ? 1 : 0 ) | 2 | halfcarrySubTable[lookup & 0x07] | overflowSubTable[lookup >> 4] | sz53Table[regs[1]];
}; fn144(); }
	break;case 145: { var fn145 = function() {
	
	
var subtemp = regs[1] - regs[2];
var lookup = ( (regs[1] & 0x88) >> 3 ) | ( (regs[2] & 0x88) >> 2 ) | ( (subtemp & 0x88) >> 1 );
regs[1] = subtemp;
regs[0] = ( subtemp & 0x100 ? 1 : 0 ) | 2 | halfcarrySubTable[lookup & 0x07] | overflowSubTable[lookup >> 4] | sz53Table[regs[1]];
}; fn145(); }
	break;case 146: { var fn146 = function() {
	
	
var subtemp = regs[1] - regs[5];
var lookup = ( (regs[1] & 0x88) >> 3 ) | ( (regs[5] & 0x88) >> 2 ) | ( (subtemp & 0x88) >> 1 );
regs[1] = subtemp;
regs[0] = ( subtemp & 0x100 ? 1 : 0 ) | 2 | halfcarrySubTable[lookup & 0x07] | overflowSubTable[lookup >> 4] | sz53Table[regs[1]];
}; fn146(); }
	break;case 147: { var fn147 = function() {
	
	
var subtemp = regs[1] - regs[4];
var lookup = ( (regs[1] & 0x88) >> 3 ) | ( (regs[4] & 0x88) >> 2 ) | ( (subtemp & 0x88) >> 1 );
regs[1] = subtemp;
regs[0] = ( subtemp & 0x100 ? 1 : 0 ) | 2 | halfcarrySubTable[lookup & 0x07] | overflowSubTable[lookup >> 4] | sz53Table[regs[1]];
}; fn147(); }
	break;case 148: { var fn148 = function() {
	
	
var subtemp = regs[1] - regs[19];
var lookup = ( (regs[1] & 0x88) >> 3 ) | ( (regs[19] & 0x88) >> 2 ) | ( (subtemp & 0x88) >> 1 );
regs[1] = subtemp;
regs[0] = ( subtemp & 0x100 ? 1 : 0 ) | 2 | halfcarrySubTable[lookup & 0x07] | overflowSubTable[lookup >> 4] | sz53Table[regs[1]];
}; fn148(); }
	break;case 149: { var fn149 = function() {
	
	
var subtemp = regs[1] - regs[18];
var lookup = ( (regs[1] & 0x88) >> 3 ) | ( (regs[18] & 0x88) >> 2 ) | ( (subtemp & 0x88) >> 1 );
regs[1] = subtemp;
regs[0] = ( subtemp & 0x100 ? 1 : 0 ) | 2 | halfcarrySubTable[lookup & 0x07] | overflowSubTable[lookup >> 4] | sz53Table[regs[1]];
}; fn149(); }
	break;case 150: { var fn150 = function() {
	
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
}; fn150(); }
	break;case 151: { var fn151 = function() {
	
	
var subtemp = regs[1] - regs[1];
var lookup = ( (regs[1] & 0x88) >> 3 ) | ( (regs[1] & 0x88) >> 2 ) | ( (subtemp & 0x88) >> 1 );
regs[1] = subtemp;
regs[0] = ( subtemp & 0x100 ? 1 : 0 ) | 2 | halfcarrySubTable[lookup & 0x07] | overflowSubTable[lookup >> 4] | sz53Table[regs[1]];
}; fn151(); }
	break;case 152: { var fn152 = function() {
	
	
var sbctemp = regs[1] - regs[3] - (regs[0] & 1);
var lookup = ( (regs[1] & 0x88) >> 3 ) | ( (regs[3] & 0x88) >> 2 ) | ( (sbctemp & 0x88) >> 1 );
regs[1] = sbctemp;
regs[0] = ( sbctemp & 0x100 ? 1 : 0 ) | 2 | halfcarrySubTable[lookup & 0x07] | overflowSubTable[lookup >> 4] | sz53Table[regs[1]];
}; fn152(); }
	break;case 153: { var fn153 = function() {
	
	
var sbctemp = regs[1] - regs[2] - (regs[0] & 1);
var lookup = ( (regs[1] & 0x88) >> 3 ) | ( (regs[2] & 0x88) >> 2 ) | ( (sbctemp & 0x88) >> 1 );
regs[1] = sbctemp;
regs[0] = ( sbctemp & 0x100 ? 1 : 0 ) | 2 | halfcarrySubTable[lookup & 0x07] | overflowSubTable[lookup >> 4] | sz53Table[regs[1]];
}; fn153(); }
	break;case 154: { var fn154 = function() {
	
	
var sbctemp = regs[1] - regs[5] - (regs[0] & 1);
var lookup = ( (regs[1] & 0x88) >> 3 ) | ( (regs[5] & 0x88) >> 2 ) | ( (sbctemp & 0x88) >> 1 );
regs[1] = sbctemp;
regs[0] = ( sbctemp & 0x100 ? 1 : 0 ) | 2 | halfcarrySubTable[lookup & 0x07] | overflowSubTable[lookup >> 4] | sz53Table[regs[1]];
}; fn154(); }
	break;case 155: { var fn155 = function() {
	
	
var sbctemp = regs[1] - regs[4] - (regs[0] & 1);
var lookup = ( (regs[1] & 0x88) >> 3 ) | ( (regs[4] & 0x88) >> 2 ) | ( (sbctemp & 0x88) >> 1 );
regs[1] = sbctemp;
regs[0] = ( sbctemp & 0x100 ? 1 : 0 ) | 2 | halfcarrySubTable[lookup & 0x07] | overflowSubTable[lookup >> 4] | sz53Table[regs[1]];
}; fn155(); }
	break;case 156: { var fn156 = function() {
	
	
var sbctemp = regs[1] - regs[19] - (regs[0] & 1);
var lookup = ( (regs[1] & 0x88) >> 3 ) | ( (regs[19] & 0x88) >> 2 ) | ( (sbctemp & 0x88) >> 1 );
regs[1] = sbctemp;
regs[0] = ( sbctemp & 0x100 ? 1 : 0 ) | 2 | halfcarrySubTable[lookup & 0x07] | overflowSubTable[lookup >> 4] | sz53Table[regs[1]];
}; fn156(); }
	break;case 157: { var fn157 = function() {
	
	
var sbctemp = regs[1] - regs[18] - (regs[0] & 1);
var lookup = ( (regs[1] & 0x88) >> 3 ) | ( (regs[18] & 0x88) >> 2 ) | ( (sbctemp & 0x88) >> 1 );
regs[1] = sbctemp;
regs[0] = ( sbctemp & 0x100 ? 1 : 0 ) | 2 | halfcarrySubTable[lookup & 0x07] | overflowSubTable[lookup >> 4] | sz53Table[regs[1]];
}; fn157(); }
	break;case 158: { var fn158 = function() {
	
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
}; fn158(); }
	break;case 159: { var fn159 = function() {
	
	
var sbctemp = regs[1] - regs[1] - (regs[0] & 1);
var lookup = ( (regs[1] & 0x88) >> 3 ) | ( (regs[1] & 0x88) >> 2 ) | ( (sbctemp & 0x88) >> 1 );
regs[1] = sbctemp;
regs[0] = ( sbctemp & 0x100 ? 1 : 0 ) | 2 | halfcarrySubTable[lookup & 0x07] | overflowSubTable[lookup >> 4] | sz53Table[regs[1]];
}; fn159(); }
	break;case 160: { var fn160 = function() {
	
	

regs[1] &= regs[3];
regs[0] = 16 | sz53pTable[regs[1]];
}; fn160(); }
	break;case 161: { var fn161 = function() {
	
	

regs[1] &= regs[2];
regs[0] = 16 | sz53pTable[regs[1]];
}; fn161(); }
	break;case 162: { var fn162 = function() {
	
	

regs[1] &= regs[5];
regs[0] = 16 | sz53pTable[regs[1]];
}; fn162(); }
	break;case 163: { var fn163 = function() {
	
	

regs[1] &= regs[4];
regs[0] = 16 | sz53pTable[regs[1]];
}; fn163(); }
	break;case 164: { var fn164 = function() {
	
	

regs[1] &= regs[19];
regs[0] = 16 | sz53pTable[regs[1]];
}; fn164(); }
	break;case 165: { var fn165 = function() {
	
	

regs[1] &= regs[18];
regs[0] = 16 | sz53pTable[regs[1]];
}; fn165(); }
	break;case 166: { var fn166 = function() {
	
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
}; fn166(); }
	break;case 167: { var fn167 = function() {
	
	

regs[1] &= regs[1];
regs[0] = 16 | sz53pTable[regs[1]];
}; fn167(); }
	break;case 168: { var fn168 = function() {
	
	
regs[1] ^= regs[3];
regs[0] = sz53pTable[regs[1]];
}; fn168(); }
	break;case 169: { var fn169 = function() {
	
	
regs[1] ^= regs[2];
regs[0] = sz53pTable[regs[1]];
}; fn169(); }
	break;case 170: { var fn170 = function() {
	
	
regs[1] ^= regs[5];
regs[0] = sz53pTable[regs[1]];
}; fn170(); }
	break;case 171: { var fn171 = function() {
	
	
regs[1] ^= regs[4];
regs[0] = sz53pTable[regs[1]];
}; fn171(); }
	break;case 172: { var fn172 = function() {
	
	
regs[1] ^= regs[19];
regs[0] = sz53pTable[regs[1]];
}; fn172(); }
	break;case 173: { var fn173 = function() {
	
	
regs[1] ^= regs[18];
regs[0] = sz53pTable[regs[1]];
}; fn173(); }
	break;case 174: { var fn174 = function() {
	
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
}; fn174(); }
	break;case 175: { var fn175 = function() {
	
	
regs[1] ^= regs[1];
regs[0] = sz53pTable[regs[1]];
}; fn175(); }
	break;case 176: { var fn176 = function() {
	
	

regs[1] |= regs[3];
regs[0] = sz53pTable[regs[1]];
}; fn176(); }
	break;case 177: { var fn177 = function() {
	
	

regs[1] |= regs[2];
regs[0] = sz53pTable[regs[1]];
}; fn177(); }
	break;case 178: { var fn178 = function() {
	
	

regs[1] |= regs[5];
regs[0] = sz53pTable[regs[1]];
}; fn178(); }
	break;case 179: { var fn179 = function() {
	
	

regs[1] |= regs[4];
regs[0] = sz53pTable[regs[1]];
}; fn179(); }
	break;case 180: { var fn180 = function() {
	
	

regs[1] |= regs[19];
regs[0] = sz53pTable[regs[1]];
}; fn180(); }
	break;case 181: { var fn181 = function() {
	
	

regs[1] |= regs[18];
regs[0] = sz53pTable[regs[1]];
}; fn181(); }
	break;case 182: { var fn182 = function() {
	
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
}; fn182(); }
	break;case 183: { var fn183 = function() {
	
	

regs[1] |= regs[1];
regs[0] = sz53pTable[regs[1]];
}; fn183(); }
	break;case 184: { var fn184 = function() {
	
	

var cptemp = regs[1] - regs[3];
var lookup = ( (regs[1] & 0x88) >> 3 ) | ( (regs[3] & 0x88) >> 2 ) | ( (cptemp & 0x88) >> 1 );
regs[0] = ( cptemp & 0x100 ? 1 : ( cptemp ? 0 : 64 ) ) | 2 | halfcarrySubTable[lookup & 0x07] | overflowSubTable[lookup >> 4] | ( regs[3] & 40 ) | ( cptemp & 128 );
}; fn184(); }
	break;case 185: { var fn185 = function() {
	
	

var cptemp = regs[1] - regs[2];
var lookup = ( (regs[1] & 0x88) >> 3 ) | ( (regs[2] & 0x88) >> 2 ) | ( (cptemp & 0x88) >> 1 );
regs[0] = ( cptemp & 0x100 ? 1 : ( cptemp ? 0 : 64 ) ) | 2 | halfcarrySubTable[lookup & 0x07] | overflowSubTable[lookup >> 4] | ( regs[2] & 40 ) | ( cptemp & 128 );
}; fn185(); }
	break;case 186: { var fn186 = function() {
	
	

var cptemp = regs[1] - regs[5];
var lookup = ( (regs[1] & 0x88) >> 3 ) | ( (regs[5] & 0x88) >> 2 ) | ( (cptemp & 0x88) >> 1 );
regs[0] = ( cptemp & 0x100 ? 1 : ( cptemp ? 0 : 64 ) ) | 2 | halfcarrySubTable[lookup & 0x07] | overflowSubTable[lookup >> 4] | ( regs[5] & 40 ) | ( cptemp & 128 );
}; fn186(); }
	break;case 187: { var fn187 = function() {
	
	

var cptemp = regs[1] - regs[4];
var lookup = ( (regs[1] & 0x88) >> 3 ) | ( (regs[4] & 0x88) >> 2 ) | ( (cptemp & 0x88) >> 1 );
regs[0] = ( cptemp & 0x100 ? 1 : ( cptemp ? 0 : 64 ) ) | 2 | halfcarrySubTable[lookup & 0x07] | overflowSubTable[lookup >> 4] | ( regs[4] & 40 ) | ( cptemp & 128 );
}; fn187(); }
	break;case 188: { var fn188 = function() {
	
	

var cptemp = regs[1] - regs[19];
var lookup = ( (regs[1] & 0x88) >> 3 ) | ( (regs[19] & 0x88) >> 2 ) | ( (cptemp & 0x88) >> 1 );
regs[0] = ( cptemp & 0x100 ? 1 : ( cptemp ? 0 : 64 ) ) | 2 | halfcarrySubTable[lookup & 0x07] | overflowSubTable[lookup >> 4] | ( regs[19] & 40 ) | ( cptemp & 128 );
}; fn188(); }
	break;case 189: { var fn189 = function() {
	
	

var cptemp = regs[1] - regs[18];
var lookup = ( (regs[1] & 0x88) >> 3 ) | ( (regs[18] & 0x88) >> 2 ) | ( (cptemp & 0x88) >> 1 );
regs[0] = ( cptemp & 0x100 ? 1 : ( cptemp ? 0 : 64 ) ) | 2 | halfcarrySubTable[lookup & 0x07] | overflowSubTable[lookup >> 4] | ( regs[18] & 40 ) | ( cptemp & 128 );
}; fn189(); }
	break;case 190: { var fn190 = function() {
	
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
}; fn190(); }
	break;case 191: { var fn191 = function() {
	
	

var cptemp = regs[1] - regs[1];
var lookup = ( (regs[1] & 0x88) >> 3 ) | ( (regs[1] & 0x88) >> 2 ) | ( (cptemp & 0x88) >> 1 );
regs[0] = ( cptemp & 0x100 ? 1 : ( cptemp ? 0 : 64 ) ) | 2 | halfcarrySubTable[lookup & 0x07] | overflowSubTable[lookup >> 4] | ( regs[1] & 40 ) | ( cptemp & 128 );
}; fn191(); }
	break;case 192: { var fn192 = function() {
	
	tstates += ( 1);
if (!(regs[0] & 64)) {
	var l = (tstates += ( 3), memory.read(regPairs[11])); regPairs[11]++;
	var h = (tstates += ( 3), memory.read(regPairs[11])); regPairs[11]++;
	regPairs[12] = (h<<8) | l;
}
}; fn192(); }
	break;case 193: { var fn193 = function() {
	
	var l = (tstates += ( 3), memory.read(regPairs[11])); regPairs[11]++;
var h = (tstates += ( 3), memory.read(regPairs[11])); regPairs[11]++;
regPairs[1] = (h<<8) | l;
}; fn193(); }
	break;case 194: { var fn194 = function() {
	
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
}; fn194(); }
	break;case 195: { var fn195 = function() {
	
	var l = (tstates += ( 3), memory.read(regPairs[12])); regPairs[12]++;
var h = (tstates += ( 3), memory.read(regPairs[12])); regPairs[12]++;
regPairs[12] = (h<<8) | l;
}; fn195(); }
	break;case 196: { var fn196 = function() {
	
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
}; fn196(); }
	break;case 197: { var fn197 = function() {
	
	tstates += ( 1);
regPairs[11]--; tstates += ( 3);
while (display.nextEventTime != null && display.nextEventTime < tstates) display.doEvent();
memory.write(regPairs[11], regPairs[1] >> 8);;
regPairs[11]--; tstates += ( 3);
while (display.nextEventTime != null && display.nextEventTime < tstates) display.doEvent();
memory.write(regPairs[11], regPairs[1] & 0xff);;
}; fn197(); }
	break;case 198: { var fn198 = function() {
	
	var val = (tstates += ( 3), memory.read(regPairs[12])); regPairs[12]++;

var addtemp = regs[1] + val;
var lookup = ( (regs[1] & 0x88) >> 3 ) | ( (val & 0x88) >> 2 ) | ( (addtemp & 0x88) >> 1 );
regs[1] = addtemp;
regs[0] = ( addtemp & 0x100 ? 1 : 0 ) | halfcarryAddTable[lookup & 0x07] | overflowAddTable[lookup >> 4] | sz53Table[regs[1]];
}; fn198(); }
	break;case 199: { var fn199 = function() {
	
	tstates += ( 1);
regPairs[11]--; tstates += ( 3);
while (display.nextEventTime != null && display.nextEventTime < tstates) display.doEvent();
memory.write(regPairs[11], regPairs[12] >> 8);;
regPairs[11]--; tstates += ( 3);
while (display.nextEventTime != null && display.nextEventTime < tstates) display.doEvent();
memory.write(regPairs[11], regPairs[12] & 0xff);;
regPairs[12] = 0;
}; fn199(); }
	break;case 200: { var fn200 = function() {
	
	tstates += ( 1);
if (regs[0] & 64) {
	var l = (tstates += ( 3), memory.read(regPairs[11])); regPairs[11]++;
	var h = (tstates += ( 3), memory.read(regPairs[11])); regPairs[11]++;
	regPairs[12] = (h<<8) | l;
}
}; fn200(); }
	break;case 201: { var fn201 = function() {
	
	var l = (tstates += ( 3), memory.read(regPairs[11])); regPairs[11]++;
var h = (tstates += ( 3), memory.read(regPairs[11])); regPairs[11]++;
regPairs[12] = (h<<8) | l;
}; fn201(); }
	break;case 202: { var fn202 = function() {
	
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
}; fn202(); }
	break;case 203: { var fn203 = function() {
	
	opcodePrefix = 'FDCB';
interruptible = false;
}; fn203(); }
	break;case 204: { var fn204 = function() {
	
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
}; fn204(); }
	break;case 205: { var fn205 = function() {
	
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
}; fn205(); }
	break;case 206: { var fn206 = function() {
	
	var val = (tstates += ( 3), memory.read(regPairs[12])); regPairs[12]++;

var adctemp = regs[1] + val + (regs[0] & 1);
var lookup = ( (regs[1] & 0x88) >> 3 ) | ( (val & 0x88) >> 2 ) | ( (adctemp & 0x88) >> 1 );
regs[1] = adctemp;
regs[0] = ( adctemp & 0x100 ? 1 : 0 ) | halfcarryAddTable[lookup & 0x07] | overflowAddTable[lookup >> 4] | sz53Table[regs[1]];
}; fn206(); }
	break;case 207: { var fn207 = function() {
	
	tstates += ( 1);
regPairs[11]--; tstates += ( 3);
while (display.nextEventTime != null && display.nextEventTime < tstates) display.doEvent();
memory.write(regPairs[11], regPairs[12] >> 8);;
regPairs[11]--; tstates += ( 3);
while (display.nextEventTime != null && display.nextEventTime < tstates) display.doEvent();
memory.write(regPairs[11], regPairs[12] & 0xff);;
regPairs[12] = 8;
}; fn207(); }
	break;case 208: { var fn208 = function() {
	
	tstates += ( 1);
if (!(regs[0] & 1)) {
	var l = (tstates += ( 3), memory.read(regPairs[11])); regPairs[11]++;
	var h = (tstates += ( 3), memory.read(regPairs[11])); regPairs[11]++;
	regPairs[12] = (h<<8) | l;
}
}; fn208(); }
	break;case 209: { var fn209 = function() {
	
	var l = (tstates += ( 3), memory.read(regPairs[11])); regPairs[11]++;
var h = (tstates += ( 3), memory.read(regPairs[11])); regPairs[11]++;
regPairs[2] = (h<<8) | l;
}; fn209(); }
	break;case 210: { var fn210 = function() {
	
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
}; fn210(); }
	break;case 211: { var fn211 = function() {
	
	var port = (regs[1] << 8) | (tstates += ( 3), memory.read(regPairs[12])); regPairs[12]++;
tstates += 1;
ioBus.write(port, regs[1], tstates);
tstates += 3;
}; fn211(); }
	break;case 212: { var fn212 = function() {
	
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
}; fn212(); }
	break;case 213: { var fn213 = function() {
	
	tstates += ( 1);
regPairs[11]--; tstates += ( 3);
while (display.nextEventTime != null && display.nextEventTime < tstates) display.doEvent();
memory.write(regPairs[11], regPairs[2] >> 8);;
regPairs[11]--; tstates += ( 3);
while (display.nextEventTime != null && display.nextEventTime < tstates) display.doEvent();
memory.write(regPairs[11], regPairs[2] & 0xff);;
}; fn213(); }
	break;case 214: { var fn214 = function() {
	
	var val = (tstates += ( 3), memory.read(regPairs[12])); regPairs[12]++;
var subtemp = regs[1] - val;
var lookup = ( (regs[1] & 0x88) >> 3 ) | ( (val & 0x88) >> 2 ) | ( (subtemp & 0x88) >> 1 );
regs[1] = subtemp;
regs[0] = ( subtemp & 0x100 ? 1 : 0 ) | 2 | halfcarrySubTable[lookup & 0x07] | overflowSubTable[lookup >> 4] | sz53Table[regs[1]];
}; fn214(); }
	break;case 215: { var fn215 = function() {
	
	tstates += ( 1);
regPairs[11]--; tstates += ( 3);
while (display.nextEventTime != null && display.nextEventTime < tstates) display.doEvent();
memory.write(regPairs[11], regPairs[12] >> 8);;
regPairs[11]--; tstates += ( 3);
while (display.nextEventTime != null && display.nextEventTime < tstates) display.doEvent();
memory.write(regPairs[11], regPairs[12] & 0xff);;
regPairs[12] = 16;
}; fn215(); }
	break;case 216: { var fn216 = function() {
	
	tstates += ( 1);
if (regs[0] & 1) {
	var l = (tstates += ( 3), memory.read(regPairs[11])); regPairs[11]++;
	var h = (tstates += ( 3), memory.read(regPairs[11])); regPairs[11]++;
	regPairs[12] = (h<<8) | l;
}
}; fn216(); }
	break;case 217: { var fn217 = function() {
	
	var wordtemp;
wordtemp = regPairs[1]; regPairs[1] = regPairs[5]; regPairs[5] = wordtemp;
wordtemp = regPairs[2]; regPairs[2] = regPairs[6]; regPairs[6] = wordtemp;
wordtemp = regPairs[3]; regPairs[3] = regPairs[7]; regPairs[7] = wordtemp;
}; fn217(); }
	break;case 218: { var fn218 = function() {
	
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
}; fn218(); }
	break;case 219: { var fn219 = function() {
	
	var val = (tstates += ( 3), memory.read(regPairs[12])); regPairs[12]++;
var port = (regs[1] << 8) | val;
tstates += 1;
regs[1] = ioBus.read(port);
tstates += 3;
}; fn219(); }
	break;case 220: { var fn220 = function() {
	
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
}; fn220(); }
	break;case 221: { var fn221 = function() {
	
	opcodePrefix = 'DD';
interruptible = false;
}; fn221(); }
	break;case 222: { var fn222 = function() {
	
	var val = (tstates += ( 3), memory.read(regPairs[12])); regPairs[12]++;
var sbctemp = regs[1] - val - (regs[0] & 1);
var lookup = ( (regs[1] & 0x88) >> 3 ) | ( (val & 0x88) >> 2 ) | ( (sbctemp & 0x88) >> 1 );
regs[1] = sbctemp;
regs[0] = ( sbctemp & 0x100 ? 1 : 0 ) | 2 | halfcarrySubTable[lookup & 0x07] | overflowSubTable[lookup >> 4] | sz53Table[regs[1]];
}; fn222(); }
	break;case 223: { var fn223 = function() {
	
	tstates += ( 1);
regPairs[11]--; tstates += ( 3);
while (display.nextEventTime != null && display.nextEventTime < tstates) display.doEvent();
memory.write(regPairs[11], regPairs[12] >> 8);;
regPairs[11]--; tstates += ( 3);
while (display.nextEventTime != null && display.nextEventTime < tstates) display.doEvent();
memory.write(regPairs[11], regPairs[12] & 0xff);;
regPairs[12] = 24;
}; fn223(); }
	break;case 224: { var fn224 = function() {
	
	tstates += ( 1);
if (!(regs[0] & 4)) {
	var l = (tstates += ( 3), memory.read(regPairs[11])); regPairs[11]++;
	var h = (tstates += ( 3), memory.read(regPairs[11])); regPairs[11]++;
	regPairs[12] = (h<<8) | l;
}
}; fn224(); }
	break;case 225: { var fn225 = function() {
	
	var l = (tstates += ( 3), memory.read(regPairs[11])); regPairs[11]++;
var h = (tstates += ( 3), memory.read(regPairs[11])); regPairs[11]++;
regPairs[9] = (h<<8) | l;
}; fn225(); }
	break;case 226: { var fn226 = function() {
	
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
}; fn226(); }
	break;case 227: { var fn227 = function() {
	
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
}; fn227(); }
	break;case 228: { var fn228 = function() {
	
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
}; fn228(); }
	break;case 229: { var fn229 = function() {
	
	tstates += ( 1);
regPairs[11]--; tstates += ( 3);
while (display.nextEventTime != null && display.nextEventTime < tstates) display.doEvent();
memory.write(regPairs[11], regPairs[9] >> 8);;
regPairs[11]--; tstates += ( 3);
while (display.nextEventTime != null && display.nextEventTime < tstates) display.doEvent();
memory.write(regPairs[11], regPairs[9] & 0xff);;
}; fn229(); }
	break;case 230: { var fn230 = function() {
	
	var val = (tstates += ( 3), memory.read(regPairs[12])); regPairs[12]++;

regs[1] &= val;
regs[0] = 16 | sz53pTable[regs[1]];
}; fn230(); }
	break;case 231: { var fn231 = function() {
	
	tstates += ( 1);
regPairs[11]--; tstates += ( 3);
while (display.nextEventTime != null && display.nextEventTime < tstates) display.doEvent();
memory.write(regPairs[11], regPairs[12] >> 8);;
regPairs[11]--; tstates += ( 3);
while (display.nextEventTime != null && display.nextEventTime < tstates) display.doEvent();
memory.write(regPairs[11], regPairs[12] & 0xff);;
regPairs[12] = 32;
}; fn231(); }
	break;case 232: { var fn232 = function() {
	
	tstates += ( 1);
if (regs[0] & 4) {
	var l = (tstates += ( 3), memory.read(regPairs[11])); regPairs[11]++;
	var h = (tstates += ( 3), memory.read(regPairs[11])); regPairs[11]++;
	regPairs[12] = (h<<8) | l;
}
}; fn232(); }
	break;case 233: { var fn233 = function() {
	
	regPairs[12] = regPairs[9];
}; fn233(); }
	break;case 234: { var fn234 = function() {
	
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
}; fn234(); }
	break;case 235: { var fn235 = function() {
	
	var temp = regPairs[2];
regPairs[2] = regPairs[3];
regPairs[3] = temp;
}; fn235(); }
	break;case 236: { var fn236 = function() {
	
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
}; fn236(); }
	break;case 237: { var fn237 = function() {
	
	opcodePrefix = 'ED';
interruptible = false;
}; fn237(); }
	break;case 238: { var fn238 = function() {
	
	var val = (tstates += ( 3), memory.read(regPairs[12])); regPairs[12]++;
regs[1] ^= val;
regs[0] = sz53pTable[regs[1]];
}; fn238(); }
	break;case 239: { var fn239 = function() {
	
	tstates += ( 1);
regPairs[11]--; tstates += ( 3);
while (display.nextEventTime != null && display.nextEventTime < tstates) display.doEvent();
memory.write(regPairs[11], regPairs[12] >> 8);;
regPairs[11]--; tstates += ( 3);
while (display.nextEventTime != null && display.nextEventTime < tstates) display.doEvent();
memory.write(regPairs[11], regPairs[12] & 0xff);;
regPairs[12] = 40;
}; fn239(); }
	break;case 240: { var fn240 = function() {
	
	tstates += ( 1);
if (!(regs[0] & 128)) {
	var l = (tstates += ( 3), memory.read(regPairs[11])); regPairs[11]++;
	var h = (tstates += ( 3), memory.read(regPairs[11])); regPairs[11]++;
	regPairs[12] = (h<<8) | l;
}
}; fn240(); }
	break;case 241: { var fn241 = function() {
	
	var l = (tstates += ( 3), memory.read(regPairs[11])); regPairs[11]++;
var h = (tstates += ( 3), memory.read(regPairs[11])); regPairs[11]++;
regPairs[0] = (h<<8) | l;
}; fn241(); }
	break;case 242: { var fn242 = function() {
	
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
}; fn242(); }
	break;case 243: { var fn243 = function() {
	
	iff1 = iff2 = 0;
}; fn243(); }
	break;case 244: { var fn244 = function() {
	
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
}; fn244(); }
	break;case 245: { var fn245 = function() {
	
	tstates += ( 1);
regPairs[11]--; tstates += ( 3);
while (display.nextEventTime != null && display.nextEventTime < tstates) display.doEvent();
memory.write(regPairs[11], regPairs[0] >> 8);;
regPairs[11]--; tstates += ( 3);
while (display.nextEventTime != null && display.nextEventTime < tstates) display.doEvent();
memory.write(regPairs[11], regPairs[0] & 0xff);;
}; fn245(); }
	break;case 246: { var fn246 = function() {
	
	var val = (tstates += ( 3), memory.read(regPairs[12])); regPairs[12]++;

regs[1] |= val;
regs[0] = sz53pTable[regs[1]];
}; fn246(); }
	break;case 247: { var fn247 = function() {
	
	tstates += ( 1);
regPairs[11]--; tstates += ( 3);
while (display.nextEventTime != null && display.nextEventTime < tstates) display.doEvent();
memory.write(regPairs[11], regPairs[12] >> 8);;
regPairs[11]--; tstates += ( 3);
while (display.nextEventTime != null && display.nextEventTime < tstates) display.doEvent();
memory.write(regPairs[11], regPairs[12] & 0xff);;
regPairs[12] = 48;
}; fn247(); }
	break;case 248: { var fn248 = function() {
	
	tstates += ( 1);
if (regs[0] & 128) {
	var l = (tstates += ( 3), memory.read(regPairs[11])); regPairs[11]++;
	var h = (tstates += ( 3), memory.read(regPairs[11])); regPairs[11]++;
	regPairs[12] = (h<<8) | l;
}
}; fn248(); }
	break;case 249: { var fn249 = function() {
	
	regPairs[11] = regPairs[9];
tstates += ( 1);
tstates += ( 1);
}; fn249(); }
	break;case 250: { var fn250 = function() {
	
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
}; fn250(); }
	break;case 251: { var fn251 = function() {
	
	iff1 = iff2 = 1;
interruptible = false;
}; fn251(); }
	break;case 252: { var fn252 = function() {
	
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
}; fn252(); }
	break;case 253: { var fn253 = function() {
	
	opcodePrefix = 'FD';
interruptible = false;
}; fn253(); }
	break;case 254: { var fn254 = function() {
	
	var val = (tstates += ( 3), memory.read(regPairs[12])); regPairs[12]++;

var cptemp = regs[1] - val;
var lookup = ( (regs[1] & 0x88) >> 3 ) | ( (val & 0x88) >> 2 ) | ( (cptemp & 0x88) >> 1 );
regs[0] = ( cptemp & 0x100 ? 1 : ( cptemp ? 0 : 64 ) ) | 2 | halfcarrySubTable[lookup & 0x07] | overflowSubTable[lookup >> 4] | ( val & 40 ) | ( cptemp & 128 );
}; fn254(); }
	break;case 255: { var fn255 = function() {
	
	tstates += ( 1);
regPairs[11]--; tstates += ( 3);
while (display.nextEventTime != null && display.nextEventTime < tstates) display.doEvent();
memory.write(regPairs[11], regPairs[12] >> 8);;
regPairs[11]--; tstates += ( 3);
while (display.nextEventTime != null && display.nextEventTime < tstates) display.doEvent();
memory.write(regPairs[11], regPairs[12] & 0xff);;
regPairs[12] = 56;
}; fn255(); }
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
	case 0: { var fn0 = function() {
	
	var addr = (regPairs[9] + offset) & 0xffff;
regs[3] = (tstates += ( 3), memory.read(addr));

regs[3] = ( (regs[3] << 1) | (regs[3] >> 7) ) ;
regs[0] = (regs[3] & 1) | sz53pTable[regs[3]];

tstates += ( 1);
tstates += ( 3);
while (display.nextEventTime != null && display.nextEventTime < tstates) display.doEvent();
memory.write(addr, regs[3]);;
}; fn0(); }
	break;case 1: { var fn1 = function() {
	
	var addr = (regPairs[9] + offset) & 0xffff;
regs[2] = (tstates += ( 3), memory.read(addr));

regs[2] = ( (regs[2] << 1) | (regs[2] >> 7) ) ;
regs[0] = (regs[2] & 1) | sz53pTable[regs[2]];

tstates += ( 1);
tstates += ( 3);
while (display.nextEventTime != null && display.nextEventTime < tstates) display.doEvent();
memory.write(addr, regs[2]);;
}; fn1(); }
	break;case 2: { var fn2 = function() {
	
	var addr = (regPairs[9] + offset) & 0xffff;
regs[5] = (tstates += ( 3), memory.read(addr));

regs[5] = ( (regs[5] << 1) | (regs[5] >> 7) ) ;
regs[0] = (regs[5] & 1) | sz53pTable[regs[5]];

tstates += ( 1);
tstates += ( 3);
while (display.nextEventTime != null && display.nextEventTime < tstates) display.doEvent();
memory.write(addr, regs[5]);;
}; fn2(); }
	break;case 3: { var fn3 = function() {
	
	var addr = (regPairs[9] + offset) & 0xffff;
regs[4] = (tstates += ( 3), memory.read(addr));

regs[4] = ( (regs[4] << 1) | (regs[4] >> 7) ) ;
regs[0] = (regs[4] & 1) | sz53pTable[regs[4]];

tstates += ( 1);
tstates += ( 3);
while (display.nextEventTime != null && display.nextEventTime < tstates) display.doEvent();
memory.write(addr, regs[4]);;
}; fn3(); }
	break;case 4: { var fn4 = function() {
	
	var addr = (regPairs[9] + offset) & 0xffff;
regs[7] = (tstates += ( 3), memory.read(addr));

regs[7] = ( (regs[7] << 1) | (regs[7] >> 7) ) ;
regs[0] = (regs[7] & 1) | sz53pTable[regs[7]];

tstates += ( 1);
tstates += ( 3);
while (display.nextEventTime != null && display.nextEventTime < tstates) display.doEvent();
memory.write(addr, regs[7]);;
}; fn4(); }
	break;case 5: { var fn5 = function() {
	
	var addr = (regPairs[9] + offset) & 0xffff;
regs[6] = (tstates += ( 3), memory.read(addr));

regs[6] = ( (regs[6] << 1) | (regs[6] >> 7) ) ;
regs[0] = (regs[6] & 1) | sz53pTable[regs[6]];

tstates += ( 1);
tstates += ( 3);
while (display.nextEventTime != null && display.nextEventTime < tstates) display.doEvent();
memory.write(addr, regs[6]);;
}; fn5(); }
	break;case 6: { var fn6 = function() {
	
	var addr = (regPairs[9] + offset) & 0xffff;
var val = (tstates += ( 3), memory.read(addr));
val = ( (val << 1) | (val >> 7) ) & 0xff;
regs[0] = (val & 1) | sz53pTable[val];
tstates += ( 1);
tstates += ( 3);
while (display.nextEventTime != null && display.nextEventTime < tstates) display.doEvent();
memory.write(addr, val);;
}; fn6(); }
	break;case 7: { var fn7 = function() {
	
	var addr = (regPairs[9] + offset) & 0xffff;
regs[1] = (tstates += ( 3), memory.read(addr));

regs[1] = ( (regs[1] << 1) | (regs[1] >> 7) ) ;
regs[0] = (regs[1] & 1) | sz53pTable[regs[1]];

tstates += ( 1);
tstates += ( 3);
while (display.nextEventTime != null && display.nextEventTime < tstates) display.doEvent();
memory.write(addr, regs[1]);;
}; fn7(); }
	break;case 8: { var fn8 = function() {
	
	var addr = (regPairs[9] + offset) & 0xffff;
regs[3] = (tstates += ( 3), memory.read(addr));

regs[0] = regs[3] & 1;
regs[3] = ( (regs[3] >> 1) | (regs[3] << 7) ) ;
regs[0] |= sz53pTable[regs[3]];

tstates += ( 1);
tstates += ( 3);
while (display.nextEventTime != null && display.nextEventTime < tstates) display.doEvent();
memory.write(addr, regs[3]);;
}; fn8(); }
	break;case 9: { var fn9 = function() {
	
	var addr = (regPairs[9] + offset) & 0xffff;
regs[2] = (tstates += ( 3), memory.read(addr));

regs[0] = regs[2] & 1;
regs[2] = ( (regs[2] >> 1) | (regs[2] << 7) ) ;
regs[0] |= sz53pTable[regs[2]];

tstates += ( 1);
tstates += ( 3);
while (display.nextEventTime != null && display.nextEventTime < tstates) display.doEvent();
memory.write(addr, regs[2]);;
}; fn9(); }
	break;case 10: { var fn10 = function() {
	
	var addr = (regPairs[9] + offset) & 0xffff;
regs[5] = (tstates += ( 3), memory.read(addr));

regs[0] = regs[5] & 1;
regs[5] = ( (regs[5] >> 1) | (regs[5] << 7) ) ;
regs[0] |= sz53pTable[regs[5]];

tstates += ( 1);
tstates += ( 3);
while (display.nextEventTime != null && display.nextEventTime < tstates) display.doEvent();
memory.write(addr, regs[5]);;
}; fn10(); }
	break;case 11: { var fn11 = function() {
	
	var addr = (regPairs[9] + offset) & 0xffff;
regs[4] = (tstates += ( 3), memory.read(addr));

regs[0] = regs[4] & 1;
regs[4] = ( (regs[4] >> 1) | (regs[4] << 7) ) ;
regs[0] |= sz53pTable[regs[4]];

tstates += ( 1);
tstates += ( 3);
while (display.nextEventTime != null && display.nextEventTime < tstates) display.doEvent();
memory.write(addr, regs[4]);;
}; fn11(); }
	break;case 12: { var fn12 = function() {
	
	var addr = (regPairs[9] + offset) & 0xffff;
regs[7] = (tstates += ( 3), memory.read(addr));

regs[0] = regs[7] & 1;
regs[7] = ( (regs[7] >> 1) | (regs[7] << 7) ) ;
regs[0] |= sz53pTable[regs[7]];

tstates += ( 1);
tstates += ( 3);
while (display.nextEventTime != null && display.nextEventTime < tstates) display.doEvent();
memory.write(addr, regs[7]);;
}; fn12(); }
	break;case 13: { var fn13 = function() {
	
	var addr = (regPairs[9] + offset) & 0xffff;
regs[6] = (tstates += ( 3), memory.read(addr));

regs[0] = regs[6] & 1;
regs[6] = ( (regs[6] >> 1) | (regs[6] << 7) ) ;
regs[0] |= sz53pTable[regs[6]];

tstates += ( 1);
tstates += ( 3);
while (display.nextEventTime != null && display.nextEventTime < tstates) display.doEvent();
memory.write(addr, regs[6]);;
}; fn13(); }
	break;case 14: { var fn14 = function() {
	
	var addr = (regPairs[9] + offset) & 0xffff;
var val = (tstates += ( 3), memory.read(addr));
regs[0] = val & 1;
val = ( (val >> 1) | (val << 7) ) & 0xff;
regs[0] |= sz53pTable[val];
tstates += ( 1);
tstates += ( 3);
while (display.nextEventTime != null && display.nextEventTime < tstates) display.doEvent();
memory.write(addr, val);;
}; fn14(); }
	break;case 15: { var fn15 = function() {
	
	var addr = (regPairs[9] + offset) & 0xffff;
regs[1] = (tstates += ( 3), memory.read(addr));

regs[0] = regs[1] & 1;
regs[1] = ( (regs[1] >> 1) | (regs[1] << 7) ) ;
regs[0] |= sz53pTable[regs[1]];

tstates += ( 1);
tstates += ( 3);
while (display.nextEventTime != null && display.nextEventTime < tstates) display.doEvent();
memory.write(addr, regs[1]);;
}; fn15(); }
	break;case 16: { var fn16 = function() {
	
	var addr = (regPairs[9] + offset) & 0xffff;
regs[3] = (tstates += ( 3), memory.read(addr));

var rltemp = regs[3];
regs[3] = ( (regs[3] << 1) | (regs[0] & 1) ) ;
regs[0] = ( rltemp >> 7 ) | sz53pTable[regs[3]];

tstates += ( 1);
tstates += ( 3);
while (display.nextEventTime != null && display.nextEventTime < tstates) display.doEvent();
memory.write(addr, regs[3]);;
}; fn16(); }
	break;case 17: { var fn17 = function() {
	
	var addr = (regPairs[9] + offset) & 0xffff;
regs[2] = (tstates += ( 3), memory.read(addr));

var rltemp = regs[2];
regs[2] = ( (regs[2] << 1) | (regs[0] & 1) ) ;
regs[0] = ( rltemp >> 7 ) | sz53pTable[regs[2]];

tstates += ( 1);
tstates += ( 3);
while (display.nextEventTime != null && display.nextEventTime < tstates) display.doEvent();
memory.write(addr, regs[2]);;
}; fn17(); }
	break;case 18: { var fn18 = function() {
	
	var addr = (regPairs[9] + offset) & 0xffff;
regs[5] = (tstates += ( 3), memory.read(addr));

var rltemp = regs[5];
regs[5] = ( (regs[5] << 1) | (regs[0] & 1) ) ;
regs[0] = ( rltemp >> 7 ) | sz53pTable[regs[5]];

tstates += ( 1);
tstates += ( 3);
while (display.nextEventTime != null && display.nextEventTime < tstates) display.doEvent();
memory.write(addr, regs[5]);;
}; fn18(); }
	break;case 19: { var fn19 = function() {
	
	var addr = (regPairs[9] + offset) & 0xffff;
regs[4] = (tstates += ( 3), memory.read(addr));

var rltemp = regs[4];
regs[4] = ( (regs[4] << 1) | (regs[0] & 1) ) ;
regs[0] = ( rltemp >> 7 ) | sz53pTable[regs[4]];

tstates += ( 1);
tstates += ( 3);
while (display.nextEventTime != null && display.nextEventTime < tstates) display.doEvent();
memory.write(addr, regs[4]);;
}; fn19(); }
	break;case 20: { var fn20 = function() {
	
	var addr = (regPairs[9] + offset) & 0xffff;
regs[7] = (tstates += ( 3), memory.read(addr));

var rltemp = regs[7];
regs[7] = ( (regs[7] << 1) | (regs[0] & 1) ) ;
regs[0] = ( rltemp >> 7 ) | sz53pTable[regs[7]];

tstates += ( 1);
tstates += ( 3);
while (display.nextEventTime != null && display.nextEventTime < tstates) display.doEvent();
memory.write(addr, regs[7]);;
}; fn20(); }
	break;case 21: { var fn21 = function() {
	
	var addr = (regPairs[9] + offset) & 0xffff;
regs[6] = (tstates += ( 3), memory.read(addr));

var rltemp = regs[6];
regs[6] = ( (regs[6] << 1) | (regs[0] & 1) ) ;
regs[0] = ( rltemp >> 7 ) | sz53pTable[regs[6]];

tstates += ( 1);
tstates += ( 3);
while (display.nextEventTime != null && display.nextEventTime < tstates) display.doEvent();
memory.write(addr, regs[6]);;
}; fn21(); }
	break;case 22: { var fn22 = function() {
	
	var addr = (regPairs[9] + offset) & 0xffff;
var val = (tstates += ( 3), memory.read(addr));
var rltemp = val;
val = ( (val << 1) | (regs[0] & 1) ) & 0xff;
regs[0] = ( rltemp >> 7 ) | sz53pTable[val];
tstates += ( 1);
tstates += ( 3);
while (display.nextEventTime != null && display.nextEventTime < tstates) display.doEvent();
memory.write(addr, val);;
}; fn22(); }
	break;case 23: { var fn23 = function() {
	
	var addr = (regPairs[9] + offset) & 0xffff;
regs[1] = (tstates += ( 3), memory.read(addr));

var rltemp = regs[1];
regs[1] = ( (regs[1] << 1) | (regs[0] & 1) ) ;
regs[0] = ( rltemp >> 7 ) | sz53pTable[regs[1]];

tstates += ( 1);
tstates += ( 3);
while (display.nextEventTime != null && display.nextEventTime < tstates) display.doEvent();
memory.write(addr, regs[1]);;
}; fn23(); }
	break;case 24: { var fn24 = function() {
	
	var addr = (regPairs[9] + offset) & 0xffff;
regs[3] = (tstates += ( 3), memory.read(addr));

var rrtemp = regs[3];
regs[3] = ( (regs[3] >> 1) | ( regs[0] << 7 ) ) ;
regs[0] = (rrtemp & 1) | sz53pTable[regs[3]];

tstates += ( 1);
tstates += ( 3);
while (display.nextEventTime != null && display.nextEventTime < tstates) display.doEvent();
memory.write(addr, regs[3]);;
}; fn24(); }
	break;case 25: { var fn25 = function() {
	
	var addr = (regPairs[9] + offset) & 0xffff;
regs[2] = (tstates += ( 3), memory.read(addr));

var rrtemp = regs[2];
regs[2] = ( (regs[2] >> 1) | ( regs[0] << 7 ) ) ;
regs[0] = (rrtemp & 1) | sz53pTable[regs[2]];

tstates += ( 1);
tstates += ( 3);
while (display.nextEventTime != null && display.nextEventTime < tstates) display.doEvent();
memory.write(addr, regs[2]);;
}; fn25(); }
	break;case 26: { var fn26 = function() {
	
	var addr = (regPairs[9] + offset) & 0xffff;
regs[5] = (tstates += ( 3), memory.read(addr));

var rrtemp = regs[5];
regs[5] = ( (regs[5] >> 1) | ( regs[0] << 7 ) ) ;
regs[0] = (rrtemp & 1) | sz53pTable[regs[5]];

tstates += ( 1);
tstates += ( 3);
while (display.nextEventTime != null && display.nextEventTime < tstates) display.doEvent();
memory.write(addr, regs[5]);;
}; fn26(); }
	break;case 27: { var fn27 = function() {
	
	var addr = (regPairs[9] + offset) & 0xffff;
regs[4] = (tstates += ( 3), memory.read(addr));

var rrtemp = regs[4];
regs[4] = ( (regs[4] >> 1) | ( regs[0] << 7 ) ) ;
regs[0] = (rrtemp & 1) | sz53pTable[regs[4]];

tstates += ( 1);
tstates += ( 3);
while (display.nextEventTime != null && display.nextEventTime < tstates) display.doEvent();
memory.write(addr, regs[4]);;
}; fn27(); }
	break;case 28: { var fn28 = function() {
	
	var addr = (regPairs[9] + offset) & 0xffff;
regs[7] = (tstates += ( 3), memory.read(addr));

var rrtemp = regs[7];
regs[7] = ( (regs[7] >> 1) | ( regs[0] << 7 ) ) ;
regs[0] = (rrtemp & 1) | sz53pTable[regs[7]];

tstates += ( 1);
tstates += ( 3);
while (display.nextEventTime != null && display.nextEventTime < tstates) display.doEvent();
memory.write(addr, regs[7]);;
}; fn28(); }
	break;case 29: { var fn29 = function() {
	
	var addr = (regPairs[9] + offset) & 0xffff;
regs[6] = (tstates += ( 3), memory.read(addr));

var rrtemp = regs[6];
regs[6] = ( (regs[6] >> 1) | ( regs[0] << 7 ) ) ;
regs[0] = (rrtemp & 1) | sz53pTable[regs[6]];

tstates += ( 1);
tstates += ( 3);
while (display.nextEventTime != null && display.nextEventTime < tstates) display.doEvent();
memory.write(addr, regs[6]);;
}; fn29(); }
	break;case 30: { var fn30 = function() {
	
	var addr = (regPairs[9] + offset) & 0xffff;
var val = (tstates += ( 3), memory.read(addr));
var rrtemp = val;
val = ( (val >> 1) | ( regs[0] << 7 ) ) & 0xff;
regs[0] = (rrtemp & 1) | sz53pTable[val];
tstates += ( 1);
tstates += ( 3);
while (display.nextEventTime != null && display.nextEventTime < tstates) display.doEvent();
memory.write(addr, val);;
}; fn30(); }
	break;case 31: { var fn31 = function() {
	
	var addr = (regPairs[9] + offset) & 0xffff;
regs[1] = (tstates += ( 3), memory.read(addr));

var rrtemp = regs[1];
regs[1] = ( (regs[1] >> 1) | ( regs[0] << 7 ) ) ;
regs[0] = (rrtemp & 1) | sz53pTable[regs[1]];

tstates += ( 1);
tstates += ( 3);
while (display.nextEventTime != null && display.nextEventTime < tstates) display.doEvent();
memory.write(addr, regs[1]);;
}; fn31(); }
	break;case 32: { var fn32 = function() {
	
	var addr = (regPairs[9] + offset) & 0xffff;
regs[3] = (tstates += ( 3), memory.read(addr));

regs[0] = regs[3] >> 7;
regs[3] = (regs[3] << 1) ;
regs[0] |= sz53pTable[regs[3]];

tstates += ( 1);
tstates += ( 3);
while (display.nextEventTime != null && display.nextEventTime < tstates) display.doEvent();
memory.write(addr, regs[3]);;
}; fn32(); }
	break;case 33: { var fn33 = function() {
	
	var addr = (regPairs[9] + offset) & 0xffff;
regs[2] = (tstates += ( 3), memory.read(addr));

regs[0] = regs[2] >> 7;
regs[2] = (regs[2] << 1) ;
regs[0] |= sz53pTable[regs[2]];

tstates += ( 1);
tstates += ( 3);
while (display.nextEventTime != null && display.nextEventTime < tstates) display.doEvent();
memory.write(addr, regs[2]);;
}; fn33(); }
	break;case 34: { var fn34 = function() {
	
	var addr = (regPairs[9] + offset) & 0xffff;
regs[5] = (tstates += ( 3), memory.read(addr));

regs[0] = regs[5] >> 7;
regs[5] = (regs[5] << 1) ;
regs[0] |= sz53pTable[regs[5]];

tstates += ( 1);
tstates += ( 3);
while (display.nextEventTime != null && display.nextEventTime < tstates) display.doEvent();
memory.write(addr, regs[5]);;
}; fn34(); }
	break;case 35: { var fn35 = function() {
	
	var addr = (regPairs[9] + offset) & 0xffff;
regs[4] = (tstates += ( 3), memory.read(addr));

regs[0] = regs[4] >> 7;
regs[4] = (regs[4] << 1) ;
regs[0] |= sz53pTable[regs[4]];

tstates += ( 1);
tstates += ( 3);
while (display.nextEventTime != null && display.nextEventTime < tstates) display.doEvent();
memory.write(addr, regs[4]);;
}; fn35(); }
	break;case 36: { var fn36 = function() {
	
	var addr = (regPairs[9] + offset) & 0xffff;
regs[7] = (tstates += ( 3), memory.read(addr));

regs[0] = regs[7] >> 7;
regs[7] = (regs[7] << 1) ;
regs[0] |= sz53pTable[regs[7]];

tstates += ( 1);
tstates += ( 3);
while (display.nextEventTime != null && display.nextEventTime < tstates) display.doEvent();
memory.write(addr, regs[7]);;
}; fn36(); }
	break;case 37: { var fn37 = function() {
	
	var addr = (regPairs[9] + offset) & 0xffff;
regs[6] = (tstates += ( 3), memory.read(addr));

regs[0] = regs[6] >> 7;
regs[6] = (regs[6] << 1) ;
regs[0] |= sz53pTable[regs[6]];

tstates += ( 1);
tstates += ( 3);
while (display.nextEventTime != null && display.nextEventTime < tstates) display.doEvent();
memory.write(addr, regs[6]);;
}; fn37(); }
	break;case 38: { var fn38 = function() {
	
	var addr = (regPairs[9] + offset) & 0xffff;
var val = (tstates += ( 3), memory.read(addr));
regs[0] = val >> 7;
val = (val << 1) & 0xff;
regs[0] |= sz53pTable[val];
tstates += ( 1);
tstates += ( 3);
while (display.nextEventTime != null && display.nextEventTime < tstates) display.doEvent();
memory.write(addr, val);;
}; fn38(); }
	break;case 39: { var fn39 = function() {
	
	var addr = (regPairs[9] + offset) & 0xffff;
regs[1] = (tstates += ( 3), memory.read(addr));

regs[0] = regs[1] >> 7;
regs[1] = (regs[1] << 1) ;
regs[0] |= sz53pTable[regs[1]];

tstates += ( 1);
tstates += ( 3);
while (display.nextEventTime != null && display.nextEventTime < tstates) display.doEvent();
memory.write(addr, regs[1]);;
}; fn39(); }
	break;case 40: { var fn40 = function() {
	
	var addr = (regPairs[9] + offset) & 0xffff;
regs[3] = (tstates += ( 3), memory.read(addr));

regs[0] = regs[3] & 1;
regs[3] = ( (regs[3] & 0x80) | (regs[3] >> 1) ) ;
regs[0] |= sz53pTable[regs[3]];

tstates += ( 1);
tstates += ( 3);
while (display.nextEventTime != null && display.nextEventTime < tstates) display.doEvent();
memory.write(addr, regs[3]);;
}; fn40(); }
	break;case 41: { var fn41 = function() {
	
	var addr = (regPairs[9] + offset) & 0xffff;
regs[2] = (tstates += ( 3), memory.read(addr));

regs[0] = regs[2] & 1;
regs[2] = ( (regs[2] & 0x80) | (regs[2] >> 1) ) ;
regs[0] |= sz53pTable[regs[2]];

tstates += ( 1);
tstates += ( 3);
while (display.nextEventTime != null && display.nextEventTime < tstates) display.doEvent();
memory.write(addr, regs[2]);;
}; fn41(); }
	break;case 42: { var fn42 = function() {
	
	var addr = (regPairs[9] + offset) & 0xffff;
regs[5] = (tstates += ( 3), memory.read(addr));

regs[0] = regs[5] & 1;
regs[5] = ( (regs[5] & 0x80) | (regs[5] >> 1) ) ;
regs[0] |= sz53pTable[regs[5]];

tstates += ( 1);
tstates += ( 3);
while (display.nextEventTime != null && display.nextEventTime < tstates) display.doEvent();
memory.write(addr, regs[5]);;
}; fn42(); }
	break;case 43: { var fn43 = function() {
	
	var addr = (regPairs[9] + offset) & 0xffff;
regs[4] = (tstates += ( 3), memory.read(addr));

regs[0] = regs[4] & 1;
regs[4] = ( (regs[4] & 0x80) | (regs[4] >> 1) ) ;
regs[0] |= sz53pTable[regs[4]];

tstates += ( 1);
tstates += ( 3);
while (display.nextEventTime != null && display.nextEventTime < tstates) display.doEvent();
memory.write(addr, regs[4]);;
}; fn43(); }
	break;case 44: { var fn44 = function() {
	
	var addr = (regPairs[9] + offset) & 0xffff;
regs[7] = (tstates += ( 3), memory.read(addr));

regs[0] = regs[7] & 1;
regs[7] = ( (regs[7] & 0x80) | (regs[7] >> 1) ) ;
regs[0] |= sz53pTable[regs[7]];

tstates += ( 1);
tstates += ( 3);
while (display.nextEventTime != null && display.nextEventTime < tstates) display.doEvent();
memory.write(addr, regs[7]);;
}; fn44(); }
	break;case 45: { var fn45 = function() {
	
	var addr = (regPairs[9] + offset) & 0xffff;
regs[6] = (tstates += ( 3), memory.read(addr));

regs[0] = regs[6] & 1;
regs[6] = ( (regs[6] & 0x80) | (regs[6] >> 1) ) ;
regs[0] |= sz53pTable[regs[6]];

tstates += ( 1);
tstates += ( 3);
while (display.nextEventTime != null && display.nextEventTime < tstates) display.doEvent();
memory.write(addr, regs[6]);;
}; fn45(); }
	break;case 46: { var fn46 = function() {
	
	var addr = (regPairs[9] + offset) & 0xffff;
var val = (tstates += ( 3), memory.read(addr));
regs[0] = val & 1;
val = ( (val & 0x80) | (val >> 1) ) & 0xff;
regs[0] |= sz53pTable[val];
tstates += ( 1);
tstates += ( 3);
while (display.nextEventTime != null && display.nextEventTime < tstates) display.doEvent();
memory.write(addr, val);;
}; fn46(); }
	break;case 47: { var fn47 = function() {
	
	var addr = (regPairs[9] + offset) & 0xffff;
regs[1] = (tstates += ( 3), memory.read(addr));

regs[0] = regs[1] & 1;
regs[1] = ( (regs[1] & 0x80) | (regs[1] >> 1) ) ;
regs[0] |= sz53pTable[regs[1]];

tstates += ( 1);
tstates += ( 3);
while (display.nextEventTime != null && display.nextEventTime < tstates) display.doEvent();
memory.write(addr, regs[1]);;
}; fn47(); }
	break;case 48: { var fn48 = function() {
	
	var addr = (regPairs[9] + offset) & 0xffff;
regs[3] = (tstates += ( 3), memory.read(addr));

regs[0] =  regs[3] >> 7;
regs[3] = (((regs[3]) << 1) ) | 0x01;
regs[0] |= sz53pTable[regs[3]];

tstates += ( 1);
tstates += ( 3);
while (display.nextEventTime != null && display.nextEventTime < tstates) display.doEvent();
memory.write(addr, regs[3]);;
}; fn48(); }
	break;case 49: { var fn49 = function() {
	
	var addr = (regPairs[9] + offset) & 0xffff;
regs[2] = (tstates += ( 3), memory.read(addr));

regs[0] =  regs[2] >> 7;
regs[2] = (((regs[2]) << 1) ) | 0x01;
regs[0] |= sz53pTable[regs[2]];

tstates += ( 1);
tstates += ( 3);
while (display.nextEventTime != null && display.nextEventTime < tstates) display.doEvent();
memory.write(addr, regs[2]);;
}; fn49(); }
	break;case 50: { var fn50 = function() {
	
	var addr = (regPairs[9] + offset) & 0xffff;
regs[5] = (tstates += ( 3), memory.read(addr));

regs[0] =  regs[5] >> 7;
regs[5] = (((regs[5]) << 1) ) | 0x01;
regs[0] |= sz53pTable[regs[5]];

tstates += ( 1);
tstates += ( 3);
while (display.nextEventTime != null && display.nextEventTime < tstates) display.doEvent();
memory.write(addr, regs[5]);;
}; fn50(); }
	break;case 51: { var fn51 = function() {
	
	var addr = (regPairs[9] + offset) & 0xffff;
regs[4] = (tstates += ( 3), memory.read(addr));

regs[0] =  regs[4] >> 7;
regs[4] = (((regs[4]) << 1) ) | 0x01;
regs[0] |= sz53pTable[regs[4]];

tstates += ( 1);
tstates += ( 3);
while (display.nextEventTime != null && display.nextEventTime < tstates) display.doEvent();
memory.write(addr, regs[4]);;
}; fn51(); }
	break;case 52: { var fn52 = function() {
	
	var addr = (regPairs[9] + offset) & 0xffff;
regs[7] = (tstates += ( 3), memory.read(addr));

regs[0] =  regs[7] >> 7;
regs[7] = (((regs[7]) << 1) ) | 0x01;
regs[0] |= sz53pTable[regs[7]];

tstates += ( 1);
tstates += ( 3);
while (display.nextEventTime != null && display.nextEventTime < tstates) display.doEvent();
memory.write(addr, regs[7]);;
}; fn52(); }
	break;case 53: { var fn53 = function() {
	
	var addr = (regPairs[9] + offset) & 0xffff;
regs[6] = (tstates += ( 3), memory.read(addr));

regs[0] =  regs[6] >> 7;
regs[6] = (((regs[6]) << 1) ) | 0x01;
regs[0] |= sz53pTable[regs[6]];

tstates += ( 1);
tstates += ( 3);
while (display.nextEventTime != null && display.nextEventTime < tstates) display.doEvent();
memory.write(addr, regs[6]);;
}; fn53(); }
	break;case 54: { var fn54 = function() {
	
	var addr = (regPairs[9] + offset) & 0xffff;
var val = (tstates += ( 3), memory.read(addr));
regs[0] =  val >> 7;
val = (((val) << 1) & 0xff) | 0x01;
regs[0] |= sz53pTable[val];
tstates += ( 1);
tstates += ( 3);
while (display.nextEventTime != null && display.nextEventTime < tstates) display.doEvent();
memory.write(addr, val);;
}; fn54(); }
	break;case 55: { var fn55 = function() {
	
	var addr = (regPairs[9] + offset) & 0xffff;
regs[1] = (tstates += ( 3), memory.read(addr));

regs[0] =  regs[1] >> 7;
regs[1] = (((regs[1]) << 1) ) | 0x01;
regs[0] |= sz53pTable[regs[1]];

tstates += ( 1);
tstates += ( 3);
while (display.nextEventTime != null && display.nextEventTime < tstates) display.doEvent();
memory.write(addr, regs[1]);;
}; fn55(); }
	break;case 56: { var fn56 = function() {
	
	var addr = (regPairs[9] + offset) & 0xffff;
regs[3] = (tstates += ( 3), memory.read(addr));

regs[0] =  regs[3] & 1;
regs[3] >>= 1;
regs[0] |= sz53pTable[regs[3]];

tstates += ( 1);
tstates += ( 3);
while (display.nextEventTime != null && display.nextEventTime < tstates) display.doEvent();
memory.write(addr, regs[3]);;
}; fn56(); }
	break;case 57: { var fn57 = function() {
	
	var addr = (regPairs[9] + offset) & 0xffff;
regs[2] = (tstates += ( 3), memory.read(addr));

regs[0] =  regs[2] & 1;
regs[2] >>= 1;
regs[0] |= sz53pTable[regs[2]];

tstates += ( 1);
tstates += ( 3);
while (display.nextEventTime != null && display.nextEventTime < tstates) display.doEvent();
memory.write(addr, regs[2]);;
}; fn57(); }
	break;case 58: { var fn58 = function() {
	
	var addr = (regPairs[9] + offset) & 0xffff;
regs[5] = (tstates += ( 3), memory.read(addr));

regs[0] =  regs[5] & 1;
regs[5] >>= 1;
regs[0] |= sz53pTable[regs[5]];

tstates += ( 1);
tstates += ( 3);
while (display.nextEventTime != null && display.nextEventTime < tstates) display.doEvent();
memory.write(addr, regs[5]);;
}; fn58(); }
	break;case 59: { var fn59 = function() {
	
	var addr = (regPairs[9] + offset) & 0xffff;
regs[4] = (tstates += ( 3), memory.read(addr));

regs[0] =  regs[4] & 1;
regs[4] >>= 1;
regs[0] |= sz53pTable[regs[4]];

tstates += ( 1);
tstates += ( 3);
while (display.nextEventTime != null && display.nextEventTime < tstates) display.doEvent();
memory.write(addr, regs[4]);;
}; fn59(); }
	break;case 60: { var fn60 = function() {
	
	var addr = (regPairs[9] + offset) & 0xffff;
regs[7] = (tstates += ( 3), memory.read(addr));

regs[0] =  regs[7] & 1;
regs[7] >>= 1;
regs[0] |= sz53pTable[regs[7]];

tstates += ( 1);
tstates += ( 3);
while (display.nextEventTime != null && display.nextEventTime < tstates) display.doEvent();
memory.write(addr, regs[7]);;
}; fn60(); }
	break;case 61: { var fn61 = function() {
	
	var addr = (regPairs[9] + offset) & 0xffff;
regs[6] = (tstates += ( 3), memory.read(addr));

regs[0] =  regs[6] & 1;
regs[6] >>= 1;
regs[0] |= sz53pTable[regs[6]];

tstates += ( 1);
tstates += ( 3);
while (display.nextEventTime != null && display.nextEventTime < tstates) display.doEvent();
memory.write(addr, regs[6]);;
}; fn61(); }
	break;case 62: { var fn62 = function() {
	
	var addr = (regPairs[9] + offset) & 0xffff;
var val = (tstates += ( 3), memory.read(addr));
regs[0] =  val & 1;
val >>= 1;
regs[0] |= sz53pTable[val];
tstates += ( 1);
tstates += ( 3);
while (display.nextEventTime != null && display.nextEventTime < tstates) display.doEvent();
memory.write(addr, val);;
}; fn62(); }
	break;case 63: { var fn63 = function() {
	
	var addr = (regPairs[9] + offset) & 0xffff;
regs[1] = (tstates += ( 3), memory.read(addr));

regs[0] =  regs[1] & 1;
regs[1] >>= 1;
regs[0] |= sz53pTable[regs[1]];

tstates += ( 1);
tstates += ( 3);
while (display.nextEventTime != null && display.nextEventTime < tstates) display.doEvent();
memory.write(addr, regs[1]);;
}; fn63(); }
	break;case 64: { var fn64 = function() {
	
	var addr = (regPairs[9] + offset) & 0xffff;
var value = (tstates += ( 3), memory.read(addr));
regs[0] = ( regs[0] & 1 ) | 16 | ( ( addr >> 8 ) & 40 );
if ( !(value & 1) ) regs[0] |= 68;

tstates += ( 1);
}; fn64(); }
	break;case 65: { var fn65 = function() {
	
	var addr = (regPairs[9] + offset) & 0xffff;
var value = (tstates += ( 3), memory.read(addr));
regs[0] = ( regs[0] & 1 ) | 16 | ( ( addr >> 8 ) & 40 );
if ( !(value & 1) ) regs[0] |= 68;

tstates += ( 1);
}; fn65(); }
	break;case 66: { var fn66 = function() {
	
	var addr = (regPairs[9] + offset) & 0xffff;
var value = (tstates += ( 3), memory.read(addr));
regs[0] = ( regs[0] & 1 ) | 16 | ( ( addr >> 8 ) & 40 );
if ( !(value & 1) ) regs[0] |= 68;

tstates += ( 1);
}; fn66(); }
	break;case 67: { var fn67 = function() {
	
	var addr = (regPairs[9] + offset) & 0xffff;
var value = (tstates += ( 3), memory.read(addr));
regs[0] = ( regs[0] & 1 ) | 16 | ( ( addr >> 8 ) & 40 );
if ( !(value & 1) ) regs[0] |= 68;

tstates += ( 1);
}; fn67(); }
	break;case 68: { var fn68 = function() {
	
	var addr = (regPairs[9] + offset) & 0xffff;
var value = (tstates += ( 3), memory.read(addr));
regs[0] = ( regs[0] & 1 ) | 16 | ( ( addr >> 8 ) & 40 );
if ( !(value & 1) ) regs[0] |= 68;

tstates += ( 1);
}; fn68(); }
	break;case 69: { var fn69 = function() {
	
	var addr = (regPairs[9] + offset) & 0xffff;
var value = (tstates += ( 3), memory.read(addr));
regs[0] = ( regs[0] & 1 ) | 16 | ( ( addr >> 8 ) & 40 );
if ( !(value & 1) ) regs[0] |= 68;

tstates += ( 1);
}; fn69(); }
	break;case 70: { var fn70 = function() {
	
	var addr = (regPairs[9] + offset) & 0xffff;
var value = (tstates += ( 3), memory.read(addr));
regs[0] = ( regs[0] & 1 ) | 16 | ( ( addr >> 8 ) & 40 );
if ( !(value & 1) ) regs[0] |= 68;

tstates += ( 1);
}; fn70(); }
	break;case 71: { var fn71 = function() {
	
	var addr = (regPairs[9] + offset) & 0xffff;
var value = (tstates += ( 3), memory.read(addr));
regs[0] = ( regs[0] & 1 ) | 16 | ( ( addr >> 8 ) & 40 );
if ( !(value & 1) ) regs[0] |= 68;

tstates += ( 1);
}; fn71(); }
	break;case 72: { var fn72 = function() {
	
	var addr = (regPairs[9] + offset) & 0xffff;
var value = (tstates += ( 3), memory.read(addr));
regs[0] = ( regs[0] & 1 ) | 16 | ( ( addr >> 8 ) & 40 );
if ( !(value & 2) ) regs[0] |= 68;

tstates += ( 1);
}; fn72(); }
	break;case 73: { var fn73 = function() {
	
	var addr = (regPairs[9] + offset) & 0xffff;
var value = (tstates += ( 3), memory.read(addr));
regs[0] = ( regs[0] & 1 ) | 16 | ( ( addr >> 8 ) & 40 );
if ( !(value & 2) ) regs[0] |= 68;

tstates += ( 1);
}; fn73(); }
	break;case 74: { var fn74 = function() {
	
	var addr = (regPairs[9] + offset) & 0xffff;
var value = (tstates += ( 3), memory.read(addr));
regs[0] = ( regs[0] & 1 ) | 16 | ( ( addr >> 8 ) & 40 );
if ( !(value & 2) ) regs[0] |= 68;

tstates += ( 1);
}; fn74(); }
	break;case 75: { var fn75 = function() {
	
	var addr = (regPairs[9] + offset) & 0xffff;
var value = (tstates += ( 3), memory.read(addr));
regs[0] = ( regs[0] & 1 ) | 16 | ( ( addr >> 8 ) & 40 );
if ( !(value & 2) ) regs[0] |= 68;

tstates += ( 1);
}; fn75(); }
	break;case 76: { var fn76 = function() {
	
	var addr = (regPairs[9] + offset) & 0xffff;
var value = (tstates += ( 3), memory.read(addr));
regs[0] = ( regs[0] & 1 ) | 16 | ( ( addr >> 8 ) & 40 );
if ( !(value & 2) ) regs[0] |= 68;

tstates += ( 1);
}; fn76(); }
	break;case 77: { var fn77 = function() {
	
	var addr = (regPairs[9] + offset) & 0xffff;
var value = (tstates += ( 3), memory.read(addr));
regs[0] = ( regs[0] & 1 ) | 16 | ( ( addr >> 8 ) & 40 );
if ( !(value & 2) ) regs[0] |= 68;

tstates += ( 1);
}; fn77(); }
	break;case 78: { var fn78 = function() {
	
	var addr = (regPairs[9] + offset) & 0xffff;
var value = (tstates += ( 3), memory.read(addr));
regs[0] = ( regs[0] & 1 ) | 16 | ( ( addr >> 8 ) & 40 );
if ( !(value & 2) ) regs[0] |= 68;

tstates += ( 1);
}; fn78(); }
	break;case 79: { var fn79 = function() {
	
	var addr = (regPairs[9] + offset) & 0xffff;
var value = (tstates += ( 3), memory.read(addr));
regs[0] = ( regs[0] & 1 ) | 16 | ( ( addr >> 8 ) & 40 );
if ( !(value & 2) ) regs[0] |= 68;

tstates += ( 1);
}; fn79(); }
	break;case 80: { var fn80 = function() {
	
	var addr = (regPairs[9] + offset) & 0xffff;
var value = (tstates += ( 3), memory.read(addr));
regs[0] = ( regs[0] & 1 ) | 16 | ( ( addr >> 8 ) & 40 );
if ( !(value & 4) ) regs[0] |= 68;

tstates += ( 1);
}; fn80(); }
	break;case 81: { var fn81 = function() {
	
	var addr = (regPairs[9] + offset) & 0xffff;
var value = (tstates += ( 3), memory.read(addr));
regs[0] = ( regs[0] & 1 ) | 16 | ( ( addr >> 8 ) & 40 );
if ( !(value & 4) ) regs[0] |= 68;

tstates += ( 1);
}; fn81(); }
	break;case 82: { var fn82 = function() {
	
	var addr = (regPairs[9] + offset) & 0xffff;
var value = (tstates += ( 3), memory.read(addr));
regs[0] = ( regs[0] & 1 ) | 16 | ( ( addr >> 8 ) & 40 );
if ( !(value & 4) ) regs[0] |= 68;

tstates += ( 1);
}; fn82(); }
	break;case 83: { var fn83 = function() {
	
	var addr = (regPairs[9] + offset) & 0xffff;
var value = (tstates += ( 3), memory.read(addr));
regs[0] = ( regs[0] & 1 ) | 16 | ( ( addr >> 8 ) & 40 );
if ( !(value & 4) ) regs[0] |= 68;

tstates += ( 1);
}; fn83(); }
	break;case 84: { var fn84 = function() {
	
	var addr = (regPairs[9] + offset) & 0xffff;
var value = (tstates += ( 3), memory.read(addr));
regs[0] = ( regs[0] & 1 ) | 16 | ( ( addr >> 8 ) & 40 );
if ( !(value & 4) ) regs[0] |= 68;

tstates += ( 1);
}; fn84(); }
	break;case 85: { var fn85 = function() {
	
	var addr = (regPairs[9] + offset) & 0xffff;
var value = (tstates += ( 3), memory.read(addr));
regs[0] = ( regs[0] & 1 ) | 16 | ( ( addr >> 8 ) & 40 );
if ( !(value & 4) ) regs[0] |= 68;

tstates += ( 1);
}; fn85(); }
	break;case 86: { var fn86 = function() {
	
	var addr = (regPairs[9] + offset) & 0xffff;
var value = (tstates += ( 3), memory.read(addr));
regs[0] = ( regs[0] & 1 ) | 16 | ( ( addr >> 8 ) & 40 );
if ( !(value & 4) ) regs[0] |= 68;

tstates += ( 1);
}; fn86(); }
	break;case 87: { var fn87 = function() {
	
	var addr = (regPairs[9] + offset) & 0xffff;
var value = (tstates += ( 3), memory.read(addr));
regs[0] = ( regs[0] & 1 ) | 16 | ( ( addr >> 8 ) & 40 );
if ( !(value & 4) ) regs[0] |= 68;

tstates += ( 1);
}; fn87(); }
	break;case 88: { var fn88 = function() {
	
	var addr = (regPairs[9] + offset) & 0xffff;
var value = (tstates += ( 3), memory.read(addr));
regs[0] = ( regs[0] & 1 ) | 16 | ( ( addr >> 8 ) & 40 );
if ( !(value & 8) ) regs[0] |= 68;

tstates += ( 1);
}; fn88(); }
	break;case 89: { var fn89 = function() {
	
	var addr = (regPairs[9] + offset) & 0xffff;
var value = (tstates += ( 3), memory.read(addr));
regs[0] = ( regs[0] & 1 ) | 16 | ( ( addr >> 8 ) & 40 );
if ( !(value & 8) ) regs[0] |= 68;

tstates += ( 1);
}; fn89(); }
	break;case 90: { var fn90 = function() {
	
	var addr = (regPairs[9] + offset) & 0xffff;
var value = (tstates += ( 3), memory.read(addr));
regs[0] = ( regs[0] & 1 ) | 16 | ( ( addr >> 8 ) & 40 );
if ( !(value & 8) ) regs[0] |= 68;

tstates += ( 1);
}; fn90(); }
	break;case 91: { var fn91 = function() {
	
	var addr = (regPairs[9] + offset) & 0xffff;
var value = (tstates += ( 3), memory.read(addr));
regs[0] = ( regs[0] & 1 ) | 16 | ( ( addr >> 8 ) & 40 );
if ( !(value & 8) ) regs[0] |= 68;

tstates += ( 1);
}; fn91(); }
	break;case 92: { var fn92 = function() {
	
	var addr = (regPairs[9] + offset) & 0xffff;
var value = (tstates += ( 3), memory.read(addr));
regs[0] = ( regs[0] & 1 ) | 16 | ( ( addr >> 8 ) & 40 );
if ( !(value & 8) ) regs[0] |= 68;

tstates += ( 1);
}; fn92(); }
	break;case 93: { var fn93 = function() {
	
	var addr = (regPairs[9] + offset) & 0xffff;
var value = (tstates += ( 3), memory.read(addr));
regs[0] = ( regs[0] & 1 ) | 16 | ( ( addr >> 8 ) & 40 );
if ( !(value & 8) ) regs[0] |= 68;

tstates += ( 1);
}; fn93(); }
	break;case 94: { var fn94 = function() {
	
	var addr = (regPairs[9] + offset) & 0xffff;
var value = (tstates += ( 3), memory.read(addr));
regs[0] = ( regs[0] & 1 ) | 16 | ( ( addr >> 8 ) & 40 );
if ( !(value & 8) ) regs[0] |= 68;

tstates += ( 1);
}; fn94(); }
	break;case 95: { var fn95 = function() {
	
	var addr = (regPairs[9] + offset) & 0xffff;
var value = (tstates += ( 3), memory.read(addr));
regs[0] = ( regs[0] & 1 ) | 16 | ( ( addr >> 8 ) & 40 );
if ( !(value & 8) ) regs[0] |= 68;

tstates += ( 1);
}; fn95(); }
	break;case 96: { var fn96 = function() {
	
	var addr = (regPairs[9] + offset) & 0xffff;
var value = (tstates += ( 3), memory.read(addr));
regs[0] = ( regs[0] & 1 ) | 16 | ( ( addr >> 8 ) & 40 );
if ( !(value & 16) ) regs[0] |= 68;

tstates += ( 1);
}; fn96(); }
	break;case 97: { var fn97 = function() {
	
	var addr = (regPairs[9] + offset) & 0xffff;
var value = (tstates += ( 3), memory.read(addr));
regs[0] = ( regs[0] & 1 ) | 16 | ( ( addr >> 8 ) & 40 );
if ( !(value & 16) ) regs[0] |= 68;

tstates += ( 1);
}; fn97(); }
	break;case 98: { var fn98 = function() {
	
	var addr = (regPairs[9] + offset) & 0xffff;
var value = (tstates += ( 3), memory.read(addr));
regs[0] = ( regs[0] & 1 ) | 16 | ( ( addr >> 8 ) & 40 );
if ( !(value & 16) ) regs[0] |= 68;

tstates += ( 1);
}; fn98(); }
	break;case 99: { var fn99 = function() {
	
	var addr = (regPairs[9] + offset) & 0xffff;
var value = (tstates += ( 3), memory.read(addr));
regs[0] = ( regs[0] & 1 ) | 16 | ( ( addr >> 8 ) & 40 );
if ( !(value & 16) ) regs[0] |= 68;

tstates += ( 1);
}; fn99(); }
	break;case 100: { var fn100 = function() {
	
	var addr = (regPairs[9] + offset) & 0xffff;
var value = (tstates += ( 3), memory.read(addr));
regs[0] = ( regs[0] & 1 ) | 16 | ( ( addr >> 8 ) & 40 );
if ( !(value & 16) ) regs[0] |= 68;

tstates += ( 1);
}; fn100(); }
	break;case 101: { var fn101 = function() {
	
	var addr = (regPairs[9] + offset) & 0xffff;
var value = (tstates += ( 3), memory.read(addr));
regs[0] = ( regs[0] & 1 ) | 16 | ( ( addr >> 8 ) & 40 );
if ( !(value & 16) ) regs[0] |= 68;

tstates += ( 1);
}; fn101(); }
	break;case 102: { var fn102 = function() {
	
	var addr = (regPairs[9] + offset) & 0xffff;
var value = (tstates += ( 3), memory.read(addr));
regs[0] = ( regs[0] & 1 ) | 16 | ( ( addr >> 8 ) & 40 );
if ( !(value & 16) ) regs[0] |= 68;

tstates += ( 1);
}; fn102(); }
	break;case 103: { var fn103 = function() {
	
	var addr = (regPairs[9] + offset) & 0xffff;
var value = (tstates += ( 3), memory.read(addr));
regs[0] = ( regs[0] & 1 ) | 16 | ( ( addr >> 8 ) & 40 );
if ( !(value & 16) ) regs[0] |= 68;

tstates += ( 1);
}; fn103(); }
	break;case 104: { var fn104 = function() {
	
	var addr = (regPairs[9] + offset) & 0xffff;
var value = (tstates += ( 3), memory.read(addr));
regs[0] = ( regs[0] & 1 ) | 16 | ( ( addr >> 8 ) & 40 );
if ( !(value & 32) ) regs[0] |= 68;

tstates += ( 1);
}; fn104(); }
	break;case 105: { var fn105 = function() {
	
	var addr = (regPairs[9] + offset) & 0xffff;
var value = (tstates += ( 3), memory.read(addr));
regs[0] = ( regs[0] & 1 ) | 16 | ( ( addr >> 8 ) & 40 );
if ( !(value & 32) ) regs[0] |= 68;

tstates += ( 1);
}; fn105(); }
	break;case 106: { var fn106 = function() {
	
	var addr = (regPairs[9] + offset) & 0xffff;
var value = (tstates += ( 3), memory.read(addr));
regs[0] = ( regs[0] & 1 ) | 16 | ( ( addr >> 8 ) & 40 );
if ( !(value & 32) ) regs[0] |= 68;

tstates += ( 1);
}; fn106(); }
	break;case 107: { var fn107 = function() {
	
	var addr = (regPairs[9] + offset) & 0xffff;
var value = (tstates += ( 3), memory.read(addr));
regs[0] = ( regs[0] & 1 ) | 16 | ( ( addr >> 8 ) & 40 );
if ( !(value & 32) ) regs[0] |= 68;

tstates += ( 1);
}; fn107(); }
	break;case 108: { var fn108 = function() {
	
	var addr = (regPairs[9] + offset) & 0xffff;
var value = (tstates += ( 3), memory.read(addr));
regs[0] = ( regs[0] & 1 ) | 16 | ( ( addr >> 8 ) & 40 );
if ( !(value & 32) ) regs[0] |= 68;

tstates += ( 1);
}; fn108(); }
	break;case 109: { var fn109 = function() {
	
	var addr = (regPairs[9] + offset) & 0xffff;
var value = (tstates += ( 3), memory.read(addr));
regs[0] = ( regs[0] & 1 ) | 16 | ( ( addr >> 8 ) & 40 );
if ( !(value & 32) ) regs[0] |= 68;

tstates += ( 1);
}; fn109(); }
	break;case 110: { var fn110 = function() {
	
	var addr = (regPairs[9] + offset) & 0xffff;
var value = (tstates += ( 3), memory.read(addr));
regs[0] = ( regs[0] & 1 ) | 16 | ( ( addr >> 8 ) & 40 );
if ( !(value & 32) ) regs[0] |= 68;

tstates += ( 1);
}; fn110(); }
	break;case 111: { var fn111 = function() {
	
	var addr = (regPairs[9] + offset) & 0xffff;
var value = (tstates += ( 3), memory.read(addr));
regs[0] = ( regs[0] & 1 ) | 16 | ( ( addr >> 8 ) & 40 );
if ( !(value & 32) ) regs[0] |= 68;

tstates += ( 1);
}; fn111(); }
	break;case 112: { var fn112 = function() {
	
	var addr = (regPairs[9] + offset) & 0xffff;
var value = (tstates += ( 3), memory.read(addr));
regs[0] = ( regs[0] & 1 ) | 16 | ( ( addr >> 8 ) & 40 );
if ( !(value & 64) ) regs[0] |= 68;

tstates += ( 1);
}; fn112(); }
	break;case 113: { var fn113 = function() {
	
	var addr = (regPairs[9] + offset) & 0xffff;
var value = (tstates += ( 3), memory.read(addr));
regs[0] = ( regs[0] & 1 ) | 16 | ( ( addr >> 8 ) & 40 );
if ( !(value & 64) ) regs[0] |= 68;

tstates += ( 1);
}; fn113(); }
	break;case 114: { var fn114 = function() {
	
	var addr = (regPairs[9] + offset) & 0xffff;
var value = (tstates += ( 3), memory.read(addr));
regs[0] = ( regs[0] & 1 ) | 16 | ( ( addr >> 8 ) & 40 );
if ( !(value & 64) ) regs[0] |= 68;

tstates += ( 1);
}; fn114(); }
	break;case 115: { var fn115 = function() {
	
	var addr = (regPairs[9] + offset) & 0xffff;
var value = (tstates += ( 3), memory.read(addr));
regs[0] = ( regs[0] & 1 ) | 16 | ( ( addr >> 8 ) & 40 );
if ( !(value & 64) ) regs[0] |= 68;

tstates += ( 1);
}; fn115(); }
	break;case 116: { var fn116 = function() {
	
	var addr = (regPairs[9] + offset) & 0xffff;
var value = (tstates += ( 3), memory.read(addr));
regs[0] = ( regs[0] & 1 ) | 16 | ( ( addr >> 8 ) & 40 );
if ( !(value & 64) ) regs[0] |= 68;

tstates += ( 1);
}; fn116(); }
	break;case 117: { var fn117 = function() {
	
	var addr = (regPairs[9] + offset) & 0xffff;
var value = (tstates += ( 3), memory.read(addr));
regs[0] = ( regs[0] & 1 ) | 16 | ( ( addr >> 8 ) & 40 );
if ( !(value & 64) ) regs[0] |= 68;

tstates += ( 1);
}; fn117(); }
	break;case 118: { var fn118 = function() {
	
	var addr = (regPairs[9] + offset) & 0xffff;
var value = (tstates += ( 3), memory.read(addr));
regs[0] = ( regs[0] & 1 ) | 16 | ( ( addr >> 8 ) & 40 );
if ( !(value & 64) ) regs[0] |= 68;

tstates += ( 1);
}; fn118(); }
	break;case 119: { var fn119 = function() {
	
	var addr = (regPairs[9] + offset) & 0xffff;
var value = (tstates += ( 3), memory.read(addr));
regs[0] = ( regs[0] & 1 ) | 16 | ( ( addr >> 8 ) & 40 );
if ( !(value & 64) ) regs[0] |= 68;

tstates += ( 1);
}; fn119(); }
	break;case 120: { var fn120 = function() {
	
	var addr = (regPairs[9] + offset) & 0xffff;
var value = (tstates += ( 3), memory.read(addr));
regs[0] = ( regs[0] & 1 ) | 16 | ( ( addr >> 8 ) & 40 );
if ( !(value & 128) ) regs[0] |= 68;
if (value & 0x80) regs[0] |= 128;
tstates += ( 1);
}; fn120(); }
	break;case 121: { var fn121 = function() {
	
	var addr = (regPairs[9] + offset) & 0xffff;
var value = (tstates += ( 3), memory.read(addr));
regs[0] = ( regs[0] & 1 ) | 16 | ( ( addr >> 8 ) & 40 );
if ( !(value & 128) ) regs[0] |= 68;
if (value & 0x80) regs[0] |= 128;
tstates += ( 1);
}; fn121(); }
	break;case 122: { var fn122 = function() {
	
	var addr = (regPairs[9] + offset) & 0xffff;
var value = (tstates += ( 3), memory.read(addr));
regs[0] = ( regs[0] & 1 ) | 16 | ( ( addr >> 8 ) & 40 );
if ( !(value & 128) ) regs[0] |= 68;
if (value & 0x80) regs[0] |= 128;
tstates += ( 1);
}; fn122(); }
	break;case 123: { var fn123 = function() {
	
	var addr = (regPairs[9] + offset) & 0xffff;
var value = (tstates += ( 3), memory.read(addr));
regs[0] = ( regs[0] & 1 ) | 16 | ( ( addr >> 8 ) & 40 );
if ( !(value & 128) ) regs[0] |= 68;
if (value & 0x80) regs[0] |= 128;
tstates += ( 1);
}; fn123(); }
	break;case 124: { var fn124 = function() {
	
	var addr = (regPairs[9] + offset) & 0xffff;
var value = (tstates += ( 3), memory.read(addr));
regs[0] = ( regs[0] & 1 ) | 16 | ( ( addr >> 8 ) & 40 );
if ( !(value & 128) ) regs[0] |= 68;
if (value & 0x80) regs[0] |= 128;
tstates += ( 1);
}; fn124(); }
	break;case 125: { var fn125 = function() {
	
	var addr = (regPairs[9] + offset) & 0xffff;
var value = (tstates += ( 3), memory.read(addr));
regs[0] = ( regs[0] & 1 ) | 16 | ( ( addr >> 8 ) & 40 );
if ( !(value & 128) ) regs[0] |= 68;
if (value & 0x80) regs[0] |= 128;
tstates += ( 1);
}; fn125(); }
	break;case 126: { var fn126 = function() {
	
	var addr = (regPairs[9] + offset) & 0xffff;
var value = (tstates += ( 3), memory.read(addr));
regs[0] = ( regs[0] & 1 ) | 16 | ( ( addr >> 8 ) & 40 );
if ( !(value & 128) ) regs[0] |= 68;
if (value & 0x80) regs[0] |= 128;
tstates += ( 1);
}; fn126(); }
	break;case 127: { var fn127 = function() {
	
	var addr = (regPairs[9] + offset) & 0xffff;
var value = (tstates += ( 3), memory.read(addr));
regs[0] = ( regs[0] & 1 ) | 16 | ( ( addr >> 8 ) & 40 );
if ( !(value & 128) ) regs[0] |= 68;
if (value & 0x80) regs[0] |= 128;
tstates += ( 1);
}; fn127(); }
	break;case 128: { var fn128 = function() {
	
	var addr = (regPairs[9] + offset) & 0xffff;
regs[3] = (tstates += ( 3), memory.read(addr));

regs[3] &= 254;

tstates += ( 1);
tstates += ( 3);
while (display.nextEventTime != null && display.nextEventTime < tstates) display.doEvent();
memory.write(addr, regs[3]);;
}; fn128(); }
	break;case 129: { var fn129 = function() {
	
	var addr = (regPairs[9] + offset) & 0xffff;
regs[2] = (tstates += ( 3), memory.read(addr));

regs[2] &= 254;

tstates += ( 1);
tstates += ( 3);
while (display.nextEventTime != null && display.nextEventTime < tstates) display.doEvent();
memory.write(addr, regs[2]);;
}; fn129(); }
	break;case 130: { var fn130 = function() {
	
	var addr = (regPairs[9] + offset) & 0xffff;
regs[5] = (tstates += ( 3), memory.read(addr));

regs[5] &= 254;

tstates += ( 1);
tstates += ( 3);
while (display.nextEventTime != null && display.nextEventTime < tstates) display.doEvent();
memory.write(addr, regs[5]);;
}; fn130(); }
	break;case 131: { var fn131 = function() {
	
	var addr = (regPairs[9] + offset) & 0xffff;
regs[4] = (tstates += ( 3), memory.read(addr));

regs[4] &= 254;

tstates += ( 1);
tstates += ( 3);
while (display.nextEventTime != null && display.nextEventTime < tstates) display.doEvent();
memory.write(addr, regs[4]);;
}; fn131(); }
	break;case 132: { var fn132 = function() {
	
	var addr = (regPairs[9] + offset) & 0xffff;
regs[7] = (tstates += ( 3), memory.read(addr));

regs[7] &= 254;

tstates += ( 1);
tstates += ( 3);
while (display.nextEventTime != null && display.nextEventTime < tstates) display.doEvent();
memory.write(addr, regs[7]);;
}; fn132(); }
	break;case 133: { var fn133 = function() {
	
	var addr = (regPairs[9] + offset) & 0xffff;
regs[6] = (tstates += ( 3), memory.read(addr));

regs[6] &= 254;

tstates += ( 1);
tstates += ( 3);
while (display.nextEventTime != null && display.nextEventTime < tstates) display.doEvent();
memory.write(addr, regs[6]);;
}; fn133(); }
	break;case 134: { var fn134 = function() {
	
	var addr = (regPairs[9] + offset) & 0xffff;
var val = (tstates += ( 3), memory.read(addr));
val &= 254;
tstates += ( 1);
tstates += ( 3);
while (display.nextEventTime != null && display.nextEventTime < tstates) display.doEvent();
memory.write(addr, val);;
}; fn134(); }
	break;case 135: { var fn135 = function() {
	
	var addr = (regPairs[9] + offset) & 0xffff;
regs[1] = (tstates += ( 3), memory.read(addr));

regs[1] &= 254;

tstates += ( 1);
tstates += ( 3);
while (display.nextEventTime != null && display.nextEventTime < tstates) display.doEvent();
memory.write(addr, regs[1]);;
}; fn135(); }
	break;case 136: { var fn136 = function() {
	
	var addr = (regPairs[9] + offset) & 0xffff;
regs[3] = (tstates += ( 3), memory.read(addr));

regs[3] &= 253;

tstates += ( 1);
tstates += ( 3);
while (display.nextEventTime != null && display.nextEventTime < tstates) display.doEvent();
memory.write(addr, regs[3]);;
}; fn136(); }
	break;case 137: { var fn137 = function() {
	
	var addr = (regPairs[9] + offset) & 0xffff;
regs[2] = (tstates += ( 3), memory.read(addr));

regs[2] &= 253;

tstates += ( 1);
tstates += ( 3);
while (display.nextEventTime != null && display.nextEventTime < tstates) display.doEvent();
memory.write(addr, regs[2]);;
}; fn137(); }
	break;case 138: { var fn138 = function() {
	
	var addr = (regPairs[9] + offset) & 0xffff;
regs[5] = (tstates += ( 3), memory.read(addr));

regs[5] &= 253;

tstates += ( 1);
tstates += ( 3);
while (display.nextEventTime != null && display.nextEventTime < tstates) display.doEvent();
memory.write(addr, regs[5]);;
}; fn138(); }
	break;case 139: { var fn139 = function() {
	
	var addr = (regPairs[9] + offset) & 0xffff;
regs[4] = (tstates += ( 3), memory.read(addr));

regs[4] &= 253;

tstates += ( 1);
tstates += ( 3);
while (display.nextEventTime != null && display.nextEventTime < tstates) display.doEvent();
memory.write(addr, regs[4]);;
}; fn139(); }
	break;case 140: { var fn140 = function() {
	
	var addr = (regPairs[9] + offset) & 0xffff;
regs[7] = (tstates += ( 3), memory.read(addr));

regs[7] &= 253;

tstates += ( 1);
tstates += ( 3);
while (display.nextEventTime != null && display.nextEventTime < tstates) display.doEvent();
memory.write(addr, regs[7]);;
}; fn140(); }
	break;case 141: { var fn141 = function() {
	
	var addr = (regPairs[9] + offset) & 0xffff;
regs[6] = (tstates += ( 3), memory.read(addr));

regs[6] &= 253;

tstates += ( 1);
tstates += ( 3);
while (display.nextEventTime != null && display.nextEventTime < tstates) display.doEvent();
memory.write(addr, regs[6]);;
}; fn141(); }
	break;case 142: { var fn142 = function() {
	
	var addr = (regPairs[9] + offset) & 0xffff;
var val = (tstates += ( 3), memory.read(addr));
val &= 253;
tstates += ( 1);
tstates += ( 3);
while (display.nextEventTime != null && display.nextEventTime < tstates) display.doEvent();
memory.write(addr, val);;
}; fn142(); }
	break;case 143: { var fn143 = function() {
	
	var addr = (regPairs[9] + offset) & 0xffff;
regs[1] = (tstates += ( 3), memory.read(addr));

regs[1] &= 253;

tstates += ( 1);
tstates += ( 3);
while (display.nextEventTime != null && display.nextEventTime < tstates) display.doEvent();
memory.write(addr, regs[1]);;
}; fn143(); }
	break;case 144: { var fn144 = function() {
	
	var addr = (regPairs[9] + offset) & 0xffff;
regs[3] = (tstates += ( 3), memory.read(addr));

regs[3] &= 251;

tstates += ( 1);
tstates += ( 3);
while (display.nextEventTime != null && display.nextEventTime < tstates) display.doEvent();
memory.write(addr, regs[3]);;
}; fn144(); }
	break;case 145: { var fn145 = function() {
	
	var addr = (regPairs[9] + offset) & 0xffff;
regs[2] = (tstates += ( 3), memory.read(addr));

regs[2] &= 251;

tstates += ( 1);
tstates += ( 3);
while (display.nextEventTime != null && display.nextEventTime < tstates) display.doEvent();
memory.write(addr, regs[2]);;
}; fn145(); }
	break;case 146: { var fn146 = function() {
	
	var addr = (regPairs[9] + offset) & 0xffff;
regs[5] = (tstates += ( 3), memory.read(addr));

regs[5] &= 251;

tstates += ( 1);
tstates += ( 3);
while (display.nextEventTime != null && display.nextEventTime < tstates) display.doEvent();
memory.write(addr, regs[5]);;
}; fn146(); }
	break;case 147: { var fn147 = function() {
	
	var addr = (regPairs[9] + offset) & 0xffff;
regs[4] = (tstates += ( 3), memory.read(addr));

regs[4] &= 251;

tstates += ( 1);
tstates += ( 3);
while (display.nextEventTime != null && display.nextEventTime < tstates) display.doEvent();
memory.write(addr, regs[4]);;
}; fn147(); }
	break;case 148: { var fn148 = function() {
	
	var addr = (regPairs[9] + offset) & 0xffff;
regs[7] = (tstates += ( 3), memory.read(addr));

regs[7] &= 251;

tstates += ( 1);
tstates += ( 3);
while (display.nextEventTime != null && display.nextEventTime < tstates) display.doEvent();
memory.write(addr, regs[7]);;
}; fn148(); }
	break;case 149: { var fn149 = function() {
	
	var addr = (regPairs[9] + offset) & 0xffff;
regs[6] = (tstates += ( 3), memory.read(addr));

regs[6] &= 251;

tstates += ( 1);
tstates += ( 3);
while (display.nextEventTime != null && display.nextEventTime < tstates) display.doEvent();
memory.write(addr, regs[6]);;
}; fn149(); }
	break;case 150: { var fn150 = function() {
	
	var addr = (regPairs[9] + offset) & 0xffff;
var val = (tstates += ( 3), memory.read(addr));
val &= 251;
tstates += ( 1);
tstates += ( 3);
while (display.nextEventTime != null && display.nextEventTime < tstates) display.doEvent();
memory.write(addr, val);;
}; fn150(); }
	break;case 151: { var fn151 = function() {
	
	var addr = (regPairs[9] + offset) & 0xffff;
regs[1] = (tstates += ( 3), memory.read(addr));

regs[1] &= 251;

tstates += ( 1);
tstates += ( 3);
while (display.nextEventTime != null && display.nextEventTime < tstates) display.doEvent();
memory.write(addr, regs[1]);;
}; fn151(); }
	break;case 152: { var fn152 = function() {
	
	var addr = (regPairs[9] + offset) & 0xffff;
regs[3] = (tstates += ( 3), memory.read(addr));

regs[3] &= 247;

tstates += ( 1);
tstates += ( 3);
while (display.nextEventTime != null && display.nextEventTime < tstates) display.doEvent();
memory.write(addr, regs[3]);;
}; fn152(); }
	break;case 153: { var fn153 = function() {
	
	var addr = (regPairs[9] + offset) & 0xffff;
regs[2] = (tstates += ( 3), memory.read(addr));

regs[2] &= 247;

tstates += ( 1);
tstates += ( 3);
while (display.nextEventTime != null && display.nextEventTime < tstates) display.doEvent();
memory.write(addr, regs[2]);;
}; fn153(); }
	break;case 154: { var fn154 = function() {
	
	var addr = (regPairs[9] + offset) & 0xffff;
regs[5] = (tstates += ( 3), memory.read(addr));

regs[5] &= 247;

tstates += ( 1);
tstates += ( 3);
while (display.nextEventTime != null && display.nextEventTime < tstates) display.doEvent();
memory.write(addr, regs[5]);;
}; fn154(); }
	break;case 155: { var fn155 = function() {
	
	var addr = (regPairs[9] + offset) & 0xffff;
regs[4] = (tstates += ( 3), memory.read(addr));

regs[4] &= 247;

tstates += ( 1);
tstates += ( 3);
while (display.nextEventTime != null && display.nextEventTime < tstates) display.doEvent();
memory.write(addr, regs[4]);;
}; fn155(); }
	break;case 156: { var fn156 = function() {
	
	var addr = (regPairs[9] + offset) & 0xffff;
regs[7] = (tstates += ( 3), memory.read(addr));

regs[7] &= 247;

tstates += ( 1);
tstates += ( 3);
while (display.nextEventTime != null && display.nextEventTime < tstates) display.doEvent();
memory.write(addr, regs[7]);;
}; fn156(); }
	break;case 157: { var fn157 = function() {
	
	var addr = (regPairs[9] + offset) & 0xffff;
regs[6] = (tstates += ( 3), memory.read(addr));

regs[6] &= 247;

tstates += ( 1);
tstates += ( 3);
while (display.nextEventTime != null && display.nextEventTime < tstates) display.doEvent();
memory.write(addr, regs[6]);;
}; fn157(); }
	break;case 158: { var fn158 = function() {
	
	var addr = (regPairs[9] + offset) & 0xffff;
var val = (tstates += ( 3), memory.read(addr));
val &= 247;
tstates += ( 1);
tstates += ( 3);
while (display.nextEventTime != null && display.nextEventTime < tstates) display.doEvent();
memory.write(addr, val);;
}; fn158(); }
	break;case 159: { var fn159 = function() {
	
	var addr = (regPairs[9] + offset) & 0xffff;
regs[1] = (tstates += ( 3), memory.read(addr));

regs[1] &= 247;

tstates += ( 1);
tstates += ( 3);
while (display.nextEventTime != null && display.nextEventTime < tstates) display.doEvent();
memory.write(addr, regs[1]);;
}; fn159(); }
	break;case 160: { var fn160 = function() {
	
	var addr = (regPairs[9] + offset) & 0xffff;
regs[3] = (tstates += ( 3), memory.read(addr));

regs[3] &= 239;

tstates += ( 1);
tstates += ( 3);
while (display.nextEventTime != null && display.nextEventTime < tstates) display.doEvent();
memory.write(addr, regs[3]);;
}; fn160(); }
	break;case 161: { var fn161 = function() {
	
	var addr = (regPairs[9] + offset) & 0xffff;
regs[2] = (tstates += ( 3), memory.read(addr));

regs[2] &= 239;

tstates += ( 1);
tstates += ( 3);
while (display.nextEventTime != null && display.nextEventTime < tstates) display.doEvent();
memory.write(addr, regs[2]);;
}; fn161(); }
	break;case 162: { var fn162 = function() {
	
	var addr = (regPairs[9] + offset) & 0xffff;
regs[5] = (tstates += ( 3), memory.read(addr));

regs[5] &= 239;

tstates += ( 1);
tstates += ( 3);
while (display.nextEventTime != null && display.nextEventTime < tstates) display.doEvent();
memory.write(addr, regs[5]);;
}; fn162(); }
	break;case 163: { var fn163 = function() {
	
	var addr = (regPairs[9] + offset) & 0xffff;
regs[4] = (tstates += ( 3), memory.read(addr));

regs[4] &= 239;

tstates += ( 1);
tstates += ( 3);
while (display.nextEventTime != null && display.nextEventTime < tstates) display.doEvent();
memory.write(addr, regs[4]);;
}; fn163(); }
	break;case 164: { var fn164 = function() {
	
	var addr = (regPairs[9] + offset) & 0xffff;
regs[7] = (tstates += ( 3), memory.read(addr));

regs[7] &= 239;

tstates += ( 1);
tstates += ( 3);
while (display.nextEventTime != null && display.nextEventTime < tstates) display.doEvent();
memory.write(addr, regs[7]);;
}; fn164(); }
	break;case 165: { var fn165 = function() {
	
	var addr = (regPairs[9] + offset) & 0xffff;
regs[6] = (tstates += ( 3), memory.read(addr));

regs[6] &= 239;

tstates += ( 1);
tstates += ( 3);
while (display.nextEventTime != null && display.nextEventTime < tstates) display.doEvent();
memory.write(addr, regs[6]);;
}; fn165(); }
	break;case 166: { var fn166 = function() {
	
	var addr = (regPairs[9] + offset) & 0xffff;
var val = (tstates += ( 3), memory.read(addr));
val &= 239;
tstates += ( 1);
tstates += ( 3);
while (display.nextEventTime != null && display.nextEventTime < tstates) display.doEvent();
memory.write(addr, val);;
}; fn166(); }
	break;case 167: { var fn167 = function() {
	
	var addr = (regPairs[9] + offset) & 0xffff;
regs[1] = (tstates += ( 3), memory.read(addr));

regs[1] &= 239;

tstates += ( 1);
tstates += ( 3);
while (display.nextEventTime != null && display.nextEventTime < tstates) display.doEvent();
memory.write(addr, regs[1]);;
}; fn167(); }
	break;case 168: { var fn168 = function() {
	
	var addr = (regPairs[9] + offset) & 0xffff;
regs[3] = (tstates += ( 3), memory.read(addr));

regs[3] &= 223;

tstates += ( 1);
tstates += ( 3);
while (display.nextEventTime != null && display.nextEventTime < tstates) display.doEvent();
memory.write(addr, regs[3]);;
}; fn168(); }
	break;case 169: { var fn169 = function() {
	
	var addr = (regPairs[9] + offset) & 0xffff;
regs[2] = (tstates += ( 3), memory.read(addr));

regs[2] &= 223;

tstates += ( 1);
tstates += ( 3);
while (display.nextEventTime != null && display.nextEventTime < tstates) display.doEvent();
memory.write(addr, regs[2]);;
}; fn169(); }
	break;case 170: { var fn170 = function() {
	
	var addr = (regPairs[9] + offset) & 0xffff;
regs[5] = (tstates += ( 3), memory.read(addr));

regs[5] &= 223;

tstates += ( 1);
tstates += ( 3);
while (display.nextEventTime != null && display.nextEventTime < tstates) display.doEvent();
memory.write(addr, regs[5]);;
}; fn170(); }
	break;case 171: { var fn171 = function() {
	
	var addr = (regPairs[9] + offset) & 0xffff;
regs[4] = (tstates += ( 3), memory.read(addr));

regs[4] &= 223;

tstates += ( 1);
tstates += ( 3);
while (display.nextEventTime != null && display.nextEventTime < tstates) display.doEvent();
memory.write(addr, regs[4]);;
}; fn171(); }
	break;case 172: { var fn172 = function() {
	
	var addr = (regPairs[9] + offset) & 0xffff;
regs[7] = (tstates += ( 3), memory.read(addr));

regs[7] &= 223;

tstates += ( 1);
tstates += ( 3);
while (display.nextEventTime != null && display.nextEventTime < tstates) display.doEvent();
memory.write(addr, regs[7]);;
}; fn172(); }
	break;case 173: { var fn173 = function() {
	
	var addr = (regPairs[9] + offset) & 0xffff;
regs[6] = (tstates += ( 3), memory.read(addr));

regs[6] &= 223;

tstates += ( 1);
tstates += ( 3);
while (display.nextEventTime != null && display.nextEventTime < tstates) display.doEvent();
memory.write(addr, regs[6]);;
}; fn173(); }
	break;case 174: { var fn174 = function() {
	
	var addr = (regPairs[9] + offset) & 0xffff;
var val = (tstates += ( 3), memory.read(addr));
val &= 223;
tstates += ( 1);
tstates += ( 3);
while (display.nextEventTime != null && display.nextEventTime < tstates) display.doEvent();
memory.write(addr, val);;
}; fn174(); }
	break;case 175: { var fn175 = function() {
	
	var addr = (regPairs[9] + offset) & 0xffff;
regs[1] = (tstates += ( 3), memory.read(addr));

regs[1] &= 223;

tstates += ( 1);
tstates += ( 3);
while (display.nextEventTime != null && display.nextEventTime < tstates) display.doEvent();
memory.write(addr, regs[1]);;
}; fn175(); }
	break;case 176: { var fn176 = function() {
	
	var addr = (regPairs[9] + offset) & 0xffff;
regs[3] = (tstates += ( 3), memory.read(addr));

regs[3] &= 191;

tstates += ( 1);
tstates += ( 3);
while (display.nextEventTime != null && display.nextEventTime < tstates) display.doEvent();
memory.write(addr, regs[3]);;
}; fn176(); }
	break;case 177: { var fn177 = function() {
	
	var addr = (regPairs[9] + offset) & 0xffff;
regs[2] = (tstates += ( 3), memory.read(addr));

regs[2] &= 191;

tstates += ( 1);
tstates += ( 3);
while (display.nextEventTime != null && display.nextEventTime < tstates) display.doEvent();
memory.write(addr, regs[2]);;
}; fn177(); }
	break;case 178: { var fn178 = function() {
	
	var addr = (regPairs[9] + offset) & 0xffff;
regs[5] = (tstates += ( 3), memory.read(addr));

regs[5] &= 191;

tstates += ( 1);
tstates += ( 3);
while (display.nextEventTime != null && display.nextEventTime < tstates) display.doEvent();
memory.write(addr, regs[5]);;
}; fn178(); }
	break;case 179: { var fn179 = function() {
	
	var addr = (regPairs[9] + offset) & 0xffff;
regs[4] = (tstates += ( 3), memory.read(addr));

regs[4] &= 191;

tstates += ( 1);
tstates += ( 3);
while (display.nextEventTime != null && display.nextEventTime < tstates) display.doEvent();
memory.write(addr, regs[4]);;
}; fn179(); }
	break;case 180: { var fn180 = function() {
	
	var addr = (regPairs[9] + offset) & 0xffff;
regs[7] = (tstates += ( 3), memory.read(addr));

regs[7] &= 191;

tstates += ( 1);
tstates += ( 3);
while (display.nextEventTime != null && display.nextEventTime < tstates) display.doEvent();
memory.write(addr, regs[7]);;
}; fn180(); }
	break;case 181: { var fn181 = function() {
	
	var addr = (regPairs[9] + offset) & 0xffff;
regs[6] = (tstates += ( 3), memory.read(addr));

regs[6] &= 191;

tstates += ( 1);
tstates += ( 3);
while (display.nextEventTime != null && display.nextEventTime < tstates) display.doEvent();
memory.write(addr, regs[6]);;
}; fn181(); }
	break;case 182: { var fn182 = function() {
	
	var addr = (regPairs[9] + offset) & 0xffff;
var val = (tstates += ( 3), memory.read(addr));
val &= 191;
tstates += ( 1);
tstates += ( 3);
while (display.nextEventTime != null && display.nextEventTime < tstates) display.doEvent();
memory.write(addr, val);;
}; fn182(); }
	break;case 183: { var fn183 = function() {
	
	var addr = (regPairs[9] + offset) & 0xffff;
regs[1] = (tstates += ( 3), memory.read(addr));

regs[1] &= 191;

tstates += ( 1);
tstates += ( 3);
while (display.nextEventTime != null && display.nextEventTime < tstates) display.doEvent();
memory.write(addr, regs[1]);;
}; fn183(); }
	break;case 184: { var fn184 = function() {
	
	var addr = (regPairs[9] + offset) & 0xffff;
regs[3] = (tstates += ( 3), memory.read(addr));

regs[3] &= 127;

tstates += ( 1);
tstates += ( 3);
while (display.nextEventTime != null && display.nextEventTime < tstates) display.doEvent();
memory.write(addr, regs[3]);;
}; fn184(); }
	break;case 185: { var fn185 = function() {
	
	var addr = (regPairs[9] + offset) & 0xffff;
regs[2] = (tstates += ( 3), memory.read(addr));

regs[2] &= 127;

tstates += ( 1);
tstates += ( 3);
while (display.nextEventTime != null && display.nextEventTime < tstates) display.doEvent();
memory.write(addr, regs[2]);;
}; fn185(); }
	break;case 186: { var fn186 = function() {
	
	var addr = (regPairs[9] + offset) & 0xffff;
regs[5] = (tstates += ( 3), memory.read(addr));

regs[5] &= 127;

tstates += ( 1);
tstates += ( 3);
while (display.nextEventTime != null && display.nextEventTime < tstates) display.doEvent();
memory.write(addr, regs[5]);;
}; fn186(); }
	break;case 187: { var fn187 = function() {
	
	var addr = (regPairs[9] + offset) & 0xffff;
regs[4] = (tstates += ( 3), memory.read(addr));

regs[4] &= 127;

tstates += ( 1);
tstates += ( 3);
while (display.nextEventTime != null && display.nextEventTime < tstates) display.doEvent();
memory.write(addr, regs[4]);;
}; fn187(); }
	break;case 188: { var fn188 = function() {
	
	var addr = (regPairs[9] + offset) & 0xffff;
regs[7] = (tstates += ( 3), memory.read(addr));

regs[7] &= 127;

tstates += ( 1);
tstates += ( 3);
while (display.nextEventTime != null && display.nextEventTime < tstates) display.doEvent();
memory.write(addr, regs[7]);;
}; fn188(); }
	break;case 189: { var fn189 = function() {
	
	var addr = (regPairs[9] + offset) & 0xffff;
regs[6] = (tstates += ( 3), memory.read(addr));

regs[6] &= 127;

tstates += ( 1);
tstates += ( 3);
while (display.nextEventTime != null && display.nextEventTime < tstates) display.doEvent();
memory.write(addr, regs[6]);;
}; fn189(); }
	break;case 190: { var fn190 = function() {
	
	var addr = (regPairs[9] + offset) & 0xffff;
var val = (tstates += ( 3), memory.read(addr));
val &= 127;
tstates += ( 1);
tstates += ( 3);
while (display.nextEventTime != null && display.nextEventTime < tstates) display.doEvent();
memory.write(addr, val);;
}; fn190(); }
	break;case 191: { var fn191 = function() {
	
	var addr = (regPairs[9] + offset) & 0xffff;
regs[1] = (tstates += ( 3), memory.read(addr));

regs[1] &= 127;

tstates += ( 1);
tstates += ( 3);
while (display.nextEventTime != null && display.nextEventTime < tstates) display.doEvent();
memory.write(addr, regs[1]);;
}; fn191(); }
	break;case 192: { var fn192 = function() {
	
	var addr = (regPairs[9] + offset) & 0xffff;
regs[3] = (tstates += ( 3), memory.read(addr));

regs[3] |= 1;

tstates += ( 1);
tstates += ( 3);
while (display.nextEventTime != null && display.nextEventTime < tstates) display.doEvent();
memory.write(addr, regs[3]);;
}; fn192(); }
	break;case 193: { var fn193 = function() {
	
	var addr = (regPairs[9] + offset) & 0xffff;
regs[2] = (tstates += ( 3), memory.read(addr));

regs[2] |= 1;

tstates += ( 1);
tstates += ( 3);
while (display.nextEventTime != null && display.nextEventTime < tstates) display.doEvent();
memory.write(addr, regs[2]);;
}; fn193(); }
	break;case 194: { var fn194 = function() {
	
	var addr = (regPairs[9] + offset) & 0xffff;
regs[5] = (tstates += ( 3), memory.read(addr));

regs[5] |= 1;

tstates += ( 1);
tstates += ( 3);
while (display.nextEventTime != null && display.nextEventTime < tstates) display.doEvent();
memory.write(addr, regs[5]);;
}; fn194(); }
	break;case 195: { var fn195 = function() {
	
	var addr = (regPairs[9] + offset) & 0xffff;
regs[4] = (tstates += ( 3), memory.read(addr));

regs[4] |= 1;

tstates += ( 1);
tstates += ( 3);
while (display.nextEventTime != null && display.nextEventTime < tstates) display.doEvent();
memory.write(addr, regs[4]);;
}; fn195(); }
	break;case 196: { var fn196 = function() {
	
	var addr = (regPairs[9] + offset) & 0xffff;
regs[7] = (tstates += ( 3), memory.read(addr));

regs[7] |= 1;

tstates += ( 1);
tstates += ( 3);
while (display.nextEventTime != null && display.nextEventTime < tstates) display.doEvent();
memory.write(addr, regs[7]);;
}; fn196(); }
	break;case 197: { var fn197 = function() {
	
	var addr = (regPairs[9] + offset) & 0xffff;
regs[6] = (tstates += ( 3), memory.read(addr));

regs[6] |= 1;

tstates += ( 1);
tstates += ( 3);
while (display.nextEventTime != null && display.nextEventTime < tstates) display.doEvent();
memory.write(addr, regs[6]);;
}; fn197(); }
	break;case 198: { var fn198 = function() {
	
	var addr = (regPairs[9] + offset) & 0xffff;
var val = (tstates += ( 3), memory.read(addr));
val |= 1;
tstates += ( 1);
tstates += ( 3);
while (display.nextEventTime != null && display.nextEventTime < tstates) display.doEvent();
memory.write(addr, val);;
}; fn198(); }
	break;case 199: { var fn199 = function() {
	
	var addr = (regPairs[9] + offset) & 0xffff;
regs[1] = (tstates += ( 3), memory.read(addr));

regs[1] |= 1;

tstates += ( 1);
tstates += ( 3);
while (display.nextEventTime != null && display.nextEventTime < tstates) display.doEvent();
memory.write(addr, regs[1]);;
}; fn199(); }
	break;case 200: { var fn200 = function() {
	
	var addr = (regPairs[9] + offset) & 0xffff;
regs[3] = (tstates += ( 3), memory.read(addr));

regs[3] |= 2;

tstates += ( 1);
tstates += ( 3);
while (display.nextEventTime != null && display.nextEventTime < tstates) display.doEvent();
memory.write(addr, regs[3]);;
}; fn200(); }
	break;case 201: { var fn201 = function() {
	
	var addr = (regPairs[9] + offset) & 0xffff;
regs[2] = (tstates += ( 3), memory.read(addr));

regs[2] |= 2;

tstates += ( 1);
tstates += ( 3);
while (display.nextEventTime != null && display.nextEventTime < tstates) display.doEvent();
memory.write(addr, regs[2]);;
}; fn201(); }
	break;case 202: { var fn202 = function() {
	
	var addr = (regPairs[9] + offset) & 0xffff;
regs[5] = (tstates += ( 3), memory.read(addr));

regs[5] |= 2;

tstates += ( 1);
tstates += ( 3);
while (display.nextEventTime != null && display.nextEventTime < tstates) display.doEvent();
memory.write(addr, regs[5]);;
}; fn202(); }
	break;case 203: { var fn203 = function() {
	
	var addr = (regPairs[9] + offset) & 0xffff;
regs[4] = (tstates += ( 3), memory.read(addr));

regs[4] |= 2;

tstates += ( 1);
tstates += ( 3);
while (display.nextEventTime != null && display.nextEventTime < tstates) display.doEvent();
memory.write(addr, regs[4]);;
}; fn203(); }
	break;case 204: { var fn204 = function() {
	
	var addr = (regPairs[9] + offset) & 0xffff;
regs[7] = (tstates += ( 3), memory.read(addr));

regs[7] |= 2;

tstates += ( 1);
tstates += ( 3);
while (display.nextEventTime != null && display.nextEventTime < tstates) display.doEvent();
memory.write(addr, regs[7]);;
}; fn204(); }
	break;case 205: { var fn205 = function() {
	
	var addr = (regPairs[9] + offset) & 0xffff;
regs[6] = (tstates += ( 3), memory.read(addr));

regs[6] |= 2;

tstates += ( 1);
tstates += ( 3);
while (display.nextEventTime != null && display.nextEventTime < tstates) display.doEvent();
memory.write(addr, regs[6]);;
}; fn205(); }
	break;case 206: { var fn206 = function() {
	
	var addr = (regPairs[9] + offset) & 0xffff;
var val = (tstates += ( 3), memory.read(addr));
val |= 2;
tstates += ( 1);
tstates += ( 3);
while (display.nextEventTime != null && display.nextEventTime < tstates) display.doEvent();
memory.write(addr, val);;
}; fn206(); }
	break;case 207: { var fn207 = function() {
	
	var addr = (regPairs[9] + offset) & 0xffff;
regs[1] = (tstates += ( 3), memory.read(addr));

regs[1] |= 2;

tstates += ( 1);
tstates += ( 3);
while (display.nextEventTime != null && display.nextEventTime < tstates) display.doEvent();
memory.write(addr, regs[1]);;
}; fn207(); }
	break;case 208: { var fn208 = function() {
	
	var addr = (regPairs[9] + offset) & 0xffff;
regs[3] = (tstates += ( 3), memory.read(addr));

regs[3] |= 4;

tstates += ( 1);
tstates += ( 3);
while (display.nextEventTime != null && display.nextEventTime < tstates) display.doEvent();
memory.write(addr, regs[3]);;
}; fn208(); }
	break;case 209: { var fn209 = function() {
	
	var addr = (regPairs[9] + offset) & 0xffff;
regs[2] = (tstates += ( 3), memory.read(addr));

regs[2] |= 4;

tstates += ( 1);
tstates += ( 3);
while (display.nextEventTime != null && display.nextEventTime < tstates) display.doEvent();
memory.write(addr, regs[2]);;
}; fn209(); }
	break;case 210: { var fn210 = function() {
	
	var addr = (regPairs[9] + offset) & 0xffff;
regs[5] = (tstates += ( 3), memory.read(addr));

regs[5] |= 4;

tstates += ( 1);
tstates += ( 3);
while (display.nextEventTime != null && display.nextEventTime < tstates) display.doEvent();
memory.write(addr, regs[5]);;
}; fn210(); }
	break;case 211: { var fn211 = function() {
	
	var addr = (regPairs[9] + offset) & 0xffff;
regs[4] = (tstates += ( 3), memory.read(addr));

regs[4] |= 4;

tstates += ( 1);
tstates += ( 3);
while (display.nextEventTime != null && display.nextEventTime < tstates) display.doEvent();
memory.write(addr, regs[4]);;
}; fn211(); }
	break;case 212: { var fn212 = function() {
	
	var addr = (regPairs[9] + offset) & 0xffff;
regs[7] = (tstates += ( 3), memory.read(addr));

regs[7] |= 4;

tstates += ( 1);
tstates += ( 3);
while (display.nextEventTime != null && display.nextEventTime < tstates) display.doEvent();
memory.write(addr, regs[7]);;
}; fn212(); }
	break;case 213: { var fn213 = function() {
	
	var addr = (regPairs[9] + offset) & 0xffff;
regs[6] = (tstates += ( 3), memory.read(addr));

regs[6] |= 4;

tstates += ( 1);
tstates += ( 3);
while (display.nextEventTime != null && display.nextEventTime < tstates) display.doEvent();
memory.write(addr, regs[6]);;
}; fn213(); }
	break;case 214: { var fn214 = function() {
	
	var addr = (regPairs[9] + offset) & 0xffff;
var val = (tstates += ( 3), memory.read(addr));
val |= 4;
tstates += ( 1);
tstates += ( 3);
while (display.nextEventTime != null && display.nextEventTime < tstates) display.doEvent();
memory.write(addr, val);;
}; fn214(); }
	break;case 215: { var fn215 = function() {
	
	var addr = (regPairs[9] + offset) & 0xffff;
regs[1] = (tstates += ( 3), memory.read(addr));

regs[1] |= 4;

tstates += ( 1);
tstates += ( 3);
while (display.nextEventTime != null && display.nextEventTime < tstates) display.doEvent();
memory.write(addr, regs[1]);;
}; fn215(); }
	break;case 216: { var fn216 = function() {
	
	var addr = (regPairs[9] + offset) & 0xffff;
regs[3] = (tstates += ( 3), memory.read(addr));

regs[3] |= 8;

tstates += ( 1);
tstates += ( 3);
while (display.nextEventTime != null && display.nextEventTime < tstates) display.doEvent();
memory.write(addr, regs[3]);;
}; fn216(); }
	break;case 217: { var fn217 = function() {
	
	var addr = (regPairs[9] + offset) & 0xffff;
regs[2] = (tstates += ( 3), memory.read(addr));

regs[2] |= 8;

tstates += ( 1);
tstates += ( 3);
while (display.nextEventTime != null && display.nextEventTime < tstates) display.doEvent();
memory.write(addr, regs[2]);;
}; fn217(); }
	break;case 218: { var fn218 = function() {
	
	var addr = (regPairs[9] + offset) & 0xffff;
regs[5] = (tstates += ( 3), memory.read(addr));

regs[5] |= 8;

tstates += ( 1);
tstates += ( 3);
while (display.nextEventTime != null && display.nextEventTime < tstates) display.doEvent();
memory.write(addr, regs[5]);;
}; fn218(); }
	break;case 219: { var fn219 = function() {
	
	var addr = (regPairs[9] + offset) & 0xffff;
regs[4] = (tstates += ( 3), memory.read(addr));

regs[4] |= 8;

tstates += ( 1);
tstates += ( 3);
while (display.nextEventTime != null && display.nextEventTime < tstates) display.doEvent();
memory.write(addr, regs[4]);;
}; fn219(); }
	break;case 220: { var fn220 = function() {
	
	var addr = (regPairs[9] + offset) & 0xffff;
regs[7] = (tstates += ( 3), memory.read(addr));

regs[7] |= 8;

tstates += ( 1);
tstates += ( 3);
while (display.nextEventTime != null && display.nextEventTime < tstates) display.doEvent();
memory.write(addr, regs[7]);;
}; fn220(); }
	break;case 221: { var fn221 = function() {
	
	var addr = (regPairs[9] + offset) & 0xffff;
regs[6] = (tstates += ( 3), memory.read(addr));

regs[6] |= 8;

tstates += ( 1);
tstates += ( 3);
while (display.nextEventTime != null && display.nextEventTime < tstates) display.doEvent();
memory.write(addr, regs[6]);;
}; fn221(); }
	break;case 222: { var fn222 = function() {
	
	var addr = (regPairs[9] + offset) & 0xffff;
var val = (tstates += ( 3), memory.read(addr));
val |= 8;
tstates += ( 1);
tstates += ( 3);
while (display.nextEventTime != null && display.nextEventTime < tstates) display.doEvent();
memory.write(addr, val);;
}; fn222(); }
	break;case 223: { var fn223 = function() {
	
	var addr = (regPairs[9] + offset) & 0xffff;
regs[1] = (tstates += ( 3), memory.read(addr));

regs[1] |= 8;

tstates += ( 1);
tstates += ( 3);
while (display.nextEventTime != null && display.nextEventTime < tstates) display.doEvent();
memory.write(addr, regs[1]);;
}; fn223(); }
	break;case 224: { var fn224 = function() {
	
	var addr = (regPairs[9] + offset) & 0xffff;
regs[3] = (tstates += ( 3), memory.read(addr));

regs[3] |= 16;

tstates += ( 1);
tstates += ( 3);
while (display.nextEventTime != null && display.nextEventTime < tstates) display.doEvent();
memory.write(addr, regs[3]);;
}; fn224(); }
	break;case 225: { var fn225 = function() {
	
	var addr = (regPairs[9] + offset) & 0xffff;
regs[2] = (tstates += ( 3), memory.read(addr));

regs[2] |= 16;

tstates += ( 1);
tstates += ( 3);
while (display.nextEventTime != null && display.nextEventTime < tstates) display.doEvent();
memory.write(addr, regs[2]);;
}; fn225(); }
	break;case 226: { var fn226 = function() {
	
	var addr = (regPairs[9] + offset) & 0xffff;
regs[5] = (tstates += ( 3), memory.read(addr));

regs[5] |= 16;

tstates += ( 1);
tstates += ( 3);
while (display.nextEventTime != null && display.nextEventTime < tstates) display.doEvent();
memory.write(addr, regs[5]);;
}; fn226(); }
	break;case 227: { var fn227 = function() {
	
	var addr = (regPairs[9] + offset) & 0xffff;
regs[4] = (tstates += ( 3), memory.read(addr));

regs[4] |= 16;

tstates += ( 1);
tstates += ( 3);
while (display.nextEventTime != null && display.nextEventTime < tstates) display.doEvent();
memory.write(addr, regs[4]);;
}; fn227(); }
	break;case 228: { var fn228 = function() {
	
	var addr = (regPairs[9] + offset) & 0xffff;
regs[7] = (tstates += ( 3), memory.read(addr));

regs[7] |= 16;

tstates += ( 1);
tstates += ( 3);
while (display.nextEventTime != null && display.nextEventTime < tstates) display.doEvent();
memory.write(addr, regs[7]);;
}; fn228(); }
	break;case 229: { var fn229 = function() {
	
	var addr = (regPairs[9] + offset) & 0xffff;
regs[6] = (tstates += ( 3), memory.read(addr));

regs[6] |= 16;

tstates += ( 1);
tstates += ( 3);
while (display.nextEventTime != null && display.nextEventTime < tstates) display.doEvent();
memory.write(addr, regs[6]);;
}; fn229(); }
	break;case 230: { var fn230 = function() {
	
	var addr = (regPairs[9] + offset) & 0xffff;
var val = (tstates += ( 3), memory.read(addr));
val |= 16;
tstates += ( 1);
tstates += ( 3);
while (display.nextEventTime != null && display.nextEventTime < tstates) display.doEvent();
memory.write(addr, val);;
}; fn230(); }
	break;case 231: { var fn231 = function() {
	
	var addr = (regPairs[9] + offset) & 0xffff;
regs[1] = (tstates += ( 3), memory.read(addr));

regs[1] |= 16;

tstates += ( 1);
tstates += ( 3);
while (display.nextEventTime != null && display.nextEventTime < tstates) display.doEvent();
memory.write(addr, regs[1]);;
}; fn231(); }
	break;case 232: { var fn232 = function() {
	
	var addr = (regPairs[9] + offset) & 0xffff;
regs[3] = (tstates += ( 3), memory.read(addr));

regs[3] |= 32;

tstates += ( 1);
tstates += ( 3);
while (display.nextEventTime != null && display.nextEventTime < tstates) display.doEvent();
memory.write(addr, regs[3]);;
}; fn232(); }
	break;case 233: { var fn233 = function() {
	
	var addr = (regPairs[9] + offset) & 0xffff;
regs[2] = (tstates += ( 3), memory.read(addr));

regs[2] |= 32;

tstates += ( 1);
tstates += ( 3);
while (display.nextEventTime != null && display.nextEventTime < tstates) display.doEvent();
memory.write(addr, regs[2]);;
}; fn233(); }
	break;case 234: { var fn234 = function() {
	
	var addr = (regPairs[9] + offset) & 0xffff;
regs[5] = (tstates += ( 3), memory.read(addr));

regs[5] |= 32;

tstates += ( 1);
tstates += ( 3);
while (display.nextEventTime != null && display.nextEventTime < tstates) display.doEvent();
memory.write(addr, regs[5]);;
}; fn234(); }
	break;case 235: { var fn235 = function() {
	
	var addr = (regPairs[9] + offset) & 0xffff;
regs[4] = (tstates += ( 3), memory.read(addr));

regs[4] |= 32;

tstates += ( 1);
tstates += ( 3);
while (display.nextEventTime != null && display.nextEventTime < tstates) display.doEvent();
memory.write(addr, regs[4]);;
}; fn235(); }
	break;case 236: { var fn236 = function() {
	
	var addr = (regPairs[9] + offset) & 0xffff;
regs[7] = (tstates += ( 3), memory.read(addr));

regs[7] |= 32;

tstates += ( 1);
tstates += ( 3);
while (display.nextEventTime != null && display.nextEventTime < tstates) display.doEvent();
memory.write(addr, regs[7]);;
}; fn236(); }
	break;case 237: { var fn237 = function() {
	
	var addr = (regPairs[9] + offset) & 0xffff;
regs[6] = (tstates += ( 3), memory.read(addr));

regs[6] |= 32;

tstates += ( 1);
tstates += ( 3);
while (display.nextEventTime != null && display.nextEventTime < tstates) display.doEvent();
memory.write(addr, regs[6]);;
}; fn237(); }
	break;case 238: { var fn238 = function() {
	
	var addr = (regPairs[9] + offset) & 0xffff;
var val = (tstates += ( 3), memory.read(addr));
val |= 32;
tstates += ( 1);
tstates += ( 3);
while (display.nextEventTime != null && display.nextEventTime < tstates) display.doEvent();
memory.write(addr, val);;
}; fn238(); }
	break;case 239: { var fn239 = function() {
	
	var addr = (regPairs[9] + offset) & 0xffff;
regs[1] = (tstates += ( 3), memory.read(addr));

regs[1] |= 32;

tstates += ( 1);
tstates += ( 3);
while (display.nextEventTime != null && display.nextEventTime < tstates) display.doEvent();
memory.write(addr, regs[1]);;
}; fn239(); }
	break;case 240: { var fn240 = function() {
	
	var addr = (regPairs[9] + offset) & 0xffff;
regs[3] = (tstates += ( 3), memory.read(addr));

regs[3] |= 64;

tstates += ( 1);
tstates += ( 3);
while (display.nextEventTime != null && display.nextEventTime < tstates) display.doEvent();
memory.write(addr, regs[3]);;
}; fn240(); }
	break;case 241: { var fn241 = function() {
	
	var addr = (regPairs[9] + offset) & 0xffff;
regs[2] = (tstates += ( 3), memory.read(addr));

regs[2] |= 64;

tstates += ( 1);
tstates += ( 3);
while (display.nextEventTime != null && display.nextEventTime < tstates) display.doEvent();
memory.write(addr, regs[2]);;
}; fn241(); }
	break;case 242: { var fn242 = function() {
	
	var addr = (regPairs[9] + offset) & 0xffff;
regs[5] = (tstates += ( 3), memory.read(addr));

regs[5] |= 64;

tstates += ( 1);
tstates += ( 3);
while (display.nextEventTime != null && display.nextEventTime < tstates) display.doEvent();
memory.write(addr, regs[5]);;
}; fn242(); }
	break;case 243: { var fn243 = function() {
	
	var addr = (regPairs[9] + offset) & 0xffff;
regs[4] = (tstates += ( 3), memory.read(addr));

regs[4] |= 64;

tstates += ( 1);
tstates += ( 3);
while (display.nextEventTime != null && display.nextEventTime < tstates) display.doEvent();
memory.write(addr, regs[4]);;
}; fn243(); }
	break;case 244: { var fn244 = function() {
	
	var addr = (regPairs[9] + offset) & 0xffff;
regs[7] = (tstates += ( 3), memory.read(addr));

regs[7] |= 64;

tstates += ( 1);
tstates += ( 3);
while (display.nextEventTime != null && display.nextEventTime < tstates) display.doEvent();
memory.write(addr, regs[7]);;
}; fn244(); }
	break;case 245: { var fn245 = function() {
	
	var addr = (regPairs[9] + offset) & 0xffff;
regs[6] = (tstates += ( 3), memory.read(addr));

regs[6] |= 64;

tstates += ( 1);
tstates += ( 3);
while (display.nextEventTime != null && display.nextEventTime < tstates) display.doEvent();
memory.write(addr, regs[6]);;
}; fn245(); }
	break;case 246: { var fn246 = function() {
	
	var addr = (regPairs[9] + offset) & 0xffff;
var val = (tstates += ( 3), memory.read(addr));
val |= 64;
tstates += ( 1);
tstates += ( 3);
while (display.nextEventTime != null && display.nextEventTime < tstates) display.doEvent();
memory.write(addr, val);;
}; fn246(); }
	break;case 247: { var fn247 = function() {
	
	var addr = (regPairs[9] + offset) & 0xffff;
regs[1] = (tstates += ( 3), memory.read(addr));

regs[1] |= 64;

tstates += ( 1);
tstates += ( 3);
while (display.nextEventTime != null && display.nextEventTime < tstates) display.doEvent();
memory.write(addr, regs[1]);;
}; fn247(); }
	break;case 248: { var fn248 = function() {
	
	var addr = (regPairs[9] + offset) & 0xffff;
regs[3] = (tstates += ( 3), memory.read(addr));

regs[3] |= 128;

tstates += ( 1);
tstates += ( 3);
while (display.nextEventTime != null && display.nextEventTime < tstates) display.doEvent();
memory.write(addr, regs[3]);;
}; fn248(); }
	break;case 249: { var fn249 = function() {
	
	var addr = (regPairs[9] + offset) & 0xffff;
regs[2] = (tstates += ( 3), memory.read(addr));

regs[2] |= 128;

tstates += ( 1);
tstates += ( 3);
while (display.nextEventTime != null && display.nextEventTime < tstates) display.doEvent();
memory.write(addr, regs[2]);;
}; fn249(); }
	break;case 250: { var fn250 = function() {
	
	var addr = (regPairs[9] + offset) & 0xffff;
regs[5] = (tstates += ( 3), memory.read(addr));

regs[5] |= 128;

tstates += ( 1);
tstates += ( 3);
while (display.nextEventTime != null && display.nextEventTime < tstates) display.doEvent();
memory.write(addr, regs[5]);;
}; fn250(); }
	break;case 251: { var fn251 = function() {
	
	var addr = (regPairs[9] + offset) & 0xffff;
regs[4] = (tstates += ( 3), memory.read(addr));

regs[4] |= 128;

tstates += ( 1);
tstates += ( 3);
while (display.nextEventTime != null && display.nextEventTime < tstates) display.doEvent();
memory.write(addr, regs[4]);;
}; fn251(); }
	break;case 252: { var fn252 = function() {
	
	var addr = (regPairs[9] + offset) & 0xffff;
regs[7] = (tstates += ( 3), memory.read(addr));

regs[7] |= 128;

tstates += ( 1);
tstates += ( 3);
while (display.nextEventTime != null && display.nextEventTime < tstates) display.doEvent();
memory.write(addr, regs[7]);;
}; fn252(); }
	break;case 253: { var fn253 = function() {
	
	var addr = (regPairs[9] + offset) & 0xffff;
regs[6] = (tstates += ( 3), memory.read(addr));

regs[6] |= 128;

tstates += ( 1);
tstates += ( 3);
while (display.nextEventTime != null && display.nextEventTime < tstates) display.doEvent();
memory.write(addr, regs[6]);;
}; fn253(); }
	break;case 254: { var fn254 = function() {
	
	var addr = (regPairs[9] + offset) & 0xffff;
var val = (tstates += ( 3), memory.read(addr));
val |= 128;
tstates += ( 1);
tstates += ( 3);
while (display.nextEventTime != null && display.nextEventTime < tstates) display.doEvent();
memory.write(addr, val);;
}; fn254(); }
	break;case 255: { var fn255 = function() {
	
	var addr = (regPairs[9] + offset) & 0xffff;
regs[1] = (tstates += ( 3), memory.read(addr));

regs[1] |= 128;

tstates += ( 1);
tstates += ( 3);
while (display.nextEventTime != null && display.nextEventTime < tstates) display.doEvent();
memory.write(addr, regs[1]);;
}; fn255(); }
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
		iff1 = snapRegs['iff1'] & 1;
		iff2 = snapRegs['iff2'] & 1;
		im = snapRegs['im'] & 1;
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
		iff1 = val & 1;
	}
	self.setIFF2 = function(val) {
		iff2 = val & 1;
	}
	self.setIM = function(val) {
		im = val & 1;
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
