#!/bin/sh

. ./scripts/env.sh
rsync --stats -arilv -e "ssh -p 2222" ./blog/  $RSYNC_PATH/blog/
#rsync --stats -arilv -e "ssh -p 2222" ./scripts/  pzp@104.131.86.119:./backups
