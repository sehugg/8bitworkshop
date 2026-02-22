TSC=./node_modules/typescript/bin/tsc --build
LEZER=./node_modules/.bin/lezer-generator
TMP=./tmp/dist

# Ensure node_modules is up to date.
node_modules: package.json
	npm install
	@touch node_modules

buildgrammars: node_modules
	mkdir -p gen/parser
	$(LEZER) src/parser/lang-6502.grammar -o gen/parser/lang-6502.grammar.js
	$(LEZER) src/parser/lang-z80.grammar -o gen/parser/lang-z80.grammar.js

watchgrammars:
	while true; do \
		if [ src/parser/lang-6502.grammar -nt gen/parser/lang-6502.grammar.js ] || [ src/parser/lang-z80.grammar -nt gen/parser/lang-z80.grammar.js ]; then \
			make buildgrammars; \
		fi; \
		sleep 1; \
	done

# git submodules init and update, based on submodule status prefix:
#   '-' = uninitialized
#   '+' = different commit
#   'U' = merge conflict
#   ' ' = current
submodules:
	@if git submodule status --recursive | grep -q '^[-+]'; then \
		echo "Running `git submodule update --init --recursive`"; \
		git submodule update --init --recursive; \
	fi

buildtsc: submodules buildgrammars
	npm run esbuild-clean
	$(TSC) tsconfig.json
	npm run esbuild

prepare: buildtsc
	cp node_modules/jquery/dist/jquery.min.js ./jquery/
	cp -r node_modules/bootstrap/dist/* ./bootstrap/
	cp node_modules/bootstrap-tourist/*.css node_modules/bootstrap-tourist/*.js ./lib/
	#cp ./unicorn.js/demos/externals/capstone-arm.min.js ./lib/
	cp gif.js/dist/* ./lib/
	cd jsnes && npm i

mkdoc:
	npm run mkdoc

distro: buildtsc
	rm -fr $(TMP) && mkdir -p $(TMP)
	git archive HEAD | tar x -C $(TMP)
	cp -rp gen $(TMP)
	cp -rp tss $(TMP)
	rm -r $(TMP)/doc $(TMP)/scripts $(TMP)/test* $(TMP)/tools $(TMP)/.[a-z]* $(TMP)/ts*.json # $(TMP)/meta
	rm -f $(TMP)/javatari && mkdir -p $(TMP)/javatari && cp -p javatari.js/release/javatari/* $(TMP)/javatari/

tsweb: submodules buildgrammars
	npm run esbuild-clean
	(ip addr || ifconfig) | grep inet
	$(TSC) -w --preserveWatchOutput &
	make watchgrammars &
	sleep 9999999 | npm run esbuild-worker -- --watch &
	sleep 9999999 | npm run esbuild-ui -- --watch &
	python3 scripts/serveit.py 2>> /dev/null #http.out

astrolibre.b64.txt: astrolibre.rom
	lzg -9 $< | base64 -w 0 > $@

VERSION := $(shell git tag -l --points-at HEAD)

syncdev: distro
	cp config.js $(TMP)
	#aws --profile pzp s3 sync --follow-symlinks $(TMP)/ s3://8bitworkshop.com/dev/
	s3cmd -c ~/.s3pzp sync -MFP --no-mime-magic $(TMP)/ s3://8bitworkshop.com/dev/
	rsync --stats -riltz --delete --chmod=a+rx -e "ssh" $(TMP)/ config.js $(RSYNC_PATH)/dev/

syncprod: distro
	@[ "${VERSION}" ] || ( echo ">> No version set at HEAD, tag it first"; exit 1 )
	echo Version: $(VERSION)
	grep -H "var VERSION" web/redir.html
	grep -H "var VERSION" web/projects/projects.js
	read
	cp config.js $(TMP)
	#aws --profile pzp s3 sync --follow-symlinks $(TMP)/ s3://8bitworkshop.com/v$(VERSION)/
	s3cmd -c ~/.s3pzp sync -MFP --no-mime-magic $(TMP)/ config.js s3://8bitworkshop.com/v$(VERSION)/
	rsync --stats --del -riltz --chmod=a+rx -e "ssh" $(TMP)/ config.js $(RSYNC_PATH)/v$(VERSION)/
