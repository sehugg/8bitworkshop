/*
From: https://github.com/endrift/gbajs

Copyright © 2012 – 2013, Jeffrey Pfau
All rights reserved.

Redistribution and use in source and binary forms, with or without
modification, are permitted provided that the following conditions are met:

* Redistributions of source code must retain the above copyright notice, this
  list of conditions and the following disclaimer.

* Redistributions in binary form must reproduce the above copyright notice,
  this list of conditions and the following disclaimer in the documentation
  and/or other materials provided with the distribution.

THIS SOFTWARE IS PROVIDED BY THE COPYRIGHT HOLDERS AND CONTRIBUTORS "AS IS"
AND ANY EXPRESS OR IMPLIED WARRANTIES, INCLUDING, BUT NOT LIMITED TO, THE
IMPLIED WARRANTIES OF MERCHANTABILITY AND FITNESS FOR A PARTICULAR PURPOSE
ARE DISCLAIMED. IN NO EVENT SHALL THE COPYRIGHT HOLDER OR CONTRIBUTORS BE
LIABLE FOR ANY DIRECT, INDIRECT, INCIDENTAL, SPECIAL, EXEMPLARY, OR
CONSEQUENTIAL DAMAGES (INCLUDING, BUT NOT LIMITED TO, PROCUREMENT OF
SUBSTITUTE GOODS OR SERVICES; LOSS OF USE, DATA, OR PROFITS; OR BUSINESS
INTERRUPTION) HOWEVER CAUSED AND ON ANY THEORY OF LIABILITY, WHETHER IN
CONTRACT, STRICT LIABILITY, OR TORT (INCLUDING NEGLIGENCE OR OTHERWISE)
ARISING IN ANY WAY OUT OF THE USE OF THIS SOFTWARE, EVEN IF ADVISED OF THE
POSSIBILITY OF SUCH DAMAGE.
*/

import { Bus, CPU, InstructionBased, SavesState } from "../devices";
import { EmuHalt } from "../emu";
import { hex } from "../util";

interface AddressFunction extends Function {
    writesPC? : boolean;
    fixedJump? : boolean;
}

interface ARMIRQInterface {
	clear() : void;
	swi(opcode : number) : void;
	swi32(opcode : number) : void;
	updateTimers() : void;
	testIRQ() : void;
}

interface ARMMemoryRegion {
	PAGE_MASK : number;
	ICACHE_PAGE_BITS : number;
	icache : ARMMemoryPage[];
}

interface ARMOperation {
	next : ARMOperation;
	page : ARMMemoryPage;
	address : number;
	opcode : number;
}

interface ARMMemoryPage {
	arm : ARMOperation[];
	thumb : ARMOperation[];
	invalid : boolean;
}

interface ARMMMUInterface {
	memory : ARMMemoryRegion[];
	BASE_OFFSET : number;
	OFFSET_MASK : number;

	load8(a: number) : number;
	loadU8(a: number) : number;
	load16(a: number) : number;
	loadU16(a: number) : number;
	load32(a: number) : number;
	store8(a: number, v: number) : void;
	store16(a: number, v: number) : void;
	store32(a: number, v: number) : void;

	wait(a: number) : void;
	wait32(a: number) : void;
	waitSeq32(a: number) : void;
	waitMul(a: number) : void;
	waitMulti32(a: number, total: number) : void;
	waitPrefetch(a: number) : void;
	waitPrefetch32(a: number) : void;

	addressToPage(region: number, address: number) : number;
	accessPage(region: number, pageId: number) : ARMMemoryPage;
}

export interface ARMCoreState {
	PC: number,
	SP: number,
	gprs: number[],
	mode: number,
	cpsrI: boolean,
	cpsrF: boolean,
	cpsrV: boolean,
	cpsrC: boolean,
	cpsrZ: boolean,
	cpsrN: boolean,
	bankedRegisters: number[][],
	spsr: number,
	bankedSPSRs: number[],
	cycles: number,
	instructionWidth: 2 | 4
}

interface ARMCoreType {
	gprs: Int32Array;
	PC: number;
	SP: number;
	LR: number;
	cycles: number;
	mode: number;
	shifterOperand: number;
	shifterCarryOut: number|boolean;
	cpsrN: number|boolean;
	cpsrC: number|boolean;
	cpsrZ: number|boolean;
	cpsrV: number|boolean;
	cpsrI: number|boolean;
	cpsrF: number|boolean;
	spsr: number;
	mmu: ARMMMUInterface;
	irq : ARMIRQInterface;
	instructionWidth: 2 | 4;

	hasSPSR() : boolean;
	unpackCPSR(v : number) : void;
	switchMode(mode : number) : void;
	switchExecMode(mode : number) : void;
	packCPSR() : number;

	step() : void;
	resetCPU(startOffset : number) : void;
	freeze() : ARMCoreState;
	defrost(state: ARMCoreState) : void;

	raiseIRQ() : void;
	raiseTrap(irqType? : number) : void;
}

export enum ARMMode {
	MODE_ARM = 0,
	MODE_THUMB = 1,
	
	MODE_USER = 0x10,
	MODE_FIQ = 0x11,
	MODE_IRQ = 0x12,
	MODE_SUPERVISOR = 0x13,
	MODE_ABORT = 0x17,
	MODE_UNDEFINED = 0x1B,
	MODE_SYSTEM = 0x1F
}

export enum ARMRegs {
	SP = 13,
	LR = 14,
	PC = 15,
}

export enum ARMConstants {

	BANK_NONE = 0,
	BANK_FIQ = 1,
	BANK_IRQ = 2,
	BANK_SUPERVISOR = 3,
	BANK_ABORT = 4,
	BANK_UNDEFINED = 5,

	WORD_SIZE_ARM = 4,
	WORD_SIZE_THUMB = 2,

	BASE_RESET = 0x00000000,
	BASE_UNDEF = 0x00000004,
	BASE_SWI = 0x00000008,
	BASE_PABT = 0x0000000C,
	BASE_DABT = 0x00000010,
	BASE_IRQ = 0x00000018,
	BASE_FIQ = 0x0000001C,
}

const UNALLOC_MASK = 0x0FFFFF00;
const USER_MASK = 0xF0000000;
const PRIV_MASK = 0x000000DF; // This is out of spec? (SEH)
const STATE_MASK = 0x00000020;


///////////////////////////////////////////////////////////////////////////

function ARMCoreArm(cpu: ARMCoreType) {
	this.cpu = cpu;

	this.addressingMode23Immediate = [
		// 000x0
		function(rn, offset, condOp) {
			var gprs = cpu.gprs;
			var address : AddressFunction = function() {
				var addr = gprs[rn];
				if (!condOp || condOp()) {
					gprs[rn] -= offset;
				}
				return addr;
			};
			address.writesPC = rn == ARMRegs.PC;
			return address;
		},

		// 000xW
		null,

		null,
		null,

		// 00Ux0
		function(rn, offset, condOp) {
			var gprs = cpu.gprs;
			var address : AddressFunction = function() {
				var addr = gprs[rn];
				if (!condOp || condOp()) {
					gprs[rn] += offset;
				}
				return addr;
			};
			address.writesPC = rn == ARMRegs.PC;
			return address;
		},

		// 00UxW
		null,

		null,
		null,

		// 0P0x0
		function(rn, offset, condOp) {
			var gprs = cpu.gprs;
			var address : AddressFunction = function() {
				return /* addr = */ gprs[rn] - offset;
			};
			address.writesPC = false;
			return address;
		},

		// 0P0xW
		function(rn, offset, condOp) {
			var gprs = cpu.gprs;
			var address : AddressFunction = function() {
				var addr = gprs[rn] - offset;
				if (!condOp || condOp()) {
					gprs[rn] = addr;
				}
				return addr;
			};
			address.writesPC = rn == ARMRegs.PC;
			return address;
		},

		null,
		null,

		// 0PUx0
		function(rn, offset, condOp) {
			var gprs = cpu.gprs;
			var address : AddressFunction = function() {
				return /* addr = */ gprs[rn] + offset;
			};
			address.writesPC = false;
			return address;
		},

		// 0PUxW
		function(rn, offset, condOp) {
			var gprs = cpu.gprs;
			var address : AddressFunction = function() {
				var addr = gprs[rn] + offset;
				if (!condOp || condOp()) {
					gprs[rn] = addr;
				}
				return addr;
			};
			address.writesPC = rn == ARMRegs.PC;
			return address;
		},

		null,
		null,
	];

	this.addressingMode23Register = [
		// I00x0
		function(rn, rm, condOp) {
			var gprs = cpu.gprs;
			var address : AddressFunction = function() {
				var addr = gprs[rn];
				if (!condOp || condOp()) {
					gprs[rn] -= gprs[rm];
				}
				return addr;
			};
			address.writesPC = rn == ARMRegs.PC;
			return address;
		},

		// I00xW
		null,

		null,
		null,

		// I0Ux0
		function(rn, rm, condOp) {
			var gprs = cpu.gprs;
			var address : AddressFunction = function() {
				var addr = gprs[rn];
				if (!condOp || condOp()) {
					gprs[rn] += gprs[rm];
				}
				return addr;
			};
			address.writesPC = rn == ARMRegs.PC;
			return address;
		},

		// I0UxW
		null,

		null,
		null,

		// IP0x0
		function(rn, rm, condOp) {
			var gprs = cpu.gprs;
			var address : AddressFunction = function() {
				return gprs[rn] - gprs[rm];
			};
			address.writesPC = false;
			return address;
		},

		// IP0xW
		function(rn, rm, condOp) {
			var gprs = cpu.gprs;
			var address : AddressFunction = function() {
				var addr = gprs[rn] - gprs[rm];
				if (!condOp || condOp()) {
					gprs[rn] = addr;
				}
				return addr;
			};
			address.writesPC = rn == ARMRegs.PC;
			return address;
		},

		null,
		null,

		// IPUx0
		function(rn, rm, condOp) {
			var gprs = cpu.gprs;
			var address : AddressFunction = function() {
				var addr = gprs[rn] + gprs[rm];
				return addr;
			};
			address.writesPC = false;
			return address;
		},

		// IPUxW
		function(rn, rm, condOp) {
			var gprs = cpu.gprs;
			var address : AddressFunction = function() {
				var addr = gprs[rn] + gprs[rm];
				if (!condOp || condOp()) {
					gprs[rn] = addr;
				}
				return addr;
			};
			address.writesPC = rn == ARMRegs.PC;
			return address;
		},

		null,
		null
	];

	this.addressingMode2RegisterShifted = [
		// I00x0
		function(rn, shiftOp, condOp) {
			var gprs = cpu.gprs;
			var address : AddressFunction = function() {
				var addr = gprs[rn];
				if (!condOp || condOp()) {
					shiftOp();
					gprs[rn] -= cpu.shifterOperand;
				}
				return addr;
			};
			address.writesPC = rn == ARMRegs.PC;
			return address;
		},

		// I00xW
		null,

		null,
		null,

		// I0Ux0
		function(rn, shiftOp, condOp) {
			var gprs = cpu.gprs;
			var address : AddressFunction = function() {
				var addr = gprs[rn];
				if (!condOp || condOp()) {
					shiftOp();
					gprs[rn] += cpu.shifterOperand;
				}
				return addr;
			};
			address.writesPC = rn == ARMRegs.PC;
			return address;
		},
		// I0UxW
		null,

		null,
		null,

		// IP0x0
		function(rn, shiftOp, condOp) {
			var gprs = cpu.gprs;
			var address : AddressFunction = function() {
				shiftOp();
				return gprs[rn] - cpu.shifterOperand;
			};
			address.writesPC = false;
			return address;
		},

		// IP0xW
		function(rn, shiftOp, condOp) {
			var gprs = cpu.gprs;
			var address : AddressFunction = function() {
				shiftOp();
				var addr = gprs[rn] - cpu.shifterOperand;
				if (!condOp || condOp()) {
					gprs[rn] = addr;
				}
				return addr;
			};
			address.writesPC = rn == ARMRegs.PC;
			return address;
		},

		null,
		null,

		// IPUx0
		function(rn, shiftOp, condOp) {
			var gprs = cpu.gprs;
			var address : AddressFunction = function() {
				shiftOp();
				return gprs[rn] + cpu.shifterOperand;
			};
			address.writesPC = false;
			return address;
		},

		// IPUxW
		function(rn, shiftOp, condOp) {
			var gprs = cpu.gprs;
			var address : AddressFunction = function() {
				shiftOp();
				var addr = gprs[rn] + cpu.shifterOperand;
				if (!condOp || condOp()) {
					gprs[rn] = addr;
				}
				return addr;
			};
			address.writesPC = rn == ARMRegs.PC;
			return address;
		},

		null,
		null,
	];
}

ARMCoreArm.prototype.constructAddressingMode1ASR = function(rs, rm) {
	var cpu : ARMCoreType = this.cpu;
	var gprs = cpu.gprs;
	return function() {
		++cpu.cycles;
		var shift = gprs[rs];
		if (rs == ARMRegs.PC) {
			shift += 4;
		}
		shift &= 0xFF;
		var shiftVal =  gprs[rm];
		if (rm == ARMRegs.PC) {
			shiftVal += 4;
		}
		if (shift == 0) {
			cpu.shifterOperand = shiftVal;
			cpu.shifterCarryOut = cpu.cpsrC;
		} else if (shift < 32) {
			cpu.shifterOperand = shiftVal >> shift;
			cpu.shifterCarryOut = shiftVal & (1 << (shift - 1));
		} else if (gprs[rm] >> 31) {
			cpu.shifterOperand = 0xFFFFFFFF;
			cpu.shifterCarryOut = 0x80000000;
		} else {
			cpu.shifterOperand = 0;
			cpu.shifterCarryOut = 0;
		}
	};
};

ARMCoreArm.prototype.constructAddressingMode1Immediate = function(immediate) {
	var cpu : ARMCoreType = this.cpu;
	return function() {
		cpu.shifterOperand = immediate;
		cpu.shifterCarryOut = cpu.cpsrC;
	};
};

ARMCoreArm.prototype.constructAddressingMode1ImmediateRotate = function(immediate, rotate) {
	var cpu : ARMCoreType = this.cpu;
	return function() {
		cpu.shifterOperand = (immediate >>> rotate) | (immediate << (32 - rotate));
		cpu.shifterCarryOut = cpu.shifterOperand >> 31;
	}
};

ARMCoreArm.prototype.constructAddressingMode1LSL = function(rs, rm) {
	var cpu : ARMCoreType = this.cpu;
	var gprs = cpu.gprs;
	return function() {
		++cpu.cycles;
		var shift = gprs[rs];
		if (rs == ARMRegs.PC) {
			shift += 4;
		}
		shift &= 0xFF;
		var shiftVal =  gprs[rm];
		if (rm == ARMRegs.PC) {
			shiftVal += 4;
		}
		if (shift == 0) {
			cpu.shifterOperand = shiftVal;
			cpu.shifterCarryOut = cpu.cpsrC;
		} else if (shift < 32) {
			cpu.shifterOperand = shiftVal << shift;
			cpu.shifterCarryOut = shiftVal & (1 << (32 - shift));
		} else if (shift == 32) {
			cpu.shifterOperand = 0;
			cpu.shifterCarryOut = shiftVal & 1;
		} else {
			cpu.shifterOperand = 0;
			cpu.shifterCarryOut = 0;
		}
	};
};

ARMCoreArm.prototype.constructAddressingMode1LSR = function(rs, rm) {
	var cpu : ARMCoreType = this.cpu;
	var gprs = cpu.gprs;
	return function() {
		++cpu.cycles;
		var shift = gprs[rs];
		if (rs == ARMRegs.PC) {
			shift += 4;
		}
		shift &= 0xFF;
		var shiftVal =  gprs[rm];
		if (rm == ARMRegs.PC) {
			shiftVal += 4;
		}
		if (shift == 0) {
			cpu.shifterOperand = shiftVal;
			cpu.shifterCarryOut = cpu.cpsrC;
		} else if (shift < 32) {
			cpu.shifterOperand = shiftVal >>> shift;
			cpu.shifterCarryOut = shiftVal & (1 << (shift - 1));
		} else if (shift == 32) {
			cpu.shifterOperand = 0;
			cpu.shifterCarryOut = shiftVal >> 31;
		} else {
			cpu.shifterOperand = 0;
			cpu.shifterCarryOut = 0;
		}
	};
};

ARMCoreArm.prototype.constructAddressingMode1ROR = function(rs, rm) {
	var cpu : ARMCoreType = this.cpu;
	var gprs = cpu.gprs;
	return function() {
		++cpu.cycles;
		var shift = gprs[rs];
		if (rs == ARMRegs.PC) {
			shift += 4;
		}
		shift &= 0xFF;
		var shiftVal =  gprs[rm];
		if (rm == ARMRegs.PC) {
			shiftVal += 4;
		}
		var rotate = shift & 0x1F;
		if (shift == 0) {
			cpu.shifterOperand = shiftVal;
			cpu.shifterCarryOut = cpu.cpsrC;
		} else if (rotate) {
			cpu.shifterOperand = (gprs[rm] >>> rotate) | (gprs[rm] << (32 - rotate));
			cpu.shifterCarryOut = shiftVal & (1 << (rotate - 1));
		} else {
			cpu.shifterOperand = shiftVal;
			cpu.shifterCarryOut = shiftVal >> 31;
		}
	};
};

ARMCoreArm.prototype.constructAddressingMode23Immediate = function(instruction, immediate, condOp) {
	var rn = (instruction & 0x000F0000) >> 16;
	return this.addressingMode23Immediate[(instruction & 0x01A00000) >> 21](rn, immediate, condOp);
};

ARMCoreArm.prototype.constructAddressingMode23Register = function(instruction, rm, condOp) {
	var rn = (instruction & 0x000F0000) >> 16;
	return this.addressingMode23Register[(instruction & 0x01A00000) >> 21](rn, rm, condOp);
};

ARMCoreArm.prototype.constructAddressingMode2RegisterShifted = function(instruction, shiftOp, condOp) {
	var rn = (instruction & 0x000F0000) >> 16;
	return this.addressingMode2RegisterShifted[(instruction & 0x01A00000) >> 21](rn, shiftOp, condOp);
};

ARMCoreArm.prototype.constructAddressingMode4 = function(immediate, rn) {
	var cpu : ARMCoreType = this.cpu;
	var gprs = cpu.gprs;
	return function() {
		var addr = gprs[rn] + immediate;
		return addr;
	}
};

ARMCoreArm.prototype.constructAddressingMode4Writeback = function(immediate, offset, rn, overlap) {
	var cpu : ARMCoreType = this.cpu;
	var gprs = cpu.gprs;
	return function(writeInitial) {
		var addr = gprs[rn] + immediate;
		if (writeInitial && overlap) {
			cpu.mmu.store32(gprs[rn] + immediate - 4, gprs[rn]);
		}
		gprs[rn] += offset;
		return addr;
	}
};

