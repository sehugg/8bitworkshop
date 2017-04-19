
check:
	closure-compiler src/*.js src/cpu/*.js src/platform/*.js > /dev/null

lint:
	gjslint -r src

# https://github.com/Kentzo/git-archive-all
archive:
	mkdir -p release
	git-archive-all --prefix 8bitworkshop-2.0/ release/8bitworkshop-2.0.zip # 2.0
	#git-archive-all --prefix 8bitworkshop-1.1/ release/8bitworkshop-1.1.zip 1.1
	git archive --prefix 8bitworkshop- -o release/8bitworkshop-tools.zip HEAD tools


