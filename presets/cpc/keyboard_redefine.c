
// from https://github.com/cpcitor/cpcrslib/tree/master/examples

#include "cpcrslib.h"

void wait(void){
	__asm

	_kkk:
	ld b,#100
	llll:
	halt
	djnz llll
	__endasm;
}

main()
{
	cpc_SetModo(1);
	
	cpc_AssignKey(4,0x4804);		// key "ESC"
	
	cpc_PrintStr("Welcome to cpcrslib keyboard utilities.");
	cpc_PrintStr("Press a Key to redefine as #1");
	cpc_RedefineKey(0);		//redefine key. There are 12 available keys (0..11)
	cpc_PrintStr("Done!");


	cpc_PrintStr("Now, press any key to continue");
	while(!(cpc_AnyKeyPressed())){}

	cpc_PrintStr("Well done! Let's do it again");

	cpc_PrintStr("Press any key to continue");
	while(!(cpc_AnyKeyPressed())){}


	cpc_PrintStr("Press a Key to redefine as #3");
	cpc_RedefineKey(3);		//redefine key. There are 12 available keys (0..11)
	cpc_PrintStr("Done!");


    wait();
	cpc_SetModo(1);
	
	cpc_SetBorder(3);

	cpc_PrintStr("Now let's test the selected keys. Press ESC to EXIT");
	
	cpc_PrintStr("Press a Key to test it..");
	while (!cpc_TestKey(4)) { // IF NOT ESC is pressed
	
		if (cpc_TestKey(0)) {	//test if the key has been pressed.
			cpc_PrintStr("OK Key #1");
			}
		if (cpc_TestKey(3)) {	//test if the key has been pressed.
			cpc_PrintStr("OK Key #2");
			}
			//else cpc_PrintStr(no);
	}
	return 0;

}