ARMCoreArm.prototype.constructADC = function(rd, rn, shiftOp, condOp) {
	var cpu : ARMCoreType = this.cpu;
	var gprs = cpu.gprs;
	return function() {
		cpu.mmu.waitPrefetch32(gprs[ARMRegs.PC]);
		if (condOp && !condOp()) {
			return;
		}
		shiftOp();
		var shifterOperand = (cpu.shifterOperand >>> 0) + (cpu.cpsrC ? 1 : 0);
		gprs[rd] = (gprs[rn] >>> 0) + shifterOperand;
	};
};

ARMCoreArm.prototype.constructADCS = function(rd, rn, shiftOp, condOp) {
	var cpu : ARMCoreType = this.cpu;
	var gprs = cpu.gprs;
	return function() {
		cpu.mmu.waitPrefetch32(gprs[ARMRegs.PC]);
		if (condOp && !condOp()) {
			return;
		}
		shiftOp();
		var shifterOperand = (cpu.shifterOperand >>> 0) + (cpu.cpsrC ? 1 : 0);
		var d = (gprs[rn] >>> 0) + shifterOperand;
		if (rd == ARMRegs.PC && cpu.hasSPSR()) {
			cpu.unpackCPSR(cpu.spsr);
		} else {
			cpu.cpsrN = d >> 31;
			cpu.cpsrZ = !(d & 0xFFFFFFFF);
			cpu.cpsrC = d > 0xFFFFFFFF;
			cpu.cpsrV = (gprs[rn] >> 31) == (shifterOperand >> 31) &&
						(gprs[rn] >> 31) != (d >> 31) &&
						(shifterOperand >> 31) != (d >> 31);
		}
		gprs[rd] = d;
	};
};

ARMCoreArm.prototype.constructADD = function(rd, rn, shiftOp, condOp) {
	var cpu : ARMCoreType = this.cpu;
	var gprs = cpu.gprs;
	return function() {
		cpu.mmu.waitPrefetch32(gprs[ARMRegs.PC]);
		if (condOp && !condOp()) {
			return;
		}
		shiftOp();
		gprs[rd] = (gprs[rn] >>> 0) + (cpu.shifterOperand >>> 0);
	};
};

ARMCoreArm.prototype.constructADDS = function(rd, rn, shiftOp, condOp) {
	var cpu : ARMCoreType = this.cpu;
	var gprs = cpu.gprs;
	return function() {
		cpu.mmu.waitPrefetch32(gprs[ARMRegs.PC]);
		if (condOp && !condOp()) {
			return;
		}
		shiftOp();
		var d = (gprs[rn] >>> 0) + (cpu.shifterOperand >>> 0);
		if (rd == ARMRegs.PC && cpu.hasSPSR()) {
			cpu.unpackCPSR(cpu.spsr);
		} else {
			cpu.cpsrN = d >> 31;
			cpu.cpsrZ = !(d & 0xFFFFFFFF);
			cpu.cpsrC = d > 0xFFFFFFFF;
			cpu.cpsrV = (gprs[rn] >> 31) == (cpu.shifterOperand >> 31) &&
						(gprs[rn] >> 31) != (d >> 31) &&
						(cpu.shifterOperand >> 31) != (d >> 31);
		}
		gprs[rd] = d;
	};
};

ARMCoreArm.prototype.constructAND = function(rd, rn, shiftOp, condOp) {
	var cpu : ARMCoreType = this.cpu;
	var gprs = cpu.gprs;
	return function() {
		cpu.mmu.waitPrefetch32(gprs[ARMRegs.PC]);
		if (condOp && !condOp()) {
			return;
		}
		shiftOp();
		gprs[rd] = gprs[rn] & cpu.shifterOperand;
	};
};

ARMCoreArm.prototype.constructANDS = function(rd, rn, shiftOp, condOp) {
	var cpu : ARMCoreType = this.cpu;
	var gprs = cpu.gprs;
	return function() {
		cpu.mmu.waitPrefetch32(gprs[ARMRegs.PC]);
		if (condOp && !condOp()) {
			return;
		}
		shiftOp();
		gprs[rd] = gprs[rn] & cpu.shifterOperand;
		if (rd == ARMRegs.PC && cpu.hasSPSR()) {
			cpu.unpackCPSR(cpu.spsr);
		} else {
			cpu.cpsrN = gprs[rd] >> 31;
			cpu.cpsrZ = !(gprs[rd] & 0xFFFFFFFF);
			cpu.cpsrC = cpu.shifterCarryOut;
		}
	};
};

ARMCoreArm.prototype.constructB = function(immediate, condOp) {
	var cpu : ARMCoreType = this.cpu;
	var gprs = cpu.gprs;
	return function() {
		if (condOp && !condOp()) {
			cpu.mmu.waitPrefetch32(gprs[ARMRegs.PC]);
			return;
		}
		cpu.mmu.waitPrefetch32(gprs[ARMRegs.PC]);
		gprs[ARMRegs.PC] += immediate;
	};
};

ARMCoreArm.prototype.constructBIC = function(rd, rn, shiftOp, condOp) {
	var cpu : ARMCoreType = this.cpu;
	var gprs = cpu.gprs;
	return function() {
		cpu.mmu.waitPrefetch32(gprs[ARMRegs.PC]);
		if (condOp && !condOp()) {
			return;
		}
		shiftOp();
		gprs[rd] = gprs[rn] & ~cpu.shifterOperand;
	};
};

ARMCoreArm.prototype.constructBICS = function(rd, rn, shiftOp, condOp) {
	var cpu : ARMCoreType = this.cpu;
	var gprs = cpu.gprs;
	return function() {
		cpu.mmu.waitPrefetch32(gprs[ARMRegs.PC]);
		if (condOp && !condOp()) {
			return;
		}
		shiftOp();
		gprs[rd] = gprs[rn] & ~cpu.shifterOperand;
		if (rd == ARMRegs.PC && cpu.hasSPSR()) {
			cpu.unpackCPSR(cpu.spsr);
		} else {
			cpu.cpsrN = gprs[rd] >> 31;
			cpu.cpsrZ = !(gprs[rd] & 0xFFFFFFFF);
			cpu.cpsrC = cpu.shifterCarryOut;
		}
	};
};

ARMCoreArm.prototype.constructBL = function(immediate, condOp) {
	var cpu : ARMCoreType = this.cpu;
	var gprs = cpu.gprs;
	return function() {
		if (condOp && !condOp()) {
			cpu.mmu.waitPrefetch32(gprs[ARMRegs.PC]);
			return;
		}
		cpu.mmu.waitPrefetch32(gprs[ARMRegs.PC]);
		gprs[ARMRegs.LR] = gprs[ARMRegs.PC] - 4;
		gprs[ARMRegs.PC] += immediate;
	};
};

ARMCoreArm.prototype.constructBX = function(rm, condOp) {
	var cpu : ARMCoreType = this.cpu;
	var gprs = cpu.gprs;
	return function() {
		if (condOp && !condOp()) {
			cpu.mmu.waitPrefetch32(gprs[ARMRegs.PC]);
			return;
		}
		cpu.mmu.waitPrefetch32(gprs[ARMRegs.PC]);
		cpu.switchExecMode(gprs[rm] & 0x00000001);
		gprs[ARMRegs.PC] = gprs[rm] & 0xFFFFFFFE;
	};
};

ARMCoreArm.prototype.constructCMN = function(rd, rn, shiftOp, condOp) {
	var cpu : ARMCoreType = this.cpu;
	var gprs = cpu.gprs;
	return function() {
		cpu.mmu.waitPrefetch32(gprs[ARMRegs.PC]);
		if (condOp && !condOp()) {
			return;
		}
		shiftOp();
		var aluOut = (gprs[rn] >>> 0) + (cpu.shifterOperand >>> 0);
		cpu.cpsrN = aluOut >> 31;
		cpu.cpsrZ = !(aluOut & 0xFFFFFFFF);
		cpu.cpsrC = aluOut > 0xFFFFFFFF;
		cpu.cpsrV = (gprs[rn] >> 31) == (cpu.shifterOperand >> 31) &&
					(gprs[rn] >> 31) != (aluOut >> 31) &&
					(cpu.shifterOperand >> 31) != (aluOut >> 31);
	};
};

ARMCoreArm.prototype.constructCMP = function(rd, rn, shiftOp, condOp) {
	var cpu : ARMCoreType = this.cpu;
	var gprs = cpu.gprs;
	return function() {
		cpu.mmu.waitPrefetch32(gprs[ARMRegs.PC]);
		if (condOp && !condOp()) {
			return;
		}
		shiftOp();
		var aluOut = gprs[rn] - cpu.shifterOperand;
		cpu.cpsrN = aluOut >> 31;
		cpu.cpsrZ = !(aluOut & 0xFFFFFFFF);
		cpu.cpsrC = (gprs[rn] >>> 0) >= (cpu.shifterOperand >>> 0);
		cpu.cpsrV = (gprs[rn] >> 31) != (cpu.shifterOperand >> 31) &&
					(gprs[rn] >> 31) != (aluOut >> 31);
	};
};

ARMCoreArm.prototype.constructEOR = function(rd, rn, shiftOp, condOp) {
	var cpu : ARMCoreType = this.cpu;
	var gprs = cpu.gprs;
	return function() {
		cpu.mmu.waitPrefetch32(gprs[ARMRegs.PC]);
		if (condOp && !condOp()) {
			return;
		}
		shiftOp();
		gprs[rd] = gprs[rn] ^ cpu.shifterOperand;
	};
};

ARMCoreArm.prototype.constructEORS = function(rd, rn, shiftOp, condOp) {
	var cpu : ARMCoreType = this.cpu;
	var gprs = cpu.gprs;
	return function() {
		cpu.mmu.waitPrefetch32(gprs[ARMRegs.PC]);
		if (condOp && !condOp()) {
			return;
		}
		shiftOp();
		gprs[rd] = gprs[rn] ^ cpu.shifterOperand;
		if (rd == ARMRegs.PC && cpu.hasSPSR()) {
			cpu.unpackCPSR(cpu.spsr);
		} else {
			cpu.cpsrN = gprs[rd] >> 31;
			cpu.cpsrZ = !(gprs[rd] & 0xFFFFFFFF);
			cpu.cpsrC = cpu.shifterCarryOut;
		}
	};
};

ARMCoreArm.prototype.constructLDM = function(rs, address, condOp) {
	var cpu : ARMCoreType = this.cpu;
	var gprs = cpu.gprs;
	var mmu = cpu.mmu;
	return function() {
		mmu.waitPrefetch32(gprs[ARMRegs.PC]);
		if (condOp && !condOp()) {
			return;
		}
		var addr = address(false);
		var total = 0;
		var m, i;
		for (m = rs, i = 0; m; m >>= 1, ++i) {
			if (m & 1) {
				gprs[i] = mmu.load32(addr & 0xFFFFFFFC);
				addr += 4;
				++total;
			}
		}
		mmu.waitMulti32(addr, total);
		++cpu.cycles;
	};
};

ARMCoreArm.prototype.constructLDMS = function(rs, address, condOp) {
	var cpu : ARMCoreType = this.cpu;
	var gprs = cpu.gprs;
	var mmu = cpu.mmu;
	return function() {
		mmu.waitPrefetch32(gprs[ARMRegs.PC]);
		if (condOp && !condOp()) {
			return;
		}
		var addr = address(false);
		var total = 0;
		var mode = cpu.mode;
		cpu.switchMode(ARMMode.MODE_SYSTEM);
		var m, i;
		for (m = rs, i = 0; m; m >>= 1, ++i) {
			if (m & 1) {
				gprs[i] = mmu.load32(addr & 0xFFFFFFFC);
				addr += 4;
				++total;
			}
		}
		cpu.switchMode(mode);
		mmu.waitMulti32(addr, total);
		++cpu.cycles;
	};
};

ARMCoreArm.prototype.constructLDR = function(rd, address, condOp) {
	var cpu : ARMCoreType = this.cpu;
	var gprs = cpu.gprs;
	return function() {
		cpu.mmu.waitPrefetch32(gprs[ARMRegs.PC]);
		if (condOp && !condOp()) {
			return;
		}
		var addr = address();
		gprs[rd] = cpu.mmu.load32(addr);
		cpu.mmu.wait32(addr);
		++cpu.cycles;
	};
};

ARMCoreArm.prototype.constructLDRB = function(rd, address, condOp) {
	var cpu : ARMCoreType = this.cpu;
	var gprs = cpu.gprs;
	return function() {
		cpu.mmu.waitPrefetch32(gprs[ARMRegs.PC]);
		if (condOp && !condOp()) {
			return;
		}
		var addr = address();
		gprs[rd] = cpu.mmu.loadU8(addr);
		cpu.mmu.wait(addr);
		++cpu.cycles;
	};
};

ARMCoreArm.prototype.constructLDRH = function(rd, address, condOp) {
	var cpu : ARMCoreType = this.cpu;
	var gprs = cpu.gprs;
	return function() {
		cpu.mmu.waitPrefetch32(gprs[ARMRegs.PC]);
		if (condOp && !condOp()) {
			return;
		}
		var addr = address();
		gprs[rd] = cpu.mmu.loadU16(addr);
		cpu.mmu.wait(addr);
		++cpu.cycles;
	};
};

ARMCoreArm.prototype.constructLDRSB = function(rd, address, condOp) {
	var cpu : ARMCoreType = this.cpu;
	var gprs = cpu.gprs;
	return function() {
		cpu.mmu.waitPrefetch32(gprs[ARMRegs.PC]);
		if (condOp && !condOp()) {
			return;
		}
		var addr = address();
		gprs[rd] = cpu.mmu.load8(addr);
		cpu.mmu.wait(addr);
		++cpu.cycles;
	};
};

ARMCoreArm.prototype.constructLDRSH = function(rd, address, condOp) {
	var cpu : ARMCoreType = this.cpu;
	var gprs = cpu.gprs;
	return function() {
		cpu.mmu.waitPrefetch32(gprs[ARMRegs.PC]);
		if (condOp && !condOp()) {
			return;
		}
		var addr = address();
		gprs[rd] = cpu.mmu.load16(addr);
		cpu.mmu.wait(addr);
		++cpu.cycles;
	};
};

ARMCoreArm.prototype.constructMLA = function(rd, rn, rs, rm, condOp) {
	var cpu : ARMCoreType = this.cpu;
	var gprs = cpu.gprs;
	return function() {
		cpu.mmu.waitPrefetch32(gprs[ARMRegs.PC]);
		if (condOp && !condOp()) {
			return;
		}
		++cpu.cycles;
		cpu.mmu.waitMul(rs);
		if ((gprs[rm] & 0xFFFF0000) && (gprs[rs] & 0xFFFF0000)) {
			// Our data type is a double--we'll lose bits if we do it all at once!
			var hi = ((gprs[rm] & 0xFFFF0000) * gprs[rs]) & 0xFFFFFFFF;
			var lo = ((gprs[rm] & 0x0000FFFF) * gprs[rs]) & 0xFFFFFFFF;
			gprs[rd] = (hi + lo + gprs[rn]) & 0xFFFFFFFF;
		} else {
			gprs[rd] = gprs[rm] * gprs[rs] + gprs[rn];
		}
	};
};

ARMCoreArm.prototype.constructMLAS = function(rd, rn, rs, rm, condOp) {
	var cpu : ARMCoreType = this.cpu;
	var gprs = cpu.gprs;
	return function() {
		cpu.mmu.waitPrefetch32(gprs[ARMRegs.PC]);
		if (condOp && !condOp()) {
			return;
		}
		++cpu.cycles;
		cpu.mmu.waitMul(rs);
		if ((gprs[rm] & 0xFFFF0000) && (gprs[rs] & 0xFFFF0000)) {
			// Our data type is a double--we'll lose bits if we do it all at once!
			var hi = ((gprs[rm] & 0xFFFF0000) * gprs[rs]) & 0xFFFFFFFF;
			var lo = ((gprs[rm] & 0x0000FFFF) * gprs[rs]) & 0xFFFFFFFF;
			gprs[rd] = (hi + lo + gprs[rn]) & 0xFFFFFFFF;
		} else {
			gprs[rd] = gprs[rm] * gprs[rs] + gprs[rn];
		}
		cpu.cpsrN = gprs[rd] >> 31;
		cpu.cpsrZ = !(gprs[rd] & 0xFFFFFFFF);
	};
};

ARMCoreArm.prototype.constructMOV = function(rd, rn, shiftOp, condOp) {
	var cpu : ARMCoreType = this.cpu;
	var gprs = cpu.gprs;
	return function() {
		cpu.mmu.waitPrefetch32(gprs[ARMRegs.PC]);
		if (condOp && !condOp()) {
			return;
		}
		shiftOp();
		gprs[rd] = cpu.shifterOperand;
	};
};

ARMCoreArm.prototype.constructMOVS = function(rd, rn, shiftOp, condOp) {
	var cpu : ARMCoreType = this.cpu;
	var gprs = cpu.gprs;
	return function() {
		cpu.mmu.waitPrefetch32(gprs[ARMRegs.PC]);
		if (condOp && !condOp()) {
			return;
		}
		shiftOp();
		gprs[rd] = cpu.shifterOperand;
		if (rd == ARMRegs.PC && cpu.hasSPSR()) {
			cpu.unpackCPSR(cpu.spsr);
		} else {
			cpu.cpsrN = gprs[rd] >> 31;
			cpu.cpsrZ = !(gprs[rd] & 0xFFFFFFFF);
			cpu.cpsrC = cpu.shifterCarryOut;
		}
	};
};

ARMCoreArm.prototype.constructMRS = function(rd, r, condOp) {
	var cpu : ARMCoreType = this.cpu;
	var gprs = cpu.gprs;
	return function() {
		cpu.mmu.waitPrefetch32(gprs[ARMRegs.PC]);
		if (condOp && !condOp()) {
			return;
		}
		if (r) {
			gprs[rd] = cpu.spsr;
		} else {
			gprs[rd] = cpu.packCPSR();
		}
	};
};

ARMCoreArm.prototype.constructMSR = function(rm, r, instruction, immediate, condOp) {
	var cpu : ARMCoreType = this.cpu;
	var gprs = cpu.gprs;
	var c = instruction & 0x00010000;
	//var x = instruction & 0x00020000;
	//var s = instruction & 0x00040000;
	var f = instruction & 0x00080000;
	return function() {
		cpu.mmu.waitPrefetch32(gprs[ARMRegs.PC]);
		if (condOp && !condOp()) {
			return;
		}
		var operand;
		if (instruction & 0x02000000) {
			operand = immediate;
		} else {
			operand = gprs[rm];
		}
		var mask = (c ? 0x000000FF : 0x00000000) |
				   //(x ? 0x0000FF00 : 0x00000000) | // Irrelevant on ARMv4T
				   //(s ? 0x00FF0000 : 0x00000000) | // Irrelevant on ARMv4T
				   (f ? 0xFF000000 : 0x00000000);
		if (r) {
			mask &= USER_MASK | PRIV_MASK | STATE_MASK;
			//console.log(hex(r), hex(mask & 0x7fffffff), hex(cpu.spsr), hex(operand));
			cpu.spsr = (cpu.spsr & ~mask) | (operand & mask);
		} else {
			if (mask & USER_MASK) {
				cpu.cpsrN = operand >> 31;
				cpu.cpsrZ = operand & 0x40000000;
				cpu.cpsrC = operand & 0x20000000;
				cpu.cpsrV = operand & 0x10000000;
			}
			if (cpu.mode != ARMMode.MODE_USER && (mask & PRIV_MASK)) {
				cpu.switchMode((operand & 0x0000000F) | 0x00000010);
				cpu.cpsrI = operand & 0x00000080;
				cpu.cpsrF = operand & 0x00000040;
			}
		}
	};
};

