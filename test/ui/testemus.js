
function assert(b, msg) {
  if (!b) { throw new Error(msg); }
}

describe('Test VCS emulator', function() {
  var platform = new VCSPlatform();
  it('Should start', function(done) {
    platform.start();
    assert(!platform.isRunning());
    // TODO: more testing
    done();
  });
});

describe('Test Space Invaders emulator', function() {
  var platform = new SpaceInvadersPlatform($('#emulator')[0]);
  it('Should start', function(done) {
    platform.start();
    assert(!platform.isRunning());
    platform.resume();
    assert(platform.isRunning());
    // TODO: more testing
    done();
  });
});
