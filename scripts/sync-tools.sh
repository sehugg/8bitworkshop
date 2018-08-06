#!/bin/bash

. ./scripts/env.sh
DESTPATH=$RSYNC_PATH/
rsync --stats -rilv -e "ssh -p 2222" ./release/  $DESTPATH/release
