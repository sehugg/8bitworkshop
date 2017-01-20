###
Z80 core.
To avoid mass repetition of code across the numerous instruction variants
the code for this component is built up programmatically and evaluated in
the global scope. CoffeeScript is used here for its support of multi-line
strings, and expression interpolation in strings.
###


###
Registers are stored in a typed array as a way of automatically casting
calculations to 8/16 bit, and to allow accessing them interchangeably as
register pairs or individual registers by having two arrays backed by the
same buffer. For the latter to work, we need to find out the endianness
of the host processor, as typed arrays are native-endian
	(http://lists.w3.org/Archives/Public/public-script-coord/2010AprJun/0048.html,
	http://cat-in-136.blogspot.com/2011/03/javascript-typed-array-use-native.html)
###

window.buildZ80 = (opts) ->
	opts ?= {}
	endianTestBuffer = new ArrayBuffer(2)
	endianTestUint16 = new Uint16Array(endianTestBuffer)
	endianTestUint8 = new Uint8Array(endianTestBuffer)
	endianTestUint16[0] = 0x0100
	isBigEndian = (endianTestUint8[0] == 0x01)

	# Offsets into register set when read as register pairs
	rpAF = 0
	rpBC = 1
	rpDE = 2
	rpHL = 3
	rpAF_ = 4
	rpBC_ = 5
	rpDE_ = 6
	rpHL_ = 7
	rpIX = 8
	rpIY = 9
	rpIR = 10
	rpSP = 11
	rpPC = 12

	registerPairIndexes = {
		'IX': 8, 'IY': 9
	}

	if isBigEndian
		rA = 0; rF = 1
		rB = 2; rC = 3
		rD = 4; rE = 5
		rH = 6; rL = 7
		rA_ = 8; rF_ = 9
		rB_ = 10; rC_ = 11
		rD_ = 12; rE_ = 13
		rH_ = 14; rL_ = 15
		rIXH = 16; rIXL = 17
		rIYH = 18; rIYL = 19
		rI = 20; rR = 21
		registerIndexes = {
			A: 0, F: 1
			B: 2, C: 3
			D: 4, E: 5
			H: 6, L: 7
			IXH: 16, IXL: 17
			IYH: 18, IYL: 19
		}
	else
		# little-endian
		rF = 0; rA = 1
		rC = 2; rB = 3
		rE = 4; rD = 5
		rL = 6; rH = 7
		rF_ = 8; rA_ = 9
		rC_ = 10; rB_ = 11
		rE_ = 12; rD_ = 13
		rL_ = 14; rH_ = 15
		rIXL = 16; rIXH = 17
		rIYL = 18; rIYH = 19
		rR = 20; rI = 21
		registerIndexes = {
			F: 0, A: 1
			C: 2, B: 3
			E: 4, D: 5
			L: 6, H: 7
			IXL: 16, IXH: 17
			IYL: 18, IYH: 19
		}

	FLAG_C = 0x01
	FLAG_N = 0x02
	FLAG_P = 0x04
	FLAG_V = 0x04
	FLAG_3 = 0x08
	FLAG_H = 0x10
	FLAG_5 = 0x20
	FLAG_Z = 0x40
	FLAG_S = 0x80

	# JS block setting up internal Z80 state and lookup tables

	setUpStateJS = """
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
		var halfcarryAddTable = new Uint8Array([0, #{FLAG_H}, #{FLAG_H}, #{FLAG_H}, 0, 0, 0, #{FLAG_H}]);
		var halfcarrySubTable = new Uint8Array([0, 0, #{FLAG_H}, 0, #{FLAG_H}, 0, #{FLAG_H}, #{FLAG_H}]);

		/*
			Similarly, overflow can be determined by looking at the 7th bits; again
			the hash into this table is r12
		*/
		var overflowAddTable = new Uint8Array([0, 0, 0, #{FLAG_V}, #{FLAG_V}, 0, 0, 0]);
		var overflowSubTable = new Uint8Array([0, #{FLAG_V}, 0, 0, 0, 0, #{FLAG_V}, 0]);

		var sz53Table = new Uint8Array(0x100); /* The S, Z, 5 and 3 bits of the index */
		var parityTable = new Uint8Array(0x100); /* The parity of the lookup value */
		var sz53pTable = new Uint8Array(0x100); /* OR the above two tables together */

		for (var i = 0; i < 0x100; i++) {
			sz53Table[i] = i & ( #{FLAG_3 | FLAG_5 | FLAG_S} );
			var j = i;
			var parity = 0;
			for (var k = 0; k < 8; k++) {
				parity ^= j & 1;
				j >>=1;
			}

			parityTable[i] = (parity ? 0 : #{FLAG_P});
			sz53pTable[i] = sz53Table[i] | parityTable[i];

			sz53Table[0] |= #{FLAG_Z};
			sz53pTable[0] |= #{FLAG_Z};
		}

		var interruptible = true;
		var interruptPending = false;
		var interruptDataBus = 0;
		var opcodePrefix = '';
	"""

	###
		Boilerplate generator: a helper to deal with classes of opcodes which perform
		the same task on different types of operands: e.g. XOR B, XOR (HL), XOR nn, XOR (IX+nn).
		This function accepts the parameter in question, and returns a set of canned strings
		for use in the opcode runner body:
		'getter': a block of code that performs any necessary memory access etc in order to
			make 'v' a valid expression;
		'v': an expression with no side effects, evaluating to the operand's value. (Must also be a valid lvalue for assignment)
		'trunc': an expression such as '& 0xff' to truncate v back to its proper range, if appropriate
		'setter': a block of code that writes an updated value back to its proper location, if any

		Passing hasIXOffsetAlready = true indicates that we have already read the offset value of (IX+nn)/(IY+nn)
		into a variable 'offset' (necessary because DDCB/FFCB instructions put this before the final opcode byte).
	###
	getParamBoilerplate = (param, hasIXOffsetAlready = false) ->
		if param.match(/^[AFBCDEHL]|I[XY][HL]$/)
			regNum = registerIndexes[param]
			{
				'getter': ''
				'v': "regs[#{regNum}]"
				'trunc': ''
				'setter': ''
			}
		else if param == '(HL)'
			{
				'getter': "var val = READMEM(regPairs[#{rpHL}]);"
				'v': 'val'
				'trunc': '& 0xff'
				'setter': """
					CONTEND_READ_NO_MREQ(regPairs[#{rpHL}], 1);
					WRITEMEM(regPairs[#{rpHL}], val);
				"""
			}
		else if param == 'nn'
			{
				'getter': "var val = READMEM(regPairs[#{rpPC}]); regPairs[#{rpPC}]++;"
				'v': 'val'
				'trunc': '& 0xff'
				'setter': ''
			}
		else if (match = param.match(/^\((I[XY])\+nn\)$/))
			rp = registerPairIndexes[match[1]]
			if hasIXOffsetAlready
				getter = ''
			else
				getter = """
					var offset = READMEM(regPairs[#{rpPC}]);
					if (offset & 0x80) offset -= 0x100;
					CONTEND_READ_NO_MREQ(regPairs[#{rpPC}], 1);
					CONTEND_READ_NO_MREQ(regPairs[#{rpPC}], 1);
					CONTEND_READ_NO_MREQ(regPairs[#{rpPC}], 1);
					CONTEND_READ_NO_MREQ(regPairs[#{rpPC}], 1);
					CONTEND_READ_NO_MREQ(regPairs[#{rpPC}], 1);
					regPairs[#{rpPC}]++;
				"""
			getter += """
				var addr = (regPairs[#{rp}] + offset) & 0xffff;
				var val = READMEM(addr);
			"""
			{
				'getter': getter
				'v': 'val'
				'trunc': '& 0xff'
				'setter': """
					CONTEND_READ_NO_MREQ(addr, 1);
					WRITEMEM(addr, val);
				"""
			}
		else if param == 'add'
			# special case for incorporating ADD/SUB into DAA calculation using a custom variable 'add'
			{
				'getter': ''
				'v': 'add'
				'trunc': ''
				'setter': ''
			}
		else
			throw "Unknown param format: #{param}"

	###
		Opcode generator functions: each returns a string of Javascript that performs the opcode
		when executed within this module's scope. Note that instructions with DDCBnn opcodes also
		require an 'offset' variable to be defined as nn (as a signed byte).
	###
	ADC_A = (param) ->
		operand = getParamBoilerplate(param)
		"""
			#{operand.getter}

			var adctemp = regs[#{rA}] + #{operand.v} + (regs[#{rF}] & #{FLAG_C});
			var lookup = ( (regs[#{rA}] & 0x88) >> 3 ) | ( (#{operand.v} & 0x88) >> 2 ) | ( (adctemp & 0x88) >> 1 );
			regs[#{rA}] = adctemp;
			regs[#{rF}] = ( adctemp & 0x100 ? #{FLAG_C} : 0 ) | halfcarryAddTable[lookup & 0x07] | overflowAddTable[lookup >> 4] | sz53Table[regs[#{rA}]];
		"""

	ADC_HL_RR = (rp2) ->
		"""
			var add16temp = regPairs[#{rpHL}] + regPairs[#{rp2}] + (regs[#{rF}] & #{FLAG_C});
			var lookup = (
				( (regPairs[#{rpHL}] & 0x8800) >> 11 ) |
				( (regPairs[#{rp2}] & 0x8800) >> 10 ) |
				( (add16temp & 0x8800) >>  9 )
			);
			regPairs[#{rpHL}] = add16temp;
			regs[#{rF}] = (
				(add16temp & 0x10000 ? #{FLAG_C} : 0) |
				overflowAddTable[lookup >> 4] |
				(regs[#{rH}] & #{FLAG_3 | FLAG_5 | FLAG_S}) |
				halfcarryAddTable[lookup & 0x07] |
				(regPairs[#{rpHL}] ? 0 : #{FLAG_Z})
			);
			CONTEND_READ_NO_MREQ(regPairs[#{rpIR}], 1);
			CONTEND_READ_NO_MREQ(regPairs[#{rpIR}], 1);
			CONTEND_READ_NO_MREQ(regPairs[#{rpIR}], 1);
			CONTEND_READ_NO_MREQ(regPairs[#{rpIR}], 1);
			CONTEND_READ_NO_MREQ(regPairs[#{rpIR}], 1);
			CONTEND_READ_NO_MREQ(regPairs[#{rpIR}], 1);
			CONTEND_READ_NO_MREQ(regPairs[#{rpIR}], 1);
		"""

	ADD_A = (param) ->
		operand = getParamBoilerplate(param)
		"""
			#{operand.getter}

			var addtemp = regs[#{rA}] + #{operand.v};
			var lookup = ( (regs[#{rA}] & 0x88) >> 3 ) | ( (#{operand.v} & 0x88) >> 2 ) | ( (addtemp & 0x88) >> 1 );
			regs[#{rA}] = addtemp;
			regs[#{rF}] = ( addtemp & 0x100 ? #{FLAG_C} : 0 ) | halfcarryAddTable[lookup & 0x07] | overflowAddTable[lookup >> 4] | sz53Table[regs[#{rA}]];
		"""

	ADD_RR_RR = (rp1, rp2) ->
		"""
			var add16temp = regPairs[#{rp1}] + regPairs[#{rp2}];
			var lookup = ( (regPairs[#{rp1}] & 0x0800) >> 11 ) | ( (regPairs[#{rp2}] & 0x0800) >> 10 ) | ( (add16temp & 0x0800) >>  9 );
			regPairs[#{rp1}] = add16temp;
			regs[#{rF}] = ( regs[#{rF}] & ( #{FLAG_V | FLAG_Z | FLAG_S} ) ) | ( add16temp & 0x10000 ? #{FLAG_C} : 0 ) | ( ( add16temp >> 8 ) & ( #{FLAG_3 | FLAG_5} ) ) | halfcarryAddTable[lookup];
			CONTEND_READ_NO_MREQ(regPairs[#{rpIR}], 1);
			CONTEND_READ_NO_MREQ(regPairs[#{rpIR}], 1);
			CONTEND_READ_NO_MREQ(regPairs[#{rpIR}], 1);
			CONTEND_READ_NO_MREQ(regPairs[#{rpIR}], 1);
			CONTEND_READ_NO_MREQ(regPairs[#{rpIR}], 1);
			CONTEND_READ_NO_MREQ(regPairs[#{rpIR}], 1);
			CONTEND_READ_NO_MREQ(regPairs[#{rpIR}], 1);
		"""

	AND_A = (param) ->
		operand = getParamBoilerplate(param)
		"""
			#{operand.getter}

			regs[#{rA}] &= #{operand.v};
			regs[#{rF}] = #{FLAG_H} | sz53pTable[regs[#{rA}]];
		"""

	BIT_N_iRRpNNi = (bit, rp) -> # requires 'offset'
		if bit == 7
			updateSignFlag = "if (value & 0x80) regs[#{rF}] |= #{FLAG_S};"
		else
			updateSignFlag = ""

		"""
			var addr = (regPairs[#{rp}] + offset) & 0xffff;
			var value = READMEM(addr);
			regs[#{rF}] = ( regs[#{rF}] & #{FLAG_C} ) | #{FLAG_H} | ( ( addr >> 8 ) & #{FLAG_3 | FLAG_5} );
			if ( !(value & #{0x01 << bit}) ) regs[#{rF}] |= #{FLAG_P | FLAG_Z};
			#{updateSignFlag}
			CONTEND_READ_NO_MREQ(addr, 1);
		"""

	BIT_N_iHLi = (bit) ->
		if bit == 7
			updateSignFlag = "if (value & 0x80) regs[#{rF}] |= #{FLAG_S};"
		else
			updateSignFlag = ""

		"""
			var addr = regPairs[#{rpHL}];
			var value = READMEM(addr);
			CONTEND_READ_NO_MREQ(addr, 1);
			regs[#{rF}] = ( regs[#{rF}] & #{FLAG_C} ) | #{FLAG_H} | ( value & #{FLAG_3 | FLAG_5} );
			if( !(value & #{0x01 << bit}) ) regs[#{rF}] |= #{FLAG_P | FLAG_Z};
			#{updateSignFlag}
		"""

	BIT_N_R = (bit, r) ->
		if bit == 7
			updateSignFlag = "if (regs[#{r}] & 0x80) regs[#{rF}] |= #{FLAG_S};"
		else
			updateSignFlag = ""
		"""
			regs[#{rF}] = ( regs[#{rF}] & #{FLAG_C} ) | #{FLAG_H} | ( regs[#{r}] & #{FLAG_3 | FLAG_5} );
			if( !(regs[#{r}] & #{0x01 << bit}) ) regs[#{rF}] |= #{FLAG_P | FLAG_Z};
			#{updateSignFlag}
		"""

	CALL_C_NN = (flag, sense) ->
		condition = "regs[#{rF}] & #{flag}"
		condition = "!(#{condition})" if not sense
		"""
			if (#{condition}) {
				var l = READMEM(regPairs[#{rpPC}]); regPairs[#{rpPC}]++;
				var h = READMEM(regPairs[#{rpPC}]);
				CONTEND_READ_NO_MREQ(regPairs[#{rpPC}], 1);
				regPairs[#{rpPC}]++;
				regPairs[#{rpSP}]--; WRITEMEM(regPairs[#{rpSP}], regPairs[#{rpPC}] >> 8);
				regPairs[#{rpSP}]--; WRITEMEM(regPairs[#{rpSP}], regPairs[#{rpPC}] & 0xff);
				regPairs[#{rpPC}] = (h<<8) | l;
			} else {
				CONTEND_READ(regPairs[#{rpPC}], 3);
				regPairs[#{rpPC}]++;
				CONTEND_READ(regPairs[#{rpPC}], 3);
				regPairs[#{rpPC}]++;
			}
		"""

	CALL_NN = () ->
		"""
			var l = READMEM(regPairs[#{rpPC}]); regPairs[#{rpPC}]++;
			var h = READMEM(regPairs[#{rpPC}]);
			CONTEND_READ_NO_MREQ(regPairs[#{rpPC}], 1);
			regPairs[#{rpPC}]++;
			regPairs[#{rpSP}]--; WRITEMEM(regPairs[#{rpSP}], regPairs[#{rpPC}] >> 8);
			regPairs[#{rpSP}]--; WRITEMEM(regPairs[#{rpSP}], regPairs[#{rpPC}] & 0xff);
			regPairs[#{rpPC}] = (h<<8) | l;
		"""

	CCF = () ->
		"""
			regs[#{rF}] = ( regs[#{rF}] & #{FLAG_P | FLAG_Z | FLAG_S} ) | ( (regs[#{rF}] & #{FLAG_C}) ? #{FLAG_H} : #{FLAG_C} ) | ( regs[#{rA}] & #{FLAG_3 | FLAG_5} );
		"""

	CP_A = (param) ->
		operand = getParamBoilerplate(param)
		"""
			#{operand.getter}

			var cptemp = regs[#{rA}] - #{operand.v};
			var lookup = ( (regs[#{rA}] & 0x88) >> 3 ) | ( (#{operand.v} & 0x88) >> 2 ) | ( (cptemp & 0x88) >> 1 );
			regs[#{rF}] = ( cptemp & 0x100 ? #{FLAG_C} : ( cptemp ? 0 : #{FLAG_Z} ) ) | #{FLAG_N} | halfcarrySubTable[lookup & 0x07] | overflowSubTable[lookup >> 4] | ( #{operand.v} & #{FLAG_3 | FLAG_5} ) | ( cptemp & #{FLAG_S} );
		"""

	CPI_CPD = (modifier) ->
		"""
			var value = READMEM(regPairs[#{rpHL}]);
			var bytetemp = (regs[#{rA}] - value) & 0xff;
			var lookup = ((regs[#{rA}] & 0x08) >> 3) | ((value & 0x08) >> 2) | ((bytetemp & 0x08) >> 1);
			var originalHL = regPairs[#{rpHL}];
			CONTEND_READ_NO_MREQ(originalHL, 1);
			CONTEND_READ_NO_MREQ(originalHL, 1);
			CONTEND_READ_NO_MREQ(originalHL, 1);
			CONTEND_READ_NO_MREQ(originalHL, 1);
			CONTEND_READ_NO_MREQ(originalHL, 1);
			regPairs[#{rpHL}]#{modifier}; regPairs[#{rpBC}]--;
			regs[#{rF}] = (regs[#{rF}] & #{FLAG_C}) | (regPairs[#{rpBC}] ? #{FLAG_V | FLAG_N} : #{FLAG_N}) | halfcarrySubTable[lookup] | (bytetemp ? 0 : #{FLAG_Z}) | (bytetemp & #{FLAG_S});
			if (regs[#{rF}] & #{FLAG_H}) bytetemp--;
			regs[#{rF}] |= (bytetemp & #{FLAG_3}) | ( (bytetemp & 0x02) ? #{FLAG_5} : 0 );
		"""

	CPIR_CPDR = (modifier) ->
		"""
			#{CPI_CPD(modifier)}
			if ((regs[#{rF}] & #{FLAG_V | FLAG_Z}) == #{FLAG_V}) {
				regPairs[#{rpPC}] -= 2;
				CONTEND_READ_NO_MREQ(originalHL, 1);
				CONTEND_READ_NO_MREQ(originalHL, 1);
				CONTEND_READ_NO_MREQ(originalHL, 1);
				CONTEND_READ_NO_MREQ(originalHL, 1);
				CONTEND_READ_NO_MREQ(originalHL, 1);
			}
		"""

	CPD = () ->
		CPI_CPD('--')

	CPI = () ->
		CPI_CPD('++')

	CPDR = () ->
		CPIR_CPDR('--')

	CPIR = () ->
		CPIR_CPDR('++')


	DAA = () ->
		subClause = SUB_A('add')
		addClause = ADD_A('add')
		"""
			var add = 0;
			var carry = regs[#{rF}] & #{FLAG_C};
			if( ( regs[#{rF}] & #{FLAG_H} ) || ( ( regs[#{rA}] & 0x0f ) > 9 ) ) add = 6;
			if( carry || ( regs[#{rA}] > 0x99 ) ) add |= 0x60;
			if( regs[#{rA}] > 0x99 ) carry = #{FLAG_C};
			if( regs[#{rF}] & #{FLAG_N} ) {
				#{subClause}
			} else {
				#{addClause}
			}
			regs[#{rF}] = ( regs[#{rF}] & #{~( FLAG_C | FLAG_P )} ) | carry | parityTable[regs[#{rA}]];
		"""

	CPL = () ->
		"""
			regs[#{rA}] ^= 0xff;
			regs[#{rF}] = (regs[#{rF}] & #{FLAG_C | FLAG_P | FLAG_Z | FLAG_S}) | (regs[#{rA}] & #{FLAG_3 | FLAG_5}) | #{FLAG_N | FLAG_H};
		"""

	DEC = (param) ->
		operand = getParamBoilerplate(param)
		"""
			#{operand.getter}

			regs[#{rF}] = (regs[#{rF}] & #{FLAG_C} ) | ( #{operand.v} & 0x0f ? 0 : #{FLAG_H} ) | #{FLAG_N};
			#{operand.v} = (#{operand.v} - 1) #{operand.trunc};

			#{operand.setter}
			regs[#{rF}] |= (#{operand.v} == 0x7f ? #{FLAG_V} : 0) | sz53Table[#{operand.v}];
		"""

	DEC_RR = (rp) ->
		"""
			regPairs[#{rp}]--;
			CONTEND_READ_NO_MREQ(regPairs[#{rpIR}], 1);
			CONTEND_READ_NO_MREQ(regPairs[#{rpIR}], 1);
		"""

	DI = () ->
		"""
			iff1 = iff2 = 0;
		"""

	DJNZ_N = () ->
		"""
			CONTEND_READ_NO_MREQ(regPairs[#{rpIR}], 1);
			regs[#{rB}]--;
			if (regs[#{rB}]) {
				/* take branch */
				var offset = READMEM(regPairs[#{rpPC}]);
				CONTEND_READ_NO_MREQ(regPairs[#{rpPC}], 1);
				CONTEND_READ_NO_MREQ(regPairs[#{rpPC}], 1);
				CONTEND_READ_NO_MREQ(regPairs[#{rpPC}], 1);
				CONTEND_READ_NO_MREQ(regPairs[#{rpPC}], 1);
				CONTEND_READ_NO_MREQ(regPairs[#{rpPC}], 1);
				regPairs[#{rpPC}]++;
				regPairs[#{rpPC}] += (offset & 0x80 ? offset - 0x100 : offset);
			} else {
				/* do not take branch */
				CONTEND_READ(regPairs[#{rpPC}], 3);
				regPairs[#{rpPC}]++;
			}
		"""

	EI = () ->
		"""
			iff1 = iff2 = 1;
			interruptible = false;
		"""

	EX_iSPi_RR = (rp) ->
		"""
			var l = READMEM(regPairs[#{rpSP}]);
			var spPlus1 = (regPairs[#{rpSP}] + 1) & 0xffff;
			var h = READMEM(spPlus1);
			CONTEND_READ_NO_MREQ(spPlus1, 1);
			WRITEMEM(spPlus1, regPairs[#{rp}] >> 8);
			WRITEMEM(regPairs[#{rpSP}], regPairs[#{rp}] & 0xff);
			regPairs[#{rp}] = (h<<8) | l;
			CONTEND_WRITE_NO_MREQ(regPairs[#{rpSP}], 1);
			CONTEND_WRITE_NO_MREQ(regPairs[#{rpSP}], 1);
		"""

	EX_RR_RR = (rp1, rp2) ->
		"""
			var temp = regPairs[#{rp1}];
			regPairs[#{rp1}] = regPairs[#{rp2}];
			regPairs[#{rp2}] = temp;
		"""

	EXX = () ->
		"""
			var wordtemp;
			wordtemp = regPairs[#{rpBC}]; regPairs[#{rpBC}] = regPairs[#{rpBC_}]; regPairs[#{rpBC_}] = wordtemp;
			wordtemp = regPairs[#{rpDE}]; regPairs[#{rpDE}] = regPairs[#{rpDE_}]; regPairs[#{rpDE_}] = wordtemp;
			wordtemp = regPairs[#{rpHL}]; regPairs[#{rpHL}] = regPairs[#{rpHL_}]; regPairs[#{rpHL_}] = wordtemp;
		"""

	HALT = () ->
		"""
			halted = true;
			regPairs[#{rpPC}]--;
		"""

	IM = (val) ->
		"""
			im = #{val};
		"""

	IN_A_N = () ->
		"""
			var val = READMEM(regPairs[#{rpPC}]); regPairs[#{rpPC}]++;
			var port = (regs[#{rA}] << 8) | val;
			CONTEND_PORT_EARLY(port);
			regs[#{rA}] = ioBus.read(port);
			CONTEND_PORT_LATE(port);
		"""

	IN_F_iCi = () ->
		# as IN_R_iCi, but result is written to a local variable rather than a register
		"""
			var port = regPairs[#{rpBC}];
			CONTEND_PORT_EARLY(port);
			var result = ioBus.read(port);
			CONTEND_PORT_LATE(port);
			regs[#{rF}] = (regs[#{rF}] & #{FLAG_C}) | sz53pTable[result];
		"""

	IN_R_iCi = (r) ->
		"""
			var port = regPairs[#{rpBC}];
			CONTEND_PORT_EARLY(port);
			regs[#{r}] = ioBus.read(port);
			CONTEND_PORT_LATE(port);
			regs[#{rF}] = (regs[#{rF}] & #{FLAG_C}) | sz53pTable[regs[#{r}]];
		"""

	INC = (param) ->
		operand = getParamBoilerplate(param)
		"""
			#{operand.getter}

			regs[#{rF}] = (regs[#{rF}] & #{FLAG_C}) | (#{operand.v} & 0x0f ? 0 : #{FLAG_H}) | #{FLAG_N};
			#{operand.v} = (#{operand.v} + 1) #{operand.trunc};

			#{operand.setter}
			regs[#{rF}] = (regs[#{rF}] & #{FLAG_C}) | ( #{operand.v} == 0x80 ? #{FLAG_V} : 0 ) | ( #{operand.v} & 0x0f ? 0 : #{FLAG_H} ) | sz53Table[#{operand.v}];
		"""

	INC_RR = (rp) ->
		"""
			regPairs[#{rp}]++;
			CONTEND_READ_NO_MREQ(regPairs[#{rpIR}], 1);
			CONTEND_READ_NO_MREQ(regPairs[#{rpIR}], 1);
		"""

	INI_IND = (modifier) ->
		"""
			CONTEND_READ_NO_MREQ(regPairs[#{rpIR}], 1);
			CONTEND_PORT_EARLY(regPairs[#{rpBC}]);
			var initemp = ioBus.read(regPairs[#{rpBC}]);
			CONTEND_PORT_LATE(regPairs[#{rpBC}]);
			WRITEMEM(regPairs[#{rpHL}], initemp);
			regs[#{rB}]--;
			var originalHL = regPairs[#{rpHL}];
			regPairs[#{rpHL}]#{modifier}#{modifier};
			var initemp2 = (initemp + regs[#{rC}] #{modifier} 1) & 0xff;

			regs[#{rF}] = (initemp & 0x80 ? #{FLAG_N} : 0) | ((initemp2 < initemp) ? #{FLAG_H | FLAG_C} : 0 ) | ( parityTable[ (initemp2 & 0x07) ^ regs[#{rB}] ] ? #{FLAG_P} : 0 ) | sz53Table[regs[#{rB}]];
		"""

	INIR_INDR = (modifier) ->
		"""
			#{INI_IND(modifier)}
			if (regs[#{rB}]) {
				CONTEND_WRITE_NO_MREQ(originalHL, 1);
				CONTEND_WRITE_NO_MREQ(originalHL, 1);
				CONTEND_WRITE_NO_MREQ(originalHL, 1);
				CONTEND_WRITE_NO_MREQ(originalHL, 1);
				CONTEND_WRITE_NO_MREQ(originalHL, 1);
				regPairs[#{rpPC}] -= 2;
			}
		"""

	INI = () ->
		INI_IND('+')

	IND = () ->
		INI_IND('-')

	INIR = () ->
		INIR_INDR('+')

	INDR = () ->
		INIR_INDR('-')

	JP_C_NN = (flag, sense) ->
		condition = "regs[#{rF}] & #{flag}"
		condition = "!(#{condition})" if not sense
		"""
			if (#{condition}) {
				var l = READMEM(regPairs[#{rpPC}]); regPairs[#{rpPC}]++;
				var h = READMEM(regPairs[#{rpPC}]); regPairs[#{rpPC}]++;
				regPairs[#{rpPC}] = (h<<8) | l;
			} else {
				CONTEND_READ(regPairs[#{rpPC}], 3);
				regPairs[#{rpPC}]++;
				CONTEND_READ(regPairs[#{rpPC}], 3);
				regPairs[#{rpPC}]++;
			}
		"""

	JP_RR = (rp) ->
		"""
			regPairs[#{rpPC}] = regPairs[#{rp}];
		"""

	JP_NN = () ->
		"""
			var l = READMEM(regPairs[#{rpPC}]); regPairs[#{rpPC}]++;
			var h = READMEM(regPairs[#{rpPC}]); regPairs[#{rpPC}]++;
			regPairs[#{rpPC}] = (h<<8) | l;
		"""

	JR_C_N = (flag, sense) ->
		condition = "regs[#{rF}] & #{flag}"
		condition = "!(#{condition})" if not sense
		"""
			if (#{condition}) {
				var offset = READMEM(regPairs[#{rpPC}]);
				CONTEND_READ_NO_MREQ(regPairs[#{rpPC}], 1);
				CONTEND_READ_NO_MREQ(regPairs[#{rpPC}], 1);
				CONTEND_READ_NO_MREQ(regPairs[#{rpPC}], 1);
				CONTEND_READ_NO_MREQ(regPairs[#{rpPC}], 1);
				CONTEND_READ_NO_MREQ(regPairs[#{rpPC}], 1);
				regPairs[#{rpPC}]++;
				regPairs[#{rpPC}] += (offset & 0x80 ? offset - 0x100 : offset);
			} else {
				CONTEND_READ(regPairs[#{rpPC}], 3);
				regPairs[#{rpPC}]++; /* skip past offset byte */
			}
		"""

	JR_N = () ->
		"""
			var offset = READMEM(regPairs[#{rpPC}]);
			CONTEND_READ_NO_MREQ(regPairs[#{rpPC}], 1);
			CONTEND_READ_NO_MREQ(regPairs[#{rpPC}], 1);
			CONTEND_READ_NO_MREQ(regPairs[#{rpPC}], 1);
			CONTEND_READ_NO_MREQ(regPairs[#{rpPC}], 1);
			CONTEND_READ_NO_MREQ(regPairs[#{rpPC}], 1);
			regPairs[#{rpPC}]++;
			regPairs[#{rpPC}] += (offset & 0x80 ? offset - 0x100 : offset);
		"""

	LD_A_iNNi = () ->
		"""
			var l = READMEM(regPairs[#{rpPC}]); regPairs[#{rpPC}]++;
			var h = READMEM(regPairs[#{rpPC}]); regPairs[#{rpPC}]++;
			var addr = (h<<8) | l;
			regs[#{rA}] = READMEM(addr);
		"""

	LD_iNNi_A = () ->
		"""
			var l = READMEM(regPairs[#{rpPC}]); regPairs[#{rpPC}]++;
			var h = READMEM(regPairs[#{rpPC}]); regPairs[#{rpPC}]++;
			var addr = (h<<8) | l;
			WRITEMEM(addr, regs[#{rA}]);
		"""

	LD_iNNi_RR = (rp) ->
		"""
			var l = READMEM(regPairs[#{rpPC}]); regPairs[#{rpPC}]++;
			var h = READMEM(regPairs[#{rpPC}]); regPairs[#{rpPC}]++;
			var addr = (h<<8) | l;
			WRITEMEM(addr, regPairs[#{rp}] & 0xff);
			addr = (addr + 1) & 0xffff;
			WRITEMEM(addr, regPairs[#{rp}] >> 8);
		"""

	LD_iRRi_N = (rp) ->
		"""
			var n = READMEM(regPairs[#{rpPC}]); regPairs[#{rpPC}]++;
			WRITEMEM(regPairs[#{rp}], n);
		"""

	LD_iRRi_R = (rp, r) ->
		"""
			WRITEMEM(regPairs[#{rp}], regs[#{r}]);
		"""

	LD_iRRpNNi_N = (rp) ->
		"""
			var offset = READMEM(regPairs[#{rpPC}]); regPairs[#{rpPC}]++;
			if (offset & 0x80) offset -= 0x100;
			var addr = (regPairs[#{rp}] + offset) & 0xffff;

			var val = READMEM(regPairs[#{rpPC}]);
			CONTEND_READ_NO_MREQ(regPairs[#{rpPC}], 1);
			CONTEND_READ_NO_MREQ(regPairs[#{rpPC}], 1);
			regPairs[#{rpPC}]++;
			WRITEMEM(addr, val);
		"""

	LD_iRRpNNi_R = (rp, r) ->
		"""
			var offset = READMEM(regPairs[#{rpPC}]);
			CONTEND_READ_NO_MREQ(regPairs[#{rpPC}], 1);
			CONTEND_READ_NO_MREQ(regPairs[#{rpPC}], 1);
			CONTEND_READ_NO_MREQ(regPairs[#{rpPC}], 1);
			CONTEND_READ_NO_MREQ(regPairs[#{rpPC}], 1);
			CONTEND_READ_NO_MREQ(regPairs[#{rpPC}], 1);
			regPairs[#{rpPC}]++;
			if (offset & 0x80) offset -= 0x100;
			var addr = (regPairs[#{rp}] + offset) & 0xffff;

			WRITEMEM(addr, regs[#{r}]);
		"""

	LD_R_iRRi = (r, rp) ->
		"""
			regs[#{r}] = READMEM(regPairs[#{rp}]);
		"""

	LD_R_iRRpNNi = (r, rp) ->
		"""
			var offset = READMEM(regPairs[#{rpPC}]);
			CONTEND_READ_NO_MREQ(regPairs[#{rpPC}], 1);
			CONTEND_READ_NO_MREQ(regPairs[#{rpPC}], 1);
			CONTEND_READ_NO_MREQ(regPairs[#{rpPC}], 1);
			CONTEND_READ_NO_MREQ(regPairs[#{rpPC}], 1);
			CONTEND_READ_NO_MREQ(regPairs[#{rpPC}], 1);
			regPairs[#{rpPC}]++;
			if (offset & 0x80) offset -= 0x100;
			var addr = (regPairs[#{rp}] + offset) & 0xffff;

			regs[#{r}] = READMEM(addr);
		"""

	LD_R_N = (r) ->
		"""
			regs[#{r}] = READMEM(regPairs[#{rpPC}]); regPairs[#{rpPC}]++;
		"""

	LD_R_R = (r1, r2) ->
		if r1 == rI || r2 == rI || r1 == rR || r2 == rR
			output = """
				CONTEND_READ_NO_MREQ(regPairs[#{rpIR}], 1);
				regs[#{r1}] = regs[#{r2}];
			"""
			if (r1 == rA)
				output += """
					regs[#{rF}] = (regs[#{rF}] & #{FLAG_C}) | sz53Table[regs[#{rA}]] | ( iff2 ? #{FLAG_V} : 0 );
				"""
			output
		else
			"""
				regs[#{r1}] = regs[#{r2}];
			"""

	LD_RR_iNNi = (rp, shifted) ->
		"""
			var l = READMEM(regPairs[#{rpPC}]); regPairs[#{rpPC}]++;
			var h = READMEM(regPairs[#{rpPC}]); regPairs[#{rpPC}]++;
			var addr = (h<<8) | l;
			l = READMEM(addr);
			addr = (addr + 1) & 0xffff;
			h = READMEM(addr);
			regPairs[#{rp}] = (h<<8) | l;
		"""

	LD_RR_NN = (rp) ->
		"""
			var l = READMEM(regPairs[#{rpPC}]); regPairs[#{rpPC}]++;
			var h = READMEM(regPairs[#{rpPC}]); regPairs[#{rpPC}]++;
			regPairs[#{rp}] = (h<<8) | l;
		"""

	LD_RR_RR = (rp1, rp2) ->
		# only used for LD SP,HL/IX/IY
		"""
			regPairs[#{rp1}] = regPairs[#{rp2}];
			CONTEND_READ_NO_MREQ(regPairs[#{rpIR}], 1);
			CONTEND_READ_NO_MREQ(regPairs[#{rpIR}], 1);
		"""

	LDBITOP = (regName, opcode, bit, rp) ->
		# load (rp+nn) into register regName, perform opcode, write back to (rp+nn)
		regNum = registerIndexes[regName]
		"""
			var addr = (regPairs[#{rp}] + offset) & 0xffff;
			regs[#{regNum}] = READMEM(addr);
			#{opcode(bit, regName)}
			CONTEND_READ_NO_MREQ(addr, 1);
			WRITEMEM(addr, regs[#{regNum}]);
		"""

	LDI_LDD = (modifier) ->
		"""
			var bytetemp = READMEM(regPairs[#{rpHL}]);
			regPairs[#{rpBC}]--;
			WRITEMEM(regPairs[#{rpDE}],bytetemp);
			var originalDE = regPairs[#{rpDE}];
			regPairs[#{rpDE}]#{modifier}; regPairs[#{rpHL}]#{modifier};
			bytetemp = (bytetemp + regs[#{rA}]) & 0xff;
			regs[#{rF}] = (regs[#{rF}] & #{FLAG_C | FLAG_Z | FLAG_S}) | (regPairs[#{rpBC}] ? #{FLAG_V} : 0) | (bytetemp & #{FLAG_3}) | ((bytetemp & 0x02) ? #{FLAG_5} : 0);
			CONTEND_READ_NO_MREQ(originalDE, 1);
			CONTEND_READ_NO_MREQ(originalDE, 1);
		"""

	LDIR_LDDR = (modifier) ->
		"""
			#{LDI_LDD(modifier)}
			if (regPairs[#{rpBC}]) {
				regPairs[#{rpPC}]-=2;
				CONTEND_READ_NO_MREQ(originalDE, 1);
				CONTEND_READ_NO_MREQ(originalDE, 1);
				CONTEND_READ_NO_MREQ(originalDE, 1);
				CONTEND_READ_NO_MREQ(originalDE, 1);
				CONTEND_READ_NO_MREQ(originalDE, 1);
			}
		"""

	LDI = () ->
		LDI_LDD('++')

	LDD = () ->
		LDI_LDD('--')

	LDIR = () ->
		LDIR_LDDR('++')

	LDDR = () ->
		LDIR_LDDR('--')

	LDSHIFTOP = (regName, opcode, rp) ->
		# load (rp+nn) into register regName, perform opcode, write back to (rp+nn)
		regNum = registerIndexes[regName]
		"""
			var addr = (regPairs[#{rp}] + offset) & 0xffff;
			regs[#{regNum}] = READMEM(addr);
			#{opcode(regName)}
			CONTEND_READ_NO_MREQ(addr, 1);
			WRITEMEM(addr, regs[#{regNum}]);
		"""

	NEG = () ->
		"""
			var val = regs[#{rA}];
			var subtemp = -val;
			var lookup = ( (val & 0x88) >> 2 ) | ( (subtemp & 0x88) >> 1 );
			regs[#{rA}] = subtemp;
			regs[#{rF}] = ( subtemp & 0x100 ? #{FLAG_C} : 0 ) | #{FLAG_N} | halfcarrySubTable[lookup & 0x07] | overflowSubTable[lookup >> 4] | sz53Table[regs[#{rA}]];
		"""

	NOP = () ->
		"""
		"""

	OR_A = (param) ->
		operand = getParamBoilerplate(param)
		"""
			#{operand.getter}

			regs[#{rA}] |= #{operand.v};
			regs[#{rF}] = sz53pTable[regs[#{rA}]];
		"""

	OUT_iCi_0 = (r) ->
		"""
			CONTEND_PORT_EARLY(regPairs[#{rpBC}]);
			ioBus.write(regPairs[#{rpBC}], 0, tstates);
			CONTEND_PORT_LATE(regPairs[#{rpBC}]);
		"""

	OUT_iCi_R = (r) ->
		"""
			CONTEND_PORT_EARLY(regPairs[#{rpBC}]);
			ioBus.write(regPairs[#{rpBC}], regs[#{r}], tstates);
			CONTEND_PORT_LATE(regPairs[#{rpBC}]);
		"""

	OUT_iNi_A = () ->
		"""
			var port = (regs[#{rA}] << 8) | READMEM(regPairs[#{rpPC}]); regPairs[#{rpPC}]++;
			CONTEND_PORT_EARLY(port);
			ioBus.write(port, regs[#{rA}], tstates);
			CONTEND_PORT_LATE(port);
		"""

	OUTI_OUTD = (modifier) ->
		"""
			CONTEND_READ_NO_MREQ(regPairs[#{rpIR}], 1);
			var outitemp = READMEM(regPairs[#{rpHL}]);
			regs[#{rB}]--;	/* This does happen first, despite what the specs say */
			CONTEND_PORT_EARLY(regPairs[#{rpBC}]);
			ioBus.write(regPairs[#{rpBC}], outitemp, tstates);
			CONTEND_PORT_LATE(regPairs[#{rpBC}]);

			regPairs[#{rpHL}]#{modifier};
			outitemp2 = (outitemp + regs[#{rL}]) & 0xff;
			regs[#{rF}] = (outitemp & 0x80 ? #{FLAG_N} : 0) | ( (outitemp2 < outitemp) ? #{FLAG_H | FLAG_C} : 0) | (parityTable[ (outitemp2 & 0x07) ^ regs[#{rB}] ] ? #{FLAG_P} : 0 ) | sz53Table[ regs[#{rB}] ];
		"""

	OTIR_OTDR = (modifier) ->
		"""
			#{OUTI_OUTD(modifier)}
			if (regs[#{rB}]) {
				regPairs[#{rpPC}]-=2;
				CONTEND_READ_NO_MREQ(regPairs[#{rpBC}], 1);
				CONTEND_READ_NO_MREQ(regPairs[#{rpBC}], 1);
				CONTEND_READ_NO_MREQ(regPairs[#{rpBC}], 1);
				CONTEND_READ_NO_MREQ(regPairs[#{rpBC}], 1);
				CONTEND_READ_NO_MREQ(regPairs[#{rpBC}], 1);
			}
		"""

	OUTD = () ->
		OUTI_OUTD('--');

	OUTI = () ->
		OUTI_OUTD('++');

	OTDR = () ->
		OTIR_OTDR('--');

	OTIR = () ->
		OTIR_OTDR('++');

	POP_RR = (rp) ->
		"""
			var l = READMEM(regPairs[#{rpSP}]); regPairs[#{rpSP}]++;
			var h = READMEM(regPairs[#{rpSP}]); regPairs[#{rpSP}]++;
			regPairs[#{rp}] = (h<<8) | l;
		"""

	PUSH_RR = (rp) ->
		"""
			CONTEND_READ_NO_MREQ(regPairs[#{rpIR}], 1);
			regPairs[#{rpSP}]--; WRITEMEM(regPairs[#{rpSP}], regPairs[#{rp}] >> 8);
			regPairs[#{rpSP}]--; WRITEMEM(regPairs[#{rpSP}], regPairs[#{rp}] & 0xff);
		"""

	RES = (bit, param) ->
		operand = getParamBoilerplate(param, true)
		hexMask = 0xff ^ (1 << bit)
		"""
			#{operand.getter}
			#{operand.v} &= #{hexMask};
			#{operand.setter}
		"""

	RET = () ->
		"""
			var l = READMEM(regPairs[#{rpSP}]); regPairs[#{rpSP}]++;
			var h = READMEM(regPairs[#{rpSP}]); regPairs[#{rpSP}]++;
			regPairs[#{rpPC}] = (h<<8) | l;
		"""

	RET_C = (flag, sense) ->
		condition = "regs[#{rF}] & #{flag}"
		condition = "!(#{condition})" if not sense
		"""
			CONTEND_READ_NO_MREQ(regPairs[#{rpIR}], 1);
			if (#{condition}) {
				var l = READMEM(regPairs[#{rpSP}]); regPairs[#{rpSP}]++;
				var h = READMEM(regPairs[#{rpSP}]); regPairs[#{rpSP}]++;
				regPairs[#{rpPC}] = (h<<8) | l;
			}
		"""

	RETN = () ->
		"""
			iff1 = iff2;
			#{RET()}
		"""

	RL = (param) ->
		operand = getParamBoilerplate(param, true)
		"""
			#{operand.getter}
			var rltemp = #{operand.v};
			#{operand.v} = ( (#{operand.v} << 1) | (regs[#{rF}] & #{FLAG_C}) ) #{operand.trunc};
			regs[#{rF}] = ( rltemp >> 7 ) | sz53pTable[#{operand.v}];
			#{operand.setter}
		"""

	RLA = () ->
		"""
			var bytetemp = regs[#{rA}];
			regs[#{rA}] = (regs[#{rA}] << 1) | (regs[#{rF}] & #{FLAG_C});
			regs[#{rF}] = (regs[#{rF}] & #{FLAG_P | FLAG_Z | FLAG_S}) | (regs[#{rA}] & #{FLAG_3 | FLAG_5}) | (bytetemp >> 7);
		"""

	RLC = (param) ->
		operand = getParamBoilerplate(param, true)
		"""
			#{operand.getter}
			#{operand.v} = ( (#{operand.v} << 1) | (#{operand.v} >> 7) ) #{operand.trunc};
			regs[#{rF}] = (#{operand.v} & #{FLAG_C}) | sz53pTable[#{operand.v}];
			#{operand.setter}
		"""

	RLD = () ->
		"""
			var bytetemp =  READMEM(regPairs[#{rpHL}]);
			CONTEND_READ_NO_MREQ(regPairs[#{rpHL}], 1);
			CONTEND_READ_NO_MREQ(regPairs[#{rpHL}], 1);
			CONTEND_READ_NO_MREQ(regPairs[#{rpHL}], 1);
			CONTEND_READ_NO_MREQ(regPairs[#{rpHL}], 1);
			var val = (bytetemp << 4) | (regs[#{rA}] & 0x0f);
			WRITEMEM(regPairs[#{rpHL}], val);
			regs[#{rA}] = (regs[#{rA}] & 0xf0) | (bytetemp >> 4);
			regs[#{rF}] = (regs[#{rF}] & #{FLAG_C}) | sz53pTable[regs[#{rA}]];
		"""

	RLCA = () ->
		"""
			regs[#{rA}] = (regs[#{rA}] << 1) | (regs[#{rA}] >> 7);
			regs[#{rF}] = (regs[#{rF}] & #{FLAG_P | FLAG_Z | FLAG_S}) | (regs[#{rA}] & #{FLAG_C | FLAG_3 | FLAG_5});
		"""

	RR = (param) ->
		operand = getParamBoilerplate(param, true)
		"""
			#{operand.getter}
			var rrtemp = #{operand.v};
			#{operand.v} = ( (#{operand.v} >> 1) | ( regs[#{rF}] << 7 ) ) #{operand.trunc};
			regs[#{rF}] = (rrtemp & #{FLAG_C}) | sz53pTable[#{operand.v}];
			#{operand.setter}
		"""

	RRA = () ->
		"""
			var bytetemp = regs[#{rA}];
			regs[#{rA}] = (bytetemp >> 1) | (regs[#{rF}] << 7);
			regs[#{rF}] = (regs[#{rF}] & #{FLAG_P | FLAG_Z | FLAG_S}) | (regs[#{rA}] & #{FLAG_3 | FLAG_5}) | (bytetemp & #{FLAG_C});
		"""

	RRC = (param) ->
		operand = getParamBoilerplate(param, true)
		"""
			#{operand.getter}
			regs[#{rF}] = #{operand.v} & #{FLAG_C};
			#{operand.v} = ( (#{operand.v} >> 1) | (#{operand.v} << 7) ) #{operand.trunc};
			regs[#{rF}] |= sz53pTable[#{operand.v}];
			#{operand.setter}
		"""

	RRCA = () ->
		"""
			regs[#{rF}] = (regs[#{rF}] & #{FLAG_P | FLAG_Z | FLAG_S}) | (regs[#{rA}] & #{FLAG_C});
			regs[#{rA}] = (regs[#{rA}] >> 1) | (regs[#{rA}] << 7);
			regs[#{rF}] |= (regs[#{rA}] & #{FLAG_3 | FLAG_5});
		"""

	RRD = () ->
		"""
			var bytetemp = READMEM(regPairs[#{rpHL}]);
			CONTEND_READ_NO_MREQ(regPairs[#{rpHL}], 1);
			CONTEND_READ_NO_MREQ(regPairs[#{rpHL}], 1);
			CONTEND_READ_NO_MREQ(regPairs[#{rpHL}], 1);
			CONTEND_READ_NO_MREQ(regPairs[#{rpHL}], 1);
			var val = (regs[#{rA}] << 4) | (bytetemp >> 4);
			WRITEMEM(regPairs[#{rpHL}], val);
			regs[#{rA}] = (regs[#{rA}] & 0xf0) | (bytetemp & 0x0f);
			regs[#{rF}] = (regs[#{rF}] & #{FLAG_C}) | sz53pTable[regs[#{rA}]];
		"""

	RST = (addr) ->
		"""
			CONTEND_READ_NO_MREQ(regPairs[#{rpIR}], 1);
			regPairs[#{rpSP}]--; WRITEMEM(regPairs[#{rpSP}], regPairs[#{rpPC}] >> 8);
			regPairs[#{rpSP}]--; WRITEMEM(regPairs[#{rpSP}], regPairs[#{rpPC}] & 0xff);
			regPairs[#{rpPC}] = #{addr};
		"""

	SBC_A = (param) ->
		operand = getParamBoilerplate(param)
		"""
			#{operand.getter}
			var sbctemp = regs[#{rA}] - #{operand.v} - (regs[#{rF}] & #{FLAG_C});
			var lookup = ( (regs[#{rA}] & 0x88) >> 3 ) | ( (#{operand.v} & 0x88) >> 2 ) | ( (sbctemp & 0x88) >> 1 );
			regs[#{rA}] = sbctemp;
			regs[#{rF}] = ( sbctemp & 0x100 ? #{FLAG_C} : 0 ) | #{FLAG_N} | halfcarrySubTable[lookup & 0x07] | overflowSubTable[lookup >> 4] | sz53Table[regs[#{rA}]];
		"""

	SBC_HL_RR = (rp) ->
		"""
			var sub16temp = regPairs[#{rpHL}] - regPairs[#{rp}] - (regs[#{rF}] & #{FLAG_C});
			var lookup = ( (regPairs[#{rpHL}] & 0x8800) >> 11 ) | ( (regPairs[#{rp}] & 0x8800) >> 10 ) | ( (sub16temp & 0x8800) >>  9 );
			regPairs[#{rpHL}] = sub16temp;
			regs[#{rF}] = ( sub16temp & 0x10000 ? #{FLAG_C} : 0 ) | #{FLAG_N} | overflowSubTable[lookup >> 4] | (regs[#{rH}] & #{FLAG_3 | FLAG_5 | FLAG_S}) | halfcarrySubTable[lookup&0x07] | (regPairs[#{rpHL}] ? 0 : #{FLAG_Z});
			CONTEND_READ_NO_MREQ(regPairs[#{rpIR}], 1);
			CONTEND_READ_NO_MREQ(regPairs[#{rpIR}], 1);
			CONTEND_READ_NO_MREQ(regPairs[#{rpIR}], 1);
			CONTEND_READ_NO_MREQ(regPairs[#{rpIR}], 1);
			CONTEND_READ_NO_MREQ(regPairs[#{rpIR}], 1);
			CONTEND_READ_NO_MREQ(regPairs[#{rpIR}], 1);
			CONTEND_READ_NO_MREQ(regPairs[#{rpIR}], 1);
		"""

	SCF = () ->
		"""
			regs[#{rF}] = (regs[#{rF}] & #{FLAG_P | FLAG_Z | FLAG_S}) | (regs[#{rA}] & #{FLAG_3 | FLAG_5}) | #{FLAG_C};
		"""

	SET = (bit, param) ->
		hexMask = 1 << bit
		operand = getParamBoilerplate(param, true)
		"""
			#{operand.getter}
			#{operand.v} |= #{hexMask};
			#{operand.setter}
		"""

	SHIFT = (prefix) ->
		# Fake instruction for shifted opcodes - passes control to a secondary opcode table
		"""
			opcodePrefix = '#{prefix}';
			interruptible = false;
		"""

	SLA = (param) ->
		operand = getParamBoilerplate(param, true)
		"""
			#{operand.getter}
			regs[#{rF}] = #{operand.v} >> 7;
			#{operand.v} = (#{operand.v} << 1) #{operand.trunc};
			regs[#{rF}] |= sz53pTable[#{operand.v}];
			#{operand.setter}
		"""

	SLL = (param) ->
		operand = getParamBoilerplate(param, true)
		"""
			#{operand.getter}
			regs[#{rF}] =  #{operand.v} >> 7;
			#{operand.v} = (((#{operand.v}) << 1) #{operand.trunc}) | 0x01;
			regs[#{rF}] |= sz53pTable[#{operand.v}];
			#{operand.setter}
		"""

	SRA = (param) ->
		operand = getParamBoilerplate(param, true)
		"""
			#{operand.getter}
			regs[#{rF}] = #{operand.v} & #{FLAG_C};
			#{operand.v} = ( (#{operand.v} & 0x80) | (#{operand.v} >> 1) ) #{operand.trunc};
			regs[#{rF}] |= sz53pTable[#{operand.v}];
			#{operand.setter}
		"""

	SRL = (param) ->
		operand = getParamBoilerplate(param, true)
		"""
			#{operand.getter}
			regs[#{rF}] =  #{operand.v} & #{FLAG_C};
			#{operand.v} >>= 1;
			regs[#{rF}] |= sz53pTable[#{operand.v}];
			#{operand.setter}
		"""

	SUB_A = (param) ->
		operand = getParamBoilerplate(param)
		"""
			#{operand.getter}
			var subtemp = regs[#{rA}] - #{operand.v};
			var lookup = ( (regs[#{rA}] & 0x88) >> 3 ) | ( (#{operand.v} & 0x88) >> 2 ) | ( (subtemp & 0x88) >> 1 );
			regs[#{rA}] = subtemp;
			regs[#{rF}] = ( subtemp & 0x100 ? #{FLAG_C} : 0 ) | #{FLAG_N} | halfcarrySubTable[lookup & 0x07] | overflowSubTable[lookup >> 4] | sz53Table[regs[#{rA}]];
		"""

	XOR_A = (param) ->
		operand = getParamBoilerplate(param)
		"""
			#{operand.getter}
			regs[#{rA}] ^= #{operand.v};
			regs[#{rF}] = sz53pTable[regs[#{rA}]];
		"""

	###
	Given a table mapping opcodes to Javascript snippets (and optionally a fallback
	table for opcodes that aren't defined in the first one), build an enormous
	switch statement for them
	###
	opcodeSwitch = (runStringTable, fallbackTable = {}, traps = []) ->
		clauses = []
		for i in [0...0x100]
			runString = runStringTable[i]
			if not runString?
				runString = fallbackTable[i]
			if runString?
				relevantTraps = ([address, action] for [address, opcode, action] in traps when opcode == i)
				trapCode = (
					"if (regPairs[#{rpPC}] == #{(address + 1) & 0xffff} && !(#{action})) break;" for [address, action] in relevantTraps
				)
				clauses.push """
					case #{i}:
						#{trapCode.join("\n")}
						#{runString}
						break;
				"""
		"""
			switch (opcode) {
				#{clauses.join('')}
				default:
					var addr = regPairs[#{rpPC}] - 1;
					throw("Unimplemented opcode " + opcode + " in page #{runStringTable[0x100]} - PC = " + addr);
			}
		"""

	# Tables mapping opcodes to Javascript snippets
	OPCODE_RUN_STRINGS_CB = {
		0x00: RLC "B"         # RLC B
		0x01: RLC "C"         # RLC C
		0x02: RLC "D"         # RLC D
		0x03: RLC "E"         # RLC E
		0x04: RLC "H"         # RLC H
		0x05: RLC "L"         # RLC L
		0x06: RLC "(HL)"         # RLC (HL)
		0x07: RLC "A"         # RLC A
		0x08: RRC "B"         # RRC B
		0x09: RRC "C"         # RRC C
		0x0a: RRC "D"         # RRC D
		0x0b: RRC "E"         # RRC E
		0x0c: RRC "H"         # RRC H
		0x0d: RRC "L"         # RRC L
		0x0e: RRC "(HL)"         # RRC (HL)
		0x0f: RRC "A"         # RRC A
		0x10: RL 'B'         # RL B
		0x11: RL 'C'         # RL C
		0x12: RL 'D'         # RL D
		0x13: RL 'E'         # RL E
		0x14: RL 'H'         # RL H
		0x15: RL 'L'         # RL L
		0x16: RL '(HL)'         # RL (HL)
		0x17: RL 'A'         # RL A
		0x18: RR 'B'         # RR B
		0x19: RR 'C'         # RR C
		0x1a: RR 'D'         # RR D
		0x1b: RR 'E'         # RR E
		0x1c: RR 'H'         # RR H
		0x1d: RR 'L'         # RR L
		0x1e: RR '(HL)'         # RR (HL)
		0x1f: RR 'A'         # RR A
		0x20: SLA 'B'         # SLA B
		0x21: SLA 'C'         # SLA C
		0x22: SLA 'D'         # SLA D
		0x23: SLA 'E'         # SLA E
		0x24: SLA 'H'         # SLA H
		0x25: SLA 'L'         # SLA L
		0x26: SLA '(HL)'         # SLA (HL)
		0x27: SLA 'A'         # SLA A
		0x28: SRA 'B'         # SRA B
		0x29: SRA 'C'         # SRA C
		0x2a: SRA 'D'         # SRA D
		0x2b: SRA 'E'         # SRA E
		0x2c: SRA 'H'         # SRA H
		0x2d: SRA 'L'         # SRA L
		0x2e: SRA '(HL)'         # SRA (HL)
		0x2f: SRA 'A'         # SRA A
		0x30: SLL 'B'         # SLL B
		0x31: SLL 'C'         # SLL C
		0x32: SLL 'D'         # SLL D
		0x33: SLL 'E'         # SLL E
		0x34: SLL 'H'         # SLL H
		0x35: SLL 'L'         # SLL L
		0x36: SLL '(HL)'         # SLL (HL)
		0x37: SLL 'A'         # SLL A
		0x38: SRL 'B'         # SRL B
		0x39: SRL 'C'         # SRL C
		0x3a: SRL 'D'         # SRL D
		0x3b: SRL 'E'         # SRL E
		0x3c: SRL 'H'         # SRL H
		0x3d: SRL 'L'         # SRL L
		0x3e: SRL '(HL)'         # SRL (HL)
		0x3f: SRL 'A'         # SRL A
		0x40: BIT_N_R(0, rB)        # BIT 0,B
		0x41: BIT_N_R(0, rC)        # BIT 0,C
		0x42: BIT_N_R(0, rD)        # BIT 0,D
		0x43: BIT_N_R(0, rE)        # BIT 0,E
		0x44: BIT_N_R(0, rH)        # BIT 0,H
		0x45: BIT_N_R(0, rL)        # BIT 0,L
		0x46: BIT_N_iHLi(0)        # BIT 0,(HL)
		0x47: BIT_N_R(0, rA)        # BIT 0,A
		0x48: BIT_N_R(1, rB)        # BIT 1,B
		0x49: BIT_N_R(1, rC)        # BIT 1,C
		0x4A: BIT_N_R(1, rD)        # BIT 1,D
		0x4B: BIT_N_R(1, rE)        # BIT 1,E
		0x4C: BIT_N_R(1, rH)        # BIT 1,H
		0x4D: BIT_N_R(1, rL)        # BIT 1,L
		0x4E: BIT_N_iHLi(1)        # BIT 1,(HL)
		0x4F: BIT_N_R(1, rA)        # BIT 1,A
		0x50: BIT_N_R(2, rB)        # BIT 2,B
		0x51: BIT_N_R(2, rC)        # BIT 2,C
		0x52: BIT_N_R(2, rD)        # BIT 2,D
		0x53: BIT_N_R(2, rE)        # BIT 2,E
		0x54: BIT_N_R(2, rH)        # BIT 2,H
		0x55: BIT_N_R(2, rL)        # BIT 2,L
		0x56: BIT_N_iHLi(2)        # BIT 2,(HL)
		0x57: BIT_N_R(2, rA)        # BIT 2,A
		0x58: BIT_N_R(3, rB)        # BIT 3,B
		0x59: BIT_N_R(3, rC)        # BIT 3,C
		0x5A: BIT_N_R(3, rD)        # BIT 3,D
		0x5B: BIT_N_R(3, rE)        # BIT 3,E
		0x5C: BIT_N_R(3, rH)        # BIT 3,H
		0x5D: BIT_N_R(3, rL)        # BIT 3,L
		0x5E: BIT_N_iHLi(3)        # BIT 3,(HL)
		0x5F: BIT_N_R(3, rA)        # BIT 3,A
		0x60: BIT_N_R(4, rB)        # BIT 4,B
		0x61: BIT_N_R(4, rC)        # BIT 4,C
		0x62: BIT_N_R(4, rD)        # BIT 4,D
		0x63: BIT_N_R(4, rE)        # BIT 4,E
		0x64: BIT_N_R(4, rH)        # BIT 4,H
		0x65: BIT_N_R(4, rL)        # BIT 4,L
		0x66: BIT_N_iHLi(4)        # BIT 4,(HL)
		0x67: BIT_N_R(4, rA)        # BIT 4,A
		0x68: BIT_N_R(5, rB)        # BIT 5,B
		0x69: BIT_N_R(5, rC)        # BIT 5,C
		0x6A: BIT_N_R(5, rD)        # BIT 5,D
		0x6B: BIT_N_R(5, rE)        # BIT 5,E
		0x6C: BIT_N_R(5, rH)        # BIT 5,H
		0x6D: BIT_N_R(5, rL)        # BIT 5,L
		0x6E: BIT_N_iHLi(5)        # BIT 5,(HL)
		0x6F: BIT_N_R(5, rA)        # BIT 5,A
		0x70: BIT_N_R(6, rB)        # BIT 6,B
		0x71: BIT_N_R(6, rC)        # BIT 6,C
		0x72: BIT_N_R(6, rD)        # BIT 6,D
		0x73: BIT_N_R(6, rE)        # BIT 6,E
		0x74: BIT_N_R(6, rH)        # BIT 6,H
		0x75: BIT_N_R(6, rL)        # BIT 6,L
		0x76: BIT_N_iHLi(6)        # BIT 6,(HL)
		0x77: BIT_N_R(6, rA)        # BIT 6,A
		0x78: BIT_N_R(7, rB)        # BIT 7,B
		0x79: BIT_N_R(7, rC)        # BIT 7,C
		0x7A: BIT_N_R(7, rD)        # BIT 7,D
		0x7B: BIT_N_R(7, rE)        # BIT 7,E
		0x7C: BIT_N_R(7, rH)        # BIT 7,H
		0x7D: BIT_N_R(7, rL)        # BIT 7,L
		0x7E: BIT_N_iHLi(7)        # BIT 7,(HL)
		0x7F: BIT_N_R(7, rA)        # BIT 7,A
		0x80: RES 0, 'B'         # RES 0,B
		0x81: RES 0, 'C'         # RES 0,C
		0x82: RES 0, 'D'         # RES 0,D
		0x83: RES 0, 'E'         # RES 0,E
		0x84: RES 0, 'H'         # RES 0,H
		0x85: RES 0, 'L'         # RES 0,L
		0x86: RES 0, '(HL)'         # RES 0,(HL)
		0x87: RES 0, 'A'         # RES 0,A
		0x88: RES 1, 'B'         # RES 1,B
		0x89: RES 1, 'C'         # RES 1,C
		0x8A: RES 1, 'D'         # RES 1,D
		0x8B: RES 1, 'E'         # RES 1,E
		0x8C: RES 1, 'H'         # RES 1,H
		0x8D: RES 1, 'L'         # RES 1,L
		0x8E: RES 1, '(HL)'         # RES 1,(HL)
		0x8F: RES 1, 'A'         # RES 1,A
		0x90: RES 2, 'B'         # RES 2,B
		0x91: RES 2, 'C'         # RES 2,C
		0x92: RES 2, 'D'         # RES 2,D
		0x93: RES 2, 'E'         # RES 2,E
		0x94: RES 2, 'H'         # RES 2,H
		0x95: RES 2, 'L'         # RES 2,L
		0x96: RES 2, '(HL)'         # RES 2,(HL)
		0x97: RES 2, 'A'         # RES 2,A
		0x98: RES 3, 'B'         # RES 3,B
		0x99: RES 3, 'C'         # RES 3,C
		0x9A: RES 3, 'D'         # RES 3,D
		0x9B: RES 3, 'E'         # RES 3,E
		0x9C: RES 3, 'H'         # RES 3,H
		0x9D: RES 3, 'L'         # RES 3,L
		0x9E: RES 3, '(HL)'         # RES 3,(HL)
		0x9F: RES 3, 'A'         # RES 3,A
		0xA0: RES 4, 'B'         # RES 4,B
		0xA1: RES 4, 'C'         # RES 4,C
		0xA2: RES 4, 'D'         # RES 4,D
		0xA3: RES 4, 'E'         # RES 4,E
		0xA4: RES 4, 'H'         # RES 4,H
		0xA5: RES 4, 'L'         # RES 4,L
		0xA6: RES 4, '(HL)'         # RES 4,(HL)
		0xA7: RES 4, 'A'         # RES 4,A
		0xA8: RES 5, 'B'         # RES 5,B
		0xA9: RES 5, 'C'         # RES 5,C
		0xAA: RES 5, 'D'         # RES 5,D
		0xAB: RES 5, 'E'         # RES 5,E
		0xAC: RES 5, 'H'         # RES 5,H
		0xAD: RES 5, 'L'         # RES 5,L
		0xAE: RES 5, '(HL)'         # RES 5,(HL)
		0xAF: RES 5, 'A'         # RES 5,A
		0xB0: RES 6, 'B'         # RES 6,B
		0xB1: RES 6, 'C'         # RES 6,C
		0xB2: RES 6, 'D'         # RES 6,D
		0xB3: RES 6, 'E'         # RES 6,E
		0xB4: RES 6, 'H'         # RES 6,H
		0xB5: RES 6, 'L'         # RES 6,L
		0xB6: RES 6, '(HL)'         # RES 6,(HL)
		0xB7: RES 6, 'A'         # RES 6,A
		0xB8: RES 7, 'B'         # RES 7,B
		0xB9: RES 7, 'C'         # RES 7,C
		0xBA: RES 7, 'D'         # RES 7,D
		0xBB: RES 7, 'E'         # RES 7,E
		0xBC: RES 7, 'H'         # RES 7,H
		0xBD: RES 7, 'L'         # RES 7,L
		0xBE: RES 7, '(HL)'         # RES 7,(HL)
		0xBF: RES 7, 'A'         # RES 7,A
		0xC0: SET 0, 'B'         # SET 0,B
		0xC1: SET 0, 'C'         # SET 0,C
		0xC2: SET 0, 'D'         # SET 0,D
		0xC3: SET 0, 'E'         # SET 0,E
		0xC4: SET 0, 'H'         # SET 0,H
		0xC5: SET 0, 'L'         # SET 0,L
		0xC6: SET 0, '(HL)'         # SET 0,(HL)
		0xC7: SET 0, 'A'         # SET 0,A
		0xC8: SET 1, 'B'         # SET 1,B
		0xC9: SET 1, 'C'         # SET 1,C
		0xCA: SET 1, 'D'         # SET 1,D
		0xCB: SET 1, 'E'         # SET 1,E
		0xCC: SET 1, 'H'         # SET 1,H
		0xCD: SET 1, 'L'         # SET 1,L
		0xCE: SET 1, '(HL)'         # SET 1,(HL)
		0xCF: SET 1, 'A'         # SET 1,A
		0xD0: SET 2, 'B'         # SET 2,B
		0xD1: SET 2, 'C'         # SET 2,C
		0xD2: SET 2, 'D'         # SET 2,D
		0xD3: SET 2, 'E'         # SET 2,E
		0xD4: SET 2, 'H'         # SET 2,H
		0xD5: SET 2, 'L'         # SET 2,L
		0xD6: SET 2, '(HL)'         # SET 2,(HL)
		0xD7: SET 2, 'A'         # SET 2,A
		0xD8: SET 3, 'B'         # SET 3,B
		0xD9: SET 3, 'C'         # SET 3,C
		0xDA: SET 3, 'D'         # SET 3,D
		0xDB: SET 3, 'E'         # SET 3,E
		0xDC: SET 3, 'H'         # SET 3,H
		0xDD: SET 3, 'L'         # SET 3,L
		0xDE: SET 3, '(HL)'         # SET 3,(HL)
		0xDF: SET 3, 'A'         # SET 3,A
		0xE0: SET 4, 'B'         # SET 4,B
		0xE1: SET 4, 'C'         # SET 4,C
		0xE2: SET 4, 'D'         # SET 4,D
		0xE3: SET 4, 'E'         # SET 4,E
		0xE4: SET 4, 'H'         # SET 4,H
		0xE5: SET 4, 'L'         # SET 4,L
		0xE6: SET 4, '(HL)'         # SET 4,(HL)
		0xE7: SET 4, 'A'         # SET 4,A
		0xE8: SET 5, 'B'         # SET 5,B
		0xE9: SET 5, 'C'         # SET 5,C
		0xEA: SET 5, 'D'         # SET 5,D
		0xEB: SET 5, 'E'         # SET 5,E
		0xEC: SET 5, 'H'         # SET 5,H
		0xED: SET 5, 'L'         # SET 5,L
		0xEE: SET 5, '(HL)'         # SET 5,(HL)
		0xEF: SET 5, 'A'         # SET 5,A
		0xF0: SET 6, 'B'         # SET 6,B
		0xF1: SET 6, 'C'         # SET 6,C
		0xF2: SET 6, 'D'         # SET 6,D
		0xF3: SET 6, 'E'         # SET 6,E
		0xF4: SET 6, 'H'         # SET 6,H
		0xF5: SET 6, 'L'         # SET 6,L
		0xF6: SET 6, '(HL)'         # SET 6,(HL)
		0xF7: SET 6, 'A'         # SET 6,A
		0xF8: SET 7, 'B'         # SET 7,B
		0xF9: SET 7, 'C'         # SET 7,C
		0xFA: SET 7, 'D'         # SET 7,D
		0xFB: SET 7, 'E'         # SET 7,E
		0xFC: SET 7, 'H'         # SET 7,H
		0xFD: SET 7, 'L'         # SET 7,L
		0xFE: SET 7, '(HL)'         # SET 7,(HL)
		0xFF: SET 7, 'A'         # SET 7,A
		0x100: 'cb'
	}

	# Generate the opcode runner lookup table for either the DDCB or FDCB set
	generateddfdcbOpcodeSet = (prefix) ->
		if prefix == 'DDCB'
			rp = rpIX
			rh = rIXH
			rl = rIXL

			rpn = 'IX'
			rhn = 'IXH'
			rln = 'IXL'
		else # prefix == 'FDCB'
			rp = rpIY
			rh = rIYH
			rl = rIYL

			rpn = 'IY'
			rhn = 'IYH'
			rln = 'IYL'
		return {
			0x00: LDSHIFTOP('B', RLC, rp)        # LD B,RLC (REGISTER+dd)
			0x01: LDSHIFTOP('C', RLC, rp)        # LD C,RLC (REGISTER+dd)
			0x02: LDSHIFTOP('D', RLC, rp)        # LD D,RLC (REGISTER+dd)
			0x03: LDSHIFTOP('E', RLC, rp)        # LD E,RLC (REGISTER+dd)
			0x04: LDSHIFTOP('H', RLC, rp)        # LD H,RLC (REGISTER+dd)
			0x05: LDSHIFTOP('L', RLC, rp)        # LD L,RLC (REGISTER+dd)
			0x06: RLC "(#{rpn}+nn)"         # RLC (IX+nn)
			0x07: LDSHIFTOP('A', RLC, rp)        # LD A,RLC (REGISTER+dd)
			0x08: LDSHIFTOP('B', RRC, rp)        # LD B,RRC (REGISTER+dd)
			0x09: LDSHIFTOP('C', RRC, rp)        # LD C,RRC (REGISTER+dd)
			0x0A: LDSHIFTOP('D', RRC, rp)        # LD D,RRC (REGISTER+dd)
			0x0B: LDSHIFTOP('E', RRC, rp)        # LD E,RRC (REGISTER+dd)
			0x0C: LDSHIFTOP('H', RRC, rp)        # LD H,RRC (REGISTER+dd)
			0x0D: LDSHIFTOP('L', RRC, rp)        # LD L,RRC (REGISTER+dd)
			0x0E: RRC "(#{rpn}+nn)"         # RRC (IX+nn)
			0x0F: LDSHIFTOP('A', RRC, rp)        # LD A,RRC (REGISTER+dd)
			0x10: LDSHIFTOP('B', RL, rp)        # LD B,RL (REGISTER+dd)
			0x11: LDSHIFTOP('C', RL, rp)        # LD C,RL (REGISTER+dd)
			0x12: LDSHIFTOP('D', RL, rp)        # LD D,RL (REGISTER+dd)
			0x13: LDSHIFTOP('E', RL, rp)        # LD E,RL (REGISTER+dd)
			0x14: LDSHIFTOP('H', RL, rp)        # LD H,RL (REGISTER+dd)
			0x15: LDSHIFTOP('L', RL, rp)        # LD L,RL (REGISTER+dd)
			0x16: RL "(#{rpn}+nn)"         # RL (IX+nn)
			0x17: LDSHIFTOP('A', RL, rp)        # LD A,RL (REGISTER+dd)
			0x18: LDSHIFTOP('B', RR, rp)        # LD B,RR (REGISTER+dd)
			0x19: LDSHIFTOP('C', RR, rp)        # LD C,RR (REGISTER+dd)
			0x1A: LDSHIFTOP('D', RR, rp)        # LD D,RR (REGISTER+dd)
			0x1B: LDSHIFTOP('E', RR, rp)        # LD E,RR (REGISTER+dd)
			0x1C: LDSHIFTOP('H', RR, rp)        # LD H,RR (REGISTER+dd)
			0x1D: LDSHIFTOP('L', RR, rp)        # LD L,RR (REGISTER+dd)
			0x1E: RR "(#{rpn}+nn)"         # RR (IX+nn)
			0x1F: LDSHIFTOP('A', RR, rp)        # LD A,RR (REGISTER+dd)
			0x20: LDSHIFTOP('B', SLA, rp)        # LD B,SLA (REGISTER+dd)
			0x21: LDSHIFTOP('C', SLA, rp)        # LD C,SLA (REGISTER+dd)
			0x22: LDSHIFTOP('D', SLA, rp)        # LD D,SLA (REGISTER+dd)
			0x23: LDSHIFTOP('E', SLA, rp)        # LD E,SLA (REGISTER+dd)
			0x24: LDSHIFTOP('H', SLA, rp)        # LD H,SLA (REGISTER+dd)
			0x25: LDSHIFTOP('L', SLA, rp)        # LD L,SLA (REGISTER+dd)
			0x26: SLA "(#{rpn}+nn)"         # SLA (IX+nn)
			0x27: LDSHIFTOP('A', SLA, rp)        # LD A,SLA (REGISTER+dd)
			0x28: LDSHIFTOP('B', SRA, rp)        # LD B,SRA (REGISTER+dd)
			0x29: LDSHIFTOP('C', SRA, rp)        # LD C,SRA (REGISTER+dd)
			0x2A: LDSHIFTOP('D', SRA, rp)        # LD D,SRA (REGISTER+dd)
			0x2B: LDSHIFTOP('E', SRA, rp)        # LD E,SRA (REGISTER+dd)
			0x2C: LDSHIFTOP('H', SRA, rp)        # LD H,SRA (REGISTER+dd)
			0x2D: LDSHIFTOP('L', SRA, rp)        # LD L,SRA (REGISTER+dd)
			0x2E: SRA "(#{rpn}+nn)"         # SRA (IX+nn)
			0x2F: LDSHIFTOP('A', SRA, rp)        # LD A,SRA (REGISTER+dd)
			0x30: LDSHIFTOP('B', SLL, rp)        # LD B,SLL (REGISTER+dd)
			0x31: LDSHIFTOP('C', SLL, rp)        # LD C,SLL (REGISTER+dd)
			0x32: LDSHIFTOP('D', SLL, rp)        # LD D,SLL (REGISTER+dd)
			0x33: LDSHIFTOP('E', SLL, rp)        # LD E,SLL (REGISTER+dd)
			0x34: LDSHIFTOP('H', SLL, rp)        # LD H,SLL (REGISTER+dd)
			0x35: LDSHIFTOP('L', SLL, rp)        # LD L,SLL (REGISTER+dd)
			0x36: SLL "(#{rpn}+nn)"         # SLL (IX+nn)
			0x37: LDSHIFTOP('A', SLL, rp)        # LD A,SLL (REGISTER+dd)
			0x38: LDSHIFTOP('B', SRL, rp)        # LD B,SRL (REGISTER+dd)
			0x39: LDSHIFTOP('C', SRL, rp)        # LD C,SRL (REGISTER+dd)
			0x3A: LDSHIFTOP('D', SRL, rp)        # LD D,SRL (REGISTER+dd)
			0x3B: LDSHIFTOP('E', SRL, rp)        # LD E,SRL (REGISTER+dd)
			0x3C: LDSHIFTOP('H', SRL, rp)        # LD H,SRL (REGISTER+dd)
			0x3D: LDSHIFTOP('L', SRL, rp)        # LD L,SRL (REGISTER+dd)
			0x3E: SRL "(#{rpn}+nn)"         # SRL (IX+nn)
			0x3F: LDSHIFTOP('A', SRL, rp)        # LD A,SRL (REGISTER+dd)
			0x40: BIT_N_iRRpNNi(0, rp)         # BIT 0,(IX+nn)
			0x41: BIT_N_iRRpNNi(0, rp)         # BIT 0,(IX+nn)
			0x42: BIT_N_iRRpNNi(0, rp)         # BIT 0,(IX+nn)
			0x43: BIT_N_iRRpNNi(0, rp)         # BIT 0,(IX+nn)
			0x44: BIT_N_iRRpNNi(0, rp)         # BIT 0,(IX+nn)
			0x45: BIT_N_iRRpNNi(0, rp)         # BIT 0,(IX+nn)
			0x46: BIT_N_iRRpNNi(0, rp)         # BIT 0,(IX+nn)
			0x47: BIT_N_iRRpNNi(0, rp)         # BIT 0,(IX+nn)
			0x48: BIT_N_iRRpNNi(1, rp)         # BIT 1,(IX+nn)
			0x49: BIT_N_iRRpNNi(1, rp)         # BIT 1,(IX+nn)
			0x4A: BIT_N_iRRpNNi(1, rp)         # BIT 1,(IX+nn)
			0x4B: BIT_N_iRRpNNi(1, rp)         # BIT 1,(IX+nn)
			0x4C: BIT_N_iRRpNNi(1, rp)         # BIT 1,(IX+nn)
			0x4D: BIT_N_iRRpNNi(1, rp)         # BIT 1,(IX+nn)
			0x4E: BIT_N_iRRpNNi(1, rp)         # BIT 1,(IX+nn)
			0x4F: BIT_N_iRRpNNi(1, rp)         # BIT 1,(IX+nn)
			0x50: BIT_N_iRRpNNi(2, rp)         # BIT 2,(IX+nn)
			0x51: BIT_N_iRRpNNi(2, rp)         # BIT 2,(IX+nn)
			0x52: BIT_N_iRRpNNi(2, rp)         # BIT 2,(IX+nn)
			0x53: BIT_N_iRRpNNi(2, rp)         # BIT 2,(IX+nn)
			0x54: BIT_N_iRRpNNi(2, rp)         # BIT 2,(IX+nn)
			0x55: BIT_N_iRRpNNi(2, rp)         # BIT 2,(IX+nn)
			0x56: BIT_N_iRRpNNi(2, rp)         # BIT 2,(IX+nn)
			0x57: BIT_N_iRRpNNi(2, rp)         # BIT 2,(IX+nn)
			0x58: BIT_N_iRRpNNi(3, rp)         # BIT 3,(IX+nn)
			0x59: BIT_N_iRRpNNi(3, rp)         # BIT 3,(IX+nn)
			0x5A: BIT_N_iRRpNNi(3, rp)         # BIT 3,(IX+nn)
			0x5B: BIT_N_iRRpNNi(3, rp)         # BIT 3,(IX+nn)
			0x5C: BIT_N_iRRpNNi(3, rp)         # BIT 3,(IX+nn)
			0x5D: BIT_N_iRRpNNi(3, rp)         # BIT 3,(IX+nn)
			0x5E: BIT_N_iRRpNNi(3, rp)         # BIT 3,(IX+nn)
			0x5F: BIT_N_iRRpNNi(3, rp)         # BIT 3,(IX+nn)
			0x60: BIT_N_iRRpNNi(4, rp)         # BIT 4,(IX+nn)
			0x61: BIT_N_iRRpNNi(4, rp)         # BIT 4,(IX+nn)
			0x62: BIT_N_iRRpNNi(4, rp)         # BIT 4,(IX+nn)
			0x63: BIT_N_iRRpNNi(4, rp)         # BIT 4,(IX+nn)
			0x64: BIT_N_iRRpNNi(4, rp)         # BIT 4,(IX+nn)
			0x65: BIT_N_iRRpNNi(4, rp)         # BIT 4,(IX+nn)
			0x66: BIT_N_iRRpNNi(4, rp)         # BIT 4,(IX+nn)
			0x67: BIT_N_iRRpNNi(4, rp)         # BIT 4,(IX+nn)
			0x68: BIT_N_iRRpNNi(5, rp)         # BIT 5,(IX+nn)
			0x69: BIT_N_iRRpNNi(5, rp)         # BIT 5,(IX+nn)
			0x6A: BIT_N_iRRpNNi(5, rp)         # BIT 5,(IX+nn)
			0x6B: BIT_N_iRRpNNi(5, rp)         # BIT 5,(IX+nn)
			0x6C: BIT_N_iRRpNNi(5, rp)         # BIT 5,(IX+nn)
			0x6D: BIT_N_iRRpNNi(5, rp)         # BIT 5,(IX+nn)
			0x6E: BIT_N_iRRpNNi(5, rp)         # BIT 5,(IX+nn)
			0x6F: BIT_N_iRRpNNi(5, rp)         # BIT 5,(IX+nn)
			0x70: BIT_N_iRRpNNi(6, rp)         # BIT 6,(IX+nn)
			0x71: BIT_N_iRRpNNi(6, rp)         # BIT 6,(IX+nn)
			0x72: BIT_N_iRRpNNi(6, rp)         # BIT 6,(IX+nn)
			0x73: BIT_N_iRRpNNi(6, rp)         # BIT 6,(IX+nn)
			0x74: BIT_N_iRRpNNi(6, rp)         # BIT 6,(IX+nn)
			0x75: BIT_N_iRRpNNi(6, rp)         # BIT 6,(IX+nn)
			0x76: BIT_N_iRRpNNi(6, rp)         # BIT 6,(IX+nn)
			0x77: BIT_N_iRRpNNi(6, rp)         # BIT 6,(IX+nn)
			0x78: BIT_N_iRRpNNi(7, rp)         # BIT 7,(IX+nn)
			0x79: BIT_N_iRRpNNi(7, rp)         # BIT 7,(IX+nn)
			0x7A: BIT_N_iRRpNNi(7, rp)         # BIT 7,(IX+nn)
			0x7B: BIT_N_iRRpNNi(7, rp)         # BIT 7,(IX+nn)
			0x7C: BIT_N_iRRpNNi(7, rp)         # BIT 7,(IX+nn)
			0x7D: BIT_N_iRRpNNi(7, rp)         # BIT 7,(IX+nn)
			0x7E: BIT_N_iRRpNNi(7, rp)         # BIT 7,(IX+nn)
			0x7F: BIT_N_iRRpNNi(7, rp)         # BIT 7,(IX+nn)
			0x80: LDBITOP('B', RES, 0, rp)        # LD B,RES 0,(IX+dd)
			0x81: LDBITOP('C', RES, 0, rp)        # LD C,RES 0,(IX+dd)
			0x82: LDBITOP('D', RES, 0, rp)        # LD D,RES 0,(IX+dd)
			0x83: LDBITOP('E', RES, 0, rp)        # LD E,RES 0,(IX+dd)
			0x84: LDBITOP('H', RES, 0, rp)        # LD H,RES 0,(IX+dd)
			0x85: LDBITOP('L', RES, 0, rp)        # LD L,RES 0,(IX+dd)
			0x86: RES 0, "(#{rpn}+nn)"         # RES 0,(IX+nn)
			0x87: LDBITOP('A', RES, 0, rp)        # LD A,RES 0,(IX+dd)
			0x88: LDBITOP('B', RES, 1, rp)        # LD B,RES 1,(IX+dd)
			0x89: LDBITOP('C', RES, 1, rp)        # LD C,RES 1,(IX+dd)
			0x8A: LDBITOP('D', RES, 1, rp)        # LD D,RES 1,(IX+dd)
			0x8B: LDBITOP('E', RES, 1, rp)        # LD E,RES 1,(IX+dd)
			0x8C: LDBITOP('H', RES, 1, rp)        # LD H,RES 1,(IX+dd)
			0x8D: LDBITOP('L', RES, 1, rp)        # LD L,RES 1,(IX+dd)
			0x8E: RES 1, "(#{rpn}+nn)"         # RES 1,(IX+nn)
			0x8F: LDBITOP('A', RES, 1, rp)        # LD A,RES 1,(IX+dd)
			0x90: LDBITOP('B', RES, 2, rp)        # LD B,RES 2,(IX+dd)
			0x91: LDBITOP('C', RES, 2, rp)        # LD C,RES 2,(IX+dd)
			0x92: LDBITOP('D', RES, 2, rp)        # LD D,RES 2,(IX+dd)
			0x93: LDBITOP('E', RES, 2, rp)        # LD E,RES 2,(IX+dd)
			0x94: LDBITOP('H', RES, 2, rp)        # LD H,RES 2,(IX+dd)
			0x95: LDBITOP('L', RES, 2, rp)        # LD L,RES 2,(IX+dd)
			0x96: RES 2, "(#{rpn}+nn)"         # RES 2,(IX+nn)
			0x97: LDBITOP('A', RES, 2, rp)        # LD A,RES 2,(IX+dd)
			0x98: LDBITOP('B', RES, 3, rp)        # LD B,RES 3,(IX+dd)
			0x99: LDBITOP('C', RES, 3, rp)        # LD C,RES 3,(IX+dd)
			0x9A: LDBITOP('D', RES, 3, rp)        # LD D,RES 3,(IX+dd)
			0x9B: LDBITOP('E', RES, 3, rp)        # LD E,RES 3,(IX+dd)
			0x9C: LDBITOP('H', RES, 3, rp)        # LD H,RES 3,(IX+dd)
			0x9D: LDBITOP('L', RES, 3, rp)        # LD L,RES 3,(IX+dd)
			0x9E: RES 3, "(#{rpn}+nn)"         # RES 3,(IX+nn)
			0x9F: LDBITOP('A', RES, 3, rp)        # LD A,RES 3,(IX+dd)
			0xA0: LDBITOP('B', RES, 4, rp)        # LD B,RES 4,(IX+dd)
			0xA1: LDBITOP('C', RES, 4, rp)        # LD C,RES 4,(IX+dd)
			0xA2: LDBITOP('D', RES, 4, rp)        # LD D,RES 4,(IX+dd)
			0xA3: LDBITOP('E', RES, 4, rp)        # LD E,RES 4,(IX+dd)
			0xA4: LDBITOP('H', RES, 4, rp)        # LD H,RES 4,(IX+dd)
			0xA5: LDBITOP('L', RES, 4, rp)        # LD L,RES 4,(IX+dd)
			0xA6: RES 4, "(#{rpn}+nn)"         # RES 4,(IX+nn)
			0xA7: LDBITOP('A', RES, 4, rp)        # LD A,RES 4,(IX+dd)
			0xA8: LDBITOP('B', RES, 5, rp)        # LD B,RES 5,(IX+dd)
			0xA9: LDBITOP('C', RES, 5, rp)        # LD C,RES 5,(IX+dd)
			0xAA: LDBITOP('D', RES, 5, rp)        # LD D,RES 5,(IX+dd)
			0xAB: LDBITOP('E', RES, 5, rp)        # LD E,RES 5,(IX+dd)
			0xAC: LDBITOP('H', RES, 5, rp)        # LD H,RES 5,(IX+dd)
			0xAD: LDBITOP('L', RES, 5, rp)        # LD L,RES 5,(IX+dd)
			0xAE: RES 5, "(#{rpn}+nn)"         # RES 5,(IX+nn)
			0xAF: LDBITOP('A', RES, 5, rp)        # LD A,RES 5,(IX+dd)
			0xB0: LDBITOP('B', RES, 6, rp)        # LD B,RES 6,(IX+dd)
			0xB1: LDBITOP('C', RES, 6, rp)        # LD C,RES 6,(IX+dd)
			0xB2: LDBITOP('D', RES, 6, rp)        # LD D,RES 6,(IX+dd)
			0xB3: LDBITOP('E', RES, 6, rp)        # LD E,RES 6,(IX+dd)
			0xB4: LDBITOP('H', RES, 6, rp)        # LD H,RES 6,(IX+dd)
			0xB5: LDBITOP('L', RES, 6, rp)        # LD L,RES 6,(IX+dd)
			0xB6: RES 6, "(#{rpn}+nn)"         # RES 6,(IX+nn)
			0xB7: LDBITOP('A', RES, 6, rp)        # LD A,RES 6,(IX+dd)
			0xB8: LDBITOP('B', RES, 7, rp)        # LD B,RES 7,(IX+dd)
			0xB9: LDBITOP('C', RES, 7, rp)        # LD C,RES 7,(IX+dd)
			0xBA: LDBITOP('D', RES, 7, rp)        # LD D,RES 7,(IX+dd)
			0xBB: LDBITOP('E', RES, 7, rp)        # LD E,RES 7,(IX+dd)
			0xBC: LDBITOP('H', RES, 7, rp)        # LD H,RES 7,(IX+dd)
			0xBD: LDBITOP('L', RES, 7, rp)        # LD L,RES 7,(IX+dd)
			0xBE: RES 7, "(#{rpn}+nn)"         # RES 7,(IX+nn)
			0xBF: LDBITOP('A', RES, 7, rp)        # LD A,RES 7,(IX+dd)
			0xC0: LDBITOP('B', SET, 0, rp)        # LD B,SET 0,(IX+dd)
			0xC1: LDBITOP('C', SET, 0, rp)        # LD C,SET 0,(IX+dd)
			0xC2: LDBITOP('D', SET, 0, rp)        # LD D,SET 0,(IX+dd)
			0xC3: LDBITOP('E', SET, 0, rp)        # LD E,SET 0,(IX+dd)
			0xC4: LDBITOP('H', SET, 0, rp)        # LD H,SET 0,(IX+dd)
			0xC5: LDBITOP('L', SET, 0, rp)        # LD L,SET 0,(IX+dd)
			0xC6: SET 0, "(#{rpn}+nn)"         # SET 0,(IX+nn)
			0xC7: LDBITOP('A', SET, 0, rp)        # LD A,SET 0,(IX+dd)
			0xC8: LDBITOP('B', SET, 1, rp)        # LD B,SET 1,(IX+dd)
			0xC9: LDBITOP('C', SET, 1, rp)        # LD C,SET 1,(IX+dd)
			0xCA: LDBITOP('D', SET, 1, rp)        # LD D,SET 1,(IX+dd)
			0xCB: LDBITOP('E', SET, 1, rp)        # LD E,SET 1,(IX+dd)
			0xCC: LDBITOP('H', SET, 1, rp)        # LD H,SET 1,(IX+dd)
			0xCD: LDBITOP('L', SET, 1, rp)        # LD L,SET 1,(IX+dd)
			0xCE: SET 1, "(#{rpn}+nn)"         # SET 1,(IX+nn)
			0xCF: LDBITOP('A', SET, 1, rp)        # LD A,SET 1,(IX+dd)
			0xD0: LDBITOP('B', SET, 2, rp)        # LD B,SET 2,(IX+dd)
			0xD1: LDBITOP('C', SET, 2, rp)        # LD C,SET 2,(IX+dd)
			0xD2: LDBITOP('D', SET, 2, rp)        # LD D,SET 2,(IX+dd)
			0xD3: LDBITOP('E', SET, 2, rp)        # LD E,SET 2,(IX+dd)
			0xD4: LDBITOP('H', SET, 2, rp)        # LD H,SET 2,(IX+dd)
			0xD5: LDBITOP('L', SET, 2, rp)        # LD L,SET 2,(IX+dd)
			0xD6: SET 2, "(#{rpn}+nn)"         # SET 2,(IX+nn)
			0xD7: LDBITOP('A', SET, 2, rp)        # LD A,SET 2,(IX+dd)
			0xD8: LDBITOP('B', SET, 3, rp)        # LD B,SET 3,(IX+dd)
			0xD9: LDBITOP('C', SET, 3, rp)        # LD C,SET 3,(IX+dd)
			0xDA: LDBITOP('D', SET, 3, rp)        # LD D,SET 3,(IX+dd)
			0xDB: LDBITOP('E', SET, 3, rp)        # LD E,SET 3,(IX+dd)
			0xDC: LDBITOP('H', SET, 3, rp)        # LD H,SET 3,(IX+dd)
			0xDD: LDBITOP('L', SET, 3, rp)        # LD L,SET 3,(IX+dd)
			0xDE: SET 3, "(#{rpn}+nn)"         # SET 3,(IX+nn)
			0xDF: LDBITOP('A', SET, 3, rp)        # LD A,SET 3,(IX+dd)
			0xE0: LDBITOP('B', SET, 4, rp)        # LD B,SET 4,(IX+dd)
			0xE1: LDBITOP('C', SET, 4, rp)        # LD C,SET 4,(IX+dd)
			0xE2: LDBITOP('D', SET, 4, rp)        # LD D,SET 4,(IX+dd)
			0xE3: LDBITOP('E', SET, 4, rp)        # LD E,SET 4,(IX+dd)
			0xE4: LDBITOP('H', SET, 4, rp)        # LD H,SET 4,(IX+dd)
			0xE5: LDBITOP('L', SET, 4, rp)        # LD L,SET 4,(IX+dd)
			0xE6: SET 4, "(#{rpn}+nn)"         # SET 4,(IX+nn)
			0xE7: LDBITOP('A', SET, 4, rp)        # LD A,SET 4,(IX+dd)
			0xE8: LDBITOP('B', SET, 5, rp)        # LD B,SET 5,(IX+dd)
			0xE9: LDBITOP('C', SET, 5, rp)        # LD C,SET 5,(IX+dd)
			0xEA: LDBITOP('D', SET, 5, rp)        # LD D,SET 5,(IX+dd)
			0xEB: LDBITOP('E', SET, 5, rp)        # LD E,SET 5,(IX+dd)
			0xEC: LDBITOP('H', SET, 5, rp)        # LD H,SET 5,(IX+dd)
			0xED: LDBITOP('L', SET, 5, rp)        # LD L,SET 5,(IX+dd)
			0xEE: SET 5, "(#{rpn}+nn)"         # SET 5,(IX+nn)
			0xEF: LDBITOP('A', SET, 5, rp)        # LD A,SET 5,(IX+dd)
			0xF0: LDBITOP('B', SET, 6, rp)        # LD B,SET 6,(IX+dd)
			0xF1: LDBITOP('C', SET, 6, rp)        # LD C,SET 6,(IX+dd)
			0xF2: LDBITOP('D', SET, 6, rp)        # LD D,SET 6,(IX+dd)
			0xF3: LDBITOP('E', SET, 6, rp)        # LD E,SET 6,(IX+dd)
			0xF4: LDBITOP('H', SET, 6, rp)        # LD H,SET 6,(IX+dd)
			0xF5: LDBITOP('L', SET, 6, rp)        # LD L,SET 6,(IX+dd)
			0xF6: SET 6, "(#{rpn}+nn)"         # SET 6,(IX+nn)
			0xF7: LDBITOP('A', SET, 6, rp)        # LD A,SET 6,(IX+dd)
			0xF8: LDBITOP('B', SET, 7, rp)        # LD B,SET 7,(IX+dd)
			0xF9: LDBITOP('C', SET, 7, rp)        # LD C,SET 7,(IX+dd)
			0xFA: LDBITOP('D', SET, 7, rp)        # LD D,SET 7,(IX+dd)
			0xFB: LDBITOP('E', SET, 7, rp)        # LD E,SET 7,(IX+dd)
			0xFC: LDBITOP('H', SET, 7, rp)        # LD H,SET 7,(IX+dd)
			0xFD: LDBITOP('L', SET, 7, rp)        # LD L,SET 7,(IX+dd)
			0xFE: SET 7, "(#{rpn}+nn)"         # SET 7,(IX+nn)
			0xFF: LDBITOP('A', SET, 7, rp)        # LD A,SET 7,(IX+dd)
			0x100: 'ddcb'
		}

	OPCODE_RUN_STRINGS_DDCB = generateddfdcbOpcodeSet('DDCB')
	OPCODE_RUN_STRINGS_FDCB = generateddfdcbOpcodeSet('FDCB')

	# Generate the opcode runner lookup table for either the DD or FD set, acting on the
	# specified register pair (IX or IY)
	generateddfdOpcodeSet = (prefix) ->
		if prefix == 'DD'
			rp = rpIX
			rh = rIXH
			rl = rIXL

			rpn = 'IX'
			rhn = 'IXH'
			rln = 'IXL'
		else # prefix == 'FD'
			rp = rpIY
			rh = rIYH
			rl = rIYL

			rpn = 'IY'
			rhn = 'IYH'
			rln = 'IYL'
		return {
			0x09: ADD_RR_RR(rp, rpBC)         # ADD IX,BC

			0x19: ADD_RR_RR(rp, rpDE)         # ADD IX,DE

			0x21: LD_RR_NN(rp)         # LD IX,nnnn
			0x22: LD_iNNi_RR(rp)         # LD (nnnn),IX
			0x23: INC_RR(rp)         # INC IX
			0x24: INC rhn          # INC IXh
			0x25: DEC rhn          # DEC IXh
			0x26: LD_R_N(rh)         # LD IXh, nn

			0x29: ADD_RR_RR(rp, rp)         # ADD IX,IX
			0x2A: LD_RR_iNNi(rp)         # LD IX,(nnnn)
			0x2B: DEC_RR(rp)         # DEC IX
			0x2C: INC rln          # INC IXl
			0x2D: DEC rln          # DEC IXl
			0x2E: LD_R_N(rl)         # LD IXl, nn

			0x34: INC "(#{rpn}+nn)"         # INC (IX+nn)
			0x35: DEC "(#{rpn}+nn)"         # DEC (IX+nn)
			0x36: LD_iRRpNNi_N(rp)         # LD (IX+nn),nn

			0x39: ADD_RR_RR(rp, rpSP)         # ADD IX,SP

			0x44: LD_R_R(rB, rh)         # LD B,IXh
			0x45: LD_R_R(rB, rl)         # LD B,IXl
			0x46: LD_R_iRRpNNi(rB, rp)         # LD B,(IX+nn)

			0x4C: LD_R_R(rC, rh)         # LD C,IXh
			0x4D: LD_R_R(rC, rl)         # LD C,IXl
			0x4E: LD_R_iRRpNNi(rC, rp)         # LD C,(IX+nn)

			0x54: LD_R_R(rD, rh)         # LD D,IXh
			0x55: LD_R_R(rD, rl)         # LD D,IXl
			0x56: LD_R_iRRpNNi(rD, rp)         # LD D,(IX+nn)

			0x5C: LD_R_R(rE, rh)         # LD E,IXh
			0x5D: LD_R_R(rE, rl)         # LD E,IXl
			0x5E: LD_R_iRRpNNi(rE, rp)         # LD E,(IX+nn)

			0x60: LD_R_R(rh, rB)         # LD IXh,B
			0x61: LD_R_R(rh, rC)         # LD IXh,C
			0x62: LD_R_R(rh, rD)         # LD IXh,D
			0x63: LD_R_R(rh, rE)         # LD IXh,E
			0x64: LD_R_R(rh, rh)         # LD IXh,IXh
			0x65: LD_R_R(rh, rl)         # LD IXh,IXl
			0x66: LD_R_iRRpNNi(rH, rp)         # LD H,(IX+nn)
			0x67: LD_R_R(rh, rA)         # LD IXh,A
			0x68: LD_R_R(rl, rB)         # LD IXl,B
			0x69: LD_R_R(rl, rC)         # LD IXl,C
			0x6A: LD_R_R(rl, rD)         # LD IXl,D
			0x6B: LD_R_R(rl, rE)         # LD IXl,E
			0x6C: LD_R_R(rl, rh)         # LD IXl,IXh
			0x6D: LD_R_R(rl, rl)         # LD IXl,IXl
			0x6E: LD_R_iRRpNNi(rL, rp)         # LD L,(IX+nn)
			0x6F: LD_R_R(rl, rA)         # LD IXl,A
			0x70: LD_iRRpNNi_R(rp, rB)         # LD (IX+nn),B
			0x71: LD_iRRpNNi_R(rp, rC)         # LD (IX+nn),C
			0x72: LD_iRRpNNi_R(rp, rD)         # LD (IX+nn),D
			0x73: LD_iRRpNNi_R(rp, rE)         # LD (IX+nn),E
			0x74: LD_iRRpNNi_R(rp, rH)         # LD (IX+nn),H
			0x75: LD_iRRpNNi_R(rp, rL)         # LD (IX+nn),L
			0x77: LD_iRRpNNi_R(rp, rA)         # LD (IX+nn),A

			0x7C: LD_R_R(rA, rh)         # LD A,IXh
			0x7D: LD_R_R(rA, rl)         # LD A,IXl
			0x7E: LD_R_iRRpNNi(rA, rp)         # LD A,(IX+nn)

			0x84: ADD_A rhn            # ADD A,IXh
			0x85: ADD_A rln            # ADD A,IXl
			0x86: ADD_A "(#{rpn}+nn)"         # ADD A,(IX+nn)

			0x8C: ADC_A rhn            # ADC A,IXh
			0x8D: ADC_A rln            # ADC A,IXl
			0x8E: ADC_A "(#{rpn}+nn)"         # ADC A,(IX+nn)

			0x94: SUB_A rhn            # SUB IXh
			0x95: SUB_A rln            # SUB IXl
			0x96: SUB_A "(#{rpn}+nn)"         # SUB A,(IX+dd)

			0x9C: SBC_A rhn            # SBC IXh
			0x9D: SBC_A rln            # SBC IXl
			0x9E: SBC_A "(#{rpn}+nn)"         # SBC A,(IX+dd)

			0xA4: AND_A rhn            # AND IXh
			0xA5: AND_A rln            # AND IXl
			0xA6: AND_A "(#{rpn}+nn)"         # AND (IX+dd)

			0xAC: XOR_A rhn            # XOR IXh
			0xAD: XOR_A rln            # XOR IXl
			0xAE: XOR_A "(#{rpn}+nn)"         # XOR A,(IX+dd)

			0xB4: OR_A rhn            # OR IXh
			0xB5: OR_A rln            # OR IXl
			0xB6: OR_A "(#{rpn}+nn)"         # OR A,(IX+dd)

			0xBC: CP_A rhn            # CP IXh
			0xBD: CP_A rln            # CP IXl
			0xBE: CP_A "(#{rpn}+nn)"         # CP (IX+dd)

			0xCB: SHIFT(prefix + 'CB')        # shift code

			0xDD: SHIFT('DD')         # shift code

			0xE1: POP_RR(rp)         # POP IX

			0xE3: EX_iSPi_RR(rp)         # EX (SP),IX

			0xE5: PUSH_RR(rp)         # PUSH IX

			0xE9: JP_RR(rp)         # JP (IX)

			0xF9: LD_RR_RR(rpSP, rp)         # LD SP,IX

			0xFD: SHIFT('FD')         # shift code

			0x100: 'dd'
		}

	OPCODE_RUN_STRINGS_DD = generateddfdOpcodeSet('DD')

	OPCODE_RUN_STRINGS_ED = {

		0x40: IN_R_iCi(rB)         # IN B,(C)
		0x41: OUT_iCi_R(rB)         # OUT (C),B
		0x42: SBC_HL_RR(rpBC)         # SBC HL,BC
		0x43: LD_iNNi_RR(rpBC)         # LD (nnnn),BC
		0x44: NEG()         # NEG
		0x45: RETN()        # RETN
		0x46: IM(0)         # IM 0
		0x47: LD_R_R(rI, rA)         # LD I,A
		0x48: IN_R_iCi(rC)         # IN C,(C)
		0x49: OUT_iCi_R(rC)         # OUT (C),C
		0x4A: ADC_HL_RR(rpBC)        # ADC HL,BC
		0x4B: LD_RR_iNNi(rpBC)         # LD BC,(nnnn)
		0x4C: NEG()         # NEG
		0x4D: RETN()        # RETN
		0x4E: IM(0)         # IM 0
		0x4F: LD_R_R(rR, rA)         # LD R,A
		0x50: IN_R_iCi(rD)         # IN D,(C)
		0x51: OUT_iCi_R(rD)         # OUT (C),D
		0x52: SBC_HL_RR(rpDE)         # SBC HL,DE
		0x53: LD_iNNi_RR(rpDE)         # LD (nnnn),DE
		0x54: NEG()         # NEG
		0x55: RETN()        # RETN
		0x56: IM(1)         # IM 1
		0x57: LD_R_R(rA, rI)         # LD A,I
		0x58: IN_R_iCi(rE)         # IN E,(C)
		0x59: OUT_iCi_R(rE)         # OUT (C),E
		0x5A: ADC_HL_RR(rpDE)        # ADC HL,DE
		0x5B: LD_RR_iNNi(rpDE)         # LD DE,(nnnn)
		0x5C: NEG()         # NEG
		0x5D: RETN()        # RETN
		0x5E: IM(2)         # IM 2
		0x5F: LD_R_R(rA, rR)         # LD A,R
		0x60: IN_R_iCi(rH)         # IN H,(C)
		0x61: OUT_iCi_R(rH)         # OUT (C),H
		0x62: SBC_HL_RR(rpHL)         # SBC HL,HL
		0x63: LD_iNNi_RR(rpHL)         # LD (nnnn),HL
		0x64: NEG()         # NEG
		0x65: RETN()        # RETN
		0x66: IM(0)         # IM 0
		0x67: RRD()        # RRD
		0x68: IN_R_iCi(rL)         # IN L,(C)
		0x69: OUT_iCi_R(rL)         # OUT (C),L
		0x6A: ADC_HL_RR(rpHL)        # ADC HL,HL
		0x6B: LD_RR_iNNi(rpHL, true)         # LD HL,(nnnn)
		0x6C: NEG()         # NEG
		0x6D: RETN()        # RETN
		0x6E: IM(0)         # IM 0
		0x6F: RLD()        # RLD
		0x70: IN_F_iCi()        # IN F,(C)
		0x71: OUT_iCi_0()        # OUT (C),0
		0x72: SBC_HL_RR(rpSP)         # SBC HL,SP
		0x73: LD_iNNi_RR(rpSP)         # LD (nnnn),SP
		0x74: NEG()         # NEG
		0x75: RETN()        # RETN
		0x76: IM(1)         # IM 1

		0x78: IN_R_iCi(rA)         # IN A,(C)
		0x79: OUT_iCi_R(rA)         # OUT (C),A
		0x7A: ADC_HL_RR(rpSP)        # ADC HL,SP
		0x7B: LD_RR_iNNi(rpSP)         # LD SP,(nnnn)
		0x7C: NEG()         # NEG
		0x7D: RETN()        # RETN
		0x7E: IM(2)         # IM 2

		0xA0: LDI()         # LDI
		0xA1: CPI()         # CPI
		0xA2: INI()         # INI
		0xA3: OUTI()        # OUTI

		0xA8: LDD()         # LDD
		0xA9: CPD()         # CPD
		0xAA: IND()         # IND
		0xAB: OUTD()        # OUTD

		0xB0: LDIR()         # LDIR
		0xb1: CPIR()         # CPIR
		0xB2: INIR()         # INIR
		0xB3: OTIR()         # OTIR

		0xB8: LDDR()         # LDDR
		0xb9: CPDR()         # CPDR
		0xBA: INDR()         # INDR
		0xBB: OTDR()         # OTDR

		0x100: 'ed'
	}

	OPCODE_RUN_STRINGS_FD = generateddfdOpcodeSet('FD')

	OPCODE_RUN_STRINGS = {
		0x00: NOP()         # NOP
		0x01: LD_RR_NN(rpBC)         # LD BC,nnnn
		0x02: LD_iRRi_R(rpBC, rA)         # LD (BC),A
		0x03: INC_RR(rpBC)         # INC BC
		0x04: INC "B"         # INC B
		0x05: DEC "B"         # DEC B
		0x06: LD_R_N(rB)         # LD B,nn
		0x07: RLCA()         # RLCA
		0x08: EX_RR_RR(rpAF, rpAF_)         # EX AF,AF'
		0x09: ADD_RR_RR(rpHL, rpBC)         # ADD HL,BC
		0x0A: LD_R_iRRi(rA, rpBC)         # LD A,(BC)
		0x0B: DEC_RR(rpBC)         # DEC BC
		0x0C: INC "C"         # INC C
		0x0D: DEC "C"         # DEC C
		0x0E: LD_R_N(rC)         # LD C,nn
		0x0F: RRCA()         # RRCA
		0x10: DJNZ_N()         # DJNZ nn
		0x11: LD_RR_NN(rpDE)         # LD DE,nnnn
		0x12: LD_iRRi_R(rpDE, rA)         # LD (DE),A
		0x13: INC_RR(rpDE)         # INC DE
		0x14: INC "D"         # INC D
		0x15: DEC "D"         # DEC D
		0x16: LD_R_N(rD)         # LD D,nn
		0x17: RLA()         # RLA
		0x18: JR_N()         # JR nn
		0x19: ADD_RR_RR(rpHL, rpDE)         # ADD HL,DE
		0x1A: LD_R_iRRi(rA, rpDE)         # LD A,(DE)
		0x1B: DEC_RR(rpDE)         # DEC DE
		0x1C: INC "E"         # INC E
		0x1D: DEC "E"         # DEC E
		0x1E: LD_R_N(rE)         # LD E,nn
		0x1F: RRA()         # RRA
		0x20: JR_C_N(FLAG_Z, false)         # JR NZ,nn
		0x21: LD_RR_NN(rpHL)         # LD HL,nnnn
		0x22: LD_iNNi_RR(rpHL)         # LD (nnnn),HL
		0x23: INC_RR(rpHL)         # INC HL
		0x24: INC "H"         # INC H
		0x25: DEC "H"         # DEC H
		0x26: LD_R_N(rH)         # LD H,nn
		0x27: DAA()           # DAA
		0x28: JR_C_N(FLAG_Z, true)         # JR Z,nn
		0x29: ADD_RR_RR(rpHL, rpHL)         # ADD HL,HL
		0x2A: LD_RR_iNNi(rpHL)         # LD HL,(nnnn)
		0x2B: DEC_RR(rpHL)         # DEC HL
		0x2C: INC "L"         # INC L
		0x2D: DEC "L"         # DEC L
		0x2E: LD_R_N(rL)         # LD L,nn
		0x2F: CPL()         # CPL
		0x30: JR_C_N(FLAG_C, false)         # JR NC,nn
		0x31: LD_RR_NN(rpSP)         # LD SP,nnnn
		0x32: LD_iNNi_A()         # LD (nnnn),a
		0x33: INC_RR(rpSP)         # INC SP
		0x34: INC "(HL)"         # INC (HL)
		0x35: DEC "(HL)"         # DEC (HL)
		0x36: LD_iRRi_N(rpHL)         # LD (HL),nn
		0x37: SCF()         # SCF
		0x38: JR_C_N(FLAG_C, true)         # JR C,nn
		0x39: ADD_RR_RR(rpHL, rpSP)         # ADD HL,SP
		0x3A: LD_A_iNNi()         # LD A,(nnnn)
		0x3B: DEC_RR(rpSP)         # DEC SP
		0x3C: INC "A"         # INC A
		0x3D: DEC "A"         # DEC A
		0x3E: LD_R_N(rA)         # LD A,nn
		0x3F: CCF()         # CCF
		0x40: LD_R_R(rB, rB)         # LD B,B
		0x41: LD_R_R(rB, rC)         # LD B,C
		0x42: LD_R_R(rB, rD)         # LD B,D
		0x43: LD_R_R(rB, rE)         # LD B,E
		0x44: LD_R_R(rB, rH)         # LD B,H
		0x45: LD_R_R(rB, rL)         # LD B,L
		0x46: LD_R_iRRi(rB, rpHL)         # LD B,(HL)
		0x47: LD_R_R(rB, rA)         # LD B,A
		0x48: LD_R_R(rC, rB)         # LD C,B
		0x49: LD_R_R(rC, rC)         # LD C,C
		0x4a: LD_R_R(rC, rD)         # LD C,D
		0x4b: LD_R_R(rC, rE)         # LD C,E
		0x4c: LD_R_R(rC, rH)         # LD C,H
		0x4d: LD_R_R(rC, rL)         # LD C,L
		0x4e: LD_R_iRRi(rC, rpHL)         # LD C,(HL)
		0x4f: LD_R_R(rC, rA)         # LD C,A
		0x50: LD_R_R(rD, rB)         # LD D,B
		0x51: LD_R_R(rD, rC)         # LD D,C
		0x52: LD_R_R(rD, rD)         # LD D,D
		0x53: LD_R_R(rD, rE)         # LD D,E
		0x54: LD_R_R(rD, rH)         # LD D,H
		0x55: LD_R_R(rD, rL)         # LD D,L
		0x56: LD_R_iRRi(rD, rpHL)         # LD D,(HL)
		0x57: LD_R_R(rD, rA)         # LD D,A
		0x58: LD_R_R(rE, rB)         # LD E,B
		0x59: LD_R_R(rE, rC)         # LD E,C
		0x5a: LD_R_R(rE, rD)         # LD E,D
		0x5b: LD_R_R(rE, rE)         # LD E,E
		0x5c: LD_R_R(rE, rH)         # LD E,H
		0x5d: LD_R_R(rE, rL)         # LD E,L
		0x5e: LD_R_iRRi(rE, rpHL)         # LD E,(HL)
		0x5f: LD_R_R(rE, rA)         # LD E,A
		0x60: LD_R_R(rH, rB)         # LD H,B
		0x61: LD_R_R(rH, rC)         # LD H,C
		0x62: LD_R_R(rH, rD)         # LD H,D
		0x63: LD_R_R(rH, rE)         # LD H,E
		0x64: LD_R_R(rH, rH)         # LD H,H
		0x65: LD_R_R(rH, rL)         # LD H,L
		0x66: LD_R_iRRi(rH, rpHL)         # LD H,(HL)
		0x67: LD_R_R(rH, rA)         # LD H,A
		0x68: LD_R_R(rL, rB)         # LD L,B
		0x69: LD_R_R(rL, rC)         # LD L,C
		0x6a: LD_R_R(rL, rD)         # LD L,D
		0x6b: LD_R_R(rL, rE)         # LD L,E
		0x6c: LD_R_R(rL, rH)         # LD L,H
		0x6d: LD_R_R(rL, rL)         # LD L,L
		0x6e: LD_R_iRRi(rL, rpHL)         # LD L,(HL)
		0x6f: LD_R_R(rL, rA)         # LD L,A
		0x70: LD_iRRi_R(rpHL, rB)         # LD (HL),B
		0x71: LD_iRRi_R(rpHL, rC)         # LD (HL),C
		0x72: LD_iRRi_R(rpHL, rD)         # LD (HL),D
		0x73: LD_iRRi_R(rpHL, rE)         # LD (HL),E
		0x74: LD_iRRi_R(rpHL, rH)         # LD (HL),H
		0x75: LD_iRRi_R(rpHL, rL)         # LD (HL),L
		0x76: HALT()         # HALT
		0x77: LD_iRRi_R(rpHL, rA)         # LD (HL),A
		0x78: LD_R_R(rA, rB)         # LD A,B
		0x79: LD_R_R(rA, rC)         # LD A,C
		0x7a: LD_R_R(rA, rD)         # LD A,D
		0x7b: LD_R_R(rA, rE)         # LD A,E
		0x7c: LD_R_R(rA, rH)         # LD A,H
		0x7d: LD_R_R(rA, rL)         # LD A,L
		0x7e: LD_R_iRRi(rA, rpHL)         # LD A,(HL)
		0x7f: LD_R_R(rA, rA)         # LD A,A
		0x80: ADD_A "B"         # ADD A,B
		0x81: ADD_A "C"         # ADD A,C
		0x82: ADD_A "D"         # ADD A,D
		0x83: ADD_A "E"         # ADD A,E
		0x84: ADD_A "H"         # ADD A,H
		0x85: ADD_A "L"         # ADD A,L
		0x86: ADD_A "(HL)"         # ADD A,(HL)
		0x87: ADD_A "A"         # ADD A,A
		0x88: ADC_A "B"         # ADC A,B
		0x89: ADC_A "C"         # ADC A,C
		0x8a: ADC_A "D"         # ADC A,D
		0x8b: ADC_A "E"         # ADC A,E
		0x8c: ADC_A "H"         # ADC A,H
		0x8d: ADC_A "L"         # ADC A,L
		0x8e: ADC_A "(HL)"         # ADC A,(HL)
		0x8f: ADC_A "A"         # ADC A,A
		0x90: SUB_A "B"         # SUB A,B
		0x91: SUB_A "C"         # SUB A,C
		0x92: SUB_A "D"         # SUB A,D
		0x93: SUB_A "E"         # SUB A,E
		0x94: SUB_A "H"         # SUB A,H
		0x95: SUB_A "L"         # SUB A,L
		0x96: SUB_A "(HL)"         # SUB A,(HL)
		0x97: SUB_A "A"         # SUB A,A
		0x98: SBC_A "B"         # SBC A,B
		0x99: SBC_A "C"         # SBC A,C
		0x9a: SBC_A "D"         # SBC A,D
		0x9b: SBC_A "E"         # SBC A,E
		0x9c: SBC_A "H"         # SBC A,H
		0x9d: SBC_A "L"         # SBC A,L
		0x9e: SBC_A "(HL)"         # SBC A,(HL)
		0x9f: SBC_A "A"         # SBC A,A
		0xa0: AND_A "B"         # AND A,B
		0xa1: AND_A "C"         # AND A,C
		0xa2: AND_A "D"         # AND A,D
		0xa3: AND_A "E"         # AND A,E
		0xa4: AND_A "H"         # AND A,H
		0xa5: AND_A "L"         # AND A,L
		0xa6: AND_A "(HL)"         # AND A,(HL)
		0xa7: AND_A "A"         # AND A,A
		0xA8: XOR_A "B"         # XOR B
		0xA9: XOR_A "C"         # XOR C
		0xAA: XOR_A "D"         # XOR D
		0xAB: XOR_A "E"         # XOR E
		0xAC: XOR_A "H"         # XOR H
		0xAD: XOR_A "L"         # XOR L
		0xAE: XOR_A "(HL)"         # XOR (HL)
		0xAF: XOR_A "A"         # XOR A
		0xb0: OR_A "B"         # OR B
		0xb1: OR_A "C"         # OR C
		0xb2: OR_A "D"         # OR D
		0xb3: OR_A "E"         # OR E
		0xb4: OR_A "H"         # OR H
		0xb5: OR_A "L"         # OR L
		0xb6: OR_A "(HL)"         # OR (HL)
		0xb7: OR_A "A"         # OR A
		0xb8: CP_A "B"         # CP B
		0xb9: CP_A "C"         # CP C
		0xba: CP_A "D"         # CP D
		0xbb: CP_A "E"         # CP E
		0xbc: CP_A "H"         # CP H
		0xbd: CP_A "L"         # CP L
		0xbe: CP_A "(HL)"         # CP (HL)
		0xbf: CP_A "A"         # CP A
		0xC0: RET_C(FLAG_Z, false)         # RET NZ
		0xC1: POP_RR(rpBC)         # POP BC
		0xC2: JP_C_NN(FLAG_Z, false)         # JP NZ,nnnn
		0xC3: JP_NN()         # JP nnnn
		0xC4: CALL_C_NN(FLAG_Z, false)         # CALL NZ,nnnn
		0xC5: PUSH_RR(rpBC)         # PUSH BC
		0xC6: ADD_A "nn"         # ADD A,nn
		0xC7: RST(0x0000)         # RST 0x00
		0xC8: RET_C(FLAG_Z, true)         # RET Z
		0xC9: RET()         # RET
		0xCA: JP_C_NN(FLAG_Z, true)         # JP Z,nnnn
		0xCB: SHIFT('CB')         # shift code
		0xCC: CALL_C_NN(FLAG_Z, true)         # CALL Z,nnnn
		0xCD: CALL_NN()         # CALL nnnn
		0xCE: ADC_A "nn"         # ADC A,nn
		0xCF: RST(0x0008)         # RST 0x08
		0xD0: RET_C(FLAG_C, false)         # RET NC
		0xD1: POP_RR(rpDE)         # POP DE
		0xD2: JP_C_NN(FLAG_C, false)         # JP NC,nnnn
		0xD3: OUT_iNi_A()         # OUT (nn),A
		0xD4: CALL_C_NN(FLAG_C, false)         # CALL NC,nnnn
		0xD5: PUSH_RR(rpDE)         # PUSH DE
		0xD6: SUB_A "nn"         # SUB nn
		0xD7: RST(0x0010)         # RST 0x10
		0xD8: RET_C(FLAG_C, true)         # RET C
		0xD9: EXX()         # EXX
		0xDA: JP_C_NN(FLAG_C, true)         # JP C,nnnn
		0xDB: IN_A_N()         # IN A,(nn)
		0xDC: CALL_C_NN(FLAG_C, true)         # CALL C,nnnn
		0xDD: SHIFT('DD')         # shift code
		0xDE: SBC_A "nn"         # SBC A,nn
		0xDF: RST(0x0018)         # RST 0x18
		0xE0: RET_C(FLAG_P, false)         # RET PO
		0xE1: POP_RR(rpHL)         # POP HL
		0xE2: JP_C_NN(FLAG_P, false)         # JP PO,nnnn
		0xE3: EX_iSPi_RR(rpHL)         # EX (SP),HL
		0xE4: CALL_C_NN(FLAG_P, false)         # CALL PO,nnnn
		0xE5: PUSH_RR(rpHL)         # PUSH HL
		0xE6: AND_A "nn"         # AND nn
		0xE7: RST(0x0020)         # RST 0x20
		0xE8: RET_C(FLAG_P, true)         # RET PE
		0xE9: JP_RR(rpHL)         # JP (HL)
		0xEA: JP_C_NN(FLAG_P, true)         # JP PE,nnnn
		0xEB: EX_RR_RR(rpDE, rpHL)         # EX DE,HL
		0xEC: CALL_C_NN(FLAG_P, true)         # CALL PE,nnnn
		0xED: SHIFT('ED')         # shift code
		0xEE: XOR_A "nn"         # XOR nn
		0xEF: RST(0x0028)         # RST 0x28
		0xF0: RET_C(FLAG_S, false)         # RET P
		0xF1: POP_RR(rpAF)         # POP AF
		0xF2: JP_C_NN(FLAG_S, false)         # JP NZ,nnnn
		0xF3: DI()         # DI
		0xF4: CALL_C_NN(FLAG_S, false)         # CALL P,nnnn
		0xF5: PUSH_RR(rpAF)         # PUSH AF
		0xF6: OR_A "nn"         # OR nn
		0xF7: RST(0x0030)         # RST 0x30
		0xF8: RET_C(FLAG_S, true)         # RET M
		0xF9: LD_RR_RR(rpSP, rpHL)         # LD SP,HL
		0xFA: JP_C_NN(FLAG_S, true)         # JP M,nnnn
		0xFB: EI()         # EI
		0xFC: CALL_C_NN(FLAG_S, true)         # CALL M,nnnn
		0xFD: SHIFT('FD')         # shift code
		0xFE: CP_A "nn"         # CP nn
		0xFF: RST(0x0038)         # RST 0x38
		0x100: 0
	}

	###
	Assemble and evaluate the final JS code for the Z80 component.
	The indirection on 'eval' causes most browsers to evaluate it in the global
	scope, giving a significant speed boost
	###
	defineZ80JS = """
		window.Z80 = function(opts) {
			var self = {};

			#{setUpStateJS}

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
						regPairs[#{rpPC}]++;
						halted = false;
					}

					iff1 = iff2 = 0;

					/* push current PC in readiness for call to interrupt handler */
					regPairs[#{rpSP}]--; WRITEMEM(regPairs[#{rpSP}], regPairs[#{rpPC}] >> 8);
					regPairs[#{rpSP}]--; WRITEMEM(regPairs[#{rpSP}], regPairs[#{rpPC}] & 0xff);

					/* TODO: R register */

					switch (im) {
						case 0:
							regPairs[#{rpPC}] = interruptDataBus; // assume always RST
							tstates += 6;
							break;
						case 1:
							regPairs[#{rpPC}] = 0x0038;
							tstates += 7;
							break;
						case 2:
							inttemp = (regs[#{rI}] << 8) | (interruptDataBus & 0xff);
							l = READMEM(inttemp);
							inttemp = (inttemp+1) & 0xffff;
							h = READMEM(inttemp);
							console.log(hex(interruptDataBus), hex(inttemp), hex(l), hex(h));
							regPairs[#{rpPC}] = (h<<8) | l;
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
							CONTEND_READ(regPairs[#{rpPC}], 4);
							opcode = memory.read(regPairs[#{rpPC}]); regPairs[#{rpPC}]++;
							regs[#{rR}] = ((regs[#{rR}] + 1) & 0x7f) | (regs[#{rR}] & 0x80);
							#{opcodeSwitch(OPCODE_RUN_STRINGS, null, opts.traps)}
							break;
						case 'CB':
							CONTEND_READ(regPairs[#{rpPC}], 4);
							opcode = memory.read(regPairs[#{rpPC}]); regPairs[#{rpPC}]++;
							regs[#{rR}] = ((regs[#{rR}] + 1) & 0x7f) | (regs[#{rR}] & 0x80);
							#{opcodeSwitch(OPCODE_RUN_STRINGS_CB)}
							break;
						case 'DD':
							CONTEND_READ(regPairs[#{rpPC}], 4);
							opcode = memory.read(regPairs[#{rpPC}]); regPairs[#{rpPC}]++;
							regs[#{rR}] = ((regs[#{rR}] + 1) & 0x7f) | (regs[#{rR}] & 0x80);
							#{opcodeSwitch(OPCODE_RUN_STRINGS_DD, OPCODE_RUN_STRINGS)}
							break;
						case 'DDCB':
							offset = READMEM(regPairs[#{rpPC}]); regPairs[#{rpPC}]++;
							if (offset & 0x80) offset -= 0x100;
							CONTEND_READ(regPairs[#{rpPC}], 3);
							opcode = memory.read(regPairs[#{rpPC}]);
							CONTEND_READ_NO_MREQ(regPairs[#{rpPC}], 1);
							CONTEND_READ_NO_MREQ(regPairs[#{rpPC}], 1);
							regPairs[#{rpPC}]++;
							#{opcodeSwitch(OPCODE_RUN_STRINGS_DDCB)}
							break;
						case 'ED':
							CONTEND_READ(regPairs[#{rpPC}], 4);
							opcode = memory.read(regPairs[#{rpPC}]); regPairs[#{rpPC}]++;
							regs[#{rR}] = ((regs[#{rR}] + 1) & 0x7f) | (regs[#{rR}] & 0x80);
							#{opcodeSwitch(OPCODE_RUN_STRINGS_ED)}
							break;
						case 'FD':
							CONTEND_READ(regPairs[#{rpPC}], 4);
							opcode = memory.read(regPairs[#{rpPC}]); regPairs[#{rpPC}]++;
							regs[#{rR}] = ((regs[#{rR}] + 1) & 0x7f) | (regs[#{rR}] & 0x80);
							#{opcodeSwitch(OPCODE_RUN_STRINGS_FD, OPCODE_RUN_STRINGS)}
							break;
						case 'FDCB':
							offset = READMEM(regPairs[#{rpPC}]); regPairs[#{rpPC}]++;
							if (offset & 0x80) offset -= 0x100;
							CONTEND_READ(regPairs[#{rpPC}], 3);
							opcode = memory.read(regPairs[#{rpPC}]);
							CONTEND_READ_NO_MREQ(regPairs[#{rpPC}], 1);
							CONTEND_READ_NO_MREQ(regPairs[#{rpPC}], 1);
							regPairs[#{rpPC}]++;
							#{opcodeSwitch(OPCODE_RUN_STRINGS_FDCB)}
							break;
						default:
							throw("Unknown opcode prefix: " + lastOpcodePrefix);
					}
				}
				while (display.nextEventTime != null && display.nextEventTime <= tstates) display.doEvent();
			};

			self.reset = function() {
				regPairs[#{rpPC}] = regPairs[#{rpIR}] = 0;
				iff1 = 0; iff2 = 0; im = 0; halted = false;
			};

			self.loadState = function(snapRegs) {
				regPairs[#{rpAF}] = snapRegs['AF'];
				regPairs[#{rpBC}] = snapRegs['BC'];
				regPairs[#{rpDE}] = snapRegs['DE'];
				regPairs[#{rpHL}] = snapRegs['HL'];
				regPairs[#{rpAF_}] = snapRegs['AF_'];
				regPairs[#{rpBC_}] = snapRegs['BC_'];
				regPairs[#{rpDE_}] = snapRegs['DE_'];
				regPairs[#{rpHL_}] = snapRegs['HL_'];
				regPairs[#{rpIX}] = snapRegs['IX'];
				regPairs[#{rpIY}] = snapRegs['IY'];
				regPairs[#{rpSP}] = snapRegs['SP'];
				regPairs[#{rpPC}] = snapRegs['PC'];
				regPairs[#{rpIR}] = snapRegs['IR'];
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
					AF: regPairs[#{rpAF}],
					BC: regPairs[#{rpBC}],
					DE: regPairs[#{rpDE}],
					HL: regPairs[#{rpHL}],
					AF_: regPairs[#{rpAF_}],
					BC_: regPairs[#{rpBC_}],
					DE_: regPairs[#{rpDE_}],
					HL_: regPairs[#{rpHL_}],
					IX: regPairs[#{rpIX}],
					IY: regPairs[#{rpIY}],
					SP: regPairs[#{rpSP}],
					PC: regPairs[#{rpPC}],
					IR: regPairs[#{rpIR}],
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
				return regPairs[#{rpAF}];
			}
			self.getBC = function() {
				return regPairs[#{rpBC}];
			}
			self.getDE = function() {
				return regPairs[#{rpDE}];
			}
			self.getHL = function() {
				return regPairs[#{rpHL}];
			}
			self.getAF_ = function() {
				return regPairs[#{rpAF_}];
			}
			self.getBC_ = function() {
				return regPairs[#{rpBC_}];
			}
			self.getDE_ = function() {
				return regPairs[#{rpDE_}];
			}
			self.getHL_ = function() {
				return regPairs[#{rpHL_}];
			}
			self.getIX = function() {
				return regPairs[#{rpIX}];
			}
			self.getIY = function() {
				return regPairs[#{rpIY}];
			}
			self.getI = function() {
				return regs[#{rI}];
			}
			self.getR = function() {
				return regs[#{rR}];
			}
			self.getSP = function() {
				return regPairs[#{rpSP}];
			}
			self.getPC = function() {
				return regPairs[#{rpPC}];
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
				regPairs[#{rpAF}] = val;
			}
			self.setBC = function(val) {
				regPairs[#{rpBC}] = val;
			}
			self.setDE = function(val) {
				regPairs[#{rpDE}] = val;
			}
			self.setHL = function(val) {
				regPairs[#{rpHL}] = val;
			}
			self.setAF_ = function(val) {
				regPairs[#{rpAF_}] = val;
			}
			self.setBC_ = function(val) {
				regPairs[#{rpBC_}] = val;
			}
			self.setDE_ = function(val) {
				regPairs[#{rpDE_}] = val;
			}
			self.setHL_ = function(val) {
				regPairs[#{rpHL_}] = val;
			}
			self.setIX = function(val) {
				regPairs[#{rpIX}] = val;
			}
			self.setIY = function(val) {
				regPairs[#{rpIY}] = val;
			}
			self.setI = function(val) {
				regs[#{rI}] = val;
			}
			self.setR = function(val) {
				regs[#{rR}] = val;
			}
			self.setSP = function(val) {
				regPairs[#{rpSP}] = val;
			}
			self.setPC = function(val) {
				regPairs[#{rpPC}] = val;
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
				return regs[#{rF_}] & #{FLAG_C};
			};
			self.setCarry = function(val) {
				if (val) {
					regs[#{rF}] |= #{FLAG_C};
				} else {
					regs[#{rF}] &= #{~FLAG_C};
				}
			};
			self.getA_ = function() {
				return regs[#{rA_}];
			};

			return self;
		};
	"""
	# Apply macro expansions
	defineZ80JS = defineZ80JS.replace(/READMEM\((.*?)\)/g, '(CONTEND_READ($1, 3), memory.read($1))');
	defineZ80JS = defineZ80JS.replace(/WRITEMEM\((.*?),(.*?)\)/g, """
		CONTEND_WRITE($1, 3);
		while (display.nextEventTime != null && display.nextEventTime < tstates) display.doEvent();
		memory.write($1,$2);
	""");
	if opts.applyContention
		defineZ80JS = defineZ80JS.replace(/CONTEND_READ\((.*?),(.*?)\)/g,
			'(tstates += memory.contend($1, tstates) + ($2))');
		defineZ80JS = defineZ80JS.replace(/CONTEND_WRITE\((.*?),(.*?)\)/g,
			'(tstates += memory.contend($1, tstates) + ($2))');
		defineZ80JS = defineZ80JS.replace(/CONTEND_READ_NO_MREQ\((.*?),(.*?)\)/g,
			'(tstates += memory.contend($1, tstates) + ($2))');
		defineZ80JS = defineZ80JS.replace(/CONTEND_WRITE_NO_MREQ\((.*?),(.*?)\)/g,
			'(tstates += memory.contend($1, tstates) + ($2))');
		defineZ80JS = defineZ80JS.replace(/CONTEND_PORT_EARLY\((.*?)\)/g,
			"""
				var isContendedMemory = memory.isContended($1);
				var isULAPort = ioBus.isULAPort($1);
				if (isContendedMemory) tstates += ioBus.contend($1, tstates);
				tstates += 1;
				while (display.nextEventTime != null && display.nextEventTime < tstates) display.doEvent();
			""");
		defineZ80JS = defineZ80JS.replace(/CONTEND_PORT_LATE\((.*?)\)/g,
			"""
				if (isContendedMemory || isULAPort) {
					ioBus.contend($1);
					tstates += 1;
					if (!isULAPort) {
						ioBus.contend($1); tstates += 1;
						ioBus.contend($1); tstates += 1;
					} else {
						tstates += 2;
					}
				} else {
					tstates += 3;
				}
			""");
	else
		defineZ80JS = defineZ80JS.replace(/CONTEND_READ\((.*?),(.*?)\)/g, 'tstates += ($2)');
		defineZ80JS = defineZ80JS.replace(/CONTEND_WRITE\((.*?),(.*?)\)/g, 'tstates += ($2)');
		defineZ80JS = defineZ80JS.replace(/CONTEND_READ_NO_MREQ\((.*?),(.*?)\)/g, 'tstates += ($2)');
		defineZ80JS = defineZ80JS.replace(/CONTEND_WRITE_NO_MREQ\((.*?),(.*?)\)/g, 'tstates += ($2)');
		defineZ80JS = defineZ80JS.replace(/CONTEND_PORT_EARLY\((.*?)\)/g, 'tstates += 1');
		defineZ80JS = defineZ80JS.replace(/CONTEND_PORT_LATE\((.*?)\)/g, 'tstates += 3');

	# console.log(defineZ80JS);
	indirectEval = eval
	indirectEval(defineZ80JS);