ARMCoreArm.prototype.constructMUL = function(rd, rs, rm, condOp) {
	var cpu : ARMCoreType = this.cpu;
	var gprs = cpu.gprs;
	return function() {
		cpu.mmu.waitPrefetch32(gprs[ARMRegs.PC]);
		if (condOp && !condOp()) {
			return;
		}
		cpu.mmu.waitMul(gprs[rs]);
		if ((gprs[rm] & 0xFFFF0000) && (gprs[rs] & 0xFFFF0000)) {
			// Our data type is a double--we'll lose bits if we do it all at once!
			var hi = ((gprs[rm] & 0xFFFF0000) * gprs[rs]) | 0;
			var lo = ((gprs[rm] & 0x0000FFFF) * gprs[rs]) | 0;
			gprs[rd] = hi + lo;
		} else {
			gprs[rd] = gprs[rm] * gprs[rs];
		}
	};
};

ARMCoreArm.prototype.constructMULS = function(rd, rs, rm, condOp) {
	var cpu : ARMCoreType = this.cpu;
	var gprs = cpu.gprs;
	return function() {
		cpu.mmu.waitPrefetch32(gprs[ARMRegs.PC]);
		if (condOp && !condOp()) {
			return;
		}
		cpu.mmu.waitMul(gprs[rs]);
		if ((gprs[rm] & 0xFFFF0000) && (gprs[rs] & 0xFFFF0000)) {
			// Our data type is a double--we'll lose bits if we do it all at once!
			var hi = ((gprs[rm] & 0xFFFF0000) * gprs[rs]) | 0;
			var lo = ((gprs[rm] & 0x0000FFFF) * gprs[rs]) | 0;
			gprs[rd] = hi + lo;
		} else {
			gprs[rd] = gprs[rm] * gprs[rs];
		}
		cpu.cpsrN = gprs[rd] >> 31;
		cpu.cpsrZ = !(gprs[rd] & 0xFFFFFFFF);
	};
};

ARMCoreArm.prototype.constructMVN = function(rd, rn, shiftOp, condOp) {
	var cpu : ARMCoreType = this.cpu;
	var gprs = cpu.gprs;
	return function() {
		cpu.mmu.waitPrefetch32(gprs[ARMRegs.PC]);
		if (condOp && !condOp()) {
			return;
		}
		shiftOp();
		gprs[rd] = ~cpu.shifterOperand;
	};
};

ARMCoreArm.prototype.constructMVNS = function(rd, rn, shiftOp, condOp) {
	var cpu : ARMCoreType = this.cpu;
	var gprs = cpu.gprs;
	return function() {
		cpu.mmu.waitPrefetch32(gprs[ARMRegs.PC]);
		if (condOp && !condOp()) {
			return;
		}
		shiftOp();
		gprs[rd] = ~cpu.shifterOperand;
		if (rd == ARMRegs.PC && cpu.hasSPSR()) {
			cpu.unpackCPSR(cpu.spsr);
		} else {
			cpu.cpsrN = gprs[rd] >> 31;
			cpu.cpsrZ = !(gprs[rd] & 0xFFFFFFFF);
			cpu.cpsrC = cpu.shifterCarryOut;
		}
	};
};

ARMCoreArm.prototype.constructORR = function(rd, rn, shiftOp, condOp) {
	var cpu : ARMCoreType = this.cpu;
	var gprs = cpu.gprs;
	return function() {
		cpu.mmu.waitPrefetch32(gprs[ARMRegs.PC]);
		if (condOp && !condOp()) {
			return;
		}
		shiftOp();
		gprs[rd] = gprs[rn] | cpu.shifterOperand;
	}
};

ARMCoreArm.prototype.constructORRS = function(rd, rn, shiftOp, condOp) {
	var cpu : ARMCoreType = this.cpu;
	var gprs = cpu.gprs;
	return function() {
		cpu.mmu.waitPrefetch32(gprs[ARMRegs.PC]);
		if (condOp && !condOp()) {
			return;
		}
		shiftOp();
		gprs[rd] = gprs[rn] | cpu.shifterOperand;
		if (rd == ARMRegs.PC && cpu.hasSPSR()) {
			cpu.unpackCPSR(cpu.spsr);
		} else {
			cpu.cpsrN = gprs[rd] >> 31;
			cpu.cpsrZ = !(gprs[rd] & 0xFFFFFFFF);
			cpu.cpsrC = cpu.shifterCarryOut;
		}
	};
};

ARMCoreArm.prototype.constructRSB = function(rd, rn, shiftOp, condOp) {
	var cpu : ARMCoreType = this.cpu;
	var gprs = cpu.gprs;
	return function() {
		cpu.mmu.waitPrefetch32(gprs[ARMRegs.PC]);
		if (condOp && !condOp()) {
			return;
		}
		shiftOp();
		gprs[rd] = cpu.shifterOperand - gprs[rn];
	};
};

ARMCoreArm.prototype.constructRSBS = function(rd, rn, shiftOp, condOp) {
	var cpu : ARMCoreType = this.cpu;
	var gprs = cpu.gprs;
	return function() {
		cpu.mmu.waitPrefetch32(gprs[ARMRegs.PC]);
		if (condOp && !condOp()) {
			return;
		}
		shiftOp();
		var d = cpu.shifterOperand - gprs[rn];
		if (rd == ARMRegs.PC && cpu.hasSPSR()) {
			cpu.unpackCPSR(cpu.spsr);
		} else {
			cpu.cpsrN = d >> 31;
			cpu.cpsrZ = !(d & 0xFFFFFFFF);
			cpu.cpsrC = (cpu.shifterOperand >>> 0) >= (gprs[rn] >>> 0);
			cpu.cpsrV = (cpu.shifterOperand >> 31) != (gprs[rn] >> 31) &&
						(cpu.shifterOperand >> 31) != (d >> 31);
		}
		gprs[rd] = d;
	};
};

ARMCoreArm.prototype.constructRSC = function(rd, rn, shiftOp, condOp) {
	var cpu : ARMCoreType = this.cpu;
	var gprs = cpu.gprs;
	return function() {
		cpu.mmu.waitPrefetch32(gprs[ARMRegs.PC]);
		if (condOp && !condOp()) {
			return;
		}
		shiftOp();
		var n = (gprs[rn] >>> 0) + (cpu.cpsrC ? 0 : 1);
		gprs[rd] = (cpu.shifterOperand >>> 0) - n;
	};
};

ARMCoreArm.prototype.constructRSCS = function(rd, rn, shiftOp, condOp) {
	var cpu : ARMCoreType = this.cpu;
	var gprs = cpu.gprs;
	return function() {
		cpu.mmu.waitPrefetch32(gprs[ARMRegs.PC]);
		if (condOp && !condOp()) {
			return;
		}
		shiftOp();
		var n = (gprs[rn] >>> 0) + (cpu.cpsrC ? 0 : 1);
		var d = (cpu.shifterOperand >>> 0) - n;
		if (rd == ARMRegs.PC && cpu.hasSPSR()) {
			cpu.unpackCPSR(cpu.spsr);
		} else {
			cpu.cpsrN = d >> 31;
			cpu.cpsrZ = !(d & 0xFFFFFFFF);
			cpu.cpsrC = (cpu.shifterOperand >>> 0) >= (d >>> 0);
			cpu.cpsrV = (cpu.shifterOperand >> 31) != (n >> 31) &&
						(cpu.shifterOperand >> 31) != (d >> 31);
		}
		gprs[rd] = d;
	};
};

ARMCoreArm.prototype.constructSBC = function(rd, rn, shiftOp, condOp) {
	var cpu : ARMCoreType = this.cpu;
	var gprs = cpu.gprs;
	return function() {
		cpu.mmu.waitPrefetch32(gprs[ARMRegs.PC]);
		if (condOp && !condOp()) {
			return;
		}
		shiftOp();
		var shifterOperand = (cpu.shifterOperand >>> 0) + (cpu.cpsrC ? 0 : 1);
		gprs[rd] = (gprs[rn] >>> 0) - shifterOperand;
	};
};

ARMCoreArm.prototype.constructSBCS = function(rd, rn, shiftOp, condOp) {
	var cpu : ARMCoreType = this.cpu;
	var gprs = cpu.gprs;
	return function() {
		cpu.mmu.waitPrefetch32(gprs[ARMRegs.PC]);
		if (condOp && !condOp()) {
			return;
		}
		shiftOp();
		var shifterOperand = (cpu.shifterOperand >>> 0) + (cpu.cpsrC ? 0 : 1);
		var d = (gprs[rn] >>> 0) - shifterOperand;
		if (rd == ARMRegs.PC && cpu.hasSPSR()) {
			cpu.unpackCPSR(cpu.spsr);
		} else {
			cpu.cpsrN = d >> 31;
			cpu.cpsrZ = !(d & 0xFFFFFFFF);
			cpu.cpsrC = (gprs[rn] >>> 0) >= (d >>> 0);
			cpu.cpsrV = (gprs[rn] >> 31) != (shifterOperand >> 31) &&
						(gprs[rn] >> 31) != (d >> 31);
		}
		gprs[rd] = d;
	};
};

ARMCoreArm.prototype.constructSMLAL = function(rd, rn, rs, rm, condOp) {
	var cpu : ARMCoreType = this.cpu;
	var SHIFT_32 = 1/0x100000000;
	var gprs = cpu.gprs;
	return function() {
		cpu.mmu.waitPrefetch32(gprs[ARMRegs.PC]);
		if (condOp && !condOp()) {
			return;
		}
		cpu.cycles += 2;
		cpu.mmu.waitMul(rs);
		var hi = (gprs[rm] & 0xFFFF0000) * gprs[rs];
		var lo = (gprs[rm] & 0x0000FFFF) * gprs[rs];
		var carry = (gprs[rn] >>> 0) + hi + lo;
		gprs[rn] = carry;
		gprs[rd] += Math.floor(carry * SHIFT_32);
	};
};

ARMCoreArm.prototype.constructSMLALS = function(rd, rn, rs, rm, condOp) {
	var cpu : ARMCoreType = this.cpu;
	var SHIFT_32 = 1/0x100000000;
	var gprs = cpu.gprs;
	return function() {
		cpu.mmu.waitPrefetch32(gprs[ARMRegs.PC]);
		if (condOp && !condOp()) {
			return;
		}
		cpu.cycles += 2;
		cpu.mmu.waitMul(rs);
		var hi = (gprs[rm] & 0xFFFF0000) * gprs[rs];
		var lo = (gprs[rm] & 0x0000FFFF) * gprs[rs];
		var carry = (gprs[rn] >>> 0) + hi + lo;
		gprs[rn] = carry;
		gprs[rd] += Math.floor(carry * SHIFT_32);
		cpu.cpsrN = gprs[rd] >> 31;
		cpu.cpsrZ = !((gprs[rd] & 0xFFFFFFFF) || (gprs[rn] & 0xFFFFFFFF));
	};
};

ARMCoreArm.prototype.constructSMULL = function(rd, rn, rs, rm, condOp) {
	var cpu : ARMCoreType = this.cpu;
	var SHIFT_32 = 1/0x100000000;
	var gprs = cpu.gprs;
	return function() {
		cpu.mmu.waitPrefetch32(gprs[ARMRegs.PC]);
		if (condOp && !condOp()) {
			return;
		}
		++cpu.cycles;
		cpu.mmu.waitMul(gprs[rs]);
		var hi = ((gprs[rm] & 0xFFFF0000) >> 0) * (gprs[rs] >> 0);
		var lo = ((gprs[rm] & 0x0000FFFF) >> 0) * (gprs[rs] >> 0);
		gprs[rn] = ((hi & 0xFFFFFFFF) + (lo & 0xFFFFFFFF)) & 0xFFFFFFFF;
		gprs[rd] = Math.floor(hi * SHIFT_32 + lo * SHIFT_32);
	};
};

ARMCoreArm.prototype.constructSMULLS = function(rd, rn, rs, rm, condOp) {
	var cpu : ARMCoreType = this.cpu;
	var SHIFT_32 = 1/0x100000000;
	var gprs = cpu.gprs;
	return function() {
		cpu.mmu.waitPrefetch32(gprs[ARMRegs.PC]);
		if (condOp && !condOp()) {
			return;
		}
		++cpu.cycles;
		cpu.mmu.waitMul(gprs[rs]);
		var hi = ((gprs[rm] & 0xFFFF0000) >> 0) * (gprs[rs] >> 0);
		var lo = ((gprs[rm] & 0x0000FFFF) >> 0) * (gprs[rs] >> 0);
		gprs[rn] = ((hi & 0xFFFFFFFF) + (lo & 0xFFFFFFFF)) & 0xFFFFFFFF;
		gprs[rd] = Math.floor(hi * SHIFT_32 + lo * SHIFT_32);
		cpu.cpsrN = gprs[rd] >> 31;
		cpu.cpsrZ = !((gprs[rd] & 0xFFFFFFFF) || (gprs[rn] & 0xFFFFFFFF));
	};
};

ARMCoreArm.prototype.constructSTM = function(rs, address, condOp) {
	var cpu : ARMCoreType = this.cpu;
	var gprs = cpu.gprs;
	var mmu = cpu.mmu;
	return function() {
		if (condOp && !condOp()) {
			mmu.waitPrefetch32(gprs[ARMRegs.PC]);
			return;
		}
		mmu.wait32(gprs[ARMRegs.PC]);
		var addr = address(true);
		var total = 0;
		var m, i;
		for (m = rs, i = 0; m; m >>= 1, ++i) {
			if (m & 1) {
				mmu.store32(addr, gprs[i]);
				addr += 4;
				++total;
			}
		}
		mmu.waitMulti32(addr, total);
	};
};

ARMCoreArm.prototype.constructSTMS = function(rs, address, condOp) {
	var cpu : ARMCoreType = this.cpu;
	var gprs = cpu.gprs;
	var mmu = cpu.mmu;
	return function() {
		if (condOp && !condOp()) {
			mmu.waitPrefetch32(gprs[ARMRegs.PC]);
			return;
		}
		mmu.wait32(gprs[ARMRegs.PC]);
		var mode = cpu.mode;
		var addr = address(true);
		var total = 0;
		var m, i;
		cpu.switchMode(ARMMode.MODE_SYSTEM);
		for (m = rs, i = 0; m; m >>= 1, ++i) {
			if (m & 1) {
				mmu.store32(addr, gprs[i]);
				addr += 4;
				++total;
			}
		}
		cpu.switchMode(mode);
		mmu.waitMulti32(addr, total);
	};
};

ARMCoreArm.prototype.constructSTR = function(rd, address, condOp) {
	var cpu : ARMCoreType = this.cpu;
	var gprs = cpu.gprs;
	return function() {
		if (condOp && !condOp()) {
			cpu.mmu.waitPrefetch32(gprs[ARMRegs.PC]);
			return;
		}
		var addr = address();
		cpu.mmu.store32(addr, gprs[rd]);
		cpu.mmu.wait32(addr);
		cpu.mmu.wait32(gprs[ARMRegs.PC]);
	};
};

ARMCoreArm.prototype.constructSTRB = function(rd, address, condOp) {
	var cpu : ARMCoreType = this.cpu;
	var gprs = cpu.gprs;
	return function() {
		if (condOp && !condOp()) {
			cpu.mmu.waitPrefetch32(gprs[ARMRegs.PC]);
			return;
		}
		var addr = address();
		cpu.mmu.store8(addr, gprs[rd]);
		cpu.mmu.wait(addr);
		cpu.mmu.wait32(gprs[ARMRegs.PC]);
	};
};

ARMCoreArm.prototype.constructSTRH = function(rd, address, condOp) {
	var cpu : ARMCoreType = this.cpu;
	var gprs = cpu.gprs;
	return function() {
		if (condOp && !condOp()) {
			cpu.mmu.waitPrefetch32(gprs[ARMRegs.PC]);
			return;
		}
		var addr = address();
		cpu.mmu.store16(addr, gprs[rd]);
		cpu.mmu.wait(addr);
		cpu.mmu.wait32(gprs[ARMRegs.PC]);
	};
};

ARMCoreArm.prototype.constructSUB = function(rd, rn, shiftOp, condOp) {
	var cpu : ARMCoreType = this.cpu;
	var gprs = cpu.gprs;
	return function() {
		cpu.mmu.waitPrefetch32(gprs[ARMRegs.PC]);
		if (condOp && !condOp()) {
			return;
		}
		shiftOp();
		gprs[rd] = gprs[rn] - cpu.shifterOperand;
	};
};

ARMCoreArm.prototype.constructSUBS = function(rd, rn, shiftOp, condOp) {
	var cpu : ARMCoreType = this.cpu;
	var gprs = cpu.gprs;
	return function() {
		cpu.mmu.waitPrefetch32(gprs[ARMRegs.PC]);
		if (condOp && !condOp()) {
			return;
		}
		shiftOp();
		var d = gprs[rn] - cpu.shifterOperand;
		if (rd == ARMRegs.PC && cpu.hasSPSR()) {
			cpu.unpackCPSR(cpu.spsr);
		} else {
			cpu.cpsrN = d >> 31;
			cpu.cpsrZ = !(d & 0xFFFFFFFF);
			cpu.cpsrC = (gprs[rn] >>> 0) >= (cpu.shifterOperand >>> 0);
			cpu.cpsrV = (gprs[rn] >> 31) != (cpu.shifterOperand >> 31) &&
						(gprs[rn] >> 31) != (d >> 31);
		}
		gprs[rd] = d;
	};
};

ARMCoreArm.prototype.constructSWI = function(immediate, condOp) {
	var cpu : ARMCoreType = this.cpu;
	var gprs = cpu.gprs;
	return function() {
		if (condOp && !condOp()) {
			cpu.mmu.waitPrefetch32(gprs[ARMRegs.PC]);
			return;
		}
		cpu.irq.swi32(immediate);
		cpu.mmu.waitPrefetch32(gprs[ARMRegs.PC]);
	};
};

ARMCoreArm.prototype.constructSWP = function(rd, rn, rm, condOp) {
	var cpu : ARMCoreType = this.cpu;
	var gprs = cpu.gprs;
	return function() {
		cpu.mmu.waitPrefetch32(gprs[ARMRegs.PC]);
		if (condOp && !condOp()) {
			return;
		}
		cpu.mmu.wait32(gprs[rn]);
		cpu.mmu.wait32(gprs[rn]);
		var d = cpu.mmu.load32(gprs[rn]);
		cpu.mmu.store32(gprs[rn], gprs[rm]);
		gprs[rd] = d;
		++cpu.cycles;
	}
};

