#!/bin/sh

DESTPATH=$RSYNC_PATH/staging/
git ls-files -z | rsync --stats --exclude '.*' --exclude 'scripts/*' --exclude=node_modules -ril -e "ssh -p 2222" --files-from - -0 . $DESTPATH
git archive --format tar.gz --prefix 8bitworkshop- HEAD tools/ > release/8bitworkshop-tools.tgz
rsync --stats -rilvz -e "ssh -p 2222" ./mame  $DESTPATH/
