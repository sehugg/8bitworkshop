
TSC=./node_modules/typescript/bin/tsc --build

all:
	cp nanoasm/src/assembler.ts src/worker/
	$(TSC) -v
	$(TSC)
	cd jsnes && npm i

z80: src/cpu/z80fast.js

src/cpu/z80.js: src/cpu/z80.coffee
	coffee -c $<

src/cpu/z80fast.js: src/cpu/buildz80.js src/cpu/z80.js 
	node $< > $@

check:
	closure-compiler src/*.js src/cpu/*.js src/platform/*.js > /dev/null

lint:
	gjslint -r src


web:
	(ip addr || ifconfig) | grep inet
	python3 scripts/serveit.py 2>> /dev/null #http.out

tsweb:
	(ip addr || ifconfig) | grep inet
	$(TSC) -w &
	python3 scripts/serveit.py 2>> /dev/null #http.out

astrolibre.b64.txt: astrolibre.rom
	lzg -9 $< | base64 -w 0 > $@