ARMCoreArm.prototype.constructSWPB = function(rd, rn, rm, condOp) {
	var cpu : ARMCoreType = this.cpu;
	var gprs = cpu.gprs;
	return function() {
		cpu.mmu.waitPrefetch32(gprs[ARMRegs.PC]);
		if (condOp && !condOp()) {
			return;
		}
		cpu.mmu.wait(gprs[rn]);
		cpu.mmu.wait(gprs[rn]);
		var d = cpu.mmu.loadU8(gprs[rn]);
		cpu.mmu.store8(gprs[rn], gprs[rm]);
		gprs[rd] = d;
		++cpu.cycles;
	}
};

ARMCoreArm.prototype.constructTEQ = function(rd, rn, shiftOp, condOp) {
	var cpu : ARMCoreType = this.cpu;
	var gprs = cpu.gprs;
	return function() {
		cpu.mmu.waitPrefetch32(gprs[ARMRegs.PC]);
		if (condOp && !condOp()) {
			return;
		}
		shiftOp();
		var aluOut = gprs[rn] ^ cpu.shifterOperand;
		cpu.cpsrN = aluOut >> 31;
		cpu.cpsrZ = !(aluOut & 0xFFFFFFFF);
		cpu.cpsrC = cpu.shifterCarryOut;
	};
};

ARMCoreArm.prototype.constructTST = function(rd, rn, shiftOp, condOp) {
	var cpu : ARMCoreType = this.cpu;
	var gprs = cpu.gprs;
	return function() {
		cpu.mmu.waitPrefetch32(gprs[ARMRegs.PC]);
		if (condOp && !condOp()) {
			return;
		}
		shiftOp();
		var aluOut = gprs[rn] & cpu.shifterOperand;
		cpu.cpsrN = aluOut >> 31;
		cpu.cpsrZ = !(aluOut & 0xFFFFFFFF);
		cpu.cpsrC = cpu.shifterCarryOut;
	};
};

ARMCoreArm.prototype.constructUMLAL = function(rd, rn, rs, rm, condOp) {
	var cpu : ARMCoreType = this.cpu;
	var SHIFT_32 = 1/0x100000000;
	var gprs = cpu.gprs;
	return function() {
		cpu.mmu.waitPrefetch32(gprs[ARMRegs.PC]);
		if (condOp && !condOp()) {
			return;
		}
		cpu.cycles += 2;
		cpu.mmu.waitMul(rs);
		var hi = ((gprs[rm] & 0xFFFF0000) >>> 0) * (gprs[rs] >>> 0);
		var lo = (gprs[rm] & 0x0000FFFF) * (gprs[rs] >>> 0);
		var carry = (gprs[rn] >>> 0) + hi + lo;
		gprs[rn] = carry;
		gprs[rd] += carry * SHIFT_32;
	};
};

ARMCoreArm.prototype.constructUMLALS = function(rd, rn, rs, rm, condOp) {
	var cpu : ARMCoreType = this.cpu;
	var SHIFT_32 = 1/0x100000000;
	var gprs = cpu.gprs;
	return function() {
		cpu.mmu.waitPrefetch32(gprs[ARMRegs.PC]);
		if (condOp && !condOp()) {
			return;
		}
		cpu.cycles += 2;
		cpu.mmu.waitMul(rs);
		var hi = ((gprs[rm] & 0xFFFF0000) >>> 0) * (gprs[rs] >>> 0);
		var lo = (gprs[rm] & 0x0000FFFF) * (gprs[rs] >>> 0);
		var carry = (gprs[rn] >>> 0) + hi + lo;
		gprs[rn] = carry;
		gprs[rd] += carry * SHIFT_32;
		cpu.cpsrN = gprs[rd] >> 31;
		cpu.cpsrZ = !((gprs[rd] & 0xFFFFFFFF) || (gprs[rn] & 0xFFFFFFFF));
	};
};

ARMCoreArm.prototype.constructUMULL = function(rd, rn, rs, rm, condOp) {
	var cpu : ARMCoreType = this.cpu;
	var SHIFT_32 = 1/0x100000000;
	var gprs = cpu.gprs;
	return function() {
		cpu.mmu.waitPrefetch32(gprs[ARMRegs.PC]);
		if (condOp && !condOp()) {
			return;
		}
		++cpu.cycles;
		cpu.mmu.waitMul(gprs[rs]);
		var hi = ((gprs[rm] & 0xFFFF0000) >>> 0) * (gprs[rs] >>> 0);
		var lo = ((gprs[rm] & 0x0000FFFF) >>> 0) * (gprs[rs] >>> 0);
		gprs[rn] = ((hi & 0xFFFFFFFF) + (lo & 0xFFFFFFFF)) & 0xFFFFFFFF;
		gprs[rd] = (hi * SHIFT_32 + lo * SHIFT_32) >>> 0;
	};
};

ARMCoreArm.prototype.constructUMULLS = function(rd, rn, rs, rm, condOp) {
	var cpu : ARMCoreType = this.cpu;
	var SHIFT_32 = 1/0x100000000;
	var gprs = cpu.gprs;
	return function() {
		cpu.mmu.waitPrefetch32(gprs[ARMRegs.PC]);
		if (condOp && !condOp()) {
			return;
		}
		++cpu.cycles;
		cpu.mmu.waitMul(gprs[rs]);
		var hi = ((gprs[rm] & 0xFFFF0000) >>> 0) * (gprs[rs] >>> 0);
		var lo = ((gprs[rm] & 0x0000FFFF) >>> 0) * (gprs[rs] >>> 0);
		gprs[rn] = ((hi & 0xFFFFFFFF) + (lo & 0xFFFFFFFF)) & 0xFFFFFFFF;
		gprs[rd] = (hi * SHIFT_32 + lo * SHIFT_32) >>> 0;
		cpu.cpsrN = gprs[rd] >> 31;
		cpu.cpsrZ = !((gprs[rd] & 0xFFFFFFFF) || (gprs[rn] & 0xFFFFFFFF));
	};
};

///////////////////////////////////////////////////////////////////////////

function ARMCoreThumb(cpu) {
	this.cpu = cpu;
};

ARMCoreThumb.prototype.constructADC = function(rd, rm) {
	var cpu : ARMCoreType = this.cpu;
	var gprs = cpu.gprs;
	return function() {
		cpu.mmu.waitPrefetch(gprs[ARMRegs.PC]);
		var m = (gprs[rm] >>> 0) + (cpu.cpsrC ? 1 : 0);
		var oldD = gprs[rd];
		var d = (oldD >>> 0) + m;
		var oldDn = oldD >> 31;
		var dn = d >> 31;
		var mn = m >> 31;
		cpu.cpsrN = dn;
		cpu.cpsrZ = !(d & 0xFFFFFFFF);
		cpu.cpsrC = d > 0xFFFFFFFF;
		cpu.cpsrV = oldDn == mn && oldDn != dn && mn != dn;
		gprs[rd] = d;
	};
};

ARMCoreThumb.prototype.constructADD1 = function(rd, rn, immediate) {
	var cpu : ARMCoreType = this.cpu;
	var gprs = cpu.gprs;
	return function() {
		cpu.mmu.waitPrefetch(gprs[ARMRegs.PC]);
		var d = (gprs[rn] >>> 0) + immediate;
		cpu.cpsrN = d >> 31;
		cpu.cpsrZ = !(d & 0xFFFFFFFF);
		cpu.cpsrC = d > 0xFFFFFFFF;
		cpu.cpsrV = !(gprs[rn] >> 31) && ((gprs[rn] >> 31 ^ d) >> 31) && (d >> 31);
		gprs[rd] = d;
	};
};

ARMCoreThumb.prototype.constructADD2 = function(rn, immediate) {
	var cpu : ARMCoreType = this.cpu;
	var gprs = cpu.gprs;
	return function() {
		cpu.mmu.waitPrefetch(gprs[ARMRegs.PC]);
		var d = (gprs[rn] >>> 0) + immediate;
		cpu.cpsrN = d >> 31;
		cpu.cpsrZ = !(d & 0xFFFFFFFF);
		cpu.cpsrC = d > 0xFFFFFFFF;
		cpu.cpsrV = !(gprs[rn] >> 31) && ((gprs[rn] ^ d) >> 31) && ((immediate ^ d) >> 31);
		gprs[rn] = d;
	};
};

ARMCoreThumb.prototype.constructADD3 = function(rd, rn, rm) {
	var cpu : ARMCoreType = this.cpu;
	var gprs = cpu.gprs;
	return function() {
		cpu.mmu.waitPrefetch(gprs[ARMRegs.PC]);
		var d = (gprs[rn] >>> 0) + (gprs[rm] >>> 0);
		cpu.cpsrN = d >> 31;
		cpu.cpsrZ = !(d & 0xFFFFFFFF);
		cpu.cpsrC = d > 0xFFFFFFFF;
		cpu.cpsrV = !((gprs[rn] ^ gprs[rm]) >> 31) && ((gprs[rn] ^ d) >> 31) && ((gprs[rm] ^ d) >> 31);
		gprs[rd] = d;
	};
};

ARMCoreThumb.prototype.constructADD4 = function(rd, rm) {
	var cpu : ARMCoreType = this.cpu;
	var gprs = cpu.gprs;
	return function() {
		cpu.mmu.waitPrefetch(gprs[ARMRegs.PC]);
		gprs[rd] += gprs[rm];
	};
};

ARMCoreThumb.prototype.constructADD5 = function(rd, immediate) {
	var cpu : ARMCoreType = this.cpu;
	var gprs = cpu.gprs;
	return function() {
		cpu.mmu.waitPrefetch(gprs[ARMRegs.PC]);
		gprs[rd] = (gprs[ARMRegs.PC] & 0xFFFFFFFC) + immediate;
	};
};

ARMCoreThumb.prototype.constructADD6 = function(rd, immediate) {
	var cpu : ARMCoreType = this.cpu;
	var gprs = cpu.gprs;
	return function() {
		cpu.mmu.waitPrefetch(gprs[ARMRegs.PC]);
		gprs[rd] = gprs[ARMRegs.SP] + immediate;
	};
};

ARMCoreThumb.prototype.constructADD7 = function(immediate) {
	var cpu : ARMCoreType = this.cpu;
	var gprs = cpu.gprs;
	return function() {
		cpu.mmu.waitPrefetch(gprs[ARMRegs.PC]);
		gprs[ARMRegs.SP] += immediate;
	};
};

ARMCoreThumb.prototype.constructAND = function(rd, rm) {
	var cpu : ARMCoreType = this.cpu;
	var gprs = cpu.gprs;
	return function() {
		cpu.mmu.waitPrefetch(gprs[ARMRegs.PC]);
		gprs[rd] = gprs[rd] & gprs[rm];
		cpu.cpsrN = gprs[rd] >> 31;
		cpu.cpsrZ = !(gprs[rd] & 0xFFFFFFFF);
	};
};

ARMCoreThumb.prototype.constructASR1 = function(rd, rm, immediate) {
	var cpu : ARMCoreType = this.cpu;
	var gprs = cpu.gprs;
	return function() {
		cpu.mmu.waitPrefetch(gprs[ARMRegs.PC]);
		if (immediate == 0) {
			cpu.cpsrC = gprs[rm] >> 31;
			if (cpu.cpsrC) {
				gprs[rd] = 0xFFFFFFFF;
			} else {
				gprs[rd] = 0;
			}
		} else {
			cpu.cpsrC = gprs[rm] & (1 << (immediate - 1));
			gprs[rd] = gprs[rm] >> immediate;
		}
		cpu.cpsrN = gprs[rd] >> 31;
		cpu.cpsrZ = !(gprs[rd] & 0xFFFFFFFF);
	};
};

ARMCoreThumb.prototype.constructASR2 = function(rd, rm) {
	var cpu : ARMCoreType = this.cpu;
	var gprs = cpu.gprs;
	return function() {
		cpu.mmu.waitPrefetch(gprs[ARMRegs.PC]);
		var rs = gprs[rm] & 0xFF;
		if (rs) {
			if (rs < 32) {
				cpu.cpsrC = gprs[rd] & (1 << (rs - 1));
				gprs[rd] >>= rs;
			} else {
				cpu.cpsrC = gprs[rd] >> 31;
				if (cpu.cpsrC) {
					gprs[rd] = 0xFFFFFFFF;
				} else {
					gprs[rd] = 0;
				}
			}
		}
		cpu.cpsrN = gprs[rd] >> 31;
		cpu.cpsrZ = !(gprs[rd] & 0xFFFFFFFF);
	};
};

ARMCoreThumb.prototype.constructB1 = function(immediate, condOp) {
	var cpu : ARMCoreType = this.cpu;
	var gprs = cpu.gprs;
	return function() {
		cpu.mmu.waitPrefetch(gprs[ARMRegs.PC]);
		if (condOp()) {
			gprs[ARMRegs.PC] += immediate;
		}
	};
};

ARMCoreThumb.prototype.constructB2 = function(immediate) {
	var cpu : ARMCoreType = this.cpu;
	var gprs = cpu.gprs;
	return function() {
		cpu.mmu.waitPrefetch(gprs[ARMRegs.PC]);
		gprs[ARMRegs.PC] += immediate;
	};
};

ARMCoreThumb.prototype.constructBIC = function(rd, rm) {
	var cpu : ARMCoreType = this.cpu;
	var gprs = cpu.gprs;
	return function() {
		cpu.mmu.waitPrefetch(gprs[ARMRegs.PC]);
		gprs[rd] = gprs[rd] & ~gprs[rm];
		cpu.cpsrN = gprs[rd] >> 31;
		cpu.cpsrZ = !(gprs[rd] & 0xFFFFFFFF);
	};
};

ARMCoreThumb.prototype.constructBL1 = function(immediate) {
	var cpu : ARMCoreType = this.cpu;
	var gprs = cpu.gprs;
	return function() {
		cpu.mmu.waitPrefetch(gprs[ARMRegs.PC]);
		gprs[ARMRegs.LR] = gprs[ARMRegs.PC] + immediate;
	}
};

ARMCoreThumb.prototype.constructBL2 = function(immediate) {
	var cpu : ARMCoreType = this.cpu;
	var gprs = cpu.gprs;
	return function() {
		cpu.mmu.waitPrefetch(gprs[ARMRegs.PC]);
		var pc = gprs[ARMRegs.PC];
		gprs[ARMRegs.PC] = gprs[ARMRegs.LR] + (immediate << 1);
		gprs[ARMRegs.LR] = pc - 1;
	}
};

ARMCoreThumb.prototype.constructBX = function(rd, rm) {
	var cpu : ARMCoreType = this.cpu;
	var gprs = cpu.gprs;
	return function() {
		cpu.mmu.waitPrefetch(gprs[ARMRegs.PC]);
		cpu.switchExecMode(gprs[rm] & 0x00000001);
		var misalign = 0;
		if (rm == 15) {
			misalign = gprs[rm] & 0x00000002;
		}
		gprs[ARMRegs.PC] = gprs[rm] & 0xFFFFFFFE - misalign;
	};
};

ARMCoreThumb.prototype.constructCMN = function(rd, rm) {
	var cpu : ARMCoreType = this.cpu;
	var gprs = cpu.gprs;
	return function() {
		cpu.mmu.waitPrefetch(gprs[ARMRegs.PC]);
		var aluOut = (gprs[rd] >>> 0) + (gprs[rm] >>> 0);
		cpu.cpsrN = aluOut >> 31;
		cpu.cpsrZ = !(aluOut & 0xFFFFFFFF);
		cpu.cpsrC = aluOut > 0xFFFFFFFF;
		cpu.cpsrV = (gprs[rd] >> 31) == (gprs[rm] >> 31) &&
					(gprs[rd] >> 31) != (aluOut >> 31) &&
					(gprs[rm] >> 31) != (aluOut >> 31);
	};
};

ARMCoreThumb.prototype.constructCMP1 = function(rn, immediate) {
	var cpu : ARMCoreType = this.cpu;
	var gprs = cpu.gprs;
	return function() {
		cpu.mmu.waitPrefetch(gprs[ARMRegs.PC]);
		var aluOut = gprs[rn] - immediate;
		cpu.cpsrN = aluOut >> 31;
		cpu.cpsrZ = !(aluOut & 0xFFFFFFFF);
		cpu.cpsrC = (gprs[rn] >>> 0) >= immediate;
		cpu.cpsrV = (gprs[rn] >> 31) && ((gprs[rn] ^ aluOut) >> 31);
	};
}

ARMCoreThumb.prototype.constructCMP2 = function(rd, rm) {
	var cpu : ARMCoreType = this.cpu;
	var gprs = cpu.gprs;
	return function() {
		cpu.mmu.waitPrefetch(gprs[ARMRegs.PC]);
		var d = gprs[rd];
		var m = gprs[rm];
		var aluOut = d - m;
		var an = aluOut >> 31;
		var dn = d >> 31;
		cpu.cpsrN = an;
		cpu.cpsrZ = !(aluOut & 0xFFFFFFFF);
		cpu.cpsrC = (d >>> 0) >= (m >>> 0);
		cpu.cpsrV = dn != (m >> 31) && dn != an;
	};
};

ARMCoreThumb.prototype.constructCMP3 = function(rd, rm) {
	var cpu : ARMCoreType = this.cpu;
	var gprs = cpu.gprs;
	return function() {
		cpu.mmu.waitPrefetch(gprs[ARMRegs.PC]);
		var aluOut = gprs[rd] - gprs[rm];
		cpu.cpsrN = aluOut >> 31;
		cpu.cpsrZ = !(aluOut & 0xFFFFFFFF);
		cpu.cpsrC = (gprs[rd] >>> 0) >= (gprs[rm] >>> 0);
		cpu.cpsrV = ((gprs[rd] ^ gprs[rm]) >> 31) && ((gprs[rd] ^ aluOut) >> 31);
	};
};

ARMCoreThumb.prototype.constructEOR = function(rd, rm) {
	var cpu : ARMCoreType = this.cpu;
	var gprs = cpu.gprs;
	return function() {
		cpu.mmu.waitPrefetch(gprs[ARMRegs.PC]);
		gprs[rd] = gprs[rd] ^ gprs[rm];
		cpu.cpsrN = gprs[rd] >> 31;
		cpu.cpsrZ = !(gprs[rd] & 0xFFFFFFFF);
	};
};

ARMCoreThumb.prototype.constructLDMIA = function(rn, rs) {
	var cpu : ARMCoreType = this.cpu;
	var gprs = cpu.gprs;
	return function() {
		cpu.mmu.waitPrefetch(gprs[ARMRegs.PC]);
		var address = gprs[rn];
		var total = 0;
		var m, i;
		for (m = 0x01, i = 0; i < 8; m <<= 1, ++i) {
			if (rs & m) {
				gprs[i] = cpu.mmu.load32(address);
				address += 4;
				++total;
			}
		}
		cpu.mmu.waitMulti32(address, total);
		if (!((1 << rn) & rs)) {
			gprs[rn] = address;
		}
	};
};

