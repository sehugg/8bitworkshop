
TSC=./node_modules/typescript/bin/tsc --build
TMP=./tmp/dist

all:
	cp nanoasm/src/assembler.ts src/worker/
	$(TSC) -v
	$(TSC)
	cd jsnes && npm i
	patch -i electron.diff -o electron.html

dist:
	rm -fr $(TMP) && mkdir -p $(TMP)
	git archive HEAD | tar x -C $(TMP)
	cp -rp gen $(TMP)
	rm -r $(TMP)/doc $(TMP)/romsrc $(TMP)/scripts $(TMP)/test* $(TMP)/tools $(TMP)/electron.diff $(TMP)/.[a-z]* $(TMP)/ts*.json
	rm -f $(TMP)/javatari && mkdir -p $(TMP)/javatari && cp javatari.js/release/javatari/* $(TMP)/javatari/
	tar cf - `cat electron.html | egrep "^<(script|link)" | egrep -o '"([^"]+).(js|css)"' | cut -d '"' -f2` | tar x -C $(TMP)

%.dist:
	./node_modules/.bin/electron-packager $(TMP) --icon images/8bitworkshop-icon-1024.icns --out ./release --overwrite --platform $*

package: dist darwin.dist win32.dist linux.dist

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

