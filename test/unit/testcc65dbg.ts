import assert from "assert";
import { describe, it } from "mocha";
import { parseCC65DbgSizes } from "../../src/worker/tools/cc65dbg";

const DBG = [
  'version\tmajor=2,minor=0',
  'seg\tid=0,name="CODE",start=0x008500,size=0x0100,addrsize=absolute,type=ro',
  'seg\tid=2,name="BSS",start=0x00032A,size=0x0136,addrsize=absolute,type=rw',
  'seg\tid=3,name="DATA",start=0x000300,size=0x0010,addrsize=absolute,type=rw',
  'seg\tid=8,name="CHARS",start=0x000000,size=0x2000,addrsize=absolute,type=rw',
  'span\tid=20,seg=8,start=0,size=4096',
  'span\tid=0,seg=2,start=0,size=32',
  'span\tid=1,seg=2,start=32,size=48',
  'span\tid=2,seg=2,start=80,size=1',
  'span\tid=3,seg=3,start=0,size=4',
  'span\tid=4,seg=3,start=4,size=4',
  'span\tid=5,seg=3,start=8,size=2',
  'span\tid=9,seg=2,start=0,size=300',      // scope span: ignored
  'line\tid=0,file=0,line=10,span=0',
  'line\tid=1,file=0,line=12,span=1',
  'line\tid=2,file=0,line=14,span=2',
  'line\tid=3,file=0,line=20,span=3+4',
  'line\tid=4,file=0,line=21,span=5',
  'line\tid=20,file=1,line=1,span=20',
  'scope\tid=0,name="",mod=0,size=300,span=9',
  'sym\tid=0,name="_formation",addrsize=absolute,scope=0,def=0,val=0x32A,seg=2,type=lab',
  'sym\tid=1,name="_attackers",addrsize=absolute,scope=0,def=1,val=0x34A,seg=2,type=lab',
  'sym\tid=2,name="_last",addrsize=absolute,scope=0,def=2,val=0x37A,seg=2,type=lab',
  'sym\tid=3,name="_table",addrsize=absolute,scope=0,def=3,val=0x300,seg=3,type=lab',
  'sym\tid=4,name="_next",addrsize=absolute,scope=0,def=4,val=0x308,seg=3,type=lab',
  'sym\tid=5,name="_main",addrsize=absolute,size=41,scope=0,def=5,val=0x8500,seg=0,type=lab',
  'sym\tid=6,name="L0002",addrsize=absolute,size=2,scope=1,def=6,val=0x8510,seg=0,type=lab',
  'sym\tid=7,name="L0002",addrsize=absolute,size=3,scope=2,def=7,val=0x8520,seg=0,type=lab',
  'sym\tid=8,name="_nobytes",addrsize=absolute,scope=0,def=8,val=0x8600,seg=0,type=lab',
  'sym\tid=10,name="_chr_tiles",addrsize=absolute,scope=0,def=20,val=0x0,seg=8,type=lab',
  'sym\tid=9,name="FOO",addrsize=zeropage,scope=0,def=9,val=0x10,type=equ',
].join('\n');

describe('cc65 debug file', function () {
  const { sizes, ignored } = parseCC65DbgSizes(DBG, ['HEADER', 'CHARS']);

  it('sizes labels from the line spans that follow them', function () {
    assert.equal(sizes._formation, 32);
    assert.equal(sizes._attackers, 48);
    assert.equal(sizes._last, 1);
  });

  it('sums multiple spans up to the next label', function () {
    assert.equal(sizes._table, 8);
    assert.equal(sizes._next, 2);
  });

  it('uses sizes recorded by ca65', function () {
    assert.equal(sizes._main, 41);
  });

  it('omits duplicates, equates and labels without spans', function () {
    assert.ok(!('L0002' in sizes));
    assert.ok(!('FOO' in sizes));
    assert.ok(!('_nobytes' in sizes));
  });

  it('reports labels in ignored segments instead of sizing them', function () {
    assert.deepEqual(ignored, ['_chr_tiles']);
    assert.ok(!('_chr_tiles' in sizes));
    assert.equal(parseCC65DbgSizes(DBG).sizes._chr_tiles, 4096);
  });
});