ARMCoreThumb.prototype.constructLDR1 = function(rd, rn, immediate) {
	var cpu : ARMCoreType = this.cpu;
	var gprs = cpu.gprs;
	return function() {
		cpu.mmu.waitPrefetch(gprs[ARMRegs.PC]);
		var n = gprs[rn] + immediate;
		gprs[rd] = cpu.mmu.load32(n);
		cpu.mmu.wait32(n);
		++cpu.cycles;
	};
};

ARMCoreThumb.prototype.constructLDR2 = function(rd, rn, rm) {
	var cpu : ARMCoreType = this.cpu;
	var gprs = cpu.gprs;
	return function() {
		cpu.mmu.waitPrefetch(gprs[ARMRegs.PC]);
		gprs[rd] = cpu.mmu.load32(gprs[rn] + gprs[rm]);
		cpu.mmu.wait32(gprs[rn] + gprs[rm]);
		++cpu.cycles;
	}
};

ARMCoreThumb.prototype.constructLDR3 = function(rd, immediate) {
	var cpu : ARMCoreType = this.cpu;
	var gprs = cpu.gprs;
	return function() {
		cpu.mmu.waitPrefetch(gprs[ARMRegs.PC]);
		gprs[rd] = cpu.mmu.load32((gprs[ARMRegs.PC] & 0xFFFFFFFC) + immediate);
		cpu.mmu.wait32(gprs[ARMRegs.PC]);
		++cpu.cycles;
	};
};

ARMCoreThumb.prototype.constructLDR4 = function(rd, immediate) {
	var cpu : ARMCoreType = this.cpu;
	var gprs = cpu.gprs;
	return function() {
		cpu.mmu.waitPrefetch(gprs[ARMRegs.PC]);
		gprs[rd] = cpu.mmu.load32(gprs[ARMRegs.SP] + immediate);
		cpu.mmu.wait32(gprs[ARMRegs.SP] + immediate);
		++cpu.cycles;
	};
};

ARMCoreThumb.prototype.constructLDRB1 = function(rd, rn, immediate) {
	var cpu : ARMCoreType = this.cpu;
	var gprs = cpu.gprs;
	return function() {
		var n = gprs[rn] + immediate;
		cpu.mmu.waitPrefetch(gprs[ARMRegs.PC]);
		gprs[rd] = cpu.mmu.loadU8(n);
		cpu.mmu.wait(n);
		++cpu.cycles;
	};
};

ARMCoreThumb.prototype.constructLDRB2 = function(rd, rn, rm) {
	var cpu : ARMCoreType = this.cpu;
	var gprs = cpu.gprs;
	return function() {
		cpu.mmu.waitPrefetch(gprs[ARMRegs.PC]);
		gprs[rd] = cpu.mmu.loadU8(gprs[rn] + gprs[rm]);
		cpu.mmu.wait(gprs[rn] + gprs[rm]);
		++cpu.cycles;
	};
};

ARMCoreThumb.prototype.constructLDRH1 = function(rd, rn, immediate) {
	var cpu : ARMCoreType = this.cpu;
	var gprs = cpu.gprs;
	return function() {
		var n = gprs[rn] + immediate;
		cpu.mmu.waitPrefetch(gprs[ARMRegs.PC]);
		gprs[rd] = cpu.mmu.loadU16(n);
		cpu.mmu.wait(n);
		++cpu.cycles;
	};
};

ARMCoreThumb.prototype.constructLDRH2 = function(rd, rn, rm) {
	var cpu : ARMCoreType = this.cpu;
	var gprs = cpu.gprs;
	return function() {
		cpu.mmu.waitPrefetch(gprs[ARMRegs.PC]);
		gprs[rd] = cpu.mmu.loadU16(gprs[rn] + gprs[rm]);
		cpu.mmu.wait(gprs[rn] + gprs[rm]);
		++cpu.cycles;
	};
};

ARMCoreThumb.prototype.constructLDRSB = function(rd, rn, rm) {
	var cpu : ARMCoreType = this.cpu;
	var gprs = cpu.gprs;
	return function() {
		cpu.mmu.waitPrefetch(gprs[ARMRegs.PC]);
		gprs[rd] = cpu.mmu.load8(gprs[rn] + gprs[rm]);
		cpu.mmu.wait(gprs[rn] + gprs[rm]);
		++cpu.cycles;
	};
};

ARMCoreThumb.prototype.constructLDRSH = function(rd, rn, rm) {
	var cpu : ARMCoreType = this.cpu;
	var gprs = cpu.gprs;
	return function() {
		cpu.mmu.waitPrefetch(gprs[ARMRegs.PC]);
		gprs[rd] = cpu.mmu.load16(gprs[rn] + gprs[rm]);
		cpu.mmu.wait(gprs[rn] + gprs[rm]);
		++cpu.cycles;
	};
};

ARMCoreThumb.prototype.constructLSL1 = function(rd, rm, immediate) {
	var cpu : ARMCoreType = this.cpu;
	var gprs = cpu.gprs;
	return function() {
		cpu.mmu.waitPrefetch(gprs[ARMRegs.PC]);
		if (immediate == 0) {
			gprs[rd] = gprs[rm];
		} else {
			cpu.cpsrC = gprs[rm] & (1 << (32 - immediate));
			gprs[rd] = gprs[rm] << immediate;
		}
		cpu.cpsrN = gprs[rd] >> 31;
		cpu.cpsrZ = !(gprs[rd] & 0xFFFFFFFF);
	};
};

ARMCoreThumb.prototype.constructLSL2 = function(rd, rm) {
	var cpu : ARMCoreType = this.cpu;
	var gprs = cpu.gprs;
	return function() {
		cpu.mmu.waitPrefetch(gprs[ARMRegs.PC]);
		var rs = gprs[rm] & 0xFF;
		if (rs) {
			if (rs < 32) {
				cpu.cpsrC = gprs[rd] & (1 << (32 - rs));
				gprs[rd] <<= rs;
			} else {
				if (rs > 32) {
					cpu.cpsrC = 0;
				} else {
					cpu.cpsrC = gprs[rd] & 0x00000001;
				}
				gprs[rd] = 0;
			}
		}
		cpu.cpsrN = gprs[rd] >> 31;
		cpu.cpsrZ = !(gprs[rd] & 0xFFFFFFFF);
	};
};

ARMCoreThumb.prototype.constructLSR1 = function(rd, rm, immediate) {
	var cpu : ARMCoreType = this.cpu;
	var gprs = cpu.gprs;
	return function() {
		cpu.mmu.waitPrefetch(gprs[ARMRegs.PC]);
		if (immediate == 0) {
			cpu.cpsrC = gprs[rm] >> 31;
			gprs[rd] = 0;
		} else {
			cpu.cpsrC = gprs[rm] & (1 << (immediate - 1));
			gprs[rd] = gprs[rm] >>> immediate;
		}
		cpu.cpsrN = 0;
		cpu.cpsrZ = !(gprs[rd] & 0xFFFFFFFF);
	};
}

ARMCoreThumb.prototype.constructLSR2 = function(rd, rm) {
	var cpu : ARMCoreType = this.cpu;
	var gprs = cpu.gprs;
	return function() {
		cpu.mmu.waitPrefetch(gprs[ARMRegs.PC]);
		var rs = gprs[rm] & 0xFF;
		if (rs) {
			if (rs < 32) {
				cpu.cpsrC = gprs[rd] & (1 << (rs - 1));
				gprs[rd] >>>= rs;
			} else {
				if (rs > 32) {
					cpu.cpsrC = 0;
				} else {
					cpu.cpsrC = gprs[rd] >> 31;
				}
				gprs[rd] = 0;
			}
		}
		cpu.cpsrN = gprs[rd] >> 31;
		cpu.cpsrZ = !(gprs[rd] & 0xFFFFFFFF);
	};
};

ARMCoreThumb.prototype.constructMOV1 = function(rn, immediate) {
	var cpu : ARMCoreType = this.cpu;
	var gprs = cpu.gprs;
	return function() {
		cpu.mmu.waitPrefetch(gprs[ARMRegs.PC]);
		gprs[rn] = immediate;
		cpu.cpsrN = immediate >> 31;
		cpu.cpsrZ = !(immediate & 0xFFFFFFFF);
	};
};

ARMCoreThumb.prototype.constructMOV2 = function(rd, rn, rm) {
	var cpu : ARMCoreType = this.cpu;
	var gprs = cpu.gprs;
	return function() {
		cpu.mmu.waitPrefetch(gprs[ARMRegs.PC]);
		var d = gprs[rn];
		cpu.cpsrN = d >> 31;
		cpu.cpsrZ = !(d & 0xFFFFFFFF);
		cpu.cpsrC = 0;
		cpu.cpsrV = 0;
		gprs[rd] = d;
	};
};

ARMCoreThumb.prototype.constructMOV3 = function(rd, rm) {
	var cpu : ARMCoreType = this.cpu;
	var gprs = cpu.gprs;
	return function() {
		cpu.mmu.waitPrefetch(gprs[ARMRegs.PC]);
		gprs[rd] = gprs[rm];
	};
};

ARMCoreThumb.prototype.constructMUL = function(rd, rm) {
	var cpu : ARMCoreType = this.cpu;
	var gprs = cpu.gprs;
	return function() {
		cpu.mmu.waitPrefetch(gprs[ARMRegs.PC]);
		cpu.mmu.waitMul(gprs[rm]);
		if ((gprs[rm] & 0xFFFF0000) && (gprs[rd] & 0xFFFF0000)) {
			// Our data type is a double--we'll lose bits if we do it all at once!
			var hi = ((gprs[rd] & 0xFFFF0000) * gprs[rm]) & 0xFFFFFFFF;
			var lo = ((gprs[rd] & 0x0000FFFF) * gprs[rm]) & 0xFFFFFFFF;
			gprs[rd] = (hi + lo) & 0xFFFFFFFF;
		} else {
			gprs[rd] *= gprs[rm];
		}
		cpu.cpsrN = gprs[rd] >> 31;
		cpu.cpsrZ = !(gprs[rd] & 0xFFFFFFFF);
	};
};

ARMCoreThumb.prototype.constructMVN = function(rd, rm) {
	var cpu : ARMCoreType = this.cpu;
	var gprs = cpu.gprs;
	return function() {
		cpu.mmu.waitPrefetch(gprs[ARMRegs.PC]);
		gprs[rd] = ~gprs[rm];
		cpu.cpsrN = gprs[rd] >> 31;
		cpu.cpsrZ = !(gprs[rd] & 0xFFFFFFFF);
	};
};

ARMCoreThumb.prototype.constructNEG = function(rd, rm) {
	var cpu : ARMCoreType = this.cpu;
	var gprs = cpu.gprs;
	return function() {
		cpu.mmu.waitPrefetch(gprs[ARMRegs.PC]);
		var d = -gprs[rm];
		cpu.cpsrN = d >> 31;
		cpu.cpsrZ = !(d & 0xFFFFFFFF);
		cpu.cpsrC = 0 >= (d >>> 0);
		cpu.cpsrV = (gprs[rm] >> 31) && (d >> 31);
		gprs[rd] = d;
	};
};

ARMCoreThumb.prototype.constructORR = function(rd, rm) {
	var cpu : ARMCoreType = this.cpu;
	var gprs = cpu.gprs;
	return function() {
		cpu.mmu.waitPrefetch(gprs[ARMRegs.PC]);
		gprs[rd] = gprs[rd] | gprs[rm];
		cpu.cpsrN = gprs[rd] >> 31;
		cpu.cpsrZ = !(gprs[rd] & 0xFFFFFFFF);
	};
};

ARMCoreThumb.prototype.constructPOP = function(rs, r) {
	var cpu : ARMCoreType = this.cpu;
	var gprs = cpu.gprs;
	return function() {
		cpu.mmu.waitPrefetch(gprs[ARMRegs.PC]);
		++cpu.cycles;
		var address = gprs[ARMRegs.SP];
		var total = 0;
		var m, i;
		for (m = 0x01, i = 0; i < 8; m <<= 1, ++i) {
			if (rs & m) {
				cpu.mmu.waitSeq32(address);
				gprs[i] = cpu.mmu.load32(address);
				address += 4;
				++total;
			}
		}
		if (r) {
			gprs[ARMRegs.PC] = cpu.mmu.load32(address) & 0xFFFFFFFE;
			address += 4;
			++total;
		}
		cpu.mmu.waitMulti32(address, total);
		gprs[ARMRegs.SP] = address;
	};
};

ARMCoreThumb.prototype.constructPUSH = function(rs, r) {
	var cpu : ARMCoreType = this.cpu;
	var gprs = cpu.gprs;
	return function() {
		var address = gprs[ARMRegs.SP] - 4;
		var total = 0;
		cpu.mmu.waitPrefetch(gprs[ARMRegs.PC]);
		if (r) {
			cpu.mmu.store32(address, gprs[ARMRegs.LR]);
			address -= 4;
			++total;
		}
		var m, i;
		for (m = 0x80, i = 7; m; m >>= 1, --i) {
			if (rs & m) {
				cpu.mmu.store32(address, gprs[i]);
				address -= 4;
				++total;
				break;
			}
		}
		for (m >>= 1, --i; m; m >>= 1, --i) {
			if (rs & m) {
				cpu.mmu.store32(address, gprs[i]);
				address -= 4;
				++total;
			}
		}
		cpu.mmu.waitMulti32(address, total);
		gprs[ARMRegs.SP] = address + 4;
	};
};

ARMCoreThumb.prototype.constructROR = function(rd, rm) {
	var cpu : ARMCoreType = this.cpu;
	var gprs = cpu.gprs;
	return function() {
		cpu.mmu.waitPrefetch(gprs[ARMRegs.PC]);
		var rs = gprs[rm] & 0xFF;
		if (rs) {
			var r4 = rs & 0x1F;
			if (r4 > 0) {
				cpu.cpsrC = gprs[rd] & (1 << (r4 - 1));
				gprs[rd] = (gprs[rd] >>> r4) | (gprs[rd] << (32 - r4));
			} else {
				cpu.cpsrC = gprs[rd] >> 31;
			}
		}
		cpu.cpsrN = gprs[rd] >> 31;
		cpu.cpsrZ = !(gprs[rd] & 0xFFFFFFFF);
	};
};

ARMCoreThumb.prototype.constructSBC = function(rd, rm) {
	var cpu : ARMCoreType = this.cpu;
	var gprs = cpu.gprs;
	return function() {
		cpu.mmu.waitPrefetch(gprs[ARMRegs.PC]);
		var m = (gprs[rm] >>> 0) + (cpu.cpsrC ? 0 : 1);
		var d = (gprs[rd] >>> 0) - m;
		cpu.cpsrN = d >> 31;
		cpu.cpsrZ = !(d & 0xFFFFFFFF);
		cpu.cpsrC = (gprs[rd] >>> 0) >= (d >>> 0);
		cpu.cpsrV = ((gprs[rd] ^ m) >> 31) && ((gprs[rd] ^ d) >> 31);
		gprs[rd] = d;
	};
};

ARMCoreThumb.prototype.constructSTMIA = function(rn, rs) {
	var cpu : ARMCoreType = this.cpu;
	var gprs = cpu.gprs;
	return function() {
		cpu.mmu.wait(gprs[ARMRegs.PC]);
		var address = gprs[rn];
		var total = 0;
		var m, i;
		for (m = 0x01, i = 0; i < 8; m <<= 1, ++i) {
			if (rs & m) {
				cpu.mmu.store32(address, gprs[i]);
				address += 4;
				++total;
				break;
			}
		}
		for (m <<= 1, ++i; i < 8; m <<= 1, ++i) {
			if (rs & m) {
				cpu.mmu.store32(address, gprs[i]);
				address += 4;
				++total;
			}
		}
		cpu.mmu.waitMulti32(address, total);
		gprs[rn] = address;
	};
};

ARMCoreThumb.prototype.constructSTR1 = function(rd, rn, immediate) {
	var cpu : ARMCoreType = this.cpu;
	var gprs = cpu.gprs;
	return function() {
		var n = gprs[rn] + immediate;
		cpu.mmu.store32(n, gprs[rd]);
		cpu.mmu.wait(gprs[ARMRegs.PC]);
		cpu.mmu.wait32(n);
	};
};

ARMCoreThumb.prototype.constructSTR2 = function(rd, rn, rm) {
	var cpu : ARMCoreType = this.cpu;
	var gprs = cpu.gprs;
	return function() {
		cpu.mmu.store32(gprs[rn] + gprs[rm], gprs[rd]);
		cpu.mmu.wait(gprs[ARMRegs.PC]);
		cpu.mmu.wait32(gprs[rn] + gprs[rm]);
	};
};

ARMCoreThumb.prototype.constructSTR3 = function(rd, immediate) {
	var cpu : ARMCoreType = this.cpu;
	var gprs = cpu.gprs;
	return function() {
		cpu.mmu.store32(gprs[ARMRegs.SP] + immediate, gprs[rd]);
		cpu.mmu.wait(gprs[ARMRegs.PC]);
		cpu.mmu.wait32(gprs[ARMRegs.SP] + immediate);
	};
};

ARMCoreThumb.prototype.constructSTRB1 = function(rd, rn, immediate) {
	var cpu : ARMCoreType = this.cpu;
	var gprs = cpu.gprs;
	return function() {
		var n = gprs[rn] + immediate;
		cpu.mmu.store8(n, gprs[rd]);
		cpu.mmu.wait(gprs[ARMRegs.PC]);
		cpu.mmu.wait(n);
	};
};

ARMCoreThumb.prototype.constructSTRB2 = function(rd, rn, rm) {
	var cpu : ARMCoreType = this.cpu;
	var gprs = cpu.gprs;
	return function() {
		cpu.mmu.store8(gprs[rn] + gprs[rm], gprs[rd]);
		cpu.mmu.wait(gprs[ARMRegs.PC]);
		cpu.mmu.wait(gprs[rn] + gprs[rm]);
	}
};

ARMCoreThumb.prototype.constructSTRH1 = function(rd, rn, immediate) {
	var cpu : ARMCoreType = this.cpu;
	var gprs = cpu.gprs;
	return function() {
		var n = gprs[rn] + immediate;
		cpu.mmu.store16(n, gprs[rd]);
		cpu.mmu.wait(gprs[ARMRegs.PC]);
		cpu.mmu.wait(n);
	};
};

ARMCoreThumb.prototype.constructSTRH2 = function(rd, rn, rm) {
	var cpu : ARMCoreType = this.cpu;
	var gprs = cpu.gprs;
	return function() {
		cpu.mmu.store16(gprs[rn] + gprs[rm], gprs[rd]);
		cpu.mmu.wait(gprs[ARMRegs.PC]);
		cpu.mmu.wait(gprs[rn] + gprs[rm]);
	}
};

ARMCoreThumb.prototype.constructSUB1 = function(rd, rn, immediate) {
	var cpu : ARMCoreType = this.cpu;
	var gprs = cpu.gprs;
	return function() {
		cpu.mmu.waitPrefetch(gprs[ARMRegs.PC]);
		var d = gprs[rn] - immediate;
		cpu.cpsrN = d >> 31;
		cpu.cpsrZ = !(d & 0xFFFFFFFF);
		cpu.cpsrC = (gprs[rn] >>> 0) >= immediate;
		cpu.cpsrV = (gprs[rn] >> 31) && ((gprs[rn] ^ d) >> 31);
		gprs[rd] = d;
	};
}

