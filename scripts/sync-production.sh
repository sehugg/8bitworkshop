#!/bin/sh

. ./scripts/env.sh
DESTPATH=$RSYNC_PATH/
echo "Upload HEAD to production? [Press Enter]"
read
git ls-files -z | rsync --stats --exclude '.*' --exclude 'scripts/*' --exclude=node_modules -aril -e "ssh -p 2222" --files-from - -0 . $DESTPATH
git archive --format tar.gz --prefix 8bitworkshop- HEAD tools/ > release/8bitworkshop-tools.tgz
#rsync --stats -arilvz -e "ssh -p 2222" ./mame  $DESTPATH/
echo "Done."
