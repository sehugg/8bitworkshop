#!/bin/bash

#. ./scripts/env.sh
#VERSION=`git tag | tail -1`
VERSION=`git tag -l --points-at HEAD`
if [ "$VERSION" == "" ]; then
  echo "No version at HEAD! Tag it first!"
  exit 1
fi
DESTPATH=$RSYNC_PATH/v$VERSION
DEVPATH=/var/www/html/8bitworkshop.com/dev
grep -H "var VERSION" web/redir.html
grep -H "var VERSION" web/projects/projects.js
echo "Upload version $VERSION to production?"
read
make dist
echo "Copying to $DESTPATH..."
rsync --stats -riltz --chmod=a+rx -e "ssh" ./tmp/dist/ config.js $DESTPATH/
echo "Done."