ARMCoreThumb.prototype.constructSUB2 = function(rn, immediate) {
	var cpu : ARMCoreType = this.cpu;
	var gprs = cpu.gprs;
	return function() {
		cpu.mmu.waitPrefetch(gprs[ARMRegs.PC]);
		var d = gprs[rn] - immediate;
		cpu.cpsrN = d >> 31;
		cpu.cpsrZ = !(d & 0xFFFFFFFF);
		cpu.cpsrC = (gprs[rn] >>> 0) >= immediate;
		cpu.cpsrV = (gprs[rn] >> 31) && ((gprs[rn] ^ d) >> 31);
		gprs[rn] = d;
	};
};

ARMCoreThumb.prototype.constructSUB3 = function(rd, rn, rm) {
	var cpu : ARMCoreType = this.cpu;
	var gprs = cpu.gprs;
	return function() {
		cpu.mmu.waitPrefetch(gprs[ARMRegs.PC]);
		var d = gprs[rn] - gprs[rm];
		cpu.cpsrN = d >> 31;
		cpu.cpsrZ = !(d & 0xFFFFFFFF);
		cpu.cpsrC = (gprs[rn] >>> 0) >= (gprs[rm] >>> 0);
		cpu.cpsrV = (gprs[rn] >> 31) != (gprs[rm] >> 31) &&
					(gprs[rn] >> 31) != (d >> 31);
		gprs[rd] = d;
	};
};

ARMCoreThumb.prototype.constructSWI = function(immediate) {
	var cpu : ARMCoreType = this.cpu;
	var gprs = cpu.gprs;
	return function() {
		cpu.irq.swi(immediate);
		cpu.mmu.waitPrefetch(gprs[ARMRegs.PC]);
	}
};

ARMCoreThumb.prototype.constructTST = function(rd, rm) {
	var cpu : ARMCoreType = this.cpu;
	var gprs = cpu.gprs;
	return function() {
		cpu.mmu.waitPrefetch(gprs[ARMRegs.PC]);
		var aluOut = gprs[rd] & gprs[rm];
		cpu.cpsrN = aluOut >> 31;
		cpu.cpsrZ = !(aluOut & 0xFFFFFFFF);
	};
};

///////////////////////////////////////////////////////////////////////////

function ARMCore() {
	this.SP = 13;
	this.LR = 14;
	this.PC = 15;

	this.MODE_ARM = 0;
	this.MODE_THUMB = 1;

	this.MODE_USER = 0x10;
	this.MODE_FIQ = 0x11;
	this.MODE_IRQ = 0x12;
	this.MODE_SUPERVISOR = 0x13;
	this.MODE_ABORT = 0x17;
	this.MODE_UNDEFINED = 0x1B;
	this.MODE_SYSTEM = 0x1F;

	this.BANK_NONE = 0
	this.BANK_FIQ = 1;
	this.BANK_IRQ = 2;
	this.BANK_SUPERVISOR = 3;
	this.BANK_ABORT = 4;
	this.BANK_UNDEFINED = 5;

	this.WORD_SIZE_ARM = 4;
	this.WORD_SIZE_THUMB = 2;

	this.BASE_RESET = 0x00000000;
	this.BASE_UNDEF = 0x00000004;
	this.BASE_SWI = 0x00000008;
	this.BASE_PABT = 0x0000000C;
	this.BASE_DABT = 0x00000010;
	this.BASE_IRQ = 0x00000018;
	this.BASE_FIQ = 0x0000001C;

	this.armCompiler = new ARMCoreArm(this);
	this.thumbCompiler = new ARMCoreThumb(this);
	this.generateConds();

	this.gprs = new Int32Array(16);
};

ARMCore.prototype.resetCPU = function(startOffset) {
	for (var i = 0; i < ARMRegs.PC; ++i) {
		this.gprs[i] = 0;
	}
	this.gprs[ARMRegs.PC] = startOffset + ARMConstants.WORD_SIZE_ARM;

	this.loadInstruction = this.loadInstructionArm;
	this.execMode = ARMMode.MODE_ARM;
	this.instructionWidth = ARMConstants.WORD_SIZE_ARM;

	this.mode = ARMMode.MODE_SYSTEM;

	this.cpsrI = false;
	this.cpsrF = false;

	this.cpsrV = false;
	this.cpsrC = false;
	this.cpsrZ = false;
	this.cpsrN = false;

	this.bankedRegisters = [
		new Int32Array(7),
		new Int32Array(7),
		new Int32Array(2),
		new Int32Array(2),
		new Int32Array(2),
		new Int32Array(2)
	];
	this.spsr = 0;
	this.bankedSPSRs = new Int32Array(6);

	this.cycles = 0;

	this.shifterOperand = 0;
	this.shifterCarryOut = 0;

	this.page = null;
	this.pageId = 0;
	this.pageRegion = -1;

	this.instruction = null;

	this.irq.clear();

	var gprs = this.gprs;
	var mmu = this.mmu as ARMMMUInterface;

	this.step = function() {
		var instruction = this.instruction || (this.instruction = this.loadInstruction(gprs[ARMRegs.PC] - this.instructionWidth));
		gprs[ARMRegs.PC] += this.instructionWidth;
		this.conditionPassed = true;
		instruction();

		if (!instruction.writesPC) {
			if (this.instruction != null) { // We might have gotten an interrupt from the instruction
				if (instruction.next == null || instruction.next.page.invalid) {
					instruction.next = this.loadInstruction(gprs[ARMRegs.PC] - this.instructionWidth);
				}
				this.instruction = instruction.next;
			}
		} else {
			if (this.conditionPassed) {
				var pc = gprs[ARMRegs.PC] &= 0xFFFFFFFE;
				if (this.execMode == ARMMode.MODE_ARM) {
					mmu.wait32(pc);
					mmu.waitPrefetch32(pc);
				} else {
					mmu.wait(pc);
					mmu.waitPrefetch(pc);
				}
				gprs[ARMRegs.PC] += this.instructionWidth;
				if (!instruction.fixedJump) {
					this.instruction = null;
				} else if  (this.instruction != null) {
					if (instruction.next == null || instruction.next.page.invalid) {
						instruction.next = this.loadInstruction(gprs[ARMRegs.PC] - this.instructionWidth);
					}
					this.instruction = instruction.next;
				}
			} else {
				this.instruction = null;
			}
		}
		this.irq.updateTimers();
	};
};

ARMCore.prototype.freeze = function() : ARMCoreState {
	return {
		PC: this.gprs[15] - this.instructionWidth,
		SP: this.gprs[13],
		'gprs': [
			this.gprs[0],
			this.gprs[1],
			this.gprs[2],
			this.gprs[3],
			this.gprs[4],
			this.gprs[5],
			this.gprs[6],
			this.gprs[7],
			this.gprs[8],
			this.gprs[9],
			this.gprs[10],
			this.gprs[11],
			this.gprs[12],
			this.gprs[13],
			this.gprs[14],
			this.gprs[15],
		],
		'mode': this.mode,
		'cpsrI': this.cpsrI,
		'cpsrF': this.cpsrF,
		'cpsrV': this.cpsrV,
		'cpsrC': this.cpsrC,
		'cpsrZ': this.cpsrZ,
		'cpsrN': this.cpsrN,
		'bankedRegisters': [
			[
				this.bankedRegisters[0][0],
				this.bankedRegisters[0][1],
				this.bankedRegisters[0][2],
				this.bankedRegisters[0][3],
				this.bankedRegisters[0][4],
				this.bankedRegisters[0][5],
				this.bankedRegisters[0][6]
			],
			[
				this.bankedRegisters[1][0],
				this.bankedRegisters[1][1],
				this.bankedRegisters[1][2],
				this.bankedRegisters[1][3],
				this.bankedRegisters[1][4],
				this.bankedRegisters[1][5],
				this.bankedRegisters[1][6]
			],
			[
				this.bankedRegisters[2][0],
				this.bankedRegisters[2][1]
			],
			[
				this.bankedRegisters[3][0],
				this.bankedRegisters[3][1]
			],
			[
				this.bankedRegisters[4][0],
				this.bankedRegisters[4][1]
			],
			[
				this.bankedRegisters[5][0],
				this.bankedRegisters[5][1]
			]
		],
		'spsr': this.spsr,
		'bankedSPSRs': [
			this.bankedSPSRs[0],
			this.bankedSPSRs[1],
			this.bankedSPSRs[2],
			this.bankedSPSRs[3],
			this.bankedSPSRs[4],
			this.bankedSPSRs[5]
		],
		'cycles': this.cycles,
		'instructionWidth': this.instructionWidth,
	};
};

ARMCore.prototype.defrost = function(frost: ARMCoreState) {
	this.instruction = null;

	this.page = null;
	this.pageId = 0;
	this.pageRegion = -1;

	this.gprs[0] = frost.gprs[0];
	this.gprs[1] = frost.gprs[1];
	this.gprs[2] = frost.gprs[2];
	this.gprs[3] = frost.gprs[3];
	this.gprs[4] = frost.gprs[4];
	this.gprs[5] = frost.gprs[5];
	this.gprs[6] = frost.gprs[6];
	this.gprs[7] = frost.gprs[7];
	this.gprs[8] = frost.gprs[8];
	this.gprs[9] = frost.gprs[9];
	this.gprs[10] = frost.gprs[10];
	this.gprs[11] = frost.gprs[11];
	this.gprs[12] = frost.gprs[12];
	this.gprs[13] = frost.gprs[13];
	this.gprs[14] = frost.gprs[14];
	this.gprs[15] = frost.gprs[15];

	this.mode = frost.mode;
	this.cpsrI = frost.cpsrI;
	this.cpsrF = frost.cpsrF;
	this.cpsrV = frost.cpsrV;
	this.cpsrC = frost.cpsrC;
	this.cpsrZ = frost.cpsrZ;
	this.cpsrN = frost.cpsrN;

	this.bankedRegisters[0][0] = frost.bankedRegisters[0][0];
	this.bankedRegisters[0][1] = frost.bankedRegisters[0][1];
	this.bankedRegisters[0][2] = frost.bankedRegisters[0][2];
	this.bankedRegisters[0][3] = frost.bankedRegisters[0][3];
	this.bankedRegisters[0][4] = frost.bankedRegisters[0][4];
	this.bankedRegisters[0][5] = frost.bankedRegisters[0][5];
	this.bankedRegisters[0][6] = frost.bankedRegisters[0][6];

	this.bankedRegisters[1][0] = frost.bankedRegisters[1][0];
	this.bankedRegisters[1][1] = frost.bankedRegisters[1][1];
	this.bankedRegisters[1][2] = frost.bankedRegisters[1][2];
	this.bankedRegisters[1][3] = frost.bankedRegisters[1][3];
	this.bankedRegisters[1][4] = frost.bankedRegisters[1][4];
	this.bankedRegisters[1][5] = frost.bankedRegisters[1][5];
	this.bankedRegisters[1][6] = frost.bankedRegisters[1][6];

	this.bankedRegisters[2][0] = frost.bankedRegisters[2][0];
	this.bankedRegisters[2][1] = frost.bankedRegisters[2][1];

	this.bankedRegisters[3][0] = frost.bankedRegisters[3][0];
	this.bankedRegisters[3][1] = frost.bankedRegisters[3][1];

	this.bankedRegisters[4][0] = frost.bankedRegisters[4][0];
	this.bankedRegisters[4][1] = frost.bankedRegisters[4][1];

	this.bankedRegisters[5][0] = frost.bankedRegisters[5][0];
	this.bankedRegisters[5][1] = frost.bankedRegisters[5][1];

	this.spsr = frost.spsr;
	this.bankedSPSRs[0] = frost.bankedSPSRs[0];
	this.bankedSPSRs[1] = frost.bankedSPSRs[1];
	this.bankedSPSRs[2] = frost.bankedSPSRs[2];
	this.bankedSPSRs[3] = frost.bankedSPSRs[3];
	this.bankedSPSRs[4] = frost.bankedSPSRs[4];
	this.bankedSPSRs[5] = frost.bankedSPSRs[5];

	this.cycles = frost.cycles;

	this.instructionWidth = frost.instructionWidth;
	this.loadInstruction = frost.instructionWidth == 2 ? this.loadInstructionThumb : this.loadInstructionArm;
	this.execMode = frost.instructionWidth == 2 ? ARMMode.MODE_THUMB : ARMMode.MODE_ARM;
};

ARMCore.prototype.fetchPage = function(address : number) {
	var mmu = this.mmu;
	var region = address >>> mmu.BASE_OFFSET;
	var pageId = mmu.addressToPage(region, address & mmu.OFFSET_MASK);
	if (region == this.pageRegion) {
		if (pageId == this.pageId && !(this.page as ARMMemoryPage).invalid) {
			return;
		}
		this.pageId = pageId;
	} else {
		this.pageMask = mmu.memory[region].PAGE_MASK;
		this.pageRegion = region;
		this.pageId = pageId;
	}

	this.page = mmu.accessPage(region, pageId);
};

ARMCore.prototype.loadInstructionArm = function(address : number) {
	var next : ARMOperation = null;
	this.fetchPage(address);
	var offset = (address & this.pageMask) >> 2;
	next = (this.page as ARMMemoryPage).arm[offset];
	if (next) {
		return next;
	}
	var instruction = this.mmu.load32(address) >>> 0;
	next = this.compileArm(instruction);
	next.next = null;
	next.page = this.page;
	next.address = address;
	next.opcode = instruction;
	(this.page as ARMMemoryPage).arm[offset] = next;
	return next;
};

ARMCore.prototype.loadInstructionThumb = function(address : number) {
	var next : ARMOperation  = null;
	this.fetchPage(address);
	var offset = (address & this.pageMask) >> 1;
	next = (this.page as ARMMemoryPage).thumb[offset];
	if (next) {
		return next;
	}
	var instruction = this.mmu.load16(address);
	next = this.compileThumb(instruction);
	next.next = null;
	next.page = this.page;
	next.address = address;
	next.opcode = instruction;
	(this.page as ARMMemoryPage).thumb[offset] = next;
	return next;
};

ARMCore.prototype.selectBank = function(mode : ARMMode) {
	switch (mode) {
	case ARMMode.MODE_USER:
	case ARMMode.MODE_SYSTEM:
		// No banked registers
		return ARMConstants.BANK_NONE;
	case ARMMode.MODE_FIQ:
		return ARMConstants.BANK_FIQ;
	case ARMMode.MODE_IRQ:
		return ARMConstants.BANK_IRQ;
	case ARMMode.MODE_SUPERVISOR:
		return ARMConstants.BANK_SUPERVISOR;
	case ARMMode.MODE_ABORT:
		return ARMConstants.BANK_ABORT;
	case ARMMode.MODE_UNDEFINED:
		return ARMConstants.BANK_UNDEFINED;
	default:
		throw new EmuHalt("Invalid user mode " + mode + " passed to selectBank");
	}
};

ARMCore.prototype.switchExecMode = function(newMode) {
	if (this.execMode != newMode) {
		this.execMode = newMode;
		if (newMode == ARMMode.MODE_ARM) {
			this.instructionWidth = ARMConstants.WORD_SIZE_ARM;
			this.loadInstruction = this.loadInstructionArm;
		} else {
			this.instructionWidth = ARMConstants.WORD_SIZE_THUMB;
			this.loadInstruction = this.loadInstructionThumb;
		}
	}
	
};

ARMCore.prototype.switchMode = function(newMode) {
	if (newMode == this.mode) {
		// Not switching modes after all
		return;
	}
	if (newMode != ARMMode.MODE_USER || newMode != ARMMode.MODE_SYSTEM) {
		// Switch banked registers
		var newBank = this.selectBank(newMode);
		var oldBank = this.selectBank(this.mode);
		if (newBank != oldBank) {
			// TODO: support FIQ
			if (newMode == ARMMode.MODE_FIQ || this.mode == ARMMode.MODE_FIQ) {
				var oldFiqBank = (oldBank == ARMConstants.BANK_FIQ) ? 1 : 0;
				var newFiqBank = (newBank == ARMConstants.BANK_FIQ) ? 1 : 0;
				this.bankedRegisters[oldFiqBank][2] = this.gprs[8];
				this.bankedRegisters[oldFiqBank][3] = this.gprs[9];
				this.bankedRegisters[oldFiqBank][4] = this.gprs[10];
				this.bankedRegisters[oldFiqBank][5] = this.gprs[11];
				this.bankedRegisters[oldFiqBank][6] = this.gprs[12];
				this.gprs[8] = this.bankedRegisters[newFiqBank][2];
				this.gprs[9] = this.bankedRegisters[newFiqBank][3];
				this.gprs[10] = this.bankedRegisters[newFiqBank][4];
				this.gprs[11] = this.bankedRegisters[newFiqBank][5];
				this.gprs[12] = this.bankedRegisters[newFiqBank][6];
			}
			this.bankedRegisters[oldBank][0] = this.gprs[ARMRegs.SP];
			this.bankedRegisters[oldBank][1] = this.gprs[ARMRegs.LR];
			this.gprs[ARMRegs.SP] = this.bankedRegisters[newBank][0];
			this.gprs[ARMRegs.LR] = this.bankedRegisters[newBank][1];

			this.bankedSPSRs[oldBank] = this.spsr;
			this.spsr = this.bankedSPSRs[newBank];
		}
	}
	this.mode = newMode;
};

ARMCore.prototype.packCPSR = function() {
	return this.mode | (this.execMode << 5) | (this.cpsrF << 6) | (this.cpsrI << 7) |
	       (this.cpsrN << 31) | (this.cpsrZ << 30) | (this.cpsrC << 29) | (this.cpsrV << 28);
};

ARMCore.prototype.unpackCPSR = function(spsr) {
	this.switchMode(spsr & 0x0000001F);
	this.switchExecMode(!!(spsr & 0x00000020));
	this.cpsrF = spsr & 0x00000040;
	this.cpsrI = spsr & 0x00000080;
	this.cpsrN = spsr & 0x80000000;
	this.cpsrZ = spsr & 0x40000000;
	this.cpsrC = spsr & 0x20000000;
	this.cpsrV = spsr & 0x10000000;

	this.irq.testIRQ();
};

ARMCore.prototype.hasSPSR = function() {
	return this.mode != ARMMode.MODE_SYSTEM && this.mode != ARMMode.MODE_USER;
};

ARMCore.prototype.raiseIRQ = function() {
	if (this.cpsrI) {
		return;
	}
	var cpsr = this.packCPSR();
	var instructionWidth = this.instructionWidth;
	this.switchMode(ARMMode.MODE_IRQ);
	this.spsr = cpsr;
	this.gprs[ARMRegs.LR] = this.gprs[ARMRegs.PC] - instructionWidth + 4;
	this.gprs[ARMRegs.PC] = this.BASE_IRQ + ARMConstants.WORD_SIZE_ARM;
	this.instruction = null;
	this.switchExecMode(ARMMode.MODE_ARM);
	this.cpsrI = true;
};

