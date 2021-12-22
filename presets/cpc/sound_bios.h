
unsigned char sound(
  unsigned char nChannelStatus,
  int nTonePeriod,
  int nDuration,
  unsigned char nVolume,
  char nVolumeEnvelope,
  char nToneEnvelope, 
  unsigned char nNoisePeriod);

void ent(
  unsigned char nEnvelopeNumber,
  unsigned char nNumberOfSteps,
  char nTonePeriodOfStep,
  unsigned char nTimePerStep);

void env(
  unsigned char nEnvelopeNumber,
  unsigned char nNumberOfSteps,
  char nSizeOfStep,
  unsigned char nTimePerStep);

unsigned char soundcheck(unsigned char nChannelStatus);
