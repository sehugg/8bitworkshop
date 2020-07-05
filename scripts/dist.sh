# https://github.com/Kentzo/git-archive-all
# build archives
export VERSION=`git tag | tail -1`
export OUTDIR=dist
echo Creating $OUTDIR
git-archive-all --prefix . release/$OUTDIR.zip
zip -9r release/$OUTDIR.zip gen
mkdir $OUTDIR
cd $OUTDIR
unzip ../release/$OUTDIR.zip

