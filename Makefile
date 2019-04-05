
TSC=./node_modules/typescript/bin/tsc

all:
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
	ifconfig | grep inet
	python3 scripts/serveit.py 2>> http.out

tsweb:
	ifconfig | grep inet
	$(TSC) -w &
	python3 scripts/serveit.py 2>> http.out
