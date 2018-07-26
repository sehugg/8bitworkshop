#!/bin/sh

. ./scripts/env.sh
VERSION=`git tag | tail -1`
#VERSION=`git tag -l HEAD`
if [ "$VERSION" == "" ]; then
  echo "No version at HEAD! Tag it first!"
  exit 1
fi
DESTPATH=$RSYNC_PATH/v$VERSION
DEVPATH=/var/www/8bitworkshop.com/dev
TMPDIR=/tmp/8bitws/$VERSION
grep "var VERSION" redir.html
echo "Upload version $VERSION to production? (edited redir.html?)"
read
echo "Listing submodules..."
SUBMODS=`git submodule | cut -d ' ' -f 3`
echo "Extracting to $TMPDIR..."
rm -fr $TMPDIR
mkdir -p $TMPDIR
git archive $VERSION | tar x -C $TMPDIR
echo "Copying to $DESTPATH..."
rsync --stats --exclude '.*' --exclude 'scripts/*' --exclude=node_modules --copy-dest=$DEVPATH -aril -e "ssh -p 2222" $TMPDIR/ $SUBMODS $DESTPATH
rsync -a -e "ssh -p 2222" redir.html $DESTPATH/../index.html
#git ls-files -z | 
git archive --format tar.gz --prefix 8bitworkshop- HEAD tools/ > release/8bitworkshop-tools.tgz
#rsync --stats -arilvz -e "ssh -p 2222" ./mame  $DESTPATH/
echo "Done."
