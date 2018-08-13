#!/bin/bash

. ./scripts/env.sh
VERSION=`git tag | tail -1`
DESTPATH=$RSYNC_PATH/
git archive --format tar.gz --prefix 8bitworkshop- HEAD tools/ > release/8bitworkshop-tools.tgz
rsync --stats -rpilvz --chmod=a+rx -e "ssh -p 2222" ./release  $DESTPATH/
