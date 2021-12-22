
// http://www.cpcmania.com/Docs/Programming/Sound_I.htm

#pragma disable_warning 85 // unused parameter warning

////////////////////////////////////////////////////////////////////////
// Sound01.c
// Mochilote - www.cpcmania.com
////////////////////////////////////////////////////////////////////////
#include <stdio.h>

//Firmware requires it in the central 32K of RAM (0x4000 to 0xC000), move it as you need...
#define SOUND_BUFF 0x4FF6 //9 bytes
#define ENT_BUFF 0x4FE6 //16 bytes
#define ENV_BUFF 0x4FD6 //16 bytes

////////////////////////////////////////////////////////////////////////
//sound
////////////////////////////////////////////////////////////////////////
unsigned char bQueue = 0;
unsigned char sound(
  unsigned char nChannelStatus,
  int nTonePeriod,
  int nDuration,
  unsigned char nVolume,
  char nVolumeEnvelope,
  char nToneEnvelope, 
  unsigned char nNoisePeriod)
{
  //This function uses 9 bytes of memory for sound buffer. Firmware requires it in the central 32K of RAM (0x4000 to 0xC000)
  /*
    The bytes required to define the sound are as follows
    byte 0 - channel status byte
    byte 1 - volume envelope to use
    byte 2 - tone envelope to use
    bytes 3&4 - tone period
    byte 5 - noise period
    byte 6 - start volume
    bytes 7&8 - duration of the sound, or envelope repeat count 
  */
  
  __asm
    LD HL, #SOUND_BUFF

    LD A, 4 (IX) ;nChannelStatus
    LD (HL), A
    INC HL

    LD A, 10 (IX) ;nVolumeEnvelope
    LD (HL), A
    INC HL

    LD A, 11 (IX) ;nToneEnvelope
    LD (HL), A
    INC HL

    LD A, 5 (IX) ;nTonePeriod
    LD (HL), A
    INC HL
    LD A, 6 (IX) ;nTonePeriod
    LD (HL), A
    INC HL

    LD A, 12 (IX) ;nNoisePeriod
    LD (HL), A
    INC HL

    LD A, 9 (IX) ;nVolume
    LD (HL), A
    INC HL

    LD A, 7 (IX) ;nDuration
    LD (HL), A
    INC HL
    LD A, 8 (IX) ;nDuration
    LD (HL), A
    INC HL

    LD HL, #SOUND_BUFF
    CALL #0xBCAA ;SOUND QUEUE
  
    LD HL, #_bQueue
    LD (HL), #0
    JP NC, _EndSound
    LD (HL), #1
    _EndSound:
  __endasm;
  
  return bQueue;
}
////////////////////////////////////////////////////////////////////////


////////////////////////////////////////////////////////////////////////
//ent
////////////////////////////////////////////////////////////////////////
void ent(unsigned char nEnvelopeNumber, unsigned char nNumberOfSteps, char nTonePeriodOfStep, unsigned char nTimePerStep)
{
  //This function uses 16 bytes of memory for ent buffer. Firmware requires it in the central 32K of RAM (0x4000 to 0xC000)
  
  __asm
    LD HL, #ENT_BUFF

    LD A, #0x1
    LD (HL), A
    INC HL

    LD A, 5 (IX) ;nNumberOfSteps
    LD (HL), A
    INC HL

    LD A, 6 (IX) ;nTonePeriodOfStep
    LD (HL), A
    INC HL

    LD A, 7 (IX) ;nTimePerStep
    LD (HL), A
    INC HL

    LD A, 4 (IX) ;nEnvelopeNumber
    LD HL, #ENT_BUFF
    CALL #0xBCBF ;SOUND TONE ENVELOPE
  __endasm;
}
////////////////////////////////////////////////////////////////////////


////////////////////////////////////////////////////////////////////////
//env
////////////////////////////////////////////////////////////////////////
void env(unsigned char nEnvelopeNumber, unsigned char nNumberOfSteps, char nSizeOfStep, unsigned char nTimePerStep)
{
  //This function uses 16 bytes of memory for env buffer. Firmware requires it in the central 32K of RAM (0x4000 to 0xC000)
  
  __asm
    LD HL, #ENV_BUFF

    LD A, #0x1
    LD (HL), A
    INC HL

    LD A, 5 (IX) ;nNumberOfSteps
    LD (HL), A
    INC HL

    LD A, 6 (IX) ;nSizeOfStep
    LD (HL), A
    INC HL

    LD A, 7 (IX) ;nTimePerStep
    LD (HL), A
    INC HL

    LD A, 4 (IX) ;nEnvelopeNumber
    LD HL, #ENV_BUFF
    CALL #0xBCBC ;SOUND AMPL ENVELOPE
  __endasm;
}
////////////////////////////////////////////////////////////////////////


////////////////////////////////////////////////////////////////////////
//soundcheck
////////////////////////////////////////////////////////////////////////
unsigned char nSoundCheck = 0;
unsigned char soundcheck(unsigned char nChannelStatus)
{
  __asm
  LD A, 4 (IX) ;nChannelStatus
  CALL #0xBCAD; SOUND CHECK
  LD HL, #_nSoundCheck
  LD (HL), A
  __endasm;
  
  return (nSoundCheck & 0x80);
}
////////////////////////////////////////////////////////////////////////

#ifdef __MAIN__

////////////////////////////////////////////////////////////////////////
//main
////////////////////////////////////////////////////////////////////////
main()
{
  int aSounds[12] = { 478, 451, 426, 402, 379, 358, 338, 319, 301, 284, 268, 253 };
  int n = 0;

  printf("1\n\r");

  for(n=0; n < 12; n++)
  {
    while(!sound(1, aSounds[n], 20, 15, 0, 0, 0));
  }

  while(soundcheck(1));
  printf("2\n\r");

  ent(1, 20, -11, 1);
  sound(1, 200, 20, 15, 0, 1, 0);

  while(soundcheck(1));
  printf("3\n\r");

  ent(1, 20, -11, 1);
  sound(1, 428, 10, 15, 0, 1, 0);

  while(soundcheck(1));
  printf("4\n\r");

  env(1, 25, 15, 5);
  ent(1, 25, 120, 6);
  sound(1, 428, 25, 15, 1, 1, 14);

  while(soundcheck(1));
  printf("5\n\r");

  sound(1, 200, 20, 15, 0, 0, 0);
  
  while(soundcheck(1));
  printf("6\n\r");
  
  env(1, 10, 1, 100);
  sound(1, 284, 1000, 1, 1, 0, 0);
  
  while(soundcheck(1));
  printf("7\n\r");

  ent(1, 100, 2, 2);
  sound(1,284,200,15,0,1,0);
  
  while(soundcheck(1));
  printf("8\n\r");

  ent(1, 100, -2, 2);
  sound(1, 284, 200, 15, 0, 1, 0);
  
  while(soundcheck(1));
  
  return 0;
}

#endif
