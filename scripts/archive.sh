# https://github.com/Kentzo/git-archive-all
# build archives
export VERSION=`git tag | tail -1`
export PREFIX=8bitworkshop-$VERSION
echo "Run make dist first!"
mv tmp/dist tmp/$PREFIX
cd tmp
zip -9rf ../release/$PREFIX.zip $PREFIX
cd ..

# copy to remote
DESTPATH=$RSYNC_PATH/release/
echo "Copy to $DESTPATH"
rsync -rv --progress --stats -e "ssh" release/*.zip $DESTPATH
