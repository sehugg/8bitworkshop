#!/bin/bash

. ./scripts/env.sh
grep "var VERSION" redir.html
mkdir -p .tmp
cp demo.html .tmp/index.html
rsync -rpilv --chmod=a+rx -e "ssh -p 2222" .tmp/index.html redir.html css bootstrap images $RSYNC_PATH/
rm -fr .tmp
echo "Done."
