#!/bin/sh

. ./scripts/env.sh
DESTPATH=$RSYNC_PATH/dev/
git ls-files -z | rsync --stats --exclude '.*' --exclude 'scripts/*' --exclude=node_modules -aril -e "ssh -p 2222" --files-from - -0 . $DESTPATH
git archive --format tar.gz --prefix 8bitworkshop- HEAD tools/ > release/8bitworkshop-tools.tgz
rsync --stats -arilvz -e "ssh -p 2222" ./gen ./mame  $DESTPATH/
