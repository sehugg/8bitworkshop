
TSC=./node_modules/typescript/bin/tsc --build
TMP=./tmp/dist

all:
	patch -i meta/electron.diff -o electron.html
	cp nanoasm/src/assembler.ts src/worker/
	cp node_modules/jquery/dist/jquery.min.js ./jquery/
	cp -r node_modules/bootstrap/dist/* ./bootstrap/
	cp node_modules/bootstrap-tourist/*.css node_modules/bootstrap-tourist/*.js ./lib/
	cp node_modules/clipboard/dist/clipboard.min.js ./lib/
	cp node_modules/mousetrap/mousetrap*.min.js ./lib/
	#cp node_modules/octokat/dist/octokat.js ./lib/
	cp node_modules/split.js/dist/split.min.js ./lib/
	cp node_modules/localforage/dist/localforage.min.js ./lib/
	cp node_modules/jszip/dist/jszip.min.js ./lib/
	cp node_modules/file-saver/dist/*.min.js ./lib/
	cp gif.js/dist/* ./lib/
	cd jsnes && npm i
	$(TSC) -v
	$(TSC)

dist:
	rm -fr $(TMP) && mkdir -p $(TMP)
	git archive HEAD | tar x -C $(TMP)
	cp -rp gen $(TMP)
	rm -r $(TMP)/doc $(TMP)/meta $(TMP)/scripts $(TMP)/test* $(TMP)/tools $(TMP)/.[a-z]* $(TMP)/ts*.json
	rm -f $(TMP)/javatari && mkdir -p $(TMP)/javatari && cp javatari.js/release/javatari/* $(TMP)/javatari/
	tar cf - `cat electron.html | egrep "^<(script|link)" | egrep -o '"([^"]+).(js|css)"' | cut -d '"' -f2` | tar x -C $(TMP)

%.dist:
	./node_modules/.bin/electron-packager $(TMP) --icon meta/icons/8bitworkshop-icon-1024.icns --out ./release --overwrite --platform $*

package: dist darwin.dist win32.dist linux.dist

meta/electron.diff: index.html electron.html
	-diff -u index.html electron.html > $@

web:
	(ip addr || ifconfig) | grep inet
	python3 scripts/serveit.py 2>> /dev/null #http.out

tsweb:
	(ip addr || ifconfig) | grep inet
	$(TSC) -w &
	python3 scripts/serveit.py 2>> /dev/null #http.out

astrolibre.b64.txt: astrolibre.rom
	lzg -9 $< | base64 -w 0 > $@

