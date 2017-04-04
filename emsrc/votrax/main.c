
#include <unistd.h>

#include "votrax.h"

static double ratio = 1.0;
static int votrax_sync_samples = 0;
static int votrax_written = FALSE;
static int votrax_written_byte = 0x3f;
static char VOTRAXSND_busy = 0;

void VOTRAXSND_PutByte(UBYTE byte)
{
        /* put byte to voice box */
        votrax_sync_samples = (int)((1.0/ratio)*(double)Votrax_Samples((votrax_written_byte&0x3f), (byte&0x3f), votrax_sync_samples));
        votrax_written = TRUE;
        votrax_written_byte = byte;
        if (!VOTRAXSND_busy) {
                VOTRAXSND_busy = TRUE;
        }
}

int main(int argc, char** argv) {

	struct Votrax_interface interface;
	SWORD buf[2048];

	if (Votrax_Start(&interface)) {
		return 1;
	}
	VOTRAXSND_PutByte(0xc);
	Votrax_Update(0, buf, sizeof(buf)/sizeof(SWORD));
	write(STDOUT_FILENO, &buf, sizeof(buf));
	Votrax_Stop();

	return 0;
}

