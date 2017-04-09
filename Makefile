
check:
	closure-compiler src/*.js src/cpu/*.js src/platform/*.js > /dev/null

lint:
	gjslint -r src

archive:
	mkdir -p release
	git-archive-all --prefix 8bitworkshop-1.1/ release/8bitworkshop-1.1.tgz
	#git archive --output release/8bitworkshop-1.1.tgz --prefix 8bitworkshop-1.1/ 1.1

