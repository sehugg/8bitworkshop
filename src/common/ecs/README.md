
# NOTES

entity scopes contain entities, and are nested
also contain segments (code, bss, rodata)
components and systems are global
component fields are stored in arrays, range of entities, can be bit-packed
some values can be constant, are stored in rodata (or loaded immediate)
optional components? on or off
union components? either X or Y or Z...

systems receive and send events, execute code on entities
systems are generated on a per-scope basis
system queries can only contain entities from self and parent scopes
starting from the 'init' event walk the event tree
include systems that have at least 1 entity in scope (except init?)

when entering scope, entities are initialized (zero or init w/ data)
to change scope, fire event w/ scope name
- how to handle bank-switching?

helps with:
- rapid prototyping w/ reasonable defaults
- deconstructing objects into arrays
- packing/unpacking bitfields
- initializing objects
- building lookup tables
- selecting and iterating objects
- managing events
- managing memory and scope
- converting assets to native formats?
- removing unused data

it's more convenient to have loops be zero-indexed
for page cross, temp storage, etc
should references be zero-indexed to a field, or global?
should we limit # of entities passed to systems? min-max
join thru a reference? load both x and y

code fragments can be parameterized like macros
if two fragments are identical, do a JSR
(do we have to look for labels?)
should events have parameters? e.g. addscore X Y Z
how are Z80 arrays working?
https://forums.nesdev.org/viewtopic.php?f=20&t=14691
https://www.cpcwiki.eu/forum/programming/trying-not-to-use-ix/msg133416/#msg133416

how to select two between two entities with once? like scoreboard
maybe stack-based interpreter?

can you query specific entities? merge with existing queries?
bigints?
source/if query?

only worry about intersection when non-contiguous ranges?

crazy idea -- full expansion, then relooper

how to avoid cycle crossing for critical code and data? bin packing

system define order, action order, entity order, using order?
what happens when a system must be nested inside another? like display kernels

constants? (NTSC vs PAL)

set operations:

E = select entities from scope
A intersect B
A join B
loop over E limit N asc/desc
select Nth from E
run if A intersects B (if)


virtual machine
- entityset stack
- register states


entity Foo[Bar] { }

system FrameLoop
  
end

class StaticKernel
  locals 12
  func init ---
    lda {{$0}}
    sta {{$1}}
  ---
  func display ---
    lda {{$0}}
    sta {{$1}}
  ---
end

Game {
    superman: [Sprite, ...] {
        var xpos=12
    }
    FrameLoop {
        a: StaticKernel(lines=30,bgcolor=$30)
        b: Kernel48(...)
        c: StaticKernel(...)

        on preframe {
        }
        on display {
        }
        on postframe {
        }
    }
}


systems and scope same thing?
nested systems?
systems allocated in blocks
entities allocated in arrays, take up 1 or more blocks
mid-level abstraction for scopes/macros/(banks?)



Init
with FrameLoop do
  with StaticKernel do 
  end
    ResetSwitch:
      on reset do ResetConsole
    end
    StaticKernel:
    end
    JoyButton:
    end
  end
end


scopes are banks!
banks need to duplicate code and/or rodata
- don't split critical code across banks
need bank trampoline macro
nested scopes for game modes? (title / demo / play)
access parent data from child scope

critical data fields
if accessed in critical section, make critical
ignore arrays that aren't referenced

use DASM for multipass?

processes
take up at least one byte if stateful
might need free list
need jump table?
you'd like to change "mode" from any event

need constant folding, set arrays from other exprs

a = [Sprite,-Player]
foreach a do begin
  xpos = ypos
end

    on gowest do with x:[Location]
---
    ldy {{<room}}
    lda {{<Room:west}},y
    sta {{<room}}
---
    on preframe do
    with y=[SpriteSlot] limit 2
    with x=y.sprite
---
    lda {{<xpos}}
    {{!SetHorizPos}}
---
    on preframe do
    foreach x=[Missile,HasXpos]
---
    lda {{<xpos}}
    ldy {{<index}}
    {{!SetHorizPos}}
---

Slice PNGs into sprites
Maybe output decoder text
Action priorities - before, after
Generate C symbols


QUERIES
- when to intersect / union / start over
  - with vs. foreach limit 1 (at top level)
  - once vs begin/end
  - mapping of regs vs working set
- debug info into source code (and make listing work)

    // subtract one when player wraps around vertically
    on ymoved do begin
      ---
      lda {{<ypos}}
      bne @nowrap
      ---
      select [#PlayerScore] ---
    {{!SubBCD2 1}}}
      ---
      ---
@nowrap:
      ---
    end
