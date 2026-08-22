# Rebuild the Open ROMs compatibility object for cc65 on C64.
#
#   openroms-compat.o  - linked before c64.lib (see src/worker/platforms.ts,
#                        libargs for the 'c64' platform) so it overrides
#                        cc65 runtime routines that depend on KERNAL entry
#                        points not implemented by the Open ROMs BIOS:
#                          _cgetc  (KBDREAD $E5B4)
#                          PLOT    ($FFF0 / UPDCRAMPTR $EA24)

all: openroms-compat.o

openroms-compat.o: openroms-compat.s
	ca65 -I /Users/sehugg/8bitworkshop-compilers/cc65/asminc openroms-compat.s
