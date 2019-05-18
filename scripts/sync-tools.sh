#!/bin/bash

. ./scripts/env.sh
VERSION=`git tag | tail -1`
DESTPATH=$RSYNC_PATH/
git archive --format tar.gz --prefix 8bitworkshop- HEAD tools/ > release/8bitworkshop-tools.tgz
git archive --format zip --prefix 8bitworkshop- HEAD tools/ > release/8bitworkshop-tools.zip
rsync --stats -rpilvz --chmod=a+rx -e "ssh" ./release  $DESTPATH/