ARMCore.prototype.raiseTrap = function() {
	var cpsr = this.packCPSR();
	var instructionWidth = this.instructionWidth;
	this.switchMode(ARMMode.MODE_SUPERVISOR);
	this.spsr = cpsr;
	this.gprs[ARMRegs.LR] = this.gprs[ARMRegs.PC] - instructionWidth;
	this.gprs[ARMRegs.PC] = this.BASE_SWI + ARMConstants.WORD_SIZE_ARM;
	this.instruction = null;
	this.switchExecMode(ARMMode.MODE_ARM);
	this.cpsrI = true;
};

ARMCore.prototype.badOp = function(instruction) {
	var func : AddressFunction = function() {
		throw new EmuHalt("Illegal instruction: 0x" + instruction.toString(16));
	};
	func.writesPC = true;
	func.fixedJump = false;
	return func;
};

ARMCore.prototype.generateConds = function() {
	var cpu = this;
	this.conds = [
		// EQ
		function() {
			return cpu.conditionPassed = cpu.cpsrZ;
		},
		// NE
		function() {
			return cpu.conditionPassed = !cpu.cpsrZ;
		},
		// CS
		function() {
			return cpu.conditionPassed = cpu.cpsrC;
		},
		// CC
		function() {
			return cpu.conditionPassed = !cpu.cpsrC;
		},
		// MI
		function() {
			return cpu.conditionPassed = cpu.cpsrN;
		},
		// PL
		function() {
			return cpu.conditionPassed = !cpu.cpsrN;
		},
		// VS
		function() {
			return cpu.conditionPassed = cpu.cpsrV;
		},
		// VC
		function() {
			return cpu.conditionPassed = !cpu.cpsrV;
		},
		// HI
		function () {
			return cpu.conditionPassed = cpu.cpsrC && !cpu.cpsrZ;
		},
		// LS
		function () {
			return cpu.conditionPassed = !cpu.cpsrC || cpu.cpsrZ;
		},
		// GE
		function () {
			return cpu.conditionPassed = !cpu.cpsrN == !cpu.cpsrV;
		},
		// LT
		function () {
			return cpu.conditionPassed = !cpu.cpsrN != !cpu.cpsrV;
		},
		// GT
		function () {
			return cpu.conditionPassed = !cpu.cpsrZ && !cpu.cpsrN == !cpu.cpsrV;
		},
		// LE
		function () {
			return cpu.conditionPassed = cpu.cpsrZ || !cpu.cpsrN != !cpu.cpsrV;
		},
		// AL
		null,
		null
	]
}

ARMCore.prototype.barrelShiftImmediate = function(shiftType, immediate, rm) {
	var cpu = this;
	var gprs = this.gprs;
	var shiftOp = this.badOp;
	switch (shiftType) {
	case 0x00000000:
		// LSL
		if (immediate) {
			shiftOp = function() {
				cpu.shifterOperand = gprs[rm] << immediate;
				cpu.shifterCarryOut = gprs[rm] & (1 << (32 - immediate));
			};
		} else {
			// This boils down to no shift
			shiftOp = function() {
				cpu.shifterOperand = gprs[rm];
				cpu.shifterCarryOut = cpu.cpsrC;
			};
		}
		break;
	case 0x00000020:
		// LSR
		if (immediate) {
			shiftOp = function() {
				cpu.shifterOperand = gprs[rm] >>> immediate;
				cpu.shifterCarryOut = gprs[rm] & (1 << (immediate - 1));
			};
		} else {
			shiftOp = function() {
				cpu.shifterOperand = 0;
				cpu.shifterCarryOut = gprs[rm] & 0x80000000;
			};
		}
		break;
	case 0x00000040:
		// ASR
		if (immediate) {
			shiftOp = function() {
				cpu.shifterOperand = gprs[rm] >> immediate;
				cpu.shifterCarryOut = gprs[rm] & (1 << (immediate - 1));
			};
		} else {
			shiftOp = function() {
				cpu.shifterCarryOut = gprs[rm] & 0x80000000;
				if (cpu.shifterCarryOut) {
					cpu.shifterOperand = 0xFFFFFFFF;
				} else {
					cpu.shifterOperand = 0;
				}
			};
		}
		break;
	case 0x00000060:
		// ROR
		if (immediate) {
			shiftOp = function() {
				cpu.shifterOperand = (gprs[rm] >>> immediate) | (gprs[rm] << (32 - immediate));
				cpu.shifterCarryOut = gprs[rm] & (1 << (immediate - 1));
			};
		} else {
			// RRX
			shiftOp = function() {
				cpu.shifterOperand = ((cpu.cpsrC ? 1 : 0) << 31) | (gprs[rm] >>> 1);
				cpu.shifterCarryOut =  gprs[rm] & 0x00000001;
			};
		}
		break;
	}
	return shiftOp;
}

ARMCore.prototype.compileArm = function(instruction) {
	var op = this.badOp(instruction);
	var i = instruction & 0x0E000000;
	var cpu = this;
	var gprs = this.gprs;

	var condOp = this.conds[(instruction & 0xF0000000) >>> 28];
	if ((instruction & 0x0FFFFFF0) == 0x012FFF10) {
		// BX
		var rm = instruction & 0xF;
		op = this.armCompiler.constructBX(rm, condOp);
		op.writesPC = true;
		op.fixedJump = false;
	} else if (!(instruction & 0x0C000000) && (i == 0x02000000 || (instruction & 0x00000090) != 0x00000090)) {
		var opcode = instruction & 0x01E00000;
		var s = instruction & 0x00100000;
		var shiftsRs = false;
		if ((opcode & 0x01800000) == 0x01000000 && !s) {
			var r = instruction & 0x00400000;
			if ((instruction & 0x00B0F000) == 0x0020F000) {
				// MSR
				var rm = instruction & 0x0000000F;
				var immediate = instruction & 0x000000FF;
				var rotateImm = (instruction & 0x00000F00) >> 7;
				immediate = (immediate >>> rotateImm) | (immediate << (32 - rotateImm));
				op = this.armCompiler.constructMSR(rm, r, instruction, immediate, condOp);
				op.writesPC = false;
			} else if ((instruction & 0x00BF0000) == 0x000F0000) {
				// MRS
				var rd = (instruction & 0x0000F000) >> 12;
				op = this.armCompiler.constructMRS(rd, r, condOp);
				op.writesPC = rd == ARMRegs.PC;
			}
		} else {
			// Data processing/FSR transfer
			var rn = (instruction & 0x000F0000) >> 16;
			var rd = (instruction & 0x0000F000) >> 12;

			// Parse shifter operand
			var shiftType = instruction & 0x00000060;
			var rm = instruction & 0x0000000F;
			var shiftOp = function() {
				throw new EmuHalt('BUG: invalid barrel shifter');
			};
			if (instruction & 0x02000000) {
				var immediate = instruction & 0x000000FF;
				var rotate = (instruction & 0x00000F00) >> 7;
				if (!rotate) {
					shiftOp = this.armCompiler.constructAddressingMode1Immediate(immediate);
				} else {
					shiftOp = this.armCompiler.constructAddressingMode1ImmediateRotate(immediate, rotate);
				}
			} else if (instruction & 0x00000010) {
				var rs = (instruction & 0x00000F00) >> 8;
				shiftsRs = true;
				switch (shiftType) {
				case 0x00000000:
					// LSL
					shiftOp = this.armCompiler.constructAddressingMode1LSL(rs, rm);
					break;
				case 0x00000020:
					// LSR
					shiftOp = this.armCompiler.constructAddressingMode1LSR(rs, rm);
					break;
				case 0x00000040:
					// ASR
					shiftOp = this.armCompiler.constructAddressingMode1ASR(rs, rm);
					break;
				case 0x00000060:
					// ROR
					shiftOp = this.armCompiler.constructAddressingMode1ROR(rs, rm);
					break;
				}
			} else {
				var immediate = (instruction & 0x00000F80) >> 7;
				shiftOp = this.barrelShiftImmediate(shiftType, immediate, rm);
			}

			switch (opcode) {
			case 0x00000000:
				// AND
				if (s) {
					op = this.armCompiler.constructANDS(rd, rn, shiftOp, condOp);
				} else {
					op = this.armCompiler.constructAND(rd, rn, shiftOp, condOp);
				}
				break;
			case 0x00200000:
				// EOR
				if (s) {
					op = this.armCompiler.constructEORS(rd, rn, shiftOp, condOp);
				} else {
					op = this.armCompiler.constructEOR(rd, rn, shiftOp, condOp);
				}
				break;
			case 0x00400000:
				// SUB
				if (s) {
					op = this.armCompiler.constructSUBS(rd, rn, shiftOp, condOp);
				} else {
					op = this.armCompiler.constructSUB(rd, rn, shiftOp, condOp);
				}
				break;
			case 0x00600000:
				// RSB
				if (s) {
					op = this.armCompiler.constructRSBS(rd, rn, shiftOp, condOp);
				} else {
					op = this.armCompiler.constructRSB(rd, rn, shiftOp, condOp);
				}
				break;
			case 0x00800000:
				// ADD
				if (s) {
					op = this.armCompiler.constructADDS(rd, rn, shiftOp, condOp);
				} else {
					op = this.armCompiler.constructADD(rd, rn, shiftOp, condOp);
				}
				break;
			case 0x00A00000:
				// ADC
				if (s) {
					op = this.armCompiler.constructADCS(rd, rn, shiftOp, condOp);
				} else {
					op = this.armCompiler.constructADC(rd, rn, shiftOp, condOp);
				}
				break;
			case 0x00C00000:
				// SBC
				if (s) {
					op = this.armCompiler.constructSBCS(rd, rn, shiftOp, condOp);
				} else {
					op = this.armCompiler.constructSBC(rd, rn, shiftOp, condOp);
				}
				break;
			case 0x00E00000:
				// RSC
				if (s) {
					op = this.armCompiler.constructRSCS(rd, rn, shiftOp, condOp);
				} else {
					op = this.armCompiler.constructRSC(rd, rn, shiftOp, condOp);
				}
				break;
			case 0x01000000:
				// TST
				op = this.armCompiler.constructTST(rd, rn, shiftOp, condOp);
				break;
			case 0x01200000:
				// TEQ
				op = this.armCompiler.constructTEQ(rd, rn, shiftOp, condOp);
				break;
			case 0x01400000:
				// CMP
				op = this.armCompiler.constructCMP(rd, rn, shiftOp, condOp);
				break;
			case 0x01600000:
				// CMN
				op = this.armCompiler.constructCMN(rd, rn, shiftOp, condOp);
				break;
			case 0x01800000:
				// ORR
				if (s) {
					op = this.armCompiler.constructORRS(rd, rn, shiftOp, condOp);
				} else {
					op = this.armCompiler.constructORR(rd, rn, shiftOp, condOp);
				}
				break;
			case 0x01A00000:
				// MOV
				if (s) {
					op = this.armCompiler.constructMOVS(rd, rn, shiftOp, condOp);
				} else {
					op = this.armCompiler.constructMOV(rd, rn, shiftOp, condOp);
				}
				break;
			case 0x01C00000:
				// BIC
				if (s) {
					op = this.armCompiler.constructBICS(rd, rn, shiftOp, condOp);
				} else {
					op = this.armCompiler.constructBIC(rd, rn, shiftOp, condOp);
				}
				break;
			case 0x01E00000:
				// MVN
				if (s) {
					op = this.armCompiler.constructMVNS(rd, rn, shiftOp, condOp);
				} else {
					op = this.armCompiler.constructMVN(rd, rn, shiftOp, condOp);
				}
				break;
			}
			op.writesPC = rd == ARMRegs.PC;
		}
	} else if ((instruction & 0x0FB00FF0) == 0x01000090) {
		// Single data swap
		var rm = instruction & 0x0000000F;
		var rd = (instruction >> 12) & 0x0000000F;
		var rn = (instruction >> 16) & 0x0000000F;
		if (instruction & 0x00400000) {
			op = this.armCompiler.constructSWPB(rd, rn, rm, condOp);
		} else {
			op = this.armCompiler.constructSWP(rd, rn, rm, condOp);
		}
		op.writesPC = rd == ARMRegs.PC;
	} else {
		switch (i) {
		case 0x00000000:
			if ((instruction & 0x010000F0) == 0x00000090) {
				// Multiplies
				var rd = (instruction & 0x000F0000) >> 16;
				var rn = (instruction & 0x0000F000) >> 12;
				var rs = (instruction & 0x00000F00) >> 8;
				var rm = instruction & 0x0000000F;
				switch (instruction & 0x00F00000) {
				case 0x00000000:
					// MUL
					op = this.armCompiler.constructMUL(rd, rs, rm, condOp);
					break;
				case 0x00100000:
					// MULS
					op = this.armCompiler.constructMULS(rd, rs, rm, condOp);
					break;
				case 0x00200000:
					// MLA
					op = this.armCompiler.constructMLA(rd, rn, rs, rm, condOp);
					break
				case 0x00300000:
					// MLAS
					op = this.armCompiler.constructMLAS(rd, rn, rs, rm, condOp);
					break;
				case 0x00800000:
					// UMULL
					op = this.armCompiler.constructUMULL(rd, rn, rs, rm, condOp);
					break;
				case 0x00900000:
					// UMULLS
					op = this.armCompiler.constructUMULLS(rd, rn, rs, rm, condOp);
					break;
				case 0x00A00000:
					// UMLAL
					op = this.armCompiler.constructUMLAL(rd, rn, rs, rm, condOp);
					break;
				case 0x00B00000:
					// UMLALS
					op = this.armCompiler.constructUMLALS(rd, rn, rs, rm, condOp);
					break;
				case 0x00C00000:
					// SMULL
					op = this.armCompiler.constructSMULL(rd, rn, rs, rm, condOp);
					break;
				case 0x00D00000:
					// SMULLS
					op = this.armCompiler.constructSMULLS(rd, rn, rs, rm, condOp);
					break;
				case 0x00E00000:
					// SMLAL
					op = this.armCompiler.constructSMLAL(rd, rn, rs, rm, condOp);
					break;
				case 0x00F00000:
					// SMLALS
					op = this.armCompiler.constructSMLALS(rd, rn, rs, rm, condOp);
					break;
				}
				op.writesPC = rd == ARMRegs.PC;
			} else {
				// Halfword and signed byte data transfer
				var load = instruction & 0x00100000;
				var rd = (instruction & 0x0000F000) >> 12;
				var hiOffset = (instruction & 0x00000F00) >> 4;
				var loOffset = rm = instruction & 0x0000000F;
				var h = instruction & 0x00000020;
				var s = instruction & 0x00000040;
				var w = instruction & 0x00200000;
				var i = instruction & 0x00400000;

				var address : AddressFunction;
				if (i) {
					var immediate = loOffset | hiOffset;
					address = this.armCompiler.constructAddressingMode23Immediate(instruction, immediate, condOp);
				} else {
					address = this.armCompiler.constructAddressingMode23Register(instruction, rm, condOp);
				}
				address.writesPC = !!w && rn == ARMRegs.PC;

				if ((instruction & 0x00000090) == 0x00000090) {
					if (load) {
						// Load [signed] halfword/byte
						if (h) {
							if (s) {
								// LDRSH
								op = this.armCompiler.constructLDRSH(rd, address, condOp);
							} else {
								// LDRH
								op = this.armCompiler.constructLDRH(rd, address, condOp);
							}
						} else {
							if (s) {
								// LDRSB
								op = this.armCompiler.constructLDRSB(rd, address, condOp);
							}
						}
					} else if (!s && h) {
						// STRH
						op = this.armCompiler.constructSTRH(rd, address, condOp);
					}
				}
				op.writesPC = rd == ARMRegs.PC || address.writesPC;
			}
			break;
		case 0x04000000:
		case 0x06000000:
			// LDR/STR
			var rd = (instruction & 0x0000F000) >> 12;
			var load = instruction & 0x00100000;
			var b = instruction & 0x00400000;
			var i = instruction & 0x02000000;

			var address : AddressFunction = function() {
				throw new EmuHalt("Unimplemented memory access: 0x" + instruction.toString(16));
			};
			if (~instruction & 0x01000000) {
				// Clear the W bit if the P bit is clear--we don't support memory translation, so these turn into regular accesses
				instruction &= 0xFFDFFFFF;
			}
			if (i) {
				// Register offset
				var rm = instruction & 0x0000000F;
				var shiftType = instruction & 0x00000060;
				var shiftImmediate = (instruction & 0x00000F80) >> 7;
				
				if (shiftType || shiftImmediate) {
					shiftOp = this.barrelShiftImmediate(shiftType, shiftImmediate, rm);
					address = this.armCompiler.constructAddressingMode2RegisterShifted(instruction, shiftOp, condOp);
				} else {
					address = this.armCompiler.constructAddressingMode23Register(instruction, rm, condOp);
				}
			} else {
				// Immediate
				var offset = instruction & 0x00000FFF;
				address = this.armCompiler.constructAddressingMode23Immediate(instruction, offset, condOp);
			}
			if (load) {
				if (b) {
					// LDRB
					op = this.armCompiler.constructLDRB(rd, address, condOp);
				} else {
					// LDR
					op = this.armCompiler.constructLDR(rd, address, condOp);
				}
			} else {
				if (b) {
					// STRB
					op = this.armCompiler.constructSTRB(rd, address, condOp);
				} else {
					// STR
					op = this.armCompiler.constructSTR(rd, address, condOp);
				}
			}
			op.writesPC = load && (rd == ARMRegs.PC || address.writesPC); // SEH
			break;
		case 0x08000000:
			// Block data transfer
			var load = instruction & 0x00100000;
			var w = instruction & 0x00200000;
			var user = instruction & 0x00400000;
			var u = instruction & 0x00800000;
			var p = instruction & 0x01000000;
			var rs = instruction & 0x0000FFFF;
			var rn = (instruction & 0x000F0000) >> 16;

			var address : AddressFunction;
			var immediate = 0;
			var offset = 0;
			var overlap = false;
			if (u) {
				if (p) {
					immediate = 4;
				}
				for (var m = 0x01, i = 0; i < 16; m <<= 1, ++i) {
					if (rs & m) {
						if (w && i == rn && !offset) {
							rs &= ~m;
							immediate += 4;
							overlap = true;
						}
						offset += 4;
					}
				}
			} else {
				if (!p) {
					immediate = 4;
				}
				for (var m = 0x01, i = 0; i < 16; m <<= 1, ++i) {
					if (rs & m) {
						if (w && i == rn && !offset) {
							rs &= ~m;
							immediate += 4;
							overlap = true;
						}
						immediate -= 4;
						offset -= 4;
					}
				}
			}
			if (w) {
				address = this.armCompiler.constructAddressingMode4Writeback(immediate, offset, rn, overlap);
			} else {
				address = this.armCompiler.constructAddressingMode4(immediate, rn);
			}
			if (load) {
				// LDM
				if (user) {
					op = this.armCompiler.constructLDMS(rs, address, condOp);
				} else {
					op = this.armCompiler.constructLDM(rs, address, condOp);
				}
				op.writesPC = !!(rs & (1 << 15));
			} else {
				// STM
				if (user) {
					op = this.armCompiler.constructSTMS(rs, address, condOp);
				} else {
					op = this.armCompiler.constructSTM(rs, address, condOp);
				}
				op.writesPC = false;
			}
			break;
		case 0x0A000000:
			// Branch
			var immediate = instruction & 0x00FFFFFF;
			if (immediate & 0x00800000) {
				immediate |= 0xFF000000;
			}
			immediate <<= 2;
			var link = instruction & 0x01000000;
			if (link) {
				op = this.armCompiler.constructBL(immediate, condOp);
			} else {
				op = this.armCompiler.constructB(immediate, condOp);
			}
			op.writesPC = true;
			op.fixedJump = true;
			break;
		case 0x0C000000:
			// Coprocessor data transfer
			break;
		case 0x0E000000:
			// Coprocessor data operation/SWI
			if ((instruction & 0x0F000000) == 0x0F000000) {
				// SWI
				var immediate = (instruction & 0x00FFFFFF);
				op = this.armCompiler.constructSWI(immediate, condOp);
				op.writesPC = false;
			}
			break;
		default:
			throw new EmuHalt('Bad opcode: 0x' + instruction.toString(16));
		}
	}

	op.execMode = ARMMode.MODE_ARM;
	op.fixedJump = op.fixedJump || false;
	return op;
};

