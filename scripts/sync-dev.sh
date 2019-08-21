#!/bin/bash

. ./scripts/env.sh
DESTPATH=$RSYNC_PATH/dev/
git ls-files -z | rsync --stats --exclude '.*' --exclude 'scripts/*' --exclude=node_modules -ril --chmod=a+rx -e "ssh" --files-from - -0 . $DESTPATH
rsync --stats -rpilvz --chmod=a+rx -e "ssh" ./gen config.js $DESTPATH/
