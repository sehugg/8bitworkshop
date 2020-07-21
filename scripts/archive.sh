# https://github.com/Kentzo/git-archive-all
# build archives
export VERSION=`git tag | tail -1`
export PREFIX=8bitworkshop-$VERSION
echo Creating $PREFIX
ln -fs . $PREFIX
git-archive-all --prefix $PREFIX release/$PREFIX.zip
zip -9r release/$PREFIX.zip $PREFIX/gen
#git archive --prefix 8bitworkshop- -o release/8bitworkshop-tools.zip HEAD tools

# copy to remote
. ./scripts/env.sh
DESTPATH=$RSYNC_PATH/release/
rsync -rv --progress --stats -e "ssh" release/*.zip $DESTPATH

# remove symlink
rm $PREFIX
