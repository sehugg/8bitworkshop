#!/bin/sh

. ./scripts/env.sh
DESTPATH=$RSYNC_PATH/
rsync --stats -arilv -e "ssh -p 2222" ./release/  $DESTPATH/release