ARMCore.prototype.compileThumb = function(instruction) {
	var op = this.badOp(instruction & 0xFFFF);
	var cpu = this;
	var gprs = this.gprs;
	if ((instruction & 0xFC00) == 0x4000) {
		// Data-processing register
		var rm = (instruction & 0x0038) >> 3;
		var rd = instruction & 0x0007;
		switch (instruction & 0x03C0) {
		case 0x0000:
			// AND
			op = this.thumbCompiler.constructAND(rd, rm);
			break;
		case 0x0040:
			// EOR
			op = this.thumbCompiler.constructEOR(rd, rm);
			break;
		case 0x0080:
			// LSL(2)
			op = this.thumbCompiler.constructLSL2(rd, rm);
			break;
		case 0x00C0:
			// LSR(2)
			op = this.thumbCompiler.constructLSR2(rd, rm);
			break;
		case 0x0100:
			// ASR(2)
			op = this.thumbCompiler.constructASR2(rd, rm);
			break;
		case 0x0140:
			// ADC
			op = this.thumbCompiler.constructADC(rd, rm);
			break;
		case 0x0180:
			// SBC
			op = this.thumbCompiler.constructSBC(rd, rm);
			break;
		case 0x01C0:
			// ROR
			op = this.thumbCompiler.constructROR(rd, rm);
			break;
		case 0x0200:
			// TST
			op = this.thumbCompiler.constructTST(rd, rm);
			break;
		case 0x0240:
			// NEG
			op = this.thumbCompiler.constructNEG(rd, rm);
			break;
		case 0x0280:
			// CMP(2)
			op = this.thumbCompiler.constructCMP2(rd, rm);
			break;
		case 0x02C0:
			// CMN
			op = this.thumbCompiler.constructCMN(rd, rm);
			break;
		case 0x0300:
			// ORR
			op = this.thumbCompiler.constructORR(rd, rm);
			break;
		case 0x0340:
			// MUL
			op = this.thumbCompiler.constructMUL(rd, rm);
			break;
		case 0x0380:
			// BIC
			op = this.thumbCompiler.constructBIC(rd, rm);
			break;
		case 0x03C0:
			// MVN
			op = this.thumbCompiler.constructMVN(rd, rm);
			break;
		}
		op.writesPC = false;
	} else if ((instruction & 0xFC00) == 0x4400) {
		// Special data processing / branch/exchange instruction set
		var rm = (instruction & 0x0078) >> 3;
		var rn = instruction & 0x0007;
		var h1 = instruction & 0x0080;
		var rd = rn | (h1 >> 4);
		switch (instruction & 0x0300) {
		case 0x0000:
			// ADD(4)
			op = this.thumbCompiler.constructADD4(rd, rm)
			op.writesPC = rd == ARMRegs.PC;
			break;
		case 0x0100:
			// CMP(3)
			op = this.thumbCompiler.constructCMP3(rd, rm);
			op.writesPC = false;
			break;
		case 0x0200:
			// MOV(3)
			op = this.thumbCompiler.constructMOV3(rd, rm);
			op.writesPC = rd == ARMRegs.PC;
			break;
		case 0x0300:
			// BX
			op = this.thumbCompiler.constructBX(rd, rm);
			op.writesPC = true;
			op.fixedJump = false;
			break;
		}
	} else if ((instruction & 0xF800) == 0x1800) {
		// Add/subtract
		var rm = (instruction & 0x01C0) >> 6;
		var rn = (instruction & 0x0038) >> 3;
		var rd = instruction & 0x0007;
		switch (instruction & 0x0600) {
		case 0x0000:
			// ADD(3)
			op = this.thumbCompiler.constructADD3(rd, rn, rm);
			break;
		case 0x0200:
			// SUB(3)
			op = this.thumbCompiler.constructSUB3(rd, rn, rm);
			break;
		case 0x0400:
			var immediate = (instruction & 0x01C0) >> 6;
			if (immediate) {
				// ADD(1)
				op = this.thumbCompiler.constructADD1(rd, rn, immediate);
			} else {
				// MOV(2)
				op = this.thumbCompiler.constructMOV2(rd, rn, rm);
			}
			break;
		case 0x0600:
			// SUB(1)
			var immediate = (instruction & 0x01C0) >> 6;
			op = this.thumbCompiler.constructSUB1(rd, rn, immediate);
			break;
		}
		op.writesPC = false;
	} else if (!(instruction & 0xE000)) {
		// Shift by immediate
		var rd = instruction & 0x0007;
		var rm = (instruction & 0x0038) >> 3;
		var immediate = (instruction & 0x07C0) >> 6;
		switch (instruction & 0x1800) {
		case 0x0000:
			// LSL(1)
			op = this.thumbCompiler.constructLSL1(rd, rm, immediate);
			break;
		case 0x0800:
			// LSR(1)
			op = this.thumbCompiler.constructLSR1(rd, rm, immediate);
			break;
		case 0x1000:
			// ASR(1)
			op = this.thumbCompiler.constructASR1(rd, rm, immediate);
			break;
		case 0x1800:
			break;
		}
		op.writesPC = false;
	} else if ((instruction & 0xE000) == 0x2000) {
		// Add/subtract/compare/move immediate
		var immediate = instruction & 0x00FF;
		var rn = (instruction & 0x0700) >> 8;
		switch (instruction & 0x1800) {
		case 0x0000:
			// MOV(1)
			op = this.thumbCompiler.constructMOV1(rn, immediate);
			break;
		case 0x0800:
			// CMP(1)
			op = this.thumbCompiler.constructCMP1(rn, immediate);
			break;
		case 0x1000:
			// ADD(2)
			op = this.thumbCompiler.constructADD2(rn, immediate);
			break;
		case 0x1800:
			// SUB(2)
			op = this.thumbCompiler.constructSUB2(rn, immediate);
			break;
		}
		op.writesPC = false;
	} else if ((instruction & 0xF800) == 0x4800) {
		// LDR(3)
		var rd = (instruction & 0x0700) >> 8;
		var immediate = (instruction & 0x00FF) << 2;
		op = this.thumbCompiler.constructLDR3(rd, immediate);
		op.writesPC = false;
	} else if ((instruction & 0xF000) == 0x5000) {
		// Load and store with relative offset
		var rd = instruction & 0x0007;
		var rn = (instruction & 0x0038) >> 3;
		var rm = (instruction & 0x01C0) >> 6;
		var opcode = instruction & 0x0E00;
		switch (opcode) {
		case 0x0000:
			// STR(2)
			op = this.thumbCompiler.constructSTR2(rd, rn, rm);
			break;
		case 0x0200:
			// STRH(2)
			op = this.thumbCompiler.constructSTRH2(rd, rn, rm);
			break;
		case 0x0400:
			// STRB(2)
			op = this.thumbCompiler.constructSTRB2(rd, rn, rm);
			break;
		case 0x0600:
			// LDRSB
			op = this.thumbCompiler.constructLDRSB(rd, rn, rm);
			break;
		case 0x0800:
			// LDR(2)
			op = this.thumbCompiler.constructLDR2(rd, rn, rm);
			break;
		case 0x0A00:
			// LDRH(2)
			op = this.thumbCompiler.constructLDRH2(rd, rn, rm);
			break;
		case 0x0C00:
			// LDRB(2)
			op = this.thumbCompiler.constructLDRB2(rd, rn, rm);
			break;
		case 0x0E00:
			// LDRSH
			op = this.thumbCompiler.constructLDRSH(rd, rn, rm);
			break;
		}
		op.writesPC = false;
	} else if ((instruction & 0xE000) == 0x6000) {
		// Load and store with immediate offset
		var rd = instruction & 0x0007;
		var rn = (instruction & 0x0038) >> 3;
		var immediate = (instruction & 0x07C0) >> 4;
		var b = instruction & 0x1000;
		if (b) {
			immediate >>= 2;
		}
		var load = instruction & 0x0800;
		if (load) {
			if (b) {
				// LDRB(1)
				op = this.thumbCompiler.constructLDRB1(rd, rn, immediate);
			} else {
				// LDR(1)
				op = this.thumbCompiler.constructLDR1(rd, rn, immediate);
			}
		} else {
			if (b) {
				// STRB(1)
				op = this.thumbCompiler.constructSTRB1(rd, rn, immediate);
			} else {
				// STR(1)
				op = this.thumbCompiler.constructSTR1(rd, rn, immediate);
			}
		}
		op.writesPC = false;
	} else if ((instruction & 0xF600) == 0xB400) {
		// Push and pop registers
		var r = !!(instruction & 0x0100);
		var rs = instruction & 0x00FF;
		if (instruction & 0x0800) {
			// POP
			op = this.thumbCompiler.constructPOP(rs, r);
			op.writesPC = r;
			op.fixedJump = false;
		} else {
			// PUSH
			op = this.thumbCompiler.constructPUSH(rs, r);
			op.writesPC = false;
		}
	} else if (instruction & 0x8000) {
		switch (instruction & 0x7000) {
		case 0x0000:
			// Load and store halfword
			var rd = instruction & 0x0007;
			var rn = (instruction & 0x0038) >> 3;
			var immediate = (instruction & 0x07C0) >> 5;
			if (instruction & 0x0800) {
				// LDRH(1)
				op = this.thumbCompiler.constructLDRH1(rd, rn, immediate);
			} else {
				// STRH(1)
				op = this.thumbCompiler.constructSTRH1(rd, rn, immediate);
			}
			op.writesPC = false;
			break;
		case 0x1000:
			// SP-relative load and store
			var rd = (instruction & 0x0700) >> 8;
			var immediate = (instruction & 0x00FF) << 2;
			var load = instruction & 0x0800;
			if (load) {
				// LDR(4)
				op = this.thumbCompiler.constructLDR4(rd, immediate);
			} else {
				// STR(3)
				op = this.thumbCompiler.constructSTR3(rd, immediate);
			}
			op.writesPC = false;
			break;
		case 0x2000:
			// Load address
			var rd = (instruction & 0x0700) >> 8;
			var immediate = (instruction & 0x00FF) << 2;
			if (instruction & 0x0800) {
				// ADD(6)
				op = this.thumbCompiler.constructADD6(rd, immediate);
			} else {
				// ADD(5)
				op = this.thumbCompiler.constructADD5(rd, immediate);
			}
			op.writesPC = false;
			break;
		case 0x3000:
			// Miscellaneous
			if (!(instruction & 0x0F00)) {
				// Adjust stack pointer
				// ADD(7)/SUB(4)
				var b = instruction & 0x0080;
				var immediate = (instruction & 0x7F) << 2;
				if (b) {
					immediate = -immediate;
				}
				op = this.thumbCompiler.constructADD7(immediate)
				op.writesPC = false;
			}
			break;
		case 0x4000:
			// Multiple load and store
			var rn = (instruction & 0x0700) >> 8;
			var rs = instruction & 0x00FF;
			if (instruction & 0x0800) {
				// LDMIA
				op = this.thumbCompiler.constructLDMIA(rn, rs);
			} else {
				// STMIA
				op = this.thumbCompiler.constructSTMIA(rn, rs);
			}
			op.writesPC = false;
			break;
		case 0x5000:
			// Conditional branch
			var cond = (instruction & 0x0F00) >> 8;
			var immediate = (instruction & 0x00FF);
			if (cond == 0xF) {
				// SWI
				op = this.thumbCompiler.constructSWI(immediate);
				op.writesPC = false;
			} else {
				// B(1)
				if (instruction & 0x0080) {
					immediate |= 0xFFFFFF00;
				}
				immediate <<= 1;
				var condOp = this.conds[cond];
				op = this.thumbCompiler.constructB1(immediate, condOp);
				op.writesPC = true;
				op.fixedJump = true;
			}
			break;
		case 0x6000:
		case 0x7000:
			// BL(X)
			var immediate = instruction & 0x07FF;
			var h = instruction & 0x1800;
			switch (h) {
			case 0x0000:
				// B(2)
				if (immediate & 0x0400) {
					immediate |= 0xFFFFF800;
				}
				immediate <<= 1;
				op = this.thumbCompiler.constructB2(immediate);
				op.writesPC = true;
				op.fixedJump = true;
				break;
			case 0x0800:
				// BLX (ARMv5T)
				/*op = function() {
					var pc = gprs[ARMRegs.PC];
					gprs[ARMRegs.PC] = (gprs[ARMRegs.LR] + (immediate << 1)) & 0xFFFFFFFC;
					gprs[ARMRegs.LR] = pc - 1;
					cpu.switchExecMode(cpu.MODE_ARM);
				}*/
				break;
			case 0x1000:
				// BL(1)
				if (immediate & 0x0400) {
					immediate |= 0xFFFFFC00;
				}
				immediate <<= 12;
				op = this.thumbCompiler.constructBL1(immediate);
				op.writesPC = false;
				break;
			case 0x1800:
				// BL(2)
				op = this.thumbCompiler.constructBL2(immediate);
				op.writesPC = true;
				op.fixedJump = false;
				break;
			}
			break;
		default:
			throw new EmuHalt("Undefined instruction: 0x" + instruction.toString(16));
		}
	} else {
		throw new EmuHalt('Bad opcode: 0x' + instruction.toString(16));
	}

	op.execMode = ARMMode.MODE_THUMB;
	op.fixedJump = op.fixedJump || false;
	//console.log(hex(instruction), op);
	return op;
};

///////////////////////////////////////////////////////////////////////////

export class ARM32CPU implements CPU, InstructionBased, ARMMMUInterface, ARMIRQInterface, SavesState<ARMCoreState> {

	core : ARMCoreType;
	bus : Bus;
	memory : ARMMemoryRegion[];

	BASE_OFFSET = 24;
	OFFSET_MASK = 0x00FFFFFF;

	constructor() {
		this.core = new ARMCore();
		this.core.irq = this;
		this.core.mmu = this;
		this.resetMemory();
	}
	resetMemory() {
		this.memory = []; // TODO
		for (var i=0; i<256; i++) {
			// TODO: constant
			var bits = 10;
			var size = 0x80000; 
			this.memory[i] = {
				PAGE_MASK: (2 << bits) - 1,
				ICACHE_PAGE_BITS: bits,
				icache: new Array() // size >> (bits + 1))
			 }; // TODO?
		}
	}
	advanceInsn() : number {
		var n = this.core.cycles;
		this.core.step();
		n -= this.core.cycles;
		return n > 0 ? n : 1;
	}
	getPC(): number {
		return this.core.gprs[15] - this.core.instructionWidth;
	}
	getSP(): number {
		return this.core.gprs[13];
	}
	isStable(): boolean {
		return true; // TODO?
	}
	connectMemoryBus(bus: Bus): void {
		this.bus = bus;
	}
	reset(): void {
		this.resetMemory();
		this.core.resetCPU(0);
	}
	saveState() : ARMCoreState {
		return this.core.freeze();
	}
	loadState(state: ARMCoreState): void {
		this.core.defrost(state);
	}

	load8(a: number): number {
		return (this.bus.read(a) << 24) >> 24;
	}
	loadU8(a: number): number {
		return this.bus.read(a) & 0xff;
	}
	load16(a: number): number {
		return (this.loadU16(a) << 16) >> 16;
	}
	loadU16(a: number): number {
		return this.bus.read(a) | (this.bus.read(a+1) << 8);
	}
	load32(a: number): number {
		var v = this.bus.read(a) | (this.bus.read(a+1) << 8) | (this.bus.read(a+2) << 16) | (this.bus.read(a+3) << 24);
		return v;
	}
	// TODO:         memory.invalidatePage(maskedOffset);
	store8(a: number, v: number): void {
		this.bus.write(a, v & 0xff);
	}
	store16(a: number, v: number): void {
		this.bus.write(a, v & 0xff);
		this.bus.write(a+1, (v >> 8) & 0xff);
	}
	store32(a: number, v: number): void {
		this.bus.write(a, v & 0xff);
		this.bus.write(a+1, (v >> 8) & 0xff);
		this.bus.write(a+2, (v >> 16) & 0xff);
		this.bus.write(a+3, (v >> 24) & 0xff);
	}
	// TODO
	wait(a: number): void {
		++this.core.cycles;
	}
	wait32(a: number): void {
		++this.core.cycles;
	}
	waitSeq32(a: number): void {
		++this.core.cycles;
	}
	waitMul(rs: number): void {
        if (((rs & 0xFFFFFF00) == 0xFFFFFF00) || !(rs & 0xFFFFFF00)) {
			this.core.cycles += 1;
		} else if (((rs & 0xFFFF0000) == 0xFFFF0000) || !(rs & 0xFFFF0000)) {
				this.core.cycles += 2;
		} else if (((rs & 0xFF000000) == 0xFF000000) || !(rs & 0xFF000000)) {
				this.core.cycles += 3;
		} else {
				this.core.cycles += 4;
		}
	}
	waitMulti32(a: number, total: number): void {
		this.core.cycles += 2;
	}
	waitPrefetch(a: number): void {
		++this.core.cycles;
	}
	waitPrefetch32(a: number): void {
		++this.core.cycles;
	}
	addressToPage(region: number, address: number) : number {
        return address >> this.memory[region].ICACHE_PAGE_BITS;
	}
	accessPage(region: number, pageId: number): ARMMemoryPage {
		var memory = this.memory[region];
		var page = memory.icache[pageId];
		if (!page || page.invalid) {
				page = {
						thumb: new Array(1 << (memory.ICACHE_PAGE_BITS)),
						arm: new Array(1 << memory.ICACHE_PAGE_BITS - 1),
						invalid: false
				}
				memory.icache[pageId] = page;
		}
		return page;
	}

	swi(opcode: number): void {
		this.core.raiseTrap();
	}
	swi32(opcode: number): void {
        this.swi(opcode >> 16);
	}
	clear() : void {
	}
	updateTimers() : void {
	}
	testIRQ() : void {
	}

	isThumb() : boolean {
		return this.core.instructionWidth == 2;
	}
}
