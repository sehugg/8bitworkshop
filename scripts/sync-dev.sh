#!/bin/bash

. ./scripts/env.sh
DESTPATH=$RSYNC_PATH/dev/
git ls-files -z | rsync --stats -riltz --exclude '.*' --exclude 'scripts/*' --exclude=node_modules --chmod=a+rx -e "ssh" --files-from - -0 . $DESTPATH
rsync --stats -riltz --chmod=a+rx -e "ssh" ./gen config.js $DESTPATH/
