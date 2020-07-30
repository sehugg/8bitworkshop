#!/bin/bash

DESTPATH=$RSYNC_PATH/dev/
make dist
rsync --stats -riltz --chmod=a+rx -e "ssh" ./tmp/dist/ config.js $DESTPATH/
