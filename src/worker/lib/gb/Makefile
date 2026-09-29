# Rebuild the GBDK runtime objects linked first into every Game Boy C
# program (startup_objs in src/worker/platforms.ts):
#
#   crt0.rel  - startup code, interrupt vectors, header (crt0.sgb, global.sgb)
#   sfr.rel   - hardware register symbols (sfr.sgb)
#
# The bundled sdasgb writes the XL3 format gb.lib uses; a system sdasgb
# (4.x) writes XL4, so build through 8bws. A project that links its own
# crt0.sgb replaces crt0.rel, which is how this build gets the sources in.
# Run npm run tsbuild first.

ROOT = ../../../..

all: crt0.rel sfr.rel

crt0.rel sfr.rel: crt0.sgb sfr.sgb global.sgb
	set -e; tmp=$$(mktemp -d "$${TMPDIR:-/tmp}/gbrt.XXXXXX"); \
	cp crt0.sgb sfr.sgb global.sgb $$tmp/; \
	printf '//#link "sfr.sgb"\n//#link "crt0.sgb"\nvoid main(void) {}\n' > $$tmp/gbrt.c; \
	saved=$$(cd $(ROOT) && node gen/tools/8bws.js build --json --platform gb --save $$tmp/gbrt.c -o $$tmp/gbrt.gb \
		| node -e 'process.stdout.write(JSON.parse(require("fs").readFileSync(0)).data.saveDir)'); \
	for f in crt0.rel crt0.lst sfr.rel sfr.lst; do cp "$$saved/$$f" .; done; \
	rm -rf $$tmp "$$saved"
